/**
 * Alert Dispatcher - Handles alert notifications across multiple channels
 * Supports email, webhooks, Slack, and Microsoft Teams
 * @module src/monitoring/alert-dispatcher
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const EventEmitter = require('events');
const WebhookURLValidator = require('./webhook-url-validator'); // SECURITY FIX: Webhook validation

/**
 * Alert Severity Levels
 */
const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Alert Status
 */
const ALERT_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

/**
 * Alert Dispatcher Class
 * Sends alerts through various notification channels
 */
class AlertDispatcher extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      timeout: options.timeout || 10000,
      deduplicationWindow: options.deduplicationWindow || 300000, // SECURITY FIX: Reduced from 3600000 to 5 minutes
      enableRateLimit: options.enableRateLimit !== false,
      maxAlertsPerHour: options.maxAlertsPerHour || 100,
      smtpConfig: options.smtpConfig || null,
      ...options
    };

    // Alert history for deduplication
    this.alertHistory = new Map();
    this.sentAlerts = new Map();

    // Rate limiting
    this.alertCount = new Map();

    // SECURITY FIX: Initialize webhook URL validator
    this.webhookValidator = new WebhookURLValidator({
      requireHttps: options.requireHttpsWebhooks !== false,
      maxWebhooksPerHour: options.maxWebhooksPerHour || 100
    });
  }

  /**
   * Send alert notification
   * @param {Object} alertData - Alert information
   * @param {string} alertData.monitorId - Monitor ID
   * @param {string} alertData.monitorName - Monitor name
   * @param {string} alertData.url - Website URL
   * @param {string} alertData.changeType - Type of change detected
   * @param {string} alertData.severity - Alert severity
   * @param {Object} alertData.changes - Change details
   * @param {Object} alertData.alertConfig - Alert configuration
   * @returns {Promise<Object>} Alert dispatch result
   */
  async sendAlert(alertData) {
    const {
      monitorId,
      monitorName,
      url,
      changeType,
      severity = ALERT_SEVERITY.MEDIUM,
      changes = {},
      alertConfig = {}
    } = alertData;

    // Validate required fields
    if (!monitorId || !monitorName || !url) {
      throw new Error('monitorId, monitorName, and url are required');
    }

    // Check deduplication
    const alertHash = this.generateAlertHash(monitorId, changeType);
    if (this.isAlertDuplicate(alertHash)) {
      return {
        success: false,
        error: 'Alert already sent recently (duplicate)',
        deduped: true
      };
    }

    // Check rate limit
    if (!this.checkRateLimit(monitorId)) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        rateLimited: true
      };
    }

    // Build alert message
    const alertMessage = this.buildAlertMessage(alertData);

    // Send through configured channels
    const results = {};
    let anySucceeded = false;

    if (alertConfig.enableEmail && alertConfig.emailAddresses?.length > 0) {
      try {
        results.email = await this.sendEmailAlert(alertMessage, alertConfig.emailAddresses);
        if (results.email.success) anySucceeded = true;
      } catch (error) {
        results.email = { success: false, error: error.message };
      }
    }

    if (alertConfig.enableWebhook && alertConfig.webhookUrl) {
      try {
        results.webhook = await this.sendWebhookAlert(alertMessage, alertConfig.webhookUrl);
        if (results.webhook.success) anySucceeded = true;
      } catch (error) {
        results.webhook = { success: false, error: error.message };
      }
    }

    if (alertConfig.enableSlack && alertConfig.slackWebhookUrl) {
      try {
        results.slack = await this.sendSlackAlert(alertMessage, alertConfig.slackWebhookUrl);
        if (results.slack.success) anySucceeded = true;
      } catch (error) {
        results.slack = { success: false, error: error.message };
      }
    }

    if (alertConfig.enableTeams && alertConfig.teamsWebhookUrl) {
      try {
        results.teams = await this.sendTeamsAlert(alertMessage, alertConfig.teamsWebhookUrl);
        if (results.teams.success) anySucceeded = true;
      } catch (error) {
        results.teams = { success: false, error: error.message };
      }
    }

    // Record alert for deduplication (regardless of success)
    this.recordSentAlert(alertHash);

    this.emit('alert-sent', {
      monitorId,
      monitorName,
      changeType,
      severity,
      results,
      timestamp: Date.now()
    });

    return {
      success: anySucceeded,
      results,
      alertHash,
      timestamp: Date.now()
    };
  }

  /**
   * Send email alert (stub implementation)
   * @param {Object} message - Alert message
   * @param {Array} recipients - Email addresses
   * @returns {Promise<Object>} Send result
   */
  async sendEmailAlert(message, recipients) {
    try {
      // In production, would integrate with email service (SendGrid, AWS SES, etc.)
      // This is a stub that validates configuration
      if (!this.options.smtpConfig && !process.env.SMTP_HOST) {
        return {
          success: false,
          error: 'SMTP configuration not set'
        };
      }

      // Simulate email sending
      return {
        success: true,
        method: 'email',
        recipients: recipients.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send custom webhook alert
   * @param {Object} message - Alert message
   * @param {string} webhookUrl - Webhook URL
   * @returns {Promise<Object>} Send result
   */
  async sendWebhookAlert(message, webhookUrl) {
    return new Promise((resolve, reject) => {
      try {
        // SECURITY FIX: Validate webhook URL before sending
        const urlValidation = this.webhookValidator.validateWebhookURL(webhookUrl);
        if (!urlValidation.valid) {
          return resolve({
            success: false,
            error: `Invalid webhook URL: ${urlValidation.error}`,
            reason: urlValidation.reason,
            method: 'webhook'
          });
        }

        // SECURITY FIX: Check rate limiting
        const rateCheckResult = this.webhookValidator.checkRateLimit(urlValidation.hostname);
        if (!rateCheckResult.allowed) {
          return resolve({
            success: false,
            error: rateCheckResult.error,
            method: 'webhook',
            rateLimited: true
          });
        }

        const url = new URL(webhookUrl);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const payload = JSON.stringify({
          alert: message,
          timestamp: Date.now(),
          source: 'basset-hound-monitoring'
        });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'Basset-Hound-Monitor/1.0'
          },
          timeout: this.options.timeout
        };

        const req = client.request(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              success: res.statusCode >= 200 && res.statusCode < 300,
              statusCode: res.statusCode,
              method: 'webhook',
              timestamp: Date.now()
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            method: 'webhook'
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Request timeout',
            method: 'webhook'
          });
        });

        req.write(payload);
        req.end();
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          method: 'webhook'
        });
      }
    });
  }

  /**
   * Send Slack alert
   * @param {Object} message - Alert message
   * @param {string} slackWebhookUrl - Slack webhook URL
   * @returns {Promise<Object>} Send result
   */
  async sendSlackAlert(message, slackWebhookUrl) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(slackWebhookUrl);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const payload = JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `Site Change Detected: ${message.monitorName}`,
                emoji: true
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*URL:*\n${message.url}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Change Type:*\n${message.changeType}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Severity:*\n${message.severity.toUpperCase()}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Detected:*\n${new Date(message.timestamp).toISOString()}`
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Details:*\n\`\`\`${JSON.stringify(message.details, null, 2)}\`\`\``
              }
            },
            {
              type: 'divider'
            }
          ]
        });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: this.options.timeout
        };

        const req = client.request(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              method: 'slack',
              timestamp: Date.now()
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            method: 'slack'
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Request timeout',
            method: 'slack'
          });
        });

        req.write(payload);
        req.end();
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          method: 'slack'
        });
      }
    });
  }

  /**
   * Send Microsoft Teams alert
   * @param {Object} message - Alert message
   * @param {string} teamsWebhookUrl - Teams webhook URL
   * @returns {Promise<Object>} Send result
   */
  async sendTeamsAlert(message, teamsWebhookUrl) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(teamsWebhookUrl);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const severity = message.severity.toUpperCase();
        const themeColor = {
          'LOW': '0078D4',
          'MEDIUM': 'FFB900',
          'HIGH': 'FF8C00',
          'CRITICAL': 'E81123'
        }[severity] || '0078D4';

        const payload = JSON.stringify({
          '@type': 'MessageCard',
          '@context': 'https://schema.org/extensions',
          summary: `Site Change Detected: ${message.monitorName}`,
          themeColor: themeColor,
          sections: [
            {
              activityTitle: `Site Change Detected: ${message.monitorName}`,
              activitySubtitle: `Severity: ${severity}`,
              facts: [
                { name: 'URL', value: message.url },
                { name: 'Change Type', value: message.changeType },
                { name: 'Severity', value: severity },
                { name: 'Detected', value: new Date(message.timestamp).toISOString() }
              ],
              markdown: true
            },
            {
              text: `**Details:**\n\`\`\`${JSON.stringify(message.details, null, 2)}\`\`\``
            }
          ]
        });

        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          },
          timeout: this.options.timeout
        };

        const req = client.request(url, options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({
              success: res.statusCode === 200,
              statusCode: res.statusCode,
              method: 'teams',
              timestamp: Date.now()
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            error: error.message,
            method: 'teams'
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Request timeout',
            method: 'teams'
          });
        });

        req.write(payload);
        req.end();
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          method: 'teams'
        });
      }
    });
  }

  /**
   * Build formatted alert message
   * @param {Object} alertData - Alert data
   * @returns {Object} Formatted message
   */
  buildAlertMessage(alertData) {
    return {
      monitorId: alertData.monitorId,
      monitorName: alertData.monitorName,
      url: alertData.url,
      changeType: alertData.changeType,
      severity: alertData.severity,
      timestamp: Date.now(),
      details: alertData.changes,
      summary: this.generateAlertSummary(alertData)
    };
  }

  /**
   * Generate human-readable alert summary
   * @param {Object} alertData - Alert data
   * @returns {string} Alert summary
   */
  generateAlertSummary(alertData) {
    const { monitorName, url, changeType, severity, changes = {} } = alertData;

    let summary = `Change detected on ${monitorName} (${url}):\n`;
    summary += `Type: ${changeType}\n`;
    summary += `Severity: ${severity}\n`;

    if (changes.lengthChange) {
      summary += `Content length changed by ${changes.lengthChange} bytes\n`;
    }
    if (changes.wordCountChange) {
      summary += `Word count changed by ${changes.wordCountChange} words\n`;
    }
    if (changes.added) {
      summary += `Added technologies: ${Object.values(changes.added).flat().join(', ')}\n`;
    }
    if (changes.removed) {
      summary += `Removed technologies: ${Object.values(changes.removed).flat().join(', ')}\n`;
    }

    return summary;
  }

  /**
   * Generate alert hash for deduplication
   * @param {string} monitorId - Monitor ID
   * @param {string} changeType - Change type
   * @returns {string} Alert hash
   */
  generateAlertHash(monitorId, changeType) {
    const data = `${monitorId}:${changeType}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Check if alert is a duplicate
   * @param {string} alertHash - Alert hash
   * @returns {boolean} Is duplicate
   */
  isAlertDuplicate(alertHash) {
    const lastAlertTime = this.alertHistory.get(alertHash);
    if (!lastAlertTime) {
      return false;
    }

    const timeSinceLastAlert = Date.now() - lastAlertTime;
    return timeSinceLastAlert < this.options.deduplicationWindow;
  }

  /**
   * Record sent alert
   * @param {string} alertHash - Alert hash
   * @returns {void}
   */
  recordSentAlert(alertHash) {
    this.alertHistory.set(alertHash, Date.now());
  }

  /**
   * Check rate limit for monitor
   * @param {string} monitorId - Monitor ID
   * @returns {boolean} Is within rate limit
   */
  checkRateLimit(monitorId) {
    if (!this.options.enableRateLimit) {
      return true;
    }

    const hourKey = Math.floor(Date.now() / 3600000);
    const key = `${monitorId}:${hourKey}`;

    const count = this.alertCount.get(key) || 0;
    if (count >= this.options.maxAlertsPerHour) {
      return false;
    }

    this.alertCount.set(key, count + 1);
    return true;
  }

  /**
   * Clear old deduplication entries
   * @returns {void}
   */
  cleanupDeduplication() {
    const now = Date.now();
    for (const [hash, timestamp] of this.alertHistory.entries()) {
      if (now - timestamp > this.options.deduplicationWindow) {
        this.alertHistory.delete(hash);
      }
    }
  }

  /**
   * Get alert statistics
   * @returns {Object} Alert stats
   */
  getAlertStats() {
    return {
      totalAlertsSent: this.sentAlerts.size,
      deduplicatedAlerts: this.alertHistory.size,
      rateLimitedAlerts: Array.from(this.alertCount.values()).reduce((a, b) => a + b, 0)
    };
  }
}

module.exports = {
  AlertDispatcher,
  ALERT_SEVERITY,
  ALERT_STATUS
};

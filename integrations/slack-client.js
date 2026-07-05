/**
 * Slack Client Module
 *
 * Handles all Slack API interactions including:
 * - Webhook message delivery
 * - Bot token authentication
 * - Message formatting and threading
 * - Error handling and retry logic
 * - Rate limiting enforcement
 *
 * @module integrations/slack-client
 */

const https = require('https');
const http = require('http');
const url = require('url');

/**
 * Slack Rate Limiting Configuration
 * - Default: 1 message per second per workspace
 * - Burst: Up to 10 messages in initial window
 */
const SLACK_RATE_LIMITS = {
  messagesPerSecond: 1,
  burstSize: 10,
  retryAttempts: 3,
  retryDelayMs: 1000
};

/**
 * SlackClient - Main client for Slack API interactions
 */
class SlackClient {
  constructor(config = {}) {
    this.webhookUrls = config.webhookUrls || {};
    this.botToken = config.botToken || null;
    this.rateLimitTrackers = {};
    this.messageQueue = [];
    this.isProcessing = false;
    this.config = {
      retryAttempts: config.retryAttempts || SLACK_RATE_LIMITS.retryAttempts,
      retryDelayMs: config.retryDelayMs || SLACK_RATE_LIMITS.retryDelayMs,
      defaultChannel: config.defaultChannel || '#alerts'
    };

    // Initialize rate limit tracking
    this.initializeRateLimiting();
  }

  /**
   * Initialize rate limiting for webhooks
   */
  initializeRateLimiting() {
    for (const webhookId of Object.keys(this.webhookUrls)) {
      this.rateLimitTrackers[webhookId] = {
        messageCount: 0,
        windowStart: Date.now(),
        burstCount: 0,
        lastMessageTime: 0
      };
    }
  }

  /**
   * Add webhook URL for a specific channel or integration point
   *
   * @param {string} webhookId - Unique identifier for the webhook
   * @param {string} webhookUrl - Full Slack webhook URL
   * @returns {Object} { success: boolean, error?: string }
   */
  addWebhook(webhookId, webhookUrl) {
    if (!webhookUrl || !webhookUrl.includes('hooks.slack.com')) {
      return {
        success: false,
        error: 'Invalid Slack webhook URL'
      };
    }

    this.webhookUrls[webhookId] = webhookUrl;
    this.rateLimitTrackers[webhookId] = {
      messageCount: 0,
      windowStart: Date.now(),
      burstCount: 0,
      lastMessageTime: 0
    };

    return { success: true };
  }

  /**
   * Remove a webhook
   *
   * @param {string} webhookId - Webhook ID to remove
   * @returns {Object} { success: boolean }
   */
  removeWebhook(webhookId) {
    if (this.webhookUrls[webhookId]) {
      delete this.webhookUrls[webhookId];
      delete this.rateLimitTrackers[webhookId];
      return { success: true };
    }
    return {
      success: false,
      error: 'Webhook not found'
    };
  }

  /**
   * Get all registered webhooks
   *
   * @returns {Object} Map of webhook IDs to URLs (URLs are masked)
   */
  listWebhooks() {
    const masked = {};
    for (const [id, url] of Object.entries(this.webhookUrls)) {
      // Mask the webhook URL for security
      masked[id] = url.substring(0, 20) + '...';
    }
    return masked;
  }

  /**
   * Check and enforce rate limits
   *
   * @param {string} webhookId - Webhook ID to check
   * @returns {Object} { allowed: boolean, retryAfterMs?: number }
   */
  checkRateLimit(webhookId) {
    const tracker = this.rateLimitTrackers[webhookId];
    if (!tracker) {
      return { allowed: false, error: 'Webhook not found' };
    }

    const now = Date.now();
    const windowAge = now - tracker.windowStart;

    // Reset window if 1 second has passed
    if (windowAge > 1000) {
      tracker.messageCount = 0;
      tracker.windowStart = now;
      tracker.burstCount = 0;
    }

    // Check burst limit
    if (tracker.burstCount >= SLACK_RATE_LIMITS.burstSize) {
      return {
        allowed: false,
        retryAfterMs: 1000 - windowAge
      };
    }

    // Check per-second limit
    if (tracker.messageCount >= SLACK_RATE_LIMITS.messagesPerSecond) {
      return {
        allowed: false,
        retryAfterMs: 1000 - windowAge
      };
    }

    tracker.messageCount++;
    tracker.burstCount++;
    tracker.lastMessageTime = now;

    return { allowed: true };
  }

  /**
   * Send message via webhook (queued and rate-limited)
   *
   * @param {string} webhookId - Webhook ID to use
   * @param {Object} message - Message payload (Slack Block Kit format)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result with messageId, timestamp, etc
   */
  async sendMessage(webhookId, message, options = {}) {
    return new Promise((resolve, reject) => {
      // Queue the message
      this.messageQueue.push({
        webhookId,
        message,
        options,
        resolve,
        reject,
        retryCount: 0,
        timestamp: Date.now()
      });

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Process the message queue with rate limiting
   *
   * @private
   */
  async processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.messageQueue.length > 0) {
      const item = this.messageQueue[0];
      const rateCheckResult = this.checkRateLimit(item.webhookId);

      if (!rateCheckResult.allowed) {
        // Wait before retrying
        await this.sleep(rateCheckResult.retryAfterMs || 100);
        continue;
      }

      // Remove from queue and send
      this.messageQueue.shift();

      try {
        const result = await this._sendViaWebhook(
          item.webhookId,
          item.message,
          item.options
        );
        item.resolve(result);
      } catch (error) {
        if (item.retryCount < this.config.retryAttempts) {
          item.retryCount++;
          item.timestamp = Date.now();
          this.messageQueue.push(item);
          await this.sleep(this.config.retryDelayMs);
        } else {
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Actually send via webhook
   *
   * @private
   */
  async _sendViaWebhook(webhookId, message, options = {}) {
    const webhookUrl = this.webhookUrls[webhookId];
    if (!webhookUrl) {
      throw new Error(`Webhook ${webhookId} not found`);
    }

    return new Promise((resolve, reject) => {
      try {
        const parsedUrl = new url.URL(webhookUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const payload = JSON.stringify(message);

        const requestOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'SlackClient/1.0'
          },
          timeout: 10000
        };

        const req = protocol.request(parsedUrl, requestOptions, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                success: true,
                webhookId,
                statusCode: res.statusCode,
                timestamp: Date.now(),
                messageId: options.messageId || `msg_${Date.now()}_${Math.random()}`
              });
            } else if (res.statusCode === 429) {
              // Rate limited by Slack
              const retryAfter = res.headers['retry-after'] || '1';
              reject(new Error(`Rate limited. Retry after ${retryAfter}s`));
            } else {
              reject(new Error(`Slack API error: ${res.statusCode} - ${data}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.write(payload);
        req.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send alert message (formatted for common alert types)
   *
   * @param {string} webhookId - Webhook ID to use
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} Result
   */
  async sendAlert(webhookId, alert) {
    const message = this.formatAlert(alert);
    return this.sendMessage(webhookId, message, { alertId: alert.id });
  }

  /**
   * Format alert into Slack message blocks
   *
   * @param {Object} alert - Alert data
   * @returns {Object} Slack message payload
   */
  formatAlert(alert) {
    const severity = alert.severity || 'info';
    const severityColor = {
      critical: '#ff0000',
      high: '#ff6600',
      medium: '#ffcc00',
      low: '#00cc00',
      info: '#0099ff'
    }[severity] || '#0099ff';

    return {
      text: alert.title || 'Alert',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: alert.title || 'Alert Notification',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Type:*\n${alert.type || 'unknown'}`
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${severity.toUpperCase()}`
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${alert.source || 'browser'}`
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n${new Date().toISOString()}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details:*\n${alert.message || 'No details provided'}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Basset Hound Browser | Alert ID: ${alert.id || 'unknown'}_`
            }
          ]
        }
      ],
      attachments: [
        {
          color: severityColor,
          fields: alert.metadata ? [
            {
              title: 'Metadata',
              value: JSON.stringify(alert.metadata, null, 2),
              short: false
            }
          ] : []
        }
      ]
    };
  }

  /**
   * Test webhook connectivity
   *
   * @param {string} webhookId - Webhook ID to test
   * @returns {Promise<Object>} { success: boolean, error?: string }
   */
  async testWebhook(webhookId) {
    const testMessage = {
      text: 'Test message from Basset Hound Browser',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Connection Test',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'This is a test message from Basset Hound Browser. If you see this, your webhook is properly configured!'
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_Test sent at ${new Date().toISOString()}_`
            }
          ]
        }
      ]
    };

    try {
      const result = await this._sendViaWebhook(webhookId, testMessage);
      return {
        success: true,
        message: 'Webhook test successful',
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get webhook status and stats
   *
   * @param {string} webhookId - Webhook ID (optional, returns all if not specified)
   * @returns {Object} Status information
   */
  getStatus(webhookId) {
    if (webhookId) {
      const tracker = this.rateLimitTrackers[webhookId];
      return {
        webhookId,
        registered: Boolean(this.webhookUrls[webhookId]),
        messagesSentThisWindow: tracker?.messageCount || 0,
        lastMessageTime: tracker?.lastMessageTime || null,
        queuedMessages: this.messageQueue.filter(m => m.webhookId === webhookId).length
      };
    }

    // Return all statuses
    const statuses = {};
    for (const id of Object.keys(this.webhookUrls)) {
      const tracker = this.rateLimitTrackers[id];
      statuses[id] = {
        registered: true,
        messagesSentThisWindow: tracker?.messageCount || 0,
        lastMessageTime: tracker?.lastMessageTime || null,
        queuedMessages: this.messageQueue.filter(m => m.webhookId === id).length
      };
    }

    return {
      totalWebhooks: Object.keys(this.webhookUrls).length,
      queuedMessages: this.messageQueue.length,
      isProcessing: this.isProcessing,
      webhooks: statuses
    };
  }

  /**
   * Sleep utility for delays
   *
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.messageQueue = [];
    this.webhookUrls = {};
    this.rateLimitTrackers = {};
  }
}

module.exports = { SlackClient, SLACK_RATE_LIMITS };

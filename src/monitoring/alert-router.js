/**
 * Alert Router & Escalation Manager
 *
 * Routes alerts to multiple channels:
 * - Slack integration for team notifications
 * - PagerDuty integration for on-call escalation
 * - Email escalation for critical issues
 * - SMS for page-worthy events
 * - Alert suppression and deduplication
 *
 * @module src/monitoring/alert-router
 * @requires events
 * @requires https
 */

const EventEmitter = require('events');
const https = require('https');

/**
 * Alert Router & Escalation Manager
 * Routes alerts to configured notification channels
 */
class AlertRouter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableSlack: options.enableSlack !== false,
      enablePagerDuty: options.enablePagerDuty !== false,
      enableEmail: options.enableEmail !== false,
      enableSms: options.enableSms !== false,
      slackWebhook: options.slackWebhook,
      pagerDutyToken: options.pagerDutyToken,
      pagerDutyServiceId: options.pagerDutyServiceId,
      emailConfig: options.emailConfig,
      smsConfig: options.smsConfig,
      suppressionEnabled: options.suppressionEnabled !== false,
      suppressionDuration: options.suppressionDuration || 3600000, // 1 hour
      deduplicationEnabled: options.deduplicationEnabled !== false,
      deduplicationWindow: options.deduplicationWindow || 300000, // 5 minutes
      ...options
    };

    // Tracking
    this.sentAlerts = new Map(); // For deduplication
    this.suppressedAlerts = new Map(); // For suppression
    this.routingRules = new Map();

    // Initialize default routing rules
    this._initializeDefaultRules();
  }

  /**
   * Initialize default routing rules
   * @private
   */
  _initializeDefaultRules() {
    // Critical alerts -> Slack + PagerDuty + Email + SMS
    this.registerRoutingRule({
      name: 'critical_escalation',
      severity: 'critical',
      channels: ['slack', 'pagerduty', 'email', 'sms'],
      description: 'Critical alerts escalated to all channels'
    });

    // High alerts -> Slack + PagerDuty + Email
    this.registerRoutingRule({
      name: 'high_escalation',
      severity: 'high',
      channels: ['slack', 'pagerduty', 'email'],
      description: 'High severity alerts escalated to primary channels'
    });

    // Medium alerts -> Slack + Email
    this.registerRoutingRule({
      name: 'medium_notification',
      severity: 'medium',
      channels: ['slack', 'email'],
      description: 'Medium severity alerts sent to team'
    });

    // Low alerts -> Slack only
    this.registerRoutingRule({
      name: 'low_notification',
      severity: 'low',
      channels: ['slack'],
      description: 'Low severity alerts logged to Slack'
    });
  }

  /**
   * Register a routing rule
   */
  registerRoutingRule(rule) {
    const routingRule = {
      id: rule.name,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      channels: rule.channels || [],
      condition: rule.condition,
      enabled: rule.enabled !== false
    };

    this.routingRules.set(rule.name, routingRule);
  }

  /**
   * Route an alert to appropriate channels
   */
  async routeAlert(alert) {
    // Check if alert should be suppressed
    if (this.options.suppressionEnabled && this._isAlertSuppressed(alert)) {
      this.emit('alert:suppressed', {
        ...alert,
        reason: 'suppressed'
      });
      return;
    }

    // Check deduplication
    if (this.options.deduplicationEnabled && this._isDuplicate(alert)) {
      this.emit('alert:deduplicated', {
        ...alert,
        reason: 'duplicate'
      });
      return;
    }

    // Get routing rule for this alert
    const rule = this._getRoutingRule(alert);
    if (!rule) {
      this.emit('alert:no_routing_rule', alert);
      return;
    }

    // Route to appropriate channels
    const channels = rule.channels || [];
    const promises = [];

    if (channels.includes('slack') && this.options.enableSlack && this.options.slackWebhook) {
      promises.push(this._sendSlackAlert(alert).catch(e => {
        this.emit('routing:error', {
          alert,
          channel: 'slack',
          error: e.message
        });
      }));
    }

    if (channels.includes('pagerduty') && this.options.enablePagerDuty && this.options.pagerDutyToken) {
      promises.push(this._sendPagerDutyAlert(alert).catch(e => {
        this.emit('routing:error', {
          alert,
          channel: 'pagerduty',
          error: e.message
        });
      }));
    }

    if (channels.includes('email') && this.options.enableEmail && this.options.emailConfig) {
      promises.push(this._sendEmailAlert(alert).catch(e => {
        this.emit('routing:error', {
          alert,
          channel: 'email',
          error: e.message
        });
      }));
    }

    if (channels.includes('sms') && this.options.enableSms && this.options.smsConfig) {
      promises.push(this._sendSmsAlert(alert).catch(e => {
        this.emit('routing:error', {
          alert,
          channel: 'sms',
          error: e.message
        });
      }));
    }

    // Wait for all routing to complete
    try {
      await Promise.all(promises);

      // Record sent alert
      this._recordSentAlert(alert);

      this.emit('alert:routed', {
        ...alert,
        channels,
        routed: true
      });
    } catch (e) {
      this.emit('routing:failed', {
        alert,
        error: e.message
      });
    }
  }

  /**
   * Send Slack alert
   * @private
   */
  async _sendSlackAlert(alert) {
    const color = this._getSeverityColor(alert.severity);
    const emoji = this._getSeverityEmoji(alert.severity);

    const payload = {
      attachments: [{
        fallback: `${emoji} ${alert.severity.toUpperCase()}: ${alert.description}`,
        color,
        title: `${emoji} ${alert.ruleName}`,
        text: alert.description,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Metric',
            value: alert.metric || 'N/A',
            short: true
          },
          {
            title: 'Duration',
            value: `${Math.round((alert.timestamp - alert.firstSeen) / 1000)}s`,
            short: true
          },
          {
            title: 'Count',
            value: `${alert.count || 1}`,
            short: true
          }
        ],
        ts: Math.floor(alert.timestamp / 1000)
      }]
    };

    return this._postToWebhook(this.options.slackWebhook, payload);
  }

  /**
   * Send PagerDuty alert
   * @private
   */
  async _sendPagerDutyAlert(alert) {
    const severity = this._mapToPagerDutySeverity(alert.severity);

    const payload = {
      routing_key: this.options.pagerDutyToken,
      event_action: 'trigger',
      dedup_key: `basset-hound-${alert.ruleId}-${alert.metric}`,
      payload: {
        summary: `${alert.ruleName}: ${alert.description}`,
        severity,
        source: 'Basset Hound Browser',
        custom_details: {
          rule_id: alert.ruleId,
          metric: alert.metric,
          severity: alert.severity,
          count: alert.count,
          duration_seconds: Math.round((Date.now() - alert.firstSeen) / 1000)
        },
        timestamp: new Date(alert.timestamp).toISOString()
      }
    };

    return this._postToUrl('https://events.pagerduty.com/v2/enqueue', payload, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Send email alert
   * @private
   */
  async _sendEmailAlert(alert) {
    // This would integrate with your email service (SendGrid, AWS SES, etc.)
    // Placeholder implementation
    const subject = `[${alert.severity.toUpperCase()}] ${alert.ruleName}`;
    const body = `
Alert: ${alert.ruleName}
Description: ${alert.description}
Severity: ${alert.severity}
Metric: ${alert.metric}
First Seen: ${new Date(alert.firstSeen).toISOString()}
Last Triggered: ${new Date(alert.timestamp).toISOString()}
Duration: ${Math.round((alert.timestamp - alert.firstSeen) / 1000)}s
Count: ${alert.count}
    `;

    this.emit('email:pending', {
      alert,
      subject,
      body,
      recipients: this.options.emailConfig?.recipients || []
    });

    return Promise.resolve();
  }

  /**
   * Send SMS alert
   * @private
   */
  async _sendSmsAlert(alert) {
    // This would integrate with your SMS service (Twilio, AWS SNS, etc.)
    // Placeholder implementation
    const message = `[${alert.severity}] ${alert.ruleName}: ${alert.description}`;

    this.emit('sms:pending', {
      alert,
      message,
      recipients: this.options.smsConfig?.recipients || []
    });

    return Promise.resolve();
  }

  /**
   * Check if alert is suppressed
   * @private
   */
  _isAlertSuppressed(alert) {
    const suppressionKey = `${alert.ruleId}:${alert.metric}`;
    const suppression = this.suppressedAlerts.get(suppressionKey);

    if (!suppression) {
      return false;
    }

    if (Date.now() - suppression.timestamp > this.options.suppressionDuration) {
      this.suppressedAlerts.delete(suppressionKey);
      return false;
    }

    return true;
  }

  /**
   * Check if alert is duplicate
   * @private
   */
  _isDuplicate(alert) {
    const deduplicationKey = `${alert.ruleId}:${alert.metric}`;
    const lastSent = this.sentAlerts.get(deduplicationKey);

    if (!lastSent) {
      return false;
    }

    if (Date.now() - lastSent > this.options.deduplicationWindow) {
      return false;
    }

    return true;
  }

  /**
   * Get routing rule for alert
   * @private
   */
  _getRoutingRule(alert) {
    // Check for specific rule
    for (const rule of this.routingRules.values()) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.severity === alert.severity) {
        if (!rule.condition || rule.condition(alert)) {
          return rule;
        }
      }
    }

    return null;
  }

  /**
   * Record sent alert for deduplication
   * @private
   */
  _recordSentAlert(alert) {
    const key = `${alert.ruleId}:${alert.metric}`;
    this.sentAlerts.set(key, Date.now());

    // Cleanup old entries
    for (const [k, timestamp] of this.sentAlerts) {
      if (Date.now() - timestamp > this.options.deduplicationWindow * 2) {
        this.sentAlerts.delete(k);
      }
    }
  }

  /**
   * Suppress an alert
   */
  suppressAlert(ruleId, metric, durationMs = null) {
    const suppressionKey = `${ruleId}:${metric}`;
    this.suppressedAlerts.set(suppressionKey, {
      timestamp: Date.now(),
      duration: durationMs || this.options.suppressionDuration
    });

    this.emit('alert:suppressed_manual', { ruleId, metric });
  }

  /**
   * Unsuppress an alert
   */
  unsuppressAlert(ruleId, metric) {
    const suppressionKey = `${ruleId}:${metric}`;
    this.suppressedAlerts.delete(suppressionKey);

    this.emit('alert:unsuppressed', { ruleId, metric });
  }

  /**
   * Get severity color for Slack
   * @private
   */
  _getSeverityColor(severity) {
    const colors = {
      critical: '#FF0000',
      high: '#FF6600',
      medium: '#FFAA00',
      low: '#00AA00'
    };
    return colors[severity] || '#808080';
  }

  /**
   * Get severity emoji
   * @private
   */
  _getSeverityEmoji(severity) {
    const emojis = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    return emojis[severity] || '❓';
  }

  /**
   * Map severity to PagerDuty format
   * @private
   */
  _mapToPagerDutySeverity(severity) {
    const mapping = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info'
    };
    return mapping[severity] || 'error';
  }

  /**
   * Post to webhook
   * @private
   */
  _postToWebhook(url, payload) {
    return this._postToUrl(url, payload, {
      'Content-Type': 'application/json'
    });
  }

  /**
   * Post to URL
   * @private
   */
  _postToUrl(url, payload, headers = {}) {
    return new Promise((resolve, reject) => {
      try {
        const data = JSON.stringify(payload);
        const parsedUrl = new URL(url);

        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname + (parsedUrl.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            ...headers
          }
        };

        const req = https.request(options, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ statusCode: res.statusCode, data: responseData });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Get routing statistics
   */
  getStats() {
    return {
      timestamp: Date.now(),
      sentAlerts: this.sentAlerts.size,
      suppressedAlerts: this.suppressedAlerts.size,
      routingRules: this.routingRules.size
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.sentAlerts.clear();
    this.suppressedAlerts.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  AlertRouter
};

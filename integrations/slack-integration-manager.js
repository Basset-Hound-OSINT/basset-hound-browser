/**
 * Slack Integration Manager
 *
 * High-level manager for Slack integration:
 * - Configuration management
 * - Alert routing
 * - Batch message handling
 * - Integration lifecycle
 *
 * @module integrations/slack-integration-manager
 */

const { SlackClient } = require('./slack-client');
const { SlackAlertFormatter } = require('./slack-alert-formatter');

/**
 * SlackIntegrationManager - Main integration coordinator
 */
class SlackIntegrationManager {
  constructor(config = {}) {
    this.client = new SlackClient(config.client || {});
    this.formatter = new SlackAlertFormatter(config.formatter || {});
    this.routingRules = new Map();
    this.alertHistory = [];
    this.config = {
      maxHistorySize: config.maxHistorySize || 1000,
      defaultChannel: config.defaultChannel || 'alerts',
      enableLogging: config.enableLogging !== false
    };

    this.stats = {
      alertsSent: 0,
      alertsFailed: 0,
      alertsQueued: 0,
      startTime: Date.now()
    };
  }

  /**
   * Initialize the integration with configuration
   *
   * @param {Object} config - Configuration object
   * @returns {Object} { success: boolean, error?: string }
   */
  initialize(config) {
    try {
      if (config.webhooks) {
        for (const [id, url] of Object.entries(config.webhooks)) {
          this.client.addWebhook(id, url);
        }
      }

      if (config.routingRules) {
        for (const rule of config.routingRules) {
          this.addRoutingRule(rule);
        }
      }

      this.logInfo('Slack integration initialized successfully');
      return { success: true };
    } catch (error) {
      this.logError('Failed to initialize Slack integration', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add a routing rule (route alerts to specific channels)
   *
   * @param {Object} rule - Routing rule
   * @returns {Object} { success: boolean, ruleId: string }
   */
  addRoutingRule(rule) {
    const {
      ruleId = this.generateRuleId(),
      source,
      alertType,
      webhookId,
      enabled = true,
      priority = 0
    } = rule;

    if (!source && !alertType) {
      return {
        success: false,
        error: 'Rule must specify source or alertType'
      };
    }

    if (!webhookId) {
      return {
        success: false,
        error: 'Rule must specify a webhookId'
      };
    }

    const routingRule = {
      ruleId,
      source: source || '*',
      alertType: alertType || '*',
      webhookId,
      enabled,
      priority,
      createdAt: Date.now()
    };

    this.routingRules.set(ruleId, routingRule);
    this.logInfo(`Routing rule added: ${ruleId}`);

    return {
      success: true,
      ruleId
    };
  }

  /**
   * Remove a routing rule
   *
   * @param {string} ruleId - Rule ID to remove
   * @returns {Object} { success: boolean }
   */
  removeRoutingRule(ruleId) {
    if (this.routingRules.has(ruleId)) {
      this.routingRules.delete(ruleId);
      this.logInfo(`Routing rule removed: ${ruleId}`);
      return { success: true };
    }

    return {
      success: false,
      error: 'Rule not found'
    };
  }

  /**
   * Get all routing rules
   *
   * @returns {Array<Object>} Routing rules
   */
  getRoutingRules() {
    return Array.from(this.routingRules.values());
  }

  /**
   * Find target webhooks for an alert based on routing rules
   *
   * @private
   */
  findTargetWebhooks(alert) {
    const alertSource = alert.source || 'browser';
    const alertType = alert.alertType || alert.type || 'generic';

    const matchingRules = Array.from(this.routingRules.values())
      .filter(rule => rule.enabled)
      .filter(rule => {
        const sourceMatch = rule.source === '*' || rule.source === alertSource;
        const typeMatch = rule.alertType === '*' || rule.alertType === alertType;
        return sourceMatch && typeMatch;
      })
      .sort((a, b) => b.priority - a.priority);

    if (matchingRules.length === 0) {
      // Use default webhook if no rules match
      const defaultWebhook = Array.from(this.client.webhookUrls.keys())[0];
      return defaultWebhook ? [defaultWebhook] : [];
    }

    // Deduplicate webhooks
    return [...new Set(matchingRules.map(rule => rule.webhookId))];
  }

  /**
   * Send alert to Slack
   *
   * @param {Object} alert - Alert data
   * @returns {Promise<Object>} { success: boolean, results: Array, error?: string }
   */
  async sendAlert(alert) {
    try {
      // Assign ID if not present
      if (!alert.id) {
        alert.id = this.generateAlertId();
      }

      // Find target webhooks
      const targetWebhooks = this.findTargetWebhooks(alert);

      if (targetWebhooks.length === 0) {
        return {
          success: false,
          error: 'No webhooks configured for this alert type'
        };
      }

      // Format the alert
      const message = this.formatter.formatAlert(alert);

      // Send to all target webhooks
      const results = [];
      for (const webhookId of targetWebhooks) {
        try {
          const result = await this.client.sendMessage(webhookId, message, {
            alertId: alert.id
          });
          results.push({
            webhookId,
            success: true,
            messageId: result.messageId
          });
          this.stats.alertsSent++;
        } catch (error) {
          results.push({
            webhookId,
            success: false,
            error: error.message
          });
          this.stats.alertsFailed++;
        }
      }

      // Store in history
      this.addToHistory(alert, results);

      this.logInfo(`Alert sent to ${targetWebhooks.length} webhook(s)`, {
        alertId: alert.id,
        type: alert.alertType || alert.type
      });

      return {
        success: results.some(r => r.success),
        results
      };
    } catch (error) {
      this.logError('Failed to send alert', error);
      this.stats.alertsFailed++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch send multiple alerts
   *
   * @param {Array<Object>} alerts - Array of alerts
   * @returns {Promise<Object>} Batch result with success/failure counts
   */
  async sendAlertBatch(alerts) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const alert of alerts) {
      try {
        const result = await this.sendAlert(alert);
        results.push(result);
        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
        failureCount++;
      }
    }

    this.stats.alertsQueued = this.client.messageQueue.length;

    return {
      totalAlerts: alerts.length,
      successCount,
      failureCount,
      results
    };
  }

  /**
   * Test webhook connectivity
   *
   * @param {string} webhookId - Webhook ID to test
   * @returns {Promise<Object>} Test result
   */
  async testWebhook(webhookId) {
    return this.client.testWebhook(webhookId);
  }

  /**
   * Add webhook to integration
   *
   * @param {string} webhookId - Webhook ID
   * @param {string} webhookUrl - Slack webhook URL
   * @returns {Object} { success: boolean, error?: string }
   */
  addWebhook(webhookId, webhookUrl) {
    return this.client.addWebhook(webhookId, webhookUrl);
  }

  /**
   * Remove webhook from integration
   *
   * @param {string} webhookId - Webhook ID to remove
   * @returns {Object} { success: boolean }
   */
  removeWebhook(webhookId) {
    return this.client.removeWebhook(webhookId);
  }

  /**
   * List all registered webhooks
   *
   * @returns {Object} Map of webhook IDs to masked URLs
   */
  listWebhooks() {
    return this.client.listWebhooks();
  }

  /**
   * Get integration status
   *
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: true,
      webhooks: this.client.getStatus(),
      routingRules: this.getRoutingRules().length,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime,
        alertHistory: this.alertHistory.length
      }
    };
  }

  /**
   * Get alert history
   *
   * @param {Object} options - Filter options
   * @returns {Array<Object>} Alert history
   */
  getAlertHistory(options = {}) {
    let history = [...this.alertHistory];

    // Filter by type
    if (options.type) {
      history = history.filter(h =>
        (h.alert.alertType || h.alert.type) === options.type
      );
    }

    // Filter by time range
    if (options.since) {
      history = history.filter(h => h.timestamp >= options.since);
    }

    // Limit results
    const limit = options.limit || 100;
    return history.slice(-limit);
  }

  /**
   * Clear alert history
   *
   * @returns {Object} { success: boolean, clearedCount: number }
   */
  clearAlertHistory() {
    const clearedCount = this.alertHistory.length;
    this.alertHistory = [];
    return {
      success: true,
      clearedCount
    };
  }

  /**
   * Add alert to history (internal)
   *
   * @private
   */
  addToHistory(alert, results) {
    this.alertHistory.push({
      alert: {
        id: alert.id,
        type: alert.alertType || alert.type,
        source: alert.source,
        title: alert.title
      },
      results,
      timestamp: Date.now()
    });

    // Keep history size under limit
    if (this.alertHistory.length > this.config.maxHistorySize) {
      this.alertHistory.splice(0, this.alertHistory.length - this.config.maxHistorySize);
    }
  }

  /**
   * Generate unique alert ID
   *
   * @private
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique rule ID
   *
   * @private
   */
  generateRuleId() {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log info message
   *
   * @private
   */
  logInfo(message, data = {}) {
    if (this.config.enableLogging) {
      console.log(`[SlackIntegration] ${message}`, data);
    }
  }

  /**
   * Log error message
   *
   * @private
   */
  logError(message, error) {
    if (this.config.enableLogging) {
      console.error(`[SlackIntegration] ${message}`, error);
    }
  }

  /**
   * Cleanup and destroy the integration
   */
  destroy() {
    this.client.destroy();
    this.routingRules.clear();
    this.alertHistory = [];
  }
}

module.exports = { SlackIntegrationManager };

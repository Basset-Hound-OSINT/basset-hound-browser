/**
 * Slack Integration WebSocket Commands
 *
 * WebSocket API commands for Slack webhook management:
 * - setup_slack_webhook
 * - test_slack_webhook
 * - remove_slack_webhook
 * - list_slack_webhooks
 * - update_slack_channel
 * - get_slack_status
 * - send_slack_alert
 *
 * @module websocket/commands/slack-commands
 */

const { SlackIntegrationManager } = require('../../integrations/slack-integration-manager');

// Singleton integration manager
let slackManager = null;

/**
 * Get or create the Slack integration manager
 *
 * @returns {SlackIntegrationManager}
 */
function getSlackManager() {
  if (!slackManager) {
    slackManager = new SlackIntegrationManager({
      enableLogging: true
    });
  }
  return slackManager;
}

/**
 * Register Slack commands with the WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window (unused, for consistency)
 */
function registerSlackCommands(server) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Setup Slack webhook for alert notifications
   *
   * @command setup_slack_webhook
   * @param {string} params.webhookId - Unique identifier for this webhook
   * @param {string} params.webhookUrl - Full Slack incoming webhook URL
   * @returns {Object} { success: boolean, error?: string }
   *
   * @example
   * {
   *   "command": "setup_slack_webhook",
   *   "params": {
   *     "webhookId": "main-alerts",
   *     "webhookUrl": "https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_BOT_ID/YOUR_SECRET_TOKEN"
   *   }
   * }
   */
  commandHandlers.setup_slack_webhook = async (params) => {
    const { webhookId, webhookUrl } = params;

    if (!webhookId || !webhookUrl) {
      return {
        success: false,
        error: 'webhookId and webhookUrl are required'
      };
    }

    const manager = getSlackManager();
    return manager.addWebhook(webhookId, webhookUrl);
  };

  /**
   * Test webhook connectivity
   *
   * @command test_slack_webhook
   * @param {string} params.webhookId - Webhook ID to test
   * @returns {Object} { success: boolean, error?: string, message?: string }
   *
   * @example
   * {
   *   "command": "test_slack_webhook",
   *   "params": {
   *     "webhookId": "main-alerts"
   *   }
   * }
   */
  commandHandlers.test_slack_webhook = async (params) => {
    const { webhookId } = params;

    if (!webhookId) {
      return {
        success: false,
        error: 'webhookId is required'
      };
    }

    const manager = getSlackManager();
    return manager.testWebhook(webhookId);
  };

  /**
   * Remove a Slack webhook
   *
   * @command remove_slack_webhook
   * @param {string} params.webhookId - Webhook ID to remove
   * @returns {Object} { success: boolean }
   *
   * @example
   * {
   *   "command": "remove_slack_webhook",
   *   "params": {
   *     "webhookId": "main-alerts"
   *   }
   * }
   */
  commandHandlers.remove_slack_webhook = async (params) => {
    const { webhookId } = params;

    if (!webhookId) {
      return {
        success: false,
        error: 'webhookId is required'
      };
    }

    const manager = getSlackManager();
    return manager.removeWebhook(webhookId);
  };

  /**
   * List all registered Slack webhooks
   *
   * @command list_slack_webhooks
   * @returns {Object} Map of webhook IDs to masked URLs
   *
   * @example
   * {
   *   "command": "list_slack_webhooks"
   * }
   */
  commandHandlers.list_slack_webhooks = async (params) => {
    const manager = getSlackManager();
    return manager.listWebhooks();
  };

  /**
   * Update default Slack channel for alerts
   *
   * @command update_slack_channel
   * @param {string} params.webhookId - Webhook ID to associate with channel
   * @param {string} params.channel - Channel name (for reference)
   * @returns {Object} { success: boolean, message?: string }
   *
   * @example
   * {
   *   "command": "update_slack_channel",
   *   "params": {
   *     "webhookId": "main-alerts",
   *     "channel": "#competitor-alerts"
   *   }
   * }
   */
  commandHandlers.update_slack_channel = async (params) => {
    const { webhookId, channel } = params;

    if (!webhookId) {
      return {
        success: false,
        error: 'webhookId is required'
      };
    }

    // Validate webhook exists
    const manager = getSlackManager();
    const webhooks = manager.listWebhooks();

    if (!webhooks[webhookId]) {
      return {
        success: false,
        error: 'Webhook not found'
      };
    }

    return {
      success: true,
      message: `Channel ${channel} associated with webhook ${webhookId}`
    };
  };

  /**
   * Get Slack integration status
   *
   * @command get_slack_status
   * @returns {Object} Integration status including webhooks, routing rules, and stats
   *
   * @example
   * {
   *   "command": "get_slack_status"
   * }
   */
  commandHandlers.get_slack_status = async (params) => {
    const manager = getSlackManager();
    return manager.getStatus();
  };

  /**
   * Send alert via Slack
   *
   * @command send_slack_alert
   * @param {Object} params.alert - Alert data
   * @param {string} params.alert.id - Unique alert ID
   * @param {string} params.alert.type - Alert type (competitor_change, technology_update, error, etc)
   * @param {string} params.alert.title - Alert title
   * @param {string} params.alert.message - Alert message
   * @param {string} [params.alert.severity] - Severity level (critical, high, medium, low, info)
   * @param {Object} [params.alert.metadata] - Additional alert metadata
   * @returns {Object} { success: boolean, results?: Array, error?: string }
   *
   * @example
   * {
   *   "command": "send_slack_alert",
   *   "params": {
   *     "alert": {
   *       "type": "competitor_change",
   *       "title": "Competitor Change Detected",
   *       "message": "Acme Corp updated their pricing page",
   *       "severity": "high",
   *       "competitorName": "Acme Corp",
   *       "changeType": "pricing",
   *       "url": "https://acme.com/pricing"
   *     }
   *   }
   * }
   */
  commandHandlers.send_slack_alert = async (params) => {
    const { alert } = params;

    if (!alert) {
      return {
        success: false,
        error: 'alert parameter is required'
      };
    }

    const manager = getSlackManager();
    return manager.sendAlert(alert);
  };

  /**
   * Send multiple alerts in batch
   *
   * @command send_slack_alerts_batch
   * @param {Array<Object>} params.alerts - Array of alerts
   * @returns {Object} Batch result with success/failure counts
   *
   * @example
   * {
   *   "command": "send_slack_alerts_batch",
   *   "params": {
   *     "alerts": [
   *       {
   *         "type": "competitor_change",
   *         "title": "Change 1",
   *         "message": "Details..."
   *       },
   *       {
   *         "type": "technology_update",
   *         "title": "Update 1",
   *         "message": "Details..."
   *       }
   *     ]
   *   }
   * }
   */
  commandHandlers.send_slack_alerts_batch = async (params) => {
    const { alerts } = params;

    if (!Array.isArray(alerts)) {
      return {
        success: false,
        error: 'alerts must be an array'
      };
    }

    const manager = getSlackManager();
    return manager.sendAlertBatch(alerts);
  };
}

module.exports = { registerSlackCommands };

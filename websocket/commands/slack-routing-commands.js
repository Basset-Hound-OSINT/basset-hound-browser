/**
 * Slack Alert Routing WebSocket Commands
 *
 * WebSocket API commands for alert routing configuration:
 * - setup_slack_routing
 * - add_slack_routing_rule
 * - remove_slack_routing_rule
 * - list_slack_routing_rules
 * - update_slack_routing_rule
 *
 * @module websocket/commands/slack-routing-commands
 */

// Import slack manager from slack-commands
const { registerSlackCommands } = require('./slack-commands');
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
 * Register Slack routing commands with the WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window (unused, for consistency)
 */
function registerSlackRoutingCommands(server) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Setup Slack routing configuration
   *
   * @command setup_slack_routing
   * @param {Object} params.config - Routing configuration
   * @param {Object} params.config.webhooks - Initial webhooks to register
   * @param {Array<Object>} params.config.routingRules - Initial routing rules
   * @returns {Object} { success: boolean, error?: string, rulesCount?: number }
   *
   * @example
   * {
   *   "command": "setup_slack_routing",
   *   "params": {
   *     "config": {
   *       "webhooks": {
   *         "competitor-alerts": "https://hooks.slack.com/...",
   *         "tech-alerts": "https://hooks.slack.com/..."
   *       },
   *       "routingRules": [
   *         {
   *           "source": "browser",
   *           "alertType": "competitor_change",
   *           "webhookId": "competitor-alerts",
   *           "priority": 10
   *         },
   *         {
   *           "source": "browser",
   *           "alertType": "technology_update",
   *           "webhookId": "tech-alerts",
   *           "priority": 5
   *         }
   *       ]
   *     }
   *   }
   * }
   */
  commandHandlers.setup_slack_routing = async (params) => {
    const { config = {} } = params;

    try {
      const manager = getSlackManager();
      const result = manager.initialize(config);

      if (result.success) {
        const rulesCount = manager.getRoutingRules().length;
        return {
          success: true,
          rulesCount,
          message: `Slack routing configured with ${rulesCount} rule(s)`
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Add a new routing rule
   *
   * @command add_slack_routing_rule
   * @param {string} [params.ruleId] - Optional rule ID (auto-generated if not provided)
   * @param {string} [params.source] - Alert source (e.g., 'browser', '*' for any)
   * @param {string} [params.alertType] - Alert type to route (e.g., 'competitor_change', '*' for any)
   * @param {string} params.webhookId - Target webhook ID
   * @param {number} [params.priority] - Rule priority (higher = matched first)
   * @param {boolean} [params.enabled] - Whether rule is enabled
   * @returns {Object} { success: boolean, ruleId?: string, error?: string }
   *
   * @example
   * {
   *   "command": "add_slack_routing_rule",
   *   "params": {
   *     "source": "browser",
   *     "alertType": "competitor_change",
   *     "webhookId": "competitor-alerts",
   *     "priority": 10,
   *     "enabled": true
   *   }
   * }
   */
  commandHandlers.add_slack_routing_rule = async (params) => {
    const manager = getSlackManager();
    return manager.addRoutingRule(params);
  };

  /**
   * Remove a routing rule
   *
   * @command remove_slack_routing_rule
   * @param {string} params.ruleId - Rule ID to remove
   * @returns {Object} { success: boolean, error?: string }
   *
   * @example
   * {
   *   "command": "remove_slack_routing_rule",
   *   "params": {
   *     "ruleId": "rule_1234567890_abc123"
   *   }
   * }
   */
  commandHandlers.remove_slack_routing_rule = async (params) => {
    const { ruleId } = params;

    if (!ruleId) {
      return {
        success: false,
        error: 'ruleId is required'
      };
    }

    const manager = getSlackManager();
    return manager.removeRoutingRule(ruleId);
  };

  /**
   * List all routing rules
   *
   * @command list_slack_routing_rules
   * @returns {Array<Object>} Array of routing rules
   *
   * @example
   * {
   *   "command": "list_slack_routing_rules"
   * }
   */
  commandHandlers.list_slack_routing_rules = async (params) => {
    const manager = getSlackManager();
    return manager.getRoutingRules();
  };

  /**
   * Update a routing rule
   *
   * @command update_slack_routing_rule
   * @param {string} params.ruleId - Rule ID to update
   * @param {Object} params.updates - Fields to update
   * @returns {Object} { success: boolean, error?: string }
   *
   * @example
   * {
   *   "command": "update_slack_routing_rule",
   *   "params": {
   *     "ruleId": "rule_1234567890_abc123",
   *     "updates": {
   *       "priority": 20,
   *       "enabled": false
   *     }
   *   }
   * }
   */
  commandHandlers.update_slack_routing_rule = async (params) => {
    const { ruleId, updates } = params;

    if (!ruleId || !updates) {
      return {
        success: false,
        error: 'ruleId and updates are required'
      };
    }

    const manager = getSlackManager();
    const rules = manager.getRoutingRules();
    const rule = rules.find(r => r.ruleId === ruleId);

    if (!rule) {
      return {
        success: false,
        error: 'Rule not found'
      };
    }

    // Remove old rule and add updated one
    manager.removeRoutingRule(ruleId);

    const updatedRule = {
      ...rule,
      ...updates,
      ruleId, // Preserve the ID
      createdAt: rule.createdAt // Preserve creation time
    };

    return manager.addRoutingRule(updatedRule);
  };

  /**
   * Get routing configuration as JSON (for export/backup)
   *
   * @command get_slack_routing_config
   * @returns {Object} Complete routing configuration
   *
   * @example
   * {
   *   "command": "get_slack_routing_config"
   * }
   */
  commandHandlers.get_slack_routing_config = async (params) => {
    const manager = getSlackManager();
    return {
      webhooks: manager.listWebhooks(),
      routingRules: manager.getRoutingRules(),
      status: manager.getStatus()
    };
  };

  /**
   * Import routing configuration from JSON
   *
   * @command import_slack_routing_config
   * @param {Object} params.config - Configuration to import
   * @returns {Object} { success: boolean, message?: string, error?: string }
   *
   * @example
   * {
   *   "command": "import_slack_routing_config",
   *   "params": {
   *     "config": {
   *       "webhooks": {...},
   *       "routingRules": [...]
   *     }
   *   }
   * }
   */
  commandHandlers.import_slack_routing_config = async (params) => {
    const { config } = params;

    if (!config) {
      return {
        success: false,
        error: 'config is required'
      };
    }

    const manager = getSlackManager();
    const result = manager.initialize(config);

    return {
      ...result,
      message: `Imported ${manager.getRoutingRules().length} routing rule(s)`
    };
  };

  /**
   * Test routing configuration with a sample alert
   *
   * @command test_slack_routing
   * @param {Object} params.alert - Sample alert to test routing
   * @returns {Object} { success: boolean, targetedWebhooks?: Array, error?: string }
   *
   * @example
   * {
   *   "command": "test_slack_routing",
   *   "params": {
   *     "alert": {
   *       "source": "browser",
   *       "alertType": "competitor_change",
   *       "title": "Test Alert",
   *       "message": "This is a test"
   *     }
   *   }
   * }
   */
  commandHandlers.test_slack_routing = async (params) => {
    const { alert } = params;

    if (!alert) {
      return {
        success: false,
        error: 'alert parameter is required'
      };
    }

    const manager = getSlackManager();

    // Don't actually send the alert, just return which webhooks would be targeted
    const targetWebhooks = [];
    const rules = manager.getRoutingRules();

    const alertSource = alert.source || 'browser';
    const alertType = alert.alertType || alert.type || 'generic';

    const matchingRules = rules
      .filter(rule => rule.enabled)
      .filter(rule => {
        const sourceMatch = rule.source === '*' || rule.source === alertSource;
        const typeMatch = rule.alertType === '*' || rule.alertType === alertType;
        return sourceMatch && typeMatch;
      })
      .sort((a, b) => b.priority - a.priority);

    const webhookIds = [...new Set(matchingRules.map(rule => rule.webhookId))];

    return {
      success: true,
      alert,
      matchingRules: matchingRules.length,
      targetedWebhooks: webhookIds,
      message: `Alert would be routed to ${webhookIds.length} webhook(s)`
    };
  };

  /**
   * Get alert history from Slack integration
   *
   * @command get_slack_alert_history
   * @param {Object} [params.options] - Filter options
   * @param {string} [params.options.type] - Filter by alert type
   * @param {number} [params.options.since] - Filter by timestamp (ms)
   * @param {number} [params.options.limit] - Limit results
   * @returns {Array<Object>} Alert history
   *
   * @example
   * {
   *   "command": "get_slack_alert_history",
   *   "params": {
   *     "options": {
   *       "type": "competitor_change",
   *       "limit": 10
   *     }
   *   }
   * }
   */
  commandHandlers.get_slack_alert_history = async (params) => {
    const { options = {} } = params;
    const manager = getSlackManager();
    return manager.getAlertHistory(options);
  };

  /**
   * Clear alert history
   *
   * @command clear_slack_alert_history
   * @returns {Object} { success: boolean, clearedCount: number }
   *
   * @example
   * {
   *   "command": "clear_slack_alert_history"
   * }
   */
  commandHandlers.clear_slack_alert_history = async (params) => {
    const manager = getSlackManager();
    return manager.clearAlertHistory();
  };
}

module.exports = { registerSlackRoutingCommands };

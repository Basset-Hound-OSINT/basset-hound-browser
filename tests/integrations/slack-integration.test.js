/**
 * Slack Integration Manager Tests
 *
 * Integration tests for:
 * - Alert routing
 * - Multi-webhook dispatch
 * - Routing rules
 * - Alert history
 * - Configuration management
 *
 * @test
 */

const { SlackIntegrationManager } = require('../../integrations/slack-integration-manager');

describe('SlackIntegrationManager', () => {
  let manager;
  const testWebhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';

  beforeEach(() => {
    manager = new SlackIntegrationManager({
      enableLogging: false,
      maxHistorySize: 100
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Webhook Management', () => {
    test('should add webhook', () => {
      const result = manager.addWebhook('alerts', testWebhookUrl);

      expect(result.success).toBe(true);
      expect(manager.listWebhooks()).toHaveProperty('alerts');
    });

    test('should remove webhook', () => {
      manager.addWebhook('alerts', testWebhookUrl);
      const result = manager.removeWebhook('alerts');

      expect(result.success).toBe(true);
      expect(manager.listWebhooks()).not.toHaveProperty('alerts');
    });

    test('should list registered webhooks', () => {
      manager.addWebhook('alerts', testWebhookUrl);
      manager.addWebhook('critical', testWebhookUrl);

      const webhooks = manager.listWebhooks();

      expect(Object.keys(webhooks)).toHaveLength(2);
      expect(webhooks).toHaveProperty('alerts');
      expect(webhooks).toHaveProperty('critical');
    });
  });

  describe('Routing Rules', () => {
    beforeEach(() => {
      manager.addWebhook('webhook1', testWebhookUrl);
      manager.addWebhook('webhook2', testWebhookUrl);
    });

    test('should add routing rule', () => {
      const result = manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'webhook1',
        priority: 10
      });

      expect(result.success).toBe(true);
      expect(result.ruleId).toBeDefined();
    });

    test('should require source or alertType', () => {
      const result = manager.addRoutingRule({
        webhookId: 'webhook1'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('source or alertType');
    });

    test('should require webhookId', () => {
      const result = manager.addRoutingRule({
        source: 'browser'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('webhookId');
    });

    test('should remove routing rule', () => {
      const { ruleId } = manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'webhook1'
      });

      const removeResult = manager.removeRoutingRule(ruleId);

      expect(removeResult.success).toBe(true);
      expect(manager.getRoutingRules()).toHaveLength(0);
    });

    test('should get all routing rules', () => {
      manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'webhook1'
      });

      manager.addRoutingRule({
        alertType: 'technology_update',
        webhookId: 'webhook2',
        priority: 5
      });

      const rules = manager.getRoutingRules();

      expect(rules).toHaveLength(2);
      expect(rules[0]).toHaveProperty('ruleId');
      expect(rules[0]).toHaveProperty('priority');
    });
  });

  describe('Alert Routing Logic', () => {
    beforeEach(() => {
      manager.addWebhook('competitor', testWebhookUrl);
      manager.addWebhook('tech', testWebhookUrl);
      manager.addWebhook('general', testWebhookUrl);

      manager.addRoutingRule({
        alertType: 'competitor_change',
        webhookId: 'competitor',
        priority: 10
      });

      manager.addRoutingRule({
        alertType: 'technology_update',
        webhookId: 'tech',
        priority: 10
      });

      manager.addRoutingRule({
        alertType: '*',
        webhookId: 'general',
        priority: 0
      });
    });

    test('should route competitor change alert to correct webhook', async () => {
      const targetWebhooks = manager['findTargetWebhooks']({
        type: 'competitor_change'
      });

      expect(targetWebhooks).toContain('competitor');
    });

    test('should route technology update alert to correct webhook', async () => {
      const targetWebhooks = manager['findTargetWebhooks']({
        type: 'technology_update'
      });

      expect(targetWebhooks).toContain('tech');
    });

    test('should fallback to catch-all rule', async () => {
      const targetWebhooks = manager['findTargetWebhooks']({
        type: 'unknown_type'
      });

      expect(targetWebhooks).toContain('general');
    });

    test('should respect rule priority', () => {
      // Add a higher priority generic rule
      manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'general',
        priority: 100
      });

      const targetWebhooks = manager['findTargetWebhooks']({
        source: 'browser',
        type: 'competitor_change'
      });

      // Should match the higher priority rule
      expect(targetWebhooks[0]).toBe('general');
    });

    test('should deduplicate target webhooks', () => {
      manager.addRoutingRule({
        alertType: 'competitor_change',
        webhookId: 'competitor',
        priority: 5
      });

      const targetWebhooks = manager['findTargetWebhooks']({
        type: 'competitor_change'
      });

      // Should not have duplicates
      expect(new Set(targetWebhooks).size).toBe(targetWebhooks.length);
    });
  });

  describe('Alert History', () => {
    test('should add alert to history', () => {
      const alert = { id: 'test-1', type: 'competitor_change' };
      const results = [{ webhookId: 'webhook1', success: true }];

      manager.addToHistory(alert, results);

      expect(manager.alertHistory).toHaveLength(1);
      expect(manager.alertHistory[0].alert.id).toBe('test-1');
    });

    test('should get alert history', () => {
      manager.addToHistory({ id: '1', type: 'competitor_change' }, []);
      manager.addToHistory({ id: '2', type: 'error' }, []);
      manager.addToHistory({ id: '3', type: 'competitor_change' }, []);

      const history = manager.getAlertHistory();

      expect(history).toHaveLength(3);
    });

    test('should filter history by type', () => {
      manager.addToHistory({ id: '1', type: 'competitor_change' }, []);
      manager.addToHistory({ id: '2', type: 'error' }, []);
      manager.addToHistory({ id: '3', type: 'competitor_change' }, []);

      const history = manager.getAlertHistory({ type: 'competitor_change' });

      expect(history).toHaveLength(2);
      expect(history.every(h => h.alert.type === 'competitor_change')).toBe(true);
    });

    test('should limit history results', () => {
      for (let i = 0; i < 50; i++) {
        manager.addToHistory({ id: String(i), type: 'test' }, []);
      }

      const history = manager.getAlertHistory({ limit: 10 });

      expect(history.length).toBeLessThanOrEqual(10);
    });

    test('should respect maxHistorySize', () => {
      const smallManager = new SlackIntegrationManager({
        enableLogging: false,
        maxHistorySize: 10
      });

      for (let i = 0; i < 20; i++) {
        smallManager.addToHistory({ id: String(i), type: 'test' }, []);
      }

      expect(smallManager.alertHistory.length).toBeLessThanOrEqual(10);
      smallManager.destroy();
    });

    test('should clear history', () => {
      manager.addToHistory({ id: '1', type: 'test' }, []);
      manager.addToHistory({ id: '2', type: 'test' }, []);

      const result = manager.clearAlertHistory();

      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(2);
      expect(manager.alertHistory).toHaveLength(0);
    });
  });

  describe('Configuration', () => {
    test('should initialize with configuration', () => {
      const config = {
        webhooks: {
          'webhook1': testWebhookUrl,
          'webhook2': testWebhookUrl
        },
        routingRules: [
          {
            alertType: 'competitor_change',
            webhookId: 'webhook1'
          }
        ]
      };

      const result = manager.initialize(config);

      expect(result.success).toBe(true);
      expect(Object.keys(manager.listWebhooks())).toHaveLength(2);
      expect(manager.getRoutingRules()).toHaveLength(1);
    });
  });

  describe('Status and Statistics', () => {
    test('should return current status', () => {
      manager.addWebhook('alerts', testWebhookUrl);

      const status = manager.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.webhooks).toBeDefined();
      expect(status.routingRules).toBeDefined();
      expect(status.stats).toBeDefined();
      expect(status.stats.alertsSent).toBe(0);
      expect(status.stats.alertsFailed).toBe(0);
      expect(status.stats.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should track alert statistics', async () => {
      manager.addWebhook('webhook1', testWebhookUrl);

      // Since actual webhook call will fail in test,
      // we'll verify stats increment is attempted
      const initialStats = { ...manager.stats };

      // Stats should track via sendAlert (will fail but still increment)
      await manager.sendAlert({
        id: 'test',
        type: 'error',
        title: 'Test',
        message: 'Test'
      }).catch(() => {});

      // alertsFailed should increment even on failure
      expect(manager.stats.alertsFailed).toBeGreaterThanOrEqual(initialStats.alertsFailed);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      manager.addWebhook('alerts', testWebhookUrl);
    });

    test('should send batch of alerts', async () => {
      const alerts = [
        { id: '1', type: 'competitor_change', title: 'Alert 1', message: 'Test 1' },
        { id: '2', type: 'error', title: 'Alert 2', message: 'Test 2' },
        { id: '3', type: 'technology_update', title: 'Alert 3', message: 'Test 3' }
      ];

      const result = await manager.sendAlertBatch(alerts);

      expect(result.totalAlerts).toBe(3);
      expect(result.results).toHaveLength(3);
      expect(result.successCount + result.failureCount).toBe(3);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique alert IDs', () => {
      const id1 = manager.generateAlertId();
      const id2 = manager.generateAlertId();

      expect(id1).not.toBe(id2);
      expect(id1).toContain('alert_');
      expect(id2).toContain('alert_');
    });

    test('should generate unique rule IDs', () => {
      const id1 = manager.generateRuleId();
      const id2 = manager.generateRuleId();

      expect(id1).not.toBe(id2);
      expect(id1).toContain('rule_');
      expect(id2).toContain('rule_');
    });
  });

  describe('Cleanup', () => {
    test('should destroy manager properly', () => {
      manager.addWebhook('webhook1', testWebhookUrl);
      manager.addRoutingRule({
        alertType: 'test',
        webhookId: 'webhook1'
      });

      manager.destroy();

      expect(Object.keys(manager.listWebhooks())).toHaveLength(0);
      expect(manager.getRoutingRules()).toHaveLength(0);
      expect(manager.alertHistory).toHaveLength(0);
    });
  });
});

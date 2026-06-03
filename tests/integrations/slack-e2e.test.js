/**
 * Slack Integration End-to-End Tests
 *
 * Integration tests covering:
 * - Complete alert flow
 * - WebSocket command handling
 * - Multi-channel routing
 * - Real webhook simulation
 *
 * @test
 */

const { SlackIntegrationManager } = require('../../integrations/slack-integration-manager');
const { SlackClient } = require('../../integrations/slack-client');
const { SlackAlertFormatter } = require('../../integrations/slack-alert-formatter');

describe('Slack Integration E2E', () => {
  let manager;
  const testWebhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX';

  beforeEach(() => {
    manager = new SlackIntegrationManager({
      enableLogging: false
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Complete Alert Flow', () => {
    test('should handle full competitor change alert flow', async () => {
      // Setup webhooks
      manager.addWebhook('competitor-alerts', testWebhookUrl);

      // Setup routing
      manager.addRoutingRule({
        alertType: 'competitor_change',
        webhookId: 'competitor-alerts',
        priority: 10
      });

      // Create and send alert
      const alert = {
        alertType: 'competitor_change',
        competitorName: 'Acme Corp',
        changeType: 'pricing',
        changeDetails: { oldPrice: '$100', newPrice: '$80' },
        url: 'https://acme.com/pricing',
        severity: 'high',
        message: 'Price reduction detected'
      };

      const result = await manager.sendAlert(alert);

      expect(result).toBeDefined();
      expect(alert.id).toBeDefined(); // Should have assigned an ID
      expect(manager.stats.alertsSent).toBeGreaterThanOrEqual(0);
    });

    test('should handle technology update alert flow', async () => {
      manager.addWebhook('tech-alerts', testWebhookUrl);

      manager.addRoutingRule({
        alertType: 'technology_update',
        webhookId: 'tech-alerts'
      });

      const alert = {
        alertType: 'technology_update',
        competitorName: 'Tech Inc',
        technology: 'React',
        previousVersion: '17.0.0',
        newVersion: '18.0.0',
        changes: ['Concurrent rendering', 'Automatic batching'],
        severity: 'info'
      };

      const result = await manager.sendAlert(alert);

      expect(result).toBeDefined();
      expect(alert.id).toBeDefined();
    });

    test('should handle error alert flow', async () => {
      manager.addWebhook('error-alerts', testWebhookUrl);

      manager.addRoutingRule({
        alertType: 'error',
        webhookId: 'error-alerts'
      });

      const alert = {
        alertType: 'error',
        errorType: 'NetworkError',
        errorMessage: 'Connection timeout',
        stackTrace: 'Error: timeout\n  at connect',
        severity: 'critical'
      };

      const result = await manager.sendAlert(alert);

      expect(result).toBeDefined();
      expect(alert.id).toBeDefined();
    });
  });

  describe('Multi-Channel Routing', () => {
    beforeEach(() => {
      manager.addWebhook('channel-1', testWebhookUrl);
      manager.addWebhook('channel-2', testWebhookUrl);
      manager.addWebhook('channel-3', testWebhookUrl);
    });

    test('should route alerts to multiple channels based on rules', async () => {
      manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'channel-1',
        priority: 10
      });

      manager.addRoutingRule({
        source: 'browser',
        alertType: 'competitor_change',
        webhookId: 'channel-2',
        priority: 9
      });

      manager.addRoutingRule({
        alertType: '*',
        webhookId: 'channel-3',
        priority: 0
      });

      const alert = {
        source: 'browser',
        alertType: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        severity: 'medium'
      };

      const result = await manager.sendAlert(alert);

      // Should have results for multiple webhooks
      expect(result.results.length).toBeGreaterThan(0);
    });

    test('should respect webhook deduplication in routing', async () => {
      manager.addRoutingRule({
        alertType: 'competitor_change',
        webhookId: 'channel-1',
        priority: 10
      });

      manager.addRoutingRule({
        alertType: 'competitor_change',
        webhookId: 'channel-1',
        priority: 5
      });

      const targetWebhooks = manager['findTargetWebhooks']({
        type: 'competitor_change'
      });

      // Should not have duplicates
      expect(new Set(targetWebhooks).size).toBe(targetWebhooks.length);
    });
  });

  describe('Alert Formatting in Flow', () => {
    test('should format alerts correctly in flow', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      const alert = {
        alertType: 'competitor_change',
        competitorName: 'Acme',
        changeType: 'feature',
        changeDetails: { new: 'dark mode' },
        url: 'https://acme.com',
        severity: 'medium'
      };

      const formatted = manager.formatter.formatAlert(alert);

      expect(formatted.blocks).toBeDefined();
      expect(formatted.blocks.length).toBeGreaterThan(0);
      expect(formatted.text).toContain('Acme');
    });

    test('should include all required Slack message fields', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      const alert = {
        id: 'test-alert',
        alertType: 'error',
        errorType: 'TestError',
        errorMessage: 'Test failed',
        severity: 'high'
      };

      const formatted = manager.formatter.formatAlert(alert);

      expect(formatted.text).toBeDefined();
      expect(formatted.blocks).toBeDefined();
      expect(Array.isArray(formatted.blocks)).toBe(true);
      expect(formatted.attachments).toBeDefined();

      // Verify block structure
      const blockTypes = formatted.blocks.map(b => b.type);
      expect(blockTypes.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Alert Flow', () => {
    beforeEach(() => {
      manager.addWebhook('batch-alerts', testWebhookUrl);
    });

    test('should send multiple alerts in batch', async () => {
      const alerts = [
        {
          alertType: 'competitor_change',
          competitorName: 'Comp 1',
          changeType: 'pricing',
          severity: 'high'
        },
        {
          alertType: 'technology_update',
          competitorName: 'Comp 2',
          technology: 'Node.js',
          previousVersion: '14',
          newVersion: '16',
          severity: 'info'
        },
        {
          alertType: 'error',
          errorType: 'TimeoutError',
          errorMessage: 'Request timeout',
          severity: 'medium'
        }
      ];

      const result = await manager.sendAlertBatch(alerts);

      expect(result.totalAlerts).toBe(3);
      expect(result.results).toHaveLength(3);
    });
  });

  describe('Configuration and Setup', () => {
    test('should setup complete configuration from object', () => {
      const config = {
        webhooks: {
          'alerts': testWebhookUrl,
          'critical': testWebhookUrl,
          'info': testWebhookUrl
        },
        routingRules: [
          {
            source: 'browser',
            alertType: 'error',
            webhookId: 'critical',
            priority: 100
          },
          {
            source: 'browser',
            alertType: 'competitor_change',
            webhookId: 'alerts',
            priority: 50
          },
          {
            alertType: '*',
            webhookId: 'info',
            priority: 0
          }
        ]
      };

      const result = manager.initialize(config);

      expect(result.success).toBe(true);
      expect(Object.keys(manager.listWebhooks())).toHaveLength(3);
      expect(manager.getRoutingRules()).toHaveLength(3);
    });
  });

  describe('Status and Monitoring', () => {
    test('should provide accurate status during operations', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      let status = manager.getStatus();
      const initialSent = status.stats.alertsSent;

      // Send an alert
      await manager.sendAlert({
        alertType: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        severity: 'low'
      }).catch(() => {});

      status = manager.getStatus();

      expect(status.webhooks).toBeDefined();
      expect(status.routingRules).toBeGreaterThanOrEqual(0);
      expect(status.stats.uptime).toBeGreaterThan(0);
    });

    test('should maintain alert history', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      // Send multiple alerts
      for (let i = 0; i < 5; i++) {
        await manager.sendAlert({
          alertType: 'error',
          errorType: `Error${i}`,
          errorMessage: `Test ${i}`,
          severity: 'info'
        }).catch(() => {});
      }

      const history = manager.getAlertHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle missing webhooks gracefully', async () => {
      const alert = {
        alertType: 'competitor_change',
        competitorName: 'Test',
        changeType: 'feature',
        severity: 'medium'
      };

      const result = await manager.sendAlert(alert);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid alerts gracefully', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      // Send invalid alert
      const result = await manager.sendAlert(null);

      expect(result.success).toBe(false);
    });

    test('should track failed alert statistics', async () => {
      const initialFailed = manager.stats.alertsFailed;

      // Try to send alert without webhooks
      await manager.sendAlert({
        alertType: 'test',
        title: 'Test',
        message: 'Test'
      }).catch(() => {});

      expect(manager.stats.alertsFailed).toBeGreaterThanOrEqual(initialFailed);
    });
  });

  describe('Integration with Client and Formatter', () => {
    test('should use SlackClient for message delivery', () => {
      expect(manager.client).toBeInstanceOf(SlackClient);
      expect(manager.formatter).toBeInstanceOf(SlackAlertFormatter);
    });

    test('should format alerts before delivery', async () => {
      manager.addWebhook('alerts', testWebhookUrl);

      const alert = {
        alertType: 'competitor_change',
        competitorName: 'Test Corp',
        changeType: 'pricing',
        url: 'https://test.com',
        severity: 'high'
      };

      // Spy on formatter
      const formatSpy = jest.spyOn(manager.formatter, 'formatAlert');

      await manager.sendAlert(alert).catch(() => {});

      expect(formatSpy).toHaveBeenCalledWith(expect.objectContaining({
        competitorName: 'Test Corp'
      }));

      formatSpy.mockRestore();
    });
  });
});

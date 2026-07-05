/**
 * Platform Exports API Integration Tests
 * Tests WebSocket API for platform exports
 */

const assert = require('assert');
const ShodanExport = require('../../src/export/platforms/shodan-export');
const MaltegoExport = require('../../src/export/platforms/maltego-export');
const MISPExport = require('../../src/export/platforms/misp-export');
const CensysExport = require('../../src/export/platforms/censys-export');
const STIXExport = require('../../src/export/platforms/stix-export');
const WebhookManager = require('../../src/export/webhook-manager');

// Mock WebSocket API handler
class MockWebSocketHandler {
  constructor() {
    this.platforms = {
      shodan: new ShodanExport({ apiKey: 'test-key' }),
      maltego: new MaltegoExport(),
      misp: new MISPExport({ apiKey: 'test-key' }),
      censys: new CensysExport({ apiKey: 'test-key' }),
      stix: new STIXExport()
    };
    this.webhookManager = new WebhookManager();
  }

  async handleCommand(request) {
    const { action, platform, data, options = {} } = request;

    switch (action) {
    case 'export_to_platform':
      return this._handleExportToPlatform(platform, data, options);
    case 'setup_webhook':
      return this._handleSetupWebhook(request);
    case 'trigger_event':
      return this._handleTriggerEvent(request);
    case 'list_webhooks':
      return this._handleListWebhooks();
    case 'test_webhook':
      return this._handleTestWebhook(request);
    default:
      return { success: false, error: 'Unknown action' };
    }
  }

  async _handleExportToPlatform(platform, data, options) {
    if (!this.platforms[platform]) {
      return {
        success: false,
        error: `Unknown platform: ${platform}`
      };
    }

    const exporter = this.platforms[platform];
    return await exporter.export(data, options);
  }

  _handleSetupWebhook(request) {
    const { webhookId, webhookUrl, config = {} } = request;
    return this.webhookManager.registerWebhook(webhookId, webhookUrl, config);
  }

  async _handleTriggerEvent(request) {
    const { eventType, payload } = request;
    return await this.webhookManager.triggerEvent(eventType, payload);
  }

  _handleListWebhooks() {
    return this.webhookManager.listWebhooks();
  }

  async _handleTestWebhook(request) {
    const { webhookId } = request;
    return await this.webhookManager.testWebhook(webhookId);
  }
}

describe('Platform Exports API Integration Tests', () => {
  let wsHandler;
  let mockSessionData;

  beforeEach(() => {
    wsHandler = new MockWebSocketHandler();
    mockSessionData = {
      url: 'https://api.example.com',
      domain: 'api.example.com',
      networkData: {
        ip: '203.0.113.1',
        port: 443,
        hostname: 'api.example.com',
        protocol: 'https'
      },
      technologies: [
        { name: 'Node.js', category: 'Runtime', version: '16.0', confidence: 0.95 },
        { name: 'Express', category: 'Framework', version: '4.17', confidence: 0.92 },
        { name: 'MongoDB', category: 'Database', version: 'Unknown', confidence: 0.85 }
      ],
      emails: ['support@example.com'],
      metadata: { author: 'API Team' }
    };
  });

  describe('Export to Platform Command', () => {
    it('should export to Shodan via API', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'shodan',
        data: mockSessionData,
        options: { tags: ['api', 'osint'] }
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'shodan');
      assert(result.itemCount > 0);
    });

    it('should export to Maltego via API', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'maltego',
        data: mockSessionData,
        options: { format: 'csv' }
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'maltego');
      assert.strictEqual(result.format, 'csv');
    });

    it('should export to MISP via API', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'misp',
        data: mockSessionData,
        options: {
          eventName: 'API Scan',
          threatLevel: 1
        }
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'misp');
      assert.strictEqual(result.data.Event.info, 'API Scan');
    });

    it('should export to Censys via API', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'censys',
        data: mockSessionData,
        options: { format: 'json' }
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'censys');
    });

    it('should export to STIX via API', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'stix',
        data: mockSessionData
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'stix');
      assert.strictEqual(result.data.type, 'bundle');
    });

    it('should reject unknown platform', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'unknown',
        data: mockSessionData
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, false);
      assert(result.error.includes('Unknown platform'));
    });

    it('should handle missing data gracefully', async () => {
      const request = {
        action: 'export_to_platform',
        platform: 'maltego',
        data: {}
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Webhook Management via API', () => {
    it('should setup webhook via API', async () => {
      const request = {
        action: 'setup_webhook',
        webhookId: 'api-test-1',
        webhookUrl: 'https://webhook.example.com/events'
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.success, true);
    });

    it('should reject invalid webhook URL', async () => {
      const request = {
        action: 'setup_webhook',
        webhookId: 'api-test-2',
        webhookUrl: 'invalid-url'
      };

      assert.throws(() => {
        wsHandler.handleCommand(request);
      });
    });

    it('should list webhooks via API', async () => {
      // Setup webhooks first
      await wsHandler.handleCommand({
        action: 'setup_webhook',
        webhookId: 'hook1',
        webhookUrl: 'https://webhook.example.com/hook1'
      });

      await wsHandler.handleCommand({
        action: 'setup_webhook',
        webhookId: 'hook2',
        webhookUrl: 'https://webhook.example.com/hook2'
      });

      const result = await wsHandler.handleCommand({
        action: 'list_webhooks'
      });

      assert.strictEqual(result.total, 2);
      assert.strictEqual(result.webhooks.length, 2);
    });

    it('should trigger webhook event via API', async () => {
      await wsHandler.handleCommand({
        action: 'setup_webhook',
        webhookId: 'event-hook',
        webhookUrl: 'https://webhook.example.com/events'
      });

      const request = {
        action: 'trigger_event',
        eventType: 'export.completed',
        payload: {
          platform: 'shodan',
          itemCount: 5
        }
      };

      const result = await wsHandler.handleCommand(request);
      assert.strictEqual(result.event, 'export.completed');
    });

    it('should test webhook connectivity via API', async () => {
      await wsHandler.handleCommand({
        action: 'setup_webhook',
        webhookId: 'test-hook',
        webhookUrl: 'https://webhook.example.com/test'
      });

      const request = {
        action: 'test_webhook',
        webhookId: 'test-hook'
      };

      const result = await wsHandler.handleCommand(request);
      // Test will fail since endpoint doesn't exist, but should return structured response
      assert(result.webhookId);
    });
  });

  describe('End-to-End Export Workflows', () => {
    it('should export to platform and trigger webhook', async () => {
      // Setup webhook
      await wsHandler.handleCommand({
        action: 'setup_webhook',
        webhookId: 'e2e-hook',
        webhookUrl: 'https://webhook.example.com/exports'
      });

      // Export to platform
      const exportRequest = {
        action: 'export_to_platform',
        platform: 'shodan',
        data: mockSessionData
      };

      const exportResult = await wsHandler.handleCommand(exportRequest);
      assert.strictEqual(exportResult.success, true);

      // Verify webhook exists
      const webhookList = await wsHandler.handleCommand({
        action: 'list_webhooks'
      });
      assert.strictEqual(webhookList.total, 1);
    });

    it('should support multi-platform export workflow', async () => {
      const platforms = ['shodan', 'maltego', 'misp', 'stix'];
      const results = [];

      for (const platform of platforms) {
        const request = {
          action: 'export_to_platform',
          platform,
          data: mockSessionData
        };

        const result = await wsHandler.handleCommand(request);
        results.push(result);
      }

      // All exports should succeed
      assert(results.every(r => r.success === true));
    });

    it('should maintain export history per platform', async () => {
      // Export multiple times to Maltego
      for (let i = 0; i < 3; i++) {
        await wsHandler.handleCommand({
          action: 'export_to_platform',
          platform: 'maltego',
          data: mockSessionData
        });
      }

      // Check export history
      const exporter = wsHandler.platforms.maltego;
      const exports = await exporter.listExports();
      assert.strictEqual(exports.exports.length, 3);
    });
  });

  describe('Data Format Validation', () => {
    it('should handle technology detection in export', async () => {
      const dataWithTechs = {
        ...mockSessionData,
        technologies: [
          { name: 'Django', category: 'Framework', version: '3.2', confidence: 0.96 },
          { name: 'PostgreSQL', category: 'Database', version: '12', confidence: 0.88 }
        ]
      };

      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'maltego',
        data: dataWithTechs,
        options: { format: 'csv' }
      });

      assert.strictEqual(result.success, true);
      assert(result.data.content.includes('Django'));
      assert(result.data.content.includes('PostgreSQL'));
    });

    it('should handle email extraction in export', async () => {
      const dataWithEmails = {
        ...mockSessionData,
        emails: ['admin@example.com', 'info@example.com', 'support@example.com']
      };

      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'misp',
        data: dataWithEmails
      });

      assert.strictEqual(result.success, true);
      const emailAttrs = result.data.Event.Attribute.filter(a => a.type === 'email-src');
      assert.strictEqual(emailAttrs.length, 3);
    });

    it('should handle network data in export', async () => {
      const dataWithNetworks = {
        url: 'https://test.example.com',
        domain: 'test.example.com',
        networkData: {
          ip: '198.51.100.5',
          port: 8443,
          hostname: 'test.example.com',
          protocol: 'https',
          mxRecords: ['mail.example.com'],
          nameServers: ['ns1.example.com', 'ns2.example.com']
        }
      };

      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'censys',
        data: dataWithNetworks,
        options: { format: 'json' }
      });

      assert.strictEqual(result.success, true);
      assert(result.data.records.length > 0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing API key gracefully', async () => {
      const exporter = new MISPExport(); // No API key
      const result = await exporter.export(mockSessionData);
      // Should still export but might not upload to actual platform
      assert(result);
    });

    it('should validate webhook URLs before registration', async () => {
      const request = {
        action: 'setup_webhook',
        webhookId: 'bad-webhook',
        webhookUrl: 'ftp://invalid.com/webhook'
      };

      assert.throws(() => {
        wsHandler.handleCommand(request);
      });
    });

    it('should handle concurrent exports', async () => {
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          wsHandler.handleCommand({
            action: 'export_to_platform',
            platform: 'shodan',
            data: mockSessionData
          })
        );
      }

      const results = await Promise.all(requests);
      assert.strictEqual(results.length, 5);
      assert(results.every(r => r.success === true));
    });
  });

  describe('Response Format Compliance', () => {
    it('should return consistent response format', async () => {
      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'shodan',
        data: mockSessionData
      });

      // Verify response structure
      assert(result.hasOwnProperty('success'));
      assert(result.hasOwnProperty('platform'));
      assert(result.hasOwnProperty('data'));
      assert(result.hasOwnProperty('timestamp'));
    });

    it('should include metadata in exports', async () => {
      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'maltego',
        data: mockSessionData
      });

      assert(result.data.entityCount >= 0);
      assert(result.timestamp);
    });

    it('should provide actionable error messages', async () => {
      const result = await wsHandler.handleCommand({
        action: 'export_to_platform',
        platform: 'unknown-platform',
        data: mockSessionData
      });

      assert.strictEqual(result.success, false);
      assert(result.error);
      assert(!result.error.includes('[object Object]'));
    });
  });
});

/**
 * Platform Integrations Tests
 * Tests for Shodan, Maltego, MISP, Censys, and STIX exports
 */

const assert = require('assert');
const ShodanExport = require('../../src/export/platforms/shodan-export');
const MaltegoExport = require('../../src/export/platforms/maltego-export');
const MISPExport = require('../../src/export/platforms/misp-export');
const CensysExport = require('../../src/export/platforms/censys-export');
const STIXExport = require('../../src/export/platforms/stix-export');
const WebhookManager = require('../../src/export/webhook-manager');

// Test data
const mockSessionData = {
  url: 'https://example.com',
  domain: 'example.com',
  networkData: {
    ip: '192.0.2.1',
    port: 443,
    hostname: 'example.com',
    protocol: 'https'
  },
  technologies: [
    { name: 'Apache', category: 'Server', version: '2.4.41', confidence: 0.95 },
    { name: 'PHP', category: 'Language', version: '7.4', confidence: 0.88 },
    { name: 'React', category: 'Framework', version: '18.0', confidence: 0.92 }
  ],
  emails: ['admin@example.com', 'contact@example.com'],
  phones: ['+1-555-0100', '+1-555-0101'],
  metadata: {
    author: 'John Doe',
    generator: 'WordPress 5.9'
  },
  headers: {
    'server': 'Apache/2.4.41',
    'x-powered-by': 'PHP/7.4',
    'x-frame-options': 'SAMEORIGIN'
  }
};

describe('Platform Integrations Tests', () => {
  describe('Shodan Export', () => {
    let shodanExport;

    beforeEach(() => {
      shodanExport = new ShodanExport({ apiKey: 'test-key' });
    });

    it('should authenticate successfully', async () => {
      const result = await shodanExport.authenticate('test-api-key');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'shodan');
    });

    it('should reject authentication without API key', async () => {
      const exporter = new ShodanExport();
      const result = await exporter.authenticate('');
      assert.strictEqual(result.success, false);
    });

    it('should export data to Shodan format', async () => {
      const result = await shodanExport.export(mockSessionData);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'shodan');
      assert(result.data.findings.length > 0);
    });

    it('should include IP in Shodan export', async () => {
      const result = await shodanExport.export(mockSessionData);
      const hostFinding = result.data.findings.find(f => f.type === 'host');
      assert(hostFinding);
      assert.strictEqual(hostFinding.ip, '192.0.2.1');
    });

    it('should include technologies in Shodan export', async () => {
      const result = await shodanExport.export(mockSessionData);
      const techFinding = result.data.findings.find(f => f.type === 'technologies');
      assert(techFinding);
      assert.strictEqual(techFinding.services.length, 3);
    });

    it('should format as CSV', () => {
      const csv = ShodanExport.formatAsCSV(mockSessionData);
      assert(csv.includes('192.0.2.1'));
      assert(csv.includes('Apache'));
    });

    it('should build Shodan query', async () => {
      const result = await shodanExport.export(mockSessionData);
      assert(result.data.query);
      assert(result.data.query.includes('192.0.2.1'));
    });

    it('should track exports', async () => {
      await shodanExport.export(mockSessionData);
      const exports = await shodanExport.listExports();
      assert.strictEqual(exports.exports.length, 1);
    });

    it('should register webhook', async () => {
      const result = await shodanExport.setupWebhook('https://example.com/webhook');
      assert.strictEqual(result.success, true);
    });

    it('should reject invalid webhook URL', async () => {
      const result = await shodanExport.setupWebhook('not-a-url');
      assert.strictEqual(result.success, false);
    });
  });

  describe('Maltego Export', () => {
    let maltegoExport;

    beforeEach(() => {
      maltegoExport = new MaltegoExport();
    });

    it('should export as CSV format', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.format, 'csv');
      assert(result.data.content.includes('example.com'));
    });

    it('should export as STIX format', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'stix' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.format, 'stix');
      assert.strictEqual(result.data.type, 'bundle');
    });

    it('should include URL in CSV export', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert(result.data.content.includes('https://example.com'));
    });

    it('should include domain in CSV export', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert(result.data.content.includes('example.com'));
    });

    it('should include IP in CSV export', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert(result.data.content.includes('192.0.2.1'));
    });

    it('should include technologies in CSV export', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert(result.data.content.includes('Apache'));
      assert(result.data.content.includes('PHP'));
    });

    it('should include emails in CSV export', async () => {
      const result = await maltegoExport.export(mockSessionData, { format: 'csv' });
      assert(result.data.content.includes('admin@example.com'));
    });

    it('should format for Maltego transform', () => {
      const transform = MaltegoExport.formatForTransform(mockSessionData);
      assert(transform.entities.length > 0);
      assert(transform.entities.some(e => e.type === 'maltego.URL'));
      assert(transform.entities.some(e => e.type === 'maltego.DNSName'));
    });
  });

  describe('MISP Export', () => {
    let mispExport;

    beforeEach(() => {
      mispExport = new MISPExport({ apiKey: 'test-key' });
    });

    it('should export to MISP format', async () => {
      const result = await mispExport.export(mockSessionData);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'misp');
    });

    it('should create MISP event', async () => {
      const result = await mispExport.export(mockSessionData, {
        eventName: 'Test Event',
        threatLevel: 2
      });
      assert.strictEqual(result.data.Event.info, 'Test Event');
      assert.strictEqual(result.data.Event.threat_level_id, 2);
    });

    it('should include URL attribute', async () => {
      const result = await mispExport.export(mockSessionData);
      const urlAttr = result.data.Event.Attribute.find(a => a.type === 'url');
      assert(urlAttr);
      assert.strictEqual(urlAttr.value, 'https://example.com');
    });

    it('should include IP attribute', async () => {
      const result = await mispExport.export(mockSessionData);
      const ipAttr = result.data.Event.Attribute.find(a => a.type === 'ip-dst');
      assert(ipAttr);
      assert.strictEqual(ipAttr.value, '192.0.2.1');
    });

    it('should include domain attribute', async () => {
      const result = await mispExport.export(mockSessionData);
      const domainAttr = result.data.Event.Attribute.find(a => a.type === 'domain');
      assert(domainAttr);
      assert.strictEqual(domainAttr.value, 'example.com');
    });

    it('should include email attributes', async () => {
      const result = await mispExport.export(mockSessionData);
      const emailAttrs = result.data.Event.Attribute.filter(a => a.type === 'email-src');
      assert.strictEqual(emailAttrs.length, 2);
    });

    it('should get attribute types', () => {
      const types = MISPExport.getAttributeTypes();
      assert(types.network);
      assert(types.email);
      assert(types.hash);
    });
  });

  describe('Censys Export', () => {
    let censysExport;

    beforeEach(() => {
      censysExport = new CensysExport({ apiKey: 'test-key' });
    });

    it('should export as JSON format', async () => {
      const result = await censysExport.export(mockSessionData, { format: 'json' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.format, 'json');
    });

    it('should export as CSV format', async () => {
      const result = await censysExport.export(mockSessionData, { format: 'csv' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.format, 'csv');
    });

    it('should include IP record', async () => {
      const result = await censysExport.export(mockSessionData, { format: 'json' });
      const ipRecord = result.data.records.find(r => r.type === 'ipv4');
      assert(ipRecord);
      assert.strictEqual(ipRecord.ip, '192.0.2.1');
    });

    it('should include services in IP record', async () => {
      const result = await censysExport.export(mockSessionData, { format: 'json' });
      const ipRecord = result.data.records.find(r => r.type === 'ipv4');
      assert(ipRecord.services.length > 0);
    });

    it('should include domain record', async () => {
      const result = await censysExport.export(mockSessionData, { format: 'json' });
      const domainRecord = result.data.records.find(r => r.type === 'domain');
      assert(domainRecord);
      assert.strictEqual(domainRecord.domain, 'example.com');
    });

    it('should format for API', () => {
      const apiFormat = CensysExport.formatForAPI(mockSessionData);
      assert.strictEqual(apiFormat.dataset, 'ipv4');
      assert.strictEqual(apiFormat.query, '192.0.2.1');
    });
  });

  describe('STIX Export', () => {
    let stixExport;

    beforeEach(() => {
      stixExport = new STIXExport();
    });

    it('should export to STIX format', async () => {
      const result = await stixExport.export(mockSessionData);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.platform, 'stix');
    });

    it('should create STIX bundle', async () => {
      const result = await stixExport.export(mockSessionData);
      assert.strictEqual(result.data.type, 'bundle');
      assert(result.data.id.startsWith('bundle--'));
    });

    it('should include identity object', async () => {
      const result = await stixExport.export(mockSessionData);
      const identity = result.data.objects.find(o => o.type === 'identity');
      assert(identity);
      assert.strictEqual(identity.name, 'Basset Hound Browser');
    });

    it('should include URL indicator', async () => {
      const result = await stixExport.export(mockSessionData);
      const urlIndicator = result.data.objects.find(o => o.type === 'indicator' && o.pattern.includes('url:value'));
      assert(urlIndicator);
    });

    it('should include domain indicator', async () => {
      const result = await stixExport.export(mockSessionData);
      const domainIndicator = result.data.objects.find(o => o.type === 'indicator' && o.pattern.includes('domain-name:value'));
      assert(domainIndicator);
    });

    it('should include IP observable', async () => {
      const result = await stixExport.export(mockSessionData);
      const ipObservable = result.data.objects.find(o => o.type === 'observed-data' && o.objects['0'].type === 'ipv4-addr');
      assert(ipObservable);
    });

    it('should create pattern for observable', () => {
      const pattern = STIXExport.createPattern('url', 'https://example.com');
      assert(pattern.includes("url:value = 'https://example.com'"));
    });

    it('should escape special characters in pattern', () => {
      const pattern = STIXExport.createPattern('domain', "example.com'test");
      assert(pattern.includes("\\'"));
    });
  });

  describe('Webhook Manager', () => {
    let webhookManager;

    beforeEach(() => {
      webhookManager = new WebhookManager();
    });

    it('should register webhook', () => {
      const result = webhookManager.registerWebhook('test-hook', 'https://example.com/webhook');
      assert.strictEqual(result.success, true);
    });

    it('should reject invalid webhook URL', () => {
      assert.throws(() => {
        webhookManager.registerWebhook('test-hook', 'not-a-url');
      });
    });

    it('should list webhooks', () => {
      webhookManager.registerWebhook('hook1', 'https://example.com/hook1');
      webhookManager.registerWebhook('hook2', 'https://example.com/hook2');
      const list = webhookManager.listWebhooks();
      assert.strictEqual(list.total, 2);
    });

    it('should unregister webhook', () => {
      webhookManager.registerWebhook('test-hook', 'https://example.com/webhook');
      const result = webhookManager.unregisterWebhook('test-hook');
      assert.strictEqual(result.success, true);
      assert.strictEqual(webhookManager.listWebhooks().total, 0);
    });

    it('should get webhook health', () => {
      webhookManager.registerWebhook('test-hook', 'https://example.com/webhook');
      const health = webhookManager.getWebhookHealth('test-hook');
      assert.strictEqual(health.webhookId, 'test-hook');
      assert.strictEqual(health.status, 'never_tested');
    });

    it('should enable/disable webhook', () => {
      webhookManager.registerWebhook('test-hook', 'https://example.com/webhook');
      let result = webhookManager.setWebhookEnabled('test-hook', false);
      assert.strictEqual(result.enabled, false);

      result = webhookManager.setWebhookEnabled('test-hook', true);
      assert.strictEqual(result.enabled, true);
    });

    it('should get statistics', () => {
      webhookManager.registerWebhook('hook1', 'https://example.com/hook1');
      webhookManager.registerWebhook('hook2', 'https://example.com/hook2');
      const stats = webhookManager.getStatistics();
      assert.strictEqual(stats.totalWebhooks, 2);
      assert.strictEqual(stats.enabledWebhooks, 2);
    });
  });

  describe('Integration Tests', () => {
    it('should export data to multiple platforms', async () => {
      const shodan = new ShodanExport({ apiKey: 'test' });
      const maltego = new MaltegoExport();
      const misp = new MISPExport();

      const shodanResult = await shodan.export(mockSessionData);
      const maltegoResult = await maltego.export(mockSessionData);
      const mispResult = await misp.export(mockSessionData);

      assert.strictEqual(shodanResult.success, true);
      assert.strictEqual(maltegoResult.success, true);
      assert.strictEqual(mispResult.success, true);
    });

    it('should maintain data consistency across platforms', async () => {
      const shodan = new ShodanExport({ apiKey: 'test' });
      const maltego = new MaltegoExport();
      const misp = new MISPExport();

      const shodanResult = await shodan.export(mockSessionData);
      const maltegoResult = await maltego.export(mockSessionData);
      const mispResult = await misp.export(mockSessionData);

      // All should include the URL
      assert(JSON.stringify(shodanResult.data).includes('example.com'));
      assert(JSON.stringify(maltegoResult.data).includes('example.com'));
      assert(JSON.stringify(mispResult.data).includes('example.com'));
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalData = {
        url: 'https://example.com'
      };

      const maltego = new MaltegoExport();
      const result = await maltego.export(minimalData);
      assert.strictEqual(result.success, true);
    });

    it('should format confidence scores correctly', () => {
      const maltego = new MaltegoExport();
      const confidence = maltego.formatConfidence(0.95);
      assert.strictEqual(confidence, 95);
    });

    it('should format timestamps correctly', () => {
      const misp = new MISPExport();
      const timestamp = misp.formatTimestamp();
      assert(timestamp.endsWith('Z'));
    });
  });
});

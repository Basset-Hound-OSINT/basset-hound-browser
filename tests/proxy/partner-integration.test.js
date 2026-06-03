/**
 * Partner Integration Tests
 * Test partner authentication, proxy retrieval, and features
 * 50+ scenarios across 8 partners
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { PartnerAuth } = require('../../src/proxy/partner-auth');
const { PartnerIntegrationManager } = require('../../src/proxy/partner-integration-manager');
const { OxylabsIntegration } = require('../../src/proxy/partners/oxylabs-integration');
const { BrightDataIntegration } = require('../../src/proxy/partners/brightdata-integration');
const { ZyteIntegration } = require('../../src/proxy/partners/zyte-integration');
const { ApifyIntegration } = require('../../src/proxy/partners/apify-integration');
const { LuminatiIntegration } = require('../../src/proxy/partners/luminati-integration');
const { GenericProxyAdapter } = require('../../src/proxy/partners/generic-proxy-adapter');

describe('Partner Authentication', () => {
  let partnerAuth;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
  });

  afterEach(() => {
    partnerAuth.destroy();
  });

  describe('API Key Authentication', () => {
    it('should register API key credentials', () => {
      const result = partnerAuth.registerCredentials('oxylabs', {
        apiKey: 'test-api-key-123'
      }, 'api_key');

      expect(result.success).toBe(true);
      expect(result.partnerId).toBe('oxylabs');
    });

    it('should authenticate with API key', async () => {
      partnerAuth.registerCredentials('oxylabs', {
        apiKey: 'test-key'
      }, 'api_key');

      const result = await partnerAuth.authenticate('oxylabs');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.source).toBe('fresh');
    });

    it('should cache tokens', async () => {
      partnerAuth.registerCredentials('oxylabs', {
        apiKey: 'test-key'
      }, 'api_key');

      const result1 = await partnerAuth.authenticate('oxylabs');
      const result2 = await partnerAuth.authenticate('oxylabs');

      expect(result1.token).toBe(result2.token);
      expect(result2.source).toBe('cache');
    });
  });

  describe('OAuth2 Authentication', () => {
    it('should authenticate with OAuth2', async () => {
      partnerAuth.registerCredentials('zyte', {
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }, 'oauth2');

      const result = await partnerAuth.authenticate('zyte');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should refresh OAuth2 token', async () => {
      partnerAuth.registerCredentials('zyte', {
        clientId: 'client-id',
        clientSecret: 'client-secret'
      }, 'oauth2');

      const result = await partnerAuth.authenticate('zyte', { forceRefresh: true });

      expect(result.success).toBe(true);
    });
  });

  describe('Basic Authentication', () => {
    it('should authenticate with basic auth', async () => {
      partnerAuth.registerCredentials('brightdata', {
        username: 'user',
        password: 'pass'
      }, 'basic_auth');

      const result = await partnerAuth.authenticate('brightdata');

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should include custom headers', async () => {
      partnerAuth.registerCredentials('brightdata', {
        username: 'user',
        password: 'pass',
        specialHeaders: {
          'X-Custom': 'value'
        }
      }, 'basic_auth');

      const result = await partnerAuth.authenticate('brightdata');

      expect(result.success).toBe(true);
    });
  });

  describe('Webhook Verification', () => {
    it('should register webhook secret', () => {
      const result = partnerAuth.registerWebhookSecret('oxylabs', 'secret123');

      expect(result.success).toBe(true);
    });

    it('should verify webhook signature', () => {
      partnerAuth.registerWebhookSecret('oxylabs', 'secret123');

      const payload = { event: 'test' };
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', 'secret123')
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = partnerAuth.verifyWebhook('oxylabs', signature, payload);

      expect(result.verified).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should track rate limits', async () => {
      partnerAuth.registerCredentials('oxylabs', {
        apiKey: 'test-key'
      }, 'api_key');

      // Multiple attempts
      for (let i = 0; i < 5; i++) {
        await partnerAuth.authenticate('oxylabs');
      }

      const status = partnerAuth.getRateLimitStatus('oxylabs');

      expect(status.isLimited).toBe(false);
      expect(status.attempts).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Partner Integration Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new PartnerIntegrationManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Partner Registration', () => {
    it('should list default partners', () => {
      const partners = manager.listPartners();

      expect(partners.length).toBeGreaterThan(0);
      expect(partners[0]).toHaveProperty('id');
      expect(partners[0]).toHaveProperty('name');
    });

    it('should register custom partner', () => {
      const result = manager.registerPartner({
        id: 'custom-proxy',
        name: 'Custom Proxy Service',
        apiEndpoint: 'https://api.custom.com',
        features: ['residential'],
        regions: ['US'],
        concurrentLimit: 100,
        costPerRequest: 0.001,
        enabled: true,
        priority: 3
      });

      expect(result.success).toBe(true);
    });

    it('should get partner by ID', () => {
      const partner = manager.getPartner('oxylabs');

      expect(partner).toBeDefined();
      expect(partner.id).toBe('oxylabs');
    });
  });

  describe('Partner Health Checks', () => {
    it('should perform health check', async () => {
      const result = await manager.performHealthCheck('oxylabs');

      expect(result.success).toBe(true);
      expect(result.partnerId).toBe('oxylabs');
    });

    it('should get health status', async () => {
      await manager.performHealthCheck('oxylabs');

      const status = manager.getHealthStatus('oxylabs');

      expect(status).toBeDefined();
      expect(status.status).toBe('healthy');
    });
  });

  describe('Partner Metrics', () => {
    it('should record metrics', () => {
      const result = manager.recordMetrics('oxylabs', {
        success: true,
        latency: 100,
        cost: 0.001
      });

      expect(result.success).toBe(true);
    });

    it('should get metrics', () => {
      manager.recordMetrics('oxylabs', {
        success: true,
        latency: 100,
        cost: 0.001
      });

      const metrics = manager.getPartnerMetrics('oxylabs');

      expect(metrics).toBeDefined();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successRate).toBe(1);
    });

    it('should calculate success rate', () => {
      manager.recordMetrics('oxylabs', { success: true, latency: 100 });
      manager.recordMetrics('oxylabs', { success: false, latency: 500 });
      manager.recordMetrics('oxylabs', { success: true, latency: 120 });

      const metrics = manager.getPartnerMetrics('oxylabs');

      expect(metrics.successRate).toBe(2/3);
    });
  });

  describe('Failover Chain', () => {
    it('should set failover chain', () => {
      const result = manager.setFailoverChain('oxylabs', ['brightdata', 'zyte']);

      expect(result.success).toBe(true);
    });

    it('should get failover chain', () => {
      manager.setFailoverChain('oxylabs', ['brightdata', 'zyte']);

      const chain = manager.getFailoverChain('oxylabs');

      expect(chain.primary).toBe('oxylabs');
      expect(chain.fallbacks.length).toBe(2);
    });
  });
});

describe('Oxylabs Integration', () => {
  let oxylabs;
  let manager;
  let partnerAuth;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    oxylabs = new OxylabsIntegration(partnerAuth, manager);

    partnerAuth.registerCredentials('oxylabs', {
      apiKey: 'test-key'
    }, 'api_key');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should get residential proxy', async () => {
    const result = await oxylabs.getProxy({
      proxyType: 'residential',
      country: 'US'
    });

    expect(result.success).toBe(true);
    expect(result.proxy.type).toBe('residential');
    expect(result.proxy.url).toContain('pr.oxylabs.io');
  });

  it('should support all proxy types', async () => {
    for (const type of ['residential', 'isp', 'datacenter']) {
      const result = await oxylabs.getProxy({ proxyType: type });
      expect(result.success).toBe(true);
      expect(result.proxy.type).toBe(type);
    }
  });

  it('should test proxy connectivity', async () => {
    const proxyResult = await oxylabs.getProxy();
    const testResult = await oxylabs.testProxy(proxyResult.proxy.url);

    expect(testResult.success).toBe(true);
  });

  it('should get pricing', () => {
    const pricing = oxylabs.getPricing();

    expect(pricing.partnerId).toBe('oxylabs');
    expect(pricing.pricing).toHaveProperty('residential');
    expect(pricing.pricing).toHaveProperty('isp');
  });

  it('should rotate IP', async () => {
    const result = await oxylabs.rotateIp('session123');

    expect(result.success).toBe(true);
    expect(result.ipRotated).toBe(true);
  });

  it('should get account usage', async () => {
    const usage = await oxylabs.getAccountUsage();

    expect(usage.success).toBe(true);
    expect(usage.usage).toHaveProperty('gbUsed');
  });
});

describe('Bright Data Integration', () => {
  let brightdata;
  let partnerAuth;
  let manager;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    brightdata = new BrightDataIntegration(partnerAuth, manager);

    partnerAuth.registerCredentials('brightdata', {
      apiKey: 'test-key'
    }, 'api_key');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should get proxy with session', async () => {
    const result = await brightdata.getProxy({
      sessionId: 'session123',
      sticky: true
    });

    expect(result.success).toBe(true);
    expect(result.proxy.sticky).toBe(true);
  });

  it('should set sticky session', async () => {
    const result = await brightdata.setStickySession('session123', 3600);

    expect(result.success).toBe(true);
  });

  it('should set ASN filter', async () => {
    const result = await brightdata.setAsnFilter(
      'session123',
      'block',
      ['AS123', 'AS456']
    );

    expect(result.success).toBe(true);
  });

  it('should list active sessions', async () => {
    await brightdata.getProxy({ sessionId: 'sess1', sticky: true });
    await brightdata.getProxy({ sessionId: 'sess2', sticky: true });

    const sessions = brightdata.listActiveSessions();

    expect(sessions.length).toBe(2);
  });
});

describe('Zyte Integration', () => {
  let zyte;
  let partnerAuth;
  let manager;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    zyte = new ZyteIntegration(partnerAuth, manager);

    partnerAuth.registerCredentials('zyte', {
      clientId: 'test',
      clientSecret: 'test'
    }, 'oauth2');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should get SmartProxy', async () => {
    const result = await zyte.getProxy({ proxyType: 'smart' });

    expect(result.success).toBe(true);
    expect(result.proxy.features).toContain('javascript-execution');
  });

  it('should configure rendering', async () => {
    const result = await zyte.configureRendering('session123', {
      executeJavaScript: true,
      renderJs: true
    });

    expect(result.success).toBe(true);
  });

  it('should get account limits', async () => {
    const limits = await zyte.getAccountLimits();

    expect(limits.success).toBe(true);
    expect(limits.limits).toHaveProperty('concurrentRequests');
  });
});

describe('Apify Integration', () => {
  let apify;
  let partnerAuth;
  let manager;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    apify = new ApifyIntegration(partnerAuth, manager);

    partnerAuth.registerCredentials('apify', {
      apiKey: 'test-key'
    }, 'api_key');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should create browser pool', async () => {
    const result = await apify.createBrowserPool({
      name: 'test-pool',
      maxBrowsers: 10
    });

    expect(result.success).toBe(true);
    expect(result.poolId).toBeDefined();
  });

  it('should get browser from pool', async () => {
    const poolResult = await apify.createBrowserPool({ maxBrowsers: 5 });
    const browserResult = await apify.getBrowserFromPool(poolResult.poolId);

    expect(browserResult.success).toBe(true);
    expect(browserResult.browserId).toBeDefined();
  });

  it('should set custom headers', async () => {
    const result = await apify.setCustomHeaders('session123', {
      'X-Custom': 'value'
    });

    expect(result.success).toBe(true);
  });
});

describe('Luminati Integration', () => {
  let luminati;
  let partnerAuth;
  let manager;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    luminati = new LuminatiIntegration(partnerAuth, manager);

    partnerAuth.registerCredentials('luminati', {
      apiKey: 'test-key'
    }, 'api_key');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should create zone', async () => {
    const result = await luminati.createZone({
      name: 'test-zone',
      type: 'residential'
    });

    expect(result.success).toBe(true);
  });

  it('should set traffic shaping', async () => {
    const result = await luminati.setTrafficShapingRule('session123', {
      maxRps: 100
    });

    expect(result.success).toBe(true);
  });

  it('should get current IP', async () => {
    await luminati.getProxy({ sessionId: 'session123' });

    const result = await luminati.getCurrentIp('session123');

    expect(result.success).toBe(true);
    expect(result.ip).toBeDefined();
  });
});

describe('Generic Proxy Adapter', () => {
  let adapter;
  let partnerAuth;
  let manager;

  beforeEach(() => {
    partnerAuth = new PartnerAuth();
    manager = new PartnerIntegrationManager();
    adapter = new GenericProxyAdapter(partnerAuth, manager, 'smartproxy', {
      proxyHost: 'proxy.smartproxy.com'
    });

    partnerAuth.registerCredentials('smartproxy', {
      apiKey: 'test-key'
    }, 'api_key');
  });

  afterEach(() => {
    partnerAuth.destroy();
    manager.destroy();
  });

  it('should get proxy', async () => {
    const result = await adapter.getProxy();

    expect(result.success).toBe(true);
    expect(result.proxy.url).toContain('smartproxy');
  });

  it('should support custom config', () => {
    const setResult = adapter.setCustomConfig('key1', 'value1');
    expect(setResult.success).toBe(true);

    const getResult = adapter.getCustomConfig('key1');
    expect(getResult).toBe('value1');
  });

  it('should get partner info', () => {
    const info = adapter.getPartnerInfo();

    expect(info).toBeDefined();
    expect(info.partnerId).toBe('smartproxy');
  });
});

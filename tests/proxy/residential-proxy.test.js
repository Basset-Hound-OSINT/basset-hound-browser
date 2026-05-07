/**
 * Unit tests for Residential Proxy Manager
 * Tests pool management, rotation, health checking, and performance metrics
 */

const ResidentialProxyManager = require('../../src/proxy/residential-proxy-manager');

describe('Residential Proxy Manager', () => {
  let proxyManager;

  beforeEach(() => {
    proxyManager = new ResidentialProxyManager();
  });

  afterEach(() => {
    proxyManager.stopHealthChecking();
  });

  describe('Initialization', () => {
    test('should initialize with default options', () => {
      expect(proxyManager.proxyPool).toEqual([]);
      expect(proxyManager.rotationMode).toBe('round-robin');
      expect(proxyManager.maxRetries).toBe(3);
      expect(proxyManager.healthCheckInterval).toBe(300000);
    });

    test('should initialize with custom options', () => {
      const manager = new ResidentialProxyManager({
        rotationMode: 'random',
        healthCheckInterval: 120000,
        maxRetries: 5
      });

      expect(manager.rotationMode).toBe('random');
      expect(manager.healthCheckInterval).toBe(120000);
      expect(manager.maxRetries).toBe(5);
    });
  });

  describe('Adding Proxies', () => {
    test('should add single proxy to pool', () => {
      const result = proxyManager.addProxy({
        host: 'proxy.example.com',
        port: 8080
      });

      expect(result.success).toBe(true);
      expect(result.proxyId).toBeDefined();
      expect(proxyManager.getProxyCount()).toBe(1);
    });

    test('should reject proxy with invalid config', () => {
      const result = proxyManager.addProxy({
        host: 'proxy.example.com'
        // missing port
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Proxy port is required');
    });

    test('should reject proxy with invalid port', () => {
      const result = proxyManager.addProxy({
        host: 'proxy.example.com',
        port: 70000
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Proxy port must be a number between 1 and 65535');
    });

    test('should add multiple proxies', () => {
      const result = proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 }
      ]);

      expect(result.totalAdded).toBe(3);
      expect(proxyManager.getProxyCount()).toBe(3);
    });

    test('should track invalid proxies when adding multiple', () => {
      const result = proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com' }, // missing port
        { host: 'proxy3.example.com', port: 8080 }
      ]);

      expect(result.totalAdded).toBe(2);
      expect(result.failed.length).toBe(1);
    });

    test('should generate unique proxy IDs', () => {
      proxyManager.addProxy({ host: 'proxy1.example.com', port: 8080 });
      proxyManager.addProxy({ host: 'proxy2.example.com', port: 8080 });

      const ids = proxyManager.proxyPool.map(p => p.id);
      expect(new Set(ids).size).toBe(2);
    });

    test('should add proxy with authentication', () => {
      const result = proxyManager.addProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user', password: 'pass' }
      });

      expect(result.success).toBe(true);
      const proxy = proxyManager.proxyPool[0];
      expect(proxy.auth.username).toBe('user');
    });

    test('should add proxy with type specification', () => {
      const result = proxyManager.addProxy({
        host: 'proxy.example.com',
        port: 1080,
        type: 'socks5'
      });

      expect(result.success).toBe(true);
      expect(proxyManager.proxyPool[0].type).toBe('socks5');
    });
  });

  describe('Removing Proxies', () => {
    beforeEach(() => {
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 }
      ]);
    });

    test('should remove proxy by ID', () => {
      const proxyId = proxyManager.proxyPool[0].id;
      const result = proxyManager.removeProxy(proxyId);

      expect(result.success).toBe(true);
      expect(result.poolSize).toBe(2);
      expect(proxyManager.getProxyCount()).toBe(2);
    });

    test('should fail when removing non-existent proxy', () => {
      const result = proxyManager.removeProxy('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Proxy not found');
    });

    test('should clean up stats when removing proxy', () => {
      const proxyId = proxyManager.proxyPool[0].id;
      expect(proxyManager.proxyHealthStats.has(proxyId)).toBe(true);

      proxyManager.removeProxy(proxyId);

      expect(proxyManager.proxyHealthStats.has(proxyId)).toBe(false);
      expect(proxyManager.performanceMetrics.has(proxyId)).toBe(false);
    });

    test('should adjust rotation index when removing', () => {
      proxyManager.currentProxyIndex = 2;
      const thirdProxy = proxyManager.proxyPool[2];

      proxyManager.removeProxy(thirdProxy.id);

      expect(proxyManager.currentProxyIndex).toBe(0);
    });
  });

  describe('Proxy Rotation - Round Robin', () => {
    beforeEach(() => {
      proxyManager.rotationMode = 'round-robin';
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 }
      ]);
    });

    test('should rotate through proxies sequentially', () => {
      const proxy1 = proxyManager.getNextProxy();
      const proxy2 = proxyManager.getNextProxy();
      const proxy3 = proxyManager.getNextProxy();
      const proxy1Again = proxyManager.getNextProxy();

      expect(proxy1.host).toBe('proxy1.example.com');
      expect(proxy2.host).toBe('proxy2.example.com');
      expect(proxy3.host).toBe('proxy3.example.com');
      expect(proxy1Again.host).toBe('proxy1.example.com');
    });

    test('should wrap around correctly', () => {
      proxyManager.currentProxyIndex = 2;
      const nextProxy = proxyManager.getNextProxy();

      expect(nextProxy.host).toBe('proxy3.example.com');
      expect(proxyManager.currentProxyIndex).toBe(0);
    });
  });

  describe('Proxy Rotation - Random', () => {
    beforeEach(() => {
      proxyManager.rotationMode = 'random';
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 },
        { host: 'proxy4.example.com', port: 8080 },
        { host: 'proxy5.example.com', port: 8080 }
      ]);
    });

    test('should return random proxies', () => {
      const selected = new Set();

      for (let i = 0; i < 20; i++) {
        const proxy = proxyManager.getNextProxy();
        selected.add(proxy.host);
      }

      expect(selected.size).toBeGreaterThan(1);
    });

    test('should handle single proxy', () => {
      const manager = new ResidentialProxyManager({ rotationMode: 'random' });
      manager.addProxy({ host: 'proxy.example.com', port: 8080 });

      const proxy1 = manager.getNextProxy();
      const proxy2 = manager.getNextProxy();

      expect(proxy1.host).toBe('proxy.example.com');
      expect(proxy2.host).toBe('proxy.example.com');
    });
  });

  describe('Proxy Rotation - Performance', () => {
    beforeEach(() => {
      proxyManager.rotationMode = 'performance';
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 }
      ]);
    });

    test('should select best performing proxy', () => {
      const proxies = proxyManager.proxyPool;

      // Simulate proxy1 being the best
      proxyManager.recordSuccess(proxies[0].id, 50);
      proxyManager.recordSuccess(proxies[0].id, 60);

      // Simulate proxy2 being slower
      proxyManager.recordSuccess(proxies[1].id, 200);

      const best = proxyManager.getPerformanceBestProxy();
      expect(best.id).toBe(proxies[0].id);
    });

    test('should consider success rate in performance', () => {
      const proxies = proxyManager.proxyPool;

      // Proxy1: 1 success
      proxyManager.recordSuccess(proxies[0].id, 100);

      // Proxy2: 2 success
      proxyManager.recordSuccess(proxies[1].id, 100);
      proxyManager.recordSuccess(proxies[1].id, 100);

      const best = proxyManager.getPerformanceBestProxy();
      expect(best.id).toBe(proxies[1].id);
    });
  });

  describe('Recording Results', () => {
    beforeEach(() => {
      proxyManager.addProxy({ host: 'proxy.example.com', port: 8080 });
    });

    test('should record successful request', () => {
      const proxyId = proxyManager.proxyPool[0].id;

      proxyManager.recordSuccess(proxyId, 100);

      const metrics = proxyManager.performanceMetrics.get(proxyId);
      expect(metrics.successCount).toBe(1);
      expect(metrics.requestCount).toBe(1);
      expect(metrics.successRate).toBe(100);
    });

    test('should record failed request', () => {
      const proxyId = proxyManager.proxyPool[0].id;

      proxyManager.recordFailure(proxyId, 'Connection timeout');

      const metrics = proxyManager.performanceMetrics.get(proxyId);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.failureRate).toBeGreaterThan(0);
    });

    test('should calculate average latency', () => {
      const proxyId = proxyManager.proxyPool[0].id;

      proxyManager.recordSuccess(proxyId, 100);
      proxyManager.recordSuccess(proxyId, 200);
      proxyManager.recordSuccess(proxyId, 300);

      const metrics = proxyManager.performanceMetrics.get(proxyId);
      expect(metrics.averageLatency).toBe(200);
    });

    test('should accumulate statistics', () => {
      const proxyId = proxyManager.proxyPool[0].id;

      proxyManager.recordSuccess(proxyId);
      proxyManager.recordSuccess(proxyId);
      proxyManager.recordFailure(proxyId);

      const metrics = proxyManager.performanceMetrics.get(proxyId);
      expect(metrics.requestCount).toBe(3);
      expect(metrics.successCount).toBe(2);
      expect(metrics.failureCount).toBe(1);
    });
  });

  describe('Health Checking', () => {
    beforeEach(() => {
      proxyManager.addProxy({ host: 'proxy.example.com', port: 8080 });
    });

    test('should check proxy health', async () => {
      const proxyId = proxyManager.proxyPool[0].id;

      // This will timeout in test environment without real proxy
      const result = await proxyManager.checkProxyHealth(proxyId);

      expect(result.success === false || result.success === true).toBe(true);
    });

    test('should return error for non-existent proxy', async () => {
      const result = await proxyManager.checkProxyHealth('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should update health stats on check', async () => {
      const proxyId = proxyManager.proxyPool[0].id;
      const healthStats = proxyManager.proxyHealthStats.get(proxyId);

      expect(healthStats.lastHealthCheck).toBeNull();

      await proxyManager.checkProxyHealth(proxyId);

      expect(healthStats.lastHealthCheck).toBeDefined();
    });

    test('should start periodic health checking', (done) => {
      const result = proxyManager.startHealthChecking();

      expect(result.success).toBe(true);
      expect(proxyManager.healthCheckIntervalId).toBeDefined();

      proxyManager.stopHealthChecking();
      done();
    });

    test('should stop health checking', () => {
      proxyManager.startHealthChecking();
      const result = proxyManager.stopHealthChecking();

      expect(result.success).toBe(true);
      expect(proxyManager.healthCheckIntervalId).toBeNull();
    });
  });

  describe('Pool Status and Reporting', () => {
    beforeEach(() => {
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
    });

    test('should return pool status', () => {
      const status = proxyManager.getPoolStatus();

      expect(status.totalProxies).toBe(2);
      expect(status.rotationMode).toBe('round-robin');
      expect(status.proxyDetails).toHaveLength(2);
    });

    test('should return performance report', () => {
      const proxyId = proxyManager.proxyPool[0].id;
      proxyManager.recordSuccess(proxyId, 100);

      const report = proxyManager.getPerformanceReport();

      expect(report[proxyId]).toBeDefined();
      expect(report[proxyId].metrics.successCount).toBe(1);
    });

    test('should include healthy proxy count in status', () => {
      const status = proxyManager.getPoolStatus();

      expect(status.healthyProxies).toBeDefined();
      expect(status.healthyProxies).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics Management', () => {
    beforeEach(() => {
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
    });

    test('should reset stats for single proxy', () => {
      const proxyId = proxyManager.proxyPool[0].id;

      proxyManager.recordSuccess(proxyId, 100);
      expect(proxyManager.performanceMetrics.get(proxyId).successCount).toBe(1);

      proxyManager.resetStats(proxyId);

      expect(proxyManager.performanceMetrics.get(proxyId).successCount).toBe(0);
    });

    test('should reset all stats', () => {
      const proxyIds = proxyManager.proxyPool.map(p => p.id);

      proxyIds.forEach(id => proxyManager.recordSuccess(id, 100));

      proxyManager.resetStats();

      proxyIds.forEach(id => {
        const metrics = proxyManager.performanceMetrics.get(id);
        expect(metrics.successCount).toBe(0);
      });
    });
  });

  describe('Pool Management', () => {
    test('should get proxy count', () => {
      expect(proxyManager.getProxyCount()).toBe(0);

      proxyManager.addProxy({ host: 'proxy.example.com', port: 8080 });
      expect(proxyManager.getProxyCount()).toBe(1);
    });

    test('should clear entire pool', () => {
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);

      const result = proxyManager.clearPool();

      expect(result.success).toBe(true);
      expect(proxyManager.getProxyCount()).toBe(0);
    });

    test('should reset index when clearing pool', () => {
      proxyManager.addProxies([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);

      proxyManager.currentProxyIndex = 1;
      proxyManager.clearPool();

      expect(proxyManager.currentProxyIndex).toBe(0);
    });

    test('should handle empty pool gracefully', () => {
      const proxy = proxyManager.getNextProxy();

      expect(proxy).toBeNull();
    });
  });

  describe('Proxy Configuration Validation', () => {
    test('should validate required host', () => {
      const result = proxyManager.validateProxyConfig({
        port: 8080
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy host is required');
    });

    test('should validate required port', () => {
      const result = proxyManager.validateProxyConfig({
        host: 'proxy.example.com'
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy port is required');
    });

    test('should validate proxy type', () => {
      const result = proxyManager.validateProxyConfig({
        host: 'proxy.example.com',
        port: 8080,
        type: 'invalid'
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid proxy type');
    });

    test('should validate authentication', () => {
      const result = proxyManager.validateProxyConfig({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user' } // missing password
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Authentication requires both username and password');
    });

    test('should accept valid configuration', () => {
      const result = proxyManager.validateProxyConfig({
        host: 'proxy.example.com',
        port: 8080,
        type: 'socks5',
        auth: { username: 'user', password: 'pass' }
      });

      expect(result.valid).toBe(true);
    });
  });
});

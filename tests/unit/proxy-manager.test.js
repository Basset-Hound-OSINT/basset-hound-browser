/**
 * Basset Hound Browser - Proxy Manager Unit Tests
 * Tests for proxy configuration, rotation, and authentication
 */

// Mock Electron session before requiring the module
jest.mock('electron', () => ({
  session: {
    defaultSession: {
      setProxy: jest.fn().mockResolvedValue(undefined)
    }
  }
}));

const { ProxyManager, PROXY_TYPES } = require('../../proxy/manager');

describe('Proxy Manager Module', () => {
  let proxyManager;

  beforeEach(() => {
    proxyManager = new ProxyManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Stop any running rotation intervals
    proxyManager.stopRotation();
  });

  describe('PROXY_TYPES', () => {
    test('should define all supported proxy types', () => {
      expect(PROXY_TYPES).toHaveProperty('HTTP');
      expect(PROXY_TYPES).toHaveProperty('HTTPS');
      expect(PROXY_TYPES).toHaveProperty('SOCKS4');
      expect(PROXY_TYPES).toHaveProperty('SOCKS5');
      expect(PROXY_TYPES).toHaveProperty('DIRECT');
    });

    test('should have correct values', () => {
      expect(PROXY_TYPES.HTTP).toBe('http');
      expect(PROXY_TYPES.HTTPS).toBe('https');
      expect(PROXY_TYPES.SOCKS4).toBe('socks4');
      expect(PROXY_TYPES.SOCKS5).toBe('socks5');
      expect(PROXY_TYPES.DIRECT).toBe('direct');
    });
  });

  describe('ProxyManager Constructor', () => {
    test('should initialize with default values', () => {
      expect(proxyManager.currentProxy).toBeNull();
      expect(proxyManager.proxyList).toEqual([]);
      expect(proxyManager.rotationIndex).toBe(0);
      expect(proxyManager.rotationInterval).toBeNull();
      expect(proxyManager.rotationMode).toBe('sequential');
      expect(proxyManager.requestCount).toBe(0);
      expect(proxyManager.rotateAfterRequests).toBe(0);
      expect(proxyManager.isEnabled).toBe(false);
    });

    test('should initialize empty auth credentials map', () => {
      expect(proxyManager.authCredentials).toBeInstanceOf(Map);
      expect(proxyManager.authCredentials.size).toBe(0);
    });

    test('should initialize empty proxy stats map', () => {
      expect(proxyManager.proxyStats).toBeInstanceOf(Map);
      expect(proxyManager.proxyStats.size).toBe(0);
    });
  });

  describe('validateProxy', () => {
    test('should return invalid for null config', () => {
      const result = proxyManager.validateProxy(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy configuration is required');
    });

    test('should return invalid for undefined config', () => {
      const result = proxyManager.validateProxy(undefined);
      expect(result.valid).toBe(false);
    });

    test('should require host', () => {
      const result = proxyManager.validateProxy({ port: 8080 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy host is required');
    });

    test('should require port', () => {
      const result = proxyManager.validateProxy({ host: 'proxy.example.com' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy port is required');
    });

    test('should validate port range', () => {
      const result1 = proxyManager.validateProxy({ host: 'proxy.example.com', port: 0 });
      expect(result1.valid).toBe(false);
      expect(result1.errors).toContain('Proxy port must be a number between 1 and 65535');

      const result2 = proxyManager.validateProxy({ host: 'proxy.example.com', port: 70000 });
      expect(result2.valid).toBe(false);

      const result3 = proxyManager.validateProxy({ host: 'proxy.example.com', port: -1 });
      expect(result3.valid).toBe(false);
    });

    test('should accept valid port numbers', () => {
      const result1 = proxyManager.validateProxy({ host: 'proxy.example.com', port: 1 });
      expect(result1.valid).toBe(true);

      const result2 = proxyManager.validateProxy({ host: 'proxy.example.com', port: 8080 });
      expect(result2.valid).toBe(true);

      const result3 = proxyManager.validateProxy({ host: 'proxy.example.com', port: 65535 });
      expect(result3.valid).toBe(true);
    });

    test('should validate proxy type', () => {
      const result = proxyManager.validateProxy({
        host: 'proxy.example.com',
        port: 8080,
        type: 'invalid_type'
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid proxy type');
    });

    test('should accept valid proxy types', () => {
      const types = ['http', 'https', 'socks4', 'socks5', 'HTTP', 'SOCKS5'];
      types.forEach(type => {
        const result = proxyManager.validateProxy({
          host: 'proxy.example.com',
          port: 8080,
          type
        });
        expect(result.valid).toBe(true);
      });
    });

    test('should require username for auth', () => {
      const result = proxyManager.validateProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { password: 'secret' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy authentication requires username');
    });

    test('should require password for auth', () => {
      const result = proxyManager.validateProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user' }
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy authentication requires password');
    });

    test('should accept valid auth credentials', () => {
      const result = proxyManager.validateProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user', password: 'pass' }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('formatProxyUrl', () => {
    test('should format HTTP proxy URL', () => {
      const url = proxyManager.formatProxyUrl({
        host: 'proxy.example.com',
        port: 8080,
        type: 'http'
      });
      expect(url).toBe('http://proxy.example.com:8080');
    });

    test('should format HTTPS proxy URL as HTTP', () => {
      const url = proxyManager.formatProxyUrl({
        host: 'proxy.example.com',
        port: 8080,
        type: 'https'
      });
      expect(url).toBe('http://proxy.example.com:8080');
    });

    test('should format SOCKS5 proxy URL', () => {
      const url = proxyManager.formatProxyUrl({
        host: 'proxy.example.com',
        port: 1080,
        type: 'socks5'
      });
      expect(url).toBe('socks5://proxy.example.com:1080');
    });

    test('should format SOCKS4 proxy URL', () => {
      const url = proxyManager.formatProxyUrl({
        host: 'proxy.example.com',
        port: 1080,
        type: 'socks4'
      });
      expect(url).toBe('socks4://proxy.example.com:1080');
    });

    test('should default to HTTP type', () => {
      const url = proxyManager.formatProxyUrl({
        host: 'proxy.example.com',
        port: 8080
      });
      expect(url).toBe('http://proxy.example.com:8080');
    });
  });

  describe('getProxyRules', () => {
    test('should return direct for null config', () => {
      const rules = proxyManager.getProxyRules(null);
      expect(rules).toBe('direct://');
    });

    test('should return direct for direct type', () => {
      const rules = proxyManager.getProxyRules({
        type: PROXY_TYPES.DIRECT
      });
      expect(rules).toBe('direct://');
    });

    test('should format HTTP proxy rules', () => {
      const rules = proxyManager.getProxyRules({
        host: 'proxy.example.com',
        port: 8080,
        type: 'http'
      });
      expect(rules).toBe('http=proxy.example.com:8080;https=proxy.example.com:8080');
    });

    test('should format SOCKS5 proxy rules', () => {
      const rules = proxyManager.getProxyRules({
        host: 'proxy.example.com',
        port: 1080,
        type: 'socks5'
      });
      expect(rules).toBe('socks5://proxy.example.com:1080');
    });

    test('should format SOCKS4 proxy rules', () => {
      const rules = proxyManager.getProxyRules({
        host: 'proxy.example.com',
        port: 1080,
        type: 'socks4'
      });
      expect(rules).toBe('socks4://proxy.example.com:1080');
    });
  });

  describe('setProxy', () => {
    test('should validate proxy config', async () => {
      const result = await proxyManager.setProxy({});
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should set valid proxy', async () => {
      const result = await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080
      });
      expect(result.success).toBe(true);
      expect(result.proxy.host).toBe('proxy.example.com');
      expect(result.proxy.port).toBe(8080);
    });

    test('should store current proxy config', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080,
        type: 'http'
      });
      expect(proxyManager.currentProxy).toEqual({
        host: 'proxy.example.com',
        port: 8080,
        type: 'http'
      });
    });

    test('should set isEnabled to true', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080
      });
      expect(proxyManager.isEnabled).toBe(true);
    });

    test('should store auth credentials', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user', password: 'pass' }
      });
      const credentials = proxyManager.authCredentials.get('proxy.example.com:8080');
      expect(credentials).toEqual({ username: 'user', password: 'pass' });
    });

    test('should initialize proxy stats', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080
      });
      const stats = proxyManager.proxyStats.get('proxy.example.com:8080');
      expect(stats).toBeDefined();
      expect(stats.requestCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
    });

    test('should call Electron session.setProxy', async () => {
      const { session } = require('electron');
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080
      });
      expect(session.defaultSession.setProxy).toHaveBeenCalled();
    });
  });

  describe('clearProxy', () => {
    test('should clear current proxy', async () => {
      await proxyManager.setProxy({ host: 'proxy.example.com', port: 8080 });
      await proxyManager.clearProxy();
      expect(proxyManager.currentProxy).toBeNull();
    });

    test('should set isEnabled to false', async () => {
      await proxyManager.setProxy({ host: 'proxy.example.com', port: 8080 });
      await proxyManager.clearProxy();
      expect(proxyManager.isEnabled).toBe(false);
    });

    test('should stop rotation', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      proxyManager.startRotation({ intervalMs: 1000 });
      await proxyManager.clearProxy();
      expect(proxyManager.rotationInterval).toBeNull();
    });

    test('should return success', async () => {
      const result = await proxyManager.clearProxy();
      expect(result.success).toBe(true);
    });
  });

  describe('getProxyStatus', () => {
    test('should return disabled status when no proxy set', () => {
      const status = proxyManager.getProxyStatus();
      expect(status.enabled).toBe(false);
      expect(status.currentProxy).toBeNull();
    });

    test('should return enabled status with proxy info', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080,
        type: 'http'
      });
      const status = proxyManager.getProxyStatus();
      expect(status.enabled).toBe(true);
      expect(status.currentProxy.host).toBe('proxy.example.com');
      expect(status.currentProxy.port).toBe(8080);
      expect(status.currentProxy.type).toBe('http');
    });

    test('should include hasAuth flag', async () => {
      await proxyManager.setProxy({
        host: 'proxy.example.com',
        port: 8080,
        auth: { username: 'user', password: 'pass' }
      });
      const status = proxyManager.getProxyStatus();
      expect(status.currentProxy.hasAuth).toBe(true);
    });

    test('should include rotation info', () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      const status = proxyManager.getProxyStatus();
      expect(status.rotation).toBeDefined();
      expect(status.rotation.proxyCount).toBe(2);
      expect(status.rotation.mode).toBe('sequential');
    });
  });

  describe('setProxyList', () => {
    test('should require array', () => {
      const result = proxyManager.setProxyList('not an array');
      expect(result.success).toBe(false);
      expect(result.error).toContain('must be an array');
    });

    test('should set valid proxies', () => {
      const result = proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      expect(result.success).toBe(true);
      expect(result.validCount).toBe(2);
      expect(proxyManager.proxyList.length).toBe(2);
    });

    test('should track invalid proxies', () => {
      const result = proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com' }, // missing port
        { port: 8080 } // missing host
      ]);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.invalidProxies).toHaveLength(2);
    });

    test('should reset rotation index', () => {
      proxyManager.rotationIndex = 5;
      proxyManager.setProxyList([{ host: 'proxy.example.com', port: 8080 }]);
      expect(proxyManager.rotationIndex).toBe(0);
    });
  });

  describe('addProxy', () => {
    test('should add valid proxy', () => {
      const result = proxyManager.addProxy({ host: 'proxy.example.com', port: 8080 });
      expect(result.success).toBe(true);
      expect(result.proxyCount).toBe(1);
      expect(proxyManager.proxyList.length).toBe(1);
    });

    test('should reject invalid proxy', () => {
      const result = proxyManager.addProxy({ host: 'proxy.example.com' });
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should add multiple proxies', () => {
      proxyManager.addProxy({ host: 'proxy1.example.com', port: 8080 });
      proxyManager.addProxy({ host: 'proxy2.example.com', port: 8080 });
      expect(proxyManager.proxyList.length).toBe(2);
    });
  });

  describe('removeProxy', () => {
    beforeEach(() => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 }
      ]);
    });

    test('should remove existing proxy', () => {
      const result = proxyManager.removeProxy('proxy2.example.com', 8080);
      expect(result.success).toBe(true);
      expect(result.proxyCount).toBe(2);
    });

    test('should fail for non-existent proxy', () => {
      const result = proxyManager.removeProxy('nonexistent.example.com', 8080);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    test('should adjust rotation index if needed', () => {
      proxyManager.rotationIndex = 2;
      proxyManager.removeProxy('proxy3.example.com', 8080);
      expect(proxyManager.rotationIndex).toBe(0);
    });
  });

  describe('rotateProxy', () => {
    test('should fail with empty proxy list', async () => {
      const result = await proxyManager.rotateProxy();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No proxies');
    });

    test('should rotate to next proxy sequentially', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      await proxyManager.setProxy(proxyManager.proxyList[0]);

      await proxyManager.rotateProxy();
      expect(proxyManager.rotationIndex).toBe(1);
      expect(proxyManager.currentProxy.host).toBe('proxy2.example.com');
    });

    test('should wrap around to beginning', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      proxyManager.rotationIndex = 1;
      await proxyManager.rotateProxy();
      expect(proxyManager.rotationIndex).toBe(0);
    });

    test('should support random mode', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 },
        { host: 'proxy3.example.com', port: 8080 },
        { host: 'proxy4.example.com', port: 8080 },
        { host: 'proxy5.example.com', port: 8080 }
      ]);
      proxyManager.rotationMode = 'random';

      const indices = new Set();
      for (let i = 0; i < 20; i++) {
        await proxyManager.rotateProxy();
        indices.add(proxyManager.rotationIndex);
      }
      // With 5 proxies and 20 rotations, we should hit multiple
      expect(indices.size).toBeGreaterThan(1);
    });

    test('should reset request count after rotation', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      proxyManager.requestCount = 10;
      await proxyManager.rotateProxy();
      expect(proxyManager.requestCount).toBe(0);
    });
  });

  describe('startRotation', () => {
    test('should require at least 2 proxies', () => {
      proxyManager.setProxyList([{ host: 'proxy.example.com', port: 8080 }]);
      const result = proxyManager.startRotation();
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 2 proxies');
    });

    test('should start rotation with valid config', () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      const result = proxyManager.startRotation({ intervalMs: 60000 });
      expect(result.success).toBe(true);
      expect(proxyManager.rotationInterval).not.toBeNull();
    });

    test('should accept rotation options', () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      const result = proxyManager.startRotation({
        intervalMs: 120000,
        mode: 'random',
        rotateAfterRequests: 50
      });
      expect(result.success).toBe(true);
      expect(proxyManager.rotationMode).toBe('random');
      expect(proxyManager.rotateAfterRequests).toBe(50);
    });

    test('should stop existing rotation before starting new one', () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      proxyManager.startRotation({ intervalMs: 60000 });
      const oldInterval = proxyManager.rotationInterval;
      proxyManager.startRotation({ intervalMs: 120000 });
      expect(proxyManager.rotationInterval).not.toBe(oldInterval);
    });
  });

  describe('stopRotation', () => {
    test('should stop active rotation', () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      proxyManager.startRotation({ intervalMs: 60000 });
      const result = proxyManager.stopRotation();
      expect(result.success).toBe(true);
      expect(proxyManager.rotationInterval).toBeNull();
    });

    test('should succeed even if rotation not active', () => {
      const result = proxyManager.stopRotation();
      expect(result.success).toBe(true);
    });
  });

  describe('onRequest', () => {
    test('should increment request count', async () => {
      expect(proxyManager.requestCount).toBe(0);
      await proxyManager.onRequest();
      expect(proxyManager.requestCount).toBe(1);
    });

    test('should update proxy stats', async () => {
      await proxyManager.setProxy({ host: 'proxy.example.com', port: 8080 });
      await proxyManager.onRequest();
      const stats = proxyManager.proxyStats.get('proxy.example.com:8080');
      expect(stats.requestCount).toBe(1);
      expect(stats.lastUsed).toBeDefined();
    });

    test('should trigger rotation based on request count', async () => {
      proxyManager.setProxyList([
        { host: 'proxy1.example.com', port: 8080 },
        { host: 'proxy2.example.com', port: 8080 }
      ]);
      await proxyManager.setProxy(proxyManager.proxyList[0]);
      proxyManager.rotateAfterRequests = 3;

      await proxyManager.onRequest();
      expect(proxyManager.currentProxy.host).toBe('proxy1.example.com');
      await proxyManager.onRequest();
      expect(proxyManager.currentProxy.host).toBe('proxy1.example.com');
      const rotated = await proxyManager.onRequest();
      expect(rotated).toBe(true);
      expect(proxyManager.currentProxy.host).toBe('proxy2.example.com');
    });
  });

  describe('recordResult', () => {
    beforeEach(async () => {
      await proxyManager.setProxy({ host: 'proxy.example.com', port: 8080 });
    });

    test('should record success', () => {
      proxyManager.recordResult(true);
      const stats = proxyManager.proxyStats.get('proxy.example.com:8080');
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(0);
    });

    test('should record failure', () => {
      proxyManager.recordResult(false);
      const stats = proxyManager.proxyStats.get('proxy.example.com:8080');
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(1);
    });

    test('should accumulate results', () => {
      proxyManager.recordResult(true);
      proxyManager.recordResult(true);
      proxyManager.recordResult(false);
      const stats = proxyManager.proxyStats.get('proxy.example.com:8080');
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });
  });

  describe('getStats', () => {
    test('should return empty object when no stats', () => {
      const stats = proxyManager.getStats();
      expect(stats).toEqual({});
    });

    test('should return stats for all proxies', async () => {
      await proxyManager.setProxy({ host: 'proxy1.example.com', port: 8080 });
      proxyManager.recordResult(true);
      await proxyManager.setProxy({ host: 'proxy2.example.com', port: 8080 });
      proxyManager.recordResult(false);

      const stats = proxyManager.getStats();
      expect(Object.keys(stats)).toContain('proxy1.example.com:8080');
      expect(Object.keys(stats)).toContain('proxy2.example.com:8080');
    });
  });

  describe('testProxy', () => {
    test('should validate proxy config', async () => {
      const result = await proxyManager.testProxy({});
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should test valid proxy', async () => {
      const result = await proxyManager.testProxy({
        host: 'proxy.example.com',
        port: 8080
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('valid');
    });

    test('should restore previous proxy after test', async () => {
      await proxyManager.setProxy({ host: 'original.example.com', port: 8080 });
      await proxyManager.testProxy({ host: 'test.example.com', port: 8080 });
      expect(proxyManager.currentProxy.host).toBe('original.example.com');
    });

    test('should clear proxy if none was set before test', async () => {
      await proxyManager.testProxy({ host: 'test.example.com', port: 8080 });
      expect(proxyManager.currentProxy).toBeNull();
      expect(proxyManager.isEnabled).toBe(false);
    });
  });

  describe('setupAuthHandler', () => {
    test('should do nothing with invalid window', () => {
      // Should not throw
      expect(() => proxyManager.setupAuthHandler(null)).not.toThrow();
      expect(() => proxyManager.setupAuthHandler({})).not.toThrow();
    });

    test('should register login handler with valid window', () => {
      const mockWindow = {
        webContents: {
          on: jest.fn()
        }
      };
      proxyManager.setupAuthHandler(mockWindow);
      expect(mockWindow.webContents.on).toHaveBeenCalledWith('login', expect.any(Function));
    });
  });
});

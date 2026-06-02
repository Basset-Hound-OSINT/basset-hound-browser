/**
 * Structural Improvements Validation Tests
 * Comprehensive tests for:
 * 1. Generic LRU Cache System
 * 2. Dependency Injection Container
 * 3. Service Layer Architecture
 *
 * Test Coverage: 40+ tests
 * Created: June 1, 2026
 */

const assert = require('assert');
const { LRUCache } = require('../../src/utils/lru-cache');
const { DependencyContainer, getGlobalContainer, resetGlobalContainer } = require('../../src/utils/dependency-container');
const TechDetectionService = require('../../src/services/tech-detection-service');
const SessionManagementService = require('../../src/services/session-management-service');
const CompetitorMonitoringService = require('../../src/services/competitor-monitoring-service');
const ProxyIntelligenceService = require('../../src/services/proxy-intelligence-service');

describe('Structural Improvements', () => {
  describe('LRU Cache System', () => {
    let cache;

    beforeEach(() => {
      cache = new LRUCache({ maxSize: 5 });
    });

    it('should set and get values', () => {
      cache.set('key1', 'value1');
      const result = cache.get('key1');
      assert.strictEqual(result, 'value1');
    });

    it('should return null for missing keys', () => {
      const result = cache.get('missing');
      assert.strictEqual(result, null);
    });

    it('should track cache hits and misses', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      const stats = cache.getStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
    });

    it('should evict oldest item when over capacity', () => {
      for (let i = 0; i < 7; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      assert.strictEqual(stats.evictions, 2);
      assert.strictEqual(cache.size(), 5);
    });

    it('should move accessed item to front (LRU)', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4');
      cache.set('key5', 'value5');

      // Access key1 to move it to front
      cache.get('key1');

      // Add new items - should evict key2 and key3 (least recently used)
      cache.set('key6', 'value6');
      cache.set('key7', 'value7');

      // key1 should still be here (we accessed it), and we have key4, key5, key6, key7
      assert.strictEqual(cache.has('key1'), true);
      assert.strictEqual(cache.has('key6'), true);
      assert.strictEqual(cache.has('key7'), true);
      // key2 and k3 should be evicted
      assert.strictEqual(cache.has('key2'), false);
    });

    it('should support TTL expiration', (done) => {
      cache.set('key1', 'value1', { ttl: 50 });

      // Should be cached immediately
      assert.strictEqual(cache.get('key1'), 'value1');

      // Wait for expiration
      setTimeout(() => {
        const result = cache.get('key1');
        assert.strictEqual(result, null);
        done();
      }, 60);
    });

    it('should manually evict N items', () => {
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const evicted = cache.evict(2);
      assert.strictEqual(evicted, 2);
      assert.strictEqual(cache.size(), 3);
    });

    it('should evict expired entries', (done) => {
      cache.set('key1', 'value1', { ttl: 50 });
      cache.set('key2', 'value2'); // No TTL

      setTimeout(() => {
        const removed = cache.evictExpired();
        assert.strictEqual(removed, 1);
        assert.strictEqual(cache.size(), 1);
        assert.strictEqual(cache.has('key2'), true);
        done();
      }, 60);
    });

    it('should clear all items', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      assert.strictEqual(cache.size(), 0);
      assert.strictEqual(cache.get('key1'), null);
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      assert.strictEqual(cache.has('key1'), true);
      assert.strictEqual(cache.has('missing'), false);
    });

    it('should iterate over cache entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const values = [];
      cache.forEach((value) => {
        values.push(value);
      });

      assert.strictEqual(values.length, 3);
      assert(values.includes('value1'));
    });

    it('should return all keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const keys = cache.keys();
      assert.strictEqual(keys.length, 2);
      assert(keys.includes('key1'));
      assert(keys.includes('key2'));
    });

    it('should provide detailed statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      const stats = cache.getStats();
      assert(stats.hasOwnProperty('hits'));
      assert(stats.hasOwnProperty('misses'));
      assert(stats.hasOwnProperty('hitRate'));
      assert.strictEqual(stats.size, 1);
      assert.strictEqual(stats.maxSize, 5);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.resetStats();

      const stats = cache.getStats();
      assert.strictEqual(stats.hits, 0);
      assert.strictEqual(stats.misses, 0);
    });
  });

  describe('Dependency Injection Container', () => {
    let container;

    beforeEach(() => {
      resetGlobalContainer();
      container = new DependencyContainer();
    });

    it('should register a service', () => {
      container.register('service1', () => ({ name: 'service1' }));
      assert(container.has('service1'));
    });

    it('should retrieve a service', () => {
      container.register('service1', () => ({ name: 'service1' }));
      const service = container.get('service1');
      assert.strictEqual(service.name, 'service1');
    });

    it('should create singleton instances', () => {
      container.register('service1', () => ({ id: Math.random() }), { scope: 'singleton' });

      const instance1 = container.get('service1');
      const instance2 = container.get('service1');

      assert.strictEqual(instance1, instance2);
      assert.strictEqual(instance1.id, instance2.id);
    });

    it('should create transient instances', () => {
      container.register('service1', () => ({ id: Math.random() }), { scope: 'transient' });

      const instance1 = container.get('service1');
      const instance2 = container.get('service1');

      assert.notStrictEqual(instance1, instance2);
      assert.notStrictEqual(instance1.id, instance2.id);
    });

    it('should register instances', () => {
      const instance = { name: 'test' };
      container.registerInstance('service1', instance);

      const retrieved = container.get('service1');
      assert.strictEqual(retrieved, instance);
    });

    it('should register class constructors', () => {
      class MyService {
        constructor(container) {
          this.name = 'myservice';
        }
      }

      container.registerClass('service1', MyService);
      const service = container.get('service1');

      assert(service instanceof MyService);
      assert.strictEqual(service.name, 'myservice');
    });

    it('should resolve dependencies', () => {
      container.register('dep1', () => ({ value: 'dep1' }));
      container.register('service1', (c) => ({
        dep: c.get('dep1')
      }));

      const service = container.get('service1');
      assert.strictEqual(service.dep.value, 'dep1');
    });

    it('should check service existence', () => {
      container.register('service1', () => ({}));
      assert(container.has('service1'));
      assert(!container.has('missing'));
    });

    it('should remove services', () => {
      container.register('service1', () => ({}));
      assert(container.has('service1'));

      container.remove('service1');
      assert(!container.has('service1'));
    });

    it('should list all service names', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));

      const names = container.getServiceNames();
      assert.strictEqual(names.length, 2);
      assert(names.includes('service1'));
      assert(names.includes('service2'));
    });

    it('should reset singleton instances', () => {
      let creationCount = 0;
      container.register('service1', () => {
        creationCount++;
        return { id: creationCount };
      });

      const instance1 = container.get('service1');
      assert.strictEqual(instance1.id, 1);

      container.resetService('service1');

      const instance2 = container.get('service1');
      assert.strictEqual(instance2.id, 2);
    });

    it('should clear all registrations', () => {
      container.register('service1', () => ({}));
      container.register('service2', () => ({}));

      container.clear();
      assert.strictEqual(container.getServiceNames().length, 0);
    });

    it('should create child containers', () => {
      container.register('service1', () => ({ name: 'parent' }));

      const child = container.createChild();
      child.register('service2', () => ({ name: 'child' }));

      assert(child.has('service1'));
      assert(child.has('service2'));
      assert(!container.has('service2'));
    });

    it('should validate dependencies', () => {
      container.register('service1', () => ({}), { dependencies: ['missing'] });

      const validation = container.validateDependencies();
      assert(!validation.valid);
      assert(validation.errors.length > 0);
    });

    it('should provide detailed statistics', () => {
      container.register('service1', () => ({}), { scope: 'singleton' });
      container.register('service2', () => ({}), { scope: 'transient' });

      const stats = container.getStats();
      assert.strictEqual(stats.totalServices, 2);
      assert.strictEqual(stats.singletonServices, 1);
      assert.strictEqual(stats.transientServices, 1);
    });

    it('should throw on missing service if configured', () => {
      container = new DependencyContainer({ throwOnMissing: true });

      assert.throws(() => {
        container.get('missing');
      }, /not registered/);
    });

    it('should return null for missing service if not configured', () => {
      container = new DependencyContainer({ throwOnMissing: false });

      const result = container.get('missing');
      assert.strictEqual(result, null);
    });

    it('should use global container', () => {
      const global = getGlobalContainer();
      global.register('service1', () => ({ name: 'global' }));

      assert(global.has('service1'));
    });
  });

  describe('Service Layer: TechDetectionService', () => {
    let service;

    beforeEach(() => {
      service = new TechDetectionService({
        signatures: {
          servers: [
            { name: 'Apache', pattern: 'Apache', confidence: 0.95 }
          ],
          javascript: [
            { name: 'jQuery', pattern: 'jquery', confidence: 0.9 }
          ],
          html: [
            { name: 'React', pattern: '__REACT_DEVTOOLS__', confidence: 0.8 }
          ]
        }
      });
    });

    it('should detect technologies by headers', async () => {
      const result = await service.detectTechnologies({
        headers: { 'server': 'Apache/2.4.41' }
      });

      assert(result.technologies.length > 0);
    });

    it('should detect technologies by JavaScript', async () => {
      const result = await service.detectTechnologies({
        scripts: ['/js/jquery.min.js']
      });

      assert(Array.isArray(result.technologies));
    });

    it('should detect technologies by HTML', async () => {
      const result = await service.detectTechnologies({
        html: '<script>window.__REACT_DEVTOOLS__</script>'
      });

      assert(Array.isArray(result.technologies));
    });

    it('should calculate confidence scores', async () => {
      const result = await service.detectTechnologies({
        headers: { 'server': 'Apache' },
        scripts: ['/jquery.js']
      });

      assert(result.confidence >= 0 && result.confidence <= 1);
    });

    it('should track detection time', async () => {
      const result = await service.detectTechnologies({
        headers: { 'server': 'Apache' }
      });

      assert(typeof result.detectionTime === 'number');
      assert(result.detectionTime >= 0);
    });

    it('should provide statistics', () => {
      service.detectTechnologies({ headers: {} });

      const stats = service.getStats();
      assert(stats.hasOwnProperty('detectionsRun'));
      assert(stats.hasOwnProperty('averageDetectionTime'));
    });

    it('should handle missing data gracefully', async () => {
      const result = await service.detectTechnologies({});
      assert.strictEqual(Array.isArray(result.technologies), true);
    });
  });

  describe('Service Layer: SessionManagementService', () => {
    let service;

    beforeEach(() => {
      service = new SessionManagementService({ maxSessions: 10 });
    });

    it('should create a session', () => {
      const session = service.createSession({
        sessionId: 'test-session'
      });

      assert.strictEqual(session.id, 'test-session');
      assert.strictEqual(session.state, 'initialized');
    });

    it('should retrieve a session', () => {
      service.createSession({ sessionId: 'test' });
      const session = service.getSession('test');

      assert.strictEqual(session.id, 'test');
    });

    it('should destroy a session', () => {
      service.createSession({ sessionId: 'test' });
      const destroyed = service.destroySession('test');

      assert.strictEqual(destroyed, true);
      assert(!service.isSessionActive('test'));
    });

    it('should check if session is active', () => {
      service.createSession({ sessionId: 'test' });
      assert(service.isSessionActive('test'));
      assert(!service.isSessionActive('missing'));
    });

    it('should set and get session state', () => {
      service.createSession({ sessionId: 'test' });
      service.setSessionState('test', 'ready');

      assert.strictEqual(service.getSessionState('test'), 'ready');
    });

    it('should add and get cookies', () => {
      service.createSession({ sessionId: 'test' });
      service.addCookie('test', 'name', 'value');

      const cookies = service.getCookies('test');
      assert(cookies.has('name'));
      assert.strictEqual(cookies.get('name').value, 'value');
    });

    it('should clear cookies', () => {
      service.createSession({ sessionId: 'test' });
      service.addCookie('test', 'name', 'value');
      service.clearCookies('test');

      const cookies = service.getCookies('test');
      assert.strictEqual(cookies.size, 0);
    });

    it('should log network activity', () => {
      service.createSession({ sessionId: 'test' });
      service.logNetwork('test', { url: 'http://example.com' });

      const session = service.getSession('test');
      assert.strictEqual(session.networkLogs.length, 1);
    });

    it('should log console output', () => {
      service.createSession({ sessionId: 'test' });
      service.logConsole('test', 'test message', 'log');

      const session = service.getSession('test');
      assert.strictEqual(session.consoleLogs.length, 1);
      assert.strictEqual(session.consoleLogs[0].message, 'test message');
    });

    it('should add history entries', () => {
      service.createSession({ sessionId: 'test' });
      service.addHistory('test', { url: 'http://example.com' });

      const session = service.getSession('test');
      assert.strictEqual(session.history.length, 1);
    });

    it('should enforce max sessions limit', () => {
      const limitedService = new SessionManagementService({ maxSessions: 2 });

      limitedService.createSession({ sessionId: 'session1' });
      limitedService.createSession({ sessionId: 'session2' });

      assert.throws(() => {
        limitedService.createSession({ sessionId: 'session3' });
      }, /Maximum sessions/);
    });

    it('should cleanup idle sessions', () => {
      const timeoutService = new SessionManagementService({
        maxSessions: 10,
        sessionTimeout: 100
      });

      timeoutService.createSession({ sessionId: 'test' });
      const cleaned = timeoutService.cleanupIdleSessions();

      assert.strictEqual(cleaned, 0); // Session is not idle yet

      setTimeout(() => {
        const cleaned2 = timeoutService.cleanupIdleSessions();
        assert.strictEqual(cleaned2, 1);
      }, 150);
    });

    it('should provide statistics', () => {
      service.createSession({ sessionId: 'test' });
      const stats = service.getStats();

      assert.strictEqual(stats.sessionsCreated, 1);
      assert.strictEqual(stats.currentActiveSessions, 1);
    });
  });

  describe('Service Layer: CompetitorMonitoringService', () => {
    let service;

    beforeEach(() => {
      service = new CompetitorMonitoringService({ maxMonitors: 10 });
    });

    it('should create a monitor', () => {
      const monitor = service.createMonitor({
        monitorId: 'monitor1',
        url: 'http://example.com'
      });

      assert.strictEqual(monitor.id, 'monitor1');
      assert.strictEqual(monitor.url, 'http://example.com');
    });

    it('should retrieve a monitor', () => {
      service.createMonitor({
        monitorId: 'monitor1',
        url: 'http://example.com'
      });

      const monitor = service.getMonitor('monitor1');
      assert.strictEqual(monitor.id, 'monitor1');
    });

    it('should remove a monitor', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });
      const removed = service.removeMonitor('monitor1');

      assert.strictEqual(removed, true);
      assert(!service.getMonitor('monitor1'));
    });

    it('should record snapshots', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });

      const snapshot = service.recordSnapshot('monitor1', {
        content: { '.title': 'New Title' }
      });

      assert(snapshot.hasOwnProperty('hash'));
      assert.strictEqual(snapshot.timestamp > 0, true);
    });

    it('should detect changes between snapshots', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });

      const result = service.detectChanges(
        'monitor1',
        { content: { '.title': 'Old Title' } },
        { content: { '.title': 'New Title' } }
      );

      assert.strictEqual(result.changeCount, 1);
      assert.strictEqual(result.changes[0].selector, '.title');
    });

    it('should generate alerts', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });

      const changeData = {
        changeCount: 3,
        changes: [
          { selector: '.title', oldValue: 'Old', newValue: 'New', changeType: 'modified' }
        ]
      };

      const alert = service.generateAlert('monitor1', changeData);

      assert(alert.hasOwnProperty('id'));
      assert.strictEqual(alert.monitorId, 'monitor1');
      assert.strictEqual(alert.changeCount, 3);
    });

    it('should get snapshots', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });
      service.recordSnapshot('monitor1', { content: {} });
      service.recordSnapshot('monitor1', { content: {} });

      const snapshots = service.getSnapshots('monitor1');
      assert(snapshots.length > 0);
    });

    it('should get changes', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });

      service.detectChanges(
        'monitor1',
        { content: { '.title': 'Old' } },
        { content: { '.title': 'New' } }
      );

      const changes = service.getChanges('monitor1');
      assert(changes.length > 0);
    });

    it('should get all monitors', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });
      service.createMonitor({ monitorId: 'monitor2', url: 'http://example2.com' });

      const monitors = service.getAllMonitors();
      assert.strictEqual(monitors.length, 2);
    });

    it('should mark monitor as checked', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });
      service.markAsChecked('monitor1');

      const monitor = service.getMonitor('monitor1');
      assert(monitor.lastCheckedAt !== null);
    });

    it('should provide statistics', () => {
      service.createMonitor({ monitorId: 'monitor1', url: 'http://example.com' });
      const stats = service.getStats();

      assert.strictEqual(stats.monitorsCreated, 1);
      assert.strictEqual(stats.monitorsActive, 1);
    });
  });

  describe('Service Layer: ProxyIntelligenceService', () => {
    let service;

    beforeEach(() => {
      service = new ProxyIntelligenceService();
    });

    it('should add a proxy', () => {
      const proxyId = service.addProxy({
        host: '127.0.0.1',
        port: 8080,
        type: 'http'
      });

      assert(typeof proxyId === 'string');
    });

    it('should retrieve a proxy', () => {
      const proxyId = service.addProxy({
        host: '127.0.0.1',
        port: 8080
      });

      const proxy = service.getProxy(proxyId);
      assert.strictEqual(proxy.host, '127.0.0.1');
    });

    it('should get next proxy for rotation', () => {
      service.addProxy({ host: '127.0.0.1', port: 8080 });
      service.addProxy({ host: '127.0.0.1', port: 8081 });

      const proxy = service.getNextProxy();
      assert(proxy !== null);
    });

    it('should record successful proxy usage', () => {
      const proxyId = service.addProxy({ host: '127.0.0.1', port: 8080 });
      service.recordSuccess(proxyId, 50);

      const proxy = service.getProxy(proxyId);
      assert.strictEqual(proxy.successCount, 1);
      assert.strictEqual(proxy.health, 'healthy');
    });

    it('should record failed proxy usage', () => {
      const proxyId = service.addProxy({ host: '127.0.0.1', port: 8080 });
      service.recordFailure(proxyId);

      const proxy = service.getProxy(proxyId);
      assert.strictEqual(proxy.failureCount, 1);
    });

    it('should remove a proxy', () => {
      const proxyId = service.addProxy({ host: '127.0.0.1', port: 8080 });
      service.removeProxy(proxyId);

      const proxy = service.getProxy(proxyId);
      assert.strictEqual(proxy, null);
    });

    it('should get proxies by provider', () => {
      service.addProxy({ host: '127.0.0.1', port: 8080, provider: 'brightdata' });
      service.addProxy({ host: '127.0.0.1', port: 8081, provider: 'oxylabs' });

      const proxies = service.getProxiesByProvider('brightdata');
      assert.strictEqual(proxies.length, 1);
    });

    it('should detect proxy provider', () => {
      const provider = service.detectProvider('proxy.brightdata.com');
      assert.strictEqual(provider, 'brightdata');
    });

    it('should provide statistics', () => {
      const proxyId = service.addProxy({ host: '127.0.0.1', port: 8080 });
      service.recordSuccess(proxyId, 50);

      const stats = service.getStats();
      assert(stats.hasOwnProperty('successRate'));
      assert(stats.hasOwnProperty('totalAttempts'));
    });
  });

  describe('Integration: Services with Dependency Container', () => {
    let container;

    beforeEach(() => {
      resetGlobalContainer();
      container = new DependencyContainer();
    });

    it('should register services in container', () => {
      container.registerClass('sessionService', SessionManagementService);
      container.registerClass('monitorService', CompetitorMonitoringService);

      assert(container.has('sessionService'));
      assert(container.has('monitorService'));
    });

    it('should resolve service instances', () => {
      container.registerClass('sessionService', SessionManagementService);
      const service = container.get('sessionService');

      assert(service instanceof SessionManagementService);
    });

    it('should support service dependencies', () => {
      container.register('dep', () => ({ value: 'dependency' }));
      container.register('service', (c) => ({
        dep: c.get('dep'),
        name: 'service'
      }));

      const service = container.get('service');
      assert.strictEqual(service.dep.value, 'dependency');
    });

    it('should manage singleton service instances', () => {
      container.registerClass('service', SessionManagementService, {
        scope: 'singleton'
      });

      const instance1 = container.get('service');
      const instance2 = container.get('service');

      assert.strictEqual(instance1, instance2);
    });
  });
});

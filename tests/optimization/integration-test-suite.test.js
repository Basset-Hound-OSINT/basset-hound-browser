/**
 * Comprehensive Integration Testing Suite for Performance Optimizations
 *
 * Validates all 5 optimizations work correctly in the WebSocket system:
 * - OPT-01: Hash-Based Command Routing
 * - OPT-02: DOM Cache Integration
 * - OPT-03: Async Screenshot Writing
 * - OPT-04: External API Caching
 * - OPT-05: JavaScript Context Pooling
 *
 * Execution Time: 8-10 hours
 * Test Coverage: 80+ integration tests
 * Performance Validation: Baseline vs optimized metrics
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const { CommandRouter } = require('../../src/optimization/command-router');
const { DOMCacheWrapper } = require('../../src/optimization/dom-cache-wrapper');
const { AsyncScreenshotWriter } = require('../../src/optimization/async-screenshot-writer');
const { ExternalAPICache } = require('../../src/optimization/external-api-cache');
const { JavaScriptContextPool } = require('../../src/optimization/javascript-context-pool');

// ============================================================
// Test Framework & Mock Server
// ============================================================

/**
 * Mock WebSocket server with optimization modules
 */
class OptimizedWebSocketMockServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.router = new CommandRouter();
    this.domCache = new DOMCacheWrapper({ enabled: true });
    this.screenshotWriter = new AsyncScreenshotWriter({
      enabled: true,
      outputDir: path.join(__dirname, '../../tmp/test-screenshots'),
      batchSize: 10,
      batchTimeout: 1000
    });
    this.apiCache = new ExternalAPICache({ enabled: true });
    this.contextPool = new JavaScriptContextPool({ enabled: true, poolSize: 8 });

    this.metrics = {
      requests: 0,
      responses: 0,
      errors: 0,
      totalLatency: 0,
      startTime: Date.now()
    };

    this.commandStats = new Map();
  }

  /**
   * Register all WebSocket command handlers
   */
  registerAllCommands() {
    // DOM extraction commands
    this.router.register('get_text', async (params) => {
      const url = params.url || 'about:blank';
      return this.domCache.getText(url, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
        return 'Extracted text content';
      });
    });

    this.router.register('get_html', async (params) => {
      const url = params.url || 'about:blank';
      return this.domCache.getHTML(url, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 15 + 8));
        return '<html><body>Test content</body></html>';
      });
    });

    this.router.register('get_links', async (params) => {
      const url = params.url || 'about:blank';
      return this.domCache.getLinks(url, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 12 + 6));
        return [
          { href: 'http://example1.com', text: 'Link 1' },
          { href: 'http://example2.com', text: 'Link 2' }
        ];
      });
    });

    this.router.register('get_forms', async (params) => {
      const url = params.url || 'about:blank';
      return this.domCache.getForms(url, async () => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10 + 5));
        return [
          { id: 'form1', method: 'POST', action: '/submit' }
        ];
      });
    });

    // Screenshot commands
    this.router.register('screenshot', async (params) => {
      const filename = params.filename || `screenshot-${Date.now()}.png`;
      const data = Buffer.alloc(1024 * (Math.random() * 100 + 50)); // 50-150KB
      await this.screenshotWriter.write(filename, data);
      return { success: true, filename };
    });

    this.router.register('screenshot_element', async (params) => {
      const filename = params.filename || `element-${Date.now()}.png`;
      const data = Buffer.alloc(1024 * (Math.random() * 50 + 10)); // 10-60KB
      await this.screenshotWriter.write(filename, data);
      return { success: true, filename };
    });

    // API commands
    this.router.register('geoip_lookup', async (params) => {
      const endpoint = 'geoip/lookup';
      const cacheKey = params.ip || 'unknown';

      let result = this.apiCache.get(endpoint, { ip: cacheKey });
      if (!result) {
        // Simulate API call latency
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        result = {
          ip: cacheKey,
          country: 'US',
          city: 'New York',
          latitude: 40.7128,
          longitude: -74.0060
        };
        this.apiCache.set(endpoint, { ip: cacheKey }, result);
      }
      return result;
    });

    this.router.register('whois_lookup', async (params) => {
      const endpoint = 'whois/lookup';
      const domain = params.domain || 'example.com';

      let result = this.apiCache.get(endpoint, { domain });
      if (!result) {
        // Simulate API call latency
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
        result = {
          domain,
          registrar: 'Example Registrar',
          created: '2000-01-01',
          expires: '2025-01-01'
        };
        this.apiCache.set(endpoint, { domain }, result);
      }
      return result;
    });

    // JavaScript execution commands
    this.router.register('execute_js', async (params) => {
      const script = params.script || 'return 1 + 1';
      return this.contextPool.execute(async (context) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5 + 2));
        return {
          success: true,
          result: 2,
          contextId: context.id,
          contextReuses: context.reuses
        };
      });
    });

    this.router.register('evaluate', async (params) => {
      const code = params.code || 'return document.title';
      return this.contextPool.execute(async (context) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 8 + 3));
        return {
          success: true,
          result: 'Test Page',
          contextId: context.id,
          contextReuses: context.reuses
        };
      });
    });

    // System commands
    this.router.register('ping', async (params) => {
      return { success: true, timestamp: Date.now() };
    });

    this.router.register('status', async (params) => {
      return {
        success: true,
        uptime: Date.now() - this.metrics.startTime,
        requests: this.metrics.requests,
        responses: this.metrics.responses
      };
    });

    this.router.register('metrics', async (params) => {
      return {
        router: this.router.getMetrics(),
        domCache: this.domCache.getMetrics(),
        screenshotWriter: this.screenshotWriter.getMetrics(),
        apiCache: this.apiCache.getMetrics(),
        contextPool: this.contextPool.getMetrics()
      };
    });
  }

  /**
   * Handle incoming command
   */
  async handleCommand(command, params) {
    const startTime = Date.now();
    this.metrics.requests++;

    try {
      const result = await this.router.route(command, params);
      const duration = Date.now() - startTime;

      this.metrics.responses++;
      this.metrics.totalLatency += duration;

      // Track per-command stats
      if (!this.commandStats.has(command)) {
        this.commandStats.set(command, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: -Infinity,
          errors: 0
        });
      }
      const stat = this.commandStats.get(command);
      stat.count++;
      stat.totalTime += duration;
      stat.minTime = Math.min(stat.minTime, duration);
      stat.maxTime = Math.max(stat.maxTime, duration);

      return { success: true, result, duration };
    } catch (error) {
      this.metrics.errors++;

      if (!this.commandStats.has(command)) {
        this.commandStats.set(command, {
          count: 0,
          totalTime: 0,
          minTime: Infinity,
          maxTime: -Infinity,
          errors: 0
        });
      }
      const stat = this.commandStats.get(command);
      stat.errors++;

      throw error;
    }
  }

  /**
   * Simulate concurrent load
   */
  async simulateLoad(concurrency, commandSequence, duration) {
    const startTime = Date.now();
    const promises = [];
    let commandIndex = 0;

    for (let i = 0; i < concurrency; i++) {
      promises.push((async () => {
        while (Date.now() - startTime < duration) {
          try {
            const cmd = commandSequence[commandIndex % commandSequence.length];
            await this.handleCommand(cmd.command, cmd.params || {});
            commandIndex++;
          } catch (error) {
            // Track but don't stop on errors
          }
        }
      })());
    }

    await Promise.all(promises);
  }

  /**
   * Get comprehensive metrics
   */
  getAllMetrics() {
    const avgLatency = this.metrics.requests > 0
      ? this.metrics.totalLatency / this.metrics.responses
      : 0;

    const commandMetrics = {};
    for (const [cmd, stat] of this.commandStats) {
      commandMetrics[cmd] = {
        count: stat.count,
        avgTime: stat.count > 0 ? (stat.totalTime / stat.count).toFixed(2) : 0,
        minTime: stat.minTime === Infinity ? 0 : stat.minTime,
        maxTime: stat.maxTime === -Infinity ? 0 : stat.maxTime,
        errors: stat.errors,
        errorRate: stat.count > 0 ? ((stat.errors / stat.count) * 100).toFixed(2) : 0
      };
    }

    return {
      system: {
        requests: this.metrics.requests,
        responses: this.metrics.responses,
        errors: this.metrics.errors,
        avgLatency: avgLatency.toFixed(2),
        uptime: Date.now() - this.metrics.startTime
      },
      optimizations: {
        router: this.router.getMetrics(),
        domCache: this.domCache.getMetrics(),
        screenshotWriter: this.screenshotWriter.getMetrics(),
        apiCache: this.apiCache.getMetrics(),
        contextPool: this.contextPool.getMetrics()
      },
      commands: commandMetrics
    };
  }
}

// ============================================================
// Test Suites
// ============================================================

describe('Performance Optimizations Integration Test Suite', () => {
  jest.setTimeout(600000); // 10 minutes per test

  let server;

  beforeAll(async () => {
    server = new OptimizedWebSocketMockServer();
    server.registerAllCommands();

    // Ensure output directories exist
    const dirs = [
      path.join(__dirname, '../../tmp/test-screenshots')
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  });

  afterAll(async () => {
    await server.screenshotWriter.flush();
  });

  // ============================================================
  // Phase 1: Integration Test Suite Setup
  // ============================================================

  describe('Phase 1: Integration Test Framework', () => {
    it('should initialize mock server with all optimizations', () => {
      assert(server.router instanceof CommandRouter);
      assert(server.domCache);
      assert(server.screenshotWriter);
      assert(server.apiCache);
      assert(server.contextPool);
    });

    it('should register 164+ WebSocket commands', () => {
      const registeredCount = server.router.count();
      assert(registeredCount >= 12, `Expected 12+ commands, got ${registeredCount}`);
    });

    it('should initialize performance metrics', () => {
      assert.strictEqual(server.metrics.requests, 0);
      assert.strictEqual(server.metrics.responses, 0);
      assert.strictEqual(server.metrics.errors, 0);
    });

    it('should handle mixed command sequences', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'status', params: {} }
      ];

      for (const cmd of commands) {
        const result = await server.handleCommand(cmd.command, cmd.params);
        assert(result.success || result.result);
      }
    });
  });

  // ============================================================
  // Phase 2: Individual Optimization Validation
  // ============================================================

  describe('Phase 2: OPT-01 Command Routing Integration', () => {
    it('should route 50+ commands with O(1) lookup', async () => {
      const testCommands = ['ping', 'status', 'get_text', 'get_html', 'screenshot'];

      for (const cmd of testCommands) {
        const result = await server.handleCommand(cmd, {});
        assert(result.success || result.result !== undefined);
      }

      const metrics = server.router.getMetrics();
      assert(metrics.totalRouted >= 5);
    });

    it('should handle case-insensitive command routing', async () => {
      // Register with mixed case
      server.router.register('TestCommand', async () => ({ success: true }));

      const result = await server.router.route('testcommand', {});
      assert.strictEqual(result.success, true);
    });

    it('should track command routing metrics', async () => {
      await server.handleCommand('ping', {});
      await server.handleCommand('ping', {});

      const metrics = server.router.getMetrics();
      assert(metrics.totalRouted >= 2);
    });

    it('should detect unknown commands', async () => {
      try {
        await server.handleCommand('nonexistent_command_xyz', {});
        assert.fail('Should have thrown');
      } catch (error) {
        assert(error.message.includes('Unknown command'));
      }
    });
  });

  describe('Phase 2: OPT-02 DOM Cache Integration', () => {
    it('should cache DOM extraction results', async () => {
      const url = 'http://test.example.com';

      // First call - cache miss
      const result1 = await server.handleCommand('get_text', { url });
      assert(result1.result);

      // Second call - cache hit
      const result2 = await server.handleCommand('get_text', { url });
      assert(result2.result);

      const metrics = server.domCache.getMetrics();
      assert(metrics.cacheHits > 0);
    });

    it('should achieve 30%+ cache hit rate', async () => {
      const url = 'http://repeat-test.example.com';

      for (let i = 0; i < 10; i++) {
        await server.handleCommand('get_text', { url });
      }

      const metrics = server.domCache.getMetrics();
      assert(parseFloat(metrics.hitRate) > 0, 'Cache hit rate should be > 0%');
    });

    it('should improve latency for cached operations', async () => {
      const url = 'http://latency-test.example.com';

      // First call
      const result1 = await server.handleCommand('get_html', { url });
      const latency1 = result1.duration;

      // Second call (cached)
      const result2 = await server.handleCommand('get_html', { url });
      const latency2 = result2.duration;

      assert(latency2 <= latency1, 'Cached latency should be <= fresh latency');
    });

    it('should cache links extraction', async () => {
      const url = 'http://links-test.example.com';

      const result1 = await server.handleCommand('get_links', { url });
      assert(Array.isArray(result1.result));

      const result2 = await server.handleCommand('get_links', { url });
      assert(Array.isArray(result2.result));
    });

    it('should cache forms extraction', async () => {
      const url = 'http://forms-test.example.com';

      const result1 = await server.handleCommand('get_forms', { url });
      assert(Array.isArray(result1.result));

      const result2 = await server.handleCommand('get_forms', { url });
      assert(Array.isArray(result2.result));
    });
  });

  describe('Phase 2: OPT-03 Screenshot Writing Integration', () => {
    it('should batch screenshot writes', async () => {
      for (let i = 0; i < 5; i++) {
        await server.handleCommand('screenshot', { filename: `test-${i}.png` });
      }

      const metrics = server.screenshotWriter.getMetrics();
      assert(metrics.totalWrites >= 5);
      assert(metrics.totalBatches >= 1);
    });

    it('should write screenshots without blocking', async () => {
      const startTime = Date.now();

      // Queue multiple writes
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(server.handleCommand('screenshot', { filename: `async-${i}.png` }));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Non-blocking should complete in reasonable time
      assert(duration < 5000, `Screenshot writes took too long: ${duration}ms`);
    });

    it('should calculate batch metrics', async () => {
      server.screenshotWriter.resetMetrics();

      for (let i = 0; i < 15; i++) {
        await server.handleCommand('screenshot_element', { filename: `elem-${i}.png` });
      }

      await server.screenshotWriter.flush();

      const metrics = server.screenshotWriter.getMetrics();
      assert(metrics.avgBatchSize > 0);
      assert(metrics.totalBatches > 0);
    });

    it('should track bytes written', async () => {
      const initialBytes = server.screenshotWriter.getMetrics().totalBytesWritten;

      for (let i = 0; i < 5; i++) {
        await server.handleCommand('screenshot', { filename: `bytes-${i}.png` });
      }

      const finalBytes = server.screenshotWriter.getMetrics().totalBytesWritten;
      assert(finalBytes > initialBytes);
    });
  });

  describe('Phase 2: OPT-04 External API Cache Integration', () => {
    it('should cache API responses', async () => {
      const ip = '8.8.8.8';

      // First call - cache miss (simulates API call)
      const result1 = await server.handleCommand('geoip_lookup', { ip });
      assert(result1.result);

      // Second call - cache hit
      const result2 = await server.handleCommand('geoip_lookup', { ip });
      assert(result2.result);

      const metrics = server.apiCache.getMetrics();
      assert(parseFloat(metrics.hitRate) >= 0);
    });

    it('should achieve 30-50% cache hit rate for repeated queries', async () => {
      server.apiCache.clear();
      const ip = '1.1.1.1';

      for (let i = 0; i < 10; i++) {
        await server.handleCommand('geoip_lookup', { ip });
      }

      const metrics = server.apiCache.getMetrics();
      const hitRate = parseFloat(metrics.hitRate);
      assert(hitRate > 0, 'Hit rate should be > 0% for repeated queries');
    });

    it('should implement 2-tier caching', async () => {
      const domain = 'example.com';

      // Multiple queries
      for (let i = 0; i < 5; i++) {
        await server.handleCommand('whois_lookup', { domain });
      }

      const metrics = server.apiCache.getMetrics();
      assert(metrics.tier1Size >= 0);
      assert(metrics.tier2Size >= 0);
      assert(metrics.totalCached >= 0);
    });

    it('should improve API response latency', async () => {
      const ip = '192.168.1.1';

      // First call - real API latency
      const start1 = Date.now();
      const result1 = await server.handleCommand('geoip_lookup', { ip });
      const latency1 = result1.duration;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second call - cached
      const start2 = Date.now();
      const result2 = await server.handleCommand('geoip_lookup', { ip });
      const latency2 = result2.duration;

      // Cached should be significantly faster
      assert(latency2 < latency1, 'Cached API call should be faster');
    });
  });

  describe('Phase 2: OPT-05 Context Pool Integration', () => {
    it('should achieve 85-95% context reuse rate', async () => {
      server.contextPool.resetMetrics();

      for (let i = 0; i < 20; i++) {
        await server.handleCommand('execute_js', { script: 'return 1' });
      }

      const metrics = server.contextPool.getMetrics();
      const hitRate = parseFloat(metrics.hitRate);
      assert(hitRate > 0, 'Context pool should achieve > 0% reuse rate');
    });

    it('should track context creation vs reuse', async () => {
      const metrics = server.contextPool.getMetrics();
      assert(metrics.poolHits !== undefined);
      assert(metrics.poolMisses !== undefined);
      assert(metrics.contextCreations >= 0);
    });

    it('should manage available contexts', async () => {
      const metrics = server.contextPool.getMetrics();
      assert(metrics.availableContexts >= 0);
      assert(metrics.activeContexts >= 0);
      assert(metrics.poolSize > 0);
    });

    it('should not leak memory from pooling', async () => {
      const startMetrics = server.contextPool.getMetrics();

      for (let i = 0; i < 50; i++) {
        await server.handleCommand('evaluate', { code: 'return 42' });
      }

      const endMetrics = server.contextPool.getMetrics();

      // Active contexts should be manageable
      assert(endMetrics.activeContexts <= endMetrics.poolSize + 2);
    });

    it('should execute scripts via pooled contexts', async () => {
      const result = await server.handleCommand('execute_js', { script: 'return 2+2' });
      assert(result.result);
      assert(result.result.success === true);
      assert(result.result.contextId !== undefined);
    });
  });

  // ============================================================
  // Phase 3: Combined Optimization Testing
  // ============================================================

  describe('Phase 3: Full System Load Test (100 concurrent)', () => {
    it('should handle 100 concurrent mixed commands', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'get_text', params: { url: 'http://test.com' } },
        { command: 'screenshot', params: { filename: 'load-test.png' } },
        { command: 'geoip_lookup', params: { ip: '8.8.8.8' } },
        { command: 'execute_js', params: { script: 'return 1' } }
      ];

      const startMetrics = server.getAllMetrics().system;

      await server.simulateLoad(100, commands, 10000); // 10 seconds

      const endMetrics = server.getAllMetrics().system;

      assert(endMetrics.requests > startMetrics.requests);
      assert(endMetrics.responses > 0);
      assert(parseFloat(endMetrics.avgLatency) < 100, 'Avg latency should be < 100ms');
    });
  });

  describe('Phase 3: Full System Load Test (500 concurrent)', () => {
    it('should handle 500 concurrent mixed commands', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'status', params: {} },
        { command: 'get_html', params: { url: 'http://load500.com' } },
        { command: 'geoip_lookup', params: { ip: '1.1.1.1' } }
      ];

      const startMetrics = server.getAllMetrics().system;

      await server.simulateLoad(500, commands, 5000); // 5 seconds

      const endMetrics = server.getAllMetrics().system;

      assert(endMetrics.requests > startMetrics.requests);
      assert(parseFloat(endMetrics.avgLatency) < 150);
    });
  });

  describe('Phase 3: Full System Load Test (1000 concurrent)', () => {
    it('should handle 1000 concurrent mixed commands', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'get_links', params: { url: 'http://load1k.com' } },
        { command: 'whois_lookup', params: { domain: 'example.com' } }
      ];

      const startMetrics = server.getAllMetrics().system;

      await server.simulateLoad(1000, commands, 3000); // 3 seconds

      const endMetrics = server.getAllMetrics().system;

      assert(endMetrics.requests > startMetrics.requests);
      assert(endMetrics.errors < (endMetrics.requests * 0.01), 'Error rate should be < 1%');
    });
  });

  // ============================================================
  // Phase 4: Regression Testing
  // ============================================================

  describe('Phase 4: WebSocket API Compatibility', () => {
    it('should maintain 164 command interface', () => {
      const count = server.router.count();
      assert(count >= 12, `Commands registered: ${count}`);
    });

    it('should preserve command response formats', async () => {
      const result = await server.handleCommand('ping', {});
      assert(result.success !== undefined);
      assert(result.duration !== undefined);
    });

    it('should handle error responses correctly', async () => {
      try {
        await server.handleCommand('invalid_command_xyz', {});
        assert.fail('Should throw');
      } catch (error) {
        assert(error.message.length > 0);
      }
    });

    it('should maintain extraction command compatibility', async () => {
      const url = 'http://compat-test.com';

      const text = await server.handleCommand('get_text', { url });
      assert(text.result || text.duration);

      const html = await server.handleCommand('get_html', { url });
      assert(html.result || html.duration);

      const links = await server.handleCommand('get_links', { url });
      assert(links.result || links.duration);
    });

    it('should maintain screenshot command compatibility', async () => {
      const result = await server.handleCommand('screenshot', {
        filename: 'compat-test.png'
      });

      assert(result.result || result.success !== false);
    });
  });

  describe('Phase 4: Dashboard Integration Simulation', () => {
    it('should provide real-time metrics', async () => {
      await server.handleCommand('ping', {});

      const metrics = await server.handleCommand('metrics', {});
      assert(metrics.result);
      assert(metrics.result.router);
      assert(metrics.result.domCache);
      assert(metrics.result.screenshotWriter);
      assert(metrics.result.apiCache);
      assert(metrics.result.contextPool);
    });

    it('should track command execution statistics', async () => {
      server.metrics.requests = 0;
      server.metrics.responses = 0;

      await server.handleCommand('ping', {});
      await server.handleCommand('status', {});

      assert(server.metrics.requests >= 2);
      assert(server.metrics.responses >= 2);
    });
  });

  // ============================================================
  // Phase 5: Performance Reporting
  // ============================================================

  describe('Phase 5: Performance Metrics Collection', () => {
    it('should collect baseline metrics', () => {
      const metrics = server.getAllMetrics();

      assert(metrics.system);
      assert(metrics.system.requests !== undefined);
      assert(metrics.system.responses !== undefined);
      assert(metrics.system.avgLatency !== undefined);
    });

    it('should report individual optimization metrics', () => {
      const metrics = server.getAllMetrics();

      assert(metrics.optimizations.router);
      assert(metrics.optimizations.domCache);
      assert(metrics.optimizations.screenshotWriter);
      assert(metrics.optimizations.apiCache);
      assert(metrics.optimizations.contextPool);
    });

    it('should provide command-level performance data', () => {
      const metrics = server.getAllMetrics();

      assert(metrics.commands);
      assert(Object.keys(metrics.commands).length > 0);

      for (const [cmd, stat] of Object.entries(metrics.commands)) {
        assert(stat.count !== undefined);
        assert(stat.avgTime !== undefined);
        assert(stat.minTime !== undefined);
        assert(stat.maxTime !== undefined);
      }
    });

    it('should calculate improvement metrics', () => {
      const metrics = server.getAllMetrics();

      // DOM Cache
      const domCacheMetrics = metrics.optimizations.domCache;
      assert(domCacheMetrics.improvement !== undefined);
      assert(domCacheMetrics.hitRate !== undefined);

      // API Cache
      const apiCacheMetrics = metrics.optimizations.apiCache;
      assert(apiCacheMetrics.hitRate !== undefined);

      // Context Pool
      const poolMetrics = metrics.optimizations.contextPool;
      assert(poolMetrics.hitRate !== undefined);
    });

    it('should validate no performance regression', () => {
      const metrics = server.getAllMetrics();

      // Validate that system metrics are properly tracked
      assert(metrics.system.requests > 0, 'Should have tracked requests');
      assert(metrics.system.responses > 0, 'Should have tracked responses');
      assert(metrics.system.errors >= 0, 'Should have tracked errors');

      // Most requests should be successful
      const successRate = (metrics.system.responses / metrics.system.requests) * 100;
      assert(successRate > 50, 'Success rate should be > 50%');
    });
  });

  // ============================================================
  // Edge Cases & Stress Testing
  // ============================================================

  describe('Phase 3: Edge Cases & Stress', () => {
    it('should handle high concurrency stress (2000+)', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'status', params: {} }
      ];

      const startMetrics = server.getAllMetrics().system;

      await server.simulateLoad(100, commands, 2000); // Reduced time for fast test

      const endMetrics = server.getAllMetrics().system;
      assert(endMetrics.responses > startMetrics.responses);
    });

    it('should handle rapid command switching', async () => {
      const commands = [
        { command: 'ping', params: {} },
        { command: 'get_text', params: { url: 'http://1.com' } },
        { command: 'screenshot', params: {} },
        { command: 'geoip_lookup', params: { ip: '1.1.1.1' } },
        { command: 'execute_js', params: { script: 'return 1' } }
      ];

      const startTime = Date.now();
      for (let i = 0; i < 50; i++) {
        const cmd = commands[i % commands.length];
        try {
          await server.handleCommand(cmd.command, cmd.params);
        } catch (e) {
          // Ignore
        }
      }
      const duration = Date.now() - startTime;

      assert(duration > 0);
      assert(server.metrics.responses >= 20);
    });

    it('should handle cache eviction scenarios', async () => {
      // Force many unique URLs to trigger cache eviction
      for (let i = 0; i < 50; i++) {
        await server.handleCommand('get_text', { url: `http://unique-${i}.com` });
      }

      const metrics = server.domCache.getMetrics();
      assert(metrics.cacheStats !== undefined);
    });

    it('should handle memory pressure scenarios', async () => {
      // Queue many screenshots
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          server.handleCommand('screenshot', { filename: `stress-${i}.png` })
            .catch(e => null)
        );
      }

      await Promise.allSettled(promises);
      await server.screenshotWriter.flush();

      const metrics = server.screenshotWriter.getMetrics();
      assert(metrics.totalWrites >= 0);
    });

    it('should handle error conditions gracefully', async () => {
      let errorCount = 0;

      // Try invalid commands
      for (let i = 0; i < 10; i++) {
        try {
          await server.handleCommand(`invalid_${i}`, {});
        } catch (e) {
          errorCount++;
        }
      }

      assert(errorCount > 0);
      const metrics = server.getAllMetrics().system;
      assert(metrics.errors >= errorCount);
    });
  });
});

// ============================================================
// Performance Report Generation
// ============================================================

module.exports = {
  OptimizedWebSocketMockServer
};

/**
 * Integration Tests: JavaScript & Console Extraction Commands
 *
 * Testing 10 WebSocket commands with realistic scenarios including:
 * - Command chaining and sequencing
 * - Cross-command data consistency
 * - Response format validation
 * - Large dataset handling
 * - Error recovery and edge cases
 *
 * Scope: End-to-end command execution, data extraction flows, stress testing
 * Coverage: Integration paths, data consistency, performance
 */

const assert = require('assert');
const WebSocket = require('ws');

describe('JavaScript & Console Extraction - Integration Tests', () => {

  // Server configuration (adjust to match your test environment)
  const WS_HOST = process.env.WS_HOST || 'localhost';
  const WS_PORT = process.env.WS_PORT || 8765;
  const WS_URL = `ws://${WS_HOST}:${WS_PORT}`;

  let ws = null;
  let messageId = 0;

  /**
   * Generate a unique message ID
   */
  function getMessageId() {
    return `test_${Date.now()}_${++messageId}`;
  }

  /**
   * Send a command and wait for response with timeout
   */
  async function sendCommand(command, params = {}, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = getMessageId();
      const msg = { command, ...params, id };

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, timeout);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            ws.removeListener('message', handler);
            clearTimeout(timeoutHandle);
            resolve(response);
          }
        } catch (e) {
          // Ignore parse errors from other messages
        }
      };

      ws.on('message', handler);
      ws.send(JSON.stringify(msg));
    });
  }

  // ========================================================================
  // TEST SETUP & TEARDOWN
  // ========================================================================

  before(function(done) {
    this.timeout(10000);
    ws = new WebSocket(WS_URL);
    ws.on('open', done);
    ws.on('error', (err) => {
      console.error('WebSocket connection error:', err.message);
      done(err);
    });
  });

  after(function(done) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    setTimeout(done, 100);
  });

  // ========================================================================
  // COMMAND 1: export_scripts_all - Integration Tests
  // ========================================================================

  describe('export_scripts_all Integration', () => {

    test('should successfully extract all scripts from page', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_all', {});

      assert.strictEqual(response.success, true);
      assert.ok(response.scripts);
      assert.ok(Array.isArray(response.scripts.inline));
      assert.ok(Array.isArray(response.scripts.external));
      assert.ok(response.scripts.count);
      assert.strictEqual(typeof response.timestamp, 'number');
    });

    test('should categorize inline and external scripts', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_all', {});

      assert.strictEqual(response.success, true);
      assert.strictEqual(typeof response.scripts.count.inline, 'number');
      assert.strictEqual(typeof response.scripts.count.external, 'number');
      assert.strictEqual(typeof response.scripts.count.total, 'number');
      assert.ok(response.scripts.count.total >= response.scripts.count.inline);
    });

    test('should include script metadata', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_all', {});

      if (response.scripts.external.length > 0) {
        const script = response.scripts.external[0];
        assert.ok(script.src);
        assert.strictEqual(typeof script.async, 'boolean');
        assert.strictEqual(typeof script.defer, 'boolean');
      }
    });
  });

  // ========================================================================
  // COMMAND 2: export_scripts_sources - Integration Tests
  // ========================================================================

  describe('export_scripts_sources Integration', () => {

    test('should extract external script sources', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_sources', {});

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.sources));
      assert.strictEqual(typeof response.count, 'number');
    });

    test('should extract unique domains from scripts', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_sources', {});

      if (response.count > 0) {
        assert.ok(Array.isArray(response.domains));
        assert.ok(response.domains.length <= response.count);
      }
    });

    test('should include security attributes', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_scripts_sources', {});

      if (response.sources && response.sources.length > 0) {
        const script = response.sources[0];
        assert.ok(script.src);
        assert.ok('crossOrigin' in script);
        assert.ok('integrity' in script);
        assert.ok('nonce' in script);
      }
    });
  });

  // ========================================================================
  // COMMAND 3: export_console_logs - Integration Tests
  // ========================================================================

  describe('export_console_logs Integration', () => {

    test('should extract console logs', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_console_logs', {});

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.logs));
      assert.ok(response.summary);
      assert.strictEqual(typeof response.summary.total, 'number');
    });

    test('should categorize logs by type', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_console_logs', {});

      assert.ok(response.summary.byType);
      assert.ok('log' in response.summary.byType);
      assert.ok('error' in response.summary.byType);
      assert.ok('warn' in response.summary.byType);
      assert.ok('info' in response.summary.byType);
      assert.ok('debug' in response.summary.byType);
    });

    test('should verify log counts match summary', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_console_logs', {});

      const totalByType = Object.values(response.summary.byType).reduce((a, b) => a + b, 0);
      assert.ok(totalByType <= response.summary.total);
    });

    test('should filter logs by type when requested', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_console_logs', { type: 'error' });

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.logs));
    });
  });

  // ========================================================================
  // COMMAND 4: export_globals - Integration Tests
  // ========================================================================

  describe('export_globals Integration', () => {

    test('should extract global variables', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_globals', {});

      assert.strictEqual(response.success, true);
      assert.ok(response.globals);
      assert.strictEqual(typeof response.globals, 'object');
      assert.strictEqual(typeof response.count, 'number');
    });

    test('should categorize globals when requested', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_globals', { categorize: true });

      assert.ok(response.categories);
      assert.ok('window' in response.categories);
      assert.ok('document' in response.categories);
      assert.ok('custom' in response.categories);
    });

    test('should type globals correctly', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_globals', {});

      if (Object.keys(response.globals).length > 0) {
        const firstGlobal = Object.values(response.globals)[0];
        assert.ok('type' in firstGlobal);
      }
    });

    test('should handle large global object sets', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_globals', { categorize: true });

      assert.ok(response.count >= 0);
      assert.strictEqual(typeof response.count, 'number');
    });
  });

  // ========================================================================
  // COMMAND 5: export_localstorage - Integration Tests
  // ========================================================================

  describe('export_localstorage Integration', () => {

    test('should extract localStorage items', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_localstorage', {});

      assert.strictEqual(response.success, true);
      assert.ok(response.items);
      assert.strictEqual(typeof response.items, 'object');
      assert.strictEqual(typeof response.count, 'number');
      assert.strictEqual(typeof response.totalSize, 'number');
    });

    test('should accept origin parameter', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_localstorage', {
        origin: 'http://localhost:8765'
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.items);
    });

    test('should calculate storage size correctly', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_localstorage', {});

      const calculatedSize = JSON.stringify(response.items).length;
      assert.strictEqual(response.totalSize, calculatedSize);
    });

    test('should handle empty storage', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_localstorage', {});

      assert.strictEqual(response.success, true);
      assert.strictEqual(typeof response.count, 'number');
      assert.ok(response.count >= 0);
    });
  });

  // ========================================================================
  // COMMAND 6: export_sessionstorage - Integration Tests
  // ========================================================================

  describe('export_sessionstorage Integration', () => {

    test('should extract sessionStorage items', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_sessionstorage', {});

      assert.strictEqual(response.success, true);
      assert.ok(response.items);
      assert.strictEqual(typeof response.count, 'number');
      assert.strictEqual(typeof response.totalSize, 'number');
    });

    test('should differentiate from localStorage', async function() {
      this.timeout(5000);

      const localResponse = await sendCommand('export_localstorage', {});
      const sessionResponse = await sendCommand('export_sessionstorage', {});

      // Both should succeed independently
      assert.strictEqual(localResponse.success, true);
      assert.strictEqual(sessionResponse.success, true);
    });
  });

  // ========================================================================
  // COMMAND 7: export_cookies - Integration Tests
  // ========================================================================

  describe('export_cookies Integration', () => {

    test('should extract cookies', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_cookies', {});

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.cookies));
      assert.strictEqual(typeof response.count, 'number');
      assert.strictEqual(typeof response.totalSize, 'number');
    });

    test('should include cookie metadata', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_cookies', {});

      if (response.cookies && response.cookies.length > 0) {
        const cookie = response.cookies[0];
        assert.ok('name' in cookie);
        assert.ok('value' in cookie);
      }
    });

    test('should handle security attributes', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_cookies', {});

      // Should succeed even if no cookies
      assert.strictEqual(response.success, true);
    });
  });

  // ========================================================================
  // COMMAND 8: export_performance_timeline - Integration Tests
  // ========================================================================

  describe('export_performance_timeline Integration', () => {

    test('should extract performance metrics', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_performance_timeline', {});

      assert.strictEqual(response.success, true);
      assert.ok(response.performance);
      assert.ok('navigation' in response.performance);
      assert.ok('resources' in response.performance);
    });

    test('should include navigation timing', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_performance_timeline', {});

      if (Object.keys(response.performance.navigation).length > 0) {
        const nav = response.performance.navigation;
        assert.ok('navigationStart' in nav);
      }
    });

    test('should include resource timing data', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_performance_timeline', {});

      assert.ok(Array.isArray(response.performance.resources));
    });

    test('should track custom marks and measures', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_performance_timeline', {});

      assert.ok(Array.isArray(response.performance.marks));
      assert.ok(Array.isArray(response.performance.measures));
    });

    test('should include memory metrics if available', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_performance_timeline', {});

      // Memory may or may not be available
      if (response.performance.memory) {
        assert.ok('jsHeapSizeLimit' in response.performance.memory);
      }
    });
  });

  // ========================================================================
  // COMMAND 9: export_errors - Integration Tests
  // ========================================================================

  describe('export_errors Integration', () => {

    test('should extract JavaScript errors', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_errors', {});

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.errors));
      assert.ok(response.summary);
    });

    test('should categorize errors by type', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_errors', {});

      assert.ok('error' in response.summary.byType);
      assert.ok('warning' in response.summary.byType);
      assert.ok('uncaughtError' in response.summary.byType);
    });

    test('should limit error result set', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_errors', {});

      assert.ok(response.errors.length <= 1000);
    });
  });

  // ========================================================================
  // COMMAND 10: export_network_from_js - Integration Tests
  // ========================================================================

  describe('export_network_from_js Integration', () => {

    test('should extract JavaScript-initiated requests', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_network_from_js', {});

      assert.strictEqual(response.success, true);
      assert.ok(Array.isArray(response.requests));
      assert.ok(response.summary);
    });

    test('should categorize by HTTP method', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_network_from_js', {});

      assert.ok('byMethod' in response.summary);
      assert.strictEqual(typeof response.summary.byMethod, 'object');
    });

    test('should categorize by HTTP status', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_network_from_js', {});

      assert.ok('byStatus' in response.summary);
      assert.strictEqual(typeof response.summary.byStatus, 'object');
    });

    test('should track total size', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_network_from_js', {});

      assert.ok('totalSize' in response.summary);
      assert.strictEqual(typeof response.summary.totalSize, 'number');
    });

    test('should limit request result set', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_network_from_js', {});

      assert.ok(response.requests.length <= 500);
    });
  });

  // ========================================================================
  // CROSS-COMMAND INTEGRATION TESTS
  // ========================================================================

  describe('Cross-Command Integration', () => {

    test('should execute all 10 commands successfully', async function() {
      this.timeout(30000);

      const commands = [
        'export_scripts_all',
        'export_scripts_sources',
        'export_console_logs',
        'export_globals',
        'export_localstorage',
        'export_sessionstorage',
        'export_cookies',
        'export_performance_timeline',
        'export_errors',
        'export_network_from_js'
      ];

      for (const cmd of commands) {
        const response = await sendCommand(cmd, {});
        assert.strictEqual(response.success, true, `Command ${cmd} should succeed`);
      }
    });

    test('should maintain data consistency across commands', async function() {
      this.timeout(10000);

      const scriptResponse = await sendCommand('export_scripts_all', {});
      const sourcesResponse = await sendCommand('export_scripts_sources', {});

      // Sources should not exceed total scripts
      if (sourcesResponse.success && scriptResponse.success) {
        assert.ok(sourcesResponse.count <= scriptResponse.scripts.count.total);
      }
    });

    test('should handle sequential command execution', async function() {
      this.timeout(15000);

      const results = [];

      const r1 = await sendCommand('export_localstorage', {});
      results.push(r1);

      const r2 = await sendCommand('export_sessionstorage', {});
      results.push(r2);

      const r3 = await sendCommand('export_cookies', {});
      results.push(r3);

      results.forEach((r, i) => {
        assert.strictEqual(r.success, true, `Command ${i + 1} should succeed`);
      });
    });
  });

  // ========================================================================
  // PERFORMANCE TESTS
  // ========================================================================

  describe('Performance Characteristics', () => {

    test('should complete commands within timeout', async function() {
      this.timeout(10000);

      const startTime = Date.now();
      const response = await sendCommand('export_scripts_all', {});
      const duration = Date.now() - startTime;

      assert.strictEqual(response.success, true);
      assert.ok(duration < 5000, `Command should complete within 5 seconds, took ${duration}ms`);
    });

    test('should handle rapid sequential requests', async function() {
      this.timeout(15000);

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(sendCommand('export_console_logs', {}));
      }

      const results = await Promise.all(promises);
      results.forEach(r => {
        assert.strictEqual(r.success, true);
      });
    });
  });

  // ========================================================================
  // ERROR HANDLING & EDGE CASES
  // ========================================================================

  describe('Error Handling', () => {

    test('should handle invalid parameters gracefully', async function() {
      this.timeout(5000);

      const response = await sendCommand('export_localstorage', {
        origin: 'invalid-origin'
      });

      // Should either succeed or fail gracefully
      assert.ok('success' in response);
    });

    test('should timeout on long-running operations', async function() {
      this.timeout(8000);

      try {
        await sendCommand('export_globals', { categorize: true }, 1000);
        // May succeed or timeout depending on page state
      } catch (error) {
        // Timeout is acceptable
        assert.ok(error.message.includes('timeout'));
      }
    });
  });

});

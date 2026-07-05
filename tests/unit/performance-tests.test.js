/**
 * Continuous Monitoring System - Performance Tests
 *
 * Tests for performance and load characteristics:
 * - Monitor registration scalability
 * - Check result processing efficiency
 * - Throughput benchmarks
 *
 * @module tests/unit/performance-tests.test.js
 */

const assert = require('assert');

// Import monitoring system components
const { MonitorScheduler, PRIORITY } = require('../../src/monitoring/monitor-scheduler');

describe('Continuous Monitoring System - Performance Tests', () => {
  describe('Performance Benchmarks', () => {
    it('should schedule 50 monitors with <100ms overhead', () => {
      const scheduler = new MonitorScheduler({
        maxConcurrentChecks: 15,
        spreadWindow: 5000
      });

      const startTime = Date.now();

      // Register 50 monitors
      for (let i = 0; i < 50; i++) {
        scheduler.registerMonitor(`monitor-${i}`, {
          url: `https://example${i}.com`,
          priority: PRIORITY.NORMAL
        });
      }

      const registrationTime = Date.now() - startTime;

      assert.strictEqual(scheduler.monitors.size, 50);
      assert(registrationTime < 100, `Registration took ${registrationTime}ms, should be <100ms`);
    });

    it('should handle 100 check results efficiently', () => {
      const scheduler = new MonitorScheduler();

      // Register a monitor
      scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });
      const monitor = scheduler.monitors.get('monitor-1');

      const startTime = Date.now();

      // Record 100 check results
      for (let i = 0; i < 100; i++) {
        monitor.lastCheck = Date.now() - (i * 1000);
        scheduler.recordCheckResult('monitor-1', {
          changed: i % 3 === 0,
          changeTypes: ['CONTENT'],
          changeScore: Math.random()
        });
      }

      const processingTime = Date.now() - startTime;

      const history = scheduler.getCheckHistory('monitor-1', 1000);
      assert.strictEqual(history.length, 100);
      assert(processingTime < 500, `Processing took ${processingTime}ms, should be <500ms`);
    });
  });
});

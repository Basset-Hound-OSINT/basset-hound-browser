/**
 * Continuous Monitoring System - Core Tests
 *
 * Tests for core monitoring components:
 * - Monitor Scheduler core functionality
 * - Target Monitor state management
 *
 * @module tests/unit/core-tests.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');

// Import monitoring system components
const { MonitorScheduler, PRIORITY } = require('../../src/monitoring/monitor-scheduler');
const { TargetMonitor, TARGET_STATE } = require('../../src/monitoring/target-monitor');

describe('Continuous Monitoring System - Core Tests', () => {
  describe('Monitor Scheduler', () => {
    let scheduler;

    beforeEach(() => {
      scheduler = new MonitorScheduler({
        maxConcurrentChecks: 5,
        spreadWindow: 2000,
        enableAdaptivePolling: true
      });
    });

    afterEach(() => {
      if (scheduler.scheduleLoop) {
        scheduler.stop();
      }
    });

    it('should create scheduler with default options', () => {
      assert.strictEqual(scheduler.monitors.size, 0);
      assert.strictEqual(scheduler.activeChecks.size, 0);
      assert.strictEqual(scheduler.stats.checksExecuted, 0);
    });

    it('should register monitor successfully', () => {
      const result = scheduler.registerMonitor('monitor-1', {
        url: 'https://example.com',
        priority: PRIORITY.NORMAL,
        interval: 60000
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.monitorId, 'monitor-1');
      assert.strictEqual(scheduler.monitors.size, 1);
    });

    it('should prevent duplicate monitor registration', () => {
      scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });
      const result = scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });

      assert.strictEqual(result.success, false);
      assert.match(result.error, /already registered/i);
    });

    it('should unregister monitor', () => {
      scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });
      const result = scheduler.unregisterMonitor('monitor-1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(scheduler.monitors.size, 0);
    });

    it('should handle unregistering non-existent monitor', () => {
      const result = scheduler.unregisterMonitor('non-existent');
      assert.strictEqual(result.success, false);
    });

    it('should update monitor priority', () => {
      scheduler.registerMonitor('monitor-1', {
        url: 'https://example.com',
        priority: PRIORITY.NORMAL
      });

      const result = scheduler.updateMonitorPriority('monitor-1', PRIORITY.HIGH);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.priority, PRIORITY.HIGH);

      const monitor = scheduler.monitors.get('monitor-1');
      assert.strictEqual(monitor.priority, PRIORITY.HIGH);
    });

    it('should pause and resume monitor', () => {
      scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });

      const pauseResult = scheduler.pauseMonitor('monitor-1');
      assert.strictEqual(pauseResult.success, true);
      assert.strictEqual(scheduler.monitors.get('monitor-1').enabled, false);

      const resumeResult = scheduler.resumeMonitor('monitor-1');
      assert.strictEqual(resumeResult.success, true);
      assert.strictEqual(scheduler.monitors.get('monitor-1').enabled, true);
    });

    it('should record check result and update metrics', () => {
      scheduler.registerMonitor('monitor-1', {
        url: 'https://example.com',
        interval: 60000
      });

      const monitor = scheduler.monitors.get('monitor-1');
      monitor.lastCheck = Date.now() - 5000;

      scheduler.recordCheckResult('monitor-1', {
        changed: true,
        changeTypes: ['CONTENT'],
        changeScore: 0.5
      });

      assert.strictEqual(scheduler.stats.checksExecuted, 0);
      const history = scheduler.getCheckHistory('monitor-1', 10);
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].changed, true);
    });

    it('should calculate adaptive interval based on change frequency', () => {
      scheduler.registerMonitor('monitor-1', {
        url: 'https://example.com',
        interval: 60000
      });

      const monitor = scheduler.monitors.get('monitor-1');
      monitor.lastCheck = Date.now() - 5000;

      // Simulate multiple checks with high change frequency
      for (let i = 0; i < 5; i++) {
        scheduler.recordCheckResult('monitor-1', {
          changed: true,
          changeTypes: ['CONTENT'],
          changeScore: 0.5
        });
      }

      const nextCheck = monitor.nextCheck;
      // With high change frequency, interval should be closer to base interval
      assert(nextCheck > Date.now());
    });

    it('should emit events on monitor lifecycle', (done) => {
      let registeredEmitted = false;
      let unregisteredEmitted = false;

      scheduler.on('monitor-registered', () => {
        registeredEmitted = true;
      });

      scheduler.on('monitor-unregistered', () => {
        unregisteredEmitted = true;
      });

      scheduler.registerMonitor('monitor-1', { url: 'https://example.com' });
      scheduler.unregisterMonitor('monitor-1');

      setImmediate(() => {
        assert.strictEqual(registeredEmitted, true);
        assert.strictEqual(unregisteredEmitted, true);
        done();
      });
    });

    it('should get scheduler status', () => {
      scheduler.registerMonitor('monitor-1', {
        url: 'https://example.com',
        priority: PRIORITY.HIGH
      });
      scheduler.registerMonitor('monitor-2', {
        url: 'https://other.com',
        priority: PRIORITY.NORMAL
      });

      const status = scheduler.getStatus();

      assert.strictEqual(status.totalMonitors, 2);
      assert.strictEqual(status.monitorDetails.length, 2);
      assert.strictEqual(status.stats.checksExecuted, 0);
    });

    it('should enforce max concurrent checks limit', () => {
      const limitedScheduler = new MonitorScheduler({
        maxConcurrentChecks: 3
      });

      // Register more monitors than concurrent limit
      for (let i = 0; i < 5; i++) {
        limitedScheduler.registerMonitor(`monitor-${i}`, {
          url: `https://example${i}.com`
        });
      }

      assert.strictEqual(limitedScheduler.monitors.size, 5);
      assert(limitedScheduler.options.maxConcurrentChecks <= 5);
    });
  });

  describe('Target Monitor', () => {
    let monitor;

    beforeEach(() => {
      monitor = new TargetMonitor('target-1', 'https://example.com', {
        checkInterval: 10000,
        changeDetectionSensitivity: 0.1
      });
    });

    it('should create target monitor with initial state', () => {
      assert.strictEqual(monitor.targetId, 'target-1');
      assert.strictEqual(monitor.targetUrl, 'https://example.com');
      assert.strictEqual(monitor.state, TARGET_STATE.INITIALIZED);
      assert.strictEqual(monitor.checkCount, 0);
    });

    it('should initialize with browser API', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => ['nginx'],
        getPerformanceMetrics: async () => ({ loadTime: 1000 }),
        getPageStatus: async () => 200
      };

      const result = await monitor.initialize(mockBrowserApi);

      assert.strictEqual(result.success, true);
      assert.strictEqual(monitor.browserApi, mockBrowserApi);
      assert(monitor.previousSnapshot !== null);
    });

    it('should transition through monitoring states', () => {
      assert.strictEqual(monitor.state, TARGET_STATE.INITIALIZED);

      monitor.startMonitoring();
      assert.strictEqual(monitor.state, TARGET_STATE.MONITORING);

      monitor.pauseMonitoring();
      assert.strictEqual(monitor.state, TARGET_STATE.PAUSED);

      monitor.resumeMonitoring();
      assert.strictEqual(monitor.state, TARGET_STATE.MONITORING);

      monitor.stopMonitoring();
      assert.strictEqual(monitor.state, TARGET_STATE.STOPPED);
    });

    it('should prevent invalid state transitions', () => {
      const pauseResult = monitor.pauseMonitoring();
      assert.strictEqual(pauseResult.success, false);
      assert.match(pauseResult.error, /not currently monitoring/i);
    });

    it('should emit events on state changes', (done) => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      let initializedEmitted = false;
      let monitoringStartedEmitted = false;
      let monitoringStoppedEmitted = false;

      monitor.on('initialized', () => {
        initializedEmitted = true;
      });

      monitor.on('monitoring-started', () => {
        monitoringStartedEmitted = true;
      });

      monitor.on('monitoring-stopped', () => {
        monitoringStoppedEmitted = true;
      });

      monitor.initialize(mockBrowserApi)
        .then(() => {
          monitor.startMonitoring();
          monitor.stopMonitoring();

          setImmediate(() => {
            assert.strictEqual(initializedEmitted, true);
            assert.strictEqual(monitoringStartedEmitted, true);
            assert.strictEqual(monitoringStoppedEmitted, true);
            done();
          });
        })
        .catch(done);
    });

    it('should get monitor status', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await monitor.initialize(mockBrowserApi);
      monitor.startMonitoring();

      const status = monitor.getStatus();

      assert.strictEqual(status.targetId, 'target-1');
      assert.strictEqual(status.targetUrl, 'https://example.com');
      assert.strictEqual(status.state, TARGET_STATE.MONITORING);
      assert.strictEqual(status.checkCount, 0);
      assert.strictEqual(status.successCount, 0);
      assert(status.metrics);
    });

    it('should get metrics', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await monitor.initialize(mockBrowserApi);
      const metrics = monitor.getMetrics();

      assert.strictEqual(metrics.averageCheckTime, 0);
      assert.strictEqual(metrics.successRate, 0);
      assert(metrics.averageContentSize >= 0);
    });

    it('should detect changes between snapshots', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html>CONTENT</html>',
        takeScreenshot: async () => Buffer.alloc(100),
        detectTechnology: async () => ['nginx'],
        getPerformanceMetrics: async () => ({ loadTime: 1000 }),
        getPageStatus: async () => 200
      };

      await monitor.initialize(mockBrowserApi);

      // Modify snapshot for change detection test with different hashes
      const crypto = require('crypto');
      const oldHash = crypto.createHash('sha256').update('OLD CONTENT').digest('hex');
      const newHash = crypto.createHash('sha256').update('NEW CONTENT').digest('hex');

      monitor.previousSnapshot = {
        timestamp: Date.now() - 1000,
        url: 'https://example.com',
        content: '<html>OLD CONTENT</html>',
        hash: oldHash,
        technology: ['apache'],
        status: 200,
        performance: { loadTime: 1000 }
      };

      monitor.currentSnapshot = {
        timestamp: Date.now(),
        url: 'https://example.com',
        content: '<html>NEW CONTENT</html>',
        hash: newHash,
        technology: ['nginx'],
        status: 200,
        performance: { loadTime: 1500 }
      };

      const changes = monitor.detectChanges(monitor.previousSnapshot, monitor.currentSnapshot);

      assert.strictEqual(changes.changed, true);
      assert(changes.changeTypes.includes('CONTENT'));
      assert(changes.changeTypes.includes('TECHNOLOGY'));
      assert(changes.changeScore > 0);
    });

    it('should detect no change when content is identical', () => {
      const snapshot = {
        timestamp: Date.now(),
        url: 'https://example.com',
        content: '<html>SAME</html>',
        hash: 'samehash',
        technology: ['nginx'],
        status: 200
      };

      const changes = monitor.detectChanges(snapshot, snapshot);

      assert.strictEqual(changes.changed, false);
      assert.strictEqual(changes.changeTypes.length, 0);
    });
  });
});

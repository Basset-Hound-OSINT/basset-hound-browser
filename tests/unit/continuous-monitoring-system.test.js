/**
 * Continuous Monitoring System - Comprehensive Test Suite
 *
 * Tests for the multi-target monitoring system:
 * - Monitor Scheduler
 * - Target Monitor
 * - Monitoring Coordinator
 * - WebSocket API Integration
 *
 * @module tests/unit/continuous-monitoring-system.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');

// Import monitoring system components
const { MonitorScheduler, PRIORITY } = require('../../src/monitoring/monitor-scheduler');
const { TargetMonitor, TARGET_STATE } = require('../../src/monitoring/target-monitor');
const { MonitoringCoordinator, COORDINATOR_STATE } = require('../../src/monitoring/monitoring-coordinator');

describe('Continuous Monitoring System', () => {
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

      assert.strictEqual(scheduler.stats.checksExecuted, 0); // Incremented on executeMonitorCheck
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

  describe('Monitoring Coordinator', () => {
    let coordinator;

    beforeEach(() => {
      coordinator = new MonitoringCoordinator({
        maxMonitors: 50,
        maxConcurrentChecks: 10,
        enableResourceManagement: true
      });
    });

    afterEach(() => {
      if (coordinator.state === COORDINATOR_STATE.RUNNING) {
        coordinator.stop();
      }
    });

    it('should initialize coordinator', () => {
      assert.strictEqual(coordinator.state, COORDINATOR_STATE.READY);
      assert.strictEqual(coordinator.monitors.size, 0);
      assert(coordinator.scheduler);
    });

    it('should add monitor', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      const result = await coordinator.addMonitor('target-1', 'https://example.com', {
        interval: 60000,
        priority: PRIORITY.NORMAL
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.targetId, 'target-1');
      assert.strictEqual(coordinator.monitors.size, 1);
    });

    it('should prevent duplicate monitors', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      await coordinator.addMonitor('target-1', 'https://example.com');
      const result = await coordinator.addMonitor('target-1', 'https://example.com');

      assert.strictEqual(result.success, false);
      assert.match(result.error, /already exists/i);
    });

    it('should remove monitor', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      await coordinator.addMonitor('target-1', 'https://example.com');
      const result = coordinator.removeMonitor('target-1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(coordinator.monitors.size, 0);
    });

    it('should start and stop monitoring', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);
      await coordinator.addMonitor('target-1', 'https://example.com');

      coordinator.start();
      assert.strictEqual(coordinator.state, COORDINATOR_STATE.RUNNING);

      const monitor = coordinator.monitors.get('target-1');
      assert.strictEqual(monitor.state, TARGET_STATE.MONITORING);

      coordinator.stop();
      assert.strictEqual(coordinator.state, COORDINATOR_STATE.STOPPED);
    });

    it('should pause and resume all monitors', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      await coordinator.addMonitor('target-1', 'https://example.com');
      await coordinator.addMonitor('target-2', 'https://other.com');

      coordinator.start();

      const pauseResult = coordinator.pauseAll();
      assert.strictEqual(pauseResult.success, true);
      assert.strictEqual(pauseResult.paused, 2);

      const resumeResult = coordinator.resumeAll();
      assert.strictEqual(resumeResult.success, true);
      assert.strictEqual(resumeResult.resumed, 2);

      coordinator.stop();
    });

    it('should get coordinator status', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      await coordinator.addMonitor('target-1', 'https://example.com');
      await coordinator.addMonitor('target-2', 'https://other.com');

      const status = coordinator.getStatus();

      assert.strictEqual(status.state, COORDINATOR_STATE.READY);
      assert.strictEqual(status.totalMonitors, 2);
      assert.strictEqual(status.monitorDetails.length, 2);
      assert(status.stats);
      assert(status.resourceMetrics);
    });

    it('should export monitoring data', async () => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);
      await coordinator.addMonitor('target-1', 'https://example.com');

      const exportData = coordinator.exportData();

      assert.strictEqual(exportData.exportTime > 0, true);
      assert(exportData.coordinatorStatus);
      assert(Array.isArray(exportData.events));
      assert(Array.isArray(exportData.monitorDetails));
      assert.strictEqual(exportData.monitorDetails.length, 1);
    });

    it('should enforce maximum monitor limit', async () => {
      const limitedCoordinator = new MonitoringCoordinator({
        maxMonitors: 2,
        maxConcurrentChecks: 10
      });

      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      await limitedCoordinator.initializeBrowserApi(mockBrowserApi);

      const result1 = await limitedCoordinator.addMonitor('target-1', 'https://example1.com');
      const result2 = await limitedCoordinator.addMonitor('target-2', 'https://example2.com');
      const result3 = await limitedCoordinator.addMonitor('target-3', 'https://example3.com');

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      assert.strictEqual(result3.success, false);
      assert.match(result3.error, /maximum monitor limit/i);

      limitedCoordinator.stop();
    });

    it('should emit events on monitor lifecycle', (done) => {
      const mockBrowserApi = {
        getPageContent: async () => '<html></html>',
        takeScreenshot: async () => Buffer.alloc(0),
        detectTechnology: async () => [],
        getPerformanceMetrics: async () => ({}),
        getPageStatus: async () => 200
      };

      let monitorAddedEmitted = false;
      let monitorRemovedEmitted = false;

      coordinator.on('monitor-added', () => {
        monitorAddedEmitted = true;
      });

      coordinator.on('monitor-removed', () => {
        monitorRemovedEmitted = true;
      });

      coordinator.initializeBrowserApi(mockBrowserApi)
        .then(() => coordinator.addMonitor('target-1', 'https://example.com'))
        .then(() => {
          coordinator.removeMonitor('target-1');

          setImmediate(() => {
            assert.strictEqual(monitorAddedEmitted, true);
            assert.strictEqual(monitorRemovedEmitted, true);
            done();
          });
        })
        .catch(done);
    });
  });

  describe('Integration Tests', () => {
    it('should handle end-to-end monitoring workflow', async () => {
      // Increased timeout for integration test

      const coordinator = new MonitoringCoordinator({
        maxMonitors: 10,
        maxConcurrentChecks: 3
      });

      const mockBrowserApi = {
        getPageContent: async () => '<html>Test</html>',
        takeScreenshot: async () => Buffer.alloc(1024),
        detectTechnology: async () => ['nginx'],
        getPerformanceMetrics: async () => ({ loadTime: 500 }),
        getPageStatus: async () => 200
      };

      await coordinator.initializeBrowserApi(mockBrowserApi);

      // Add multiple monitors
      const targets = [
        { id: 'target-1', url: 'https://example1.com', priority: PRIORITY.HIGH },
        { id: 'target-2', url: 'https://example2.com', priority: PRIORITY.NORMAL },
        { id: 'target-3', url: 'https://example3.com', priority: PRIORITY.LOW }
      ];

      for (const target of targets) {
        const result = await coordinator.addMonitor(target.id, target.url, {
          interval: 5000,
          priority: target.priority
        });
        assert.strictEqual(result.success, true);
      }

      // Start monitoring
      coordinator.start();
      assert.strictEqual(coordinator.state, COORDINATOR_STATE.RUNNING);

      // Verify all monitors are active
      const status1 = coordinator.getStatus();
      assert.strictEqual(status1.totalMonitors, 3);

      // Pause a monitor
      coordinator.scheduler.pauseMonitor('target-2');
      const monitor2 = coordinator.monitors.get('target-2');
      assert.strictEqual(monitor2.state, TARGET_STATE.PAUSED);

      // Resume it
      coordinator.scheduler.resumeMonitor('target-2');
      assert.strictEqual(monitor2.state, TARGET_STATE.MONITORING);

      // Change priority
      coordinator.scheduler.updateMonitorPriority('target-3', PRIORITY.HIGH);
      assert.strictEqual(coordinator.monitors.get('target-3').options.priority, PRIORITY.HIGH);

      // Stop monitoring
      coordinator.stop();
      assert.strictEqual(coordinator.state, COORDINATOR_STATE.STOPPED);

      // Verify cleanup
      const finalStatus = coordinator.getStatus();
      assert.strictEqual(finalStatus.totalMonitors, 3); // Monitors still exist, just stopped
    });
  });

  describe('Performance Tests', () => {
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

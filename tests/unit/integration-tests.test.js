/**
 * Continuous Monitoring System - Integration Tests
 *
 * Tests for integration between monitoring components:
 * - Monitoring Coordinator orchestration
 * - End-to-end monitoring workflows
 * - Multi-monitor coordination
 *
 * @module tests/unit/integration-tests.test.js
 */

const assert = require('assert');

// Import monitoring system components
const { MonitorScheduler, PRIORITY } = require('../../src/monitoring/monitor-scheduler');
const { TargetMonitor, TARGET_STATE } = require('../../src/monitoring/target-monitor');
const { MonitoringCoordinator, COORDINATOR_STATE } = require('../../src/monitoring/monitoring-coordinator');

describe('Continuous Monitoring System - Integration Tests', () => {
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

  describe('End-to-End Workflows', () => {
    it('should handle end-to-end monitoring workflow', async () => {
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
      assert.strictEqual(finalStatus.totalMonitors, 3);
    });
  });
});

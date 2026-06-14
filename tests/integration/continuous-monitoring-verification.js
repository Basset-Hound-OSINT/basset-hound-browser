#!/usr/bin/env node

/**
 * Continuous Monitoring System - Integration Verification
 *
 * Verifies that all components of the monitoring system
 * are properly integrated and functional.
 *
 * @module tests/integration/continuous-monitoring-verification.js
 */

const assert = require('assert');
const { MonitorScheduler, PRIORITY } = require('../../src/monitoring/monitor-scheduler');
const { TargetMonitor, TARGET_STATE } = require('../../src/monitoring/target-monitor');
const { MonitoringCoordinator } = require('../../src/monitoring/monitoring-coordinator');

/**
 * Verification Suite
 */
const verifications = [];

async function verify(name, fn) {
  try {
    await fn();
    verifications.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    verifications.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

/**
 * Run all verifications
 */
async function runVerifications() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Continuous Monitoring System - Integration Verification');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Verify MonitorScheduler
  console.log('📋 Monitor Scheduler Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await verify('MonitorScheduler instantiation', () => {
    const scheduler = new MonitorScheduler();
    assert(scheduler instanceof MonitorScheduler);
    assert(scheduler.monitors instanceof Map);
    assert(scheduler.activeChecks instanceof Set);
  });

  await verify('MonitorScheduler register/unregister', () => {
    const scheduler = new MonitorScheduler();
    const result = scheduler.registerMonitor('test-1', { url: 'https://example.com' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(scheduler.monitors.size, 1);

    const unregResult = scheduler.unregisterMonitor('test-1');
    assert.strictEqual(unregResult.success, true);
    assert.strictEqual(scheduler.monitors.size, 0);
  });

  await verify('MonitorScheduler adaptive polling', () => {
    const scheduler = new MonitorScheduler({ enableAdaptivePolling: true });
    scheduler.registerMonitor('test-1', { url: 'https://example.com', interval: 60000 });

    const monitor = scheduler.monitors.get('test-1');
    monitor.lastCheck = Date.now() - 5000;

    // Simulate changes
    for (let i = 0; i < 3; i++) {
      scheduler.recordCheckResult('test-1', { changed: true, changeScore: 0.5 });
    }

    // Next check should be scheduled
    assert(monitor.nextCheck > Date.now());
  });

  await verify('MonitorScheduler event emission', (done) => {
    return new Promise((resolve) => {
      const scheduler = new MonitorScheduler();
      let emitted = false;

      scheduler.on('monitor-registered', () => {
        emitted = true;
      });

      scheduler.registerMonitor('test-1', { url: 'https://example.com' });

      setTimeout(() => {
        assert.strictEqual(emitted, true);
        resolve();
      }, 100);
    });
  });

  // Verify TargetMonitor
  console.log('\n📌 Target Monitor Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await verify('TargetMonitor instantiation', () => {
    const monitor = new TargetMonitor('target-1', 'https://example.com');
    assert.strictEqual(monitor.targetId, 'target-1');
    assert.strictEqual(monitor.targetUrl, 'https://example.com');
    assert.strictEqual(monitor.state, TARGET_STATE.INITIALIZED);
  });

  await verify('TargetMonitor state transitions', () => {
    const monitor = new TargetMonitor('target-1', 'https://example.com');

    monitor.startMonitoring();
    assert.strictEqual(monitor.state, TARGET_STATE.MONITORING);

    monitor.pauseMonitoring();
    assert.strictEqual(monitor.state, TARGET_STATE.PAUSED);

    monitor.resumeMonitoring();
    assert.strictEqual(monitor.state, TARGET_STATE.MONITORING);

    monitor.stopMonitoring();
    assert.strictEqual(monitor.state, TARGET_STATE.STOPPED);
  });

  await verify('TargetMonitor change detection', () => {
    const monitor = new TargetMonitor('target-1', 'https://example.com');

    const snapshot1 = {
      hash: 'hash1',
      content: 'content1',
      technology: ['nginx'],
      status: 200,
      performance: { loadTime: 1000 }
    };

    const snapshot2 = {
      hash: 'hash2',
      content: 'content2',
      technology: ['apache'],
      status: 200,
      performance: { loadTime: 1500 }
    };

    const changes = monitor.detectChanges(snapshot1, snapshot2);
    assert.strictEqual(changes.changed, true);
    assert(changes.changeScore > 0);
  });

  await verify('TargetMonitor metrics tracking', () => {
    const monitor = new TargetMonitor('target-1', 'https://example.com');
    monitor.metrics.checkTimes.push(1000, 1500, 800);

    // Update average check time like recordCheckMetrics does
    monitor.metrics.averageCheckTime =
      monitor.metrics.checkTimes.reduce((a, b) => a + b, 0) / monitor.metrics.checkTimes.length;

    const metrics = monitor.getMetrics();
    assert(metrics.averageCheckTime > 0);
    assert.strictEqual(metrics.averageCheckTime, (1000 + 1500 + 800) / 3);
  });

  // Verify MonitoringCoordinator
  console.log('\n🎯 Monitoring Coordinator Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await verify('MonitoringCoordinator instantiation', () => {
    const coordinator = new MonitoringCoordinator();
    assert(coordinator.scheduler instanceof MonitorScheduler);
    assert(coordinator.monitors instanceof Map);
  });

  await verify('MonitoringCoordinator add/remove monitor', async () => {
    const coordinator = new MonitoringCoordinator();

    const mockApi = {
      getPageContent: async () => '<html></html>',
      takeScreenshot: async () => Buffer.alloc(0),
      detectTechnology: async () => [],
      getPerformanceMetrics: async () => ({}),
      getPageStatus: async () => 200
    };

    await coordinator.initializeBrowserApi(mockApi);

    const addResult = await coordinator.addMonitor('target-1', 'https://example.com');
    assert.strictEqual(addResult.success, true);
    assert.strictEqual(coordinator.monitors.size, 1);

    const removeResult = coordinator.removeMonitor('target-1');
    assert.strictEqual(removeResult.success, true);
    assert.strictEqual(coordinator.monitors.size, 0);
  });

  await verify('MonitoringCoordinator resource management', () => {
    const coordinator = new MonitoringCoordinator({
      enableResourceManagement: true
    });

    // Should have resource tracking
    assert(coordinator.resourceMetrics);
    assert(coordinator.degradationLevel >= 0);
  });

  await verify('MonitoringCoordinator event aggregation', () => {
    const coordinator = new MonitoringCoordinator();

    coordinator.recordEvent('test-event', { data: 'test' });
    coordinator.recordEvent('test-event', { data: 'test' });

    const events = coordinator.getEvents(100);
    assert(events.length >= 2);
  });

  // Verify WebSocket API
  console.log('\n📡 WebSocket API Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await verify('monitoring-continuous.js exports', () => {
    const commands = require('../../websocket/commands/monitoring-continuous');
    assert.strictEqual(typeof commands.registerContinuousMonitoringCommands, 'function');
  });

  // Integration verification
  console.log('\n🔗 Integration Verification');
  console.log('─────────────────────────────────────────────────────────────');

  await verify('Coordinator + Scheduler integration', async () => {
    const coordinator = new MonitoringCoordinator();
    const mockApi = {
      getPageContent: async () => '<html></html>',
      takeScreenshot: async () => Buffer.alloc(0),
      detectTechnology: async () => [],
      getPerformanceMetrics: async () => ({}),
      getPageStatus: async () => 200
    };

    await coordinator.initializeBrowserApi(mockApi);

    // Add multiple monitors
    for (let i = 0; i < 5; i++) {
      await coordinator.addMonitor(`target-${i}`, `https://example${i}.com`, {
        priority: PRIORITY.NORMAL
      });
    }

    // Verify they're registered with scheduler
    const schedulerStatus = coordinator.scheduler.getStatus();
    assert.strictEqual(schedulerStatus.totalMonitors, 5);

    // Get coordinator status
    const coordStatus = coordinator.getStatus();
    assert.strictEqual(coordStatus.totalMonitors, 5);

    coordinator.stop();
  });

  await verify('Multi-monitor concurrent handling', async () => {
    const coordinator = new MonitoringCoordinator({
      maxConcurrentChecks: 3
    });

    const mockApi = {
      getPageContent: async () => '<html></html>',
      takeScreenshot: async () => Buffer.alloc(0),
      detectTechnology: async () => [],
      getPerformanceMetrics: async () => ({}),
      getPageStatus: async () => 200
    };

    await coordinator.initializeBrowserApi(mockApi);

    // Add 10 monitors (more than concurrent limit)
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        coordinator.addMonitor(`target-${i}`, `https://example${i}.com`)
      );
    }

    await Promise.all(promises);

    const status = coordinator.getStatus();
    assert.strictEqual(status.totalMonitors, 10);

    coordinator.stop();
  });

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Verification Summary');
  console.log('═══════════════════════════════════════════════════════════════');

  const passed = verifications.filter(v => v.status === 'PASS').length;
  const failed = verifications.filter(v => v.status === 'FAIL').length;

  console.log(`\n✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${verifications.length}\n`);

  if (failed > 0) {
    console.log('Failed Verifications:');
    verifications
      .filter(v => v.status === 'FAIL')
      .forEach(v => {
        console.log(`  - ${v.name}: ${v.error}`);
      });
    process.exit(1);
  }

  console.log('✅ All verifications passed!\n');
  process.exit(0);
}

// Run verifications
runVerifications().catch(error => {
  console.error('Verification error:', error);
  process.exit(1);
});

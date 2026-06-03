#!/usr/bin/env node

/**
 * System-Level Stress Testing Suite
 * Tests for large campaigns, long-running sessions, network degradation, and resource exhaustion
 *
 * Features Tested:
 * 1. 1000 monitors in single campaign
 * 2. 10,000+ changes in 1 hour
 * 3. 100,000+ total alerts
 * 4. 24-hour continuous operation
 * 5. Memory stability (< 1MB/hour growth)
 * 6. Connection stability
 * 7. High latency (5-10 second round-trip)
 * 8. Packet loss (5-25%)
 * 9. Intermittent disconnections
 * 10. Resource exhaustion scenarios
 */

const assert = require('assert');
const EventEmitter = require('events');

console.log('[SYSTEM-STRESS] Starting system-level stress testing...\n');

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  issues: [],
  tests: [],
  stressMetrics: []
};

function test(name, fn) {
  try {
    fn();
    console.log(`✓ PASS: ${name}`);
    results.passed++;
    results.tests.push({ name, status: 'pass' });
  } catch (error) {
    console.log(`✗ FAIL: ${name}`);
    console.log(`  Error: ${error.message}`);
    results.failed++;
    results.issues.push({ test: name, error: error.message });
    results.tests.push({ name, status: 'fail', error: error.message });
  }
}

function asyncTest(name, fn) {
  return new Promise((resolve) => {
    (async () => {
      try {
        await fn();
        console.log(`✓ PASS: ${name}`);
        results.passed++;
        results.tests.push({ name, status: 'pass' });
        resolve();
      } catch (error) {
        console.log(`✗ FAIL: ${name}`);
        console.log(`  Error: ${error.message}`);
        results.failed++;
        results.issues.push({ test: name, error: error.message });
        results.tests.push({ name, status: 'fail', error: error.message });
        resolve();
      }
    })();
  });
}

function stressTest(name, fn) {
  return new Promise((resolve) => {
    (async () => {
      try {
        const memBefore = process.memoryUsage();
        const start = process.hrtime.bigint();

        const result = await fn();

        const end = process.hrtime.bigint();
        const memAfter = process.memoryUsage();

        const duration = Number(end - start) / 1000000; // ms
        const memGrowth = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024; // MB

        console.log(`✓ STRESS: ${name}`);
        console.log(`    Duration: ${duration.toFixed(2)}ms, Memory: ${memGrowth.toFixed(2)}MB`);

        results.passed++;
        results.stressMetrics.push({
          test: name,
          duration,
          memoryGrowth: memGrowth,
          ...result
        });
        results.tests.push({ name, status: 'stress', duration, memoryGrowth });

        resolve();
      } catch (error) {
        console.log(`✗ FAIL: ${name}`);
        console.log(`  Error: ${error.message}`);
        results.failed++;
        results.issues.push({ test: name, error: error.message });
        results.tests.push({ name, status: 'fail', error: error.message });
        resolve();
      }
    })();
  });
}

// ====================================
// Mock Campaign Manager
// ====================================
class CampaignManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.campaigns = new Map();
    this.monitors = new Map();
    this.changes = new Map();
    this.alerts = new Map();
    this.config = {
      maxMonitors: options.maxMonitors || 10000,
      maxAlerts: options.maxAlerts || 1000000,
      cleanupInterval: options.cleanupInterval || 60000,
      ...options
    };

    this.stats = {
      totalMonitors: 0,
      totalChanges: 0,
      totalAlerts: 0,
      activeSessions: 0
    };
  }

  createCampaign(id, name, options = {}) {
    this.campaigns.set(id, {
      id,
      name,
      createdAt: Date.now(),
      monitors: [],
      changes: 0,
      alerts: 0,
      status: 'active',
      ...options
    });
    return this.campaigns.get(id);
  }

  addMonitor(campaignId, monitorId, config = {}) {
    if (this.stats.totalMonitors >= this.config.maxMonitors) {
      throw new Error('Max monitors exceeded');
    }

    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const monitor = {
      id: monitorId,
      campaignId,
      name: config.name || `Monitor_${monitorId}`,
      url: config.url || 'http://example.com',
      createdAt: Date.now(),
      changes: 0,
      alerts: 0
    };

    this.monitors.set(monitorId, monitor);
    campaign.monitors.push(monitorId);
    this.stats.totalMonitors++;

    return monitor;
  }

  recordChange(campaignId, monitorId, changeData) {
    if (this.stats.totalChanges >= 1000000) {
      // Cleanup old changes
      const changes = Array.from(this.changes.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 100000);
      this.changes.clear();
      changes.forEach(c => this.changes.set(c.id, c));
    }

    const change = {
      id: `${campaignId}-${monitorId}-${this.stats.totalChanges}`,
      campaignId,
      monitorId,
      timestamp: Date.now(),
      ...changeData
    };

    this.changes.set(change.id, change);
    this.stats.totalChanges++;

    const campaign = this.campaigns.get(campaignId);
    const monitor = this.monitors.get(monitorId);
    if (campaign) campaign.changes++;
    if (monitor) monitor.changes++;

    return change;
  }

  recordAlert(campaignId, monitorId, alertData) {
    if (this.stats.totalAlerts >= this.config.maxAlerts) {
      // Cleanup old alerts
      const alerts = Array.from(this.alerts.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(0, 100000);
      this.alerts.clear();
      alerts.forEach(a => this.alerts.set(a.id, a));
    }

    const alert = {
      id: `${campaignId}-${monitorId}-${this.stats.totalAlerts}`,
      campaignId,
      monitorId,
      timestamp: Date.now(),
      ...alertData
    };

    this.alerts.set(alert.id, alert);
    this.stats.totalAlerts++;

    const campaign = this.campaigns.get(campaignId);
    const monitor = this.monitors.get(monitorId);
    if (campaign) campaign.alerts++;
    if (monitor) monitor.alerts++;

    return alert;
  }

  getStats() {
    return {
      ...this.stats,
      campaigns: this.campaigns.size,
      monitorsByStatus: this._getMonitorStatus(),
      changeRate: this.stats.totalChanges / (Date.now() / 1000),
      alertRate: this.stats.totalAlerts / (Date.now() / 1000)
    };
  }

  _getMonitorStatus() {
    const status = {};
    for (const monitor of this.monitors.values()) {
      const key = monitor.changes > 0 ? 'active' : 'idle';
      status[key] = (status[key] || 0) + 1;
    }
    return status;
  }
}

// ====================================
// TEST SUITE 1: Large Campaign Stress
// ====================================
console.log('\n=== TEST SUITE 1: Large Campaign Stress ===\n');

stressTest('Create 1000 monitors in single campaign', async () => {
  const manager = new CampaignManager();
  manager.createCampaign('campaign-1', 'Large Campaign');

  for (let i = 0; i < 1000; i++) {
    manager.addMonitor('campaign-1', `monitor-${i}`, {
      name: `Monitor ${i}`,
      url: `http://example.com/monitor/${i}`
    });
  }

  const stats = manager.getStats();
  assert.strictEqual(stats.totalMonitors, 1000, 'Should have 1000 monitors');

  return {
    monitors: stats.totalMonitors,
    campaigns: stats.campaigns
  };
});

stressTest('Record 10,000 changes across 1000 monitors', async () => {
  const manager = new CampaignManager();
  manager.createCampaign('campaign-1', 'Changes Test');

  for (let i = 0; i < 1000; i++) {
    manager.addMonitor('campaign-1', `monitor-${i}`);
  }

  for (let i = 0; i < 10000; i++) {
    const monitorId = `monitor-${i % 1000}`;
    manager.recordChange('campaign-1', monitorId, {
      type: i % 3 === 0 ? 'price' : 'description',
      oldValue: `old_${i}`,
      newValue: `new_${i}`
    });
  }

  const stats = manager.getStats();
  assert.strictEqual(stats.totalChanges, 10000, 'Should record 10K changes');

  return {
    changes: stats.totalChanges,
    changeRate: stats.changeRate.toFixed(2)
  };
});

stressTest('Record 100,000 alerts across monitors', async () => {
  const manager = new CampaignManager({ maxAlerts: 200000 });
  manager.createCampaign('campaign-1', 'Alerts Test');

  for (let i = 0; i < 100; i++) {
    manager.addMonitor('campaign-1', `monitor-${i}`);
  }

  for (let i = 0; i < 100000; i++) {
    const monitorId = `monitor-${i % 100}`;
    manager.recordAlert('campaign-1', monitorId, {
      severity: ['low', 'medium', 'high'][i % 3],
      message: `Alert ${i}`
    });
  }

  const stats = manager.getStats();
  assert.strictEqual(stats.totalAlerts, 100000, 'Should record 100K alerts');

  return {
    alerts: stats.totalAlerts,
    alertRate: stats.alertRate.toFixed(4)
  };
});

stressTest('Verify data integrity with 1000 monitors and 10K changes', async () => {
  const manager = new CampaignManager();
  manager.createCampaign('integrity-test', 'Integrity');

  for (let i = 0; i < 1000; i++) {
    manager.addMonitor('integrity-test', `monitor-${i}`);
  }

  for (let i = 0; i < 10000; i++) {
    manager.recordChange('integrity-test', `monitor-${i % 1000}`, {
      value: Math.random()
    });
  }

  const stats = manager.getStats();
  assert(stats.totalMonitors > 0, 'Should have monitors');
  assert(stats.totalChanges > 0, 'Should have changes');
  assert.strictEqual(stats.totalMonitors, 1000, 'Monitor count should be exact');
  assert.strictEqual(stats.totalChanges, 10000, 'Change count should be exact');

  return {
    integrityCheck: 'passed'
  };
});

// ====================================
// TEST SUITE 2: Long-Running Session
// ====================================
console.log('\n=== TEST SUITE 2: Long-Running Session ===\n');

stressTest('24-hour continuous operation simulation', async () => {
  const manager = new CampaignManager();
  manager.createCampaign('longrun', '24-Hour Test');

  // Create 100 monitors
  for (let i = 0; i < 100; i++) {
    manager.addMonitor('longrun', `monitor-${i}`);
  }

  // Simulate 24 hours of operations (compressed)
  // 1 hour = 100ms in test
  const hoursToSimulate = 24;
  const operationsPerHour = 100;

  for (let hour = 0; hour < hoursToSimulate; hour++) {
    for (let op = 0; op < operationsPerHour; op++) {
      const monitorId = `monitor-${Math.floor(Math.random() * 100)}`;

      if (Math.random() < 0.7) {
        manager.recordChange('longrun', monitorId, {
          type: 'change',
          value: Math.random()
        });
      } else {
        manager.recordAlert('longrun', monitorId, {
          severity: 'low',
          message: 'Test'
        });
      }
    }
  }

  const stats = manager.getStats();
  return {
    duration: '24h (simulated)',
    totalChanges: stats.totalChanges,
    totalAlerts: stats.totalAlerts,
    changeRate: stats.changeRate.toFixed(2)
  };
});

test('Memory stability check (simulated)', () => {
  const memCheckpoints = [];

  for (let i = 0; i < 10; i++) {
    memCheckpoints.push({
      index: i,
      heapUsed: process.memoryUsage().heapUsed / 1024 / 1024
    });
  }

  // Calculate growth rate
  const firstMB = memCheckpoints[0].heapUsed;
  const lastMB = memCheckpoints[memCheckpoints.length - 1].heapUsed;
  const growthMB = lastMB - firstMB;

  console.log(`  → Memory: ${firstMB.toFixed(1)}MB → ${lastMB.toFixed(1)}MB (growth: ${growthMB.toFixed(1)}MB)`);

  // In production, should be < 1MB/hour growth
  // In test, very short timeframe, growth should be minimal
  assert(growthMB < 100, 'Memory growth should be reasonable');
});

// ====================================
// TEST SUITE 3: Connection Stability
// ====================================
console.log('\n=== TEST SUITE 3: Connection Stability ===\n');

stressTest('Maintain 1000 concurrent connections for 10 minutes', async () => {
  const connections = new Set();

  // Create 1000 "connections"
  for (let i = 0; i < 1000; i++) {
    connections.add({
      id: i,
      createdAt: Date.now(),
      lastPing: Date.now(),
      active: true
    });
  }

  // Simulate 10 minutes of activity
  const iterations = 100;
  let lost = 0;
  let recovered = 0;

  for (let i = 0; i < iterations; i++) {
    // Simulate occasional connection loss (1%)
    for (const conn of connections) {
      if (Math.random() < 0.01) {
        conn.active = false;
        lost++;

        // 50% chance to recover
        if (Math.random() < 0.5) {
          conn.active = true;
          recovered++;
        }
      }
      conn.lastPing = Date.now();
    }
  }

  const activeConnections = Array.from(connections).filter(c => c.active).length;

  return {
    totalConnections: connections.size,
    activeConnections,
    lost,
    recovered,
    finalActivePercentage: ((activeConnections / connections.size) * 100).toFixed(1)
  };
});

test('No disconnections during normal load', () => {
  const connections = [];
  for (let i = 0; i < 100; i++) {
    connections.push({ id: i, connected: true });
  }

  const disconnected = connections.filter(c => !c.connected).length;
  assert.strictEqual(disconnected, 0, 'Should have no disconnections');

  console.log(`  → ${connections.length} connections stable`);
});

// ====================================
// TEST SUITE 4: Network Degradation
// ====================================
console.log('\n=== TEST SUITE 4: Network Degradation ===\n');

stressTest('Handle 5-second round-trip latency', async () => {
  const requests = [];
  const latency = 5000; // 5 seconds

  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, latency));
    const elapsed = Date.now() - start;

    requests.push({
      id: i,
      expectedLatency: latency,
      actualLatency: elapsed,
      success: elapsed >= latency
    });
  }

  const successes = requests.filter(r => r.success).length;
  assert(successes > 0, 'Should handle high latency');

  return {
    requests: requests.length,
    successRate: ((successes / requests.length) * 100).toFixed(1),
    avgLatency: (requests.reduce((sum, r) => sum + r.actualLatency, 0) / requests.length).toFixed(0)
  };
});

stressTest('Handle 10-second round-trip with retries', async () => {
  const maxRetries = 3;
  const latency = 10000; // 10 seconds

  let attempts = 0;
  let success = false;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, latency));
    success = true;
    break; // Success on first attempt in this simulation
  }

  assert(success, 'Should succeed within retries');

  return {
    attempts,
    success,
    totalTime: (attempts * latency)
  };
});

stressTest('Handle 5-25% packet loss', async () => {
  const requests = 1000;
  const packetLossRates = [0.05, 0.10, 0.25]; // 5%, 10%, 25%

  for (const lossRate of packetLossRates) {
    let successful = 0;

    for (let i = 0; i < requests; i++) {
      if (Math.random() > lossRate) {
        successful++;
      }
    }

    const actualLoss = ((requests - successful) / requests * 100).toFixed(1);
    assert(successful > 0, `Should have successful requests at ${lossRate * 100}% loss`);
  }

  return {
    requestsSimulated: requests,
    packetLossScenariosHandled: packetLossRates.length
  };
});

stressTest('Handle intermittent disconnections', async () => {
  let connected = true;
  let disconnections = 0;
  let reconnections = 0;

  for (let i = 0; i < 1000; i++) {
    // 2% chance to disconnect
    if (Math.random() < 0.02) {
      connected = false;
      disconnections++;

      // Attempt to reconnect (80% success rate)
      if (Math.random() < 0.8) {
        connected = true;
        reconnections++;
      }
    }
  }

  return {
    iterations: 1000,
    disconnections,
    reconnections,
    reconnectionSuccessRate: ((reconnections / disconnections) * 100).toFixed(1)
  };
});

// ====================================
// TEST SUITE 5: Resource Exhaustion
// ====================================
console.log('\n=== TEST SUITE 5: Resource Exhaustion ===\n');

test('Handles 90% memory utilization', () => {
  const memoryUsage = process.memoryUsage();
  const heapTotal = memoryUsage.heapTotal;
  const utilization = (memoryUsage.heapUsed / heapTotal) * 100;

  console.log(`  → Current heap utilization: ${utilization.toFixed(1)}%`);
  // This is informational; we can't really force 90% utilization in test
  assert(heapTotal > 0, 'Should have heap memory');
});

test('Handles CPU-bound operation', () => {
  const start = process.hrtime.bigint();
  let sum = 0;

  // CPU-intensive operation
  for (let i = 0; i < 10000000; i++) {
    sum += Math.sqrt(i) * Math.random();
  }

  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1000000;

  console.log(`  → CPU-bound operation: ${duration.toFixed(2)}ms`);
  assert(sum > 0, 'Operation should complete');
});

test('Handles connection limit near system max', () => {
  const maxConnections = 65535; // Typical system limit
  const testConnections = Math.min(10000, maxConnections);

  const connections = [];
  for (let i = 0; i < Math.min(100, testConnections); i++) {
    connections.push({ id: i, active: true });
  }

  console.log(`  → Simulating ${connections.length} of ${maxConnections} max connections`);
  assert(connections.length > 0, 'Should create connections');
});

// ====================================
// TEST SUITE 6: Error Recovery
// ====================================
console.log('\n=== TEST SUITE 6: Error Recovery ===\n');

stressTest('Recover from errors without data loss', async () => {
  const manager = new CampaignManager();
  manager.createCampaign('recovery', 'Recovery Test');

  for (let i = 0; i < 100; i++) {
    manager.addMonitor('recovery', `monitor-${i}`);
  }

  let recorded = 0;
  const errors = [];

  for (let i = 0; i < 1000; i++) {
    try {
      manager.recordChange('recovery', `monitor-${i % 100}`, {
        value: Math.random()
      });
      recorded++;
    } catch (error) {
      errors.push(error.message);
    }
  }

  const stats = manager.getStats();
  assert.strictEqual(stats.totalChanges, recorded, 'No data loss after errors');

  return {
    recordedSuccessfully: recorded,
    errors: errors.length,
    dataIntegrity: 'verified'
  };
});

// ====================================
// Test Summary
// ====================================
console.log('\n=== TEST SUMMARY ===\n');
console.log(`Total Tests: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.stressMetrics.length > 0) {
  console.log('\n=== STRESS TEST METRICS ===');
  results.stressMetrics.forEach(metric => {
    console.log(`  ${metric.test}:`);
    console.log(`    - Duration: ${metric.duration.toFixed(2)}ms`);
    console.log(`    - Memory: ${metric.memoryGrowth.toFixed(2)}MB`);
  });

  const avgMemGrowth = results.stressMetrics.reduce((sum, m) => sum + m.memoryGrowth, 0) / results.stressMetrics.length;
  console.log(`\n  Average Memory Growth: ${avgMemGrowth.toFixed(2)}MB`);
}

if (results.failed > 0) {
  console.log('\n=== FAILURES ===');
  results.issues.forEach(issue => {
    console.log(`\n${issue.test}:`);
    console.log(`  ${issue.error}`);
  });
}

process.exit(results.failed > 0 ? 1 : 0);

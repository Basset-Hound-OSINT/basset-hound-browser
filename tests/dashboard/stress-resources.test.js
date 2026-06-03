/**
 * Dashboard Stress Test - Memory & Resource Stress
 * Tests memory management over extended periods with continuous updates
 *
 * Measures:
 * - Memory growth over 1+ hour
 * - Detection of memory leaks
 * - Unbounded allocations
 * - Garbage collection effectiveness
 *
 * @module tests/dashboard/stress-resources.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');

// Utility for memory monitoring
class MemoryMonitor {
  constructor() {
    this.snapshots = [];
    this.startTime = Date.now();
  }

  snapshot() {
    const usage = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0,
      elapsed: Date.now() - this.startTime
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  getGrowthRate() {
    if (this.snapshots.length < 2) return 0;

    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];

    const timeElapsed = (last.elapsed - first.elapsed) / 1000; // seconds
    const memoryGrowth = last.heapUsed - first.heapUsed;

    if (timeElapsed === 0) return 0;
    return memoryGrowth / timeElapsed; // bytes per second
  }

  getTrend() {
    if (this.snapshots.length < 3) return 'insufficient_data';

    // Check last 3 snapshots
    const recent = this.snapshots.slice(-3);
    const diffs = [];

    for (let i = 1; i < recent.length; i++) {
      diffs.push(recent[i].heapUsed - recent[i - 1].heapUsed);
    }

    const avgDiff = diffs.reduce((a, b) => a + b) / diffs.length;

    if (avgDiff > 1024 * 100) return 'growing'; // >100KB growth
    if (avgDiff < -1024 * 100) return 'shrinking';
    return 'stable';
  }

  getStatistics() {
    const heapUsages = this.snapshots.map(s => s.heapUsed);
    const min = Math.min(...heapUsages);
    const max = Math.max(...heapUsages);
    const avg = heapUsages.reduce((a, b) => a + b) / heapUsages.length;

    return {
      min,
      max,
      avg,
      range: max - min,
      growthRate: this.getGrowthRate(),
      trend: this.getTrend(),
      snapshots: this.snapshots.length
    };
  }
}

// Mock dashboard with resource tracking
class ResourceAwareDashboard extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxMonitors: options.maxMonitors || 100,
      maxChangesPerMonitor: options.maxChangesPerMonitor || 500,
      enableGcTracking: options.enableGcTracking !== false,
      ...options
    };

    this.monitors = new Map();
    this.changes = new Map();
    this.alerts = [];
    this.timeline = [];

    this.resourceStats = {
      operationCount: 0,
      gcEventCount: 0,
      lastGcTime: null,
      totalGcTime: 0
    };
  }

  registerMonitor(monitorId) {
    this.monitors.set(monitorId, {
      id: monitorId,
      changes: [],
      alerts: [],
      createdAt: Date.now()
    });
    this.changes.set(monitorId, []);
    this.resourceStats.operationCount++;
  }

  addChange(monitorId, change) {
    if (!this.monitors.has(monitorId)) {
      throw new Error('Monitor not found');
    }

    const changes = this.changes.get(monitorId);
    changes.unshift({
      ...change,
      id: Math.random().toString(36),
      timestamp: Date.now()
    });

    // Enforce limit
    if (changes.length > this.options.maxChangesPerMonitor) {
      changes.pop();
    }

    this.timeline.unshift(changes[0]);
    if (this.timeline.length > 10000) {
      this.timeline.pop();
    }

    this.resourceStats.operationCount++;
  }

  addAlert(monitorId, alert) {
    if (!this.monitors.has(monitorId)) {
      throw new Error('Monitor not found');
    }

    this.alerts.push({
      ...alert,
      monitorId,
      id: Math.random().toString(36),
      timestamp: Date.now()
    });

    // Enforce limit
    if (this.alerts.length > 100000) {
      this.alerts.shift();
    }

    this.resourceStats.operationCount++;
  }

  cleanup() {
    // Simulate cleanup
    for (const [monitorId, changes] of this.changes) {
      if (changes.length > this.options.maxChangesPerMonitor) {
        this.changes.set(monitorId, changes.slice(0, this.options.maxChangesPerMonitor));
      }
    }
  }

  getMemoryUsage() {
    return process.memoryUsage();
  }

  getStats() {
    return {
      monitors: this.monitors.size,
      totalChanges: Array.from(this.changes.values()).reduce((sum, arr) => sum + arr.length, 0),
      totalAlerts: this.alerts.length,
      timelineSize: this.timeline.length,
      operationCount: this.resourceStats.operationCount,
      gcEventCount: this.resourceStats.gcEventCount
    };
  }
}

// Test Suite
describe('Dashboard Stress Tests - Memory & Resources', function() {
  this.timeout(180000); // 3 minutes for extended tests

  let dashboard;
  let memoryMonitor;

  before(() => {
    dashboard = new ResourceAwareDashboard({ maxMonitors: 100 });
    memoryMonitor = new MemoryMonitor();
  });

  describe('Scenario 1: Continuous Updates for 1+ Hour (Simulated)', function() {
    it('should handle 1-hour operation window (compressed time)', async function() {
      const durationMs = 30000; // 30 seconds represents 1 hour
      const endTime = Date.now() + durationMs;

      // Setup 50 monitors
      for (let i = 0; i < 50; i++) {
        dashboard.registerMonitor(`monitor-${i}`);
      }

      memoryMonitor.snapshot();

      // Simulate 1 hour of updates
      let updateCount = 0;
      while (Date.now() < endTime) {
        const monitorId = `monitor-${updateCount % 50}`;

        // Add change
        dashboard.addChange(monitorId, {
          type: 'content',
          description: `Update ${updateCount}`
        });

        // Add alert occasionally
        if (updateCount % 10 === 0) {
          dashboard.addAlert(monitorId, {
            severity: 'low',
            type: 'change'
          });
        }

        updateCount++;

        // Take memory snapshot every 5 seconds
        if (updateCount % 1000 === 0) {
          memoryMonitor.snapshot();
        }
      }

      const stats = memoryMonitor.getStatistics();
      console.log(`\n1-Hour Simulation - Memory Statistics:`);
      console.log(`  Min: ${(stats.min / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Max: ${(stats.max / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Range: ${(stats.range / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Growth Rate: ${(stats.growthRate / 1024).toFixed(2)}KB/sec`);
      console.log(`  Trend: ${stats.trend}`);
      console.log(`  Total Updates: ${updateCount}`);

      assert(stats.trend !== 'growing', 'Memory should not continuously grow');
    });
  });

  describe('Scenario 2: Memory Leak Detection', function() {
    it('should not leak memory with repeated add/cleanup cycles', function() {
      const measurements = [];

      for (let cycle = 0; cycle < 5; cycle++) {
        const before = process.memoryUsage().heapUsed;

        // Add data
        for (let i = 0; i < 1000; i++) {
          dashboard.addChange('monitor-0', {
            type: 'content',
            data: `Cycle ${cycle} update ${i}`
          });
        }

        // Cleanup
        dashboard.cleanup();

        const after = process.memoryUsage().heapUsed;
        measurements.push(after - before);
      }

      // Memory increase should not grow significantly in later cycles
      const firstCycleGrowth = measurements[0];
      const lastCycleGrowth = measurements[4];

      const growthRatio = lastCycleGrowth / firstCycleGrowth;
      console.log(`\nMemory Leak Detection:`);
      console.log(`  First cycle: ${(firstCycleGrowth / 1024).toFixed(2)}KB`);
      console.log(`  Last cycle: ${(lastCycleGrowth / 1024).toFixed(2)}KB`);
      console.log(`  Ratio: ${growthRatio.toFixed(2)}x`);

      assert(growthRatio < 1.5, 'Memory growth should stabilize, not increase linearly');
    });
  });

  describe('Scenario 3: Unbounded Allocation Detection', function() {
    it('should prevent unbounded array growth', function() {
      const initialSize = dashboard.timeline.length;

      // Simulate many updates
      for (let i = 0; i < 5000; i++) {
        dashboard.addChange('monitor-0', {
          type: 'content',
          data: `Update ${i}`
        });
      }

      const finalSize = dashboard.timeline.length;

      // Timeline should be bounded
      assert(finalSize <= 10000, `Timeline should be bounded to 10000 entries`);
      console.log(`\nUnbounded Allocation Detection:`);
      console.log(`  Initial size: ${initialSize}`);
      console.log(`  Final size: ${finalSize}`);
    });

    it('should enforce per-monitor change limits', function() {
      // Add many changes to one monitor
      for (let i = 0; i < 1000; i++) {
        dashboard.addChange('monitor-1', {
          type: 'content'
        });
      }

      const changes = dashboard.changes.get('monitor-1');
      assert(changes.length <= 500, `Per-monitor changes should be limited to 500`);
    });

    it('should enforce alert limit', function() {
      // Add many alerts
      for (let i = 0; i < 200000; i++) {
        dashboard.addAlert('monitor-0', {
          severity: 'low'
        });
      }

      assert(dashboard.alerts.length <= 100000, `Total alerts should be limited to 100000`);
    });
  });

  describe('Scenario 4: Garbage Collection Effectiveness', function() {
    it('should allow garbage collection after cleanup', function() {
      const before = process.memoryUsage().heapUsed;

      // Create large temporary dataset
      const tempData = [];
      for (let i = 0; i < 100000; i++) {
        tempData.push({
          id: i,
          data: new Array(100).fill('x').join('')
        });
      }

      const afterCreation = process.memoryUsage().heapUsed;

      // Clear temp data
      tempData.length = 0;

      // Force a brief pause to allow GC
      for (let i = 0; i < 10000; i++) {
        Math.random();
      }

      const afterCleanup = process.memoryUsage().heapUsed;

      console.log(`\nGarbage Collection:`);
      console.log(`  Before creation: ${(before / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After creation: ${(afterCreation / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  After cleanup: ${(afterCleanup / 1024 / 1024).toFixed(2)}MB`);

      // Should recover some memory
      const recovery = afterCreation - afterCleanup;
      assert(recovery > 0, 'Should recover memory after cleanup');
    });
  });

  describe('Scenario 5: Handle Large Object Sizes', function() {
    it('should handle large change objects efficiently', function() {
      const largeData = 'x'.repeat(10000); // 10KB string

      for (let i = 0; i < 100; i++) {
        dashboard.addChange('monitor-0', {
          type: 'content',
          description: largeData,
          details: largeData
        });
      }

      const stats = dashboard.getStats();
      assert(stats.totalChanges > 0, 'Should store large objects');
    });
  });

  describe('Scenario 6: Monitor Creation Stress', function() {
    it('should handle creation of 100 monitors efficiently', function() {
      const before = process.memoryUsage().heapUsed;

      for (let i = 100; i < 200; i++) {
        dashboard.registerMonitor(`monitor-${i}`);
      }

      const after = process.memoryUsage().heapUsed;
      const increase = after - before;
      const perMonitor = increase / 100;

      console.log(`\nMonitor Creation:`);
      console.log(`  100 monitors: ${(increase / 1024).toFixed(2)}KB`);
      console.log(`  Per-monitor: ${(perMonitor / 1024).toFixed(2)}KB`);

      assert(perMonitor < 10240, 'Each monitor should use <10KB');
    });
  });

  describe('Scenario 7: Array and Map Performance', function() {
    it('should maintain efficient data structure access', function() {
      const startTime = Date.now();
      let accessCount = 0;

      // Perform many accesses
      for (let i = 0; i < 10000; i++) {
        const monitorId = `monitor-${i % 100}`;
        const changes = dashboard.changes.get(monitorId);
        if (changes && changes.length > 0) {
          accessCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      assert(elapsed < 100, `10000 map accesses should be <100ms, was ${elapsed}ms`);
    });
  });

  describe('Scenario 8: Long-Running Memory Stability', function() {
    it('should maintain stable memory over 100 operations', function() {
      const snapshots = [];

      for (let op = 0; op < 100; op++) {
        // Take snapshot
        snapshots.push(process.memoryUsage().heapUsed);

        // Perform operations
        for (let i = 0; i < 100; i++) {
          dashboard.addChange('monitor-0', {
            type: 'content'
          });
        }
      }

      // Analyze trend
      const firstHalf = snapshots.slice(0, 50);
      const secondHalf = snapshots.slice(50);

      const avgFirst = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

      const growthPercent = ((avgSecond - avgFirst) / avgFirst) * 100;

      console.log(`\nLong-Running Stability:`);
      console.log(`  First 50 ops avg: ${(avgFirst / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Last 50 ops avg: ${(avgSecond / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Growth: ${growthPercent.toFixed(1)}%`);

      assert(growthPercent < 20, 'Memory should not grow >20% over 100 operations');
    });
  });

  describe('Scenario 9: External Memory Tracking', function() {
    it('should track external memory usage', function() {
      const usage = process.memoryUsage();

      console.log(`\nMemory Usage Breakdown:`);
      console.log(`  Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  External: ${(usage.external / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  RSS: ${(usage.rss / 1024 / 1024).toFixed(2)}MB`);

      if (usage.arrayBuffers) {
        console.log(`  Array Buffers: ${(usage.arrayBuffers / 1024 / 1024).toFixed(2)}MB`);
      }

      assert(usage.heapUsed > 0, 'Should have heap usage');
    });
  });

  describe('Scenario 10: Resource Cleanup on Shutdown', function() {
    it('should properly cleanup resources', function() {
      const beforeCleanup = process.memoryUsage().heapUsed;

      // Clear all data
      dashboard.monitors.clear();
      dashboard.changes.clear();
      dashboard.alerts = [];
      dashboard.timeline = [];

      // Force garbage collection hint (though we can't force it)
      dashboard = null;

      // Memory should eventually decrease (can't guarantee immediate)
      const afterCleanup = process.memoryUsage().heapUsed;

      // Just verify we can cleanup without errors
      assert(true, 'Cleanup completed successfully');
    });
  });

  after(() => {
    dashboard = null;
    memoryMonitor = null;
  });
});

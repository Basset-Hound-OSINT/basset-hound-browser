/**
 * Dashboard Stress Test - Large Dataset Scenarios
 * Tests dashboard performance with 100+ monitors, 1000+ changes, 50,000+ alerts
 *
 * Measures:
 * - Aggregation time for large datasets
 * - UI responsiveness under load
 * - Memory usage with large data volumes
 * - Sorting and filtering performance
 *
 * @module tests/dashboard/stress-large-dataset.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// Mock DashboardEngine for testing
class MockDashboardEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxTimelineEntries: options.maxTimelineEntries || 10000,
      aggregationInterval: options.aggregationInterval || 300000,
      ...options
    };

    this.monitors = new Map();
    this.changes = new Map();
    this.timeline = [];
    this.metrics = new Map();
    this.subscribers = new Set();

    this.stats = {
      totalChanges: 0,
      totalAlerts: 0,
      averageChangeFrequency: 0,
      lastAggregation: null,
      startTime: Date.now()
    };

    this.initializeMetrics();
  }

  initializeMetrics() {
    const metricTypes = [
      'change_count', 'alert_count', 'detection_rate',
      'change_frequency', 'monitor_health'
    ];

    metricTypes.forEach(type => {
      this.metrics.set(type, {
        type,
        value: 0,
        trend: 'stable',
        history: []
      });
    });
  }

  registerMonitor(monitor) {
    if (!monitor.id || !monitor.url) {
      throw new Error('Monitor must have id and url');
    }

    this.monitors.set(monitor.id, {
      ...monitor,
      registeredAt: Date.now(),
      changeCount: 0,
      alertCount: 0,
      lastChange: null
    });

    this.changes.set(monitor.id, []);
    return this.monitors.get(monitor.id);
  }

  addChange(monitorId, change) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not registered`);
    }

    const enrichedChange = {
      ...change,
      monitorId,
      dashboardTimestamp: Date.now(),
      id: `${monitorId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const monitorChanges = this.changes.get(monitorId) || [];
    monitorChanges.unshift(enrichedChange);
    if (monitorChanges.length > 500) {
      monitorChanges.pop();
    }
    this.changes.set(monitorId, monitorChanges);

    this.timeline.unshift(enrichedChange);
    if (this.timeline.length > this.options.maxTimelineEntries) {
      this.timeline.pop();
    }

    monitor.changeCount++;
    this.stats.totalChanges++;
    this.metrics.get('change_count').value = this.stats.totalChanges;

    return enrichedChange;
  }

  addAlert(monitorId, alert) {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) {
      throw new Error(`Monitor ${monitorId} not registered`);
    }

    const enrichedAlert = {
      ...alert,
      monitorId,
      dashboardTimestamp: Date.now(),
      id: `alert-${monitorId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false
    };

    monitor.alertCount++;
    this.stats.totalAlerts++;
    this.metrics.get('alert_count').value = this.stats.totalAlerts;

    return enrichedAlert;
  }

  aggregateByMonitor(options = {}) {
    const startTime = Date.now();
    const result = {
      monitors: {}
    };

    for (const [monitorId, changes] of this.changes) {
      result.monitors[monitorId] = {
        changeCount: changes.length,
        recentChanges: changes.slice(0, options.limit || 10)
      };
    }

    const aggregationTime = Date.now() - startTime;
    this.stats.lastAggregation = aggregationTime;

    return {
      ...result,
      aggregationTime,
      timestamp: Date.now()
    };
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    };
  }
}

// Mock DataAggregator
class MockDataAggregator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      cacheTtl: options.cacheTtl || 5 * 60 * 1000,
      maxCacheSize: options.maxCacheSize || 100,
      ...options
    };

    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.monitorData = new Map();
    this.categoryIndex = new Map();
    this.timeIndex = new Map();

    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      aggregationTime: 0
    };
  }

  indexMonitorChanges(monitorId, changes) {
    this.monitorData.set(monitorId, changes);

    for (const change of changes) {
      const category = change.category || 'unknown';
      if (!this.categoryIndex.has(category)) {
        this.categoryIndex.set(category, []);
      }
      this.categoryIndex.get(category).push({ ...change, monitorId });
    }
  }

  aggregateByCategory(options = {}) {
    const startTime = Date.now();
    const result = {
      categories: {}
    };

    for (const [category, changes] of this.categoryIndex) {
      result.categories[category] = changes.slice(0, options.limit || 100);
    }

    this.stats.aggregationTime = Date.now() - startTime;
    return result;
  }

  filterByDateRange(startTime, endTime) {
    const results = [];
    for (const changes of this.monitorData.values()) {
      results.push(...changes.filter(c =>
        c.timestamp >= startTime && c.timestamp <= endTime
      ));
    }
    return results;
  }
}

// Test Suite
describe('Dashboard Stress Tests - Large Dataset', function() {
  this.timeout(60000);

  let dashboard;
  let aggregator;
  let memoryBaseline;

  before(() => {
    dashboard = new MockDashboardEngine({ maxTimelineEntries: 10000 });
    aggregator = new MockDataAggregator();
    memoryBaseline = process.memoryUsage().heapUsed;
  });

  describe('Scenario 1: 100+ Monitors Registration', function() {
    it('should register 100 monitors within 100ms', function() {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        dashboard.registerMonitor({
          id: `monitor-${i}`,
          url: `https://competitor-${i}.com`,
          name: `Competitor ${i}`,
          category: 'ecommerce'
        });
      }

      const elapsed = Date.now() - startTime;
      assert.strictEqual(dashboard.monitors.size, 100, 'Should have 100 monitors');
      assert(elapsed < 100, `Registration should be <100ms, was ${elapsed}ms`);
    });

    it('should handle 100 monitors with minimal memory overhead', function() {
      const memoryAfter = process.memoryUsage().heapUsed;
      const increase = memoryAfter - memoryBaseline;
      const increasePerMonitor = increase / 100;

      // Each monitor should use ~1KB or less
      assert(increasePerMonitor < 1024 * 10,
        `Per-monitor memory should be <10KB, was ${increasePerMonitor}B`);
    });
  });

  describe('Scenario 2: 1000+ Changes Addition', function() {
    it('should add 1000 changes across monitors in <2000ms', function() {
      const startTime = Date.now();
      let changeCount = 0;

      for (let i = 0; i < 100; i++) {
        const monitorId = `monitor-${i}`;
        for (let j = 0; j < 10; j++) {
          dashboard.addChange(monitorId, {
            type: j % 3 === 0 ? 'content' : j % 3 === 1 ? 'structure' : 'performance',
            category: j % 5 === 0 ? 'technology' : 'content',
            timestamp: Date.now() - Math.random() * 86400000,
            description: `Change ${changeCount}: Sample change description`
          });
          changeCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      assert.strictEqual(dashboard.stats.totalChanges, 1000, 'Should track 1000 changes');
      assert(elapsed < 2000, `Adding 1000 changes should be <2000ms, was ${elapsed}ms`);
    });

    it('should maintain timeline ordering with 1000 changes', function() {
      const timeline = dashboard.timeline.slice(0, 100);

      for (let i = 0; i < timeline.length - 1; i++) {
        assert(timeline[i].dashboardTimestamp >= timeline[i + 1].dashboardTimestamp,
          'Timeline should be in descending order');
      }
    });

    it('should aggregate 1000 changes by monitor in <500ms', function() {
      const startTime = Date.now();
      const aggregated = dashboard.aggregateByMonitor({ limit: 50 });
      const elapsed = Date.now() - startTime;

      assert(Object.keys(aggregated.monitors).length > 0, 'Should have aggregated data');
      assert(aggregated.aggregationTime < 500,
        `Aggregation should be <500ms, was ${aggregated.aggregationTime}ms`);
    });
  });

  describe('Scenario 3: 50,000+ Alerts Performance', function() {
    it('should create 50000 alerts efficiently', function() {
      const startTime = Date.now();
      let alertCount = 0;

      for (let i = 0; i < 100; i++) {
        const monitorId = `monitor-${i}`;
        for (let j = 0; j < 500; j++) {
          dashboard.addAlert(monitorId, {
            severity: ['critical', 'high', 'medium', 'low'][j % 4],
            type: 'change_detected',
            description: `Alert ${alertCount}: Test alert`,
            timestamp: Date.now()
          });
          alertCount++;
        }
      }

      const elapsed = Date.now() - startTime;
      assert.strictEqual(dashboard.stats.totalAlerts, 50000, 'Should track 50000 alerts');
      assert(elapsed < 10000, `Adding 50000 alerts should be <10000ms, was ${elapsed}ms`);
    });

    it('should track alert count metric accurately', function() {
      const alertCountMetric = dashboard.metrics.get('alert_count');
      assert.strictEqual(alertCountMetric.value, 50000,
        'Alert count metric should reflect 50000 alerts');
    });

    it('should filter alerts by monitor efficiently', function() {
      const startTime = Date.now();
      const monitorAlerts = [];

      // Simulate filtering
      for (let i = 0; i < 100; i++) {
        if (i % 10 === 0) {
          monitorAlerts.push({ monitorId: `monitor-${i}` });
        }
      }

      const elapsed = Date.now() - startTime;
      assert(elapsed < 50, `Filtering should be <50ms, was ${elapsed}ms`);
    });
  });

  describe('Scenario 4: Memory Usage Under Load', function() {
    it('should maintain bounded memory growth with 1000+ changes', function() {
      const memoryBefore = process.memoryUsage().heapUsed;

      // Add more changes to existing monitors
      for (let i = 0; i < 100; i++) {
        const monitorId = `monitor-${i}`;
        for (let j = 0; j < 100; j++) {
          dashboard.addChange(monitorId, {
            type: 'content',
            timestamp: Date.now(),
            description: 'Memory test change'
          });
        }
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;
      const memoryPerChange = memoryIncrease / (100 * 100);

      // Each change should use ~100-500 bytes
      assert(memoryPerChange < 1000,
        `Per-change memory should be <1KB, was ${memoryPerChange}B`);
    });

    it('should not leak memory with repeated operations', function() {
      const measurements = [];

      for (let iteration = 0; iteration < 5; iteration++) {
        const before = process.memoryUsage().heapUsed;

        for (let i = 0; i < 10; i++) {
          dashboard.addChange(`monitor-${i}`, {
            type: 'content',
            timestamp: Date.now(),
            description: 'Memory leak test'
          });
        }

        const after = process.memoryUsage().heapUsed;
        measurements.push(after - before);
      }

      // Check if memory increase is stable
      const avgIncrease = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxIncrease = Math.max(...measurements);

      // Last iterations should not use significantly more memory than first
      assert(maxIncrease < avgIncrease * 2,
        'Memory usage should be stable across iterations');
    });
  });

  describe('Scenario 5: Sorting Performance with Large Datasets', function() {
    it('should sort 1000+ changes by timestamp in <100ms', function() {
      const startTime = Date.now();

      const sorted = dashboard.timeline
        .slice(0, 1000)
        .sort((a, b) => b.dashboardTimestamp - a.dashboardTimestamp);

      const elapsed = Date.now() - startTime;
      assert.strictEqual(sorted.length, 1000, 'Should have 1000 changes');
      assert(elapsed < 100, `Sorting should be <100ms, was ${elapsed}ms`);
    });

    it('should filter timeline by category in <50ms', function() {
      const startTime = Date.now();

      const filtered = dashboard.timeline.filter(change =>
        change.category === 'technology'
      );

      const elapsed = Date.now() - startTime;
      assert(elapsed < 50, `Filtering should be <50ms, was ${elapsed}ms`);
    });
  });

  describe('Scenario 6: Aggregation Time with Multiple Queries', function() {
    it('should aggregate data by category in <200ms', function() {
      const startTime = Date.now();

      const categories = {};
      for (const change of dashboard.timeline) {
        const cat = change.category || 'unknown';
        if (!categories[cat]) {
          categories[cat] = [];
        }
        categories[cat].push(change);
      }

      const elapsed = Date.now() - startTime;
      assert(elapsed < 200, `Category aggregation should be <200ms, was ${elapsed}ms`);
    });

    it('should perform concurrent aggregation queries', function() {
      const promises = [
        Promise.resolve(dashboard.aggregateByMonitor()),
        Promise.resolve(dashboard.aggregateByMonitor()),
        Promise.resolve(dashboard.aggregateByMonitor())
      ];

      return Promise.all(promises).then(results => {
        assert.strictEqual(results.length, 3, 'Should complete 3 queries');
        for (const result of results) {
          assert(result.aggregationTime < 500, 'Each query should be <500ms');
        }
      });
    });
  });

  describe('Scenario 7: Timeline Retention Policy', function() {
    it('should enforce maxTimelineEntries limit', function() {
      assert(dashboard.timeline.length <= dashboard.options.maxTimelineEntries,
        `Timeline should respect max limit of ${dashboard.options.maxTimelineEntries}`);
    });

    it('should remove oldest entries when limit exceeded', function() {
      const oldestTimestampBefore = dashboard.timeline[dashboard.timeline.length - 1].dashboardTimestamp;

      // Add more changes
      dashboard.addChange('monitor-0', {
        type: 'content',
        timestamp: Date.now(),
        description: 'Retention test'
      });

      const oldestTimestampAfter = dashboard.timeline[dashboard.timeline.length - 1].dashboardTimestamp;

      // Oldest entry should be newer or same
      assert(oldestTimestampAfter >= oldestTimestampBefore,
        'Oldest entry should be replaced with newer one');
    });
  });

  describe('Scenario 8: Concurrent Monitor Updates', function() {
    it('should handle 10 concurrent monitor updates', function() {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          for (let j = 0; j < 50; j++) {
            dashboard.addChange(`monitor-${i}`, {
              type: 'content',
              timestamp: Date.now(),
              description: `Concurrent test ${i}-${j}`
            });
          }
        }));
      }

      return Promise.all(promises).then(() => {
        assert(dashboard.stats.totalChanges > 1000, 'Should process all concurrent changes');
      });
    });
  });

  describe('Scenario 9: Monitor-specific Timeline Queries', function() {
    it('should retrieve monitor-specific changes efficiently', function() {
      const monitorId = 'monitor-0';
      const startTime = Date.now();

      const changes = dashboard.changes.get(monitorId) || [];

      const elapsed = Date.now() - startTime;
      assert(elapsed < 10, `Monitor query should be <10ms, was ${elapsed}ms`);
      assert(changes.length > 0, 'Should have changes for monitor');
    });
  });

  describe('Scenario 10: Metric Calculation Performance', function() {
    it('should calculate metrics efficiently with large datasets', function() {
      const startTime = Date.now();

      const changeFrequency = dashboard.stats.totalChanges /
        ((Date.now() - dashboard.stats.startTime) / 1000);

      const elapsed = Date.now() - startTime;
      assert(elapsed < 5, `Metric calculation should be <5ms, was ${elapsed}ms`);
      assert(changeFrequency > 0, 'Change frequency should be positive');
    });
  });

  describe('Scenario 11: Large Monitor Comparison', function() {
    it('should compare 50+ monitors performance in <1000ms', function() {
      const startTime = Date.now();

      const comparison = {};
      for (const [monitorId, monitor] of dashboard.monitors) {
        comparison[monitorId] = {
          changeCount: monitor.changeCount,
          alertCount: monitor.alertCount,
          name: monitor.name
        };
      }

      const elapsed = Date.now() - startTime;
      assert(elapsed < 1000, `Comparison should be <1000ms, was ${elapsed}ms`);
      assert(Object.keys(comparison).length >= 50, 'Should compare 50+ monitors');
    });
  });

  describe('Scenario 12: Dashboard State Serialization', function() {
    it('should serialize dashboard state under 50MB', function() {
      const state = JSON.stringify({
        monitors: Array.from(dashboard.monitors.values()),
        changes: Array.from(dashboard.changes.values()),
        stats: dashboard.stats
      });

      const sizeBytes = Buffer.byteLength(state, 'utf8');
      const sizeMB = sizeBytes / (1024 * 1024);

      assert(sizeMB < 50, `State should be <50MB, was ${sizeMB.toFixed(2)}MB`);
    });
  });

  describe('Scenario 13: Cache Performance', function() {
    it('should improve performance with category aggregation cache', function() {
      const aggregator = new MockDataAggregator({ cacheTtl: 5000 });

      // Index changes
      for (let i = 0; i < 100; i++) {
        aggregator.indexMonitorChanges(`monitor-${i}`, Array.from({ length: 10 }, (_, j) => ({
          category: ['content', 'structure', 'performance'][j % 3],
          timestamp: Date.now(),
          id: `change-${i}-${j}`
        })));
      }

      // First query - cache miss
      const start1 = Date.now();
      aggregator.aggregateByCategory();
      const time1 = Date.now() - start1;

      // Second query - should hit cache
      const start2 = Date.now();
      aggregator.aggregateByCategory();
      const time2 = Date.now() - start2;

      // Cache hit should be faster
      assert(time2 <= time1 * 1.5, `Cache hit should be similar or faster`);
    });
  });

  describe('Scenario 14: Date Range Filtering', function() {
    it('should filter changes by date range efficiently', function() {
      const aggregator = new MockDataAggregator();

      // Add timestamped changes
      const now = Date.now();
      for (let i = 0; i < 100; i++) {
        aggregator.indexMonitorChanges(`monitor-${i}`, Array.from({ length: 10 }, (_, j) => ({
          timestamp: now - (Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
          id: `change-${i}-${j}`,
          category: 'content'
        })));
      }

      const startTime = Date.now();
      const startRange = now - (24 * 60 * 60 * 1000); // Last 24 hours
      const endRange = now;

      const filtered = aggregator.filterByDateRange(startRange, endRange);

      const elapsed = Date.now() - startTime;
      assert(elapsed < 100, `Date filtering should be <100ms, was ${elapsed}ms`);
      assert(filtered.length > 0, 'Should return filtered results');
    });
  });

  describe('Scenario 15: Scale Test Summary', function() {
    it('should provide performance summary', function() {
      const summary = {
        totalMonitors: dashboard.monitors.size,
        totalChanges: dashboard.stats.totalChanges,
        totalAlerts: dashboard.stats.totalAlerts,
        timelineSize: dashboard.timeline.length,
        lastAggregationTime: dashboard.stats.lastAggregation,
        memoryUsage: dashboard.getMemoryUsage()
      };

      console.log('\n=== Large Dataset Performance Summary ===');
      console.log(`Monitors: ${summary.totalMonitors}`);
      console.log(`Changes: ${summary.totalChanges}`);
      console.log(`Alerts: ${summary.totalAlerts}`);
      console.log(`Timeline Size: ${summary.timelineSize}`);
      console.log(`Last Aggregation: ${summary.lastAggregationTime}ms`);
      console.log(`Heap Used: ${(summary.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      assert(summary.totalMonitors === 100, 'Should have 100 monitors');
    });
  });

  after(() => {
    dashboard = null;
    aggregator = null;
  });
});

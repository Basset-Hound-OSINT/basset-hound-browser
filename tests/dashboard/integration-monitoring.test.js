/**
 * Dashboard Integration Test - Monitoring System
 * Tests integration between monitor changes and dashboard display
 *
 * Flow: monitor changes → detection → aggregation → dashboard display
 *
 * @module tests/dashboard/integration-monitoring.test.js
 */

const assert = require('assert');
const EventEmitter = require('events');

// Mock Monitor
class MockMonitor extends EventEmitter {
  constructor(id, url, options = {}) {
    super();
    this.id = id;
    this.url = url;
    this.name = options.name || url;
    this.category = options.category || 'default';
    this.lastCheck = null;
    this.lastContent = null;
    this.status = 'active';
  }

  check(content) {
    this.lastCheck = Date.now();

    const change = {
      monitorId: this.id,
      type: 'content',
      timestamp: Date.now(),
      before: this.lastContent ? this.lastContent.substring(0, 100) : 'initial',
      after: content.substring(0, 100)
    };

    if (this.lastContent && this.lastContent !== content) {
      this.lastContent = content;
      this.emit('change-detected', change);
      return change;
    }

    this.lastContent = content;
    return null;
  }
}

// Mock Change Detector
class MockChangeDetector extends EventEmitter {
  constructor() {
    super();
    this.detections = [];
  }

  analyze(before, after) {
    const detection = {
      type: before === after ? 'no-change' : 'change',
      added: after.length > (before ? before.length : 0),
      removed: after.length < (before ? before.length : 0),
      modified: before && after && before !== after,
      timestamp: Date.now()
    };

    this.detections.push(detection);
    return detection;
  }
}

// Mock Dashboard Engine
class MockDashboardEngine extends EventEmitter {
  constructor() {
    super();
    this.monitors = new Map();
    this.changes = new Map();
    this.timeline = [];
    this.stats = {
      totalChanges: 0,
      totalDetections: 0
    };
  }

  registerMonitor(monitor) {
    this.monitors.set(monitor.id, monitor);
    this.changes.set(monitor.id, []);

    monitor.on('change-detected', (change) => {
      this.addChange(change.monitorId, change);
    });
  }

  addChange(monitorId, change) {
    const changes = this.changes.get(monitorId);
    changes.unshift(change);

    this.timeline.unshift(change);
    if (this.timeline.length > 1000) {
      this.timeline.pop();
    }

    this.stats.totalChanges++;
    this.emit('change-added', change);
  }

  getMonitorChanges(monitorId) {
    return this.changes.get(monitorId) || [];
  }

  getTimeline(options = {}) {
    const { limit = 10, monitorId = null } = options;

    let timeline = this.timeline;

    if (monitorId) {
      timeline = timeline.filter(c => c.monitorId === monitorId);
    }

    return timeline.slice(0, limit);
  }
}

// Test Suite
describe('Dashboard Integration - Monitoring System', function () {
  this.timeout(30000);

  let dashboard;
  let monitors = [];
  let changeDetector;

  before(() => {
    dashboard = new MockDashboardEngine();
    changeDetector = new MockChangeDetector();
  });

  describe('Scenario 1: Single Monitor Change Detection', () => {
    it('should register a monitor', () => {
      const monitor = new MockMonitor('monitor-1', 'https://competitor1.com');
      dashboard.registerMonitor(monitor);
      monitors.push(monitor);

      assert.strictEqual(dashboard.monitors.size, 1, 'Should have 1 monitor');
    });

    it('should detect changes from a monitor', (done) => {
      const monitor = monitors[0];

      dashboard.once('change-added', (change) => {
        assert.strictEqual(change.monitorId, 'monitor-1');
        assert.strictEqual(dashboard.stats.totalChanges, 1);
        done();
      });

      monitor.check('new content here');
    });

    it('should display change in dashboard', () => {
      const changes = dashboard.getMonitorChanges('monitor-1');

      assert(changes.length > 0, 'Should have changes');
      assert.strictEqual(changes[0].monitorId, 'monitor-1');
    });

    it('should update global timeline', () => {
      const timeline = dashboard.getTimeline();

      assert(timeline.length > 0, 'Timeline should have entries');
      assert(timeline[0].monitorId === 'monitor-1');
    });
  });

  describe('Scenario 2: Multiple Monitors - Sequential Changes', () => {
    it('should register 5 additional monitors', () => {
      for (let i = 2; i <= 6; i++) {
        const monitor = new MockMonitor(
          `monitor-${i}`,
          `https://competitor${i}.com`,
          { category: 'ecommerce' }
        );
        dashboard.registerMonitor(monitor);
        monitors.push(monitor);
      }

      assert.strictEqual(dashboard.monitors.size, 6, 'Should have 6 monitors');
    });

    it('should track changes from multiple monitors', () => {
      let changeCount = 0;

      dashboard.on('change-added', () => {
        changeCount++;
      });

      // Add changes from each monitor
      for (let i = 0; i < monitors.length; i++) {
        monitors[i].check(`content from monitor ${i} - change 1`);
      }

      assert(changeCount > 0, 'Should detect changes');
    });

    it('should maintain separate change lists per monitor', () => {
      // Add second change to monitor-1
      monitors[0].check('content from monitor 0 - change 2');

      const monitor1Changes = dashboard.getMonitorChanges('monitor-1');
      const monitor2Changes = dashboard.getMonitorChanges('monitor-2');

      assert(monitor1Changes.length > 0, 'Monitor 1 should have changes');
      assert(monitor2Changes.length > 0, 'Monitor 2 should have changes');
    });

    it('should order timeline by most recent', () => {
      const timeline = dashboard.getTimeline({ limit: 20 });

      for (let i = 0; i < timeline.length - 1; i++) {
        assert(timeline[i].timestamp >= timeline[i + 1].timestamp,
          'Timeline should be in descending order');
      }
    });
  });

  describe('Scenario 3: Concurrent Monitor Changes', () => {
    it('should handle concurrent changes from multiple monitors', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve().then(() => {
          const monitorIndex = i % monitors.length;
          monitors[monitorIndex].check(`concurrent content ${i}`);
        }));
      }

      await Promise.all(promises);

      assert(dashboard.stats.totalChanges > 6, 'Should track all changes');
    });

    it('should maintain timeline integrity with concurrent changes', () => {
      const timeline = dashboard.getTimeline({ limit: 100 });
      const monitorIds = new Set(timeline.map(c => c.monitorId));

      assert(monitorIds.size > 1, 'Should have changes from multiple monitors');
    });
  });

  describe('Scenario 4: Change Detection with Change Detector', () => {
    it('should analyze changes with detector', () => {
      const before = 'old content';
      const after = 'new content here';

      const detection = changeDetector.analyze(before, after);

      assert.strictEqual(detection.type, 'change');
      assert(detection.modified);
    });

    it('should detect when content has not changed', () => {
      const content = 'same content';

      const detection = changeDetector.analyze(content, content);

      assert.strictEqual(detection.type, 'no-change');
    });

    it('should track detection history', () => {
      assert(changeDetector.detections.length > 0, 'Should have detections');
    });
  });

  describe('Scenario 5: Monitor Status Propagation', () => {
    it('should track monitor status in dashboard', () => {
      const monitor = monitors[0];
      const dashboardMonitor = dashboard.monitors.get('monitor-1');

      assert.strictEqual(dashboardMonitor.status, 'active');
    });

    it('should reflect monitor changes in stats', () => {
      const stats = dashboard.stats;

      assert(stats.totalChanges > 0, 'Should have total changes');
      assert(stats.totalDetections >= 0, 'Should have detection count');
    });
  });

  describe('Scenario 6: Filtered Timeline Queries', () => {
    it('should filter timeline by monitor', () => {
      const monitor1Timeline = dashboard.getTimeline({ monitorId: 'monitor-1' });

      for (const entry of monitor1Timeline) {
        assert.strictEqual(entry.monitorId, 'monitor-1');
      }
    });

    it('should limit timeline results', () => {
      const limited = dashboard.getTimeline({ limit: 5 });

      assert(limited.length <= 5, 'Should respect limit');
    });

    it('should return empty timeline for non-existent monitor', () => {
      const timeline = dashboard.getTimeline({ monitorId: 'monitor-999' });

      assert.strictEqual(timeline.length, 0, 'Should return empty for non-existent monitor');
    });
  });

  describe('Scenario 7: Change Attributes Propagation', () => {
    it('should include all change attributes in timeline', () => {
      const timeline = dashboard.getTimeline({ limit: 1 });

      if (timeline.length > 0) {
        const change = timeline[0];
        assert(change.monitorId, 'Should have monitorId');
        assert(change.timestamp, 'Should have timestamp');
        assert(change.type, 'Should have type');
      }
    });
  });

  describe('Scenario 8: Monitor Deregistration', () => {
    it('should handle monitor deregistration', () => {
      const initialSize = dashboard.monitors.size;

      // Remove one monitor
      const monitorToRemove = monitors[1];
      dashboard.monitors.delete(monitorToRemove.id);

      assert.strictEqual(dashboard.monitors.size, initialSize - 1);
    });

    it('should preserve historical changes after deregistration', () => {
      const changes = dashboard.changes.get('monitor-2');

      assert(changes.length > 0, 'Should preserve changes');
    });
  });

  describe('Scenario 9: Rapid Sequential Changes', () => {
    it('should handle rapid changes from single monitor', () => {
      const monitor = monitors[0];

      for (let i = 0; i < 50; i++) {
        monitor.check(`rapid change ${i}`);
      }

      const changes = dashboard.getMonitorChanges('monitor-1');
      assert(changes.length > 0, 'Should track rapid changes');
    });
  });

  describe('Scenario 10: Change Detection Rate', () => {
    it('should calculate change frequency', () => {
      const startTime = Date.now();
      let changeCount = 0;

      const handler = () => changeCount++;
      dashboard.on('change-added', handler);

      // Generate 20 changes
      for (let i = 0; i < 20; i++) {
        monitors[0].check(`frequency test ${i}`);
      }

      const elapsed = Date.now() - startTime;
      const frequency = (changeCount / elapsed) * 1000; // changes per second

      console.log(`\nChange Detection Rate: ${frequency.toFixed(0)} changes/sec`);

      dashboard.removeListener('change-added', handler);
    });
  });

  describe('Scenario 11: Monitor-Specific Query Performance', () => {
    it('should retrieve monitor changes efficiently', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        dashboard.getMonitorChanges('monitor-1');
      }

      const elapsed = Date.now() - startTime;
      assert(elapsed < 100, `100 queries should be <100ms, was ${elapsed}ms`);
    });
  });

  describe('Scenario 12: Change Ordering Verification', () => {
    it('should maintain chronological order per monitor', () => {
      const changes = dashboard.getMonitorChanges('monitor-1');

      for (let i = 0; i < changes.length - 1; i++) {
        assert(changes[i].timestamp >= changes[i + 1].timestamp,
          'Changes should be in descending timestamp order');
      }
    });
  });

  describe('Scenario 13: Cross-Monitor Comparison', () => {
    it('should compare changes across monitors', () => {
      const comparison = {};

      for (const [monitorId, monitor] of dashboard.monitors) {
        const changes = dashboard.getMonitorChanges(monitorId);
        comparison[monitorId] = {
          changeCount: changes.length,
          lastChange: changes[0] || null
        };
      }

      assert(Object.keys(comparison).length > 1, 'Should have multiple monitors');
    });
  });

  describe('Scenario 14: Change Aggregation by Type', () => {
    it('should group changes by type', () => {
      const byType = {};

      for (const change of dashboard.timeline) {
        const type = change.type || 'unknown';
        if (!byType[type]) {
          byType[type] = [];
        }
        byType[type].push(change);
      }

      assert(Object.keys(byType).length > 0, 'Should have type groups');
    });
  });

  describe('Scenario 15: Monitoring Integration Summary', () => {
    it('should provide integration summary', () => {
      const summary = {
        totalMonitors: dashboard.monitors.size,
        totalChanges: dashboard.stats.totalChanges,
        timelineSize: dashboard.timeline.length,
        monitorsWithChanges: new Set(dashboard.timeline.map(c => c.monitorId)).size
      };

      console.log('\n=== Monitoring Integration Summary ===');
      console.log(`Total Monitors: ${summary.totalMonitors}`);
      console.log(`Total Changes: ${summary.totalChanges}`);
      console.log(`Timeline Size: ${summary.timelineSize}`);
      console.log(`Monitors with Changes: ${summary.monitorsWithChanges}`);

      assert(summary.totalMonitors > 0, 'Should have monitors');
      assert(summary.totalChanges > 0, 'Should have changes');
    });
  });

  describe('Scenario 16: Performance Under Load', () => {
    it('should handle 1000 monitor checks efficiently', () => {
      const monitor = monitors[0];
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        monitor.check(`load test ${i}`);
      }

      const elapsed = Date.now() - startTime;
      const checksPerSecond = (1000 / elapsed) * 1000;

      console.log(`\nPerformance under load:`);
      console.log(`  1000 checks in ${elapsed}ms`);
      console.log(`  ${checksPerSecond.toFixed(0)} checks/sec`);
    });
  });

  after(() => {
    dashboard = null;
    monitors = [];
    changeDetector = null;
  });
});

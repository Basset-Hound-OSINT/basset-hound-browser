/**
 * Dashboard Unit Tests
 * Comprehensive test suite for dashboard engine, aggregator, and alert manager
 * @module tests/unit/dashboard.test.js
 */

const {
  DashboardEngine,
  DASHBOARD_STATUS,
  METRIC_TYPES,
  VIEW_TYPES,
  CHANGE_CATEGORIES
} = require('../../src/dashboard/dashboard-engine');

const {
  DataAggregator,
  AGGREGATION_SCOPES,
  TIME_BUCKETS
} = require('../../src/dashboard/aggregator');

const {
  AlertManager,
  ALERT_SEVERITY,
  ALERT_STATUS,
  ALERT_TYPE
} = require('../../src/dashboard/alert-manager');

describe('DashboardEngine', () => {
  let dashboard;

  beforeEach(() => {
    dashboard = new DashboardEngine();
  });

  afterEach(() => {
    dashboard.destroy();
  });

  describe('Monitor Management', () => {
    test('should register a monitor', () => {
      const monitor = {
        id: 'monitor1',
        url: 'https://competitor.com',
        name: 'Competitor A'
      };

      dashboard.registerMonitor(monitor);

      expect(dashboard.monitors.has('monitor1')).toBe(true);
      const registered = dashboard.monitors.get('monitor1');
      expect(registered.name).toBe('Competitor A');
      expect(registered.changeCount).toBe(0);
    });

    test('should throw on invalid monitor registration', () => {
      expect(() => {
        dashboard.registerMonitor({ name: 'Test' }); // Missing id and url
      }).toThrow();
    });

    test('should unregister a monitor', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://competitor.com',
        name: 'Test'
      });

      dashboard.unregisterMonitor('monitor1');

      expect(dashboard.monitors.has('monitor1')).toBe(false);
      expect(dashboard.changes.has('monitor1')).toBe(false);
    });
  });

  describe('Change Management', () => {
    test('should add a change to timeline', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://competitor.com',
        name: 'Test'
      });

      const change = {
        type: 'content',
        description: 'Price changed',
        category: CHANGE_CATEGORIES.CONTENT
      };

      const added = dashboard.addChange('monitor1', change);

      expect(added.id).toBeDefined();
      expect(added.monitorId).toBe('monitor1');
      expect(dashboard.timeline.length).toBe(1);
      expect(dashboard.stats.totalChanges).toBe(1);
    });

    test('should throw on unregistered monitor', () => {
      expect(() => {
        dashboard.addChange('nonexistent', { type: 'test' });
      }).toThrow('Monitor nonexistent not registered');
    });

    test('should maintain change history per monitor', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test.com',
        name: 'Test'
      });

      for (let i = 0; i < 5; i++) {
        dashboard.addChange('monitor1', {
          type: 'content',
          description: `Change ${i}`
        });
      }

      const changes = dashboard.changes.get('monitor1');
      expect(changes.length).toBe(5);
    });

    test('should update monitor metadata on change', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test.com',
        name: 'Test'
      });

      dashboard.addChange('monitor1', { type: 'test' });

      const monitor = dashboard.monitors.get('monitor1');
      expect(monitor.changeCount).toBe(1);
      expect(monitor.lastChange).toBeDefined();
    });
  });

  describe('Timeline', () => {
    beforeEach(() => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test1.com',
        name: 'Test1'
      });
      dashboard.registerMonitor({
        id: 'monitor2',
        url: 'https://test2.com',
        name: 'Test2'
      });

      for (let i = 0; i < 10; i++) {
        dashboard.addChange('monitor1', {
          type: 'content',
          category: i % 2 === 0 ? CHANGE_CATEGORIES.CONTENT : CHANGE_CATEGORIES.STRUCTURE
        });
      }
      for (let i = 0; i < 5; i++) {
        dashboard.addChange('monitor2', {
          type: 'technology',
          category: CHANGE_CATEGORIES.TECHNOLOGY
        });
      }
    });

    test('should retrieve complete timeline', () => {
      const timeline = dashboard.getTimeline({ limit: 100 });

      expect(timeline.entries.length).toBe(15);
      expect(timeline.total).toBe(15);
    });

    test('should filter timeline by monitor', () => {
      const timeline = dashboard.getTimeline({ monitorId: 'monitor1' });

      expect(timeline.entries.every(e => e.monitorId === 'monitor1')).toBe(true);
      expect(timeline.total).toBe(10);
    });

    test('should filter timeline by category', () => {
      const timeline = dashboard.getTimeline({
        category: CHANGE_CATEGORIES.CONTENT
      });

      expect(timeline.entries.every(e => e.category === CHANGE_CATEGORIES.CONTENT)).toBe(true);
      expect(timeline.total).toBe(5);
    });

    test('should support pagination', () => {
      const page1 = dashboard.getTimeline({ limit: 5, offset: 0 });
      const page2 = dashboard.getTimeline({ limit: 5, offset: 5 });

      expect(page1.entries.length).toBe(5);
      expect(page2.entries.length).toBe(5);
      expect(page1.hasMore).toBe(true);
    });
  });

  describe('Comparison', () => {
    beforeEach(() => {
      for (let i = 1; i <= 3; i++) {
        dashboard.registerMonitor({
          id: `monitor${i}`,
          url: `https://test${i}.com`,
          name: `Test${i}`
        });

        for (let j = 0; j < i * 2; j++) {
          dashboard.addChange(`monitor${i}`, {
            type: 'change',
            category: CHANGE_CATEGORIES.CONTENT
          });
        }
      }
    });

    test('should compare multiple monitors', () => {
      const comparison = dashboard.getComparison(['monitor1', 'monitor2']);

      expect(comparison.monitors).toHaveProperty('monitor1');
      expect(comparison.monitors).toHaveProperty('monitor2');
      expect(comparison.summary.totalChanges).toBeGreaterThan(0);
    });

    test('should identify most active monitor', () => {
      const comparison = dashboard.getComparison(['monitor1', 'monitor2', 'monitor3']);

      expect(comparison.summary.mostActive).toBe('monitor3');
      expect(comparison.summary.leastActive).toBe('monitor1');
    });

    test('should calculate change frequency', () => {
      const comparison = dashboard.getComparison(['monitor1', 'monitor2']);

      const m1Stats = comparison.monitors['monitor1'];
      const m2Stats = comparison.monitors['monitor2'];

      expect(m1Stats.changeCount).toBeLessThan(m2Stats.changeCount);
    });
  });

  describe('Metrics', () => {
    test('should initialize default metrics', () => {
      expect(dashboard.metrics.has(METRIC_TYPES.CHANGE_COUNT)).toBe(true);
      expect(dashboard.metrics.has(METRIC_TYPES.ALERT_COUNT)).toBe(true);
      expect(dashboard.metrics.has(METRIC_TYPES.DETECTION_RATE)).toBe(true);
    });

    test('should update change count metric', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test.com',
        name: 'Test'
      });

      dashboard.addChange('monitor1', { type: 'test' });
      dashboard.addChange('monitor1', { type: 'test' });

      const metric = dashboard.metrics.get(METRIC_TYPES.CHANGE_COUNT);
      expect(metric.value).toBe(2);
    });

    test('should aggregate metrics', () => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test.com',
        name: 'Test'
      });

      for (let i = 0; i < 5; i++) {
        dashboard.addChange('monitor1', { type: 'test' });
      }

      const aggregation = dashboard.aggregate();

      expect(aggregation.timestamp).toBeDefined();
      expect(aggregation.changes).toBeDefined();
      expect(dashboard.stats.lastAggregation).toBe(aggregation.timestamp);
    });

    test('should retrieve metrics by type', () => {
      const metrics = dashboard.getMetrics([METRIC_TYPES.CHANGE_COUNT]);

      expect(metrics.metrics).toHaveProperty(METRIC_TYPES.CHANGE_COUNT);
      expect(metrics.metrics).not.toHaveProperty(METRIC_TYPES.ALERT_COUNT);
    });
  });

  describe('Views', () => {
    beforeEach(() => {
      dashboard.registerMonitor({
        id: 'monitor1',
        url: 'https://test.com',
        name: 'Test'
      });
    });

    test('should create a view', () => {
      const view = dashboard.createView('view1', {
        type: VIEW_TYPES.OVERVIEW,
        monitorIds: ['monitor1']
      });

      expect(view.id).toBe('view1');
      expect(view.type).toBe(VIEW_TYPES.OVERVIEW);
    });

    test('should reject invalid view type', () => {
      expect(() => {
        dashboard.createView('view1', {
          type: 'invalid_type',
          monitorIds: ['monitor1']
        });
      }).toThrow('Invalid view type');
    });

    test('should retrieve view with content', () => {
      dashboard.createView('view1', {
        type: VIEW_TYPES.OVERVIEW,
        monitorIds: ['monitor1']
      });

      const view = dashboard.getView('view1');

      expect(view).toBeDefined();
      expect(view.content).toBeDefined();
    });

    test('should render different view types', () => {
      dashboard.registerMonitor({
        id: 'monitor2',
        url: 'https://test2.com',
        name: 'Test2'
      });

      dashboard.createView('timeline-view', {
        type: VIEW_TYPES.TIMELINE,
        monitorIds: ['monitor1']
      });

      dashboard.createView('comparison-view', {
        type: VIEW_TYPES.COMPARISON,
        monitorIds: ['monitor1', 'monitor2']
      });

      const tlView = dashboard.getView('timeline-view');
      const compView = dashboard.getView('comparison-view');

      expect(tlView.content.entries).toBeDefined();
      expect(compView.content.monitors).toBeDefined();
    });
  });

  describe('WebSocket Subscriptions', () => {
    test('should subscribe WebSocket connection', () => {
      const mockWs = { readyState: 1 };

      dashboard.subscribe(mockWs);

      expect(dashboard.subscribers.has(mockWs)).toBe(true);
    });

    test('should unsubscribe WebSocket connection', () => {
      const mockWs = { readyState: 1 };

      dashboard.subscribe(mockWs);
      dashboard.unsubscribe(mockWs);

      expect(dashboard.subscribers.has(mockWs)).toBe(false);
    });

    test('should broadcast updates to subscribers', () => {
      const mockWs = {
        readyState: 1,
        send: jest.fn()
      };

      dashboard.subscribe(mockWs);

      const count = dashboard.broadcastUpdate({ type: 'test' });

      expect(count).toBe(1);
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
});

describe('DataAggregator', () => {
  let aggregator;

  beforeEach(() => {
    aggregator = new DataAggregator();
  });

  describe('Aggregation', () => {
    test('should aggregate by category', () => {
      const changes = [
        { category: 'content', timestamp: Date.now() },
        { category: 'content', timestamp: Date.now() },
        { category: 'technology', timestamp: Date.now() }
      ];

      aggregator.indexMonitorChanges('monitor1', changes);
      const result = aggregator.aggregateByCategory();

      expect(result.categories).toHaveProperty('content');
      expect(result.categories).toHaveProperty('technology');
      expect(result.categories.content.count).toBe(2);
    });

    test('should aggregate by monitor', () => {
      const changes = [
        { category: 'content', timestamp: Date.now() },
        { category: 'content', timestamp: Date.now() }
      ];

      aggregator.indexMonitorChanges('monitor1', changes);
      const result = aggregator.aggregateByMonitor(['monitor1']);

      expect(result.monitors).toHaveProperty('monitor1');
      expect(result.monitors.monitor1.count).toBe(2);
    });

    test('should aggregate by time bucket', () => {
      const now = Date.now();
      const changes = [
        { category: 'content', timestamp: now },
        { category: 'content', timestamp: now + 1000 },
        { category: 'content', timestamp: now + 2000 }
      ];

      aggregator.indexMonitorChanges('monitor1', changes);
      const result = aggregator.aggregateByTime('daily');

      expect(result.buckets).toBeDefined();
      expect(Object.keys(result.buckets).length).toBeGreaterThan(0);
    });

    test('should aggregate by severity', () => {
      const changes = [
        { category: 'content', severity: 'critical', timestamp: Date.now() },
        { category: 'content', severity: 'high', timestamp: Date.now() },
        { category: 'content', severity: 'low', timestamp: Date.now() }
      ];

      aggregator.indexMonitorChanges('monitor1', changes);
      const result = aggregator.aggregateBySeverity();

      expect(result.severities.critical.count).toBe(1);
      expect(result.severities.high.count).toBe(1);
      expect(result.severities.low.count).toBe(1);
    });
  });

  describe('Caching', () => {
    test('should cache aggregation results', () => {
      const changes = [
        { category: 'content', timestamp: Date.now() }
      ];

      aggregator.indexMonitorChanges('monitor1', changes);
      aggregator.invalidateCache(); // Reset for clean test

      aggregator.aggregateByCategory();
      const statsBefore = aggregator.getStats();

      aggregator.aggregateByCategory();
      const statsAfter = aggregator.getStats();

      expect(statsAfter.cacheHits).toBeGreaterThan(statsBefore.cacheHits);
    });

    test('should invalidate cache on new data', () => {
      const changes1 = [{ category: 'content', timestamp: Date.now() }];
      aggregator.indexMonitorChanges('monitor1', changes1);

      const result1 = aggregator.aggregateByCategory();

      const changes2 = [{ category: 'technology', timestamp: Date.now() }];
      aggregator.indexMonitorChanges('monitor2', changes2);

      const result2 = aggregator.aggregateByCategory();

      expect(result2.summary.totalChanges).toBeGreaterThan(result1.summary.totalChanges);
    });
  });

  describe('Statistics', () => {
    test('should calculate stats correctly', () => {
      const changes = [
        { category: 'content', timestamp: 1000 },
        { category: 'content', timestamp: 2000 },
        { category: 'content', timestamp: 3000 }
      ];

      const stats = aggregator.calculateStats(changes);

      expect(stats.count).toBe(3);
      expect(stats.min).toBe(1000);
      expect(stats.max).toBe(3000);
    });
  });
});

describe('AlertManager', () => {
  let alertManager;

  beforeEach(() => {
    alertManager = new AlertManager();
  });

  afterEach(() => {
    alertManager.destroy();
  });

  describe('Alert Creation', () => {
    test('should create an alert', () => {
      const alert = alertManager.createAlert({
        monitorId: 'monitor1',
        title: 'Price Changed',
        message: 'Price dropped by 10%',
        severity: ALERT_SEVERITY.HIGH,
        type: ALERT_TYPE.CHANGE_DETECTED
      });

      expect(alert.id).toBeDefined();
      expect(alert.monitorId).toBe('monitor1');
      expect(alert.status).toBe(ALERT_STATUS.NEW);
      expect(alert.read).toBe(false);
    });

    test('should throw on missing required fields', () => {
      expect(() => {
        alertManager.createAlert({ title: 'Test' }); // Missing monitorId
      }).toThrow();
    });

    test('should throw on invalid severity', () => {
      expect(() => {
        alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Test',
          severity: 'invalid'
        });
      }).toThrow('Invalid severity');
    });
  });

  describe('Alert Status Operations', () => {
    let alert;

    beforeEach(() => {
      alert = alertManager.createAlert({
        monitorId: 'monitor1',
        title: 'Test Alert'
      });
    });

    test('should mark alert as read', () => {
      alertManager.markAsRead(alert.id);
      const updated = alertManager.getAlert(alert.id);

      expect(updated.read).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    test('should acknowledge alert', () => {
      alertManager.acknowledgeAlert(alert.id);
      const updated = alertManager.getAlert(alert.id);

      expect(updated.acknowledged).toBe(true);
      expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    });

    test('should dismiss alert', () => {
      alertManager.dismissAlert(alert.id);
      const updated = alertManager.getAlert(alert.id);

      expect(updated.dismissed).toBe(true);
      expect(updated.status).toBe(ALERT_STATUS.DISMISSED);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        alertManager.createAlert({
          monitorId: 'monitor1',
          title: `Alert ${i}`
        });
      }
    });

    test('should batch mark as read', () => {
      const alertIds = Array.from(alertManager.alerts.keys()).slice(0, 3);
      const updated = alertManager.batchMarkAsRead(alertIds);

      expect(updated.length).toBe(3);
      expect(updated.every(a => a.read)).toBe(true);
    });

    test('should batch acknowledge', () => {
      const alertIds = Array.from(alertManager.alerts.keys()).slice(0, 3);
      const updated = alertManager.batchAcknowledge(alertIds);

      expect(updated.length).toBe(3);
      expect(updated.every(a => a.acknowledged)).toBe(true);
    });

    test('should batch dismiss', () => {
      const alertIds = Array.from(alertManager.alerts.keys()).slice(0, 3);
      const updated = alertManager.batchDismiss(alertIds);

      expect(updated.length).toBe(3);
      expect(updated.every(a => a.dismissed)).toBe(true);
    });
  });

  describe('Alert Filtering', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        const severity = i % 2 === 0 ? ALERT_SEVERITY.HIGH : ALERT_SEVERITY.LOW;
        alertManager.createAlert({
          monitorId: i < 3 ? 'monitor1' : 'monitor2',
          title: `Alert ${i}`,
          severity
        });
      }
    });

    test('should filter by monitor', () => {
      const alerts = alertManager.getMonitorAlerts('monitor1');

      expect(alerts.alerts.length).toBe(3);
      expect(alerts.alerts.every(a => a.monitorId === 'monitor1')).toBe(true);
    });

    test('should filter by severity', () => {
      const alerts = alertManager.getAlertsBySeverity(ALERT_SEVERITY.HIGH);

      expect(alerts.alerts.every(a => a.severity === ALERT_SEVERITY.HIGH)).toBe(true);
    });

    test('should filter by status', () => {
      const alertIds = Array.from(alertManager.alerts.keys()).slice(0, 2);
      alertManager.batchAcknowledge(alertIds);

      const alerts = alertManager.getAlertsByStatus(ALERT_STATUS.ACKNOWLEDGED);

      expect(alerts.alerts.every(a => a.status === ALERT_STATUS.ACKNOWLEDGED)).toBe(true);
    });

    test('should get unread alerts', () => {
      const unread = alertManager.getUnreadAlerts();

      expect(unread.alerts.every(a => !a.read)).toBe(true);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        alertManager.createAlert({
          monitorId: 'monitor1',
          title: `Alert ${i}`,
          severity: i === 0 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.MEDIUM
        });
      }
    });

    test('should calculate summary statistics', () => {
      const summary = alertManager.getSummary();

      expect(summary.totalAlerts).toBe(3);
      expect(summary.unreadCount).toBe(3);
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byStatus).toBeDefined();
    });

    test('should update statistics on status changes', () => {
      const alertId = Array.from(alertManager.alerts.keys())[0];
      alertManager.markAsRead(alertId);

      const summary = alertManager.getSummary();

      expect(summary.unreadCount).toBe(2);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup expired alerts', () => {
      const alert = alertManager.createAlert({
        monitorId: 'monitor1',
        title: 'Test'
      });

      // Manually set expiry to past
      const stored = alertManager.getAlert(alert.id);
      stored.expiresAt = Date.now() - 1000;

      const removed = alertManager.cleanupExpired();

      expect(removed).toBe(1);
      expect(alertManager.getAlert(alert.id)).toBeNull();
    });
  });
});

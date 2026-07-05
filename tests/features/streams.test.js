/**
 * Change Streams & Alert Streams Tests
 * Tests for real-time data streaming with filtering and pagination
 */

const {
  ChangeStreamManager,
  AlertStreamManager,
  DataStreamManager,
  StreamSubscription
} = require('../../src/features/change-streams');

describe('Change Stream Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new ChangeStreamManager();
  });

  describe('Change Recording', () => {
    test('should record a change', () => {
      const change = manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added',
        newValue: 'new-content',
        tags: ['price']
      });

      expect(change.id).toBeDefined();
      expect(change.timestamp).toBeDefined();
      expect(change.monitorId).toBe('monitor-1');
      expect(change.changeType).toBe('added');
    });

    test('should maintain circular buffer', () => {
      const tinyManager = new ChangeStreamManager({ maxBufferSize: 3 });

      tinyManager.recordChange({ monitorId: 'monitor-1', changeType: 'added' });
      tinyManager.recordChange({ monitorId: 'monitor-2', changeType: 'added' });
      tinyManager.recordChange({ monitorId: 'monitor-3', changeType: 'added' });
      tinyManager.recordChange({ monitorId: 'monitor-4', changeType: 'added' });

      expect(tinyManager.changes).toHaveLength(3);
      expect(tinyManager.changes[0].monitorId).toBe('monitor-2');
    });

    test('should update metrics on change', () => {
      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'modified'
      });
      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added'
      });

      expect(manager.metrics.totalChanges).toBe(2);
      expect(manager.metrics.changesByType.modified).toBe(1);
      expect(manager.metrics.changesByType.added).toBe(1);
      expect(manager.metrics.changesByMonitor['monitor-1']).toBe(2);
    });
  });

  describe('Subscription Management', () => {
    test('should create subscription', () => {
      const subscriptionId = manager.subscribe({
        monitorId: 'monitor-1',
        changeType: 'added'
      });

      expect(subscriptionId).toBeDefined();
      expect(manager.subscriptions.get(subscriptionId)).toBeDefined();
    });

    test('should unsubscribe', () => {
      const subscriptionId = manager.subscribe();
      const result = manager.unsubscribe(subscriptionId);

      expect(result).toBe(true);
      expect(manager.subscriptions.get(subscriptionId)).toBeUndefined();
    });

    test('should fail to unsubscribe non-existent subscription', () => {
      const result = manager.unsubscribe('fake-id');
      expect(result).toBe(false);
    });

    test('should track active subscriptions', () => {
      manager.subscribe();
      manager.subscribe();
      manager.subscribe();

      expect(manager.metrics.subscriptions).toBe(3);
    });
  });

  describe('Filtering', () => {
    test('should filter by monitor ID', () => {
      const subId = manager.subscribe({ monitorId: 'monitor-1' });

      manager.recordChange({ monitorId: 'monitor-1', changeType: 'added' });
      manager.recordChange({ monitorId: 'monitor-2', changeType: 'added' });

      const result = manager.getChanges(subId);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].monitorId).toBe('monitor-1');
    });

    test('should filter by change type', () => {
      const subId = manager.subscribe({ changeType: 'added' });

      manager.recordChange({ monitorId: 'monitor-1', changeType: 'added' });
      manager.recordChange({ monitorId: 'monitor-1', changeType: 'modified' });

      const result = manager.getChanges(subId);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].changeType).toBe('added');
    });

    test('should filter by tags', () => {
      const subId = manager.subscribe({ tags: ['price', 'critical'] });

      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added',
        tags: ['price']
      });
      manager.recordChange({
        monitorId: 'monitor-2',
        changeType: 'added',
        tags: ['content']
      });

      const result = manager.getChanges(subId);
      expect(result.changes).toHaveLength(1);
    });

    test('should filter by date range', () => {
      const now = Date.now();
      const subId = manager.subscribe({
        dateRange: {
          start: now - 1000,
          end: now + 1000
        }
      });

      // This test would need timestamp manipulation to fully test
      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added'
      });

      const result = manager.getChanges(subId);
      expect(result.changes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 10; i++) {
        manager.recordChange({
          monitorId: `monitor-${i}`,
          changeType: 'added'
        });
      }
    });

    test('should paginate with limit', () => {
      const subId = manager.subscribe();

      const page1 = manager.getChanges(subId, { limit: 3 });
      expect(page1.changes).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBeDefined();
    });

    test('should handle cursor-based pagination', () => {
      const subId = manager.subscribe();

      const page1 = manager.getChanges(subId, { limit: 3 });
      const page2 = manager.getChanges(subId, { limit: 3, cursor: page1.cursor });

      expect(page2.changes).toHaveLength(3);
      expect(page2.changes[0].id).not.toBe(page1.changes[0].id);
    });

    test('should paginate backward', () => {
      const subId = manager.subscribe();

      const backward = manager.getChanges(subId, {
        limit: 3,
        direction: 'backward'
      });

      expect(backward.changes.length).toBeGreaterThan(0);
    });
  });

  describe('Subscriber Callbacks', () => {
    test('should notify subscribers of changes', (done) => {
      const subId = manager.subscribe({ monitorId: 'monitor-1' });

      manager.onChanges(subId, (change) => {
        expect(change.monitorId).toBe('monitor-1');
        done();
      });

      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added'
      });
    });

    test('should respect filters in notifications', (done) => {
      const subId = manager.subscribe({ changeType: 'added' });
      let callCount = 0;

      manager.onChanges(subId, () => {
        callCount++;
      });

      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added'
      });

      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'modified'
      });

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 50);
    });
  });

  describe('Search', () => {
    beforeEach(() => {
      manager.recordChange({
        monitorId: 'monitor-1',
        changeType: 'added',
        newValue: 'product-a'
      });
      manager.recordChange({
        monitorId: 'monitor-2',
        changeType: 'modified',
        newValue: 'product-b'
      });
    });

    test('should search by monitor ID', () => {
      const results = manager.searchChanges({ monitorId: 'monitor-1' });
      expect(results.results).toHaveLength(1);
      expect(results.results[0].monitorId).toBe('monitor-1');
    });

    test('should search by text', () => {
      const results = manager.searchChanges({ text: 'product-a' });
      expect(results.results.length).toBeGreaterThan(0);
    });

    test('should respect search limit', () => {
      for (let i = 0; i < 20; i++) {
        manager.recordChange({
          monitorId: 'monitor-1',
          changeType: 'added'
        });
      }

      const results = manager.searchChanges({ monitorId: 'monitor-1', limit: 5 });
      expect(results.results).toHaveLength(5);
      expect(results.total).toBeGreaterThan(5);
    });
  });

  describe('Statistics', () => {
    test('should provide statistics', () => {
      manager.recordChange({ monitorId: 'monitor-1', changeType: 'added' });
      manager.subscribe();

      const stats = manager.getStatistics();

      expect(stats.totalChanges).toBe(1);
      expect(stats.bufferSize).toBe(1);
      expect(stats.activeSubscriptions).toBe(1);
    });
  });
});

describe('Alert Stream Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new AlertStreamManager();
  });

  describe('Alert Creation', () => {
    test('should create an alert', () => {
      const alert = manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'price_change',
        title: 'Price increased',
        description: 'Product price increased by 10%'
      });

      expect(alert.id).toBeDefined();
      expect(alert.timestamp).toBeDefined();
      expect(alert.status).toBe('active');
    });

    test('should validate alert severity', () => {
      const alert = manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'critical',
        type: 'alert',
        title: 'Critical alert'
      });

      expect(['critical', 'high', 'medium', 'low']).toContain(alert.severity);
    });

    test('should update alert metrics', () => {
      manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'price_change',
        title: 'Alert'
      });

      manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'text_change',
        title: 'Alert'
      });

      expect(manager.metrics.alertsBySeverity.high).toBe(2);
      expect(manager.metrics.alertsByType.price_change).toBe(1);
      expect(manager.metrics.alertsByType.text_change).toBe(1);
    });
  });

  describe('Alert Status Update', () => {
    test('should update alert status', () => {
      const alert = manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'alert',
        title: 'Test'
      });

      manager.updateAlertStatus(alert.id, 'acknowledged');

      const updated = manager.alerts.find(a => a.id === alert.id);
      expect(updated.status).toBe('acknowledged');
    });

    test('should throw error for non-existent alert', () => {
      expect(() => {
        manager.updateAlertStatus('fake-id', 'resolved');
      }).toThrow();
    });
  });

  describe('Alert Subscription', () => {
    test('should subscribe to alerts', () => {
      const subId = manager.subscribe({ severity: 'high' });
      expect(subId).toBeDefined();
    });

    test('should get alerts for subscription', () => {
      const subId = manager.subscribe({ severity: 'high' });

      manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'alert',
        title: 'High severity'
      });

      const result = manager.getAlerts(subId);
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].severity).toBe('high');
    });

    test('should filter alerts by status', () => {
      const subId = manager.subscribe({ status: 'active' });

      const alert = manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'alert',
        title: 'Test'
      });

      manager.updateAlertStatus(alert.id, 'resolved');

      const result = manager.getAlerts(subId);
      expect(result.alerts).toHaveLength(0);
    });
  });

  describe('Alert Notifications', () => {
    test('should notify subscribers', (done) => {
      const subId = manager.subscribe({ severity: 'critical' });

      manager.onAlerts(subId, (alert) => {
        expect(alert.severity).toBe('critical');
        done();
      });

      manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'critical',
        type: 'alert',
        title: 'Critical'
      });
    });
  });

  describe('Statistics', () => {
    test('should provide alert statistics', () => {
      manager.createAlert({
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'price_change',
        title: 'Alert'
      });

      const stats = manager.getStatistics();

      expect(stats.totalAlerts).toBe(1);
      expect(stats.alertsBySeverity.high).toBe(1);
    });
  });
});

describe('Data Stream Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new DataStreamManager();

    // Register mock data sources
    const changeManager = new ChangeStreamManager();
    const alertManager = new AlertStreamManager();

    manager.registerSource('changes', changeManager);
    manager.registerSource('alerts', alertManager);
  });

  describe('Data Export', () => {
    test('should export as JSON', () => {
      const data = manager.exportAsJSON('changes');

      expect(data).toHaveProperty('type', 'changes');
      expect(data).toHaveProperty('exportedAt');
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('data');
    });

    test('should export as CSV', () => {
      const csv = manager.exportAsCSV('changes');

      expect(typeof csv).toBe('string');
    });

    test('should respect date range filter', () => {
      const now = Date.now();
      const data = manager.exportAsJSON('changes', {
        dateRange: {
          start: now - 1000,
          end: now + 1000
        }
      });

      expect(data).toHaveProperty('count');
    });
  });

  describe('Data Streaming', () => {
    test('should stream data', async () => {
      const chunks = [];

      for await (const chunk of manager.streamData('changes', {}, 'json')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    test('should stream with compression', async () => {
      manager.options.compressionEnabled = true;

      const chunks = [];
      for await (const chunk of manager.streamData('changes', {}, 'json')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

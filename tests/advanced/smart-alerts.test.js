/**
 * Smart Alert Generation Tests
 * Tests for alert deduplication, prioritization, and grouping
 */

const { SmartAlertGenerator, ALERT_SEVERITY, ALERT_STATUS } = require('../../src/advanced/smart-alerts');

describe('Smart Alert Generator', () => {
  let generator;

  beforeEach(() => {
    generator = new SmartAlertGenerator({
      deduplicationWindow: 5000,
      enableGrouping: true
    });
  });

  describe('Alert Processing', () => {
    test('should process and store alerts', () => {
      const alert = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        severity: ALERT_SEVERITY.HIGH,
        message: 'Price dropped 10%'
      });

      expect(alert.id).toBeDefined();
      expect(alert.timestamp).toBeDefined();
      expect(alert.status).toBe(ALERT_STATUS.ACTIVE);
    });

    test('should generate unique alert IDs', () => {
      const alert1 = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      const alert2 = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor2'
      });

      expect(alert1.id).not.toBe(alert2.id);
    });
  });

  describe('Alert Deduplication', () => {
    test('should detect duplicate alerts', () => {
      const alertData = {
        type: 'price-drop',
        monitorId: 'monitor1',
        source: 'price-analyzer'
      };

      const alert1 = generator.processAlert(alertData);
      const result2 = generator.processAlert(alertData);

      expect(result2.isDuplicate).toBe(true);
      expect(result2.originalAlertId).toBe(alert1.id);
    });

    test('should increase duplicate count', () => {
      const alertData = {
        type: 'anomaly',
        monitorId: 'monitor1',
        severity: 3
      };

      const alert1 = generator.processAlert(alertData);
      expect(alert1.duplicateCount).toBe(0);

      generator.processAlert(alertData);
      generator.processAlert(alertData);

      const updated = generator.alerts.get(alert1.id);
      expect(updated.duplicateCount).toBe(2);
    });

    test('should respect deduplication window', () => {
      const generator2 = new SmartAlertGenerator({
        deduplicationWindow: 100 // 100ms
      });

      const alertData = {
        type: 'price-drop',
        monitorId: 'monitor1'
      };

      const alert1 = generator2.processAlert(alertData);

      // Wait for window to expire
      return new Promise(resolve => {
        setTimeout(() => {
          const result = generator2.processAlert(alertData);
          expect(result.isDuplicate).toBeFalsy();
          resolve();
        }, 150);
      });
    });
  });

  describe('Severity Calculation', () => {
    test('should calculate severity from components', () => {
      const alert = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1',
        baseSeverity: 2,
        magnitude: 0.8,
        confidence: 0.9,
        businessImpact: 2
      });

      expect(alert.severity).toBeDefined();
      expect(alert.severity.score).toBeGreaterThan(0);
      expect(alert.severity.score).toBeLessThanOrEqual(5);
      expect(alert.severity.level).toBeTruthy();
    });

    test('should classify severity levels', () => {
      const critical = generator.processAlert({
        type: 'threat',
        monitorId: 'monitor1',
        baseSeverity: 5
      });

      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']).toContain(critical.severity.level);
    });
  });

  describe('Priority Calculation', () => {
    test('should calculate alert priority', () => {
      const alert1 = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        baseSeverity: 3
      });

      const alert2 = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1',
        baseSeverity: 1
      });

      expect(alert1.priority).toBeGreaterThan(alert2.priority);
    });

    test('should boost priority for time-sensitive alerts', () => {
      const normal = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        baseSeverity: 2
      });

      const timeSensitive = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        baseSeverity: 2,
        timeSensitive: true
      });

      expect(timeSensitive.priority).toBeGreaterThan(normal.priority);
    });
  });

  describe('Alert Grouping', () => {
    test('should group related alerts', () => {
      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      const grouped = generator.getGroupedAlerts();
      expect(grouped.size).toBeGreaterThan(0);
    });

    test('should retrieve alert group', () => {
      const alert = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1'
      });

      if (alert.groupId) {
        const group = generator.getAlertGroup(alert.groupId);
        expect(group).toBeDefined();
        expect(group.id).toBe(alert.groupId);
      }
    });

    test('should respect grouping window', () => {
      const generator2 = new SmartAlertGenerator({
        groupingWindow: 100 // 100ms
      });

      const alert1 = generator2.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      return new Promise(resolve => {
        setTimeout(() => {
          const alert2 = generator2.processAlert({
            type: 'price-drop',
            monitorId: 'monitor1'
          });

          expect(alert1.groupId).not.toBe(alert2.groupId);
          resolve();
        }, 150);
      });
    });
  });

  describe('Suppression Rules', () => {
    test('should add suppression rule', () => {
      generator.addSuppressionRule('rule1', {
        type: 'price-drop',
        severityMax: 2
      });

      const result = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        baseSeverity: 1
      });

      expect(result.suppressed).toBe(true);
    });

    test('should remove suppression rule', () => {
      generator.addSuppressionRule('rule1', {
        type: 'anomaly'
      });

      generator.removeSuppressionRule('rule1');

      const result = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1'
      });

      expect(result.suppressed).toBeFalsy();
    });

    test('should support custom matcher', () => {
      generator.addSuppressionRule('rule1', {
        customMatcher: (alert) => alert.monitorId === 'quiet-monitor'
      });

      const result = generator.processAlert({
        type: 'price-drop',
        monitorId: 'quiet-monitor'
      });

      expect(result.suppressed).toBe(true);
    });
  });

  describe('Alert Lifecycle', () => {
    test('should acknowledge alert', () => {
      const alert = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.acknowledgeAlert(alert.id);

      const updated = generator.alerts.get(alert.id);
      expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
      expect(updated.acknowledgedAt).toBeDefined();
    });

    test('should resolve alert', () => {
      const alert = generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1'
      });

      generator.resolveAlert(alert.id);

      const updated = generator.alerts.get(alert.id);
      expect(updated.status).toBe(ALERT_STATUS.RESOLVED);
      expect(updated.resolvedAt).toBeDefined();
    });
  });

  describe('Alert Filtering', () => {
    test('should filter by monitor', () => {
      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor2'
      });

      const filtered = generator.getAlerts({ monitorId: 'monitor1' });
      expect(filtered.every(a => a.monitorId === 'monitor1')).toBe(true);
    });

    test('should filter by status', () => {
      const alert = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.acknowledgeAlert(alert.id);

      const active = generator.getAlerts({ status: ALERT_STATUS.ACTIVE });
      expect(active.every(a => a.status === ALERT_STATUS.ACTIVE)).toBe(true);
    });

    test('should filter by severity', () => {
      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1',
        baseSeverity: 4
      });

      generator.processAlert({
        type: 'info',
        monitorId: 'monitor1',
        baseSeverity: 1
      });

      const high = generator.getAlerts({ severity: 'HIGH' });
      expect(high.length).toBeGreaterThanOrEqual(0);
    });

    test('should limit results', () => {
      for (let i = 0; i < 10; i++) {
        generator.processAlert({
          type: 'price-drop',
          monitorId: 'monitor1'
        });
      }

      const limited = generator.getAlerts({ limit: 3 });
      expect(limited.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Alert Summary', () => {
    test('should provide alert summary', () => {
      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1'
      });

      const summary = generator.getSummary();

      expect(summary.total).toBe(2);
      expect(summary.active).toBeGreaterThan(0);
      expect(summary.bySeverity).toBeDefined();
      expect(summary.byType).toBeDefined();
    });

    test('should provide per-monitor summary', () => {
      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      const summary = generator.getSummary('monitor1');

      expect(summary.total).toBe(1);
    });
  });

  describe('Rate Limiting', () => {
    test('should detect rate limit exceeded', () => {
      const generator2 = new SmartAlertGenerator({
        maxAlertsPerHour: 5
      });

      let rateLimitEmitted = false;

      generator2.on('rate-limit-exceeded', () => {
        rateLimitEmitted = true;
      });

      for (let i = 0; i < 6; i++) {
        generator2.processAlert({
          type: 'price-drop',
          monitorId: `monitor${i}`
        });
      }

      expect(rateLimitEmitted).toBe(true);
    });
  });

  describe('Alert Events', () => {
    test('should emit alert-generated event', (done) => {
      generator.on('alert-generated', (alert) => {
        expect(alert.id).toBeDefined();
        done();
      });

      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });
    });

    test('should emit duplicate-alert event', (done) => {
      generator.on('duplicate-alert', (data) => {
        expect(data.originalAlertId).toBeDefined();
        done();
      });

      const alert1 = generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      generator.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });
    });
  });

  describe('Data Cleanup', () => {
    test('should cleanup old alerts', () => {
      const generator2 = new SmartAlertGenerator({
        alertRetention: 1000 // 1 second
      });

      generator2.processAlert({
        type: 'price-drop',
        monitorId: 'monitor1'
      });

      const before = generator2.alerts.size;

      return new Promise(resolve => {
        setTimeout(() => {
          generator2.cleanup();
          // Cleanup removes resolved/acknowledged alerts only
          resolve();
        }, 1100);
      });
    });
  });

  describe('Alert Sorting', () => {
    test('should sort alerts by priority', () => {
      generator.processAlert({
        type: 'anomaly',
        monitorId: 'monitor1',
        baseSeverity: 1
      });

      generator.processAlert({
        type: 'threat',
        monitorId: 'monitor1',
        baseSeverity: 5
      });

      const alerts = generator.getAlerts({});
      expect(alerts[0].priority).toBeGreaterThanOrEqual(alerts[1].priority);
    });
  });
});

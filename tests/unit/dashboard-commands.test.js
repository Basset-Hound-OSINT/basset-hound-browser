/**
 * Dashboard WebSocket Commands Tests
 * Tests for dashboard command handlers
 * @module tests/unit/dashboard-commands.test.js
 */

const {
  DashboardEngine,
  VIEW_TYPES
} = require('../../src/dashboard/dashboard-engine');

const {
  AlertManager,
  ALERT_SEVERITY
} = require('../../src/dashboard/alert-manager');

const {
  registerDashboardCommands
} = require('../../websocket/commands/dashboard-commands');

describe('Dashboard Commands', () => {
  let dashboard;
  let alertManager;
  let commandHandlers;

  beforeEach(() => {
    dashboard = new DashboardEngine();
    alertManager = new AlertManager();
    commandHandlers = {};

    registerDashboardCommands(commandHandlers, dashboard, alertManager);

    // Register test monitors
    for (let i = 1; i <= 3; i++) {
      dashboard.registerMonitor({
        id: `monitor${i}`,
        url: `https://test${i}.com`,
        name: `Competitor ${i}`
      });

      // Add test changes
      for (let j = 0; j < i * 2; j++) {
        dashboard.addChange(`monitor${i}`, {
          type: 'content',
          description: `Change ${j}`,
          category: j % 2 === 0 ? 'content' : 'technology'
        });
      }
    }
  });

  afterEach(() => {
    dashboard.destroy();
    alertManager.destroy();
  });

  describe('get_dashboard_data', () => {
    test('should get complete dashboard data', async () => {
      const result = await commandHandlers.get_dashboard_data({});

      expect(result.success).toBe(true);
      expect(result.dashboard).toBeDefined();
      expect(result.dashboard.status).toBeDefined();
      expect(result.dashboard.metrics).toBeDefined();
      expect(result.dashboard.timeline).toBeDefined();
      expect(result.dashboard.overview).toBeDefined();
    });

    test('should filter dashboard data by monitor', async () => {
      const result = await commandHandlers.get_dashboard_data({
        monitorIds: ['monitor1']
      });

      expect(result.success).toBe(true);
      expect(result.dashboard.overview.monitors.length).toBe(1);
      expect(result.dashboard.overview.monitors[0].id).toBe('monitor1');
    });

    test('should include alerts in dashboard data', async () => {
      alertManager.createAlert({
        monitorId: 'monitor1',
        title: 'Test Alert'
      });

      const result = await commandHandlers.get_dashboard_data({});

      expect(result.success).toBe(true);
      expect(result.dashboard.alerts).toBeDefined();
      expect(result.dashboard.alerts.summary).toBeDefined();
    });
  });

  describe('get_monitor_changes', () => {
    test('should get monitor changes', async () => {
      const result = await commandHandlers.get_monitor_changes({
        monitor_id: 'monitor1'
      });

      expect(result.success).toBe(true);
      expect(result.monitor.id).toBe('monitor1');
      expect(result.changes).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
    });

    test('should return error for nonexistent monitor', async () => {
      const result = await commandHandlers.get_monitor_changes({
        monitor_id: 'nonexistent'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should support pagination', async () => {
      const result1 = await commandHandlers.get_monitor_changes({
        monitor_id: 'monitor3',
        options: { limit: 2, offset: 0 }
      });

      const result2 = await commandHandlers.get_monitor_changes({
        monitor_id: 'monitor3',
        options: { limit: 2, offset: 2 }
      });

      expect(result1.changes.length).toBeLessThanOrEqual(2);
      expect(result2.changes.length).toBeLessThanOrEqual(2);
    });

    test('should filter by category', async () => {
      const result = await commandHandlers.get_monitor_changes({
        monitor_id: 'monitor1',
        options: { category: 'content' }
      });

      expect(result.changes.every(c => c.category === 'content')).toBe(true);
    });
  });

  describe('get_competitor_comparison', () => {
    test('should compare two competitors', async () => {
      const result = await commandHandlers.get_competitor_comparison({
        monitor_ids: ['monitor1', 'monitor2']
      });

      expect(result.success).toBe(true);
      expect(result.comparison.monitors).toHaveProperty('monitor1');
      expect(result.comparison.monitors).toHaveProperty('monitor2');
    });

    test('should return error with less than 2 monitors', async () => {
      const result = await commandHandlers.get_competitor_comparison({
        monitor_ids: ['monitor1']
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should calculate comparison statistics', async () => {
      const result = await commandHandlers.get_competitor_comparison({
        monitor_ids: ['monitor1', 'monitor2', 'monitor3']
      });

      expect(result.comparison.summary.totalChanges).toBeGreaterThan(0);
      expect(result.comparison.summary.mostActive).toBeDefined();
      expect(result.comparison.summary.leastActive).toBeDefined();
    });
  });

  describe('get_dashboard_timeline', () => {
    test('should get dashboard timeline', async () => {
      const result = await commandHandlers.get_dashboard_timeline({});

      expect(result.success).toBe(true);
      expect(result.timeline).toBeDefined();
      expect(result.timeline.entries).toBeDefined();
    });

    test('should support pagination', async () => {
      const result = await commandHandlers.get_dashboard_timeline({
        limit: 5,
        offset: 0
      });

      expect(result.timeline.entries.length).toBeLessThanOrEqual(5);
    });

    test('should filter by category', async () => {
      const result = await commandHandlers.get_dashboard_timeline({
        category: 'content'
      });

      expect(result.timeline.entries.every(e => e.category === 'content')).toBe(true);
    });
  });

  describe('get_dashboard_metrics', () => {
    test('should get all metrics', async () => {
      const result = await commandHandlers.get_dashboard_metrics({});

      expect(result.success).toBe(true);
      expect(result.metrics.metrics).toBeDefined();
      expect(result.metrics.stats).toBeDefined();
    });

    test('should filter metrics by type', async () => {
      const result = await commandHandlers.get_dashboard_metrics({
        metricTypes: ['change_count']
      });

      expect(result.metrics.metrics).toHaveProperty('change_count');
    });
  });

  describe('Alert Commands', () => {
    describe('create_dashboard_alert', () => {
      test('should create an alert', async () => {
        const result = await commandHandlers.create_dashboard_alert({
          monitor_id: 'monitor1',
          title: 'Price Changed',
          severity: ALERT_SEVERITY.HIGH
        });

        expect(result.success).toBe(true);
        expect(result.alert.id).toBeDefined();
        expect(result.alert.title).toBe('Price Changed');
      });

      test('should require monitor_id and title', async () => {
        const result = await commandHandlers.create_dashboard_alert({
          title: 'Test'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('get_dashboard_alerts', () => {
      beforeEach(() => {
        alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Alert 1',
          severity: ALERT_SEVERITY.CRITICAL
        });
        alertManager.createAlert({
          monitorId: 'monitor2',
          title: 'Alert 2',
          severity: ALERT_SEVERITY.LOW
        });
      });

      test('should get all alerts', async () => {
        const result = await commandHandlers.get_dashboard_alerts({});

        expect(result.success).toBe(true);
        expect(result.alerts).toBeDefined();
      });

      test('should filter alerts by status', async () => {
        const result = await commandHandlers.get_dashboard_alerts({
          status: 'new'
        });

        expect(result.alerts.alerts.every(a => a.status === 'new')).toBe(true);
      });

      test('should filter alerts by severity', async () => {
        const result = await commandHandlers.get_dashboard_alerts({
          severity: 'critical'
        });

        expect(result.alerts.alerts.every(a => a.severity === 'critical')).toBe(true);
      });

      test('should filter alerts by monitor', async () => {
        const result = await commandHandlers.get_dashboard_alerts({
          monitor_id: 'monitor1'
        });

        expect(result.alerts.alerts.every(a => a.monitorId === 'monitor1')).toBe(true);
      });
    });

    describe('get_unread_alerts', () => {
      beforeEach(() => {
        const alerts = [];
        for (let i = 0; i < 5; i++) {
          alerts.push(alertManager.createAlert({
            monitorId: 'monitor1',
            title: `Alert ${i}`
          }));
        }
        // Mark some as read
        alertManager.markAsRead(alerts[0].id);
        alertManager.markAsRead(alerts[1].id);
      });

      test('should get unread alerts', async () => {
        const result = await commandHandlers.get_unread_alerts({});

        expect(result.success).toBe(true);
        expect(result.alerts.every(a => !a.read)).toBe(true);
      });
    });

    describe('mark_alert_read', () => {
      test('should mark alert as read', async () => {
        const alert = alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Test'
        });

        const result = await commandHandlers.mark_alert_read({
          alert_id: alert.id
        });

        expect(result.success).toBe(true);
        expect(result.alert.read).toBe(true);
      });

      test('should return error for invalid alert', async () => {
        const result = await commandHandlers.mark_alert_read({
          alert_id: 'nonexistent'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('batch_mark_alerts_read', () => {
      test('should batch mark alerts as read', async () => {
        const alerts = [];
        for (let i = 0; i < 3; i++) {
          alerts.push(alertManager.createAlert({
            monitorId: 'monitor1',
            title: `Alert ${i}`
          }));
        }

        const result = await commandHandlers.batch_mark_alerts_read({
          alert_ids: alerts.map(a => a.id)
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(3);
      });
    });

    describe('acknowledge_alert', () => {
      test('should acknowledge alert', async () => {
        const alert = alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Test'
        });

        const result = await commandHandlers.acknowledge_alert({
          alert_id: alert.id
        });

        expect(result.success).toBe(true);
        expect(result.alert.acknowledged).toBe(true);
      });
    });

    describe('batch_acknowledge_alerts', () => {
      test('should batch acknowledge alerts', async () => {
        const alerts = [];
        for (let i = 0; i < 3; i++) {
          alerts.push(alertManager.createAlert({
            monitorId: 'monitor1',
            title: `Alert ${i}`
          }));
        }

        const result = await commandHandlers.batch_acknowledge_alerts({
          alert_ids: alerts.map(a => a.id)
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(3);
      });
    });

    describe('dismiss_alert', () => {
      test('should dismiss alert', async () => {
        const alert = alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Test'
        });

        const result = await commandHandlers.dismiss_alert({
          alert_id: alert.id
        });

        expect(result.success).toBe(true);
        expect(result.alert.dismissed).toBe(true);
      });
    });

    describe('batch_dismiss_alerts', () => {
      test('should batch dismiss alerts', async () => {
        const alerts = [];
        for (let i = 0; i < 3; i++) {
          alerts.push(alertManager.createAlert({
            monitorId: 'monitor1',
            title: `Alert ${i}`
          }));
        }

        const result = await commandHandlers.batch_dismiss_alerts({
          alert_ids: alerts.map(a => a.id)
        });

        expect(result.success).toBe(true);
        expect(result.count).toBe(3);
      });
    });

    describe('get_alert_summary', () => {
      test('should get alert summary', async () => {
        alertManager.createAlert({
          monitorId: 'monitor1',
          title: 'Test'
        });

        const result = await commandHandlers.get_alert_summary({});

        expect(result.success).toBe(true);
        expect(result.summary).toBeDefined();
        expect(result.summary.totalAlerts).toBeGreaterThan(0);
      });
    });
  });

  describe('Dashboard Views', () => {
    describe('create_dashboard_view', () => {
      test('should create a view', async () => {
        const result = await commandHandlers.create_dashboard_view({
          view_id: 'test-view',
          type: VIEW_TYPES.OVERVIEW,
          monitor_ids: ['monitor1']
        });

        expect(result.success).toBe(true);
        expect(result.view.id).toBe('test-view');
        expect(result.view.type).toBe(VIEW_TYPES.OVERVIEW);
      });

      test('should reject invalid view type', async () => {
        const result = await commandHandlers.create_dashboard_view({
          view_id: 'test-view',
          type: 'invalid_type'
        });

        expect(result.success).toBe(false);
      });
    });

    describe('get_dashboard_view', () => {
      test('should get a view', async () => {
        await commandHandlers.create_dashboard_view({
          view_id: 'test-view',
          type: VIEW_TYPES.OVERVIEW,
          monitor_ids: ['monitor1']
        });

        const result = await commandHandlers.get_dashboard_view({
          view_id: 'test-view'
        });

        expect(result.success).toBe(true);
        expect(result.view.id).toBe('test-view');
        expect(result.view.content).toBeDefined();
      });

      test('should return error for nonexistent view', async () => {
        const result = await commandHandlers.get_dashboard_view({
          view_id: 'nonexistent'
        });

        expect(result.success).toBe(false);
      });
    });
  });

  describe('get_dashboard_status', () => {
    test('should get dashboard status', async () => {
      const result = await commandHandlers.get_dashboard_status({});

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status.monitors).toBeGreaterThan(0);
      expect(result.status.timeline).toBeGreaterThan(0);
    });
  });
});

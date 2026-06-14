/**
 * Dashboard Export Manager Tests
 */

const DashboardExportManager = require('../../src/dashboards/dashboard-export');
const DashboardService = require('../../src/dashboards/dashboard-service');
const MetricsAggregator = require('../../src/observability/metrics');

describe('DashboardExportManager', () => {
  let metricsAggregator;
  let dashboardService;
  let exportManager;

  beforeEach(() => {
    metricsAggregator = new MetricsAggregator();
    dashboardService = new DashboardService(metricsAggregator, {
      persistDashboards: false
    });
    exportManager = new DashboardExportManager(dashboardService);

    // Create test dashboard with metrics
    metricsAggregator.registerGauge('test_metric', { initialValue: 50 });
    dashboardService.createDashboard('test', {
      title: 'Test Dashboard',
      description: 'A test dashboard',
      widgets: [{ type: 'metric', metric: 'test_metric' }]
    });
    dashboardService.computeDashboardMetrics('test');
  });

  afterEach(() => {
    exportManager.close();
    dashboardService.close();
    metricsAggregator.close();
  });

  describe('PDF Export', () => {
    test('should export dashboard as PDF', async () => {
      const result = await exportManager.exportDashboardPDF('test');

      expect(result.format).toBe('pdf');
      expect(result.filename).toContain('test');
      expect(result.size).toBeGreaterThan(0);
      expect(result.content).toBeDefined();
    });

    test('should handle PDF export options', async () => {
      const result = await exportManager.exportDashboardPDF('test', {
        filename: 'custom.pdf',
        format: 'A3',
        orientation: 'portrait'
      });

      expect(result.filename).toBe('custom.pdf');
    });

    test('should throw error for non-existent dashboard', async () => {
      await expect(
        exportManager.exportDashboardPDF('nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('PNG Export', () => {
    test('should export dashboard as PNG', async () => {
      const result = await exportManager.exportDashboardPNG('test');

      expect(result.format).toBe('png');
      expect(result.filename).toContain('test');
      expect(result.dimensions).toBeDefined();
      expect(result.dimensions.width).toBe(1280);
    });

    test('should handle PNG export options', async () => {
      const result = await exportManager.exportDashboardPNG('test', {
        filename: 'custom.png',
        width: 800,
        height: 600,
        quality: 0.8
      });

      expect(result.filename).toBe('custom.png');
      expect(result.dimensions.width).toBe(800);
      expect(result.dimensions.height).toBe(600);
    });

    test('should throw error for non-existent dashboard', async () => {
      await expect(
        exportManager.exportDashboardPNG('nonexistent')
      ).rejects.toThrow();
    });
  });

  describe('Email Export', () => {
    test('should email dashboard snapshot', async () => {
      const recipients = ['test@example.com', 'user@example.com'];
      const result = await exportManager.emailDashboardSnapshot(
        'test',
        recipients
      );

      expect(result.recipients).toEqual(recipients);
      expect(result.content).toBeDefined();
      expect(result.format).toBe('html');
    });

    test('should include PDF attachment if requested', async () => {
      const result = await exportManager.emailDashboardSnapshot('test', ['test@example.com'], {
        attachPDF: true
      });

      expect(result.attachments).toBeDefined();
      expect(result.attachments.length).toBe(1);
      expect(result.attachments[0].contentType).toBe('application/pdf');
    });

    test('should generate text format email', async () => {
      const result = await exportManager.emailDashboardSnapshot('test', ['test@example.com'], {
        format: 'text'
      });

      expect(result.format).toBe('text');
      expect(typeof result.content).toBe('string');
      expect(result.content).toContain('Test Dashboard');
    });

    test('should throw error for non-existent dashboard', async () => {
      await expect(
        exportManager.emailDashboardSnapshot('nonexistent', ['test@example.com'])
      ).rejects.toThrow();
    });
  });

  describe('Report Scheduling', () => {
    test('should schedule daily report', () => {
      const { scheduleId, report } = exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '09:00',
        recipients: ['test@example.com'],
        format: 'html'
      });

      expect(scheduleId).toBeDefined();
      expect(report.frequency).toBe('daily');
      expect(report.time).toBe('09:00');
      expect(report.recipients.length).toBe(1);
    });

    test('should schedule weekly report', () => {
      const { report } = exportManager.scheduleReport('test', 'weekly', {
        frequency: 'weekly',
        time: '10:00'
      });

      expect(report.frequency).toBe('weekly');
    });

    test('should schedule monthly report', () => {
      const { report } = exportManager.scheduleReport('test', 'monthly', {
        frequency: 'monthly',
        time: '08:00'
      });

      expect(report.frequency).toBe('monthly');
    });

    test('should calculate next run time correctly', () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 3600000);

      const { report } = exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '15:00'
      });

      expect(report.nextRun).toBeGreaterThan(now.getTime());
    });
  });

  describe('Scheduled Report Management', () => {
    test('should get scheduled reports for dashboard', () => {
      exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '09:00'
      });

      const reports = exportManager.getScheduledReports('test');

      expect(reports.length).toBeGreaterThan(0);
      expect(reports[0].dashboardId).toBe('test');
    });

    test('should get all scheduled reports', () => {
      exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '09:00'
      });

      const allReports = exportManager.getScheduledReports();

      expect(allReports.length).toBeGreaterThan(0);
    });

    test('should cancel scheduled report', () => {
      const { scheduleId } = exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '09:00'
      });

      exportManager.cancelScheduledReport(scheduleId);
      const reports = exportManager.getScheduledReports('test');

      expect(reports.some(r => r.scheduleId === scheduleId)).toBe(false);
    });

    test('should throw error for non-existent schedule', () => {
      expect(() => {
        exportManager.cancelScheduledReport('nonexistent-schedule');
      }).toThrow();
    });
  });

  describe('Export History', () => {
    test('should track export history', async () => {
      await exportManager.exportDashboardPDF('test');
      await exportManager.exportDashboardPNG('test');

      const history = exportManager.getExportHistory();

      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('should limit export history', async () => {
      for (let i = 0; i < 10; i++) {
        await exportManager.exportDashboardPDF('test');
      }

      const history = exportManager.getExportHistory(null, 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });

    test('should filter export history by dashboard', async () => {
      dashboardService.createDashboard('other', { title: 'Other' });

      await exportManager.exportDashboardPDF('test');
      await exportManager.exportDashboardPDF('test');

      const testHistory = exportManager.getExportHistory('test');

      expect(testHistory.every(item => item.dashboardId === 'test')).toBe(true);
    });
  });

  describe('Export Statistics', () => {
    test('should get export statistics', async () => {
      await exportManager.exportDashboardPDF('test');
      await exportManager.exportDashboardPNG('test');
      exportManager.scheduleReport('test', 'daily', {
        frequency: 'daily',
        time: '09:00'
      });

      const stats = exportManager.getExportStats();

      expect(stats.totalExports).toBeGreaterThanOrEqual(2);
      expect(stats.byFormat.pdf).toBeGreaterThan(0);
      expect(stats.byFormat.png).toBeGreaterThan(0);
      expect(stats.scheduledReports).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit export:pdf event', async () => {
      return new Promise((resolve) => {
        exportManager.on('export:pdf', (data) => {
          expect(data.dashboardId).toBe('test');
          expect(data.filename).toBeDefined();
          resolve();
        });

        exportManager.exportDashboardPDF('test');
      });
    });

    test('should emit export:png event', async () => {
      return new Promise((resolve) => {
        exportManager.on('export:png', (data) => {
          expect(data.dashboardId).toBe('test');
          resolve();
        });

        exportManager.exportDashboardPNG('test');
      });
    });

    test('should emit report:scheduled event', () => {
      return new Promise((resolve) => {
        exportManager.on('report:scheduled', (data) => {
          expect(data.scheduleId).toBeDefined();
          resolve();
        });

        exportManager.scheduleReport('test', 'daily', {
          frequency: 'daily',
          time: '09:00'
        });
      });
    });
  });

  describe('Email Content Generation', () => {
    test('should generate HTML email content', async () => {
      const result = await exportManager.emailDashboardSnapshot('test', ['test@example.com'], {
        format: 'html'
      });

      expect(result.content).toContain('<!DOCTYPE html>');
      expect(result.content).toContain('Test Dashboard');
    });

    test('should generate text email content', async () => {
      const result = await exportManager.emailDashboardSnapshot('test', ['test@example.com'], {
        format: 'text'
      });

      expect(result.content).toContain('Test Dashboard');
      expect(result.content).not.toContain('<html>');
    });
  });
});

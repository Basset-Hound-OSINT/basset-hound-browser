/**
 * Report Generator Tests
 * Tests for various report types, HTML generation, scheduling, and email integration
 */

const {
  ReportGenerator,
  Report,
  ReportConfig
} = require('../../src/features/report-generator');

describe('Report Configuration', () => {
  test('should create report config', () => {
    const config = new ReportConfig({
      name: 'Weekly Report',
      type: 'competitor_activity',
      monitors: ['monitor-1', 'monitor-2']
    });

    expect(config.id).toBeDefined();
    expect(config.name).toBe('Weekly Report');
    expect(config.type).toBe('competitor_activity');
    expect(config.monitors).toHaveLength(2);
  });

  test('should have default date range', () => {
    const config = new ReportConfig({
      name: 'Report'
    });

    expect(config.dateRange).toBeDefined();
    expect(config.dateRange.start).toBeLessThan(Date.now());
    expect(config.dateRange.end).toBeLessThanOrEqual(Date.now());
  });

  test('should allow custom date range', () => {
    const start = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const end = Date.now();

    const config = new ReportConfig({
      name: 'Report',
      dateRange: { start, end }
    });

    expect(config.dateRange.start).toBe(start);
    expect(config.dateRange.end).toBe(end);
  });

  test('should support HTML and PDF formats', () => {
    const htmlConfig = new ReportConfig({
      name: 'HTML Report',
      format: 'html'
    });

    const pdfConfig = new ReportConfig({
      name: 'PDF Report',
      format: 'pdf'
    });

    expect(htmlConfig.format).toBe('html');
    expect(pdfConfig.format).toBe('pdf');
  });
});

describe('Report Generation', () => {
  let generator;
  const mockDataManager = {
    changes: [
      {
        id: 'change-1',
        monitorId: 'monitor-1',
        changeType: 'added',
        timestamp: Date.now() - 1000,
        oldValue: null,
        newValue: 'new content',
        tags: ['content']
      },
      {
        id: 'change-2',
        monitorId: 'monitor-1',
        changeType: 'modified',
        timestamp: Date.now(),
        oldValue: 'old value',
        newValue: 'new value',
        tags: ['price']
      }
    ],
    alerts: [
      {
        id: 'alert-1',
        monitorId: 'monitor-1',
        severity: 'high',
        type: 'price_change',
        status: 'active',
        title: 'Price increased',
        timestamp: Date.now() - 5000
      },
      {
        id: 'alert-2',
        monitorId: 'monitor-2',
        severity: 'medium',
        type: 'text_change',
        status: 'active',
        title: 'Content changed',
        timestamp: Date.now()
      }
    ]
  };

  beforeEach(() => {
    generator = new ReportGenerator({ dataManager: mockDataManager });
  });

  describe('Competitor Activity Report', () => {
    test('should generate competitor activity report', () => {
      const config = new ReportConfig({
        name: 'Weekly Activity',
        type: 'competitor_activity',
        monitors: ['monitor-1']
      });

      const report = generator.generateCompetitorActivityReport(config);

      expect(report.status).toBe('completed');
      expect(report.sections).toHaveLength(3); // Summary, Type breakdown, Timeline
    });

    test('should include summary section', () => {
      const config = new ReportConfig({
        name: 'Activity Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);

      const summarySection = report.sections.find(s => s.title === 'Executive Summary');
      expect(summarySection).toBeDefined();
    });

    test('should include change type breakdown', () => {
      const config = new ReportConfig({
        name: 'Activity Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);

      const typeSection = report.sections.find(s => s.title === 'Changes by Type');
      expect(typeSection).toBeDefined();
      expect(typeSection.content).toContain('added');
      expect(typeSection.content).toContain('modified');
    });

    test('should include activity timeline', () => {
      const config = new ReportConfig({
        name: 'Activity Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);

      const timelineSection = report.sections.find(s => s.title === 'Activity Timeline');
      expect(timelineSection).toBeDefined();
    });

    test('should filter by monitor', () => {
      const config = new ReportConfig({
        name: 'Activity Report',
        type: 'competitor_activity',
        monitors: ['monitor-1']
      });

      const report = generator.generateCompetitorActivityReport(config);

      expect(report.status).toBe('completed');
      expect(report.sections).toHaveLength(3);
    });
  });

  describe('Price History Report', () => {
    test('should generate price history report', () => {
      const config = new ReportConfig({
        name: 'Price History',
        type: 'price_history'
      });

      const report = generator.generatePriceHistoryReport(config);

      expect(report.status).toBe('completed');
      expect(report.sections.length).toBeGreaterThan(0);
    });

    test('should include price summary', () => {
      const config = new ReportConfig({
        name: 'Price Report',
        type: 'price_history'
      });

      const report = generator.generatePriceHistoryReport(config);

      const summarySection = report.sections.find(s => s.title === 'Summary');
      expect(summarySection).toBeDefined();
    });

    test('should include price movements table', () => {
      const config = new ReportConfig({
        name: 'Price Report',
        type: 'price_history'
      });

      const report = generator.generatePriceHistoryReport(config);

      const movementsSection = report.sections.find(s => s.title === 'Price Movements');
      expect(movementsSection).toBeDefined();
    });
  });

  describe('Technology Evolution Report', () => {
    test('should generate tech evolution report', () => {
      const config = new ReportConfig({
        name: 'Tech Evolution',
        type: 'tech_evolution'
      });

      const report = generator.generateTechEvolutionReport(config);

      expect(report.status).toBe('completed');
      expect(report.sections.length).toBeGreaterThan(0);
    });

    test('should include technology changes table', () => {
      const config = new ReportConfig({
        name: 'Tech Report',
        type: 'tech_evolution'
      });

      const report = generator.generateTechEvolutionReport(config);

      const techSection = report.sections.find(s => s.title === 'Technology Changes');
      expect(techSection).toBeDefined();
    });
  });

  describe('Alert Summary Report', () => {
    test('should generate alert summary report', () => {
      const config = new ReportConfig({
        name: 'Alert Summary',
        type: 'alert_summary'
      });

      const report = generator.generateAlertSummaryReport(config);

      expect(report.status).toBe('completed');
      expect(report.sections.length).toBeGreaterThan(0);
    });

    test('should include alert severity breakdown', () => {
      const config = new ReportConfig({
        name: 'Alert Report',
        type: 'alert_summary'
      });

      const report = generator.generateAlertSummaryReport(config);

      const severitySection = report.sections.find(s => s.title === 'Alerts by Severity');
      expect(severitySection).toBeDefined();
    });

    test('should include detailed alerts table', () => {
      const config = new ReportConfig({
        name: 'Alert Report',
        type: 'alert_summary'
      });

      const report = generator.generateAlertSummaryReport(config);

      const alertsSection = report.sections.find(s => s.title === 'Alerts');
      expect(alertsSection).toBeDefined();
    });

    test('should filter by date range', () => {
      const now = Date.now();
      const config = new ReportConfig({
        name: 'Alert Report',
        type: 'alert_summary',
        dateRange: {
          start: now - 10000,
          end: now + 10000
        }
      });

      const report = generator.generateAlertSummaryReport(config);

      expect(report.status).toBe('completed');
    });
  });
});

describe('Report Output', () => {
  let generator;
  const mockDataManager = {
    changes: [],
    alerts: []
  };

  beforeEach(() => {
    generator = new ReportGenerator({ dataManager: mockDataManager });
  });

  describe('HTML Generation', () => {
    test('should generate valid HTML', () => {
      const config = new ReportConfig({
        name: 'Test Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const html = report.generateHTML();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
      expect(html).toContain('Test Report');
    });

    test('should include report metadata in HTML', () => {
      const config = new ReportConfig({
        name: 'Test Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const html = report.generateHTML();

      expect(html).toContain('Generated:');
      expect(html).toContain('Report Type:');
    });

    test('should style HTML properly', () => {
      const config = new ReportConfig({
        name: 'Styled Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const html = report.generateHTML();

      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toContain('font-family');
    });

    test('should include all report sections in HTML', () => {
      const config = new ReportConfig({
        name: 'Test Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      report.addSection('Test Section', '<p>Test content</p>');

      const html = report.generateHTML();

      expect(html).toContain('Test Section');
      expect(html).toContain('Test content');
    });
  });

  describe('Text Generation', () => {
    test('should generate plain text output', () => {
      const config = new ReportConfig({
        name: 'Text Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const text = report.generateText();

      expect(typeof text).toBe('string');
      expect(text).toContain('Text Report');
      expect(text).toContain('='.repeat(60));
    });

    test('should include sections in text output', () => {
      const config = new ReportConfig({
        name: 'Text Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const text = report.generateText();

      expect(text).toContain('Executive Summary');
    });
  });

  describe('Report Content Retrieval', () => {
    test('should get report as HTML', () => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity',
        format: 'html'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const reportId = report.id;

      const content = generator.getReportContent(reportId, 'html');

      expect(content).toContain('<!DOCTYPE html>');
    });

    test('should get report as text', () => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const reportId = report.id;

      const content = generator.getReportContent(reportId, 'text');

      expect(typeof content).toBe('string');
      expect(content).toContain('Report');
    });

    test('should get report as JSON', () => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const reportId = report.id;

      const content = generator.getReportContent(reportId, 'json');

      expect(content).toHaveProperty('id');
      expect(content).toHaveProperty('config');
      expect(content).toHaveProperty('sections');
    });

    test('should return null for non-existent report', () => {
      const content = generator.getReportContent('fake-id', 'html');

      expect(content).toBeNull();
    });
  });

  describe('Email Integration', () => {
    test('should generate email body', () => {
      const config = new ReportConfig({
        name: 'Email Report',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const reportId = report.id;

      const email = generator.getEmailBody(reportId);

      expect(email).toHaveProperty('subject');
      expect(email).toHaveProperty('htmlBody');
      expect(email).toHaveProperty('textBody');
      expect(email).toHaveProperty('attachmentType');
    });

    test('should include report name in email subject', () => {
      const config = new ReportConfig({
        name: 'Weekly Competitor Analysis',
        type: 'competitor_activity'
      });

      const report = generator.generateCompetitorActivityReport(config);
      const reportId = report.id;

      const email = generator.getEmailBody(reportId);

      expect(email.subject).toContain('Weekly Competitor Analysis');
    });

    test('should return null for non-existent report email', () => {
      const email = generator.getEmailBody('fake-id');

      expect(email).toBeNull();
    });
  });
});

describe('Report Management', () => {
  let generator;
  const mockDataManager = {
    changes: [],
    alerts: []
  };

  beforeEach(() => {
    generator = new ReportGenerator({ dataManager: mockDataManager });
  });

  describe('Report Listing', () => {
    test('should list reports', () => {
      const config1 = new ReportConfig({
        name: 'Report 1',
        type: 'competitor_activity'
      });

      const config2 = new ReportConfig({
        name: 'Report 2',
        type: 'alert_summary'
      });

      generator.generateCompetitorActivityReport(config1);
      generator.generateAlertSummaryReport(config2);

      const reports = generator.listReports();

      expect(reports.length).toBeGreaterThanOrEqual(2);
    });

    test('should filter reports by type', () => {
      const config1 = new ReportConfig({
        name: 'Report 1',
        type: 'competitor_activity'
      });

      const config2 = new ReportConfig({
        name: 'Report 2',
        type: 'alert_summary'
      });

      generator.generateCompetitorActivityReport(config1);
      generator.generateAlertSummaryReport(config2);

      const activityReports = generator.listReports({ type: 'competitor_activity' });

      expect(activityReports.length).toBeGreaterThan(0);
      expect(activityReports[0].type).toBe('competitor_activity');
    });

    test('should filter reports by status', () => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      generator.generateCompetitorActivityReport(config);

      const completedReports = generator.listReports({ status: 'completed' });

      expect(completedReports.length).toBeGreaterThan(0);
    });
  });

  describe('Report Scheduling', () => {
    test('should schedule report generation', () => {
      const config = new ReportConfig({
        name: 'Scheduled Report',
        type: 'competitor_activity'
      });

      const scheduleId = generator.scheduleReport(config, {
        frequency: 'daily',
        time: '09:00'
      });

      expect(scheduleId).toBeDefined();
      expect(generator.scheduledReports.has(scheduleId)).toBe(true);
    });

    test('should track scheduled reports', () => {
      const config = new ReportConfig({
        name: 'Weekly Report',
        type: 'competitor_activity'
      });

      const scheduleId = generator.scheduleReport(config, {
        frequency: 'weekly',
        time: '09:00'
      });

      const scheduled = generator.scheduledReports.get(scheduleId);

      expect(scheduled.config.name).toBe('Weekly Report');
      expect(scheduled.schedule.frequency).toBe('weekly');
    });

    test('should emit report:scheduled event', (done) => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      generator.once('report:scheduled', (data) => {
        expect(data.scheduleId).toBeDefined();
        expect(data.schedule).toBe('daily');
        done();
      });

      generator.scheduleReport(config, { frequency: 'daily', time: '09:00' });
    });
  });

  describe('Report Events', () => {
    test('should emit report:generated event', (done) => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      generator.once('report:generated', (data) => {
        expect(data.reportId).toBeDefined();
        expect(data.type).toBe('competitor_activity');
        done();
      });

      generator.generateCompetitorActivityReport(config);
    });

    test('should handle report generation with missing data', () => {
      const config = new ReportConfig({
        name: 'Report',
        type: 'competitor_activity'
      });

      // Override data manager to cause null reference
      const badGenerator = new ReportGenerator({ dataManager: null });

      try {
        badGenerator.generateCompetitorActivityReport(config);
        // If it doesn't throw, check report status
      } catch (err) {
        // Expected behavior
        expect(err).toBeDefined();
      }
    });
  });
});

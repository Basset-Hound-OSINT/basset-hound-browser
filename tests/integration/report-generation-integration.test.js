/**
 * Integration Tests for Report Generation
 * Tests WebSocket command integration and full workflows
 */

const { initializeReportHandlers } = require('../../websocket/commands/report-generation');

describe('Report Generation Integration', () => {
  let handlers;
  let mockManagers;

  beforeEach(() => {
    // Mock managers
    mockManagers = {
      sessionManager: {
        getSessionEvidence: (sessionId) => ({
          url: `https://example-${sessionId}.com`,
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString(),
          sessionCount: 1,
          screenshots: [
            {
              url: `https://example-${sessionId}.com`,
              timestamp: new Date().toISOString(),
              hash: 'abc123'
            }
          ],
          technologies: [
            {
              name: 'Apache',
              version: '2.4.41',
              category: 'Server',
              confidence: 0.95,
              detectionMethods: { headers: 0.95 }
            }
          ],
          networkRequests: [
            {
              timestamp: new Date().toISOString(),
              method: 'GET',
              url: `https://example-${sessionId}.com`,
              status: 200,
              responseSize: 10240,
              responseTime: 234,
              type: 'document'
            }
          ],
          contentAnalysis: {
            title: 'Example Site',
            description: 'Test website',
            forms: [],
            links: [
              { url: `https://example-${sessionId}.com/page`, text: 'Link' }
            ]
          },
          timeline: [
            {
              timestamp: new Date().toISOString(),
              type: 'navigation',
              description: 'Site loaded'
            }
          ]
        })
      },
      evidenceCollector: {},
      extractionManager: {}
    };

    handlers = initializeReportHandlers(mockManagers);
  });

  describe('generate_report Command', () => {
    test('should generate report with all parameters', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_123',
        title: 'Investigation: Example.com',
        investigator: 'Detective Smith',
        caseNumber: 'CASE-2024-001',
        format: 'html',
        includeScreenshots: true,
        includeTechnologies: true,
        includeNetworkCapture: true,
        includeTimeline: true
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(result.format).toBe('html');
      expect(result.title).toBe('Investigation: Example.com');
      expect(result.sections).toBeDefined();
    });

    test('should generate JSON format report', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_456',
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
    });

    test('should generate Markdown format report', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_789',
        format: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
    });

    test('should generate CSV format report', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_csv',
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
    });

    test('should reject missing sessionId', async () => {
      const result = await handlers.generate_report({
        title: 'Test Report',
        format: 'html'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId');
    });

    test('should apply sensitive data filtering', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_sensitive',
        format: 'json',
        sensitiveDataFilter: ['email', 'phone']
      });

      expect(result.success).toBe(true);
    });

    test('should exclude optional sections', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_minimal',
        format: 'json',
        includeScreenshots: false,
        includeTechnologies: false,
        includeNetworkCapture: false,
        includeTimeline: false,
        includeRecommendations: false
      });

      expect(result.success).toBe(true);
      expect(result.sections.screenshots).toBe(false);
      expect(result.sections.technologies).toBe(false);
    });

    test('should include compliance metadata', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_compliance',
        jurisdiction: 'Federal',
        legalBasis: 'FOIA',
        format: 'json'
      });

      expect(result.success).toBe(true);
    });

    test('should measure generation performance', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_perf',
        format: 'json'
      });

      expect(result.generationTime).toBeLessThan(2000);
      expect(result.generationTime).toBeGreaterThan(0);
    });
  });

  describe('get_report Command', () => {
    test('should retrieve generated report metadata', async () => {
      // Generate first
      const genResult = await handlers.generate_report({
        sessionId: 'sess_retrieve',
        title: 'Test Report'
      });

      // Retrieve
      const getResult = await handlers.get_report({
        reportId: genResult.reportId
      });

      expect(getResult.success).toBe(true);
      expect(getResult.reportId).toBe(genResult.reportId);
      expect(getResult.title).toBe('Test Report');
    });

    test('should reject missing reportId', async () => {
      const result = await handlers.get_report({});
      expect(result.success).toBe(false);
    });

    test('should return not found for invalid reportId', async () => {
      const result = await handlers.get_report({
        reportId: 'invalid_id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('export_report Command', () => {
    test('should export report with sessionId', async () => {
      const result = await handlers.export_report({
        sessionId: 'sess_export',
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(result.content).toBeDefined();
    });

    test('should reject missing sessionId and reportId', async () => {
      const result = await handlers.export_report({
        format: 'html'
      });

      expect(result.success).toBe(false);
    });

    test('should export to file with destination', async () => {
      const result = await handlers.export_report({
        sessionId: 'sess_file',
        format: 'html',
        destination: '/tmp/report.html'
      });

      expect(result.success).toBe(true);
      expect(result.filePath).toBeDefined();
    });
  });

  describe('get_templates Command', () => {
    test('should list available templates', async () => {
      const result = await handlers.get_templates({});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.templates)).toBe(true);
      expect(result.templates.length).toBeGreaterThan(0);
    });

    test('should include standard templates', async () => {
      const result = await handlers.get_templates({});

      const ids = result.templates.map(t => t.id);
      expect(ids).toContain('forensic');
      expect(ids).toContain('executive');
      expect(ids).toContain('technical');
      expect(ids).toContain('compliance');
    });

    test('should list supported formats', async () => {
      const result = await handlers.get_templates({});

      expect(result.supportedFormats).toContain('html');
      expect(result.supportedFormats).toContain('json');
      expect(result.supportedFormats).toContain('markdown');
      expect(result.supportedFormats).toContain('csv');
    });

    test('should have proper template structure', async () => {
      const result = await handlers.get_templates({});

      result.templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.sections).toBeDefined();
      });
    });
  });

  describe('customize_template Command', () => {
    test('should create custom template', async () => {
      const result = await handlers.customize_template({
        name: 'Custom Forensic',
        description: 'Custom forensic template',
        sections: ['executiveSummary', 'technologies', 'evidence'],
        defaultFormat: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.templateId).toBeDefined();
      expect(result.template.name).toBe('Custom Forensic');
    });

    test('should validate required fields', async () => {
      const result = await handlers.customize_template({
        description: 'Missing name and sections'
      });

      expect(result.success).toBe(false);
    });

    test('should require sections array', async () => {
      const result = await handlers.customize_template({
        name: 'Invalid Template',
        sections: 'not_an_array'
      });

      expect(result.success).toBe(false);
    });

    test('should include creation timestamp', async () => {
      const result = await handlers.customize_template({
        name: 'Timestamped Template',
        sections: ['executiveSummary']
      });

      expect(result.template.createdAt).toBeDefined();
    });
  });

  describe('annotate_report_screenshot Command', () => {
    test('should add annotations to screenshot', async () => {
      const result = await handlers.annotate_report_screenshot({
        reportId: 'rpt_123',
        screenshotId: 'ss_001',
        annotations: [
          {
            type: 'highlight',
            coordinates: [100, 200, 300, 400],
            color: 'yellow',
            note: 'Suspicious element'
          }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.annotated).toBe(true);
      expect(result.annotationCount).toBe(1);
    });

    test('should support multiple annotations', async () => {
      const result = await handlers.annotate_report_screenshot({
        reportId: 'rpt_456',
        screenshotId: 'ss_002',
        annotations: [
          { type: 'highlight', coordinates: [0, 0, 100, 100] },
          { type: 'circle', coordinates: [200, 200, 50, 50] },
          { type: 'arrow', coordinates: [300, 300, 400, 400] }
        ]
      });

      expect(result.success).toBe(true);
      expect(result.annotationCount).toBe(3);
    });

    test('should reject invalid annotation format', async () => {
      const result = await handlers.annotate_report_screenshot({
        reportId: 'rpt_789',
        screenshotId: 'ss_003',
        annotations: [{ type: 'highlight' }] // Missing coordinates
      });

      expect(result.success).toBe(false);
    });
  });

  describe('schedule_report Command', () => {
    test('should schedule report generation', async () => {
      const result = await handlers.schedule_report({
        sessionId: 'sess_scheduled',
        title: 'Scheduled Report',
        cron: '0 9 * * MON',
        timezone: 'America/New_York',
        format: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.scheduleId).toBeDefined();
      expect(result.status).toBe('scheduled');
    });

    test('should require sessionId', async () => {
      const result = await handlers.schedule_report({
        cron: '0 9 * * MON'
      });

      expect(result.success).toBe(false);
    });

    test('should require cron expression', async () => {
      const result = await handlers.schedule_report({
        sessionId: 'sess_123'
      });

      expect(result.success).toBe(false);
    });

    test('should use default timezone', async () => {
      const result = await handlers.schedule_report({
        sessionId: 'sess_tz',
        cron: '0 9 * * *'
      });

      expect(result.timezone).toBe('UTC');
    });
  });

  describe('list_reports Command', () => {
    test('should list reports for session', async () => {
      // Generate multiple reports
      await handlers.generate_report({
        sessionId: 'sess_list',
        title: 'Report 1',
        format: 'html'
      });

      await handlers.generate_report({
        sessionId: 'sess_list',
        title: 'Report 2',
        format: 'json'
      });

      // List them
      const result = await handlers.list_reports({
        sessionId: 'sess_list'
      });

      expect(result.success).toBe(true);
      expect(result.reports.length).toBeGreaterThanOrEqual(2);
    });

    test('should respect limit parameter', async () => {
      const result = await handlers.list_reports({
        sessionId: 'sess_list',
        limit: 1
      });

      expect(result.reports.length).toBeLessThanOrEqual(1);
    });

    test('should return empty list for unknown session', async () => {
      const result = await handlers.list_reports({
        sessionId: 'unknown_sess'
      });

      expect(result.success).toBe(true);
      expect(result.reports.length).toBe(0);
    });
  });

  describe('delete_report Command', () => {
    test('should delete generated report', async () => {
      // Generate first
      const genResult = await handlers.generate_report({
        sessionId: 'sess_delete',
        title: 'Report to Delete'
      });

      // Delete it
      const delResult = await handlers.delete_report({
        reportId: genResult.reportId
      });

      expect(delResult.success).toBe(true);
      expect(delResult.deleted).toBe(true);

      // Verify it's gone
      const getResult = await handlers.get_report({
        reportId: genResult.reportId
      });

      expect(getResult.success).toBe(false);
    });

    test('should reject invalid reportId', async () => {
      const result = await handlers.delete_report({
        reportId: 'invalid'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('report_statistics Command', () => {
    test('should return overall statistics', async () => {
      const result = await handlers.report_statistics({});

      expect(result.success).toBe(true);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.totalReports).toBeGreaterThanOrEqual(0);
      expect(result.statistics.byFormat).toBeDefined();
    });

    test('should filter statistics by session', async () => {
      // Generate report
      await handlers.generate_report({
        sessionId: 'sess_stats',
        format: 'html'
      });

      // Get stats for session
      const result = await handlers.report_statistics({
        sessionId: 'sess_stats'
      });

      expect(result.success).toBe(true);
      expect(result.statistics.totalReports).toBeGreaterThanOrEqual(1);
    });

    test('should calculate average generation time', async () => {
      const result = await handlers.report_statistics({});

      expect(result.statistics.averageGenerationTime).toBeGreaterThanOrEqual(0);
    });

    test('should track data generation', async () => {
      const result = await handlers.report_statistics({});

      expect(result.statistics.totalDataGenerated).toBeDefined();
    });
  });

  describe('verify_report Command', () => {
    test('should verify report integrity', async () => {
      // Generate report
      const genResult = await handlers.generate_report({
        sessionId: 'sess_verify',
        format: 'json'
      });

      // Verify it
      const verResult = await handlers.verify_report({
        reportId: genResult.reportId,
        expectedHash: genResult.hash
      });

      expect(verResult.success).toBe(true);
      expect(verResult.valid).toBe(true);
    });

    test('should detect hash mismatch', async () => {
      // Generate report
      const genResult = await handlers.generate_report({
        sessionId: 'sess_hash',
        format: 'json'
      });

      // Verify with wrong hash
      const verResult = await handlers.verify_report({
        reportId: genResult.reportId,
        expectedHash: 'wrong_hash'
      });

      expect(verResult.success).toBe(true);
      expect(verResult.valid).toBe(false);
    });

    test('should reject missing reportId', async () => {
      const result = await handlers.verify_report({});

      expect(result.success).toBe(false);
    });
  });

  describe('Workflow Integration', () => {
    test('complete workflow: generate -> get -> export', async () => {
      // Generate
      const genResult = await handlers.generate_report({
        sessionId: 'sess_workflow',
        title: 'Workflow Test',
        investigator: 'Test User',
        format: 'html'
      });

      expect(genResult.success).toBe(true);

      // Get
      const getResult = await handlers.get_report({
        reportId: genResult.reportId
      });

      expect(getResult.success).toBe(true);
      expect(getResult.title).toBe('Workflow Test');

      // Export
      const expResult = await handlers.export_report({
        reportId: genResult.reportId,
        format: 'json'
      });

      expect(expResult.success).toBe(true);
      expect(expResult.format).toBe('json');
    });

    test('complete workflow: template -> customize -> generate', async () => {
      // Get templates
      const tmplResult = await handlers.get_templates({});
      expect(tmplResult.success).toBe(true);

      // Customize template
      const custResult = await handlers.customize_template({
        name: 'Custom Forensic Report',
        sections: ['executiveSummary', 'evidence', 'compliance'],
        defaultFormat: 'html'
      });

      expect(custResult.success).toBe(true);

      // Generate using custom template
      const genResult = await handlers.generate_report({
        sessionId: 'sess_custom',
        title: 'Custom Report',
        format: 'html'
      });

      expect(genResult.success).toBe(true);
    });

    test('complete workflow: generate -> annotate -> export', async () => {
      // Generate
      const genResult = await handlers.generate_report({
        sessionId: 'sess_annotate',
        format: 'html',
        includeScreenshots: true
      });

      expect(genResult.success).toBe(true);

      // Annotate screenshot
      const annResult = await handlers.annotate_report_screenshot({
        reportId: genResult.reportId,
        screenshotId: 'ss_001',
        annotations: [
          {
            type: 'highlight',
            coordinates: [100, 100, 200, 200],
            note: 'Suspicious'
          }
        ]
      });

      expect(annResult.success).toBe(true);

      // Export
      const expResult = await handlers.export_report({
        sessionId: 'sess_annotate'
      });

      expect(expResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing evidence gracefully', async () => {
      const noEvidence = {
        sessionManager: {
          getSessionEvidence: () => ({})
        }
      };

      const noEvidenceHandlers = initializeReportHandlers(noEvidence);
      const result = await noEvidenceHandlers.generate_report({
        sessionId: 'sess_empty',
        format: 'json'
      });

      expect(result.success).toBe(true); // Should still succeed with empty evidence
    });

    test('should handle null managers', async () => {
      const emptyHandlers = initializeReportHandlers({});
      const result = await emptyHandlers.generate_report({
        sessionId: 'sess_no_mgr',
        format: 'json'
      });

      expect(result.success).toBe(true); // Should handle gracefully
    });

    test('should handle invalid parameters', async () => {
      const result = await handlers.generate_report({
        sessionId: 'sess_invalid',
        format: 'invalid_format'
      });

      expect(result.success).toBe(false);
    });
  });
});

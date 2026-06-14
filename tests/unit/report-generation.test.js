/**
 * Unit Tests for Report Generation
 * Tests report generator core functionality across all formats
 */

const {
  ReportGenerator,
  HTMLFormatter,
  JSONFormatter,
  MarkdownFormatter,
  CSVFormatter
} = require('../../src/reporting/report-generator');

describe('ReportGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ReportGenerator({
      companyName: 'Test Company',
      toolVersion: '1.0.0'
    });
  });

  describe('Basic Initialization', () => {
    test('should initialize with default options', () => {
      expect(generator).toBeDefined();
      expect(generator.companyName).toBe('Test Company');
      expect(generator.toolVersion).toBe('1.0.0');
    });

    test('should have all formatters registered', () => {
      expect(generator.formatters.has('html')).toBe(true);
      expect(generator.formatters.has('json')).toBe(true);
      expect(generator.formatters.has('markdown')).toBe(true);
      expect(generator.formatters.has('csv')).toBe(true);
    });

    test('should create report directory', () => {
      expect(generator.reportDir).toBeDefined();
    });
  });

  describe('Report Generation', () => {
    const basicEvidence = {
      url: 'https://example.com',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      sessionCount: 1,
      screenshots: [
        {
          url: 'https://example.com',
          timestamp: new Date().toISOString(),
          hash: 'abc123'
        }
      ],
      technologies: [
        {
          name: 'WordPress',
          version: '5.8.1',
          category: 'CMS',
          confidence: 0.95
        }
      ],
      networkRequests: [
        {
          method: 'GET',
          url: 'https://example.com',
          status: 200,
          responseSize: 1024
        }
      ],
      contentAnalysis: {
        title: 'Example Site',
        description: 'Test description',
        forms: [],
        links: []
      }
    };

    test('should generate HTML report', async () => {
      const result = await generator.generateReport(basicEvidence, {
        title: 'Test Report',
        investigator: 'Test User',
        caseNumber: 'CASE-001',
        format: 'html'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('html');
      expect(result.content).toContain('<html');
      expect(result.content).toContain('Test Report');
      expect(result.content).toContain('Test User');
      expect(result.contentSize).toBeGreaterThan(0);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should generate JSON report', async () => {
      const result = await generator.generateReport(basicEvidence, {
        title: 'Test Report',
        format: 'json'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');

      const parsed = JSON.parse(result.content);
      expect(parsed.title).toBe('Test Report');
      expect(parsed.metadata).toBeDefined();
      expect(parsed.sections).toBeDefined();
    });

    test('should generate Markdown report', async () => {
      const result = await generator.generateReport(basicEvidence, {
        title: 'Test Report',
        format: 'markdown'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('markdown');
      expect(result.content).toContain('# Test Report');
      expect(result.content).toContain('## Executive Summary');
    });

    test('should generate CSV report', async () => {
      const result = await generator.generateReport(basicEvidence, {
        title: 'Test Report',
        format: 'csv'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.content).toContain('Field,Value');
      expect(result.content).toContain('Report ID');
    });

    test('should reject unknown format', async () => {
      expect(async () => {
        await generator.generateReport(basicEvidence, {
          format: 'unknown'
        });
      }).rejects.toThrow('Unsupported format');
    });

    test('should require evidence parameter', async () => {
      expect(async () => {
        await generator.generateReport(null, { format: 'html' });
      }).rejects.toThrow('Evidence package is required');
    });
  });

  describe('Report Sections', () => {
    const fullEvidence = {
      url: 'https://example.com',
      startTime: new Date(Date.now() - 3600000).toISOString(),
      endTime: new Date().toISOString(),
      screenshots: [
        {
          url: 'https://example.com',
          timestamp: new Date().toISOString(),
          hash: 'abc123'
        },
        {
          url: 'https://example.com/about',
          timestamp: new Date().toISOString(),
          hash: 'def456'
        }
      ],
      technologies: [
        { name: 'WordPress', version: '5.8', category: 'CMS', confidence: 0.95 },
        { name: 'Apache', version: '2.4', category: 'Server', confidence: 0.90 }
      ],
      networkRequests: [
        { method: 'GET', url: 'https://example.com', status: 200, responseSize: 10240 },
        { method: 'POST', url: 'https://example.com/api', status: 201, responseSize: 512 }
      ],
      contentAnalysis: {
        title: 'Example Website',
        forms: [
          { id: 'form_1', method: 'POST', action: '/submit', fields: ['name', 'email'] }
        ],
        links: [
          { url: 'https://example.com/page', text: 'Page Link' }
        ]
      },
      timeline: [
        { timestamp: new Date().toISOString(), type: 'navigate', description: 'Navigated to site' }
      ]
    };

    test('should include all requested sections', async () => {
      const result = await generator.generateReport(fullEvidence, {
        title: 'Full Report',
        format: 'json',
        includeScreenshots: true,
        includeTechnologies: true,
        includeNetworkCapture: true,
        includeTimeline: true
      });

      const report = JSON.parse(result.content);
      expect(report.sections.screenshots).not.toBeNull();
      expect(report.sections.technologies).not.toBeNull();
      expect(report.sections.networkForensics).not.toBeNull();
      expect(report.sections.timeline).not.toBeNull();
    });

    test('should exclude sections when requested', async () => {
      const result = await generator.generateReport(fullEvidence, {
        title: 'Minimal Report',
        format: 'json',
        includeScreenshots: false,
        includeTechnologies: false,
        includeNetworkCapture: false,
        includeTimeline: false
      });

      const report = JSON.parse(result.content);
      expect(report.sections.screenshots).toBeNull();
      expect(report.sections.technologies).toBeNull();
      expect(report.sections.networkForensics).toBeNull();
      expect(report.sections.timeline).toBeNull();
    });

    test('should properly count evidence items', async () => {
      const result = await generator.generateReport(fullEvidence, {
        title: 'Test Report',
        format: 'json',
        includeScreenshots: true,
        includeTechnologies: true
      });

      const report = JSON.parse(result.content);
      expect(report.sections.screenshots.totalCount).toBe(2);
      expect(report.sections.technologies.totalDetected).toBe(2);
    });
  });

  describe('Sensitive Data Filtering', () => {
    const sensitiveEvidence = {
      url: 'https://example.com',
      contentAnalysis: {
        title: 'Contact us at support@example.com',
        description: 'Phone: 555-123-4567, Email: admin@company.com'
      }
    };

    test('should redact email addresses', async () => {
      const result = await generator.generateReport(sensitiveEvidence, {
        title: 'Test Report',
        format: 'json',
        sensitiveDataFilter: ['email']
      });

      expect(result.content).not.toContain('support@example.com');
      expect(result.content).not.toContain('admin@company.com');
      expect(result.content).toContain('[REDACTED]');
    });

    test('should redact phone numbers', async () => {
      const result = await generator.generateReport(sensitiveEvidence, {
        title: 'Test Report',
        format: 'json',
        sensitiveDataFilter: ['phone']
      });

      expect(result.content).not.toContain('555-123-4567');
      expect(result.content).toContain('[REDACTED]');
    });

    test('should redact multiple sensitive data types', async () => {
      const result = await generator.generateReport(sensitiveEvidence, {
        title: 'Test Report',
        format: 'json',
        sensitiveDataFilter: ['email', 'phone']
      });

      const redactCount = (result.content.match(/\[REDACTED\]/g) || []).length;
      expect(redactCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Report Metadata', () => {
    test('should include all metadata fields', async () => {
      const result = await generator.generateReport({}, {
        title: 'Test Report',
        investigator: 'John Doe',
        caseNumber: 'CASE-2024-001',
        jurisdiction: 'Federal',
        format: 'json'
      });

      const report = JSON.parse(result.content);
      expect(report.metadata.investigator).toBe('John Doe');
      expect(report.metadata.caseNumber).toBe('CASE-2024-001');
      expect(report.metadata.jurisdiction).toBe('Federal');
    });

    test('should generate unique report IDs', async () => {
      const result1 = await generator.generateReport({}, { format: 'json' });
      const result2 = await generator.generateReport({}, { format: 'json' });

      const report1 = JSON.parse(result1.content);
      const report2 = JSON.parse(result2.content);

      expect(report1.id).not.toBe(report2.id);
    });

    test('should include generation timestamp', async () => {
      const before = new Date();
      const result = await generator.generateReport({}, { format: 'json' });
      const after = new Date();

      const report = JSON.parse(result.content);
      const generated = new Date(report.generatedAt);

      expect(generated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(generated.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('Report Metrics', () => {
    test('should calculate word count', async () => {
      const evidence = {
        contentAnalysis: {
          title: 'Example',
          description: 'This is a test description with multiple words'
        }
      };

      const result = await generator.generateReport(evidence, {
        format: 'json'
      });

      expect(result.metrics.wordCount).toBeGreaterThan(0);
    });

    test('should count evidence items', async () => {
      const evidence = {
        screenshots: [{}, {}, {}],
        networkRequests: [{}, {}]
      };

      const result = await generator.generateReport(evidence, {
        format: 'json'
      });

      expect(result.metrics.evidenceItems).toBeGreaterThan(0);
    });

    test('should count included sections', async () => {
      const evidence = {
        screenshots: [{}],
        technologies: [{}],
        networkRequests: [{}]
      };

      const result = await generator.generateReport(evidence, {
        format: 'json',
        includeScreenshots: true,
        includeTechnologies: true,
        includeNetworkCapture: true,
        includeTimeline: false
      });

      expect(result.metrics.sections).toBe(3);
    });
  });

  describe('File Operations', () => {
    test('should save report to file', async () => {
      const result = await generator.generateReport({}, {
        title: 'Test Report',
        format: 'json'
      });

      const content = result.content;
      const filepath = await generator.saveReport(content, 'test_report', 'json');

      expect(filepath).toBeDefined();
      expect(filepath).toContain('test_report');
      expect(filepath).toContain('.json');
    });

    test('should estimate page count correctly', async () => {
      const largeEvidence = {
        contentAnalysis: {
          textContent: 'word '.repeat(1000) // Large document
        }
      };

      const result = await generator.generateReport(largeEvidence, {
        format: 'html'
      });

      expect(result.pageCount).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment', () => {
    test('should identify critical risk factors', async () => {
      const suspiciousEvidence = {
        contentAnalysis: {
          suspiciousElements: ['Malware detected', 'Phishing attempt']
        }
      };

      const result = await generator.generateReport(suspiciousEvidence, {
        format: 'json'
      });

      const report = JSON.parse(result.content);
      expect(report.executiveSummary.riskAssessment.level).toBeDefined();
      expect(report.executiveSummary.riskAssessment.score).toBeGreaterThanOrEqual(0);
    });

    test('should assess HTTPS compliance risk', async () => {
      const insecureEvidence = {
        networkRequests: [
          { url: 'http://example.com', status: 200 }
        ]
      };

      const result = await generator.generateReport(insecureEvidence, {
        format: 'json'
      });

      const report = JSON.parse(result.content);
      expect(report.executiveSummary.riskAssessment.factors).toBeDefined();
    });
  });

  describe('Compliance Sections', () => {
    test('should include GDPR compliance when requested', async () => {
      const result = await generator.generateReport({}, {
        format: 'json',
        gdprCompliant: true
      });

      const report = JSON.parse(result.content);
      expect(report.compliance.standards).toContain('GDPR - Data Protection Regulation');
    });

    test('should include HIPAA compliance when requested', async () => {
      const result = await generator.generateReport({}, {
        format: 'json',
        hipaaCompliant: true
      });

      const report = JSON.parse(result.content);
      expect(report.compliance.standards).toContain('HIPAA - Health Insurance Portability and Accountability Act');
    });

    test('should include SOX compliance when requested', async () => {
      const result = await generator.generateReport({}, {
        format: 'json',
        soxCompliant: true
      });

      const report = JSON.parse(result.content);
      expect(report.compliance.standards).toContain('SOX - Sarbanes-Oxley Act');
    });

    test('should always include ISO 27037', async () => {
      const result = await generator.generateReport({}, { format: 'json' });

      const report = JSON.parse(result.content);
      expect(report.compliance.standards).toContain('ISO/IEC 27037:2012 - Digital forensics');
    });
  });
});

describe('Format Validators', () => {
  describe('HTMLFormatter', () => {
    test('should escape HTML entities', () => {
      const formatter = new HTMLFormatter();
      const testStr = '<script>alert("xss")</script>';
      const escaped = formatter._escapeHtml(testStr);

      expect(escaped).not.toContain('<script>');
      expect(escaped).toContain('&lt;');
    });

    test('should format bytes correctly', () => {
      const formatter = new HTMLFormatter();
      expect(formatter._formatBytes(1024)).toContain('KB');
      expect(formatter._formatBytes(1048576)).toContain('MB');
      expect(formatter._formatBytes(0)).toBe('0 B');
    });
  });

  describe('JSONFormatter', () => {
    test('should produce valid JSON', async () => {
      const formatter = new JSONFormatter();
      const report = { title: 'Test', id: '123', sections: {} };

      const json = await formatter.format(report);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('MarkdownFormatter', () => {
    test('should produce valid Markdown', async () => {
      const formatter = new MarkdownFormatter();
      const report = {
        title: 'Test Report',
        generatedAt: new Date().toISOString(),
        metadata: { investigator: 'Test' },
        executiveSummary: {
          overview: { briefSummary: 'Test' },
          riskAssessment: { level: 'LOW', score: 10, factors: [] },
          keyFindings: []
        },
        sections: { technologies: null, timeline: null },
        chainOfCustody: { entries: [] },
        signatures: {}
      };

      const md = await formatter.format(report);
      expect(md).toContain('# Test Report');
      expect(md).toContain('## ');
    });
  });

  describe('CSVFormatter', () => {
    test('should escape CSV special characters', () => {
      const formatter = new CSVFormatter();
      const testStr = 'value,with,"quotes"';
      const escaped = formatter._escapeCsv(testStr);

      expect(escaped).toContain('"');
    });
  });
});

describe('Performance', () => {
  test('report generation should complete within 2 seconds', async () => {
    const generator = new ReportGenerator();
    const evidence = {
      screenshots: Array(50).fill({ url: 'https://example.com' }),
      technologies: Array(100).fill({ name: 'Tech' }),
      networkRequests: Array(500).fill({ url: 'https://example.com' })
    };

    const start = Date.now();
    await generator.generateReport(evidence, { format: 'json' });
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(2000);
  });

  test('should handle large evidence packages', async () => {
    const generator = new ReportGenerator();
    const largeEvidence = {
      url: 'https://example.com',
      contentAnalysis: {
        textContent: 'word '.repeat(10000)
      },
      screenshots: Array(100).fill({ url: 'https://example.com' })
    };

    const result = await generator.generateReport(largeEvidence, { format: 'json' });
    expect(result.success).toBe(true);
    expect(result.contentSize).toBeGreaterThan(0);
  });
});

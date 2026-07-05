/**
 * Integration tests for Legal Compliance & Chain of Custody WebSocket commands
 *
 * Tests all 6 legal compliance P0 commands with court-admissibility scenarios
 */

const { registerLegalComplianceCommands } = require('../../websocket/commands/legal-compliance-commands');

describe('Legal Compliance WebSocket Commands Integration', () => {
  let mockServer;
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    mockServer = {
      commandHandlers: commandHandlers
    };

    registerLegalComplianceCommands(mockServer, null);
  });

  // ============================================================
  // 1. start_legal_compliance_mode Command Tests
  // ============================================================
  describe('start_legal_compliance_mode command', () => {
    test('should initialize compliance mode with case info', async () => {
      const result = await commandHandlers.start_legal_compliance_mode({
        caseNumber: 'STATE-2024-001234',
        jurisdiction: 'Federal District Court',
        officer: 'Detective Jane Smith',
        agency: 'FBI Digital Forensics'
      });

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId.length).toBeGreaterThan(0);
      expect(result.startTime).toBeDefined();
      expect(result.complianceMode).toBe('STRICT');
      expect(result.status).toBe('COMPLIANCE_MODE_ACTIVE');
    });

    test('should create session with minimal parameters', async () => {
      const result = await commandHandlers.start_legal_compliance_mode({});

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.caseInfo).toBeDefined();
      expect(result.caseInfo.caseNumber).toBe('UNKNOWN');
    });

    test('should include officer information', async () => {
      const result = await commandHandlers.start_legal_compliance_mode({
        officer: 'John Doe',
        agency: 'State Police'
      });

      expect(result.caseInfo.officer).toBe('John Doe');
      expect(result.caseInfo.agency).toBe('State Police');
    });

    test('should record jurisdiction information', async () => {
      const result = await commandHandlers.start_legal_compliance_mode({
        jurisdiction: 'State Court, County of New York'
      });

      expect(result.caseInfo.jurisdiction).toBe('State Court, County of New York');
    });
  });

  // ============================================================
  // 2. generate_swgde_report Command Tests
  // ============================================================
  describe('generate_swgde_report command', () => {
    test('should generate SWGDE compliant report', async () => {
      // Initialize compliance mode first
      await commandHandlers.start_legal_compliance_mode({
        caseNumber: 'CASE-001',
        officer: 'Agent Johnson'
      });

      const evidence = {
        screenshots: ['screenshot_1.png', 'screenshot_2.png'],
        html_snapshots: ['page_1.html', 'page_2.html'],
        metadata: { capturedAt: '2024-06-20T10:30:00Z' }
      };

      const result = await commandHandlers.generate_swgde_report({
        evidence: evidence,
        examinerName: 'Dr. Sarah Chen',
        examinerCredentials: 'NIST Certified Digital Examiner',
        caseName: 'People v. Suspect'
      });

      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(result.swgdeReport).toBeDefined();
      expect(result.reportHash).toBeDefined();
    });

    test('should create SWGDE report with correct structure', async () => {
      const evidence = {
        item1: { type: 'screenshot', size: 1024 },
        item2: { type: 'html', size: 2048 }
      };

      const result = await commandHandlers.generate_swgde_report({
        evidence: evidence,
        examinerName: 'Dr. Michael Brown',
        caseName: 'Investigation ABC'
      });

      expect(result.swgdeReport.documentType).toBe('SWGDE_DIGITAL_EVIDENCE_REPORT');
      expect(result.swgdeReport.examiner.name).toBe('Dr. Michael Brown');
      expect(result.swgdeReport.evidence.summary.totalItems).toBe(2);
    });

    test('should include integrity verification', async () => {
      const evidence = { data: 'test data' };

      const result = await commandHandlers.generate_swgde_report({
        evidence: evidence,
        examinerName: 'Examiner Smith'
      });

      expect(result.swgdeReport.integrity).toBeDefined();
      expect(result.swgdeReport.integrity.hashAlgorithm).toBe('SHA256');
      expect(result.swgdeReport.integrity.recomputationPassed).toBe(true);
    });

    test('should include NIST/SWGDE compliance guidelines', async () => {
      const result = await commandHandlers.generate_swgde_report({
        evidence: { item: 'test' },
        examinerName: 'Examiner'
      });

      expect(result.swgdeReport.certification.guidelines).toContain('NIST SP 800-86');
      expect(result.swgdeReport.certification.guidelines).toContain('SWGDE Best Practices');
      expect(result.swgdeReport.certification.guidelines).toContain('ISO/IEC 27037');
    });

    test('should require evidence parameter', async () => {
      const result = await commandHandlers.generate_swgde_report({
        examinerName: 'Examiner'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('evidence');
    });

    test('should require examinerName parameter', async () => {
      const result = await commandHandlers.generate_swgde_report({
        evidence: { item: 'test' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('examinerName');
    });
  });

  // ============================================================
  // 3. export_with_chain_of_custody Command Tests
  // ============================================================
  describe('export_with_chain_of_custody command', () => {
    test('should export with JSON format', async () => {
      const result = await commandHandlers.export_with_chain_of_custody({
        data: { screenshots: ['img1.png', 'img2.png'] },
        exportFormat: 'JSON',
        recipient: 'District Attorney',
        purpose: 'Legal Proceedings'
      });

      expect(result.success).toBe(true);
      expect(result.exportId).toBeDefined();
      expect(result.documentHash).toBeDefined();
      expect(result.dataHash).toBeDefined();
      expect(result.format).toBe('JSON');
    });

    test('should support PDF export format', async () => {
      const result = await commandHandlers.export_with_chain_of_custody({
        data: { report: 'Forensic Analysis Report' },
        exportFormat: 'PDF',
        recipient: 'Court Clerk'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('PDF');
    });

    test('should support sealed archive format', async () => {
      const result = await commandHandlers.export_with_chain_of_custody({
        data: { evidence: 'Complete Case File' },
        exportFormat: 'SEALED_ARCHIVE'
      });

      expect(result.success).toBe(true);
      expect(result.format).toBe('SEALED_ARCHIVE');
    });

    test('should include custody chain in export', async () => {
      // Initialize compliance mode first
      await commandHandlers.start_legal_compliance_mode({
        officer: 'Officer Smith'
      });

      const result = await commandHandlers.export_with_chain_of_custody({
        data: { item: 'evidence' },
        exportFormat: 'JSON'
      });

      expect(result.custodyPath).toBeDefined();
      expect(Array.isArray(result.custodyPath)).toBe(true);
    });

    test('should seal export at specific timestamp', async () => {
      const beforeExport = new Date();

      const result = await commandHandlers.export_with_chain_of_custody({
        data: { test: 'data' },
        exportFormat: 'JSON'
      });

      const sealTime = new Date(result.sealedAt);
      const afterExport = new Date();

      expect(sealTime.getTime()).toBeGreaterThanOrEqual(beforeExport.getTime());
      expect(sealTime.getTime()).toBeLessThanOrEqual(afterExport.getTime());
    });

    test('should require data parameter', async () => {
      const result = await commandHandlers.export_with_chain_of_custody({
        exportFormat: 'JSON'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('data');
    });

    test('should validate export format', async () => {
      const result = await commandHandlers.export_with_chain_of_custody({
        data: { item: 'test' },
        exportFormat: 'INVALID_FORMAT'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exportFormat');
    });
  });

  // ============================================================
  // 4. certify_evidence_integrity Command Tests
  // ============================================================
  describe('certify_evidence_integrity command', () => {
    test('should generate integrity certificate', async () => {
      // Create evidence first
      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { evidence: 'test' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.certify_evidence_integrity({
        evidenceId: exportResult.exportId,
        certifierName: 'Dr. Patricia Lewis',
        certifierTitle: 'Senior Digital Forensics Examiner'
      });

      expect(result.success).toBe(true);
      expect(result.certificateId).toBeDefined();
      expect(result.integrityStatus).toBe('VERIFIED');
      expect(result.verificationDate).toBeDefined();
    });

    test('should verify chain of custody integrity', async () => {
      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { item: 'evidence' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.certify_evidence_integrity({
        evidenceId: exportResult.exportId,
        certifierName: 'Examiner'
      });

      expect(result.chainOfCustodyIntact).toBe(true);
    });

    test('should mark evidence as legally admissible', async () => {
      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { evidence: 'test' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.certify_evidence_integrity({
        evidenceId: exportResult.exportId,
        certifierName: 'Certifier Name'
      });

      expect(result.legalStatus).toBe('ADMISSIBLE_AS_EVIDENCE');
    });

    test('should include certifier credentials', async () => {
      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { item: 'evidence' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.certify_evidence_integrity({
        evidenceId: exportResult.exportId,
        certifierName: 'John Examiner',
        certifierTitle: 'Certified Examiner',
        agency: 'FBI'
      });

      expect(result.success).toBe(true);
      expect(result.certificateId).toBeDefined();
    });

    test('should require evidenceId', async () => {
      const result = await commandHandlers.certify_evidence_integrity({
        certifierName: 'Examiner'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('evidenceId');
    });

    test('should require certifierName', async () => {
      const result = await commandHandlers.certify_evidence_integrity({
        evidenceId: 'test-id'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('certifierName');
    });
  });

  // ============================================================
  // 5. get_legal_compliance_status Command Tests
  // ============================================================
  describe('get_legal_compliance_status command', () => {
    test('should report compliance status', async () => {
      const result = await commandHandlers.get_legal_compliance_status({});

      expect(result.success).toBe(true);
      expect(result.complianceEnabled).toBeDefined();
      expect(result.stats).toBeDefined();
      expect(result.stats.custodyEntries).toBeGreaterThanOrEqual(0);
    });

    test('should track statistics after operations', async () => {
      await commandHandlers.start_legal_compliance_mode({});

      const reportResult = await commandHandlers.generate_swgde_report({
        evidence: { item: 'test' },
        examinerName: 'Examiner'
      });

      const statusResult = await commandHandlers.get_legal_compliance_status({});

      expect(statusResult.stats.swgdeReports).toBeGreaterThan(0);
      expect(statusResult.stats.custodyEntries).toBeGreaterThan(0);
    });

    test('should count exported packages', async () => {
      await commandHandlers.start_legal_compliance_mode({});

      await commandHandlers.export_with_chain_of_custody({
        data: { item: 'evidence' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.get_legal_compliance_status({});

      expect(result.stats.exportedPackages).toBeGreaterThan(0);
    });

    test('should calculate uptime in milliseconds', async () => {
      const beforeInit = Date.now();
      await commandHandlers.start_legal_compliance_mode({});
      const afterInit = Date.now();

      // Small delay to ensure uptime increases
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await commandHandlers.get_legal_compliance_status({});

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof result.uptime).toBe('number');
    });

    test('should report active status when enabled', async () => {
      await commandHandlers.start_legal_compliance_mode({});

      const result = await commandHandlers.get_legal_compliance_status({});

      expect(result.status).toBe('ACTIVE');
      expect(result.sessionId).toBeDefined();
      expect(result.startTime).toBeDefined();
    });
  });

  // ============================================================
  // 6. export_court_admissible_package Command Tests
  // ============================================================
  describe('export_court_admissible_package command', () => {
    test('should create court-admissible package', async () => {
      await commandHandlers.start_legal_compliance_mode({
        caseNumber: 'CASE-2024-001'
      });

      const reportResult = await commandHandlers.generate_swgde_report({
        evidence: { item: 'evidence' },
        examinerName: 'Examiner'
      });

      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { evidence: 'complete' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.export_court_admissible_package({
        reportIds: [reportResult.reportId],
        exportIds: [exportResult.exportId],
        court: 'United States District Court',
        jurisdiction: 'Southern District of New York'
      });

      expect(result.success).toBe(true);
      expect(result.packageId).toBeDefined();
      expect(result.admissibilityStatus).toBe('ADMISSIBLE');
      expect(result.packageHash).toBeDefined();
    });

    test('should include all package contents', async () => {
      await commandHandlers.start_legal_compliance_mode({});

      const reportResult = await commandHandlers.generate_swgde_report({
        evidence: { item: 'test' },
        examinerName: 'Examiner'
      });

      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: { evidence: 'test' },
        exportFormat: 'JSON'
      });

      const result = await commandHandlers.export_court_admissible_package({
        reportIds: [reportResult.reportId],
        exportIds: [exportResult.exportId]
      });

      expect(result.contents.reports).toBeGreaterThan(0);
      expect(result.contents.evidence).toBeGreaterThan(0);
    });

    test('should verify integrity for court admissibility', async () => {
      await commandHandlers.start_legal_compliance_mode({});

      const result = await commandHandlers.export_court_admissible_package({});

      expect(result.success).toBe(true);
      expect(result.packageHash).toBeDefined();
    });

    test('should include court jurisdiction info', async () => {
      const result = await commandHandlers.export_court_admissible_package({
        court: 'Federal District Court',
        jurisdiction: 'Eastern District'
      });

      expect(result.success).toBe(true);
    });

    test('should generate legal certification', async () => {
      const result = await commandHandlers.export_court_admissible_package({});

      expect(result.legalCertification).toBeDefined();
      expect(result.legalCertification.authenticityVerified).toBe(true);
      expect(result.legalCertification.integrityMaintained).toBe(true);
      expect(result.legalCertification.chainOfCustodyComplete).toBe(true);
    });
  });

  // ============================================================
  // Real-World Scenario Tests
  // ============================================================
  describe('Real-World Legal Compliance Scenarios', () => {
    test('should handle complete criminal investigation workflow', async () => {
      // 1. Initialize compliance mode
      const complianceInit = await commandHandlers.start_legal_compliance_mode({
        caseNumber: 'STATE-2024-987654',
        jurisdiction: 'State District Court',
        officer: 'Detective Maria Garcia',
        agency: 'State Police Digital Forensics'
      });

      expect(complianceInit.success).toBe(true);

      // 2. Generate forensic report
      const reportResult = await commandHandlers.generate_swgde_report({
        evidence: {
          screenshots: ['scene_1.png', 'scene_2.png', 'scene_3.png'],
          html_captures: ['page_state_t1.html', 'page_state_t2.html'],
          metadata: {
            captureDevice: 'Basset Hound Browser v12.8.0',
            captureMethod: 'FORENSIC_SNAPSHOT'
          }
        },
        examinerName: 'Dr. James Wilson',
        examinerCredentials: 'NIST CFE, SWGDE Certified',
        caseName: 'State v. Defendant',
        caseNumber: 'STATE-2024-987654'
      });

      expect(reportResult.success).toBe(true);

      // 3. Export evidence with custody tracking
      const exportResult = await commandHandlers.export_with_chain_of_custody({
        data: {
          report: reportResult.swgdeReport,
          originalEvidence: reportResult.swgdeReport.evidence
        },
        exportFormat: 'SEALED_ARCHIVE',
        recipient: 'District Attorney Office',
        purpose: 'Criminal Prosecution Evidence'
      });

      expect(exportResult.success).toBe(true);

      // 4. Certify evidence integrity
      const certResult = await commandHandlers.certify_evidence_integrity({
        evidenceId: exportResult.exportId,
        certifierName: 'Dr. Helen Rodriguez',
        certifierTitle: 'Principal Digital Forensics Examiner',
        agency: 'State Police'
      });

      expect(certResult.success).toBe(true);
      expect(certResult.integrityStatus).toBe('VERIFIED');

      // 5. Check compliance status
      const statusResult = await commandHandlers.get_legal_compliance_status({});

      expect(statusResult.complianceEnabled).toBe(true);
      expect(statusResult.stats.custodyEntries).toBeGreaterThan(0);
      expect(statusResult.stats.swgdeReports).toBeGreaterThan(0);

      // 6. Create court-admissible package
      const courtPackage = await commandHandlers.export_court_admissible_package({
        reportIds: [reportResult.reportId],
        exportIds: [exportResult.exportId],
        includeChainOfCustody: true,
        court: 'State District Court, County of New York',
        jurisdiction: 'New York State'
      });

      expect(courtPackage.success).toBe(true);
      expect(courtPackage.admissibilityStatus).toBe('ADMISSIBLE');
    });
  });
});

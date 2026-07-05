/**
 * Legal Compliance End-to-End Integration Tests
 * Tests WebSocket command handling for compliance features
 */

const LegalComplianceCommands = require('../../../websocket/commands/phase2-p0-legal-compliance-commands');

describe('Legal Compliance E2E Integration Tests', () => {
  let commands;

  beforeEach(() => {
    commands = new LegalComplianceCommands({});
  });

  describe('start_legal_compliance_mode Integration', () => {
    test('should handle WebSocket command for starting compliance mode', async () => {
      const params = {
        jurisdiction: 'us',
        standards: ['swgde', 'iso27037'],
        certification_level: 'chain-of-custody'
      };

      const result = await commands.startLegalComplianceMode(params);

      expect(result.success).toBe(true);
      expect(result.command).toBe('start_legal_compliance_mode');
      expect(result.data.mode_status).toBe('active');
      expect(result.timestamp).toBeDefined();
    });

    test('should return proper error response for invalid jurisdiction', async () => {
      const params = {
        jurisdiction: 'invalid',
        standards: ['swgde'],
        certification_level: 'basic'
      };

      const result = await commands.startLegalComplianceMode(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should include capabilities in response', async () => {
      const params = {
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      };

      const result = await commands.startLegalComplianceMode(params);

      expect(result.data.capabilities).toBeDefined();
      expect(result.data.capabilities.swgde_reports).toBe(true);
    });
  });

  describe('generate_swgde_report Integration', () => {
    beforeEach(async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });
    });

    test('should handle SWGDE report generation command', async () => {
      const params = {
        evidence_package_id: 'pkg_001',
        case_number: '2026-001',
        examiner_name: 'Dr. Jane Smith',
        examiner_credentials: 'CFCE, EnCE',
        output_format: 'json'
      };

      const result = await commands.generateSWGDEReport(params);

      expect(result.success).toBe(true);
      expect(result.command).toBe('generate_swgde_report');
      expect(result.data.report).toBeDefined();
      expect(result.data.metadata).toBeDefined();
      expect(result.data.certification).toBeDefined();
    });

    test('should generate report in multiple formats', async () => {
      const baseParams = {
        evidence_package_id: 'pkg_001',
        case_number: '2026-001',
        examiner_name: 'Dr. Jane Smith',
        examiner_credentials: 'CFCE, EnCE'
      };

      // Test JSON format
      const jsonResult = await commands.generateSWGDEReport({
        ...baseParams,
        output_format: 'json'
      });
      expect(jsonResult.success).toBe(true);

      // Test HTML format
      const htmlResult = await commands.generateSWGDEReport({
        ...baseParams,
        output_format: 'html'
      });
      expect(htmlResult.success).toBe(true);

      // Test PDF format
      const pdfResult = await commands.generateSWGDEReport({
        ...baseParams,
        output_format: 'pdf'
      });
      expect(pdfResult.success).toBe(true);
    });

    test('should validate required parameters', async () => {
      const params = {
        evidence_package_id: 'pkg_001',
        case_number: '2026-001',
        // Missing examiner_name and examiner_credentials
        output_format: 'json'
      };

      const result = await commands.generateSWGDEReport(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should include audit trail in audit log', async () => {
      await commands.generateSWGDEReport({
        evidence_package_id: 'pkg_001',
        case_number: '2026-001',
        examiner_name: 'Dr. Jane Smith',
        examiner_credentials: 'CFCE, EnCE',
        output_format: 'json'
      });

      const manager = commands.getComplianceManager();
      const auditLog = manager.getAuditLog();

      expect(auditLog.some(entry => entry.eventType === 'REPORT_GENERATED')).toBe(true);
    });
  });

  describe('export_with_chain_of_custody Integration', () => {
    beforeEach(async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });

      // Register some evidence
      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test screenshot'
      });

      commands.registerEvidence({
        id: 'ev_002',
        type: 'har',
        content: 'test har'
      });
    });

    test('should export evidence with chain of custody', async () => {
      const params = {
        evidence_ids: ['ev_001', 'ev_002'],
        format: 'pdf',
        include_audit_log: true,
        include_metadata: true,
        certify_integrity: true
      };

      const result = await commands.exportWithChainOfCustody(params);

      expect(result.success).toBe(true);
      expect(result.command).toBe('export_with_chain_of_custody');
      expect(result.data.package).toBeDefined();
      expect(result.data.chain_of_custody).toBeDefined();
    });

    test('should include audit log in export', async () => {
      const params = {
        evidence_ids: ['ev_001'],
        format: 'zip',
        include_audit_log: true,
        certify_integrity: false
      };

      const result = await commands.exportWithChainOfCustody(params);

      expect(result.data.chain_of_custody.audit_log).toBeDefined();
      expect(Array.isArray(result.data.chain_of_custody.audit_log)).toBe(true);
    });

    test('should certify integrity when requested', async () => {
      const params = {
        evidence_ids: ['ev_001', 'ev_002'],
        format: 'pdf',
        certify_integrity: true
      };

      const result = await commands.exportWithChainOfCustody(params);

      expect(result.data.chain_of_custody.integrity_certificate).toBeDefined();
      expect(result.data.chain_of_custody.integrity_certificate.hash).toBeDefined();
      expect(result.data.chain_of_custody.integrity_certificate.verified).toBe(true);
    });

    test('should handle empty evidence list', async () => {
      const params = {
        evidence_ids: [],
        format: 'zip',
        include_audit_log: true,
        certify_integrity: false
      };

      const result = await commands.exportWithChainOfCustody(params);

      expect(result.success).toBe(true);
      expect(result.data.package.evidence_count).toBe(0);
    });
  });

  describe('certify_evidence_integrity Integration', () => {
    beforeEach(async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });

      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test content'
      });
    });

    test('should certify evidence integrity', async () => {
      const params = {
        evidence_id: 'ev_001',
        certification_type: 'sha256',
        include_timestamp: true
      };

      const result = await commands.certifyEvidenceIntegrity(params);

      expect(result.success).toBe(true);
      expect(result.command).toBe('certify_evidence_integrity');
      expect(result.data.certification).toBeDefined();
      expect(result.data.certification.hash).toBeDefined();
    });

    test('should support multiple certification types', async () => {
      const baseParams = {
        evidence_id: 'ev_001',
        include_timestamp: true
      };

      // Test SHA256
      const sha256Result = await commands.certifyEvidenceIntegrity({
        ...baseParams,
        certification_type: 'sha256'
      });
      expect(sha256Result.success).toBe(true);

      // Test SHA256-TIMESTAMP
      const timestampResult = await commands.certifyEvidenceIntegrity({
        ...baseParams,
        certification_type: 'sha256-timestamp'
      });
      expect(timestampResult.success).toBe(true);
    });

    test('should include verification details', async () => {
      const params = {
        evidence_id: 'ev_001',
        certification_type: 'sha256'
      };

      const result = await commands.certifyEvidenceIntegrity(params);

      expect(result.data.certification.verification_details).toBeDefined();
      expect(result.data.certification.verified).toBe(true);
    });
  });

  describe('get_legal_compliance_status Integration', () => {
    test('should return status when compliance inactive', async () => {
      const result = await commands.getLegalComplianceStatus({});

      expect(result.success).toBe(true);
      expect(result.data.mode_active).toBe(false);
    });

    test('should return full status when compliance active', async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'basic'
      });

      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });

      const result = await commands.getLegalComplianceStatus({});

      expect(result.success).toBe(true);
      expect(result.data.mode_active).toBe(true);
      expect(result.data.jurisdiction).toBe('us');
      expect(result.data.evidence_count).toBeGreaterThan(0);
      expect(result.data.compliance_score).toBeGreaterThan(0);
    });

    test('should include recommendations in status', async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });

      const result = await commands.getLegalComplianceStatus({});

      expect(result.data.recommendations).toBeDefined();
      expect(Array.isArray(result.data.recommendations)).toBe(true);
    });
  });

  describe('export_court_admissible_package Integration', () => {
    beforeEach(async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });

      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test'
      });
    });

    test('should export court-admissible package', async () => {
      const params = {
        evidence_ids: ['ev_001'],
        case_info: {
          case_number: '2026-001',
          jurisdiction: 'us',
          examiner_name: 'Dr. Jane Smith',
          examiner_credentials: 'CFCE, EnCE',
          defense_counsel_notified: true
        },
        certification_level: 'forensic',
        output_format: 'pdf'
      };

      const result = await commands.exportCourtAdmissiblePackage(params);

      expect(result.success).toBe(true);
      expect(result.command).toBe('export_court_admissible_package');
      expect(result.data.manifest).toBeDefined();
      expect(result.data.manifest.certification_info.ready_for_court).toBe(true);
    });

    test('should validate required case information', async () => {
      const params = {
        evidence_ids: ['ev_001'],
        case_info: {
          case_number: '2026-001'
          // Missing required fields
        },
        output_format: 'pdf'
      };

      const result = await commands.exportCourtAdmissiblePackage(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should include full certification chain', async () => {
      const params = {
        evidence_ids: ['ev_001'],
        case_info: {
          case_number: '2026-001',
          jurisdiction: 'us',
          examiner_name: 'Dr. Jane Smith',
          examiner_credentials: 'CFCE, EnCE'
        },
        output_format: 'zip'
      };

      const result = await commands.exportCourtAdmissiblePackage(params);

      expect(result.data.manifest.certification_info).toBeDefined();
      expect(result.data.manifest.certification_info.standards_compliant).toContain('swgde');
      expect(result.data.manifest.file_integrity.verified).toBe(true);
    });

    test('should generate court-ready packages with proper structure', async () => {
      const params = {
        evidence_ids: ['ev_001'],
        case_info: {
          case_number: '2026-001',
          jurisdiction: 'us',
          examiner_name: 'Dr. Jane Smith',
          examiner_credentials: 'CFCE, EnCE'
        },
        output_format: 'pdf'
      };

      const result = await commands.exportCourtAdmissiblePackage(params);

      expect(result.data.package_hash).toBeDefined();
      expect(result.data.manifest).toBeDefined();
      expect(result.data.manifest.case_number).toBe('2026-001');
    });
  });

  describe('Cross-Command Integration', () => {
    test('should maintain state across multiple commands', async () => {
      // Start compliance
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });

      // Register evidence
      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'test 1'
      });

      commands.registerEvidence({
        id: 'ev_002',
        type: 'har',
        content: 'test 2'
      });

      // Generate report
      await commands.generateSWGDEReport({
        evidence_package_id: 'pkg_001',
        case_number: '2026-001',
        examiner_name: 'Dr. Jane Smith',
        examiner_credentials: 'CFCE, EnCE',
        output_format: 'json'
      });

      // Verify status includes all activities
      const statusResult = await commands.getLegalComplianceStatus({});

      expect(statusResult.data.evidence_count).toBe(2);
      expect(statusResult.data.reports_generated).toBeGreaterThan(0);
      expect(statusResult.data.audit_log_entries).toBeGreaterThan(3);
    });

    test('should handle workflow: start -> register -> export', async () => {
      // Workflow: compliance -> evidence -> export
      const complianceStart = await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'chain-of-custody'
      });
      expect(complianceStart.success).toBe(true);

      commands.registerEvidence({
        id: 'ev_001',
        type: 'screenshot',
        content: 'evidence content'
      });

      const exportResult = await commands.exportCourtAdmissiblePackage({
        evidence_ids: ['ev_001'],
        case_info: {
          case_number: '2026-001',
          jurisdiction: 'us',
          examiner_name: 'Dr. Jane Smith',
          examiner_credentials: 'CFCE, EnCE'
        },
        output_format: 'pdf'
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.data.manifest.evidence_items).toBe(1);
    });
  });

  describe('Error Handling & Edge Cases', () => {
    test('should handle missing parameters gracefully', async () => {
      const result = await commands.startLegalComplianceMode({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle null parameters', async () => {
      const result = await commands.startLegalComplianceMode(null);

      expect(result.success).toBe(false);
    });

    test('should provide timestamps for all responses', async () => {
      const result = await commands.getLegalComplianceStatus({});

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).toBeGreaterThan(0);
    });

    test('should handle evidence that no longer exists', async () => {
      await commands.startLegalComplianceMode({
        jurisdiction: 'us',
        standards: ['swgde'],
        certification_level: 'basic'
      });

      const result = await commands.exportWithChainOfCustody({
        evidence_ids: ['non_existent_id'],
        format: 'pdf'
      });

      // Should handle gracefully
      expect(result.command).toBe('export_with_chain_of_custody');
    });
  });
});

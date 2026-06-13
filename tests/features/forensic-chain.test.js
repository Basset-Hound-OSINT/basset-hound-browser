/**
 * Tests for Forensic Evidence Chain Feature (Wave 16 Phase 6)
 * Tests immutable evidence logging, timestamp verification, chain of custody,
 * and legal-grade forensic reporting.
 */

const {
  ForensicChainManager,
  Evidence,
  ChainOfCustodyManager,
  TimestampAuthority,
  ForensicReportGenerator,
  ComplianceValidator
} = require('../../src/features/forensic-chain');

describe('Forensic Evidence Chain - Wave 16 Phase 6', () => {
  let manager;
  const evidenceId = 'evidence-001';
  const collectorId = 'investigator-001';
  const userId1 = 'user-001';
  const userId2 = 'user-002';

  beforeEach(() => {
    manager = new ForensicChainManager();
  });

  // ==========================================
  // EVIDENCE CREATION & INTEGRITY
  // ==========================================

  describe('Evidence Creation', () => {
    test('should create new evidence with metadata', () => {
      const data = {
        url: 'https://example.com',
        screenshot: 'base64...',
        metadata: { description: 'Screenshot of login page' }
      };

      const result = manager.captureEvidence(evidenceId, data, collectorId, {
        type: 'screenshot',
        location: 'login-page'
      });

      expect(result.success).toBe(true);
      expect(result.evidenceId).toBe(evidenceId);
      expect(result.hash).toBeDefined();
      expect(result.captured).toBeDefined();
    });

    test('should reject duplicate evidence IDs', () => {
      const data = { content: 'test' };

      manager.captureEvidence(evidenceId, data, collectorId);
      const duplicate = manager.captureEvidence(evidenceId, data, collectorId);

      expect(duplicate.success).toBe(false);
      expect(duplicate.error).toBe('evidence-already-exists');
    });

    test('should generate reproducible hashes for same data', () => {
      const data = { content: 'test data' };

      const result1 = manager.captureEvidence('ev-001', data, collectorId);
      const result2 = manager.captureEvidence('ev-002', data, collectorId);

      expect(result1.hash).toBe(result2.hash);
    });
  });

  // ==========================================
  // INTEGRITY VERIFICATION
  // ==========================================

  describe('Integrity Verification', () => {
    beforeEach(() => {
      const data = { url: 'https://example.com', content: 'page content' };
      manager.captureEvidence(evidenceId, data, collectorId);
    });

    test('should verify evidence integrity', () => {
      const result = manager.verifyEvidence(evidenceId);

      expect(result.success).toBe(true);
      expect(result.integrity.valid).toBe(true);
      expect(result.integrity.compromised).toBe(false);
    });

    test('should verify custody seal status', () => {
      const result = manager.verifyEvidence(evidenceId);

      expect(result.custody).toBeDefined();
      expect(result.custody.sealed).toBe(false); // Initially not sealed
    });

    test('should reject verification of non-existent evidence', () => {
      const result = manager.verifyEvidence('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('evidence-not-found');
    });
  });

  // ==========================================
  // CHAIN OF CUSTODY
  // ==========================================

  describe('Chain of Custody', () => {
    let custodyManager;

    beforeEach(() => {
      custodyManager = new ChainOfCustodyManager();
      custodyManager.initiateChain(evidenceId, collectorId, 'Digital evidence');
    });

    test('should initiate chain of custody', () => {
      const chain = custodyManager.initiateChain('ev-new', 'collector-1', 'Test evidence');

      expect(chain.evidenceId).toBe('ev-new');
      expect(chain.initiator).toBe('collector-1');
      expect(chain.handlers.length).toBe(1);
      expect(chain.sealed).toBe(false);
    });

    test('should record custody transfers', () => {
      const result = custodyManager.transferCustody(
        evidenceId,
        collectorId,
        userId1,
        'For analysis'
      );

      expect(result.success).toBe(true);
      expect(result.transfer.from).toBe(collectorId);
      expect(result.transfer.to).toBe(userId1);
    });

    test('should record evidence access', () => {
      const result = custodyManager.recordAccess(
        evidenceId,
        userId1,
        'view',
        'Review investigation'
      );

      expect(result.success).toBe(true);
      expect(result.access.accessor).toBe(userId1);
      expect(result.access.action).toBe('view');
    });

    test('should prevent modifications after sealing', () => {
      custodyManager.sealChain(evidenceId, collectorId);

      const result = custodyManager.transferCustody(
        evidenceId,
        collectorId,
        userId1,
        'Should fail'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('chain-sealed');
    });

    test('should generate chain report', () => {
      custodyManager.transferCustody(evidenceId, collectorId, userId1, 'Analysis');
      custodyManager.recordAccess(evidenceId, userId1, 'view', 'Verification');

      const result = custodyManager.getChainReport(evidenceId);

      expect(result.success).toBe(true);
      expect(result.report.totalActions).toBe(3); // init + transfer + access
      expect(result.report.handlers).toBeDefined();
    });
  });

  // ==========================================
  // TIMESTAMP AUTHORITY (NOTARIZATION)
  // ==========================================

  describe('Timestamp Authority', () => {
    let authority;

    beforeEach(() => {
      authority = new TimestampAuthority();
    });

    test('should notarize evidence timestamp', () => {
      const timestamp = Date.now();
      const hash = 'abc123';

      const result = authority.notarizeTimestamp(evidenceId, timestamp, hash);

      expect(result.evidenceId).toBe(evidenceId);
      expect(result.timestamp).toBe(timestamp);
      expect(result.hash).toBe(hash);
      expect(result.signature).toBeDefined();
    });

    test('should create signature for timestamp', () => {
      const timestamp = Date.now();
      const hash = 'abc123';

      const notarization1 = authority.notarizeTimestamp('ev-1', timestamp, hash);
      const notarization2 = authority.notarizeTimestamp('ev-2', timestamp, hash);

      // Different evidence IDs should have different signatures
      expect(notarization1.signature).not.toBe(notarization2.signature);
    });

    test('should verify notarized timestamp', () => {
      const timestamp = Date.now();
      const hash = 'abc123';

      const notarization = authority.notarizeTimestamp(evidenceId, timestamp, hash);
      const verification = authority.verifyTimestamp(
        evidenceId,
        timestamp,
        hash,
        notarization.signature
      );

      expect(verification.valid).toBe(true);
      expect(verification.verified).toBe(true);
    });

    test('should reject invalid signatures', () => {
      const timestamp = Date.now();
      const hash = 'abc123';

      const verification = authority.verifyTimestamp(
        evidenceId,
        timestamp,
        hash,
        'invalid-signature'
      );

      expect(verification.valid).toBe(false);
    });
  });

  // ==========================================
  // FORENSIC EVIDENCE OBJECT
  // ==========================================

  describe('Evidence Class', () => {
    let evidence;

    beforeEach(() => {
      evidence = new Evidence(evidenceId, { url: 'https://example.com' }, collectorId);
    });

    test('should create immutable evidence object', () => {
      expect(evidence.id).toBe(evidenceId);
      expect(evidence.collector).toBe(collectorId);
      expect(evidence.hash).toBeDefined();

      // Data should be frozen (property cannot be modified)
      const originalUrl = evidence.data.url;
      evidence.data.url = 'modified';
      // In non-strict mode, the assignment fails silently
      expect(evidence.data.url).toBe(originalUrl);
    });

    test('should record access in chain of custody', () => {
      evidence.recordAccess(userId1, 'view', 'Evidence review');

      expect(evidence.chainOfCustody.length).toBe(1);
      expect(evidence.chainOfCustody[0].userId).toBe(userId1);
      expect(evidence.chainOfCustody[0].action).toBe('view');
    });

    test('should add and track tags', () => {
      evidence.addTag('suspicious');
      evidence.addTag('urgent');

      expect(evidence.tags).toContain('suspicious');
      expect(evidence.tags).toContain('urgent');
      expect(evidence.modifications.length).toBe(2); // Two tag additions
    });

    test('should store metadata', () => {
      evidence.setMetadata('location', 'login-page');
      evidence.setMetadata('timestamp', '2024-06-13T10:00:00Z');

      expect(evidence.metadata.location).toBe('login-page');
      expect(evidence.metadata.timestamp).toBe('2024-06-13T10:00:00Z');
    });

    test('should verify integrity', () => {
      const verification = evidence.verifyIntegrity();

      expect(verification.valid).toBe(true);
      expect(verification.compromised).toBe(false);
      expect(verification.expectedHash).toBe(verification.currentHash);
    });

    test('should provide snapshot', () => {
      evidence.addTag('test');
      const snapshot = evidence.getSnapshot();

      expect(snapshot.id).toBe(evidenceId);
      expect(snapshot.data).toBeDefined();
      expect(snapshot.hash).toBeDefined();
      expect(snapshot.tags).toContain('test');
      expect(snapshot.modifications).toBeDefined();
    });
  });

  // ==========================================
  // FORENSIC REPORTING
  // ==========================================

  describe('Forensic Report Generator', () => {
    let generator;
    let evidence;
    let custody;

    beforeEach(() => {
      generator = new ForensicReportGenerator();

      // Create evidence
      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId, {
        type: 'screenshot'
      });

      evidence = manager.evidence.get(evidenceId);
      custody = manager.custodyManager.getChainReport(evidenceId);
    });

    test('should generate ISO 27037 compliant report', () => {
      const report = generator.generateISO27037Report(evidence, custody.chain);

      expect(report.format).toBe('ISO 27037');
      expect(report.report.evidenceIdentification).toBeDefined();
      expect(report.report.collection).toBeDefined();
      expect(report.report.acquisition).toBeDefined();
      expect(report.report.preservation).toBeDefined();
    });

    test('should generate NIST compliant report', () => {
      const report = generator.generateNISTReport(evidence, custody.chain);

      expect(report.format).toBe('NIST SP 800-155');
      expect(report.report.digitalEvidence).toBeDefined();
      expect(report.report.securityConfiguration).toBeDefined();
    });

    test('should generate Daubert standard report', () => {
      const report = generator.generateDaubertReport(evidence, custody.chain);

      expect(report.format).toBe('Daubert Standard');
      expect(report.report.scientificValidity).toBeDefined();
      expect(report.report.evidenceAuthentication).toBeDefined();
      expect(report.report.relevance).toBeDefined();
    });

    test('should generate ACPO compliant report', () => {
      const report = generator.generateACPOReport(evidence, custody.chain);

      expect(report.format).toBe('ACPO');
      expect(report.report.principles).toBeDefined();
      expect(report.report.digitalEvidence).toBeDefined();
      expect(report.report.chainOfCustody).toBeDefined();
    });

    test('should generate multi-format report package', () => {
      const reportPackage = generator.generateReportPackage(evidence, custody.chain);

      expect(reportPackage.success).toBe(true);
      expect(reportPackage.reports.iso27037).toBeDefined();
      expect(reportPackage.reports.nist).toBeDefined();
      expect(reportPackage.reports.daubert).toBeDefined();
      expect(reportPackage.reports.acpo).toBeDefined();
    });
  });

  // ==========================================
  // FORENSIC CHAIN MANAGER
  // ==========================================

  describe('Forensic Chain Manager', () => {
    test('should capture evidence and return summary', () => {
      const data = { url: 'https://example.com', screenshot: 'data...' };

      const result = manager.captureEvidence(evidenceId, data, collectorId, {
        type: 'screenshot',
        description: 'Login page evidence'
      });

      expect(result.success).toBe(true);
      expect(result.evidenceId).toBe(evidenceId);
      expect(result.hash).toBeDefined();
      expect(result.notarization).toBeDefined();
      expect(result.custody).toBeDefined();
    });

    test('should generate forensic package', () => {
      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId);

      const result = manager.generateForensicPackage(evidenceId);

      expect(result.success).toBe(true);
      expect(result.reports).toBeDefined();
      expect(result.compliance).toBeDefined();
      expect(result.package).toBeDefined();
    });

    test('should seal evidence and prevent modifications', () => {
      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId);

      const sealResult = manager.sealEvidence(evidenceId, collectorId);
      expect(sealResult.success).toBe(true);

      // Try to transfer custody (should fail)
      const custody = manager.custodyManager.getChainReport(evidenceId);
      const transferResult = manager.custodyManager.transferCustody(
        evidenceId,
        collectorId,
        userId1,
        'After seal'
      );

      expect(transferResult.success).toBe(false);
    });

    test('should get evidence summary', () => {
      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId, {
        type: 'screenshot'
      });

      manager.accessEvidence(evidenceId, userId1, 'view', 'Verification');

      const result = manager.getEvidenceSummary(evidenceId);

      expect(result.success).toBe(true);
      expect(result.summary.id).toBe(evidenceId);
      expect(result.summary.captured).toBeDefined();
      expect(result.summary.collector).toBe(collectorId);
      expect(result.summary.integrity).toBe(true);
    });
  });

  // ==========================================
  // COMPLIANCE VALIDATION
  // ==========================================

  describe('Compliance Validator', () => {
    let validator;
    let evidence;
    let custody;

    beforeEach(() => {
      validator = new ComplianceValidator();

      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId);
      evidence = manager.evidence.get(evidenceId);
      custody = manager.custodyManager.getChainReport(evidenceId).chain;
    });

    test('should validate ISO 27037 compliance', () => {
      const result = validator.validateISO27037(evidence, custody);

      expect(result.compliant).toBeDefined();
      expect(result.checks.identification).toBeDefined();
      expect(result.checks.collection).toBeDefined();
      expect(result.checks.acquisition).toBeDefined();
      expect(result.checks.preservation).toBeDefined();
    });

    test('should validate NIST compliance', () => {
      const result = validator.validateNIST(evidence, custody);

      expect(result.compliant).toBeDefined();
      expect(result.checks.integrityVerification).toBeDefined();
      expect(result.checks.accessControl).toBeDefined();
      expect(result.checks.auditTrail).toBeDefined();
    });

    test('should validate Daubert standard', () => {
      const result = validator.validateDaubert(evidence, custody);

      expect(result.compliant).toBeDefined();
      expect(result.checks.testable).toBeDefined();
      expect(result.checks.tested).toBeDefined();
      expect(result.checks.errorRate).toBeDefined();
      expect(result.checks.acceptedInCommunity).toBeDefined();
    });

    test('should validate ACPO guidelines', () => {
      const result = validator.validateACPO(evidence, custody);

      expect(result.compliant).toBeDefined();
      expect(result.checks.noChangeToOriginal).toBeDefined();
      expect(result.checks.accessibility).toBeDefined();
      expect(result.checks.auditable).toBeDefined();
      expect(result.checks.responsible).toBeDefined();
    });

    test('should provide comprehensive compliance check', () => {
      const result = validator.validateCompliance(evidence, custody);

      expect(result.iso27037).toBeDefined();
      expect(result.nist).toBeDefined();
      expect(result.daubert).toBeDefined();
      expect(result.acpo).toBeDefined();
    });
  });

  // ==========================================
  // EVIDENCE ACCESS LOGGING
  // ==========================================

  describe('Evidence Access Logging', () => {
    beforeEach(() => {
      manager.captureEvidence(evidenceId, { content: 'test' }, collectorId);
    });

    test('should log evidence access', () => {
      const result = manager.accessEvidence(evidenceId, userId1, 'view', 'Review');

      expect(result.success).toBe(true);
      expect(result.accessed).toBe(true);
    });

    test('should prevent access to non-existent evidence', () => {
      const result = manager.accessEvidence('non-existent', userId1, 'view', 'Review');

      expect(result.success).toBe(false);
      expect(result.error).toBe('evidence-not-found');
    });
  });
});

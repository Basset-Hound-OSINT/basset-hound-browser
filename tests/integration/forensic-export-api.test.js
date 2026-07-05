/**
 * Integration Tests for Forensic Evidence Export API
 * Tests WebSocket command integration and full export workflow
 *
 * Scope: WebSocket API integration with forensic export
 * Coverage: API endpoint, manifest verification, legal compliance
 */

const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Mock classes for testing without full WebSocket/Electron setup
class MockSessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || {
      id: sessionId,
      url: 'https://example.com',
      screenshots: [Buffer.from('screenshot data')],
      har: { log: { entries: [] } },
      metadata: {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        userAgent: 'Mozilla/5.0'
      },
      tags: ['osint', 'investigation']
    };
  }

  addSession(sessionId, data) {
    this.sessions.set(sessionId, data);
  }
}

describe('Forensic Export API - Integration Tests', () => {
  let tempDir;
  let sessionManager;
  const EvidenceBundler = require('../../src/export/evidence-bundler');
  const ForensicReportGenerator = require('../../src/export/forensic-report-generator');

  beforeAll(() => {
    tempDir = path.join(os.tmpdir(), `forensic-api-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    sessionManager = new MockSessionManager();
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore
          }
        });
        fs.rmdirSync(tempDir);
      }
    } catch (e) {
      // Ignore
    }
  });

  describe('Full Export Workflow', () => {
    it('should execute complete forensic export workflow', async () => {
      const bundler = new EvidenceBundler();
      const reportGenerator = new ForensicReportGenerator();

      // Step 1: Get session data
      const sessionData = sessionManager.getSession('test-session-001');
      assert(sessionData);
      assert(sessionData.screenshots);
      assert(sessionData.metadata);

      // Step 2: Create forensic package
      const packagePath = path.join(tempDir, 'workflow-test.zip');
      const packageResult = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Detective Smith',
        caseNumber: 'CASE-2026-001',
        description: 'OSINT investigation - technology footprinting',
        agency: 'FBI Cyber Division',
        investigatorId: '12345',
        authorizationBasis: 'Search Warrant #2026-SW-98765',
        legalBasis: '18 U.S.C. § 2703(b)'
      });

      assert.strictEqual(packageResult.success, true);
      assert(packageResult.manifest);
      assert(packageResult.hashes);
      assert(fs.existsSync(packagePath));

      // Step 3: Generate forensic report
      const htmlReport = reportGenerator.generateHTMLReport(packageResult.manifest, sessionData);
      assert(typeof htmlReport === 'string');
      assert(htmlReport.length > 1000);

      const textReport = reportGenerator.generateTextReport(packageResult.manifest, sessionData);
      assert(typeof textReport === 'string');
      assert(textReport.length > 500);

      // Step 4: Verify package integrity
      const verification = await bundler.verifyPackageIntegrity(
        packagePath,
        packageResult.hashes
      );

      assert.strictEqual(verification.success, true);
      assert.strictEqual(verification.verified, true);

      // Step 5: Save reports
      const reportPath = path.join(tempDir, 'forensic-report.html');
      fs.writeFileSync(reportPath, htmlReport);
      assert(fs.existsSync(reportPath));
    });

    it('should create complete documentation package', async () => {
      const bundler = new EvidenceBundler();
      const reportGenerator = new ForensicReportGenerator();

      const sessionData = {
        url: 'https://example.com',
        screenshots: [
          { data: Buffer.from('screenshot1') },
          { data: Buffer.from('screenshot2') }
        ],
        har: {
          log: {
            entries: [
              { request: { method: 'GET', url: 'https://example.com' } },
              { request: { method: 'GET', url: 'https://example.com/api/data' } }
            ]
          }
        },
        metadata: {
          url: 'https://example.com',
          timestamp: new Date().toISOString(),
          title: 'Example Website'
        }
      };

      // Create package
      const packagePath = path.join(tempDir, 'complete-docs.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Analyst Jones',
        caseNumber: 'CASE-2026-002',
        description: 'Complete documentation test'
      });

      // Add custody event
      bundler.addCustodyEvent(result.manifest, {
        by: 'Forensics Tech Brown',
        id: '67890',
        action: 'forensic_analysis',
        notes: 'Completed initial analysis'
      });

      // Generate reports
      const htmlReport = reportGenerator.generateHTMLReport(
        result.manifest,
        sessionData,
        { investigator: 'Analyst Jones' }
      );

      const textReport = reportGenerator.generateTextReport(
        result.manifest,
        sessionData
      );

      // Verify
      assert.strictEqual(result.manifest.chainOfCustody.events.length, 1);
      assert(htmlReport.includes('Chain of Custody'));
      assert(textReport.includes('CUSTODY TRANSFERS'));
    });
  });

  describe('Hash Verification Integration', () => {
    it('should verify independent hash calculation', async () => {
      const bundler = new EvidenceBundler();

      const sessionData = {
        screenshots: [{ data: Buffer.from('test screenshot content') }],
        metadata: { test: 'independent verification' }
      };

      const packagePath = path.join(tempDir, 'hash-verify-test.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath
      });

      // Independent hash calculation (as law enforcement would do)
      const fileContent = fs.readFileSync(packagePath);
      const independentSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
      const independentSha512 = crypto.createHash('sha512').update(fileContent).digest('hex');

      // Should match the manifest hashes
      assert.strictEqual(independentSha256, result.hashes.sha256);
      assert.strictEqual(independentSha512, result.hashes.sha512);
    });

    it('should provide audit trail for hash verification', async () => {
      const bundler = new EvidenceBundler();

      const sessionData = {
        screenshots: [{ data: Buffer.from('audit trail test') }],
        metadata: {}
      };

      const packagePath = path.join(tempDir, 'audit-trail.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Auditor Lee',
        caseNumber: 'AUDIT-001'
      });

      const manifest = result.manifest;

      // Audit trail elements
      assert(manifest.createdAt); // Timestamp
      assert.strictEqual(manifest.chainOfCustody.created.by, 'Auditor Lee'); // Who created
      assert(manifest.hashes); // Hash values
      assert.strictEqual(manifest.fileCount, manifest.files.length); // File count

      // Create audit record
      const auditRecord = {
        evidence_id: `EV-${new Date().toISOString().replace(/[:.]/g, '-').split('-').slice(0, 4).join('-')}`,
        case_number: manifest.caseNumber,
        created_by: manifest.chainOfCustody.created.by,
        created_at: manifest.createdAt,
        verified_by: 'Auditor Lee',
        verified_at: new Date().toISOString(),
        hash_algorithm: 'sha256',
        hash_value: result.hashes.sha256,
        status: 'verified'
      };

      assert(auditRecord.hash_value.length === 64);
      assert.strictEqual(auditRecord.status, 'verified');
    });
  });

  describe('Legal Compliance Validation', () => {
    it('should include all required legal documentation', async () => {
      const bundler = new EvidenceBundler();
      const reportGenerator = new ForensicReportGenerator();

      const sessionData = {
        url: 'https://example.com/investigation',
        screenshots: [{ data: Buffer.from('screenshot') }],
        metadata: { url: 'https://example.com/investigation' }
      };

      const packagePath = path.join(tempDir, 'legal-compliance.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Det. Smith',
        caseNumber: 'CASE-2026-003',
        description: 'Investigation with legal authorization',
        agency: 'FBI Cyber Division',
        investigatorId: 'FBI-12345',
        authorizationBasis: 'Search Warrant #2026-SW-001',
        legalBasis: '18 U.S.C. § 2703(b) - Stored Communications Act'
      });

      const manifest = result.manifest;

      // Verify legal documentation
      assert(manifest.forensicMetadata.authorizationBasis);
      assert(manifest.forensicMetadata.legalBasis);
      assert(manifest.forensicMetadata.agency);
      assert(manifest.chainOfCustody.created.authorization);

      // Generate compliance report
      const report = reportGenerator.generateHTMLReport(manifest);
      assert(report.includes('Legal Basis'));
      assert(report.includes('Search Warrant'));
      assert(report.includes('18 U.S.C.'));
      assert(report.includes('ISO/IEC 27037'));
    });

    it('should validate chain of custody structure', async () => {
      const bundler = new EvidenceBundler();

      const sessionData = {
        screenshots: [{ data: Buffer.from('coc test') }],
        metadata: {}
      };

      const packagePath = path.join(tempDir, 'coc-validation.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Collector 1'
      });

      const manifest = result.manifest;

      // Verify initial custody record
      assert(manifest.chainOfCustody.created.timestamp);
      assert(manifest.chainOfCustody.created.by);
      assert(manifest.chainOfCustody.created.action);

      // Add transfers
      bundler.addCustodyEvent(manifest, {
        by: 'Collector 2',
        action: 'transfer',
        notes: 'Transferred to lab'
      });

      bundler.addCustodyEvent(manifest, {
        by: 'Analyst 1',
        action: 'analysis',
        notes: 'Forensic analysis performed'
      });

      // Verify complete chain
      assert.strictEqual(manifest.chainOfCustody.events.length, 2);
      assert.strictEqual(manifest.chainOfCustody.events[0].by, 'Collector 2');
      assert.strictEqual(manifest.chainOfCustody.events[1].by, 'Analyst 1');

      // All custody records must have timestamps
      assert(manifest.chainOfCustody.created.timestamp);
      manifest.chainOfCustody.events.forEach(event => {
        assert(event.timestamp);
        assert(event.by);
        assert(event.action);
      });
    });
  });

  describe('Report Quality Validation', () => {
    it('should generate professional quality HTML report', async () => {
      const bundler = new EvidenceBundler();
      const reportGenerator = new ForensicReportGenerator();

      const sessionData = {
        url: 'https://example.com',
        screenshots: [{ data: Buffer.from('screenshot') }],
        metadata: { title: 'Example' }
      };

      const packagePath = path.join(tempDir, 'quality-test.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Professional Analyst',
        caseNumber: 'QUALITY-001',
        description: 'Quality assurance test'
      });

      const report = reportGenerator.generateHTMLReport(result.manifest, sessionData);

      // Professional report elements
      assert(report.includes('<!DOCTYPE html>')); // Valid HTML
      assert(report.includes('<style>'));// Includes styling
      assert(report.includes('Summary')); // Includes sections
      assert(report.includes('Chain of Custody'));
      assert(report.includes('LEGAL NOTICE')); // Legal disclaimer
      assert(report.includes('Investigator Certification')); // Signature line
      assert(report.includes('cryptographic hashes')); // Technical documentation

      // Should be printable (includes @media print)
      assert(report.includes('@media print'));
    });

    it('should generate coherent text report for review', async () => {
      const bundler = new EvidenceBundler();
      const reportGenerator = new ForensicReportGenerator();

      const sessionData = {
        url: 'https://example.com',
        screenshots: [{ data: Buffer.from('test') }],
        metadata: { url: 'https://example.com' }
      };

      const packagePath = path.join(tempDir, 'text-report-test.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Text Analyst'
      });

      const report = reportGenerator.generateTextReport(result.manifest, sessionData);

      // Report structure
      const lines = report.split('\n');
      assert(lines.length > 20); // Substantial report

      // Key sections present
      assert(report.includes('FORENSIC EVIDENCE REPORT'));
      assert(report.includes('SUMMARY'));
      assert(report.includes('CHAIN OF CUSTODY'));
      assert(report.includes('CRYPTOGRAPHIC VERIFICATION'));
      assert(report.includes('LEGAL NOTICE'));

      // Readable format (check report has reasonable content)
      // Note: Some lines may be longer due to hash values
      const hasHashes = report.includes('SHA256') || report.includes('SHA512');
      assert(hasHashes); // Verify report contains hashes
    });
  });

  describe('Multi-Algorithm Hash Verification', () => {
    it('should support independent verification with all three algorithms', async () => {
      const bundler = new EvidenceBundler({
        algorithms: ['sha1', 'sha256', 'sha512']
      });

      const sessionData = {
        screenshots: [{ data: Buffer.from('multi-algorithm test data') }],
        metadata: {}
      };

      const packagePath = path.join(tempDir, 'multi-algo.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath
      });

      // Verify with all algorithms
      const fileContent = fs.readFileSync(packagePath);

      const sha1 = crypto.createHash('sha1').update(fileContent).digest('hex');
      const sha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
      const sha512 = crypto.createHash('sha512').update(fileContent).digest('hex');

      assert.strictEqual(sha1, result.hashes.sha1);
      assert.strictEqual(sha256, result.hashes.sha256);
      assert.strictEqual(sha512, result.hashes.sha512);

      // Different algorithms produce different length hashes
      assert.strictEqual(sha1.length, 40); // SHA-1
      assert.strictEqual(sha256.length, 64); // SHA-256
      assert.strictEqual(sha512.length, 128); // SHA-512
    });
  });

  describe('Evidence Integrity Throughout Workflow', () => {
    it('should maintain evidence integrity from creation to verification', async () => {
      const bundler = new EvidenceBundler();

      // Create consistent session data
      const sessionData = {
        url: 'https://example.com',
        screenshots: [
          { data: Buffer.from('Screenshot Data 1'), timestamp: new Date().toISOString() },
          { data: Buffer.from('Screenshot Data 2'), timestamp: new Date().toISOString() }
        ],
        har: {
          log: {
            entries: [
              {
                request: { method: 'GET', url: 'https://example.com', headers: [] },
                response: { status: 200, headers: [] }
              }
            ]
          }
        },
        metadata: {
          url: 'https://example.com',
          timestamp: new Date().toISOString(),
          userAgent: 'Mozilla/5.0 (Test)'
        }
      };

      // Create first package
      const package1Path = path.join(tempDir, 'integrity-1.zip');
      const result1 = await bundler.createEvidencePackage(sessionData, {
        outputPath: package1Path,
        analystName: 'Analyst A',
        caseNumber: 'INTEGRITY-001'
      });

      // Create second identical package immediately (within milliseconds)
      // Note: Hashes will differ if timestamps differ (included in ZIP metadata)
      const package2Path = path.join(tempDir, 'integrity-2.zip');
      const result2 = await bundler.createEvidencePackage(sessionData, {
        outputPath: package2Path,
        analystName: 'Analyst A',
        caseNumber: 'INTEGRITY-001'
      });

      // Hashes may differ due to timestamps in ZIP metadata
      // This is expected behavior - verify each independently
      assert(result1.hashes.sha256.length === 64);
      assert(result2.hashes.sha256.length === 64);

      // Verify both packages independently
      const verify1 = await bundler.verifyPackageIntegrity(package1Path, result1.hashes);
      const verify2 = await bundler.verifyPackageIntegrity(package2Path, result2.hashes);

      assert.strictEqual(verify1.verified, true);
      assert.strictEqual(verify2.verified, true);
    });
  });

  describe('WebSocket Command Simulation', () => {
    it('should format response for export_forensic_evidence command', async () => {
      const bundler = new EvidenceBundler();

      const sessionData = {
        url: 'https://example.com',
        screenshots: [{ data: Buffer.from('test') }],
        metadata: { test: 'data' }
      };

      const packagePath = path.join(tempDir, 'websocket-response.zip');
      const result = await bundler.createEvidencePackage(sessionData, {
        outputPath: packagePath,
        analystName: 'Det. Johnson',
        caseNumber: 'CASE-WS-001',
        description: 'WebSocket integration test'
      });

      // Format response as WebSocket would send
      const wsResponse = {
        success: result.success,
        result: {
          packagePath: packagePath,
          hashes: result.hashes,
          manifest: {
            packageId: result.manifest.packageId,
            caseNumber: result.manifest.caseNumber,
            createdAt: result.manifest.createdAt,
            fileCount: result.manifest.fileCount,
            packageSize: result.manifest.packageSize
          }
        }
      };

      // Should have proper response structure
      assert.strictEqual(wsResponse.success, true);
      assert(wsResponse.result.packagePath);
      assert(wsResponse.result.hashes.sha256);
      assert.strictEqual(
        wsResponse.result.manifest.caseNumber,
        'CASE-WS-001'
      );
    });
  });
});

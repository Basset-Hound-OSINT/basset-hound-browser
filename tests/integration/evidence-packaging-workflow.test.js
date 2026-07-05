/**
 * Evidence Packaging Workflow Integration Tests
 *
 * Phase 19: Chain of Custody & Evidence Packaging System
 * Tests complete workflows from capture through export
 */

const { describe, it, expect, beforeEach } = require('@jest/globals');
const {
  registerEvidencePackagingCommands,
  initializePackageBuilder
} = require('../../websocket/commands/evidence-packaging');
const {
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS
} = require('../../evidence/evidence-collector');

describe('Evidence Packaging Workflow', () => {
  let commandHandlers;
  let evidenceCollector;

  beforeEach(() => {
    // Initialize systems - create fresh instances for each test
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    evidenceCollector = new EvidenceCollector();
    // Reset package builder for clean state
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should complete capture -> manifest -> package -> export workflow', async () => {
    // Step 1: Create manifest
    const manifestResult = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001',
      url: 'https://example.com',
      capturedBy: 'investigator_john'
    });

    expect(manifestResult.success).toBe(true);
    expect(manifestResult.manifestId).toBeDefined();
    const manifestId = manifestResult.manifestId;

    // Step 2: Capture evidence items
    const screenshot = evidenceCollector.captureScreenshot(Buffer.from('image_data'), {
      url: 'https://example.com',
      title: 'Example Page',
      viewport: { width: 1920, height: 1080 },
      capturedBy: 'investigator_john'
    });

    const har = evidenceCollector.captureNetworkHAR(
      {
        log: {
          version: '1.2.0',
          entries: [
            { request: { method: 'GET', url: 'https://example.com' } }
          ]
        }
      },
      { url: 'https://example.com', capturedBy: 'investigator_john' }
    );

    const dom = evidenceCollector.captureDOMSnapshot('<html><body>Example</body></html>', {
      url: 'https://example.com',
      nodeCount: 3,
      capturedBy: 'investigator_john'
    });

    // Step 3: Add evidence to manifest
    const addEv1 = await commandHandlers.add_to_manifest({
      manifestId,
      evidenceId: screenshot.id,
      type: EVIDENCE_TYPES.SCREENSHOT,
      data: Buffer.from('image_data'),
      url: 'https://example.com',
      size: 1024
    });

    const addEv2 = await commandHandlers.add_to_manifest({
      manifestId,
      evidenceId: har.id,
      type: EVIDENCE_TYPES.NETWORK_HAR,
      data: har.data,
      url: 'https://example.com'
    });

    const addEv3 = await commandHandlers.add_to_manifest({
      manifestId,
      evidenceId: dom.id,
      type: EVIDENCE_TYPES.DOM_SNAPSHOT,
      data: dom.data,
      url: 'https://example.com'
    });

    expect(addEv1.success).toBe(true);
    expect(addEv2.success).toBe(true);
    expect(addEv3.success).toBe(true);

    // Step 4: Get manifest to verify
    const getManifest = await commandHandlers.get_manifest({
      manifestId
    });

    expect(getManifest.success).toBe(true);
    expect(getManifest.manifest.entries).toHaveLength(3);
    expect(getManifest.manifest.summary.totalEntries).toBe(3);

    // Step 5: Create package from manifest
    const pkgResult = await commandHandlers.create_evidence_package({
      manifestId,
      capturedBy: 'investigator_john',
      autoSeal: false
    });

    expect(pkgResult.success).toBe(true);
    expect(pkgResult.packageId).toBeDefined();
    const packageId = pkgResult.packageId;

    // Step 6: Seal package
    const sealResult = await commandHandlers.seal_evidence_package({
      packageId,
      sealedBy: 'investigator_john'
    });

    expect(sealResult.success).toBe(true);
    expect(sealResult.sealData).toBeDefined();
    expect(sealResult.timestampToken).toBeDefined();

    // Step 7: Verify package integrity
    const verifyResult = await commandHandlers.verify_evidence_package({
      packageId
    });

    expect(verifyResult.success).toBe(true);
    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.issues).toHaveLength(0);

    // Step 8: Export for court
    const exportCourt = await commandHandlers.export_evidence_package({
      packageId,
      format: 'court',
      destination: 'court_evidence_storage'
    });

    expect(exportCourt.success).toBe(true);
    expect(exportCourt.format).toBe('court');
    expect(exportCourt.data.package).toBeDefined();
    expect(exportCourt.data.manifest).toBeDefined();
    expect(exportCourt.data.verification.valid).toBe(true);

    // Step 9: Export as JSON
    const exportJSON = await commandHandlers.export_evidence_package({
      packageId,
      format: 'json'
    });

    expect(exportJSON.success).toBe(true);
    expect(typeof exportJSON.data).toBe('string');
    const parsed = JSON.parse(exportJSON.data);
    expect(parsed.package).toBeDefined();

    // Step 10: Export as XML
    const exportXML = await commandHandlers.export_evidence_package({
      packageId,
      format: 'xml'
    });

    expect(exportXML.success).toBe(true);
    expect(typeof exportXML.data).toBe('string');
    expect(exportXML.data).toContain('<?xml');
    expect(exportXML.data).toContain('EvidencePackage');
  });

  it('should handle multiple packages and manifests', async () => {
    // Create multiple manifests
    const manifest1 = await commandHandlers.create_evidence_manifest({
      sessionId: 'multi_session_001',
      url: 'https://example1.com',
      capturedBy: 'investigator_john'
    });

    const manifest2 = await commandHandlers.create_evidence_manifest({
      sessionId: 'multi_session_002',
      url: 'https://example2.com',
      capturedBy: 'investigator_jane'
    });

    const manifest3 = await commandHandlers.create_evidence_manifest({
      sessionId: 'multi_session_003',
      url: 'https://example3.com',
      capturedBy: 'analyst_bob'
    });

    // Create packages from each manifest
    const pkg1 = await commandHandlers.create_evidence_package({
      manifestId: manifest1.manifestId,
      autoSeal: true
    });

    const pkg2 = await commandHandlers.create_evidence_package({
      manifestId: manifest2.manifestId,
      autoSeal: true
    });

    const pkg3 = await commandHandlers.create_evidence_package({
      manifestId: manifest3.manifestId,
      autoSeal: true
    });

    // List all manifests - should have at least 3
    const listManifests = await commandHandlers.list_manifests();
    expect(listManifests.success).toBe(true);
    expect(listManifests.manifests.length).toBeGreaterThanOrEqual(3);

    // List all packages - should have at least 3
    const listPackages = await commandHandlers.list_evidence_packages();
    expect(listPackages.success).toBe(true);
    expect(listPackages.packages.length).toBeGreaterThanOrEqual(3);

    // Get statistics
    const stats = await commandHandlers.get_packaging_stats();
    expect(stats.success).toBe(true);
    expect(stats.stats.builder.packages).toBeGreaterThanOrEqual(3);
    expect(stats.stats.builder.manifests).toBeGreaterThanOrEqual(3);
  });

  it('should verify evidence integrity across multiple packages', async () => {
    // Create manifest with multiple evidence types
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_integ_001',
      url: 'https://example.com',
      capturedBy: 'investigator'
    });

    const manifestId = manifest.manifestId;

    // Add different evidence types
    const evidenceTypes = [
      { id: 'ev_001', type: 'screenshot', data: 'image_data' },
      { id: 'ev_002', type: 'har', data: { log: { entries: [] } } },
      { id: 'ev_003', type: 'dom', data: '<html></html>' },
      { id: 'ev_004', type: 'console_log', data: ['log1', 'log2'] }
    ];

    for (const ev of evidenceTypes) {
      await commandHandlers.add_to_manifest({
        manifestId,
        evidenceId: ev.id,
        type: ev.type,
        data: ev.data,
        url: 'https://example.com'
      });
    }

    // Create package without auto-seal
    const pkgResult = await commandHandlers.create_evidence_package({
      manifestId,
      autoSeal: false
    });

    const packageId = pkgResult.packageId;

    // Now explicitly seal it
    const sealResult = await commandHandlers.seal_evidence_package({
      packageId,
      sealedBy: 'investigator'
    });

    expect(sealResult.success).toBe(true);

    // Verify multiple times (should be consistent)
    const verify1 = await commandHandlers.verify_evidence_package({ packageId });
    const verify2 = await commandHandlers.verify_evidence_package({ packageId });
    const verify3 = await commandHandlers.verify_evidence_package({ packageId });

    expect(verify1.success).toBe(true);
    expect(verify2.success).toBe(true);
    expect(verify3.success).toBe(true);

    expect(verify1.valid).toBe(true);
    expect(verify2.valid).toBe(true);
    expect(verify3.valid).toBe(true);

    // All verifications should be identical
    expect(verify1.details.sealed).toBe(true);
    expect(verify2.details.sealed).toBe(true);
    expect(verify3.details.sealed).toBe(true);
  });

  it('should handle custody chain tracking', async () => {
    // Create manifest and add evidence
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001',
      url: 'https://example.com',
      capturedBy: 'investigator_john'
    });

    const manifestId = manifest.manifestId;

    // Add evidence
    await commandHandlers.add_to_manifest({
      manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    // Create and seal package
    const pkg = await commandHandlers.create_evidence_package({
      manifestId,
      autoSeal: true
    });

    // Get custody chain for the manifest
    const custodyResult = await commandHandlers.get_custody_chain({
      evidenceId: manifestId
    });

    expect(custodyResult.success).toBe(true);
    expect(custodyResult.chain).toBeDefined();
    expect(custodyResult.verification).toBeDefined();

    // Generate custody report
    const reportJSON = await commandHandlers.generate_custody_report({
      evidenceId: manifestId,
      format: 'json'
    });

    const reportText = await commandHandlers.generate_custody_report({
      evidenceId: manifestId,
      format: 'text'
    });

    expect(reportJSON.success).toBe(true);
    expect(reportText.success).toBe(true);
    expect(typeof reportText.report).toBe('string');
    expect(reportText.report).toContain('CHAIN OF CUSTODY REPORT');
  });

  it('should perform analysis export with minimal metadata', async () => {
    // Create manifest
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001',
      url: 'https://example.com',
      capturedBy: 'investigator'
    });

    // Add evidence
    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    // Create package
    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: false
    });

    // Export for analysis
    const exportAnalysis = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'analysis'
    });

    expect(exportAnalysis.success).toBe(true);
    const data = exportAnalysis.data;

    // Analysis export should have minimal metadata
    expect(data.packageId).toBeDefined();
    expect(data.manifest.summary).toBeDefined();
    expect(data.evidence).toBeDefined();
    expect(data.manifest.compliance).toBeUndefined(); // Not in analysis format
  });

  it('should handle error cases gracefully', async () => {
    // Try to add evidence to non-existent manifest
    const badAdd = await commandHandlers.add_to_manifest({
      manifestId: 'invalid_manifest',
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data'
    });

    expect(badAdd.success).toBe(false);
    expect(badAdd.error).toBeDefined();

    // Try to create package from non-existent manifest
    const badPackage = await commandHandlers.create_evidence_package({
      manifestId: 'invalid_manifest'
    });

    expect(badPackage.success).toBe(false);
    expect(badPackage.error).toBeDefined();

    // Try to export non-existent package
    const badExport = await commandHandlers.export_evidence_package({
      packageId: 'invalid_package',
      format: 'json'
    });

    expect(badExport.success).toBe(false);
    expect(badExport.error).toBeDefined();

    // Try unsupported export format
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId
    });

    const badFormat = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'invalid_format'
    });

    expect(badFormat.success).toBe(false);
  });

  it('should maintain evidence metadata through packaging', async () => {
    // Create manifest
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001',
      url: 'https://example.com/target',
      capturedBy: 'investigator_john'
    });

    // Add evidence with detailed metadata
    const customMetadata = {
      url: 'https://example.com/target',
      annotations: ['Important section', 'Suspicious pattern'],
      priority: 'high',
      tags: ['evidence', 'critical']
    };

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      size: 2048,
      metadata: customMetadata
    });

    // Create package and export
    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    const exported = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'json'
    });

    const data = JSON.parse(exported.data);
    const entry = data.manifest.entries[0];

    // Verify metadata is preserved
    expect(entry.metadata.annotations).toEqual(['Important section', 'Suspicious pattern']);
    expect(entry.metadata.priority).toBe('high');
  });

  it('should export consistent hashes across multiple formats', async () => {
    // Create and seal package
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'session_001',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    // Export in all formats
    const json = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'json'
    });

    const xml = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'xml'
    });

    const analysis = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'analysis'
    });

    // Parse JSON and XML to compare hashes
    const jsonData = JSON.parse(json.data);
    const jsonHash = jsonData.manifest.entries[0].hashes.sha256;

    // Extract hash from XML
    const xmlHashMatch = xml.data.match(/<SHA256>([a-f0-9]+)<\/SHA256>/);
    const xmlHash = xmlHashMatch ? xmlHashMatch[1] : null;

    // Hashes should be identical across formats
    expect(jsonHash).toBe(xmlHash);
    expect(jsonHash).toBeDefined();
  });
});

describe('Performance Tests', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
  });

  it('should complete package export in under 500ms', async () => {
    const startTime = Date.now();

    // Create manifest with multiple evidence items
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'perf_test_001',
      url: 'https://example.com'
    });

    const manifestId = manifest.manifestId;

    // Add multiple evidence items
    for (let i = 0; i < 20; i++) {
      await commandHandlers.add_to_manifest({
        manifestId,
        evidenceId: `ev_${i}`,
        type: 'screenshot',
        data: 'test_data_' + i,
        url: 'https://example.com'
      });
    }

    // Create and seal
    const pkg = await commandHandlers.create_evidence_package({
      manifestId,
      autoSeal: true
    });

    // Export
    const exportStart = Date.now();
    await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'json'
    });
    const exportTime = Date.now() - exportStart;

    expect(exportTime).toBeLessThan(500); // Target: <500ms
  });

  it('should handle large manifests efficiently', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'large_test_001',
      url: 'https://example.com'
    });

    const startTime = Date.now();

    // Add 100 evidence items
    for (let i = 0; i < 100; i++) {
      await commandHandlers.add_to_manifest({
        manifestId: manifest.manifestId,
        evidenceId: `ev_${i}`,
        type: i % 3 === 0 ? 'screenshot' : i % 3 === 1 ? 'har' : 'dom',
        data: 'data_' + i,
        url: 'https://example.com'
      });
    }

    const duration = Date.now() - startTime;

    // Should handle 100 items reasonably quickly
    expect(duration).toBeLessThan(5000); // Less than 5 seconds

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    expect(pkg.success).toBe(true);
  });

  it('should complete <500ms export for 20 items', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'perf_test_small',
      url: 'https://example.com'
    });

    const manifestId = manifest.manifestId;

    // Add 20 items
    for (let i = 0; i < 20; i++) {
      await commandHandlers.add_to_manifest({
        manifestId,
        evidenceId: `ev_${i}`,
        type: 'screenshot',
        data: 'test_data',
        url: 'https://example.com'
      });
    }

    const pkg = await commandHandlers.create_evidence_package({
      manifestId,
      autoSeal: true
    });

    const exportStart = Date.now();
    const result = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'json'
    });
    const exportDuration = Date.now() - exportStart;

    expect(result.success).toBe(true);
    expect(exportDuration).toBeLessThan(500);
  });
});

// ==========================================
// RFC 3161 TIMESTAMP WORKFLOW TESTS
// ==========================================

describe('RFC 3161 Timestamp Workflow', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should request RFC 3161 timestamp during sealing', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'rfc_session_001',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: false
    });

    const sealResult = await commandHandlers.seal_evidence_package({
      packageId: pkg.packageId,
      sealedBy: 'investigator',
      requestRFC3161: true,
      rfc3161Authority: 'freetsa.org'
    });

    expect(sealResult.success).toBe(true);
    expect(sealResult.rfc3161Requested).toBe(true);
    expect(sealResult.rfc3161Token).toBeDefined();
    expect(sealResult.rfc3161Status).toBe('requested');
  });

  it('should request RFC 3161 timestamp separately for sealed package', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'rfc_session_002',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    const timestampResult = await commandHandlers.request_rfc3161_timestamp({
      packageId: pkg.packageId,
      authority: 'custom-tsa.example.com'
    });

    expect(timestampResult.success).toBe(true);
    expect(timestampResult.timestampToken).toBeDefined();
    expect(timestampResult.authority).toBe('custom-tsa.example.com');
  });

  it('should check manifest timestamp readiness', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'rfc_session_003',
      url: 'https://example.com'
    });

    const readiness = await commandHandlers.check_timestamp_readiness({
      manifestId: manifest.manifestId
    });

    expect(readiness.success).toBe(true);
    // Empty manifest should not be ready
    expect(readiness.readiness.ready).toBe(false);

    // Add evidence and check again
    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const readiness2 = await commandHandlers.check_timestamp_readiness({
      manifestId: manifest.manifestId
    });

    expect(readiness2.readiness.ready).toBe(true);
  });
});

// ==========================================
// COMPLIANCE REPORT WORKFLOW TESTS
// ==========================================

describe('Compliance Report Workflow', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should generate comprehensive compliance report', async () => {
    // Create multiple packages
    for (let i = 0; i < 3; i++) {
      const manifest = await commandHandlers.create_evidence_manifest({
        sessionId: `compliance_session_${i}`,
        url: 'https://example.com'
      });

      await commandHandlers.add_to_manifest({
        manifestId: manifest.manifestId,
        evidenceId: `ev_${i}`,
        type: 'screenshot',
        data: 'data',
        url: 'https://example.com'
      });

      const pkg = await commandHandlers.create_evidence_package({
        manifestId: manifest.manifestId,
        autoSeal: true
      });
    }

    const report = await commandHandlers.generate_compliance_report();

    expect(report.success).toBe(true);
    expect(report.report.generatedAt).toBeDefined();
    expect(report.report.packages.length).toBeGreaterThanOrEqual(3);
    expect(report.report.summary).toBeDefined();
    expect(['FULLY_COMPLIANT', 'COMPLIANCE_ISSUES_DETECTED']).toContain(
      report.report.complianceStatus
    );
  });
});

// ==========================================
// ZIP EXPORT WORKFLOW TESTS
// ==========================================

describe('ZIP Export Workflow', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should export package as ZIP', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'zip_session_001',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    const zipResult = await commandHandlers.export_evidence_package_zip({
      packageId: pkg.packageId,
      destination: 'archive_storage'
    });

    expect(zipResult.success).toBe(true);
    expect(zipResult.zipInfo).toBeDefined();
    expect(zipResult.exportPerformanceOk).toBe(true);
  });
});

// ==========================================
// VALIDATION & ERROR HANDLING TESTS
// ==========================================

describe('Advanced Validation & Error Handling', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should validate evidence data before adding to manifest', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'valid_session_001',
      url: 'https://example.com'
    });

    // Missing data
    const badResult1 = await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      // data: missing!
      url: 'https://example.com'
    });

    expect(badResult1.success).toBe(false);
    expect(badResult1.error).toContain('data');

    // Invalid manifestId
    const badResult2 = await commandHandlers.add_to_manifest({
      manifestId: 123, // Not a string
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data'
    });

    expect(badResult2.success).toBe(false);
  });

  it('should prevent sealing already sealed packages', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'seal_session_001',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: false
    });

    // Seal first time
    const seal1 = await commandHandlers.seal_evidence_package({
      packageId: pkg.packageId,
      sealedBy: 'investigator'
    });

    expect(seal1.success).toBe(true);

    // Try to seal again
    const seal2 = await commandHandlers.seal_evidence_package({
      packageId: pkg.packageId,
      sealedBy: 'someone_else'
    });

    expect(seal2.success).toBe(false);
    expect(seal2.error).toContain('already sealed');
  });

  it('should handle invalid export formats gracefully', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'export_session_001',
      url: 'https://example.com'
    });

    await commandHandlers.add_to_manifest({
      manifestId: manifest.manifestId,
      evidenceId: 'ev_001',
      type: 'screenshot',
      data: 'image_data',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: true
    });

    const badFormat = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'invalid_format_xyz'
    });

    expect(badFormat.success).toBe(false);
    expect(badFormat.error).toBeDefined();
  });

  it('should require sealing for RFC 3161 timestamp', async () => {
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'rfc_error_session',
      url: 'https://example.com'
    });

    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      autoSeal: false // Don't seal
    });

    const badTimestamp = await commandHandlers.request_rfc3161_timestamp({
      packageId: pkg.packageId,
      authority: 'freetsa.org'
    });

    expect(badTimestamp.success).toBe(false);
    expect(badTimestamp.error).toContain('sealed');
  });
});

// ==========================================
// END-TO-END WORKFLOW TESTS
// ==========================================

describe('End-to-End Workflows', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerEvidencePackagingCommands(commandHandlers);
    const { initializePackageBuilder } = require('../../websocket/commands/evidence-packaging');
    initializePackageBuilder();
  });

  it('should complete full workflow with all features enabled', async () => {
    // Create manifest
    const manifest = await commandHandlers.create_evidence_manifest({
      sessionId: 'full_workflow_001',
      url: 'https://evidence.example.com',
      capturedBy: 'investigator_alice',
      metadata: {
        caseId: 'CASE-2026-001',
        jurisdiction: 'US-Federal'
      }
    });

    expect(manifest.success).toBe(true);

    // Add multiple evidence types
    const evidenceItems = [
      { id: 'ev_001', type: 'screenshot', data: 'screenshot_data_here' },
      { id: 'ev_002', type: 'har', data: JSON.stringify({ log: { entries: [] } }) },
      { id: 'ev_003', type: 'dom', data: '<html><body>Evidence</body></html>' }
    ];

    for (const item of evidenceItems) {
      const result = await commandHandlers.add_to_manifest({
        manifestId: manifest.manifestId,
        evidenceId: item.id,
        type: item.type,
        data: item.data,
        url: 'https://evidence.example.com',
        metadata: { caseReference: 'CASE-2026-001' }
      });
      expect(result.success).toBe(true);
    }

    // Check timestamp readiness
    const readiness = await commandHandlers.check_timestamp_readiness({
      manifestId: manifest.manifestId
    });
    expect(readiness.readiness.ready).toBe(true);

    // Create package
    const pkg = await commandHandlers.create_evidence_package({
      manifestId: manifest.manifestId,
      capturedBy: 'investigator_alice',
      autoSeal: false
    });
    expect(pkg.success).toBe(true);

    // Seal with RFC 3161
    const sealResult = await commandHandlers.seal_evidence_package({
      packageId: pkg.packageId,
      sealedBy: 'investigator_alice',
      requestRFC3161: true,
      rfc3161Authority: 'freetsa.org'
    });
    expect(sealResult.success).toBe(true);
    expect(sealResult.rfc3161Token).toBeDefined();

    // Verify integrity
    const verification = await commandHandlers.verify_evidence_package({
      packageId: pkg.packageId
    });
    expect(verification.valid).toBe(true);

    // Export in multiple formats
    const exportCourt = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'court',
      destination: 'court_evidence_vault'
    });
    expect(exportCourt.success).toBe(true);

    const exportJSON = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'json',
      destination: 'analysis_system'
    });
    expect(exportJSON.success).toBe(true);

    const exportXML = await commandHandlers.export_evidence_package({
      packageId: pkg.packageId,
      format: 'xml',
      destination: 'archive_system'
    });
    expect(exportXML.success).toBe(true);

    const exportZip = await commandHandlers.export_evidence_package_zip({
      packageId: pkg.packageId,
      destination: 'portable_storage'
    });
    expect(exportZip.success).toBe(true);

    // Generate custody reports
    const custodyChain = await commandHandlers.get_custody_chain({
      evidenceId: manifest.manifestId
    });
    expect(custodyChain.success).toBe(true);

    const custodyReport = await commandHandlers.generate_custody_report({
      evidenceId: manifest.manifestId,
      format: 'text'
    });
    expect(custodyReport.success).toBe(true);

    // Generate compliance report
    const complianceReport = await commandHandlers.generate_compliance_report();
    expect(complianceReport.success).toBe(true);

    // Get final statistics
    const stats = await commandHandlers.get_packaging_stats();
    expect(stats.success).toBe(true);
    expect(stats.stats.builder.manifests).toBeGreaterThanOrEqual(1);
  });

  it('should track multiple investigation contexts independently', async () => {
    const caseIds = ['CASE-001', 'CASE-002', 'CASE-003'];
    const packages = [];

    for (const caseId of caseIds) {
      // Create manifest for each case
      const manifest = await commandHandlers.create_evidence_manifest({
        sessionId: `case_${caseId}`,
        url: `https://evidence-${caseId}.example.com`,
        capturedBy: 'investigator_team',
        metadata: { caseId }
      });

      // Add evidence
      await commandHandlers.add_to_manifest({
        manifestId: manifest.manifestId,
        evidenceId: `evidence_${caseId}`,
        type: 'screenshot',
        data: `Case ${caseId} evidence`,
        url: `https://evidence-${caseId}.example.com`,
        metadata: { caseId }
      });

      // Create and seal package
      const pkg = await commandHandlers.create_evidence_package({
        manifestId: manifest.manifestId,
        autoSeal: true,
        capturedBy: 'investigator_team'
      });

      packages.push(pkg);
    }

    // Verify all packages are independent
    expect(packages).toHaveLength(3);
    const packageIds = new Set(packages.map(p => p.packageId));
    expect(packageIds.size).toBe(3);

    // List all packages
    const allPackages = await commandHandlers.list_evidence_packages();
    expect(allPackages.packages.length).toBeGreaterThanOrEqual(3);
  });
});

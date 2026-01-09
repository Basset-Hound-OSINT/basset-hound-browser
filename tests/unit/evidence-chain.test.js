/**
 * Unit tests for Evidence Chain of Custody
 *
 * Phase 29: Evidence Chain of Custody
 *
 * Comprehensive tests for evidence manager including:
 * - Evidence item creation and hashing
 * - Chain of custody events
 * - Verification and sealing
 * - Package management
 * - SWGDE report generation
 * - Audit trail
 */

const { EvidenceManager, EvidenceItem, EvidencePackage, EVIDENCE_TYPES, CUSTODY_EVENTS } = require('../../evidence/evidence-manager');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

describe('Evidence Chain of Custody', () => {
  let evidenceManager;
  let testBasePath;

  beforeEach(async () => {
    testBasePath = path.join(__dirname, '..', '..', 'test-evidence-vault');
    evidenceManager = new EvidenceManager({
      basePath: testBasePath,
      autoVerify: false,
      autoSeal: false
    });

    // Wait for directory creation
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Clean up test evidence vault
    try {
      await fs.rm(testBasePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Evidence Item', () => {
    test('should create evidence item with unique ID', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'base64data', url: 'https://example.com' },
        metadata: { browser: 'Chrome' }
      });

      expect(item.id).toBeDefined();
      expect(item.id).toMatch(/^evidence-\d+-[a-f0-9]+$/);
      expect(item.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
    });

    test('should calculate SHA-256 hash of data', () => {
      const data = { screenshot: 'base64data', url: 'https://example.com' };
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: data
      });

      const expectedHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
      expect(item.hash).toBe(expectedHash);
      expect(item.hashAlgorithm).toBe('SHA-256');
    });

    test('should create custody chain on creation', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html>...</html>' },
        actor: 'test-investigator'
      });

      expect(item.custodyChain).toHaveLength(1);
      expect(item.custodyChain[0].eventType).toBe(CUSTODY_EVENTS.CREATED);
      expect(item.custodyChain[0].actor).toBe('test-investigator');
      expect(item.custodyChain[0].timestamp).toBeDefined();
    });

    test('should verify evidence integrity', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      const verified = item.verify();
      expect(verified).toBe(true);
      expect(item.verified).toBe(true);
      expect(item.custodyChain).toHaveLength(2);
      expect(item.custodyChain[1].eventType).toBe(CUSTODY_EVENTS.VERIFIED);
    });

    test('should detect tampered evidence', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      // Tamper with data
      item.data = { requests: ['modified'] };

      const verified = item.verify();
      expect(verified).toBe(false);
      expect(item.verified).toBe(false);
    });

    test('should seal evidence', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      expect(item.sealed).toBe(false);

      item.seal('forensic-examiner');

      expect(item.sealed).toBe(true);
      expect(item.sealedBy).toBe('forensic-examiner');
      expect(item.sealedAt).toBeDefined();
      expect(item.custodyChain).toHaveLength(2);
      expect(item.custodyChain[1].eventType).toBe(CUSTODY_EVENTS.SEALED);
    });

    test('should not seal already sealed evidence', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      item.seal('examiner1');

      expect(() => item.seal('examiner2')).toThrow('Evidence already sealed');
    });

    test('should record access events', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.COOKIE,
        data: { cookies: [] }
      });

      item.recordAccess('investigator', 'Review cookies');

      expect(item.custodyChain).toHaveLength(2);
      expect(item.custodyChain[1].eventType).toBe(CUSTODY_EVENTS.ACCESSED);
      expect(item.custodyChain[1].actor).toBe('investigator');
      expect(item.custodyChain[1].details).toContain('Review cookies');
    });

    test('should export to JSON', () => {
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' },
        metadata: { url: 'https://example.com' },
        tags: ['important', 'screenshot'],
        caseId: 'CASE-123',
        investigationId: 'INV-456'
      });

      const json = item.toJSON();

      expect(json.id).toBe(item.id);
      expect(json.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
      expect(json.hash).toBe(item.hash);
      expect(json.custodyChain).toHaveLength(1);
      expect(json.tags).toEqual(['important', 'screenshot']);
      expect(json.caseId).toBe('CASE-123');
      expect(json.investigationId).toBe('INV-456');
    });
  });

  describe('Evidence Package', () => {
    test('should create package with unique ID', () => {
      const pkg = new EvidencePackage({
        name: 'Test Package',
        description: 'Test description'
      });

      expect(pkg.id).toBeDefined();
      expect(pkg.id).toMatch(/^pkg-\d+-[a-f0-9]+$/);
      expect(pkg.name).toBe('Test Package');
      expect(pkg.description).toBe('Test description');
      expect(pkg.sealed).toBe(false);
    });

    test('should add items to package', () => {
      const pkg = new EvidencePackage({ name: 'Package 1' });
      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      pkg.addItem(item);

      expect(pkg.items).toHaveLength(1);
      expect(pkg.items[0]).toBe(item);
    });

    test('should not add items to sealed package', () => {
      const pkg = new EvidencePackage({ name: 'Package 1' });
      pkg.seal();

      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      expect(() => pkg.addItem(item)).toThrow('Cannot add items to sealed package');
    });

    test('should seal package and all items', () => {
      const pkg = new EvidencePackage({ name: 'Package 1' });

      const item1 = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' }
      });
      const item2 = new EvidenceItem({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' }
      });

      pkg.addItem(item1);
      pkg.addItem(item2);

      expect(pkg.sealed).toBe(false);
      expect(item1.sealed).toBe(false);
      expect(item2.sealed).toBe(false);

      pkg.seal('examiner');

      expect(pkg.sealed).toBe(true);
      expect(pkg.sealedBy).toBe('examiner');
      expect(item1.sealed).toBe(true);
      expect(item2.sealed).toBe(true);
    });

    test('should not seal already sealed package', () => {
      const pkg = new EvidencePackage({ name: 'Package 1' });
      pkg.seal();

      expect(() => pkg.seal()).toThrow('Package already sealed');
    });

    test('should calculate package hash', () => {
      const pkg = new EvidencePackage({ name: 'Package 1' });

      const item1 = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' }
      });
      const item2 = new EvidenceItem({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' }
      });

      pkg.addItem(item1);
      pkg.addItem(item2);

      const packageHash = pkg.calculatePackageHash();
      expect(packageHash).toBeDefined();
      expect(packageHash).toHaveLength(64); // SHA-256 hex string

      // Hash should be deterministic
      const itemHashes = [item1.hash, item2.hash].sort().join('');
      const expectedHash = crypto.createHash('sha256').update(itemHashes).digest('hex');
      expect(packageHash).toBe(expectedHash);
    });

    test('should export package to JSON', () => {
      const pkg = new EvidencePackage({
        name: 'Test Package',
        description: 'Test',
        caseId: 'CASE-123',
        investigationId: 'INV-456'
      });

      const item = new EvidenceItem({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      pkg.addItem(item);

      const json = pkg.toJSON();

      expect(json.id).toBe(pkg.id);
      expect(json.name).toBe('Test Package');
      expect(json.itemCount).toBe(1);
      expect(json.items).toHaveLength(1);
      expect(json.packageHash).toBeDefined();
      expect(json.caseId).toBe('CASE-123');
    });
  });

  describe('Evidence Manager', () => {
    test('should initialize with default configuration', () => {
      const manager = new EvidenceManager();

      expect(manager.config.autoVerify).toBe(true);
      expect(manager.config.autoSeal).toBe(false);
      expect(manager.evidence).toBeDefined();
      expect(manager.packages).toBeDefined();
    });

    test('should create investigation', () => {
      const investigation = evidenceManager.createInvestigation({
        name: 'Test Investigation',
        description: 'Testing evidence collection',
        investigator: 'John Doe',
        caseId: 'CASE-001'
      });

      expect(investigation.id).toBeDefined();
      expect(investigation.name).toBe('Test Investigation');
      expect(investigation.investigator).toBe('John Doe');
      expect(investigation.caseId).toBe('CASE-001');
      expect(investigation.status).toBe('active');
    });

    test('should collect evidence', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'base64data' },
        metadata: { url: 'https://example.com' },
        actor: 'test-user'
      });

      expect(item.id).toBeDefined();
      expect(item.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
      expect(item.hash).toBeDefined();
      expect(evidenceManager.evidence.has(item.id)).toBe(true);
    });

    test('should auto-verify evidence when enabled', async () => {
      const manager = new EvidenceManager({ autoVerify: true });

      const item = await manager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' }
      });

      expect(item.verified).toBe(true);
    });

    test('should persist evidence to disk', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const filePath = path.join(testBasePath, 'items', `${item.id}.json`);
      const exists = await fs.access(filePath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      const content = await fs.readFile(filePath, 'utf8');
      const savedData = JSON.parse(content);
      expect(savedData.id).toBe(item.id);
      expect(savedData.hash).toBe(item.hash);
    });

    test('should verify evidence', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      const verified = evidenceManager.verifyEvidence(item.id);

      expect(verified).toBe(true);
      expect(evidenceManager.stats.verificationsPerformed).toBe(1);
      expect(evidenceManager.stats.verificationsFailed).toBe(0);
    });

    test('should track failed verifications', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      // Tamper with evidence
      const storedItem = evidenceManager.evidence.get(item.id);
      storedItem.data = { requests: ['modified'] };

      const verified = evidenceManager.verifyEvidence(item.id);

      expect(verified).toBe(false);
      expect(evidenceManager.stats.verificationsFailed).toBe(1);
    });

    test('should seal evidence', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const sealed = evidenceManager.sealEvidence(item.id, 'examiner');

      expect(sealed.sealed).toBe(true);
      expect(sealed.sealedBy).toBe('examiner');
      expect(evidenceManager.stats.itemsSealed).toBe(1);
    });

    test('should get evidence by ID', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.COOKIE,
        data: { cookies: [] }
      });

      const retrieved = evidenceManager.getEvidence(item.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(item.id);
      expect(retrieved.custodyChain.length).toBeGreaterThan(1); // Access recorded
      expect(retrieved.custodyChain[retrieved.custodyChain.length - 1].eventType).toBe(CUSTODY_EVENTS.ACCESSED);
    });

    test('should return null for non-existent evidence', () => {
      const retrieved = evidenceManager.getEvidence('non-existent-id');
      expect(retrieved).toBeNull();
    });

    test('should list all evidence', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' }
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' }
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      const items = evidenceManager.listEvidence();

      expect(items).toHaveLength(3);
    });

    test('should filter evidence by type', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' }
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data2' }
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' }
      });

      const screenshots = evidenceManager.listEvidence({ type: EVIDENCE_TYPES.SCREENSHOT });

      expect(screenshots).toHaveLength(2);
      expect(screenshots.every(item => item.type === EVIDENCE_TYPES.SCREENSHOT)).toBe(true);
    });

    test('should filter evidence by investigation ID', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' },
        investigationId: 'INV-001'
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data2' },
        investigationId: 'INV-001'
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' },
        investigationId: 'INV-002'
      });

      const inv001Items = evidenceManager.listEvidence({ investigationId: 'INV-001' });

      expect(inv001Items).toHaveLength(2);
    });

    test('should filter evidence by sealed status', async () => {
      const item1 = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data1' }
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data2' }
      });

      evidenceManager.sealEvidence(item1.id);

      const sealedItems = evidenceManager.listEvidence({ sealed: true });
      const unsealedItems = evidenceManager.listEvidence({ sealed: false });

      expect(sealedItems).toHaveLength(1);
      expect(unsealedItems).toHaveLength(1);
    });
  });

  describe('Package Management', () => {
    test('should create package', () => {
      const pkg = evidenceManager.createPackage({
        name: 'Test Package',
        description: 'Test',
        caseId: 'CASE-001',
        investigationId: 'INV-001'
      });

      expect(pkg.id).toBeDefined();
      expect(pkg.name).toBe('Test Package');
      expect(evidenceManager.packages.has(pkg.id)).toBe(true);
      expect(evidenceManager.stats.packagesCreated).toBe(1);
    });

    test('should add evidence to package', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const pkg = evidenceManager.createPackage({ name: 'Package 1' });
      evidenceManager.addToPackage(pkg.id, item.id);

      const updatedPkg = evidenceManager.packages.get(pkg.id);
      expect(updatedPkg.items).toHaveLength(1);
      expect(updatedPkg.items[0].id).toBe(item.id);
    });

    test('should throw error when adding non-existent evidence', () => {
      const pkg = evidenceManager.createPackage({ name: 'Package 1' });

      expect(() => evidenceManager.addToPackage(pkg.id, 'non-existent-id'))
        .toThrow('Evidence not found');
    });

    test('should seal package', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const pkg = evidenceManager.createPackage({ name: 'Package 1' });
      evidenceManager.addToPackage(pkg.id, item.id);

      evidenceManager.sealPackage(pkg.id, 'examiner');

      const sealedPkg = evidenceManager.packages.get(pkg.id);
      expect(sealedPkg.sealed).toBe(true);
      expect(sealedPkg.sealedBy).toBe('examiner');
      expect(sealedPkg.items[0].sealed).toBe(true);
    });

    test('should export package as JSON', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const pkg = evidenceManager.createPackage({ name: 'Package 1' });
      evidenceManager.addToPackage(pkg.id, item.id);

      const exportData = await evidenceManager.exportPackage(pkg.id, { format: 'json' });

      expect(exportData.id).toBe(pkg.id);
      expect(exportData.items).toHaveLength(1);
      expect(exportData.packageHash).toBeDefined();
      expect(evidenceManager.stats.exports).toBe(1);
    });

    test('should export package with audit log', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const pkg = evidenceManager.createPackage({ name: 'Package 1' });
      evidenceManager.addToPackage(pkg.id, item.id);

      const exportData = await evidenceManager.exportPackage(pkg.id, {
        format: 'json',
        includeAudit: true
      });

      expect(exportData.auditLog).toBeDefined();
      expect(Array.isArray(exportData.auditLog)).toBe(true);
    });

    test('should export package as SWGDE report', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' },
        metadata: { url: 'https://example.com' }
      });

      item.verify();

      const pkg = evidenceManager.createPackage({
        name: 'Forensic Evidence Package',
        caseId: 'CASE-001'
      });
      evidenceManager.addToPackage(pkg.id, item.id);
      evidenceManager.sealPackage(pkg.id, 'Forensic Examiner');

      const report = await evidenceManager.exportPackage(pkg.id, { format: 'swgde-report' });

      expect(typeof report).toBe('string');
      expect(report).toContain('DIGITAL FORENSIC EXAMINATION REPORT');
      expect(report).toContain('SWGDE Requirements for Report Writing Compliant');
      expect(report).toContain('Forensic Evidence Package');
      expect(report).toContain('CASE-001');
      expect(report).toContain('Chain of Custody');
      expect(report).toContain('SHA-256');
    });
  });

  describe('Statistics and Audit', () => {
    test('should track statistics', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const pkg = evidenceManager.createPackage({ name: 'Package 1' });

      const stats = evidenceManager.getStatistics();

      expect(stats.evidenceCollected).toBe(1);
      expect(stats.packagesCreated).toBe(1);
      expect(stats.totalEvidence).toBe(1);
      expect(stats.totalPackages).toBe(1);
    });

    test('should maintain audit log', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const auditLog = evidenceManager.getAuditLog();

      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].action).toBe('evidence_collected');
      expect(auditLog[0].timestamp).toBeDefined();
    });

    test('should filter audit log by investigation', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' },
        investigationId: 'INV-001'
      });
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html></html>' },
        investigationId: 'INV-002'
      });

      const inv001Log = evidenceManager.getAuditLog({ investigationId: 'INV-001' });

      expect(inv001Log.length).toBeGreaterThan(0);
      expect(inv001Log.every(entry => entry.details.investigationId === 'INV-001')).toBe(true);
    });

    test('should export audit log', async () => {
      await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      const result = await evidenceManager.exportAuditLog();

      expect(result.filename).toBeDefined();
      expect(result.path).toBeDefined();
      expect(result.entries).toBeGreaterThan(0);

      const exists = await fs.access(result.path).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Event Emitting', () => {
    test('should emit investigation-created event', (done) => {
      evidenceManager.on('investigation-created', (investigation) => {
        expect(investigation.name).toBe('Test Investigation');
        done();
      });

      evidenceManager.createInvestigation({ name: 'Test Investigation' });
    });

    test('should emit evidence-collected event', (done) => {
      evidenceManager.on('evidence-collected', (item) => {
        expect(item.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
        done();
      });

      evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });
    });

    test('should emit evidence-sealed event', async (done) => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      evidenceManager.on('evidence-sealed', (data) => {
        expect(data.evidenceId).toBe(item.id);
        done();
      });

      evidenceManager.sealEvidence(item.id);
    });

    test('should emit verification-failed event', async (done) => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [] }
      });

      // Tamper with evidence
      const storedItem = evidenceManager.evidence.get(item.id);
      storedItem.data = { requests: ['modified'] };

      evidenceManager.on('verification-failed', (data) => {
        expect(data.evidenceId).toBe(item.id);
        done();
      });

      evidenceManager.verifyEvidence(item.id);
    });

    test('should emit package-created event', (done) => {
      evidenceManager.on('package-created', (pkg) => {
        expect(pkg.name).toBe('Test Package');
        done();
      });

      evidenceManager.createPackage({ name: 'Test Package' });
    });

    test('should emit package-sealed event', async (done) => {
      const pkg = evidenceManager.createPackage({ name: 'Package 1' });

      evidenceManager.on('package-sealed', (sealedPkg) => {
        expect(sealedPkg.id).toBe(pkg.id);
        done();
      });

      evidenceManager.sealPackage(pkg.id);
    });

    test('should emit audit-entry event', (done) => {
      evidenceManager.on('audit-entry', (entry) => {
        expect(entry.action).toBe('evidence_collected');
        done();
      });

      evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw error when verifying non-existent evidence', () => {
      expect(() => evidenceManager.verifyEvidence('non-existent-id'))
        .toThrow('Evidence not found');
    });

    test('should throw error when sealing non-existent evidence', () => {
      expect(() => evidenceManager.sealEvidence('non-existent-id'))
        .toThrow('Evidence not found');
    });

    test('should throw error when adding to non-existent package', async () => {
      const item = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'data' }
      });

      expect(() => evidenceManager.addToPackage('non-existent-pkg', item.id))
        .toThrow('Package not found');
    });

    test('should throw error when sealing non-existent package', () => {
      expect(() => evidenceManager.sealPackage('non-existent-pkg'))
        .toThrow('Package not found');
    });

    test('should throw error when exporting non-existent package', async () => {
      await expect(evidenceManager.exportPackage('non-existent-pkg'))
        .rejects.toThrow('Package not found');
    });

    test('should throw error for unknown export format', async () => {
      const pkg = evidenceManager.createPackage({ name: 'Package 1' });

      await expect(evidenceManager.exportPackage(pkg.id, { format: 'unknown' }))
        .rejects.toThrow('Unknown export format');
    });
  });

  describe('Complex Workflows', () => {
    test('should handle complete investigation workflow', async () => {
      // Create investigation
      const investigation = evidenceManager.createInvestigation({
        name: 'Cybercrime Investigation',
        investigator: 'Detective Smith',
        caseId: 'CASE-2024-001'
      });

      // Collect multiple evidence items
      const screenshot = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.SCREENSHOT,
        data: { screenshot: 'base64data', url: 'https://suspect.com' },
        investigationId: investigation.id,
        actor: 'Detective Smith',
        tags: ['primary-evidence', 'screenshot']
      });

      const htmlSource = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.HTML_SOURCE,
        data: { html: '<html>...</html>', url: 'https://suspect.com' },
        investigationId: investigation.id,
        actor: 'Detective Smith',
        tags: ['primary-evidence', 'source-code']
      });

      const networkLog = await evidenceManager.collectEvidence({
        type: EVIDENCE_TYPES.NETWORK_LOG,
        data: { requests: [], responses: [] },
        investigationId: investigation.id,
        actor: 'Detective Smith',
        tags: ['network-analysis']
      });

      // Verify all evidence
      expect(evidenceManager.verifyEvidence(screenshot.id)).toBe(true);
      expect(evidenceManager.verifyEvidence(htmlSource.id)).toBe(true);
      expect(evidenceManager.verifyEvidence(networkLog.id)).toBe(true);

      // Create package
      const pkg = evidenceManager.createPackage({
        name: 'Cybercrime Evidence Package',
        description: 'Evidence collected from suspect website',
        caseId: investigation.caseId,
        investigationId: investigation.id
      });

      // Add evidence to package
      evidenceManager.addToPackage(pkg.id, screenshot.id);
      evidenceManager.addToPackage(pkg.id, htmlSource.id);
      evidenceManager.addToPackage(pkg.id, networkLog.id);

      // Seal package
      evidenceManager.sealPackage(pkg.id, 'Detective Smith');

      // Export for court
      const report = await evidenceManager.exportPackage(pkg.id, {
        format: 'swgde-report',
        includeAudit: true
      });

      expect(report).toContain('CASE-2024-001');
      expect(report).toContain('Cybercrime Evidence Package');

      // Verify statistics
      const stats = evidenceManager.getStatistics();
      expect(stats.evidenceCollected).toBe(3);
      expect(stats.packagesCreated).toBe(1);
      expect(stats.itemsSealed).toBe(4); // 3 items + 1 package seal
    });
  });
});

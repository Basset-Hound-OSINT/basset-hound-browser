/**
 * Tests for Evidence Collector Module
 *
 * Phase 18: Evidence Collection Workflow
 */

const {
  Evidence,
  EvidencePackage,
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS,
} = require('../../evidence/evidence-collector');

describe('Evidence', () => {
  describe('Constructor', () => {
    test('creates evidence with required fields', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      expect(evidence.id).toMatch(/^ev_/);
      expect(evidence.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
      expect(evidence.data).toBe('test-data');
      expect(evidence.capturedAt).toBeDefined();
      expect(evidence.contentHash).toBeDefined();
    });

    test('generates SHA-256 hash', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      expect(evidence.contentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(evidence.hashAlgorithm).toBe('sha256');
    });

    test('initializes custody chain', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      expect(evidence.custodyChain).toHaveLength(1);
      expect(evidence.custodyChain[0].action).toBe('created');
      expect(evidence.custodyChain[0].hash).toBe(evidence.contentHash);
    });

    test('accepts metadata', () => {
      const metadata = {
        url: 'https://example.com',
        title: 'Test Page',
        capturedBy: 'investigator',
      };

      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'data', metadata);

      expect(evidence.metadata.url).toBe('https://example.com');
      expect(evidence.metadata.title).toBe('Test Page');
      expect(evidence.capturedBy).toBe('investigator');
    });
  });

  describe('verifyIntegrity()', () => {
    test('returns true for unmodified evidence', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      expect(evidence.verifyIntegrity()).toBe(true);
    });

    test('returns false if data modified', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      evidence.data = 'modified-data';

      expect(evidence.verifyIntegrity()).toBe(false);
    });
  });

  describe('addCustodyEntry()', () => {
    test('adds entry to custody chain', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      evidence.addCustodyEntry('transferred', 'analyst', 'For analysis');

      expect(evidence.custodyChain).toHaveLength(2);
      expect(evidence.custodyChain[1].action).toBe('transferred');
      expect(evidence.custodyChain[1].actor).toBe('analyst');
      expect(evidence.custodyChain[1].notes).toBe('For analysis');
    });

    test('includes previous hash', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      const originalHash = evidence.contentHash;
      evidence.addCustodyEntry('reviewed', 'supervisor');

      expect(evidence.custodyChain[1].previousHash).toBe(originalHash);
    });
  });

  describe('getSummary()', () => {
    test('returns evidence summary without data', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'large-data', {
        url: 'https://example.com',
      });

      const summary = evidence.getSummary();

      expect(summary).toHaveProperty('id');
      expect(summary).toHaveProperty('type');
      expect(summary).toHaveProperty('capturedAt');
      expect(summary).toHaveProperty('contentHash');
      expect(summary).toHaveProperty('metadata');
      expect(summary).toHaveProperty('integrityValid');
      expect(summary).not.toHaveProperty('data');
    });
  });

  describe('toJSON()', () => {
    test('serializes complete evidence', () => {
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data', {
        url: 'https://example.com',
      });
      evidence.addCustodyEntry('reviewed', 'analyst');

      const json = evidence.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('data');
      expect(json).toHaveProperty('metadata');
      expect(json).toHaveProperty('custodyChain');
      expect(json.custodyChain).toHaveLength(2);
    });
  });
});

describe('EvidencePackage', () => {
  describe('Constructor', () => {
    test('creates package with defaults', () => {
      const pkg = new EvidencePackage();

      expect(pkg.id).toMatch(/^pkg_/);
      expect(pkg.name).toBe('Evidence Package');
      expect(pkg.sealed).toBe(false);
    });

    test('accepts options', () => {
      const pkg = new EvidencePackage({
        name: 'Test Package',
        description: 'Test description',
        investigationId: 'INV-001',
        caseNumber: 'CASE-2024-001',
        tags: ['fraud', 'urgent'],
      });

      expect(pkg.name).toBe('Test Package');
      expect(pkg.description).toBe('Test description');
      expect(pkg.investigationId).toBe('INV-001');
      expect(pkg.caseNumber).toBe('CASE-2024-001');
      expect(pkg.tags).toContain('fraud');
    });
  });

  describe('addEvidence()', () => {
    test('adds evidence to package', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      const id = pkg.addEvidence(evidence);

      expect(id).toBe(evidence.id);
      expect(pkg.evidence.size).toBe(1);
    });

    test('updates evidence custody chain', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');

      pkg.addEvidence(evidence);

      expect(evidence.custodyChain).toHaveLength(2);
      expect(evidence.custodyChain[1].action).toBe('added_to_package');
    });

    test('throws if package is sealed', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('test');

      const newEvidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'more-data');

      expect(() => pkg.addEvidence(newEvidence)).toThrow('sealed');
    });
  });

  describe('getEvidence()', () => {
    test('retrieves evidence by ID', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      const retrieved = pkg.getEvidence(evidence.id);

      expect(retrieved).toBe(evidence);
    });

    test('returns undefined for nonexistent ID', () => {
      const pkg = new EvidencePackage();

      const retrieved = pkg.getEvidence('nonexistent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('addAnnotation()', () => {
    test('adds annotation to package', () => {
      const pkg = new EvidencePackage();
      pkg.addAnnotation('Important finding', 'analyst');

      expect(pkg.annotations).toHaveLength(1);
      expect(pkg.annotations[0].text).toBe('Important finding');
      expect(pkg.annotations[0].author).toBe('analyst');
    });

    test('annotation includes evidence references', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      pkg.addAnnotation('Related to screenshot', 'analyst', [evidence.id]);

      expect(pkg.annotations[0].evidenceIds).toContain(evidence.id);
    });

    test('throws if package is sealed', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('test');

      expect(() => pkg.addAnnotation('Note', 'user')).toThrow('sealed');
    });
  });

  describe('seal()', () => {
    test('seals package', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      const hash = pkg.seal('investigator');

      expect(pkg.sealed).toBe(true);
      expect(pkg.sealedAt).toBeDefined();
      expect(pkg.sealedBy).toBe('investigator');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('generates package hash', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      pkg.seal('test');

      expect(pkg.packageHash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('updates evidence custody chains', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      pkg.seal('test');

      const lastEntry = evidence.custodyChain[evidence.custodyChain.length - 1];
      expect(lastEntry.action).toBe('package_sealed');
    });

    test('throws if already sealed', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('test');

      expect(() => pkg.seal('test')).toThrow('already sealed');
    });

    test('throws if evidence integrity fails', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      evidence.data = 'tampered'; // Tamper with data

      expect(() => pkg.seal('test')).toThrow('integrity');
    });
  });

  describe('verifyPackage()', () => {
    test('returns invalid if not sealed', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      const result = pkg.verifyPackage();

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not sealed');
    });

    test('returns valid for intact sealed package', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('test');

      const result = pkg.verifyPackage();

      expect(result.valid).toBe(true);
      expect(result.packageHash).toBe(pkg.packageHash);
    });

    test('detects evidence tampering', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('test');

      // Tamper after sealing
      evidence.data = 'tampered';

      const result = pkg.verifyPackage();

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('integrity');
    });
  });

  describe('getSummary()', () => {
    test('returns package summary', () => {
      const pkg = new EvidencePackage({
        name: 'Test Package',
        caseNumber: 'CASE-001',
      });
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.addAnnotation('Note', 'analyst');

      const summary = pkg.getSummary();

      expect(summary.name).toBe('Test Package');
      expect(summary.caseNumber).toBe('CASE-001');
      expect(summary.evidenceCount).toBe(1);
      expect(summary.annotationCount).toBe(1);
      expect(summary.sealed).toBe(false);
    });
  });

  describe('exportForCourt()', () => {
    test('exports sealed package', () => {
      const pkg = new EvidencePackage({
        name: 'Court Package',
        caseNumber: 'CASE-001',
      });
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data', {
        url: 'https://example.com',
      });
      pkg.addEvidence(evidence);
      pkg.addAnnotation('Important finding', 'analyst');
      pkg.seal('investigator');

      const exported = pkg.exportForCourt();

      expect(exported).toHaveProperty('packageInfo');
      expect(exported).toHaveProperty('verification');
      expect(exported).toHaveProperty('evidence');
      expect(exported).toHaveProperty('annotations');
      expect(exported).toHaveProperty('certificationStatement');
      expect(exported.verification.status).toBe('VERIFIED');
    });

    test('throws if not sealed', () => {
      const pkg = new EvidencePackage();
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);

      expect(() => pkg.exportForCourt()).toThrow('must be sealed');
    });

    test('certification statement includes key info', () => {
      const pkg = new EvidencePackage({
        name: 'Test',
        caseNumber: 'CASE-001',
      });
      const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, 'test-data');
      pkg.addEvidence(evidence);
      pkg.seal('investigator');

      const exported = pkg.exportForCourt();

      expect(exported.certificationStatement).toContain('CASE-001');
      expect(exported.certificationStatement).toContain(pkg.packageHash);
      expect(exported.certificationStatement).toContain('SHA-256');
    });
  });
});

describe('EvidenceCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new EvidenceCollector();
  });

  describe('createPackage()', () => {
    test('creates and stores package', () => {
      const pkg = collector.createPackage({ name: 'Test' });

      expect(pkg.name).toBe('Test');
      expect(collector.packages.size).toBe(1);
    });

    test('sets as active package if none exists', () => {
      const pkg = collector.createPackage();

      expect(collector.activePackageId).toBe(pkg.id);
    });

    test('emits packageCreated event', () => {
      let emitted = null;
      collector.on('packageCreated', (data) => { emitted = data; });

      collector.createPackage({ name: 'Test' });

      expect(emitted).not.toBeNull();
      expect(emitted.name).toBe('Test');
    });
  });

  describe('getActivePackage() and setActivePackage()', () => {
    test('returns null when no active package', () => {
      expect(collector.getActivePackage()).toBeNull();
    });

    test('gets active package', () => {
      const pkg = collector.createPackage();

      expect(collector.getActivePackage()).toBe(pkg);
    });

    test('sets active package', () => {
      const pkg1 = collector.createPackage({ name: 'First' });
      const pkg2 = collector.createPackage({ name: 'Second' });
      collector.setActivePackage(pkg1.id);

      expect(collector.getActivePackage()).toBe(pkg1);
    });

    test('throws for nonexistent package', () => {
      expect(() => collector.setActivePackage('nonexistent')).toThrow('not found');
    });
  });

  describe('Capture Methods', () => {
    beforeEach(() => {
      collector.createPackage();
    });

    test('captureScreenshot()', () => {
      const evidence = collector.captureScreenshot('base64-data', {
        url: 'https://example.com',
        fullPage: true,
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
      expect(evidence.metadata.url).toBe('https://example.com');
      expect(evidence.metadata.fullPage).toBe(true);
    });

    test('capturePageArchive()', () => {
      const evidence = collector.capturePageArchive('<html>...</html>', 'html', {
        url: 'https://example.com',
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.PAGE_ARCHIVE);
      expect(evidence.metadata.format).toBe('html');
    });

    test('captureNetworkHAR()', () => {
      const harData = {
        log: {
          entries: [{}, {}, {}],
        },
      };

      const evidence = collector.captureNetworkHAR(harData, {
        url: 'https://example.com',
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.NETWORK_HAR);
      expect(evidence.metadata.entryCount).toBe(3);
    });

    test('captureDOMSnapshot()', () => {
      const evidence = collector.captureDOMSnapshot('<html>...</html>', {
        url: 'https://example.com',
        nodeCount: 100,
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.DOM_SNAPSHOT);
      expect(evidence.metadata.nodeCount).toBe(100);
    });

    test('captureConsoleLogs()', () => {
      const logs = [
        { level: 'error', message: 'Error 1' },
        { level: 'warn', message: 'Warning 1' },
      ];

      const evidence = collector.captureConsoleLogs(logs, {
        url: 'https://example.com',
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.CONSOLE_LOG);
      expect(evidence.metadata.logCount).toBe(2);
    });

    test('captureCookies()', () => {
      const cookies = [
        { name: 'session', value: 'abc' },
        { name: 'user', value: 'xyz' },
      ];

      const evidence = collector.captureCookies(cookies, {
        url: 'https://example.com',
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.COOKIES);
      expect(evidence.metadata.cookieCount).toBe(2);
    });

    test('captureLocalStorage()', () => {
      const storage = {
        key1: 'value1',
        key2: 'value2',
      };

      const evidence = collector.captureLocalStorage(storage, {
        url: 'https://example.com',
      });

      expect(evidence.type).toBe(EVIDENCE_TYPES.LOCAL_STORAGE);
      expect(evidence.metadata.keyCount).toBe(2);
    });

    test('adds evidence to active package', () => {
      collector.captureScreenshot('data', { url: 'test' });
      collector.capturePageArchive('html', 'html', { url: 'test' });

      const pkg = collector.getActivePackage();
      expect(pkg.evidence.size).toBe(2);
    });

    test('emits evidenceCaptured event', () => {
      let emitted = null;
      collector.on('evidenceCaptured', (data) => { emitted = data; });

      collector.captureScreenshot('data', { url: 'test' });

      expect(emitted).not.toBeNull();
      expect(emitted.type).toBe(EVIDENCE_TYPES.SCREENSHOT);
    });
  });

  describe('captureBundle()', () => {
    test('captures multiple evidence types', async () => {
      collector.createPackage();

      const captureFunction = async (type) => {
        switch (type) {
          case 'screenshot': return 'screenshot-data';
          case 'archive': return '<html>archive</html>';
          case 'dom': return '<html>dom</html>';
          case 'cookies': return [{ name: 'test', value: '123' }];
          case 'localStorage': return { key: 'value' };
          case 'consoleLogs': return [{ level: 'log', message: 'test' }];
          default: return null;
        }
      };

      const captured = await collector.captureBundle(
        {
          screenshot: true,
          archive: true,
          dom: true,
          cookies: true,
          localStorage: true,
          consoleLogs: true,
        },
        { url: 'https://example.com', title: 'Test Page' },
        captureFunction
      );

      expect(captured).toHaveLength(6);
    });
  });

  describe('sealActivePackage()', () => {
    test('seals the active package', () => {
      const pkg = collector.createPackage();
      collector.captureScreenshot('data', { url: 'test' });

      const hash = collector.sealActivePackage('test-user');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(pkg.sealed).toBe(true);
    });

    test('emits packageSealed event', () => {
      collector.createPackage();
      collector.captureScreenshot('data', { url: 'test' });

      let emitted = null;
      collector.on('packageSealed', (data) => { emitted = data; });

      collector.sealActivePackage('test');

      expect(emitted).not.toBeNull();
      expect(emitted.hash).toBeDefined();
    });

    test('throws if no active package', () => {
      expect(() => collector.sealActivePackage('test')).toThrow('No active package');
    });
  });

  describe('listPackages()', () => {
    test('returns list of package summaries', () => {
      collector.createPackage({ name: 'Package 1' });
      collector.createPackage({ name: 'Package 2' });

      const list = collector.listPackages();

      expect(list).toHaveLength(2);
      expect(list[0]).toHaveProperty('id');
      expect(list[0]).toHaveProperty('name');
    });
  });

  describe('exportPackage()', () => {
    test('exports package as JSON', () => {
      const pkg = collector.createPackage();
      collector.captureScreenshot('data', { url: 'test' });

      const exported = collector.exportPackage(pkg.id, 'json');

      expect(exported).toHaveProperty('package');
      expect(exported).toHaveProperty('evidence');
      expect(exported.evidence).toHaveLength(1);
    });

    test('exports package for court', () => {
      const pkg = collector.createPackage({ caseNumber: 'CASE-001' });
      collector.captureScreenshot('data', { url: 'test' });
      collector.sealActivePackage('test');

      const exported = collector.exportPackage(pkg.id, 'court');

      expect(exported).toHaveProperty('certificationStatement');
      expect(exported).toHaveProperty('verification');
    });

    test('throws for nonexistent package', () => {
      expect(() => collector.exportPackage('nonexistent')).toThrow('not found');
    });
  });

  describe('getStats()', () => {
    test('returns collector statistics', () => {
      const pkg1 = collector.createPackage();
      collector.captureScreenshot('data1', { url: 'test' });
      collector.capturePageArchive('html', 'html', { url: 'test' });
      collector.sealActivePackage('test');

      const pkg2 = collector.createPackage();
      collector.captureScreenshot('data2', { url: 'test' });

      const stats = collector.getStats();

      expect(stats.totalPackages).toBe(2);
      expect(stats.sealedPackages).toBe(1);
      expect(stats.totalEvidence).toBe(3);
      expect(stats.activePackageId).toBe(pkg2.id);
    });
  });
});

describe('Constants', () => {
  describe('EVIDENCE_TYPES', () => {
    test('has all expected types', () => {
      expect(EVIDENCE_TYPES).toHaveProperty('SCREENSHOT');
      expect(EVIDENCE_TYPES).toHaveProperty('PAGE_ARCHIVE');
      expect(EVIDENCE_TYPES).toHaveProperty('NETWORK_HAR');
      expect(EVIDENCE_TYPES).toHaveProperty('DOM_SNAPSHOT');
      expect(EVIDENCE_TYPES).toHaveProperty('CONSOLE_LOG');
      expect(EVIDENCE_TYPES).toHaveProperty('COOKIES');
      expect(EVIDENCE_TYPES).toHaveProperty('LOCAL_STORAGE');
      expect(EVIDENCE_TYPES).toHaveProperty('METADATA');
    });
  });

  describe('ARCHIVE_FORMATS', () => {
    test('has expected formats', () => {
      expect(ARCHIVE_FORMATS).toHaveProperty('MHTML');
      expect(ARCHIVE_FORMATS).toHaveProperty('HTML');
      expect(ARCHIVE_FORMATS).toHaveProperty('WARC');
      expect(ARCHIVE_FORMATS).toHaveProperty('PDF');
    });
  });
});

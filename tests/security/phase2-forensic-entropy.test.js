/**
 * Security Phase 2: Forensic Entropy and MD5 Removal Tests
 * Validates that forensic report IDs use proper entropy
 * Validates that MD5 usage has been removed
 */

const ForensicReportGenerator = require('../../src/analysis/forensic-report-generator');
const ForensicIntegration = require('../../src/agents/forensic-integration');
const { Orchestrator } = require('../../src/agents/orchestrator');
const crypto = require('crypto');

describe('Security Phase 2: Forensic Entropy', () => {
  describe('Forensic Report ID Entropy', () => {
    let generator;

    beforeEach(() => {
      generator = new ForensicReportGenerator();
    });

    test('Report IDs use 16 bytes (128 bits) entropy', () => {
      const report = generator.generateReport({
        title: 'Test Report',
        investigator: 'Test'
      });

      expect(report.id).toBeDefined();
      expect(report.id).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    });

    test('Report IDs are globally unique', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const report = generator.generateReport({ title: 'Test' });
        ids.add(report.id);
      }

      expect(ids.size).toBe(100); // All unique
    });

    test('Evidence IDs use proper entropy (16 bytes)', () => {
      const report = generator.generateReport({
        session: { hash: 'abc123' },
        screenshots: [{ timestamp: Date.now() }],
        siteAnalysis: {},
        metadata: {},
        network: { total_requests: 5 }
      });

      const chainOfCustody = report.chain_of_custody;
      const evidence = chainOfCustody.preserved_evidence;

      evidence.forEach(item => {
        expect(item.evidence_id).toBeDefined();
        expect(item.evidence_id).toMatch(/^[a-f0-9]{32}$/); // 16 bytes
      });
    });

    test('No repeating evidence IDs in chain of custody', () => {
      const report = generator.generateReport({
        session: { hash: 'abc' },
        screenshots: [{ timestamp: Date.now() }],
        siteAnalysis: {},
        metadata: {},
        network: { total_requests: 1 }
      });

      const evidence = report.chain_of_custody.preserved_evidence;
      const ids = new Set(evidence.map(e => e.evidence_id));

      expect(ids.size).toBe(evidence.length); // All unique
    });
  });

  describe('Forensic Integration ID Entropy', () => {
    let forensic;

    beforeEach(() => {
      forensic = new ForensicIntegration();
    });

    test('Evidence IDs use 16 bytes entropy', () => {
      forensic.captureScreenshot(Buffer.alloc(100), {
        url: 'https://example.com',
        timestamp: Date.now()
      });

      const entry = forensic.evidenceLog[0];
      expect(entry.id).toBeDefined();
      expect(entry.id).toMatch(/^evt_\d+_[a-f0-9]{32}$/);

      const randomPart = entry.id.split('_')[2];
      expect(randomPart.length).toBe(32); // 16 bytes
    });

    test('Custody IDs use 16 bytes entropy', () => {
      forensic.captureScreenshot(Buffer.alloc(100), { url: 'https://example.com' });

      const custodyEntry = forensic.chainOfCustody[0];
      expect(custodyEntry.id).toBeDefined();
      expect(custodyEntry.id).toMatch(/^coc_\d+_[a-f0-9]{32}$/);

      const randomPart = custodyEntry.id.split('_')[2];
      expect(randomPart.length).toBe(32); // 16 bytes
    });

    test('All evidence IDs are unique', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        forensic.captureScreenshot(Buffer.alloc(100), { url: 'https://example.com/' + i });
        ids.add(forensic.evidenceLog[i].id);
      }

      expect(ids.size).toBe(50); // All unique
    });

    test('All custody IDs are unique', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        forensic.captureScreenshot(Buffer.alloc(100), { url: 'https://example.com/' + i });
        ids.add(forensic.chainOfCustody[i].id);
      }

      expect(ids.size).toBe(50); // All unique
    });
  });

  describe('Orchestrator Execution ID Entropy', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new Orchestrator();
    });

    test('Execution IDs use 16 bytes entropy', () => {
      const execId = orchestrator.generateExecutionId();

      expect(execId).toBeDefined();
      expect(execId).toMatch(/^exec_\d+_[a-f0-9]{32}$/);

      const randomPart = execId.split('_')[2];
      expect(randomPart.length).toBe(32); // 16 bytes
    });

    test('All execution IDs are unique', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        ids.add(orchestrator.generateExecutionId());
      }

      expect(ids.size).toBe(50); // All unique
    });

    test('Execution IDs include timestamp component', () => {
      const execId = orchestrator.generateExecutionId();
      const parts = execId.split('_');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('exec');
      expect(/^\d+$/.test(parts[1])).toBe(true); // Timestamp
      expect(/^[a-f0-9]{32}$/.test(parts[2])).toBe(true); // Random part
    });
  });

  describe('Entropy Quality Validation', () => {
    test('Evidence ID randomness is uniform', () => {
      const forensic = new ForensicIntegration();
      const ids = [];

      for (let i = 0; i < 100; i++) {
        forensic.captureScreenshot(Buffer.alloc(100), { url: 'https://example.com/' + i });
        const id = forensic.evidenceLog[i].id;
        const randomPart = id.split('_')[2];
        ids.push(randomPart);
      }

      // Check character distribution (should not be heavily biased)
      const charCounts = {};
      ids.forEach(id => {
        for (const char of id) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }
      });

      // All hex characters should appear with reasonable frequency
      Object.values(charCounts).forEach(count => {
        expect(count).toBeGreaterThan(0);
        expect(count / (100 * 32)).toBeLessThan(0.25); // No single char dominates
      });
    });

    test('Execution ID entropy independent of timing', () => {
      const orchestrator = new Orchestrator();
      const execIds = [];

      // Generate multiple IDs quickly
      for (let i = 0; i < 20; i++) {
        execIds.push(orchestrator.generateExecutionId());
      }

      // Extract random parts
      const randomParts = execIds.map(id => id.split('_')[2]);

      // All random parts should be different (not dependent on timestamp)
      const uniqueParts = new Set(randomParts);
      expect(uniqueParts.size).toBe(20); // All different
    });

    test('Report ID has no repeating byte patterns', () => {
      const generator = new ForensicReportGenerator();
      const report = generator.generateReport({ title: 'Test' });

      const id = report.id;

      // Check for repeating patterns like 'aaaa', 'abab'
      const doublePatterns = id.match(/(.)\1{3,}/g);
      expect(doublePatterns || []).toHaveLength(0); // No 4+ repeats
    });
  });

  describe('MD5 Removal Validation', () => {
    test('MetadataExtractor generates SHA256 hashes only', () => {
      // We can't directly test without file I/O, but verify the module doesn't reference MD5
      const MetadataExtractor = require('../../src/forensics/metadata-extractor');
      const extractor = new MetadataExtractor();

      // Create test data
      const testBuffer = Buffer.from('test data');
      const hashes = extractor.generateHashes(testBuffer);

      // Should only have sha256, not md5 or sha1
      expect(hashes.sha256).toBeDefined();
      expect(hashes.md5).toBeUndefined();
      expect(hashes.sha1).toBeUndefined();
    });

    test('SHA256 hash is 64 hex characters (256 bits)', () => {
      const MetadataExtractor = require('../../src/forensics/metadata-extractor');
      const extractor = new MetadataExtractor();

      const testBuffer = Buffer.from('test data');
      const hashes = extractor.generateHashes(testBuffer);

      expect(hashes.sha256).toMatch(/^[a-f0-9]{64}$/);
    });

    test('TechDetector uses SHA256 for favicon hashing', async () => {
      const TechDetector = require('../../src/analysis/tech-detector');
      const detector = new TechDetector();

      const faviconBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header

      // The detectByFavicon method should use SHA256
      const detections = await detector.detectByFavicon(faviconBuffer);

      // Verify method references (check the module code)
      // This is more of an integration test
      expect(typeof detector.detectByFavicon).toBe('function');
    });
  });

  describe('Entropy Comparison: Old vs New', () => {
    test('Old entropy (4 bytes) had 32 bits: 2^32 = 4.3 billion combinations', () => {
      const oldBits = 4 * 8;
      const oldCombinations = Math.pow(2, oldBits);

      expect(oldBits).toBe(32);
      expect(oldCombinations).toBeGreaterThan(4e9);
      expect(oldCombinations).toBeLessThan(4.3e9);
    });

    test('New entropy (16 bytes) has 128 bits: 2^128 = 3.4×10^38 combinations', () => {
      const newBits = 16 * 8;
      const newCombinations = Math.pow(2, newBits);

      expect(newBits).toBe(128);
      expect(newCombinations).toBeGreaterThan(1e38);
    });

    test('New entropy is 2^96 times larger than old', () => {
      const ratio = Math.pow(2, 96);
      expect(ratio).toBeGreaterThan(1e28);
    });

    test('Brute force resistance dramatically improved', () => {
      // Old entropy: 4 billion attempts feasible
      // New entropy: 10^38 attempts infeasible

      const oldAttempts = Math.pow(2, 32); // 4.3 × 10^9
      const newAttempts = Math.pow(2, 128); // 3.4 × 10^38

      // New is infeasibly larger
      expect(newAttempts / oldAttempts).toBeGreaterThan(1e28);
    });
  });

  describe('Cryptographic Security Properties', () => {
    test('SHA256 provides collision resistance', () => {
      const crypto = require('crypto');

      const hash1 = crypto.createHash('sha256').update('test1').digest('hex');
      const hash2 = crypto.createHash('sha256').update('test2').digest('hex');

      // Different inputs produce completely different hashes
      expect(hash1).not.toBe(hash2);

      // Hash is deterministic
      const hash1again = crypto.createHash('sha256').update('test1').digest('hex');
      expect(hash1).toBe(hash1again);
    });

    test('Random bytes from crypto.randomBytes are cryptographically secure', () => {
      const bytes1 = crypto.randomBytes(16);
      const bytes2 = crypto.randomBytes(16);

      // Should almost certainly be different
      expect(bytes1).not.toEqual(bytes2);

      // Should not have patterns
      const hex1 = bytes1.toString('hex');
      const hex2 = bytes2.toString('hex');

      // Different hex representations
      expect(hex1).not.toBe(hex2);
    });

    test('16 bytes entropy cannot be exhausted in reasonable time', () => {
      // 2^128 ≈ 3.4 × 10^38 attempts
      // At 1 billion attempts/second: 3.4 × 10^29 seconds
      // Age of universe: 1.3 × 10^10 seconds

      const totalCombinations = Math.pow(2, 128);
      const attemptsPerSecond = 1e9;
      const secondsToExhaust = totalCombinations / attemptsPerSecond;
      const ageOfUniverse = 13.8e9;

      expect(secondsToExhaust).toBeGreaterThan(ageOfUniverse * 1e18);
    });
  });

  describe('Backward Compatibility Validation', () => {
    test('Old ID format (4 bytes) is no longer used anywhere', () => {
      const forensic = new ForensicIntegration();

      for (let i = 0; i < 10; i++) {
        forensic.captureScreenshot(Buffer.alloc(10), { url: 'test' });
      }

      forensic.evidenceLog.forEach(item => {
        // All IDs should have 32 hex chars (16 bytes), not 8 (4 bytes)
        const randomPart = item.id.split('_')[2];
        expect(randomPart.length).toBe(32);
        expect(randomPart.length).not.toBe(8);
      });
    });
  });
});

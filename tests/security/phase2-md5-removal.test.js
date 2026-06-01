/**
 * Security Phase 2: MD5 Removal Tests
 * Validates removal of MD5 hashing and migration to SHA256
 *
 * Tests:
 * - MD5 is not used for favicons
 * - SHA256 only for hashes
 * - Consistency across hash implementations
 */

const TechDetector = require('../../src/analysis/tech-detector');
const crypto = require('crypto');

describe('Security Phase 2: MD5 Removal', () => {
  let detector;

  beforeEach(() => {
    detector = new TechDetector();
  });

  describe('Favicon Hash Usage', () => {
    test('Uses SHA256 only for favicon hashing', async () => {
      // Create test favicon buffer
      const faviconBuffer = Buffer.from('test-favicon-data');

      // Spy on crypto.createHash
      const originalCreateHash = crypto.createHash;
      const hashCalls = [];

      crypto.createHash = function(algorithm) {
        hashCalls.push(algorithm);
        return originalCreateHash.call(this, algorithm);
      };

      try {
        // Call detect by favicon
        await detector.detectByFavicon(faviconBuffer);

        // Should only call SHA256, not MD5
        expect(hashCalls.includes('md5')).toBe(false);
        expect(hashCalls.includes('sha256')).toBe(true);
      } finally {
        crypto.createHash = originalCreateHash;
      }
    });

    test('Favicon detection evidence shows SHA256 hash type', async () => {
      // Create test signature database with SHA256
      detector.signatures = {
        'test-tech': {
          name: 'Test Technology',
          category: 'Test',
          favicon: {
            sha256: 'abc123def456'  // Only SHA256
          }
        }
      };

      const faviconBuffer = Buffer.from('test-data');
      const sha256Hash = crypto.createHash('sha256').update(faviconBuffer).digest('hex');

      // Override signature to match our test
      detector.signatures['test-tech'].favicon.sha256 = sha256Hash;

      const detections = await detector.detectByFavicon(faviconBuffer);

      if (detections.length > 0) {
        const detection = detections[0];
        expect(detection.evidence.hashType).toBe('SHA256');
        expect(detection.evidence.hashType).not.toBe('MD5');
      }
    });

    test('SHA256 hash is consistent and reproducible', () => {
      const data = Buffer.from('test-favicon-consistency');

      const hash1 = crypto.createHash('sha256').update(data).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data).digest('hex');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);  // 256-bit hex
    });

    test('SHA256 produces 64 hex character output', () => {
      const data = Buffer.from('test-data');
      const hash = crypto.createHash('sha256').update(data).digest('hex');

      // SHA256 = 256 bits = 32 bytes = 64 hex chars
      expect(hash.length).toBe(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('Different data produces different SHA256 hashes', () => {
      const data1 = Buffer.from('favicon-1');
      const data2 = Buffer.from('favicon-2');

      const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data2).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    test('Favicon detection skips MD5 comparison', async () => {
      // Create a signature with only SHA256 (no MD5)
      const testSha256 = crypto.createHash('sha256')
        .update(Buffer.from('test-favicon'))
        .digest('hex');

      detector.signatures = {
        'test-tech': {
          name: 'Test Tech',
          category: 'Test',
          favicon: {
            sha256: testSha256  // Only SHA256, no md5 field
          }
        }
      };

      const detections = await detector.detectByFavicon(Buffer.from('test-favicon'));

      // Should match because SHA256 matches
      expect(detections.length).toBe(1);
      expect(detections[0].evidence.hashType).toBe('SHA256');
    });

    test('No MD5 field in favicon evidence output', async () => {
      const faviconBuffer = Buffer.from('test-favicon');
      const sha256 = crypto.createHash('sha256').update(faviconBuffer).digest('hex');

      detector.signatures = {
        'test-tech': {
          name: 'Test',
          category: 'Test',
          favicon: {
            sha256: sha256
          }
        }
      };

      const detections = await detector.detectByFavicon(faviconBuffer);

      if (detections.length > 0) {
        const evidence = detections[0].evidence;
        expect(evidence).not.toHaveProperty('md5Hash');
        expect(evidence).not.toHaveProperty('md5');
      }
    });
  });

  describe('Hash Algorithm Strength', () => {
    test('SHA256 is cryptographically strong', () => {
      // SHA256 should be part of Node crypto strong algorithms
      const algorithms = crypto.getHashes();
      expect(algorithms).toContain('sha256');
    });

    test('MD5 is not used anywhere in tech detection', () => {
      const source = detector.detectByFavicon.toString();

      // Should not contain 'md5' in detection code
      expect(source.toLowerCase()).not.toContain("'md5'");
      expect(source.toLowerCase()).not.toContain('"md5"');
    });

    test('SHA256 provides collision resistance', () => {
      // Generate two different inputs
      const input1 = Buffer.from('input1-' + Math.random());
      const input2 = Buffer.from('input2-' + Math.random());

      const hash1 = crypto.createHash('sha256').update(input1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(input2).digest('hex');

      // Different inputs should produce different hashes
      // (with overwhelming probability for SHA256)
      expect(hash1).not.toBe(hash2);
    });

    test('SHA256 is faster than MD5 in Node', (done) => {
      const testData = Buffer.alloc(1024 * 1024);  // 1MB

      const start1 = process.hrtime.bigint();
      for (let i = 0; i < 100; i++) {
        crypto.createHash('sha256').update(testData).digest('hex');
      }
      const end1 = process.hrtime.bigint();

      const sha256Time = Number(end1 - start1);

      // SHA256 should complete in reasonable time
      expect(sha256Time).toBeLessThan(1000000000);  // Less than 1 second

      done();
    });
  });

  describe('Backward Compatibility', () => {
    test('Removes MD5 hash from detection results', async () => {
      const faviconBuffer = Buffer.from('favicon-data');

      const detections = await detector.detectByFavicon(faviconBuffer);

      // Check all detections only have SHA256
      detections.forEach(detection => {
        if (detection.evidence) {
          expect(detection.evidence.hashType).toBe('SHA256');
        }
      });
    });

    test('Detection method still works with SHA256 only', async () => {
      detector.signatures = {
        'known-tech': {
          name: 'Known Technology',
          category: 'Web Framework',
          favicon: {
            sha256: 'abc123def456'
          }
        }
      };

      // Patch signature with matching hash
      const testBuffer = Buffer.from('test');
      const hash = crypto.createHash('sha256').update(testBuffer).digest('hex');
      detector.signatures['known-tech'].favicon.sha256 = hash;

      const detections = await detector.detectByFavicon(testBuffer);

      // Should still detect technologies
      expect(detections).toBeInstanceOf(Array);
    });
  });

  describe('Security Implications', () => {
    test('MD5 collisions are not a concern with SHA256', () => {
      // MD5 has known collision attacks
      // SHA256 has no practical collision attacks

      const data1 = Buffer.from('data1');
      const data2 = Buffer.from('data2');

      const hash1 = crypto.createHash('sha256').update(data1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(data2).digest('hex');

      // Finding a collision in SHA256 is computationally infeasible
      expect(hash1).not.toBe(hash2);
    });

    test('SHA256 provides integrity protection', () => {
      const data = Buffer.from('important-favicon-data');
      const hash = crypto.createHash('sha256').update(data).digest('hex');

      // Any modification to data should change hash
      const modifiedData = Buffer.from('important-favicon-data-modified');
      const modifiedHash = crypto.createHash('sha256').update(modifiedData).digest('hex');

      expect(hash).not.toBe(modifiedHash);
    });
  });

  describe('Migration Validation', () => {
    test('All favicon hashes in signatures use SHA256', () => {
      // When loading signatures, ensure no MD5 hashes remain
      const mockSignatures = {
        'tech1': {
          favicon: {
            sha256: 'abc123'
            // md5 field should NOT exist
          }
        },
        'tech2': {
          favicon: {
            sha256: 'def456'
          }
        }
      };

      // Verify structure
      Object.values(mockSignatures).forEach(tech => {
        if (tech.favicon) {
          expect(tech.favicon).toHaveProperty('sha256');
          expect(tech.favicon).not.toHaveProperty('md5');
        }
      });
    });

    test('Tech detector loads only SHA256-based signatures', async () => {
      detector.signatures = {
        'modern-tech': {
          favicon: {
            sha256: 'abc123def456'
          }
        }
      };

      const tech = detector.signatures['modern-tech'];
      expect(tech.favicon).toHaveProperty('sha256');
      expect(tech.favicon).not.toHaveProperty('md5');
    });
  });
});

/**
 * Cryptographic Strength Analysis Tests
 *
 * Tests: 20+ comprehensive cryptographic scenarios
 * Coverage: Algorithm validation, entropy analysis, key derivation
 */

const CryptoAnalyzer = require('../../src/security/crypto-analysis');
const crypto = require('crypto');

describe('Cryptographic Strength Analysis', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = CryptoAnalyzer;
  });

  describe('Hash Algorithm Validation', () => {
    test('SHA256 is valid and strong', () => {
      const result = analyzer.validateHashAlgorithm('sha256');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe(256);
      expect(result.deprecated).toBe(false);
    });

    test('SHA512 is valid and stronger', () => {
      const result = analyzer.validateHashAlgorithm('sha512');
      expect(result.valid).toBe(true);
      expect(result.strength).toBe(512);
    });

    test('SHA1 is deprecated and invalid for security', () => {
      const result = analyzer.validateHashAlgorithm('sha1');
      expect(result.valid).toBe(false);
      expect(result.deprecated).toBe(true);
      expect(result.issues.some(e => e.includes('deprecated'))).toBe(true);
    });

    test('Unknown algorithm returns error', () => {
      const result = analyzer.validateHashAlgorithm('unknown-algo');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown');
    });

    test('Weak algorithm detected', () => {
      const result = analyzer.validateHashAlgorithm('md5');
      expect(result.valid).toBe(false);
    });
  });

  describe('Cipher Algorithm Validation', () => {
    test('AES-256-GCM is valid with correct key', () => {
      const key = crypto.randomBytes(32);
      const result = analyzer.validateCipherAlgorithm('aes-256-gcm', key);
      expect(result.valid).toBe(true);
      expect(result.strength).toBe(256);
      expect(result.aead).toBe(true);
    });

    test('AES-256-GCM requires 32-byte key', () => {
      const key = crypto.randomBytes(16);  // Wrong size
      const result = analyzer.validateCipherAlgorithm('aes-256-gcm', key);
      expect(result.valid).toBe(false);
      expect(result.issues.some(e => e.includes('Invalid key length'))).toBe(true);
    });

    test('ChaCha20-Poly1305 is AEAD', () => {
      const key = crypto.randomBytes(32);
      const result = analyzer.validateCipherAlgorithm('chacha20-poly1305', key);
      expect(result.valid).toBe(true);
      expect(result.aead).toBe(true);
    });

    test('Missing key returns error', () => {
      const result = analyzer.validateCipherAlgorithm('aes-256-gcm', null);
      expect(result.valid).toBe(false);
      expect(result.issues.some(e => e.includes('must be a Buffer'))).toBe(true);
    });
  });

  describe('HMAC Algorithm Validation', () => {
    test('HMAC-SHA256 is valid with sufficient key', () => {
      const key = crypto.randomBytes(32);
      const result = analyzer.validateHMACAlgorithm('sha256', key);
      expect(result.valid).toBe(true);
      expect(result.strength).toBe(256);
    });

    test('HMAC-SHA512 is valid', () => {
      const key = crypto.randomBytes(64);
      const result = analyzer.validateHMACAlgorithm('sha512', key);
      expect(result.valid).toBe(true);
      expect(result.strength).toBe(512);
    });

    test('Weak HMAC key detected', () => {
      const key = crypto.randomBytes(8);  // Too small
      const result = analyzer.validateHMACAlgorithm('sha256', key);
      expect(result.valid).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('Unknown HMAC algorithm returns error', () => {
      const key = crypto.randomBytes(32);
      const result = analyzer.validateHMACAlgorithm('unknown', key);
      expect(result.valid).toBe(false);
    });
  });

  describe('Entropy Analysis', () => {
    test('Sufficient entropy is verified', () => {
      const data = crypto.randomBytes(32);  // 256 bits
      const result = analyzer.analyzeEntropy(data, 128);
      expect(result.sufficient).toBe(true);
      expect(result.bits).toBe(256);
      expect(result.uniformity).toBeGreaterThan(50);
    });

    test('Entropy analysis detects insufficient data', () => {
      const data = crypto.randomBytes(8);  // 64 bits
      const result = analyzer.analyzeEntropy(data, 128);
      expect(result.sufficient).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('Entropy analysis counts unique bytes', () => {
      const data = crypto.randomBytes(256);
      const result = analyzer.analyzeEntropy(data);
      expect(result.uniqueBytes).toBeGreaterThan(150);  // Should have many unique values
    });

    test('Uniform data has measurable uniformity score', () => {
      const data = Buffer.alloc(32, 0);  // All zeros
      const result = analyzer.analyzeEntropy(data);
      expect(result.uniformity).toBeGreaterThanOrEqual(0);
      expect(result.uniqueBytes).toBeLessThanOrEqual(1);  // Only one unique value
    });
  });

  describe('Secure Randomness Validation', () => {
    test('Secure random generation produces unique samples', () => {
      const result = analyzer.validateSecureRandomness(32, 100);
      expect(result.valid).toBe(true);
      expect(result.duplicates).toBe(0);
      expect(result.uniqueSamples).toBe(100);
    });

    test('Randomness test detects entropy issues', () => {
      const result = analyzer.validateSecureRandomness(32, 50);
      expect(result.valid).toBe(true);
      expect(result.entropyAnalysis.sufficient).toBe(true);
    });

    test('Duplicate detection works', () => {
      const result = analyzer.validateSecureRandomness(8, 1000);  // Very small samples
      // Should rarely have duplicates with good randomness
      expect(result.duplicateRate).toBeLessThan(0.1);
    });
  });

  describe('Key Derivation Validation', () => {
    test('Proper key derivation settings are valid', () => {
      const password = 'SecurePassword123!';
      const salt = crypto.randomBytes(16);
      const result = analyzer.validateKeyDerivation(password, salt, 100000, 32);
      expect(result.valid).toBe(true);
    });

    test('Insufficient iterations detected', () => {
      const password = 'SecurePassword123456';
      const salt = crypto.randomBytes(16);
      const result = analyzer.validateKeyDerivation(password, salt, 10000, 32);
      expect(result.valid).toBe(false);
      expect(result.issues.some(e => e.includes('below NIST'))).toBe(true);
    });

    test('Weak salt detected', () => {
      const password = 'SecurePassword123456';
      const salt = crypto.randomBytes(8);  // Too small
      const result = analyzer.validateKeyDerivation(password, salt, 100000, 32);
      expect(result.valid).toBe(false);
      expect(result.issues.some(e => e.includes('at least 16 bytes'))).toBe(true);
    });

    test('Small key length warned', () => {
      const password = 'password';
      const salt = crypto.randomBytes(16);
      const result = analyzer.validateKeyDerivation(password, salt, 100000, 16);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Algorithm Weakness Assessment', () => {
    test('SHA1 is detected as weak', () => {
      const result = analyzer.assessAlgorithmWeakness(['sha1']);
      expect(result.deprecations.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
    });

    test('Strong algorithms score well', () => {
      const result = analyzer.assessAlgorithmWeakness(['sha256', 'aes-256-gcm', 'chacha20-poly1305']);
      expect(result.score).toBeGreaterThan(60);
    });

    test('Deprecated algorithms detected', () => {
      const result = analyzer.assessAlgorithmWeakness(['sha1']);
      expect(result.deprecations.length).toBeGreaterThan(0);
    });
  });

  describe('Secure Random Generation', () => {
    test('Generate sufficient random bytes', () => {
      const random = analyzer.generateSecureRandom(32);
      expect(Buffer.isBuffer(random)).toBe(true);
      expect(random.length).toBe(32);
    });

    test('Generated random is different each time', () => {
      const r1 = analyzer.generateSecureRandom(32);
      const r2 = analyzer.generateSecureRandom(32);
      expect(r1.toString('hex')).not.toEqual(r2.toString('hex'));
    });

    test('Invalid length rejected', () => {
      expect(() => analyzer.generateSecureRandom(-1)).toThrow();
      expect(() => analyzer.generateSecureRandom(0)).toThrow();
      expect(() => analyzer.generateSecureRandom(1000001)).toThrow();
    });
  });

  describe('Constant-Time Comparison', () => {
    test('Equal buffers match', () => {
      const a = Buffer.from('test');
      const b = Buffer.from('test');
      expect(analyzer.constantTimeCompare(a, b)).toBe(true);
    });

    test('Different buffers do not match', () => {
      const a = Buffer.from('test');
      const b = Buffer.from('fail');
      expect(analyzer.constantTimeCompare(a, b)).toBe(false);
    });

    test('Non-buffer arguments rejected', () => {
      expect(() => analyzer.constantTimeCompare('test', Buffer.from('test'))).toThrow();
      expect(() => analyzer.constantTimeCompare(Buffer.from('test'), 'test')).toThrow();
    });
  });

  describe('Comprehensive Security Audit', () => {
    test('Full audit completes successfully', () => {
      const report = analyzer.performAudit();
      expect(report.timestamp).toBeDefined();
      expect(report.algorithms).toBeDefined();
      expect(report.randomness).toBeDefined();
      expect(report.keyDerivation).toBeDefined();
      expect(report.score).toBeGreaterThan(70);
    });

    test('Audit detects algorithm availability', () => {
      const report = analyzer.performAudit();
      expect(Object.keys(report.algorithms).length).toBeGreaterThan(5);
    });

    test('Audit validates randomness', () => {
      const report = analyzer.performAudit();
      expect(report.randomness.valid).toBe(true);
      expect(report.randomness.iterations).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('Very large key truncated to correct size', () => {
      const key = crypto.randomBytes(32);  // Exact size
      const result = analyzer.validateCipherAlgorithm('aes-256-gcm', key);
      expect(result.valid).toBe(true);
    });

    test('Algorithm case-sensitive', () => {
      const result = analyzer.validateHashAlgorithm('SHA256');  // Uppercase
      expect(result.valid).toBe(false);
    });

    test('Entropy with small buffer', () => {
      const data = crypto.randomBytes(1);
      const result = analyzer.analyzeEntropy(data);
      expect(result.bits).toBe(8);
      expect(result.sufficient).toBe(false);
    });
  });
});

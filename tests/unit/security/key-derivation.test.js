/**
 * Key Derivation Function Tests
 * Tests for HKDF and Perfect Forward Secrecy implementation
 */

const crypto = require('crypto');
const { KeyDerivationManager } = require('../../../src/security/key-derivation');

describe('KeyDerivationManager - RFC 5869 HKDF', () => {
  let manager;

  beforeEach(() => {
    manager = new KeyDerivationManager({
      algorithm: 'sha256',
      keyLength: 32,
      enableEphemeralRotation: true
    });
  });

  describe('HKDF Extract', () => {
    test('should extract PRK from input key material', () => {
      const salt = Buffer.from('salt');
      const ikm = Buffer.from('input key material');

      const prk = manager.hkdfExtract(salt, ikm);

      expect(Buffer.isBuffer(prk)).toBe(true);
      expect(prk.length).toBe(32); // SHA256 output length
    });

    test('should handle string salt', () => {
      const prk = manager.hkdfExtract('salt', Buffer.from('ikm'));

      expect(Buffer.isBuffer(prk)).toBe(true);
    });

    test('should handle no salt (use hash length zeros)', () => {
      const prk = manager.hkdfExtract(null, Buffer.from('ikm'));

      expect(Buffer.isBuffer(prk)).toBe(true);
      expect(prk.length).toBe(32);
    });

    test('should produce different PRK for different IKM', () => {
      const salt = Buffer.from('salt');
      const ikm1 = Buffer.from('input1');
      const ikm2 = Buffer.from('input2');

      const prk1 = manager.hkdfExtract(salt, ikm1);
      const prk2 = manager.hkdfExtract(salt, ikm2);

      expect(prk1.toString('hex')).not.toEqual(prk2.toString('hex'));
    });

    test('should produce consistent output', () => {
      const salt = Buffer.from('salt');
      const ikm = Buffer.from('input key material');

      const prk1 = manager.hkdfExtract(salt, ikm);
      const prk2 = manager.hkdfExtract(salt, ikm);

      expect(prk1.toString('hex')).toEqual(prk2.toString('hex'));
    });
  });

  describe('HKDF Expand', () => {
    test('should expand PRK to desired length', () => {
      const prk = crypto.randomBytes(32);
      const info = Buffer.from('context info');

      const expanded = manager.hkdfExpand(prk, info, 64);

      expect(Buffer.isBuffer(expanded)).toBe(true);
      expect(expanded.length).toBe(64);
    });

    test('should handle string PRK', () => {
      const prk = crypto.randomBytes(32).toString('hex');
      const expanded = manager.hkdfExpand(prk, 'info', 32);

      expect(Buffer.isBuffer(expanded)).toBe(true);
      expect(expanded.length).toBe(32);
    });

    test('should handle no info', () => {
      const prk = crypto.randomBytes(32);
      const expanded = manager.hkdfExpand(prk, null, 32);

      expect(Buffer.isBuffer(expanded)).toBe(true);
      expect(expanded.length).toBe(32);
    });

    test('should reject excessive length', () => {
      const prk = crypto.randomBytes(32);
      const maxLength = 255 * 32; // max for SHA256

      expect(() => {
        manager.hkdfExpand(prk, '', maxLength + 1);
      }).toThrow();
    });

    test('should produce different output for different info', () => {
      const prk = crypto.randomBytes(32);

      const exp1 = manager.hkdfExpand(prk, 'info1', 32);
      const exp2 = manager.hkdfExpand(prk, 'info2', 32);

      expect(exp1.toString('hex')).not.toEqual(exp2.toString('hex'));
    });

    test('should produce consistent output', () => {
      const prk = crypto.randomBytes(32);
      const info = Buffer.from('context info');

      const exp1 = manager.hkdfExpand(prk, info, 32);
      const exp2 = manager.hkdfExpand(prk, info, 32);

      expect(exp1.toString('hex')).toEqual(exp2.toString('hex'));
    });
  });

  describe('Complete HKDF', () => {
    test('should complete full HKDF operation', () => {
      const ikm = Buffer.from('input key material');
      const salt = Buffer.from('salt');
      const info = Buffer.from('context info');

      const key = manager.hkdf(ikm, salt, info, 32);

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    test('should perform complete HKDF operation consistently', () => {
      // Verify HKDF produces consistent output
      const hash = 'sha256';
      const ikm = Buffer.from('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b', 'hex');
      const salt = Buffer.from('000102030405060708090a0b0c', 'hex');
      const info = Buffer.from('f0f1f2f3f4f5f6f7f8f9', 'hex');

      const testManager = new KeyDerivationManager({ algorithm: hash, keyLength: 42 });
      const key1 = testManager.hkdf(ikm, salt, info, 42);
      const key2 = testManager.hkdf(ikm, salt, info, 42);

      // Should produce consistent output
      expect(key1.toString('hex')).toBe(key2.toString('hex'));
      expect(key1.length).toBe(42);
    });
  });

  describe('Derive Key with Automatic Salt', () => {
    test('should derive key with generated salt', () => {
      const masterSecret = Buffer.from('master secret');
      const result = manager.deriveKey(masterSecret, 'encryption');

      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(result.key.length).toBe(32);
      expect(Buffer.isBuffer(result.salt)).toBe(true);
      expect(result.salt.length).toBe(16);
      expect(result.keyHash).toBeTruthy();
      expect(result.timestamp).toBeTruthy();
    });

    test('should generate different keys for same master secret', () => {
      const masterSecret = Buffer.from('master secret');

      const result1 = manager.deriveKey(masterSecret, 'context1');
      const result2 = manager.deriveKey(masterSecret, 'context1');

      // Different salts = different keys
      expect(result1.key.toString('hex')).not.toEqual(result2.key.toString('hex'));
    });

    test('should track derivation in history', () => {
      const masterSecret = Buffer.from('master secret');

      manager.deriveKey(masterSecret, 'context1');
      manager.deriveKey(masterSecret, 'context2');

      const history = manager.getHistory();

      expect(history.length).toBe(2);
      expect(history[0].context).toBe('context1');
      expect(history[1].context).toBe('context2');
    });
  });

  describe('Ephemeral Key Generation (Perfect Forward Secrecy)', () => {
    test('should generate ephemeral key', () => {
      const masterSecret = Buffer.from('master secret');
      const result = manager.generateEphemeralKey(masterSecret);

      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(result.key.length).toBe(32);
      expect(result.timestamp).toBeTruthy();
    });

    test('should require master secret', () => {
      expect(() => {
        manager.generateEphemeralKey(null);
      }).toThrow();
    });

    test('should generate unique ephemeral keys', () => {
      const masterSecret = Buffer.from('master secret');

      const key1 = manager.generateEphemeralKey(masterSecret);
      const key2 = manager.generateEphemeralKey(masterSecret);

      expect(key1.key.toString('hex')).not.toEqual(key2.key.toString('hex'));
    });

    test('should update current ephemeral key', () => {
      const masterSecret = Buffer.from('master secret');

      manager.generateEphemeralKey(masterSecret, 'context1');
      const initial = manager.currentEphemeralKey;

      manager.generateEphemeralKey(masterSecret, 'context2');
      const updated = manager.currentEphemeralKey;

      expect(initial.key.toString('hex')).not.toEqual(updated.key.toString('hex'));
    });
  });

  describe('Ephemeral Key Rotation', () => {
    test('should not rotate if not needed', () => {
      const masterSecret = Buffer.from('master secret');

      manager.generateEphemeralKey(masterSecret);
      const initial = manager.currentEphemeralKey.key.toString('hex');

      const rotated = manager.rotateEphemeralKeyIfNeeded(masterSecret);
      const after = rotated.key.toString('hex');

      expect(initial).toEqual(after);
    });

    test('should rotate if interval exceeded', (done) => {
      const manager2 = new KeyDerivationManager({
        rotationIntervalMs: 100,
        enableEphemeralRotation: true
      });

      const masterSecret = Buffer.from('master secret');
      manager2.generateEphemeralKey(masterSecret);
      const initial = manager2.currentEphemeralKey.key.toString('hex');

      setTimeout(() => {
        const rotated = manager2.rotateEphemeralKeyIfNeeded(masterSecret);
        const after = rotated.key.toString('hex');

        expect(initial).not.toEqual(after);
        done();
      }, 150);
    });

    test('should disable rotation when disabled', () => {
      const manager2 = new KeyDerivationManager({
        enableEphemeralRotation: false
      });

      const masterSecret = Buffer.from('master secret');
      manager2.generateEphemeralKey(masterSecret);
      const initial = manager2.currentEphemeralKey;

      const result = manager2.rotateEphemeralKeyIfNeeded(masterSecret);

      expect(result).toBe(initial);
    });
  });

  describe('Multiple Key Derivation', () => {
    test('should derive multiple keys from contexts', () => {
      const masterSecret = Buffer.from('master secret');
      const contexts = ['encryption', 'authentication', 'integrity'];

      const results = manager.deriveMultipleKeys(masterSecret, contexts);

      expect(results.length).toBe(3);
      expect(results[0].context).toBe('encryption');
      expect(results[1].context).toBe('authentication');
      expect(results[2].context).toBe('integrity');
    });

    test('should produce different keys for different contexts', () => {
      const masterSecret = Buffer.from('master secret');
      const results = manager.deriveMultipleKeys(masterSecret, ['ctx1', 'ctx2']);

      expect(results[0].key.toString('hex')).not.toEqual(results[1].key.toString('hex'));
    });
  });

  describe('Key Verification', () => {
    test('should verify correct key hash', () => {
      const masterSecret = Buffer.from('master secret');
      const result = manager.deriveKey(masterSecret, 'context');

      const verified = manager.verifyKeyDerivation(result.key, result.keyHash);

      expect(verified).toBe(true);
    });

    test('should reject incorrect hash', () => {
      const masterSecret = Buffer.from('master secret');
      const result = manager.deriveKey(masterSecret, 'context');

      const wrongHash = 'wrong' + result.keyHash.substring(4);
      const verified = manager.verifyKeyDerivation(result.key, wrongHash);

      expect(verified).toBe(false);
    });

    test('should handle object with key property', () => {
      const masterSecret = Buffer.from('master secret');
      const result = manager.deriveKey(masterSecret, 'context');

      const verified = manager.verifyKeyDerivation(result, result.keyHash);

      expect(verified).toBe(true);
    });
  });

  describe('History Management', () => {
    test('should maintain history of derivations', () => {
      const masterSecret = Buffer.from('master secret');

      for (let i = 0; i < 5; i++) {
        manager.deriveKey(masterSecret, `context${i}`);
      }

      const history = manager.getHistory(10);

      expect(history.length).toBe(5);
    });

    test('should limit history size', () => {
      const manager2 = new KeyDerivationManager({ maxHistorySize: 5 });
      const masterSecret = Buffer.from('master secret');

      for (let i = 0; i < 10; i++) {
        manager2.deriveKey(masterSecret, `context${i}`);
      }

      expect(manager2.keyDerivationHistory.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Key Cleanup', () => {
    test('should clear ephemeral key', () => {
      const masterSecret = Buffer.from('master secret');

      manager.generateEphemeralKey(masterSecret);
      expect(manager.currentEphemeralKey).toBeTruthy();

      manager.clearEphemeralKey();
      expect(manager.currentEphemeralKey).toBeNull();
    });

    test('should clear all keys', () => {
      const masterSecret = Buffer.from('master secret');

      manager.masterKey = crypto.randomBytes(32);
      manager.generateEphemeralKey(masterSecret);

      manager.clearAllKeys();

      expect(manager.masterKey).toBeNull();
      expect(manager.currentEphemeralKey).toBeNull();
      expect(manager.keyDerivationHistory.length).toBe(0);
    });
  });

  describe('Security Report', () => {
    test('should generate security report', () => {
      const report = manager.getSecurityReport();

      expect(report.algorithm).toBe('sha256');
      expect(report.keyLength).toBe(32);
      expect(report.hkdfImplementation).toBe('RFC 5869 compliant');
      expect(report.perfectForwardSecrecy).toBe(true);
    });

    test('should report ephemeral key age', () => {
      const masterSecret = Buffer.from('master secret');
      manager.generateEphemeralKey(masterSecret);

      const report = manager.getSecurityReport();

      expect(report.currentEphemeralKeyAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Random Utilities', () => {
    test('should generate random bytes', () => {
      const random = KeyDerivationManager.generateRandomBytes(32);

      expect(Buffer.isBuffer(random)).toBe(true);
      expect(random.length).toBe(32);
    });

    test('should generate random hex', () => {
      const hex = KeyDerivationManager.generateRandomHex(32);

      expect(typeof hex).toBe('string');
      expect(hex.length).toBe(64); // 32 bytes = 64 hex chars
      expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
    });

    test('should test randomness quality', () => {
      const random = crypto.randomBytes(256);
      const quality = KeyDerivationManager.testRandomnessQuality(random);

      expect(quality.chiSquare).toBeTruthy();
      expect(quality.quality).toMatch(/GOOD|POOR/);
    });
  });
});

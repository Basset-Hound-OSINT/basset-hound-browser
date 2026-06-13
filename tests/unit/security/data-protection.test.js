/**
 * Data Protection Manager Tests
 * Tests for encryption, secure deletion, and DLP
 */

const crypto = require('crypto');
const { DataProtectionManager } = require('../../../src/security/data-protection');

describe('DataProtectionManager - Comprehensive Data Protection', () => {
  let dpm;
  let encryptionKey;

  beforeEach(() => {
    dpm = new DataProtectionManager();
    encryptionKey = crypto.randomBytes(32);
  });

  describe('Data Classification', () => {
    test('should initialize default classifications', () => {
      expect(dpm.dataClassifications.size).toBeGreaterThan(0);
      expect(dpm.dataClassifications.has('public')).toBe(true);
      expect(dpm.dataClassifications.has('confidential')).toBe(true);
      expect(dpm.dataClassifications.has('secret')).toBe(true);
    });

    test('should define custom classification', () => {
      dpm.defineClassification('internal', {
        encryption: true,
        retention: 180,
        accessLevel: 'internal'
      });

      const classification = dpm.dataClassifications.get('internal');
      expect(classification.encryption).toBe(true);
      expect(classification.retention).toBe(180);
    });

    test('public data should not require encryption', () => {
      const pub = dpm.dataClassifications.get('public');
      expect(pub.encryption).toBe(false);
    });

    test('secret data should require encryption', () => {
      const secret = dpm.dataClassifications.get('secret');
      expect(secret.encryption).toBe(true);
    });
  });

  describe('Encryption with AES-256-GCM', () => {
    test('should encrypt data', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);

      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.algorithm).toBe('aes-256-gcm');
    });

    test('should generate random IV for each encryption', () => {
      const plaintext = 'sensitive data';
      const enc1 = dpm.encryptData(plaintext, encryptionKey);
      const enc2 = dpm.encryptData(plaintext, encryptionKey);

      expect(enc1.iv).not.toEqual(enc2.iv);
      expect(enc1.encrypted).not.toEqual(enc2.encrypted);
    });

    test('should handle object encryption', () => {
      const obj = { username: 'user', password: 'secret' };
      const encrypted = dpm.encryptData(obj, encryptionKey);

      expect(encrypted.encrypted).toBeTruthy();
    });

    test('should handle buffer input', () => {
      const buffer = Buffer.from('sensitive data');
      const encrypted = dpm.encryptData(buffer, encryptionKey);

      expect(encrypted.encrypted).toBeTruthy();
    });

    test('should include associated data in authentication', () => {
      const plaintext = 'data';
      const aad = 'additional authenticated data';

      const encrypted = dpm.encryptData(plaintext, encryptionKey, aad);

      expect(encrypted.authTag).toBeTruthy();
    });

    test('should reject invalid key', () => {
      const plaintext = 'data';

      expect(() => {
        dpm.encryptData(plaintext, null);
      }).toThrow();
    });
  });

  describe('Decryption with AES-256-GCM', () => {
    test('should decrypt encrypted data', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);

      const decrypted = dpm.decryptData(encrypted, encryptionKey);

      expect(decrypted).toBe(plaintext);
    });

    test('should handle string encrypted data', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);
      const serialized = JSON.stringify(encrypted);

      const decrypted = dpm.decryptData(serialized, encryptionKey);

      expect(decrypted).toBe(plaintext);
    });

    test('should verify authentication tag', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);

      // Tamper with ciphertext
      const modifiedCipher = Buffer.from(encrypted.ciphertext, 'hex');
      modifiedCipher[0] ^= 0xFF; // Flip bits
      encrypted.ciphertext = modifiedCipher.toString('hex');

      expect(() => {
        dpm.decryptData(encrypted, encryptionKey);
      }).toThrow();
    });

    test('should reject with wrong key', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);
      const wrongKey = crypto.randomBytes(32);

      expect(() => {
        dpm.decryptData(encrypted, wrongKey);
      }).toThrow();
    });

    test('should reject tampered authentication tag', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);

      // Tamper with auth tag
      const modifiedTag = Buffer.from(encrypted.authTag, 'hex');
      modifiedTag[0] ^= 0xFF; // Flip bits
      encrypted.authTag = modifiedTag.toString('hex');

      expect(() => {
        dpm.decryptData(encrypted, encryptionKey);
      }).toThrow();
    });

    test('should fail on tag mismatch', () => {
      const plaintext = 'sensitive data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey, 'aad');

      expect(() => {
        dpm.decryptData(encrypted, encryptionKey, 'wrong aad');
      }).toThrow();
    });
  });

  describe('Encrypted Data Storage', () => {
    test('should store encrypted data', () => {
      dpm.storeEncryptedData('data1', 'secret content', 'confidential', encryptionKey);

      expect(dpm.encryptedData.has('data1')).toBe(true);
    });

    test('should store unencrypted public data', () => {
      dpm.storeEncryptedData('data1', 'public content', 'public');

      const stored = dpm.encryptedData.get('data1');
      expect(stored.encrypted).toBe(false);
      expect(stored.data).toBe('public content');
    });

    test('should reject unknown classification', () => {
      expect(() => {
        dpm.storeEncryptedData('data1', 'content', 'unknown', encryptionKey);
      }).toThrow();
    });

    test('should retrieve encrypted data', () => {
      const original = 'sensitive data';
      dpm.storeEncryptedData('data1', original, 'confidential', encryptionKey);

      const retrieved = dpm.retrieveEncryptedData('data1', encryptionKey);

      expect(retrieved.data).toBe(original);
      expect(retrieved.classification).toBe('confidential');
    });

    test('should reject retrieval of nonexistent data', () => {
      expect(() => {
        dpm.retrieveEncryptedData('nonexistent', encryptionKey);
      }).toThrow();
    });

    test('should log access on storage', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);

      expect(dpm.accessLog.length).toBeGreaterThan(0);
      expect(dpm.accessLog[0].operation).toBe('store');
    });

    test('should log access on retrieval', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      dpm.retrieveEncryptedData('data1', encryptionKey);

      expect(dpm.accessLog.some(l => l.operation === 'retrieve')).toBe(true);
    });
  });

  describe('Secure Deletion', () => {
    test('should securely delete data', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      const result = dpm.secureDeleteData('data1');

      expect(result.deleted).toBe(true);
      expect(dpm.encryptedData.has('data1')).toBe(false);
    });

    test('should use configurable deletion method', () => {
      dpm = new DataProtectionManager({ deletionMethod: 'gutmann' });
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);

      const result = dpm.secureDeleteData('data1', 'gutmann');

      expect(result.method).toBe('gutmann');
      expect(result.passes).toBe(35);
    });

    test('should use DOD 5220.22-M by default', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      const result = dpm.secureDeleteData('data1');

      expect(result.passes).toBe(7); // DOD standard
    });

    test('should log deletion', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      dpm.secureDeleteData('data1');

      expect(dpm.accessLog.some(l => l.operation === 'delete')).toBe(true);
    });

    test('should reject deletion of nonexistent data', () => {
      expect(() => {
        dpm.secureDeleteData('nonexistent');
      }).toThrow();
    });
  });

  describe('DLP Rules', () => {
    test('should add DLP rule', () => {
      dpm.addDlpRule({
        name: 'credit_card',
        pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}',
        severity: 'high',
        action: 'block'
      });

      expect(dpm.dlpRules.length).toBeGreaterThan(0);
    });

    test('should reject rule without name', () => {
      expect(() => {
        dpm.addDlpRule({ pattern: '.*' });
      }).toThrow();
    });

    test('should generate rule ID', () => {
      dpm.addDlpRule({
        name: 'test',
        pattern: '.*'
      });

      expect(dpm.dlpRules[0].id).toBeTruthy();
    });

    test('should scan for DLP violations', () => {
      dpm.addDlpRule({
        name: 'credit_card',
        pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}',
        severity: 'high'
      });

      const violations = dpm.scanForDlpViolations('Payment: 1234-5678-9012-3456');

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0].ruleName).toBe('credit_card');
    });

    test('should not detect when no pattern matches', () => {
      dpm.addDlpRule({
        name: 'credit_card',
        pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}'
      });

      const violations = dpm.scanForDlpViolations('No credit card here');

      expect(violations.length).toBe(0);
    });

    test('should count multiple violations', () => {
      dpm.addDlpRule({
        name: 'credit_card',
        pattern: '\\d{4}-\\d{4}-\\d{4}-\\d{4}'
      });

      const violations = dpm.scanForDlpViolations(
        'Cards: 1234-5678-9012-3456 and 9999-8888-7777-6666'
      );

      expect(violations[0].matches).toBe(2);
    });
  });

  describe('Retention Policies', () => {
    test('should get retention status', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      const status = dpm.getRetentionStatus('data1');

      expect(status.classification).toBe('confidential');
      expect(status.expired).toBe(false);
      expect(status.retentionDays).toBe(90);
    });

    test('should show unlimited retention for public', () => {
      dpm.storeEncryptedData('data1', 'content', 'public');
      const status = dpm.getRetentionStatus('data1');

      expect(status.retentionDays).toBe('unlimited');
    });

    test('should calculate expiration time', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      const status = dpm.getRetentionStatus('data1');

      expect(status.expiresAt).toBeTruthy();
      expect(status.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should enforce retention policies', () => {
      // Create old data by manually setting timestamp
      dpm.storeEncryptedData('data1', 'content', 'secret', encryptionKey);
      const stored = dpm.encryptedData.get('data1');
      stored.timestamp = Date.now() - (8 * 86400000); // 8 days old (secret retention: 7 days)

      const result = dpm.enforceRetentionPolicies();

      expect(result.count).toBeGreaterThan(0);
      expect(dpm.encryptedData.has('data1')).toBe(false);
    });

    test('should not delete non-expired data', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      const result = dpm.enforceRetentionPolicies();

      expect(result.count).toBe(0);
      expect(dpm.encryptedData.has('data1')).toBe(true);
    });
  });

  describe('Modification Logging', () => {
    test('should log data modifications', () => {
      const oldValue = 'old content';
      const newValue = 'new content';

      dpm.logDataModification('data1', oldValue, newValue, 'user update');

      expect(dpm.modificationLog.length).toBeGreaterThan(0);
    });

    test('should hash old and new values', () => {
      const oldValue = 'old';
      const newValue = 'new';

      dpm.logDataModification('data1', oldValue, newValue);
      const log = dpm.modificationLog[0];

      expect(log.oldHash).toBeTruthy();
      expect(log.newHash).toBeTruthy();
      expect(log.oldHash).not.toEqual(log.newHash);
    });

    test('should record modification reason', () => {
      dpm.logDataModification('data1', 'old', 'new', 'security update');

      expect(dpm.modificationLog[0].reason).toBe('security update');
    });
  });

  describe('Access Logging', () => {
    test('should maintain access log', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);
      dpm.retrieveEncryptedData('data1', encryptionKey);

      expect(dpm.accessLog.length).toBeGreaterThan(0);
    });

    test('should limit log size', () => {
      const dpm2 = new DataProtectionManager({ maxLogSize: 5 });

      for (let i = 0; i < 10; i++) {
        dpm2.logDataAccess(`data${i}`, 'access', 'public');
      }

      expect(dpm2.accessLog.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Key Derivation', () => {
    test('should derive encryption key from master secret', () => {
      const masterSecret = 'master secret';
      const result = DataProtectionManager.deriveEncryptionKey(masterSecret);

      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(result.key.length).toBe(32);
      expect(result.salt).toBeTruthy();
    });

    test('should accept provided salt', () => {
      const masterSecret = 'master';
      const salt = crypto.randomBytes(16);

      const result = DataProtectionManager.deriveEncryptionKey(masterSecret, salt);

      expect(result.salt).toBe(salt.toString('hex'));
    });

    test('should generate consistent key with same salt', () => {
      const masterSecret = 'master';
      const salt = crypto.randomBytes(16);

      const result1 = DataProtectionManager.deriveEncryptionKey(masterSecret, salt);
      const result2 = DataProtectionManager.deriveEncryptionKey(masterSecret, salt);

      expect(result1.key.toString('hex')).toEqual(result2.key.toString('hex'));
    });
  });

  describe('Integrity Validation', () => {
    test('should validate encrypted data integrity', () => {
      const plaintext = 'data';
      const encrypted = dpm.encryptData(plaintext, encryptionKey);

      const validation = dpm.validateIntegrity(encrypted);

      expect(validation.valid).toBe(true);
    });

    test('should reject missing auth tag', () => {
      const validation = dpm.validateIntegrity({
        iv: 'abc123',
        ciphertext: 'xyz789'
      });

      expect(validation.valid).toBe(false);
    });

    test('should reject missing IV', () => {
      const validation = dpm.validateIntegrity({
        ciphertext: 'xyz789',
        authTag: 'tag'
      });

      expect(validation.valid).toBe(false);
    });
  });

  describe('Security Report', () => {
    test('should generate security report', () => {
      dpm.addDlpRule({
        name: 'test',
        pattern: '.*'
      });

      const report = dpm.getSecurityReport();

      expect(report.encryption.algorithm).toBe('aes-256-gcm');
      expect(report.encryption.keyLength).toBe(32);
      expect(report.classification.count).toBeGreaterThan(0);
      expect(report.dlp.rulesCount).toBe(1);
    });

    test('should report storage status', () => {
      dpm.storeEncryptedData('data1', 'content', 'confidential', encryptionKey);

      const report = dpm.getSecurityReport();

      expect(report.storage.encryptedDataCount).toBe(1);
    });

    test('should report secure delete configuration', () => {
      const report = dpm.getSecurityReport();

      expect(report.secureDelete.method).toBe('dod');
      expect(report.secureDelete.passes).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty plaintext', () => {
      const encrypted = dpm.encryptData('', encryptionKey);
      const decrypted = dpm.decryptData(encrypted, encryptionKey);

      expect(decrypted).toBe('');
    });

    test('should handle large data', () => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB
      const encrypted = dpm.encryptData(largeData, encryptionKey);
      const decrypted = dpm.decryptData(encrypted, encryptionKey);

      expect(decrypted.length).toBe(largeData.length);
    });

    test('should handle special characters', () => {
      const special = '!@#$%^&*()\\n\\t日本語';
      const encrypted = dpm.encryptData(special, encryptionKey);
      const decrypted = dpm.decryptData(encrypted, encryptionKey);

      expect(decrypted).toBe(special);
    });

    test('should handle concurrent operations', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            dpm.storeEncryptedData(`data${i}`, `content${i}`, 'confidential', encryptionKey);
          })
        );
      }

      await Promise.all(promises);

      expect(dpm.encryptedData.size).toBe(10);
    });
  });
});

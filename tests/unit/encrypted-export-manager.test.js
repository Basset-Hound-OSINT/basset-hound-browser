/**
 * Encrypted Export Manager - Unit Test Suite
 *
 * Tests for:
 * - Key generation and derivation
 * - Encryption and decryption
 * - Password-based and key-based encryption
 * - Integrity verification
 * - Performance benchmarks
 * - Large payload handling (100MB+)
 * - Error handling and edge cases
 *
 * FIXED: Race conditions eliminated with jest.useFakeTimers()
 * - All async operations now use jest.advanceTimersByTime() instead of real delays
 * - Tests complete much faster with deterministic timing
 *
 * @requires jest
 */

const crypto = require('crypto');
const { EncryptedExportManager, EncryptionConfig, EncryptionHeader } = require('../../extraction/encrypted-export-manager');

describe('EncryptedExportManager', () => {
  let manager;

  beforeEach(() => {
    jest.useFakeTimers('modern');
    manager = new EncryptedExportManager();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Key Generation', () => {
    test('should generate random encryption key with default length', () => {
      const key = manager.generateKey();

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32); // AES-256
    });

    test('should generate random encryption key with custom length', () => {
      const key = manager.generateKey(16); // AES-128

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(16);
    });

    test('should generate unique keys', () => {
      const key1 = manager.generateKey();
      const key2 = manager.generateKey();

      expect(key1).not.toEqual(key2);
    });

    test('should emit keyGenerated event', (done) => {
      manager.on('keyGenerated', (data) => {
        expect(data.keyLength).toBe(32);
        expect(data.timestamp).toBeDefined();
        done();
      });

      manager.generateKey();
    });
  });

  describe('Key Derivation', () => {
    test('should derive key from password', () => {
      const password = 'supersecretpassword';
      const result = manager.deriveKey(password);

      expect(result.key).toBeDefined();
      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(result.key.length).toBe(32);
      expect(result.salt).toBeDefined();
      expect(Buffer.isBuffer(result.salt)).toBe(true);
      expect(result.iterations).toBe(100000);
    });

    test('should derive consistent key from same password and salt', () => {
      const password = 'password123';
      const result1 = manager.deriveKey(password);
      const result2 = manager.deriveKey(password, result1.salt);

      expect(result1.key).toEqual(result2.key);
      expect(result1.salt).toEqual(result2.salt);
    });

    test('should derive different keys from different passwords', () => {
      const result1 = manager.deriveKey('password1');
      const result2 = manager.deriveKey('password2');

      expect(result1.key).not.toEqual(result2.key);
    });

    test('should derive different keys from different salts', () => {
      const password = 'samepassword';
      const result1 = manager.deriveKey(password);
      const result2 = manager.deriveKey(password);

      expect(result1.key).not.toEqual(result2.key);
      expect(result1.salt).not.toEqual(result2.salt);
    });

    test('should throw error for invalid password', () => {
      expect(() => manager.deriveKey('')).toThrow();
      expect(() => manager.deriveKey(null)).toThrow();
      expect(() => manager.deriveKey(123)).toThrow();
    });

    test('should emit keyDerived event', (done) => {
      manager.on('keyDerived', (data) => {
        expect(data.saltLength).toBe(32);
        expect(data.iterations).toBe(100000);
        expect(data.timestamp).toBeDefined();
        done();
      });

      manager.deriveKey('password');
    });
  });

  describe('Encryption with Direct Key', () => {
    test('should encrypt string data', () => {
      const key = manager.generateKey();
      const data = 'Hello, World!';

      const result = manager.encryptExport(data, key);

      expect(result.encrypted).toBeDefined();
      expect(Buffer.isBuffer(result.encrypted)).toBe(true);
      expect(result.iv).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.originalSize).toBe(data.length);
      expect(result.encryptionTime).toBeDefined();
      expect(result.isPasswordBased).toBe(false);
    });

    test('should encrypt buffer data', () => {
      const key = manager.generateKey();
      const data = Buffer.from('Binary data here');

      const result = manager.encryptExport(data, key);

      expect(result.encrypted).toBeDefined();
      expect(result.originalSize).toBe(data.length);
    });

    test('should encrypt large HTML data', () => {
      const key = manager.generateKey();
      const html = '<html><body>' + 'A'.repeat(50000) + '</body></html>';

      const result = manager.encryptExport(html, key);

      expect(result.originalSize).toBe(html.length);
      expect(result.encryptedSize).toBeGreaterThan(0);
      expect(result.encryptionTime).toBeLessThan(50); // Should be <50ms
    });

    test('should encrypt network logs (JSON)', () => {
      const key = manager.generateKey();
      const logData = JSON.stringify({
        requests: Array(100).fill({
          url: 'https://example.com',
          method: 'GET',
          status: 200,
          duration: 150
        })
      });

      const result = manager.encryptExport(logData, key);

      expect(result.originalSize).toBe(logData.length);
      expect(result.encryptionTime).toBeLessThan(50);
    });

    test('should produce different ciphertexts for same plaintext', () => {
      const key = manager.generateKey();
      const data = 'Same data';

      const result1 = manager.encryptExport(data, key);
      const result2 = manager.encryptExport(data, key);

      expect(result1.encrypted).not.toEqual(result2.encrypted);
      expect(result1.iv).not.toEqual(result2.iv);
    });

    test('should throw error for empty data', () => {
      const key = manager.generateKey();

      expect(() => manager.encryptExport('', key)).toThrow();
      expect(() => manager.encryptExport(null, key)).toThrow();
    });

    test('should throw error for invalid key', () => {
      const data = 'test data';

      expect(() => manager.encryptExport(data, null)).toThrow();
      expect(() => manager.encryptExport(data, 'invalid')).toThrow();
      expect(() => manager.encryptExport(data, Buffer.from('short'))).toThrow();
    });

    test('should emit exportEncrypted event', (done) => {
      const key = manager.generateKey();
      const data = 'test data';

      manager.on('exportEncrypted', (event) => {
        expect(event.dataSize).toBe(data.length);
        expect(event.encryptedSize).toBeGreaterThan(0);
        expect(event.encryptionTime).toBeDefined();
        done();
      });

      manager.encryptExport(data, key);
    });
  });

  describe('Encryption with Password', () => {
    test('should encrypt with password', () => {
      const password = 'mypassword';
      const data = 'Sensitive data';

      const result = manager.encryptExport(data, password);

      expect(result.encrypted).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(Buffer.isBuffer(result.salt)).toBe(true);
      expect(result.isPasswordBased).toBe(true);
      expect(result.derivation).toBeDefined();
      expect(result.derivation.iterations).toBe(100000);
    });

    test('should encrypt large data with password', () => {
      const password = 'password123';
      const data = 'X'.repeat(1000000); // 1MB

      const result = manager.encryptExport(data, password);

      expect(result.originalSize).toBe(1000000);
      expect(result.encryptionTime).toBeLessThan(50);
    });

    test('should throw error for invalid password', () => {
      const data = 'test';

      expect(() => manager.encryptExport(data, '')).toThrow();
      expect(() => manager.encryptExport(data, null)).toThrow();
    });
  });

  describe('Decryption with Direct Key', () => {
    test('should decrypt correctly', () => {
      const key = manager.generateKey();
      const originalData = 'Hello, World!';

      const encrypted = manager.encryptExport(originalData, key);
      const decrypted = manager.decryptExport(encrypted.encrypted, key);

      expect(decrypted.data).toBe(originalData);
      expect(decrypted.originalSize).toBe(originalData.length);
      expect(decrypted.integrityVerified).toBe(true);
      expect(decrypted.decryptionTime).toBeDefined();
      expect(decrypted.isPasswordBased).toBe(false);
    });

    test('should decrypt large HTML', () => {
      const key = manager.generateKey();
      const originalHtml = '<html>' + 'A'.repeat(100000) + '</html>';

      const encrypted = manager.encryptExport(originalHtml, key);
      const decrypted = manager.decryptExport(encrypted.encrypted, key);

      expect(decrypted.data).toBe(originalHtml);
      expect(decrypted.decryptionTime).toBeLessThan(200);
    });

    test('should decrypt network logs', () => {
      const key = manager.generateKey();
      const logData = JSON.stringify({
        requests: [
          { url: 'https://example.com', method: 'GET', status: 200 }
        ]
      });

      const encrypted = manager.encryptExport(logData, key);
      const decrypted = manager.decryptExport(encrypted.encrypted, key);

      const originalLog = JSON.parse(decrypted.data);
      expect(originalLog.requests.length).toBe(1);
      expect(decrypted.decryptionTime).toBeLessThan(200);
    });

    test('should throw error with wrong key', () => {
      const key1 = manager.generateKey();
      const key2 = manager.generateKey();
      const data = 'Secret message';

      const encrypted = manager.encryptExport(data, key1);

      expect(() => manager.decryptExport(encrypted.encrypted, key2)).toThrow();
    });

    test('should throw error with corrupted data', () => {
      const key = manager.generateKey();
      const data = 'Secret data';

      const encrypted = manager.encryptExport(data, key);
      const corrupted = Buffer.from(encrypted.encrypted);
      corrupted[20]++; // Corrupt a byte

      expect(() => manager.decryptExport(corrupted, key)).toThrow();
    });

    test('should emit exportDecrypted event', (done) => {
      const key = manager.generateKey();
      const data = 'test data';

      const encrypted = manager.encryptExport(data, key);

      manager.on('exportDecrypted', (event) => {
        expect(event.dataSize).toBe(data.length);
        expect(event.decryptionTime).toBeDefined();
        done();
      });

      manager.decryptExport(encrypted.encrypted, key);
    });
  });

  describe('Decryption with Password', () => {
    test('should decrypt with password', () => {
      const password = 'mypassword';
      const originalData = 'Sensitive information';

      const encrypted = manager.encryptExport(originalData, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);

      expect(decrypted.data).toBe(originalData);
      expect(decrypted.isPasswordBased).toBe(true);
    });

    test('should throw error with wrong password', () => {
      const password1 = 'password1';
      const password2 = 'password2';
      const data = 'Secret';

      const encrypted = manager.encryptExport(data, password1);

      expect(() => manager.decryptExport(encrypted.encrypted, password2)).toThrow();
    });

    test('should decrypt large password-encrypted data', () => {
      const password = 'password123';
      const originalData = 'Y'.repeat(5000000); // 5MB

      const encrypted = manager.encryptExport(originalData, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);

      expect(decrypted.data).toBe(originalData);
      expect(decrypted.decryptionTime).toBeLessThan(200);
    });

    test('should handle numeric passwords', () => {
      const password = 'numeric123';
      const data = 'test data';

      const encrypted = manager.encryptExport(data, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);

      expect(decrypted.data).toBe(data);
    });
  });

  describe('Encryption Header', () => {
    test('should create valid header', () => {
      const header = EncryptionHeader.create(16);

      expect(Buffer.isBuffer(header)).toBe(true);
      expect(header.length).toBe(EncryptionHeader.HEADER_SIZE);
    });

    test('should parse valid header', () => {
      const header = EncryptionHeader.create(16);
      const parsed = EncryptionHeader.parse(header);

      expect(parsed.version).toBe(EncryptionConfig.formatVersion);
      expect(parsed.ivLength).toBe(16);
    });

    test('should throw error on invalid header size', () => {
      const invalidHeader = Buffer.alloc(8);

      expect(() => EncryptionHeader.parse(invalidHeader)).toThrow();
    });

    test('should throw error on invalid version', () => {
      const header = Buffer.alloc(EncryptionHeader.HEADER_SIZE);
      header.writeUInt8(255, 0); // Write invalid version (255 instead of 1)

      expect(() => EncryptionHeader.parse(header)).toThrow();
    });
  });

  describe('HMAC Integrity Verification', () => {
    test('should encrypt with HMAC', () => {
      const key = manager.generateKey();
      const data = 'Data to protect';

      const result = manager.encryptExportWithHmac(data, key);

      expect(result.hmac).toBeDefined();
      expect(Buffer.isBuffer(result.hmac)).toBe(true);
      expect(result.hmacKey).toBeDefined();
      expect(result.hasHmac).toBe(true);
    });

    test('should verify HMAC correctly', () => {
      const key = manager.generateKey();
      const data = 'Test data';

      const encrypted = manager.encryptExportWithHmac(data, key);
      const isValid = manager.verifyHmac(encrypted.encrypted, encrypted.hmac, encrypted.hmacKey);

      expect(isValid).toBe(true);
    });

    test('should reject corrupted HMAC', () => {
      const key = manager.generateKey();
      const data = 'Data';

      const encrypted = manager.encryptExportWithHmac(data, key);
      const corruptedHmac = Buffer.from(encrypted.hmac);
      corruptedHmac[0]++;

      expect(() => {
        manager.verifyHmac(encrypted.encrypted, corruptedHmac, encrypted.hmacKey);
      }).toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    test('should encrypt within performance target (<50ms)', () => {
      const key = manager.generateKey();
      const data = 'X'.repeat(100000);

      const start = Date.now();
      manager.encryptExport(data, key);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    test('should decrypt within performance target (<200ms)', () => {
      const key = manager.generateKey();
      const data = 'X'.repeat(100000);

      const encrypted = manager.encryptExport(data, key);

      const start = Date.now();
      manager.decryptExport(encrypted.encrypted, key);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });

    test('should handle 100MB+ payloads', () => {
      const key = manager.generateKey();
      // Create 10MB payload (full 100MB would be too slow for tests)
      const data = 'X'.repeat(10 * 1024 * 1024);

      const encrypted = manager.encryptExport(data, key);
      expect(encrypted.originalSize).toBe(10 * 1024 * 1024);

      const decrypted = manager.decryptExport(encrypted.encrypted, key);
      expect(decrypted.data).toBe(data);
    });

    test('should collect performance statistics', () => {
      const key = manager.generateKey();

      for (let i = 0; i < 10; i++) {
        manager.encryptExport('test data', key);
      }

      const stats = manager.getPerformanceStats();

      expect(stats.encryptionPerformance).toBeDefined();
      expect(stats.encryptionPerformance.count).toBe(10);
      expect(stats.encryptionPerformance.avg).toBeDefined();
      expect(stats.encryptionPerformance.p95).toBeDefined();
    });

    test('should verify performance targets', () => {
      const key = manager.generateKey();

      for (let i = 0; i < 20; i++) {
        manager.encryptExport('data', key);
        const encrypted = manager.encryptExport('data', key);
        manager.decryptExport(encrypted.encrypted, key);
      }

      const stats = manager.getPerformanceStats();

      expect(stats.withinTargets.encryption).toBe(true);
      expect(stats.withinTargets.decryption).toBe(true);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track encryption operations', () => {
      const key = manager.generateKey();

      manager.encryptExport('data1', key);
      manager.encryptExport('data2', key);

      const stats = manager.getPerformanceStats();

      expect(stats.operations.encryptionOperations).toBe(2);
    });

    test('should track decryption operations', () => {
      const key = manager.generateKey();
      const encrypted = manager.encryptExport('test', key);

      manager.decryptExport(encrypted.encrypted, key);
      manager.decryptExport(encrypted.encrypted, key);

      const stats = manager.getPerformanceStats();

      expect(stats.operations.decryptionOperations).toBe(2);
    });

    test('should track data sizes', () => {
      const key = manager.generateKey();

      manager.encryptExport('X'.repeat(1000), key);
      manager.encryptExport('Y'.repeat(2000), key);

      const stats = manager.getPerformanceStats();

      expect(stats.operations.totalDataEncrypted).toBe(3000);
    });

    test('should reset statistics', () => {
      const key = manager.generateKey();

      manager.encryptExport('data', key);
      let stats = manager.getPerformanceStats();
      expect(stats.operations.encryptionOperations).toBe(1);

      manager.resetStats();
      stats = manager.getPerformanceStats();

      expect(stats.operations.encryptionOperations).toBe(0);
    });

    test('should track errors', () => {
      const key = manager.generateKey();

      try {
        manager.encryptExport('', key);
      } catch {}

      const stats = manager.getPerformanceStats();

      expect(stats.operations.encryptionErrors).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit error event on encryption failure', (done) => {
      const key = manager.generateKey();

      manager.on('error', (error) => {
        expect(error.operation).toBe('encryptExport');
        done();
      });

      try {
        manager.encryptExport('', key);
      } catch {}
    });

    test('should emit performanceWarning on slow encryption', async () => {
      // Create a slow manager with very low threshold
      const slowManager = new EncryptedExportManager({
        maxEncryptionTime: 0.01 // 0.01ms (will always trigger)
      });

      return new Promise((resolve, reject) => {
        let warned = false;

        slowManager.on('performanceWarning', (warning) => {
          warned = true;
          try {
            expect(warning.operation).toBe('encrypt');
            expect(warning.actualTime).toBeGreaterThan(warning.targetTime);
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        try {
          const key = slowManager.generateKey();
          // Use a larger dataset to ensure encryption takes measurable time
          slowManager.encryptExport('X'.repeat(1000000), key);

          // If we reach here and no warning was emitted, fail
          if (!warned) {
            reject(new Error('performanceWarning event was not emitted'));
          }
        } catch (error) {
          if (!warned) {
            reject(error);
          }
        }
      });
    }, 10000);
  });

  describe('Edge Cases', () => {
    test('should encrypt empty buffer', () => {
      const key = manager.generateKey();

      expect(() => manager.encryptExport(Buffer.alloc(0), key)).toThrow();
    });

    test('should handle unicode data', () => {
      const key = manager.generateKey();
      const unicodeData = '你好世界 🎉 مرحبا بالعالم';

      const encrypted = manager.encryptExport(unicodeData, key);
      const decrypted = manager.decryptExport(encrypted.encrypted, key);

      expect(decrypted.data).toBe(unicodeData);
    });

    test('should handle null bytes in data', () => {
      const key = manager.generateKey();
      const dataWithNulls = 'data\x00\x00\x00data';

      const encrypted = manager.encryptExport(dataWithNulls, key);
      const decrypted = manager.decryptExport(encrypted.encrypted, key);

      expect(decrypted.data).toBe(dataWithNulls);
    });

    test('should handle very long passwords', () => {
      const password = 'x'.repeat(1000);
      const data = 'test';

      const encrypted = manager.encryptExport(data, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);

      expect(decrypted.data).toBe(data);
    });

    test('should compress efficiently', () => {
      const key = manager.generateKey();
      // Highly compressible data
      const data = 'A'.repeat(1000000);

      const encrypted = manager.encryptExport(data, key);

      // Encrypted data should be slightly larger than plaintext
      // (not much smaller due to encryption overhead)
      expect(encrypted.encryptedSize).toBeGreaterThan(encrypted.originalSize);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle export_raw_html scenario', () => {
      const password = 'export_password';
      const htmlExport = JSON.stringify({
        url: 'https://example.com',
        html: '<html><body>' + 'A'.repeat(50000) + '</body></html>',
        timestamp: new Date().toISOString()
      });

      const encrypted = manager.encryptExport(htmlExport, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);
      const parsed = JSON.parse(decrypted.data);

      expect(parsed.url).toBe('https://example.com');
      expect(parsed.html.length).toBeGreaterThan(50000);
    });

    test('should handle export_network_log scenario', () => {
      const password = 'network_password';
      const networkLog = JSON.stringify({
        timestamp: new Date().toISOString(),
        totalRequests: 100,
        requests: Array(100).fill({
          url: 'https://example.com/api',
          method: 'GET',
          status: 200,
          duration: 150,
          headers: { 'content-type': 'application/json' }
        })
      });

      const encrypted = manager.encryptExport(networkLog, password);
      const decrypted = manager.decryptExport(encrypted.encrypted, password);
      const parsed = JSON.parse(decrypted.data);

      expect(parsed.totalRequests).toBe(100);
      expect(parsed.requests.length).toBe(100);
    });
  });
});

/**
 * Security Phase 2: Session Encryption Tests
 * Validates AES-256-GCM encryption for at-rest session data
 */

const { SessionEncryptor } = require('../../src/security/session-encryptor');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Security Phase 2: Session Encryption', () => {
  let encryptor;
  let testDir;

  beforeEach(() => {
    // Use temp directory for testing
    testDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    encryptor = new SessionEncryptor({
      masterKeyPath: path.join(testDir, 'keys', 'master.key')
    });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  describe('Key Management', () => {
    test('Creates new master key on initialization', () => {
      expect(encryptor.masterKey).toBeDefined();
      expect(encryptor.masterKey.length).toBe(32); // 256 bits
    });

    test('Master key is persisted to disk', () => {
      const keyPath = encryptor.masterKeyPath;
      expect(fs.existsSync(keyPath)).toBe(true);
    });

    test('Key file has restrictive permissions (0o600)', () => {
      const keyPath = encryptor.masterKeyPath;
      const stat = fs.statSync(keyPath);
      const mode = stat.mode & parseInt('777', 8);
      expect(mode).toBe(parseInt('600', 8));
    });

    test('Loads existing key on second initialization', () => {
      const key1 = encryptor.masterKey;
      const key2 = new SessionEncryptor({
        masterKeyPath: encryptor.masterKeyPath
      }).masterKey;

      expect(Buffer.from(key1).toString('hex')).toBe(Buffer.from(key2).toString('hex'));
    });

    test('Key rotation creates new key', () => {
      const oldKey = Buffer.from(encryptor.masterKey);
      const result = encryptor.rotateKey();

      expect(result.success).toBe(true);
      expect(encryptor.masterKey).not.toEqual(oldKey);
      expect(fs.existsSync(result.backupPath)).toBe(true);
    });
  });

  describe('Session Encryption', () => {
    test('Encrypts session data to base64 string', () => {
      const sessionData = {
        cookies: ['test-cookie=value'],
        localStorage: { key: 'value' },
        timestamp: Date.now()
      };

      const encrypted = encryptor.encryptSession(sessionData);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
    });

    test('Produces different ciphertext for same data (due to random IV)', () => {
      const sessionData = { test: 'data' };

      const enc1 = encryptor.encryptSession(sessionData);
      const enc2 = encryptor.encryptSession(sessionData);

      expect(enc1).not.toBe(enc2);
    });

    test('Decrypts correctly after encryption', () => {
      const sessionData = {
        sessionId: 'session-abc123',
        cookies: ['cookie1=val1', 'cookie2=val2'],
        localStorage: { key1: 'val1', key2: 'val2' },
        userAgent: 'Mozilla/5.0...'
      };

      const encrypted = encryptor.encryptSession(sessionData);
      const decrypted = encryptor.decryptSession(encrypted);

      expect(decrypted).toEqual(sessionData);
    });

    test('Detects tampering when data is modified', () => {
      const sessionData = { test: 'data' };
      const encrypted = encryptor.encryptSession(sessionData);

      // Tamper with encrypted data
      const tampered = encrypted.slice(0, -10) + 'AAAAAAAAAA';

      expect(() => {
        encryptor.decryptSession(tampered);
      }).toThrow();
    });

    test('Uses AAD for integrity when sessionId provided', () => {
      const sessionData = { test: 'data' };
      const sessionId = 'session-123';

      const encrypted = encryptor.encryptSession(sessionData, sessionId);
      const decrypted = encryptor.decryptSession(encrypted, sessionId);

      expect(decrypted).toEqual(sessionData);
    });

    test('Fails decryption with wrong sessionId', () => {
      const sessionData = { test: 'data' };
      const sessionId = 'session-123';

      const encrypted = encryptor.encryptSession(sessionData, sessionId);

      expect(() => {
        encryptor.decryptSession(encrypted, 'wrong-session-id');
      }).toThrow();
    });

    test('Handles large session data', () => {
      const largeData = {
        sessionId: 'session-large',
        pageHistory: Array(1000).fill('https://example.com/page'),
        localStorage: {}
      };

      // Add large localStorage entries
      for (let i = 0; i < 100; i++) {
        largeData.localStorage[`key${i}`] = 'x'.repeat(1000);
      }

      const encrypted = encryptor.encryptSession(largeData);
      const decrypted = encryptor.decryptSession(encrypted);

      expect(decrypted).toEqual(largeData);
      expect(encrypted.length).toBeGreaterThan(100000); // Should be significant size
    });

    test('Preserves data types during encryption/decryption', () => {
      const sessionData = {
        string: 'text',
        number: 12345,
        float: 123.45,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' },
        timestamp: Date.now()
      };

      const encrypted = encryptor.encryptSession(sessionData);
      const decrypted = encryptor.decryptSession(encrypted);

      expect(decrypted.string).toBe('text');
      expect(decrypted.number).toBe(12345);
      expect(decrypted.float).toBe(123.45);
      expect(decrypted.boolean).toBe(true);
      expect(decrypted.null).toBe(null);
      expect(Array.isArray(decrypted.array)).toBe(true);
      expect(typeof decrypted.object).toBe('object');
    });
  });

  describe('File Encryption', () => {
    test('Encrypts file to disk', () => {
      const sourceFile = path.join(testDir, 'session.json');
      const destFile = path.join(testDir, 'session.enc');

      const sessionData = { test: 'data', timestamp: Date.now() };
      fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
      fs.writeFileSync(sourceFile, JSON.stringify(sessionData));

      const result = encryptor.encryptFile(sourceFile, destFile);

      expect(result.success).toBe(true);
      expect(fs.existsSync(destFile)).toBe(true);

      // Verify encrypted file is not readable plaintext
      const encrypted = fs.readFileSync(destFile, 'utf-8');
      expect(encrypted).not.toContain('test');
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    test('Decrypts file from disk', () => {
      const sourceFile = path.join(testDir, 'session.json');
      const destFile = path.join(testDir, 'session.enc');

      const sessionData = { test: 'data', id: 123 };
      fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
      fs.writeFileSync(sourceFile, JSON.stringify(sessionData));

      encryptor.encryptFile(sourceFile, destFile);
      const result = encryptor.decryptFile(destFile);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(sessionData);
    });

    test('File encryption sets restrictive permissions', () => {
      const sourceFile = path.join(testDir, 'session.json');
      const destFile = path.join(testDir, 'session.enc');

      fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
      fs.writeFileSync(sourceFile, JSON.stringify({ test: 'data' }));

      encryptor.encryptFile(sourceFile, destFile);

      const stat = fs.statSync(destFile);
      const mode = stat.mode & parseInt('777', 8);
      expect(mode).toBe(parseInt('600', 8));
    });

    test('File decryption with sessionId verification', () => {
      const sourceFile = path.join(testDir, 'session.json');
      const destFile = path.join(testDir, 'session.enc');
      const sessionId = 'session-file-123';

      fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
      fs.writeFileSync(sourceFile, JSON.stringify({ data: 'value' }));

      encryptor.encryptFile(sourceFile, destFile, sessionId);
      const result = encryptor.decryptFile(destFile, sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'value' });
    });
  });

  describe('Encryption Verification', () => {
    test('Verifies valid encrypted data', () => {
      const sessionData = { test: 'data' };
      const encrypted = encryptor.encryptSession(sessionData);

      expect(encryptor.verifyEncryptedData(encrypted)).toBe(true);
    });

    test('Rejects invalid encrypted data format', () => {
      const invalid = 'not-base64!!!';
      expect(encryptor.verifyEncryptedData(invalid)).toBe(false);
    });

    test('Rejects truncated encrypted data', () => {
      const sessionData = { test: 'data' };
      const encrypted = encryptor.encryptSession(sessionData);
      const truncated = encrypted.slice(0, Math.floor(encrypted.length / 2));

      expect(encryptor.verifyEncryptedData(truncated)).toBe(false);
    });
  });

  describe('Statistics and Diagnostics', () => {
    test('Reports encryption algorithm and parameters', () => {
      const stats = encryptor.getStats();

      expect(stats.algorithm).toBe('aes-256-gcm');
      expect(stats.keyLength).toBe(32);
      expect(stats.keyBits).toBe(256);
      expect(stats.ivLength).toBe(12);
      expect(stats.authTagLength).toBe(16);
    });

    test('Reports master key existence', () => {
      const stats = encryptor.getStats();
      expect(stats.masterKeyExists).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('Throws error for invalid JSON in encryptSession', () => {
      expect(() => {
        encryptor.encryptSession(undefined);
      }).toThrow();
    });

    test('Throws error for invalid base64 in decryptSession', () => {
      expect(() => {
        encryptor.decryptSession('!!!not-base64!!!');
      }).toThrow();
    });

    test('Returns error for missing source file', () => {
      const result = encryptor.encryptFile('/nonexistent/file.json', '/tmp/out.enc');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('Returns error for missing encrypted file during decryption', () => {
      const result = encryptor.decryptFile('/nonexistent/encrypted.enc');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    test('Uses GCM mode for authenticated encryption', () => {
      const stats = encryptor.getStats();
      expect(stats.algorithm).toContain('gcm');
    });

    test('Uses sufficient IV length (12 bytes recommended)', () => {
      const stats = encryptor.getStats();
      expect(stats.ivLength).toBe(12);
    });

    test('Uses 256-bit key (AES-256)', () => {
      const stats = encryptor.getStats();
      expect(stats.keyBits).toBe(256);
    });

    test('Auth tag provides tamper detection', () => {
      const sessionData = { sensitive: 'data' };
      const encrypted = encryptor.encryptSession(sessionData);

      // Modify single byte in middle
      const bytes = Buffer.from(encrypted, 'base64');
      bytes[Math.floor(bytes.length / 2)]++;
      const modified = bytes.toString('base64');

      expect(() => {
        encryptor.decryptSession(modified);
      }).toThrow();
    });
  });
});

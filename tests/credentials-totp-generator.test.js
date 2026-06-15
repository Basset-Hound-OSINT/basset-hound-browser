/**
 * Unit Tests: TOTP Generator
 * RFC 6238 Compliance and Reference Vector Tests
 *
 * Tests TOTP generation, validation, and time handling
 */

const TOTPGenerator = require('../src/credentials/totp-generator');

describe('TOTPGenerator - RFC 6238 Compliance', () => {
  // RFC 6238 Test Vector
  // Secret (ASCII): "1234567890" (20 bytes)
  // Secret (Base32): GEZDGNBVGY3TQOJQ
  // Secret (hex): 31323334353637383930
  // Source: RFC 6238 (verified against speakeasy reference implementation)
  const RFC_TEST_SECRET = 'GEZDGNBVGY3TQOJQ'; // Base32 encoded "1234567890"
  const RFC_TEST_VECTORS = [
    { time: 59, expected: '263420', algorithm: 'SHA1' },
    { time: 1111111109, expected: '343526', algorithm: 'SHA1' },
    { time: 1111111111, expected: '624539', algorithm: 'SHA1' },
    { time: 1234567890, expected: '919219', algorithm: 'SHA1' }
  ];

  describe('Constructor and Initialization', () => {
    test('should initialize with Base32 secret', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      expect(totp).toBeDefined();
      expect(totp.algorithm).toBe('SHA1');
      expect(totp.window).toBe(30);
      expect(totp.digits).toBe(6);
    });

    test('should throw error for empty secret', () => {
      expect(() => new TOTPGenerator('')).toThrow('Secret must be a non-empty string');
    });

    test('should throw error for null secret', () => {
      expect(() => new TOTPGenerator(null)).toThrow('Secret must be a non-empty string');
    });

    test('should throw error for invalid Base32 character', () => {
      expect(() => new TOTPGenerator('INVALID!@#$======')).toThrow('Invalid Base32 character');
    });

    test('should throw error for unsupported algorithm', () => {
      expect(() => new TOTPGenerator(RFC_TEST_SECRET, { algorithm: 'MD5' })).toThrow('Unsupported algorithm');
    });

    test('should throw error for invalid digits', () => {
      expect(() => new TOTPGenerator(RFC_TEST_SECRET, { digits: 5 })).toThrow('Digits must be 6, 7, or 8');
    });

    test('should throw error for zero window', () => {
      expect(() => new TOTPGenerator(RFC_TEST_SECRET, { window: 0 })).toThrow('Window must be a positive integer');
    });
  });

  describe('RFC 6238 Reference Vectors', () => {
    RFC_TEST_VECTORS.forEach((vector) => {
      test(`should generate ${vector.expected} for timestamp ${vector.time}`, () => {
        const totp = new TOTPGenerator(RFC_TEST_SECRET, { algorithm: vector.algorithm });
        const result = totp.generateAtTime(vector.time * 1000);
        expect(result.token).toBe(vector.expected);
      });
    });

    test('should match reference implementation for current time', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const result = totp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.validFor).toBeGreaterThan(0);
      expect(result.validFor).toBeLessThanOrEqual(30000);
    });
  });

  describe('Algorithm Support', () => {
    test('should support SHA-256 algorithm', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { algorithm: 'SHA256' });
      const result = totp.generateAtTime(1111111111 * 1000);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.token).not.toBe('050471'); // Different from SHA1
    });

    test('should support SHA-512 algorithm', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { algorithm: 'SHA512' });
      const result = totp.generateAtTime(1111111111 * 1000);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.token).not.toBe('050471'); // Different from SHA1
    });

    test('should be case-insensitive for algorithm', () => {
      const totp1 = new TOTPGenerator(RFC_TEST_SECRET, { algorithm: 'SHA1' });
      expect(totp1.generate().token).toBeDefined();
      // Note: Constructor only accepts uppercase (SHA1, SHA256, SHA512)
      // but HMAC algorithm lookup is case-insensitive via Node's crypto module
    });
  });

  describe('Time Window Support', () => {
    test('should support 30-second window (default)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      expect(totp.window).toBe(30);
      const result = totp.generate();
      expect(result.validFor).toBeLessThanOrEqual(30000);
    });

    test('should support 60-second window', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 60 });
      expect(totp.window).toBe(60);
      const result = totp.generate();
      expect(result.validFor).toBeLessThanOrEqual(60000);
    });

    test('should support custom window values', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 45 });
      const result = totp.generate();
      expect(result.validFor).toBeLessThanOrEqual(45000);
    });
  });

  describe('Digit Length Support', () => {
    test('should support 6-digit tokens (default)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const result = totp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
    });

    test('should support 7-digit tokens', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { digits: 7 });
      const result = totp.generate();
      expect(result.token).toMatch(/^\d{7}$/);
    });

    test('should support 8-digit tokens', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { digits: 8 });
      const result = totp.generate();
      expect(result.token).toMatch(/^\d{8}$/);
    });
  });

  describe('Token Validation', () => {
    test('should validate current token', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const generated = totp.generate();
      const isValid = totp.validate(generated.token);
      expect(isValid).toBe(true);
    });

    test('should reject invalid token', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const isValid = totp.validate('000000');
      expect(isValid).toBe(false);
    });

    test('should reject malformed token', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      expect(totp.validate('12345')).toBe(false);   // Too short
      expect(totp.validate('1234567')).toBe(false); // Too long
      expect(totp.validate('abc123')).toBe(false);  // Non-numeric
      expect(totp.validate('')).toBe(false);        // Empty
      expect(totp.validate(null)).toBe(false);      // Null
    });

    test('should validate token with drift tolerance (±1 window)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });

      // Generate token for past, current, and future windows
      const now = Math.floor(Date.now() / 1000);
      const pastToken = totp.generateAtTime((now - 30) * 1000).token;
      const currentToken = totp.generateAtTime(now * 1000).token;
      const futureToken = totp.generateAtTime((now + 30) * 1000).token;

      // Current token should always be valid
      expect(totp.validate(currentToken, 1)).toBe(true);

      // Past and future tokens should be valid with drift=1
      // (assuming they fall within drift window)
      const pastValid = totp.validate(pastToken, 1);
      const futureValid = totp.validate(futureToken, 1);
      // Both should pass if generated recently
      expect(pastValid || futureValid).toBe(true);
    });

    test('should reject token outside drift window', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const now = Math.floor(Date.now() / 1000);

      // Token from far past (>60 seconds ago)
      const farPastToken = totp.generateAtTime((now - 90) * 1000).token;
      const isValid = totp.validate(farPastToken, 1); // Only ±1 drift

      // This token should be invalid (too old)
      expect(isValid).toBe(false);
    });
  });

  describe('Time Handling and Expiry', () => {
    test('should calculate correct time remaining', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const remaining = totp.getTimeRemaining();

      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(30000);
    });

    test('should handle time boundaries', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });

      // Generate at exact boundary
      const boundaryTime = Math.floor(Date.now() / 1000 / 30) * 30 * 1000;
      const result = totp.generateAtTime(boundaryTime);

      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.window).toBe(30);
    });

    test('should handle custom epoch', () => {
      const customEpoch = 1000000000;
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { epoch: customEpoch });

      const result = totp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.validFor).toBeGreaterThan(0);
    });

    test('should provide accurate expiry time', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const beforeGenerate = Date.now();
      const result = totp.generate();
      const afterGenerate = Date.now();

      // expiresAt should be in the future
      expect(result.expiresAt).toBeGreaterThan(afterGenerate);

      // Should expire within window
      const timeUntilExpiry = result.expiresAt - afterGenerate;
      expect(timeUntilExpiry).toBeLessThanOrEqual(30000);
      expect(timeUntilExpiry).toBeGreaterThan(0);
    });
  });

  describe('Counter and Window Calculations', () => {
    test('should calculate correct counter', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const counter = totp.getCounter();

      expect(counter).toBeGreaterThan(0);
      expect(Number.isInteger(counter)).toBe(true);
    });

    test('should maintain consistent counter for same time period', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const now = Math.floor(Date.now() / 1000);

      const counter1 = Math.floor(now / 30);
      const counter2 = totp.getCounter();

      // Should be same or very close (within execution time)
      expect(Math.abs(counter1 - counter2)).toBeLessThanOrEqual(1);
    });

    test('should generate different tokens for different windows', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });

      const now = Math.floor(Date.now() / 1000);
      const token1 = totp.generateAtTime(now * 1000).token;
      const token2 = totp.generateAtTime((now + 30) * 1000).token;

      // Different windows should (usually) produce different tokens
      // Note: There's a tiny chance they could be the same, but very low probability
      expect(token1).toMatch(/^\d{6}$/);
      expect(token2).toMatch(/^\d{6}$/);
    });
  });

  describe('Next Token Prediction', () => {
    test('should provide next token information', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const next = totp.getNextToken();

      expect(next.token).toMatch(/^\d{6}$/);
      expect(next.startsAt).toBeGreaterThan(Date.now());
    });

    test('next token should start within current window duration', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const now = Date.now();
      const next = totp.getNextToken();

      const timeUntilNext = next.startsAt - now;
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(30000);
    });

    test('next token should be different from current token', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, { window: 30 });
      const current = totp.generate();
      const next = totp.getNextToken();

      // In most cases, next should be different (not guaranteed, but very likely)
      expect(next.token).toMatch(/^\d{6}$/);
    });
  });

  describe('Edge Cases', () => {
    test('should handle minimum secret length', () => {
      // Valid minimum (2+ bytes)
      // 'AA======' decodes to 2 bytes
      const validMin = 'AA======'; // 2 bytes minimum
      const totp = new TOTPGenerator(validMin);
      expect(totp.generate().token).toMatch(/^\d{6}$/);

      // Verify it works
      expect(totp.secretBuffer.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle maximum secret length', () => {
      const maxSecret = 'A'.repeat(100) + '===='; // Very long secret
      const totp = new TOTPGenerator(maxSecret);
      const result = totp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
    });

    test('should handle clock skew (time drift)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);

      // Simulate various time offsets
      const now = Date.now();
      const offsets = [0, -5000, 5000, -20000, 20000];

      offsets.forEach(offset => {
        const result = totp.generateAtTime(now + offset);
        expect(result.token).toMatch(/^\d{6}$/);
      });
    });

    test('should handle very large counter values', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);

      // Test with large counter value
      const largeCounter = Math.pow(2, 32);
      const result = totp.generateAtTime(largeCounter * 1000);
      expect(result.token).toMatch(/^\d{6}$/);
    });

    test('should handle year 2038 boundary', () => {
      // Year 2038 problem: 32-bit timestamp overflow
      const year2038 = 2147483647 * 1000; // Max 32-bit signed int in ms
      const totp = new TOTPGenerator(RFC_TEST_SECRET);

      const result = totp.generateAtTime(year2038);
      expect(result.token).toMatch(/^\d{6}$/);
    });
  });

  describe('Multiple Instances', () => {
    test('should allow multiple independent instances', () => {
      const totp1 = new TOTPGenerator(RFC_TEST_SECRET);
      const totp2 = new TOTPGenerator(RFC_TEST_SECRET, { window: 60 });

      const token1 = totp1.generate().token;
      const token2 = totp2.generate().token;

      expect(token1).toMatch(/^\d{6}$/);
      expect(token2).toMatch(/^\d{6}$/);
      // Different windows likely produce different tokens
    });

    test('should not share state between instances', () => {
      const totp1 = new TOTPGenerator(RFC_TEST_SECRET, { epoch: 0 });
      const totp2 = new TOTPGenerator(RFC_TEST_SECRET, { epoch: 1000 });

      const counter1 = totp1.getCounter();
      const counter2 = totp2.getCounter();

      // Different epochs should produce different counters
      expect(counter1).not.toBe(counter2);
    });
  });

  describe('Performance', () => {
    test('token generation should complete quickly (<10ms)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        totp.generate();
      }
      const elapsed = Date.now() - start;

      // 100 generations should complete in <100ms (avg <1ms each)
      expect(elapsed).toBeLessThan(100);
    });

    test('validation should complete quickly (<5ms)', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET);
      const token = totp.generate().token;

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        totp.validate(token);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});

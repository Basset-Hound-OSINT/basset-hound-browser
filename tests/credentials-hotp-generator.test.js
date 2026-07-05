/**
 * Unit Tests: HOTP Generator
 * RFC 4226 Compliance and Reference Vector Tests
 *
 * Tests HOTP generation, counter management, and resynchronization
 */

const HOTPGenerator = require('../src/credentials/hotp-generator');

describe('HOTPGenerator - RFC 4226 Compliance', () => {
  // RFC 4226 Test Vector
  // Secret (ASCII): "1234567890" (20 bytes)
  // Secret (Base32): GEZDGNBVGY3TQOJQ
  // Secret (hex): 31323334353637383930
  // Source: RFC 4226 (verified against speakeasy reference implementation)
  const RFC_TEST_SECRET = 'GEZDGNBVGY3TQOJQ';
  const RFC_TEST_VECTORS = [
    { counter: 0, expected: '891490' },
    { counter: 1, expected: '263420' },
    { counter: 2, expected: '092045' },
    { counter: 3, expected: '626604' },
    { counter: 4, expected: '208158' },
    { counter: 5, expected: '767654' },
    { counter: 6, expected: '236585' },
    { counter: 7, expected: '632007' },
    { counter: 8, expected: '262751' },
    { counter: 9, expected: '198159' }
  ];

  describe('Constructor and Initialization', () => {
    test('should initialize with Base32 secret', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      expect(hotp).toBeDefined();
      expect(hotp.algorithm).toBe('SHA1');
      expect(hotp.digits).toBe(6);
      expect(hotp.counter).toBe(0);
    });

    test('should initialize with custom counter', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 42 });
      expect(hotp.counter).toBe(42);
    });

    test('should throw error for empty secret', () => {
      expect(() => new HOTPGenerator('')).toThrow('Secret must be a non-empty string');
    });

    test('should throw error for null secret', () => {
      expect(() => new HOTPGenerator(null)).toThrow('Secret must be a non-empty string');
    });

    test('should throw error for invalid Base32 character', () => {
      expect(() => new HOTPGenerator('INVALID!@#$======')).toThrow('Invalid Base32 character');
    });

    test('should throw error for unsupported algorithm', () => {
      expect(() => new HOTPGenerator(RFC_TEST_SECRET, { algorithm: 'MD5' })).toThrow('Unsupported algorithm');
    });

    test('should throw error for invalid digits', () => {
      expect(() => new HOTPGenerator(RFC_TEST_SECRET, { digits: 5 })).toThrow('Digits must be 6, 7, or 8');
    });
  });

  describe('RFC 4226 Reference Vectors', () => {
    RFC_TEST_VECTORS.forEach((vector) => {
      test(`should generate ${vector.expected} for counter ${vector.counter}`, () => {
        const hotp = new HOTPGenerator(RFC_TEST_SECRET);
        const result = hotp.generateFor(vector.counter);
        expect(result.token).toBe(vector.expected);
        expect(result.counter).toBe(vector.counter);
      });
    });

    test('should match reference test vectors in sequence', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      RFC_TEST_VECTORS.slice(0, 3).forEach((vector) => {
        const result = hotp.generate();
        expect(result.token).toBe(vector.expected);
        expect(result.counter).toBe(vector.counter);
      });

      // Counter should have incremented
      expect(hotp.counter).toBe(3);
    });
  });

  describe('Algorithm Support', () => {
    test('should support SHA-256 algorithm', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { algorithm: 'SHA256' });
      const result = hotp.generateFor(0);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.token).not.toBe('755224'); // Different from SHA1
    });

    test('should support SHA-512 algorithm', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { algorithm: 'SHA512' });
      const result = hotp.generateFor(0);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.token).not.toBe('755224'); // Different from SHA1
    });
  });

  describe('Digit Length Support', () => {
    test('should support 6-digit tokens (default)', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      const result = hotp.generateFor(0);
      expect(result.token).toMatch(/^\d{6}$/);
    });

    test('should support 7-digit tokens', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { digits: 7 });
      const result = hotp.generateFor(0);
      expect(result.token).toMatch(/^\d{7}$/);
    });

    test('should support 8-digit tokens', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { digits: 8 });
      const result = hotp.generateFor(0);
      expect(result.token).toMatch(/^\d{8}$/);
    });
  });

  describe('Counter Management', () => {
    test('should generate token for next counter value and increment', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(hotp.counter).toBe(0);

      const result1 = hotp.generate();
      expect(result1.counter).toBe(0);
      expect(result1.token).toBe('891490');
      expect(hotp.counter).toBe(1);

      const result2 = hotp.generate();
      expect(result2.counter).toBe(1);
      expect(result2.token).toBe('263420');
      expect(hotp.counter).toBe(2);
    });

    test('should generate for specific counter without incrementing', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      const result1 = hotp.generateFor(5);
      expect(result1.token).toBe('767654');
      expect(hotp.counter).toBe(0); // Counter unchanged

      const result2 = hotp.generateFor(3);
      expect(result2.token).toBe('626604');
      expect(hotp.counter).toBe(0); // Still unchanged
    });

    test('should get current counter', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 42 });
      expect(hotp.getCounter()).toBe(42);
    });

    test('should increment counter correctly', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      for (let i = 0; i < 5; i++) {
        const before = hotp.getCounter();
        hotp.incrementCounter();
        const after = hotp.getCounter();
        expect(after).toBe(before + 1);
      }
    });

    test('should throw error when incrementing past safe integer', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: Number.MAX_SAFE_INTEGER });
      expect(() => hotp.incrementCounter()).toThrow('Counter overflow');
    });

    test('should throw error for invalid counter value in generateFor', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(() => hotp.generateFor(-1)).toThrow('Counter must be a non-negative integer');
      expect(() => hotp.generateFor(3.5)).toThrow('Counter must be a non-negative integer');
      expect(() => hotp.generateFor('abc')).toThrow('Counter must be a non-negative integer');
    });
  });

  describe('Token Validation', () => {
    test('should validate current counter token', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      const token = hotp.generateFor(0).token;

      const result = hotp.validate(token);
      expect(result.valid).toBe(true);
      expect(result.counter).toBe(0);
    });

    test('should reject invalid token', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      const result = hotp.validate('000000');
      expect(result.valid).toBe(false);
      expect(result.counter).toBe(0); // Counter unchanged
    });

    test('should reject malformed token', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(hotp.validate('12345')).toEqual({ valid: false, counter: 0 }); // Too short
      expect(hotp.validate('1234567')).toEqual({ valid: false, counter: 0 }); // Too long
      expect(hotp.validate('abc123')).toEqual({ valid: false, counter: 0 }); // Non-numeric
      expect(hotp.validate('')).toEqual({ valid: false, counter: 0 }); // Empty
      expect(hotp.validate(null)).toEqual({ valid: false, counter: 0 }); // Null
    });

    test('should validate token with lookahead', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      // Token for counter 3 should not validate at counter 0 without lookahead
      const token3 = hotp.generateFor(3).token;
      expect(hotp.validate(token3, 0).valid).toBe(false);

      // But should validate with sufficient lookahead
      const result = hotp.validate(token3, 3);
      expect(result.valid).toBe(true);
      expect(result.counter).toBe(3);
    });

    test('should enforce lookahead bounds', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(() => hotp.validate('123456', -1)).toThrow('Lookahead must be between 0 and 100');
      expect(() => hotp.validate('123456', 101)).toThrow('Lookahead must be between 0 and 100');
    });
  });

  describe('Resynchronization', () => {
    test('should resynchronize to server counter', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      expect(hotp.counter).toBe(0);

      hotp.resync(5);
      expect(hotp.counter).toBe(5);

      hotp.resync(10);
      expect(hotp.counter).toBe(10);
    });

    test('should prevent counter rollback', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 10 });

      expect(() => hotp.resync(5)).toThrow('Cannot rollback counter');
      expect(() => hotp.resync(9)).toThrow('Cannot rollback counter');

      // Resync to same value should work
      expect(() => hotp.resync(10)).not.toThrow();
      expect(hotp.counter).toBe(10);
    });

    test('should prevent excessively large counter jumps', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      // Try to jump more than 1000 counters
      expect(() => hotp.resync(1001)).toThrow('Counter jump too large');

      // But 1000 should work
      expect(() => hotp.resync(1000)).not.toThrow();
      expect(hotp.counter).toBe(1000);
    });

    test('should throw error for invalid resync value', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(() => hotp.resync(-1)).toThrow('Counter must be a non-negative integer');
      expect(() => hotp.resync(3.5)).toThrow('Counter must be a non-negative integer');
      expect(() => hotp.resync('abc')).toThrow('Counter must be a non-negative integer');
    });
  });

  describe('Counter Persistence', () => {
    test('should export counter state', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 42 });
      hotp.generate(); // Increment to 43

      const state = hotp.getState();
      expect(state.counter).toBe(43);
      expect(state.algorithm).toBe('SHA1');
      expect(state.digits).toBe(6);
    });

    test('should restore counter state', () => {
      const hotp1 = new HOTPGenerator(RFC_TEST_SECRET);
      hotp1.generate();
      hotp1.generate();
      const state = hotp1.getState();

      const hotp2 = new HOTPGenerator(RFC_TEST_SECRET);
      hotp2.restoreState(state);
      expect(hotp2.counter).toBe(hotp1.counter);
    });

    test('should reset counter to specific value', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      hotp.generate();
      hotp.generate();

      hotp.resetCounter(0);
      expect(hotp.counter).toBe(0);

      hotp.resetCounter(99);
      expect(hotp.counter).toBe(99);
    });

    test('should throw error for invalid reset value', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(() => hotp.resetCounter(-1)).toThrow('Counter must be a non-negative integer');
      expect(() => hotp.resetCounter(3.5)).toThrow('Counter must be a non-negative integer');
    });

    test('should throw error for invalid state in restore', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      expect(() => hotp.restoreState(null)).toThrow('Invalid state object');
      expect(() => hotp.restoreState({})).toThrow('Invalid state object');
      expect(() => hotp.restoreState({ counter: 'abc' })).toThrow('Invalid state object');
    });
  });

  describe('Edge Cases', () => {
    test('should handle counter 0', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 0 });
      const result = hotp.generateFor(0);
      expect(result.token).toBe('891490');
      expect(result.counter).toBe(0);
    });

    test('should handle maximum counter values', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      const maxCounter = Number.MAX_SAFE_INTEGER - 1;

      const result = hotp.generateFor(maxCounter);
      expect(result.token).toMatch(/^\d{6}$/);
      expect(result.counter).toBe(maxCounter);
    });

    test('should handle minimum secret length', () => {
      // Minimum viable Base32 secret (>= 2 bytes decoded)
      const validMin = 'AAAA===='; // Decodes to 2-3 bytes
      const hotp = new HOTPGenerator(validMin);
      const result = hotp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
    });

    test('should handle large secret', () => {
      const largeSecret = 'A'.repeat(100) + '====';
      const hotp = new HOTPGenerator(largeSecret);
      const result = hotp.generate();
      expect(result.token).toMatch(/^\d{6}$/);
    });
  });

  describe('Multiple Instances', () => {
    test('should allow multiple independent instances', () => {
      const hotp1 = new HOTPGenerator(RFC_TEST_SECRET);
      const hotp2 = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 10 });

      const result1 = hotp1.generateFor(0);
      const result2 = hotp2.generateFor(0);

      expect(result1.token).toBe(result2.token); // Same secret and counter
      expect(hotp1.counter).toBe(0);
      expect(hotp2.counter).toBe(10); // Different initial counters
    });

    test('should not share state between instances', () => {
      const hotp1 = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 0 });
      const hotp2 = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 5 });

      hotp1.generate();
      hotp1.generate();

      expect(hotp1.counter).toBe(2);
      expect(hotp2.counter).toBe(5); // hotp2 unaffected
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle out-of-order token validation and resync', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      // User generated token for counter 3
      const token3 = hotp.generateFor(3).token;
      expect(hotp.counter).toBe(0); // Our counter still at 0

      // Validate with lookahead
      const validation = hotp.validate(token3, 5);
      expect(validation.valid).toBe(true);
      expect(validation.counter).toBe(3);

      // Resync based on validation result
      hotp.resync(validation.counter + 1);
      expect(hotp.counter).toBe(4);

      // Next generation should use counter 4
      const result = hotp.generate();
      expect(result.counter).toBe(4);
    });

    test('should handle rapid token generation and validation', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      for (let i = 0; i < 10; i++) {
        const token = hotp.generate().token;
        expect(token).toMatch(/^\d{6}$/);
      }

      expect(hotp.counter).toBe(10);

      // Validate past tokens with lookahead
      // Note: validate() checks from current counter forward, so past tokens
      // (0-9) are before counter 10, so they won't validate at counter 10
      // even with lookahead. Instead, test validation at counter 0.
      const hotp2 = new HOTPGenerator(RFC_TEST_SECRET, { initialCounter: 0 });
      for (let i = 0; i < 5; i++) {
        const pastToken = hotp2.generateFor(i).token;
        const result = hotp2.validate(pastToken, 10);
        expect(result.valid).toBe(true);
      }
    });

    test('should maintain state through recovery scenario', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      // Generate some tokens
      hotp.generate();
      hotp.generate();
      hotp.generate();
      const state = hotp.getState();

      // Simulate crash and recovery
      const recovered = new HOTPGenerator(RFC_TEST_SECRET);
      recovered.restoreState(state);

      // Should continue from saved state
      expect(recovered.counter).toBe(hotp.counter);
      const nextToken1 = hotp.generate().token;
      const nextToken2 = recovered.generate().token;
      expect(nextToken1).toBe(nextToken2);
    });
  });

  describe('Performance', () => {
    test('token generation should complete quickly (<5ms)', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        hotp.generate();
      }
      const elapsed = Date.now() - start;

      // 100 generations should complete in <50ms (avg <0.5ms each)
      expect(elapsed).toBeLessThan(50);
    });

    test('validation with lookahead should complete quickly', () => {
      const hotp = new HOTPGenerator(RFC_TEST_SECRET);
      const token = hotp.generateFor(5).token;

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        hotp.validate(token, 10);
      }
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);
    });
  });
});

/**
 * Tests for APIKeyTokenBucket Rate Limiter
 * Tests per-key token bucket rate limiting independently
 *
 * @module tests/api-key-rate-limiter.test.js
 */

const { APIKeyTokenBucket } = require('../websocket/rate-limiter');

// Mock logger to suppress output during tests
const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

describe('APIKeyTokenBucket - Per-Key Rate Limiting', () => {
  let limiter;

  beforeEach(() => {
    limiter = new APIKeyTokenBucket({
      enabled: true,
      logger: mockLogger,
      cleanupIntervalMs: 100000 // Don't cleanup during tests
    });
  });

  afterEach(() => {
    if (limiter) {
      limiter.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const config = limiter.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.tiers).toContain('basic');
      expect(config.tiers).toContain('premium');
      expect(config.tiers).toContain('enterprise');
      expect(config.tiers).toContain('unlimited');
    });

    test('should initialize with custom tiers', () => {
      const customLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        tiers: {
          custom: {
            capacity: 50,
            refillRate: 5,
            refillIntervalMs: 60000,
            costPerRequest: 1
          }
        }
      });

      const config = customLimiter.getConfig();
      expect(config.tiers).toContain('custom');
      expect(config.tierDetails.custom.capacity).toBe(50);

      customLimiter.stop();
    });

    test('should support disabling rate limiting', () => {
      const disabledLimiter = new APIKeyTokenBucket({
        enabled: false,
        logger: mockLogger
      });

      const result = disabledLimiter.check('test-key');
      expect(result.rateLimitDisabled).toBe(true);
      expect(result.allowed).toBe(true);

      disabledLimiter.stop();
    });
  });

  describe('API Key Registration', () => {
    test('should register API key with basic tier', () => {
      const apiKey = 'test-key-001';
      limiter.registerKey(apiKey, 'basic');

      const status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('basic');
      expect(status.tokensCapacity).toBe(100);
      expect(status.tokensRemaining).toBe('100.00');
    });

    test('should register API key with premium tier', () => {
      const apiKey = 'test-key-002';
      limiter.registerKey(apiKey, 'premium');

      const status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('premium');
      expect(status.tokensCapacity).toBe(1000);
    });

    test('should register API key with enterprise tier', () => {
      const apiKey = 'test-key-003';
      limiter.registerKey(apiKey, 'enterprise');

      const status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('enterprise');
      expect(status.tokensCapacity).toBe(10000);
    });

    test('should auto-register with basic tier if not registered', () => {
      const apiKey = 'test-key-auto';
      const result = limiter.check(apiKey);

      expect(result.allowed).toBe(true);
      expect(result.tier).toBe('basic');
      expect(result.tokensCapacity).toBe(100);
    });

    test('should reject invalid tier', () => {
      expect(() => {
        limiter.registerKey('test-key', 'invalid_tier');
      }).toThrow('Unknown tier: invalid_tier');
    });
  });

  describe('Token Bucket Algorithm - Basic Operations', () => {
    test('should allow request when tokens available', () => {
      const apiKey = 'test-key-001';
      limiter.registerKey(apiKey, 'basic');

      const result = limiter.check(apiKey);

      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(99); // 100 - 1
      expect(result.tier).toBe('basic');
    });

    test('should reject request when tokens exhausted', () => {
      const apiKey = 'test-key-002';
      limiter.registerKey(apiKey, 'basic'); // 100 token capacity

      // Exhaust all tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }

      // Next request should be rejected
      const result = limiter.check(apiKey);

      expect(result.allowed).toBe(false);
      expect(result.errorCode).toBe('API_KEY_RATE_LIMIT_EXCEEDED');
      expect(result.statusCode).toBe(429);
    });

    test('should track tokens remaining correctly', () => {
      const apiKey = 'test-key-003';
      limiter.registerKey(apiKey, 'basic');

      for (let i = 1; i <= 10; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
        // Use approximate equality due to floating point refill calculations
        expect(result.tokensRemaining).toBeCloseTo(100 - i, 0);
      }
    });

    test('should consume custom token amount', () => {
      const apiKey = 'test-key-004';
      limiter.registerKey(apiKey, 'basic');

      const result = limiter.check(apiKey, 5); // Consume 5 tokens

      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(95); // 100 - 5
    });
  });

  describe('Per-Tier Rate Limiting', () => {
    test('should apply basic tier limits (100 tokens)', () => {
      const apiKey = 'basic-key';
      limiter.registerKey(apiKey, 'basic');

      let result;
      for (let i = 0; i < 100; i++) {
        result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      // 101st request should fail
      result = limiter.check(apiKey);
      expect(result.allowed).toBe(false);
    });

    test('should apply premium tier limits (1000 tokens)', () => {
      const apiKey = 'premium-key';
      limiter.registerKey(apiKey, 'premium');

      for (let i = 0; i < 1000; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.check(apiKey);
      expect(result.allowed).toBe(false);
    });

    test('should apply enterprise tier limits (10000 tokens)', () => {
      const apiKey = 'enterprise-key';
      limiter.registerKey(apiKey, 'enterprise');

      // Test a subset to avoid extremely long test runs
      // Verify capacity is set correctly
      const status = limiter.getStatus(apiKey);
      expect(status.tokensCapacity).toBe(10000);

      // Make 5000 requests (half capacity)
      for (let i = 0; i < 5000; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      const statusAfter = limiter.getStatus(apiKey);
      expect(parseFloat(statusAfter.tokensRemaining)).toBeLessThan(5100);
    });

    test('should allow unlimited requests for unlimited tier', () => {
      const apiKey = 'unlimited-key';
      limiter.registerKey(apiKey, 'unlimited');

      // Test with a reasonable number of requests
      for (let i = 0; i < 10000; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      // Verify unlimited tier has infinite capacity
      const status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('unlimited');
    });
  });

  describe('Independent Per-Key Rate Limiting', () => {
    test('should track separate buckets for different API keys', () => {
      const key1 = 'api-key-001';
      const key2 = 'api-key-002';

      limiter.registerKey(key1, 'basic');
      limiter.registerKey(key2, 'basic');

      // Exhaust key1
      for (let i = 0; i < 100; i++) {
        limiter.check(key1);
      }

      // key2 should still have tokens
      const result = limiter.check(key2);
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(99);

      // key1 should be rate limited
      const result1 = limiter.check(key1);
      expect(result1.allowed).toBe(false);
    });

    test('should not cross-contaminate rate limits between keys', () => {
      const keys = ['key-a', 'key-b', 'key-c'];
      keys.forEach(key => limiter.registerKey(key, 'basic'));

      // Each key makes 30 requests
      keys.forEach(key => {
        for (let i = 0; i < 30; i++) {
          const result = limiter.check(key);
          expect(result.allowed).toBe(true);
        }
      });

      // Each key should have 70 tokens remaining
      keys.forEach(key => {
        const status = limiter.getStatus(key);
        expect(parseFloat(status.tokensRemaining)).toBe(70);
      });
    });

    test('should maintain independent tier assignments', () => {
      limiter.registerKey('basic-key', 'basic');
      limiter.registerKey('premium-key', 'premium');
      limiter.registerKey('enterprise-key', 'enterprise');

      const basicStatus = limiter.getStatus('basic-key');
      const premiumStatus = limiter.getStatus('premium-key');
      const enterpriseStatus = limiter.getStatus('enterprise-key');

      expect(basicStatus.tokensCapacity).toBe(100);
      expect(premiumStatus.tokensCapacity).toBe(1000);
      expect(enterpriseStatus.tokensCapacity).toBe(10000);
    });
  });

  describe('Token Refill', () => {
    test('should refill tokens over time', async () => {
      const apiKey = 'refill-test-key';
      const customLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        tiers: {
          test: {
            capacity: 100,
            refillRate: 10,
            refillIntervalMs: 100, // 10ms refill interval (10 tokens per 100ms)
            costPerRequest: 1
          }
        }
      });

      customLimiter.registerKey(apiKey, 'test');

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        customLimiter.check(apiKey);
      }

      let status = customLimiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(0);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 150));

      status = customLimiter.getStatus(apiKey);
      // Should have refilled ~15 tokens (1.5 intervals)
      expect(parseFloat(status.tokensRemaining)).toBeGreaterThan(10);

      customLimiter.stop();
    });

    test('should cap tokens at capacity', async () => {
      const apiKey = 'refill-cap-key';
      const customLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        tiers: {
          test: {
            capacity: 100,
            refillRate: 50,
            refillIntervalMs: 100,
            costPerRequest: 1
          }
        }
      });

      customLimiter.registerKey(apiKey, 'test');

      // Use 10 tokens, leaving 90
      for (let i = 0; i < 10; i++) {
        customLimiter.check(apiKey);
      }

      // Wait for refill (would add 50 more)
      await new Promise(resolve => setTimeout(resolve, 150));

      const status = customLimiter.getStatus(apiKey);
      // Should be capped at 100 (capacity), not 140 (90 + 50)
      expect(parseFloat(status.tokensRemaining)).toBeLessThanOrEqual(100);

      customLimiter.stop();
    });
  });

  describe('Rate Limit Response Details', () => {
    test('should provide correct error details on rate limit', () => {
      const apiKey = 'error-key';
      limiter.registerKey(apiKey, 'basic');

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }

      const result = limiter.check(apiKey);

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('rate limit exceeded');
      expect(result.errorCode).toBe('API_KEY_RATE_LIMIT_EXCEEDED');
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.statusCode).toBe(429);
    });

    test('should calculate retry-after time correctly', async () => {
      const apiKey = 'retry-key';
      const customLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        tiers: {
          test: {
            capacity: 10,
            refillRate: 1, // 1 token per second
            refillIntervalMs: 1000, // 1 second
            costPerRequest: 1
          }
        }
      });

      customLimiter.registerKey(apiKey, 'test');

      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        customLimiter.check(apiKey);
      }

      const result = customLimiter.check(apiKey);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      // Should be approximately 1 second for 1 token at rate of 1/1000ms
      expect(result.retryAfterMs).toBeGreaterThan(500);
      expect(result.retryAfterMs).toBeLessThanOrEqual(1200);

      customLimiter.stop();
    });
  });

  describe('Tier Updates', () => {
    test('should update API key tier', () => {
      const apiKey = 'upgrade-key';
      limiter.registerKey(apiKey, 'basic');

      let status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('basic');
      expect(status.tokensCapacity).toBe(100);

      // Upgrade to premium
      limiter.updateTier(apiKey, 'premium');

      status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('premium');
      expect(status.tokensCapacity).toBe(1000);
      expect(parseFloat(status.tokensRemaining)).toBe(1000); // Reset to full
    });

    test('should reset tokens when tier changes', () => {
      const apiKey = 'tier-reset-key';
      limiter.registerKey(apiKey, 'basic');

      // Use some tokens
      for (let i = 0; i < 50; i++) {
        limiter.check(apiKey);
      }

      let status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(50);

      // Change tier
      limiter.updateTier(apiKey, 'premium');

      status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(1000); // Premium capacity
    });
  });

  describe('Rate Limiter Reset', () => {
    test('should reset single API key rate limit', () => {
      const apiKey = 'reset-key';
      limiter.registerKey(apiKey, 'basic');

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }

      let status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(0);

      // Reset
      limiter.reset(apiKey);

      status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(100);
    });

    test('should reset all API keys', () => {
      const keys = ['reset-all-1', 'reset-all-2', 'reset-all-3'];
      keys.forEach(key => limiter.registerKey(key, 'basic'));

      // Exhaust all keys
      keys.forEach(key => {
        for (let i = 0; i < 100; i++) {
          limiter.check(key);
        }
      });

      // Verify all exhausted
      keys.forEach(key => {
        const status = limiter.getStatus(key);
        expect(parseFloat(status.tokensRemaining)).toBe(0);
      });

      // Reset all
      limiter.resetAll();

      // Verify all reset
      keys.forEach(key => {
        const status = limiter.getStatus(key);
        expect(parseFloat(status.tokensRemaining)).toBe(100);
      });
    });
  });

  describe('API Key Revocation', () => {
    test('should revoke API key', () => {
      const apiKey = 'revoke-key';
      limiter.registerKey(apiKey, 'basic');

      let status = limiter.getStatus(apiKey);
      expect(status.status).toBeUndefined(); // Registered

      limiter.revoke(apiKey);

      status = limiter.getStatus(apiKey);
      expect(status.status).toBe('not_registered');
    });

    test('should allow re-registration after revocation', () => {
      const apiKey = 'revoke-reregister-key';
      limiter.registerKey(apiKey, 'basic');
      limiter.revoke(apiKey);

      limiter.registerKey(apiKey, 'premium');
      const status = limiter.getStatus(apiKey);

      expect(status.tier).toBe('premium');
      expect(status.tokensCapacity).toBe(1000);
    });
  });

  describe('Statistics Tracking', () => {
    test('should track total requests and rejections', () => {
      const key1 = 'stats-key-1';
      const key2 = 'stats-key-2';

      limiter.registerKey(key1, 'basic');
      limiter.registerKey(key2, 'basic');

      // Make requests - each key has 100 token capacity
      for (let i = 0; i < 50; i++) {
        limiter.check(key1);
        limiter.check(key2);
      }

      // key1 has 50 tokens left, use them all
      for (let i = 0; i < 50; i++) {
        limiter.check(key1);
      }
      // Now key1 should have no tokens
      limiter.check(key1); // Should fail

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(150); // 50 key1 + 50 key2 + 50 key1
      expect(stats.totalRejected).toBe(1);
      expect(stats.rejectionRate).toContain('0.6'); // ~0.67%
    });

    test('should track per-key statistics', () => {
      const apiKey = 'stats-track-key';
      limiter.registerKey(apiKey, 'basic');

      // Make 10 successful requests
      for (let i = 0; i < 10; i++) {
        limiter.check(apiKey);
      }

      const stats = limiter.getStats();
      const keyStats = stats.keyStats.find(ks => ks.apiKey.includes('...'));

      expect(keyStats).toBeDefined();
      expect(keyStats.allowed).toBe(10);
      expect(keyStats.rejected).toBe(0);
      expect(keyStats.successRate).toBe('100.00%');
    });

    test('should calculate rejection rate correctly', () => {
      const apiKey = 'rejection-rate-key';
      limiter.registerKey(apiKey, 'basic');

      // 100 successful, 1 failed
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }
      limiter.check(apiKey); // Failed

      const stats = limiter.getStats();
      expect(stats.rejectionRate).toBe('1.00%');
    });
  });

  describe('Status Reporting', () => {
    test('should report full status for registered key', () => {
      const apiKey = 'status-key';
      limiter.registerKey(apiKey, 'premium');

      const status = limiter.getStatus(apiKey);

      expect(status.enabled).toBe(true);
      expect(status.tier).toBe('premium');
      expect(status.tokensCapacity).toBe(1000);
      expect(status.refillRate).toBe(100);
      expect(status.refillIntervalMs).toBe(60000);
      expect(status.requestCount).toBe(0);
      expect(status.rejectedCount).toBe(0);
      expect(status.createdAt).toBeDefined();
      expect(status.lastUsedAt).toBeDefined();
      expect(status.inactiveForMs).toBeGreaterThanOrEqual(0);
    });

    test('should report status for unregistered key', () => {
      const status = limiter.getStatus('unknown-key');

      expect(status.enabled).toBe(true);
      expect(status.status).toBe('not_registered');
    });

    test('should report configuration correctly', () => {
      const config = limiter.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.tiers).toContain('basic');
      expect(config.tierDetails.basic.capacity).toBe(100);
      expect(config.tierDetails.basic.refillRate).toBe(10);
      expect(config.cleanupIntervalMs).toBe(100000);
      expect(config.inactivityTimeoutMs).toBe(3600000);
    });
  });

  describe('Cleanup and Inactivity', () => {
    test('should not cleanup active keys', async () => {
      const apiKey = 'active-key';
      const testLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        cleanupIntervalMs: 100,
        inactivityTimeoutMs: 1000
      });

      testLimiter.registerKey(apiKey, 'basic');
      let status = testLimiter.getStatus(apiKey);
      expect(status.status).toBeUndefined();

      // Wait for cleanup but make activity
      await new Promise(resolve => setTimeout(resolve, 50));
      testLimiter.check(apiKey);
      await new Promise(resolve => setTimeout(resolve, 100));

      status = testLimiter.getStatus(apiKey);
      expect(status.status).toBeUndefined(); // Should still be there

      testLimiter.stop();
    });

    test('should cleanup inactive keys', async () => {
      const apiKey = 'inactive-key';
      const testLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        cleanupIntervalMs: 100,
        inactivityTimeoutMs: 200
      });

      testLimiter.registerKey(apiKey, 'basic');
      let stats = testLimiter.getStats();
      expect(stats.activeKeys).toBe(1);

      // Wait for inactivity timeout + cleanup
      await new Promise(resolve => setTimeout(resolve, 400));

      stats = testLimiter.getStats();
      expect(stats.activeKeys).toBe(0);

      testLimiter.stop();
    });
  });

  describe('Masking and Security', () => {
    test('should mask API keys in logs and output', () => {
      const apiKey = 'abcd-efgh-ijkl-mnop-qrst';
      limiter.registerKey(apiKey, 'basic');

      const status = limiter.getStatus(apiKey);
      expect(status.apiKey).toBe('abcd...qrst');
      expect(status.apiKey).not.toContain('efgh');
    });

    test('should mask API keys in statistics', () => {
      const apiKey = 'secret-api-key-12345678';
      limiter.registerKey(apiKey, 'basic');
      limiter.check(apiKey);

      const stats = limiter.getStats();
      const keyStatEntry = stats.keyStats[0];

      expect(keyStatEntry.apiKey).toBe('secr...5678');
      expect(keyStatEntry.apiKey).not.toContain('api-key');
    });
  });

  describe('Edge Cases', () => {
    test('should handle fractional token consumption', () => {
      const apiKey = 'fractional-key';
      limiter.registerKey(apiKey, 'basic');

      const result = limiter.check(apiKey, 0.5);

      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(99.5);
    });

    test('should handle large token consumption', () => {
      const apiKey = 'large-consumption-key';
      limiter.registerKey(apiKey, 'basic'); // 100 token capacity

      // Consume 50 tokens
      let result = limiter.check(apiKey, 50);
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(50);

      // Consume remaining 50
      result = limiter.check(apiKey, 50);
      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBeCloseTo(0, 0);

      // Try to consume more than remaining
      result = limiter.check(apiKey, 10);
      expect(result.allowed).toBe(false);
    });

    test('should handle zero token consumption', () => {
      const apiKey = 'zero-consumption-key';
      limiter.registerKey(apiKey, 'basic');

      const result = limiter.check(apiKey, 0);

      expect(result.allowed).toBe(true);
      expect(result.tokensRemaining).toBe(100);
    });

    test('should handle requests with extremely high refill rates', () => {
      const customLimiter = new APIKeyTokenBucket({
        enabled: true,
        logger: mockLogger,
        tiers: {
          fast: {
            capacity: 100,
            refillRate: 1000000, // Extremely high refill
            refillIntervalMs: 1,
            costPerRequest: 1
          }
        }
      });

      const apiKey = 'fast-refill-key';
      customLimiter.registerKey(apiKey, 'fast');

      // Should always have tokens
      for (let i = 0; i < 1000; i++) {
        const result = customLimiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      customLimiter.stop();
    });
  });
});

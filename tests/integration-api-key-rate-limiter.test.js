/**
 * Integration Tests for APIKeyTokenBucket Rate Limiter
 * Tests per-key rate limiting in realistic scenarios
 *
 * @module tests/integration-api-key-rate-limiter.test.js
 */

const { APIKeyTokenBucket } = require('../websocket/rate-limiter');

// Mock logger
const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

describe('APIKeyTokenBucket - Integration Tests', () => {
  let limiter;

  beforeEach(() => {
    limiter = new APIKeyTokenBucket({
      enabled: true,
      logger: mockLogger,
      cleanupIntervalMs: 100000
    });
  });

  afterEach(() => {
    if (limiter) {
      limiter.stop();
    }
  });

  describe('Multi-User Rate Limiting Scenario', () => {
    test('should handle multiple users independently', () => {
      const users = [
        { key: 'user-001', tier: 'basic' },
        { key: 'user-002', tier: 'premium' },
        { key: 'user-003', tier: 'enterprise' }
      ];

      users.forEach(user => {
        limiter.registerKey(user.key, user.tier);
      });

      // Simulate concurrent-like usage pattern
      const results = {
        'user-001': { allowed: 0, rejected: 0 },
        'user-002': { allowed: 0, rejected: 0 },
        'user-003': { allowed: 0, rejected: 0 }
      };

      // Basic tier: 100 tokens
      for (let i = 0; i < 100; i++) {
        const result = limiter.check('user-001');
        if (result.allowed) results['user-001'].allowed++;
        else results['user-001'].rejected++;
      }
      const basicLimited = limiter.check('user-001');
      if (!basicLimited.allowed) results['user-001'].rejected++;

      // Premium tier: 1000 tokens
      for (let i = 0; i < 500; i++) {
        const result = limiter.check('user-002');
        if (result.allowed) results['user-002'].allowed++;
        else results['user-002'].rejected++;
      }
      const premiumStatus = limiter.getStatus('user-002');
      expect(parseFloat(premiumStatus.tokensRemaining)).toBeGreaterThan(400);

      // Enterprise tier: 10000 tokens
      for (let i = 0; i < 2000; i++) {
        const result = limiter.check('user-003');
        if (result.allowed) results['user-003'].allowed++;
        else results['user-003'].rejected++;
      }
      const enterpriseStatus = limiter.getStatus('user-003');
      expect(parseFloat(enterpriseStatus.tokensRemaining)).toBeGreaterThan(7900);

      expect(results['user-001'].allowed).toBe(100);
      expect(results['user-001'].rejected).toBe(1);
      expect(results['user-002'].allowed).toBe(500);
      expect(results['user-003'].allowed).toBe(2000);
    });

    test('should upgrade user tier without affecting others', () => {
      const basicKey = 'basic-user';
      const premiumKey = 'premium-user';

      limiter.registerKey(basicKey, 'basic');
      limiter.registerKey(premiumKey, 'premium');

      // Basic user exhausts tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(basicKey);
      }

      const basicBeforeUpgrade = limiter.getStatus(basicKey);
      expect(parseFloat(basicBeforeUpgrade.tokensRemaining)).toBe(0);

      // Upgrade basic user to premium
      limiter.updateTier(basicKey, 'premium');

      // Both users should now have full premium tokens
      const basicAfterUpgrade = limiter.getStatus(basicKey);
      const premium = limiter.getStatus(premiumKey);

      expect(parseFloat(basicAfterUpgrade.tokensRemaining)).toBe(1000);
      expect(parseFloat(premium.tokensRemaining)).toBe(1000); // Unaffected
    });

    test('should revoke key without affecting others', () => {
      const key1 = 'revoke-test-1';
      const key2 = 'revoke-test-2';

      limiter.registerKey(key1, 'basic');
      limiter.registerKey(key2, 'basic');

      limiter.check(key1);
      limiter.check(key2);

      // Revoke key1
      limiter.revoke(key1);

      // key1 should be unregistered
      const status1 = limiter.getStatus(key1);
      expect(status1.status).toBe('not_registered');

      // key2 should still work
      const status2 = limiter.getStatus(key2);
      expect(status2.status).toBeUndefined(); // Registered
    });
  });

  describe('Rate Limit Burst Handling', () => {
    test('should handle burst requests within capacity', () => {
      const apiKey = 'burst-key';
      limiter.registerKey(apiKey, 'premium'); // 1000 tokens

      // Simulate burst of 500 requests
      const results = [];
      for (let i = 0; i < 500; i++) {
        results.push(limiter.check(apiKey));
      }

      // All should be allowed
      const allAllowed = results.every(r => r.allowed);
      expect(allAllowed).toBe(true);

      const status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(500);
    });

    test('should reject burst when exceeding capacity', () => {
      const apiKey = 'burst-limit-key';
      limiter.registerKey(apiKey, 'basic'); // 100 tokens

      const results = [];
      for (let i = 0; i < 150; i++) {
        results.push(limiter.check(apiKey));
      }

      const allowed = results.filter(r => r.allowed).length;
      const rejected = results.filter(r => !r.allowed).length;

      expect(allowed).toBe(100);
      expect(rejected).toBe(50);
    });

    test('should provide accurate retry-after for burst clients', () => {
      const apiKey = 'burst-retry-key';
      limiter.registerKey(apiKey, 'basic'); // 100 tokens

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }

      const result = limiter.check(apiKey);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.error).toContain('rate limit exceeded');
    });
  });

  describe('API Key Lifecycle', () => {
    test('should handle complete key lifecycle', () => {
      const apiKey = 'lifecycle-key';

      // 1. Register
      limiter.registerKey(apiKey, 'basic');
      let status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('basic');

      // 2. Use
      for (let i = 0; i < 50; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }
      status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(50);
      expect(status.requestCount).toBe(50);

      // 3. Upgrade
      limiter.updateTier(apiKey, 'premium');
      status = limiter.getStatus(apiKey);
      expect(status.tier).toBe('premium');
      expect(parseFloat(status.tokensRemaining)).toBe(1000);

      // 4. Continue use
      for (let i = 0; i < 500; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }
      status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBeCloseTo(500, 0);

      // 5. Reset
      limiter.reset(apiKey);
      status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBe(1000);

      // 6. Revoke
      limiter.revoke(apiKey);
      status = limiter.getStatus(apiKey);
      expect(status.status).toBe('not_registered');
    });

    test('should track request count across lifecycle', () => {
      const apiKey = 'count-track-key';
      limiter.registerKey(apiKey, 'basic');

      let status = limiter.getStatus(apiKey);
      expect(status.requestCount).toBe(0);

      // Make 25 successful requests
      for (let i = 0; i < 25; i++) {
        limiter.check(apiKey);
      }
      status = limiter.getStatus(apiKey);
      expect(status.requestCount).toBe(25);

      // Make 75 more successful and 10 rejected
      for (let i = 0; i < 75; i++) {
        limiter.check(apiKey);
      }
      for (let i = 0; i < 10; i++) {
        limiter.check(apiKey);
      }

      status = limiter.getStatus(apiKey);
      expect(status.requestCount).toBe(110);
      expect(status.rejectedCount).toBe(10);
    });
  });

  describe('Monitoring and Reporting', () => {
    test('should provide accurate statistics', () => {
      const keys = ['stat-key-1', 'stat-key-2', 'stat-key-3'];
      keys.forEach(key => limiter.registerKey(key, 'basic'));

      // Each key: 50 requests
      keys.forEach(key => {
        for (let i = 0; i < 50; i++) {
          limiter.check(key);
        }
      });

      const stats = limiter.getStats();

      expect(stats.totalRequests).toBe(150); // 50*3
      expect(stats.activeKeys).toBe(3);
      expect(stats.totalRejected).toBe(0);
    });

    test('should track per-key statistics', () => {
      const key1 = 'track-key-1';
      const key2 = 'track-key-2';

      limiter.registerKey(key1, 'basic');
      limiter.registerKey(key2, 'basic');

      // key1: 100 allowed requests
      for (let i = 0; i < 100; i++) {
        limiter.check(key1);
      }

      // key2: 50 allowed requests
      for (let i = 0; i < 50; i++) {
        limiter.check(key2);
      }

      const stats = limiter.getStats();

      expect(stats.totalRequests).toBe(150);
      expect(stats.activeKeys).toBe(2);
      expect(stats.keyStats.length).toBe(2);

      // Both keys should have successful requests
      const allSuccessful = stats.keyStats.every(ks => ks.rejected === 0);
      expect(allSuccessful).toBe(true);
    });

    test('should expose configuration for monitoring', () => {
      const config = limiter.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.tiers).toContain('basic');
      expect(config.tiers).toContain('premium');
      expect(config.tierDetails.basic.capacity).toBe(100);
      expect(config.tierDetails.premium.capacity).toBe(1000);
      expect(config.cleanupIntervalMs).toBe(100000);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle 100 concurrent keys efficiently', () => {
      const keyCount = 100;
      const keysPerTier = 33;

      // Register keys across tiers
      for (let i = 0; i < keysPerTier; i++) {
        limiter.registerKey(`key-basic-${i}`, 'basic');
        limiter.registerKey(`key-premium-${i}`, 'premium');
        limiter.registerKey(`key-enterprise-${i}`, 'enterprise');
      }

      // Make 10 requests from each key
      for (let i = 0; i < keysPerTier; i++) {
        for (let j = 0; j < 10; j++) {
          limiter.check(`key-basic-${i}`);
          limiter.check(`key-premium-${i}`);
          limiter.check(`key-enterprise-${i}`);
        }
      }

      const stats = limiter.getStats();

      // 99 keys (99 = 33*3, but we use 100 total for the test)
      expect(stats.activeKeys).toBeGreaterThan(90);
      expect(stats.totalRequests).toBe(990); // 10*99
    });

    test('should maintain isolation under concurrent access pattern', () => {
      const keys = Array.from({ length: 10 }, (_, i) => `perf-key-${i}`);
      keys.forEach(key => limiter.registerKey(key, 'basic'));

      // Simulate interleaved access
      for (let round = 0; round < 10; round++) {
        keys.forEach((key, idx) => {
          limiter.check(key);
        });
      }

      // Each key should have 10 requests and 90 tokens remaining
      keys.forEach((key, idx) => {
        const status = limiter.getStatus(key);
        expect(status.requestCount).toBe(10);
        expect(parseFloat(status.tokensRemaining)).toBe(90);
      });
    });
  });

  describe('Error Scenarios', () => {
    test('should handle key not found gracefully', () => {
      const status = limiter.getStatus('non-existent-key');

      expect(status.enabled).toBe(true);
      expect(status.status).toBe('not_registered');
    });

    test('should handle reset on non-existent key', () => {
      // Should not throw
      limiter.reset('non-existent-key');

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
    });

    test('should handle status request on revoked key', () => {
      const apiKey = 'revoke-status-key';
      limiter.registerKey(apiKey, 'basic');
      limiter.revoke(apiKey);

      const status = limiter.getStatus(apiKey);
      expect(status.status).toBe('not_registered');
    });

    test('should provide meaningful error messages', () => {
      const apiKey = 'error-msg-key';
      limiter.registerKey(apiKey, 'basic');

      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        limiter.check(apiKey);
      }

      const result = limiter.check(apiKey);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('rate limit exceeded');
      expect(result.error).toContain('basic');
      expect(result.errorCode).toBe('API_KEY_RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Tier-Specific Behavior', () => {
    test('should respect basic tier limits', () => {
      const apiKey = 'tier-basic-key';
      limiter.registerKey(apiKey, 'basic');

      for (let i = 0; i < 100; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.check(apiKey);
      expect(result.allowed).toBe(false);
    });

    test('should respect premium tier limits', () => {
      const apiKey = 'tier-premium-key';
      limiter.registerKey(apiKey, 'premium');

      // Should allow 1000 requests
      for (let i = 0; i < 500; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
      }

      const status = limiter.getStatus(apiKey);
      expect(parseFloat(status.tokensRemaining)).toBeCloseTo(500, 0);
    });

    test('should allow unlimited requests for unlimited tier', () => {
      const apiKey = 'tier-unlimited-key';
      limiter.registerKey(apiKey, 'unlimited');

      for (let i = 0; i < 5000; i++) {
        const result = limiter.check(apiKey);
        expect(result.allowed).toBe(true);
        expect(result.unlimited).toBe(true);
      }
    });

    test('should show correct tier information in responses', () => {
      const tiers = ['basic', 'premium', 'enterprise', 'unlimited'];

      tiers.forEach(tier => {
        const apiKey = `tier-info-${tier}`;
        limiter.registerKey(apiKey, tier);

        const result = limiter.check(apiKey);
        expect(result.tier).toBe(tier);

        const status = limiter.getStatus(apiKey);
        expect(status.tier).toBe(tier);
      });
    });
  });
});

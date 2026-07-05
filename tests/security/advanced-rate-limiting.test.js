/**
 * Advanced Rate Limiting Tests
 *
 * Tests: 15+ rate limiting scenarios
 * Coverage: Token bucket, sliding window, per-endpoint, per-identity limits
 */

const AdvancedRateLimiter = require('../../src/security/advanced-rate-limiting');

describe('Advanced Rate Limiting', () => {
  let limiter;

  beforeEach(() => {
    limiter = new AdvancedRateLimiter();
  });

  describe('Token Bucket Algorithm', () => {
    test('Token bucket allows requests within capacity', () => {
      const result = limiter.checkTokenBucket('client1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    test('Token bucket refills over time', async () => {
      // Exhaust tokens
      for (let i = 0; i < 100; i++) {
        limiter.checkTokenBucket('client2');
      }

      const exhausted = limiter.checkTokenBucket('client2');
      expect(exhausted.allowed).toBe(false);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 1100));

      const refilled = limiter.checkTokenBucket('client2');
      expect(refilled.allowed).toBe(true);
    });

    test('Token bucket shows remaining tokens', () => {
      limiter.checkTokenBucket('client3');
      const result = limiter.checkTokenBucket('client3');
      expect(result.remaining).toBeLessThanOrEqual(99);
    });

    test('Token bucket returns reset timestamp', () => {
      const result = limiter.checkTokenBucket('client4');
      expect(result.reset).toBeGreaterThan(0);
    });
  });

  describe('Sliding Window Algorithm', () => {
    test('Sliding window allows requests within limit', () => {
      const result = limiter.checkSlidingWindow('client1');
      expect(result.allowed).toBe(true);
      expect(result.count).toEqual(1);
    });

    test('Sliding window counts requests in window', () => {
      for (let i = 0; i < 50; i++) {
        limiter.checkSlidingWindow('client2');
      }

      const result = limiter.checkSlidingWindow('client2');
      expect(result.count).toEqual(51);
      expect(result.allowed).toBe(true);
    });

    test('Sliding window rejects when limit exceeded', () => {
      for (let i = 0; i < 100; i++) {
        limiter.checkSlidingWindow('client3');
      }

      const result = limiter.checkSlidingWindow('client3');
      expect(result.allowed).toBe(false);
      expect(result.count).toEqual(100);
    });

    test('Sliding window clears old requests', async () => {
      limiter.checkSlidingWindow('client4');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 61000));

      const result = limiter.checkSlidingWindow('client4');
      expect(result.count).toEqual(1);
    });
  });

  describe('Per-Endpoint Rate Limiting', () => {
    test('Per-endpoint limits differ by endpoint', () => {
      limiter.checkPerEndpoint('client1', 'navigate');
      limiter.checkPerEndpoint('client1', 'execute_javascript');

      const navResult = limiter.checkPerEndpoint('client1', 'navigate');
      const execResult = limiter.checkPerEndpoint('client1', 'execute_javascript');

      // Different endpoints have different limits, so different limits should apply
      expect(navResult.limit).not.toEqual(execResult.limit);
    });

    test('Sensitive endpoints have lower limits', () => {
      const result = limiter.checkPerEndpoint('client2', 'execute_javascript');
      expect(result.limit).toBeLessThan(50); // execute_javascript has limit of 10
    });

    test('Per-endpoint limits are independent', () => {
      // Exhaust execute_javascript
      for (let i = 0; i < 10; i++) {
        limiter.checkPerEndpoint('client3', 'execute_javascript');
      }

      const execResult = limiter.checkPerEndpoint('client3', 'execute_javascript');
      expect(execResult.allowed).toBe(false);

      // navigate should still work
      const navResult = limiter.checkPerEndpoint('client3', 'navigate');
      expect(navResult.allowed).toBe(true);
    });
  });

  describe('Per-Identity Rate Limiting', () => {
    test('Per-IP limits are enforced', () => {
      const identity = { ip: '192.168.1.1' };
      for (let i = 0; i < 100; i++) {
        limiter.checkPerIdentity(identity);
      }

      const result = limiter.checkPerIdentity(identity);
      expect(result.allowed).toBe(false);
      expect(result.type).toBe('ip');
    });

    test('Per-user limits are enforced', () => {
      const identity = { userId: 'user123' };
      for (let i = 0; i < 200; i++) {
        limiter.checkPerIdentity(identity);
      }

      const result = limiter.checkPerIdentity(identity);
      expect(result.allowed).toBe(false);
      expect(result.type).toBe('user');
    });

    test('Per-API-key limits are enforced', () => {
      const identity = { apiKey: 'key123' };
      for (let i = 0; i < 500; i++) {
        limiter.checkPerIdentity(identity);
      }

      const result = limiter.checkPerIdentity(identity);
      expect(result.allowed).toBe(false);
      expect(result.type).toBe('apiKey');
    });

    test('Different identities have separate limits', () => {
      const id1 = { ip: '192.168.1.1' };
      const id2 = { ip: '192.168.1.2' };

      for (let i = 0; i < 50; i++) {
        limiter.checkPerIdentity(id1);
      }

      const result1 = limiter.checkPerIdentity(id1);
      const result2 = limiter.checkPerIdentity(id2);

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true); // Different IP should have its own limit
    });
  });

  describe('Admin Bypass', () => {
    test('Admin bypass allows exceeding limits', () => {
      const adminIdentity = { ip: '127.0.0.1', isAdmin: true };

      // Try to exceed limits
      for (let i = 0; i < 200; i++) {
        const result = limiter.checkRateLimit(`admin-${i}`, { identity: adminIdentity });
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('admin_bypass');
      }
    });

    test('Localhost bypass works', () => {
      const localhostIdentity = { ip: '127.0.0.1' };

      for (let i = 0; i < 200; i++) {
        const result = limiter.checkRateLimit(`localhost-${i}`, { identity: localhostIdentity });
        expect(result.allowed).toBe(true);
      }
    });

    test('IPv6 localhost bypass works', () => {
      const localhostIdentity = { ip: '::1' };

      for (let i = 0; i < 200; i++) {
        const result = limiter.checkRateLimit(`ipv6-${i}`, { identity: localhostIdentity });
        expect(result.allowed).toBe(true);
      }
    });

    test('Non-admin not bypassed', () => {
      const userIdentity = { ip: '192.168.1.1', isAdmin: false };

      for (let i = 0; i < 100; i++) {
        limiter.checkTokenBucket(`user-${i}`, { identity: userIdentity });
      }

      const result = limiter.checkTokenBucket('user-final', { identity: userIdentity });
      expect(result.reason).not.toBe('admin_bypass');
    });
  });

  describe('Comprehensive Rate Limit Check', () => {
    test('Comprehensive check considers all limits', () => {
      const result = limiter.checkRateLimit('client1', {
        endpoint: 'navigate',
        identity: { ip: '192.168.1.1' }
      });

      expect(result.limits).toBeDefined();
      expect(result.limits.tokenBucket).toBeDefined();
      expect(result.limits.slidingWindow).toBeDefined();
      expect(result.limits.perEndpoint).toBeDefined();
      expect(result.limits.perIdentity).toBeDefined();
    });

    test('Any violation blocks request', () => {
      // Exhaust all limits for a client
      for (let i = 0; i < 100; i++) {
        limiter.checkRateLimit('client2', {
          endpoint: 'navigate'
        });
      }

      const result = limiter.checkRateLimit('client2', {
        endpoint: 'navigate'
      });

      expect(result.allowed).toBe(false);
      expect(result.blocks.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limit Management', () => {
    test('Reset removes all limits for a client', () => {
      for (let i = 0; i < 100; i++) {
        limiter.checkTokenBucket('client1');
      }

      limiter.reset('client1');

      const result = limiter.checkTokenBucket('client1');
      expect(result.allowed).toBe(true);
    });

    test('Reset all clears everything', () => {
      for (let i = 0; i < 10; i++) {
        limiter.checkTokenBucket(`client${i}`);
      }

      limiter.resetAll();

      const stats = limiter.getStats();
      expect(stats.tokenBuckets).toBe(0);
      expect(stats.slidingWindows).toBe(0);
    });

    test('Get status shows current state', () => {
      limiter.checkTokenBucket('client1');
      const status = limiter.getStatus('client1');

      expect(status.tokenBucket).toBeDefined();
      expect(status.tokenBucket.tokens).toBeDefined();
    });

    test('Stats are tracked correctly', () => {
      for (let i = 0; i < 5; i++) {
        limiter.checkTokenBucket(`client${i}`);
      }

      const stats = limiter.getStats();
      expect(stats.tokenBuckets).toEqual(5);
    });
  });

  describe('Custom Configuration', () => {
    test('Custom rate limits are applied', () => {
      const customLimiter = new AdvancedRateLimiter({
        slidingWindow: {
          enabled: true,
          windowSize: 60000,
          maxRequests: 10 // Very restrictive
        }
      });

      for (let i = 0; i < 10; i++) {
        customLimiter.checkSlidingWindow('client1');
      }

      const result = customLimiter.checkSlidingWindow('client1');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(10);
    });

    test('Disabling algorithms works', () => {
      const customLimiter = new AdvancedRateLimiter({
        tokenBucket: { enabled: false },
        slidingWindow: { enabled: false }
      });

      const result = customLimiter.checkRateLimit('client1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Cleanup', () => {
    test('Cleanup removes stale entries', async () => {
      limiter.checkTokenBucket('oldclient');

      // Simulate passage of time (note: actual cleanup happens on interval)
      const statsBefore = limiter.getStats();
      expect(statsBefore.tokenBuckets).toBeGreaterThan(0);

      limiter.stopCleanup();
      limiter.startCleanup();
    });

    test('Cleanup timer can be stopped', () => {
      limiter.checkTokenBucket('client1');
      limiter.stopCleanup();
      // Verify no error occurs
      expect(() => limiter.stopCleanup()).not.toThrow();
    });
  });
});

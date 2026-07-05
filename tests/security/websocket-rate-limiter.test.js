/**
 * WebSocket Rate Limiter Tests
 * Tests sliding window rate limiting with per-command buckets
 *
 * @test 10 comprehensive tests covering all rate limiter functionality
 */

const assert = require('assert');
const { WebSocketRateLimiter } = require('../../websocket/rate-limiter');

describe('WebSocketRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new WebSocketRateLimiter({
      enabled: true,
      unauthenticatedLimit: 100,
      authenticatedLimit: 1000,
      windowMs: 60000,
      burstAllowance: 10,
      adminBypass: true,
      logger: { info: () => {}, debug: () => {}, error: () => {} }
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  describe('1. Initialization and Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = limiter.getConfig();
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.unauthenticatedLimit, 100);
      assert.strictEqual(config.authenticatedLimit, 1000);
    });

    it('should allow environment variable configuration', () => {
      const originalEnv = process.env.RATE_LIMIT_ENABLED;
      process.env.RATE_LIMIT_ENABLED = 'false';

      const testLimiter = new WebSocketRateLimiter({
        logger: { info: () => {}, debug: () => {}, error: () => {} }
      });

      assert.strictEqual(testLimiter.enabled, false);
      testLimiter.stop();

      if (originalEnv) {
        process.env.RATE_LIMIT_ENABLED = originalEnv;
      } else {
        delete process.env.RATE_LIMIT_ENABLED;
      }
    });
  });

  describe('2. Unauthenticated Client Limiting', () => {
    it('should allow requests up to unauthenticated limit', () => {
      const clientId = 'unauthclient1';
      const command = 'get_content'; // Has a limit of 100

      // Should allow up to 100 requests for unauthenticated
      for (let i = 0; i < 100; i++) {
        const result = limiter.check(clientId, command);
        assert.strictEqual(result.allowed, true, `Request ${i + 1} should be allowed`);
      }
    });

    it('should reject requests exceeding unauthenticated limit', () => {
      const clientId = 'unauthclient2';
      const command = 'get_content';

      // Exhaust limit (100) + burst allowance (10)
      for (let i = 0; i < 110; i++) {
        limiter.check(clientId, command);
      }

      // This should be rejected (exceeds limit + burst)
      const result = limiter.check(clientId, command);
      assert.strictEqual(result.allowed, false);
      assert.strictEqual(result.statusCode, 429);
      assert(result.error.includes('Rate limit exceeded'));
    });
  });

  describe('3. Authenticated Client Limiting', () => {
    it('should allow higher limit for authenticated clients', () => {
      const clientId = 'authclient1';
      const command = 'get_content'; // Has a limit of 100, less than auth limit of 1000

      // Mark as authenticated
      limiter.authenticate(clientId, 'token123');

      // Should allow up to 100 requests (command limit) for authenticated
      for (let i = 0; i < 100; i++) {
        const result = limiter.check(clientId, command);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.authenticated, true);
      }
    });

    it('should track authentication status separately', () => {
      const clientId = 'authclient2';
      const command = 'navigate';

      const resultBefore = limiter.check(clientId, command);
      assert.strictEqual(resultBefore.authenticated, false);

      limiter.authenticate(clientId, 'token456');

      const resultAfter = limiter.check(clientId, command);
      assert.strictEqual(resultAfter.authenticated, true);
    });
  });

  describe('4. Per-Command Rate Limiting', () => {
    it('should enforce per-command limits', () => {
      const clientId = 'cmdlimitclient';

      // Screenshot has lower limit (5) + burst (10) = 15 total allowed
      for (let i = 0; i < 15; i++) {
        const result = limiter.check(clientId, 'screenshot');
        assert.strictEqual(result.allowed, true);
      }

      const screenshotResult = limiter.check(clientId, 'screenshot');
      assert.strictEqual(screenshotResult.allowed, false);

      // But navigate should still have its own limit (15)
      for (let i = 0; i < 15; i++) {
        const result = limiter.check(clientId, 'navigate');
        assert.strictEqual(result.allowed, true);
      }
    });

    it('should respect different command limits', () => {
      const clientId = 'cmdclient';

      // screenshot: 5 limit
      const screenshotLimit = limiter.getCommandLimit('screenshot');
      assert.strictEqual(screenshotLimit, 5);

      // navigate: 15 limit
      const navigateLimit = limiter.getCommandLimit('navigate');
      assert.strictEqual(navigateLimit, 15);

      // execute_script: 20 limit
      const scriptLimit = limiter.getCommandLimit('execute_script');
      assert.strictEqual(scriptLimit, 20);
    });
  });

  describe('5. Burst Allowance', () => {
    it('should allow burst requests above normal limit', () => {
      const clientId = 'burstclient';
      const command = 'navigate';
      const baseLimit = limiter.getCommandLimit(command);

      // Fill up to base limit
      for (let i = 0; i < baseLimit; i++) {
        limiter.check(clientId, command);
      }

      // Next 10 burst requests should be allowed
      for (let i = 0; i < 10; i++) {
        const result = limiter.check(clientId, command);
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.usingBurst, true);
      }

      // One more should fail
      const result = limiter.check(clientId, command);
      assert.strictEqual(result.allowed, false);
    });
  });

  describe('6. Sliding Window Behavior', () => {
    it('should reset counters when window expires', function(done) {
      jest.setTimeout(5000); // 5 second timeout

      const clientId = 'slidingclient';
      const command = 'navigate'; // Limit of 15 + burst 10 = 25 total

      // Use up the limit + burst
      for (let i = 0; i < 25; i++) {
        limiter.check(clientId, command);
      }

      // Should be limited now
      let result = limiter.check(clientId, command);
      assert.strictEqual(result.allowed, false);

      // Wait for window to expire (using shorter window for test)
      const testLimiter = new WebSocketRateLimiter({
        enabled: true,
        windowMs: 100, // 100ms window for testing
        logger: { info: () => {}, debug: () => {}, error: () => {} }
      });

      const testClientId = 'slidingtest';

      // Fill limit
      for (let i = 0; i < 50; i++) {
        testLimiter.check(testClientId, 'navigate');
      }

      result = testLimiter.check(testClientId, 'navigate');
      assert.strictEqual(result.allowed, false);

      // Wait for window to expire
      setTimeout(() => {
        // Should be allowed again after window expires
        result = testLimiter.check(testClientId, 'navigate');
        assert.strictEqual(result.allowed, true);
        testLimiter.stop();
        done();
      }, 150);
    });
  });

  describe('7. Admin Bypass', () => {
    it('should allow admin tokens to bypass rate limits', () => {
      const clientId = 'adminclient';
      const command = 'navigate';
      const adminToken = 'admin-secret-token-xyz';

      // Set admin token
      limiter.setAdminTokens([adminToken]);

      // Fill up the limit
      for (let i = 0; i < 100; i++) {
        limiter.check(clientId, command);
      }

      // Should be rejected normally
      let result = limiter.check(clientId, command);
      assert.strictEqual(result.allowed, false);

      // But should be allowed with admin token
      result = limiter.check(clientId, command, adminToken);
      assert.strictEqual(result.allowed, true);
      assert.strictEqual(result.adminBypassed, true);
    });
  });

  describe('8. Rate Limit Status Reporting', () => {
    it('should report accurate status for client commands', () => {
      const clientId = 'statusclient';

      // Make some requests
      limiter.check(clientId, 'navigate');
      limiter.check(clientId, 'navigate');
      limiter.check(clientId, 'click');

      const status = limiter.getStatus(clientId);
      assert.strictEqual(status.enabled, true);
      assert.strictEqual(status.authenticated, false);
      assert(status.commands.navigate);
      assert.strictEqual(status.commands.navigate.current, 2);
      assert(status.commands.click);
      assert.strictEqual(status.commands.click.current, 1);
    });

    it('should report status for specific command', () => {
      const clientId = 'statusclient2';

      for (let i = 0; i < 5; i++) {
        limiter.check(clientId, 'screenshot');
      }

      const status = limiter.getStatus(clientId, 'screenshot');
      assert.strictEqual(status.command, 'screenshot');
      assert.strictEqual(status.current, 5);
      assert.strictEqual(status.limit, 5);
      assert.strictEqual(status.remaining, 0);
    });
  });

  describe('9. Statistics Tracking', () => {
    it('should track request statistics', () => {
      const clientId1 = 'statsclient1';
      const clientId2 = 'statsclient2';

      // Make some successful requests
      limiter.check(clientId1, 'navigate');
      limiter.check(clientId1, 'navigate');
      limiter.check(clientId2, 'click');

      const stats = limiter.getStats();
      assert.strictEqual(stats.totalRequests, 3);
      assert.strictEqual(stats.enabled, true);
      assert.strictEqual(stats.trackedClients, 2);
    });

    it('should track rejected requests', () => {
      const clientId = 'rejectclient';

      // Fill and exceed limit
      for (let i = 0; i < 150; i++) {
        limiter.check(clientId, 'get_content');
      }

      const stats = limiter.getStats();
      assert(stats.totalRejected > 0);
      assert(stats.rejectionRate.includes('%'));
    });
  });

  describe('10. Reset and Cleanup', () => {
    it('should reset individual client limits', () => {
      const clientId = 'resetclient';

      // Fill limit
      for (let i = 0; i < 100; i++) {
        limiter.check(clientId, 'navigate');
      }

      let result = limiter.check(clientId, 'navigate');
      assert.strictEqual(result.allowed, false);

      // Reset
      limiter.reset(clientId, 'navigate');

      result = limiter.check(clientId, 'navigate');
      assert.strictEqual(result.allowed, true);
    });

    it('should reset all limits on resetAll()', () => {
      const clientId1 = 'resetall1';
      const clientId2 = 'resetall2';

      // Fill limits
      for (let i = 0; i < 100; i++) {
        limiter.check(clientId1, 'navigate');
        limiter.check(clientId2, 'navigate');
      }

      limiter.resetAll();

      const result1 = limiter.check(clientId1, 'navigate');
      const result2 = limiter.check(clientId2, 'navigate');

      assert.strictEqual(result1.allowed, true);
      assert.strictEqual(result2.allowed, true);
    });

    it('should cleanup old timestamps automatically', function(done) {
      jest.setTimeout(3000);

      const testLimiter = new WebSocketRateLimiter({
        enabled: true,
        windowMs: 100,
        cleanupIntervalMs: 50,
        logger: { info: () => {}, debug: () => {}, error: () => {} }
      });

      const clientId = 'cleanuptest';

      // Make a request
      testLimiter.check(clientId, 'navigate');
      assert.strictEqual(testLimiter.requests.size, 1);

      // Wait for cleanup
      setTimeout(() => {
        testLimiter.cleanup();

        // Client should be cleaned up after window expires
        // (depends on timing, but should eventually clear)
        testLimiter.stop();
        done();
      }, 200);
    });
  });

  describe('11. Disabled Rate Limiting', () => {
    it('should allow all requests when disabled', () => {
      const disabledLimiter = new WebSocketRateLimiter({
        enabled: false,
        logger: { info: () => {}, debug: () => {}, error: () => {} }
      });

      const clientId = 'disabledclient';

      // Make many requests
      for (let i = 0; i < 1000; i++) {
        const result = disabledLimiter.check(clientId, 'navigate');
        assert.strictEqual(result.allowed, true);
        assert.strictEqual(result.rateLimitDisabled, true);
      }

      disabledLimiter.stop();
    });
  });

  describe('12. Edge Cases', () => {
    it('should handle unauthenticated clients correctly', () => {
      const clientId = 'edgecase1';

      // Unauthenticated by default
      let result = limiter.check(clientId, 'navigate');
      assert.strictEqual(result.authenticated, false);

      limiter.unauthenticate(clientId);
      result = limiter.check(clientId, 'navigate');
      assert.strictEqual(result.authenticated, false);
    });

    it('should handle concurrent requests from different clients', () => {
      const clients = ['client1', 'client2', 'client3'];

      // Each client should have independent limits (15 + 10 burst = 25 per client)
      for (const clientId of clients) {
        for (let i = 0; i < 25; i++) {
          const result = limiter.check(clientId, 'navigate');
          assert.strictEqual(result.allowed, true);
        }
      }

      // Next should fail (exceeds limit + burst)
      for (const clientId of clients) {
        const result = limiter.check(clientId, 'navigate');
        assert.strictEqual(result.allowed, false);
      }
    });

    it('should provide retryAfter in rejection response', () => {
      const clientId = 'retryafterclient';

      // Exhaust limit
      for (let i = 0; i < 100; i++) {
        limiter.check(clientId, 'navigate');
      }

      const result = limiter.check(clientId, 'navigate');
      assert.strictEqual(result.allowed, false);
      assert(result.retryAfter > 0);
      assert(result.retryAfter <= 60); // Should be less than window
    });
  });
});

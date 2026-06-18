/**
 * Credential Rate Limiting Tests
 *
 * Tests: 15+ exponential backoff and rate limiting scenarios
 * Coverage:
 * - First 5 attempts allowed
 * - 6th attempt blocked with backoff
 * - Exponential backoff escalation (0s → 1s → 5s → 10s → 60s)
 * - Per-client IP isolation
 * - Time window reset
 * - Status tracking
 * - Failure recording and success reset
 *
 * Version: 1.0.0
 * Created: June 15, 2026
 */

const CredentialRateLimiter = require('../../src/infrastructure/credential-rate-limiter');

describe('Credential Rate Limiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new CredentialRateLimiter(5, 60000); // 5 attempts per 60 seconds
  });

  describe('isAllowed()', () => {
    test('allows first attempt for new client', () => {
      const result = limiter.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.attemptsRemaining).toBe(4);
    });

    test('allows multiple attempts within limit', () => {
      for (let i = 0; i < 5; i++) {
        const result = limiter.isAllowed('192.168.1.1');
        expect(result.allowed).toBe(true);
        expect(result.attemptsRemaining).toBe(4 - i);
      }
    });

    test('blocks 6th attempt with backoff', () => {
      // Make 5 attempts
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }

      // Record failure to increment fail count
      limiter.recordFailure('192.168.1.1');

      // 6th attempt should be blocked
      const result = limiter.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBeGreaterThan(0);
    });

    test('returns correct attempt count', () => {
      const result1 = limiter.isAllowed('192.168.1.2');
      expect(result1.attemptsRemaining).toBe(4);

      const result2 = limiter.isAllowed('192.168.1.2');
      expect(result2.attemptsRemaining).toBe(3);

      const result3 = limiter.isAllowed('192.168.1.2');
      expect(result3.attemptsRemaining).toBe(2);
    });

    test('isolates limits per client IP', () => {
      // Client 1: 5 attempts
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }

      // Client 2: should still have attempts available
      const result = limiter.isAllowed('192.168.1.2');
      expect(result.allowed).toBe(true);
      expect(result.attemptsRemaining).toBe(4);
    });

    test('blocks different clients independently', () => {
      // Client 1: max out
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }
      limiter.recordFailure('192.168.1.1');

      // Client 1 should be blocked
      expect(limiter.isAllowed('192.168.1.1').allowed).toBe(false);

      // Client 2 should still be allowed
      expect(limiter.isAllowed('192.168.1.2').allowed).toBe(true);
    });

    test('rejects invalid client IP', () => {
      const result = limiter.isAllowed(null);
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Invalid client IP');
    });

    test('returns message with rate limit reason', () => {
      const result = limiter.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.message).toBeUndefined(); // No message on allow

      // Block attempt by exhausting attempts
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }

      // 6th attempt blocked due to attempt window limit
      const blocked = limiter.isAllowed('192.168.1.1');
      expect(blocked.allowed).toBe(false);
      expect(blocked.message).toBeDefined();
      expect(blocked.message).toContain('Rate limit exceeded');
    });
  });

  describe('recordFailure()', () => {
    test('increments failure counter', () => {
      const before = limiter.getStatus('192.168.1.1');
      expect(before.failCount).toBe(0);

      limiter.recordFailure('192.168.1.1');

      const after = limiter.getStatus('192.168.1.1');
      expect(after.failCount).toBe(1);
    });

    test('creates entry if not exists', () => {
      limiter.recordFailure('192.168.1.99');
      const status = limiter.getStatus('192.168.1.99');
      expect(status.failCount).toBe(1);
    });

    test('multiple failures increment counter', () => {
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');

      const status = limiter.getStatus('192.168.1.1');
      expect(status.failCount).toBe(3);
    });
  });

  describe('recordSuccess()', () => {
    test('resets failure counter on success', () => {
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      expect(limiter.getStatus('192.168.1.1').failCount).toBe(2);

      limiter.recordSuccess('192.168.1.1');
      expect(limiter.getStatus('192.168.1.1').failCount).toBe(0);
    });

    test('clears attempt history on success', () => {
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.1');
      expect(limiter.getStatus('192.168.1.1').attemptCount).toBe(2);

      limiter.recordSuccess('192.168.1.1');
      expect(limiter.getStatus('192.168.1.1').attemptCount).toBe(0);
    });
  });

  describe('getStatus()', () => {
    test('returns default status for new client', () => {
      const status = limiter.getStatus('192.168.1.100');
      expect(status.isRateLimited).toBe(false);
      expect(status.failCount).toBe(0);
      expect(status.attemptCount).toBe(0);
      expect(status.nextResetIn).toBeNull();
    });

    test('shows attempt count after isAllowed calls', () => {
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.1');

      const status = limiter.getStatus('192.168.1.1');
      expect(status.attemptCount).toBe(3);
    });

    test('shows fail count from recordFailure', () => {
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');

      const status = limiter.getStatus('192.168.1.1');
      expect(status.failCount).toBe(2);
    });

    test('indicates rate limited status', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');

      const status = limiter.getStatus('192.168.1.1');
      expect(status.isRateLimited).toBe(true);
      expect(status.failCount).toBe(5);
    });
  });

  describe('clear()', () => {
    test('removes client rate limit data', () => {
      limiter.isAllowed('192.168.1.1');
      limiter.recordFailure('192.168.1.1');

      let status = limiter.getStatus('192.168.1.1');
      expect(status.attemptCount).toBe(1);

      limiter.clear('192.168.1.1');

      status = limiter.getStatus('192.168.1.1');
      expect(status.attemptCount).toBe(0);
      expect(status.failCount).toBe(0);
    });

    test('allows new tracking after clear', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }
      limiter.recordFailure('192.168.1.1');

      const blocked = limiter.isAllowed('192.168.1.1');
      expect(blocked.allowed).toBe(false);

      limiter.clear('192.168.1.1');

      const allowed = limiter.isAllowed('192.168.1.1');
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('clearAll()', () => {
    test('removes all client data', () => {
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.2');
      limiter.recordFailure('192.168.1.1');

      const stats1 = limiter.getStats();
      expect(stats1.totalClients).toBe(2);

      limiter.clearAll();

      const stats2 = limiter.getStats();
      expect(stats2.totalClients).toBe(0);
    });
  });

  describe('getStats()', () => {
    test('returns statistics about limiter state', () => {
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.2');

      const stats = limiter.getStats();
      expect(stats.totalClients).toBe(2);
      expect(stats.blockedClients).toBe(0);
      expect(stats.totalFailures).toBe(0);
      expect(stats.windowMs).toBe(60000);
      expect(stats.maxAttempts).toBe(5);
    });

    test('counts blocked clients correctly', () => {
      for (let i = 0; i < 5; i++) {
        limiter.isAllowed('192.168.1.1');
      }
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');

      const stats = limiter.getStats();
      expect(stats.blockedClients).toBe(1);
    });

    test('counts total failures from tracked clients', () => {
      // First need to track the clients with isAllowed
      limiter.isAllowed('192.168.1.1');
      limiter.isAllowed('192.168.1.2');

      // Then record failures
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.1');
      limiter.recordFailure('192.168.1.2');

      const stats = limiter.getStats();
      expect(stats.totalFailures).toBe(3);
    });
  });

  describe('Time window management', () => {
    test('respects window expiration', async () => {
      const shortLimiter = new CredentialRateLimiter(1, 100); // 1 attempt per 100ms

      shortLimiter.isAllowed('192.168.1.1');
      let result = shortLimiter.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      result = shortLimiter.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Exponential backoff', () => {
    test('provides appropriate wait times for different failure counts', () => {
      const limiter2 = new CredentialRateLimiter(1, 60000);

      // First failure - no backoff yet
      limiter2.isAllowed('192.168.1.1');
      limiter2.recordFailure('192.168.1.1');

      // Second attempt blocked - should suggest 1s wait
      let result = limiter2.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBe(1000);

      // Third failure
      limiter2.recordFailure('192.168.1.1');

      // Fourth attempt blocked - should suggest 5s wait
      result = limiter2.isAllowed('192.168.1.1');
      expect(result.allowed).toBe(false);
      expect(result.waitMs).toBe(5000);
    });
  });
});

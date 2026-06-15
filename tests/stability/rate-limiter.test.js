/**
 * Tests for Rate Limiter module
 */

const assert = require('assert');
const { CommandRateLimiter } = require('../../src/stability/rate-limiter');

describe('CommandRateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new CommandRateLimiter({
      defaultLimitPerMinute: 1000,
      windowMs: 60000,
      cleanupIntervalMs: 10000
    });
  });

  afterEach(() => {
    limiter.stop();
  });

  describe('initialization', () => {
    it('should have default configuration', () => {
      const config = limiter.getConfig();
      assert.strictEqual(config.defaultLimitPerMinute, 1000);
      assert.strictEqual(config.windowMs, 60000);
    });

    it('should have predefined command limits', () => {
      assert.strictEqual(limiter.getLimit('screenshot'), 10);
      assert.strictEqual(limiter.getLimit('execute_script'), 30);
      assert.strictEqual(limiter.getLimit('navigate'), 20);
    });

    it('should allow custom command limits', () => {
      const custom = new CommandRateLimiter({
        commandLimits: {
          custom_command: 5
        }
      });

      assert.strictEqual(custom.getLimit('custom_command'), 5);
    });
  });

  describe('rate limit checking', () => {
    it('should allow requests under limit', () => {
      const client = 'client1';
      const command = 'navigate';
      const limit = limiter.getLimit(command);

      for (let i = 0; i < limit; i++) {
        const result = limiter.check(client, command);
        assert.strictEqual(result.isLimited, false, `Request ${i + 1} should not be limited`);
        limiter.record(client, command);
      }
    });

    it('should block requests over limit', () => {
      const client = 'client1';
      const command = 'screenshot';
      const limit = limiter.getLimit(command);

      // Record up to limit
      for (let i = 0; i < limit; i++) {
        limiter.record(client, command);
      }

      // Next request should be limited
      const result = limiter.check(client, command);
      assert.strictEqual(result.isLimited, true);
      assert.strictEqual(result.remaining, 0);
      assert.ok(result.retryAfterSeconds > 0);
    });

    it('should track remaining count', () => {
      const client = 'client1';
      const command = 'navigate';
      const limit = limiter.getLimit(command);

      limiter.record(client, command);
      const result = limiter.check(client, command);

      assert.strictEqual(result.isLimited, false);
      assert.strictEqual(result.remaining, limit - 1);
      assert.strictEqual(result.current, 1);
    });

    it('should distinguish between different commands', () => {
      const client = 'client1';

      // Max out screenshot limit
      const screenshotLimit = limiter.getLimit('screenshot');
      for (let i = 0; i < screenshotLimit; i++) {
        limiter.record(client, 'screenshot');
      }

      // screenshot should be limited
      assert.strictEqual(limiter.check(client, 'screenshot').isLimited, true);

      // navigate should not be limited
      assert.strictEqual(limiter.check(client, 'navigate').isLimited, false);
    });

    it('should distinguish between different clients', () => {
      const command = 'navigate';
      const limit = limiter.getLimit(command);

      // Max out for client1
      for (let i = 0; i < limit; i++) {
        limiter.record('client1', command);
      }

      // client1 should be limited
      assert.strictEqual(limiter.check('client1', command).isLimited, true);

      // client2 should not be limited
      assert.strictEqual(limiter.check('client2', command).isLimited, false);
    });
  });

  describe('time window management', () => {
    it('should reset after window expires', (done) => {
      // Use shorter window for testing
      const testLimiter = new CommandRateLimiter({
        windowMs: 100,
        cleanupIntervalMs: 50
      });

      const client = 'client1';
      const command = 'navigate';
      const limit = testLimiter.getLimit(command);

      // Max out
      for (let i = 0; i < limit; i++) {
        testLimiter.record(client, command);
      }

      assert.strictEqual(testLimiter.check(client, command).isLimited, true);

      // Wait for window to expire
      setTimeout(() => {
        // Should be able to make request now
        assert.strictEqual(testLimiter.check(client, command).isLimited, false);
        testLimiter.stop();
        done();
      }, 150);
    }, 5000);

    it('should calculate retry-after correctly', () => {
      const client = 'client1';
      const command = 'screenshot';
      const limit = limiter.getLimit(command);

      // Max out
      for (let i = 0; i < limit; i++) {
        limiter.record(client, command);
      }

      const result = limiter.check(client, command);
      assert.ok(result.retryAfterSeconds > 0);
      assert.ok(result.retryAfterSeconds <= 60);
    });
  });

  describe('statistics and reporting', () => {
    it('should track client statistics', () => {
      limiter.record('client1', 'navigate');
      limiter.record('client1', 'navigate');
      limiter.record('client1', 'screenshot');

      const stats = limiter.getClientStats('client1');

      assert.strictEqual(stats.clientId, 'client1');
      assert.strictEqual(stats.commands.navigate.requests, 2);
      assert.strictEqual(stats.commands.screenshot.requests, 1);
    });

    it('should track remaining quota', () => {
      limiter.record('client1', 'screenshot');
      limiter.record('client1', 'screenshot');

      const stats = limiter.getClientStats('client1');
      const limit = limiter.getLimit('screenshot');

      assert.strictEqual(stats.commands.screenshot.remaining, limit - 2);
    });

    it('should return empty stats for unknown client', () => {
      const stats = limiter.getClientStats('unknown-client');

      assert.strictEqual(stats.clientId, 'unknown-client');
      assert.deepStrictEqual(stats.commands, {});
    });

    it('should list tracked clients', () => {
      limiter.record('client1', 'navigate');
      limiter.record('client2', 'navigate');
      limiter.record('client3', 'screenshot');

      const clients = limiter.getTrackedClients();

      assert.strictEqual(clients.length, 3);
      assert.ok(clients.includes('client1'));
      assert.ok(clients.includes('client2'));
      assert.ok(clients.includes('client3'));
    });
  });

  describe('reset functionality', () => {
    it('should reset specific command for client', () => {
      const client = 'client1';
      const limit = limiter.getLimit('navigate');

      // Max out
      for (let i = 0; i < limit; i++) {
        limiter.record(client, 'navigate');
      }

      assert.strictEqual(limiter.check(client, 'navigate').isLimited, true);

      // Reset
      limiter.reset(client, 'navigate');

      assert.strictEqual(limiter.check(client, 'navigate').isLimited, false);
    });

    it('should reset all commands for client', () => {
      const client = 'client1';

      limiter.record(client, 'navigate');
      limiter.record(client, 'screenshot');

      // Reset all
      limiter.reset(client);

      // Both should be reset
      const stats = limiter.getClientStats(client);
      assert.deepStrictEqual(stats.commands, {});
    });

    it('should be no-op for unknown client', () => {
      // Should not throw
      limiter.reset('unknown-client', 'unknown-command');
      limiter.reset('unknown-client');
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired timestamps periodically', (done) => {
      const client = 'client1';
      const command = 'navigate';

      // Record with short window
      const shortWindowLimiter = new CommandRateLimiter({
        windowMs: 100,
        cleanupIntervalMs: 200
      });

      shortWindowLimiter.record(client, command);
      assert.strictEqual(shortWindowLimiter.getTrackedClients().length, 1);

      // Wait for cleanup
      setTimeout(() => {
        // Client should be removed after window expires and cleanup runs
        assert.strictEqual(shortWindowLimiter.getTrackedClients().length, 0);
        shortWindowLimiter.stop();
        done();
      }, 500);
    });

    it('should maintain stats across clients', () => {
      limiter.record('client1', 'navigate');
      limiter.record('client1', 'navigate');
      limiter.record('client2', 'screenshot');

      const config = limiter.getConfig();
      assert.strictEqual(config.trackedClients, 2);
    });
  });

  describe('limit types', () => {
    it('should have lower limits for screenshots', () => {
      assert.ok(limiter.getLimit('screenshot') < limiter.getLimit('navigate'));
      assert.ok(limiter.getLimit('screenshot') < limiter.getLimit('click'));
    });

    it('should have higher limits for read operations', () => {
      assert.ok(limiter.getLimit('get_content') > limiter.getLimit('screenshot'));
      assert.ok(limiter.getLimit('get_url') > limiter.getLimit('execute_script'));
    });

    it('should use default for unknown commands', () => {
      assert.strictEqual(limiter.getLimit('unknown_command'), limiter.defaultLimitPerMinute);
    });
  });

  describe('concurrent usage', () => {
    it('should handle multiple clients simultaneously', async () => {
      const clients = [];
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const clientId = `client${i}`;
        clients.push(clientId);

        // Record 5 requests per client
        for (let j = 0; j < 5; j++) {
          limiter.record(clientId, 'navigate');
        }
      }

      // Check all clients
      for (const clientId of clients) {
        const result = limiter.check(clientId, 'navigate');
        assert.strictEqual(result.isLimited, false);
        assert.strictEqual(result.current, 5);
      }

      assert.strictEqual(limiter.getTrackedClients().length, 10);
    });
  });
});

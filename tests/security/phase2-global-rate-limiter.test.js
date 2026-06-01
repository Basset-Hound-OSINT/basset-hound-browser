/**
 * Security Phase 2: Global Rate Limiter Tests
 * Validates system-wide rate limiting to prevent resource exhaustion
 *
 * Tests:
 * - Global request limits
 * - Global resource limits
 * - Connection limits
 * - Rate limit reset
 * - Statistics tracking
 */

const { GlobalRateLimiter, getCommandResourceCost } = require('../../src/security/global-rate-limiter');

describe('Security Phase 2: Global Rate Limiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new GlobalRateLimiter({
      maxGlobalRequestsPerMinute: 1000,
      maxGlobalResourceUnits: 5000,
      maxConnections: 100
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('Request Rate Limiting', () => {
    test('Enforces global request limit', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalRequestsPerMinute: 10
      });

      // Should accept first 10 requests
      for (let i = 0; i < 10; i++) {
        const result = limiter.canAccept(`client${i}`, 'ping');
        expect(result.allowed).toBe(true);
      }

      // 11th request should be denied
      const result = limiter.canAccept('client11', 'ping');
      expect(result.allowed).toBe(false);
      expect(result.reason.toLowerCase()).toContain('global request limit');
      expect(result.retryAfter).toBeGreaterThan(0);

      limiter.destroy();
    });

    test('Returns remaining request count', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalRequestsPerMinute: 100
      });

      const result1 = limiter.canAccept('client1', 'ping');
      expect(result1.globalRemaining).toBe(99);

      const result2 = limiter.canAccept('client2', 'ping');
      expect(result2.globalRemaining).toBe(98);

      limiter.destroy();
    });

    test('Tracks retry-after value', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalRequestsPerMinute: 5
      });

      // Fill up limit
      for (let i = 0; i < 5; i++) {
        limiter.canAccept(`client${i}`, 'ping');
      }

      // Next request denied with retry-after
      const result = limiter.canAccept('client5', 'ping');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThanOrEqual(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);

      limiter.destroy();
    });
  });

  describe('Resource Limit Enforcement', () => {
    test('Enforces global resource unit limit', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalResourceUnits: 100
      });

      // 10 requests × 10 units = 100 units (at capacity)
      for (let i = 0; i < 10; i++) {
        const result = limiter.canAccept(`client${i}`, 'screenshot', 10);
        expect(result.allowed).toBe(true);
      }

      // Next high-cost request should be denied
      const result = limiter.canAccept('client10', 'screenshot_full_page', 50);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('resource limit');

      limiter.destroy();
    });

    test('Tracks remaining resources', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalResourceUnits: 1000
      });

      const result1 = limiter.canAccept('client1', 'screenshot', 100);
      expect(result1.resourcesRemaining).toBe(900);

      const result2 = limiter.canAccept('client2', 'extract_html', 50);
      expect(result2.resourcesRemaining).toBe(850);

      limiter.destroy();
    });

    test('Correctly calculates variable resource costs', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalResourceUnits: 1000
      });

      // Ping: 1 unit
      limiter.canAccept('c1', 'ping', 1);
      expect(limiter.resources).toBe(1);

      // Screenshot: 10 units
      limiter.canAccept('c2', 'screenshot', 10);
      expect(limiter.resources).toBe(11);

      // Extract: 5 units
      limiter.canAccept('c3', 'extract_html', 5);
      expect(limiter.resources).toBe(16);

      limiter.destroy();
    });
  });

  describe('Connection Limits', () => {
    test('Enforces concurrent connection limit', () => {
      const limiter = new GlobalRateLimiter({
        maxConnections: 5
      });

      // Register 5 connections
      for (let i = 0; i < 5; i++) {
        expect(limiter.registerConnection()).toBe(true);
      }

      // 6th connection should fail
      expect(limiter.registerConnection()).toBe(false);

      limiter.destroy();
    });

    test('Blocks requests when at connection capacity', () => {
      const limiter = new GlobalRateLimiter({
        maxConnections: 2
      });

      limiter.registerConnection();
      limiter.registerConnection();

      // At capacity, next request denied
      const result = limiter.canAccept('client3', 'ping');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Maximum concurrent connections');

      limiter.destroy();
    });

    test('Unregisters connections correctly', () => {
      const limiter = new GlobalRateLimiter({
        maxConnections: 5
      });

      limiter.registerConnection();
      limiter.registerConnection();
      expect(limiter.connections).toBe(2);

      limiter.unregisterConnection();
      expect(limiter.connections).toBe(1);

      limiter.unregisterConnection();
      expect(limiter.connections).toBe(0);

      // Can't go below 0
      limiter.unregisterConnection();
      expect(limiter.connections).toBe(0);

      limiter.destroy();
    });

    test('Returns remaining connection slots', () => {
      const limiter = new GlobalRateLimiter({
        maxConnections: 10
      });

      for (let i = 0; i < 7; i++) {
        limiter.registerConnection();
      }

      const stats = limiter.getStats();
      expect(stats.connections).toBe(7);
      expect(stats.connectionsRemaining).toBe(3);

      limiter.destroy();
    });
  });

  describe('Rate Limit Reset', () => {
    test('Resets counters after 60 seconds (simulated)', (done) => {
      const limiter = new GlobalRateLimiter({
        maxGlobalRequestsPerMinute: 10
      });

      // Fill up
      for (let i = 0; i < 10; i++) {
        limiter.canAccept(`client${i}`, 'ping');
      }

      // Should be full
      let result = limiter.canAccept('client11', 'ping');
      expect(result.allowed).toBe(false);

      // Simulate time passing
      limiter.lastReset = Date.now() - 61000;

      // Should allow again (reset happened)
      result = limiter.canAccept('client12', 'ping');
      expect(result.allowed).toBe(true);

      limiter.destroy();
      done();
    });

    test('Clears client tracking on reset', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalRequestsPerMinute: 100
      });

      // Make some requests
      for (let i = 0; i < 5; i++) {
        limiter.canAccept(`client${i}`, 'ping');
      }

      expect(limiter.topClients.size).toBe(5);

      // Simulate reset
      limiter.lastReset = Date.now() - 61000;
      limiter.canAccept('newclient', 'ping');

      // Old clients should be cleared
      expect(limiter.topClients.size).toBeLessThanOrEqual(5);

      limiter.destroy();
    });
  });

  describe('Statistics', () => {
    test('Provides current statistics', () => {
      const result = limiter.canAccept('client1', 'ping');
      expect(result.allowed).toBe(true);

      const stats = limiter.getStats();
      expect(stats).toHaveProperty('requests');
      expect(stats).toHaveProperty('maxRequests');
      expect(stats).toHaveProperty('requestsRemaining');
      expect(stats).toHaveProperty('resources');
      expect(stats).toHaveProperty('maxResources');
      expect(stats).toHaveProperty('resourcesRemaining');
      expect(stats).toHaveProperty('connections');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats).toHaveProperty('connectionsRemaining');
      expect(stats).toHaveProperty('windowResetIn');
      expect(stats).toHaveProperty('topClients');
    });

    test('Tracks top clients by request count', () => {
      // Heavy client
      for (let i = 0; i < 50; i++) {
        limiter.canAccept('heavy-client', 'ping');
      }

      // Medium client
      for (let i = 0; i < 30; i++) {
        limiter.canAccept('medium-client', 'ping');
      }

      // Light clients
      limiter.canAccept('light-client-1', 'ping');
      limiter.canAccept('light-client-2', 'ping');

      const stats = limiter.getStats();
      const topClients = stats.topClients;

      expect(topClients[0].clientId).toBe('heavy-client');
      expect(topClients[0].requestCount).toBe(50);

      expect(topClients[1].clientId).toBe('medium-client');
      expect(topClients[1].requestCount).toBe(30);
    });

    test('Limits top clients tracking to 10', () => {
      // Create 20 clients
      for (let i = 0; i < 20; i++) {
        limiter.canAccept(`client${i}`, 'ping');
      }

      const stats = limiter.getStats();
      expect(stats.topClients.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Command Resource Costs', () => {
    test('Returns correct resource cost for each command', () => {
      expect(getCommandResourceCost('ping')).toBe(1);
      expect(getCommandResourceCost('status')).toBe(1);

      expect(getCommandResourceCost('extract_html')).toBe(5);
      expect(getCommandResourceCost('get_cookies')).toBe(5);

      expect(getCommandResourceCost('screenshot')).toBe(10);
      expect(getCommandResourceCost('execute_javascript')).toBe(10);

      expect(getCommandResourceCost('screenshot_full_page')).toBe(50);
      expect(getCommandResourceCost('record_session')).toBe(50);
    });

    test('Uses default cost for unknown commands', () => {
      expect(getCommandResourceCost('unknown_command')).toBe(3);
      expect(getCommandResourceCost('made_up_command')).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    test('Handles zero resource cost', () => {
      const result = limiter.canAccept('client', 'ping', 0);
      expect(result.allowed).toBe(true);
      expect(limiter.resources).toBe(0);
    });

    test('Handles large resource costs', () => {
      const limiter = new GlobalRateLimiter({
        maxGlobalResourceUnits: 100
      });

      const result = limiter.canAccept('client', 'expensive', 150);
      expect(result.allowed).toBe(false);

      limiter.destroy();
    });

    test('Handles multiple concurrent limit checks', () => {
      // Simulate checking limits from multiple clients
      const clients = [];
      for (let i = 0; i < 10; i++) {
        clients.push(`client${i}`);
      }

      const results = clients.map(client => limiter.canAccept(client, 'ping'));

      // All should be allowed
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      expect(limiter.requests).toBe(10);
    });

    test('Handles cleanup when topClients exceeds limit', () => {
      // Manually create many clients
      for (let i = 0; i < 15000; i++) {
        limiter.topClients.set(`client${i}`, 1);
      }

      expect(limiter.topClients.size).toBe(15000);

      // Trigger cleanup
      limiter._cleanup();

      // Should be trimmed to 5000
      expect(limiter.topClients.size).toBeLessThanOrEqual(5000);
    });
  });

  describe('Reset Functionality', () => {
    test('Resets all counters on demand', () => {
      // Make requests
      for (let i = 0; i < 50; i++) {
        limiter.canAccept(`client${i}`, 'ping');
      }

      expect(limiter.requests).toBe(50);
      expect(limiter.connections).toBeGreaterThanOrEqual(0);

      // Reset
      limiter.reset();

      expect(limiter.requests).toBe(0);
      expect(limiter.resources).toBe(0);
      expect(limiter.connections).toBe(0);
      expect(limiter.topClients.size).toBe(0);
    });
  });
});

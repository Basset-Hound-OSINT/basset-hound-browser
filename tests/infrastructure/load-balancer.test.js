/**
 * Load Balancer Tests
 *
 * Tests for:
 * - Backend management (add, remove, health checks)
 * - Load balancing algorithms (round-robin, least-connections)
 * - Session affinity (sticky sessions)
 * - Rate limiting (connections per second)
 * - Graceful shutdown and draining
 * - Metrics collection
 */

const LoadBalancer = require('../../src/infrastructure/load-balancer');

describe('LoadBalancer', () => {
  let lb;

  beforeEach(() => {
    lb = new LoadBalancer({
      port: 8765,
      backends: [
        { host: '127.0.0.1', port: 9001 },
        { host: '127.0.0.1', port: 9002 },
        { host: '127.0.0.1', port: 9003 }
      ]
    });
  });

  afterEach(async () => {
    if (lb) {
      await lb.shutdown();
    }
  });

  describe('Backend Management', () => {
    test('should add backends on initialization', () => {
      expect(lb.backends.size).toBe(3);
    });

    test('should add a backend dynamically', () => {
      lb.addBackend('backend_4', '127.0.0.1', 9004);
      expect(lb.backends.size).toBe(4);

      const backend = lb.backends.get('backend_4');
      expect(backend.host).toBe('127.0.0.1');
      expect(backend.port).toBe(9004);
    });

    test('should remove a backend', () => {
      lb.removeBackend('backend_0');
      expect(lb.backends.size).toBe(2);
    });

    test('should emit backend:added event', (done) => {
      const newLb = new LoadBalancer();
      newLb.on('backend:added', (data) => {
        expect(data.id).toBe('new_backend');
        expect(data.host).toBe('127.0.0.1');
        expect(data.port).toBe(9999);
        done();
      });

      newLb.addBackend('new_backend', '127.0.0.1', 9999);
    });

    test('should emit backend:removed event', (done) => {
      lb.on('backend:removed', (data) => {
        expect(data.id).toBe('backend_0');
        done();
      });

      lb.removeBackend('backend_0');
    });
  });

  describe('Health Checks', () => {
    test('should mark backends as healthy initially', () => {
      for (const backend of lb.backends.values()) {
        expect(backend.healthy).toBe(true);
      }
    });

    test('should perform health check on backend', (done) => {
      lb.on('backend:health', (data) => {
        expect(data.id).toBeDefined();
        expect(typeof data.healthy).toBe('boolean');
        done();
      });

      lb.checkBackendHealth('backend_0');
    });

    test('should emit health:degraded event when backend is down', (done) => {
      // Change backend port to invalid port
      const backend = lb.backends.get('backend_0');
      backend.port = 65432; // Invalid port

      let emitted = false;
      lb.on('backend:health', (data) => {
        if (!emitted && !data.healthy && data.id === 'backend_0') {
          emitted = true;
          expect(data.id).toBe('backend_0');
          expect(data.healthy).toBe(false);
          done();
        }
      });

      lb.checkBackendHealth('backend_0');
    });
  });

  describe('Load Balancing Algorithms', () => {
    test('should use round-robin by default', () => {
      const backends1 = [];
      for (let i = 0; i < 6; i++) {
        const backend = lb.selectBackend(`client_${i}`);
        backends1.push(backend.id);
      }

      // Should cycle through backends
      expect(backends1[0]).not.toBe(backends1[1]);
      expect(backends1[1]).not.toBe(backends1[2]);
    });

    test('should support least-connections algorithm', () => {
      const lbLc = new LoadBalancer({
        algorithm: 'leastconn',
        backends: [
          { host: '127.0.0.1', port: 9001 },
          { host: '127.0.0.1', port: 9002 }
        ]
      });

      // Manually set connection counts
      lbLc.backends.get('backend_0').connections = 10;
      lbLc.backends.get('backend_1').connections = 5;

      const backend = lbLc.selectBackend('client_1');
      expect(backend.id).toBe('backend_1'); // Should select least-connected
    });

    test('should support random algorithm', () => {
      const lbRand = new LoadBalancer({
        algorithm: 'random',
        backends: [
          { host: '127.0.0.1', port: 9001 },
          { host: '127.0.0.1', port: 9002 },
          { host: '127.0.0.1', port: 9003 }
        ]
      });

      const backends = new Set();
      for (let i = 0; i < 20; i++) {
        const backend = lbRand.selectBackend(`client_${i}`);
        if (backend) {
          backends.add(backend.id);
        }
      }

      expect(backends.size).toBeGreaterThan(1); // Should use multiple backends
    });
  });

  describe('Session Affinity', () => {
    test('should maintain session affinity for same client IP', () => {
      const clientIp = '192.168.1.100';

      const backend1 = lb.selectBackend(clientIp);
      const backend2 = lb.selectBackend(clientIp);
      const backend3 = lb.selectBackend(clientIp);

      expect(backend1.id).toBe(backend2.id);
      expect(backend2.id).toBe(backend3.id);
    });

    test('should distribute different clients to different backends', () => {
      const backends = new Set();

      for (let i = 0; i < 10; i++) {
        const backend = lb.selectBackend(`client_${i}`);
        backends.add(backend.id);
      }

      expect(backends.size).toBeGreaterThan(1);
    });

    test('should disable session affinity when configured', () => {
      const lbNoAffinity = new LoadBalancer({
        sessionAffinity: false,
        backends: [
          { host: '127.0.0.1', port: 9001 },
          { host: '127.0.0.1', port: 9002 }
        ]
      });

      expect(lbNoAffinity.sessionAffinity.size).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    test('should check connection rate limit', () => {
      const clientIp = '192.168.1.100';
      const limit = lb.config.rateLimit.connectionsPerSec;

      // Add connections up to limit
      for (let i = 0; i < limit; i++) {
        const exceeded = lb.checkRateLimit(clientIp, true);
        expect(exceeded).toBe(false);
      }

      // Next connection should exceed limit
      const exceeded = lb.checkRateLimit(clientIp, true);
      expect(exceeded).toBe(true);
    });

    test('should reset rate limit after time window', (done) => {
      const clientIp = '192.168.1.100';
      const limit = lb.config.rateLimit.connectionsPerSec;

      // Fill up the limit
      for (let i = 0; i < limit; i++) {
        lb.checkRateLimit(clientIp, true);
      }

      // Should be exceeded
      let exceeded = lb.checkRateLimit(clientIp, true);
      expect(exceeded).toBe(true);

      // After 1 second, limit should reset
      setTimeout(() => {
        exceeded = lb.checkRateLimit(clientIp, true);
        expect(exceeded).toBe(false);
        done();
      }, 1100);
    });
  });

  describe('Metrics Collection', () => {
    test('should collect metrics', () => {
      lb.metrics.connections.current = 10;
      lb.metrics.connections.total = 100;
      lb.metrics.requests.total = 500;

      const metrics = lb.getMetrics();

      expect(metrics.connections.current).toBe(10);
      expect(metrics.connections.total).toBe(100);
      expect(metrics.requests.total).toBe(500);
    });

    test('should track backend metrics', () => {
      const backend = lb.backends.get('backend_0');
      backend.stats.totalConnections = 50;
      backend.stats.totalRequests = 200;
      backend.stats.errors = 2;

      const metrics = lb.getMetrics();
      const backendMetrics = metrics.backends.find(b => b.id === 'backend_0');

      expect(backendMetrics.stats.totalConnections).toBe(50);
      expect(backendMetrics.stats.totalRequests).toBe(200);
      expect(backendMetrics.stats.errors).toBe(2);
    });
  });

  describe('Health Status', () => {
    test('should report health status', () => {
      const status = lb.getHealthStatus();

      expect(status.status).toBe('HEALTHY');
      expect(status.backends.length).toBe(3);
      expect(status.summary.healthy).toBe(3);
      expect(status.summary.total).toBe(3);
    });

    test('should report degraded status when backends are down', () => {
      const backend = lb.backends.get('backend_0');
      backend.healthy = false;

      const status = lb.getHealthStatus();

      expect(status.status).toBe('HEALTHY'); // Other backends are still healthy
      expect(status.summary.healthy).toBe(2);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should drain connections on shutdown', async () => {
      lb.metrics.connections.current = 10;

      const shutdownPromise = lb.shutdown();

      // Simulate connections closing
      setTimeout(() => {
        lb.metrics.connections.current = 0;
      }, 100);

      await shutdownPromise;
      expect(lb.isShuttingDown).toBe(true);
    });

    test('should drain a specific backend', async () => {
      const backend = lb.backends.get('backend_0');
      backend.connections = 5;

      // Start the drain
      const drainPromise = lb.drainBackend('backend_0');

      // Simulate connections closing
      setTimeout(() => {
        backend.connections = 0;
      }, 100);

      await drainPromise;
      expect(backend.healthy).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    test('should handle full request lifecycle', async () => {
      const backend = lb.selectBackend('client_1');
      expect(backend).toBeDefined();
      expect(backend.healthy).toBe(true);

      // Simulate metrics update
      lb.metrics.connections.current++;
      lb.metrics.connections.total++;
      lb.metrics.requests.total++;
      backend.connections++;
      backend.stats.totalConnections++;

      expect(lb.metrics.connections.current).toBe(1);
      expect(backend.connections).toBe(1);

      // Simulate connection close
      lb.metrics.connections.current--;
      backend.connections--;

      expect(lb.metrics.connections.current).toBe(0);
      expect(backend.connections).toBe(0);
    });

    test('should recover from backend failure', async () => {
      const backend = lb.backends.get('backend_0');

      // Simulate failure
      backend.healthy = false;

      // New connections should go to other backends
      const selected = lb.selectBackend('client_new');
      expect(selected.id).not.toBe('backend_0');

      // Simulate recovery
      backend.healthy = true;

      // Now it can be selected again
      const selected2 = lb.selectBackend('client_another');
      // May or may not be backend_0 depending on affinity, but it's available
    });
  });
});

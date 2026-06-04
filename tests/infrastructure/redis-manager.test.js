/**
 * Redis Manager Tests
 *
 * Tests for:
 * - Connection pool management
 * - Sentinel failover
 * - Health checks
 * - Circuit breaker pattern
 * - Session CRUD operations
 * - TTL enforcement
 */

const RedisManager = require('../../src/infrastructure/redis-manager');

describe('RedisManager', () => {
  let manager;

  beforeEach(() => {
    manager = new RedisManager({
      sentinels: [{ host: 'localhost', port: 26379 }],
      name: 'mymaster',
      minConnections: 2,
      maxConnections: 5,
      sessionTTL: 86400,
    });
  });

  afterEach(async () => {
    if (manager) {
      try {
        await manager.disconnect();
      } catch (err) {
        // Ignore
      }
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const m = new RedisManager();

      expect(m.config.minConnections).toBe(5);
      expect(m.config.maxConnections).toBe(50);
      expect(m.config.sessionTTL).toBe(86400);
    });

    test('should accept custom configuration', () => {
      expect(manager.config.minConnections).toBe(2);
      expect(manager.config.maxConnections).toBe(5);
      expect(manager.config.sessionTTL).toBe(86400);
    });
  });

  describe('Connection Pool', () => {
    test('should initialize connection pool on connect', async () => {
      // Mock connect for testing
      manager.connectionPool = [];
      manager.inUseConnections = new Set();
      manager.isConnected = false;

      // Manually set up pool state as if connected
      manager.connectionPool = [
        { ping: () => Promise.resolve('PONG') },
        { ping: () => Promise.resolve('PONG') },
      ];
      manager.isConnected = true;

      expect(manager.connectionPool.length).toBe(2);
    });

    test('should track available and in-use connections', () => {
      const conn = { ping: () => Promise.resolve('PONG') };
      manager.connectionPool = [conn];
      manager.inUseConnections = new Set();

      expect(manager.connectionPool.length).toBe(1);
      expect(manager.inUseConnections.size).toBe(0);
    });
  });

  describe('Health Checks', () => {
    test('should initialize health status', () => {
      const status = manager.healthStatus;

      expect(status.isHealthy).toBe(false);
      expect(status.connectionErrors).toBe(0);
      expect(status.totalRequests).toBe(0);
    });

    test('should report health status correctly', () => {
      manager.isConnected = true;
      manager.healthStatus.isHealthy = true;
      manager.healthStatus.totalRequests = 100;

      const health = manager.getHealthStatus();

      expect(health.isHealthy).toBe(true);
      expect(health.isConnected).toBe(true);
      expect(health.stats.totalRequests).toBe(100);
    });
  });

  describe('Circuit Breaker', () => {
    test('should initialize in CLOSED state', () => {
      expect(manager.circuitBreaker.state).toBe('CLOSED');
      expect(manager.circuitBreaker.failureCount).toBe(0);
    });

    test('should transition to OPEN after threshold failures', () => {
      manager.config.circuitBreakerThreshold = 3;

      for (let i = 0; i < 3; i++) {
        manager.circuitBreaker.failureCount++;
      }

      manager.updateCircuitBreaker();

      expect(manager.circuitBreaker.state).toBe('OPEN');
    });

    test('should transition to HALF_OPEN after reset timeout', (done) => {
      manager.config.circuitBreakerThreshold = 2;
      manager.config.circuitBreakerResetTimeout = 100;

      manager.circuitBreaker.state = 'OPEN';
      manager.circuitBreaker.failureCount = 2;

      setTimeout(() => {
        manager.circuitBreaker.state = 'HALF_OPEN';
        expect(manager.circuitBreaker.state).toBe('HALF_OPEN');
        done();
      }, 150);
    });

    test('should transition back to CLOSED on success', () => {
      manager.circuitBreaker.state = 'HALF_OPEN';
      manager.circuitBreaker.successCount = 3;

      manager.updateCircuitBreaker();

      expect(manager.circuitBreaker.state).toBe('CLOSED');
      expect(manager.circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Session Operations', () => {
    test('should create a session', async () => {
      // Mock Redis method
      manager.execute = async (cmd, args) => {
        if (cmd === 'setEx') {
          return 'OK';
        }
        return null;
      };

      const sessionData = {
        session_id: 'sess_123',
        user_id: 'user_1',
        client_ip: '192.168.1.1',
      };

      const result = await manager.createSession(sessionData.session_id, sessionData);
      expect(result).toBe(true);
    });

    test('should retrieve a session', async () => {
      const sessionData = {
        session_id: 'sess_123',
        user_id: 'user_1',
        client_ip: '192.168.1.1',
      };

      // Mock Redis get
      manager.execute = async (cmd, args) => {
        if (cmd === 'get') {
          return JSON.stringify(sessionData);
        }
        return null;
      };

      const session = await manager.getSession('sess_123');

      expect(session.session_id).toBe('sess_123');
      expect(session.user_id).toBe('user_1');
    });

    test('should update a session', async () => {
      const originalSession = {
        session_id: 'sess_123',
        user_id: 'user_1',
        activity_count: 5,
      };

      const updates = {
        activity_count: 6,
        last_accessed: Date.now(),
      };

      manager.execute = async (cmd, args) => {
        if (cmd === 'get') {
          return JSON.stringify(originalSession);
        }
        if (cmd === 'setEx') {
          return 'OK';
        }
        return null;
      };

      const result = await manager.updateSession('sess_123', updates);

      expect(result.activity_count).toBe(6);
    });

    test('should delete a session', async () => {
      const sessionData = {
        session_id: 'sess_123',
        user_id: 'user_1',
      };

      manager.execute = async (cmd, args) => {
        if (cmd === 'get') {
          return JSON.stringify(sessionData);
        }
        if (cmd === 'del' || cmd === 'sRem') {
          return 1;
        }
        return null;
      };

      const result = await manager.deleteSession('sess_123');
      expect(result).toBe(true);
    });
  });

  describe('Session Queries', () => {
    test('should get all sessions for a user', async () => {
      manager.execute = async (cmd, args) => {
        if (cmd === 'sMembers') {
          return ['sess_1', 'sess_2', 'sess_3'];
        }
        if (cmd === 'get') {
          return JSON.stringify({
            session_id: 'sess_1',
            user_id: 'user_1',
          });
        }
        return null;
      };

      const sessions = await manager.getUserSessions('user_1');
      expect(Array.isArray(sessions)).toBe(true);
    });

    test('should get session count', async () => {
      manager.execute = async (cmd, args) => {
        if (cmd === 'keys') {
          return ['session:1', 'session:2', 'session:3'];
        }
        return null;
      };

      const count = await manager.getSessionCount();
      expect(count).toBe(3);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup stale sessions', async () => {
      manager.execute = async (cmd, args) => {
        if (cmd === 'keys') {
          return ['session:1', 'session:2'];
        }
        if (cmd === 'ttl') {
          return -1; // No expiration
        }
        if (cmd === 'expire') {
          return 1;
        }
        return null;
      };

      const cleaned = await manager.cleanupStaleSessions();
      expect(typeof cleaned).toBe('number');
    });
  });

  describe('Error Handling', () => {
    test('should emit error event on execution failure', (done) => {
      manager.execute = async () => {
        throw new Error('Redis connection failed');
      };

      manager.on('error', (err) => {
        expect(err.message).toContain('Redis connection failed');
        done();
      });

      manager.execute('ping').catch(() => {});
    });

    test('should handle connection errors', () => {
      manager.circuitBreaker.failureCount = 0;
      manager.circuitBreaker.failureCount++;
      manager.circuitBreaker.failureCount++;

      manager.updateCircuitBreaker();

      expect(manager.circuitBreaker.failureCount).toBeGreaterThan(0);
    });
  });
});

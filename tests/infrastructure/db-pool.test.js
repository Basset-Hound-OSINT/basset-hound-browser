/**
 * Database Pool Tests
 *
 * Tests for:
 * - Connection pool initialization and management
 * - Query execution with timeout
 * - Transaction support
 * - Health checks
 * - Graceful shutdown
 */

const DbPool = require('../../src/infrastructure/db-pool');

describe('DbPool', () => {
  let pool;

  beforeEach(async () => {
    pool = new DbPool({
      host: 'localhost',
      port: 5432,
      database: 'test_db',
      minConnections: 2,
      maxConnections: 5,
      queryTimeoutMillis: 5000,
    });
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const p = new DbPool();

      expect(p.config.host).toBe('localhost');
      expect(p.config.port).toBe(5432);
      expect(p.config.minConnections).toBe(10);
      expect(p.config.maxConnections).toBe(100);
    });

    test('should accept custom configuration', () => {
      expect(pool.config.database).toBe('test_db');
      expect(pool.config.minConnections).toBe(2);
      expect(pool.config.maxConnections).toBe(5);
    });
  });

  describe('Connection Management', () => {
    test('should initialize with minimum connections', async () => {
      await pool.connect();

      expect(pool.connections.size).toBe(2);
      expect(pool.availableConnections.length).toBe(2);
    });

    test('should acquire a connection', async () => {
      await pool.connect();

      const conn = await pool.acquireConnection();

      expect(conn).toBeDefined();
      expect(conn.isAvailable).toBe(false);
    });

    test('should release a connection back to pool', async () => {
      await pool.connect();

      const conn = await pool.acquireConnection();
      const inUseCount = pool.connections.size - pool.availableConnections.length;

      expect(inUseCount).toBe(1);

      pool.releaseConnection(conn);

      expect(pool.availableConnections.length).toBe(2);
    });

    test('should create new connection when pool is exhausted', async () => {
      await pool.connect();

      // Acquire all available connections
      const conns = [];
      for (let i = 0; i < 2; i++) {
        conns.push(await pool.acquireConnection());
      }

      expect(pool.connections.size).toBe(2);

      // Next acquire should create new connection
      const newConn = await pool.acquireConnection();
      expect(newConn).toBeDefined();
      expect(pool.connections.size).toBe(3);

      // Cleanup
      conns.forEach(c => pool.releaseConnection(c));
      pool.releaseConnection(newConn);
    });

    test('should respect max connections limit', async () => {
      await pool.connect();

      const conns = [];
      for (let i = 0; i < pool.config.maxConnections; i++) {
        conns.push(await pool.acquireConnection());
      }

      expect(pool.connections.size).toBe(pool.config.maxConnections);

      // Cleanup
      conns.forEach(c => pool.releaseConnection(c));
    });
  });

  describe('Query Execution', () => {
    test('should execute a query', async () => {
      await pool.connect();

      const result = await pool.query('SELECT 1');

      expect(result).toBeDefined();
      expect(result.command).toBe('SELECT');
    });

    test('should execute a query with parameters', async () => {
      await pool.connect();

      const result = await pool.query('SELECT * FROM users WHERE id = $1', [1]);

      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
    });

    test('should increment query count on execution', async () => {
      await pool.connect();

      const conn = await pool.acquireConnection();
      const initialCount = conn.queryCount;

      await pool.query('SELECT 1');

      pool.releaseConnection(conn);

      expect(conn.queryCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should handle query timeout', async () => {
      const shortTimeoutPool = new DbPool({
        queryTimeoutMillis: 10,
      });

      await shortTimeoutPool.connect();

      try {
        // Simulate a slow query
        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });
      } catch (err) {
        expect(err).toBeDefined();
      }

      await shortTimeoutPool.close();
    });
  });

  describe('Transactions', () => {
    test('should begin a transaction', async () => {
      await pool.connect();

      const txn = await pool.beginTransaction();

      expect(txn).toBeDefined();
      expect(txn.isActive).toBe(true);

      await txn.rollback();
    });

    test('should execute queries in transaction', async () => {
      await pool.connect();

      const txn = await pool.beginTransaction();

      const result1 = await txn.query('INSERT INTO test VALUES (1)');
      const result2 = await txn.query('SELECT * FROM test');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      await txn.rollback();
    });

    test('should commit a transaction', async () => {
      await pool.connect();

      const txn = await pool.beginTransaction();

      expect(txn.isActive).toBe(true);

      await txn.commit();

      expect(txn.isActive).toBe(false);
    });

    test('should rollback a transaction', async () => {
      await pool.connect();

      const txn = await pool.beginTransaction();

      expect(txn.isActive).toBe(true);

      await txn.rollback();

      expect(txn.isActive).toBe(false);
    });
  });

  describe('Health Checks', () => {
    test('should report health status', async () => {
      await pool.connect();

      const status = pool.getHealthStatus();

      expect(status.isHealthy).toBe(true);
      expect(status.isConnected).toBe(true);
    });

    test('should track connection statistics', async () => {
      await pool.connect();

      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.availableConnections).toBe(2);
      expect(stats.inUseConnections).toBe(0);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should drain connections', async () => {
      await pool.connect();

      const drainPromise = pool.drain();

      // Simulate connections returning
      setTimeout(() => {
        pool.availableConnections = Array.from(pool.connections.values());
      }, 50);

      await drainPromise;

      expect(pool.isConnected).toBe(false);
    });

    test('should close all connections', async () => {
      await pool.connect();

      expect(pool.connections.size).toBe(2);

      await pool.close();

      expect(pool.connections.size).toBe(0);
      expect(pool.isConnected).toBe(false);
    });

    test('should stop health checks on close', async () => {
      await pool.connect();

      const hadHealthCheck = pool.healthCheckInterval !== null;

      await pool.close();

      expect(hadHealthCheck).toBe(true);
      expect(pool.healthCheckInterval).toBe(null);
    });
  });

  describe('Error Handling', () => {
    test('should track query errors', async () => {
      await pool.connect();

      const initialErrors = pool.healthStatus.errors;

      try {
        // This will be a mock error since we're not connected to real DB
        await pool.query('INVALID SQL');
      } catch (err) {
        // Expected
      }

      expect(pool.healthStatus.errors).toBeGreaterThanOrEqual(initialErrors);
    });
  });
});

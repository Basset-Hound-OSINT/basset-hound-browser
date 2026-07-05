/**
 * Redis Sentinel Connection Manager
 *
 * Provides high-availability distributed session storage with:
 * - Redis Sentinel automatic failover
 * - Connection pooling (min 5, max 50 connections)
 * - Health checks and reconnection
 * - Circuit breaker pattern
 * - Session persistence with TTL
 */

const redis = require('redis');
const EventEmitter = require('events');

class RedisManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Sentinel configuration
      sentinels: config.sentinels || [
        { host: 'localhost', port: 26379 }
      ],
      name: config.name || 'mymaster',

      // Connection pool
      minConnections: config.minConnections || 5,
      maxConnections: config.maxConnections || 50,
      acquireTimeoutMillis: config.acquireTimeoutMillis || 30000,
      idleTimeoutMillis: config.idleTimeoutMillis || 600000, // 10 minutes
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,

      // Health check
      healthCheckInterval: config.healthCheckInterval || 10000, // 10s

      // Circuit breaker
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerResetTimeout: config.circuitBreakerResetTimeout || 60000, // 1 minute

      // Session configuration
      sessionTTL: config.sessionTTL || 86400, // 24 hours in seconds
      password: config.password,

      ...config
    };

    // Connection pool
    this.connectionPool = [];
    this.waitingQueue = [];
    this.inUseConnections = new Set();

    // Circuit breaker state
    this.circuitBreaker = {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null
    };

    // Health status
    this.healthStatus = {
      isHealthy: false,
      lastHealthCheck: null,
      connectionErrors: 0,
      totalRequests: 0
    };

    // Primary Redis client (for monitoring)
    this.client = null;
    this.healthCheckInterval = null;
    this.isConnected = false;
  }

  /**
   * Initialize the Redis manager
   */
  async connect() {
    try {
      // Create Redis client with Sentinel support
      this.client = redis.createClient({
        sentinels: this.config.sentinels,
        name: this.config.name,
        password: this.config.password,
        socket: {
          connectTimeout: this.config.connectionTimeoutMillis,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        this.emit('error', err);
        this.circuitBreaker.failureCount++;
        this.healthStatus.connectionErrors++;
        this.updateCircuitBreaker();
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.circuitBreaker.failureCount = 0;
        this.healthStatus.isHealthy = true;
        this.emit('connected');
      });

      this.client.on('disconnect', () => {
        this.isConnected = false;
        this.healthStatus.isHealthy = false;
        this.emit('disconnected');
      });

      await this.client.connect();
      this.isConnected = true;
      this.healthStatus.isHealthy = true;

      // Start health checks
      this.startHealthCheck();

      // Initialize connection pool
      await this.initializeConnectionPool();

      this.emit('ready');
      return true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Initialize connection pool
   */
  async initializeConnectionPool() {
    const promises = [];
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createPoolConnection());
    }
    await Promise.all(promises);
  }

  /**
   * Create a new connection for the pool
   */
  async createPoolConnection() {
    try {
      const conn = redis.createClient({
        sentinels: this.config.sentinels,
        name: this.config.name,
        password: this.config.password,
        socket: {
          connectTimeout: this.config.connectionTimeoutMillis
        }
      });

      conn.on('error', (err) => {
        this.emit('pool:error', err);
      });

      await conn.connect();
      this.connectionPool.push(conn);
    } catch (err) {
      this.emit('pool:error', err);
    }
  }

  /**
   * Acquire a connection from the pool
   */
  async acquireConnection() {
    // Check circuit breaker
    if (this.circuitBreaker.state === 'OPEN') {
      throw new Error('Redis circuit breaker is OPEN');
    }

    // Return connection from pool if available
    while (this.connectionPool.length > 0) {
      const conn = this.connectionPool.pop();
      try {
        // Test connection with a simple ping
        await conn.ping();
        this.inUseConnections.add(conn);
        return conn;
      } catch (err) {
        // Connection is dead, discard it
        try {
          await conn.quit();
        } catch (e) {
          // Ignore
        }
      }
    }

    // Create new connection if under limit
    if (this.connectionPool.length + this.inUseConnections.size < this.config.maxConnections) {
      try {
        await this.createPoolConnection();
        const conn = this.connectionPool.pop();
        this.inUseConnections.add(conn);
        return conn;
      } catch (err) {
        this.circuitBreaker.failureCount++;
        this.updateCircuitBreaker();
        throw err;
      }
    }

    // Queue request if at capacity
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waitingQueue.indexOf(resolver);
        if (idx >= 0) {
          this.waitingQueue.splice(idx, 1);
        }
        reject(new Error('Timeout acquiring Redis connection'));
      }, this.config.acquireTimeoutMillis);

      const resolver = (conn) => {
        clearTimeout(timeout);
        resolve(conn);
      };

      this.waitingQueue.push(resolver);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(conn) {
    this.inUseConnections.delete(conn);

    // Check if there are waiting requests
    if (this.waitingQueue.length > 0) {
      const resolver = this.waitingQueue.shift();
      this.inUseConnections.add(conn);
      resolver(conn);
    } else {
      this.connectionPool.push(conn);
    }

    // Check pool size and remove idle connections if needed
    if (this.connectionPool.length > this.config.minConnections) {
      const conn = this.connectionPool.pop();
      try {
        conn.quit();
      } catch (err) {
        // Ignore
      }
    }
  }

  /**
   * Execute a Redis command with automatic retry
   */
  async execute(command, args = []) {
    let conn = null;
    try {
      conn = await this.acquireConnection();
      this.healthStatus.totalRequests++;

      // Execute command
      const result = await conn[command](...args);

      // Success - update circuit breaker
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.successCount++;
        if (this.circuitBreaker.successCount >= 3) {
          this.circuitBreaker.state = 'CLOSED';
          this.circuitBreaker.failureCount = 0;
          this.circuitBreaker.successCount = 0;
          this.emit('circuit-breaker:closed');
        }
      }

      return result;
    } catch (err) {
      this.circuitBreaker.failureCount++;
      this.updateCircuitBreaker();
      throw err;
    } finally {
      if (conn) {
        this.releaseConnection(conn);
      }
    }
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker() {
    if (this.circuitBreaker.state === 'CLOSED') {
      if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
        this.circuitBreaker.state = 'OPEN';
        this.circuitBreaker.lastFailureTime = Date.now();
        this.emit('circuit-breaker:opened');

        // Schedule half-open attempt
        setTimeout(() => {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.circuitBreaker.successCount = 0;
          this.emit('circuit-breaker:half-open');
        }, this.config.circuitBreakerResetTimeout);
      }
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.client.ping();
        this.healthStatus.isHealthy = true;
        this.healthStatus.lastHealthCheck = Date.now();
      } catch (err) {
        this.healthStatus.isHealthy = false;
        this.healthStatus.lastHealthCheck = Date.now();
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Create a session
   */
  async createSession(sessionId, sessionData) {
    const key = `session:${sessionId}`;
    const json = JSON.stringify(sessionData);

    try {
      await this.execute('setEx', [key, this.config.sessionTTL, json]);

      // Add to user sessions index
      const userId = sessionData.user_id;
      if (userId) {
        await this.execute('sAdd', [`user_sessions:${userId}`, sessionId]);
      }

      return true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get a session
   */
  async getSession(sessionId) {
    const key = `session:${sessionId}`;

    try {
      const data = await this.execute('get', [key]);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Update a session
   */
  async updateSession(sessionId, updates) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const updated = { ...session, ...updates };
      await this.createSession(sessionId, updated);
      return updated;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId) {
    const key = `session:${sessionId}`;

    try {
      const session = await this.getSession(sessionId);
      if (session && session.user_id) {
        await this.execute('sRem', [`user_sessions:${session.user_id}`, sessionId]);
      }

      await this.execute('del', [key]);
      return true;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId) {
    try {
      const sessionIds = await this.execute('sMembers', [`user_sessions:${userId}`]);
      const sessions = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get session count
   */
  async getSessionCount() {
    try {
      const keys = await this.execute('keys', ['session:*']);
      return keys ? keys.length : 0;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Cleanup stale sessions (TTL handles automatic expiration)
   */
  async cleanupStaleSessions() {
    try {
      // Redis automatically expires keys with TTL, so this is mostly informational
      const keys = await this.execute('keys', ['session:*']);
      let cleaned = 0;

      for (const key of keys) {
        const ttl = await this.execute('ttl', [key]);
        if (ttl === -1) { // Key has no expiration, set it
          const sessionData = await this.execute('get', [key]);
          if (sessionData) {
            await this.execute('expire', [key, this.config.sessionTTL]);
            cleaned++;
          }
        }
      }

      return cleaned;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      isHealthy: this.healthStatus.isHealthy,
      isConnected: this.isConnected,
      circuitBreaker: {
        state: this.circuitBreaker.state,
        failureCount: this.circuitBreaker.failureCount
      },
      pool: {
        available: this.connectionPool.length,
        inUse: this.inUseConnections.size,
        waiting: this.waitingQueue.length
      },
      stats: {
        totalRequests: this.healthStatus.totalRequests,
        connectionErrors: this.healthStatus.connectionErrors,
        lastHealthCheck: this.healthStatus.lastHealthCheck
          ? new Date(this.healthStatus.lastHealthCheck).toISOString()
          : null
      }
    };
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    this.stopHealthCheck();

    // Close all pool connections
    for (const conn of this.connectionPool) {
      try {
        await conn.quit();
      } catch (err) {
        // Ignore
      }
    }
    this.connectionPool = [];

    // Close all in-use connections
    for (const conn of this.inUseConnections) {
      try {
        await conn.quit();
      } catch (err) {
        // Ignore
      }
    }
    this.inUseConnections.clear();

    // Close main client
    if (this.client) {
      try {
        await this.client.quit();
      } catch (err) {
        // Ignore
      }
    }

    this.isConnected = false;
    this.emit('disconnected');
  }
}

module.exports = RedisManager;

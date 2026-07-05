/**
 * Advanced Connection Pool Manager
 * Issue #7: Connection pool management incomplete
 * - Implements proper pooling
 * - Configurable pool size
 * - Connection reuse and lifecycle management
 */

class ConnectionPool {
  constructor(options = {}) {
    this.minConnections = options.minConnections || 5;
    this.maxConnections = options.maxConnections || 100;
    this.idleTimeoutMs = options.idleTimeoutMs || 300000; // 5 minutes
    this.maxConnectionAgeMs = options.maxConnectionAgeMs || 3600000; // 1 hour
    this.checkIntervalMs = options.checkIntervalMs || 60000; // 1 minute
    this.connectionFactory = options.connectionFactory || null;
    this.logger = options.logger || console;

    this.available = []; // Available connections
    this.inUse = new Set(); // Connections currently in use
    this.all = new Map(); // All connections: id -> connection
    this.connectionIdCounter = 0;
    this.stats = {
      created: 0,
      destroyed: 0,
      reused: 0,
      failed: 0,
      poolSize: 0,
      availableCount: 0,
      inUseCount: 0
    };
    this.maintenanceInterval = null;
  }

  /**
   * Initialize the connection pool
   */
  async initialize() {
    // Create minimum connections
    const promises = [];
    for (let i = 0; i < this.minConnections; i++) {
      promises.push(this._createConnection());
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;

    this.logger.info(
      `[ConnectionPool] Initialized with ${successful}/${this.minConnections} connections`
    );

    // Start maintenance
    this.startMaintenance();

    return { initialized: successful };
  }

  /**
   * Get a connection from the pool
   */
  async acquire(timeout = 30000) {
    // Try to get available connection
    if (this.available.length > 0) {
      const conn = this.available.shift();
      this.inUse.add(conn);
      this.stats.reused++;

      this.logger.debug(
        `[ConnectionPool] Reusing connection ${conn.id} (available: ${this.available.length}, in use: ${this.inUse.size})`
      );

      return {
        connection: conn,
        connectionId: conn.id,
        release: () => this.release(conn.id)
      };
    }

    // Check if we can create new connection
    if (this.all.size < this.maxConnections) {
      try {
        const conn = await this._createConnection();
        this.inUse.add(conn);

        this.logger.debug(
          `[ConnectionPool] Created new connection ${conn.id} (total: ${this.all.size})`
        );

        return {
          connection: conn,
          connectionId: conn.id,
          release: () => this.release(conn.id)
        };
      } catch (error) {
        this.stats.failed++;
        this.logger.error(
          `[ConnectionPool] Failed to create connection: ${error.message}`
        );
        throw new Error('Connection pool exhausted and unable to create new connection');
      }
    }

    // Wait for connection to become available
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.available.length > 0) {
        const conn = this.available.shift();
        this.inUse.add(conn);
        this.stats.reused++;

        this.logger.debug(
          `[ConnectionPool] Acquired available connection ${conn.id} (waited ${Date.now() - startTime}ms)`
        );

        return {
          connection: conn,
          connectionId: conn.id,
          release: () => this.release(conn.id)
        };
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Connection pool acquisition timeout (${timeout}ms)`);
  }

  /**
   * Release a connection back to the pool
   */
  release(connectionId) {
    const conn = this.all.get(connectionId);
    if (!conn) {
      this.logger.warn(`[ConnectionPool] Connection not found: ${connectionId}`);
      return false;
    }

    if (!this.inUse.has(conn)) {
      this.logger.warn(
        `[ConnectionPool] Connection ${connectionId} not in use set`
      );
      return false;
    }

    this.inUse.delete(conn);
    conn.lastUsed = Date.now();

    // Check if connection is healthy
    if (this._isConnectionHealthy(conn)) {
      this.available.push(conn);
      this.logger.debug(
        `[ConnectionPool] Released connection ${connectionId} (available: ${this.available.length}, in use: ${this.inUse.size})`
      );
    } else {
      this._destroyConnection(connectionId);
      this.logger.warn(
        `[ConnectionPool] Destroyed unhealthy connection ${connectionId}`
      );
    }

    return true;
  }

  /**
   * Create a new connection
   * @private
   */
  async _createConnection() {
    const connectionId = ++this.connectionIdCounter;

    let connection = null;
    if (this.connectionFactory) {
      connection = await this.connectionFactory();
    } else {
      connection = this._createDefaultConnection();
    }

    const conn = {
      id: connectionId,
      connection,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 0,
      healthy: true
    };

    this.all.set(connectionId, conn);
    this.stats.created++;
    this.stats.poolSize = this.all.size;

    return conn;
  }

  /**
   * Create default connection object (can be overridden)
   * @private
   */
  _createDefaultConnection() {
    return {
      created: Date.now(),
      active: true
    };
  }

  /**
   * Destroy a connection
   * @private
   */
  async _destroyConnection(connectionId) {
    const conn = this.all.get(connectionId);
    if (!conn) return;

    // Remove from available/in-use
    const idx = this.available.findIndex(c => c.id === connectionId);
    if (idx !== -1) {
      this.available.splice(idx, 1);
    }
    this.inUse.delete(conn);

    // Cleanup
    if (conn.connection && typeof conn.connection.destroy === 'function') {
      try {
        await conn.connection.destroy();
      } catch (error) {
        this.logger.warn(
          `[ConnectionPool] Error destroying connection ${connectionId}: ${error.message}`
        );
      }
    }

    this.all.delete(connectionId);
    this.stats.destroyed++;
    this.stats.poolSize = this.all.size;

    this.logger.debug(`[ConnectionPool] Destroyed connection ${connectionId}`);
  }

  /**
   * Check if connection is healthy
   * @private
   */
  _isConnectionHealthy(conn) {
    // Check age
    if (conn.createdAt && (Date.now() - conn.createdAt) > this.maxConnectionAgeMs) {
      return false;
    }

    // Check if connection has custom health check
    if (conn.connection && typeof conn.connection.isHealthy === 'function') {
      return conn.connection.isHealthy();
    }

    return conn.healthy !== false;
  }

  /**
   * Start periodic maintenance
   */
  startMaintenance() {
    if (this.maintenanceInterval) return;

    this.maintenanceInterval = setInterval(() => {
      this._performMaintenance();
    }, this.checkIntervalMs);

    this.logger.info(
      `[ConnectionPool] Started maintenance checks every ${this.checkIntervalMs}ms`
    );
  }

  /**
   * Stop periodic maintenance
   */
  stopMaintenance() {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
      this.logger.info('[ConnectionPool] Stopped maintenance checks');
    }
  }

  /**
   * Perform maintenance: remove idle connections, check health
   * @private
   */
  async _performMaintenance() {
    const now = Date.now();
    const toRemove = [];

    // Check available connections
    for (let i = this.available.length - 1; i >= 0; i--) {
      const conn = this.available[i];
      const idleSince = now - conn.lastUsed;

      // Remove if idle too long
      if (idleSince > this.idleTimeoutMs) {
        toRemove.push(conn.id);
        this.available.splice(i, 1);
      }
      // Remove if too old
      else if ((now - conn.createdAt) > this.maxConnectionAgeMs) {
        toRemove.push(conn.id);
        this.available.splice(i, 1);
      }
      // Remove if unhealthy
      else if (!this._isConnectionHealthy(conn)) {
        toRemove.push(conn.id);
        this.available.splice(i, 1);
      }
    }

    // Destroy removed connections
    for (const connectionId of toRemove) {
      await this._destroyConnection(connectionId);
    }

    // Maintain minimum pool size
    while (this.available.length + this.inUse.size < this.minConnections) {
      try {
        const conn = await this._createConnection();
        this.available.push(conn);
      } catch (error) {
        this.logger.warn(
          `[ConnectionPool] Failed to maintain minimum pool size: ${error.message}`
        );
        break;
      }
    }

    if (toRemove.length > 0) {
      this.logger.debug(
        `[ConnectionPool] Maintenance: removed ${toRemove.length} connections`
      );
    }
  }

  /**
   * Drain the pool (wait for all connections to be released)
   */
  async drain(timeoutMs = 30000) {
    const startTime = Date.now();

    while (this.inUse.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(`Pool drain timeout: ${this.inUse.size} connections still in use`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger.info('[ConnectionPool] Drained: all connections released');
  }

  /**
   * Shutdown the pool
   */
  async shutdown() {
    this.stopMaintenance();

    // Drain in-use connections
    try {
      await this.drain(10000);
    } catch (error) {
      this.logger.warn(`[ConnectionPool] Error draining pool: ${error.message}`);
    }

    // Destroy all connections
    const connectionIds = Array.from(this.all.keys());
    const promises = connectionIds.map(id => this._destroyConnection(id));

    await Promise.allSettled(promises);

    this.available = [];
    this.inUse.clear();
    this.all.clear();

    this.logger.info('[ConnectionPool] Shutdown complete');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.stats,
      availableCount: this.available.length,
      inUseCount: this.inUse.size,
      totalCount: this.all.size,
      utilization: `${((this.inUse.size / this.maxConnections) * 100).toFixed(2)}%`,
      poolHealth: {
        minConnections: this.minConnections,
        maxConnections: this.maxConnections,
        healthy: this.inUse.size < this.maxConnections,
        hasCapacity: this.all.size < this.maxConnections
      }
    };
  }

  /**
   * Get connection details
   */
  getConnections() {
    const connections = [];

    for (const [id, conn] of this.all) {
      const age = Date.now() - conn.createdAt;
      const idle = Date.now() - conn.lastUsed;

      connections.push({
        id: conn.id,
        age: `${(age / 1000).toFixed(2)}s`,
        idle: `${(idle / 1000).toFixed(2)}s`,
        useCount: conn.useCount,
        status: this.inUse.has(conn) ? 'in-use' : 'available',
        healthy: this._isConnectionHealthy(conn)
      });
    }

    return connections;
  }

  /**
   * Force close a connection
   */
  async forceClose(connectionId) {
    const conn = this.all.get(connectionId);
    if (!conn) return false;

    if (this.inUse.has(conn)) {
      this.inUse.delete(conn);
    }

    await this._destroyConnection(connectionId);
    return true;
  }
}

module.exports = { ConnectionPool };

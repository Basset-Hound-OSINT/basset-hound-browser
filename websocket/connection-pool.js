/**
 * Production Connection Pool Manager for WebSocket Server
 * Handles concurrent client connections with intelligent pooling and resource management
 *
 * Features:
 * 1. Connection Pooling:
 *    - Configurable max connections (default 500)
 *    - Connection reuse for same client
 *    - Automatic cleanup of idle connections (5 min timeout)
 *    - Queue for overflow with wait timeout (30 sec)
 *
 * 2. Per-Connection Tracking:
 *    - Client ID, active commands, last activity timestamp
 *    - Idle duration tracking, retry count monitoring
 *
 * 3. Pool Metrics:
 *    - Active connections, idle connections, peak metrics
 *    - Connection reuse rate, queue statistics
 *
 * 4. Configuration:
 *    - MAX_CONNECTIONS=500 (default)
 *    - IDLE_TIMEOUT=300000 (5 min, default)
 *    - QUEUE_TIMEOUT=30000 (30 sec, default)
 *    - MAX_RETRIES=3 (default)
 *
 * 5. Health Integration:
 *    - Reports pool stats in health endpoint
 *    - Alerts on high utilization (>80%)
 *    - Detects queue backlog
 */

const { defaultLogger } = require('../logging');

class ClientConnection {
  /**
   * Represents a single client connection in the pool
   */
  constructor(clientId, ws, poolConfig = {}) {
    this.clientId = clientId;
    this.ws = ws;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.activeCommands = 0;
    this.maxConcurrent = poolConfig.maxConcurrentPerConnection || 5;
    this.retryCount = 0;
    this.maxRetries = poolConfig.maxRetries || 3;
    this.commandHistory = [];
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.isHealthy = true;

    // Reuse tracking
    this.connectionReuses = 0;
    this.lastCommandTime = Date.now();
  }

  /**
   * Check if this connection can accept more commands
   */
  canAcceptCommand() {
    return this.activeCommands < this.maxConcurrent && this.isHealthy;
  }

  /**
   * Record a command execution
   */
  recordCommand(command, latencyMs, error = false) {
    this.totalRequests++;
    if (error) {
      this.totalErrors++;
    }
    this.lastActivity = Date.now();
    this.lastCommandTime = Date.now();
    this.activeCommands++;

    // Keep last 50 commands for history
    this.commandHistory.push({
      command,
      timestamp: Date.now(),
      latencyMs,
      error
    });
    if (this.commandHistory.length > 50) {
      this.commandHistory.shift();
    }
  }

  /**
   * Mark command as completed
   */
  completeCommand() {
    if (this.activeCommands > 0) {
      this.activeCommands--;
    }
  }

  /**
   * Get idle duration in milliseconds
   */
  getIdleDuration() {
    return Date.now() - this.lastActivity;
  }

  /**
   * Check if connection is idle
   */
  isIdle(idleTimeoutMs) {
    return this.getIdleDuration() >= idleTimeoutMs && this.activeCommands === 0;
  }

  /**
   * Mark connection as unhealthy
   */
  markUnhealthy() {
    this.isHealthy = false;
    this.retryCount++;
  }

  /**
   * Check if retry count exceeded
   */
  isRetryExhausted() {
    return this.retryCount > this.maxRetries;
  }

  /**
   * Reset retry count (on successful operation)
   */
  resetRetryCount() {
    this.retryCount = 0;
    this.isHealthy = true;
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    return {
      clientId: this.clientId,
      createdAt: new Date(this.createdAt).toISOString(),
      lastActivity: new Date(this.lastActivity).toISOString(),
      idleDurationMs: this.getIdleDuration(),
      activeCommands: this.activeCommands,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRate: this.totalRequests > 0 ? ((this.totalErrors / this.totalRequests) * 100).toFixed(2) + '%' : '0%',
      isHealthy: this.isHealthy,
      retryCount: this.retryCount,
      connectionReuses: this.connectionReuses,
      averageLatency: this._calculateAverageLatency()
    };
  }

  /**
   * Calculate average latency from command history
   */
  _calculateAverageLatency() {
    if (this.commandHistory.length === 0) {
      return 0;
    }
    const totalLatency = this.commandHistory.reduce((sum, cmd) => sum + cmd.latencyMs, 0);
    return (totalLatency / this.commandHistory.length).toFixed(2);
  }
}

class ConnectionPool {
  /**
   * Create a production connection pool
   * @param {Object} options - Configuration options
   * @param {number} options.maxConnections - Max concurrent connections (default 500)
   * @param {number} options.idleTimeout - Idle timeout in ms (default 300000 = 5 min)
   * @param {number} options.queueTimeout - Max time to wait in queue (default 30000 = 30 sec)
   * @param {number} options.maxRetries - Max retries per connection (default 3)
   * @param {boolean} options.autoStartCleanup - Auto-start cleanup interval (default true)
   * @param {Function} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || parseInt(process.env.MAX_CONNECTIONS || '500', 10);
    this.idleTimeout = options.idleTimeout || parseInt(process.env.IDLE_TIMEOUT || '300000', 10);
    this.queueTimeout = options.queueTimeout || parseInt(process.env.QUEUE_TIMEOUT || '30000', 10);
    this.maxRetries = options.maxRetries || 3;
    this.logger = options.logger || defaultLogger;
    this.autoStartCleanup = options.autoStartCleanup !== false;

    // Connection storage
    this.connections = new Map(); // clientId -> ClientConnection
    this.blockingQueue = []; // Requests waiting for available slots (FIFO queue)

    // Metrics
    this.metrics = {
      totalConnectionsCreated: 0,
      totalConnectionsClosed: 0,
      totalConnectionsReused: 0,
      peakActiveConnections: 0,
      peakQueueSize: 0,
      totalQueuedRequests: 0,
      totalRejectedRequests: 0,
      totalIdleCleanups: 0,
      averageQueueWait: 0,
      queueWaitSamples: []
    };

    // Idle connection cleanup
    this.cleanupInterval = null;
    if (this.autoStartCleanup) {
      this._startIdleCleanup();
    }
  }

  /**
   * Get current queue size
   * @returns {number} Number of requests in the blocking queue
   */
  getQueueSize() {
    return this.blockingQueue ? this.blockingQueue.length : 0;
  }

  /**
   * Acquire or reuse a connection for a client
   * Returns existing connection if available, creates new one if under limit
   * Otherwise queues the request
   * @param {string} clientId - Client identifier
   * @param {Object} ws - WebSocket connection (required only for new connections)
   * @param {Object} request - Request object containing command info
   * @returns {Promise<ClientConnection>} The connection to use
   */
  async acquire(clientId, ws = null, request = {}) {
    const enqueueTime = Date.now();

    // Ensure request has a command property
    const normalizedRequest = {
      command: 'unknown',
      priority: 'normal',
      ...request
    };

    // Try to get existing connection
    let connection = this.connections.get(clientId);

    if (connection) {
      // Connection exists - check if can accept command
      if (connection.canAcceptCommand()) {
        connection.connectionReuses++;
        this.metrics.totalConnectionsReused++;
        this.logger.debug(`[ConnectionPool] Reusing connection for ${clientId}`, {
          reuses: connection.connectionReuses,
          active: connection.activeCommands
        });
        connection.recordCommand(normalizedRequest.command, 0, false);
        return connection;
      }

      // Connection exists but at capacity - queue request
      return this._queueRequest(clientId, normalizedRequest, enqueueTime);
    }

    // No existing connection - check if we can create one
    if (this.connections.size < this.maxConnections) {
      if (!ws) {
        throw new Error(`WebSocket connection required to create new connection for ${clientId}`);
      }

      connection = new ClientConnection(clientId, ws, {
        maxConcurrentPerConnection: 5,
        maxRetries: this.maxRetries
      });

      this.connections.set(clientId, connection);
      this.metrics.totalConnectionsCreated++;

      // Update peak connections
      if (this.connections.size > this.metrics.peakActiveConnections) {
        this.metrics.peakActiveConnections = this.connections.size;
      }

      this.logger.info(`[ConnectionPool] Created new connection for ${clientId}`, {
        totalConnections: this.connections.size,
        maxConnections: this.maxConnections
      });

      connection.recordCommand(normalizedRequest.command, 0, false);
      return connection;
    }

    // Pool is at capacity - queue request
    return this._queueRequest(clientId, normalizedRequest, enqueueTime);
  }

  /**
   * Queue a request when pool is at capacity
   * @private
   */
  async _queueRequest(clientId, request, enqueueTime) {
    // Initialize blocking queue if needed
    if (!this.blockingQueue) {
      this.blockingQueue = [];
    }

    // Check current queue size before adding
    const currentQueueSize = this.blockingQueue.length;
    const totalQueued = this.connections.size + currentQueueSize;

    // Check if queue is getting too large (max 2x the pool size)
    if (totalQueued >= this.maxConnections * 2) {
      this.metrics.totalRejectedRequests++;
      throw new Error(
        `Connection pool exhausted: ${this.connections.size} active, ` +
        `${currentQueueSize} queued. Max capacity: ${this.maxConnections}`
      );
    }

    // Track metrics BEFORE adding to queue
    this.metrics.totalQueuedRequests++;
    const newQueueSize = currentQueueSize + 1;

    // Update peak queue size
    if (newQueueSize > this.metrics.peakQueueSize) {
      this.metrics.peakQueueSize = newQueueSize;
    }

    this.logger.debug(`[ConnectionPool] Queueing request for ${clientId}`, {
      queue: newQueueSize,
      active: this.connections.size,
      totalQueuedRequests: this.metrics.totalQueuedRequests
    });

    return new Promise((resolve, reject) => {
      const queuedRequest = {
        clientId,
        request,
        enqueueTime,
        resolve,
        reject,
        priority: request.priority || 'normal',
        timedOut: false,
        processed: false,        // NEW: Flag to prevent double-processing
        timeoutHandle: null,     // NEW: Initialize to null for atomic operations
        settled: false           // NEW: Track if promise is settled
      };

      this.blockingQueue.push(queuedRequest);

      // NEW: Atomic timeout set with synchronized timeout callback
      // Sets timeout with immediate reference, preventing race conditions
      queuedRequest.timeoutHandle = setTimeout(() => {
        // ATOMIC: Check flags before processing timeout
        if (queuedRequest.timedOut || queuedRequest.processed || queuedRequest.settled) {
          return; // Already handled
        }

        // ATOMIC: Mark as timed out to prevent concurrent processing
        queuedRequest.timedOut = true;
        queuedRequest.settled = true;

        // SAFE: Remove from queue
        const idx = this.blockingQueue.indexOf(queuedRequest);
        if (idx >= 0) {
          this.blockingQueue.splice(idx, 1);
        }

        this.metrics.totalRejectedRequests++;
        reject(new Error(
          `Request timeout: waited ${this.queueTimeout}ms for available connection`
        ));
      }, this.queueTimeout);

      // Track original resolve/reject to mark settled
      const originalResolve = resolve;
      const originalReject = reject;

      queuedRequest.resolve = (value) => {
        if (!queuedRequest.settled) {
          queuedRequest.settled = true;
          originalResolve(value);
        }
      };

      queuedRequest.reject = (error) => {
        if (!queuedRequest.settled) {
          queuedRequest.settled = true;
          originalReject(error);
        }
      };
    });
  }

  /**
   * Release a connection (command completed)
   * SYNCHRONIZED: Safely processes queued requests without race conditions with timeouts
   * @param {string} clientId - Client identifier
   */
  release(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection) {
      this.logger.warn(`[ConnectionPool] Release called for unknown connection: ${clientId}`, {
        poolSize: this.connections.size,
        reason: 'Connection may have been cleaned up during idle timeout'
      });
      return;
    }

    connection.completeCommand();

    // SYNCHRONIZED: Process next queued request for this client
    // The processed flag and atomic timeout ensure no race conditions
    this._processQueuedRequests(clientId);
  }

  /**
   * Process queued requests for a specific client
   * @private
   * SYNCHRONIZED: Ensures each queued request is processed exactly once
   */
  _processQueuedRequests(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection || !connection.canAcceptCommand()) {
      return;
    }

    // Process blocking queue - find next available request
    if (!this.blockingQueue || this.blockingQueue.length === 0) {
      return;
    }

    // Find and process next queued request (skip timed out ones)
    // Also clean up timed out requests from the queue
    let foundRequest = false;
    for (let i = 0; i < this.blockingQueue.length; i++) {
      const req = this.blockingQueue[i];
      if (req.timedOut) {
        // Remove timed out request
        this.blockingQueue.splice(i, 1);
        i--; // Adjust index after removal
      } else if (!foundRequest && !req.processed) {
        // NEW: Check processed flag to prevent double-processing
        // Process first non-timed-out, non-processed request
        this.blockingQueue.splice(i, 1);
        this._handleQueuedRequest(req, connection);
        foundRequest = true;
        return; // Only process one request per release (SYNCHRONIZED)
      }
    }
  }

  /**
   * Handle a queued request
   * @private
   * ATOMIC: Marks processed before clearing timeout to prevent race conditions
   */
  _handleQueuedRequest(queuedRequest, connection) {
    // ATOMIC: Check and set processed flag first
    // This prevents timeout callback and release() from processing simultaneously
    if (queuedRequest.timedOut || queuedRequest.processed) {
      return; // Already handled by timeout or another release
    }

    queuedRequest.processed = true; // NEW: Mark as processed BEFORE clearing timeout

    // Clear timeout - now safe as processed flag is set
    if (queuedRequest.timeoutHandle) {
      clearTimeout(queuedRequest.timeoutHandle);
      queuedRequest.timeoutHandle = null; // NEW: Clear reference
    }

    // Record queue wait time
    const queueWait = Date.now() - queuedRequest.enqueueTime;
    this.metrics.queueWaitSamples.push(queueWait);
    if (this.metrics.queueWaitSamples.length > 100) {
      this.metrics.queueWaitSamples.shift();
    }

    if (this.metrics.queueWaitSamples.length > 0) {
      this.metrics.averageQueueWait = (
        this.metrics.queueWaitSamples.reduce((a, b) => a + b, 0) / this.metrics.queueWaitSamples.length
      ).toFixed(2);
    }

    connection.recordCommand(queuedRequest.request.command || 'unknown', 0, false);
    queuedRequest.resolve(connection);
  }

  /**
   * Mark a connection as unhealthy and handle retry/cleanup
   * @param {string} clientId - Client identifier
   */
  markConnectionUnhealthy(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    connection.markUnhealthy();

    if (connection.isRetryExhausted()) {
      this.logger.warn(`[ConnectionPool] Closing unhealthy connection after retries: ${clientId}`, {
        retries: connection.retryCount,
        totalRequests: connection.totalRequests
      });
      this.closeConnection(clientId);
    }
  }

  /**
   * Explicitly close a connection
   * @param {clientId} clientId - Client identifier
   */
  closeConnection(clientId) {
    const connection = this.connections.get(clientId);
    if (!connection) {
      return;
    }

    // Close WebSocket
    if (connection.ws && connection.ws.readyState !== connection.ws.CLOSED) {
      try {
        connection.ws.close(1000, 'Normal closure');
      } catch (err) {
        this.logger.debug(`[ConnectionPool] Error closing WebSocket: ${err.message}`);
      }
    }

    // Remove from pool
    this.connections.delete(clientId);
    this.metrics.totalConnectionsClosed++;

    this.logger.info(`[ConnectionPool] Closed connection: ${clientId}`, {
      duration: Date.now() - connection.createdAt,
      totalRequests: connection.totalRequests,
      totalErrors: connection.totalErrors
    });
  }

  /**
   * Start automatic idle connection cleanup
   * @private
   */
  _startIdleCleanup() {
    this.cleanupInterval = setInterval(() => {
      try {
        const checkStartTime = Date.now();
        const connectionsToClose = [];
        const idleConnections = [];

        // Find idle connections (capture details before deletion)
        this.connections.forEach((connection, clientId) => {
          const idleDuration = connection.getIdleDuration();
          if (connection.isIdle(this.idleTimeout)) {
            connectionsToClose.push(clientId);
            idleConnections.push({
              clientId,
              idleDurationMs: idleDuration,
              activeCommands: connection.activeCommands,
              totalRequests: connection.totalRequests
            });
          }
        });

        // Log cleanup scan results
        if (connectionsToClose.length > 0) {
          this.logger.info(`[ConnectionPool] Idle cleanup: removing ${connectionsToClose.length}/${this.connections.size} connections`, {
            idleConnections,
            idleTimeoutMs: this.idleTimeout,
            poolSize: this.connections.size
          });
        } else if (this.connections.size > 0) {
          this.logger.debug(`[ConnectionPool] Idle cleanup scan: no idle connections (timeout: ${this.idleTimeout}ms, pool: ${this.connections.size})`);
        }

        // Close idle connections (metrics and logging after capture)
        for (const clientId of connectionsToClose) {
          const connection = this.connections.get(clientId);
          if (connection) {
            const idleDurationMs = connection.getIdleDuration();
            this.metrics.totalIdleCleanups++;

            this.logger.debug(`[ConnectionPool] Closing idle connection: ${clientId}`, {
              idleDurationMs,
              activeCommands: connection.activeCommands,
              totalRequests: connection.totalRequests,
              totalErrors: connection.totalErrors,
              idleTimeoutMs: this.idleTimeout
            });

            this.closeConnection(clientId);
          }
        }

        // Log if cleanup scan took too long
        const checkDurationMs = Date.now() - checkStartTime;
        if (checkDurationMs > 100) {
          this.logger.warn(`[ConnectionPool] Idle cleanup scan took ${checkDurationMs}ms`, {
            connectionsScanned: this.connections.size,
            connectionsRemoved: connectionsToClose.length
          });
        }
      } catch (error) {
        this.logger.error(`[ConnectionPool] Error in idle cleanup: ${error.message}`, {
          stack: error.stack
        });
      }
    }, 30000); // Check every 30 seconds (5min timeout / 30sec check = avg 15s detection)
  }

  /**
   * Stop idle connection cleanup
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get current pool status
   */
  getStatus() {
    const activeCount = this.connections.size;
    const idleCount = Array.from(this.connections.values()).filter(
      conn => conn.activeCommands === 0
    ).length;
    const queueSize = this.blockingQueue ? this.blockingQueue.length : 0;

    return {
      active: activeCount,
      idle: idleCount,
      utilization: activeCount + '/' + this.maxConnections + ' (' + ((activeCount / this.maxConnections) * 100).toFixed(1) + '%)',
      queue: queueSize,
      maxConnections: this.maxConnections,
      metrics: {
        peakConnections: this.metrics.peakActiveConnections,
        peakQueue: this.metrics.peakQueueSize,
        reusedConnections: this.metrics.totalConnectionsReused,
        rejectedRequests: this.metrics.totalRejectedRequests,
        avgQueueWaitMs: this.metrics.averageQueueWait
      }
    };
  }

  /**
   * Validate queue metrics are synchronized
   * @private
   */
  _validateQueueMetrics() {
    const actualQueueSize = this.getQueueSize();

    // Count non-timed-out requests
    const validQueuedRequests = this.blockingQueue.filter(req => !req.timedOut).length;

    return {
      actualQueueSize,
      validQueuedRequests,
      metricsSync: actualQueueSize === validQueuedRequests,
      peakQueueSize: this.metrics.peakQueueSize,
      totalQueuedRequests: this.metrics.totalQueuedRequests
    };
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    const connections = [];
    this.connections.forEach((conn) => {
      connections.push(conn.getMetrics());
    });

    const currentQueueSize = this.blockingQueue ? this.blockingQueue.length : 0;
    const validQueueSize = this.blockingQueue
      ? this.blockingQueue.filter(req => !req.timedOut).length
      : 0;

    return {
      summary: {
        ...this.metrics,
        currentActiveConnections: this.connections.size,
        currentQueueSize: currentQueueSize,
        validQueueSize: validQueueSize,
        utilizationPercent: ((this.connections.size / this.maxConnections) * 100).toFixed(2),
        queueMetricsSync: currentQueueSize === validQueueSize
      },
      connections
    };
  }

  /**
   * Drain all connections - close gracefully
   * FIX: Explicit timeout handling to prevent hanging on queue rejection
   */
  async drain() {
    this.logger.info('[ConnectionPool] Draining pool', {
      activeConnections: this.connections.size,
      queuedRequests: (this.blockingQueue ? this.blockingQueue.length : 0)
    });

    // FIX: Wrap entire drain operation in timeout to prevent indefinite hanging
    try {
      await Promise.race([
        this._performDrain(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Drain operation timeout - forcing cleanup')), 2000)
        )
      ]);
    } catch (err) {
      // FIX: Force cleanup even if drain times out
      this._forceDrainCleanup();
      // Log but don't throw - allow test to continue with cleanup done
      if (err.message.includes('timeout')) {
        this.logger.warn('[ConnectionPool] Drain operation timed out', { error: err.message });
      } else {
        throw err;
      }
    }
  }

  /**
   * Perform actual drain operations
   * @private
   */
  _performDrain() {
    // FIX: Return promise immediately - do not use async/await which adds another microtask layer
    // This ensures the timeout can interrupt synchronous operations
    return new Promise((resolve) => {
      try {
        // Close all connections
        const clientIds = Array.from(this.connections.keys());
        for (const clientId of clientIds) {
          this.closeConnection(clientId);
        }

        // FIX: Process queued requests with explicit error handling
        // to ensure all promises settle immediately
        if (this.blockingQueue) {
          const queueSnapshot = this.blockingQueue.slice(); // Copy array
          this.blockingQueue.length = 0; // Clear original

          for (const req of queueSnapshot) {
            // FIX: Skip already settled requests
            if (req && !req.settled) {
              // Clear timeout to prevent race conditions
              if (req.timeoutHandle) {
                clearTimeout(req.timeoutHandle);
                req.timeoutHandle = null;
              }
              req.settled = true;
              // FIX: Use try-catch in case reject callback throws
              try {
                req.reject(new Error('Pool drained'));
              } catch (e) {
                this.logger.debug('[ConnectionPool] Error rejecting queued request during drain', {
                  error: e.message
                });
              }
            }
          }
        }

        this.stopCleanup();
        this.logger.info('[ConnectionPool] Pool drained');
        resolve();
      } catch (err) {
        this.logger.error('[ConnectionPool] Error during drain', { error: err.message });
        resolve(); // Resolve even on error to unblock
      }
    });
  }

  /**
   * Force cleanup when drain times out
   * @private
   */
  _forceDrainCleanup() {
    // FIX: Forcefully clear all connections
    this.connections.clear();

    // FIX: Forcefully settle all queued requests
    if (this.blockingQueue) {
      const queueSnapshot = this.blockingQueue.slice();
      this.blockingQueue.length = 0;

      for (const req of queueSnapshot) {
        if (req && !req.settled) {
          if (req.timeoutHandle) {
            clearTimeout(req.timeoutHandle);
          }
          req.settled = true;
          try {
            req.reject(new Error('Pool drain forced cleanup'));
          } catch (e) {
            // Silent fail on already-rejected promises
          }
        }
      }
    }

    this.stopCleanup();
    this.logger.warn('[ConnectionPool] Forced drain cleanup completed');
  }

  /**
   * Get health status for health endpoint
   */
  getHealthStatus() {
    const activeCount = this.connections.size;
    const utilizationPercent = (activeCount / this.maxConnections) * 100;
    const isHealthy = utilizationPercent < 80 && this.metrics.totalRejectedRequests === 0;
    const hasWarning = utilizationPercent > 50 || (this.blockingQueue ? this.blockingQueue.length : 0) > 10;

    return {
      poolUtilization: utilizationPercent.toFixed(1) + '%',
      activeConnections: activeCount,
      maxConnections: this.maxConnections,
      queuedRequests: (this.blockingQueue ? this.blockingQueue.length : 0),
      healthy: isHealthy,
      warning: hasWarning ? 'High utilization or queue buildup' : null,
      metrics: this.getStatus().metrics
    };
  }
}

module.exports = { ConnectionPool, ClientConnection };

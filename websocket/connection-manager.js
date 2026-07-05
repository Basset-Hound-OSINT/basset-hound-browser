/**
 * Connection Lifecycle Manager
 * Implements forced cleanup for zombie/dead connections with timeout handling
 *
 * Features:
 * - 5-minute grace period before forced termination
 * - Immediate cleanup from all collections
 * - Complete event listener removal
 * - Browser instance cleanup for owned connections
 * - Monitoring hooks for zombie connections
 */

const { defaultLogger } = require('../logging');

class ConnectionLifecycleManager {
  /**
   * Create a connection lifecycle manager
   * @param {Object} options - Configuration options
   * @param {number} options.gracePeriodMs - Grace period before force termination (default: 5min)
   * @param {number} options.checkIntervalMs - How often to check for zombie connections
   * @param {Function} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.gracePeriodMs = options.gracePeriodMs || 300000; // 5 minutes
    this.checkIntervalMs = options.checkIntervalMs || 30000; // 30 seconds
    this.logger = options.logger || defaultLogger;

    // Connection tracking
    this.connectionMetadata = new Map(); // clientId -> { createdAt, lastActivity, owned }
    this.zombieConnections = new Map(); // clientId -> count
    this.cleanupHooks = []; // Cleanup handlers

    // Monitoring
    this.metrics = {
      totalConnections: 0,
      zombiesDetected: 0,
      zombiesForceTerminated: 0,
      cleanupErrors: 0,
      avgConnectionDuration: 0,
      peakZombieCount: 0,
      totalZombieMs: 0,
      zombieCountSamples: []
    };

    // Thresholds for alerts
    this.alertThresholds = {
      highZombieCount: options.highZombieCount || 10,
      memoryLeakDetectionMs: options.memoryLeakDetectionMs || 600000 // 10 minutes
    };
  }

  /**
   * Register a connection to track its lifecycle
   * @param {string} clientId - Unique client identifier
   * @param {Object} ws - WebSocket connection
   * @param {boolean} browserOwned - Whether the connection owns the browser instance
   */
  registerConnection(clientId, ws, browserOwned = false) {
    if (!clientId || !ws) {
      return;
    }

    this.connectionMetadata.set(clientId, {
      clientId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      ws,
      browserOwned,
      isAlive: true,
      pingCount: 0,
      pongCount: 0,
      messageCount: 0
    });

    this.metrics.totalConnections++;
    this.logger.debug(`[ConnectionManager] Registered connection: ${clientId}`, {
      browserOwned,
      gracePeriodMs: this.gracePeriodMs
    });
  }

  /**
   * Update last activity timestamp for a connection
   * @param {string} clientId - Client identifier
   */
  recordActivity(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (metadata) {
      metadata.lastActivity = Date.now();
      metadata.messageCount++;
    }
  }

  /**
   * Record heartbeat sent to connection
   * @param {string} clientId - Client identifier
   */
  recordPing(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (metadata) {
      metadata.lastActivity = Date.now();
      metadata.pingCount++;
    }
  }

  /**
   * Record heartbeat response from connection
   * @param {string} clientId - Client identifier
   */
  recordPong(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (metadata) {
      metadata.lastActivity = Date.now();
      metadata.pongCount++;
      metadata.isAlive = true;
    }
  }

  /**
   * Mark connection as dead (failed heartbeat)
   * @param {string} clientId - Client identifier
   */
  markDead(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (metadata) {
      metadata.isAlive = false;
      this.zombieConnections.set(clientId, (this.zombieConnections.get(clientId) || 0) + 1);
      this.metrics.zombiesDetected++;
      this.logger.warn(`[ConnectionManager] Connection marked as dead: ${clientId}`, {
        lastActivity: new Date(metadata.lastActivity).toISOString(),
        idleFor: Date.now() - metadata.lastActivity,
        pongCount: metadata.pongCount
      });
    }
  }

  /**
   * Check if a connection is a zombie (unresponsive for grace period)
   * @param {string} clientId - Client identifier
   * @returns {boolean} True if connection is zombie
   */
  isZombie(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (!metadata) return false;

    const inactiveFor = Date.now() - metadata.lastActivity;
    const isZombie = !metadata.isAlive && inactiveFor > this.gracePeriodMs;

    return isZombie;
  }

  /**
   * Get zombie connection count
   * @returns {number} Number of detected zombies
   */
  getZombieCount() {
    let count = 0;
    this.connectionMetadata.forEach((metadata, clientId) => {
      if (this.isZombie(clientId)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Force terminate a zombie connection and cleanup all resources
   * @param {string} clientId - Client identifier
   * @param {Object} cleanupContext - Additional cleanup context
   * @returns {boolean} True if cleanup succeeded
   */
  forceTerminate(clientId, cleanupContext = {}) {
    try {
      const metadata = this.connectionMetadata.get(clientId);
      if (!metadata) {
        return false; // Already cleaned up
      }

      const { ws, browserOwned } = metadata;
      const inactiveFor = Date.now() - metadata.lastActivity;

      this.logger.info(`[ConnectionManager] Force terminating zombie: ${clientId}`, {
        inactiveFor,
        browserOwned,
        gracePeriod: this.gracePeriodMs
      });

      // 1. Remove all event listeners to prevent leaks
      if (ws && typeof ws.removeAllListeners === 'function') {
        ws.removeAllListeners();
      }

      // 2. Close WebSocket connection
      if (ws && ws.readyState !== ws.CLOSED && ws.readyState !== ws.CLOSING) {
        try {
          ws.close(4000, 'Zombie connection force terminated');
        } catch (err) {
          this.logger.debug(`[ConnectionManager] Error closing WebSocket: ${err.message}`);
        }
      }

      // 3. Call cleanup hooks (browser closure, resource cleanup)
      for (const hook of this.cleanupHooks) {
        try {
          hook(clientId, {
            metadata,
            browserOwned,
            inactiveFor,
            ...cleanupContext
          });
        } catch (err) {
          this.metrics.cleanupErrors++;
          this.logger.error(`[ConnectionManager] Cleanup hook error: ${err.message}`, {
            clientId,
            hook: hook.name || 'anonymous'
          });
        }
      }

      // 4. Clear metadata
      this.connectionMetadata.delete(clientId);
      this.zombieConnections.delete(clientId);

      this.metrics.zombiesForceTerminated++;
      this.logger.info(`[ConnectionManager] Zombie connection cleaned up: ${clientId}`);

      return true;
    } catch (error) {
      this.metrics.cleanupErrors++;
      this.logger.error(`[ConnectionManager] Force terminate error: ${error.message}`, {
        clientId,
        error
      });
      return false;
    }
  }

  /**
   * Unregister a connection (normal cleanup)
   * @param {string} clientId - Client identifier
   */
  unregisterConnection(clientId) {
    const metadata = this.connectionMetadata.get(clientId);
    if (metadata) {
      const duration = Date.now() - metadata.createdAt;

      // Update average connection duration
      const samples = this.metrics.zombieCountSamples.length || 1;
      this.metrics.avgConnectionDuration = (
        (this.metrics.avgConnectionDuration * (samples - 1) + duration) / samples
      );

      this.logger.debug(`[ConnectionManager] Unregistered connection: ${clientId}`, {
        duration,
        messages: metadata.messageCount,
        pings: metadata.pingCount,
        pongs: metadata.pongCount
      });

      this.connectionMetadata.delete(clientId);
      this.zombieConnections.delete(clientId);
    }
  }

  /**
   * Register a cleanup hook to execute during force termination
   * Hooks receive: (clientId, cleanupContext) => void
   * @param {Function} hook - Cleanup hook function
   */
  registerCleanupHook(hook) {
    if (typeof hook === 'function') {
      this.cleanupHooks.push(hook);
    }
  }

  /**
   * Start periodic zombie connection detection and cleanup
   * @param {Array<string>} allClientIds - Function to get current client IDs
   * @param {Object} cleanupContext - Additional cleanup context
   * @returns {NodeJS.Timeout} Interval handle (save for stopping)
   */
  startZombieDetection(allClientIds, cleanupContext = {}) {
    return setInterval(() => {
      try {
        const zombieCount = this.getZombieCount();

        // Update metrics
        this.metrics.zombieCountSamples.push(zombieCount);
        if (this.metrics.zombieCountSamples.length > 100) {
          this.metrics.zombieCountSamples.shift(); // Keep last 100 samples
        }
        this.metrics.peakZombieCount = Math.max(
          this.metrics.peakZombieCount,
          zombieCount
        );

        // Check for high zombie count
        if (zombieCount > this.alertThresholds.highZombieCount) {
          this.logger.warn(`[ConnectionManager] HIGH ZOMBIE COUNT: ${zombieCount} detected`, {
            threshold: this.alertThresholds.highZombieCount,
            gracePeriod: this.gracePeriodMs
          });
        }

        // Force terminate zombies
        const zombiesToTerminate = [];
        this.connectionMetadata.forEach((metadata, clientId) => {
          if (this.isZombie(clientId)) {
            zombiesToTerminate.push(clientId);
          }
        });

        // Execute cleanup for each zombie
        for (const clientId of zombiesToTerminate) {
          this.forceTerminate(clientId, cleanupContext);
        }

        // Log metrics periodically
        if (this.metrics.zombieCountSamples.length % 10 === 0) {
          this.logMetrics();
        }
      } catch (error) {
        this.logger.error(`[ConnectionManager] Error in zombie detection: ${error.message}`, {
          error
        });
      }
    }, this.checkIntervalMs);
  }

  /**
   * Stop zombie detection
   * @param {NodeJS.Timeout} detectionInterval - Interval handle from startZombieDetection
   */
  stopZombieDetection(detectionInterval) {
    if (detectionInterval) {
      clearInterval(detectionInterval);
    }
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics
   */
  getMetrics() {
    const zombieCount = this.getZombieCount();
    const activeCount = this.connectionMetadata.size;

    return {
      ...this.metrics,
      currentZombieCount: zombieCount,
      activeConnectionCount: activeCount,
      totalTrackedConnections: this.connectionMetadata.size,
      avgZombieCount: this.metrics.zombieCountSamples.length > 0
        ? this.metrics.zombieCountSamples.reduce((a, b) => a + b, 0) / this.metrics.zombieCountSamples.length
        : 0
    };
  }

  /**
   * Log metrics for monitoring
   */
  logMetrics() {
    const metrics = this.getMetrics();
    this.logger.info('[ConnectionManager] Metrics', {
      activeConnections: metrics.activeConnectionCount,
      currentZombies: metrics.currentZombieCount,
      totalZombiesDetected: metrics.zombiesDetected,
      forceTerminated: metrics.zombiesForceTerminated,
      cleanupErrors: metrics.cleanupErrors,
      avgConnectionDuration: Math.round(metrics.avgConnectionDuration),
      peakZombieCount: metrics.peakZombieCount
    });
  }

  /**
   * Get detailed status of all connections
   * @returns {Array} Connection status details
   */
  getConnectionStatus() {
    const now = Date.now();
    const status = [];

    this.connectionMetadata.forEach((metadata, clientId) => {
      const inactiveFor = now - metadata.lastActivity;
      const isZombie = this.isZombie(clientId);

      status.push({
        clientId,
        isAlive: metadata.isAlive,
        isZombie,
        duration: now - metadata.createdAt,
        inactiveFor,
        browserOwned: metadata.browserOwned,
        messageCount: metadata.messageCount,
        pings: metadata.pingCount,
        pongs: metadata.pongCount,
        createdAt: new Date(metadata.createdAt).toISOString(),
        lastActivity: new Date(metadata.lastActivity).toISOString()
      });
    });

    return status;
  }
}

module.exports = { ConnectionLifecycleManager };

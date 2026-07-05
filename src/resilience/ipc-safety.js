/**
 * Basset Hound Browser - IPC Safety & Deduplication
 * v12.5.0 Phase 2 - Deployment Hardening
 *
 * Eliminates IPC race conditions and double-execution
 * Ensures command idempotency and proper cleanup
 */

const crypto = require('crypto');

class IPCSafety {
  /**
   * Create IPC safety manager
   * @param {object} options - Configuration
   * @param {object} options.logger - Logger instance
   * @param {number} options.deduplicationWindow - Window for deduplication (ms)
   * @param {number} options.maxPendingOperations - Max concurrent operations
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.deduplicationWindow = options.deduplicationWindow || 100; // 100ms
    this.maxPendingOperations = options.maxPendingOperations || 1000;

    // Track pending operations to prevent double-execution
    this.pendingOperations = new Map(); // commandId -> { promise, timestamp }

    // Track recently completed operations for deduplication
    this.completedOperations = new Map(); // commandId -> { result, timestamp }

    // Track IPC handlers to ensure cleanup
    this.registeredHandlers = new Map(); // responseChannel -> { handler, webContents }

    // Cleanup interval for stale entries
    this.cleanupInterval = setInterval(() => this.performCleanup(), 60000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref(); // Don't prevent process exit
    }
  }

  /**
   * Execute operation only once per session (deduplication)
   * @param {string} commandId - Unique command identifier
   * @param {function} handler - Async handler function
   * @param {object} options - Execution options
   * @returns {Promise} Result of handler
   */
  async executeOncePerSession(commandId, handler, options = {}) {
    const {
      timeout = 30000,
      ignoreCache = false
    } = options;

    // Check if already executing
    if (this.pendingOperations.has(commandId)) {
      this.logger.debug(`[IPCSafety] Command already executing, returning pending: ${commandId}`);
      return this.pendingOperations.get(commandId).promise;
    }

    // Check if recently completed (within deduplication window)
    if (!ignoreCache && this.completedOperations.has(commandId)) {
      const completed = this.completedOperations.get(commandId);
      const age = Date.now() - completed.timestamp;

      if (age < this.deduplicationWindow) {
        this.logger.debug(`[IPCSafety] Returning cached result for: ${commandId}`);
        return completed.result;
      }
    }

    // Check pending operations limit
    if (this.pendingOperations.size >= this.maxPendingOperations) {
      throw new Error(
        `Too many pending IPC operations: ${this.pendingOperations.size}/${this.maxPendingOperations}`
      );
    }

    // Create promise for this operation
    const promise = this.executeWithTimeout(handler, timeout)
      .then(result => {
        // Cache successful result
        this.completedOperations.set(commandId, {
          result,
          timestamp: Date.now(),
          success: true
        });
        return result;
      })
      .catch(error => {
        // Cache failed result (don't retry)
        this.completedOperations.set(commandId, {
          error,
          timestamp: Date.now(),
          success: false
        });
        throw error;
      })
      .finally(() => {
        // Remove from pending
        this.pendingOperations.delete(commandId);
      });

    // Track as pending
    this.pendingOperations.set(commandId, {
      promise,
      timestamp: Date.now(),
      commandId
    });

    return promise;
  }

  /**
   * Execute handler with timeout protection
   * @param {function} handler - Async handler
   * @param {number} timeout - Timeout in ms
   * @returns {Promise} Handler result
   */
  async executeWithTimeout(handler, timeout = 30000) {
    return Promise.race([
      handler(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`IPC operation timed out after ${timeout}ms`)),
          timeout
        )
      )
    ]);
  }

  /**
   * Register IPC response handler with cleanup
   * @param {object} ipcMain - Electron ipcMain instance
   * @param {string} responseChannel - Response channel name
   * @param {function} handler - Handler function
   * @returns {function} Cleanup function
   */
  registerIPCHandler(ipcMain, responseChannel, handler) {
    if (this.registeredHandlers.has(responseChannel)) {
      const existing = this.registeredHandlers.get(responseChannel);
      this.logger.warn(`[IPCSafety] Overwriting existing handler for: ${responseChannel}`);

      // Remove old handler
      try {
        ipcMain.removeListener(responseChannel, existing.handler);
      } catch (error) {
        this.logger.warn(`[IPCSafety] Failed to remove old handler: ${error.message}`);
      }
    }

    // Register new handler
    ipcMain.once(responseChannel, handler);

    // Track handler
    this.registeredHandlers.set(responseChannel, {
      handler,
      timestamp: Date.now()
    });

    // Return cleanup function
    return () => this.unregisterIPCHandler(ipcMain, responseChannel, handler);
  }

  /**
   * Unregister IPC handler with safety
   * @param {object} ipcMain - Electron ipcMain instance
   * @param {string} responseChannel - Response channel name
   * @param {function} handler - Handler to remove
   * @returns {boolean} Whether handler was removed
   */
  unregisterIPCHandler(ipcMain, responseChannel, handler) {
    try {
      ipcMain.removeListener(responseChannel, handler);
      this.registeredHandlers.delete(responseChannel);
      return true;
    } catch (error) {
      this.logger.warn(`[IPCSafety] Failed to unregister handler: ${error.message}`);
      return false;
    }
  }

  /**
   * Safe IPC call with timeout and deduplication
   * @param {object} webContents - Electron webContents
   * @param {string} sendChannel - Send channel name
   * @param {string} responseChannel - Response channel name
   * @param {any} data - Data to send
   * @param {object} options - Call options
   * @returns {Promise} IPC response
   */
  async safeIPCCall(webContents, sendChannel, responseChannel, data, options = {}) {
    const {
      timeout = 30000,
      deduplicate = true,
      operationId = crypto.randomUUID()
    } = options;

    // Deduplication key
    const deduplicateKey = deduplicate ? `ipc_${sendChannel}_${responseChannel}` : null;

    const handler = async () => {
      // Check web contents validity
      if (webContents.isDestroyed?.() === true) {
        throw new Error(`WebContents is destroyed, cannot send IPC message`);
      }

      return new Promise((resolve, reject) => {
        let timeoutId;
        let resolved = false;

        // Create safe response handler
        const responseHandler = (event, result) => {
          if (resolved) {
            return;
          } // Already handled
          resolved = true;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          this.unregisterIPCHandler(ipcMain, responseChannel, responseHandler);

          resolve(result);
        };

        // Register response handler
        const { ipcMain } = require('electron');
        this.registerIPCHandler(ipcMain, responseChannel, responseHandler);

        // Set timeout for response
        timeoutId = setTimeout(() => {
          if (resolved) {
            return;
          } // Already handled
          resolved = true;

          this.unregisterIPCHandler(ipcMain, responseChannel, responseHandler);
          reject(new Error(
            `IPC timeout: No response from '${responseChannel}' within ${timeout}ms`
          ));
        }, timeout);

        // Send message
        try {
          if (data !== null && data !== undefined) {
            webContents.send(sendChannel, data);
          } else {
            webContents.send(sendChannel);
          }
        } catch (error) {
          if (resolved) {
            return;
          }
          resolved = true;

          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          this.unregisterIPCHandler(ipcMain, responseChannel, responseHandler);
          reject(new Error(`Failed to send IPC: ${error.message}`));
        }
      });
    };

    // Execute with or without deduplication
    if (deduplicateKey) {
      return this.executeOncePerSession(deduplicateKey, handler, { timeout });
    } else {
      return handler();
    }
  }

  /**
   * Cancel pending operations for a session/process
   * @param {string} pattern - Optional pattern to match command IDs
   * @returns {number} Number of operations cancelled
   */
  cancelPendingOperations(pattern = null) {
    let count = 0;

    for (const [commandId, pending] of this.pendingOperations.entries()) {
      if (!pattern || commandId.includes(pattern)) {
        this.pendingOperations.delete(commandId);
        count++;
      }
    }

    this.logger.info(`[IPCSafety] Cancelled ${count} pending operations`);
    return count;
  }

  /**
   * Clear all handlers for a specific web contents
   * @param {object} webContents - Web contents to clean
   * @returns {number} Number of handlers removed
   */
  clearHandlersForWebContents(webContents) {
    const { ipcMain } = require('electron');
    let count = 0;

    for (const [channel, handler] of this.registeredHandlers.entries()) {
      if (handler.webContents === webContents) {
        this.unregisterIPCHandler(ipcMain, channel, handler.handler);
        count++;
      }
    }

    this.logger.info(`[IPCSafety] Cleared ${count} handlers for destroyed webContents`);
    return count;
  }

  /**
   * Get current state for monitoring
   * @returns {object} Current state
   */
  getState() {
    return {
      pendingOperations: this.pendingOperations.size,
      registeredHandlers: this.registeredHandlers.size,
      cachedResults: this.completedOperations.size,
      limits: {
        maxPendingOperations: this.maxPendingOperations,
        deduplicationWindow: this.deduplicationWindow
      }
    };
  }

  /**
   * Perform cleanup of stale entries
   * @private
   */
  performCleanup() {
    const now = Date.now();
    let removedPending = 0;
    let removedCached = 0;

    // Clean up stale pending operations (older than 5 minutes)
    for (const [commandId, pending] of this.pendingOperations.entries()) {
      if (now - pending.timestamp > 300000) { // 5 minutes
        this.logger.warn(`[IPCSafety] Removing stale pending operation: ${commandId}`);
        this.pendingOperations.delete(commandId);
        removedPending++;
      }
    }

    // Clean up old cached results (older than deduplication window)
    for (const [commandId, cached] of this.completedOperations.entries()) {
      if (now - cached.timestamp > this.deduplicationWindow * 10) { // Keep for a bit longer
        this.completedOperations.delete(commandId);
        removedCached++;
      }
    }

    if (removedPending > 0 || removedCached > 0) {
      this.logger.debug(
        `[IPCSafety] Cleanup: removed ${removedPending} pending, ${removedCached} cached`
      );
    }
  }

  /**
   * Destroy the IPC safety manager
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.pendingOperations.clear();
    this.completedOperations.clear();
    this.registeredHandlers.clear();

    this.logger.info('[IPCSafety] Destroyed');
  }
}

module.exports = { IPCSafety };

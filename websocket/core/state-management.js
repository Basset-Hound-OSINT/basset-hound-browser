/**
 * Immutable snapshot of application state at a point in time
 * Used to restore state if a command fails after modification
 */
class StateSnapshot {
  constructor(id, timestamp, stateData = {}) {
    this.id = id;
    this.timestamp = timestamp;
    this.stateData = Object.freeze({ ...stateData }); // Immutable copy
    this.metadata = {
      commandName: null,
      source: 'unknown',
      dataSize: JSON.stringify(stateData).length
    };
  }

  /**
   * Create a snapshot of proxy state
   * @param {ProxyManager} proxyManager - The proxy manager instance
   * @returns {StateSnapshot}
   */
  static captureProxy(proxyManager) {
    const status = proxyManager.getProxyStatus();
    const snapshot = new StateSnapshot(
      `proxy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      Date.now(),
      {
        type: 'proxy',
        config: {
          host: status.host,
          port: status.port,
          proxyType: status.proxyType,
          auth: status.auth ? { username: status.auth.username } : null,
          bypassRules: status.bypassRules
        },
        torMode: status.torMode,
        torStatus: status.torStatus
      }
    );
    snapshot.metadata.source = 'proxy_manager';
    return snapshot;
  }

  /**
   * Create a snapshot of storage state
   * @param {StorageManager} storageManager - The storage manager instance
   * @param {string} origin - The origin to snapshot
   * @param {string} storageType - 'localStorage' or 'sessionStorage'
   * @returns {StateSnapshot}
   */
  static captureStorage(storageManager, origin, storageType = 'localStorage') {
    if (!storageManager) {
      return null;
    }
    const snapshot = new StateSnapshot(
      `storage-${storageType}-${origin}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      Date.now(),
      {
        type: storageType,
        origin,
        items: {} // Will be populated on demand
      }
    );
    snapshot.metadata.source = 'storage_manager';
    return snapshot;
  }

  /**
   * Create a snapshot of navigation state
   * @param {Electron.BrowserWindow} mainWindow - The main window
   * @param {string} currentUrl - The current URL
   * @returns {StateSnapshot}
   */
  static captureNavigation(mainWindow, currentUrl = '') {
    const snapshot = new StateSnapshot(
      `navigation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      Date.now(),
      {
        type: 'navigation',
        currentUrl,
        timestamp: Date.now()
      }
    );
    snapshot.metadata.source = 'main_window';
    return snapshot;
  }

  /**
   * Create a snapshot of Tor mode state
   * @param {ProxyManager} proxyManager - The proxy manager instance
   * @returns {StateSnapshot}
   */
  static captureTorMode(proxyManager) {
    const status = proxyManager.getProxyStatus();
    const snapshot = new StateSnapshot(
      `tor-mode-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      Date.now(),
      {
        type: 'tor_mode',
        torMode: status.torMode,
        torStatus: status.torStatus,
        socksHost: status.socksHost,
        socksPort: status.socksPort
      }
    );
    snapshot.metadata.source = 'tor_manager';
    return snapshot;
  }

  /**
   * Get human-readable representation
   * @returns {string}
   */
  toString() {
    return `[StateSnapshot ${this.id}] type=${this.stateData.type} size=${this.metadata.dataSize}B timestamp=${new Date(this.timestamp).toISOString()}`;
  }
}

/**
 * Manages state snapshots and rollback operations
 * Provides transaction-like semantics for state modifications
 */
class StateRollbackManager {
  constructor(maxSnapshots = 50, snapshotTtlMs = 3600000) {
    this.snapshots = new Map(); // id -> StateSnapshot
    this.maxSnapshots = maxSnapshots;
    this.snapshotTtlMs = snapshotTtlMs; // 1 hour default
    this.transactionStack = []; // For nested transactions
    this.logger = null; // Will be set by WebSocketServer
    this.rollbackListeners = new Map(); // Custom rollback handlers
  }

  /**
   * Save a state snapshot for later rollback
   * @param {string} id - Unique identifier for the snapshot
   * @param {StateSnapshot} snapshot - The snapshot to save
   */
  saveSnapshot(id, snapshot) {
    if (!snapshot || !id) {
      return;
    }

    this.snapshots.set(id, snapshot);

    // Prevent unbounded memory growth
    if (this.snapshots.size > this.maxSnapshots) {
      this._pruneOldestSnapshot();
    }
  }

  /**
   * Restore application state from a snapshot
   * @param {string} id - The snapshot ID to restore
   * @param {Function} restoreFn - Callback to perform the actual restoration
   * @returns {Promise<boolean>} True if restoration succeeded
   */
  async restoreSnapshot(id, restoreFn = null) {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      if (this.logger) {
        this.logger.warn(`[StateRollback] Snapshot not found: ${id}`);
      }
      return false;
    }

    try {
      // Call custom restore function if provided
      if (restoreFn && typeof restoreFn === 'function') {
        await restoreFn(snapshot);
      }

      // Call registered rollback listener if available
      const listener = this.rollbackListeners.get(snapshot.stateData.type);
      if (listener) {
        await listener(snapshot);
      }

      if (this.logger) {
        this.logger.info(`[StateRollback] Restored snapshot: ${snapshot.toString()}`);
      }
      return true;
    } catch (error) {
      if (this.logger) {
        this.logger.error(`[StateRollback] Failed to restore snapshot ${id}: ${error.message}`);
      }
      return false;
    }
  }

  /**
   * Discard a snapshot (mark as no longer needed)
   * @param {string} id - The snapshot ID to discard
   */
  discardSnapshot(id) {
    this.snapshots.delete(id);
  }

  /**
   * Begin a transaction for grouped state changes
   * @returns {string} Transaction ID
   */
  beginTransaction() {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.transactionStack.push({
      id: txId,
      snapshots: [],
      startTime: Date.now()
    });
    return txId;
  }

  /**
   * Commit a transaction (keep all snapshots)
   * @returns {boolean}
   */
  commitTransaction() {
    if (this.transactionStack.length === 0) {
      return false;
    }
    this.transactionStack.pop();
    return true;
  }

  /**
   * Rollback a transaction (restore all snapshots)
   * @returns {Promise<boolean>}
   */
  async rollbackTransaction() {
    if (this.transactionStack.length === 0) {
      return false;
    }

    const tx = this.transactionStack.pop();
    let allSucceeded = true;

    // Rollback in reverse order (LIFO)
    for (let i = tx.snapshots.length - 1; i >= 0; i--) {
      const snapshotId = tx.snapshots[i];
      const succeeded = await this.restoreSnapshot(snapshotId);
      if (!succeeded) {
        allSucceeded = false;
      }
    }

    return allSucceeded;
  }

  /**
   * Register a custom rollback handler for a state type
   * @param {string} stateType - The state type (e.g., 'proxy', 'storage')
   * @param {Function} handler - Async function to handle rollback
   */
  registerRollbackListener(stateType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('Rollback listener must be a function');
    }
    this.rollbackListeners.set(stateType, handler);
  }

  /**
   * List all current snapshots
   * @returns {Array<StateSnapshot>}
   */
  listSnapshots() {
    return Array.from(this.snapshots.values());
  }

  /**
   * Clear snapshots older than TTL
   */
  clearExpiredSnapshots() {
    const now = Date.now();
    let cleared = 0;

    for (const [id, snapshot] of this.snapshots) {
      if (now - snapshot.timestamp > this.snapshotTtlMs) {
        this.snapshots.delete(id);
        cleared++;
      }
    }

    if (cleared > 0 && this.logger) {
      this.logger.info(`[StateRollback] Cleared ${cleared} expired snapshots`);
    }
  }

  /**
   * Get statistics about snapshot storage
   * @returns {Object}
   */
  getStats() {
    const snapshots = Array.from(this.snapshots.values());
    const totalSize = snapshots.reduce((sum, s) => sum + s.metadata.dataSize, 0);

    return {
      snapshotCount: snapshots.length,
      maxSnapshots: this.maxSnapshots,
      totalSizeBytes: totalSize,
      transactionDepth: this.transactionStack.length,
      listenerCount: this.rollbackListeners.size
    };
  }

  /**
   * Private: Remove the oldest snapshot when limit is reached
   */
  _pruneOldestSnapshot() {
    if (this.snapshots.size === 0) {
      return;
    }

    let oldest = null;
    let oldestId = null;

    for (const [id, snapshot] of this.snapshots) {
      if (!oldest || snapshot.timestamp < oldest.timestamp) {
        oldest = snapshot;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.snapshots.delete(oldestId);
      if (this.logger) {
        this.logger.debug(`[StateRollback] Pruned oldest snapshot: ${oldestId}`);
      }
    }
  }
}

/**
 * Wrapper for command handlers that require state rollback
 * Provides execute-with-rollback semantics
 */
class StatefulCommandHandler {
  constructor(commandName, stateManager, logger = null) {
    this.commandName = commandName;
    this.stateManager = stateManager;
    this.logger = logger;
  }

  /**
   * Execute a handler function with automatic rollback on failure
   * @param {Function} handlerFn - The command handler to execute
   * @param {StateSnapshot} snapshot - Pre-execution snapshot
   * @param {Function} validationFn - Optional validation function (called after handler)
   * @param {Function} rollbackFn - Optional custom rollback logic
   * @returns {Promise<Object>} Handler result or error object
   */
  async executeWithRollback(handlerFn, snapshot, validationFn = null, rollbackFn = null) {
    if (!snapshot || !handlerFn) {
      throw new Error('StateSnapshot and handlerFn are required');
    }

    try {
      // Execute the command handler
      const result = await handlerFn();

      // Validate result if validation function provided
      if (validationFn && typeof validationFn === 'function') {
        const validationResult = await validationFn(result);
        if (!validationResult.valid) {
          throw new Error(`Validation failed: ${validationResult.reason}`);
        }
      }

      // Success: discard snapshot (no rollback needed)
      this.stateManager.discardSnapshot(snapshot.id);

      if (this.logger) {
        this.logger.debug(`[StatefulHandler] ${this.commandName} succeeded, snapshot ${snapshot.id} discarded`);
      }

      return result;
    } catch (error) {
      // Failure: attempt rollback
      if (this.logger) {
        this.logger.warn(`[StatefulHandler] ${this.commandName} failed: ${error.message}, attempting rollback`);
      }

      let rollbackSuccess = false;

      // Use custom rollback if provided
      if (rollbackFn && typeof rollbackFn === 'function') {
        try {
          await rollbackFn(snapshot);
          rollbackSuccess = true;
        } catch (rollbackError) {
          if (this.logger) {
            this.logger.error(`[StatefulHandler] Custom rollback failed: ${rollbackError.message}`);
          }
        }
      } else {
        // Use generic state restoration
        rollbackSuccess = await this.stateManager.restoreSnapshot(snapshot.id);
      }

      // Discard snapshot after rollback attempt
      this.stateManager.discardSnapshot(snapshot.id);

      return {
        success: false,
        error: error.message,
        rollbackAttempted: true,
        rollbackSucceeded: rollbackSuccess
      };
    }
  }

  /**
   * Execute handler within a transaction context
   * All snapshots in transaction are rolled back together on failure
   */
  async executeInTransaction(handlerFn, snapshots = []) {
    const txId = this.stateManager.beginTransaction();

    try {
      // Add snapshots to transaction
      snapshots.forEach(snapshot => {
        this.stateManager.transactionStack[this.stateManager.transactionStack.length - 1].snapshots.push(snapshot.id);
      });

      // Execute handler
      const result = await handlerFn();

      // Commit transaction
      this.stateManager.commitTransaction();
      return result;
    } catch (error) {
      // Rollback entire transaction
      await this.stateManager.rollbackTransaction();
      return {
        success: false,
        error: error.message,
        transactionRolledBack: true
      };
    }
  }
}

module.exports = {
  StateSnapshot,
  StateRollbackManager,
  StatefulCommandHandler
};

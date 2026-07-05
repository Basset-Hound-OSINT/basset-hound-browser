/**
 * Timeout Manager for WebSocket Operations
 * Issue #3: No timeout ceiling
 * - Adds max timeout (60s default, configurable)
 * - Forces kill on timeout
 * - Prevents long-hanging operations
 */

class TimeoutManager {
  constructor(options = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs || 60000; // 60 seconds
    this.maxTimeoutMs = options.maxTimeoutMs || 300000; // 5 minutes absolute max
    this.minTimeoutMs = options.minTimeoutMs || 1000; // 1 second minimum
    this.timeoutMap = new Map(); // operationId -> { timeoutHandle, startTime, command }
    this.timeoutHistory = []; // Track completed operations
    this.historyLimit = options.historyLimit || 1000;
    this.logger = options.logger || console;
  }

  /**
   * Register operation with timeout
   * @param {string} operationId - Unique operation ID
   * @param {string} command - Command name for logging
   * @param {number} timeoutMs - Custom timeout (will be clamped to max)
   * @param {Function} onTimeout - Callback when timeout occurs
   * @returns {Object} Timeout handle
   */
  registerOperation(operationId, command, timeoutMs = null, onTimeout = null) {
    // Clamp timeout to valid range
    let effectiveTimeout = timeoutMs || this.defaultTimeoutMs;
    if (effectiveTimeout < this.minTimeoutMs) {
      this.logger.warn(
        `[TimeoutManager] Timeout ${effectiveTimeout}ms below minimum ${this.minTimeoutMs}ms, using minimum`
      );
      effectiveTimeout = this.minTimeoutMs;
    }
    if (effectiveTimeout > this.maxTimeoutMs) {
      this.logger.warn(
        `[TimeoutManager] Timeout ${effectiveTimeout}ms exceeds maximum ${this.maxTimeoutMs}ms, capping`
      );
      effectiveTimeout = this.maxTimeoutMs;
    }

    const startTime = Date.now();
    const operation = {
      id: operationId,
      command,
      startTime,
      requestedTimeout: timeoutMs,
      effectiveTimeout,
      onTimeout,
      timedOut: false,
      completed: false,
      timeoutHandle: null
    };

    // Set timeout
    const timeoutHandle = setTimeout(() => {
      this._handleTimeout(operationId, operation);
    }, effectiveTimeout);

    operation.timeoutHandle = timeoutHandle;
    this.timeoutMap.set(operationId, operation);

    this.logger.debug(
      `[TimeoutManager] Registered operation ${operationId} (${command}) with ${effectiveTimeout}ms timeout`
    );

    return {
      operationId,
      timeoutMs: effectiveTimeout,
      clear: () => this.clearOperation(operationId),
      extend: (additionalMs) => this.extendTimeout(operationId, additionalMs),
      getStatus: () => this.getOperationStatus(operationId)
    };
  }

  /**
   * Handle timeout trigger
   * @private
   */
  _handleTimeout(operationId, operation) {
    operation.timedOut = true;
    this.logger.error(
      `[TimeoutManager] Operation ${operationId} (${operation.command}) timed out after ${operation.effectiveTimeout}ms`
    );

    // Call timeout handler if provided
    if (operation.onTimeout) {
      try {
        operation.onTimeout({
          operationId,
          command: operation.command,
          timeoutMs: operation.effectiveTimeout,
          elapsedMs: Date.now() - operation.startTime
        });
      } catch (error) {
        this.logger.error(
          `[TimeoutManager] Error in timeout handler for ${operationId}: ${error.message}`
        );
      }
    }

    // Record in history
    this._recordCompletion(operation, 'timeout');
  }

  /**
   * Clear/complete an operation
   * @param {string} operationId - Operation ID
   */
  clearOperation(operationId) {
    const operation = this.timeoutMap.get(operationId);
    if (!operation) {
      return { found: false };
    }

    // Clear timeout if not already triggered
    if (operation.timeoutHandle) {
      clearTimeout(operation.timeoutHandle);
      operation.timeoutHandle = null;
    }

    operation.completed = true;
    const elapsed = Date.now() - operation.startTime;

    this._recordCompletion(operation, 'completed');

    this.logger.debug(
      `[TimeoutManager] Operation cleared: ${operationId} (${operation.command}) completed in ${elapsed}ms`
    );

    return {
      found: true,
      operationId,
      completed: true,
      elapsedMs: elapsed,
      timedOut: operation.timedOut
    };
  }

  /**
   * Extend timeout for an operation
   * @param {string} operationId - Operation ID
   * @param {number} additionalMs - Additional milliseconds
   * @returns {Object} Result
   */
  extendTimeout(operationId, additionalMs) {
    const operation = this.timeoutMap.get(operationId);
    if (!operation) {
      return { found: false, error: 'Operation not found' };
    }

    if (operation.timedOut) {
      return { found: true, error: 'Operation already timed out, cannot extend' };
    }

    if (operation.completed) {
      return { found: true, error: 'Operation already completed, cannot extend' };
    }

    // Clear existing timeout
    if (operation.timeoutHandle) {
      clearTimeout(operation.timeoutHandle);
    }

    // Calculate new timeout
    const newTimeout = operation.effectiveTimeout + additionalMs;
    if (newTimeout > this.maxTimeoutMs) {
      this.logger.warn(
        `[TimeoutManager] Extended timeout would exceed max (${newTimeout}ms > ${this.maxTimeoutMs}ms), capping`
      );
      operation.effectiveTimeout = this.maxTimeoutMs;
    } else {
      operation.effectiveTimeout = newTimeout;
    }

    const remainingTime = Math.max(0, operation.effectiveTimeout - (Date.now() - operation.startTime));

    // Set new timeout
    operation.timeoutHandle = setTimeout(() => {
      this._handleTimeout(operationId, operation);
    }, remainingTime);

    const elapsed = Date.now() - operation.startTime;
    const newTotal = elapsed + remainingTime;

    this.logger.debug(
      `[TimeoutManager] Extended timeout for ${operationId}: +${additionalMs}ms (new total: ${newTotal}ms)`
    );

    return {
      found: true,
      operationId,
      extendedMs: additionalMs,
      effectiveTimeoutMs: operation.effectiveTimeout,
      remainingMs: remainingTime,
      elapsedMs: elapsed
    };
  }

  /**
   * Get operation status
   * @param {string} operationId - Operation ID
   */
  getOperationStatus(operationId) {
    const operation = this.timeoutMap.get(operationId);
    if (!operation) {
      return null;
    }

    const now = Date.now();
    const elapsed = now - operation.startTime;
    const remaining = Math.max(0, operation.effectiveTimeout - elapsed);
    const percentUsed = ((elapsed / operation.effectiveTimeout) * 100).toFixed(2);

    return {
      operationId,
      command: operation.command,
      elapsedMs: elapsed,
      remainingMs: remaining,
      effectiveTimeoutMs: operation.effectiveTimeout,
      percentUsed: `${percentUsed}%`,
      completed: operation.completed,
      timedOut: operation.timedOut
    };
  }

  /**
   * Record completion in history
   * @private
   */
  _recordCompletion(operation, status) {
    const elapsed = Date.now() - operation.startTime;

    this.timeoutHistory.push({
      operationId: operation.id,
      command: operation.command,
      status,
      requestedTimeoutMs: operation.requestedTimeout,
      effectiveTimeoutMs: operation.effectiveTimeout,
      elapsedMs: elapsed,
      timestamp: new Date().toISOString()
    });

    // Keep history under limit
    if (this.timeoutHistory.length > this.historyLimit) {
      this.timeoutHistory.shift();
    }

    // Remove from active map
    this.timeoutMap.delete(operation.id);
  }

  /**
   * Get all active operations
   */
  getActiveOperations() {
    const active = [];
    const now = Date.now();

    for (const [id, op] of this.timeoutMap) {
      if (!op.completed && !op.timedOut) {
        const elapsed = now - op.startTime;
        const remaining = Math.max(0, op.effectiveTimeout - elapsed);
        active.push({
          operationId: id,
          command: op.command,
          elapsedMs: elapsed,
          remainingMs: remaining,
          effectiveTimeoutMs: op.effectiveTimeout,
          percentUsed: ((elapsed / op.effectiveTimeout) * 100).toFixed(2)
        });
      }
    }

    return active;
  }

  /**
   * Get recent operation history
   * @param {number} limit - Number of recent operations to return
   */
  getRecentHistory(limit = 100) {
    return this.timeoutHistory.slice(-limit);
  }

  /**
   * Get timeout statistics
   */
  getStats() {
    const completed = this.timeoutHistory.filter(h => h.status === 'completed');
    const timedOut = this.timeoutHistory.filter(h => h.status === 'timeout');

    const avgElapsed = completed.length > 0
      ? completed.reduce((sum, h) => sum + h.elapsedMs, 0) / completed.length
      : 0;

    return {
      defaultTimeoutMs: this.defaultTimeoutMs,
      maxTimeoutMs: this.maxTimeoutMs,
      minTimeoutMs: this.minTimeoutMs,
      activeOperations: this.timeoutMap.size,
      totalCompleted: completed.length,
      totalTimedOut: timedOut.length,
      timeoutRate: timedOut.length > 0
        ? ((timedOut.length / (completed.length + timedOut.length)) * 100).toFixed(2)
        : '0.00',
      averageElapsedMs: avgElapsed.toFixed(2),
      historySize: this.timeoutHistory.length
    };
  }

  /**
   * Kill all pending operations (emergency)
   */
  killAllPending() {
    const killed = [];

    for (const [id, op] of this.timeoutMap) {
      if (op.timeoutHandle) {
        clearTimeout(op.timeoutHandle);
      }
      op.timedOut = true;
      killed.push({
        operationId: id,
        command: op.command
      });
    }

    this.timeoutMap.clear();
    this.logger.warn(`[TimeoutManager] Force killed ${killed.length} pending operations`);

    return killed;
  }
}

module.exports = { TimeoutManager };

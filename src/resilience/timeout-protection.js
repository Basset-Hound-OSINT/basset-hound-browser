/**
 * Basset Hound Browser - Timeout Protection Module
 * v12.5.0 Phase 2 - Deployment Hardening
 *
 * Provides timeout wrappers for long-running operations
 * Prevents process hangs from deadlocked operations
 */

const { execSync } = require('child_process');

// Default timeout values (in milliseconds)
const DEFAULT_TIMEOUTS = {
  executeJavaScript: 5000, // 5 seconds
  navigate: 30000, // 30 seconds
  screenshot: 10000, // 10 seconds
  wait: 30000, // 30 seconds (user can override, capped)
  click: 2000, // 2 seconds
  fill: 2000, // 2 seconds per field
  formSubmit: 5000, // 5 seconds
  request: 10000, // 10 seconds
  deviceCapture: 5000, // 5 seconds
  processExec: 5000, // 5 seconds
  socketConnect: 10000, // 10 seconds
  defaultMax: 30000 // Absolute maximum timeout
};

class TimeoutError extends Error {
  constructor(operationName, timeoutMs) {
    super(`${operationName} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

class TimeoutProtection {
  /**
   * Create timeout protection instance
   * @param {object} options - Configuration
   * @param {object} options.logger - Logger instance
   * @param {number} options.maxTimeout - Absolute maximum timeout
   */
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.maxTimeout = options.maxTimeout || DEFAULT_TIMEOUTS.defaultMax;
    this.activeTasks = new Map(); // Track active operations
    this.activeTimeouts = new Set(); // P3-003: Track all timeout IDs for cleanup
    this.abortControllers = new Map(); // P3-003: Track AbortControllers
    this.cleanupHandlers = []; // P3-003: Emergency cleanup handlers
  }

  /**
   * Wrap a promise with timeout protection
   * P3-003: Uses AbortController and tracks all timeouts for cleanup
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} operationName - Name of operation for logging
   * @returns {Promise} Race between promise and timeout
   */
  async withTimeout(promise, timeoutMs, operationName = 'Operation') {
    // Validate timeout
    const timeout = Math.min(
      timeoutMs || DEFAULT_TIMEOUTS.defaultMax,
      this.maxTimeout
    );

    // P3-003: Create AbortController for this operation
    const controller = new AbortController();
    const operationId = `timeout_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.abortControllers.set(operationId, controller);

    return Promise.race([
      promise,
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          this.logger.warn(`[Timeout] ${operationName} exceeded ${timeout}ms`);

          // P3-003: Cleanup timeout from tracking set
          this.activeTimeouts.delete(timeoutId);
          this.abortControllers.delete(operationId);

          reject(new TimeoutError(operationName, timeout));
        }, timeout);

        // P3-003: Track timeout ID for cleanup
        this.activeTimeouts.add(timeoutId);

        // Clean up timeout on promise resolution (with guaranteed cleanup)
        const cleanup = () => {
          clearTimeout(timeoutId);
          this.activeTimeouts.delete(timeoutId);
          this.abortControllers.delete(operationId);
        };

        promise
          .then(cleanup)
          .catch(cleanup)
          .finally(cleanup);
      })
    ]).catch(error => {
      // P3-003: Ensure cleanup even on error
      this.abortControllers.delete(operationId);
      throw error;
    });
  }

  /**
   * Execute with timeout and fallback
   * @param {function} fn - Async function to execute
   * @param {object} options - Execution options
   * @returns {any} Result from function or fallback
   */
  async executeWithFallback(fn, options = {}) {
    const {
      timeoutMs = DEFAULT_TIMEOUTS.defaultMax,
      operationName = 'Operation',
      fallback = null,
      retries = 0
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.withTimeout(
          fn(),
          timeoutMs,
          `${operationName} (attempt ${attempt})`
        );
        return result;
      } catch (error) {
        lastError = error;

        if (error instanceof TimeoutError) {
          this.logger.warn(
            `[Timeout] ${operationName} timed out on attempt ${attempt}/${retries + 1}`
          );

          if (attempt <= retries) {
            // Exponential backoff on retry
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        } else {
          throw error; // Non-timeout errors aren't retried
        }
      }
    }

    // All retries exhausted, use fallback
    if (fallback !== null) {
      this.logger.info(`[Timeout] Using fallback for ${operationName}`);
      return fallback;
    }

    throw lastError;
  }

  /**
   * Wrap a command handler with timeout protection
   * @param {function} handler - Command handler
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} commandName - Command name for logging
   * @returns {function} Wrapped handler
   */
  wrapCommandHandler(handler, timeoutMs = DEFAULT_TIMEOUTS.defaultMax, commandName = 'Command') {
    return async (command, params, context) => {
      const operationName = `${commandName}: ${command?.command || 'unknown'}`;

      try {
        return await this.withTimeout(
          handler.call(this, command, params, context),
          timeoutMs,
          operationName
        );
      } catch (error) {
        if (error instanceof TimeoutError) {
          this.logger.error(`[CommandTimeout] ${operationName} exceeded ${timeoutMs}ms`);
          return {
            success: false,
            error: `${operationName} timed out`,
            timedOut: true,
            timeoutMs
          };
        }
        throw error;
      }
    };
  }

  /**
   * Execute JavaScript with timeout protection and fallback
   * @param {string} code - JavaScript code to execute
   * @param {object} options - Execution options
   * @returns {any} Execution result
   */
  async executeJavaScriptSafe(code, options = {}) {
    const {
      timeoutMs = DEFAULT_TIMEOUTS.executeJavaScript,
      useFallback = true,
      fallbackValue = null
    } = options;

    try {
      // Try execSync with timeout
      return await this.executeWithFallback(
        () => Promise.resolve(execSync(code, { timeout: timeoutMs, encoding: 'utf-8' })),
        {
          timeoutMs,
          operationName: 'JavaScript execution',
          fallback: useFallback ? fallbackValue : undefined,
          retries: 0
        }
      );
    } catch (error) {
      if (useFallback && error instanceof TimeoutError) {
        this.logger.warn(`[JSExecution] Timeout, using fallback`);
        return fallbackValue;
      }
      throw error;
    }
  }

  /**
   * Create a timeout-protected async task tracker
   * @param {string} taskId - Unique task identifier
   * @param {Promise} promise - Task promise
   * @param {number} timeoutMs - Timeout for this task
   * @returns {Promise} Task with tracking
   */
  trackTask(taskId, promise, timeoutMs = DEFAULT_TIMEOUTS.defaultMax) {
    const startTime = Date.now();

    this.activeTasks.set(taskId, {
      startTime,
      timeoutMs,
      resolved: false
    });

    return this.withTimeout(promise, timeoutMs, `Task: ${taskId}`)
      .then(result => {
        const task = this.activeTasks.get(taskId);
        if (task) {
          task.resolved = true;
          task.duration = Date.now() - startTime;
        }
        return result;
      })
      .finally(() => {
        this.activeTasks.delete(taskId);
      });
  }

  /**
   * Get status of active tasks
   * @returns {object} Map of active tasks and their status
   */
  getActiveTasks() {
    const status = {};

    for (const [taskId, task] of this.activeTasks.entries()) {
      const elapsed = Date.now() - task.startTime;
      status[taskId] = {
        startTime: task.startTime,
        elapsed,
        timeoutMs: task.timeoutMs,
        remaining: Math.max(0, task.timeoutMs - elapsed),
        resolved: task.resolved,
        isOverdue: elapsed > task.timeoutMs
      };
    }

    return status;
  }

  /**
   * Cancel a tracked task
   * @param {string} taskId - Task ID to cancel
   * @returns {boolean} Whether task was found and cancelled
   */
  cancelTask(taskId) {
    return this.activeTasks.delete(taskId);
  }

  /**
   * Get default timeout for operation
   * @param {string} operationType - Type of operation
   * @returns {number} Default timeout in milliseconds
   */
  getDefaultTimeout(operationType) {
    return DEFAULT_TIMEOUTS[operationType] || DEFAULT_TIMEOUTS.defaultMax;
  }

  /**
   * Validate timeout value
   * @param {any} timeoutMs - Timeout value to validate
   * @param {number} maxMs - Maximum allowed timeout
   * @returns {number} Validated timeout
   */
  validateTimeout(timeoutMs, maxMs = this.maxTimeout) {
    const timeout = Number(timeoutMs);

    if (isNaN(timeout) || timeout <= 0) {
      return DEFAULT_TIMEOUTS.defaultMax;
    }

    return Math.min(timeout, maxMs);
  }

  /**
   * P3-003: Cleanup all dangling timeouts
   * Call this on shutdown or error recovery
   */
  cleanupAllTimeouts() {
    const cleanedUp = this.activeTimeouts.size;

    for (const timeoutId of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();

    // Abort all pending operations
    for (const [_, controller] of this.abortControllers) {
      try {
        controller.abort();
      } catch (e) {
        // Ignore if already aborted
      }
    }
    this.abortControllers.clear();

    // Clear active tasks
    this.activeTasks.clear();

    this.logger.info(`[Timeout Cleanup] Cleaned up ${cleanedUp} dangling timeouts`);
    return { cleaned: cleanedUp, timestamp: Date.now() };
  }

  /**
   * P3-003: Get status of all active timeouts and tasks
   * Useful for debugging timeout leaks
   */
  getCleanupStatus() {
    return {
      activeTimeouts: this.activeTimeouts.size,
      activeTasks: this.activeTasks.size,
      activeControllers: this.abortControllers.size,
      timeoutIds: Array.from(this.activeTimeouts),
      tasks: Array.from(this.activeTasks.entries()).map(([id, task]) => ({
        id,
        elapsed: Date.now() - task.startTime,
        timeoutMs: task.timeoutMs,
        resolved: task.resolved
      }))
    };
  }

  /**
   * P3-003: Register emergency cleanup handler
   * These run when cleanupAllTimeouts is called
   */
  onCleanup(handler) {
    if (typeof handler === 'function') {
      this.cleanupHandlers.push(handler);
    }
  }

  /**
   * P3-003: Force cleanup and run all emergency handlers
   */
  forceEmergencyCleanup() {
    this.logger.warn('[Timeout] Executing emergency cleanup');

    // Run all cleanup handlers
    for (const handler of this.cleanupHandlers) {
      try {
        handler();
      } catch (error) {
        this.logger.error('[Cleanup Handler Error]', error.message);
      }
    }

    // Clean up all timeouts
    return this.cleanupAllTimeouts();
  }
}

module.exports = {
  TimeoutProtection,
  TimeoutError,
  DEFAULT_TIMEOUTS
};

/**
 * Basset Hound Browser - Promise Rejection & Error Handling
 * v12.5.0 Phase 2 - Deployment Hardening
 *
 * Global handlers for unhandled rejections and exceptions
 * Prevents process crashes and silent failures
 */

const crypto = require('crypto');

class PromiseHandlers {
  /**
   * Initialize promise rejection and exception handlers
   * @param {object} options - Configuration
   * @param {object} options.logger - Logger instance
   * @param {boolean} options.exitOnUncaught - Exit on uncaught exception (default: true)
   * @param {function} options.onRejection - Custom rejection handler
   * @param {function} options.onException - Custom exception handler
   */
  static initialize(options = {}) {
    const {
      logger = console,
      exitOnUncaught = false,  // Don't exit by default, let orchestrator manage
      onRejection = null,
      onException = null
    } = options;

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      const rejectionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const rejectionInfo = {
        id: rejectionId,
        timestamp,
        reason: reason?.message || String(reason),
        reasonType: reason?.constructor?.name || typeof reason,
        stack: reason?.stack,
        promise: String(promise)
      };

      logger.error('[UnhandledRejection]', rejectionInfo);

      // Call custom handler if provided
      if (typeof onRejection === 'function') {
        try {
          onRejection(reason, promise, rejectionInfo);
        } catch (handlerError) {
          logger.error('[UnhandledRejection] Handler error:', handlerError.message);
        }
      }

      // Don't crash - log and continue
      // This prevents cascading failures from one bad promise
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      const exceptionId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const exceptionInfo = {
        id: exceptionId,
        timestamp,
        message: error?.message || String(error),
        type: error?.constructor?.name || 'Unknown',
        stack: error?.stack,
        code: error?.code
      };

      logger.error('[UncaughtException]', exceptionInfo);

      // Call custom handler if provided
      if (typeof onException === 'function') {
        try {
          onException(error, exceptionInfo);
        } catch (handlerError) {
          logger.error('[UncaughtException] Handler error:', handlerError.message);
        }
      }

      // Exit on uncaught exception if configured
      if (exitOnUncaught) {
        logger.error('[UncaughtException] Fatal error, exiting process');
        process.exit(1);
      }
    });

    logger.debug('[PromiseHandlers] Initialized (unhandledRejection & uncaughtException)');
  }

  /**
   * Wrap a promise with error handling
   * @param {Promise} promise - Promise to wrap
   * @param {object} options - Handling options
   * @returns {Promise} Wrapped promise
   */
  static async withErrorHandling(promise, options = {}) {
    const {
      logger = console,
      operationName = 'Operation',
      fallback = undefined,
      rethrow = false
    } = options;

    try {
      return await promise;
    } catch (error) {
      const errorId = crypto.randomUUID();
      logger.error(`[ErrorHandling] ${operationName}`, {
        id: errorId,
        message: error?.message,
        type: error?.constructor?.name,
        stack: error?.stack
      });

      if (fallback !== undefined) {
        logger.info(`[ErrorHandling] Using fallback for ${operationName}`);
        return fallback;
      }

      if (rethrow) {
        throw error;
      }

      return null;
    }
  }

  /**
   * Wrap an async function with error handling
   * @param {function} fn - Async function to wrap
   * @param {object} options - Handling options
   * @returns {function} Wrapped function
   */
  static wrapAsyncFunction(fn, options = {}) {
    const {
      logger = console,
      operationName = fn.name || 'AsyncFunction',
      fallback = undefined,
      rethrow = true
    } = options;

    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorId = crypto.randomUUID();
        logger.error(`[AsyncFunction] ${operationName} error`, {
          id: errorId,
          message: error?.message,
          type: error?.constructor?.name,
          stack: error?.stack,
          args: args.length
        });

        if (fallback !== undefined) {
          logger.info(`[AsyncFunction] Using fallback for ${operationName}`);
          return fallback;
        }

        if (rethrow) {
          throw error;
        }

        return null;
      }
    };
  }

  /**
   * Wrap a function with promise error handling and timeout
   * @param {function} fn - Function to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {object} options - Handling options
   * @returns {Promise} Promise with error handling
   */
  static executeWithErrorHandling(fn, timeoutMs = 30000, options = {}) {
    const {
      logger = console,
      operationName = 'Operation',
      fallback = undefined
    } = options;

    return Promise.race([
      Promise.resolve().then(() => fn()),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ])
      .catch(error => {
        const errorId = crypto.randomUUID();
        logger.error(`[ErrorHandling] ${operationName}`, {
          id: errorId,
          message: error?.message,
          stack: error?.stack
        });

        if (fallback !== undefined) {
          return fallback;
        }

        throw error;
      });
  }

  /**
   * Create a safe promise executor that won't crash
   * @param {function} executor - Promise executor
   * @param {object} options - Handling options
   * @returns {Promise} Safe promise
   */
  static createSafePromise(executor, options = {}) {
    const { logger = console, operationName = 'Promise' } = options;

    return new Promise((resolve, reject) => {
      try {
        executor(resolve, reject);
      } catch (error) {
        logger.error(`[SafePromise] ${operationName} executor error`, {
          message: error?.message,
          stack: error?.stack
        });
        reject(error);
      }
    });
  }

  /**
   * Wrap multiple promises with all() and error handling
   * @param {Promise[]} promises - Array of promises
   * @param {object} options - Handling options
   * @returns {Promise} Promise.all with error handling
   */
  static allWithErrorHandling(promises, options = {}) {
    const {
      logger = console,
      operationName = 'Batch operation',
      continueOnError = false
    } = options;

    if (continueOnError) {
      // PromiseAllSettled behavior - wait for all, handle individual failures
      return Promise.allSettled(promises).then(results => {
        const errors = results.filter(r => r.status === 'rejected');
        if (errors.length > 0) {
          logger.warn(`[BatchOperation] ${errors.length}/${results.length} promises rejected`);
        }
        return results;
      });
    }

    // Normal Promise.all with error handling
    return Promise.all(promises).catch(error => {
      logger.error(`[BatchOperation] ${operationName}`, {
        message: error?.message,
        stack: error?.stack
      });
      throw error;
    });
  }

  /**
   * Wrap a race of promises with error handling
   * @param {Promise[]} promises - Array of promises
   * @param {object} options - Handling options
   * @returns {Promise} Promise.race with error handling
   */
  static raceWithErrorHandling(promises, options = {}) {
    const { logger = console, operationName = 'Race operation' } = options;

    return Promise.race(promises).catch(error => {
      logger.error(`[RaceOperation] ${operationName}`, {
        message: error?.message,
        stack: error?.stack
      });
      throw error;
    });
  }

  /**
   * Create timeout wrapper with promise error handling
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {object} options - Handling options
   * @returns {Promise} Promise with timeout and error handling
   */
  static withTimeout(promise, timeoutMs = 30000, options = {}) {
    const { logger = console, operationName = 'Operation' } = options;

    return this.raceWithErrorHandling([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ], options);
  }

  /**
   * Retry a failed operation with exponential backoff
   * @param {function} fn - Async function to retry
   * @param {object} options - Retry options
   * @returns {Promise} Result of successful operation
   */
  static async retryWithBackoff(fn, options = {}) {
    const {
      logger = console,
      operationName = 'Operation',
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2
    } = options;

    let lastError = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        logger.warn(`[Retry] ${operationName} attempt ${attempt}/${maxRetries + 1} failed: ${error.message}`);

        if (attempt <= maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));

          // Increase delay for next retry
          delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
      }
    }

    logger.error(`[Retry] ${operationName} failed after ${maxRetries + 1} attempts`);
    throw lastError;
  }

  /**
   * Create a callback-based error handler for event listeners
   * @param {function} callback - Callback to wrap
   * @param {object} options - Handling options
   * @returns {function} Wrapped callback
   */
  static wrapCallback(callback, options = {}) {
    const {
      logger = console,
      operationName = 'Callback',
      swallowErrors = false
    } = options;

    return (...args) => {
      try {
        const result = callback(...args);

        // Handle promise result
        if (result instanceof Promise) {
          result.catch(error => {
            logger.error(`[Callback] ${operationName} promise error`, {
              message: error?.message,
              stack: error?.stack
            });

            if (!swallowErrors) {
              throw error;
            }
          });
        }

        return result;
      } catch (error) {
        logger.error(`[Callback] ${operationName} error`, {
          message: error?.message,
          stack: error?.stack
        });

        if (!swallowErrors) {
          throw error;
        }
      }
    };
  }

  /**
   * Create a safe event listener that won't crash on error
   * @param {EventEmitter} emitter - Event emitter
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   * @param {object} options - Handling options
   */
  static safeOn(emitter, event, handler, options = {}) {
    const wrappedHandler = this.wrapCallback(handler, {
      ...options,
      operationName: `Event: ${event}`,
      swallowErrors: true
    });

    emitter.on(event, wrappedHandler);
    return wrappedHandler;
  }

  /**
   * Create a safe one-time event listener
   * @param {EventEmitter} emitter - Event emitter
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   * @param {object} options - Handling options
   */
  static safeOnce(emitter, event, handler, options = {}) {
    const wrappedHandler = this.wrapCallback(handler, {
      ...options,
      operationName: `Event (once): ${event}`,
      swallowErrors: true
    });

    emitter.once(event, wrappedHandler);
    return wrappedHandler;
  }
}

module.exports = { PromiseHandlers };

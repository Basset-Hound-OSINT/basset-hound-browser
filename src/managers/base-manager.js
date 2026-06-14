/**
 * Basset Hound Browser - Base Manager Class
 *
 * Provides a unified base class for all manager/handler classes across the codebase.
 * Implements common patterns for initialization, validation, cleanup, and error handling.
 *
 * Benefits:
 * - Eliminates 500+ LOC of duplicate code
 * - Standardizes manager lifecycle (initialize → validate → execute → cleanup)
 * - Provides unified logging and error handling
 * - Enables central manager lifecycle management via ManagerRegistry
 * - Maintains backward compatibility with existing managers
 *
 * @module base-manager
 */

const { createLogger } = require('../../logging');

/**
 * Manager lifecycle states
 */
const ManagerState = {
  UNINITIALIZED: 'uninitialized',
  INITIALIZING: 'initializing',
  INITIALIZED: 'initialized',
  VALIDATING: 'validating',
  READY: 'ready',
  ERROR: 'error',
  CLEANUP: 'cleanup'
};

/**
 * Base Manager Class
 *
 * Provides common functionality for all manager classes:
 * - Lifecycle management (init, validate, cleanup)
 * - Unified logging
 * - Error handling with recovery
 * - Status tracking and health checks
 * - Performance metrics
 *
 * @class BaseManager
 * @example
 * class CustomManager extends BaseManager {
 *   constructor(name, options) {
 *     super(name, options);
 *     this.customProperty = options.customProperty;
 *   }
 *
 *   async initialize() {
 *     // Call parent first
 *     await super.initialize();
 *     // Custom initialization
 *     this.logger.info('Custom initialization complete');
 *   }
 *
 *   async validate() {
 *     // Custom validation logic
 *     return { valid: true };
 *   }
 * }
 */
class BaseManager {
  /**
   * Create a new BaseManager instance
   *
   * @param {string} name - Unique manager name (used for logging)
   * @param {Object} options - Configuration options
   * @param {boolean} [options.enableMetrics=false] - Enable performance metrics collection
   * @param {number} [options.timeoutMs=30000] - Default timeout for operations
   * @param {boolean} [options.autoInitialize=false] - Automatically initialize on creation
   */
  constructor(name, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Manager name is required and must be a string');
    }

    /**
     * Unique manager identifier
     * @type {string}
     */
    this.name = name;

    /**
     * Current lifecycle state
     * @type {string}
     */
    this.state = ManagerState.UNINITIALIZED;

    /**
     * Whether manager is initialized
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Whether manager is validated
     * @type {boolean}
     */
    this.validated = false;

    /**
     * Logger instance for this manager
     * @type {Object}
     */
    this.logger = createLogger(`Manager:${name}`);

    /**
     * Configuration options
     * @type {Object}
     */
    this.options = options;

    /**
     * Enable metrics collection
     * @type {boolean}
     */
    this.enableMetrics = options.enableMetrics || false;

    /**
     * Default timeout for operations
     * @type {number}
     */
    this.timeoutMs = options.timeoutMs || 30000;

    /**
     * Performance metrics
     * @type {Object}
     */
    this.metrics = {
      initializationTime: 0,
      validationTime: 0,
      operationCount: 0,
      errorCount: 0,
      lastOperationTime: null,
      createdAt: new Date().toISOString()
    };

    /**
     * Error handler function
     * @type {Function|null}
     */
    this.errorHandler = options.errorHandler || null;

    /**
     * Cleanup handler function
     * @type {Function|null}
     */
    this.cleanupHandler = options.cleanupHandler || null;

    /**
     * Last error encountered
     * @type {Error|null}
     */
    this.lastError = null;

    // Auto-initialize if requested
    if (options.autoInitialize) {
      this.initialize().catch(error => {
        this.logger.error('Auto-initialization failed', error);
      });
    }
  }

  /**
   * Initialize the manager
   *
   * Subclasses should override this method to perform custom initialization.
   * Always call super.initialize() first.
   *
   * @returns {Promise<Object>} Initialization result
   * @throws {Error} If initialization fails
   * @example
   * async initialize() {
   *   await super.initialize();
   *   // Custom initialization logic
   * }
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn(`${this.name} already initialized`);
      return { success: true, message: 'Already initialized' };
    }

    try {
      this.setState(ManagerState.INITIALIZING);
      const startTime = Date.now();

      // Perform base initialization
      await this._baseInitialize();

      const duration = Date.now() - startTime;
      this.metrics.initializationTime = duration;
      this.initialized = true;
      this.setState(ManagerState.INITIALIZED);

      this.logger.info(`${this.name} initialized successfully`, {
        duration: `${duration}ms`
      });

      return {
        success: true,
        message: `${this.name} initialized`,
        duration
      };
    } catch (error) {
      this.lastError = error;
      this.setState(ManagerState.ERROR);
      this.metrics.errorCount++;

      this.logger.error(`${this.name} initialization failed`, error);

      if (this.errorHandler) {
        await this.errorHandler(error, 'initialization');
      }

      throw error;
    }
  }

  /**
   * Base initialization hook (for future use)
   * Override in subclasses to add base-level initialization
   * @private
   * @returns {Promise<void>}
   */
  async _baseInitialize() {
    // To be overridden in subclasses if needed
  }

  /**
   * Validate manager configuration and state
   *
   * Subclasses should override this method to perform custom validation.
   * Always call super.validate() first.
   *
   * @returns {Promise<Object>} Validation result with 'valid' boolean
   * @example
   * async validate() {
   *   const result = await super.validate();
   *   if (!result.valid) return result;
   *
   *   // Custom validation logic
   *   if (!this.requiredProperty) {
   *     return { valid: false, error: 'Required property missing' };
   *   }
   *
   *   return { valid: true };
   * }
   */
  async validate() {
    if (!this.initialized) {
      return {
        valid: false,
        error: 'Manager not initialized'
      };
    }

    try {
      this.setState(ManagerState.VALIDATING);
      const startTime = Date.now();

      // Perform base validation
      const baseValidation = await this._baseValidate();
      if (!baseValidation.valid) {
        return baseValidation;
      }

      const duration = Date.now() - startTime;
      this.metrics.validationTime = duration;
      this.validated = true;
      this.setState(ManagerState.READY);

      this.logger.info(`${this.name} validated successfully`, {
        duration: `${duration}ms`
      });

      return {
        valid: true,
        message: `${this.name} is ready`,
        duration
      };
    } catch (error) {
      this.lastError = error;
      this.setState(ManagerState.ERROR);
      this.metrics.errorCount++;

      this.logger.error(`${this.name} validation failed`, error);

      if (this.errorHandler) {
        await this.errorHandler(error, 'validation');
      }

      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Base validation hook (for future use)
   * Override in subclasses to add base-level validation
   * @private
   * @returns {Promise<Object>}
   */
  async _baseValidate() {
    return { valid: true };
  }

  /**
   * Cleanup and shutdown the manager
   *
   * Subclasses should override this method to perform custom cleanup.
   * Always call super.cleanup() after custom cleanup.
   *
   * @returns {Promise<Object>} Cleanup result
   * @example
   * async cleanup() {
   *   // Custom cleanup logic
   *   await this.closeConnections();
   *
   *   // Call parent cleanup
   *   return await super.cleanup();
   * }
   */
  async cleanup() {
    try {
      this.setState(ManagerState.CLEANUP);

      // Call cleanup handler if provided
      if (this.cleanupHandler) {
        await this.cleanupHandler();
      }

      // Perform base cleanup
      await this._baseCleanup();

      this.initialized = false;
      this.validated = false;
      this.setState(ManagerState.UNINITIALIZED);

      this.logger.info(`${this.name} cleanup complete`);

      return {
        success: true,
        message: `${this.name} cleaned up`
      };
    } catch (error) {
      this.lastError = error;
      this.logger.error(`${this.name} cleanup failed`, error);

      if (this.errorHandler) {
        await this.errorHandler(error, 'cleanup');
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Base cleanup hook (for future use)
   * Override in subclasses to add base-level cleanup
   * @private
   * @returns {Promise<void>}
   */
  async _baseCleanup() {
    // To be overridden in subclasses if needed
  }

  /**
   * Execute an operation with error handling and timeout protection
   *
   * Automatically tracks operation count and errors.
   * Provides timeout protection and error handling.
   *
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Execution options
   * @param {number} [options.timeoutMs] - Operation timeout in milliseconds
   * @param {boolean} [options.trackMetrics=true] - Whether to track metrics
   * @param {Function} [options.onError] - Custom error handler
   * @returns {Promise<*>} Operation result
   * @throws {Error} If operation fails or times out
   * @example
   * const result = await manager.safeExecute(
   *   async () => await someAsyncOperation(),
   *   { timeoutMs: 5000 }
   * );
   */
  async safeExecute(fn, options = {}) {
    const {
      timeoutMs = this.timeoutMs,
      trackMetrics = true,
      onError = null
    } = options;

    if (!this.initialized) {
      throw new Error(`${this.name} is not initialized`);
    }

    if (typeof fn !== 'function') {
      throw new Error('Operation must be a function');
    }

    const startTime = Date.now();

    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);

      if (trackMetrics) {
        this.metrics.operationCount++;
        this.metrics.lastOperationTime = Date.now() - startTime;
      }

      return result;
    } catch (error) {
      this.lastError = error;
      this.metrics.errorCount++;

      this.logger.error('Operation failed', error, {
        duration: `${Date.now() - startTime}ms`
      });

      if (onError) {
        await onError(error);
      } else if (this.errorHandler) {
        await this.errorHandler(error, 'operation');
      }

      throw error;
    }
  }

  /**
   * Get current manager status
   *
   * Returns comprehensive status information including:
   * - Lifecycle state
   * - Initialization status
   * - Health status
   * - Performance metrics
   * - Last error information
   *
   * @returns {Object} Status object
   * @example
   * const status = manager.getStatus();
   * console.log(status);
   * // {
   * //   name: 'ProxyManager',
   * //   state: 'ready',
   * //   initialized: true,
   * //   validated: true,
   * //   health: 'healthy',
   * //   metrics: { ... },
   * //   lastError: null
   * // }
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      initialized: this.initialized,
      validated: this.validated,
      health: this._getHealth(),
      metrics: { ...this.metrics },
      lastError: this.lastError ? {
        message: this.lastError.message,
        code: this.lastError.code,
        timestamp: new Date().toISOString()
      } : null,
      uptime: Date.now() - new Date(this.metrics.createdAt).getTime()
    };
  }

  /**
   * Get health status based on internal state
   * @private
   * @returns {string} Health status ('healthy', 'degraded', 'unhealthy')
   */
  _getHealth() {
    if (this.state === ManagerState.ERROR) {
      return 'unhealthy';
    }
    if (this.metrics.errorCount > 0) {
      return 'degraded';
    }
    if (this.initialized && this.validated) {
      return 'healthy';
    }
    return 'unknown';
  }

  /**
   * Set current manager state
   * @private
   * @param {string} newState - New state value
   */
  setState(newState) {
    if (!Object.values(ManagerState).includes(newState)) {
      this.logger.warn(`Invalid state transition: ${newState}`);
      return;
    }
    this.state = newState;
  }

  /**
   * Log a message at the specified level
   *
   * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
   * @param {string} message - Log message
   * @param {Object} [data={}] - Additional log data
   */
  log(level, message, data = {}) {
    if (typeof this.logger[level] === 'function') {
      this.logger[level](message, {
        manager: this.name,
        ...data
      });
    }
  }

  /**
   * Reset metrics counters
   */
  resetMetrics() {
    this.metrics = {
      initializationTime: 0,
      validationTime: 0,
      operationCount: 0,
      errorCount: 0,
      lastOperationTime: null,
      createdAt: this.metrics.createdAt
    };
  }

  /**
   * Check if manager is healthy and ready to use
   * @returns {boolean}
   */
  isHealthy() {
    return this.initialized && this.validated && this.state === ManagerState.READY;
  }

  /**
   * Check if manager is ready for operations
   * @returns {boolean}
   */
  isReady() {
    return this.initialized && this.validated;
  }

  /**
   * Get a copy of the current options
   * @returns {Object}
   */
  getOptions() {
    return { ...this.options };
  }
}

/**
 * Manager state enum (exported)
 * @type {Object}
 */
BaseManager.ManagerState = ManagerState;

// Export BaseManager and utilities
module.exports = {
  BaseManager,
  ManagerState
};

/**
 * Basset Hound Browser - Manager Registry
 *
 * Central registry for managing lifecycle of all manager instances.
 * Provides unified initialization, validation, and cleanup of managers.
 *
 * Benefits:
 * - Single point of control for all manager lifecycle
 * - Automatic dependency ordering
 * - Health monitoring for all managers
 * - Graceful shutdown on cleanup
 *
 * @module manager-registry
 */

const { createLogger } = require('../../logging');

/**
 * Manager Registry class
 *
 * Maintains a registry of all active managers and coordinates their lifecycle.
 * Supports initialization ordering, health monitoring, and graceful shutdown.
 *
 * @class ManagerRegistry
 * @example
 * const registry = new ManagerRegistry();
 * registry.register('proxy', proxyManager);
 * registry.register('session', sessionManager);
 *
 * // Initialize all managers in order
 * const result = await registry.initializeAll();
 *
 * // Get status of all managers
 * const status = registry.getHealthStatus();
 *
 * // Cleanup on shutdown
 * await registry.cleanupAll();
 */
class ManagerRegistry {
  /**
   * Create a new ManagerRegistry instance
   *
   * @param {Object} options - Configuration options
   * @param {Array<string>} [options.initializationOrder=[]] - Order for initialization
   */
  constructor(options = {}) {
    /**
     * Map of manager name -> manager instance
     * @type {Map<string, Object>}
     */
    this.managers = new Map();

    /**
     * Initialization order (if specified)
     * @type {Array<string>}
     */
    this.initializationOrder = options.initializationOrder || [];

    /**
     * Logger instance
     * @type {Object}
     */
    this.logger = createLogger('ManagerRegistry');

    /**
     * Registry initialization state
     * @type {boolean}
     */
    this.initialized = false;

    /**
     * Registry validation state
     * @type {boolean}
     */
    this.validated = false;

    /**
     * Initialize timestamp
     * @type {string|null}
     */
    this.initializedAt = null;

    /**
     * Statistics
     * @type {Object}
     */
    this.stats = {
      totalRegistered: 0,
      totalInitialized: 0,
      totalValidated: 0,
      totalErrors: 0,
      registeredAt: new Date().toISOString()
    };
  }

  /**
   * Register a manager instance
   *
   * @param {string} name - Unique manager name
   * @param {Object} manager - Manager instance (should extend BaseManager)
   * @returns {Object} Registration result
   * @throws {Error} If name is not a string or manager is invalid
   * @example
   * registry.register('proxy', proxyManager);
   */
  register(name, manager) {
    if (!name || typeof name !== 'string') {
      throw new Error('Manager name is required and must be a string');
    }

    if (!manager) {
      throw new Error('Manager instance is required');
    }

    if (this.managers.has(name)) {
      this.logger.warn(`Manager '${name}' is already registered, replacing...`);
    }

    this.managers.set(name, manager);
    this.stats.totalRegistered++;

    this.logger.debug(`Manager registered: ${name}`, {
      hasInitialize: typeof manager.initialize === 'function',
      hasValidate: typeof manager.validate === 'function',
      hasCleanup: typeof manager.cleanup === 'function'
    });

    return {
      success: true,
      message: `Manager '${name}' registered`,
      totalManagers: this.managers.size
    };
  }

  /**
   * Unregister a manager
   *
   * @param {string} name - Manager name to unregister
   * @returns {Object} Unregistration result
   */
  unregister(name) {
    if (!this.managers.has(name)) {
      return { success: false, error: `Manager '${name}' not found` };
    }

    this.managers.delete(name);
    this.logger.info(`Manager unregistered: ${name}`);

    return {
      success: true,
      message: `Manager '${name}' unregistered`,
      totalManagers: this.managers.size
    };
  }

  /**
   * Get a registered manager
   *
   * @param {string} name - Manager name
   * @returns {Object|null} Manager instance or null if not found
   */
  getManager(name) {
    return this.managers.get(name) || null;
  }

  /**
   * Check if a manager is registered
   *
   * @param {string} name - Manager name
   * @returns {boolean}
   */
  hasManager(name) {
    return this.managers.has(name);
  }

  /**
   * Get list of all registered manager names
   *
   * @returns {Array<string>}
   */
  listManagers() {
    return Array.from(this.managers.keys());
  }

  /**
   * Initialize all registered managers
   *
   * Managers are initialized in order specified by initializationOrder,
   * or in registration order if no specific order is defined.
   *
   * @param {Object} options - Initialization options
   * @param {boolean} [options.skipValidation=false] - Skip validation after init
   * @param {boolean} [options.continueOnError=false] - Continue if a manager fails
   * @returns {Promise<Object>} Initialization result
   * @example
   * const result = await registry.initializeAll({ continueOnError: false });
   * if (!result.success) {
   *   console.error('Initialization failed:', result.errors);
   * }
   */
  async initializeAll(options = {}) {
    const {
      skipValidation = false,
      continueOnError = false
    } = options;

    const startTime = Date.now();
    const results = {
      success: true,
      initialized: [],
      failed: [],
      errors: []
    };

    // Determine initialization order
    const initOrder = this._getInitializationOrder();

    this.logger.info(`Initializing ${initOrder.length} managers`, {
      order: initOrder,
      skipValidation,
      continueOnError
    });

    for (const managerName of initOrder) {
      const manager = this.managers.get(managerName);

      if (!manager) {
        this.logger.warn(`Manager '${managerName}' not found in registry`);
        continue;
      }

      try {
        if (typeof manager.initialize === 'function') {
          const result = await manager.initialize();
          results.initialized.push({
            name: managerName,
            ...result
          });
          this.stats.totalInitialized++;
        } else {
          this.logger.warn(`Manager '${managerName}' does not have initialize method`);
        }
      } catch (error) {
        const errorInfo = {
          name: managerName,
          error: error.message,
          code: error.code
        };

        results.failed.push(errorInfo);
        results.errors.push(errorInfo);
        this.stats.totalErrors++;

        this.logger.error(`Manager '${managerName}' initialization failed`, error);

        if (!continueOnError) {
          results.success = false;
          return {
            ...results,
            duration: Date.now() - startTime
          };
        }
      }
    }

    // Validate all managers if requested
    if (!skipValidation && results.success) {
      const validationResult = await this.validateAll({
        continueOnError
      });

      if (!validationResult.success) {
        return {
          ...results,
          success: false,
          validated: validationResult.validated,
          validationErrors: validationResult.errors,
          duration: Date.now() - startTime
        };
      }

      results.validated = validationResult.validated;
    }

    this.initialized = results.success;
    this.initializedAt = new Date().toISOString();

    const duration = Date.now() - startTime;

    this.logger.info(
      results.success ? 'All managers initialized successfully' : 'Some managers failed to initialize',
      {
        initialized: results.initialized.length,
        failed: results.failed.length,
        duration: `${duration}ms`
      }
    );

    return {
      ...results,
      duration,
      timestamp: this.initializedAt
    };
  }

  /**
   * Validate all registered managers
   *
   * @param {Object} options - Validation options
   * @param {boolean} [options.continueOnError=false] - Continue if a manager fails
   * @returns {Promise<Object>} Validation result
   */
  async validateAll(options = {}) {
    const {
      continueOnError = false
    } = options;

    const startTime = Date.now();
    const results = {
      success: true,
      validated: [],
      failed: [],
      errors: []
    };

    const managerNames = Array.from(this.managers.keys());

    this.logger.info(`Validating ${managerNames.length} managers`);

    for (const managerName of managerNames) {
      const manager = this.managers.get(managerName);

      if (!manager) continue;

      try {
        if (typeof manager.validate === 'function') {
          const result = await manager.validate();

          if (result.valid) {
            results.validated.push({
              name: managerName,
              ...result
            });
            this.stats.totalValidated++;
          } else {
            const errorInfo = {
              name: managerName,
              error: result.error
            };

            results.failed.push(errorInfo);
            results.errors.push(errorInfo);
            this.stats.totalErrors++;

            this.logger.warn(`Manager '${managerName}' validation failed`, result);

            if (!continueOnError) {
              results.success = false;
              return {
                ...results,
                duration: Date.now() - startTime
              };
            }
          }
        }
      } catch (error) {
        const errorInfo = {
          name: managerName,
          error: error.message
        };

        results.failed.push(errorInfo);
        results.errors.push(errorInfo);
        this.stats.totalErrors++;

        this.logger.error(`Manager '${managerName}' validation error`, error);

        if (!continueOnError) {
          results.success = false;
          return {
            ...results,
            duration: Date.now() - startTime
          };
        }
      }
    }

    this.validated = results.success;

    this.logger.info(
      results.success ? 'All managers validated' : 'Some managers failed validation',
      {
        validated: results.validated.length,
        failed: results.failed.length
      }
    );

    return {
      ...results,
      duration: Date.now() - startTime
    };
  }

  /**
   * Cleanup all registered managers in reverse order
   *
   * @param {Object} options - Cleanup options
   * @param {boolean} [options.continueOnError=true] - Continue if a manager fails
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupAll(options = {}) {
    const {
      continueOnError = true
    } = options;

    const startTime = Date.now();
    const results = {
      success: true,
      cleaned: [],
      failed: [],
      errors: []
    };

    // Cleanup in reverse initialization order (LIFO)
    const cleanupOrder = this._getInitializationOrder().reverse();

    this.logger.info(`Cleaning up ${cleanupOrder.length} managers in reverse order`);

    for (const managerName of cleanupOrder) {
      const manager = this.managers.get(managerName);

      if (!manager) continue;

      try {
        if (typeof manager.cleanup === 'function') {
          const result = await manager.cleanup();

          results.cleaned.push({
            name: managerName,
            ...result
          });

          this.logger.debug(`Manager '${managerName}' cleanup successful`);
        }
      } catch (error) {
        const errorInfo = {
          name: managerName,
          error: error.message
        };

        results.failed.push(errorInfo);
        results.errors.push(errorInfo);

        this.logger.error(`Manager '${managerName}' cleanup failed`, error);

        if (!continueOnError) {
          results.success = false;
          break;
        }
      }
    }

    this.initialized = false;
    this.validated = false;

    const duration = Date.now() - startTime;

    this.logger.info('Cleanup complete', {
      cleaned: results.cleaned.length,
      failed: results.failed.length,
      duration: `${duration}ms`
    });

    return {
      ...results,
      duration
    };
  }

  /**
   * Get health status of all managers
   *
   * @returns {Object} Health status for all managers
   */
  getHealthStatus() {
    const health = {
      overallHealth: 'unknown',
      registryInitialized: this.initialized,
      registryValidated: this.validated,
      managers: {},
      summary: {
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        unknown: 0
      }
    };

    for (const [name, manager] of this.managers.entries()) {
      const managerHealth = typeof manager.getStatus === 'function'
        ? manager.getStatus()
        : { health: 'unknown', initialized: false };

      health.managers[name] = {
        health: managerHealth.health || 'unknown',
        initialized: managerHealth.initialized || false,
        validated: managerHealth.validated || false
      };

      const healthStatus = managerHealth.health || 'unknown';
      health.summary[healthStatus]++;
    }

    // Calculate overall health
    if (health.summary.unhealthy > 0) {
      health.overallHealth = 'unhealthy';
    } else if (health.summary.degraded > 0) {
      health.overallHealth = 'degraded';
    } else if (health.summary.healthy > 0) {
      health.overallHealth = 'healthy';
    }

    return health;
  }

  /**
   * Get detailed status of all managers
   *
   * @returns {Object} Detailed status information
   */
  getDetailedStatus() {
    const status = {
      registry: {
        initialized: this.initialized,
        validated: this.validated,
        initializedAt: this.initializedAt,
        totalManagers: this.managers.size,
        stats: { ...this.stats }
      },
      managers: {}
    };

    for (const [name, manager] of this.managers.entries()) {
      status.managers[name] = typeof manager.getStatus === 'function'
        ? manager.getStatus()
        : {
          name,
          state: 'unknown',
          initialized: false,
          health: 'unknown'
        };
    }

    return status;
  }

  /**
   * Get initialization order
   * @private
   * @returns {Array<string>} Ordered list of manager names
   */
  _getInitializationOrder() {
    if (this.initializationOrder.length > 0) {
      // Filter to only registered managers in specified order
      return this.initializationOrder.filter(name => this.managers.has(name));
    }

    // Return all managers in registration order
    return Array.from(this.managers.keys());
  }
}

// Export ManagerRegistry
module.exports = {
  ManagerRegistry
};

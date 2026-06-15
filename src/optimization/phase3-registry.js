/**
 * Phase 3 Performance Optimization Registry
 *
 * Central orchestration point for all Phase 3 performance optimizers.
 * Enables dependency management, lazy initialization, and runtime control.
 *
 * Architecture:
 * - Lazy initialization (only load optimizers that are needed)
 * - Dependency injection (optimizer A can depend on optimizer B)
 * - Runtime control (enable/disable optimizers without restart)
 * - Metrics aggregation (collect performance data from all optimizers)
 */

const EventEmitter = require('events');

class Phase3Registry extends EventEmitter {
  constructor(options = {}) {
    super();

    this.optimizers = new Map();
    this.initialized = false;
    this.metrics = new Map();
    this.enabled = options.enabled !== false; // Default: enabled
    this.debug = options.debug || false;

    // Performance thresholds for auto-tuning
    this.thresholds = {
      poolWatermark: options.poolWatermark || 0.8, // 80% capacity
      cacheHitRateTarget: options.cacheHitRateTarget || 0.95,
      compressionRatioThreshold: options.compressionRatioThreshold || 0.05, // 5%
      gcPauseThreshold: options.gcPauseThreshold || 50, // 50ms
    };
  }

  /**
   * Register an optimizer module
   * @param {string} name - Optimizer name (e.g., 'commandPipeline')
   * @param {Function} FactoryFn - Factory function returning optimizer instance
   * @param {Object} options - Optimizer options
   */
  register(name, FactoryFn, options = {}) {
    if (this.optimizers.has(name)) {
      throw new Error(`Optimizer '${name}' already registered`);
    }

    this.optimizers.set(name, {
      factory: FactoryFn,
      options,
      instance: null,
      enabled: options.enabled !== false,
      dependencies: options.dependencies || [],
      initialized: false,
      metrics: {
        calls: 0,
        errors: 0,
        totalTime: 0,
        avgTime: 0,
      }
    });

    this.debug && console.log(`[Phase3Registry] Registered optimizer: ${name}`);
  }

  /**
   * Initialize a specific optimizer (lazy loading)
   * @param {string} name - Optimizer name
   * @returns {any} Optimizer instance
   */
  initialize(name) {
    const config = this.optimizers.get(name);

    if (!config) {
      throw new Error(`Optimizer '${name}' not registered`);
    }

    if (config.instance !== null) {
      return config.instance; // Already initialized
    }

    // Initialize dependencies first
    for (const dep of config.dependencies) {
      this.initialize(dep);
    }

    // Create instance
    const depInstances = {};
    for (const dep of config.dependencies) {
      depInstances[dep] = this.optimizers.get(dep).instance;
    }

    config.instance = new config.factory({
      ...config.options,
      dependencies: depInstances,
      registry: this,
    });

    config.initialized = true;
    this.emit('optimizer-initialized', { name, optimizer: config.instance });
    this.debug && console.log(`[Phase3Registry] Initialized optimizer: ${name}`);

    return config.instance;
  }

  /**
   * Get optimizer instance (auto-initialize if needed)
   * @param {string} name - Optimizer name
   * @returns {any|null} Optimizer instance or null if disabled
   */
  get(name) {
    const config = this.optimizers.get(name);

    if (!config) {
      return null;
    }

    if (!config.enabled || !this.enabled) {
      return null;
    }

    return this.initialize(name);
  }

  /**
   * Initialize all registered optimizers
   * @returns {Promise<void>}
   */
  async initializeAll() {
    if (this.initialized) {
      return;
    }

    const names = Array.from(this.optimizers.keys());

    for (const name of names) {
      const config = this.optimizers.get(name);
      if (config.enabled && this.enabled) {
        try {
          this.initialize(name);
        } catch (error) {
          console.error(`[Phase3Registry] Failed to initialize ${name}:`, error);
          config.enabled = false;
        }
      }
    }

    this.initialized = true;
    this.emit('all-initialized');
  }

  /**
   * Enable/disable an optimizer at runtime
   * @param {string} name - Optimizer name
   * @param {boolean} enabled - Enable/disable flag
   */
  setEnabled(name, enabled) {
    const config = this.optimizers.get(name);
    if (config) {
      config.enabled = enabled;
      this.emit('optimizer-toggled', { name, enabled });
    }
  }

  /**
   * Record metric for an optimizer
   * @param {string} name - Optimizer name
   * @param {number} timeMs - Execution time in milliseconds
   * @param {boolean} error - Whether this call resulted in an error
   */
  recordMetric(name, timeMs, error = false) {
    const config = this.optimizers.get(name);
    if (!config) return;

    const metrics = config.metrics;
    metrics.calls++;
    metrics.totalTime += timeMs;
    metrics.avgTime = metrics.totalTime / metrics.calls;

    if (error) {
      metrics.errors++;
    }
  }

  /**
   * Get metrics for an optimizer
   * @param {string} name - Optimizer name
   * @returns {Object} Metrics object
   */
  getMetrics(name) {
    const config = this.optimizers.get(name);
    return config ? { ...config.metrics } : null;
  }

  /**
   * Get all metrics
   * @returns {Object} All metrics by optimizer name
   */
  getAllMetrics() {
    const result = {};
    for (const [name, config] of this.optimizers) {
      result[name] = { ...config.metrics };
    }
    return result;
  }

  /**
   * Get status of all optimizers
   * @returns {Object} Status report
   */
  getStatus() {
    const status = {
      initialized: this.initialized,
      enabled: this.enabled,
      optimizers: {},
    };

    for (const [name, config] of this.optimizers) {
      status.optimizers[name] = {
        enabled: config.enabled,
        initialized: config.initialized,
        metrics: { ...config.metrics },
      };
    }

    return status;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    for (const config of this.optimizers.values()) {
      config.metrics = {
        calls: 0,
        errors: 0,
        totalTime: 0,
        avgTime: 0,
      };
    }
  }

  /**
   * Gracefully shutdown all optimizers
   * @returns {Promise<void>}
   */
  async shutdown() {
    for (const [name, config] of this.optimizers) {
      if (config.instance && typeof config.instance.shutdown === 'function') {
        try {
          await config.instance.shutdown();
        } catch (error) {
          console.error(`[Phase3Registry] Error shutting down ${name}:`, error);
        }
      }
    }

    this.initialized = false;
    this.emit('shutdown');
  }
}

// Create singleton instance
const phase3Registry = new Phase3Registry({
  debug: process.env.DEBUG_PHASE3 === 'true',
});

module.exports = {
  Phase3Registry,
  phase3Registry,
};

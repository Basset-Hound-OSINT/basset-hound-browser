/**
 * Basset Hound Browser - Plugin Sandbox Module
 * Provides isolated execution environment for plugins
 */

const { EventEmitter } = require('events');
const vm = require('vm');
const path = require('path');

/**
 * Sandbox execution states
 */
const SANDBOX_STATE = {
  IDLE: 'idle',
  RUNNING: 'running',
  TIMEOUT: 'timeout',
  ERROR: 'error'
};

/**
 * Resource limit defaults
 */
const DEFAULT_LIMITS = {
  timeout: 30000,           // 30 seconds
  memoryLimit: 50 * 1024 * 1024, // 50MB
  maxLoopIterations: 100000,
  maxRecursionDepth: 100,
  maxArrayLength: 100000,
  maxObjectProperties: 10000
};

/**
 * PluginSandbox class
 * Provides isolated execution environment with resource limits
 */
class PluginSandbox extends EventEmitter {
  /**
   * Create a new PluginSandbox instance
   * @param {Object} options - Sandbox options
   * @param {number} [options.timeout] - Execution timeout in ms
   * @param {number} [options.memoryLimit] - Memory limit in bytes
   * @param {string[]} [options.allowedModules] - Modules allowed to require
   * @param {Object} [options.globalOverrides] - Custom global overrides
   */
  constructor(options = {}) {
    super();

    // Resource limits
    this.limits = {
      timeout: options.timeout || DEFAULT_LIMITS.timeout,
      memoryLimit: options.memoryLimit || DEFAULT_LIMITS.memoryLimit,
      maxLoopIterations: options.maxLoopIterations || DEFAULT_LIMITS.maxLoopIterations,
      maxRecursionDepth: options.maxRecursionDepth || DEFAULT_LIMITS.maxRecursionDepth,
      maxArrayLength: options.maxArrayLength || DEFAULT_LIMITS.maxArrayLength,
      maxObjectProperties: options.maxObjectProperties || DEFAULT_LIMITS.maxObjectProperties
    };

    // Allowed modules for require
    this.allowedModules = options.allowedModules || [
      'path',
      'url',
      'querystring',
      'util',
      'events',
      'buffer'
    ];

    // Blocked globals
    this.blockedGlobals = [
      'process',
      'global',
      '__dirname',
      '__filename',
      'setImmediate',
      'clearImmediate'
    ];

    // Custom global overrides
    this.globalOverrides = options.globalOverrides || {};

    // Execution state
    this.state = SANDBOX_STATE.IDLE;

    // Active contexts for cleanup
    this.activeContexts = new Map();

    // Execution statistics
    this.stats = {
      executions: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      totalTime: 0
    };

    console.log('[PluginSandbox] Initialized');
  }

  /**
   * Create a safe require function
   * @param {string} baseDir - Base directory for relative requires
   * @returns {Function} Safe require function
   */
  createSafeRequire(baseDir) {
    const allowedModules = this.allowedModules;

    return (moduleName) => {
      // Check if module is allowed
      if (!allowedModules.includes(moduleName)) {
        throw new Error(`Module not allowed in sandbox: ${moduleName}`);
      }

      // Only allow built-in modules
      try {
        return require(moduleName);
      } catch (error) {
        throw new Error(`Failed to load module: ${moduleName}`);
      }
    };
  }

  /**
   * Create safe console object
   * @param {string} pluginName - Plugin name for logging prefix
   * @returns {Object} Safe console object
   */
  createSafeConsole(pluginName) {
    const prefix = `[Plugin:${pluginName}]`;

    return {
      log: (...args) => console.log(prefix, ...args),
      info: (...args) => console.info(prefix, ...args),
      warn: (...args) => console.warn(prefix, ...args),
      error: (...args) => console.error(prefix, ...args),
      debug: (...args) => console.debug(prefix, ...args),
      trace: () => {}, // Disabled
      dir: () => {}, // Disabled
      table: () => {}, // Disabled
      time: () => {},
      timeEnd: () => {},
      group: () => {},
      groupEnd: () => {},
      clear: () => {}
    };
  }

  /**
   * Create safe timer functions
   * @param {string} contextId - Context identifier
   * @returns {Object} Timer functions
   */
  createSafeTimers(contextId) {
    const timers = new Set();
    const intervals = new Set();
    const self = this;

    return {
      timers,
      intervals,
      setTimeout: (callback, delay, ...args) => {
        const id = setTimeout(() => {
          timers.delete(id);
          try {
            callback(...args);
          } catch (error) {
            self.emit('timer-error', { contextId, error: error.message });
          }
        }, Math.min(delay, self.limits.timeout));
        timers.add(id);
        return id;
      },
      clearTimeout: (id) => {
        clearTimeout(id);
        timers.delete(id);
      },
      setInterval: (callback, delay, ...args) => {
        const id = setInterval(() => {
          try {
            callback(...args);
          } catch (error) {
            self.emit('timer-error', { contextId, error: error.message });
            clearInterval(id);
            intervals.delete(id);
          }
        }, Math.max(delay, 100)); // Minimum 100ms interval
        intervals.add(id);
        return id;
      },
      clearInterval: (id) => {
        clearInterval(id);
        intervals.delete(id);
      },
      cleanup: () => {
        for (const id of timers) {
          clearTimeout(id);
        }
        for (const id of intervals) {
          clearInterval(id);
        }
        timers.clear();
        intervals.clear();
      }
    };
  }

  /**
   * Create a sandbox context
   * @param {Object} options - Context options
   * @param {string} [options.filename] - Script filename
   * @param {Object} [options.api] - Plugin API instance
   * @param {string} [options.pluginName] - Plugin name
   * @returns {Object} Sandbox context
   */
  createContext(options = {}) {
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pluginName = options.pluginName || 'unknown';

    // Create safe timers
    const safeTimers = this.createSafeTimers(contextId);

    // Create the sandbox global object
    const sandbox = {
      // Safe console
      console: this.createSafeConsole(pluginName),

      // Safe require
      require: this.createSafeRequire(path.dirname(options.filename || '')),

      // Timer functions
      setTimeout: safeTimers.setTimeout,
      clearTimeout: safeTimers.clearTimeout,
      setInterval: safeTimers.setInterval,
      clearInterval: safeTimers.clearInterval,

      // Safe globals
      JSON: JSON,
      Math: Math,
      Date: Date,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      RangeError: RangeError,
      SyntaxError: SyntaxError,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Map: Map,
      Set: Set,
      WeakMap: WeakMap,
      WeakSet: WeakSet,
      Promise: Promise,
      Symbol: Symbol,
      Proxy: Proxy,
      Reflect: Reflect,

      // Encoding/Decoding
      encodeURIComponent: encodeURIComponent,
      decodeURIComponent: decodeURIComponent,
      encodeURI: encodeURI,
      decodeURI: decodeURI,
      btoa: (data) => Buffer.from(data).toString('base64'),
      atob: (data) => Buffer.from(data, 'base64').toString(),

      // Buffer (limited)
      Buffer: {
        from: Buffer.from.bind(Buffer),
        alloc: (size) => {
          if (size > 1024 * 1024) { // Max 1MB
            throw new Error('Buffer size exceeds limit');
          }
          return Buffer.alloc(size);
        },
        isBuffer: Buffer.isBuffer.bind(Buffer),
        concat: Buffer.concat.bind(Buffer)
      },

      // TextEncoder/TextDecoder
      TextEncoder: TextEncoder,
      TextDecoder: TextDecoder,

      // EventEmitter (for plugin use)
      EventEmitter: require('events').EventEmitter,

      // Module exports container
      module: { exports: {} },
      exports: {},

      // Plugin API (if provided)
      api: options.api || null,

      // Undefined (some code checks for it)
      undefined: undefined,

      // NaN and Infinity
      NaN: NaN,
      Infinity: Infinity,

      // isNaN and isFinite
      isNaN: isNaN,
      isFinite: isFinite,
      parseInt: parseInt,
      parseFloat: parseFloat,

      // Apply custom overrides
      ...this.globalOverrides
    };

    // Link exports
    sandbox.exports = sandbox.module.exports;

    // Create VM context
    const vmContext = vm.createContext(sandbox, {
      name: `Plugin:${pluginName}`,
      codeGeneration: {
        strings: false, // Disable eval-like functions
        wasm: false     // Disable WebAssembly
      }
    });

    // Store context for cleanup
    this.activeContexts.set(contextId, {
      context: vmContext,
      timers: safeTimers,
      createdAt: Date.now()
    });

    return {
      id: contextId,
      context: vmContext,
      cleanup: () => {
        safeTimers.cleanup();
        this.activeContexts.delete(contextId);
      }
    };
  }

  /**
   * Execute code in a sandbox
   * @param {string} code - JavaScript code to execute
   * @param {Object} options - Execution options
   * @param {string} [options.filename] - Script filename
   * @param {Object} [options.api] - Plugin API instance
   * @param {number} [options.timeout] - Execution timeout
   * @returns {Promise<Object>} Execution result
   */
  async execute(code, options = {}) {
    const startTime = Date.now();
    this.stats.executions++;

    const timeout = options.timeout || this.limits.timeout;
    const pluginName = options.pluginName || path.basename(options.filename || 'plugin', '.js');

    console.log(`[PluginSandbox] Executing plugin: ${pluginName}`);

    try {
      this.state = SANDBOX_STATE.RUNNING;

      // Create sandbox context
      const { id, context, cleanup } = this.createContext({
        ...options,
        pluginName
      });

      // Create the script
      const script = new vm.Script(code, {
        filename: options.filename || 'plugin.js',
        lineOffset: 0,
        columnOffset: 0,
        displayErrors: true
      });

      // Execute with timeout
      const result = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          this.state = SANDBOX_STATE.TIMEOUT;
          this.stats.timeouts++;
          cleanup();
          reject(new Error(`Execution timeout after ${timeout}ms`));
        }, timeout);

        try {
          // Run the script
          script.runInContext(context, {
            timeout: timeout,
            displayErrors: true,
            breakOnSigint: true
          });

          clearTimeout(timeoutId);

          // Get exports
          const exports = context.module.exports;
          resolve({ success: true, exports, contextId: id });
        } catch (error) {
          clearTimeout(timeoutId);
          cleanup();
          reject(error);
        }
      });

      this.state = SANDBOX_STATE.IDLE;
      this.stats.successes++;
      this.stats.totalTime += Date.now() - startTime;

      return result;

    } catch (error) {
      this.state = SANDBOX_STATE.ERROR;
      this.stats.failures++;
      this.stats.totalTime += Date.now() - startTime;

      console.error(`[PluginSandbox] Execution error: ${error.message}`);

      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  /**
   * Execute a function within a sandbox context
   * @param {Function} fn - Function to execute
   * @param {Array} args - Function arguments
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  async executeFunction(fn, args = [], options = {}) {
    const timeout = options.timeout || this.limits.timeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.state = SANDBOX_STATE.TIMEOUT;
        reject(new Error(`Function execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        const result = fn(...args);

        // Handle promises
        if (result instanceof Promise) {
          result
            .then(value => {
              clearTimeout(timeoutId);
              resolve({ success: true, result: value });
            })
            .catch(error => {
              clearTimeout(timeoutId);
              reject(error);
            });
        } else {
          clearTimeout(timeoutId);
          resolve({ success: true, result });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Validate code before execution
   * @param {string} code - Code to validate
   * @returns {Object} Validation result
   */
  validateCode(code) {
    const issues = [];

    // Check for blocked patterns
    const blockedPatterns = [
      { pattern: /process\s*\.\s*(exit|kill|abort)/g, message: 'Process control not allowed' },
      { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/g, message: 'child_process module not allowed' },
      { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, message: 'fs module not allowed' },
      { pattern: /require\s*\(\s*['"`]net['"`]\s*\)/g, message: 'net module not allowed' },
      { pattern: /require\s*\(\s*['"`]dgram['"`]\s*\)/g, message: 'dgram module not allowed' },
      { pattern: /require\s*\(\s*['"`]cluster['"`]\s*\)/g, message: 'cluster module not allowed' },
      { pattern: /require\s*\(\s*['"`]worker_threads['"`]\s*\)/g, message: 'worker_threads not allowed' },
      { pattern: /\beval\s*\(/g, message: 'eval() is not allowed' },
      { pattern: /new\s+Function\s*\(/g, message: 'Function constructor not allowed' },
      { pattern: /\bglobal\b/g, message: 'global object access not allowed' },
      { pattern: /__dirname|__filename/g, message: 'Directory/file access not allowed' }
    ];

    for (const { pattern, message } of blockedPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }

    // Check for potential infinite loops (basic heuristic)
    const whilePattern = /while\s*\(\s*true\s*\)/g;
    const forPattern = /for\s*\(\s*;\s*;\s*\)/g;
    if (whilePattern.test(code) || forPattern.test(code)) {
      issues.push('Potential infinite loop detected');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get sandbox statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeContexts: this.activeContexts.size,
      state: this.state,
      averageTime: this.stats.executions > 0
        ? Math.round(this.stats.totalTime / this.stats.executions)
        : 0
    };
  }

  /**
   * Get current limits
   * @returns {Object} Resource limits
   */
  getLimits() {
    return { ...this.limits };
  }

  /**
   * Update limits
   * @param {Object} newLimits - New limits
   * @returns {Object} Updated limits
   */
  setLimits(newLimits) {
    Object.assign(this.limits, newLimits);
    return this.getLimits();
  }

  /**
   * Cleanup a specific context
   * @param {string} contextId - Context ID
   */
  cleanupContext(contextId) {
    const ctx = this.activeContexts.get(contextId);
    if (ctx) {
      ctx.timers.cleanup();
      this.activeContexts.delete(contextId);
      console.log(`[PluginSandbox] Context cleaned up: ${contextId}`);
    }
  }

  /**
   * Cleanup all contexts
   */
  cleanup() {
    for (const [id, ctx] of this.activeContexts) {
      ctx.timers.cleanup();
    }
    this.activeContexts.clear();
    this.state = SANDBOX_STATE.IDLE;

    console.log('[PluginSandbox] All contexts cleaned up');
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      executions: 0,
      successes: 0,
      failures: 0,
      timeouts: 0,
      totalTime: 0
    };
  }
}

module.exports = {
  PluginSandbox,
  SANDBOX_STATE,
  DEFAULT_LIMITS
};

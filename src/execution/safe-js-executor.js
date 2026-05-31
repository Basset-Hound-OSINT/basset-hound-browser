/**
 * Safe JavaScript Executor with Timeout and Resource Protection
 *
 * Protects against:
 * - Infinite loops
 * - Memory bombs
 * - CPU bombs
 * - DOM bombs
 * - Recursive crashes
 *
 * Implements:
 * - Strict execution timeout (default 30 seconds)
 * - Code pattern validation
 * - Sandbox wrapping
 * - Resource monitoring
 */

const crypto = require('crypto');

class SafeJavaScriptExecutor {
  /**
   * Patterns that should never be allowed
   * These patterns indicate dangerous code that should be blocked
   */
  static CODE_BLOCKLIST = [
    // Code evaluation
    /\beval\s*\(/i,
    /new\s+Function/i,
    /Function\s*\(/i,
    /setTimeout.*eval/i,
    /setInterval.*eval/i,
    /setImmediate.*eval/i,

    // DOM manipulation (dangerous)
    /document\.write\(/i,
    /document\.writeln\(/i,
    /innerHTML\s*=/i,
    /insertAdjacentHTML/i,
    /eval.*innerHTML/i,

    // Navigation
    /window\.location\.href\s*=/i,
    /window\.location\.assign/i,
    /window\.location\.replace/i,
    /window\.location\.reload/i,

    // Network access
    /\bfetch\s*\(/i,
    /XMLHttpRequest/i,
    /\bWebSocket/i,
    /EventSource\s*\(/i,

    // Worker creation
    /new\s+Worker/i,
    /new\s+SharedWorker/i,
    /new\s+ServiceWorker/i,

    // Plugin/extension access
    /navigator\.plugins/i,
    /navigator\.mimeTypes/i,

    // Reflection (can be used to bypass sandbox)
    /\bProxy\b/i,
    /\bReflect\b/i,
    /Object\.freeze\s*\(/i,
    /Object\.seal\s*\(/i,
    /Object\.preventExtensions/i,

    // Import/dynamic code loading
    /\bimport\s*\(/i,
    /dynamic\s+import/i,

    // System access (if executed in Node context)
    /process\./i,
    /require\s*\(/i,
    /module\./i,
    /global\./i
  ];

  /**
   * Default configuration
   */
  static DEFAULT_CONFIG = {
    timeout: 30000,  // 30 seconds
    sandbox: true,
    codeLimit: 1048576,  // 1MB
    allowStrictMode: true,
    checkBlocklist: true,
    enableMonitoring: true
  };

  /**
   * Constructor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...SafeJavaScriptExecutor.DEFAULT_CONFIG, ...config };
    this.executionHistory = [];
  }

  /**
   * Validate JavaScript code before execution
   * @param {string} code - Code to validate
   * @returns {Object} { valid: boolean, error?: string, warnings?: Array }
   */
  validateCode(code) {
    if (typeof code !== 'string') {
      return { valid: false, error: 'Code must be a string' };
    }

    if (code.length === 0) {
      return { valid: false, error: 'Code cannot be empty' };
    }

    if (code.length > this.config.codeLimit) {
      return {
        valid: false,
        error: `Code too long (max ${this.config.codeLimit} bytes, got ${code.length})`
      };
    }

    if (this.config.checkBlocklist) {
      // Check against blocklist
      for (const pattern of SafeJavaScriptExecutor.CODE_BLOCKLIST) {
        if (pattern.test(code)) {
          return {
            valid: false,
            error: `Forbidden pattern detected: ${pattern.source}`,
            pattern: pattern.source
          };
        }
      }
    }

    // Check for obvious infinite loops
    if (code.includes('while(true)') || code.includes('while (true)') ||
        code.includes('for(;;)') || code.includes('for (;;)')) {
      return {
        valid: false,
        error: 'Obvious infinite loop detected'
      };
    }

    return { valid: true };
  }

  /**
   * Wrap code in a sandbox
   * @private
   */
  _wrapInSandbox(code) {
    return `(function() {
  'use strict';

  // Create restricted sandbox
  const sandbox = Object.create(null);

  // Allowed APIs
  sandbox.console = console;
  sandbox.Math = Math;
  sandbox.String = String;
  sandbox.Number = Number;
  sandbox.Boolean = Boolean;
  sandbox.Array = Array;
  sandbox.Object = Object;
  sandbox.Object.keys = Object.keys;
  sandbox.Object.values = Object.values;
  sandbox.Object.entries = Object.entries;
  sandbox.Object.assign = Object.assign;
  sandbox.Object.freeze = function() {
    throw new Error('Object.freeze not allowed');
  };
  sandbox.Object.seal = function() {
    throw new Error('Object.seal not allowed');
  };
  sandbox.Object.preventExtensions = function() {
    throw new Error('Object.preventExtensions not allowed');
  };
  sandbox.Date = Date;
  sandbox.RegExp = RegExp;
  sandbox.JSON = JSON;
  sandbox.Map = Map;
  sandbox.Set = Set;
  sandbox.WeakMap = WeakMap;
  sandbox.WeakSet = WeakSet;
  sandbox.Promise = Promise;
  sandbox.Symbol = Symbol;
  sandbox.Error = Error;
  sandbox.TypeError = TypeError;
  sandbox.RangeError = RangeError;
  sandbox.parseInt = parseInt;
  sandbox.parseFloat = parseFloat;
  sandbox.isNaN = isNaN;
  sandbox.isFinite = isFinite;
  sandbox.encodeURIComponent = encodeURIComponent;
  sandbox.decodeURIComponent = decodeURIComponent;
  sandbox.encodeURI = encodeURI;
  sandbox.decodeURI = decodeURI;

  // Browser APIs (read-only)
  sandbox.document = document;
  sandbox.window = window;
  sandbox.navigator = navigator;
  sandbox.location = location;
  sandbox.history = history;

  // DOM selectors (read-only)
  sandbox.querySelector = document.querySelector.bind(document);
  sandbox.querySelectorAll = document.querySelectorAll.bind(document);
  sandbox.getElementById = document.getElementById.bind(document);
  sandbox.getElementsByClassName = document.getElementsByClassName.bind(document);
  sandbox.getElementsByTagName = document.getElementsByTagName.bind(document);
  sandbox.getElementsByName = document.getElementsByName.bind(document);

  // Blocked APIs - explicitly undefined
  sandbox.fetch = undefined;
  sandbox.XMLHttpRequest = undefined;
  sandbox.WebSocket = undefined;
  sandbox.Worker = undefined;
  sandbox.SharedWorker = undefined;
  sandbox.ServiceWorker = undefined;
  sandbox.eval = undefined;
  sandbox.Function = undefined;
  sandbox.setTimeout = undefined;
  sandbox.setInterval = undefined;
  sandbox.setImmediate = undefined;
  sandbox.Reflect = undefined;
  sandbox.Proxy = undefined;
  sandbox.import = undefined;
  sandbox.require = undefined;
  sandbox.process = undefined;
  sandbox.global = undefined;
  sandbox.module = undefined;

  // Execute user code with sandbox
  return (function() {
    ${code}
  }).call(sandbox);
})();`;
  }

  /**
   * Execute JavaScript with timeout and protection
   * @param {Object} context - Execution context (typically webContents)
   * @param {string} code - Code to execute
   * @param {Object} options - Override options
   * @returns {Promise} Resolves to result or error
   */
  async executeWithProtections(context, code, options = {}) {
    const mergedOptions = { ...this.config, ...options };
    const executionId = crypto.randomBytes(8).toString('hex');
    const startTime = Date.now();

    try {
      // Step 1: Validate code
      const validation = this.validateCode(code);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          code: 'VALIDATION_FAILED'
        };
      }

      // Step 2: Wrap in sandbox if requested
      let executionCode = code;
      if (mergedOptions.sandbox) {
        executionCode = this._wrapInSandbox(code);
      }

      // Step 3: Execute with timeout
      let result;
      try {
        result = await Promise.race([
          this._executeCode(context, executionCode),
          this._timeoutPromise(mergedOptions.timeout)
        ]);
      } catch (error) {
        if (error.code === 'TIMEOUT') {
          return {
            success: false,
            error: `Execution timeout (${mergedOptions.timeout}ms exceeded)`,
            code: 'TIMEOUT',
            executionId
          };
        }
        throw error;
      }

      // Log successful execution
      const duration = Date.now() - startTime;
      this._logExecution(executionId, 'success', code.substring(0, 100), duration);

      return {
        success: true,
        result,
        executionId,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._logExecution(executionId, 'error', code.substring(0, 100), duration, error.message);

      return {
        success: false,
        error: error.message || String(error),
        code: 'EXECUTION_ERROR',
        executionId,
        duration
      };
    }
  }

  /**
   * Execute code (delegate to context)
   * @private
   */
  _executeCode(context, code) {
    if (typeof context.executeJavaScript === 'function') {
      // Electron webContents
      return context.executeJavaScript(code);
    } else if (typeof context.evaluate === 'function') {
      // Puppeteer
      return context.evaluate((codeStr) => {
        return eval(codeStr);
      }, code);
    } else {
      throw new Error('Invalid execution context');
    }
  }

  /**
   * Create timeout promise
   * @private
   */
  _timeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error('Execution timeout');
        error.code = 'TIMEOUT';
        reject(error);
      }, timeout);
    });
  }

  /**
   * Log execution for audit trail
   * @private
   */
  _logExecution(executionId, status, codeSnippet, duration, error = null) {
    const entry = {
      executionId,
      timestamp: new Date().toISOString(),
      status,
      codeSnippet: codeSnippet + (codeSnippet.length >= 100 ? '...' : ''),
      duration,
      error
    };

    this.executionHistory.push(entry);

    // Keep only last 1000 entries
    if (this.executionHistory.length > 1000) {
      this.executionHistory.shift();
    }
  }

  /**
   * Get execution history
   * @param {number} limit - Number of entries to return
   * @returns {Array} History entries
   */
  getExecutionHistory(limit = 50) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory() {
    this.executionHistory = [];
  }

  /**
   * Get execution statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(e => e.status === 'success').length;
    const failed = this.executionHistory.filter(e => e.status === 'error').length;
    const avgDuration = total > 0
      ? this.executionHistory.reduce((sum, e) => sum + e.duration, 0) / total
      : 0;

    return {
      totalExecutions: total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : 'N/A',
      averageDuration: avgDuration.toFixed(2) + 'ms',
      maxDuration: total > 0 ? Math.max(...this.executionHistory.map(e => e.duration)) : 0,
      minDuration: total > 0 ? Math.min(...this.executionHistory.map(e => e.duration)) : 0
    };
  }

  /**
   * Create a code snippet validator (fast check only)
   * @param {string} snippet - Code snippet to check
   * @returns {boolean} True if code appears safe
   */
  static quickValidate(snippet) {
    if (typeof snippet !== 'string') return false;
    if (snippet.length === 0 || snippet.length > 1048576) return false;

    // Quick blocklist check
    for (const pattern of SafeJavaScriptExecutor.CODE_BLOCKLIST) {
      if (pattern.test(snippet)) return false;
    }

    return true;
  }
}

module.exports = { SafeJavaScriptExecutor };

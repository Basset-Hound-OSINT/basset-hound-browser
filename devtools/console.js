/**
 * Console Manager for Basset Hound Browser
 * Captures and manages console logs from web pages
 */

const { ipcMain } = require('electron');

/**
 * Console message types
 */
const CONSOLE_TYPES = {
  LOG: 'log',
  WARN: 'warn',
  ERROR: 'error',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * ConsoleManager class
 * Manages console log capture, storage, and retrieval
 */
class ConsoleManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.consoleLogs = [];
    this.maxLogs = 10000; // Maximum logs to store
    this.subscribers = new Set();
    this.isCapturing = false;

    this.setupIPCHandlers();
  }

  /**
   * Setup IPC handlers for console events from renderer
   */
  setupIPCHandlers() {
    // Handle console messages from renderer
    ipcMain.on('console-message', (event, message) => {
      this.addLog(message);
    });

    // Handle console clear from renderer
    ipcMain.on('console-cleared', (event) => {
      this.consoleLogs = [];
      this.notifySubscribers({ type: 'clear' });
    });

    // Handle execution result
    ipcMain.on('console-execute-result', (event, result) => {
      // Result is handled by the promise in executeInConsole
    });
  }

  /**
   * Add a console log entry
   * @param {Object} logEntry - Console log entry
   */
  addLog(logEntry) {
    const entry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: logEntry.type || CONSOLE_TYPES.LOG,
      message: logEntry.message,
      source: logEntry.source || 'unknown',
      line: logEntry.line || null,
      column: logEntry.column || null,
      timestamp: logEntry.timestamp || Date.now(),
      stackTrace: logEntry.stackTrace || null,
      args: logEntry.args || []
    };

    this.consoleLogs.push(entry);

    // Trim logs if exceeding max
    if (this.consoleLogs.length > this.maxLogs) {
      this.consoleLogs = this.consoleLogs.slice(-this.maxLogs);
    }

    // Notify subscribers
    this.notifySubscribers({ type: 'new', log: entry });

    return entry;
  }

  /**
   * Get all console logs
   * @param {Object} options - Filter options
   * @returns {Object} Result with logs
   */
  getConsoleLogs(options = {}) {
    const { types, limit, offset, since, search } = options;

    let logs = [...this.consoleLogs];

    // Filter by types
    if (types && Array.isArray(types) && types.length > 0) {
      logs = logs.filter(log => types.includes(log.type));
    }

    // Filter by timestamp
    if (since) {
      logs = logs.filter(log => log.timestamp >= since);
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log =>
        (log.message && log.message.toLowerCase().includes(searchLower)) ||
        (log.source && log.source.toLowerCase().includes(searchLower))
      );
    }

    // Apply offset
    if (offset && offset > 0) {
      logs = logs.slice(offset);
    }

    // Apply limit
    if (limit && limit > 0) {
      logs = logs.slice(0, limit);
    }

    return {
      success: true,
      logs,
      total: this.consoleLogs.length,
      filtered: logs.length
    };
  }

  /**
   * Clear all console logs
   * @returns {Object} Result
   */
  clearConsoleLogs() {
    const count = this.consoleLogs.length;
    this.consoleLogs = [];

    // Notify subscribers
    this.notifySubscribers({ type: 'clear' });

    return {
      success: true,
      cleared: count
    };
  }

  /**
   * Execute code in the console context
   * @param {string} code - JavaScript code to execute
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   */
  executeInConsole(code, options = {}) {
    const { timeout = 5000, returnValue = true } = options;

    return new Promise((resolve, reject) => {
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Set timeout
      const timeoutId = setTimeout(() => {
        ipcMain.removeAllListeners(`console-execute-result-${executionId}`);
        resolve({
          success: false,
          error: 'Execution timeout',
          executionId
        });
      }, timeout);

      // Listen for result
      ipcMain.once(`console-execute-result-${executionId}`, (event, result) => {
        clearTimeout(timeoutId);
        resolve({
          success: true,
          result: result.value,
          type: result.type,
          executionId,
          duration: result.duration
        });
      });

      // Send execution request to renderer
      this.mainWindow.webContents.send('execute-in-console', {
        code,
        executionId,
        returnValue
      });
    });
  }

  /**
   * Subscribe to console events
   * @param {Function} callback - Callback function for events
   * @returns {string} Subscription ID
   */
  subscribeToConsole(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const subscription = {
      id: subscriptionId,
      callback
    };

    this.subscribers.add(subscription);

    return subscriptionId;
  }

  /**
   * Unsubscribe from console events
   * @param {string} subscriptionId - Subscription ID
   * @returns {boolean} Success
   */
  unsubscribeFromConsole(subscriptionId) {
    for (const sub of this.subscribers) {
      if (sub.id === subscriptionId) {
        this.subscribers.delete(sub);
        return true;
      }
    }
    return false;
  }

  /**
   * Notify all subscribers of an event
   * @param {Object} event - Event data
   */
  notifySubscribers(event) {
    this.subscribers.forEach(sub => {
      try {
        sub.callback(event);
      } catch (error) {
        console.error(`[ConsoleManager] Error in subscriber ${sub.id}:`, error);
      }
    });
  }

  /**
   * Get the console capture script to inject into pages
   * @returns {string} JavaScript code
   */
  getConsoleCaptureScript() {
    return `
      (function() {
        if (window.__bassetConsoleCaptured) return;
        window.__bassetConsoleCaptured = true;

        const originalConsole = {
          log: console.log,
          warn: console.warn,
          error: console.error,
          info: console.info,
          debug: console.debug
        };

        function formatArg(arg) {
          if (arg === null) return 'null';
          if (arg === undefined) return 'undefined';
          if (typeof arg === 'function') return arg.toString();
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }

        function captureConsole(type, args) {
          const formattedArgs = Array.from(args).map(formatArg);
          const message = formattedArgs.join(' ');

          // Get stack trace for source info
          const stack = new Error().stack;
          const stackLines = stack.split('\\n');
          let source = '';
          let line = null;
          let column = null;

          // Find the first non-console line in the stack
          for (let i = 2; i < stackLines.length; i++) {
            const match = stackLines[i].match(/at\\s+(?:.*\\s+)?(?:\\()?(.+?):(\\d+):(\\d+)(?:\\))?$/);
            if (match) {
              source = match[1];
              line = parseInt(match[2], 10);
              column = parseInt(match[3], 10);
              break;
            }
          }

          // Send to main process via IPC
          if (window.electronAPI && window.electronAPI.sendConsoleMessage) {
            window.electronAPI.sendConsoleMessage({
              type,
              message,
              source,
              line,
              column,
              timestamp: Date.now(),
              args: formattedArgs,
              stackTrace: stack
            });
          }
        }

        // Override console methods
        console.log = function(...args) {
          captureConsole('log', args);
          originalConsole.log.apply(console, args);
        };

        console.warn = function(...args) {
          captureConsole('warn', args);
          originalConsole.warn.apply(console, args);
        };

        console.error = function(...args) {
          captureConsole('error', args);
          originalConsole.error.apply(console, args);
        };

        console.info = function(...args) {
          captureConsole('info', args);
          originalConsole.info.apply(console, args);
        };

        console.debug = function(...args) {
          captureConsole('debug', args);
          originalConsole.debug.apply(console, args);
        };

        // Capture unhandled errors
        window.addEventListener('error', function(event) {
          if (window.electronAPI && window.electronAPI.sendConsoleMessage) {
            window.electronAPI.sendConsoleMessage({
              type: 'error',
              message: event.message || 'Unknown error',
              source: event.filename || 'unknown',
              line: event.lineno,
              column: event.colno,
              timestamp: Date.now(),
              stackTrace: event.error ? event.error.stack : null
            });
          }
        });

        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', function(event) {
          if (window.electronAPI && window.electronAPI.sendConsoleMessage) {
            window.electronAPI.sendConsoleMessage({
              type: 'error',
              message: 'Unhandled Promise Rejection: ' + (event.reason ? event.reason.message || String(event.reason) : 'Unknown'),
              source: 'Promise',
              line: null,
              column: null,
              timestamp: Date.now(),
              stackTrace: event.reason && event.reason.stack ? event.reason.stack : null
            });
          }
        });

        console.log('[Basset Hound] Console capture initialized');
      })();
    `;
  }

  /**
   * Get the console execution script for running code in page context
   * @param {string} code - Code to execute
   * @param {string} executionId - Execution ID
   * @returns {string} JavaScript code
   */
  getConsoleExecutionScript(code, executionId) {
    return `
      (function() {
        const startTime = performance.now();
        let result, resultType;

        try {
          result = eval(${JSON.stringify(code)});

          // Determine type
          if (result === null) {
            resultType = 'null';
          } else if (result === undefined) {
            resultType = 'undefined';
          } else if (Array.isArray(result)) {
            resultType = 'array';
          } else {
            resultType = typeof result;
          }

          // Serialize result
          if (typeof result === 'function') {
            result = result.toString();
          } else if (typeof result === 'object' && result !== null) {
            try {
              result = JSON.parse(JSON.stringify(result));
            } catch (e) {
              result = String(result);
            }
          }
        } catch (error) {
          result = { error: error.message, stack: error.stack };
          resultType = 'error';
        }

        const duration = performance.now() - startTime;

        if (window.electronAPI && window.electronAPI.sendConsoleExecuteResult) {
          window.electronAPI.sendConsoleExecuteResult({
            executionId: ${JSON.stringify(executionId)},
            value: result,
            type: resultType,
            duration
          });
        }

        return { value: result, type: resultType, duration };
      })();
    `;
  }

  /**
   * Start capturing console logs
   * @returns {Object} Result
   */
  startCapture() {
    if (this.isCapturing) {
      return { success: true, message: 'Already capturing' };
    }

    this.isCapturing = true;

    // Inject capture script into current page
    this.mainWindow.webContents.send('inject-console-capture');

    return { success: true, message: 'Console capture started' };
  }

  /**
   * Stop capturing console logs
   * @returns {Object} Result
   */
  stopCapture() {
    this.isCapturing = false;
    return { success: true, message: 'Console capture stopped' };
  }

  /**
   * Get capture status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      isCapturing: this.isCapturing,
      logCount: this.consoleLogs.length,
      maxLogs: this.maxLogs,
      subscriberCount: this.subscribers.size
    };
  }

  /**
   * Set maximum logs to store
   * @param {number} max - Maximum logs
   * @returns {Object} Result
   */
  setMaxLogs(max) {
    if (typeof max !== 'number' || max < 1) {
      return { success: false, error: 'Max must be a positive number' };
    }

    this.maxLogs = max;

    // Trim if needed
    if (this.consoleLogs.length > this.maxLogs) {
      this.consoleLogs = this.consoleLogs.slice(-this.maxLogs);
    }

    return { success: true, maxLogs: this.maxLogs };
  }

  /**
   * Get logs by type
   * @param {string} type - Console type
   * @returns {Object} Result
   */
  getLogsByType(type) {
    if (!Object.values(CONSOLE_TYPES).includes(type)) {
      return { success: false, error: `Invalid type: ${type}` };
    }

    const logs = this.consoleLogs.filter(log => log.type === type);
    return { success: true, logs, count: logs.length };
  }

  /**
   * Get error logs only
   * @returns {Object} Result
   */
  getErrors() {
    return this.getLogsByType(CONSOLE_TYPES.ERROR);
  }

  /**
   * Get warning logs only
   * @returns {Object} Result
   */
  getWarnings() {
    return this.getLogsByType(CONSOLE_TYPES.WARN);
  }

  /**
   * Export logs to JSON
   * @returns {Object} Exported data
   */
  exportLogs() {
    return {
      success: true,
      data: {
        exportedAt: Date.now(),
        totalLogs: this.consoleLogs.length,
        logs: this.consoleLogs
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.subscribers.clear();
    this.consoleLogs = [];
    this.isCapturing = false;

    // Remove IPC handlers
    ipcMain.removeAllListeners('console-message');
    ipcMain.removeAllListeners('console-cleared');
    ipcMain.removeAllListeners('console-execute-result');
  }
}

module.exports = {
  ConsoleManager,
  CONSOLE_TYPES
};

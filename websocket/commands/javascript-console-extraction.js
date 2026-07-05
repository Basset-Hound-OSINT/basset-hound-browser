/**
 * JavaScript & Console Extraction Commands
 *
 * Implements 10 WebSocket commands for comprehensive JavaScript and console output extraction:
 * 1. export_scripts_all - All script tags and inline scripts
 * 2. export_scripts_sources - All external script sources
 * 3. export_console_logs - All console output (log, error, warn, info, debug)
 * 4. export_globals - All window/global variables
 * 5. export_localstorage - All localStorage items
 * 6. export_sessionstorage - All sessionStorage items
 * 7. export_cookies - All cookies with metadata
 * 8. export_performance_timeline - Performance metrics and timeline
 * 9. export_errors - All JavaScript errors encountered
 * 10. export_network_from_js - Requests made by JavaScript (fetch/XHR)
 *
 * @module websocket/commands/javascript-console-extraction
 */

/**
 * Register all JavaScript & Console extraction commands
 *
 * @param {Object} commandHandlers - Command handler registry
 * @param {Object} options - Options containing managers
 * @param {Object} options.consoleManager - Console manager instance
 * @param {Object} options.devToolsManager - DevTools manager instance
 * @param {Object} options.storageManager - Storage manager instance
 * @param {Object} options.logger - Logger instance
 * @returns {void}
 */
function registerJavaScriptConsoleExtractionCommands(commandHandlers, options = {}) {
  const { consoleManager, devToolsManager, storageManager, logger = console } = options;

  /**
   * Command 1: export_scripts_all
   * Extracts all script tags and inline scripts from the current page
   *
   * Response includes:
   * - inline: Array of inline script objects { index, content, async, defer, type }
   * - external: Array of external script objects { index, src, async, defer, type }
   * - count: { inline, external, total }
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_scripts_all = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const scripts = Array.from(document.querySelectorAll('script'));
            const inline = [];
            const external = [];

            scripts.forEach((script, index) => {
              const obj = {
                index,
                async: script.async,
                defer: script.defer,
                type: script.type || 'application/javascript'
              };

              if (script.src) {
                external.push({
                  ...obj,
                  src: script.src,
                  crossOrigin: script.crossOrigin
                });
              } else if (script.textContent) {
                inline.push({
                  ...obj,
                  content: script.textContent,
                  length: script.textContent.length
                });
              }
            });

            return {
              inline,
              external,
              count: {
                inline: inline.length,
                external: external.length,
                total: scripts.length
              }
            };
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract scripts' };
      }

      return {
        success: true,
        scripts: result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_scripts_all]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 2: export_scripts_sources
   * Extracts only external script sources with full metadata
   *
   * Response includes:
   * - sources: Array of { src, async, defer, type, crossOrigin, integrity, nonce }
   * - count: Number of external scripts
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_scripts_sources = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            const sources = scripts.map((script, index) => ({
              index,
              src: script.src,
              async: script.async,
              defer: script.defer,
              type: script.type || 'application/javascript',
              crossOrigin: script.crossOrigin || null,
              integrity: script.integrity || null,
              nonce: script.nonce || null,
              noModule: script.noModule || false
            }));

            return {
              sources,
              count: sources.length,
              domains: [...new Set(sources.map(s => {
                try {
                  return new URL(s.src).hostname;
                } catch (e) {
                  return 'unknown';
                }
              }))]
            };
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract script sources' };
      }

      return {
        success: true,
        ...result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_scripts_sources]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 3: export_console_logs
   * Extracts all console output (logs, errors, warnings, info, debug)
   *
   * Response includes:
   * - logs: Array of { type, message, args, stack, timestamp, source }
   * - summary: { total, byType: { log, error, warn, info, debug } }
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_console_logs = async (params) => {
    if (!consoleManager) {
      return { success: false, error: 'Console manager not available' };
    }

    try {
      const consoleLogs = await consoleManager.getConsoleLogs(params);

      if (!consoleLogs.success) {
        return consoleLogs;
      }

      const logs = consoleLogs.logs || [];
      const summary = {
        total: logs.length,
        byType: {
          log: logs.filter(l => l.type === 'log').length,
          error: logs.filter(l => l.type === 'error').length,
          warn: logs.filter(l => l.type === 'warn').length,
          info: logs.filter(l => l.type === 'info').length,
          debug: logs.filter(l => l.type === 'debug').length
        }
      };

      return {
        success: true,
        logs,
        summary,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_console_logs]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 4: export_globals
   * Extracts all window/global variables
   *
   * Response includes:
   * - globals: Object with enumerable window properties
   * - count: Number of global variables
   * - categories: Categorized globals { window, document, navigator, etc. }
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_globals = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    const { categorize = true } = params || {};

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const globals = {};
            const categories = {
              window: [],
              document: [],
              navigator: [],
              console: [],
              performance: [],
              crypto: [],
              storage: [],
              location: [],
              history: [],
              custom: []
            };

            for (const key in window) {
              try {
                const value = window[key];
                const type = typeof value;

                // Serialize based on type
                if (type === 'string' || type === 'number' || type === 'boolean') {
                  globals[key] = { type, value };
                } else if (type === 'function') {
                  globals[key] = { type: 'function', name: value.name || 'anonymous' };
                } else if (value === null) {
                  globals[key] = { type: 'null', value: null };
                } else if (type === 'object') {
                  if (value instanceof Date) {
                    globals[key] = { type: 'Date', value: value.toISOString() };
                  } else if (Array.isArray(value)) {
                    globals[key] = { type: 'Array', length: value.length };
                  } else {
                    globals[key] = { type: 'Object', keys: Object.keys(value).slice(0, 5) };
                  }
                } else {
                  globals[key] = { type };
                }

                // Categorize
                if (key === 'window' || key.startsWith('window')) {
                  categories.window.push(key);
                } else if (key === 'document' || key.startsWith('document')) {
                  categories.document.push(key);
                } else if (key === 'navigator' || key.startsWith('navigator')) {
                  categories.navigator.push(key);
                } else if (key === 'console') {
                  categories.console.push(key);
                } else if (key === 'performance' || key.startsWith('performance')) {
                  categories.performance.push(key);
                } else if (key === 'crypto' || key.startsWith('crypto')) {
                  categories.crypto.push(key);
                } else if (key.includes('storage') || key.includes('Store')) {
                  categories.storage.push(key);
                } else if (key === 'location' || key === 'history') {
                  categories.location.push(key);
                } else {
                  categories.custom.push(key);
                }
              } catch (e) {
                globals[key] = { type: 'error', error: e.message };
              }
            }

            return {
              globals,
              count: Object.keys(globals).length,
              categories: ${categorize ? 'categories' : 'undefined'}
            };
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract globals' };
      }

      return {
        success: true,
        ...result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_globals]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 5: export_localstorage
   * Extracts all localStorage items for the current origin
   *
   * Response includes:
   * - items: Object mapping key -> value
   * - count: Number of items
   * - totalSize: Approximate size in bytes
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_localstorage = async (params) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }

    try {
      const origin = params?.origin || new URL(global.location || 'http://localhost').origin;
      const result = await storageManager.getLocalStorage(origin);

      if (!result.success) {
        return result;
      }

      const items = result.data || {};
      const count = Object.keys(items).length;
      const totalSize = JSON.stringify(items).length;

      return {
        success: true,
        items,
        count,
        totalSize,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_localstorage]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 6: export_sessionstorage
   * Extracts all sessionStorage items for the current origin
   *
   * Response includes:
   * - items: Object mapping key -> value
   * - count: Number of items
   * - totalSize: Approximate size in bytes
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_sessionstorage = async (params) => {
    if (!storageManager) {
      return { success: false, error: 'Storage manager not available' };
    }

    try {
      const origin = params?.origin || new URL(global.location || 'http://localhost').origin;
      const result = await storageManager.getSessionStorage(origin);

      if (!result.success) {
        return result;
      }

      const items = result.data || {};
      const count = Object.keys(items).length;
      const totalSize = JSON.stringify(items).length;

      return {
        success: true,
        items,
        count,
        totalSize,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_sessionstorage]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 7: export_cookies
   * Extracts all cookies with metadata
   *
   * Response includes:
   * - cookies: Array of { name, value, domain, path, secure, httpOnly, sameSite, expires }
   * - count: Number of cookies
   * - totalSize: Approximate size in bytes
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_cookies = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            // Parse document.cookie
            const cookies = document.cookie.split(';').map(c => {
              const [name, value] = c.trim().split('=');
              return { name, value, fromDocument: true };
            }).filter(c => c.name);

            return {
              cookies,
              count: cookies.length,
              totalSize: document.cookie.length
            };
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract cookies' };
      }

      return {
        success: true,
        ...result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_cookies]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 8: export_performance_timeline
   * Extracts performance metrics and navigation timeline
   *
   * Response includes:
   * - navigation: Timing data { responseStart, domLoading, domComplete, loadEventEnd }
   * - resources: Array of { name, type, duration, transferSize, decodedBodySize }
   * - marks: Array of custom performance marks
   * - measures: Array of custom performance measures
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_performance_timeline = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const perfData = {
              navigation: {},
              resources: [],
              marks: [],
              measures: [],
              memory: null
            };

            // Navigation timing
            if (window.performance && window.performance.timing) {
              const timing = window.performance.timing;
              perfData.navigation = {
                navigationStart: timing.navigationStart,
                responseStart: timing.responseStart,
                domLoading: timing.domLoading,
                domInteractive: timing.domInteractive,
                domComplete: timing.domComplete,
                loadEventStart: timing.loadEventStart,
                loadEventEnd: timing.loadEventEnd
              };
            }

            // Resource timing
            if (window.performance && window.performance.getEntriesByType) {
              perfData.resources = window.performance.getEntriesByType('resource').map(r => ({
                name: r.name,
                type: r.initiatorType,
                duration: r.duration,
                transferSize: r.transferSize || 0,
                decodedBodySize: r.decodedBodySize || 0,
                startTime: r.startTime,
                responseEnd: r.responseEnd
              }));

              perfData.marks = window.performance.getEntriesByType('mark').map(m => ({
                name: m.name,
                startTime: m.startTime
              }));

              perfData.measures = window.performance.getEntriesByType('measure').map(m => ({
                name: m.name,
                duration: m.duration,
                startTime: m.startTime
              }));
            }

            // Memory info (Chrome only)
            if (window.performance && window.performance.memory) {
              perfData.memory = {
                jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
                totalJSHeapSize: window.performance.memory.totalJSHeapSize,
                usedJSHeapSize: window.performance.memory.usedJSHeapSize
              };
            }

            return perfData;
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract performance timeline' };
      }

      return {
        success: true,
        performance: result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_performance_timeline]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 9: export_errors
   * Extracts all JavaScript errors encountered
   *
   * Response includes:
   * - errors: Array of { message, source, lineno, colno, stack, type, timestamp }
   * - summary: { total, byType: { error, warning, uncaughtError } }
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_errors = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      // Collect errors from DevTools
      const errors = [];

      // Retrieve logs from console (which captures errors)
      if (consoleManager) {
        const consoleLogs = await consoleManager.getConsoleLogs({ type: 'error' });
        if (consoleLogs.success && consoleLogs.logs) {
          errors.push(...consoleLogs.logs.filter(l => l.type === 'error'));
        }
      }

      // Also get runtime exceptions
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const errors = [];
            window._capturedErrors = window._capturedErrors || [];
            errors.push(...window._capturedErrors);
            return errors;
          })()
        `
      });

      if (result.value) {
        errors.push(...result.value);
      }

      const summary = {
        total: errors.length,
        byType: {
          error: errors.filter(e => e.type === 'error').length,
          warning: errors.filter(e => e.type === 'warning').length,
          uncaughtError: errors.filter(e => e.type === 'uncaughtError').length
        }
      };

      return {
        success: true,
        errors: errors.slice(0, 1000), // Limit to 1000 errors
        summary,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_errors]', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Command 10: export_network_from_js
   * Extracts requests made by JavaScript (fetch/XHR)
   *
   * Response includes:
   * - requests: Array of { method, url, status, type, size, duration, timestamp }
   * - summary: { total, byMethod, byStatus, totalSize }
   * - timestamp: Extraction timestamp
   */
  commandHandlers.export_network_from_js = async (params) => {
    if (!devToolsManager) {
      return { success: false, error: 'DevTools manager not available' };
    }

    try {
      const result = await devToolsManager.runtime.evaluate({
        expression: `
          (function() {
            const requests = (window._capturedNetworkRequests || []).slice(0, 500);
            const summary = {
              total: requests.length,
              byMethod: {},
              byStatus: {},
              totalSize: 0
            };

            requests.forEach(req => {
              summary.byMethod[req.method] = (summary.byMethod[req.method] || 0) + 1;
              summary.byStatus[req.status] = (summary.byStatus[req.status] || 0) + 1;
              summary.totalSize += req.size || 0;
            });

            return {
              requests,
              summary
            };
          })()
        `
      });

      if (!result.value) {
        return { success: false, error: 'Failed to extract network requests' };
      }

      return {
        success: true,
        ...result.value,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[export_network_from_js]', error);
      return { success: false, error: error.message };
    }
  };

  logger.info('[JavaScriptConsoleExtraction] Registered 10 commands');
}

module.exports = {
  registerJavaScriptConsoleExtractionCommands
};

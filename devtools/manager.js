/**
 * DevTools Manager for Basset Hound Browser
 * Manages DevTools window, network logs, and performance metrics
 */

const { ipcMain, session } = require('electron');

/**
 * Network request states
 */
const REQUEST_STATES = {
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
  BLOCKED: 'blocked'
};

/**
 * DevToolsManager class
 * Manages DevTools operations, network logging, and performance metrics
 */
class DevToolsManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.isDevToolsOpen = false;
    this.networkLogs = [];
    this.maxNetworkLogs = 5000;
    this.isNetworkLogging = false;
    this.performanceMetrics = null;
    this.coverageData = null;
    this.requestIdCounter = 0;
    this.pendingRequests = new Map();

    this.setupNetworkInterceptor();
    this.setupIPCHandlers();
  }

  /**
   * Setup IPC handlers for DevTools events
   */
  setupIPCHandlers() {
    // Handle performance metrics from renderer
    ipcMain.on('performance-metrics', (event, metrics) => {
      this.performanceMetrics = metrics;
    });

    // Handle coverage data from renderer
    ipcMain.on('coverage-data', (event, data) => {
      this.coverageData = data;
    });

    // Handle network log from webview
    ipcMain.on('network-request-complete', (event, data) => {
      this.addNetworkLog(data);
    });
  }

  /**
   * Setup network request interceptor for logging
   */
  setupNetworkInterceptor() {
    const ses = session.defaultSession;

    // Intercept requests to log them
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      if (this.isNetworkLogging) {
        const requestId = `req-${++this.requestIdCounter}`;

        const entry = {
          id: requestId,
          startTime: Date.now(),
          request: {
            method: details.method,
            url: details.url,
            resourceType: details.resourceType,
            referrer: details.referrer || null,
            timestamp: Date.now()
          },
          response: null,
          state: REQUEST_STATES.PENDING
        };

        this.pendingRequests.set(details.id, entry);
      }

      callback({ cancel: false });
    });

    // Capture response headers
    ses.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
      if (this.isNetworkLogging && this.pendingRequests.has(details.id)) {
        const entry = this.pendingRequests.get(details.id);
        entry.response = {
          statusCode: details.statusCode,
          statusLine: details.statusLine,
          headers: details.responseHeaders,
          timestamp: Date.now()
        };
      }

      callback({});
    });

    // Capture completed requests
    ses.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      if (this.isNetworkLogging && this.pendingRequests.has(details.id)) {
        const entry = this.pendingRequests.get(details.id);
        entry.endTime = Date.now();
        entry.state = REQUEST_STATES.COMPLETE;
        entry.timing = {
          total: entry.endTime - entry.startTime,
          fromCache: details.fromCache || false
        };

        this.addNetworkLog(entry);
        this.pendingRequests.delete(details.id);
      }
    });

    // Capture failed requests
    ses.webRequest.onErrorOccurred({ urls: ['*://*/*'] }, (details) => {
      if (this.isNetworkLogging && this.pendingRequests.has(details.id)) {
        const entry = this.pendingRequests.get(details.id);
        entry.endTime = Date.now();
        entry.state = REQUEST_STATES.FAILED;
        entry.error = details.error;
        entry.timing = {
          total: entry.endTime - entry.startTime
        };

        this.addNetworkLog(entry);
        this.pendingRequests.delete(details.id);
      }
    });
  }

  /**
   * Add a network log entry
   * @param {Object} entry - Network log entry
   */
  addNetworkLog(entry) {
    this.networkLogs.push(entry);

    // Trim logs if exceeding max
    if (this.networkLogs.length > this.maxNetworkLogs) {
      this.networkLogs = this.networkLogs.slice(-this.maxNetworkLogs);
    }
  }

  /**
   * Open DevTools window
   * @param {Object} options - Options for DevTools
   * @returns {Object} Result
   */
  openDevTools(options = {}) {
    const { mode = 'right', activate = true } = options;

    if (!this.mainWindow) {
      return { success: false, error: 'No main window available' };
    }

    // Send message to renderer to open DevTools on webview
    this.mainWindow.webContents.send('open-devtools', { mode, activate });

    this.isDevToolsOpen = true;

    return {
      success: true,
      message: 'DevTools opened',
      mode
    };
  }

  /**
   * Close DevTools window
   * @returns {Object} Result
   */
  closeDevTools() {
    if (!this.mainWindow) {
      return { success: false, error: 'No main window available' };
    }

    this.mainWindow.webContents.send('close-devtools');
    this.isDevToolsOpen = false;

    return {
      success: true,
      message: 'DevTools closed'
    };
  }

  /**
   * Toggle DevTools window
   * @param {Object} options - Options for DevTools
   * @returns {Object} Result
   */
  toggleDevTools(options = {}) {
    if (this.isDevToolsOpen) {
      return this.closeDevTools();
    } else {
      return this.openDevTools(options);
    }
  }

  /**
   * Check if DevTools is open
   * @returns {Object} Result
   */
  getDevToolsState() {
    return {
      success: true,
      isOpen: this.isDevToolsOpen
    };
  }

  /**
   * Start network logging
   * @returns {Object} Result
   */
  startNetworkLogging() {
    this.isNetworkLogging = true;
    return {
      success: true,
      message: 'Network logging started'
    };
  }

  /**
   * Stop network logging
   * @returns {Object} Result
   */
  stopNetworkLogging() {
    this.isNetworkLogging = false;
    return {
      success: true,
      message: 'Network logging stopped'
    };
  }

  /**
   * Get network logs in HAR format
   * @param {Object} options - Filter options
   * @returns {Object} HAR formatted network logs
   */
  getNetworkLogs(options = {}) {
    const { limit, offset, resourceType, status, search, format = 'simple' } = options;

    let logs = [...this.networkLogs];

    // Filter by resource type
    if (resourceType) {
      logs = logs.filter(log => log.request && log.request.resourceType === resourceType);
    }

    // Filter by status code
    if (status) {
      logs = logs.filter(log => log.response && log.response.statusCode === status);
    }

    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      logs = logs.filter(log =>
        log.request && log.request.url.toLowerCase().includes(searchLower)
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

    // Return in HAR format if requested
    if (format === 'har') {
      return {
        success: true,
        har: this.convertToHAR(logs),
        total: this.networkLogs.length,
        filtered: logs.length
      };
    }

    return {
      success: true,
      logs,
      total: this.networkLogs.length,
      filtered: logs.length,
      isLogging: this.isNetworkLogging
    };
  }

  /**
   * Convert network logs to HAR format
   * @param {Array} logs - Network logs
   * @returns {Object} HAR formatted data
   */
  convertToHAR(logs) {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'Basset Hound Browser',
          version: '1.0.0'
        },
        entries: logs.map(log => ({
          startedDateTime: new Date(log.startTime).toISOString(),
          time: log.timing ? log.timing.total : 0,
          request: {
            method: log.request.method,
            url: log.request.url,
            httpVersion: 'HTTP/1.1',
            headers: [],
            queryString: this.parseQueryString(log.request.url),
            cookies: [],
            headersSize: -1,
            bodySize: -1
          },
          response: log.response ? {
            status: log.response.statusCode,
            statusText: log.response.statusLine || '',
            httpVersion: 'HTTP/1.1',
            headers: this.formatHeaders(log.response.headers),
            cookies: [],
            content: {
              size: -1,
              mimeType: this.getMimeType(log.response.headers)
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1
          } : null,
          cache: {},
          timings: {
            send: 0,
            wait: log.timing ? log.timing.total : 0,
            receive: 0
          },
          serverIPAddress: '',
          _resourceType: log.request.resourceType
        }))
      }
    };
  }

  /**
   * Parse query string from URL
   * @param {string} url - URL
   * @returns {Array} Query parameters
   */
  parseQueryString(url) {
    try {
      const urlObj = new URL(url);
      const params = [];
      urlObj.searchParams.forEach((value, name) => {
        params.push({ name, value });
      });
      return params;
    } catch (e) {
      return [];
    }
  }

  /**
   * Format headers for HAR
   * @param {Object} headers - Response headers
   * @returns {Array} Formatted headers
   */
  formatHeaders(headers) {
    if (!headers) return [];

    const formatted = [];
    for (const [name, values] of Object.entries(headers)) {
      if (Array.isArray(values)) {
        values.forEach(value => {
          formatted.push({ name, value });
        });
      } else {
        formatted.push({ name, value: String(values) });
      }
    }
    return formatted;
  }

  /**
   * Get MIME type from headers
   * @param {Object} headers - Response headers
   * @returns {string} MIME type
   */
  getMimeType(headers) {
    if (!headers) return 'text/plain';

    const contentType = headers['content-type'] || headers['Content-Type'];
    if (contentType) {
      const value = Array.isArray(contentType) ? contentType[0] : contentType;
      return value.split(';')[0].trim();
    }
    return 'text/plain';
  }

  /**
   * Clear network logs
   * @returns {Object} Result
   */
  clearNetworkLogs() {
    const count = this.networkLogs.length;
    this.networkLogs = [];
    this.pendingRequests.clear();

    return {
      success: true,
      cleared: count
    };
  }

  /**
   * Get performance metrics
   * @returns {Promise<Object>} Performance metrics
   */
  getPerformanceMetrics() {
    return new Promise((resolve) => {
      // Request metrics from renderer
      this.mainWindow.webContents.send('get-performance-metrics');

      const timeout = setTimeout(() => {
        resolve({
          success: true,
          metrics: this.performanceMetrics || null,
          cached: true
        });
      }, 5000);

      ipcMain.once('performance-metrics-response', (event, metrics) => {
        clearTimeout(timeout);
        this.performanceMetrics = metrics;
        resolve({
          success: true,
          metrics,
          cached: false
        });
      });
    });
  }

  /**
   * Get code coverage data
   * @returns {Promise<Object>} Coverage data
   */
  getCoverage() {
    return new Promise((resolve) => {
      // Request coverage from renderer
      this.mainWindow.webContents.send('get-coverage-data');

      const timeout = setTimeout(() => {
        resolve({
          success: true,
          coverage: this.coverageData || null,
          cached: true
        });
      }, 5000);

      ipcMain.once('coverage-data-response', (event, data) => {
        clearTimeout(timeout);
        this.coverageData = data;
        resolve({
          success: true,
          coverage: data,
          cached: false
        });
      });
    });
  }

  /**
   * Get performance timing script to inject into pages
   * @returns {string} JavaScript code
   */
  getPerformanceTimingScript() {
    return `
      (function() {
        const getMetrics = () => {
          const timing = performance.timing;
          const navigation = performance.getEntriesByType('navigation')[0];

          return {
            // Navigation timing
            navigationStart: timing.navigationStart,
            domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
            load: timing.loadEventEnd - timing.navigationStart,
            firstPaint: 0,
            firstContentfulPaint: 0,

            // Resource timing
            resources: performance.getEntriesByType('resource').map(r => ({
              name: r.name,
              type: r.initiatorType,
              duration: r.duration,
              size: r.transferSize || 0,
              startTime: r.startTime
            })),

            // Navigation
            redirectTime: timing.redirectEnd - timing.redirectStart,
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            tcpConnect: timing.connectEnd - timing.connectStart,
            sslConnect: timing.secureConnectionStart > 0 ?
              timing.connectEnd - timing.secureConnectionStart : 0,
            ttfb: timing.responseStart - timing.requestStart,
            responseTime: timing.responseEnd - timing.responseStart,
            domParsing: timing.domInteractive - timing.responseEnd,
            domContentLoadedTime: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
            loadEventTime: timing.loadEventEnd - timing.loadEventStart,

            // Memory (if available)
            memory: performance.memory ? {
              usedJSHeapSize: performance.memory.usedJSHeapSize,
              totalJSHeapSize: performance.memory.totalJSHeapSize,
              jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
            } : null,

            // Long tasks
            longTasks: [],

            timestamp: Date.now()
          };
        };

        // Get paint timing
        const paintEntries = performance.getEntriesByType('paint');
        const metrics = getMetrics();

        paintEntries.forEach(entry => {
          if (entry.name === 'first-paint') {
            metrics.firstPaint = entry.startTime;
          } else if (entry.name === 'first-contentful-paint') {
            metrics.firstContentfulPaint = entry.startTime;
          }
        });

        return metrics;
      })();
    `;
  }

  /**
   * Get coverage script to inject into pages
   * @returns {string} JavaScript code
   */
  getCoverageScript() {
    return `
      (function() {
        const scripts = document.querySelectorAll('script');
        const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');

        return {
          scripts: Array.from(scripts).map(s => ({
            src: s.src || 'inline',
            type: s.type || 'text/javascript',
            async: s.async,
            defer: s.defer
          })),
          stylesheets: Array.from(stylesheets).map(l => ({
            href: l.href,
            media: l.media
          })),
          timestamp: Date.now()
        };
      })();
    `;
  }

  /**
   * Get network statistics
   * @returns {Object} Network statistics
   */
  getNetworkStats() {
    const stats = {
      total: this.networkLogs.length,
      byType: {},
      byStatus: {},
      totalSize: 0,
      totalTime: 0,
      failed: 0,
      blocked: 0
    };

    this.networkLogs.forEach(log => {
      // By resource type
      const type = log.request?.resourceType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // By status
      if (log.response?.statusCode) {
        const status = log.response.statusCode;
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
      }

      // Timing
      if (log.timing?.total) {
        stats.totalTime += log.timing.total;
      }

      // State
      if (log.state === REQUEST_STATES.FAILED) {
        stats.failed++;
      } else if (log.state === REQUEST_STATES.BLOCKED) {
        stats.blocked++;
      }
    });

    stats.averageTime = stats.total > 0 ? stats.totalTime / stats.total : 0;

    return {
      success: true,
      stats
    };
  }

  /**
   * Export network logs
   * @param {string} format - Export format ('json' or 'har')
   * @returns {Object} Exported data
   */
  exportNetworkLogs(format = 'json') {
    if (format === 'har') {
      return {
        success: true,
        data: this.convertToHAR(this.networkLogs)
      };
    }

    return {
      success: true,
      data: {
        exportedAt: Date.now(),
        totalLogs: this.networkLogs.length,
        logs: this.networkLogs
      }
    };
  }

  /**
   * Get DevTools status
   * @returns {Object} Status
   */
  getStatus() {
    return {
      isDevToolsOpen: this.isDevToolsOpen,
      isNetworkLogging: this.isNetworkLogging,
      networkLogCount: this.networkLogs.length,
      pendingRequests: this.pendingRequests.size,
      hasPerformanceMetrics: this.performanceMetrics !== null,
      hasCoverageData: this.coverageData !== null
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.networkLogs = [];
    this.pendingRequests.clear();
    this.performanceMetrics = null;
    this.coverageData = null;
    this.isDevToolsOpen = false;
    this.isNetworkLogging = false;

    // Remove IPC handlers
    ipcMain.removeAllListeners('performance-metrics');
    ipcMain.removeAllListeners('coverage-data');
    ipcMain.removeAllListeners('network-request-complete');
    ipcMain.removeAllListeners('performance-metrics-response');
    ipcMain.removeAllListeners('coverage-data-response');
  }
}

module.exports = {
  DevToolsManager,
  REQUEST_STATES
};

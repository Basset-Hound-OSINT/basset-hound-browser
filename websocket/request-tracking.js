/**
 * Request Tracking and Error Logging Manager
 * Issue #5: No error logging
 * Issue #6: No request ID tracking
 * - Adds comprehensive error logging
 * - Request ID tracking for all operations
 * - Stack traces in debug mode
 */

const crypto = require('crypto');
const { EventEmitter } = require('events');

class RequestTrackingManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.requestMap = new Map(); // requestId -> request info
    this.errorLog = []; // All errors
    this.requestLog = []; // All requests
    this.maxLogSize = options.maxLogSize || 10000;
    this.debugMode = options.debugMode || process.env.DEBUG_MODE === 'true';
    this.logStackTraces = options.logStackTraces || this.debugMode;
    this.logger = options.logger || console;
    this.enablePersistence = options.enablePersistence || false;
    this.persistenceDir = options.persistenceDir || './logs';
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Start tracking a request
   * @param {string} command - Command name
   * @param {Object} data - Command data
   * @param {Object} context - Additional context (clientId, source, etc)
   * @returns {Object} Request tracker
   */
  startRequest(command, data = {}, context = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    const request = {
      requestId,
      command,
      startTime,
      endTime: null,
      duration: null,
      status: 'pending',
      dataSize: JSON.stringify(data).length,
      errors: [],
      warnings: [],
      context: {
        clientId: context.clientId || 'unknown',
        source: context.source || 'websocket',
        userId: context.userId || null,
        ip: context.ip || null,
        ...context
      }
    };

    this.requestMap.set(requestId, request);

    // Add to log (keep under limit)
    this.requestLog.push({
      ...request,
      startTime: new Date(startTime).toISOString()
    });

    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog.shift();
    }

    this.logger.debug(
      `[RequestTracking] Started request ${requestId} (${command}) from ${context.clientId || 'unknown'}`
    );

    // Emit event
    this.emit('request:start', { requestId, command, context });

    return {
      requestId,
      recordError: (error, metadata = {}) => this.recordError(requestId, error, metadata),
      recordWarning: (warning) => this.recordWarning(requestId, warning),
      complete: (status, result) => this.completeRequest(requestId, status, result),
      getStatus: () => this.getRequestStatus(requestId)
    };
  }

  /**
   * Record an error for a request
   * @param {string} requestId - Request ID
   * @param {Error} error - Error object
   * @param {Object} metadata - Additional metadata
   */
  recordError(requestId, error, metadata = {}) {
    const request = this.requestMap.get(requestId);
    if (!request) {
      this.logger.warn(`[RequestTracking] Request not found: ${requestId}`);
      return;
    }

    const errorEntry = {
      timestamp: Date.now(),
      type: error.constructor.name || 'Error',
      message: error.message,
      code: error.code || null,
      stack: this.logStackTraces ? error.stack : undefined,
      metadata
    };

    request.errors.push(errorEntry);
    request.status = 'error';

    // Add to global error log
    this.errorLog.push({
      requestId,
      command: request.command,
      ...errorEntry,
      timestamp: new Date(errorEntry.timestamp).toISOString()
    });

    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // Log based on severity
    const severity = metadata.severity || 'error';
    const logFn = severity === 'fatal' ? 'error' : severity === 'warn' ? 'warn' : 'error';

    this.logger[logFn](
      `[RequestTracking] Error in request ${requestId} (${request.command}): ${error.message}`
    );

    if (this.logStackTraces && error.stack) {
      this.logger.debug(`Stack trace:\n${error.stack}`);
    }

    // Emit event
    this.emit('error:recorded', {
      requestId,
      command: request.command,
      error: errorEntry
    });

    return errorEntry;
  }

  /**
   * Record a warning for a request
   * @param {string} requestId - Request ID
   * @param {string} warning - Warning message
   */
  recordWarning(requestId, warning) {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return;
    }

    const warningEntry = {
      timestamp: Date.now(),
      message: warning
    };

    request.warnings.push(warningEntry);

    this.logger.warn(
      `[RequestTracking] Warning in request ${requestId} (${request.command}): ${warning}`
    );

    this.emit('warning:recorded', {
      requestId,
      command: request.command,
      warning: warningEntry
    });
  }

  /**
   * Mark request as complete
   * @param {string} requestId - Request ID
   * @param {string} status - Final status (success, error, timeout)
   * @param {Object} result - Result object
   */
  completeRequest(requestId, status = 'success', result = null) {
    const request = this.requestMap.get(requestId);
    if (!request) {
      this.logger.warn(`[RequestTracking] Request not found: ${requestId}`);
      return null;
    }

    request.endTime = Date.now();
    request.duration = request.endTime - request.startTime;
    request.status = status;
    request.result = result;

    // Update log
    const logEntry = this.requestLog.find(r => r.requestId === requestId);
    if (logEntry) {
      logEntry.endTime = new Date(request.endTime).toISOString();
      logEntry.duration = request.duration;
      logEntry.status = status;
    }

    const level = status === 'success' ? 'debug' : 'info';
    this.logger[level](
      `[RequestTracking] Completed request ${requestId} (${request.command}) in ${request.duration}ms [${status}]`
    );

    // Emit event
    this.emit('request:complete', {
      requestId,
      command: request.command,
      duration: request.duration,
      status,
      errors: request.errors.length,
      warnings: request.warnings.length
    });

    return {
      requestId,
      command: request.command,
      duration: request.duration,
      status,
      errors: request.errors.length,
      warnings: request.warnings.length
    };
  }

  /**
   * Get request status
   * @param {string} requestId - Request ID
   */
  getRequestStatus(requestId) {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return null;
    }

    return {
      requestId,
      command: request.command,
      status: request.status,
      duration: request.duration,
      errors: request.errors,
      warnings: request.warnings,
      context: request.context,
      startTime: new Date(request.startTime).toISOString(),
      endTime: request.endTime ? new Date(request.endTime).toISOString() : null
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary(options = {}) {
    const limit = options.limit || 100;
    const command = options.command || null;
    const startTime = options.startTime || null;

    let errors = this.errorLog;

    if (command) {
      errors = errors.filter(e => e.command === command);
    }

    if (startTime) {
      errors = errors.filter(e => new Date(e.timestamp) >= new Date(startTime));
    }

    return {
      total: errors.length,
      byType: this._groupBy(errors, 'type'),
      recent: errors.slice(-limit)
    };
  }

  /**
   * Get request summary
   */
  getRequestSummary(options = {}) {
    const limit = options.limit || 100;
    const status = options.status || null;
    const command = options.command || null;

    let requests = this.requestLog;

    if (status) {
      requests = requests.filter(r => r.status === status);
    }

    if (command) {
      requests = requests.filter(r => r.command === command);
    }

    const totalDuration = requests.reduce((sum, r) => sum + (r.duration || 0), 0);
    const avgDuration = requests.length > 0 ? (totalDuration / requests.length).toFixed(2) : 0;

    return {
      total: requests.length,
      byStatus: this._groupBy(requests, 'status'),
      byCommand: this._groupBy(requests, 'command'),
      averageDurationMs: parseFloat(avgDuration),
      recent: requests.slice(-limit)
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const successRequests = this.requestLog.filter(r => r.status === 'success');
    const failedRequests = this.requestLog.filter(r => r.status === 'error');

    const durations = successRequests
      .filter(r => r.duration)
      .map(r => r.duration)
      .sort((a, b) => a - b);

    return {
      totalRequests: this.requestLog.length,
      successfulRequests: successRequests.length,
      failedRequests: failedRequests.length,
      successRate: this.requestLog.length > 0
        ? ((successRequests.length / this.requestLog.length) * 100).toFixed(2) + '%'
        : '0%',
      latency: {
        average: durations.length > 0 ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2) : 0,
        p50: durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0,
        p95: durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0,
        p99: durations.length > 0 ? durations[Math.floor(durations.length * 0.99)] : 0,
        min: durations.length > 0 ? durations[0] : 0,
        max: durations.length > 0 ? durations[durations.length - 1] : 0
      },
      totalErrors: this.errorLog.length
    };
  }

  /**
   * Group array by property
   * @private
   */
  _groupBy(array, property) {
    return array.reduce((groups, item) => {
      const key = item[property];
      if (!groups[key]) {
        groups[key] = 0;
      }
      groups[key]++;
      return groups;
    }, {});
  }

  /**
   * Clean up completed requests from memory
   */
  cleanup(olderThanMs = 3600000) { // 1 hour default
    const now = Date.now();
    const keysToDelete = [];

    for (const [id, request] of this.requestMap) {
      if (request.endTime && (now - request.endTime) > olderThanMs) {
        keysToDelete.push(id);
      }
    }

    keysToDelete.forEach(id => this.requestMap.delete(id));

    this.logger.debug(`[RequestTracking] Cleaned up ${keysToDelete.length} old requests`);
    return { cleaned: keysToDelete.length };
  }

  /**
   * Export logs (optional persistence)
   */
  exportLogs() {
    return {
      errors: this.errorLog,
      requests: this.requestLog,
      exportedAt: new Date().toISOString(),
      metrics: this.getPerformanceMetrics()
    };
  }
}

module.exports = { RequestTrackingManager };

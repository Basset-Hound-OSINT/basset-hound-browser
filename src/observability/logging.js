/**
 * Log Aggregation for Basset Hound Browser
 *
 * Provides:
 * - Centralized log collection
 * - Log parsing and enrichment
 * - ELK stack integration
 *
 * Features:
 * - Structured logging with levels
 * - Log filtering and searching
 * - ELK stack compatibility
 * - Log retention policies
 * - Real-time log streaming
 */

const EventEmitter = require('events');

class LogAggregator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      serviceName: options.serviceName || 'basset-hound',
      environment: options.environment || 'development',
      logLevel: options.logLevel || 'info',
      retentionDays: options.retentionDays || 7,
      maxLogSize: options.maxLogSize || 10000,
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile || false,
      enableELK: options.enableELK || false,
      elkEndpoint: options.elkEndpoint,
      ...options
    };

    this.logs = [];
    this.logsByService = new Map();
    this.logLevels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    this.currentLevel = this.logLevels[this.options.logLevel] ?? 1;
  }

  /**
   * Create logger for service
   */
  createLogger(serviceName) {
    if (!this.logsByService.has(serviceName)) {
      this.logsByService.set(serviceName, []);
    }

    return {
      debug: (message, meta = {}) => this.log('debug', serviceName, message, meta),
      info: (message, meta = {}) => this.log('info', serviceName, message, meta),
      warn: (message, meta = {}) => this.log('warn', serviceName, message, meta),
      error: (message, meta = {}) => this.log('error', serviceName, message, meta),
      fatal: (message, meta = {}) => this.log('fatal', serviceName, message, meta)
    };
  }

  /**
   * Log message
   */
  log(level, serviceName, message, metadata = {}) {
    // Check log level
    if (this.logLevels[level] < this.currentLevel) {
      return;
    }

    const logEntry = {
      timestamp: Date.now(),
      iso8601: new Date().toISOString(),
      level,
      service: serviceName,
      environment: this.options.environment,
      message,
      metadata: this._enrichMetadata(metadata),
      traceId: metadata.traceId || null,
      spanId: metadata.spanId || null,
      userId: metadata.userId || null,
      requestId: metadata.requestId || null
    };

    // Store log
    this.logs.push(logEntry);
    const serviceLogs = this.logsByService.get(serviceName) || [];
    serviceLogs.push(logEntry);
    this.logsByService.set(serviceName, serviceLogs);

    // Cleanup if needed
    if (this.logs.length > this.options.maxLogSize) {
      this._cleanup();
    }

    // Output to console if enabled
    if (this.options.enableConsole) {
      this._consoleOutput(logEntry);
    }

    // Export to ELK if enabled
    if (this.options.enableELK) {
      this._exportToELK(logEntry);
    }

    // Emit event
    this.emit(`log:${level}`, logEntry);
    this.emit('log', logEntry);

    return logEntry;
  }

  /**
   * Enrich metadata with context
   */
  _enrichMetadata(metadata) {
    return {
      ...metadata,
      hostname: require('os').hostname(),
      pid: process.pid,
      version: '1.0.0'
    };
  }

  /**
   * Output to console
   */
  _consoleOutput(logEntry) {
    const color = this._getLevelColor(logEntry.level);
    const timestamp = logEntry.iso8601;
    const prefix = `[${timestamp}] [${logEntry.service}] [${logEntry.level.toUpperCase()}]`;

    console.log(`${prefix} ${logEntry.message}`, logEntry.metadata);
  }

  /**
   * Get level color for console output
   */
  _getLevelColor(level) {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[35m' // Magenta
    };
    return colors[level] || '\x1b[0m'; // Default white
  }

  /**
   * Export to ELK
   */
  async _exportToELK(logEntry) {
    try {
      const document = {
        ...logEntry,
        '@timestamp': logEntry.iso8601,
        level: logEntry.level.toUpperCase()
      };

      // In production, would send to Elasticsearch
      this.emit('elk:export', { document });

    } catch (error) {
      this.emit('elk:error', { error: error.message });
    }
  }

  /**
   * Search logs
   */
  searchLogs(query, options = {}) {
    let results = this.logs;

    // Filter by service
    if (query.service) {
      results = results.filter(log => log.service === query.service);
    }

    // Filter by level
    if (query.level) {
      const level = this.logLevels[query.level] || 0;
      results = results.filter(log => this.logLevels[log.level] >= level);
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter(log => log.timestamp >= query.startTime);
    }

    if (query.endTime) {
      results = results.filter(log => log.timestamp <= query.endTime);
    }

    // Search in message
    if (query.message) {
      const msgRegex = new RegExp(query.message, 'i');
      results = results.filter(log => msgRegex.test(log.message));
    }

    // Filter by trace ID
    if (query.traceId) {
      results = results.filter(log => log.traceId === query.traceId);
    }

    // Filter by span ID
    if (query.spanId) {
      results = results.filter(log => log.spanId === query.spanId);
    }

    // Filter by user ID
    if (query.userId) {
      results = results.filter(log => log.userId === query.userId);
    }

    // Filter by request ID
    if (query.requestId) {
      results = results.filter(log => log.requestId === query.requestId);
    }

    // Sort
    if (options.sort) {
      const [field, direction] = options.sort.split(':');
      const multiplier = direction === 'desc' ? -1 : 1;
      results.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        if (aVal < bVal) return -1 * multiplier;
        if (aVal > bVal) return 1 * multiplier;
        return 0;
      });
    }

    // Pagination
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get logs by service
   */
  getServiceLogs(serviceName, options = {}) {
    const logs = this.logsByService.get(serviceName) || [];

    // Filter by level
    let filtered = logs;
    if (options.level) {
      const level = this.logLevels[options.level] || 0;
      filtered = filtered.filter(log => this.logLevels[log.level] >= level);
    }

    // Limit results
    const limit = options.limit || 100;
    return filtered.slice(-limit);
  }

  /**
   * Get logs by trace
   */
  getTraceLog(traceId) {
    return this.logs.filter(log => log.traceId === traceId);
  }

  /**
   * Get logs by request
   */
  getRequestLog(requestId) {
    return this.logs.filter(log => log.requestId === requestId);
  }

  /**
   * Get log statistics
   */
  getStats() {
    const stats = {
      totalLogs: this.logs.length,
      logsByLevel: {},
      logsByService: {},
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
    };

    // Count by level
    for (const log of this.logs) {
      if (!stats.logsByLevel[log.level]) {
        stats.logsByLevel[log.level] = 0;
      }
      stats.logsByLevel[log.level]++;
    }

    // Count by service
    for (const [service, logs] of this.logsByService) {
      stats.logsByService[service] = logs.length;
    }

    return stats;
  }

  /**
   * Get error logs
   */
  getErrorLogs(limit = 100) {
    return this.logs
      .filter(log => log.level === 'error' || log.level === 'fatal')
      .slice(-limit);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(limit = 100) {
    return this.logs.slice(-limit);
  }

  /**
   * Set log level
   */
  setLogLevel(level) {
    if (!(level in this.logLevels)) {
      throw new Error(`Invalid log level: ${level}`);
    }
    this.currentLevel = this.logLevels[level];
    this.emit('logLevel:changed', { level });
  }

  /**
   * Get current log level
   */
  getLogLevel() {
    for (const [name, value] of Object.entries(this.logLevels)) {
      if (value === this.currentLevel) {
        return name;
      }
    }
  }

  /**
   * Cleanup old logs
   */
  _cleanup() {
    const cutoff = Date.now() - (this.options.retentionDays * 24 * 60 * 60 * 1000);

    // Remove old logs from main array
    this.logs = this.logs.filter(log => log.timestamp > cutoff);

    // Remove old logs from service arrays
    for (const [service, logs] of this.logsByService) {
      const filtered = logs.filter(log => log.timestamp > cutoff);
      if (filtered.length === 0) {
        this.logsByService.delete(service);
      } else {
        this.logsByService.set(service, filtered);
      }
    }

    // Trim to max size if still over
    if (this.logs.length > this.options.maxLogSize) {
      const excessCount = this.logs.length - this.options.maxLogSize;
      this.logs = this.logs.slice(excessCount);
    }
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.logsByService.clear();
    this.emit('logs:cleared');
  }

  /**
   * Export logs as JSON
   */
  exportLogsJSON(filter = {}) {
    let logs = this.logs;

    if (filter.service) {
      logs = logs.filter(log => log.service === filter.service);
    }

    if (filter.level) {
      logs = logs.filter(log => log.level === filter.level);
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportLogsCSV(filter = {}) {
    let logs = this.logs;

    if (filter.service) {
      logs = logs.filter(log => log.service === filter.service);
    }

    if (filter.level) {
      logs = logs.filter(log => log.level === filter.level);
    }

    const headers = ['timestamp', 'level', 'service', 'message', 'traceId'];
    const rows = logs.map(log => [
      log.timestamp,
      log.level,
      log.service,
      log.message,
      log.traceId || ''
    ]);

    let csv = headers.join(',') + '\n';
    for (const row of rows) {
      csv += row.map(val => `"${val}"`).join(',') + '\n';
    }

    return csv;
  }

  /**
   * Close logger
   */
  close() {
    this.removeAllListeners();
    this.logs = [];
    this.logsByService.clear();
  }
}

module.exports = LogAggregator;

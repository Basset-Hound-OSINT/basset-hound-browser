/**
 * Basset Hound Browser - WebSocket Request/Response Logging Middleware
 *
 * Provides comprehensive logging for WebSocket requests and responses with:
 * - Configurable log levels (DEBUG, INFO, WARN, ERROR)
 * - Request/response timing and metrics
 * - Sensitive data masking
 * - Log rotation and disk space management
 * - Structured JSON output for analysis
 * - Formatted output for debugging
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const readline = require('readline');

/**
 * Log level constants
 */
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

/**
 * Reverse mapping for log level names
 */
const LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG'
};

/**
 * Sensitive data patterns to mask in logs
 */
const SENSITIVE_PATTERNS = [
  /password\s*[=:]\s*['"]?([^'"\s,}]+)/gi,
  /token\s*[=:]\s*['"]?([^'"\s,}]+)/gi,
  /authorization\s*[=:]\s*['"]?([^'"\s,}]+)/gi,
  /api[_-]?key\s*[=:]\s*['"]?([^'"\s,}]+)/gi,
  /secret\s*[=:]\s*['"]?([^'"\s,}]+)/gi,
  /bearer\s+[^\s,}]+/gi,
  /"(.*?)password(.*?)"\s*:\s*"([^"]+)"/gi,
  /"(.*?)token(.*?)"\s*:\s*"([^"]+)"/gi,
  /"(.*?)secret(.*?)"\s*:\s*"([^"]+)"/gi,
  /"(.*?)key(.*?)"\s*:\s*"([^"]+)"/gi
];

/**
 * WebSocketLoggingMiddleware class
 * Logs all WebSocket requests and responses with configurable levels and options
 */
class WebSocketLoggingMiddleware extends EventEmitter {
  /**
   * Create a new WebSocketLoggingMiddleware instance
   * @param {Object} options - Configuration options
   * @param {string} [options.level='INFO'] - Minimum log level (ERROR, WARN, INFO, DEBUG)
   * @param {string} [options.logDir='./logs/websocket'] - Directory for log files
   * @param {string} [options.jsonLogFile] - Path to structured JSON log file (e.g., /tmp/websocket-requests.log)
   * @param {number} [options.maxLogFileSize=10485760] - Max log file size (10MB default)
   * @param {number} [options.maxLogFiles=10] - Max number of log files to keep
   * @param {boolean} [options.maskSensitive=true] - Mask sensitive data in logs
   * @param {boolean} [options.truncatePayloads=true] - Truncate large payloads
   * @param {number} [options.maxPayloadLength=1000] - Max payload size before truncation
   * @param {boolean} [options.writeToFile=true] - Write logs to file
   * @param {boolean} [options.writeToConsole=false] - Write logs to console
   * @param {boolean} [options.writeStructuredJSON=true] - Write structured JSON logs
   * @param {Array<string>} [options.excludeCommands=[]] - Commands to exclude from logging
   */
  constructor(options = {}) {
    super();

    this.level = LOG_LEVELS[options.level] !== undefined ? LOG_LEVELS[options.level] : LOG_LEVELS.INFO;
    this.logDir = options.logDir || path.join(process.cwd(), 'logs', 'websocket');
    this.jsonLogFile = options.jsonLogFile || '/tmp/websocket-requests.log';
    this.maxLogFileSize = options.maxLogFileSize || 10 * 1024 * 1024; // 10MB
    this.maxLogFiles = options.maxLogFiles || 10;
    this.maskSensitive = options.maskSensitive !== false;
    this.truncatePayloads = options.truncatePayloads !== false;
    this.maxPayloadLength = options.maxPayloadLength || 1000;
    this.writeToFile = options.writeToFile !== false;
    this.writeToConsole = options.writeToConsole === true;
    this.writeStructuredJSON = options.writeStructuredJSON !== false;
    this.excludeCommands = new Set(options.excludeCommands || []);

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalResponses: 0,
      successfulResponses: 0,
      failedResponses: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    };

    // Response times for average calculation
    this.responseTimes = [];

    // Current log file path
    this.currentLogFile = null;
    this.currentLogFileSize = 0;

    // Stream for writing logs
    this.logStream = null;

    // Initialize log directory
    this._ensureLogDirectory();

    // Open initial log file
    if (this.writeToFile) {
      this._openLogFile();
    }

    // Cleanup interval (check for log rotation every 60 seconds)
    this.cleanupInterval = setInterval(() => this._checkLogRotation(), 60000);
  }

  /**
   * Ensure log directory exists
   * @private
   */
  _ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Open a new log file
   * @private
   */
  _openLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const fileName = `websocket-${timestamp}.log`;
      this.currentLogFile = path.join(this.logDir, fileName);
      this.currentLogFileSize = 0;

      // Close previous stream if exists
      if (this.logStream) {
        this.logStream.end();
      }

      // Open new stream in append mode
      this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });
      this.emit('logFileOpened', this.currentLogFile);
    } catch (error) {
      this.emit('error', new Error(`Failed to open log file: ${error.message}`));
    }
  }

  /**
   * Check if log file needs rotation
   * @private
   */
  _checkLogRotation() {
    if (!this.writeToFile || !this.currentLogFile) {
      return;
    }

    try {
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size >= this.maxLogFileSize) {
        this._rotateLogFile();
      }
    } catch (error) {
      this.emit('error', new Error(`Failed to check log rotation: ${error.message}`));
    }
  }

  /**
   * Rotate log files and cleanup old ones
   * @private
   */
  _rotateLogFile() {
    try {
      // Open new log file
      this._openLogFile();

      // Cleanup old log files
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('websocket-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      // Keep only maxLogFiles most recent files
      if (files.length > this.maxLogFiles) {
        for (let i = this.maxLogFiles; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].path);
          } catch (error) {
            this.emit('error', new Error(`Failed to delete old log file: ${error.message}`));
          }
        }
      }

      this.emit('logRotated');
    } catch (error) {
      this.emit('error', new Error(`Failed to rotate log file: ${error.message}`));
    }
  }

  /**
   * Mask sensitive data in strings
   * @private
   * @param {string} str - String to mask
   * @returns {string} Masked string
   */
  _maskSensitiveData(str) {
    if (!this.maskSensitive || typeof str !== 'string') {
      return str;
    }

    let masked = str;
    SENSITIVE_PATTERNS.forEach(pattern => {
      masked = masked.replace(pattern, (match) => {
        const key = match.split(/[=:]/)[0].trim();
        return `${key}=***MASKED***`;
      });
    });

    return masked;
  }

  /**
   * Truncate large payloads
   * @private
   * @param {any} payload - Payload to potentially truncate
   * @returns {string} Truncated payload string
   */
  _truncatePayload(payload) {
    let str;
    if (typeof payload === 'string') {
      str = payload;
    } else {
      str = JSON.stringify(payload);
    }

    if (this.truncatePayloads && str.length > this.maxPayloadLength) {
      return str.substring(0, this.maxPayloadLength) + `... [TRUNCATED: +${str.length - this.maxPayloadLength} bytes]`;
    }

    return str;
  }

  /**
   * Format a log entry
   * @private
   * @param {number} level - Log level
   * @param {string} command - Command name
   * @param {string} clientId - Client ID
   * @param {Object} data - Log data
   * @returns {string} Formatted log entry
   */
  _formatLogEntry(level, command, clientId, data) {
    const timestamp = new Date().toISOString();
    const levelName = LEVEL_NAMES[level];
    const lines = [`[${timestamp}] ${levelName} ${command} (${clientId})`];

    if (data.parameters) {
      const params = this._maskSensitiveData(this._truncatePayload(data.parameters));
      lines.push(`  Parameters: ${params}`);
    }

    if (data.responseTime !== undefined) {
      const size = data.responseSize ? ` (${this._formatBytes(data.responseSize)})` : '';
      lines.push(`  Response: ${data.statusCode} (${data.responseTime}ms${size})`);
    }

    if (data.error) {
      const error = this._maskSensitiveData(data.error);
      lines.push(`  Error: ${error}`);
    }

    if (data.errorCode) {
      lines.push(`  Error Code: ${data.errorCode}`);
    }

    if (data.recovery) {
      lines.push(`  Recovery: ${data.recovery}`);
    }

    return lines.join('\n');
  }

  /**
   * Format bytes to human readable size
   * @private
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted size
   */
  _formatBytes(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  }

  /**
   * Write a log entry to file and/or console
   * @private
   * @param {string} entry - Formatted log entry
   */
  _writeLog(entry) {
    if (this.writeToConsole) {
      console.log(entry);
    }

    if (this.writeToFile && this.logStream) {
      try {
        const data = entry + '\n\n';
        this.logStream.write(data);
        this.currentLogFileSize += Buffer.byteLength(data);
      } catch (error) {
        this.emit('error', new Error(`Failed to write log: ${error.message}`));
      }
    }
  }

  /**
   * Write a structured JSON log entry
   * @private
   * @param {Object} logEntry - Structured log entry object
   */
  _writeStructuredJSON(logEntry) {
    if (!this.writeStructuredJSON) {
      return;
    }

    try {
      const jsonLine = JSON.stringify(logEntry);
      fs.appendFileSync(this.jsonLogFile, jsonLine + '\n');
      this.emit('jsonLogged', logEntry);
    } catch (error) {
      this.emit('error', new Error(`Failed to write structured JSON log: ${error.message}`));
    }
  }

  /**
   * Log a request
   * @param {string} command - Command name
   * @param {string} clientId - Client ID
   * @param {Object} params - Request parameters
   * @param {string} [logLevel='INFO'] - Log level
   * @param {string} [requestId] - Unique request ID for tracking
   */
  logRequest(command, clientId, params, logLevel = 'INFO', requestId) {
    // Check if command is excluded
    if (this.excludeCommands.has(command)) {
      return;
    }

    // Check if log level should be logged
    const level = LOG_LEVELS[logLevel] !== undefined ? LOG_LEVELS[logLevel] : LOG_LEVELS.INFO;
    if (level > this.level) {
      return;
    }

    this.stats.totalRequests++;

    const timestamp = new Date().toISOString();
    const entry = this._formatLogEntry(level, command, clientId, {
      parameters: params ? JSON.stringify(params) : '{}'
    });

    // Write formatted log
    this._writeLog(entry);

    // Write structured JSON log
    const structuredEntry = {
      timestamp,
      type: 'request',
      level: LEVEL_NAMES[level],
      command,
      clientId,
      requestId: requestId || null,
      parameters: this.maskSensitive && params ? this._maskSensitiveData(JSON.stringify(params)) : params
    };
    this._writeStructuredJSON(structuredEntry);

    this.emit('request', { command, clientId, params, level, timestamp, requestId });
  }

  /**
   * Log a response
   * @param {string} command - Command name
   * @param {string} clientId - Client ID
   * @param {number} statusCode - HTTP-like status code (200, 400, 500, 504, etc.)
   * @param {number} responseTime - Response time in milliseconds
   * @param {number} [responseSize] - Response size in bytes
   * @param {string} [error] - Error message if failed
   * @param {string} [errorCode] - Error code
   * @param {string} [recovery] - Recovery suggestion
   * @param {string} [logLevel='INFO'] - Log level
   * @param {string} [requestId] - Unique request ID for tracking correlation
   */
  logResponse(command, clientId, statusCode, responseTime, responseSize = 0, error = null, errorCode = null, recovery = null, logLevel = 'INFO', requestId = null) {
    // Check if command is excluded
    if (this.excludeCommands.has(command)) {
      return;
    }

    // Check if log level should be logged
    const level = LOG_LEVELS[logLevel] !== undefined ? LOG_LEVELS[logLevel] : LOG_LEVELS.INFO;
    if (level > this.level) {
      return;
    }

    this.stats.totalResponses++;
    if (statusCode >= 200 && statusCode < 400) {
      this.stats.successfulResponses++;
    } else {
      this.stats.failedResponses++;
    }

    // Track response time for average calculation
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift(); // Keep only last 1000 samples
    }
    this._updateAverageResponseTime();

    const timestamp = new Date().toISOString();
    const entry = this._formatLogEntry(level, command, clientId, {
      statusCode,
      responseTime,
      responseSize,
      error,
      errorCode,
      recovery
    });

    // Write formatted log
    this._writeLog(entry);

    // Write structured JSON log
    const structuredEntry = {
      timestamp,
      type: 'response',
      level: LEVEL_NAMES[level],
      command,
      clientId,
      requestId: requestId || null,
      statusCode,
      responseTime,
      responseSize,
      success: statusCode >= 200 && statusCode < 400,
      error: error ? this.maskSensitive ? this._maskSensitiveData(error) : error : null,
      errorCode: errorCode || null,
      recovery: recovery || null
    };
    this._writeStructuredJSON(structuredEntry);

    this.emit('response', { command, clientId, statusCode, responseTime, responseSize, error, level, timestamp, requestId });
  }

  /**
   * Update average response time
   * @private
   */
  _updateAverageResponseTime() {
    if (this.responseTimes.length === 0) {
      this.stats.averageResponseTime = 0;
      return;
    }

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.stats.averageResponseTime = Math.round(sum / this.responseTimes.length);
  }

  /**
   * Set the log level
   * @param {string} level - Log level (ERROR, WARN, INFO, DEBUG)
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = LOG_LEVELS[level];
      this.emit('levelChanged', level);
    } else {
      throw new Error(`Invalid log level: ${level}`);
    }
  }

  /**
   * Get the current log level name
   * @returns {string} Current log level name
   */
  getLevel() {
    return LEVEL_NAMES[this.level];
  }

  /**
   * Get statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    const requestsPerMinute = this.stats.totalRequests > 0
      ? Math.round((this.stats.totalRequests / uptime) * 60000)
      : 0;

    return {
      ...this.stats,
      uptime,
      requestsPerMinute,
      successRate: this.stats.totalResponses > 0
        ? ((this.stats.successfulResponses / this.stats.totalResponses) * 100).toFixed(2) + '%'
        : 'N/A',
      currentLogFile: this.currentLogFile,
      currentLogFileSize: this._formatBytes(this.currentLogFileSize)
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      totalResponses: 0,
      successfulResponses: 0,
      failedResponses: 0,
      averageResponseTime: 0,
      startTime: Date.now()
    };
    this.responseTimes = [];
  }

  /**
   * Shutdown the middleware
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }

    this.emit('shutdown');
  }

  /**
   * Get all log files in the log directory
   * @returns {Array<Object>} Array of log file objects with name, path, size, and created time
   */
  getLogFiles() {
    try {
      return fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('websocket-') && f.endsWith('.log'))
        .map(f => {
          const filePath = path.join(this.logDir, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            path: filePath,
            size: this._formatBytes(stats.size),
            sizeBytes: stats.size,
            created: new Date(stats.birthtime).toISOString(),
            modified: new Date(stats.mtime).toISOString()
          };
        })
        .sort((a, b) => b.sizeBytes - a.sizeBytes);
    } catch (error) {
      this.emit('error', new Error(`Failed to read log files: ${error.message}`));
      return [];
    }
  }

  /**
   * Clear all log files
   */
  clearLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('websocket-') && f.endsWith('.log'));

      for (const file of files) {
        fs.unlinkSync(path.join(this.logDir, file));
      }

      // Open new log file
      if (this.writeToFile) {
        this._openLogFile();
      }

      this.emit('logsCleared');
    } catch (error) {
      this.emit('error', new Error(`Failed to clear logs: ${error.message}`));
    }
  }

  /**
   * Read and parse structured JSON logs
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Limit number of entries
   * @param {string} [options.command] - Filter by command name
   * @param {string} [options.type] - Filter by type (request, response)
   * @param {number} [options.minStatusCode] - Filter by min status code
   * @param {number} [options.maxStatusCode] - Filter by max status code
   * @returns {Promise<Array<Object>>} Array of parsed log entries
   */
  async readStructuredLogs(options = {}) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.jsonLogFile)) {
        resolve([]);
        return;
      }

      const entries = [];
      const rl = readline.createInterface({
        input: fs.createReadStream(this.jsonLogFile),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        if (!line.trim()) return;

        try {
          const entry = JSON.parse(line);

          // Apply filters
          if (options.command && entry.command !== options.command) return;
          if (options.type && entry.type !== options.type) return;
          if (options.minStatusCode && entry.statusCode && entry.statusCode < options.minStatusCode) return;
          if (options.maxStatusCode && entry.statusCode && entry.statusCode > options.maxStatusCode) return;

          entries.push(entry);
        } catch (error) {
          // Skip malformed JSON lines
        }
      });

      rl.on('close', () => {
        // Apply limit if specified
        const result = options.limit ? entries.slice(-options.limit) : entries;
        resolve(result);
      });

      rl.on('error', reject);
    });
  }

  /**
   * Get summary statistics from structured JSON logs
   * @returns {Promise<Object>} Summary statistics
   */
  async getStructuredLogsSummary() {
    const logs = await this.readStructuredLogs();

    const requests = logs.filter(l => l.type === 'request');
    const responses = logs.filter(l => l.type === 'response');
    const errors = responses.filter(l => l.statusCode >= 400);

    const responseTimes = responses
      .map(r => r.responseTime)
      .filter(t => t !== undefined);

    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    const commandStats = {};
    responses.forEach(r => {
      if (!commandStats[r.command]) {
        commandStats[r.command] = {
          count: 0,
          successful: 0,
          failed: 0,
          avgResponseTime: 0,
          totalResponseTime: 0
        };
      }
      commandStats[r.command].count++;
      if (r.statusCode >= 200 && r.statusCode < 400) {
        commandStats[r.command].successful++;
      } else {
        commandStats[r.command].failed++;
      }
      if (r.responseTime) {
        commandStats[r.command].totalResponseTime += r.responseTime;
      }
    });

    // Calculate average response times per command
    Object.keys(commandStats).forEach(cmd => {
      const stat = commandStats[cmd];
      stat.avgResponseTime = Math.round(stat.totalResponseTime / stat.count);
      delete stat.totalResponseTime;
    });

    return {
      totalLogs: logs.length,
      totalRequests: requests.length,
      totalResponses: responses.length,
      totalErrors: errors.length,
      errorRate: responses.length > 0 ? ((errors.length / responses.length) * 100).toFixed(2) + '%' : 'N/A',
      averageResponseTime: avgResponseTime,
      commandStats
    };
  }

  /**
   * Clear the structured JSON log file
   */
  clearStructuredLogs() {
    try {
      if (fs.existsSync(this.jsonLogFile)) {
        fs.writeFileSync(this.jsonLogFile, '');
      }
      this.emit('structuredLogsCleared');
    } catch (error) {
      this.emit('error', new Error(`Failed to clear structured logs: ${error.message}`));
    }
  }
}

/**
 * Create a default WebSocketLoggingMiddleware instance
 */
const defaultMiddleware = new WebSocketLoggingMiddleware({
  level: process.env.WS_LOG_LEVEL || 'INFO',
  logDir: process.env.WS_LOG_DIR || path.join(process.cwd(), 'logs', 'websocket')
});

module.exports = {
  WebSocketLoggingMiddleware,
  LOG_LEVELS,
  LEVEL_NAMES,
  defaultMiddleware,
  createLoggingMiddleware: (options) => new WebSocketLoggingMiddleware(options)
};

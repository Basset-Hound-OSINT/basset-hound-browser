/**
 * Structured Logger - v12.3.0
 *
 * JSON-based structured logging with log levels and rotation
 * Compatible with ELK stack and log aggregation services
 *
 * @module src/infrastructure/structured-logger
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4
};

const LEVEL_NAMES = {
  0: 'DEBUG',
  1: 'INFO',
  2: 'WARN',
  3: 'ERROR',
  4: 'CRITICAL'
};

class StructuredLogger extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      level: options.level || 'INFO',
      logDir: options.logDir || './logs',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxBackups: options.maxBackups || 10,
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      prettyPrint: options.prettyPrint || false,
      serviceName: options.serviceName || 'basset-hound-browser',
      environment: options.environment || process.env.NODE_ENV || 'development',
      ...options
    };

    this.currentLevel = LOG_LEVELS[this.options.level] || LOG_LEVELS.INFO;
    this.logFile = null;
    this.logRotationThreshold = 0;

    if (this.options.enableFile) {
      this._initializeLogFile();
    }
  }

  /**
   * Initialize log file
   * @private
   */
  _initializeLogFile() {
    try {
      if (!fs.existsSync(this.options.logDir)) {
        fs.mkdirSync(this.options.logDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(this.options.logDir, `basset-hound-${timestamp}.log`);
    } catch (err) {
      this.emit('logger:error', {
        message: `Failed to initialize log file: ${err.message}`
      });
    }
  }

  /**
   * Format log entry as JSON
   * @private
   */
  _formatLogEntry(level, message, context = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level],
      service: this.options.serviceName,
      environment: this.options.environment,
      message,
      pid: process.pid,
      ...context
    };

    if (this.options.prettyPrint) {
      return JSON.stringify(entry, null, 2);
    }

    return JSON.stringify(entry);
  }

  /**
   * Write log entry to file
   * @private
   */
  _writeToFile(entry) {
    if (!this.options.enableFile) {
      return;
    }

    try {
      fs.appendFileSync(this.logFilePath, entry + '\n');

      // Check if rotation needed
      const stats = fs.statSync(this.logFilePath);
      if (stats.size > this.options.maxFileSize) {
        this._rotateLogFile();
      }
    } catch (err) {
      this.emit('logger:error', {
        message: `Failed to write to log file: ${err.message}`
      });
    }
  }

  /**
   * Rotate log file when size exceeded
   * @private
   */
  _rotateLogFile() {
    try {
      const dir = path.dirname(this.logFilePath);
      const files = fs.readdirSync(dir)
        .filter(f => f.startsWith('basset-hound-'))
        .sort()
        .reverse();

      // Remove old backups beyond maxBackups
      for (let i = this.options.maxBackups; i < files.length; i++) {
        fs.unlinkSync(path.join(dir, files[i]));
      }

      // Create new log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFilePath = path.join(dir, `basset-hound-${timestamp}.log`);
    } catch (err) {
      this.emit('logger:error', {
        message: `Failed to rotate log file: ${err.message}`
      });
    }
  }

  /**
   * Log message at specified level
   * @private
   */
  _log(level, message, context = {}) {
    if (level < this.currentLevel) {
      return;
    }

    const entry = this._formatLogEntry(level, message, context);

    if (this.options.enableConsole) {
      const method = LEVEL_NAMES[level].toLowerCase();
      if (console[method]) {
        console[method](entry);
      }
    }

    if (this.options.enableFile) {
      this._writeToFile(entry);
    }

    this.emit('log', {
      level: LEVEL_NAMES[level],
      message,
      context
    });
  }

  /**
   * Log debug message
   */
  debug(message, context = {}) {
    this._log(LOG_LEVELS.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message, context = {}) {
    this._log(LOG_LEVELS.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message, context = {}) {
    this._log(LOG_LEVELS.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message, context = {}) {
    if (context instanceof Error) {
      context = {
        error: context.message,
        stack: context.stack
      };
    }
    this._log(LOG_LEVELS.ERROR, message, context);
  }

  /**
   * Log critical message
   */
  critical(message, context = {}) {
    this._log(LOG_LEVELS.CRITICAL, message, context);
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.currentLevel = LOG_LEVELS[level];
      this.info(`Log level changed to ${level}`);
    }
  }

  /**
   * Get current log level
   */
  getLevel() {
    return LEVEL_NAMES[this.currentLevel];
  }

  /**
   * Clean old log files
   */
  cleanupOldLogs(daysOld = 7) {
    if (!this.options.enableFile) {
      return;
    }

    try {
      const dir = path.dirname(this.logFilePath);
      const files = fs.readdirSync(dir).filter(f => f.startsWith('basset-hound-'));

      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          this.debug(`Deleted old log file: ${file}`);
        }
      }
    } catch (err) {
      this.error('Failed to cleanup old logs', { error: err.message });
    }
  }
}

module.exports = StructuredLogger;

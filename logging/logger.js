/**
 * Basset Hound Browser - Logger
 * Main logging class with configurable levels, transports, and formatters
 */

const { EventEmitter } = require('events');
const { ConsoleTransport, FileTransport, MemoryTransport, createTransport } = require('./transports');
const { createFormatter } = require('./formatter');

/**
 * Log level constants and priorities
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

/**
 * Level names for reverse lookup
 */
const LEVEL_NAMES = Object.keys(LOG_LEVELS);

/**
 * Logger class - Main logging implementation
 */
class Logger extends EventEmitter {
  /**
   * Create a new Logger instance
   * @param {Object} options - Logger configuration
   * @param {string} [options.name] - Logger name/category
   * @param {string} [options.level='info'] - Minimum log level
   * @param {Object} [options.context] - Default context metadata
   * @param {Array} [options.transports] - Array of transport instances
   * @param {Logger} [options.parent] - Parent logger for child loggers
   */
  constructor(options = {}) {
    super();

    this.name = options.name || 'app';
    this.level = options.level || 'info';
    this.context = options.context || {};
    this.transports = options.transports || [];
    this.parent = options.parent || null;

    // Child loggers
    this.children = new Map();

    // Statistics
    this.stats = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      total: 0
    };

    // Whether logger is enabled
    this.enabled = options.enabled !== false;

    // If no transports specified, add default console transport
    if (this.transports.length === 0 && !this.parent) {
      this.transports.push(new ConsoleTransport({ level: this.level }));
    }
  }

  /**
   * Check if a level should be logged
   * @param {string} level - Level to check
   * @returns {boolean}
   */
  isLevelEnabled(level) {
    if (!this.enabled) return false;
    return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
  }

  /**
   * Set the minimum log level
   * @param {string} level - New log level
   */
  setLevel(level) {
    if (!LOG_LEVELS.hasOwnProperty(level)) {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${LEVEL_NAMES.join(', ')}`);
    }
    this.level = level;

    // Update transport levels
    this.transports.forEach(t => {
      t.level = level;
    });
  }

  /**
   * Get current log level
   * @returns {string}
   */
  getLevel() {
    return this.level;
  }

  /**
   * Add context metadata
   * @param {Object} context - Context to merge
   * @returns {Logger} This logger for chaining
   */
  addContext(context) {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Clear context metadata
   * @returns {Logger} This logger for chaining
   */
  clearContext() {
    this.context = {};
    return this;
  }

  /**
   * Create a child logger with inherited context
   * @param {string} name - Child logger name
   * @param {Object} options - Additional options
   * @returns {Logger} Child logger instance
   */
  child(name, options = {}) {
    const childName = this.name ? `${this.name}:${name}` : name;

    // Return existing child if already created
    if (this.children.has(childName)) {
      return this.children.get(childName);
    }

    const child = new Logger({
      name: childName,
      level: options.level || this.level,
      context: { ...this.context, ...options.context },
      parent: this,
      enabled: this.enabled
    });

    this.children.set(childName, child);
    return child;
  }

  /**
   * Get or create a child logger
   * @param {string} name - Child logger name
   * @returns {Logger}
   */
  getChild(name) {
    return this.child(name);
  }

  /**
   * Create a log entry object
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @returns {Object} Log entry
   * @private
   */
  _createEntry(level, message, data = {}) {
    const entry = {
      timestamp: new Date(),
      level,
      name: this.name,
      message,
      context: { ...this.context }
    };

    // Handle Error objects
    if (data instanceof Error) {
      entry.error = {
        name: data.name,
        message: data.message,
        stack: data.stack
      };
    } else if (data.error instanceof Error) {
      entry.error = {
        name: data.error.name,
        message: data.error.message,
        stack: data.error.stack
      };
      delete data.error;
      if (Object.keys(data).length > 0) {
        entry.data = data;
      }
    } else if (Object.keys(data).length > 0) {
      entry.data = data;
    }

    return entry;
  }

  /**
   * Write log entry to all transports
   * @param {Object} entry - Log entry
   * @private
   */
  _write(entry) {
    // Write to parent's transports if child logger
    if (this.parent) {
      this.parent._write(entry);
      return;
    }

    // Write to all transports
    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        // Avoid infinite loops - write to stderr directly
        process.stderr.write(`[Logger] Transport error: ${error.message}\n`);
      }
    }

    // Emit event
    this.emit('log', entry);
  }

  /**
   * Core log method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    if (!this.isLevelEnabled(level)) return;

    const entry = this._createEntry(level, message, data);
    this._write(entry);

    // Update stats
    this.stats[level]++;
    this.stats.total++;
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Object|Error} data - Error details or Error object
   */
  error(message, data = {}) {
    this.log('error', message, data);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.log('info', message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.log('debug', message, data);
  }

  /**
   * Log trace message
   * @param {string} message - Trace message
   * @param {Object} data - Additional data
   */
  trace(message, data = {}) {
    this.log('trace', message, data);
  }

  /**
   * Add a transport
   * @param {BaseTransport} transport - Transport instance
   * @returns {Logger} This logger for chaining
   */
  addTransport(transport) {
    this.transports.push(transport);
    return this;
  }

  /**
   * Remove a transport by name or instance
   * @param {string|BaseTransport} transport - Transport name or instance
   * @returns {boolean} True if removed
   */
  removeTransport(transport) {
    const index = typeof transport === 'string'
      ? this.transports.findIndex(t => t.name === transport)
      : this.transports.indexOf(transport);

    if (index !== -1) {
      const removed = this.transports.splice(index, 1)[0];
      removed.close();
      return true;
    }
    return false;
  }

  /**
   * Get transport by name
   * @param {string} name - Transport name
   * @returns {BaseTransport|null}
   */
  getTransport(name) {
    return this.transports.find(t => t.name === name) || null;
  }

  /**
   * Get all transports
   * @returns {Array}
   */
  getTransports() {
    return [...this.transports];
  }

  /**
   * Get logging statistics
   * @returns {Object}
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
      total: 0
    };
  }

  /**
   * Enable logging
   */
  enable() {
    this.enabled = true;
    this.children.forEach(child => child.enable());
  }

  /**
   * Disable logging
   */
  disable() {
    this.enabled = false;
    this.children.forEach(child => child.disable());
  }

  /**
   * Close logger and all transports
   */
  close() {
    for (const transport of this.transports) {
      transport.close();
    }
    this.children.forEach(child => child.close());
    this.removeAllListeners();
  }
}

/**
 * Create a configured logger instance
 * @param {Object} options - Logger options
 * @returns {Logger}
 */
function createLogger(options = {}) {
  const logger = new Logger({
    name: options.name,
    level: options.level || 'info',
    context: options.context
  });

  // Add console transport if requested
  if (options.console !== false) {
    logger.addTransport(new ConsoleTransport({
      level: options.consoleLevel || options.level || 'info',
      color: options.color !== false
    }));
  }

  // Add file transport if configured
  if (options.file) {
    const fileOptions = typeof options.file === 'object'
      ? options.file
      : { filename: options.file };

    logger.addTransport(new FileTransport({
      level: options.fileLevel || options.level || 'info',
      ...fileOptions
    }));
  }

  // Add memory transport if requested (useful for debugging)
  if (options.memory) {
    const memoryOptions = typeof options.memory === 'object'
      ? options.memory
      : {};

    logger.addTransport(new MemoryTransport({
      level: options.memoryLevel || options.level || 'debug',
      ...memoryOptions
    }));
  }

  return logger;
}

/**
 * Default logger instance
 */
const defaultLogger = createLogger({
  name: 'basset',
  level: process.env.LOG_LEVEL || 'info',
  console: true,
  color: process.env.NO_COLOR !== '1'
});

module.exports = {
  Logger,
  LOG_LEVELS,
  LEVEL_NAMES,
  createLogger,
  defaultLogger
};

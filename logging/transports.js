/**
 * Basset Hound Browser - Log Transports
 * Handles log output destinations: console, file, WebSocket
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { JSONFormatter, TextFormatter, ColorFormatter, createFormatter } = require('./formatter');

/**
 * Base Transport class
 */
class BaseTransport extends EventEmitter {
  constructor(options = {}) {
    super();
    this.name = options.name || 'transport';
    this.level = options.level || 'info';
    this.enabled = options.enabled !== false;
    this.formatter = options.formatter || null;
  }

  /**
   * Check if this transport should handle the given level
   * @param {string} level - Log level to check
   * @returns {boolean}
   */
  shouldLog(level) {
    if (!this.enabled) return false;

    const levels = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
    return levels[level] <= levels[this.level];
  }

  /**
   * Write log entry - must be implemented by subclasses
   * @param {Object} entry - Log entry
   */
  write(entry) {
    throw new Error('write() must be implemented by subclass');
  }

  /**
   * Format entry using configured formatter
   * @param {Object} entry - Log entry
   * @returns {string} Formatted output
   */
  format(entry) {
    if (this.formatter) {
      return this.formatter.format(entry);
    }
    return JSON.stringify(entry);
  }

  /**
   * Close/cleanup the transport
   */
  close() {
    this.enabled = false;
  }
}

/**
 * Console Transport - Write logs to stdout/stderr
 */
class ConsoleTransport extends BaseTransport {
  constructor(options = {}) {
    super({ name: 'console', ...options });

    // Use ColorFormatter by default for console
    if (!this.formatter) {
      const useColor = options.color !== false && process.stdout.isTTY;
      this.formatter = useColor
        ? new ColorFormatter(options.formatterOptions || {})
        : new TextFormatter(options.formatterOptions || {});
    }

    // Whether to use stderr for errors/warnings
    this.useStderr = options.useStderr !== false;
  }

  /**
   * Write log entry to console
   * @param {Object} entry - Log entry
   */
  write(entry) {
    if (!this.shouldLog(entry.level)) return;

    const output = this.format(entry);

    // Use stderr for errors and warnings
    if (this.useStderr && (entry.level === 'error' || entry.level === 'warn')) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }
}

/**
 * File Transport - Write logs to file with rotation support
 */
class FileTransport extends BaseTransport {
  constructor(options = {}) {
    super({ name: 'file', ...options });

    // File configuration
    this.filename = options.filename || 'app.log';
    this.dirname = options.dirname || './logs';
    this.maxSize = options.maxSize || 10 * 1024 * 1024; // 10 MB default
    this.maxFiles = options.maxFiles || 5;
    this.compress = options.compress || false;

    // Use JSON formatter by default for file output
    if (!this.formatter) {
      this.formatter = new JSONFormatter(options.formatterOptions || {});
    }

    // Internal state
    this.stream = null;
    this.currentSize = 0;
    this.rotationInProgress = false;
    this.writeQueue = [];

    // Initialize
    this._ensureDirectory();
    this._openStream();
  }

  /**
   * Ensure log directory exists
   * @private
   */
  _ensureDirectory() {
    if (!fs.existsSync(this.dirname)) {
      fs.mkdirSync(this.dirname, { recursive: true });
    }
  }

  /**
   * Get current log file path
   * @returns {string} Full file path
   */
  getFilePath() {
    return path.join(this.dirname, this.filename);
  }

  /**
   * Open the log file stream
   * @private
   */
  _openStream() {
    const filepath = this.getFilePath();

    // Check existing file size
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      this.currentSize = stats.size;
    } else {
      this.currentSize = 0;
    }

    this.stream = fs.createWriteStream(filepath, { flags: 'a' });

    this.stream.on('error', (error) => {
      this.emit('error', error);
      console.error(`[FileTransport] Stream error: ${error.message}`);
    });
  }

  /**
   * Write log entry to file
   * @param {Object} entry - Log entry
   */
  write(entry) {
    if (!this.shouldLog(entry.level)) return;
    if (this.rotationInProgress) {
      this.writeQueue.push(entry);
      return;
    }

    const output = this.format(entry) + '\n';
    const size = Buffer.byteLength(output);

    // Check if rotation needed
    if (this.currentSize + size > this.maxSize) {
      this._rotate();
      this.writeQueue.push(entry);
      return;
    }

    this._writeToStream(output, size);
  }

  /**
   * Write to stream and update size
   * @param {string} output - Formatted log output
   * @param {number} size - Byte size of output
   * @private
   */
  _writeToStream(output, size) {
    if (this.stream && this.stream.writable) {
      this.stream.write(output);
      this.currentSize += size;
    }
  }

  /**
   * Rotate log files
   * @private
   */
  _rotate() {
    if (this.rotationInProgress) return;
    this.rotationInProgress = true;

    // Close current stream
    if (this.stream) {
      this.stream.end();
    }

    const basePath = this.getFilePath();

    // Remove oldest file if at max
    const oldestPath = `${basePath}.${this.maxFiles}`;
    if (fs.existsSync(oldestPath)) {
      fs.unlinkSync(oldestPath);
    }

    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = i === 1 ? basePath : `${basePath}.${i - 1}`;
      const newPath = `${basePath}.${i}`;

      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
    }

    // Re-open stream
    this._openStream();
    this.rotationInProgress = false;

    // Process queued writes
    while (this.writeQueue.length > 0) {
      const entry = this.writeQueue.shift();
      this.write(entry);
    }

    this.emit('rotated', { filename: this.filename });
  }

  /**
   * Force rotation regardless of size
   */
  forceRotate() {
    this._rotate();
  }

  /**
   * Get current log file size
   * @returns {number} Size in bytes
   */
  getSize() {
    return this.currentSize;
  }

  /**
   * Get list of rotated log files
   * @returns {Array} Array of file paths
   */
  getLogFiles() {
    const files = [];
    const basePath = this.getFilePath();

    if (fs.existsSync(basePath)) {
      files.push(basePath);
    }

    for (let i = 1; i <= this.maxFiles; i++) {
      const rotatedPath = `${basePath}.${i}`;
      if (fs.existsSync(rotatedPath)) {
        files.push(rotatedPath);
      }
    }

    return files;
  }

  /**
   * Close the file stream
   */
  close() {
    super.close();
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}

/**
 * WebSocket Transport - Send logs to connected WebSocket clients
 */
class WebSocketTransport extends BaseTransport {
  constructor(options = {}) {
    super({ name: 'websocket', ...options });

    // WebSocket server reference (set externally)
    this.wsServer = options.wsServer || null;

    // Buffer configuration for batching
    this.bufferSize = options.bufferSize || 100;
    this.flushInterval = options.flushInterval || 1000;
    this.buffer = [];
    this.flushTimer = null;

    // Use JSON formatter for WebSocket
    if (!this.formatter) {
      this.formatter = new JSONFormatter(options.formatterOptions || {});
    }

    // Start flush timer if interval set
    if (this.flushInterval > 0) {
      this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    }
  }

  /**
   * Set WebSocket server reference
   * @param {WebSocketServer} server - WebSocket server instance
   */
  setServer(server) {
    this.wsServer = server;
  }

  /**
   * Write log entry to WebSocket clients
   * @param {Object} entry - Log entry
   */
  write(entry) {
    if (!this.shouldLog(entry.level)) return;
    if (!this.wsServer) return;

    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  /**
   * Flush buffered logs to clients
   */
  flush() {
    if (this.buffer.length === 0) return;
    if (!this.wsServer) return;

    const logs = this.buffer.map(entry => {
      try {
        return JSON.parse(this.format(entry));
      } catch (e) {
        return entry;
      }
    });

    this.buffer = [];

    try {
      this.wsServer.broadcast({
        type: 'log_batch',
        logs,
        count: logs.length,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Send single log immediately (bypass buffer)
   * @param {Object} entry - Log entry
   */
  sendImmediate(entry) {
    if (!this.wsServer) return;

    try {
      const log = JSON.parse(this.format(entry));
      this.wsServer.broadcast({
        type: 'log',
        log,
        timestamp: Date.now()
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Close the transport
   */
  close() {
    super.close();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Flush remaining logs
  }
}

/**
 * Memory Transport - Store logs in memory (useful for testing/debugging)
 */
class MemoryTransport extends BaseTransport {
  constructor(options = {}) {
    super({ name: 'memory', ...options });
    this.maxEntries = options.maxEntries || 1000;
    this.entries = [];
  }

  /**
   * Write log entry to memory
   * @param {Object} entry - Log entry
   */
  write(entry) {
    if (!this.shouldLog(entry.level)) return;

    this.entries.push(entry);

    // Trim if over limit
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  /**
   * Get all stored entries
   * @param {Object} filter - Optional filter
   * @returns {Array} Log entries
   */
  getEntries(filter = {}) {
    let results = [...this.entries];

    if (filter.level) {
      results = results.filter(e => e.level === filter.level);
    }

    if (filter.since) {
      const since = new Date(filter.since).getTime();
      results = results.filter(e => new Date(e.timestamp).getTime() >= since);
    }

    if (filter.limit) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  /**
   * Clear all stored entries
   */
  clear() {
    this.entries = [];
  }

  /**
   * Get entry count
   * @returns {number}
   */
  count() {
    return this.entries.length;
  }
}

/**
 * Create a transport by name
 * @param {string} type - Transport type
 * @param {Object} options - Transport options
 * @returns {BaseTransport} Transport instance
 */
function createTransport(type, options = {}) {
  switch (type.toLowerCase()) {
    case 'console':
      return new ConsoleTransport(options);
    case 'file':
      return new FileTransport(options);
    case 'websocket':
    case 'ws':
      return new WebSocketTransport(options);
    case 'memory':
      return new MemoryTransport(options);
    default:
      throw new Error(`Unknown transport type: ${type}`);
  }
}

module.exports = {
  BaseTransport,
  ConsoleTransport,
  FileTransport,
  WebSocketTransport,
  MemoryTransport,
  createTransport
};

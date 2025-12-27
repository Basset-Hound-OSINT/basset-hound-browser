/**
 * Basset Hound Browser - Log Formatters
 * Provides various output formats for log entries
 */

/**
 * Base Formatter class
 */
class BaseFormatter {
  /**
   * Format a log entry
   * @param {Object} entry - Log entry object
   * @returns {string} Formatted log string
   */
  format(entry) {
    throw new Error('format() must be implemented by subclass');
  }

  /**
   * Format timestamp
   * @param {Date|number} timestamp - Timestamp to format
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    return date.toISOString();
  }
}

/**
 * JSON Formatter - Structured JSON output
 */
class JSONFormatter extends BaseFormatter {
  constructor(options = {}) {
    super();
    this.pretty = options.pretty || false;
    this.includeMetadata = options.includeMetadata !== false;
  }

  /**
   * Format log entry as JSON
   * @param {Object} entry - Log entry
   * @returns {string} JSON string
   */
  format(entry) {
    const output = {
      timestamp: this.formatTimestamp(entry.timestamp),
      level: entry.level,
      message: entry.message
    };

    // Add logger name if present
    if (entry.name) {
      output.logger = entry.name;
    }

    // Add context/metadata
    if (this.includeMetadata && entry.context) {
      output.context = entry.context;
    }

    // Add additional data
    if (entry.data !== undefined) {
      output.data = entry.data;
    }

    // Add error info if present
    if (entry.error) {
      output.error = {
        name: entry.error.name,
        message: entry.error.message,
        stack: entry.error.stack
      };
    }

    // Add performance metrics if present
    if (entry.duration !== undefined) {
      output.duration = entry.duration;
    }

    return this.pretty
      ? JSON.stringify(output, null, 2)
      : JSON.stringify(output);
  }
}

/**
 * Text Formatter - Human-readable plain text output
 */
class TextFormatter extends BaseFormatter {
  constructor(options = {}) {
    super();
    this.timestampFormat = options.timestampFormat || 'iso';
    this.showContext = options.showContext !== false;
    this.maxMessageLength = options.maxMessageLength || 0; // 0 = no limit
  }

  /**
   * Format timestamp based on configured format
   * @param {Date|number} timestamp - Timestamp
   * @returns {string} Formatted timestamp
   */
  formatTimestamp(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    switch (this.timestampFormat) {
      case 'time':
        return date.toLocaleTimeString();
      case 'short':
        return `${date.getMonth() + 1}/${date.getDate()} ${date.toLocaleTimeString()}`;
      case 'unix':
        return String(date.getTime());
      case 'iso':
      default:
        return date.toISOString();
    }
  }

  /**
   * Get level label with padding
   * @param {string} level - Log level
   * @returns {string} Padded level string
   */
  getLevelLabel(level) {
    const labels = {
      error: 'ERROR',
      warn: 'WARN ',
      info: 'INFO ',
      debug: 'DEBUG',
      trace: 'TRACE'
    };
    return labels[level] || level.toUpperCase().padEnd(5);
  }

  /**
   * Format log entry as text
   * @param {Object} entry - Log entry
   * @returns {string} Formatted text string
   */
  format(entry) {
    const timestamp = this.formatTimestamp(entry.timestamp);
    const level = this.getLevelLabel(entry.level);
    const name = entry.name ? `[${entry.name}]` : '';

    let message = entry.message;
    if (this.maxMessageLength > 0 && message.length > this.maxMessageLength) {
      message = message.substring(0, this.maxMessageLength) + '...';
    }

    let output = `${timestamp} ${level} ${name} ${message}`;

    // Add context info if present and enabled
    if (this.showContext && entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join(' ');
      output += ` (${contextStr})`;
    }

    // Add data if present
    if (entry.data !== undefined) {
      const dataStr = typeof entry.data === 'object'
        ? JSON.stringify(entry.data)
        : String(entry.data);
      output += ` | ${dataStr}`;
    }

    // Add duration if present
    if (entry.duration !== undefined) {
      output += ` [${entry.duration}ms]`;
    }

    // Add error stack if present
    if (entry.error && entry.error.stack) {
      output += `\n${entry.error.stack}`;
    }

    return output;
  }
}

/**
 * Color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m'
};

/**
 * Color Formatter - Colored console output
 */
class ColorFormatter extends TextFormatter {
  constructor(options = {}) {
    super(options);
    this.enabled = options.enabled !== false;
    this.levelColors = options.levelColors || {
      error: COLORS.red,
      warn: COLORS.yellow,
      info: COLORS.green,
      debug: COLORS.cyan,
      trace: COLORS.gray
    };
  }

  /**
   * Colorize text
   * @param {string} text - Text to colorize
   * @param {string} color - Color code
   * @returns {string} Colorized text
   */
  colorize(text, color) {
    if (!this.enabled) return text;
    return `${color}${text}${COLORS.reset}`;
  }

  /**
   * Format log entry with colors
   * @param {Object} entry - Log entry
   * @returns {string} Colored formatted string
   */
  format(entry) {
    if (!this.enabled) {
      return super.format(entry);
    }

    const timestamp = this.colorize(
      this.formatTimestamp(entry.timestamp),
      COLORS.gray
    );

    const levelColor = this.levelColors[entry.level] || COLORS.white;
    const level = this.colorize(
      this.getLevelLabel(entry.level),
      levelColor + COLORS.bright
    );

    const name = entry.name
      ? this.colorize(`[${entry.name}]`, COLORS.blue)
      : '';

    let message = entry.message;
    if (this.maxMessageLength > 0 && message.length > this.maxMessageLength) {
      message = message.substring(0, this.maxMessageLength) + '...';
    }

    // Highlight errors in message
    if (entry.level === 'error') {
      message = this.colorize(message, COLORS.red);
    } else if (entry.level === 'warn') {
      message = this.colorize(message, COLORS.yellow);
    }

    let output = `${timestamp} ${level} ${name} ${message}`;

    // Add context info if present
    if (this.showContext && entry.context && Object.keys(entry.context).length > 0) {
      const contextStr = Object.entries(entry.context)
        .map(([k, v]) => {
          const key = this.colorize(k, COLORS.magenta);
          const val = typeof v === 'object' ? JSON.stringify(v) : v;
          return `${key}=${val}`;
        })
        .join(' ');
      output += ` ${this.colorize('(', COLORS.gray)}${contextStr}${this.colorize(')', COLORS.gray)}`;
    }

    // Add data if present
    if (entry.data !== undefined) {
      const dataStr = typeof entry.data === 'object'
        ? JSON.stringify(entry.data)
        : String(entry.data);
      output += this.colorize(` | ${dataStr}`, COLORS.dim);
    }

    // Add duration if present
    if (entry.duration !== undefined) {
      output += this.colorize(` [${entry.duration}ms]`, COLORS.cyan);
    }

    // Add error stack if present
    if (entry.error && entry.error.stack) {
      output += `\n${this.colorize(entry.error.stack, COLORS.red)}`;
    }

    return output;
  }
}

/**
 * Create a formatter by name
 * @param {string} type - Formatter type: 'json', 'text', 'color'
 * @param {Object} options - Formatter options
 * @returns {BaseFormatter} Formatter instance
 */
function createFormatter(type, options = {}) {
  switch (type.toLowerCase()) {
    case 'json':
      return new JSONFormatter(options);
    case 'text':
      return new TextFormatter(options);
    case 'color':
    case 'colored':
      return new ColorFormatter(options);
    default:
      throw new Error(`Unknown formatter type: ${type}`);
  }
}

module.exports = {
  BaseFormatter,
  JSONFormatter,
  TextFormatter,
  ColorFormatter,
  COLORS,
  createFormatter
};

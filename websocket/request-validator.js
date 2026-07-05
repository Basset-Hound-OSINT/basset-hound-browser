/**
 * Basset Hound Browser - WebSocket Request Size Validator
 * Implements per-command request size limits to prevent DoS via large payloads
 *
 * Features:
 * - Configurable global and per-command size limits
 * - Environment variable configuration
 * - Detailed logging and monitoring of rejected requests
 * - Command-based size categorization
 *
 * Version: 1.0.0
 * Created: June 21, 2026
 */

/**
 * Request Size Limits Configuration
 * Default limits (can be overridden via environment variables)
 */
const DEFAULT_LIMITS = {
  // Global maximum payload size (100 MB)
  global: 100 * 1024 * 1024,

  // Per-command category limits
  categories: {
    // Screenshot/capture commands: 100 MB (large image payloads)
    screenshot: 100 * 1024 * 1024,
    capture: 100 * 1024 * 1024,

    // Extraction/parsing commands: 50 MB (large HTML/DOM)
    extraction: 50 * 1024 * 1024,
    analysis: 50 * 1024 * 1024,

    // Default for all other commands: 10 MB
    default: 10 * 1024 * 1024
  }
};

/**
 * Command to category mapping
 * Maps specific commands to their size limit categories
 */
const COMMAND_CATEGORIES = {
  // Screenshot and capture commands
  'screenshot': 'screenshot',
  'capture_screenshot': 'screenshot',
  'screenshot_element': 'screenshot',
  'screenshot_region': 'screenshot',
  'capture_full_page': 'screenshot',
  'capture_viewport': 'screenshot',
  'get_screenshot': 'screenshot',

  // Capture commands
  'capture': 'capture',
  'capture_page': 'capture',
  'capture_element': 'capture',
  'capture_annotations': 'capture',

  // Extraction commands
  'extract': 'extraction',
  'extract_data': 'extraction',
  'extract_html': 'extraction',
  'extract_text': 'extraction',
  'extract_dom_snapshot': 'extraction',
  'use_extraction_template': 'extraction',
  'create_extraction_template': 'extraction',
  'extract_javascript_console': 'extraction',
  'extract_console_logs': 'extraction',
  'capture_html': 'extraction',
  'get_page_html': 'extraction',
  'get_dom_snapshot': 'extraction',

  // Analysis commands
  'analyze': 'analysis',
  'analyze_page': 'analysis',
  'get_forensic_report': 'analysis',
  'correlate_evidence': 'analysis',
  'export_forensic_data': 'analysis'
};

/**
 * Request Size Validator
 * Validates WebSocket message sizes and enforces per-command limits
 */
class RequestSizeValidator {
  constructor(options = {}) {
    this.logger = options.logger || null;
    this.limits = this._initializeLimits(options.limits);
    this.metrics = {
      totalValidated: 0,
      totalRejected: 0,
      rejectionsByCommand: {},
      rejectionsBySize: {
        small: 0,    // < 1 MB
        medium: 0,   // 1 MB - 10 MB
        large: 0,    // 10 MB - 50 MB
        xlarge: 0,   // 50 MB - 100 MB
        massive: 0   // > 100 MB
      }
    };
    this.rejectedRequests = [];
  }

  /**
   * Initialize size limits from options and environment variables
   * @private
   * @param {Object} customLimits - Custom limit overrides
   * @returns {Object} Merged limits configuration
   */
  _initializeLimits(customLimits = {}) {
    const limits = JSON.parse(JSON.stringify(DEFAULT_LIMITS)); // Deep copy

    // Override from environment variables
    if (process.env.BASSET_WS_MAX_PAYLOAD) {
      const globalLimit = this._parseSize(process.env.BASSET_WS_MAX_PAYLOAD);
      if (globalLimit > 0) {
        limits.global = globalLimit;
      }
    }

    if (process.env.BASSET_WS_MAX_SCREENSHOT) {
      const screenshotLimit = this._parseSize(process.env.BASSET_WS_MAX_SCREENSHOT);
      if (screenshotLimit > 0) {
        limits.categories.screenshot = screenshotLimit;
        limits.categories.capture = screenshotLimit;
      }
    }

    if (process.env.BASSET_WS_MAX_EXTRACTION) {
      const extractionLimit = this._parseSize(process.env.BASSET_WS_MAX_EXTRACTION);
      if (extractionLimit > 0) {
        limits.categories.extraction = extractionLimit;
        limits.categories.analysis = extractionLimit;
      }
    }

    if (process.env.BASSET_WS_MAX_DEFAULT) {
      const defaultLimit = this._parseSize(process.env.BASSET_WS_MAX_DEFAULT);
      if (defaultLimit > 0) {
        limits.categories.default = defaultLimit;
      }
    }

    // Apply custom limits (highest priority)
    if (customLimits && customLimits.global) {
      limits.global = customLimits.global;
    }
    if (customLimits && customLimits.categories) {
      Object.assign(limits.categories, customLimits.categories);
    }

    return limits;
  }

  /**
   * Parse size string (e.g., "10MB", "1GB") to bytes
   * @private
   * @param {string|number} size - Size string or number
   * @returns {number} Size in bytes
   */
  _parseSize(size) {
    if (typeof size === 'number') {
      return size;
    }

    if (typeof size !== 'string') {
      return 0;
    }

    const match = size.match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?$/i);
    if (!match) {
      return 0;
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'b').toLowerCase();

    const multipliers = {
      b: 1,
      kb: 1024,
      mb: 1024 ** 2,
      gb: 1024 ** 3,
      tb: 1024 ** 4
    };

    return Math.floor(value * (multipliers[unit] || 1));
  }

  /**
   * Get the category for a command
   * @private
   * @param {string} command - Command name
   * @returns {string} Category name (default: 'default')
   */
  _getCommandCategory(command) {
    return COMMAND_CATEGORIES[command] || 'default';
  }

  /**
   * Get the size limit for a specific command
   * @param {string} command - Command name
   * @returns {number} Size limit in bytes
   */
  getLimitForCommand(command) {
    const category = this._getCommandCategory(command);
    return this.limits.categories[category] || this.limits.categories.default;
  }

  /**
   * Categorize request size for metrics
   * @private
   * @param {number} sizeBytes - Size in bytes
   * @returns {string} Size category
   */
  _categorizeSizeForMetrics(sizeBytes) {
    const mb = sizeBytes / (1024 ** 2);
    if (mb < 1) return 'small';
    if (mb < 10) return 'medium';
    if (mb < 50) return 'large';
    if (mb < 100) return 'xlarge';
    return 'massive';
  }

  /**
   * Validate a WebSocket message size
   * @param {Buffer|string} message - WebSocket message
   * @param {string} command - Command name (optional)
   * @returns {Object} Validation result { valid: boolean, error?: string, errorCode?: string }
   */
  validateMessageSize(message, command = 'unknown') {
    // Calculate message size
    const sizeBytes = typeof message === 'string'
      ? Buffer.byteLength(message, 'utf8')
      : message.length;

    this.metrics.totalValidated++;

    // Check global limit
    if (sizeBytes > this.limits.global) {
      return this._rejectRequest(
        sizeBytes,
        command,
        'PAYLOAD_TOO_LARGE',
        `Request size ${this._formatBytes(sizeBytes)} exceeds global limit of ${this._formatBytes(this.limits.global)}`
      );
    }

    // Check command-specific limit
    const commandLimit = this.getLimitForCommand(command);
    if (sizeBytes > commandLimit) {
      return this._rejectRequest(
        sizeBytes,
        command,
        'COMMAND_PAYLOAD_TOO_LARGE',
        `Request size ${this._formatBytes(sizeBytes)} exceeds limit for '${command}' command (${this._formatBytes(commandLimit)})`
      );
    }

    return { valid: true };
  }

  /**
   * Handle rejected request
   * @private
   * @param {number} sizeBytes - Size in bytes
   * @param {string} command - Command name
   * @param {string} errorCode - Error code
   * @param {string} message - Error message
   * @returns {Object} Rejection result
   */
  _rejectRequest(sizeBytes, command, errorCode, message) {
    this.metrics.totalRejected++;

    // Update command rejection metrics
    if (!this.metrics.rejectionsByCommand[command]) {
      this.metrics.rejectionsByCommand[command] = 0;
    }
    this.metrics.rejectionsByCommand[command]++;

    // Update size category metrics
    const sizeCategory = this._categorizeSizeForMetrics(sizeBytes);
    this.metrics.rejectionsBySize[sizeCategory]++;

    // Log rejected request
    const rejection = {
      timestamp: new Date().toISOString(),
      command,
      sizeBytes,
      sizeFormatted: this._formatBytes(sizeBytes),
      errorCode,
      message
    };

    this.rejectedRequests.push(rejection);

    // Keep only last 100 rejected requests
    if (this.rejectedRequests.length > 100) {
      this.rejectedRequests = this.rejectedRequests.slice(-100);
    }

    // Log to logger if available
    this._log('warn', `Size validation rejected: ${message} (${errorCode})`);

    return {
      valid: false,
      errorCode,
      error: message
    };
  }

  /**
   * Format bytes to human-readable string
   * @private
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted size
   */
  _formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get validation metrics
   * @returns {Object} Validation metrics
   */
  getMetrics() {
    return {
      totalValidated: this.metrics.totalValidated,
      totalRejected: this.metrics.totalRejected,
      rejectionRate: this.metrics.totalValidated > 0
        ? ((this.metrics.totalRejected / this.metrics.totalValidated) * 100).toFixed(2) + '%'
        : '0%',
      rejectionsByCommand: this.metrics.rejectionsByCommand,
      rejectionsBySize: this.metrics.rejectionsBySize,
      recentRejections: this.rejectedRequests.slice(-10)
    };
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration details
   */
  getConfiguration() {
    return {
      global: {
        limit: this._formatBytes(this.limits.global)
      },
      categories: Object.entries(this.limits.categories).reduce((acc, [key, value]) => {
        acc[key] = this._formatBytes(value);
        return acc;
      }, {}),
      commands: COMMAND_CATEGORIES
    };
  }

  /**
   * Internal logging
   * @private
   */
  _log(level, message) {
    if (this.logger) {
      this.logger[level](`[Request Size Validator] ${message}`);
    }
  }
}

module.exports = {
  RequestSizeValidator,
  DEFAULT_LIMITS,
  COMMAND_CATEGORIES
};

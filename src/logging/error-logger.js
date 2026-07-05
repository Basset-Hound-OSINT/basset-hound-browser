/**
 * Basset Hound Browser - Error Logging Framework
 * Structured logging, error categorization, and alerting system
 *
 * Features:
 * - Hierarchical error categorization (networking, authentication, parsing, etc.)
 * - Automatic error fingerprinting for deduplication
 * - Alert thresholds and cascading severity levels
 * - Structured context and correlation IDs
 * - Integration with performance profiling
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

// ==========================================
// Error Categories and Severity Levels
// ==========================================

/**
 * Error categories for structured classification
 */
const ERROR_CATEGORIES = {
  // Network-related errors
  NETWORK: 'network',
  CONNECTION: 'connection',
  TIMEOUT: 'timeout',

  // Authentication and security
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  SECURITY: 'security',

  // Data and parsing
  PARSING: 'parsing',
  VALIDATION: 'validation',
  SERIALIZATION: 'serialization',

  // System and resource
  MEMORY: 'memory',
  RESOURCE: 'resource',
  SYSTEM: 'system',

  // Application logic
  LOGIC: 'logic',
  STATE: 'state',
  CONFIGURATION: 'configuration',

  // Bot detection and evasion
  DETECTION: 'detection',
  EVASION: 'evasion',
  FINGERPRINTING: 'fingerprinting',

  // Unknown/uncategorized
  UNKNOWN: 'unknown'
};

/**
 * Severity levels for alerts and monitoring
 */
const SEVERITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Error occurrence thresholds for escalation
 */
const ALERT_THRESHOLDS = {
  LOW: { count: 100, timeWindow: 3600000 }, // 100 errors in 1 hour
  MEDIUM: { count: 50, timeWindow: 600000 }, // 50 errors in 10 minutes
  HIGH: { count: 20, timeWindow: 60000 }, // 20 errors in 1 minute
  CRITICAL: { count: 5, timeWindow: 10000 } // 5 errors in 10 seconds
};

// ==========================================
// Error Classification Rules
// ==========================================

/**
 * Rules for automatic error classification
 */
const CLASSIFICATION_RULES = [
  {
    category: ERROR_CATEGORIES.NETWORK,
    patterns: ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'network'],
    severity: SEVERITY_LEVELS.MEDIUM
  },
  {
    category: ERROR_CATEGORIES.TIMEOUT,
    patterns: ['ETIMEDOUT', 'timeout', 'deadline exceeded'],
    severity: SEVERITY_LEVELS.MEDIUM
  },
  {
    category: ERROR_CATEGORIES.AUTHENTICATION,
    patterns: ['401', 'unauthorized', 'invalid credentials', 'auth'],
    severity: SEVERITY_LEVELS.HIGH
  },
  {
    category: ERROR_CATEGORIES.PARSING,
    patterns: ['JSON', 'parse error', 'syntax error', 'malformed'],
    severity: SEVERITY_LEVELS.LOW
  },
  {
    category: ERROR_CATEGORIES.MEMORY,
    patterns: ['memory', 'out of memory', 'heap', 'allocation failed'],
    severity: SEVERITY_LEVELS.CRITICAL
  },
  {
    category: ERROR_CATEGORIES.DETECTION,
    patterns: ['detected', 'cloudflare', 'recaptcha', 'challenge'],
    severity: SEVERITY_LEVELS.HIGH
  },
  {
    category: ERROR_CATEGORIES.FINGERPRINTING,
    patterns: ['fingerprint', 'canvas', 'webgl', 'spoof'],
    severity: SEVERITY_LEVELS.MEDIUM
  }
];

// ==========================================
// Error Fingerprinting
// ==========================================

/**
 * Generate a fingerprint for an error for deduplication
 * @param {Error|Object} error - The error object
 * @returns {string} Error fingerprint
 */
function generateErrorFingerprint(error) {
  const parts = [];

  if (error instanceof Error) {
    parts.push(error.name);
    parts.push(error.message);

    // Extract first few lines of stack trace for more precise matching
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      parts.push(...stackLines);
    }
  } else if (typeof error === 'string') {
    parts.push(error);
  } else if (error && typeof error === 'object') {
    parts.push(error.message || JSON.stringify(error));
  }

  // Create hash-like fingerprint
  const combined = parts.join('|');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `fp_${Math.abs(hash).toString(16)}`;
}

// ==========================================
// Error Logger Class
// ==========================================

/**
 * ErrorLogger - Main error logging and alerting system
 */
class ErrorLogger extends EventEmitter {
  /**
   * Create a new ErrorLogger instance
   * @param {Object} options - Configuration options
   * @param {Logger} options.logger - Base logger instance for output
   * @param {string} options.name - Logger name
   * @param {Object} options.alertTargets - Alert notification targets
   * @param {Function} options.alertTargets.email - Email alert function
   * @param {Function} options.alertTargets.webhook - Webhook alert function
   * @param {Function} options.alertTargets.slack - Slack alert function
   * @param {number} options.deduplicationWindow - Time window for error deduplication (ms)
   */
  constructor(options = {}) {
    super();

    this.logger = options.logger;
    this.name = options.name || 'error-logger';
    this.alertTargets = options.alertTargets || {};
    this.deduplicationWindow = options.deduplicationWindow || 60000; // 1 minute default

    // Error tracking
    this.errorHistory = [];
    this.errorFingerprints = new Map(); // fingerprint -> { lastSeen, count }
    this.categoryStats = {};
    this.severityStats = {};

    // Categorization rules
    this.classificationRules = CLASSIFICATION_RULES;

    // Alert state tracking
    this.activeAlerts = new Map(); // fingerprint -> alert object
    this.alertCooldown = 300000; // 5 minutes between duplicate alerts

    // Configuration
    this.enabled = options.enabled !== false;
    this.maxHistorySize = options.maxHistorySize || 10000;
    this.enableDeduplication = options.enableDeduplication !== false;
  }

  /**
   * Classify an error into a category
   * @param {Error|string} error - The error to classify
   * @param {Object} context - Additional context
   * @returns {Object} Classification result
   */
  classifyError(error, context = {}) {
    const errorString = this._errorToString(error).toLowerCase();
    const matched = null;
    let bestMatch = null;
    let bestPatternLength = 0;

    // Find the best matching rule
    for (const rule of this.classificationRules) {
      for (const pattern of rule.patterns) {
        if (errorString.includes(pattern.toLowerCase())) {
          if (pattern.length > bestPatternLength) {
            bestMatch = rule;
            bestPatternLength = pattern.length;
          }
        }
      }
    }

    return {
      category: bestMatch?.category || ERROR_CATEGORIES.UNKNOWN,
      severity: bestMatch?.severity || SEVERITY_LEVELS.LOW,
      matched: bestMatch ? true : false
    };
  }

  /**
   * Log an error with context and categorization
   * @param {Error|string} error - The error
   * @param {Object} context - Error context
   * @param {string} context.operation - Operation that failed
   * @param {string} context.correlationId - Request correlation ID
   * @param {Object} context.metadata - Additional metadata
   * @returns {Object} Error log entry
   */
  logError(error, context = {}) {
    if (!this.enabled) {
      return null;
    }

    const timestamp = Date.now();
    const fingerprint = generateErrorFingerprint(error);
    const classification = this.classifyError(error, context);

    // Check deduplication window
    if (this.enableDeduplication && this.errorFingerprints.has(fingerprint)) {
      const cached = this.errorFingerprints.get(fingerprint);
      if (timestamp - cached.lastSeen < this.deduplicationWindow) {
        cached.count++;
        cached.lastSeen = timestamp;

        // Log as debug only (duplicate)
        if (this.logger) {
          this.logger.debug(`[Duplicate Error] ${classification.category}`, {
            fingerprint,
            count: cached.count,
            error: error instanceof Error ? error.message : error
          });
        }

        return null; // Don't process duplicates fully
      }
    }

    // Create error entry
    const entry = {
      id: this._generateId(),
      timestamp,
      fingerprint,
      error: {
        name: error instanceof Error ? error.name : 'Error',
        message: this._errorToString(error),
        stack: error instanceof Error ? error.stack : null
      },
      classification,
      context: {
        operation: context.operation || 'unknown',
        correlationId: context.correlationId || null,
        metadata: context.metadata || {}
      }
    };

    // Update tracking
    this._updateErrorFingerprint(fingerprint, timestamp);
    this._updateCategoryStats(classification.category);
    this._updateSeverityStats(classification.severity);
    this._addToHistory(entry);

    // Log to base logger
    if (this.logger) {
      this.logger.error(
        `[${classification.category.toUpperCase()}] ${entry.error.message}`,
        {
          fingerprint,
          severity: classification.severity,
          operation: context.operation,
          correlationId: context.correlationId,
          metadata: context.metadata,
          stack: entry.error.stack
        }
      );
    }

    // Check for alert conditions
    this._checkAlertConditions(entry);

    // Emit event
    this.emit('error', entry);

    return entry;
  }

  /**
   * Log a warning that may escalate to an error
   * @param {string} message - Warning message
   * @param {Object} context - Warning context
   * @returns {Object} Warning entry
   */
  logWarning(message, context = {}) {
    if (!this.enabled) {
      return null;
    }

    const entry = {
      id: this._generateId(),
      timestamp: Date.now(),
      level: 'warning',
      message,
      context: {
        operation: context.operation || 'unknown',
        correlationId: context.correlationId || null,
        metadata: context.metadata || {}
      }
    };

    if (this.logger) {
      this.logger.warn(message, {
        operation: context.operation,
        correlationId: context.correlationId,
        ...context.metadata
      });
    }

    this.emit('warning', entry);
    return entry;
  }

  /**
   * Check and trigger alerts based on error patterns
   * @param {Object} entry - Error entry
   * @private
   */
  _checkAlertConditions(entry) {
    const { fingerprint, classification } = entry;
    const now = Date.now();

    // Get recent errors with same fingerprint
    const recentCount = this.errorHistory.filter(
      e => e.fingerprint === fingerprint &&
           now - e.timestamp < ALERT_THRESHOLDS.LOW.timeWindow
    ).length;

    // Determine alert level based on severity and frequency
    let shouldAlert = false;
    let alertLevel = null;

    if (classification.severity === SEVERITY_LEVELS.CRITICAL) {
      shouldAlert = true;
      alertLevel = SEVERITY_LEVELS.CRITICAL;
    } else if (
      classification.severity === SEVERITY_LEVELS.HIGH &&
      recentCount >= ALERT_THRESHOLDS.CRITICAL.count
    ) {
      shouldAlert = true;
      alertLevel = SEVERITY_LEVELS.HIGH;
    } else if (
      classification.severity === SEVERITY_LEVELS.MEDIUM &&
      recentCount >= ALERT_THRESHOLDS.HIGH.count
    ) {
      shouldAlert = true;
      alertLevel = SEVERITY_LEVELS.MEDIUM;
    }

    if (shouldAlert && this._shouldSendAlert(fingerprint)) {
      this._sendAlert({
        id: entry.id,
        fingerprint,
        level: alertLevel,
        category: classification.category,
        message: entry.error.message,
        count: recentCount,
        timestamp: now,
        context: entry.context
      });
    }
  }

  /**
   * Check if alert should be sent (cooldown check)
   * @param {string} fingerprint - Error fingerprint
   * @returns {boolean}
   * @private
   */
  _shouldSendAlert(fingerprint) {
    const alert = this.activeAlerts.get(fingerprint);
    if (!alert) {
      return true;
    }

    return Date.now() - alert.timestamp > this.alertCooldown;
  }

  /**
   * Send alert to configured targets
   * @param {Object} alert - Alert data
   * @private
   */
  _sendAlert(alert) {
    // Update active alerts tracking
    this.activeAlerts.set(alert.fingerprint, {
      timestamp: alert.timestamp,
      level: alert.level
    });

    // Format alert message
    const message = this._formatAlertMessage(alert);

    // Send to configured targets
    if (this.alertTargets.email && alert.level === SEVERITY_LEVELS.CRITICAL) {
      try {
        this.alertTargets.email(message, alert);
      } catch (err) {
        if (this.logger) {
          this.logger.error('Failed to send email alert', err);
        }
      }
    }

    if (this.alertTargets.webhook) {
      try {
        this.alertTargets.webhook(alert);
      } catch (err) {
        if (this.logger) {
          this.logger.error('Failed to send webhook alert', err);
        }
      }
    }

    if (this.alertTargets.slack && alert.level !== SEVERITY_LEVELS.LOW) {
      try {
        this.alertTargets.slack(message, alert);
      } catch (err) {
        if (this.logger) {
          this.logger.error('Failed to send Slack alert', err);
        }
      }
    }

    this.emit('alert', alert);
  }

  /**
   * Format alert message for notification
   * @param {Object} alert - Alert data
   * @returns {string} Formatted message
   * @private
   */
  _formatAlertMessage(alert) {
    return `
[${alert.level.toUpperCase()}] Error Alert
Category: ${alert.category}
Message: ${alert.message}
Occurrences: ${alert.count}
Time: ${new Date(alert.timestamp).toISOString()}
Operation: ${alert.context.operation}
${alert.context.correlationId ? `Correlation ID: ${alert.context.correlationId}` : ''}
    `.trim();
  }

  /**
   * Get error statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      total: this.errorHistory.length,
      byCategory: { ...this.categoryStats },
      bySeverity: { ...this.severityStats },
      topFingerprints: this._getTopFingerprints(10),
      activeAlerts: this.activeAlerts.size,
      deduplicationWindow: this.deduplicationWindow
    };
  }

  /**
   * Get top error fingerprints by occurrence
   * @param {number} limit - Number of results to return
   * @returns {Array} Top fingerprints with counts
   * @private
   */
  _getTopFingerprints(limit = 10) {
    return Array.from(this.errorFingerprints.entries())
      .map(([fp, data]) => ({ fingerprint: fp, count: data.count, lastSeen: data.lastSeen }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get recent errors
   * @param {number} limit - Number of recent errors to return
   * @param {Object} filters - Filter options
   * @returns {Array} Recent error entries
   */
  getRecent(limit = 50, filters = {}) {
    let results = [...this.errorHistory];

    if (filters.category) {
      results = results.filter(e => e.classification.category === filters.category);
    }

    if (filters.severity) {
      results = results.filter(e => e.classification.severity === filters.severity);
    }

    if (filters.operation) {
      results = results.filter(e => e.context.operation === filters.operation);
    }

    if (filters.since) {
      results = results.filter(e => e.timestamp >= filters.since);
    }

    return results.reverse().slice(0, limit);
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this.errorHistory = [];
    this.errorFingerprints.clear();
    this.categoryStats = {};
    this.severityStats = {};
  }

  /**
   * Export error log for analysis
   * @param {string} filePath - Output file path
   * @param {Object} options - Export options
   * @returns {boolean} Success status
   */
  exportLogs(filePath, options = {}) {
    try {
      const data = {
        exported: new Date().toISOString(),
        stats: this.getStats(),
        history: options.includeHistory !== false ? this.errorHistory : [],
        activeAlerts: Array.from(this.activeAlerts.entries())
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

      if (this.logger) {
        this.logger.info(`Error logs exported to ${filePath}`, { entries: this.errorHistory.length });
      }

      return true;
    } catch (err) {
      if (this.logger) {
        this.logger.error('Failed to export error logs', err);
      }
      return false;
    }
  }

  /**
   * Enable/disable logging
   * @param {boolean} enabled - Enable state
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Add custom classification rule
   * @param {Object} rule - Rule object with category, patterns, severity
   */
  addClassificationRule(rule) {
    if (rule.category && rule.patterns && rule.severity) {
      this.classificationRules.push(rule);
    }
  }

  /**
   * Update alert targets
   * @param {Object} targets - Alert target functions
   */
  setAlertTargets(targets) {
    this.alertTargets = { ...this.alertTargets, ...targets };
  }

  // ==========================================
  // Private Helper Methods
  // ==========================================

  /**
   * Convert error to string representation
   * @param {Error|string} error - The error
   * @returns {string}
   * @private
   */
  _errorToString(error) {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error || 'Unknown error');
  }

  /**
   * Generate unique error ID
   * @returns {string}
   * @private
   */
  _generateId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update error fingerprint tracking
   * @param {string} fingerprint - Error fingerprint
   * @param {number} timestamp - Current timestamp
   * @private
   */
  _updateErrorFingerprint(fingerprint, timestamp) {
    if (this.errorFingerprints.has(fingerprint)) {
      const data = this.errorFingerprints.get(fingerprint);
      data.count++;
      data.lastSeen = timestamp;
    } else {
      this.errorFingerprints.set(fingerprint, { count: 1, lastSeen: timestamp });
    }
  }

  /**
   * Update category statistics
   * @param {string} category - Error category
   * @private
   */
  _updateCategoryStats(category) {
    this.categoryStats[category] = (this.categoryStats[category] || 0) + 1;
  }

  /**
   * Update severity statistics
   * @param {string} severity - Error severity
   * @private
   */
  _updateSeverityStats(severity) {
    this.severityStats[severity] = (this.severityStats[severity] || 0) + 1;
  }

  /**
   * Add entry to history with size limit
   * @param {Object} entry - Error entry
   * @private
   */
  _addToHistory(entry) {
    this.errorHistory.push(entry);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }
}

// ==========================================
// Factory Function
// ==========================================

/**
 * Create an ErrorLogger instance
 * @param {Object} options - Configuration options
 * @returns {ErrorLogger}
 */
function createErrorLogger(options = {}) {
  return new ErrorLogger(options);
}

// ==========================================
// Exports
// ==========================================

module.exports = {
  ErrorLogger,
  createErrorLogger,
  ERROR_CATEGORIES,
  SEVERITY_LEVELS,
  ALERT_THRESHOLDS,
  CLASSIFICATION_RULES,
  generateErrorFingerprint
};

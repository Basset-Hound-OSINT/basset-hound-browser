/**
 * Error Tracing for Basset Hound Browser
 *
 * Provides:
 * - Full error context capture
 * - Stack trace correlation
 * - Error pattern detection
 * - Root cause analysis
 *
 * Features:
 * - Comprehensive error logging
 * - Stack trace unwinding
 * - Error tree building
 * - Causality analysis
 * - Error metrics and trends
 */

const EventEmitter = require('events');

class ErrorTracer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      captureStackTrace: options.captureStackTrace !== false,
      captureLocalVariables: options.captureLocalVariables || false,
      maxStackDepth: options.maxStackDepth || 20,
      errorContextSize: options.errorContextSize || 5000,
      enableErrorPatterns: options.enableErrorPatterns !== false,
      enableCausality: options.enableCausality !== false,
      ...options
    };

    this.errors = new Map();
    this.errorTrees = new Map();
    this.errorPatterns = new Map();
    this.errorChains = new Map();
    this.stackTraces = new Map();
    this.errorCausalityGraph = new Map();
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsBySeverity: new Map(),
      errorsBySpan: new Map()
    };
  }

  /**
   * Trace an error with full context
   */
  traceError(spanId, errorData) {
    const error = {
      errorId: this._generateErrorId(),
      spanId,
      timestamp: Date.now(),
      errorType: errorData.errorType || 'unknown',
      errorMessage: errorData.errorMessage || errorData.message || '',
      errorCode: errorData.errorCode || null,
      severity: errorData.severity || 'error', // critical, error, warning, info
      status: errorData.status || 'unresolved', // unresolved, investigating, resolved, ignored
      component: errorData.component || null,
      service: errorData.service || null,
      userId: errorData.userId || null,
      userSessionId: errorData.userSessionId || null,
      requestId: errorData.requestId || null,
      correlationId: errorData.correlationId || null,
      stackTrace: errorData.stackTrace || this._captureStackTrace(new Error()),
      context: {
        spanContext: errorData.spanContext || {},
        userContext: errorData.userContext || {},
        systemContext: errorData.systemContext || {},
        debugInfo: errorData.debugInfo || {}
      },
      reproduction: {
        inputs: errorData.inputs || {},
        preconditions: errorData.preconditions || [],
        steps: errorData.steps || []
      },
      impact: {
        affectedSystems: new Set(errorData.affectedSystems || []),
        affectedUsers: new Set(errorData.affectedUsers || []),
        dataCorruption: errorData.dataCorruption || false,
        downtime: errorData.downtime || 0
      },
      relatedErrors: new Set(),
      parentErrorId: errorData.parentErrorId || null,
      childErrors: new Set(),
      retryAttempts: 0,
      retryAttempt: errorData.retryAttempt || 0,
      maxRetries: errorData.maxRetries || 0,
      recovered: false,
      recoveryTime: null
    };

    this.errors.set(error.errorId, error);
    this._updateErrorMetrics(error);

    // Track error tree
    if (error.parentErrorId) {
      const parentError = this.errors.get(error.parentErrorId);
      if (parentError) {
        parentError.childErrors.add(error.errorId);
        this._buildErrorTree(error.parentErrorId);
      }
    } else {
      this._buildErrorTree(error.errorId);
    }

    // Detect patterns
    if (this.options.enableErrorPatterns) {
      this._detectErrorPatterns(error);
    }

    // Analyze causality
    if (this.options.enableCausality) {
      this._analyzeCausality(error);
    }

    this.emit('error:traced', {
      errorId: error.errorId,
      errorType: error.errorType,
      severity: error.severity,
      spanId
    });

    return error;
  }

  /**
   * Record error recovery attempt
   */
  recordRecoveryAttempt(errorId, recoveryData) {
    const error = this.errors.get(errorId);
    if (!error) {
      throw new Error(`Error ${errorId} not found`);
    }

    const attempt = {
      attemptNumber: error.retryAttempts + 1,
      timestamp: Date.now(),
      strategy: recoveryData.strategy || 'retry', // retry, fallback, circuit_break, manual_intervention
      action: recoveryData.action || null,
      parameters: recoveryData.parameters || {},
      successful: recoveryData.successful === true,
      timeTaken: recoveryData.timeTaken || 0,
      result: recoveryData.result || null,
      failureReason: recoveryData.failureReason || null
    };

    error.retryAttempts++;

    if (attempt.successful) {
      error.recovered = true;
      error.recoveryTime = attempt.timeTaken;
      error.status = 'resolved';
    } else if (error.retryAttempts >= error.maxRetries) {
      error.status = 'exhausted';
    }

    if (!error.recoveryAttempts) {
      error.recoveryAttempts = [];
    }
    error.recoveryAttempts.push(attempt);

    this.emit('recovery:attempted', {
      errorId,
      attemptNumber: attempt.attemptNumber,
      successful: attempt.successful,
      strategy: attempt.strategy
    });

    return {
      errorId,
      attempt,
      error
    };
  }

  /**
   * Get error details with full context
   */
  getErrorDetails(errorId) {
    const error = this.errors.get(errorId);
    if (!error) {
      return null;
    }

    const details = {
      errorId: error.errorId,
      timestamp: error.timestamp,
      errorType: error.errorType,
      errorMessage: error.errorMessage,
      errorCode: error.errorCode,
      severity: error.severity,
      status: error.status,
      component: error.component,
      spanId: error.spanId,
      stackTrace: this._formatStackTrace(error.stackTrace),
      context: error.context,
      reproduction: error.reproduction,
      impact: {
        affectedSystems: Array.from(error.impact.affectedSystems),
        affectedUsers: Array.from(error.impact.affectedUsers),
        dataCorruption: error.impact.dataCorruption,
        downtime: error.impact.downtime
      },
      recovery: {
        recovered: error.recovered,
        recoveryTime: error.recoveryTime,
        attempts: error.recoveryAttempts || []
      },
      relatedErrors: Array.from(error.relatedErrors),
      parentErrorId: error.parentErrorId,
      childErrors: Array.from(error.childErrors)
    };

    return details;
  }

  /**
   * Get error tree for error
   */
  getErrorTree(errorId) {
    return this.errorTrees.get(errorId) || null;
  }

  /**
   * Build error causality analysis
   */
  getErrorCausality(errorId) {
    const causality = this.errorCausalityGraph.get(errorId);
    if (!causality) {
      return null;
    }

    return {
      errorId,
      rootCause: causality.rootCause,
      causalChain: causality.chain,
      contributingFactors: causality.factors,
      confidence: causality.confidence,
      analysis: causality.analysis
    };
  }

  /**
   * Find related errors
   */
  findRelatedErrors(errorData) {
    const relatedErrors = [];
    const criteria = {
      errorType: errorData.errorType || null,
      errorCode: errorData.errorCode || null,
      component: errorData.component || null,
      severity: errorData.severity || null,
      timeWindow: errorData.timeWindow || 300000 // 5 minutes
    };

    const now = Date.now();

    for (const [errorId, error] of this.errors) {
      let matches = 0;
      let totalCriteria = 0;

      if (criteria.errorType) {
        totalCriteria++;
        if (error.errorType === criteria.errorType) matches++;
      }

      if (criteria.errorCode) {
        totalCriteria++;
        if (error.errorCode === criteria.errorCode) matches++;
      }

      if (criteria.component) {
        totalCriteria++;
        if (error.component === criteria.component) matches++;
      }

      if (criteria.severity) {
        totalCriteria++;
        if (error.severity === criteria.severity) matches++;
      }

      if (criteria.timeWindow && (now - error.timestamp) < criteria.timeWindow) {
        matches++;
        totalCriteria++;
      }

      if (totalCriteria > 0 && matches / totalCriteria >= 0.5) {
        relatedErrors.push({
          errorId,
          matchScore: matches / totalCriteria,
          error: {
            errorType: error.errorType,
            errorMessage: error.errorMessage,
            timestamp: error.timestamp,
            component: error.component
          }
        });
      }
    }

    relatedErrors.sort((a, b) => b.matchScore - a.matchScore);
    return relatedErrors;
  }

  /**
   * Get error metrics
   */
  getErrorMetrics() {
    return {
      totalErrors: this.errorMetrics.totalErrors,
      errorsByType: Object.fromEntries(this.errorMetrics.errorsByType),
      errorsBySeverity: Object.fromEntries(this.errorMetrics.errorsBySeverity),
      errorsBySpan: Object.fromEntries(this.errorMetrics.errorsBySpan),
      errorPatterns: Array.from(this.errorPatterns.values()),
      errorChains: Array.from(this.errorChains.values()),
      resolvedErrors: Array.from(this.errors.values()).filter(e => e.status === 'resolved').length,
      unresolvedErrors: Array.from(this.errors.values()).filter(e => e.status === 'unresolved').length,
      criticalErrors: Array.from(this.errors.values()).filter(e => e.severity === 'critical').length
    };
  }

  /**
   * Get error timeline
   */
  getErrorTimeline(options = {}) {
    const startTime = options.startTime || Date.now() - 3600000; // 1 hour default
    const endTime = options.endTime || Date.now();
    const groupBy = options.groupBy || 'hour'; // hour, day, minute

    const errors = Array.from(this.errors.values())
      .filter(e => e.timestamp >= startTime && e.timestamp <= endTime);

    const timeline = {};

    errors.forEach(error => {
      const key = this._getTimeKey(error.timestamp, groupBy);
      if (!timeline[key]) {
        timeline[key] = {
          timestamp: key,
          count: 0,
          errorTypes: new Set(),
          severities: new Set(),
          bySeverity: {}
        };
      }

      timeline[key].count++;
      timeline[key].errorTypes.add(error.errorType);
      timeline[key].severities.add(error.severity);

      if (!timeline[key].bySeverity[error.severity]) {
        timeline[key].bySeverity[error.severity] = 0;
      }
      timeline[key].bySeverity[error.severity]++;
    });

    // Convert Sets to Arrays
    Object.keys(timeline).forEach(key => {
      timeline[key].errorTypes = Array.from(timeline[key].errorTypes);
      timeline[key].severities = Array.from(timeline[key].severities);
    });

    return timeline;
  }

  /**
   * Capture stack trace
   */
  _captureStackTrace(err) {
    const stack = err.stack || '';
    const lines = stack.split('\n');
    const trace = lines
      .slice(0, this.options.maxStackDepth)
      .map(line => line.trim());

    return trace;
  }

  /**
   * Format stack trace
   */
  _formatStackTrace(stackTrace) {
    if (Array.isArray(stackTrace)) {
      return stackTrace.join('\n');
    }
    return stackTrace;
  }

  /**
   * Generate error ID
   */
  _generateErrorId() {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update error metrics
   */
  _updateErrorMetrics(error) {
    this.errorMetrics.totalErrors++;

    const typeKey = error.errorType;
    const typeCount = (this.errorMetrics.errorsByType.get(typeKey) || 0) + 1;
    this.errorMetrics.errorsByType.set(typeKey, typeCount);

    const sevKey = error.severity;
    const sevCount = (this.errorMetrics.errorsBySeverity.get(sevKey) || 0) + 1;
    this.errorMetrics.errorsBySeverity.set(sevKey, sevCount);

    const spanKey = error.spanId;
    const spanCount = (this.errorMetrics.errorsBySpan.get(spanKey) || 0) + 1;
    this.errorMetrics.errorsBySpan.set(spanKey, spanCount);
  }

  /**
   * Build error tree
   */
  _buildErrorTree(errorId) {
    const error = this.errors.get(errorId);
    if (!error) return;

    const tree = {
      errorId,
      errorType: error.errorType,
      severity: error.severity,
      timestamp: error.timestamp,
      children: Array.from(error.childErrors).map(childId => this._buildErrorTree(childId))
    };

    this.errorTrees.set(errorId, tree);
  }

  /**
   * Detect error patterns
   */
  _detectErrorPatterns(error) {
    // Look for similar errors in recent history
    const recentErrors = Array.from(this.errors.values())
      .filter(e => e.errorType === error.errorType && (Date.now() - e.timestamp) < 300000)
      .sort((a, b) => b.timestamp - a.timestamp);

    if (recentErrors.length > 2) {
      const patternId = `pattern-${error.errorType}-${Math.random().toString(36).substr(2, 9)}`;
      const pattern = {
        patternId,
        errorType: error.errorType,
        occurrences: recentErrors.length,
        timeSpan: recentErrors[0].timestamp - recentErrors[recentErrors.length - 1].timestamp,
        affectedSpans: new Set(recentErrors.map(e => e.spanId)),
        affectedComponents: new Set(recentErrors.map(e => e.component).filter(c => c)),
        severity: error.severity,
        pattern: 'recurring_error',
        firstOccurrence: recentErrors[recentErrors.length - 1].timestamp,
        lastOccurrence: recentErrors[0].timestamp
      };

      this.errorPatterns.set(patternId, pattern);

      this.emit('pattern:detected', {
        patternId,
        errorType: error.errorType,
        occurrences: recentErrors.length
      });
    }
  }

  /**
   * Analyze error causality
   */
  _analyzeCausality(error) {
    const related = this.findRelatedErrors({
      component: error.component,
      timeWindow: 600000 // 10 minutes
    });

    if (related.length > 0) {
      const causality = {
        errorId: error.errorId,
        rootCause: related[0].errorId,
        chain: [error.errorId, ...related.map(e => e.errorId)],
        factors: [
          'temporal_correlation',
          'component_correlation',
          'pattern_matching'
        ],
        confidence: Math.min(0.95, 0.5 + (related.length * 0.1)),
        analysis: `Found ${related.length} related errors with similar characteristics`
      };

      this.errorCausalityGraph.set(error.errorId, causality);
    }
  }

  /**
   * Get time key for grouping
   */
  _getTimeKey(timestamp, groupBy) {
    const date = new Date(timestamp);
    if (groupBy === 'hour') {
      return date.toISOString().slice(0, 13) + ':00:00Z';
    } else if (groupBy === 'day') {
      return date.toISOString().slice(0, 10);
    } else if (groupBy === 'minute') {
      return date.toISOString().slice(0, 16);
    }
    return date.toISOString();
  }

  /**
   * Close system
   */
  close() {
    this.errors.clear();
    this.errorTrees.clear();
    this.errorPatterns.clear();
    this.errorChains.clear();
    this.stackTraces.clear();
    this.errorCausalityGraph.clear();
    this.emit('system:closed');
  }
}

module.exports = ErrorTracer;

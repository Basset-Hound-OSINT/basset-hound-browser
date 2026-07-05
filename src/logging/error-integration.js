/**
 * Error Logger Integration Module
 * Provides integration points between ErrorLogger and WebSocket server,
 * command dispatcher, and other modules
 */

const { ErrorLogger, ERROR_CATEGORIES, SEVERITY_LEVELS } = require('./error-logger');

// ==========================================
// WebSocket Error Handler Integration
// ==========================================

/**
 * Wrap WebSocket connection handler with error logging
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @param {Function} handler - Original connection handler
 * @param {string} operationName - Name of operation for context
 * @returns {Function} Wrapped handler
 */
function wrapWebSocketHandler(errorLogger, handler, operationName) {
  return async function wrappedHandler(...args) {
    const correlationId = generateCorrelationId();

    try {
      return await handler.apply(this, args);
    } catch (error) {
      errorLogger.logError(error, {
        operation: operationName,
        correlationId,
        metadata: {
          handlerName: handler.name || 'anonymous',
          argsCount: args.length
        }
      });

      throw error; // Re-throw to allow original error handling
    }
  };
}

// ==========================================
// Command Dispatcher Error Handling
// ==========================================

/**
 * Create a command error handler for dispatcher
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Error handler
 */
function createCommandErrorHandler(errorLogger) {
  return function handleCommandError(error, commandName, commandData, correlationId) {
    const classification = errorLogger.classifyError(error);

    // Special handling for detection errors
    if (classification.category === ERROR_CATEGORIES.DETECTION) {
      errorLogger.logWarning(
        `Bot detection challenge detected during command execution`,
        {
          operation: `command:${commandName}`,
          correlationId,
          metadata: {
            commandName,
            detectionType: extractDetectionType(error)
          }
        }
      );
    }

    // Log the error
    const entry = errorLogger.logError(error, {
      operation: `command:${commandName}`,
      correlationId,
      metadata: {
        commandName,
        commandData: sanitizeCommandData(commandData),
        isRetryable: isCommandRetryable(commandName)
      }
    });

    return entry;
  };
}

/**
 * Wrap command dispatcher with error logging
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @param {Object} dispatcher - Command dispatcher instance
 * @returns {Object} Wrapped dispatcher with error tracking
 */
function instrumentCommandDispatcher(errorLogger, dispatcher) {
  const originalDispatch = dispatcher.dispatch;

  dispatcher.dispatch = async function (commandName, commandData, clientId) {
    const correlationId = generateCorrelationId();
    const startTime = Date.now();

    try {
      const result = await originalDispatch.call(
        this,
        commandName,
        commandData,
        clientId
      );

      // Log slow commands as warnings
      const duration = Date.now() - startTime;
      if (duration > 5000) {
        errorLogger.logWarning(
          `Slow command execution: ${duration}ms`,
          {
            operation: `command:${commandName}`,
            correlationId,
            metadata: { duration, commandName }
          }
        );
      }

      return result;
    } catch (error) {
      createCommandErrorHandler(errorLogger)(
        error,
        commandName,
        commandData,
        correlationId
      );
      throw error;
    }
  };

  dispatcher.errorLogger = errorLogger;
  return dispatcher;
}

// ==========================================
// Network Error Handler
// ==========================================

/**
 * Create network error handler with categorization
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Network error handler
 */
function createNetworkErrorHandler(errorLogger) {
  return function handleNetworkError(error, requestInfo, correlationId) {
    const classification = errorLogger.classifyError(error);

    // Extract network-specific details
    const networkDetails = {
      method: requestInfo?.method,
      url: requestInfo?.url,
      statusCode: requestInfo?.statusCode,
      retryable: isNetworkErrorRetryable(error)
    };

    errorLogger.logError(error, {
      operation: 'network_request',
      correlationId,
      metadata: networkDetails
    });
  };
}

// ==========================================
// Parser and Validation Error Handler
// ==========================================

/**
 * Create parser error handler
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Parser error handler
 */
function createParserErrorHandler(errorLogger) {
  return function handleParserError(error, parserType, input, correlationId) {
    const metadata = {
      parserType,
      inputLength: typeof input === 'string' ? input.length : null,
      inputType: typeof input
    };

    // Try to extract more context from parsing errors
    if (error instanceof SyntaxError) {
      metadata.syntaxErrorDetails = {
        line: error.line,
        column: error.column,
        text: error.text
      };
    }

    errorLogger.logError(error, {
      operation: `parse:${parserType}`,
      correlationId,
      metadata
    });
  };
}

// ==========================================
// Authentication Error Handler
// ==========================================

/**
 * Create authentication error handler
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Auth error handler
 */
function createAuthErrorHandler(errorLogger) {
  return function handleAuthError(error, authType, details, correlationId) {
    const metadata = {
      authType,
      // Never log actual credentials
      attemptedProvider: details?.provider,
      timestamp: details?.timestamp
    };

    errorLogger.logError(error, {
      operation: `auth:${authType}`,
      correlationId,
      metadata
    });
  };
}

// ==========================================
// Memory and Resource Error Handler
// ==========================================

/**
 * Create resource error handler
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Resource error handler
 */
function createResourceErrorHandler(errorLogger) {
  return function handleResourceError(error, resourceType, context, correlationId) {
    const metadata = {
      resourceType,
      available: context?.available,
      requested: context?.requested,
      limit: context?.limit
    };

    errorLogger.logError(error, {
      operation: `resource:${resourceType}`,
      correlationId,
      metadata
    });
  };
}

// ==========================================
// Alert Integration
// ==========================================

/**
 * Create alert targets that integrate with external systems
 * @param {Object} options - Configuration options
 * @returns {Object} Alert targets object
 */
function createAlertTargets(options = {}) {
  return {
    email: options.email ? function (message, alert) {
      // Would integrate with email service
      if (options.emailFn) {
        options.emailFn(message, alert);
      }
    } : null,

    webhook: options.webhook ? function (alert) {
      // Would integrate with webhook service
      if (options.webhookFn) {
        options.webhookFn(alert);
      }
    } : null,

    slack: options.slack ? function (message, alert) {
      // Would integrate with Slack API
      if (options.slackFn) {
        options.slackFn(message, alert);
      }
    } : null
  };
}

// ==========================================
// Middleware Integration
// ==========================================

/**
 * Create Express/middleware error handler
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Express error middleware
 */
function createExpressErrorMiddleware(errorLogger) {
  return function (err, req, res, next) {
    const correlationId = req.id || generateCorrelationId();

    errorLogger.logError(err, {
      operation: `http:${req.method || 'unknown'}`,
      correlationId,
      metadata: {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode || 500,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });

    res.status(err.statusCode || 500).json({
      error: err.message,
      correlationId,
      timestamp: new Date().toISOString()
    });
  };
}

// ==========================================
// Health Check Integration
// ==========================================

/**
 * Create health check function that includes error metrics
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Function} Health check function
 */
function createHealthCheckWithErrors(errorLogger) {
  return function getHealth() {
    const stats = errorLogger.getStats();
    const recentErrors = errorLogger.getRecent(5);

    // Determine health status based on error rates
    let status = 'healthy';
    if (stats.bySeverity.critical && stats.bySeverity.critical > 0) {
      status = 'critical';
    } else if (stats.bySeverity.high && stats.bySeverity.high > 5) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      errors: {
        total: stats.total,
        recentCount: recentErrors.length,
        bySeverity: stats.bySeverity,
        activeAlerts: stats.activeAlerts,
        topErrors: stats.topFingerprints.slice(0, 3)
      }
    };
  };
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Generate unique correlation ID
 * @returns {string}
 */
function generateCorrelationId() {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract detection type from error
 * @param {Error} error - The error
 * @returns {string} Detection type
 */
function extractDetectionType(error) {
  const msg = error?.message?.toLowerCase() || '';
  if (msg.includes('cloudflare')) {
    return 'cloudflare';
  }
  if (msg.includes('recaptcha')) {
    return 'recaptcha';
  }
  if (msg.includes('challenge')) {
    return 'challenge';
  }
  return 'unknown';
}

/**
 * Sanitize command data for logging
 * @param {Object} data - Command data
 * @returns {Object} Sanitized data
 */
function sanitizeCommandData(data) {
  if (!data) {
    return null;
  }

  const sanitized = { ...data };

  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'credentials'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Check if command is retryable
 * @param {string} commandName - Command name
 * @returns {boolean}
 */
function isCommandRetryable(commandName) {
  const retryableCommands = [
    'get_', 'screenshot', 'ping', 'status',
    'list_', 'get_cookies', 'get_history'
  ];

  return retryableCommands.some(prefix => commandName.startsWith(prefix));
}

/**
 * Check if network error is retryable
 * @param {Error} error - Network error
 * @returns {boolean}
 */
function isNetworkErrorRetryable(error) {
  const retryableErrors = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH'
  ];

  const msg = error?.message?.toUpperCase() || '';
  return retryableErrors.some(err => msg.includes(err));
}

// ==========================================
// Dashboard/Monitoring Integration
// ==========================================

/**
 * Create dashboard data provider
 * @param {ErrorLogger} errorLogger - ErrorLogger instance
 * @returns {Object} Dashboard data provider
 */
function createDashboardProvider(errorLogger) {
  return {
    getErrorTrends: function (timeWindow = 3600000) {
      const now = Date.now();
      const recent = errorLogger.getRecent(1000).filter(
        e => now - e.timestamp < timeWindow
      );

      const byHour = {};
      recent.forEach(e => {
        const hour = Math.floor(e.timestamp / 3600000) * 3600000;
        byHour[hour] = (byHour[hour] || 0) + 1;
      });

      return byHour;
    },

    getErrorBreakdown: function () {
      const stats = errorLogger.getStats();
      return {
        byCategory: stats.byCategory,
        bySeverity: stats.bySeverity,
        topErrors: stats.topFingerprints
      };
    },

    getAlertStatus: function () {
      const stats = errorLogger.getStats();
      return {
        activeAlerts: stats.activeAlerts,
        criticalCount: stats.bySeverity.critical || 0,
        highCount: stats.bySeverity.high || 0
      };
    }
  };
}

// ==========================================
// Exports
// ==========================================

module.exports = {
  wrapWebSocketHandler,
  createCommandErrorHandler,
  instrumentCommandDispatcher,
  createNetworkErrorHandler,
  createParserErrorHandler,
  createAuthErrorHandler,
  createResourceErrorHandler,
  createAlertTargets,
  createExpressErrorMiddleware,
  createHealthCheckWithErrors,
  createDashboardProvider,
  generateCorrelationId,
  extractDetectionType,
  sanitizeCommandData,
  isCommandRetryable,
  isNetworkErrorRetryable
};

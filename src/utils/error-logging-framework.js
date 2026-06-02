/**
 * Unified Error Handling & Logging Framework
 *
 * Consolidates error handling and logging patterns across the codebase.
 * Provides:
 * - Unified error classes hierarchy
 * - Structured error formatting
 * - Consistent logging patterns
 * - Error recovery suggestions
 * - Stack trace management
 *
 * @module error-logging-framework
 */

const { createLogger } = require('../../logging');

/**
 * ==========================================
 * Unified Error Class Hierarchy
 * ==========================================
 */

/**
 * Base class for all application errors
 */
class BaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || this.constructor.name;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.statusCode = options.statusCode || 500;
    this.details = options.details || null;
    this.timestamp = new Date().toISOString();
    this.context = options.context || {};

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      details: this.details,
      context: this.context
    };
  }

  toLoggable() {
    return {
      ...this.toJSON(),
      stack: this.stack
    };
  }
}

/**
 * Error for validation failures
 */
class ValidationError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'ValidationError',
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      ...options
    });
  }
}

/**
 * Error for authentication failures
 */
class AuthenticationError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'AuthenticationError',
      code: 'AUTHENTICATION_ERROR',
      statusCode: 401,
      ...options
    });
  }
}

/**
 * Error for authorization failures
 */
class AuthorizationError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'AuthorizationError',
      code: 'AUTHORIZATION_ERROR',
      statusCode: 403,
      ...options
    });
  }
}

/**
 * Error for not found conditions
 */
class NotFoundError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'NotFoundError',
      code: 'NOT_FOUND',
      statusCode: 404,
      ...options
    });
  }
}

/**
 * Error for timeout conditions
 */
class TimeoutError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'TimeoutError',
      code: 'TIMEOUT',
      statusCode: 408,
      ...options
    });
  }
}

/**
 * Error for circuit breaker state
 */
class CircuitBreakerError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'CircuitBreakerError',
      code: 'CIRCUIT_BREAKER_OPEN',
      statusCode: 503,
      ...options
    });
  }
}

/**
 * Error for resource exhaustion
 */
class ResourceError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'ResourceError',
      code: 'RESOURCE_ERROR',
      statusCode: 429,
      ...options
    });
  }
}

/**
 * Error for rate limiting
 */
class RateLimitError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'RateLimitError',
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      ...options
    });
  }
}

/**
 * Error for operation conflicts
 */
class ConflictError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'ConflictError',
      code: 'CONFLICT',
      statusCode: 409,
      ...options
    });
  }
}

/**
 * Error for unsupported operations
 */
class NotSupportedError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'NotSupportedError',
      code: 'NOT_SUPPORTED',
      statusCode: 501,
      ...options
    });
  }
}

/**
 * Error for internal server errors
 */
class InternalError extends BaseError {
  constructor(message, options = {}) {
    super(message, {
      name: 'InternalError',
      code: 'INTERNAL_ERROR',
      statusCode: 500,
      ...options
    });
  }
}

/**
 * ==========================================
 * Error Handling Utilities
 * ==========================================
 */

/**
 * Determine if error is an instance of BaseError
 */
function isAppError(error) {
  return error instanceof BaseError;
}

/**
 * Convert any error to BaseError format
 */
function normalizeError(error, defaultCode = 'UNKNOWN_ERROR') {
  if (error instanceof BaseError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, {
      code: defaultCode,
      context: { originalError: error.constructor.name }
    });
  }

  return new InternalError(String(error), { code: defaultCode });
}

/**
 * Convert error to standardized response object
 */
function errorToResponse(error, options = {}) {
  const normalized = normalizeError(error);

  return {
    success: false,
    error: normalized.message,
    code: normalized.code,
    statusCode: normalized.statusCode,
    details: normalized.details,
    timestamp: normalized.timestamp,
    ...(options.includeStack && { stack: normalized.stack }),
    ...(options.context && { context: { ...normalized.context, ...options.context } })
  };
}

/**
 * ==========================================
 * Unified Logging Framework
 * ==========================================
 */

/**
 * Error logger with structured output
 */
class ErrorLogger {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.logger = createLogger(moduleName);
  }

  /**
   * Log error with context
   */
  error(message, error, context = {}) {
    const normalized = normalizeError(error, 'LOG_ERROR');
    const loggable = normalized.toLoggable();

    this.logger.error(message, {
      error: loggable,
      context,
      module: this.moduleName
    });

    return normalized;
  }

  /**
   * Log warning
   */
  warn(message, context = {}) {
    this.logger.warn(message, {
      context,
      module: this.moduleName
    });
  }

  /**
   * Log info
   */
  info(message, context = {}) {
    this.logger.info(message, {
      context,
      module: this.moduleName
    });
  }

  /**
   * Log debug
   */
  debug(message, context = {}) {
    this.logger.debug(message, {
      context,
      module: this.moduleName
    });
  }

  /**
   * Log operation result
   */
  logOperation(operationName, success, duration, details = {}) {
    const level = success ? 'info' : 'warn';
    this.logger[level](`Operation: ${operationName}`, {
      success,
      duration: `${duration}ms`,
      ...details,
      module: this.moduleName
    });
  }

  /**
   * Log error recovery attempt
   */
  logRecovery(operation, attemptNumber, totalAttempts, details = {}) {
    this.logger.warn(`Recovery attempt for ${operation}`, {
      attempt: `${attemptNumber}/${totalAttempts}`,
      ...details,
      module: this.moduleName
    });
  }
}

/**
 * ==========================================
 * Error Recovery Utilities
 * ==========================================
 */

/**
 * Generate recovery suggestion for common error patterns
 */
function suggestRecovery(error) {
  const suggestions = {
    TIMEOUT: 'Increase timeout value and retry',
    CIRCUIT_BREAKER_OPEN: 'Wait for circuit to reset or check service health',
    RATE_LIMIT_EXCEEDED: 'Reduce request rate or wait for rate limit window',
    VALIDATION_ERROR: 'Check input parameters and retry',
    AUTHENTICATION_ERROR: 'Verify credentials and reauthenticate',
    NOT_FOUND: 'Verify resource exists and try again',
    RESOURCE_ERROR: 'Free up resources and retry',
    CONFLICT: 'Resolve conflict and retry operation'
  };

  const error_code = error?.code || 'UNKNOWN_ERROR';
  return suggestions[error_code] || 'Try the operation again';
}

/**
 * ==========================================
 * Export All Utilities
 * ==========================================
 */

module.exports = {
  // Error classes
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  TimeoutError,
  CircuitBreakerError,
  ResourceError,
  RateLimitError,
  ConflictError,
  NotSupportedError,
  InternalError,

  // Error utilities
  isAppError,
  normalizeError,
  errorToResponse,
  suggestRecovery,

  // Logging
  ErrorLogger
};

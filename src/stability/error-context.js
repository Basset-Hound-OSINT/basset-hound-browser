/**
 * Enhanced Error Context System
 * Provides structured error responses with operation tracking and debugging context
 *
 * @module src/stability/error-context
 */

const crypto = require('crypto');

/**
 * Error type classification
 */
const ERROR_TYPES = {
  VALIDATION_ERROR: 'ValidationError',
  TIMEOUT_ERROR: 'TimeoutError',
  NETWORK_ERROR: 'NetworkError',
  SERVICE_ERROR: 'ServiceError',
  RESOURCE_ERROR: 'ResourceError',
  CIRCUIT_OPEN_ERROR: 'CircuitOpenError',
  RATE_LIMITED_ERROR: 'RateLimitedError',
  INTERNAL_ERROR: 'InternalError',
  NOT_FOUND_ERROR: 'NotFoundError',
  PERMISSION_ERROR: 'PermissionError'
};

/**
 * Generate a unique operation ID for tracking
 * @returns {string} UUID-like operation ID
 */
function generateOperationId() {
  return crypto.randomUUID();
}

/**
 * Classify an error by type
 * @param {Error} error - Error object
 * @returns {string} Error type classification
 */
function classifyError(error) {
  const message = (error?.message || '').toLowerCase();
  const code = error?.code || '';

  if (message.includes('timeout') || code === 'ETIMEDOUT') {
    return ERROR_TYPES.TIMEOUT_ERROR;
  }

  if (message.includes('circuit')) {
    return ERROR_TYPES.CIRCUIT_OPEN_ERROR;
  }

  if (message.includes('rate limit') || message.includes('too many')) {
    return ERROR_TYPES.RATE_LIMITED_ERROR;
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return ERROR_TYPES.VALIDATION_ERROR;
  }

  if (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('enetunreach') ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  ) {
    return ERROR_TYPES.NETWORK_ERROR;
  }

  if (message.includes('not found') || message.includes('404')) {
    return ERROR_TYPES.NOT_FOUND_ERROR;
  }

  if (message.includes('permission') || message.includes('denied')) {
    return ERROR_TYPES.PERMISSION_ERROR;
  }

  if (message.includes('memory') || message.includes('resource')) {
    return ERROR_TYPES.RESOURCE_ERROR;
  }

  if (code === 'SERVICE_ERROR' || message.includes('service')) {
    return ERROR_TYPES.SERVICE_ERROR;
  }

  return ERROR_TYPES.INTERNAL_ERROR;
}

/**
 * Determine if error is transient (can be retried)
 * @param {Error} error - Error object
 * @returns {boolean}
 */
function isTransientError(error) {
  const errorType = classifyError(error);
  const transientTypes = [
    ERROR_TYPES.TIMEOUT_ERROR,
    ERROR_TYPES.NETWORK_ERROR,
    ERROR_TYPES.RATE_LIMITED_ERROR,
    ERROR_TYPES.CIRCUIT_OPEN_ERROR
  ];
  return transientTypes.includes(errorType);
}

/**
 * Enhanced Error Response Builder
 * Creates structured error responses with context for debugging
 */
class ErrorContext {
  /**
   * Create error context for a command execution
   * @param {string} command - Command name
   * @param {Object} options - Options
   * @param {Error} options.error - The error that occurred
   * @param {string} options.operationId - Operation ID (generated if not provided)
   * @param {number} options.durationMs - Execution duration in ms
   * @param {Object} options.params - Command parameters (sanitized for logging)
   * @param {boolean} options.debug - Include debug info (default: check DEBUG env)
   * @returns {Object} Structured error response
   */
  static buildErrorResponse(command, options = {}) {
    const {
      error,
      operationId = generateOperationId(),
      durationMs = 0,
      params = {},
      debug = process.env.DEBUG === 'true'
    } = options;

    const errorType = classifyError(error);
    const isTransient = isTransientError(error);

    const response = {
      success: false,
      command,
      error: error?.message || 'Unknown error',
      errorType,
      operationId,
      durationMs,
      timestamp: new Date().toISOString(),
      isTransient
    };

    // Include debug info if requested
    if (debug) {
      response.debugInfo = {
        stack: error?.stack,
        code: error?.code,
        errorName: error?.name,
        sanitizedParams: ErrorContext.sanitizeParams(params)
      };
    }

    return response;
  }

  /**
   * Create success response with context
   * @param {string} command - Command name
   * @param {Object} options - Options
   * @param {*} options.result - Result data
   * @param {string} options.operationId - Operation ID
   * @param {number} options.durationMs - Duration in ms
   * @returns {Object} Structured success response
   */
  static buildSuccessResponse(command, options = {}) {
    const {
      result = null,
      operationId = generateOperationId(),
      durationMs = 0
    } = options;

    return {
      success: true,
      command,
      result,
      operationId,
      durationMs,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Wrap a command execution with automatic error handling and timing
   * @param {string} command - Command name
   * @param {Function} fn - Async function to execute
   * @param {Object} options - Options
   * @param {Object} options.params - Command parameters
   * @param {boolean} options.debug - Include debug info
   * @returns {Promise<Object>} Structured response (success or error)
   */
  static async executeWithContext(command, fn, options = {}) {
    const operationId = generateOperationId();
    const startTime = Date.now();

    try {
      const result = await fn();
      const durationMs = Date.now() - startTime;

      return ErrorContext.buildSuccessResponse(command, {
        result,
        operationId,
        durationMs
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      return ErrorContext.buildErrorResponse(command, {
        error,
        operationId,
        durationMs,
        params: options.params,
        debug: options.debug
      });
    }
  }

  /**
   * Validate a required parameter
   * @param {string} paramName - Parameter name
   * @param {*} value - Parameter value
   * @param {string} expectedType - Expected type (optional)
   * @returns {void}
   * @throws {Error} If validation fails
   */
  static validateParam(paramName, value, expectedType = null) {
    if (value === undefined || value === null) {
      throw new Error(`Missing required parameter: ${paramName}`);
    }

    if (expectedType) {
      const actualType = typeof value;
      if (actualType !== expectedType) {
        throw new Error(
          `Invalid parameter ${paramName}: expected ${expectedType}, got ${actualType}`
        );
      }
    }
  }

  /**
   * Validate integer parameter within range
   * @param {string} paramName - Parameter name
   * @param {*} value - Parameter value
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Validated integer
   * @throws {Error} If validation fails
   */
  static validateIntRange(paramName, value, min = 0, max = 65535) {
    const num = parseInt(value, 10);

    if (isNaN(num)) {
      throw new Error(`Invalid ${paramName}: must be a number, got "${value}"`);
    }

    if (num < min || num > max) {
      throw new Error(
        `Invalid ${paramName}: must be between ${min}-${max}, got ${num}`
      );
    }

    return num;
  }

  /**
   * Validate URL parameter
   * @param {string} paramName - Parameter name
   * @param {string} value - Parameter value
   * @returns {string} Validated URL
   * @throws {Error} If validation fails
   */
  static validateUrl(paramName, value) {
    try {
      return new URL(value).toString();
    } catch {
      throw new Error(`Invalid ${paramName}: must be a valid URL, got "${value}"`);
    }
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   * @param {Object} params - Parameters to sanitize
   * @returns {Object} Sanitized parameters
   */
  static sanitizeParams(params = {}) {
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'credentials',
      'apiKey',
      'privateKey'
    ];

    const sanitized = { ...params };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Create error chain message (includes nested error messages)
   * @param {Error} error - Error object
   * @returns {string} Full error message chain
   */
  static getFullErrorMessage(error) {
    const messages = [];
    let current = error;

    while (current) {
      messages.push(current.message);
      current = current.cause || null;
    }

    return messages.join(' → ');
  }
}

/**
 * Custom error classes for better type checking
 */
class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = options.statusCode || 500;
    this.context = options.context || {};
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, options = {}) {
    super(message, 'VALIDATION_ERROR', { statusCode: 400, ...options });
  }
}

class TimeoutError extends AppError {
  constructor(message, options = {}) {
    super(message, 'TIMEOUT_ERROR', { statusCode: 408, ...options });
  }
}

class RateLimitError extends AppError {
  constructor(message, options = {}) {
    super(message, 'RATE_LIMITED_ERROR', { statusCode: 429, ...options });
  }
}

class CircuitBreakerError extends AppError {
  constructor(message, options = {}) {
    super(message, 'CIRCUIT_OPEN_ERROR', { statusCode: 503, ...options });
  }
}

class NotFoundError extends AppError {
  constructor(message, options = {}) {
    super(message, 'NOT_FOUND_ERROR', { statusCode: 404, ...options });
  }
}

module.exports = {
  ErrorContext,
  AppError,
  ValidationError,
  TimeoutError,
  RateLimitError,
  CircuitBreakerError,
  NotFoundError,
  ERROR_TYPES,
  generateOperationId,
  classifyError,
  isTransientError
};

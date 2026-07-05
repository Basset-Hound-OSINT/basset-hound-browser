/**
 * Basset Hound Browser - WebSocket Error Response Formatter
 * Standardizes all error responses to follow the unified error schema
 *
 * Features:
 * - Consistent error response format across all commands
 * - Machine-readable error codes with recovery hints
 * - Additional error context via details field
 * - HTTP status code mapping
 *
 * Version: 1.0.0
 * Created: June 21, 2026
 */

const fs = require('fs');
const path = require('path');

/**
 * Load recovery hints from JSON file
 * @private
 * @returns {Object} Error code to recovery hint mapping
 */
function loadRecoveryHints() {
  try {
    const hintsPath = path.join(__dirname, 'ERROR-RECOVERY-HINTS.json');
    const content = fs.readFileSync(hintsPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('[ErrorFormatter] Failed to load recovery hints:', error.message);
    // Fallback to minimal hints
    return {};
  }
}

const RECOVERY_HINTS = loadRecoveryHints();

/**
 * Standard error response formatter
 * Ensures all error responses follow the unified schema
 */
class ErrorFormatter {
  /**
   * Format a standardized error response
   * @param {Object} options - Error options
   * @param {string} options.errorCode - Machine-readable error code (UPPERCASE_SNAKE_CASE)
   * @param {string} options.error - Human-readable error message
   * @param {string} options.command - Command name that failed
   * @param {string|null} options.id - Message ID from request
   * @param {Object} options.details - Additional error context (optional)
   * @returns {Object} Standardized error response
   */
  static formatError({
    errorCode,
    error,
    command,
    id = null,
    details = {}
  }) {
    if (!errorCode) {
      throw new Error('errorCode is required');
    }
    if (!error) {
      throw new Error('error message is required');
    }
    if (!command) {
      throw new Error('command name is required');
    }

    // Get recovery hint
    const recoveryHint = RECOVERY_HINTS[errorCode]?.hint ||
      'Please check the error details and try again.';

    return {
      success: false,
      error,
      errorCode,
      command,
      id,
      recoveryHint,
      ...(Object.keys(details).length > 0 && { details })
    };
  }

  /**
   * Format a validation error
   * @param {string} message - Error message
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {Object} details - Validation details (parameter, value, etc.)
   * @returns {Object} Standardized validation error
   */
  static validationError(message, command, id = null, details = {}) {
    return this.formatError({
      errorCode: 'VALIDATION_INVALID_PARAM_VALUE',
      error: message,
      command,
      id,
      details
    });
  }

  /**
   * Format a missing required parameter error
   * @param {string} paramName - Name of missing parameter
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized missing parameter error
   */
  static missingParameterError(paramName, command, id = null) {
    return this.formatError({
      errorCode: 'VALIDATION_MISSING_REQUIRED_PARAM',
      error: `Required parameter '${paramName}' is missing`,
      command,
      id,
      details: { parameter: paramName }
    });
  }

  /**
   * Format a malformed JSON error
   * @param {Error} error - Parse error
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized JSON error
   */
  static malformedJsonError(error, id = null) {
    return this.formatError({
      errorCode: 'VALIDATION_MALFORMED_JSON',
      error: `Invalid JSON: ${error.message}`,
      command: 'unknown',
      id,
      details: { parseError: error.message }
    });
  }

  /**
   * Format a payload too large error
   * @param {number} sizeBytes - Actual size
   * @param {number} limitBytes - Size limit
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {boolean} isCommandLimit - Whether this is a command-specific limit
   * @returns {Object} Standardized payload error
   */
  static payloadTooLargeError(sizeBytes, limitBytes, command, id = null, isCommandLimit = false) {
    return this.formatError({
      errorCode: isCommandLimit ? 'COMMAND_PAYLOAD_TOO_LARGE' : 'PAYLOAD_TOO_LARGE',
      error: `Request size ${this._formatBytes(sizeBytes)} exceeds limit of ${this._formatBytes(limitBytes)}`,
      command,
      id,
      details: {
        actual: sizeBytes,
        limit: limitBytes,
        actualFormatted: this._formatBytes(sizeBytes),
        limitFormatted: this._formatBytes(limitBytes)
      }
    });
  }

  /**
   * Format a rate limit error
   *
   * Response includes:
   * - retryAfter: seconds (HTTP Retry-After header compatible)
   * - resetIn: milliseconds (response details)
   * - statusCode: 429 (HTTP response code)
   *
   * HTTP clients should read the 'retryAfter' field and apply it as:
   *   Retry-After: {retryAfter}  (in HTTP response headers)
   *
   * @param {Object} rateLimitInfo - Rate limit details from rate-limiter.check()
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized rate limit error with retryAfter
   */
  static rateLimitError(rateLimitInfo, command, id = null) {
    const resetInMs = rateLimitInfo.resetIn || 0;
    const resetInSec = Math.ceil(resetInMs / 1000);

    // Get HTTP status code for rate limit
    const httpStatus = 429; // Too Many Requests

    return this.formatError({
      errorCode: 'RATE_LIMIT_EXCEEDED',
      error: `Rate limit exceeded for command '${command}'. Limit: ${rateLimitInfo.limit} req/min. Retry in ${resetInSec}s`,
      command,
      id,
      details: {
        limit: rateLimitInfo.limit,
        current: rateLimitInfo.current,
        remaining: rateLimitInfo.remaining,
        resetIn: resetInMs,                    // Milliseconds - for internal use
        retryAfter: resetInSec,                // Seconds - HTTP standard format
        statusCode: httpStatus,                // HTTP 429 Too Many Requests
        httpHeaders: {                         // HTTP response headers to set
          'Retry-After': resetInSec.toString() // HTTP standard Retry-After header
        },
        authenticated: rateLimitInfo.authenticated
      }
    });
  }

  /**
   * Format a concurrent operation limit error
   * @param {Object} limitInfo - Concurrency limit details
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized concurrency error
   */
  static concurrencyLimitError(limitInfo, command, id = null) {
    return this.formatError({
      errorCode: 'CONCURRENT_LIMIT_EXCEEDED',
      error: `Concurrent operation limit exceeded. Current: ${limitInfo.current}/${limitInfo.max}`,
      command,
      id,
      details: {
        current: limitInfo.current,
        max: limitInfo.max,
        activeOperations: limitInfo.activeOperations || []
      }
    });
  }

  /**
   * Format an authentication required error
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized auth required error
   */
  static authRequiredError(command, id = null) {
    return this.formatError({
      errorCode: 'AUTH_REQUIRED',
      error: 'Authentication required. Send authenticate command with token.',
      command,
      id
    });
  }

  /**
   * Format an invalid auth token error
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {string} reason - Reason for invalidity (optional)
   * @returns {Object} Standardized auth error
   */
  static invalidAuthTokenError(command, id = null, reason = 'invalid or expired') {
    return this.formatError({
      errorCode: 'AUTH_INVALID_TOKEN',
      error: `Authentication token is ${reason}`,
      command,
      id,
      details: { reason }
    });
  }

  /**
   * Format an insufficient permissions error
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {string} requiredPermission - Required permission
   * @returns {Object} Standardized permission error
   */
  static insufficientPermissionsError(command, id = null, requiredPermission = null) {
    return this.formatError({
      errorCode: 'AUTH_INSUFFICIENT_PERMISSIONS',
      error: `Insufficient permissions to execute '${command}'${requiredPermission ? `. Required: ${requiredPermission}` : ''}`,
      command,
      id,
      ...(requiredPermission && { details: { requiredPermission } })
    });
  }

  /**
   * Format a command not found error
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized command not found error
   */
  static commandNotFoundError(command, id = null) {
    return this.formatError({
      errorCode: 'COMMAND_NOT_FOUND',
      error: `Command '${command}' is not recognized`,
      command,
      id,
      details: { providedCommand: command }
    });
  }

  /**
   * Format a command timeout error
   * @param {string} command - Command name
   * @param {number} timeout - Timeout in milliseconds
   * @param {string|null} id - Message ID
   * @param {number} elapsedTime - Actual elapsed time (optional)
   * @returns {Object} Standardized timeout error
   */
  static commandTimeoutError(command, timeout, id = null, elapsedTime = null) {
    return this.formatError({
      errorCode: 'COMMAND_TIMED_OUT',
      error: `Command '${command}' exceeded timeout of ${timeout}ms`,
      command,
      id,
      details: {
        timeout,
        ...(elapsedTime && { elapsedTime })
      }
    });
  }

  /**
   * Format a command execution error
   * @param {string} command - Command name
   * @param {Error|string} error - Error object or message
   * @param {string|null} id - Message ID
   * @param {Object} details - Additional details
   * @returns {Object} Standardized execution error
   */
  static commandExecutionError(command, error, id = null, details = {}) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return this.formatError({
      errorCode: 'COMMAND_EXECUTION_ERROR',
      error: `Error executing command '${command}': ${errorMessage}`,
      command,
      id,
      details: {
        originalError: errorMessage,
        ...details
      }
    });
  }

  /**
   * Format a resource not found error
   * @param {string} resourceType - Type of resource (profile, session, element, etc.)
   * @param {string} identifier - Resource identifier
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized not found error
   */
  static resourceNotFoundError(resourceType, identifier, command, id = null) {
    return this.formatError({
      errorCode: 'RESOURCE_NOT_FOUND',
      error: `${resourceType} '${identifier}' not found`,
      command,
      id,
      details: { resourceType, identifier }
    });
  }

  /**
   * Format a browser error
   * @param {string} reason - Reason for browser error
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @returns {Object} Standardized browser error
   */
  static browserError(reason, command, id = null) {
    let errorCode = 'BROWSER_NOT_READY';

    if (reason.includes('navigation') || reason.includes('navigate')) {
      errorCode = 'BROWSER_NAVIGATION_FAILED';
    } else if (reason.includes('timeout')) {
      errorCode = 'BROWSER_TIMEOUT';
    } else if (reason.includes('network')) {
      errorCode = 'BROWSER_NETWORK_ERROR';
    }

    return this.formatError({
      errorCode,
      error: `Browser error: ${reason}`,
      command,
      id,
      details: { reason }
    });
  }

  /**
   * Format a script execution error
   * @param {string} message - Error message
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {Object} details - Additional details (script, stack, etc.)
   * @returns {Object} Standardized script error
   */
  static scriptError(message, command, id = null, details = {}) {
    let errorCode = 'SCRIPT_EXECUTION_ERROR';

    if (message.includes('SyntaxError') || details.syntaxError) {
      errorCode = 'SCRIPT_SYNTAX_ERROR';
    } else if (message.includes('timeout')) {
      errorCode = 'SCRIPT_TIMEOUT';
    }

    return this.formatError({
      errorCode,
      error: `Script execution error: ${message}`,
      command,
      id,
      details
    });
  }

  /**
   * Format a generic system error
   * @param {string} message - Error message
   * @param {string} command - Command name
   * @param {string|null} id - Message ID
   * @param {string} errorCode - Optional specific error code
   * @returns {Object} Standardized system error
   */
  static systemError(message, command, id = null, errorCode = 'SYSTEM_INTERNAL_ERROR') {
    return this.formatError({
      errorCode,
      error: `System error: ${message}`,
      command,
      id
    });
  }

  /**
   * Get HTTP status code for an error code
   * @param {string} errorCode - Error code
   * @returns {number} HTTP status code
   */
  static getHttpStatus(errorCode) {
    return RECOVERY_HINTS[errorCode]?.httpStatus || 500;
  }

  /**
   * Check if an error is retryable
   * @param {string} errorCode - Error code
   * @returns {boolean} Whether the error is retryable
   */
  static isRetryable(errorCode) {
    return RECOVERY_HINTS[errorCode]?.retryable !== false;
  }

  /**
   * Format bytes to human-readable string
   * @private
   * @param {number} bytes - Number of bytes
   * @returns {string} Formatted size
   */
  static _formatBytes(bytes) {
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
   * Validate an error response conforms to the schema
   * @param {Object} response - Response object
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateErrorResponse(response) {
    const errors = [];

    if (response.success !== false) {
      errors.push('success must be false for error responses');
    }
    if (typeof response.error !== 'string') {
      errors.push('error must be a string');
    }
    if (typeof response.errorCode !== 'string') {
      errors.push('errorCode must be a string');
    }
    if (!response.errorCode.match(/^[A-Z_]+$/)) {
      errors.push('errorCode must be UPPERCASE_SNAKE_CASE');
    }
    if (typeof response.command !== 'string') {
      errors.push('command must be a string');
    }
    if (response.id !== null && typeof response.id !== 'string') {
      errors.push('id must be a string or null');
    }
    if (typeof response.recoveryHint !== 'string') {
      errors.push('recoveryHint must be a string');
    }
    if (response.details && typeof response.details !== 'object') {
      errors.push('details must be an object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = { ErrorFormatter };

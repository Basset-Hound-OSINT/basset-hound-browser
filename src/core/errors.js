/**
 * Basset Hound Browser - Unified Error Hierarchy
 *
 * Provides standardized error classes for all modules with:
 * - Error codes for programmatic handling
 * - Structured logging support
 * - Error recovery hints
 * - Stack trace preservation
 *
 * @module core/errors
 */

/**
 * Base error class for all Basset Hound errors
 */
class BassetError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.statusCode = options.statusCode || 500;
    this.isRetryable = options.isRetryable !== false;
    this.recoveryHint = options.recoveryHint || null;
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      type: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      recoveryHint: this.recoveryHint,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * Get human-readable error message with recovery hint
   */
  toString() {
    let msg = `${this.name}: ${this.message}`;
    if (this.recoveryHint) {
      msg += `\nRecovery: ${this.recoveryHint}`;
    }
    return msg;
  }
}

/**
 * Browser operation errors
 */
class BrowserError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'BROWSER_ERROR',
      ...options
    });
  }
}

/**
 * Browser connection/initialization errors
 */
class BrowserConnectionError extends BrowserError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'BROWSER_CONNECTION_ERROR',
      statusCode: 503,
      isRetryable: true,
      recoveryHint: 'Check Electron process health or restart browser',
      ...options
    });
  }
}

/**
 * WebSocket communication errors
 */
class WebSocketError extends BrowserError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'WEBSOCKET_ERROR',
      statusCode: 503,
      isRetryable: true,
      recoveryHint: 'Check WebSocket connection or server health',
      ...options
    });
  }
}

/**
 * Navigation and page operation errors
 */
class NavigationError extends BrowserError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'NAVIGATION_ERROR',
      statusCode: 400,
      isRetryable: true,
      recoveryHint: 'Verify URL and try again',
      ...options
    });
  }
}

/**
 * Timeout errors
 */
class TimeoutError extends BrowserError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'TIMEOUT_ERROR',
      statusCode: 504,
      isRetryable: true,
      recoveryHint: 'Increase timeout value or check page load',
      ...options
    });
  }
}

/**
 * Detection and analysis errors
 */
class DetectionError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'DETECTION_ERROR',
      statusCode: 400,
      isRetryable: false,
      ...options
    });
  }
}

/**
 * Invalid detection data errors
 */
class InvalidDetectionDataError extends DetectionError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'INVALID_DETECTION_DATA',
      statusCode: 400,
      isRetryable: false,
      recoveryHint: 'Check input data format and content',
      ...options
    });
  }
}

/**
 * Extraction and content retrieval errors
 */
class ExtractionError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'EXTRACTION_ERROR',
      statusCode: 400,
      isRetryable: true,
      ...options
    });
  }
}

/**
 * DOM and content extraction errors
 */
class DOMExtractionError extends ExtractionError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'DOM_EXTRACTION_ERROR',
      statusCode: 400,
      isRetryable: true,
      recoveryHint: 'Ensure page is fully loaded before extraction',
      ...options
    });
  }
}

/**
 * Screenshot capture errors
 */
class ScreenshotError extends ExtractionError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'SCREENSHOT_ERROR',
      statusCode: 400,
      isRetryable: true,
      recoveryHint: 'Check page rendering or increase timeout',
      ...options
    });
  }
}

/**
 * Session and state management errors
 */
class SessionError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'SESSION_ERROR',
      statusCode: 400,
      isRetryable: false,
      ...options
    });
  }
}

/**
 * Session not found or invalid
 */
class SessionNotFoundError extends SessionError {
  constructor(sessionId, options = {}) {
    super(`Session not found: ${sessionId}`, {
      code: options.code || 'SESSION_NOT_FOUND',
      statusCode: 404,
      isRetryable: false,
      recoveryHint: 'Create a new session or use valid session ID',
      context: { sessionId, ...options.context },
      ...options
    });
  }
}

/**
 * Authentication and authorization errors
 */
class AuthenticationError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'AUTHENTICATION_ERROR',
      statusCode: 401,
      isRetryable: false,
      recoveryHint: 'Check credentials and authentication token',
      ...options
    });
  }
}

/**
 * Proxy and network errors
 */
class ProxyError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'PROXY_ERROR',
      statusCode: 502,
      isRetryable: true,
      recoveryHint: 'Check proxy configuration and connectivity',
      ...options
    });
  }
}

/**
 * File I/O errors
 */
class FileOperationError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'FILE_OPERATION_ERROR',
      statusCode: 400,
      isRetryable: true,
      recoveryHint: 'Check file permissions and path validity',
      ...options
    });
  }
}

/**
 * Configuration errors
 */
class ConfigurationError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'CONFIGURATION_ERROR',
      statusCode: 400,
      isRetryable: false,
      recoveryHint: 'Review configuration and correct any issues',
      ...options
    });
  }
}

/**
 * Validation errors
 */
class ValidationError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'VALIDATION_ERROR',
      statusCode: 400,
      isRetryable: false,
      recoveryHint: 'Check input validation and requirements',
      ...options
    });
  }
}

/**
 * Rate limiting errors
 */
class RateLimitError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'RATE_LIMIT_ERROR',
      statusCode: 429,
      isRetryable: true,
      recoveryHint: 'Wait before retrying request',
      ...options
    });
  }
}

/**
 * Memory and resource errors
 */
class ResourceError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'RESOURCE_ERROR',
      statusCode: 507,
      isRetryable: true,
      recoveryHint: 'Free up system resources and retry',
      ...options
    });
  }
}

/**
 * Internal server errors
 */
class InternalError extends BassetError {
  constructor(message, options = {}) {
    super(message, {
      code: options.code || 'INTERNAL_ERROR',
      statusCode: 500,
      isRetryable: false,
      recoveryHint: 'Check logs for detailed error information',
      ...options
    });
  }
}

module.exports = {
  // Base
  BassetError,

  // Browser errors
  BrowserError,
  BrowserConnectionError,
  WebSocketError,
  NavigationError,
  TimeoutError,

  // Detection errors
  DetectionError,
  InvalidDetectionDataError,

  // Extraction errors
  ExtractionError,
  DOMExtractionError,
  ScreenshotError,

  // Session errors
  SessionError,
  SessionNotFoundError,

  // Auth errors
  AuthenticationError,

  // Network errors
  ProxyError,

  // File and config errors
  FileOperationError,
  ConfigurationError,
  ValidationError,

  // Rate limiting
  RateLimitError,

  // Resource errors
  ResourceError,

  // Internal errors
  InternalError
};

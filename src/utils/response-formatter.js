/**
 * @fileoverview Response formatting utilities
 *
 * Provides consistent response formatting for API endpoints, commands, and
 * WebSocket handlers throughout Basset Hound Browser.
 *
 * @module utils/response-formatter
 */

/**
 * Standard response formatter for consistent API responses.
 * All responses follow the structure: { success, data/error, code, timestamp }
 *
 * @class ResponseFormatter
 */
class ResponseFormatter {
  /**
   * Create a success response.
   *
   * @static
   * @param {*} data - Response data
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.code='SUCCESS'] - Success code
   * @param {Object} [options.metadata=null] - Additional metadata
   * @returns {Object} Formatted success response
   *
   * @example
   * ResponseFormatter.success({ count: 42 });
   * // { success: true, data: { count: 42 }, code: 'SUCCESS', timestamp: '...' }
   */
  static success(data, options = {}) {
    const {
      code = 'SUCCESS',
      metadata = null
    } = options;

    const response = {
      success: true,
      code,
      data,
      timestamp: new Date().toISOString()
    };

    if (metadata) {
      response.metadata = metadata;
    }

    return response;
  }

  /**
   * Create an error response.
   *
   * @static
   * @param {string} message - Error message
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.code='ERROR'] - Error code
   * @param {*} [options.details=null] - Additional error details
   * @param {number} [options.statusCode=500] - HTTP status code (if applicable)
   * @returns {Object} Formatted error response
   *
   * @example
   * ResponseFormatter.error('Operation failed', { code: 'TIMEOUT', statusCode: 408 });
   * // { success: false, error: 'Operation failed', code: 'TIMEOUT', statusCode: 408, ... }
   */
  static error(message, options = {}) {
    const {
      code = 'ERROR',
      details = null,
      statusCode = 500
    } = options;

    const response = {
      success: false,
      code,
      error: message,
      statusCode,
      timestamp: new Date().toISOString()
    };

    if (details) {
      response.details = details;
    }

    return response;
  }

  /**
   * Create a partial/incomplete response (some operations succeeded, some failed).
   *
   * @static
   * @param {Object} results - Results object with succeeded/failed counts
   * @param {number} results.succeeded - Number of successful operations
   * @param {number} results.failed - Number of failed operations
   * @param {Array} [results.errors=null] - Array of error details
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.code='PARTIAL_SUCCESS'] - Response code
   * @returns {Object} Formatted partial response
   *
   * @example
   * ResponseFormatter.partial(
   *   { succeeded: 8, failed: 2, errors: [{ index: 1, error: '...' }] },
   *   { code: 'BATCH_PARTIAL' }
   * );
   */
  static partial(results, options = {}) {
    const {
      code = 'PARTIAL_SUCCESS'
    } = options;

    const response = {
      success: true,
      code,
      partial: true,
      results: {
        succeeded: results.succeeded || 0,
        failed: results.failed || 0,
        total: (results.succeeded || 0) + (results.failed || 0)
      },
      timestamp: new Date().toISOString()
    };

    if (results.errors && results.errors.length > 0) {
      response.errors = results.errors;
    }

    return response;
  }

  /**
   * Create a paginated response.
   *
   * @static
   * @param {Array} items - Response items
   * @param {Object} pagination - Pagination info
   * @param {number} pagination.page - Current page (1-indexed)
   * @param {number} pagination.pageSize - Items per page
   * @param {number} pagination.total - Total items
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.code='SUCCESS'] - Response code
   * @returns {Object} Formatted paginated response
   *
   * @example
   * ResponseFormatter.paginated(items, { page: 1, pageSize: 10, total: 42 });
   */
  static paginated(items, pagination, options = {}) {
    const {
      code = 'SUCCESS'
    } = options;

    const totalPages = Math.ceil(pagination.total / pagination.pageSize);
    const hasNextPage = pagination.page < totalPages;
    const hasPreviousPage = pagination.page > 1;

    return {
      success: true,
      code,
      data: items,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an async/streaming response that acknowledges operation has started.
   *
   * @static
   * @param {string} operationId - Unique operation identifier
   * @param {Object} [options={}] - Additional options
   * @param {string} [options.code='OPERATION_STARTED'] - Response code
   * @param {string} [options.statusUrl=null] - URL to check operation status
   * @returns {Object} Formatted async response
   *
   * @example
   * ResponseFormatter.async('op-123456', { statusUrl: '/api/status/op-123456' });
   */
  static async(operationId, options = {}) {
    const {
      code = 'OPERATION_STARTED',
      statusUrl = null
    } = options;

    const response = {
      success: true,
      code,
      operationId,
      timestamp: new Date().toISOString()
    };

    if (statusUrl) {
      response.statusUrl = statusUrl;
    }

    return response;
  }

  /**
   * Create a redirect response.
   *
   * @static
   * @param {string} url - Redirect URL
   * @param {Object} [options={}] - Additional options
   * @param {boolean} [options.permanent=false] - Permanent redirect (301 vs 302)
   * @returns {Object} Formatted redirect response
   *
   * @example
   * ResponseFormatter.redirect('/new-endpoint', { permanent: true });
   */
  static redirect(url, options = {}) {
    const {
      permanent = false
    } = options;

    return {
      success: true,
      code: permanent ? 'MOVED_PERMANENTLY' : 'FOUND',
      statusCode: permanent ? 301 : 302,
      location: url,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate a response object matches expected structure.
   *
   * @static
   * @param {Object} response - Response to validate
   * @param {Object} [options={}] - Validation options
   * @param {boolean} [options.requireData=false] - Require 'data' field
   * @param {boolean} [options.requireError=false] - Require 'error' field
   * @returns {boolean} True if valid response format
   *
   * @example
   * ResponseFormatter.isValid(response, { requireData: true });
   */
  static isValid(response, options = {}) {
    const {
      requireData = false,
      requireError = false
    } = options;

    if (!response || typeof response !== 'object') {
      return false;
    }

    if (!('success' in response) || typeof response.success !== 'boolean') {
      return false;
    }

    if (!('timestamp' in response)) {
      return false;
    }

    if (requireData && !('data' in response)) {
      return false;
    }

    if (requireError && !('error' in response)) {
      return false;
    }

    return true;
  }

  /**
   * Convert response to plain object (for serialization).
   *
   * @static
   * @param {Object} response - Response object
   * @returns {Object} Plain object suitable for JSON serialization
   */
  static toJSON(response) {
    if (!response || typeof response !== 'object') {
      return response;
    }

    // Handle Error objects
    if (response instanceof Error) {
      return {
        success: false,
        code: 'ERROR',
        error: response.message,
        stack: response.stack
      };
    }

    return JSON.parse(JSON.stringify(response));
  }
}

/**
 * Middleware wrapper for converting errors to standard response format.
 *
 * @param {Error} error - Error to convert
 * @param {Object} [context={}] - Additional context
 * @param {string} [context.operation='unknown'] - Operation name
 * @returns {Object} Formatted error response
 *
 * @example
 * try {
 *   // operation
 * } catch (error) {
 *   res.json(errorResponse(error, { operation: 'fetchData' }));
 * }
 */
function errorResponse(error, context = {}) {
  const {
    operation = 'unknown'
  } = context;

  let code = 'ERROR';
  let statusCode = 500;
  let message = error.message || 'Unknown error';

  // Map error codes to HTTP status codes
  if (error.code) {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        code = 'VALIDATION_ERROR';
        statusCode = 400;
        break;
      case 'AUTH_ERROR':
        code = 'UNAUTHORIZED';
        statusCode = 401;
        break;
      case 'TIMEOUT':
        code = 'TIMEOUT';
        statusCode = 408;
        break;
      case 'NOT_FOUND':
        code = 'NOT_FOUND';
        statusCode = 404;
        break;
      case 'CONFLICT':
        code = 'CONFLICT';
        statusCode = 409;
        break;
      case 'RESOURCE_ERROR':
        code = 'RESOURCE_ERROR';
        statusCode = 503;
        break;
      default:
        code = error.code;
    }
  }

  return ResponseFormatter.error(message, {
    code,
    statusCode,
    details: {
      operation,
      timestamp: new Date().toISOString()
    }
  });
}

module.exports = {
  ResponseFormatter,
  errorResponse
};

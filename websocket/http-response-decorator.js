/**
 * Basset Hound Browser - HTTP Response Decorator
 * Applies HTTP headers based on error response data, including Retry-After for rate limits
 *
 * Features:
 * - Extracts HTTP headers from error response details
 * - Applies Retry-After header for rate limit responses
 * - Supports both standard and custom headers
 * - Compatible with Express/Node http.ServerResponse objects
 *
 * Version: 1.0.0
 * Created: June 21, 2026
 */

/**
 * Decorator to apply HTTP response headers based on error response
 */
class HttpResponseDecorator {
  /**
   * Apply HTTP headers to a response object based on error details
   *
   * Extracts headers from errorResponse.details.httpHeaders and applies them
   * to the Node.js response object.
   *
   * Example usage in Express middleware:
   * ```javascript
   * const response = ErrorFormatter.rateLimitError(rateLimitInfo, command, id);
   * HttpResponseDecorator.applyHeaders(res, response);
   * res.status(429).json(response);
   * ```
   *
   * @param {Object} res - Node.js http.ServerResponse or Express Response object
   * @param {Object} errorResponse - Error response object from ErrorFormatter
   * @param {number} defaultStatus - Default HTTP status code (default: 500)
   * @returns {number} The HTTP status code that was set
   */
  static applyHeaders(res, errorResponse, defaultStatus = 500) {
    if (!res || typeof res.setHeader !== 'function') {
      throw new Error('Invalid response object - must have setHeader method');
    }

    // Determine HTTP status code
    let statusCode = defaultStatus;

    // Check if error response includes a status code
    if (errorResponse.details && errorResponse.details.statusCode) {
      statusCode = errorResponse.details.statusCode;
    } else if (errorResponse.statusCode) {
      statusCode = errorResponse.statusCode;
    }

    // Apply standard error headers
    this._applyErrorHeaders(res, errorResponse.errorCode, statusCode);

    // Apply custom headers from error details
    if (errorResponse.details && errorResponse.details.httpHeaders) {
      for (const [headerName, headerValue] of Object.entries(errorResponse.details.httpHeaders)) {
        res.setHeader(headerName, headerValue.toString());
      }
    }

    // Special handling for Retry-After header for rate limit errors
    if (errorResponse.errorCode === 'RATE_LIMIT_EXCEEDED') {
      if (errorResponse.details && errorResponse.details.retryAfter) {
        // Ensure Retry-After is set (HTTP standard format: seconds as integer)
        const retryAfterSeconds = Math.ceil(errorResponse.details.retryAfter);
        res.setHeader('Retry-After', retryAfterSeconds.toString());

        // Also set X-RateLimit headers for additional client information
        if (errorResponse.details.limit) {
          res.setHeader('X-RateLimit-Limit', errorResponse.details.limit.toString());
        }
        if (typeof errorResponse.details.remaining !== 'undefined') {
          res.setHeader('X-RateLimit-Remaining', errorResponse.details.remaining.toString());
        }
        if (errorResponse.details.resetIn) {
          const resetAtTimestamp = Math.floor(Date.now() / 1000) + Math.ceil(errorResponse.details.resetIn / 1000);
          res.setHeader('X-RateLimit-Reset', resetAtTimestamp.toString());
        }
      }
    }

    return statusCode;
  }

  /**
   * Apply standard error headers based on error code
   * @private
   * @param {Object} res - Node.js response object
   * @param {string} errorCode - Error code
   * @param {number} statusCode - HTTP status code
   */
  static _applyErrorHeaders(res, errorCode, statusCode) {
    // Set Content-Type for JSON response
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // Set Cache-Control to prevent caching error responses
    if (statusCode >= 400) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    // Set X-Error-Code header for debugging
    if (errorCode) {
      res.setHeader('X-Error-Code', errorCode);
    }

    // Set X-Content-Type-Options to prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  /**
   * Create a middleware for Express that applies rate limit headers
   *
   * Usage in Express:
   * ```javascript
   * app.use(HttpResponseDecorator.expressMiddleware());
   * ```
   *
   * @returns {Function} Express middleware
   */
  static expressMiddleware() {
    return (req, res, next) => {
      // Store original json/send methods
      const originalJson = res.json;
      const originalSend = res.send;

      // Override json method to apply headers
      res.json = function(data) {
        if (data && data.success === false && data.errorCode) {
          HttpResponseDecorator.applyHeaders(this, data, 500);
        }
        return originalJson.call(this, data);
      };

      // Override send method to apply headers
      res.send = function(data) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed && parsed.success === false && parsed.errorCode) {
              HttpResponseDecorator.applyHeaders(this, parsed, 500);
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Get the Retry-After header value from an error response
   *
   * @param {Object} errorResponse - Error response object
   * @returns {string|null} The Retry-After header value in seconds, or null if not applicable
   */
  static getRetryAfterHeader(errorResponse) {
    if (errorResponse.errorCode === 'RATE_LIMIT_EXCEEDED' &&
        errorResponse.details &&
        typeof errorResponse.details.retryAfter === 'number') {
      return Math.ceil(errorResponse.details.retryAfter).toString();
    }
    return null;
  }

  /**
   * Get all HTTP headers that should be applied for an error response
   *
   * @param {Object} errorResponse - Error response object
   * @returns {Object} Headers map { 'Header-Name': 'value' }
   */
  static getAllHeaders(errorResponse) {
    const headers = {};

    // Add standard headers
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['X-Content-Type-Options'] = 'nosniff';

    if (errorResponse.errorCode) {
      headers['X-Error-Code'] = errorResponse.errorCode;
    }

    // Add custom headers from response
    if (errorResponse.details && errorResponse.details.httpHeaders) {
      Object.assign(headers, errorResponse.details.httpHeaders);
    }

    // Add rate limit specific headers
    if (errorResponse.errorCode === 'RATE_LIMIT_EXCEEDED' && errorResponse.details) {
      if (errorResponse.details.retryAfter) {
        headers['Retry-After'] = Math.ceil(errorResponse.details.retryAfter).toString();
      }
      if (errorResponse.details.limit) {
        headers['X-RateLimit-Limit'] = errorResponse.details.limit.toString();
      }
      if (typeof errorResponse.details.remaining !== 'undefined') {
        headers['X-RateLimit-Remaining'] = errorResponse.details.remaining.toString();
      }
      if (errorResponse.details.resetIn) {
        const resetAtTimestamp = Math.floor(Date.now() / 1000) + Math.ceil(errorResponse.details.resetIn / 1000);
        headers['X-RateLimit-Reset'] = resetAtTimestamp.toString();
      }
    }

    return headers;
  }
}

module.exports = { HttpResponseDecorator };

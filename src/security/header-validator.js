/**
 * HTTP Header Validator
 * Validates custom HTTP headers to prevent header injection attacks
 * CVSS Impact: Prevents header injection vulnerabilities
 */

// Optional logger - gracefully handle if not available
let logger;
try {
  const loggerModule = require('../../logging/logger');
  logger = loggerModule.defaultLogger || loggerModule;
} catch (e) {
  logger = {
    warn: (msg) => console.warn(msg),
    info: (msg) => console.log(msg)
  };
}

// Whitelist of safe HTTP header names
// Based on OWASP and RFC 7230 recommendations
const SAFE_HEADERS = new Set([
  // Standard request headers
  'accept',
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'cookie',
  'date',
  'dnt',
  'expect',
  'forwarded',
  'from',
  'host',
  'if-match',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'if-unmodified-since',
  'max-forwards',
  'origin',
  'pragma',
  'proxy-authorization',
  'range',
  'referer',
  'te',
  'user-agent',
  'upgrade',
  'via',
  'warning',
  'x-requested-with',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'x-csrf-token',
  'x-api-key',
  'x-auth-token',
  'x-client-id',
  'x-trace-id',
  'x-correlation-id'
]);

// Regex pattern to detect header injection attempts
// Looks for CR/LF characters which could break header boundaries
const INJECTION_PATTERN = /[\r\n]/g;

// Pattern to detect suspicious control characters
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

class HeaderValidator {
  /**
   * Validates a single header name
   * @param {string} name - Header name to validate
   * @param {string} value - Header value to validate
   * @returns {Object} { valid: boolean, error: string|null }
   */
  static validateHeader(name, value) {
    if (typeof name !== 'string' || name.length === 0) {
      return { valid: false, error: 'Header name must be a non-empty string' };
    }

    if (typeof value !== 'string') {
      return { valid: false, error: 'Header value must be a string' };
    }

    // Normalize name and value
    const normalizedName = name.toLowerCase().trim();
    const normalizedValue = value.trim();

    // Check header name length
    if (normalizedName.length > 256) {
      return { valid: false, error: 'Header name exceeds maximum length (256 chars)' };
    }

    // Check header value length
    if (normalizedValue.length > 8192) {
      return { valid: false, error: 'Header value exceeds maximum length (8192 chars)' };
    }

    // Check if header is in whitelist
    if (!SAFE_HEADERS.has(normalizedName)) {
      return {
        valid: false,
        error: `Header "${name}" is not in the safe headers whitelist`
      };
    }

    // Check for header injection attempts (CRLF)
    if (INJECTION_PATTERN.test(normalizedValue)) {
      return {
        valid: false,
        error: 'Header value contains CR/LF characters (potential injection)'
      };
    }

    // Check for control characters (excluding valid UTF-8 and spaces)
    if (CONTROL_CHAR_PATTERN.test(normalizedValue)) {
      return {
        valid: false,
        error: 'Header value contains control characters (potential injection)'
      };
    }

    // Additional validation for Authorization headers
    if (normalizedName === 'authorization') {
      const authMatch = normalizedValue.match(/^(Bearer|Basic|Digest|OAuth|AWS4-HMAC-SHA256)\s+.+$/i);
      if (!authMatch) {
        return {
          valid: false,
          error: 'Authorization header format is invalid'
        };
      }
    }

    // Additional validation for Content-Type header
    if (normalizedName === 'content-type') {
      // Simplified regex to allow unicode characters
      const contentTypeMatch = normalizedValue.match(/^[\w\-+]+\/[\w\-+.]+(\s*;\s*[\w\-]+=[\w\-"\s.]+)*$/u);
      if (!contentTypeMatch) {
        return {
          valid: false,
          error: 'Content-Type header format is invalid'
        };
      }
    }

    return { valid: true, error: null };
  }

  /**
   * Validates a headers object
   * @param {Object} headers - Object containing header names and values
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  static validateHeaders(headers) {
    const errors = [];

    if (!headers || typeof headers !== 'object') {
      return { valid: false, errors: ['Headers must be an object'] };
    }

    // Limit number of headers
    const headerNames = Object.keys(headers);
    if (headerNames.length > 100) {
      return { valid: false, errors: ['Too many headers (max 100)'] };
    }

    for (const [name, value] of Object.entries(headers)) {
      const result = this.validateHeader(name, value);
      if (!result.valid) {
        errors.push(`${name}: ${result.error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Sanitizes header value by removing invalid characters
   * @param {string} value - Header value to sanitize
   * @returns {string} Sanitized value
   */
  static sanitizeHeaderValue(value) {
    if (typeof value !== 'string') {
      return '';
    }

    // Remove CR/LF characters
    let sanitized = value.replace(INJECTION_PATTERN, '');

    // Remove control characters except space
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Gets the list of safe headers
   * @returns {Array<string>} Array of safe header names
   */
  static getSafeHeaders() {
    return Array.from(SAFE_HEADERS).sort();
  }

  /**
   * Checks if a header name is safe
   * @param {string} name - Header name to check
   * @returns {boolean} True if header is safe
   */
  static isSafeHeader(name) {
    return SAFE_HEADERS.has((name || '').toLowerCase().trim());
  }

  /**
   * Adds a custom header to the whitelist (with validation)
   * @param {string} name - Header name to add
   * @returns {boolean} True if added successfully
   */
  static addCustomHeader(name) {
    if (typeof name !== 'string' || name.length === 0) {
      logger.warn('Cannot add invalid header name to whitelist');
      return false;
    }

    const normalizedName = name.toLowerCase().trim();

    // Only allow X- headers and a few other custom prefixes
    if (!normalizedName.startsWith('x-') &&
        !normalizedName.startsWith('custom-') &&
        !normalizedName.startsWith('app-')) {
      logger.warn(`Custom header "${name}" must start with x-, custom-, or app-`);
      return false;
    }

    SAFE_HEADERS.add(normalizedName);
    logger.info(`Added custom header "${normalizedName}" to whitelist`);
    return true;
  }
}

module.exports = HeaderValidator;

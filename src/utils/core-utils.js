/**
 * Core Utilities Module
 *
 * Consolidates shared utility functions across the codebase to eliminate
 * duplication and provide a single source of truth for common operations.
 *
 * Consolidated from 8+ modules:
 * - Header normalization (5 locations)
 * - Data formatting (4 locations)
 * - Cache operations (3 locations)
 * - Error handling (4 locations)
 *
 * @module core-utils
 */

const crypto = require('crypto');

/**
 * ==========================================
 * Header Utilities
 * ==========================================
 */

/**
 * Normalize headers object to lowercase keys with Map interface
 * @param {object} headers - Headers object
 * @returns {object} Normalized headers with lowercase keys
 */
function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const normalized = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = String(value);
  });
  return normalized;
}

/**
 * Extract header value by name (case-insensitive)
 * @param {object} headers - Headers object
 * @param {string} headerName - Header name to find
 * @returns {string|null} Header value or null
 */
function getHeader(headers, headerName) {
  const normalized = normalizeHeaders(headers);
  return normalized[headerName.toLowerCase()] || null;
}

/**
 * Parse header value into components
 * @param {string} headerValue - Header value to parse
 * @returns {object} { name, version } or { name }
 */
function parseHeaderValue(headerValue) {
  if (!headerValue) {
    return { name: null };
  }

  headerValue = String(headerValue).trim();
  const match = headerValue.match(/^([^\s\/]+)(?:[\s\/]+(.+))?$/);
  if (match) {
    return {
      name: match[1],
      version: match[2] || null
    };
  }

  return { name: headerValue };
}

/**
 * ==========================================
 * Data Formatting Utilities
 * ==========================================
 */

/**
 * Format any value for output/logging
 * @param {*} value - Value to format
 * @param {boolean} pretty - Pretty print JSON (default: false)
 * @returns {string} Formatted string
 */
function formatValue(value, pretty = false) {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, pretty ? 2 : 0);
    } catch (error) {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Truncate string to max length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix to add if truncated (default: "...")
 * @returns {string} Truncated string
 */
function truncateString(str, maxLength = 100, suffix = '...') {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} Human readable size (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format milliseconds to human readable time
 * @param {number} ms - Milliseconds
 * @returns {string} Human readable time (e.g., "1.5s", "250ms")
 */
function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * ==========================================
 * Cache Key Utilities
 * ==========================================
 */

/**
 * Generate simple cache key from components
 * @param {...string} components - Key components
 * @returns {string} Cache key
 */
function createCacheKey(...components) {
  return components
    .filter(c => c !== null && c !== undefined)
    .map(c => String(c))
    .join(':');
}

/**
 * Generate fast hash (FNV-1a style) for cache keys
 * @param {string} data - Data to hash
 * @param {string} prefix - Key prefix (default: "cache")
 * @returns {string} Hash key
 */
function hashCacheKey(data, prefix = 'cache') {
  const hash = crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 16);
  return `${prefix}:${hash}`;
}

/**
 * ==========================================
 * Error Handling Utilities
 * ==========================================
 */

/**
 * Create standardized error object
 * @param {string} message - Error message
 * @param {object} options - Additional options
 * @returns {object} Standard error object
 */
function createErrorObject(message, options = {}) {
  return {
    message,
    code: options.code || 'ERROR',
    timestamp: new Date().toISOString(),
    details: options.details || null,
    stack: options.stack || null
  };
}

/**
 * Format error for logging
 * @param {Error|string} error - Error to format
 * @param {object} context - Context information
 * @returns {object} Formatted error
 */
function formatErrorForLogging(error, context = {}) {
  const isError = error instanceof Error;

  return {
    message: isError ? error.message : String(error),
    type: isError ? error.constructor.name : typeof error,
    code: error?.code || 'UNKNOWN',
    stack: isError ? error.stack : null,
    timestamp: new Date().toISOString(),
    context
  };
}

/**
 * Determine if error is retryable
 * @param {Error|string} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  const retryableErrors = [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EPIPE',
    'ENOTFOUND',
    'ENETUNREACH',
    'TIMEOUT'
  ];

  const errorStr = error?.message || error?.toString() || '';
  return retryableErrors.some(e => errorStr.includes(e));
}

/**
 * ==========================================
 * Validation Utilities
 * ==========================================
 */

/**
 * Validate required fields in object
 * @param {object} obj - Object to validate
 * @param {array} requiredFields - Required field names
 * @returns {object} { valid: boolean, errors: array }
 */
function validateRequiredFields(obj, requiredFields) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Object is required');
    return { valid: false, errors };
  }

  requiredFields.forEach(field => {
    if (obj[field] === null || obj[field] === undefined) {
      errors.push(`Field '${field}' is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate data types
 * @param {object} obj - Object to validate
 * @param {object} schema - Type schema { field: 'type', ... }
 * @returns {object} { valid: boolean, errors: array }
 */
function validateTypes(obj, schema) {
  const errors = [];

  if (!obj || typeof obj !== 'object') {
    errors.push('Object is required');
    return { valid: false, errors };
  }

  Object.entries(schema).forEach(([field, expectedType]) => {
    if (field in obj) {
      const actualType = typeof obj[field];
      if (actualType !== expectedType) {
        errors.push(`Field '${field}': expected ${expectedType}, got ${actualType}`);
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * ==========================================
 * Object Utilities
 * ==========================================
 */

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }

  return obj;
}

/**
 * Merge objects recursively
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
function mergeObjects(target, source) {
  const result = { ...target };

  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeObjects(result[key] || {}, value);
    } else {
      result[key] = value;
    }
  });

  return result;
}

/**
 * Pick specific properties from object
 * @param {object} obj - Object to pick from
 * @param {array} keys - Keys to pick
 * @returns {object} New object with only selected keys
 */
function pickProperties(obj, keys) {
  const result = {};

  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });

  return result;
}

/**
 * Omit specific properties from object
 * @param {object} obj - Object to omit from
 * @param {array} keys - Keys to omit
 * @returns {object} New object without selected keys
 */
function omitProperties(obj, keys) {
  const keySet = new Set(keys);
  const result = {};

  Object.entries(obj).forEach(([key, value]) => {
    if (!keySet.has(key)) {
      result[key] = value;
    }
  });

  return result;
}

/**
 * ==========================================
 * Export All Utilities
 * ==========================================
 */

module.exports = {
  // Header utilities
  normalizeHeaders,
  getHeader,
  parseHeaderValue,

  // Data formatting
  formatValue,
  truncateString,
  formatBytes,
  formatDuration,

  // Cache utilities
  createCacheKey,
  hashCacheKey,

  // Error handling
  createErrorObject,
  formatErrorForLogging,
  isRetryableError,

  // Validation
  validateRequiredFields,
  validateTypes,

  // Object utilities
  deepClone,
  mergeObjects,
  pickProperties,
  omitProperties
};

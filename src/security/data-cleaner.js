/**
 * Sensitive Data Cleaning and Masking
 *
 * Prevents exposure of sensitive information:
 * - Passwords and credentials
 * - Tokens and API keys
 * - Personal identifiable information
 * - Financial information
 *
 * Used for:
 * - Error message sanitization
 * - Log sanitization
 * - Response filtering
 * - Memory clearing
 */

const crypto = require('crypto');

class DataCleaner {
  /**
   * Patterns for sensitive data detection
   * Used to identify and mask sensitive fields in logs, errors, and responses
   */
  static SENSITIVE_PATTERNS = {
    // Authentication
    password: /(?:password|passwd|pwd|pass(?:word)?|secret_?pass)/i,
    token: /(?:token|auth|authorization|bearer|jwt|access_?token|refresh_?token|session|oauth_?token|api_?token|auth_?token|temp_?token|provisional_?token|session_?token)/i,
    api_key: /(?:api[._-]?key|apikey|api[._-]?secret|x[._-]?api[._-]?key|private[._-]?key|secret[._-]?key|api[._-]?pass)/i,

    // OAuth/OAuth2
    client_secret: /(?:client_?secret|client_?id|oauth_?secret|oauth_?token|consumer_?secret|consumer_?key)/i,

    // Database
    database: /(?:db_?pass|db_?password|database_?pass|db_?user|db_?username|dsn|connection_?string|mongodb:\/\/.+@)/i,

    // AWS
    aws: /(?:aws_?access_?key|aws_?secret|aws_?token|access_?key_?id|secret_?access_?key|AKIA\w{16})/i,

    // GitHub
    github: /(?:github_?token|github_?key|github_?secret|gh_?pat|ghp_\w+)/i,

    // Personal Information
    ssn: /(?:ssn|social[._-]?security[._-]?number|\d{3}-\d{2}-\d{4})/i,
    credit_card: /(?:credit[._-]?card|cc[._-]?number|card[._-]?number|pan|\d{4}[._-]?\d{4}[._-]?\d{4}[._-]?\d{4})/i,
    cvv: /(?:cvv|cvc|cvc3|cvv2|\d{3})/i,

    // URLs with credentials
    url_credentials: /(?:https?:\/\/[^:]+:[^@]+@)/i,

    // File paths (sensitive)
    file_path: /\/(?:home|root|var|etc|usr|opt)\/[^\s]*/i,

    // IP addresses
    ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

    // Email
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

    // Phone
    phone: /(?:\+\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})/g,

    // JWT tokens
    jwt: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,

    // Crypto keys
    crypto_key: /(?:-----BEGIN|private_?key|secret_?key|rsa_?key|pem)/i
  };

  /**
   * Sensitive key names that should be masked in objects
   */
  static SENSITIVE_KEYS = new RegExp(
    '(password|passwd|pwd|secret|token|key|credential|auth|api[._-]?key|' +
    'private[._-]?key|client[._-]?secret|access[._-]?token|refresh[._-]?token|' +
    'bearer|jwt|oauth|aws[._-]?key|github[._-]?token|ssn|credit[._-]?card|' +
    'cvv|cvc|phone|email|pii|personal|sensitive)',
    'i'
  );

  /**
   * Mask a sensitive value
   * @param {string} value - Value to mask
   * @param {string} type - Type of sensitive data
   * @returns {string} Masked value
   */
  static maskValue(value, type = 'generic') {
    if (!value) return '***';

    const str = String(value);

    // Passwords: show nothing
    if (type === 'password' || type.includes('password') || type.includes('pwd')) {
      return '***';
    }

    // Tokens/Keys: show first 4 and last 4
    if (['token', 'api_key', 'oauth', 'secret', 'key'].some(t => type.includes(t))) {
      if (str.length <= 8) return '***';
      return str.substring(0, 4) + '...' + str.slice(-4);
    }

    // SSN: show only last 4
    if (type === 'ssn' || type.includes('social')) {
      return 'XXX-XX-' + str.slice(-4);
    }

    // Credit card: show only last 4
    if (type === 'credit_card' || type.includes('card')) {
      if (str.length <= 4) return '****';
      return '*'.repeat(str.length - 4) + str.slice(-4);
    }

    // CVV: show nothing
    if (type === 'cvv' || type === 'cvc') {
      return '***';
    }

    // Email: partial mask
    if (type === 'email' && str.includes('@')) {
      const [local, domain] = str.split('@');
      const masked = local.substring(0, 2) + '*'.repeat(Math.max(1, local.length - 4)) + local.slice(-2);
      return masked + '@' + domain;
    }

    // Phone: show only last 4
    if (type === 'phone') {
      return '*'.repeat(Math.max(0, str.length - 4)) + str.slice(-4);
    }

    // Database: partial mask
    if (type === 'database') {
      return str.substring(0, 2) + '*'.repeat(Math.max(0, str.length - 4)) + str.slice(-2);
    }

    // Generic: partial mask
    return str.substring(0, 2) + '*'.repeat(Math.max(0, str.length - 4)) + str.slice(-2);
  }

  /**
   * Detect and mask sensitive values in a string
   * @param {string} text - Text to sanitize
   * @param {boolean} aggressive - Use aggressive detection (may have false positives)
   * @returns {string} Sanitized text
   */
  static sanitizeText(text, aggressive = false) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let sanitized = text;

    // Replace patterns
    for (const [type, pattern] of Object.entries(DataCleaner.SENSITIVE_PATTERNS)) {
      if (pattern.global) {
        // Pattern with 'g' flag (for findall)
        sanitized = sanitized.replace(pattern, match => {
          return DataCleaner.maskValue(match, type);
        });
      } else {
        // Pattern without 'g' flag
        if (pattern.test(sanitized)) {
          sanitized = sanitized.replace(pattern, match => {
            return DataCleaner.maskValue(match, type);
          });
        }
      }
    }

    // Additional aggressive patterns
    if (aggressive) {
      // Mask URLs with credentials
      sanitized = sanitized.replace(/https?:\/\/[^:]+:[^@]+@/g, 'https://***:***@');

      // Mask IP addresses
      sanitized = sanitized.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '***.***.***.*');
    }

    return sanitized;
  }

  /**
   * Sanitize an error object
   * @param {Error} error - Error to sanitize
   * @param {boolean} includeStack - Include stack trace in production
   * @returns {Object} Sanitized error object
   */
  static sanitizeError(error, includeStack = false) {
    if (!error) {
      return { message: 'Unknown error', code: 'UNKNOWN_ERROR' };
    }

    const sanitized = {
      message: DataCleaner.sanitizeText(error.message || String(error)),
      code: error.code || 'ERROR',
      name: error.name || 'Error'
    };

    // Include stack trace only if requested and not in production
    if (includeStack && process.env.NODE_ENV !== 'production') {
      const stack = (error.stack || '').split('\n');
      sanitized.stack = stack.map(line => {
        // Sanitize paths and other sensitive info
        return DataCleaner.sanitizeText(line, true)
          .replace(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, '[path]');
      }).join('\n');
    }

    return sanitized;
  }

  /**
   * Sanitize an object by masking sensitive fields
   * @param {Object} obj - Object to sanitize
   * @param {number} depth - Current recursion depth (default: 0)
   * @param {number} maxDepth - Maximum recursion depth (default: 5)
   * @returns {Object} Sanitized copy
   */
  static sanitizeObject(obj, depth = 0, maxDepth = 5) {
    // Stop at max depth to prevent infinite recursion
    if (depth > maxDepth || obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item =>
        DataCleaner.sanitizeObject(item, depth + 1, maxDepth)
      );
    }

    // Handle objects
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Check if key looks like it contains sensitive data
      if (DataCleaner.SENSITIVE_KEYS.test(key)) {
        sanitized[key] = DataCleaner.maskValue(String(value), key);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitized[key] = DataCleaner.sanitizeObject(value, depth + 1, maxDepth);
      } else if (typeof value === 'string') {
        // Sanitize strings for any embedded patterns
        sanitized[key] = DataCleaner.sanitizeText(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Create a version of data safe for logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized copy
   */
  static sanitizeForLogging(data) {
    return DataCleaner.sanitizeObject(data, 0, 3);
  }

  /**
   * Create a version of data safe for error responses
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized copy
   */
  static sanitizeForResponse(data) {
    // More aggressive sanitization for responses
    const sanitized = DataCleaner.sanitizeObject(data, 0, 3);

    // Remove certain keys entirely from responses
    const keysToRemove = ['password', 'secret', 'privateKey', 'token', 'apiKey'];
    const removeKeys = (obj) => {
      for (const key of keysToRemove) {
        delete obj[key];
      }
      for (const value of Object.values(obj)) {
        if (typeof value === 'object' && value !== null) {
          removeKeys(value);
        }
      }
    };

    removeKeys(sanitized);
    return sanitized;
  }

  /**
   * Clear a sensitive value from memory
   * @param {Buffer|string} data - Data to clear
   * @returns {void}
   */
  static clearMemory(data) {
    if (Buffer.isBuffer(data)) {
      // Overwrite buffer with zeros
      data.fill(0);
    } else if (typeof data === 'string') {
      // Strings are immutable in JavaScript, but we can try
      // to help garbage collection by clearing references
      return null;
    } else if (typeof data === 'object' && data !== null) {
      // Clear object properties
      for (const key in data) {
        if (data.hasOwnProperty(key)) {
          if (Buffer.isBuffer(data[key])) {
            data[key].fill(0);
          }
          delete data[key];
        }
      }
    }
  }

  /**
   * Create an auto-clearing secure buffer
   * @param {string} data - Data to store securely
   * @param {number} timeout - Time before clearing (ms)
   * @returns {Object} { buffer, clear() }
   */
  static createSecureBuffer(data, timeout = 30000) {
    const buffer = Buffer.from(data);
    let isCleared = false;

    const secureBuffer = {
      buffer,
      get data() {
        if (isCleared) {
          throw new Error('Buffer has been cleared');
        }
        return buffer.toString();
      },
      clear: () => {
        if (!isCleared) {
          buffer.fill(0);
          isCleared = true;
        }
      },
      isCleared: () => isCleared
    };

    // Auto-clear after timeout
    setTimeout(() => {
      secureBuffer.clear();
    }, timeout);

    return secureBuffer;
  }

  /**
   * Get statistics on detection patterns
   * @returns {Object} Statistics
   */
  static getStats() {
    return {
      totalPatterns: Object.keys(DataCleaner.SENSITIVE_PATTERNS).length,
      patterns: Object.keys(DataCleaner.SENSITIVE_PATTERNS)
    };
  }
}

module.exports = { DataCleaner };

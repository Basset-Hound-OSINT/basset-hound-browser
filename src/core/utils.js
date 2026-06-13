/**
 * Core Utilities Module
 *
 * Common utility functions used across modules:
 * - Validation helpers
 * - Caching utilities
 * - Memoization
 * - Type checking
 * - Error recovery
 *
 * @module core/utils
 */

const { createLogger } = require('../logging');

const logger = createLogger('CoreUtils');

/**
 * Simple memoization wrapper for pure functions
 * @param {Function} fn - Function to memoize
 * @param {number} ttl - Time to live in milliseconds (default: 1 hour)
 * @returns {Function} Memoized function
 */
function memoize(fn, ttl = 3600000) {
  const cache = new Map();

  return function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const { value, timestamp } = cache.get(key);
      if (Date.now() - timestamp < ttl) {
        return value;
      }
      cache.delete(key);
    }

    const value = fn.apply(this, args);
    cache.set(key, { value, timestamp: Date.now() });

    return value;
  };
}

/**
 * Async memoization wrapper
 * @param {Function} fn - Async function to memoize
 * @param {number} ttl - Time to live in milliseconds
 * @returns {Function} Memoized async function
 */
function memoizeAsync(fn, ttl = 3600000) {
  const cache = new Map();

  return async function (...args) {
    const key = JSON.stringify(args);

    if (cache.has(key)) {
      const { value, timestamp } = cache.get(key);
      if (Date.now() - timestamp < ttl) {
        return value;
      }
      cache.delete(key);
    }

    const value = await fn.apply(this, args);
    cache.set(key, { value, timestamp: Date.now() });

    return value;
  };
}

/**
 * Debounce function calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, delay = 300) {
  let timeoutId = null;

  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle function calls
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, limit = 300) {
  let inThrottle = false;

  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Retry operation with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Function result
 */
async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = 2,
    onRetry = null,
    timeout = null
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (timeout) {
        return await withTimeout(fn(), timeout);
      }
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts - 1) {
        const waitTime = delay * Math.pow(backoff, attempt);
        logger.debug(`Retry attempt ${attempt + 1}/${maxAttempts}, waiting ${waitTime}ms`, { error: error.message });

        if (onRetry) {
          onRetry(attempt + 1, waitTime, error);
        }

        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

/**
 * Execute with timeout
 * @param {Promise} promise - Promise to execute
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise<any>} Result or timeout error
 */
async function withTimeout(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    )
  ]);
}

/**
 * Sleep/delay
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Deep clone object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Merge objects (shallow merge)
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function merge(...objects) {
  return Object.assign({}, ...objects);
}

/**
 * Deep merge objects
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function deepMerge(...objects) {
  const result = {};

  for (const obj of objects) {
    if (!obj || typeof obj !== 'object') continue;

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      if (result[key] && typeof result[key] === 'object' && typeof obj[key] === 'object') {
        result[key] = deepMerge(result[key], obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
  }

  return result;
}

/**
 * Check if value is empty
 * @param {any} value - Value to check
 * @returns {boolean} True if empty
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely parse JSON
 * @param {string} json - JSON string
 * @param {any} fallback - Fallback value
 * @returns {any} Parsed object or fallback
 */
function safeJsonParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch (error) {
    logger.warn('JSON parse error', { error: error.message });
    return fallback;
  }
}

/**
 * Safely stringify object
 * @param {any} obj - Object to stringify
 * @param {any} fallback - Fallback string
 * @returns {string} JSON string or fallback
 */
function safeJsonStringify(obj, fallback = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    logger.warn('JSON stringify error', { error: error.message });
    return fallback;
  }
}

/**
 * Get nested object value
 * @param {Object} obj - Object to traverse
 * @param {string} path - Path using dot notation (e.g., 'a.b.c')
 * @param {any} fallback - Fallback value
 * @returns {any} Value or fallback
 */
function getNestedValue(obj, path, fallback = null) {
  if (!obj || typeof obj !== 'object') return fallback;

  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return fallback;
    }
  }

  return value;
}

/**
 * Set nested object value
 * @param {Object} obj - Object to modify
 * @param {string} path - Path using dot notation
 * @param {any} value - Value to set
 * @returns {Object} Modified object
 */
function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return obj;
}

/**
 * Flatten nested object
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix
 * @returns {Object} Flattened object
 */
function flattenObject(obj, prefix = '') {
  const result = {};

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const newKey = prefix ? `${prefix}.${key}` : key;

    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }

  return result;
}

module.exports = {
  // Memoization
  memoize,
  memoizeAsync,

  // Timing utilities
  debounce,
  throttle,
  retry,
  withTimeout,
  sleep,

  // Object utilities
  deepClone,
  merge,
  deepMerge,
  isEmpty,
  getNestedValue,
  setNestedValue,
  flattenObject,

  // Validation
  isValidEmail,
  isValidUrl,

  // JSON utilities
  safeJsonParse,
  safeJsonStringify
};

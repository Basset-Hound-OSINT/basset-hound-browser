/**
 * @fileoverview Async operation utilities
 *
 * Provides common async patterns like retry logic, circuit breaker,
 * and batch operations to reduce code duplication.
 *
 * @module utils/async-utils
 */

const { CircuitBreakerError, TimeoutError } = require('./errors');

/**
 * Retry an async operation with exponential backoff.
 *
 * @async
 * @template T
 * @param {Function} asyncFn - Async function to retry
 * @param {Object} [options={}] - Retry configuration
 * @param {number} [options.maxRetries=3] - Maximum retry attempts (0 = no retries)
 * @param {number} [options.initialDelay=1000] - Initial delay in milliseconds
 * @param {number} [options.maxDelay=30000] - Maximum delay in milliseconds
 * @param {number} [options.backoffMultiplier=2] - Exponential backoff multiplier
 * @param {Function} [options.shouldRetry] - Custom retry predicate (receives error)
 * @param {Function} [options.onRetry] - Callback on each retry (receives: attempt, error, nextDelay)
 * @param {*} [options.thisArg=null] - Context for function execution
 * @returns {Promise<T>} Function result
 * @throws {Error} Last error after all retries exhausted
 *
 * @example
 * const data = await retryAsync(
 *   async () => fetchData(url),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 500,
 *     onRetry: (attempt, error, nextDelay) => {
 *       console.log(`Retry ${attempt} in ${nextDelay}ms: ${error.message}`);
 *     }
 *   }
 * );
 */
async function retryAsync(asyncFn, options = {}) {
  if (typeof asyncFn !== 'function') {
    throw new TypeError('First argument must be an async function');
  }

  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = null,
    onRetry = null,
    thisArg = null
  } = options;

  let lastError;
  let currentDelay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await (thisArg ? asyncFn.call(thisArg) : asyncFn());
    } catch (error) {
      lastError = error;

      // Check if we should retry based on error type
      if (typeof shouldRetry === 'function' && !shouldRetry(error)) {
        throw error;
      }

      // If no more retries, throw
      if (attempt >= maxRetries) {
        break;
      }

      // Call retry callback
      if (typeof onRetry === 'function') {
        try {
          onRetry(attempt + 1, error, currentDelay);
        } catch (callbackError) {
          // Silently ignore callback errors
        }
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, currentDelay));

      // Increase delay for next retry
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Simple circuit breaker implementation for preventing cascading failures.
 *
 * @class CircuitBreaker
 *
 * @param {Function} asyncFn - Async function to protect
 * @param {Object} [options={}] - Configuration
 * @param {number} [options.failureThreshold=5] - Failures before circuit opens
 * @param {number} [options.successThreshold=2] - Successes to close circuit after opening
 * @param {number} [options.timeout=60000] - Time before attempting half-open state (ms)
 * @param {Function} [options.onOpen] - Callback when circuit opens
 * @param {Function} [options.onClose] - Callback when circuit closes
 * @param {Function} [options.shouldOpen] - Custom predicate for opening circuit
 */
class CircuitBreaker {
  /**
   * Create a new circuit breaker.
   * @param {Function} asyncFn - Function to protect
   * @param {Object} options - Configuration options
   */
  constructor(asyncFn, options = {}) {
    this.asyncFn = asyncFn;
    this.state = 'closed'; // 'closed', 'open', 'half-open'
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;

    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000;
    this.onOpen = options.onOpen || null;
    this.onClose = options.onClose || null;
    this.shouldOpen = options.shouldOpen || null;
  }

  /**
   * Execute the protected function.
   *
   * @async
   * @returns {Promise<*>} Function result
   * @throws {CircuitBreakerError} If circuit is open
   * @throws {Error} If function fails
   */
  async execute() {
    // Check if we should transition from open to half-open
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;
      if (timeSinceFailure >= this.timeout) {
        this.state = 'half-open';
        this.successCount = 0;
      } else {
        throw new CircuitBreakerError(
          `Circuit breaker is open (${Math.ceil((this.timeout - timeSinceFailure) / 1000)}s remaining)`
        );
      }
    }

    // Attempt execution
    try {
      const result = await this.asyncFn();

      // Success
      if (this.state === 'half-open') {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.reset();
        }
      } else if (this.state === 'closed') {
        this.failureCount = 0;
      }

      return result;
    } catch (error) {
      // Failure
      this.lastFailureTime = Date.now();

      if (this.state === 'half-open') {
        // Reopen circuit
        this.state = 'open';
        if (typeof this.onOpen === 'function') {
          try { this.onOpen(error); } catch (e) { /* ignore */ }
        }
        throw error;
      }

      // In closed state
      this.failureCount++;

      if (typeof this.shouldOpen === 'function' && this.shouldOpen(error)) {
        this.open();
      } else if (this.failureCount >= this.failureThreshold) {
        this.open();
      }

      throw error;
    }
  }

  /**
   * Open the circuit manually.
   */
  open() {
    if (this.state !== 'open') {
      this.state = 'open';
      this.lastFailureTime = Date.now();
      if (typeof this.onOpen === 'function') {
        try { this.onOpen(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Reset the circuit to closed state.
   */
  reset() {
    if (this.state !== 'closed') {
      this.state = 'closed';
      this.failureCount = 0;
      this.successCount = 0;
      this.lastFailureTime = null;
      if (typeof this.onClose === 'function') {
        try { this.onClose(); } catch (e) { /* ignore */ }
      }
    }
  }

  /**
   * Get current circuit state.
   * @returns {string} State ('closed', 'open', or 'half-open')
   */
  getState() {
    return this.state;
  }

  /**
   * Get circuit statistics.
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Execute async operations in parallel with a concurrency limit.
 *
 * @async
 * @template T
 * @param {Array<Function>} asyncFns - Array of async functions
 * @param {number} [concurrency=3] - Maximum concurrent operations
 * @returns {Promise<Array<T>>} Results in same order as input
 * @throws {Error} If any operation fails
 *
 * @example
 * const results = await parallelAsync(
 *   [fetchUser1, fetchUser2, fetchUser3],
 *   2 // max 2 concurrent
 * );
 */
async function parallelAsync(asyncFns, concurrency = 3) {
  if (!Array.isArray(asyncFns)) {
    throw new TypeError('First argument must be an array');
  }

  if (asyncFns.length === 0) {
    return [];
  }

  const results = new Array(asyncFns.length);
  const executing = [];
  let index = 0;

  async function executeNext() {
    if (index >= asyncFns.length) {
      return;
    }

    const currentIndex = index++;
    const fn = asyncFns[currentIndex];

    try {
      results[currentIndex] = await fn();
    } catch (error) {
      results[currentIndex] = error;
      throw error;
    } finally {
      // Remove from executing list
      const position = executing.indexOf(promise);
      if (position !== -1) {
        executing.splice(position, 1);
      }

      // Start next operation if available
      if (index < asyncFns.length) {
        executing.push(executeNext());
      }
    }
  }

  // Start initial batch
  for (let i = 0; i < Math.min(concurrency, asyncFns.length); i++) {
    executing.push(executeNext());
  }

  // Wait for all to complete
  await Promise.all(executing);

  return results;
}

/**
 * Execute async operations sequentially, stopping on first failure.
 *
 * @async
 * @template T
 * @param {Array<Function>} asyncFns - Array of async functions
 * @param {Function} [onProgress] - Progress callback (receives: index, total, result)
 * @returns {Promise<Array<T>>} Results in same order as input
 * @throws {Error} If any operation fails
 *
 * @example
 * const results = await sequentialAsync(
 *   [fetchA, fetchB, fetchC],
 *   (idx, total, result) => console.log(`${idx}/${total} complete`)
 * );
 */
async function sequentialAsync(asyncFns, onProgress = null) {
  if (!Array.isArray(asyncFns)) {
    throw new TypeError('First argument must be an array');
  }

  const results = [];

  for (let i = 0; i < asyncFns.length; i++) {
    const result = await asyncFns[i]();
    results.push(result);

    if (typeof onProgress === 'function') {
      try {
        onProgress(i + 1, asyncFns.length, result);
      } catch (e) {
        // Silently ignore progress callback errors
      }
    }
  }

  return results;
}

/**
 * Memoize async function results based on arguments.
 *
 * @template T
 * @param {Function} asyncFn - Async function to memoize
 * @param {Object} [options={}] - Configuration
 * @param {number} [options.ttl=3600000] - Time-to-live in milliseconds (1 hour default)
 * @param {Function} [options.keyGenerator] - Custom cache key generator
 * @returns {Function} Memoized function
 *
 * @example
 * const memoizedFetch = memoizeAsync(
 *   async (url) => fetch(url).then(r => r.json()),
 *   { ttl: 300000 } // 5 minute cache
 * );
 */
function memoizeAsync(asyncFn, options = {}) {
  if (typeof asyncFn !== 'function') {
    throw new TypeError('First argument must be a function');
  }

  const {
    ttl = 3600000,
    keyGenerator = null
  } = options;

  const cache = new Map();

  return async function memoizedFn(...args) {
    const key = typeof keyGenerator === 'function'
      ? keyGenerator(...args)
      : JSON.stringify(args);

    // Check cache
    if (cache.has(key)) {
      const { result, expiresAt } = cache.get(key);
      if (Date.now() < expiresAt) {
        return result;
      }
      // Expired, remove from cache
      cache.delete(key);
    }

    // Execute and cache
    const result = await asyncFn.apply(this, args);
    cache.set(key, {
      result,
      expiresAt: Date.now() + ttl
    });

    return result;
  };
}

/**
 * Debounce an async function - only execute if not called again within delay.
 *
 * @template T
 * @param {Function} asyncFn - Async function to debounce
 * @param {number} [delay=300] - Debounce delay in milliseconds
 * @param {Object} [options={}] - Configuration
 * @param {boolean} [options.leading=false] - Execute on leading edge
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSearch = debounceAsync(
 *   async (query) => search(query),
 *   500
 * );
 */
function debounceAsync(asyncFn, delay = 300, options = {}) {
  if (typeof asyncFn !== 'function') {
    throw new TypeError('First argument must be a function');
  }

  const { leading = false } = options;
  let timeoutId;
  let lastResult;
  let lastPromise;

  return function debouncedFn(...args) {
    return new Promise((resolve, reject) => {
      const callNow = leading && !lastPromise;

      // Execute immediately if leading edge
      if (callNow) {
        lastPromise = asyncFn.apply(this, args);
        lastResult = { resolve, reject, promise: lastPromise };
      }

      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new timeout
      timeoutId = setTimeout(async () => {
        try {
          const result = await asyncFn.apply(this, args);
          resolve(result);
          lastResult = { resolve, reject, result };
        } catch (error) {
          reject(error);
          lastResult = { resolve, reject, error };
        }
      }, delay);

      // Return last promise if not leading
      if (!callNow && lastPromise) {
        lastPromise.then(resolve).catch(reject);
      }
    });
  };
}

module.exports = {
  retryAsync,
  CircuitBreaker,
  parallelAsync,
  sequentialAsync,
  memoizeAsync,
  debounceAsync
};

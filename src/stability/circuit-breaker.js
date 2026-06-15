/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services (e.g., Tor) are unavailable
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service unavailable, requests fail immediately without calling service
 * - HALF_OPEN: Testing if service recovered, single request passes through
 *
 * @module src/stability/circuit-breaker
 */

const { EventEmitter } = require('events');

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN'
};

/**
 * CircuitBreaker - Prevents cascading failures
 */
class CircuitBreaker extends EventEmitter {
  /**
   * Create a circuit breaker
   * @param {Object} options - Configuration options
   * @param {number} options.failureThreshold - Failures before opening (default: 5)
   * @param {number} options.resetTimeoutMs - Time before HALF_OPEN retry (default: 60000)
   * @param {string} options.name - Name for logging (default: 'CircuitBreaker')
   */
  constructor(options = {}) {
    super();

    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeoutMs = options.resetTimeoutMs || 60000; // 1 minute

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;

    // Statistics for monitoring
    this.stats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      circuitOpenCount: 0,
      lastStateChangeTime: Date.now()
    };
  }

  /**
   * Get current state
   * @returns {string} Current state (CLOSED, OPEN, or HALF_OPEN)
   */
  getState() {
    return this.state;
  }

  /**
   * Get statistics
   * @returns {Object} Circuit breaker statistics
   */
  getStats() {
    return {
      ...this.stats,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      timeSinceLastChange: Date.now() - this.stats.lastStateChangeTime
    };
  }

  /**
   * Reset circuit to CLOSED state
   */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stats.lastStateChangeTime = Date.now();
    this.emit('reset', { state: this.state });
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @param {Function} fallback - Fallback function if circuit is open
   * @returns {Promise} Result from fn or fallback
   * @throws {Error} If circuit is open and no fallback provided
   */
  async execute(fn, fallback = null) {
    this.stats.totalRequests++;

    // If circuit is OPEN, check if time to transition to HALF_OPEN
    if (this.state === STATES.OPEN) {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        // Time to try recovery
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
        this.emit('stateChange', { from: STATES.OPEN, to: STATES.HALF_OPEN });
      } else {
        // Still in failure window, use fallback or reject
        if (fallback) {
          return fallback();
        }
        const error = new Error(
          `Circuit breaker is OPEN (${this.name}). ` +
          `Retry after ${Math.ceil((this.resetTimeoutMs - (Date.now() - this.lastFailureTime)) / 1000)}s`
        );
        error.code = 'CIRCUIT_OPEN';
        throw error;
      }
    }

    try {
      const result = await fn();

      // Success - update stats
      this.stats.totalSuccesses++;
      this.failureCount = 0;

      if (this.state === STATES.HALF_OPEN) {
        // Successfully recovered, close circuit
        this.state = STATES.CLOSED;
        this.emit('stateChange', { from: STATES.HALF_OPEN, to: STATES.CLOSED });
        this.stats.lastStateChangeTime = Date.now();
      }

      return result;
    } catch (error) {
      // Failure - update stats
      this.stats.totalFailures++;
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === STATES.HALF_OPEN) {
        // Failed recovery attempt, reopen
        this.state = STATES.OPEN;
        this.stats.circuitOpenCount++;
        this.emit('stateChange', { from: STATES.HALF_OPEN, to: STATES.OPEN });
        this.stats.lastStateChangeTime = Date.now();
      } else if (this.failureCount >= this.failureThreshold) {
        // Threshold reached, open circuit
        this.state = STATES.OPEN;
        this.stats.circuitOpenCount++;
        this.emit('stateChange', { from: STATES.CLOSED, to: STATES.OPEN });
        this.stats.lastStateChangeTime = Date.now();
        this.emit('open', {
          failureCount: this.failureCount,
          lastError: error.message
        });
      }

      throw error;
    }
  }

  /**
   * Get human-readable status
   * @returns {string} Status description
   */
  getStatus() {
    const states = {
      [STATES.CLOSED]: 'Normal operation',
      [STATES.OPEN]: `Failing (${this.failureCount}/${this.failureThreshold} failures)`,
      [STATES.HALF_OPEN]: 'Recovering (testing service)'
    };
    return states[this.state] || 'Unknown';
  }
}

module.exports = {
  CircuitBreaker,
  STATES
};

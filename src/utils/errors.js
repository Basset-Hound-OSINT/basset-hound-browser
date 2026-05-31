/**
 * @fileoverview Custom error classes for utilities
 *
 * Defines custom error types used throughout the utilities module.
 *
 * @module utils/errors
 */

/**
 * Error thrown when a circuit breaker is in the open state
 * @class CircuitBreakerError
 */
class CircuitBreakerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CircuitBreakerError';
    this.code = 'CIRCUIT_BREAKER_OPEN';
  }
}

/**
 * Error thrown when an operation exceeds its timeout
 * @class TimeoutError
 */
class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
    this.code = 'TIMEOUT';
  }
}

/**
 * Error thrown for validation failures
 * @class ValidationError
 */
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

/**
 * Error thrown when resources are exhausted
 * @class ResourceError
 */
class ResourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ResourceError';
    this.code = 'RESOURCE_ERROR';
  }
}

module.exports = {
  CircuitBreakerError,
  TimeoutError,
  ValidationError,
  ResourceError
};

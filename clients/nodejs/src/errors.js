/**
 * Custom error classes for Basset Hound Browser client
 */

/**
 * Base error class for all Basset Hound errors
 */
class BassetHoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BassetHoundError';
  }
}

/**
 * Error thrown when connection to the browser fails
 */
class ConnectionError extends BassetHoundError {
  constructor(message) {
    super(message);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when a command execution fails
 */
class CommandError extends BassetHoundError {
  /**
   * @param {string} message - Error message
   * @param {string} [command] - Command that failed
   * @param {Object} [details] - Additional error details
   */
  constructor(message, command = null, details = {}) {
    super(message);
    this.name = 'CommandError';
    this.command = command;
    this.details = details;
  }
}

/**
 * Error thrown when a command times out
 */
class TimeoutError extends BassetHoundError {
  /**
   * @param {string} message - Error message
   * @param {number} [timeout] - Timeout value in ms
   */
  constructor(message, timeout = null) {
    super(message);
    this.name = 'TimeoutError';
    this.timeout = timeout;
  }
}

module.exports = {
  BassetHoundError,
  ConnectionError,
  CommandError,
  TimeoutError
};

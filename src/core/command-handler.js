/**
 * Command Handler Base Class
 *
 * Provides base class for all WebSocket command handlers with:
 * - Standardized execution interface
 * - Error handling and recovery
 * - Validation and preconditions
 * - Logging and monitoring
 * - Retry policy support
 *
 * Usage:
 * ```javascript
 * class NavigateCommand extends CommandHandler {
 *   get name() { return 'navigate'; }
 *   get isIdempotent() { return true; }
 *
 *   validateParams(params) {
 *     if (!params.url) throw new ValidationError('URL required');
 *   }
 *
 *   async execute(params) {
 *     return await this.browser.navigate(params.url);
 *   }
 * }
 * ```
 *
 * @module core/command-handler
 */

const { createLogger } = require('../logging');
const { ValidationError, InternalError } = require('./errors');

class CommandHandler {
  constructor(options = {}) {
    this.logger = createLogger(this.constructor.name);
    this.browser = options.browser;
    this.retryable = options.retryable !== false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Command name (must be overridden by subclasses)
   */
  get name() {
    throw new Error('Subclass must implement name getter');
  }

  /**
   * Whether command is idempotent (safe to retry)
   */
  get isIdempotent() {
    return false;
  }

  /**
   * Execute command with validation and error handling
   * @param {Object} params - Command parameters
   * @returns {Promise<Object>} Command result
   */
  async handle(params = {}) {
    const startTime = Date.now();

    try {
      // Validate parameters
      this.validateParams(params);

      // Check preconditions
      await this.checkPreconditions(params);

      // Execute command
      const result = await this.execute(params);

      // Validate result
      this.validateResult(result);

      // Log success
      const duration = Date.now() - startTime;
      this.logger.info(`Command ${this.name} completed`, {
        duration,
        params: this._sanitizeParams(params),
        resultSize: JSON.stringify(result).length
      });

      return {
        success: true,
        ...result,
        _metadata: {
          command: this.name,
          duration,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return this._handleError(error, params, startTime);
    }
  }

  /**
   * Execute command (must be overridden by subclasses)
   */
  async execute(params) {
    throw new Error('Subclass must implement execute()');
  }

  /**
   * Validate input parameters
   * Default: no validation. Override in subclasses.
   */
  validateParams(params) {
    // Override in subclasses
  }

  /**
   * Check preconditions before execution
   * Default: no preconditions. Override in subclasses.
   */
  async checkPreconditions(params) {
    // Override in subclasses
  }

  /**
   * Validate command result
   * Default: require success property. Override in subclasses.
   */
  validateResult(result) {
    if (!result || typeof result !== 'object') {
      throw new InternalError('Command must return object result');
    }
  }

  /**
   * Handle execution error with retry logic
   */
  async _handleError(error, params, startTime) {
    const duration = Date.now() - startTime;

    // Determine if error is retryable
    const isRetryable = this.isIdempotent && this._isRetryableError(error);

    if (isRetryable && this.retryable) {
      return await this._retryWithBackoff(params, 0, error);
    }

    // Log error
    this.logger.error(`Command ${this.name} failed`, {
      error: error.message,
      code: error.code,
      duration,
      isRetryable,
      params: this._sanitizeParams(params)
    });

    return {
      success: false,
      error: error.message,
      code: error.code || 'COMMAND_ERROR',
      isRetryable,
      _metadata: {
        command: this.name,
        duration,
        timestamp: new Date().toISOString(),
        attemptCount: 1
      }
    };
  }

  /**
   * Retry with exponential backoff
   */
  async _retryWithBackoff(params, attemptCount, lastError) {
    if (attemptCount >= this.maxRetries) {
      // Max retries exceeded
      this.logger.warn(`Command ${this.name} exceeded max retries (${this.maxRetries})`);
      return {
        success: false,
        error: lastError.message,
        code: lastError.code || 'MAX_RETRIES_EXCEEDED',
        _metadata: {
          command: this.name,
          attemptCount: attemptCount + 1,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Calculate backoff delay
    const delay = this.retryDelay * Math.pow(2, attemptCount);

    this.logger.info(`Retrying command ${this.name} after ${delay}ms (attempt ${attemptCount + 1}/${this.maxRetries})`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      // Attempt execution again
      const result = await this.execute(params);
      this.validateResult(result);

      this.logger.info(`Command ${this.name} succeeded on retry attempt ${attemptCount + 1}`);

      return {
        success: true,
        ...result,
        _metadata: {
          command: this.name,
          attemptCount: attemptCount + 2,
          timestamp: new Date().toISOString(),
          retriedAfterMs: delay
        }
      };
    } catch (error) {
      // Retry again
      return this._retryWithBackoff(params, attemptCount + 1, error);
    }
  }

  /**
   * Check if error is retryable
   */
  _isRetryableError(error) {
    const retryableMessages = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EPIPE',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
      'TIMEOUT',
      'temporarily unavailable'
    ];

    const message = error?.message || error?.toString() || '';
    return retryableMessages.some(msg => message.includes(msg));
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  _sanitizeParams(params) {
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret', 'credential'];
    const sanitized = { ...params };

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '***REDACTED***';
      }
    }

    return sanitized;
  }
}

module.exports = CommandHandler;

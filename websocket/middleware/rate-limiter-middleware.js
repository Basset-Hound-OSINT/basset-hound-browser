/**
 * Rate Limiter Middleware Module
 * Responsibility: Enforce rate limiting and concurrency limits
 * - Rate limit checks
 * - Concurrency limit validation
 * - Status reporting
 *
 * This module is part of WebSocket Server refactoring to reduce monolithic complexity
 * Original code: websocket/server.js (lines 1646-1663)
 */

const { ErrorFormatter } = require('../error-formatter');

class RateLimiterMiddleware {
  constructor(server) {
    this.server = server;
    this.logger = server.logger;
  }

  /**
   * Middleware to check rate limits
   * @param {Object} ws - WebSocket connection
   * @param {Object} data - Command data
   * @returns {Object} { allowed: boolean, reason?: string }
   */
  checkRateLimit(ws, data) {
    // Don't rate limit auth or status commands
    if (['authenticate', 'get_rate_limit_status', 'check_auth'].includes(data.command)) {
      return { allowed: true };
    }

    const rateLimitResult = this.server.checkRateLimit(ws.clientId);
    if (!rateLimitResult.allowed) {
      this.server.metricsCollector?.recordRateLimitEvent(true);
      this.server.metricsCollector?.recordClientRateLimited();
      return {
        allowed: false,
        error: ErrorFormatter.rateLimitError(rateLimitResult, data.command, data.id)
      };
    }

    this.server.metricsCollector?.recordRateLimitEvent(false);
    return { allowed: true };
  }

  /**
   * Middleware to check concurrency limits
   * @param {Object} ws - WebSocket connection
   * @param {Object} data - Command data
   * @returns {Object} { allowed: boolean, error?: Object }
   */
  checkConcurrency(ws, data) {
    const concurrencyCheck = this.server.checkConcurrentOperations(ws.clientId);
    if (!concurrencyCheck.allowed) {
      return {
        allowed: false,
        error: ErrorFormatter.concurrencyLimitError(concurrencyCheck, data.command, data.id)
      };
    }
    return { allowed: true };
  }

  /**
   * Middleware to validate request size
   * @param {Buffer|string} message - Raw message
   * @param {string} command - Command name
   * @returns {Object} { valid: boolean, error?: Object }
   */
  validateRequestSize(message, command) {
    const validation = this.server.requestSizeValidator?.validateMessageSize(message, command);
    if (!validation?.valid) {
      return {
        valid: false,
        error: ErrorFormatter.payloadTooLargeError(
          validation?.actual || 0,
          validation?.limit || 0,
          command,
          null,
          false
        )
      };
    }
    return { valid: true };
  }
}

module.exports = { RateLimiterMiddleware };

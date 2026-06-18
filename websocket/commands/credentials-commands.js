/**
 * WebSocket Credentials Commands (TOTP/HOTP)
 *
 * Provides the following WebSocket commands:
 * - generate_totp: Generate time-based one-time password
 * - validate_totp: Validate TOTP token
 * - generate_hotp: Generate counter-based one-time password
 * - validate_hotp: Validate HOTP token
 * - resync_hotp: Resynchronize HOTP counter
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { TOTPGenerator, HOTPGenerator } = require('../../src/credentials');
const { requireWSS } = require('../middleware/tls-enforcement');
const CredentialRateLimiter = require('../../src/infrastructure/credential-rate-limiter');

// Shared rate limiter instance for credential validation
const validationRateLimiter = new CredentialRateLimiter(5, 60000); // 5 attempts per 60 seconds

/**
 * Register credentials command handlers
 * @param {Object} commandHandlers - Command handlers object from WebSocket server
 */
function registerCredentialsCommands(commandHandlers) {
  /**
   * Command: generate_totp
   * Generate a time-based one-time password (RFC 6238)
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - algorithm (string, optional): 'SHA1' (default), 'SHA256', 'SHA512'
   *   - window (number, optional): Time window in seconds (default 30)
   *   - digits (number, optional): Token length 6-8 (default 6)
   *
   * Returns: {success, token, expiresAt, validFor, timeRemaining}
   */
  commandHandlers.generate_totp = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }
    try {
      const { secret, algorithm = 'SHA1', window = 30, digits = 6 } = params;

      if (!secret) {
        return { success: false, error: 'Secret is required' };
      }

      const totp = new TOTPGenerator(secret, {
        algorithm,
        window,
        digits
      });

      const result = totp.generate();
      const timeRemaining = totp.getTimeRemaining();

      return {
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
        validFor: result.validFor,
        timeRemaining,
        digits,
        algorithm,
        window
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: validate_totp
   * Validate a TOTP token (with drift tolerance)
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - token (string, required): Token to validate (6-8 digits)
   *   - window (number, optional): Drift tolerance in windows (default 1)
   *   - algorithm (string, optional): 'SHA1' (default), 'SHA256', 'SHA512'
   *   - timeWindow (number, optional): Time window in seconds (default 30)
   *
   * Returns: {success, valid, message}
   */
  commandHandlers.validate_totp = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }

    // Check rate limiting on failed attempts
    const clientIP = context.remoteAddress || 'unknown';
    const rateLimitCheck = validationRateLimiter.isAllowed(clientIP);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: rateLimitCheck.message,
        waitSeconds: Math.ceil(rateLimitCheck.waitMs / 1000),
        attemptsRemaining: 0
      };
    }
    try {
      const { secret, token, window = 1, algorithm = 'SHA1', timeWindow = 30 } = params;

      if (!secret || !token) {
        validationRateLimiter.recordFailure(clientIP);
        return { success: false, error: 'Secret and token are required' };
      }

      const totp = new TOTPGenerator(secret, {
        algorithm,
        window: timeWindow
      });

      const isValid = totp.validate(token, window);

      if (isValid) {
        // Record successful validation
        validationRateLimiter.recordSuccess(clientIP);
      } else {
        // Record failed validation attempt
        validationRateLimiter.recordFailure(clientIP);
      }

      const response = {
        success: true,
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid or expired',
        token,
        driftWindow: window
      };

      // Add rate limiting info if approaching limit
      const status = validationRateLimiter.getStatus(clientIP);
      if (status.attemptCount > 0) {
        response.attemptsRemaining = Math.max(0, status.maxAttempts - status.attemptCount);
      }

      return response;
    } catch (error) {
      validationRateLimiter.recordFailure(clientIP);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: generate_hotp
   * Generate a counter-based one-time password (RFC 4226)
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - counter (number, optional): Counter value (default 0)
   *   - algorithm (string, optional): 'SHA1' (default), 'SHA256', 'SHA512'
   *   - digits (number, optional): Token length 6-8 (default 6)
   *
   * Returns: {success, token, counter, nextCounter, algorithm, digits}
   */
  commandHandlers.generate_hotp = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }
    try {
      const { secret, counter = 0, algorithm = 'SHA1', digits = 6 } = params;

      if (!secret) {
        return { success: false, error: 'Secret is required' };
      }

      const hotp = new HOTPGenerator(secret, {
        algorithm,
        digits,
        initialCounter: counter
      });

      const result = hotp.generate();
      const nextCounter = hotp.getCounter();

      return {
        success: true,
        token: result.token,
        counter: result.counter,
        nextCounter,
        algorithm,
        digits
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: validate_hotp
   * Validate an HOTP token with optional lookahead
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - token (string, required): Token to validate
   *   - counter (number, optional): Current counter (default 0)
   *   - lookahead (number, optional): Lookahead windows (0-100, default 0)
   *   - algorithm (string, optional): 'SHA1' (default), 'SHA256', 'SHA512'
   *
   * Returns: {success, valid, counter, message}
   */
  commandHandlers.validate_hotp = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }

    // Check rate limiting on failed attempts
    const clientIP = context.remoteAddress || 'unknown';
    const rateLimitCheck = validationRateLimiter.isAllowed(clientIP);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: rateLimitCheck.message,
        waitSeconds: Math.ceil(rateLimitCheck.waitMs / 1000),
        attemptsRemaining: 0
      };
    }
    try {
      const { secret, token, counter = 0, lookahead = 0, algorithm = 'SHA1' } = params;

      if (!secret || !token) {
        validationRateLimiter.recordFailure(clientIP);
        return { success: false, error: 'Secret and token are required' };
      }

      const hotp = new HOTPGenerator(secret, {
        algorithm,
        initialCounter: counter
      });

      const validation = hotp.validate(token, lookahead);

      if (validation.valid) {
        // Record successful validation
        validationRateLimiter.recordSuccess(clientIP);
      } else {
        // Record failed validation attempt
        validationRateLimiter.recordFailure(clientIP);
      }

      const response = {
        success: true,
        valid: validation.valid,
        counter: validation.counter,
        message: validation.valid ? 'Token is valid' : 'Token is invalid',
        lookaheadUsed: lookahead
      };

      // Add rate limiting info if approaching limit
      const status = validationRateLimiter.getStatus(clientIP);
      if (status.attemptCount > 0) {
        response.attemptsRemaining = Math.max(0, status.maxAttempts - status.attemptCount);
      }

      return response;
    } catch (error) {
      validationRateLimiter.recordFailure(clientIP);
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: resync_hotp
   * Resynchronize HOTP counter after drift
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - correctCounter (number, required): Known correct counter value
   *   - algorithm (string, optional): 'SHA1' (default)
   *
   * Returns: {success, counter, message}
   */
  commandHandlers.resync_hotp = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }
    try {
      const { secret, correctCounter, algorithm = 'SHA1' } = params;

      if (!secret || correctCounter === undefined) {
        return { success: false, error: 'Secret and correctCounter are required' };
      }

      const hotp = new HOTPGenerator(secret, {
        algorithm
      });

      hotp.resetCounter(correctCounter);
      const newCounter = hotp.getCounter();

      return {
        success: true,
        counter: newCounter,
        message: `Counter resynchronized to ${newCounter}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Command: get_totp_info
   * Get current TOTP information without generating a new token
   *
   * Parameters:
   *   - secret (string, required): Base32-encoded secret
   *   - algorithm (string, optional): 'SHA1' (default)
   *   - timeWindow (number, optional): Window in seconds (default 30)
   *
   * Returns: {success, timeRemaining, currentCounter, nextTokenStartsAt}
   */
  commandHandlers.get_totp_info = async (params, context = {}) => {
    // Check WSS requirement in production
    if (context.upgradeRequest) {
      const tlsError = requireWSS(context.upgradeRequest);
      if (tlsError) {
        return { success: false, ...tlsError };
      }
    }
    try {
      const { secret, algorithm = 'SHA1', timeWindow = 30 } = params;

      if (!secret) {
        return { success: false, error: 'Secret is required' };
      }

      const totp = new TOTPGenerator(secret, {
        algorithm,
        window: timeWindow
      });

      const timeRemaining = totp.getTimeRemaining();
      const currentCounter = totp.getCounter();
      const nextToken = totp.getNextToken();

      return {
        success: true,
        timeRemaining,
        currentCounter,
        nextTokenStartsAt: nextToken.startsAt,
        windowSize: timeWindow,
        algorithm
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

module.exports = {
  registerCredentialsCommands
};

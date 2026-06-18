/**
 * Credential Rate Limiter
 *
 * Implements exponential backoff rate limiting for credential validation commands
 * (validate_totp, validate_hotp) to prevent brute force attacks.
 *
 * Features:
 * - Per-client IP rate limiting
 * - Exponential backoff (0s → 1s → 5s → 10s → 60s)
 * - Automatic window reset after timeout
 * - Configurable attempt limits and time windows
 *
 * Version: 1.0.0
 * Created: June 15, 2026
 */

class CredentialRateLimiter {
  /**
   * Initialize the rate limiter
   *
   * @param {number} maxAttempts - Maximum validation attempts allowed (default: 5)
   * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   */
  constructor(maxAttempts = 5, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;

    // Map of clientIP -> { attempts: timestamps[], failCount: number }
    this.attempts = new Map();

    // Exponential backoff delays (in milliseconds) indexed by failure count
    // failCount 1: no wait, 2: 1s, 3: 5s, 4: 10s, 5+: 60s
    this.backoff = {
      1: 0,      // First attempt allowed immediately
      2: 1000,   // 1 second
      3: 5000,   // 5 seconds
      4: 10000,  // 10 seconds
      5: 60000   // 60 seconds (1 minute)
    };
  }

  /**
   * Check if a client IP is allowed to make an attempt
   *
   * @param {string} clientIP - Client IP address
   * @returns {Object} { allowed: boolean, waitMs?: number, attemptsRemaining?: number }
   */
  isAllowed(clientIP) {
    if (!clientIP) {
      return { allowed: false, error: 'Invalid client IP' };
    }

    const now = Date.now();
    const key = clientIP;

    // Initialize client tracking if not exists
    if (!this.attempts.has(key)) {
      this.attempts.set(key, { timestamps: [], failCount: 0 });
    }

    const clientData = this.attempts.get(key);
    const { timestamps, failCount } = clientData;

    // Clean up old timestamps outside the window
    const validTimestamps = timestamps.filter(t => t > now - this.windowMs);
    clientData.timestamps = validTimestamps;

    // Check current failure count
    if (failCount >= this.maxAttempts) {
      // Get backoff delay (failCount + 1 because we're about to fail again)
      const backoffMs = this.backoff[failCount + 1] || 60000;
      return {
        allowed: false,
        waitMs: backoffMs,
        message: `Too many failed attempts. Wait ${Math.ceil(backoffMs / 1000)}s before trying again.`,
        failCount,
        maxAttempts: this.maxAttempts
      };
    }

    // Check if we've exceeded attempt limit in current window
    if (validTimestamps.length >= this.maxAttempts) {
      const oldestAttempt = validTimestamps[0];
      const resetIn = Math.ceil((this.windowMs - (now - oldestAttempt)) / 1000);
      return {
        allowed: false,
        waitMs: resetIn * 1000,
        message: `Rate limit exceeded. Try again in ${resetIn}s.`,
        attemptsRemaining: 0,
        resetIn
      };
    }

    // Attempt allowed
    validTimestamps.push(now);
    clientData.timestamps = validTimestamps;

    return {
      allowed: true,
      attemptsRemaining: Math.max(0, this.maxAttempts - validTimestamps.length),
      failCount
    };
  }

  /**
   * Record a failed validation attempt
   *
   * @param {string} clientIP - Client IP address
   */
  recordFailure(clientIP) {
    if (!this.attempts.has(clientIP)) {
      this.attempts.set(clientIP, { timestamps: [], failCount: 0 });
    }

    const clientData = this.attempts.get(clientIP);
    clientData.failCount++;
  }

  /**
   * Record a successful validation attempt (resets failure counter)
   *
   * @param {string} clientIP - Client IP address
   */
  recordSuccess(clientIP) {
    if (this.attempts.has(clientIP)) {
      const clientData = this.attempts.get(clientIP);
      clientData.failCount = 0;
      clientData.timestamps = []; // Clear attempt history on success
    }
  }

  /**
   * Get current status for a client
   *
   * @param {string} clientIP - Client IP address
   * @returns {Object} Client status information
   */
  getStatus(clientIP) {
    if (!this.attempts.has(clientIP)) {
      return {
        isRateLimited: false,
        failCount: 0,
        attemptCount: 0,
        nextResetIn: null
      };
    }

    const now = Date.now();
    const clientData = this.attempts.get(clientIP);
    const { timestamps, failCount } = clientData;

    // Count valid timestamps
    const validTimestamps = timestamps.filter(t => t > now - this.windowMs);
    const oldestValid = validTimestamps.length > 0 ? validTimestamps[0] : null;
    const nextResetIn = oldestValid ? Math.ceil((this.windowMs - (now - oldestValid)) / 1000) : null;

    return {
      isRateLimited: failCount >= this.maxAttempts,
      failCount,
      attemptCount: validTimestamps.length,
      maxAttempts: this.maxAttempts,
      nextResetIn
    };
  }

  /**
   * Clear all rate limit data for a client
   *
   * @param {string} clientIP - Client IP address
   */
  clear(clientIP) {
    this.attempts.delete(clientIP);
  }

  /**
   * Clear all rate limit data
   */
  clearAll() {
    this.attempts.clear();
  }

  /**
   * Get statistics about rate limiter state
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const now = Date.now();
    let totalClients = 0;
    let blockedClients = 0;
    let totalFailures = 0;

    for (const [clientIP, clientData] of this.attempts) {
      const { failCount, timestamps } = clientData;
      const validTimestamps = timestamps.filter(t => t > now - this.windowMs);

      if (validTimestamps.length > 0) {
        totalClients++;
        totalFailures += failCount;

        if (failCount >= this.maxAttempts) {
          blockedClients++;
        }
      }
    }

    return {
      totalClients,
      blockedClients,
      totalFailures,
      windowMs: this.windowMs,
      maxAttempts: this.maxAttempts
    };
  }
}

module.exports = CredentialRateLimiter;

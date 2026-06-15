/**
 * Rate Limiting System
 * Prevents resource exhaustion by enforcing per-client rate limits on commands
 *
 * @module src/stability/rate-limiter
 */

/**
 * CommandRateLimiter - Enforces per-client and per-command rate limits
 */
class CommandRateLimiter {
  /**
   * Create a rate limiter
   * @param {Object} options - Configuration options
   * @param {number} options.defaultLimitPerMinute - Default requests/minute (default: 1000)
   * @param {Object} options.commandLimits - Per-command overrides
   *   Example: { screenshot: 10, navigate: 20, execute_script: 30 }
   * @param {number} options.windowMs - Time window in ms (default: 60000 = 1 minute)
   * @param {number} options.cleanupIntervalMs - How often to cleanup old entries (default: 30000)
   */
  constructor(options = {}) {
    this.defaultLimitPerMinute = options.defaultLimitPerMinute || 1000;
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.cleanupIntervalMs = options.cleanupIntervalMs || 30000; // 30 seconds

    // Per-command rate limits (override defaults)
    this.commandLimits = {
      screenshot: 10,
      screenshot_viewport: 10,
      screenshot_full_page: 8,
      screenshot_element: 15,
      execute_script: 30,
      navigate: 20,
      click: 50,
      fill: 50,
      type: 50,
      scroll: 40,
      hover: 60,
      wait: 30,
      // Gerenally less restrictive for read operations
      get_url: 100,
      get_content: 100,
      get_page_state: 100,
      get_cookies: 50,
      get_local_storage: 50,
      ...options.commandLimits
    };

    // Track timestamps per client per command
    // Structure: { clientId: { command: [timestamp1, timestamp2, ...] } }
    this.timestamps = new Map();

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of old timestamps
   * @private
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    // Unref timer so process can exit if no other timers
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Cleanup old timestamps from memory
   * @private
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [clientId, commands] of this.timestamps.entries()) {
      for (const [command, timestamps] of Object.entries(commands)) {
        // Remove timestamps older than window
        const filtered = timestamps.filter(ts => ts > cutoff);

        if (filtered.length === 0) {
          delete commands[command];
        } else if (filtered.length < timestamps.length) {
          commands[command] = filtered;
        }
      }

      // Remove client if no commands left
      if (Object.keys(commands).length === 0) {
        this.timestamps.delete(clientId);
      }
    }
  }

  /**
   * Get rate limit for a command
   * @param {string} command - Command name
   * @returns {number} Maximum requests per minute
   */
  getLimit(command) {
    return this.commandLimits[command] || this.defaultLimitPerMinute;
  }

  /**
   * Check if a client is rate limited for a command
   * @param {string} clientId - Client identifier
   * @param {string} command - Command name
   * @returns {Object} { isLimited: boolean, remaining: number, resetAfterMs: number }
   */
  check(clientId, command) {
    const limit = this.getLimit(command);
    const now = Date.now();

    // Ensure client has tracking entry
    if (!this.timestamps.has(clientId)) {
      this.timestamps.set(clientId, {});
    }

    const clientCommands = this.timestamps.get(clientId);

    // Ensure command has tracking entry
    if (!clientCommands[command]) {
      clientCommands[command] = [];
    }

    const timestamps = clientCommands[command];

    // Remove timestamps outside the window
    const cutoff = now - this.windowMs;
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    // Check if rate limited
    const isLimited = timestamps.length >= limit;

    if (isLimited) {
      // Calculate how long until next request is allowed
      const oldestTimestamp = timestamps[0];
      const resetAfterMs = Math.ceil((oldestTimestamp + this.windowMs) - now);

      return {
        isLimited: true,
        remaining: 0,
        resetAfterMs,
        retryAfterSeconds: Math.ceil(resetAfterMs / 1000),
        limit,
        current: timestamps.length
      };
    }

    return {
      isLimited: false,
      remaining: limit - timestamps.length,
      resetAfterMs: 0,
      retryAfterSeconds: 0,
      limit,
      current: timestamps.length
    };
  }

  /**
   * Record a request from a client for a command
   * Updates the timestamp tracking
   * @param {string} clientId - Client identifier
   * @param {string} command - Command name
   */
  record(clientId, command) {
    const now = Date.now();

    // Ensure client has tracking entry
    if (!this.timestamps.has(clientId)) {
      this.timestamps.set(clientId, {});
    }

    const clientCommands = this.timestamps.get(clientId);

    // Ensure command has tracking entry
    if (!clientCommands[command]) {
      clientCommands[command] = [];
    }

    // Add current timestamp
    clientCommands[command].push(now);
  }

  /**
   * Get statistics for a client
   * @param {string} clientId - Client identifier
   * @returns {Object} Statistics including command request counts
   */
  getClientStats(clientId) {
    if (!this.timestamps.has(clientId)) {
      return { clientId, commands: {} };
    }

    const commands = this.timestamps.get(clientId);
    const stats = { clientId, commands: {} };

    for (const [command, timestamps] of Object.entries(commands)) {
      const limit = this.getLimit(command);
      stats.commands[command] = {
        requests: timestamps.length,
        limit,
        remaining: Math.max(0, limit - timestamps.length)
      };
    }

    return stats;
  }

  /**
   * Get all tracked clients
   * @returns {string[]} Array of client IDs
   */
  getTrackedClients() {
    return Array.from(this.timestamps.keys());
  }

  /**
   * Reset rate limit for a specific client/command
   * Useful for testing or manual override
   * @param {string} clientId - Client identifier
   * @param {string} command - Command name (optional, resets all if not provided)
   */
  reset(clientId, command) {
    if (!this.timestamps.has(clientId)) {
      return;
    }

    const clientCommands = this.timestamps.get(clientId);

    if (command) {
      delete clientCommands[command];
    } else {
      this.timestamps.delete(clientId);
    }
  }

  /**
   * Get rate limiter configuration
   * @returns {Object} Configuration summary
   */
  getConfig() {
    return {
      defaultLimitPerMinute: this.defaultLimitPerMinute,
      windowMs: this.windowMs,
      cleanupIntervalMs: this.cleanupIntervalMs,
      commandLimits: { ...this.commandLimits },
      trackedClients: this.getTrackedClients().length
    };
  }
}

module.exports = {
  CommandRateLimiter
};

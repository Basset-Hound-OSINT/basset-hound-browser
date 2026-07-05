/**
 * WebSocket Rate Limiter with Sliding Window and Per-Command Buckets
 * Implements security against command flooding attacks
 *
 * @module websocket/rate-limiter
 * @version 2.0.0
 *
 * Features:
 * - Per-API key token bucket rate limiting
 * - Sliding window rate limiting (per client/command)
 * - Configurable token refill rates
 * - Independent limits for different API keys
 * - Statistical tracking and monitoring
 */

const crypto = require('crypto');

/**
 * WebSocketRateLimiter - Enforces sliding window rate limits per client and command
 *
 * Features:
 * - Separate limits for authenticated vs unauthenticated clients
 * - Per-command rate limit buckets
 * - Sliding window algorithm for fair limiting
 * - Burst allowance for temporary spikes
 * - Admin bypass for testing
 * - Configurable via environment variables
 */
class WebSocketRateLimiter {
  /**
   * Create a rate limiter instance
   * @param {Object} options Configuration options
   * @param {boolean} options.enabled - Enable rate limiting (default: true)
   * @param {number} options.unauthenticatedLimit - Req/min for unauthenticated (default: 100)
   * @param {number} options.authenticatedLimit - Req/min for authenticated (default: 1000)
   * @param {Object} options.commandLimits - Per-command overrides { command: limit }
   * @param {number} options.windowMs - Sliding window duration (default: 60000 = 1 min)
   * @param {number} options.burstAllowance - Extra requests allowed for burst (default: 10)
   * @param {number} options.cleanupIntervalMs - Cleanup old data interval (default: 30000)
   * @param {boolean} options.adminBypass - Allow bypass via admin token (default: true)
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    // Load from environment if not provided
    this.enabled = options.enabled !== undefined
      ? options.enabled
      : (process.env.RATE_LIMIT_ENABLED !== 'false');

    this.unauthenticatedLimit = options.unauthenticatedLimit ||
      parseInt(process.env.RATE_LIMIT_UNAUTHENTICATED || '100');

    this.authenticatedLimit = options.authenticatedLimit ||
      parseInt(process.env.RATE_LIMIT_AUTHENTICATED || '1000');

    this.windowMs = options.windowMs || 60000; // 1 minute
    this.burstAllowance = options.burstAllowance || 10;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 30000;
    this.adminBypass = options.adminBypass !== false;
    this.logger = options.logger || console;

    // Per-command rate limit overrides
    // Stricter limits for expensive operations
    this.commandLimits = {
      // Screenshots are expensive (CPU/memory)
      screenshot: 5,
      screenshot_viewport: 5,
      screenshot_element: 8,
      screenshot_full_page: 3,

      // Script execution is risky
      execute_script: 20,
      execute_async_script: 15,

      // Navigation is moderate cost
      navigate: 15,
      wait_for_navigation: 10,

      // DOM manipulation
      click: 40,
      fill: 40,
      type: 40,
      hover: 50,
      focus: 50,
      scroll: 40,

      // Profile/session operations
      create_profile: 5,
      delete_profile: 5,
      switch_profile: 10,
      set_cookies: 20,
      clear_cookies: 10,

      // Read operations - high limit
      get_content: 100,
      get_url: 100,
      get_page_state: 100,
      get_cookies: 50,
      get_local_storage: 50,

      // Default for unmapped commands
      ...(options.commandLimits || {})
    };

    // Track request timestamps per client per command
    // Structure: Map<clientId, Map<command, timestamp[]>>
    this.requests = new Map();

    // Track authenticated status per client
    this.authenticatedClients = new Set();

    // Admin tokens for bypass (set via setAdminTokens)
    this.adminTokens = new Set();

    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      totalRejected: 0,
      clientStats: new Map() // clientId -> { limited: count, allowed: count }
    };

    // Start periodic cleanup
    this.startCleanup();

    this.logger.info('[RateLimiter] Initialized', {
      enabled: this.enabled,
      unauthenticatedLimit: this.unauthenticatedLimit,
      authenticatedLimit: this.authenticatedLimit,
      windowMs: this.windowMs,
      burstAllowance: this.burstAllowance
    });
  }

  /**
   * Start periodic cleanup of old request data
   * @private
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stop the cleanup timer and cleanup resources
   */
  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove old timestamps and stale client entries
   * @private
   */
  cleanup() {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    let removedClients = 0;
    let removedRequests = 0;

    for (const [clientId, commands] of this.requests.entries()) {
      for (const [command, timestamps] of commands.entries()) {
        // Remove timestamps outside the window
        const originalLength = timestamps.length;
        while (timestamps.length > 0 && timestamps[0] <= cutoff) {
          timestamps.shift();
          removedRequests++;
        }

        if (timestamps.length === 0) {
          commands.delete(command);
        }
      }

      if (commands.size === 0) {
        this.requests.delete(clientId);
        this.authenticatedClients.delete(clientId);
        removedClients++;
      }
    }

    if (removedClients > 0 || removedRequests > 0) {
      this.logger.debug('[RateLimiter] Cleanup complete', {
        clientsRemoved: removedClients,
        requestsRemoved: removedRequests
      });
    }
  }

  /**
   * Mark a client as authenticated
   * @param {string} clientId - Client identifier
   * @param {string} token - Authentication token (for admin bypass check)
   */
  authenticate(clientId, token) {
    this.authenticatedClients.add(clientId);

    // Check if this is an admin token
    if (this.adminBypass && token && this.adminTokens.has(token)) {
      this.logger.debug('[RateLimiter] Admin token verified', { clientId });
    }
  }

  /**
   * Mark a client as unauthenticated
   * @param {string} clientId - Client identifier
   */
  unauthenticate(clientId) {
    this.authenticatedClients.delete(clientId);
  }

  /**
   * Set admin tokens for bypass capability
   * @param {string|string[]} tokens - Admin token(s)
   */
  setAdminTokens(tokens) {
    if (Array.isArray(tokens)) {
      tokens.forEach(t => this.adminTokens.add(t));
    } else {
      this.adminTokens.add(tokens);
    }
  }

  /**
   * Get rate limit for a command (or default)
   * @param {string} command - Command name
   * @returns {number} Max requests per minute
   */
  getCommandLimit(command) {
    // Return per-command limit if specified, otherwise return a high default
    // that won't override the base client limit
    return this.commandLimits[command] || 10000; // Very high default to let base limit apply
  }

  /**
   * Check if a request should be allowed
   *
   * Rate limit response includes:
   * - allowed: boolean indicating if request is allowed
   * - remaining: requests remaining until limit
   * - resetIn: milliseconds until window resets
   * - retryAfter: seconds until retry (calculated as Math.ceil(resetIn / 1000))
   * - limit: the effective rate limit for this client/command
   * - current: current request count in window
   * - statusCode: 429 for rate limit errors (for HTTP compatibility)
   *
   * The retryAfter value should be included in HTTP response headers as "Retry-After: {seconds}"
   *
   * @param {string} clientId - Client identifier
   * @param {string} command - Command name
   * @param {string} authToken - Authentication token (optional)
   * @returns {Object} { allowed, remaining, resetIn, retryAfter, limit, current }
   */
  check(clientId, command, authToken) {
    if (!this.enabled) {
      return { allowed: true, rateLimitDisabled: true };
    }

    // Admin bypass check
    if (this.adminBypass && authToken && this.adminTokens.has(authToken)) {
      this.logger.debug('[RateLimiter] Admin bypass granted', { clientId, command });
      return { allowed: true, adminBypassed: true };
    }

    // Get the limit for this client type and command
    const isAuthenticated = this.authenticatedClients.has(clientId);
    const baseLimit = isAuthenticated ? this.authenticatedLimit : this.unauthenticatedLimit;
    const commandLimit = this.getCommandLimit(command);
    const effectiveLimit = Math.min(baseLimit, commandLimit);
    const burstLimit = effectiveLimit + this.burstAllowance;

    const now = Date.now();
    const cutoff = now - this.windowMs;

    // Ensure client has request tracking
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, new Map());
    }

    const clientRequests = this.requests.get(clientId);
    if (!clientRequests.has(command)) {
      clientRequests.set(command, []);
    }

    // Remove timestamps outside the sliding window
    const timestamps = clientRequests.get(command);
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    const current = timestamps.length;
    const remaining = Math.max(0, effectiveLimit - current);
    const resetIn = timestamps.length > 0
      ? (timestamps[0] + this.windowMs) - now
      : 0;

    // Check if within limits
    if (current < effectiveLimit) {
      // Add timestamp to record this request
      timestamps.push(now);
      this.stats.totalRequests++;

      return {
        allowed: true,
        limit: effectiveLimit,
        current,
        remaining: remaining - 1, // -1 because we just added one
        resetIn,
        authenticated: isAuthenticated
      };
    } else if (current < burstLimit) {
      // Within burst allowance
      timestamps.push(now);
      this.stats.totalRequests++;
      const burstRemaining = burstLimit - current - 1;

      return {
        allowed: true,
        limit: effectiveLimit,
        current,
        remaining: burstRemaining,
        resetIn,
        usingBurst: true,
        burstRemaining,
        authenticated: isAuthenticated
      };
    } else {
      // Exceeded limits
      this.stats.totalRejected++;

      // Track client statistics
      if (!this.stats.clientStats.has(clientId)) {
        this.stats.clientStats.set(clientId, { allowed: 0, limited: 0 });
      }
      this.stats.clientStats.get(clientId).limited++;

      // Calculate retry-after in seconds (HTTP standard format)
      const retryAfterSeconds = Math.ceil(resetIn / 1000);

      return {
        allowed: false,
        error: `Rate limit exceeded for command "${command}". Limit: ${effectiveLimit} req/min, Current: ${current}. Retry in ${retryAfterSeconds}s`,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        limit: effectiveLimit,
        current,
        remaining: 0,
        resetIn,
        retryAfter: retryAfterSeconds, // Seconds - HTTP Retry-After header format
        retryAfterMs: resetIn,         // Milliseconds - for internal use
        statusCode: 429,               // HTTP 429 Too Many Requests
        authenticated: isAuthenticated,
        windowMs: this.windowMs        // Include window size for client reference
      };
    }
  }

  /**
   * Get current rate limit status for a client
   * @param {string} clientId - Client identifier
   * @param {string} command - Optional specific command
   * @returns {Object} Rate limit status
   */
  getStatus(clientId, command) {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Rate limiting is disabled'
      };
    }

    const isAuthenticated = this.authenticatedClients.has(clientId);
    const baseLimit = isAuthenticated ? this.authenticatedLimit : this.unauthenticatedLimit;

    if (!command) {
      // Return overall status
      const clientRequests = this.requests.get(clientId);
      if (!clientRequests) {
        return {
          enabled: true,
          clientId,
          authenticated: isAuthenticated,
          baseLimit,
          commands: {}
        };
      }

      const commands = {};
      const now = Date.now();
      const cutoff = now - this.windowMs;

      for (const [cmd, timestamps] of clientRequests.entries()) {
        // Count valid timestamps
        const valid = timestamps.filter(ts => ts > cutoff);
        const limit = this.getCommandLimit(cmd);
        const effectiveLimit = Math.min(baseLimit, limit);

        commands[cmd] = {
          current: valid.length,
          limit: effectiveLimit,
          remaining: Math.max(0, effectiveLimit - valid.length),
          resetIn: valid.length > 0
            ? Math.max(0, (valid[0] + this.windowMs) - now)
            : 0
        };
      }

      return {
        enabled: true,
        clientId,
        authenticated: isAuthenticated,
        baseLimit,
        commands,
        windowMs: this.windowMs
      };
    } else {
      // Specific command status
      const limit = this.getCommandLimit(command);
      const effectiveLimit = Math.min(baseLimit, limit);
      const clientRequests = this.requests.get(clientId);

      if (!clientRequests || !clientRequests.has(command)) {
        return {
          enabled: true,
          clientId,
          command,
          authenticated: isAuthenticated,
          limit: effectiveLimit,
          current: 0,
          remaining: effectiveLimit,
          resetIn: 0
        };
      }

      const timestamps = clientRequests.get(command);
      const now = Date.now();
      const cutoff = now - this.windowMs;
      const valid = timestamps.filter(ts => ts > cutoff);

      return {
        enabled: true,
        clientId,
        command,
        authenticated: isAuthenticated,
        limit: effectiveLimit,
        current: valid.length,
        remaining: Math.max(0, effectiveLimit - valid.length),
        resetIn: valid.length > 0
          ? Math.max(0, (valid[0] + this.windowMs) - now)
          : 0,
        windowMs: this.windowMs
      };
    }
  }

  /**
   * Get overall limiter statistics
   * @returns {Object} Statistics summary
   */
  getStats() {
    return {
      enabled: this.enabled,
      totalRequests: this.stats.totalRequests,
      totalRejected: this.stats.totalRejected,
      rejectionRate: this.stats.totalRequests > 0
        ? (this.stats.totalRejected / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      trackedClients: this.requests.size,
      authenticatedClients: this.authenticatedClients.size,
      limits: {
        unauthenticated: this.unauthenticatedLimit,
        authenticated: this.authenticatedLimit,
        burstAllowance: this.burstAllowance,
        windowMs: this.windowMs
      }
    };
  }

  /**
   * Reset rate limit for a client or specific command
   * Useful for testing and manual overrides
   * @param {string} clientId - Client identifier
   * @param {string} command - Optional command to reset
   */
  reset(clientId, command) {
    if (!this.requests.has(clientId)) {
      return;
    }

    const clientRequests = this.requests.get(clientId);

    if (command) {
      clientRequests.delete(command);
    } else {
      this.requests.delete(clientId);
      this.authenticatedClients.delete(clientId);
    }

    this.logger.debug('[RateLimiter] Reset rate limit', { clientId, command });
  }

  /**
   * Reset all rate limit data (for testing)
   */
  resetAll() {
    this.requests.clear();
    this.authenticatedClients.clear();
    this.logger.debug('[RateLimiter] Reset all rate limits');
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      unauthenticatedLimit: this.unauthenticatedLimit,
      authenticatedLimit: this.authenticatedLimit,
      windowMs: this.windowMs,
      burstAllowance: this.burstAllowance,
      adminBypass: this.adminBypass,
      commandLimits: { ...this.commandLimits }
    };
  }
}

/**
 * APIKeyTokenBucket - Per-API Key Rate Limiting using Token Bucket Algorithm
 *
 * Features:
 * - Individual token bucket per API key
 * - Configurable capacity and refill rate
 * - Millisecond-precision token refill tracking
 * - Statistics per API key
 * - Multiple tier support (basic, premium, enterprise)
 * - Automatic cleanup of inactive keys
 *
 * Algorithm: Token Bucket
 * - Each API key gets a bucket with max capacity (tokens)
 * - Tokens refill at a configurable rate (tokens per interval)
 * - Each request consumes tokens
 * - Request allowed if sufficient tokens available
 * - Unused tokens do not roll over past capacity
 */
class APIKeyTokenBucket {
  /**
   * Create an API key rate limiter instance
   * @param {Object} options Configuration options
   * @param {boolean} options.enabled - Enable API key rate limiting (default: true)
   * @param {Object} options.tiers - Rate limiting tiers by key tier
   *   - {string: { capacity, refillRate, refillIntervalMs, costPerRequest }}
   *   - Example: { basic: { capacity: 100, refillRate: 10, refillIntervalMs: 60000, costPerRequest: 1 }}
   * @param {number} options.defaultRefillIntervalMs - Default refill interval in ms (default: 60000)
   * @param {number} options.cleanupIntervalMs - Cleanup old keys interval (default: 300000)
   * @param {number} options.inactivityTimeoutMs - Time before key is considered inactive (default: 3600000)
   * @param {Object} options.logger - Logger instance
   */
  constructor(options = {}) {
    this.enabled = options.enabled !== undefined
      ? options.enabled
      : (process.env.API_KEY_RATE_LIMIT_ENABLED !== 'false');

    // Define rate limiting tiers
    // Tiers allow different API key classes to have different limits
    this.tiers = options.tiers || {
      basic: {
        capacity: 100,           // Max tokens in bucket
        refillRate: 10,          // Tokens added per interval
        refillIntervalMs: 60000, // 1 minute
        costPerRequest: 1        // Tokens consumed per request
      },
      premium: {
        capacity: 1000,
        refillRate: 100,
        refillIntervalMs: 60000,
        costPerRequest: 1
      },
      enterprise: {
        capacity: 10000,
        refillRate: 1000,
        refillIntervalMs: 60000,
        costPerRequest: 1
      },
      unlimited: {
        capacity: Infinity,
        refillRate: Infinity,
        refillIntervalMs: 60000,
        costPerRequest: 0
      },
      ...(options.tiers || {})
    };

    this.defaultRefillIntervalMs = options.defaultRefillIntervalMs || 60000;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 300000; // 5 minutes
    this.inactivityTimeoutMs = options.inactivityTimeoutMs || 3600000; // 1 hour
    this.logger = options.logger || console;

    // Per-API key bucket state
    // Structure: Map<apiKey, { tokens, lastRefillTime, tier, createdAt, lastUsedAt, requestCount, rejectedCount }>
    this.buckets = new Map();

    // Map of apiKey -> tier assignment
    // Structure: Map<apiKey, tierName>
    this.keyTiers = new Map();

    // Statistics tracking
    this.stats = {
      totalRequests: 0,
      totalRejected: 0,
      keyStats: new Map() // apiKey -> { allowed: count, rejected: count, lastUsedAt: timestamp }
    };

    // Start periodic cleanup
    this.startCleanup();

    this.logger.info('[APIKeyTokenBucket] Initialized', {
      enabled: this.enabled,
      tiers: Object.keys(this.tiers),
      cleanupIntervalMs: this.cleanupIntervalMs,
      inactivityTimeoutMs: this.inactivityTimeoutMs
    });
  }

  /**
   * Start periodic cleanup of inactive keys
   * @private
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);

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
   * Remove inactive API keys
   * @private
   */
  cleanup() {
    const now = Date.now();
    let removedKeys = 0;

    for (const [apiKey, bucket] of this.buckets.entries()) {
      const inactiveFor = now - bucket.lastUsedAt;
      if (inactiveFor > this.inactivityTimeoutMs) {
        this.buckets.delete(apiKey);
        this.keyTiers.delete(apiKey);
        this.stats.keyStats.delete(apiKey);
        removedKeys++;
      }
    }

    if (removedKeys > 0) {
      this.logger.debug('[APIKeyTokenBucket] Cleanup complete', {
        keysRemoved: removedKeys,
        activeKeys: this.buckets.size
      });
    }
  }

  /**
   * Register an API key with a specific tier
   * @param {string} apiKey - API key to register
   * @param {string} tier - Tier name (basic, premium, enterprise, unlimited)
   * @returns {Object} Bucket state
   */
  registerKey(apiKey, tier = 'basic') {
    if (!this.tiers[tier]) {
      throw new Error(`Unknown tier: ${tier}`);
    }

    const tierConfig = this.tiers[tier];
    const now = Date.now();

    const bucket = {
      tokens: tierConfig.capacity,    // Start with full bucket
      lastRefillTime: now,
      tier,
      createdAt: now,
      lastUsedAt: now,
      requestCount: 0,
      rejectedCount: 0
    };

    this.buckets.set(apiKey, bucket);
    this.keyTiers.set(apiKey, tier);

    if (!this.stats.keyStats.has(apiKey)) {
      this.stats.keyStats.set(apiKey, {
        allowed: 0,
        rejected: 0,
        lastUsedAt: now
      });
    }

    this.logger.debug('[APIKeyTokenBucket] Key registered', {
      apiKey: this.maskApiKey(apiKey),
      tier,
      capacity: tierConfig.capacity
    });

    return bucket;
  }

  /**
   * Get or create bucket for an API key
   * @private
   * @param {string} apiKey - API key
   * @returns {Object} Bucket state
   */
  getBucket(apiKey) {
    if (!this.buckets.has(apiKey)) {
      this.registerKey(apiKey, 'basic');
    }
    return this.buckets.get(apiKey);
  }

  /**
   * Refill tokens in a bucket based on elapsed time
   * @private
   * @param {Object} bucket - Bucket to refill
   * @param {string} tier - Tier name
   * @param {number} now - Current timestamp
   */
  refillTokens(bucket, tier, now) {
    const tierConfig = this.tiers[tier];
    const elapsedMs = now - bucket.lastRefillTime;

    // Calculate tokens to add based on refill rate and elapsed time
    const intervalsElapsed = elapsedMs / tierConfig.refillIntervalMs;
    const tokensToAdd = intervalsElapsed * tierConfig.refillRate;

    // Update tokens (capped at capacity)
    bucket.tokens = Math.min(
      tierConfig.capacity,
      bucket.tokens + tokensToAdd
    );

    // Update refill time
    bucket.lastRefillTime = now;
  }

  /**
   * Check if a request is allowed and consume tokens if approved
   *
   * Rate limit response includes:
   * - allowed: boolean indicating if request is allowed
   * - tokensRemaining: tokens left in bucket
   * - tokensCapacity: maximum tokens in bucket
   * - refillIn: milliseconds until next refill (for info)
   * - tier: the tier of the API key
   * - apiKey: masked API key
   *
   * @param {string} apiKey - API key making request
   * @param {number} tokensToConsume - Tokens to consume (default: 1)
   * @returns {Object} { allowed, tokensRemaining, tokensCapacity, refillIn, tier, apiKey, error }
   */
  check(apiKey, tokensToConsume = 1) {
    if (!this.enabled) {
      return {
        allowed: true,
        rateLimitDisabled: true
      };
    }

    // Get or create bucket
    const bucket = this.getBucket(apiKey);
    const tier = bucket.tier;
    const tierConfig = this.tiers[tier];
    const now = Date.now();

    // Refill tokens based on elapsed time
    this.refillTokens(bucket, tier, now);

    // Unlimited tier always allows requests
    if (tierConfig.capacity === Infinity) {
      bucket.lastUsedAt = now;
      bucket.requestCount++;
      this.stats.totalRequests++;

      if (!this.stats.keyStats.has(apiKey)) {
        this.stats.keyStats.set(apiKey, { allowed: 0, rejected: 0 });
      }
      this.stats.keyStats.get(apiKey).allowed++;
      this.stats.keyStats.get(apiKey).lastUsedAt = now;

      return {
        allowed: true,
        tokensRemaining: Infinity,
        tokensCapacity: Infinity,
        tier,
        apiKey: this.maskApiKey(apiKey),
        unlimited: true
      };
    }

    // Check if sufficient tokens available
    const hasEnoughTokens = bucket.tokens >= tokensToConsume;

    bucket.lastUsedAt = now;
    bucket.requestCount++;

    if (hasEnoughTokens) {
      // Consume tokens
      bucket.tokens -= tokensToConsume;
      this.stats.totalRequests++;

      if (!this.stats.keyStats.has(apiKey)) {
        this.stats.keyStats.set(apiKey, { allowed: 0, rejected: 0 });
      }
      this.stats.keyStats.get(apiKey).allowed++;
      this.stats.keyStats.get(apiKey).lastUsedAt = now;

      return {
        allowed: true,
        tokensRemaining: bucket.tokens,
        tokensCapacity: tierConfig.capacity,
        tier,
        apiKey: this.maskApiKey(apiKey),
        refillRate: tierConfig.refillRate,
        refillIntervalMs: tierConfig.refillIntervalMs
      };
    } else {
      // Not enough tokens
      this.stats.totalRejected++;
      bucket.rejectedCount++;

      if (!this.stats.keyStats.has(apiKey)) {
        this.stats.keyStats.set(apiKey, { allowed: 0, rejected: 0 });
      }
      this.stats.keyStats.get(apiKey).rejected++;
      this.stats.keyStats.get(apiKey).lastUsedAt = now;

      // Calculate when we'll have enough tokens
      const tokensNeeded = tokensToConsume - bucket.tokens;
      const refillTimeNeeded = (tokensNeeded / tierConfig.refillRate) * tierConfig.refillIntervalMs;

      return {
        allowed: false,
        error: `API key rate limit exceeded. Tier: ${tier}, Tokens needed: ${tokensNeeded.toFixed(2)}, Retry in: ${Math.ceil(refillTimeNeeded / 1000)}s`,
        errorCode: 'API_KEY_RATE_LIMIT_EXCEEDED',
        tokensRemaining: bucket.tokens,
        tokensCapacity: tierConfig.capacity,
        tokensNeeded: tokensNeeded.toFixed(2),
        retryAfter: Math.ceil(refillTimeNeeded / 1000), // Seconds
        retryAfterMs: Math.ceil(refillTimeNeeded),      // Milliseconds
        tier,
        apiKey: this.maskApiKey(apiKey),
        statusCode: 429 // HTTP 429 Too Many Requests
      };
    }
  }

  /**
   * Get current status of an API key
   * @param {string} apiKey - API key to check
   * @returns {Object} Current bucket status
   */
  getStatus(apiKey) {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'API key rate limiting is disabled'
      };
    }

    if (!this.buckets.has(apiKey)) {
      return {
        enabled: true,
        apiKey: this.maskApiKey(apiKey),
        status: 'not_registered',
        message: 'API key not registered'
      };
    }

    const bucket = this.getBucket(apiKey);
    const tier = bucket.tier;
    const tierConfig = this.tiers[tier];
    const now = Date.now();

    // Refill to get current state
    this.refillTokens(bucket, tier, now);

    const inactiveFor = now - bucket.lastUsedAt;

    return {
      enabled: true,
      apiKey: this.maskApiKey(apiKey),
      tier,
      tokensRemaining: bucket.tokens.toFixed(2),
      tokensCapacity: tierConfig.capacity,
      refillRate: tierConfig.refillRate,
      refillIntervalMs: tierConfig.refillIntervalMs,
      requestCount: bucket.requestCount,
      rejectedCount: bucket.rejectedCount,
      createdAt: new Date(bucket.createdAt).toISOString(),
      lastUsedAt: new Date(bucket.lastUsedAt).toISOString(),
      inactiveForMs: inactiveFor
    };
  }

  /**
   * Get statistics for all API keys
   * @returns {Object} Statistics summary
   */
  getStats() {
    return {
      enabled: this.enabled,
      totalRequests: this.stats.totalRequests,
      totalRejected: this.stats.totalRejected,
      rejectionRate: this.stats.totalRequests > 0
        ? (this.stats.totalRejected / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      activeKeys: this.buckets.size,
      tiers: Object.keys(this.tiers),
      keyStats: Array.from(this.stats.keyStats.entries()).map(([key, stats]) => ({
        apiKey: this.maskApiKey(key),
        allowed: stats.allowed,
        rejected: stats.rejected,
        successRate: stats.allowed + stats.rejected > 0
          ? ((stats.allowed / (stats.allowed + stats.rejected)) * 100).toFixed(2) + '%'
          : 'N/A',
        lastUsedAt: new Date(stats.lastUsedAt).toISOString()
      }))
    };
  }

  /**
   * Get configuration summary
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      tiers: Object.keys(this.tiers),
      tierDetails: Object.entries(this.tiers).reduce((acc, [tierName, config]) => {
        acc[tierName] = {
          capacity: config.capacity,
          refillRate: config.refillRate,
          refillIntervalMs: config.refillIntervalMs,
          costPerRequest: config.costPerRequest
        };
        return acc;
      }, {}),
      cleanupIntervalMs: this.cleanupIntervalMs,
      inactivityTimeoutMs: this.inactivityTimeoutMs
    };
  }

  /**
   * Reset rate limit for an API key
   * @param {string} apiKey - API key to reset
   */
  reset(apiKey) {
    if (this.buckets.has(apiKey)) {
      const tier = this.keyTiers.get(apiKey);
      const tierConfig = this.tiers[tier];
      const bucket = this.buckets.get(apiKey);

      bucket.tokens = tierConfig.capacity;
      bucket.lastRefillTime = Date.now();

      this.logger.debug('[APIKeyTokenBucket] Rate limit reset', {
        apiKey: this.maskApiKey(apiKey),
        tier
      });
    }
  }

  /**
   * Reset all API keys (for testing)
   */
  resetAll() {
    for (const apiKey of this.buckets.keys()) {
      this.reset(apiKey);
    }
    this.logger.debug('[APIKeyTokenBucket] Reset all API key rate limits');
  }

  /**
   * Update tier for an API key
   * @param {string} apiKey - API key
   * @param {string} newTier - New tier name
   */
  updateTier(apiKey, newTier) {
    if (!this.tiers[newTier]) {
      throw new Error(`Unknown tier: ${newTier}`);
    }

    const bucket = this.getBucket(apiKey);
    const oldTier = bucket.tier;
    const tierConfig = this.tiers[newTier];

    bucket.tier = newTier;
    bucket.tokens = tierConfig.capacity; // Reset to full capacity
    bucket.lastRefillTime = Date.now();
    this.keyTiers.set(apiKey, newTier);

    this.logger.info('[APIKeyTokenBucket] Tier updated', {
      apiKey: this.maskApiKey(apiKey),
      oldTier,
      newTier
    });
  }

  /**
   * Mask API key for logging (show first/last 4 chars)
   * @private
   * @param {string} apiKey - API key to mask
   * @returns {string} Masked key
   */
  maskApiKey(apiKey) {
    if (apiKey.length <= 8) {
      return apiKey;
    }
    const first4 = apiKey.substring(0, 4);
    const last4 = apiKey.substring(apiKey.length - 4);
    return `${first4}...${last4}`;
  }

  /**
   * Revoke an API key
   * @param {string} apiKey - API key to revoke
   */
  revoke(apiKey) {
    this.buckets.delete(apiKey);
    this.keyTiers.delete(apiKey);
    this.stats.keyStats.delete(apiKey);

    this.logger.info('[APIKeyTokenBucket] API key revoked', {
      apiKey: this.maskApiKey(apiKey)
    });
  }
}

module.exports = {
  WebSocketRateLimiter,
  APIKeyTokenBucket
};

/**
 * Advanced Rate Limiting with Token Bucket & Sliding Window
 *
 * Implements multiple rate limiting algorithms:
 * - Token bucket: Smooth rate limiting with burst capacity
 * - Sliding window: Precise request counting over time windows
 * - Per-identity: Track limits per IP, user, API key
 * - Per-endpoint: Different limits for different API endpoints
 * - Admin bypass: Allow internal/admin traffic without limits
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

class AdvancedRateLimiter {
  /**
   * Configuration
   */
  static DEFAULT_CONFIG = {
    // Token bucket algorithm
    tokenBucket: {
      enabled: true,
      capacity: 100,           // Burst capacity
      refillRate: 10,          // Tokens per second
      refillInterval: 1000     // Milliseconds
    },

    // Sliding window algorithm
    slidingWindow: {
      enabled: true,
      windowSize: 60000,       // 60 seconds
      maxRequests: 100         // Max requests per window
    },

    // Per-identity limits
    perIdentity: {
      enabled: true,
      ipLimit: 100,            // Per IP address
      userLimit: 200,          // Per authenticated user
      apiKeyLimit: 500         // Per API key
    },

    // Per-endpoint limits
    perEndpoint: {
      enabled: true,
      defaults: { limit: 100, window: 60000 },
      custom: {
        'execute_javascript': { limit: 10, window: 60000 },
        'extract_html': { limit: 20, window: 60000 },
        'navigate': { limit: 50, window: 60000 }
      }
    },

    // Admin bypass
    adminBypass: {
      enabled: true,
      bypassIPs: ['127.0.0.1', '::1'],
      bypassUsers: [] // Admin user IDs
    },

    // Cleanup
    cleanupInterval: 300000   // 5 minutes
  };

  /**
   * Constructor
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...AdvancedRateLimiter.DEFAULT_CONFIG };
    this.deepMergeConfig(this.config, config);

    // State tracking
    this.tokenBuckets = new Map();           // clientId -> { tokens, lastRefill }
    this.slidingWindows = new Map();         // clientId -> { requests: [], ... }
    this.endpointTracking = new Map();       // clientId + endpoint -> { requests: [], ... }
    this.identityTracking = new Map();       // ip/user -> { requests: [], ... }

    // Cleanup timer
    this.startCleanup();
  }

  /**
   * Deep merge configuration objects
   */
  deepMergeConfig(target, source) {
    for (const key in source) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) target[key] = {};
        this.deepMergeConfig(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Check if identity should bypass rate limits
   * @param {Object} identity - Identity info (ip, userId, isAdmin, etc.)
   * @returns {boolean} True if should bypass
   */
  shouldBypass(identity) {
    if (!this.config.adminBypass.enabled) return false;

    // Check IP bypass list
    if (this.config.adminBypass.bypassIPs.includes(identity.ip)) {
      return true;
    }

    // Check admin user bypass
    if (identity.isAdmin && this.config.adminBypass.bypassUsers.includes(identity.userId)) {
      return true;
    }

    // Check explicit admin flag
    if (identity.isAdmin || identity.role === 'admin') {
      return true;
    }

    return false;
  }

  /**
   * Check token bucket rate limit
   * @param {string} clientId - Unique client identifier
   * @returns {Object} { allowed: boolean, remaining: number, reset: timestamp }
   */
  checkTokenBucket(clientId) {
    if (!this.config.tokenBucket.enabled) {
      return { allowed: true, remaining: Infinity, reset: 0 };
    }

    const now = Date.now();
    let bucket = this.tokenBuckets.get(clientId);

    if (!bucket) {
      bucket = {
        tokens: this.config.tokenBucket.capacity,
        lastRefill: now
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = (elapsed / this.config.tokenBucket.refillInterval) * this.config.tokenBucket.refillRate;
    bucket.tokens = Math.min(
      this.config.tokenBucket.capacity,
      bucket.tokens + tokensToAdd
    );
    bucket.lastRefill = now;

    // Check if we have a token
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.tokenBuckets.set(clientId, bucket);
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        reset: now + (this.config.tokenBucket.refillInterval / this.config.tokenBucket.refillRate)
      };
    }

    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      reset: now + ((1 - bucket.tokens) / this.config.tokenBucket.refillRate) * 1000
    };
  }

  /**
   * Check sliding window rate limit
   * @param {string} clientId - Unique client identifier
   * @returns {Object} { allowed: boolean, count: number, limit: number, reset: timestamp }
   */
  checkSlidingWindow(clientId) {
    if (!this.config.slidingWindow.enabled) {
      return { allowed: true, count: 0, limit: Infinity, reset: 0 };
    }

    const now = Date.now();
    const windowSize = this.config.slidingWindow.windowSize;
    const maxRequests = this.config.slidingWindow.maxRequests;

    let window = this.slidingWindows.get(clientId);

    if (!window) {
      window = {
        requests: [],
        created: now
      };
    }

    // Remove old requests outside the window
    window.requests = window.requests.filter(timestamp => now - timestamp < windowSize);

    // Check if limit exceeded
    const allowed = window.requests.length < maxRequests;

    if (allowed) {
      window.requests.push(now);
    }

    this.slidingWindows.set(clientId, window);

    return {
      allowed,
      count: window.requests.length,
      limit: maxRequests,
      reset: window.requests.length > 0 ? window.requests[0] + windowSize : 0
    };
  }

  /**
   * Check per-endpoint rate limit
   * @param {string} clientId - Client identifier
   * @param {string} endpoint - Endpoint/command name
   * @returns {Object} { allowed: boolean, count: number, limit: number, reset: timestamp }
   */
  checkPerEndpoint(clientId, endpoint) {
    if (!this.config.perEndpoint.enabled) {
      return { allowed: true, count: 0, limit: Infinity, reset: 0 };
    }

    const now = Date.now();
    const key = `${clientId}:${endpoint}`;
    const config = this.config.perEndpoint.custom[endpoint] || this.config.perEndpoint.defaults;
    const windowSize = config.window;
    const maxRequests = config.limit;

    let tracker = this.endpointTracking.get(key);

    if (!tracker) {
      tracker = {
        requests: [],
        created: now
      };
    }

    // Remove old requests
    tracker.requests = tracker.requests.filter(timestamp => now - timestamp < windowSize);

    const allowed = tracker.requests.length < maxRequests;

    if (allowed) {
      tracker.requests.push(now);
    }

    this.endpointTracking.set(key, tracker);

    return {
      allowed,
      count: tracker.requests.length,
      limit: maxRequests,
      reset: tracker.requests.length > 0 ? tracker.requests[0] + windowSize : 0
    };
  }

  /**
   * Check per-identity rate limit
   * @param {Object} identity - Identity (ip, userId, apiKey)
   * @returns {Object} { allowed: boolean, type: string, reset: timestamp }
   */
  checkPerIdentity(identity) {
    if (!this.config.perIdentity.enabled) {
      return { allowed: true, type: 'identity', reset: 0 };
    }

    const now = Date.now();
    const windowSize = 60000; // 1 minute

    // Check IP limit
    if (identity.ip) {
      const ipKey = `ip:${identity.ip}`;
      let ipTracker = this.identityTracking.get(ipKey);

      if (!ipTracker) {
        ipTracker = { requests: [], created: now };
      }

      ipTracker.requests = ipTracker.requests.filter(ts => now - ts < windowSize);
      const ipAllowed = ipTracker.requests.length < this.config.perIdentity.ipLimit;

      if (!ipAllowed) {
        return {
          allowed: false,
          type: 'ip',
          limit: this.config.perIdentity.ipLimit,
          count: ipTracker.requests.length,
          reset: ipTracker.requests[0] + windowSize
        };
      }

      if (ipAllowed) {
        ipTracker.requests.push(now);
        this.identityTracking.set(ipKey, ipTracker);
      }
    }

    // Check user limit
    if (identity.userId) {
      const userKey = `user:${identity.userId}`;
      let userTracker = this.identityTracking.get(userKey);

      if (!userTracker) {
        userTracker = { requests: [], created: now };
      }

      userTracker.requests = userTracker.requests.filter(ts => now - ts < windowSize);
      const userAllowed = userTracker.requests.length < this.config.perIdentity.userLimit;

      if (!userAllowed) {
        return {
          allowed: false,
          type: 'user',
          limit: this.config.perIdentity.userLimit,
          count: userTracker.requests.length,
          reset: userTracker.requests[0] + windowSize
        };
      }

      if (userAllowed) {
        userTracker.requests.push(now);
        this.identityTracking.set(userKey, userTracker);
      }
    }

    // Check API key limit
    if (identity.apiKey) {
      const keyKey = `key:${identity.apiKey}`;
      let keyTracker = this.identityTracking.get(keyKey);

      if (!keyTracker) {
        keyTracker = { requests: [], created: now };
      }

      keyTracker.requests = keyTracker.requests.filter(ts => now - ts < windowSize);
      const keyAllowed = keyTracker.requests.length < this.config.perIdentity.apiKeyLimit;

      if (!keyAllowed) {
        return {
          allowed: false,
          type: 'apiKey',
          limit: this.config.perIdentity.apiKeyLimit,
          count: keyTracker.requests.length,
          reset: keyTracker.requests[0] + windowSize
        };
      }

      if (keyAllowed) {
        keyTracker.requests.push(now);
        this.identityTracking.set(keyKey, keyTracker);
      }
    }

    return { allowed: true, type: 'identity', reset: 0 };
  }

  /**
   * Comprehensive rate limit check
   * @param {string} clientId - Client ID
   * @param {Object} options - Check options
   * @returns {Object} { allowed: boolean, reason: string, limits: {} }
   */
  checkRateLimit(clientId, options = {}) {
    const {
      endpoint,
      identity,
      skipBypass = false
    } = options;

    // Check admin bypass
    if (!skipBypass && identity && this.shouldBypass(identity)) {
      return {
        allowed: true,
        reason: 'admin_bypass',
        limits: {}
      };
    }

    const limits = {};
    const blocks = [];

    // Token bucket check
    if (this.config.tokenBucket.enabled) {
      const tbCheck = this.checkTokenBucket(clientId);
      limits.tokenBucket = tbCheck;
      if (!tbCheck.allowed) blocks.push('token_bucket');
    }

    // Sliding window check
    if (this.config.slidingWindow.enabled) {
      const swCheck = this.checkSlidingWindow(clientId);
      limits.slidingWindow = swCheck;
      if (!swCheck.allowed) blocks.push('sliding_window');
    }

    // Per-endpoint check
    if (endpoint && this.config.perEndpoint.enabled) {
      const epCheck = this.checkPerEndpoint(clientId, endpoint);
      limits.perEndpoint = epCheck;
      if (!epCheck.allowed) blocks.push('per_endpoint');
    }

    // Per-identity check
    if (identity && this.config.perIdentity.enabled) {
      const idCheck = this.checkPerIdentity(identity);
      limits.perIdentity = idCheck;
      if (!idCheck.allowed) blocks.push('per_identity');
    }

    return {
      allowed: blocks.length === 0,
      reason: blocks.length > 0 ? blocks[0] : 'allowed',
      blocks,
      limits
    };
  }

  /**
   * Get rate limit status for a client
   * @param {string} clientId - Client ID
   * @returns {Object} Current status
   */
  getStatus(clientId) {
    return {
      tokenBucket: this.tokenBuckets.get(clientId) || null,
      slidingWindow: this.slidingWindows.get(clientId) || null,
      trackedEndpoints: Array.from(this.endpointTracking.keys()).filter(k => k.startsWith(clientId))
    };
  }

  /**
   * Reset rate limits for a client
   * @param {string} clientId - Client ID
   */
  reset(clientId) {
    this.tokenBuckets.delete(clientId);
    this.slidingWindows.delete(clientId);

    // Reset all endpoints for this client
    for (const key of this.endpointTracking.keys()) {
      if (key.startsWith(clientId)) {
        this.endpointTracking.delete(key);
      }
    }
  }

  /**
   * Reset all rate limits
   */
  resetAll() {
    this.tokenBuckets.clear();
    this.slidingWindows.clear();
    this.endpointTracking.clear();
    this.identityTracking.clear();
  }

  /**
   * Start periodic cleanup of stale entries
   */
  startCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 24 * 60 * 60 * 1000; // 24 hours

      // Clean up sliding windows
      for (const [key, window] of this.slidingWindows.entries()) {
        if (now - window.created > staleThreshold) {
          this.slidingWindows.delete(key);
        }
      }

      // Clean up endpoint tracking
      for (const [key, tracker] of this.endpointTracking.entries()) {
        if (now - tracker.created > staleThreshold) {
          this.endpointTracking.delete(key);
        }
      }

      // Clean up identity tracking
      for (const [key, tracker] of this.identityTracking.entries()) {
        if (now - tracker.created > staleThreshold) {
          this.identityTracking.delete(key);
        }
      }
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Get statistics
   * @returns {Object} Current statistics
   */
  getStats() {
    return {
      tokenBuckets: this.tokenBuckets.size,
      slidingWindows: this.slidingWindows.size,
      endpointTracking: this.endpointTracking.size,
      identityTracking: this.identityTracking.size,
      totalTracked: this.tokenBuckets.size + this.slidingWindows.size
    };
  }
}

module.exports = AdvancedRateLimiter;

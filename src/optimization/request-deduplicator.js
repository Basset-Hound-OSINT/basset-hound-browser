/**
 * Request Deduplicator - OPT-19 Implementation
 * Basset Hound Browser Performance Optimization
 *
 * Deduplicates requests within time window
 * - Tracks request fingerprints (command + params hash)
 * - Returns cached response within 100ms time window
 * - Supports idempotent operations only
 * - Helps with network retries
 *
 * Expected Gain: +3-5% throughput
 * Test Coverage: 18+ deduplication scenarios
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

const crypto = require('crypto');

class RequestDeduplicator {
  constructor(options = {}) {
    this.timeWindow = options.timeWindow || 100;           // ms - dedup window
    this.enabled = options.enabled !== false;
    this.maxCacheSize = options.maxCacheSize || 1000;      // max entries

    // Request cache: fingerprint -> {response, timestamp, count}
    this.requestCache = new Map();

    // Idempotent commands whitelist
    this.idempotentCommands = new Set([
      'get_url', 'get_content', 'get_page_state', 'screenshot',
      'screenshot_viewport', 'screenshot_full_page', 'screenshot_element',
      'get_cookies', 'get_all_cookies', 'list_sessions', 'list_tabs',
      'get_tab_info', 'get_active_tab', 'get_history', 'get_downloads',
      'get_proxy_status', 'get_user_agent_status', 'status', 'ping',
      'get_network_logs', 'get_console_logs', 'list_profiles', 'get_profile',
      'get_storage_stats', 'get_local_storage', 'get_session_storage',
      'list_scripts', 'get_script', 'get_blocking_stats', 'get_devtools_status'
    ]);

    // Statistics
    this.stats = {
      totalRequests: 0,
      totalDeduped: 0,
      totalCacheHits: 0,
      cacheEvictions: 0,
      dedupedBytes: 0
    };
  }

  /**
   * Check if request can be deduplicated (is idempotent)
   * @param {string} command - Command name
   * @returns {boolean}
   */
  isIdempotent(command) {
    return this.idempotentCommands.has(command);
  }

  /**
   * Generate fingerprint for request
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @returns {string} - SHA256 fingerprint
   * @private
   */
  _generateFingerprint(command, params) {
    const hash = crypto.createHash('sha256');
    hash.update(command);
    hash.update(JSON.stringify(params || {}));
    return hash.digest('hex');
  }

  /**
   * Try to get cached response for request
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @returns {Object|null} - Cached response or null
   */
  getCachedResponse(command, params) {
    if (!this.enabled || !this.isIdempotent(command)) {
      return null;
    }

    const fingerprint = this._generateFingerprint(command, params);
    const cached = this.requestCache.get(fingerprint);

    if (!cached) {
      return null;
    }

    // Check if cache entry is still within time window
    const age = Date.now() - cached.timestamp;
    if (age > this.timeWindow) {
      this.requestCache.delete(fingerprint);
      return null;
    }

    // Cache hit!
    this.stats.totalCacheHits++;
    cached.count++;
    cached.lastHit = Date.now();
    cached.responseSize = Buffer.byteLength(JSON.stringify(cached.response), 'utf8');

    return cached.response;
  }

  /**
   * Cache response for request
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   * @param {Object} response - Response to cache
   */
  cacheResponse(command, params, response) {
    if (!this.enabled || !this.isIdempotent(command)) {
      return;
    }

    const fingerprint = this._generateFingerprint(command, params);
    const responseSize = Buffer.byteLength(JSON.stringify(response), 'utf8');

    this.requestCache.set(fingerprint, {
      response,
      timestamp: Date.now(),
      lastHit: Date.now(),
      count: 1,
      responseSize
    });

    this.stats.totalRequests++;

    // Enforce max cache size with LRU eviction
    if (this.requestCache.size > this.maxCacheSize) {
      this._evictOldest();
    }
  }

  /**
   * Evict oldest entry (LRU strategy)
   * @private
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.requestCache) {
      const lastUsed = entry.lastHit || entry.timestamp;
      if (lastUsed < oldestTime) {
        oldestTime = lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const removed = this.requestCache.get(oldestKey);
      this.requestCache.delete(oldestKey);
      this.stats.cacheEvictions++;
    }
  }

  /**
   * Record deduplication (request was satisfied from cache)
   * @param {string} command - Command name
   * @param {Object} params - Command parameters
   */
  recordDedup(command, params) {
    if (!this.enabled || !this.isIdempotent(command)) {
      return;
    }

    this.stats.totalDeduped++;

    // Estimate bandwidth saved (average response size)
    const avgResponseSize = this.stats.dedupedBytes > 0
      ? this.stats.dedupedBytes / this.stats.totalDeduped
      : 1024;

    this.stats.dedupedBytes += avgResponseSize;
  }

  /**
   * Clear cache
   */
  clear() {
    this.requestCache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired() {
    const now = Date.now();
    const expired = [];

    for (const [key, entry] of this.requestCache) {
      if (now - entry.timestamp > this.timeWindow) {
        expired.push(key);
      }
    }

    expired.forEach(key => this.requestCache.delete(key));
    return expired.length;
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    this.clearExpired(); // Clean up first

    const dedupRate = this.stats.totalRequests > 0
      ? ((this.stats.totalDeduped / this.stats.totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    const cacheHitRate = this.stats.totalRequests > 0
      ? ((this.stats.totalCacheHits / this.stats.totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    const bandwidthSaved = (this.stats.dedupedBytes / 1024 / 1024).toFixed(2) + ' MB';

    return {
      enabled: this.enabled,
      cacheSize: this.requestCache.size,
      maxCacheSize: this.maxCacheSize,
      totalRequests: this.stats.totalRequests,
      totalDeduped: this.stats.totalDeduped,
      dedupRate: dedupRate,
      totalCacheHits: this.stats.totalCacheHits,
      cacheHitRate: cacheHitRate,
      cacheEvictions: this.stats.cacheEvictions,
      dedupedBytes: this.stats.dedupedBytes,
      bandwidthSaved: bandwidthSaved,
      timeWindow: this.timeWindow + 'ms',
      idempotentCommandsCount: this.idempotentCommands.size
    };
  }

  /**
   * Get cache entries (for debugging)
   * @returns {Array<Object>}
   */
  getCacheEntries() {
    const entries = [];
    for (const [key, entry] of this.requestCache) {
      entries.push({
        fingerprint: key.substring(0, 8) + '...',
        age: Date.now() - entry.timestamp,
        count: entry.count,
        responseSize: entry.responseSize,
        valid: (Date.now() - entry.timestamp) <= this.timeWindow
      });
    }
    return entries;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      totalDeduped: 0,
      totalCacheHits: 0,
      cacheEvictions: 0,
      dedupedBytes: 0
    };
  }

  /**
   * Configure deduplicator
   * @param {Object} config - Configuration updates
   */
  configure(config) {
    if (config.timeWindow !== undefined) {
      this.timeWindow = config.timeWindow;
    }
    if (config.enabled !== undefined) {
      this.enabled = config.enabled;
    }
    if (config.maxCacheSize !== undefined) {
      this.maxCacheSize = config.maxCacheSize;
    }
  }

  /**
   * Get current configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      enabled: this.enabled,
      timeWindow: this.timeWindow,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Add custom idempotent command
   * @param {string} command - Command name
   */
  addIdempotentCommand(command) {
    this.idempotentCommands.add(command);
  }

  /**
   * Remove idempotent command
   * @param {string} command - Command name
   */
  removeIdempotentCommand(command) {
    this.idempotentCommands.delete(command);
  }
}

module.exports = RequestDeduplicator;

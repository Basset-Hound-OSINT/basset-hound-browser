/**
 * LRU Cache for Screenshot Results
 *
 * Provides efficient caching with LRU eviction policy, invalidation triggers,
 * and comprehensive statistics tracking.
 */

/**
 * LRU Cache configuration
 */
const LRU_CACHE_CONFIG = {
  maxEntries: 100,
  maxMemoryMB: 50,
  ttlMs: 3600000,  // 1 hour default
  enableStats: true,
  serializeKey: true
};

/**
 * LRUCache class for screenshot result caching
 */
class LRUCache {
  constructor(options = {}) {
    this.options = { ...LRU_CACHE_CONFIG, ...options };
    this.cache = new Map();
    this.accessOrder = [];  // Track access order for LRU
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      createdAt: Date.now(),
      entries: 0,
      maxMemoryUsage: 0,
      currentMemoryUsage: 0,
      invalidations: 0
    };

    // Start TTL cleanup interval
    this.startTTLCleanup();
  }

  /**
   * Generate cache key
   * @param {string|Object} key - Key or object to serialize
   * @returns {string} Cache key
   */
  generateKey(key) {
    if (typeof key === 'string') {
      return key;
    }

    if (this.options.serializeKey && typeof key === 'object') {
      return JSON.stringify(key);
    }

    return String(key);
  }

  /**
   * Set cache value
   * @param {string|Object} key - Cache key
   * @param {*} value - Value to cache
   * @param {Object} options - Cache options
   */
  set(key, value, options = {}) {
    const cacheKey = this.generateKey(key);
    const ttl = options.ttl || this.options.ttlMs;
    const size = this.estimateSize(value);

    // Check if we're at capacity
    if (this.cache.size >= this.options.maxEntries && !this.cache.has(cacheKey)) {
      this.evictLRU();
    }

    // Check memory limit
    if (this.stats.currentMemoryUsage + size > this.options.maxMemoryMB * 1024 * 1024) {
      // Evict multiple entries until we have space
      while (this.cache.size > 0 && this.stats.currentMemoryUsage + size > this.options.maxMemoryMB * 1024 * 1024) {
        this.evictLRU();
      }
    }

    // Update existing entry
    if (this.cache.has(cacheKey)) {
      const oldEntry = this.cache.get(cacheKey);
      this.stats.currentMemoryUsage -= oldEntry.size;
      this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
    }

    // Store entry
    const entry = {
      value,
      size,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessCount: 0,
      lastAccessedAt: Date.now()
    };

    this.cache.set(cacheKey, entry);
    this.accessOrder.push(cacheKey);

    this.stats.entries = this.cache.size;
    this.stats.currentMemoryUsage += size;

    if (this.stats.currentMemoryUsage > this.stats.maxMemoryUsage) {
      this.stats.maxMemoryUsage = this.stats.currentMemoryUsage;
    }
  }

  /**
   * Get cache value
   * @param {string|Object} key - Cache key
   * @returns {*} Cached value or null
   */
  get(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
      this.stats.currentMemoryUsage -= entry.size;
      this.stats.invalidations++;
      this.stats.misses++;
      return null;
    }

    // Update access order
    this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
    this.accessOrder.push(cacheKey);

    // Update access stats
    entry.accessCount++;
    entry.lastAccessedAt = Date.now();

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Check if key exists and is valid
   * @param {string|Object} key - Cache key
   * @returns {boolean} True if exists and valid
   */
  has(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(cacheKey);
      this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
      this.stats.currentMemoryUsage -= entry.size;
      this.stats.invalidations++;
      return false;
    }

    return true;
  }

  /**
   * Delete cache entry
   * @param {string|Object} key - Cache key
   * @returns {boolean} True if deleted
   */
  delete(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (entry) {
      this.cache.delete(cacheKey);
      this.accessOrder = this.accessOrder.filter(k => k !== cacheKey);
      this.stats.currentMemoryUsage -= entry.size;
      return true;
    }

    return false;
  }

  /**
   * Evict least recently used entry
   */
  evictLRU() {
    if (this.accessOrder.length === 0) {
      return;
    }

    const lruKey = this.accessOrder.shift();
    const entry = this.cache.get(lruKey);

    if (entry) {
      this.cache.delete(lruKey);
      this.stats.currentMemoryUsage -= entry.size;
      this.stats.evictions++;
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    this.stats.currentMemoryUsage = 0;
    this.stats.entries = 0;
  }

  /**
   * Start TTL-based cleanup interval
   */
  startTTLCleanup() {
    this.ttlInterval = setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];

      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        const entry = this.cache.get(key);
        if (entry) {
          this.cache.delete(key);
          this.stats.currentMemoryUsage -= entry.size;
          this.stats.invalidations++;
        }
      }

      this.accessOrder = this.accessOrder.filter(k => this.cache.has(k));
      this.stats.entries = this.cache.size;
    }, 60000);  // Every minute
  }

  /**
   * Stop TTL cleanup
   */
  stopTTLCleanup() {
    if (this.ttlInterval) {
      clearInterval(this.ttlInterval);
    }
  }

  /**
   * Get cache entry details
   * @param {string|Object} key - Cache key
   * @returns {Object} Entry details or null
   */
  getDetails(key) {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    return {
      key: cacheKey,
      size: entry.size,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      ttl: entry.expiresAt - Date.now(),
      accessCount: entry.accessCount,
      lastAccessedAt: entry.lastAccessedAt,
      isExpired: entry.expiresAt < Date.now()
    };
  }

  /**
   * Estimate size of value
   * @param {*} value - Value to estimate
   * @returns {number} Estimated size in bytes
   */
  estimateSize(value) {
    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    if (typeof value === 'string') {
      return value.length * 2;  // UTF-16
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value).length * 2;
      } catch {
        return 1024;  // Default estimate
      }
    }

    return 8;  // Primitive types
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    const avgEntrySize = this.stats.entries > 0
      ? (this.stats.currentMemoryUsage / this.stats.entries).toFixed(2)
      : 0;

    const uptime = Date.now() - this.stats.createdAt;

    return {
      ...this.stats,
      hitRate,
      avgEntrySize,
      uptime,
      maxMemoryUsageMB: (this.stats.maxMemoryUsage / 1024 / 1024).toFixed(2),
      currentMemoryUsageMB: (this.stats.currentMemoryUsage / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Get all cache entries (for inspection)
   * @returns {Array} Array of entries
   */
  getAll() {
    const entries = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        size: entry.size,
        accessCount: entry.accessCount,
        lastAccessedAt: entry.lastAccessedAt,
        expiresAt: entry.expiresAt,
        isExpired: entry.expiresAt < Date.now()
      });
    }

    return entries.sort((a, b) => b.accessCount - a.accessCount);
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      createdAt: Date.now(),
      entries: this.cache.size,
      maxMemoryUsage: this.stats.currentMemoryUsage,
      currentMemoryUsage: this.stats.currentMemoryUsage,
      invalidations: 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopTTLCleanup();
    this.clear();
  }
}

module.exports = {
  LRUCache,
  LRU_CACHE_CONFIG
};

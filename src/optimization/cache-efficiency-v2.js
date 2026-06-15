/**
 * Cache Efficiency Optimization v2
 *
 * Advanced caching strategies for Phase 4:
 * - Improve cache hit rates (target 90%+)
 * - Optimize key hashing
 * - Reduce collision chains
 * - Dynamic TTL tuning
 *
 * Expected Gain: +1-2% throughput
 *
 * @module src/optimization/cache-efficiency-v2
 */

const { performance } = require('perf_hooks');

/**
 * High-Performance Cache with Optimized Hashing
 *
 * Features:
 * - Custom hash function for command signatures
 * - Linear probing for collision resolution
 * - Dynamic resize based on load factor
 * - Automatic TTL tuning
 */
class CacheEfficiencyV2 {
  constructor(options = {}) {
    // Configuration
    this.initialCapacity = options.initialCapacity || 1024;
    this.maxLoadFactor = options.maxLoadFactor || 0.75;
    this.minLoadFactor = options.minLoadFactor || 0.25;
    this.defaultTTL = options.defaultTTL || 60000; // 60 seconds
    this.enableAdaptiveTTL = options.enableAdaptiveTTL !== false;
    this.enableAutoResize = options.enableAutoResize !== false;

    // Initialize internal structures
    this.buckets = new Array(this.initialCapacity);
    this.size = 0;
    this.capacity = this.initialCapacity;

    // Metrics
    this.metrics = {
      gets: 0,
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      resizes: 0,
      collisions: 0,
      averageProbeLength: 0,
      ttlAdjustments: 0
    };

    // TTL tracking for adaptive tuning
    this.accessPatterns = new Map(); // key -> [accessCount, lastAccessTime]
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Object|null} { value, hit: boolean }
   */
  get(key) {
    this.metrics.gets++;

    const hash = this._hash(key);
    let index = hash % this.capacity;
    let probeLength = 0;

    // Linear probing to find key
    while (this.buckets[index] !== undefined) {
      const bucket = this.buckets[index];

      if (bucket.key === key) {
        // Check if expired
        if (bucket.expiresAt && Date.now() > bucket.expiresAt) {
          this._delete(index);
          this.metrics.misses++;
          return { value: null, hit: false };
        }

        // Hit
        this.metrics.hits++;
        bucket.lastAccess = Date.now();
        bucket.accessCount = (bucket.accessCount || 0) + 1;

        // Track access pattern for TTL tuning
        this._recordAccess(key, bucket);

        return { value: bucket.value, hit: true };
      }

      index = (index + 1) % this.capacity;
      probeLength++;

      // Safety limit
      if (probeLength > this.capacity) {
        this.metrics.misses++;
        return { value: null, hit: false };
      }
    }

    // Miss
    this.metrics.misses++;
    return { value: null, hit: false };
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - TTL in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    this.metrics.sets++;

    // Check if key already exists
    const hash = this._hash(key);
    let index = hash % this.capacity;
    let probeLength = 0;

    while (this.buckets[index] !== undefined) {
      const bucket = this.buckets[index];

      if (bucket.key === key) {
        // Update existing
        bucket.value = value;
        bucket.expiresAt = ttl ? Date.now() + ttl : null;
        bucket.lastAccess = Date.now();
        return;
      }

      index = (index + 1) % this.capacity;
      probeLength++;
      this.metrics.collisions++;
    }

    // Insert new entry
    const entryTTL = ttl || this._getAdaptiveTTL(key);
    this.buckets[index] = {
      key,
      value,
      expiresAt: entryTTL ? Date.now() + entryTTL : null,
      insertTime: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1
    };

    this.size++;
    this._updateAverageProbeLength(probeLength);

    // Check if resize needed
    if (this.enableAutoResize && this.size / this.capacity > this.maxLoadFactor) {
      this._resize(this.capacity * 2);
    }
  }

  /**
   * Delete key from cache
   * @private
   */
  _delete(index) {
    if (this.buckets[index]) {
      this.buckets[index] = undefined;
      this.size--;
      this.metrics.evictions++;

      // Check if downsize needed
      if (this.enableAutoResize && this.capacity > this.initialCapacity &&
          this.size / this.capacity < this.minLoadFactor) {
        this._resize(Math.max(this.initialCapacity, this.capacity / 2));
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.buckets = new Array(this.capacity);
    this.size = 0;
    this.accessPatterns.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.metrics.gets > 0
      ? (this.metrics.hits / this.metrics.gets * 100).toFixed(2)
      : 0;

    const loadFactor = this.size / this.capacity;

    return {
      ...this.metrics,
      size: this.size,
      capacity: this.capacity,
      hitRate: `${hitRate}%`,
      loadFactor: loadFactor.toFixed(3),
      averageProbeLength: this.metrics.averageProbeLength.toFixed(2)
    };
  }

  /**
   * Hash key using optimized algorithm
   * @private
   */
  _hash(key) {
    let hash = 0;

    // Fast hash for command strings
    for (let i = 0; i < Math.min(key.length, 50); i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Get adaptive TTL based on access patterns
   * @private
   */
  _getAdaptiveTTL(key) {
    if (!this.enableAdaptiveTTL) {
      return this.defaultTTL;
    }

    // Keys with predictable access patterns get longer TTL
    const pattern = this.accessPatterns.get(key);
    if (pattern && pattern.accessCount > 10) {
      return this.defaultTTL * 2; // Double TTL for hot keys
    }

    return this.defaultTTL;
  }

  /**
   * Record access pattern for TTL tuning
   * @private
   */
  _recordAccess(key, bucket) {
    const pattern = this.accessPatterns.get(key) || { accessCount: 0, lastAccessTime: 0 };
    pattern.accessCount++;
    pattern.lastAccessTime = Date.now();

    this.accessPatterns.set(key, pattern);

    // Cleanup old patterns
    if (this.accessPatterns.size > this.capacity / 2) {
      const oldest = Array.from(this.accessPatterns.entries())
        .sort((a, b) => a[1].lastAccessTime - b[1].lastAccessTime)
        .slice(0, Math.floor(this.accessPatterns.size / 4));

      for (const [k] of oldest) {
        this.accessPatterns.delete(k);
      }
    }
  }

  /**
   * Resize hash table
   * @private
   */
  _resize(newCapacity) {
    const oldBuckets = this.buckets;
    this.buckets = new Array(newCapacity);
    this.capacity = newCapacity;
    this.size = 0;

    this.metrics.resizes++;

    // Rehash all entries
    for (const bucket of oldBuckets) {
      if (bucket) {
        const key = bucket.key;
        const value = bucket.value;

        // Only rehash if not expired
        if (!bucket.expiresAt || Date.now() <= bucket.expiresAt) {
          const hash = this._hash(key);
          let index = hash % this.capacity;

          while (this.buckets[index] !== undefined) {
            index = (index + 1) % this.capacity;
          }

          this.buckets[index] = bucket;
          this.size++;
        }
      }
    }
  }

  /**
   * Update average probe length
   * @private
   */
  _updateAverageProbeLength(probeLength) {
    this.metrics.averageProbeLength =
      (this.metrics.averageProbeLength * (this.metrics.sets - 1) + probeLength) /
      this.metrics.sets;
  }

  /**
   * Evict expired entries
   */
  evictExpired() {
    let evicted = 0;

    for (let i = 0; i < this.buckets.length; i++) {
      const bucket = this.buckets[i];

      if (bucket && bucket.expiresAt && Date.now() > bucket.expiresAt) {
        this._delete(i);
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Get hot keys (frequently accessed)
   */
  getHotKeys(limit = 10) {
    return Array.from(this.accessPatterns.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, limit)
      .map(([key, pattern]) => ({ key, ...pattern }));
  }
}

/**
 * Cache Layer Coordinator
 * Manages multiple cache instances for different data types
 */
class CacheCoordinator {
  constructor(options = {}) {
    this.caches = new Map();

    // Create caches for different types
    this.caches.set('command', new CacheEfficiencyV2({ defaultTTL: 30000 }));
    this.caches.set('response', new CacheEfficiencyV2({ defaultTTL: 10000 }));
    this.caches.set('dom', new CacheEfficiencyV2({ defaultTTL: 60000 }));
    this.caches.set('network', new CacheEfficiencyV2({ defaultTTL: 5000 }));

    this.metrics = {
      totalGets: 0,
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0
    };
  }

  /**
   * Get value from appropriate cache
   */
  get(cacheType, key) {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      throw new Error(`Unknown cache type: ${cacheType}`);
    }

    const result = cache.get(key);
    this.metrics.totalGets++;

    if (result.hit) {
      this.metrics.totalHits++;
    } else {
      this.metrics.totalMisses++;
    }

    return result.value;
  }

  /**
   * Set value in appropriate cache
   */
  set(cacheType, key, value, ttl = null) {
    const cache = this.caches.get(cacheType);
    if (!cache) {
      throw new Error(`Unknown cache type: ${cacheType}`);
    }

    cache.set(key, value, ttl);
    this.metrics.totalSets++;
  }

  /**
   * Clear specific cache
   */
  clear(cacheType) {
    const cache = this.caches.get(cacheType);
    if (cache) {
      cache.clear();
    }
  }

  /**
   * Clear all caches
   */
  clearAll() {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get aggregated metrics
   */
  getMetrics() {
    const allStats = {};

    for (const [type, cache] of this.caches.entries()) {
      allStats[type] = cache.getStats();
    }

    const totalHitRate = this.metrics.totalGets > 0
      ? (this.metrics.totalHits / this.metrics.totalGets * 100).toFixed(2)
      : 0;

    return {
      caches: allStats,
      aggregate: {
        ...this.metrics,
        totalHitRate: `${totalHitRate}%`
      }
    };
  }
}

module.exports = { CacheEfficiencyV2, CacheCoordinator };

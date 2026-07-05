/**
 * Multi-Tier Cache Manager
 * Supports memory, Redis, and disk caching with TTL, eviction policies, and monitoring
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class CacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.memoryCache = new Map();
    this.redisClient = options.redisClient || null;
    this.diskCachePath = options.diskCachePath || path.join(process.cwd(), '.cache');
    this.maxMemorySize = options.maxMemorySize || 100 * 1024 * 1024; // 100MB
    this.currentMemorySize = 0;
    this.evictionPolicy = options.evictionPolicy || 'LRU'; // LRU, LFU
    this.defaultTTL = options.defaultTTL || 3600000; // 1 hour
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    this.accessCounts = new Map(); // For LFU
    this.accessTimes = new Map(); // For LRU
    this.ttlTimers = new Map();
    this.tags = new Map(); // Tag-based invalidation

    // Ensure disk cache directory exists
    if (!fs.existsSync(this.diskCachePath)) {
      fs.mkdirSync(this.diskCachePath, { recursive: true });
    }
  }

  /**
   * Set a value in cache with multi-tier support
   */
  async set(key, value, options = {}) {
    const {
      ttl = this.defaultTTL,
      tier = 'memory', // memory, redis, disk, all
      tags = [],
      compress = false
    } = options;

    const cacheEntry = {
      value,
      timestamp: Date.now(),
      ttl,
      tier,
      tags,
      compress,
      size: this._estimateSize(value)
    };

    this.metrics.sets++;

    // Memory tier
    if (tier === 'memory' || tier === 'all') {
      this._setMemoryCache(key, cacheEntry);
    }

    // Redis tier
    if ((tier === 'redis' || tier === 'all') && this.redisClient) {
      await this._setRedisCache(key, cacheEntry);
    }

    // Disk tier
    if (tier === 'disk' || tier === 'all') {
      await this._setDiskCache(key, cacheEntry);
    }

    // Register TTL
    this._registerTTL(key, ttl);

    // Register tags for invalidation
    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag).add(key);
    }

    this.emit('set', { key, tier, ttl });
    return true;
  }

  /**
   * Get a value from cache (multi-tier lookup)
   */
  async get(key) {
    let value = null;
    let hitTier = null;

    // Try memory first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (!this._isExpired(entry)) {
        value = entry.value;
        hitTier = 'memory';
        this._recordAccess(key, 'memory');
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Try Redis if not found in memory
    if (!value && this.redisClient) {
      try {
        const redisValue = await this._getRedisCache(key);
        if (redisValue !== null) {
          value = redisValue;
          hitTier = 'redis';
          this._recordAccess(key, 'redis');
        }
      } catch (err) {
        this.emit('error', { type: 'redis_read', key, error: err.message });
      }
    }

    // Try disk if not found elsewhere
    if (!value) {
      try {
        const diskValue = await this._getDiskCache(key);
        if (diskValue !== null) {
          value = diskValue;
          hitTier = 'disk';
          this._recordAccess(key, 'disk');
        }
      } catch (err) {
        this.emit('error', { type: 'disk_read', key, error: err.message });
      }
    }

    if (value !== null) {
      this.metrics.hits++;
      this.emit('hit', { key, tier: hitTier });
      return value;
    }

    this.metrics.misses++;
    this.emit('miss', { key });
    return null;
  }

  /**
   * Delete a value from all tiers
   */
  async delete(key) {
    this.metrics.deletes++;

    // Remove from memory
    this.memoryCache.delete(key);
    this.accessCounts.delete(key);
    this.accessTimes.delete(key);

    // Remove from Redis
    if (this.redisClient) {
      try {
        await this.redisClient.del(this._prefixKey(key));
      } catch (err) {
        this.emit('error', { type: 'redis_delete', key, error: err.message });
      }
    }

    // Remove from disk
    const diskPath = this._getDiskPath(key);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }

    // Clear TTL timer
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
      this.ttlTimers.delete(key);
    }

    // Remove from tags
    for (const [tag, keys] of this.tags.entries()) {
      keys.delete(key);
      if (keys.size === 0) {
        this.tags.delete(tag);
      }
    }

    this.emit('delete', { key });
    return true;
  }

  /**
   * Invalidate all keys with a specific tag
   */
  async invalidateTag(tag) {
    const keys = this.tags.get(tag) || new Set();
    const invalidatedCount = keys.size;

    for (const key of keys) {
      await this.delete(key);
    }

    this.tags.delete(tag);
    this.emit('tag_invalidated', { tag, count: invalidatedCount });
    return invalidatedCount;
  }

  /**
   * Clear entire cache
   */
  async clear() {
    this.memoryCache.clear();
    this.accessCounts.clear();
    this.accessTimes.clear();
    this.tags.clear();

    // Clear all TTL timers
    for (const timer of this.ttlTimers.values()) {
      clearTimeout(timer);
    }
    this.ttlTimers.clear();

    // Clear Redis
    if (this.redisClient) {
      try {
        await this.redisClient.flushdb();
      } catch (err) {
        this.emit('error', { type: 'redis_flush', error: err.message });
      }
    }

    // Clear disk
    if (fs.existsSync(this.diskCachePath)) {
      const files = fs.readdirSync(this.diskCachePath);
      for (const file of files) {
        fs.unlinkSync(path.join(this.diskCachePath, file));
      }
    }

    this.emit('cleared', {});
    return true;
  }

  /**
   * Get cache statistics
   */
  getMetrics() {
    const hitRate = this.metrics.hits + this.metrics.misses > 0
      ? (this.metrics.hits / (this.metrics.hits + this.metrics.misses)) * 100
      : 0;

    return {
      ...this.metrics,
      hitRate: hitRate.toFixed(2) + '%',
      memorySize: this.currentMemorySize,
      maxMemorySize: this.maxMemorySize,
      memoryUtilization: ((this.currentMemorySize / this.maxMemorySize) * 100).toFixed(2) + '%',
      entryCount: this.memoryCache.size,
      tagCount: this.tags.size
    };
  }

  /**
   * Compact disk cache (remove expired entries)
   */
  async compactDisk() {
    const diskPath = this.diskCachePath;
    if (!fs.existsSync(diskPath)) {
      return 0;
    }

    const files = fs.readdirSync(diskPath);
    let removedCount = 0;

    for (const file of files) {
      const filePath = path.join(diskPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const entry = JSON.parse(content);
        if (this._isExpired(entry)) {
          fs.unlinkSync(filePath);
          removedCount++;
        }
      } catch (err) {
        // Corrupted file, remove it
        try {
          fs.unlinkSync(filePath);
          removedCount++;
        } catch (unlinkErr) {
          // Ignore
        }
      }
    }

    this.emit('disk_compacted', { removedCount });
    return removedCount;
  }

  /**
   * Get cache info
   */
  getInfo() {
    return {
      memoryEntries: this.memoryCache.size,
      memorySize: this.currentMemorySize,
      diskPath: this.diskCachePath,
      redisEnabled: Boolean(this.redisClient),
      evictionPolicy: this.evictionPolicy,
      defaultTTL: this.defaultTTL,
      metrics: this.getMetrics()
    };
  }

  // ==================== Private Methods ====================

  _setMemoryCache(key, entry) {
    // Check memory limits
    if (this.currentMemorySize + entry.size > this.maxMemorySize) {
      this._evictOne();
    }

    if (this.memoryCache.has(key)) {
      const oldEntry = this.memoryCache.get(key);
      this.currentMemorySize -= oldEntry.size;
    }

    this.memoryCache.set(key, entry);
    this.currentMemorySize += entry.size;
    this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
    this.accessTimes.set(key, Date.now());
  }

  async _setRedisCache(key, entry) {
    if (!this.redisClient) {
      return;
    }
    const serialized = JSON.stringify(entry);
    const ttlSeconds = Math.ceil(entry.ttl / 1000);
    await this.redisClient.setex(this._prefixKey(key), ttlSeconds, serialized);
  }

  async _setDiskCache(key, entry) {
    const diskPath = this._getDiskPath(key);
    const serialized = JSON.stringify(entry);
    return new Promise((resolve, reject) => {
      fs.writeFile(diskPath, serialized, 'utf-8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async _getRedisCache(key) {
    if (!this.redisClient) {
      return null;
    }
    const serialized = await this.redisClient.get(this._prefixKey(key));
    if (!serialized) {
      return null;
    }
    const entry = JSON.parse(serialized);
    return this._isExpired(entry) ? null : entry.value;
  }

  async _getDiskCache(key) {
    const diskPath = this._getDiskPath(key);
    if (!fs.existsSync(diskPath)) {
      return null;
    }
    return new Promise((resolve) => {
      fs.readFile(diskPath, 'utf-8', (err, data) => {
        if (err) {
          return resolve(null);
        }
        try {
          const entry = JSON.parse(data);
          resolve(this._isExpired(entry) ? null : entry.value);
        } catch {
          resolve(null);
        }
      });
    });
  }

  _evictOne() {
    if (this.memoryCache.size === 0) {
      return;
    }

    let keyToEvict;
    if (this.evictionPolicy === 'LRU') {
      keyToEvict = Array.from(this.accessTimes.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
    } else if (this.evictionPolicy === 'LFU') {
      keyToEvict = Array.from(this.accessCounts.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
    } else {
      keyToEvict = this.memoryCache.keys().next().value;
    }

    const entry = this.memoryCache.get(keyToEvict);
    this.currentMemorySize -= entry.size;
    this.memoryCache.delete(keyToEvict);
    this.accessCounts.delete(keyToEvict);
    this.accessTimes.delete(keyToEvict);
    this.metrics.evictions++;
    this.emit('evicted', { key: keyToEvict });
  }

  _isExpired(entry) {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  _recordAccess(key, tier) {
    this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
    this.accessTimes.set(key, Date.now());
  }

  _registerTTL(key, ttl) {
    if (this.ttlTimers.has(key)) {
      clearTimeout(this.ttlTimers.get(key));
    }
    const timer = setTimeout(() => {
      this.delete(key).catch((err) => {
        this.emit('error', { type: 'ttl_delete', key, error: err.message });
      });
    }, ttl);
    this.ttlTimers.set(key, timer);
  }

  _estimateSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024; // Estimate for non-serializable objects
    }
  }

  _prefixKey(key) {
    return `cache:${key}`;
  }

  _getDiskPath(key) {
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(this.diskCachePath, hash);
  }
}

module.exports = CacheManager;

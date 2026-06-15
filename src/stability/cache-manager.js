/**
 * Unified Cache Management System
 * Provides LRU eviction, TTL-based expiration, and background cleanup
 *
 * @module src/stability/cache-manager
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * CacheEntry - Represents a cached item with metadata
 * @private
 */
class CacheEntry {
  constructor(key, value, ttlMs = null) {
    this.key = key;
    this.value = value;
    this.createdAt = Date.now();
    this.accessedAt = Date.now();
    this.ttlMs = ttlMs;
    this.hits = 0;
  }

  /**
   * Check if entry has expired
   * @returns {boolean} True if expired
   */
  isExpired() {
    if (this.ttlMs === null) {
      return false; // No TTL, never expires
    }
    return Date.now() - this.createdAt > this.ttlMs;
  }

  /**
   * Update access time and increment hit counter
   */
  recordAccess() {
    this.accessedAt = Date.now();
    this.hits++;
  }
}

/**
 * UnifiedCacheManager - Manages multiple caches with consistent policies
 * Supports LRU eviction, TTL-based expiration, and memory pressure monitoring
 */
class UnifiedCacheManager {
  /**
   * Create a cache manager
   * @param {Object} options - Configuration options
   * @param {number} options.maxSize - Maximum number of entries (default: 1000)
   * @param {number} options.maxMemoryMb - Maximum memory in MB (default: 500)
   * @param {number} options.defaultTtlMs - Default TTL in ms (default: 3600000 = 1 hour)
   * @param {number} options.cleanupIntervalMs - Cleanup interval (default: 300000 = 5 minutes)
   * @param {string} options.name - Cache name for logging (default: 'Cache')
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.maxMemoryMb = options.maxMemoryMb || 500;
    this.maxMemoryBytes = this.maxMemoryMb * 1024 * 1024;
    this.defaultTtlMs = options.defaultTtlMs || 3600000; // 1 hour
    this.cleanupIntervalMs = options.cleanupIntervalMs || 300000; // 5 minutes
    this.name = options.name || 'Cache';

    this.entries = new Map(); // key -> CacheEntry
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expirations: 0,
      totalInserts: 0,
      totalRemoves: 0,
      currentMemoryBytes: 0
    };

    // Start background cleanup
    this.startCleanup();
  }

  /**
   * Start periodic cleanup of expired entries
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
   * Get the approximate size of a value in bytes
   * @param {*} value - Value to measure
   * @returns {number} Approximate size in bytes
   * @private
   */
  getValueSize(value) {
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    }

    if (typeof value === 'number') {
      return 8; // 64-bit
    }

    if (typeof value === 'boolean') {
      return 4;
    }

    if (Buffer.isBuffer(value)) {
      return value.length;
    }

    // For objects/arrays, rough estimate
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 100; // Fallback estimate
    }
  }

  /**
   * Put a value in the cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttlMs - TTL in ms (default: this.defaultTtlMs)
   */
  set(key, value, ttlMs = this.defaultTtlMs) {
    // Remove old entry if exists
    if (this.entries.has(key)) {
      const oldEntry = this.entries.get(key);
      this.stats.currentMemoryBytes -= this.getValueSize(oldEntry.value);
    }

    // Create new entry
    const entry = new CacheEntry(key, value, ttlMs);
    const size = this.getValueSize(value);

    this.entries.set(key, entry);
    this.stats.currentMemoryBytes += size;
    this.stats.totalInserts++;

    // Check if we need to evict
    this.evictIfNeeded();
  }

  /**
   * Get a value from the cache
   * @param {string} key - Cache key
   * @returns {*} Cached value, or undefined if not found/expired
   */
  get(key) {
    if (!this.entries.has(key)) {
      this.stats.misses++;
      return undefined;
    }

    const entry = this.entries.get(key);

    // Check if expired
    if (entry.isExpired()) {
      this.remove(key);
      this.stats.misses++;
      this.stats.expirations++;
      return undefined;
    }

    // Record access
    entry.recordAccess();
    this.stats.hits++;

    return entry.value;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    if (!this.entries.has(key)) {
      return false;
    }

    const entry = this.entries.get(key);

    if (entry.isExpired()) {
      this.remove(key);
      return false;
    }

    return true;
  }

  /**
   * Remove an entry from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if entry was removed
   */
  remove(key) {
    if (!this.entries.has(key)) {
      return false;
    }

    const entry = this.entries.get(key);
    this.stats.currentMemoryBytes -= this.getValueSize(entry.value);
    this.entries.delete(key);
    this.stats.totalRemoves++;

    return true;
  }

  /**
   * Clear all entries from cache
   */
  clear() {
    const count = this.entries.size;
    this.entries.clear();
    this.stats.currentMemoryBytes = 0;
    return count;
  }

  /**
   * Evict entries if size or memory limits exceeded
   * Uses LRU (Least Recently Used) policy
   * @private
   */
  evictIfNeeded() {
    // Check size limit
    while (this.entries.size > this.maxSize) {
      this.evictLRU();
    }

    // Check memory limit
    while (this.stats.currentMemoryBytes > this.maxMemoryBytes) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  evictLRU() {
    if (this.entries.size === 0) {
      return;
    }

    // Find entry with oldest accessedAt
    let lruKey = null;
    let lruTime = Infinity;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.accessedAt < lruTime) {
        lruTime = entry.accessedAt;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.entries.get(lruKey);
      this.stats.currentMemoryBytes -= this.getValueSize(entry.value);
      this.entries.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Cleanup expired entries
   * Called periodically by background job
   */
  cleanup() {
    let expiredCount = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.isExpired()) {
        this.stats.currentMemoryBytes -= this.getValueSize(entry.value);
        this.entries.delete(key);
        expiredCount++;
        this.stats.expirations++;
      }
    }

    return expiredCount;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.entries.size,
      maxSize: this.maxSize,
      memoryMb: (this.stats.currentMemoryBytes / 1024 / 1024).toFixed(2),
      maxMemoryMb: this.maxMemoryMb
    };
  }

  /**
   * Get cache configuration
   * @returns {Object} Configuration
   */
  getConfig() {
    return {
      name: this.name,
      maxSize: this.maxSize,
      maxMemoryMb: this.maxMemoryMb,
      defaultTtlMs: this.defaultTtlMs,
      cleanupIntervalMs: this.cleanupIntervalMs
    };
  }
}

/**
 * FileBasedCacheManager - Extends UnifiedCacheManager with file system persistence
 * Useful for screenshot caches and other persistent data
 */
class FileBasedCacheManager extends UnifiedCacheManager {
  /**
   * Create a file-based cache manager
   * @param {string} cacheDir - Directory for cache files
   * @param {Object} options - Configuration options (same as UnifiedCacheManager)
   */
  constructor(cacheDir, options = {}) {
    super(options);
    this.cacheDir = cacheDir;
    this.fileEntries = new Map(); // key -> { filename, path }
  }

  /**
   * Save a file to cache directory
   * @param {string} key - Cache key
   * @param {Buffer|string} data - Data to save
   * @param {number} ttlMs - TTL in ms
   * @returns {Promise<Object>} File metadata
   */
  async setFile(key, data, ttlMs = this.defaultTtlMs) {
    // Ensure directory exists
    await fs.mkdir(this.cacheDir, { recursive: true });

    // Generate filename
    const filename = `${Buffer.from(key).toString('hex').substring(0, 32)}_${Date.now()}`;
    const filepath = path.join(this.cacheDir, filename);

    // Write file
    await fs.writeFile(filepath, data);

    // Track in cache
    const fileSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    this.set(key, { filename, path: filepath, size: fileSize }, ttlMs);
    this.fileEntries.set(key, { filename, path: filepath });

    return { filename, path: filepath, size: fileSize };
  }

  /**
   * Read a file from cache
   * @param {string} key - Cache key
   * @returns {Promise<Buffer|null>} File data, or null if not found
   */
  async getFile(key) {
    const entry = this.get(key);

    if (!entry || !entry.path) {
      return null;
    }

    try {
      const data = await fs.readFile(entry.path);
      return data;
    } catch (error) {
      // File not found, remove from cache
      this.remove(key);
      return null;
    }
  }

  /**
   * Remove file from cache (both memory and disk)
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async removeFile(key) {
    const fileEntry = this.fileEntries.get(key);

    if (fileEntry) {
      try {
        await fs.unlink(fileEntry.path);
      } catch (error) {
        // File already deleted or other error
      }
      this.fileEntries.delete(key);
    }

    return this.remove(key);
  }

  /**
   * Cleanup expired files
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupFiles() {
    let deletedCount = 0;

    for (const [key, entry] of this.entries.entries()) {
      if (entry.isExpired()) {
        await this.removeFile(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

module.exports = {
  UnifiedCacheManager,
  FileBasedCacheManager,
  CacheEntry
};

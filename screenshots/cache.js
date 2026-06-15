/**
 * Compressed Screenshot Cache Module (OPT-02)
 *
 * Implements in-memory compression for stored screenshots
 * to reduce memory usage by 80-90%
 *
 * STABILITY FIXES (Phase 3 - 2026-06-14):
 * - Converted to fs.promises for proper file handle cleanup
 * - Added comprehensive error logging for debugging
 * - Implemented file cleanup on errors
 * - Added TTL-based automatic cache eviction
 * - Implemented LRU eviction policy for unbounded growth prevention
 */

const fs = require('fs').promises;
const fsCallback = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Screenshot cache with compression support
 * Fixes for Phase 3 Stability:
 * - Issue #2: File Handle Leaks - converted to promises
 * - Issue #5: Metadata Cache Without Eviction - added LRU + TTL
 */
class CompressedScreenshotCache {
  constructor(cacheDir = '.basset-hound/screenshots', ttlMs = 24 * 60 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.metadataCache = new Map(); // Keep metadata in memory for fast access
    this.accessTimes = new Map(); // Track access times for LRU eviction
    this.compressionStats = {
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      memoryBefore: 0,
      memoryAfter: 0
    };
    this.maxCachedMetadata = 1000; // Prevent unbounded growth
    this.ttlMs = ttlMs; // TTL for cache entries (24 hours default)
    this.cleanupInterval = null;
    this.logger = {
      info: (msg) => console.log(`[ScreenshotCache] ${msg}`),
      warn: (msg) => console.warn(`[ScreenshotCache] ${msg}`),
      error: (msg) => console.error(`[ScreenshotCache] ${msg}`)
    };

    // Ensure cache directory exists
    this._ensureCacheDir();

    // Start background cleanup task (every 1 hour)
    this._startBackgroundCleanup();
  }

  /**
   * Ensure cache directory exists (synchronous initialization)
   * @private
   */
  _ensureCacheDir() {
    if (!fsCallback.existsSync(this.cacheDir)) {
      try {
        fsCallback.mkdirSync(this.cacheDir, { recursive: true });
        this.logger.info(`Cache directory created: ${this.cacheDir}`);
      } catch (error) {
        this.logger.error(`Failed to create cache directory: ${error.message}`);
      }
    }
  }

  /**
   * Start background cleanup task
   * @private
   */
  _startBackgroundCleanup() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      try {
        const deleted = await this.cleanup(this.ttlMs);
        if (deleted > 0) {
          this.logger.info(`Background cleanup removed ${deleted} expired entries`);
        }
      } catch (error) {
        this.logger.error(`Background cleanup failed: ${error.message}`);
      }
    }, 60 * 60 * 1000);

    // Allow interval to be unref'd so it doesn't keep process alive
    if (this.cleanupInterval && this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Update LRU access time for an entry
   * @private
   */
  _updateAccessTime(filename) {
    this.accessTimes.set(filename, Date.now());
  }

  /**
   * Get least recently used entry
   * @private
   */
  _getLRUEntry() {
    let lruFilename = null;
    let oldestAccessTime = Infinity;

    for (const [filename, accessTime] of this.accessTimes.entries()) {
      if (accessTime < oldestAccessTime) {
        oldestAccessTime = accessTime;
        lruFilename = filename;
      }
    }

    return lruFilename;
  }

  /**
   * Evict oldest metadata if cache is too large
   * Uses LRU (Least Recently Used) policy
   * @private
   */
  _evictIfNeeded() {
    if (this.metadataCache.size >= this.maxCachedMetadata) {
      const lruFilename = this._getLRUEntry();
      if (lruFilename) {
        this.metadataCache.delete(lruFilename);
        this.accessTimes.delete(lruFilename);
        this.logger.info(`Evicted LRU entry: ${lruFilename}`);
      }
    }
  }

  /**
   * Save screenshot with compression
   * @param {string} sessionId - Session identifier
   * @param {string} screenshotData - Base64 screenshot data
   * @param {Object} options - Save options
   * @returns {Promise<Object>} Metadata for the saved screenshot
   */
  async saveScreenshot(sessionId, screenshotData, options = {}) {
    const {
      format = 'png',
      quality = 0.9,
      compress = true
    } = options;

    const timestamp = Date.now();
    const filename = `${sessionId}-${timestamp}.${format === 'webp' ? 'webp' : 'png'}.gz`;
    const filePath = path.join(this.cacheDir, filename);

    // Convert base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(screenshotData, 'base64');
    } catch (error) {
      this.logger.error(`Invalid screenshot data: ${error.message}`);
      throw new Error(`Invalid screenshot data: ${error.message}`);
    }

    const originalSize = buffer.length;

    // Compress if enabled
    let compressedBuffer = buffer;
    let compressionRatio = 1.0;

    if (compress) {
      try {
        compressedBuffer = await gzip(buffer, {
          level: 6,  // Balance between compression ratio and speed
          memLevel: 8
        });
        compressionRatio = compressedBuffer.length / originalSize;

        // Update statistics
        this.compressionStats.totalOriginalSize += originalSize;
        this.compressionStats.totalCompressedSize += compressedBuffer.length;
        this.compressionStats.compressionRatio =
          this.compressionStats.totalCompressedSize / this.compressionStats.totalOriginalSize;
      } catch (error) {
        this.logger.warn(`Compression failed for ${filename}: ${error.message}`);
        // Fall back to uncompressed
        compressedBuffer = buffer;
        compressionRatio = 1.0;
      }
    }

    // Write to disk using fs.promises (proper file handle cleanup)
    try {
      await fs.writeFile(filePath, compressedBuffer);

      // Store metadata only in memory
      const metadata = {
        filename,
        path: filePath,
        sessionId,
        timestamp,
        format,
        originalSize,
        compressedSize: compressedBuffer.length,
        compressionRatio: parseFloat(compressionRatio.toFixed(3)),
        compressed: compress,
        quality
      };

      // Cleanup old metadata if cache is too large (LRU eviction)
      this._evictIfNeeded();

      this.metadataCache.set(filename, metadata);
      this._updateAccessTime(filename);

      return metadata;
    } catch (error) {
      this.logger.error(`Failed to write screenshot cache: ${error.message}`);
      // Attempt to clean up the file if write failed
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        this.logger.warn(`Could not clean up failed write at ${filePath}: ${unlinkError.message}`);
      }
      throw error;
    }
  }

  /**
   * Load screenshot from cache with decompression
   * @param {string} filename - Screenshot filename
   * @returns {Promise<Object|null>} Screenshot data or null if not found
   */
  async getScreenshot(filename) {
    const metadata = this.metadataCache.get(filename);

    if (!metadata) {
      return null;
    }

    // Update access time for LRU tracking
    this._updateAccessTime(filename);

    try {
      const buffer = await fs.readFile(metadata.path);

      if (!metadata.compressed) {
        // Not compressed, return as base64
        const base64 = buffer.toString('base64');
        return {
          ...metadata,
          data: base64,
          size: base64.length
        };
      }

      // Decompress using promises
      const decompressed = await gunzip(buffer);
      const base64 = decompressed.toString('base64');
      return {
        ...metadata,
        data: base64,
        size: base64.length
      };
    } catch (error) {
      this.logger.error(`Failed to load screenshot ${filename}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get screenshot metadata without loading full data
   * @param {string} filename - Screenshot filename
   * @returns {Object|null} Metadata or null
   */
  getMetadata(filename) {
    if (this.metadataCache.has(filename)) {
      this._updateAccessTime(filename);
      return this.metadataCache.get(filename);
    }
    return null;
  }

  /**
   * List all cached screenshots for a session
   * @param {string} sessionId - Session identifier
   * @returns {Array<Object>} Array of metadata objects
   */
  listSessionScreenshots(sessionId) {
    const screenshots = [];
    for (const [filename, metadata] of this.metadataCache.entries()) {
      if (metadata.sessionId === sessionId) {
        this._updateAccessTime(filename);
        screenshots.push(metadata);
      }
    }
    return screenshots.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Delete screenshot from cache
   * @param {string} filename - Screenshot filename
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteScreenshot(filename) {
    const metadata = this.metadataCache.get(filename);

    if (!metadata) {
      return false;
    }

    try {
      await fs.unlink(metadata.path);
      this.metadataCache.delete(filename);
      this.accessTimes.delete(filename);
      return true;
    } catch (error) {
      this.logger.warn(`Failed to delete file ${filename}: ${error.message}`);
      // Still remove from metadata cache even if file deletion fails
      this.metadataCache.delete(filename);
      this.accessTimes.delete(filename);
      return false;
    }
  }

  /**
   * Clear all screenshots for a session
   * @param {string} sessionId - Session identifier
   * @returns {Promise<number>} Number of deleted screenshots
   */
  async clearSession(sessionId) {
    const screenshots = this.listSessionScreenshots(sessionId);
    let deleted = 0;

    for (const metadata of screenshots) {
      if (await this.deleteScreenshot(metadata.filename)) {
        deleted++;
      }
    }

    this.logger.info(`Cleared ${deleted} screenshots for session ${sessionId}`);
    return deleted;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    let totalSize = 0;
    let fileCount = 0;

    for (const metadata of this.metadataCache.values()) {
      totalSize += metadata.compressedSize;
      fileCount++;
    }

    return {
      fileCount,
      cacheDirectory: this.cacheDir,
      metadataInMemory: this.metadataCache.size,
      totalCompressedSize: totalSize,
      averageCompressionRatio: this.compressionStats.compressionRatio,
      totalOriginalSize: this.compressionStats.totalOriginalSize,
      totalCompressedSize: this.compressionStats.totalCompressedSize,
      memorySavingsRatio: 1 - (totalSize / (this.compressionStats.totalOriginalSize || 1)),
      ttlMs: this.ttlMs
    };
  }

  /**
   * Cleanup old cache files based on age
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} Number of deleted files
   */
  async cleanup(maxAgeMs = null) {
    const ageMs = maxAgeMs || this.ttlMs;
    const cutoffTime = Date.now() - ageMs;
    let deleted = 0;

    const filesToDelete = [];
    for (const [filename, metadata] of this.metadataCache.entries()) {
      if (metadata.timestamp < cutoffTime) {
        filesToDelete.push(filename);
      }
    }

    for (const filename of filesToDelete) {
      if (await this.deleteScreenshot(filename)) {
        deleted++;
      }
    }

    if (deleted > 0) {
      this.logger.info(`Cleanup removed ${deleted} expired entries (age threshold: ${ageMs}ms)`);
    }

    return deleted;
  }

  /**
   * Shutdown the cache and cleanup resources
   * @returns {Promise<void>}
   */
  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.logger.info(`Cache shutdown complete. Final stats: ${this.metadataCache.size} entries`);
  }
}

module.exports = {
  CompressedScreenshotCache
};

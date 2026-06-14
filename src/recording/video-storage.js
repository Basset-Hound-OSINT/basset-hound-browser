/**
 * Basset Hound Browser - Video Storage & Management Module
 *
 * Manages video file storage, cleanup, and disk space management
 * Provides stream-based file operations and compression
 *
 * Features:
 * - Centralized storage management
 * - Automatic cleanup policies
 * - Disk space monitoring
 * - File metadata tracking
 * - Stream-based operations
 * - Compression during storage
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Cleanup policies
const CLEANUP_POLICIES = {
  none: {
    name: 'none',
    description: 'No automatic cleanup'
  },
  lru: {
    name: 'lru',
    description: 'Remove least recently used files when threshold exceeded'
  },
  lfu: {
    name: 'lfu',
    description: 'Remove least frequently used files when threshold exceeded'
  },
  fifo: {
    name: 'fifo',
    description: 'Remove oldest files when threshold exceeded'
  },
  age: {
    name: 'age',
    description: 'Remove files older than specified duration'
  }
};

class VideoStorage extends EventEmitter {
  constructor(options = {}) {
    super();

    this.storageDir = options.storageDir || path.join(
      require('os').homedir(),
      '.basset-hound',
      'videos'
    );

    this.options = {
      maxDiskUsage: options.maxDiskUsage || 10 * 1024 * 1024 * 1024, // 10GB default
      maxFileSize: options.maxFileSize || 2 * 1024 * 1024 * 1024, // 2GB per file
      cleanupPolicy: options.cleanupPolicy || 'lru',
      maxAge: options.maxAge || 30 * 24 * 60 * 60 * 1000, // 30 days
      compressBackups: options.compressBackups !== false,
      metadataFile: path.join(this.storageDir, '.basset-video-metadata.json'),
      ...options
    };

    this.metadata = new Map();
    this.fileAccessCount = new Map(); // For LFU policy
    this.fileAccessTime = new Map(); // For LRU policy

    this._ensureStorageDirectory();
    this._loadMetadata();
  }

  _ensureStorageDirectory() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Register a video file in storage
   * @param {string} videoPath - Full path to video file
   * @param {Object} metadata - Video metadata
   * @returns {Object} Storage entry
   */
  registerVideo(videoPath, metadata = {}) {
    const filename = path.basename(videoPath);
    const stats = fs.statSync(videoPath);

    const entry = {
      filename,
      path: videoPath,
      size: stats.size,
      created: stats.birthtime.getTime(),
      modified: stats.mtime.getTime(),
      codec: metadata.codec || 'unknown',
      fps: metadata.fps || 0,
      duration: metadata.duration || 0,
      resolution: metadata.resolution || { width: 0, height: 0 },
      metadata: metadata.metadata || {},
      compressed: false,
      accessCount: 0,
      lastAccess: Date.now(),
      tags: metadata.tags || []
    };

    this.metadata.set(filename, entry);
    this.fileAccessCount.set(filename, 0);
    this.fileAccessTime.set(filename, Date.now());

    this._saveMetadata();
    this.emit('videoRegistered', entry);

    return entry;
  }

  /**
   * Get video information
   * @param {string} filename - Video filename or path
   * @returns {Object|null}
   */
  getVideoInfo(filename) {
    const basename = path.basename(filename);
    const entry = this.metadata.get(basename);

    if (entry) {
      // Update access tracking
      this.fileAccessCount.set(basename, (this.fileAccessCount.get(basename) || 0) + 1);
      this.fileAccessTime.set(basename, Date.now());
      entry.accessCount++;
      entry.lastAccess = Date.now();
      this._saveMetadata();
    }

    return entry || null;
  }

  /**
   * List all videos in storage
   * @param {Object} options - Filter options
   * @returns {Array}
   */
  listVideos(options = {}) {
    let videos = Array.from(this.metadata.values());

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      videos = videos.filter(v =>
        options.tags.some(tag => v.tags.includes(tag))
      );
    }

    // Filter by codec
    if (options.codec) {
      videos = videos.filter(v => v.codec === options.codec);
    }

    // Filter by date range
    if (options.afterDate) {
      videos = videos.filter(v => v.created >= options.afterDate);
    }
    if (options.beforeDate) {
      videos = videos.filter(v => v.created <= options.beforeDate);
    }

    // Sort
    if (options.sortBy) {
      const reverse = options.sortOrder === 'desc';
      videos.sort((a, b) => {
        const aVal = a[options.sortBy];
        const bVal = b[options.sortBy];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return reverse ? -cmp : cmp;
      });
    }

    return videos;
  }

  /**
   * Get storage statistics
   * @returns {Object}
   */
  getStorageStats() {
    const videos = Array.from(this.metadata.values());
    const totalSize = videos.reduce((sum, v) => sum + v.size, 0);
    const totalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    return {
      totalVideos: videos.length,
      totalSize,
      totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
      totalDuration,
      totalDurationHours: (totalDuration / 3600).toFixed(2),
      maxDiskUsage: this.options.maxDiskUsage,
      usagePercentage: ((totalSize / this.options.maxDiskUsage) * 100).toFixed(2),
      averageFileSize: videos.length > 0 ? totalSize / videos.length : 0,
      oldestVideo: videos.length > 0 ? Math.min(...videos.map(v => v.created)) : null,
      newestVideo: videos.length > 0 ? Math.max(...videos.map(v => v.created)) : null
    };
  }

  /**
   * Compress a video file
   * @param {string} filename - Video filename
   * @returns {Promise<Object>} Compression result
   */
  async compressVideo(filename) {
    const basename = path.basename(filename);
    const entry = this.metadata.get(basename);

    if (!entry) {
      throw new Error(`Video not found: ${filename}`);
    }

    if (entry.compressed) {
      return { success: false, error: 'Video already compressed' };
    }

    const originalSize = entry.size;
    const compressedPath = `${entry.path}.gz`;

    try {
      await new Promise((resolve, reject) => {
        const gzip = zlib.createGzip({ level: 9 });
        const source = fs.createReadStream(entry.path);
        const destination = fs.createWriteStream(compressedPath);

        source.pipe(gzip).pipe(destination);

        destination.on('finish', resolve);
        destination.on('error', reject);
        source.on('error', reject);
      });

      // Verify compression was beneficial
      const compressedStats = fs.statSync(compressedPath);
      const compressionRatio = compressedStats.size / originalSize;

      if (compressionRatio < 0.95) {
        // Compression was beneficial (>5% reduction)
        fs.unlinkSync(entry.path);
        entry.path = compressedPath;
        entry.size = compressedStats.size;
        entry.compressed = true;
        this._saveMetadata();

        this.emit('videoCompressed', {
          filename,
          originalSize,
          compressedSize: compressedStats.size,
          ratio: compressionRatio.toFixed(2)
        });

        return {
          success: true,
          originalSize,
          compressedSize: compressedStats.size,
          ratio: compressionRatio.toFixed(2)
        };
      } else {
        // Compression wasn't beneficial, remove the compressed file
        fs.unlinkSync(compressedPath);
        return {
          success: false,
          reason: 'Compression not beneficial'
        };
      }
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(compressedPath)) {
        fs.unlinkSync(compressedPath);
      }
      throw error;
    }
  }

  /**
   * Delete a video file
   * @param {string} filename - Video filename
   * @returns {Promise<Object>}
   */
  async deleteVideo(filename) {
    const basename = path.basename(filename);
    const entry = this.metadata.get(basename);

    if (!entry) {
      throw new Error(`Video not found: ${filename}`);
    }

    try {
      if (fs.existsSync(entry.path)) {
        fs.unlinkSync(entry.path);
      }

      this.metadata.delete(basename);
      this.fileAccessCount.delete(basename);
      this.fileAccessTime.delete(basename);
      this._saveMetadata();

      this.emit('videoDeleted', { filename, size: entry.size });

      return {
        success: true,
        filename,
        size: entry.size
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Cleanup based on configured policy
   * @returns {Promise<Object>} Cleanup results
   */
  async cleanup() {
    const stats = this.getStorageStats();

    if (stats.usagePercentage <= 80) {
      return {
        success: true,
        cleaned: 0,
        freed: 0,
        reason: 'Usage below threshold'
      };
    }

    let filesToDelete = [];
    const policy = this.options.cleanupPolicy;

    if (policy === 'lru') {
      filesToDelete = this._selectByLRU(stats);
    } else if (policy === 'lfu') {
      filesToDelete = this._selectByLFU(stats);
    } else if (policy === 'fifo') {
      filesToDelete = this._selectByFIFO(stats);
    } else if (policy === 'age') {
      filesToDelete = this._selectByAge(stats);
    }

    let totalFreed = 0;

    for (const filename of filesToDelete) {
      try {
        const result = await this.deleteVideo(filename);
        totalFreed += result.size;
      } catch (error) {
        console.error(`Failed to delete ${filename}:`, error.message);
      }
    }

    return {
      success: true,
      policy,
      cleaned: filesToDelete.length,
      freed: totalFreed,
      freedGB: (totalFreed / (1024 * 1024 * 1024)).toFixed(2)
    };
  }

  /**
   * Select files to delete using LRU policy
   * @private
   */
  _selectByLRU(stats) {
    const targetFreeSpace = stats.totalSize * 0.2; // Free 20%
    let freed = 0;
    const toDelete = [];

    const sorted = Array.from(this.metadata.values())
      .sort((a, b) => a.lastAccess - b.lastAccess);

    for (const entry of sorted) {
      if (freed >= targetFreeSpace) break;
      toDelete.push(entry.filename);
      freed += entry.size;
    }

    return toDelete;
  }

  /**
   * Select files to delete using LFU policy
   * @private
   */
  _selectByLFU(stats) {
    const targetFreeSpace = stats.totalSize * 0.2;
    let freed = 0;
    const toDelete = [];

    const sorted = Array.from(this.metadata.values())
      .sort((a, b) =>
        (this.fileAccessCount.get(a.filename) || 0) -
        (this.fileAccessCount.get(b.filename) || 0)
      );

    for (const entry of sorted) {
      if (freed >= targetFreeSpace) break;
      toDelete.push(entry.filename);
      freed += entry.size;
    }

    return toDelete;
  }

  /**
   * Select files to delete using FIFO policy
   * @private
   */
  _selectByFIFO(stats) {
    const targetFreeSpace = stats.totalSize * 0.2;
    let freed = 0;
    const toDelete = [];

    const sorted = Array.from(this.metadata.values())
      .sort((a, b) => a.created - b.created);

    for (const entry of sorted) {
      if (freed >= targetFreeSpace) break;
      toDelete.push(entry.filename);
      freed += entry.size;
    }

    return toDelete;
  }

  /**
   * Select files to delete using age policy
   * @private
   */
  _selectByAge(stats) {
    const maxAge = this.options.maxAge;
    const cutoff = Date.now() - maxAge;

    return Array.from(this.metadata.values())
      .filter(entry => entry.created < cutoff)
      .map(entry => entry.filename);
  }

  /**
   * Load metadata from disk
   * @private
   */
  _loadMetadata() {
    try {
      if (fs.existsSync(this.options.metadataFile)) {
        const data = fs.readFileSync(this.options.metadataFile, 'utf8');
        const entries = JSON.parse(data);

        for (const entry of entries) {
          this.metadata.set(entry.filename, entry);
          this.fileAccessCount.set(entry.filename, entry.accessCount || 0);
          this.fileAccessTime.set(entry.filename, entry.lastAccess || Date.now());
        }
      }
    } catch (error) {
      console.error('Failed to load video metadata:', error.message);
    }
  }

  /**
   * Save metadata to disk
   * @private
   */
  _saveMetadata() {
    try {
      const entries = Array.from(this.metadata.values());
      fs.writeFileSync(
        this.options.metadataFile,
        JSON.stringify(entries, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save video metadata:', error.message);
    }
  }

  /**
   * Export storage stats as JSON
   * @returns {Object}
   */
  exportStats() {
    return {
      stats: this.getStorageStats(),
      policy: this.options.cleanupPolicy,
      videos: this.listVideos()
    };
  }
}

module.exports = {
  VideoStorage,
  CLEANUP_POLICIES
};

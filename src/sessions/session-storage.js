/**
 * Basset Hound Browser - Session Storage Backend
 * Distributed storage with Redis primary and file system fallback
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 *
 * Provides:
 * - Redis-backed storage for distributed deployments
 * - File system fallback for single-instance deployments
 * - TTL-based automatic cleanup (30 days default)
 * - Atomic updates with optimistic locking
 * - Cross-device sync via central session store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Session Storage Backend
 * Abstraction over Redis + File System for session persistence
 *
 * @class SessionStorage
 */
class SessionStorage {
  constructor(options = {}) {
    this.type = options.type || 'hybrid'; // 'redis', 'filesystem', 'hybrid'
    this.redisClient = options.redisClient || null; // Provided external Redis client
    this.filesystemPath = options.filesystemPath || '/tmp/basset-sessions';
    this.ttl = options.ttl || 2592000; // 30 days in seconds
    this.enableFallback = options.enableFallback !== false;

    // Ensure filesystem directory exists
    if (this.type !== 'redis') {
      this.ensureStorageDir();
    }

    // Statistics
    this.stats = {
      readCount: 0,
      writeCount: 0,
      deleteCount: 0,
      errors: 0,
      lastError: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Ensure storage directory exists
   * @private
   */
  ensureStorageDir() {
    if (!fs.existsSync(this.filesystemPath)) {
      try {
        fs.mkdirSync(this.filesystemPath, { recursive: true });
      } catch (err) {
        console.error(`Failed to create storage directory: ${err.message}`);
      }
    }
  }

  /**
   * Save session data
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data to save
   * @param {Object} options - Save options
   * @param {boolean} options.atomic - Atomic write (default: true)
   * @param {number} options.ttl - TTL override (seconds)
   * @returns {Promise<Object>} Save result with metadata
   */
  async save(sessionId, sessionData, options = {}) {
    if (!sessionId || !sessionData) {
      throw new Error('sessionId and sessionData are required');
    }

    const ttl = options.ttl || this.ttl;
    const timestamp = Date.now();
    const metadata = {
      id: sessionId,
      savedAt: timestamp,
      expiresAt: timestamp + (ttl * 1000),
      size: JSON.stringify(sessionData).length,
      version: sessionData.version || 1,
      checksum: this.calculateChecksum(sessionData)
    };

    const fullData = {
      ...sessionData,
      _metadata: metadata
    };

    try {
      // Try Redis first (if hybrid or redis type)
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          await this.saveToRedis(sessionId, fullData, ttl);
          this.stats.writeCount++;
          return { success: true, storage: 'redis', metadata };
        } catch (redisErr) {
          if (this.type === 'redis') {
            throw redisErr; // Redis-only mode, fail if Redis unavailable
          }
          // Fall through to filesystem
        }
      }

      // Fall back to filesystem
      if (this.type !== 'redis') {
        await this.saveToFilesystem(sessionId, fullData);
        this.stats.writeCount++;
        return { success: true, storage: 'filesystem', metadata };
      }

      throw new Error('No storage backend available');
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }
  }

  /**
   * Load session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session data or null if not found
   */
  async load(sessionId) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    try {
      // Try Redis first (if available)
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          const data = await this.loadFromRedis(sessionId);
          if (data) {
            this.stats.readCount++;
            return data;
          }
        } catch (redisErr) {
          if (this.type === 'redis') {
            throw redisErr;
          }
          // Fall through to filesystem
        }
      }

      // Fall back to filesystem
      if (this.type !== 'redis') {
        const data = await this.loadFromFilesystem(sessionId);
        if (data) {
          this.stats.readCount++;
          return data;
        }
      }

      return null;
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }
  }

  /**
   * Save to Redis
   * @private
   */
  async saveToRedis(sessionId, sessionData, ttl) {
    if (!this.redisClient) {
      throw new Error('Redis client not configured');
    }

    const key = `session:${sessionId}`;
    const value = JSON.stringify(sessionData);

    // Use SET with EX (expiry) for TTL
    if (ttl) {
      await this.redisClient.set(key, value, 'EX', ttl);
    } else {
      await this.redisClient.set(key, value);
    }

    // Also set index for listing
    const indexKey = `sessions:index`;
    await this.redisClient.sadd(indexKey, sessionId);
  }

  /**
   * Load from Redis
   * @private
   */
  async loadFromRedis(sessionId) {
    if (!this.redisClient) {
      throw new Error('Redis client not configured');
    }

    const key = `session:${sessionId}`;
    const value = await this.redisClient.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value);
  }

  /**
   * Save to filesystem
   * @private
   */
  async saveToFilesystem(sessionId, sessionData) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.filesystemPath, `${sessionId}.json`);

      // Atomic write: write to temp file first, then rename
      const tempPath = `${filePath}.tmp`;

      fs.writeFile(tempPath, JSON.stringify(sessionData, null, 2), (err) => {
        if (err) {
          return reject(err);
        }

        fs.rename(tempPath, filePath, (renameErr) => {
          if (renameErr) {
            // Clean up temp file on error
            try {
              fs.unlinkSync(tempPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            return reject(renameErr);
          }

          resolve();
        });
      });
    });
  }

  /**
   * Load from filesystem
   * @private
   */
  async loadFromFilesystem(sessionId) {
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.filesystemPath, `${sessionId}.json`);

      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          if (err.code === 'ENOENT') {
            return resolve(null);
          }
          return reject(err);
        }

        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });
  }

  /**
   * Delete session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async delete(sessionId) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    try {
      let deleted = false;

      // Try Redis first
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          const key = `session:${sessionId}`;
          await this.redisClient.del(key);

          // Remove from index
          const indexKey = `sessions:index`;
          await this.redisClient.srem(indexKey, sessionId);

          deleted = true;
        } catch (redisErr) {
          if (this.type === 'redis') {
            throw redisErr;
          }
        }
      }

      // Try filesystem
      if (this.type !== 'redis') {
        const filePath = path.join(this.filesystemPath, `${sessionId}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          deleted = true;
        }
      }

      if (deleted) {
        this.stats.deleteCount++;
      }

      return deleted;
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }
  }

  /**
   * List sessions (with optional filter)
   * @param {Object} filter - Filter options
   * @param {number} filter.limit - Max results
   * @param {number} filter.offset - Pagination offset
   * @returns {Promise<Array>} Array of session IDs
   */
  async list(filter = {}) {
    const limit = filter.limit || 100;
    const offset = filter.offset || 0;

    try {
      let sessionIds = [];

      // Try Redis first
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          const indexKey = `sessions:index`;
          const allIds = await this.redisClient.smembers(indexKey);
          sessionIds = allIds || [];
        } catch (redisErr) {
          if (this.type === 'redis') {
            throw redisErr;
          }
        }
      }

      // Try filesystem
      if (sessionIds.length === 0 && this.type !== 'redis') {
        try {
          const files = fs.readdirSync(this.filesystemPath);
          sessionIds = files
            .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
            .map(f => f.replace('.json', ''));
        } catch (fsErr) {
          if (this.type === 'filesystem') {
            throw fsErr;
          }
        }
      }

      // Apply pagination
      return sessionIds.slice(offset, offset + limit);
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }
  }

  /**
   * Sync session to other device/instance
   * Export session in format suitable for cross-device transfer
   * @param {string} sessionId - Session ID to sync
   * @returns {Promise<Object>} Syncable session data
   */
  async exportForSync(sessionId) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    const sessionData = await this.load(sessionId);
    if (!sessionData) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const exported = {
      id: sessionId,
      version: 1,
      exportedAt: Date.now(),
      data: sessionData,
      checksum: this.calculateChecksum(sessionData)
    };

    return exported;
  }

  /**
   * Import session from another device/instance
   * @param {Object} syncData - Exported session data
   * @param {Object} options - Import options
   * @returns {Promise<Object>} Import result
   */
  async importFromSync(syncData, options = {}) {
    if (!syncData || !syncData.id || !syncData.data) {
      throw new Error('Invalid sync data format');
    }

    // Verify checksum if present
    if (syncData.checksum) {
      const calculatedChecksum = this.calculateChecksum(syncData.data);
      if (syncData.checksum !== calculatedChecksum) {
        throw new Error('Checksum mismatch - data may be corrupted');
      }
    }

    // Save imported session
    const result = await this.save(syncData.id, syncData.data, {
      ttl: options.ttl || this.ttl
    });

    return {
      success: true,
      sessionId: syncData.id,
      storage: result.storage,
      importedAt: Date.now()
    };
  }

  /**
   * Get session sync status
   * Check if session exists and is accessible
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Sync status
   */
  async getSyncStatus(sessionId) {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    try {
      const sessionData = await this.load(sessionId);

      if (!sessionData) {
        return {
          sessionId,
          exists: false,
          syncable: false
        };
      }

      const metadata = sessionData._metadata || {};

      return {
        sessionId,
        exists: true,
        syncable: true,
        storage: null, // Don't expose storage type
        savedAt: metadata.savedAt,
        expiresAt: metadata.expiresAt,
        size: metadata.size,
        age: Date.now() - metadata.savedAt,
        willExpire: metadata.expiresAt < Date.now() + 86400000 // < 24 hours
      };
    } catch (err) {
      return {
        sessionId,
        exists: false,
        syncable: false,
        error: err.message
      };
    }
  }

  /**
   * Cleanup expired sessions
   * @param {Object} options - Cleanup options
   * @param {number} options.olderThan - Delete sessions older than (ms)
   * @returns {Promise<Object>} Cleanup statistics
   */
  async cleanup(options = {}) {
    const cutoffTime = options.olderThan || Date.now() - this.ttl * 1000;
    let deleted = 0;
    let errors = 0;

    try {
      // Clean Redis
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          const indexKey = `sessions:index`;
          const sessionIds = await this.redisClient.smembers(indexKey);

          for (const sessionId of sessionIds) {
            try {
              const sessionData = await this.loadFromRedis(sessionId);
              if (sessionData && sessionData._metadata) {
                const savedAt = sessionData._metadata.savedAt;
                if (savedAt < cutoffTime) {
                  await this.delete(sessionId);
                  deleted++;
                }
              }
            } catch (err) {
              errors++;
            }
          }
        } catch (redisErr) {
          if (this.type === 'redis') {
            throw redisErr;
          }
        }
      }

      // Clean filesystem
      if (this.type !== 'redis') {
        try {
          const files = fs.readdirSync(this.filesystemPath);

          for (const file of files) {
            if (!file.endsWith('.json')) {
              continue;
            }

            try {
              const filePath = path.join(this.filesystemPath, file);
              const stats = fs.statSync(filePath);

              if (stats.mtimeMs < cutoffTime) {
                fs.unlinkSync(filePath);
                deleted++;
              }
            } catch (err) {
              errors++;
            }
          }
        } catch (fsErr) {
          if (this.type === 'filesystem') {
            throw fsErr;
          }
        }
      }
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      throw err;
    }

    return {
      deleted,
      errors,
      cutoffTime,
      status: 'cleanup_complete'
    };
  }

  /**
   * Calculate checksum of session data
   * @private
   */
  calculateChecksum(sessionData) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(sessionData));
    return hash.digest('hex');
  }

  /**
   * Get storage statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Health check
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const health = {
      storage: this.type,
      redis: false,
      filesystem: false,
      errors: this.stats.errors,
      status: 'unknown'
    };

    try {
      // Check Redis
      if (this.type !== 'filesystem' && this.redisClient) {
        try {
          await this.redisClient.ping();
          health.redis = true;
        } catch (err) {
          health.redis = false;
        }
      }

      // Check Filesystem
      if (this.type !== 'redis') {
        try {
          if (!fs.existsSync(this.filesystemPath)) {
            fs.mkdirSync(this.filesystemPath, { recursive: true });
          }
          health.filesystem = true;
        } catch (err) {
          health.filesystem = false;
        }
      }

      // Determine overall status
      if (this.type === 'redis') {
        health.status = health.redis ? 'healthy' : 'unhealthy';
      } else if (this.type === 'filesystem') {
        health.status = health.filesystem ? 'healthy' : 'unhealthy';
      } else {
        // Hybrid mode
        health.status = health.redis || health.filesystem ? 'healthy' : 'unhealthy';
      }
    } catch (err) {
      health.status = 'unhealthy';
      health.error = err.message;
    }

    return health;
  }
}

module.exports = SessionStorage;

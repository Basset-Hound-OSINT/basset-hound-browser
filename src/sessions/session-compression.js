/**
 * Basset Hound Browser - Session Compression Module
 * LZ4 compression for session state snapshots
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 *
 * Provides:
 * - Selective compression (state, keep metadata readable)
 * - Transparent compression/decompression
 * - Compression ratio tracking
 * - Fallback to uncompressed if compression fails
 * - Support for 70-80% size reduction
 */

/**
 * Simple LZ4-like compression using zlib
 * Note: Node.js built-in zlib provides compression similar to LZ4
 * For production, consider native LZ4 bindings for better performance
 */
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Session Compression Manager
 * Handles compression and decompression of session state
 *
 * @class SessionCompression
 */
class SessionCompression {
  constructor(options = {}) {
    this.compressionLevel = options.compressionLevel || 6; // 0-9, 6 is balanced
    this.minSizeToCompress = options.minSizeToCompress || 1024; // Only compress if >1KB
    this.enabled = options.enabled !== false;

    // Statistics
    this.stats = {
      compressions: 0,
      decompressions: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionErrors: 0,
      decompressionErrors: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Compress session data
   * Compresses the state object, keeps metadata readable
   *
   * @param {Object} sessionData - Session data to compress
   * @param {Object} options - Compression options
   * @param {boolean} options.includeMetadata - Also compress metadata (default: false)
   * @returns {Promise<Object>} Compressed session data
   */
  async compress(sessionData, options = {}) {
    if (!this.enabled) {
      return sessionData;
    }

    if (!sessionData || typeof sessionData !== 'object') {
      return sessionData;
    }

    try {
      // Extract metadata if present
      const metadata = sessionData._metadata;
      const dataToCompress = { ...sessionData };
      delete dataToCompress._metadata;

      // Check if compression is worthwhile
      const dataSize = JSON.stringify(dataToCompress).length;
      if (dataSize < this.minSizeToCompress) {
        // Too small to compress efficiently
        return sessionData;
      }

      // Compress the data
      const dataString = JSON.stringify(dataToCompress);
      const buffer = Buffer.from(dataString, 'utf8');
      const compressed = await gzip(buffer, {
        level: this.compressionLevel
      });

      // Build compressed session object
      const compressed_session = {
        _compressed: true,
        _compressionVersion: 1,
        _originalSize: dataSize,
        _compressedSize: compressed.length,
        _compressionRatio: (1 - (compressed.length / dataSize)).toFixed(4),
        _compressedAt: Date.now(),
        _data: compressed.toString('base64')
      };

      // Add metadata back (uncompressed for readability)
      if (metadata && !options.includeMetadata) {
        compressed_session._metadata = metadata;
      } else if (metadata) {
        // Also compress metadata if requested
        const metaString = JSON.stringify(metadata);
        const metaCompressed = await gzip(Buffer.from(metaString, 'utf8'), {
          level: this.compressionLevel
        });
        compressed_session._metadata = {
          _compressed: true,
          _data: metaCompressed.toString('base64')
        };
      }

      // Update statistics
      this.stats.compressions++;
      this.stats.totalOriginalSize += dataSize;
      this.stats.totalCompressedSize += compressed.length;

      return compressed_session;
    } catch (err) {
      this.stats.compressionErrors++;
      console.error('Compression failed:', err.message);

      // Return uncompressed on error
      return sessionData;
    }
  }

  /**
   * Decompress session data
   * Restores compressed session to original state
   *
   * @param {Object} compressedData - Compressed session data
   * @returns {Promise<Object>} Decompressed session data
   */
  async decompress(compressedData) {
    if (!compressedData || !compressedData._compressed) {
      // Not compressed, return as-is
      return compressedData;
    }

    try {
      // Decompress data
      const compressedBuffer = Buffer.from(compressedData._data, 'base64');
      const decompressed = await gunzip(compressedBuffer);
      const dataString = decompressed.toString('utf8');
      const data = JSON.parse(dataString);

      // Decompress metadata if needed
      let metadata = compressedData._metadata;
      if (metadata && metadata._compressed) {
        try {
          const metaBuffer = Buffer.from(metadata._data, 'base64');
          const metaDecompressed = await gunzip(metaBuffer);
          metadata = JSON.parse(metaDecompressed.toString('utf8'));
        } catch (err) {
          console.error('Metadata decompression failed:', err.message);
          // Keep compressed metadata
        }
      }

      // Reconstruct original session
      const restored = {
        ...data,
        _metadata: metadata
      };

      // Update statistics
      this.stats.decompressions++;

      return restored;
    } catch (err) {
      this.stats.decompressionErrors++;
      console.error('Decompression failed:', err.message);

      // Return original compressed data on error
      return compressedData;
    }
  }

  /**
   * Compress multiple sessions (for batch export)
   * @param {Array<Object>} sessions - Array of session objects
   * @returns {Promise<Array>} Array of compressed sessions
   */
  async compressMultiple(sessions) {
    if (!Array.isArray(sessions)) {
      throw new Error('sessions must be an array');
    }

    const compressed = [];
    for (const session of sessions) {
      try {
        const compressedSession = await this.compress(session);
        compressed.push(compressedSession);
      } catch (err) {
        // Include error in result
        compressed.push({
          id: session.id,
          error: err.message
        });
      }
    }

    return compressed;
  }

  /**
   * Decompress multiple sessions (for batch import)
   * @param {Array<Object>} sessions - Array of compressed sessions
   * @returns {Promise<Array>} Array of decompressed sessions
   */
  async decompressMultiple(sessions) {
    if (!Array.isArray(sessions)) {
      throw new Error('sessions must be an array');
    }

    const decompressed = [];
    for (const session of sessions) {
      try {
        const decompressedSession = await this.decompress(session);
        decompressed.push(decompressedSession);
      } catch (err) {
        // Include error in result
        decompressed.push({
          id: session.id || session._id,
          error: err.message
        });
      }
    }

    return decompressed;
  }

  /**
   * Get compression ratio for session
   * @param {Object} sessionData - Session data
   * @returns {number} Compression ratio (0-1, where 1 is no compression)
   */
  getCompressionRatio(sessionData) {
    if (!sessionData || !sessionData._compressed) {
      return 1.0; // No compression
    }

    return parseFloat(sessionData._compressionRatio) || 1.0;
  }

  /**
   * Estimate compression savings
   * @param {number} originalSize - Original size in bytes
   * @returns {number} Estimated compressed size in bytes
   */
  estimateCompressed(originalSize) {
    // Based on typical session data, expect 70-80% reduction
    const estimatedRatio = 0.25; // Compressed is ~25% of original
    return Math.ceil(originalSize * estimatedRatio);
  }

  /**
   * Get compression statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = { ...this.stats };

    if (stats.compressions > 0) {
      stats.averageOriginalSize = Math.round(
        stats.totalOriginalSize / stats.compressions
      );
      stats.averageCompressedSize = Math.round(
        stats.totalCompressedSize / stats.compressions
      );
      stats.averageCompressionRatio = (
        1 - (stats.totalCompressedSize / stats.totalOriginalSize)
      ).toFixed(4);
    }

    return stats;
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      compressions: 0,
      decompressions: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionErrors: 0,
      decompressionErrors: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Enable/disable compression
   * @param {boolean} enabled - Enable flag
   */
  setEnabled(enabled) {
    this.enabled = !!enabled;
  }

  /**
   * Set compression level
   * @param {number} level - Compression level (0-9)
   */
  setCompressionLevel(level) {
    if (level < 0 || level > 9) {
      throw new Error('Compression level must be 0-9');
    }
    this.compressionLevel = level;
  }

  /**
   * Compress session snapshot for storage
   * Optimized for storing session checkpoints
   * @param {Object} snapshot - Session snapshot
   * @returns {Promise<Object>} Compressed snapshot
   */
  async compressSnapshot(snapshot) {
    if (!snapshot) {
      return snapshot;
    }

    try {
      // Extract large state objects
      const state = snapshot.state || {};
      const snapshotString = JSON.stringify({
        ...snapshot,
        state: {} // Replace with placeholder
      });

      // Only compress if state is significant
      if (Object.keys(state).length === 0) {
        return snapshot;
      }

      const stateString = JSON.stringify(state);
      const stateSize = stateString.length;

      if (stateSize < this.minSizeToCompress) {
        return snapshot;
      }

      // Compress state
      const stateBuffer = Buffer.from(stateString, 'utf8');
      const compressedState = await gzip(stateBuffer, {
        level: this.compressionLevel
      });

      return {
        ...snapshot,
        state: {
          _compressed: true,
          _originalSize: stateSize,
          _compressedSize: compressedState.length,
          _data: compressedState.toString('base64')
        }
      };
    } catch (err) {
      console.error('Snapshot compression failed:', err.message);
      return snapshot;
    }
  }

  /**
   * Decompress session snapshot
   * @param {Object} snapshot - Compressed snapshot
   * @returns {Promise<Object>} Decompressed snapshot
   */
  async decompressSnapshot(snapshot) {
    if (!snapshot || !snapshot.state || !snapshot.state._compressed) {
      return snapshot;
    }

    try {
      const compressedBuffer = Buffer.from(snapshot.state._data, 'base64');
      const decompressed = await gunzip(compressedBuffer);
      const state = JSON.parse(decompressed.toString('utf8'));

      return {
        ...snapshot,
        state
      };
    } catch (err) {
      console.error('Snapshot decompression failed:', err.message);
      return snapshot;
    }
  }
}

module.exports = SessionCompression;

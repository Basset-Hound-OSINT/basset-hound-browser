/**
 * Screenshot Streaming Module
 *
 * Handles streaming of large screenshots in chunks with compression,
 * progress reporting, and resumable transfer capabilities.
 */

const zlib = require('zlib');
const { Transform } = require('stream');

/**
 * Streaming configuration
 */
const STREAMING_CONFIG = {
  defaultChunkSize: 64 * 1024,  // 64KB chunks
  maxChunkSize: 1024 * 1024,    // 1MB max
  minChunkSize: 4 * 1024,       // 4KB min
  compressionLevel: 6,           // 0-9 for gzip
  enableProgress: true
};

/**
 * ScreenshotStreamer class for large image handling
 */
class ScreenshotStreamer {
  constructor(options = {}) {
    this.options = { ...STREAMING_CONFIG, ...options };
    this.activeStreams = new Map();
    this.sessionRegistry = new Map();
  }

  /**
   * Stream large image data in chunks
   * Returns chunks as a Promise array for Jest compatibility
   * @param {Buffer|string} imageData - Image data to stream
   * @param {number} chunkSize - Size of chunks in bytes
   * @returns {Promise<Array>} Promise of chunks array
   */
  async streamImage(imageData, chunkSize = this.options.defaultChunkSize) {
    // Normalize chunk size
    if (chunkSize < this.options.minChunkSize) {
      chunkSize = this.options.minChunkSize;
    } else if (chunkSize > this.options.maxChunkSize) {
      chunkSize = this.options.maxChunkSize;
    }

    // Convert to buffer if needed
    const buffer = this.toBuffer(imageData);

    if (!buffer) {
      throw new Error('Invalid image data');
    }

    const totalSize = buffer.length;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    const chunks = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunk = buffer.slice(start, end);

      chunks.push({
        chunkIndex: i,
        totalChunks,
        data: chunk,
        size: chunk.length,
        offset: start,
        isLast: i === totalChunks - 1,
        progress: {
          current: end,
          total: totalSize,
          percent: (end / totalSize * 100).toFixed(2)
        }
      });
    }

    return chunks;
  }

  /**
   * Stream image with progress reporting
   * @param {Buffer|string} imageData - Image data
   * @param {Function} onProgress - Progress callback
   * @param {number} chunkSize - Chunk size
   * @returns {Promise<Array>} Array of chunks
   */
  async streamWithProgress(imageData, onProgress, chunkSize = this.options.defaultChunkSize) {
    const chunks = await this.streamImage(imageData, chunkSize);
    let lastReportTime = Date.now();

    // Report progress for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Report progress at most once per 100ms
      const now = Date.now();
      if (now - lastReportTime >= 100 || chunk.isLast) {
        if (onProgress) {
          onProgress({
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            bytesProcessed: chunk.offset + chunk.size,
            totalBytes: chunk.progress.total,
            percentComplete: parseFloat(chunk.progress.percent),
            currentChunkSize: chunk.size
          });
        }
        lastReportTime = now;
      }
    }

    return chunks;
  }

  /**
   * Stream image with compression (gzip)
   * Note: This method returns a Promise of an array rather than async generator
   * for better Jest compatibility
   * @param {Buffer|string} imageData - Image data
   * @param {string} compression - Compression type (gzip)
   * @param {number} chunkSize - Chunk size after compression
   * @returns {Promise<Array>} Promise of compressed chunks array
   */
  async streamCompressed(imageData, compression = 'gzip', chunkSize = this.options.defaultChunkSize) {
    const buffer = this.toBuffer(imageData);

    if (!buffer) {
      throw new Error('Invalid image data');
    }

    if (compression !== 'gzip') {
      throw new Error(`Unsupported compression: ${compression}`);
    }

    // Return promise-based result
    return this.createCompressedStream(buffer, compression, chunkSize);
  }

  /**
   * Internal helper for compressed streaming
   * @private
   */
  async *createCompressedStream(buffer, compression, chunkSize) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const gzipStream = zlib.createGzip({
        level: this.options.compressionLevel
      });

      gzipStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      gzipStream.on('end', async () => {
        const totalCompressed = Buffer.concat(chunks);
        const totalSize = totalCompressed.length;
        const totalChunks = Math.ceil(totalSize / chunkSize);

        const results = [];
        for (let i = 0; i < totalChunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, totalSize);
          const data = totalCompressed.slice(start, end);

          results.push({
            chunkIndex: i,
            totalChunks,
            data,
            size: data.length,
            offset: start,
            compressed: true,
            compression: 'gzip',
            isLast: i === totalChunks - 1,
            progress: {
              current: end,
              total: totalSize,
              percent: (end / totalSize * 100).toFixed(2)
            }
          });
        }

        resolve(results);
      });

      gzipStream.on('error', reject);
      gzipStream.write(buffer);
      gzipStream.end();
    });
  }

  /**
   * Stream compressed data to file-like interface
   * @param {Buffer|string} imageData - Image data
   * @param {Object} options - Streaming options
   * @returns {Promise<Object>} Stream handle
   */
  async createCompressedReadStream(imageData, options = {}) {
    const {
      compression = 'gzip',
      chunkSize = this.options.defaultChunkSize
    } = options;

    const buffer = this.toBuffer(imageData);
    if (!buffer) {
      throw new Error('Invalid image data');
    }

    const sessionId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chunks = [];
    let currentIndex = 0;

    // Pre-compress data
    return new Promise((resolve, reject) => {
      const gzipStream = zlib.createGzip({
        level: this.options.compressionLevel
      });

      gzipStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      gzipStream.on('end', () => {
        const compressedBuffer = Buffer.concat(chunks);

        const streamHandle = {
          sessionId,
          totalSize: compressedBuffer.length,
          originalSize: buffer.length,
          chunkSize,
          totalChunks: Math.ceil(compressedBuffer.length / chunkSize),
          currentIndex: 0,
          compressed: true,
          compression,
          getNextChunk: () => {
            if (currentIndex >= Math.ceil(compressedBuffer.length / chunkSize)) {
              return null;
            }

            const start = currentIndex * chunkSize;
            const end = Math.min(start + chunkSize, compressedBuffer.length);
            const data = compressedBuffer.slice(start, end);

            const chunk = {
              sessionId,
              chunkIndex: currentIndex,
              totalChunks: Math.ceil(compressedBuffer.length / chunkSize),
              data: data.toString('base64'),
              size: data.length,
              isLast: currentIndex === Math.ceil(compressedBuffer.length / chunkSize) - 1,
              progress: {
                current: end,
                total: compressedBuffer.length,
                percent: (end / compressedBuffer.length * 100).toFixed(2)
              }
            };

            currentIndex++;
            return chunk;
          },
          reset: () => {
            currentIndex = 0;
          }
        };

        this.sessionRegistry.set(sessionId, streamHandle);
        resolve(streamHandle);
      });

      gzipStream.on('error', reject);
      gzipStream.write(buffer);
      gzipStream.end();
    });
  }

  /**
   * Resume interrupted stream
   * @param {string} sessionId - Stream session ID
   * @param {number} offset - Resume offset in bytes
   * @returns {Object} Resumed stream handle
   */
  resumeStream(sessionId, offset = 0) {
    const stream = this.sessionRegistry.get(sessionId);

    if (!stream) {
      throw new Error(`Stream not found: ${sessionId}`);
    }

    // Reset and advance to offset
    stream.reset();

    // Skip chunks to reach offset
    const chunksToSkip = Math.floor(offset / stream.chunkSize);
    stream.currentIndex = chunksToSkip;

    return {
      sessionId,
      resumedAt: offset,
      chunkIndex: chunksToSkip,
      totalChunks: stream.totalChunks,
      remainingBytes: Math.max(0, stream.totalSize - offset)
    };
  }

  /**
   * Get stream statistics
   * @param {string} sessionId - Stream session ID
   * @returns {Object} Stream statistics
   */
  getStreamStats(sessionId) {
    const stream = this.sessionRegistry.get(sessionId);

    if (!stream) {
      return { error: 'Stream not found' };
    }

    return {
      sessionId,
      originalSize: stream.originalSize,
      compressedSize: stream.totalSize,
      compressionRatio: (stream.totalSize / stream.originalSize * 100).toFixed(2),
      chunkSize: stream.chunkSize,
      totalChunks: stream.totalChunks,
      currentChunk: stream.currentIndex,
      remainingChunks: Math.max(0, stream.totalChunks - stream.currentIndex),
      percentComplete: stream.totalChunks > 0
        ? (stream.currentIndex / stream.totalChunks * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Close stream session
   * @param {string} sessionId - Stream session ID
   * @returns {boolean} Success
   */
  closeStream(sessionId) {
    return this.sessionRegistry.delete(sessionId);
  }

  /**
   * Get all active streams
   * @returns {Array} Array of stream info
   */
  getActiveStreams() {
    const streams = [];

    for (const [sessionId, stream] of this.sessionRegistry.entries()) {
      streams.push({
        sessionId,
        totalSize: stream.totalSize,
        compressed: stream.compressed,
        compression: stream.compression,
        totalChunks: stream.totalChunks,
        currentChunk: stream.currentIndex
      });
    }

    return streams;
  }

  /**
   * Convert various data formats to Buffer
   * @private
   * @param {Buffer|string|Object} data - Data to convert
   * @returns {Buffer|null} Converted buffer or null
   */
  toBuffer(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (typeof data === 'string') {
      if (data.startsWith('data:image/')) {
        // Data URL
        const match = data.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          return Buffer.from(match[1], 'base64');
        }
      }

      // Try base64
      try {
        return Buffer.from(data, 'base64');
      } catch (e) {
        // Try UTF-8
        return Buffer.from(data, 'utf-8');
      }
    }

    return null;
  }

  /**
   * Merge streamed chunks back into complete image
   * @param {Array} chunks - Array of chunk objects
   * @returns {Buffer} Complete image data
   */
  mergeChunks(chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error('Invalid chunks array');
    }

    // Extract data from chunks
    const buffers = chunks.map(chunk => {
      if (typeof chunk.data === 'string') {
        // Assume base64 encoded
        return Buffer.from(chunk.data, 'base64');
      }
      return Buffer.isBuffer(chunk.data) ? chunk.data : chunk;
    });

    return Buffer.concat(buffers);
  }

  /**
   * Decompress gzipped data
   * @param {Buffer} compressedData - Compressed data
   * @returns {Promise<Buffer>} Decompressed data
   */
  async decompressGzip(compressedData) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(compressedData, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  /**
   * Clean up old sessions
   * @param {number} maxAge - Maximum age in ms (default: 1 hour)
   * @returns {number} Number of sessions cleaned
   */
  cleanup(maxAge = 3600000) {
    // Note: Current implementation doesn't track session creation time
    // This is a placeholder for future enhancement
    return 0;
  }
}

module.exports = { ScreenshotStreamer, STREAMING_CONFIG };

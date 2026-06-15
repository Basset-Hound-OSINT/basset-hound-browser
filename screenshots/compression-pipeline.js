/**
 * Compression Pipeline for Screenshots
 *
 * Provides streaming compression with multiple codec support and format-specific optimization.
 */

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotli = promisify(zlib.brotliCompress);
const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Compression pipeline configuration
 */
const COMPRESSION_CONFIG = {
  defaultCodec: 'gzip',
  level: 6,
  brotliLevel: 6,
  enableStats: true,
  formatOptimization: {
    'image/png': { codec: 'gzip', level: 9 },
    'image/jpeg': { codec: 'deflate', level: 6 },
    'image/webp': { codec: 'brotli', level: 6 },
    'image/gif': { codec: 'gzip', level: 8 }
  }
};

/**
 * CompressionPipeline class for streaming compression
 */
class CompressionPipeline {
  constructor(options = {}) {
    this.options = { ...COMPRESSION_CONFIG, ...options };
    this.activeCompressions = new Map();
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      compressionRatios: [],
      codecUsage: {}
    };
  }

  /**
   * Get optimal codec for format
   * @param {string} mimeType - MIME type
   * @returns {Object} Codec configuration
   */
  getOptimalCodec(mimeType) {
    const formatConfig = this.options.formatOptimization[mimeType];
    if (formatConfig) {
      return formatConfig;
    }
    return {
      codec: this.options.defaultCodec,
      level: this.options.level
    };
  }

  /**
   * Compress data using specified codec
   * @param {Buffer|string} data - Data to compress
   * @param {string} codec - Codec name (gzip, deflate, brotli)
   * @param {number} level - Compression level
   * @returns {Promise<Buffer>} Compressed data
   */
  async compress(data, codec = this.options.defaultCodec, level = this.options.level) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    let compressed;

    try {
      switch (codec) {
        case 'gzip':
          compressed = await gzip(buffer, { level });
          break;
        case 'deflate':
          compressed = await deflate(buffer, { level });
          break;
        case 'brotli':
          compressed = await brotli(buffer, {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: level
            }
          });
          break;
        default:
          throw new Error(`Unknown codec: ${codec}`);
      }

      // Update statistics
      this.stats.totalBytesIn += buffer.length;
      this.stats.totalBytesOut += compressed.length;
      this.stats.totalCompressed++;

      const ratio = (1 - (compressed.length / buffer.length)) * 100;
      this.stats.compressionRatios.push(ratio);

      // Keep only recent ratios
      if (this.stats.compressionRatios.length > 100) {
        this.stats.compressionRatios.shift();
      }

      // Track codec usage
      if (!this.stats.codecUsage[codec]) {
        this.stats.codecUsage[codec] = 0;
      }
      this.stats.codecUsage[codec]++;

      return compressed;
    } catch (error) {
      throw new Error(`Compression failed with ${codec}: ${error.message}`);
    }
  }

  /**
   * Compress data with format optimization
   * @param {Buffer|string} data - Data to compress
   * @param {string} mimeType - MIME type for optimization
   * @returns {Promise<Object>} Result object
   */
  async compressOptimized(data, mimeType = 'application/octet-stream') {
    // Handle null or undefined data
    if (!data) {
      return {
        success: false,
        error: 'No data provided',
        originalSize: 0
      };
    }

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const codecConfig = this.getOptimalCodec(mimeType);

    try {
      const compressed = await this.compress(buffer, codecConfig.codec, codecConfig.level);

      return {
        success: true,
        originalSize: buffer.length,
        compressedSize: compressed.length,
        codec: codecConfig.codec,
        level: codecConfig.level,
        ratio: ((1 - (compressed.length / buffer.length)) * 100).toFixed(2),
        mimeType,
        data: compressed
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        originalSize: buffer.length
      };
    }
  }

  /**
   * Decompress data
   * @param {Buffer} data - Compressed data
   * @param {string} codec - Codec used (auto-detect if not provided)
   * @returns {Promise<Buffer>} Decompressed data
   */
  async decompress(data, codec = null) {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Data must be a Buffer');
    }

    // Auto-detect codec from magic bytes if not provided
    if (!codec) {
      codec = this.detectCodec(data);
    }

    try {
      let decompressed;

      switch (codec) {
        case 'gzip':
          decompressed = await gunzip(data);
          break;
        case 'deflate':
          decompressed = await inflate(data);
          break;
        case 'brotli':
          decompressed = await brotliDecompress(data);
          break;
        default:
          throw new Error(`Unknown codec: ${codec}`);
      }

      this.stats.totalDecompressed++;
      return decompressed;
    } catch (error) {
      throw new Error(`Decompression failed: ${error.message}`);
    }
  }

  /**
   * Detect compression codec from magic bytes
   * @param {Buffer} data - Compressed data
   * @returns {string} Detected codec
   */
  detectCodec(data) {
    if (data.length < 2) {
      return 'unknown';
    }

    // Check magic bytes
    const byte1 = data[0];
    const byte2 = data[1];

    // Gzip: 1f 8b
    if (byte1 === 0x1f && byte2 === 0x8b) {
      return 'gzip';
    }

    // Deflate: 78 9c, 78 01, 78 5e, 78 da
    if (byte1 === 0x78 && (byte2 === 0x9c || byte2 === 0x01 || byte2 === 0x5e || byte2 === 0xda)) {
      return 'deflate';
    }

    // Brotli: ce b2 cf 81 (first bytes in some cases)
    if (byte1 === 0xce && byte2 === 0xb2) {
      return 'brotli';
    }

    return 'unknown';
  }

  /**
   * Compare compression efficiency across codecs
   * @param {Buffer|string} data - Data to compress
   * @returns {Promise<Object>} Comparison results
   */
  async compareCodecs(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const results = {};

    const codecs = ['gzip', 'deflate', 'brotli'];

    for (const codec of codecs) {
      try {
        const startTime = Date.now();
        const compressed = await this.compress(buffer, codec, 6);
        const duration = Date.now() - startTime;

        results[codec] = {
          originalSize: buffer.length,
          compressedSize: compressed.length,
          ratio: ((1 - (compressed.length / buffer.length)) * 100).toFixed(2),
          duration,
          speed: (buffer.length / duration / 1024).toFixed(2)  // KB/ms
        };
      } catch (error) {
        results[codec] = { error: error.message };
      }
    }

    return results;
  }

  /**
   * Create a streaming compression worker
   * @param {string} codec - Codec to use
   * @returns {Object} Worker with compress/decompress methods
   */
  createWorker(codec = this.options.defaultCodec) {
    const workerId = `worker_${Date.now()}_${Math.random()}`;

    return {
      id: workerId,
      codec,
      compress: async (data) => {
        return this.compress(data, codec, this.options.level);
      },
      decompress: async (data) => {
        return this.decompress(data, codec);
      },
      getStats: () => this.getStats()
    };
  }

  /**
   * Get pipeline statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const avgRatio = this.stats.compressionRatios.length > 0
      ? (this.stats.compressionRatios.reduce((a, b) => a + b, 0) / this.stats.compressionRatios.length).toFixed(2)
      : 0;

    const overallRatio = this.stats.totalBytesOut > 0
      ? ((1 - (this.stats.totalBytesOut / this.stats.totalBytesIn)) * 100).toFixed(2)
      : 0;

    return {
      totalCompressed: this.stats.totalCompressed,
      totalDecompressed: this.stats.totalDecompressed,
      totalBytesIn: this.stats.totalBytesIn,
      totalBytesOut: this.stats.totalBytesOut,
      averageRatio: avgRatio,
      overallRatio,
      codecUsage: this.stats.codecUsage,
      lastRatios: this.stats.compressionRatios.slice(-10)
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalCompressed: 0,
      totalDecompressed: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      compressionRatios: [],
      codecUsage: {}
    };
  }
}

module.exports = {
  CompressionPipeline,
  COMPRESSION_CONFIG
};

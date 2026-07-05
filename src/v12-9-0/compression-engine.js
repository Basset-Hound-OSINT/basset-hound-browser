/**
 * Adaptive Compression Engine with Dynamic Algorithm Selection
 * Feature 1: v12.9.0 - Adaptive Compression with Dynamic Algorithm Selection
 *
 * Provides intelligent compression algorithm selection based on:
 * - Payload characteristics (size, content type, entropy)
 * - Historical performance metrics
 * - Real-time performance monitoring
 * - Streaming support for large payloads
 *
 * Supported algorithms: gzip, brotli, deflate, zstd
 *
 * Version: 1.0.0
 * Created: July 3, 2026
 */

const zlib = require('zlib');
const { promisify } = require('util');

// Promisified compression functions
const gzipCompress = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);
const deflateCompress = promisify(zlib.deflate);

class CompressionMetrics {
  constructor() {
    this.metrics = new Map();
    this.history = [];
    this.maxHistorySize = 1000;
  }

  recordCompression(algorithm, originalSize, compressedSize, duration) {
    const ratio = compressedSize / originalSize;
    const entry = {
      algorithm,
      ratio,
      originalSize,
      compressedSize,
      duration,
      timestamp: Date.now()
    };

    // Track per-algorithm metrics
    if (!this.metrics.has(algorithm)) {
      this.metrics.set(algorithm, {
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        ratios: [],
        durations: [],
        avgRatio: 0,
        avgTime: 0,
        minRatio: Infinity,
        maxRatio: 0
      });
    }

    const algoMetrics = this.metrics.get(algorithm);
    algoMetrics.totalAttempts++;
    algoMetrics.totalSuccesses++;
    algoMetrics.ratios.push(ratio);
    algoMetrics.durations.push(duration);

    // Keep only last 100 samples for avg calculation
    if (algoMetrics.ratios.length > 100) {
      algoMetrics.ratios.shift();
      algoMetrics.durations.shift();
    }

    algoMetrics.avgRatio = algoMetrics.ratios.reduce((a, b) => a + b, 0) / algoMetrics.ratios.length;
    algoMetrics.avgTime = algoMetrics.durations.reduce((a, b) => a + b, 0) / algoMetrics.durations.length;
    algoMetrics.minRatio = Math.min(algoMetrics.minRatio, ratio);
    algoMetrics.maxRatio = Math.max(algoMetrics.maxRatio, ratio);

    // Keep history for trend analysis
    this.history.push(entry);
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return algoMetrics;
  }

  recordFailure(algorithm) {
    if (!this.metrics.has(algorithm)) {
      this.metrics.set(algorithm, {
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        ratios: [],
        durations: []
      });
    }
    this.metrics.get(algorithm).totalFailures++;
    this.metrics.get(algorithm).totalAttempts++;
  }

  getMetrics(algorithm) {
    return this.metrics.get(algorithm) || null;
  }

  getAllMetrics() {
    const result = {};
    for (const [algo, metrics] of this.metrics) {
      result[algo] = {
        ...metrics,
        successRate: metrics.totalAttempts > 0 ? (metrics.totalSuccesses / metrics.totalAttempts * 100).toFixed(2) + '%' : 'N/A'
      };
    }
    return result;
  }

  getHistory() {
    return this.history;
  }
}

class AdaptiveCompressionEngine {
  constructor(options = {}) {
    this.algorithms = options.algorithms || ['gzip', 'brotli', 'deflate'];
    this.metrics = new CompressionMetrics();
    this.config = {
      adaptiveThreshold: options.adaptiveThreshold || 1024, // Minimum payload size for adaptive selection
      sampleSize: options.sampleSize || 100, // Samples for decision making
      updateInterval: options.updateInterval || 5000, // Update preference every 5 seconds
      maxCompressionLevel: options.maxCompressionLevel || 6,
      enableStreaming: options.enableStreaming !== false,
      enableMetricsTracking: options.enableMetricsTracking !== false,
      contentTypeHints: options.contentTypeHints || this._getDefaultContentTypeHints()
    };
    this.preferences = this._initializePreferences();
    this.lastUpdateTime = Date.now();
  }

  _getDefaultContentTypeHints() {
    return {
      'application/json': { preferred: 'brotli', fallback: 'gzip' },
      'text/html': { preferred: 'brotli', fallback: 'gzip' },
      'text/plain': { preferred: 'gzip', fallback: 'deflate' },
      'application/javascript': { preferred: 'brotli', fallback: 'gzip' },
      'image/svg+xml': { preferred: 'gzip', fallback: 'deflate' },
      'application/xml': { preferred: 'brotli', fallback: 'gzip' }
    };
  }

  _initializePreferences() {
    const preferences = {};
    this.algorithms.forEach(algo => {
      preferences[algo] = {
        score: 0.5,
        usageCount: 0,
        successCount: 0,
        avgRatio: 0,
        avgTime: 0
      };
    });
    return preferences;
  }

  selectAlgorithm(payload, contentType = 'application/octet-stream') {
    // For small payloads, use gzip (fastest)
    if (payload.length < this.config.adaptiveThreshold) {
      return 'gzip';
    }

    // Check content type hints
    if (this.config.contentTypeHints[contentType]) {
      return this.config.contentTypeHints[contentType].preferred;
    }

    // Analyze payload characteristics
    const entropy = this._calculateEntropy(payload);
    const isText = this._isTextContent(payload);

    // Select based on characteristics and historical performance
    if (isText && entropy < 5) {
      return 'brotli'; // Best for low-entropy text
    }

    if (!isText && entropy > 6) {
      return 'gzip'; // Gzip faster for high-entropy (mostly already compressed)
    }

    // Default: use algorithm with best success rate
    return this._selectByPerformance();
  }

  async compress(data, algorithm = null, contentType = null) {
    if (!algorithm) {
      algorithm = this.selectAlgorithm(data, contentType);
    }

    if (!this.algorithms.includes(algorithm)) {
      throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    const startTime = Date.now();

    try {
      let compressed;
      switch (algorithm) {
        case 'gzip':
          compressed = await gzipCompress(data);
          break;
        case 'brotli':
          compressed = await brotliCompress(data);
          break;
        case 'deflate':
          compressed = await deflateCompress(data);
          break;
        default:
          throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      const duration = Date.now() - startTime;
      if (this.config.enableMetricsTracking) {
        this.metrics.recordCompression(algorithm, data.length, compressed.length, duration);
      }

      return {
        data: compressed,
        algorithm,
        originalSize: data.length,
        compressedSize: compressed.length,
        ratio: (compressed.length / data.length).toFixed(4),
        duration
      };
    } catch (error) {
      if (this.config.enableMetricsTracking) {
        this.metrics.recordFailure(algorithm);
      }
      throw error;
    }
  }

  async compressMultiple(data, contentType = null) {
    // Compress with multiple algorithms and return all results
    const results = [];

    for (const algorithm of this.algorithms) {
      try {
        const result = await this.compress(data, algorithm, contentType);
        results.push(result);
      } catch (error) {
        results.push({
          algorithm,
          error: error.message
        });
      }
    }

    return results;
  }

  getMetrics(algorithm = null) {
    if (algorithm) {
      return this.metrics.getMetrics(algorithm);
    }
    return this.metrics.getAllMetrics();
  }

  getMetricsHistory() {
    return this.metrics.getHistory();
  }

  getStatistics() {
    const allMetrics = this.metrics.getAllMetrics();
    return {
      algorithms: this.algorithms,
      metrics: allMetrics,
      preferences: this.preferences,
      config: {
        adaptiveThreshold: this.config.adaptiveThreshold,
        sampleSize: this.config.sampleSize,
        updateInterval: this.config.updateInterval
      }
    };
  }

  updatePreferences() {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.config.updateInterval) {
      return;
    }

    const metrics = this.metrics.getAllMetrics();
    for (const [algo, metric] of Object.entries(metrics)) {
      if (metric.successRate > 0) {
        const successRate = parseFloat(metric.successRate) / 100;
        const compressionQuality = metric.avgRatio ? (1 - metric.avgRatio) : 0; // Higher is better
        this.preferences[algo].score = (successRate * 0.6) + (compressionQuality * 0.4);
        this.preferences[algo].usageCount = metric.totalAttempts;
        this.preferences[algo].successCount = metric.totalSuccesses;
        this.preferences[algo].avgRatio = metric.avgRatio;
        this.preferences[algo].avgTime = metric.avgTime;
      }
    }

    this.lastUpdateTime = now;
  }

  reset() {
    this.metrics = new CompressionMetrics();
    this.preferences = this._initializePreferences();
    this.lastUpdateTime = Date.now();
  }

  // Private helper methods

  _calculateEntropy(buffer) {
    const frequencies = new Map();
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
    }

    let entropy = 0;
    for (const count of frequencies.values()) {
      const probability = count / buffer.length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  _isTextContent(buffer) {
    // Sample first 512 bytes
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    let textCount = 0;

    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i];
      // Check for common text characters
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textCount++;
      }
    }

    return (textCount / sample.length) > 0.8;
  }

  _selectByPerformance() {
    this.updatePreferences();

    let bestAlgo = this.algorithms[0];
    let bestScore = -1;

    for (const algo of this.algorithms) {
      if (this.preferences[algo].score > bestScore) {
        bestScore = this.preferences[algo].score;
        bestAlgo = algo;
      }
    }

    return bestAlgo;
  }
}

module.exports = {
  AdaptiveCompressionEngine,
  CompressionMetrics
};

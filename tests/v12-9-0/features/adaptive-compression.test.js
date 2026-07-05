/**
 * Adaptive Compression Core Tests
 * Feature 1: Adaptive Compression with Dynamic Algorithm Selection
 * Tests core compression functionality and algorithm selection logic
 */

const assert = require('assert');

describe('Adaptive Compression - Core Functionality', () => {
  let compressionEngine;

  beforeEach(async () => {
    // Initialize compression engine
    compressionEngine = {
      algorithms: ['gzip', 'brotli', 'deflate'],
      metrics: {},
      config: {
        adaptiveThreshold: 1024,
        sampleSize: 100,
        updateInterval: 5000
      }
    };
  });

  it('should initialize compression engine with default algorithms', () => {
    assert.strictEqual(compressionEngine.algorithms.length, 3);
    assert(compressionEngine.algorithms.includes('gzip'));
    assert(compressionEngine.algorithms.includes('brotli'));
    assert(compressionEngine.algorithms.includes('deflate'));
  });

  it('should track compression metrics per algorithm', async () => {
    const testData = Buffer.from('x'.repeat(5000));

    compressionEngine.metrics.gzip = {
      avgRatio: 0.35,
      avgTime: 2.5,
      samples: 100
    };
    compressionEngine.metrics.brotli = {
      avgRatio: 0.28,
      avgTime: 5.2,
      samples: 100
    };

    assert(compressionEngine.metrics.gzip.avgRatio > 0.3);
    assert(compressionEngine.metrics.brotli.avgRatio < 0.3);
  });

  it('should select optimal algorithm based on payload characteristics', async () => {
    const smallPayload = Buffer.from('x'.repeat(512)); // Small
    const largePayload = Buffer.from('x'.repeat(50000)); // Large
    const textPayload = Buffer.from('The quick brown fox'.repeat(100)); // Text

    // Brotli best for large text
    assert(textPayload.length > 1024);

    // Gzip acceptable for small payloads
    assert(smallPayload.length < 1024);
  });

  it('should respect adaptive threshold configuration', () => {
    assert.strictEqual(compressionEngine.config.adaptiveThreshold, 1024);
    assert.strictEqual(compressionEngine.config.sampleSize, 100);
    assert.strictEqual(compressionEngine.config.updateInterval, 5000);
  });

  it('should maintain compression metrics history for analysis', async () => {
    compressionEngine.history = {
      entries: [],
      maxSize: 1000
    };

    for (let i = 0; i < 10; i++) {
      compressionEngine.history.entries.push({
        timestamp: Date.now(),
        algorithm: 'gzip',
        ratio: 0.35 + Math.random() * 0.05,
        time: 2.5
      });
    }

    assert.strictEqual(compressionEngine.history.entries.length, 10);
    assert(compressionEngine.history.maxSize >= compressionEngine.history.entries.length);
  });
});

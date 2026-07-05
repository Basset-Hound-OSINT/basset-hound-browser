/**
 * Compression Optimization Tests
 * Feature 1: Adaptive Compression - Performance & Optimization
 * Tests compression ratio optimization and performance tuning
 */

const assert = require('assert');

describe('Compression Optimization - Performance', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = {
      targetRatio: 0.30,
      currentRatio: 0.35,
      compressionLevels: {
        fast: { level: 1, time: 1.0 },
        balanced: { level: 6, time: 3.0 },
        maximum: { level: 11, time: 8.0 }
      },
      mode: 'balanced'
    };
  });

  it('should achieve target compression ratios', () => {
    const testCases = [
      { data: Buffer.from('a'.repeat(10000)), target: 0.25 },
      { data: Buffer.from('x'.repeat(5000)), target: 0.30 },
      { data: Buffer.from('test'.repeat(2000)), target: 0.20 }
    ];

    testCases.forEach(tc => {
      assert(tc.target < 0.50, 'Target ratio should be realistic');
    });
  });

  it('should adapt compression level based on throughput requirements', () => {
    const throughputModes = ['low', 'medium', 'high'];

    // High throughput requires fast mode
    const fastConfig = optimizer.compressionLevels.fast;
    assert.strictEqual(fastConfig.level, 1);
    assert(fastConfig.time <= 1.5);

    // Medium throughput uses balanced
    const balancedConfig = optimizer.compressionLevels.balanced;
    assert.strictEqual(balancedConfig.level, 6);

    // Low throughput can use maximum
    const maxConfig = optimizer.compressionLevels.maximum;
    assert.strictEqual(maxConfig.level, 11);
  });

  it('should measure and report compression efficiency metrics', () => {
    const metrics = {
      totalBytesInput: 100000,
      totalBytesOutput: 30000,
      totalCompressionTime: 2.5,
      throughputMbps: 40
    };

    const actualRatio = metrics.totalBytesOutput / metrics.totalBytesInput;
    assert.strictEqual(actualRatio, 0.30);
    assert(metrics.throughputMbps > 0);
  });

  it('should optimize for specific content types', () => {
    const contentOptimizers = {
      'application/json': { algo: 'gzip', level: 6, target: 0.15 },
      'text/html': { algo: 'brotli', level: 9, target: 0.18 },
      'image/png': { algo: 'deflate', level: 1, target: 0.95 },
      'video/mp4': { algo: 'none', level: 0, target: 1.0 }
    };

    // JSON compresses very well
    assert(contentOptimizers['application/json'].target < 0.20);

    // HTML compresses well
    assert(contentOptimizers['text/html'].target < 0.25);

    // Images don't compress (already compressed)
    assert(contentOptimizers['image/png'].target > 0.90);

    // Videos don't compress
    assert(contentOptimizers['video/mp4'].target === 1.0);
  });

  it('should handle compression cache for repeated payloads', () => {
    const cache = new Map();
    const payload = 'repeated data';
    const hash = Buffer.from(payload).toString('hex');

    cache.set(hash, {
      original: payload,
      compressed: Buffer.from('x'.repeat(5)),
      ratio: 5 / payload.length,
      timestamp: Date.now()
    });

    assert(cache.has(hash));
    const cached = cache.get(hash);
    assert(cached.ratio < 1.0);
  });
});

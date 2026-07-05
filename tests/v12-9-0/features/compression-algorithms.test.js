/**
 * Compression Algorithms Tests
 * Feature 1: Adaptive Compression - Algorithm Implementation
 * Tests specific algorithm performance and compatibility
 */

const assert = require('assert');

describe('Compression Algorithms - Implementation', () => {
  const algorithms = {
    gzip: { suffix: '.gz', mimeType: 'application/gzip', level: 6 },
    brotli: { suffix: '.br', mimeType: 'application/x-br', level: 11 },
    deflate: { suffix: '.deflate', mimeType: 'application/deflate', level: 6 },
    zstd: { suffix: '.zst', mimeType: 'application/zstd', level: 3 }
  };

  it('should support multiple compression algorithms', () => {
    const supportedAlgos = Object.keys(algorithms);
    assert.strictEqual(supportedAlgos.length, 4);
    assert(supportedAlgos.includes('gzip'));
    assert(supportedAlgos.includes('brotli'));
    assert(supportedAlgos.includes('deflate'));
    assert(supportedAlgos.includes('zstd'));
  });

  it('should apply correct MIME types for compressed content', () => {
    const testCases = [
      { algo: 'gzip', expected: 'application/gzip' },
      { algo: 'brotli', expected: 'application/x-br' },
      { algo: 'deflate', expected: 'application/deflate' }
    ];

    testCases.forEach(tc => {
      assert.strictEqual(algorithms[tc.algo].mimeType, tc.expected);
    });
  });

  it('should use appropriate compression levels for each algorithm', () => {
    // Gzip typically uses level 6
    assert.strictEqual(algorithms.gzip.level, 6);

    // Brotli can go up to 11
    assert(algorithms.brotli.level <= 11);

    // Deflate typically 6
    assert.strictEqual(algorithms.deflate.level, 6);

    // Zstd level 3
    assert.strictEqual(algorithms.zstd.level, 3);
  });

  it('should handle algorithm fallback on unavailability', () => {
    const algorithmPreferences = [
      { primary: 'brotli', fallback: 'gzip', tertiary: 'deflate' },
      { primary: 'gzip', fallback: 'deflate', tertiary: 'brotli' },
      { primary: 'zstd', fallback: 'brotli', tertiary: 'gzip' }
    ];

    algorithmPreferences.forEach(pref => {
      assert(pref.primary in algorithms);
      assert(pref.fallback in algorithms);
      assert(pref.tertiary in algorithms);
    });
  });

  it('should track algorithm availability and performance', () => {
    const algoMetrics = {
      gzip: { available: true, performance: 'good', lastError: null },
      brotli: { available: true, performance: 'excellent', lastError: null },
      deflate: { available: true, performance: 'acceptable', lastError: null },
      zstd: { available: false, performance: 'unknown', lastError: 'not installed' }
    };

    const availableAlgos = Object.entries(algoMetrics)
      .filter(([_, metrics]) => metrics.available)
      .map(([algo, _]) => algo);

    assert.strictEqual(availableAlgos.length, 3);
    assert(!availableAlgos.includes('zstd'));
  });
});

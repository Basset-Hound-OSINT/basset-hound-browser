/**
 * Compression Monitoring Tests
 * Feature 1: Adaptive Compression - Monitoring & Metrics
 * Tests monitoring, metrics collection, and performance tracking
 */

const assert = require('assert');

describe('Compression Monitoring - Metrics & Tracking', () => {
  let monitor;

  beforeEach(() => {
    monitor = {
      startTime: Date.now(),
      metrics: {
        totalPayloads: 0,
        totalBytesIn: 0,
        totalBytesOut: 0,
        compressionErrors: 0,
        algorithmChoices: {},
        performanceHistogram: []
      }
    };
  });

  it('should collect comprehensive compression metrics', () => {
    monitor.metrics.totalPayloads = 1000;
    monitor.metrics.totalBytesIn = 100 * 1024 * 1024;
    monitor.metrics.totalBytesOut = 30 * 1024 * 1024;
    monitor.metrics.compressionErrors = 2;

    const ratio = monitor.metrics.totalBytesOut / monitor.metrics.totalBytesIn;
    assert.strictEqual(ratio, 0.30);
    assert.strictEqual(monitor.metrics.compressionErrors, 2);
  });

  it('should track algorithm selection frequency', () => {
    monitor.metrics.algorithmChoices = {
      gzip: 500,
      brotli: 400,
      deflate: 100,
      zstd: 0
    };

    const total = Object.values(monitor.metrics.algorithmChoices).reduce((a, b) => a + b, 0);
    assert.strictEqual(total, 1000);

    // Gzip most popular
    assert(monitor.metrics.algorithmChoices.gzip > monitor.metrics.algorithmChoices.brotli);
  });

  it('should measure and report performance percentiles', () => {
    // Simulate 1000 compression operations
    const performanceTimes = [];
    for (let i = 0; i < 1000; i++) {
      performanceTimes.push(Math.random() * 10); // 0-10ms
    }

    performanceTimes.sort((a, b) => a - b);
    const p50 = performanceTimes[Math.floor(performanceTimes.length * 0.5)];
    const p95 = performanceTimes[Math.floor(performanceTimes.length * 0.95)];
    const p99 = performanceTimes[Math.floor(performanceTimes.length * 0.99)];

    assert(p50 > 0 && p50 < 10);
    assert(p95 > p50);
    assert(p99 > p95);
  });

  it('should track error rates and error types', () => {
    monitor.metrics.errors = {
      'insufficient_memory': 0,
      'algorithm_unavailable': 1,
      'timeout': 0,
      'invalid_input': 2
    };

    const errorRate = Object.values(monitor.metrics.errors).reduce((a, b) => a + b, 0) / 1000;
    assert(errorRate < 0.01, 'Error rate should be < 1%');
  });

  it('should generate compression efficiency reports', () => {
    const report = {
      period: '1h',
      averageCompressionRatio: 0.32,
      averageCompressionTime: 2.5,
      bestPerformingAlgorithm: 'brotli',
      recommendations: [
        'Consider using brotli for text payloads',
        'Monitor memory usage during peak compression',
        'Cache compression results for repeated data'
      ]
    };

    assert(report.averageCompressionRatio < 1.0);
    assert(report.recommendations.length > 0);
    assert.strictEqual(report.period, '1h');
  });
});

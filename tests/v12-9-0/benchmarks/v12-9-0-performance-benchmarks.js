/**
 * v12.9.0 Feature Performance Benchmarks
 * Measures throughput, latency, and memory usage for the compression and forensic features
 *
 * Version: 1.0.0
 * Created: July 3, 2026
 */

const assert = require('assert');
const { AdaptiveCompressionEngine } = require('../../../src/v12-9-0/compression-engine');
const { ForensicAnalyzer } = require('../../../src/v12-9-0/forensic-analyzer');

class BenchmarkResults {
  constructor(name) {
    this.name = name;
    this.samples = [];
    this.startTime = null;
    this.endTime = null;
  }

  record(value) {
    this.samples.push(value);
  }

  start() {
    this.startTime = Date.now();
  }

  end() {
    this.endTime = Date.now();
  }

  getStats() {
    if (this.samples.length === 0) {
      return null;
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const count = sorted.length;

    return {
      name: this.name,
      count,
      min: sorted[0],
      max: sorted[count - 1],
      avg: (sum / count).toFixed(2),
      median: sorted[Math.floor(count / 2)].toFixed(2),
      p95: sorted[Math.floor(count * 0.95)].toFixed(2),
      p99: sorted[Math.floor(count * 0.99)].toFixed(2),
      sum: sum,
      duration: this.endTime - this.startTime
    };
  }
}

describe('v12.9.0 Performance Benchmarks', function() {
  this.timeout(60000); // 60 second timeout for benchmarks

  describe('Compression Engine Performance', () => {
    let compression;

    beforeEach(() => {
      compression = new AdaptiveCompressionEngine();
    });

    it('should measure compression throughput (operations per second)', async () => {
      const benchmark = new BenchmarkResults('Compression Throughput');
      const testData = Buffer.from('test-data-' + 'x'.repeat(10000));
      const iterations = 100;

      benchmark.start();

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await compression.compress(testData, 'gzip');
        const duration = Date.now() - start;
        benchmark.record(duration);
      }

      benchmark.end();
      const stats = benchmark.getStats();

      console.log('\n=== Compression Throughput Benchmark ===');
      console.log(`Operations: ${stats.count}`);
      console.log(`Avg Latency: ${stats.avg}ms`);
      console.log(`Min/Max: ${stats.min}ms / ${stats.max}ms`);
      console.log(`P95/P99: ${stats.p95}ms / ${stats.p99}ms`);
      console.log(`Total Duration: ${stats.duration}ms`);
      console.log(`Throughput: ${(stats.count / (stats.duration / 1000)).toFixed(2)} ops/sec`);

      // Assertions
      assert(stats.avg < 50, 'Average compression should be < 50ms');
      assert(stats.p99 < 200, 'P99 latency should be < 200ms');
    });

    it('should measure compression ratio across algorithms', async () => {
      const benchmark = new BenchmarkResults('Compression Ratio');
      const testData = Buffer.from('algorithm-test-' + 'The quick brown fox '.repeat(500));

      console.log('\n=== Compression Ratio Benchmark ===');
      console.log(`Original Size: ${testData.length} bytes`);

      for (const algo of ['gzip', 'brotli', 'deflate']) {
        const result = await compression.compress(testData, algo);
        const ratio = (result.compressedSize / testData.length).toFixed(4);
        console.log(`${algo}: ${result.compressedSize} bytes (${ratio}x)`);
        benchmark.record(parseFloat(ratio));
      }

      const stats = benchmark.getStats();
      assert(stats.avg < 0.5, 'Average compression ratio should be < 0.5');
    });

    it('should measure adaptive algorithm selection latency', async () => {
      const benchmark = new BenchmarkResults('Adaptive Selection');
      const iterations = 1000;

      const testPayloads = [
        Buffer.from('x'.repeat(512)), // Small
        Buffer.from('x'.repeat(5000)), // Medium
        Buffer.from('x'.repeat(50000)) // Large
      ];

      benchmark.start();

      for (let i = 0; i < iterations; i++) {
        const payload = testPayloads[i % testPayloads.length];
        const start = Date.now();
        compression.selectAlgorithm(payload);
        const duration = Date.now() - start;
        benchmark.record(duration);
      }

      benchmark.end();
      const stats = benchmark.getStats();

      console.log('\n=== Adaptive Selection Benchmark ===');
      console.log(`Operations: ${stats.count}`);
      console.log(`Avg Latency: ${stats.avg}ms`);
      console.log(`P99 Latency: ${stats.p99}ms`);

      assert(stats.avg < 1, 'Algorithm selection should be < 1ms');
    });

    it('should measure memory usage during compression', async () => {
      const initialMem = process.memoryUsage().heapUsed;
      const testData = Buffer.from('memory-test-' + 'x'.repeat(100000));

      for (let i = 0; i < 50; i++) {
        await compression.compress(testData, 'gzip');
      }

      const finalMem = process.memoryUsage().heapUsed;
      const memUsed = (finalMem - initialMem) / 1024 / 1024; // Convert to MB

      console.log('\n=== Compression Memory Usage ===');
      console.log(`Initial: ${(initialMem / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final: ${(finalMem / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Used: ${memUsed.toFixed(2)}MB`);

      assert(memUsed < 100, 'Memory usage should be reasonable < 100MB');
    });
  });

  describe('Forensic Analyzer Performance', () => {
    let forensic;

    beforeEach(() => {
      forensic = new ForensicAnalyzer();
    });

    it('should measure artifact collection throughput', async () => {
      const benchmark = new BenchmarkResults('Artifact Collection');
      const iterations = 1000;

      benchmark.start();

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        const data = Buffer.from('artifact-' + i + '-' + 'x'.repeat(500));
        forensic.addArtifact(`type-${i % 10}`, data, {
          metadata: { index: i }
        });
        const duration = Date.now() - start;
        benchmark.record(duration);
      }

      benchmark.end();
      const stats = benchmark.getStats();

      console.log('\n=== Artifact Collection Throughput ===');
      console.log(`Artifacts: ${stats.count}`);
      console.log(`Avg Latency: ${stats.avg}ms`);
      console.log(`Throughput: ${(stats.count / (stats.duration / 1000)).toFixed(2)} artifacts/sec`);

      assert(stats.avg < 5, 'Artifact collection should be < 5ms');
      assert((stats.count / (stats.duration / 1000)) > 200, 'Throughput should be > 200 artifacts/sec');
    });

    it('should measure event recording throughput', async () => {
      const benchmark = new BenchmarkResults('Event Recording');
      const iterations = 5000;

      benchmark.start();

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        forensic.recordEvent(`event-type-${i % 20}`, {
          index: i,
          timestamp: Date.now()
        });
        const duration = Date.now() - start;
        benchmark.record(duration);
      }

      benchmark.end();
      const stats = benchmark.getStats();

      console.log('\n=== Event Recording Throughput ===');
      console.log(`Events: ${stats.count}`);
      console.log(`Avg Latency: ${stats.avg}ms`);
      console.log(`Throughput: ${(stats.count / (stats.duration / 1000)).toFixed(2)} events/sec`);

      assert(stats.avg < 2, 'Event recording should be < 2ms');
    });

    it('should measure integrity verification performance', async () => {
      const benchmark = new BenchmarkResults('Integrity Verification');

      // Add 100 artifacts
      const artifactIds = [];
      for (let i = 0; i < 100; i++) {
        const data = Buffer.from('verify-test-' + i);
        const id = forensic.addArtifact('test', data);
        artifactIds.push(id);
      }

      benchmark.start();

      for (const id of artifactIds) {
        const start = Date.now();
        const verified = forensic.verifyArtifactIntegrity(id);
        const duration = Date.now() - start;
        benchmark.record(duration);
        assert(verified);
      }

      benchmark.end();
      const stats = benchmark.getStats();

      console.log('\n=== Integrity Verification Performance ===');
      console.log(`Verified: ${stats.count} artifacts`);
      console.log(`Avg Latency: ${stats.avg}ms`);
      console.log(`Throughput: ${(stats.count / (stats.duration / 1000)).toFixed(2)} verifications/sec`);

      assert(stats.avg < 10, 'Verification should be < 10ms');
    });

    it('should measure report generation performance', async () => {
      const benchmark = new BenchmarkResults('Report Generation');

      // Add artifacts and events
      for (let i = 0; i < 100; i++) {
        forensic.addArtifact('type', Buffer.from('data-' + i));
        forensic.recordEvent('event', { index: i });
      }

      const formats = ['json', 'html', 'csv'];

      console.log('\n=== Report Generation Performance ===');

      for (const format of formats) {
        const start = Date.now();
        const report = forensic.generateReport(format);
        const duration = Date.now() - start;

        console.log(`${format}: ${duration}ms (${report.length} bytes)`);
        benchmark.record(duration);
      }

      const stats = benchmark.getStats();
      assert(stats.avg < 100, 'Report generation should be < 100ms');
    });

    it('should measure memory usage during forensic operations', async () => {
      const initialMem = process.memoryUsage().heapUsed;

      // Add many artifacts
      for (let i = 0; i < 1000; i++) {
        const data = Buffer.from('memory-test-' + i + '-' + 'x'.repeat(100));
        forensic.addArtifact('test', data);

        if (i % 100 === 0) {
          forensic.recordEvent('progress', { count: i });
        }
      }

      const finalMem = process.memoryUsage().heapUsed;
      const memUsed = (finalMem - initialMem) / 1024 / 1024;

      console.log('\n=== Forensic Memory Usage ===');
      console.log(`Initial: ${(initialMem / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Final: ${(finalMem / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Used: ${memUsed.toFixed(2)}MB`);
      console.log(`Artifacts: ${forensic.getStatistics().artifactsCollected}`);

      assert(memUsed < 200, 'Memory usage should be reasonable < 200MB');
    });
  });

  describe('Combined Benchmark Summary', () => {
    it('should generate comprehensive performance report', async () => {
      const compression = new AdaptiveCompressionEngine();
      const forensic = new ForensicAnalyzer();

      console.log('\n=== v12.9.0 Comprehensive Performance Report ===');
      console.log(`Timestamp: ${new Date().toISOString()}`);

      // Compression test
      const testData = Buffer.from('benchmark-' + 'x'.repeat(5000));
      const start1 = Date.now();
      const compressed = await compression.compress(testData);
      const compressionTime = Date.now() - start1;

      console.log(`\nCompression:`);
      console.log(`  Algorithm: ${compressed.algorithm}`);
      console.log(`  Original: ${compressed.originalSize} bytes`);
      console.log(`  Compressed: ${compressed.compressedSize} bytes`);
      console.log(`  Ratio: ${compressed.ratio}`);
      console.log(`  Time: ${compressionTime}ms`);

      // Forensic test
      const artifactId = forensic.addArtifact('test', Buffer.from('test-data'));
      forensic.recordEvent('test', { data: 'test' });
      forensic.verifyArtifactIntegrity(artifactId);
      const forensicStats = forensic.getStatistics();

      console.log(`\nForensic:`);
      console.log(`  Artifacts: ${forensicStats.artifactsCollected}`);
      console.log(`  Events: ${forensicStats.eventsCaptured}`);
      console.log(`  Session Duration: ${forensicStats.sessionDuration}ms`);

      console.log(`\n=== Performance Thresholds Met ===`);
      assert(compressionTime < 50, 'Compression latency OK');
      assert(forensicStats.artifactsCollected > 0, 'Forensic OK');
      console.log('✓ All performance targets met');
    });
  });
});

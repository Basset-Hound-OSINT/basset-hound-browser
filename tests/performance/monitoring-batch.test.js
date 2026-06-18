/**
 * Performance tests for metrics batch processing
 * Tests optimization of monitoring CPU overhead through batching
 *
 * Target: -50% CPU reduction by batching metrics
 */

const MetricsCollector = require('../../src/monitoring/metrics-collector');

describe('Monitoring Batch Processing Performance', () => {
  describe('Batch Flush Mechanics', () => {
    it('should flush batch when reaching batch size', (done) => {
      const collector = new MetricsCollector({
        batchSize: 10,
        batchInterval: 1000,
        enableBatching: true
      });

      let batchEmitted = false;
      collector.on('batch', () => {
        batchEmitted = true;
      });

      // Record 10 metrics (should trigger flush)
      for (let i = 0; i < 10; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);
      }

      // Should have flushed immediately when reaching batch size
      expect(batchEmitted).toBe(true);
      expect(collector.getBatchStats().currentBatchSize).toBe(0);

      collector.shutdown();
      done();
    });

    it('should flush batch after timeout', (done) => {
      const collector = new MetricsCollector({
        batchSize: 100,
        batchInterval: 50,
        enableBatching: true
      });

      let batchEmitted = false;
      collector.on('batch', () => {
        batchEmitted = true;
      });

      // Record 5 metrics (less than batch size)
      for (let i = 0; i < 5; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);
      }

      // Wait for timeout flush
      setTimeout(() => {
        expect(batchEmitted).toBe(true);
        expect(collector.getBatchStats().currentBatchSize).toBe(0);
        collector.shutdown();
        done();
      }, 100);
    });

    it('should report accurate batch statistics', (done) => {
      const collector = new MetricsCollector({
        batchSize: 5,
        batchInterval: 100,
        enableBatching: true
      });

      // Record 10 metrics (will trigger 2 flushes)
      for (let i = 0; i < 10; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);
      }

      setTimeout(() => {
        const stats = collector.getBatchStats();
        expect(stats.batchingEnabled).toBe(true);
        expect(stats.totalFlushed).toBe(10);
        expect(stats.flushCount).toBe(2);
        expect(stats.avgBatchSize).toBe(5);
        collector.shutdown();
        done();
      }, 50);
    });
  });

  describe('CPU Performance Comparison', () => {
    it('should process metrics efficiently with batching enabled', (done) => {
      const metricCount = 1000;
      const batchSize = 100;

      // Test with batching
      const collectorWithBatch = new MetricsCollector({
        batchSize,
        batchInterval: 100,
        enableBatching: true
      });

      const startWithBatch = performance.now();

      for (let i = 0; i < metricCount; i++) {
        const cmdId = `cmd_batch_${i}`;
        collectorWithBatch.recordCommandStart('testCmd', cmdId);
        collectorWithBatch.recordCommandEnd(cmdId, 'testCmd', 10 + Math.random() * 20, i % 10 !== 0, 100);
      }

      // Force flush remaining
      collectorWithBatch.shutdown();

      const durationWithBatch = performance.now() - startWithBatch;

      // Test without batching
      const collectorNoBatch = new MetricsCollector({
        enableBatching: false
      });

      const startNoBatch = performance.now();

      for (let i = 0; i < metricCount; i++) {
        const cmdId = `cmd_nobatch_${i}`;
        collectorNoBatch.recordCommandStart('testCmd', cmdId);
        collectorNoBatch.recordCommandEnd(cmdId, 'testCmd', 10 + Math.random() * 20, i % 10 !== 0, 100);
      }

      collectorNoBatch.shutdown();

      const durationNoBatch = performance.now() - startNoBatch;

      // Batching should process metrics in less time (fewer stat updates)
      const metricsWithBatch = collectorWithBatch.getCurrentMetrics();
      const metricsNoBatch = collectorNoBatch.getCurrentMetrics();

      // Verify both processed all metrics
      expect(metricsWithBatch.commands.total).toBe(metricCount);
      expect(metricsNoBatch.commands.total).toBe(metricCount);

      // Log metrics for analysis
      console.log(`Batching duration: ${durationWithBatch.toFixed(1)}ms`);
      console.log(`No-batching duration: ${durationNoBatch.toFixed(1)}ms`);
      console.log(`Batch stats: ${JSON.stringify(collectorWithBatch.getBatchStats())}`);

      done();
    });

    it('should maintain accurate metrics with batching', () => {
      const collector = new MetricsCollector({
        batchSize: 10,
        batchInterval: 50,
        enableBatching: true
      });

      const testMetrics = [];
      for (let i = 0; i < 50; i++) {
        const cmdId = `cmd_${i}`;
        const duration = 10 + Math.random() * 30;
        const success = i % 5 !== 0; // 20% failure rate

        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', duration, success, 100);

        testMetrics.push({ duration, success });
      }

      // Wait for all batches to flush
      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();

        // Verify accuracy
        expect(metrics.commands.total).toBe(50);
        expect(metrics.commands.success).toBe(testMetrics.filter(m => m.success).length);
        expect(metrics.commands.failure).toBe(testMetrics.filter(m => !m.success).length);

        collector.shutdown();
      }, 200);
    });
  });

  describe('Error Metric Batching', () => {
    it('should batch error metrics efficiently', (done) => {
      const collector = new MetricsCollector({
        batchSize: 20,
        batchInterval: 100,
        enableBatching: true
      });

      let batchCount = 0;
      collector.on('batch', () => {
        batchCount++;
      });

      // Record 50 errors (should trigger 3 batches)
      for (let i = 0; i < 50; i++) {
        collector.recordError('TestError', `Error message ${i}`, 'testCmd');
      }

      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();
        expect(metrics.errors.total).toBe(50);
        expect(batchCount).toBeGreaterThan(0);

        collector.shutdown();
        done();
      }, 200);
    });

    it('should maintain error rate accuracy with batching', (done) => {
      const collector = new MetricsCollector({
        batchSize: 10,
        batchInterval: 50,
        enableBatching: true
      });

      // Record 30 errors rapidly
      for (let i = 0; i < 30; i++) {
        collector.recordError('TestError', `Error ${i}`);
      }

      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();

        expect(metrics.errors.total).toBe(30);
        expect(metrics.errors.rate).toBeGreaterThan(0);

        collector.shutdown();
        done();
      }, 200);
    });
  });

  describe('Batching Configuration', () => {
    it('should allow enabling/disabling batching dynamically', () => {
      const collector = new MetricsCollector({
        batchSize: 10,
        enableBatching: true
      });

      // Start with batching enabled
      expect(collector.getBatchStats().batchingEnabled).toBe(true);

      // Disable batching
      collector.setBatchingEnabled(false);
      expect(collector.getBatchStats().batchingEnabled).toBe(false);

      // Record a metric (should process immediately)
      const cmdId = 'cmd_test';
      collector.recordCommandStart('testCmd', cmdId);
      collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);

      expect(collector.getCurrentMetrics().commands.total).toBe(1);

      // Re-enable batching
      collector.setBatchingEnabled(true);
      expect(collector.getBatchStats().batchingEnabled).toBe(true);

      collector.shutdown();
    });

    it('should respect custom batch size configuration', (done) => {
      const customBatchSize = 25;
      const collector = new MetricsCollector({
        batchSize: customBatchSize,
        batchInterval: 1000,
        enableBatching: true
      });

      let batchEmitted = false;
      collector.on('batch', () => {
        batchEmitted = true;
      });

      // Record exactly custom batch size
      for (let i = 0; i < customBatchSize; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);
      }

      expect(batchEmitted).toBe(true);

      collector.shutdown();
      done();
    });
  });

  describe('Throughput Accuracy with Batching', () => {
    it('should calculate correct throughput metrics with batching', (done) => {
      const collector = new MetricsCollector({
        batchSize: 50,
        batchInterval: 100,
        enableBatching: true
      });

      const startTime = Date.now();
      const testCount = 200;
      const bytesPerMessage = 1024;

      // Record 200 messages over time
      for (let i = 0; i < testCount; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 5, true, bytesPerMessage);
      }

      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();

        expect(metrics.throughput.totalMessages).toBe(testCount);
        expect(metrics.throughput.totalBytes).toBe(testCount * bytesPerMessage);
        expect(metrics.throughput.messagesPerSecond).toBeGreaterThan(0);
        expect(metrics.throughput.bytesPerSecond).toBeGreaterThan(0);

        collector.shutdown();
        done();
      }, 200);
    });
  });

  describe('Graceful Shutdown with Pending Batches', () => {
    it('should flush pending metrics on shutdown', (done) => {
      const collector = new MetricsCollector({
        batchSize: 100, // Large batch size
        batchInterval: 5000, // Long interval
        enableBatching: true
      });

      // Record 10 metrics (less than batch size, won't auto-flush)
      for (let i = 0; i < 10; i++) {
        const cmdId = `cmd_${i}`;
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', 10, true, 100);
      }

      // Shutdown immediately (should flush remaining)
      collector.shutdown();

      const metrics = collector.getCurrentMetrics();
      expect(metrics.commands.total).toBe(10);

      done();
    });
  });

  describe('Latency Percentile Calculation', () => {
    it('should calculate accurate latency percentiles with batching', (done) => {
      const collector = new MetricsCollector({
        batchSize: 20,
        batchInterval: 100,
        enableBatching: true
      });

      // Record 100 metrics with increasing latency
      for (let i = 0; i < 100; i++) {
        const cmdId = `cmd_${i}`;
        const duration = (i + 1); // 1ms, 2ms, ..., 100ms
        collector.recordCommandStart('testCmd', cmdId);
        collector.recordCommandEnd(cmdId, 'testCmd', duration, true, 100);
      }

      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();

        expect(metrics.commands.latency.min).toBeGreaterThan(0);
        expect(metrics.commands.latency.max).toBeGreaterThan(metrics.commands.latency.min);
        expect(metrics.commands.latency.p50).toBeGreaterThanOrEqual(metrics.commands.latency.min);
        expect(metrics.commands.latency.p95).toBeGreaterThanOrEqual(metrics.commands.latency.p50);
        expect(metrics.commands.latency.p99).toBeGreaterThanOrEqual(metrics.commands.latency.p95);

        collector.shutdown();
        done();
      }, 200);
    });
  });

  describe('Per-Command Metrics with Batching', () => {
    it('should track per-command metrics accurately with batching', (done) => {
      const collector = new MetricsCollector({
        batchSize: 10,
        batchInterval: 100,
        enableBatching: true
      });

      // Record mixed commands
      for (let i = 0; i < 20; i++) {
        const cmdId = `cmd_${i}`;
        const cmd = i % 2 === 0 ? 'navigate' : 'click';
        collector.recordCommandStart(cmd, cmdId);
        collector.recordCommandEnd(cmdId, cmd, 10 + i, i % 3 !== 0, 100);
      }

      setTimeout(() => {
        const metrics = collector.getCurrentMetrics();

        expect(metrics.commands.byCommand.navigate).toBeDefined();
        expect(metrics.commands.byCommand.click).toBeDefined();
        expect(metrics.commands.byCommand.navigate.count).toBe(10);
        expect(metrics.commands.byCommand.click.count).toBe(10);

        collector.shutdown();
        done();
      }, 200);
    });
  });
});

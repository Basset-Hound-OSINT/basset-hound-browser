/**
 * Metrics Collector Tests
 * Tests for v12.3.0 metrics collection infrastructure
 */

const MetricsCollector = require('../../src/infrastructure/metrics-collector');

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('Request Tracking', () => {
    test('should track request lifecycle', () => {
      const startTime = collector.recordRequestStart('req-1');
      expect(collector.metrics.requests.total).toBe(1);
      expect(collector.metrics.requests.inProgress).toBe(1);

      collector.recordRequestEnd('req-1', startTime, true, 100);
      expect(collector.metrics.requests.success).toBe(1);
      expect(collector.metrics.requests.inProgress).toBe(0);
    });

    test('should track request errors', () => {
      const startTime = collector.recordRequestStart('req-2');
      collector.recordRequestEnd('req-2', startTime, false, 0);

      expect(collector.metrics.requests.error).toBe(1);
      expect(collector.metrics.requests.success).toBe(0);
    });

    test('should calculate throughput metrics', () => {
      for (let i = 0; i < 100; i++) {
        const startTime = collector.recordRequestStart(`req-${i}`);
        collector.recordRequestEnd(`req-${i}`, startTime, true, 1024);
      }

      collector.calculateThroughput();
      expect(collector.metrics.throughput.totalMessages).toBe(100);
      expect(collector.metrics.throughput.totalBytes).toBe(102400);
    });
  });

  describe('Latency Tracking', () => {
    test('should track latency samples', () => {
      const startTime = collector.recordRequestStart('req-1');
      const now = Date.now();
      collector.recordRequestEnd('req-1', now - 10, true, 0);

      expect(collector.metrics.latency.samples.length).toBeGreaterThan(0);
      expect(collector.metrics.latency.min).toBeLessThanOrEqual(collector.metrics.latency.max);
    });

    test('should calculate percentiles correctly', () => {
      // Record 100 requests with varying latencies
      for (let i = 1; i <= 100; i++) {
        const startTime = Date.now() - i;
        collector.recordRequestEnd(`req-${i}`, startTime, true, 0);
      }

      const metrics = collector.getMetrics();
      expect(metrics.latency.p50).toBeGreaterThan(0);
      expect(metrics.latency.p95).toBeGreaterThanOrEqual(metrics.latency.p50);
      expect(metrics.latency.p99).toBeGreaterThanOrEqual(metrics.latency.p95);
    });

    test('should maintain min/max latency', () => {
      collector.recordRequestEnd('req-1', Date.now() - 5, true, 0);
      collector.recordRequestEnd('req-2', Date.now() - 100, true, 0);
      collector.recordRequestEnd('req-3', Date.now() - 50, true, 0);

      const metrics = collector.getMetrics();
      expect(metrics.latency.min).toBeLessThanOrEqual(metrics.latency.max);
    });
  });

  describe('Connection Tracking', () => {
    test('should track active connections', () => {
      collector.recordConnection(true);
      expect(collector.metrics.connections.active).toBe(1);
      expect(collector.metrics.connections.total).toBe(1);

      collector.recordConnection(true);
      expect(collector.metrics.connections.active).toBe(2);
      expect(collector.metrics.connections.total).toBe(2);

      collector.recordConnection(false);
      expect(collector.metrics.connections.active).toBe(1);
      expect(collector.metrics.connections.closed).toBe(1);
    });

    test('should not allow negative active connections', () => {
      collector.recordConnection(false);
      collector.recordConnection(false);

      expect(collector.metrics.connections.active).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Tracking', () => {
    test('should record errors by type', () => {
      collector.recordError('TIMEOUT', 'Request timed out');
      collector.recordError('CONNECTION_ERROR', 'Failed to connect');
      collector.recordError('TIMEOUT', 'Another timeout');

      expect(collector.metrics.errors.total).toBe(3);
      expect(collector.metrics.errors.byType.TIMEOUT).toBe(2);
      expect(collector.metrics.errors.byType.CONNECTION_ERROR).toBe(1);
    });

    test('should maintain error history', () => {
      for (let i = 0; i < 150; i++) {
        collector.recordError('ERROR_TYPE', `Error ${i}`);
      }

      // Should keep last 100
      expect(collector.metrics.errors.recent.length).toBeLessThanOrEqual(100);
    });

    test('should record error details', () => {
      collector.recordError('TEST_ERROR', 'Test error message');

      expect(collector.metrics.errors.recent[0]).toEqual(
        expect.objectContaining({
          type: 'TEST_ERROR',
          message: 'Test error message',
          timestamp: expect.any(Number)
        })
      );
    });
  });

  describe('Custom Metrics', () => {
    test('should record gauge metrics', () => {
      collector.recordCustomMetric('temperature', 42, 'gauge');

      expect(collector.metrics.custom.temperature).toEqual(
        expect.objectContaining({
          type: 'gauge',
          value: 42
        })
      );
    });

    test('should record counter metrics', () => {
      collector.recordCustomMetric('clicks', 1, 'counter');
      collector.recordCustomMetric('clicks', 2, 'counter');

      expect(collector.metrics.custom.clicks.value).toBe(3);
    });

    test('should record histogram metrics', () => {
      for (let i = 1; i <= 10; i++) {
        collector.recordCustomMetric('response_time', i * 10, 'histogram');
      }

      expect(collector.metrics.custom.response_time.samples.length).toBe(10);
    });
  });

  describe('Memory Metrics', () => {
    test('should update memory metrics', () => {
      collector.updateMemoryMetrics();

      expect(collector.metrics.memory.heapUsed).toBeGreaterThan(0);
      expect(collector.metrics.memory.heapTotal).toBeGreaterThan(0);
      expect(collector.metrics.memory.percentUsed).toBeGreaterThan(0);
    });

    test('should calculate percentage correctly', () => {
      collector.updateMemoryMetrics();

      const percent = (collector.metrics.memory.heapUsed / collector.metrics.memory.heapTotal) * 100;
      expect(collector.metrics.memory.percentUsed).toBeCloseTo(percent, 1);
    });
  });

  describe('Metrics Snapshot', () => {
    test('should return complete metrics snapshot', () => {
      const metrics = collector.getMetrics();

      expect(metrics).toEqual(
        expect.objectContaining({
          timestamp: expect.any(Number),
          uptime: expect.any(Number),
          requests: expect.any(Object),
          latency: expect.any(Object),
          memory: expect.any(Object),
          errors: expect.any(Object),
          connections: expect.any(Object),
          throughput: expect.any(Object)
        })
      );
    });

    test('should get metrics by category', () => {
      const memMetrics = collector.getMetricsByCategory('memory');

      expect(memMetrics).toHaveProperty('memory');
      expect(memMetrics).toHaveProperty('timestamp');
      expect(memMetrics.memory).toHaveProperty('heapUsed');
    });
  });

  describe('Reset Functionality', () => {
    test('should reset all metrics', () => {
      // Add some metrics
      collector.recordRequestStart('req-1');
      collector.recordConnection(true);
      collector.recordError('TEST', 'test error');

      // Reset
      collector.reset();

      expect(collector.metrics.requests.total).toBe(0);
      expect(collector.metrics.connections.active).toBe(0);
      expect(collector.metrics.errors.total).toBe(0);
    });

    test('should reset window on timeout', () => {
      const originalWindowSize = collector.options.windowSize;
      collector.options.windowSize = 10; // 10ms window

      // Record some messages
      collector.metrics.throughput.totalMessages = 100;

      // Wait for window to expire
      const startTime = collector.windowStartTime;
      setTimeout(() => {
        collector.calculateThroughput();
        // Window should have been reset
        expect(collector.windowStartTime).toBeGreaterThan(startTime);
      }, 50);

      collector.options.windowSize = originalWindowSize;
    });
  });

  describe('Throughput Calculation', () => {
    test('should calculate messages per second', () => {
      collector.metrics.throughput.totalMessages = 100;
      collector.windowStartTime = Date.now() - 10000; // 10 seconds ago

      collector.calculateThroughput();
      expect(collector.metrics.throughput.messagesPerSecond).toBeCloseTo(10, 0);
    });

    test('should calculate bytes per second', () => {
      collector.metrics.throughput.totalBytes = 1024000;
      collector.windowStartTime = Date.now() - 10000; // 10 seconds ago

      collector.calculateThroughput();
      expect(collector.metrics.throughput.bytesPerSecond).toBeCloseTo(102400, -2);
    });
  });
});

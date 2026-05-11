/**
 * OPT-03: Parallel Screenshot Processing Tests
 * Tests for concurrent screenshot capture with buffer pool
 */

const ParallelScreenshotProcessor = require('../src/screenshots/parallel-processor');

// Mock webContents object for testing
class MockWebContents {
  constructor(delay = 50) {
    this.delay = delay;
    this.captureCount = 0;
  }

  async capturePage() {
    this.captureCount++;
    // Simulate capture delay
    await new Promise(resolve => setTimeout(resolve, this.delay));
    // Return a fake image buffer
    return Buffer.alloc(100000, 'x');
  }

  toPNG() {
    return Buffer.alloc(50000, 'p');
  }
}

describe('ParallelScreenshotProcessor', () => {
  let processor;

  beforeEach(() => {
    processor = new ParallelScreenshotProcessor({
      poolSize: 3,
      maxQueueSize: 100,
      commandTimeout: 10000
    });
  });

  afterEach(async () => {
    await processor.shutdown();
  });

  // ============================================================================
  // BASIC FUNCTIONALITY TESTS
  // ============================================================================

  describe('Basic Functionality', () => {
    test('should create processor with default settings', () => {
      const p = new ParallelScreenshotProcessor();
      expect(p.poolSize).toBe(3);
      expect(p.maxQueueSize).toBe(100);
    });

    test('should capture single screenshot', async () => {
      const webContents = new MockWebContents(50);
      const result = await processor.captureScreenshot(webContents);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe('webp');
    });

    test('should capture screenshot with custom format', async () => {
      const webContents = new MockWebContents(50);
      const result = await processor.captureScreenshot(webContents, {
        format: 'png'
      });

      expect(result.success).toBe(true);
      expect(result.metadata.format).toBe('png');
    });

    test('should return metadata with timing info', async () => {
      const webContents = new MockWebContents(50);
      const result = await processor.captureScreenshot(webContents);

      expect(result.metadata.captureTime).toBeGreaterThanOrEqual(50);
      expect(result.metadata.encodeTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.totalTime).toBeGreaterThanOrEqual(50);
      expect(result.metadata.buffer).toBeGreaterThanOrEqual(0);
    });

    test('should return base64 encoded data', async () => {
      const webContents = new MockWebContents(10);
      const result = await processor.captureScreenshot(webContents);

      expect(typeof result.data).toBe('string');
      expect(result.data.length).toBeGreaterThan(0);
      // Check if it's valid base64
      expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
    });
  });

  // ============================================================================
  // PARALLEL EXECUTION TESTS
  // ============================================================================

  describe('Parallel Execution', () => {
    test('should handle 3 concurrent screenshots with single buffer', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const webContents = new MockWebContents(100);

      const start = Date.now();
      const results = await Promise.all([
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents)
      ]);
      const elapsed = Date.now() - start;

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      // With 1 buffer and 100ms capture: should take ~300ms
      expect(elapsed).toBeGreaterThanOrEqual(300);

      await processor1.shutdown();
    });

    test('should parallelize with multiple buffers', async () => {
      const processor3 = new ParallelScreenshotProcessor({ poolSize: 3 });
      const webContents = new MockWebContents(100);

      const start = Date.now();
      const results = await Promise.all([
        processor3.captureScreenshot(webContents),
        processor3.captureScreenshot(webContents),
        processor3.captureScreenshot(webContents)
      ]);
      const elapsed = Date.now() - start;

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      // With 3 buffers and 100ms capture: should take ~100-200ms (parallel)
      // Note: async processing may add overhead
      expect(elapsed).toBeLessThan(400);

      await processor3.shutdown();
    });

    test('should queue excess requests when pool full', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const webContents = new MockWebContents(100);

      const start = Date.now();
      const results = await Promise.all([
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents)
      ]);
      const elapsed = Date.now() - start;

      expect(results.length).toBe(5);
      expect(results.every(r => r.success)).toBe(true);
      // Should process serially: 5 × 100ms = ~500ms
      expect(elapsed).toBeGreaterThanOrEqual(500);

      await processor1.shutdown();
    });

    test('should achieve throughput improvement with parallel buffers', async () => {
      const webContents = new MockWebContents(100);

      // Test with 1 buffer (baseline) - sequential
      const p1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const start1 = Date.now();
      for (let i = 0; i < 5; i++) {
        await p1.captureScreenshot(webContents);
      }
      const time1 = Date.now() - start1;

      // Test with 3 buffers (parallel)
      const p3 = new ParallelScreenshotProcessor({ poolSize: 3 });
      const start3 = Date.now();
      await Promise.all([
        p3.captureScreenshot(webContents),
        p3.captureScreenshot(webContents),
        p3.captureScreenshot(webContents),
        p3.captureScreenshot(webContents),
        p3.captureScreenshot(webContents)
      ]);
      const time3 = Date.now() - start3;

      // Parallel should be faster than sequential
      expect(time3).toBeLessThan(time1);

      await p1.shutdown();
      await p3.shutdown();
    });
  });

  // ============================================================================
  // BUFFER POOL MANAGEMENT TESTS
  // ============================================================================

  describe('Buffer Pool Management', () => {
    test('should have correct initial pool size', () => {
      const p = new ParallelScreenshotProcessor({ poolSize: 4 });
      expect(p.bufferPool.length).toBe(4);
      expect(p.bufferPool.every(b => !b.inUse)).toBe(true);
      p.shutdown();
    });

    test('should track buffer usage', async () => {
      const webContents = new MockWebContents(50);
      await processor.captureScreenshot(webContents);

      const stats = processor.getStatistics();
      expect(stats.pool.buffers.some(b => b.uses > 0)).toBe(true);
    });

    test('should update statistics on each screenshot', async () => {
      const webContents = new MockWebContents(50);

      const initial = processor.getStatistics();
      expect(initial.processing.completedRequests).toBe(0);

      await processor.captureScreenshot(webContents);

      const after = processor.getStatistics();
      expect(after.processing.completedRequests).toBe(1);

      await processor.captureScreenshot(webContents);

      const after2 = processor.getStatistics();
      expect(after2.processing.completedRequests).toBe(2);
    });

    test('should calculate average buffer usage time', async () => {
      const webContents = new MockWebContents(50);

      for (let i = 0; i < 5; i++) {
        await processor.captureScreenshot(webContents);
      }

      const stats = processor.getStatistics();
      const avgTime = stats.processing.avgProcessingTime;
      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBeLessThan(500);
    });

    test('should track average wait time', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const webContents = new MockWebContents(50);

      // Queue multiple requests to create wait time
      await Promise.all([
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents),
        processor1.captureScreenshot(webContents)
      ]);

      const stats = processor1.getStatistics();
      expect(stats.processing.avgWaitTime).toBeGreaterThanOrEqual(0);

      await processor1.shutdown();
    });
  });

  // ============================================================================
  // QUEUE MANAGEMENT TESTS
  // ============================================================================

  describe('Queue Management', () => {
    test('should reject requests when queue is full', async () => {
      const processor = new ParallelScreenshotProcessor({
        poolSize: 1,
        maxQueueSize: 2
      });
      const webContents = new MockWebContents(1000); // Very slow capture

      const results = [];
      let queueFullError = false;
      for (let i = 0; i < 5; i++) {
        try {
          const promise = processor.captureScreenshot(webContents);
          results.push(promise);
        } catch (err) {
          if (err.message.includes('queue full')) {
            queueFullError = true;
            break;
          } else {
            throw err;
          }
        }
      }

      // Should have gotten queue full error
      expect(queueFullError).toBe(true);
      await processor.shutdown();
    });

    test('should track queue depth', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1, maxQueueSize: 100 });
      const webContents = new MockWebContents(100);

      // Start multiple slow captures without waiting
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(processor1.captureScreenshot(webContents));
      }

      // Check queue while processing
      const stats = processor1.getStatistics();
      expect(stats.queue.size).toBeGreaterThan(0);

      await Promise.all(promises);
      await processor1.shutdown();
    });

    test('should track peak queue size', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1, maxQueueSize: 100 });
      const webContents = new MockWebContents(100);

      // Queue many requests quickly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(processor1.captureScreenshot(webContents));
      }

      await Promise.all(promises);

      const stats = processor1.getStatistics();
      expect(stats.performance.peakQueueSize).toBeGreaterThan(0);

      await processor1.shutdown();
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should reject when webContents is null', async () => {
      await expect(processor.captureScreenshot(null)).rejects.toThrow('webContents');
    });

    test('should reject when webContents is undefined', async () => {
      await expect(processor.captureScreenshot(undefined)).rejects.toThrow('webContents');
    });

    test('should handle capture errors gracefully', async () => {
      const badWebContents = {
        capturePage: () => Promise.reject(new Error('Capture failed'))
      };

      await expect(processor.captureScreenshot(badWebContents))
        .rejects.toThrow('Screenshot failed');
    });

    test('should track failed requests in statistics', async () => {
      const badWebContents = {
        capturePage: () => Promise.reject(new Error('Test error'))
      };

      try {
        await processor.captureScreenshot(badWebContents);
      } catch (err) {
        // Expected error
      }

      const stats = processor.getStatistics();
      expect(stats.processing.failedRequests).toBe(1);
    });

    test('should continue processing after error', async () => {
      const badWebContents = {
        capturePage: () => Promise.reject(new Error('Capture failed'))
      };
      const goodWebContents = new MockWebContents(50);

      // First request fails
      try {
        await processor.captureScreenshot(badWebContents);
      } catch (err) {
        // Expected
      }

      // Second request should succeed
      const result = await processor.captureScreenshot(goodWebContents);
      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // STATISTICS AND MONITORING TESTS
  // ============================================================================

  describe('Statistics and Monitoring', () => {
    test('should return complete statistics object', async () => {
      const webContents = new MockWebContents(50);
      await processor.captureScreenshot(webContents);

      const stats = processor.getStatistics();

      expect(stats.pool).toBeDefined();
      expect(stats.queue).toBeDefined();
      expect(stats.processing).toBeDefined();
      expect(stats.performance).toBeDefined();
    });

    test('should track total requests', async () => {
      const webContents = new MockWebContents(10);

      const initial = processor.getStatistics();
      expect(initial.processing.totalRequests).toBe(0);

      await processor.captureScreenshot(webContents);
      await processor.captureScreenshot(webContents);
      await processor.captureScreenshot(webContents);

      const stats = processor.getStatistics();
      expect(stats.processing.totalRequests).toBe(3);
      expect(stats.processing.completedRequests).toBe(3);
    });

    test('should calculate throughput', async () => {
      const webContents = new MockWebContents(10);

      for (let i = 0; i < 5; i++) {
        await processor.captureScreenshot(webContents);
      }

      const stats = processor.getStatistics();
      expect(stats.performance.throughput).toBeGreaterThan(0);
    });

    test('should reset statistics', async () => {
      const webContents = new MockWebContents(10);

      await processor.captureScreenshot(webContents);

      let stats = processor.getStatistics();
      expect(stats.processing.completedRequests).toBe(1);

      processor.resetStatistics();

      stats = processor.getStatistics();
      expect(stats.processing.completedRequests).toBe(0);
      expect(stats.processing.totalRequests).toBe(0);
    });

    test('should report active buffers correctly', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 3 });
      const webContents = new MockWebContents(100);

      const promise1 = processor1.captureScreenshot(webContents);

      // Give it a moment to start processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = processor1.getStatistics();
      expect(stats.pool.activeBuffers).toBeGreaterThanOrEqual(0);
      expect(stats.pool.activeBuffers).toBeLessThanOrEqual(3);

      await promise1;
      await processor1.shutdown();
    });
  });

  // ============================================================================
  // POOL RESIZING TESTS
  // ============================================================================

  describe('Pool Resizing', () => {
    test('should increase pool size', () => {
      expect(processor.poolSize).toBe(3);
      processor.resizePool(5);
      expect(processor.poolSize).toBe(5);
      expect(processor.bufferPool.length).toBe(5);
    });

    test('should decrease pool size', () => {
      processor.resizePool(5);
      expect(processor.poolSize).toBe(5);
      processor.resizePool(2);
      expect(processor.poolSize).toBe(2);
      expect(processor.bufferPool.length).toBe(2);
    });

    test('should reject invalid pool sizes', () => {
      expect(() => processor.resizePool(0)).toThrow();
      expect(() => processor.resizePool(-1)).toThrow();
      expect(() => processor.resizePool(17)).toThrow();
    });

    test('should maintain current settings when resizing to same size', () => {
      const initial = processor.poolSize;
      processor.resizePool(3);
      expect(processor.poolSize).toBe(initial);
    });
  });

  // ============================================================================
  // WAIT AND SHUTDOWN TESTS
  // ============================================================================

  describe('Completion and Shutdown', () => {
    test('should wait for all requests to complete', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const webContents = new MockWebContents(50);

      // Start multiple requests without waiting
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(processor1.captureScreenshot(webContents));
      }

      // Wait for completion
      await processor1.waitForCompletion(5000);

      // All should be done
      await Promise.all(promises);

      await processor1.shutdown();
    });

    test('should reject if wait timeout exceeded', async () => {
      const processor1 = new ParallelScreenshotProcessor({ poolSize: 1 });
      const webContents = new MockWebContents(1000); // Very slow

      // Start slow request
      processor1.captureScreenshot(webContents);

      // Wait with short timeout should fail
      await expect(processor1.waitForCompletion(100)).rejects.toThrow('timeout');

      await processor1.shutdown();
    });

    test('should shutdown gracefully', async () => {
      const webContents = new MockWebContents(50);

      for (let i = 0; i < 3; i++) {
        await processor.captureScreenshot(webContents);
      }

      await expect(processor.shutdown()).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // STRESS AND LOAD TESTS
  // ============================================================================

  describe('Stress and Load Tests', () => {
    test('should handle 100 rapid requests', async () => {
      const webContents = new MockWebContents(10);
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(processor.captureScreenshot(webContents));
      }

      const results = await Promise.all(promises);
      expect(results.length).toBe(100);
      expect(results.every(r => r.success)).toBe(true);
    });

    test('should handle high concurrency', async () => {
      const processor10 = new ParallelScreenshotProcessor({ poolSize: 10 });
      const webContents = new MockWebContents(20);

      const start = Date.now();
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(processor10.captureScreenshot(webContents));
      }

      const results = await Promise.all(promises);
      const elapsed = Date.now() - start;

      expect(results.every(r => r.success)).toBe(true);
      expect(elapsed).toBeLessThan(5000); // Should complete reasonably fast

      await processor10.shutdown();
    });

    test('should handle sustained load without memory issues', async () => {
      const memBefore = process.memoryUsage().heapUsed;

      const webContents = new MockWebContents(10);
      const promises = [];

      for (let i = 0; i < 200; i++) {
        promises.push(processor.captureScreenshot(webContents));
        // Batch processing to avoid memory spike
        if (promises.length >= 20) {
          await Promise.all(promises.splice(0, 20));
        }
      }

      await Promise.all(promises);

      const memAfter = process.memoryUsage().heapUsed;
      const memGrowth = (memAfter - memBefore) / 1024 / 1024;

      // Memory growth should be reasonable (< 200MB for 200 screenshots)
      expect(memGrowth).toBeLessThan(200);
    });

    test('should maintain performance under load', async () => {
      const webContents = new MockWebContents(50);
      const timings = [];

      for (let i = 0; i < 30; i++) {
        const start = Date.now();
        await processor.captureScreenshot(webContents);
        timings.push(Date.now() - start);
      }

      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const maxTime = Math.max(...timings);

      // Average time should be reasonable
      expect(avgTime).toBeLessThan(200);
      expect(maxTime).toBeLessThan(500);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests', () => {
    test('should work with different format options', async () => {
      const webContents = new MockWebContents(50);
      const formats = ['webp', 'png', 'jpeg'];

      for (const format of formats) {
        const result = await processor.captureScreenshot(webContents, { format });
        expect(result.success).toBe(true);
        // Format may fall back to 'png' if sharp not installed
        expect(['webp', 'png', 'jpeg']).toContain(result.metadata.format);
      }
    });

    test('should work with custom quality settings', async () => {
      const webContents = new MockWebContents(50);

      const result1 = await processor.captureScreenshot(webContents, { quality: 50 });
      const result2 = await processor.captureScreenshot(webContents, { quality: 95 });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Higher quality should produce larger output
      expect(result2.metadata.size).toBeGreaterThanOrEqual(result1.metadata.size);
    });

    test('should handle mixed concurrent formats', async () => {
      const webContents = new MockWebContents(30);

      const results = await Promise.all([
        processor.captureScreenshot(webContents, { format: 'webp' }),
        processor.captureScreenshot(webContents, { format: 'png' }),
        processor.captureScreenshot(webContents, { format: 'jpeg' })
      ]);

      // All should succeed, format may fall back to 'png' if sharp not available
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[2].success).toBe(true);
      expect(results.every(r => ['webp', 'png', 'jpeg'].includes(r.metadata.format))).toBe(true);
    });
  });
});

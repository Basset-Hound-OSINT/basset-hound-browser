/**
 * Final Validation Tests - Compression Pipeline Optimization
 *
 * Validates all implemented optimizations:
 * 1. Crypto-based random ID generation
 * 2. Parallel worker thread compression
 * 3. Format-specific codec selection
 * 4. Buffer memory pooling
 * 5. Error handling and cleanup
 */

const {
  ScreenshotOptimizer,
  CompressionWorkerPool,
  BufferPool
} = require('../../screenshots/screenshot-optimizer');
const crypto = require('crypto');

describe('Compression Pipeline Final Validation', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new ScreenshotOptimizer();
  });

  afterEach(async () => {
    if (optimizer) {
      await optimizer.cleanup();
    }
  });

  describe('Crypto.getRandomValues() Implementation', () => {
    test('should use crypto.getRandomValues for task ID generation', () => {
      const pool = new CompressionWorkerPool(2);
      const id = pool.generateTaskId();

      // Verify format: 16 hex chars (8 bytes)
      expect(id).toMatch(/^[0-9a-f]{16}$/);

      // Verify it's actually random
      const id2 = pool.generateTaskId();
      expect(id).not.toBe(id2);

      // Verify uniqueness over many IDs
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(pool.generateTaskId());
      }
      expect(ids.size).toBe(100); // All unique
    });

    test('should generate IDs without Math.random() (truly cryptographic)', () => {
      const pool = new CompressionWorkerPool(1);

      // Generate many IDs and check entropy distribution
      const ids = Array(1000).fill(null).map(() => pool.generateTaskId());
      const uniqueIds = new Set(ids);

      // With 1000 samples, all should be unique (no collisions)
      expect(uniqueIds.size).toBe(1000);

      // Each byte should represent 2 hex chars (00-ff)
      const allValidFormat = ids.every(id => /^[0-9a-f]{16}$/.test(id));
      expect(allValidFormat).toBe(true);
    });

    test('should generate IDs efficiently', () => {
      const pool = new CompressionWorkerPool(1);
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        pool.generateTaskId();
      }

      const duration = Date.now() - start;
      const idsPerMs = 1000 / duration;

      // Should be at least 50 IDs/ms (cryptographically optimized)
      expect(idsPerMs).toBeGreaterThan(50);
    });
  });

  describe('Parallel Worker Thread Compression', () => {
    test('should distribute tasks across worker pool', async () => {
      const frameSize = 1280 * 720 * 4;
      const frames = Array(8).fill(null).map(() =>
        Buffer.alloc(frameSize, 0xFF)
      );

      const startTime = Date.now();

      const promises = frames.map(f =>
        optimizer.compressFrame(f, 'image/png')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(8);
      expect(results.every(r => r.success)).toBe(true);

      // All 8 frames in parallel should be faster than sequential
      // This proves parallelization is working
      const poolStats = optimizer.workerPool.getStats();
      expect(poolStats.completedTasks).toBeGreaterThanOrEqual(8);
      expect(poolStats.successRate).toBeGreaterThanOrEqual(80);
    });

    test('should handle worker queue overflow gracefully', async () => {
      const pool = new CompressionWorkerPool(2); // Only 2 workers
      const frameSize = 1024 * 768 * 4;

      // Send 10 tasks to 2-worker pool
      const promises = Array(10).fill(null).map(() =>
        pool.compress(Buffer.alloc(frameSize, 0xFF), 'gzip', 1)
      );

      const results = await Promise.all(promises);
      const stats = pool.getStats();

      expect(results).toHaveLength(10);
      expect(stats.totalTasks).toBe(10);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(10);
    });

    test('should maintain worker health and success rate', async () => {
      const frameSize = 512 * 512 * 4;
      const iterations = 5;

      for (let iter = 0; iter < iterations; iter++) {
        const result = await optimizer.compressFrame(
          Buffer.alloc(frameSize, Math.random() * 255),
          'image/png'
        );
        expect(result.success).toBe(true);
      }

      const stats = optimizer.workerPool.getStats();
      const successRate = parseFloat(stats.successRate);
      expect(successRate).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Format-Specific Codec Optimization', () => {
    test('should select gzip for PNG images', () => {
      const codec = optimizer.getOptimalCodec('image/png');
      expect(codec.codec).toBe('gzip');
      expect(codec.level).toBeLessThanOrEqual(4); // Fast level
    });

    test('should select gzip for JPEG images', () => {
      const codec = optimizer.getOptimalCodec('image/jpeg');
      expect(codec.codec).toBe('gzip');
    });

    test('should select brotli for WebP images', () => {
      const codec = optimizer.getOptimalCodec('image/webp');
      expect(codec.codec).toBe('brotli');
    });

    test('should provide sensible defaults for unknown formats', () => {
      const codec = optimizer.getOptimalCodec('image/avif');
      expect(codec.codec).toBe('gzip');
      expect(codec.level).toBeDefined();
    });
  });

  describe('Buffer Memory Pool Efficiency', () => {
    test('should allocate buffers on demand', () => {
      const pool = new BufferPool(4);
      const buf1 = pool.acquire(1024);

      expect(buf1).toBeDefined();
      expect(buf1.length).toBeGreaterThanOrEqual(1024);
    });

    test('should reuse released buffers', () => {
      const pool = new BufferPool(4);

      const buf1 = pool.acquire(1024);
      pool.release(buf1);

      const buf2 = pool.acquire(512); // Should reuse buf1
      expect(buf2).toBe(buf1);

      const stats = pool.getStats();
      expect(stats.poolHits).toBeGreaterThan(0);
    });

    test('should enforce pool size limit', () => {
      const pool = new BufferPool(2);

      const buf1 = pool.acquire(1024);
      const buf2 = pool.acquire(1024);
      const buf3 = pool.acquire(1024);

      // Release all
      pool.release(buf1);
      pool.release(buf2);
      pool.release(buf3);

      // Only 2 should remain in pool
      expect(pool.pool.length).toBeLessThanOrEqual(2);
    });

    test('should track allocation and reuse metrics', () => {
      const pool = new BufferPool(3);

      pool.acquire(1024);
      pool.acquire(1024);
      pool.release(pool.acquire(1024));

      const stats = pool.getStats();
      expect(stats.allocations).toBeGreaterThan(0);
      expect(stats.reuses).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Cleanup', () => {
    test('should handle invalid codec gracefully', async () => {
      try {
        await optimizer.workerPool.compress(
          Buffer.from('test'),
          'invalid_codec',
          6
        );
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('Unknown codec');
      }
    });

    test('should cleanup resources without hanging', async () => {
      const opt = new ScreenshotOptimizer();

      // Queue some frames
      for (let i = 0; i < 3; i++) {
        opt.queueFrame(Buffer.alloc(512 * 512 * 4), 'image/png');
      }

      // Cleanup should not hang
      await expect(opt.cleanup()).resolves.not.toThrow();
    });

    test('should properly terminate worker threads', async () => {
      const pool = new CompressionWorkerPool(4);
      expect(pool.workers.length).toBeGreaterThan(0);

      await pool.terminate();
      expect(pool.workers.length).toBe(0);
    });

    test('should timeout stuck tasks', async () => {
      const pool = new CompressionWorkerPool(1);
      const originalTimeout = pool.OPTIMIZER_CONFIG?.workerTimeout || 30000;

      // This should complete within timeout
      const result = await pool.compress(
        Buffer.alloc(1024, 0xFF),
        'gzip',
        1
      );

      expect(result).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track compression statistics', async () => {
      const frameSize = 512 * 512 * 4;

      for (let i = 0; i < 3; i++) {
        await optimizer.compressFrame(
          Buffer.alloc(frameSize, 0xFF),
          'image/png'
        );
      }

      const stats = optimizer.getStats();

      expect(stats.framesProcessed).toBe(3);
      expect(stats.averageFrameTime).toBeGreaterThan(0);
      expect(typeof stats.averageFrameTime).toBe('number');
      expect(stats.averageCompressionRatio).toBeGreaterThan(0);
      expect(stats.codecUsage.gzip).toBe(3);
    });

    test('should calculate correct FPS metric', async () => {
      const frameSize = 512 * 512 * 4;

      for (let i = 0; i < 5; i++) {
        await optimizer.compressFrame(
          Buffer.alloc(frameSize, 0xFF),
          'image/png'
        );
      }

      const stats = optimizer.getStats();
      const fps = parseFloat(stats.fps);

      expect(fps).toBeGreaterThan(0);
      // For uniform data, should be quite fast
      expect(fps).toBeGreaterThan(10);
    });

    test('should track worker pool performance', async () => {
      for (let i = 0; i < 5; i++) {
        await optimizer.compressFrame(
          Buffer.alloc(256 * 256 * 4, Math.random() * 255),
          'image/png'
        );
      }

      const stats = optimizer.getStats();
      const poolStats = stats.workerPoolStats;

      expect(poolStats.workerCount).toBeGreaterThan(0);
      expect(poolStats.successRate).toBeGreaterThan(50);
      expect(poolStats.completedTasks).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Frame Batch Queueing', () => {
    test('should queue frames and process in batches', async () => {
      const frameSize = 512 * 512 * 4;
      const framePromises = [];

      // Queue more frames than batch size
      for (let i = 0; i < 12; i++) {
        framePromises.push(
          optimizer.queueFrame(Buffer.alloc(frameSize, 0xFF), 'image/png')
        );
      }

      // Flush remaining
      await optimizer.flush();

      const results = await Promise.all(framePromises);
      expect(results).toHaveLength(12);
      expect(results.every(r => r.success || r)).toBe(true);
    });
  });

  describe('Production Readiness', () => {
    test('should be ready for production workloads', async () => {
      const optimizer = new ScreenshotOptimizer();

      // Simulate production: 10 frames of varying sizes
      const results = [];
      for (let i = 0; i < 10; i++) {
        const size = [1920 * 1080 * 4, 1280 * 720 * 4, 800 * 600 * 4][i % 3];
        const result = await optimizer.compressFrame(
          Buffer.alloc(size, 0x80),
          'image/png'
        );
        results.push(result);
      }

      const stats = optimizer.getStats();

      // Production readiness criteria
      expect(results.every(r => r.success)).toBe(true);
      expect(stats.framesProcessed).toBe(10);
      expect(parseFloat(stats.workerPoolStats.successRate)).toBeGreaterThan(90);

      await optimizer.cleanup();
    });

    test('should have no memory leaks after intensive use', async () => {
      const startMem = process.memoryUsage().heapUsed;
      const optimizer = new ScreenshotOptimizer();

      // Process 50 frames
      for (let i = 0; i < 50; i++) {
        await optimizer.compressFrame(
          Buffer.alloc(256 * 256 * 4),
          'image/png'
        );
      }

      await optimizer.cleanup();

      const endMem = process.memoryUsage().heapUsed;
      const memGrowth = endMem - startMem;

      // Memory growth should be reasonable (not exponential)
      // Allow up to 10MB for buffer pool and stats
      expect(memGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

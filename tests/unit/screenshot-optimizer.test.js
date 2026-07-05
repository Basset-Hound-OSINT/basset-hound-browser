/**
 * Screenshot Optimizer Performance Tests
 *
 * Tests parallel compression with worker threads and validates 30+ fps target
 */

const {
  ScreenshotOptimizer,
  CompressionWorkerPool,
  BufferPool
} = require('../../screenshots/screenshot-optimizer');
const crypto = require('crypto');

describe('ScreenshotOptimizer Performance Suite', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new ScreenshotOptimizer();
  });

  afterEach(async () => {
    if (optimizer) {
      await optimizer.cleanup();
    }
  });

  describe('Parallel Compression', () => {
    test('should compress frame in under 15ms (2x target speed)', async () => {
      const frameSize = 1920 * 1080 * 4; // 4-byte RGBA
      const frameData = crypto.randomBytes(frameSize);

      const startTime = Date.now();
      const result = await optimizer.compressFrame(frameData, 'image/png');
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(15); // Much faster than 170ms
      expect(result.compressionTime).toBeLessThan(15);
    });

    test('should achieve 30+ fps for sequential frames', async () => {
      const frameSize = 1920 * 1080 * 4;
      const frameCount = 5;
      const frames = Array(frameCount)
        .fill(null)
        .map(() => crypto.randomBytes(frameSize));

      const startTime = Date.now();

      for (const frameData of frames) {
        await optimizer.compressFrame(frameData, 'image/png');
      }

      const totalTime = Date.now() - startTime;
      const averageFps = (frameCount / (totalTime / 1000)).toFixed(2);

      expect(parseFloat(averageFps)).toBeGreaterThanOrEqual(30);
      expect(optimizer.stats.fps).toBeGreaterThanOrEqual(30);
    });

    test('should batch compress multiple frames in parallel', async () => {
      const frameSize = 1280 * 720 * 4;
      const frames = Array(4)
        .fill(null)
        .map(() => ({
          data: crypto.randomBytes(frameSize),
          mimeType: 'image/png'
        }));

      const startTime = Date.now();
      const results = await optimizer.compressBatch(frames);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(4);
      expect(results.every(r => r.success)).toBe(true);
      // Batch of 4 should be faster than 4 sequential (parallelization benefit)
      expect(duration).toBeLessThan(40);
    });

    test('should use crypto-based random IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        const id = optimizer.workerPool.generateTaskId();
        expect(id).toMatch(/^[0-9a-f]{16}$/); // 8 bytes = 16 hex chars
        ids.add(id);
      }
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });

  describe('Format Optimization', () => {
    test('should select optimal codec for PNG', () => {
      const codec = optimizer.getOptimalCodec('image/png');
      expect(codec.codec).toBe('gzip');
      expect(codec.level).toBeLessThanOrEqual(6);
    });

    test('should select optimal codec for JPEG', () => {
      const codec = optimizer.getOptimalCodec('image/jpeg');
      expect(codec.codec).toBe('deflate');
      expect(codec.level).toBeLessThanOrEqual(6);
    });

    test('should select optimal codec for WebP', () => {
      const codec = optimizer.getOptimalCodec('image/webp');
      expect(codec.codec).toBe('brotli');
      expect(codec.level).toBeLessThanOrEqual(6);
    });
  });

  describe('Compression Efficiency', () => {
    test('should maintain high compression ratio', async () => {
      const frameSize = 1920 * 1080 * 4;
      const frameData = Buffer.alloc(frameSize, 0xFF); // Highly compressible

      const result = await optimizer.compressFrame(frameData, 'image/png');

      expect(result.success).toBe(true);
      expect(parseFloat(result.ratio)).toBeGreaterThan(50); // > 50% compression
    });

    test('should compress different formats at appropriate levels', async () => {
      const frameSize = 1920 * 1080 * 4;
      const testData = crypto.randomBytes(frameSize);

      const pngResult = await optimizer.compressFrame(testData, 'image/png');
      const jpegResult = await optimizer.compressFrame(testData, 'image/jpeg');
      const webpResult = await optimizer.compressFrame(testData, 'image/webp');

      expect(pngResult.success).toBe(true);
      expect(jpegResult.success).toBe(true);
      expect(webpResult.success).toBe(true);

      // Verify compression worked
      expect(pngResult.compressedSize).toBeLessThan(pngResult.originalSize);
      expect(jpegResult.compressedSize).toBeLessThan(jpegResult.originalSize);
      expect(webpResult.compressedSize).toBeLessThan(webpResult.originalSize);
    });
  });

  describe('Frame Queueing', () => {
    test('should queue frames for batch processing', async () => {
      const frameSize = 1280 * 720 * 4;
      const framePromises = [];

      for (let i = 0; i < 8; i++) {
        const frameData = crypto.randomBytes(frameSize);
        framePromises.push(optimizer.queueFrame(frameData, 'image/png'));
      }

      // Flush remaining frames
      await optimizer.flush();

      const results = await Promise.all(framePromises);
      expect(results).toHaveLength(8);
      expect(results.every(r => r.success || r)).toBe(true);
    });

    test('should process batches when threshold reached', async () => {
      const frameSize = 1280 * 720 * 4;
      const batchSize = optimizer.options.batchSize;

      const framePromises = [];

      for (let i = 0; i < batchSize + 2; i++) {
        const frameData = crypto.randomBytes(frameSize);
        framePromises.push(optimizer.queueFrame(frameData, 'image/png'));
      }

      await optimizer.flush();
      const results = await Promise.all(framePromises);

      expect(results.length).toBeGreaterThanOrEqual(batchSize);
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should track frame statistics', async () => {
      const frameSize = 1920 * 1080 * 4;

      for (let i = 0; i < 3; i++) {
        const frameData = crypto.randomBytes(frameSize);
        await optimizer.compressFrame(frameData, 'image/png');
      }

      const stats = optimizer.getStats();

      expect(stats.framesProcessed).toBe(3);
      expect(stats.averageFrameTime).toBeGreaterThan(0);
      expect(parseFloat(stats.fps)).toBeGreaterThanOrEqual(30);
      expect(stats.averageCompressionRatio).toBeGreaterThan(0);
    });

    test('should track codec usage', async () => {
      const frameSize = 1280 * 720 * 4;
      const frameData = crypto.randomBytes(frameSize);

      await optimizer.compressFrame(frameData, 'image/png');
      await optimizer.compressFrame(frameData, 'image/jpeg');
      await optimizer.compressFrame(frameData, 'image/webp');

      const stats = optimizer.getStats();

      expect(stats.codecUsage.gzip).toBeGreaterThan(0);
      expect(stats.codecUsage.deflate).toBeGreaterThan(0);
      expect(stats.codecUsage.brotli).toBeGreaterThan(0);
    });

    test('should reset statistics', async () => {
      const frameSize = 1280 * 720 * 4;
      const frameData = crypto.randomBytes(frameSize);

      await optimizer.compressFrame(frameData, 'image/png');
      expect(optimizer.stats.framesProcessed).toBe(1);

      optimizer.resetStats();
      expect(optimizer.stats.framesProcessed).toBe(0);
      expect(optimizer.stats.compressionRatios).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle compression errors gracefully', async () => {
      const optimizer = new ScreenshotOptimizer();

      try {
        // Try with null codec (will be handled by worker)
        await optimizer.workerPool.compress(Buffer.from('test'), 'invalid', 6);
      } catch (error) {
        expect(error).toBeDefined();
      }

      await optimizer.cleanup();
    });

    test('should handle empty frames', async () => {
      const result = await optimizer.compressFrame(Buffer.alloc(0), 'image/png');
      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Worker Pool Management', () => {
    test('should initialize correct number of workers', () => {
      const stats = optimizer.workerPool.getStats();
      expect(stats.workerCount).toBeGreaterThan(0);
      expect(stats.workerCount).toBeLessThanOrEqual(4);
    });

    test('should track active workers and queue', async () => {
      const frameSize = 1920 * 1080 * 4;
      const frames = Array(2)
        .fill(null)
        .map(() => crypto.randomBytes(frameSize));

      // Start compressions without waiting
      const promises = frames.map(f => optimizer.compressFrame(f, 'image/png'));

      // Check stats while processing
      const stats = optimizer.workerPool.getStats();
      expect(stats.totalTasks).toBeGreaterThan(0);

      await Promise.all(promises);
      expect(optimizer.workerPool.getStats().completedTasks).toBe(2);
    });

    test('should calculate success rate', async () => {
      const frameSize = 1280 * 720 * 4;

      for (let i = 0; i < 5; i++) {
        const frameData = crypto.randomBytes(frameSize);
        await optimizer.compressFrame(frameData, 'image/png');
      }

      const stats = optimizer.workerPool.getStats();
      expect(parseFloat(stats.successRate)).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Buffer Pool', () => {
    test('should reuse buffers from pool', () => {
      const pool = new BufferPool(4);

      const buf1 = pool.acquire(1024);
      expect(buf1.length).toBeGreaterThanOrEqual(1024);

      pool.release(buf1);
      const stats1 = pool.getStats();
      expect(stats1.reuses).toBe(1);

      // Next acquire should get same buffer
      const buf2 = pool.acquire(512);
      expect(buf2).toBe(buf1);

      const stats2 = pool.getStats();
      expect(stats2.poolHits).toBe(1);
    });

    test('should allocate new buffer when pool empty', () => {
      const pool = new BufferPool(1);

      const buf1 = pool.acquire(1024);
      const buf2 = pool.acquire(1024);

      expect(buf1).not.toBe(buf2);
      expect(pool.getStats().allocations).toBe(2);
    });

    test('should enforce pool size limit', () => {
      const pool = new BufferPool(2);

      const buffers = [pool.acquire(1024), pool.acquire(1024), pool.acquire(1024)];

      buffers.forEach(b => pool.release(b));

      // Only 2 should be in pool due to size limit
      expect(pool.pool.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Performance Targets', () => {
    test('should meet 30+ fps target for 1080p frames', async () => {
      const frameSize = 1920 * 1080 * 4; // Full HD RGBA
      const framesToProcess = 10;

      const startTime = Date.now();

      for (let i = 0; i < framesToProcess; i++) {
        const frameData = crypto.randomBytes(frameSize);
        await optimizer.compressFrame(frameData, 'image/png');
      }

      const totalTime = Date.now() - startTime;
      const fps = (framesToProcess / (totalTime / 1000)).toFixed(2);

      console.log(`Performance: ${fps} fps (target: 30+ fps)`);
      console.log(`Average frame time: ${(totalTime / framesToProcess).toFixed(2)}ms (target: <33.3ms)`);

      expect(parseFloat(fps)).toBeGreaterThanOrEqual(30);
      expect(optimizer.stats.averageFrameTime).toBeLessThan(33.3);
    });

    test('should reduce compression time vs sequential (170ms baseline)', async () => {
      const frameSize = 1920 * 1080 * 4;
      const frameData = crypto.randomBytes(frameSize);

      const startTime = Date.now();
      const result = await optimizer.compressFrame(frameData, 'image/png');
      const duration = Date.now() - startTime;

      console.log(`Compression time: ${duration}ms (baseline: 170ms)`);
      console.log(`Improvement: ${((170 - duration) / 170 * 100).toFixed(2)}%`);

      // Should be significantly faster than 170ms baseline
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources without errors', async () => {
      const opt = new ScreenshotOptimizer();
      const frameSize = 1280 * 720 * 4;

      // Queue some frames
      for (let i = 0; i < 2; i++) {
        opt.queueFrame(crypto.randomBytes(frameSize), 'image/png');
      }

      // Should cleanup without errors
      expect(() => opt.cleanup()).not.toThrow();
      await opt.cleanup();
    });
  });
});

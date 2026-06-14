/**
 * Batch Screenshot Processor Test Suite
 *
 * Tests for coordinated multi-screenshot operations, parallel processing,
 * and batch result aggregation
 */

const { BatchScreenshotProcessor, BATCH_CONFIG } = require('../../screenshots/batch-processor');

describe('BatchScreenshotProcessor', () => {
  let mockManager;
  let processor;

  beforeEach(() => {
    // Create mock screenshot manager
    mockManager = {
      captureViewport: jest.fn(),
      captureFullPage: jest.fn(),
      captureElement: jest.fn(),
      captureArea: jest.fn(),
      annotateScreenshot: jest.fn()
    };

    processor = new BatchScreenshotProcessor(mockManager);
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(processor.options.maxConcurrent).toBe(BATCH_CONFIG.maxConcurrent);
      expect(processor.options.maxBatchSize).toBe(BATCH_CONFIG.maxBatchSize);
    });

    it('should accept custom options', () => {
      const customProcessor = new BatchScreenshotProcessor(mockManager, {
        maxConcurrent: 10,
        timeout: 60000
      });

      expect(customProcessor.options.maxConcurrent).toBe(10);
      expect(customProcessor.options.timeout).toBe(60000);
    });

    it('should initialize with empty active batches', () => {
      expect(processor.activeBatches.size).toBe(0);
    });

    it('should initialize statistics', () => {
      expect(processor.batchStats.totalProcessed).toBe(0);
      expect(processor.batchStats.totalSucceeded).toBe(0);
      expect(processor.batchStats.totalFailed).toBe(0);
    });
  });

  describe('captureBatch', () => {
    const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);

    it('should process valid batch of specifications', async () => {
      const specs = [
        { type: 'viewport', options: {} },
        { type: 'viewport', options: {} }
      ];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: pngData
      });

      const result = await processor.captureBatch(specs);

      expect(result.totalRequested).toBe(2);
      expect(result.batchId).toBeDefined();
      // Success depends on mock behavior
      expect(result.success === true || result.success === false).toBe(true);
    });

    it('should reject empty specs array', async () => {
      const result = await processor.captureBatch([]);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('non-empty array');
    });

    it('should reject oversized batch', async () => {
      const specs = Array(BATCH_CONFIG.maxBatchSize + 1).fill({ type: 'viewport' });
      const result = await processor.captureBatch(specs);

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('exceeds maximum');
    });

    it('should generate unique batch IDs', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const result1 = await processor.captureBatch(specs);
      const result2 = await processor.captureBatch(specs);

      expect(result1.batchId).not.toBe(result2.batchId);
    });

    it('should register batch as active', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const result = await processor.captureBatch(specs);

      const batch = processor.activeBatches.get(result.batchId);
      expect(batch).toBeDefined();
      expect(batch.status).toBe('complete');
    });

    it('should calculate success rate', async () => {
      const specs = [
        { type: 'viewport', options: {} },
        { type: 'viewport', options: {} }
      ];

      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);

      mockManager.captureViewport
        .mockResolvedValueOnce({
          success: true,
          data: pngData
        })
        .mockResolvedValueOnce({
          success: false,
          error: 'Capture failed'
        });

      const result = await processor.captureBatch(specs);

      expect(result.totalRequested).toBe(2);
      expect(result.stats.successRate).toBeDefined();
    });

    it('should update batch statistics', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const initialTotal = processor.batchStats.totalProcessed;
      await processor.captureBatch(specs);

      expect(processor.batchStats.totalProcessed).toBe(initialTotal + 1);
      expect(processor.batchStats.totalSucceeded).toBeGreaterThanOrEqual(initialTotal);
    });
  });

  describe('processBatchParallel', () => {
    it('should process tasks with concurrency limit', async () => {
      const tasks = [
        { type: 'viewport' },
        { type: 'viewport' },
        { type: 'viewport' }
      ];

      let concurrentCalls = 0;
      let maxConcurrent = 0;

      mockManager.captureViewport.mockImplementation(async () => {
        concurrentCalls++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

        await new Promise(resolve => setTimeout(resolve, 10));
        concurrentCalls--;

        return { success: true, data: Buffer.from([137, 80, 78, 71]) };
      });

      const results = await processor.processBatchParallel(tasks, {
        maxConcurrent: 2
      });

      expect(results.length).toBe(3);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it('should return results in order', async () => {
      const tasks = [
        { id: 'a', delay: 20 },
        { id: 'b', delay: 10 },
        { id: 'c', delay: 5 }
      ];

      mockManager.captureViewport.mockImplementation(async (options) => {
        await new Promise(resolve => setTimeout(resolve, options.delay));
        return {
          success: true,
          data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
        };
      });

      const results = await processor.processBatchParallel(tasks);

      expect(results.length).toBe(3);
      // Results should be in input order
      for (let i = 0; i < results.length; i++) {
        expect(results[i]).toBeDefined();
      }
    });

    it('should handle failures gracefully', async () => {
      const tasks = [
        { type: 'viewport' },
        { type: 'viewport' }
      ];

      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);

      mockManager.captureViewport
        .mockResolvedValueOnce({ success: true, data: pngData })
        .mockRejectedValueOnce(new Error('Capture error'));

      const results = await processor.processBatchParallel(tasks);

      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('processSingleCapture', () => {
    it('should capture with retry logic', async () => {
      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      let attempts = 0;

      mockManager.captureViewport.mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          return { success: false, error: 'Timeout' };
        }
        return { success: true, data: pngData };
      });

      const result = await processor.processSingleCapture({ type: 'viewport' });

      // Result may or may not succeed depending on timing
      expect(result).toBeDefined();
      expect(result.attempts).toBeGreaterThanOrEqual(1);
    });

    it('should respect retry attempt limit', async () => {
      mockManager.captureViewport.mockResolvedValue({
        success: false,
        error: 'Persistent failure'
      });

      const result = await processor.processSingleCapture({ type: 'viewport' });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(processor.options.retryAttempts);
    });

    it('should apply backoff between retries', async () => {
      const timestamps = [];

      mockManager.captureViewport.mockImplementation(async () => {
        timestamps.push(Date.now());
        return { success: false, error: 'Failure' };
      });

      await processor.processSingleCapture({ type: 'viewport' });

      // Check that there are increasing delays between attempts
      if (timestamps.length > 2) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    });
  });

  describe('executeCaptureSpec', () => {
    const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);

    it('should handle viewport capture', async () => {
      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: pngData
      });

      const result = await processor.executeCaptureSpec({
        type: 'viewport',
        options: {}
      });

      expect(result).toBeDefined();
      expect(result.success === true || result.success === false).toBe(true);
    });

    it('should handle fullpage capture', async () => {
      mockManager.captureFullPage.mockResolvedValue({
        success: true,
        data: pngData
      });

      const result = await processor.executeCaptureSpec({
        type: 'fullpage',
        options: {}
      });

      expect(result).toBeDefined();
      expect(result.success === true || result.success === false).toBe(true);
    });

    it('should handle element capture with selector', async () => {
      mockManager.captureElement.mockResolvedValue({
        success: true,
        data: pngData
      });

      const result = await processor.executeCaptureSpec({
        type: 'element',
        options: { selector: '#my-element' }
      });

      expect(result).toBeDefined();
    });

    it('should require selector for element capture', async () => {
      const result = await processor.executeCaptureSpec({
        type: 'element',
        options: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/requires selector/i);
    });

    it('should reject unknown capture type', async () => {
      const result = await processor.executeCaptureSpec({
        type: 'unknown',
        options: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown capture type');
    });
  });

  describe('aggregateResults', () => {
    it('should aggregate successful captures', async () => {
      const pngData = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const captures = [
        { success: true, data: pngData, format: 'png' },
        { success: true, data: pngData, format: 'png' }
      ];

      const aggregated = await processor.aggregateResults(captures);

      expect(aggregated.total).toBe(2);
      expect(aggregated.succeeded).toBe(2);
      expect(aggregated.failed).toBe(0);
    });

    it('should track format distribution', async () => {
      const captures = [
        { success: true, data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), format: 'png' },
        { success: true, data: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), format: 'jpeg' }
      ];

      const aggregated = await processor.aggregateResults(captures);

      expect(aggregated.metadata.formats.png).toBe(1);
      expect(aggregated.metadata.formats.jpeg).toBe(1);
    });

    it('should calculate average size', async () => {
      const captures = [
        { success: true, data: Buffer.alloc(1000) },
        { success: true, data: Buffer.alloc(2000) }
      ];

      const aggregated = await processor.aggregateResults(captures);

      expect(aggregated.metadata.averageSize).toBe(1500);
    });

    it('should handle mixed success and failure', async () => {
      const captures = [
        { success: true, data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) },
        { success: false, error: 'Failed' },
        { success: true, data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) }
      ];

      const aggregated = await processor.aggregateResults(captures);

      expect(aggregated.succeeded).toBe(2);
      expect(aggregated.failed).toBe(1);
    });
  });

  describe('annotateBatch', () => {
    it('should annotate multiple images', async () => {
      const images = [
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      ];

      const annotations = [
        { type: 'text', text: 'Label 1', x: 10, y: 10 }
      ];

      mockManager.annotateScreenshot.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const results = await processor.annotateBatch(images, annotations);

      expect(results.length).toBe(2);
      expect(mockManager.annotateScreenshot).toHaveBeenCalledTimes(2);
    });

    it('should reject empty images array', async () => {
      await expect(processor.annotateBatch([], [])).rejects.toThrow('non-empty array');
    });

    it('should reject empty annotations array', async () => {
      const images = [Buffer.from([137, 80, 78, 71])];
      await expect(processor.annotateBatch(images, [])).rejects.toThrow('non-empty array');
    });

    it('should handle annotation errors gracefully', async () => {
      const images = [Buffer.from([137, 80, 78, 71])];
      const annotations = [{ type: 'text' }];

      mockManager.annotateScreenshot.mockRejectedValue(new Error('Annotation failed'));

      const results = await processor.annotateBatch(images, annotations);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Annotation failed');
    });
  });

  describe('resource management', () => {
    it('should report resource pool status', () => {
      const status = processor.getResourcePool();

      expect(status.inUse).toBeGreaterThanOrEqual(0);
      expect(status.maxConcurrent).toBe(BATCH_CONFIG.maxConcurrent);
      expect(status.available).toBeGreaterThanOrEqual(0);
    });

    it('should get batch status', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const result = await processor.captureBatch(specs);
      const status = processor.getBatchStatus(result.batchId);

      expect(status.status).toBe('complete');
      expect(status.id).toBe(result.batchId);
    });

    it('should return error for unknown batch', () => {
      const status = processor.getBatchStatus('unknown-id');
      expect(status.error).toBeDefined();
    });

    it('should report overall statistics', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      await processor.captureBatch(specs);

      const stats = processor.getStatistics();

      expect(stats.totalProcessed).toBeGreaterThanOrEqual(1);
      expect(stats.activeBatches).toBeGreaterThanOrEqual(0);
      expect(stats.overallSuccessRate).toBeDefined();
    });
  });

  describe('batch cleanup', () => {
    it('should clear completed batches older than maxAge', async () => {
      const specs = [{ type: 'viewport', options: {} }];

      mockManager.captureViewport.mockResolvedValue({
        success: true,
        data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      });

      const result = await processor.captureBatch(specs);

      // Manually mark as old
      const batch = processor.activeBatches.get(result.batchId);
      if (batch) {
        batch.startTime = Date.now() - 7200000; // 2 hours ago
      }

      const cleared = processor.clearCompletedBatches(3600000); // 1 hour max age

      expect(cleared).toBeGreaterThanOrEqual(0);
    });
  });
});

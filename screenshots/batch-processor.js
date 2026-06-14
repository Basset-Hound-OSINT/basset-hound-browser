/**
 * Batch Screenshot Processor
 *
 * Handles coordinated multi-screenshot capture with optimization and parallel processing.
 * Provides resource pooling, result aggregation, and batch annotations.
 */

const { ImageValidator } = require('./validators');

/**
 * Batch processing configuration
 */
const BATCH_CONFIG = {
  maxConcurrent: 5,
  maxBatchSize: 100,
  timeout: 120000,  // 2 minutes
  retryAttempts: 3,
  retryBackoffMs: 1000
};

/**
 * BatchScreenshotProcessor class for coordinated multi-screenshot operations
 */
class BatchScreenshotProcessor {
  constructor(screenshotManager, options = {}) {
    this.manager = screenshotManager;
    this.options = { ...BATCH_CONFIG, ...options };
    this.activeBatches = new Map();
    this.resourcePool = {
      inUse: 0,
      maxConcurrent: this.options.maxConcurrent,
      queue: []
    };
    this.batchStats = {
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      totalTime: 0
    };
  }

  /**
   * Capture multiple screenshots in a batch
   * @param {Array} specs - Array of capture specifications
   * @param {Object} options - Batch options
   * @returns {Promise<Object>} Batch results
   */
  async captureBatch(specs, options = {}) {
    const batchId = this.generateBatchId();
    const startTime = Date.now();

    const result = {
      batchId,
      success: false,
      totalRequested: 0,
      totalCaptured: 0,
      captures: [],
      errors: [],
      warnings: [],
      stats: {
        startTime,
        endTime: null,
        duration: 0,
        successRate: 0
      }
    };

    try {
      // Validate input
      if (!Array.isArray(specs) || specs.length === 0) {
        result.errors.push('specs must be a non-empty array');
        return result;
      }

      if (specs.length > this.options.maxBatchSize) {
        result.errors.push(`Batch size ${specs.length} exceeds maximum ${this.options.maxBatchSize}`);
        return result;
      }

      result.totalRequested = specs.length;

      // Register batch
      this.activeBatches.set(batchId, {
        id: batchId,
        specs,
        options,
        startTime,
        status: 'processing',
        captures: []
      });

      // Process batch
      const parallelOptions = {
        maxConcurrent: options.maxConcurrent || this.options.maxConcurrent,
        timeout: options.timeout || this.options.timeout
      };

      const captures = await this.processBatchParallel(specs, parallelOptions);

      // Update results
      result.captures = captures;
      result.totalCaptured = captures.filter(c => c.success).length;
      result.errors = captures.filter(c => !c.success).map(c => c.error || 'Unknown error');
      result.success = result.totalCaptured > 0;

      // Calculate stats
      result.stats.successRate = result.totalRequested > 0
        ? (result.totalCaptured / result.totalRequested * 100).toFixed(2)
        : 0;

      // Update batch stats
      this.batchStats.totalProcessed += result.totalRequested;
      this.batchStats.totalSucceeded += result.totalCaptured;
      this.batchStats.totalFailed += result.errors.length;

      // Mark batch complete
      const batch = this.activeBatches.get(batchId);
      if (batch) {
        batch.status = 'complete';
        batch.captures = captures;
      }

      return result;
    } catch (error) {
      result.errors.push(`Batch processing failed: ${error.message}`);
      return result;
    } finally {
      result.stats.endTime = Date.now();
      result.stats.duration = result.stats.endTime - result.stats.startTime;
      this.batchStats.totalTime += result.stats.duration;
    }
  }

  /**
   * Process batch items in parallel with concurrency control
   * @param {Array} tasks - Tasks to process
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Results array
   */
  async processBatchParallel(tasks, options = {}) {
    const {
      maxConcurrent = this.options.maxConcurrent,
      timeout = this.options.timeout
    } = options;

    const results = [];
    let inProgress = 0;
    let taskIndex = 0;

    const processNext = async () => {
      while (taskIndex < tasks.length && inProgress < maxConcurrent) {
        const idx = taskIndex++;
        const task = tasks[idx];
        inProgress++;

        try {
          const captureResult = await this.processSingleCapture(task, timeout);
          results[idx] = captureResult;
        } catch (error) {
          results[idx] = {
            success: false,
            error: error.message,
            spec: task
          };
        } finally {
          inProgress--;

          // Process next if available
          if (taskIndex < tasks.length) {
            processNext();
          }
        }
      }
    };

    // Start initial concurrent tasks
    const initialTasks = [];
    for (let i = 0; i < Math.min(maxConcurrent, tasks.length); i++) {
      initialTasks.push(processNext());
    }

    await Promise.all(initialTasks);

    // Wait for remaining tasks
    while (inProgress > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return results.filter(r => r !== undefined);
  }

  /**
   * Process a single screenshot capture with retry logic
   * @param {Object} spec - Capture specification
   * @param {number} timeout - Operation timeout
   * @returns {Promise<Object>} Capture result
   */
  async processSingleCapture(spec, timeout = this.options.timeout) {
    let lastError = null;

    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        // Apply backoff for retries
        if (attempt > 0) {
          await this.sleep(this.options.retryBackoffMs * attempt);
        }

        const result = await this.captureWithTimeout(spec, timeout);

        if (result.success) {
          return {
            success: true,
            ...result,
            spec,
            attempts: attempt + 1
          };
        }

        lastError = result.error;
      } catch (error) {
        lastError = error.message;
      }
    }

    return {
      success: false,
      error: lastError || 'All retry attempts failed',
      spec,
      attempts: this.options.retryAttempts
    };
  }

  /**
   * Capture with timeout protection
   * @param {Object} spec - Capture specification
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>} Capture result
   */
  async captureWithTimeout(spec, timeout) {
    return Promise.race([
      this.executeCaptureSpec(spec),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Capture timeout')), timeout)
      )
    ]);
  }

  /**
   * Execute single capture specification
   * @param {Object} spec - Capture spec with type and options
   * @returns {Promise<Object>} Capture result
   */
  async executeCaptureSpec(spec) {
    const { type = 'viewport', options = {} } = spec;

    try {
      let result;

      switch (type) {
        case 'viewport':
          result = await this.manager.captureViewport(options);
          break;
        case 'fullpage':
          result = await this.manager.captureFullPage(options);
          break;
        case 'element':
          if (!options.selector) {
            throw new Error('Element capture requires selector option');
          }
          result = await this.manager.captureElement(options.selector, options);
          break;
        case 'area':
          if (!options.x || !options.y || !options.width || !options.height) {
            throw new Error('Area capture requires x, y, width, height options');
          }
          result = await this.manager.captureArea(options);
          break;
        default:
          throw new Error(`Unknown capture type: ${type}`);
      }

      // Validate captured data
      if (result.success && result.data) {
        const validation = ImageValidator.validateImageData(result.data);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.errors.join('; ')
          };
        }

        // Check for blank pages
        const blankCheck = ImageValidator.detectBlankImage(result.data);
        if (blankCheck.isBlank) {
          result.warning = `Possibly blank page: ${blankCheck.type}`;
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Aggregate batch results with metadata
   * @param {Array} captures - Array of capture results
   * @returns {Object} Aggregated results
   */
  async aggregateResults(captures) {
    const aggregated = {
      total: captures.length,
      succeeded: 0,
      failed: 0,
      captures: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        totalSize: 0,
        averageSize: 0,
        formats: {}
      }
    };

    let totalSize = 0;

    for (const capture of captures) {
      if (capture.success) {
        aggregated.succeeded++;

        // Track size and format
        if (capture.data) {
          let size = 0;
          if (typeof capture.data === 'string') {
            if (capture.data.startsWith('data:')) {
              // Data URL - estimate actual size
              size = Buffer.byteLength(capture.data.split(',')[1] || '', 'base64');
            } else {
              size = Buffer.byteLength(capture.data, 'base64');
            }
          } else if (Buffer.isBuffer(capture.data)) {
            size = capture.data.length;
          }

          totalSize += size;
          capture.estimatedSize = size;
        }

        // Track format
        const format = capture.format || 'unknown';
        aggregated.metadata.formats[format] = (aggregated.metadata.formats[format] || 0) + 1;

        aggregated.captures.push(capture);
      } else {
        aggregated.failed++;
      }
    }

    aggregated.metadata.totalSize = totalSize;
    aggregated.metadata.averageSize = aggregated.succeeded > 0
      ? Math.round(totalSize / aggregated.succeeded)
      : 0;

    return aggregated;
  }

  /**
   * Apply annotations to batch of images
   * @param {Array} images - Image data array
   * @param {Array} annotations - Annotation specifications
   * @returns {Promise<Array>} Annotated images
   */
  async annotateBatch(images, annotations) {
    if (!Array.isArray(images) || images.length === 0) {
      throw new Error('Images must be a non-empty array');
    }

    if (!Array.isArray(annotations) || annotations.length === 0) {
      throw new Error('Annotations must be a non-empty array');
    }

    const results = [];

    for (const imageData of images) {
      try {
        const annotated = await this.manager.annotateScreenshot(imageData, annotations);
        results.push({
          success: annotated.success,
          data: annotated.success ? annotated.data : null,
          error: annotated.success ? null : annotated.error
        });
      } catch (error) {
        results.push({
          success: false,
          data: null,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get resource pool status
   * @returns {Object} Pool status
   */
  getResourcePool() {
    return {
      inUse: this.resourcePool.inUse,
      maxConcurrent: this.resourcePool.maxConcurrent,
      available: this.resourcePool.maxConcurrent - this.resourcePool.inUse,
      queueLength: this.resourcePool.queue.length,
      utilizationPercent: (this.resourcePool.inUse / this.resourcePool.maxConcurrent * 100).toFixed(2)
    };
  }

  /**
   * Get batch status
   * @param {string} batchId - Batch identifier
   * @returns {Object} Batch status
   */
  getBatchStatus(batchId) {
    const batch = this.activeBatches.get(batchId);
    return batch || { error: 'Batch not found' };
  }

  /**
   * Get overall statistics
   * @returns {Object} Batch statistics
   */
  getStatistics() {
    return {
      ...this.batchStats,
      activeBatches: this.activeBatches.size,
      averageTimePerBatch: this.batchStats.totalProcessed > 0
        ? Math.round(this.batchStats.totalTime / (this.batchStats.totalProcessed || 1))
        : 0,
      overallSuccessRate: this.batchStats.totalProcessed > 0
        ? (this.batchStats.totalSucceeded / this.batchStats.totalProcessed * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Generate unique batch identifier
   * @returns {string} Batch ID
   */
  generateBatchId() {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep for specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear completed batches from memory
   * @param {number} maxAge - Maximum age in ms (default: 1 hour)
   * @returns {number} Number of batches cleared
   */
  clearCompletedBatches(maxAge = 3600000) {
    const now = Date.now();
    let cleared = 0;

    for (const [batchId, batch] of this.activeBatches.entries()) {
      if (batch.status === 'complete' && (now - batch.startTime) > maxAge) {
        this.activeBatches.delete(batchId);
        cleared++;
      }
    }

    return cleared;
  }
}

module.exports = { BatchScreenshotProcessor, BATCH_CONFIG };

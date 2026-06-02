/**
 * Batch Operation Coalescer
 * OPT-13: Coalesce similar commands into batches
 *
 * Features:
 * - Detect multiple monitor checks queued
 * - Batch similar operations into single operation
 * - Distribute results back individually
 * - Configurable timeout before executing
 * - Support for various operation types
 *
 * Expected gain: 15-20% throughput on batch operations
 */

class BatchCoalescer {
  constructor(options = {}) {
    this.maxWaitTime = options.maxWaitTime || 100;      // ms, max wait before executing
    this.batchSize = options.batchSize || 10;           // max operations per batch
    this.enabled = options.enabled !== false;

    // Operation type definitions
    this.operationTypes = {
      'monitor_change': {
        name: 'Change Detection',
        batchable: true,
        timeoutMs: 100,
        maxBatchSize: 15
      },
      'extract_text': {
        name: 'Text Extraction',
        batchable: true,
        timeoutMs: 50,
        maxBatchSize: 20
      },
      'extract_links': {
        name: 'Link Extraction',
        batchable: true,
        timeoutMs: 50,
        maxBatchSize: 20
      },
      'check_status': {
        name: 'Status Check',
        batchable: true,
        timeoutMs: 100,
        maxBatchSize: 30
      },
      'ping': {
        name: 'Ping',
        batchable: true,
        timeoutMs: 200,
        maxBatchSize: 50
      }
    };

    // Queue management
    this.operationQueues = new Map(); // operationType -> queue
    this.pendingTimers = new Map();   // operationType -> timeoutId
    this.metrics = {
      totalOperations: 0,
      totalBatches: 0,
      operationsSaved: 0,
      avgBatchSize: 0,
      batchSizes: [],
      coalesceRate: 0
    };
  }

  /**
   * Queue operation for potential coalescing
   */
  queueOperation(operation) {
    if (!this.enabled || !this._isBatchable(operation.type)) {
      // Return immediately, don't queue
      return { queued: false, execute: true, operations: [operation] };
    }

    const operationType = operation.type;
    const config = this.operationTypes[operationType];

    // Initialize queue if needed
    if (!this.operationQueues.has(operationType)) {
      this.operationQueues.set(operationType, []);
    }

    const queue = this.operationQueues.get(operationType);
    queue.push(operation);
    this.metrics.totalOperations++;

    // Check if batch is full
    if (queue.length >= config.maxBatchSize) {
      return this._executeBatch(operationType);
    }

    // Set timeout if not already set
    if (!this.pendingTimers.has(operationType)) {
      const timeoutId = setTimeout(() => {
        this._executeBatch(operationType);
        this.pendingTimers.delete(operationType);
      }, config.timeoutMs);

      this.pendingTimers.set(operationType, timeoutId);
    }

    return {
      queued: true,
      execute: false,
      batchSize: queue.length,
      timeoutMs: config.timeoutMs
    };
  }

  /**
   * Process queued operations into batch
   * @private
   */
  _executeBatch(operationType) {
    const queue = this.operationQueues.get(operationType);

    if (!queue || queue.length === 0) {
      return { queued: false, execute: false, operations: [] };
    }

    // Clear timeout if pending
    if (this.pendingTimers.has(operationType)) {
      clearTimeout(this.pendingTimers.get(operationType));
      this.pendingTimers.delete(operationType);
    }

    const operations = [...queue];
    const batchSize = operations.length;

    // Clear queue
    queue.length = 0;

    // Update metrics
    this.metrics.totalBatches++;
    this.metrics.operationsSaved += Math.max(0, batchSize - 1);
    this.metrics.batchSizes.push(batchSize);
    this._updateMetrics();

    return {
      queued: false,
      execute: true,
      batched: true,
      batchSize,
      operationType,
      operations
    };
  }

  /**
   * Check if operation type is batchable
   * @private
   */
  _isBatchable(operationType) {
    const config = this.operationTypes[operationType];
    return config && config.batchable;
  }

  /**
   * Create batch from operations
   */
  createBatch(operations) {
    if (operations.length === 0) {
      throw new Error('No operations to batch');
    }

    const operationType = operations[0].type;
    const config = this.operationTypes[operationType];

    // Validate all operations are same type
    for (const op of operations) {
      if (op.type !== operationType) {
        throw new Error('Cannot batch different operation types');
      }
    }

    // Extract parameters based on operation type
    const batchParams = this._extractBatchParams(operationType, operations);

    return {
      type: operationType,
      isBatch: true,
      operationCount: operations.length,
      parameters: batchParams,
      originalOperations: operations,
      createdAt: Date.now()
    };
  }

  /**
   * Extract batch parameters from operations
   * @private
   */
  _extractBatchParams(operationType, operations) {
    switch (operationType) {
      case 'monitor_change':
        return {
          monitors: operations.map(op => op.monitorId)
        };

      case 'extract_text':
      case 'extract_links':
        return {
          selectors: operations.map(op => op.selector),
          sessionIds: operations.map(op => op.sessionId)
        };

      case 'check_status':
        return {
          sessionIds: operations.map(op => op.sessionId),
          components: operations.map(op => op.component)
        };

      case 'ping':
        return {
          sessionIds: operations.map(op => op.sessionId)
        };

      default:
        return { operations };
    }
  }

  /**
   * Distribute batch results back to individual operations
   */
  distributeBatchResults(batchResults, originalOperations) {
    if (!Array.isArray(batchResults) || batchResults.length !== originalOperations.length) {
      throw new Error('Batch results length must match operation count');
    }

    const distributedResults = [];

    for (let i = 0; i < originalOperations.length; i++) {
      distributedResults.push({
        operationId: i,
        result: batchResults[i],
        batched: true,
        batchSize: originalOperations.length
      });
    }

    return distributedResults;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const status = {};

    for (const [operationType, queue] of this.operationQueues) {
      const config = this.operationTypes[operationType];
      const timeoutId = this.pendingTimers.get(operationType);

      status[operationType] = {
        queueSize: queue.length,
        config: config,
        hasPendingTimeout: !!timeoutId,
        readyForBatch: queue.length >= config.maxBatchSize * 0.5
      };
    }

    return status;
  }

  /**
   * Force execute all pending batches
   */
  flushAll() {
    const results = [];

    for (const operationType of this.operationQueues.keys()) {
      const result = this._executeBatch(operationType);
      if (result.operations && result.operations.length > 0) {
        results.push(result);
      }
    }

    return {
      flushed: true,
      batches: results,
      totalOperations: results.reduce((sum, b) => sum + b.operations.length, 0)
    };
  }

  /**
   * Update metrics
   * @private
   */
  _updateMetrics() {
    if (this.metrics.batchSizes.length === 0) return;

    const sum = this.metrics.batchSizes.reduce((a, b) => a + b, 0);
    this.metrics.avgBatchSize = Math.round(sum / this.metrics.batchSizes.length);

    if (this.metrics.totalOperations > 0) {
      this.metrics.coalesceRate = Math.round(
        (this.metrics.operationsSaved / this.metrics.totalOperations) * 100
      );
    }

    // Keep only last 100 samples
    if (this.metrics.batchSizes.length > 100) {
      this.metrics.batchSizes = this.metrics.batchSizes.slice(-100);
    }
  }

  /**
   * Enable/disable coalescing
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.flushAll();
    }
  }

  /**
   * Register custom operation type
   */
  registerOperationType(type, config) {
    this.operationTypes[type] = {
      name: config.name || type,
      batchable: config.batchable !== false,
      timeoutMs: config.timeoutMs || 100,
      maxBatchSize: config.maxBatchSize || 20
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      operationsSavedPercent: this.metrics.totalOperations > 0
        ? ((this.metrics.operationsSaved / this.metrics.totalOperations) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalOperations: 0,
      totalBatches: 0,
      operationsSaved: 0,
      avgBatchSize: 0,
      batchSizes: [],
      coalesceRate: 0
    };
  }
}

module.exports = BatchCoalescer;

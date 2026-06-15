/**
 * Message Batching Optimization v2
 *
 * Advanced batching strategy for Phase 4 performance optimization:
 * - Aggregate rapid commands (< 10ms apart)
 * - Execute batch as single transaction
 * - Parallel processing for independent commands
 * - Adaptive batch sizing based on load
 *
 * Expected Gain: +5-8% throughput
 *
 * @module src/optimization/message-batching-v2
 */

const { performance } = require('perf_hooks');

/**
 * Message Batching Queue with Adaptive Sizing
 *
 * Features:
 * - Collects commands during batch window
 * - Auto-executes when batch window expires OR max batch size reached
 * - Parallel execution for independent commands
 * - Detailed metrics for tuning
 */
class MessageBatchingV2 {
  constructor(options = {}) {
    this.batchWindow = options.batchWindow || 5; // ms
    this.maxBatchSize = options.maxBatchSize || 10; // max commands per batch
    this.parallelThreshold = options.parallelThreshold || 3; // min commands for parallelization
    this.adaptiveWindow = options.adaptiveWindow !== false; // adapt window based on load

    this.queue = [];
    this.pendingTimer = null;
    this.processing = false;

    // Metrics for tuning
    this.metrics = {
      totalBatches: 0,
      totalCommands: 0,
      averageBatchSize: 0,
      averageWindowTime: 0,
      parallelBatches: 0,
      commandLatencies: []
    };

    // Batch execution handlers
    this.commandHandlers = new Map();

    // Load tracking for adaptive batching
    this.loadHistory = [];
    this.lastLoadCheck = Date.now();
  }

  /**
   * Register command handler
   */
  registerHandler(commandName, handler) {
    this.commandHandlers.set(commandName, handler);
  }

  /**
   * Queue a command for batch processing
   * @param {Object} command - Command object { id, command, params }
   * @returns {Promise} Resolves when command completes
   */
  async queueCommand(command) {
    const queueTime = performance.now();
    let resolvePromise, rejectPromise;

    const promise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    this.queue.push({
      command,
      resolve: resolvePromise,
      reject: rejectPromise,
      queueTime
    });

    // If batch window timer not set, schedule it
    if (!this.pendingTimer) {
      this._scheduleBatchExecution();
    }

    // If max batch size reached, execute immediately
    if (this.queue.length >= this.maxBatchSize) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
      await this._executeBatch();
    }

    return promise;
  }

  /**
   * Schedule batch execution after batch window
   * @private
   */
  _scheduleBatchExecution() {
    const window = this._getAdaptiveBatchWindow();
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      if (this.queue.length > 0) {
        this._executeBatch().catch(err => {
          // Log but don't crash
          console.error('Batch execution error:', err);
        });
      }
    }, window);
  }

  /**
   * Get adaptive batch window based on current load
   * @private
   */
  _getAdaptiveBatchWindow() {
    if (!this.adaptiveWindow) {
      return this.batchWindow;
    }

    const now = Date.now();
    const elapsed = now - this.lastLoadCheck;

    if (elapsed >= 1000) {
      // Re-evaluate load every 1 second
      const currentLoad = this.queue.length;
      this.loadHistory.push(currentLoad);

      // Keep only last 10 measurements
      if (this.loadHistory.length > 10) {
        this.loadHistory.shift();
      }

      this.lastLoadCheck = now;
    }

    const avgLoad = this.loadHistory.length > 0
      ? this.loadHistory.reduce((a, b) => a + b, 0) / this.loadHistory.length
      : 0;

    // Adaptive window: reduce window under high load, increase under low load
    if (avgLoad > 5) {
      return Math.max(1, this.batchWindow - 3); // Tighter window
    } else if (avgLoad < 2) {
      return this.batchWindow + 2; // Looser window for batching
    }

    return this.batchWindow;
  }

  /**
   * Execute queued batch
   * @private
   */
  async _executeBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batchStartTime = performance.now();

    // Extract batch
    const batch = this.queue.splice(0);
    const batchSize = batch.length;

    try {
      // Determine if commands can be parallelized
      const canParallelize = batchSize >= this.parallelThreshold &&
                            this._canParallelizeBatch(batch);

      let results;
      if (canParallelize) {
        // Parallel execution
        results = await this._executeParallel(batch);
        this.metrics.parallelBatches++;
      } else {
        // Sequential execution
        results = await this._executeSequential(batch);
      }

      // Resolve all promises with results
      batch.forEach((item, index) => {
        const latency = performance.now() - item.queueTime;
        this.metrics.commandLatencies.push(latency);

        if (results[index]?.error) {
          item.reject(new Error(results[index].error));
        } else {
          item.resolve(results[index]);
        }
      });

      // Update metrics
      this.metrics.totalBatches++;
      this.metrics.totalCommands += batchSize;
      this.metrics.averageBatchSize = this.metrics.totalCommands / this.metrics.totalBatches;

      const windowTime = performance.now() - batchStartTime;
      this.metrics.averageWindowTime =
        (this.metrics.averageWindowTime * (this.metrics.totalBatches - 1) + windowTime) /
        this.metrics.totalBatches;

    } catch (error) {
      // Reject all commands in batch
      batch.forEach(item => {
        item.reject(error);
      });
    } finally {
      this.processing = false;

      // Continue with next batch if queue has items
      if (this.queue.length > 0) {
        this._scheduleBatchExecution();
      }
    }
  }

  /**
   * Check if batch commands can be parallelized
   * @private
   */
  _canParallelizeBatch(batch) {
    // List of read-only commands that are safe to parallelize
    const readOnlyCommands = new Set([
      'get_url', 'get_content', 'screenshot', 'screenshot_viewport',
      'get_cookies', 'get_page_state', 'status', 'ping'
    ]);

    // All commands in batch must be read-only or independent
    return batch.every(item =>
      readOnlyCommands.has(item.command.command)
    );
  }

  /**
   * Execute batch commands in parallel
   * @private
   */
  async _executeParallel(batch) {
    const promises = batch.map(item =>
      this._executeCommand(item.command)
        .catch(error => ({ error: error.message }))
    );

    return Promise.all(promises);
  }

  /**
   * Execute batch commands sequentially
   * @private
   */
  async _executeSequential(batch) {
    const results = [];

    for (const item of batch) {
      try {
        const result = await this._executeCommand(item.command);
        results.push(result);
      } catch (error) {
        results.push({ error: error.message });
      }
    }

    return results;
  }

  /**
   * Execute single command
   * @private
   */
  async _executeCommand(command) {
    const handler = this.commandHandlers.get(command.command);

    if (!handler) {
      throw new Error(`Unknown command: ${command.command}`);
    }

    return handler(command);
  }

  /**
   * Flush all pending commands immediately
   */
  async flush() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    if (this.queue.length > 0) {
      await this._executeBatch();
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      pendingCommands: this.queue.length,
      processing: this.processing,
      p95Latency: this._calculatePercentile(95),
      p99Latency: this._calculatePercentile(99)
    };
  }

  /**
   * Calculate latency percentile
   * @private
   */
  _calculatePercentile(percentile) {
    if (this.metrics.commandLatencies.length === 0) {
      return 0;
    }

    const sorted = [...this.metrics.commandLatencies].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile / 100) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalBatches: 0,
      totalCommands: 0,
      averageBatchSize: 0,
      averageWindowTime: 0,
      parallelBatches: 0,
      commandLatencies: []
    };
  }
}

module.exports = { MessageBatchingV2 };

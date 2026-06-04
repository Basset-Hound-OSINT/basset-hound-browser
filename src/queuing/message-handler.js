/**
 * Message Handler Framework
 * Wave 16 Phase 2: Distributed Architecture
 *
 * Features:
 * - Handlers for each queue type
 * - Concurrent processing with worker pools
 * - Error handling and retry logic
 * - Processing statistics and monitoring
 */

const EventEmitter = require('events');

class MessageHandler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxConcurrency: options.maxConcurrency || 10,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      retryBackoff: options.retryBackoff || 'exponential',
      enableMetrics: options.enableMetrics !== false,
      ...options
    };

    // Worker pool
    this.workers = [];
    this.activeWorkers = 0;
    this.waitingMessages = [];

    // Handler registry
    this.handlers = new Map();
    this.defaultHandler = null;

    // Metrics
    this.metrics = {
      processed: 0,
      failed: 0,
      succeeded: 0,
      retried: 0,
      timedOut: 0,
      totalProcessingTime: 0,
      processingTimes: [],
      handlerMetrics: new Map(),
      queueMetrics: new Map()
    };

    // Initialize worker pool
    this._initializeWorkerPool();
  }

  /**
   * Initialize worker pool
   * @private
   */
  _initializeWorkerPool() {
    for (let i = 0; i < this.options.maxConcurrency; i++) {
      const worker = {
        id: i,
        active: false,
        currentMessage: null,
        startTime: null,
        processedCount: 0,
        failedCount: 0
      };
      this.workers.push(worker);
    }
  }

  /**
   * Register message handler for queue
   */
  registerHandler(queueName, handlerFunction, options = {}) {
    try {
      const handler = {
        queueName,
        handler: handlerFunction,
        timeout: options.timeout || this.options.timeout,
        maxRetries: options.maxRetries || this.options.maxRetries,
        retryBackoff: options.retryBackoff || this.options.retryBackoff,
        priority: options.priority || 'normal',
        concurrent: options.concurrent !== false,
        batchSize: options.batchSize || 1,
        enabled: true
      };

      this.handlers.set(queueName, handler);

      // Initialize metrics for this handler
      this.metrics.handlerMetrics.set(queueName, {
        queueName,
        processed: 0,
        succeeded: 0,
        failed: 0,
        retried: 0,
        timedOut: 0,
        averageTime: 0,
        processingTimes: []
      });

      this.emit('handler:registered', { queueName, handler });
      console.log(`[MessageHandler] Handler registered for queue: ${queueName}`);

      return handler;
    } catch (error) {
      console.error(`[MessageHandler] Failed to register handler for ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Set default handler for unknown queues
   */
  setDefaultHandler(handlerFunction, options = {}) {
    this.defaultHandler = {
      handler: handlerFunction,
      timeout: options.timeout || this.options.timeout,
      maxRetries: options.maxRetries || this.options.maxRetries
    };
    console.log('[MessageHandler] Default handler registered');
  }

  /**
   * Process message
   */
  async processMessage(queueName, message, options = {}) {
    return new Promise((resolve, reject) => {
      this._enqueueMessage({
        queueName,
        message,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
        retryCount: 0
      });
    });
  }

  /**
   * Enqueue message for processing
   * @private
   */
  _enqueueMessage(messageEnvelope) {
    this.waitingMessages.push(messageEnvelope);

    // Update queue metrics
    const queueMetrics = this.metrics.queueMetrics.get(messageEnvelope.queueName) || {
      queueName: messageEnvelope.queueName,
      depth: 0,
      processed: 0
    };
    queueMetrics.depth = this.waitingMessages.filter(m => m.queueName === messageEnvelope.queueName).length;
    this.metrics.queueMetrics.set(messageEnvelope.queueName, queueMetrics);

    this._processNextMessage();
  }

  /**
   * Process next message in queue
   * @private
   */
  _processNextMessage() {
    // Check if we have available workers
    if (this.activeWorkers >= this.options.maxConcurrency) {
      return;
    }

    // Get next message
    if (this.waitingMessages.length === 0) {
      return;
    }

    const messageEnvelope = this.waitingMessages.shift();
    const availableWorker = this.workers.find(w => !w.active);

    if (!availableWorker) {
      // Re-queue message
      this.waitingMessages.unshift(messageEnvelope);
      return;
    }

    // Assign worker to message
    availableWorker.active = true;
    availableWorker.currentMessage = messageEnvelope;
    availableWorker.startTime = Date.now();
    this.activeWorkers++;

    // Process message
    this._executeMessage(availableWorker, messageEnvelope).then(() => {
      // Release worker
      availableWorker.active = false;
      availableWorker.currentMessage = null;
      availableWorker.startTime = null;
      this.activeWorkers--;

      // Update queue metrics
      const queueMetrics = this.metrics.queueMetrics.get(messageEnvelope.queueName);
      if (queueMetrics) {
        queueMetrics.depth = this.waitingMessages.filter(m => m.queueName === messageEnvelope.queueName).length;
      }

      // Process next message
      this._processNextMessage();
    }).catch(error => {
      console.error('[MessageHandler] Error in worker:', error.message);
      availableWorker.active = false;
      this.activeWorkers--;
      this._processNextMessage();
    });
  }

  /**
   * Execute message processing
   * @private
   */
  async _executeMessage(worker, messageEnvelope) {
    const { queueName, message, options, resolve, reject, retryCount } = messageEnvelope;

    try {
      const handler = this.handlers.get(queueName) || this.defaultHandler;

      if (!handler) {
        throw new Error(`No handler registered for queue: ${queueName}`);
      }

      const handlerMetrics = this.metrics.handlerMetrics.get(queueName);

      // Execute with timeout
      const result = await this._executeWithTimeout(
        handler.handler,
        message,
        handler.timeout
      );

      // Record success
      const processingTime = Date.now() - worker.startTime;
      this._recordSuccess(queueName, processingTime);

      if (handlerMetrics) {
        handlerMetrics.succeeded++;
        handlerMetrics.processingTimes.push(processingTime);
        if (handlerMetrics.processingTimes.length > 100) {
          handlerMetrics.processingTimes.shift();
        }
        const sum = handlerMetrics.processingTimes.reduce((a, b) => a + b, 0);
        handlerMetrics.averageTime = sum / handlerMetrics.processingTimes.length;
      }

      worker.processedCount++;

      this.emit('message:processed', {
        queueName,
        messageId: message.message_id,
        result,
        processingTime,
        workerId: worker.id
      });

      resolve({ success: true, result, processingTime });

    } catch (error) {
      const handlerMetrics = this.metrics.handlerMetrics.get(queueName);

      if (error.code === 'TIMEOUT') {
        this.metrics.timedOut++;
        if (handlerMetrics) {
          handlerMetrics.timedOut++;
        }

        this.emit('message:timeout', {
          queueName,
          messageId: message.message_id,
          timeout: this.options.timeout
        });

        reject(error);
      } else if (retryCount < this.options.maxRetries) {
        // Retry
        this.metrics.retried++;
        if (handlerMetrics) {
          handlerMetrics.retried++;
        }

        const delay = this._calculateRetryDelay(retryCount);

        this.emit('message:retrying', {
          queueName,
          messageId: message.message_id,
          attempt: retryCount + 1,
          delay,
          error: error.message
        });

        // Re-queue with delay
        setTimeout(() => {
          this._enqueueMessage({
            ...messageEnvelope,
            retryCount: retryCount + 1,
            timestamp: Date.now()
          });
        }, delay);

      } else {
        // Final failure
        this.metrics.failed++;
        if (handlerMetrics) {
          handlerMetrics.failed++;
        }

        worker.failedCount++;

        this.emit('message:failed', {
          queueName,
          messageId: message.message_id,
          error: error.message,
          retries: retryCount
        });

        reject(error);
      }
    }
  }

  /**
   * Execute handler with timeout
   * @private
   */
  _executeWithTimeout(handlerFunc, message, timeout) {
    return Promise.race([
      handlerFunc(message),
      new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error(`Handler timeout after ${timeout}ms`);
          error.code = 'TIMEOUT';
          reject(error);
        }, timeout);
      })
    ]);
  }

  /**
   * Calculate retry delay with backoff
   * @private
   */
  _calculateRetryDelay(retryCount) {
    if (this.options.retryBackoff === 'exponential') {
      return Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
    }
    return this.options.timeout;
  }

  /**
   * Record successful processing
   * @private
   */
  _recordSuccess(queueName, processingTime) {
    this.metrics.processed++;
    this.metrics.succeeded++;
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.processingTimes.push(processingTime);

    // Keep only last 1000 samples
    if (this.metrics.processingTimes.length > 1000) {
      this.metrics.processingTimes.shift();
    }
  }

  /**
   * Get handler metrics
   */
  getHandlerMetrics(queueName) {
    return this.metrics.handlerMetrics.get(queueName);
  }

  /**
   * Get all handler metrics
   */
  getAllHandlerMetrics() {
    return Object.fromEntries(this.metrics.handlerMetrics);
  }

  /**
   * Get queue metrics
   */
  getQueueMetrics(queueName) {
    return this.metrics.queueMetrics.get(queueName);
  }

  /**
   * Get all queue metrics
   */
  getAllQueueMetrics() {
    return Object.fromEntries(this.metrics.queueMetrics);
  }

  /**
   * Get worker pool status
   */
  getWorkerPoolStatus() {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.activeWorkers,
      waitingMessages: this.waitingMessages.length,
      concurrency: this.options.maxConcurrency,
      workers: this.workers.map(w => ({
        id: w.id,
        active: w.active,
        currentMessage: w.currentMessage ? w.currentMessage.message.message_id : null,
        processedCount: w.processedCount,
        failedCount: w.failedCount
      }))
    };
  }

  /**
   * Get overall metrics
   */
  getMetrics() {
    const avgProcessingTime = this.metrics.processed > 0
      ? (this.metrics.totalProcessingTime / this.metrics.processed).toFixed(2)
      : 0;

    return {
      overall: {
        processed: this.metrics.processed,
        succeeded: this.metrics.succeeded,
        failed: this.metrics.failed,
        retried: this.metrics.retried,
        timedOut: this.metrics.timedOut,
        averageProcessingTime: avgProcessingTime,
        successRate: this.metrics.processed > 0
          ? ((this.metrics.succeeded / this.metrics.processed) * 100).toFixed(2) + '%'
          : '0%'
      },
      workers: this.getWorkerPoolStatus(),
      handlers: this.getAllHandlerMetrics(),
      queues: this.getAllQueueMetrics()
    };
  }

  /**
   * Pause processing
   */
  pause() {
    for (const handler of this.handlers.values()) {
      handler.enabled = false;
    }
    this.emit('paused');
    console.log('[MessageHandler] Processing paused');
  }

  /**
   * Resume processing
   */
  resume() {
    for (const handler of this.handlers.values()) {
      handler.enabled = true;
    }
    this.emit('resumed');
    console.log('[MessageHandler] Processing resumed');
  }

  /**
   * Get handler list
   */
  getHandlers() {
    return Array.from(this.handlers.entries()).map(([queueName, handler]) => ({
      queueName,
      enabled: handler.enabled,
      timeout: handler.timeout,
      maxRetries: handler.maxRetries,
      priority: handler.priority
    }));
  }

  /**
   * Enable/disable handler
   */
  setHandlerEnabled(queueName, enabled) {
    const handler = this.handlers.get(queueName);
    if (handler) {
      handler.enabled = enabled;
      this.emit('handler:toggled', { queueName, enabled });
      return true;
    }
    return false;
  }
}

module.exports = MessageHandler;

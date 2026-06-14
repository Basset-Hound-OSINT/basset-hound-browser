/**
 * Parallel Capture Optimization
 *
 * Provides concurrent capture queuing, load balancing, and performance metrics
 * for efficient multi-screenshot operations.
 */

/**
 * Parallel optimizer configuration
 */
const PARALLEL_OPTIMIZER_CONFIG = {
  maxWorkers: 4,
  maxQueueSize: 100,
  taskTimeout: 60000,
  enableLoadBalancing: true,
  enableMetrics: true,
  workerPoolSize: 2
};

/**
 * Task class representing a capture operation
 */
class CaptureTask {
  constructor(id, spec, priority = 5) {
    this.id = id;
    this.spec = spec;
    this.priority = priority;  // 1-10, higher = more important
    this.createdAt = Date.now();
    this.startedAt = null;
    this.completedAt = null;
    this.status = 'queued';  // queued, running, completed, failed, timeout
    this.result = null;
    this.error = null;
    this.retries = 0;
    this.maxRetries = 3;
    this.attempts = [];
  }

  /**
   * Get task duration
   * @returns {number} Duration in ms
   */
  getDuration() {
    if (this.startedAt && this.completedAt) {
      return this.completedAt - this.startedAt;
    }
    if (this.startedAt) {
      return Date.now() - this.startedAt;
    }
    return 0;
  }

  /**
   * Record execution attempt
   * @param {string} status - Status
   * @param {*} result - Result or error
   */
  recordAttempt(status, result) {
    this.attempts.push({
      timestamp: Date.now(),
      status,
      duration: this.getDuration()
    });

    if (status === 'completed') {
      this.completedAt = Date.now();
      this.result = result;
    } else if (status === 'failed' || status === 'timeout') {
      this.error = result;
      this.retries++;
    }

    this.status = status;
  }

  /**
   * Check if task can be retried
   * @returns {boolean} True if can retry
   */
  canRetry() {
    return this.retries < this.maxRetries && (this.status === 'failed' || this.status === 'timeout');
  }
}

/**
 * ParallelExecutor class for managing concurrent execution
 */
class ParallelExecutor {
  constructor(options = {}) {
    this.options = { ...PARALLEL_OPTIMIZER_CONFIG, ...options };
    this.queue = [];
    this.running = new Set();
    this.completed = new Map();
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      timedOutTasks: 0,
      retriedTasks: 0,
      totalDuration: 0,
      peakConcurrency: 0,
      avgTaskDuration: 0
    };

    this.taskIdCounter = 0;
  }

  /**
   * Add a task to the queue
   * @param {Object} spec - Capture specification
   * @param {number} priority - Task priority (1-10)
   * @returns {CaptureTask} Created task
   */
  addTask(spec, priority = 5) {
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new Error(`Queue full (max: ${this.options.maxQueueSize})`);
    }

    const taskId = `task_${++this.taskIdCounter}`;
    const task = new CaptureTask(taskId, spec, priority);

    this.queue.push(task);
    this.stats.totalTasks++;

    // Sort by priority
    this.queue.sort((a, b) => b.priority - a.priority);

    return task;
  }

  /**
   * Execute tasks concurrently
   * @param {Function} executor - Async function to execute task
   * @param {number} maxConcurrent - Max concurrent operations
   * @returns {Promise<Map>} Results map
   */
  async execute(executor, maxConcurrent = this.options.maxWorkers) {
    const results = new Map();
    const maxConcurrentActual = Math.min(maxConcurrent, this.options.maxWorkers);

    // Process queue
    while (this.queue.length > 0 || this.running.size > 0) {
      // Fill up to maxConcurrent workers
      while (this.queue.length > 0 && this.running.size < maxConcurrentActual) {
        const task = this.queue.shift();
        await this.executeTask(task, executor);
      }

      // Track peak concurrency
      if (this.running.size > this.stats.peakConcurrency) {
        this.stats.peakConcurrency = this.running.size;
      }

      // Wait for at least one task to complete
      if (this.running.size > 0) {
        await Promise.race(Array.from(this.running.values()));
      }
    }

    // Collect results
    for (const task of this.completed.values()) {
      results.set(task.id, {
        status: task.status,
        result: task.result,
        error: task.error,
        duration: task.getDuration(),
        retries: task.retries,
        spec: task.spec
      });
    }

    // Update statistics
    this.updateStats();

    return results;
  }

  /**
   * Execute a single task
   * @param {CaptureTask} task - Task to execute
   * @param {Function} executor - Executor function
   */
  async executeTask(task, executor) {
    task.startedAt = Date.now();
    task.status = 'running';
    this.running.add(task);

    const taskPromise = (async () => {
      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          () => executor(task.spec),
          this.options.taskTimeout
        );

        task.recordAttempt('completed', result);
        this.stats.completedTasks++;
      } catch (error) {
        if (error.message.includes('timeout')) {
          task.recordAttempt('timeout', error.message);
          this.stats.timedOutTasks++;

          // Retry on timeout
          if (task.canRetry()) {
            this.stats.retriedTasks++;
            task.status = 'queued';
            this.queue.unshift(task);  // High priority retry
            return;
          }
        } else {
          task.recordAttempt('failed', error.message);
          this.stats.failedTasks++;

          // Retry on failure
          if (task.canRetry()) {
            this.stats.retriedTasks++;
            task.status = 'queued';
            this.queue.unshift(task);
            return;
          }
        }
      }

      this.running.delete(task);
      this.completed.set(task.id, task);
    })();

    this.running.add(task);
    await taskPromise;
  }

  /**
   * Execute with timeout
   * @param {Function} fn - Async function
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} Promise with timeout
   */
  executeWithTimeout(fn, timeoutMs) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      )
    ]);
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getQueueStatus() {
    return {
      queuedTasks: this.queue.length,
      runningTasks: this.running.size,
      completedTasks: this.completed.size,
      totalTasks: this.stats.totalTasks,
      utilization: this.running.size > 0
        ? (this.running.size / this.options.maxWorkers * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Get next priority tasks
   * @param {number} count - Number of tasks to return
   * @returns {Array} Tasks
   */
  getNextTasks(count = 5) {
    return this.queue.slice(0, count);
  }

  /**
   * Update statistics
   */
  updateStats() {
    if (this.completed.size > 0) {
      const totalDuration = Array.from(this.completed.values())
        .reduce((sum, task) => sum + task.getDuration(), 0);

      this.stats.totalDuration = totalDuration;
      this.stats.avgTaskDuration = totalDuration / this.completed.size;
    }
  }

  /**
   * Get executor statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalTasks > 0
        ? (this.stats.completedTasks / this.stats.totalTasks * 100).toFixed(2)
        : 0,
      failureRate: this.stats.totalTasks > 0
        ? ((this.stats.failedTasks + this.stats.timedOutTasks) / this.stats.totalTasks * 100).toFixed(2)
        : 0,
      retryRate: this.stats.completedTasks + this.stats.failedTasks > 0
        ? (this.stats.retriedTasks / (this.stats.completedTasks + this.stats.failedTasks) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Clear completed tasks
   */
  clearCompleted() {
    this.completed.clear();
  }

  /**
   * Get all tasks
   * @returns {Array} All tasks
   */
  getAllTasks() {
    return [
      ...this.queue,
      ...Array.from(this.running),
      ...Array.from(this.completed.values())
    ];
  }
}

/**
 * LoadBalancer class for optimal task distribution
 */
class LoadBalancer {
  constructor(options = {}) {
    this.options = options;
    this.executors = [];
    this.lastAssigned = 0;
  }

  /**
   * Add executor to pool
   * @param {ParallelExecutor} executor - Executor instance
   */
  addExecutor(executor) {
    this.executors.push(executor);
  }

  /**
   * Get least loaded executor (round-robin with load awareness)
   * @returns {ParallelExecutor} Least loaded executor
   */
  getLeastLoaded() {
    if (this.executors.length === 0) {
      throw new Error('No executors available');
    }

    // Simple round-robin
    const executor = this.executors[this.lastAssigned % this.executors.length];
    this.lastAssigned++;

    return executor;
  }

  /**
   * Distribute task to least loaded executor
   * @param {Object} spec - Task specification
   * @param {number} priority - Task priority
   * @returns {CaptureTask} Created task
   */
  distribuite(spec, priority = 5) {
    const executor = this.getLeastLoaded();
    return executor.addTask(spec, priority);
  }

  /**
   * Get load distribution stats
   * @returns {Object} Load stats
   */
  getLoadStats() {
    const stats = {};

    for (let i = 0; i < this.executors.length; i++) {
      const executor = this.executors[i];
      const status = executor.getQueueStatus();

      stats[`executor_${i}`] = {
        queued: status.queuedTasks,
        running: status.runningTasks,
        completed: status.completedTasks,
        load: (status.runningTasks / (this.options.maxWorkers || 4) * 100).toFixed(2)
      };
    }

    return stats;
  }
}

module.exports = {
  CaptureTask,
  ParallelExecutor,
  LoadBalancer,
  PARALLEL_OPTIMIZER_CONFIG
};

/**
 * Basset Hound Browser - Priority Queue System
 * OPT-10: Priority-based operation queue for reduced P95/P99 latency
 *
 * Implements a priority-based request scheduler with 4 priority levels:
 * - Critical: Screenshot, extraction (P0)
 * - High: Navigation, interaction (P1)
 * - Normal: General commands (P2)
 * - Low: Status, monitoring (P3)
 *
 * Target: 20-40% P95 latency improvement
 */

const EventEmitter = require('events');

/**
 * Priority-based request queue for WebSocket command processing
 * Routes requests to workers based on priority
 */
class PriorityQueue extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxQueueSize: options.maxQueueSize || 10000,
      enableAging: options.enableAging !== false,
      agingThreshold: options.agingThreshold || 30000, // Boost priority after 30s
      fairnessRatio: options.fairnessRatio || 10, // 1 low per 10 critical
      ...options
    };

    // Priority buckets
    this.queues = {
      critical: [],
      high: [],
      normal: [],
      low: []
    };

    // Request tracking
    this.requests = new Map();
    this.requestIdCounter = 0;

    // Statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      priorityBreakdown: {
        critical: 0,
        high: 0,
        normal: 0,
        low: 0
      },
      peakQueueSize: 0,
      lastReset: Date.now()
    };

    // Fairness counter
    this.fairnessCounter = 0;
  }

  /**
   * Enqueue a request with automatic priority assignment
   * @param {Object} request - Request object with command property
   * @returns {Promise<Object>} Request result
   */
  async enqueue(request) {
    const requestId = this.requestIdCounter++;

    // Validate request
    if (!request || typeof request !== 'object') {
      throw new Error('Request must be an object');
    }

    if (!request.command) {
      throw new Error('Request must have a command property');
    }

    // Check queue limits
    const totalSize = Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
    if (totalSize >= this.options.maxQueueSize) {
      this.stats.failedRequests++;
      throw new Error(`Queue full (${this.options.maxQueueSize} max)`);
    }

    // Assign priority
    const priority = this.getCommandPriority(request.command);

    const wrappedRequest = {
      id: requestId,
      priority,
      command: request.command,
      data: request.data || {},
      queuedAt: Date.now(),
      originalRequest: request,
      retries: 0,
      maxRetries: request.maxRetries || 3
    };

    this.stats.totalRequests++;
    this.stats.priorityBreakdown[priority]++;

    // Add to appropriate queue
    this.queues[priority].push(wrappedRequest);

    // Track peak queue size
    const currentSize = Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
    if (currentSize > this.stats.peakQueueSize) {
      this.stats.peakQueueSize = currentSize;
    }

    // Create promise for result
    const promise = new Promise((resolve, reject) => {
      this.requests.set(requestId, {
        request: wrappedRequest,
        resolve,
        reject,
        startTime: Date.now(),
        completionTime: null
      });
    });

    // Emit event for queue changed
    this.emit('request-queued', {
      requestId,
      priority,
      command: request.command,
      queueSize: currentSize
    });

    return promise;
  }

  /**
   * Get next request from queue based on priority
   * @returns {Object|null} Next request or null if empty
   */
  getNextRequest() {
    // Apply fairness: process one low-priority after N critical
    if (this.options.enableAging) {
      this.fairnessCounter++;

      if (this.fairnessCounter % this.options.fairnessRatio === 0 && this.queues.low.length > 0) {
        // Process a low-priority request for fairness
        const request = this.queues.low.shift();
        if (request) {
          return request;
        }
      }
    }

    // Priority-based selection: critical -> high -> normal -> low
    if (this.queues.critical.length > 0) {
      return this.queues.critical.shift();
    }
    if (this.queues.high.length > 0) {
      return this.queues.high.shift();
    }
    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift();
    }
    if (this.queues.low.length > 0) {
      return this.queues.low.shift();
    }

    return null;
  }

  /**
   * Assign priority to a command
   * @param {string} command - Command name
   * @returns {string} Priority level
   */
  getCommandPriority(command) {
    // Critical: Fast, high-value extraction operations
    const criticalCommands = [
      'screenshot', 'screenshot_viewport', 'screenshot_full_page',
      'screenshot_element', 'screenshot_diff',
      'get_content', 'get_html', 'get_text',
      'extract_text', 'extract_html', 'extract_links',
      'extract_images', 'extract_forms', 'extract_metadata',
      'get_page_content', 'get_all_links'
    ];

    // High: Important navigation and interaction
    const highCommands = [
      'navigate', 'click', 'fill', 'submit_form',
      'type', 'set_viewport',
      'wait_for_selector', 'wait_for_navigation'
    ];

    // Low: Status and monitoring
    const lowCommands = [
      'ping', 'list_tabs', 'get_status',
      'get_console_logs', 'get_memory_stats',
      'get_performance_stats', 'list_profiles',
      'get_queue_stats', 'get_priority_stats'
    ];

    if (criticalCommands.includes(command)) {
      return 'critical';
    } else if (lowCommands.includes(command)) {
      return 'low';
    } else if (highCommands.includes(command)) {
      return 'high';
    } else {
      return 'normal';
    }
  }

  /**
   * Complete a request successfully
   * @param {number} requestId - Request ID
   * @param {*} result - Result data
   */
  completeRequest(requestId, result) {
    const req = this.requests.get(requestId);
    if (!req) return;

    const waitTime = req.startTime - req.request.queuedAt;
    const processingTime = Date.now() - req.startTime;

    this.stats.completedRequests++;
    this.stats.totalWaitTime += waitTime;
    this.stats.totalProcessingTime += processingTime;

    req.completionTime = Date.now();

    this.emit('request-completed', {
      requestId,
      priority: req.request.priority,
      command: req.request.command,
      waitTime,
      processingTime
    });

    req.resolve({
      success: true,
      data: result,
      metadata: {
        requestId,
        priority: req.request.priority,
        waitTime,
        processingTime
      }
    });

    this.requests.delete(requestId);
  }

  /**
   * Fail a request
   * @param {number} requestId - Request ID
   * @param {Error} error - Error object
   * @param {boolean} retry - Whether to retry
   */
  failRequest(requestId, error, retry = true) {
    const req = this.requests.get(requestId);
    if (!req) return;

    // Check if we should retry
    if (retry && req.request.retries < req.request.maxRetries) {
      req.request.retries++;
      req.request.queuedAt = Date.now(); // Reset queue time

      // Re-queue the request
      this.queues[req.request.priority].unshift(req.request);

      this.emit('request-retrying', {
        requestId,
        priority: req.request.priority,
        attempt: req.request.retries
      });

      return;
    }

    this.stats.failedRequests++;

    this.emit('request-failed', {
      requestId,
      priority: req.request.priority,
      command: req.request.command,
      error: error.message
    });

    req.reject(error);
    this.requests.delete(requestId);
  }

  /**
   * Get queue statistics
   * @returns {Object} Statistics object
   */
  getStatistics() {
    const avgWaitTime = this.stats.completedRequests > 0
      ? Math.round(this.stats.totalWaitTime / this.stats.completedRequests)
      : 0;

    const avgProcessingTime = this.stats.completedRequests > 0
      ? Math.round(this.stats.totalProcessingTime / this.stats.completedRequests)
      : 0;

    const queueSizes = {
      critical: this.queues.critical.length,
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length
    };

    const totalQueued = Object.values(queueSizes).reduce((a, b) => a + b, 0);

    // Calculate latency percentiles
    const allWaitTimes = [];
    this.requests.forEach(req => {
      allWaitTimes.push(Date.now() - req.request.queuedAt);
    });
    allWaitTimes.sort((a, b) => a - b);

    const p50 = allWaitTimes[Math.floor(allWaitTimes.length * 0.5)];
    const p95 = allWaitTimes[Math.floor(allWaitTimes.length * 0.95)];
    const p99 = allWaitTimes[Math.floor(allWaitTimes.length * 0.99)];

    return {
      queue: {
        total: totalQueued,
        sizes: queueSizes,
        maxSize: this.options.maxQueueSize,
        peakSize: this.stats.peakQueueSize
      },
      requests: {
        total: this.stats.totalRequests,
        completed: this.stats.completedRequests,
        failed: this.stats.failedRequests,
        pending: this.requests.size,
        priorityDistribution: this.stats.priorityBreakdown
      },
      latency: {
        avgWaitTime,
        avgProcessingTime,
        p50: p50 || 0,
        p95: p95 || 0,
        p99: p99 || 0
      },
      performance: {
        throughput: this.stats.completedRequests / ((Date.now() - this.stats.lastReset) / 1000),
        uptime: Date.now() - this.stats.lastReset,
        successRate: this.stats.totalRequests > 0
          ? ((this.stats.completedRequests / this.stats.totalRequests) * 100).toFixed(1) + '%'
          : '0%'
      }
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      totalWaitTime: 0,
      totalProcessingTime: 0,
      priorityBreakdown: {
        critical: 0,
        high: 0,
        normal: 0,
        low: 0
      },
      peakQueueSize: 0,
      lastReset: Date.now()
    };
  }

  /**
   * Clear all queues
   */
  clear() {
    this.queues.critical = [];
    this.queues.high = [];
    this.queues.normal = [];
    this.queues.low = [];
    this.requests.clear();
  }

  /**
   * Get queue size
   * @returns {number} Total items in queue
   */
  size() {
    return Object.values(this.queues).reduce((sum, q) => sum + q.length, 0);
  }

  /**
   * Check if queue is empty
   * @returns {boolean}
   */
  isEmpty() {
    return this.size() === 0;
  }

  /**
   * Get all requests by priority
   * @returns {Object} Grouped requests
   */
  getRequestsByPriority() {
    return {
      critical: this.queues.critical.map(r => ({
        id: r.id,
        command: r.command,
        waitTime: Date.now() - r.queuedAt
      })),
      high: this.queues.high.map(r => ({
        id: r.id,
        command: r.command,
        waitTime: Date.now() - r.queuedAt
      })),
      normal: this.queues.normal.map(r => ({
        id: r.id,
        command: r.command,
        waitTime: Date.now() - r.queuedAt
      })),
      low: this.queues.low.map(r => ({
        id: r.id,
        command: r.command,
        waitTime: Date.now() - r.queuedAt
      }))
    };
  }

  /**
   * Get oldest request in queue
   * @returns {Object|null} Request object
   */
  getOldestRequest() {
    let oldest = null;

    Object.values(this.queues).forEach(queue => {
      if (queue.length > 0) {
        const first = queue[0];
        if (!oldest || first.queuedAt < oldest.queuedAt) {
          oldest = first;
        }
      }
    });

    return oldest;
  }

  /**
   * Boost priority of a request (for priority inversion handling)
   * @param {number} requestId - Request ID
   */
  boostPriority(requestId) {
    const req = this.requests.get(requestId);
    if (!req) return;

    const current = req.request.priority;
    const priorities = ['critical', 'high', 'normal', 'low'];
    const currentIndex = priorities.indexOf(current);

    if (currentIndex > 0) {
      // Remove from current queue
      this.queues[current] = this.queues[current].filter(r => r.id !== requestId);

      // Add to higher priority queue
      const newPriority = priorities[currentIndex - 1];
      req.request.priority = newPriority;
      this.queues[newPriority].unshift(req.request);

      this.emit('request-boosted', {
        requestId,
        fromPriority: current,
        toPriority: newPriority
      });
    }
  }

  /**
   * Get request by ID
   * @param {number} requestId - Request ID
   * @returns {Object|null} Request object
   */
  getRequest(requestId) {
    const req = this.requests.get(requestId);
    return req ? req.request : null;
  }

  /**
   * Drain queue (get all requests)
   * @returns {Array} All queued requests in priority order
   */
  drain() {
    const all = [
      ...this.queues.critical,
      ...this.queues.high,
      ...this.queues.normal,
      ...this.queues.low
    ];

    this.clear();
    return all;
  }
}

module.exports = PriorityQueue;

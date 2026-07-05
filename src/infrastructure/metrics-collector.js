/**
 * Metrics Collector - v12.3.0
 *
 * Collects and aggregates application metrics for monitoring
 * Tracks throughput, latency, errors, memory, and custom application metrics
 *
 * @module src/infrastructure/metrics-collector
 * @version 1.0.0
 */

class MetricsCollector {
  constructor(options = {}) {
    this.options = {
      windowSize: options.windowSize || 60000, // 1 minute window
      enableDetailedMetrics: options.enableDetailedMetrics !== false,
      ...options
    };

    // Core metrics
    this.metrics = {
      timestamp: Date.now(),
      requests: {
        total: 0,
        success: 0,
        error: 0,
        inProgress: 0
      },
      latency: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      throughput: {
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        totalMessages: 0,
        totalBytes: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        percentUsed: 0
      },
      errors: {
        total: 0,
        byType: {},
        recent: []
      },
      connections: {
        active: 0,
        total: 0,
        closed: 0
      },
      custom: {}
    };

    this.windowStartTime = Date.now();
    this.startTime = Date.now();
  }

  /**
   * Record request start
   */
  recordRequestStart(requestId) {
    this.metrics.requests.inProgress++;
    this.metrics.requests.total++;
    return Date.now();
  }

  /**
   * Record request completion
   */
  recordRequestEnd(requestId, startTime, success = true, bytesTransferred = 0) {
    const duration = Date.now() - startTime;

    if (success) {
      this.metrics.requests.success++;
    } else {
      this.metrics.requests.error++;
    }

    this.metrics.requests.inProgress = Math.max(0, this.metrics.requests.inProgress - 1);

    // Update latency metrics
    this.metrics.latency.samples.push(duration);
    if (this.metrics.latency.samples.length > 10000) {
      this.metrics.latency.samples.shift(); // Keep last 10k samples
    }

    this._updateLatencyStats();

    // Update throughput
    this.metrics.throughput.totalMessages++;
    this.metrics.throughput.totalBytes += bytesTransferred;
  }

  /**
   * Record connection event
   */
  recordConnection(connected = true) {
    if (connected) {
      this.metrics.connections.active++;
      this.metrics.connections.total++;
    } else {
      this.metrics.connections.active = Math.max(0, this.metrics.connections.active - 1);
      this.metrics.connections.closed++;
    }
  }

  /**
   * Record error
   */
  recordError(errorType, errorMessage) {
    this.metrics.errors.total++;

    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;

    // Keep last 100 errors
    this.metrics.errors.recent.push({
      type: errorType,
      message: errorMessage,
      timestamp: Date.now()
    });
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent.shift();
    }
  }

  /**
   * Record custom metric
   */
  recordCustomMetric(name, value, type = 'gauge') {
    if (!this.metrics.custom[name]) {
      this.metrics.custom[name] = {
        type,
        value: 0,
        samples: []
      };
    }

    if (type === 'gauge') {
      this.metrics.custom[name].value = value;
    } else if (type === 'counter') {
      this.metrics.custom[name].value += value;
    } else if (type === 'histogram') {
      this.metrics.custom[name].samples.push(value);
      if (this.metrics.custom[name].samples.length > 1000) {
        this.metrics.custom[name].samples.shift();
      }
    }
  }

  /**
   * Update system memory metrics
   */
  updateMemoryMetrics() {
    const memUsage = process.memoryUsage();
    this.metrics.memory.heapUsed = memUsage.heapUsed;
    this.metrics.memory.heapTotal = memUsage.heapTotal;
    this.metrics.memory.external = memUsage.external;
    this.metrics.memory.rss = memUsage.rss;
    this.metrics.memory.percentUsed = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  }

  /**
   * Calculate throughput metrics
   */
  calculateThroughput() {
    const now = Date.now();
    const elapsedSeconds = (now - this.windowStartTime) / 1000;

    if (elapsedSeconds > 0) {
      this.metrics.throughput.messagesPerSecond = this.metrics.throughput.totalMessages / elapsedSeconds;
      this.metrics.throughput.bytesPerSecond = this.metrics.throughput.totalBytes / elapsedSeconds;
    }

    // Reset window if needed
    if (now - this.windowStartTime > this.options.windowSize) {
      this.windowStartTime = now;
      this.metrics.throughput.totalMessages = 0;
      this.metrics.throughput.totalBytes = 0;
    }
  }

  /**
   * Update latency statistics
   * @private
   */
  _updateLatencyStats() {
    if (this.metrics.latency.samples.length === 0) {
      return;
    }

    const sorted = [...this.metrics.latency.samples].sort((a, b) => a - b);
    const len = sorted.length;

    this.metrics.latency.min = sorted[0];
    this.metrics.latency.max = sorted[len - 1];
    this.metrics.latency.avg = sorted.reduce((a, b) => a + b, 0) / len;
    this.metrics.latency.p50 = sorted[Math.floor(len * 0.50)];
    this.metrics.latency.p95 = sorted[Math.floor(len * 0.95)];
    this.metrics.latency.p99 = sorted[Math.floor(len * 0.99)];
  }

  /**
   * Get current metrics snapshot
   */
  getMetrics() {
    this.updateMemoryMetrics();
    this.calculateThroughput();

    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      timestamp: Date.now()
    };
  }

  /**
   * Get metrics for specific category
   */
  getMetricsByCategory(category) {
    const all = this.getMetrics();
    return {
      [category]: all[category],
      timestamp: all.timestamp
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      timestamp: Date.now(),
      requests: {
        total: 0,
        success: 0,
        error: 0,
        inProgress: 0
      },
      latency: {
        min: Infinity,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        samples: []
      },
      throughput: {
        messagesPerSecond: 0,
        bytesPerSecond: 0,
        totalMessages: 0,
        totalBytes: 0
      },
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
        percentUsed: 0
      },
      errors: {
        total: 0,
        byType: {},
        recent: []
      },
      connections: {
        active: 0,
        total: 0,
        closed: 0
      },
      custom: {}
    };
    this.windowStartTime = Date.now();
  }
}

module.exports = MetricsCollector;

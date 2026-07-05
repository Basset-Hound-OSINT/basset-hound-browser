/**
 * MetricsAggregator - Time-series aggregation and trend analysis
 *
 * Aggregates raw metrics into time windows (1m, 5m, 1h) and
 * provides trend analysis and historical data query capabilities.
 */
class MetricsAggregator {
  constructor(options = {}) {
    this.windowConfigs = {
      '1m': 60000,
      '5m': 300000,
      '1h': 3600000
    };

    // Time-series storage with ring buffers
    this.timeSeries = {
      '1m': new RingBuffer(1440), // 24 hours of 1-minute snapshots
      '5m': new RingBuffer(288), // 24 hours of 5-minute snapshots
      '1h': new RingBuffer(168) // 7 days of 1-hour snapshots
    };

    // Trend analysis tracking
    this.trendAnalysis = {
      '1m': { latency: 'stable', throughput: 'stable', errorRate: 'stable' },
      '5m': { latency: 'stable', throughput: 'stable', errorRate: 'stable' },
      '1h': { latency: 'stable', throughput: 'stable', errorRate: 'stable' }
    };

    // Historical values for trend detection
    this.historicalValues = {
      '1m': [],
      '5m': [],
      '1h': []
    };

    // Configuration options
    this.maxHistoricalValues = options.maxHistoricalValues || 10;
    this.trendThreshold = options.trendThreshold || 0.1; // 10% change threshold

    // Window tracking
    this.currentWindow = {
      '1m': Math.floor(Date.now() / 60000) * 60000,
      '5m': Math.floor(Date.now() / 300000) * 300000,
      '1h': Math.floor(Date.now() / 3600000) * 3600000
    };
  }

  /**
   * Aggregate metrics for a specific time window
   * @param {Object} metrics - Raw metrics from MetricsCollector
   * @param {string} window - Time window ('1m', '5m', '1h')
   * @returns {Object} Aggregated metrics snapshot
   */
  aggregate(metrics, window = '1m') {
    if (!this.windowConfigs[window]) {
      throw new Error(`Invalid window: ${window}`);
    }

    const aggregated = {
      timestamp: Date.now(),
      window,
      startTime: this.currentWindow[window],
      endTime: this.currentWindow[window] + this.windowConfigs[window],
      metrics: this._aggregateMetrics(metrics),
      trends: this.trendAnalysis[window]
    };

    // Store in time-series
    this.timeSeries[window].push(aggregated);

    // Update historical values for trend detection
    this.historicalValues[window].push(aggregated.metrics);
    if (this.historicalValues[window].length > this.maxHistoricalValues) {
      this.historicalValues[window].shift();
    }

    // Recalculate trends
    this._updateTrends(window);

    return aggregated;
  }

  /**
   * Aggregate raw metrics into summary statistics
   * @private
   */
  _aggregateMetrics(metrics) {
    return {
      command: {
        totalCount: metrics.commands.total,
        successCount: metrics.commands.success,
        failureCount: metrics.commands.failure,
        activeCount: metrics.commands.activeCount,
        latency: {
          p50: metrics.commands.latency.p50,
          p95: metrics.commands.latency.p95,
          p99: metrics.commands.latency.p99,
          avg: metrics.commands.latency.avg,
          min: metrics.commands.latency.min,
          max: metrics.commands.latency.max
        },
        successRate: metrics.commands.total > 0
          ? (metrics.commands.success / metrics.commands.total * 100)
          : 0
      },

      throughput: {
        messagesPerSecond: metrics.throughput.messagesPerSecond,
        bytesPerSecond: metrics.throughput.bytesPerSecond,
        totalMessages: metrics.throughput.totalMessages,
        totalBytes: metrics.throughput.totalBytes
      },

      sessions: {
        activeCount: metrics.sessions.active,
        totalCount: metrics.sessions.total,
        closedCount: metrics.sessions.closed,
        avgDuration: metrics.sessions.avgDuration,
        avgCommandsPerSession: metrics.sessions.avgCommandsPerSession
      },

      errors: {
        totalCount: metrics.errors.total,
        errorRate: metrics.errors.rate,
        topErrors: this._getTopErrors(metrics.errors.byType, 3)
      },

      resources: {
        memory: {
          heapUsed: metrics.resources.memory.heapUsed,
          heapTotal: metrics.resources.memory.heapTotal,
          percentUsed: metrics.resources.memory.percentUsed,
          growthRate: metrics.resources.memory.growthRate
        },
        cpu: {
          usage: metrics.resources.cpu.usage,
          avgUsage: metrics.resources.cpu.avgUsage
        },
        connections: {
          websocket: metrics.resources.connections.websocket,
          fileDescriptors: metrics.resources.connections.fileDescriptors
        }
      }
    };
  }

  /**
   * Get top N errors by count
   * @private
   */
  _getTopErrors(errorsByType, limit = 3) {
    return Object.entries(errorsByType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Update trend indicators for a window
   * @private
   */
  _updateTrends(window) {
    const history = this.historicalValues[window];

    if (history.length < 2) {
      return;
    }

    const currentMetrics = history[history.length - 1];
    const previousMetrics = history[history.length - 2];

    // Analyze latency trend
    const latencyTrend = this._calculateTrend(
      previousMetrics.command.latency.p95,
      currentMetrics.command.latency.p95
    );

    // Analyze throughput trend
    const throughputTrend = this._calculateTrend(
      previousMetrics.throughput.messagesPerSecond,
      currentMetrics.throughput.messagesPerSecond
    );

    // Analyze error rate trend
    const errorRateTrend = this._calculateTrend(
      previousMetrics.errors.errorRate,
      currentMetrics.errors.errorRate
    );

    this.trendAnalysis[window] = {
      latency: latencyTrend,
      throughput: throughputTrend,
      errorRate: errorRateTrend
    };
  }

  /**
   * Calculate trend direction between two values
   * Returns 'up', 'down', or 'stable'
   * @private
   */
  _calculateTrend(previousValue, currentValue) {
    if (previousValue === 0 && currentValue === 0) {
      return 'stable';
    }

    if (previousValue === 0) {
      return currentValue > 0 ? 'up' : 'stable';
    }

    // For small numbers, use absolute difference
    if (previousValue < 1) {
      if (Math.abs(currentValue - previousValue) > 0.1) {
        return currentValue > previousValue ? 'up' : 'down';
      }
      return 'stable';
    }

    const percentChange = Math.abs(currentValue - previousValue) / previousValue;

    if (percentChange < this.trendThreshold) {
      return 'stable';
    }

    return currentValue > previousValue ? 'up' : 'down';
  }

  /**
   * Query metrics within a time range
   * @param {string} window - Time window granularity ('1m', '5m', '1h')
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Array} Array of aggregated metrics within range
   */
  queryTimeRange(window, startTime, endTime) {
    if (!this.timeSeries[window]) {
      return [];
    }

    const snapshots = this.timeSeries[window].toArray();
    return snapshots.filter(snap =>
      snap.timestamp >= startTime && snap.timestamp <= endTime
    );
  }

  /**
   * Get latest snapshots for all windows
   * @returns {Object} Latest snapshots by window
   */
  getLatestSnapshots() {
    const latest = {};

    for (const [window, buffer] of Object.entries(this.timeSeries)) {
      const snapshots = buffer.toArray();
      if (snapshots.length > 0) {
        latest[window] = snapshots[snapshots.length - 1];
      }
    }

    return latest;
  }

  /**
   * Get trend analysis for a window
   * @param {string} window - Time window ('1m', '5m', '1h')
   * @returns {Object} Trend indicators
   */
  getTrendAnalysis(window) {
    return this.trendAnalysis[window] || {};
  }

  /**
   * Get all available historical data
   * @returns {Object} All time-series data by window
   */
  getAllHistoricalData() {
    const data = {};

    for (const [window, buffer] of Object.entries(this.timeSeries)) {
      data[window] = buffer.toArray();
    }

    return data;
  }
}

/**
 * RingBuffer - Fixed-size circular buffer for efficient memory usage
 */
class RingBuffer {
  constructor(size) {
    this.buffer = new Array(size);
    this.size = size;
    this.head = 0;
    this.count = 0;
  }

  /**
   * Add item to buffer (oldest item is overwritten if full)
   */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  /**
   * Get all items in chronological order
   * @returns {Array} Array of all items
   */
  toArray() {
    const result = [];

    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.size) % this.size;
      result.push(this.buffer[index]);
    }

    return result;
  }

  /**
   * Get last N items
   * @param {number} n - Number of items to retrieve
   * @returns {Array} Last N items
   */
  getLast(n) {
    return this.toArray().slice(-n);
  }

  /**
   * Get most recent item
   * @returns {*} Most recent item or undefined
   */
  getLatest() {
    if (this.count === 0) {
      return undefined;
    }
    const index = (this.head - 1 + this.size) % this.size;
    return this.buffer[index];
  }

  /**
   * Clear buffer
   */
  clear() {
    this.buffer = new Array(this.size);
    this.head = 0;
    this.count = 0;
  }
}

module.exports = { MetricsAggregator, RingBuffer };

/**
 * MetricsStore - Persistent storage of historical metrics
 *
 * Uses ring buffers for efficient in-memory storage with automatic
 * retention policy enforcement. Supports querying by time range and
 * granularity level.
 */
class MetricsStore {
  constructor(options = {}) {
    // Retention policy
    this.maxRetentionMs = options.maxRetentionMs || 72 * 3600000; // 72 hours default

    // Ring buffers for different granularities
    // 1440 = 60 minutes * 24 hours (1-minute snapshots for 24 hours)
    this.oneMinute = new RingBuffer(1440);

    // 288 = 12 snapshots/hour * 24 hours (5-minute snapshots for 24 hours)
    this.fiveMinute = new RingBuffer(288);

    // 168 = 24 snapshots/day * 7 days (1-hour snapshots for 7 days)
    this.oneHour = new RingBuffer(168);

    // Snapshot metadata for cleanup
    this.snapshotTimestamps = [];
    this.maxSnapshots = options.maxSnapshots || 4320; // ~72 hours of 1-minute snapshots

    // Statistics tracking
    this.stats = {
      totalSnapshots: 0,
      totalQueries: 0,
      averageRetentionSize: 0
    };
  }

  /**
   * Add a metrics snapshot
   * @param {Object} metrics - Metrics snapshot to store
   * @param {Object} aggregated - Aggregated metrics (optional, for ready access)
   */
  addSnapshot(metrics, aggregated = null) {
    const now = Date.now();

    // Create snapshot entry
    const snapshot = {
      timestamp: now,
      metrics,
      aggregated: aggregated || this._createMinimalAggregation(metrics)
    };

    // Add to 1-minute buffer
    this.oneMinute.push(snapshot);

    // Track for cleanup
    this.snapshotTimestamps.push(now);
    if (this.snapshotTimestamps.length > this.maxSnapshots) {
      this.snapshotTimestamps.shift();
    }

    // Add to 5-minute buffer if 5 minutes have passed
    const fiveMinuteWindow = Math.floor(now / 300000);
    if (!this.lastFiveMinuteWindow || fiveMinuteWindow !== this.lastFiveMinuteWindow) {
      this.fiveMinute.push(snapshot);
      this.lastFiveMinuteWindow = fiveMinuteWindow;
    }

    // Add to 1-hour buffer if 1 hour has passed
    const oneHourWindow = Math.floor(now / 3600000);
    if (!this.lastOneHourWindow || oneHourWindow !== this.lastOneHourWindow) {
      this.oneHour.push(snapshot);
      this.lastOneHourWindow = oneHourWindow;
    }

    this.stats.totalSnapshots++;
  }

  /**
   * Create minimal aggregation from metrics
   * @private
   */
  _createMinimalAggregation(metrics) {
    return {
      timestamp: metrics.timestamp,
      latencyP99: metrics.commands?.latency?.p99 || 0,
      errorRate: metrics.errors?.rate || 0,
      messagesPerSecond: metrics.throughput?.messagesPerSecond || 0,
      activeConnections: metrics.connections?.active || 0,
      memoryHeapUsed: metrics.resources?.memory?.heapUsed || 0,
      cpuUsage: metrics.resources?.cpu?.usage || 0
    };
  }

  /**
   * Query metrics by time range
   * @param {number} startTime - Start timestamp (milliseconds)
   * @param {number} endTime - End timestamp (milliseconds)
   * @param {string} granularity - Granularity: '1m', '5m', or '1h'
   * @returns {Array} Array of snapshots within range
   */
  queryRange(startTime, endTime, granularity = '1m') {
    // Select appropriate buffer
    let buffer;
    switch (granularity) {
      case '5m':
        buffer = this.fiveMinute;
        break;
      case '1h':
        buffer = this.oneHour;
        break;
      case '1m':
      default:
        buffer = this.oneMinute;
    }

    // Get all snapshots from buffer
    const allSnapshots = buffer.toArray();

    // Filter by time range
    const filtered = allSnapshots.filter(snap =>
      snap.timestamp >= startTime && snap.timestamp <= endTime
    );

    this.stats.totalQueries++;
    return filtered;
  }

  /**
   * Get latest snapshot
   * @returns {Object} Most recent metrics snapshot
   */
  getLatest() {
    const latest = this.oneMinute.getLatest();
    return latest || null;
  }

  /**
   * Get last N snapshots
   * @param {number} n - Number of snapshots to retrieve
   * @param {string} granularity - Granularity: '1m', '5m', or '1h'
   * @returns {Array} Last N snapshots
   */
  getLastN(n, granularity = '1m') {
    let buffer;
    switch (granularity) {
      case '5m':
        buffer = this.fiveMinute;
        break;
      case '1h':
        buffer = this.oneHour;
        break;
      case '1m':
      default:
        buffer = this.oneMinute;
    }

    return buffer.getLast(n);
  }

  /**
   * Get snapshots for the last X hours
   * @param {number} hours - Number of hours to look back
   * @param {string} granularity - Granularity: '1m', '5m', or '1h'
   * @returns {Array} Snapshots from the past X hours
   */
  getLastHours(hours, granularity = '1m') {
    const now = Date.now();
    const startTime = now - (hours * 3600000);
    return this.queryRange(startTime, now, granularity);
  }

  /**
   * Get memory footprint estimate
   * @returns {Object} Estimated storage size breakdown
   */
  getMemoryFootprint() {
    return {
      oneMinuteSnapshots: this.oneMinute.count,
      fiveMinuteSnapshots: this.fiveMinute.count,
      oneHourSnapshots: this.oneHour.count,
      totalSnapshots: this.stats.totalSnapshots,
      estimatedMbUsage: (this.oneMinute.count * 2) / 1024 // Rough estimate: ~2KB per snapshot
    };
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage and query statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      memoryFootprint: this.getMemoryFootprint(),
      retention: {
        maxRetentionMs: this.maxRetentionMs,
        hoursRetained: Math.round(this.maxRetentionMs / 3600000)
      }
    };
  }

  /**
   * Cleanup old snapshots based on retention policy
   * @returns {number} Number of snapshots removed
   */
  cleanup() {
    const now = Date.now();
    const cutoffTime = now - this.maxRetentionMs;

    // Clean up timestamp tracking
    const originalCount = this.snapshotTimestamps.length;
    this.snapshotTimestamps = this.snapshotTimestamps.filter(ts => ts > cutoffTime);
    const removed = originalCount - this.snapshotTimestamps.length;

    return removed;
  }

  /**
   * Export all stored metrics as JSON
   * @returns {Object} All metrics organized by granularity
   */
  exportAll() {
    return {
      exported: new Date().toISOString(),
      retention: {
        maxRetentionMs: this.maxRetentionMs,
        hoursRetained: Math.round(this.maxRetentionMs / 3600000)
      },
      data: {
        oneMinute: this.oneMinute.toArray(),
        fiveMinute: this.fiveMinute.toArray(),
        oneHour: this.oneHour.toArray()
      },
      stats: this.getStatistics()
    };
  }

  /**
   * Clear all stored data
   */
  clear() {
    this.oneMinute.clear();
    this.fiveMinute.clear();
    this.oneHour.clear();
    this.snapshotTimestamps = [];
    this.lastFiveMinuteWindow = null;
    this.lastOneHourWindow = null;
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
   * Add item to buffer (overwrites oldest if full)
   */
  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.size;
    this.count = Math.min(this.count + 1, this.size);
  }

  /**
   * Get all items in chronological order
   * @returns {Array} All items in order
   */
  toArray() {
    const result = [];

    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.size) % this.size;
      if (this.buffer[index] !== undefined) {
        result.push(this.buffer[index]);
      }
    }

    return result;
  }

  /**
   * Get last N items
   * @param {number} n - Number of items
   * @returns {Array} Last N items in chronological order
   */
  getLast(n) {
    const arr = this.toArray();
    return arr.slice(Math.max(0, arr.length - n));
  }

  /**
   * Get most recent item
   * @returns {*} Latest item or undefined
   */
  getLatest() {
    if (this.count === 0) return undefined;
    const index = (this.head - 1 + this.size) % this.size;
    return this.buffer[index];
  }

  /**
   * Get item at index (0 = oldest in buffer)
   * @param {number} index - Index from oldest to newest
   * @returns {*} Item at index or undefined
   */
  getAt(index) {
    if (index < 0 || index >= this.count) return undefined;
    const actualIndex = (this.head - this.count + index + this.size) % this.size;
    return this.buffer[actualIndex];
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

module.exports = { MetricsStore, RingBuffer };

/**
 * Analytics Store
 * Time-series data storage with aggregations and retention policies
 */

const EventEmitter = require('events');

class AnalyticsStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.store = new Map(); // Series name -> data points
    this.aggregations = new Map(); // Series -> aggregation config
    this.retentionPolicies = new Map(); // Series -> retention config
    this.metrics = {
      pointsStored: 0,
      aggregationsComputed: 0,
      dataCleanups: 0,
    };
    this.cleanupInterval = options.cleanupInterval || 3600000; // 1 hour
    this.defaultRetention = options.defaultRetention || 30 * 24 * 60 * 60 * 1000; // 30 days

    // Start cleanup job
    this._startCleanupJob();
  }

  /**
   * Record a data point
   */
  record(seriesName, value, options = {}) {
    const { timestamp = Date.now(), tags = {} } = options;

    if (!this.store.has(seriesName)) {
      this.store.set(seriesName, []);
    }

    const point = {
      timestamp,
      value,
      tags,
    };

    this.store.get(seriesName).push(point);
    this.metrics.pointsStored++;

    this.emit('point_recorded', { seriesName, timestamp, value });
    return point;
  }

  /**
   * Record multiple points
   */
  recordBatch(seriesName, points) {
    const results = [];
    for (const { value, timestamp, tags } of points) {
      const point = this.record(seriesName, value, { timestamp, tags });
      results.push(point);
    }
    return results;
  }

  /**
   * Query time-range data
   */
  query(seriesName, startTime, endTime, options = {}) {
    const { aggregate = null } = options;

    if (!this.store.has(seriesName)) {
      return [];
    }

    const data = this.store.get(seriesName);
    const filtered = data.filter((p) => p.timestamp >= startTime && p.timestamp <= endTime);

    if (aggregate) {
      return this._aggregate(filtered, aggregate);
    }

    return filtered;
  }

  /**
   * Get aggregate statistics for a time range
   */
  async getStats(seriesName, startTime, endTime) {
    const data = this.query(seriesName, startTime, endTime);

    if (data.length === 0) {
      return null;
    }

    const values = data.map((p) => p.value);
    const sorted = values.sort((a, b) => a - b);

    return {
      count: values.length,
      sum: values.reduce((a, b) => a + b, 0),
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  /**
   * Configure aggregation for a series
   */
  configureAggregation(seriesName, config) {
    const {
      intervals = ['hourly', 'daily', 'weekly'],
      retentionDays = 365,
    } = config;

    this.aggregations.set(seriesName, {
      intervals,
      retentionDays,
      lastAggregation: Date.now(),
    });

    this.emit('aggregation_configured', { seriesName });
  }

  /**
   * Get hourly aggregates
   */
  getHourlyAggregates(seriesName, startTime, endTime) {
    return this._getAggregates(seriesName, startTime, endTime, 3600000);
  }

  /**
   * Get daily aggregates
   */
  getDailyAggregates(seriesName, startTime, endTime) {
    return this._getAggregates(seriesName, startTime, endTime, 86400000);
  }

  /**
   * Get weekly aggregates
   */
  getWeeklyAggregates(seriesName, startTime, endTime) {
    return this._getAggregates(seriesName, startTime, endTime, 604800000);
  }

  /**
   * Configure retention policy
   */
  setRetentionPolicy(seriesName, options = {}) {
    const {
      retentionDays = 30,
      aggregateAfterDays = 7,
      deleteAggregatesAfterDays = null,
    } = options;

    this.retentionPolicies.set(seriesName, {
      retentionDays,
      aggregateAfterDays,
      deleteAggregatesAfterDays,
    });

    this.emit('retention_policy_set', { seriesName });
  }

  /**
   * Clean up old data based on retention policies
   */
  async cleanup() {
    let cleanedPoints = 0;

    for (const [seriesName, policy] of this.retentionPolicies.entries()) {
      if (!this.store.has(seriesName)) continue;

      const data = this.store.get(seriesName);
      const now = Date.now();
      const cutoffTime = now - policy.retentionDays * 24 * 60 * 60 * 1000;

      // Remove old points
      const initialLength = data.length;
      const filtered = data.filter((p) => p.timestamp > cutoffTime);
      this.store.set(seriesName, filtered);

      cleanedPoints += initialLength - filtered.length;
    }

    this.metrics.dataCleanups++;
    this.emit('cleanup_completed', { cleanedPoints });
    return cleanedPoints;
  }

  /**
   * Export data
   */
  exportData(seriesName, format = 'json') {
    if (!this.store.has(seriesName)) {
      throw new Error(`Series not found: ${seriesName}`);
    }

    const data = this.store.get(seriesName);

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this._exportCSV(data);
    } else if (format === 'ndjson') {
      return data.map((p) => JSON.stringify(p)).join('\n');
    }

    throw new Error(`Unknown format: ${format}`);
  }

  /**
   * Import data
   */
  importData(seriesName, data, format = 'json') {
    let points = [];

    if (format === 'json') {
      points = typeof data === 'string' ? JSON.parse(data) : data;
    } else if (format === 'csv') {
      points = this._importCSV(data);
    } else if (format === 'ndjson') {
      points = data
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line));
    }

    this.recordBatch(seriesName, points);
    this.emit('data_imported', { seriesName, pointCount: points.length });
    return points.length;
  }

  /**
   * Get all series names
   */
  getSeries() {
    return Array.from(this.store.keys());
  }

  /**
   * Get series metadata
   */
  getSeriesMetadata(seriesName) {
    if (!this.store.has(seriesName)) return null;

    const data = this.store.get(seriesName);
    const timestamps = data.map((p) => p.timestamp).sort((a, b) => a - b);

    return {
      name: seriesName,
      pointCount: data.length,
      firstTimestamp: timestamps[0],
      lastTimestamp: timestamps[timestamps.length - 1],
      aggregationConfig: this.aggregations.get(seriesName) || null,
      retentionPolicy: this.retentionPolicies.get(seriesName) || null,
    };
  }

  /**
   * Get store statistics
   */
  getMetrics() {
    return {
      ...this.metrics,
      seriesCount: this.store.size,
      totalPoints: Array.from(this.store.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }

  // ==================== Private Methods ====================

  _aggregate(points, aggregationType) {
    if (aggregationType === 'sum') {
      return points.reduce((sum, p) => sum + p.value, 0);
    } else if (aggregationType === 'avg') {
      if (points.length === 0) return 0;
      return points.reduce((sum, p) => sum + p.value, 0) / points.length;
    } else if (aggregationType === 'min') {
      return Math.min(...points.map((p) => p.value));
    } else if (aggregationType === 'max') {
      return Math.max(...points.map((p) => p.value));
    } else if (aggregationType === 'count') {
      return points.length;
    }
    return null;
  }

  _getAggregates(seriesName, startTime, endTime, interval) {
    const data = this.query(seriesName, startTime, endTime);
    const aggregates = [];

    for (let time = startTime; time < endTime; time += interval) {
      const bucketEnd = time + interval;
      const bucketPoints = data.filter((p) => p.timestamp >= time && p.timestamp < bucketEnd);

      if (bucketPoints.length > 0) {
        const values = bucketPoints.map((p) => p.value);
        aggregates.push({
          timestamp: time,
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
        });
      }
    }

    return aggregates;
  }

  _exportCSV(data) {
    if (data.length === 0) return 'timestamp,value\n';

    const lines = ['timestamp,value'];
    for (const point of data) {
      lines.push(`${point.timestamp},${point.value}`);
    }
    return lines.join('\n');
  }

  _importCSV(csvData) {
    const lines = csvData.trim().split('\n');
    const points = [];

    for (let i = 1; i < lines.length; i++) {
      const [timestamp, value] = lines[i].split(',');
      points.push({
        timestamp: parseInt(timestamp, 10),
        value: parseFloat(value),
      });
    }

    return points;
  }

  _startCleanupJob() {
    setInterval(() => {
      this.cleanup().catch((err) => {
        this.emit('error', { type: 'cleanup_error', error: err.message });
      });
    }, this.cleanupInterval);
  }
}

module.exports = AnalyticsStore;

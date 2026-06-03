/**
 * Dashboard Data Aggregator - Consolidates data from 50+ monitors
 *
 * Handles:
 * - Aggregation of changes from multiple monitors
 * - Grouping by date, category, competitor, severity
 * - 5-minute caching for performance
 * - Statistical calculations and trend analysis
 *
 * @module src/dashboard/aggregator
 */

const EventEmitter = require('events');

/**
 * Aggregation scopes
 */
const AGGREGATION_SCOPES = {
  GLOBAL: 'global',
  CATEGORY: 'category',
  MONITOR: 'monitor',
  TIME_BUCKET: 'time_bucket'
};

/**
 * Time bucket sizes
 */
const TIME_BUCKETS = {
  HOURLY: 3600000,
  DAILY: 24 * 3600000,
  WEEKLY: 7 * 24 * 3600000
};

/**
 * Data Aggregator Class
 * Aggregates changes from multiple monitors with intelligent caching
 */
class DataAggregator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      cacheTtl: options.cacheTtl || 5 * 60 * 1000, // 5 minutes
      maxCacheSize: options.maxCacheSize || 100,
      maxMonitors: options.maxMonitors || 50,
      ...options
    };

    // Cache management
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.cacheHits = 0;
    this.cacheMisses = 0;

    // Aggregation state
    this.lastAggregationTime = null;
    this.aggregationInProgress = false;
    this.monitorData = new Map(); // monitorId -> changes array
    this.categoryIndex = new Map(); // category -> changes
    this.timeIndex = new Map(); // bucket -> changes
  }

  /**
   * Index monitor changes for fast aggregation
   * @param {string} monitorId - Monitor identifier
   * @param {Array} changes - Array of changes
   * @returns {void}
   */
  indexMonitorChanges(monitorId, changes) {
    if (!Array.isArray(changes)) {
      throw new Error('Changes must be an array');
    }

    // Store original changes
    this.monitorData.set(monitorId, changes);

    // Index by category
    for (const change of changes) {
      const category = change.category || 'unknown';
      if (!this.categoryIndex.has(category)) {
        this.categoryIndex.set(category, []);
      }
      this.categoryIndex.get(category).push({
        ...change,
        monitorId,
        indexed: true
      });
    }

    // Index by time bucket
    for (const change of changes) {
      const bucket = this.getTimeBucket(change.timestamp || Date.now());
      if (!this.timeIndex.has(bucket)) {
        this.timeIndex.set(bucket, []);
      }
      this.timeIndex.get(bucket).push({
        ...change,
        monitorId,
        indexed: true
      });
    }

    // Invalidate cache on new data
    this.invalidateCache();
  }

  /**
   * Get time bucket key for a timestamp
   * @param {number} timestamp - Unix timestamp
   * @param {string} bucketSize - Bucket size (hourly, daily, weekly)
   * @returns {string} Bucket key
   */
  getTimeBucket(timestamp, bucketSize = 'daily') {
    const bucketMs = TIME_BUCKETS[bucketSize.toUpperCase()] || TIME_BUCKETS.DAILY;
    const bucketTime = Math.floor(timestamp / bucketMs) * bucketMs;
    return `${bucketSize}_${bucketTime}`;
  }

  /**
   * Aggregate changes by category
   * @param {Object} options - Aggregation options
   * @returns {Object} Aggregated data by category
   */
  aggregateByCategory(options = {}) {
    const cacheKey = `category_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    const result = {
      scope: AGGREGATION_SCOPES.CATEGORY,
      timestamp: Date.now(),
      categories: {},
      summary: {
        totalChanges: 0,
        uniqueCategories: 0,
        averagePerCategory: 0
      }
    };

    const {
      limit = 1000,
      includeStats = true
    } = options;

    for (const [category, changes] of this.categoryIndex) {
      const categoryChanges = changes.slice(0, limit);

      result.categories[category] = {
        name: category,
        count: categoryChanges.length,
        changes: categoryChanges,
        monitors: [...new Set(categoryChanges.map(c => c.monitorId))],
        stats: includeStats ? this.calculateStats(categoryChanges) : null
      };

      result.summary.totalChanges += categoryChanges.length;
      result.summary.uniqueCategories++;
    }

    if (result.summary.uniqueCategories > 0) {
      result.summary.averagePerCategory =
        (result.summary.totalChanges / result.summary.uniqueCategories).toFixed(2);
    }

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * Aggregate changes by monitor
   * @param {Array<string>} monitorIds - Monitor IDs to aggregate
   * @param {Object} options - Aggregation options
   * @returns {Object} Aggregated data by monitor
   */
  aggregateByMonitor(monitorIds, options = {}) {
    const cacheKey = `monitor_${monitorIds.sort().join(',')}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    const result = {
      scope: AGGREGATION_SCOPES.MONITOR,
      timestamp: Date.now(),
      monitors: {},
      summary: {
        totalChanges: 0,
        activeMonitors: 0,
        averageChangesPerMonitor: 0
      }
    };

    const {
      limit = 100,
      includeStats = true
    } = options;

    for (const monitorId of monitorIds) {
      const changes = this.monitorData.get(monitorId) || [];
      const monitorChanges = changes.slice(0, limit);

      if (monitorChanges.length > 0) {
        result.summary.activeMonitors++;
      }

      result.monitors[monitorId] = {
        monitorId,
        count: monitorChanges.length,
        changes: monitorChanges,
        categories: [...new Set(monitorChanges.map(c => c.category || 'unknown'))],
        stats: includeStats ? this.calculateStats(monitorChanges) : null
      };

      result.summary.totalChanges += monitorChanges.length;
    }

    if (result.summary.activeMonitors > 0) {
      result.summary.averageChangesPerMonitor =
        (result.summary.totalChanges / result.summary.activeMonitors).toFixed(2);
    }

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * Aggregate changes by time bucket
   * @param {string} bucketSize - Bucket size (hourly, daily, weekly)
   * @param {Object} options - Aggregation options
   * @returns {Object} Aggregated data by time bucket
   */
  aggregateByTime(bucketSize = 'daily', options = {}) {
    const cacheKey = `time_${bucketSize}_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    const result = {
      scope: AGGREGATION_SCOPES.TIME_BUCKET,
      bucketSize,
      timestamp: Date.now(),
      buckets: {},
      summary: {
        totalChanges: 0,
        activeBuckets: 0,
        averagePerBucket: 0
      }
    };

    const {
      limit = 500,
      includeStats = true
    } = options;

    // Group by bucket size
    const buckets = new Map();
    for (const [timeKey, changes] of this.timeIndex) {
      if (timeKey.startsWith(bucketSize.toLowerCase())) {
        if (!buckets.has(timeKey)) {
          buckets.set(timeKey, []);
        }
        buckets.get(timeKey).push(...changes);
      }
    }

    // Process buckets
    for (const [bucketKey, changes] of buckets) {
      const bucketChanges = changes.slice(0, limit);

      if (bucketChanges.length > 0) {
        result.summary.activeBuckets++;
      }

      result.buckets[bucketKey] = {
        key: bucketKey,
        count: bucketChanges.length,
        changes: bucketChanges,
        monitors: [...new Set(bucketChanges.map(c => c.monitorId))],
        stats: includeStats ? this.calculateStats(bucketChanges) : null
      };

      result.summary.totalChanges += bucketChanges.length;
    }

    if (result.summary.activeBuckets > 0) {
      result.summary.averagePerBucket =
        (result.summary.totalChanges / result.summary.activeBuckets).toFixed(2);
    }

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * Aggregate changes by severity
   * @param {Object} options - Aggregation options
   * @returns {Object} Aggregated data by severity
   */
  aggregateBySeverity(options = {}) {
    const cacheKey = `severity_${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached;
    }
    this.cacheMisses++;

    const result = {
      scope: 'severity',
      timestamp: Date.now(),
      severities: {
        critical: { count: 0, changes: [] },
        high: { count: 0, changes: [] },
        medium: { count: 0, changes: [] },
        low: { count: 0, changes: [] }
      },
      summary: {
        totalChanges: 0
      }
    };

    const { limit = 500 } = options;

    // Collect all changes
    const allChanges = [];
    for (const changes of this.monitorData.values()) {
      allChanges.push(...changes);
    }

    // Group by severity
    for (const change of allChanges) {
      const severity = change.severity || 'medium';
      if (result.severities[severity]) {
        if (result.severities[severity].changes.length < limit) {
          result.severities[severity].changes.push(change);
          result.severities[severity].count++;
          result.summary.totalChanges++;
        }
      }
    }

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * Calculate statistics for a set of changes
   * @param {Array} changes - Changes array
   * @returns {Object} Statistical summary
   */
  calculateStats(changes) {
    if (!changes || changes.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0
      };
    }

    const values = changes.map(c => c.timestamp || Date.now());
    const sorted = values.sort((a, b) => a - b);

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const sum = sorted.reduce((a, b) => a + b, 0);
    const average = sum / sorted.length;

    // Calculate time deltas between consecutive changes
    const deltas = [];
    for (let i = 1; i < sorted.length; i++) {
      deltas.push(sorted[i] - sorted[i - 1]);
    }

    const avgDelta = deltas.length > 0 ?
      deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;

    return {
      count: changes.length,
      average: Math.round(average),
      min,
      max,
      range: max - min,
      averageTimeBetween: Math.round(avgDelta)
    };
  }

  /**
   * Get aggregation statistics
   * @returns {Object} Aggregation performance stats
   */
  getStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ?
      ((this.cacheHits / totalRequests) * 100).toFixed(2) : 0;

    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxCacheSize: this.options.maxCacheSize,
      monitorCount: this.monitorData.size,
      totalIndexedChanges: Array.from(this.monitorData.values())
        .reduce((sum, changes) => sum + changes.length, 0)
    };
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null
   */
  getFromCache(key) {
    if (!this.cache.has(key)) {
      return null;
    }

    const timestamp = this.cacheTimestamps.get(key);
    if (Date.now() - timestamp > this.options.cacheTtl) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key);
  }

  /**
   * Set item in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @returns {void}
   */
  setInCache(key, value) {
    // Implement LRU cache eviction
    if (this.cache.size >= this.options.maxCacheSize) {
      const oldestKey = Array.from(this.cacheTimestamps.entries())
        .sort((a, b) => a[1] - b[1])[0][0];
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  /**
   * Invalidate all cached data
   * @returns {void}
   */
  invalidateCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Clear aggregator state
   * @returns {void}
   */
  clear() {
    this.monitorData.clear();
    this.categoryIndex.clear();
    this.timeIndex.clear();
    this.invalidateCache();
  }
}

module.exports = {
  DataAggregator,
  AGGREGATION_SCOPES,
  TIME_BUCKETS
};

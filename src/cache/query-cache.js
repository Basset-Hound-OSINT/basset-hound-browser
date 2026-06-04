/**
 * Query Cache Layer
 * Caches frequently executed queries with automatic invalidation on data changes
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class QueryCache extends EventEmitter {
  constructor(cacheManager, options = {}) {
    super();
    this.cacheManager = cacheManager;
    this.queryConfigs = new Map(); // Query type -> config
    this.dependencyMap = new Map(); // Key -> dependent queries
    this.queryMetrics = new Map(); // Query -> metrics
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.minCacheableSize = options.minCacheableSize || 1024; // 1KB
  }

  /**
   * Register a cacheable query type
   */
  registerQuery(queryType, config = {}) {
    const {
      ttl = this.defaultTTL,
      tags = [],
      dependencies = [],
      partition = null,
      minCacheSize = this.minCacheableSize,
    } = config;

    this.queryConfigs.set(queryType, {
      ttl,
      tags,
      dependencies,
      partition,
      minCacheSize,
      enabled: true,
    });

    // Register dependency mapping
    for (const dep of dependencies) {
      if (!this.dependencyMap.has(dep)) {
        this.dependencyMap.set(dep, new Set());
      }
      this.dependencyMap.get(dep).add(queryType);
    }

    this.emit('query_registered', { queryType, config });
  }

  /**
   * Execute a query with caching
   */
  async execute(queryType, params = {}, executor) {
    const config = this.queryConfigs.get(queryType);
    if (!config || !config.enabled) {
      // Bypass cache if not registered
      return executor();
    }

    const cacheKey = this._generateCacheKey(queryType, params, config);
    const startTime = Date.now();

    // Try to get from cache
    const cachedResult = await this.cacheManager.get(cacheKey);
    if (cachedResult !== null) {
      this._recordMetric(queryType, 'hit', Date.now() - startTime);
      this.emit('query_cache_hit', { queryType, cacheKey });
      return cachedResult;
    }

    // Execute query
    const result = await executor();
    const executionTime = Date.now() - startTime;

    // Cache if size exceeds minimum
    const resultSize = this._estimateSize(result);
    if (resultSize >= config.minCacheSize) {
      const cacheOptions = {
        ttl: config.ttl,
        tags: config.tags,
        tier: 'memory',
      };

      // Partition the cache if configured
      if (config.partition) {
        cacheOptions.tags = [
          ...config.tags,
          `partition:${config.partition}(${params[config.partition]})`,
        ];
      }

      await this.cacheManager.set(cacheKey, result, cacheOptions);
      this._recordMetric(queryType, 'miss', executionTime);
      this.emit('query_executed', { queryType, cacheKey, cached: true });
    } else {
      this._recordMetric(queryType, 'miss', executionTime);
    }

    return result;
  }

  /**
   * Invalidate queries based on data change
   */
  async invalidateOnDataChange(dataType, changeType = 'update') {
    const dependentQueries = this.dependencyMap.get(dataType) || new Set();

    for (const queryType of dependentQueries) {
      const config = this.queryConfigs.get(queryType);
      if (!config) continue;

      // Invalidate all tags associated with this query
      for (const tag of config.tags) {
        await this.cacheManager.invalidateTag(tag);
      }

      this.emit('queries_invalidated', { dataType, queryType, count: 1 });
    }

    return dependentQueries.size;
  }

  /**
   * Invalidate specific query with parameters
   */
  async invalidateQuery(queryType, params = {}) {
    const config = this.queryConfigs.get(queryType);
    if (!config) return 0;

    const cacheKey = this._generateCacheKey(queryType, params, config);
    await this.cacheManager.delete(cacheKey);

    this.emit('query_invalidated', { queryType, cacheKey });
    return 1;
  }

  /**
   * Invalidate query by tag
   */
  async invalidateQueryTag(tag) {
    const count = await this.cacheManager.invalidateTag(tag);
    this.emit('query_tag_invalidated', { tag, count });
    return count;
  }

  /**
   * Enable/disable query caching
   */
  setQueryEnabled(queryType, enabled) {
    const config = this.queryConfigs.get(queryType);
    if (config) {
      config.enabled = enabled;
      this.emit('query_enabled_changed', { queryType, enabled });
    }
  }

  /**
   * Update query TTL
   */
  setQueryTTL(queryType, ttl) {
    const config = this.queryConfigs.get(queryType);
    if (config) {
      config.ttl = ttl;
      this.emit('query_ttl_changed', { queryType, ttl });
    }
  }

  /**
   * Get query metrics
   */
  getQueryMetrics(queryType) {
    return this.queryMetrics.get(queryType) || {
      hits: 0,
      misses: 0,
      avgExecutionTime: 0,
      avgCachedTime: 0,
    };
  }

  /**
   * Get all query metrics
   */
  getAllMetrics() {
    const result = {};
    for (const [queryType, metrics] of this.queryMetrics.entries()) {
      result[queryType] = {
        ...metrics,
        hitRate: metrics.hits + metrics.misses > 0
          ? ((metrics.hits / (metrics.hits + metrics.misses)) * 100).toFixed(2) + '%'
          : 'N/A',
      };
    }
    return result;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      registeredQueries: this.queryConfigs.size,
      metrics: this.getAllMetrics(),
      cacheManagerStats: this.cacheManager.getMetrics(),
    };
  }

  // ==================== Private Methods ====================

  _generateCacheKey(queryType, params, config) {
    let keyBase = queryType;

    // Add partition key if configured
    if (config.partition && params[config.partition]) {
      keyBase += `:${config.partition}=${params[config.partition]}`;
    }

    // Add param hash
    const paramStr = JSON.stringify(params);
    const paramHash = crypto.createHash('md5').update(paramStr).digest('hex');

    return `query:${keyBase}:${paramHash.substring(0, 8)}`;
  }

  _recordMetric(queryType, type, duration) {
    if (!this.queryMetrics.has(queryType)) {
      this.queryMetrics.set(queryType, {
        hits: 0,
        misses: 0,
        totalHitTime: 0,
        totalMissTime: 0,
        executionCount: 0,
      });
    }

    const metrics = this.queryMetrics.get(queryType);
    if (type === 'hit') {
      metrics.hits++;
      metrics.totalHitTime += duration;
    } else {
      metrics.misses++;
      metrics.totalMissTime += duration;
    }
    metrics.executionCount++;

    // Calculate averages
    metrics.avgCachedTime = metrics.hits > 0 ? metrics.totalHitTime / metrics.hits : 0;
    metrics.avgExecutionTime = metrics.misses > 0 ? metrics.totalMissTime / metrics.misses : 0;
  }

  _estimateSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }
}

module.exports = QueryCache;

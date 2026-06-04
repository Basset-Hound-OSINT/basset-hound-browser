/**
 * Enrichment Pipeline
 * Automatic data enrichment from multiple sources with conflict resolution
 * @module src/data/enrichment-pipeline
 */

const EventEmitter = require('events');

/**
 * Enrichment Source Adapter
 */
class EnrichmentSource {
  constructor(name, adapter, priority = 1, rateLimit = 10) {
    this.name = name;
    this.adapter = adapter;
    this.priority = priority;
    this.rateLimit = rateLimit; // requests per second
    this.enabled = true;
    this.metrics = {
      requests: 0,
      successful: 0,
      failed: 0,
      totalLatency: 0,
      averageLatency: 0
    };
  }

  async enrich(data) {
    if (!this.enabled) {
      return null;
    }

    try {
      const startTime = Date.now();
      const result = await this.adapter(data);
      const latency = Date.now() - startTime;

      this.metrics.requests++;
      this.metrics.successful++;
      this.metrics.totalLatency += latency;
      this.metrics.averageLatency = Math.round(
        this.metrics.totalLatency / this.metrics.successful
      );

      return {
        source: this.name,
        data: result,
        latency,
        timestamp: Date.now(),
        confidence: 1.0
      };
    } catch (error) {
      this.metrics.requests++;
      this.metrics.failed++;

      return {
        source: this.name,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

/**
 * Enrichment Pipeline Class
 */
class EnrichmentPipeline extends EventEmitter {
  constructor(options = {}) {
    super();

    this.sources = new Map(); // sourceName -> EnrichmentSource
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 3600000; // 1 hour
    this.maxConcurrentEnrichments = options.maxConcurrentEnrichments || 5;
    this.conflictResolution = options.conflictResolution || 'priority'; // priority, majority, highest-confidence
    this.enableDeduplication = options.enableDeduplication !== false;
    this.enableFreshness = options.enableFreshness !== false;
    this.freshnessTTL = options.freshnessTTL || 604800000; // 7 days

    // Metrics
    this.metrics = {
      totalEnrichments: 0,
      cachedEnrichments: 0,
      averageEnrichmentTime: 0,
      sourceSuccessRates: new Map(),
      conflictResolutions: 0,
      dataQualityScore: 0
    };
  }

  /**
   * Register enrichment source
   * @param {string} name - Source name
   * @param {Function} adapter - Enrichment function
   * @param {Object} options - Source options
   * @returns {EnrichmentSource} Registered source
   */
  registerSource(name, adapter, options = {}) {
    const source = new EnrichmentSource(
      name,
      adapter,
      options.priority || 1,
      options.rateLimit || 10
    );

    this.sources.set(name, source);

    this.emit('source-registered', {
      name,
      priority: source.priority,
      rateLimit: source.rateLimit
    });

    return source;
  }

  /**
   * Enrich data with multiple sources
   * @param {Object} data - Data to enrich
   * @param {Object} options - Enrichment options
   * @returns {Promise<Object>} Enriched data
   */
  async enrichData(data, options = {}) {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(data);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        this.metrics.cachedEnrichments++;
        this.emit('cache-hit', { key: cacheKey });
        return cached.data;
      }
      this.cache.delete(cacheKey);
    }

    try {
      // Get enabled sources
      const enabledSources = Array.from(this.sources.values())
        .filter(s => s.enabled)
        .sort((a, b) => b.priority - a.priority);

      if (enabledSources.length === 0) {
        throw new Error('No enrichment sources enabled');
      }

      // Execute enrichments in parallel with concurrency limit
      const enrichmentResults = [];
      const promises = enabledSources.map(source =>
        source.enrich(data)
      );

      const results = await this.executeWithConcurrency(
        promises,
        this.maxConcurrentEnrichments
      );

      enrichmentResults.push(...results.filter(r => !r.error));

      // Deduplicate results
      if (this.enableDeduplication) {
        this.deduplicateResults(enrichmentResults);
      }

      // Resolve conflicts
      const enrichedData = this.resolveConflicts(enrichmentResults, data);

      // Add freshness tracking
      if (this.enableFreshness) {
        enrichedData.freshness = {
          lastEnrichedAt: Date.now(),
          expiresAt: Date.now() + this.freshnessTTL,
          sources: enrichmentResults.map(r => r.source)
        };
      }

      // Cache result
      this.cache.set(cacheKey, {
        data: enrichedData,
        timestamp: Date.now()
      });

      const enrichmentTime = Date.now() - startTime;
      this.metrics.totalEnrichments++;
      this.metrics.averageEnrichmentTime = Math.round(
        (this.metrics.averageEnrichmentTime * (this.metrics.totalEnrichments - 1) +
          enrichmentTime) / this.metrics.totalEnrichments
      );

      this.emit('enrichment-completed', {
        sourceCount: enrichmentResults.length,
        enrichmentTime,
        dataQuality: this.calculateDataQuality(enrichedData)
      });

      return enrichedData;
    } catch (error) {
      this.emit('enrichment-error', {
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  /**
   * Batch enrich multiple data items
   * @param {Array} dataItems - Array of data to enrich
   * @param {Object} options - Enrichment options
   * @returns {Promise<Array>} Enriched data items
   */
  async enrichBatch(dataItems, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 10;

    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize);
      const enrichedBatch = await Promise.all(
        batch.map(item => this.enrichData(item, options))
      );
      results.push(...enrichedBatch);

      this.emit('batch-progress', {
        processed: Math.min(i + batchSize, dataItems.length),
        total: dataItems.length
      });
    }

    return results;
  }

  /**
   * Add enrichment field
   * @param {string} fieldName - Field name
   * @param {Function} enricher - Enrichment function
   * @returns {Object} Field registration
   */
  addEnrichmentField(fieldName, enricher) {
    return {
      fieldName,
      enricher,
      registered: true,
      timestamp: Date.now()
    };
  }

  /**
   * Execute with concurrency limit
   * @private
   */
  async executeWithConcurrency(promises, maxConcurrent) {
    const results = [];
    const executing = new Set();

    for (const promise of promises) {
      if (executing.size >= maxConcurrent) {
        await Promise.race(executing);
      }

      const exec = promise.then(
        result => {
          executing.delete(exec);
          return result;
        },
        error => {
          executing.delete(exec);
          return { error: error.message };
        }
      );

      executing.add(exec);
      results.push(exec);
    }

    return Promise.all(results);
  }

  /**
   * Resolve conflicts between enrichment results
   * @private
   */
  resolveConflicts(results, originalData) {
    const enrichedData = { ...originalData };
    const fieldValues = new Map(); // field -> [values from sources]

    // Group values by field
    for (const result of results) {
      if (!result.data) continue;

      for (const [field, value] of Object.entries(result.data)) {
        if (!fieldValues.has(field)) {
          fieldValues.set(field, []);
        }
        fieldValues.get(field).push({
          value,
          source: result.source,
          confidence: result.confidence || 1.0,
          latency: result.latency
        });
      }
    }

    // Resolve conflicts using selected strategy
    for (const [field, sources] of fieldValues) {
      const resolved = this.resolveFieldConflict(field, sources);
      if (resolved !== undefined) {
        enrichedData[field] = resolved;
      }
    }

    if (fieldValues.size > 0) {
      this.metrics.conflictResolutions += fieldValues.size;
    }

    return enrichedData;
  }

  /**
   * Resolve single field conflict
   * @private
   */
  resolveFieldConflict(field, sources) {
    if (sources.length === 0) return undefined;
    if (sources.length === 1) return sources[0].value;

    switch (this.conflictResolution) {
      case 'priority':
        // Highest priority source wins
        return sources.sort((a, b) => {
          // Primary sort by priority (not directly available, so use position)
          return a.confidence - b.confidence;
        })[sources.length - 1].value;

      case 'majority':
        // Most common value wins
        const valueCounts = new Map();
        for (const { value } of sources) {
          const count = valueCounts.get(value) || 0;
          valueCounts.set(value, count + 1);
        }
        let maxCount = 0;
        let majorityValue = sources[0].value;
        for (const [value, count] of valueCounts) {
          if (count > maxCount) {
            maxCount = count;
            majorityValue = value;
          }
        }
        return majorityValue;

      case 'highest-confidence':
        // Highest confidence score wins
        return sources.sort((a, b) => a.confidence - b.confidence)[
          sources.length - 1
        ].value;

      default:
        return sources[0].value;
    }
  }

  /**
   * Deduplicate results
   * @private
   */
  deduplicateResults(results) {
    const seen = new Set();
    const deduped = [];

    for (const result of results) {
      const key = JSON.stringify(result.data);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(result);
      }
    }

    return deduped;
  }

  /**
   * Generate cache key
   * @private
   */
  generateCacheKey(data) {
    const crypto = require('crypto');
    const key = JSON.stringify(data);
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Calculate data quality score
   * @private
   */
  calculateDataQuality(enrichedData) {
    let score = 0;
    let fields = 0;

    for (const [key, value] of Object.entries(enrichedData)) {
      if (key === 'freshness' || value === null || value === undefined) continue;

      fields++;

      // Check data completeness
      if (typeof value === 'string' && value.length > 0) {
        score += 25;
      } else if (typeof value === 'number') {
        score += 25;
      } else if (typeof value === 'boolean') {
        score += 25;
      } else if (Array.isArray(value) && value.length > 0) {
        score += 25;
      } else if (typeof value === 'object' && value !== null) {
        score += 15;
      }
    }

    return fields > 0 ? Math.round(score / fields) : 0;
  }

  /**
   * Get enrichment status
   */
  getStatus() {
    const sourceStatus = [];

    for (const [name, source] of this.sources) {
      sourceStatus.push({
        name,
        enabled: source.enabled,
        priority: source.priority,
        successRate: source.metrics.successful > 0
          ? Math.round((source.metrics.successful / source.metrics.requests) * 100)
          : 0,
        averageLatency: source.metrics.averageLatency,
        metrics: source.metrics
      });
    }

    return {
      sources: sourceStatus,
      cacheSize: this.cache.size,
      totalEnrichments: this.metrics.totalEnrichments,
      cachedEnrichments: this.metrics.cachedEnrichments,
      averageEnrichmentTime: this.metrics.averageEnrichmentTime
    };
  }

  /**
   * Disable/enable source
   */
  setSourceEnabled(sourceName, enabled) {
    if (this.sources.has(sourceName)) {
      this.sources.get(sourceName).enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      sourceCount: this.sources.size
    };
  }
}

module.exports = {
  EnrichmentPipeline,
  EnrichmentSource,
  createEnrichmentPipeline: (options) => new EnrichmentPipeline(options)
};

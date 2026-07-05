/**
 * Batch Operations & Deduplication Engine
 *
 * Provides comprehensive batch processing capabilities for data extraction:
 * - Batch URL processing with parallel execution
 * - Deduplication of extracted records
 * - Merge multiple exports
 * - Delta exports (changed data only)
 * - Batch filtering and status tracking
 *
 * @module src/export/batch-operations-engine
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Batch Operations Engine
 * Manages batch processing, deduplication, merging, and delta exports
 */
class BatchOperationsEngine extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      maxConcurrentOperations: config.maxConcurrentOperations || 5,
      batchTimeout: config.batchTimeout || 300000, // 5 minutes
      deduplicationAlgorithm: config.deduplicationAlgorithm || 'hash', // hash, content, fuzzy
      deduplicationFields: config.deduplicationFields || ['url', 'id', 'hash'],
      enableCompression: config.enableCompression !== false,
      enableCaching: config.enableCaching !== false,
      maxBatchSize: config.maxBatchSize || 10000,
      progressUpdateInterval: config.progressUpdateInterval || 500 // ms
    };

    // Batch job tracking
    this.activeBatches = new Map();
    this.batchHistory = new Map();
    this.deduplicationCache = new Map();
    this.mergeHistory = new Map();

    // Statistics
    this.stats = {
      totalBatchesProcessed: 0,
      totalRecordsProcessed: 0,
      totalDuplicatesRemoved: 0,
      totalMerges: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0
    };

    // Monitoring
    this.lastProgressUpdate = Date.now();
  }

  /**
   * Start a batch export job with multiple URLs
   *
   * @param {string} batchId - Unique batch identifier
   * @param {Array<string>} urls - URLs to process
   * @param {Object} options - Processing options
   * @param {Function} extractionCallback - Callback to extract from each URL
   * @returns {Object} { batchId, jobId, status, totalUrls }
   */
  async startBatchExport(batchId, urls, options = {}, extractionCallback) {
    try {
      if (!batchId || !urls || urls.length === 0) {
        throw new Error('batchId and non-empty urls array are required');
      }

      const jobId = crypto.randomBytes(8).toString('hex');
      const startTime = Date.now();

      const batch = {
        batchId,
        jobId,
        urls: urls.slice(), // Clone array
        options: {
          ...options,
          parallel: options.parallel !== false,
          maxConcurrent: options.maxConcurrent || this.config.maxConcurrentOperations,
          timeout: options.timeout || this.config.batchTimeout,
          retryOnFailure: options.retryOnFailure !== false,
          maxRetries: options.maxRetries || 3
        },
        status: 'initialized',
        progress: {
          processed: 0,
          successful: 0,
          failed: 0,
          total: urls.length
        },
        results: [],
        errors: [],
        startTime,
        endTime: null,
        duration: null,
        extractionCallback
      };

      this.activeBatches.set(jobId, batch);
      this.emit('batch-started', { batchId, jobId, totalUrls: urls.length });

      // Process batch based on parallel setting
      if (batch.options.parallel) {
        await this._processBatchParallel(jobId);
      } else {
        await this._processBatchSequential(jobId);
      }

      return {
        batchId,
        jobId,
        status: batch.status,
        totalUrls: urls.length
      };
    } catch (error) {
      this.emit('batch-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process batch in parallel with concurrency control
   *
   * @private
   */
  async _processBatchParallel(jobId) {
    const batch = this.activeBatches.get(jobId);
    batch.status = 'processing';

    const maxConcurrent = batch.options.maxConcurrent;
    let urlIndex = 0;

    // Create worker pool
    const workers = [];
    for (let i = 0; i < maxConcurrent && i < batch.urls.length; i++) {
      workers.push(this._processUrlWorker(jobId, urlIndex++));
    }

    while (urlIndex < batch.urls.length || workers.length > 0) {
      const result = await Promise.race(workers);

      if (result && urlIndex < batch.urls.length) {
        workers.splice(workers.indexOf(result), 1);
        workers.push(this._processUrlWorker(jobId, urlIndex++));
      }
    }

    batch.status = 'completed';
    batch.endTime = Date.now();
    batch.duration = batch.endTime - batch.startTime;

    this._recordBatchHistory(jobId);
    this.emit('batch-completed', {
      batchId: batch.batchId,
      jobId,
      processed: batch.progress.processed,
      successful: batch.progress.successful,
      failed: batch.progress.failed,
      duration: batch.duration
    });
  }

  /**
   * Process batch sequentially
   *
   * @private
   */
  async _processBatchSequential(jobId) {
    const batch = this.activeBatches.get(jobId);
    batch.status = 'processing';

    for (let i = 0; i < batch.urls.length; i++) {
      await this._processUrl(jobId, i);

      // Update progress periodically
      if (Date.now() - this.lastProgressUpdate > this.config.progressUpdateInterval) {
        this.emit('batch-progress', {
          jobId,
          processed: batch.progress.processed,
          successful: batch.progress.successful,
          failed: batch.progress.failed,
          total: batch.progress.total,
          percentComplete: Math.round((batch.progress.processed / batch.progress.total) * 100)
        });
        this.lastProgressUpdate = Date.now();
      }
    }

    batch.status = 'completed';
    batch.endTime = Date.now();
    batch.duration = batch.endTime - batch.startTime;

    this._recordBatchHistory(jobId);
    this.emit('batch-completed', {
      batchId: batch.batchId,
      jobId,
      processed: batch.progress.processed,
      successful: batch.progress.successful,
      failed: batch.progress.failed,
      duration: batch.duration
    });
  }

  /**
   * Worker function for processing individual URLs
   *
   * @private
   */
  async _processUrlWorker(jobId, urlIndex) {
    await this._processUrl(jobId, urlIndex);
    return Promise.resolve();
  }

  /**
   * Process a single URL
   *
   * @private
   */
  async _processUrl(jobId, urlIndex) {
    const batch = this.activeBatches.get(jobId);
    const url = batch.urls[urlIndex];

    try {
      let result = null;
      let retries = 0;

      while (retries <= batch.options.maxRetries && result === null) {
        try {
          result = await batch.extractionCallback(url, batch.options);
          break;
        } catch (error) {
          retries++;
          if (retries > batch.options.maxRetries) {
            throw error;
          }
          // Exponential backoff
          await this._delay(Math.pow(2, retries) * 1000);
        }
      }

      batch.results.push({
        url,
        data: result,
        success: true,
        timestamp: Date.now()
      });

      batch.progress.processed++;
      batch.progress.successful++;

    } catch (error) {
      batch.errors.push({
        url,
        error: error.message,
        timestamp: Date.now()
      });

      batch.progress.processed++;
      batch.progress.failed++;

      this.emit('url-error', { jobId, url, error: error.message });
    }
  }

  /**
   * Deduplicate records using configurable algorithm
   *
   * @param {Array<Object>} records - Records to deduplicate
   * @param {Object} options - Deduplication options
   * @returns {Object} { unique: [], duplicates: [], deduplicationStats }
   */
  deduplicateRecords(records, options = {}) {
    try {
      if (!Array.isArray(records)) {
        throw new Error('records must be an array');
      }

      const algorithm = options.algorithm || this.config.deduplicationAlgorithm;
      const fields = options.fields || this.config.deduplicationFields;
      const unique = [];
      const duplicates = [];
      const seenHashes = new Set();
      const stats = {
        totalRecords: records.length,
        uniqueRecords: 0,
        duplicatesRemoved: 0,
        deduplicationRatio: 0,
        algorithm
      };

      for (const record of records) {
        let hash;

        if (algorithm === 'hash') {
          hash = this._generateRecordHash(record, fields);
        } else if (algorithm === 'content') {
          hash = this._generateContentHash(record);
        } else if (algorithm === 'fuzzy') {
          hash = this._generateFuzzyHash(record, fields);
        } else {
          throw new Error(`Unknown deduplication algorithm: ${algorithm}`);
        }

        if (!seenHashes.has(hash)) {
          seenHashes.add(hash);
          unique.push({
            ...record,
            _deduplicationHash: hash,
            _isDuplicate: false
          });
          stats.uniqueRecords++;
        } else {
          duplicates.push({
            ...record,
            _deduplicationHash: hash,
            _isDuplicate: true,
            _duplicateOf: unique.find(r => r._deduplicationHash === hash)?.id || hash
          });
          stats.duplicatesRemoved++;
        }
      }

      stats.deduplicationRatio = (stats.duplicatesRemoved / stats.totalRecords * 100).toFixed(2);

      // Update global stats
      this.stats.totalDuplicatesRemoved += stats.duplicatesRemoved;

      this.emit('deduplication-complete', stats);

      return {
        unique,
        duplicates,
        deduplicationStats: stats
      };
    } catch (error) {
      this.emit('deduplication-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate hash for record based on specific fields
   *
   * @private
   */
  _generateRecordHash(record, fields) {
    const values = fields
      .map(field => this._getNestedValue(record, field))
      .filter(v => v !== undefined && v !== null)
      .join('|');

    return crypto.createHash('sha256').update(values).digest('hex');
  }

  /**
   * Generate content hash (hash of entire record)
   *
   * @private
   */
  _generateContentHash(record) {
    const content = JSON.stringify(record);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate fuzzy hash for approximate matching
   *
   * @private
   */
  _generateFuzzyHash(record, fields) {
    // Simple implementation: hash first 10 chars of concatenated field values
    const values = fields
      .map(field => {
        const val = this._getNestedValue(record, field);
        return val ? String(val).substring(0, 10) : '';
      })
      .join('');

    return crypto.createHash('sha256').update(values).digest('hex');
  }

  /**
   * Get nested object value by dot notation path
   *
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj);
  }

  /**
   * Merge multiple exports into one
   *
   * @param {Array<Object>} exports - Export objects to merge
   * @param {Object} options - Merge options
   * @returns {Object} { merged: {}, mergeStats }
   */
  mergeExports(exports, options = {}) {
    try {
      if (!Array.isArray(exports) || exports.length === 0) {
        throw new Error('exports must be a non-empty array');
      }

      const mergeId = crypto.randomBytes(8).toString('hex');
      const merged = {
        mergeId,
        metadata: {
          sourceCount: exports.length,
          mergedAt: new Date().toISOString(),
          mergeStrategy: options.strategy || 'union'
        },
        data: [],
        recordMap: new Map()
      };

      const stats = {
        totalSourceExports: exports.length,
        totalRecordsBefore: 0,
        totalRecordsAfter: 0,
        recordsAddedByMerge: 0,
        recordsUpdatedByMerge: 0,
        conflictsResolved: 0,
        mergeDuration: 0
      };

      const startTime = Date.now();

      // Merge strategy: union (combine all)
      if (options.strategy === 'union') {
        for (const exportData of exports) {
          const records = exportData.data || (Array.isArray(exportData) ? exportData : [exportData]);
          stats.totalRecordsBefore += records.length;

          for (const record of records) {
            const key = record.id || this._generateRecordHash(record, ['url', 'id']);

            if (!merged.recordMap.has(key)) {
              merged.data.push(record);
              merged.recordMap.set(key, record);
              stats.recordsAddedByMerge++;
            }
          }
        }
      }
      // Merge strategy: intersection (only common records)
      else if (options.strategy === 'intersection') {
        const recordMaps = exports.map(exp => {
          const records = exp.data || (Array.isArray(exp) ? exp : [exp]);
          const map = new Map();
          records.forEach(rec => {
            const key = rec.id || this._generateRecordHash(rec, ['url', 'id']);
            map.set(key, rec);
          });
          return map;
        });

        // Find common records
        const firstMap = recordMaps[0];
        for (const [key, record] of firstMap) {
          if (recordMaps.every(map => map.has(key))) {
            merged.data.push(record);
            stats.recordsAddedByMerge++;
          }
        }
      }
      // Merge strategy: custom (with conflict resolution)
      else if (options.strategy === 'custom' && options.resolver) {
        for (const exportData of exports) {
          const records = exportData.data || (Array.isArray(exportData) ? exportData : [exportData]);

          for (const record of records) {
            const key = record.id || this._generateRecordHash(record, ['url', 'id']);

            if (merged.recordMap.has(key)) {
              const existing = merged.recordMap.get(key);
              const resolved = options.resolver(existing, record);
              if (resolved !== existing) {
                const index = merged.data.findIndex(r => r.id === existing.id);
                merged.data[index] = resolved;
                stats.recordsUpdatedByMerge++;
                stats.conflictsResolved++;
              }
            } else {
              merged.data.push(record);
              merged.recordMap.set(key, record);
              stats.recordsAddedByMerge++;
            }
          }
        }
      }

      stats.totalRecordsAfter = merged.data.length;
      stats.mergeDuration = Date.now() - startTime;

      this.stats.totalMerges++;
      this.mergeHistory.set(mergeId, { exports, merged, stats, timestamp: Date.now() });

      this.emit('merge-complete', stats);

      return {
        mergeId,
        merged: merged.data,
        mergeStats: stats
      };
    } catch (error) {
      this.emit('merge-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Export only changed data since last export
   *
   * @param {Object} currentExport - Current export data
   * @param {Object} baselineExport - Previous/baseline export
   * @param {Object} options - Delta options
   * @returns {Object} { delta: {}, deltaStats }
   */
  exportDelta(currentExport, baselineExport, options = {}) {
    try {
      if (!currentExport || !baselineExport) {
        throw new Error('currentExport and baselineExport are required');
      }

      const current = Array.isArray(currentExport) ? currentExport : currentExport.data || [currentExport];
      const baseline = Array.isArray(baselineExport) ? baselineExport : baselineExport.data || [baselineExport];

      const deltaStats = {
        added: [],
        updated: [],
        removed: [],
        unchanged: [],
        totalChanges: 0
      };

      const baselineMap = new Map();
      baseline.forEach(record => {
        const key = record.id || this._generateRecordHash(record, options.compareFields || ['url', 'id']);
        baselineMap.set(key, record);
      });

      // Find added and updated records
      current.forEach(record => {
        const key = record.id || this._generateRecordHash(record, options.compareFields || ['url', 'id']);

        if (!baselineMap.has(key)) {
          deltaStats.added.push(record);
        } else {
          const baselineRecord = baselineMap.get(key);
          if (JSON.stringify(record) !== JSON.stringify(baselineRecord)) {
            deltaStats.updated.push({
              record,
              previousValue: baselineRecord
            });
          } else {
            deltaStats.unchanged.push(record);
          }
        }

        baselineMap.delete(key);
      });

      // Remaining records in baseline are removed
      baselineMap.forEach(record => {
        deltaStats.removed.push(record);
      });

      deltaStats.totalChanges = deltaStats.added.length + deltaStats.updated.length + deltaStats.removed.length;

      this.emit('delta-export-complete', deltaStats);

      return {
        deltaStats,
        delta: {
          added: deltaStats.added,
          updated: deltaStats.updated,
          removed: deltaStats.removed
        }
      };
    } catch (error) {
      this.emit('delta-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Apply filters across batch of records
   *
   * @param {Array<Object>} records - Records to filter
   * @param {Array<Object>} filters - Filter definitions
   * @returns {Object} { filtered: [], filterStats }
   */
  applyBatchFilters(records, filters = []) {
    try {
      if (!Array.isArray(records)) {
        throw new Error('records must be an array');
      }

      if (filters.length === 0) {
        return {
          filtered: records,
          filterStats: {
            totalRecords: records.length,
            filtersApplied: 0,
            recordsMatched: records.length
          }
        };
      }

      let filtered = records.slice();
      const stats = {
        totalRecords: records.length,
        filtersApplied: filters.length,
        recordsMatched: 0,
        filterDetails: []
      };

      for (const filter of filters) {
        const { field, operator, value } = filter;
        const beforeCount = filtered.length;

        filtered = filtered.filter(record => {
          const fieldValue = this._getNestedValue(record, field);

          switch (operator) {
            case 'equals':
              return fieldValue === value;
            case 'notEquals':
              return fieldValue !== value;
            case 'contains':
              return String(fieldValue).includes(String(value));
            case 'notContains':
              return !String(fieldValue).includes(String(value));
            case 'greaterThan':
              return Number(fieldValue) > Number(value);
            case 'lessThan':
              return Number(fieldValue) < Number(value);
            case 'greaterThanOrEqual':
              return Number(fieldValue) >= Number(value);
            case 'lessThanOrEqual':
              return Number(fieldValue) <= Number(value);
            case 'in':
              return Array.isArray(value) && value.includes(fieldValue);
            case 'notIn':
              return !Array.isArray(value) || !value.includes(fieldValue);
            case 'regex':
              return new RegExp(value).test(String(fieldValue));
            case 'exists':
              return value ? fieldValue !== undefined && fieldValue !== null : fieldValue === undefined || fieldValue === null;
            default:
              return true;
          }
        });

        stats.filterDetails.push({
          filter,
          recordsMatched: filtered.length,
          recordsRemoved: beforeCount - filtered.length
        });
      }

      stats.recordsMatched = filtered.length;

      this.emit('batch-filter-complete', stats);

      return {
        filtered,
        filterStats: stats
      };
    } catch (error) {
      this.emit('batch-filter-error', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get status of a batch job
   *
   * @param {string} jobId - Job identifier
   * @returns {Object} Status information
   */
  getBatchStatus(jobId) {
    const batch = this.activeBatches.get(jobId);

    if (!batch) {
      const history = this.batchHistory.get(jobId);
      if (history) {
        return {
          jobId,
          ...history,
          active: false
        };
      }
      return { error: 'Batch job not found' };
    }

    return {
      jobId,
      batchId: batch.batchId,
      status: batch.status,
      progress: batch.progress,
      errorCount: batch.errors.length,
      duration: batch.endTime ? batch.endTime - batch.startTime : Date.now() - batch.startTime,
      active: true
    };
  }

  /**
   * List all active batches
   *
   * @returns {Array} Active batch information
   */
  listActiveBatches() {
    const active = [];

    for (const [jobId, batch] of this.activeBatches) {
      active.push({
        jobId,
        batchId: batch.batchId,
        status: batch.status,
        urlCount: batch.urls.length,
        processedCount: batch.progress.processed,
        percentComplete: Math.round((batch.progress.processed / batch.progress.total) * 100)
      });
    }

    return active;
  }

  /**
   * Cancel a batch job
   *
   * @param {string} jobId - Job identifier
   * @returns {Object} Cancellation result
   */
  cancelBatch(jobId) {
    const batch = this.activeBatches.get(jobId);

    if (!batch) {
      return { error: 'Batch job not found' };
    }

    batch.status = 'cancelled';
    batch.endTime = Date.now();
    batch.duration = batch.endTime - batch.startTime;

    this._recordBatchHistory(jobId);
    this.emit('batch-cancelled', { jobId });

    return {
      success: true,
      jobId,
      processedBefore: batch.progress.processed
    };
  }

  /**
   * Get batch history
   *
   * @param {string} jobId - Optional job identifier to get specific history
   * @returns {Object|Array} History information
   */
  getBatchHistory(jobId = null) {
    if (jobId) {
      return this.batchHistory.get(jobId) || null;
    }

    const history = [];
    for (const [id, data] of this.batchHistory) {
      history.push({
        jobId: id,
        ...data
      });
    }

    return history;
  }

  /**
   * Record batch in history and clean up
   *
   * @private
   */
  _recordBatchHistory(jobId) {
    const batch = this.activeBatches.get(jobId);

    if (batch) {
      this.batchHistory.set(jobId, {
        batchId: batch.batchId,
        status: batch.status,
        progress: batch.progress,
        duration: batch.duration,
        errorCount: batch.errors.length,
        timestamp: batch.startTime
      });

      // Clean up active batch after some time
      setTimeout(() => {
        this.activeBatches.delete(jobId);
      }, 30000); // Keep in active for 30 seconds for status queries
    }

    // Update global stats
    if (batch && batch.status === 'completed') {
      this.stats.totalBatchesProcessed++;
      this.stats.totalRecordsProcessed += batch.progress.processed;
    }
  }

  /**
   * Get engine statistics
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      activeBatchCount: this.activeBatches.size,
      historicalBatchCount: this.batchHistory.size
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalBatchesProcessed: 0,
      totalRecordsProcessed: 0,
      totalDuplicatesRemoved: 0,
      totalMerges: 0,
      averageProcessingTime: 0,
      cacheHitRate: 0
    };
  }

  /**
   * Utility: Delay helper
   *
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BatchOperationsEngine };

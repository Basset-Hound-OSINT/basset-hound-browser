/**
 * Indexing Pipeline
 * Handles background indexing, bulk operations, and index management
 */

const EventEmitter = require('events');
const { Worker } = require('worker_threads');
const path = require('path');

class IndexingPipeline extends EventEmitter {
  constructor(searchEngine, options = {}) {
    super();
    this.searchEngine = searchEngine;
    this.queue = [];
    this.processing = false;
    this.batchSize = options.batchSize || 100;
    this.batchTimeout = options.batchTimeout || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.mappings = new Map(); // Index -> mapping definition
    this.stats = {
      documentsIndexed: 0,
      documentsDeleted: 0,
      failedIndexes: 0,
      totalBatches: 0,
      avgBatchTime: 0,
    };
    this.batchTimer = null;
  }

  /**
   * Register an index mapping
   */
  registerMapping(indexName, mapping) {
    this.mappings.set(indexName, {
      indexName,
      ...mapping,
    });

    this.emit('mapping_registered', { index: indexName });
  }

  /**
   * Add document to indexing queue
   */
  queueDocument(indexName, docId, document, options = {}) {
    const { priority = 'normal', retry = 0 } = options;

    const queueItem = {
      type: 'index',
      indexName,
      docId,
      document,
      priority,
      retry,
      timestamp: Date.now(),
    };

    // Insert based on priority
    if (priority === 'high') {
      this.queue.unshift(queueItem);
    } else {
      this.queue.push(queueItem);
    }

    this.emit('document_queued', { indexName, docId });

    // Start processing if not already running
    if (!this.processing) {
      this._startBatchTimer();
    }

    return queueItem;
  }

  /**
   * Queue multiple documents
   */
  queueBatch(indexName, documents, options = {}) {
    const items = [];
    for (const [docId, document] of Object.entries(documents)) {
      const item = this.queueDocument(indexName, docId, document, options);
      items.push(item);
    }

    return items;
  }

  /**
   * Delete document from index
   */
  async deleteDocument(indexName, docId) {
    try {
      await this.searchEngine.deleteDocument(indexName, docId);
      this.stats.documentsDeleted++;
      this.emit('document_deleted_from_index', { indexName, docId });
      return true;
    } catch (err) {
      this.emit('error', { type: 'delete_error', indexName, docId, error: err.message });
      throw err;
    }
  }

  /**
   * Create index from mapping
   */
  async createIndex(indexName, options = {}) {
    const mapping = this.mappings.get(indexName);
    if (!mapping) {
      throw new Error(`No mapping registered for ${indexName}`);
    }

    try {
      const { properties = {} } = mapping;
      await this.searchEngine.createIndex(indexName, properties);
      this.emit('index_created', { index: indexName });
      return true;
    } catch (err) {
      this.emit('error', { type: 'create_index_error', index: indexName, error: err.message });
      throw err;
    }
  }

  /**
   * Delete index
   */
  async deleteIndex(indexName) {
    try {
      // Clear queue for this index
      this.queue = this.queue.filter((item) => item.indexName !== indexName);

      await this.searchEngine.deleteIndex(indexName);
      this.mappings.delete(indexName);
      this.emit('index_deleted', { index: indexName });
      return true;
    } catch (err) {
      this.emit('error', { type: 'delete_index_error', index: indexName, error: err.message });
      throw err;
    }
  }

  /**
   * Reindex documents from source to target
   */
  async reindex(sourceIndex, targetIndex, options = {}) {
    const { batchSize = this.batchSize } = options;

    try {
      await this.searchEngine.reindex(sourceIndex, targetIndex);
      this.emit('reindex_completed', { source: sourceIndex, target: targetIndex });
      return true;
    } catch (err) {
      this.emit('error', {
        type: 'reindex_error',
        source: sourceIndex,
        target: targetIndex,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const byIndex = {};
    for (const item of this.queue) {
      if (!byIndex[item.indexName]) {
        byIndex[item.indexName] = 0;
      }
      byIndex[item.indexName]++;
    }

    return {
      queueSize: this.queue.length,
      processing: this.processing,
      byIndex,
    };
  }

  /**
   * Get pipeline statistics
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.queue.length,
      registeredMappings: this.mappings.size,
    };
  }

  /**
   * Pause processing
   */
  pause() {
    this.processing = false;
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.emit('paused', {});
  }

  /**
   * Resume processing
   */
  resume() {
    if (!this.processing) {
      this._startBatchTimer();
    }
  }

  /**
   * Process queue immediately
   */
  async processNow() {
    return this._processBatch();
  }

  // ==================== Private Methods ====================

  _startBatchTimer() {
    this.batchTimer = setTimeout(() => {
      this._processBatch().catch((err) => {
        this.emit('error', { type: 'batch_processing_error', error: err.message });
      });
    }, this.batchTimeout);
  }

  async _processBatch() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const batchStartTime = Date.now();

    try {
      // Group by index
      const byIndex = {};
      for (let i = 0; i < Math.min(this.batchSize, this.queue.length); i++) {
        const item = this.queue[i];
        if (!byIndex[item.indexName]) {
          byIndex[item.indexName] = [];
        }
        byIndex[item.indexName].push(item);
      }

      // Process each index's batch
      for (const [indexName, items] of Object.entries(byIndex)) {
        await this._processIndexBatch(indexName, items);
      }

      // Remove processed items from queue
      this.queue.splice(0, Math.min(this.batchSize, this.queue.length));

      const batchTime = Date.now() - batchStartTime;
      this.stats.totalBatches++;
      this.stats.avgBatchTime =
        (this.stats.avgBatchTime * (this.stats.totalBatches - 1) + batchTime) /
        this.stats.totalBatches;

      this.emit('batch_processed', { itemCount: this.queue.length, took: batchTime });

      // Continue processing if queue has items
      if (this.queue.length > 0) {
        this._startBatchTimer();
      }
    } finally {
      this.processing = false;
    }
  }

  async _processIndexBatch(indexName, items) {
    const documents = {};
    const retryItems = [];

    for (const item of items) {
      if (item.type === 'index') {
        documents[item.docId] = item.document;
      } else if (item.type === 'delete') {
        // Handle deletes separately
        try {
          await this.deleteDocument(indexName, item.docId);
        } catch (err) {
          if (item.retry < this.maxRetries) {
            item.retry++;
            retryItems.push(item);
          } else {
            this.stats.failedIndexes++;
            this.emit('error', {
              type: 'document_index_failed',
              indexName,
              docId: item.docId,
              error: err.message,
            });
          }
        }
      }
    }

    // Bulk index documents
    if (Object.keys(documents).length > 0) {
      try {
        await this.searchEngine.bulkIndex(indexName, documents);
        this.stats.documentsIndexed += Object.keys(documents).length;
      } catch (err) {
        // Move failed items to retry queue
        for (const item of items) {
          if (item.type === 'index') {
            if (item.retry < this.maxRetries) {
              item.retry++;
              retryItems.push(item);
            } else {
              this.stats.failedIndexes++;
              this.emit('error', {
                type: 'batch_index_failed',
                indexName,
                error: err.message,
              });
            }
          }
        }
      }
    }

    // Re-queue failed items
    if (retryItems.length > 0) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      for (const item of retryItems) {
        this.queue.push(item);
      }
    }
  }
}

module.exports = IndexingPipeline;

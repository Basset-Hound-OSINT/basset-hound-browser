/**
 * Basset Hound Browser - Data Ingestion Processor
 *
 * Processes detected data for ingestion into the basset-hound OSINT platform.
 * Handles validation, deduplication, normalization, and provenance tracking.
 *
 * Ingestion Modes:
 * - automatic: Ingest all detected data without user intervention
 * - selective: User manually selects items to ingest
 * - type_filtered: Auto-ingest only specified data types
 * - confirmation: Show all detections, require confirmation before each ingest
 *
 * @module extraction/ingestion-processor
 */

const { DataTypeDetector } = require('./data-type-detector');

/**
 * Ingestion modes enumeration
 */
const INGESTION_MODES = {
  AUTOMATIC: 'automatic',
  SELECTIVE: 'selective',
  TYPE_FILTERED: 'type_filtered',
  CONFIRMATION: 'confirmation',
  BATCH: 'batch'
};

/**
 * Default ingestion configuration
 */
const DEFAULT_CONFIG = {
  mode: INGESTION_MODES.SELECTIVE,
  enabledTypes: [
    'email', 'phone_us', 'phone_international', 'phone_uk',
    'crypto_btc', 'crypto_eth', 'crypto_xmr', 'crypto_ltc',
    'social_twitter', 'social_instagram', 'social_linkedin',
    'social_facebook', 'social_github', 'social_telegram',
    'ip_v4', 'ip_v6', 'domain', 'url', 'mac_address'
  ],
  autoIngestTypes: ['email', 'phone_us', 'phone_international'],
  confidenceThreshold: 0.7,
  deduplication: {
    enabled: true,
    checkBassetHound: false,  // Requires API connection
    localCacheTtl: 3600
  },
  rateLimiting: {
    enabled: true,
    maxItemsPerPage: 100,
    minDelayBetweenIngests: 500
  },
  provenance: {
    includeSourceUrl: true,
    includeTimestamp: true,
    includeContext: true,
    includeBrowserInfo: true
  }
};

/**
 * IngestionProcessor class
 * Handles the ingestion workflow for detected data
 */
class IngestionProcessor {
  /**
   * Create a new IngestionProcessor
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.detector = new DataTypeDetector({
      enabledTypes: this.config.enabledTypes,
      confidenceThreshold: this.config.confidenceThreshold
    });

    // Ingestion queue
    this.queue = [];

    // Local deduplication cache
    this.dedupeCache = new Map();
    this.dedupeCacheExpiry = new Map();

    // Ingestion history
    this.history = [];

    // Statistics
    this.stats = {
      totalDetected: 0,
      totalIngested: 0,
      totalSkipped: 0,
      totalDuplicates: 0,
      byType: {}
    };

    // Callbacks
    this.callbacks = {
      onDetection: null,
      onIngest: null,
      onError: null,
      onQueueUpdate: null
    };
  }

  /**
   * Process a page for data detection and potential ingestion
   * @param {string} html - HTML content
   * @param {string} url - Source URL
   * @returns {Object} Processing result with detected items
   */
  async processPage(html, url) {
    const result = {
      success: true,
      url,
      processedAt: new Date().toISOString(),
      detected: [],
      autoIngested: [],
      queued: [],
      skipped: [],
      errors: []
    };

    try {
      // Detect data types
      const detectionResult = this.detector.detectAll(html, url);

      if (!detectionResult.success) {
        result.success = false;
        result.errors = detectionResult.errors;
        return result;
      }

      result.detected = detectionResult.items;
      this.stats.totalDetected += detectionResult.totalItems;

      // Trigger detection callback
      if (this.callbacks.onDetection) {
        await this.callbacks.onDetection(detectionResult);
      }

      // Process items based on ingestion mode
      for (const item of detectionResult.items) {
        try {
          const processedItem = await this.processItem(item, url);

          if (processedItem.action === 'ingested') {
            result.autoIngested.push(processedItem.item);
          } else if (processedItem.action === 'queued') {
            result.queued.push(processedItem.item);
          } else if (processedItem.action === 'skipped') {
            result.skipped.push(processedItem.item);
          }

        } catch (error) {
          result.errors.push({
            item: item.id,
            error: error.message
          });
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);

      if (this.callbacks.onError) {
        await this.callbacks.onError(error);
      }
    }

    return result;
  }

  /**
   * Process a single detected item
   * @param {Object} item - Detected item
   * @param {string} sourceUrl - Source URL
   * @returns {Object} Processing result
   */
  async processItem(item, sourceUrl) {
    // Check confidence threshold
    if (item.confidence < this.config.confidenceThreshold) {
      this.stats.totalSkipped++;
      return { action: 'skipped', item, reason: 'below_confidence_threshold' };
    }

    // Check deduplication
    if (this.config.deduplication.enabled) {
      const isDuplicate = await this.checkDuplicate(item);
      if (isDuplicate) {
        this.stats.totalDuplicates++;
        return { action: 'skipped', item, reason: 'duplicate' };
      }
    }

    // Determine action based on mode
    switch (this.config.mode) {
      case INGESTION_MODES.AUTOMATIC:
        return await this.ingestItem(item, sourceUrl);

      case INGESTION_MODES.TYPE_FILTERED:
        if (this.config.autoIngestTypes.includes(item.type)) {
          return await this.ingestItem(item, sourceUrl);
        }
        return this.queueItem(item, sourceUrl);

      case INGESTION_MODES.SELECTIVE:
      case INGESTION_MODES.CONFIRMATION:
        return this.queueItem(item, sourceUrl);

      default:
        return this.queueItem(item, sourceUrl);
    }
  }

  /**
   * Check if an item is a duplicate
   * @param {Object} item - Item to check
   * @returns {boolean} True if duplicate
   */
  async checkDuplicate(item) {
    const cacheKey = `${item.type}:${item.normalized || item.value}`;

    // Check local cache first
    if (this.dedupeCache.has(cacheKey)) {
      const expiry = this.dedupeCacheExpiry.get(cacheKey);
      if (expiry && expiry > Date.now()) {
        return true;
      }
      // Expired, remove from cache
      this.dedupeCache.delete(cacheKey);
      this.dedupeCacheExpiry.delete(cacheKey);
    }

    // TODO: Check basset-hound API if enabled
    // if (this.config.deduplication.checkBassetHound) {
    //   const exists = await this.checkBassetHoundOrphan(item);
    //   if (exists) return true;
    // }

    return false;
  }

  /**
   * Add item to deduplication cache
   * @param {Object} item - Item to cache
   */
  addToDedupeCache(item) {
    const cacheKey = `${item.type}:${item.normalized || item.value}`;
    this.dedupeCache.set(cacheKey, true);
    this.dedupeCacheExpiry.set(
      cacheKey,
      Date.now() + (this.config.deduplication.localCacheTtl * 1000)
    );
  }

  /**
   * Ingest an item (prepare for basset-hound)
   * @param {Object} item - Item to ingest
   * @param {string} sourceUrl - Source URL
   * @returns {Object} Ingestion result
   */
  async ingestItem(item, sourceUrl) {
    // Build provenance
    const provenance = this.buildProvenance(item, sourceUrl);

    // Build orphan data structure
    const orphanData = this.buildOrphanData(item, provenance);

    // Add to deduplication cache
    this.addToDedupeCache(item);

    // Add to history
    this.addToHistory(item, sourceUrl, 'ingested');

    // Update statistics
    this.stats.totalIngested++;
    this.stats.byType[item.type] = (this.stats.byType[item.type] || 0) + 1;

    // Trigger callback
    if (this.callbacks.onIngest) {
      await this.callbacks.onIngest(orphanData);
    }

    return {
      action: 'ingested',
      item: {
        ...item,
        orphanData,
        provenance
      }
    };
  }

  /**
   * Queue an item for user selection
   * @param {Object} item - Item to queue
   * @param {string} sourceUrl - Source URL
   * @returns {Object} Queue result
   */
  queueItem(item, sourceUrl) {
    const queuedItem = {
      ...item,
      sourceUrl,
      queuedAt: new Date().toISOString(),
      status: 'pending'
    };

    this.queue.push(queuedItem);

    // Trigger callback
    if (this.callbacks.onQueueUpdate) {
      this.callbacks.onQueueUpdate(this.queue);
    }

    return { action: 'queued', item: queuedItem };
  }

  /**
   * Build provenance data for an item
   * @param {Object} item - Detected item
   * @param {string} sourceUrl - Source URL
   * @returns {Object} Provenance data
   */
  buildProvenance(item, sourceUrl) {
    const provenance = {
      source_type: 'website',
      captured_by: 'basset-hound-browser'
    };

    if (this.config.provenance.includeSourceUrl) {
      provenance.source_url = sourceUrl;
    }

    if (this.config.provenance.includeTimestamp) {
      provenance.source_date = new Date().toISOString();
    }

    if (this.config.provenance.includeContext && item.context) {
      provenance.context = item.context;
    }

    if (this.config.provenance.includeBrowserInfo) {
      provenance.browser_version = 'basset-hound-browser';
    }

    return provenance;
  }

  /**
   * Build orphan data structure for basset-hound
   * @param {Object} item - Detected item
   * @param {Object} provenance - Provenance data
   * @returns {Object} Orphan data structure
   */
  buildOrphanData(item, provenance) {
    return {
      identifier_type: item.orphanType,
      identifier_value: item.normalized || item.value,
      source: provenance.source_url || 'basset-hound-browser',
      notes: `Detected as ${item.typeName} with ${Math.round(item.confidence * 100)}% confidence`,
      tags: item.suggestedTags || [item.type],
      confidence_score: item.confidence,
      metadata: {
        detection_type: item.type,
        detection_name: item.typeName,
        original_value: item.value,
        context: item.context,
        position: item.position,
        ...(item.metadata || {})
      },
      discovered_date: provenance.source_date
    };
  }

  /**
   * Add to ingestion history
   * @param {Object} item - Item
   * @param {string} sourceUrl - Source URL
   * @param {string} action - Action taken
   */
  addToHistory(item, sourceUrl, action) {
    this.history.push({
      id: item.id,
      type: item.type,
      value: item.normalized || item.value,
      sourceUrl,
      action,
      timestamp: new Date().toISOString()
    });

    // Keep history limited
    if (this.history.length > 1000) {
      this.history = this.history.slice(-500);
    }
  }

  /**
   * Ingest selected items from queue
   * @param {string[]} itemIds - IDs of items to ingest
   * @returns {Object} Ingestion results
   */
  async ingestSelected(itemIds) {
    const results = {
      ingested: [],
      failed: [],
      notFound: []
    };

    for (const id of itemIds) {
      const queueIndex = this.queue.findIndex(item => item.id === id);

      if (queueIndex === -1) {
        results.notFound.push(id);
        continue;
      }

      const item = this.queue[queueIndex];

      try {
        const result = await this.ingestItem(item, item.sourceUrl);
        results.ingested.push(result.item);

        // Remove from queue
        this.queue.splice(queueIndex, 1);

      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    // Trigger queue update callback
    if (this.callbacks.onQueueUpdate) {
      this.callbacks.onQueueUpdate(this.queue);
    }

    return results;
  }

  /**
   * Ingest all items in queue
   * @returns {Object} Ingestion results
   */
  async ingestAll() {
    const itemIds = this.queue.map(item => item.id);
    return this.ingestSelected(itemIds);
  }

  /**
   * Remove items from queue
   * @param {string[]} itemIds - IDs to remove
   */
  removeFromQueue(itemIds) {
    for (const id of itemIds) {
      const index = this.queue.findIndex(item => item.id === id);
      if (index !== -1) {
        this.queue.splice(index, 1);
        this.stats.totalSkipped++;
      }
    }

    if (this.callbacks.onQueueUpdate) {
      this.callbacks.onQueueUpdate(this.queue);
    }
  }

  /**
   * Clear the ingestion queue
   */
  clearQueue() {
    this.stats.totalSkipped += this.queue.length;
    this.queue = [];

    if (this.callbacks.onQueueUpdate) {
      this.callbacks.onQueueUpdate(this.queue);
    }
  }

  /**
   * Get current queue
   * @returns {Array} Queue items
   */
  getQueue() {
    return [...this.queue];
  }

  /**
   * Get ingestion history
   * @param {number} limit - Max items to return
   * @returns {Array} History items
   */
  getHistory(limit = 100) {
    return this.history.slice(-limit);
  }

  /**
   * Configure ingestion options
   * @param {Object} options - New options
   */
  configure(options) {
    this.config = { ...this.config, ...options };

    // Update detector configuration
    this.detector.configure({
      enabledTypes: this.config.enabledTypes,
      confidenceThreshold: this.config.confidenceThreshold
    });
  }

  /**
   * Set ingestion mode
   * @param {string} mode - Ingestion mode
   */
  setMode(mode) {
    if (!Object.values(INGESTION_MODES).includes(mode)) {
      throw new Error(`Invalid ingestion mode: ${mode}`);
    }
    this.config.mode = mode;
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      detection: this.detector.getStats(),
      queueLength: this.queue.length,
      historyLength: this.history.length
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalDetected: 0,
      totalIngested: 0,
      totalSkipped: 0,
      totalDuplicates: 0,
      byType: {}
    };
    this.detector.resetStats();
  }

  /**
   * Register callback
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.callbacks.hasOwnProperty(event)) {
      this.callbacks[event] = callback;
    }
  }

  /**
   * Clear deduplication cache
   */
  clearDedupeCache() {
    this.dedupeCache.clear();
    this.dedupeCacheExpiry.clear();
  }

  /**
   * Export detected data to JSON
   * @param {Array} items - Items to export
   * @returns {string} JSON string
   */
  exportToJson(items = null) {
    const data = items || this.queue;
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      exportedBy: 'basset-hound-browser',
      totalItems: data.length,
      items: data.map(item => ({
        type: item.type,
        typeName: item.typeName,
        value: item.normalized || item.value,
        originalValue: item.value,
        confidence: item.confidence,
        orphanType: item.orphanType,
        context: item.context,
        sourceUrl: item.sourceUrl,
        suggestedTags: item.suggestedTags,
        metadata: item.metadata
      }))
    }, null, 2);
  }
}

/**
 * Factory function to create an IngestionProcessor
 * @param {Object} options - Configuration options
 * @returns {IngestionProcessor}
 */
function createIngestionProcessor(options = {}) {
  return new IngestionProcessor(options);
}

module.exports = {
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES,
  DEFAULT_CONFIG
};

/**
 * Basset Hound Browser - History Manager
 * Manages browsing history tracking with automatic navigation tracking,
 * visit duration calculation, and comprehensive query capabilities
 */

const HistoryStorage = require('./storage');
const path = require('path');

/**
 * HistoryEntry class
 * Represents a single history entry with all associated metadata
 */
class HistoryEntry {
  /**
   * Create a new history entry
   * @param {Object} data - Entry data
   */
  constructor(data = {}) {
    this.id = data.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.url = data.url || '';
    this.title = data.title || '';
    this.visitTime = data.visitTime || new Date().toISOString();
    this.visitDuration = data.visitDuration || null; // Duration in milliseconds
    this.referrer = data.referrer || null;
    this.favicon = data.favicon || null;
    this.tabId = data.tabId || null;
    this.sessionId = data.sessionId || null;
    this.transitionType = data.transitionType || 'link'; // link, typed, reload, etc.
  }

  /**
   * Convert entry to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      visitTime: this.visitTime,
      visitDuration: this.visitDuration,
      referrer: this.referrer,
      favicon: this.favicon,
      tabId: this.tabId,
      sessionId: this.sessionId,
      transitionType: this.transitionType
    };
  }

  /**
   * Create HistoryEntry from plain object
   * @param {Object} data - Plain object
   * @returns {HistoryEntry} History entry instance
   */
  static fromObject(data) {
    return new HistoryEntry(data);
  }
}

/**
 * HistoryManager class
 * Central manager for browsing history with automatic tracking and querying
 */
class HistoryManager {
  /**
   * Create a new HistoryManager
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(process.cwd(), 'history-data');
    this.storage = new HistoryStorage(this.dataPath);

    // Active page tracking for duration calculation
    this.activePages = new Map(); // tabId -> { entryId, startTime }

    // Event callbacks
    this.onEntryAdded = options.onEntryAdded || null;
    this.onEntryDeleted = options.onEntryDeleted || null;
    this.onHistoryCleared = options.onHistoryCleared || null;

    // Configuration
    this.maxEntries = options.maxEntries || 10000;
    this.autoTrack = options.autoTrack !== false;

    console.log('[HistoryManager] Initialized with data path:', this.dataPath);
  }

  /**
   * Add a new history entry
   * @param {string} url - Page URL
   * @param {string} title - Page title
   * @param {string} referrer - Referrer URL
   * @param {Object} options - Additional options
   * @returns {Object} Result with entry
   */
  addEntry(url, title, referrer, options = {}) {
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    // Skip certain URLs
    if (this.shouldSkipUrl(url)) {
      return { success: false, error: 'URL skipped (internal page)' };
    }

    const entry = new HistoryEntry({
      url,
      title: title || '',
      referrer,
      visitTime: new Date().toISOString(),
      tabId: options.tabId,
      sessionId: options.sessionId,
      transitionType: options.transitionType || 'link',
      favicon: options.favicon
    });

    // Add to storage
    this.storage.addEntry(entry.toObject());

    // Track active page for duration calculation
    if (options.tabId) {
      this.startPageTracking(options.tabId, entry.id);
    }

    // Trigger callback
    if (this.onEntryAdded) {
      this.onEntryAdded(entry.toObject());
    }

    // Enforce max entries limit
    this.enforceMaxEntries();

    console.log(`[HistoryManager] Added entry: ${url}`);

    return {
      success: true,
      entry: entry.toObject()
    };
  }

  /**
   * Check if URL should be skipped
   * @param {string} url - URL to check
   * @returns {boolean} True if should skip
   */
  shouldSkipUrl(url) {
    const skipPatterns = [
      /^about:/,
      /^chrome:/,
      /^chrome-extension:/,
      /^file:\/\//,
      /^data:/,
      /^javascript:/,
      /^blob:/
    ];

    return skipPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Start tracking page for duration calculation
   * @param {string} tabId - Tab ID
   * @param {string} entryId - Entry ID
   */
  startPageTracking(tabId, entryId) {
    // End previous page tracking for this tab
    this.endPageTracking(tabId);

    // Start new tracking
    this.activePages.set(tabId, {
      entryId,
      startTime: Date.now()
    });
  }

  /**
   * End page tracking and calculate duration
   * @param {string} tabId - Tab ID
   */
  endPageTracking(tabId) {
    const tracking = this.activePages.get(tabId);
    if (!tracking) return;

    const duration = Date.now() - tracking.startTime;

    // Update entry with duration
    const entry = this.storage.getEntry(tracking.entryId);
    if (entry) {
      entry.visitDuration = duration;
      this.storage.save();
    }

    this.activePages.delete(tabId);
  }

  /**
   * Update entry with page title (often loaded after navigation)
   * @param {string} entryId - Entry ID
   * @param {string} title - Page title
   * @returns {Object} Result
   */
  updateEntryTitle(entryId, title) {
    const entry = this.storage.getEntry(entryId);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    entry.title = title;
    this.storage.save();

    return { success: true, entry };
  }

  /**
   * Get history with filters
   * @param {Object} options - Filter options
   * @returns {Object} Result with history entries
   */
  getHistory(options = {}) {
    const {
      limit = 100,
      offset = 0,
      startTime,
      endTime,
      search,
      sessionId,
      tabId
    } = options;

    let entries;

    // Apply time range filter if provided
    if (startTime || endTime) {
      entries = this.storage.getEntriesByTimeRange(
        startTime || 0,
        endTime || Date.now()
      );
    } else {
      entries = this.storage.getAllEntries({ limit: this.maxEntries, offset: 0 });
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter(e =>
        e.url.toLowerCase().includes(searchLower) ||
        (e.title && e.title.toLowerCase().includes(searchLower))
      );
    }

    // Apply session filter
    if (sessionId) {
      entries = entries.filter(e => e.sessionId === sessionId);
    }

    // Apply tab filter
    if (tabId) {
      entries = entries.filter(e => e.tabId === tabId);
    }

    // Sort by visit time descending
    entries.sort((a, b) => new Date(b.visitTime) - new Date(a.visitTime));

    // Apply pagination
    const total = entries.length;
    const paginated = entries.slice(offset, offset + limit);

    return {
      success: true,
      total,
      limit,
      offset,
      entries: paginated
    };
  }

  /**
   * Search history by URL or title
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} Result with matching entries
   */
  searchHistory(query, options = {}) {
    if (!query) {
      return { success: false, error: 'Query is required' };
    }

    const { limit = 100 } = options;
    const results = this.storage.search(query, { limit });

    return {
      success: true,
      query,
      total: results.length,
      entries: results
    };
  }

  /**
   * Get a specific entry by ID
   * @param {string} id - Entry ID
   * @returns {Object} Result with entry
   */
  getEntry(id) {
    if (!id) {
      return { success: false, error: 'ID is required' };
    }

    const entry = this.storage.getEntry(id);
    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    return { success: true, entry };
  }

  /**
   * Delete a specific entry
   * @param {string} id - Entry ID
   * @returns {Object} Result
   */
  deleteEntry(id) {
    if (!id) {
      return { success: false, error: 'ID is required' };
    }

    const success = this.storage.deleteEntry(id);
    if (!success) {
      return { success: false, error: 'Entry not found' };
    }

    if (this.onEntryDeleted) {
      this.onEntryDeleted(id);
    }

    console.log(`[HistoryManager] Deleted entry: ${id}`);

    return { success: true, id };
  }

  /**
   * Delete entries within a time range
   * @param {Date|number} startTime - Start time
   * @param {Date|number} endTime - End time
   * @returns {Object} Result with deleted count
   */
  deleteRange(startTime, endTime) {
    if (!startTime || !endTime) {
      return { success: false, error: 'Start and end times are required' };
    }

    const count = this.storage.deleteRange(startTime, endTime);

    console.log(`[HistoryManager] Deleted ${count} entries in time range`);

    return {
      success: true,
      deletedCount: count
    };
  }

  /**
   * Clear all history
   * @returns {Object} Result with deleted count
   */
  clearHistory() {
    const count = this.storage.clear();

    // Clear active tracking
    this.activePages.clear();

    if (this.onHistoryCleared) {
      this.onHistoryCleared();
    }

    console.log(`[HistoryManager] Cleared ${count} entries`);

    return {
      success: true,
      deletedCount: count
    };
  }

  /**
   * Get visit count for a URL
   * @param {string} url - URL to check
   * @returns {Object} Result with visit count
   */
  getVisitCount(url) {
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    const count = this.storage.getVisitCount(url);

    return {
      success: true,
      url,
      visitCount: count
    };
  }

  /**
   * Get most visited URLs
   * @param {number} limit - Number of results
   * @returns {Object} Result with most visited URLs
   */
  getMostVisited(limit = 10) {
    const results = this.storage.getMostVisited(limit);

    return {
      success: true,
      total: results.length,
      entries: results
    };
  }

  /**
   * Export history
   * @param {string} format - Export format ('json' or 'csv')
   * @returns {Object} Result with exported data
   */
  exportHistory(format = 'json') {
    let data;
    let mimeType;

    switch (format.toLowerCase()) {
      case 'csv':
        data = this.storage.exportAsCSV();
        mimeType = 'text/csv';
        break;
      case 'json':
      default:
        data = this.storage.exportAsJSON();
        mimeType = 'application/json';
        break;
    }

    return {
      success: true,
      format,
      mimeType,
      data
    };
  }

  /**
   * Import history
   * @param {Object|Array} data - Data to import
   * @param {Object} options - Import options
   * @returns {Object} Result with imported count
   */
  importHistory(data, options = {}) {
    if (!data) {
      return { success: false, error: 'Data is required' };
    }

    let entries;

    // Handle different data formats
    if (Array.isArray(data)) {
      entries = data;
    } else if (data.entries && Array.isArray(data.entries)) {
      entries = data.entries;
    } else {
      return { success: false, error: 'Invalid data format' };
    }

    const count = this.storage.import(entries, options);

    console.log(`[HistoryManager] Imported ${count} entries`);

    return {
      success: true,
      importedCount: count
    };
  }

  /**
   * Get history statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      success: true,
      stats: {
        totalEntries: this.storage.getCount(),
        uniqueUrls: this.storage.getUniqueUrlCount(),
        activePages: this.activePages.size
      }
    };
  }

  /**
   * Enforce maximum entries limit
   */
  enforceMaxEntries() {
    const count = this.storage.getCount();
    if (count > this.maxEntries) {
      // Get oldest entries
      const entries = this.storage.getAllEntries({ limit: count, offset: 0 });
      entries.sort((a, b) => new Date(a.visitTime) - new Date(b.visitTime));

      // Delete oldest entries
      const toDelete = count - this.maxEntries;
      for (let i = 0; i < toDelete; i++) {
        this.storage.deleteEntry(entries[i].id);
      }

      console.log(`[HistoryManager] Removed ${toDelete} oldest entries to enforce limit`);
    }
  }

  /**
   * Handle tab closed event
   * @param {string} tabId - Tab ID
   */
  onTabClosed(tabId) {
    this.endPageTracking(tabId);
  }

  /**
   * Handle navigation start event
   * @param {Object} details - Navigation details
   * @returns {Object} Result with entry
   */
  onNavigationStart(details) {
    const { url, tabId, referrer, transitionType } = details;

    // End tracking for previous page
    if (tabId) {
      this.endPageTracking(tabId);
    }

    // Add new entry (title will be updated later)
    return this.addEntry(url, '', referrer, {
      tabId,
      transitionType
    });
  }

  /**
   * Handle page load complete event
   * @param {Object} details - Load details
   */
  onPageLoadComplete(details) {
    const { tabId, title, favicon } = details;

    const tracking = this.activePages.get(tabId);
    if (tracking) {
      const entry = this.storage.getEntry(tracking.entryId);
      if (entry) {
        if (title) entry.title = title;
        if (favicon) entry.favicon = favicon;
        this.storage.save();
      }
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // End all active page tracking
    for (const [tabId] of this.activePages) {
      this.endPageTracking(tabId);
    }

    this.storage.cleanup();
    console.log('[HistoryManager] Cleanup complete');
  }
}

module.exports = {
  HistoryEntry,
  HistoryManager
};

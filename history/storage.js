/**
 * Basset Hound Browser - History Storage
 * Provides persistent storage for browsing history using JSON file storage
 * with indexing by URL and timestamp for efficient queries
 */

const fs = require('fs');
const path = require('path');

/**
 * HistoryStorage class
 * Handles persistent storage of history entries with indexing
 */
class HistoryStorage {
  constructor(dataPath) {
    this.dataPath = dataPath || path.join(process.cwd(), 'history-data');
    this.historyFile = path.join(this.dataPath, 'history.json');
    this.indexFile = path.join(this.dataPath, 'history-index.json');

    // In-memory cache
    this.entries = [];
    this.urlIndex = new Map(); // URL -> array of entry IDs
    this.timestampIndex = []; // Sorted array of { timestamp, id }

    // Auto-save timer
    this.saveTimer = null;
    this.dirty = false;

    // Initialize storage
    this.ensureDataDirectory();
    this.load();
  }

  /**
   * Ensure the data directory exists
   */
  ensureDataDirectory() {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * Load history from disk
   */
  load() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf-8'));
        this.entries = data.entries || [];

        // Rebuild indexes
        this.rebuildIndexes();

        console.log(`[HistoryStorage] Loaded ${this.entries.length} history entries`);
      }
    } catch (error) {
      console.error('[HistoryStorage] Error loading history:', error);
      this.entries = [];
      this.rebuildIndexes();
    }
  }

  /**
   * Rebuild all indexes from entries
   */
  rebuildIndexes() {
    this.urlIndex.clear();
    this.timestampIndex = [];

    for (const entry of this.entries) {
      // URL index
      const normalizedUrl = this.normalizeUrl(entry.url);
      if (!this.urlIndex.has(normalizedUrl)) {
        this.urlIndex.set(normalizedUrl, []);
      }
      this.urlIndex.get(normalizedUrl).push(entry.id);

      // Timestamp index
      this.timestampIndex.push({
        timestamp: new Date(entry.visitTime).getTime(),
        id: entry.id
      });
    }

    // Sort timestamp index
    this.timestampIndex.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Normalize URL for indexing
   * @param {string} url - URL to normalize
   * @returns {string} Normalized URL
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove trailing slash for consistency
      let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Save history to disk
   * @param {boolean} force - Force immediate save
   */
  save(force = false) {
    this.dirty = true;

    if (force) {
      this._saveNow();
    } else {
      // Debounce saves
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
      }
      this.saveTimer = setTimeout(() => {
        this._saveNow();
      }, 1000);
    }
  }

  /**
   * Perform immediate save
   */
  _saveNow() {
    if (!this.dirty) return;

    try {
      const data = {
        version: '1.0',
        lastModified: new Date().toISOString(),
        entries: this.entries
      };

      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
      this.dirty = false;

      console.log(`[HistoryStorage] Saved ${this.entries.length} history entries`);
    } catch (error) {
      console.error('[HistoryStorage] Error saving history:', error);
    }
  }

  /**
   * Add an entry to storage
   * @param {Object} entry - History entry
   * @returns {Object} Added entry
   */
  addEntry(entry) {
    // Add to entries array
    this.entries.push(entry);

    // Update URL index
    const normalizedUrl = this.normalizeUrl(entry.url);
    if (!this.urlIndex.has(normalizedUrl)) {
      this.urlIndex.set(normalizedUrl, []);
    }
    this.urlIndex.get(normalizedUrl).push(entry.id);

    // Update timestamp index (insert in sorted position)
    const timestamp = new Date(entry.visitTime).getTime();
    const insertIdx = this.timestampIndex.findIndex(item => item.timestamp < timestamp);
    if (insertIdx === -1) {
      this.timestampIndex.push({ timestamp, id: entry.id });
    } else {
      this.timestampIndex.splice(insertIdx, 0, { timestamp, id: entry.id });
    }

    // Trigger save
    this.save();

    return entry;
  }

  /**
   * Get entry by ID
   * @param {string} id - Entry ID
   * @returns {Object|null} Entry or null
   */
  getEntry(id) {
    return this.entries.find(e => e.id === id) || null;
  }

  /**
   * Get entries by URL
   * @param {string} url - URL to search
   * @returns {Array} Matching entries
   */
  getEntriesByUrl(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const ids = this.urlIndex.get(normalizedUrl) || [];
    return ids.map(id => this.entries.find(e => e.id === id)).filter(Boolean);
  }

  /**
   * Get entries within a time range
   * @param {Date|number} startTime - Start time
   * @param {Date|number} endTime - End time
   * @returns {Array} Matching entries
   */
  getEntriesByTimeRange(startTime, endTime) {
    const start = typeof startTime === 'number' ? startTime : new Date(startTime).getTime();
    const end = typeof endTime === 'number' ? endTime : new Date(endTime).getTime();

    const matchingIds = this.timestampIndex
      .filter(item => item.timestamp >= start && item.timestamp <= end)
      .map(item => item.id);

    return matchingIds.map(id => this.entries.find(e => e.id === id)).filter(Boolean);
  }

  /**
   * Get all entries with optional limit and offset
   * @param {Object} options - Query options
   * @returns {Array} Entries
   */
  getAllEntries(options = {}) {
    const { limit = 100, offset = 0 } = options;

    // Use timestamp index for efficient ordering
    const sortedIds = this.timestampIndex.slice(offset, offset + limit).map(item => item.id);
    return sortedIds.map(id => this.entries.find(e => e.id === id)).filter(Boolean);
  }

  /**
   * Search entries by URL or title
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Matching entries
   */
  search(query, options = {}) {
    const { limit = 100, caseSensitive = false } = options;
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    const results = [];

    for (let i = 0; i < this.timestampIndex.length && results.length < limit; i++) {
      const entry = this.entries.find(e => e.id === this.timestampIndex[i].id);
      if (!entry) continue;

      const urlMatch = caseSensitive
        ? entry.url.includes(searchQuery)
        : entry.url.toLowerCase().includes(searchQuery);
      const titleMatch = entry.title && (caseSensitive
        ? entry.title.includes(searchQuery)
        : entry.title.toLowerCase().includes(searchQuery));

      if (urlMatch || titleMatch) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * Delete entry by ID
   * @param {string} id - Entry ID
   * @returns {boolean} Success
   */
  deleteEntry(id) {
    const index = this.entries.findIndex(e => e.id === id);
    if (index === -1) return false;

    const entry = this.entries[index];

    // Remove from entries
    this.entries.splice(index, 1);

    // Update URL index
    const normalizedUrl = this.normalizeUrl(entry.url);
    const urlIds = this.urlIndex.get(normalizedUrl);
    if (urlIds) {
      const urlIdx = urlIds.indexOf(id);
      if (urlIdx !== -1) {
        urlIds.splice(urlIdx, 1);
      }
      if (urlIds.length === 0) {
        this.urlIndex.delete(normalizedUrl);
      }
    }

    // Update timestamp index
    const tsIdx = this.timestampIndex.findIndex(item => item.id === id);
    if (tsIdx !== -1) {
      this.timestampIndex.splice(tsIdx, 1);
    }

    this.save();
    return true;
  }

  /**
   * Delete entries within a time range
   * @param {Date|number} startTime - Start time
   * @param {Date|number} endTime - End time
   * @returns {number} Number of deleted entries
   */
  deleteRange(startTime, endTime) {
    const entries = this.getEntriesByTimeRange(startTime, endTime);
    let count = 0;

    for (const entry of entries) {
      if (this.deleteEntry(entry.id)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all history
   * @returns {number} Number of deleted entries
   */
  clear() {
    const count = this.entries.length;

    this.entries = [];
    this.urlIndex.clear();
    this.timestampIndex = [];

    this.save(true);

    return count;
  }

  /**
   * Get visit count for a URL
   * @param {string} url - URL to check
   * @returns {number} Visit count
   */
  getVisitCount(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const ids = this.urlIndex.get(normalizedUrl);
    return ids ? ids.length : 0;
  }

  /**
   * Get most visited URLs
   * @param {number} limit - Number of results
   * @returns {Array} Most visited URLs with counts
   */
  getMostVisited(limit = 10) {
    const urlCounts = [];

    for (const [url, ids] of this.urlIndex.entries()) {
      urlCounts.push({
        url,
        count: ids.length,
        lastVisit: this.getLatestVisit(ids)
      });
    }

    // Sort by count descending, then by last visit
    urlCounts.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.lastVisit) - new Date(a.lastVisit);
    });

    return urlCounts.slice(0, limit);
  }

  /**
   * Get the latest visit time from a list of entry IDs
   * @param {Array} ids - Entry IDs
   * @returns {string} Latest visit time
   */
  getLatestVisit(ids) {
    let latest = null;

    for (const id of ids) {
      const entry = this.entries.find(e => e.id === id);
      if (entry) {
        const time = new Date(entry.visitTime);
        if (!latest || time > latest) {
          latest = time;
        }
      }
    }

    return latest ? latest.toISOString() : null;
  }

  /**
   * Get total entry count
   * @returns {number} Entry count
   */
  getCount() {
    return this.entries.length;
  }

  /**
   * Get unique URL count
   * @returns {number} Unique URL count
   */
  getUniqueUrlCount() {
    return this.urlIndex.size;
  }

  /**
   * Export all entries as JSON
   * @returns {Object} Export data
   */
  exportAsJSON() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      totalEntries: this.entries.length,
      entries: this.entries
    };
  }

  /**
   * Export entries as CSV
   * @returns {string} CSV data
   */
  exportAsCSV() {
    const headers = ['id', 'url', 'title', 'visitTime', 'visitDuration', 'referrer'];
    const rows = [headers.join(',')];

    for (const entry of this.entries) {
      const row = [
        entry.id,
        `"${(entry.url || '').replace(/"/g, '""')}"`,
        `"${(entry.title || '').replace(/"/g, '""')}"`,
        entry.visitTime,
        entry.visitDuration || '',
        `"${(entry.referrer || '').replace(/"/g, '""')}"`
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Import entries from data
   * @param {Array} entries - Entries to import
   * @param {Object} options - Import options
   * @returns {number} Number of imported entries
   */
  import(entries, options = {}) {
    const { overwrite = false } = options;

    if (overwrite) {
      this.clear();
    }

    let count = 0;
    for (const entry of entries) {
      // Ensure unique ID
      if (!entry.id) {
        entry.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      } else if (this.entries.some(e => e.id === entry.id)) {
        entry.id = `${entry.id}-${Date.now()}`;
      }

      this.addEntry(entry);
      count++;
    }

    return count;
  }

  /**
   * Cleanup and save before shutdown
   */
  cleanup() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this._saveNow();
    console.log('[HistoryStorage] Cleanup complete');
  }
}

module.exports = HistoryStorage;

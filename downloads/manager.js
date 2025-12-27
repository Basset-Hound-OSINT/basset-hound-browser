/**
 * Download Manager for Basset Hound Browser
 * Provides complete download management functionality with events and state tracking
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * Download states
 */
const DOWNLOAD_STATE = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Download class representing a single download
 */
class Download {
  constructor(options = {}) {
    this.id = options.id || `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.url = options.url || '';
    this.filename = options.filename || '';
    this.path = options.path || '';
    this.size = options.size || 0;
    this.received = options.received || 0;
    this.state = options.state || DOWNLOAD_STATE.PENDING;
    this.startTime = options.startTime || Date.now();
    this.endTime = options.endTime || null;
    this.mimeType = options.mimeType || '';
    this.error = options.error || null;
    this.speed = 0;
    this.lastSpeedUpdate = Date.now();
    this.lastReceived = 0;

    // Reference to Electron's DownloadItem (not serializable)
    this._downloadItem = null;
  }

  /**
   * Get download progress as percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    if (this.size === 0) return 0;
    return Math.min(100, Math.round((this.received / this.size) * 100));
  }

  /**
   * Get estimated time remaining in seconds
   * @returns {number|null} Estimated seconds remaining or null if unknown
   */
  getETA() {
    if (this.speed === 0 || this.size === 0) return null;
    const remaining = this.size - this.received;
    return Math.ceil(remaining / this.speed);
  }

  /**
   * Update download speed based on bytes received
   */
  updateSpeed() {
    const now = Date.now();
    const timeDelta = (now - this.lastSpeedUpdate) / 1000; // Convert to seconds

    if (timeDelta >= 1) { // Update speed every second
      const bytesDelta = this.received - this.lastReceived;
      this.speed = Math.round(bytesDelta / timeDelta);
      this.lastSpeedUpdate = now;
      this.lastReceived = this.received;
    }
  }

  /**
   * Format speed as human-readable string
   * @returns {string} Formatted speed string
   */
  getFormattedSpeed() {
    return formatBytes(this.speed) + '/s';
  }

  /**
   * Get serializable download info
   * @returns {Object} Download info object
   */
  toJSON() {
    return {
      id: this.id,
      url: this.url,
      filename: this.filename,
      path: this.path,
      size: this.size,
      received: this.received,
      state: this.state,
      startTime: this.startTime,
      endTime: this.endTime,
      mimeType: this.mimeType,
      error: this.error,
      progress: this.getProgress(),
      speed: this.speed,
      formattedSpeed: this.getFormattedSpeed(),
      eta: this.getETA(),
      formattedSize: formatBytes(this.size),
      formattedReceived: formatBytes(this.received)
    };
  }
}

/**
 * DownloadManager class - manages all downloads
 */
class DownloadManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.downloads = new Map();
    this.downloadPath = options.downloadPath || app.getPath('downloads');
    this.maxConcurrentDownloads = options.maxConcurrentDownloads || 5;
    this.autoOpenCompleted = options.autoOpenCompleted || false;

    // Queue for pending downloads when max concurrent is reached
    this.queue = [];

    // Ensure download directory exists
    this._ensureDownloadDirectory();

    console.log(`[DownloadManager] Initialized with download path: ${this.downloadPath}`);
  }

  /**
   * Ensure download directory exists
   * @private
   */
  _ensureDownloadDirectory() {
    try {
      if (!fs.existsSync(this.downloadPath)) {
        fs.mkdirSync(this.downloadPath, { recursive: true });
      }
    } catch (error) {
      console.error('[DownloadManager] Failed to create download directory:', error);
    }
  }

  /**
   * Set the default download directory
   * @param {string} downloadPath - Path to set as default download directory
   * @returns {Object} Result object
   */
  setDownloadPath(downloadPath) {
    try {
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      this.downloadPath = downloadPath;
      console.log(`[DownloadManager] Download path set to: ${downloadPath}`);

      return {
        success: true,
        downloadPath: this.downloadPath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get the current download directory
   * @returns {string} Current download path
   */
  getDownloadPath() {
    return this.downloadPath;
  }

  /**
   * Start a new download (programmatic)
   * Note: This creates a download record. Actual downloading is handled by Electron's will-download
   * @param {string} url - URL to download
   * @param {Object} options - Download options
   * @returns {Object} Result object with download info
   */
  startDownload(url, options = {}) {
    const download = new Download({
      url,
      filename: options.filename || this._extractFilename(url),
      path: options.path || path.join(this.downloadPath, options.filename || this._extractFilename(url)),
      state: DOWNLOAD_STATE.PENDING
    });

    this.downloads.set(download.id, download);

    this.emit('download-started', download.toJSON());

    console.log(`[DownloadManager] Download started: ${download.id} - ${url}`);

    return {
      success: true,
      download: download.toJSON()
    };
  }

  /**
   * Register a download from Electron's will-download event
   * @param {DownloadItem} downloadItem - Electron DownloadItem
   * @param {WebContents} webContents - WebContents that initiated the download
   * @returns {Download} Download instance
   */
  registerDownload(downloadItem, webContents) {
    const url = downloadItem.getURL();
    const filename = downloadItem.getFilename();
    const savePath = path.join(this.downloadPath, filename);

    // Check for existing pending download with same URL
    let download = Array.from(this.downloads.values()).find(
      d => d.url === url && d.state === DOWNLOAD_STATE.PENDING
    );

    if (!download) {
      download = new Download({
        url,
        filename,
        path: savePath,
        size: downloadItem.getTotalBytes(),
        mimeType: downloadItem.getMimeType(),
        state: DOWNLOAD_STATE.IN_PROGRESS
      });
      this.downloads.set(download.id, download);
    } else {
      download.filename = filename;
      download.path = savePath;
      download.size = downloadItem.getTotalBytes();
      download.mimeType = downloadItem.getMimeType();
      download.state = DOWNLOAD_STATE.IN_PROGRESS;
    }

    // Store reference to downloadItem for pause/resume/cancel
    download._downloadItem = downloadItem;

    // Set save path
    downloadItem.setSavePath(savePath);

    // Setup downloadItem event handlers
    this._setupDownloadItemHandlers(download, downloadItem);

    this.emit('download-started', download.toJSON());

    console.log(`[DownloadManager] Download registered: ${download.id} - ${filename}`);

    return download;
  }

  /**
   * Setup event handlers for DownloadItem
   * @private
   */
  _setupDownloadItemHandlers(download, downloadItem) {
    downloadItem.on('updated', (event, state) => {
      download.received = downloadItem.getReceivedBytes();
      download.size = downloadItem.getTotalBytes();
      download.updateSpeed();

      if (state === 'interrupted') {
        download.state = DOWNLOAD_STATE.PAUSED;
      } else if (state === 'progressing') {
        if (downloadItem.isPaused()) {
          download.state = DOWNLOAD_STATE.PAUSED;
        } else {
          download.state = DOWNLOAD_STATE.IN_PROGRESS;
        }
      }

      this.emit('download-progress', download.toJSON());
    });

    downloadItem.once('done', (event, state) => {
      download.endTime = Date.now();
      download._downloadItem = null; // Clear reference

      if (state === 'completed') {
        download.state = DOWNLOAD_STATE.COMPLETED;
        download.received = download.size;
        this.emit('download-completed', download.toJSON());
        console.log(`[DownloadManager] Download completed: ${download.id} - ${download.filename}`);
      } else if (state === 'cancelled') {
        download.state = DOWNLOAD_STATE.CANCELLED;
        this.emit('download-cancelled', download.toJSON());
        console.log(`[DownloadManager] Download cancelled: ${download.id}`);
      } else {
        download.state = DOWNLOAD_STATE.FAILED;
        download.error = `Download failed with state: ${state}`;
        this.emit('download-failed', download.toJSON());
        console.log(`[DownloadManager] Download failed: ${download.id} - ${state}`);
      }

      // Process next item in queue
      this._processQueue();
    });
  }

  /**
   * Process queued downloads
   * @private
   */
  _processQueue() {
    const activeCount = this.getActiveDownloads().downloads.length;

    while (this.queue.length > 0 && activeCount < this.maxConcurrentDownloads) {
      const nextDownload = this.queue.shift();
      // Re-trigger download if it was queued
      // This would require integration with the browser to initiate the download
      console.log(`[DownloadManager] Processing queued download: ${nextDownload.id}`);
    }
  }

  /**
   * Pause a download
   * @param {string} id - Download ID
   * @returns {Object} Result object
   */
  pauseDownload(id) {
    const download = this.downloads.get(id);

    if (!download) {
      return { success: false, error: 'Download not found' };
    }

    if (download.state !== DOWNLOAD_STATE.IN_PROGRESS) {
      return { success: false, error: 'Download is not in progress' };
    }

    if (!download._downloadItem) {
      return { success: false, error: 'Download item not available' };
    }

    try {
      download._downloadItem.pause();
      download.state = DOWNLOAD_STATE.PAUSED;

      console.log(`[DownloadManager] Download paused: ${id}`);

      return {
        success: true,
        download: download.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Resume a paused download
   * @param {string} id - Download ID
   * @returns {Object} Result object
   */
  resumeDownload(id) {
    const download = this.downloads.get(id);

    if (!download) {
      return { success: false, error: 'Download not found' };
    }

    if (download.state !== DOWNLOAD_STATE.PAUSED) {
      return { success: false, error: 'Download is not paused' };
    }

    if (!download._downloadItem) {
      return { success: false, error: 'Download item not available' };
    }

    if (!download._downloadItem.canResume()) {
      return { success: false, error: 'Download cannot be resumed' };
    }

    try {
      download._downloadItem.resume();
      download.state = DOWNLOAD_STATE.IN_PROGRESS;

      console.log(`[DownloadManager] Download resumed: ${id}`);

      return {
        success: true,
        download: download.toJSON()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a download
   * @param {string} id - Download ID
   * @returns {Object} Result object
   */
  cancelDownload(id) {
    const download = this.downloads.get(id);

    if (!download) {
      return { success: false, error: 'Download not found' };
    }

    if (download.state === DOWNLOAD_STATE.COMPLETED ||
        download.state === DOWNLOAD_STATE.CANCELLED) {
      return { success: false, error: 'Download already finished' };
    }

    if (download._downloadItem) {
      try {
        download._downloadItem.cancel();
      } catch (error) {
        console.error('[DownloadManager] Error cancelling download:', error);
      }
    }

    download.state = DOWNLOAD_STATE.CANCELLED;
    download.endTime = Date.now();
    download._downloadItem = null;

    this.emit('download-cancelled', download.toJSON());

    console.log(`[DownloadManager] Download cancelled: ${id}`);

    return {
      success: true,
      download: download.toJSON()
    };
  }

  /**
   * Get download info by ID
   * @param {string} id - Download ID
   * @returns {Object} Result object with download info
   */
  getDownload(id) {
    const download = this.downloads.get(id);

    if (!download) {
      return { success: false, error: 'Download not found' };
    }

    return {
      success: true,
      download: download.toJSON()
    };
  }

  /**
   * Get all active downloads (in progress or paused)
   * @returns {Object} Result object with active downloads
   */
  getActiveDownloads() {
    const active = Array.from(this.downloads.values())
      .filter(d => d.state === DOWNLOAD_STATE.IN_PROGRESS || d.state === DOWNLOAD_STATE.PAUSED)
      .map(d => d.toJSON());

    return {
      success: true,
      downloads: active,
      count: active.length
    };
  }

  /**
   * Get all completed downloads
   * @returns {Object} Result object with completed downloads
   */
  getCompletedDownloads() {
    const completed = Array.from(this.downloads.values())
      .filter(d => d.state === DOWNLOAD_STATE.COMPLETED)
      .map(d => d.toJSON());

    return {
      success: true,
      downloads: completed,
      count: completed.length
    };
  }

  /**
   * Get all downloads with optional filtering
   * @param {Object} options - Filter options
   * @returns {Object} Result object with downloads
   */
  getAllDownloads(options = {}) {
    let downloads = Array.from(this.downloads.values());

    // Filter by state if specified
    if (options.state) {
      downloads = downloads.filter(d => d.state === options.state);
    }

    // Sort by start time (newest first)
    downloads.sort((a, b) => b.startTime - a.startTime);

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      downloads = downloads.slice(0, options.limit);
    }

    return {
      success: true,
      downloads: downloads.map(d => d.toJSON()),
      count: downloads.length,
      total: this.downloads.size
    };
  }

  /**
   * Clear completed download history
   * @returns {Object} Result object
   */
  clearCompleted() {
    const idsToRemove = [];

    for (const [id, download] of this.downloads.entries()) {
      if (download.state === DOWNLOAD_STATE.COMPLETED ||
          download.state === DOWNLOAD_STATE.CANCELLED ||
          download.state === DOWNLOAD_STATE.FAILED) {
        idsToRemove.push(id);
      }
    }

    idsToRemove.forEach(id => this.downloads.delete(id));

    console.log(`[DownloadManager] Cleared ${idsToRemove.length} completed downloads`);

    return {
      success: true,
      cleared: idsToRemove.length
    };
  }

  /**
   * Clear all downloads (active downloads will be cancelled)
   * @returns {Object} Result object
   */
  clearAll() {
    // Cancel any active downloads
    for (const download of this.downloads.values()) {
      if (download._downloadItem) {
        try {
          download._downloadItem.cancel();
        } catch (error) {
          // Ignore errors when cancelling
        }
      }
    }

    const count = this.downloads.size;
    this.downloads.clear();
    this.queue = [];

    console.log(`[DownloadManager] Cleared all ${count} downloads`);

    return {
      success: true,
      cleared: count
    };
  }

  /**
   * Get download manager status
   * @returns {Object} Status object
   */
  getStatus() {
    const all = Array.from(this.downloads.values());

    return {
      downloadPath: this.downloadPath,
      total: all.length,
      active: all.filter(d => d.state === DOWNLOAD_STATE.IN_PROGRESS).length,
      paused: all.filter(d => d.state === DOWNLOAD_STATE.PAUSED).length,
      completed: all.filter(d => d.state === DOWNLOAD_STATE.COMPLETED).length,
      failed: all.filter(d => d.state === DOWNLOAD_STATE.FAILED).length,
      cancelled: all.filter(d => d.state === DOWNLOAD_STATE.CANCELLED).length,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrentDownloads
    };
  }

  /**
   * Extract filename from URL
   * @private
   */
  _extractFilename(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || 'download';
      return decodeURIComponent(filename);
    } catch (error) {
      return 'download';
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Cancel any active downloads
    for (const download of this.downloads.values()) {
      if (download._downloadItem) {
        try {
          download._downloadItem.cancel();
        } catch (error) {
          // Ignore errors
        }
      }
    }

    this.removeAllListeners();
    console.log('[DownloadManager] Cleanup complete');
  }
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

module.exports = {
  Download,
  DownloadManager,
  DOWNLOAD_STATE,
  formatBytes
};

/**
 * Basset Hound Browser - Auto-Update Manager
 * Handles checking, downloading, and installing updates using electron-updater
 * Supports GitHub releases, delta updates, and rollback capability
 */

const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

/**
 * Update status states
 */
const UPDATE_STATUS = {
  IDLE: 'idle',
  CHECKING: 'checking',
  AVAILABLE: 'available',
  NOT_AVAILABLE: 'not-available',
  DOWNLOADING: 'downloading',
  DOWNLOADED: 'downloaded',
  ERROR: 'error',
  INSTALLING: 'installing'
};

/**
 * UpdateManager Class
 * Manages the complete update lifecycle for the Electron application
 */
class UpdateManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration options with defaults
    this.config = {
      autoDownload: options.autoDownload !== undefined ? options.autoDownload : false,
      autoInstallOnAppQuit: options.autoInstallOnAppQuit !== undefined ? options.autoInstallOnAppQuit : true,
      allowPrerelease: options.allowPrerelease !== undefined ? options.allowPrerelease : false,
      allowDowngrade: options.allowDowngrade !== undefined ? options.allowDowngrade : false,
      checkInterval: options.checkInterval || 3600000, // 1 hour default
      channel: options.channel || 'latest',
      provider: options.provider || 'github',
      owner: options.owner || null,
      repo: options.repo || null,
      feedUrl: options.feedUrl || null,
      maxPreviousVersions: options.maxPreviousVersions || 5
    };

    // Current state
    this.status = UPDATE_STATUS.IDLE;
    this.currentVersion = app.getVersion();
    this.updateInfo = null;
    this.downloadProgress = null;
    this.error = null;
    this.checkTimer = null;

    // Version history for rollback support
    this.versionHistoryPath = path.join(app.getPath('userData'), 'version-history.json');
    this.versionHistory = this.loadVersionHistory();

    // Update history for tracking
    this.updateHistoryPath = path.join(app.getPath('userData'), 'update-history.json');
    this.updateHistory = this.loadUpdateHistory();

    // Reference to main window for IPC
    this.mainWindow = null;

    // Initialize autoUpdater
    this.initializeAutoUpdater();

    console.log('[UpdateManager] Initialized with version:', this.currentVersion);
  }

  /**
   * Initialize electron-updater with configuration and event handlers
   */
  initializeAutoUpdater() {
    // Configure autoUpdater
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
    autoUpdater.allowPrerelease = this.config.allowPrerelease;
    autoUpdater.allowDowngrade = this.config.allowDowngrade;
    autoUpdater.channel = this.config.channel;

    // Set feed URL if custom provider
    if (this.config.feedUrl) {
      autoUpdater.setFeedURL(this.config.feedUrl);
    } else if (this.config.provider === 'github' && this.config.owner && this.config.repo) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: this.config.owner,
        repo: this.config.repo
      });
    }

    // Enable delta updates (differential downloads)
    autoUpdater.disableDifferentialDownload = false;

    // Logging
    autoUpdater.logger = {
      info: (msg) => console.log('[AutoUpdater]', msg),
      warn: (msg) => console.warn('[AutoUpdater]', msg),
      error: (msg) => console.error('[AutoUpdater]', msg),
      debug: (msg) => console.log('[AutoUpdater Debug]', msg)
    };

    // Event handlers
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for autoUpdater
   */
  setupEventHandlers() {
    // Checking for update
    autoUpdater.on('checking-for-update', () => {
      this.setStatus(UPDATE_STATUS.CHECKING);
      this.emit('checking');
      this.notifyRenderer('update-status', { status: 'checking' });
      console.log('[UpdateManager] Checking for updates...');
    });

    // Update available
    autoUpdater.on('update-available', (info) => {
      this.setStatus(UPDATE_STATUS.AVAILABLE);
      this.updateInfo = info;
      this.emit('available', info);
      this.notifyRenderer('update-available', info);
      console.log('[UpdateManager] Update available:', info.version);

      // Record in history that an update was found
      this.recordUpdateEvent('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
    });

    // Update not available
    autoUpdater.on('update-not-available', (info) => {
      this.setStatus(UPDATE_STATUS.NOT_AVAILABLE);
      this.updateInfo = info;
      this.emit('not-available', info);
      this.notifyRenderer('update-status', { status: 'not-available', info });
      console.log('[UpdateManager] No updates available. Current version:', info.version);
    });

    // Download progress
    autoUpdater.on('download-progress', (progress) => {
      this.setStatus(UPDATE_STATUS.DOWNLOADING);
      this.downloadProgress = {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferred: progress.transferred,
        total: progress.total,
        delta: progress.delta || false
      };
      this.emit('downloading', this.downloadProgress);
      this.notifyRenderer('update-downloading', this.downloadProgress);
      console.log(`[UpdateManager] Download progress: ${progress.percent.toFixed(1)}%`);
    });

    // Update downloaded
    autoUpdater.on('update-downloaded', (info) => {
      this.setStatus(UPDATE_STATUS.DOWNLOADED);
      this.updateInfo = info;
      this.downloadProgress = { percent: 100 };
      this.emit('downloaded', info);
      this.notifyRenderer('update-downloaded', info);
      console.log('[UpdateManager] Update downloaded:', info.version);

      // Save current version before update for rollback
      this.saveVersionForRollback();

      // Record download completion
      this.recordUpdateEvent('update-downloaded', {
        version: info.version,
        downloadedAt: new Date().toISOString()
      });
    });

    // Error handling
    autoUpdater.on('error', (error) => {
      this.setStatus(UPDATE_STATUS.ERROR);
      this.error = {
        message: error.message,
        stack: error.stack,
        code: error.code
      };
      this.emit('error', this.error);
      this.notifyRenderer('update-error', this.error);
      console.error('[UpdateManager] Update error:', error.message);

      // Record error
      this.recordUpdateEvent('update-error', {
        error: error.message,
        code: error.code
      });
    });
  }

  /**
   * Set the main window reference for IPC notifications
   * @param {BrowserWindow} window - Main browser window
   */
  setMainWindow(window) {
    this.mainWindow = window;
  }

  /**
   * Set current status and emit change event
   * @param {string} status - New status
   */
  setStatus(status) {
    const oldStatus = this.status;
    this.status = status;
    if (oldStatus !== status) {
      this.emit('status-changed', { oldStatus, newStatus: status });
    }
  }

  /**
   * Notify renderer process via IPC
   * @param {string} channel - IPC channel name
   * @param {*} data - Data to send
   */
  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Check for updates
   * @returns {Promise<Object>} Check result
   */
  async checkForUpdates() {
    try {
      if (this.status === UPDATE_STATUS.CHECKING || this.status === UPDATE_STATUS.DOWNLOADING) {
        return {
          success: false,
          error: 'Update check or download already in progress'
        };
      }

      this.error = null;
      const result = await autoUpdater.checkForUpdates();

      return {
        success: true,
        updateInfo: result?.updateInfo || null,
        updateAvailable: this.status === UPDATE_STATUS.AVAILABLE
      };
    } catch (error) {
      console.error('[UpdateManager] Check failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download available update
   * @returns {Promise<Object>} Download result
   */
  async downloadUpdate() {
    try {
      // Check status - handle both DOWNLOADING and non-AVAILABLE states
      if (this.status === UPDATE_STATUS.DOWNLOADING) {
        return {
          success: false,
          error: 'Download already in progress'
        };
      }

      if (this.status !== UPDATE_STATUS.AVAILABLE) {
        return {
          success: false,
          error: 'No update available to download'
        };
      }

      await autoUpdater.downloadUpdate();

      return {
        success: true,
        message: 'Download started'
      };
    } catch (error) {
      console.error('[UpdateManager] Download failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Install update and restart application
   * @param {boolean} isSilent - Install silently (no user prompts)
   * @param {boolean} isForceRunAfter - Force run after install
   * @returns {Object} Install result
   */
  installUpdate(isSilent = false, isForceRunAfter = true) {
    try {
      if (this.status !== UPDATE_STATUS.DOWNLOADED) {
        return {
          success: false,
          error: 'No update downloaded to install'
        };
      }

      this.setStatus(UPDATE_STATUS.INSTALLING);
      this.notifyRenderer('update-status', { status: 'installing' });

      // Record installation attempt
      this.recordUpdateEvent('update-installing', {
        version: this.updateInfo?.version,
        previousVersion: this.currentVersion
      });

      // This will quit the app and install the update
      autoUpdater.quitAndInstall(isSilent, isForceRunAfter);

      return {
        success: true,
        message: 'Installing update and restarting...'
      };
    } catch (error) {
      console.error('[UpdateManager] Install failed:', error.message);
      this.setStatus(UPDATE_STATUS.ERROR);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current update status
   * @returns {Object} Current status
   */
  getStatus() {
    return {
      status: this.status,
      currentVersion: this.currentVersion,
      updateInfo: this.updateInfo,
      downloadProgress: this.downloadProgress,
      error: this.error,
      config: {
        autoDownload: this.config.autoDownload,
        autoInstallOnAppQuit: this.config.autoInstallOnAppQuit,
        allowPrerelease: this.config.allowPrerelease,
        channel: this.config.channel
      }
    };
  }

  /**
   * Configure update settings
   * @param {Object} options - Configuration options
   * @returns {Object} Result
   */
  setConfig(options) {
    try {
      if (options.autoDownload !== undefined) {
        this.config.autoDownload = options.autoDownload;
        autoUpdater.autoDownload = options.autoDownload;
      }

      if (options.autoInstallOnAppQuit !== undefined) {
        this.config.autoInstallOnAppQuit = options.autoInstallOnAppQuit;
        autoUpdater.autoInstallOnAppQuit = options.autoInstallOnAppQuit;
      }

      if (options.allowPrerelease !== undefined) {
        this.config.allowPrerelease = options.allowPrerelease;
        autoUpdater.allowPrerelease = options.allowPrerelease;
      }

      if (options.allowDowngrade !== undefined) {
        this.config.allowDowngrade = options.allowDowngrade;
        autoUpdater.allowDowngrade = options.allowDowngrade;
      }

      if (options.channel !== undefined) {
        this.config.channel = options.channel;
        autoUpdater.channel = options.channel;
      }

      if (options.checkInterval !== undefined) {
        this.config.checkInterval = options.checkInterval;
        // Restart auto-check timer if running
        if (this.checkTimer) {
          this.stopAutoCheck();
          this.startAutoCheck();
        }
      }

      console.log('[UpdateManager] Configuration updated:', this.config);

      return {
        success: true,
        config: this.config
      };
    } catch (error) {
      console.error('[UpdateManager] Config update failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Start automatic update checking at configured interval
   */
  startAutoCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      console.log('[UpdateManager] Running scheduled update check...');
      this.checkForUpdates();
    }, this.config.checkInterval);

    console.log(`[UpdateManager] Auto-check started (interval: ${this.config.checkInterval}ms)`);
  }

  /**
   * Stop automatic update checking
   */
  stopAutoCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('[UpdateManager] Auto-check stopped');
    }
  }

  /**
   * Load version history from disk
   * @returns {Array} Version history
   */
  loadVersionHistory() {
    try {
      if (fs.existsSync(this.versionHistoryPath)) {
        const data = fs.readFileSync(this.versionHistoryPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[UpdateManager] Failed to load version history:', error.message);
    }
    return [];
  }

  /**
   * Save version history to disk
   */
  saveVersionHistory() {
    try {
      fs.writeFileSync(this.versionHistoryPath, JSON.stringify(this.versionHistory, null, 2), 'utf8');
    } catch (error) {
      console.error('[UpdateManager] Failed to save version history:', error.message);
    }
  }

  /**
   * Save current version for potential rollback
   */
  saveVersionForRollback() {
    const versionEntry = {
      version: this.currentVersion,
      appPath: app.getPath('exe'),
      timestamp: new Date().toISOString()
    };

    // Keep configured number of previous versions for rollback (default: 5)
    const maxVersions = this.config.maxPreviousVersions || 5;
    this.versionHistory = [versionEntry, ...this.versionHistory].slice(0, maxVersions);
    this.saveVersionHistory();

    console.log('[UpdateManager] Saved version for rollback:', this.currentVersion);
  }

  /**
   * Get available rollback versions
   * @returns {Array} Available versions for rollback
   */
  getRollbackVersions() {
    // Filter out current version from rollback options
    return this.versionHistory.filter(v => v.version !== this.currentVersion);
  }

  /**
   * Attempt to rollback to a previous version
   * Note: Full rollback requires reinstalling the previous version
   * @param {string} version - Target version to rollback to
   * @returns {Object} Rollback result
   */
  rollback(version) {
    try {
      const targetVersion = this.versionHistory.find(v => v.version === version);

      if (!targetVersion) {
        return {
          success: false,
          error: `Version ${version} not found in rollback history`
        };
      }

      // Record rollback attempt
      this.recordUpdateEvent('rollback-attempt', {
        fromVersion: this.currentVersion,
        toVersion: version
      });

      // For a true rollback, you would need to:
      // 1. Download the previous version from the release server
      // 2. Install it, replacing the current version
      // This is a simplified implementation that stores information for manual rollback

      return {
        success: true,
        message: `Rollback to version ${version} is available`,
        version: targetVersion,
        note: 'Full rollback requires downloading the previous version. Use the download URL from release history.'
      };
    } catch (error) {
      console.error('[UpdateManager] Rollback failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Load update history from disk
   * @returns {Array} Update history
   */
  loadUpdateHistory() {
    try {
      if (fs.existsSync(this.updateHistoryPath)) {
        const data = fs.readFileSync(this.updateHistoryPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('[UpdateManager] Failed to load update history:', error.message);
    }
    return [];
  }

  /**
   * Save update history to disk
   */
  saveUpdateHistory() {
    try {
      fs.writeFileSync(this.updateHistoryPath, JSON.stringify(this.updateHistory, null, 2), 'utf8');
    } catch (error) {
      console.error('[UpdateManager] Failed to save update history:', error.message);
    }
  }

  /**
   * Record an update event to history
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  recordUpdateEvent(event, data) {
    const entry = {
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    this.updateHistory.unshift(entry);

    // Keep last 100 events
    if (this.updateHistory.length > 100) {
      this.updateHistory = this.updateHistory.slice(0, 100);
    }

    this.saveUpdateHistory();
  }

  /**
   * Get update history
   * @param {Object} options - Filter options
   * @returns {Object} Update history
   */
  getUpdateHistory(options = {}) {
    let history = [...this.updateHistory];

    // Filter by event type
    if (options.eventType) {
      history = history.filter(h => h.event === options.eventType);
    }

    // Filter by date range
    if (options.since) {
      const sinceDate = new Date(options.since);
      history = history.filter(h => new Date(h.timestamp) >= sinceDate);
    }

    // Limit results
    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return {
      success: true,
      history,
      currentVersion: this.currentVersion,
      rollbackVersions: this.getRollbackVersions()
    };
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  setupIpcHandlers() {
    // Check for updates
    ipcMain.handle('updater-check', async () => {
      return await this.checkForUpdates();
    });

    // Download update
    ipcMain.handle('updater-download', async () => {
      return await this.downloadUpdate();
    });

    // Install update
    ipcMain.handle('updater-install', async (event, options = {}) => {
      return this.installUpdate(options.silent, options.forceRunAfter);
    });

    // Get status
    ipcMain.handle('updater-status', async () => {
      return this.getStatus();
    });

    // Set config
    ipcMain.handle('updater-config', async (event, options) => {
      return this.setConfig(options);
    });

    // Get history
    ipcMain.handle('updater-history', async (event, options) => {
      return this.getUpdateHistory(options);
    });

    // Rollback
    ipcMain.handle('updater-rollback', async (event, version) => {
      return this.rollback(version);
    });

    console.log('[UpdateManager] IPC handlers registered');
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.stopAutoCheck();
    this.removeAllListeners();
    console.log('[UpdateManager] Cleanup complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton UpdateManager instance
 * @param {Object} options - Options for new instance
 * @returns {UpdateManager} UpdateManager instance
 */
function getUpdateManager(options = {}) {
  if (!instance) {
    instance = new UpdateManager(options);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
function resetUpdateManager() {
  if (instance) {
    instance.cleanup();
    instance = null;
  }
}

module.exports = {
  UpdateManager,
  getUpdateManager,
  resetUpdateManager,
  UPDATE_STATUS
};

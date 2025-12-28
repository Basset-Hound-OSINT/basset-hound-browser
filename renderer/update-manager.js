// Update Manager for Basset Hound Browser
// Handles update events from main process and manages the update notification UI

/**
 * UpdateManager class manages the auto-update lifecycle in the renderer process
 */
class UpdateManager {
  constructor() {
    this.notification = null;
    this.currentUpdateInfo = null;
    this.isInitialized = false;
    this.lastDismissedVersion = null;
    this.checkInterval = null;
    this.autoCheckEnabled = true;
    this.autoCheckIntervalMs = 60 * 60 * 1000; // 1 hour

    // Bind methods to preserve context
    this.handleUpdateAvailable = this.handleUpdateAvailable.bind(this);
    this.handleUpdateDownloading = this.handleUpdateDownloading.bind(this);
    this.handleUpdateDownloaded = this.handleUpdateDownloaded.bind(this);
    this.handleUpdateError = this.handleUpdateError.bind(this);
    this.handleDownloadClick = this.handleDownloadClick.bind(this);
    this.handleInstallClick = this.handleInstallClick.bind(this);
    this.handleDismiss = this.handleDismiss.bind(this);
    this.handleLater = this.handleLater.bind(this);
  }

  /**
   * Initialize the update manager
   */
  init() {
    if (this.isInitialized) {
      console.warn('UpdateManager already initialized');
      return;
    }

    // Create notification component
    this.notification = new UpdateNotification();

    // Set up notification callbacks
    this.notification.setCallbacks({
      onDownload: this.handleDownloadClick,
      onInstall: this.handleInstallClick,
      onDismiss: this.handleDismiss,
      onLater: this.handleLater
    });

    // Set up IPC event listeners
    this.setupEventListeners();

    // Load dismissed version from storage
    this.loadDismissedVersion();

    this.isInitialized = true;
    console.log('UpdateManager initialized');

    // Start auto-check if enabled
    if (this.autoCheckEnabled) {
      this.startAutoCheck();
    }
  }

  /**
   * Set up event listeners for update events from main process
   */
  setupEventListeners() {
    const api = window.electronAPI;
    if (!api) {
      console.error('electronAPI not available for UpdateManager');
      return;
    }

    // Listen for update available
    if (typeof api.onUpdateAvailable === 'function') {
      api.onUpdateAvailable(this.handleUpdateAvailable);
    }

    // Listen for download progress
    if (typeof api.onUpdateDownloading === 'function') {
      api.onUpdateDownloading(this.handleUpdateDownloading);
    }

    // Listen for update downloaded
    if (typeof api.onUpdateDownloaded === 'function') {
      api.onUpdateDownloaded(this.handleUpdateDownloaded);
    }

    // Listen for update errors
    if (typeof api.onUpdateError === 'function') {
      api.onUpdateError(this.handleUpdateError);
    }
  }

  /**
   * Handle update available event
   * @param {Object} info - Update info from main process
   */
  handleUpdateAvailable(info) {
    console.log('Update available:', info);
    this.currentUpdateInfo = info;

    // Check if this version was previously dismissed
    if (this.lastDismissedVersion === info.version) {
      console.log('Update version was previously dismissed, not showing notification');
      return;
    }

    // Show notification
    this.notification.showUpdateAvailable(info);
  }

  /**
   * Handle update downloading progress
   * @param {Object} progress - Download progress info
   */
  handleUpdateDownloading(progress) {
    console.log('Update downloading:', progress);
    this.notification.showDownloading(progress);
  }

  /**
   * Handle update downloaded event
   * @param {Object} info - Update info from main process
   */
  handleUpdateDownloaded(info) {
    console.log('Update downloaded:', info);
    this.currentUpdateInfo = info || this.currentUpdateInfo;
    this.notification.showUpdateReady(this.currentUpdateInfo);

    // Clear dismissed version since update is ready
    this.clearDismissedVersion();
  }

  /**
   * Handle update error event
   * @param {Object|string} error - Error info from main process
   */
  handleUpdateError(error) {
    console.error('Update error:', error);
    this.notification.showError(error);
  }

  /**
   * Handle download button click
   */
  async handleDownloadClick() {
    console.log('Download update clicked');
    const api = window.electronAPI;
    if (api && typeof api.downloadUpdate === 'function') {
      try {
        await api.downloadUpdate();
      } catch (error) {
        console.error('Failed to start download:', error);
        this.notification.showError(error);
      }
    }
  }

  /**
   * Handle install button click
   */
  async handleInstallClick() {
    console.log('Install update clicked');
    const api = window.electronAPI;
    if (api && typeof api.installUpdate === 'function') {
      try {
        await api.installUpdate();
      } catch (error) {
        console.error('Failed to install update:', error);
        this.notification.showError(error);
      }
    }
  }

  /**
   * Handle notification dismiss
   */
  handleDismiss() {
    console.log('Update notification dismissed');
    // If dismissing an available update, save the version to not show again
    if (this.notification.getState() === 'available' && this.currentUpdateInfo) {
      this.saveDismissedVersion(this.currentUpdateInfo.version);
    }
  }

  /**
   * Handle later button click
   */
  handleLater() {
    console.log('User chose to update later');
    // For 'ready' state, just hide the notification but don't dismiss the version
    // The user can still restart manually or through the menu
    if (this.notification.getState() === 'available' && this.currentUpdateInfo) {
      this.saveDismissedVersion(this.currentUpdateInfo.version);
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates() {
    console.log('Checking for updates...');
    const api = window.electronAPI;
    if (api && typeof api.checkForUpdates === 'function') {
      try {
        const result = await api.checkForUpdates();
        console.log('Update check result:', result);
        return result;
      } catch (error) {
        console.error('Failed to check for updates:', error);
        throw error;
      }
    }
  }

  /**
   * Get current update status
   * @returns {Promise<Object>} Update status
   */
  async getUpdateStatus() {
    const api = window.electronAPI;
    if (api && typeof api.getUpdateStatus === 'function') {
      try {
        return await api.getUpdateStatus();
      } catch (error) {
        console.error('Failed to get update status:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Start periodic auto-check for updates
   */
  startAutoCheck() {
    if (this.checkInterval) {
      return;
    }

    // Perform initial check after a short delay
    setTimeout(() => {
      this.checkForUpdates().catch(err => {
        console.log('Auto-check failed (will retry):', err.message);
      });
    }, 5000); // 5 seconds after init

    // Set up periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdates().catch(err => {
        console.log('Auto-check failed (will retry):', err.message);
      });
    }, this.autoCheckIntervalMs);

    console.log('Auto-check enabled, interval:', this.autoCheckIntervalMs, 'ms');
  }

  /**
   * Stop periodic auto-check
   */
  stopAutoCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Auto-check disabled');
    }
  }

  /**
   * Set auto-check interval
   * @param {number} intervalMs - Interval in milliseconds
   */
  setAutoCheckInterval(intervalMs) {
    this.autoCheckIntervalMs = intervalMs;
    if (this.checkInterval) {
      this.stopAutoCheck();
      this.startAutoCheck();
    }
  }

  /**
   * Save dismissed version to localStorage
   * @param {string} version - Version to dismiss
   */
  saveDismissedVersion(version) {
    this.lastDismissedVersion = version;
    try {
      localStorage.setItem('basset-hound-dismissed-update', version);
    } catch (e) {
      console.warn('Could not save dismissed version to localStorage:', e);
    }
  }

  /**
   * Load dismissed version from localStorage
   */
  loadDismissedVersion() {
    try {
      this.lastDismissedVersion = localStorage.getItem('basset-hound-dismissed-update');
    } catch (e) {
      console.warn('Could not load dismissed version from localStorage:', e);
    }
  }

  /**
   * Clear dismissed version
   */
  clearDismissedVersion() {
    this.lastDismissedVersion = null;
    try {
      localStorage.removeItem('basset-hound-dismissed-update');
    } catch (e) {
      console.warn('Could not clear dismissed version from localStorage:', e);
    }
  }

  /**
   * Show update notification manually (for testing or menu trigger)
   */
  showNotification() {
    if (this.currentUpdateInfo) {
      const state = this.notification.getState();
      if (state === 'hidden') {
        // Re-show based on current state
        this.notification.showUpdateAvailable(this.currentUpdateInfo);
      }
    }
  }

  /**
   * Hide update notification
   */
  hideNotification() {
    if (this.notification) {
      this.notification.hide();
    }
  }

  /**
   * Get current update info
   * @returns {Object|null} Current update info
   */
  getCurrentUpdateInfo() {
    return this.currentUpdateInfo;
  }

  /**
   * Check if an update is available
   * @returns {boolean} True if update is available
   */
  isUpdateAvailable() {
    return this.currentUpdateInfo !== null;
  }

  /**
   * Destroy the update manager
   */
  destroy() {
    this.stopAutoCheck();
    if (this.notification) {
      this.notification.destroy();
      this.notification = null;
    }
    this.isInitialized = false;
  }
}

// Create global instance
let updateManager = null;

/**
 * Initialize the update manager (call this when DOM is ready)
 */
function initUpdateManager() {
  if (!updateManager) {
    updateManager = new UpdateManager();
    updateManager.init();
  }
  return updateManager;
}

/**
 * Get the update manager instance
 * @returns {UpdateManager|null} The update manager instance
 */
function getUpdateManager() {
  return updateManager;
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initUpdateManager();
  });
} else {
  // DOM is already ready
  initUpdateManager();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    UpdateManager,
    initUpdateManager,
    getUpdateManager
  };
}

// Make available globally
window.UpdateManager = UpdateManager;
window.initUpdateManager = initUpdateManager;
window.getUpdateManager = getUpdateManager;

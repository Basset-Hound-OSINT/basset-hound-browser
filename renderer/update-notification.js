// Update Notification UI Component for Basset Hound Browser
// Provides toast-style notifications for the auto-update feature

/**
 * UpdateNotification class creates and manages the update notification UI
 */
class UpdateNotification {
  constructor() {
    this.container = null;
    this.state = 'hidden'; // hidden, available, downloading, ready, error
    this.updateInfo = null;
    this.downloadProgress = null;
    this.errorMessage = null;
    this.dismissTimeout = null;
    this.callbacks = {
      onDownload: null,
      onInstall: null,
      onDismiss: null,
      onLater: null
    };

    this.init();
  }

  /**
   * Initialize the notification component
   */
  init() {
    this.createContainer();
    this.bindEvents();
  }

  /**
   * Create the notification container element
   */
  createContainer() {
    // Check if container already exists
    if (document.getElementById('update-notification')) {
      this.container = document.getElementById('update-notification');
      return;
    }

    this.container = document.createElement('div');
    this.container.id = 'update-notification';
    this.container.className = 'update-notification hidden';
    this.container.setAttribute('role', 'alert');
    this.container.setAttribute('aria-live', 'polite');

    document.body.appendChild(this.container);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Delegate click events to the container
    this.container.addEventListener('click', (e) => {
      const target = e.target;

      if (target.classList.contains('update-notification-close')) {
        this.dismiss();
      } else if (target.classList.contains('update-btn-download')) {
        this.handleDownload();
      } else if (target.classList.contains('update-btn-install')) {
        this.handleInstall();
      } else if (target.classList.contains('update-btn-later')) {
        this.handleLater();
      }
    });
  }

  /**
   * Show update available notification
   * @param {Object} info - Update info including version and releaseNotes
   */
  showUpdateAvailable(info) {
    this.state = 'available';
    this.updateInfo = info;
    this.errorMessage = null;

    const version = info.version || 'New version';
    const releaseNotes = info.releaseNotes || '';

    this.container.innerHTML = `
      <div class="update-notification-header">
        <div class="update-notification-title-row">
          <span class="update-notification-icon available">&#8593;</span>
          <h4 class="update-notification-title">Update Available</h4>
        </div>
        <button class="update-notification-close" title="Dismiss" aria-label="Dismiss notification">&#10005;</button>
      </div>
      <div class="update-notification-message">
        A new version <span class="update-notification-version">${this.escapeHtml(version)}</span> is available.
        ${releaseNotes ? `<br><a class="update-release-notes" href="#" onclick="return false;">View release notes</a>` : ''}
      </div>
      <div class="update-notification-actions">
        <button class="update-btn update-btn-secondary update-btn-later">Later</button>
        <button class="update-btn update-btn-primary update-btn-download">Download Now</button>
      </div>
    `;

    this.container.className = 'update-notification update-available';
    this.show();
  }

  /**
   * Show download progress notification
   * @param {Object} progress - Download progress info
   */
  showDownloading(progress) {
    this.state = 'downloading';
    this.downloadProgress = progress;

    const percent = Math.round(progress.percent || 0);
    const bytesPerSecond = progress.bytesPerSecond || 0;
    const transferred = this.formatBytes(progress.transferred || 0);
    const total = this.formatBytes(progress.total || 0);
    const speed = this.formatBytes(bytesPerSecond) + '/s';

    // If we're transitioning from available to downloading, rebuild the UI
    if (!this.container.querySelector('.update-progress-container')) {
      this.container.innerHTML = `
        <div class="update-notification-header">
          <div class="update-notification-title-row">
            <span class="update-notification-icon downloading">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
            </span>
            <h4 class="update-notification-title">Downloading Update</h4>
          </div>
          <button class="update-notification-close" title="Dismiss" aria-label="Dismiss notification">&#10005;</button>
        </div>
        <div class="update-notification-message">
          Downloading update, please wait...
        </div>
        <div class="update-progress-container">
          <div class="update-progress-bar">
            <div class="update-progress-fill" style="width: ${percent}%"></div>
          </div>
          <div class="update-progress-text">
            <span class="update-progress-percent">${percent}%</span>
            <span class="update-progress-details">${transferred} / ${total}</span>
            <span class="update-progress-speed">${speed}</span>
          </div>
        </div>
      `;
      this.container.className = 'update-notification update-downloading';
    } else {
      // Just update the progress values
      const progressFill = this.container.querySelector('.update-progress-fill');
      const progressPercent = this.container.querySelector('.update-progress-percent');
      const progressDetails = this.container.querySelector('.update-progress-details');
      const progressSpeed = this.container.querySelector('.update-progress-speed');

      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (progressDetails) progressDetails.textContent = `${transferred} / ${total}`;
      if (progressSpeed) progressSpeed.textContent = speed;
    }

    this.show();
  }

  /**
   * Show update downloaded/ready notification
   * @param {Object} info - Update info
   */
  showUpdateReady(info) {
    this.state = 'ready';
    this.updateInfo = info;
    this.errorMessage = null;

    const version = info?.version || this.updateInfo?.version || 'New version';

    this.container.innerHTML = `
      <div class="update-notification-header">
        <div class="update-notification-title-row">
          <span class="update-notification-icon ready">&#10003;</span>
          <h4 class="update-notification-title">Update Ready</h4>
        </div>
        <button class="update-notification-close" title="Dismiss" aria-label="Dismiss notification">&#10005;</button>
      </div>
      <div class="update-notification-message">
        Version <span class="update-notification-version">${this.escapeHtml(version)}</span> has been downloaded.
        Restart the browser to apply the update.
      </div>
      <div class="update-notification-actions">
        <button class="update-btn update-btn-secondary update-btn-later">Later</button>
        <button class="update-btn update-btn-primary update-btn-install">Restart to Update</button>
      </div>
    `;

    this.container.className = 'update-notification update-ready';
    this.show();
  }

  /**
   * Show update error notification
   * @param {Object|string} error - Error information
   */
  showError(error) {
    this.state = 'error';
    this.errorMessage = typeof error === 'string' ? error : (error.message || 'An error occurred');

    this.container.innerHTML = `
      <div class="update-notification-header">
        <div class="update-notification-title-row">
          <span class="update-notification-icon error">&#9888;</span>
          <h4 class="update-notification-title">Update Error</h4>
        </div>
        <button class="update-notification-close" title="Dismiss" aria-label="Dismiss notification">&#10005;</button>
      </div>
      <div class="update-notification-message">
        Failed to update the browser.
        <div class="update-error-message">${this.escapeHtml(this.errorMessage)}</div>
      </div>
      <div class="update-notification-actions">
        <button class="update-btn update-btn-secondary update-btn-later">Dismiss</button>
      </div>
    `;

    this.container.className = 'update-notification update-error';
    this.show();

    // Auto-dismiss error after 10 seconds
    this.scheduleAutoDismiss(10000);
  }

  /**
   * Show the notification
   */
  show() {
    this.container.classList.remove('hidden', 'dismissing');
    // Clear any pending auto-dismiss
    this.clearAutoDismiss();
  }

  /**
   * Hide the notification with animation
   */
  hide() {
    this.container.classList.add('dismissing');
    setTimeout(() => {
      this.container.classList.add('hidden');
      this.container.classList.remove('dismissing');
      this.state = 'hidden';
    }, 300);
  }

  /**
   * Dismiss the notification
   */
  dismiss() {
    this.hide();
    if (typeof this.callbacks.onDismiss === 'function') {
      this.callbacks.onDismiss();
    }
  }

  /**
   * Handle download button click
   */
  handleDownload() {
    if (typeof this.callbacks.onDownload === 'function') {
      this.callbacks.onDownload();
    }
  }

  /**
   * Handle install button click
   */
  handleInstall() {
    if (typeof this.callbacks.onInstall === 'function') {
      this.callbacks.onInstall();
    }
  }

  /**
   * Handle later button click
   */
  handleLater() {
    this.hide();
    if (typeof this.callbacks.onLater === 'function') {
      this.callbacks.onLater();
    }
  }

  /**
   * Schedule auto-dismiss after a timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  scheduleAutoDismiss(timeout) {
    this.clearAutoDismiss();
    this.dismissTimeout = setTimeout(() => {
      this.dismiss();
    }, timeout);
  }

  /**
   * Clear any pending auto-dismiss timeout
   */
  clearAutoDismiss() {
    if (this.dismissTimeout) {
      clearTimeout(this.dismissTimeout);
      this.dismissTimeout = null;
    }
  }

  /**
   * Set callback functions
   * @param {Object} callbacks - Object containing callback functions
   */
  setCallbacks(callbacks) {
    Object.assign(this.callbacks, callbacks);
  }

  /**
   * Get current state
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if notification is visible
   * @returns {boolean} True if visible
   */
  isVisible() {
    return this.state !== 'hidden';
  }

  /**
   * Format bytes to human readable string
   * @param {number} bytes - Bytes to format
   * @returns {string} Formatted string
   */
  formatBytes(bytes) {
    if (bytes === undefined || bytes === null || bytes <= 0 || !isFinite(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return '0 B';
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Destroy the notification component
   */
  destroy() {
    this.clearAutoDismiss();
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UpdateNotification;
}

// Make available globally
window.UpdateNotification = UpdateNotification;

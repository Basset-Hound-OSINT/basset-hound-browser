/**
 * Basset Hound Browser - Window Manager
 * Manages multiple browser windows for orchestrated browsing operations
 */

const { BrowserWindow, session } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const { getRandomViewport, getRealisticUserAgent, getEvasionScript } = require('../evasion/fingerprint');

/**
 * Window state enumeration
 */
const WindowState = {
  CREATING: 'creating',
  READY: 'ready',
  LOADING: 'loading',
  IDLE: 'idle',
  BUSY: 'busy',
  RECYCLING: 'recycling',
  CLOSING: 'closing',
  CLOSED: 'closed',
  ERROR: 'error'
};

/**
 * Generate a unique window ID
 * @returns {string} Unique window identifier
 */
function generateWindowId() {
  return `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * BrowserWindowWrapper - Wraps a BrowserWindow with additional metadata and controls
 */
class BrowserWindowWrapper {
  /**
   * Create a new BrowserWindowWrapper
   * @param {Object} options - Window configuration options
   */
  constructor(options = {}) {
    this.id = options.id || generateWindowId();
    this.state = WindowState.CREATING;
    this.browserWindow = null;
    this.createdAt = new Date().toISOString();
    this.lastActivity = new Date().toISOString();
    this.url = options.url || 'about:blank';
    this.title = 'New Window';
    this.partition = options.partition || '';
    this.profileId = options.profileId || null;
    this.metadata = options.metadata || {};
    this.commandQueue = [];
    this.isProcessingCommand = false;
    this.healthCheckFailures = 0;
    this.maxHealthCheckFailures = 3;
  }

  /**
   * Get a serializable representation of the window
   * @returns {Object} Window data object
   */
  toJSON() {
    return {
      id: this.id,
      state: this.state,
      url: this.url,
      title: this.title,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      partition: this.partition,
      profileId: this.profileId,
      metadata: this.metadata,
      isReady: this.state === WindowState.READY || this.state === WindowState.IDLE,
      commandQueueLength: this.commandQueue.length
    };
  }

  /**
   * Update last activity timestamp
   */
  touch() {
    this.lastActivity = new Date().toISOString();
  }

  /**
   * Check if the window is healthy
   * @returns {boolean} True if window is healthy
   */
  isHealthy() {
    if (!this.browserWindow || this.browserWindow.isDestroyed()) {
      return false;
    }
    if (this.state === WindowState.ERROR || this.state === WindowState.CLOSED) {
      return false;
    }
    if (this.healthCheckFailures >= this.maxHealthCheckFailures) {
      return false;
    }
    return true;
  }

  /**
   * Record a health check failure
   */
  recordHealthFailure() {
    this.healthCheckFailures++;
  }

  /**
   * Reset health check failures
   */
  resetHealthFailures() {
    this.healthCheckFailures = 0;
  }
}

/**
 * WindowManager Class
 * Manages creation, tracking, and orchestration of multiple browser windows
 * Extends EventEmitter to provide window lifecycle events
 */
class WindowManager extends EventEmitter {
  /**
   * Create a new WindowManager instance
   * @param {Object} options - Manager configuration options
   */
  constructor(options = {}) {
    super();

    // Window storage: Map of windowId to BrowserWindowWrapper
    this.windows = new Map();

    // Active window ID
    this.activeWindowId = null;

    // Main window reference (the original app window)
    this.mainWindow = options.mainWindow || null;

    // Window pool reference (set later)
    this.windowPool = null;

    // Configuration
    this.maxWindows = options.maxWindows || 20;
    this.defaultHomePage = options.homePage || 'about:blank';
    this.preloadPath = options.preloadPath || path.join(__dirname, '..', 'preload.js');
    this.rendererPath = options.rendererPath || path.join(__dirname, '..', 'renderer', 'index.html');

    // Window creation options defaults
    this.defaultWindowOptions = {
      width: 1280,
      height: 800,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
        webviewTag: true,
        sandbox: false,
        enableBlinkFeatures: ''
      }
    };

    console.log('[WindowManager] Initialized');
  }

  /**
   * Set the window pool reference
   * @param {WindowPool} pool - WindowPool instance
   */
  setWindowPool(pool) {
    this.windowPool = pool;
    console.log('[WindowManager] Window pool attached');
  }

  /**
   * Spawn a new browser window
   * @param {Object} options - Window options
   * @returns {Object} Result with window info
   */
  async spawnWindow(options = {}) {
    const { url, partition, profileId, metadata, show = true, usePool = true } = options;

    // Check max windows limit
    if (this.windows.size >= this.maxWindows) {
      return { success: false, error: `Maximum number of windows (${this.maxWindows}) reached` };
    }

    // Try to get a pre-warmed window from pool
    if (usePool && this.windowPool) {
      const pooledWindow = await this.windowPool.acquire();
      if (pooledWindow) {
        // Configure the pooled window for use
        pooledWindow.profileId = profileId || null;
        pooledWindow.metadata = metadata || {};
        pooledWindow.state = WindowState.READY;

        this.windows.set(pooledWindow.id, pooledWindow);

        // Navigate to URL if provided
        if (url && url !== 'about:blank') {
          await this.navigateWindow(pooledWindow.id, url);
        }

        if (!this.activeWindowId) {
          this.activeWindowId = pooledWindow.id;
        }

        const windowInfo = this.getWindowInfo(pooledWindow.id);
        this.emit('window-spawned', windowInfo);

        console.log(`[WindowManager] Spawned window from pool: ${pooledWindow.id}`);
        return { success: true, window: windowInfo };
      }
    }

    // Create new window
    const wrapper = new BrowserWindowWrapper({
      url: url || this.defaultHomePage,
      partition: partition || '',
      profileId,
      metadata
    });

    try {
      // Get random viewport for fingerprint evasion
      const viewport = getRandomViewport();
      const userAgent = getRealisticUserAgent();

      // Merge window options
      const windowOptions = {
        ...this.defaultWindowOptions,
        width: viewport.width,
        height: viewport.height,
        show,
        x: Math.floor(Math.random() * 100),
        y: Math.floor(Math.random() * 100)
      };

      // Apply partition if specified
      if (partition) {
        windowOptions.webPreferences.partition = partition;
      }

      // Create the BrowserWindow
      const browserWindow = new BrowserWindow(windowOptions);

      // Set user agent
      browserWindow.webContents.setUserAgent(userAgent);

      wrapper.browserWindow = browserWindow;
      wrapper.state = WindowState.LOADING;

      // Setup window event handlers
      this._setupWindowEventHandlers(wrapper);

      // Load the renderer
      await browserWindow.loadFile(this.rendererPath);

      // Navigate to URL if provided
      if (url && url !== 'about:blank') {
        browserWindow.webContents.send('navigate-webview', url);
        wrapper.url = url;
      }

      wrapper.state = WindowState.READY;
      wrapper.touch();

      // Store window
      this.windows.set(wrapper.id, wrapper);

      // Set as active if no active window
      if (!this.activeWindowId) {
        this.activeWindowId = wrapper.id;
      }

      const windowInfo = this.getWindowInfo(wrapper.id);
      this.emit('window-spawned', windowInfo);

      console.log(`[WindowManager] Spawned new window: ${wrapper.id}`);
      return { success: true, window: windowInfo };

    } catch (error) {
      wrapper.state = WindowState.ERROR;
      console.error(`[WindowManager] Failed to spawn window: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup event handlers for a window
   * @param {BrowserWindowWrapper} wrapper - Window wrapper instance
   * @private
   */
  _setupWindowEventHandlers(wrapper) {
    const browserWindow = wrapper.browserWindow;

    browserWindow.on('closed', () => {
      wrapper.state = WindowState.CLOSED;
      this.windows.delete(wrapper.id);

      // Update active window if needed
      if (this.activeWindowId === wrapper.id) {
        const remaining = Array.from(this.windows.keys());
        this.activeWindowId = remaining.length > 0 ? remaining[0] : null;
      }

      this.emit('window-closed', { windowId: wrapper.id, newActiveWindowId: this.activeWindowId });
      console.log(`[WindowManager] Window closed: ${wrapper.id}`);
    });

    browserWindow.on('focus', () => {
      this.activeWindowId = wrapper.id;
      wrapper.touch();
      this.emit('window-focused', { windowId: wrapper.id });
    });

    browserWindow.webContents.on('did-navigate', (event, url) => {
      wrapper.url = url;
      wrapper.touch();
      this.emit('window-navigated', { windowId: wrapper.id, url });
    });

    browserWindow.webContents.on('page-title-updated', (event, title) => {
      wrapper.title = title;
      this.emit('window-title-updated', { windowId: wrapper.id, title });
    });

    browserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      wrapper.recordHealthFailure();
      this.emit('window-load-failed', { windowId: wrapper.id, errorCode, errorDescription });
    });

    browserWindow.webContents.on('crashed', () => {
      wrapper.state = WindowState.ERROR;
      wrapper.recordHealthFailure();
      this.emit('window-crashed', { windowId: wrapper.id });
      console.error(`[WindowManager] Window crashed: ${wrapper.id}`);
    });

    browserWindow.webContents.on('unresponsive', () => {
      wrapper.recordHealthFailure();
      this.emit('window-unresponsive', { windowId: wrapper.id });
      console.warn(`[WindowManager] Window unresponsive: ${wrapper.id}`);
    });

    browserWindow.webContents.on('responsive', () => {
      wrapper.resetHealthFailures();
      this.emit('window-responsive', { windowId: wrapper.id });
    });
  }

  /**
   * Get information about a specific window
   * @param {string} windowId - Window identifier
   * @returns {Object|null} Window info or null if not found
   */
  getWindowInfo(windowId) {
    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return null;
    }
    return {
      ...wrapper.toJSON(),
      isActive: windowId === this.activeWindowId
    };
  }

  /**
   * Get list of all windows
   * @param {Object} options - Filter options
   * @returns {Object} Windows list
   */
  listWindows(options = {}) {
    const { state, profileId } = options;

    let windowsList = Array.from(this.windows.values()).map(wrapper => ({
      ...wrapper.toJSON(),
      isActive: wrapper.id === this.activeWindowId
    }));

    // Filter by state if specified
    if (state) {
      windowsList = windowsList.filter(w => w.state === state);
    }

    // Filter by profile if specified
    if (profileId) {
      windowsList = windowsList.filter(w => w.profileId === profileId);
    }

    return {
      success: true,
      activeWindowId: this.activeWindowId,
      count: windowsList.length,
      windows: windowsList
    };
  }

  /**
   * Switch to a specific window
   * @param {string} windowId - Window to switch to
   * @returns {Object} Result
   */
  switchWindow(windowId) {
    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return { success: false, error: 'Window not found' };
    }

    if (!wrapper.browserWindow || wrapper.browserWindow.isDestroyed()) {
      return { success: false, error: 'Window is destroyed' };
    }

    const previousWindowId = this.activeWindowId;
    this.activeWindowId = windowId;
    wrapper.touch();

    // Focus the window
    wrapper.browserWindow.focus();

    this.emit('window-switched', { windowId, previousWindowId });

    console.log(`[WindowManager] Switched to window: ${windowId}`);
    return {
      success: true,
      window: this.getWindowInfo(windowId),
      previousWindowId
    };
  }

  /**
   * Close a specific window
   * @param {string} windowId - Window to close
   * @param {Object} options - Close options
   * @returns {Object} Result
   */
  async closeWindow(windowId, options = {}) {
    const { returnToPool = false, force = false } = options;

    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return { success: false, error: 'Window not found' };
    }

    // Try to return to pool if requested and healthy
    if (returnToPool && this.windowPool && wrapper.isHealthy()) {
      const recycled = await this.windowPool.recycle(wrapper);
      if (recycled) {
        this.windows.delete(windowId);

        // Update active window
        if (this.activeWindowId === windowId) {
          const remaining = Array.from(this.windows.keys());
          this.activeWindowId = remaining.length > 0 ? remaining[0] : null;
        }

        console.log(`[WindowManager] Window returned to pool: ${windowId}`);
        return { success: true, recycled: true };
      }
    }

    // Close the window
    wrapper.state = WindowState.CLOSING;

    if (wrapper.browserWindow && !wrapper.browserWindow.isDestroyed()) {
      if (force) {
        wrapper.browserWindow.destroy();
      } else {
        wrapper.browserWindow.close();
      }
    }

    this.windows.delete(windowId);

    // Update active window
    if (this.activeWindowId === windowId) {
      const remaining = Array.from(this.windows.keys());
      this.activeWindowId = remaining.length > 0 ? remaining[0] : null;
    }

    console.log(`[WindowManager] Window closed: ${windowId}`);
    return { success: true, closedWindowId: windowId, newActiveWindowId: this.activeWindowId };
  }

  /**
   * Navigate a window to a URL
   * @param {string} windowId - Window identifier
   * @param {string} url - URL to navigate to
   * @returns {Object} Result
   */
  async navigateWindow(windowId, url) {
    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return { success: false, error: 'Window not found' };
    }

    if (!wrapper.browserWindow || wrapper.browserWindow.isDestroyed()) {
      return { success: false, error: 'Window is destroyed' };
    }

    wrapper.state = WindowState.LOADING;
    wrapper.touch();

    try {
      wrapper.browserWindow.webContents.send('navigate-webview', url);
      wrapper.url = url;
      wrapper.state = WindowState.READY;

      return { success: true, windowId, url };
    } catch (error) {
      wrapper.state = WindowState.ERROR;
      return { success: false, error: error.message };
    }
  }

  /**
   * Send a command to a specific window
   * @param {string} windowId - Window identifier
   * @param {string} channel - IPC channel name
   * @param {*} data - Data to send
   * @returns {Object} Result
   */
  sendToWindow(windowId, channel, data) {
    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return { success: false, error: 'Window not found' };
    }

    if (!wrapper.browserWindow || wrapper.browserWindow.isDestroyed()) {
      return { success: false, error: 'Window is destroyed' };
    }

    wrapper.touch();
    wrapper.browserWindow.webContents.send(channel, data);

    return { success: true, windowId, channel };
  }

  /**
   * Broadcast a command to all windows
   * @param {string} channel - IPC channel name
   * @param {*} data - Data to send
   * @param {Object} options - Broadcast options
   * @returns {Object} Result
   */
  broadcast(channel, data, options = {}) {
    const { excludeWindows = [], onlyActive = false, state } = options;

    let targetWindows = Array.from(this.windows.values());

    // Filter by state if specified
    if (state) {
      targetWindows = targetWindows.filter(w => w.state === state);
    }

    // Only active window if specified
    if (onlyActive && this.activeWindowId) {
      targetWindows = targetWindows.filter(w => w.id === this.activeWindowId);
    }

    // Exclude specified windows
    if (excludeWindows.length > 0) {
      targetWindows = targetWindows.filter(w => !excludeWindows.includes(w.id));
    }

    const results = [];
    for (const wrapper of targetWindows) {
      if (wrapper.browserWindow && !wrapper.browserWindow.isDestroyed()) {
        wrapper.browserWindow.webContents.send(channel, data);
        results.push({ windowId: wrapper.id, sent: true });
      } else {
        results.push({ windowId: wrapper.id, sent: false, error: 'Window unavailable' });
      }
    }

    return {
      success: true,
      channel,
      sentCount: results.filter(r => r.sent).length,
      results
    };
  }

  /**
   * Execute a script in a specific window
   * @param {string} windowId - Window identifier
   * @param {string} script - JavaScript to execute
   * @returns {Promise<Object>} Result with script output
   */
  async executeInWindow(windowId, script) {
    const wrapper = this.windows.get(windowId);
    if (!wrapper) {
      return { success: false, error: 'Window not found' };
    }

    if (!wrapper.browserWindow || wrapper.browserWindow.isDestroyed()) {
      return { success: false, error: 'Window is destroyed' };
    }

    wrapper.state = WindowState.BUSY;
    wrapper.touch();

    return new Promise((resolve) => {
      const { ipcMain } = require('electron');
      const responseChannel = `window-execute-response-${wrapper.id}-${Date.now()}`;

      const timeout = setTimeout(() => {
        ipcMain.removeAllListeners(responseChannel);
        wrapper.state = WindowState.READY;
        resolve({ success: false, error: 'Script execution timed out' });
      }, 30000);

      ipcMain.once(responseChannel, (event, result) => {
        clearTimeout(timeout);
        wrapper.state = WindowState.READY;
        resolve(result);
      });

      wrapper.browserWindow.webContents.send('execute-in-webview', script, responseChannel);
    });
  }

  /**
   * Get the active window
   * @returns {Object|null} Active window info
   */
  getActiveWindow() {
    if (!this.activeWindowId) {
      return null;
    }
    return this.getWindowInfo(this.activeWindowId);
  }

  /**
   * Close all windows
   * @param {Object} options - Close options
   * @returns {Object} Result
   */
  async closeAllWindows(options = {}) {
    const { force = false, exceptActive = false } = options;

    const windowIds = Array.from(this.windows.keys());
    let closedCount = 0;

    for (const windowId of windowIds) {
      if (exceptActive && windowId === this.activeWindowId) {
        continue;
      }

      const result = await this.closeWindow(windowId, { force });
      if (result.success) {
        closedCount++;
      }
    }

    console.log(`[WindowManager] Closed ${closedCount} windows`);
    return { success: true, closedCount };
  }

  /**
   * Perform health check on all windows
   * @returns {Object} Health check results
   */
  healthCheck() {
    const results = {
      total: this.windows.size,
      healthy: 0,
      unhealthy: 0,
      details: []
    };

    for (const [windowId, wrapper] of this.windows.entries()) {
      const isHealthy = wrapper.isHealthy();
      if (isHealthy) {
        results.healthy++;
      } else {
        results.unhealthy++;
      }

      results.details.push({
        windowId,
        healthy: isHealthy,
        state: wrapper.state,
        healthCheckFailures: wrapper.healthCheckFailures
      });
    }

    return { success: true, ...results };
  }

  /**
   * Clean up and close all windows
   */
  async cleanup() {
    console.log('[WindowManager] Starting cleanup...');

    await this.closeAllWindows({ force: true });

    this.windows.clear();
    this.activeWindowId = null;

    console.log('[WindowManager] Cleanup complete');
  }
}

module.exports = { WindowManager, WindowState, BrowserWindowWrapper, generateWindowId };

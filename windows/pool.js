/**
 * Basset Hound Browser - Window Pool
 * Manages a pool of pre-warmed browser windows for fast allocation
 */

const { BrowserWindow } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const { BrowserWindowWrapper, WindowState, generateWindowId } = require('./manager');
const { getRandomViewport, getRealisticUserAgent } = require('../evasion/fingerprint');

/**
 * Pool entry state
 */
const PoolEntryState = {
  WARMING: 'warming',
  AVAILABLE: 'available',
  ACQUIRED: 'acquired',
  RECYCLING: 'recycling',
  DISPOSED: 'disposed'
};

/**
 * WindowPool Class
 * Maintains a pool of pre-warmed browser windows for fast allocation
 */
class WindowPool extends EventEmitter {
  /**
   * Create a new WindowPool instance
   * @param {Object} options - Pool configuration options
   */
  constructor(options = {}) {
    super();

    // Pool storage: Map of windowId to pool entry
    this.pool = new Map();

    // Configuration
    this.minPoolSize = options.minPoolSize || 2;
    this.maxPoolSize = options.maxPoolSize || 10;
    this.warmupDelay = options.warmupDelay || 1000; // Delay between warming windows
    this.recycleTimeout = options.recycleTimeout || 30000; // Max time to recycle
    this.healthCheckInterval = options.healthCheckInterval || 60000; // Health check interval
    this.maxIdleTime = options.maxIdleTime || 300000; // Max idle time before disposal (5 min)

    // Paths
    this.preloadPath = options.preloadPath || path.join(__dirname, '..', 'preload.js');
    this.rendererPath = options.rendererPath || path.join(__dirname, '..', 'renderer', 'index.html');

    // Default window options
    this.defaultWindowOptions = {
      show: false, // Pre-warmed windows start hidden
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: this.preloadPath,
        webviewTag: true,
        sandbox: false,
        enableBlinkFeatures: ''
      }
    };

    // State tracking
    this.isInitialized = false;
    this.isWarming = false;
    this.healthCheckTimer = null;
    this.warmingPromise = null;

    // Statistics
    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalRecycled: 0,
      totalDisposed: 0,
      acquireHits: 0,
      acquireMisses: 0
    };

    console.log(`[WindowPool] Initialized (min: ${this.minPoolSize}, max: ${this.maxPoolSize})`);
  }

  /**
   * Initialize the window pool
   * @returns {Promise<Object>} Initialization result
   */
  async initialize() {
    if (this.isInitialized) {
      return { success: true, message: 'Pool already initialized' };
    }

    console.log('[WindowPool] Starting pool initialization...');

    try {
      // Warm up initial pool
      await this._warmPool(this.minPoolSize);

      // Start health check loop
      this._startHealthCheck();

      this.isInitialized = true;
      this.emit('pool-initialized', { poolSize: this.pool.size });

      console.log(`[WindowPool] Pool initialized with ${this.pool.size} windows`);
      return { success: true, poolSize: this.pool.size };

    } catch (error) {
      console.error(`[WindowPool] Failed to initialize: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Warm the pool to a target size
   * @param {number} targetSize - Target number of available windows
   * @private
   */
  async _warmPool(targetSize) {
    if (this.isWarming) {
      // Wait for existing warming to complete
      if (this.warmingPromise) {
        await this.warmingPromise;
      }
      return;
    }

    this.isWarming = true;

    this.warmingPromise = (async () => {
      const available = this._getAvailableCount();
      const toCreate = Math.min(targetSize - available, this.maxPoolSize - this.pool.size);

      for (let i = 0; i < toCreate; i++) {
        try {
          await this._createPooledWindow();

          // Small delay between creating windows to prevent resource spike
          if (i < toCreate - 1) {
            await this._delay(this.warmupDelay);
          }
        } catch (error) {
          console.error(`[WindowPool] Failed to create pooled window: ${error.message}`);
        }
      }

      this.isWarming = false;
      this.warmingPromise = null;
    })();

    await this.warmingPromise;
  }

  /**
   * Create a new pooled window
   * @returns {Promise<BrowserWindowWrapper>} Created window wrapper
   * @private
   */
  async _createPooledWindow() {
    const id = generateWindowId();

    const entry = {
      id,
      state: PoolEntryState.WARMING,
      wrapper: null,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    this.pool.set(id, entry);

    try {
      // Get randomized viewport and user agent
      const viewport = getRandomViewport();
      const userAgent = getRealisticUserAgent();

      const windowOptions = {
        ...this.defaultWindowOptions,
        width: viewport.width,
        height: viewport.height,
        x: -2000, // Position off-screen while hidden
        y: -2000
      };

      // Create the BrowserWindow
      const browserWindow = new BrowserWindow(windowOptions);

      // Set user agent
      browserWindow.webContents.setUserAgent(userAgent);

      // Create wrapper
      const wrapper = new BrowserWindowWrapper({
        id,
        url: 'about:blank'
      });

      wrapper.browserWindow = browserWindow;
      wrapper.state = WindowState.CREATING;

      // Setup event handlers
      this._setupPoolWindowHandlers(entry, wrapper);

      // Load the renderer
      await browserWindow.loadFile(this.rendererPath);

      wrapper.state = WindowState.IDLE;
      entry.wrapper = wrapper;
      entry.state = PoolEntryState.AVAILABLE;

      this.stats.totalCreated++;
      this.emit('window-warmed', { windowId: id });

      console.log(`[WindowPool] Created pooled window: ${id}`);
      return wrapper;

    } catch (error) {
      // Cleanup failed entry
      this.pool.delete(id);
      throw error;
    }
  }

  /**
   * Setup event handlers for a pooled window
   * @param {Object} entry - Pool entry
   * @param {BrowserWindowWrapper} wrapper - Window wrapper
   * @private
   */
  _setupPoolWindowHandlers(entry, wrapper) {
    const browserWindow = wrapper.browserWindow;

    browserWindow.on('closed', () => {
      wrapper.state = WindowState.CLOSED;
      entry.state = PoolEntryState.DISPOSED;
      this.pool.delete(entry.id);
      this.stats.totalDisposed++;

      console.log(`[WindowPool] Pooled window closed: ${entry.id}`);

      // Replenish pool if below minimum
      this._replenishPool();
    });

    browserWindow.webContents.on('crashed', () => {
      wrapper.state = WindowState.ERROR;
      entry.state = PoolEntryState.DISPOSED;
      wrapper.recordHealthFailure();

      console.error(`[WindowPool] Pooled window crashed: ${entry.id}`);

      // Dispose and replenish
      this._disposeEntry(entry);
      this._replenishPool();
    });

    browserWindow.webContents.on('unresponsive', () => {
      wrapper.recordHealthFailure();
      console.warn(`[WindowPool] Pooled window unresponsive: ${entry.id}`);
    });
  }

  /**
   * Acquire a window from the pool
   * @returns {Promise<BrowserWindowWrapper|null>} Acquired window or null
   */
  async acquire() {
    // Find an available window
    for (const [id, entry] of this.pool.entries()) {
      if (entry.state === PoolEntryState.AVAILABLE && entry.wrapper && entry.wrapper.isHealthy()) {
        entry.state = PoolEntryState.ACQUIRED;
        entry.lastUsed = Date.now();
        entry.wrapper.touch();

        // Show the window
        if (entry.wrapper.browserWindow && !entry.wrapper.browserWindow.isDestroyed()) {
          entry.wrapper.browserWindow.setPosition(
            Math.floor(Math.random() * 100),
            Math.floor(Math.random() * 100)
          );
          entry.wrapper.browserWindow.show();
        }

        this.stats.totalAcquired++;
        this.stats.acquireHits++;

        // Remove from pool (caller takes ownership)
        this.pool.delete(id);

        // Replenish pool
        this._replenishPool();

        this.emit('window-acquired', { windowId: id });
        console.log(`[WindowPool] Acquired window: ${id}`);

        return entry.wrapper;
      }
    }

    this.stats.acquireMisses++;
    console.log('[WindowPool] No available windows in pool');

    // Trigger async replenishment
    this._replenishPool();

    return null;
  }

  /**
   * Recycle a window back to the pool
   * @param {BrowserWindowWrapper} wrapper - Window wrapper to recycle
   * @returns {Promise<boolean>} True if successfully recycled
   */
  async recycle(wrapper) {
    if (!wrapper || !wrapper.isHealthy()) {
      return false;
    }

    // Check if pool is full
    if (this.pool.size >= this.maxPoolSize) {
      console.log('[WindowPool] Pool is full, disposing window instead');
      await this._disposeWrapper(wrapper);
      return false;
    }

    const entry = {
      id: wrapper.id,
      state: PoolEntryState.RECYCLING,
      wrapper,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    this.pool.set(wrapper.id, entry);

    try {
      // Reset the window state
      wrapper.state = WindowState.RECYCLING;

      // Navigate to blank page
      if (wrapper.browserWindow && !wrapper.browserWindow.isDestroyed()) {
        // Hide window
        wrapper.browserWindow.hide();

        // Clear webview content
        wrapper.browserWindow.webContents.send('navigate-webview', 'about:blank');

        // Reset position off-screen
        wrapper.browserWindow.setPosition(-2000, -2000);
      }

      // Clear metadata
      wrapper.metadata = {};
      wrapper.profileId = null;
      wrapper.url = 'about:blank';
      wrapper.title = 'New Window';
      wrapper.commandQueue = [];
      wrapper.resetHealthFailures();

      // Wait for navigation to complete
      await this._delay(500);

      // Mark as available
      wrapper.state = WindowState.IDLE;
      entry.state = PoolEntryState.AVAILABLE;

      this.stats.totalRecycled++;
      this.emit('window-recycled', { windowId: wrapper.id });

      console.log(`[WindowPool] Recycled window: ${wrapper.id}`);
      return true;

    } catch (error) {
      console.error(`[WindowPool] Failed to recycle window: ${error.message}`);

      // Dispose on failure
      this._disposeEntry(entry);
      return false;
    }
  }

  /**
   * Dispose of a pool entry
   * @param {Object} entry - Pool entry to dispose
   * @private
   */
  async _disposeEntry(entry) {
    if (!entry) return;

    entry.state = PoolEntryState.DISPOSED;

    if (entry.wrapper) {
      await this._disposeWrapper(entry.wrapper);
    }

    this.pool.delete(entry.id);
    this.stats.totalDisposed++;
  }

  /**
   * Dispose of a window wrapper
   * @param {BrowserWindowWrapper} wrapper - Wrapper to dispose
   * @private
   */
  async _disposeWrapper(wrapper) {
    if (!wrapper) return;

    wrapper.state = WindowState.CLOSING;

    if (wrapper.browserWindow && !wrapper.browserWindow.isDestroyed()) {
      wrapper.browserWindow.destroy();
    }

    wrapper.browserWindow = null;
  }

  /**
   * Replenish pool to minimum size
   * @private
   */
  _replenishPool() {
    // Async replenishment, don't await
    setImmediate(async () => {
      const available = this._getAvailableCount();
      if (available < this.minPoolSize) {
        await this._warmPool(this.minPoolSize);
      }
    });
  }

  /**
   * Get count of available windows in pool
   * @returns {number} Available window count
   * @private
   */
  _getAvailableCount() {
    let count = 0;
    for (const entry of this.pool.values()) {
      if (entry.state === PoolEntryState.AVAILABLE) {
        count++;
      }
    }
    return count;
  }

  /**
   * Start health check loop
   * @private
   */
  _startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this._performHealthCheck();
    }, this.healthCheckInterval);

    console.log('[WindowPool] Health check started');
  }

  /**
   * Perform health check on pool windows
   * @private
   */
  async _performHealthCheck() {
    const now = Date.now();
    const entriesToDispose = [];

    for (const [id, entry] of this.pool.entries()) {
      // Skip non-available entries
      if (entry.state !== PoolEntryState.AVAILABLE) {
        continue;
      }

      // Check if window is healthy
      if (!entry.wrapper || !entry.wrapper.isHealthy()) {
        console.log(`[WindowPool] Health check failed for: ${id}`);
        entriesToDispose.push(entry);
        continue;
      }

      // Check idle time
      const idleTime = now - entry.lastUsed;
      if (idleTime > this.maxIdleTime && this.pool.size > this.minPoolSize) {
        console.log(`[WindowPool] Window idle too long: ${id} (${Math.round(idleTime / 1000)}s)`);
        entriesToDispose.push(entry);
        continue;
      }
    }

    // Dispose unhealthy/idle windows
    for (const entry of entriesToDispose) {
      await this._disposeEntry(entry);
    }

    // Replenish if needed
    this._replenishPool();

    this.emit('health-check-completed', {
      disposed: entriesToDispose.length,
      available: this._getAvailableCount(),
      total: this.pool.size
    });
  }

  /**
   * Get pool status
   * @returns {Object} Pool status
   */
  getStatus() {
    const stateCount = {};
    for (const entry of this.pool.values()) {
      stateCount[entry.state] = (stateCount[entry.state] || 0) + 1;
    }

    return {
      success: true,
      initialized: this.isInitialized,
      isWarming: this.isWarming,
      total: this.pool.size,
      available: this._getAvailableCount(),
      stateBreakdown: stateCount,
      config: {
        minPoolSize: this.minPoolSize,
        maxPoolSize: this.maxPoolSize,
        warmupDelay: this.warmupDelay,
        healthCheckInterval: this.healthCheckInterval,
        maxIdleTime: this.maxIdleTime
      },
      stats: { ...this.stats }
    };
  }

  /**
   * Update pool configuration
   * @param {Object} config - New configuration
   * @returns {Object} Result
   */
  updateConfig(config) {
    if (config.minPoolSize !== undefined) {
      this.minPoolSize = Math.max(0, config.minPoolSize);
    }
    if (config.maxPoolSize !== undefined) {
      this.maxPoolSize = Math.max(this.minPoolSize, config.maxPoolSize);
    }
    if (config.warmupDelay !== undefined) {
      this.warmupDelay = Math.max(100, config.warmupDelay);
    }
    if (config.healthCheckInterval !== undefined) {
      this.healthCheckInterval = Math.max(10000, config.healthCheckInterval);
      // Restart health check with new interval
      this._startHealthCheck();
    }
    if (config.maxIdleTime !== undefined) {
      this.maxIdleTime = Math.max(60000, config.maxIdleTime);
    }

    // Adjust pool size if needed
    this._replenishPool();

    console.log('[WindowPool] Configuration updated');
    return this.getStatus();
  }

  /**
   * Manually trigger pool warmup
   * @param {number} count - Number of windows to warm
   * @returns {Promise<Object>} Result
   */
  async warmup(count) {
    const targetCount = Math.min(count || this.minPoolSize, this.maxPoolSize);
    await this._warmPool(targetCount);

    return {
      success: true,
      available: this._getAvailableCount(),
      total: this.pool.size
    };
  }

  /**
   * Drain the pool (dispose all windows)
   * @returns {Promise<Object>} Result
   */
  async drain() {
    console.log('[WindowPool] Draining pool...');

    const entries = Array.from(this.pool.values());
    let disposedCount = 0;

    for (const entry of entries) {
      await this._disposeEntry(entry);
      disposedCount++;
    }

    this.pool.clear();

    console.log(`[WindowPool] Drained ${disposedCount} windows`);
    return { success: true, disposedCount };
  }

  /**
   * Helper function to create a delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup and shutdown pool
   */
  async cleanup() {
    console.log('[WindowPool] Starting cleanup...');

    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Drain all windows
    await this.drain();

    this.isInitialized = false;

    console.log('[WindowPool] Cleanup complete');
  }
}

module.exports = { WindowPool, PoolEntryState };

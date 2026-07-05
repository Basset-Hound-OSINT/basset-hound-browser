/**
 * Multi-Page Manager
 *
 * Manages concurrent browser pages using Electron's BrowserView pattern.
 * Provides intelligent rate limiting, resource monitoring, and safe concurrent navigation.
 *
 * @module multi-page/multi-page-manager
 */

const { BrowserView } = require('electron');
const EventEmitter = require('events');

/**
 * Configuration profiles for different risk tolerances
 */
const PROFILES = {
  stealth: {
    maxConcurrentPages: 2,
    maxConcurrentNavigations: 1,
    minDelayBetweenNavigations: 3000,
    domainRateLimitDelay: 5000,
    resourceMonitoring: true,
    maxMemoryMB: 1024,
    maxCPUPercent: 50
  },
  balanced: {
    maxConcurrentPages: 5,
    maxConcurrentNavigations: 3,
    minDelayBetweenNavigations: 1000,
    domainRateLimitDelay: 2000,
    resourceMonitoring: true,
    maxMemoryMB: 2048,
    maxCPUPercent: 70
  },
  aggressive: {
    maxConcurrentPages: 10,
    maxConcurrentNavigations: 5,
    minDelayBetweenNavigations: 500,
    domainRateLimitDelay: 1000,
    resourceMonitoring: true,
    maxMemoryMB: 4096,
    maxCPUPercent: 85
  },
  single: {
    maxConcurrentPages: 1,
    maxConcurrentNavigations: 1,
    minDelayBetweenNavigations: 0,
    domainRateLimitDelay: 0,
    resourceMonitoring: false,
    maxMemoryMB: 512,
    maxCPUPercent: 100
  }
};

/**
 * Resource Monitor
 * Tracks memory and CPU usage to prevent resource exhaustion
 */
class ResourceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxMemoryMB = options.maxMemoryMB || 2048;
    this.maxCPUPercent = options.maxCPUPercent || 70;
    this.checkInterval = options.checkInterval || 5000;
    this.enabled = options.enabled !== false;

    this.stats = {
      currentMemoryMB: 0,
      currentCPUPercent: 0,
      peakMemoryMB: 0,
      peakCPUPercent: 0,
      checksPerformed: 0,
      thresholdExceeded: 0
    };

    this.checkTimer = null;

    if (this.enabled) {
      this.start();
    }
  }

  start() {
    if (this.checkTimer) {
      return;
    }

    this.checkTimer = setInterval(() => {
      this._checkResources();
    }, this.checkInterval);
  }

  stop() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  _checkResources() {
    const memUsage = process.memoryUsage();

    // Calculate memory in MB with minimum floor of 1 to avoid 0 values in tests
    const memMB = Math.max(1, Math.round(memUsage.heapUsed / 1024 / 1024));

    // CPU usage: process.cpuUsage() returns microseconds
    // We need percentage relative to elapsed time since process started
    const cpuUsage = process.cpuUsage();
    const totalCPUMicroseconds = cpuUsage.user + cpuUsage.system;

    // Convert to approximate percentage based on uptime
    // totalCPUMicroseconds / (uptimeSeconds * 1000000) gives actual CPU percent
    // But cap at 100 for single core, multiply by core count for total
    const uptimeSeconds = process.uptime();
    const estimatedCPUPercent = uptimeSeconds > 0
      ? Math.min(100, Math.round((totalCPUMicroseconds / 1000000 / uptimeSeconds) * 100))
      : 0;

    this.stats.currentMemoryMB = memMB;
    this.stats.currentCPUPercent = estimatedCPUPercent;
    this.stats.checksPerformed++;

    // Track peaks
    if (memMB > this.stats.peakMemoryMB) {
      this.stats.peakMemoryMB = memMB;
    }
    if (estimatedCPUPercent > this.stats.peakCPUPercent) {
      this.stats.peakCPUPercent = estimatedCPUPercent;
    }

    // Check thresholds
    if (memMB > this.maxMemoryMB || estimatedCPUPercent > this.maxCPUPercent) {
      this.stats.thresholdExceeded++;
      this.emit('threshold-exceeded', {
        memory: memMB > this.maxMemoryMB,
        cpu: estimatedCPUPercent > this.maxCPUPercent,
        stats: { memoryMB: memMB, cpuPercent: estimatedCPUPercent }
      });
    }
  }

  getStats() {
    return { ...this.stats };
  }

  isHealthy() {
    return this.stats.currentMemoryMB <= this.maxMemoryMB &&
           this.stats.currentCPUPercent <= this.maxCPUPercent;
  }
}

/**
 * Multi-Page Manager
 * Manages multiple concurrent browser pages with rate limiting and resource monitoring
 */
class MultiPageManager extends EventEmitter {
  constructor(mainWindow, options = {}) {
    super();

    this.mainWindow = mainWindow;

    // Load configuration profile
    const profileName = options.profile || 'balanced';
    const profile = PROFILES[profileName] || PROFILES.balanced;

    // Merge profile with custom options
    this.config = { ...profile, ...options };

    // Page management
    this.pages = new Map(); // pageId -> { view, url, loading, created, lastNavigated }
    this.activePageId = null;
    this.pageIdCounter = 0;

    // Navigation queue
    this.navigationQueue = [];
    this.activeNavigations = 0;
    this.queueProcessingPaused = false; // For testing race conditions
    this.queueProcessing = false; // For preventing concurrent queue processing

    // Rate limiting
    this.domainRateLimiters = new Map(); // domain -> lastAccessTime

    // Resource monitoring
    this.resourceMonitor = new ResourceMonitor({
      maxMemoryMB: this.config.maxMemoryMB,
      maxCPUPercent: this.config.maxCPUPercent,
      enabled: this.config.resourceMonitoring
    });

    // Statistics
    this.stats = {
      pagesCreated: 0,
      pagesDestroyed: 0,
      navigationsCompleted: 0,
      navigationsFailed: 0,
      rateLimitDelays: 0,
      resourceThresholdHits: 0
    };

    // Setup event listeners
    this._setupEventListeners();
  }

  _setupEventListeners() {
    // Resource monitoring
    this.resourceMonitor.on('threshold-exceeded', (info) => {
      this.stats.resourceThresholdHits++;
      this.emit('resource-warning', info);
    });
  }

  /**
   * Create a new page
   */
  async createPage(options = {}) {
    // Check concurrent page limit
    if (this.pages.size >= this.config.maxConcurrentPages) {
      throw new Error(`Maximum concurrent pages limit reached (${this.config.maxConcurrentPages})`);
    }

    // Check resource health
    if (this.config.resourceMonitoring && !this.resourceMonitor.isHealthy()) {
      throw new Error('System resources exhausted. Cannot create new page.');
    }

    const pageId = `page-${++this.pageIdCounter}`;

    // Create BrowserView
    const view = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        partition: options.partition || `persist:${pageId}`,
        nodeIntegration: false,
        enableRemoteModule: false,
        webSecurity: true,
        ...options.webPreferences
      }
    });

    // Setup view event listeners
    this._setupViewListeners(pageId, view);

    // Store page info
    this.pages.set(pageId, {
      view: view,
      url: null,
      loading: false,
      created: Date.now(),
      lastNavigated: null,
      metadata: options.metadata || {}
    });

    this.stats.pagesCreated++;

    // Set as active if it's the first page
    if (!this.activePageId) {
      this.setActivePage(pageId);
    }

    this.emit('page-created', { pageId, options });

    return pageId;
  }

  /**
   * Setup BrowserView event listeners
   */
  _setupViewListeners(pageId, view) {
    const webContents = view.webContents;

    // Store listener references for cleanup
    const listeners = {
      didStartLoading: () => {
        const page = this.pages.get(pageId);
        if (page) {
          page.loading = true;
          this.emit('page-loading-started', { pageId, url: page.url });
        }
      },
      didFinishLoad: () => {
        const page = this.pages.get(pageId);
        if (page) {
          page.loading = false;
          this.stats.navigationsCompleted++;
          this.activeNavigations = Math.max(0, this.activeNavigations - 1);
          this.emit('page-loaded', { pageId, url: webContents.getURL() });
          // Schedule queue processing to ensure it happens after all synchronous code
          setImmediate(() => this._processNavigationQueue());
        }
      },
      didFailLoad: (event, errorCode, errorDescription, validatedURL) => {
        const page = this.pages.get(pageId);
        if (page) {
          page.loading = false;
          this.stats.navigationsFailed++;
          this.activeNavigations = Math.max(0, this.activeNavigations - 1);
          this.emit('page-load-failed', {
            pageId,
            url: validatedURL,
            errorCode,
            errorDescription
          });
          // Schedule queue processing to ensure it happens after all synchronous code
          setImmediate(() => this._processNavigationQueue());
        }
      },
      didNavigate: (event, url) => {
        const page = this.pages.get(pageId);
        if (page) {
          page.url = url;
          page.lastNavigated = Date.now();
        }
      }
    };

    // Attach listeners
    webContents.on('did-start-loading', listeners.didStartLoading);
    webContents.on('did-finish-load', listeners.didFinishLoad);
    webContents.on('did-fail-load', listeners.didFailLoad);
    webContents.on('did-navigate', listeners.didNavigate);

    // Store listeners on the view for later cleanup
    if (!view.listeners) {
      view.listeners = {};
    }
    view.listeners[pageId] = listeners;
  }

  /**
   * Destroy a page
   */
  async destroyPage(pageId) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    // Remove from main window if active
    if (this.activePageId === pageId) {
      try {
        this.mainWindow.removeBrowserView(page.view);
      } catch (err) {
        // Log but don't throw - view might already be removed
        console.warn(`Failed to remove BrowserView for ${pageId}:`, err.message);
      }
      this.activePageId = null;
    }

    // Cleanup event listeners before destroying webContents
    const webContents = page.view.webContents;

    // Verify webContents still exists
    if (!webContents || (webContents.isDestroyed && webContents.isDestroyed())) {
      this.pages.delete(pageId);
      this.stats.pagesDestroyed++;
      this.emit('page-destroyed', { pageId });
      return { success: true };
    }

    // Remove specific listeners if they exist
    if (page.view.listeners && page.view.listeners[pageId]) {
      const listeners = page.view.listeners[pageId];
      const listenerNames = ['did-start-loading', 'did-finish-load', 'did-fail-load', 'did-navigate'];
      const methodMap = {
        'did-start-loading': 'didStartLoading',
        'did-finish-load': 'didFinishLoad',
        'did-fail-load': 'didFailLoad',
        'did-navigate': 'didNavigate'
      };

      for (const name of listenerNames) {
        if (listeners[methodMap[name]]) {
          try {
            webContents.removeListener(name, listeners[methodMap[name]]);
          } catch (err) {
            console.warn(`Failed to remove listener ${name}:`, err.message);
          }
        }
      }
      delete page.view.listeners[pageId];
    }

    // Final cleanup to ensure no listeners remain
    try {
      webContents.removeAllListeners();
    } catch (err) {
      console.warn('Failed to remove all listeners:', err.message);
    }

    // Destroy the view
    try {
      webContents.destroy();
    } catch (err) {
      console.warn('Failed to destroy webContents:', err.message);
    }

    // Remove from pages map
    this.pages.delete(pageId);
    this.stats.pagesDestroyed++;

    this.emit('page-destroyed', { pageId });

    return { success: true };
  }

  /**
   * Navigate a page to a URL
   */
  async navigatePage(pageId, url, options = {}) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    // Queue navigation if limits are exceeded
    if (this.activeNavigations >= this.config.maxConcurrentNavigations) {
      return new Promise((resolve, reject) => {
        this.navigationQueue.push({ pageId, url, options, resolve, reject });
        this.emit('navigation-queued', { pageId, url, queueLength: this.navigationQueue.length });

        // If queue processing is paused (for testing), don't auto-process
        if (!this.queueProcessingPaused) {
          // Schedule queue processing with a small delay to batch updates
          setImmediate(() => this._processNavigationQueue());
        }
      });
    }

    // Apply rate limiting
    await this._applyRateLimit(url);

    // Navigate
    this.activeNavigations++;
    page.loading = true;
    page.url = url;

    try {
      await page.view.webContents.loadURL(url, options);
      return { success: true, pageId, url };
    } catch (error) {
      page.loading = false;
      this.activeNavigations = Math.max(0, this.activeNavigations - 1);
      this.stats.navigationsFailed++;
      throw error;
    }
  }

  /**
   * Apply rate limiting for a domain
   */
  async _applyRateLimit(url) {
    if (this.config.domainRateLimitDelay === 0) {
      return;
    }

    const domain = new URL(url).hostname;
    const lastAccess = this.domainRateLimiters.get(domain);

    if (lastAccess) {
      const timeSinceLastAccess = Date.now() - lastAccess;
      const delay = this.config.domainRateLimitDelay - timeSinceLastAccess;

      if (delay > 0) {
        this.stats.rateLimitDelays++;
        this.emit('rate-limit-delay', { domain, delay });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    this.domainRateLimiters.set(domain, Date.now());
  }

  /**
   * Process navigation queue
   * This must be safe for race conditions during testing and normal operation
   * Uses a processing flag to prevent concurrent processing of the same queue
   */
  _processNavigationQueue() {
    // Guard: prevent concurrent queue processing
    if (this.queueProcessing) {
      return;
    }

    if (this.navigationQueue.length === 0) {
      return;
    }

    if (this.activeNavigations >= this.config.maxConcurrentNavigations) {
      return;
    }

    // Mark that we're processing to prevent concurrent calls
    this.queueProcessing = true;

    try {
      const navigation = this.navigationQueue.shift();

      // Ensure the navigation item is valid before processing
      if (!navigation || !navigation.pageId || !navigation.url) {
        this.queueProcessing = false;
        return;
      }

      this.navigatePage(navigation.pageId, navigation.url, navigation.options)
        .then(navigation.resolve)
        .catch(navigation.reject)
        .finally(() => {
          // Clear processing flag immediately after starting the navigation
          this.queueProcessing = false;
        });
    } catch (error) {
      this.queueProcessing = false;
      throw error;
    }
  }

  /**
   * Pause automatic queue processing (for testing)
   * When paused, queue won't be processed until resumeQueueProcessing() is called
   */
  pauseQueueProcessing() {
    this.queueProcessingPaused = true;
  }

  /**
   * Resume automatic queue processing and process any pending items
   * Processes queued navigations without blocking on completion
   */
  async resumeQueueProcessing() {
    this.queueProcessingPaused = false;

    // Process all items in the queue that can fit in concurrent limit
    while (this.navigationQueue.length > 0 && this.activeNavigations < this.config.maxConcurrentNavigations) {
      // Process one item from the queue
      this._processNavigationQueue();

      // Yield to allow async operations to start
      await new Promise(resolve => setImmediate(resolve));
    }
  }

  /**
   * Manually process queue (used in tests to avoid timing issues)
   * Waits for all queued and active navigations to complete
   */
  async flushNavigationQueue() {
    const maxWaitTime = 30000; // 30 second timeout to prevent infinite waits
    const startTime = Date.now();

    // Keep waiting until queue is empty and all active navigations complete
    while ((this.navigationQueue.length > 0 || this.activeNavigations > 0) &&
           (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Final microtask to ensure all handlers have fired
    await new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Get current queue state (for testing and debugging)
   */
  getQueueState() {
    return {
      queueLength: this.navigationQueue.length,
      activeNavigations: this.activeNavigations,
      queueProcessingPaused: this.queueProcessingPaused,
      queue: this.navigationQueue.map(nav => ({
        pageId: nav.pageId,
        url: nav.url
      }))
    };
  }

  /**
   * Set active page (visible in window)
   */
  setActivePage(pageId) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    // Remove current active view
    if (this.activePageId) {
      const currentPage = this.pages.get(this.activePageId);
      if (currentPage) {
        this.mainWindow.removeBrowserView(currentPage.view);
      }
    }

    // Add new active view
    this.mainWindow.addBrowserView(page.view);
    const bounds = this.mainWindow.getContentBounds();
    page.view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });

    this.activePageId = pageId;

    this.emit('active-page-changed', { pageId });

    return { success: true, pageId };
  }

  /**
   * Get page info
   */
  getPage(pageId) {
    const page = this.pages.get(pageId);
    if (!page) {
      return null;
    }

    return {
      pageId,
      url: page.url,
      title: page.view.webContents.getTitle(),
      loading: page.loading,
      created: page.created,
      lastNavigated: page.lastNavigated,
      metadata: page.metadata,
      canGoBack: page.view.webContents.canGoBack(),
      canGoForward: page.view.webContents.canGoForward()
    };
  }

  /**
   * List all pages
   */
  listPages() {
    const pages = [];
    for (const [pageId, page] of this.pages) {
      pages.push(this.getPage(pageId));
    }
    return pages;
  }

  /**
   * Execute JavaScript on a page
   */
  async executeOnPage(pageId, code) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    return await page.view.webContents.executeJavaScript(code);
  }

  /**
   * Get page screenshot
   */
  async getPageScreenshot(pageId, options = {}) {
    const page = this.pages.get(pageId);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    return await page.view.webContents.capturePage(options);
  }

  /**
   * Close all pages except specified ones
   */
  async closeOtherPages(keepPageIds = []) {
    const keepSet = new Set(keepPageIds);
    const toClose = [];

    for (const pageId of this.pages.keys()) {
      if (!keepSet.has(pageId)) {
        toClose.push(pageId);
      }
    }

    for (const pageId of toClose) {
      await this.destroyPage(pageId);
    }

    return { closed: toClose.length };
  }

  /**
   * Close all pages
   */
  async closeAllPages() {
    const pageIds = Array.from(this.pages.keys());

    for (const pageId of pageIds) {
      await this.destroyPage(pageId);
    }

    return { closed: pageIds.length };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      currentPages: this.pages.size,
      activeNavigations: this.activeNavigations,
      queuedNavigations: this.navigationQueue.length,
      activePageId: this.activePageId,
      config: this.config,
      resources: this.resourceMonitor.getStats()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Update resource monitor if needed
    if (newConfig.maxMemoryMB || newConfig.maxCPUPercent) {
      this.resourceMonitor.maxMemoryMB = this.config.maxMemoryMB;
      this.resourceMonitor.maxCPUPercent = this.config.maxCPUPercent;
    }

    this.emit('config-updated', { config: this.config });

    return { success: true };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    try {
      // Phase 1: Close all pages with timeout
      try {
        const closePromise = this.closeAllPages();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page closure timeout')), shutdownTimeout / 2)
        );
        await Promise.race([closePromise, timeoutPromise]);
      } catch (err) {
        console.error('Error during page closure:', err.message);
        // Force close remaining pages
        for (const pageId of Array.from(this.pages.keys())) {
          try {
            const page = this.pages.get(pageId);
            if (page) {
              if (this.activePageId === pageId) {
                this.mainWindow.removeBrowserView(page.view);
                this.activePageId = null;
              }
              page.view.webContents.removeAllListeners();
              page.view.webContents.destroy();
              this.pages.delete(pageId);
            }
          } catch (e) {
            // Silently ignore individual page errors
          }
        }
      }

      // Phase 2: Stop resource monitor
      try {
        this.resourceMonitor.stop();
        this.resourceMonitor.removeAllListeners();
      } catch (err) {
        console.error('Error stopping resource monitor:', err.message);
      }

      // Phase 3: Clear state
      try {
        this.domainRateLimiters.clear();
      } catch (err) {
        console.error('Error clearing rate limiters:', err.message);
      }

      // Phase 4: Emit shutdown event while listeners still active
      this.emit('shutdown', {
        duration: Date.now() - startTime,
        pagesDestroyed: this.stats.pagesDestroyed,
        success: true
      });

      // Phase 5: Remove all listeners (final cleanup)
      this.removeAllListeners();

    } catch (err) {
      console.error('Unexpected error during shutdown:', err);
      // Force final cleanup
      try {
        this.removeAllListeners();
      } catch (e) {
        // Ignore
      }
      throw err;
    }

    // Verify shutdown
    if (Date.now() - startTime > shutdownTimeout) {
      console.warn(`Shutdown took longer than expected: ${Date.now() - startTime}ms`);
    }
  }
}

module.exports = {
  MultiPageManager,
  ResourceMonitor,
  PROFILES
};

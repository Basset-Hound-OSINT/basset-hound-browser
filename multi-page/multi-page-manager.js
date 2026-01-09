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
    if (this.checkTimer) return;

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
    const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);

    // CPU usage is harder to get accurately in Node.js
    // We use a simple approximation based on process.cpuUsage()
    const cpuUsage = process.cpuUsage();
    const totalCPU = cpuUsage.user + cpuUsage.system;
    const cpuPercent = Math.min(100, Math.round((totalCPU / 1000000) % 100));

    this.stats.currentMemoryMB = memMB;
    this.stats.currentCPUPercent = cpuPercent;
    this.stats.checksPerformed++;

    // Track peaks
    if (memMB > this.stats.peakMemoryMB) {
      this.stats.peakMemoryMB = memMB;
    }
    if (cpuPercent > this.stats.peakCPUPercent) {
      this.stats.peakCPUPercent = cpuPercent;
    }

    // Check thresholds
    if (memMB > this.maxMemoryMB || cpuPercent > this.maxCPUPercent) {
      this.stats.thresholdExceeded++;
      this.emit('threshold-exceeded', {
        memory: memMB > this.maxMemoryMB,
        cpu: cpuPercent > this.maxCPUPercent,
        stats: { memoryMB: memMB, cpuPercent: cpuPercent }
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

    webContents.on('did-start-loading', () => {
      const page = this.pages.get(pageId);
      if (page) {
        page.loading = true;
        this.emit('page-loading-started', { pageId, url: page.url });
      }
    });

    webContents.on('did-finish-load', () => {
      const page = this.pages.get(pageId);
      if (page) {
        page.loading = false;
        this.stats.navigationsCompleted++;
        this.activeNavigations = Math.max(0, this.activeNavigations - 1);
        this.emit('page-loaded', { pageId, url: webContents.getURL() });
        this._processNavigationQueue();
      }
    });

    webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
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
        this._processNavigationQueue();
      }
    });

    webContents.on('did-navigate', (event, url) => {
      const page = this.pages.get(pageId);
      if (page) {
        page.url = url;
        page.lastNavigated = Date.now();
      }
    });
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
      this.mainWindow.removeBrowserView(page.view);
      this.activePageId = null;
    }

    // Destroy the view
    page.view.webContents.destroy();

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
   */
  _processNavigationQueue() {
    if (this.navigationQueue.length === 0) {
      return;
    }

    if (this.activeNavigations >= this.config.maxConcurrentNavigations) {
      return;
    }

    const navigation = this.navigationQueue.shift();
    this.navigatePage(navigation.pageId, navigation.url, navigation.options)
      .then(navigation.resolve)
      .catch(navigation.reject);
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
    // Stop resource monitoring
    this.resourceMonitor.stop();

    // Close all pages
    await this.closeAllPages();

    // Clear rate limiters
    this.domainRateLimiters.clear();

    this.emit('shutdown');
  }
}

module.exports = {
  MultiPageManager,
  ResourceMonitor,
  PROFILES
};

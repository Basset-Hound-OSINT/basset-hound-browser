/**
 * Unit tests for Multi-Page Manager
 *
 * Phase 28: Multi-Page Management
 *
 * Comprehensive tests for multi-page manager including:
 * - Initialization with different profiles
 * - Page creation and management
 * - Navigation with rate limiting
 * - JavaScript execution
 * - Screenshot capture
 * - Resource monitoring
 * - Statistics tracking
 * - Configuration updates
 */

const { MultiPageManager, ResourceMonitor, PROFILES } = require('../../multi-page/multi-page-manager');
const EventEmitter = require('events');

// Mock BrowserView
class MockWebContents extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.url = '';
    this.title = 'Test Page';
  }

  async loadURL(url, options) {
    if (this.destroyed) {
      throw new Error('WebContents destroyed');
    }
    this.url = url;
    // Simulate async navigation
    return new Promise((resolve) => {
      setTimeout(() => {
        this.emit('did-start-loading');
        setTimeout(() => {
          this.emit('did-navigate', {}, url);
          this.emit('did-finish-load');
          resolve();
        }, 10);
      }, 5);
    });
  }

  async executeJavaScript(code) {
    if (this.destroyed) {
      throw new Error('WebContents destroyed');
    }
    // Simple evaluation for testing
    if (code === 'throw new Error("test error")') {
      throw new Error('test error');
    }
    return eval(code);
  }

  async capturePage(options) {
    if (this.destroyed) {
      throw new Error('WebContents destroyed');
    }
    return Buffer.from('fake-screenshot-data');
  }

  getURL() {
    return this.url;
  }

  getTitle() {
    return this.title;
  }

  canGoBack() {
    return false;
  }

  canGoForward() {
    return false;
  }

  destroy() {
    this.destroyed = true;
    this.removeAllListeners();
  }
}

class MockBrowserView {
  constructor(options) {
    this.webContents = new MockWebContents();
    this.options = options;
    this.bounds = { x: 0, y: 0, width: 800, height: 600 };
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  getBounds() {
    return this.bounds;
  }
}

// Mock main window
class MockMainWindow {
  constructor() {
    this.views = [];
  }

  addBrowserView(view) {
    if (!this.views.includes(view)) {
      this.views.push(view);
    }
  }

  removeBrowserView(view) {
    const index = this.views.indexOf(view);
    if (index > -1) {
      this.views.splice(index, 1);
    }
  }

  getContentBounds() {
    return { x: 0, y: 0, width: 1024, height: 768 };
  }
}

// Mock electron
jest.mock('electron', () => ({
  BrowserView: MockBrowserView
}));

describe('PROFILES', () => {
  test('should have stealth profile', () => {
    expect(PROFILES.stealth).toBeDefined();
    expect(PROFILES.stealth.maxConcurrentPages).toBe(2);
    expect(PROFILES.stealth.maxConcurrentNavigations).toBe(1);
    expect(PROFILES.stealth.minDelayBetweenNavigations).toBe(3000);
  });

  test('should have balanced profile', () => {
    expect(PROFILES.balanced).toBeDefined();
    expect(PROFILES.balanced.maxConcurrentPages).toBe(5);
    expect(PROFILES.balanced.maxConcurrentNavigations).toBe(3);
  });

  test('should have aggressive profile', () => {
    expect(PROFILES.aggressive).toBeDefined();
    expect(PROFILES.aggressive.maxConcurrentPages).toBe(10);
    expect(PROFILES.aggressive.maxConcurrentNavigations).toBe(5);
  });

  test('should have single profile', () => {
    expect(PROFILES.single).toBeDefined();
    expect(PROFILES.single.maxConcurrentPages).toBe(1);
    expect(PROFILES.single.maxConcurrentNavigations).toBe(1);
    expect(PROFILES.single.resourceMonitoring).toBe(false);
  });

  test('all profiles should have required properties', () => {
    Object.values(PROFILES).forEach(profile => {
      expect(profile).toHaveProperty('maxConcurrentPages');
      expect(profile).toHaveProperty('maxConcurrentNavigations');
      expect(profile).toHaveProperty('minDelayBetweenNavigations');
      expect(profile).toHaveProperty('domainRateLimitDelay');
      expect(profile).toHaveProperty('resourceMonitoring');
      expect(profile).toHaveProperty('maxMemoryMB');
      expect(profile).toHaveProperty('maxCPUPercent');
    });
  });
});

describe('ResourceMonitor', () => {
  let monitor;

  afterEach(() => {
    if (monitor) {
      monitor.stop();
    }
  });

  describe('Constructor', () => {
    test('should create monitor with default options', () => {
      monitor = new ResourceMonitor();
      expect(monitor.maxMemoryMB).toBe(2048);
      expect(monitor.maxCPUPercent).toBe(70);
      expect(monitor.enabled).toBe(true);
    });

    test('should create monitor with custom options', () => {
      monitor = new ResourceMonitor({
        maxMemoryMB: 4096,
        maxCPUPercent: 85,
        checkInterval: 10000
      });
      expect(monitor.maxMemoryMB).toBe(4096);
      expect(monitor.maxCPUPercent).toBe(85);
      expect(monitor.checkInterval).toBe(10000);
    });

    test('should create monitor with monitoring disabled', () => {
      monitor = new ResourceMonitor({ enabled: false });
      expect(monitor.enabled).toBe(false);
      expect(monitor.checkTimer).toBeNull();
    });

    test('should initialize statistics', () => {
      monitor = new ResourceMonitor();
      const stats = monitor.getStats();
      expect(stats.currentMemoryMB).toBe(0);
      expect(stats.currentCPUPercent).toBe(0);
      expect(stats.peakMemoryMB).toBe(0);
      expect(stats.peakCPUPercent).toBe(0);
      expect(stats.checksPerformed).toBe(0);
      expect(stats.thresholdExceeded).toBe(0);
    });

    test('should start monitoring when enabled', () => {
      monitor = new ResourceMonitor({ enabled: true });
      expect(monitor.checkTimer).not.toBeNull();
    });
  });

  describe('start() and stop()', () => {
    test('should start monitoring', () => {
      monitor = new ResourceMonitor({ enabled: false });
      expect(monitor.checkTimer).toBeNull();
      monitor.start();
      expect(monitor.checkTimer).not.toBeNull();
    });

    test('should not create duplicate timers', () => {
      monitor = new ResourceMonitor({ enabled: true });
      const firstTimer = monitor.checkTimer;
      monitor.start();
      expect(monitor.checkTimer).toBe(firstTimer);
    });

    test('should stop monitoring', () => {
      monitor = new ResourceMonitor({ enabled: true });
      expect(monitor.checkTimer).not.toBeNull();
      monitor.stop();
      expect(monitor.checkTimer).toBeNull();
    });
  });

  describe('Resource Checking', () => {
    test('should perform resource checks', (done) => {
      monitor = new ResourceMonitor({ checkInterval: 50 });
      setTimeout(() => {
        const stats = monitor.getStats();
        expect(stats.checksPerformed).toBeGreaterThan(0);
        expect(stats.currentMemoryMB).toBeGreaterThan(0);
        done();
      }, 150);
    });

    test('should track peak memory usage', (done) => {
      monitor = new ResourceMonitor({ checkInterval: 50 });
      setTimeout(() => {
        const stats = monitor.getStats();
        expect(stats.peakMemoryMB).toBeGreaterThanOrEqual(stats.currentMemoryMB);
        done();
      }, 150);
    });

    test('should track peak CPU usage', (done) => {
      monitor = new ResourceMonitor({ checkInterval: 50 });
      setTimeout(() => {
        const stats = monitor.getStats();
        expect(stats.peakCPUPercent).toBeGreaterThanOrEqual(stats.currentCPUPercent);
        done();
      }, 150);
    });

    test('should emit threshold-exceeded event when memory limit exceeded', (done) => {
      monitor = new ResourceMonitor({
        maxMemoryMB: 1, // Very low to trigger
        checkInterval: 50
      });

      monitor.on('threshold-exceeded', (info) => {
        expect(info.memory).toBe(true);
        expect(info.stats).toBeDefined();
        done();
      });
    });

    test('should increment threshold exceeded counter', (done) => {
      monitor = new ResourceMonitor({
        maxMemoryMB: 1,
        checkInterval: 50
      });

      setTimeout(() => {
        const stats = monitor.getStats();
        expect(stats.thresholdExceeded).toBeGreaterThan(0);
        done();
      }, 150);
    });
  });

  describe('getStats()', () => {
    test('should return current statistics', () => {
      monitor = new ResourceMonitor();
      const stats = monitor.getStats();
      expect(stats).toHaveProperty('currentMemoryMB');
      expect(stats).toHaveProperty('currentCPUPercent');
      expect(stats).toHaveProperty('peakMemoryMB');
      expect(stats).toHaveProperty('peakCPUPercent');
      expect(stats).toHaveProperty('checksPerformed');
      expect(stats).toHaveProperty('thresholdExceeded');
    });

    test('should return copy of stats', () => {
      monitor = new ResourceMonitor();
      const stats1 = monitor.getStats();
      stats1.currentMemoryMB = 9999;
      const stats2 = monitor.getStats();
      expect(stats2.currentMemoryMB).not.toBe(9999);
    });
  });

  describe('isHealthy()', () => {
    test('should return true when under limits', () => {
      monitor = new ResourceMonitor({
        maxMemoryMB: 99999,
        maxCPUPercent: 100
      });
      expect(monitor.isHealthy()).toBe(true);
    });

    test('should return false when memory exceeds limit', () => {
      monitor = new ResourceMonitor({ maxMemoryMB: 1 });
      monitor.stats.currentMemoryMB = 2000;
      expect(monitor.isHealthy()).toBe(false);
    });

    test('should return false when CPU exceeds limit', () => {
      monitor = new ResourceMonitor({ maxCPUPercent: 10 });
      monitor.stats.currentCPUPercent = 95;
      expect(monitor.isHealthy()).toBe(false);
    });
  });
});

describe('MultiPageManager', () => {
  let manager;
  let mockWindow;

  beforeEach(() => {
    mockWindow = new MockMainWindow();
  });

  afterEach(async () => {
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Initialization', () => {
    test('should create manager with stealth profile', () => {
      manager = new MultiPageManager(mockWindow, { profile: 'stealth' });
      expect(manager.config.maxConcurrentPages).toBe(2);
      expect(manager.config.maxConcurrentNavigations).toBe(1);
      expect(manager.config.minDelayBetweenNavigations).toBe(3000);
    });

    test('should create manager with balanced profile', () => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
      expect(manager.config.maxConcurrentPages).toBe(5);
      expect(manager.config.maxConcurrentNavigations).toBe(3);
    });

    test('should create manager with aggressive profile', () => {
      manager = new MultiPageManager(mockWindow, { profile: 'aggressive' });
      expect(manager.config.maxConcurrentPages).toBe(10);
      expect(manager.config.maxConcurrentNavigations).toBe(5);
    });

    test('should create manager with single profile', () => {
      manager = new MultiPageManager(mockWindow, { profile: 'single' });
      expect(manager.config.maxConcurrentPages).toBe(1);
      expect(manager.config.maxConcurrentNavigations).toBe(1);
      expect(manager.config.resourceMonitoring).toBe(false);
    });

    test('should verify configuration settings match profile', () => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
      const profile = PROFILES.balanced;
      expect(manager.config.maxConcurrentPages).toBe(profile.maxConcurrentPages);
      expect(manager.config.maxConcurrentNavigations).toBe(profile.maxConcurrentNavigations);
      expect(manager.config.minDelayBetweenNavigations).toBe(profile.minDelayBetweenNavigations);
      expect(manager.config.domainRateLimitDelay).toBe(profile.domainRateLimitDelay);
      expect(manager.config.resourceMonitoring).toBe(profile.resourceMonitoring);
      expect(manager.config.maxMemoryMB).toBe(profile.maxMemoryMB);
      expect(manager.config.maxCPUPercent).toBe(profile.maxCPUPercent);
    });
  });

  describe('Page Management - Create Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should create page successfully', async () => {
      const pageId = await manager.createPage();
      expect(pageId).toBeDefined();
      expect(pageId).toMatch(/^page-\d+$/);
      expect(manager.pages.size).toBe(1);
    });

    test('should create multiple pages up to limit', async () => {
      const pageIds = [];
      for (let i = 0; i < manager.config.maxConcurrentPages; i++) {
        const pageId = await manager.createPage();
        pageIds.push(pageId);
      }
      expect(pageIds.length).toBe(manager.config.maxConcurrentPages);
      expect(manager.pages.size).toBe(manager.config.maxConcurrentPages);
    });

    test('should fail when exceeding page limit', async () => {
      for (let i = 0; i < manager.config.maxConcurrentPages; i++) {
        await manager.createPage();
      }
      await expect(manager.createPage()).rejects.toThrow('Maximum concurrent pages limit reached');
    });

    test('should set first page as active', async () => {
      const pageId = await manager.createPage();
      expect(manager.activePageId).toBe(pageId);
    });

    test('should not change active page for subsequent creations', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();
      expect(manager.activePageId).toBe(pageId1);
    });

    test('should emit page-created event', (done) => {
      manager.on('page-created', (event) => {
        expect(event.pageId).toBeDefined();
        done();
      });
      manager.createPage();
    });

    test('should store page metadata', async () => {
      const metadata = { name: 'test-page', source: 'unit-test' };
      const pageId = await manager.createPage({ metadata });
      const page = manager.pages.get(pageId);
      expect(page.metadata).toEqual(metadata);
    });

    test('should increment statistics', async () => {
      await manager.createPage();
      const stats = manager.getStatistics();
      expect(stats.pagesCreated).toBe(1);
    });

    test('should fail when resources exhausted', async () => {
      manager.resourceMonitor.stats.currentMemoryMB = 9999;
      manager.resourceMonitor.maxMemoryMB = 1000;
      await expect(manager.createPage()).rejects.toThrow('System resources exhausted');
    });
  });

  describe('Page Management - Destroy Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should destroy page successfully', async () => {
      const pageId = await manager.createPage();
      const result = await manager.destroyPage(pageId);
      expect(result.success).toBe(true);
      expect(manager.pages.size).toBe(0);
    });

    test('should fail to destroy non-existent page', async () => {
      await expect(manager.destroyPage('non-existent')).rejects.toThrow('Page not found');
    });

    test('should remove active page and clear activePageId', async () => {
      const pageId = await manager.createPage();
      expect(manager.activePageId).toBe(pageId);
      await manager.destroyPage(pageId);
      expect(manager.activePageId).toBeNull();
    });

    test('should emit page-destroyed event', async (done) => {
      const pageId = await manager.createPage();
      manager.on('page-destroyed', (event) => {
        expect(event.pageId).toBe(pageId);
        done();
      });
      await manager.destroyPage(pageId);
    });

    test('should increment statistics', async () => {
      const pageId = await manager.createPage();
      await manager.destroyPage(pageId);
      const stats = manager.getStatistics();
      expect(stats.pagesDestroyed).toBe(1);
    });
  });

  describe('Page Management - Set Active Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should set active page successfully', async () => {
      const pageId = await manager.createPage();
      const result = manager.setActivePage(pageId);
      expect(result.success).toBe(true);
      expect(result.pageId).toBe(pageId);
      expect(manager.activePageId).toBe(pageId);
    });

    test('should fail to set non-existent page as active', () => {
      expect(() => manager.setActivePage('non-existent')).toThrow('Page not found');
    });

    test('should switch between active pages', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      manager.setActivePage(pageId1);
      expect(manager.activePageId).toBe(pageId1);

      manager.setActivePage(pageId2);
      expect(manager.activePageId).toBe(pageId2);
    });

    test('should emit active-page-changed event', async (done) => {
      const pageId = await manager.createPage();
      manager.on('active-page-changed', (event) => {
        expect(event.pageId).toBe(pageId);
        done();
      });
      manager.setActivePage(pageId);
    });

    test('should add view to window', async () => {
      const pageId = await manager.createPage();
      manager.setActivePage(pageId);
      const page = manager.pages.get(pageId);
      expect(mockWindow.views).toContain(page.view);
    });
  });

  describe('Page Management - List Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should list all pages', async () => {
      await manager.createPage();
      await manager.createPage();
      await manager.createPage();

      const pages = manager.listPages();
      expect(pages.length).toBe(3);
    });

    test('should return empty array when no pages', () => {
      const pages = manager.listPages();
      expect(pages).toEqual([]);
    });

    test('should include page details', async () => {
      const pageId = await manager.createPage();
      const pages = manager.listPages();

      expect(pages[0]).toHaveProperty('pageId');
      expect(pages[0]).toHaveProperty('url');
      expect(pages[0]).toHaveProperty('title');
      expect(pages[0]).toHaveProperty('loading');
      expect(pages[0]).toHaveProperty('created');
    });
  });

  describe('Page Management - Get Page Info', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should get page info successfully', async () => {
      const pageId = await manager.createPage();
      const info = manager.getPage(pageId);

      expect(info).toBeDefined();
      expect(info.pageId).toBe(pageId);
      expect(info).toHaveProperty('url');
      expect(info).toHaveProperty('title');
      expect(info).toHaveProperty('loading');
      expect(info).toHaveProperty('created');
      expect(info).toHaveProperty('canGoBack');
      expect(info).toHaveProperty('canGoForward');
    });

    test('should return null for non-existent page', () => {
      const info = manager.getPage('non-existent');
      expect(info).toBeNull();
    });
  });

  describe('Page Management - Close All Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should close all pages', async () => {
      await manager.createPage();
      await manager.createPage();
      await manager.createPage();

      const result = await manager.closeAllPages();
      expect(result.closed).toBe(3);
      expect(manager.pages.size).toBe(0);
    });

    test('should return zero when no pages to close', async () => {
      const result = await manager.closeAllPages();
      expect(result.closed).toBe(0);
    });
  });

  describe('Page Management - Close Other Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should close other pages and keep specific ones', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();
      const pageId3 = await manager.createPage();

      const result = await manager.closeOtherPages([pageId1, pageId3]);
      expect(result.closed).toBe(1);
      expect(manager.pages.size).toBe(2);
      expect(manager.pages.has(pageId1)).toBe(true);
      expect(manager.pages.has(pageId2)).toBe(false);
      expect(manager.pages.has(pageId3)).toBe(true);
    });

    test('should close all pages when keep list is empty', async () => {
      await manager.createPage();
      await manager.createPage();

      const result = await manager.closeOtherPages([]);
      expect(result.closed).toBe(2);
      expect(manager.pages.size).toBe(0);
    });
  });

  describe('Navigation - Single Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'single', domainRateLimitDelay: 0 });
    });

    test('should navigate single page successfully', async () => {
      const pageId = await manager.createPage();
      const result = await manager.navigatePage(pageId, 'https://example.com');

      expect(result.success).toBe(true);
      expect(result.pageId).toBe(pageId);
      expect(result.url).toBe('https://example.com');
    });

    test('should fail to navigate non-existent page', async () => {
      await expect(manager.navigatePage('non-existent', 'https://example.com'))
        .rejects.toThrow('Page not found');
    });

    test('should emit page-loaded event', async (done) => {
      const pageId = await manager.createPage();
      manager.on('page-loaded', (event) => {
        expect(event.pageId).toBe(pageId);
        expect(event.url).toBe('https://example.com');
        done();
      });
      await manager.navigatePage(pageId, 'https://example.com');
    });
  });

  describe('Navigation - Multiple Pages Concurrently', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'aggressive', domainRateLimitDelay: 0 });
    });

    test('should navigate multiple pages concurrently', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();
      const pageId3 = await manager.createPage();

      const promises = [
        manager.navigatePage(pageId1, 'https://example1.com'),
        manager.navigatePage(pageId2, 'https://example2.com'),
        manager.navigatePage(pageId3, 'https://example3.com')
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Navigation - Batch Navigation', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced', domainRateLimitDelay: 0 });
    });

    test('should handle batch navigation', async () => {
      const pageIds = [];
      for (let i = 0; i < 3; i++) {
        pageIds.push(await manager.createPage());
      }

      const promises = pageIds.map((pageId, index) =>
        manager.navigatePage(pageId, `https://example${index}.com`)
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
    });
  });

  describe('Navigation - Queue When Limits Exceeded', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, {
        profile: 'stealth',
        maxConcurrentNavigations: 1,
        domainRateLimitDelay: 0
      });
    });

    test('should queue navigation when limits exceeded', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      // Start first navigation (should execute immediately)
      const promise1 = manager.navigatePage(pageId1, 'https://example1.com');

      // Start second navigation (should queue)
      const promise2 = manager.navigatePage(pageId2, 'https://example2.com');

      expect(manager.navigationQueue.length).toBeGreaterThan(0);

      await Promise.all([promise1, promise2]);
      expect(manager.navigationQueue.length).toBe(0);
    });

    test('should emit navigation-queued event', async (done) => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      manager.on('navigation-queued', (event) => {
        expect(event.pageId).toBe(pageId2);
        expect(event.queueLength).toBeGreaterThan(0);
        done();
      });

      manager.navigatePage(pageId1, 'https://example1.com');
      manager.navigatePage(pageId2, 'https://example2.com');
    });
  });

  describe('Navigation - Process Queue After Completion', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, {
        profile: 'stealth',
        maxConcurrentNavigations: 1,
        domainRateLimitDelay: 0
      });
    });

    test('should process navigation queue after completion', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      const promise1 = manager.navigatePage(pageId1, 'https://example1.com');
      const promise2 = manager.navigatePage(pageId2, 'https://example2.com');

      await promise1;
      expect(manager.activeNavigations).toBe(1); // Second navigation should be in progress

      await promise2;
      expect(manager.activeNavigations).toBe(0);
      expect(manager.navigationQueue.length).toBe(0);
    });
  });

  describe('Navigation - Rate Limiting Per Domain', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, {
        profile: 'balanced',
        domainRateLimitDelay: 1000
      });
    });

    test('should apply rate limiting per domain', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      const startTime = Date.now();
      await manager.navigatePage(pageId1, 'https://example.com/page1');
      await manager.navigatePage(pageId2, 'https://example.com/page2');
      const endTime = Date.now();

      const timeTaken = endTime - startTime;
      expect(timeTaken).toBeGreaterThanOrEqual(1000); // Rate limit delay
    });

    test('should not rate limit different domains', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      const startTime = Date.now();
      await Promise.all([
        manager.navigatePage(pageId1, 'https://example1.com'),
        manager.navigatePage(pageId2, 'https://example2.com')
      ]);
      const endTime = Date.now();

      const timeTaken = endTime - startTime;
      expect(timeTaken).toBeLessThan(1000); // Should be concurrent
    });

    test('should emit rate-limit-delay event', async (done) => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      manager.on('rate-limit-delay', (event) => {
        expect(event.domain).toBe('example.com');
        expect(event.delay).toBeGreaterThan(0);
        done();
      });

      await manager.navigatePage(pageId1, 'https://example.com/page1');
      await manager.navigatePage(pageId2, 'https://example.com/page2');
    });

    test('should increment rate limit delay statistics', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      await manager.navigatePage(pageId1, 'https://example.com/page1');
      await manager.navigatePage(pageId2, 'https://example.com/page2');

      const stats = manager.getStatistics();
      expect(stats.rateLimitDelays).toBeGreaterThan(0);
    });
  });

  describe('Navigation - Failure Handling', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should handle navigation failure', async () => {
      const pageId = await manager.createPage();
      const page = manager.pages.get(pageId);

      // Mock navigation failure
      page.view.webContents.loadURL = async () => {
        throw new Error('Navigation failed');
      };

      await expect(manager.navigatePage(pageId, 'https://invalid.com'))
        .rejects.toThrow('Navigation failed');
    });

    test('should emit page-load-failed event', async (done) => {
      const pageId = await manager.createPage();
      const page = manager.pages.get(pageId);

      manager.on('page-load-failed', (event) => {
        expect(event.pageId).toBe(pageId);
        done();
      });

      // Trigger fail event
      setTimeout(() => {
        page.view.webContents.emit('did-fail-load', {}, -1, 'Error', 'https://example.com');
      }, 10);

      await manager.navigatePage(pageId, 'https://example.com').catch(() => {});
    });

    test('should increment navigation failed statistics', async () => {
      const pageId = await manager.createPage();
      const page = manager.pages.get(pageId);

      // Trigger fail event
      setTimeout(() => {
        page.view.webContents.emit('did-fail-load', {}, -1, 'Error', 'https://example.com');
      }, 10);

      await manager.navigatePage(pageId, 'https://example.com').catch(() => {});

      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = manager.getStatistics();
      expect(stats.navigationsFailed).toBeGreaterThan(0);
    });
  });

  describe('JavaScript Execution - Single Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should execute code on specific page', async () => {
      const pageId = await manager.createPage();
      const result = await manager.executeOnPage(pageId, '2 + 2');
      expect(result).toBe(4);
    });

    test('should fail to execute on non-existent page', async () => {
      await expect(manager.executeOnPage('non-existent', '2 + 2'))
        .rejects.toThrow('Page not found');
    });
  });

  describe('JavaScript Execution - Multiple Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should execute on multiple pages', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();
      const pageId3 = await manager.createPage();

      const results = await Promise.all([
        manager.executeOnPage(pageId1, '1 + 1'),
        manager.executeOnPage(pageId2, '2 + 2'),
        manager.executeOnPage(pageId3, '3 + 3')
      ]);

      expect(results).toEqual([2, 4, 6]);
    });
  });

  describe('JavaScript Execution - Error Handling', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should handle execution errors', async () => {
      const pageId = await manager.createPage();
      await expect(manager.executeOnPage(pageId, 'throw new Error("test error")'))
        .rejects.toThrow('test error');
    });

    test('should handle execution on destroyed page', async () => {
      const pageId = await manager.createPage();
      await manager.destroyPage(pageId);
      await expect(manager.executeOnPage(pageId, '2 + 2'))
        .rejects.toThrow('Page not found');
    });
  });

  describe('Screenshots - Specific Page', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should capture screenshot from specific page', async () => {
      const pageId = await manager.createPage();
      const screenshot = await manager.getPageScreenshot(pageId);
      expect(screenshot).toBeInstanceOf(Buffer);
    });

    test('should fail to capture from non-existent page', async () => {
      await expect(manager.getPageScreenshot('non-existent'))
        .rejects.toThrow('Page not found');
    });
  });

  describe('Screenshots - Multiple Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should capture from multiple pages', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();
      const pageId3 = await manager.createPage();

      const screenshots = await Promise.all([
        manager.getPageScreenshot(pageId1),
        manager.getPageScreenshot(pageId2),
        manager.getPageScreenshot(pageId3)
      ]);

      expect(screenshots).toHaveLength(3);
      screenshots.forEach(screenshot => {
        expect(screenshot).toBeInstanceOf(Buffer);
      });
    });
  });

  describe('Screenshots - Inactive Pages', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should capture from inactive pages', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      manager.setActivePage(pageId1);

      // Capture from inactive page
      const screenshot = await manager.getPageScreenshot(pageId2);
      expect(screenshot).toBeInstanceOf(Buffer);
    });
  });

  describe('Statistics - Pages Created/Destroyed', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should track pages created', async () => {
      await manager.createPage();
      await manager.createPage();
      await manager.createPage();

      const stats = manager.getStatistics();
      expect(stats.pagesCreated).toBe(3);
    });

    test('should track pages destroyed', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      await manager.destroyPage(pageId1);
      await manager.destroyPage(pageId2);

      const stats = manager.getStatistics();
      expect(stats.pagesDestroyed).toBe(2);
    });
  });

  describe('Statistics - Navigations Completed/Failed', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced', domainRateLimitDelay: 0 });
    });

    test('should track navigations completed', async () => {
      const pageId = await manager.createPage();
      await manager.navigatePage(pageId, 'https://example1.com');
      await manager.navigatePage(pageId, 'https://example2.com');

      const stats = manager.getStatistics();
      expect(stats.navigationsCompleted).toBe(2);
    });

    test('should track navigations failed', async () => {
      const pageId = await manager.createPage();
      const page = manager.pages.get(pageId);

      // Trigger multiple failures
      page.view.webContents.emit('did-fail-load', {}, -1, 'Error', 'https://example1.com');
      page.view.webContents.emit('did-fail-load', {}, -1, 'Error', 'https://example2.com');

      await new Promise(resolve => setTimeout(resolve, 50));

      const stats = manager.getStatistics();
      expect(stats.navigationsFailed).toBe(2);
    });
  });

  describe('Statistics - Rate Limit Delays', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, {
        profile: 'balanced',
        domainRateLimitDelay: 1000
      });
    });

    test('should track rate limit delays', async () => {
      const pageId1 = await manager.createPage();
      const pageId2 = await manager.createPage();

      await manager.navigatePage(pageId1, 'https://example.com/page1');
      await manager.navigatePage(pageId2, 'https://example.com/page2');

      const stats = manager.getStatistics();
      expect(stats.rateLimitDelays).toBe(1);
    });
  });

  describe('Statistics - Resource Threshold Hits', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, {
        profile: 'balanced',
        maxMemoryMB: 1,
        resourceMonitoring: true
      });
    });

    test('should track resource threshold hits', (done) => {
      setTimeout(() => {
        const stats = manager.getStatistics();
        expect(stats.resourceThresholdHits).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Configuration - Update Dynamically', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should update configuration dynamically', () => {
      const result = manager.updateConfig({
        maxConcurrentPages: 20,
        maxConcurrentNavigations: 10
      });

      expect(result.success).toBe(true);
      expect(manager.config.maxConcurrentPages).toBe(20);
      expect(manager.config.maxConcurrentNavigations).toBe(10);
    });

    test('should emit config-updated event', (done) => {
      manager.on('config-updated', (event) => {
        expect(event.config).toBeDefined();
        expect(event.config.maxConcurrentPages).toBe(15);
        done();
      });

      manager.updateConfig({ maxConcurrentPages: 15 });
    });
  });

  describe('Configuration - Verify Changes Apply', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should apply memory limit changes', () => {
      manager.updateConfig({ maxMemoryMB: 8192 });
      expect(manager.config.maxMemoryMB).toBe(8192);
      expect(manager.resourceMonitor.maxMemoryMB).toBe(8192);
    });

    test('should apply CPU limit changes', () => {
      manager.updateConfig({ maxCPUPercent: 90 });
      expect(manager.config.maxCPUPercent).toBe(90);
      expect(manager.resourceMonitor.maxCPUPercent).toBe(90);
    });
  });

  describe('Configuration - Profile Switching', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should switch to stealth profile settings', () => {
      const stealthSettings = PROFILES.stealth;
      manager.updateConfig(stealthSettings);

      expect(manager.config.maxConcurrentPages).toBe(stealthSettings.maxConcurrentPages);
      expect(manager.config.maxConcurrentNavigations).toBe(stealthSettings.maxConcurrentNavigations);
    });

    test('should switch to aggressive profile settings', () => {
      const aggressiveSettings = PROFILES.aggressive;
      manager.updateConfig(aggressiveSettings);

      expect(manager.config.maxConcurrentPages).toBe(aggressiveSettings.maxConcurrentPages);
      expect(manager.config.maxConcurrentNavigations).toBe(aggressiveSettings.maxConcurrentNavigations);
    });
  });

  describe('Shutdown', () => {
    beforeEach(() => {
      manager = new MultiPageManager(mockWindow, { profile: 'balanced' });
    });

    test('should shutdown gracefully', async () => {
      await manager.createPage();
      await manager.createPage();

      await manager.shutdown();

      expect(manager.pages.size).toBe(0);
      expect(manager.resourceMonitor.checkTimer).toBeNull();
    });

    test('should emit shutdown event', (done) => {
      manager.on('shutdown', () => {
        done();
      });
      manager.shutdown();
    });

    test('should clear rate limiters', async () => {
      const pageId = await manager.createPage();
      await manager.navigatePage(pageId, 'https://example.com');

      await manager.shutdown();

      expect(manager.domainRateLimiters.size).toBe(0);
    });
  });
});

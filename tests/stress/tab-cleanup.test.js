/**
 * Tab Cleanup Stress Test
 * Tests event listener cleanup on page/tab destruction
 */

const { MultiPageManager } = require('../../multi-page/multi-page-manager');
const { EventEmitter } = require('events');

// Mock electron BrowserView before importing MultiPageManager
jest.mock('electron', () => ({
  BrowserView: class MockBrowserView {
    constructor(options) {
      this.webContents = new MockWebContents();
      this.bounds = null;
    }

    setBounds(bounds) {
      this.bounds = bounds;
    }
  }
}));

// Mock main window
class MockMainWindow extends EventEmitter {
  constructor() {
    super();
    this.views = [];
  }

  addBrowserView(view) {
    if (!this.views.includes(view)) {
      this.views.push(view);
    }
  }

  removeBrowserView(view) {
    const index = this.views.indexOf(view);
    if (index !== -1) {
      this.views.splice(index, 1);
    }
  }

  getContentBounds() {
    return { x: 0, y: 0, width: 1920, height: 1080 };
  }
}

// Mock WebContents
class MockWebContents extends EventEmitter {
  constructor() {
    super();
    this.url = 'about:blank';
    this.title = 'Test';
    this._listenerCount = 0;
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

  async loadURL(url) {
    this.url = url;
    return true;
  }

  async executeJavaScript(code) {
    return null;
  }

  async capturePage(options) {
    return Buffer.alloc(100);
  }

  destroy() {
    // NOP
  }

  // Track listener count
  on(event, listener) {
    this._listenerCount++;
    return super.on(event, listener);
  }

  removeListener(event, listener) {
    this._listenerCount--;
    return super.removeListener(event, listener);
  }

  getListenerCount() {
    return this.eventNames().reduce((sum, event) => sum + this.listenerCount(event), 0);
  }
}

describe('Tab Cleanup Stress Test', () => {
  let mainWindow;
  let manager;

  beforeEach(() => {
    mainWindow = new MockMainWindow();
    manager = new MultiPageManager(mainWindow, { profile: 'aggressive', maxConcurrentPages: 50 });
  });

  test('cleanup should remove all event listeners on page destruction', async () => {
    const pageId = await manager.createPage();

    const page = manager.pages.get(pageId);
    const webContents = page.view.webContents;

    // Track initial listener count
    const initialListeners = webContents.eventNames().length;
    expect(initialListeners).toBeGreaterThan(0);

    // Destroy the page
    await manager.destroyPage(pageId);

    // Verify listeners were removed
    const finalListeners = webContents.eventNames().length;
    expect(finalListeners).toBe(0);
  });

  test('100+ page creation/destruction cycles should not leak memory', async () => {
    const pageIds = [];
    const maxPages = 10; // Create in batches to stay under limit

    // Create and destroy 100+ pages in batches
    for (let cycle = 0; cycle < 10; cycle++) {
      const batch = [];

      // Create batch of pages
      for (let i = 0; i < maxPages; i++) {
        const pageId = await manager.createPage();
        batch.push(pageId);
      }

      // Destroy all pages in batch
      for (const pageId of batch) {
        await manager.destroyPage(pageId);
      }

      // Verify no pages remain
      expect(manager.pages.size).toBe(0);
    }

    // Verify final state
    expect(manager.stats.pagesCreated).toBe(100);
    expect(manager.stats.pagesDestroyed).toBe(100);
  });

  test('listener cleanup should handle rapid page switching', async () => {
    const pageIds = [];

    // Create multiple pages
    for (let i = 0; i < 5; i++) {
      const pageId = await manager.createPage();
      pageIds.push(pageId);
    }

    // Rapidly switch between pages
    for (let i = 0; i < 20; i++) {
      const pageId = pageIds[i % pageIds.length];
      manager.setActivePage(pageId);
    }

    // Destroy all pages - should not throw or leak
    for (const pageId of pageIds) {
      await manager.destroyPage(pageId);
    }

    expect(manager.pages.size).toBe(0);
  });

  test('concurrent page operations should cleanup properly', async () => {
    const promises = [];

    // Create pages concurrently
    for (let i = 0; i < 10; i++) {
      promises.push(manager.createPage());
    }

    const pageIds = await Promise.all(promises);

    // Destroy pages concurrently
    const destroyPromises = pageIds.map(id => manager.destroyPage(id));
    await Promise.all(destroyPromises);

    expect(manager.pages.size).toBe(0);
  });

  test('shutdown should cleanup all resources including listeners', async () => {
    // Create a few pages
    for (let i = 0; i < 3; i++) {
      await manager.createPage();
    }

    expect(manager.pages.size).toBe(3);

    // Shutdown manager
    await manager.shutdown();

    // Verify complete cleanup
    expect(manager.pages.size).toBe(0);
    expect(manager.domainRateLimiters.size).toBe(0);
  });

  test('should measure listener cleanup performance', async () => {
    const iterations = 50;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const pageId = await manager.createPage();
      const page = manager.pages.get(pageId);

      const start = Date.now();
      await manager.destroyPage(pageId);
      const duration = Date.now() - start;

      timings.push(duration);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTime = Math.max(...timings);

    console.log(`Cleanup Performance: avg=${avgTime.toFixed(2)}ms, max=${maxTime}ms`);

    // Cleanup should be fast (< 10ms on average)
    expect(avgTime).toBeLessThan(10);
    expect(maxTime).toBeLessThan(50);
  });
});

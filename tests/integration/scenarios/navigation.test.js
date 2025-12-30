/**
 * Navigation Test Scenarios
 *
 * Tests navigation commands and URL handling between extension and browser.
 */

// Skip in CI environments - these tests require WebSocket infrastructure
const shouldSkip = process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';

// Use conditional describe based on environment
const describeOrSkip = shouldSkip ? describe.skip : describe;

const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8780;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

// Navigation state tracking
const navigationState = {
  history: [],
  currentUrl: 'about:blank',
  pageTitle: 'New Tab',
  loadingStates: [],
  redirects: [],
  errors: []
};

/**
 * Test utilities
 */
const testUtils = {
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

/**
 * Setup navigation handlers
 */
function setupNavigationHandlers() {
  // Navigate to URL
  server.registerHandler('navigate', async (params) => {
    const { url, wait_for, timeout = 30000 } = params;

    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return { success: false, error: 'Invalid URL format' };
    }

    // Simulate navigation
    const previousUrl = navigationState.currentUrl;
    navigationState.loadingStates.push({ url, state: 'loading', timestamp: Date.now() });

    await testUtils.delay(50); // Simulate load time

    navigationState.currentUrl = url;
    navigationState.pageTitle = `Page: ${url}`;
    navigationState.history.push({
      url,
      title: navigationState.pageTitle,
      previousUrl,
      timestamp: new Date().toISOString()
    });

    navigationState.loadingStates.push({ url, state: 'complete', timestamp: Date.now() });

    return {
      success: true,
      url,
      title: navigationState.pageTitle,
      loaded: true
    };
  });

  // Get current URL
  server.registerHandler('get_url', async () => {
    return {
      success: true,
      url: navigationState.currentUrl,
      title: navigationState.pageTitle
    };
  });

  // Go back
  server.registerHandler('go_back', async () => {
    if (navigationState.history.length < 2) {
      return { success: false, error: 'Cannot go back, no history' };
    }

    const current = navigationState.history.pop();
    const previous = navigationState.history[navigationState.history.length - 1];

    navigationState.currentUrl = previous.url;
    navigationState.pageTitle = previous.title;

    return {
      success: true,
      url: previous.url,
      title: previous.title
    };
  });

  // Go forward
  server.registerHandler('go_forward', async () => {
    // In this mock, we don't maintain forward history
    return { success: false, error: 'Cannot go forward, no forward history' };
  });

  // Reload page
  server.registerHandler('reload', async (params) => {
    const { hard = false } = params;

    navigationState.loadingStates.push({
      url: navigationState.currentUrl,
      state: 'reloading',
      hard,
      timestamp: Date.now()
    });

    await testUtils.delay(50);

    navigationState.loadingStates.push({
      url: navigationState.currentUrl,
      state: 'complete',
      timestamp: Date.now()
    });

    return {
      success: true,
      url: navigationState.currentUrl,
      reloaded: true,
      hard
    };
  });

  // Wait for navigation
  server.registerHandler('wait_for_navigation', async (params) => {
    const { timeout = 30000, expectedUrl } = params;

    await testUtils.delay(50);

    if (expectedUrl && navigationState.currentUrl !== expectedUrl) {
      return { success: false, error: 'Navigation did not match expected URL' };
    }

    return {
      success: true,
      url: navigationState.currentUrl,
      title: navigationState.pageTitle
    };
  });

  // Get page state
  server.registerHandler('get_page_state', async () => {
    return {
      success: true,
      url: navigationState.currentUrl,
      title: navigationState.pageTitle,
      isLoading: navigationState.loadingStates[navigationState.loadingStates.length - 1]?.state === 'loading',
      history: {
        length: navigationState.history.length,
        canGoBack: navigationState.history.length > 1,
        canGoForward: false
      }
    };
  });

  // Get navigation history
  server.registerHandler('get_history', async (params) => {
    const { limit = 100, offset = 0 } = params;

    return {
      success: true,
      history: navigationState.history.slice(offset, offset + limit),
      total: navigationState.history.length
    };
  });

  // Scroll operations
  server.registerHandler('scroll', async (params) => {
    const { x, y, selector } = params;

    return {
      success: true,
      scrolled: true,
      x: x || 0,
      y: y || 0,
      selector
    };
  });

  // Scroll to element
  server.registerHandler('scroll_to_element', async (params) => {
    const { selector, block = 'start', inline = 'nearest' } = params;

    if (!selector) {
      return { success: false, error: 'Selector is required' };
    }

    return {
      success: true,
      selector,
      scrolled: true,
      block,
      inline
    };
  });

  // Get scroll position
  server.registerHandler('get_scroll_position', async () => {
    return {
      success: true,
      x: 0,
      y: 0,
      maxX: 0,
      maxY: 3000,
      viewportWidth: 1920,
      viewportHeight: 1080
    };
  });
}

describeOrSkip('Navigation Test Scenarios', () => {
  beforeAll(async () => {
    // Reset navigation state
    navigationState.history = [];
    navigationState.currentUrl = 'about:blank';
    navigationState.pageTitle = 'New Tab';
    navigationState.loadingStates = [];
    navigationState.redirects = [];
    navigationState.errors = [];

    server = new TestServer({ port: TEST_PORT });
    setupNavigationHandlers();
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  });

  afterAll(async () => {
    try {
      if (extension && extension.isConnected) {
        extension.disconnect();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      if (browser && browser.isConnected) {
        browser.disconnect();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    try {
      if (server) {
        await server.stop();
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    // Reset references
    extension = null;
    browser = null;
    server = null;
  });

  beforeEach(() => {
    // Reset navigation state between tests
    navigationState.history = [];
    navigationState.currentUrl = 'about:blank';
    navigationState.pageTitle = 'New Tab';
    navigationState.loadingStates = [];
    navigationState.redirects = [];
    navigationState.errors = [];
  });

  describe('Basic Navigation', () => {
    test('should navigate to URL successfully', async () => {
      const url = 'https://example.com/page1';
      const response = await extension.sendCommand('navigate', { url });

      expect(response.success).toBe(true);
      expect(response.result.url).toBe(url);
      expect(response.result.loaded).toBe(true);
    });

    test('should verify current URL after navigation', async () => {
      const url = 'https://example.com/page1';
      await extension.sendCommand('navigate', { url });

      const urlResponse = await extension.sendCommand('get_url', {});
      expect(urlResponse.result.url).toBe(url);
    });
  });

  describe('URL Validation', () => {
    test('should accept valid URL', async () => {
      const validResponse = await extension.sendCommand('navigate', {
        url: 'https://example.com'
      });
      expect(validResponse.success).toBe(true);
    });

    test('should reject invalid URL', async () => {
      const invalidResponse = await extension.sendCommand('navigate', {
        url: 'not-a-valid-url'
      });
      expect(invalidResponse.success).toBe(false);
      expect(invalidResponse.error).toContain('Invalid URL');
    });

    test('should reject missing URL', async () => {
      const missingResponse = await extension.sendCommand('navigate', {});
      expect(missingResponse.success).toBe(false);
    });
  });

  describe('Navigation History', () => {
    test('should track navigation history', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/page1' });
      await extension.sendCommand('navigate', { url: 'https://example.com/page2' });
      await extension.sendCommand('navigate', { url: 'https://example.com/page3' });

      const historyResponse = await extension.sendCommand('get_history', {});
      expect(historyResponse.success).toBe(true);
      expect(historyResponse.result.history.length).toBeGreaterThanOrEqual(3);
    });

    test('should navigate back successfully', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/page1' });
      await extension.sendCommand('navigate', { url: 'https://example.com/page2' });

      const backResponse = await extension.sendCommand('go_back', {});
      expect(backResponse.success).toBe(true);
      expect(backResponse.result.url).toBe('https://example.com/page1');
    });
  });

  describe('Page Reload', () => {
    test('should perform normal reload', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/reload-test' });

      const reloadResponse = await extension.sendCommand('reload', { hard: false });
      expect(reloadResponse.success).toBe(true);
      expect(reloadResponse.result.reloaded).toBe(true);
      expect(reloadResponse.result.hard).toBe(false);
    });

    test('should perform hard reload', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/reload-test' });

      const hardReloadResponse = await extension.sendCommand('reload', { hard: true });
      expect(hardReloadResponse.success).toBe(true);
      expect(hardReloadResponse.result.hard).toBe(true);
    });
  });

  describe('Wait for Navigation', () => {
    test('should wait for navigation with matching URL', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/wait-test' });

      const waitResponse = await extension.sendCommand('wait_for_navigation', {
        expectedUrl: 'https://example.com/wait-test'
      });
      expect(waitResponse.success).toBe(true);
    });

    test('should fail with wrong expected URL', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/wait-test' });

      const wrongUrlResponse = await extension.sendCommand('wait_for_navigation', {
        expectedUrl: 'https://different.com'
      });
      expect(wrongUrlResponse.success).toBe(false);
    });
  });

  describe('Page State', () => {
    test('should get page state', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/state-test' });

      const stateResponse = await extension.sendCommand('get_page_state', {});
      expect(stateResponse.success).toBe(true);
      expect(stateResponse.result.url).toBeTruthy();
      expect(stateResponse.result.title).toBeTruthy();
      expect('isLoading' in stateResponse.result).toBe(true);
      expect(stateResponse.result.history).toBeTruthy();
    });

    test('should report correct history state', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/page1' });
      await extension.sendCommand('navigate', { url: 'https://example.com/state-test' });

      const stateResponse = await extension.sendCommand('get_page_state', {});
      expect(stateResponse.result.history.canGoBack).toBe(true);
    });
  });

  describe('Scroll Navigation', () => {
    test('should scroll by coordinates', async () => {
      const scrollResponse = await extension.sendCommand('scroll', { x: 0, y: 500 });
      expect(scrollResponse.success).toBe(true);
      expect(scrollResponse.result.y).toBe(500);
    });

    test('should scroll to element', async () => {
      const scrollToResponse = await extension.sendCommand('scroll_to_element', {
        selector: '#footer',
        block: 'end'
      });
      expect(scrollToResponse.success).toBe(true);
      expect(scrollToResponse.result.selector).toBe('#footer');
    });

    test('should get scroll position', async () => {
      const positionResponse = await extension.sendCommand('get_scroll_position', {});
      expect(positionResponse.success).toBe(true);
      expect('x' in positionResponse.result).toBe(true);
      expect('y' in positionResponse.result).toBe(true);
    });
  });

  describe('Sequential Navigation', () => {
    test('should handle multiple sequential navigations', async () => {
      const urls = [
        'https://example.com/seq1',
        'https://example.com/seq2',
        'https://example.com/seq3',
        'https://example.com/seq4',
        'https://example.com/seq5'
      ];

      for (const url of urls) {
        const response = await extension.sendCommand('navigate', { url });
        expect(response.success).toBe(true);
      }

      const finalUrl = await extension.sendCommand('get_url', {});
      expect(finalUrl.result.url).toBe(urls[urls.length - 1]);

      const history = await extension.sendCommand('get_history', {});
      expect(history.result.history.length).toBeGreaterThanOrEqual(urls.length);
    });
  });

  describe('Navigation with Query Parameters', () => {
    test('should preserve query parameters', async () => {
      const url = 'https://example.com/search?q=test&page=1&sort=desc';
      const response = await extension.sendCommand('navigate', { url });

      expect(response.success).toBe(true);
      expect(response.result.url).toBe(url);
    });

    test('should handle encoded parameters', async () => {
      const encodedUrl = 'https://example.com/search?q=hello%20world&filter=%3Ctest%3E';
      const encodedResponse = await extension.sendCommand('navigate', { url: encodedUrl });
      expect(encodedResponse.success).toBe(true);
    });
  });

  describe('Navigation with Hash Fragments', () => {
    test('should preserve hash fragment', async () => {
      const url = 'https://example.com/page#section1';
      const response = await extension.sendCommand('navigate', { url });

      expect(response.success).toBe(true);
      expect(response.result.url).toBe(url);
    });

    test('should navigate to different hash fragment', async () => {
      await extension.sendCommand('navigate', { url: 'https://example.com/page#section1' });

      const url2 = 'https://example.com/page#section2';
      const response2 = await extension.sendCommand('navigate', { url: url2 });
      expect(response2.success).toBe(true);
    });
  });

  describe('Complete Navigation Flow', () => {
    test('should complete full navigation workflow', async () => {
      // 1. Navigate to page
      const navResponse = await extension.sendCommand('navigate', {
        url: 'https://example.com/flow-test'
      });
      expect(navResponse.success).toBe(true);

      // 2. Wait for navigation
      const waitResponse = await extension.sendCommand('wait_for_navigation', {
        timeout: 5000
      });
      expect(waitResponse.success).toBe(true);

      // 3. Get page state
      const stateResponse = await extension.sendCommand('get_page_state', {});
      expect(stateResponse.success).toBe(true);

      // 4. Scroll down
      const scrollResponse = await extension.sendCommand('scroll', { y: 500 });
      expect(scrollResponse.success).toBe(true);

      // 5. Navigate to another page
      const nav2Response = await extension.sendCommand('navigate', {
        url: 'https://example.com/flow-test-2'
      });
      expect(nav2Response.success).toBe(true);

      // 6. Go back
      const backResponse = await extension.sendCommand('go_back', {});
      expect(backResponse.success).toBe(true);

      // 7. Verify we're on original page
      const finalUrl = await extension.sendCommand('get_url', {});
      expect(finalUrl.result.url).toBe('https://example.com/flow-test');
    });
  });
});

// Export for external use
module.exports = { testUtils };

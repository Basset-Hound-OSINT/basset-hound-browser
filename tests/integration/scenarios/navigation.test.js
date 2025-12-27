/**
 * Navigation Test Scenarios
 *
 * Tests navigation commands and URL handling between extension and browser.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8770;
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
  async setup() {
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
  },

  async teardown() {
    if (extension && extension.isConnected) {
      extension.disconnect();
    }
    if (browser && browser.isConnected) {
      browser.disconnect();
    }
    if (server && server.isRunning) {
      await server.stop();
    }
  },

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

/**
 * Test Suite: Basic Navigation
 */
async function testBasicNavigation() {
  console.log('\n--- Test: Basic Navigation ---');

  const url = 'https://example.com/page1';
  const response = await extension.sendCommand('navigate', { url });

  assert(response.success, 'Navigation should succeed');
  assert(response.result.url === url, 'URL should match');
  assert(response.result.loaded, 'Page should be loaded');
  console.log('  Navigated to URL');

  // Verify current URL
  const urlResponse = await extension.sendCommand('get_url', {});
  assert(urlResponse.result.url === url, 'Current URL should match');
  console.log('  Verified current URL');

  console.log('PASSED: Basic Navigation');
  return true;
}

/**
 * Test Suite: URL Validation
 */
async function testUrlValidation() {
  console.log('\n--- Test: URL Validation ---');

  // Valid URL
  const validResponse = await extension.sendCommand('navigate', {
    url: 'https://example.com'
  });
  assert(validResponse.success, 'Valid URL should succeed');
  console.log('  Valid URL accepted');

  // Invalid URL
  const invalidResponse = await extension.sendCommand('navigate', {
    url: 'not-a-valid-url'
  });
  assert(!invalidResponse.success, 'Invalid URL should fail');
  assert(invalidResponse.result.error.includes('Invalid URL'), 'Should report URL error');
  console.log('  Invalid URL rejected');

  // Missing URL
  const missingResponse = await extension.sendCommand('navigate', {});
  assert(!missingResponse.success, 'Missing URL should fail');
  console.log('  Missing URL rejected');

  console.log('PASSED: URL Validation');
  return true;
}

/**
 * Test Suite: Navigation History
 */
async function testNavigationHistory() {
  console.log('\n--- Test: Navigation History ---');

  // Navigate to multiple pages
  await extension.sendCommand('navigate', { url: 'https://example.com/page1' });
  await extension.sendCommand('navigate', { url: 'https://example.com/page2' });
  await extension.sendCommand('navigate', { url: 'https://example.com/page3' });
  console.log('  Navigated to 3 pages');

  // Check history
  const historyResponse = await extension.sendCommand('get_history', {});
  assert(historyResponse.success, 'Get history should succeed');
  assert(historyResponse.result.history.length >= 3, 'Should have 3+ history entries');
  console.log('  History contains navigated pages');

  // Go back
  const backResponse = await extension.sendCommand('go_back', {});
  assert(backResponse.success, 'Go back should succeed');
  assert(backResponse.result.url === 'https://example.com/page2', 'Should be on page2');
  console.log('  Successfully navigated back');

  console.log('PASSED: Navigation History');
  return true;
}

/**
 * Test Suite: Page Reload
 */
async function testPageReload() {
  console.log('\n--- Test: Page Reload ---');

  // Navigate first
  await extension.sendCommand('navigate', { url: 'https://example.com/reload-test' });

  // Normal reload
  const reloadResponse = await extension.sendCommand('reload', { hard: false });
  assert(reloadResponse.success, 'Normal reload should succeed');
  assert(reloadResponse.result.reloaded, 'Page should be reloaded');
  assert(!reloadResponse.result.hard, 'Should not be hard reload');
  console.log('  Normal reload completed');

  // Hard reload
  const hardReloadResponse = await extension.sendCommand('reload', { hard: true });
  assert(hardReloadResponse.success, 'Hard reload should succeed');
  assert(hardReloadResponse.result.hard, 'Should be hard reload');
  console.log('  Hard reload completed');

  console.log('PASSED: Page Reload');
  return true;
}

/**
 * Test Suite: Wait for Navigation
 */
async function testWaitForNavigation() {
  console.log('\n--- Test: Wait for Navigation ---');

  // Navigate
  await extension.sendCommand('navigate', { url: 'https://example.com/wait-test' });

  // Wait for navigation (already complete)
  const waitResponse = await extension.sendCommand('wait_for_navigation', {
    expectedUrl: 'https://example.com/wait-test'
  });
  assert(waitResponse.success, 'Wait should succeed');
  console.log('  Wait for navigation completed');

  // Wait with wrong expected URL
  const wrongUrlResponse = await extension.sendCommand('wait_for_navigation', {
    expectedUrl: 'https://different.com'
  });
  assert(!wrongUrlResponse.success, 'Should fail with wrong URL');
  console.log('  Correctly failed with wrong expected URL');

  console.log('PASSED: Wait for Navigation');
  return true;
}

/**
 * Test Suite: Page State
 */
async function testPageState() {
  console.log('\n--- Test: Page State ---');

  await extension.sendCommand('navigate', { url: 'https://example.com/state-test' });

  const stateResponse = await extension.sendCommand('get_page_state', {});
  assert(stateResponse.success, 'Get page state should succeed');
  assert(stateResponse.result.url, 'Should have URL');
  assert(stateResponse.result.title, 'Should have title');
  assert('isLoading' in stateResponse.result, 'Should have loading state');
  assert(stateResponse.result.history, 'Should have history info');
  console.log('  Retrieved page state');

  assert(stateResponse.result.history.canGoBack, 'Should be able to go back');
  console.log('  History state correct');

  console.log('PASSED: Page State');
  return true;
}

/**
 * Test Suite: Scroll Navigation
 */
async function testScrollNavigation() {
  console.log('\n--- Test: Scroll Navigation ---');

  // Scroll by coordinates
  const scrollResponse = await extension.sendCommand('scroll', { x: 0, y: 500 });
  assert(scrollResponse.success, 'Scroll should succeed');
  assert(scrollResponse.result.y === 500, 'Y position should match');
  console.log('  Scrolled by coordinates');

  // Scroll to element
  const scrollToResponse = await extension.sendCommand('scroll_to_element', {
    selector: '#footer',
    block: 'end'
  });
  assert(scrollToResponse.success, 'Scroll to element should succeed');
  assert(scrollToResponse.result.selector === '#footer', 'Selector should match');
  console.log('  Scrolled to element');

  // Get scroll position
  const positionResponse = await extension.sendCommand('get_scroll_position', {});
  assert(positionResponse.success, 'Get scroll position should succeed');
  assert('x' in positionResponse.result, 'Should have x position');
  assert('y' in positionResponse.result, 'Should have y position');
  console.log('  Retrieved scroll position');

  console.log('PASSED: Scroll Navigation');
  return true;
}

/**
 * Test Suite: Sequential Navigation
 */
async function testSequentialNavigation() {
  console.log('\n--- Test: Sequential Navigation ---');

  const urls = [
    'https://example.com/seq1',
    'https://example.com/seq2',
    'https://example.com/seq3',
    'https://example.com/seq4',
    'https://example.com/seq5'
  ];

  for (const url of urls) {
    const response = await extension.sendCommand('navigate', { url });
    assert(response.success, `Navigation to ${url} should succeed`);
  }
  console.log('  Completed sequential navigation to 5 pages');

  // Verify final URL
  const finalUrl = await extension.sendCommand('get_url', {});
  assert(finalUrl.result.url === urls[urls.length - 1], 'Final URL should match');
  console.log('  Final URL is correct');

  // Verify history length
  const history = await extension.sendCommand('get_history', {});
  assert(history.result.history.length >= urls.length, 'History should contain all URLs');
  console.log('  History contains all navigated URLs');

  console.log('PASSED: Sequential Navigation');
  return true;
}

/**
 * Test Suite: Navigation with Query Parameters
 */
async function testNavigationWithQueryParams() {
  console.log('\n--- Test: Navigation with Query Parameters ---');

  const url = 'https://example.com/search?q=test&page=1&sort=desc';
  const response = await extension.sendCommand('navigate', { url });

  assert(response.success, 'Navigation with query params should succeed');
  assert(response.result.url === url, 'Full URL with params should be preserved');
  console.log('  Navigated with query parameters');

  // URL with special characters
  const encodedUrl = 'https://example.com/search?q=hello%20world&filter=%3Ctest%3E';
  const encodedResponse = await extension.sendCommand('navigate', { url: encodedUrl });
  assert(encodedResponse.success, 'Navigation with encoded params should succeed');
  console.log('  Navigated with encoded parameters');

  console.log('PASSED: Navigation with Query Parameters');
  return true;
}

/**
 * Test Suite: Navigation with Hash Fragments
 */
async function testNavigationWithHashFragments() {
  console.log('\n--- Test: Navigation with Hash Fragments ---');

  const url = 'https://example.com/page#section1';
  const response = await extension.sendCommand('navigate', { url });

  assert(response.success, 'Navigation with hash should succeed');
  assert(response.result.url === url, 'URL with hash should be preserved');
  console.log('  Navigated with hash fragment');

  // Navigate to different hash on same page
  const url2 = 'https://example.com/page#section2';
  const response2 = await extension.sendCommand('navigate', { url: url2 });
  assert(response2.success, 'Navigation to different hash should succeed');
  console.log('  Navigated to different hash fragment');

  console.log('PASSED: Navigation with Hash Fragments');
  return true;
}

/**
 * Test Suite: Complete Navigation Flow
 */
async function testCompleteNavigationFlow() {
  console.log('\n--- Test: Complete Navigation Flow ---');

  // 1. Navigate to page
  const navResponse = await extension.sendCommand('navigate', {
    url: 'https://example.com/flow-test'
  });
  assert(navResponse.success, 'Navigation should succeed');
  console.log('  Step 1: Navigated to page');

  // 2. Wait for navigation
  const waitResponse = await extension.sendCommand('wait_for_navigation', {
    timeout: 5000
  });
  assert(waitResponse.success, 'Wait should succeed');
  console.log('  Step 2: Waited for navigation');

  // 3. Get page state
  const stateResponse = await extension.sendCommand('get_page_state', {});
  assert(stateResponse.success, 'Get state should succeed');
  console.log('  Step 3: Got page state');

  // 4. Scroll down
  const scrollResponse = await extension.sendCommand('scroll', { y: 500 });
  assert(scrollResponse.success, 'Scroll should succeed');
  console.log('  Step 4: Scrolled down');

  // 5. Navigate to another page
  const nav2Response = await extension.sendCommand('navigate', {
    url: 'https://example.com/flow-test-2'
  });
  assert(nav2Response.success, 'Second navigation should succeed');
  console.log('  Step 5: Navigated to second page');

  // 6. Go back
  const backResponse = await extension.sendCommand('go_back', {});
  assert(backResponse.success, 'Go back should succeed');
  console.log('  Step 6: Went back');

  // 7. Verify we're on original page
  const finalUrl = await extension.sendCommand('get_url', {});
  assert(finalUrl.result.url === 'https://example.com/flow-test', 'Should be back on original page');
  console.log('  Step 7: Verified back on original page');

  console.log('PASSED: Complete Navigation Flow');
  return true;
}

/**
 * Run all navigation tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Navigation Test Scenarios');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Basic Navigation', fn: testBasicNavigation },
    { name: 'URL Validation', fn: testUrlValidation },
    { name: 'Navigation History', fn: testNavigationHistory },
    { name: 'Page Reload', fn: testPageReload },
    { name: 'Wait for Navigation', fn: testWaitForNavigation },
    { name: 'Page State', fn: testPageState },
    { name: 'Scroll Navigation', fn: testScrollNavigation },
    { name: 'Sequential Navigation', fn: testSequentialNavigation },
    { name: 'Navigation with Query Parameters', fn: testNavigationWithQueryParams },
    { name: 'Navigation with Hash Fragments', fn: testNavigationWithHashFragments },
    { name: 'Complete Navigation Flow', fn: testCompleteNavigationFlow }
  ];

  try {
    await testUtils.setup();

    for (const test of tests) {
      try {
        await test.fn();
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
      } catch (error) {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED', error: error.message });
        console.log(`FAILED: ${test.name} - ${error.message}`);
      }
    }
  } finally {
    await testUtils.teardown();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('Navigation Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total:  ${results.tests.length}`);

  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }

  return results.failed === 0;
}

// Export for external use
module.exports = { runTests, testUtils };

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

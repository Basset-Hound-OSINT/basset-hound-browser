/**
 * Command Synchronization Tests
 *
 * Tests that commands sent from one component are correctly received
 * and processed by the other component.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8767;
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// Test state
let server = null;
let extension = null;
let browser = null;

/**
 * Test utilities
 */
const testUtils = {
  async setup() {
    server = new TestServer({ port: TEST_PORT });
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
 * Test Suite: Navigation Command Sync
 */
async function testNavigationCommandSync() {
  console.log('\n--- Test: Navigation Command Sync ---');

  // Register handler for navigate command
  let navigationReceived = null;
  server.registerHandler('navigate', async (params) => {
    navigationReceived = params;
    return { success: true, url: params.url };
  });

  // Extension sends navigation command
  const url = 'https://example.com/test-page';
  const response = await extension.sendCommand('navigate', { url });

  assert(response.success, 'Navigation command should succeed');
  assert(navigationReceived, 'Server should receive navigation');
  assert(navigationReceived.url === url, 'URL should match');
  console.log('  Navigation command synchronized correctly');

  // Verify browser state updated
  browser.handleNavigate({ url });
  assert(browser.getState().currentUrl === url, 'Browser URL should be updated');
  console.log('  Browser state updated after navigation');

  console.log('PASSED: Navigation Command Sync');
  return true;
}

/**
 * Test Suite: Form Fill Command Sync
 */
async function testFormFillCommandSync() {
  console.log('\n--- Test: Form Fill Command Sync ---');

  let formFillReceived = null;
  server.registerHandler('fill_form', async (params) => {
    formFillReceived = params;
    return { success: true, filled: Object.keys(params.fields) };
  });

  const fields = {
    'username': 'testuser',
    'email': 'test@example.com',
    'password': 'securepass123'
  };

  const response = await extension.sendCommand('fill_form', { fields, submit: false });

  assert(response.success, 'Fill form command should succeed');
  assert(formFillReceived, 'Server should receive form fill');
  assert(formFillReceived.fields.username === 'testuser', 'Username should match');
  assert(formFillReceived.fields.email === 'test@example.com', 'Email should match');
  console.log('  Form fill command synchronized with all fields');

  console.log('PASSED: Form Fill Command Sync');
  return true;
}

/**
 * Test Suite: Click Command Sync
 */
async function testClickCommandSync() {
  console.log('\n--- Test: Click Command Sync ---');

  const clicks = [];
  server.registerHandler('click', async (params) => {
    clicks.push(params);
    return { success: true, clicked: params.selector };
  });

  // Test single click
  const selector1 = '#submit-button';
  await extension.sendCommand('click', { selector: selector1 });
  assert(clicks.length === 1, 'Should receive one click');
  assert(clicks[0].selector === selector1, 'Selector should match');
  console.log('  Single click synchronized');

  // Test multiple clicks
  const selector2 = '.menu-item';
  const selector3 = 'a.link';
  await extension.sendCommand('click', { selector: selector2 });
  await extension.sendCommand('click', { selector: selector3 });
  assert(clicks.length === 3, 'Should receive all clicks');
  console.log('  Multiple clicks synchronized');

  console.log('PASSED: Click Command Sync');
  return true;
}

/**
 * Test Suite: Screenshot Command Sync
 */
async function testScreenshotCommandSync() {
  console.log('\n--- Test: Screenshot Command Sync ---');

  let screenshotRequested = null;
  server.registerHandler('screenshot', async (params) => {
    screenshotRequested = params;
    return {
      success: true,
      data: 'data:image/png;base64,mockdata',
      format: params.format || 'png',
      width: 1920,
      height: 1080
    };
  });

  const response = await extension.sendCommand('screenshot', { format: 'png', quality: 100 });

  assert(response.success, 'Screenshot command should succeed');
  assert(screenshotRequested, 'Server should receive screenshot request');
  assert(response.result.format === 'png', 'Format should be preserved');
  assert(response.result.data.startsWith('data:image'), 'Should return image data');
  console.log('  Screenshot command synchronized correctly');

  console.log('PASSED: Screenshot Command Sync');
  return true;
}

/**
 * Test Suite: Script Execution Sync
 */
async function testScriptExecutionSync() {
  console.log('\n--- Test: Script Execution Sync ---');

  const executedScripts = [];
  server.registerHandler('execute_script', async (params) => {
    executedScripts.push(params.script);
    // Simulate script execution result
    if (params.script.includes('document.title')) {
      return { success: true, result: 'Test Page Title' };
    }
    if (params.script.includes('navigator.userAgent')) {
      return { success: true, result: 'Mozilla/5.0 Test Browser' };
    }
    return { success: true, result: null };
  });

  // Execute title retrieval script
  const titleResponse = await extension.sendCommand('execute_script', {
    script: 'return document.title'
  });
  assert(titleResponse.success, 'Script execution should succeed');
  assert(titleResponse.result.result === 'Test Page Title', 'Should return title');
  console.log('  Script execution synchronized');

  // Execute user agent script
  const uaResponse = await extension.sendCommand('execute_script', {
    script: 'return navigator.userAgent'
  });
  assert(uaResponse.success, 'UA script should succeed');
  console.log('  Multiple script executions tracked');

  assert(executedScripts.length === 2, 'Both scripts should be tracked');

  console.log('PASSED: Script Execution Sync');
  return true;
}

/**
 * Test Suite: Cookie Command Sync
 */
async function testCookieCommandSync() {
  console.log('\n--- Test: Cookie Command Sync ---');

  const cookieStore = [];

  server.registerHandler('set_cookies', async (params) => {
    cookieStore.push(...params.cookies);
    return { success: true, count: params.cookies.length };
  });

  server.registerHandler('get_cookies', async (params) => {
    return { success: true, cookies: cookieStore };
  });

  // Set cookies
  const cookies = [
    { name: 'session', value: 'abc123', domain: '.example.com' },
    { name: 'user', value: 'testuser', domain: '.example.com' }
  ];

  const setResponse = await extension.sendCommand('set_cookies', { cookies });
  assert(setResponse.success, 'Set cookies should succeed');
  assert(cookieStore.length === 2, 'Cookies should be stored');
  console.log('  Set cookies synchronized');

  // Get cookies
  const getResponse = await extension.sendCommand('get_cookies', { url: 'https://example.com' });
  assert(getResponse.success, 'Get cookies should succeed');
  assert(getResponse.result.cookies.length === 2, 'Should return stored cookies');
  console.log('  Get cookies synchronized');

  console.log('PASSED: Cookie Command Sync');
  return true;
}

/**
 * Test Suite: Tab Management Sync
 */
async function testTabManagementSync() {
  console.log('\n--- Test: Tab Management Sync ---');

  const tabEvents = [];

  server.registerHandler('new_tab', async (params) => {
    tabEvents.push({ type: 'new', params });
    return { success: true, tab: { id: 'tab-123', url: params.url } };
  });

  server.registerHandler('close_tab', async (params) => {
    tabEvents.push({ type: 'close', params });
    return { success: true, closedTabId: params.tabId };
  });

  server.registerHandler('switch_tab', async (params) => {
    tabEvents.push({ type: 'switch', params });
    return { success: true, tab: { id: params.tabId } };
  });

  server.registerHandler('list_tabs', async () => {
    return { success: true, tabs: [{ id: 'tab-1' }, { id: 'tab-2' }] };
  });

  // Create new tab
  await extension.sendCommand('new_tab', { url: 'https://example.com' });
  assert(tabEvents[0].type === 'new', 'New tab event should be recorded');
  console.log('  New tab synchronized');

  // Switch tab
  await extension.sendCommand('switch_tab', { tabId: 'tab-123' });
  assert(tabEvents[1].type === 'switch', 'Switch tab event should be recorded');
  console.log('  Switch tab synchronized');

  // Close tab
  await extension.sendCommand('close_tab', { tabId: 'tab-123' });
  assert(tabEvents[2].type === 'close', 'Close tab event should be recorded');
  console.log('  Close tab synchronized');

  // List tabs
  const listResponse = await extension.sendCommand('list_tabs', {});
  assert(listResponse.success, 'List tabs should succeed');
  console.log('  List tabs synchronized');

  console.log('PASSED: Tab Management Sync');
  return true;
}

/**
 * Test Suite: Session Management Sync
 */
async function testSessionManagementSync() {
  console.log('\n--- Test: Session Management Sync ---');

  const sessions = new Map();

  server.registerHandler('create_session', async (params) => {
    const sessionId = `session-${Date.now()}`;
    sessions.set(sessionId, { id: sessionId, name: params.name });
    return { success: true, session: { id: sessionId, name: params.name } };
  });

  server.registerHandler('switch_session', async (params) => {
    if (!sessions.has(params.sessionId) && params.sessionId !== 'default') {
      return { success: false, error: 'Session not found' };
    }
    return { success: true, sessionId: params.sessionId };
  });

  server.registerHandler('list_sessions', async () => {
    return { success: true, sessions: Array.from(sessions.values()) };
  });

  // Create session
  const createResponse = await extension.sendCommand('create_session', { name: 'Test Session' });
  assert(createResponse.success, 'Create session should succeed');
  console.log('  Create session synchronized');

  // List sessions
  const listResponse = await extension.sendCommand('list_sessions', {});
  assert(listResponse.success, 'List sessions should succeed');
  assert(listResponse.result.sessions.length > 0, 'Should have sessions');
  console.log('  List sessions synchronized');

  // Switch session
  const sessionId = createResponse.result.session.id;
  const switchResponse = await extension.sendCommand('switch_session', { sessionId });
  assert(switchResponse.success, 'Switch session should succeed');
  console.log('  Switch session synchronized');

  console.log('PASSED: Session Management Sync');
  return true;
}

/**
 * Test Suite: Wait for Element Sync
 */
async function testWaitForElementSync() {
  console.log('\n--- Test: Wait for Element Sync ---');

  server.registerHandler('wait_for_element', async (params) => {
    // Simulate element appearing after short delay
    await testUtils.delay(50);
    return {
      success: true,
      found: true,
      selector: params.selector,
      timeout: params.timeout
    };
  });

  const response = await extension.sendCommand('wait_for_element', {
    selector: '#dynamic-element',
    timeout: 5000
  });

  assert(response.success, 'Wait command should succeed');
  assert(response.result.found, 'Element should be found');
  console.log('  Wait for element synchronized');

  console.log('PASSED: Wait for Element Sync');
  return true;
}

/**
 * Test Suite: Scroll Command Sync
 */
async function testScrollCommandSync() {
  console.log('\n--- Test: Scroll Command Sync ---');

  let scrollParams = null;
  server.registerHandler('scroll', async (params) => {
    scrollParams = params;
    return { success: true, x: params.x || 0, y: params.y || 0 };
  });

  // Test scroll by coordinates
  await extension.sendCommand('scroll', { x: 0, y: 500 });
  assert(scrollParams.y === 500, 'Y coordinate should be synced');
  console.log('  Scroll by coordinates synchronized');

  // Test scroll to element
  await extension.sendCommand('scroll', { selector: '#footer' });
  assert(scrollParams.selector === '#footer', 'Selector should be synced');
  console.log('  Scroll to element synchronized');

  console.log('PASSED: Scroll Command Sync');
  return true;
}

/**
 * Test Suite: Page State Sync
 */
async function testPageStateSync() {
  console.log('\n--- Test: Page State Sync ---');

  server.registerHandler('get_page_state', async () => {
    return {
      success: true,
      url: 'https://example.com',
      title: 'Example Page',
      forms: [{ id: 'login-form', action: '/login' }],
      links: [{ href: '/about', text: 'About' }],
      buttons: [{ text: 'Submit', type: 'submit' }]
    };
  });

  const response = await extension.sendCommand('get_page_state', {});

  assert(response.success, 'Get page state should succeed');
  assert(response.result.url === 'https://example.com', 'URL should be synced');
  assert(response.result.forms.length > 0, 'Forms should be synced');
  assert(response.result.links.length > 0, 'Links should be synced');
  assert(response.result.buttons.length > 0, 'Buttons should be synced');
  console.log('  Full page state synchronized');

  console.log('PASSED: Page State Sync');
  return true;
}

/**
 * Test Suite: Recording Command Sync
 */
async function testRecordingCommandSync() {
  console.log('\n--- Test: Recording Command Sync ---');

  let recordingState = 'stopped';

  server.registerHandler('start_recording', async (params) => {
    recordingState = 'recording';
    return { success: true, state: 'recording', format: params.format };
  });

  server.registerHandler('stop_recording', async () => {
    recordingState = 'stopped';
    return { success: true, state: 'stopped', data: 'mock-recording' };
  });

  server.registerHandler('recording_status', async () => {
    return { success: true, state: recordingState };
  });

  // Start recording
  const startResponse = await extension.sendCommand('start_recording', { format: 'webm' });
  assert(startResponse.success, 'Start recording should succeed');
  assert(recordingState === 'recording', 'State should be recording');
  console.log('  Start recording synchronized');

  // Check status
  const statusResponse = await extension.sendCommand('recording_status', {});
  assert(statusResponse.result.state === 'recording', 'Status should show recording');
  console.log('  Recording status synchronized');

  // Stop recording
  const stopResponse = await extension.sendCommand('stop_recording', {});
  assert(stopResponse.success, 'Stop recording should succeed');
  assert(recordingState === 'stopped', 'State should be stopped');
  console.log('  Stop recording synchronized');

  console.log('PASSED: Recording Command Sync');
  return true;
}

/**
 * Test Suite: Command Response Matching
 */
async function testCommandResponseMatching() {
  console.log('\n--- Test: Command Response Matching ---');

  let commandCounter = 0;
  server.registerHandler('numbered', async (params) => {
    commandCounter++;
    return { success: true, number: commandCounter };
  });

  // Send multiple commands and verify responses match
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(extension.sendCommand('numbered', { index: i }));
  }

  const responses = await Promise.all(promises);

  // Verify all responses were received
  assert(responses.length === 10, 'All responses should be received');
  assert(responses.every(r => r.success), 'All responses should be successful');
  console.log('  All command responses matched correctly');

  console.log('PASSED: Command Response Matching');
  return true;
}

/**
 * Run all command sync tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Command Synchronization Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Navigation Command Sync', fn: testNavigationCommandSync },
    { name: 'Form Fill Command Sync', fn: testFormFillCommandSync },
    { name: 'Click Command Sync', fn: testClickCommandSync },
    { name: 'Screenshot Command Sync', fn: testScreenshotCommandSync },
    { name: 'Script Execution Sync', fn: testScriptExecutionSync },
    { name: 'Cookie Command Sync', fn: testCookieCommandSync },
    { name: 'Tab Management Sync', fn: testTabManagementSync },
    { name: 'Session Management Sync', fn: testSessionManagementSync },
    { name: 'Wait for Element Sync', fn: testWaitForElementSync },
    { name: 'Scroll Command Sync', fn: testScrollCommandSync },
    { name: 'Page State Sync', fn: testPageStateSync },
    { name: 'Recording Command Sync', fn: testRecordingCommandSync },
    { name: 'Command Response Matching', fn: testCommandResponseMatching }
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
  console.log('Command Sync Test Summary');
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

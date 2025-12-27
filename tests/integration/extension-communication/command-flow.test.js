/**
 * Command Flow Integration Tests
 *
 * Tests command flow from extension to browser's WebSocket server.
 * Verifies all command types are correctly transmitted, processed, and responded to.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8771;
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

    extension = new MockExtension({ url: TEST_URL, autoReconnect: false });
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
 * Test Suite: Navigate Command Flow
 */
async function testNavigateCommandFlow() {
  console.log('\n--- Test: Navigate Command Flow ---');

  let navigationParams = null;
  server.registerHandler('navigate', async (params) => {
    navigationParams = params;
    return { success: true, url: params.url, loaded: true };
  });

  const testUrl = 'https://example.com/test-page';
  const response = await extension.sendCommand('navigate', { url: testUrl });

  assert(response.success, 'Navigate command should succeed');
  assert(response.result.url === testUrl, 'Response should include URL');
  assert(navigationParams, 'Server should receive navigation params');
  assert(navigationParams.url === testUrl, 'URL should be transmitted correctly');
  console.log('  Navigate command flowed correctly');

  // Test with wait_for parameter
  const waitResponse = await extension.sendCommand('navigate', {
    url: testUrl,
    wait_for: '#main-content',
    timeout: 5000
  });

  assert(waitResponse.success, 'Navigate with wait_for should succeed');
  console.log('  Navigate with wait_for parameter handled');

  console.log('PASSED: Navigate Command Flow');
  return true;
}

/**
 * Test Suite: Fill Form Command Flow
 */
async function testFillFormCommandFlow() {
  console.log('\n--- Test: Fill Form Command Flow ---');

  let formParams = null;
  server.registerHandler('fill_form', async (params) => {
    formParams = params;
    return { success: true, filled: Object.keys(params.fields) };
  });

  const fields = {
    '#username': 'testuser',
    '#email': 'test@example.com',
    '#password': 'SecurePass123!',
    'input[name="phone"]': '+1234567890'
  };

  const response = await extension.sendCommand('fill_form', {
    fields,
    submit: false
  });

  assert(response.success, 'Fill form command should succeed');
  assert(formParams, 'Server should receive form params');
  assert(Object.keys(formParams.fields).length === 4, 'All fields should be transmitted');
  assert(formParams.fields['#username'] === 'testuser', 'Field values should be correct');
  console.log('  Form fields transmitted correctly');

  // Test with submit flag
  const submitResponse = await extension.sendCommand('fill_form', {
    fields: { '#search': 'query' },
    submit: true
  });

  assert(submitResponse.success, 'Fill form with submit should succeed');
  console.log('  Form submit flag handled');

  console.log('PASSED: Fill Form Command Flow');
  return true;
}

/**
 * Test Suite: Click Command Flow
 */
async function testClickCommandFlow() {
  console.log('\n--- Test: Click Command Flow ---');

  const clicks = [];
  server.registerHandler('click', async (params) => {
    clicks.push(params);
    return { success: true, clicked: params.selector };
  });

  // Single click
  const response = await extension.sendCommand('click', {
    selector: '#submit-btn'
  });

  assert(response.success, 'Click command should succeed');
  assert(clicks.length === 1, 'One click should be recorded');
  assert(clicks[0].selector === '#submit-btn', 'Selector should match');
  console.log('  Click command transmitted correctly');

  // Click with humanize option
  const humanizeResponse = await extension.sendCommand('click', {
    selector: '.menu-item',
    humanize: true
  });

  assert(humanizeResponse.success, 'Humanized click should succeed');
  assert(clicks[1].humanize === true, 'Humanize flag should be transmitted');
  console.log('  Click with humanize option handled');

  // Click with wait_after
  const waitResponse = await extension.sendCommand('click', {
    selector: 'a.link',
    wait_after: 1000
  });

  assert(waitResponse.success, 'Click with wait_after should succeed');
  console.log('  Click with wait_after handled');

  console.log('PASSED: Click Command Flow');
  return true;
}

/**
 * Test Suite: Screenshot Command Flow
 */
async function testScreenshotCommandFlow() {
  console.log('\n--- Test: Screenshot Command Flow ---');

  server.registerHandler('screenshot', async (params) => {
    return {
      success: true,
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
      format: params.format || 'png',
      quality: params.quality || 100,
      width: 1920,
      height: 1080
    };
  });

  // Basic screenshot
  const response = await extension.sendCommand('screenshot', {});
  assert(response.success, 'Screenshot command should succeed');
  assert(response.result.data.startsWith('data:image'), 'Should return base64 image');
  console.log('  Basic screenshot captured');

  // Screenshot with options
  const jpegResponse = await extension.sendCommand('screenshot', {
    format: 'jpeg',
    quality: 80
  });

  assert(jpegResponse.success, 'JPEG screenshot should succeed');
  assert(jpegResponse.result.format === 'jpeg', 'Format should be JPEG');
  console.log('  Screenshot with format options handled');

  console.log('PASSED: Screenshot Command Flow');
  return true;
}

/**
 * Test Suite: Get Content Command Flow
 */
async function testGetContentCommandFlow() {
  console.log('\n--- Test: Get Content Command Flow ---');

  const mockContent = '<html><body><h1>Test Page</h1><p>Content</p></body></html>';

  server.registerHandler('get_content', async (params) => {
    return {
      success: true,
      content: params.selector ?
        `<div id="selected">Selected content for ${params.selector}</div>` :
        mockContent,
      url: 'https://example.com'
    };
  });

  // Get full page content
  const response = await extension.sendCommand('get_content', {});
  assert(response.success, 'Get content should succeed');
  assert(response.result.content.includes('<html>'), 'Should return HTML content');
  console.log('  Full page content retrieved');

  // Get content by selector
  const selectorResponse = await extension.sendCommand('get_content', {
    selector: '#main'
  });

  assert(selectorResponse.success, 'Get content by selector should succeed');
  assert(selectorResponse.result.content.includes('Selected content'), 'Should return selected content');
  console.log('  Content by selector retrieved');

  console.log('PASSED: Get Content Command Flow');
  return true;
}

/**
 * Test Suite: Execute Script Command Flow
 */
async function testExecuteScriptCommandFlow() {
  console.log('\n--- Test: Execute Script Command Flow ---');

  const executedScripts = [];
  server.registerHandler('execute_script', async (params) => {
    executedScripts.push(params.script);

    // Simulate different script results
    if (params.script.includes('document.title')) {
      return { success: true, result: 'Test Page Title' };
    }
    if (params.script.includes('JSON.parse')) {
      return { success: true, result: { key: 'value', nested: { data: true } } };
    }
    if (params.script.includes('throw')) {
      return { success: false, error: 'Script execution error' };
    }

    return { success: true, result: null };
  });

  // Simple script
  const response = await extension.sendCommand('execute_script', {
    script: 'return document.title'
  });

  assert(response.success, 'Script execution should succeed');
  assert(response.result.result === 'Test Page Title', 'Script result should be returned');
  console.log('  Simple script executed');

  // Script returning object
  const objResponse = await extension.sendCommand('execute_script', {
    script: 'return JSON.parse(data)'
  });

  assert(objResponse.success, 'Object-returning script should succeed');
  assert(typeof objResponse.result.result === 'object', 'Should return object');
  console.log('  Script returning object handled');

  // Script with error
  const errorResponse = await extension.sendCommand('execute_script', {
    script: 'throw new Error("test")'
  });

  assert(!errorResponse.success, 'Error script should fail');
  assert(errorResponse.error, 'Error message should be returned');
  console.log('  Script error handled');

  console.log('PASSED: Execute Script Command Flow');
  return true;
}

/**
 * Test Suite: Wait for Element Command Flow
 */
async function testWaitForElementCommandFlow() {
  console.log('\n--- Test: Wait for Element Command Flow ---');

  server.registerHandler('wait_for_element', async (params) => {
    // Simulate waiting for element
    await testUtils.delay(50);

    if (params.selector === '#not-found') {
      return { success: false, error: 'Element not found', found: false };
    }

    return {
      success: true,
      found: true,
      selector: params.selector,
      timeout: params.timeout
    };
  });

  // Wait for existing element
  const response = await extension.sendCommand('wait_for_element', {
    selector: '#dynamic-element',
    timeout: 5000
  });

  assert(response.success, 'Wait for element should succeed');
  assert(response.result.found, 'Element should be found');
  console.log('  Wait for element succeeded');

  // Wait for non-existent element
  const notFoundResponse = await extension.sendCommand('wait_for_element', {
    selector: '#not-found',
    timeout: 1000
  });

  assert(!notFoundResponse.success, 'Wait for non-existent should fail');
  console.log('  Wait for non-existent element handled');

  console.log('PASSED: Wait for Element Command Flow');
  return true;
}

/**
 * Test Suite: Cookie Commands Flow
 */
async function testCookieCommandsFlow() {
  console.log('\n--- Test: Cookie Commands Flow ---');

  const cookieStore = [];

  server.registerHandler('set_cookies', async (params) => {
    params.cookies.forEach(c => cookieStore.push(c));
    return { success: true, count: params.cookies.length };
  });

  server.registerHandler('get_cookies', async (params) => {
    const filtered = params.url ?
      cookieStore.filter(c => c.domain && params.url.includes(c.domain.replace(/^\./, ''))) :
      cookieStore;
    return { success: true, cookies: filtered };
  });

  server.registerHandler('delete_cookie', async (params) => {
    const index = cookieStore.findIndex(c => c.name === params.name);
    if (index > -1) {
      cookieStore.splice(index, 1);
      return { success: true };
    }
    return { success: false, error: 'Cookie not found' };
  });

  // Set cookies
  const setResponse = await extension.sendCommand('set_cookies', {
    cookies: [
      { name: 'session', value: 'abc123', domain: '.example.com', secure: true },
      { name: 'user', value: 'testuser', domain: '.example.com' }
    ]
  });

  assert(setResponse.success, 'Set cookies should succeed');
  assert(setResponse.result.count === 2, 'Should set 2 cookies');
  console.log('  Set cookies command handled');

  // Get cookies
  const getResponse = await extension.sendCommand('get_cookies', {
    url: 'https://example.com'
  });

  assert(getResponse.success, 'Get cookies should succeed');
  assert(getResponse.result.cookies.length === 2, 'Should return 2 cookies');
  console.log('  Get cookies command handled');

  // Delete cookie
  const deleteResponse = await extension.sendCommand('delete_cookie', {
    name: 'session',
    url: 'https://example.com'
  });

  assert(deleteResponse.success, 'Delete cookie should succeed');
  console.log('  Delete cookie command handled');

  console.log('PASSED: Cookie Commands Flow');
  return true;
}

/**
 * Test Suite: Storage Commands Flow
 */
async function testStorageCommandsFlow() {
  console.log('\n--- Test: Storage Commands Flow ---');

  const localStorage = {};
  const sessionStorage = {};

  server.registerHandler('get_local_storage', async (params) => {
    if (params.keys) {
      const items = {};
      params.keys.forEach(k => {
        if (localStorage[k] !== undefined) items[k] = localStorage[k];
      });
      return { success: true, items };
    }
    return { success: true, items: { ...localStorage } };
  });

  server.registerHandler('set_local_storage', async (params) => {
    Object.assign(localStorage, params.items);
    return { success: true, count: Object.keys(params.items).length };
  });

  server.registerHandler('get_session_storage', async (params) => {
    return { success: true, items: { ...sessionStorage } };
  });

  server.registerHandler('set_session_storage', async (params) => {
    Object.assign(sessionStorage, params.items);
    return { success: true, count: Object.keys(params.items).length };
  });

  server.registerHandler('clear_storage', async (params) => {
    const results = {};
    if (!params.types || params.types.includes('localStorage')) {
      Object.keys(localStorage).forEach(k => delete localStorage[k]);
      results.localStorage = { success: true };
    }
    if (!params.types || params.types.includes('sessionStorage')) {
      Object.keys(sessionStorage).forEach(k => delete sessionStorage[k]);
      results.sessionStorage = { success: true };
    }
    return { success: true, results };
  });

  // Set localStorage
  const setLocalResponse = await extension.sendCommand('set_local_storage', {
    items: { key1: 'value1', key2: 'value2' }
  });

  assert(setLocalResponse.success, 'Set localStorage should succeed');
  console.log('  Set localStorage handled');

  // Get localStorage
  const getLocalResponse = await extension.sendCommand('get_local_storage', {
    keys: ['key1']
  });

  assert(getLocalResponse.success, 'Get localStorage should succeed');
  assert(getLocalResponse.result.items.key1 === 'value1', 'Should return correct value');
  console.log('  Get localStorage handled');

  // Set sessionStorage
  const setSessionResponse = await extension.sendCommand('set_session_storage', {
    items: { sessionKey: 'sessionValue' }
  });

  assert(setSessionResponse.success, 'Set sessionStorage should succeed');
  console.log('  Set sessionStorage handled');

  // Clear storage
  const clearResponse = await extension.sendCommand('clear_storage', {
    types: ['localStorage', 'sessionStorage']
  });

  assert(clearResponse.success, 'Clear storage should succeed');
  console.log('  Clear storage handled');

  console.log('PASSED: Storage Commands Flow');
  return true;
}

/**
 * Test Suite: Network Request Commands Flow
 */
async function testNetworkRequestCommandsFlow() {
  console.log('\n--- Test: Network Request Commands Flow ---');

  let capturing = false;
  const networkLog = [];

  server.registerHandler('start_network_capture', async (params) => {
    capturing = true;
    return {
      success: true,
      capturing: true,
      urlPatterns: params.urlPatterns || ['<all_urls>']
    };
  });

  server.registerHandler('stop_network_capture', async (params) => {
    capturing = false;
    return {
      success: true,
      capturing: false,
      log: networkLog,
      count: networkLog.length
    };
  });

  server.registerHandler('get_network_log', async (params) => {
    let log = [...networkLog];
    if (params.urlPattern) {
      log = log.filter(r => r.url.includes(params.urlPattern));
    }
    if (params.method) {
      log = log.filter(r => r.method === params.method);
    }
    return { success: true, log, count: log.length };
  });

  server.registerHandler('clear_network_log', async (params) => {
    networkLog.length = 0;
    return { success: true, cleared: true };
  });

  // Start capture
  const startResponse = await extension.sendCommand('start_network_capture', {
    urlPatterns: ['*://api.example.com/*']
  });

  assert(startResponse.success, 'Start network capture should succeed');
  assert(startResponse.result.capturing, 'Should be capturing');
  console.log('  Start network capture handled');

  // Get log
  const logResponse = await extension.sendCommand('get_network_log', {});
  assert(logResponse.success, 'Get network log should succeed');
  console.log('  Get network log handled');

  // Stop capture
  const stopResponse = await extension.sendCommand('stop_network_capture', {});
  assert(stopResponse.success, 'Stop network capture should succeed');
  assert(!stopResponse.result.capturing, 'Should not be capturing');
  console.log('  Stop network capture handled');

  // Clear log
  const clearResponse = await extension.sendCommand('clear_network_log', {});
  assert(clearResponse.success, 'Clear network log should succeed');
  console.log('  Clear network log handled');

  console.log('PASSED: Network Request Commands Flow');
  return true;
}

/**
 * Test Suite: Form Detection Commands Flow
 */
async function testFormDetectionCommandsFlow() {
  console.log('\n--- Test: Form Detection Commands Flow ---');

  server.registerHandler('detect_forms', async (params) => {
    return {
      success: true,
      forms: [
        {
          id: 'login-form',
          action: '/login',
          method: 'POST',
          fields: [
            { name: 'username', type: 'text', required: true },
            { name: 'password', type: 'password', required: true }
          ]
        },
        {
          id: 'search-form',
          action: '/search',
          method: 'GET',
          fields: [
            { name: 'q', type: 'text', required: false }
          ]
        }
      ],
      count: 2
    };
  });

  server.registerHandler('auto_fill_form', async (params) => {
    return {
      success: true,
      formSelector: params.formSelector,
      fieldsFilledCount: Object.keys(params.data).length,
      submitted: params.options?.submitAfter || false
    };
  });

  server.registerHandler('get_form_validation', async (params) => {
    return {
      success: true,
      valid: true,
      errors: [],
      formSelector: params.formSelector
    };
  });

  // Detect forms
  const detectResponse = await extension.sendCommand('detect_forms', {
    includeHidden: false
  });

  assert(detectResponse.success, 'Detect forms should succeed');
  assert(detectResponse.result.forms.length === 2, 'Should detect 2 forms');
  console.log('  Detect forms handled');

  // Auto fill form
  const fillResponse = await extension.sendCommand('auto_fill_form', {
    formSelector: '#login-form',
    data: { username: 'testuser', password: 'testpass' },
    options: { humanLike: true }
  });

  assert(fillResponse.success, 'Auto fill form should succeed');
  assert(fillResponse.result.fieldsFilledCount === 2, 'Should fill 2 fields');
  console.log('  Auto fill form handled');

  // Get form validation
  const validationResponse = await extension.sendCommand('get_form_validation', {
    formSelector: '#login-form'
  });

  assert(validationResponse.success, 'Get form validation should succeed');
  assert(validationResponse.result.valid, 'Form should be valid');
  console.log('  Get form validation handled');

  console.log('PASSED: Form Detection Commands Flow');
  return true;
}

/**
 * Test Suite: Advanced Interaction Commands Flow
 */
async function testAdvancedInteractionCommandsFlow() {
  console.log('\n--- Test: Advanced Interaction Commands Flow ---');

  server.registerHandler('fill_select', async (params) => {
    return { success: true, selector: params.selector, value: params.value };
  });

  server.registerHandler('fill_checkbox', async (params) => {
    return { success: true, selector: params.selector, checked: params.checked };
  });

  server.registerHandler('fill_radio', async (params) => {
    return { success: true, name: params.name, value: params.value };
  });

  server.registerHandler('fill_date', async (params) => {
    return { success: true, selector: params.selector, date: params.date };
  });

  server.registerHandler('scroll', async (params) => {
    return { success: true, x: params.x || 0, y: params.y || 0 };
  });

  // Fill select
  const selectResponse = await extension.sendCommand('fill_select', {
    selector: '#country',
    value: 'US',
    options: { byText: false }
  });

  assert(selectResponse.success, 'Fill select should succeed');
  console.log('  Fill select handled');

  // Fill checkbox
  const checkboxResponse = await extension.sendCommand('fill_checkbox', {
    selector: '#agree-terms',
    checked: true
  });

  assert(checkboxResponse.success, 'Fill checkbox should succeed');
  console.log('  Fill checkbox handled');

  // Fill radio
  const radioResponse = await extension.sendCommand('fill_radio', {
    name: 'payment-method',
    value: 'credit-card'
  });

  assert(radioResponse.success, 'Fill radio should succeed');
  console.log('  Fill radio handled');

  // Fill date
  const dateResponse = await extension.sendCommand('fill_date', {
    selector: '#birth-date',
    date: '1990-01-15'
  });

  assert(dateResponse.success, 'Fill date should succeed');
  console.log('  Fill date handled');

  // Scroll
  const scrollResponse = await extension.sendCommand('scroll', {
    y: 500,
    humanize: true
  });

  assert(scrollResponse.success, 'Scroll should succeed');
  console.log('  Scroll handled');

  console.log('PASSED: Advanced Interaction Commands Flow');
  return true;
}

/**
 * Test Suite: Command Error Handling Flow
 */
async function testCommandErrorHandlingFlow() {
  console.log('\n--- Test: Command Error Handling Flow ---');

  // Unknown command
  const unknownResponse = await extension.sendCommand('unknown_command_xyz', {});
  assert(!unknownResponse.success, 'Unknown command should fail');
  assert(unknownResponse.error, 'Error message should be present');
  console.log('  Unknown command error handled');

  // Command with missing required params
  server.registerHandler('test_required', async (params) => {
    if (!params.required_field) {
      throw new Error('required_field is required');
    }
    return { success: true };
  });

  const missingParamResponse = await extension.sendCommand('test_required', {});
  assert(!missingParamResponse.success, 'Missing required param should fail');
  console.log('  Missing required param error handled');

  // Command that throws internal error
  server.registerHandler('test_throw', async (params) => {
    throw new Error('Internal processing error');
  });

  const throwResponse = await extension.sendCommand('test_throw', {});
  assert(!throwResponse.success, 'Throwing command should fail');
  assert(throwResponse.error.includes('Internal'), 'Error message should be preserved');
  console.log('  Internal error handled');

  console.log('PASSED: Command Error Handling Flow');
  return true;
}

/**
 * Test Suite: Command Response Matching Flow
 */
async function testCommandResponseMatchingFlow() {
  console.log('\n--- Test: Command Response Matching Flow ---');

  let counter = 0;
  server.registerHandler('counter', async (params) => {
    counter++;
    return { success: true, count: counter, id: params.id };
  });

  // Send multiple commands in parallel
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(extension.sendCommand('counter', { id: i }));
  }

  const responses = await Promise.all(promises);

  // Verify all responses received
  assert(responses.length === 20, 'All 20 responses should be received');
  assert(responses.every(r => r.success), 'All responses should be successful');
  console.log('  All parallel commands got responses');

  // Verify response IDs match request IDs
  const ids = responses.map(r => r.result.id);
  for (let i = 0; i < 20; i++) {
    assert(ids.includes(i), `Response for id ${i} should be received`);
  }
  console.log('  Command-response matching verified');

  console.log('PASSED: Command Response Matching Flow');
  return true;
}

/**
 * Run all command flow tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Command Flow Integration Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Navigate Command Flow', fn: testNavigateCommandFlow },
    { name: 'Fill Form Command Flow', fn: testFillFormCommandFlow },
    { name: 'Click Command Flow', fn: testClickCommandFlow },
    { name: 'Screenshot Command Flow', fn: testScreenshotCommandFlow },
    { name: 'Get Content Command Flow', fn: testGetContentCommandFlow },
    { name: 'Execute Script Command Flow', fn: testExecuteScriptCommandFlow },
    { name: 'Wait for Element Command Flow', fn: testWaitForElementCommandFlow },
    { name: 'Cookie Commands Flow', fn: testCookieCommandsFlow },
    { name: 'Storage Commands Flow', fn: testStorageCommandsFlow },
    { name: 'Network Request Commands Flow', fn: testNetworkRequestCommandsFlow },
    { name: 'Form Detection Commands Flow', fn: testFormDetectionCommandsFlow },
    { name: 'Advanced Interaction Commands Flow', fn: testAdvancedInteractionCommandsFlow },
    { name: 'Command Error Handling Flow', fn: testCommandErrorHandlingFlow },
    { name: 'Command Response Matching Flow', fn: testCommandResponseMatchingFlow }
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
  console.log('Command Flow Test Summary');
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

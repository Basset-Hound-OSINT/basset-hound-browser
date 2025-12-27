/**
 * Error Handling and Reconnection Integration Tests
 *
 * Tests error handling, recovery, and reconnection scenarios between
 * the Chrome extension and Electron browser.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Test configuration
const TEST_PORT = 8775;
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
    setupServerHandlers();
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
  },

  createExtension(options = {}) {
    return new MockExtension({ url: TEST_URL, ...options });
  }
};

/**
 * Setup server handlers
 */
function setupServerHandlers() {
  // Handler that throws error
  server.registerHandler('throw_error', async (params) => {
    throw new Error(params.message || 'Intentional test error');
  });

  // Handler with timeout simulation
  server.registerHandler('slow_command', async (params) => {
    const delay = params.delay || 5000;
    await testUtils.delay(delay);
    return { success: true, delayed: delay };
  });

  // Handler that returns error response
  server.registerHandler('error_response', async (params) => {
    return {
      success: false,
      error: params.errorMessage || 'Error from handler'
    };
  });

  // Handler for validation errors
  server.registerHandler('validate_params', async (params) => {
    if (!params.required) {
      throw new Error('required parameter is missing');
    }
    if (typeof params.number !== 'number') {
      throw new Error('number parameter must be a number');
    }
    return { success: true, validated: true };
  });

  // Normal handler for comparison
  server.registerHandler('normal_command', async (params) => {
    return { success: true, data: 'normal response' };
  });

  // Handler that sometimes fails
  let callCount = 0;
  server.registerHandler('flaky_command', async (params) => {
    callCount++;
    if (callCount % 3 === 0) {
      return { success: true, attempt: callCount };
    }
    throw new Error('Flaky error');
  });

  // Reset flaky counter
  server.registerHandler('reset_flaky', async () => {
    callCount = 0;
    return { success: true };
  });

  // Handler with retry logic tracking
  const retryAttempts = new Map();
  server.registerHandler('retry_command', async (params) => {
    const key = params.key || 'default';
    const attempt = (retryAttempts.get(key) || 0) + 1;
    retryAttempts.set(key, attempt);

    if (attempt < (params.failUntil || 3)) {
      throw new Error(`Attempt ${attempt} failed`);
    }

    return { success: true, successOnAttempt: attempt };
  });

  server.registerHandler('reset_retry', async () => {
    retryAttempts.clear();
    return { success: true };
  });
}

/**
 * Test Suite: Handler Error Propagation
 */
async function testHandlerErrorPropagation() {
  console.log('\n--- Test: Handler Error Propagation ---');

  // Test error thrown in handler
  const errorResponse = await extension.sendCommand('throw_error', {
    message: 'Test error message'
  });

  assert(!errorResponse.success, 'Error response should not be successful');
  assert(errorResponse.error, 'Error message should be present');
  assert(errorResponse.error.includes('Test error message'), 'Error message should be preserved');
  console.log('  Handler error propagated correctly');

  // Connection should still be alive after error
  const normalResponse = await extension.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Normal command should work after error');
  console.log('  Connection stable after error');

  console.log('PASSED: Handler Error Propagation');
  return true;
}

/**
 * Test Suite: Unknown Command Error
 */
async function testUnknownCommandError() {
  console.log('\n--- Test: Unknown Command Error ---');

  // Send unknown command
  const unknownResponse = await extension.sendCommand('completely_unknown_command_xyz', {
    param: 'value'
  });

  assert(!unknownResponse.success, 'Unknown command should fail');
  assert(unknownResponse.error, 'Error message should be present');
  assert(unknownResponse.error.includes('Unknown') || unknownResponse.error.includes('unknown'),
    'Error should mention unknown command');
  console.log('  Unknown command error handled');

  // Connection still works
  const normalResponse = await extension.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Normal command should still work');
  console.log('  Connection stable after unknown command');

  console.log('PASSED: Unknown Command Error');
  return true;
}

/**
 * Test Suite: Validation Error
 */
async function testValidationError() {
  console.log('\n--- Test: Validation Error ---');

  // Missing required parameter
  const missingResponse = await extension.sendCommand('validate_params', {
    number: 42
  });

  assert(!missingResponse.success, 'Should fail without required param');
  assert(missingResponse.error.includes('required'), 'Error should mention missing required');
  console.log('  Missing required param error handled');

  // Wrong type parameter
  const wrongTypeResponse = await extension.sendCommand('validate_params', {
    required: true,
    number: 'not a number'
  });

  assert(!wrongTypeResponse.success, 'Should fail with wrong type');
  assert(wrongTypeResponse.error.includes('number'), 'Error should mention wrong type');
  console.log('  Wrong type param error handled');

  // Valid parameters
  const validResponse = await extension.sendCommand('validate_params', {
    required: true,
    number: 42
  });

  assert(validResponse.success, 'Valid params should succeed');
  console.log('  Valid params work correctly');

  console.log('PASSED: Validation Error');
  return true;
}

/**
 * Test Suite: Command Timeout Handling
 */
async function testCommandTimeoutHandling() {
  console.log('\n--- Test: Command Timeout Handling ---');

  // Send command with short timeout
  const shortTimeoutExt = testUtils.createExtension({
    autoReconnect: false,
    commandTimeout: 200  // Very short timeout
  });
  await shortTimeoutExt.connect();

  let timeoutError = null;
  try {
    await shortTimeoutExt.sendCommand('slow_command', { delay: 1000 }, 200);
  } catch (error) {
    timeoutError = error;
  }

  assert(timeoutError, 'Should throw timeout error');
  assert(timeoutError.message.includes('timeout'), 'Error should mention timeout');
  console.log('  Command timeout handled');

  // Extension should still be connected
  assert(shortTimeoutExt.isConnected, 'Extension should remain connected after timeout');
  console.log('  Connection stable after timeout');

  shortTimeoutExt.disconnect();

  console.log('PASSED: Command Timeout Handling');
  return true;
}

/**
 * Test Suite: Error Response Handling
 */
async function testErrorResponseHandling() {
  console.log('\n--- Test: Error Response Handling ---');

  // Handler returns error response
  const errorResponse = await extension.sendCommand('error_response', {
    errorMessage: 'Business logic error'
  });

  assert(!errorResponse.success, 'Error response should not be successful');
  assert(errorResponse.error === 'Business logic error', 'Error message should match');
  console.log('  Error response handled correctly');

  console.log('PASSED: Error Response Handling');
  return true;
}

/**
 * Test Suite: Reconnection After Disconnect
 */
async function testReconnectionAfterDisconnect() {
  console.log('\n--- Test: Reconnection After Disconnect ---');

  const reconnectExt = testUtils.createExtension({
    autoReconnect: true,
    reconnectDelay: 50,
    maxReconnectAttempts: 5
  });

  await reconnectExt.connect();
  assert(reconnectExt.isConnected, 'Should be connected initially');
  console.log('  Initial connection established');

  // Track reconnection
  let reconnected = false;
  reconnectExt.once('connected', () => {
    reconnected = true;
  });

  // Force disconnect by closing the client's WebSocket
  const clientWs = server.getClient();
  clientWs.close(1001, 'Simulated disconnect');

  await testUtils.delay(50);  // Wait for disconnect to register
  assert(!reconnectExt.isConnected, 'Should be disconnected');
  console.log('  Disconnect detected');

  // Wait for reconnection
  await testUtils.delay(300);

  assert(reconnected, 'Should have reconnected');
  assert(reconnectExt.isConnected, 'Should be connected after reconnect');
  console.log('  Reconnection successful');

  // Commands should work after reconnection
  const normalResponse = await reconnectExt.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Commands should work after reconnection');
  console.log('  Commands work after reconnection');

  reconnectExt.disconnect();

  console.log('PASSED: Reconnection After Disconnect');
  return true;
}

/**
 * Test Suite: Reconnection Limit
 */
async function testReconnectionLimit() {
  console.log('\n--- Test: Reconnection Limit ---');

  // Stop server to prevent reconnection
  await server.stop();

  const limitExt = testUtils.createExtension({
    autoReconnect: true,
    reconnectDelay: 50,
    maxReconnectAttempts: 3
  });

  let reconnectFailedEmitted = false;
  limitExt.on('reconnectFailed', () => {
    reconnectFailedEmitted = true;
  });

  // Try to connect (will fail)
  try {
    await limitExt.connect();
  } catch (e) {
    // Expected
  }

  // Wait for reconnection attempts to exhaust
  await testUtils.delay(600);  // 50 + 100 + 200 = 350ms minimum + buffer

  assert(reconnectFailedEmitted, 'Should emit reconnectFailed after max attempts');
  console.log('  Reconnection limit enforced');

  // Restart server for other tests
  server = new TestServer({ port: TEST_PORT });
  setupServerHandlers();
  await server.start();

  console.log('PASSED: Reconnection Limit');
  return true;
}

/**
 * Test Suite: Graceful Degradation
 */
async function testGracefulDegradation() {
  console.log('\n--- Test: Graceful Degradation ---');

  // Reset flaky command counter
  await extension.sendCommand('reset_flaky', {});

  // Flaky command that fails intermittently
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < 6; i++) {
    const response = await extension.sendCommand('flaky_command', {});
    if (response.success) {
      successes++;
    } else {
      failures++;
    }
  }

  assert(successes > 0, 'Should have some successes');
  assert(failures > 0, 'Should have some failures');
  console.log(`  Handled ${successes} successes and ${failures} failures`);

  // Connection should still be stable
  const normalResponse = await extension.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Normal commands should still work');
  console.log('  Connection stable despite flaky commands');

  console.log('PASSED: Graceful Degradation');
  return true;
}

/**
 * Test Suite: Command Retry Logic
 */
async function testCommandRetryLogic() {
  console.log('\n--- Test: Command Retry Logic ---');

  // Reset retry state
  await extension.sendCommand('reset_retry', {});

  // Helper function to retry commands
  async function retryCommand(command, params, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await extension.sendCommand(command, params);
      if (response.success) {
        return response;
      }
      lastError = response.error;
      await testUtils.delay(50);  // Brief delay between retries
    }
    return { success: false, error: lastError };
  }

  // Command that succeeds on 3rd attempt
  const retryResponse = await retryCommand('retry_command', {
    key: 'test1',
    failUntil: 3
  });

  assert(retryResponse.success, 'Should eventually succeed');
  assert(retryResponse.result.successOnAttempt === 3, 'Should succeed on 3rd attempt');
  console.log('  Retry logic works correctly');

  // Reset and try command that never succeeds within retries
  await extension.sendCommand('reset_retry', {});

  const failResponse = await retryCommand('retry_command', {
    key: 'test2',
    failUntil: 10  // Will never succeed in 3 retries
  }, 3);

  assert(!failResponse.success, 'Should fail if all retries exhausted');
  console.log('  Retry exhaustion handled');

  console.log('PASSED: Command Retry Logic');
  return true;
}

/**
 * Test Suite: Multiple Clients Error Isolation
 */
async function testMultipleClientsErrorIsolation() {
  console.log('\n--- Test: Multiple Clients Error Isolation ---');

  // Create additional client
  const ext2 = testUtils.createExtension({ autoReconnect: false });
  await ext2.connect();

  // First client causes error
  const errorResponse = await extension.sendCommand('throw_error', { message: 'Client 1 error' });
  assert(!errorResponse.success, 'First client error should fail');
  console.log('  First client triggered error');

  // Second client should still work
  const normalResponse = await ext2.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Second client should work');
  console.log('  Second client unaffected');

  // First client should also still work
  const firstNormalResponse = await extension.sendCommand('normal_command', {});
  assert(firstNormalResponse.success, 'First client should work after error');
  console.log('  First client recovered');

  ext2.disconnect();

  console.log('PASSED: Multiple Clients Error Isolation');
  return true;
}

/**
 * Test Suite: Malformed Message Handling
 */
async function testMalformedMessageHandling() {
  console.log('\n--- Test: Malformed Message Handling ---');

  // Send malformed JSON (if possible through the mock)
  // Note: In real scenarios, the WebSocket library handles this
  // We can test by sending a message without expected fields

  // Missing command field
  extension.send({ data: 'no command field' });
  await testUtils.delay(100);

  // Connection should still be alive
  assert(extension.isConnected, 'Connection should survive malformed message');

  // Normal commands should still work
  const normalResponse = await extension.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Normal command should work after malformed message');
  console.log('  Malformed message handled gracefully');

  console.log('PASSED: Malformed Message Handling');
  return true;
}

/**
 * Test Suite: Server Restart Recovery
 */
async function testServerRestartRecovery() {
  console.log('\n--- Test: Server Restart Recovery ---');

  const recoveryExt = testUtils.createExtension({
    autoReconnect: true,
    reconnectDelay: 100,
    maxReconnectAttempts: 10
  });

  await recoveryExt.connect();
  assert(recoveryExt.isConnected, 'Should be connected initially');

  // Verify commands work
  let response = await recoveryExt.sendCommand('normal_command', {});
  assert(response.success, 'Command should work initially');
  console.log('  Initial connection verified');

  // Track reconnection
  let reconnected = false;
  recoveryExt.once('connected', () => {
    reconnected = true;
  });

  // Stop server
  await server.stop();
  console.log('  Server stopped');

  // Wait a bit
  await testUtils.delay(200);

  // Restart server
  server = new TestServer({ port: TEST_PORT });
  setupServerHandlers();
  await server.start();
  console.log('  Server restarted');

  // Wait for reconnection
  await testUtils.delay(500);

  assert(reconnected, 'Should have reconnected');
  assert(recoveryExt.isConnected, 'Should be connected after restart');
  console.log('  Reconnected to restarted server');

  // Commands should work again
  response = await recoveryExt.sendCommand('normal_command', {});
  assert(response.success, 'Commands should work after server restart');
  console.log('  Commands work after restart');

  recoveryExt.disconnect();

  console.log('PASSED: Server Restart Recovery');
  return true;
}

/**
 * Test Suite: Error Recovery State Preservation
 */
async function testErrorRecoveryStatePreservation() {
  console.log('\n--- Test: Error Recovery State Preservation ---');

  // Set up some state on extension
  extension.simulateNavigation('https://example.com/state-test', 'State Test Page');
  extension.simulateCookie({ name: 'state_cookie', value: 'preserved', domain: '.example.com' });

  const initialState = extension.getState();
  console.log('  Initial state set');

  // Trigger multiple errors
  for (let i = 0; i < 5; i++) {
    await extension.sendCommand('throw_error', { message: `Error ${i}` });
  }
  console.log('  Multiple errors triggered');

  // State should be preserved
  const afterErrorState = extension.getState();

  assert(afterErrorState.currentUrl === initialState.currentUrl, 'URL should be preserved');
  assert(afterErrorState.cookies.length === initialState.cookies.length, 'Cookies should be preserved');
  console.log('  State preserved after errors');

  // Connection still works
  const normalResponse = await extension.sendCommand('normal_command', {});
  assert(normalResponse.success, 'Commands should still work');
  console.log('  Functionality preserved');

  console.log('PASSED: Error Recovery State Preservation');
  return true;
}

/**
 * Run all error handling tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Error Handling and Reconnection Integration Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Handler Error Propagation', fn: testHandlerErrorPropagation },
    { name: 'Unknown Command Error', fn: testUnknownCommandError },
    { name: 'Validation Error', fn: testValidationError },
    { name: 'Command Timeout Handling', fn: testCommandTimeoutHandling },
    { name: 'Error Response Handling', fn: testErrorResponseHandling },
    { name: 'Reconnection After Disconnect', fn: testReconnectionAfterDisconnect },
    { name: 'Reconnection Limit', fn: testReconnectionLimit },
    { name: 'Graceful Degradation', fn: testGracefulDegradation },
    { name: 'Command Retry Logic', fn: testCommandRetryLogic },
    { name: 'Multiple Clients Error Isolation', fn: testMultipleClientsErrorIsolation },
    { name: 'Malformed Message Handling', fn: testMalformedMessageHandling },
    { name: 'Server Restart Recovery', fn: testServerRestartRecovery },
    { name: 'Error Recovery State Preservation', fn: testErrorRecoveryStatePreservation }
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
  console.log('Error Handling Test Summary');
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

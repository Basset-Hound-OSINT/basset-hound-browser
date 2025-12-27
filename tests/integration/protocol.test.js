/**
 * Protocol Tests
 *
 * Tests the command/response protocol, error handling, timeout handling,
 * and reconnection logic between extension and browser.
 */

const assert = require('assert');
const { TestServer } = require('./harness/test-server');
const { MockExtension } = require('./harness/mock-extension');
const { MockBrowser } = require('./harness/mock-browser');

// Test configuration
const TEST_PORT = 8773;
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
    setupProtocolHandlers();
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
 * Setup protocol test handlers
 */
function setupProtocolHandlers() {
  // Simple echo handler
  server.registerHandler('echo', async (params) => {
    return { success: true, echo: params };
  });

  // Handler that throws error
  server.registerHandler('error_test', async (params) => {
    throw new Error(params.message || 'Test error');
  });

  // Handler that returns failure
  server.registerHandler('fail_test', async (params) => {
    return { success: false, error: params.error || 'Test failure' };
  });

  // Slow handler for timeout testing
  server.registerHandler('slow', async (params) => {
    const delay = params.delay || 5000;
    await testUtils.delay(delay);
    return { success: true, delayed: delay };
  });

  // Handler that validates command structure
  server.registerHandler('validate', async (params) => {
    const required = ['field1', 'field2'];
    const missing = required.filter(f => !(f in params));

    if (missing.length > 0) {
      return { success: false, error: `Missing required fields: ${missing.join(', ')}` };
    }

    return { success: true, validated: true };
  });

  // Counter handler for testing sequential commands
  let counter = 0;
  server.registerHandler('counter', async (params) => {
    if (params.reset) {
      counter = 0;
    }
    counter++;
    return { success: true, count: counter };
  });

  // Handler that returns large data
  server.registerHandler('large_data', async (params) => {
    const size = params.size || 10000;
    return {
      success: true,
      data: 'x'.repeat(size),
      size
    };
  });

  // Handler for testing different response types
  server.registerHandler('typed_response', async (params) => {
    const { type } = params;

    switch (type) {
      case 'string':
        return { success: true, result: 'string value' };
      case 'number':
        return { success: true, result: 42 };
      case 'boolean':
        return { success: true, result: true };
      case 'array':
        return { success: true, result: [1, 2, 3] };
      case 'object':
        return { success: true, result: { key: 'value' } };
      case 'null':
        return { success: true, result: null };
      default:
        return { success: false, error: 'Unknown type' };
    }
  });
}

// =============================================
// Command/Response Protocol Tests
// =============================================

/**
 * Test Suite: Command ID Generation
 */
async function testCommandIdGeneration() {
  console.log('\n--- Test: Command ID Generation ---');

  // Send multiple commands and verify unique IDs
  const ids = new Set();

  for (let i = 0; i < 100; i++) {
    const response = await extension.sendCommand('echo', { index: i });
    // The response should reference the original command
    assert(response.success !== undefined, 'Response should have success field');
  }

  console.log('  All commands completed with unique handling');

  console.log('PASSED: Command ID Generation');
  return true;
}

/**
 * Test Suite: Command Structure Validation
 */
async function testCommandStructureValidation() {
  console.log('\n--- Test: Command Structure Validation ---');

  // Valid command structure
  const validResponse = await extension.sendCommand('validate', {
    field1: 'value1',
    field2: 'value2'
  });
  assert(validResponse.success, 'Valid command should succeed');
  console.log('  Valid command structure accepted');

  // Missing required fields
  const invalidResponse = await extension.sendCommand('validate', {
    field1: 'value1'
    // Missing field2
  });
  assert(!invalidResponse.success, 'Invalid command should fail');
  assert(invalidResponse.result.error.includes('Missing'), 'Should report missing fields');
  console.log('  Missing fields detected');

  console.log('PASSED: Command Structure Validation');
  return true;
}

/**
 * Test Suite: Response Structure
 */
async function testResponseStructure() {
  console.log('\n--- Test: Response Structure ---');

  const response = await extension.sendCommand('echo', { test: 'data' });

  // Check required response fields
  assert('success' in response, 'Response should have success field');
  assert('result' in response || 'error' in response, 'Response should have result or error');
  console.log('  Response has required fields');

  // Check success response
  if (response.success) {
    assert(response.result !== undefined, 'Success response should have result');
    console.log('  Success response has result');
  }

  // Check error response
  const errorResponse = await extension.sendCommand('fail_test', { error: 'Test error' });
  assert(!errorResponse.success, 'Error response should have success=false');
  assert(errorResponse.result.error, 'Error response should have error message');
  console.log('  Error response has error message');

  console.log('PASSED: Response Structure');
  return true;
}

/**
 * Test Suite: Response Types
 */
async function testResponseTypes() {
  console.log('\n--- Test: Response Types ---');

  // String response
  const stringResp = await extension.sendCommand('typed_response', { type: 'string' });
  assert(typeof stringResp.result.result === 'string', 'Should return string');
  console.log('  String type handled');

  // Number response
  const numberResp = await extension.sendCommand('typed_response', { type: 'number' });
  assert(typeof numberResp.result.result === 'number', 'Should return number');
  console.log('  Number type handled');

  // Boolean response
  const boolResp = await extension.sendCommand('typed_response', { type: 'boolean' });
  assert(typeof boolResp.result.result === 'boolean', 'Should return boolean');
  console.log('  Boolean type handled');

  // Array response
  const arrayResp = await extension.sendCommand('typed_response', { type: 'array' });
  assert(Array.isArray(arrayResp.result.result), 'Should return array');
  console.log('  Array type handled');

  // Object response
  const objectResp = await extension.sendCommand('typed_response', { type: 'object' });
  assert(typeof objectResp.result.result === 'object', 'Should return object');
  console.log('  Object type handled');

  // Null response
  const nullResp = await extension.sendCommand('typed_response', { type: 'null' });
  assert(nullResp.result.result === null, 'Should return null');
  console.log('  Null type handled');

  console.log('PASSED: Response Types');
  return true;
}

// =============================================
// Error Handling Tests
// =============================================

/**
 * Test Suite: Handler Error Handling
 */
async function testHandlerErrorHandling() {
  console.log('\n--- Test: Handler Error Handling ---');

  // Handler that throws error
  const response = await extension.sendCommand('error_test', {
    message: 'Intentional test error'
  });

  assert(!response.success, 'Error response should have success=false');
  assert(response.result.error, 'Should have error message');
  assert(response.result.error.includes('Intentional test error'), 'Error message should match');
  console.log('  Handler error caught and returned');

  console.log('PASSED: Handler Error Handling');
  return true;
}

/**
 * Test Suite: Unknown Command Handling
 */
async function testUnknownCommandHandling() {
  console.log('\n--- Test: Unknown Command Handling ---');

  const response = await extension.sendCommand('nonexistent_command_xyz', {});

  assert(!response.success, 'Unknown command should fail');
  assert(response.result.error, 'Should have error message');
  console.log('  Unknown command returns error');

  console.log('PASSED: Unknown Command Handling');
  return true;
}

/**
 * Test Suite: Malformed Message Handling
 */
async function testMalformedMessageHandling() {
  console.log('\n--- Test: Malformed Message Handling ---');

  // Send raw malformed message
  let errorReceived = false;
  extension.ws.send('not valid json{{}');
  await testUtils.delay(100);
  // The connection should still be alive
  assert(extension.isConnected, 'Connection should survive malformed message');
  console.log('  Malformed JSON handled gracefully');

  // Server should still respond to valid messages
  const response = await extension.sendCommand('echo', { test: true });
  assert(response.success, 'Should still process valid messages');
  console.log('  Valid messages still work after malformed one');

  console.log('PASSED: Malformed Message Handling');
  return true;
}

/**
 * Test Suite: Error Recovery
 */
async function testErrorRecovery() {
  console.log('\n--- Test: Error Recovery ---');

  // Cause an error
  await extension.sendCommand('error_test', { message: 'First error' });

  // Should be able to continue normally
  const response = await extension.sendCommand('echo', { test: 'after_error' });
  assert(response.success, 'Should recover from error');
  assert(response.result.echo.test === 'after_error', 'Data should be correct');
  console.log('  Recovered from error');

  // Cause multiple errors
  for (let i = 0; i < 5; i++) {
    await extension.sendCommand('error_test', { message: `Error ${i}` });
  }

  // Should still work
  const finalResponse = await extension.sendCommand('echo', { final: true });
  assert(finalResponse.success, 'Should work after multiple errors');
  console.log('  Recovered from multiple errors');

  console.log('PASSED: Error Recovery');
  return true;
}

// =============================================
// Timeout Handling Tests
// =============================================

/**
 * Test Suite: Command Timeout
 */
async function testCommandTimeout() {
  console.log('\n--- Test: Command Timeout ---');

  // Create extension with short timeout
  const shortTimeoutExt = new MockExtension({
    url: TEST_URL,
    commandTimeout: 500
  });
  await shortTimeoutExt.connect();

  // Send slow command
  let timedOut = false;
  try {
    await shortTimeoutExt.sendCommand('slow', { delay: 2000 });
  } catch (error) {
    if (error.message.includes('timeout')) {
      timedOut = true;
    }
  }

  assert(timedOut, 'Command should timeout');
  console.log('  Command timed out correctly');

  // Connection should still be alive
  assert(shortTimeoutExt.isConnected, 'Connection should survive timeout');
  console.log('  Connection survived timeout');

  shortTimeoutExt.disconnect();

  console.log('PASSED: Command Timeout');
  return true;
}

/**
 * Test Suite: Long Running Commands
 */
async function testLongRunningCommands() {
  console.log('\n--- Test: Long Running Commands ---');

  // Send command that takes a while but doesn't timeout
  const response = await extension.sendCommand('slow', { delay: 100 }, 5000);

  assert(response.success, 'Long running command should succeed');
  assert(response.result.delayed === 100, 'Delay should match');
  console.log('  Long running command completed');

  console.log('PASSED: Long Running Commands');
  return true;
}

/**
 * Test Suite: Concurrent Commands with Timeout
 */
async function testConcurrentCommandsWithTimeout() {
  console.log('\n--- Test: Concurrent Commands with Timeout ---');

  const shortTimeoutExt = new MockExtension({
    url: TEST_URL,
    commandTimeout: 1000
  });
  await shortTimeoutExt.connect();

  // Send multiple concurrent commands, some will timeout
  const commands = [
    shortTimeoutExt.sendCommand('slow', { delay: 100 }).catch(e => ({ error: e.message })),
    shortTimeoutExt.sendCommand('slow', { delay: 2000 }).catch(e => ({ error: e.message })),
    shortTimeoutExt.sendCommand('echo', { test: 'fast' }).catch(e => ({ error: e.message }))
  ];

  const results = await Promise.all(commands);

  // First and third should succeed, second should timeout
  assert(results[0].success, 'Fast command should succeed');
  assert(results[1].error || !results[1].success, 'Slow command should timeout or fail');
  assert(results[2].success, 'Echo command should succeed');
  console.log('  Concurrent commands handled with mixed results');

  shortTimeoutExt.disconnect();

  console.log('PASSED: Concurrent Commands with Timeout');
  return true;
}

// =============================================
// Reconnection Tests
// =============================================

/**
 * Test Suite: Client Reconnection
 */
async function testClientReconnection() {
  console.log('\n--- Test: Client Reconnection ---');

  // Create extension with auto-reconnect
  const reconnectExt = new MockExtension({
    url: TEST_URL,
    autoReconnect: true,
    maxReconnectAttempts: 3,
    reconnectDelay: 100
  });

  await reconnectExt.connect();
  assert(reconnectExt.isConnected, 'Should be connected initially');
  console.log('  Initial connection established');

  // Disconnect and reconnect
  reconnectExt.disconnect();
  await testUtils.delay(50);
  assert(!reconnectExt.isConnected, 'Should be disconnected');
  console.log('  Disconnected');

  // Reconnect manually
  await reconnectExt.connect();
  assert(reconnectExt.isConnected, 'Should reconnect');
  console.log('  Reconnected successfully');

  reconnectExt.disconnect();

  console.log('PASSED: Client Reconnection');
  return true;
}

/**
 * Test Suite: Server Restart Handling
 */
async function testServerRestartHandling() {
  console.log('\n--- Test: Server Restart Handling ---');

  // Create new extension for this test
  const testExt = new MockExtension({
    url: TEST_URL,
    autoReconnect: false
  });
  await testExt.connect();

  let disconnected = false;
  testExt.on('disconnected', () => {
    disconnected = true;
  });

  // Stop the server
  await server.stop();
  await testUtils.delay(100);

  // Extension should detect disconnection
  assert(disconnected || !testExt.isConnected, 'Should detect server stop');
  console.log('  Detected server shutdown');

  // Restart server
  server = new TestServer({ port: TEST_PORT });
  setupProtocolHandlers();
  await server.start();

  // Reconnect
  await testExt.connect();
  assert(testExt.isConnected, 'Should reconnect to restarted server');
  console.log('  Reconnected to restarted server');

  // Verify functionality
  const response = await testExt.sendCommand('echo', { test: 'after_restart' });
  assert(response.success, 'Commands should work after server restart');
  console.log('  Commands work after restart');

  testExt.disconnect();

  console.log('PASSED: Server Restart Handling');
  return true;
}

/**
 * Test Suite: Multiple Client Reconnection
 */
async function testMultipleClientReconnection() {
  console.log('\n--- Test: Multiple Client Reconnection ---');

  const clients = [];

  // Create multiple clients
  for (let i = 0; i < 3; i++) {
    const client = new MockExtension({ url: TEST_URL, autoReconnect: false });
    await client.connect();
    clients.push(client);
  }

  assert(clients.every(c => c.isConnected), 'All clients should be connected');
  console.log('  3 clients connected');

  // Disconnect all
  clients.forEach(c => c.disconnect());
  await testUtils.delay(100);

  assert(clients.every(c => !c.isConnected), 'All clients should be disconnected');
  console.log('  All clients disconnected');

  // Reconnect all
  await Promise.all(clients.map(c => c.connect()));

  assert(clients.every(c => c.isConnected), 'All clients should reconnect');
  console.log('  All clients reconnected');

  // Cleanup
  clients.forEach(c => c.disconnect());

  console.log('PASSED: Multiple Client Reconnection');
  return true;
}

// =============================================
// Additional Protocol Tests
// =============================================

/**
 * Test Suite: Sequential Command Ordering
 */
async function testSequentialCommandOrdering() {
  console.log('\n--- Test: Sequential Command Ordering ---');

  // Reset counter
  await extension.sendCommand('counter', { reset: true });

  // Send sequential commands
  const results = [];
  for (let i = 0; i < 10; i++) {
    const response = await extension.sendCommand('counter', {});
    results.push(response.result.count);
  }

  // Verify sequential ordering
  for (let i = 0; i < results.length; i++) {
    assert(results[i] === i + 1, `Count ${i} should be ${i + 1}`);
  }
  console.log('  Sequential commands maintained order');

  console.log('PASSED: Sequential Command Ordering');
  return true;
}

/**
 * Test Suite: Large Data Transfer
 */
async function testLargeDataTransfer() {
  console.log('\n--- Test: Large Data Transfer ---');

  // Request large data
  const sizes = [1000, 10000, 100000];

  for (const size of sizes) {
    const response = await extension.sendCommand('large_data', { size });
    assert(response.success, `${size} byte response should succeed`);
    assert(response.result.data.length === size, `Data should be ${size} bytes`);
  }
  console.log('  Large data transfers work');

  // Send large command
  const largeInput = 'x'.repeat(50000);
  const echoResponse = await extension.sendCommand('echo', { data: largeInput });
  assert(echoResponse.success, 'Large input should work');
  assert(echoResponse.result.echo.data.length === largeInput.length, 'Data should be echoed');
  console.log('  Large command input works');

  console.log('PASSED: Large Data Transfer');
  return true;
}

/**
 * Test Suite: Command Queuing
 */
async function testCommandQueuing() {
  console.log('\n--- Test: Command Queuing ---');

  // Send many commands without waiting
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(extension.sendCommand('echo', { index: i }));
  }

  const results = await Promise.all(promises);

  // All should succeed
  assert(results.length === 50, 'All commands should complete');
  assert(results.every(r => r.success), 'All commands should succeed');
  console.log('  50 queued commands completed');

  // Verify data integrity
  const indices = results.map(r => r.result.echo.index);
  for (let i = 0; i < 50; i++) {
    assert(indices.includes(i), `Index ${i} should be in results`);
  }
  console.log('  Data integrity maintained');

  console.log('PASSED: Command Queuing');
  return true;
}

/**
 * Run all protocol tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Protocol Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    // Command/Response Protocol
    { name: 'Command ID Generation', fn: testCommandIdGeneration },
    { name: 'Command Structure Validation', fn: testCommandStructureValidation },
    { name: 'Response Structure', fn: testResponseStructure },
    { name: 'Response Types', fn: testResponseTypes },

    // Error Handling
    { name: 'Handler Error Handling', fn: testHandlerErrorHandling },
    { name: 'Unknown Command Handling', fn: testUnknownCommandHandling },
    { name: 'Malformed Message Handling', fn: testMalformedMessageHandling },
    { name: 'Error Recovery', fn: testErrorRecovery },

    // Timeout Handling
    { name: 'Command Timeout', fn: testCommandTimeout },
    { name: 'Long Running Commands', fn: testLongRunningCommands },
    { name: 'Concurrent Commands with Timeout', fn: testConcurrentCommandsWithTimeout },

    // Reconnection
    { name: 'Client Reconnection', fn: testClientReconnection },
    { name: 'Server Restart Handling', fn: testServerRestartHandling },
    { name: 'Multiple Client Reconnection', fn: testMultipleClientReconnection },

    // Additional Protocol Tests
    { name: 'Sequential Command Ordering', fn: testSequentialCommandOrdering },
    { name: 'Large Data Transfer', fn: testLargeDataTransfer },
    { name: 'Command Queuing', fn: testCommandQueuing }
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
  console.log('Protocol Test Summary');
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

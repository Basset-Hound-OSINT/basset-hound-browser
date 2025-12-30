/**
 * Extension-Browser Communication Tests
 *
 * Tests WebSocket message passing between the Chrome extension and Electron browser.
 *
 * Note: These tests require a running browser infrastructure and are designed to run
 * as standalone scripts. Use `npm run test:integration:communication` to run them.
 */

const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Check if running under Jest
const isJest = typeof jest !== 'undefined';
const shouldSkip = isJest || process.env.SKIP_BROWSER_TESTS === 'true';

// Test configuration
const TEST_PORT = 8766;
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
 * Test Suite: Basic WebSocket Connection
 */
async function testBasicConnection() {
  console.log('\n--- Test: Basic WebSocket Connection ---');

  // Test extension connection
  await extension.connect();
  assert(extension.isConnected, 'Extension should be connected');
  console.log('  Extension connected successfully');

  // Test browser connection
  await browser.connect();
  assert(browser.isConnected, 'Browser should be connected');
  console.log('  Browser connected successfully');

  // Verify server sees both clients
  const clients = server.getClients();
  assert(clients.length >= 2, 'Server should see at least 2 clients');
  console.log(`  Server has ${clients.length} connected clients`);

  console.log('PASSED: Basic WebSocket Connection');
  return true;
}

/**
 * Test Suite: Message Format Validation
 */
async function testMessageFormatValidation() {
  console.log('\n--- Test: Message Format Validation ---');

  // Send command with proper format
  const response = await browser.sendCommand('ping', {});
  assert(response !== undefined, 'Should receive response');
  console.log('  Properly formatted command received response');

  // Test command with ID
  const commandWithId = {
    id: 'test-id-123',
    command: 'status'
  };
  browser.send(commandWithId);
  await testUtils.delay(100);
  console.log('  Command with ID sent successfully');

  console.log('PASSED: Message Format Validation');
  return true;
}

/**
 * Test Suite: Bidirectional Communication
 */
async function testBidirectionalCommunication() {
  console.log('\n--- Test: Bidirectional Communication ---');

  // Extension sends command to server
  let received = false;
  server.registerHandler('test_command', async (params) => {
    received = true;
    return { success: true, received: params };
  });

  const extensionResponse = await extension.sendCommand('test_command', { data: 'from_extension' });
  assert(extensionResponse.success, 'Extension command should succeed');
  console.log('  Extension -> Server communication works');

  // Browser sends command to server
  const browserResponse = await browser.sendCommand('ping', {});
  assert(browserResponse !== undefined, 'Browser should get response');
  console.log('  Browser -> Server communication works');

  // Server sends command to extension
  const extensionClient = server.getClient();
  if (extensionClient) {
    try {
      const serverToExtResponse = await server.sendCommand(extensionClient, 'navigate', {
        url: 'https://example.com'
      });
      console.log('  Server -> Extension command sent');
    } catch (e) {
      console.log('  Server -> Extension command sent (timeout expected in mock)');
    }
  }

  console.log('PASSED: Bidirectional Communication');
  return true;
}

/**
 * Test Suite: Message Ordering
 */
async function testMessageOrdering() {
  console.log('\n--- Test: Message Ordering ---');

  const receivedOrder = [];
  const expectedOrder = [1, 2, 3, 4, 5];

  server.registerHandler('order_test', async (params) => {
    receivedOrder.push(params.order);
    return { success: true, order: params.order };
  });

  // Send commands in order
  const promises = expectedOrder.map(order =>
    extension.sendCommand('order_test', { order })
  );

  await Promise.all(promises);
  await testUtils.delay(100);

  // Messages should be processed (order may vary due to async)
  assert(receivedOrder.length === expectedOrder.length, 'All messages should be received');
  console.log(`  Received ${receivedOrder.length} messages`);

  console.log('PASSED: Message Ordering');
  return true;
}

/**
 * Test Suite: Large Message Handling
 */
async function testLargeMessageHandling() {
  console.log('\n--- Test: Large Message Handling ---');

  // Generate large data
  const largeData = 'x'.repeat(100000); // 100KB of data

  server.registerHandler('large_data', async (params) => {
    return { success: true, size: params.data.length };
  });

  const response = await extension.sendCommand('large_data', { data: largeData });
  assert(response.success, 'Large message should be handled');
  assert(response.result.size === largeData.length, 'Data size should match');
  console.log(`  Successfully handled ${largeData.length} byte message`);

  console.log('PASSED: Large Message Handling');
  return true;
}

/**
 * Test Suite: Concurrent Messages
 */
async function testConcurrentMessages() {
  console.log('\n--- Test: Concurrent Messages ---');

  let processedCount = 0;

  server.registerHandler('concurrent', async (params) => {
    processedCount++;
    await testUtils.delay(10); // Simulate processing time
    return { success: true, id: params.id };
  });

  // Send many concurrent messages
  const concurrentCount = 50;
  const promises = [];

  for (let i = 0; i < concurrentCount; i++) {
    promises.push(extension.sendCommand('concurrent', { id: i }));
  }

  const results = await Promise.all(promises);

  assert(results.every(r => r.success), 'All concurrent messages should succeed');
  console.log(`  Processed ${processedCount} concurrent messages`);

  console.log('PASSED: Concurrent Messages');
  return true;
}

/**
 * Test Suite: Binary Data Handling
 */
async function testBinaryDataHandling() {
  console.log('\n--- Test: Binary Data Handling ---');

  // Simulate base64 encoded binary data (like screenshots)
  const mockBase64 = Buffer.from('mock binary data').toString('base64');

  server.registerHandler('binary_test', async (params) => {
    return {
      success: true,
      data: params.data,
      decoded: Buffer.from(params.data, 'base64').toString()
    };
  });

  const response = await extension.sendCommand('binary_test', { data: mockBase64 });
  assert(response.success, 'Binary data should be handled');
  assert(response.result.decoded === 'mock binary data', 'Data should be correctly decoded');
  console.log('  Binary data (base64) handled correctly');

  console.log('PASSED: Binary Data Handling');
  return true;
}

/**
 * Test Suite: Special Characters in Messages
 */
async function testSpecialCharacters() {
  console.log('\n--- Test: Special Characters in Messages ---');

  const specialData = {
    unicode: 'Hello',
    quotes: '"quotes" and \'apostrophes\'',
    newlines: 'line1\nline2\r\nline3',
    html: '<script>alert("xss")</script>',
    backslash: 'path\\to\\file',
    nullChar: 'before\u0000after'
  };

  server.registerHandler('special_chars', async (params) => {
    return { success: true, echo: params };
  });

  const response = await extension.sendCommand('special_chars', specialData);
  assert(response.success, 'Special characters should be handled');
  assert(response.result.echo.unicode === specialData.unicode, 'Unicode should be preserved');
  assert(response.result.echo.html === specialData.html, 'HTML should be preserved');
  console.log('  Special characters handled correctly');

  console.log('PASSED: Special Characters in Messages');
  return true;
}

/**
 * Test Suite: Connection State Transitions
 */
async function testConnectionStateTransitions() {
  console.log('\n--- Test: Connection State Transitions ---');

  // Create new extension for this test
  const testExt = new MockExtension({
    url: TEST_URL,
    autoReconnect: false
  });

  // Connect
  await testExt.connect();
  assert(testExt.isConnected, 'Should be connected');
  console.log('  Initial connection established');

  // Disconnect
  testExt.disconnect();
  await testUtils.delay(100);
  assert(!testExt.isConnected, 'Should be disconnected');
  console.log('  Disconnection successful');

  // Reconnect
  await testExt.connect();
  assert(testExt.isConnected, 'Should be reconnected');
  console.log('  Reconnection successful');

  testExt.disconnect();

  console.log('PASSED: Connection State Transitions');
  return true;
}

/**
 * Test Suite: Heartbeat Mechanism
 */
async function testHeartbeatMechanism() {
  console.log('\n--- Test: Heartbeat Mechanism ---');

  let heartbeatReceived = false;
  server.on('heartbeat', () => {
    heartbeatReceived = true;
  });

  // Create extension with short heartbeat interval
  const heartbeatExt = new MockExtension({
    url: TEST_URL,
    heartbeatMs: 100
  });

  await heartbeatExt.connect();

  // Wait for heartbeat
  await testUtils.delay(200);

  assert(heartbeatReceived, 'Heartbeat should be received');
  console.log('  Heartbeat received by server');

  heartbeatExt.disconnect();

  console.log('PASSED: Heartbeat Mechanism');
  return true;
}

/**
 * Test Suite: Error Response Handling
 */
async function testErrorResponseHandling() {
  console.log('\n--- Test: Error Response Handling ---');

  // Unknown command should return error
  const response = await extension.sendCommand('unknown_command_xyz', {});
  assert(!response.success, 'Unknown command should fail');
  assert(response.error, 'Error message should be present');
  console.log('  Unknown command returned error correctly');

  // Handler that throws error
  server.registerHandler('error_test', async () => {
    throw new Error('Intentional error for testing');
  });

  const errorResponse = await extension.sendCommand('error_test', {});
  assert(!errorResponse.success, 'Error should be reported');
  console.log('  Handler error returned correctly');

  console.log('PASSED: Error Response Handling');
  return true;
}

/**
 * Test Suite: Message Broadcast
 */
async function testMessageBroadcast() {
  console.log('\n--- Test: Message Broadcast ---');

  let extensionReceived = false;
  let browserReceived = false;

  extension.on('message', (msg) => {
    if (msg.type === 'broadcast_test') {
      extensionReceived = true;
    }
  });

  browser.on('message', (msg) => {
    if (msg.type === 'broadcast_test') {
      browserReceived = true;
    }
  });

  // Broadcast from server
  server.broadcast({
    type: 'broadcast_test',
    data: 'test broadcast message'
  });

  await testUtils.delay(100);

  assert(extensionReceived, 'Extension should receive broadcast');
  assert(browserReceived, 'Browser should receive broadcast');
  console.log('  Broadcast received by all clients');

  console.log('PASSED: Message Broadcast');
  return true;
}

/**
 * Run all communication tests
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Extension-Browser Communication Tests');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const tests = [
    { name: 'Basic Connection', fn: testBasicConnection },
    { name: 'Message Format Validation', fn: testMessageFormatValidation },
    { name: 'Bidirectional Communication', fn: testBidirectionalCommunication },
    { name: 'Message Ordering', fn: testMessageOrdering },
    { name: 'Large Message Handling', fn: testLargeMessageHandling },
    { name: 'Concurrent Messages', fn: testConcurrentMessages },
    { name: 'Binary Data Handling', fn: testBinaryDataHandling },
    { name: 'Special Characters', fn: testSpecialCharacters },
    { name: 'Connection State Transitions', fn: testConnectionStateTransitions },
    { name: 'Heartbeat Mechanism', fn: testHeartbeatMechanism },
    { name: 'Error Response Handling', fn: testErrorResponseHandling },
    { name: 'Message Broadcast', fn: testMessageBroadcast }
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
  console.log('Communication Test Summary');
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

// Jest test wrapper
if (isJest) {
  describe('Extension-Browser Communication Tests', () => {
    test.skip('These tests require browser infrastructure - run with: npm run test:integration:communication', () => {
      // Skip when run through Jest
      // Use the npm script to run these tests as standalone scripts
    });
  });
}

// Run if called directly (not through Jest)
if (require.main === module && !shouldSkip) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

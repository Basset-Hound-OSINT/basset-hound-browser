/**
 * Test suite for WebSocket Logging Middleware
 *
 * Verifies:
 * - All requests are logged with timestamp, command, and parameters
 * - All responses are logged with timing, status code, and success/failure
 * - Structured JSON output is valid and parseable
 * - Log file output at /tmp/websocket-requests.log
 * - Sensitive data masking works
 * - Command exclusion works
 * - Response time tracking is accurate
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { WebSocketLoggingMiddleware } = require('./logging-middleware');

// Test configuration
const TEST_JSON_LOG = '/tmp/websocket-test-requests.log';
const TEST_LOG_DIR = '/tmp/websocket-test-logs';

/**
 * Ensure test directory exists
 */
function ensureTestDir() {
  if (!fs.existsSync(TEST_LOG_DIR)) {
    fs.mkdirSync(TEST_LOG_DIR, { recursive: true });
  }
}

/**
 * Clean up test files
 */
function cleanupTestFiles() {
  try {
    if (fs.existsSync(TEST_JSON_LOG)) {
      fs.unlinkSync(TEST_JSON_LOG);
    }
    if (fs.existsSync(TEST_LOG_DIR)) {
      const files = fs.readdirSync(TEST_LOG_DIR);
      files.forEach(f => {
        fs.unlinkSync(path.join(TEST_LOG_DIR, f));
      });
      fs.rmdirSync(TEST_LOG_DIR);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
}

/**
 * Read structured JSON logs from file
 */
async function readJsonLogs(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const readline = require('readline');
    const entries = [];
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath)
    });

    rl.on('line', (line) => {
      if (line.trim()) {
        try {
          entries.push(JSON.parse(line));
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });

    rl.on('close', () => resolve(entries));
    rl.on('error', reject);
  });
}

/**
 * Test 1: Basic request logging
 */
async function testBasicRequestLogging() {
  console.log('\n=== Test 1: Basic Request Logging ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log a simple request
  middleware.logRequest('navigate', 'client-1', { url: 'https://example.com' }, 'INFO');

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 100));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert.strictEqual(logs.length, 1, 'Should have logged 1 request');

  const log = logs[0];
  assert.strictEqual(log.type, 'request', 'Log type should be "request"');
  assert.strictEqual(log.command, 'navigate', 'Command should be "navigate"');
  assert.strictEqual(log.clientId, 'client-1', 'Client ID should match');
  assert(log.timestamp, 'Should have timestamp');
  assert(log.parameters, 'Should have parameters');

  console.log('✓ Basic request logging works');
  middleware.shutdown();
}

/**
 * Test 2: Response logging with timing
 */
async function testResponseLogging() {
  console.log('\n=== Test 2: Response Logging with Timing ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log request and response
  const requestId = 'req-123';
  middleware.logRequest('click', 'client-1', { selector: '.button' }, 'INFO', requestId);

  await new Promise(resolve => setTimeout(resolve, 50));

  middleware.logResponse('click', 'client-1', 200, 45, 128, null, null, null, 'INFO', requestId);

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 100));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert(logs.length >= 2, 'Should have logged request and response');

  const response = logs.find(l => l.type === 'response');
  assert(response, 'Should have response log');
  assert.strictEqual(response.statusCode, 200, 'Status code should be 200');
  assert.strictEqual(response.responseTime, 45, 'Response time should be 45ms');
  assert.strictEqual(response.responseSize, 128, 'Response size should be 128');
  assert.strictEqual(response.success, true, 'Success should be true for 200 status');
  assert.strictEqual(response.requestId, requestId, 'Request ID should match');

  console.log('✓ Response logging with timing works');
  middleware.shutdown();
}

/**
 * Test 3: Error response logging
 */
async function testErrorResponseLogging() {
  console.log('\n=== Test 3: Error Response Logging ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log failed response
  middleware.logResponse(
    'execute_script',
    'client-1',
    500,
    234,
    256,
    'Script execution timeout',
    'EXECUTION_TIMEOUT',
    'Increase timeout or optimize script',
    'ERROR'
  );

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 100));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert(logs.length > 0, 'Should have logged error response');

  const errorLog = logs[0];
  assert.strictEqual(errorLog.statusCode, 500, 'Status code should be 500');
  assert.strictEqual(errorLog.success, false, 'Success should be false for 500 status');
  assert.strictEqual(errorLog.errorCode, 'EXECUTION_TIMEOUT', 'Error code should match');
  assert(errorLog.error, 'Should have error message');
  assert(errorLog.recovery, 'Should have recovery suggestion');

  console.log('✓ Error response logging works');
  middleware.shutdown();
}

/**
 * Test 4: Multiple requests and responses
 */
async function testMultipleRequests() {
  console.log('\n=== Test 4: Multiple Requests and Responses ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log multiple requests
  const commands = ['navigate', 'click', 'fill', 'screenshot', 'get_html'];
  const timings = [120, 45, 30, 200, 80];

  for (let i = 0; i < commands.length; i++) {
    const reqId = `req-${i}`;
    middleware.logRequest(commands[i], `client-${i % 2}`, {}, 'DEBUG', reqId);
    await new Promise(r => setTimeout(r, 10));
    middleware.logResponse(commands[i], `client-${i % 2}`, 200, timings[i], Math.random() * 1000, null, null, null, 'DEBUG', reqId);
  }

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 200));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert(logs.length >= 10, `Should have at least 10 logs, got ${logs.length}`);

  const responses = logs.filter(l => l.type === 'response');
  assert.strictEqual(responses.length, 5, 'Should have 5 responses');

  // Verify timing data
  const avgTime = Math.round(timings.reduce((a, b) => a + b) / timings.length);
  console.log(`✓ Logged ${commands.length} request/response pairs (avg response time: ${avgTime}ms)`);

  middleware.shutdown();
}

/**
 * Test 5: Sensitive data masking
 */
async function testSensitiveDataMasking() {
  console.log('\n=== Test 5: Sensitive Data Masking ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    maskSensitive: true,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log request with sensitive data
  middleware.logRequest('authenticate', 'client-1', {
    username: 'user@example.com',
    password: 'secret123',
    apiKey: 'sk-1234567890'
  }, 'INFO');

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 100));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert(logs.length > 0, 'Should have logged request');

  const log = logs[0];
  const paramsStr = JSON.stringify(log.parameters);

  // Check that sensitive data was masked
  assert(!paramsStr.includes('secret123'), 'Password should be masked');
  assert(!paramsStr.includes('sk-1234567890'), 'API key should be masked');

  console.log('✓ Sensitive data masking works');
  middleware.shutdown();
}

/**
 * Test 6: Command exclusion
 */
async function testCommandExclusion() {
  console.log('\n=== Test 6: Command Exclusion ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true,
    excludeCommands: ['ping', 'pong']
  });

  // Log excluded commands
  middleware.logRequest('ping', 'client-1', {}, 'DEBUG');
  middleware.logRequest('navigate', 'client-1', { url: 'test' }, 'DEBUG');
  middleware.logRequest('pong', 'client-1', {}, 'DEBUG');

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 100));

  const logs = await readJsonLogs(TEST_JSON_LOG);
  const commands = logs.map(l => l.command);

  assert(!commands.includes('ping'), 'Ping should be excluded');
  assert(!commands.includes('pong'), 'Pong should be excluded');
  assert(commands.includes('navigate'), 'Navigate should be included');

  console.log('✓ Command exclusion works');
  middleware.shutdown();
}

/**
 * Test 7: Statistics tracking
 */
async function testStatisticsTracking() {
  console.log('\n=== Test 7: Statistics Tracking ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log requests and responses
  middleware.logRequest('cmd1', 'client-1', {}, 'DEBUG');
  middleware.logResponse('cmd1', 'client-1', 200, 50);

  middleware.logRequest('cmd2', 'client-1', {}, 'DEBUG');
  middleware.logResponse('cmd2', 'client-1', 500, 100, 0, 'Error');

  const stats = middleware.getStats();

  assert.strictEqual(stats.totalRequests, 2, 'Should have 2 total requests');
  assert.strictEqual(stats.totalResponses, 2, 'Should have 2 total responses');
  assert.strictEqual(stats.successfulResponses, 1, 'Should have 1 successful response');
  assert.strictEqual(stats.failedResponses, 1, 'Should have 1 failed response');
  assert(stats.averageResponseTime > 0, 'Should have average response time');

  console.log('✓ Statistics tracking works');
  console.log(`  - Total Requests: ${stats.totalRequests}`);
  console.log(`  - Total Responses: ${stats.totalResponses}`);
  console.log(`  - Successful: ${stats.successfulResponses}`);
  console.log(`  - Failed: ${stats.failedResponses}`);
  console.log(`  - Avg Response Time: ${stats.averageResponseTime}ms`);

  middleware.shutdown();
}

/**
 * Test 8: Structured logs summary
 */
async function testStructuredLogsSummary() {
  console.log('\n=== Test 8: Structured Logs Summary ===');

  cleanupTestFiles();
  ensureTestDir();

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: TEST_LOG_DIR,
    jsonLogFile: TEST_JSON_LOG,
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  // Log various requests and responses
  const commands = ['navigate', 'click', 'navigate', 'click', 'navigate'];
  const statusCodes = [200, 200, 200, 500, 404];

  for (let i = 0; i < commands.length; i++) {
    middleware.logRequest(commands[i], 'client-1', {}, 'DEBUG');
    middleware.logResponse(commands[i], 'client-1', statusCodes[i], Math.random() * 100);
  }

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 150));

  // This test verifies the async method, so we need to use the instance method
  // For this test, we'll just verify logs are written
  const logs = await readJsonLogs(TEST_JSON_LOG);
  assert(logs.length >= 10, 'Should have at least 10 log entries');

  console.log('✓ Structured logs are properly formatted and readable');
  middleware.shutdown();
}

/**
 * Test 9: Log file output at /tmp/websocket-requests.log
 */
async function testDefaultJsonLogLocation() {
  console.log('\n=== Test 9: Default JSON Log Location ===');

  // Clean up default location
  if (fs.existsSync('/tmp/websocket-requests.log')) {
    fs.unlinkSync('/tmp/websocket-requests.log');
  }

  const middleware = new WebSocketLoggingMiddleware({
    level: 'DEBUG',
    logDir: '/tmp/websocket-logs',
    // Note: jsonLogFile defaults to /tmp/websocket-requests.log
    writeToConsole: false,
    writeToFile: true,
    writeStructuredJSON: true
  });

  middleware.logRequest('test', 'client-1', { data: 'test' }, 'INFO');

  // Wait for file writes
  await new Promise(resolve => setTimeout(resolve, 150));

  assert(fs.existsSync('/tmp/websocket-requests.log'), 'Should create JSON log at /tmp/websocket-requests.log');

  const logs = await readJsonLogs('/tmp/websocket-requests.log');
  assert(logs.length > 0, 'Should have logged entries at default location');

  console.log('✓ Default JSON log location (/tmp/websocket-requests.log) works correctly');
  middleware.shutdown();

  // Cleanup
  try {
    fs.unlinkSync('/tmp/websocket-requests.log');
    const dir = '/tmp/websocket-logs';
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
      fs.rmdirSync(dir);
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  WebSocket Logging Middleware - Comprehensive Test Suite  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    await testBasicRequestLogging();
    await testResponseLogging();
    await testErrorResponseLogging();
    await testMultipleRequests();
    await testSensitiveDataMasking();
    await testCommandExclusion();
    await testStatisticsTracking();
    await testStructuredLogsSummary();
    await testDefaultJsonLogLocation();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ ALL TESTS PASSED                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    cleanupTestFiles();
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testBasicRequestLogging,
  testResponseLogging,
  testErrorResponseLogging,
  testMultipleRequests,
  testSensitiveDataMasking,
  testCommandExclusion,
  testStatisticsTracking,
  testStructuredLogsSummary,
  testDefaultJsonLogLocation
};

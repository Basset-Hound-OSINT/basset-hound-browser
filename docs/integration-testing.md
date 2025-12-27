# Integration Testing Guide

This document describes the integration test suite for testing communication between the Chrome extension and Electron browser components of Basset Hound.

## Overview

The integration tests verify that:
- WebSocket messages are correctly passed between extension and browser
- Commands are properly synchronized across components
- Sessions and cookies are correctly shared and isolated
- Common automation scenarios work end-to-end

## Test Architecture

```
tests/integration/
├── harness/                    # Test infrastructure
│   ├── test-server.js          # WebSocket test server
│   ├── mock-extension.js       # Mock Chrome extension client
│   └── mock-browser.js         # Mock Electron browser client
├── extension-browser/          # Component communication tests
│   ├── communication.test.js   # Basic message passing
│   ├── command-sync.test.js    # Command synchronization
│   └── session-sharing.test.js # Session/cookie isolation
├── scenarios/                  # End-to-end scenario tests
│   ├── form-filling.test.js    # Form automation flow
│   ├── navigation.test.js      # Navigation commands
│   ├── data-extraction.test.js # Content extraction
│   └── screenshot.test.js      # Screenshot capture
└── protocol.test.js            # Protocol-level tests
```

## Running Tests

### Prerequisites

Install dependencies:

```bash
cd basset-hound-browser
npm install
```

### Run All Integration Tests

```bash
npm run test:integration
```

### Run Specific Test Suites

```bash
# Communication tests
npm run test:integration:communication

# Command sync tests
npm run test:integration:command-sync

# Session sharing tests
npm run test:integration:session-sharing

# Scenario tests
npm run test:integration:scenarios

# Protocol tests
npm run test:integration:protocol
```

### Run Individual Test Files

```bash
node tests/integration/extension-browser/communication.test.js
node tests/integration/scenarios/form-filling.test.js
node tests/integration/protocol.test.js
```

## Test Harness Components

### TestServer

A configurable WebSocket server for testing.

```javascript
const { TestServer } = require('./harness/test-server');

const server = new TestServer({
  port: 8765,
  path: '/',
  logMessages: true,
  responseTimeout: 30000
});

// Start server
await server.start();

// Register command handler
server.registerHandler('my_command', async (params) => {
  return { success: true, result: params };
});

// Wait for client
const client = await server.waitForClient();

// Send command to client
const response = await server.sendCommand(client, 'navigate', { url: 'https://example.com' });

// Stop server
await server.stop();
```

### MockExtension

Simulates a Chrome extension client.

```javascript
const { MockExtension } = require('./harness/mock-extension');

const extension = new MockExtension({
  url: 'ws://localhost:8765',
  autoReconnect: true,
  heartbeatMs: 30000,
  commandTimeout: 30000
});

// Connect
await extension.connect();

// Send command
const response = await extension.sendCommand('navigate', { url: 'https://example.com' });

// Register custom handler
extension.registerHandler('custom_command', async (params) => {
  return { success: true, custom: true };
});

// Simulate state
extension.simulateNavigation('https://example.com', 'Example Page');
extension.simulateCookie({ name: 'session', value: 'abc123', domain: '.example.com' });

// Disconnect
extension.disconnect();
```

### MockBrowser

Simulates the Electron browser client.

```javascript
const { MockBrowser } = require('./harness/mock-browser');

const browser = new MockBrowser({
  url: 'ws://localhost:8765',
  commandTimeout: 30000
});

// Connect
await browser.connect();

// Process commands from server
browser.on('command', ({ command, params }) => {
  console.log('Received command:', command);
});

// Get state
const state = browser.getState();
console.log('Current URL:', state.currentUrl);
console.log('Tabs:', state.tabs);

// Disconnect
browser.disconnect();
```

## Writing New Tests

### Test Structure

Each test file follows this pattern:

```javascript
const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

// Configuration
const TEST_PORT = 8774; // Use unique port
const TEST_URL = `ws://localhost:${TEST_PORT}`;

// State
let server = null;
let extension = null;
let browser = null;

// Utilities
const testUtils = {
  async setup() {
    server = new TestServer({ port: TEST_PORT });
    // Register handlers
    await server.start();

    extension = new MockExtension({ url: TEST_URL });
    browser = new MockBrowser({ url: TEST_URL });

    await extension.connect();
    await browser.connect();
  },

  async teardown() {
    if (extension?.isConnected) extension.disconnect();
    if (browser?.isConnected) browser.disconnect();
    if (server?.isRunning) await server.stop();
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

// Test functions
async function testMyFeature() {
  console.log('\n--- Test: My Feature ---');

  // Test logic
  const response = await extension.sendCommand('my_command', { param: 'value' });
  assert(response.success, 'Command should succeed');

  console.log('PASSED: My Feature');
  return true;
}

// Test runner
async function runTests() {
  const results = { passed: 0, failed: 0, tests: [] };

  const tests = [
    { name: 'My Feature', fn: testMyFeature }
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
  console.log(`Passed: ${results.passed}, Failed: ${results.failed}`);
  return results.failed === 0;
}

module.exports = { runTests, testUtils };

if (require.main === module) {
  runTests()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}
```

### Best Practices

1. **Use unique ports**: Each test file should use a different port to avoid conflicts when running tests in parallel.

2. **Clean up resources**: Always disconnect clients and stop servers in the teardown function.

3. **Test isolation**: Reset any shared state between tests.

4. **Meaningful assertions**: Use descriptive assertion messages.

5. **Logging**: Include progress logging to help debug failures.

6. **Timeouts**: Configure appropriate timeouts for async operations.

## Test Categories

### Communication Tests

Test basic WebSocket communication:
- Connection handling
- Message passing
- Heartbeat mechanism
- Error handling
- Reconnection

### Command Sync Tests

Test command synchronization:
- Navigation commands
- Form filling
- Click handling
- Screenshot capture
- Cookie management
- Tab management
- Session management

### Session Sharing Tests

Test session/cookie isolation:
- Session creation and persistence
- Cookie isolation between sessions
- Local storage isolation
- Session export/import
- Cross-component synchronization

### Scenario Tests

Test complete automation flows:
- Form filling workflow
- Navigation patterns
- Data extraction
- Screenshot capture flow

### Protocol Tests

Test protocol-level behavior:
- Command/response structure
- Error handling
- Timeout handling
- Reconnection logic
- Large data transfer

## Debugging Tests

### Enable Verbose Logging

```javascript
const server = new TestServer({
  port: TEST_PORT,
  logMessages: true // Enables message logging
});
```

### View Message Log

```javascript
// After running tests
const log = server.getMessageLog();
console.log('Messages:', JSON.stringify(log, null, 2));
```

### Increase Timeouts

```javascript
const extension = new MockExtension({
  url: TEST_URL,
  commandTimeout: 60000 // 60 seconds
});
```

## Continuous Integration

The tests can be run in CI environments:

```yaml
# Example GitHub Actions step
- name: Run Integration Tests
  run: |
    cd basset-hound-browser
    npm install
    npm run test:integration
```

## Common Issues

### Port Already in Use

If you see `EADDRINUSE`, another test or process is using the port. Either:
- Wait for the previous test to complete
- Use a different port
- Kill the process using the port

### Connection Timeout

If tests timeout during connection:
- Verify the server started successfully
- Check for firewall issues
- Increase connection timeout

### Test Flakiness

If tests intermittently fail:
- Add delays between operations
- Increase timeouts
- Check for race conditions
- Ensure proper cleanup between tests

## Contributing

When adding new tests:

1. Create a new test file in the appropriate directory
2. Use a unique port number
3. Follow the existing test structure
4. Add comprehensive assertions
5. Update this documentation if needed
6. Run all tests to ensure no conflicts

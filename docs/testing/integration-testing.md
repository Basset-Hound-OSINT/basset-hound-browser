# Integration Testing Guide

This document describes how to run integration tests for communication between the Basset Hound Chrome extension and Electron browser.

## Overview

The integration tests verify WebSocket-based communication between:
- **basset-hound-autofill-extension** (Chrome extension)
- **basset-hound-browser** (Electron browser)

The tests use mock implementations of both components to test the communication protocol without requiring the actual Chrome browser or Electron application to be running.

## Test Suites

The following test suites are available:

### 1. WebSocket Connection Tests
**File:** `tests/integration/extension-communication/websocket-connection.test.js`

Tests:
- Initial connection establishment
- Connection to specific WebSocket paths
- Connection refused handling
- Graceful disconnect
- Server-initiated disconnect
- Automatic reconnection
- Reconnection backoff
- Multiple concurrent connections
- Connection state transitions
- Heartbeat keep-alive
- Connection timeout handling
- Connection event ordering

### 2. Command Flow Tests
**File:** `tests/integration/extension-communication/command-flow.test.js`

Tests:
- Navigate command
- Fill form command
- Click command
- Screenshot command
- Get content command
- Execute script command
- Wait for element command
- Cookie commands (get/set/clear)
- Storage commands (localStorage/sessionStorage)
- Network capture commands
- Form detection commands
- Advanced interaction commands
- Command error handling
- Command response matching

### 3. Session/Cookie Sharing Tests
**File:** `tests/integration/extension-communication/session-cookie-sharing.test.js`

Tests:
- Session creation and isolation
- Cookie isolation between sessions
- LocalStorage isolation
- Session switching
- Cross-component cookie sync
- Session export and import
- Session deletion
- Cookie domain matching
- Storage clearing
- Session sync across components

### 4. Profile Synchronization Tests
**File:** `tests/integration/extension-communication/profile-sync.test.js`

Tests:
- Profile creation
- Profile activation
- User agent synchronization
- Fingerprint synchronization
- Proxy configuration sync
- Custom headers sync
- Profile export and import
- Profile update sync
- Profile deletion
- Cross-component profile visibility

### 5. Network Request Coordination Tests
**File:** `tests/integration/extension-communication/network-coordination.test.js`

Tests:
- Network capture start/stop
- Request logging
- Block rules synchronization
- Redirect rules synchronization
- Header modification rules sync
- Rule removal synchronization
- Clear all rules
- Network statistics sync
- Log clearing sync
- Complex rule interactions
- Cross-component rule application

### 6. Error Handling Tests
**File:** `tests/integration/extension-communication/error-handling.test.js`

Tests:
- Handler error propagation
- Unknown command handling
- Validation errors
- Command timeout handling
- Error response handling
- Reconnection after disconnect
- Reconnection limit
- Graceful degradation
- Command retry logic
- Multiple client error isolation
- Malformed message handling
- Server restart recovery
- Error recovery state preservation

### 7. Extension-Browser Integration Tests
**Directory:** `tests/integration/extension-browser/`

These tests verify end-to-end communication between the extension and browser components.

**Note:** These tests are designed to run as standalone scripts and will skip when run through Jest. Use the dedicated npm scripts to run them.

#### Communication Tests
**File:** `tests/integration/extension-browser/communication.test.js`

Tests WebSocket message passing between the Chrome extension and Electron browser:
- Basic WebSocket connection
- Message format validation
- Bidirectional communication
- Message ordering
- Large message handling
- Concurrent messages
- Binary data handling
- Special characters in messages
- Connection state transitions
- Heartbeat mechanism
- Error response handling
- Message broadcast

Run with: `npm run test:integration:communication`

#### Session Sharing Tests
**File:** `tests/integration/extension-browser/session-sharing.test.js`

Tests session and cookie synchronization:
- Session creation and persistence
- Session switching
- Cookie isolation between sessions
- Local storage isolation
- Session export and import
- Session deletion
- Cookie domain matching
- Storage clearing
- Session-specific clearing
- Cross-component session sync

Run with: `npm run test:integration:session-sharing`

#### Command Synchronization Tests
**File:** `tests/integration/extension-browser/command-sync.test.js`

Tests command synchronization across components:
- Navigation command sync
- Form fill command sync
- Click command sync
- Screenshot command sync
- Script execution sync
- Cookie command sync
- Tab management sync
- Session management sync
- Wait for element sync
- Scroll command sync
- Page state sync
- Recording command sync
- Command response matching

Run with: `npm run test:integration:command-sync`

## Prerequisites

1. **Node.js** (v16 or higher)
2. **npm** dependencies installed:

```bash
cd basset-hound-browser
npm install
```

## Running Tests

### Run All Integration Tests

Using the test runner:

```bash
# Run all extension communication tests
node tests/integration/extension-communication/index.js

# Or using npm script
npm run test:integration
```

### Run Specific Test Suites

```bash
# Run by suite name
node tests/integration/extension-communication/index.js websocket

# Run multiple suites
node tests/integration/extension-communication/index.js websocket command

# Run with --suite flag
node tests/integration/extension-communication/index.js --suite "Command Flow"
```

### Run Individual Test Files

```bash
# Run WebSocket connection tests
node tests/integration/extension-communication/websocket-connection.test.js

# Run command flow tests
node tests/integration/extension-communication/command-flow.test.js

# Run session/cookie tests
node tests/integration/extension-communication/session-cookie-sharing.test.js

# Run profile sync tests
node tests/integration/extension-communication/profile-sync.test.js

# Run network coordination tests
node tests/integration/extension-communication/network-coordination.test.js

# Run error handling tests
node tests/integration/extension-communication/error-handling.test.js
```

### Run Extension-Browser Integration Tests

These tests require running as standalone scripts:

```bash
# Run communication tests
npm run test:integration:communication

# Run session sharing tests
npm run test:integration:session-sharing

# Run command synchronization tests
npm run test:integration:command-sync

# Or run directly with Node
node tests/integration/extension-browser/communication.test.js
node tests/integration/extension-browser/session-sharing.test.js
node tests/integration/extension-browser/command-sync.test.js
```

**Important:** Extension-browser tests will automatically skip when run through Jest (e.g., `npm test`) because they require specific browser infrastructure. Always use the npm scripts or run them directly with Node.

### Using Jest

```bash
# Run all integration tests with Jest
npm run test:integration

# Run specific test file with Jest
npx jest tests/integration/extension-communication/websocket-connection.test.js

# Run with verbose output
npx jest tests/integration/extension-communication --verbose

# Run with coverage
npx jest tests/integration/extension-communication --coverage
```

### List Available Test Suites

```bash
node tests/integration/extension-communication/index.js --list
```

## Test Output

The tests output progress and results to the console:

```
======================================================================
Running: WebSocket Connection
Description: Tests WebSocket connection establishment, reconnection, and state management
======================================================================

--- Test: Initial Connection ---
  Extension established connection
  Server registered the connection
  Extension received welcome status
PASSED: Initial Connection

--- Test: Connection Path ---
  Connected to path-specific endpoint
PASSED: Connection Path

...

============================================================
WebSocket Connection Test Summary
============================================================
Passed: 12
Failed: 0
Total:  12
```

## Architecture

### Test Harness Components

The test harness consists of:

1. **TestServer** (`tests/integration/harness/test-server.js`)
   - Configurable WebSocket server for testing
   - Message logging and filtering
   - Command handler registration
   - Client management

2. **MockExtension** (`tests/integration/harness/mock-extension.js`)
   - Simulates Chrome extension WebSocket client
   - Command handlers for browser commands
   - State management (cookies, storage, etc.)
   - Reconnection logic

3. **MockBrowser** (`tests/integration/harness/mock-browser.js`)
   - Simulates Electron browser WebSocket client
   - Tab and session management
   - Recording simulation

### Test Flow

```
                    ┌─────────────────────┐
                    │    Test Server      │
                    │  (WebSocket Server) │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌───────────┐ ┌─────────────────┐
    │ MockExtension   │ │  Handler  │ │   MockBrowser   │
    │ (WS Client)     │ │  Registry │ │   (WS Client)   │
    └─────────────────┘ └───────────┘ └─────────────────┘
```

1. Tests set up a `TestServer` with command handlers
2. `MockExtension` and `MockBrowser` connect to the server
3. Tests send commands and verify responses
4. Tests verify state synchronization between components

## Adding New Tests

### Create a New Test File

1. Create file in `tests/integration/extension-communication/`
2. Follow the existing test file structure:

```javascript
const assert = require('assert');
const { TestServer } = require('../harness/test-server');
const { MockExtension } = require('../harness/mock-extension');
const { MockBrowser } = require('../harness/mock-browser');

const TEST_PORT = 8776;  // Use unique port
const TEST_URL = `ws://localhost:${TEST_PORT}`;

let server = null;
let extension = null;
let browser = null;

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
    if (extension) extension.disconnect();
    if (browser) browser.disconnect();
    if (server) await server.stop();
  },

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

async function testMyFeature() {
  console.log('\n--- Test: My Feature ---');

  // Your test code here
  const response = await extension.sendCommand('some_command', { param: 'value' });
  assert(response.success, 'Command should succeed');

  console.log('PASSED: My Feature');
  return true;
}

async function runTests() {
  console.log('My Tests');
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
      }
    }
  } finally {
    await testUtils.teardown();
  }

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

### Register in Index

Add the new test suite to `tests/integration/extension-communication/index.js`:

```javascript
const myNewTests = require('./my-new-feature.test');

const TEST_SUITES = [
  // ... existing suites
  {
    name: 'My New Feature',
    module: myNewTests,
    description: 'Tests for my new feature'
  }
];
```

## Debugging Tests

### Enable Verbose Logging

The mock components log to console by default. For more detailed output:

```javascript
const extension = new MockExtension({
  url: TEST_URL,
  debug: true  // Enable additional logging
});
```

### Inspect Message Log

The TestServer maintains a message log:

```javascript
// Get all logged messages
const log = server.getMessageLog();

// Filter by direction
const received = server.getMessageLog({ direction: 'received' });

// Filter by command
const navigates = server.getMessageLog({ command: 'navigate' });
```

### Debug Connection Issues

Check server status:

```javascript
const status = server.getStatus();
console.log('Connected clients:', status.clients);
console.log('Pending responses:', status.pendingResponses);
```

## Continuous Integration

For CI environments, use the Jest reporter:

```bash
npm run test:ci
```

This generates JUnit-compatible test reports for CI systems.

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        working-directory: basset-hound-browser
        run: npm ci

      - name: Run integration tests
        working-directory: basset-hound-browser
        run: npm run test:integration
```

## Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` errors, ensure tests clean up properly or use unique ports:

```javascript
const TEST_PORT = 8770 + Math.floor(Math.random() * 100);
```

### Timeout Issues

Increase test timeouts for slow environments:

```bash
# Jest timeout
npx jest tests/integration --testTimeout=120000

# Or in the test file
jest.setTimeout(120000);
```

### Connection Failures

1. Ensure no other processes are using the test ports
2. Check firewall settings
3. Verify WebSocket library is installed: `npm install ws`

## Related Documentation

- [WebSocket Server API](./websocket-server.md) - WebSocket server command reference
- [Extension Protocol](./extension-protocol.md) - Communication protocol details
- [Profile Management](./profiles.md) - Profile and fingerprint configuration

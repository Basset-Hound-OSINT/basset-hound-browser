# Basset Hound Browser - Test Suite

Comprehensive testing documentation for the Basset Hound Browser, an Electron-based browser with bot detection evasion capabilities.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Running Tests](#running-tests)
- [Test Categories](#test-categories)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The test suite verifies:
- WebSocket server communication
- All automation commands
- Bot detection evasion techniques
- Module functionality (cookies, profiles, geolocation, storage, tabs)
- Error handling and edge cases

The suite is organized into three main categories:

| Category | Directory | Purpose |
|----------|-----------|---------|
| Unit Tests | `tests/unit/` | Test individual modules in isolation |
| Integration Tests | `tests/integration/` | Test component interactions |
| E2E Tests | `tests/e2e/` | Test complete browser workflows |

## Test Structure

```
tests/
+-- unit/                           # Unit tests
|   +-- websocket-server.test.js    # WebSocket command handling
|   +-- tab-manager.test.js         # Tab management
|   +-- cookies-manager.test.js     # Cookie operations
|   +-- profiles-manager.test.js    # Profile management
|   +-- geolocation-manager.test.js # Geolocation spoofing
|   +-- storage-manager.test.js     # Storage operations
|   +-- humanize.test.js            # Human-like behavior
|   +-- fingerprint.test.js         # Browser fingerprinting
+-- integration/                    # Integration tests
|   +-- extension-browser/          # Browser-extension communication
|   +-- scenarios/                  # End-to-end scenarios
|   +-- protocol.test.js            # WebSocket protocol
+-- e2e/                            # End-to-end tests
|   +-- full-workflow.test.js       # Complete workflows
|   +-- browser-automation.test.js  # Automation sequences
+-- helpers/                        # Test utilities
|   +-- setup.js                    # Jest setup
|   +-- websocket-client.js         # WebSocket test client
+-- integration.test.js             # Legacy integration tests
+-- test-client.js                  # Interactive test client
+-- test-server.html                # Test page
+-- README.md                       # This file
```

## Prerequisites

- Node.js v16 or higher
- npm v7 or higher
- Basset Hound Browser application (for E2E tests)

### Installing Dependencies

```bash
npm install
```

This installs Jest, Playwright, and other testing dependencies defined in `package.json`.

## Quick Start

### Run All Unit Tests (Fastest - No Browser Required)

```bash
npm run test:unit
```

### Run All Tests

```bash
npm test
```

### Run with Coverage

```bash
npm run test:coverage
```

## Running Tests

### NPM Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit tests with coverage |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:verbose` | Run with verbose output |
| `npm run test:ci` | Run in CI mode with JUnit reporter |
| `npm run test:legacy` | Run legacy integration tests |
| `npm run test:evasion` | Run bot detection evasion tests |
| `npm run test:client` | Interactive test client |

### Running Specific Tests

```bash
# Run a specific test file
npx jest tests/unit/tab-manager.test.js

# Run tests matching a pattern
npx jest --testNamePattern="TabManager"

# Run tests in a specific directory
npx jest tests/unit/

# Run with specific configuration
npx jest --config jest.config.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_URL` | `ws://localhost:8765` | WebSocket server URL |
| `CONNECT_TIMEOUT` | `10000` | Connection timeout (ms) |
| `COMMAND_TIMEOUT` | `30000` | Command timeout (ms) |
| `SKIP_E2E` | `false` | Skip E2E tests |
| `TEST_VERBOSE` | `false` | Enable verbose logging |

Example:
```bash
WS_URL=ws://localhost:9000 npm run test:integration
```

## Test Categories

### Unit Tests

Unit tests verify individual modules in isolation using mocks for dependencies.

**Tested Modules:**

1. **WebSocket Server** (`websocket-server.test.js`)
   - Server initialization and port binding
   - Client connections and disconnections
   - Command handler registration
   - Message routing and responses
   - Error handling and broadcasting

2. **Tab Manager** (`tab-manager.test.js`)
   - Tab creation, deletion, and duplication
   - Tab switching and navigation
   - Navigation history (back/forward)
   - Pin/mute functionality
   - Zoom controls
   - Tab serialization and restoration

3. **Cookie Manager** (`cookies-manager.test.js`)
   - Get/set/delete cookies
   - Export formats (JSON, Netscape, EditThisCookie)
   - Import parsing and validation
   - Cookie clearing by domain
   - Statistics and reporting

4. **Profile Manager** (`profiles-manager.test.js`)
   - Profile CRUD operations
   - Fingerprint generation
   - Session management
   - Profile switching
   - Profile cloning and export

5. **Geolocation Manager** (`geolocation-manager.test.js`)
   - Location spoofing
   - Timezone management
   - Preset locations
   - Watch position simulation
   - Distance calculation

6. **Storage Manager** (`storage-manager.test.js`)
   - localStorage operations
   - sessionStorage operations
   - IndexedDB management
   - Export/import functionality

### Integration Tests

Integration tests verify component interactions and WebSocket protocol.

**Test Scenarios:**

- Extension-browser communication
- Form filling workflows
- Navigation sequences
- Data extraction
- Screenshot capture

### E2E Tests

End-to-end tests verify complete browser automation workflows.

**Prerequisites:** Browser must be running with WebSocket server active.

```bash
# Start the browser first
npm start

# In another terminal, run E2E tests
npm run test:e2e
```

**Test Coverage:**

- Navigation workflows
- Form interactions
- Screenshot capture
- Cookie management
- Bot detection evasion

### Using the Test Client

Interactive mode:
```bash
node tests/test-client.js --interactive
```

Run test sequence:
```bash
node tests/test-client.js --test
```

Test bot detection evasion:
```bash
node tests/test-client.js --evasion
```

### Test Client Commands

| Command | Description |
|---------|-------------|
| `ping` | Ping server |
| `status` | Get server status |
| `navigate <url>` | Navigate to URL |
| `click <selector>` | Click element |
| `fill <selector> <value>` | Fill form field |
| `content` | Get page content |
| `state` | Get page state |
| `url` | Get current URL |
| `screenshot` | Take screenshot |
| `wait <selector>` | Wait for element |
| `scroll <x> <y>` | Scroll to position |
| `script <code>` | Execute JavaScript |
| `cookies <url>` | Get cookies |
| `test` | Run test sequence |
| `history` | Show command history |
| `quit` | Disconnect |

## Writing Tests

### Unit Test Template

```javascript
/**
 * Module Name Unit Tests
 */

// Mock dependencies
jest.mock('electron', () => ({
  session: { defaultSession: { cookies: { get: jest.fn() } } }
}));

const ModuleName = require('../../module/path');

describe('ModuleName', () => {
  let instance;

  beforeEach(() => {
    jest.clearAllMocks();
    instance = new ModuleName();
  });

  describe('methodName', () => {
    test('should do something', () => {
      const result = instance.methodName();
      expect(result).toBeDefined();
    });

    test('should handle errors', () => {
      expect(() => instance.methodName(null)).toThrow();
    });
  });
});
```

### Integration Test Template

```javascript
/**
 * Integration Test
 */

const { WebSocketTestClient, waitForServer } = require('../helpers/websocket-client');

describe('Integration: Feature', () => {
  let client;

  beforeAll(async () => {
    await waitForServer();
  });

  beforeEach(async () => {
    client = new WebSocketTestClient();
    await client.connect();
  });

  afterEach(() => {
    client.disconnect();
  });

  test('should complete workflow', async () => {
    const response = await client.send('command', { param: 'value' });
    expect(response.success).toBe(true);
  });
});
```

## Bot Detection Evasion Tests

The browser implements various evasion techniques that are tested:

### Navigator Properties
- `webdriver` set to undefined
- Realistic `plugins` array
- Proper `languages` array
- `platform` matches user agent

### Chrome Object
- Mock `chrome.runtime`
- Mock `chrome.loadTimes`
- Mock `chrome.csi`

### WebGL Fingerprinting
- Randomized vendor strings
- Randomized renderer strings

### Canvas Fingerprinting
- Subtle noise added to canvas data
- Consistent but unique fingerprints

### Automation Detection
- Removed Selenium properties
- Removed Phantom properties
- Removed webdriver indicators

## Humanization Features

The browser simulates human-like behavior:

### Typing
- Variable keystroke delays
- Occasional typos and corrections
- Pause between words

### Mouse Movement
- Bezier curve paths
- Occasional overshoot
- Jitter for realism

### Scrolling
- Variable scroll amounts
- Smooth scrolling
- Human-like timing

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Browser Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Setup Xvfb
        run: |
          sudo apt-get install -y xvfb
          Xvfb :99 -screen 0 1280x720x24 &
          echo "DISPLAY=:99" >> $GITHUB_ENV

      - name: Start browser
        run: npm start &
        env:
          DISPLAY: ':99'

      - name: Wait for browser
        run: sleep 10

      - name: Run E2E tests
        run: npm run test:e2e
```

## Troubleshooting

### Common Issues

#### WebSocket Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:8765
```

**Solution:** Ensure the browser is running before E2E tests:
```bash
npm start
# Wait for browser to start, then run tests
npm run test:e2e
```

#### Timeout Errors
```
Error: Timeout - Async callback was not invoked within the 5000ms timeout
```

**Solution:** Increase timeout in test or configuration:
```javascript
jest.setTimeout(30000);
// or
test('slow test', async () => { /* ... */ }, 30000);
```

#### Electron Module Not Found
```
Error: Cannot find module 'electron'
```

**Solution:** Unit tests should mock Electron:
```javascript
jest.mock('electron', () => ({
  session: { defaultSession: mockSession }
}));
```

### Debug Mode

Run tests with debugging:

```bash
# Node debugger
node --inspect-brk node_modules/.bin/jest tests/unit/tab-manager.test.js

# Verbose logging
npm run test:verbose
```

### View Coverage Report

```bash
npm run test:coverage
# Open coverage/lcov-report/index.html in browser
```

## Test Coverage Targets

| Module | Target |
|--------|--------|
| websocket/ | 80% |
| evasion/ | 70% |
| cookies/ | 80% |
| profiles/ | 75% |
| geolocation/ | 75% |
| storage/ | 70% |
| tabs/ | 80% |

Run `npm run test:coverage` to see current coverage.

## Contributing

1. Write tests for new features
2. Ensure all tests pass before submitting PR
3. Maintain code coverage above thresholds
4. Include both positive and negative test cases
5. Test edge cases and error handling

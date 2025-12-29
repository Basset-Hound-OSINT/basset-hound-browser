# Basset Hound Browser - Testing Guide

Comprehensive guide for testing the Basset Hound Browser, including unit tests, integration tests, end-to-end tests, and bot detection evasion verification.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Prerequisites](#prerequisites)
- [Running Tests](#running-tests)
- [Test Types](#test-types)
- [Bot Detection Testing](#bot-detection-testing)
- [Coverage](#coverage)
- [Writing Tests](#writing-tests)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The Basset Hound Browser test suite is designed to verify:

1. **Core Functionality** - WebSocket server, command handling, navigation
2. **Bot Detection Evasion** - Fingerprint spoofing, automation concealment
3. **Browser Automation** - Click, fill, scroll, screenshot operations
4. **Human Behavior Simulation** - Realistic mouse movements, typing patterns
5. **Proxy Management** - Configuration, rotation, authentication

## Test Structure

```
tests/
├── unit/                          # Unit tests for individual modules
│   ├── websocket-server.test.js   # WebSocket command handling
│   ├── tab-manager.test.js        # Tab creation, navigation, management
│   ├── cookies-manager.test.js    # Cookie import/export, formats
│   ├── profiles-manager.test.js   # Profile CRUD, fingerprinting
│   ├── geolocation-manager.test.js # Location spoofing, timezones
│   ├── storage-manager.test.js    # localStorage, sessionStorage, IndexedDB
│   ├── fingerprint.test.js        # Fingerprint evasion functions
│   ├── humanize.test.js           # Human behavior simulation
│   └── proxy-manager.test.js      # Proxy configuration
│
├── integration/                   # Integration tests
│   ├── browser-launch.test.js     # Application startup
│   ├── navigation.test.js         # Page navigation
│   ├── automation.test.js         # Automation commands
│   └── evasion.test.js            # Bot detection evasion
│
├── e2e/                           # End-to-end tests
│   └── full-workflow.test.js      # Complete automation workflows
│
├── bot-detection/                 # Bot detection tests
│   ├── detector-tests.js          # Tests against detection sites
│   └── fingerprint-consistency.js # Fingerprint verification
│
├── helpers/                       # Test utilities
│   ├── electron-helpers.js        # Electron test utilities
│   ├── websocket-client.js        # WebSocket test client
│   └── setup.js                   # Test environment setup
│
├── integration.test.js            # Legacy integration tests
├── test-client.js                 # Interactive test client
└── test-server.html               # Test HTML page
```

## Prerequisites

### Required Software

- Node.js 18.x or higher
- npm 9.x or higher
- Electron installed (`npm install`)

### Install Test Dependencies

```bash
cd basset-hound-browser
npm install
```

This will install:
- Jest - Test framework
- Playwright - Browser automation
- Spectron - Electron testing (legacy)
- jest-junit - JUnit reporter for CI

## Running Tests

### Quick Start

```bash
# Run all tests
npm test

# Run with verbose output
npm run test:verbose

# Run and watch for changes
npm run test:watch
```

### Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Bot detection tests
npm run test:bot-detection
```

### Legacy Tests

```bash
# Original integration tests
npm run test:legacy

# Original evasion tests
npm run test:evasion

# Interactive test client
npm run test:client
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# CI mode with coverage
npm run test:ci
```

## Test Types

### Unit Tests

Unit tests verify individual functions and modules in isolation.

**Location:** `tests/unit/`

**Run:** `npm run test:unit`

**Coverage Areas:**
- WebSocket server command handling
- Tab management (create, switch, close, navigate)
- Cookie operations (import/export in JSON, Netscape, EditThisCookie formats)
- Profile management (create, switch, fingerprint generation)
- Geolocation spoofing (locations, timezones, presets)
- Storage operations (localStorage, sessionStorage, IndexedDB)
- Fingerprint generation and spoofing
- Human behavior simulation algorithms
- Proxy configuration and validation

**Example:**

```javascript
describe('fingerprint.js', () => {
  test('getRandomViewport returns valid dimensions', () => {
    const viewport = getRandomViewport();
    expect(viewport.width).toBeGreaterThan(1000);
    expect(viewport.height).toBeGreaterThan(600);
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

**Location:** `tests/integration/`

**Run:** `npm run test:integration`

**Coverage Areas:**
- Application launch and initialization
- WebSocket communication
- Page navigation and content loading
- Form interaction and automation

**Requirements:**
- Electron application must be launchable
- Tests have longer timeouts (60 seconds)

### End-to-End Tests

E2E tests simulate complete user workflows.

**Location:** `tests/e2e/`

**Run:** `npm run test:e2e`

**Coverage Areas:**
- Complete form automation workflows
- Multi-page navigation sessions
- Cookie and session management
- Error recovery scenarios

**Requirements:**
- Full application stack running
- Network access for external site tests
- Extended timeouts (180 seconds)

### Bot Detection Tests

Tests specifically for verifying bot detection evasion.

**Location:** `tests/bot-detection/`

**Run:** `npm run test:bot-detection`

**Coverage Areas:**
- Tests against real bot detection sites
- Fingerprint consistency verification
- Automation trace removal
- Cross-frame fingerprint consistency

## Bot Detection Testing

### Detection Sites Tested

The test suite verifies evasion against these bot detection services:

1. **SannySoft** (`https://bot.sannysoft.com/`)
   - Comprehensive WebDriver detection
   - Navigator property checks
   - Chrome object verification

2. **Intoli Test** (`https://intoli.com/...`)
   - Headless Chrome detection
   - Plugin verification
   - User agent analysis

3. **BrowserLeaks** (`https://browserleaks.com/`)
   - Canvas fingerprinting
   - WebGL fingerprinting
   - JavaScript environment analysis

4. **CreepJS** (`https://abrahamjuliot.github.io/creepjs/`)
   - Advanced fingerprint analysis
   - Lies detection
   - Automation indicators

### Evasion Checks

The browser is tested for these evasion capabilities:

| Check | Expected Result |
|-------|-----------------|
| `navigator.webdriver` | `undefined` or `false` |
| `navigator.plugins` | Length > 0 |
| `navigator.languages` | Non-empty array |
| `window.chrome` | Exists |
| `window._selenium` | `undefined` |
| `window._phantom` | `undefined` |
| Canvas fingerprint | Consistent, non-default |
| WebGL vendor/renderer | Valid GPU strings |

### Running Evasion Tests

```bash
# Run all bot detection tests
npm run test:bot-detection

# Run legacy evasion tests
npm run test:evasion

# Verbose output
npm run test:bot-detection -- --verbose
```

## Coverage

### Generating Reports

```bash
# Generate HTML coverage report
npm run test:coverage

# Report is saved to coverage/lcov-report/index.html
```

### Coverage Thresholds

The project requires:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

### Coverage Areas

| Module | Description |
|--------|-------------|
| `websocket/` | WebSocket server and handlers |
| `evasion/` | Fingerprint and evasion code |
| `cookies/` | Cookie management and formats |
| `profiles/` | Browser profile management |
| `geolocation/` | Location and timezone spoofing |
| `storage/` | Web storage management |
| `tabs/` | Tab management |
| `sessions/` | Session management |
| `proxy/` | Proxy management |
| `input/` | Keyboard and mouse simulation |
| `utils/` | Utility functions |

## Writing Tests

### Test File Naming

- Unit tests: `*.test.js` in `tests/unit/`
- Integration tests: `*.test.js` in `tests/integration/`
- E2E tests: `*.test.js` in `tests/e2e/`

### Using Test Helpers

```javascript
const { createClient } = require('../helpers/websocket-client');
const { launchApp, closeApp } = require('../helpers/electron-helpers');
const { TEST_CONFIG, wait } = require('../helpers/setup');

describe('My Test Suite', () => {
  let client;
  let app;

  beforeEach(async () => {
    app = await launchApp();
    client = await createClient();
  });

  afterEach(async () => {
    client.disconnect();
    await closeApp(app);
  });

  test('should do something', async () => {
    const response = await client.ping();
    expect(response.success).toBe(true);
  });
});
```

### WebSocket Test Helpers

```javascript
const { WebSocketTestClient, createClient } = require('../helpers/websocket-client');

// Create and connect
const client = await createClient({ verbose: true });

// Send commands
await client.ping();
await client.navigate('https://example.com');
await client.click('#button');
await client.fill('#input', 'value');
await client.executeScript('return document.title');

// Disconnect
client.disconnect();
```

### Best Practices

1. **Isolate Tests** - Each test should be independent
2. **Clean Up** - Always close connections and apps in `afterEach`
3. **Timeouts** - Use appropriate timeouts for async operations
4. **Descriptive Names** - Test names should describe expected behavior
5. **Single Assertion Focus** - Each test should verify one thing

## Continuous Integration

### CI Configuration

The project includes CI-ready test scripts:

```bash
# Run all tests with coverage for CI
npm run test:ci
```

This generates:
- JUnit XML report for CI integration
- Coverage report for code quality gates

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:ci
      - uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/
```

## Troubleshooting

### Common Issues

#### Tests Timeout

```bash
# Increase timeout for slow operations
npm run test:integration -- --testTimeout=120000
```

#### WebSocket Connection Failed

1. Ensure the browser app can start
2. Check if port 8765 is available
3. Wait longer for server startup

```bash
# Check if port is in use
lsof -i :8765
```

#### Electron Won't Start

```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Check Electron installation
./node_modules/.bin/electron --version
```

#### Bot Detection Tests Fail

Some bot detection sites may:
- Rate limit requests
- Change detection methods
- Be temporarily unavailable

These tests are advisory and may have some failures.

### Debug Mode

```bash
# Run with Node debugger
node --inspect node_modules/.bin/jest tests/unit --testTimeout=60000

# Enable verbose logging
VERBOSE=true npm test
```

### Viewing Test Output

```bash
# Pretty output
npm test -- --verbose

# Show console.log statements
npm test -- --verbose --silent=false
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/)
- [Playwright Documentation](https://playwright.dev/docs/)
- [Electron Testing Guide](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [Bot Detection Resources](https://github.com/nicorevin/bot-detection-resources)

## Updating Tests

When adding new features:

1. Add unit tests for new functions
2. Add integration tests for new commands
3. Update bot detection tests if evasion changes
4. Run full test suite before committing

```bash
# Full test suite
npm run test:coverage
```

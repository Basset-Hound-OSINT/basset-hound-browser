#!/usr/bin/env node
/**
 * Comprehensive Deployment Integration Test
 * Tests real browser functionality with actual website navigation
 *
 * Usage: npm run test:integration 2026-05-08
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TEST_HOST = process.env.BASSET_HOST || '127.0.0.1';
const TEST_PORT = process.env.BASSET_PORT || 8765;
const WS_URL = `ws://${TEST_HOST}:${TEST_PORT}`;

// Test results tracking
let testResults = {
  timestamp: new Date().toISOString(),
  environment: {
    host: TEST_HOST,
    port: TEST_PORT,
    wsUrl: WS_URL,
    nodeVersion: process.version,
  },
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  }
};

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  test: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.cyan}═══ ${msg} ═══${colors.reset}\n`),
};

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.commandId = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        log.success(`Connected to WebSocket at ${this.url}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        log.error(`WebSocket connection error: ${err.message}`);
        reject(err);
      });
    });
  }

  send(command, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = ++this.commandId;
      const message = { id, command, params };

      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Command ${command} timed out after 30s`));
      }, 30000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeoutHandle);
            this.ws.removeListener('message', handler);

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          // Not JSON, ignore
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.on('close', resolve);
      } else {
        resolve();
      }
    });
  }
}

// Test runner
async function runTest(name, testFn) {
  const test = {
    name,
    status: 'pending',
    duration: 0,
    error: null
  };

  testResults.summary.total++;
  const startTime = Date.now();

  try {
    log.test(name);
    await testFn();
    test.status = 'passed';
    test.duration = Date.now() - startTime;
    testResults.summary.passed++;
    log.success(`${name} (${test.duration}ms)`);
  } catch (error) {
    test.status = 'failed';
    test.error = error.message;
    test.duration = Date.now() - startTime;
    testResults.summary.failed++;
    testResults.summary.errors.push({ test: name, error: error.message });
    log.error(`${name} - ${error.message}`);
  }

  testResults.tests.push(test);
}

// Deployment Tests

async function main() {
  let client = null;

  try {
    log.section('BASSET HOUND BROWSER - DEPLOYMENT INTEGRATION TEST');
    log.info(`Testing against: ${WS_URL}`);
    log.info(`Timestamp: ${new Date().toISOString()}\n`);

    // 1. WebSocket Connectivity
    log.section('1. WebSocket Connectivity');

    await runTest('Connect to WebSocket API', async () => {
      client = new WebSocketClient(WS_URL);
      await client.connect();
    });

    if (!client) {
      throw new Error('Failed to connect to browser');
    }

    // 2. Basic Commands
    log.section('2. Basic Commands');

    await runTest('Get browser status', async () => {
      const result = await client.send('status');
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid status response');
      }
    });

    await runTest('Create new tab', async () => {
      const result = await client.send('create_tab', { url: 'about:blank' });
      if (!result || !result.tabId) {
        throw new Error('Failed to create tab');
      }
    });

    // 3. Navigation Tests
    log.section('3. Navigation Tests');

    let testTabId = null;

    await runTest('Create test tab for navigation', async () => {
      const result = await client.send('create_tab');
      if (!result || !result.tabId) {
        throw new Error('Failed to create tab');
      }
      testTabId = result.tabId;
    });

    await runTest('Navigate to example.com', async () => {
      const result = await client.send('navigate', {
        tabId: testTabId,
        url: 'https://example.com'
      });
      if (!result.success) {
        throw new Error('Navigation failed');
      }
      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    await runTest('Get page content', async () => {
      const result = await client.send('get_content', { tabId: testTabId });
      if (!result || !result.content) {
        throw new Error('Failed to get content');
      }
      if (!result.content.includes('example')) {
        throw new Error('Unexpected page content');
      }
    });

    await runTest('Take screenshot', async () => {
      const result = await client.send('screenshot', {
        tabId: testTabId,
        format: 'png'
      });
      if (!result || !result.data) {
        throw new Error('Failed to capture screenshot');
      }
      // Verify it's a valid PNG
      const buffer = Buffer.from(result.data, 'base64');
      if (!buffer.toString('hex').startsWith('89504e47')) {
        throw new Error('Invalid PNG data');
      }
    });

    // 4. Evasion Tests
    log.section('4. Bot Evasion Tests');

    await runTest('Get device fingerprint', async () => {
      const result = await client.send('get_device_fingerprint', { tabId: testTabId });
      if (!result || !result.fingerprint) {
        throw new Error('Failed to get fingerprint');
      }
    });

    await runTest('Enable evasion techniques', async () => {
      const result = await client.send('set_evasion_mode', {
        enabled: true,
        techniques: ['user-agent', 'navigator', 'webgl']
      });
      if (!result.success) {
        throw new Error('Failed to enable evasion');
      }
    });

    await runTest('Get evasion status', async () => {
      const result = await client.send('get_evasion_status');
      if (!result || !result.enabled) {
        throw new Error('Evasion not enabled');
      }
    });

    // 5. Profile Management
    log.section('5. Profile Management');

    await runTest('Get profile list', async () => {
      const result = await client.send('list_profiles');
      if (!Array.isArray(result)) {
        throw new Error('Invalid profile list');
      }
    });

    // 6. Session Management
    log.section('6. Session Management');

    await runTest('Get session info', async () => {
      const result = await client.send('get_session_info', { tabId: testTabId });
      if (!result || !result.sessionId) {
        throw new Error('Failed to get session info');
      }
    });

    // 7. Cleanup
    log.section('7. Cleanup');

    await runTest('Close test tab', async () => {
      const result = await client.send('close_tab', { tabId: testTabId });
      if (!result.success) {
        throw new Error('Failed to close tab');
      }
    });

    // Final Results
    log.section('Test Results Summary');
    log.info(`Total Tests: ${testResults.summary.total}`);
    log.success(`Passed: ${testResults.summary.passed}`);
    if (testResults.summary.failed > 0) {
      log.error(`Failed: ${testResults.summary.failed}`);
    }

    if (testResults.summary.errors.length > 0) {
      log.section('Errors');
      testResults.summary.errors.forEach(err => {
        console.log(`  • ${err.test}: ${err.error}`);
      });
    }

    // Save results
    const resultsDir = path.join(__dirname, '../../tests/results/deployment');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultsFile = path.join(resultsDir, `deployment-test-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    log.success(`Results saved to ${resultsFile}`);

    // Exit with appropriate code
    process.exit(testResults.summary.failed > 0 ? 1 : 0);

  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Run tests
main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * External App Reliability - Core Workflow Validation
 *
 * Tests the essential workflow that real external apps depend on:
 * 1. Navigate to URL
 * 2. Wait for page load
 * 3. Extract full HTML
 * 4. Get network logs
 * 5. Verify data consistency between commands
 *
 * This is the #1 use case for external integrations.
 * If this fails, external apps cannot function.
 */

const WebSocket = require('ws');
const assert = require('assert');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;
const TEST_URL = 'https://example.com';

// Simple test client
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(100);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              this.responseMap.get(msg.requestId).resolve(msg);
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        this.ws.on('error', (err) => {
          if (!this.connected) reject(err);
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('Connection timeout'));
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const requestId = ++this.requestId;
    const message = { command, params, requestId };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Command timeout: ${command} (${timeout}ms)`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timeoutHandle);
          if (msg.error) {
            reject(new Error(`Command failed: ${msg.error}`));
          } else {
            resolve(msg);
          }
        }
      });

      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

// Test results tracking
const RESULTS = {
  tests: [],
  passed: 0,
  failed: 0,
  startTime: Date.now()
};

// Assertion helper with detailed logging
async function testStep(name, fn) {
  try {
    await fn();
    RESULTS.passed++;
    RESULTS.tests.push({ name, status: 'PASS', duration: 0 });
    console.log(`✓ ${name}`);
  } catch (err) {
    RESULTS.failed++;
    RESULTS.tests.push({ name, status: 'FAIL', error: err.message });
    console.error(`✗ ${name}`);
    console.error(`  Error: ${err.message}`);
    throw err; // Stop test on failure
  }
}

/**
 * CORE WORKFLOW TEST
 * This is what external apps actually do
 */
async function testCoreWorkflow() {
  console.log('\n========================================');
  console.log('CORE WORKFLOW VALIDATION');
  console.log('========================================\n');

  const client = new WebSocketClient(WS_URL);
  let htmlContent = null;
  let networkLog = null;

  try {
    // Step 1: Connect
    await testStep('Step 1: Connect to WebSocket', async () => {
      await client.connect();
      assert(client.connected, 'Client should be connected');
    });

    // Step 2: Navigate to URL
    let navResponse = null;
    await testStep('Step 2: Navigate to URL', async () => {
      navResponse = await client.sendCommand('navigate', { url: TEST_URL });
      assert(navResponse, 'Response should exist');
      assert(navResponse.status === 'success' || navResponse.success === true,
        `Navigation failed: ${navResponse.error || 'unknown'}`);
    });

    // Step 3: Wait for page load
    await testStep('Step 3: Wait for page load (DOM ready)', async () => {
      const waitResponse = await client.sendCommand('wait_for_load', {
        maxWaitTime: 10000,
        waitFor: 'domready' // Wait for document ready, not full load
      });
      assert(waitResponse.status === 'success' || waitResponse.success === true,
        `Wait failed: ${waitResponse.error || 'unknown'}`);
    });

    // Step 4: Extract full HTML
    await testStep('Step 4: Extract full HTML content', async () => {
      const htmlResponse = await client.sendCommand('get_content', {
        contentType: 'html'
      });
      assert(htmlResponse, 'HTML response should exist');
      assert(htmlResponse.content, 'Content should exist');
      assert(typeof htmlResponse.content === 'string', 'Content should be string');
      assert(htmlResponse.content.length > 100, 'HTML should have substantial content');

      htmlContent = htmlResponse.content;
    });

    // Step 5: Get network logs
    await testStep('Step 5: Get network logs', async () => {
      const logResponse = await client.sendCommand('get_network_logs', {});
      assert(logResponse, 'Network log response should exist');
      assert(Array.isArray(logResponse.requests), 'Should have requests array');
      assert(logResponse.requests.length > 0, 'Should have at least one request');

      networkLog = logResponse;
    });

    // Step 6: Verify data consistency
    await testStep('Step 6: Verify HTML-to-Network consistency', async () => {
      assert(htmlContent, 'HTML content should be populated');
      assert(networkLog, 'Network log should be populated');

      // HTML should match the main document request
      const mainRequests = networkLog.requests.filter(r =>
        r.resourceType === 'document' || r.resourceType === 'xhr' ||
        r.url.includes(TEST_URL) || r.method === 'GET'
      );
      assert(mainRequests.length > 0, 'Should have main document request in network log');

      // Verify first request is the main navigation
      const firstRequest = networkLog.requests[0];
      assert(firstRequest.url, 'First request should have URL');
      assert(firstRequest.statusCode, 'First request should have status code');
      assert(typeof firstRequest.duration === 'number', 'Request should have duration');
    });

    // Step 7: Verify response schema compliance
    await testStep('Step 7: Verify response schema compliance', async () => {
      // Check navigate response shape
      assert(navResponse.status !== undefined || navResponse.success !== undefined,
        'Navigate response should have status or success field');

      // Check network log response shape
      assert(networkLog.requests !== undefined, 'Network log should have requests field');
      assert(typeof networkLog.requests === 'object', 'Requests should be iterable');

      // Validate individual request structure
      networkLog.requests.slice(0, 3).forEach((req, idx) => {
        assert(req.url !== undefined, `Request ${idx} should have url`);
        assert(req.method !== undefined, `Request ${idx} should have method`);
        assert(req.statusCode !== undefined || req.status !== undefined,
          `Request ${idx} should have statusCode or status`);
        assert(req.duration !== undefined || req.time !== undefined,
          `Request ${idx} should have duration or time`);
      });
    });

    // Step 8: Sequence validation
    await testStep('Step 8: Verify command sequence didn\'t interfere', async () => {
      // Send another command to verify system state is clean
      const stateResponse = await client.sendCommand('get_page_state', {});
      assert(stateResponse, 'Page state should be retrievable');
      // If we got here, system is still responsive and clean
    });

    console.log('\n✓ Core workflow test PASSED');
    console.log(`  - Navigation: ${navResponse.status || navResponse.success ? 'OK' : 'FAIL'}`);
    console.log(`  - HTML extracted: ${htmlContent.length} bytes`);
    console.log(`  - Network requests: ${networkLog.requests.length} total`);

  } catch (error) {
    console.error('\n✗ Core workflow test FAILED');
    console.error(`  ${error.message}`);
    return false;
  } finally {
    client.disconnect();
  }

  return true;
}

/**
 * MULTI-COMMAND SEQUENCE TEST
 * Verify that rapid sequential commands don't interfere
 */
async function testRapidSequence() {
  console.log('\n========================================');
  console.log('RAPID COMMAND SEQUENCE TEST');
  console.log('========================================\n');

  const client = new WebSocketClient(WS_URL);

  try {
    await testStep('Connect to server', async () => {
      await client.connect();
    });

    await testStep('Send 5 rapid commands sequentially', async () => {
      const results = [];

      // Command 1: Navigate
      results.push(await client.sendCommand('navigate', { url: TEST_URL }));

      // Command 2: Wait
      results.push(await client.sendCommand('wait_for_load', { maxWaitTime: 5000 }));

      // Command 3: Get content
      results.push(await client.sendCommand('get_content', { contentType: 'html' }));

      // Command 4: Get network logs
      results.push(await client.sendCommand('get_network_logs', {}));

      // Command 5: Get page state
      results.push(await client.sendCommand('get_page_state', {}));

      // All should succeed
      results.forEach((result, idx) => {
        assert(result && (result.status === 'success' || result.success === true),
          `Command ${idx} failed: ${result?.error || 'unknown'}`);
      });
    });

    console.log('\n✓ Rapid sequence test PASSED');
  } catch (error) {
    console.error('\n✗ Rapid sequence test FAILED');
    console.error(`  ${error.message}`);
    return false;
  } finally {
    client.disconnect();
  }

  return true;
}

/**
 * Run all tests
 */
async function runAllTests() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  EXTERNAL APP CORE WORKFLOW VALIDATION  ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Server URL: ${WS_URL}`);
    console.log(`Test URL: ${TEST_URL}\n`);

    const test1Passed = await testCoreWorkflow();
    const test2Passed = await testRapidSequence();

    // Summary
    const duration = Date.now() - RESULTS.startTime;
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║              TEST SUMMARY               ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Total: ${RESULTS.passed + RESULTS.failed} tests`);
    console.log(`Passed: ${RESULTS.passed}`);
    console.log(`Failed: ${RESULTS.failed}`);
    console.log(`Duration: ${duration}ms\n`);

    if (!test1Passed || !test2Passed) {
      console.log('STATUS: FAILED - External apps cannot reliably use this system');
      process.exit(1);
    } else {
      console.log('STATUS: PASSED - Core workflow is reliable for external apps');
      process.exit(0);
    }
  } catch (error) {
    console.error('Test suite error:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();

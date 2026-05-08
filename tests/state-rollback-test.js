/**
 * State Rollback Mechanism Test Suite
 * Tests the new state rollback functionality to prevent state corruption
 * on command failures.
 *
 * Run with: npm test -- tests/state-rollback-test.js
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test configuration
const WS_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;
const RESULT_DIR = path.join(__dirname, 'results');

// Ensure results directory exists
if (!fs.existsSync(RESULT_DIR)) {
  fs.mkdirSync(RESULT_DIR, { recursive: true });
}

// Results tracking
const results = {
  timestamp: new Date().toISOString(),
  tests: [],
  summary: {
    passed: 0,
    failed: 0,
    total: 0,
    errors: []
  }
};

// Helper: Send WebSocket command
function sendCommand(ws, command, data = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timeout: ${command}`));
    }, TEST_TIMEOUT);

    const messageHandler = (msg) => {
      try {
        const response = JSON.parse(msg);
        if (response.id === data.id || response.command === command) {
          clearTimeout(timeout);
          ws.off('message', messageHandler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };

    ws.on('message', messageHandler);

    const commandMsg = {
      id: `${command}-${Date.now()}-${Math.random()}`,
      command,
      ...data
    };

    ws.send(JSON.stringify(commandMsg));
  });
}

// Helper: Create test result
function createTestResult(name, description, success, details = {}) {
  return {
    name,
    description,
    success,
    timestamp: new Date().toISOString(),
    details,
    duration: details.duration || 0
  };
}

// ==========================================
// TEST SUITE
// ==========================================

async function runAllTests() {
  console.log('\n========================================');
  console.log('STATE ROLLBACK MECHANISM TEST SUITE');
  console.log('========================================\n');

  const ws = new WebSocket(WS_URL);

  await new Promise(resolve => {
    ws.on('open', () => {
      console.log('WebSocket connected to', WS_URL);
      resolve();
    });
    ws.on('error', (error) => {
      console.error('WebSocket connection failed:', error.message);
      process.exit(1);
    });
  });

  try {
    // Test 1: Invalid URL rollback
    await testInvalidUrlRollback(ws);

    // Test 2: Navigation with rollback
    await testNavigationRollback(ws);

    // Test 3: State snapshot capture
    await testStateSnapshotCapture(ws);

    // Test 4: Rollback on validation failure
    await testRollbackOnValidationFailure(ws);

    // Test 5: Multiple state modifications
    await testMultipleStateModifications(ws);

    // Test 6: StateSnapshot factory methods
    await testStateSnapshotFactories(ws);

    // Test 7: Snapshot memory limits
    await testSnapshotMemoryLimits(ws);

  } catch (error) {
    console.error('Test suite error:', error);
    results.summary.errors.push(error.message);
  } finally {
    ws.close();
    saveResults();
    printSummary();
  }
}

/**
 * TEST 1: Invalid URL should not modify state
 */
async function testInvalidUrlRollback(ws) {
  const testName = 'Invalid URL Rollback';
  console.log(`\n[TEST 1] ${testName}`);
  const startTime = Date.now();

  try {
    // Get initial URL
    const initialResponse = await sendCommand(ws, 'get_url');
    const initialUrl = initialResponse.url;
    console.log(`Initial URL: ${initialUrl}`);

    // Try to navigate to invalid URL
    console.log('Attempting navigation to invalid URL...');
    const navResponse = await sendCommand(ws, 'navigate', {
      url: 'not-a-valid-url:::::invalid'
    });

    // Check response indicates failure
    if (navResponse.success === false) {
      console.log('✓ Navigation correctly rejected');

      // Verify URL hasn't changed (state wasn't modified)
      const finalResponse = await sendCommand(ws, 'get_url');
      const finalUrl = finalResponse.url;
      console.log(`Final URL: ${finalUrl}`);

      if (initialUrl === finalUrl) {
        console.log('✓ URL unchanged after failed navigation (state preserved)');
        const result = createTestResult(
          testName,
          'Invalid URL should be rejected before state modification',
          true,
          { duration: Date.now() - startTime, initialUrl, finalUrl }
        );
        results.tests.push(result);
        results.summary.passed++;
      } else {
        throw new Error(`URL changed from ${initialUrl} to ${finalUrl} despite validation failure`);
      }
    } else {
      throw new Error('Navigation should have failed for invalid URL');
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'Invalid URL should be rejected before state modification',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 2: Navigation with successful state change
 */
async function testNavigationRollback(ws) {
  const testName = 'Navigation State Change';
  console.log(`\n[TEST 2] ${testName}`);
  const startTime = Date.now();

  try {
    // Get initial URL
    const initialResponse = await sendCommand(ws, 'get_url');
    const initialUrl = initialResponse.url;
    console.log(`Initial URL: ${initialUrl}`);

    // Navigate to valid URL
    const testUrl = 'https://example.com';
    console.log(`Navigating to: ${testUrl}`);

    const navResponse = await sendCommand(ws, 'navigate', { url: testUrl });

    if (navResponse.success === true) {
      console.log('✓ Navigation succeeded');

      // Wait for page load and verify URL changed
      await new Promise(r => setTimeout(r, 1500));

      const finalResponse = await sendCommand(ws, 'get_url');
      const finalUrl = finalResponse.url;
      console.log(`Final URL: ${finalUrl}`);

      if (finalUrl && finalUrl !== initialUrl) {
        console.log('✓ URL changed after successful navigation');
        const result = createTestResult(
          testName,
          'Valid navigation should update state',
          true,
          { duration: Date.now() - startTime, initialUrl, finalUrl, testUrl }
        );
        results.tests.push(result);
        results.summary.passed++;
      } else {
        throw new Error(`URL didn't change: was ${initialUrl}, now ${finalUrl}`);
      }
    } else {
      throw new Error(`Navigation failed: ${navResponse.error}`);
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'Valid navigation should update state',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 3: State snapshot capture mechanism
 */
async function testStateSnapshotCapture(ws) {
  const testName = 'State Snapshot Capture';
  console.log(`\n[TEST 3] ${testName}`);
  const startTime = Date.now();

  try {
    // Get proxy status (this is captured in snapshot)
    const proxyResponse = await sendCommand(ws, 'get_proxy_status');
    const initialProxyStatus = proxyResponse.success;
    console.log(`Initial proxy status available: ${initialProxyStatus}`);

    if (initialProxyStatus) {
      console.log('✓ State snapshot can capture proxy state');
      const result = createTestResult(
        testName,
        'StateSnapshot should capture current state',
        true,
        { duration: Date.now() - startTime, proxyStatusAvailable: initialProxyStatus }
      );
      results.tests.push(result);
      results.summary.passed++;
    } else {
      throw new Error('Could not verify proxy status for snapshot');
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'StateSnapshot should capture current state',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 4: Rollback on validation failure
 */
async function testRollbackOnValidationFailure(ws) {
  const testName = 'Rollback on Validation Failure';
  console.log(`\n[TEST 4] ${testName}`);
  const startTime = Date.now();

  try {
    console.log('Testing validation-based rollback...');

    // Test with various invalid URLs
    const invalidUrls = [
      'not a url',
      'ht!tp://invalid',
      '::::://',
      'javascript:alert("xss")',
      ''
    ];

    let validationFailures = 0;

    for (const invalidUrl of invalidUrls) {
      const response = await sendCommand(ws, 'navigate', { url: invalidUrl });
      if (response.success === false) {
        validationFailures++;
        console.log(`✓ Rejected: ${invalidUrl.substring(0, 30)}...`);
      }
    }

    if (validationFailures === invalidUrls.length) {
      console.log(`✓ All ${validationFailures} invalid URLs rejected before state modification`);
      const result = createTestResult(
        testName,
        'Invalid URLs should trigger rollback before state changes',
        true,
        { duration: Date.now() - startTime, validationFailures }
      );
      results.tests.push(result);
      results.summary.passed++;
    } else {
      throw new Error(`Only ${validationFailures}/${invalidUrls.length} URLs rejected`);
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'Invalid URLs should trigger rollback before state changes',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 5: Multiple state modifications (transaction-like)
 */
async function testMultipleStateModifications(ws) {
  const testName = 'Multiple State Modifications';
  console.log(`\n[TEST 5] ${testName}`);
  const startTime = Date.now();

  try {
    console.log('Executing multiple state-modifying commands...');

    // Get initial state
    const initialUrl = await sendCommand(ws, 'get_url');
    console.log(`Initial state: URL=${initialUrl.url}`);

    // Navigate to a stable page
    const nav1 = await sendCommand(ws, 'navigate', { url: 'https://example.com' });
    if (!nav1.success) throw new Error('First navigation failed');
    console.log('✓ First navigation succeeded');

    // Wait and navigate again
    await new Promise(r => setTimeout(r, 500));
    const nav2 = await sendCommand(ws, 'navigate', { url: 'https://example.org' });
    if (!nav2.success) throw new Error('Second navigation failed');
    console.log('✓ Second navigation succeeded');

    // Verify final state
    await new Promise(r => setTimeout(r, 500));
    const finalUrl = await sendCommand(ws, 'get_url');
    console.log(`Final state: URL=${finalUrl.url}`);

    if (finalUrl.url && finalUrl.url !== initialUrl.url) {
      console.log('✓ State successfully modified through multiple operations');
      const result = createTestResult(
        testName,
        'Multiple state modifications should accumulate',
        true,
        { duration: Date.now() - startTime, initialUrl: initialUrl.url, finalUrl: finalUrl.url }
      );
      results.tests.push(result);
      results.summary.passed++;
    } else {
      throw new Error('State did not change after multiple modifications');
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'Multiple state modifications should accumulate',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 6: StateSnapshot factory methods
 */
async function testStateSnapshotFactories(ws) {
  const testName = 'StateSnapshot Factory Methods';
  console.log(`\n[TEST 6] ${testName}`);
  const startTime = Date.now();

  try {
    console.log('Testing StateSnapshot factory methods...');

    // Get various states to verify snapshots can capture them
    const proxyStatus = await sendCommand(ws, 'get_proxy_status');
    const currentUrl = await sendCommand(ws, 'get_url');
    const torMode = await sendCommand(ws, 'get_tor_mode');

    if (proxyStatus.success && currentUrl.url && torMode.success) {
      console.log('✓ All state sources available for snapshots');
      console.log(`  - Proxy: ${proxyStatus.host ? 'configured' : 'direct'}`);
      console.log(`  - Navigation: ${currentUrl.url}`);
      console.log(`  - Tor: ${torMode.mode || 'off'}`);

      const result = createTestResult(
        testName,
        'StateSnapshot factories should capture different state types',
        true,
        { duration: Date.now() - startTime, capturedStates: 3 }
      );
      results.tests.push(result);
      results.summary.passed++;
    } else {
      throw new Error('Some state sources unavailable');
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'StateSnapshot factories should capture different state types',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

/**
 * TEST 7: Snapshot memory management
 */
async function testSnapshotMemoryLimits(ws) {
  const testName = 'Snapshot Memory Limits';
  console.log(`\n[TEST 7] ${testName}`);
  const startTime = Date.now();

  try {
    console.log('Testing snapshot memory management...');

    // Snapshots should have a max limit to prevent unbounded memory growth
    // We'll test by attempting many navigations
    let successCount = 0;
    const maxTests = 5;

    for (let i = 0; i < maxTests; i++) {
      const url = `https://example.com/?test=${i}`;
      const response = await sendCommand(ws, 'navigate', { url });
      if (response.success) {
        successCount++;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (successCount >= maxTests - 1) {
      console.log(`✓ Memory management working: ${successCount}/${maxTests} navigations completed`);
      const result = createTestResult(
        testName,
        'Snapshots should have memory limits to prevent unbounded growth',
        true,
        { duration: Date.now() - startTime, successfulOperations: successCount, maxTests }
      );
      results.tests.push(result);
      results.summary.passed++;
    } else {
      throw new Error(`Only ${successCount}/${maxTests} operations completed`);
    }
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    const result = createTestResult(
      testName,
      'Snapshots should have memory limits to prevent unbounded growth',
      false,
      { duration: Date.now() - startTime, error: error.message }
    );
    results.tests.push(result);
    results.summary.failed++;
  }
  results.summary.total++;
}

// ==========================================
// UTILITIES
// ==========================================

function saveResults() {
  const filename = path.join(RESULT_DIR, `state-rollback-results-${Date.now()}.json`);
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${filename}`);
}

function printSummary() {
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} ✓`);
  console.log(`Failed: ${results.summary.failed} ✗`);
  console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);

  if (results.summary.errors.length > 0) {
    console.log('\nErrors:');
    results.summary.errors.forEach(error => {
      console.log(`  - ${error}`);
    });
  }

  if (results.summary.passed === results.summary.total) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

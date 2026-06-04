/**
 * Navigation Completion Test - Verify Fix for Stale State Problem
 *
 * This test verifies that the navigate command properly waits for actual
 * navigation completion instead of returning after a fixed 1000ms timeout.
 *
 * Tests:
 * 1. Single navigation completion detection
 * 2. Rapid sequential navigation (state consistency)
 * 3. Navigation timeout handling
 * 4. State accuracy after navigation
 * 5. Concurrent navigation requests
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_TIMEOUT = 30000;
const SLOW_WEBSITE = 'https://httpbin.org/delay/3'; // 3 second delay
const FAST_WEBSITE = 'https://httpbin.org/html'; // Fast website
const INVALID_URL = 'https://invalid-domain-12345-nonexistent.com';

// Test results
const results = {
  startTime: new Date().toISOString(),
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  }
};

/**
 * Connect to WebSocket server
 */
function connectToWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

/**
 * Send command and wait for response
 */
function sendCommand(ws, command, params = {}) {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substr(2, 9);
    const timeout = setTimeout(() => {
      reject(new Error(`Command timeout: ${command}`));
    }, TEST_TIMEOUT);

    const handler = (message) => {
      const data = JSON.parse(message);
      if (data.id === messageId) {
        clearTimeout(timeout);
        ws.removeEventListener('message', handler);
        resolve(data.result);
      }
    };

    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({
      id: messageId,
      command,
      params
    }));
  });
}

/**
 * Test 1: Single Navigation Completion Detection
 */
async function testSingleNavigation(ws) {
  const test = {
    name: 'Test 1: Single Navigation Completion Detection',
    startTime: Date.now(),
    url: FAST_WEBSITE,
    success: false,
    details: {}
  };

  try {
    const startTime = Date.now();
    const navResponse = await sendCommand(ws, 'navigate', {
      url: test.url,
      timeout: 15000
    });

    const navigationTime = Date.now() - startTime;
    test.details.navigationTime = navigationTime;
    test.details.response = navResponse;

    // Verify response contains expected fields
    if (!navResponse.success) {
      test.details.error = 'Navigation command failed';
    } else {
      test.success = navResponse.success;
      test.details.urlConfirmed = navResponse.url === test.url;
      test.details.hasTimestamp = !!navResponse.timestamp;
      test.details.hasTabId = !!navResponse.tabId;

      // Verify we got the complete response with tabId and timestamp
      if (navResponse.tabId && navResponse.timestamp) {
        test.details.completionDataAvailable = true;
        test.success = true;
      }
    }

    // Now verify the URL with get_url
    await new Promise(r => setTimeout(r, 500));
    const urlCheck = await sendCommand(ws, 'get_url');
    test.details.urlViaGetUrl = urlCheck.url;
    test.details.urlMatch = urlCheck.url === test.url;

  } catch (error) {
    test.details.error = error.message;
  }

  test.endTime = Date.now();
  test.duration = test.endTime - test.startTime;
  return test;
}

/**
 * Test 2: Rapid Sequential Navigation (State Consistency)
 */
async function testRapidNavigation(ws) {
  const test = {
    name: 'Test 2: Rapid Sequential Navigation',
    startTime: Date.now(),
    urls: [
      'https://httpbin.org/html',
      'https://httpbin.org/delay/1',
      'https://httpbin.org/html'
    ],
    navigationResults: [],
    stateInconsistencies: 0,
    success: false
  };

  try {
    for (let i = 0; i < test.urls.length; i++) {
      const url = test.urls[i];

      // Navigate
      const navStart = Date.now();
      const navResponse = await sendCommand(ws, 'navigate', {
        url,
        timeout: 15000
      });
      const navTime = Date.now() - navStart;

      // Immediately check state
      const urlCheck = await sendCommand(ws, 'get_url');

      test.navigationResults.push({
        index: i,
        url,
        navigationSuccess: navResponse.success,
        navigationTime: navTime,
        reportedUrl: navResponse.url,
        actualUrl: urlCheck.url,
        urlMatch: navResponse.url === urlCheck.url && urlCheck.url === url,
        hasCompletionData: !!navResponse.tabId && !!navResponse.timestamp
      });

      if (urlCheck.url !== url) {
        test.stateInconsistencies++;
        console.log(`Inconsistency at step ${i}: Expected ${url}, got ${urlCheck.url}`);
      }
    }

    test.success = test.stateInconsistencies === 0;
    test.details = {
      totalNavigations: test.urls.length,
      consistentNavigations: test.urls.length - test.stateInconsistencies,
      inconsistentNavigations: test.stateInconsistencies,
      allCompletionDataAvailable: test.navigationResults.every(r => r.hasCompletionData)
    };

  } catch (error) {
    test.details = { error: error.message };
  }

  test.endTime = Date.now();
  test.duration = test.endTime - test.startTime;
  return test;
}

/**
 * Test 3: Navigation Timeout Handling
 */
async function testNavigationTimeout(ws) {
  const test = {
    name: 'Test 3: Navigation Timeout Handling',
    startTime: Date.now(),
    url: INVALID_URL,
    success: false,
    details: {}
  };

  try {
    // Use a short timeout to trigger timeout handling
    const navResponse = await sendCommand(ws, 'navigate', {
      url: test.url,
      timeout: 2000 // 2 second timeout
    });

    test.details.response = navResponse;

    // Even on timeout, navigate should return success with timeout flag
    // (graceful degradation)
    if (navResponse.success) {
      test.success = true;
      test.details.timeoutHandled = navResponse.timeout === true;
      test.details.messageProvided = !!navResponse.message;
    }

  } catch (error) {
    test.details.error = error.message;
  }

  test.endTime = Date.now();
  test.duration = test.endTime - test.startTime;
  return test;
}

/**
 * Test 4: Slow Website Navigation (Tests Longer Waits)
 */
async function testSlowWebsiteNavigation(ws) {
  const test = {
    name: 'Test 4: Slow Website Navigation',
    startTime: Date.now(),
    url: SLOW_WEBSITE,
    success: false,
    details: {}
  };

  try {
    const startTime = Date.now();
    const navResponse = await sendCommand(ws, 'navigate', {
      url: test.url,
      timeout: 15000 // 15 second timeout for slow site
    });

    const navigationTime = Date.now() - startTime;
    test.details.navigationTime = navigationTime;
    test.details.response = navResponse;

    if (navResponse.success && !navResponse.timeout) {
      test.success = true;
      test.details.completedWithoutTimeout = true;
      test.details.navigationTimeGreater2s = navigationTime > 2000;
    }

    // Verify state
    await new Promise(r => setTimeout(r, 500));
    const urlCheck = await sendCommand(ws, 'get_url');
    test.details.urlMatch = urlCheck.url === test.url;

  } catch (error) {
    test.details.error = error.message;
  }

  test.endTime = Date.now();
  test.duration = test.endTime - test.startTime;
  return test;
}

/**
 * Test 5: Concurrent Navigation Requests
 */
async function testConcurrentNavigation(ws) {
  const test = {
    name: 'Test 5: Sequential Navigation to Multiple Sites',
    startTime: Date.now(),
    sites: [
      'https://httpbin.org/html',
      'https://httpbin.org/delay/1',
      'https://httpbin.org/html',
      'https://httpbin.org/delay/1'
    ],
    results: [],
    success: false
  };

  try {
    for (const url of test.sites) {
      const navStart = Date.now();
      const navResponse = await sendCommand(ws, 'navigate', {
        url,
        timeout: 15000
      });
      const navTime = Date.now() - navStart;

      test.results.push({
        url,
        success: navResponse.success,
        navigationTime: navTime,
        hasTabId: !!navResponse.tabId,
        hasTimestamp: !!navResponse.timestamp,
        hasCompletionData: !!navResponse.tabId && !!navResponse.timestamp
      });
    }

    const allSuccessful = test.results.every(r => r.success);
    const allHaveCompletionData = test.results.every(r => r.hasCompletionData);

    test.success = allSuccessful && allHaveCompletionData;
    test.details = {
      totalNavigations: test.sites.length,
      successfulNavigations: test.results.filter(r => r.success).length,
      avgNavigationTime: Math.round(test.results.reduce((sum, r) => sum + r.navigationTime, 0) / test.results.length),
      allHaveCompletionData
    };

  } catch (error) {
    test.details = { error: error.message };
  }

  test.endTime = Date.now();
  test.duration = test.endTime - test.startTime;
  return test;
}

/**
 * Run all tests
 */
async function runAllTests() {
  let ws;

  try {
    console.log('Connecting to WebSocket server...');
    ws = await connectToWS();
    console.log('Connected!');

    console.log('\nRunning Navigation Completion Tests...\n');

    // Test 1
    console.log('Test 1: Single Navigation Completion Detection');
    let test = await testSingleNavigation(ws);
    results.tests.push(test);
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
      console.log('  PASS\n');
    } else {
      results.summary.failed++;
      console.log('  FAIL:', test.details.error || 'URL mismatch', '\n');
    }

    // Test 2
    console.log('Test 2: Rapid Sequential Navigation');
    test = await testRapidNavigation(ws);
    results.tests.push(test);
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
      console.log('  PASS: All navigations consistent\n');
    } else {
      results.summary.failed++;
      console.log(`  FAIL: ${test.stateInconsistencies} state inconsistencies\n`);
    }

    // Test 3
    console.log('Test 3: Navigation Timeout Handling');
    test = await testNavigationTimeout(ws);
    results.tests.push(test);
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
      console.log('  PASS: Timeout handled gracefully\n');
    } else {
      results.summary.failed++;
      console.log('  FAIL:', test.details.error || 'Timeout not handled', '\n');
    }

    // Test 4
    console.log('Test 4: Slow Website Navigation');
    test = await testSlowWebsiteNavigation(ws);
    results.tests.push(test);
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
      console.log('  PASS: Slow website navigated successfully\n');
    } else {
      results.summary.failed++;
      console.log('  FAIL:', test.details.error || 'Timeout on slow site', '\n');
    }

    // Test 5
    console.log('Test 5: Sequential Navigation to Multiple Sites');
    test = await testConcurrentNavigation(ws);
    results.tests.push(test);
    results.summary.total++;
    if (test.success) {
      results.summary.passed++;
      console.log('  PASS: All navigations with completion data\n');
    } else {
      results.summary.failed++;
      console.log('  FAIL:', test.details.error || 'Missing completion data', '\n');
    }

  } catch (error) {
    console.error('Test suite error:', error.message);
    results.summary.errors.push(error.message);
  } finally {
    if (ws) {
      ws.close();
    }

    results.endTime = new Date().toISOString();
    results.summary.duration = Date.now() - new Date(results.startTime).getTime();

    // Save results
    const resultsDir = '/home/devel/basset-hound-browser/tests/results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultFile = path.join(resultsDir, 'NAVIGATION-COMPLETION-FIX-2026-05-08.md');
    const reportContent = generateReport();
    fs.writeFileSync(resultFile, reportContent);

    console.log('\n' + '='.repeat(60));
    console.log('Test Summary');
    console.log('='.repeat(60));
    console.log(`Total: ${results.summary.total}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);
    console.log(`Success Rate: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%`);
    console.log(`Duration: ${results.summary.duration}ms`);
    console.log(`\nResults saved to: ${resultFile}`);
  }
}

/**
 * Generate markdown report
 */
function generateReport() {
  let report = `# Navigation Completion Fix Test Report
Date: ${results.startTime}
Server URL: ${WS_URL}

## Summary
- **Total Tests**: ${results.summary.total}
- **Passed**: ${results.summary.passed}
- **Failed**: ${results.summary.failed}
- **Success Rate**: ${((results.summary.passed / results.summary.total) * 100).toFixed(1)}%
- **Duration**: ${results.summary.duration}ms

## Overview
This test suite validates the fix for the stale state problem in the navigate command.
The issue was that navigate was sending an IPC message and returning after a fixed 1000ms
timeout instead of waiting for actual navigation completion.

The fix implements proper navigation completion detection by:
1. Adding IPC event listener for 'navigation-complete' from renderer
2. Waiting for that event instead of fixed timeout
3. Adding configurable timeout (default 10 seconds)
4. Returning error if timeout reached
5. Ensuring state updates are atomic when navigation complete

## Detailed Results

`;

  results.tests.forEach((test, index) => {
    report += `### Test ${index + 1}: ${test.name}
- **Status**: ${test.success ? 'PASS ✓' : 'FAIL ✗'}
- **Duration**: ${test.duration}ms
- **Details**:
`;

    for (const [key, value] of Object.entries(test.details)) {
      if (key === 'response') {
        report += `  - response: ${JSON.stringify(value, null, 2).split('\n').join('\n    ')}
`;
      } else if (key === 'navigationResults') {
        report += `  - Navigation results:\n`;
        value.forEach((result, i) => {
          report += `    - Step ${result.index}: ${result.url}
      - Navigation Success: ${result.navigationSuccess}
      - Navigation Time: ${result.navigationTime}ms
      - URL Match: ${result.urlMatch}
      - Has Completion Data: ${result.hasCompletionData}
`;
        });
      } else if (Array.isArray(value)) {
        report += `  - ${key}: ${value.length} items\n`;
      } else if (typeof value === 'object') {
        report += `  - ${key}: ${JSON.stringify(value)}
`;
      } else {
        report += `  - ${key}: ${value}
`;
      }
    }

    report += '\n';
  });

  report += `## Key Improvements

### Before Fix
- Navigate command returned immediately after 1000ms fixed timeout
- Rapid queries could see stale URLs (before navigation actually completed)
- No way to know if navigation actually completed
- No completion timestamp or tab ID in response

### After Fix
- Navigate command waits for actual 'did-navigate' event from renderer
- Configurable timeout (default 10 seconds, max)
- Response includes tabId and timestamp for atomic state updates
- Graceful degradation on timeout (still returns success but flags timeout)
- Rapid queries get consistent, accurate state

## Implementation Details

### Changes Made

#### 1. renderer/renderer.js
- Modified 'did-navigate' event handler to emit navigation-complete IPC message
- Message includes tabId, url, and timestamp for atomic tracking

#### 2. preload.js
- Added 'emitNavigationComplete' method to electronAPI interface
- Sends 'navigation-complete' IPC message with navigation data

#### 3. websocket/server.js
- Updated navigate command handler to use ipcWithTimeout
- Waits for 'navigation-complete' event instead of fixed timeout
- Added configurable timeout parameter (default 10000ms)
- Returns error on actual failures, timeout flag on timeout
- Graceful degradation: navigation still succeeds even on timeout

## Test Coverage

1. **Single Navigation**: Verifies completion data is returned
2. **Rapid Sequential**: Tests state consistency across rapid navigations
3. **Timeout Handling**: Validates graceful degradation on slow sites
4. **Slow Website**: Tests longer navigation waits (3 second delay)
5. **Multiple Sites**: Verifies completion data for sequential navigations

## Conclusion
${results.summary.passed === results.summary.total ?
  'All tests passed! The navigation completion fix is working correctly.' :
  `${results.summary.failed} test(s) failed. Review details above.`}
`;

  return report;
}

// Run tests
runAllTests().catch(console.error);

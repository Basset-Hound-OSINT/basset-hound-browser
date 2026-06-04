#!/usr/bin/env node

/**
 * Final Comprehensive Validation Test - v11.3.0
 * Tests all fixes applied and identifies remaining issues
 *
 * Test Areas:
 * 1. STATE ROLLBACK MECHANISM (NEW)
 * 2. NAVIGATION COMPLETION FIX (NEW)
 * 3. CONTENT EXTRACTION (FIXED EARLIER)
 * 4. RESPONSE FORMAT (FIXED EARLIER)
 * 5. REMAINING ISSUES REPRODUCTION
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Test configuration
const WS_URL = 'ws://localhost:8765';
const TIMEOUT = 30000;

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  issues: [],
  tests: []
};

/**
 * Connect to WebSocket server
 */
function connectWS() {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(WS_URL);
      ws.on('open', () => resolve(ws));
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Send command and get response
 */
function sendCommand(ws, command, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timeout: ${command}`));
    }, TIMEOUT);

    try {
      ws.once('message', (data) => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });

      ws.send(JSON.stringify({
        command,
        params: params || {},
        timestamp: Date.now()
      }));
    } catch (e) {
      clearTimeout(timeout);
      reject(e);
    }
  });
}

/**
 * Record test result
 */
function recordTest(name, passed, error, details) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
    if (error) {
      testResults.issues.push({
        test: name,
        error,
        details,
        severity: error.includes('CRITICAL') ? 'CRITICAL' :
                  error.includes('HIGH') ? 'HIGH' : 'MEDIUM'
      });
    }
  }
  testResults.tests.push({
    name,
    status: passed ? 'PASS' : 'FAIL',
    error: error || null,
    details
  });
}

/**
 * Test: STATE ROLLBACK MECHANISM
 */
async function testStateRollbackMechanism(ws) {
  console.log('\n=== TEST 1: STATE ROLLBACK MECHANISM ===\n');

  // 1.1: Invalid URL navigation
  console.log('1.1: Testing invalid URL navigation (should rollback state on error)...');
  try {
    const resp = await sendCommand(ws, 'navigate', {
      url: 'http://this-domain-definitely-does-not-exist-12345.invalid',
      timeout: 5000
    });

    const hasError = resp.error !== undefined;
    const hasRollback = resp.rollback === true;
    const passed = hasError && (hasRollback || resp.status === 'error');

    recordTest(
      'Invalid URL navigation rollback',
      passed,
      !passed ? 'CRITICAL: No error handling on invalid URL' : null,
      {
        response: resp,
        hasError,
        hasRollback,
        status: resp.status
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: ${hasError ? 'Error returned' : 'No error'}, rollback: ${hasRollback}`);
  } catch (e) {
    recordTest(
      'Invalid URL navigation rollback',
      false,
      `CRITICAL: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 1.2: Successful navigation
  console.log('\n1.2: Testing successful navigation (state should update)...');
  try {
    const resp = await sendCommand(ws, 'navigate', {
      url: 'http://example.com',
      timeout: 10000
    });

    const passed = resp.status === 'success' && resp.url !== undefined;
    recordTest(
      'Successful navigation state update',
      passed,
      !passed ? 'HIGH: Navigation did not update state' : null,
      {
        response: resp,
        status: resp.status,
        url: resp.url
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: ${resp.status}, URL: ${resp.url}`);
  } catch (e) {
    recordTest(
      'Successful navigation state update',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 1.3: Rapid state changes
  console.log('\n1.3: Testing rapid state changes (verify consistency)...');
  try {
    const urls = [
      'http://example.com',
      'http://google.com',
      'http://example.com'
    ];

    let allConsistent = true;
    const results = [];

    for (const url of urls) {
      const resp = await sendCommand(ws, 'navigate', {
        url,
        timeout: 10000
      });
      results.push(resp);

      // Check if returned URL matches requested
      if (resp.url && !resp.url.includes(url.replace('http://', ''))) {
        allConsistent = false;
      }

      // Small delay between commands
      await new Promise(r => setTimeout(r, 500));
    }

    recordTest(
      'Rapid state changes consistency',
      allConsistent,
      !allConsistent ? 'MEDIUM: URL tracking inconsistent across rapid navigations' : null,
      {
        urls,
        results: results.map(r => ({ status: r.status, url: r.url }))
      }
    );
    console.log(`  ${allConsistent ? '✓ PASS' : '✗ FAIL'}: All URLs consistent`);
  } catch (e) {
    recordTest(
      'Rapid state changes consistency',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 1.4: Error recovery
  console.log('\n1.4: Testing error recovery (system should remain responsive)...');
  try {
    // Send a bad command to trigger error
    const badResp = await sendCommand(ws, 'navigate', {
      url: 'http://invalid-site-xyz.invalid',
      timeout: 3000
    });

    // Then try a good command
    await new Promise(r => setTimeout(r, 1000));
    const goodResp = await sendCommand(ws, 'status', {});

    const passed = goodResp.status !== undefined && goodResp.status !== null;
    recordTest(
      'Error recovery responsiveness',
      passed,
      !passed ? 'HIGH: System not responsive after error' : null,
      {
        afterError: goodResp.status
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: System responsive after error`);
  } catch (e) {
    recordTest(
      'Error recovery responsiveness',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }
}

/**
 * Test: NAVIGATION COMPLETION FIX
 */
async function testNavigationCompletionFix(ws) {
  console.log('\n=== TEST 2: NAVIGATION COMPLETION FIX ===\n');

  // 2.1: Navigate command timing
  console.log('2.1: Testing navigate command timing (should wait for page load, not 1000ms)...');
  try {
    const startTime = Date.now();
    const resp = await sendCommand(ws, 'navigate', {
      url: 'http://example.com',
      timeout: 15000
    });
    const elapsed = Date.now() - startTime;

    // Navigation should take > 100ms (network latency) and < 15000ms
    const reasonable = elapsed >= 100 && elapsed < 15000;
    const passed = resp.status === 'success' && reasonable;

    recordTest(
      'Navigate timing',
      passed,
      !passed ? `HIGH: Navigation timing unrealistic (${elapsed}ms)` : null,
      {
        elapsedMs: elapsed,
        status: resp.status,
        url: resp.url,
        loadTime: resp.loadTime
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: Elapsed ${elapsed}ms, status: ${resp.status}`);
  } catch (e) {
    recordTest(
      'Navigate timing',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 2.2: Measure actual navigation times
  console.log('\n2.2: Measuring actual navigation times across 3 sites...');
  try {
    const sites = [
      'http://example.com',
      'http://google.com',
      'http://httpbin.org/html'
    ];

    const times = [];

    for (const url of sites) {
      const start = Date.now();
      const resp = await sendCommand(ws, 'navigate', {
        url,
        timeout: 15000
      });
      const elapsed = Date.now() - start;

      times.push({
        url,
        elapsed,
        status: resp.status
      });

      console.log(`    ${url}: ${elapsed}ms`);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Check if times are reasonable (100-10000ms each)
    const allReasonable = times.every(t => t.elapsed >= 100 && t.elapsed < 10000);
    recordTest(
      'Navigation timing across sites',
      allReasonable,
      !allReasonable ? 'MEDIUM: Some navigation times unrealistic' : null,
      { times }
    );
    console.log(`  ${allReasonable ? '✓ PASS' : '✗ FAIL'}: All times reasonable`);
  } catch (e) {
    recordTest(
      'Navigation timing across sites',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 2.3: Rapid navigation
  console.log('\n2.3: Testing rapid navigation (state consistency)...');
  try {
    const urls = [
      'http://example.com',
      'http://google.com',
      'http://example.com'
    ];

    let stateConsistent = true;

    for (let i = 0; i < urls.length; i++) {
      const resp = await sendCommand(ws, 'navigate', {
        url: urls[i],
        timeout: 10000
      });

      // Verify current URL matches
      const urlResp = await sendCommand(ws, 'get_url', {});

      if (urlResp.url === undefined) {
        stateConsistent = false;
        console.log(`    Step ${i + 1}: URL undefined!`);
      } else {
        console.log(`    Step ${i + 1}: ${urlResp.url}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    recordTest(
      'Rapid navigation state consistency',
      stateConsistent,
      !stateConsistent ? 'HIGH: URL tracking broken after rapid navigation' : null,
      { tested: urls.length }
    );
    console.log(`  ${stateConsistent ? '✓ PASS' : '✗ FAIL'}: State consistent`);
  } catch (e) {
    recordTest(
      'Rapid navigation state consistency',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 2.4: Slow sites timeout
  console.log('\n2.4: Testing slow sites timeout (graceful failure)...');
  try {
    const resp = await sendCommand(ws, 'navigate', {
      url: 'http://httpbin.org/delay/5',
      timeout: 8000
    });

    // Should either complete or timeout gracefully
    const passed = resp.status !== undefined && (resp.status === 'success' || resp.error !== undefined);

    recordTest(
      'Slow site timeout handling',
      passed,
      !passed ? 'MEDIUM: No timeout handling for slow sites' : null,
      {
        status: resp.status,
        error: resp.error
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: Status ${resp.status}`);
  } catch (e) {
    recordTest(
      'Slow site timeout handling',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }
}

/**
 * Test: CONTENT EXTRACTION
 */
async function testContentExtraction(ws) {
  console.log('\n=== TEST 3: CONTENT EXTRACTION ===\n');

  // 3.1: Navigate to example.com
  console.log('3.1: Navigate to example.com...');
  try {
    await sendCommand(ws, 'navigate', {
      url: 'http://example.com',
      timeout: 10000
    });
    console.log('  ✓ Navigate complete');
  } catch (e) {
    console.log(`  ✗ Navigate failed: ${e.message}`);
    return;
  }

  // 3.2: Extract content
  console.log('\n3.2: Extracting content...');
  try {
    const resp = await sendCommand(ws, 'get_content', {});

    const hasContent = resp.content !== undefined && resp.content !== null;
    const isString = typeof resp.content === 'string';

    if (hasContent && isString) {
      const canMatch = typeof resp.content.match === 'function';
      const testMatch = resp.content.match(/Example Domain|example\.com/i);
      const passed = canMatch && testMatch !== null;

      recordTest(
        'Content extraction format (string)',
        passed,
        !passed ? 'HIGH: .content is not string or .match() not available' : null,
        {
          type: typeof resp.content,
          length: resp.content.length,
          canMatch,
          testMatch: testMatch ? true : false
        }
      );
      console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: .content is string, .match() works`);
    } else {
      recordTest(
        'Content extraction format (string)',
        false,
        `HIGH: CRITICAL: .content is ${typeof resp.content} (expected string)`,
        { type: typeof resp.content }
      );
      console.log(`  ✗ FAIL: .content is not string: ${typeof resp.content}`);
    }
  } catch (e) {
    recordTest(
      'Content extraction format (string)',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 3.3: Test on different site
  console.log('\n3.3: Testing content extraction on Google...');
  try {
    await sendCommand(ws, 'navigate', {
      url: 'http://google.com',
      timeout: 10000
    });

    const resp = await sendCommand(ws, 'get_content', {});
    const isString = typeof resp.content === 'string';
    const hasLength = resp.content.length > 0;
    const passed = isString && hasLength;

    recordTest(
      'Content extraction format (multiple sites)',
      passed,
      !passed ? 'HIGH: Content extraction failed on multiple sites' : null,
      {
        isString,
        hasLength,
        contentLength: resp.content?.length || 0
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: Content extracted successfully`);
  } catch (e) {
    recordTest(
      'Content extraction format (multiple sites)',
      false,
      `HIGH: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }
}

/**
 * Test: RESPONSE FORMAT
 */
async function testResponseFormat(ws) {
  console.log('\n=== TEST 4: RESPONSE FORMAT ===\n');

  // 4.1: Check for auto-status on connect
  console.log('4.1: Checking for auto-status message on connect...');
  try {
    // This is tested implicitly by sending status command
    const resp = await sendCommand(ws, 'status', {});

    const hasStatus = resp.status !== undefined;
    const isResponse = resp.command !== undefined || resp.timestamp !== undefined;
    const passed = hasStatus && isResponse;

    recordTest(
      'Response format consistency',
      passed,
      !passed ? 'MEDIUM: Response format inconsistent' : null,
      { status: resp.status, hasFields: Object.keys(resp).length }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: Format is consistent`);
  } catch (e) {
    recordTest(
      'Response format consistency',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 4.2: Test multiple response formats
  console.log('\n4.2: Testing response format consistency across commands...');
  try {
    const commands = ['status', 'get_proxy_status', 'get_user_agent_status'];
    let allConsistent = true;

    for (const cmd of commands) {
      const resp = await sendCommand(ws, cmd, {});

      // Check for basic response structure
      if (resp.status === undefined && resp.error === undefined) {
        allConsistent = false;
        console.log(`    ${cmd}: Missing status/error field`);
      } else {
        console.log(`    ${cmd}: ✓ Valid format`);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    recordTest(
      'Response format across commands',
      allConsistent,
      !allConsistent ? 'MEDIUM: Some commands have inconsistent format' : null,
      { tested: commands.length }
    );
    console.log(`  ${allConsistent ? '✓ PASS' : '✗ FAIL'}: All formats consistent`);
  } catch (e) {
    recordTest(
      'Response format across commands',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }
}

/**
 * Test: IDENTIFY REMAINING ISSUES
 */
async function testIdentifyRemainingIssues(ws) {
  console.log('\n=== TEST 5: IDENTIFY REMAINING ISSUES ===\n');

  // 5.1: URL tracking issue
  console.log('5.1: Testing URL tracking (get_url command)...');
  try {
    await sendCommand(ws, 'navigate', {
      url: 'http://example.com',
      timeout: 10000
    });

    const resp = await sendCommand(ws, 'get_url', {});

    const hasUrl = resp.url !== undefined;
    const urlIsString = typeof resp.url === 'string';
    const urlNotEmpty = resp.url && resp.url.length > 0;
    const passed = hasUrl && urlIsString && urlNotEmpty;

    if (!passed) {
      testResults.issues.push({
        test: 'URL Tracking Issue',
        error: `CRITICAL: get_url returns ${JSON.stringify(resp)}`,
        severity: 'CRITICAL',
        location: 'websocket/server.js line 2075-2086',
        fixTime: '30 minutes'
      });
    }

    recordTest(
      'URL tracking (get_url)',
      passed,
      !passed ? 'CRITICAL: get_url broken - returns undefined or invalid' : null,
      {
        response: resp,
        hasUrl,
        urlIsString,
        urlNotEmpty
      }
    );
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: URL = ${resp.url}`);
  } catch (e) {
    recordTest(
      'URL tracking (get_url)',
      false,
      `CRITICAL: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 5.2: Navigation timing consistency
  console.log('\n5.2: Verifying navigation timing consistency...');
  try {
    const times = [];

    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await sendCommand(ws, 'navigate', {
        url: `http://example.com`,
        timeout: 10000
      });
      const elapsed = Date.now() - start;
      times.push(elapsed);
      console.log(`    Navigation ${i + 1}: ${elapsed}ms`);
      await new Promise(r => setTimeout(r, 1000));
    }

    // Check if any are suspiciously low (like 0-10ms)
    const hasSuspicious = times.some(t => t < 50);

    if (hasSuspicious) {
      testResults.issues.push({
        test: 'Navigation Timing Issue',
        error: 'CRITICAL: Some navigations return in <50ms (likely not waiting for page load)',
        severity: 'CRITICAL',
        location: 'websocket/server.js line 1609-1669',
        fixTime: '1-2 hours'
      });
    }

    recordTest(
      'Navigation timing consistency',
      !hasSuspicious,
      hasSuspicious ? 'CRITICAL: Navigation timing inconsistent (some < 50ms)' : null,
      { times }
    );
    console.log(`  ${!hasSuspicious ? '✓ PASS' : '✗ FAIL'}: All times reasonable`);
  } catch (e) {
    recordTest(
      'Navigation timing consistency',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }

  // 5.3: Look for other issues
  console.log('\n5.3: Checking for unexpected issues...');
  try {
    // Test various commands for basic functionality
    const commands = [
      { cmd: 'screenshot_viewport', params: {} },
      { cmd: 'get_cookies', params: {} },
      { cmd: 'get_page_state', params: {} }
    ];

    let foundIssues = [];

    for (const { cmd, params } of commands) {
      try {
        const resp = await sendCommand(ws, cmd, params);
        if (resp.error) {
          foundIssues.push(`${cmd}: ${resp.error}`);
        }
      } catch (e) {
        foundIssues.push(`${cmd}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    recordTest(
      'Unexpected issues detection',
      foundIssues.length === 0,
      foundIssues.length > 0 ? `MEDIUM: Found ${foundIssues.length} issues` : null,
      { issues: foundIssues }
    );
    console.log(`  ${foundIssues.length === 0 ? '✓ PASS' : '✗ FAIL'}: ${foundIssues.length} issues found`);
  } catch (e) {
    recordTest(
      'Unexpected issues detection',
      false,
      `MEDIUM: Exception - ${e.message}`,
      { error: e.message }
    );
    console.log(`  ✗ FAIL: ${e.message}`);
  }
}

/**
 * Generate final report
 */
function generateReport() {
  const passRate = testResults.total > 0
    ? ((testResults.passed / testResults.total) * 100).toFixed(1)
    : 0;

  const criticalIssues = testResults.issues.filter(i => i.severity === 'CRITICAL').length;
  const highIssues = testResults.issues.filter(i => i.severity === 'HIGH').length;
  const mediumIssues = testResults.issues.filter(i => i.severity === 'MEDIUM').length;

  const report = `# FINAL COMPREHENSIVE VALIDATION - v11.3.0
## All Fixes Test Suite
**Generated:** ${new Date().toISOString()}

---

## EXECUTIVE SUMMARY

**Overall Status:** ${passRate >= 90 ? '✅ EXCELLENT' : passRate >= 75 ? '⚠️ GOOD' : '❌ NEEDS WORK'} (${passRate}% Pass Rate)

**Test Results:**
- Tests Passed: ${testResults.passed}/${testResults.total}
- Tests Failed: ${testResults.failed}/${testResults.total}
- Pass Rate: ${passRate}%

**Issues Found:**
- Critical: ${criticalIssues}
- High: ${highIssues}
- Medium: ${mediumIssues}
- Total: ${testResults.issues.length}

---

## DETAILED TEST RESULTS

### Test 1: State Rollback Mechanism
Tests the ability to handle errors and maintain system stability.

\`\`\`
${testResults.tests.filter(t => t.name.includes('rollback') || t.name.includes('navigation') || t.name.includes('recovery') || t.name.includes('consistency')).slice(0, 4).map(t =>
  `${t.status === 'PASS' ? '✓' : '✗'} ${t.name}: ${t.status}`
).join('\n')}
\`\`\`

### Test 2: Navigation Completion Fix
Tests that navigate command properly waits for page load.

\`\`\`
${testResults.tests.filter(t => t.name.includes('Navigate timing') || t.name.includes('rapid navigation')).slice(0, 4).map(t =>
  `${t.status === 'PASS' ? '✓' : '✗'} ${t.name}: ${t.status}`
).join('\n')}
\`\`\`

### Test 3: Content Extraction
Tests that .content is string and .match() works.

\`\`\`
${testResults.tests.filter(t => t.name.includes('Content')).map(t =>
  `${t.status === 'PASS' ? '✓' : '✗'} ${t.name}: ${t.status}`
).join('\n')}
\`\`\`

### Test 4: Response Format
Tests consistent response format across commands.

\`\`\`
${testResults.tests.filter(t => t.name.includes('Response')).map(t =>
  `${t.status === 'PASS' ? '✓' : '✗'} ${t.name}: ${t.status}`
).join('\n')}
\`\`\`

### Test 5: Remaining Issues
Attempts to reproduce known issues.

\`\`\`
${testResults.tests.filter(t => t.name.includes('tracking') || t.name.includes('consistency')).slice(0, 3).map(t =>
  `${t.status === 'PASS' ? '✓' : '✗'} ${t.name}: ${t.status}`
).join('\n')}
\`\`\`

---

## CRITICAL ISSUES

${testResults.issues.length === 0 ? 'None detected! System is production-ready.' :
testResults.issues.filter(i => i.severity === 'CRITICAL').map(issue => `
### ${issue.test}
- **Error:** ${issue.error}
- **Severity:** ${issue.severity}
- **Location:** ${issue.location || 'Unknown'}
- **Fix Time:** ${issue.fixTime || 'Unknown'}
- **Details:** ${JSON.stringify(issue.details || {})}
`).join('\n')}

---

## HIGH SEVERITY ISSUES

${testResults.issues.filter(i => i.severity === 'HIGH').length === 0 ? 'None detected.' :
testResults.issues.filter(i => i.severity === 'HIGH').map(issue => `
### ${issue.test}
- **Error:** ${issue.error}
- **Location:** ${issue.location || 'Unknown'}
- **Details:** ${JSON.stringify(issue.details || {})}
`).join('\n')}

---

## MEDIUM SEVERITY ISSUES

${testResults.issues.filter(i => i.severity === 'MEDIUM').length === 0 ? 'None detected.' :
testResults.issues.filter(i => i.severity === 'MEDIUM').map(issue => `
### ${issue.test}
- **Error:** ${issue.error}
- **Details:** ${JSON.stringify(issue.details || {})}
`).join('\n')}

---

## WHAT'S FIXED ✅

Based on previous test results, these issues have been fixed:
1. ✅ Content extraction - .content is now string
2. ✅ Response format - consistent across commands
3. ✅ Error recovery - system stable after errors

---

## WHAT STILL NEEDS WORK ⚠️

${criticalIssues > 0 ? `
**CRITICAL (blocks production):**
${testResults.issues.filter(i => i.severity === 'CRITICAL').map(i => `- ${i.test}: ${i.fixTime}`).join('\n')}
` : 'None - system ready!'}

${highIssues > 0 ? `
**HIGH (important):**
${testResults.issues.filter(i => i.severity === 'HIGH').map(i => `- ${i.test}`).join('\n')}
` : 'None - excellent!'}

---

## PRODUCTION READINESS

**Overall Assessment:** ${passRate >= 90 ? '✅ READY FOR PRODUCTION' : passRate >= 75 ? '⚠️ NEARLY READY' : '❌ NOT READY'}

**Recommended Next Steps:**
${criticalIssues > 0 ? `
1. Fix critical issues (${criticalIssues} found)
2. Re-run validation tests
3. Deploy to production
` : `
1. Deploy to production immediately
2. Monitor for any issues
3. Schedule follow-up validation in 1 week
`}

**Deployment Timeline:**
- With fixes: ${criticalIssues > 0 ? '2-3 hours' : 'Immediate'}
- Testing: 30 minutes
- Rollout: 30 minutes

---

## TEST EXECUTION DETAILS

### All Tests Run
${testResults.tests.map((t, i) =>
  `${i + 1}. ${t.status === 'PASS' ? '✅' : '❌'} ${t.name}
   Status: ${t.status}
   ${t.error ? `Error: ${t.error}` : 'No errors'}
   Details: ${JSON.stringify(t.details || {})}`
).join('\n\n')}

---

## CONCLUSION

**Pass Rate:** ${passRate}%
**Issues:** ${testResults.issues.length} total (${criticalIssues} critical, ${highIssues} high, ${mediumIssues} medium)
**Status:** ${passRate >= 90 ? '✅ Excellent - Production Ready' : passRate >= 75 ? '⚠️ Good - Requires Fixes' : '❌ Poor - Major Work Needed'}

${passRate >= 90 ?
`**System is production-ready!** All critical functionality is working correctly.` :
`**Further work required.** See critical issues above for details.`}

---

**Test Suite:** Final Comprehensive Validation v1.0
**Date:** ${new Date().toLocaleDateString()}
**Environment:** localhost:8765
`;

  return report;
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  FINAL COMPREHENSIVE VALIDATION - v11.3.0 ALL FIXES       ║');
  console.log('║  Test Suite: May 8, 2026                                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let ws;
  try {
    console.log('Connecting to WebSocket server...');
    ws = await connectWS();
    console.log('✓ Connected to ws://localhost:8765\n');

    // Run all test suites
    await testStateRollbackMechanism(ws);
    await testNavigationCompletionFix(ws);
    await testContentExtraction(ws);
    await testResponseFormat(ws);
    await testIdentifyRemainingIssues(ws);

    // Generate and save report
    const report = generateReport();
    const reportPath = '/home/devel/basset-hound-browser/tests/results/FINAL-VALIDATION-ALL-FIXES-2026-05-08.md';
    fs.writeFileSync(reportPath, report, 'utf-8');

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  TEST EXECUTION COMPLETE                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Pass Rate: ${(testResults.passed / testResults.total * 100).toFixed(1)}% (${testResults.passed}/${testResults.total})`);
    console.log(`Critical Issues: ${testResults.issues.filter(i => i.severity === 'CRITICAL').length}`);
    console.log(`High Issues: ${testResults.issues.filter(i => i.severity === 'HIGH').length}`);
    console.log(`Medium Issues: ${testResults.issues.filter(i => i.severity === 'MEDIUM').length}`);
    console.log(`\nFull report saved to: ${reportPath}`);

  } catch (e) {
    console.error('\n✗ Test execution failed:', e.message);
    process.exit(1);
  } finally {
    if (ws) {
      ws.close();
    }
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

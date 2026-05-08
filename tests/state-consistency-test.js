const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Test configuration
const WS_URL = 'ws://localhost:8765';
const TEST_URLS = [
  'https://example.com',
  'https://example.org',
  'https://example.net',
  'https://httpbin.org/html',
  'https://httpbin.org/delay/1'
];

// Results tracking
const results = {
  timestamp: new Date().toISOString(),
  scenarios: [],
  summary: {
    passed: 0,
    failed: 0,
    errors: [],
    warnings: []
  }
};

// Helper function to send WebSocket command
function sendCommand(ws, command, data = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Command timeout: ${command}`));
    }, 15000);

    const messageHandler = (msg) => {
      try {
        const response = JSON.parse(msg);
        if (response.id && !data.id) {
          return; // Not our response
        }
        if (response.command === command || response.id === data.id) {
          clearTimeout(timeout);
          ws.removeEventListener('message', messageHandler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors, wait for valid JSON
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

// Test 1: STATE CONSISTENCY
async function testStateConsistency(ws) {
  const scenario = {
    name: 'STATE CONSISTENCY',
    description: 'Get initial state, perform operations, verify state changes appropriately',
    iterations: 10,
    results: [],
    consistencyScore: 0
  };

  console.log('\n=== Test 1: STATE CONSISTENCY ===');

  for (let i = 0; i < scenario.iterations; i++) {
    let iteration;
    try {
      const testUrl = TEST_URLS[i % TEST_URLS.length];
      iteration = { step: i + 1, checks: [] };

      // Get initial state
      const initialState = await sendCommand(ws, 'get_page_state');
      iteration.checks.push({
        action: 'get_initial_state',
        success: !!initialState,
        state: initialState
      });

      // Navigate
      const navResponse = await sendCommand(ws, 'navigate', { url: testUrl, timeout: 10000 });
      iteration.checks.push({
        action: 'navigate',
        url: testUrl,
        success: navResponse.success,
        response: navResponse
      });

      // Wait a bit
      await new Promise(r => setTimeout(r, 500));

      // Get state after navigation
      const afterNavState = await sendCommand(ws, 'get_page_state');
      const urlCheck = await sendCommand(ws, 'get_url');

      iteration.checks.push({
        action: 'get_state_after_nav',
        success: !!afterNavState,
        state: afterNavState,
        url: urlCheck?.url
      });

      // Verify state changed
      const stateChanged = initialState?.url !== afterNavState?.url;
      const urlCorrect = urlCheck?.url === testUrl;

      iteration.stateChanged = stateChanged;
      iteration.urlCorrect = urlCorrect;
      iteration.passed = stateChanged && urlCorrect;

      scenario.results.push(iteration);

      console.log(`  Iteration ${i + 1}: ${iteration.passed ? 'PASS' : 'FAIL'} ` +
        `(state_changed=${stateChanged}, url_correct=${urlCorrect})`);

    } catch (error) {
      iteration.error = error.message;
      iteration.passed = false;
      scenario.results.push(iteration);
      console.log(`  Iteration ${i + 1}: ERROR - ${error.message}`);
    }
  }

  scenario.consistencyScore = (scenario.results.filter(r => r.passed).length / scenario.iterations) * 100;
  results.scenarios.push(scenario);
  return scenario.consistencyScore === 100;
}

// Test 2: RAPID STATE CHANGES
async function testRapidStateChanges(ws) {
  const scenario = {
    name: 'RAPID STATE CHANGES',
    description: 'Rapidly navigate to different URLs and verify current state is returned',
    results: [],
    staleStateCount: 0
  };

  console.log('\n=== Test 2: RAPID STATE CHANGES ===');

  for (let i = 0; i < TEST_URLS.length; i++) {
    let iteration;
    try {
      const url = TEST_URLS[i];
      iteration = { step: i + 1, url, checks: [] };

      // Navigate without waiting
      const navResponse = await sendCommand(ws, 'navigate', { url, timeout: 10000 });
      iteration.checks.push({ action: 'navigate', success: navResponse.success });

      // Immediately get state (rapid succession)
      const states = [];
      for (let j = 0; j < 3; j++) {
        const state = await sendCommand(ws, 'get_page_state');
        const urlCheck = await sendCommand(ws, 'get_url');
        states.push({ state, url: urlCheck?.url });
      }

      iteration.states = states;

      // Check for stale state (all should match current URL)
      let staleDetected = false;
      for (const s of states) {
        if (s.url && s.url !== url && !s.url.includes('about:blank')) {
          staleDetected = true;
          scenario.staleStateCount++;
          iteration.staleDetected = true;
        }
      }

      iteration.allCurrentUrl = states.every(s => s.url === url || s.url?.includes('about:blank'));
      iteration.passed = !staleDetected && iteration.allCurrentUrl;

      scenario.results.push(iteration);

      console.log(`  URL ${i + 1}: ${iteration.passed ? 'PASS' : 'FAIL'} ` +
        `(stale=${staleDetected}, all_current=${iteration.allCurrentUrl})`);

    } catch (error) {
      const iteration = { step: i + 1, url: TEST_URLS[i], error: error.message, passed: false };
      scenario.results.push(iteration);
      console.log(`  URL ${i + 1}: ERROR - ${error.message}`);
    }
  }

  results.scenarios.push(scenario);
  return scenario.staleStateCount === 0;
}

// Test 3: CONCURRENT OPERATIONS
async function testConcurrentOperations(ws) {
  const scenario = {
    name: 'CONCURRENT OPERATIONS',
    description: 'Start navigation and send get_url/get_page_state during navigation',
    results: [],
    raceCaseCount: 0
  };

  console.log('\n=== Test 3: CONCURRENT OPERATIONS ===');

  for (let i = 0; i < 5; i++) {
    let iteration;
    try {
      const url = TEST_URLS[i % TEST_URLS.length];
      iteration = { step: i + 1, url, timing: {} };

      const startTime = Date.now();

      // Start navigation but don't await immediately
      const navPromise = sendCommand(ws, 'navigate', { url, timeout: 10000 });

      // Send concurrent get_url and get_page_state
      await new Promise(r => setTimeout(r, 100)); // Small delay to let nav start

      const concurrentStart = Date.now();
      const [stateResponse, urlResponse] = await Promise.all([
        sendCommand(ws, 'get_page_state'),
        sendCommand(ws, 'get_url')
      ]);
      const concurrentEnd = Date.now();

      // Wait for navigation to complete
      const navResponse = await navPromise;
      const navEnd = Date.now();

      iteration.timing = {
        nav_started: startTime,
        concurrent_sent: concurrentStart,
        concurrent_received: concurrentEnd,
        nav_completed: navEnd,
        concurrent_during_nav: concurrentEnd < navEnd
      };

      iteration.responses = {
        nav: navResponse.success,
        state: !!stateResponse,
        url: !!urlResponse
      };

      // Check if we got stale data during concurrent operation
      let raceCondition = false;
      if (iteration.timing.concurrent_during_nav) {
        // If concurrent query happened during nav, URL could be previous or current
        if (urlResponse?.url && urlResponse?.url !== url && !urlResponse?.url?.includes('about:blank')) {
          raceCondition = true;
          scenario.raceCaseCount++;
        }
      }

      iteration.raceCondition = raceCondition;
      iteration.passed = navResponse.success && !!stateResponse && !!urlResponse;

      scenario.results.push(iteration);

      console.log(`  Concurrent op ${i + 1}: ${iteration.passed ? 'PASS' : 'FAIL'} ` +
        `(race=${raceCondition}, during_nav=${iteration.timing.concurrent_during_nav})`);

    } catch (error) {
      const iteration = { step: i + 1, url: TEST_URLS[i % TEST_URLS.length], error: error.message, passed: false };
      scenario.results.push(iteration);
      console.log(`  Concurrent op ${i + 1}: ERROR - ${error.message}`);
    }
  }

  results.scenarios.push(scenario);
  return scenario.raceCaseCount === 0;
}

// Test 4: STATE AFTER ERRORS
async function testStateAfterErrors(ws) {
  const scenario = {
    name: 'STATE AFTER ERRORS',
    description: 'Send failing command and verify state remains unchanged',
    results: [],
    stateChangedOnError: 0
  };

  console.log('\n=== Test 4: STATE AFTER ERRORS ===');

  const testCases = [
    { command: 'navigate', data: { url: 'invalid://not-a-url' }, expectError: true },
    { command: 'click', data: { selector: '#nonexistent-element-xyz' }, expectError: true },
    { command: 'get_url', data: {}, expectError: false },
    { command: 'navigate', data: { url: 'https://example.com' }, expectError: false }
  ];

  for (let i = 0; i < testCases.length; i++) {
    let iteration;
    try {
      const testCase = testCases[i];
      iteration = { step: i + 1, command: testCase.command, expectError: testCase.expectError };

      // Get state before
      const stateBefore = await sendCommand(ws, 'get_page_state');
      const urlBefore = await sendCommand(ws, 'get_url');

      iteration.stateBefore = { state: stateBefore, url: urlBefore?.url };

      // Send test command
      let commandResponse;
      let commandError = null;
      try {
        commandResponse = await sendCommand(ws, testCase.command, testCase.data);
      } catch (e) {
        commandError = e.message;
      }

      // Wait a moment
      await new Promise(r => setTimeout(r, 300));

      // Get state after
      const stateAfter = await sendCommand(ws, 'get_page_state');
      const urlAfter = await sendCommand(ws, 'get_url');

      iteration.stateAfter = { state: stateAfter, url: urlAfter?.url };
      iteration.commandResponse = commandResponse;
      iteration.commandError = commandError;

      // Check if state changed
      const stateUnchanged = JSON.stringify(stateBefore) === JSON.stringify(stateAfter);
      const urlUnchanged = urlBefore?.url === urlAfter?.url;

      if (!stateUnchanged && testCase.expectError) {
        scenario.stateChangedOnError++;
      }

      iteration.stateUnchanged = stateUnchanged;
      iteration.urlUnchanged = urlUnchanged;
      iteration.passed = (testCase.expectError ? stateUnchanged && urlUnchanged : true);

      scenario.results.push(iteration);

      console.log(`  Test case ${i + 1} (${testCase.command}): ${iteration.passed ? 'PASS' : 'FAIL'} ` +
        `(state_unchanged=${stateUnchanged}, url_unchanged=${urlUnchanged})`);

    } catch (error) {
      const iteration = {
        step: i + 1,
        command: testCases[i].command,
        error: error.message,
        passed: false
      };
      scenario.results.push(iteration);
      console.log(`  Test case ${i + 1}: ERROR - ${error.message}`);
    }
  }

  results.scenarios.push(scenario);
  return scenario.stateChangedOnError === 0;
}

// Test 5: SESSION CONSISTENCY (Multi-tab)
async function testSessionConsistency(ws) {
  const scenario = {
    name: 'SESSION CONSISTENCY',
    description: 'Create tabs, navigate each independently, verify state isolation',
    tabStates: [],
    stateIsolationFailures: 0
  };

  console.log('\n=== Test 5: SESSION CONSISTENCY ===');

  try {
    // Create multiple tabs
    const tabs = [];
    for (let i = 0; i < 3; i++) {
      try {
        const tabResponse = await sendCommand(ws, 'create_tab', {});
        tabs.push(tabResponse.tab_id || `tab-${i}`);
        console.log(`  Created tab: ${tabs[i]}`);
      } catch (e) {
        console.log(`  Note: create_tab not available, using default session`);
        tabs.push(`default-${i}`);
      }
    }

    scenario.tabCount = tabs.length;

    // Navigate each tab to different URL
    const tabNavResults = [];
    for (let i = 0; i < Math.min(tabs.length, TEST_URLS.length); i++) {
      try {
        const url = TEST_URLS[i];
        const navResponse = await sendCommand(ws, 'navigate', { url, timeout: 10000 });
        tabNavResults.push({ tab: i, url, success: navResponse.success });
        console.log(`  Tab ${i}: Navigated to ${url}`);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        tabNavResults.push({ tab: i, url: TEST_URLS[i], error: e.message });
      }
    }

    scenario.navigationResults = tabNavResults;

    // Get state of each "tab" (as separate calls)
    const tabStateResults = [];
    for (let i = 0; i < tabs.length; i++) {
      try {
        const urlCheck = await sendCommand(ws, 'get_url');
        const stateCheck = await sendCommand(ws, 'get_page_state');

        tabStateResults.push({
          index: i,
          url: urlCheck?.url,
          state: stateCheck,
          expectedUrl: i < TEST_URLS.length ? TEST_URLS[i] : null
        });

        const matches = urlCheck?.url === (i < TEST_URLS.length ? TEST_URLS[i] : null);
        console.log(`  Tab ${i} state: ${matches ? 'MATCHES' : 'MISMATCH'}`);

      } catch (e) {
        tabStateResults.push({
          index: i,
          error: e.message
        });
      }
    }

    scenario.tabStates = tabStateResults;
    scenario.stateIsolationFailures = tabStateResults.filter(t =>
      t.expectedUrl && t.url !== t.expectedUrl
    ).length;

  } catch (error) {
    scenario.error = error.message;
    console.log(`  SESSION CONSISTENCY: ERROR - ${error.message}`);
  }

  results.scenarios.push(scenario);
  return scenario.stateIsolationFailures === 0;
}

// Main test runner
async function runTests() {
  console.log('='.repeat(60));
  console.log('STATE CONSISTENCY VALIDATION TEST SUITE');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  let ws;
  try {
    // Connect to WebSocket
    ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log(`Connected to ${WS_URL}`);

    // Run all tests
    const test1Pass = await testStateConsistency(ws);
    const test2Pass = await testRapidStateChanges(ws);
    const test3Pass = await testConcurrentOperations(ws);
    const test4Pass = await testStateAfterErrors(ws);
    const test5Pass = await testSessionConsistency(ws);

    // Calculate summary
    const allTests = [test1Pass, test2Pass, test3Pass, test4Pass, test5Pass];
    results.summary.passed = allTests.filter(t => t).length;
    results.summary.failed = allTests.filter(t => !t).length;

    // Add detailed findings
    const stateConsistency = results.scenarios[0];
    if (stateConsistency.consistencyScore < 100) {
      results.summary.errors.push(
        `STATE CONSISTENCY: ${stateConsistency.consistencyScore.toFixed(1)}% pass rate ` +
        `(${stateConsistency.results.filter(r => r.passed).length}/${stateConsistency.iterations} passed)`
      );
    }

    const rapidState = results.scenarios[1];
    if (rapidState.staleStateCount > 0) {
      results.summary.errors.push(
        `RAPID STATE CHANGES: ${rapidState.staleStateCount} stale state detections`
      );
    }

    const concurrent = results.scenarios[2];
    if (concurrent.raceCaseCount > 0) {
      results.summary.warnings.push(
        `CONCURRENT OPERATIONS: ${concurrent.raceCaseCount} race condition cases detected`
      );
    }

    const errorTest = results.scenarios[3];
    if (errorTest.stateChangedOnError > 0) {
      results.summary.errors.push(
        `STATE AFTER ERRORS: State changed on ${errorTest.stateChangedOnError} error commands`
      );
    }

    const session = results.scenarios[4];
    if (session.stateIsolationFailures > 0) {
      results.summary.errors.push(
        `SESSION CONSISTENCY: ${session.stateIsolationFailures} state isolation failures`
      );
    }

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${results.scenarios.length}`);
    console.log(`Passed: ${results.summary.passed}`);
    console.log(`Failed: ${results.summary.failed}`);

    if (results.summary.errors.length > 0) {
      console.log('\nCritical Errors:');
      results.summary.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (results.summary.warnings.length > 0) {
      console.log('\nWarnings:');
      results.summary.warnings.forEach(w => console.log(`  - ${w}`));
    }

    ws.close();

  } catch (error) {
    console.error('Fatal error:', error.message);
    results.summary.errors.push(`Fatal error: ${error.message}`);
    if (ws) ws.close();
  }

  // Save results
  const resultsDir = '/home/devel/basset-hound-browser/tests/results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const reportPath = path.join(resultsDir, 'STATE-CONSISTENCY-VALIDATION-2026-05-08.md');
  const report = generateMarkdownReport(results);
  fs.writeFileSync(reportPath, report);

  console.log(`\nResults saved to: ${reportPath}`);
}

function generateMarkdownReport(data) {
  let report = `# State Consistency Validation Report
**Date:** ${data.timestamp}
**WebSocket Server:** localhost:8765

## Executive Summary
- **Total Test Scenarios:** ${data.scenarios.length}
- **Passed:** ${data.summary.passed}
- **Failed:** ${data.summary.failed}

${data.summary.errors.length > 0 ? `### Critical Findings
${data.summary.errors.map(e => `- **${e}`).join('\n')}
` : ''}

${data.summary.warnings.length > 0 ? `### Warnings
${data.summary.warnings.map(w => `- ${w}`).join('\n')}
` : ''}

## Test Results by Scenario

`;

  for (const scenario of data.scenarios) {
    report += `### ${scenario.name}
**Description:** ${scenario.description}

`;

    if (scenario.consistencyScore !== undefined) {
      report += `**Consistency Score:** ${scenario.consistencyScore.toFixed(1)}% (${scenario.results.filter(r => r.passed).length}/${scenario.iterations} passed)\n\n`;
      report += `| Iteration | Passed | State Changed | URL Correct | Notes |\n`;
      report += `|-----------|--------|---------------|-------------|-------|\n`;
      for (const result of scenario.results) {
        report += `| ${result.step} | ${result.passed ? '✓' : '✗'} | ${result.stateChanged ? 'Yes' : 'No'} | ${result.urlCorrect ? 'Yes' : 'No'} | ${result.error || ''} |\n`;
      }
    } else if (scenario.staleStateCount !== undefined) {
      report += `**Stale State Detections:** ${scenario.staleStateCount}\n\n`;
      report += `| URL | Passed | All Current | Stale Detected | Notes |\n`;
      report += `|-----|--------|-------------|---|-------|\n`;
      for (const result of scenario.results) {
        report += `| ${result.url || 'N/A'} | ${result.passed ? '✓' : '✗'} | ${result.allCurrentUrl ? 'Yes' : 'No'} | ${result.staleDetected ? 'Yes' : 'No'} | ${result.error || ''} |\n`;
      }
    } else if (scenario.raceCaseCount !== undefined) {
      report += `**Race Condition Cases:** ${scenario.raceCaseCount}\n\n`;
      report += `| Operation | Passed | Race Detected | During Nav | Notes |\n`;
      report += `|-----------|--------|---|---|-------|\n`;
      for (const result of scenario.results) {
        report += `| ${result.step} | ${result.passed ? '✓' : '✗'} | ${result.raceCondition ? 'Yes' : 'No'} | ${result.timing?.concurrent_during_nav ? 'Yes' : 'No'} | ${result.error || ''} |\n`;
      }
    } else if (scenario.stateChangedOnError !== undefined) {
      report += `**State Changes on Error:** ${scenario.stateChangedOnError}\n\n`;
      report += `| Command | Expect Error | State Unchanged | URL Unchanged | Passed | Notes |\n`;
      report += `|---------|---|---|---|---|-------|\n`;
      for (const result of scenario.results) {
        report += `| ${result.command} | ${result.expectError ? 'Yes' : 'No'} | ${result.stateUnchanged ? 'Yes' : 'No'} | ${result.urlUnchanged ? 'Yes' : 'No'} | ${result.passed ? '✓' : '✗'} | ${result.error || ''} |\n`;
      }
    } else if (scenario.stateIsolationFailures !== undefined) {
      report += `**State Isolation Failures:** ${scenario.stateIsolationFailures}\n`;
      report += `**Tabs Created:** ${scenario.tabCount}\n\n`;

      if (scenario.error) {
        report += `**Error:** ${scenario.error}\n`;
      } else {
        report += `| Tab | Expected URL | Actual URL | Match | Notes |\n`;
        report += `|-----|---|---|---|-------|\n`;
        for (const state of scenario.tabStates) {
          const match = state.expectedUrl === state.url ? '✓' : '✗';
          report += `| ${state.index} | ${state.expectedUrl || 'N/A'} | ${state.url || 'N/A'} | ${match} | ${state.error || ''} |\n`;
        }
      }
    }

    report += '\n';
  }

  report += `## Detailed Analysis

### State Management Health
${data.summary.errors.length === 0 ? '✓ No critical issues detected' : `✗ ${data.summary.errors.length} critical issues found:\n${data.summary.errors.map(e => `  - ${e}`).join('\n')}`}

### Recommendations
${data.summary.errors.length === 0 ?
  '1. State management appears stable\n2. Continue monitoring for edge cases\n3. Consider stress testing with longer durations' :
  `1. Review and fix state management inconsistencies\n2. Add state validation after each command\n3. Implement request/response correlation for concurrent operations\n4. Consider state locking during transitions`
}

---
**Report Generated:** ${new Date().toISOString()}
`;

  return report;
}

// Run tests
runTests().catch(console.error);

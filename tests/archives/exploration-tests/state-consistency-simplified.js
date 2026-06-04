const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:8765';
const TEST_URLS = [
  'https://example.com',
  'https://example.org',
  'https://httpbin.org/html',
  'https://httpbin.org/status/200'
];

class StateConsistencyTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, errors: [] }
    };
  }

  async sendCommand(ws, command, data = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, 15000);

      const id = `${command}-${Date.now()}`;
      const messageHandler = (msg) => {
        try {
          const response = JSON.parse(msg);
          if (response.command === command || response.id === id) {
            clearTimeout(timeout);
            ws.removeEventListener('message', messageHandler);
            resolve(response);
          }
        } catch (e) {}
      };

      ws.on('message', messageHandler);
      ws.send(JSON.stringify({ id, command, ...data }));
    });
  }

  async test1StateConsistency(ws) {
    console.log('\nTest 1: STATE CONSISTENCY');
    const test = { name: 'State Consistency', iterations: 8, results: [] };

    for (let i = 0; i < test.iterations; i++) {
      try {
        const url = TEST_URLS[i % TEST_URLS.length];

        // Get initial state
        const initial = await this.sendCommand(ws, 'get_page_state');
        const initialUrl = initial?.url;

        // Navigate
        const nav = await this.sendCommand(ws, 'navigate', { url, timeout: 10000 });

        if (!nav.success) {
          test.results.push({ iteration: i + 1, passed: false, reason: 'Nav failed' });
          continue;
        }

        await new Promise(r => setTimeout(r, 500));

        // Get state after
        const after = await this.sendCommand(ws, 'get_page_state');
        const afterUrl = await this.sendCommand(ws, 'get_url');

        const stateChanged = initial?.url !== after?.url || initialUrl !== afterUrl?.url;
        const urlCorrect = afterUrl?.url === url;
        const passed = nav.success && stateChanged;

        test.results.push({
          iteration: i + 1,
          passed,
          url,
          stateChanged,
          urlCorrect,
          navSuccess: nav.success
        });

        console.log(`  Iteration ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        test.results.push({ iteration: i + 1, passed: false, error: error.message });
        console.log(`  Iteration ${i + 1}: ERROR - ${error.message}`);
      }
    }

    const passCount = test.results.filter(r => r.passed).length;
    test.score = (passCount / test.iterations) * 100;
    test.passed = test.score === 100;

    console.log(`  Result: ${passCount}/${test.iterations} (${test.score.toFixed(1)}%)`);
    this.results.tests.push(test);
    return test.passed;
  }

  async test2RapidStateChanges(ws) {
    console.log('\nTest 2: RAPID STATE CHANGES');
    const test = { name: 'Rapid State Changes', results: [] };

    for (let i = 0; i < 4; i++) {
      try {
        const url = TEST_URLS[i];

        // Navigate rapidly
        const nav = await this.sendCommand(ws, 'navigate', { url, timeout: 10000 });

        if (!nav.success) {
          test.results.push({ url, passed: false, reason: 'Nav failed' });
          continue;
        }

        // Rapid state checks
        const check1 = await this.sendCommand(ws, 'get_url');
        const check2 = await this.sendCommand(ws, 'get_url');
        const check3 = await this.sendCommand(ws, 'get_page_state');

        const consistent = check1?.url === url && check2?.url === url;
        const passed = nav.success && consistent;

        test.results.push({ url, passed, check1_url: check1?.url, check2_url: check2?.url });
        console.log(`  URL ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        test.results.push({ url: TEST_URLS[i], passed: false, error: error.message });
        console.log(`  URL ${i + 1}: ERROR - ${error.message}`);
      }
    }

    const passCount = test.results.filter(r => r.passed).length;
    test.passed = passCount === test.results.length;
    console.log(`  Result: ${passCount}/${test.results.length}`);
    this.results.tests.push(test);
    return test.passed;
  }

  async test3ConcurrentOps(ws) {
    console.log('\nTest 3: CONCURRENT OPERATIONS');
    const test = { name: 'Concurrent Operations', results: [] };

    for (let i = 0; i < 4; i++) {
      try {
        const url = TEST_URLS[i % TEST_URLS.length];

        // Start nav, immediately query state
        const navPromise = this.sendCommand(ws, 'navigate', { url, timeout: 10000 });

        await new Promise(r => setTimeout(r, 50));

        const [nav, stateCheck, urlCheck] = await Promise.all([
          navPromise,
          this.sendCommand(ws, 'get_page_state'),
          this.sendCommand(ws, 'get_url')
        ]);

        const passed = nav.success && stateCheck && urlCheck;
        test.results.push({ url, passed, nav_success: nav.success });
        console.log(`  Op ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        test.results.push({ url: TEST_URLS[i % TEST_URLS.length], passed: false, error: error.message });
        console.log(`  Op ${i + 1}: ERROR - ${error.message}`);
      }
    }

    const passCount = test.results.filter(r => r.passed).length;
    test.passed = passCount === test.results.length;
    console.log(`  Result: ${passCount}/${test.results.length}`);
    this.results.tests.push(test);
    return test.passed;
  }

  async test4ErrorStates(ws) {
    console.log('\nTest 4: STATE AFTER ERRORS');
    const test = { name: 'State After Errors', results: [] };

    const testCases = [
      { cmd: 'navigate', data: { url: 'invalid://url' }, expectFail: true },
      { cmd: 'click', data: { selector: '#nonexist' }, expectFail: true },
      { cmd: 'get_url', data: {}, expectFail: false }
    ];

    for (let i = 0; i < testCases.length; i++) {
      try {
        const tc = testCases[i];

        // Get state before
        const before = await this.sendCommand(ws, 'get_page_state');

        // Execute command
        let response, error;
        try {
          response = await this.sendCommand(ws, tc.cmd, tc.data);
          error = false;
        } catch (e) {
          error = true;
        }

        await new Promise(r => setTimeout(r, 200));

        // Get state after
        const after = await this.sendCommand(ws, 'get_page_state');

        const stateUnchanged = JSON.stringify(before) === JSON.stringify(after);
        const passed = stateUnchanged || !tc.expectFail;

        test.results.push({
          command: tc.cmd,
          expectFail: tc.expectFail,
          had_error: error,
          stateUnchanged,
          passed
        });

        console.log(`  ${tc.cmd}: ${passed ? 'PASS' : 'FAIL'}`);
      } catch (error) {
        test.results.push({ command: testCases[i].cmd, passed: false, error: error.message });
        console.log(`  ${testCases[i].cmd}: ERROR - ${error.message}`);
      }
    }

    const passCount = test.results.filter(r => r.passed).length;
    test.passed = passCount === test.results.length;
    console.log(`  Result: ${passCount}/${test.results.length}`);
    this.results.tests.push(test);
    return test.passed;
  }

  async test5SessionConsistency(ws) {
    console.log('\nTest 5: SESSION CONSISTENCY');
    const test = { name: 'Session Consistency', results: [] };

    try {
      // Navigate to different URLs
      for (let i = 0; i < 3; i++) {
        const url = TEST_URLS[i];

        const nav = await this.sendCommand(ws, 'navigate', { url, timeout: 10000 });
        await new Promise(r => setTimeout(r, 500));

        const state = await this.sendCommand(ws, 'get_url');

        const passed = nav.success && state?.url === url;
        test.results.push({ index: i, url, nav_success: nav.success, state_url: state?.url, passed });
        console.log(`  Session ${i + 1}: ${passed ? 'PASS' : 'FAIL'}`);
      }

      const passCount = test.results.filter(r => r.passed).length;
      test.passed = passCount === test.results.length;
      console.log(`  Result: ${passCount}/${test.results.length}`);
    } catch (error) {
      console.log(`  ERROR: ${error.message}`);
      test.error = error.message;
      test.passed = false;
    }

    this.results.tests.push(test);
    return test.passed;
  }

  async runAll(ws) {
    console.log('\n' + '='.repeat(60));
    console.log('STATE CONSISTENCY VALIDATION - SIMPLIFIED');
    console.log('='.repeat(60));

    const t1 = await this.test1StateConsistency(ws);
    const t2 = await this.test2RapidStateChanges(ws);
    const t3 = await this.test3ConcurrentOps(ws);
    const t4 = await this.test4ErrorStates(ws);
    const t5 = await this.test5SessionConsistency(ws);

    this.results.summary.passed = [t1, t2, t3, t4, t5].filter(x => x).length;
    this.results.summary.failed = 5 - this.results.summary.passed;

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Passed: ${this.results.summary.passed}/5`);
    console.log(`Failed: ${this.results.summary.failed}/5`);

    return this.results;
  }

  saveReport() {
    const dir = '/home/devel/basset-hound-browser/tests/results';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const filePath = path.join(dir, 'STATE-CONSISTENCY-VALIDATION-2026-05-08.md');
    let report = `# State Consistency Validation Report\n`;
    report += `**Date:** ${this.results.timestamp}\n`;
    report += `**WebSocket:** localhost:8765\n\n`;

    report += `## Executive Summary\n`;
    report += `- **Tests Passed:** ${this.results.summary.passed}/5\n`;
    report += `- **Tests Failed:** ${this.results.summary.failed}/5\n\n`;

    report += `## Test Results\n\n`;

    for (const test of this.results.tests) {
      report += `### ${test.name}\n`;

      if (test.score !== undefined) {
        report += `**Score:** ${test.score.toFixed(1)}% (${test.results.filter(r => r.passed).length}/${test.iterations} passed)\n\n`;
        report += `| Iter | Passed | URL |\n`;
        report += `|------|--------|-----|\n`;
        for (const r of test.results) {
          report += `| ${r.iteration} | ${r.passed ? '✓' : '✗'} | ${r.url || r.error || 'N/A'} |\n`;
        }
      } else {
        report += `**Passed:** ${test.results.filter(r => r.passed).length}/${test.results.length}\n\n`;
        report += `| # | Status | Details |\n`;
        report += `|---|--------|----------|\n`;
        let idx = 1;
        for (const r of test.results) {
          const detail = r.url || r.command || r.error || 'N/A';
          report += `| ${idx++} | ${r.passed ? '✓' : '✗'} | ${detail} |\n`;
        }
      }
      report += '\n';
    }

    report += `## Analysis\n`;
    report += `- **State Management:** ${this.results.summary.failed === 0 ? 'HEALTHY' : 'ISSUES FOUND'}\n`;
    report += `- **Concurrency:** ${this.results.tests[2].passed ? 'Stable' : 'Race conditions detected'}\n`;
    report += `- **Error Handling:** ${this.results.tests[3].passed ? 'Correct' : 'State corruption on errors'}\n`;
    report += `\n---\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;

    fs.writeFileSync(filePath, report);
    console.log(`\nReport saved: ${filePath}`);
  }
}

async function main() {
  const tester = new StateConsistencyTester();
  let ws;

  try {
    ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log(`Connected to ${WS_URL}`);

    await tester.runAll(ws);
    tester.saveReport();

  } catch (error) {
    console.error('Fatal error:', error.message);
    if (tester.results.tests.length === 0) {
      tester.results.summary.errors.push(error.message);
      tester.saveReport();
    }
  } finally {
    if (ws) ws.close();
  }
}

main().catch(console.error);

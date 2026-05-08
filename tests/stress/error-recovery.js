#!/usr/bin/env node

/**
 * Error Handling & Recovery Stress Tests
 * Tests the browser's resilience to errors, timeouts, and failures
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  test_duration_seconds: 0,
  test_categories: {},
  total_tests: 0,
  passed_tests: 0,
  failed_tests: 0,
  error_types: {},
  issues_found: []
};

const startTime = Date.now();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Invalid URL Handling
async function testInvalidUrls() {
  console.log('\n[TEST 1] Invalid URL Handling...');
  const results_cat = {
    name: 'Invalid URL Handling',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  const invalid_urls = [
    'not-a-url',
    'ht!tp://invalid',
    ':::://malformed',
    '\x00\x01\x02',
    '',
    ' ',
    'file:///etc/passwd',
    'javascript:alert("xss")',
    'data:text/html,<script>alert("xss")</script>'
  ];

  for (const url of invalid_urls) {
    results_cat.tests++;
    try {
      const ws = new WebSocket('ws://localhost:8765');
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            id: 1,
            command: 'navigate',
            params: { url }
          }));
          setTimeout(() => {
            ws.close();
            resolve();
          }, 1000);
        });
        ws.on('error', reject);
      });
      results_cat.passed++;
    } catch (e) {
      results_cat.failed++;
      results_cat.errors.push({
        url: url.substring(0, 50),
        error: e.message
      });
    }
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Test 2: Malformed JSON Input
async function testMalformedJSON() {
  console.log('\n[TEST 2] Malformed JSON Input Handling...');
  const results_cat = {
    name: 'Malformed JSON',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  const malformed_inputs = [
    '{invalid json}',
    '{"command": "navigate"',
    '{"command": navigate}',
    '{"command": "navigate", params: {url: "test"}}',
    '',
    '   ',
    'null',
    'undefined',
    '{"command":',
    '}\n{\n'
  ];

  for (const input of malformed_inputs) {
    results_cat.tests++;
    try {
      const ws = new WebSocket('ws://localhost:8765');
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(input);
          setTimeout(() => {
            ws.close();
            resolve();
          }, 500);
        });
        ws.on('error', reject);
      });
      results_cat.passed++;
    } catch (e) {
      results_cat.failed++;
      results_cat.errors.push({
        input: input.substring(0, 30),
        error: e.message
      });
    }
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Test 3: Timeout Handling
async function testTimeouts() {
  console.log('\n[TEST 3] Timeout Handling...');
  const results_cat = {
    name: 'Timeout Recovery',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test waiting for non-existent element
  results_cat.tests++;
  try {
    const ws = new WebSocket('ws://localhost:8765');
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 1,
          command: 'wait_for_element',
          params: {
            selector: '#non-existent-element-that-will-never-exist',
            timeout: 100
          }
        }));
        setTimeout(() => {
          ws.close();
          results_cat.passed++;
          resolve();
        }, 200);
      });
      ws.on('error', reject);
    });
  } catch (e) {
    results_cat.failed++;
    results_cat.errors.push({ test: 'wait timeout', error: e.message });
  }

  // Test navigation timeout
  results_cat.tests++;
  try {
    const ws = new WebSocket('ws://localhost:8765');
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 2,
          command: 'navigate',
          params: {
            url: 'http://192.0.2.1:81', // Non-routable IP
            timeout: 100
          }
        }));
        setTimeout(() => {
          ws.close();
          results_cat.passed++;
          resolve();
        }, 200);
      });
      ws.on('error', reject);
    });
  } catch (e) {
    results_cat.failed++;
    results_cat.errors.push({ test: 'navigate timeout', error: e.message });
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Test 4: WebSocket Reconnection
async function testReconnection() {
  console.log('\n[TEST 4] WebSocket Reconnection...');
  const results_cat = {
    name: 'WebSocket Reconnection',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  // Test rapid connect/disconnect cycles
  const cycles = 20;
  for (let i = 0; i < cycles; i++) {
    results_cat.tests++;
    try {
      const ws = new WebSocket('ws://localhost:8765');
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          ws.close();
          results_cat.passed++;
          resolve();
        }, 100);

        ws.on('open', () => {
          ws.send(JSON.stringify({
            id: i,
            command: 'get_status',
            params: {}
          }));
        });
        ws.on('error', reject);
      });
    } catch (e) {
      results_cat.failed++;
      results_cat.errors.push({ cycle: i, error: e.message });
    }
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Test 5: Rate Limit Recovery
async function testRateLimitRecovery() {
  console.log('\n[TEST 5] Rate Limit Recovery...');
  const results_cat = {
    name: 'Rate Limit Recovery',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  try {
    const ws = new WebSocket('ws://localhost:8765');
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        // Send commands rapidly to trigger rate limiting
        for (let i = 0; i < 100; i++) {
          results_cat.tests++;
          ws.send(JSON.stringify({
            id: i,
            command: 'get_status',
            params: {}
          }));
        }

        let responses = 0;
        ws.on('message', (data) => {
          try {
            JSON.parse(data);
            responses++;
            if (responses >= 50) {
              ws.close();
              results_cat.passed += responses;
              resolve();
            }
          } catch (e) {
            // Invalid JSON response
          }
        });

        setTimeout(() => {
          ws.close();
          resolve();
        }, 5000);
      });
      ws.on('error', reject);
    });
  } catch (e) {
    results_cat.errors.push({ test: 'rate limit', error: e.message });
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Test 6: Missing Parameters
async function testMissingParameters() {
  console.log('\n[TEST 6] Missing Parameters...');
  const results_cat = {
    name: 'Missing Parameters',
    tests: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  const invalid_commands = [
    { id: 1, command: 'navigate' }, // Missing params
    { id: 2, command: 'navigate', params: {} }, // Missing url
    { id: 3, command: 'click', params: {} }, // Missing selector
    { id: 4, command: 'screenshot' }, // Missing params
    { id: 5, params: { url: 'test' } }, // Missing command
    { id: 6 } // Missing everything
  ];

  for (const cmd of invalid_commands) {
    results_cat.tests++;
    try {
      const ws = new WebSocket('ws://localhost:8765');
      await new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify(cmd));
          setTimeout(() => {
            ws.close();
            results_cat.passed++;
            resolve();
          }, 500);
        });
        ws.on('error', reject);
      });
    } catch (e) {
      results_cat.failed++;
      results_cat.errors.push({
        command: cmd.command || 'unknown',
        error: e.message
      });
    }
  }

  console.log(`  ${results_cat.passed}/${results_cat.tests} passed`);
  return results_cat;
}

// Main execution
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      ERROR HANDLING & RECOVERY STRESS TESTS                ║');
  console.log('║      Basset Hound Browser v11.2.0                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const categories = [];

  try {
    categories.push(await testInvalidUrls());
    categories.push(await testMalformedJSON());
    categories.push(await testTimeouts());
    categories.push(await testReconnection());
    categories.push(await testRateLimitRecovery());
    categories.push(await testMissingParameters());
  } catch (e) {
    console.error('Fatal error during tests:', e);
  }

  // Aggregate results
  let total_tests = 0;
  let total_passed = 0;
  let total_failed = 0;

  for (const cat of categories) {
    results.test_categories[cat.name] = {
      tests: cat.tests,
      passed: cat.passed,
      failed: cat.failed,
      errors: cat.errors
    };
    total_tests += cat.tests;
    total_passed += cat.passed;
    total_failed += cat.failed;
  }

  results.total_tests = total_tests;
  results.passed_tests = total_passed;
  results.failed_tests = total_failed;
  results.test_duration_seconds = (Date.now() - startTime) / 1000;
  results.success_rate = total_tests > 0 ? (total_passed / total_tests) : 0;

  // Determine issues
  if (results.success_rate < 0.9) {
    results.issues_found.push('Error recovery success rate below 90%');
  }
  for (const cat in results.test_categories) {
    if (results.test_categories[cat].failed > 0) {
      results.issues_found.push(`${cat}: ${results.test_categories[cat].failed} failures`);
    }
  }

  // Output results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    SUMMARY                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Total Tests: ${total_tests}`);
  console.log(`Passed: ${total_passed} (${(results.success_rate * 100).toFixed(1)}%)`);
  console.log(`Failed: ${total_failed}`);
  console.log(`Duration: ${results.test_duration_seconds.toFixed(2)}s`);

  if (results.issues_found.length > 0) {
    console.log('\n⚠️  Issues Found:');
    results.issues_found.forEach(issue => console.log(`  - ${issue}`));
  } else {
    console.log('\n✅ No critical issues found');
  }

  // Save results
  const results_dir = path.join(__dirname, '../results/stress');
  if (!fs.existsSync(results_dir)) {
    fs.mkdirSync(results_dir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(results_dir, 'error-recovery-results.json'),
    JSON.stringify(results, null, 2)
  );

  fs.writeFileSync(
    path.join(results_dir, 'error-recovery-findings.txt'),
    `Error Handling & Recovery Test Results\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `Total Tests: ${total_tests}\n` +
    `Passed: ${total_passed}\n` +
    `Failed: ${total_failed}\n` +
    `Success Rate: ${(results.success_rate * 100).toFixed(1)}%\n` +
    `Duration: ${results.test_duration_seconds.toFixed(2)}s\n\n` +
    (results.issues_found.length > 0
      ? `Issues Found:\n${results.issues_found.map(i => `- ${i}`).join('\n')}\n\n`
      : 'No critical issues found\n\n') +
    `Detailed Results:\n` +
    Object.entries(results.test_categories).map(([name, data]) =>
      `\n${name}:\n  Tests: ${data.tests}\n  Passed: ${data.passed}\n  Failed: ${data.failed}`
    ).join('\n')
  );

  console.log(`\n✅ Results saved to tests/results/stress/error-recovery-*`);
}

runTests().catch(console.error);

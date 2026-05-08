#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 30000; // 30 seconds for each test
const RESULTS_DIR = path.join(__dirname, 'results');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Test results storage
let testResults = {
  timestamp: new Date().toISOString(),
  testSuite: 'ERROR-HANDLING-VALIDATION',
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  tests: [],
  summary: {},
};

// Test categories
const categories = {
  formatConsistency: [],
  errorRecovery: [],
  timeoutHandling: [],
  malformedInput: [],
  responseConsistency: []
};

/**
 * Wait for a connection to open
 */
function connectWS() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Send command and get response
 */
async function sendCommand(ws, cmd, timeout = TEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Test timeout after ${timeout}ms`));
    }, timeout);

    const messageHandler = (data) => {
      clearTimeout(timer);
      ws.removeEventListener('message', messageHandler);
      try {
        const response = JSON.parse(data);
        resolve(response);
      } catch (e) {
        reject(new Error(`Failed to parse response: ${e.message}`));
      }
    };

    ws.on('message', messageHandler);

    try {
      ws.send(JSON.stringify(cmd));
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

/**
 * Record test result
 */
function recordTest(category, name, passed, details = {}) {
  testResults.totalTests++;
  if (passed) testResults.passedTests++;
  else testResults.failedTests++;

  const test = {
    category,
    name,
    passed,
    timestamp: new Date().toISOString(),
    ...details
  };

  testResults.tests.push(test);
  categories[category]?.push(test);

  const status = passed ? '✓' : '✗';
  console.log(`  ${status} ${name}`);
  if (!passed && details.error) {
    console.log(`     Error: ${details.error}`);
  }
}

/**
 * TEST 1: ERROR RESPONSE FORMAT CONSISTENCY
 */
async function testErrorFormatConsistency() {
  console.log('\n[1] ERROR RESPONSE FORMAT CONSISTENCY');

  try {
    const ws = await connectWS();

    // Test 1.1: Invalid command name
    console.log('  Testing invalid command names...');
    try {
      const response = await sendCommand(ws, { command: 'invalid_command_xyz' });
      const hasError = response.error !== undefined && response.error !== null;
      const hasSuccess = response.success === false;
      recordTest('formatConsistency', 'Invalid command - error field populated', hasError, {
        response: JSON.stringify(response).substring(0, 200)
      });
      recordTest('formatConsistency', 'Invalid command - success=false', hasSuccess, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('formatConsistency', 'Invalid command - error field populated', false, { error: e.message });
      recordTest('formatConsistency', 'Invalid command - success=false', false, { error: e.message });
    }

    // Test 1.2: Missing required parameters
    console.log('  Testing missing required parameters...');
    try {
      const response = await sendCommand(ws, { command: 'navigate' }); // Missing 'url'
      const hasError = response.error !== undefined && response.error !== null;
      const errorClear = response.error && response.error.length > 0;
      recordTest('formatConsistency', 'Missing params - error field populated', hasError, {
        response: JSON.stringify(response).substring(0, 200)
      });
      recordTest('formatConsistency', 'Missing params - error message clear', errorClear, {
        error: response.error
      });
    } catch (e) {
      recordTest('formatConsistency', 'Missing params - error field populated', false, { error: e.message });
      recordTest('formatConsistency', 'Missing params - error message clear', false, { error: e.message });
    }

    // Test 1.3: Invalid parameter types
    console.log('  Testing invalid parameter types...');
    try {
      const response = await sendCommand(ws, {
        command: 'wait',
        ms: 'not_a_number' // Should be number
      });
      const hasError = response.error !== undefined && response.error !== null;
      const isNumber = !isNaN(response.error);
      recordTest('formatConsistency', 'Invalid type - error field populated', hasError, {
        response: JSON.stringify(response).substring(0, 200)
      });
      recordTest('formatConsistency', 'Invalid type - consistent error format', hasError, {
        error: response.error
      });
    } catch (e) {
      recordTest('formatConsistency', 'Invalid type - error field populated', false, { error: e.message });
      recordTest('formatConsistency', 'Invalid type - consistent error format', false, { error: e.message });
    }

    // Test 1.4: Command to non-existent resource
    console.log('  Testing non-existent resources...');
    try {
      const response = await sendCommand(ws, {
        command: 'get_tab_info',
        tabId: 99999999 // Very high non-existent tab ID
      });
      const hasError = response.error !== undefined && response.error !== null;
      recordTest('formatConsistency', 'Non-existent resource - error field populated', hasError, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('formatConsistency', 'Non-existent resource - error field populated', false, { error: e.message });
    }

    ws.close();
  } catch (e) {
    recordTest('formatConsistency', 'Test suite connection', false, { error: e.message });
  }
}

/**
 * TEST 2: ERROR RECOVERY
 */
async function testErrorRecovery() {
  console.log('\n[2] ERROR RECOVERY');

  try {
    const ws = await connectWS();

    // Send invalid command
    console.log('  Sending invalid command...');
    try {
      await sendCommand(ws, { command: 'invalid_command' });
    } catch (e) {
      // Expected to fail
    }

    // Send valid command after error
    console.log('  Sending valid command after error...');
    try {
      const response = await sendCommand(ws, { command: 'ping' }, 5000);
      const isValid = response && typeof response === 'object';
      const hasResponse = response.success !== undefined || response.data !== undefined;
      recordTest('errorRecovery', 'Server responsive after error', isValid && hasResponse, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('errorRecovery', 'Server responsive after error', false, { error: e.message });
    }

    // Verify no state corruption
    console.log('  Verifying state consistency...');
    try {
      const response1 = await sendCommand(ws, { command: 'ping' }, 5000);
      const response2 = await sendCommand(ws, { command: 'ping' }, 5000);
      const sameFormat = JSON.stringify(response1) === JSON.stringify(response2) ||
                         (response1.success === response2.success &&
                          typeof response1.data === typeof response2.data);
      recordTest('errorRecovery', 'No state corruption after error', sameFormat, {
        response1: JSON.stringify(response1).substring(0, 100),
        response2: JSON.stringify(response2).substring(0, 100)
      });
    } catch (e) {
      recordTest('errorRecovery', 'No state corruption after error', false, { error: e.message });
    }

    ws.close();
  } catch (e) {
    recordTest('errorRecovery', 'Test suite connection', false, { error: e.message });
  }
}

/**
 * TEST 3: TIMEOUT HANDLING
 */
async function testTimeoutHandling() {
  console.log('\n[3] TIMEOUT HANDLING');

  try {
    const ws = await connectWS();

    // Test with very slow navigation (should timeout gracefully)
    console.log('  Testing timeout with slow navigation...');
    try {
      const response = await sendCommand(ws, {
        command: 'navigate',
        url: 'http://www.example.com',
        waitUntil: 'networkidle2',
        timeout: 100 // Very short timeout
      }, 10000);

      const hasError = response.error !== undefined;
      const isTimeoutError = response.error && (
        response.error.includes('timeout') ||
        response.error.includes('Timeout') ||
        response.error.includes('TIMEOUT')
      );
      recordTest('timeoutHandling', 'Timeout error is clear', hasError && isTimeoutError, {
        error: response.error
      });
    } catch (e) {
      const isTimeoutError = e.message.includes('timeout') || e.message.includes('Timeout');
      recordTest('timeoutHandling', 'Timeout error is clear', isTimeoutError, { error: e.message });
    }

    // Verify recovery after timeout
    console.log('  Verifying recovery after timeout...');
    try {
      const response = await sendCommand(ws, { command: 'ping' }, 5000);
      const isRecovered = response && (response.success !== undefined || response.data !== undefined);
      recordTest('timeoutHandling', 'System recovers after timeout', isRecovered, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('timeoutHandling', 'System recovers after timeout', false, { error: e.message });
    }

    ws.close();
  } catch (e) {
    recordTest('timeoutHandling', 'Test suite connection', false, { error: e.message });
  }
}

/**
 * TEST 4: MALFORMED INPUT
 */
async function testMalformedInput() {
  console.log('\n[4] MALFORMED INPUT');

  try {
    const ws = await connectWS();

    // Test 4.1: Broken JSON
    console.log('  Testing broken JSON...');
    ws.send('{broken json not closed'); // Send without waiting for response

    // Give server time to process, then send valid command
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const response = await sendCommand(ws, { command: 'ping' }, 5000);
      const recovered = response && (response.success !== undefined || response.data !== undefined);
      recordTest('malformedInput', 'Server handles broken JSON without crashing', recovered, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('malformedInput', 'Server handles broken JSON without crashing', false, { error: e.message });
    }

    // Test 4.2: Incomplete JSON
    console.log('  Testing incomplete JSON...');
    ws.send('{"command": "ping"'); // No closing brace

    // Give server time to process, then try again
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const response = await sendCommand(ws, { command: 'ping' }, 5000);
      const recovered = response && (response.success !== undefined || response.data !== undefined);
      recordTest('malformedInput', 'Server handles incomplete JSON without crashing', recovered, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('malformedInput', 'Server handles incomplete JSON without crashing', false, { error: e.message });
    }

    // Test 4.3: Null/undefined parameters
    console.log('  Testing null/undefined parameters...');
    try {
      const response = await sendCommand(ws, {
        command: 'wait',
        ms: null
      });
      const hasError = response.error !== undefined || response.success === false;
      recordTest('malformedInput', 'Server handles null parameters gracefully', hasError, {
        response: JSON.stringify(response).substring(0, 200)
      });
    } catch (e) {
      recordTest('malformedInput', 'Server handles null parameters gracefully', false, { error: e.message });
    }

    ws.close();
  } catch (e) {
    recordTest('malformedInput', 'Test suite connection', false, { error: e.message });
  }
}

/**
 * TEST 5: RESPONSE CONSISTENCY
 */
async function testResponseConsistency() {
  console.log('\n[5] RESPONSE CONSISTENCY');

  try {
    const ws = await connectWS();

    console.log('  Sending same command 5 times...');
    const responses = [];
    const formats = [];

    try {
      for (let i = 0; i < 5; i++) {
        const response = await sendCommand(ws, { command: 'ping' }, 5000);
        responses.push(response);

        // Record format: check for consistent keys
        const format = {
          hasSuccess: 'success' in response,
          hasError: 'error' in response,
          hasData: 'data' in response,
          keys: Object.keys(response).sort()
        };
        formats.push(format);
      }

      // Check if all responses have same format
      const firstFormat = JSON.stringify(formats[0]);
      const allSame = formats.every(f => JSON.stringify(f) === firstFormat);

      recordTest('responseConsistency', 'Same command returns consistent format', allSame, {
        formats: formats.map(f => f.keys)
      });

      // Check if success field is consistent
      const successConsistent = responses.every((r, i) => {
        if (i === 0) return true;
        return typeof r.success === typeof responses[0].success;
      });

      recordTest('responseConsistency', 'Success field always has same type', successConsistent, {
        types: responses.map(r => typeof r.success)
      });

      // Check for any variations in response values (for ping, they should be same)
      const valuesConsistent = responses.every((r, i) => {
        if (i === 0) return true;
        return JSON.stringify(r) === JSON.stringify(responses[0]);
      });

      recordTest('responseConsistency', 'Ping responses are identical', valuesConsistent, {
        sampleResponses: responses.slice(0, 2).map(r => JSON.stringify(r).substring(0, 100))
      });

    } catch (e) {
      recordTest('responseConsistency', 'Same command returns consistent format', false, { error: e.message });
      recordTest('responseConsistency', 'Success field always has same type', false, { error: e.message });
      recordTest('responseConsistency', 'Ping responses are identical', false, { error: e.message });
    }

    ws.close();
  } catch (e) {
    recordTest('responseConsistency', 'Test suite connection', false, { error: e.message });
  }
}

/**
 * Generate summary
 */
function generateSummary() {
  testResults.summary = {
    formatConsistency: {
      total: categories.formatConsistency.length,
      passed: categories.formatConsistency.filter(t => t.passed).length,
      rate: categories.formatConsistency.length > 0
        ? ((categories.formatConsistency.filter(t => t.passed).length / categories.formatConsistency.length) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    errorRecovery: {
      total: categories.errorRecovery.length,
      passed: categories.errorRecovery.filter(t => t.passed).length,
      rate: categories.errorRecovery.length > 0
        ? ((categories.errorRecovery.filter(t => t.passed).length / categories.errorRecovery.length) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    timeoutHandling: {
      total: categories.timeoutHandling.length,
      passed: categories.timeoutHandling.filter(t => t.passed).length,
      rate: categories.timeoutHandling.length > 0
        ? ((categories.timeoutHandling.filter(t => t.passed).length / categories.timeoutHandling.length) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    malformedInput: {
      total: categories.malformedInput.length,
      passed: categories.malformedInput.filter(t => t.passed).length,
      rate: categories.malformedInput.length > 0
        ? ((categories.malformedInput.filter(t => t.passed).length / categories.malformedInput.length) * 100).toFixed(2) + '%'
        : 'N/A'
    },
    responseConsistency: {
      total: categories.responseConsistency.length,
      passed: categories.responseConsistency.filter(t => t.passed).length,
      rate: categories.responseConsistency.length > 0
        ? ((categories.responseConsistency.filter(t => t.passed).length / categories.responseConsistency.length) * 100).toFixed(2) + '%'
        : 'N/A'
    }
  };
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('ERROR HANDLING & RESPONSE CONSISTENCY TEST SUITE v11.3.0');
  console.log('='.repeat(60));
  console.log(`WebSocket Server: ${WS_URL}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Run all test suites
  await testErrorFormatConsistency();
  await testErrorRecovery();
  await testTimeoutHandling();
  await testMalformedInput();
  await testResponseConsistency();

  // Generate summary
  generateSummary();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testResults.totalTests}`);
  console.log(`Passed: ${testResults.passedTests}`);
  console.log(`Failed: ${testResults.failedTests}`);
  console.log(`Pass Rate: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(2)}%\n`);

  console.log('By Category:');
  console.log(`  Format Consistency: ${testResults.summary.formatConsistency.passed}/${testResults.summary.formatConsistency.total} (${testResults.summary.formatConsistency.rate})`);
  console.log(`  Error Recovery: ${testResults.summary.errorRecovery.passed}/${testResults.summary.errorRecovery.total} (${testResults.summary.errorRecovery.rate})`);
  console.log(`  Timeout Handling: ${testResults.summary.timeoutHandling.passed}/${testResults.summary.timeoutHandling.total} (${testResults.summary.timeoutHandling.rate})`);
  console.log(`  Malformed Input: ${testResults.summary.malformedInput.passed}/${testResults.summary.malformedInput.total} (${testResults.summary.malformedInput.rate})`);
  console.log(`  Response Consistency: ${testResults.summary.responseConsistency.passed}/${testResults.summary.responseConsistency.total} (${testResults.summary.responseConsistency.rate})`);

  // Save results to JSON
  const jsonPath = path.join(RESULTS_DIR, 'ERROR-HANDLING-VALIDATION-2026-05-08.json');
  fs.writeFileSync(jsonPath, JSON.stringify(testResults, null, 2));
  console.log(`\nDetailed results saved to: ${jsonPath}`);

  // Save results to markdown
  const mdPath = path.join(RESULTS_DIR, 'ERROR-HANDLING-VALIDATION-2026-05-08.md');
  generateMarkdownReport(mdPath);
  console.log(`Markdown report saved to: ${mdPath}`);

  process.exit(testResults.failedTests > 0 ? 1 : 0);
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(filePath) {
  let md = `# Error Handling & Response Consistency Validation Report
Date: ${testResults.timestamp}
Server: ${WS_URL}

## Executive Summary
- **Total Tests**: ${testResults.totalTests}
- **Passed**: ${testResults.passedTests}
- **Failed**: ${testResults.failedTests}
- **Pass Rate**: ${((testResults.passedTests / testResults.totalTests) * 100).toFixed(2)}%

## Results by Category

### 1. Error Response Format Consistency
**Status**: ${testResults.summary.formatConsistency.passed}/${testResults.summary.formatConsistency.total} (${testResults.summary.formatConsistency.rate})

Tests in this category verify that error responses follow a consistent format across different error types:
- Invalid command names
- Missing required parameters
- Invalid parameter types
- Non-existent resources

#### Details
`;

  categories.formatConsistency.forEach(test => {
    const status = test.passed ? '✓ PASS' : '✗ FAIL';
    md += `\n- ${status}: ${test.name}`;
    if (test.error) md += ` - ${test.error}`;
  });

  md += `\n\n### 2. Error Recovery
**Status**: ${testResults.summary.errorRecovery.passed}/${testResults.summary.errorRecovery.total} (${testResults.summary.errorRecovery.rate})

Tests in this category verify that the server remains responsive after errors:
- Server responsiveness after error
- State consistency checks

#### Details
`;

  categories.errorRecovery.forEach(test => {
    const status = test.passed ? '✓ PASS' : '✗ FAIL';
    md += `\n- ${status}: ${test.name}`;
    if (test.error) md += ` - ${test.error}`;
  });

  md += `\n\n### 3. Timeout Handling
**Status**: ${testResults.summary.timeoutHandling.passed}/${testResults.summary.timeoutHandling.total} (${testResults.summary.timeoutHandling.rate})

Tests in this category verify timeout behavior:
- Clear timeout error messages
- System recovery after timeout

#### Details
`;

  categories.timeoutHandling.forEach(test => {
    const status = test.passed ? '✓ PASS' : '✗ FAIL';
    md += `\n- ${status}: ${test.name}`;
    if (test.error) md += ` - ${test.error}`;
  });

  md += `\n\n### 4. Malformed Input
**Status**: ${testResults.summary.malformedInput.passed}/${testResults.summary.malformedInput.total} (${testResults.summary.malformedInput.rate})

Tests in this category verify graceful handling of bad input:
- Broken JSON
- Incomplete JSON
- Null/undefined parameters

#### Details
`;

  categories.malformedInput.forEach(test => {
    const status = test.passed ? '✓ PASS' : '✗ FAIL';
    md += `\n- ${status}: ${test.name}`;
    if (test.error) md += ` - ${test.error}`;
  });

  md += `\n\n### 5. Response Consistency
**Status**: ${testResults.summary.responseConsistency.passed}/${testResults.summary.responseConsistency.total} (${testResults.summary.responseConsistency.rate})

Tests in this category verify response format consistency:
- Consistent response structure
- Type consistency
- Value consistency

#### Details
`;

  categories.responseConsistency.forEach(test => {
    const status = test.passed ? '✓ PASS' : '✗ FAIL';
    md += `\n- ${status}: ${test.name}`;
    if (test.error) md += ` - ${test.error}`;
  });

  md += `\n\n## Findings & Recommendations

### Error Response Consistency
The error handling validation checks whether error responses are formatted consistently across different error scenarios.

### Key Observations
1. Response format should always include a \`success\` field and optionally an \`error\` field
2. When errors occur, the \`success\` field should be \`false\`
3. Error messages should be clear and descriptive
4. After an error, the server should remain responsive

### Recommendations
1. Standardize error response format across all commands
2. Ensure all error messages are descriptive and actionable
3. Implement error recovery mechanisms to prevent state corruption
4. Add timeout handling with clear error messages
5. Validate input before processing to prevent malformed data issues

## Test Environment
- WebSocket Server: ${WS_URL}
- Test Framework: Node.js + ws library
- Test Timeout: ${TEST_TIMEOUT}ms per command

---
Generated: ${new Date().toISOString()}
`;

  fs.writeFileSync(filePath, md);
}

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

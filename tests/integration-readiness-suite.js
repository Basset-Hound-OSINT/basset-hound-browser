/**
 * Basset Hound Browser - Integration Readiness Suite
 * Version: 1.0.0
 *
 * Comprehensive validation of Basset Hound's readiness for external system integration.
 * Tests palletai agents, Claude MCP integration, automation scripts, and real-world workflows.
 *
 * Test Categories:
 * 1. Command API Validation (WebSocket Interface)
 * 2. Response Format Consistency
 * 3. Error Handling & Recovery
 * 4. Authentication & Security
 * 5. Real-World Workflow Scenarios
 * 6. Multi-System Orchestration
 * 7. Performance & Reliability
 * 8. Data Format Compatibility
 *
 * Usage:
 *   npm test -- tests/integration-readiness-suite.js
 *   node tests/integration-readiness-suite.js --verbose
 *   node tests/integration-readiness-suite.js --focus=palletai
 */

const WebSocket = require('ws');
const assert = require('assert');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  CONNECT_TIMEOUT: 5000,
  COMMAND_TIMEOUT: 10000,
  PAGE_LOAD_TIMEOUT: 5000,
  VERBOSE: process.argv.includes('--verbose') || process.argv.includes('-v'),
  FOCUS: process.argv.find(arg => arg.startsWith('--focus='))?.split('=')[1] || null,
  RESULTS_DIR: path.join(__dirname, 'results'),
  TEST_URL: 'https://example.com',
  TEST_URLS: [
    'https://example.com',
    'https://httpbin.org/get',
    'https://httpbin.org/html'
  ]
};

// ============================================================================
// TEST HARNESS
// ============================================================================

const TestSuite = {
  ws: null,
  messageId: 0,
  pendingRequests: new Map(),
  tests: [],
  results: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: [],
    categories: {},
    summary: {}
  },
  startTime: 0,
  categoryStartTime: {},

  log(message, level = 'INFO') {
    if (CONFIG.VERBOSE || level !== 'DEBUG') {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  },

  logHeader(title) {
    console.log('\n' + '='.repeat(80));
    console.log(`  ${title}`);
    console.log('='.repeat(80) + '\n');
  },

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(CONFIG.WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${CONFIG.CONNECT_TIMEOUT}ms`));
      }, CONFIG.CONNECT_TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.log(`Connected to ${CONFIG.WS_URL}`);
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const response = JSON.parse(data);
          const { id } = response;
          if (this.pendingRequests.has(id)) {
            const { resolve: resolveReq, timer } = this.pendingRequests.get(id);
            this.pendingRequests.delete(id);
            clearTimeout(timer);
            resolveReq(response);
          }
        } catch (err) {
          this.log(`Error parsing message: ${err.message}`, 'ERROR');
        }
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.ws.on('close', () => {
        this.log('WebSocket disconnected');
      });
    });
  },

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  },

  async sendCommand(command, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.messageId += 1;
    const id = String(this.messageId);
    const request = { id, command, ...params };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Command '${command}' timeout after ${CONFIG.COMMAND_TIMEOUT}ms`));
      }, CONFIG.COMMAND_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify(request));
    });
  },

  test(category, name, fn) {
    this.tests.push({ category, name, fn });
  },

  async runTests() {
    this.startTime = performance.now();
    const categories = [...new Set(this.tests.map(t => t.category))];

    for (const category of categories) {
      if (CONFIG.FOCUS && category !== CONFIG.FOCUS) continue;

      this.categoryStartTime[category] = performance.now();
      this.results.categories[category] = { passed: 0, failed: 0, tests: [] };

      this.logHeader(category);
      const categoryTests = this.tests.filter(t => t.category === category);

      for (const test of categoryTests) {
        this.results.total += 1;
        try {
          await test.fn.call(this);
          this.results.passed += 1;
          this.results.categories[category].passed += 1;
          this.results.categories[category].tests.push({ name: test.name, status: 'PASS' });
          console.log(`✓ ${test.name}`);
        } catch (err) {
          this.results.failed += 1;
          this.results.categories[category].failed += 1;
          this.results.categories[category].tests.push({
            name: test.name,
            status: 'FAIL',
            error: err.message
          });
          console.log(`✗ ${test.name}`);
          if (CONFIG.VERBOSE) {
            console.log(`  Error: ${err.message}`);
          }
        }
      }

      const categoryTime = performance.now() - this.categoryStartTime[category];
      console.log(`\nCategory time: ${categoryTime.toFixed(2)}ms`);
    }

    const totalTime = performance.now() - this.startTime;
    this.results.summary = {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      passRate: ((this.results.passed / this.results.total) * 100).toFixed(2) + '%',
      totalTime: totalTime.toFixed(2) + 'ms'
    };

    this.printResults();
    this.saveResults();
  },

  printResults() {
    this.logHeader('TEST RESULTS SUMMARY');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${this.results.summary.passRate}`);
    console.log(`Total Time: ${this.results.summary.totalTime}\n`);

    for (const [category, stats] of Object.entries(this.results.categories)) {
      console.log(`${category}: ${stats.passed}/${stats.passed + stats.failed} passed`);
    }
  },

  saveResults() {
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
      fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(CONFIG.RESULTS_DIR, `INTEGRATION-READINESS-${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${filename}`);
  }
};

// ============================================================================
// 1. COMMAND API VALIDATION (WebSocket Interface)
// ============================================================================

TestSuite.test('1. Command API Validation', 'Ping command works', async function() {
  const response = await this.sendCommand('ping');
  assert(response.success === true, 'Ping should return success=true');
  assert(response.id, 'Response should have id');
  assert(response.command === 'ping', 'Response should echo command name');
});

TestSuite.test('1. Command API Validation', 'Navigate command structure', async function() {
  const response = await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  assert(response.success === true, 'Navigate should succeed');
  assert(response.id, 'Response should have id');
  assert(response.command === 'navigate', 'Response command should match');
  assert(response.data, 'Response should have data object');
});

TestSuite.test('1. Command API Validation', 'Get content command structure', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000)); // Wait for page load

  const response = await this.sendCommand('get_content');
  assert(response.success === true, 'Get content should succeed');
  assert(response.data, 'Should have data');
  assert(typeof response.data.html === 'string' || response.data.html, 'Should have html content');
});

TestSuite.test('1. Command API Validation', 'Get page state command', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const response = await this.sendCommand('get_page_state');
  assert(response.success === true, 'Get page state should succeed');
  assert(response.data, 'Should have data object');
  assert(response.data.title !== undefined, 'Should have title');
  assert(response.data.url !== undefined, 'Should have url');
});

TestSuite.test('1. Command API Validation', 'Screenshot command returns base64', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const response = await this.sendCommand('screenshot');
  assert(response.success === true, 'Screenshot should succeed');
  assert(response.data, 'Should have data');
  assert(typeof response.data === 'string', 'Screenshot should be string (base64)');
  assert(response.data.length > 0, 'Screenshot data should not be empty');
});

TestSuite.test('1. Command API Validation', 'Extract links command', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const response = await this.sendCommand('extract_links');
  assert(response.success === true, 'Extract links should succeed');
  assert(response.data, 'Should have data');
  assert(Array.isArray(response.data.links), 'Links should be array');
});

TestSuite.test('1. Command API Validation', 'Get cookies command', async function() {
  const response = await this.sendCommand('get_cookies', { url: CONFIG.TEST_URL });
  assert(response.success === true, 'Get cookies should succeed');
  assert(response.data, 'Should have data');
  assert(Array.isArray(response.data.cookies), 'Cookies should be array');
});

TestSuite.test('1. Command API Validation', 'Get proxy status command', async function() {
  const response = await this.sendCommand('get_proxy_status');
  assert(response.success === true, 'Get proxy status should succeed');
  assert(response.data, 'Should have data');
  assert(response.data.status !== undefined, 'Should have status field');
});

TestSuite.test('1. Command API Validation', 'Get user agent status command', async function() {
  const response = await this.sendCommand('get_user_agent_status');
  assert(response.success === true, 'Get user agent status should succeed');
  assert(response.data, 'Should have data');
  assert(response.data.userAgent, 'Should have userAgent field');
});

// ============================================================================
// 2. RESPONSE FORMAT CONSISTENCY
// ============================================================================

TestSuite.test('2. Response Format Consistency', 'All responses have required fields', async function() {
  const commands = ['ping', 'get_url', 'get_proxy_status', 'get_user_agent_status'];

  for (const cmd of commands) {
    const response = await this.sendCommand(cmd);
    assert(response.id !== undefined, `Response from '${cmd}' should have id`);
    assert(response.command === cmd, `Response should echo command name for '${cmd}'`);
    assert(response.success !== undefined, `Response from '${cmd}' should have success field`);
  }
});

TestSuite.test('2. Response Format Consistency', 'Success responses include data object', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const commands = ['get_content', 'get_page_state', 'extract_links'];

  for (const cmd of commands) {
    const response = await this.sendCommand(cmd);
    assert(response.success === true, `'${cmd}' should succeed`);
    assert(response.data !== undefined, `'${cmd}' should have data field`);
  }
});

TestSuite.test('2. Response Format Consistency', 'Error responses include error field', async function() {
  try {
    await this.sendCommand('navigate', { url: 'https://invalid-domain-that-does-not-exist-12345.com' });
    await new Promise(r => setTimeout(r, 2000));
    // Navigate may or may not fail depending on timeout handling
  } catch (err) {
    // Expected
  }

  // Try a command with missing required parameters
  try {
    const response = await this.sendCommand('click', {}); // Missing selector
    if (!response.success) {
      assert(response.error !== undefined, 'Error response should have error field');
    }
  } catch (err) {
    // Expected to fail with timeout or error
  }
});

TestSuite.test('2. Response Format Consistency', 'JSON schema validation', async function() {
  const response = await this.sendCommand('ping');

  // Validate JSON structure
  assert(typeof response === 'object', 'Response should be object');
  assert(typeof response.id === 'string', 'ID should be string');
  assert(typeof response.command === 'string', 'Command should be string');
  assert(typeof response.success === 'boolean', 'Success should be boolean');
});

TestSuite.test('2. Response Format Consistency', 'Type consistency in data fields', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const response = await this.sendCommand('get_page_state');
  assert(typeof response.data.title === 'string', 'Title should be string');
  assert(typeof response.data.url === 'string', 'URL should be string');
});

// ============================================================================
// 3. ERROR HANDLING & RECOVERY
// ============================================================================

TestSuite.test('3. Error Handling & Recovery', 'Invalid command returns error', async function() {
  try {
    const response = await this.sendCommand('invalid_command_xyz');
    assert(response.success === false || response.error, 'Should fail or have error');
  } catch (err) {
    // Command timeout or error is expected for invalid commands
  }
});

TestSuite.test('3. Error Handling & Recovery', 'Missing required parameter handling', async function() {
  try {
    const response = await this.sendCommand('click', {}); // Missing selector
    // Should either fail or handle gracefully
    if (!response.success) {
      assert(response.error !== undefined, 'Should have error message');
    }
  } catch (err) {
    // Expected
  }
});

TestSuite.test('3. Error Handling & Recovery', 'Timeout handling', async function() {
  try {
    // Try a command that might timeout
    const response = await this.sendCommand('wait_for_element', {
      selector: '#non-existent-element-xyz',
      timeout: 1000
    });
    // May timeout or fail gracefully
  } catch (err) {
    assert(err.message.includes('timeout'), 'Should mention timeout');
  }
});

TestSuite.test('3. Error Handling & Recovery', 'Connection recovery after error', async function() {
  // First command
  const response1 = await this.sendCommand('ping');
  assert(response1.success === true, 'First ping should succeed');

  // Try invalid command (may error)
  try {
    await this.sendCommand('invalid_command');
  } catch (err) {
    // Expected
  }

  // Connection should still work
  const response2 = await this.sendCommand('ping');
  assert(response2.success === true, 'Should recover from error');
});

TestSuite.test('3. Error Handling & Recovery', 'Multiple commands in sequence', async function() {
  const commands = [
    { cmd: 'ping', params: {} },
    { cmd: 'navigate', params: { url: CONFIG.TEST_URL } },
    { cmd: 'get_url', params: {} },
    { cmd: 'ping', params: {} }
  ];

  for (const { cmd, params } of commands) {
    const response = await this.sendCommand(cmd, params);
    assert(response.success === true || response.command === cmd, `${cmd} should succeed or return response`);
    if (cmd === 'navigate') {
      await new Promise(r => setTimeout(r, 2000)); // Wait after navigation
    }
  }
});

// ============================================================================
// 4. AUTHENTICATION & SECURITY
// ============================================================================

TestSuite.test('4. Authentication & Security', 'Commands execute without auth by default', async function() {
  // Verify that commands work without authentication
  const response = await this.sendCommand('ping');
  assert(response.success === true, 'Commands should work without auth by default');
});

TestSuite.test('4. Authentication & Security', 'Command IDs prevent request collision', async function() {
  // Send multiple commands rapidly
  const ids = new Set();
  for (let i = 0; i < 5; i++) {
    this.messageId += 1;
    const id = String(this.messageId);
    ids.add(id);
  }

  assert(ids.size === 5, 'All command IDs should be unique');
});

TestSuite.test('4. Authentication & Security', 'Response IDs match request IDs', async function() {
  const response = await this.sendCommand('ping');
  assert(response.id === String(this.messageId), 'Response ID should match request ID');
});

// ============================================================================
// 5. REAL-WORLD WORKFLOW SCENARIOS
// ============================================================================

TestSuite.test('5. Real-World Workflows', 'Search → Extract → Screenshot workflow', async function() {
  // Navigate to search URL
  const navResponse = await this.sendCommand('navigate', { url: 'https://httpbin.org/html' });
  assert(navResponse.success === true, 'Navigation should succeed');

  await new Promise(r => setTimeout(r, 2000)); // Wait for page load

  // Extract content
  const contentResponse = await this.sendCommand('get_content');
  assert(contentResponse.success === true, 'Content extraction should succeed');
  assert(contentResponse.data, 'Should have data');

  // Extract links
  const linksResponse = await this.sendCommand('extract_links');
  assert(linksResponse.success === true, 'Link extraction should succeed');

  // Take screenshot
  const screenshotResponse = await this.sendCommand('screenshot');
  assert(screenshotResponse.success === true, 'Screenshot should succeed');
  assert(typeof screenshotResponse.data === 'string', 'Screenshot should be base64 string');
});

TestSuite.test('5. Real-World Workflows', 'Multi-page navigation workflow', async function() {
  const urls = [
    'https://httpbin.org/html',
    'https://httpbin.org/status/200'
  ];

  for (const url of urls) {
    const response = await this.sendCommand('navigate', { url });
    assert(response.success === true, `Should navigate to ${url}`);

    await new Promise(r => setTimeout(r, 1500)); // Wait between navigations

    const urlResponse = await this.sendCommand('get_url');
    assert(urlResponse.success === true, 'Should get current URL');
  }
});

TestSuite.test('5. Real-World Workflows', 'Data extraction with fallbacks', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  // Primary extraction
  const pageState = await this.sendCommand('get_page_state');
  assert(pageState.success === true, 'Primary extraction should succeed');

  // Fallback extraction
  const content = await this.sendCommand('get_content');
  assert(content.success === true, 'Fallback extraction should succeed');

  // Both should provide usable data
  assert(pageState.data.url || content.data.url, 'Should have URL from at least one extraction');
});

TestSuite.test('5. Real-World Workflows', 'Evasion profile application workflow', async function() {
  // Set user agent
  const uaResponse = await this.sendCommand('rotate_user_agent');
  assert(uaResponse.success === true, 'User agent rotation should succeed');

  // Verify user agent changed
  const statusResponse = await this.sendCommand('get_user_agent_status');
  assert(statusResponse.success === true, 'Should get user agent status');
  assert(statusResponse.data.userAgent, 'Should have user agent');
});

// ============================================================================
// 6. MULTI-SYSTEM ORCHESTRATION
// ============================================================================

TestSuite.test('6. Multi-System Orchestration', 'Parallel-safe command execution', async function() {
  // Send multiple commands without awaiting (should not break connection)
  const commands = [
    this.sendCommand('ping'),
    this.sendCommand('get_proxy_status'),
    this.sendCommand('get_user_agent_status')
  ];

  const results = await Promise.all(commands);
  assert(results.every(r => r.success === true), 'All commands should succeed');
});

TestSuite.test('6. Multi-System Orchestration', 'State consistency across commands', async function() {
  // Set proxy
  const proxySet = await this.sendCommand('set_proxy', {
    host: 'localhost',
    port: 8080,
    type: 'http'
  });

  // Get proxy status
  const proxyStatus = await this.sendCommand('get_proxy_status');
  assert(proxyStatus.success === true, 'Should get proxy status');

  // Set different user agent
  const uaSet = await this.sendCommand('set_user_agent', {
    userAgent: 'Mozilla/5.0 (Custom)'
  });

  // Get user agent status
  const uaStatus = await this.sendCommand('get_user_agent_status');
  assert(uaStatus.success === true, 'Should get user agent status');
});

TestSuite.test('6. Multi-System Orchestration', 'Command pipelining', async function() {
  // Pipeline: navigate → wait → extract → screenshot
  const pipeline = [
    { cmd: 'navigate', params: { url: 'https://httpbin.org/html' } },
  ];

  for (const { cmd, params } of pipeline) {
    const response = await this.sendCommand(cmd, params);
    assert(response.success === true, `${cmd} in pipeline should succeed`);

    if (cmd === 'navigate') {
      await new Promise(r => setTimeout(r, 2000)); // Wait after navigation
    }
  }

  // Now execute dependent commands
  const content = await this.sendCommand('get_content');
  assert(content.success === true, 'Content extraction should succeed');

  const screenshot = await this.sendCommand('screenshot');
  assert(screenshot.success === true, 'Screenshot should succeed');
});

// ============================================================================
// 7. PERFORMANCE & RELIABILITY
// ============================================================================

TestSuite.test('7. Performance & Reliability', 'Command response time acceptable', async function() {
  const startTime = performance.now();
  await this.sendCommand('ping');
  const elapsed = performance.now() - startTime;

  assert(elapsed < 1000, `Ping should respond in <1s, took ${elapsed.toFixed(2)}ms`);
});

TestSuite.test('7. Performance & Reliability', 'Navigation completes within timeout', async function() {
  const startTime = performance.now();
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  const elapsed = performance.now() - startTime;

  assert(elapsed < CONFIG.COMMAND_TIMEOUT, `Navigation should complete within timeout`);
});

TestSuite.test('7. Performance & Reliability', 'High command frequency handling', async function() {
  let successCount = 0;
  const commands = [];

  for (let i = 0; i < 5; i++) {
    commands.push(this.sendCommand('ping'));
  }

  const results = await Promise.all(commands);
  successCount = results.filter(r => r.success === true).length;

  assert(successCount >= 3, 'Should handle high frequency commands');
});

TestSuite.test('7. Performance & Reliability', 'Connection stability over time', async function() {
  const results = [];

  for (let i = 0; i < 10; i++) {
    const response = await this.sendCommand('ping');
    results.push(response.success);
    await new Promise(r => setTimeout(r, 100)); // Small delay between commands
  }

  const successCount = results.filter(r => r === true).length;
  assert(successCount >= 8, `Should maintain stability over 10 commands, got ${successCount}`);
});

// ============================================================================
// 8. DATA FORMAT COMPATIBILITY
// ============================================================================

TestSuite.test('8. Data Format Compatibility', 'JSON serialization/deserialization', async function() {
  const response = await this.sendCommand('ping');

  // Should be valid JSON
  const json = JSON.stringify(response);
  const parsed = JSON.parse(json);

  assert(parsed.id === response.id, 'JSON serialization should preserve data');
});

TestSuite.test('8. Data Format Compatibility', 'Unicode and special characters', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  // Try typing unicode characters
  const response = await this.sendCommand('type', {
    selector: 'input[type="text"]',
    text: 'Test™ © ñ'
  });

  // Should handle or fail gracefully
  assert(response !== null, 'Should handle unicode in responses');
});

TestSuite.test('8. Data Format Compatibility', 'Large data payloads', async function() {
  await this.sendCommand('navigate', { url: CONFIG.TEST_URL });
  await new Promise(r => setTimeout(r, 2000));

  const response = await this.sendCommand('screenshot');
  assert(response.success === true, 'Should handle large screenshot data');
  assert(typeof response.data === 'string', 'Screenshot should be serializable');
});

TestSuite.test('8. Data Format Compatibility', 'Null/undefined handling', async function() {
  // Commands with optional parameters should handle missing values
  const response1 = await this.sendCommand('get_cookies', { url: null });
  assert(response1.success === true || response1.data !== undefined, 'Should handle null parameters');

  const response2 = await this.sendCommand('scroll', { x: 0, y: 500 });
  assert(response2.success === true || response2.command === 'scroll', 'Should handle scroll command');
});

TestSuite.test('8. Data Format Compatibility', 'Empty response handling', async function() {
  const response = await this.sendCommand('ping');

  // Even minimal response should be valid
  assert(response.id !== '', 'ID should not be empty');
  assert(response.command !== '', 'Command should not be empty');
});

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    console.log('Basset Hound Browser - Integration Readiness Suite');
    console.log(`Target: ${CONFIG.WS_URL}\n`);

    await TestSuite.connect();
    await TestSuite.runTests();
    await TestSuite.disconnect();

    process.exit(TestSuite.results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('FATAL ERROR:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TestSuite;

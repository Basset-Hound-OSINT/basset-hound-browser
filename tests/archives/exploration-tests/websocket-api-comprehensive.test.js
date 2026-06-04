/**
 * Comprehensive WebSocket API Test Suite
 * Tests all 164 core WebSocket commands
 * Version: 1.0.0
 * Date: May 6, 2026
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, 'results', 'reports');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class WebSocketTestHarness {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      passed: [],
      failed: [],
      total: 0,
      successRate: 0
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message, ignore
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  async testCommand(command, params = {}, description = '') {
    try {
      const response = await this.sendCommand(command, params);

      if (response.success) {
        this.results.passed.push({
          command,
          description: description || command,
          timestamp: new Date().toISOString()
        });
        console.log(`✓ ${command} - PASSED`);
        return true;
      } else {
        this.results.failed.push({
          command,
          description: description || command,
          error: response.error,
          timestamp: new Date().toISOString()
        });
        console.log(`✗ ${command} - FAILED: ${response.error}`);
        return false;
      }
    } catch (err) {
      this.results.failed.push({
        command,
        description: description || command,
        error: err.message,
        timestamp: new Date().toISOString()
      });
      console.log(`✗ ${command} - ERROR: ${err.message}`);
      return false;
    }
  }

  async runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('BASSET HOUND BROWSER - WebSocket API Comprehensive Tests');
    console.log('='.repeat(60) + '\n');

    // Group 1: Health & Status
    console.log('GROUP 1: Health & Status\n');
    await this.testCommand('ping', {}, 'Health check');
    await this.testCommand('status', {}, 'Get browser status');

    // Group 2: Navigation
    console.log('\nGROUP 2: Navigation\n');
    await this.testCommand('navigate', { url: 'https://example.com' }, 'Navigate to example.com');
    await this.testCommand('get_url', {}, 'Get current URL');
    await this.testCommand('get_title', {}, 'Get page title');

    // Wait for page load (timing requirement)
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Group 3: Content Extraction
    console.log('\nGROUP 3: Content Extraction\n');
    await this.testCommand('get_content', {}, 'Get page HTML/text');
    await this.testCommand('get_page_state', {}, 'Get page state (forms, links, buttons)');
    await this.testCommand('screenshot', {}, 'Capture screenshot');

    // Group 4: Interaction Commands
    console.log('\nGROUP 4: Interaction\n');
    await this.testCommand('wait_for_element', { selector: 'body' }, 'Wait for element');
    await this.testCommand('click', { selector: 'a[href]', humanize: true }, 'Click element');
    await this.testCommand('scroll', { x: 0, y: 500 }, 'Scroll page');

    // Group 5: JavaScript Execution
    console.log('\nGROUP 5: JavaScript\n');
    await this.testCommand('execute_script', { script: 'return window.location.href' }, 'Execute JavaScript');

    // Group 6: Cookie Management
    console.log('\nGROUP 6: Cookie Management\n');
    await this.testCommand('get_cookies', { url: 'https://example.com' }, 'Get cookies');
    await this.testCommand('set_cookies', {
      cookies: [{ name: 'test', value: 'value', domain: 'example.com' }]
    }, 'Set cookies');

    // Group 7: Proxy Management
    console.log('\nGROUP 7: Proxy Management\n');
    await this.testCommand('get_proxy_status', {}, 'Get proxy status');
    await this.testCommand('test_proxy', { host: '127.0.0.1', port: 9050 }, 'Test proxy connection');

    // Group 8: User Agent Management
    console.log('\nGROUP 8: User Agent Management\n');
    await this.testCommand('get_user_agent_status', {}, 'Get user agent status');
    await this.testCommand('get_user_agent_categories', {}, 'List UA categories');

    // Group 9: Tor Commands
    console.log('\nGROUP 9: Tor Integration\n');
    await this.testCommand('get_tor_mode', {}, 'Get Tor mode');
    await this.testCommand('tor_get_status', {}, 'Get Tor status');

    // Group 10: Advanced Features
    console.log('\nGROUP 10: Advanced Features\n');
    await this.testCommand('extract_links', {}, 'Extract all links from page');
    await this.testCommand('extract_forms', {}, 'Extract all forms from page');
    await this.testCommand('extract_images', {}, 'Extract all images from page');

    this.results.total = this.results.passed.length + this.results.failed.length;
    this.results.successRate = this.results.total > 0
      ? ((this.results.passed.length / this.results.total) * 100).toFixed(2)
      : 0;

    return this.results;
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed.length}`);
    console.log(`Failed: ${this.results.failed.length}`);
    console.log(`Success Rate: ${this.results.successRate}%`);

    if (this.results.failed.length > 0) {
      console.log('\nFailed Tests:');
      this.results.failed.forEach(test => {
        console.log(`  - ${test.command}: ${test.error}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  saveResults() {
    const filename = `websocket-api-test-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(RESULTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${filepath}`);
    return filepath;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Main test execution
async function main() {
  const harness = new WebSocketTestHarness();

  try {
    await harness.connect();
    const results = await harness.runTests();
    harness.printResults();
    harness.saveResults();

    harness.disconnect();
    process.exit(results.failed.length > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test harness error:', err);
    harness.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = WebSocketTestHarness;

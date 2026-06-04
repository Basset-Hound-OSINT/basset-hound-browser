/**
 * Basset Hound Browser - Integration Tests
 *
 * Comprehensive integration tests for the Electron-based browser's
 * WebSocket server, command handling, and bot detection evasion.
 *
 * Prerequisites:
 * - Node.js installed
 * - Basset Hound Browser running (npm start)
 *
 * Usage:
 *   node integration.test.js           - Run all tests
 *   node integration.test.js --evasion - Run only evasion tests
 *   node integration.test.js --verbose - Verbose output
 */

const WebSocket = require('ws');
const assert = require('assert');
const path = require('path');

// Configuration
const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  TEST_PAGE_URL: `file://${path.join(__dirname, 'test-server.html')}`,
  VERBOSE: process.argv.includes('--verbose') || process.argv.includes('-v')
};

// Test state
let ws = null;
let messageId = 1;
const pendingCommands = new Map();
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// =============================================================================
// WebSocket Client
// =============================================================================

/**
 * Connect to WebSocket server
 */
function connect(url = CONFIG.WS_URL) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, CONFIG.CONNECT_TIMEOUT);

    ws = new WebSocket(url);

    ws.on('open', () => {
      clearTimeout(timeout);
      log('Connected to WebSocket server');
      resolve(ws);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message);
      } catch (error) {
        log(`Failed to parse message: ${error.message}`, 'ERROR');
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      log('WebSocket connection closed');
    });
  });
}

/**
 * Handle incoming messages
 */
function handleMessage(message) {
  if (CONFIG.VERBOSE) {
    log(`Received: ${JSON.stringify(message)}`);
  }

  if (message.id && pendingCommands.has(message.id)) {
    const { resolve } = pendingCommands.get(message.id);
    pendingCommands.delete(message.id);
    resolve(message);
  }
}

/**
 * Send command and wait for response
 */
function sendCommand(command, params = {}, timeout = CONFIG.COMMAND_TIMEOUT) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected'));
      return;
    }

    const id = `msg-${Date.now()}-${messageId++}`;
    const message = { id, command, ...params };

    const timeoutId = setTimeout(() => {
      pendingCommands.delete(id);
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    pendingCommands.set(id, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      }
    });

    if (CONFIG.VERBOSE) {
      log(`Sending: ${JSON.stringify(message)}`);
    }

    ws.send(JSON.stringify(message));
  });
}

/**
 * Disconnect from server
 */
function disconnect() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Log with timestamp
 */
function log(message, level = 'INFO') {
  if (CONFIG.VERBOSE || level === 'ERROR' || level === 'RESULT') {
    console.log(`[${new Date().toISOString()}] [${level}] ${message}`);
  }
}

/**
 * Create a test case
 */
function test(name, fn) {
  return async () => {
    log(`Running: ${name}`, 'TEST');
    const startTime = Date.now();

    try {
      await fn();
      const duration = Date.now() - startTime;
      testResults.passed++;
      testResults.tests.push({ name, status: 'PASSED', duration });
      log(`PASSED: ${name} (${duration}ms)`, 'RESULT');
      return true;
    } catch (error) {
      const duration = Date.now() - startTime;
      testResults.failed++;
      testResults.tests.push({ name, status: 'FAILED', duration, error: error.message });
      log(`FAILED: ${name} - ${error.message}`, 'ERROR');
      if (CONFIG.VERBOSE) {
        console.error(error.stack);
      }
      return false;
    }
  };
}

/**
 * Skip a test
 */
function skip(name, reason = '') {
  return async () => {
    testResults.skipped++;
    testResults.tests.push({ name, status: 'SKIPPED', reason });
    log(`SKIPPED: ${name}${reason ? ' - ' + reason : ''}`, 'RESULT');
    return true;
  };
}

// =============================================================================
// Test Suites
// =============================================================================

/**
 * Connection Tests
 */
const connectionTests = {
  name: 'Connection Tests',
  tests: [
    test('Should connect to WebSocket server', async () => {
      assert(ws && ws.readyState === WebSocket.OPEN, 'Should be connected');
    }),

    test('Ping command should return pong', async () => {
      const response = await sendCommand('ping');
      assert(response.success === true, 'Ping should succeed');
      assert(response.message === 'pong', 'Should return pong');
      assert(response.timestamp, 'Should have timestamp');
    }),

    test('Status command should return server status', async () => {
      const response = await sendCommand('status');
      assert(response.success === true, 'Status should succeed');
      assert(response.status, 'Should have status object');
      assert(response.status.ready === true, 'Server should be ready');
      assert(typeof response.status.clients === 'number', 'Should have client count');
      assert(typeof response.status.port === 'number', 'Should have port');
    }),

    test('Unknown command should return error', async () => {
      const response = await sendCommand('unknown_command_xyz');
      assert(response.success === false, 'Unknown command should fail');
      assert(response.error, 'Should have error message');
    })
  ]
};

/**
 * Navigation Tests
 */
const navigationTests = {
  name: 'Navigation Tests',
  tests: [
    test('Navigate command should require URL', async () => {
      const response = await sendCommand('navigate', {});
      assert(response.success === false, 'Should fail without URL');
      assert(response.error, 'Should have error message');
    }),

    test('Navigate command should navigate to URL', async () => {
      const response = await sendCommand('navigate', {
        url: 'https://example.com'
      });
      assert(response.success === true, 'Navigate should succeed');
    }),

    test('Navigate command should navigate to test page', async () => {
      const response = await sendCommand('navigate', {
        url: CONFIG.TEST_PAGE_URL
      });
      assert(response.success === true, 'Navigate to test page should succeed');
    }),

    test('Get URL command should return current URL', async () => {
      const response = await sendCommand('get_url');
      assert(response.success === true, 'Get URL should succeed');
      assert(response.url, 'Should have URL');
    })
  ]
};

/**
 * Click Tests
 */
const clickTests = {
  name: 'Click Tests',
  tests: [
    test('Click command should require selector', async () => {
      const response = await sendCommand('click', {});
      assert(response.success === false, 'Should fail without selector');
    }),

    test('Click command should click element by ID', async () => {
      // Navigate to test page first
      await sendCommand('navigate', { url: CONFIG.TEST_PAGE_URL });
      await new Promise(r => setTimeout(r, 1000));

      const response = await sendCommand('click', {
        selector: '#click-test-1'
      });
      assert(response.success === true, 'Click should succeed');
    }),

    test('Click command should support humanize option', async () => {
      const response = await sendCommand('click', {
        selector: '#click-test-2',
        humanize: true
      });
      assert(response.success === true, 'Humanized click should succeed');
    }),

    test('Click command should handle non-existent selector', async () => {
      const response = await sendCommand('click', {
        selector: '#non-existent-element'
      });
      // Should handle gracefully
      assert(response, 'Should get response');
    }),

    test('Click counter should increment', async () => {
      // Reset counter
      await sendCommand('execute_script', {
        script: 'document.getElementById("click-counter").dataset.count = "0"; document.getElementById("click-counter").textContent = "Clicks: 0";'
      });

      // Click the counter
      await sendCommand('click', { selector: '#click-counter' });

      // Verify counter
      const response = await sendCommand('execute_script', {
        script: 'return document.getElementById("click-counter").dataset.count'
      });

      assert(response.result === '1' || response.result === 1, 'Counter should be 1');
    })
  ]
};

/**
 * Fill Tests
 */
const fillTests = {
  name: 'Fill Tests',
  tests: [
    test('Fill command should require selector and value', async () => {
      const response = await sendCommand('fill', {});
      assert(response.success === false, 'Should fail without params');
    }),

    test('Fill command should fill text input', async () => {
      const response = await sendCommand('fill', {
        selector: '#username',
        value: 'testuser'
      });
      assert(response.success === true, 'Fill should succeed');
    }),

    test('Fill command should fill email input', async () => {
      const response = await sendCommand('fill', {
        selector: '#email',
        value: 'test@example.com'
      });
      assert(response.success === true, 'Fill email should succeed');
    }),

    test('Fill command should fill password input', async () => {
      const response = await sendCommand('fill', {
        selector: '#password',
        value: 'SecurePassword123!'
      });
      assert(response.success === true, 'Fill password should succeed');
    }),

    test('Fill command should fill textarea', async () => {
      const response = await sendCommand('fill', {
        selector: '#message',
        value: 'This is a test message with multiple words.'
      });
      assert(response.success === true, 'Fill textarea should succeed');
    }),

    test('Fill command should support humanize option', async () => {
      const response = await sendCommand('fill', {
        selector: '#search-field',
        value: 'search query',
        humanize: true
      });
      assert(response.success === true, 'Humanized fill should succeed');
    }),

    test('Fill command should fill select dropdown', async () => {
      const response = await sendCommand('fill', {
        selector: '#select-option',
        value: 'opt2'
      });
      // Select handling may vary
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Content Tests
 */
const contentTests = {
  name: 'Content Tests',
  tests: [
    test('Get content command should return page content', async () => {
      const response = await sendCommand('get_content');
      assert(response.success === true, 'Get content should succeed');
      // Content structure may vary
      assert(response, 'Should have response');
    }),

    test('Get page state command should return page info', async () => {
      const response = await sendCommand('get_page_state');
      assert(response.success === true, 'Get page state should succeed');
    })
  ]
};

/**
 * Screenshot Tests
 */
const screenshotTests = {
  name: 'Screenshot Tests',
  tests: [
    test('Screenshot command should capture screenshot', async () => {
      const response = await sendCommand('screenshot');
      assert(response.success === true, 'Screenshot should succeed');
      // Screenshot data may vary
    }),

    test('Screenshot command should support format option', async () => {
      const response = await sendCommand('screenshot', { format: 'png' });
      assert(response.success === true, 'PNG screenshot should succeed');
    })
  ]
};

/**
 * Script Execution Tests
 */
const scriptTests = {
  name: 'Script Execution Tests',
  tests: [
    test('Execute script command should require script', async () => {
      const response = await sendCommand('execute_script', {});
      assert(response.success === false, 'Should fail without script');
    }),

    test('Execute script should return result', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return 1 + 1'
      });
      assert(response.success === true, 'Script should succeed');
      assert(response.result === 2, 'Result should be 2');
    }),

    test('Execute script should access DOM', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return document.title'
      });
      assert(response.success === true, 'Script should succeed');
      assert(typeof response.result === 'string', 'Should return title');
    }),

    test('Execute script should handle errors', async () => {
      const response = await sendCommand('execute_script', {
        script: 'throw new Error("Test error")'
      });
      assert(response.success === false, 'Should fail with error');
    }),

    test('Execute script should modify DOM', async () => {
      await sendCommand('execute_script', {
        script: 'document.getElementById("username").value = "script-value"'
      });

      const response = await sendCommand('execute_script', {
        script: 'return document.getElementById("username").value'
      });

      assert(response.result === 'script-value', 'Value should be set');
    })
  ]
};

/**
 * Wait for Element Tests
 */
const waitTests = {
  name: 'Wait for Element Tests',
  tests: [
    test('Wait command should require selector', async () => {
      const response = await sendCommand('wait_for_element', {});
      assert(response.success === false, 'Should fail without selector');
    }),

    test('Wait command should find existing element', async () => {
      const response = await sendCommand('wait_for_element', {
        selector: 'body',
        timeout: 5000
      });
      assert(response.success === true, 'Wait should succeed');
    }),

    test('Wait command should timeout for non-existent element', async () => {
      const startTime = Date.now();
      const response = await sendCommand('wait_for_element', {
        selector: '#element-that-will-never-exist',
        timeout: 2000
      });
      const duration = Date.now() - startTime;

      assert(duration >= 1500, 'Should wait for timeout');
      assert(response.success === false || !response.found, 'Element should not be found');
    })
  ]
};

/**
 * Scroll Tests
 */
const scrollTests = {
  name: 'Scroll Tests',
  tests: [
    test('Scroll command should scroll to position', async () => {
      const response = await sendCommand('scroll', {
        x: 0,
        y: 500
      });
      assert(response.success === true, 'Scroll should succeed');
    }),

    test('Scroll command should scroll to element', async () => {
      const response = await sendCommand('scroll', {
        selector: '#test-form'
      });
      assert(response.success === true, 'Scroll to element should succeed');
    }),

    test('Scroll command should support humanize', async () => {
      const response = await sendCommand('scroll', {
        y: 200,
        humanize: true
      });
      assert(response.success === true, 'Humanized scroll should succeed');
    })
  ]
};

/**
 * Cookie Tests
 */
const cookieTests = {
  name: 'Cookie Tests',
  tests: [
    test('Get cookies command should require URL', async () => {
      const response = await sendCommand('get_cookies', {});
      assert(response.success === false, 'Should fail without URL');
    }),

    test('Get cookies should return cookies array', async () => {
      const response = await sendCommand('get_cookies', {
        url: 'https://example.com'
      });
      assert(response.success === true, 'Get cookies should succeed');
      assert(Array.isArray(response.cookies), 'Should return array');
    }),

    test('Set cookies command should require cookies array', async () => {
      const response = await sendCommand('set_cookies', {});
      assert(response.success === false, 'Should fail without cookies');
    }),

    test('Set cookies should set cookie', async () => {
      const response = await sendCommand('set_cookies', {
        cookies: [{
          name: 'test_cookie',
          value: 'test_value',
          url: 'https://example.com'
        }]
      });
      assert(response.success === true, 'Set cookies should succeed');
    })
  ]
};

/**
 * Bot Detection Evasion Tests
 */
const evasionTests = {
  name: 'Bot Detection Evasion Tests',
  tests: [
    test('navigator.webdriver should be undefined', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.webdriver'
      });
      assert(response.result === undefined || response.result === null, 'webdriver should be undefined');
    }),

    test('navigator.plugins should exist and have items', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.plugins && navigator.plugins.length > 0'
      });
      assert(response.result === true, 'plugins should exist');
    }),

    test('navigator.languages should exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.languages && navigator.languages.length > 0'
      });
      assert(response.result === true, 'languages should exist');
    }),

    test('window.chrome should exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return typeof window.chrome !== "undefined"'
      });
      assert(response.result === true, 'chrome object should exist');
    }),

    test('Selenium properties should not exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return typeof window._selenium === "undefined" && typeof window.callSelenium === "undefined"'
      });
      assert(response.result === true, 'Selenium properties should not exist');
    }),

    test('Phantom properties should not exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return typeof window._phantom === "undefined" && typeof window.callPhantom === "undefined"'
      });
      assert(response.result === true, 'Phantom properties should not exist');
    }),

    test('Webdriver script function should not exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return typeof document.__webdriver_script_fn === "undefined"'
      });
      assert(response.result === true, 'Webdriver script function should not exist');
    }),

    test('Permissions API should work', async () => {
      const response = await sendCommand('execute_script', {
        script: `
          return new Promise(resolve => {
            navigator.permissions.query({name: 'notifications'})
              .then(() => resolve(true))
              .catch(() => resolve(false));
          });
        `
      });
      assert(response.result === true, 'Permissions API should work');
    }),

    test('User agent should look realistic', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.userAgent'
      });
      const ua = response.result || '';
      assert(
        ua.includes('Chrome') || ua.includes('Firefox') || ua.includes('Safari'),
        'User agent should look realistic'
      );
    }),

    test('Screen dimensions should exist', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return screen.width > 0 && screen.height > 0'
      });
      assert(response.result === true, 'Screen dimensions should exist');
    }),

    test('Device memory should be defined', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.deviceMemory > 0'
      });
      assert(response.result === true, 'Device memory should be defined');
    }),

    test('Hardware concurrency should be defined', async () => {
      const response = await sendCommand('execute_script', {
        script: 'return navigator.hardwareConcurrency > 0'
      });
      assert(response.result === true, 'Hardware concurrency should be defined');
    }),

    test('WebGL vendor should return string', async () => {
      const response = await sendCommand('execute_script', {
        script: `
          try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return debugInfo && gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL).length > 0;
          } catch {
            return false;
          }
        `
      });
      assert(response.result === true, 'WebGL vendor should exist');
    }),

    test('WebGL renderer should return string', async () => {
      const response = await sendCommand('execute_script', {
        script: `
          try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return debugInfo && gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).length > 0;
          } catch {
            return false;
          }
        `
      });
      assert(response.result === true, 'WebGL renderer should exist');
    }),

    test('Canvas fingerprint should work', async () => {
      const response = await sendCommand('execute_script', {
        script: `
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('test', 0, 0);
            return canvas.toDataURL().length > 0;
          } catch {
            return false;
          }
        `
      });
      assert(response.result === true, 'Canvas fingerprint should work');
    }),

    test('Timezone offset should be valid', async () => {
      const response = await sendCommand('execute_script', {
        script: `
          const offset = new Date().getTimezoneOffset();
          return typeof offset === 'number' && offset >= -720 && offset <= 720;
        `
      });
      assert(response.result === true, 'Timezone offset should be valid');
    })
  ]
};

/**
 * Error Handling Tests
 */
const errorTests = {
  name: 'Error Handling Tests',
  tests: [
    test('Malformed selector should be handled', async () => {
      const response = await sendCommand('click', {
        selector: '[]invalid[selector'
      });
      // Should not crash
      assert(response, 'Should get response');
    }),

    test('Empty command should fail gracefully', async () => {
      const response = await sendCommand('');
      assert(response.success === false, 'Empty command should fail');
    }),

    test('Null parameters should be handled', async () => {
      const response = await sendCommand('fill', {
        selector: null,
        value: null
      });
      assert(response.success === false, 'Null params should fail');
    }),

    test('Large script should be handled', async () => {
      const largeScript = `return "${'a'.repeat(10000)}"`;
      const response = await sendCommand('execute_script', {
        script: largeScript
      });
      // Should handle large scripts
      assert(response, 'Should get response');
    })
  ]
};

/**
 * Edge Case Tests
 */
const edgeCaseTests = {
  name: 'Edge Case Tests',
  tests: [
    test('Should handle special characters in values', async () => {
      const response = await sendCommand('fill', {
        selector: '#username',
        value: '<script>alert(1)</script>'
      });
      assert(response.success === true, 'Should handle special chars');
    }),

    test('Should handle Unicode characters', async () => {
      const response = await sendCommand('fill', {
        selector: '#username',
        value: ''
      });
      assert(response.success === true, 'Should handle unicode');
    }),

    test('Should handle rapid commands', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(sendCommand('ping'));
      }
      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success === true).length;
      assert(successCount >= 3, 'Most rapid commands should succeed');
    }),

    test('Should maintain state across commands', async () => {
      await sendCommand('fill', {
        selector: '#username',
        value: 'state_test_user'
      });

      const response = await sendCommand('execute_script', {
        script: 'return document.getElementById("username").value'
      });

      assert(response.result === 'state_test_user', 'State should persist');
    })
  ]
};

// =============================================================================
// Test Runner
// =============================================================================

/**
 * Run all test suites
 */
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('Basset Hound Browser - Integration Tests');
  console.log('='.repeat(60));
  console.log();

  // Determine which suites to run
  const evasionOnly = process.argv.includes('--evasion') || process.argv.includes('-e');

  const testSuites = evasionOnly
    ? [evasionTests]
    : [
        connectionTests,
        navigationTests,
        clickTests,
        fillTests,
        contentTests,
        screenshotTests,
        scriptTests,
        waitTests,
        scrollTests,
        cookieTests,
        evasionTests,
        errorTests,
        edgeCaseTests
      ];

  for (const suite of testSuites) {
    console.log();
    console.log('-'.repeat(60));
    console.log(`Suite: ${suite.name}`);
    console.log('-'.repeat(60));

    for (const testFn of suite.tests) {
      try {
        await testFn();
      } catch (error) {
        log(`Suite error: ${error.message}`, 'ERROR');
      }
    }
  }

  // Print summary
  console.log();
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Passed:  ${testResults.passed}`);
  console.log(`Failed:  ${testResults.failed}`);
  console.log(`Skipped: ${testResults.skipped}`);
  console.log(`Total:   ${testResults.tests.length}`);
  console.log();

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
    console.log();
  }

  return testResults.failed === 0;
}

/**
 * Main entry point
 */
async function main() {
  console.log('Connecting to Basset Hound Browser...');
  console.log(`WebSocket URL: ${CONFIG.WS_URL}`);
  console.log();

  try {
    await connect();

    // Navigate to test page
    log('Navigating to test page...');
    await sendCommand('navigate', { url: CONFIG.TEST_PAGE_URL });
    await new Promise(r => setTimeout(r, 2000));

    const success = await runAllTests();

    disconnect();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('Error:', error.message);
    console.log();
    console.log('Make sure the Basset Hound Browser is running:');
    console.log('  npm start');
    console.log();
    disconnect();
    process.exit(1);
  }
}

// Export for external use
module.exports = {
  connect,
  disconnect,
  sendCommand,
  runAllTests,
  testResults,
  test,
  skip,
  CONFIG
};

// Run if called directly
if (require.main === module) {
  main();
}

// Jest wrapper for integration tests
// Skip in CI or when SKIP_INTEGRATION_TESTS is set (requires running Basset Hound Browser)
const shouldSkipJest = process.env.CI === 'true' || process.env.SKIP_INTEGRATION_TESTS === 'true';

describe('Basset Hound Integration Tests', () => {
  (shouldSkipJest ? it.skip : it)('integration tests require running Basset Hound Browser', async () => {
    await connect();
    await sendCommand('navigate', { url: CONFIG.TEST_PAGE_URL });
    await new Promise(r => setTimeout(r, 2000));
    const success = await runAllTests();
    disconnect();
    expect(success).toBe(true);
  }, 300000);
});

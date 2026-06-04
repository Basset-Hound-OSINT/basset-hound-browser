/**
 * Basset Hound Browser - WebSocket Test Client
 *
 * A test client for connecting to the Basset Hound Browser's WebSocket server
 * and sending automation commands.
 *
 * Usage: node test-client.js [port]
 * Default port: 8765
 */

const WebSocket = require('ws');

// Configuration
const PORT = process.argv[2] ? parseInt(process.argv[2]) : 8765;
const WS_URL = `ws://localhost:${PORT}`;

// State tracking
const state = {
  connected: false,
  commandQueue: [],
  responseQueue: [],
  pendingCommands: new Map(),
  messageId: 1,
  lastResponse: null,
  connectionTime: null
};

/**
 * Generate unique message ID
 */
function generateId() {
  return `msg-${Date.now()}-${state.messageId++}`;
}

/**
 * Create WebSocket client connection
 */
function createClient(url = WS_URL) {
  return new Promise((resolve, reject) => {
    console.log(`[Client] Connecting to ${url}...`);

    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      state.connected = true;
      state.connectionTime = new Date();
      console.log(`[Client] Connected to ${url}`);
      resolve(ws);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(message);
      } catch (error) {
        console.error('[Client] Failed to parse message:', error);
      }
    });

    ws.on('close', (code, reason) => {
      state.connected = false;
      console.log(`[Client] Disconnected (code: ${code})`);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[Client] Connection error:', error.message);
      reject(error);
    });
  });
}

/**
 * Handle incoming messages
 */
function handleMessage(message) {
  console.log('[Client] Received:', JSON.stringify(message, null, 2));
  state.lastResponse = message;
  state.responseQueue.push(message);

  // Resolve pending command if this is a response
  if (message.id && state.pendingCommands.has(message.id)) {
    const { resolve } = state.pendingCommands.get(message.id);
    state.pendingCommands.delete(message.id);
    resolve(message);
  }
}

/**
 * Send command to server
 */
function sendCommand(ws, command, params = {}, timeout = 30000) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error('Not connected'));
      return;
    }

    const id = generateId();
    const message = {
      id,
      command,
      ...params
    };

    console.log('[Client] Sending:', JSON.stringify(message, null, 2));

    const timeoutId = setTimeout(() => {
      state.pendingCommands.delete(id);
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    state.pendingCommands.set(id, {
      resolve: (response) => {
        clearTimeout(timeoutId);
        resolve(response);
      },
      reject,
      sentAt: Date.now()
    });

    ws.send(JSON.stringify(message));
    state.commandQueue.push(message);
  });
}

/**
 * Command shortcuts
 */
const commands = {
  // Navigation
  navigate: (ws, url) => sendCommand(ws, 'navigate', { url }),

  // Click element
  click: (ws, selector, humanize = true) =>
    sendCommand(ws, 'click', { selector, humanize }),

  // Fill form field
  fill: (ws, selector, value, humanize = true) =>
    sendCommand(ws, 'fill', { selector, value, humanize }),

  // Get page content
  getContent: (ws) => sendCommand(ws, 'get_content'),

  // Capture screenshot
  screenshot: (ws, format = 'png') =>
    sendCommand(ws, 'screenshot', { format }),

  // Get page state
  getPageState: (ws) => sendCommand(ws, 'get_page_state'),

  // Execute script
  executeScript: (ws, script) =>
    sendCommand(ws, 'execute_script', { script }),

  // Wait for element
  waitForElement: (ws, selector, timeout = 10000) =>
    sendCommand(ws, 'wait_for_element', { selector, timeout }),

  // Scroll
  scroll: (ws, x, y, selector, humanize = true) =>
    sendCommand(ws, 'scroll', { x, y, selector, humanize }),

  // Get cookies
  getCookies: (ws, url) => sendCommand(ws, 'get_cookies', { url }),

  // Set cookies
  setCookies: (ws, cookies) => sendCommand(ws, 'set_cookies', { cookies }),

  // Get current URL
  getUrl: (ws) => sendCommand(ws, 'get_url'),

  // Ping/health check
  ping: (ws) => sendCommand(ws, 'ping'),

  // Get server status
  status: (ws) => sendCommand(ws, 'status')
};

/**
 * Run a sequence of test commands
 */
async function runTestSequence(ws) {
  const results = [];

  console.log('\n' + '='.repeat(60));
  console.log('Running Test Sequence');
  console.log('='.repeat(60) + '\n');

  const testCases = [
    {
      name: 'Ping server',
      fn: () => commands.ping(ws)
    },
    {
      name: 'Get server status',
      fn: () => commands.status(ws)
    },
    {
      name: 'Navigate to test page',
      fn: () => commands.navigate(ws, 'https://example.com')
    },
    {
      name: 'Wait for body element',
      fn: () => commands.waitForElement(ws, 'body', 5000)
    },
    {
      name: 'Get page content',
      fn: () => commands.getContent(ws)
    },
    {
      name: 'Get page state',
      fn: () => commands.getPageState(ws)
    },
    {
      name: 'Get current URL',
      fn: () => commands.getUrl(ws)
    },
    {
      name: 'Take screenshot',
      fn: () => commands.screenshot(ws)
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n--- Test: ${testCase.name} ---`);
    try {
      const startTime = Date.now();
      const result = await testCase.fn();
      const duration = Date.now() - startTime;

      results.push({
        name: testCase.name,
        success: result.success !== false,
        duration,
        result
      });

      console.log(`Result: ${result.success !== false ? 'PASS' : 'FAIL'} (${duration}ms)`);
    } catch (error) {
      results.push({
        name: testCase.name,
        success: false,
        error: error.message
      });
      console.log(`Result: FAIL - ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error || 'Failed'}`);
    });
  }

  return results;
}

/**
 * Interactive CLI mode
 */
async function startInteractive(ws) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n[Client] Interactive mode. Commands:');
  console.log('  ping                    - Ping server');
  console.log('  status                  - Get server status');
  console.log('  navigate <url>          - Navigate to URL');
  console.log('  click <selector>        - Click element');
  console.log('  fill <selector> <value> - Fill form field');
  console.log('  content                 - Get page content');
  console.log('  state                   - Get page state');
  console.log('  url                     - Get current URL');
  console.log('  screenshot              - Take screenshot');
  console.log('  wait <selector>         - Wait for element');
  console.log('  scroll <x> <y>          - Scroll to position');
  console.log('  script <code>           - Execute JavaScript');
  console.log('  cookies <url>           - Get cookies');
  console.log('  test                    - Run test sequence');
  console.log('  history                 - Show command history');
  console.log('  quit                    - Disconnect and exit\n');

  const prompt = () => {
    rl.question('> ', async (input) => {
      const parts = input.trim().split(' ');
      const cmd = parts[0].toLowerCase();

      try {
        let response;

        switch (cmd) {
          case 'ping':
            response = await commands.ping(ws);
            console.log('Response:', JSON.stringify(response, null, 2));
            break;

          case 'status':
            response = await commands.status(ws);
            console.log('Response:', JSON.stringify(response, null, 2));
            break;

          case 'navigate':
            if (parts[1]) {
              response = await commands.navigate(ws, parts[1]);
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: navigate <url>');
            }
            break;

          case 'click':
            if (parts[1]) {
              response = await commands.click(ws, parts.slice(1).join(' '));
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: click <selector>');
            }
            break;

          case 'fill':
            if (parts[1] && parts[2]) {
              response = await commands.fill(ws, parts[1], parts.slice(2).join(' '));
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: fill <selector> <value>');
            }
            break;

          case 'content':
            response = await commands.getContent(ws);
            console.log('Response:', JSON.stringify(response, null, 2));
            break;

          case 'state':
            response = await commands.getPageState(ws);
            console.log('Response:', JSON.stringify(response, null, 2));
            break;

          case 'url':
            response = await commands.getUrl(ws);
            console.log('Response:', JSON.stringify(response, null, 2));
            break;

          case 'screenshot':
            response = await commands.screenshot(ws);
            console.log('Screenshot captured, length:', response.screenshot?.length || 0);
            break;

          case 'wait':
            if (parts[1]) {
              response = await commands.waitForElement(ws, parts.slice(1).join(' '));
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: wait <selector>');
            }
            break;

          case 'scroll':
            if (parts[1] && parts[2]) {
              response = await commands.scroll(ws, parseInt(parts[1]), parseInt(parts[2]));
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: scroll <x> <y>');
            }
            break;

          case 'script':
            if (parts[1]) {
              response = await commands.executeScript(ws, parts.slice(1).join(' '));
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: script <code>');
            }
            break;

          case 'cookies':
            if (parts[1]) {
              response = await commands.getCookies(ws, parts[1]);
              console.log('Response:', JSON.stringify(response, null, 2));
            } else {
              console.log('Usage: cookies <url>');
            }
            break;

          case 'test':
            await runTestSequence(ws);
            break;

          case 'history':
            console.log('Command history:');
            state.commandQueue.slice(-10).forEach((cmd, i) => {
              console.log(`  ${i + 1}. ${cmd.command} (${cmd.id})`);
            });
            break;

          case 'quit':
          case 'exit':
            console.log('Disconnecting...');
            ws.close();
            rl.close();
            process.exit(0);
            break;

          default:
            if (cmd) {
              console.log(`Unknown command: ${cmd}`);
            }
        }
      } catch (error) {
        console.error('Error:', error.message);
      }

      prompt();
    });
  };

  prompt();
}

/**
 * Test bot detection evasion
 */
async function testBotDetection(ws) {
  console.log('\n' + '='.repeat(60));
  console.log('Bot Detection Evasion Tests');
  console.log('='.repeat(60) + '\n');

  const tests = [
    {
      name: 'navigator.webdriver should be undefined',
      script: 'return navigator.webdriver'
    },
    {
      name: 'navigator.plugins should exist',
      script: 'return navigator.plugins.length > 0'
    },
    {
      name: 'navigator.languages should exist',
      script: 'return navigator.languages && navigator.languages.length > 0'
    },
    {
      name: 'window.chrome should exist',
      script: 'return typeof window.chrome !== "undefined"'
    },
    {
      name: 'Selenium properties should not exist',
      script: 'return typeof window._selenium === "undefined" && typeof window.callSelenium === "undefined"'
    },
    {
      name: 'Phantom properties should not exist',
      script: 'return typeof window._phantom === "undefined" && typeof window.callPhantom === "undefined"'
    },
    {
      name: 'Webdriver properties should not exist',
      script: 'return typeof document.__webdriver_script_fn === "undefined"'
    },
    {
      name: 'Permissions query should work',
      script: `
        return new Promise(resolve => {
          navigator.permissions.query({name: 'notifications'})
            .then(() => resolve(true))
            .catch(() => resolve(false));
        });
      `
    },
    {
      name: 'User agent should look realistic',
      script: 'return navigator.userAgent.includes("Chrome") || navigator.userAgent.includes("Firefox")'
    },
    {
      name: 'Screen dimensions should exist',
      script: 'return screen.width > 0 && screen.height > 0'
    },
    {
      name: 'Device memory should exist',
      script: 'return navigator.deviceMemory > 0'
    },
    {
      name: 'Hardware concurrency should exist',
      script: 'return navigator.hardwareConcurrency > 0'
    }
  ];

  const results = [];

  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    try {
      const response = await commands.executeScript(ws, test.script);
      const passed = response.success && response.result === true;
      results.push({ name: test.name, passed, result: response.result });
      console.log(`  Result: ${passed ? 'PASS' : 'FAIL'} (${JSON.stringify(response.result)})`);
    } catch (error) {
      results.push({ name: test.name, passed: false, error: error.message });
      console.log(`  Result: ERROR - ${error.message}`);
    }
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '-'.repeat(40));
  console.log(`Bot Detection Evasion: ${passed}/${results.length} tests passed`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
    });
  }

  return results;
}

// Export for programmatic use
module.exports = {
  createClient,
  sendCommand,
  commands,
  runTestSequence,
  testBotDetection,
  state,
  generateId
};

// Run if called directly
if (require.main === module) {
  const isInteractive = process.argv.includes('--interactive') || process.argv.includes('-i');
  const runTests = process.argv.includes('--test') || process.argv.includes('-t');
  const testEvasion = process.argv.includes('--evasion') || process.argv.includes('-e');

  createClient()
    .then(async (ws) => {
      if (testEvasion) {
        await testBotDetection(ws);
        ws.close();
        process.exit(0);
      } else if (runTests) {
        const results = await runTestSequence(ws);
        ws.close();
        const failed = results.filter(r => !r.success).length;
        process.exit(failed > 0 ? 1 : 0);
      } else if (isInteractive || process.stdin.isTTY) {
        await startInteractive(ws);
      } else {
        console.log('Connected. Use --interactive for CLI mode or --test to run tests.');
        // Keep connection open
      }
    })
    .catch((error) => {
      console.error('Failed to connect:', error.message);
      console.log('\nMake sure the Basset Hound Browser is running.');
      console.log('Start it with: npm start');
      process.exit(1);
    });
}

const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8765');
let messageId = 0;
let testsPassed = 0;
let testsFailed = 0;
let testsTotal = 0;

const TESTS = [
  { name: 'Navigation: example.com', cmd: 'navigate', params: { url: 'https://example.com' } },
  { name: 'Navigation: httpbin.org', cmd: 'navigate', params: { url: 'https://httpbin.org' } },
  { name: 'Navigation: example.org', cmd: 'navigate', params: { url: 'https://example.org' } },
  { name: 'Screenshot 1 (viewport)', cmd: 'screenshot_viewport', params: { format: 'png' } },
  { name: 'Screenshot 2 (viewport)', cmd: 'screenshot_viewport', params: { format: 'png' } },
  { name: 'Content extraction 1', cmd: 'navigate', params: { url: 'https://example.com' } },
  { name: 'Get content 1', cmd: 'get_content', params: {} },
  { name: 'Content extraction 2', cmd: 'navigate', params: { url: 'https://httpbin.org/html' } },
  { name: 'Get content 2', cmd: 'get_content', params: {} },
  { name: 'Tab: create', cmd: 'new_tab', params: {} },
  { name: 'Tab: list', cmd: 'list_tabs', params: {} },
  { name: 'Tab: close', cmd: 'close_tab', params: { tabId: undefined } }
];

let currentTabId = null;
let runIndex = 0;

ws.on('open', () => {
  console.log('[v11.3.0-fixed] WebSocket Server Validation Test');
  console.log('==============================================\n');
  runNextTest();
});

ws.on('error', (err) => {
  console.error('WebSocket Error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n==============================================');
  console.log(`RESULTS: ${testsPassed}/${testsTotal} PASS (${((testsPassed / testsTotal) * 100).toFixed(1)}%)`);
  console.log('==============================================');
  process.exit(testsPassed === testsTotal ? 0 : 1);
});

function runNextTest() {
  if (runIndex >= TESTS.length) {
    ws.close();
    return;
  }

  const test = TESTS[runIndex];
  testsTotal++;

  // Special handling for tab close
  if (test.name === 'Tab: close' && currentTabId) {
    test.params.tabId = currentTabId;
  }

  const id = ++messageId;

  const timeout = setTimeout(() => {
    testsFailed++;
    console.log(`[FAIL] ${test.name} - TIMEOUT`);
    runIndex++;
    runNextTest();
  }, 5000);

  ws.send(JSON.stringify({ command: test.cmd, params: test.params, id }));

  const handler = (data) => {
    clearTimeout(timeout);
    try {
      const response = JSON.parse(data);
      if (response.id === id) {
        ws.removeListener('message', handler);

        if (response.success) {
          testsPassed++;
          console.log(`[PASS] ${test.name}`);
          if (test.cmd === 'new_tab' && response.tab && response.tab.id) {
            currentTabId = response.tab.id;
          }
        } else {
          testsFailed++;
          console.log(`[FAIL] ${test.name} - ${response.error || 'unknown error'}`);
        }

        runIndex++;
        setTimeout(runNextTest, 500);
      }
    } catch (e) {
      // Wait for valid response
    }
  };

  ws.on('message', handler);
}

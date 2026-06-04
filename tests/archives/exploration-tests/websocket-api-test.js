/**
 * Comprehensive WebSocket API Test with Timing for basset-hound-browser
 * Tests commands that require webview to be ready after navigation
 */

const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

const results = { passed: [], failed: [] };

// Test sequence (with delays where needed)
const testSequence = [
  // Step 1: Navigate to a page first
  { name: 'navigate', cmd: 'navigate', params: { url: 'https://example.com' }, wait: 4000 },

  // Step 2: Now test commands that need webview (after page load)
  { name: 'get_page_state', cmd: 'get_page_state', params: {} },
  { name: 'get_content', cmd: 'get_content', params: {} },
  { name: 'execute_script', cmd: 'execute_script', params: { script: 'document.title' } },
  { name: 'screenshot', cmd: 'screenshot', params: {} },

  // Step 3: Test other commands
  { name: 'get_cookies', cmd: 'get_cookies', params: {} },
  { name: 'get_all_cookies', cmd: 'get_all_cookies', params: {} },
  { name: 'list_sessions', cmd: 'list_sessions', params: {} },
  { name: 'list_tabs', cmd: 'list_tabs', params: {} },
  { name: 'get_memory_usage', cmd: 'get_memory_usage', params: {} },
  { name: 'start_network_capture', cmd: 'start_network_capture', params: {} },
];

let testIndex = 0;

function runNextTest() {
  if (testIndex >= testSequence.length) {
    printResults();
    ws.close();
    return;
  }

  const test = testSequence[testIndex];
  const id = testIndex + 1;
  const msg = { id, command: test.cmd, ...test.params };

  console.log(`[${id}/${testSequence.length}] ${test.name}...`);
  ws.send(JSON.stringify(msg));
}

ws.on('open', () => {
  console.log('=== WebSocket API Test (with timing) ===\n');
  runNextTest();
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'status') return;

  const test = testSequence[msg.id - 1];
  if (!test) return;

  if (msg.success) {
    results.passed.push(test.name);
    const preview = JSON.stringify(msg.result || msg).substring(0, 80);
    console.log(`  ✓ PASS: ${preview}...`);
  } else {
    results.failed.push({ name: test.name, error: msg.error });
    console.log(`  ✗ FAIL: ${msg.error}`);
  }

  testIndex++;

  // Wait if specified, then run next test
  const waitTime = test.wait || 200;
  setTimeout(runNextTest, waitTime);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

function printResults() {
  console.log('\n=== RESULTS ===');
  console.log(`Passed: ${results.passed.length}/${testSequence.length}`);
  results.passed.forEach(n => console.log(`  ✓ ${n}`));

  if (results.failed.length > 0) {
    console.log(`\nFailed: ${results.failed.length}`);
    results.failed.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
  }

  console.log(`\nPass rate: ${((results.passed.length / testSequence.length) * 100).toFixed(0)}%`);
  process.exit(results.failed.length > 0 ? 1 : 0);
}

setTimeout(() => { console.log('Timeout'); process.exit(1); }, 60000);

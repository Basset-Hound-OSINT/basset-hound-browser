/**
 * Comprehensive WebSocket API Test for basset-hound-browser
 * Tests all major command categories to identify what works in headless mode
 */

const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8765');

const tests = [];
let testIndex = 0;
const results = { passed: [], failed: [], partial: [] };

// Test definitions
const testCases = [
  // Navigation
  { id: 1, name: 'navigate', cmd: 'navigate', params: { url: 'https://example.com' }, category: 'Navigation' },
  { id: 2, name: 'get_page_state', cmd: 'get_page_state', params: {}, category: 'Navigation' },

  // Content extraction
  { id: 3, name: 'get_content', cmd: 'get_content', params: {}, category: 'Content' },
  { id: 4, name: 'execute_script', cmd: 'execute_script', params: { script: 'document.title' }, category: 'Content' },

  // Screenshots
  { id: 5, name: 'screenshot', cmd: 'screenshot', params: {}, category: 'Screenshot' },

  // Cookies
  { id: 6, name: 'get_cookies', cmd: 'get_cookies', params: {}, category: 'Cookies' },
  { id: 7, name: 'set_cookie', cmd: 'set_cookie', params: { name: 'test', value: 'value', url: 'https://example.com' }, category: 'Cookies' },
  { id: 8, name: 'get_all_cookies', cmd: 'get_all_cookies', params: {}, category: 'Cookies' },

  // Sessions
  { id: 9, name: 'list_sessions', cmd: 'list_sessions', params: {}, category: 'Sessions' },

  // Tabs
  { id: 10, name: 'list_tabs', cmd: 'list_tabs', params: {}, category: 'Tabs' },

  // Evasion
  { id: 11, name: 'get_evasion_status', cmd: 'get_evasion_status', params: {}, category: 'Evasion' },

  // Memory
  { id: 12, name: 'get_memory_usage', cmd: 'get_memory_usage', params: {}, category: 'System' },

  // Network analysis
  { id: 13, name: 'start_network_capture', cmd: 'start_network_capture', params: {}, category: 'Network' },
  { id: 14, name: 'get_network_stats', cmd: 'get_network_stats', params: {}, category: 'Network' },

  // Evidence chain
  { id: 15, name: 'create_evidence_record', cmd: 'create_evidence_record', params: { type: 'screenshot', description: 'test' }, category: 'Evidence' },
];

function runNextTest() {
  if (testIndex >= testCases.length) {
    printResults();
    ws.close();
    return;
  }

  const test = testCases[testIndex];
  const msg = { id: test.id, command: test.cmd, ...test.params };
  console.log(`[${test.id}/${testCases.length}] Testing: ${test.name} (${test.category})`);
  ws.send(JSON.stringify(msg));
}

ws.on('open', () => {
  console.log('=== Comprehensive WebSocket API Test ===\n');
  console.log('Connected to ws://localhost:8765\n');
  runNextTest();
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());

  // Skip status messages
  if (msg.type === 'status') return;

  const test = testCases.find(t => t.id === msg.id);
  if (!test) return;

  if (msg.success) {
    results.passed.push({ ...test, result: msg.result || msg });
    console.log(`  ✓ PASS`);
  } else if (msg.error && msg.error.includes('Unknown command')) {
    results.failed.push({ ...test, error: msg.error });
    console.log(`  ✗ FAIL (Unknown command)`);
  } else if (msg.error && (msg.error.includes('webview') || msg.error.includes('No active'))) {
    results.partial.push({ ...test, error: msg.error });
    console.log(`  ⚠ PARTIAL (Needs webview: ${msg.error})`);
  } else {
    results.failed.push({ ...test, error: msg.error });
    console.log(`  ✗ FAIL: ${msg.error}`);
  }

  testIndex++;
  setTimeout(runNextTest, 100);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

function printResults() {
  console.log('\n=== TEST RESULTS ===\n');

  console.log(`PASSED (${results.passed.length}):`);
  results.passed.forEach(t => console.log(`  ✓ ${t.name} [${t.category}]`));

  console.log(`\nPARTIAL - Needs webview (${results.partial.length}):`);
  results.partial.forEach(t => console.log(`  ⚠ ${t.name} [${t.category}]: ${t.error}`));

  console.log(`\nFAILED (${results.failed.length}):`);
  results.failed.forEach(t => console.log(`  ✗ ${t.name} [${t.category}]: ${t.error}`));

  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${testCases.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Partial: ${results.partial.length}`);
  console.log(`Failed: ${results.failed.length}`);

  const passRate = ((results.passed.length / testCases.length) * 100).toFixed(1);
  console.log(`Pass rate: ${passRate}%`);

  process.exit(results.failed.length > 0 ? 1 : 0);
}

setTimeout(() => {
  console.log('\nTimeout - tests incomplete');
  printResults();
}, 60000);

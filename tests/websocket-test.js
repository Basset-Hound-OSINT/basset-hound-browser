#!/usr/bin/env node
/**
 * Simple WebSocket API test for basset-hound-browser
 */

const WebSocket = require('ws');

const WS_URL = process.argv[2] || 'ws://localhost:8765';

console.log(`Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);
let requestId = 0;

function sendCommand(command, params = {}) {
  const id = ++requestId;
  const message = JSON.stringify({ id, command, params });
  console.log(`\n> Sending: ${command}`);
  ws.send(message);
  return id;
}

ws.on('open', () => {
  console.log('Connected to WebSocket server!\n');

  // Test 1: Get current URL
  sendCommand('getUrl');

  // Test 2: Get page title
  setTimeout(() => sendCommand('getTitle'), 500);

  // Test 3: Navigate to a test page
  setTimeout(() => sendCommand('navigate', { url: 'https://example.com' }), 1000);

  // Test 4: Get URL after navigation
  setTimeout(() => sendCommand('getUrl'), 3000);

  // Test 5: Take a screenshot
  setTimeout(() => sendCommand('screenshot', { path: '/tmp/test-screenshot.png' }), 4000);

  // Test 6: Get system status
  setTimeout(() => sendCommand('getMemoryUsage'), 4500);

  // Close after tests
  setTimeout(() => {
    console.log('\n\n=== Tests complete ===');
    ws.close();
    process.exit(0);
  }, 6000);
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  if (response.type === 'event') {
    console.log(`< Event: ${response.event}`);
  } else {
    console.log(`< Response (id=${response.id}): ${response.success ? 'SUCCESS' : 'FAILED'}`);
    if (response.result) {
      console.log(`  Result: ${JSON.stringify(response.result).substring(0, 200)}`);
    }
    if (response.error) {
      console.log(`  Error: ${response.error}`);
    }
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('\nConnection closed');
});

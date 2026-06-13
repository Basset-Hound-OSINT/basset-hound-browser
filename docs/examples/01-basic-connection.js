/**
 * Basic Connection Example
 * Demonstrates: Simple WebSocket connection and command execution
 * Status: Ready for copy-paste use
 * Version: v12.2.0
 */

const WebSocket = require('ws');

// === Step 1: Initialize WebSocket Connection ===
const WS_URL = 'ws://localhost:8765';
const client = new WebSocket(WS_URL);

// === Step 2: Set Up Event Handlers ===

// Connection opened
client.on('open', () => {
  console.log('✓ Connected to Basset Hound Browser');

  // Send a simple command
  sendCommand('getVersion', {});
});

// Handle incoming messages
client.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    console.log('Response:', JSON.stringify(message, null, 2));

    // Close connection when done
    if (message.command === 'getVersion') {
      client.close();
    }
  } catch (error) {
    console.error('Failed to parse message:', error);
  }
});

// Handle errors
client.on('error', (error) => {
  console.error('WebSocket error:', error.message);
});

// Connection closed
client.on('close', () => {
  console.log('✓ Disconnected from server');
  process.exit(0);
});

// === Step 3: Helper Function to Send Commands ===
function sendCommand(command, params = {}) {
  const payload = {
    id: `cmd-${Date.now()}`,
    command: command,
    ...params
  };

  console.log(`→ Sending: ${command}`);
  client.send(JSON.stringify(payload));
}

// === Error Handling ===
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  client.close();
  process.exit(1);
});

// Timeout protection
setTimeout(() => {
  console.error('Operation timeout');
  client.close();
  process.exit(1);
}, 5000);

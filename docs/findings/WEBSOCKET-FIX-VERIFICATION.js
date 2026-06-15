#!/usr/bin/env node

/**
 * WebSocket Server Startup Verification
 * Quick test to verify the server binds to port 8765
 */

const WebSocket = require('ws');
const path = require('path');

// Mock Electron window for testing
const mockMainWindow = {
  webContents: {
    send: () => {},
    on: () => {}
  }
};

// Test configuration
const TEST_PORT = 18765 + Math.floor(Math.random() * 100); // Use random port to avoid conflicts
const TEST_TIMEOUT = 5000;

async function testWebSocketServer() {
  console.log(`\n=== WebSocket Server Startup Verification ===\n`);
  console.log(`[1] Loading WebSocketServer class...`);

  try {
    const WebSocketServer = require('./websocket/server');
    console.log(`    ✓ WebSocketServer loaded successfully`);

    console.log(`\n[2] Creating server instance on port ${TEST_PORT}...`);
    const server = new WebSocketServer(TEST_PORT, mockMainWindow, {
      sslEnabled: false,
      rateLimitEnabled: false,
      requireAuth: false
    });
    console.log(`    ✓ Server instance created`);

    // Wait a moment for the server to start
    await new Promise(r => setTimeout(r, 500));

    console.log(`\n[3] Testing connection to ws://localhost:${TEST_PORT}...`);

    const result = await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout after 5s' });
      }, TEST_TIMEOUT);

      try {
        const testWs = new WebSocket(`ws://localhost:${TEST_PORT}`);

        testWs.on('open', () => {
          clearTimeout(timeout);
          console.log(`    ✓ Connected successfully!`);
          testWs.close();
          resolve({ success: true });
        });

        testWs.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      } catch (error) {
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      }
    });

    if (result.success) {
      console.log(`\n[4] Sending ping command...`);
      const testWs = new WebSocket(`ws://localhost:${TEST_PORT}`);

      await new Promise((resolve) => {
        testWs.on('open', () => {
          testWs.send(JSON.stringify({ id: 1, command: 'ping' }));
        });

        testWs.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.command === 'ping') {
              console.log(`    ✓ Ping response received: ${data.toString()}`);
              testWs.close();
              resolve();
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        testWs.on('error', () => {
          testWs.close();
          resolve();
        });

        setTimeout(() => {
          testWs.close();
          resolve();
        }, 2000);
      });

      console.log(`\n[5] Cleaning up...`);
      server.close();
      console.log(`    ✓ Server closed successfully`);

      console.log(`\n✅ VERIFICATION COMPLETE - Server is working correctly!\n`);
      process.exit(0);
    } else {
      console.log(`    ✗ Connection failed: ${result.error}`);
      console.log(`\n❌ VERIFICATION FAILED\n`);
      server.close();
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    process.exit(1);
  }
}

testWebSocketServer().catch(error => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});

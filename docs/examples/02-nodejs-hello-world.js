#!/usr/bin/env node

/**
 * Basset Hound Browser - Node.js Hello World Example
 *
 * This is the simplest example to test connectivity and basic commands.
 *
 * Prerequisites:
 *   npm install ws
 *
 * Usage:
 *   node 02-nodejs-hello-world.js
 */

const WebSocket = require('ws');
const url = 'ws://localhost:8765';

// Helper to send command and return promise
function sendCommand(ws, id, command, params = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      id,
      command,
      ...params
    };

    console.log(`\nSending command: ${command}`);
    console.log(`Request: ${JSON.stringify(request)}`);

    ws.send(JSON.stringify(request));

    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for response to ${command}`));
    }, 10000);

    // Listen for response
    const handler = (data) => {
      const response = JSON.parse(data);
      if (response.id === id) {
        clearTimeout(timeout);
        ws.removeEventListener('message', handler);
        console.log(`Response: ${JSON.stringify(response, null, 2)}`);
        resolve(response);
      }
    };

    ws.on('message', handler);
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('Basset Hound Browser - Node.js Hello World Example');
  console.log('='.repeat(60));

  const ws = new WebSocket(url);

  ws.on('open', async () => {
    try {
      console.log(`Connected to ${url}`);

      // Test 1: Ping
      console.log('\n1. Testing connection...');
      let response = await sendCommand(ws, 1, 'ping');
      if (!response.success) {
        console.error('Ping failed!');
        ws.close();
        return;
      }
      console.log('Ping successful!');

      // Test 2: Status
      console.log('\n2. Getting server status...');
      response = await sendCommand(ws, 2, 'status');

      // Test 3: Navigate
      console.log('\n3. Navigating to example.com...');
      response = await sendCommand(ws, 3, 'navigate', {
        url: 'https://example.com'
      });
      if (!response.success) {
        console.error('Navigation failed!');
        ws.close();
        return;
      }
      console.log('Navigation successful!');

      // Wait for page to load
      console.log('\n4. Waiting 2 seconds for page to load...');
      await sleep(2000);

      // Test 4: Get URL
      console.log('\n5. Getting current page URL...');
      response = await sendCommand(ws, 5, 'get_url');

      // Test 5: Get page state
      console.log('\n6. Getting page state...');
      response = await sendCommand(ws, 6, 'get_page_state');

      // Test 6: Extract links
      console.log('\n7. Extracting links from page...');
      response = await sendCommand(ws, 7, 'extract_links');
      if (response.success) {
        const links = (response.data?.links || []).slice(0, 5);
        console.log(`Found links:`);
        links.forEach(link => {
          console.log(`  - ${link.text || 'N/A'}: ${link.href || 'N/A'}`);
        });
      }

      console.log('\n' + '='.repeat(60));
      console.log('Hello World Example Completed Successfully!');
      console.log('='.repeat(60));

      ws.close();
    } catch (error) {
      console.error('Error:', error);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('Disconnected');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

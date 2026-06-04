#!/usr/bin/env node

const WebSocket = require('ws');

async function test() {
  const ws = new WebSocket('ws://localhost:8765');

  ws.on('open', async () => {
    console.log('Connected');

    // Test 1: Send navigate command as our validation test does
    console.log('\n--- Test 1: Navigate with params ---');
    const cmd = {
      command: 'navigate',
      params: {
        url: 'http://example.com',
        timeout: 10000
      },
      timestamp: Date.now()
    };
    console.log('Sending:', JSON.stringify(cmd, null, 2));
    ws.send(JSON.stringify(cmd));

    setTimeout(() => {
      // Test 2: Try alternative format
      console.log('\n--- Test 2: Navigate without params wrapper ---');
      const cmd2 = {
        command: 'navigate',
        url: 'http://example.com',
        timeout: 10000,
        timestamp: Date.now()
      };
      console.log('Sending:', JSON.stringify(cmd2, null, 2));
      ws.send(JSON.stringify(cmd2));

      setTimeout(() => {
        ws.close();
      }, 2000);
    }, 2000);
  });

  ws.on('message', (data) => {
    console.log('\nResponse:', JSON.stringify(JSON.parse(data), null, 2));
  });

  ws.on('error', (e) => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

test();

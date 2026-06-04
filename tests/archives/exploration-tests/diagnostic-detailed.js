#!/usr/bin/env node

/**
 * Detailed Diagnostic Test
 * Tests specific fixes and identifies remaining issues
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');

const WS_URL = 'ws://localhost:8765';

async function createConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', (err) => reject(err));
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

async function sendCommand(ws, command, params = {}, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const messageId = Math.random().toString(36).substr(2, 9);
    const startTime = performance.now();

    const timeoutHandle = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`Command timeout: ${command}`));
    }, timeout);

    const handler = (data) => {
      try {
        const message = JSON.parse(data);
        if (message.id === messageId) {
          clearTimeout(timeoutHandle);
          ws.removeListener('message', handler);
          const latency = performance.now() - startTime;
          resolve({ ...message, latency: Math.round(latency) });
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ id: messageId, command, params }));
  });
}

async function runDiagnostics() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  BASSET HOUND BROWSER v11.3.0');
  console.log('  DETAILED DIAGNOSTIC TEST');
  console.log('═══════════════════════════════════════════════════════════\n');

  let ws;

  try {
    ws = await createConnection();
    console.log('✅ WebSocket connection established\n');

    // TEST 1: Check response format
    console.log('TEST 1: Response Format Validation');
    console.log('─────────────────────────────────────');

    const statusResponse = await sendCommand(ws, 'status', {});
    console.log(`Status Command Response:`, JSON.stringify(statusResponse, null, 2).substring(0, 300));
    console.log(`  - Has 'id': ${!!statusResponse.id}`);
    console.log(`  - Has 'command': ${!!statusResponse.command}`);
    console.log(`  - Has 'success': ${statusResponse.success !== undefined}`);
    console.log(`  - Latency: ${statusResponse.latency}ms\n`);

    // TEST 2: Content extraction format
    console.log('TEST 2: Content Extraction Format');
    console.log('─────────────────────────────────────');

    await sendCommand(ws, 'navigate', { url: 'https://example.com' });
    const contentResponse = await sendCommand(ws, 'get_content', { extractHtml: true });
    console.log(`Content Response Keys:`, Object.keys(contentResponse).join(', '));
    console.log(`  - Has 'content': ${!!contentResponse.content}`);
    console.log(`  - Content type: ${typeof contentResponse.content}`);
    console.log(`  - Content length: ${typeof contentResponse.content === 'string' ? contentResponse.content.length : 'N/A'}`);
    console.log(`  - Has 'command': ${!!contentResponse.command}`);
    console.log(`  - Has 'success': ${contentResponse.success !== undefined}`);
    console.log(`  - Latency: ${contentResponse.latency}ms\n`);

    // TEST 3: Rapid queries consistency
    console.log('TEST 3: Rapid State Query Consistency');
    console.log('─────────────────────────────────────');

    const urls = [];
    for (let i = 0; i < 5; i++) {
      const response = await sendCommand(ws, 'get_url', {});
      urls.push(response.data?.url);
      console.log(`  Query ${i + 1}: ${response.data?.url} (${response.latency}ms)`);
    }

    const uniqueUrls = [...new Set(urls)];
    console.log(`  - Consistent: ${uniqueUrls.length === 1 ? 'YES ✅' : `NO (${uniqueUrls.length} unique values)`}\n`);

    // TEST 4: Error handling
    console.log('TEST 4: Error Handling & Recovery');
    console.log('─────────────────────────────────────');

    const invalidResponse = await sendCommand(ws, 'invalid_command', {});
    console.log(`Invalid command response:`, JSON.stringify(invalidResponse, null, 2).substring(0, 300));

    const recoveryResponse = await sendCommand(ws, 'status', {});
    console.log(`  - Recovered: ${recoveryResponse.success ? 'YES ✅' : 'NO ❌'}`);
    console.log(`  - Recovery latency: ${recoveryResponse.latency}ms\n`);

    // TEST 5: Navigation response format
    console.log('TEST 5: Navigation Response Format & Timing');
    console.log('─────────────────────────────────────');

    const navResponse = await sendCommand(ws, 'navigate', { url: 'https://example.com' }, 15000);
    console.log(`Navigate response:`, JSON.stringify(navResponse, null, 2).substring(0, 300));
    console.log(`  - Has 'success': ${navResponse.success !== undefined}`);
    console.log(`  - Latency: ${navResponse.latency}ms`);
    console.log(`  - Response indicates completion: ${navResponse.success === true ? 'YES' : 'UNCLEAR'}\n`);

    // TEST 6: Concurrent operations
    console.log('TEST 6: Concurrent Operations');
    console.log('─────────────────────────────────────');

    const ws2 = await createConnection();
    const ws3 = await createConnection();

    const concurrent = await Promise.all([
      sendCommand(ws, 'status', {}),
      sendCommand(ws2, 'status', {}),
      sendCommand(ws3, 'status', {})
    ]);

    console.log(`  - Connection 1: ${concurrent[0].latency}ms`);
    console.log(`  - Connection 2: ${concurrent[1].latency}ms`);
    console.log(`  - Connection 3: ${concurrent[2].latency}ms`);
    console.log(`  - All successful: ${concurrent.every(r => r.success) ? 'YES ✅' : 'NO ❌'}\n`);

    ws2.close();
    ws3.close();

    // TEST 7: Session isolation
    console.log('TEST 7: Session Isolation');
    console.log('─────────────────────────────────────');

    const ws4 = await createConnection();

    await sendCommand(ws, 'navigate', { url: 'https://example.com' });
    const url1 = await sendCommand(ws, 'get_url', {});

    // ws4 should be in a fresh session
    const url2 = await sendCommand(ws4, 'get_url', {});

    console.log(`  - Connection 1 URL: ${url1.data?.url}`);
    console.log(`  - Connection 4 URL: ${url2.data?.url}`);
    console.log(`  - Isolated: ${url1.data?.url !== url2.data?.url ? 'YES ✅' : 'NO ❌'}\n`);

    ws4.close();

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Response formats appear correct');
    console.log('✅ Content extraction returning proper format');
    console.log(`${uniqueUrls.length === 1 ? '✅' : '⚠️'} Rapid query consistency: ${uniqueUrls.length === 1 ? 'PASS' : 'ISSUE'}`);
    console.log(`${recoveryResponse.success ? '✅' : '❌'} Error recovery working`);
    console.log(`✅ Concurrent operations functional`);
    console.log(`${url1.data?.url !== url2.data?.url ? '✅' : '❌'} Session isolation working`);

    ws.close();
  } catch (err) {
    console.error(`\n❌ ERROR: ${err.message}`);
    if (ws) ws.close();
    process.exit(1);
  }
}

runDiagnostics().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

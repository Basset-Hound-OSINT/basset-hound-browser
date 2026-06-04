#!/usr/bin/env node
/**
 * Simple Tor Test - Verify .onion site access
 *
 * This test waits longer for Tor circuits and page loads.
 */

const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

async function main() {
  console.log('=== Simple Tor Test ===\n');

  // Connect to WebSocket
  const ws = await new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    socket.on('open', () => {
      console.log('Connected to WebSocket');
      resolve(socket);
    });
    socket.on('error', reject);
  });

  let messageId = 0;
  const pending = new Map();

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'tor_bootstrap') {
      console.log(`  Bootstrap: ${msg.progress}% - ${msg.summary || ''}`);
      return;
    }
    if (msg.type === 'status') return;
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      p.resolve(msg);
    }
  });

  function send(command, params = {}, timeout = 120000) {
    const id = ++messageId;
    const msg = { id, command, ...params };
    return new Promise((resolve) => {
      pending.set(id, { resolve });
      ws.send(JSON.stringify(msg));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          resolve({ success: false, error: 'Timeout' });
        }
      }, timeout);
    });
  }

  function wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  try {
    // Step 1: Check Tor status and start if needed
    console.log('1. Checking/Starting Tor...');
    const statusResult = await send('tor_status');

    if (statusResult.processRunning || statusResult.state === 'connected') {
      console.log('   Tor is already running (state:', statusResult.state, ')');
    } else {
      const startResult = await send('tor_start', {
        mode: 'embedded',
        torBinaryPath: '/app/bin/tor/tor/tor',
        dataDir: '/app/bin/tor/data_local'
      }, 180000);
      console.log('   Start result:', startResult.success ? 'SUCCESS' : startResult.error);

      if (!startResult.success) {
        console.log('   Failed to start Tor, exiting');
        ws.close();
        return;
      }
    }

    // Step 2: Wait for full bootstrap (Tor over Tor can be slow)
    console.log('\n2. Waiting for Tor bootstrap (30s)...');
    await wait(30000);

    // Step 3: Verify Tor works via curl
    console.log('\n3. Verifying Tor via check service...');
    const execResult = await send('execute', {
      script: `
        const { execSync } = require('child_process');
        try {
          const result = execSync('curl --socks5 127.0.0.1:9050 --connect-timeout 30 https://check.torproject.org/api/ip', { encoding: 'utf8' });
          return JSON.parse(result);
        } catch (e) {
          return { error: e.message };
        }
      `
    });
    console.log('   Tor check via curl:', JSON.stringify(execResult, null, 2).substring(0, 300));

    // Step 4: Create a new tab
    console.log('\n4. Creating new tab...');
    await send('new_tab');
    await wait(2000);

    // Step 5: Navigate to .onion site
    console.log('\n5. Navigating to DuckDuckGo .onion...');
    const navResult = await send('navigate', {
      url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion'
    }, 120000);
    console.log('   Navigation:', navResult.success ? 'SUCCESS' : navResult.error);

    // Step 6: Wait for page to load (onion sites are slower)
    console.log('\n6. Waiting 45 seconds for page to load...');
    await wait(45000);

    // Step 7: Get page content
    console.log('\n7. Getting page content...');
    const contentResult = await send('get_content', {}, 60000);
    if (contentResult.success) {
      const html = contentResult.html || '';
      const text = contentResult.text || '';
      console.log(`   HTML: ${html.length} chars, Text: ${text.length} chars`);

      if (html.length > 0 || text.length > 0) {
        console.log('\n   === SUCCESS ===');
        console.log('   .onion site content retrieved!');

        // Check for DuckDuckGo markers
        const combined = (html + text).toLowerCase();
        if (combined.includes('duckduckgo') || combined.includes('privacy')) {
          console.log('   DuckDuckGo markers found in content');
        }

        // Show sample
        if (text.length > 0) {
          console.log(`   Sample: "${text.substring(0, 200).replace(/\s+/g, ' ')}..."`);
        }
      } else {
        console.log('   Page appears to be empty');
      }
    } else {
      console.log('   Content error:', contentResult.error);
    }

    // Step 8: Get screenshot
    console.log('\n8. Taking screenshot...');
    const ssResult = await send('screenshot', {}, 30000);
    if (ssResult.success) {
      const imgData = ssResult.image || ssResult.screenshot || '';
      console.log(`   Screenshot: ${imgData.length} chars (base64)`);
      if (imgData.length > 1000) {
        console.log('   Screenshot appears valid');
      }
    } else {
      console.log('   Screenshot error:', ssResult.error);
    }

    // Step 9: Get URL to verify
    console.log('\n9. Getting current URL...');
    const urlResult = await send('get_url');
    console.log('   URL:', urlResult.url);

  } catch (error) {
    console.error('Error:', error);
  }

  ws.close();
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

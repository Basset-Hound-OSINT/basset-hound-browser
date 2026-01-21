#!/usr/bin/env node
/**
 * Direct Tor Test - Start Tor and access .onion site
 *
 * This test directly starts embedded Tor via WebSocket command
 * and navigates to a .onion site.
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

async function main() {
  console.log('=== Direct Tor Test ===\n');

  // Connect to WebSocket
  const ws = await new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    socket.on('open', () => {
      console.log('✅ Connected to WebSocket');
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
    // Step 1: Check Tor status
    console.log('\n1. Checking Tor status...');
    let status = await send('tor_status');
    console.log('   Status:', JSON.stringify(status, null, 2).substring(0, 500));

    // Step 2: Try to start embedded Tor with explicit path
    console.log('\n2. Starting embedded Tor...');
    const startResult = await send('tor_start', {
      mode: 'embedded',
      torBinaryPath: '/app/bin/tor/tor/tor',
      dataDir: '/app/bin/tor/data_local',
      config: {
        exitCountries: ['us', 'de', 'nl']
      }
    }, 180000);

    console.log('   Start result:', JSON.stringify(startResult, null, 2).substring(0, 500));

    if (!startResult.success) {
      console.log('\n   Trying alternative: tor_connect_existing...');
      const connectResult = await send('tor_connect_existing', {
        socksPort: 9050,
        controlPort: 9051
      });
      console.log('   Connect result:', JSON.stringify(connectResult, null, 2).substring(0, 300));
    }

    // Step 2.5: Configure browser to route through Tor SOCKS proxy
    console.log('\n2.5. Setting browser proxy to route through Tor...');
    const proxyResult = await send('set_proxy', {
      type: 'socks5',
      host: '127.0.0.1',
      port: 9050
    });
    console.log('   Proxy result:', JSON.stringify(proxyResult, null, 2).substring(0, 300));

    // Step 3: Wait for bootstrap
    console.log('\n3. Waiting for Tor to bootstrap...');
    await wait(5000);

    // Step 4: Check connection
    console.log('\n4. Checking Tor connection...');
    const connResult = await send('tor_check_connection');
    console.log('   Connection:', JSON.stringify(connResult, null, 2).substring(0, 300));

    // Step 5: Create a new tab first
    console.log('\n5. Creating a new tab...');
    const tabResult = await send('new_tab');
    console.log('   Tab result:', JSON.stringify(tabResult, null, 2).substring(0, 300));
    await wait(2000);

    // Step 6: Navigate to .onion site
    console.log('\n6. Navigating to DuckDuckGo .onion...');
    const navResult = await send('navigate', {
      url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion'
    }, 120000);
    console.log('   Navigation result:', JSON.stringify(navResult, null, 2).substring(0, 300));

    // Step 7: Wait for page load
    console.log('\n7. Waiting for page to load...');
    await wait(10000);

    // Step 8: Get page content
    console.log('\n8. Getting page content...');
    const contentResult = await send('get_content');
    if (contentResult.success) {
      const html = contentResult.html || '';
      const text = contentResult.text || '';
      console.log(`   ✅ Got HTML: ${html.length} chars, Text: ${text.length} chars`);
      if (text.length > 0) {
        console.log(`   Sample: "${text.substring(0, 200).replace(/\s+/g, ' ')}..."`);
      }

      // Check for DuckDuckGo markers
      if (html.toLowerCase().includes('duckduckgo') || text.toLowerCase().includes('duckduckgo')) {
        console.log('\n   ✅✅✅ SUCCESS: DuckDuckGo .onion site content verified!');
      }
    } else {
      console.log('   ❌ Content error:', contentResult.error);
    }

    // Step 9: Get current URL to verify
    console.log('\n9. Getting current URL...');
    const urlResult = await send('get_url');
    console.log('   URL:', JSON.stringify(urlResult, null, 2).substring(0, 200));

    // Step 10: Take screenshot
    console.log('\n10. Taking screenshot...');
    const screenshotResult = await send('screenshot');
    if (screenshotResult.success) {
      const imgData = screenshotResult.image || screenshotResult.screenshot || '';
      console.log(`   ✅ Screenshot captured: ${imgData.length} chars (base64)`);
    } else {
      console.log('   Screenshot error:', screenshotResult.error);
    }

  } catch (error) {
    console.error('Error:', error);
  }

  ws.close();
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

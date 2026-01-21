#!/usr/bin/env node
/**
 * Tor Onion Verification Test
 *
 * Verifies that .onion sites can be accessed through Tor in Tor mode.
 */

const WebSocket = require('/app/node_modules/ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';

async function main() {
  console.log('=== Tor Onion Verification ===\n');

  const ws = await new Promise((resolve, reject) => {
    const socket = new WebSocket(WS_URL);
    socket.on('open', () => resolve(socket));
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

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    // 1. Ensure Tor is running
    console.log('1. Ensuring Tor is running...');
    const status = await send('tor_status');
    if (!status.processRunning && status.state !== 'connected') {
      console.log('   Starting Tor...');
      const start = await send('tor_start', { mode: 'embedded' }, 180000);
      if (!start.success) {
        console.log('   Failed:', start.error);
        ws.close();
        return;
      }
      console.log('   Tor started, waiting 20s for full bootstrap...');
      await wait(20000);
    } else {
      console.log('   Tor already running');
    }

    // 2. Get current tabs and switch to one or create new
    console.log('\n2. Getting tabs...');
    const tabsResult = await send('get_tabs');
    console.log('   Current tabs:', tabsResult.tabs?.length || 0);

    // 3. Navigate to a simple test page first (clearnet via Tor)
    console.log('\n3. Testing Tor connection with check.torproject.org...');
    let navResult = await send('navigate', { url: 'https://check.torproject.org/' }, 60000);
    console.log('   Navigate result:', navResult.success);
    await wait(15000);

    // Get content - note: content is nested in response.content
    let content = await send('get_content', {}, 30000);
    console.log('   Content retrieved:', content.success);
    console.log('   Response keys:', Object.keys(content));
    if (content.success && content.content) {
      const html = content.content.html || '';
      const isTor = html.toLowerCase().includes('congratulations') ||
                    html.toLowerCase().includes('using tor');
      console.log('   HTML length:', html.length);
      console.log('   Tor verification:', isTor ? 'SUCCESS - Connected via Tor' : 'Page loaded but may not be Tor');
    } else {
      console.log('   Content error:', content.error || 'No content object');
    }

    // 4. Now test .onion site
    console.log('\n4. Testing .onion site (DuckDuckGo)...');
    navResult = await send('navigate', {
      url: 'https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion/'
    }, 90000);
    console.log('   Navigate result:', navResult.success);

    // Wait longer for onion site
    console.log('   Waiting 30s for .onion page to load...');
    await wait(30000);

    // 5. Get content - content is nested in response.content
    console.log('\n5. Getting .onion page content...');
    content = await send('get_content', {}, 45000);
    console.log('   Response structure:', JSON.stringify(content, null, 2).substring(0, 500));

    if (content.success && content.content) {
      const html = content.content.html || '';
      const text = content.content.text || '';
      console.log('   HTML length:', html.length);
      console.log('   Text length:', text.length);

      if (html.length > 0) {
        console.log('\n   *** SUCCESS: .onion site content retrieved! ***');

        // Check for DuckDuckGo indicators
        if (html.toLowerCase().includes('duckduckgo')) {
          console.log('   DuckDuckGo markers found');
        }

        // Show sample
        console.log('   Title:', content.content.title || 'N/A');
        if (text.length > 0) {
          console.log('   Text sample:', text.substring(0, 100).replace(/\s+/g, ' '));
        }
      } else {
        console.log('   Page loaded but content is empty');
      }
    } else {
      console.log('   Content error:', content.error || 'No content object');
    }

    // 6. Screenshot
    console.log('\n6. Taking screenshot...');
    const ss = await send('screenshot', {}, 30000);
    if (ss.success) {
      const data = ss.image || ss.screenshot || ss.data || '';
      console.log('   Screenshot size:', data.length, 'chars');
      if (data.length > 5000) {
        console.log('   Screenshot appears valid (has content)');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  ws.close();
  console.log('\n=== Test Complete ===');
}

main().catch(console.error);

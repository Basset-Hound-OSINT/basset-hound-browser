const WebSocket = require('ws');

const TEST_RESULTS = {
  navigation: [],
  screenshots: [],
  tabs: [],
  content: [],
  memory: { baseline: null, peak: null, final: null },
  details: []
};

const ws = new WebSocket('ws://localhost:8765');
let messageId = 0;

ws.on('error', (err) => {
  console.error('WebSocket Error:', err.message);
  process.exit(1);
});

ws.on('open', async () => {
  console.log('[CONNECTION] WebSocket connected to ws://localhost:8765\n');
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  TEST_RESULTS.memory.baseline = startMemory;

  try {
    // TEST 1: Navigation (3 URLs)
    console.log('=== TEST 1: Navigation (3 URLs) ===');
    const urls = ['https://example.com', 'https://httpbin.org', 'https://example.org'];
    
    for (const url of urls) {
      const t = Date.now();
      const result = await sendCommand({ command: 'navigate', params: { url } });
      const elapsed = Date.now() - t;
      const success = result.success === true;
      TEST_RESULTS.navigation.push({ url, elapsed, status: success ? 'PASS' : 'FAIL' });
      console.log(`${success ? '✓' : '✗'} ${url} (${elapsed}ms)${success ? '' : ' - ' + (result.error || 'unknown error')}`);
    }
    console.log();

    // TEST 2: Screenshots with debugging
    console.log('=== TEST 2: Screenshots (with debugging) ===');
    
    // Try screenshot_viewport first (doesn't need dimensions)
    console.log('Attempting screenshot_viewport...');
    let vpResult = await sendCommand({ command: 'screenshot_viewport', params: { format: 'png' } });
    if (vpResult.success && vpResult.data) {
      const size = Buffer.from(vpResult.data, 'base64').length;
      console.log(`✓ screenshot_viewport: ${size} bytes`);
      TEST_RESULTS.screenshots.push({ method: 'viewport', size, status: 'PASS' });
    } else {
      console.log(`✗ screenshot_viewport failed: ${vpResult.error}`);
      TEST_RESULTS.screenshots.push({ method: 'viewport', status: 'FAIL', error: vpResult.error });
    }
    
    // Try regular screenshot (should fallback)
    console.log('Attempting regular screenshot (with fallback)...');
    let scResult = await sendCommand({ command: 'screenshot', params: { format: 'png' } });
    if (scResult.success && scResult.data) {
      const size = Buffer.from(scResult.data, 'base64').length;
      console.log(`✓ screenshot: ${size} bytes (method: ${scResult.captureMethod || 'default'})`);
      TEST_RESULTS.screenshots.push({ method: 'default', size, status: 'PASS' });
    } else {
      console.log(`✗ screenshot failed: ${scResult.error}`);
      TEST_RESULTS.screenshots.push({ method: 'default', status: 'FAIL', error: scResult.error });
    }
    console.log();

    // TEST 3: Tab Management (Create/Destroy 5 tabs)
    console.log('=== TEST 3: Tab Management (Create/Destroy 5 tabs) ===');
    const tabs = [];
    for (let i = 0; i < 5; i++) {
      const t = Date.now();
      const result = await sendCommand({ command: 'new_tab', params: {} });
      const elapsed = Date.now() - t;
      if (result.success) {
        const tabId = result.tab ? result.tab.id : result.tabId;
        tabs.push(tabId);
        console.log(`✓ Tab ${i + 1} created: ${tabId} (${elapsed}ms)`);
        TEST_RESULTS.tabs.push({ action: 'create', id: tabId, elapsed, status: 'PASS' });
      } else {
        console.log(`✗ Tab creation failed${result.error ? ' - ' + result.error : ''}`);
        TEST_RESULTS.tabs.push({ action: 'create', status: 'FAIL' });
      }
    }
    for (const tabId of tabs) {
      const t = Date.now();
      const result = await sendCommand({ command: 'close_tab', params: { tabId } });
      const elapsed = Date.now() - t;
      if (result.success) {
        console.log(`✓ Tab closed (${elapsed}ms)`);
        TEST_RESULTS.tabs.push({ action: 'close', id: tabId, elapsed, status: 'PASS' });
      } else {
        console.log(`✗ Tab close failed${result.error ? ' - ' + result.error : ''}`);
        TEST_RESULTS.tabs.push({ action: 'close', status: 'FAIL' });
      }
    }
    console.log();

    // TEST 4: Content Extraction (2 pages)
    console.log('=== TEST 4: Content Extraction (2 pages) ===');
    const extractUrls = ['https://example.com', 'https://httpbin.org/html'];
    for (const url of extractUrls) {
      await sendCommand({ command: 'navigate', params: { url } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const t = Date.now();
      const result = await sendCommand({ command: 'get_content', params: {} });
      const elapsed = Date.now() - t;
      if (result.success && result.content) {
        const contentLen = result.content.length;
        console.log(`✓ Content from ${url}: ${contentLen} chars (${elapsed}ms)`);
        TEST_RESULTS.content.push({ url, length: contentLen, elapsed, status: 'PASS' });
      } else {
        console.log(`✗ Content extraction from ${url} failed${result.error ? ' - ' + result.error : ''}`);
        TEST_RESULTS.content.push({ url, status: 'FAIL' });
      }
    }
    console.log();

    // TEST 5: Memory Check
    console.log('=== TEST 5: Memory Monitoring ===');
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    TEST_RESULTS.memory.peak = memBefore;
    
    // Wait 5 seconds for memory stabilization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    TEST_RESULTS.memory.final = memAfter;
    const memGrowth = memAfter - startMemory;
    
    console.log(`Baseline: ${startMemory.toFixed(2)}MB`);
    console.log(`Peak: ${TEST_RESULTS.memory.peak.toFixed(2)}MB`);
    console.log(`Final: ${memAfter.toFixed(2)}MB`);
    console.log(`Growth: ${memGrowth.toFixed(2)}MB`);
    if (memGrowth < 100) {
      console.log('✓ Memory growth within acceptable range (<100MB)');
      TEST_RESULTS.memory.status = 'PASS';
    } else {
      console.log('⚠ Memory growth concerning (>100MB)');
      TEST_RESULTS.memory.status = 'WARN';
    }
    console.log();

    // SUMMARY
    console.log('=== TEST SUMMARY ===');
    const navPass = TEST_RESULTS.navigation.filter(r => r.status === 'PASS').length;
    const screenshotPass = TEST_RESULTS.screenshots.filter(r => r.status === 'PASS').length;
    const tabPass = TEST_RESULTS.tabs.filter(r => r.status === 'PASS').length;
    const contentPass = TEST_RESULTS.content.filter(r => r.status === 'PASS').length;
    
    console.log(`Navigation: ${navPass}/${TEST_RESULTS.navigation.length}`);
    console.log(`Screenshots: ${screenshotPass}/${TEST_RESULTS.screenshots.length}`);
    console.log(`Tab Management: ${tabPass}/${TEST_RESULTS.tabs.length}`);
    console.log(`Content Extraction: ${contentPass}/${TEST_RESULTS.content.length}`);
    console.log(`Memory: ${TEST_RESULTS.memory.status}`);
    
    const totalTests = 
      TEST_RESULTS.navigation.length +
      TEST_RESULTS.screenshots.length +
      TEST_RESULTS.tabs.length +
      TEST_RESULTS.content.length;
    const totalPass =
      navPass +
      screenshotPass +
      tabPass +
      contentPass;
    
    const passRate = ((totalPass / totalTests) * 100).toFixed(1);
    console.log(`\nTotal: ${totalPass}/${totalTests} (${passRate}%)`);
    
    const totalTime = Date.now() - startTime;
    console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);

  } catch (error) {
    console.error('Test Error:', error.message);
    console.error(error.stack);
  } finally {
    ws.close();
    setTimeout(() => process.exit(0), 1000);
  }
});

function sendCommand(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Command timeout after 10s'));
    }, 10000);

    const id = ++messageId;
    const handler = (data) => {
      try {
        const response = JSON.parse(data);
        if (response.id === id) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(response);
        }
      } catch (e) {
        // Ignore parse errors, wait for next message
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ ...message, id }));
  });
}

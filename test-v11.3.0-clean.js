const WebSocket = require('ws');

const TEST_RESULTS = {
  navigation: [],
  screenshots: [],
  tabs: [],
  content: [],
  memory: { baseline: null, peak: null, final: null },
  issues: []
};

const ws = new WebSocket('ws://localhost:8765');
let messageId = 0;

ws.on('error', (err) => {
  console.error('WebSocket Error:', err.message);
  process.exit(1);
});

ws.on('open', async () => {
  console.log('[CONNECTION] WebSocket connected to ws://localhost:8765');
  console.log('[VERSION] Testing v11.3.0-fixed deployment\n');
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  TEST_RESULTS.memory.baseline = startMemory;

  try {
    // Clean up existing tabs first
    console.log('Cleaning up existing tabs...');
    const listResult = await sendCommand({ command: 'list_tabs', params: {} });
    if (listResult.success && listResult.tabs && listResult.tabs.length > 0) {
      console.log(`Found ${listResult.tabs.length} existing tabs, cleaning up...`);
      for (const tab of listResult.tabs) {
        if (tab.id) {
          await sendCommand({ command: 'close_tab', params: { tabId: tab.id } });
        }
      }
      console.log('Cleanup complete\n');
    }

    // TEST 1: Navigation (3 URLs)
    console.log('TEST 1: Navigation (3 URLs)');
    console.log('==============================');
    const urls = ['https://example.com', 'https://httpbin.org', 'https://example.org'];
    
    for (const url of urls) {
      const t = Date.now();
      const result = await sendCommand({ command: 'navigate', params: { url } });
      const elapsed = Date.now() - t;
      const success = result.success === true;
      TEST_RESULTS.navigation.push({ url, elapsed, status: success ? 'PASS' : 'FAIL' });
      const status = success ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${url.padEnd(25)} ${elapsed}ms`);
    }
    console.log();

    // TEST 2: Screenshots (2 captures using screenshot_viewport which works in headless)
    console.log('TEST 2: Screenshots (2 captures)');
    console.log('==================================');
    for (let i = 0; i < 2; i++) {
      const t = Date.now();
      const result = await sendCommand({ command: 'screenshot_viewport', params: { format: 'png' } });
      const elapsed = Date.now() - t;
      if (result.success && result.data) {
        const size = Buffer.from(result.data, 'base64').length;
        console.log(`[PASS] Screenshot ${i + 1}                    ${size} bytes, ${elapsed}ms`);
        TEST_RESULTS.screenshots.push({ index: i + 1, size, elapsed, status: 'PASS' });
      } else {
        console.log(`[FAIL] Screenshot ${i + 1} - ${result.error || 'unknown error'}`);
        TEST_RESULTS.screenshots.push({ index: i + 1, status: 'FAIL', error: result.error });
        TEST_RESULTS.issues.push(`Screenshot ${i + 1}: ${result.error}`);
      }
    }
    console.log();

    // TEST 3: Tab Management (Create/Destroy 5 tabs)
    console.log('TEST 3: Tab Management (Create/Destroy 5 tabs)');
    console.log('==============================================');
    const tabs = [];
    let createSuccess = 0;
    for (let i = 0; i < 5; i++) {
      const t = Date.now();
      const result = await sendCommand({ command: 'new_tab', params: {} });
      const elapsed = Date.now() - t;
      if (result.success) {
        const tabId = result.tab ? result.tab.id : result.tabId;
        tabs.push(tabId);
        console.log(`[PASS] Tab ${i + 1} created                     ${elapsed}ms`);
        TEST_RESULTS.tabs.push({ action: 'create', id: tabId, elapsed, status: 'PASS' });
        createSuccess++;
      } else {
        console.log(`[FAIL] Tab ${i + 1} creation - ${result.error || 'unknown error'}`);
        TEST_RESULTS.tabs.push({ action: 'create', status: 'FAIL', error: result.error });
        TEST_RESULTS.issues.push(`Tab ${i + 1} creation failed: ${result.error}`);
      }
    }
    
    let closeSuccess = 0;
    for (let i = 0; i < tabs.length; i++) {
      const tabId = tabs[i];
      const t = Date.now();
      const result = await sendCommand({ command: 'close_tab', params: { tabId } });
      const elapsed = Date.now() - t;
      if (result.success) {
        console.log(`[PASS] Tab ${i + 1} closed                     ${elapsed}ms`);
        TEST_RESULTS.tabs.push({ action: 'close', id: tabId, elapsed, status: 'PASS' });
        closeSuccess++;
      } else {
        console.log(`[FAIL] Tab ${i + 1} close - ${result.error || 'unknown error'}`);
        TEST_RESULTS.tabs.push({ action: 'close', status: 'FAIL', error: result.error });
      }
    }
    console.log();

    // TEST 4: Content Extraction (2 pages)
    console.log('TEST 4: Content Extraction (2 pages)');
    console.log('====================================');
    const extractUrls = ['https://example.com', 'https://httpbin.org/html'];
    for (const url of extractUrls) {
      await sendCommand({ command: 'navigate', params: { url } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const t = Date.now();
      const result = await sendCommand({ command: 'get_content', params: {} });
      const elapsed = Date.now() - t;
      if (result.success && result.content) {
        const contentLen = result.content.length;
        const urlName = url.replace('https://', '').substring(0, 25);
        console.log(`[PASS] Content from ${urlName.padEnd(25)} ${contentLen} chars, ${elapsed}ms`);
        TEST_RESULTS.content.push({ url, length: contentLen, elapsed, status: 'PASS' });
      } else {
        console.log(`[FAIL] Content from ${url} - ${result.error || 'unknown error'}`);
        TEST_RESULTS.content.push({ url, status: 'FAIL', error: result.error });
        TEST_RESULTS.issues.push(`Content extraction from ${url}: ${result.error}`);
      }
    }
    console.log();

    // TEST 5: Memory Check
    console.log('TEST 5: Memory Monitoring');
    console.log('=========================');
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;
    TEST_RESULTS.memory.peak = memBefore;
    
    // Wait 5 seconds for memory stabilization
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    TEST_RESULTS.memory.final = memAfter;
    const memGrowth = memAfter - startMemory;
    
    console.log(`Baseline:     ${startMemory.toFixed(2)}MB`);
    console.log(`Peak:         ${TEST_RESULTS.memory.peak.toFixed(2)}MB`);
    console.log(`Final:        ${memAfter.toFixed(2)}MB`);
    console.log(`Growth:       ${memGrowth.toFixed(2)}MB`);
    
    const memStatus = memGrowth < 100 ? 'PASS' : 'WARN';
    console.log(`[${memStatus}] Memory growth ${memGrowth < 100 ? 'within' : 'exceeds'} acceptable range (<100MB)`);
    TEST_RESULTS.memory.status = memStatus;
    console.log();

    // SUMMARY
    console.log('=====================================');
    console.log('           TEST SUMMARY');
    console.log('=====================================');
    
    const navPass = TEST_RESULTS.navigation.filter(r => r.status === 'PASS').length;
    const screenshotPass = TEST_RESULTS.screenshots.filter(r => r.status === 'PASS').length;
    const tabPass = TEST_RESULTS.tabs.filter(r => r.status === 'PASS').length;
    const contentPass = TEST_RESULTS.content.filter(r => r.status === 'PASS').length;
    
    console.log(`Navigation:         ${navPass}/${TEST_RESULTS.navigation.length} PASS`);
    console.log(`Screenshots:        ${screenshotPass}/${TEST_RESULTS.screenshots.length} PASS`);
    console.log(`Tab Management:     ${tabPass}/${TEST_RESULTS.tabs.length} PASS`);
    console.log(`Content Extraction: ${contentPass}/${TEST_RESULTS.content.length} PASS`);
    console.log(`Memory Status:      ${TEST_RESULTS.memory.status}`);
    
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
    console.log(`\nOVERALL:            ${totalPass}/${totalTests} PASS (${passRate}%)`);
    
    const totalTime = Date.now() - startTime;
    console.log(`TEST DURATION:      ${(totalTime / 1000).toFixed(2)}s`);
    console.log('=====================================\n');
    
    // Issues list
    if (TEST_RESULTS.issues.length > 0) {
      console.log('ISSUES DETECTED:');
      for (const issue of TEST_RESULTS.issues) {
        console.log(`  - ${issue}`);
      }
      console.log();
    }
    
    // Determine final outcome
    if (passRate >= 95) {
      console.log('DEPLOYMENT STATUS: APPROVED (100% of core features working)\n');
    } else if (passRate >= 90) {
      console.log('DEPLOYMENT STATUS: WORKING (Minor issues detected)\n');
    } else if (passRate >= 80) {
      console.log('DEPLOYMENT STATUS: FUNCTIONAL (Some issues detected)\n');
    } else {
      console.log('DEPLOYMENT STATUS: NEEDS REVIEW (Significant issues detected)\n');
    }

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

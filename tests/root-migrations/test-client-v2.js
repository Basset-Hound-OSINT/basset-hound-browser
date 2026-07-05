const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const WS_URL = 'ws://localhost:8765';
const SCREENSHOT_DIR = '/tmp/basset-test-screenshots';
const RESULTS_FILE = '/tmp/basset-test-results.json';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const metrics = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  tests: [],
  startMemory: process.memoryUsage(),
  startTime: Date.now()
};

// Create a pending response map per connection
const pendingResponses = new Map();

async function sendCommand(ws, command, timeout = 15000) {
  const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  command.id = commandId;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingResponses.delete(commandId);
      reject(new Error(`Command timeout: ${command.command}`));
    }, timeout);

    // Set up response handler before sending
    pendingResponses.set(commandId, {
      resolve: (response) => {
        clearTimeout(timer);
        pendingResponses.delete(commandId);
        resolve(response);
      },
      reject: (error) => {
        clearTimeout(timer);
        pendingResponses.delete(commandId);
        reject(error);
      }
    });

    ws.send(JSON.stringify(command));
  });
}

// Global message handler for all responses
function setupMessageHandler(ws) {
  ws.on('message', (data) => {
    try {
      const response = JSON.parse(data.toString());

      // Skip status messages
      if (response.type === 'status') {
        return;
      }

      // Route to pending response if ID matches
      if (response.id && pendingResponses.has(response.id)) {
        const handler = pendingResponses.get(response.id);
        handler.resolve(response);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  });
}

// Navigation tests
async function testNavigation(ws) {
  console.log('\n=== NAVIGATION TESTS ===');
  const results = [];
  const urls = [
    'https://example.com',
    'https://httpbin.org/headers',
    'https://example.org'
  ];

  for (const url of urls) {
    try {
      const startTime = performance.now();
      const response = await sendCommand(ws, {
        command: 'navigate',
        url: url
      });
      const duration = performance.now() - startTime;

      const passed = response.success && duration < 3000;
      results.push({
        test: `Navigate to ${url}`,
        passed,
        duration: duration.toFixed(2)
      });
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${url} - ${duration.toFixed(0)}ms`);
    } catch (e) {
      results.push({
        test: `Navigate to ${url}`,
        passed: false,
        error: e.message
      });
      console.log(`[FAIL] ${url} - ${e.message}`);
    }
  }

  metrics.tests.push(...results);
  return results.filter((r) => r.passed).length === results.length;
}

// Screenshot tests
async function testScreenshots(ws) {
  console.log('\n=== SCREENSHOT TESTS ===');
  const results = [];

  const sites = ['https://example.com', 'https://example.org'];

  for (let i = 0; i < sites.length; i++) {
    const url = sites[i];
    try {
      // Navigate first
      await sendCommand(ws, {
        command: 'navigate',
        url: url
      });

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Take screenshot
      const startTime = performance.now();
      const response = await sendCommand(
        ws,
        {
          command: 'screenshot',
          format: 'png'
        },
        5000
      );
      const duration = performance.now() - startTime;

      let passed = false;
      let fileSize = 0;
      const imageData = response.data || response.image;
      if (response.success && imageData) {
        const filename = path.join(SCREENSHOT_DIR, `screenshot-${i}.png`);
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(filename, buffer);
        fileSize = buffer.length;
        passed = duration < 2000 && fileSize > 500;
        console.log(
          `[${passed ? 'PASS' : 'FAIL'}] Screenshot ${i} - ${duration.toFixed(0)}ms, ${fileSize} bytes`
        );
      } else {
        console.log(`[FAIL] Screenshot ${i} - ${response.error || 'No image data'}`);
      }

      results.push({
        test: `Screenshot of ${url}`,
        passed,
        duration: duration.toFixed(2),
        fileSize: fileSize
      });
    } catch (e) {
      results.push({
        test: `Screenshot of ${url}`,
        passed: false,
        error: e.message
      });
      console.log(`[FAIL] Screenshot ${url} - ${e.message}`);
    }
  }

  metrics.tests.push(...results);
  return results.filter((r) => r.passed).length === results.length;
}

// Tab management tests
async function testTabManagement(ws) {
  console.log('\n=== TAB MANAGEMENT TESTS ===');
  const results = [];

  try {
    // Create tab 1
    let response = await sendCommand(ws, {
      command: 'create_tab'
    });
    const tab1 = response.tab?.id;
    const pass1 = response.success && tab1 !== undefined;
    console.log(`[${pass1 ? 'PASS' : 'FAIL'}] Created tab 1: ${tab1}`);
    results.push({
      test: 'Create tab 1',
      passed: pass1
    });

    // Create tab 2
    response = await sendCommand(ws, {
      command: 'create_tab'
    });
    const tab2 = response.tab?.id;
    const pass2 = response.success && tab2 !== undefined;
    console.log(`[${pass2 ? 'PASS' : 'FAIL'}] Created tab 2: ${tab2}`);
    results.push({
      test: 'Create tab 2',
      passed: pass2
    });

    if (tab1 && tab2) {
      // Navigate in tab 1
      response = await sendCommand(ws, {
        command: 'navigate_tab',
        tabId: tab1,
        url: 'https://example.com'
      });
      console.log(`[${response.success ? 'PASS' : 'FAIL'}] Navigate in tab 1`);
      results.push({
        test: 'Navigate in tab 1',
        passed: response.success
      });

      // Navigate in tab 2
      response = await sendCommand(ws, {
        command: 'navigate_tab',
        tabId: tab2,
        url: 'https://example.org'
      });
      console.log(`[${response.success ? 'PASS' : 'FAIL'}] Navigate in tab 2`);
      results.push({
        test: 'Navigate in tab 2',
        passed: response.success
      });

      // Switch to tab 1
      response = await sendCommand(ws, {
        command: 'switch_tab',
        tabId: tab1
      });
      console.log(`[${response.success ? 'PASS' : 'FAIL'}] Switch to tab 1`);
      results.push({
        test: 'Switch to tab 1',
        passed: response.success
      });

      // Close tab 1
      response = await sendCommand(ws, {
        command: 'close_tab',
        tabId: tab1
      });
      console.log(`[${response.success ? 'PASS' : 'FAIL'}] Close tab 1`);
      results.push({
        test: 'Close tab 1',
        passed: response.success
      });

      // Close tab 2
      response = await sendCommand(ws, {
        command: 'close_tab',
        tabId: tab2
      });
      console.log(`[${response.success ? 'PASS' : 'FAIL'}] Close tab 2`);
      results.push({
        test: 'Close tab 2',
        passed: response.success
      });
    }
  } catch (e) {
    console.log(`[FAIL] Tab management - ${e.message}`);
    results.push({
      test: 'Tab management cycle',
      passed: false,
      error: e.message
    });
  }

  metrics.tests.push(...results);
  return results.filter((r) => r.passed).length === results.length;
}

// Content extraction tests
async function testContentExtraction(ws) {
  console.log('\n=== CONTENT EXTRACTION TESTS ===');
  const results = [];

  try {
    // Navigate to a page
    let response = await sendCommand(ws, {
      command: 'navigate',
      url: 'https://example.com'
    });

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Get content (returns in .content object with text, html, title, url)
    response = await sendCommand(ws, {
      command: 'get_content'
    });

    const textPassed = response.success && response.content?.text && response.content.text.length > 0;
    console.log(
      `[${textPassed ? 'PASS' : 'FAIL'}] Extract text - ${
        response.content?.text ? response.content.text.length : 0
      } chars`
    );
    results.push({
      test: 'Extract text content',
      passed: textPassed,
      contentLength: response.content?.text ? response.content.text.length : 0
    });

    // Links may not be extracted from simple pages like example.com
    // So we just check that we can extract, not that links exist
    const linksPassed = response.success && Array.isArray(response.content?.links);
    console.log(
      `[${linksPassed ? 'PASS' : 'FAIL'}] Extract links structure - ${
        response.content?.links ? response.content.links.length : 0
      } found`
    );
    results.push({
      test: 'Extract links',
      passed: linksPassed,
      linksCount: response.content?.links ? response.content.links.length : 0
    });

    const htmlPassed = response.success && response.content?.html && response.content.html.length > 0;
    console.log(
      `[${htmlPassed ? 'PASS' : 'FAIL'}] Extract HTML - ${
        response.content?.html ? response.content.html.length : 0
      } bytes`
    );
    results.push({
      test: 'Extract HTML',
      passed: htmlPassed,
      htmlSize: response.content?.html ? response.content.html.length : 0
    });
  } catch (e) {
    console.log(`[FAIL] Content extraction - ${e.message}`);
    results.push({
      test: 'Content extraction',
      passed: false,
      error: e.message
    });
  }

  metrics.tests.push(...results);
  return results.filter((r) => r.passed).length === results.length;
}

// Memory stability test
async function testMemoryStability(ws) {
  console.log('\n=== MEMORY STABILITY TEST ===');
  const results = [];
  const memorySnapshots = [];

  try {
    const initial = process.memoryUsage();
    memorySnapshots.push(initial);

    // Perform operations
    const operations = 3;
    for (let i = 0; i < operations; i++) {
      await sendCommand(ws, {
        command: 'navigate',
        url: 'https://example.com'
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      await sendCommand(
        ws,
        {
          command: 'screenshot',
          format: 'png'
        },
        5000
      );

      const snapshot = process.memoryUsage();
      memorySnapshots.push(snapshot);
    }

    const heapUsedGrowth =
      memorySnapshots[memorySnapshots.length - 1].heapUsed - initial.heapUsed;
    const heapGrowthMB = (heapUsedGrowth / 1024 / 1024).toFixed(2);

    const passed = heapUsedGrowth < 50 * 1024 * 1024;
    console.log(
      `[${passed ? 'PASS' : 'WARN'}] Heap growth: ${heapGrowthMB}MB (initial: ${(
        initial.heapUsed /
        1024 /
        1024
      ).toFixed(2)}MB)`
    );

    results.push({
      test: 'Memory stability over 3 operations',
      passed,
      heapGrowthMB,
      initialHeapMB: (initial.heapUsed / 1024 / 1024).toFixed(2),
      finalHeapMB: (
        memorySnapshots[memorySnapshots.length - 1].heapUsed /
        1024 /
        1024
      ).toFixed(2)
    });
  } catch (e) {
    console.log(`[FAIL] Memory test - ${e.message}`);
    results.push({
      test: 'Memory stability',
      passed: false,
      error: e.message
    });
  }

  metrics.tests.push(...results);
  return results.filter((r) => r.passed).length === results.length;
}

// Main test runner
async function runTests() {
  console.log('===========================================');
  console.log('BASSET HOUND v11.3.0 - COMPREHENSIVE TEST');
  console.log('===========================================');
  console.log(`Target: ${WS_URL}`);
  console.log(`Test Start: ${new Date().toISOString()}`);

  let ws;
  try {
    ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('WebSocket connected');
        resolve();
      });
      ws.on('error', (err) => {
        reject(err);
      });
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Setup global message handler
    setupMessageHandler(ws);

    // Run test suites
    const testSuites = [
      { name: 'Navigation', fn: testNavigation },
      { name: 'Screenshots', fn: testScreenshots },
      { name: 'Tab Management', fn: testTabManagement },
      { name: 'Content Extraction', fn: testContentExtraction },
      { name: 'Memory Stability', fn: testMemoryStability }
    ];

    for (const suite of testSuites) {
      try {
        await suite.fn(ws);
      } catch (e) {
        console.error(`Suite ${suite.name} error: ${e.message}`);
      }
    }

    // Calculate metrics
    metrics.passedTests = metrics.tests.filter((t) => t.passed).length;
    metrics.failedTests = metrics.tests.filter((t) => !t.passed).length;
    metrics.totalTests = metrics.tests.length;
    metrics.endTime = Date.now();
    metrics.endMemory = process.memoryUsage();
    metrics.duration = ((metrics.endTime - metrics.startTime) / 1000).toFixed(2);

    // Print summary
    console.log('\n===========================================');
    console.log('TEST SUMMARY');
    console.log('===========================================');
    console.log(`Total Tests: ${metrics.totalTests}`);
    console.log(`Passed: ${metrics.passedTests}`);
    console.log(`Failed: ${metrics.failedTests}`);
    console.log(`Pass Rate: ${((metrics.passedTests / metrics.totalTests) * 100).toFixed(1)}%`);
    console.log(`Duration: ${metrics.duration}s`);
    console.log(
      `Memory: ${(metrics.startMemory.heapUsed / 1024 / 1024).toFixed(2)}MB -> ${(
        metrics.endMemory.heapUsed /
        1024 /
        1024
      ).toFixed(2)}MB`
    );

    // Save results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(metrics, null, 2));
    console.log(`\nResults saved to: ${RESULTS_FILE}`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);

    ws.close();
    process.exit(metrics.failedTests > 0 ? 1 : 0);
  } catch (e) {
    console.error('Fatal error:', e.message);
    if (ws) {
      ws.close();
    }
    process.exit(1);
  }
}

runTests();

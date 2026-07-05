/**
 * Basset Hound Browser Comprehensive Stress Test Suite
 *
 * Tests:
 * - Concurrent page navigations (50+ simultaneous)
 * - Rapid tab creation/destruction cycles
 * - Large DOM manipulation
 * - Screenshot capture at high frequency
 * - Form filling operations under load
 * - Multi-page concurrent operations at max concurrency
 * - Navigation to various URLs (valid, invalid, malformed)
 * - Rapid Tor mode switching
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const WS_URL = 'ws://localhost:8765';
const STRESS_RESULTS_DIR = '/home/devel/basset-hound-browser/tests/results/stress';
const TEST_TIMEOUT = 180000; // 3 minutes
const CONCURRENT_NAVIGATIONS = 50;
const TEST_URLS = [
  'https://example.com',
  'https://google.com',
  'https://github.com',
  'https://stackoverflow.com',
  'https://invalid-url-that-does-not-exist.local',
  'https://httpbin.org/status/404',
  'https://httpbin.org/delay/2',
  'ftp://invalid-protocol.com',
  'http://',
  'https://example.com/404/not-found'
];

// Metrics tracking
const metrics = {
  timestamp: new Date().toISOString(),
  test_start_time: Date.now(),
  test_duration_seconds: 0,
  concurrent_navigations: CONCURRENT_NAVIGATIONS,
  total_operations: 0,
  successful_operations: 0,
  failed_operations: 0,
  success_rate: 0,

  // Latency tracking
  navigation_times: [],
  screenshot_times: [],
  tab_creation_times: [],
  form_fill_times: [],
  tor_switch_times: [],

  // Aggregates
  avg_navigation_time_ms: 0,
  min_navigation_time_ms: Infinity,
  max_navigation_time_ms: 0,
  avg_screenshot_time_ms: 0,
  min_screenshot_time_ms: Infinity,
  max_screenshot_time_ms: 0,

  // Resource tracking
  max_concurrent_pages: 0,
  current_tab_count: 0,
  memory_peak_mb: 0,
  memory_start_mb: 0,
  memory_end_mb: 0,

  // Error tracking
  errors: {},
  error_details: [],

  // Sub-test results
  test_results: {}
};

let ws = null;
let requestIdCounter = 0;
const pendingRequests = new Map();
const activeTabIds = new Set();
let memoryCheckInterval = null;

/**
 * Generate unique request ID
 */
function getNextId() {
  return ++requestIdCounter;
}

/**
 * Send command and return promise
 */
function sendCommand(command, params = {}) {
  return new Promise((resolve, reject) => {
    try {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = getNextId();
      const msg = { id, command, ...params };

      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Command timeout: ${command}`));
      }, 30000);

      pendingRequests.set(id, { resolve, reject, timeout, command, startTime: Date.now() });
      ws.send(JSON.stringify(msg));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Monitor memory usage
 */
function startMemoryMonitoring() {
  memoryCheckInterval = setInterval(async () => {
    try {
      const result = await sendCommand('get_memory_usage', {});
      if (result.success && result.data) {
        const memMB = (result.data.heapUsed || 0) / 1024 / 1024;
        if (memMB > metrics.memory_peak_mb) {
          metrics.memory_peak_mb = memMB;
        }
      }
    } catch (err) {
      // Ignore memory check failures
    }
  }, 2000);
}

/**
 * Stop memory monitoring
 */
function stopMemoryMonitoring() {
  if (memoryCheckInterval) {
    clearInterval(memoryCheckInterval);
    memoryCheckInterval = null;
  }
}

/**
 * Test 1: Concurrent Page Navigations
 */
async function testConcurrentNavigations() {
  console.log('\n=== TEST 1: Concurrent Page Navigations ===');
  const result = {
    name: 'concurrent_navigations',
    total: CONCURRENT_NAVIGATIONS,
    successful: 0,
    failed: 0,
    errors: []
  };

  const promises = [];

  for (let i = 0; i < CONCURRENT_NAVIGATIONS; i++) {
    const url = TEST_URLS[i % TEST_URLS.length];
    const promise = (async () => {
      const startTime = Date.now();
      try {
        await sendCommand('navigate', { url });
        const duration = Date.now() - startTime;
        metrics.navigation_times.push(duration);
        metrics.avg_navigation_time_ms = duration;
        metrics.min_navigation_time_ms = Math.min(metrics.min_navigation_time_ms, duration);
        metrics.max_navigation_time_ms = Math.max(metrics.max_navigation_time_ms, duration);
        result.successful++;
        metrics.successful_operations++;
      } catch (err) {
        result.failed++;
        result.errors.push(err.message);
        metrics.failed_operations++;
        recordError('navigation', err.message);
      }
      metrics.total_operations++;
    })();
    promises.push(promise);
  }

  await Promise.allSettled(promises);

  console.log(`  Successful: ${result.successful}/${result.total}`);
  console.log(`  Failed: ${result.failed}/${result.total}`);
  console.log(`  Avg Navigation Time: ${(metrics.navigation_times.reduce((a, b) => a + b, 0) / metrics.navigation_times.length || 0).toFixed(2)}ms`);

  metrics.test_results.concurrent_navigations = result;
  return result;
}

/**
 * Test 2: Rapid Tab Creation and Destruction
 */
async function testTabManagement() {
  console.log('\n=== TEST 2: Rapid Tab Creation/Destruction ===');
  const result = {
    name: 'tab_management',
    total_created: 0,
    total_destroyed: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Create multiple tabs rapidly
  const tabCreationPromises = [];
  for (let i = 0; i < 30; i++) {
    const startTime = Date.now();
    const promise = (async () => {
      try {
        const response = await sendCommand('new_tab', { url: 'https://example.com' });
        if (response.success && response.data && response.data.tabId) {
          activeTabIds.add(response.data.tabId);
          result.total_created++;
          metrics.successful_operations++;
          const duration = Date.now() - startTime;
          metrics.tab_creation_times.push(duration);
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Tab creation: ${err.message}`);
        metrics.failed_operations++;
        recordError('tab_creation', err.message);
      }
      metrics.total_operations++;
    })();
    tabCreationPromises.push(promise);
  }

  await Promise.allSettled(tabCreationPromises);

  metrics.current_tab_count = activeTabIds.size;
  metrics.max_concurrent_pages = Math.max(metrics.max_concurrent_pages, activeTabIds.size);

  console.log(`  Created: ${result.total_created} tabs`);
  console.log(`  Max Concurrent Pages: ${metrics.max_concurrent_pages}`);
  console.log(`  Avg Tab Creation Time: ${(metrics.tab_creation_times.reduce((a, b) => a + b, 0) / metrics.tab_creation_times.length || 0).toFixed(2)}ms`);

  // Now destroy tabs
  const tabDestructionPromises = [];
  for (const tabId of activeTabIds) {
    const promise = (async () => {
      try {
        await sendCommand('close_tab', { tabId });
        result.total_destroyed++;
        metrics.successful_operations++;
      } catch (err) {
        result.failed++;
        result.errors.push(`Tab destruction: ${err.message}`);
        metrics.failed_operations++;
        recordError('tab_destruction', err.message);
      }
      metrics.total_operations++;
    })();
    tabDestructionPromises.push(promise);
  }

  await Promise.allSettled(tabDestructionPromises);
  activeTabIds.clear();

  console.log(`  Destroyed: ${result.total_destroyed} tabs`);
  console.log(`  Success Rate: ${((result.successful / (result.total_created + result.total_destroyed)) * 100).toFixed(2)}%`);

  metrics.test_results.tab_management = result;
  return result;
}

/**
 * Test 3: High-Frequency Screenshot Capture
 */
async function testScreenshotCapture() {
  console.log('\n=== TEST 3: High-Frequency Screenshot Capture ===');
  const result = {
    name: 'screenshot_capture',
    total: 20,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Navigate to a page first
  try {
    await sendCommand('navigate', { url: 'https://example.com' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for load
  } catch (err) {
    console.log('  Navigation failed, skipping screenshot test');
    return result;
  }

  const screenshotPromises = [];
  for (let i = 0; i < 20; i++) {
    const startTime = Date.now();
    const promise = (async () => {
      try {
        const response = await sendCommand('screenshot', {});
        if (response.success) {
          result.successful++;
          metrics.successful_operations++;
          const duration = Date.now() - startTime;
          metrics.screenshot_times.push(duration);
        } else {
          throw new Error(response.error || 'Unknown error');
        }
      } catch (err) {
        result.failed++;
        result.errors.push(err.message);
        metrics.failed_operations++;
        recordError('screenshot', err.message);
      }
      metrics.total_operations++;
    })();
    screenshotPromises.push(promise);

    // Small delay between screenshot requests to avoid hammering
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await Promise.allSettled(screenshotPromises);

  console.log(`  Successful: ${result.successful}/${result.total}`);
  console.log(`  Failed: ${result.failed}/${result.total}`);
  console.log(`  Avg Screenshot Time: ${(metrics.screenshot_times.reduce((a, b) => a + b, 0) / metrics.screenshot_times.length || 0).toFixed(2)}ms`);

  metrics.test_results.screenshot_capture = result;
  return result;
}

/**
 * Test 4: Form Filling Under Load
 */
async function testFormFilling() {
  console.log('\n=== TEST 4: Form Filling Under Load ===');
  const result = {
    name: 'form_filling',
    total: 15,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Navigate to a page with forms
  try {
    await sendCommand('navigate', { url: 'https://httpbin.org/forms/post' });
    await new Promise(resolve => setTimeout(resolve, 3000));
  } catch (err) {
    console.log('  Navigation failed, using fallback form');
  }

  const formPromises = [];
  for (let i = 0; i < 15; i++) {
    const startTime = Date.now();
    const promise = (async () => {
      try {
        // Try to fill a form field (generic selector)
        await sendCommand('fill', {
          selector: 'input[type="text"]',
          value: `Test input ${i} - ${Date.now()}`,
          humanize: true
        });
        result.successful++;
        metrics.successful_operations++;
        const duration = Date.now() - startTime;
        metrics.form_fill_times.push(duration);
      } catch (err) {
        // This is expected to fail sometimes if form doesn't exist
        result.failed++;
        metrics.failed_operations++;
        recordError('form_fill', err.message);
      }
      metrics.total_operations++;
    })();
    formPromises.push(promise);
  }

  await Promise.allSettled(formPromises);

  console.log(`  Attempted: ${result.total}`);
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);
  if (metrics.form_fill_times.length > 0) {
    console.log(`  Avg Fill Time: ${(metrics.form_fill_times.reduce((a, b) => a + b, 0) / metrics.form_fill_times.length).toFixed(2)}ms`);
  }

  metrics.test_results.form_filling = result;
  return result;
}

/**
 * Test 5: Multi-Page Concurrent Operations
 */
async function testMultiPageOperations() {
  console.log('\n=== TEST 5: Multi-Page Concurrent Operations ===');
  const result = {
    name: 'multi_page_operations',
    total_operations: 0,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Create and navigate multiple tabs
  const tabs = [];
  try {
    // First create some tabs
    for (let i = 0; i < 5; i++) {
      try {
        const response = await sendCommand('new_tab', { url: TEST_URLS[i % TEST_URLS.length] });
        if (response.success && response.data && response.data.tabId) {
          tabs.push(response.data.tabId);
        }
      } catch (err) {
        // Ignore tab creation errors
      }
    }

    // Now perform concurrent operations on all tabs
    const operationPromises = [];
    for (const tabId of tabs) {
      for (let op = 0; op < 5; op++) {
        const promise = (async () => {
          try {
            const operations = [
              () => sendCommand('switch_tab', { tabId }),
              () => sendCommand('reload_tab', { tabId }),
              () => sendCommand('get_tab_info', { tabId })
            ];

            const operation = operations[Math.floor(Math.random() * operations.length)];
            await operation();
            result.successful++;
            metrics.successful_operations++;
          } catch (err) {
            result.failed++;
            metrics.failed_operations++;
            recordError('multi_page_op', err.message);
          }
          result.total_operations++;
          metrics.total_operations++;
        })();
        operationPromises.push(promise);
      }
    }

    await Promise.allSettled(operationPromises);

    // Clean up tabs
    for (const tabId of tabs) {
      try {
        await sendCommand('close_tab', { tabId });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    console.log(`  Error in multi-page test: ${err.message}`);
  }

  console.log(`  Total Operations: ${result.total_operations}`);
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);

  metrics.test_results.multi_page_operations = result;
  return result;
}

/**
 * Test 6: URL Handling (Valid, Invalid, Malformed)
 */
async function testURLHandling() {
  console.log('\n=== TEST 6: URL Handling (Valid/Invalid/Malformed) ===');
  const result = {
    name: 'url_handling',
    total: TEST_URLS.length,
    successful: 0,
    failed: 0,
    valid_success: 0,
    invalid_handled: 0,
    errors: []
  };

  const urlPromises = [];
  for (const url of TEST_URLS) {
    const startTime = Date.now();
    const promise = (async () => {
      try {
        const response = await sendCommand('navigate', { url });
        if (response.success) {
          const isValidUrl = url.startsWith('http');
          if (isValidUrl) {
            result.valid_success++;
          } else {
            result.invalid_handled++;
          }
          result.successful++;
          metrics.successful_operations++;
        } else {
          // Invalid URL handling - this might be expected
          result.invalid_handled++;
          metrics.failed_operations++;
        }
      } catch (err) {
        // Could be expected for malformed URLs
        result.invalid_handled++;
        metrics.failed_operations++;
        recordError('url_handling', err.message);
      }
      result.failed++;
      metrics.total_operations++;
    })();
    urlPromises.push(promise);
  }

  await Promise.allSettled(urlPromises);

  console.log(`  Total URLs Tested: ${result.total}`);
  console.log(`  Valid URLs Success: ${result.valid_success}`);
  console.log(`  Invalid URLs Handled: ${result.invalid_handled}`);
  console.log(`  Overall Success: ${result.successful}`);

  metrics.test_results.url_handling = result;
  return result;
}

/**
 * Test 7: Rapid Tor Mode Switching
 */
async function testTorModeSwitching() {
  console.log('\n=== TEST 7: Rapid Tor Mode Switching ===');
  const result = {
    name: 'tor_mode_switching',
    total_switches: 10,
    successful: 0,
    failed: 0,
    errors: []
  };

  const modes = ['ON', 'OFF', 'AUTO'];
  const torPromises = [];

  for (let i = 0; i < 10; i++) {
    const mode = modes[i % modes.length];
    const startTime = Date.now();
    const promise = (async () => {
      try {
        const response = await sendCommand('set_tor_mode', { mode });
        if (response.success) {
          result.successful++;
          metrics.successful_operations++;
          const duration = Date.now() - startTime;
          metrics.tor_switch_times.push(duration);
        } else {
          throw new Error(response.error || 'Unknown error');
        }
      } catch (err) {
        result.failed++;
        result.errors.push(err.message);
        metrics.failed_operations++;
        recordError('tor_switching', err.message);
      }
      metrics.total_operations++;
    })();
    torPromises.push(promise);

    // Small delay between switches
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  await Promise.allSettled(torPromises);

  console.log(`  Total Switches: ${result.total_switches}`);
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);
  if (metrics.tor_switch_times.length > 0) {
    console.log(`  Avg Switch Time: ${(metrics.tor_switch_times.reduce((a, b) => a + b, 0) / metrics.tor_switch_times.length).toFixed(2)}ms`);
  }

  metrics.test_results.tor_mode_switching = result;
  return result;
}

/**
 * Test 8: Large DOM Manipulation
 */
async function testDOMManipulation() {
  console.log('\n=== TEST 8: Large DOM Manipulation ===');
  const result = {
    name: 'dom_manipulation',
    total: 10,
    successful: 0,
    failed: 0,
    errors: []
  };

  // Navigate to a page
  try {
    await sendCommand('navigate', { url: 'https://example.com' });
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (err) {
    console.log('  Navigation failed, skipping DOM test');
    return result;
  }

  const domPromises = [];
  for (let i = 0; i < 10; i++) {
    const promise = (async () => {
      try {
        // Execute a script that manipulates the DOM
        const script = `
          const container = document.body;
          const fragment = document.createDocumentFragment();
          for (let i = 0; i < 100; i++) {
            const div = document.createElement('div');
            div.textContent = 'Test Element ' + i;
            fragment.appendChild(div);
          }
          container.appendChild(fragment);
          document.querySelectorAll('div').length;
        `;

        const response = await sendCommand('execute_script', { script });
        if (response.success) {
          result.successful++;
          metrics.successful_operations++;
        } else {
          throw new Error(response.error || 'Script execution failed');
        }
      } catch (err) {
        result.failed++;
        result.errors.push(err.message);
        metrics.failed_operations++;
        recordError('dom_manipulation', err.message);
      }
      metrics.total_operations++;
    })();
    domPromises.push(promise);
  }

  await Promise.allSettled(domPromises);

  console.log(`  DOM Operations: ${result.total}`);
  console.log(`  Successful: ${result.successful}`);
  console.log(`  Failed: ${result.failed}`);

  metrics.test_results.dom_manipulation = result;
  return result;
}

/**
 * Record error in metrics
 */
function recordError(type, message) {
  if (!metrics.errors[type]) {
    metrics.errors[type] = 0;
  }
  metrics.errors[type]++;
  metrics.error_details.push({
    type,
    message,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle WebSocket messages
 */
function handleMessage(data) {
  try {
    const msg = JSON.parse(data.toString());

    // Skip status messages
    if (msg.type === 'status') {
      return;
    }

    if (!msg.id || !pendingRequests.has(msg.id)) {
      return;
    }

    const pending = pendingRequests.get(msg.id);
    clearTimeout(pending.timeout);
    pendingRequests.delete(msg.id);

    if (msg.success) {
      pending.resolve(msg);
    } else {
      const error = new Error(msg.error || 'Unknown error');
      pending.reject(error);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
}

/**
 * Connect to WebSocket
 */
function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      console.log('Connected to WebSocket:', WS_URL);
      resolve();
    });

    ws.on('message', handleMessage);

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      reject(err);
    });

    ws.on('close', () => {
      console.log('WebSocket closed');
    });

    // Timeout for connection
    setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Get initial memory reading
 */
async function getInitialMemory() {
  try {
    const result = await sendCommand('get_memory_usage', {});
    if (result.success && result.data) {
      metrics.memory_start_mb = (result.data.heapUsed || 0) / 1024 / 1024;
    }
  } catch (err) {
    console.log('Could not get initial memory reading');
  }
}

/**
 * Calculate final metrics
 */
function calculateMetrics() {
  metrics.test_duration_seconds = (Date.now() - metrics.test_start_time) / 1000;

  if (metrics.navigation_times.length > 0) {
    const sum = metrics.navigation_times.reduce((a, b) => a + b, 0);
    metrics.avg_navigation_time_ms = sum / metrics.navigation_times.length;
  }

  if (metrics.screenshot_times.length > 0) {
    const sum = metrics.screenshot_times.reduce((a, b) => a + b, 0);
    metrics.avg_screenshot_time_ms = sum / metrics.screenshot_times.length;
  }

  if (metrics.total_operations > 0) {
    metrics.success_rate = metrics.successful_operations / metrics.total_operations;
  }

  // Add performance summary
  metrics.performance = {
    navigation_latency: {
      min: metrics.min_navigation_time_ms === Infinity ? 0 : metrics.min_navigation_time_ms,
      max: metrics.max_navigation_time_ms,
      avg: metrics.avg_navigation_time_ms,
      samples: metrics.navigation_times.length
    },
    screenshot_latency: {
      min: metrics.min_screenshot_time_ms === Infinity ? 0 : metrics.min_screenshot_time_ms,
      max: metrics.max_screenshot_time_ms,
      avg: metrics.avg_screenshot_time_ms,
      samples: metrics.screenshot_times.length
    },
    tab_creation_latency: {
      samples: metrics.tab_creation_times.length,
      avg: metrics.tab_creation_times.length > 0
        ? metrics.tab_creation_times.reduce((a, b) => a + b, 0) / metrics.tab_creation_times.length
        : 0
    }
  };

  metrics.issues_found = [];

  // Identify issues
  if (metrics.success_rate < 0.80) {
    metrics.issues_found.push(`Low success rate: ${(metrics.success_rate * 100).toFixed(2)}%`);
  }

  if (metrics.max_navigation_time_ms > 30000) {
    metrics.issues_found.push(`High navigation latency detected: ${metrics.max_navigation_time_ms}ms`);
  }

  if (metrics.memory_peak_mb > 1000) {
    metrics.issues_found.push(`High memory usage: ${metrics.memory_peak_mb.toFixed(2)} MB`);
  }

  if (metrics.failed_operations > metrics.successful_operations * 0.2) {
    metrics.issues_found.push(`Error rate exceeds 20%: ${(metrics.failed_operations / metrics.total_operations * 100).toFixed(2)}%`);
  }
}

/**
 * Save results to file
 */
function saveResults() {
  // Ensure directory exists
  if (!fs.existsSync(STRESS_RESULTS_DIR)) {
    fs.mkdirSync(STRESS_RESULTS_DIR, { recursive: true });
  }

  // Save JSON results
  const jsonPath = path.join(STRESS_RESULTS_DIR, 'browser-stress-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2));
  console.log(`\nResults saved to: ${jsonPath}`);

  // Save findings summary
  const findingsPath = path.join(STRESS_RESULTS_DIR, 'browser-stress-findings.txt');
  const findings = `Basset Hound Browser Stress Test Results
Generated: ${new Date().toISOString()}
Duration: ${metrics.test_duration_seconds.toFixed(2)} seconds

SUMMARY
=======
Total Operations: ${metrics.total_operations}
Successful: ${metrics.successful_operations}
Failed: ${metrics.failed_operations}
Success Rate: ${(metrics.success_rate * 100).toFixed(2)}%

PERFORMANCE METRICS
===================
Navigation:
  - Min: ${metrics.performance.navigation_latency.min.toFixed(2)}ms
  - Max: ${metrics.performance.navigation_latency.max}ms
  - Avg: ${metrics.performance.navigation_latency.avg.toFixed(2)}ms
  - Samples: ${metrics.performance.navigation_latency.samples}

Screenshots:
  - Min: ${metrics.performance.screenshot_latency.min.toFixed(2)}ms
  - Max: ${metrics.performance.screenshot_latency.max}ms
  - Avg: ${metrics.performance.screenshot_latency.avg.toFixed(2)}ms
  - Samples: ${metrics.performance.screenshot_latency.samples}

Tab Creation:
  - Avg: ${metrics.performance.tab_creation_latency.avg.toFixed(2)}ms
  - Samples: ${metrics.performance.tab_creation_latency.samples}

RESOURCE USAGE
==============
Max Concurrent Pages: ${metrics.max_concurrent_pages}
Memory Peak: ${metrics.memory_peak_mb.toFixed(2)} MB
Memory Start: ${metrics.memory_start_mb.toFixed(2)} MB
Memory End: ${metrics.memory_end_mb.toFixed(2)} MB
Memory Delta: ${(metrics.memory_end_mb - metrics.memory_start_mb).toFixed(2)} MB

ERRORS BY TYPE
==============
${Object.entries(metrics.errors).map(([type, count]) => `${type}: ${count}`).join('\n')}

ISSUES FOUND
============
${metrics.issues_found.length > 0 ? metrics.issues_found.join('\n') : 'No critical issues found'}

TEST RESULTS BY CATEGORY
=======================
${Object.entries(metrics.test_results).map(([name, result]) => {
    return `${name}:
  - Successful: ${result.successful || result.valid_success || result.total_created || 0}
  - Failed: ${result.failed || 0}
  - Total: ${result.total || result.total_operations || result.total_switches || 0}`;
  }).join('\n\n')}
`;

  fs.writeFileSync(findingsPath, findings);
  console.log(`Findings saved to: ${findingsPath}`);
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Basset Hound Browser Stress Test Suite ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`Start Time: ${metrics.timestamp}`);
  console.log(`WebSocket URL: ${WS_URL}`);

  try {
    // Connect to WebSocket
    await connect();
    await getInitialMemory();

    // Start memory monitoring
    startMemoryMonitoring();

    // Run all tests
    await testConcurrentNavigations();
    await testTabManagement();
    await testScreenshotCapture();
    await testFormFilling();
    await testMultiPageOperations();
    await testURLHandling();
    await testTorModeSwitching();
    await testDOMManipulation();

    // Get final memory reading
    try {
      const result = await sendCommand('get_memory_usage', {});
      if (result.success && result.data) {
        metrics.memory_end_mb = (result.data.heapUsed || 0) / 1024 / 1024;
      }
    } catch (err) {
      // Ignore final memory read errors
    }

    // Calculate and save results
    calculateMetrics();
    saveResults();

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          TEST SUITE COMPLETED          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Success Rate: ${(metrics.success_rate * 100).toFixed(2)}%`);
    console.log(`Total Duration: ${metrics.test_duration_seconds.toFixed(2)}s`);

    if (metrics.issues_found.length > 0) {
      console.log('\nISSUES FOUND:');
      metrics.issues_found.forEach(issue => console.log(`  - ${issue}`));
    } else {
      console.log('\nNo critical issues detected.');
    }

  } catch (err) {
    console.error('Test suite error:', err);
  } finally {
    stopMemoryMonitoring();
    if (ws) {
      ws.close();
    }
    // Allow cleanup before exit
    setTimeout(() => process.exit(0), 2000);
  }
}

// Set timeout for entire test suite
setTimeout(() => {
  console.error('Test suite timeout');
  process.exit(1);
}, TEST_TIMEOUT);

// Run tests
runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

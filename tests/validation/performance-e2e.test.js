#!/usr/bin/env node

/**
 * End-to-End Performance Validation
 * Measures full request cycle latency
 * Targets: <100ms P50, <200ms P95, <500ms P99
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 5000;
const ITERATIONS = 100;

const TEST_RESULTS = {
  operations: {
    navigate: { latencies: [], passed: 0, failed: 0 },
    screenshot: { latencies: [], passed: 0, failed: 0 },
    click: { latencies: [], passed: 0, failed: 0 },
    fill: { latencies: [], passed: 0, failed: 0 },
    getContent: { latencies: [], passed: 0, failed: 0 },
    executeJavaScript: { latencies: [], passed: 0, failed: 0 }
  },
  totalOperations: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: []
};

const LATENCY_TARGETS = {
  navigate: { p50: 100, p95: 200, p99: 500 },
  screenshot: { p50: 150, p95: 300, p99: 800 },
  click: { p50: 50, p95: 100, p99: 200 },
  fill: { p50: 50, p95: 100, p99: 200 },
  getContent: { p50: 75, p95: 150, p99: 300 },
  executeJavaScript: { p50: 100, p95: 200, p99: 500 }
};

/**
 * WebSocket Client
 */
class PerformanceTestClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(100);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              const { resolve: res, startTime } = this.responseMap.get(msg.requestId);
              const latency = Date.now() - startTime;
              res({ msg, latency });
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {}
        });

        this.ws.on('error', (err) => {
          if (!this.connected) {
            reject(err);
          }
        });

        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Connection timeout'));
          }
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        startTime: Date.now()
      });

      try {
        this.ws.send(JSON.stringify({ command, params, requestId }));
      } catch (err) {
        clearTimeout(timer);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Calculate latency statistics
 */
function getLatencyStats(latencies) {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

/**
 * Test navigate operation latency
 */
async function testNavigateLatency(client) {
  console.log(`[Performance] Testing navigate operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('navigate', {
        url: 'https://example.com'
      });
      TEST_RESULTS.operations.navigate.latencies.push(result.latency);
      TEST_RESULTS.operations.navigate.passed++;
    } catch (error) {
      TEST_RESULTS.operations.navigate.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.navigate.latencies);
  const targets = LATENCY_TARGETS.navigate;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Test screenshot operation latency
 */
async function testScreenshotLatency(client) {
  console.log(`[Performance] Testing screenshot operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('screenshot', {}, 10000);
      TEST_RESULTS.operations.screenshot.latencies.push(result.latency);
      TEST_RESULTS.operations.screenshot.passed++;
    } catch (error) {
      TEST_RESULTS.operations.screenshot.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.screenshot.latencies);
  const targets = LATENCY_TARGETS.screenshot;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Test click operation latency
 */
async function testClickLatency(client) {
  console.log(`[Performance] Testing click operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('click', {
        selector: 'button'
      });
      TEST_RESULTS.operations.click.latencies.push(result.latency);
      TEST_RESULTS.operations.click.passed++;
    } catch (error) {
      TEST_RESULTS.operations.click.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.click.latencies);
  const targets = LATENCY_TARGETS.click;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Test fill operation latency
 */
async function testFillLatency(client) {
  console.log(`[Performance] Testing fill operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('fill', {
        selector: 'input',
        text: 'test value'
      });
      TEST_RESULTS.operations.fill.latencies.push(result.latency);
      TEST_RESULTS.operations.fill.passed++;
    } catch (error) {
      TEST_RESULTS.operations.fill.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.fill.latencies);
  const targets = LATENCY_TARGETS.fill;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Test getContent operation latency
 */
async function testGetContentLatency(client) {
  console.log(`[Performance] Testing getContent operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('getContent', {
        selector: 'body'
      });
      TEST_RESULTS.operations.getContent.latencies.push(result.latency);
      TEST_RESULTS.operations.getContent.passed++;
    } catch (error) {
      TEST_RESULTS.operations.getContent.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.getContent.latencies);
  const targets = LATENCY_TARGETS.getContent;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Test executeJavaScript operation latency
 */
async function testExecuteJavaScriptLatency(client) {
  console.log(`[Performance] Testing executeJavaScript operation latency (${ITERATIONS} iterations)...`);

  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const result = await client.sendCommand('executeJavaScript', {
        code: '1 + 1'
      });
      TEST_RESULTS.operations.executeJavaScript.latencies.push(result.latency);
      TEST_RESULTS.operations.executeJavaScript.passed++;
    } catch (error) {
      TEST_RESULTS.operations.executeJavaScript.failed++;
    }
  }

  const stats = getLatencyStats(TEST_RESULTS.operations.executeJavaScript.latencies);
  const targets = LATENCY_TARGETS.executeJavaScript;
  const p50Pass = stats.p50 <= targets.p50;
  const p95Pass = stats.p95 <= targets.p95;
  const p99Pass = stats.p99 <= targets.p99;

  console.log(`  P50: ${stats.p50}ms (target: ${targets.p50}ms) ${p50Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P95: ${stats.p95}ms (target: ${targets.p95}ms) ${p95Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  P99: ${stats.p99}ms (target: ${targets.p99}ms) ${p99Pass ? 'PASS' : 'FAIL'}`);
  console.log(`  Avg: ${stats.avg}ms, Min: ${stats.min}ms, Max: ${stats.max}ms\n`);

  return p50Pass && p95Pass && p99Pass;
}

/**
 * Run all performance tests
 */
async function runPerformanceTests() {
  console.log('\n========================================');
  console.log('END-TO-END PERFORMANCE VALIDATION');
  console.log('========================================\n');

  let client;
  const results = [];

  try {
    client = new PerformanceTestClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    // Run all performance tests
    results.push(await testNavigateLatency(client));
    results.push(await testScreenshotLatency(client));
    results.push(await testClickLatency(client));
    results.push(await testFillLatency(client));
    results.push(await testGetContentLatency(client));
    results.push(await testExecuteJavaScriptLatency(client));

    // Calculate totals
    TEST_RESULTS.totalPassed = results.filter((r) => r === true).length;
    TEST_RESULTS.totalFailed = results.filter((r) => r === false).length;

    // Print summary
    console.log('========================================');
    console.log('PERFORMANCE TEST SUMMARY');
    console.log('========================================');
    console.log(`Operations tested: 6`);
    console.log(`Iterations per operation: ${ITERATIONS}`);
    console.log(`Total latency measurements: ${ITERATIONS * 6}`);
    console.log(`Passed: ${TEST_RESULTS.totalPassed}/6`);
    console.log(`Failed: ${TEST_RESULTS.totalFailed}/6`);
    console.log(
      `Success Rate: ${(
        (TEST_RESULTS.totalPassed / 6) *
        100
      ).toFixed(2)}%`
    );

    console.log('\nPerformance Requirements Met:');
    Object.entries(TEST_RESULTS.operations).forEach(([op, data]) => {
      if (data.latencies.length > 0) {
        const stats = getLatencyStats(data.latencies);
        const targets = LATENCY_TARGETS[op];
        const allMet = stats.p50 <= targets.p50 && stats.p95 <= targets.p95 && stats.p99 <= targets.p99;
        console.log(`  ${op}: ${allMet ? 'PASS' : 'FAIL'}`);
      }
    });

    return TEST_RESULTS.totalFailed === 0 ? 0 : 1;
  } catch (error) {
    console.error('Test suite error:', error.message);
    return 1;
  } finally {
    if (client) {
      client.disconnect();
    }
  }
}

// Run tests
runPerformanceTests()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

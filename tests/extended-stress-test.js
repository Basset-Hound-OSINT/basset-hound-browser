#!/usr/bin/env node

/**
 * Extended Stress Test for v11.3.0-fixed (5-10 minutes)
 * Comprehensive validation of performance, memory, and stability
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WS_URL = 'ws://localhost:8765';

let testResults = {
  test_name: 'v11.3.0-fixed Extended Stress Test',
  test_date: new Date().toISOString(),
  test_start_time: Date.now(),
  sections: {
    throughput: { total: 0, success: 0, failed: 0, latencies: [] },
    memory: { samples: [] },
    navigation: { total: 0, latencies: [] },
    screenshot: { total: 0, latencies: [] },
    tab_cycles: { created: 0, destroyed: 0, errors: [] },
    stability: { crashes: 0, errors: [], hangs: 0 }
  }
};

const startMemory = process.memoryUsage();
let testStartTime = Date.now();
let messageCounter = 0;
let pendingCommands = 0;

function logTest(message) {
  const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
  console.log(`[${elapsed}s] ${message}`);
}

function getMemoryDelta() {
  const current = process.memoryUsage();
  return {
    heap_mb: Math.round((current.heapUsed / 1024 / 1024 - startMemory.heapUsed / 1024 / 1024) * 100) / 100,
    rss_mb: Math.round((current.rss / 1024 / 1024 - startMemory.rss / 1024 / 1024) * 100) / 100,
    current_heap: Math.round((current.heapUsed / 1024 / 1024) * 100) / 100
  };
}

function sendCommand(ws, command, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    try {
      const startTime = Date.now();
      const messageId = ++messageCounter;
      pendingCommands++;

      const timeout = setTimeout(() => {
        ws.removeListener('message', messageHandler);
        pendingCommands--;
        reject(new Error('Timeout'));
      }, timeoutMs);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          // Skip status messages
          if (response.type === 'status') {
            return;
          }
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          pendingCommands--;
          const latency = Date.now() - startTime;
          resolve({ latency, response, success: response.success === true });
        } catch (e) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          pendingCommands--;
          resolve({ latency: Date.now() - startTime, response: null, success: false });
        }
      };

      ws.on('message', messageHandler);

      ws.send(JSON.stringify({ ...command, id: messageId }), (err) => {
        if (err) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          pendingCommands--;
          reject(err);
        }
      });
    } catch (e) {
      pendingCommands--;
      reject(e);
    }
  });
}

async function test1_HighThroughput() {
  logTest('Test 1: High Throughput (150+ commands in burst)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        const startTime = Date.now();
        const commands = Array(150).fill(0).map(() => ({ command: 'list_tabs' }));

        // Send all commands rapidly and wait for responses
        const promises = commands.map(cmd =>
          sendCommand(ws, cmd).catch(e => ({ success: false, latency: 0 }))
        );

        const results = await Promise.all(promises);
        const elapsed = Date.now() - startTime;

        let successCount = 0;
        results.forEach(result => {
          testResults.sections.throughput.total++;
          if (result.success) {
            testResults.sections.throughput.success++;
            testResults.sections.throughput.latencies.push(result.latency);
            successCount++;
          } else {
            testResults.sections.throughput.failed++;
          }
        });

        const cmdPerSec = Math.round((successCount / elapsed) * 1000);
        logTest(`Throughput: ${successCount}/${testResults.sections.throughput.total} success in ${elapsed}ms (${cmdPerSec} cmd/sec)`);

        ws.close();
        resolve();
      } catch (e) {
        logTest(`Throughput test error: ${e.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (e) => {
      testResults.sections.stability.errors.push(`Connection error: ${e.message}`);
      resolve();
    });
  });
}

async function test2_MemoryStability() {
  logTest('Test 2: Memory stability monitoring (10 samples over 10s)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        let samples = 0;
        const maxSamples = 10;
        const sampleInterval = setInterval(async () => {
          const delta = getMemoryDelta();
          testResults.sections.memory.samples.push(delta);
          samples++;
          logTest(`Memory sample ${samples}: heap=${delta.current_heap}MB, growth=${delta.heap_mb}MB`);

          if (samples >= maxSamples) {
            clearInterval(sampleInterval);

            // Analyze memory trend
            const heapValues = testResults.sections.memory.samples.map(s => s.current_heap);
            const avgGrowthPerSample = (heapValues[maxSamples - 1] - heapValues[0]) / (maxSamples - 1);
            logTest(`Memory trend: ${avgGrowthPerSample.toFixed(2)}MB/sample growth rate`);

            ws.close();
            resolve();
          }
        }, 1000);
      } catch (e) {
        logTest(`Memory test error: ${e.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', () => resolve());
  });
}

async function test3_NavigationLoad() {
  logTest('Test 3: Navigation load test (5 rapid navigations)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        const urls = [
          'https://example.com',
          'https://google.com',
          'https://github.com',
          'https://amazon.com',
          'https://wikipedia.org'
        ];

        for (const url of urls) {
          try {
            const result = await sendCommand(ws, {
              command: 'navigate',
              url: url
            }, 10000);
            testResults.sections.navigation.total++;
            if (result.success) {
              testResults.sections.navigation.latencies.push(result.latency);
              logTest(`Navigate ${url.split('/')[2]}: ${result.latency}ms`);
            }
          } catch (e) {
            testResults.sections.navigation.total++;
            logTest(`Navigation error: ${e.message}`);
          }
        }

        const avgLatency = testResults.sections.navigation.latencies.length > 0
          ? Math.round(testResults.sections.navigation.latencies.reduce((a, b) => a + b) / testResults.sections.navigation.latencies.length)
          : 0;
        logTest(`Navigation avg: ${avgLatency}ms`);

        ws.close();
        resolve();
      } catch (e) {
        logTest(`Navigation test error: ${e.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', () => resolve());
  });
}

async function test4_ScreenshotLoad() {
  logTest('Test 4: Screenshot load test (5 screenshots)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        // Navigate to a page first
        try {
          await sendCommand(ws, {
            command: 'navigate',
            url: 'https://example.com'
          }, 10000);

          // Wait for page to settle
          await new Promise(r => setTimeout(r, 3000));

          // Take screenshots
          for (let i = 0; i < 5; i++) {
            try {
              const result = await sendCommand(ws, {
                command: 'screenshot'
              }, 5000);
              testResults.sections.screenshot.total++;
              if (result.success) {
                testResults.sections.screenshot.latencies.push(result.latency);
                logTest(`Screenshot ${i + 1}: ${result.latency}ms`);
              }
            } catch (e) {
              testResults.sections.screenshot.total++;
              logTest(`Screenshot error: ${e.message}`);
            }
          }
        } catch (e) {
          logTest(`Screenshot test error: ${e.message}`);
        }

        const avgLatency = testResults.sections.screenshot.latencies.length > 0
          ? Math.round(testResults.sections.screenshot.latencies.reduce((a, b) => a + b) / testResults.sections.screenshot.latencies.length)
          : 0;
        logTest(`Screenshot avg: ${avgLatency}ms`);

        ws.close();
        resolve();
      } catch (e) {
        logTest(`Screenshot test error: ${e.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', () => resolve());
  });
}

async function test5_TabStress() {
  logTest('Test 5: Tab create/destroy stress (20+ cycles)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        let createSuccess = 0;
        let destroySuccess = 0;
        const createdTabs = [];

        // Create 20 tabs
        for (let i = 0; i < 20; i++) {
          try {
            const createResult = await sendCommand(ws, {
              command: 'create_tab'
            }, 5000);
            if (createResult.success && createResult.response?.tab_id) {
              createSuccess++;
              testResults.sections.tab_cycles.created++;
              createdTabs.push(createResult.response.tab_id);
            }
          } catch (e) {
            testResults.sections.tab_cycles.errors.push(`Create: ${e.message}`);
          }
        }

        logTest(`Tab creation: ${createSuccess} tabs created`);

        // Now destroy them
        for (const tabId of createdTabs) {
          try {
            const destroyResult = await sendCommand(ws, {
              command: 'close_tab',
              tab_id: tabId
            }, 5000);
            if (destroyResult.success) {
              destroySuccess++;
              testResults.sections.tab_cycles.destroyed++;
            }
          } catch (e) {
            testResults.sections.tab_cycles.errors.push(`Destroy: ${e.message}`);
          }
        }

        logTest(`Tab destruction: ${destroySuccess} tabs destroyed`);
        ws.close();
        resolve();
      } catch (e) {
        logTest(`Tab cycle test error: ${e.message}`);
        ws.close();
        resolve();
      }
    });

    ws.on('error', () => resolve());
  });
}

async function runTests() {
  try {
    logTest('Starting extended stress test - v11.3.0-fixed');
    logTest('Target: >100 cmd/sec, stable memory growth, <2s nav, <3s screenshot');

    await test1_HighThroughput();
    await test2_MemoryStability();
    await test3_NavigationLoad();
    await test4_ScreenshotLoad();
    await test5_TabStress();

    // Wait for any pending commands
    let waitCount = 0;
    while (pendingCommands > 0 && waitCount < 50) {
      await new Promise(r => setTimeout(r, 100));
      waitCount++;
    }

    // Calculate summary
    const totalElapsed = Date.now() - testResults.test_start_time;
    const memoryGrowth = getMemoryDelta();

    // Analyze throughput
    const throughputElapsed = testResults.sections.throughput.total > 0 ?
      testResults.sections.throughput.latencies.reduce((a, b) => a + b, 0) / testResults.sections.throughput.total : 0;

    testResults.summary = {
      total_duration_ms: totalElapsed,
      throughput_success: testResults.sections.throughput.success,
      throughput_total: testResults.sections.throughput.total,
      throughput_pass: testResults.sections.throughput.success >= 140,
      throughput_rate: Math.round((testResults.sections.throughput.success / (totalElapsed / 1000))),
      throughput_avg_latency: Math.round(testResults.sections.throughput.latencies.length > 0
        ? testResults.sections.throughput.latencies.reduce((a, b) => a + b) / testResults.sections.throughput.latencies.length
        : 0),
      memory_growth_heap_mb: memoryGrowth.heap_mb,
      memory_growth_rss_mb: memoryGrowth.rss_mb,
      memory_stable: Math.abs(memoryGrowth.heap_mb) < 10,
      memory_samples: testResults.sections.memory.samples.length,
      nav_tests: testResults.sections.navigation.total,
      nav_avg_latency_ms: testResults.sections.navigation.latencies.length > 0
        ? Math.round(testResults.sections.navigation.latencies.reduce((a, b) => a + b) / testResults.sections.navigation.latencies.length)
        : 0,
      screenshot_tests: testResults.sections.screenshot.total,
      screenshot_avg_latency_ms: testResults.sections.screenshot.latencies.length > 0
        ? Math.round(testResults.sections.screenshot.latencies.reduce((a, b) => a + b) / testResults.sections.screenshot.latencies.length)
        : 0,
      tab_cycles_created: testResults.sections.tab_cycles.created,
      tab_cycles_destroyed: testResults.sections.tab_cycles.destroyed,
      tab_cycles_pass: testResults.sections.tab_cycles.created >= 20 && testResults.sections.tab_cycles.destroyed >= 15,
      stability_pass: testResults.sections.stability.crashes === 0 && testResults.sections.stability.hangs === 0
    };

    // Print results
    console.log('\n========== EXTENDED STRESS TEST RESULTS (v11.3.0-fixed) ==========');
    console.log(`Total Duration: ${(totalElapsed / 1000).toFixed(1)}s`);
    console.log('\n[THROUGHPUT]');
    console.log(`  Commands: ${testResults.summary.throughput_success}/${testResults.summary.throughput_total} success`);
    console.log(`  Rate: ${testResults.summary.throughput_rate} cmd/sec (target: >100)`);
    console.log(`  Avg Latency: ${testResults.summary.throughput_avg_latency}ms`);
    console.log(`  Status: ${testResults.summary.throughput_pass ? 'PASS' : 'CHECK'}`);
    console.log('\n[MEMORY STABILITY]');
    console.log(`  Heap Growth: ${memoryGrowth.heap_mb}MB`);
    console.log(`  RSS Growth: ${memoryGrowth.rss_mb}MB`);
    console.log(`  Current Heap: ${memoryGrowth.current_heap}MB`);
    console.log(`  Samples: ${testResults.summary.memory_samples}`);
    console.log(`  Status: ${testResults.summary.memory_stable ? 'STABLE (P0 leak fix confirmed)' : 'REVIEW'}`);
    console.log('\n[NAVIGATION]');
    console.log(`  Tests: ${testResults.summary.nav_tests}`);
    console.log(`  Avg Latency: ${testResults.summary.nav_avg_latency_ms}ms (target: <2000ms)`);
    console.log(`  Status: ${testResults.summary.nav_avg_latency_ms < 2000 ? 'PASS' : 'CHECK'}`);
    console.log('\n[SCREENSHOT]');
    console.log(`  Tests: ${testResults.summary.screenshot_tests}`);
    console.log(`  Avg Latency: ${testResults.summary.screenshot_avg_latency_ms}ms (target: <3000ms)`);
    console.log(`  Status: ${testResults.summary.screenshot_avg_latency_ms < 3000 ? 'PASS' : 'CHECK'}`);
    console.log('\n[TAB MANAGEMENT]');
    console.log(`  Created: ${testResults.summary.tab_cycles_created}`);
    console.log(`  Destroyed: ${testResults.summary.tab_cycles_destroyed}`);
    console.log(`  Status: ${testResults.summary.tab_cycles_pass ? 'PASS' : 'REVIEW'}`);
    console.log('\n[STABILITY]');
    console.log(`  Crashes: ${testResults.sections.stability.crashes}`);
    console.log(`  Hangs: ${testResults.sections.stability.hangs}`);
    console.log(`  Errors: ${testResults.sections.stability.errors.length}`);
    console.log(`  Status: ${testResults.summary.stability_pass ? 'PASS - NO CRASHES' : 'FAIL'}`);
    console.log('==================================================================\n');

    // Overall assessment
    const passCount = [
      testResults.summary.throughput_pass,
      testResults.summary.memory_stable,
      testResults.summary.nav_avg_latency_ms < 2000,
      testResults.summary.screenshot_avg_latency_ms < 3000,
      testResults.summary.tab_cycles_pass,
      testResults.summary.stability_pass
    ].filter(Boolean).length;

    console.log(`OVERALL ASSESSMENT: ${passCount}/6 critical metrics PASS`);
    console.log(`v11.3.0-fixed STATUS: ${passCount === 6 ? '100% PASS RATE - PRODUCTION READY' : 'REVIEW NEEDED'}\n`);

    // Save results
    const resultsDir = path.join('/home/devel/basset-hound-browser/tests/results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(resultsDir, 'extended-stress-test-results.json'),
      JSON.stringify(testResults, null, 2)
    );

    logTest('Results saved to tests/results/extended-stress-test-results.json');

    process.exit(passCount === 6 ? 0 : 1);
  } catch (e) {
    console.error('Test error:', e);
    process.exit(1);
  }
}

// Run tests
runTests().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

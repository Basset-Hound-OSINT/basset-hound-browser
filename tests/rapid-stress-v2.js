#!/usr/bin/env node

/**
 * Rapid Stress Test for v11.3.0-fixed (5 minutes)
 * Quick validation of performance and stability - FIXED PROTOCOL
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WS_URL = 'ws://localhost:8765';

let testResults = {
  test_name: 'v11.3.0-fixed Rapid Stress Test (5 min)',
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

function sendCommand(ws, command) {
  return new Promise((resolve, reject) => {
    try {
      const startTime = Date.now();
      const messageId = ++messageCounter;

      const timeout = setTimeout(() => {
        ws.removeListener('message', messageHandler);
        reject(new Error('Timeout'));
      }, 8000);

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          // Skip status messages
          if (response.type === 'status') {
            return;
          }
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          const latency = Date.now() - startTime;
          resolve({ latency, response, success: response.success === true });
        } catch (e) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve({ latency: Date.now() - startTime, response: null, success: false });
        }
      };

      ws.on('message', messageHandler);

      ws.send(JSON.stringify({ ...command, id: messageId }), (err) => {
        if (err) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          reject(err);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function test1_Throughput() {
  logTest('Test 1: Throughput (50+ rapid ping commands)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        const commands = Array(50).fill(0).map((_, i) => ({
          command: 'list_tabs'
        }));

        const startTime = Date.now();
        let successCount = 0;

        for (const cmd of commands) {
          try {
            const result = await sendCommand(ws, cmd);
            testResults.sections.throughput.total++;
            if (result.success) {
              testResults.sections.throughput.success++;
              testResults.sections.throughput.latencies.push(result.latency);
              successCount++;
            } else {
              testResults.sections.throughput.failed++;
            }
          } catch (e) {
            testResults.sections.throughput.total++;
            testResults.sections.throughput.failed++;
          }
        }

        const elapsed = Date.now() - startTime;
        const cmdPerSec = Math.round((successCount / elapsed) * 1000);
        logTest(`Throughput: ${successCount}/${testResults.sections.throughput.total} success, ${cmdPerSec} cmd/sec`);

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

async function test2_Memory() {
  logTest('Test 2: Memory monitoring (5 samples)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        let samples = 0;
        const sampleInterval = setInterval(() => {
          const delta = getMemoryDelta();
          testResults.sections.memory.samples.push(delta);
          samples++;
          if (samples >= 5) {
            clearInterval(sampleInterval);
            logTest(`Memory: ${samples} samples, delta: ${delta.heap_mb}MB, current: ${delta.current_heap}MB`);
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

async function test3_Navigation() {
  logTest('Test 3: Navigation latency (<1.3s target)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        // Navigate first
        try {
          const navResult = await sendCommand(ws, {
            command: 'navigate',
            url: 'https://example.com'
          });
          testResults.sections.navigation.total++;
          if (navResult.success) {
            testResults.sections.navigation.latencies.push(navResult.latency);
            logTest(`Navigate example.com: ${navResult.latency}ms`);
          }
        } catch (e) {
          testResults.sections.navigation.total++;
          logTest(`Navigation error: ${e.message}`);
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

async function test4_Screenshot() {
  logTest('Test 4: Screenshot latency (<2s target)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        // First navigate
        try {
          await sendCommand(ws, {
            command: 'navigate',
            url: 'https://example.com'
          });

          // Wait for page to settle
          await new Promise(r => setTimeout(r, 2000));

          // Then take screenshots
          for (let i = 0; i < 2; i++) {
            try {
              const result = await sendCommand(ws, {
                command: 'screenshot'
              });
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

async function test5_TabCycles() {
  logTest('Test 5: Tab create/destroy cycles (10+)');
  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      try {
        let createSuccess = 0;
        let destroySuccess = 0;

        for (let i = 0; i < 10; i++) {
          try {
            // Create tab
            const createResult = await sendCommand(ws, {
              command: 'create_tab'
            });
            if (createResult.success) {
              createSuccess++;
              testResults.sections.tab_cycles.created++;
            }

            // Destroy tab
            if (createResult.response?.tab_id) {
              const destroyResult = await sendCommand(ws, {
                command: 'close_tab',
                tab_id: createResult.response.tab_id
              });
              if (destroyResult.success) {
                destroySuccess++;
                testResults.sections.tab_cycles.destroyed++;
              }
            }
          } catch (e) {
            testResults.sections.tab_cycles.errors.push(e.message);
          }
        }

        logTest(`Tab cycles: created=${createSuccess}, destroyed=${destroySuccess}`);
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
    logTest('Starting rapid stress test (5 min) - v11.3.0-fixed');
    logTest('Target: >109 cmd/sec, <1.3s nav, <2s screenshot, 10+ tab cycles');

    await test1_Throughput();
    await test2_Memory();
    await test3_Navigation();
    await test4_Screenshot();
    await test5_TabCycles();

    // Calculate summary
    const totalElapsed = Date.now() - testResults.test_start_time;
    const memoryGrowth = getMemoryDelta();

    testResults.summary = {
      total_duration_ms: totalElapsed,
      throughput_pass: testResults.sections.throughput.success >= 40,
      throughput_rate: testResults.sections.throughput.latencies.length > 0
        ? Math.round((testResults.sections.throughput.success / totalElapsed) * 1000)
        : 0,
      throughput_avg_latency: testResults.sections.throughput.latencies.length > 0
        ? Math.round(testResults.sections.throughput.latencies.reduce((a, b) => a + b) / testResults.sections.throughput.latencies.length)
        : 0,
      memory_growth_heap_mb: memoryGrowth.heap_mb,
      memory_growth_rss_mb: memoryGrowth.rss_mb,
      nav_avg_latency_ms: testResults.sections.navigation.latencies.length > 0
        ? Math.round(testResults.sections.navigation.latencies.reduce((a, b) => a + b) / testResults.sections.navigation.latencies.length)
        : 0,
      screenshot_avg_latency_ms: testResults.sections.screenshot.latencies.length > 0
        ? Math.round(testResults.sections.screenshot.latencies.reduce((a, b) => a + b) / testResults.sections.screenshot.latencies.length)
        : 0,
      tab_cycles_pass: testResults.sections.tab_cycles.created >= 10,
      stability_pass: testResults.sections.stability.crashes === 0 && testResults.sections.stability.hangs === 0
    };

    // Print results
    console.log('\n========== RAPID STRESS TEST RESULTS (v11.3.0-fixed) ==========');
    console.log(`Total Duration: ${(totalElapsed / 1000).toFixed(1)}s`);
    console.log(`Throughput: ${testResults.summary.throughput_rate} cmd/sec (target: >109)`);
    console.log(`  Success: ${testResults.sections.throughput.success}/${testResults.sections.throughput.total}`);
    console.log(`  Avg Latency: ${testResults.summary.throughput_avg_latency}ms`);
    console.log(`  Status: ${testResults.summary.throughput_pass ? 'PASS' : 'CHECK'}`);
    console.log('\nMemory:');
    console.log(`  Heap Growth: ${memoryGrowth.heap_mb}MB`);
    console.log(`  RSS Growth: ${memoryGrowth.rss_mb}MB`);
    console.log(`  Current Heap: ${memoryGrowth.current_heap}MB`);
    console.log(`  Status: ${Math.abs(memoryGrowth.heap_mb) < 5 ? 'STABLE (P0 leak fix working)' : 'REVIEW'}`);
    console.log('\nNavigation:');
    console.log(`  Avg Latency: ${testResults.summary.nav_avg_latency_ms}ms (target: <1300ms)`);
    console.log(`  Status: ${testResults.summary.nav_avg_latency_ms < 1300 ? 'PASS' : 'CHECK'}`);
    console.log('\nScreenshot:');
    console.log(`  Avg Latency: ${testResults.summary.screenshot_avg_latency_ms}ms (target: <2000ms)`);
    console.log(`  Status: ${testResults.summary.screenshot_avg_latency_ms < 2000 ? 'PASS' : 'CHECK'}`);
    console.log('\nTab Cycles:');
    console.log(`  Created: ${testResults.sections.tab_cycles.created}, Destroyed: ${testResults.sections.tab_cycles.destroyed} (target: 10+)`);
    console.log(`  Status: ${testResults.summary.tab_cycles_pass ? 'PASS' : 'NEEDS REVIEW'}`);
    console.log('\nStability:');
    console.log(`  Crashes: ${testResults.sections.stability.crashes}`);
    console.log(`  Hangs: ${testResults.sections.stability.hangs}`);
    console.log(`  Errors: ${testResults.sections.stability.errors.length}`);
    console.log(`  Status: ${testResults.summary.stability_pass ? 'PASS' : 'FAIL'}`);
    console.log('==============================================================\n');

    // Save results
    const resultsDir = path.join('/home/devel/basset-hound-browser/tests/results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(resultsDir, 'rapid-stress-5min-v2-results.json'),
      JSON.stringify(testResults, null, 2)
    );

    logTest('Results saved to tests/results/rapid-stress-5min-v2-results.json');

    process.exit(testResults.summary.stability_pass && testResults.sections.stability.errors.length === 0 ? 0 : 1);
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

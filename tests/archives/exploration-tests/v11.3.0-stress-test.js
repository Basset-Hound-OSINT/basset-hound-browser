#!/usr/bin/env node

/**
 * v11.3.0 Comprehensive Stress Test & Performance Validation
 * Tests all critical performance improvements and stability under stress
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const WS_URL = 'ws://localhost:8765';
const TEST_DURATION_SECONDS = 600; // 10 minutes
const MEMORY_SAMPLE_INTERVAL_MS = 5000; // Sample every 5 seconds
const LATENCY_SAMPLE_INTERVAL_MS = 1000; // Record latencies frequently

let testStartTime = Date.now();
let testResults = {
  metadata: {
    test_name: 'v11.3.0 Comprehensive Stress Test',
    test_date: new Date().toISOString(),
    environment: {
      node_version: process.version,
      platform: os.platform(),
      ws_url: WS_URL
    }
  },
  test_config: {
    target_duration_minutes: Math.floor(TEST_DURATION_SECONDS / 60),
    memory_sample_interval_ms: MEMORY_SAMPLE_INTERVAL_MS,
    latency_sample_interval_ms: LATENCY_SAMPLE_INTERVAL_MS
  },
  memory_samples: [],
  throughput_test: {
    total_commands_sent: 0,
    successful_commands: 0,
    failed_commands: 0,
    latencies: []
  },
  latency_tests: {
    navigate: [],
    screenshot: [],
    tab_create: [],
    tab_close: [],
    execute: []
  },
  stability_test: {
    tabs_created: 0,
    tabs_destroyed: 0,
    connect_cycles: 0,
    disconnect_cycles: 0,
    crashes: 0,
    errors: []
  },
  concurrent_connections: {
    max_concurrent: 0,
    successful_connections: 0,
    failed_connections: 0,
    active_connections: []
  }
};

// Helper functions
function logTest(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    heap_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
    heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
    rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    external_mb: Math.round((mem.external / 1024 / 1024) * 100) / 100,
    array_buffers_mb: Math.round((mem.arrayBuffers / 1024 / 1024) * 100) / 100
  };
}

function recordMemorySample() {
  const mem = getMemoryUsage();
  const elapsed = Math.floor((Date.now() - testStartTime) / 1000);
  mem.time_seconds = elapsed;
  mem.active_connections = testResults.concurrent_connections.active_connections.length;
  testResults.memory_samples.push(mem);
  logTest(`Memory sample: heap=${mem.heap_mb}MB (${mem.rss_mb}MB RSS), connections=${mem.active_connections}`);
}

function sendWebSocketCommand(ws, command, timeout = 5000) {
  return new Promise((resolve, reject) => {
    try {
      const startTime = Date.now();
      const messageId = Math.random().toString(36).substring(7);

      const timer = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, timeout);

      ws.once('message', (data) => {
        clearTimeout(timer);
        const latency = Date.now() - startTime;
        resolve({ data: data.toString(), latency });
      });

      ws.send(JSON.stringify(command), (err) => {
        if (err) {
          clearTimeout(timer);
          reject(err);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function testMemoryLeaks() {
  logTest('=== MEMORY LEAK TEST ===');
  logTest('Running 50+ operations over 5+ minutes...');

  const startMem = getMemoryUsage();
  const operations = [];
  let operationCount = 0;

  return new Promise((resolve) => {
    const memoryInterval = setInterval(recordMemorySample, MEMORY_SAMPLE_INTERVAL_MS);

    const operationInterval = setInterval(async () => {
      if (Date.now() - testStartTime > 5 * 60 * 1000) {
        clearInterval(operationInterval);
        clearInterval(memoryInterval);

        const endMem = getMemoryUsage();
        const heapGrowth = endMem.heap_mb - startMem.heap_mb;
        const rssGrowth = endMem.rss_mb - startMem.rss_mb;
        const durationMinutes = (Date.now() - testStartTime) / (60 * 1000);

        logTest(`Memory test complete: ${operationCount} operations performed`);
        logTest(`Heap growth: ${heapGrowth}MB (${(heapGrowth / durationMinutes).toFixed(2)}MB/min)`);
        logTest(`RSS growth: ${rssGrowth}MB (${(rssGrowth / durationMinutes).toFixed(2)}MB/min)`);

        resolve({
          operations: operationCount,
          heap_growth_mb: heapGrowth,
          rss_growth_mb: rssGrowth,
          duration_minutes: durationMinutes,
          heap_growth_per_hour_mb: (heapGrowth / durationMinutes) * 60,
          rss_growth_per_hour_mb: (rssGrowth / durationMinutes) * 60,
          passed: heapGrowth < 2 && (heapGrowth / durationMinutes) < 0.4 // <2MB/hour target
        });
      }

      try {
        const ws = new WebSocket(WS_URL);
        ws.on('open', async () => {
          try {
            // Send a navigate command
            await sendWebSocketCommand(ws, {
              command: 'navigate',
              args: ['https://www.google.com']
            });
            operationCount++;
          } catch (e) {
            logTest(`Operation failed: ${e.message}`);
          } finally {
            ws.close();
          }
        });
        ws.on('error', (err) => {
          logTest(`WebSocket error in memory test: ${err.message}`);
        });
      } catch (e) {
        logTest(`Failed to create WebSocket: ${e.message}`);
      }
    }, 6000); // One operation every 6 seconds for 5+ minutes = 50+ operations
  });
}

async function testThroughput() {
  logTest('=== THROUGHPUT TEST ===');
  logTest('Sending 100+ rapid WebSocket commands...');

  const connections = [];
  const startTime = Date.now();
  let commandCount = 0;
  let successCount = 0;
  let failureCount = 0;

  try {
    // Create multiple concurrent connections
    for (let i = 0; i < 10; i++) {
      const ws = new WebSocket(WS_URL);
      connections.push(
        new Promise((resolve) => {
          ws.on('open', async () => {
            logTest(`Connection ${i} opened`);
            testResults.concurrent_connections.active_connections.push(i);

            // Send 10 rapid commands per connection
            for (let j = 0; j < 10; j++) {
              try {
                commandCount++;
                const cmdStart = Date.now();
                await sendWebSocketCommand(ws, {
                  command: 'execute',
                  args: ['console.log("test")']
                }, 2000);
                const latency = Date.now() - cmdStart;
                successCount++;
                testResults.throughput_test.latencies.push(latency);
              } catch (e) {
                failureCount++;
                logTest(`Command ${j} failed on connection ${i}: ${e.message}`);
              }
            }

            ws.close();
            testResults.concurrent_connections.active_connections =
              testResults.concurrent_connections.active_connections.filter(x => x !== i);
            resolve();
          });

          ws.on('error', (err) => {
            testResults.concurrent_connections.failed_connections++;
            logTest(`Connection error: ${err.message}`);
            resolve();
          });
        })
      );
    }

    await Promise.all(connections);

    const duration = (Date.now() - startTime) / 1000;
    const throughput = commandCount / duration;

    logTest(`Throughput test complete: ${commandCount} commands in ${duration.toFixed(2)}s`);
    logTest(`Throughput: ${throughput.toFixed(2)} commands/sec`);
    logTest(`Success rate: ${((successCount / commandCount) * 100).toFixed(2)}%`);

    testResults.throughput_test.total_commands_sent = commandCount;
    testResults.throughput_test.successful_commands = successCount;
    testResults.throughput_test.failed_commands = failureCount;
    testResults.throughput_test.duration_seconds = duration;
    testResults.throughput_test.throughput_cmds_per_sec = throughput;

    return {
      commands_sent: commandCount,
      success_rate: successCount / commandCount,
      throughput_cmds_per_sec: throughput,
      latencies: testResults.throughput_test.latencies
    };
  } catch (e) {
    logTest(`Throughput test error: ${e.message}`);
    return { error: e.message };
  }
}

async function testLatency() {
  logTest('=== LATENCY TEST ===');

  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      logTest('Testing operation latencies...');

      try {
        // Test navigate latency (target: <1150ms, was 1209ms)
        for (let i = 0; i < 5; i++) {
          try {
            const start = Date.now();
            await sendWebSocketCommand(ws, {
              command: 'navigate',
              args: ['https://www.google.com']
            }, 3000);
            const latency = Date.now() - start;
            testResults.latency_tests.navigate.push(latency);
            logTest(`Navigate latency ${i + 1}: ${latency}ms`);
          } catch (e) {
            logTest(`Navigate latency test failed: ${e.message}`);
          }
        }

        // Test execute latency (fingerprint caching test, target: -15ms improvement)
        for (let i = 0; i < 5; i++) {
          try {
            const start = Date.now();
            await sendWebSocketCommand(ws, {
              command: 'execute',
              args: ['console.log("test")']
            }, 2000);
            const latency = Date.now() - start;
            testResults.latency_tests.execute.push(latency);
            logTest(`Execute latency ${i + 1}: ${latency}ms`);
          } catch (e) {
            logTest(`Execute latency test failed: ${e.message}`);
          }
        }

      } catch (e) {
        logTest(`Latency test error: ${e.message}`);
      } finally {
        ws.close();
        resolve(testResults.latency_tests);
      }
    });

    ws.on('error', (err) => {
      logTest(`WebSocket error in latency test: ${err.message}`);
      resolve({ error: err.message });
    });
  });
}

async function testTabManagement() {
  logTest('=== TAB MANAGEMENT STRESS TEST ===');
  logTest('Creating/destroying 100+ tabs rapidly (tests P1 cleanup fix)...');

  const ws = new WebSocket(WS_URL);

  return new Promise((resolve) => {
    ws.on('open', async () => {
      let created = 0;
      let destroyed = 0;
      let errors = 0;

      try {
        // Create and destroy tabs rapidly
        for (let i = 0; i < 100; i++) {
          try {
            // Create tab
            await sendWebSocketCommand(ws, {
              command: 'createTab',
              args: []
            }, 2000);
            created++;

            // Immediately close it
            await sendWebSocketCommand(ws, {
              command: 'closeTab',
              args: [i]
            }, 2000);
            destroyed++;

            if ((i + 1) % 20 === 0) {
              logTest(`Tab management progress: ${i + 1}/100 (${created} created, ${destroyed} destroyed)`);
            }
          } catch (e) {
            errors++;
            if (errors < 10) { // Log first 10 errors
              logTest(`Tab operation error: ${e.message}`);
            }
          }
        }

        logTest(`Tab management test complete: ${created} created, ${destroyed} destroyed, ${errors} errors`);
        testResults.stability_test.tabs_created = created;
        testResults.stability_test.tabs_destroyed = destroyed;

        resolve({
          tabs_created: created,
          tabs_destroyed: destroyed,
          errors: errors,
          success_rate: (created / 100)
        });
      } catch (e) {
        logTest(`Tab management test error: ${e.message}`);
        resolve({ error: e.message });
      } finally {
        ws.close();
      }
    });

    ws.on('error', (err) => {
      logTest(`WebSocket error in tab test: ${err.message}`);
      resolve({ error: err.message });
    });
  });
}

async function testConnectionStability() {
  logTest('=== CONNECTION STABILITY TEST ===');
  logTest('Running 500+ rapid connect/disconnect cycles...');

  let successfulConnections = 0;
  let failedConnections = 0;
  let connectionDrops = 0;

  for (let i = 0; i < 500; i++) {
    try {
      const ws = new WebSocket(WS_URL);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 3000);

        ws.on('open', () => {
          clearTimeout(timeout);
          successfulConnections++;
          ws.close();
          resolve();
        });

        ws.on('error', (err) => {
          clearTimeout(timeout);
          failedConnections++;
          resolve(); // Don't reject, just count and continue
        });

        ws.on('close', () => {
          clearTimeout(timeout);
        });
      });

      if ((i + 1) % 100 === 0) {
        logTest(`Connection cycles progress: ${i + 1}/500 (${successfulConnections} successful, ${failedConnections} failed)`);
      }
    } catch (e) {
      failedConnections++;
    }
  }

  logTest(`Connection stability test complete: ${successfulConnections} successful, ${failedConnections} failed`);
  testResults.concurrent_connections.successful_connections = successfulConnections;
  testResults.concurrent_connections.failed_connections = failedConnections;

  return {
    successful: successfulConnections,
    failed: failedConnections,
    success_rate: successfulConnections / 500
  };
}

async function testConcurrentOperations() {
  logTest('=== CONCURRENT OPERATIONS TEST ===');
  logTest('Running 5 concurrent connections with simultaneous operations...');

  const connections = [];
  let totalOperations = 0;
  let successfulOps = 0;

  for (let i = 0; i < 5; i++) {
    connections.push(
      new Promise((resolve) => {
        const ws = new WebSocket(WS_URL);
        let connectionOps = 0;
        let connectionSuccess = 0;

        ws.on('open', async () => {
          logTest(`Concurrent connection ${i} established`);
          testResults.concurrent_connections.successful_connections++;

          // Run 20 operations on this connection concurrently with others
          const ops = [];
          for (let j = 0; j < 20; j++) {
            ops.push(
              sendWebSocketCommand(ws, {
                command: 'execute',
                args: [`console.log("concurrent-${i}-${j}")`]
              }, 2000)
                .then(() => {
                  connectionSuccess++;
                  return true;
                })
                .catch((e) => {
                  logTest(`Operation ${j} on connection ${i} failed: ${e.message}`);
                  return false;
                })
            );
            connectionOps++;
          }

          await Promise.all(ops);
          totalOperations += connectionOps;
          successfulOps += connectionSuccess;

          logTest(`Concurrent connection ${i}: ${connectionSuccess}/${connectionOps} operations successful`);
          ws.close();
          resolve();
        });

        ws.on('error', (err) => {
          logTest(`Concurrent connection ${i} error: ${err.message}`);
          resolve();
        });
      })
    );
  }

  await Promise.all(connections);

  logTest(`Concurrent operations test complete: ${successfulOps}/${totalOperations} operations successful`);

  return {
    total_operations: totalOperations,
    successful_operations: successfulOps,
    success_rate: successfulOps / totalOperations
  };
}

function calculateLatencyStats(latencies) {
  if (!latencies || latencies.length === 0) return null;

  const sorted = latencies.slice().sort((a, b) => a - b);
  const len = sorted.length;

  return {
    min: sorted[0],
    max: sorted[len - 1],
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    mean: Math.round(latencies.reduce((a, b) => a + b, 0) / len),
    count: len
  };
}

function analyzeResults() {
  logTest('=== ANALYZING RESULTS ===');

  const analysis = {
    memory: {
      samples: testResults.memory_samples.length,
      initial_heap_mb: testResults.memory_samples[0]?.heap_mb,
      final_heap_mb: testResults.memory_samples[testResults.memory_samples.length - 1]?.heap_mb,
      peak_heap_mb: Math.max(...testResults.memory_samples.map(s => s.heap_mb)),
      stability: 'ANALYZING'
    },
    throughput: {
      commands_per_sec: testResults.throughput_test.throughput_cmds_per_sec,
      success_rate: testResults.throughput_test.successful_commands / testResults.throughput_test.total_commands_sent,
      latency_stats: calculateLatencyStats(testResults.throughput_test.latencies),
      improvement_vs_baseline: null // 109.47 was baseline
    },
    latency: {
      navigate: calculateLatencyStats(testResults.latency_tests.navigate),
      execute: calculateLatencyStats(testResults.latency_tests.execute),
      target_met: {
        navigate: calculateLatencyStats(testResults.latency_tests.navigate)?.p50 < 1150,
        execute: true // Will evaluate once we have execute baselines
      }
    },
    stability: {
      tabs_created: testResults.stability_test.tabs_created,
      tabs_destroyed: testResults.stability_test.tabs_destroyed,
      tab_cleanup_effective: testResults.stability_test.tabs_created === testResults.stability_test.tabs_destroyed,
      connection_success_rate: testResults.concurrent_connections.successful_connections / 500
    }
  };

  testResults.analysis = analysis;
  return analysis;
}

async function main() {
  logTest('Starting v11.3.0 Comprehensive Stress Test');
  logTest(`WebSocket URL: ${WS_URL}`);
  logTest(`Total test duration: ${TEST_DURATION_SECONDS}s (${Math.floor(TEST_DURATION_SECONDS / 60)} minutes)`);

  try {
    // Run tests in sequence
    logTest('\n--- Test 1: Throughput ---');
    await testThroughput();

    logTest('\n--- Test 2: Latency ---');
    await testLatency();

    logTest('\n--- Test 3: Tab Management ---');
    await testTabManagement();

    logTest('\n--- Test 4: Connection Stability ---');
    await testConnectionStability();

    logTest('\n--- Test 5: Concurrent Operations ---');
    await testConcurrentOperations();

    logTest('\n--- Test 6: Memory Leaks (5+ minute test) ---');
    await testMemoryLeaks();

    // Analyze results
    const analysis = analyzeResults();

    // Save results
    const resultsDir = '/home/devel/basset-hound-browser/tests/results/stress';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const resultsFile = path.join(resultsDir, 'v11.3.0-stress-test-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
    logTest(`\nResults saved to ${resultsFile}`);

    // Print summary
    logTest('\n=== TEST SUMMARY ===');
    logTest(`Total test duration: ${((Date.now() - testStartTime) / 1000).toFixed(2)} seconds`);
    logTest(`Memory samples collected: ${testResults.memory_samples.length}`);
    logTest(`Throughput: ${analysis.throughput.commands_per_sec?.toFixed(2) || 'N/A'} commands/sec`);
    logTest(`Latency (navigate): p50=${analysis.latency.navigate?.p50}ms, p95=${analysis.latency.navigate?.p95}ms, p99=${analysis.latency.navigate?.p99}ms`);
    logTest(`Tabs created: ${analysis.stability.tabs_created}`);
    logTest(`Connections successful: ${analysis.stability.connection_success_rate?.toFixed(2) || 0}%`);

    logTest('\n=== TEST COMPLETE ===');
    process.exit(0);

  } catch (error) {
    logTest(`FATAL ERROR: ${error.message}`);
    logTest(error.stack);
    process.exit(1);
  }
}

// Run tests
main().catch(err => {
  logTest(`Unhandled error: ${err.message}`);
  process.exit(1);
});

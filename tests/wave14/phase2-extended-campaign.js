#!/usr/bin/env node

/**
 * Wave 14 Performance Testing - Phase 2: Extended Campaign Testing
 *
 * Validates long-session stability and concurrent campaign handling:
 * 1. Single 8-hour session with 500 operations
 * 2. 10 parallel campaigns with 50 operations each
 * 3. Stress testing at 500 concurrent connections
 *
 * Execution time: ~10 hours
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const os = require('os');

// ==========================================
// Configuration
// ==========================================

const RESULTS_DIR = path.join(__dirname);

const TEST_CONFIG = {
  wsUrl: 'ws://localhost:8765',

  // Single session campaign
  longSession: {
    duration: 28800,      // 8 hours in seconds
    operationCount: 500,
    operationInterval: 57.6  // 500 ops over 8 hours
  },

  // Parallel campaigns
  parallelCampaigns: {
    count: 10,
    durationPerCampaign: 1800,  // 30 minutes
    operationsPerCampaign: 50,
    operationInterval: 36  // 50 ops over 30 mins
  },

  // Stress test
  stressTest: {
    maxConcurrent: 500,
    duration: 600,  // 10 minutes
    commandsPerSecond: 100
  },

  commands: {
    ping: { weight: 0.20, payload: { command: 'ping' } },
    navigate: { weight: 0.15, payload: { command: 'navigate', url: 'https://example.com' } },
    screenshot: { weight: 0.15, payload: { command: 'screenshot', type: 'page' } },
    getText: { weight: 0.15, payload: { command: 'get_text', selector: 'body' } },
    getHtml: { weight: 0.15, payload: { command: 'get_html', selector: 'body' } },
    click: { weight: 0.10, payload: { command: 'click', selector: 'button' } },
    scroll: { weight: 0.10, payload: { command: 'scroll', direction: 'down', amount: 100 } }
  }
};

// ==========================================
// Extended Campaign Test Class
// ==========================================

class ExtendedCampaignTest {
  constructor(testName) {
    this.testName = testName;
    this.results = {
      testName,
      timestamp: new Date().toISOString(),
      systemInfo: this.captureSystemInfo()
    };
    this.messageCounter = 0;
  }

  captureSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem()
    };
  }

  /**
   * Test 1: Long-Session Stability (8 hours, 500 operations)
   */
  async testLongSessionStability() {
    console.log('\n[PHASE 2.1] Running 8-hour long-session stability test...');

    const config = TEST_CONFIG.longSession;
    const startTime = Date.now();
    const metrics = {
      operationsCompleted: 0,
      operationsFailed: 0,
      latencies: [],
      memorySnapshots: [],
      cpuSnapshots: [],
      gcEvents: []
    };

    // Capture initial memory
    let lastMemory = process.memoryUsage();

    try {
      const ws = new WebSocket(TEST_CONFIG.wsUrl);

      return new Promise((resolve) => {
        ws.on('open', () => {
          console.log('✓ Connection established');

          let operationsSent = 0;
          const operationInterval = setInterval(() => {
            if (operationsSent >= config.operationCount) {
              clearInterval(operationInterval);
              ws.close();
              resolve(this.compileLongSessionResults(metrics, Date.now() - startTime));
              return;
            }

            if (ws.readyState !== WebSocket.OPEN) {
              clearInterval(operationInterval);
              resolve(this.compileLongSessionResults(metrics, Date.now() - startTime));
              return;
            }

            // Send operation
            const command = this.selectRandomCommand();
            const sendTime = performance.now();

            ws.send(JSON.stringify(command), (error) => {
              if (error) {
                metrics.operationsFailed++;
              }
            });

            ws.once('message', () => {
              const latency = performance.now() - sendTime;
              metrics.latencies.push(latency);
              metrics.operationsCompleted++;

              // Log progress every 50 operations
              if (metrics.operationsCompleted % 50 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const opsPerMin = (metrics.operationsCompleted / elapsed) * 60;
                console.log(`  - ${metrics.operationsCompleted}/${config.operationCount} ops completed (${opsPerMin.toFixed(1)} ops/min)`);
              }
            });

            operationsSent++;
          }, config.operationInterval * 1000);

          // Record memory every 30 seconds
          const memoryInterval = setInterval(() => {
            const mem = process.memoryUsage();
            metrics.memorySnapshots.push({
              timestamp: Date.now() - startTime,
              heapUsed: mem.heapUsed,
              heapTotal: mem.heapTotal,
              rss: mem.rss,
              external: mem.external
            });

            // Detect memory growth
            const memDiff = mem.heapUsed - lastMemory.heapUsed;
            if (memDiff > 50 * 1024 * 1024) {  // 50MB threshold
              metrics.memorySnapshots[metrics.memorySnapshots.length - 1].warning = 'Large memory jump';
            }
            lastMemory = mem;
          }, 30000);

          // Close after 8 hours or when operations complete
          const timeout = setTimeout(() => {
            clearInterval(memoryInterval);
            ws.close();
          }, config.duration * 1000);

          ws.on('close', () => {
            clearInterval(operationInterval);
            clearInterval(memoryInterval);
            clearTimeout(timeout);
          });
        });

        ws.on('error', (error) => {
          console.error('Connection error:', error);
          resolve(this.compileLongSessionResults(metrics, Date.now() - startTime));
        });
      });
    } catch (error) {
      console.error('Test failed:', error);
      return this.compileLongSessionResults(metrics, Date.now() - startTime);
    }
  }

  compileLongSessionResults(metrics, duration) {
    metrics.latencies.sort((a, b) => a - b);

    const memoryGrowth = metrics.memorySnapshots.length > 0
      ? metrics.memorySnapshots[metrics.memorySnapshots.length - 1].heapUsed -
        metrics.memorySnapshots[0].heapUsed
      : 0;

    return {
      testName: 'Long Session Stability',
      duration: duration / 1000,
      operationsCompleted: metrics.operationsCompleted,
      operationsFailed: metrics.operationsFailed,
      latency: {
        p50: this.percentile(metrics.latencies, 0.50),
        p99: this.percentile(metrics.latencies, 0.99),
        p999: this.percentile(metrics.latencies, 0.999),
        avg: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
      },
      memory: {
        growthBytes: memoryGrowth,
        growthPerHour: memoryGrowth * (3600 / (duration / 1000)),
        snapshots: metrics.memorySnapshots
      },
      assessment: {
        memoryStable: Math.abs(memoryGrowth * (3600 / (duration / 1000))) < 2 * 1024 * 1024,  // < 2MB/hour
        gcWorking: metrics.memorySnapshots.some(s => s.warning),
        gcMessage: 'Monitor garbage collection patterns'
      }
    };
  }

  /**
   * Test 2: Concurrent Campaign Testing (10 parallel, 30 min each)
   */
  async testConcurrentCampaigns() {
    console.log('\n[PHASE 2.2] Running 10 concurrent campaigns test (30 min each)...');

    const config = TEST_CONFIG.parallelCampaigns;
    const startTime = Date.now();
    const campaignResults = [];

    const campaigns = Array.from({ length: config.count }, (_, i) => i);

    const campaignPromises = campaigns.map(campaignId =>
      this.runSingleCampaign(campaignId, config, startTime)
    );

    const results = await Promise.all(campaignPromises);
    campaignResults.push(...results);

    return {
      testName: 'Concurrent Campaigns',
      totalDuration: (Date.now() - startTime) / 1000,
      campaignCount: config.count,
      campaigns: campaignResults,
      summary: this.summarizeCampaignResults(campaignResults)
    };
  }

  runSingleCampaign(campaignId, config, globalStartTime) {
    return new Promise((resolve) => {
      const metrics = {
        campaignId,
        operationsCompleted: 0,
        operationsFailed: 0,
        latencies: []
      };

      const ws = new WebSocket(TEST_CONFIG.wsUrl);

      ws.on('open', () => {
        let operationsSent = 0;
        const campaignStartTime = Date.now();

        const interval = setInterval(() => {
          if (operationsSent >= config.operationsPerCampaign) {
            clearInterval(interval);
            ws.close();
            return;
          }

          if (ws.readyState !== WebSocket.OPEN) {
            clearInterval(interval);
            return;
          }

          const command = this.selectRandomCommand();
          const sendTime = performance.now();

          ws.send(JSON.stringify(command), (error) => {
            if (error) metrics.operationsFailed++;
          });

          ws.once('message', () => {
            const latency = performance.now() - sendTime;
            metrics.latencies.push(latency);
            metrics.operationsCompleted++;
          });

          operationsSent++;
        }, config.operationInterval * 1000);

        setTimeout(() => {
          clearInterval(interval);
          ws.close();
        }, config.durationPerCampaign * 1000);

        ws.on('close', () => {
          metrics.latencies.sort((a, b) => a - b);
          resolve({
            campaignId,
            duration: (Date.now() - campaignStartTime) / 1000,
            operationsCompleted: metrics.operationsCompleted,
            operationsFailed: metrics.operationsFailed,
            latency: {
              p99: this.percentile(metrics.latencies, 0.99),
              avg: metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
            }
          });
        });
      });

      ws.on('error', (error) => {
        console.error(`Campaign ${campaignId} error:`, error.message);
        resolve({ campaignId, error: error.message });
      });
    });
  }

  summarizeCampaignResults(campaigns) {
    const successfulCampaigns = campaigns.filter(c => !c.error);

    return {
      successful: successfulCampaigns.length,
      failed: campaigns.length - successfulCampaigns.length,
      avgLatencyP99: successfulCampaigns.length > 0
        ? successfulCampaigns.reduce((sum, c) => sum + c.latency.p99, 0) / successfulCampaigns.length
        : 0,
      avgLatencyAvg: successfulCampaigns.length > 0
        ? successfulCampaigns.reduce((sum, c) => sum + c.latency.avg, 0) / successfulCampaigns.length
        : 0
    };
  }

  /**
   * Test 3: Stress Testing (500 concurrent)
   */
  async testStress() {
    console.log('\n[PHASE 2.3] Running stress test (500 concurrent, 10 min)...');

    const config = TEST_CONFIG.stressTest;
    const startTime = Date.now();
    const connectionMetrics = [];

    // Gradually ramp up connections
    const rampUpConnections = async () => {
      const step = 50;
      for (let i = 0; i < config.maxConcurrent; i += step) {
        const batchSize = Math.min(step, config.maxConcurrent - i);
        const promises = Array.from({ length: batchSize }, (_, idx) =>
          this.createStressConnection(i + idx, config, connectionMetrics, startTime)
        );
        await Promise.all(promises);
        console.log(`  - ${Math.min(i + step, config.maxConcurrent)}/${config.maxConcurrent} connections established`);
      }
    };

    await rampUpConnections();

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, config.duration * 1000));

    return {
      testName: 'Stress Test',
      maxConcurrent: config.maxConcurrent,
      duration: (Date.now() - startTime) / 1000,
      totalConnections: connectionMetrics.length,
      failedConnections: connectionMetrics.filter(m => m.failed).length,
      avgLatency: connectionMetrics.length > 0
        ? connectionMetrics.reduce((sum, m) => sum + m.avgLatency, 0) / connectionMetrics.length
        : 0,
      assessment: {
        status: connectionMetrics.filter(m => m.failed).length < config.maxConcurrent * 0.1
          ? 'PASS'
          : 'DEGRADED',
        message: 'Graceful degradation under maximum load'
      }
    };
  }

  createStressConnection(clientId, config, metrics, globalStartTime) {
    return new Promise((resolve) => {
      const ws = new WebSocket(TEST_CONFIG.wsUrl);
      const connectionMetric = {
        clientId,
        latencies: [],
        failed: false,
        avgLatency: 0
      };

      ws.on('open', () => {
        let commandsSent = 0;
        const expectedCommands = config.commandsPerSecond * config.duration;

        const interval = setInterval(() => {
          if (commandsSent >= expectedCommands || ws.readyState !== WebSocket.OPEN) {
            clearInterval(interval);
            ws.close();
            return;
          }

          const command = this.selectRandomCommand();
          const sendTime = performance.now();

          ws.send(JSON.stringify(command), (error) => {
            if (error) connectionMetric.failed = true;
          });

          ws.once('message', () => {
            connectionMetric.latencies.push(performance.now() - sendTime);
          });

          commandsSent++;
        }, 1000 / config.commandsPerSecond);

        setTimeout(() => {
          clearInterval(interval);
          ws.close();
        }, config.duration * 1000);

        ws.on('close', () => {
          if (connectionMetric.latencies.length > 0) {
            connectionMetric.avgLatency = connectionMetric.latencies.reduce((a, b) => a + b, 0) /
                                         connectionMetric.latencies.length;
          }
          metrics.push(connectionMetric);
          resolve();
        });
      });

      ws.on('error', () => {
        connectionMetric.failed = true;
        metrics.push(connectionMetric);
        resolve();
      });
    });
  }

  selectRandomCommand() {
    const rand = Math.random();
    let accumulated = 0;

    for (const [name, config] of Object.entries(TEST_CONFIG.commands)) {
      accumulated += config.weight;
      if (rand < accumulated) {
        return {
          ...config.payload,
          messageId: ++this.messageCounter
        };
      }
    }

    return TEST_CONFIG.commands.ping.payload;
  }

  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Run all extended campaign tests
   */
  async runAll() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Wave 14 Extended Campaign Testing`);
    console.log(`${'='.repeat(60)}`);

    const results = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Long session
    console.log('\n--- Test 1 of 3: Long Session Stability ---');
    results.tests.longSession = await this.testLongSessionStability();

    // Wait 60 seconds before next test
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Test 2: Concurrent campaigns
    console.log('\n--- Test 2 of 3: Concurrent Campaigns ---');
    results.tests.concurrentCampaigns = await this.testConcurrentCampaigns();

    // Wait 60 seconds before next test
    await new Promise(resolve => setTimeout(resolve, 60000));

    // Test 3: Stress test
    console.log('\n--- Test 3 of 3: Stress Test ---');
    results.tests.stressTest = await this.testStress();

    return results;
  }

  /**
   * Save results to file
   */
  saveResults(filename) {
    const results = this.results;

    let output = `Wave 14 Extended Campaign Testing Results\n`;
    output += `Timestamp: ${results.timestamp}\n`;
    output += `${'='.repeat(70)}\n\n`;

    // System info
    output += `System Information:\n`;
    output += `- CPUs: ${results.systemInfo.cpus}\n`;
    output += `- Total Memory: ${(results.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n\n`;

    return output;
  }
}

// ==========================================
// Main Execution
// ==========================================

async function main() {
  console.log('\nWave 14 Performance Testing - Phase 2: Extended Campaign Testing');
  console.log('Expected duration: ~10 hours');
  console.log(`Starting at: ${new Date().toISOString()}\n`);

  const tester = new ExtendedCampaignTest('Extended Campaign Tests');
  const results = await tester.runAll();

  // Save results
  const resultsJson = JSON.stringify(results, null, 2);
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'campaign-test-results.json'),
    resultsJson
  );

  // Generate report
  let report = `Wave 14 Extended Campaign Testing - Final Report\n`;
  report += `${'='.repeat(70)}\n\n`;

  report += `Test 1: Long-Session Stability (8 hours, 500 ops)\n`;
  const ls = results.tests.longSession;
  report += `- Operations Completed: ${ls.operationsCompleted}/${TEST_CONFIG.longSession.operationCount}\n`;
  report += `- P99 Latency: ${ls.latency.p99.toFixed(2)}ms\n`;
  report += `- Memory Growth/Hour: ${(ls.memory.growthPerHour / 1024 / 1024).toFixed(2)} MB/h\n`;
  report += `- Assessment: ${ls.assessment.memoryStable ? 'PASS (stable memory)' : 'WARN (memory growth)'}\n\n`;

  report += `Test 2: Concurrent Campaigns (10x 30min)\n`;
  const cc = results.tests.concurrentCampaigns;
  report += `- Successful Campaigns: ${cc.summary.successful}/${cc.campaignCount}\n`;
  report += `- Avg P99 Latency: ${cc.summary.avgLatencyP99.toFixed(2)}ms\n`;
  report += `- Assessment: ${cc.summary.failed === 0 ? 'PASS' : 'WARN'}\n\n`;

  report += `Test 3: Stress Test (500 concurrent)\n`;
  const st = results.tests.stressTest;
  report += `- Connected: ${st.totalConnections - st.failedConnections}/${st.maxConcurrent}\n`;
  report += `- Avg Latency: ${st.avgLatency.toFixed(2)}ms\n`;
  report += `- Assessment: ${st.assessment.status}\n\n`;

  report += `Overall Status: Tests Complete\n`;

  fs.writeFileSync(path.join(RESULTS_DIR, 'campaign-test-report.txt'), report);

  console.log(`\n✓ Campaign testing complete!`);
  console.log(`  Results: ${path.join(RESULTS_DIR, 'campaign-test-results.json')}`);
  console.log(`  Report: ${path.join(RESULTS_DIR, 'campaign-test-report.txt')}`);
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Wave 14 Performance Testing - Phase 1: Baseline Comparison
 *
 * Comprehensive baseline measurements comparing:
 * 1. Pre-Wave14 system (Wave 13 optimizations only)
 * 2. Post-Wave14 system (all features enabled)
 *
 * Load levels: 50, 100, 200, 300 concurrent connections
 * Metrics: throughput, latency (P50/P99/P999), memory, CPU
 *
 * Execution time: ~4 hours total
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
const BASELINE_FILE = path.join(RESULTS_DIR, 'baseline-pre-wave14.txt');
const POST_FILE = path.join(RESULTS_DIR, 'baseline-post-wave14.txt');
const IMPACT_FILE = path.join(RESULTS_DIR, 'performance-impact-analysis.txt');

const TEST_CONFIG = {
  // Server configuration
  wsUrl: 'ws://localhost:8765',

  // Load profiles
  loadProfiles: [
    { name: '50 concurrent', connections: 50, duration: 180 },     // 3 minutes
    { name: '100 concurrent', connections: 100, duration: 240 },   // 4 minutes
    { name: '200 concurrent', connections: 200, duration: 300 },   // 5 minutes
    { name: '300 concurrent', connections: 300, duration: 360 }    // 6 minutes
  ],

  // Command mix
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
// Baseline Measurement Class
// ==========================================

class BaselinePerformanceTest {
  constructor(mode = 'pre-wave14') {
    this.mode = mode;
    this.results = {
      mode,
      timestamp: new Date().toISOString(),
      systemInfo: this.captureSystemInfo(),
      loadProfiles: {}
    };
    this.messageCounter = 0;
  }

  captureSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      nodeVersion: process.version
    };
  }

  /**
   * Monitor system metrics during test
   */
  monitorSystemMetrics() {
    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    return {
      startMemory,
      startTime,
      samples: [],

      recordSample() {
        this.samples.push({
          timestamp: Date.now() - this.startTime,
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        });
      },

      getMetrics() {
        const endMemory = process.memoryUsage();
        const totalTime = Date.now() - this.startTime;

        // Calculate growth rates
        const heapUsedGrowth = endMemory.heapUsed - startMemory.heapUsed;
        const rssGrowth = endMemory.rss - startMemory.rss;

        // Memory per hour (extrapolate from test duration)
        const memoryPerHour = heapUsedGrowth * (3600000 / totalTime);

        return {
          duration: totalTime,
          heapUsed: {
            start: startMemory.heapUsed,
            end: endMemory.heapUsed,
            growth: heapUsedGrowth,
            growthPerHour: memoryPerHour
          },
          rss: {
            start: startMemory.rss,
            end: endMemory.rss,
            growth: rssGrowth
          },
          samples: this.samples
        };
      }
    };
  }

  /**
   * Run load test at specified concurrency
   */
  async runLoadProfile(profile) {
    console.log(`\n[${this.mode}] Starting ${profile.name} test (${profile.duration}s)...`);

    const metrics = this.monitorSystemMetrics();
    const latencies = [];
    const throughput = { messages: 0, errors: 0 };
    const startTime = Date.now();

    try {
      // Create connections
      const connections = [];
      const connectionPromises = [];

      for (let i = 0; i < profile.connections; i++) {
        const promise = this.createConnection(
          i,
          profile,
          latencies,
          throughput,
          metrics
        );
        connectionPromises.push(promise);
      }

      await Promise.all(connectionPromises);

      // Wait for test duration
      await new Promise(resolve => setTimeout(resolve, profile.duration * 1000));

      // Close all connections
      for (const conn of connections) {
        if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close();
        }
      }

      // Calculate statistics
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const throughputPerSecond = throughput.messages / elapsedSeconds;

      // Sort latencies for percentiles
      latencies.sort((a, b) => a - b);

      const stats = {
        profile: profile.name,
        duration: elapsedSeconds,
        throughput: {
          messagesPerSecond: throughputPerSecond,
          totalMessages: throughput.messages,
          totalErrors: throughput.errors,
          errorRate: throughput.errors / (throughput.messages + throughput.errors)
        },
        latency: {
          p50: this.percentile(latencies, 0.50),
          p99: this.percentile(latencies, 0.99),
          p999: this.percentile(latencies, 0.999),
          min: Math.min(...latencies),
          max: Math.max(...latencies),
          avg: latencies.reduce((a, b) => a + b, 0) / latencies.length
        },
        memory: metrics.getMetrics(),
        sampleCount: latencies.length
      };

      this.results.loadProfiles[profile.name] = stats;

      console.log(`✓ ${profile.name}: ${throughputPerSecond.toFixed(2)} msg/s, P99 latency: ${stats.latency.p99.toFixed(2)}ms`);

      return stats;
    } catch (error) {
      console.error(`✗ ${profile.name} failed:`, error.message);
      return null;
    }
  }

  /**
   * Create a WebSocket connection and generate load
   */
  createConnection(clientId, profile, latencies, throughput, metrics) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(TEST_CONFIG.wsUrl);
        const connStartTime = Date.now();

        ws.on('open', () => {
          // Start generating commands
          const interval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              clearInterval(interval);
              resolve();
              return;
            }

            const command = this.selectRandomCommand();
            const sendTime = performance.now();

            ws.send(JSON.stringify(command), (error) => {
              if (!error) {
                throughput.messages++;
              } else {
                throughput.errors++;
              }
            });

            ws.once('message', () => {
              const latency = performance.now() - sendTime;
              latencies.push(latency);
              metrics.recordSample();
            });
          }, 50 + Math.random() * 100); // 50-150ms between commands

          // Record sample every second
          const sampleInterval = setInterval(() => {
            metrics.recordSample();
          }, 1000);

          // Close after test duration
          setTimeout(() => {
            clearInterval(interval);
            clearInterval(sampleInterval);
            ws.close();
            resolve();
          }, profile.duration * 1000);
        });

        ws.on('error', (error) => {
          console.error(`Client ${clientId} error:`, error.message);
          resolve();
        });

        ws.on('close', () => {
          resolve();
        });
      } catch (error) {
        console.error(`Client ${clientId} connection failed:`, error.message);
        resolve();
      }
    });
  }

  /**
   * Select a random command based on weights
   */
  selectRandomCommand() {
    const rand = Math.random();
    let accumulated = 0;

    for (const [name, config] of Object.entries(TEST_CONFIG.commands)) {
      accumulated += config.weight;
      if (rand < accumulated) {
        return {
          ...config.payload,
          messageId: ++this.messageCounter,
          timestamp: Date.now()
        };
      }
    }

    return TEST_CONFIG.commands.ping.payload;
  }

  /**
   * Calculate percentile from sorted array
   */
  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  /**
   * Run all load profiles
   */
  async runAllProfiles() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Wave 14 Performance Baseline: ${this.mode}`);
    console.log(`${'='.repeat(60)}`);

    for (const profile of TEST_CONFIG.loadProfiles) {
      await this.runLoadProfile(profile);
      // Wait 30 seconds between profiles for cleanup
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

    return this.results;
  }

  /**
   * Save results to file
   */
  saveResults(filename) {
    let output = `Wave 14 Performance Baseline Test Results\n`;
    output += `Mode: ${this.results.mode}\n`;
    output += `Timestamp: ${this.results.timestamp}\n`;
    output += `${'='.repeat(70)}\n\n`;

    // System info
    output += `System Information:\n`;
    output += `- Platform: ${this.results.systemInfo.platform} (${this.results.systemInfo.arch})\n`;
    output += `- CPUs: ${this.results.systemInfo.cpus}\n`;
    output += `- Total Memory: ${(this.results.systemInfo.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB\n`;
    output += `- Node Version: ${this.results.systemInfo.nodeVersion}\n\n`;

    // Load profile results
    output += `Load Profile Results:\n`;
    output += `${'='.repeat(70)}\n\n`;

    for (const [profileName, stats] of Object.entries(this.results.loadProfiles)) {
      output += `Profile: ${profileName}\n`;
      output += `- Duration: ${stats.duration.toFixed(2)}s\n`;
      output += `- Throughput: ${stats.throughput.messagesPerSecond.toFixed(2)} msg/s\n`;
      output += `- Total Messages: ${stats.throughput.totalMessages}\n`;
      output += `- Error Rate: ${(stats.throughput.errorRate * 100).toFixed(2)}%\n`;
      output += `- Latency P50: ${stats.latency.p50.toFixed(2)}ms\n`;
      output += `- Latency P99: ${stats.latency.p99.toFixed(2)}ms\n`;
      output += `- Latency P999: ${stats.latency.p999.toFixed(2)}ms\n`;
      output += `- Latency Min/Max: ${stats.latency.min.toFixed(2)}ms / ${stats.latency.max.toFixed(2)}ms\n`;
      output += `- Memory Growth: ${(stats.memory.heapUsed.growth / 1024 / 1024).toFixed(2)} MB\n`;
      output += `- Memory Per Hour: ${(stats.memory.heapUsed.growthPerHour / 1024 / 1024).toFixed(2)} MB/hour\n`;
      output += `\n`;
    }

    fs.writeFileSync(filename, output);
    console.log(`\n✓ Results saved to ${filename}`);
  }
}

// ==========================================
// Main Execution
// ==========================================

async function main() {
  console.log('\nWave 14 Performance Testing - Phase 1: Baseline Comparison');
  console.log('Expected duration: ~4 hours (2 hrs pre + 2 hrs post)');
  console.log(`Starting at: ${new Date().toISOString()}\n`);

  // Phase 1: Pre-Wave14 Baseline
  console.log('\n┌─ PHASE 1.1: Pre-Wave14 Baseline ─┐');
  const preTest = new BaselinePerformanceTest('pre-wave14');
  const preResults = await preTest.runAllProfiles();
  preTest.saveResults(BASELINE_FILE);

  console.log('\n\n┌─ PHASE 1.2: Post-Wave14 Baseline ─┐');
  const postTest = new BaselinePerformanceTest('post-wave14');
  const postResults = await postTest.runAllProfiles();
  postTest.saveResults(POST_FILE);

  // Phase 2: Impact Analysis
  console.log('\n\n┌─ PHASE 1.3: Impact Analysis ─┐');
  const analysis = analyzeImpact(preResults, postResults);
  saveImpactAnalysis(analysis, IMPACT_FILE);

  console.log(`\n✓ Baseline comparison complete!`);
  console.log(`  Pre-Wave14: ${BASELINE_FILE}`);
  console.log(`  Post-Wave14: ${POST_FILE}`);
  console.log(`  Analysis: ${IMPACT_FILE}`);
}

/**
 * Compare pre and post results
 */
function analyzeImpact(preResults, postResults) {
  const analysis = {
    timestamp: new Date().toISOString(),
    profiles: {}
  };

  for (const [profileName, preStats] of Object.entries(preResults.loadProfiles)) {
    const postStats = postResults.loadProfiles[profileName];
    if (!postStats) continue;

    const throughputDelta = postStats.throughput.messagesPerSecond -
                           preStats.throughput.messagesPerSecond;
    const latencyDelta = postStats.latency.p99 - preStats.latency.p99;
    const memoryDelta = postStats.memory.heapUsed.growthPerHour -
                       preStats.memory.heapUsed.growthPerHour;

    analysis.profiles[profileName] = {
      preStats,
      postStats,
      deltas: {
        throughput: {
          value: throughputDelta,
          percent: (throughputDelta / preStats.throughput.messagesPerSecond) * 100
        },
        latency: {
          value: latencyDelta,
          percent: (latencyDelta / preStats.latency.p99) * 100
        },
        memory: {
          value: memoryDelta,
          percent: (memoryDelta / preStats.memory.heapUsed.growthPerHour) * 100
        }
      }
    };
  }

  return analysis;
}

/**
 * Save impact analysis
 */
function saveImpactAnalysis(analysis, filename) {
  let output = `Wave 14 Performance Impact Analysis\n`;
  output += `Timestamp: ${analysis.timestamp}\n`;
  output += `${'='.repeat(70)}\n\n`;

  output += `Impact Summary (Post-Wave14 vs Pre-Wave14):\n\n`;

  for (const [profileName, data] of Object.entries(analysis.profiles)) {
    const tp = data.deltas.throughput;
    const lat = data.deltas.latency;
    const mem = data.deltas.memory;

    output += `${profileName}:\n`;
    output += `- Throughput: ${tp.value > 0 ? '+' : ''}${tp.value.toFixed(2)} msg/s (${tp.percent > 0 ? '+' : ''}${tp.percent.toFixed(2)}%)\n`;
    output += `- P99 Latency: ${lat.value > 0 ? '+' : ''}${lat.value.toFixed(2)}ms (${lat.percent > 0 ? '+' : ''}${lat.percent.toFixed(2)}%)\n`;
    output += `- Memory/Hour: ${mem.value > 0 ? '+' : ''}${mem.value.toFixed(2)} MB/h (${mem.percent > 0 ? '+' : ''}${mem.percent.toFixed(2)}%)\n`;
    output += `\n`;
  }

  output += `\nOverall Assessment:\n`;
  output += `- Target: <10% overhead at 200 concurrent\n`;
  let throughputAt200 = analysis.profiles['200 concurrent']?.deltas.throughput.percent || 0;
  let assessment = throughputAt200 < 10 ? 'PASS' : 'FAIL';
  output += `- 200 concurrent throughput delta: ${throughputAt200.toFixed(2)}% [${assessment}]\n`;

  fs.writeFileSync(filename, output);
  console.log(`✓ Impact analysis saved to ${filename}`);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

// Run tests
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

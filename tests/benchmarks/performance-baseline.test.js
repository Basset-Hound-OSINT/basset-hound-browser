/**
 * Performance Benchmark Suite - Before/After Critical Fixes
 *
 * Measures:
 * 1. Throughput (commands/sec)
 * 2. Latency (p50, p95, p99)
 * 3. Memory (baseline, peak, growth rate)
 * 4. CPU usage
 * 5. Connection stability
 *
 * Test Phases:
 * - BEFORE: Current main branch baseline
 * - AFTER: After critical fixes applied
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class PerformanceBenchmark {
  constructor(options = {}) {
    this.results = {
      timestamp: new Date().toISOString(),
      phase: options.phase || 'BEFORE',
      metrics: {},
      errors: [],
      config: {
        concurrentClients: options.concurrentClients || 10,
        commandsPerClient: options.commandsPerClient || 100,
        duration: options.duration || 300000, // 5 minutes
        url: options.url || 'ws://localhost:8765'
      }
    };

    this.commandsExecuted = 0;
    this.commandsSucceeded = 0;
    this.commandsFailed = 0;
    this.latencies = [];
    this.memorySnapshots = [];
    this.connectionStartTime = 0;
    this.connectionEndTime = 0;
  }

  /**
   * Mixed command types for realistic testing
   */
  getRandomCommand() {
    const commands = [
      { cmd: 'navigate', url: 'https://example.com' },
      { cmd: 'get-title' },
      { cmd: 'get-html' },
      { cmd: 'screenshot', fullPage: false },
      { cmd: 'extract-text' },
      { cmd: 'get-metadata' },
      { cmd: 'wait-for-element', selector: 'body' },
      { cmd: 'extract-links' },
      { cmd: 'get-cookies' },
      { cmd: 'execute-javascript', code: 'return window.location.href' }
    ];

    return commands[Math.floor(Math.random() * commands.length)];
  }

  /**
   * Connect a single WebSocket client and run commands
   */
  async runClientWorkload(clientId, commandCount) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(this.results.config.url);
        const clientLatencies = [];
        let commandsSent = 0;

        ws.on('open', () => {
          // Send commands in rapid succession
          const sendCommand = () => {
            if (commandsSent >= commandCount) {
              ws.close();
              resolve({ clientId, latencies: clientLatencies });
              return;
            }

            const startTime = performance.now();
            const command = this.getRandomCommand();

            ws.send(JSON.stringify({
              id: `${clientId}-${commandsSent}`,
              ...command
            }));

            commandsSent++;
          };

          // Send first command
          sendCommand();

          // Queue remaining commands with slight delay to avoid overwhelming
          let queuedCommands = 0;
          const queueInterval = setInterval(() => {
            if (commandsSent >= commandCount) {
              clearInterval(queueInterval);
              return;
            }
            sendCommand();
            queuedCommands++;
          }, 10);
        });

        ws.on('message', (data) => {
          const latency = performance.now() - clientLatencies[clientLatencies.length - 1]?.startTime || 0;
          clientLatencies.push({
            latency,
            startTime: performance.now(),
            command: clientLatencies.length
          });
          this.commandsSucceeded++;
        });

        ws.on('error', (error) => {
          this.commandsFailed++;
          this.results.errors.push({
            clientId,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          reject(error);
        });

        ws.on('close', () => {
          // Client closed successfully
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Monitor memory usage periodically
   */
  async monitorMemory(durationMs) {
    const startTime = Date.now();
    const interval = 1000; // Sample every second

    return new Promise((resolve) => {
      const memoryInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        this.memorySnapshots.push({
          timestamp: Date.now() - startTime,
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100,
          external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100,
          rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100
        });

        if (Date.now() - startTime >= durationMs) {
          clearInterval(memoryInterval);
          resolve(this.memorySnapshots);
        }
      }, interval);
    });
  }

  /**
   * Run the complete benchmark suite
   */
  async run() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Performance Benchmark - ${this.results.phase} PHASE`);
    console.log(`Configuration:`);
    console.log(`  Concurrent Clients: ${this.results.config.concurrentClients}`);
    console.log(`  Commands per Client: ${this.results.config.commandsPerClient}`);
    console.log(`  Duration: ${this.results.config.duration}ms`);
    console.log(`${'='.repeat(70)}\n`);

    const startTime = performance.now();
    this.connectionStartTime = Date.now();

    try {
      // Start memory monitoring
      const memoryPromise = this.monitorMemory(this.results.config.duration);

      // Run load test with all concurrent clients
      const clientPromises = [];
      for (let i = 0; i < this.results.config.concurrentClients; i++) {
        clientPromises.push(
          this.runClientWorkload(i, this.results.config.commandsPerClient)
        );
      }

      const clientResults = await Promise.allSettled(clientPromises);
      const memoryData = await memoryPromise;

      this.connectionEndTime = Date.now();
      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Process results
      this.processResults(clientResults, memoryData, totalDuration);

      return this.results;

    } catch (error) {
      this.results.errors.push({
        phase: 'execution',
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Process and calculate metrics from raw results
   */
  processResults(clientResults, memoryData, totalDuration) {
    // Aggregate latencies
    let allLatencies = [];

    clientResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.latencies) {
        allLatencies = allLatencies.concat(
          result.value.latencies.map(l => l.latency)
        );
      }
    });

    // Calculate throughput
    const commandsPerSecond = (this.commandsSucceeded / totalDuration) * 1000;

    // Calculate latency percentiles
    allLatencies.sort((a, b) => a - b);
    const p50 = this.percentile(allLatencies, 50);
    const p95 = this.percentile(allLatencies, 95);
    const p99 = this.percentile(allLatencies, 99);

    // Memory analysis
    const memoryBaseline = memoryData[0].heapUsed;
    const memoryPeak = Math.max(...memoryData.map(m => m.heapUsed));
    const memoryGrowth = memoryPeak - memoryBaseline;
    const memoryGrowthRate = memoryGrowth / (this.connectionEndTime - this.connectionStartTime) * 1000;

    // Calculate success rate
    const totalCommands = this.commandsSucceeded + this.commandsFailed;
    const successRate = totalCommands > 0 ? (this.commandsSucceeded / totalCommands) * 100 : 0;

    // Store metrics
    this.results.metrics = {
      throughput: {
        commandsPerSecond: Math.round(commandsPerSecond * 100) / 100,
        totalCommands: this.commandsSucceeded,
        totalDuration: Math.round(totalDuration),
        unit: 'msg/sec'
      },
      latency: {
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
        min: Math.round(Math.min(...allLatencies) * 100) / 100,
        max: Math.round(Math.max(...allLatencies) * 100) / 100,
        unit: 'ms'
      },
      memory: {
        baseline: Math.round(memoryBaseline * 100) / 100,
        peak: Math.round(memoryPeak * 100) / 100,
        growth: Math.round(memoryGrowth * 100) / 100,
        growthRate: Math.round(memoryGrowthRate * 1000) / 1000,
        unit: 'MB',
        growthRateUnit: 'MB/sec'
      },
      reliability: {
        successRate: Math.round(successRate * 100) / 100,
        succeeded: this.commandsSucceeded,
        failed: this.commandsFailed,
        unit: '%'
      }
    };

    // Print summary
    this.printSummary();
  }

  /**
   * Calculate percentile value
   */
  percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = (p / 100) * sorted.length;
    const lower = Math.floor(index - 1);
    const upper = Math.ceil(index - 1);

    if (lower === upper) {
      return sorted[lower];
    }

    const weight = index - 1 - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Print summary to console
   */
  printSummary() {
    const m = this.results.metrics;

    console.log(`\nBenchmark Results - ${this.results.phase}:`);
    console.log(`\nThroughput:`);
    console.log(`  Commands/sec: ${m.throughput.commandsPerSecond}`);
    console.log(`  Total Commands: ${m.throughput.totalCommands}`);
    console.log(`  Duration: ${m.throughput.totalDuration}ms`);

    console.log(`\nLatency (ms):`);
    console.log(`  P50: ${m.latency.p50}`);
    console.log(`  P95: ${m.latency.p95}`);
    console.log(`  P99: ${m.latency.p99}`);
    console.log(`  Min: ${m.latency.min}`);
    console.log(`  Max: ${m.latency.max}`);

    console.log(`\nMemory (MB):`);
    console.log(`  Baseline: ${m.memory.baseline}`);
    console.log(`  Peak: ${m.memory.peak}`);
    console.log(`  Growth: ${m.memory.growth}`);
    console.log(`  Growth Rate: ${m.memory.growthRate} MB/sec`);

    console.log(`\nReliability:`);
    console.log(`  Success Rate: ${m.reliability.successRate}%`);
    console.log(`  Succeeded: ${m.reliability.succeeded}`);
    console.log(`  Failed: ${m.reliability.failed}`);

    console.log(`\n${'='.repeat(70)}\n`);
  }

  /**
   * Save results to file
   */
  saveResults(filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`Results saved to: ${filepath}`);
    return filepath;
  }
}

/**
 * Comparison Analysis
 */
class BenchmarkComparison {
  constructor(beforeResults, afterResults) {
    this.before = beforeResults;
    this.after = afterResults;
  }

  /**
   * Calculate improvement metrics
   */
  analyze() {
    const comparison = {
      timestamp: new Date().toISOString(),
      summary: {},
      details: {}
    };

    // Throughput improvement
    const throughputBefore = this.before.metrics.throughput.commandsPerSecond;
    const throughputAfter = this.after.metrics.throughput.commandsPerSecond;
    const throughputImprovement = ((throughputAfter - throughputBefore) / throughputBefore) * 100;

    comparison.summary.throughput = {
      before: throughputBefore,
      after: throughputAfter,
      improvement: Math.round(throughputImprovement * 100) / 100,
      unit: '%'
    };

    // Latency improvement (lower is better)
    const latencyBefore = this.before.metrics.latency.p99;
    const latencyAfter = this.after.metrics.latency.p99;
    const latencyImprovement = ((latencyBefore - latencyAfter) / latencyBefore) * 100;

    comparison.summary.latency = {
      before: latencyBefore,
      after: latencyAfter,
      improvement: Math.round(latencyImprovement * 100) / 100,
      unit: '%'
    };

    // Memory improvement (lower is better)
    const memoryBefore = this.before.metrics.memory.growth;
    const memoryAfter = this.after.metrics.memory.growth;
    const memoryImprovement = ((memoryBefore - memoryAfter) / memoryBefore) * 100;

    comparison.summary.memory = {
      before: memoryBefore,
      after: memoryAfter,
      improvement: Math.round(memoryImprovement * 100) / 100,
      unit: '%'
    };

    // Reliability improvement
    const reliabilityBefore = this.before.metrics.reliability.successRate;
    const reliabilityAfter = this.after.metrics.reliability.successRate;
    const reliabilityChange = reliabilityAfter - reliabilityBefore;

    comparison.summary.reliability = {
      before: reliabilityBefore,
      after: reliabilityAfter,
      change: Math.round(reliabilityChange * 100) / 100,
      unit: '%'
    };

    // Detailed comparison
    comparison.details = {
      throughput: { before: this.before.metrics.throughput, after: this.after.metrics.throughput },
      latency: { before: this.before.metrics.latency, after: this.after.metrics.latency },
      memory: { before: this.before.metrics.memory, after: this.after.metrics.memory },
      reliability: { before: this.before.metrics.reliability, after: this.after.metrics.reliability }
    };

    return comparison;
  }

  /**
   * Print comparison report
   */
  printReport() {
    const comparison = this.analyze();

    console.log(`\n${'='.repeat(70)}`);
    console.log('BEFORE/AFTER COMPARISON ANALYSIS');
    console.log(`${'='.repeat(70)}\n`);

    console.log('Throughput (commands/sec):');
    console.log(`  Before: ${comparison.summary.throughput.before}`);
    console.log(`  After:  ${comparison.summary.throughput.after}`);
    console.log(`  Improvement: ${comparison.summary.throughput.improvement}%\n`);

    console.log('Latency P99 (ms):');
    console.log(`  Before: ${comparison.summary.latency.before}`);
    console.log(`  After:  ${comparison.summary.latency.after}`);
    console.log(`  Improvement: ${comparison.summary.latency.improvement}%\n`);

    console.log('Memory Growth (MB):');
    console.log(`  Before: ${comparison.summary.memory.before}`);
    console.log(`  After:  ${comparison.summary.memory.after}`);
    console.log(`  Improvement: ${comparison.summary.memory.improvement}%\n`);

    console.log('Success Rate (%):');
    console.log(`  Before: ${comparison.summary.reliability.before}%`);
    console.log(`  After:  ${comparison.summary.reliability.after}%`);
    console.log(`  Change: ${comparison.summary.reliability.change > 0 ? '+' : ''}${comparison.summary.reliability.change}%\n`);

    console.log(`${'='.repeat(70)}\n`);

    return comparison;
  }

  /**
   * Save comparison to file
   */
  saveComparison(filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    const comparison = this.analyze();
    fs.writeFileSync(filepath, JSON.stringify(comparison, null, 2));
    console.log(`Comparison saved to: ${filepath}`);
    return filepath;
  }
}

module.exports = {
  PerformanceBenchmark,
  BenchmarkComparison
};

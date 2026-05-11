#!/usr/bin/env node

/**
 * Advanced Performance Profiler for Basset Hound Browser v11.3.0
 *
 * Comprehensive profiling tool for:
 * - Command latency distribution
 * - Memory usage patterns
 * - Concurrency analysis
 * - Bottleneck identification
 * - Performance regression detection
 *
 * Usage:
 *   node tests/performance-profiler-advanced.js [options]
 *
 * Options:
 *   --duration 60        Test duration in seconds (default: 60)
 *   --concurrency 10     Concurrent operations (default: 10)
 *   --mode burst|stream  Execution mode (default: stream)
 *   --operations list    CSV of operations to profile (default: all)
 *   --output file        Output file (default: tests/results/PROFILER-REPORT-<timestamp>.md)
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

// ==========================================
// Configuration
// ==========================================

const WS_URL = 'ws://localhost:8765';
const RESULTS_DIR = path.join(__dirname, 'results');

// Test operations
const TEST_OPERATIONS = {
  'ping': { command: 'ping' },
  'list_tabs': { command: 'list_tabs' },
  'get_url': { command: 'get_url' },
  'navigate': {
    command: 'navigate',
    args: { url: 'https://example.com' }
  },
  'screenshot': { command: 'screenshot' },
  'get_text': { command: 'get_text' },
  'get_html': { command: 'get_html' }
};

// ==========================================
// Performance Data Collection
// ==========================================

class PerformanceProfiler {
  constructor(options = {}) {
    this.duration = options.duration || 60;
    this.concurrency = options.concurrency || 10;
    this.mode = options.mode || 'stream';
    this.operationFilter = options.operations || Object.keys(TEST_OPERATIONS);
    this.outputFile = options.output ||
      path.join(RESULTS_DIR, `PROFILER-REPORT-${Date.now()}.md`);

    // Results collection
    this.results = {
      metadata: {
        startTime: Date.now(),
        endTime: null,
        duration: this.duration,
        mode: this.mode,
        concurrency: this.concurrency
      },
      operations: {},
      memory: [],
      throughput: {
        totalCommands: 0,
        totalLatency: 0,
        startTime: Date.now()
      },
      queue: {
        maxDepth: 0,
        avgDepth: [],
        totalQueueTime: 0
      },
      errors: [],
      memoryBaseline: null,
      percentiles: {}
    };

    // Statistics per operation
    for (const op of this.operationFilter) {
      this.results.operations[op] = {
        count: 0,
        latencies: [],
        errors: 0,
        minLatency: Infinity,
        maxLatency: 0,
        avgLatency: 0,
        stddev: 0,
        p50: 0,
        p95: 0,
        p99: 0
      };
    }

    this.memoryBaseline = process.memoryUsage();
    this.results.memoryBaseline = {
      heapUsed: this.formatMB(this.memoryBaseline.heapUsed),
      heapTotal: this.formatMB(this.memoryBaseline.heapTotal),
      rss: this.formatMB(this.memoryBaseline.rss)
    };

    this.pendingRequests = 0;
    this.completedRequests = 0;
    this.messageId = 0;
  }

  /**
   * Format bytes to MB
   */
  formatMB(bytes) {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  /**
   * Calculate statistics
   */
  calculateStats(latencies) {
    if (latencies.length === 0) return null;

    const sorted = latencies.slice().sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const mean = sum / latencies.length;
    const variance = latencies.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / latencies.length;
    const stddev = Math.sqrt(variance);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: Math.round(mean * 100) / 100,
      median: sorted[Math.floor(sorted.length / 2)],
      stddev: Math.round(stddev * 100) / 100,
      p50: sorted[Math.floor(sorted.length * 0.50)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      p999: sorted[Math.floor(sorted.length * 0.999)]
    };
  }

  /**
   * Record latency for operation
   */
  recordLatency(operation, latency) {
    if (!this.results.operations[operation]) {
      this.results.operations[operation] = {
        count: 0, latencies: [], errors: 0, minLatency: Infinity, maxLatency: 0
      };
    }

    const op = this.results.operations[operation];
    op.count++;
    op.latencies.push(latency);
    op.minLatency = Math.min(op.minLatency, latency);
    op.maxLatency = Math.max(op.maxLatency, latency);

    // Throughput calculation
    this.results.throughput.totalCommands++;
    this.results.throughput.totalLatency += latency;
  }

  /**
   * Record memory sample
   */
  recordMemory() {
    const usage = process.memoryUsage();
    const delta = {
      timestamp: Date.now(),
      heapUsed: this.formatMB(usage.heapUsed),
      heapTotal: this.formatMB(usage.heapTotal),
      rss: this.formatMB(usage.rss),
      external: this.formatMB(usage.external),
      heapDelta: this.formatMB(usage.heapUsed - this.memoryBaseline.heapUsed),
      rssDelta: this.formatMB(usage.rss - this.memoryBaseline.rss)
    };
    this.results.memory.push(delta);
  }

  /**
   * Execute single test operation
   */
  async executeOperation(ws, operationType) {
    return new Promise((resolve) => {
      const startTime = performance.now();
      const msgId = ++this.messageId;
      const operationConfig = TEST_OPERATIONS[operationType];

      if (!operationConfig) {
        this.results.operations[operationType].errors++;
        resolve({ success: false, latency: 0 });
        return;
      }

      const timeout = setTimeout(() => {
        ws.removeListener('message', handler);
        this.results.operations[operationType].errors++;
        this.pendingRequests--;
        this.completedRequests++;
        resolve({ success: false, latency: performance.now() - startTime });
      }, 10000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data.toString());

          // Skip status messages
          if (response.type === 'status') return;

          // Match by ID if possible
          if (response.id === msgId || !response.id) {
            clearTimeout(timeout);
            ws.removeListener('message', handler);
            const latency = performance.now() - startTime;
            this.pendingRequests--;
            this.completedRequests++;

            this.recordLatency(operationType, latency);
            resolve({ success: true, latency });
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);
      this.pendingRequests++;

      ws.send(JSON.stringify({
        id: msgId,
        ...operationConfig
      }), (err) => {
        if (err) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          this.results.operations[operationType].errors++;
          this.pendingRequests--;
          this.completedRequests++;
          resolve({ success: false, latency: performance.now() - startTime });
        }
      });
    });
  }

  /**
   * Run profiling test
   */
  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Advanced Performance Profiler - Starting');
    console.log(`${'='.repeat(60)}\n`);

    console.log(`Configuration:`);
    console.log(`  Duration: ${this.duration}s`);
    console.log(`  Concurrency: ${this.concurrency}`);
    console.log(`  Mode: ${this.mode}`);
    console.log(`  Operations: ${this.operationFilter.join(', ')}\n`);

    const ws = new WebSocket(WS_URL);

    return new Promise((resolve) => {
      ws.on('open', async () => {
        console.log('Connected to WebSocket server\n');

        const startTime = Date.now();
        const memoryInterval = setInterval(() => this.recordMemory(), 5000);

        try {
          if (this.mode === 'burst') {
            await this._runBurstMode(ws);
          } else {
            await this._runStreamMode(ws, startTime);
          }
        } finally {
          clearInterval(memoryInterval);
          ws.close();

          // Final memory record
          this.recordMemory();

          // Finalize results
          this.results.metadata.endTime = Date.now();
          this._calculateFinalStats();

          resolve();
        }
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error: ${err.message}`);
        this.results.errors.push(err.message);
        resolve();
      });

      ws.on('close', () => {
        if (!this.results.metadata.endTime) {
          console.log('\nWebSocket closed unexpectedly');
          this.results.metadata.endTime = Date.now();
          this._calculateFinalStats();
          resolve();
        }
      });
    });
  }

  /**
   * Burst mode: Send all requests at once
   */
  async _runBurstMode(ws) {
    console.log('Burst Mode: Sending all requests simultaneously\n');

    const promises = [];
    const targetRequests = this.concurrency * (this.duration / 10);

    for (let i = 0; i < targetRequests; i++) {
      const operation = this.operationFilter[i % this.operationFilter.length];
      promises.push(this.executeOperation(ws, operation));
    }

    const results = await Promise.all(promises);

    let succeeded = 0;
    results.forEach(r => {
      if (r.success) succeeded++;
    });

    console.log(`Burst completed: ${succeeded}/${results.length} successful\n`);
  }

  /**
   * Stream mode: Send requests continuously over duration
   */
  async _runStreamMode(ws, startTime) {
    console.log('Stream Mode: Sending requests continuously\n');

    let operationIndex = 0;
    const endTime = startTime + (this.duration * 1000);

    while (Date.now() < endTime) {
      const promises = [];

      // Queue up to concurrency requests
      for (let i = 0; i < this.concurrency && Date.now() < endTime; i++) {
        const operation = this.operationFilter[operationIndex % this.operationFilter.length];
        promises.push(this.executeOperation(ws, operation));
        operationIndex++;
      }

      // Wait for batch to complete
      if (promises.length > 0) {
        await Promise.all(promises);
      }

      // Progress
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (this.results.throughput.totalCommands / elapsed).toFixed(0);
      process.stdout.write(`\r[${elapsed}s] ${this.results.throughput.totalCommands} ops, ${rate} ops/sec`);
    }

    process.stdout.write('\n\n');
  }

  /**
   * Calculate final statistics
   */
  _calculateFinalStats() {
    for (const [operation, stats] of Object.entries(this.results.operations)) {
      if (stats.count === 0) continue;

      const calcStats = this.calculateStats(stats.latencies);
      stats.avgLatency = calcStats.mean;
      stats.stddev = calcStats.stddev;
      stats.p50 = calcStats.p50;
      stats.p95 = calcStats.p95;
      stats.p99 = calcStats.p99;

      // Calculate success rate
      const total = stats.count + stats.errors;
      stats.successRate = ((stats.count / total) * 100).toFixed(1);
    }

    // Throughput
    const elapsedSeconds = (this.results.metadata.endTime - this.results.metadata.startTime) / 1000;
    this.results.throughput.avgLatency =
      this.results.throughput.totalLatency / this.results.throughput.totalCommands;
    this.results.throughput.opsPerSecond =
      Math.round((this.results.throughput.totalCommands / elapsedSeconds) * 100) / 100;

    // Memory statistics
    if (this.results.memory.length > 0) {
      const samples = this.results.memory.map(m => m.heapUsed);
      const memStats = this.calculateStats(samples);
      this.results.memoryStats = {
        baseline: this.results.memoryBaseline.heapUsed,
        min: memStats.min,
        max: memStats.max,
        avg: memStats.mean,
        peakDelta:
          this.results.memory[this.results.memory.length - 1].heapDelta,
        growthPerHour: ((memStats.max - memStats.min) / elapsedSeconds * 3600).toFixed(2)
      };
    }
  }

  /**
   * Generate markdown report
   */
  generateReport() {
    const ts = new Date(this.results.metadata.endTime).toISOString();
    let report = `# Performance Profiler Report\n\n`;
    report += `**Generated:** ${ts}\n`;
    report += `**Duration:** ${this.duration} seconds\n`;
    report += `**Mode:** ${this.mode}\n`;
    report += `**Concurrency:** ${this.concurrency}\n\n`;

    // Summary
    report += `## Executive Summary\n\n`;
    report += `| Metric | Value |\n`;
    report += `|--------|-------|\n`;
    report += `| Total Commands | ${this.results.throughput.totalCommands} |\n`;
    report += `| Throughput | ${this.results.throughput.opsPerSecond} ops/sec |\n`;
    report += `| Avg Latency | ${this.results.throughput.avgLatency.toFixed(2)}ms |\n`;

    if (this.results.memoryStats) {
      report += `| Peak Heap | ${this.results.memoryStats.max.toFixed(2)}MB |\n`;
      report += `| Memory Growth/Hour | ${this.results.memoryStats.growthPerHour}MB |\n`;
    }
    report += `\n`;

    // Per-operation stats
    report += `## Operation Performance\n\n`;
    report += `| Operation | Count | Avg (ms) | P95 (ms) | P99 (ms) | Success % |\n`;
    report += `|-----------|-------|---------|---------|---------|----------|\n`;

    for (const [op, stats] of Object.entries(this.results.operations)) {
      if (stats.count === 0) continue;
      report += `| ${op} | ${stats.count} | `;
      report += `${stats.avgLatency.toFixed(2)} | `;
      report += `${stats.p95 || 0} | `;
      report += `${stats.p99 || 0} | `;
      report += `${stats.successRate}% |\n`;
    }
    report += `\n`;

    // Memory timeline
    if (this.results.memory.length > 0) {
      report += `## Memory Timeline\n\n`;
      report += `| Time | Heap (MB) | Delta (MB) | RSS (MB) |\n`;
      report += `|------|-----------|-----------|----------|\n`;

      const samples = this.results.memory;
      for (let i = 0; i < samples.length; i += Math.max(1, Math.floor(samples.length / 10))) {
        const s = samples[i];
        const elapsed = ((s.timestamp - this.results.metadata.startTime) / 1000).toFixed(1);
        report += `| ${elapsed}s | ${s.heapUsed.toFixed(2)} | `;
        report += `${s.heapDelta.toFixed(2)} | ${s.rss.toFixed(2)} |\n`;
      }
      report += `\n`;
    }

    // Errors
    if (this.results.errors.length > 0) {
      report += `## Errors\n\n`;
      for (const err of this.results.errors.slice(0, 10)) {
        report += `- ${err}\n`;
      }
      report += `\n`;
    }

    // Recommendations
    report += `## Analysis & Recommendations\n\n`;

    // Find slowest operation
    let slowest = null;
    for (const [op, stats] of Object.entries(this.results.operations)) {
      if (!slowest || stats.p95 > slowest.p95) {
        slowest = { name: op, ...stats };
      }
    }

    if (slowest && slowest.p95 > 100) {
      report += `- **${slowest.name}** is slow (P95: ${slowest.p95}ms). Consider optimization.\n`;
    }

    if (this.results.memoryStats && parseFloat(this.results.memoryStats.growthPerHour) > 2) {
      report += `- **Memory growth** is high (${this.results.memoryStats.growthPerHour}MB/hr). Check for leaks.\n`;
    }

    const errCount = Object.values(this.results.operations)
      .reduce((sum, op) => sum + op.errors, 0);
    if (errCount > 0) {
      report += `- **${errCount} errors** occurred. Investigate reliability issues.\n`;
    }

    report += `\n---\n\n`;
    report += `*Report generated by Advanced Performance Profiler*\n`;

    return report;
  }

  /**
   * Save report to file
   */
  saveReport() {
    // Ensure directory exists
    if (!fs.existsSync(RESULTS_DIR)) {
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
    }

    const report = this.generateReport();
    fs.writeFileSync(this.outputFile, report);

    // Also save JSON data
    const jsonFile = this.outputFile.replace('.md', '-data.json');
    fs.writeFileSync(jsonFile, JSON.stringify(this.results, null, 2));

    console.log(`\nReports saved:`);
    console.log(`  Markdown: ${this.outputFile}`);
    console.log(`  JSON: ${jsonFile}\n`);
  }
}

// ==========================================
// Main Entry Point
// ==========================================

async function main() {
  // Parse arguments
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];

    if (key === 'duration' || key === 'concurrency') {
      options[key] = parseInt(value);
    } else if (key === 'operations') {
      options[key] = value.split(',');
    } else {
      options[key] = value;
    }
  }

  const profiler = new PerformanceProfiler(options);

  try {
    await profiler.run();
    profiler.saveReport();

    console.log('Profiling complete!');
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();

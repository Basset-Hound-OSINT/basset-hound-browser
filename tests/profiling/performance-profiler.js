#!/usr/bin/env node

const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Performance metrics collection
class PerformanceProfiler {
  constructor(wsUrl = 'ws://localhost:8765') {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.metrics = {
      latency: {},
      memory: [],
      cpu: [],
      throughput: {},
      operations: []
    };
    this.startTime = Date.now();
    this.startMemory = process.memoryUsage();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        console.log('Connected to WebSocket server');
        resolve();
      });
      this.ws.on('error', reject);
      this.ws.on('message', (msg) => {
        // Handle messages
      });
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const startMem = process.memoryUsage();

      this.ws.send(JSON.stringify(command), (err) => {
        if (err) {
          reject(err);
        }
      });

      const handler = (msg) => {
        try {
          const response = JSON.parse(msg);
          if (response.id === command.id) {
            const endTime = Date.now();
            const endMem = process.memoryUsage();
            const latency = endTime - startTime;
            const memDelta = endMem.heapUsed - startMem.heapUsed;

            this.ws.removeListener('message', handler);
            resolve({
              latency,
              memDelta,
              response,
              timestamp: new Date().toISOString()
            });
          }
        } catch (e) {
          // Parse error, continue listening
        }
      };

      this.ws.on('message', handler);

      // Timeout after 30s
      setTimeout(() => {
        this.ws.removeListener('message', handler);
        reject(new Error('Command timeout'));
      }, 30000);
    });
  }

  recordMetric(commandType, latency, memDelta) {
    if (!this.metrics.latency[commandType]) {
      this.metrics.latency[commandType] = [];
    }
    this.metrics.latency[commandType].push(latency);

    this.metrics.operations.push({
      type: commandType,
      latency,
      memDelta,
      timestamp: Date.now()
    });
  }

  captureMemory() {
    const mem = process.memoryUsage();
    this.metrics.memory.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external
    });
  }

  captureCPU() {
    const cpus = os.cpus();
    const usage = process.cpuUsage();
    this.metrics.cpu.push({
      timestamp: Date.now(),
      user: usage.user,
      system: usage.system,
      avgLoadAvg: os.loadavg()[0]
    });
  }

  async profileLatency() {
    console.log('\n========== LATENCY PROFILING ==========');
    const commands = [
      { name: 'navigate', cmd: { type: 'navigate', url: 'https://httpbin.org/delay/0' } },
      { name: 'screenshot', cmd: { type: 'screenshot' } },
      { name: 'get_html', cmd: { type: 'get_html' } },
      { name: 'get_text', cmd: { type: 'get_text' } },
      { name: 'click', cmd: { type: 'click', selector: 'body', x: 10, y: 10 } },
      { name: 'scroll', cmd: { type: 'scroll', dx: 0, dy: 100 } },
      { name: 'get_image', cmd: { type: 'get_image' } }
    ];

    for (const { name, cmd } of commands) {
      console.log(`\nTesting ${name} (10 iterations)...`);
      const results = [];

      for (let i = 0; i < 10; i++) {
        try {
          cmd.id = `${name}-${i}-${Date.now()}`;
          const result = await this.sendCommand(cmd);
          results.push(result.latency);
          this.recordMetric(name, result.latency, result.memDelta);
          console.log(`  Iteration ${i + 1}: ${result.latency}ms`);
        } catch (e) {
          console.log(`  Iteration ${i + 1}: ERROR - ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 100));
      }

      if (results.length > 0) {
        const sorted = results.sort((a, b) => a - b);
        const stats = {
          p50: sorted[Math.floor(results.length * 0.5)],
          p95: sorted[Math.floor(results.length * 0.95)],
          p99: sorted[Math.floor(results.length * 0.99)],
          min: Math.min(...results),
          max: Math.max(...results),
          avg: Math.round(results.reduce((a, b) => a + b, 0) / results.length)
        };
        console.log(`  Stats: p50=${stats.p50}ms, p95=${stats.p95}ms, p99=${stats.p99}ms, avg=${stats.avg}ms`);
        this.metrics.latency[name] = {
          results,
          stats
        };
      }
    }
  }

  async profileMemory() {
    console.log('\n========== MEMORY PROFILING ==========');
    console.log('Capturing memory metrics over extended operations...');

    const initialMem = process.memoryUsage();
    console.log(`Initial: heapUsed=${Math.round(initialMem.heapUsed / 1024 / 1024)}MB, RSS=${Math.round(initialMem.rss / 1024 / 1024)}MB`);

    // Run 50 mixed operations
    const operations = [
      { type: 'get_html' },
      { type: 'get_text' },
      { type: 'screenshot' },
      { type: 'scroll', dx: 0, dy: 100 }
    ];

    for (let i = 0; i < 50; i++) {
      const op = operations[i % operations.length];
      op.id = `memory-test-${i}-${Date.now()}`;

      try {
        await this.sendCommand(op);
        this.captureMemory();
      } catch (e) {
        console.log(`Operation ${i} failed: ${e.message}`);
      }

      if ((i + 1) % 10 === 0) {
        const currentMem = process.memoryUsage();
        console.log(`After ${i + 1} ops: heapUsed=${Math.round(currentMem.heapUsed / 1024 / 1024)}MB, RSS=${Math.round(currentMem.rss / 1024 / 1024)}MB`);
      }

      await new Promise(r => setTimeout(r, 50));
    }

    const finalMem = process.memoryUsage();
    const memGrowth = {
      heapUsed: finalMem.heapUsed - initialMem.heapUsed,
      rss: finalMem.rss - initialMem.rss
    };

    console.log(`\nMemory Growth: heapUsed=${Math.round(memGrowth.heapUsed / 1024 / 1024)}MB, RSS=${Math.round(memGrowth.rss / 1024 / 1024)}MB`);
    this.metrics.memoryGrowth = memGrowth;
  }

  async profileThroughput() {
    console.log('\n========== THROUGHPUT PROFILING ==========');

    // Test 1: Fast sequential commands
    console.log('Test 1: Fast sequential commands (100 get_text operations)...');
    const start1 = Date.now();
    let success1 = 0;

    for (let i = 0; i < 100; i++) {
      try {
        await this.sendCommand({
          id: `throughput-fast-${i}-${Date.now()}`,
          type: 'get_text'
        });
        success1++;
      } catch (e) {
        // Count failures
      }
      if ((i + 1) % 20 === 0) {
        process.stdout.write('.');
      }
    }

    const duration1 = Date.now() - start1;
    const throughput1 = Math.round((success1 / duration1) * 1000);
    console.log(`\n  Completed: ${success1}/100 in ${duration1}ms (${throughput1} ops/sec)`);

    // Test 2: Mixed operations
    console.log('Test 2: Mixed operations (50 mixed commands)...');
    const operations = [
      { type: 'get_html' },
      { type: 'get_text' },
      { type: 'screenshot' }
    ];

    const start2 = Date.now();
    let success2 = 0;

    for (let i = 0; i < 50; i++) {
      const op = operations[i % operations.length];
      op.id = `throughput-mixed-${i}-${Date.now()}`;

      try {
        await this.sendCommand(op);
        success2++;
      } catch (e) {
        // Count failures
      }
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }

    const duration2 = Date.now() - start2;
    const throughput2 = Math.round((success2 / duration2) * 1000);
    console.log(`\n  Completed: ${success2}/50 in ${duration2}ms (${throughput2} ops/sec)`);

    this.metrics.throughput = {
      fastSequential: { operations: success1, duration: duration1, throughput: throughput1 },
      mixed: { operations: success2, duration: duration2, throughput: throughput2 }
    };
  }

  async profileCPU() {
    console.log('\n========== CPU PROFILING ==========');
    console.log('Monitoring CPU during 30 operations...');

    const cpuStart = process.cpuUsage();

    for (let i = 0; i < 30; i++) {
      try {
        await this.sendCommand({
          id: `cpu-test-${i}-${Date.now()}`,
          type: i % 2 === 0 ? 'get_text' : 'get_html'
        });
        this.captureCPU();
      } catch (e) {
        // Continue
      }
      if ((i + 1) % 10 === 0) {
        process.stdout.write('.');
      }
    }

    const cpuEnd = process.cpuUsage(cpuStart);
    console.log(`\nCPU Usage: user=${cpuEnd.user / 1000}ms, system=${cpuEnd.system / 1000}ms`);
    this.metrics.cpuUsage = cpuEnd;
  }

  generateReport() {
    console.log('\n========== GENERATING REPORT ==========');
    const results = this.metrics;
    let report = `# Performance Profiling Report - v11.3.0-fixed
Generated: ${new Date().toISOString()}
Server: ${this.wsUrl}

## Executive Summary
- Total Operations: ${results.operations.length}
- Memory Growth: ${Math.round(results.memoryGrowth?.heapUsed / 1024 / 1024)}MB heap, ${Math.round(results.memoryGrowth?.rss / 1024 / 1024)}MB RSS
- Duration: ${Math.round((Date.now() - this.startTime) / 1000)}s

## Latency Analysis

| Command | p50 (ms) | p95 (ms) | p99 (ms) | Avg (ms) | Min (ms) | Max (ms) |
|---------|----------|----------|----------|----------|----------|----------|
`;

    for (const [cmd, data] of Object.entries(results.latency)) {
      if (data.stats) {
        const stats = data.stats;
        report += `| ${cmd} | ${stats.p50} | ${stats.p95} | ${stats.p99} | ${stats.avg} | ${stats.min} | ${stats.max} |\n`;
      }
    }

    report += `\n## Memory Metrics

Initial Heap: ${Math.round(this.startMemory.heapUsed / 1024 / 1024)}MB
Final Heap: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB
Growth: ${Math.round(results.memoryGrowth?.heapUsed / 1024 / 1024)}MB

Initial RSS: ${Math.round(this.startMemory.rss / 1024 / 1024)}MB
Final RSS: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB
Growth: ${Math.round(results.memoryGrowth?.rss / 1024 / 1024)}MB

## Throughput Analysis

Fast Sequential (100x get_text):
- Operations: ${results.throughput?.fastSequential?.operations}
- Duration: ${results.throughput?.fastSequential?.duration}ms
- Throughput: ${results.throughput?.fastSequential?.throughput} ops/sec

Mixed Operations (50x mixed):
- Operations: ${results.throughput?.mixed?.operations}
- Duration: ${results.throughput?.mixed?.duration}ms
- Throughput: ${results.throughput?.mixed?.throughput} ops/sec

## CPU Usage

User CPU: ${results.cpuUsage?.user / 1000}ms
System CPU: ${results.cpuUsage?.system / 1000}ms

## Raw Metrics

${JSON.stringify(results, null, 2)}
`;

    return report;
  }

  async run() {
    try {
      await this.connect();
      await this.profileLatency();
      await this.profileMemory();
      await this.profileCPU();
      await this.profileThroughput();

      const report = this.generateReport();

      const resultsDir = '/home/devel/basset-hound-browser/tests/results';
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }

      const reportPath = path.join(resultsDir, 'PERFORMANCE-PROFILING-2026-05-08.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\nReport saved to: ${reportPath}`);

      this.ws.close();
    } catch (e) {
      console.error('Profiling error:', e);
      process.exit(1);
    }
  }
}

// Run profiler
const profiler = new PerformanceProfiler();
profiler.run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

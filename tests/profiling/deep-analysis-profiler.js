#!/usr/bin/env node

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

class DeepAnalysisProfiler {
  constructor(wsUrl = 'ws://localhost:8765') {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.results = {
      networkLatency: [],
      domOperations: [],
      memoryFragmentation: [],
      commandDispatch: [],
      bottlenecks: []
    };
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        console.log('Connected for deep analysis');
        resolve();
      });
      this.ws.on('error', reject);
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      const networkStart = Date.now();
      const startMem = process.memoryUsage();
      let resolved = false;

      this.ws.send(JSON.stringify(command), (err) => {
        if (err) {
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        }
      });

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Timeout'));
        }
      }, 30000);

      const handler = (msg) => {
        if (!resolved) {
          try {
            const response = JSON.parse(msg);
            if (response.id === command.id) {
              resolved = true;
              clearTimeout(timeout);
              this.ws.removeListener('message', handler);

              const networkEnd = Date.now();
              const endMem = process.memoryUsage();
              const totalLatency = networkEnd - networkStart;
              const memDelta = endMem.heapUsed - startMem.heapUsed;

              resolve({
                totalLatency,
                memDelta,
                timestamp: new Date().toISOString(),
                memState: {
                  heapUsed: endMem.heapUsed,
                  heapTotal: endMem.heapTotal,
                  external: endMem.external
                }
              });
            }
          } catch (e) {
            // Continue listening
          }
        }
      };

      this.ws.on('message', handler);
    });
  }

  async analyzeNetworkLatency() {
    console.log('\n========== NETWORK LATENCY ANALYSIS ==========');
    console.log('Testing network round-trip time for command dispatch...\n');

    const results = [];
    const commands = [
      { type: 'get_text', name: 'get_text (minimal)' },
      { type: 'get_html', name: 'get_html (medium)' },
      { type: 'screenshot', name: 'screenshot (heavy)' }
    ];

    for (const cmd of commands) {
      console.log(`Testing ${cmd.name}...`);
      const measurements = [];

      for (let i = 0; i < 25; i++) {
        cmd.id = `network-${cmd.type}-${i}-${Date.now()}`;
        try {
          const result = await this.sendCommand(cmd);
          measurements.push(result.totalLatency);
        } catch (e) {
          console.log(`  Error: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 20));
      }

      if (measurements.length > 0) {
        const sorted = measurements.sort((a, b) => a - b);
        const stats = {
          p50: sorted[Math.floor(measurements.length * 0.50)],
          p90: sorted[Math.floor(measurements.length * 0.90)],
          p95: sorted[Math.floor(measurements.length * 0.95)],
          p99: sorted[Math.floor(measurements.length * 0.99)],
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          avg: Math.round(measurements.reduce((a, b) => a + b, 0) / measurements.length),
          stdDev: this.calculateStdDev(measurements)
        };
        console.log(`  p50: ${stats.p50}ms, p90: ${stats.p90}ms, p95: ${stats.p95}ms, p99: ${stats.p99}ms`);
        console.log(`  avg: ${stats.avg}ms, min: ${stats.min}ms, max: ${stats.max}ms, stdDev: ${Math.round(stats.stdDev)}ms\n`);
        results.push({ command: cmd.name, stats, measurements });
      }
    }

    this.results.networkLatency = results;
    return results;
  }

  async analyzeMemoryFragmentation() {
    console.log('\n========== MEMORY FRAGMENTATION ANALYSIS ==========');
    console.log('Analyzing heap fragmentation over time...\n');

    const fragmentationData = [];

    // GC not available without --expose-gc flag
    console.log('Note: Running GC analysis without explicit garbage collection\n');

    const initialMem = process.memoryUsage();
    console.log(`Initial: heapUsed=${Math.round(initialMem.heapUsed / 1024 / 1024)}MB, heapTotal=${Math.round(initialMem.heapTotal / 1024 / 1024)}MB`);
    console.log(`Fragmentation: ${Math.round(((initialMem.heapTotal - initialMem.heapUsed) / initialMem.heapTotal) * 100)}%\n`);

    // Run 100 mixed operations
    for (let i = 0; i < 100; i++) {
      const commandType = ['get_text', 'get_html', 'get_image'][i % 3];
      const cmd = { type: commandType, id: `mem-frag-${i}-${Date.now()}` };

      try {
        await this.sendCommand(cmd);
      } catch (e) {
        // Continue
      }

      if ((i + 1) % 20 === 0) {
        const currentMem = process.memoryUsage();
        const fragmentation = Math.round(((currentMem.heapTotal - currentMem.heapUsed) / currentMem.heapTotal) * 100);
        const growth = Math.round((currentMem.heapUsed - initialMem.heapUsed) / 1024 / 1024);

        fragmentationData.push({
          operations: i + 1,
          fragmentation,
          growth,
          heapUsed: Math.round(currentMem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(currentMem.heapTotal / 1024 / 1024)
        });

        console.log(`After ${i + 1} ops: heap=${Math.round(currentMem.heapUsed / 1024 / 1024)}MB/${Math.round(currentMem.heapTotal / 1024 / 1024)}MB, frag=${fragmentation}%, growth=${growth}MB`);
      }

      await new Promise(r => setTimeout(r, 10));
    }

    this.results.memoryFragmentation = fragmentationData;
    return fragmentationData;
  }

  async analyzeCommandDispatch() {
    console.log('\n========== COMMAND DISPATCH ANALYSIS ==========');
    console.log('Measuring dispatch overhead and queuing behavior...\n');

    // Test single commands
    console.log('Single command dispatch time:');
    const singleDispatch = [];
    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      const cmd = { type: 'get_text', id: `dispatch-single-${i}` };

      const result = await this.sendCommand(cmd);
      const end = process.hrtime.bigint();

      singleDispatch.push(Number(end - start) / 1e6); // Convert to ms
      if ((i + 1) % 5 === 0) {
        process.stdout.write('.');
      }
    }
    console.log();

    // Test concurrent commands (rapid fire)
    console.log('\nRapid-fire concurrent commands (10 commands as fast as possible):');
    const concurrentStart = Date.now();
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        this.sendCommand({
          type: 'get_text',
          id: `dispatch-concurrent-${i}-${Date.now()}`
        })
      );
    }

    await Promise.all(promises);
    const concurrentDuration = Date.now() - concurrentStart;

    const stats = {
      singleAvg: Math.round(singleDispatch.reduce((a, b) => a + b, 0) / singleDispatch.length),
      concurrentDuration,
      concurrentThroughput: Math.round((10 / concurrentDuration) * 1000),
      maxConcurrentTime: Math.max(...singleDispatch),
      minConcurrentTime: Math.min(...singleDispatch)
    };

    console.log(`Single command avg: ${stats.singleAvg}ms`);
    console.log(`10 concurrent commands: ${concurrentDuration}ms (${stats.concurrentThroughput} ops/sec)`);

    this.results.commandDispatch = stats;
    return stats;
  }

  async identifyBottlenecks() {
    console.log('\n========== BOTTLENECK IDENTIFICATION ==========');
    console.log('Analyzing slow operations and resource contention...\n');

    const bottlenecks = [];

    // Check for slow operations
    if (this.results.networkLatency.length > 0) {
      const maxLatency = Math.max(...this.results.networkLatency.map(r => r.stats.max));
      if (maxLatency > 50) {
        bottlenecks.push({
          severity: 'HIGH',
          type: 'Network Latency',
          issue: `Some commands taking up to ${maxLatency}ms (expected <50ms)`,
          impact: 'Slow user experience, timeouts in batch operations'
        });
      }
    }

    // Check for memory growth
    if (this.results.memoryFragmentation.length > 0) {
      const lastFrag = this.results.memoryFragmentation[this.results.memoryFragmentation.length - 1];
      if (lastFrag.growth > 20) {
        bottlenecks.push({
          severity: 'MEDIUM',
          type: 'Memory Growth',
          issue: `Heap grew ${lastFrag.growth}MB after 100 operations`,
          impact: 'Long-running sessions may run out of memory'
        });
      }

      if (lastFrag.fragmentation > 40) {
        bottlenecks.push({
          severity: 'MEDIUM',
          type: 'Heap Fragmentation',
          issue: `Heap fragmentation at ${lastFrag.fragmentation}%`,
          impact: 'Inefficient memory usage, GC pressure'
        });
      }
    }

    // Check CPU usage
    const cpuResult = process.cpuUsage();
    const totalCpuMs = (cpuResult.user + cpuResult.system) / 1000;
    if (totalCpuMs > 100) {
      bottlenecks.push({
        severity: 'LOW',
        type: 'CPU Usage',
        issue: `High CPU usage: ${Math.round(totalCpuMs)}ms total`,
        impact: 'May impact other processes'
      });
    }

    // Check throughput
    if (this.results.commandDispatch.concurrentThroughput < 100) {
      bottlenecks.push({
        severity: 'MEDIUM',
        type: 'Throughput',
        issue: `Low concurrent throughput: ${this.results.commandDispatch.concurrentThroughput} ops/sec`,
        impact: 'Batch operations will be slow'
      });
    }

    console.log(`Found ${bottlenecks.length} potential bottlenecks:\n`);
    for (const bn of bottlenecks) {
      console.log(`[${bn.severity}] ${bn.type}`);
      console.log(`  Issue: ${bn.issue}`);
      console.log(`  Impact: ${bn.impact}\n`);
    }

    this.results.bottlenecks = bottlenecks;
    return bottlenecks;
  }

  calculateStdDev(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  generateDetailedReport() {
    let report = `# Deep Performance Analysis Report - v11.3.0-fixed
Generated: ${new Date().toISOString()}

## Network Latency Analysis

`;

    for (const result of this.results.networkLatency) {
      const stats = result.stats;
      report += `### ${result.command}
- p50: ${stats.p50}ms
- p90: ${stats.p90}ms
- p95: ${stats.p95}ms
- p99: ${stats.p99}ms
- Average: ${stats.avg}ms
- Range: ${stats.min}ms - ${stats.max}ms
- StdDev: ${Math.round(stats.stdDev)}ms

`;
    }

    report += `## Memory Fragmentation

`;
    for (const data of this.results.memoryFragmentation) {
      report += `| After ${data.operations} ops | ${data.heapUsed}MB / ${data.heapTotal}MB | ${data.fragmentation}% frag | +${data.growth}MB growth |\n`;
    }

    report += `\n## Command Dispatch

- Single Command Avg: ${this.results.commandDispatch.singleAvg}ms
- 10 Concurrent Commands: ${this.results.commandDispatch.concurrentDuration}ms
- Concurrent Throughput: ${this.results.commandDispatch.concurrentThroughput} ops/sec
- Min: ${Math.round(this.results.commandDispatch.minConcurrentTime)}ms
- Max: ${Math.round(this.results.commandDispatch.maxConcurrentTime)}ms

## Identified Bottlenecks

`;

    if (this.results.bottlenecks.length === 0) {
      report += 'No critical bottlenecks identified.\n';
    } else {
      for (const bn of this.results.bottlenecks) {
        report += `### [${bn.severity}] ${bn.type}
Issue: ${bn.issue}
Impact: ${bn.impact}

`;
      }
    }

    return report;
  }

  async run() {
    try {
      await this.connect();
      await this.analyzeNetworkLatency();
      await this.analyzeMemoryFragmentation();
      await this.analyzeCommandDispatch();
      await this.identifyBottlenecks();

      const report = this.generateDetailedReport();

      const resultsDir = '/home/devel/basset-hound-browser/tests/results';
      const reportPath = path.join(resultsDir, 'DEEP-ANALYSIS-2026-05-08.md');
      fs.writeFileSync(reportPath, report);
      console.log(`\nDeep analysis report saved to: ${reportPath}`);

      this.ws.close();
    } catch (e) {
      console.error('Analysis error:', e);
      process.exit(1);
    }
  }
}

const profiler = new DeepAnalysisProfiler();
profiler.run().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});

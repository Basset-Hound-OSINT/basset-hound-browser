#!/usr/bin/env node

/**
 * STRESS TEST ENGINEER - Basset Hound Browser
 *
 * Systematically find system breaking points through incremental load testing
 *
 * Test Profile:
 * - Start: 10 concurrent connections
 * - Increment: +5 every 30 seconds
 * - Continue until: Errors appear OR resource limits hit
 * - Measure: Degradation points, breaking points, recovery
 *
 * Metrics Tracked:
 * 1. Connection stability
 * 2. Memory utilization (heap, RSS, external)
 * 3. CPU usage (user, system, total)
 * 4. Message latency (P50, P95, P99, max)
 * 5. Throughput (msgs/sec)
 * 6. Error rates by category
 * 7. Resource exhaustion patterns
 *
 * Date: 2026-06-21
 * Version: 1.0.0
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

class StressTestEngineer {
  constructor(options = {}) {
    this.config = {
      startConnections: options.startConnections || 10,
      incrementConnections: options.incrementConnections || 5,
      incrementInterval: options.incrementInterval || 30 * 1000, // 30 seconds
      maxConnections: options.maxConnections || 500,
      serverUrl: options.serverUrl || 'ws://127.0.0.1:9999',
      testDuration: options.testDuration || 60 * 60 * 1000, // 1 hour max
      errorThreshold: options.errorThreshold || 0.10, // 10% error rate
      memoryThreshold: options.memoryThreshold || 1024, // 1GB
      cpuThreshold: options.cpuThreshold || 80, // 80%
      degradationThreshold: options.degradationThreshold || 0.20, // 20% latency increase
      messageSize: options.messageSize || 256, // bytes
      reportDir: options.reportDir || path.join(__dirname, '../results')
    };

    this.state = {
      isRunning: false,
      currentConnections: [],
      connectionMetrics: new Map(),
      globalMetrics: {
        timestamp: new Date().toISOString(),
        phases: [],
        degradationPoint: null,
        breakingPoint: null,
        systemResources: {
          cpuUsage: [],
          memoryUsage: [],
          peakMemory: 0,
          peakCpu: 0
        },
        errors: {
          connectionErrors: 0,
          messageErrors: 0,
          timeoutErrors: 0,
          resourceErrors: 0,
          otherErrors: 0
        }
      },
      phase: {
        number: 0,
        targetConnections: this.config.startConnections,
        startTime: null,
        stats: {
          successfulConnections: 0,
          failedConnections: 0,
          totalMessages: 0,
          successfulMessages: 0,
          failedMessages: 0,
          latencies: [],
          errors: []
        }
      }
    };

    this.degradationDetected = false;
    this.breakingPointFound = false;
  }

  async start() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    STRESS TEST ENGINEER v1.0                               ║');
    console.log('║              Find System Breaking Points Through Incremental Load          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    this.printConfiguration();
    this.state.isRunning = true;

    const startTime = performance.now();

    try {
      // Start resource monitoring
      this.startResourceMonitoring();

      // Main test loop
      while (this.state.isRunning) {
        const elapsedTime = performance.now() - startTime;
        if (elapsedTime > this.config.testDuration) {
          console.log('\n>>> Test duration limit reached');
          break;
        }

        if (this.state.phase.targetConnections > this.config.maxConnections) {
          console.log('\n>>> Maximum connection limit reached');
          break;
        }

        if (this.breakingPointFound) {
          console.log('\n>>> Breaking point found, stopping test');
          break;
        }

        await this.runPhase();

        // Wait for next increment interval
        await this.sleep(this.config.incrementInterval);
        this.state.phase.targetConnections += this.config.incrementConnections;
      }

      this.state.isRunning = false;
      await this.cleanup();
      this.generateReport();
    } catch (err) {
      console.error('Test failed:', err.message);
      this.state.isRunning = false;
      throw err;
    }
  }

  async runPhase() {
    this.state.phase.number++;
    this.state.phase.startTime = performance.now();
    this.state.phase.stats = {
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      latencies: [],
      errors: []
    };

    const targetConnections = this.state.phase.targetConnections;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Phase ${this.state.phase.number}: Target ${targetConnections} concurrent connections`);
    console.log(`${'='.repeat(80)}`);

    // Establish new connections
    const newConnectionCount = targetConnections - this.state.currentConnections.length;
    if (newConnectionCount > 0) {
      console.log(`[Connecting] Adding ${newConnectionCount} new connections...`);
      await this.addConnections(newConnectionCount);
    }

    // Send messages and collect metrics
    console.log(`[Testing] Sending messages and collecting metrics...`);
    await this.sendMessagesPhase(30 * 1000); // 30-second phase

    // Analyze phase results
    const analysis = this.analyzePhase();
    this.printPhaseResults(analysis);

    // Check for degradation
    if (!this.degradationDetected && this.shouldDetectDegradation(analysis)) {
      console.log('\n⚠️  DEGRADATION DETECTED');
      this.degradationDetected = true;
      this.state.globalMetrics.degradationPoint = {
        phase: this.state.phase.number,
        connections: targetConnections,
        analysis
      };
    }

    // Check for breaking point
    if (this.shouldStopTest(analysis)) {
      console.log('\n🔴 BREAKING POINT REACHED');
      this.breakingPointFound = true;
      this.state.globalMetrics.breakingPoint = {
        phase: this.state.phase.number,
        connections: targetConnections,
        analysis
      };
    }

    this.state.globalMetrics.phases.push({
      phase: this.state.phase.number,
      connections: targetConnections,
      analysis
    });
  }

  async addConnections(count) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.createConnection());
    }

    const results = await Promise.all(promises);
    let successful = 0;
    for (const result of results) {
      if (result.connected) {
        this.state.currentConnections.push(result);
        this.state.connectionMetrics.set(result.id, {
          connected: true,
          messagesSent: 0,
          messagesReceived: 0,
          errors: 0,
          latencies: []
        });
        successful++;
      } else {
        this.state.phase.stats.failedConnections++;
      }
    }
    this.state.phase.stats.successfulConnections = successful;
    console.log(`  ✓ Connected: ${successful}/${count}`);
  }

  async createConnection() {
    return new Promise((resolve) => {
      const id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let resolved = false;

      try {
        const ws = new WebSocket(this.config.serverUrl);

        const connectionTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.state.phase.stats.errors.push(`Connection timeout: ${id}`);
            this.state.globalMetrics.errors.timeoutErrors++;
            resolve({ id, connected: false, ws: null });
          }
        }, 5000);

        ws.on('open', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimeout);
            resolve({ id, connected: true, ws });
          }
        });

        ws.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(connectionTimeout);
            this.state.phase.stats.errors.push(`Connection error: ${err.message}`);
            this.state.globalMetrics.errors.connectionErrors++;
            resolve({ id, connected: false, ws: null });
          }
        });

        ws.on('close', () => {
          if (this.state.connectionMetrics.has(id)) {
            this.state.connectionMetrics.get(id).connected = false;
          }
        });
      } catch (err) {
        if (!resolved) {
          resolved = true;
          this.state.phase.stats.errors.push(`Connection exception: ${err.message}`);
          this.state.globalMetrics.errors.otherErrors++;
          resolve({ id, connected: false, ws: null });
        }
      }
    });
  }

  async sendMessagesPhase(duration) {
    const endTime = performance.now() + duration;
    const messageInterval = 100; // milliseconds between message batches

    return new Promise((resolve) => {
      const sendInterval = setInterval(() => {
        if (performance.now() >= endTime) {
          clearInterval(sendInterval);
          resolve();
          return;
        }

        // Send message from each connected client
        for (const client of this.state.currentConnections) {
          if (!client.ws || client.ws.readyState !== WebSocket.OPEN) {
            continue;
          }

          const messageStart = performance.now();
          const message = JSON.stringify({
            command: 'ping',
            id: `${client.id}-${Date.now()}`,
            payload: this.generatePayload()
          });

          try {
            client.ws.send(message, (err) => {
              const latency = performance.now() - messageStart;
              this.state.phase.stats.latencies.push(latency);
              this.state.phase.stats.totalMessages++;

              if (err) {
                this.state.phase.stats.failedMessages++;
                this.state.globalMetrics.errors.messageErrors++;
                if (this.state.connectionMetrics.has(client.id)) {
                  this.state.connectionMetrics.get(client.id).errors++;
                }
              } else {
                this.state.phase.stats.successfulMessages++;
                if (this.state.connectionMetrics.has(client.id)) {
                  this.state.connectionMetrics.get(client.id).messagesSent++;
                }
              }
            });
          } catch (err) {
            this.state.phase.stats.failedMessages++;
            this.state.phase.stats.totalMessages++;
            this.state.globalMetrics.errors.messageErrors++;
          }
        }
      }, messageInterval);
    });
  }

  generatePayload() {
    const size = this.config.messageSize;
    return 'x'.repeat(size);
  }

  analyzePhase() {
    const stats = this.state.phase.stats;
    const connectedCount = this.state.currentConnections.filter(c => c.ws && c.ws.readyState === WebSocket.OPEN).length;

    // Calculate latency percentiles
    const latencies = stats.latencies.sort((a, b) => a - b);
    const p50 = this.percentile(latencies, 50);
    const p95 = this.percentile(latencies, 95);
    const p99 = this.percentile(latencies, 99);
    const max = latencies.length > 0 ? latencies[latencies.length - 1] : 0;
    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    const errorRate = stats.totalMessages > 0 ? stats.failedMessages / stats.totalMessages : 0;
    const connectionRate = stats.successfulConnections > 0 ? stats.successfulConnections / (stats.successfulConnections + stats.failedConnections) : 0;
    const throughput = stats.totalMessages > 0 ? stats.totalMessages / 30 : 0; // per second

    const cpuUsage = this.getCpuUsage();
    const memoryUsage = this.getMemoryUsage();

    const analysis = {
      timestamp: new Date().toISOString(),
      connections: {
        target: this.state.phase.targetConnections,
        established: connectedCount,
        successful: stats.successfulConnections,
        failed: stats.failedConnections,
        rate: connectionRate
      },
      messages: {
        total: stats.totalMessages,
        successful: stats.successfulMessages,
        failed: stats.failedMessages,
        errorRate,
        throughput
      },
      latency: {
        p50, p95, p99, max, avg
      },
      resources: {
        cpu: cpuUsage,
        memory: memoryUsage,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      health: {
        degrading: false,
        breaking: false
      }
    };

    return analysis;
  }

  shouldDetectDegradation(analysis) {
    const phases = this.state.globalMetrics.phases;
    if (phases.length < 2) return false;

    const prev = phases[phases.length - 1].analysis;

    // Check latency increase
    const latencyIncrease = (analysis.latency.avg - prev.latency.avg) / prev.latency.avg;
    if (latencyIncrease > this.config.degradationThreshold) {
      return true;
    }

    // Check error rate increase
    const errorIncrease = analysis.messages.errorRate - prev.messages.errorRate;
    if (errorIncrease > 0.05) {
      return true;
    }

    // Check CPU/memory trend
    if (analysis.resources.memory.heapUsed > this.config.memoryThreshold * 0.8) {
      return true;
    }

    if (analysis.resources.cpu > this.config.cpuThreshold * 0.8) {
      return true;
    }

    return false;
  }

  shouldStopTest(analysis) {
    // Check error rate
    if (analysis.messages.errorRate > this.config.errorThreshold) {
      return true;
    }

    // Check connection failure rate
    if (analysis.connections.rate < 0.9) {
      return true;
    }

    // Check memory
    if (analysis.resources.memory.heapUsed > this.config.memoryThreshold) {
      return true;
    }

    // Check CPU
    if (analysis.resources.cpu > this.config.cpuThreshold) {
      return true;
    }

    // Check latency explosion
    if (analysis.latency.p99 > 5000) { // 5 seconds
      return true;
    }

    return false;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  getCpuUsage() {
    const totalMemory = os.totalmem();
    const freemem = os.freemem();
    const usedMemory = totalMemory - freemem;
    const cpuUsagePercent = (usedMemory / totalMemory) * 100;
    return cpuUsagePercent;
  }

  getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      total: Math.round((mem.heapUsed + mem.external) / 1024 / 1024)
    };
  }

  startResourceMonitoring() {
    const interval = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      const cpuUsage = this.getCpuUsage();

      this.state.globalMetrics.systemResources.memoryUsage.push(memoryUsage);
      this.state.globalMetrics.systemResources.cpuUsage.push(cpuUsage);

      if (memoryUsage.total > this.state.globalMetrics.systemResources.peakMemory) {
        this.state.globalMetrics.systemResources.peakMemory = memoryUsage.total;
      }
      if (cpuUsage > this.state.globalMetrics.systemResources.peakCpu) {
        this.state.globalMetrics.systemResources.peakCpu = cpuUsage;
      }
    }, 5000); // Every 5 seconds

    this.resourceMonitoringInterval = interval;
  }

  printConfiguration() {
    console.log('Configuration:');
    console.log(`  Start Connections: ${this.config.startConnections}`);
    console.log(`  Increment: +${this.config.incrementConnections} every ${this.config.incrementInterval / 1000}s`);
    console.log(`  Max Connections: ${this.config.maxConnections}`);
    console.log(`  Server: ${this.config.serverUrl}`);
    console.log(`  Error Threshold: ${(this.config.errorThreshold * 100).toFixed(1)}%`);
    console.log(`  Memory Threshold: ${this.config.memoryThreshold}MB`);
    console.log(`  CPU Threshold: ${this.config.cpuThreshold}%`);
    console.log(`  Degradation Threshold: ${(this.config.degradationThreshold * 100).toFixed(1)}% latency increase\n`);
  }

  printPhaseResults(analysis) {
    const mem = analysis.resources.memory;
    const conn = analysis.connections;
    const msg = analysis.messages;
    const lat = analysis.latency;

    console.log(`
  Connections: ${conn.established}/${conn.target} (${(conn.rate * 100).toFixed(1)}%)
  Messages:    ${msg.successful}/${msg.total} | Error Rate: ${(msg.errorRate * 100).toFixed(2)}% | Throughput: ${msg.throughput.toFixed(2)} msg/s
  Latency:     P50=${lat.p50.toFixed(2)}ms | P95=${lat.p95.toFixed(2)}ms | P99=${lat.p99.toFixed(2)}ms | Max=${lat.max.toFixed(2)}ms
  Memory:      Heap=${mem.heapUsed}MB/${mem.heapTotal}MB | RSS=${mem.rss}MB | Total=${mem.total}MB
  CPU Usage:   ${analysis.resources.cpu.toFixed(1)}%
    `);
  }

  async cleanup() {
    console.log('\n[Cleanup] Closing connections...');

    // Close all connections
    for (const client of this.state.currentConnections) {
      if (client && client.ws && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.close();
        } catch (err) {
          // Ignore
        }
      }
    }

    // Stop resource monitoring
    if (this.resourceMonitoringInterval) {
      clearInterval(this.resourceMonitoringInterval);
    }

    // Wait for graceful shutdown
    await this.sleep(2000);

    console.log('[Cleanup] Complete');
  }

  generateReport() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        STRESS TEST REPORT                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    const phases = this.state.globalMetrics.phases;
    if (phases.length === 0) {
      console.log('No phases completed');
      return;
    }

    // Summary
    console.log('SUMMARY:');
    console.log(`  Phases Completed: ${phases.length}`);
    console.log(`  Max Connections Tested: ${Math.max(...phases.map(p => p.connections))}`);
    console.log(`  Peak Memory: ${this.state.globalMetrics.systemResources.peakMemory}MB`);
    console.log(`  Peak CPU: ${this.state.globalMetrics.systemResources.peakCpu.toFixed(1)}%`);
    console.log(`  Total Errors: ${Object.values(this.state.globalMetrics.errors).reduce((a, b) => a + b, 0)}`);

    // Degradation Point
    if (this.state.globalMetrics.degradationPoint) {
      const dp = this.state.globalMetrics.degradationPoint;
      console.log(`\nDEGRADATION POINT:`);
      console.log(`  Phase: ${dp.phase}`);
      console.log(`  Connections: ${dp.connections}`);
      console.log(`  Latency (P99): ${dp.analysis.latency.p99.toFixed(2)}ms`);
      console.log(`  Error Rate: ${(dp.analysis.messages.errorRate * 100).toFixed(2)}%`);
      console.log(`  Memory: ${dp.analysis.resources.memory.total}MB`);
    }

    // Breaking Point
    if (this.state.globalMetrics.breakingPoint) {
      const bp = this.state.globalMetrics.breakingPoint;
      console.log(`\nBREAKING POINT:`);
      console.log(`  Phase: ${bp.phase}`);
      console.log(`  Connections: ${bp.connections}`);
      console.log(`  Latency (P99): ${bp.analysis.latency.p99.toFixed(2)}ms`);
      console.log(`  Error Rate: ${(bp.analysis.messages.errorRate * 100).toFixed(2)}%`);
      console.log(`  Memory: ${bp.analysis.resources.memory.total}MB`);
    }

    // Phase Progression
    console.log(`\nPHASE PROGRESSION:`);
    for (const phase of phases.slice(0, 10)) { // Show first 10 phases
      const a = phase.analysis;
      console.log(`  Phase ${phase.phase.toString().padStart(2)}: ${a.connections.target.toString().padStart(3)} conns | ` +
        `${(a.connections.rate * 100).toFixed(1).padStart(5)}% conn | ` +
        `${(a.messages.errorRate * 100).toFixed(2).padStart(6)}% err | ` +
        `P99=${a.latency.p99.toFixed(0).padStart(4)}ms | ` +
        `Mem=${a.resources.memory.total.toString().padStart(3)}MB`);
    }

    if (phases.length > 10) {
      console.log(`  ... and ${phases.length - 10} more phases`);
    }

    // Recommendations
    console.log(`\nRECOMMENDATIONS:`);
    const recommendations = this.generateRecommendations();
    for (const rec of recommendations) {
      console.log(`  • ${rec}`);
    }

    // Save full report
    this.saveFullReport();
  }

  generateRecommendations() {
    const recommendations = [];
    const phases = this.state.globalMetrics.phases;

    if (phases.length === 0) {
      return recommendations;
    }

    const lastPhase = phases[phases.length - 1];
    const firstPhase = phases[0];

    // Find stable configuration
    const stablePhases = phases.filter(p =>
      p.analysis.connections.rate > 0.95 &&
      p.analysis.messages.errorRate < 0.05
    );

    if (stablePhases.length > 0) {
      const maxStable = Math.max(...stablePhases.map(p => p.analysis.connections.target));
      recommendations.push(`Maximum stable concurrent connections: ${maxStable}`);
      recommendations.push(`Recommended ceiling with 20% safety margin: ${Math.floor(maxStable * 0.8)}`);
    }

    // Memory recommendations
    const peakMem = this.state.globalMetrics.systemResources.peakMemory;
    if (peakMem > 500) {
      recommendations.push(`Peak memory usage ${peakMem}MB - consider implementing connection pooling`);
    }

    // CPU recommendations
    const peakCpu = this.state.globalMetrics.systemResources.peakCpu;
    if (peakCpu > 70) {
      recommendations.push(`Peak CPU ${peakCpu.toFixed(1)}% - consider optimizing message processing`);
    }

    // Latency recommendations
    if (lastPhase.analysis.latency.p99 > 1000) {
      recommendations.push(`P99 latency ${lastPhase.analysis.latency.p99.toFixed(0)}ms exceeds 1s - implement request queuing`);
    }

    // Scaling recommendations
    if (this.state.globalMetrics.breakingPoint) {
      const breakPoint = this.state.globalMetrics.breakingPoint.connections;
      const safeMargin = Math.floor(breakPoint * 0.7);
      recommendations.push(`Horizontal scaling recommended at ${safeMargin} connections`);
    }

    // Load balancing
    if (phases.length > 5) {
      recommendations.push(`Implement load balancing across multiple server instances`);
    }

    return recommendations;
  }

  saveFullReport() {
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(this.config.reportDir, `stress-test-engineer-${timestamp}.json`);

    // Prepare data for JSON serialization
    const reportData = {
      metadata: {
        test: 'Stress Test Engineer v1.0',
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
        platform: os.platform(),
        cpuCount: os.cpus().length,
        totalMemory: Math.round(os.totalmem() / 1024 / 1024)
      },
      configuration: this.config,
      results: {
        phases: this.state.globalMetrics.phases,
        degradationPoint: this.state.globalMetrics.degradationPoint,
        breakingPoint: this.state.globalMetrics.breakingPoint,
        systemResources: this.state.globalMetrics.systemResources,
        errors: this.state.globalMetrics.errors
      },
      recommendations: this.generateRecommendations()
    };

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\nFull report saved: ${reportPath}`);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
if (require.main === module) {
  const options = {
    startConnections: 10,
    incrementConnections: 5,
    incrementInterval: 30 * 1000, // 30 seconds per spec
    maxConnections: 500,
    serverUrl: process.env.WEBSOCKET_URL || 'ws://127.0.0.1:9999',
    testDuration: 60 * 60 * 1000, // 1 hour
    errorThreshold: 0.10,
    memoryThreshold: 1024, // 1GB
    cpuThreshold: 80
  };

  // Allow override via command line
  if (process.argv.includes('--quick')) {
    options.testDuration = 5 * 60 * 1000; // 5 minutes
    options.maxConnections = 100;
  }

  if (process.argv.includes('--short')) {
    options.testDuration = 10 * 60 * 1000; // 10 minutes
    options.maxConnections = 200;
  }

  const engineer = new StressTestEngineer(options);
  engineer.start().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}

module.exports = StressTestEngineer;

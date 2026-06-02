#!/usr/bin/env node

/**
 * Quick Validation Test - 30 minute expedited stability test
 * Tests core stability patterns without waiting 24 hours
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_DURATION_MS = 30 * 60 * 1000; // 30 minutes

class QuickValidation {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.metrics = {
      startTime: new Date().toISOString(),
      endTime: null,
      totalMessages: 0,
      successCount: 0,
      failureCount: 0,
      latencies: [],
      memoryMeasurements: [],
      errors: [],
      testPhases: []
    };
    this.testActive = true;
  }

  /**
   * Connect to WebSocket
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, 30000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to WebSocket server');
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Send command
   */
  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const startTime = performance.now();
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout on ${command}`));
      }, 10000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);

            const latency = performance.now() - startTime;
            this.metrics.latencies.push(latency);
            this.metrics.totalMessages++;

            if (response.success) {
              this.metrics.successCount++;
            } else {
              this.metrics.failureCount++;
            }

            resolve({ response, latency });
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Record memory measurement
   */
  recordMemory() {
    const usage = process.memoryUsage();
    this.metrics.memoryMeasurements.push({
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss
    });
  }

  /**
   * Phase 1: Baseline stability (5 minutes)
   */
  async phase1Baseline() {
    console.log('\n[PHASE 1] Baseline Stability Test (5 minutes)');
    const phaseStart = Date.now();
    const duration = 5 * 60 * 1000;

    const phase = {
      name: 'Baseline',
      duration: duration,
      startTime: new Date().toISOString(),
      messages: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0
    };

    const phaseLatencies = [];

    while (Date.now() - phaseStart < duration && this.testActive) {
      try {
        const { latency } = await this.sendCommand('ping');
        phaseLatencies.push(latency);
        phase.messages++;
        phase.successes++;

        if (this.metrics.totalMessages % 10 === 0) {
          console.log(`  Progress: ${this.metrics.totalMessages} messages...`);
          this.recordMemory();
        }
      } catch (err) {
        phase.failures++;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (phaseLatencies.length > 0) {
      phase.avgLatency = (phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length).toFixed(2);
    }

    phase.endTime = new Date().toISOString();
    this.metrics.testPhases.push(phase);

    console.log(`  Messages: ${phase.messages}, Success: ${phase.successes}, Avg Latency: ${phase.avgLatency}ms`);
  }

  /**
   * Phase 2: Peak load simulation (10 minutes)
   */
  async phase2PeakLoad() {
    console.log('\n[PHASE 2] Peak Load Simulation (10 minutes)');
    const phaseStart = Date.now();
    const duration = 10 * 60 * 1000;

    const phase = {
      name: 'Peak Load',
      duration: duration,
      startTime: new Date().toISOString(),
      messages: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      concurrentClients: 5
    };

    const phaseLatencies = [];

    // Create a few parallel clients
    const clients = [];
    for (let i = 0; i < 5; i++) {
      const ws = new WebSocket(WS_URL);
      clients.push(new Promise(resolve => {
        ws.on('open', () => resolve(ws));
        ws.on('error', () => resolve(null));
      }));
    }

    const connectedClients = (await Promise.all(clients)).filter(c => c !== null);
    console.log(`  Created ${connectedClients.length} parallel connections`);

    let messageIndex = 0;
    while (Date.now() - phaseStart < duration && this.testActive) {
      // Send from main connection
      try {
        const { latency } = await this.sendCommand('status');
        phaseLatencies.push(latency);
        phase.messages++;
        phase.successes++;
      } catch (err) {
        phase.failures++;
      }

      // Send from parallel clients
      for (const client of connectedClients) {
        try {
          const msgId = String(this.messageId++);
          const msg = { id: msgId, command: 'ping' };

          const result = await Promise.race([
            new Promise(resolve => {
              const handler = (data) => {
                try {
                  const response = JSON.parse(data);
                  if (response.id === msgId) {
                    client.removeListener('message', handler);
                    resolve(true);
                  }
                } catch (e) {
                  // ignore
                }
              };
              client.on('message', handler);
              client.send(JSON.stringify(msg));
            }),
            new Promise(resolve => setTimeout(() => resolve(false), 5000))
          ]);

          if (result) {
            phase.successes++;
          } else {
            phase.failures++;
          }
          phase.messages++;
        } catch (err) {
          phase.failures++;
        }
      }

      if (this.metrics.totalMessages % 20 === 0) {
        console.log(`  Progress: ${this.metrics.totalMessages} total messages...`);
        this.recordMemory();
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Close parallel clients
    for (const client of connectedClients) {
      try {
        client.close();
      } catch (err) {
        // ignore
      }
    }

    if (phaseLatencies.length > 0) {
      phase.avgLatency = (phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length).toFixed(2);
    }

    phase.endTime = new Date().toISOString();
    this.metrics.testPhases.push(phase);

    console.log(`  Messages: ${phase.messages}, Success: ${phase.successes}, Avg Latency: ${phase.avgLatency}ms`);
  }

  /**
   * Phase 3: Stress recovery (10 minutes)
   */
  async phase3Recovery() {
    console.log('\n[PHASE 3] Stress Recovery (10 minutes)');
    const phaseStart = Date.now();
    const duration = 10 * 60 * 1000;

    const phase = {
      name: 'Recovery',
      duration: duration,
      startTime: new Date().toISOString(),
      messages: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      recoveryAttempts: 0
    };

    const phaseLatencies = [];

    while (Date.now() - phaseStart < duration && this.testActive) {
      try {
        const { latency } = await this.sendCommand('list_tabs');
        phaseLatencies.push(latency);
        phase.messages++;
        phase.successes++;
      } catch (err) {
        phase.failures++;
        phase.recoveryAttempts++;

        // Try to recover
        try {
          await this.sendCommand('ping');
          phase.successes++;
        } catch (e) {
          // Still recovering
        }
      }

      if (this.metrics.totalMessages % 10 === 0) {
        console.log(`  Progress: ${this.metrics.totalMessages} total messages...`);
        this.recordMemory();
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (phaseLatencies.length > 0) {
      phase.avgLatency = (phaseLatencies.reduce((a, b) => a + b, 0) / phaseLatencies.length).toFixed(2);
    }

    phase.endTime = new Date().toISOString();
    this.metrics.testPhases.push(phase);

    console.log(`  Messages: ${phase.messages}, Success: ${phase.successes}, Recovery Attempts: ${phase.recoveryAttempts}`);
  }

  /**
   * Run quick validation
   */
  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Quick Stability Validation Test (30 minutes)');
    console.log(`Start: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}`);

    try {
      await this.connect();

      // Run test phases
      await this.phase1Baseline();
      await this.phase2PeakLoad();
      await this.phase3Recovery();

      this.metrics.endTime = new Date().toISOString();
    } catch (err) {
      console.error(`Test failed: ${err.message}`);
      this.metrics.errors.push(err.message);
    } finally {
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    const memoryGrowth = this.metrics.memoryMeasurements.length > 1
      ? this.metrics.memoryMeasurements[this.metrics.memoryMeasurements.length - 1].heapUsed -
        this.metrics.memoryMeasurements[0].heapUsed
      : 0;

    const latencies = this.metrics.latencies;
    const latencySorted = latencies.sort((a, b) => a - b);

    return {
      testName: 'Quick Stability Validation',
      timestamps: {
        start: this.metrics.startTime,
        end: this.metrics.endTime
      },
      messages: {
        total: this.metrics.totalMessages,
        success: this.metrics.successCount,
        failure: this.metrics.failureCount,
        successRate: this.metrics.totalMessages > 0
          ? ((this.metrics.successCount / this.metrics.totalMessages) * 100).toFixed(2)
          : 0
      },
      latency: {
        min: latencies.length > 0 ? Math.min(...latencies).toFixed(2) : 0,
        max: latencies.length > 0 ? Math.max(...latencies).toFixed(2) : 0,
        avg: latencies.length > 0
          ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)
          : 0,
        p99: latencies.length > 0
          ? latencySorted[Math.floor(latencies.length * 0.99)].toFixed(2)
          : 0
      },
      memory: {
        initialHeapMB: this.metrics.memoryMeasurements.length > 0
          ? (this.metrics.memoryMeasurements[0].heapUsed / 1024 / 1024).toFixed(2)
          : 0,
        finalHeapMB: this.metrics.memoryMeasurements.length > 0
          ? (this.metrics.memoryMeasurements[this.metrics.memoryMeasurements.length - 1].heapUsed / 1024 / 1024).toFixed(2)
          : 0,
        growthMB: (memoryGrowth / 1024 / 1024).toFixed(2),
        measurements: this.metrics.memoryMeasurements.length
      },
      phases: this.metrics.testPhases,
      errors: this.metrics.errors.length,
      passFailCriteria: {
        memoryStable: Math.abs(memoryGrowth / 1024 / 1024) < 5,
        latencyAcceptable: latencies.length > 0
          ? latencySorted[Math.floor(latencies.length * 0.99)] < 10
          : false,
        reliabilityHigh: this.metrics.totalMessages > 0
          ? (this.metrics.successCount / this.metrics.totalMessages) >= 0.95
          : false
      }
    };
  }

  /**
   * Save report
   */
  saveReport(directory) {
    const report = this.generateReport();
    const timestamp = Date.now();
    const reportPath = path.join(directory, `quick-validation-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved to ${reportPath}`);

    return reportPath;
  }

  /**
   * Print summary
   */
  printSummary() {
    const report = this.generateReport();

    console.log(`\n${'='.repeat(60)}`);
    console.log('Quick Validation Test Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Messages: ${report.messages.total}`);
    console.log(`Success Rate: ${report.messages.successRate}%`);
    console.log(`Avg Latency: ${report.latency.avg}ms`);
    console.log(`P99 Latency: ${report.latency.p99}ms`);
    console.log(`Memory Growth: ${report.memory.growthMB}MB`);
    console.log(`Test Phases: ${report.phases.length}`);
    console.log(`Status: ${report.passFailCriteria.memoryStable && report.passFailCriteria.reliabilityHigh ? 'PASS' : 'CHECK'}`);
    console.log(`${'='.repeat(60)}\n`);
  }
}

// Run test
if (require.main === module) {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const test = new QuickValidation();

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    test.testActive = false;
  });

  test.run().then(() => {
    test.saveReport(resultsDir);
    test.printSummary();

    process.exit(0);
  }).catch(err => {
    console.error(`Test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { QuickValidation };

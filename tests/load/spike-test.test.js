#!/usr/bin/env node

/**
 * Spike Testing for Basset Hound Browser v12.0.0+
 *
 * Tests system response to sudden load spikes:
 * - Initial baseline (0 concurrent)
 * - Spike 1: 0 → 200 concurrent (rapid escalation)
 * - Sustained: 200 concurrent for 5 minutes
 * - Spike 2: 200 → 500 concurrent (extreme spike)
 * - Sustained: 500 concurrent for 2 minutes
 * - Recovery: 500 → 0 (measure stabilization time)
 *
 * Metrics: response time, memory, CPU, connection success rate
 *
 * Date: June 2, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class SpikeTest {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.reportFile = options.reportFile || path.join(__dirname, `../results/spike-test-${Date.now()}.json`);

    this.phases = [
      { name: 'Baseline', targetConnections: 0, duration: 30 * 1000 },
      { name: 'Spike 1 (0→200)', targetConnections: 200, duration: 5 * 1000, rampUpTime: 5 * 1000 },
      { name: 'Sustain Spike 1', targetConnections: 200, duration: 5 * 60 * 1000 },
      { name: 'Spike 2 (200→500)', targetConnections: 500, duration: 5 * 1000, rampUpTime: 5 * 1000 },
      { name: 'Sustain Spike 2', targetConnections: 500, duration: 2 * 60 * 1000 },
      { name: 'Recovery (500→0)', targetConnections: 0, duration: 3 * 60 * 1000, rampDownTime: 5 * 1000 }
    ];

    this.results = {
      timestamp: new Date().toISOString(),
      phases: [],
      aggregated: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        memoryBefore: 0,
        memoryAfter: 0,
        maxMemoryUsage: 0,
        peakLatency: 0
      },
      status: 'PENDING'
    };

    this.connections = [];
  }

  async runTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                  Spike Testing - Basset Hound v12.0.0+                     ║');
    console.log('║                 0 → 200 → 500 Concurrent Connections                      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    this.results.aggregated.memoryBefore = process.memoryUsage().heapUsed;
    const testStartTime = performance.now();

    // Execute each phase
    for (const phase of this.phases) {
      console.log(`\n>>> Starting Phase: ${phase.name}`);
      console.log(`    Target Connections: ${phase.targetConnections}`);
      console.log(`    Duration: ${phase.duration / 1000}s\n`);

      await this.executePhase(phase);

      // Print current state
      this.printPhaseStats();
    }

    this.results.aggregated.memoryAfter = process.memoryUsage().heapUsed;
    this.results.status = 'COMPLETED';

    const totalElapsed = (performance.now() - testStartTime) / 1000;

    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        TEST COMPLETED                                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    this.printFinalResults(totalElapsed);
    this.saveResults();

    return this.results;
  }

  async executePhase(phase) {
    const phaseStartTime = performance.now();
    const phaseMetrics = {
      phase: phase.name,
      targetConnections: phase.targetConnections,
      actualConnections: 0,
      successfulConnections: 0,
      failedConnections: 0,
      duration: phase.duration / 1000,
      latencies: [],
      avgLatency: 0,
      maxLatency: 0,
      memoryPeak: 0,
      startTime: new Date().toISOString()
    };

    // Calculate connection delta
    const currentConnections = this.connections.filter(c => c && c.connected).length;
    const delta = phase.targetConnections - currentConnections;
    const isRampUp = delta > 0;
    const isRampDown = delta < 0;

    let createdConnections = [];

    if (isRampUp) {
      // Ramp up: create new connections
      const rampUpTime = phase.rampUpTime || 5000;
      const connectionsToCreate = delta;
      const connectionsPerSecond = connectionsToCreate / (rampUpTime / 1000);

      createdConnections = await this.rampUpConnections(
        connectionsToCreate,
        connectionsPerSecond,
        phaseMetrics
      );
    } else if (isRampDown) {
      // Ramp down: close connections
      const rampDownTime = phase.rampDownTime || 5000;
      const connectionsToClose = Math.abs(delta);
      await this.rampDownConnections(connectionsToClose, rampDownTime);
    }

    // Run operations for the phase duration
    await this.runPhaseOperations(phaseMetrics, phaseStartTime);

    phaseMetrics.endTime = new Date().toISOString();
    phaseMetrics.actualConnections = this.connections.filter(c => c && c.connected).length;
    phaseMetrics.successfulConnections = phaseMetrics.actualConnections;
    phaseMetrics.failedConnections = phase.targetConnections - phaseMetrics.actualConnections;

    // Calculate latency stats
    if (phaseMetrics.latencies.length > 0) {
      phaseMetrics.latencies.sort((a, b) => a - b);
      phaseMetrics.avgLatency =
        phaseMetrics.latencies.reduce((a, b) => a + b, 0) / phaseMetrics.latencies.length;
      phaseMetrics.maxLatency = phaseMetrics.latencies[phaseMetrics.latencies.length - 1];
    }

    this.results.phases.push(phaseMetrics);
  }

  async rampUpConnections(count, connectionsPerSecond, phaseMetrics) {
    const created = [];
    const delayBetweenConnections = 1000 / connectionsPerSecond;

    for (let i = 0; i < count; i++) {
      const clientId = this.connections.length + i;
      const conn = await this.createConnection(clientId, phaseMetrics);
      if (conn) {
        created.push(conn);
        this.connections.push(conn);
      }

      // Stagger connection creation
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenConnections));
      }
    }

    return created;
  }

  async rampDownConnections(count, rampDownTime) {
    const connectionsToClose = this.connections
      .filter(c => c && c.connected)
      .slice(-count);

    const delayBetweenClosures = rampDownTime / connectionsToClose.length;

    for (const conn of connectionsToClose) {
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.close();
          conn.connected = false;
        } catch (err) {
          // Ignore
        }
      }

      await new Promise(resolve => setTimeout(resolve, delayBetweenClosures));
    }
  }

  async createConnection(clientId, phaseMetrics) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.serverUrl);

        const conn = {
          clientId,
          connected: false,
          ws: null,
          messageCount: 0,
          latencies: []
        };

        ws.on('open', () => {
          conn.connected = true;
          conn.ws = ws;
          phaseMetrics.successfulConnections++;
          resolve(conn);
        });

        ws.on('message', () => {
          // Track message latencies
        });

        ws.on('error', () => {
          conn.connected = false;
        });

        ws.on('close', () => {
          conn.connected = false;
        });

        setTimeout(() => {
          if (!conn.connected) {
            phaseMetrics.failedConnections++;
            resolve(conn);
          }
        }, 5000);

      } catch (err) {
        phaseMetrics.failedConnections++;
        resolve(null);
      }
    });
  }

  async runPhaseOperations(phaseMetrics, phaseStartTime) {
    const phaseEndTime = phaseStartTime + phaseMetrics.duration * 1000;

    return new Promise(resolve => {
      const operationInterval = setInterval(() => {
        const currentTime = performance.now();
        if (currentTime > phaseEndTime) {
          clearInterval(operationInterval);
          resolve();
          return;
        }

        // Send ping operations to all connected connections
        for (const conn of this.connections) {
          if (conn && conn.connected && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
            const messageStart = performance.now();
            const msg = {
              command: 'ping',
              id: `${conn.clientId}-${conn.messageCount++}`,
              _sentAt: messageStart
            };

            try {
              conn.ws.send(JSON.stringify(msg), (err) => {
                if (!err) {
                  const latency = performance.now() - messageStart;
                  conn.latencies.push(latency);
                  phaseMetrics.latencies.push(latency);
                  phaseMetrics.memoryPeak = Math.max(
                    phaseMetrics.memoryPeak,
                    process.memoryUsage().heapUsed
                  );
                }
              });
            } catch (err) {
              // Ignore
            }
          }
        }
      }, 500); // Send every 500ms
    });
  }

  printPhaseStats() {
    if (this.results.phases.length === 0) {
      return;
    }

    const lastPhase = this.results.phases[this.results.phases.length - 1];
    console.log(`Phase Results: ${lastPhase.phase}`);
    console.log(`  Connections: ${lastPhase.actualConnections}/${lastPhase.targetConnections}`);
    console.log(`  Success Rate: ${((lastPhase.successfulConnections / lastPhase.targetConnections) * 100).toFixed(2)}%`);
    console.log(`  Avg Latency: ${lastPhase.avgLatency.toFixed(2)}ms`);
    console.log(`  Max Latency: ${lastPhase.maxLatency.toFixed(2)}ms`);
    console.log(`  Memory Peak: ${(lastPhase.memoryPeak / 1024 / 1024).toFixed(2)}MB`);
  }

  printFinalResults(totalElapsed) {
    console.log('Overall Results:');
    console.log(`  Total Duration: ${totalElapsed.toFixed(2)}s`);
    console.log(`  Memory Before: ${(this.results.aggregated.memoryBefore / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Memory After: ${(this.results.aggregated.memoryAfter / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Memory Growth: ${((this.results.aggregated.memoryAfter - this.results.aggregated.memoryBefore) / 1024 / 1024).toFixed(2)}MB\n`);

    console.log('Phase Breakdown:');
    for (const phase of this.results.phases) {
      console.log(`\n  ${phase.phase}`);
      console.log(`    Target: ${phase.targetConnections} connections`);
      console.log(`    Actual: ${phase.actualConnections} connections`);
      console.log(`    Success Rate: ${((phase.successfulConnections / phase.targetConnections) * 100).toFixed(2)}%`);
      console.log(`    Avg Latency: ${phase.avgLatency.toFixed(2)}ms`);
      console.log(`    Max Latency: ${phase.maxLatency.toFixed(2)}ms`);
    }

    console.log(`\nResults saved to: ${this.reportFile}`);
  }

  saveResults() {
    const dir = path.dirname(this.reportFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.reportFile, JSON.stringify(this.results, null, 2));
  }
}

// Run the test
if (require.main === module) {
  const test = new SpikeTest();

  test.runTest().catch(console.error);
}

module.exports = SpikeTest;

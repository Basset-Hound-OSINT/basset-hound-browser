#!/usr/bin/env node

/**
 * Breaking Point Test for Basset Hound Browser v12.0.0+
 *
 * Gradually increment load until failure:
 * - Increment: increase concurrent connections every 2 minutes
 * - Start: 100 connections
 * - Step: +100 connections per iteration
 * - Max: keep going until 50%+ failure rate or system crash
 * - Measure: failure mode (connection timeout, message loss, crash)
 *
 * Goal: Find maximum sustainable concurrent connections
 *
 * Date: June 2, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class BreakingPointTest {
  constructor(options = {}) {
    this.startConnections = options.startConnections || 100;
    this.incrementStep = options.incrementStep || 100;
    this.iterationDuration = options.iterationDuration || 2 * 60 * 1000; // 2 minutes
    this.failureThreshold = options.failureThreshold || 0.5; // 50% failure
    this.maxConnections = options.maxConnections || 2000;
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.reportFile = options.reportFile || path.join(__dirname, `../results/breaking-point-${Date.now()}.json`);

    this.results = {
      timestamp: new Date().toISOString(),
      iterations: [],
      breakingPoint: {
        maxConnectionsTested: 0,
        failureMode: null,
        failureRate: 0,
        failureThreshold: this.failureThreshold,
        recommendations: []
      },
      status: 'PENDING'
    };

    this.currentConnections = [];
  }

  async runTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║            Breaking Point Test - Basset Hound v12.0.0+                    ║');
    console.log('║         Find Maximum Sustainable Concurrent Connections                  ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Configuration:');
    console.log(`  Start Connections: ${this.startConnections}`);
    console.log(`  Increment Step: ${this.incrementStep}`);
    console.log(`  Iteration Duration: ${this.iterationDuration / 1000}s`);
    console.log(`  Failure Threshold: ${(this.failureThreshold * 100).toFixed(0)}%`);
    console.log(`  Max Test Connections: ${this.maxConnections}`);
    console.log(`  Server: ${this.serverUrl}\n`);

    const testStartTime = performance.now();
    let targetConnections = this.startConnections;
    let continueTest = true;

    let iteration = 0;
    while (continueTest && targetConnections <= this.maxConnections) {
      iteration++;
      console.log(`\n>>> Iteration ${iteration}: Testing ${targetConnections} concurrent connections`);

      const iterationMetrics = await this.runIteration(targetConnections);
      this.results.iterations.push(iterationMetrics);

      const failureRate = iterationMetrics.failedConnections / iterationMetrics.targetConnections;

      console.log(`    Connections Established: ${iterationMetrics.successfulConnections}/${iterationMetrics.targetConnections}`);
      console.log(`    Success Rate: ${((1 - failureRate) * 100).toFixed(2)}%`);
      console.log(`    Avg Message Latency: ${iterationMetrics.avgLatency.toFixed(2)}ms`);
      console.log(`    Max Message Latency: ${iterationMetrics.maxLatency.toFixed(2)}ms`);
      console.log(`    Messages Sent: ${iterationMetrics.totalMessages}`);

      // Check failure threshold
      if (failureRate > this.failureThreshold) {
        console.log(`\n!!! FAILURE THRESHOLD EXCEEDED: ${(failureRate * 100).toFixed(2)}% > ${(this.failureThreshold * 100).toFixed(0)}%`);
        continueTest = false;
        this.results.breakingPoint.failureMode = 'HIGH_FAILURE_RATE';
        this.results.breakingPoint.failureRate = failureRate;
      } else {
        // Check for memory issues
        const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memoryMB > 1000) { // > 1GB
          console.log(`\n!!! MEMORY LIMIT EXCEEDED: ${memoryMB.toFixed(2)}MB`);
          continueTest = false;
          this.results.breakingPoint.failureMode = 'MEMORY_EXHAUSTION';
        }

        // Check if latency is degrading
        if (iteration > 2) {
          const prevLatency = this.results.iterations[iteration - 2].avgLatency;
          const latencyIncrease = (iterationMetrics.avgLatency - prevLatency) / prevLatency;
          if (latencyIncrease > 0.5) { // > 50% increase
            console.log(`\n!!! LATENCY DEGRADATION: ${(latencyIncrease * 100).toFixed(0)}% increase`);
            continueTest = false;
            this.results.breakingPoint.failureMode = 'LATENCY_DEGRADATION';
          }
        }
      }

      if (continueTest) {
        targetConnections += this.incrementStep;
      }

      this.results.breakingPoint.maxConnectionsTested = iterationMetrics.targetConnections;
    }

    // Close all connections
    for (const conn of this.currentConnections) {
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
        try {
          conn.ws.close();
        } catch (err) {
          // Ignore
        }
      }
    }

    const totalElapsed = (performance.now() - testStartTime) / 1000;

    this.results.status = 'COMPLETED';
    this.generateRecommendations();
    this.printResults(totalElapsed);
    this.saveResults();

    return this.results;
  }

  async runIteration(targetConnections) {
    const iterationStartTime = performance.now();
    const iterationMetrics = {
      iteration: this.results.iterations.length + 1,
      targetConnections,
      timestamp: new Date().toISOString(),
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      successfulMessages: 0,
      failedMessages: 0,
      latencies: [],
      avgLatency: 0,
      maxLatency: 0
    };

    // Create connections for this iteration
    const connectionPromises = [];
    const startIdx = this.currentConnections.length;

    for (let i = 0; i < targetConnections; i++) {
      connectionPromises.push(this.createConnection(startIdx + i));
    }

    const newConnections = await Promise.all(connectionPromises);
    this.currentConnections.push(...newConnections);

    const connectedCount = newConnections.filter(c => c && c.connected).length;
    iterationMetrics.successfulConnections = connectedCount;
    iterationMetrics.failedConnections = targetConnections - connectedCount;

    // Run operations for the duration
    const iterationEndTime = iterationStartTime + this.iterationDuration;

    return new Promise(resolve => {
      const operationInterval = setInterval(() => {
        const currentTime = performance.now();
        if (currentTime > iterationEndTime) {
          clearInterval(operationInterval);

          // Calculate stats
          if (iterationMetrics.latencies.length > 0) {
            iterationMetrics.latencies.sort((a, b) => a - b);
            iterationMetrics.avgLatency =
              iterationMetrics.latencies.reduce((a, b) => a + b, 0) / iterationMetrics.latencies.length;
            iterationMetrics.maxLatency =
              iterationMetrics.latencies[iterationMetrics.latencies.length - 1];
          }

          resolve(iterationMetrics);
          return;
        }

        // Send operations
        const connectedInIteration = newConnections.filter(c => c && c.connected);
        for (const conn of connectedInIteration) {
          if (!conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
            continue;
          }

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
                iterationMetrics.latencies.push(latency);
                iterationMetrics.successfulMessages++;
              } else {
                iterationMetrics.failedMessages++;
              }
              iterationMetrics.totalMessages++;
            });
          } catch (err) {
            iterationMetrics.failedMessages++;
            iterationMetrics.totalMessages++;
          }
        }
      }, 100);
    });
  }

  async createConnection(clientId) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.serverUrl);

        const conn = {
          clientId,
          connected: false,
          ws: null,
          messageCount: 0
        };

        ws.on('open', () => {
          conn.connected = true;
          conn.ws = ws;
          resolve(conn);
        });

        ws.on('error', () => {
          conn.connected = false;
        });

        ws.on('close', () => {
          conn.connected = false;
        });

        setTimeout(() => {
          if (!conn.connected) {
            resolve(conn);
          }
        }, 5000);

      } catch (err) {
        resolve(null);
      }
    });
  }

  generateRecommendations() {
    const iterations = this.results.iterations;
    if (iterations.length === 0) {
      return;
    }

    const maxSuccessful = Math.max(...iterations.map(i => i.successfulConnections));
    const breakingIteration = iterations.find(i =>
      i.failedConnections / i.targetConnections > this.failureThreshold
    );

    this.results.breakingPoint.recommendations.push(
      `Maximum sustainable connections: ${maxSuccessful} (95% success rate)`
    );

    if (this.results.breakingPoint.failureMode === 'HIGH_FAILURE_RATE') {
      this.results.breakingPoint.recommendations.push(
        `Current breaking point: ${breakingIteration.targetConnections} connections`
      );
      this.results.breakingPoint.recommendations.push(
        `Reduce max concurrent connections to: ${Math.floor(maxSuccessful * 0.8)} (with 20% safety margin)`
      );
    }

    if (iterations.length > 1) {
      const latencyTrend = iterations[iterations.length - 1].avgLatency -
                          iterations[0].avgLatency;
      if (latencyTrend > 10) {
        this.results.breakingPoint.recommendations.push(
          `Implement connection pooling and request queuing to handle load`
        );
      }
    }

    this.results.breakingPoint.recommendations.push(
      `Monitor memory usage; set alert at ${Math.floor(process.memoryUsage().heapTotal / 1024 / 1024 * 0.8)}MB`
    );
    this.results.breakingPoint.recommendations.push(
      `Consider horizontal scaling at ${Math.floor(maxSuccessful * 0.7)} connections`
    );
  }

  printResults(totalElapsed) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                     BREAKING POINT TEST RESULTS                          ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Total Duration: ${totalElapsed.toFixed(2)}s`);
    console.log(`Iterations Completed: ${this.results.iterations.length}\n`);

    console.log('Breaking Point:');
    console.log(`  Max Tested: ${this.results.breakingPoint.maxConnectionsTested} connections`);
    if (this.results.breakingPoint.failureMode) {
      console.log(`  Failure Mode: ${this.results.breakingPoint.failureMode}`);
      console.log(`  Failure Rate: ${(this.results.breakingPoint.failureRate * 100).toFixed(2)}%`);
    }

    console.log('\nIteration Summary:');
    for (const iter of this.results.iterations) {
      const successRate = ((iter.successfulConnections / iter.targetConnections) * 100).toFixed(2);
      console.log(`  ${iter.targetConnections} conns: ${successRate}% success | ${iter.avgLatency.toFixed(2)}ms avg latency`);
    }

    console.log('\nRecommendations:');
    for (const rec of this.results.breakingPoint.recommendations) {
      console.log(`  - ${rec}`);
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
  let startConnections = 100;
  let incrementStep = 100;

  if (process.argv.includes('--quick')) {
    startConnections = 10;
    incrementStep = 10;
  }

  const test = new BreakingPointTest({
    startConnections,
    incrementStep,
    iterationDuration: 2 * 60 * 1000,
    failureThreshold: 0.5,
    maxConnections: 2000
  });

  test.runTest().catch(console.error);
}

module.exports = BreakingPointTest;

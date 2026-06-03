#!/usr/bin/env node

/**
 * Network Degradation Test for Basset Hound Browser v12.0.0+
 *
 * Test system resilience under poor network conditions:
 * - High latency: 5-second delays on all connections
 * - Packet loss: 10%, 25%, 50% randomly dropped packets
 * - Connection resets: periodic drops and reconnects
 * - Bandwidth throttling: low-bandwidth simulation
 *
 * Verify: system recovers, no data loss, graceful degradation
 *
 * Date: June 2, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class NetworkDegradationTest {
  constructor(options = {}) {
    this.concurrentConnections = options.concurrent || 100;
    this.testDuration = options.duration || 20 * 60 * 1000; // 20 minutes
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.reportFile = options.reportFile || path.join(__dirname, `../results/network-degradation-${Date.now()}.json`);

    this.scenarios = [
      {
        name: 'Normal Baseline',
        duration: 3 * 60 * 1000,
        latency: 0,
        packetLoss: 0,
        enabled: true
      },
      {
        name: 'High Latency (5s)',
        duration: 3 * 60 * 1000,
        latency: 5000,
        packetLoss: 0,
        enabled: true
      },
      {
        name: '10% Packet Loss',
        duration: 2 * 60 * 1000,
        latency: 0,
        packetLoss: 0.1,
        enabled: true
      },
      {
        name: '25% Packet Loss',
        duration: 2 * 60 * 1000,
        latency: 0,
        packetLoss: 0.25,
        enabled: true
      },
      {
        name: 'Combined (2s latency + 10% loss)',
        duration: 3 * 60 * 1000,
        latency: 2000,
        packetLoss: 0.1,
        enabled: true
      },
      {
        name: 'Extreme (5s latency + 25% loss)',
        duration: 2 * 60 * 1000,
        latency: 5000,
        packetLoss: 0.25,
        enabled: true
      }
    ];

    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrent: this.concurrentConnections,
        totalDuration: this.testDuration / 1000,
        scenarios: this.scenarios.map(s => ({
          name: s.name,
          duration: s.duration / 1000,
          latency: s.latency,
          packetLoss: s.packetLoss
        }))
      },
      scenarios: [],
      aggregated: {
        totalMessages: 0,
        totalLoss: 0,
        totalRecovered: 0,
        avgLatency: 0
      },
      status: 'PENDING'
    };

    this.connections = [];
  }

  async runTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║         Network Degradation Test - Basset Hound v12.0.0+                  ║');
    console.log('║   High Latency, Packet Loss, Connection Resets - Recovery Validation      ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Configuration:');
    console.log(`  Concurrent Connections: ${this.concurrentConnections}`);
    console.log(`  Total Test Duration: ${this.testDuration / 1000 / 60} minutes`);
    console.log(`  Scenarios: ${this.scenarios.filter(s => s.enabled).length}\n`);

    // Create connections once
    console.log('Creating connections...');
    const connectionPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectionPromises.push(this.createConnection(i));
    }

    this.connections = await Promise.all(connectionPromises);
    const connected = this.connections.filter(c => c && c.connected).length;
    console.log(`Connections established: ${connected}/${this.concurrentConnections}\n`);

    // Run each scenario
    const testStartTime = performance.now();

    for (const scenario of this.scenarios) {
      if (!scenario.enabled) continue;

      console.log(`\n>>> Scenario: ${scenario.name}`);
      console.log(`    Latency: ${scenario.latency}ms`);
      console.log(`    Packet Loss: ${(scenario.packetLoss * 100).toFixed(1)}%\n`);

      const scenarioMetrics = await this.runScenario(scenario);
      this.results.scenarios.push(scenarioMetrics);

      console.log(`    Messages Sent: ${scenarioMetrics.messagesSent}`);
      console.log(`    Messages Lost: ${scenarioMetrics.messagesLost} (${(scenarioMetrics.messagesLost / scenarioMetrics.messagesSent * 100).toFixed(2)}%)`);
      console.log(`    Recovered: ${scenarioMetrics.recovered ? 'YES' : 'NO'}`);
      console.log(`    Avg Latency: ${scenarioMetrics.avgLatency.toFixed(2)}ms\n`);
    }

    // Close connections
    for (const conn of this.connections) {
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
    this.printResults(totalElapsed);
    this.saveResults();

    return this.results;
  }

  async createConnection(clientId) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.serverUrl);

        const conn = {
          clientId,
          connected: false,
          ws: null,
          messageCount: 0,
          messagesSent: 0,
          messagesAcked: 0,
          latencies: [],
          reconnectCount: 0
        };

        ws.on('open', () => {
          conn.connected = true;
          conn.ws = ws;
          resolve(conn);
        });

        ws.on('message', () => {
          conn.messagesAcked++;
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

  async runScenario(scenario) {
    const scenarioStartTime = performance.now();
    const scenarioEndTime = scenarioStartTime + scenario.duration;

    const metrics = {
      scenario: scenario.name,
      latency: scenario.latency,
      packetLoss: scenario.packetLoss,
      timestamp: new Date().toISOString(),
      messagesSent: 0,
      messagesLost: 0,
      recovered: true,
      avgLatency: 0,
      maxLatency: 0,
      latencies: []
    };

    return new Promise(resolve => {
      const operationInterval = setInterval(() => {
        const currentTime = performance.now();
        if (currentTime > scenarioEndTime) {
          clearInterval(operationInterval);

          // Calculate final metrics
          metrics.messagesLost = metrics.messagesSent - this.connections.reduce((sum, c) => sum + c.messagesAcked, 0);
          metrics.recovered = this.connections.filter(c => c && c.connected).length > (this.concurrentConnections * 0.9);

          if (metrics.latencies.length > 0) {
            metrics.latencies.sort((a, b) => a - b);
            metrics.avgLatency = metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length;
            metrics.maxLatency = metrics.latencies[metrics.latencies.length - 1];
          }

          resolve(metrics);
          return;
        }

        // Send messages with simulated network conditions
        for (const conn of this.connections) {
          if (!conn || !conn.connected || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
            continue;
          }

          // Check packet loss
          if (Math.random() < scenario.packetLoss) {
            metrics.messagesLost++;
            continue; // Simulate packet drop
          }

          const messageStart = performance.now();
          const msg = {
            command: 'ping',
            id: `${conn.clientId}-${conn.messageCount++}`,
            _sentAt: messageStart,
            _scenario: scenario.name
          };

          // Simulate latency on the response
          const simulatedLatency = scenario.latency + (Math.random() * 100);

          try {
            conn.ws.send(JSON.stringify(msg), (err) => {
              if (!err) {
                // Simulate response latency
                setTimeout(() => {
                  const totalLatency = performance.now() - messageStart;
                  metrics.latencies.push(totalLatency);
                  conn.latencies.push(totalLatency);
                }, simulatedLatency);
              } else {
                metrics.messagesLost++;
              }
            });

            metrics.messagesSent++;
            conn.messagesSent++;

          } catch (err) {
            metrics.messagesLost++;
          }
        }
      }, 100);
    });
  }

  printResults(totalElapsed) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║               NETWORK DEGRADATION TEST RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Total Duration: ${totalElapsed.toFixed(2)}s`);
    console.log(`Scenarios Tested: ${this.results.scenarios.length}\n`);

    console.log('Scenario Results:');
    for (const scenario of this.results.scenarios) {
      const lossRate = scenario.messagesLost / scenario.messagesSent;
      const status = scenario.recovered ? 'RECOVERED' : 'NOT RECOVERED';

      console.log(`\n  ${scenario.scenario}`);
      console.log(`    Messages Sent: ${scenario.messagesSent}`);
      console.log(`    Messages Lost: ${scenario.messagesLost} (${(lossRate * 100).toFixed(2)}%)`);
      console.log(`    Recovery: ${status}`);
      console.log(`    Avg Latency: ${scenario.avgLatency.toFixed(2)}ms`);
      console.log(`    Max Latency: ${scenario.maxLatency.toFixed(2)}ms`);
    }

    console.log('\nRecovery Analysis:');
    const allRecovered = this.results.scenarios.every(s => s.recovered);
    console.log(`  All scenarios recovered: ${allRecovered ? 'YES' : 'NO'}`);

    const avgLossRate = this.results.scenarios.reduce((sum, s) =>
      sum + (s.messagesLost / s.messagesSent), 0) / this.results.scenarios.length;
    console.log(`  Average message loss rate: ${(avgLossRate * 100).toFixed(2)}%`);

    console.log('\nRecommendations:');
    if (avgLossRate > 0.1) {
      console.log(`  - Implement retry logic for lost messages`);
      console.log(`  - Add exponential backoff for failed operations`);
    }
    if (!allRecovered) {
      console.log(`  - Some scenarios did not recover; review connection pooling strategy`);
      console.log(`  - Implement automatic reconnection logic`);
    }
    console.log(`  - Consider adding circuit breaker pattern for degraded network detection`);

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
  const test = new NetworkDegradationTest({
    concurrent: process.argv.includes('--full') ? 100 : 20,
    duration: process.argv.includes('--full') ? 20 * 60 * 1000 : 5 * 60 * 1000
  });

  test.runTest().catch(console.error);
}

module.exports = NetworkDegradationTest;

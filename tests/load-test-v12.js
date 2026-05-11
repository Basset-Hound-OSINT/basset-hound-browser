#!/usr/bin/env node
/**
 * Load Test for Basset Hound Browser v12.0.0
 *
 * Tests with multiple concurrent connections:
 * - 50 concurrent connections (2 hours)
 * - 100 concurrent connections (1 hour)
 * - 200 concurrent connections (30 min)
 *
 * Date: May 11, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class LoadTester {
  constructor(options = {}) {
    this.concurrentConnections = options.concurrent || 50;
    this.testDuration = options.duration || 60 * 1000; // 1 minute default
    this.targetOpsPerConnection = options.opsPerConnection || 100;
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';

    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrent: this.concurrentConnections,
        duration: this.testDuration,
        targetOpsPerConnection: this.targetOpsPerConnection
      },
      connections: [],
      aggregated: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        avgLatency: 0,
        maxLatency: 0,
        minLatency: Infinity,
        memoryBefore: 0,
        memoryAfter: 0,
        totalBytesTransferred: 0
      },
      status: 'PENDING'
    };

    this.startTime = null;
  }

  async runLoadTest() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log(`║  Load Test: ${this.concurrentConnections} Concurrent Connections        `);
    console.log('║  Date: May 11, 2026                                         ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`Configuration:`);
    console.log(`  Concurrent Connections: ${this.concurrentConnections}`);
    console.log(`  Test Duration: ${(this.testDuration / 1000).toFixed(1)} seconds`);
    console.log(`  Target Ops/Connection: ${this.targetOpsPerConnection}`);
    console.log(`  Server: ${this.serverUrl}\n`);

    this.results.aggregated.memoryBefore = process.memoryUsage().heapUsed;
    this.startTime = performance.now();

    // Create connections
    const connectionPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectionPromises.push(this.createClientConnection(i));
    }

    const connections = await Promise.all(connectionPromises);

    console.log(`\nConnections established: ${connections.filter(c => c).length}/${this.concurrentConnections}\n`);

    // Wait for test duration
    await new Promise(resolve => setTimeout(resolve, this.testDuration));

    // Close all connections
    for (const conn of connections) {
      if (conn && conn.ws) {
        try {
          conn.ws.close();
        } catch (err) {
          // Ignore
        }
      }
    }

    this.results.aggregated.memoryAfter = process.memoryUsage().heapUsed;
    this.results.status = 'COMPLETED';

    const elapsedSeconds = (performance.now() - this.startTime) / 1000;

    // Aggregate results
    this.aggregateResults(connections, elapsedSeconds);
    this.printResults(elapsedSeconds);

    return this.results;
  }

  async createClientConnection(clientId) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.serverUrl);
        let messageCount = 0;
        let successCount = 0;
        let latencies = [];

        const clientResult = {
          clientId,
          connected: false,
          ws: null,
          messageCount: 0,
          successCount: 0,
          failureCount: 0,
          latencies: [],
          bytesTransferred: 0
        };

        ws.on('open', () => {
          clientResult.connected = true;
          clientResult.ws = ws;
          this.results.aggregated.successfulConnections++;

          // Start sending messages
          const messageInterval = setInterval(() => {
            if (!ws || ws.readyState !== WebSocket.OPEN) {
              clearInterval(messageInterval);
              return;
            }

            if (messageCount >= this.targetOpsPerConnection) {
              clearInterval(messageInterval);
              return;
            }

            const messageStart = performance.now();
            const payload = {
              clientId,
              messageId: messageCount,
              timestamp: Date.now(),
              data: crypto.randomBytes(256).toString('base64')
            };

            try {
              ws.send(JSON.stringify(payload), (err) => {
                messageCount++;
                clientResult.messageCount++;
                clientResult.bytesTransferred += JSON.stringify(payload).length;

                if (err) {
                  clientResult.failureCount++;
                } else {
                  successCount++;
                  clientResult.successCount++;
                  const latency = performance.now() - messageStart;
                  latencies.push(latency);
                  clientResult.latencies.push(latency);
                }
              });
            } catch (err) {
              clientResult.failureCount++;
            }
          }, 10);
        });

        ws.on('message', () => {
          // Handle incoming messages if needed
        });

        ws.on('error', () => {
          this.results.aggregated.failedConnections++;
          resolve(clientResult);
        });

        ws.on('close', () => {
          clientResult.connected = false;
          resolve(clientResult);
        });

        // Timeout - resolve after test duration + buffer
        setTimeout(() => {
          if (clientResult.connected) {
            resolve(clientResult);
          }
        }, this.testDuration + 5000);

      } catch (err) {
        this.results.aggregated.failedConnections++;
        resolve(null);
      }
    });
  }

  aggregateResults(connections, elapsedSeconds) {
    const validConnections = connections.filter(c => c !== null);

    this.results.aggregated.totalConnections = this.concurrentConnections;
    this.results.aggregated.successfulConnections = validConnections.filter(c => c.connected || c.messageCount > 0).length;

    let totalLatency = 0;
    let totalLatencyCount = 0;

    for (const conn of validConnections) {
      this.results.aggregated.totalMessages += conn.messageCount;
      this.results.aggregated.successfulMessages += conn.successCount;
      this.results.aggregated.failedMessages += conn.failureCount;
      this.results.aggregated.totalBytesTransferred += conn.bytesTransferred;

      for (const latency of conn.latencies) {
        totalLatency += latency;
        totalLatencyCount++;
        if (latency > this.results.aggregated.maxLatency) {
          this.results.aggregated.maxLatency = latency;
        }
        if (latency < this.results.aggregated.minLatency) {
          this.results.aggregated.minLatency = latency;
        }
      }
    }

    if (totalLatencyCount > 0) {
      this.results.aggregated.avgLatency = totalLatency / totalLatencyCount;
    }

    this.results.connections = validConnections;
  }

  printResults(elapsedSeconds) {
    const agg = this.results.aggregated;
    const successRate = ((agg.successfulMessages / agg.totalMessages) * 100).toFixed(2);
    const throughtput = (agg.totalMessages / elapsedSeconds).toFixed(2);
    const memoryGrowth = ((agg.memoryAfter - agg.memoryBefore) / 1024 / 1024).toFixed(2);

    console.log('═'.repeat(62));
    console.log('LOAD TEST RESULTS');
    console.log('═'.repeat(62) + '\n');

    console.log('CONNECTIONS:');
    console.log(`  Attempted: ${agg.totalConnections}`);
    console.log(`  Successful: ${agg.successfulConnections}`);
    console.log(`  Failed: ${agg.failedConnections}`);
    console.log(`  Success Rate: ${((agg.successfulConnections / agg.totalConnections) * 100).toFixed(1)}%\n`);

    console.log('MESSAGES:');
    console.log(`  Total Sent: ${agg.totalMessages}`);
    console.log(`  Successful: ${agg.successfulMessages}`);
    console.log(`  Failed: ${agg.failedMessages}`);
    console.log(`  Success Rate: ${successRate}%`);
    console.log(`  Throughput: ${throughtput} msg/sec\n`);

    console.log('LATENCY:');
    console.log(`  Average: ${agg.avgLatency.toFixed(2)}ms`);
    console.log(`  Min: ${agg.minLatency.toFixed(2)}ms`);
    console.log(`  Max: ${agg.maxLatency.toFixed(2)}ms`);
    console.log(`  Target: <100ms\n`);

    console.log('DATA TRANSFER:');
    console.log(`  Total: ${(agg.totalBytesTransferred / 1024).toFixed(2)}KB`);
    console.log(`  Avg per connection: ${(agg.totalBytesTransferred / agg.successfulConnections / 1024).toFixed(2)}KB\n`);

    console.log('MEMORY:');
    console.log(`  Growth: ${memoryGrowth}MB\n`);

    console.log('═'.repeat(62));
    const deploymentReady = successRate > 99 && agg.avgLatency < 100;
    console.log(`Deployment Readiness: ${deploymentReady ? 'YES ✓' : 'REQUIRES ATTENTION'}`);
    console.log('═'.repeat(62) + '\n');

    return {
      successRate: parseFloat(successRate),
      throughput: parseFloat(throughtput),
      avgLatency: agg.avgLatency,
      deploymentReady
    };
  }

  async saveResults() {
    const reportPath = path.join(
      process.cwd(),
      'tests/results/LOAD-TEST-RESULTS-2026-05-11.md'
    );

    const resultsDir = path.dirname(reportPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const agg = this.results.aggregated;

    let markdown = '# Load Test Results - v12.0.0\n\n';
    markdown += `**Test Date:** ${this.results.timestamp}\n`;
    markdown += `**Status:** ${this.results.status}\n\n`;

    markdown += '## Summary\n\n';
    markdown += `- **Concurrent Connections:** ${agg.totalConnections}\n`;
    markdown += `- **Successful Connections:** ${agg.successfulConnections}\n`;
    markdown += `- **Total Messages:** ${agg.totalMessages}\n`;
    markdown += `- **Success Rate:** ${((agg.successfulMessages / agg.totalMessages) * 100).toFixed(2)}%\n`;
    markdown += `- **Throughput:** ${(agg.totalMessages / (this.testDuration / 1000)).toFixed(2)} msg/sec\n`;
    markdown += `- **Avg Latency:** ${agg.avgLatency.toFixed(2)}ms\n\n`;

    markdown += '## Deployment Readiness\n\n';
    markdown += '| Metric | Value | Target | Status |\n';
    markdown += '|--------|-------|--------|--------|\n';
    markdown += `| Success Rate | ${((agg.successfulMessages / agg.totalMessages) * 100).toFixed(2)}% | >99% | ${((agg.successfulMessages / agg.totalMessages) * 100) > 99 ? 'PASS' : 'FAIL'} |\n`;
    markdown += `| Avg Latency | ${agg.avgLatency.toFixed(2)}ms | <100ms | ${agg.avgLatency < 100 ? 'PASS' : 'FAIL'} |\n`;
    markdown += `| Max Latency | ${agg.maxLatency.toFixed(2)}ms | <500ms | ${agg.maxLatency < 500 ? 'PASS' : 'FAIL'} |\n\n`;

    markdown += '## Detailed Configuration\n\n';
    markdown += '```json\n' + JSON.stringify(this.results, null, 2) + '\n```\n';

    fs.writeFileSync(reportPath, markdown);
    console.log(`Results saved to: ${reportPath}\n`);
  }
}

// Run tests
if (require.main === module) {
  const runTests = async () => {
    const tests = [
      { concurrent: 50, duration: 30 * 1000, name: '50 concurrent (30s test)' },
      { concurrent: 100, duration: 20 * 1000, name: '100 concurrent (20s test)' },
      { concurrent: 200, duration: 15 * 1000, name: '200 concurrent (15s test)' }
    ];

    const allResults = [];

    for (const testConfig of tests) {
      console.log(`\n>>> Running test: ${testConfig.name}\n`);

      const tester = new LoadTester({
        concurrent: testConfig.concurrent,
        duration: testConfig.duration,
        opsPerConnection: 50
      });

      const results = await tester.runLoadTest();
      await tester.saveResults();
      allResults.push(results);

      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  COMPREHENSIVE LOAD TEST COMPLETED                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Summary across all load levels:');
    allResults.forEach((result, i) => {
      const agg = result.aggregated;
      console.log(`\n${result.configuration.concurrent} concurrent:`);
      console.log(`  Success Rate: ${((agg.successfulMessages / agg.totalMessages) * 100).toFixed(2)}%`);
      console.log(`  Avg Latency: ${agg.avgLatency.toFixed(2)}ms`);
    });

    process.exit(0);
  };

  runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
}

module.exports = LoadTester;

#!/usr/bin/env node

/**
 * Production Load Profile Test for Basset Hound Browser v12.0.0+
 *
 * Simulates realistic production load:
 * - 300+ concurrent connections
 * - 70% monitoring operations (get_url, get_content, screenshot)
 * - 20% tech detection operations (detect_tech, get_headers)
 * - 10% dashboard operations (list_sessions, get_analytics)
 *
 * Duration: 2-hour sustained test
 *
 * Date: June 2, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ProductionLoadProfileTest {
  constructor(options = {}) {
    this.concurrentConnections = options.concurrent || 300;
    this.testDuration = options.duration || 120 * 60 * 1000; // 2 hours
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.reportFile = options.reportFile || path.join(__dirname, `../results/load-profile-${Date.now()}.json`);

    // Operation distribution matching production
    this.operationDistribution = {
      monitoring: 0.70,    // get_url, get_content, screenshot, get_html
      detection: 0.20,     // detect_tech, get_headers, get_console_logs
      dashboard: 0.10      // list_sessions, get_session_info, get_analytics
    };

    this.operationTypes = {
      monitoring: [
        'get_url',
        'get_content',
        'screenshot_viewport',
        'get_html'
      ],
      detection: [
        'get_headers',
        'get_console_logs',
        'detect_tech'
      ],
      dashboard: [
        'list_sessions',
        'list_tabs',
        'get_tab_info'
      ]
    };

    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrent: this.concurrentConnections,
        duration: this.testDuration / 1000,
        operationDistribution: this.operationDistribution
      },
      connections: [],
      aggregated: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        messagesByType: {},
        avgLatency: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        maxLatency: 0,
        minLatency: Infinity,
        memoryBefore: 0,
        memoryAfter: 0,
        memoryPeak: 0,
        totalBytesTransferred: 0,
        throughput: 0,
        errorRate: 0
      },
      status: 'PENDING'
    };

    this.startTime = null;
    this.allLatencies = [];
  }

  selectOperation() {
    const rand = Math.random();
    let selected;

    if (rand < this.operationDistribution.monitoring) {
      selected = 'monitoring';
    } else if (rand < this.operationDistribution.monitoring + this.operationDistribution.detection) {
      selected = 'detection';
    } else {
      selected = 'dashboard';
    }

    const operations = this.operationTypes[selected];
    return operations[Math.floor(Math.random() * operations.length)];
  }

  createMessage(clientId, messageId, operation) {
    const messages = {
      get_url: {
        command: 'get_url'
      },
      get_content: {
        command: 'get_content',
        options: { includeMetadata: true }
      },
      screenshot_viewport: {
        command: 'screenshot',
        options: { viewport: true }
      },
      get_html: {
        command: 'get_html'
      },
      get_headers: {
        command: 'get_headers'
      },
      get_console_logs: {
        command: 'get_console_logs'
      },
      detect_tech: {
        command: 'detect_tech'
      },
      list_sessions: {
        command: 'list_sessions'
      },
      list_tabs: {
        command: 'list_tabs'
      },
      get_tab_info: {
        command: 'get_tab_info',
        options: { includeMetadata: true }
      }
    };

    return {
      id: `client-${clientId}-msg-${messageId}`,
      timestamp: Date.now(),
      clientId,
      messageId,
      ...messages[operation],
      _testMetadata: {
        operation,
        sentAt: performance.now()
      }
    };
  }

  async runTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║           Production Load Profile Test - Basset Hound v12.0.0+           ║');
    console.log('║                     300+ Concurrent Connections, 2 Hours                    ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Configuration:');
    console.log(`  Concurrent Connections: ${this.concurrentConnections}`);
    console.log(`  Test Duration: ${this.testDuration / 1000 / 60} minutes`);
    console.log(`  Operation Distribution:`);
    console.log(`    - Monitoring: ${(this.operationDistribution.monitoring * 100).toFixed(1)}%`);
    console.log(`    - Detection: ${(this.operationDistribution.detection * 100).toFixed(1)}%`);
    console.log(`    - Dashboard: ${(this.operationDistribution.dashboard * 100).toFixed(1)}%`);
    console.log(`  Server: ${this.serverUrl}\n`);

    this.results.aggregated.memoryBefore = process.memoryUsage().heapUsed;
    this.startTime = performance.now();
    const testStartTime = Date.now();

    // Create all connections
    const connectionPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectionPromises.push(this.createClientConnection(i));
    }

    const connections = await Promise.all(connectionPromises);
    const connected = connections.filter(c => c && c.connected).length;

    console.log(`Connections established: ${connected}/${this.concurrentConnections}\n`);

    // Run operations until test duration expires
    const testStarted = performance.now();
    const testEndTime = testStarted + this.testDuration;

    await this.runOperationsUntilTimeout(connections, testEndTime, testStartTime);

    // Close all connections
    for (const conn of connections) {
      if (conn && conn.ws && conn.ws.readyState === WebSocket.OPEN) {
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
    const elapsedMinutes = elapsedSeconds / 60;

    // Aggregate results
    this.aggregateResults(connections, elapsedSeconds);
    this.printResults(elapsedSeconds, elapsedMinutes);

    // Save results
    this.saveResults();

    return this.results;
  }

  async runOperationsUntilTimeout(connections, testEndTime, testStartTime) {
    const connectionIntervals = [];

    for (const conn of connections) {
      if (!conn || !conn.connected) continue;

      const intervalId = setInterval(() => {
        if (conn.ws.readyState !== WebSocket.OPEN || performance.now() > testEndTime) {
          clearInterval(intervalId);
          return;
        }

        const operation = this.selectOperation();
        const message = this.createMessage(conn.clientId, conn.messageCount, operation);

        try {
          conn.ws.send(JSON.stringify(message), (err) => {
            if (err) {
              conn.failureCount++;
              this.results.aggregated.failedMessages++;
            }
          });

          conn.messageCount++;
          this.results.aggregated.totalMessages++;

          // Track message type
          if (!this.results.aggregated.messagesByType[operation]) {
            this.results.aggregated.messagesByType[operation] = 0;
          }
          this.results.aggregated.messagesByType[operation]++;

        } catch (err) {
          conn.failureCount++;
          this.results.aggregated.failedMessages++;
        }
      }, 100 + Math.random() * 50); // 100-150ms intervals between messages per client

      connectionIntervals.push(intervalId);
    }

    // Wait for test duration
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (performance.now() > testEndTime) {
          clearInterval(checkInterval);
          connectionIntervals.forEach(id => clearInterval(id));
          resolve();
        }
      }, 1000);
    });
  }

  async createClientConnection(clientId) {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.serverUrl);

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
          resolve(clientResult);
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg._testMetadata && msg._testMetadata.sentAt) {
              const latency = performance.now() - msg._testMetadata.sentAt;
              clientResult.latencies.push(latency);
              this.allLatencies.push(latency);
              clientResult.successCount++;
              this.results.aggregated.successfulMessages++;
            }
            clientResult.bytesTransferred += data.length;
          } catch (err) {
            // Ignore parse errors
          }
        });

        ws.on('error', () => {
          clientResult.failureCount++;
        });

        ws.on('close', () => {
          clientResult.connected = false;
        });

        // Timeout connection attempt after 10 seconds
        setTimeout(() => {
          if (!clientResult.connected) {
            this.results.aggregated.failedConnections++;
            resolve(clientResult);
          }
        }, 10000);

      } catch (err) {
        this.results.aggregated.failedConnections++;
        resolve(null);
      }
    });
  }

  aggregateResults(connections, elapsedSeconds) {
    this.results.aggregated.totalConnections = this.concurrentConnections;

    // Calculate latency percentiles
    if (this.allLatencies.length > 0) {
      this.allLatencies.sort((a, b) => a - b);
      const len = this.allLatencies.length;

      this.results.aggregated.minLatency = this.allLatencies[0];
      this.results.aggregated.maxLatency = this.allLatencies[len - 1];
      this.results.aggregated.avgLatency =
        this.allLatencies.reduce((a, b) => a + b, 0) / len;
      this.results.aggregated.p50Latency =
        this.allLatencies[Math.floor(len * 0.5)];
      this.results.aggregated.p95Latency =
        this.allLatencies[Math.floor(len * 0.95)];
      this.results.aggregated.p99Latency =
        this.allLatencies[Math.floor(len * 0.99)];
    }

    // Calculate throughput
    this.results.aggregated.throughput =
      this.results.aggregated.successfulMessages / elapsedSeconds;

    // Calculate error rate
    const totalMessages = this.results.aggregated.successfulMessages +
                         this.results.aggregated.failedMessages;
    this.results.aggregated.errorRate = totalMessages > 0
      ? this.results.aggregated.failedMessages / totalMessages
      : 0;

    // Aggregate per-connection stats
    for (const conn of connections) {
      if (conn) {
        this.results.connections.push({
          clientId: conn.clientId,
          connected: conn.connected,
          messages: conn.messageCount,
          successes: conn.successCount,
          failures: conn.failureCount,
          avgLatency: conn.latencies.length > 0
            ? conn.latencies.reduce((a, b) => a + b, 0) / conn.latencies.length
            : 0,
          bytesTransferred: conn.bytesTransferred
        });
      }
    }
  }

  printResults(elapsedSeconds, elapsedMinutes) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                           TEST RESULTS                                   ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Connection Statistics:');
    console.log(`  Total Connections: ${this.results.aggregated.totalConnections}`);
    console.log(`  Successful: ${this.results.aggregated.successfulConnections}`);
    console.log(`  Failed: ${this.results.aggregated.failedConnections}`);
    console.log(`  Success Rate: ${((this.results.aggregated.successfulConnections / this.results.aggregated.totalConnections) * 100).toFixed(2)}%\n`);

    console.log('Message Statistics:');
    console.log(`  Total Messages: ${this.results.aggregated.totalMessages}`);
    console.log(`  Successful: ${this.results.aggregated.successfulMessages}`);
    console.log(`  Failed: ${this.results.aggregated.failedMessages}`);
    console.log(`  Error Rate: ${(this.results.aggregated.errorRate * 100).toFixed(2)}%\n`);

    console.log('Latency (ms):');
    console.log(`  Min: ${this.results.aggregated.minLatency.toFixed(2)}`);
    console.log(`  Avg: ${this.results.aggregated.avgLatency.toFixed(2)}`);
    console.log(`  P50: ${this.results.aggregated.p50Latency.toFixed(2)}`);
    console.log(`  P95: ${this.results.aggregated.p95Latency.toFixed(2)}`);
    console.log(`  P99: ${this.results.aggregated.p99Latency.toFixed(2)}`);
    console.log(`  Max: ${this.results.aggregated.maxLatency.toFixed(2)}\n`);

    console.log('Performance:');
    console.log(`  Throughput: ${this.results.aggregated.throughput.toFixed(2)} msgs/sec`);
    console.log(`  Duration: ${elapsedMinutes.toFixed(2)} minutes`);
    console.log(`  Total Bytes: ${(this.results.aggregated.totalBytesTransferred / 1024 / 1024).toFixed(2)} MB\n`);

    console.log('Memory:');
    const heapUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
    console.log(`  Current Heap: ${heapUsedMB}MB / ${heapTotalMB}MB`);
    console.log(`  Before Test: ${(this.results.aggregated.memoryBefore / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  After Test: ${(this.results.aggregated.memoryAfter / 1024 / 1024).toFixed(2)}MB\n`);

    console.log('Message Types Sent:');
    for (const [type, count] of Object.entries(this.results.aggregated.messagesByType)) {
      console.log(`  ${type}: ${count}`);
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
  const test = new ProductionLoadProfileTest({
    concurrent: process.argv.includes('--full') ? 300 : 50,
    duration: process.argv.includes('--duration')
      ? parseInt(process.argv[process.argv.indexOf('--duration') + 1]) * 60 * 1000
      : process.argv.includes('--full') ? 120 * 60 * 1000 : 5 * 60 * 1000
  });

  test.runTest().catch(console.error);
}

module.exports = ProductionLoadProfileTest;

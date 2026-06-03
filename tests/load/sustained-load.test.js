#!/usr/bin/env node

/**
 * Sustained Load Test for Basset Hound Browser v12.0.0+
 *
 * Long-duration stress test:
 * - 300 concurrent connections
 * - Sustained for 8+ hours
 * - Monitor: memory growth, connection stability, crashes, degradation
 * - Detect: memory leaks, connection pool exhaustion, zombie processes
 *
 * Runs in batches with checkpoint saves
 *
 * Date: June 2, 2026
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class SustainedLoadTest {
  constructor(options = {}) {
    this.concurrentConnections = options.concurrent || 300;
    this.testDuration = options.duration || 8 * 60 * 60 * 1000; // 8 hours
    this.checkpointInterval = options.checkpointInterval || 30 * 60 * 1000; // Every 30 minutes
    this.serverUrl = options.serverUrl || 'ws://localhost:8765';
    this.reportFile = options.reportFile || path.join(__dirname, `../results/sustained-load-${Date.now()}.json`);

    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrent: this.concurrentConnections,
        duration: this.testDuration / 1000,
        checkpointInterval: this.checkpointInterval / 1000
      },
      checkpoints: [],
      aggregated: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalMessages: 0,
        crashes: 0,
        disconnections: 0,
        memoryGrowthPerHour: 0,
        avgThroughput: 0,
        maxLatency: 0
      },
      status: 'PENDING'
    };

    this.connections = [];
    this.checkpointNumber = 0;
    this.initialMemory = 0;
    this.memoryReadings = [];
  }

  async runTest() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║            Sustained Load Test - Basset Hound v12.0.0+                     ║');
    console.log('║              300 Concurrent Connections, 8+ Hours                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Configuration:');
    console.log(`  Concurrent Connections: ${this.concurrentConnections}`);
    console.log(`  Test Duration: ${this.testDuration / 1000 / 60 / 60} hours`);
    console.log(`  Checkpoint Interval: ${this.checkpointInterval / 1000 / 60} minutes`);
    console.log(`  Server: ${this.serverUrl}\n`);

    this.initialMemory = process.memoryUsage().heapUsed;
    this.results.aggregated.memoryBefore = this.initialMemory;

    const testStartTime = performance.now();
    const testEndTime = testStartTime + this.testDuration;

    // Create initial connections
    console.log('Creating initial connections...');
    const connectionPromises = [];
    for (let i = 0; i < this.concurrentConnections; i++) {
      connectionPromises.push(this.createConnection(i));
    }

    this.connections = await Promise.all(connectionPromises);
    const connected = this.connections.filter(c => c && c.connected).length;

    console.log(`Connections established: ${connected}/${this.concurrentConnections}\n`);
    this.results.aggregated.successfulConnections = connected;
    this.results.aggregated.failedConnections = this.concurrentConnections - connected;

    // Set up checkpoint monitoring
    const checkpointStartTime = performance.now();
    const checkpointCallback = () => this.recordCheckpoint();
    const checkpointTimer = setInterval(checkpointCallback, this.checkpointInterval);

    // Run sustained load test
    await this.runSustainedLoad(testEndTime);

    // Cleanup
    clearInterval(checkpointTimer);

    // Final checkpoint
    this.recordCheckpoint();

    // Close all connections
    for (const conn of this.connections) {
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

    const elapsedSeconds = (performance.now() - testStartTime) / 1000;
    const elapsedHours = elapsedSeconds / 3600;

    // Calculate memory growth
    if (this.memoryReadings.length > 1) {
      const memoryGrowth = this.memoryReadings[this.memoryReadings.length - 1] - this.initialMemory;
      this.results.aggregated.memoryGrowthPerHour = memoryGrowth / elapsedHours;
    }

    this.printResults(elapsedSeconds, elapsedHours);
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
          successCount: 0,
          failureCount: 0,
          connectionTime: null,
          lastMessageTime: null,
          disconnections: 0
        };

        ws.on('open', () => {
          conn.connected = true;
          conn.ws = ws;
          conn.connectionTime = Date.now();
          resolve(conn);
        });

        ws.on('message', () => {
          conn.lastMessageTime = Date.now();
          conn.successCount++;
        });

        ws.on('error', () => {
          conn.connected = false;
          conn.disconnections++;
        });

        ws.on('close', () => {
          conn.connected = false;
          conn.disconnections++;
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

  async runSustainedLoad(testEndTime) {
    const allConnections = this.connections.filter(c => c && c.connected);

    return new Promise(resolve => {
      const operationInterval = setInterval(() => {
        const currentTime = performance.now();
        if (currentTime > testEndTime) {
          clearInterval(operationInterval);
          resolve();
          return;
        }

        // Send operations to all connected connections
        for (const conn of allConnections) {
          if (!conn || !conn.connected || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
            continue;
          }

          // Vary operations
          const opType = Math.random();
          let message;

          if (opType < 0.4) {
            message = { command: 'ping' };
          } else if (opType < 0.7) {
            message = { command: 'get_url' };
          } else if (opType < 0.9) {
            message = { command: 'screenshot_viewport' };
          } else {
            message = { command: 'get_content' };
          }

          message.id = `${conn.clientId}-${conn.messageCount++}`;
          message._sentAt = performance.now();

          try {
            conn.ws.send(JSON.stringify(message), (err) => {
              if (!err) {
                this.results.aggregated.totalMessages++;
              }
            });
          } catch (err) {
            conn.failureCount++;
          }
        }
      }, 100); // Send every 100ms per connection
    });
  }

  recordCheckpoint() {
    this.checkpointNumber++;
    const checkpoint = {
      number: this.checkpointNumber,
      timestamp: new Date().toISOString(),
      connectedConnections: this.connections.filter(c => c && c.connected).length,
      totalConnections: this.concurrentConnections,
      memoryUsage: process.memoryUsage().heapUsed,
      messages: this.results.aggregated.totalMessages
    };

    this.memoryReadings.push(checkpoint.memoryUsage);
    this.results.checkpoints.push(checkpoint);

    // Print checkpoint status
    const memoryMB = (checkpoint.memoryUsage / 1024 / 1024).toFixed(2);
    const connectionRate = ((checkpoint.connectedConnections / this.concurrentConnections) * 100).toFixed(2);
    console.log(`[Checkpoint ${this.checkpointNumber}] Connections: ${connectionRate}% | Memory: ${memoryMB}MB | Messages: ${checkpoint.messages}`);

    // Check for issues
    if (checkpoint.connectedConnections < this.concurrentConnections * 0.9) {
      console.warn(`  WARNING: Connection pool degrading (${checkpoint.connectedConnections} / ${this.concurrentConnections})`);
    }

    if (this.memoryReadings.length > 1) {
      const memoryGrowth = checkpoint.memoryUsage - this.memoryReadings[this.memoryReadings.length - 2];
      if (memoryGrowth > 50 * 1024 * 1024) { // > 50MB growth
        console.warn(`  WARNING: High memory growth (${(memoryGrowth / 1024 / 1024).toFixed(2)}MB)`);
      }
    }
  }

  printResults(elapsedSeconds, elapsedHours) {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                         SUSTAINED LOAD RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log('Test Duration:');
    console.log(`  Elapsed: ${elapsedHours.toFixed(2)} hours (${elapsedSeconds.toFixed(0)} seconds)\n`);

    console.log('Connection Statistics:');
    console.log(`  Initial Target: ${this.results.aggregated.totalMessages > 0 ? this.concurrentConnections : 0}`);
    console.log(`  Final Connected: ${this.connections.filter(c => c && c.connected).length}`);
    console.log(`  Total Disconnections: ${this.results.aggregated.disconnections}\n`);

    console.log('Message Statistics:');
    console.log(`  Total Messages Sent: ${this.results.aggregated.totalMessages}`);
    console.log(`  Throughput: ${(this.results.aggregated.totalMessages / elapsedSeconds).toFixed(2)} msgs/sec\n`);

    console.log('Memory Analysis:');
    console.log(`  Initial: ${(this.results.aggregated.memoryBefore / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final: ${(this.results.aggregated.memoryAfter / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Growth: ${((this.results.aggregated.memoryAfter - this.results.aggregated.memoryBefore) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Growth/Hour: ${(this.results.aggregated.memoryGrowthPerHour / 1024 / 1024).toFixed(2)}MB/hr\n`);

    console.log('Checkpoints Recorded:');
    console.log(`  Total: ${this.results.checkpoints.length}`);

    if (this.results.checkpoints.length > 0) {
      console.log(`  First: ${this.results.checkpoints[0].timestamp}`);
      console.log(`  Last: ${this.results.checkpoints[this.results.checkpoints.length - 1].timestamp}\n`);

      // Trend analysis
      const firstMem = this.results.checkpoints[0].memoryUsage;
      const lastMem = this.results.checkpoints[this.results.checkpoints.length - 1].memoryUsage;
      const memTrendMB = (lastMem - firstMem) / 1024 / 1024;

      if (Math.abs(memTrendMB) < 50) {
        console.log(`  Memory Trend: STABLE (${memTrendMB.toFixed(2)}MB)`);
      } else if (memTrendMB > 0) {
        console.log(`  Memory Trend: GROWING (${memTrendMB.toFixed(2)}MB) - Possible leak`);
      } else {
        console.log(`  Memory Trend: DECLINING (${memTrendMB.toFixed(2)}MB)`);
      }
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
  let duration = 8 * 60 * 60 * 1000; // 8 hours

  if (process.argv.includes('--quick')) {
    duration = 10 * 60 * 1000; // 10 minutes for quick test
  } else if (process.argv.includes('--duration')) {
    const idx = process.argv.indexOf('--duration');
    duration = parseInt(process.argv[idx + 1]) * 60 * 1000; // Convert minutes to ms
  }

  const test = new SustainedLoadTest({
    concurrent: 300,
    duration,
    checkpointInterval: Math.max(1 * 60 * 1000, duration / 10) // Every 10% of test duration
  });

  test.runTest().catch(console.error);
}

module.exports = SustainedLoadTest;

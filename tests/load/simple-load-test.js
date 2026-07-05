#!/usr/bin/env node

/**
 * Simple Load Test - Integrated Execution
 *
 * Tests WebSocket server performance with configurable load levels
 * Runs mock server internally and executes a complete load test
 */

const WebSocket = require('ws');
const http = require('http');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class SimpleLoadTest {
  constructor(options = {}) {
    this.concurrentConnections = options.concurrent || 50;
    this.testDuration = options.duration || 60000; // 1 minute default
    this.port = options.port || 8765;
    this.server = null;
    this.wss = null;
    this.results = {
      timestamp: new Date().toISOString(),
      configuration: {
        concurrent: this.concurrentConnections,
        durationMs: this.testDuration,
        port: this.port
      },
      metrics: {
        totalConnections: 0,
        successfulConnections: 0,
        failedConnections: 0,
        totalMessages: 0,
        successfulMessages: 0,
        failedMessages: 0,
        latencies: [],
        memoryBefore: 0,
        memoryAfter: 0,
        cpuUsageBefore: null,
        cpuUsageAfter: null,
        startTime: null,
        endTime: null,
        duration: 0
      },
      status: 'INITIALIZED'
    };

    // Mock server state
    this.serverConnections = new Map();
    this.serverMessages = 0;
  }

  startMockServer() {
    return new Promise((resolve, reject) => {
      console.log(`[MOCK-SERVER] Starting on port ${this.port}...`);

      this.server = http.createServer();
      this.wss = new WebSocket.Server({ server: this.server });

      let connId = 0;

      this.wss.on('connection', (ws) => {
        connId++;
        const id = connId;
        this.serverConnections.set(id, { ws, messageCount: 0, connectedAt: Date.now() });

        console.log(`[MOCK-SERVER] Connection ${id} established (total: ${this.wss.clients.size})`);

        ws.on('message', (data) => {
          this.serverMessages++;
          const conn = this.serverConnections.get(id);
          if (conn) {
            conn.messageCount++;
          }

          try {
            const msg = JSON.parse(data.toString());
            const responseDelay = Math.random() * 50;

            setTimeout(() => {
              const response = {
                id: msg.id || Math.random(),
                success: true,
                command: msg.command || 'unknown',
                timestamp: new Date().toISOString(),
                result: { processed: true, messageId: this.serverMessages }
              };

              ws.send(JSON.stringify(response));
            }, responseDelay);

          } catch (error) {
            try {
              ws.send(JSON.stringify({
                id: Math.random(),
                success: false,
                error: 'Invalid JSON'
              }));
            } catch (e) {
              // Connection might be closed
            }
          }
        });

        ws.on('close', () => {
          const conn = this.serverConnections.get(id);
          console.log(`[MOCK-SERVER] Connection ${id} closed (messages: ${conn?.messageCount || 0}, total: ${this.wss.clients.size})`);
          this.serverConnections.delete(id);
        });

        ws.on('error', (error) => {
          console.log(`[MOCK-SERVER] Connection ${id} error: ${error.message}`);
        });
      });

      this.server.listen(this.port, () => {
        console.log(`[MOCK-SERVER] Listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  stopMockServer() {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      console.log('[MOCK-SERVER] Closing...');
      this.wss.clients.forEach((ws) => ws.close());
      this.server.close(() => {
        console.log('[MOCK-SERVER] Closed');
        resolve();
      });
    });
  }

  async runLoadTest() {
    console.log(`\n[LOAD-TEST] Starting load test with ${this.concurrentConnections} concurrent connections`);
    console.log(`[LOAD-TEST] Duration: ${this.testDuration}ms (${this.testDuration / 1000}s)`);

    const startTime = performance.now();
    this.results.metrics.startTime = new Date().toISOString();
    this.results.metrics.memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;

    const connections = [];
    const allLatencies = [];

    // Create concurrent connections
    for (let i = 0; i < this.concurrentConnections; i++) {
      const connPromise = this.createConnection(i, allLatencies);
      connections.push(connPromise);
    }

    // Wait for all connections to establish
    const connResults = await Promise.allSettled(connections);

    this.results.metrics.totalConnections = connResults.length;
    this.results.metrics.successfulConnections = connResults.filter(r => r.status === 'fulfilled').length;
    this.results.metrics.failedConnections = connResults.filter(r => r.status === 'rejected').length;

    console.log(`[LOAD-TEST] Connections established: ${this.results.metrics.successfulConnections}/${this.results.metrics.totalConnections}`);

    // Get all connected WebSocket instances
    const connectedWss = connResults
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    // Run load for specified duration
    await this.generateLoad(connectedWss, allLatencies);

    // Close all connections
    connectedWss.forEach(ws => {
      try {
        ws.close();
      } catch (e) {}
    });

    // Wait for connections to fully close
    await new Promise(resolve => setTimeout(resolve, 1000));

    const endTime = performance.now();
    this.results.metrics.endTime = new Date().toISOString();
    this.results.metrics.duration = endTime - startTime;
    this.results.metrics.memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    this.results.metrics.totalMessages = allLatencies.length;
    this.results.metrics.successfulMessages = allLatencies.filter(l => l.success).length;
    this.results.metrics.failedMessages = allLatencies.filter(l => !l.success).length;
    this.results.metrics.latencies = this.calculateLatencyStats(allLatencies);

    this.results.status = 'COMPLETED';

    console.log(`\n[LOAD-TEST] Test completed in ${(this.results.metrics.duration / 1000).toFixed(2)}s`);
    console.log(`[LOAD-TEST] Total messages: ${this.results.metrics.totalMessages}`);
    console.log(`[LOAD-TEST] Success rate: ${((this.results.metrics.successfulMessages / this.results.metrics.totalMessages) * 100).toFixed(2)}%`);
    console.log(`[LOAD-TEST] Memory delta: ${(this.results.metrics.memoryAfter - this.results.metrics.memoryBefore).toFixed(2)}MB`);

    if (this.results.metrics.latencies) {
      console.log(`[LOAD-TEST] Latency P50: ${this.results.metrics.latencies.p50?.toFixed(2) || 'N/A'}ms`);
      console.log(`[LOAD-TEST] Latency P95: ${this.results.metrics.latencies.p95?.toFixed(2) || 'N/A'}ms`);
      console.log(`[LOAD-TEST] Latency P99: ${this.results.metrics.latencies.p99?.toFixed(2) || 'N/A'}ms`);
    }
  }

  createConnection(connIndex, latencies) {
    return new Promise((resolve, reject) => {
      const url = `ws://localhost:${this.port}`;

      try {
        const ws = new WebSocket(url);

        ws.on('open', () => {
          console.log(`[CLIENT-${connIndex}] Connected`);
          resolve(ws);
        });

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            const latency = msg.receivedAt ? Date.now() - msg.sentAt : 0;
            latencies.push({ success: true, latency: latency });
          } catch (e) {
            latencies.push({ success: false, latency: 0, error: e.message });
          }
        });

        ws.on('error', (error) => {
          console.log(`[CLIENT-${connIndex}] Error: ${error.message}`);
          latencies.push({ success: false, latency: 0, error: error.message });
          reject(error);
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  generateLoad(connections, latencies) {
    return new Promise((resolve) => {
      if (connections.length === 0) {
        console.log('[LOAD-TEST] No active connections to load');
        resolve();
        return;
      }

      const startTime = Date.now();
      const messageId = Math.floor(Math.random() * 1000000);
      let messagesSent = 0;

      const loadInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;

        if (elapsed >= this.testDuration) {
          clearInterval(loadInterval);
          console.log(`[LOAD-TEST] Load generation complete: ${messagesSent} messages sent`);
          resolve();
          return;
        }

        // Send messages on all connections
        connections.forEach((ws, idx) => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              const msg = {
                id: messageId + idx,
                command: 'test',
                timestamp: Date.now(),
                sentAt: Date.now(),
                data: `load-test-${elapsed}`
              };
              ws.send(JSON.stringify(msg));
              messagesSent++;
            } catch (e) {
              // Connection might be closed
            }
          }
        });

        // Log progress every 10 seconds
        if (elapsed % 10000 < 500) {
          const throughput = (messagesSent / (elapsed / 1000)).toFixed(2);
          console.log(`[LOAD-TEST] Progress: ${elapsed / 1000}s, messages: ${messagesSent}, throughput: ${throughput} msg/s`);
        }

      }, 100); // Send every 100ms
    });
  }

  calculateLatencyStats(latencies) {
    if (!latencies || latencies.length === 0) {
      return null;
    }

    const successLatencies = latencies
      .filter(l => l.success && l.latency)
      .map(l => l.latency)
      .sort((a, b) => a - b);

    if (successLatencies.length === 0) {
      return null;
    }

    return {
      count: successLatencies.length,
      min: successLatencies[0],
      max: successLatencies[successLatencies.length - 1],
      avg: successLatencies.reduce((a, b) => a + b, 0) / successLatencies.length,
      p50: successLatencies[Math.floor(successLatencies.length * 0.5)],
      p95: successLatencies[Math.floor(successLatencies.length * 0.95)],
      p99: successLatencies[Math.floor(successLatencies.length * 0.99)]
    };
  }

  saveResults(filename = null) {
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const file = filename || path.join(resultsDir, `load-test-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(this.results, null, 2));

    console.log(`\n[LOAD-TEST] Results saved: ${file}`);
    return file;
  }

  async execute() {
    try {
      console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
      console.log('║              Simple Load Test - Integrated Execution                      ║');
      console.log('║                      June 2, 2026                                          ║');
      console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

      await this.startMockServer();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for server to be ready

      await this.runLoadTest();

      this.saveResults();

      console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
      console.log('║                    LOAD TEST EXECUTION COMPLETE                           ║');
      console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    } catch (error) {
      console.error('\n[ERROR]', error);
      this.results.status = 'FAILED';
      this.results.error = error.message;
      this.saveResults(path.join(__dirname, '../results', `load-test-FAILED-${Date.now()}.json`));
      process.exit(1);
    } finally {
      await this.stopMockServer();
      process.exit(0);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  concurrent: 50,
  duration: 60000 // 1 minute default
};

for (const arg of args) {
  if (arg.startsWith('--concurrent=')) {
    options.concurrent = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--duration=')) {
    options.duration = parseInt(arg.split('=')[1]);
  }
}

// Execute
const test = new SimpleLoadTest(options);
test.execute().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

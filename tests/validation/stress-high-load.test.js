#!/usr/bin/env node

/**
 * High-Load Stress Testing
 * Tests system under extreme concurrent load (500+ connections)
 * Duration: 1-hour sustained stress testing
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const CONCURRENT_CONNECTIONS = 500;
const TEST_DURATION_MS = 3600000; // 1 hour
const CHECKPOINT_INTERVAL = 60000; // Every 1 minute
const OPERATION_TIMEOUT = 5000;

const TEST_RESULTS = {
  startTime: Date.now(),
  endTime: null,
  totalConnections: 0,
  successfulConnections: 0,
  failedConnections: 0,
  operations: {
    total: 0,
    successful: 0,
    failed: 0,
  },
  throughput: {
    messagesPerSecond: 0,
    peakMPS: 0,
    averageMPS: 0,
  },
  latency: {
    min: Infinity,
    max: 0,
    average: 0,
    p50: 0,
    p95: 0,
    p99: 0,
  },
  resources: {
    peakMemoryUsage: 0,
    averageMemoryUsage: 0,
    peakCPUUsage: 0,
    averageCPUUsage: 0,
  },
  errors: [],
  checkpoints: [],
};

/**
 * WebSocket client for stress testing
 */
class StressTestClient {
  constructor(id, serverUrl) {
    this.id = id;
    this.serverUrl = serverUrl;
    this.ws = null;
    this.connected = false;
    this.operationCount = 0;
    this.latencies = [];
    this.requestId = 0;
    this.responseMap = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);
        this.ws.setMaxListeners(500);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              const { resolve: res, startTime } = this.responseMap.get(msg.requestId);
              const latency = Date.now() - startTime;
              this.latencies.push(latency);
              res(msg);
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {}
        });

        this.ws.on('error', (err) => {
          if (!this.connected) reject(err);
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('Connection timeout'));
        }, 5000);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}) {
    if (!this.connected) throw new Error('Not connected');

    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error('Operation timeout'));
      }, OPERATION_TIMEOUT);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timer);
          this.operationCount++;
          resolve(msg);
        },
        startTime: Date.now(),
      });

      try {
        this.ws.send(JSON.stringify({ command, params, requestId }));
      } catch (err) {
        clearTimeout(timer);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }

  getLatencyStats() {
    if (this.latencies.length === 0) {
      return { min: 0, max: 0, avg: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
}

/**
 * Create all stress test clients
 */
async function createClients(count) {
  console.log(`Creating ${count} WebSocket connections...`);

  const clients = [];
  const errors = [];

  for (let i = 0; i < count; i++) {
    try {
      const client = new StressTestClient(i, SERVER_URL);
      await client.connect();
      clients.push(client);

      if ((i + 1) % 50 === 0) {
        console.log(`  Connected: ${i + 1}/${count}`);
      }
    } catch (err) {
      errors.push({
        clientId: i,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  TEST_RESULTS.totalConnections = count;
  TEST_RESULTS.successfulConnections = clients.length;
  TEST_RESULTS.failedConnections = errors.length;

  console.log(`Connections established: ${clients.length}/${count}`);
  if (errors.length > 0) {
    console.log(`Connection failures: ${errors.length}`);
  }

  return clients;
}

/**
 * Run continuous operations on all clients
 */
async function runStressOperations(clients, durationMs) {
  console.log(`\nRunning stress operations for ${durationMs / 1000 / 60} minutes...`);

  const startTime = Date.now();
  const endTime = startTime + durationMs;
  const operations = ['navigate', 'screenshot', 'getContent', 'executeJavaScript'];
  let operationCount = 0;
  let lastCheckpointTime = startTime;
  let lastOperationCount = 0;

  while (Date.now() < endTime) {
    const promises = [];

    for (const client of clients) {
      if (!client.connected) continue;

      const operation = operations[Math.floor(Math.random() * operations.length)];
      const promise = (async () => {
        try {
          switch (operation) {
            case 'navigate':
              await client.sendCommand('navigate', { url: 'https://example.com' });
              break;
            case 'screenshot':
              await client.sendCommand('screenshot', {});
              break;
            case 'getContent':
              await client.sendCommand('getContent', { selector: 'body' });
              break;
            case 'executeJavaScript':
              await client.sendCommand('executeJavaScript', { code: '1+1' });
              break;
          }
          TEST_RESULTS.operations.successful++;
        } catch (err) {
          TEST_RESULTS.operations.failed++;
          TEST_RESULTS.errors.push({
            clientId: client.id,
            operation,
            error: err.message,
          });
        }
        TEST_RESULTS.operations.total++;
      })();

      promises.push(promise);
    }

    // Wait for batch completion
    await Promise.allSettled(promises);

    // Checkpoint every minute
    const now = Date.now();
    if (now - lastCheckpointTime >= CHECKPOINT_INTERVAL) {
      const elapsedSeconds = (now - lastCheckpointTime) / 1000;
      const operationsSinceLastCheckpoint = TEST_RESULTS.operations.total - lastOperationCount;
      const mps = operationsSinceLastCheckpoint / elapsedSeconds;

      TEST_RESULTS.checkpoints.push({
        time: new Date(now).toISOString(),
        elapsedSeconds: Math.round((now - startTime) / 1000),
        totalOperations: TEST_RESULTS.operations.total,
        successRate: (
          (TEST_RESULTS.operations.successful / TEST_RESULTS.operations.total) *
          100
        ).toFixed(2),
        msgPerSecond: mps.toFixed(2),
        activeConnections: clients.filter((c) => c.connected).length,
      });

      console.log(
        `  [${Math.round((now - startTime) / 1000)}s] ` +
          `Operations: ${TEST_RESULTS.operations.total}, ` +
          `Success Rate: ${((TEST_RESULTS.operations.successful / TEST_RESULTS.operations.total) * 100).toFixed(2)}%, ` +
          `Throughput: ${mps.toFixed(2)} msg/s`
      );

      lastCheckpointTime = now;
      lastOperationCount = TEST_RESULTS.operations.total;
    }

    // Small delay to prevent CPU spinning
    await new Promise((r) => setTimeout(r, 10));
  }

  TEST_RESULTS.endTime = Date.now();
}

/**
 * Collect latency statistics
 */
function collectLatencyStats(clients) {
  console.log('\nCollecting latency statistics...');

  const allLatencies = [];
  for (const client of clients) {
    const stats = client.getLatencyStats();
    allLatencies.push(...client.latencies);

    if (stats.max > TEST_RESULTS.latency.max) {
      TEST_RESULTS.latency.max = stats.max;
    }
    if (stats.min < TEST_RESULTS.latency.min) {
      TEST_RESULTS.latency.min = stats.min;
    }
  }

  if (allLatencies.length > 0) {
    const sorted = [...allLatencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    TEST_RESULTS.latency.average = sum / sorted.length;
    TEST_RESULTS.latency.p50 = sorted[Math.floor(sorted.length * 0.5)];
    TEST_RESULTS.latency.p95 = sorted[Math.floor(sorted.length * 0.95)];
    TEST_RESULTS.latency.p99 = sorted[Math.floor(sorted.length * 0.99)];
  }

  const totalTime = (TEST_RESULTS.endTime - TEST_RESULTS.startTime) / 1000;
  TEST_RESULTS.throughput.averageMPS = TEST_RESULTS.operations.total / totalTime;
}

/**
 * Run complete stress test
 */
async function runStressTest() {
  console.log('\n========================================');
  console.log('HIGH-LOAD STRESS TESTING');
  console.log('========================================');
  console.log(`Target: ${CONCURRENT_CONNECTIONS} concurrent connections`);
  console.log(`Duration: ${TEST_DURATION_MS / 1000 / 60} minutes`);
  console.log(`Test Start: ${new Date().toISOString()}\n`);

  let clients = [];

  try {
    // Create clients
    clients = await createClients(CONCURRENT_CONNECTIONS);

    if (clients.length === 0) {
      console.error('Failed to create any connections');
      return 1;
    }

    // Run stress operations
    await runStressOperations(clients, TEST_DURATION_MS);

    // Collect statistics
    collectLatencyStats(clients);

    // Print results
    console.log('\n========================================');
    console.log('STRESS TEST RESULTS');
    console.log('========================================');
    console.log(`Total Connections: ${TEST_RESULTS.totalConnections}`);
    console.log(`Successful Connections: ${TEST_RESULTS.successfulConnections}`);
    console.log(`Failed Connections: ${TEST_RESULTS.failedConnections}`);

    console.log(`\nOperations:`);
    console.log(`  Total: ${TEST_RESULTS.operations.total}`);
    console.log(`  Successful: ${TEST_RESULTS.operations.successful}`);
    console.log(`  Failed: ${TEST_RESULTS.operations.failed}`);
    console.log(
      `  Success Rate: ${(
        (TEST_RESULTS.operations.successful / TEST_RESULTS.operations.total) *
        100
      ).toFixed(2)}%`
    );

    console.log(`\nThroughput:`);
    console.log(`  Average: ${TEST_RESULTS.throughput.averageMPS.toFixed(2)} msg/s`);

    console.log(`\nLatency:`);
    console.log(`  Min: ${TEST_RESULTS.latency.min}ms`);
    console.log(`  Average: ${TEST_RESULTS.latency.average.toFixed(2)}ms`);
    console.log(`  P95: ${TEST_RESULTS.latency.p95}ms`);
    console.log(`  P99: ${TEST_RESULTS.latency.p99}ms`);
    console.log(`  Max: ${TEST_RESULTS.latency.max}ms`);

    console.log(`\nTest Status: COMPLETE`);
    console.log(`End Time: ${new Date().toISOString()}`);

    return TEST_RESULTS.operations.failed > 0 ? 1 : 0;
  } catch (error) {
    console.error('Test error:', error.message);
    return 1;
  } finally {
    // Cleanup
    console.log('\nCleaning up connections...');
    for (const client of clients) {
      try {
        client.disconnect();
      } catch (e) {}
    }
  }
}

// Run stress test
runStressTest()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

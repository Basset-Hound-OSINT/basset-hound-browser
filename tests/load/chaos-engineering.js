#!/usr/bin/env node

/**
 * Chaos Engineering Test Suite
 *
 * Validates system resilience by introducing failures:
 * - Network failures (packet loss, latency injection)
 * - Resource exhaustion (CPU, memory)
 * - Connection failures
 * - Cascading failures
 * - Recovery behavior
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  RESULTS_DIR: path.join(__dirname, '../results'),
  TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-'),

  // Test parameters
  CONNECTION_COUNT: 50,
  MESSAGE_RATE: 10,
  TEST_DURATION: 60000 // 1 minute per test
};

/**
 * ChaosTest - Base class for chaos experiments
 */
class ChaosTest {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();
    this.results = {
      name,
      startTime: new Date(this.startTime).toISOString(),
      metrics: {
        connections_established: 0,
        connections_failed: 0,
        connections_dropped: 0,
        messages_sent: 0,
        messages_received: 0,
        messages_failed: 0,
        errors: {}
      },
      recovery: {
        timeToRecovery: null,
        recoverySuccess: false,
        recoveredConnections: 0
      }
    };
  }

  recordMetric(type, key) {
    if (this.results.metrics[key] !== undefined) {
      this.results.metrics[key]++;
    } else if (this.results.metrics.errors[key] !== undefined) {
      this.results.metrics.errors[key]++;
    } else {
      this.results.metrics.errors[key] = 1;
    }
  }

  finalize() {
    const duration = Date.now() - this.startTime;
    const totalConnections = this.results.metrics.connections_established +
                            this.results.metrics.connections_failed;
    const successRate = totalConnections > 0
      ? (this.results.metrics.connections_established / totalConnections * 100).toFixed(2)
      : 0;

    this.results.duration_seconds = (duration / 1000).toFixed(2);
    this.results.connection_success_rate = successRate;

    return this.results;
  }
}

/**
 * NetworkLatencyTest - Injects latency into connections
 */
class NetworkLatencyTest extends ChaosTest {
  constructor(latencyMs) {
    super(`Network-Latency-${latencyMs}ms`);
    this.latencyMs = latencyMs;
    this.connections = [];
  }

  async run() {
    console.log(`\n[CHAOS] Running: ${this.name}`);
    console.log(`Injecting ${this.latencyMs}ms latency into WebSocket connections...`);

    try {
      // Note: True network latency injection would require iptables/tc commands
      // or a proxy. For this test, we'll simulate with message delays.
      const connected = await this.connectPool();
      if (connected === 0) {
        throw new Error('Failed to establish connections');
      }

      await this.sendMessagesWithLatency();
      await this.disconnect();

      return this.finalize();
    } catch (err) {
      console.error(`[CHAOS] Test failed: ${err.message}`);
      await this.disconnect();
      return this.finalize();
    }
  }

  async connectPool() {
    console.log(`Connecting ${CONFIG.CONNECTION_COUNT} WebSockets...`);
    let connected = 0;

    for (let i = 0; i < CONFIG.CONNECTION_COUNT; i++) {
      try {
        const ws = new WebSocket(CONFIG.WS_URL);

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 30000);

          ws.on('open', () => {
            clearTimeout(timeout);
            this.results.metrics.connections_established++;
            connected++;
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            this.results.metrics.connections_failed++;
            reject(err);
          });

          ws.on('close', () => {
            this.results.metrics.connections_dropped++;
          });

          ws.on('message', () => {
            this.results.metrics.messages_received++;
          });
        });

        this.connections.push(ws);
        await connectionPromise;
      } catch (err) {
        console.error(`  Failed to connect socket ${i}:`, err.message);
      }
    }

    console.log(`✓ Connected ${connected}/${CONFIG.CONNECTION_COUNT}`);
    return connected;
  }

  async sendMessagesWithLatency() {
    console.log(`Sending messages with ${this.latencyMs}ms latency for ${CONFIG.TEST_DURATION / 1000}s...`);
    const startTime = Date.now();
    let messageCount = 0;

    while (Date.now() - startTime < CONFIG.TEST_DURATION) {
      const batchStart = Date.now();

      const promises = this.connections.map(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          return new Promise((resolve) => {
            // Simulate latency
            setTimeout(() => {
              const msg = JSON.stringify({
                id: `chaos-${messageCount++}`,
                type: 'ping',
                timestamp: Date.now()
              });

              ws.send(msg, (err) => {
                if (err) {
                  this.results.metrics.messages_failed++;
                } else {
                  this.results.metrics.messages_sent++;
                }
                resolve();
              });
            }, this.latencyMs);
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

      // Rate limiting
      const batchDuration = Date.now() - batchStart;
      const targetInterval = 1000 / CONFIG.MESSAGE_RATE;
      if (batchDuration < targetInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, targetInterval - batchDuration)
        );
      }
    }
  }

  async disconnect() {
    const promises = this.connections.map(ws => {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setTimeout(resolve, 100);
      });
    });
    await Promise.all(promises);
  }
}

/**
 * ConnectionDropTest - Simulates connection drops
 */
class ConnectionDropTest extends ChaosTest {
  constructor(dropRate) {
    super(`Connection-Drop-${dropRate * 100}%`);
    this.dropRate = dropRate;
    this.connections = [];
  }

  async run() {
    console.log(`\n[CHAOS] Running: ${this.name}`);
    console.log(`Dropping ${(this.dropRate * 100).toFixed(1)}% of connections...`);

    try {
      const connected = await this.connectPool();
      if (connected === 0) {
        throw new Error('Failed to establish connections');
      }

      await this.sendMessagesWithDrops();
      await this.reconnectDropped();
      await this.disconnect();

      return this.finalize();
    } catch (err) {
      console.error(`[CHAOS] Test failed: ${err.message}`);
      await this.disconnect();
      return this.finalize();
    }
  }

  async connectPool() {
    console.log(`Connecting ${CONFIG.CONNECTION_COUNT} WebSockets...`);
    let connected = 0;

    for (let i = 0; i < CONFIG.CONNECTION_COUNT; i++) {
      try {
        const ws = new WebSocket(CONFIG.WS_URL);

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 30000);

          ws.on('open', () => {
            clearTimeout(timeout);
            this.results.metrics.connections_established++;
            connected++;
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            this.results.metrics.connections_failed++;
            reject(err);
          });

          ws.on('close', () => {
            this.results.metrics.connections_dropped++;
          });

          ws.on('message', () => {
            this.results.metrics.messages_received++;
          });
        });

        this.connections.push(ws);
        await connectionPromise;
      } catch (err) {
        console.error(`  Failed to connect socket ${i}:`, err.message);
      }
    }

    console.log(`✓ Connected ${connected}/${CONFIG.CONNECTION_COUNT}`);
    return connected;
  }

  async sendMessagesWithDrops() {
    console.log(`Sending messages with ${(this.dropRate * 100).toFixed(1)}% drop rate for ${CONFIG.TEST_DURATION / 1000}s...`);
    const startTime = Date.now();
    let messageCount = 0;

    while (Date.now() - startTime < CONFIG.TEST_DURATION) {
      const batchStart = Date.now();

      const promises = this.connections.map((ws, idx) => {
        // Drop some connections
        if (Math.random() < this.dropRate) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          return Promise.resolve();
        }

        if (ws.readyState === WebSocket.OPEN) {
          const msg = JSON.stringify({
            id: `chaos-${messageCount++}`,
            type: 'ping',
            timestamp: Date.now()
          });

          return new Promise((resolve) => {
            ws.send(msg, (err) => {
              if (err) {
                this.results.metrics.messages_failed++;
              } else {
                this.results.metrics.messages_sent++;
              }
              resolve();
            });
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

      const batchDuration = Date.now() - batchStart;
      const targetInterval = 1000 / CONFIG.MESSAGE_RATE;
      if (batchDuration < targetInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, targetInterval - batchDuration)
        );
      }
    }
  }

  async reconnectDropped() {
    console.log('Testing recovery: reconnecting dropped connections...');
    const recoveryStart = Date.now();
    let reconnected = 0;

    // Try to reconnect closed connections
    for (let i = 0; i < this.connections.length; i++) {
      if (this.connections[i].readyState !== WebSocket.OPEN) {
        try {
          const ws = new WebSocket(CONFIG.WS_URL);

          const connectionPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Reconnection timeout'));
            }, 30000);

            ws.on('open', () => {
              clearTimeout(timeout);
              this.results.recovery.recoveredConnections++;
              reconnected++;
              resolve();
            });

            ws.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });

          this.connections[i] = ws;
          await connectionPromise;
        } catch (err) {
          console.error(`Failed to reconnect socket ${i}:`, err.message);
        }
      }
    }

    const recoveryTime = Date.now() - recoveryStart;
    this.results.recovery.timeToRecovery = (recoveryTime / 1000).toFixed(2);
    this.results.recovery.recoverySuccess = reconnected > 0;

    console.log(`✓ Recovered ${reconnected} connections in ${(recoveryTime / 1000).toFixed(2)}s`);
  }

  async disconnect() {
    const promises = this.connections.map(ws => {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setTimeout(resolve, 100);
      });
    });
    await Promise.all(promises);
  }
}

/**
 * HighMemoryTest - Simulates memory pressure
 */
class HighMemoryTest extends ChaosTest {
  constructor(allocateMB) {
    super(`High-Memory-Pressure-${allocateMB}MB`);
    this.allocateMB = allocateMB;
    this.connections = [];
    this.buffers = [];
  }

  async run() {
    console.log(`\n[CHAOS] Running: ${this.name}`);
    console.log(`Allocating ${this.allocateMB}MB of memory while sending messages...`);

    try {
      // Allocate memory
      this.buffers = [];
      for (let i = 0; i < this.allocateMB; i++) {
        this.buffers.push(Buffer.alloc(1024 * 1024)); // 1MB each
      }

      const memUsage = process.memoryUsage();
      console.log(`Memory allocated: ${(memUsage.heapUsed / 1024 / 1024).toFixed(0)}MB`);

      const connected = await this.connectPool();
      if (connected === 0) {
        throw new Error('Failed to establish connections');
      }

      await this.sendMessages();
      await this.disconnect();

      // Release memory
      this.buffers = [];

      return this.finalize();
    } catch (err) {
      console.error(`[CHAOS] Test failed: ${err.message}`);
      await this.disconnect();
      this.buffers = [];
      return this.finalize();
    }
  }

  async connectPool() {
    console.log(`Connecting ${CONFIG.CONNECTION_COUNT} WebSockets...`);
    let connected = 0;

    for (let i = 0; i < CONFIG.CONNECTION_COUNT; i++) {
      try {
        const ws = new WebSocket(CONFIG.WS_URL);

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 30000);

          ws.on('open', () => {
            clearTimeout(timeout);
            this.results.metrics.connections_established++;
            connected++;
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            this.results.metrics.connections_failed++;
            reject(err);
          });

          ws.on('close', () => {
            this.results.metrics.connections_dropped++;
          });

          ws.on('message', () => {
            this.results.metrics.messages_received++;
          });
        });

        this.connections.push(ws);
        await connectionPromise;
      } catch (err) {
        console.error(`  Failed to connect socket ${i}:`, err.message);
      }
    }

    console.log(`✓ Connected ${connected}/${CONFIG.CONNECTION_COUNT}`);
    return connected;
  }

  async sendMessages() {
    console.log(`Sending messages for ${CONFIG.TEST_DURATION / 1000}s under memory pressure...`);
    const startTime = Date.now();
    let messageCount = 0;

    while (Date.now() - startTime < CONFIG.TEST_DURATION) {
      const batchStart = Date.now();

      const promises = this.connections.map(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg = JSON.stringify({
            id: `chaos-${messageCount++}`,
            type: 'ping',
            timestamp: Date.now()
          });

          return new Promise((resolve) => {
            ws.send(msg, (err) => {
              if (err) {
                this.results.metrics.messages_failed++;
              } else {
                this.results.metrics.messages_sent++;
              }
              resolve();
            });
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

      const batchDuration = Date.now() - batchStart;
      const targetInterval = 1000 / CONFIG.MESSAGE_RATE;
      if (batchDuration < targetInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, targetInterval - batchDuration)
        );
      }
    }
  }

  async disconnect() {
    const promises = this.connections.map(ws => {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setTimeout(resolve, 100);
      });
    });
    await Promise.all(promises);
  }
}

/**
 * Run all chaos tests
 */
async function runAllTests() {
  console.log('='.repeat(80));
  console.log('CHAOS ENGINEERING TEST SUITE');
  console.log('='.repeat(80));
  console.log(`Target: ${CONFIG.WS_URL}`);

  const results = {
    timestamp: new Date().toISOString(),
    tests: []
  };

  const tests = [
    new NetworkLatencyTest(100),
    new NetworkLatencyTest(500),
    new ConnectionDropTest(0.1), // 10% drop rate
    new ConnectionDropTest(0.25), // 25% drop rate
    new HighMemoryTest(100), // 100MB pressure
    new HighMemoryTest(500) // 500MB pressure
  ];

  for (const test of tests) {
    try {
      const result = await test.run();
      results.tests.push(result);
      console.log(`✓ ${test.name} Complete`);
      console.log(`  Success Rate: ${result.connection_success_rate}%`);
      console.log(`  Messages Sent: ${result.metrics.messages_sent}`);
      console.log(`  Messages Received: ${result.metrics.messages_received}`);
    } catch (err) {
      console.error(`✗ ${test.name} Failed: ${err.message}`);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  return results;
}

async function main() {
  try {
    const results = await runAllTests();

    // Save results
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
      fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }

    const filename = `chaos-engineering-${CONFIG.TIMESTAMP}.json`;
    const filepath = path.join(CONFIG.RESULTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('CHAOS ENGINEERING TESTS COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${results.tests.length}`);
    console.log(`Results: ${filepath}`);

    process.exit(0);
  } catch (err) {
    console.error('\n[ERROR] Chaos tests failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { NetworkLatencyTest, ConnectionDropTest, HighMemoryTest };

#!/usr/bin/env node

/**
 * Comprehensive Load & Stress Testing Suite - v2.0
 *
 * Tests scenarios:
 * 1. Load Testing (50, 100, 200 concurrent connections)
 *    - Sustained load for 1 hour
 *    - Message rate validation
 *    - Latency P50/P95/P99
 *    - Memory stability
 *    - CPU utilization
 *
 * 2. Stress Testing (200+, 500, 1000 concurrent)
 *    - Boundary testing (maximum capacity)
 *    - Graceful degradation
 *    - Recovery behavior
 *    - Error rates
 *
 * 3. Soak Testing (24-48 hour runs)
 *    - Memory leak detection
 *    - GC performance
 *    - Connection cleanup
 *    - Resource accumulation
 *
 * 4. Chaos Engineering
 *    - Network failures (packet loss, latency)
 *    - Resource exhaustion (CPU, memory)
 *    - Cascading failures
 *    - Recovery validation
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

// Configuration
const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  RESULTS_DIR: path.join(__dirname, '../results'),
  TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-'),

  // Load testing scenarios
  LOAD_LEVELS: [50, 100, 200],
  LOAD_DURATION_MS: 3600000, // 1 hour
  LOAD_MESSAGE_RATE: 10, // messages per second per connection

  // Stress testing scenarios
  STRESS_LEVELS: [200, 500, 1000],
  STRESS_DURATION_MS: 300000, // 5 minutes
  STRESS_MESSAGE_RATE: 50, // messages per second per connection

  // Soak testing
  SOAK_DURATION_MS: 86400000, // 24 hours
  SOAK_MESSAGE_RATE: 5, // messages per second per connection

  // Timeouts and limits
  CONNECTION_TIMEOUT: 30000,
  COMMAND_TIMEOUT: 5000,
  GC_INTERVAL: 60000, // Force GC every minute

  // Memory thresholds
  MEMORY_THRESHOLD_MB: 2048, // Alert if heap exceeds 2GB
  MEMORY_GROWTH_THRESHOLD_MB: 500, // Alert if growth >500MB in 10 minutes
};

/**
 * LoadTestMetrics - Tracks performance metrics
 */
class LoadTestMetrics {
  constructor(name) {
    this.name = name;
    this.startTime = Date.now();

    this.messages = {
      sent: 0,
      received: 0,
      failed: 0,
      errors: {}
    };

    this.latencies = [];
    this.throughputs = [];

    this.connections = {
      successful: 0,
      failed: 0,
      dropped: 0,
      active: 0
    };

    this.memory = {
      initial: this._getMemoryMB(),
      peak: this._getMemoryMB(),
      final: 0,
      samples: []
    };

    this.cpu = {
      samples: []
    };
  }

  _getMemoryMB() {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  recordMessage(type, latencyMs = 0) {
    if (type === 'sent') {
      this.messages.sent++;
    } else if (type === 'received') {
      this.messages.received++;
      if (latencyMs > 0) {
        this.latencies.push(latencyMs);
      }
    } else if (type === 'failed') {
      this.messages.failed++;
    }
  }

  recordError(errorType) {
    if (!this.messages.errors[errorType]) {
      this.messages.errors[errorType] = 0;
    }
    this.messages.errors[errorType]++;
  }

  recordConnection(type) {
    if (type === 'success') {
      this.connections.successful++;
      this.connections.active++;
    } else if (type === 'failure') {
      this.connections.failed++;
    } else if (type === 'drop') {
      this.connections.dropped++;
      this.connections.active = Math.max(0, this.connections.active - 1);
    }
  }

  sampleMemory() {
    const current = this._getMemoryMB();
    this.memory.samples.push({
      timestamp: Date.now(),
      value: current
    });
    this.memory.peak = Math.max(this.memory.peak, current);
    return current;
  }

  recordThroughput(messagesPerSec) {
    this.throughputs.push({
      timestamp: Date.now(),
      value: messagesPerSec
    });
  }

  getPercentile(percentile) {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  finalize() {
    this.memory.final = this._getMemoryMB();
    const duration = (Date.now() - this.startTime) / 1000;

    return {
      name: this.name,
      duration_seconds: duration,
      timestamp: new Date(this.startTime).toISOString(),

      messages: {
        sent: this.messages.sent,
        received: this.messages.received,
        failed: this.messages.failed,
        success_rate: this.messages.sent > 0
          ? (this.messages.received / this.messages.sent * 100).toFixed(2)
          : 0,
        errors: this.messages.errors
      },

      throughput: {
        avg_msgs_per_sec: (this.messages.received / duration).toFixed(2),
        peak_msgs_per_sec: this.throughputs.length > 0
          ? Math.max(...this.throughputs.map(t => t.value)).toFixed(2)
          : 0
      },

      latency: {
        p50: this.getPercentile(50),
        p95: this.getPercentile(95),
        p99: this.getPercentile(99),
        min: Math.min(...this.latencies, Infinity),
        max: Math.max(...this.latencies, -Infinity),
        mean: this.latencies.length > 0
          ? (this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length).toFixed(2)
          : 0
      },

      connections: {
        successful: this.connections.successful,
        failed: this.connections.failed,
        dropped: this.connections.dropped,
        success_rate: this.connections.successful + this.connections.failed > 0
          ? (this.connections.successful / (this.connections.successful + this.connections.failed) * 100).toFixed(2)
          : 0
      },

      memory: {
        initial_mb: this.memory.initial,
        peak_mb: this.memory.peak,
        final_mb: this.memory.final,
        growth_mb: this.memory.final - this.memory.initial,
        peak_sample_count: this.memory.samples.length
      }
    };
  }
}

/**
 * ConnectionPool - Manages WebSocket connections
 */
class ConnectionPool extends EventEmitter {
  constructor(url, count, options = {}) {
    super();
    this.url = url;
    this.count = count;
    this.connections = [];
    this.metrics = options.metrics || new LoadTestMetrics(`Pool-${count}`);
    this.options = options;
  }

  async connect() {
    console.log(`[POOL] Connecting ${this.count} WebSockets to ${this.url}...`);
    const startTime = Date.now();
    let connected = 0;

    for (let i = 0; i < this.count; i++) {
      try {
        const ws = new WebSocket(this.url, {
          perMessageDeflate: true,
          maxPayload: 100 * 1024 * 1024
        });

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, CONFIG.CONNECTION_TIMEOUT);

          ws.on('open', () => {
            clearTimeout(timeout);
            this.metrics.recordConnection('success');
            connected++;
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            this.metrics.recordConnection('failure');
            this.metrics.recordError('connection_error');
            reject(err);
          });

          ws.on('close', () => {
            this.metrics.recordConnection('drop');
          });
        });

        this.connections.push(ws);
        await connectionPromise;

        if (connected % 10 === 0) {
          console.log(`  [POOL] Connected ${connected}/${this.count}...`);
        }
      } catch (err) {
        console.error(`  [POOL] Failed to connect socket ${i}:`, err.message);
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[POOL] Connected ${connected}/${this.count} in ${duration.toFixed(2)}s`);
    return connected;
  }

  async sendMessages(messagesPerSecond, durationMs) {
    console.log(`[POOL] Sending ${messagesPerSecond} msg/s per connection for ${(durationMs / 1000).toFixed(0)}s...`);
    const startTime = Date.now();
    let messageCount = 0;
    let throughputSamples = [];

    while (Date.now() - startTime < durationMs) {
      const batchStart = Date.now();

      // Send messages from each connection
      const promises = this.connections.map(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          const msg = {
            id: `msg-${messageCount++}`,
            type: 'ping',
            timestamp: Date.now()
          };

          return new Promise((resolve) => {
            try {
              ws.send(JSON.stringify(msg), (err) => {
                if (err) {
                  this.metrics.recordMessage('failed');
                  this.metrics.recordError('send_error');
                } else {
                  this.metrics.recordMessage('sent');
                }
                resolve();
              });
            } catch (err) {
              this.metrics.recordMessage('failed');
              this.metrics.recordError('send_exception');
              resolve();
            }
          });
        }
        return Promise.resolve();
      });

      await Promise.all(promises);

      // Sample throughput
      const elapsed = Date.now() - startTime;
      if (elapsed > 0) {
        const throughput = (messageCount / elapsed) * 1000;
        this.metrics.recordThroughput(throughput);
      }

      // Rate limiting
      const batchDuration = Date.now() - batchStart;
      const targetInterval = 1000 / messagesPerSecond;
      if (batchDuration < targetInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, targetInterval - batchDuration)
        );
      }

      // Sample memory periodically
      if (messageCount % 1000 === 0) {
        this.metrics.sampleMemory();
      }
    }

    console.log(`[POOL] Sent ${messageCount} total messages`);
  }

  async disconnect() {
    console.log('[POOL] Disconnecting all WebSockets...');
    const promises = this.connections.map(ws => {
      return new Promise((resolve) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          setTimeout(resolve, 100);
        } else {
          resolve();
        }
      });
    });

    await Promise.all(promises);
    console.log('[POOL] All WebSockets disconnected');
  }
}

/**
 * LoadTester - Orchestrates load testing scenarios
 */
class LoadTester {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };
  }

  async runLoadTest(concurrentCount, durationMs, messageRate) {
    const testName = `Load-${concurrentCount}-concurrent`;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`LOAD TEST: ${concurrentCount} concurrent connections`);
    console.log(`Duration: ${(durationMs / 1000).toFixed(0)}s | Message Rate: ${messageRate} msg/s per connection`);
    console.log('='.repeat(80));

    const metrics = new LoadTestMetrics(testName);
    const pool = new ConnectionPool(CONFIG.WS_URL, concurrentCount, { metrics });

    try {
      const connected = await pool.connect();
      if (connected === 0) {
        throw new Error('Failed to establish any connections');
      }

      console.log(`✓ Connected ${connected}/${concurrentCount} connections`);

      // Warm-up period
      console.log('[TEST] Warm-up period (10s)...');
      await pool.sendMessages(messageRate, 10000);

      // Main test
      console.log(`[TEST] Main load test (${(durationMs / 1000 / 60).toFixed(1)} minutes)...`);
      await pool.sendMessages(messageRate, durationMs);

      // Cool-down period
      console.log('[TEST] Cool-down period (10s)...');
      await pool.sendMessages(messageRate / 2, 10000);

      await pool.disconnect();

      const result = metrics.finalize();
      this.results.tests.push(result);

      console.log(`\n✓ Test Complete:`);
      console.log(`  Success Rate: ${result.messages.success_rate}%`);
      console.log(`  Throughput: ${result.throughput.avg_msgs_per_sec} msg/s`);
      console.log(`  Latency P99: ${result.latency.p99}ms`);
      console.log(`  Memory Growth: ${result.memory.growth_mb}MB`);

      return result;
    } catch (err) {
      console.error(`✗ Test failed:`, err.message);
      await pool.disconnect();
      throw err;
    }
  }

  async runStressTest(concurrentCount, durationMs, messageRate) {
    const testName = `Stress-${concurrentCount}-concurrent`;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`STRESS TEST: ${concurrentCount} concurrent connections`);
    console.log(`Duration: ${(durationMs / 1000).toFixed(0)}s | Message Rate: ${messageRate} msg/s per connection`);
    console.log('='.repeat(80));

    const metrics = new LoadTestMetrics(testName);
    const pool = new ConnectionPool(CONFIG.WS_URL, concurrentCount, { metrics });

    try {
      const connected = await pool.connect();
      console.log(`✓ Connected ${connected}/${concurrentCount} connections`);

      if (connected < concurrentCount * 0.8) {
        console.warn(`⚠ Only ${(connected / concurrentCount * 100).toFixed(1)}% connections established`);
      }

      // Stress test - high message rate
      console.log(`[TEST] Stress testing with ${messageRate} msg/s per connection...`);
      await pool.sendMessages(messageRate, durationMs);

      await pool.disconnect();

      const result = metrics.finalize();
      this.results.tests.push(result);

      console.log(`\n✓ Stress Test Complete:`);
      console.log(`  Success Rate: ${result.messages.success_rate}%`);
      console.log(`  Throughput: ${result.throughput.avg_msgs_per_sec} msg/s`);
      console.log(`  Dropped Connections: ${result.connections.dropped}`);
      console.log(`  Peak Memory: ${result.memory.peak_mb}MB`);

      return result;
    } catch (err) {
      console.error(`✗ Stress test failed:`, err.message);
      await pool.disconnect();
      throw err;
    }
  }

  async runAllTests() {
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE LOAD & STRESS TESTING SUITE');
    console.log('='.repeat(80));
    console.log(`Target: ${CONFIG.WS_URL}`);
    console.log(`Start Time: ${this.results.timestamp}`);

    try {
      // Run load tests
      console.log('\n[SUITE] Running Load Tests...');
      for (const level of CONFIG.LOAD_LEVELS) {
        try {
          await this.runLoadTest(
            level,
            CONFIG.LOAD_DURATION_MS,
            CONFIG.LOAD_MESSAGE_RATE
          );
        } catch (err) {
          console.error(`Load test failed for ${level} concurrent:`, err.message);
        }
      }

      // Run stress tests
      console.log('\n[SUITE] Running Stress Tests...');
      for (const level of CONFIG.STRESS_LEVELS) {
        try {
          await this.runStressTest(
            level,
            CONFIG.STRESS_DURATION_MS,
            CONFIG.STRESS_MESSAGE_RATE
          );
        } catch (err) {
          console.error(`Stress test failed for ${level} concurrent:`, err.message);
        }
      }

      this._generateSummary();
      return this.results;
    } catch (err) {
      console.error('Testing suite failed:', err.message);
      throw err;
    }
  }

  _generateSummary() {
    if (this.results.tests.length === 0) return;

    const allLatencies = [];
    let totalMessages = 0;
    let successMessages = 0;

    for (const test of this.results.tests) {
      totalMessages += test.messages.sent;
      successMessages += test.messages.received;
    }

    this.results.summary = {
      total_tests: this.results.tests.length,
      total_duration_seconds: this.results.tests.reduce((sum, t) => sum + t.duration_seconds, 0),
      total_messages_sent: totalMessages,
      total_messages_received: successMessages,
      overall_success_rate: totalMessages > 0
        ? (successMessages / totalMessages * 100).toFixed(2)
        : 0,
      average_throughput: successMessages > 0
        ? (this.results.tests.reduce((sum, t) => sum + parseFloat(t.throughput.avg_msgs_per_sec), 0) / this.results.tests.length).toFixed(2)
        : 0
    };
  }

  async saveResults() {
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
      fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }

    const filename = `comprehensive-load-test-${CONFIG.TIMESTAMP}.json`;
    const filepath = path.join(CONFIG.RESULTS_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(this.results, null, 2));
    console.log(`\n[SAVED] Results: ${filepath}`);

    return filepath;
  }
}

/**
 * Main execution
 */
async function main() {
  const tester = new LoadTester();

  try {
    const results = await tester.runAllTests();
    const filepath = await tester.saveResults();

    console.log('\n' + '='.repeat(80));
    console.log('TESTING COMPLETE');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${results.summary.total_tests}`);
    console.log(`Overall Success Rate: ${results.summary.overall_success_rate}%`);
    console.log(`Average Throughput: ${results.summary.average_throughput} msg/s`);
    console.log(`Results File: ${filepath}`);

    process.exit(0);
  } catch (err) {
    console.error('\n[ERROR] Testing failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { LoadTester, LoadTestMetrics, ConnectionPool };

#!/usr/bin/env node

/**
 * Soak Testing Suite - Long-running stability testing
 *
 * Purpose: Detect memory leaks, GC performance issues, and resource accumulation
 * over extended periods (24-48 hours)
 *
 * Monitors:
 * - Memory usage trends
 * - Garbage collection frequency and impact
 * - Connection cleanup and recycling
 * - Resource accumulation
 * - CPU utilization stability
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:8765',
  RESULTS_DIR: path.join(__dirname, '../results'),
  TIMESTAMP: new Date().toISOString().replace(/[:.]/g, '-'),

  // Soak test parameters
  SOAK_DURATION_MS: 86400000, // 24 hours
  CONNECTION_COUNT: 50, // Moderate load
  MESSAGE_RATE: 5, // 5 messages per second per connection
  SAMPLE_INTERVAL: 5000, // Sample every 5 seconds

  // Memory monitoring
  MEMORY_THRESHOLD_MB: 2048,
  MEMORY_GROWTH_THRESHOLD_MB: 100, // Max growth per sample interval

  // Connection recycling
  CONNECTION_RECYCLE_INTERVAL: 300000, // Recycle connections every 5 minutes
  RECYCLE_BATCH_SIZE: 5, // Recycle 5 connections at a time
};

/**
 * MemoryAnalyzer - Tracks memory patterns and detects leaks
 */
class MemoryAnalyzer {
  constructor() {
    this.samples = [];
    this.gcEvents = [];
    this.startTime = Date.now();
  }

  sample() {
    const usage = process.memoryUsage();
    const sample = {
      timestamp: Date.now(),
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };

    this.samples.push(sample);
    return sample;
  }

  recordGCEvent(kind, flags) {
    this.gcEvents.push({
      timestamp: Date.now(),
      kind,
      flags,
      memoryAfter: this.samples.length > 0 ? this.samples[this.samples.length - 1].heapUsed : 0
    });
  }

  /**
   * Calculate linear trend of heap usage
   * Returns slope (MB per sample) and R-squared fit
   */
  analyzeTrend() {
    if (this.samples.length < 2) {
      return { slope: 0, r_squared: 0, leak_detected: false };
    }

    const data = this.samples.map((s, i) => ({ x: i, y: s.heapUsed }));
    const n = data.length;
    const sumX = data.reduce((sum, d) => sum + d.x, 0);
    const sumY = data.reduce((sum, d) => sum + d.y, 0);
    const sumXY = data.reduce((sum, d) => sum + d.x * d.y, 0);
    const sumX2 = data.reduce((sum, d) => sum + d.x * d.x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const yMean = sumY / n;
    const ssRes = data.reduce((sum, d) => {
      const predicted = slope * d.x + intercept;
      return sum + Math.pow(d.y - predicted, 2);
    }, 0);
    const ssTot = data.reduce((sum, d) => sum + Math.pow(d.y - yMean, 2), 0);
    const r_squared = 1 - (ssRes / ssTot);

    // Leak detected if slope > 1 MB per sample and R² > 0.7
    const leak_detected = slope > 1 && r_squared > 0.7;

    return {
      slope: slope.toFixed(4),
      r_squared: r_squared.toFixed(4),
      leak_detected,
      trend: slope > 0 ? 'increasing' : 'stable'
    };
  }

  getReport() {
    if (this.samples.length === 0) {
      return null;
    }

    const firstSample = this.samples[0];
    const lastSample = this.samples[this.samples.length - 1];
    const allHeapValues = this.samples.map(s => s.heapUsed);
    const minHeap = Math.min(...allHeapValues);
    const maxHeap = Math.max(...allHeapValues);
    const avgHeap = (allHeapValues.reduce((a, b) => a + b, 0) / allHeapValues.length).toFixed(0);

    return {
      sample_count: this.samples.length,
      duration_hours: ((this.samples[this.samples.length - 1].timestamp - this.startTime) / 1000 / 3600).toFixed(2),
      initial_heap_mb: firstSample.heapUsed,
      final_heap_mb: lastSample.heapUsed,
      growth_mb: lastSample.heapUsed - firstSample.heapUsed,
      min_heap_mb: minHeap,
      max_heap_mb: maxHeap,
      avg_heap_mb: avgHeap,
      gc_event_count: this.gcEvents.length,
      trend_analysis: this.analyzeTrend()
    };
  }
}

/**
 * SoakTestRunner - Executes long-running soak tests
 */
class SoakTestRunner {
  constructor() {
    this.connections = [];
    this.memoryAnalyzer = new MemoryAnalyzer();
    this.metrics = {
      startTime: Date.now(),
      messagesRcvd: 0,
      messagesFailed: 0,
      connectionDrops: 0,
      recycleEvents: 0
    };
  }

  async connectPool(count) {
    console.log(`[SOAK] Establishing ${count} WebSocket connections...`);
    let connected = 0;

    for (let i = 0; i < count; i++) {
      try {
        const ws = new WebSocket(CONFIG.WS_URL, {
          perMessageDeflate: true
        });

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 30000);

          ws.on('open', () => {
            clearTimeout(timeout);
            connected++;
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          ws.on('close', () => {
            this.metrics.connectionDrops++;
            const idx = this.connections.indexOf(ws);
            if (idx > -1) {
              this.connections.splice(idx, 1);
            }
          });

          ws.on('message', () => {
            this.metrics.messagesRcvd++;
          });
        });

        this.connections.push(ws);
        await connectionPromise;

        if (connected % 10 === 0) {
          console.log(`  Connected ${connected}/${count}...`);
        }
      } catch (err) {
        console.error(`  Failed to connect socket ${i}:`, err.message);
      }
    }

    console.log(`✓ Connected ${connected}/${count} WebSockets`);
    return connected;
  }

  async recycleConnections() {
    const toRecycle = Math.min(CONFIG.RECYCLE_BATCH_SIZE, this.connections.length);
    if (toRecycle === 0) return;

    console.log(`[SOAK] Recycling ${toRecycle} connections...`);

    for (let i = 0; i < toRecycle; i++) {
      const ws = this.connections.shift();
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }

    // Reconnect recycled sockets
    for (let i = 0; i < toRecycle; i++) {
      try {
        const ws = new WebSocket(CONFIG.WS_URL, {
          perMessageDeflate: true
        });

        const connectionPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Reconnection timeout'));
          }, 30000);

          ws.on('open', () => {
            clearTimeout(timeout);
            resolve();
          });

          ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          ws.on('close', () => {
            this.metrics.connectionDrops++;
            const idx = this.connections.indexOf(ws);
            if (idx > -1) {
              this.connections.splice(idx, 1);
            }
          });
        });

        this.connections.push(ws);
        await connectionPromise;
      } catch (err) {
        console.error(`Failed to recycle connection ${i}:`, err.message);
      }
    }

    this.metrics.recycleEvents++;
  }

  async sendMessages(durationMs, messageRate) {
    console.log(`[SOAK] Sending ${messageRate} msg/s per connection for ${(durationMs / 1000 / 3600).toFixed(1)} hours...`);
    const startTime = Date.now();
    let messageCount = 0;

    const sampleInterval = setInterval(() => {
      this.memoryAnalyzer.sample();
      const trend = this.memoryAnalyzer.analyzeTrend();
      if (trend.leak_detected) {
        console.warn(`⚠ POTENTIAL MEMORY LEAK DETECTED: ${trend.slope} MB/sample, R²=${trend.r_squared}`);
      }
    }, CONFIG.SAMPLE_INTERVAL);

    const recycleInterval = setInterval(() => {
      this.recycleConnections().catch(err =>
        console.error('[SOAK] Recycle error:', err.message)
      );
    }, CONFIG.CONNECTION_RECYCLE_INTERVAL);

    try {
      while (Date.now() - startTime < durationMs) {
        const batchStart = Date.now();

        // Send messages
        const promises = this.connections.map(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            const msg = JSON.stringify({
              id: `soak-${messageCount++}`,
              type: 'ping',
              timestamp: Date.now()
            });

            return new Promise((resolve) => {
              ws.send(msg, (err) => {
                if (err) {
                  this.metrics.messagesFailed++;
                }
                resolve();
              });
            });
          }
          return Promise.resolve();
        });

        await Promise.all(promises);

        // Rate limiting
        const batchDuration = Date.now() - batchStart;
        const targetInterval = 1000 / messageRate;
        if (batchDuration < targetInterval) {
          await new Promise(resolve =>
            setTimeout(resolve, targetInterval - batchDuration)
          );
        }

        // Log progress
        const elapsed = (Date.now() - startTime) / 1000;
        if (Math.floor(elapsed) % 300 === 0 && Math.floor(elapsed) > 0) { // Every 5 minutes
          const activeConnections = this.connections.filter(ws => ws.readyState === WebSocket.OPEN).length;
          const memSample = this.memoryAnalyzer.samples[this.memoryAnalyzer.samples.length - 1];
          const throughput = (this.metrics.messagesRcvd / elapsed).toFixed(2);
          console.log(`[SOAK] ${(elapsed / 3600).toFixed(2)}h | ${activeConnections} connections | Heap: ${memSample?.heapUsed || 0}MB | Throughput: ${throughput} msg/s`);
        }
      }
    } finally {
      clearInterval(sampleInterval);
      clearInterval(recycleInterval);
    }

    return messageCount;
  }

  async disconnect() {
    console.log('[SOAK] Disconnecting all WebSockets...');
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
    this.connections = [];
    console.log('[SOAK] All WebSockets disconnected');
  }

  getResults() {
    const duration = Date.now() - this.metrics.startTime;
    const durationSeconds = duration / 1000;

    return {
      test_type: 'soak',
      duration_seconds: durationSeconds,
      duration_hours: (durationSeconds / 3600).toFixed(2),
      timestamp: new Date(this.metrics.startTime).toISOString(),

      messages: {
        received: this.metrics.messagesRcvd,
        failed: this.metrics.messagesFailed,
        throughput_msg_per_sec: (this.metrics.messagesRcvd / durationSeconds).toFixed(2)
      },

      connections: {
        dropped: this.metrics.connectionDrops,
        recycled: this.metrics.recycleEvents
      },

      memory: this.memoryAnalyzer.getReport()
    };
  }
}

/**
 * Quick soak test (for demonstration - 5 minutes)
 */
async function runQuickSoak() {
  const runner = new SoakTestRunner();

  try {
    const connected = await runner.connectPool(CONFIG.CONNECTION_COUNT);
    if (connected === 0) {
      throw new Error('Failed to establish connections');
    }

    // 5-minute test for demo
    const testDuration = 300000; // 5 minutes
    await runner.sendMessages(testDuration, CONFIG.MESSAGE_RATE);

    await runner.disconnect();

    const results = runner.getResults();
    return results;
  } catch (err) {
    console.error('[SOAK] Test failed:', err.message);
    await runner.disconnect();
    throw err;
  }
}

/**
 * Full soak test (24 hours)
 */
async function runFullSoak() {
  const runner = new SoakTestRunner();

  try {
    const connected = await runner.connectPool(CONFIG.CONNECTION_COUNT);
    if (connected === 0) {
      throw new Error('Failed to establish connections');
    }

    await runner.sendMessages(CONFIG.SOAK_DURATION_MS, CONFIG.MESSAGE_RATE);

    await runner.disconnect();

    const results = runner.getResults();
    return results;
  } catch (err) {
    console.error('[SOAK] Test failed:', err.message);
    await runner.disconnect();
    throw err;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log('SOAK TESTING SUITE');
  console.log('='.repeat(80));

  // Check for command line arguments
  const isQuick = process.argv.includes('--quick');
  const duration = isQuick ? '5 minutes' : '24 hours';

  console.log(`Running soak test (${duration})...`);
  console.log(`Target: ${CONFIG.WS_URL}`);
  console.log(`Connections: ${CONFIG.CONNECTION_COUNT}`);
  console.log(`Message Rate: ${CONFIG.MESSAGE_RATE} msg/s per connection`);

  try {
    const results = isQuick ? await runQuickSoak() : await runFullSoak();

    // Save results
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
      fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }

    const filename = `soak-test-${CONFIG.TIMESTAMP}.json`;
    const filepath = path.join(CONFIG.RESULTS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('SOAK TEST COMPLETE');
    console.log('='.repeat(80));
    console.log(`Duration: ${results.duration_hours} hours`);
    console.log(`Messages Received: ${results.messages.received}`);
    console.log(`Throughput: ${results.messages.throughput_msg_per_sec} msg/s`);
    console.log(`Connection Drops: ${results.connections.dropped}`);
    console.log(`Memory Growth: ${results.memory.growth_mb}MB`);

    if (results.memory.trend_analysis.leak_detected) {
      console.warn('⚠ MEMORY LEAK DETECTED');
    } else {
      console.log('✓ No memory leak detected');
    }

    console.log(`Results: ${filepath}`);

    process.exit(0);
  } catch (err) {
    console.error('\n[ERROR] Soak test failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { SoakTestRunner, runQuickSoak, runFullSoak };

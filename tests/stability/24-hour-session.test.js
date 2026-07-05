/**
 * 24-Hour Continuous Session Stability Test
 * Tests a single WebSocket connection maintained for 24+ hours
 * Monitors: CPU, Memory, Connections, Error Rate
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const MONITORING_INTERVAL_MS = 60 * 1000; // Monitor every 60 seconds
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // Heartbeat every 30 seconds

class StabilityMonitor {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.testStartTime = null;
    this.metrics = {
      timestamp: new Date().toISOString(),
      testName: '24-Hour Continuous Session',
      duration: TEST_DURATION_MS,
      startTime: null,
      endTime: null,
      measurements: [],
      errors: [],
      successCount: 0,
      failureCount: 0,
      totalMessages: 0,
      memoryTrend: [],
      cpuTrend: [],
      connectionMetrics: {
        opened: 0,
        closed: 0,
        errors: 0,
        currentState: null
      }
    };
    this.heapSnapshots = [];
    this.lastHeapSnapshot = 0;
    this.monitoringActive = false;
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      memory: {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        rss: usage.rss,
        arrayBuffers: usage.arrayBuffers
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Record a heap snapshot every 4 hours
   */
  recordHeapSnapshot() {
    const now = Date.now();
    if (now - this.lastHeapSnapshot > 4 * 60 * 60 * 1000) {
      const metrics = this.getSystemMetrics();
      this.heapSnapshots.push(metrics);
      this.lastHeapSnapshot = now;
      console.log(`[HEAP SNAPSHOT] ${this.heapSnapshots.length} - ${metrics.isoTime} - Heap: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(WS_URL);
        const timeout = setTimeout(() => {
          reject(new Error(`Failed to connect to ${WS_URL}`));
        }, 30000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.metrics.connectionMetrics.opened++;
          this.metrics.connectionMetrics.currentState = 'open';
          console.log(`[CONNECTED] ${new Date().toISOString()}`);
          resolve();
        });

        this.ws.on('close', () => {
          this.metrics.connectionMetrics.closed++;
          this.metrics.connectionMetrics.currentState = 'closed';
          console.log(`[DISCONNECTED] ${new Date().toISOString()}`);
        });

        this.ws.on('error', (err) => {
          this.metrics.connectionMetrics.errors++;
          this.metrics.errors.push({
            timestamp: Date.now(),
            type: 'websocket_error',
            message: err.message
          });
          console.error(`[WS ERROR] ${err.message}`);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send command and measure latency
   */
  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const startTime = performance.now();
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout on ${command}`));
      }, 30000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);

            const latency = performance.now() - startTime;
            this.metrics.totalMessages++;

            if (response.success) {
              this.metrics.successCount++;
            } else {
              this.metrics.failureCount++;
              this.metrics.errors.push({
                timestamp: Date.now(),
                command,
                error: response.error
              });
            }

            resolve({ response, latency });
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Periodic heartbeat to keep connection alive
   */
  async heartbeat() {
    try {
      await this.sendCommand('ping');
    } catch (err) {
      this.metrics.errors.push({
        timestamp: Date.now(),
        type: 'heartbeat_failed',
        message: err.message
      });
    }
  }

  /**
   * Monitor system metrics
   */
  async monitor() {
    const metrics = this.getSystemMetrics();

    // Calculate memory growth since start
    const memoryGrowth = this.metrics.measurements.length > 0
      ? metrics.memory.heapUsed - this.metrics.measurements[0].memory.heapUsed
      : 0;

    const measurement = {
      ...metrics,
      memoryGrowth,
      successRate: this.metrics.totalMessages > 0
        ? (this.metrics.successCount / this.metrics.totalMessages * 100).toFixed(2)
        : 0,
      errorRate: this.metrics.totalMessages > 0
        ? (this.metrics.failureCount / this.metrics.totalMessages * 100).toFixed(2)
        : 0
    };

    this.metrics.measurements.push(measurement);
    this.metrics.memoryTrend.push(metrics.memory.heapUsed);
    this.metrics.cpuTrend.push(metrics.cpu.user + metrics.cpu.system);

    // Log every measurement
    const elapsedHours = (Date.now() - this.testStartTime) / 1000 / 3600;
    console.log(`[METRIC] ${elapsedHours.toFixed(2)}h - Heap: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB, ` +
      `Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB, ` +
      `Success: ${measurement.successRate}%, ` +
      `Errors: ${this.metrics.errors.length}`);

    this.recordHeapSnapshot();
  }

  /**
   * Run mixed workload operations
   */
  async runWorkload() {
    const operations = [
      { command: 'ping', weight: 0.3 },
      { command: 'status', weight: 0.3 },
      { command: 'list_tabs', weight: 0.2 },
      { command: 'get_page_state', weight: 0.2 }
    ];

    // Weighted random selection
    const rand = Math.random();
    let cumulative = 0;
    let selectedOp = operations[0];

    for (const op of operations) {
      cumulative += op.weight;
      if (rand < cumulative) {
        selectedOp = op;
        break;
      }
    }

    try {
      await this.sendCommand(selectedOp.command);
    } catch (err) {
      // Handled in sendCommand
    }
  }

  /**
   * Run the 24-hour test
   */
  async run() {
    console.log(`\n========================================`);
    console.log(`24-Hour Continuous Session Test`);
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    this.metrics.startTime = new Date().toISOString();
    this.testStartTime = Date.now();
    this.monitoringActive = true;

    try {
      // Connect
      await this.connect();
      console.log('Connected to WebSocket server');

      // Set up monitoring
      const monitoringInterval = setInterval(() => this.monitor(), MONITORING_INTERVAL_MS);
      const heartbeatInterval = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);

      // Run workload for 24 hours
      const startTime = Date.now();
      let operationCount = 0;

      while (Date.now() - startTime < TEST_DURATION_MS) {
        if (this.metrics.connectionMetrics.currentState === 'open') {
          await this.runWorkload();
          operationCount++;
        }

        // Add small delay between operations
        await new Promise(resolve => setTimeout(resolve, 100));

        // For testing, allow early exit with Ctrl+C
        if (!this.monitoringActive) {
          break;
        }
      }

      // Cleanup
      clearInterval(monitoringInterval);
      clearInterval(heartbeatInterval);

      console.log(`\nTest completed after ${operationCount} operations`);
    } catch (err) {
      console.error(`Test failed: ${err.message}`);
      this.metrics.errors.push({
        timestamp: Date.now(),
        type: 'test_failure',
        message: err.message
      });
    } finally {
      this.metrics.endTime = new Date().toISOString();
      if (this.ws) {
        this.ws.close();
      }
    }
  }

  /**
   * Generate stability analysis
   */
  generateReport() {
    const measurements = this.metrics.measurements;
    if (measurements.length === 0) {
      return null;
    }

    // Calculate statistics
    const memoryValues = measurements.map(m => m.memory.heapUsed);
    const minMemory = Math.min(...memoryValues);
    const maxMemory = Math.max(...memoryValues);
    const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;

    // Calculate memory growth rate (MB per hour)
    const firstMeasurement = measurements[0];
    const lastMeasurement = measurements[measurements.length - 1];
    const memoryGrowth = lastMeasurement.memory.heapUsed - firstMeasurement.memory.heapUsed;
    const elapsedHours = (lastMeasurement.timestamp - firstMeasurement.timestamp) / 1000 / 3600;
    const growthRatePerHour = elapsedHours > 0 ? (memoryGrowth / 1024 / 1024) / elapsedHours : 0;

    // Error analysis
    const errorsByType = {};
    this.metrics.errors.forEach(err => {
      const type = err.type || err.command || 'unknown';
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });

    return {
      testName: '24-Hour Continuous Session',
      duration: this.metrics.endTime && this.metrics.startTime
        ? (new Date(this.metrics.endTime) - new Date(this.metrics.startTime)) / 1000 / 60
        : 0,
      totalMessages: this.metrics.totalMessages,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount,
      successRate: (this.metrics.successCount / (this.metrics.successCount + this.metrics.failureCount) * 100).toFixed(2),
      memory: {
        minMB: (minMemory / 1024 / 1024).toFixed(2),
        maxMB: (maxMemory / 1024 / 1024).toFixed(2),
        avgMB: (avgMemory / 1024 / 1024).toFixed(2),
        growthMBPerHour: growthRatePerHour.toFixed(2)
      },
      connection: this.metrics.connectionMetrics,
      heapSnapshots: this.heapSnapshots.length,
      totalErrors: this.metrics.errors.length,
      errorsByType,
      timestamps: {
        start: this.metrics.startTime,
        end: this.metrics.endTime
      }
    };
  }

  /**
   * Save results to file
   */
  saveResults(directory) {
    const report = this.generateReport();
    if (!report) {
      console.log('No measurements recorded');
      return;
    }

    const timestamp = Date.now();
    const reportPath = path.join(directory, `24-hour-session-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify({
      report,
      heapSnapshots: this.heapSnapshots,
      measurements: this.metrics.measurements,
      errors: this.metrics.errors
    }, null, 2));

    console.log(`\nResults saved to ${reportPath}`);
    return reportPath;
  }
}

// Run test
if (require.main === module) {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const monitor = new StabilityMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down test...');
    monitor.monitoringActive = false;
  });

  monitor.run().then(() => {
    const reportPath = monitor.saveResults(resultsDir);
    const report = monitor.generateReport();

    console.log('\n========================================');
    console.log('24-Hour Test Summary');
    console.log('========================================');
    console.log(`Total Messages: ${report.totalMessages}`);
    console.log(`Success Rate: ${report.successRate}%`);
    console.log(`Memory Growth: ${report.memory.growthMBPerHour} MB/hour`);
    console.log(`Total Errors: ${report.totalErrors}`);
    console.log(`========================================\n`);

    process.exit(report.totalErrors > 0 ? 1 : 0);
  }).catch(err => {
    console.error(`Test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { StabilityMonitor };

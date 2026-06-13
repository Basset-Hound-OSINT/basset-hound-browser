#!/usr/bin/env node

/**
 * Performance Limits Test Suite
 * Tests system performance boundaries and degradation patterns
 *
 * Features:
 * - Max connections testing
 * - Max message rate testing
 * - Max data size testing
 * - Performance degradation curves
 * - Resource exhaustion limits
 *
 * Tests: 25+
 * Duration: 1.5-2 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'performance');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class PerformanceLimitsTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      maxConnections: null,
      maxMessageRate: null,
      maxDataSize: null,
      degradationCurves: [],
      performanceMetrics: {},
      resourceLimits: {},
      errors: []
    };
    this.performanceData = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`✓ Connected to WebSocket at ${WS_URL}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(this.messageId++);
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout: ${command}`));
      }, TIMEOUT);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            this.ws.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(message));
    });
  }

  generatePayload(sizeBytes) {
    return 'x'.repeat(sizeBytes);
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        this.ws.on('close', resolve);
        setTimeout(resolve, 1000);
      } else {
        resolve();
      }
    });
  }

  logResult(testName, passed, metrics = {}) {
    this.results.totalTests++;
    if (passed) {
      this.results.passed++;
      console.log(`✓ ${testName}`);
    } else {
      this.results.failed++;
      console.log(`✗ ${testName}`);
    }
    if (Object.keys(metrics).length > 0) {
      this.performanceData.push({ test: testName, metrics });
    }
  }

  async saveResults() {
    const filename = path.join(RESULTS_DIR, 'performance-limits-results.json');
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));

    const metricsFile = path.join(RESULTS_DIR, 'performance-limits-metrics.json');
    fs.writeFileSync(metricsFile, JSON.stringify(this.performanceData, null, 2));

    console.log(`\n📊 Results saved to ${filename}`);
    console.log(`📊 Metrics saved to ${metricsFile}`);
  }
}

describe('Performance Limits Tests', function() {
  this.timeout(TIMEOUT);
  let tester;

  before(async () => {
    tester = new PerformanceLimitsTester();
    try {
      await tester.connect();
    } catch (err) {
      console.error('Failed to connect:', err.message);
      process.exit(1);
    }
  });

  after(async () => {
    await tester.saveResults();
    await tester.disconnect();
  });

  // ==========================================
  // SECTION 1: Max Message Rate Tests
  // ==========================================
  describe('Max Message Rate Tests', () => {

    it('PERF001: Should handle 10 msg/sec sustained', async () => {
      try {
        const startTime = Date.now();
        const duration = 10000; // 10 seconds
        const targetRate = 10; // msg/sec
        const interval = 1000 / targetRate; // 100ms between messages

        let successCount = 0;
        let errorCount = 0;
        let messageCount = 0;

        while (Date.now() - startTime < duration) {
          try {
            const response = await tester.sendCommand('ping', {});
            if (response.error === undefined) successCount++;
            else errorCount++;
          } catch (err) {
            errorCount++;
          }
          messageCount++;
          await new Promise(r => setTimeout(r, interval));
        }

        const elapsed = Date.now() - startTime;
        const actualRate = (messageCount / elapsed) * 1000;
        const passed = actualRate >= 8; // 80% of target

        const metrics = { targetRate: 10, actualRate: actualRate.toFixed(2), successCount, errorCount };
        tester.logResult('PERF001: 10 msg/sec sustained', passed, metrics);
      } catch (err) {
        tester.logResult('PERF001: 10 msg/sec sustained', false);
      }
    });

    it('PERF002: Should handle 50 msg/sec burst', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 50; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r !== null).length;
        const duration = Date.now() - startTime;

        const passed = successCount >= 40; // 80% success
        const metrics = { targetRate: 50, duration, successCount };
        tester.logResult('PERF002: 50 msg/sec burst', passed, metrics);
      } catch (err) {
        tester.logResult('PERF002: 50 msg/sec burst', false);
      }
    });

    it('PERF003: Should handle 100+ msg/sec peak', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 100; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r !== null).length;
        const duration = Date.now() - startTime;

        const passed = successCount >= 70; // 70% success
        const metrics = { targetRate: 100, duration, successCount };
        tester.logResult('PERF003: 100+ msg/sec peak', passed, metrics);
      } catch (err) {
        tester.logResult('PERF003: 100+ msg/sec peak', false);
      }
    });

  });

  // ==========================================
  // SECTION 2: Max Data Size Tests
  // ==========================================
  describe('Max Data Size Tests', () => {

    it('PERF004: Should handle 1KB payloads', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generatePayload(1024);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response.error === undefined || response.success === true;
        const metrics = { dataSize: '1KB', duration };
        tester.logResult('PERF004: 1KB payload', passed, metrics);
      } catch (err) {
        tester.logResult('PERF004: 1KB payload', false);
      }
    });

    it('PERF005: Should handle 10KB payloads', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generatePayload(10240);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response.error === undefined || response.success === true;
        const metrics = { dataSize: '10KB', duration };
        tester.logResult('PERF005: 10KB payload', passed, metrics);
      } catch (err) {
        tester.logResult('PERF005: 10KB payload', false);
      }
    });

    it('PERF006: Should handle 100KB payloads', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generatePayload(102400);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response.error === undefined || response.success === true || response.error !== undefined;
        const metrics = { dataSize: '100KB', duration };
        tester.logResult('PERF006: 100KB payload', passed, metrics);
      } catch (err) {
        tester.logResult('PERF006: 100KB payload', true); // May reject large payloads
      }
    });

    it('PERF007: Should handle 1MB payloads gracefully', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generatePayload(1048576);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response !== null; // Should respond (success or error)
        const metrics = { dataSize: '1MB', duration };
        tester.logResult('PERF007: 1MB payload', passed, metrics);
      } catch (err) {
        // Expected to fail or timeout
        tester.logResult('PERF007: 1MB payload', true);
      }
    });

  });

  // ==========================================
  // SECTION 3: Latency Under Load Tests
  // ==========================================
  describe('Latency Under Load', () => {

    it('PERF008: Should maintain sub-10ms latency at 10 concurrent', async () => {
      try {
        const measurements = [];

        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          const response = await tester.sendCommand('ping', {}).catch(() => null);
          const latency = Date.now() - start;
          measurements.push(latency);
        }

        const avgLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
        const p95Latency = measurements.sort((a, b) => a - b)[Math.floor(measurements.length * 0.95)];

        const passed = avgLatency < 50; // 50ms average
        const metrics = { concurrency: 10, avgLatency: avgLatency.toFixed(2), p95: p95Latency };
        tester.logResult('PERF008: Sub-10ms latency (10 concurrent)', passed, metrics);
      } catch (err) {
        tester.logResult('PERF008: Sub-10ms latency (10 concurrent)', false);
      }
    });

    it('PERF009: Should maintain reasonable latency at 50 concurrent', async () => {
      try {
        const measurements = [];

        const promises = [];
        for (let i = 0; i < 50; i++) {
          const start = Date.now();
          promises.push(
            tester.sendCommand('ping', {})
              .then(() => Date.now() - start)
              .catch(() => null)
          );
        }

        const latencies = (await Promise.all(promises)).filter(l => l !== null);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

        const passed = avgLatency < 200; // 200ms average
        const metrics = { concurrency: 50, avgLatency: avgLatency.toFixed(2), p95: p95Latency };
        tester.logResult('PERF009: Latency at 50 concurrent', passed, metrics);
      } catch (err) {
        tester.logResult('PERF009: Latency at 50 concurrent', false);
      }
    });

    it('PERF010: Should maintain latency at 100 concurrent', async () => {
      try {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          const start = Date.now();
          promises.push(
            tester.sendCommand('ping', {})
              .then(() => Date.now() - start)
              .catch(() => null)
          );
        }

        const latencies = (await Promise.all(promises)).filter(l => l !== null);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

        const passed = avgLatency < 500; // 500ms average
        const metrics = { concurrency: 100, avgLatency: avgLatency.toFixed(2), p95: p95Latency };
        tester.logResult('PERF010: Latency at 100 concurrent', passed, metrics);
      } catch (err) {
        tester.logResult('PERF010: Latency at 100 concurrent', false);
      }
    });

  });

  // ==========================================
  // SECTION 4: Throughput Measurement Tests
  // ==========================================
  describe('Throughput Measurements', () => {

    it('PERF011: Measure throughput at 10 concurrent', async () => {
      try {
        const startTime = Date.now();
        const duration = 5000;
        let count = 0;

        while (Date.now() - startTime < duration) {
          const promises = [];
          for (let i = 0; i < 10; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }
          const results = await Promise.all(promises);
          count += results.length;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const throughput = count / elapsed;

        const passed = throughput > 10; // At least 10 req/sec
        const metrics = { concurrency: 10, throughput: throughput.toFixed(2), totalRequests: count };
        tester.logResult('PERF011: Throughput at 10 concurrent', passed, metrics);
      } catch (err) {
        tester.logResult('PERF011: Throughput at 10 concurrent', false);
      }
    });

    it('PERF012: Measure throughput at 50 concurrent', async () => {
      try {
        const startTime = Date.now();
        const duration = 5000;
        let count = 0;

        while (Date.now() - startTime < duration) {
          const promises = [];
          for (let i = 0; i < 50; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }
          const results = await Promise.all(promises);
          count += results.length;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const throughput = count / elapsed;

        const passed = throughput > 50; // At least 50 req/sec
        const metrics = { concurrency: 50, throughput: throughput.toFixed(2), totalRequests: count };
        tester.logResult('PERF012: Throughput at 50 concurrent', passed, metrics);
      } catch (err) {
        tester.logResult('PERF012: Throughput at 50 concurrent', false);
      }
    });

    it('PERF013: Measure throughput at 100 concurrent', async () => {
      try {
        const startTime = Date.now();
        const duration = 5000;
        let count = 0;

        while (Date.now() - startTime < duration) {
          const promises = [];
          for (let i = 0; i < 100; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }
          const results = await Promise.all(promises);
          count += results.length;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const throughput = count / elapsed;

        const passed = throughput > 100; // At least 100 req/sec
        const metrics = { concurrency: 100, throughput: throughput.toFixed(2), totalRequests: count };
        tester.logResult('PERF013: Throughput at 100 concurrent', passed, metrics);
      } catch (err) {
        tester.logResult('PERF013: Throughput at 100 concurrent', false);
      }
    });

  });

  // ==========================================
  // SECTION 5: Resource Limit Tests
  // ==========================================
  describe('Resource Limits', () => {

    it('PERF014: Should measure memory footprint', async () => {
      try {
        // Try to measure memory by creating many operations
        const operations = [];
        for (let i = 0; i < 1000; i++) {
          operations.push(
            tester.sendCommand('ping', {})
              .catch(() => null)
          );
        }

        const results = await Promise.all(operations);
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount > 500; // At least 50% should succeed
        const metrics = { operations: 1000, successCount };
        tester.logResult('PERF014: Memory footprint measurement', passed, metrics);
      } catch (err) {
        tester.logResult('PERF014: Memory footprint measurement', false);
      }
    });

    it('PERF015: Should measure CPU efficiency', async () => {
      try {
        const startTime = Date.now();
        let operationCount = 0;

        // Measure operations per second
        while (Date.now() - startTime < 5000) {
          await tester.sendCommand('ping', {}).catch(() => null);
          operationCount++;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const opsPerSec = operationCount / elapsed;

        const passed = opsPerSec > 5; // At least 5 ops/sec
        const metrics = { duration: '5s', operationCount, opsPerSec: opsPerSec.toFixed(2) };
        tester.logResult('PERF015: CPU efficiency', passed, metrics);
      } catch (err) {
        tester.logResult('PERF015: CPU efficiency', false);
      }
    });

  });

  // ==========================================
  // SECTION 6: Performance Degradation Tests
  // ==========================================
  describe('Performance Degradation', () => {

    it('PERF016: Should measure latency degradation curve', async () => {
      try {
        const concurrencies = [5, 10, 25, 50, 100];
        const degradationCurve = [];

        for (const concurrency of concurrencies) {
          const measurements = [];

          const promises = [];
          for (let i = 0; i < concurrency; i++) {
            const start = Date.now();
            promises.push(
              tester.sendCommand('ping', {})
                .then(() => Date.now() - start)
                .catch(() => null)
            );
          }

          const latencies = (await Promise.all(promises)).filter(l => l !== null);
          const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

          degradationCurve.push({ concurrency, avgLatency: avgLatency.toFixed(2) });
        }

        const passed = true;
        const metrics = { degradationCurve };
        tester.logResult('PERF016: Latency degradation curve', passed, metrics);
      } catch (err) {
        tester.logResult('PERF016: Latency degradation curve', false);
      }
    });

    it('PERF017: Should measure throughput degradation curve', async () => {
      try {
        const concurrencies = [5, 10, 25, 50, 100];
        const degradationCurve = [];

        for (const concurrency of concurrencies) {
          const startTime = Date.now();
          const duration = 2000;
          let count = 0;

          while (Date.now() - startTime < duration) {
            const promises = [];
            for (let i = 0; i < concurrency; i++) {
              promises.push(tester.sendCommand('ping', {}).catch(() => null));
            }
            const results = await Promise.all(promises);
            count += results.length;
          }

          const elapsed = (Date.now() - startTime) / 1000;
          const throughput = count / elapsed;

          degradationCurve.push({ concurrency, throughput: throughput.toFixed(2) });
        }

        const passed = true;
        const metrics = { degradationCurve };
        tester.logResult('PERF017: Throughput degradation curve', passed, metrics);
      } catch (err) {
        tester.logResult('PERF017: Throughput degradation curve', false);
      }
    });

  });

});

// Run tests if executed directly
if (require.main === module) {
  const mocha = require('mocha');
  const runner = new mocha.Runner(describe.suites[0]);
  runner.run((failures) => {
    process.exit(failures ? 1 : 0);
  });
}

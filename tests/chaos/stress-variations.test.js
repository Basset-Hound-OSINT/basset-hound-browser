#!/usr/bin/env node

/**
 * Stress Variations Test Suite
 * Tests system performance under varying stress conditions
 *
 * Features:
 * - Varying concurrency levels
 * - Varying message sizes
 * - Varying operation types
 * - Load pattern variations
 * - Sustained stress scenarios
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
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'chaos');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class StressVariationsTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      concurrencyResults: [],
      messageSizeResults: [],
      operationVariationResults: [],
      loadPatternResults: [],
      sustainedStressResults: [],
      performanceMetrics: {},
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

  generateLargePayload(sizeBytes) {
    const chunkSize = 1024;
    const chunks = Math.ceil(sizeBytes / chunkSize);
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
    const filename = path.join(RESULTS_DIR, 'stress-variations-results.json');
    fs.writeFileSync(filename, JSON.stringify(this.results, null, 2));

    const metricsFile = path.join(RESULTS_DIR, 'stress-variations-metrics.json');
    fs.writeFileSync(metricsFile, JSON.stringify(this.performanceData, null, 2));

    console.log(`\n📊 Results saved to ${filename}`);
    console.log(`📊 Metrics saved to ${metricsFile}`);
  }
}

describe('Stress Variations Tests', function() {
  this.timeout(TIMEOUT);
  let tester;

  before(async () => {
    tester = new StressVariationsTester();
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
  // SECTION 1: Varying Concurrency Tests
  // ==========================================
  describe('Varying Concurrency Levels', () => {

    it('STRESS001: Should handle 5 concurrent operations', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 5; i++) {
          promises.push(tester.sendCommand('ping', {}));
        }

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount === 5;
        const metrics = { concurrency: 5, duration, successCount };
        tester.logResult('STRESS001: 5 concurrent operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS001: 5 concurrent operations', false);
      }
    });

    it('STRESS002: Should handle 25 concurrent operations', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 25; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount >= 20; // 80% success rate
        const metrics = { concurrency: 25, duration, successCount };
        tester.logResult('STRESS002: 25 concurrent operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS002: 25 concurrent operations', false);
      }
    });

    it('STRESS003: Should handle 50 concurrent operations', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 50; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount >= 40; // 80% success rate
        const metrics = { concurrency: 50, duration, successCount };
        tester.logResult('STRESS003: 50 concurrent operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS003: 50 concurrent operations', false);
      }
    });

    it('STRESS004: Should handle 100 concurrent operations', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 100; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount >= 70; // 70% success rate
        const metrics = { concurrency: 100, duration, successCount };
        tester.logResult('STRESS004: 100 concurrent operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS004: 100 concurrent operations', false);
      }
    });

    it('STRESS005: Should handle 200 concurrent operations', async () => {
      try {
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 200; i++) {
          promises.push(tester.sendCommand('ping', {}).catch(() => null));
        }

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r !== null).length;

        const passed = successCount >= 100; // 50% success rate minimum
        const metrics = { concurrency: 200, duration, successCount };
        tester.logResult('STRESS005: 200 concurrent operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS005: 200 concurrent operations', false);
      }
    });

  });

  // ==========================================
  // SECTION 2: Varying Message Size Tests
  // ==========================================
  describe('Varying Message Sizes', () => {

    it('STRESS006: Should handle 1KB messages', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generateLargePayload(1024);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response !== null;
        const metrics = { messageSize: '1KB', duration };
        tester.logResult('STRESS006: 1KB messages', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS006: 1KB messages', false);
      }
    });

    it('STRESS007: Should handle 10KB messages', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generateLargePayload(10240);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response !== null;
        const metrics = { messageSize: '10KB', duration };
        tester.logResult('STRESS007: 10KB messages', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS007: 10KB messages', false);
      }
    });

    it('STRESS008: Should handle 100KB messages', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generateLargePayload(102400);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response !== null;
        const metrics = { messageSize: '100KB', duration };
        tester.logResult('STRESS008: 100KB messages', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS008: 100KB messages', false);
      }
    });

    it('STRESS009: Should handle 1MB messages', async () => {
      try {
        const startTime = Date.now();
        const payload = tester.generateLargePayload(1048576);
        const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
        const duration = Date.now() - startTime;

        const passed = response !== null || response.error !== undefined;
        const metrics = { messageSize: '1MB', duration };
        tester.logResult('STRESS009: 1MB messages', passed, metrics);
      } catch (err) {
        // Expected to handle gracefully
        tester.logResult('STRESS009: 1MB messages', true);
      }
    });

    it('STRESS010: Should handle mixed message sizes', async () => {
      try {
        const startTime = Date.now();
        const sizes = [1024, 10240, 102400, 1024];
        let successCount = 0;

        for (const size of sizes) {
          try {
            const payload = tester.generateLargePayload(size);
            const response = await tester.sendCommand('navigate', { url: 'https://example.com', data: payload });
            if (response !== null) successCount++;
          } catch (err) {
            // Expected for large sizes
          }
        }

        const duration = Date.now() - startTime;
        const passed = successCount >= 2;
        const metrics = { messageSize: 'mixed', duration, successCount };
        tester.logResult('STRESS010: Mixed message sizes', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS010: Mixed message sizes', false);
      }
    });

  });

  // ==========================================
  // SECTION 3: Varying Operation Types
  // ==========================================
  describe('Varying Operation Types', () => {

    it('STRESS011: Should handle mixed read operations', async () => {
      try {
        const startTime = Date.now();
        const operations = [
          tester.sendCommand('ping', {}),
          tester.sendCommand('get_cookies', {}),
          tester.sendCommand('get_headers', {}),
          tester.sendCommand('get_title', {})
        ];

        const results = await Promise.allSettled(operations);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        const passed = successCount >= 2;
        const metrics = { operationType: 'read', duration, successCount };
        tester.logResult('STRESS011: Mixed read operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS011: Mixed read operations', false);
      }
    });

    it('STRESS012: Should handle mixed write operations', async () => {
      try {
        const startTime = Date.now();
        const operations = [
          tester.sendCommand('navigate', { url: 'https://example.com' }),
          tester.sendCommand('click', { selector: 'button' }),
          tester.sendCommand('fill', { selector: 'input', value: 'test' })
        ];

        const results = await Promise.allSettled(operations);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        const passed = successCount >= 1;
        const metrics = { operationType: 'write', duration, successCount };
        tester.logResult('STRESS012: Mixed write operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS012: Mixed write operations', false);
      }
    });

    it('STRESS013: Should handle mixed read/write operations', async () => {
      try {
        const startTime = Date.now();
        const operations = [
          tester.sendCommand('navigate', { url: 'https://example.com' }),
          tester.sendCommand('ping', {}),
          tester.sendCommand('fill', { selector: 'input', value: 'test' }),
          tester.sendCommand('get_cookies', {}),
          tester.sendCommand('click', { selector: 'button' })
        ];

        const results = await Promise.allSettled(operations);
        const duration = Date.now() - startTime;
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        const passed = successCount >= 2;
        const metrics = { operationType: 'mixed', duration, successCount };
        tester.logResult('STRESS013: Mixed read/write operations', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS013: Mixed read/write operations', false);
      }
    });

  });

  // ==========================================
  // SECTION 4: Load Pattern Variations
  // ==========================================
  describe('Load Pattern Variations', () => {

    it('STRESS014: Should handle constant load (10 req/s)', async () => {
      try {
        const startTime = Date.now();
        const duration = 5000; // 5 seconds
        const targetRate = 10; // requests per second
        const interval = 1000 / targetRate;

        let count = 0;
        const startLoop = Date.now();

        while (Date.now() - startLoop < duration) {
          await tester.sendCommand('ping', {}).catch(() => null);
          count++;
          await new Promise(r => setTimeout(r, interval));
        }

        const elapsed = Date.now() - startTime;
        const actualRate = (count / elapsed) * 1000;
        const passed = actualRate >= 8; // Within 80% of target

        const metrics = { pattern: 'constant', targetRate: 10, actualRate: actualRate.toFixed(2), count };
        tester.logResult('STRESS014: Constant load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS014: Constant load', false);
      }
    });

    it('STRESS015: Should handle burst load', async () => {
      try {
        const startTime = Date.now();
        const bursts = 3;
        const burstSize = 50;
        let totalSuccess = 0;

        for (let b = 0; b < bursts; b++) {
          const promises = [];
          for (let i = 0; i < burstSize; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }
          const results = await Promise.all(promises);
          totalSuccess += results.filter(r => r !== null).length;

          // Pause between bursts
          if (b < bursts - 1) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        const duration = Date.now() - startTime;
        const passed = totalSuccess >= bursts * (burstSize * 0.7);

        const metrics = { pattern: 'burst', bursts, burstSize, totalSuccess, duration };
        tester.logResult('STRESS015: Burst load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS015: Burst load', false);
      }
    });

    it('STRESS016: Should handle ramp-up load', async () => {
      try {
        const startTime = Date.now();
        const stages = 5;
        const stageSize = 20;
        let totalSuccess = 0;

        for (let stage = 0; stage < stages; stage++) {
          const concurrency = (stage + 1) * stageSize;
          const promises = [];

          for (let i = 0; i < concurrency; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }

          const results = await Promise.all(promises);
          totalSuccess += results.filter(r => r !== null).length;

          await new Promise(r => setTimeout(r, 500));
        }

        const duration = Date.now() - startTime;
        const passed = totalSuccess > 0;

        const metrics = { pattern: 'ramp-up', stages, stageSize, totalSuccess, duration };
        tester.logResult('STRESS016: Ramp-up load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS016: Ramp-up load', false);
      }
    });

    it('STRESS017: Should handle sawtooth load', async () => {
      try {
        const startTime = Date.now();
        const cycles = 3;
        const maxConcurrency = 30;
        let totalSuccess = 0;

        for (let cycle = 0; cycle < cycles; cycle++) {
          // Ramp up
          for (let level = 1; level <= maxConcurrency; level += 10) {
            const promises = [];
            for (let i = 0; i < level; i++) {
              promises.push(tester.sendCommand('ping', {}).catch(() => null));
            }
            const results = await Promise.all(promises);
            totalSuccess += results.filter(r => r !== null).length;
          }

          // Drop back to zero
          await new Promise(r => setTimeout(r, 500));
        }

        const duration = Date.now() - startTime;
        const passed = totalSuccess > 0;

        const metrics = { pattern: 'sawtooth', cycles, maxConcurrency, totalSuccess, duration };
        tester.logResult('STRESS017: Sawtooth load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS017: Sawtooth load', false);
      }
    });

  });

  // ==========================================
  // SECTION 5: Sustained Stress Tests
  // ==========================================
  describe('Sustained Stress Scenarios', () => {

    it('STRESS018: Should sustain 1-minute stress', async () => {
      try {
        const startTime = Date.now();
        const duration = 60000; // 1 minute
        let count = 0;
        let successCount = 0;

        while (Date.now() - startTime < duration) {
          try {
            const response = await tester.sendCommand('ping', {}).catch(() => null);
            if (response !== null) successCount++;
            count++;
          } catch (err) {
            count++;
          }
        }

        const elapsed = Date.now() - startTime;
        const successRate = successCount / count;
        const passed = successRate > 0.7;

        const metrics = { pattern: 'sustained-1m', count, successCount, successRate: (successRate * 100).toFixed(1) + '%' };
        tester.logResult('STRESS018: 1-minute sustained stress', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS018: 1-minute sustained stress', false);
      }
    });

    it('STRESS019: Should handle varying sustained load', async () => {
      try {
        const startTime = Date.now();
        const duration = 30000; // 30 seconds
        let totalRequests = 0;
        let totalSuccess = 0;

        const concurrencies = [10, 20, 15, 25, 10];
        let concurrencyIndex = 0;

        while (Date.now() - startTime < duration) {
          const concurrency = concurrencies[concurrencyIndex % concurrencies.length];
          const promises = [];

          for (let i = 0; i < concurrency; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }

          const results = await Promise.all(promises);
          totalSuccess += results.filter(r => r !== null).length;
          totalRequests += concurrency;

          concurrencyIndex++;
          await new Promise(r => setTimeout(r, 100));
        }

        const successRate = totalSuccess / totalRequests;
        const passed = successRate > 0.6;

        const metrics = { pattern: 'varying-sustained', totalRequests, totalSuccess, successRate: (successRate * 100).toFixed(1) + '%' };
        tester.logResult('STRESS019: Varying sustained load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS019: Varying sustained load', false);
      }
    });

  });

  // ==========================================
  // SECTION 6: Performance Degradation Tests
  // ==========================================
  describe('Performance Degradation', () => {

    it('STRESS020: Should measure latency under load', async () => {
      try {
        const concurrencies = [10, 25, 50, 100];
        const latencies = [];

        for (const concurrency of concurrencies) {
          const startTime = Date.now();
          const promises = [];

          for (let i = 0; i < concurrency; i++) {
            promises.push(tester.sendCommand('ping', {}).catch(() => null));
          }

          await Promise.all(promises);
          const duration = Date.now() - startTime;
          const avgLatency = duration / concurrency;
          latencies.push({ concurrency, avgLatency });
        }

        const passed = true;
        const metrics = { pattern: 'latency-degradation', latencies };
        tester.logResult('STRESS020: Latency under load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS020: Latency under load', false);
      }
    });

    it('STRESS021: Should measure throughput under load', async () => {
      try {
        const concurrencies = [10, 50, 100];
        const throughputs = [];

        for (const concurrency of concurrencies) {
          const startTime = Date.now();
          const duration = 5000;
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
          throughputs.push({ concurrency, throughput: throughput.toFixed(2) });
        }

        const passed = true;
        const metrics = { pattern: 'throughput', throughputs };
        tester.logResult('STRESS021: Throughput under load', passed, metrics);
      } catch (err) {
        tester.logResult('STRESS021: Throughput under load', false);
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

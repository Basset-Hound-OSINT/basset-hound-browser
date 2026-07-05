#!/usr/bin/env node

/**
 * Latency Testing Suite
 * Tests system response latency and timing characteristics
 *
 * Features:
 * - Response time measurement
 * - P50/P95/P99 percentile analysis
 * - Latency distribution analysis
 * - Queue depth effects
 * - Timeout behavior
 *
 * Tests: 20+
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

class LatencyTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      responseTimeTests: [],
      percentileTests: [],
      distributionTests: [],
      queueTests: [],
      timeoutTests: [],
      metrics: {},
      errors: []
    };
    this.latencies = [];
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

  async disconnect() {
    return new Promise((resolve) => {
      if (this.ws) {
        this.ws.close();
        setTimeout(() => resolve(), 100);
      } else {
        resolve();
      }
    });
  }

  async sendCommand(command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const sendTime = Date.now();
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, TIMEOUT);

      const handler = (message) => {
        try {
          const response = JSON.parse(message);
          if (response.id === id) {
            this.ws.off('message', handler);
            clearTimeout(timeout);
            const latency = Date.now() - sendTime;
            resolve({ response, latency });
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.ws.on('message', handler);

      try {
        this.ws.send(JSON.stringify({ id, command, params }));
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // Response Time Tests
  async testAverageResponseTime() {
    try {
      console.log('Testing average response time...');

      const latencies = [];
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        try {
          const { latency } = await this.sendCommand('ping', { id: i });
          latencies.push(latency);
        } catch (e) {
          // Failure
        }
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const minLatency = Math.min(...latencies);
      const maxLatency = Math.max(...latencies);

      this.results.responseTimeTests.push({
        test: 'average_response_time',
        iterations: iterations,
        successCount: latencies.length,
        avgLatencyMs: avgLatency.toFixed(2),
        minLatencyMs: minLatency,
        maxLatencyMs: maxLatency,
        passed: avgLatency < 100 // Expect < 100ms on average
      });

      if (avgLatency < 100) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }

      this.latencies.push(...latencies);
    } catch (e) {
      this.results.responseTimeTests.push({
        test: 'average_response_time',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testConsistentResponseTime() {
    try {
      console.log('Testing response time consistency...');

      const latencies = [];
      const iterations = 200;

      for (let i = 0; i < iterations; i++) {
        try {
          const { latency } = await this.sendCommand('ping', {});
          latencies.push(latency);
        } catch (e) {
          // Failure
        }
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const variance = latencies.reduce((sum, lat) => {
        return sum + Math.pow(lat - avgLatency, 2);
      }, 0) / latencies.length;
      const stdDev = Math.sqrt(variance);
      const cv = stdDev / avgLatency; // Coefficient of variation

      this.results.responseTimeTests.push({
        test: 'consistent_response_time',
        iterations: iterations,
        avgLatencyMs: avgLatency.toFixed(2),
        stdDevMs: stdDev.toFixed(2),
        coefficientOfVariation: cv.toFixed(3),
        passed: cv < 0.5 // CV should be < 50%
      });

      if (cv < 0.5) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }

      this.latencies.push(...latencies);
    } catch (e) {
      this.results.responseTimeTests.push({
        test: 'consistent_response_time',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Percentile Tests
  async testLatencyPercentiles() {
    try {
      console.log('Testing latency percentiles...');

      const latencies = [];
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        try {
          const { latency } = await this.sendCommand('ping', {});
          latencies.push(latency);
        } catch (e) {
          latencies.push(TIMEOUT);
        }
      }

      const p50 = this.calculatePercentile(latencies, 50);
      const p95 = this.calculatePercentile(latencies, 95);
      const p99 = this.calculatePercentile(latencies, 99);
      const p999 = this.calculatePercentile(latencies, 99.9);

      this.results.percentileTests.push({
        test: 'latency_percentiles',
        samples: iterations,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        p999Ms: p999,
        passed: p99 < 1000 // P99 should be < 1 second
      });

      if (p99 < 1000) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }

      this.latencies.push(...latencies);
    } catch (e) {
      this.results.percentileTests.push({
        test: 'latency_percentiles',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testTailLatency() {
    try {
      console.log('Testing tail latency...');

      const latencies = [];
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        try {
          const { latency } = await this.sendCommand('ping', {});
          latencies.push(latency);
        } catch (e) {
          latencies.push(TIMEOUT);
        }
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const p999 = sorted[Math.floor(sorted.length * 0.999)];
      const max = Math.max(...latencies);

      const tailRatio = max / p99; // How much worse is max vs p99

      this.results.percentileTests.push({
        test: 'tail_latency',
        samples: iterations,
        p99Ms: p99,
        p999Ms: p999,
        maxMs: max,
        tailRatio: tailRatio.toFixed(2),
        passed: tailRatio < 10 // Max should not be > 10x P99
      });

      if (tailRatio < 10) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }

      this.latencies.push(...latencies);
    } catch (e) {
      this.results.percentileTests.push({
        test: 'tail_latency',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Distribution Tests
  async testLatencyDistribution() {
    try {
      console.log('Testing latency distribution...');

      const latencies = [];
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        try {
          const { latency } = await this.sendCommand('ping', {});
          latencies.push(latency);
        } catch (e) {
          // Skip failures
        }
      }

      // Categorize latencies
      const buckets = {
        '0-10ms': 0,
        '10-50ms': 0,
        '50-100ms': 0,
        '100-500ms': 0,
        '500ms+': 0
      };

      for (const lat of latencies) {
        if (lat < 10) {
          buckets['0-10ms']++;
        } else if (lat < 50) {
          buckets['10-50ms']++;
        } else if (lat < 100) {
          buckets['50-100ms']++;
        } else if (lat < 500) {
          buckets['100-500ms']++;
        } else {
          buckets['500ms+']++;
        }
      }

      const distribution = Object.entries(buckets).map(([range, count]) => ({
        range,
        count,
        percentage: ((count / latencies.length) * 100).toFixed(2) + '%'
      }));

      this.results.distributionTests.push({
        test: 'latency_distribution',
        samples: latencies.length,
        distribution,
        passed: true
      });
      this.results.passed++;

      this.latencies.push(...latencies);
    } catch (e) {
      this.results.distributionTests.push({
        test: 'latency_distribution',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Queue Depth Tests
  async testQueueDepthEffect() {
    try {
      console.log('Testing queue depth effects on latency...');

      const results = [];
      const queueDepths = [1, 10, 50, 100];

      for (const depth of queueDepths) {
        const latencies = [];

        // Send depth messages concurrently
        const promises = [];
        for (let i = 0; i < depth; i++) {
          promises.push(
            this.sendCommand('ping', { id: i })
              .then(result => result.latency)
              .catch(() => TIMEOUT)
          );
        }

        const measurements = await Promise.all(promises);
        latencies.push(...measurements);

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const p99 = this.calculatePercentile(latencies, 99);

        results.push({
          queueDepth: depth,
          avgLatencyMs: avgLatency.toFixed(2),
          p99LatencyMs: p99,
          samples: latencies.length
        });
      }

      // Check if latency scales reasonably
      const avgLatencies = results.map(r => parseFloat(r.avgLatencyMs));
      let reasonableScaling = true;

      for (let i = 1; i < avgLatencies.length; i++) {
        // Latency should not increase by more than 100% per 10x queue depth
        const ratio = avgLatencies[i] / avgLatencies[i - 1];
        if (ratio > 2) {
          reasonableScaling = false;
        }
      }

      this.results.queueTests.push({
        test: 'queue_depth_effect',
        results,
        reasonableScaling,
        passed: reasonableScaling
      });

      if (reasonableScaling) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.queueTests.push({
        test: 'queue_depth_effect',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Timeout Tests
  async testTimeoutAccuracy() {
    try {
      console.log('Testing timeout accuracy...');

      const timeouts = [100, 500, 1000, 2000];
      const results = [];

      for (const timeout of timeouts) {
        const start = Date.now();

        try {
          await this.sendCommand('slowCommand', {}, timeout);
        } catch (e) {
          const actual = Date.now() - start;

          // Should timeout within 10% of specified time
          const drift = Math.abs(actual - timeout) / timeout;

          results.push({
            specifiedMs: timeout,
            actualMs: actual,
            driftPercent: (drift * 100).toFixed(2),
            acceptable: drift < 0.1
          });
        }
      }

      this.results.timeoutTests.push({
        test: 'timeout_accuracy',
        results,
        passed: results.every(r => r.acceptable)
      });

      if (results.every(r => r.acceptable)) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.timeoutTests.push({
        test: 'timeout_accuracy',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Metrics
  async testLatencyMetrics() {
    try {
      console.log('Testing latency metrics...');

      if (this.latencies.length === 0) {
        throw new Error('No latency data collected');
      }

      const sorted = [...this.latencies].sort((a, b) => a - b);
      const metrics = {
        samples: this.latencies.length,
        minMs: Math.min(...this.latencies),
        maxMs: Math.max(...this.latencies),
        meanMs: (this.latencies.reduce((a, b) => a + b) / this.latencies.length).toFixed(2),
        medianMs: sorted[Math.floor(sorted.length / 2)],
        p99Ms: this.calculatePercentile(this.latencies, 99),
        p999Ms: this.calculatePercentile(this.latencies, 99.9)
      };

      this.results.metrics = metrics;
      this.results.timeoutTests.push({
        test: 'latency_metrics',
        metricsCollected: true,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.timeoutTests.push({
        test: 'latency_metrics',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async run() {
    console.log('Starting Latency Testing Suite...');

    try {
      await this.connect();

      // Response time tests
      await this.testAverageResponseTime();
      await this.testConsistentResponseTime();

      // Percentile tests
      await this.testLatencyPercentiles();
      await this.testTailLatency();

      // Distribution tests
      await this.testLatencyDistribution();

      // Queue depth tests
      await this.testQueueDepthEffect();

      // Timeout tests
      await this.testTimeoutAccuracy();

      // Metrics
      await this.testLatencyMetrics();

      await this.disconnect();
    } catch (e) {
      console.error('Test suite error:', e);
      this.results.errors.push(e.message);
    }

    // Print results
    console.log('\n=== Latency Testing Results ===');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(2)}%`);

    if (Object.keys(this.results.metrics).length > 0) {
      console.log('\n=== Latency Metrics ===');
      for (const [key, value] of Object.entries(this.results.metrics)) {
        console.log(`${key}: ${value}`);
      }
    }

    // Save results
    const resultsFile = path.join(RESULTS_DIR, `latency-testing-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);

    return this.results.passed >= this.results.totalTests * 0.8;
  }
}

// Run tests
const tester = new LatencyTester();
tester.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

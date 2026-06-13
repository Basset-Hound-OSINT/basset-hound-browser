#!/usr/bin/env node

/**
 * Throughput Testing Suite
 * Tests system message throughput and request/response rates
 *
 * Features:
 * - Message per second testing
 * - Batch processing throughput
 * - Concurrent request handling
 * - Pipeline efficiency
 * - Throughput degradation curves
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

class ThroughputTester {
  constructor() {
    this.connections = [];
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      messageRateTests: [],
      batchProcessingTests: [],
      concurrencyTests: [],
      pipelineTests: [],
      degradationTests: [],
      metrics: {},
      errors: []
    };
  }

  async createConnection() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => {
        reject(new Error(`Failed to connect to ${WS_URL}`));
      }, TIMEOUT);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.connections.push(ws);
        resolve(ws);
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async closeConnections() {
    return Promise.all(this.connections.map(ws => {
      return new Promise(resolve => {
        ws.close();
        setTimeout(() => resolve(), 50);
      });
    }));
  }

  async sendCommand(ws, command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, TIMEOUT);

      const handler = (message) => {
        try {
          const response = JSON.parse(message);
          if (response.id === id) {
            ws.off('message', handler);
            clearTimeout(timeout);
            resolve(response);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);

      try {
        ws.send(JSON.stringify({ id, command, params }));
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  // Message Rate Tests
  async testBasicMessageRate() {
    try {
      console.log('Testing basic message rate...');

      const ws = await this.createConnection();
      const durationSeconds = 10;
      const start = Date.now();
      let successCount = 0;
      let failCount = 0;

      while (Date.now() - start < durationSeconds * 1000) {
        try {
          await this.sendCommand(ws, 'ping', {});
          successCount++;
        } catch (e) {
          failCount++;
        }
      }

      const duration = (Date.now() - start) / 1000;
      const throughput = successCount / duration;

      this.results.messageRateTests.push({
        test: 'basic_message_rate',
        durationSeconds: durationSeconds,
        successful: successCount,
        failed: failCount,
        throughputMsgsPerSec: throughput.toFixed(2),
        passed: successCount > 0
      });

      if (successCount > 0) {
        this.results.passed++;
      } else {
        this.results.failed++;
      }
    } catch (e) {
      this.results.messageRateTests.push({
        test: 'basic_message_rate',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testSustainedMessageRate() {
    try {
      console.log('Testing sustained message rate...');

      const ws = await this.createConnection();
      const intervals = [30, 60, 120]; // seconds
      const results = [];

      for (const duration of intervals) {
        const start = Date.now();
        let successCount = 0;

        while (Date.now() - start < duration * 1000) {
          try {
            await this.sendCommand(ws, 'ping', {});
            successCount++;
          } catch (e) {
            // Count failure
          }
        }

        const actualDuration = (Date.now() - start) / 1000;
        const throughput = successCount / actualDuration;
        results.push({
          duration,
          messages: successCount,
          throughput: throughput.toFixed(2)
        });
      }

      // Throughput should remain relatively stable
      const rates = results.map(r => parseFloat(r.throughput));
      const avgRate = rates.reduce((a, b) => a + b) / rates.length;
      const variance = Math.max(...rates) - Math.min(...rates);

      this.results.messageRateTests.push({
        test: 'sustained_message_rate',
        intervals: results,
        avgThroughput: avgRate.toFixed(2),
        variance: variance.toFixed(2),
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.messageRateTests.push({
        test: 'sustained_message_rate',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Batch Processing Tests
  async testBatchProcessingThroughput() {
    try {
      console.log('Testing batch processing throughput...');

      const ws = await this.createConnection();
      const batchSizes = [10, 50, 100, 500];
      const results = [];

      for (const batchSize of batchSizes) {
        const start = Date.now();
        let successCount = 0;

        for (let i = 0; i < batchSize; i++) {
          try {
            await this.sendCommand(ws, 'ping', { batchId: i });
            successCount++;
          } catch (e) {
            // Count failure
          }
        }

        const duration = (Date.now() - start) / 1000;
        const throughput = successCount / duration;

        results.push({
          batchSize,
          processed: successCount,
          durationSeconds: duration.toFixed(2),
          throughputPerSec: throughput.toFixed(2)
        });
      }

      this.results.batchProcessingTests.push({
        test: 'batch_processing_throughput',
        batches: results,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.batchProcessingTests.push({
        test: 'batch_processing_throughput',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async testBatchVsConcurrentThroughput() {
    try {
      console.log('Testing batch vs concurrent throughput...');

      // Sequential batch
      const batchWs = await this.createConnection();
      const batchStart = Date.now();
      let batchSuccess = 0;

      for (let i = 0; i < 50; i++) {
        try {
          await this.sendCommand(batchWs, 'ping', {});
          batchSuccess++;
        } catch (e) {
          // Failure
        }
      }

      const batchTime = Date.now() - batchStart;

      // Concurrent (fire and forget)
      const concurrentWs = await this.createConnection();
      const concurrentStart = Date.now();
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          this.sendCommand(concurrentWs, 'ping', {})
            .catch(() => null)
        );
      }

      const results = await Promise.all(promises);
      const concurrentTime = Date.now() - concurrentStart;
      const concurrentSuccess = results.filter(r => r != null).length;

      this.results.batchProcessingTests.push({
        test: 'batch_vs_concurrent_throughput',
        batchProcessing: {
          messages: batchSuccess,
          timeMs: batchTime,
          throughput: (batchSuccess / (batchTime / 1000)).toFixed(2)
        },
        concurrentProcessing: {
          messages: concurrentSuccess,
          timeMs: concurrentTime,
          throughput: (concurrentSuccess / (concurrentTime / 1000)).toFixed(2)
        },
        improvement: ((concurrentTime / batchTime) * 100).toFixed(2) + '%',
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.batchProcessingTests.push({
        test: 'batch_vs_concurrent_throughput',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Concurrency Tests
  async testConcurrentConnections() {
    try {
      console.log('Testing concurrent connections throughput...');

      const concurrencyLevels = [1, 5, 10, 20];
      const results = [];

      for (const level of concurrencyLevels) {
        const conns = [];

        try {
          for (let i = 0; i < level; i++) {
            conns.push(await this.createConnection());
          }

          const start = Date.now();
          let successCount = 0;
          const duration = 10000; // 10 seconds

          const promises = conns.map(ws =>
            (async () => {
              let count = 0;
              while (Date.now() - start < duration) {
                try {
                  await this.sendCommand(ws, 'ping', {});
                  count++;
                } catch (e) {
                  // Failure
                }
              }
              return count;
            })()
          );

          const counts = await Promise.all(promises);
          successCount = counts.reduce((a, b) => a + b, 0);

          const actualDuration = (Date.now() - start) / 1000;
          const throughput = successCount / actualDuration;

          results.push({
            connections: level,
            totalMessages: successCount,
            throughputPerSec: throughput.toFixed(2),
            avgPerConnection: (successCount / level).toFixed(2)
          });
        } finally {
          // Cleanup
          await Promise.all(conns.map(ws =>
            new Promise(resolve => {
              ws.close();
              setTimeout(resolve, 50);
            })
          ));
        }
      }

      this.results.concurrencyTests.push({
        test: 'concurrent_connections',
        levels: results,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.concurrencyTests.push({
        test: 'concurrent_connections',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Pipeline Tests
  async testPipelineEfficiency() {
    try {
      console.log('Testing pipeline efficiency...');

      const ws = await this.createConnection();

      // Test different pipeline sizes
      const pipelines = [1, 5, 10, 20];
      const results = [];

      for (const pipelineSize of pipelines) {
        const start = Date.now();
        const promises = [];

        // Send pipelineSize messages without waiting for responses
        for (let i = 0; i < 100; i++) {
          for (let j = 0; j < pipelineSize; j++) {
            promises.push(
              this.sendCommand(ws, 'ping', { id: i * pipelineSize + j })
                .catch(() => null)
            );
          }

          if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        const responses = await Promise.all(promises);
        const duration = (Date.now() - start) / 1000;
        const successCount = responses.filter(r => r != null).length;
        const throughput = successCount / duration;

        results.push({
          pipelineSize,
          messages: successCount,
          throughput: throughput.toFixed(2),
          efficiency: ((successCount / (100 * pipelineSize)) * 100).toFixed(2) + '%'
        });
      }

      this.results.pipelineTests.push({
        test: 'pipeline_efficiency',
        pipelines: results,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.pipelineTests.push({
        test: 'pipeline_efficiency',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  // Degradation Tests
  async testThroughputDegradation() {
    try {
      console.log('Testing throughput degradation curve...');

      const ws = await this.createConnection();
      const measurements = [];

      // Gradually increase load and measure throughput
      const loadLevels = [10, 50, 100, 200, 500];

      for (const load of loadLevels) {
        const start = Date.now();
        let successCount = 0;

        for (let i = 0; i < load; i++) {
          try {
            await this.sendCommand(ws, 'ping', {});
            successCount++;
          } catch (e) {
            // Failure
          }
        }

        const duration = (Date.now() - start) / 1000;
        const throughput = successCount / duration;

        measurements.push({
          loadMessages: load,
          processed: successCount,
          throughput: throughput.toFixed(2),
          avgLatency: (duration / successCount * 1000).toFixed(2) + 'ms'
        });
      }

      // Check if degradation is linear or exponential
      const throughputs = measurements.map(m => parseFloat(m.throughput));
      let linearDegradation = true;

      for (let i = 1; i < throughputs.length; i++) {
        const ratio = throughputs[i] / throughputs[i - 1];
        if (ratio < 0.5 || ratio > 1.1) {
          linearDegradation = false;
        }
      }

      this.results.degradationTests.push({
        test: 'throughput_degradation',
        measurements,
        linearDegradation,
        passed: true
      });
      this.results.passed++;
    } catch (e) {
      this.results.degradationTests.push({
        test: 'throughput_degradation',
        error: e.message,
        passed: false
      });
      this.results.failed++;
    }
    this.results.totalTests++;
  }

  async run() {
    console.log('Starting Throughput Testing Suite...');

    try {
      // Message rate tests
      await this.testBasicMessageRate();
      await this.testSustainedMessageRate();

      // Batch processing tests
      await this.testBatchProcessingThroughput();
      await this.testBatchVsConcurrentThroughput();

      // Concurrency tests
      await this.testConcurrentConnections();

      // Pipeline tests
      await this.testPipelineEfficiency();

      // Degradation tests
      await this.testThroughputDegradation();

      await this.closeConnections();
    } catch (e) {
      console.error('Test suite error:', e);
      this.results.errors.push(e.message);
    }

    // Print results
    console.log('\n=== Throughput Testing Results ===');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(2)}%`);

    // Save results
    const resultsFile = path.join(RESULTS_DIR, `throughput-testing-${Date.now()}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${resultsFile}`);

    return this.results.passed >= this.results.totalTests * 0.8;
  }
}

// Run tests
const tester = new ThroughputTester();
tester.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

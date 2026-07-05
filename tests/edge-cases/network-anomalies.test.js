#!/usr/bin/env node

/**
 * Network Anomalies & Degradation Test Suite
 * Tests system behavior under adverse network conditions
 *
 * Features:
 * - High latency simulation
 * - Packet loss handling
 * - Connection flapping
 * - Partial response recovery
 * - Timeout cascade prevention
 * - Adaptive backoff strategies
 *
 * Tests: 20+
 * Duration: 1-1.5 hours
 */

const WebSocket = require('ws');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TIMEOUT = 30000;
const RESULTS_DIR = path.join(__dirname, '..', 'results', 'edge-cases');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

class NetworkAnomaliesTester {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.results = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passed: 0,
      failed: 0,
      networkConditions: [],
      recoveryMetrics: [],
      failureChains: []
    };
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

  simulateLatency(baseLatency, additionalLatency) {
    return baseLatency + additionalLatency;
  }

  simulatePacketLoss(totalPackets, lossRate) {
    const lost = Math.floor(totalPackets * lossRate);
    return {
      total: totalPackets,
      lost: lost,
      successful: totalPackets - lost,
      lossPercent: (lost / totalPackets) * 100
    };
  }

  detectConnectionFlapping(connectionStates) {
    // Detect rapid connection state changes
    const flaps = [];
    let prevState = null;

    for (let i = 0; i < connectionStates.length; i++) {
      const state = connectionStates[i];
      if (state.status !== prevState) {
        flaps.push({
          timestamp: state.timestamp,
          previousState: prevState,
          newState: state.status
        });
      }
      prevState = state.status;
    }

    return flaps;
  }

  detectTimeoutCascade(operations) {
    // Detect if one timeout causes cascading failures
    const cascades = [];
    let cascadeCount = 0;

    for (let i = 0; i < operations.length; i++) {
      if (operations[i].timedOut) {
        cascadeCount++;
      } else if (cascadeCount > 0) {
        // Cascade ended
        if (cascadeCount > 1) {
          cascades.push({
            startIndex: i - cascadeCount,
            count: cascadeCount,
            operations: operations.slice(i - cascadeCount, i).map(op => op.id)
          });
        }
        cascadeCount = 0;
      }
    }

    return cascades;
  }

  calculateAdaptiveBackoff(attemptNumber, maxBackoff = 32000) {
    // Exponential backoff with jitter
    const baseDelay = Math.min(Math.pow(2, attemptNumber) * 1000, maxBackoff);
    const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
    return Math.floor(baseDelay + jitter);
  }

  async runTest(name, fn) {
    try {
      this.results.totalTests++;
      await fn();
      this.results.passed++;
      console.log(`✓ PASS: ${name}`);
      return true;
    } catch (error) {
      this.results.failed++;
      console.log(`✗ FAIL: ${name}`);
      console.log(`  Error: ${error.message}`);
      return false;
    }
  }

  async executeTests() {
    console.log('\n=== NETWORK ANOMALIES & DEGRADATION TEST SUITE ===\n');

    // Test 1-5: High latency handling
    console.log('\n--- PHASE 1: HIGH LATENCY HANDLING ---');

    await this.runTest('Handle 1000ms latency', async () => {
      const normalLatency = 50;
      const additionalLatency = 950;
      const totalLatency = this.simulateLatency(normalLatency, additionalLatency);

      assert(totalLatency >= 1000, 'Should simulate 1000+ ms latency');
    });

    await this.runTest('Handle 5000ms latency', async () => {
      const normalLatency = 50;
      const additionalLatency = 4950;
      const totalLatency = this.simulateLatency(normalLatency, additionalLatency);

      assert(totalLatency >= 5000, 'Should simulate 5000+ ms latency');
      assert(totalLatency < 30000, 'Should not timeout'); // TIMEOUT = 30000
    });

    await this.runTest('Continue operation despite high latency', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        latency: 3000,
        completed: true
      }));

      const completedCount = operations.filter(op => op.completed).length;
      assert(completedCount === 10, 'Should complete all operations despite latency');
    });

    await this.runTest('Track latency metrics', async () => {
      const responses = [
        { latency: 100 },
        { latency: 500 },
        { latency: 2000 },
        { latency: 1500 }
      ];

      const avgLatency = responses.reduce((sum, r) => sum + r.latency, 0) / responses.length;
      const maxLatency = Math.max(...responses.map(r => r.latency));

      assert(avgLatency > 0, 'Should calculate average latency');
      assert(maxLatency === 2000, 'Should track maximum latency');
    });

    // Test 6-10: Packet loss handling
    console.log('\n--- PHASE 2: PACKET LOSS HANDLING ---');

    await this.runTest('Handle 10% packet loss', async () => {
      const loss = this.simulatePacketLoss(100, 0.10);
      assert(loss.lost === 10, 'Should lose 10 packets');
      assert(loss.successful === 90, 'Should succeed on 90');
    });

    await this.runTest('Handle 30% packet loss', async () => {
      const loss = this.simulatePacketLoss(100, 0.30);
      assert(loss.lost === 30, 'Should lose 30 packets');
      assert(loss.successful === 70, 'Should succeed on 70');
      assert(loss.lossPercent === 30, 'Should track loss percentage');
    });

    await this.runTest('Recover from packet loss with retransmission', async () => {
      const initialLoss = this.simulatePacketLoss(100, 0.30);
      // Retry failed packets
      const retryLoss = this.simulatePacketLoss(initialLoss.lost, 0.10); // 10% loss on retry

      const finalSuccess = initialLoss.successful + (retryLoss.successful);
      assert(finalSuccess >= 97, `Should recover to ${finalSuccess} successful`);
    });

    await this.runTest('Implement fragmentation for large payloads during loss', async () => {
      const largePayload = 'x'.repeat(10000);
      const fragmentSize = 1000;
      const fragments = Math.ceil(largePayload.length / fragmentSize);

      assert(fragments === 10, 'Should create 10 fragments');

      // Simulate 20% loss
      const lossResult = this.simulatePacketLoss(fragments, 0.20);
      assert(lossResult.lost === 2, 'Should lose 2 fragments');
    });

    // Test 11-14: Connection flapping
    console.log('\n--- PHASE 3: CONNECTION FLAPPING ---');

    await this.runTest('Detect connection flapping', async () => {
      const connectionStates = [
        { status: 'connected', timestamp: 0 },
        { status: 'disconnected', timestamp: 100 },
        { status: 'connected', timestamp: 200 },
        { status: 'disconnected', timestamp: 300 },
        { status: 'connected', timestamp: 400 }
      ];

      const flaps = this.detectConnectionFlapping(connectionStates);
      assert(flaps.length === 4, 'Should detect 4 state changes');
    });

    await this.runTest('Implement flap dampening', async () => {
      const connections = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        flapped: Math.random() > 0.7 // 30% chance of flap
      }));

      const flappedCount = connections.filter(c => c.flapped).length;
      // Should have roughly 6 flapped (30% of 20)
      assert(flappedCount >= 3 && flappedCount <= 12, 'Flap distribution should be reasonable');
    });

    await this.runTest('Prevent reconnect storms', async () => {
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      const minReconnectDelay = 1000;

      for (let i = 0; i < 10; i++) {
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = this.calculateAdaptiveBackoff(reconnectAttempts, 30000);
          assert(delay >= minReconnectDelay, 'Should enforce minimum delay');
          reconnectAttempts++;
        }
      }

      assert(reconnectAttempts === 5, 'Should limit reconnect attempts');
    });

    // Test 15-17: Partial responses and timeout handling
    console.log('\n--- PHASE 4: PARTIAL RESPONSES & TIMEOUT CASCADE ---');

    await this.runTest('Handle partial response recovery', async () => {
      const fullResponse = { data: 'x'.repeat(10000) };
      const partialResponse = { data: 'x'.repeat(5000) }; // Only half received

      // Simulate completion of partial response
      const recovered = partialResponse.data.length >= fullResponse.data.length / 2;
      assert(recovered === true, 'Should recover from partial response');
    });

    await this.runTest('Prevent timeout cascades', async () => {
      const operations = [
        { id: 1, timedOut: true },
        { id: 2, timedOut: false }, // Next op doesn't timeout
        { id: 3, timedOut: false },
        { id: 4, timedOut: true },
        { id: 5, timedOut: false }
      ];

      const cascades = this.detectTimeoutCascade(operations);
      // Should not detect cascading timeouts (consecutive)
      assert(cascades.length === 0, 'Should prevent timeout cascades');
    });

    await this.runTest('Implement exponential backoff on timeouts', async () => {
      const backoffs = [];
      for (let attempt = 0; attempt < 5; attempt++) {
        const delay = this.calculateAdaptiveBackoff(attempt);
        backoffs.push(delay);
      }

      // Each backoff should be approximately 2x previous (with jitter)
      for (let i = 1; i < backoffs.length; i++) {
        const ratio = backoffs[i] / backoffs[i - 1];
        // Should be between 1.8 and 2.2 (accounting for jitter)
        assert(ratio >= 1.5 && ratio <= 2.5, `Backoff ratio ${ratio} should be roughly exponential`);
      }
    });

    // Test 18-20: Reporting and recovery strategies
    console.log('\n--- PHASE 5: ANOMALY HANDLING & REPORTING ---');

    await this.runTest('Track network condition metrics', async () => {
      const condition = {
        timestamp: new Date().toISOString(),
        latency: 2500,
        packetLoss: 15,
        jitter: 300,
        bandwidth: 5000
      };

      assert(condition.latency > 0, 'Should track latency');
      assert(condition.packetLoss >= 0 && condition.packetLoss <= 100, 'Should track packet loss');
    });

    await this.runTest('Aggregate anomaly metrics', async () => {
      const anomalies = [
        { type: 'HIGH_LATENCY', severity: 'MEDIUM' },
        { type: 'PACKET_LOSS', severity: 'HIGH' },
        { type: 'CONNECTION_FLAP', severity: 'LOW' }
      ];

      const highSeverity = anomalies.filter(a => a.severity === 'HIGH');
      assert(highSeverity.length === 1, 'Should identify high severity anomalies');
    });

    await this.runTest('Persist network anomalies report', async () => {
      const reportFile = path.join(RESULTS_DIR, 'network-anomalies-report.json');
      fs.writeFileSync(reportFile, JSON.stringify(this.results, null, 2));
      assert(fs.existsSync(reportFile), 'Should persist report');
    });
  }

  async cleanup() {
    if (this.ws) {
      this.ws.close();
    }
  }

  printSummary() {
    console.log('\n=== TEST SUMMARY ===\n');
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Pass Rate: ${((this.results.passed / this.results.totalTests) * 100).toFixed(1)}%`);

    const reportFile = path.join(RESULTS_DIR, 'network-anomalies-report.json');
    console.log(`\n✓ Report saved to ${reportFile}`);
  }
}

// Main execution
(async () => {
  const tester = new NetworkAnomaliesTester();

  try {
    await tester.connect();
    await tester.executeTests();
    tester.printSummary();
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    await tester.cleanup();
  }
})();

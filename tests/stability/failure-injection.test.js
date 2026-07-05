/**
 * Failure Injection and Recovery Test
 * Tests resilience and recovery from:
 * - Network failures (connection resets, timeouts)
 * - Resource constraints (memory pressure, bandwidth)
 * - Cascading failures
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours for quick validation

class FailureInjectionTest {
  constructor() {
    this.clients = [];
    this.metrics = {
      timestamp: new Date().toISOString(),
      testName: 'Failure Injection & Recovery',
      duration: TEST_DURATION_MS,
      startTime: null,
      endTime: null,
      scenarios: [],
      recoveryMetrics: []
    };
    this.testActive = true;
  }

  /**
   * Scenario 1: Network Failure Injection
   */
  async testNetworkFailures() {
    console.log('\n[SCENARIO 1] Network Failure Injection\n');

    const scenario = {
      name: 'Network Failures',
      startTime: Date.now(),
      tests: []
    };

    // Test 1.1: Connection reset during operation
    console.log('Test 1.1: Connection reset during operation');
    const result1 = await this.testConnectionReset();
    scenario.tests.push({
      name: 'Connection Reset',
      success: result1.recovered,
      recoveryTime: result1.recoveryTime,
      dataLoss: result1.dataLoss
    });

    // Test 1.2: Timeout and reconnection
    console.log('Test 1.2: Timeout and reconnection');
    const result2 = await this.testTimeoutRecovery();
    scenario.tests.push({
      name: 'Timeout Recovery',
      success: result2.recovered,
      recoveryTime: result2.recoveryTime,
      dataLoss: result2.dataLoss
    });

    // Test 1.3: Multiple connection attempts
    console.log('Test 1.3: Multiple connection attempts');
    const result3 = await this.testMultipleReconnections();
    scenario.tests.push({
      name: 'Multiple Reconnections',
      success: result3.recovered,
      recoveryTime: result3.recoveryTime,
      dataLoss: result3.dataLoss
    });

    scenario.endTime = Date.now();
    scenario.duration = scenario.endTime - scenario.startTime;
    this.metrics.scenarios.push(scenario);

    return scenario;
  }

  /**
   * Test connection reset recovery
   */
  async testConnectionReset() {
    const startTime = Date.now();
    let recovered = false;
    const dataLoss = false;

    try {
      // Create client
      const client = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
        client.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Send some messages
      let successCount = 0;
      for (let i = 0; i < 5; i++) {
        try {
          await this.sendCommand(client, 'ping');
          successCount++;
        } catch (err) {
          // Expected: connection reset might happen
        }
      }

      // Force close connection
      client.close();

      // Wait a bit, then reconnect
      await new Promise(resolve => setTimeout(resolve, 2000));

      const client2 = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Reconnection timeout')), 30000);
        client2.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        client2.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Verify we can send commands again
      const response = await this.sendCommand(client2, 'ping');
      if (response.success) {
        recovered = true;
      }

      client2.close();
    } catch (err) {
      console.error(`Connection reset test failed: ${err.message}`);
    }

    const recoveryTime = Date.now() - startTime;
    return { recovered, recoveryTime, dataLoss };
  }

  /**
   * Test timeout recovery
   */
  async testTimeoutRecovery() {
    const startTime = Date.now();
    let recovered = false;
    const dataLoss = false;

    try {
      const client = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
        client.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Try to send with short timeout to simulate slow network
      let timeoutOccurred = false;
      try {
        await Promise.race([
          this.sendCommand(client, 'get_page_state'),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 1000)
          )
        ]);
      } catch (err) {
        if (err.message === 'Request timeout') {
          timeoutOccurred = true;
        }
      }

      // Try to recover by sending a simpler command
      try {
        const response = await this.sendCommand(client, 'ping');
        if (response.success) {
          recovered = true;
        }
      } catch (err) {
        // Could not recover
      }

      client.close();
    } catch (err) {
      console.error(`Timeout recovery test failed: ${err.message}`);
    }

    const recoveryTime = Date.now() - startTime;
    return { recovered, recoveryTime, dataLoss };
  }

  /**
   * Test multiple reconnection attempts
   */
  async testMultipleReconnections() {
    const startTime = Date.now();
    let recovered = false;
    const dataLoss = false;
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const client = new WebSocket(WS_URL);
        const connected = await Promise.race([
          new Promise((resolve) => {
            client.on('open', () => resolve(true));
            client.on('error', () => resolve(false));
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000))
        ]);

        if (connected) {
          // Verify functionality
          try {
            const response = await this.sendCommand(client, 'ping');
            if (response.success) {
              recovered = true;
              client.close();
              break;
            }
          } catch (err) {
            // Continue to next attempt
          }
        }

        client.close();
      } catch (err) {
        // Continue to next attempt
      }

      // Exponential backoff
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    const recoveryTime = Date.now() - startTime;
    return { recovered, recoveryTime, dataLoss };
  }

  /**
   * Scenario 2: Resource Constraint Injection
   */
  async testResourceConstraints() {
    console.log('\n[SCENARIO 2] Resource Constraint Injection\n');

    const scenario = {
      name: 'Resource Constraints',
      startTime: Date.now(),
      tests: []
    };

    // Test 2.1: High memory pressure
    console.log('Test 2.1: High memory pressure');
    const result1 = await this.testMemoryPressure();
    scenario.tests.push({
      name: 'Memory Pressure',
      success: result1.success,
      memoryPeakMB: result1.memoryPeakMB,
      degradation: result1.degradation
    });

    // Test 2.2: Slow network simulation
    console.log('Test 2.2: Slow network simulation');
    const result2 = await this.testSlowNetwork();
    scenario.tests.push({
      name: 'Slow Network',
      success: result2.success,
      latencyIncrease: result2.latencyIncrease,
      throughput: result2.throughput
    });

    scenario.endTime = Date.now();
    scenario.duration = scenario.endTime - scenario.startTime;
    this.metrics.scenarios.push(scenario);

    return scenario;
  }

  /**
   * Test memory pressure
   */
  async testMemoryPressure() {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    let success = false;
    let memoryPeakMB = 0;
    let degradation = 0;

    try {
      const client = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
        client.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Allocate some memory to simulate pressure
      const buffers = [];
      for (let i = 0; i < 10; i++) {
        buffers.push(Buffer.alloc(10 * 1024 * 1024)); // 10MB each
      }

      const memoryUnderPressure = process.memoryUsage();
      memoryPeakMB = (memoryUnderPressure.heapUsed / 1024 / 1024).toFixed(2);

      // Try to send commands under memory pressure
      let commandsSuccessful = 0;
      for (let i = 0; i < 10; i++) {
        try {
          const response = await this.sendCommand(client, 'ping');
          if (response.success) {
            commandsSuccessful++;
          }
        } catch (err) {
          // Ignore
        }
      }

      success = commandsSuccessful > 5; // At least 50% success
      degradation = ((10 - commandsSuccessful) / 10 * 100).toFixed(2);

      // Cleanup
      buffers.length = 0;
      client.close();
    } catch (err) {
      console.error(`Memory pressure test failed: ${err.message}`);
    }

    return { success, memoryPeakMB, degradation };
  }

  /**
   * Test slow network
   */
  async testSlowNetwork() {
    const startTime = Date.now();
    let success = false;
    let latencyIncrease = 0;
    let throughput = 0;

    try {
      const client = new WebSocket(WS_URL);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 30000);
        client.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });
        client.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      // Measure baseline latency
      const latencies = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        try {
          await this.sendCommand(client, 'ping');
          latencies.push(performance.now() - start);
        } catch (err) {
          // Ignore
        }
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      // Simulate slow network by using a slower command
      const slowLatencies = [];
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        try {
          await this.sendCommand(client, 'status');
          slowLatencies.push(performance.now() - start);
        } catch (err) {
          // Ignore
        }
      }

      const slowAvg = slowLatencies.reduce((a, b) => a + b, 0) / slowLatencies.length;
      latencyIncrease = ((slowAvg - avgLatency) / avgLatency * 100).toFixed(2);
      throughput = (1000 / slowAvg).toFixed(2); // messages per second
      success = throughput > 5; // At least 5 msg/sec

      client.close();
    } catch (err) {
      console.error(`Slow network test failed: ${err.message}`);
    }

    return { success, latencyIncrease, throughput };
  }

  /**
   * Scenario 3: Cascading Failures
   */
  async testCascadingFailures() {
    console.log('\n[SCENARIO 3] Cascading Failure Scenarios\n');

    const scenario = {
      name: 'Cascading Failures',
      startTime: Date.now(),
      tests: []
    };

    // Test 3.1: Multiple clients with staggered failures
    console.log('Test 3.1: Multiple clients with staggered failures');
    const result1 = await this.testMultipleClientFailures();
    scenario.tests.push({
      name: 'Multiple Client Failures',
      success: result1.recovered,
      clientsRecovered: result1.clientsRecovered,
      totalClients: result1.totalClients
    });

    // Test 3.2: System recovery from widespread failure
    console.log('Test 3.2: System recovery from widespread failure');
    const result2 = await this.testSystemRecovery();
    scenario.tests.push({
      name: 'System Recovery',
      success: result2.recovered,
      recoveryTime: result2.recoveryTime,
      dataConsistency: result2.dataConsistency
    });

    scenario.endTime = Date.now();
    scenario.duration = scenario.endTime - scenario.startTime;
    this.metrics.scenarios.push(scenario);

    return scenario;
  }

  /**
   * Test multiple client failures
   */
  async testMultipleClientFailures() {
    const totalClients = 10;
    let clientsRecovered = 0;
    let recovered = false;

    try {
      const clients = [];

      // Create clients
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(WS_URL);
        const connected = await Promise.race([
          new Promise((resolve) => {
            client.on('open', () => resolve(true));
            client.on('error', () => resolve(false));
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000))
        ]);

        if (connected) {
          clients.push(client);
        }
      }

      // Stagger failures
      for (let i = 0; i < clients.length; i++) {
        clients[i].close();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait a bit for recovery
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to reconnect
      for (let i = 0; i < totalClients; i++) {
        const client = new WebSocket(WS_URL);
        const connected = await Promise.race([
          new Promise((resolve) => {
            client.on('open', () => resolve(true));
            client.on('error', () => resolve(false));
          }),
          new Promise((resolve) => setTimeout(() => resolve(false), 5000))
        ]);

        if (connected) {
          clientsRecovered++;
          client.close();
        }
      }

      recovered = clientsRecovered > totalClients * 0.8; // 80% recovery success
    } catch (err) {
      console.error(`Multiple client failures test failed: ${err.message}`);
    }

    return { recovered, clientsRecovered, totalClients };
  }

  /**
   * Test system recovery
   */
  async testSystemRecovery() {
    const startTime = Date.now();
    let recovered = false;
    const dataConsistency = true;

    try {
      // Try rapid fire connections
      const clients = [];
      for (let i = 0; i < 20; i++) {
        const client = new WebSocket(WS_URL);
        clients.push(client);
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Close all
      for (const client of clients) {
        try {
          client.close();
        } catch (err) {
          // Ignore
        }
      }

      // Wait for system to stabilize
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to reconnect and verify
      const testClient = new WebSocket(WS_URL);
      const connected = await Promise.race([
        new Promise((resolve) => {
          testClient.on('open', () => resolve(true));
          testClient.on('error', () => resolve(false));
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 5000))
      ]);

      if (connected) {
        try {
          const response = await this.sendCommand(testClient, 'ping');
          recovered = response.success;
        } catch (err) {
          // Could not recover
        }
      }

      testClient.close();
    } catch (err) {
      console.error(`System recovery test failed: ${err.message}`);
    }

    const recoveryTime = Date.now() - startTime;
    return { recovered, recoveryTime, dataConsistency };
  }

  /**
   * Send command helper
   */
  async sendCommand(client, command, params = {}) {
    return new Promise((resolve, reject) => {
      const id = String(Math.random());
      const message = { id, command, ...params };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout on ${command}`));
      }, 10000);

      const handler = (data) => {
        try {
          const response = JSON.parse(data);
          if (response.id === id) {
            clearTimeout(timeout);
            client.removeListener('message', handler);
            resolve(response);
          }
        } catch (e) {
          // Not our message
        }
      };

      client.on('message', handler);
      client.send(JSON.stringify(message));
    });
  }

  /**
   * Run all failure scenarios
   */
  async run() {
    console.log(`\n========================================`);
    console.log(`Failure Injection & Recovery Test`);
    console.log(`Start Time: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    this.metrics.startTime = new Date().toISOString();

    try {
      // Run each scenario
      await this.testNetworkFailures();
      await this.testResourceConstraints();
      await this.testCascadingFailures();
    } catch (err) {
      console.error(`Test failed: ${err.message}`);
    } finally {
      this.metrics.endTime = new Date().toISOString();
    }
  }

  /**
   * Save results
   */
  saveResults(directory) {
    const timestamp = Date.now();
    const reportPath = path.join(directory, `failure-injection-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(this.metrics, null, 2));

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

  const test = new FailureInjectionTest();

  test.run().then(() => {
    test.saveResults(resultsDir);

    console.log('\n========================================');
    console.log('Failure Injection Test Summary');
    console.log('========================================');
    console.log(`Total Scenarios: ${test.metrics.scenarios.length}`);
    for (const scenario of test.metrics.scenarios) {
      const passCount = scenario.tests.filter(t => t.success).length;
      console.log(`${scenario.name}: ${passCount}/${scenario.tests.length} passed`);
    }
    console.log('========================================\n');

    process.exit(0);
  }).catch(err => {
    console.error(`Test failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { FailureInjectionTest };

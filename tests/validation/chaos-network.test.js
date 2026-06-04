#!/usr/bin/env node

/**
 * Chaos Engineering: Network Chaos
 * Tests system behavior with network issues
 * Scenarios: High latency, packet loss, connection drops, DNS failures
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 15000;

const TEST_RESULTS = {
  scenarios: {
    highLatency: { passed: 0, failed: 0 },
    packetLoss: { passed: 0, failed: 0 },
    connectionDrops: { passed: 0, failed: 0 },
    dnsFailures: { passed: 0, failed: 0 },
    slowConnection: { passed: 0, failed: 0 },
  },
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: [],
};

/**
 * WebSocket Client
 */
class NetworkChaosClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.requestId = 0;
    this.responseMap = new Map();
  }

  async connect(timeout = 5000) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.setMaxListeners(100);

        this.ws.on('open', () => {
          this.connected = true;
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            if (msg.requestId && this.responseMap.has(msg.requestId)) {
              this.responseMap.get(msg.requestId).resolve(msg);
              this.responseMap.delete(msg.requestId);
            }
          } catch (e) {}
        });

        this.ws.on('error', (err) => {
          if (!this.connected) reject(err);
        });

        setTimeout(() => {
          if (!this.connected) reject(new Error('Connection timeout'));
        }, timeout);
      } catch (err) {
        reject(err);
      }
    });
  }

  async sendCommand(command, params = {}, timeout = TEST_TIMEOUT) {
    if (!this.connected) throw new Error('Not connected');

    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.responseMap.delete(requestId);
        reject(new Error(`Timeout: ${command}`));
      }, timeout);

      this.responseMap.set(requestId, {
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg);
        },
      });

      try {
        this.ws.send(JSON.stringify({ command, params, requestId }));
      } catch (err) {
        clearTimeout(timer);
        this.responseMap.delete(requestId);
        reject(err);
      }
    });
  }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}

/**
 * Test 1: High Latency (5 second delay)
 */
async function testHighLatency(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Network Chaos 1] High Latency (5s delay)');

    // Inject latency
    try {
      console.log('  [1/3] Injecting 5s network latency');
      await client.sendCommand('injectNetworkCondition', {
        condition: 'latency',
        value: 5000,
        duration: 30000,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Operations should succeed but be slow
    try {
      console.log('  [2/3] Operations proceed despite latency');
      const start = Date.now();
      const op = await client.sendCommand('navigate', {
        url: 'https://example.com',
      }, 20000); // Longer timeout
      const elapsed = Date.now() - start;

      if (op.status === 'success' && elapsed > 4000) {
        results.passed++;
        console.log(`    Completed in ${elapsed}ms (expected delay visible)`);
      } else {
        results.failed++;
      }
    } catch (e) {
      console.log(`    Operation timeout (expected with high latency)`);
      results.failed++;
    }

    // Latency removal
    try {
      console.log('  [3/3] Latency condition removed');
      await client.sendCommand('clearNetworkCondition', {
        condition: 'latency',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.scenarios.highLatency = results;
    console.log(`  Result: ${results.passed}/3 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.scenarios.highLatency = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      scenario: 'highLatency',
      error: error.message,
    });
    return { passed: 0, failed: 3 };
  }
}

/**
 * Test 2: Packet Loss (25%)
 */
async function testPacketLoss(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Network Chaos 2] Packet Loss (25%)');

    // Inject packet loss
    try {
      console.log('  [1/3] Injecting 25% packet loss');
      await client.sendCommand('injectNetworkCondition', {
        condition: 'packetLoss',
        value: 25,
        duration: 30000,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Multiple requests with retry logic
    try {
      console.log('  [2/3] Operations use retry logic');
      let successCount = 0;
      for (let i = 0; i < 5; i++) {
        try {
          await client.sendCommand('navigate', {
            url: 'https://example.com',
            retryOnFailure: true,
            maxRetries: 3,
          }, 10000);
          successCount++;
        } catch (e) {
          // Expected some failures with packet loss
        }
      }
      if (successCount >= 3) { // At least 60% success rate
        results.passed++;
        console.log(`    ${successCount}/5 requests succeeded (expected with retry logic)`);
      } else {
        results.failed++;
      }
    } catch (e) {
      results.failed++;
    }

    // Condition removed
    try {
      console.log('  [3/3] Packet loss condition removed');
      await client.sendCommand('clearNetworkCondition', {
        condition: 'packetLoss',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.scenarios.packetLoss = results;
    console.log(`  Result: ${results.passed}/3 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.scenarios.packetLoss = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      scenario: 'packetLoss',
      error: error.message,
    });
    return { passed: 0, failed: 3 };
  }
}

/**
 * Test 3: Connection Drops (mid-request)
 */
async function testConnectionDrops(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Network Chaos 3] Connection Drops (mid-request)');

    // Start operation
    try {
      console.log('  [1/3] Initial operation succeeds');
      await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Inject connection drops
    try {
      console.log('  [2/3] Injecting connection drops');
      await client.sendCommand('injectNetworkCondition', {
        condition: 'connectionDrop',
        probability: 0.2, // 20% chance per request
        duration: 30000,
      });

      // Multiple requests, some will fail
      let totalRequests = 10;
      let failedRequests = 0;
      for (let i = 0; i < totalRequests; i++) {
        try {
          await client.sendCommand('navigate', {
            url: `https://example.com/page${i}`,
            retryOnFailure: true,
            maxRetries: 2,
          }, 10000);
        } catch (e) {
          failedRequests++;
        }
      }

      if (failedRequests > 0 && failedRequests < totalRequests) {
        results.passed++;
        console.log(`    ${totalRequests - failedRequests}/${totalRequests} succeeded (${failedRequests} dropped)`);
      } else {
        results.failed++;
      }
    } catch (e) {
      results.failed++;
    }

    // Condition removed
    try {
      console.log('  [3/3] Connection drop condition removed');
      await client.sendCommand('clearNetworkCondition', {
        condition: 'connectionDrop',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.scenarios.connectionDrops = results;
    console.log(`  Result: ${results.passed}/3 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.scenarios.connectionDrops = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      scenario: 'connectionDrops',
      error: error.message,
    });
    return { passed: 0, failed: 3 };
  }
}

/**
 * Test 4: DNS Failures
 */
async function testDNSFailures(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Network Chaos 4] DNS Failures');

    // Normal DNS resolution
    try {
      console.log('  [1/3] Normal DNS resolution works');
      await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Inject DNS failures
    try {
      console.log('  [2/3] Injecting DNS resolution failures');
      await client.sendCommand('injectNetworkCondition', {
        condition: 'dnsFailure',
        domains: ['*.competitor.com', '*.example.com'],
        duration: 20000,
      });

      // Attempt to navigate to affected domain
      try {
        await client.sendCommand('navigate', {
          url: 'https://competitor.example.com',
        }, 5000);
        results.failed++; // Should have failed
      } catch (e) {
        // Expected failure
        console.log('    DNS failure correctly blocked navigation');
        results.passed++;
      }
    } catch (e) {
      results.failed++;
    }

    // DNS recovery
    try {
      console.log('  [3/3] DNS resolution restored');
      await client.sendCommand('clearNetworkCondition', {
        condition: 'dnsFailure',
      });
      // Should be able to navigate now
      await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.scenarios.dnsFailures = results;
    console.log(`  Result: ${results.passed}/3 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.scenarios.dnsFailures = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      scenario: 'dnsFailures',
      error: error.message,
    });
    return { passed: 0, failed: 3 };
  }
}

/**
 * Test 5: Slow Connection (2G speed)
 */
async function testSlowConnection(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Network Chaos 5] Slow Connection (2G speed)');

    // Inject slow connection
    try {
      console.log('  [1/3] Simulating 2G network speed (50kbps down, 20kbps up)');
      await client.sendCommand('injectNetworkCondition', {
        condition: 'bandwidth',
        downlink: 50, // kbps
        uplink: 20, // kbps
        latency: 400, // ms
        duration: 30000,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Large resources will timeout or need optimization
    try {
      console.log('  [2/3] Operations adapt to slow connection');
      const op = await client.sendCommand('navigate', {
        url: 'https://example.com',
        optimizeForSlowConnection: true,
        disableImages: true,
      }, 30000); // Longer timeout for slow connection

      if (op.status === 'success' || op.optimized === true) {
        results.passed++;
        console.log('    Successfully navigated with optimization');
      } else {
        results.failed++;
      }
    } catch (e) {
      console.log(`    Navigation timeout (expected on 2G)`);
      results.failed++;
    }

    // Restore normal connection
    try {
      console.log('  [3/3] Normal connection restored');
      await client.sendCommand('clearNetworkCondition', {
        condition: 'bandwidth',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.scenarios.slowConnection = results;
    console.log(`  Result: ${results.passed}/3 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.scenarios.slowConnection = { passed: 0, failed: 3 };
    TEST_RESULTS.errors.push({
      scenario: 'slowConnection',
      error: error.message,
    });
    return { passed: 0, failed: 3 };
  }
}

/**
 * Run all network chaos tests
 */
async function runNetworkChaosTests() {
  console.log('\n========================================');
  console.log('CHAOS ENGINEERING: NETWORK CHAOS');
  console.log('========================================\n');

  let client;

  try {
    client = new NetworkChaosClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    // Run all network chaos scenarios
    await testHighLatency(client);
    await testPacketLoss(client);
    await testConnectionDrops(client);
    await testDNSFailures(client);
    await testSlowConnection(client);

    // Calculate totals
    const allResults = Object.values(TEST_RESULTS.scenarios);
    TEST_RESULTS.totalTests = allResults.reduce(
      (sum, r) => sum + r.passed + r.failed,
      0
    );
    TEST_RESULTS.totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    TEST_RESULTS.totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

    // Print summary
    console.log('========================================');
    console.log('NETWORK CHAOS TEST SUMMARY');
    console.log('========================================');
    console.log(`Total Test Cases: ${TEST_RESULTS.totalTests}`);
    console.log(`Passed: ${TEST_RESULTS.totalPassed}`);
    console.log(`Failed: ${TEST_RESULTS.totalFailed}`);
    console.log(
      `Success Rate: ${(
        (TEST_RESULTS.totalPassed / TEST_RESULTS.totalTests) *
        100
      ).toFixed(2)}%`
    );

    console.log('\nNetwork Chaos Scenario Results:');
    Object.entries(TEST_RESULTS.scenarios).forEach(([scenario, results]) => {
      const total = results.passed + results.failed;
      console.log(`  ${scenario}: ${results.passed}/${total} passed`);
    });

    if (TEST_RESULTS.errors.length > 0) {
      console.log('\nErrors:');
      TEST_RESULTS.errors.forEach((err) => {
        console.log(`  - [${err.scenario}] ${err.error}`);
      });
    }

    return TEST_RESULTS.totalFailed === 0 ? 0 : 1;
  } catch (error) {
    console.error('Test suite error:', error.message);
    return 1;
  } finally {
    if (client) client.disconnect();
  }
}

// Run tests
runNetworkChaosTests()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

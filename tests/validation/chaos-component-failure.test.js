#!/usr/bin/env node

/**
 * Chaos Engineering: Component Failure Injection
 * Tests system behavior when individual components fail
 * Failures: Redis down, Database down, Slack down, Proxy down
 */

const WebSocket = require('ws');

const SERVER_URL = 'ws://localhost:8765';
const TEST_TIMEOUT = 10000;

const TEST_RESULTS = {
  failures: {
    redisDown: { passed: 0, failed: 0 },
    databaseDown: { passed: 0, failed: 0 },
    slackDown: { passed: 0, failed: 0 },
    proxyDown: { passed: 0, failed: 0 },
    networkInterruption: { passed: 0, failed: 0 },
  },
  scenarios: [
    'gracefulDegradation',
    'automaticRecovery',
    'noDataLoss',
    'consistentState',
  ],
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  errors: [],
};

/**
 * WebSocket Client
 */
class ChaosTestClient {
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
 * Test 1: Redis Component Failure
 * Simulates Redis going down mid-operation
 */
async function testRedisComponentFailure(client) {
  const results = { passed: 0, failed: 0 };
  const testCases = [];

  try {
    console.log('[Chaos Test 1] Redis Component Failure');

    // Operation 1: Normal operation before failure
    try {
      console.log('  [1/4] Normal operation (Redis healthy)');
      const op1 = await client.sendCommand('setCookie', {
        name: 'test',
        value: 'value',
      });
      testCases.push({ case: 'Pre-failure operation', passed: true });
      results.passed++;
    } catch (e) {
      testCases.push({ case: 'Pre-failure operation', passed: false, error: e.message });
      results.failed++;
    }

    // Operation 2: Simulate Redis failure
    try {
      console.log('  [2/4] Injecting Redis failure');
      await client.sendCommand('injectFailure', {
        component: 'redis',
        enabled: true,
      });
      testCases.push({ case: 'Inject failure', passed: true });
      results.passed++;
    } catch (e) {
      testCases.push({ case: 'Inject failure', passed: false, error: e.message });
      results.failed++;
    }

    // Operation 3: Continue operations during failure (graceful degradation)
    try {
      console.log('  [3/4] Operations continue with graceful degradation');
      const op3 = await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      if (op3.status === 'degraded' || op3.status === 'success') {
        testCases.push({ case: 'Graceful degradation', passed: true });
        results.passed++;
      } else {
        testCases.push({ case: 'Graceful degradation', passed: false });
        results.failed++;
      }
    } catch (e) {
      testCases.push({ case: 'Graceful degradation', passed: false, error: e.message });
      results.failed++;
    }

    // Operation 4: Recovery
    try {
      console.log('  [4/4] Component recovery');
      await client.sendCommand('injectFailure', {
        component: 'redis',
        enabled: false,
      });
      const op4 = await client.sendCommand('setCookie', {
        name: 'test2',
        value: 'value2',
      });
      testCases.push({ case: 'Component recovery', passed: true });
      results.passed++;
    } catch (e) {
      testCases.push({ case: 'Component recovery', passed: false, error: e.message });
      results.failed++;
    }

    TEST_RESULTS.failures.redisDown = results;
    console.log(`  Result: ${results.passed}/4 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.failures.redisDown = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      test: 'redisDown',
      error: error.message,
    });
    return { passed: 0, failed: 4 };
  }
}

/**
 * Test 2: Database Component Failure
 */
async function testDatabaseComponentFailure(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Chaos Test 2] Database Component Failure');

    // Read operation before failure
    try {
      console.log('  [1/4] Normal read operation');
      await client.sendCommand('getMonitors', {});
      results.passed++;
    } catch (e) {
      console.log(`    Warning: ${e.message}`);
      results.failed++;
    }

    // Inject database failure
    try {
      console.log('  [2/4] Injecting database failure');
      await client.sendCommand('injectFailure', {
        component: 'database',
        enabled: true,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Operations continue with read replicas/cache
    try {
      console.log('  [3/4] Operations use fallback (read replicas/cache)');
      const op = await client.sendCommand('getMonitors', {});
      if (op.status === 'degraded' || op.cached === true || op.status === 'success') {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (e) {
      console.log(`    Expected failure during database outage`);
      results.failed++;
    }

    // Recovery
    try {
      console.log('  [4/4] Database recovery');
      await client.sendCommand('injectFailure', {
        component: 'database',
        enabled: false,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.failures.databaseDown = results;
    console.log(`  Result: ${results.passed}/4 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.failures.databaseDown = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      test: 'databaseDown',
      error: error.message,
    });
    return { passed: 0, failed: 4 };
  }
}

/**
 * Test 3: External Service Failure (Slack)
 */
async function testExternalServiceFailure(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Chaos Test 3] External Service Failure (Slack)');

    // Normal alert
    try {
      console.log('  [1/4] Send alert with Slack enabled');
      await client.sendCommand('sendAlert', {
        message: 'Test alert',
        service: 'slack',
      });
      results.passed++;
    } catch (e) {
      console.log(`    Warning: ${e.message}`);
      results.failed++;
    }

    // Inject Slack failure
    try {
      console.log('  [2/4] Injecting Slack service failure');
      await client.sendCommand('injectFailure', {
        component: 'slack',
        enabled: true,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Alert queued/retried
    try {
      console.log('  [3/4] Alerts queue for retry');
      const op = await client.sendCommand('sendAlert', {
        message: 'Test alert 2',
        service: 'slack',
      });
      if (op.status === 'queued' || op.retryScheduled === true) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (e) {
      results.failed++;
    }

    // Recovery
    try {
      console.log('  [4/4] Slack service recovery');
      await client.sendCommand('injectFailure', {
        component: 'slack',
        enabled: false,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.failures.slackDown = results;
    console.log(`  Result: ${results.passed}/4 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.failures.slackDown = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      test: 'slackDown',
      error: error.message,
    });
    return { passed: 0, failed: 4 };
  }
}

/**
 * Test 4: Proxy Component Failure
 */
async function testProxyComponentFailure(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Chaos Test 4] Proxy Component Failure');

    // Normal operation with proxy
    try {
      console.log('  [1/4] Normal navigation through proxy');
      await client.sendCommand('navigate', {
        url: 'https://example.com',
        useProxy: true,
      });
      results.passed++;
    } catch (e) {
      console.log(`    Warning: ${e.message}`);
      results.failed++;
    }

    // Inject proxy failure
    try {
      console.log('  [2/4] Injecting proxy failure');
      await client.sendCommand('injectFailure', {
        component: 'proxy',
        enabled: true,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Fallback to direct connection
    try {
      console.log('  [3/4] Fall back to direct connection');
      const op = await client.sendCommand('navigate', {
        url: 'https://example.com',
        fallbackToDirect: true,
      });
      if (op.status === 'success' || op.fallbackUsed === true) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (e) {
      console.log(`    Expected during proxy failure`);
      results.failed++;
    }

    // Recovery
    try {
      console.log('  [4/4] Proxy recovery');
      await client.sendCommand('injectFailure', {
        component: 'proxy',
        enabled: false,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.failures.proxyDown = results;
    console.log(`  Result: ${results.passed}/4 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.failures.proxyDown = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      test: 'proxyDown',
      error: error.message,
    });
    return { passed: 0, failed: 4 };
  }
}

/**
 * Test 5: Network Interruption
 */
async function testNetworkInterruption(client) {
  const results = { passed: 0, failed: 0 };

  try {
    console.log('[Chaos Test 5] Network Interruption');

    // Normal operation
    try {
      console.log('  [1/4] Initial navigation');
      await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Inject network interruption
    try {
      console.log('  [2/4] Simulating network interruption');
      await client.sendCommand('injectFailure', {
        component: 'network',
        enabled: true,
        duration: 5000,
      });
      results.passed++;
    } catch (e) {
      results.failed++;
    }

    // Retry mechanism
    try {
      console.log('  [3/4] Automatic retry on network restore');
      await new Promise((r) => setTimeout(r, 6000)); // Wait for interruption to end
      const op = await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      if (op.status === 'success' || op.retriedAfterFailure === true) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (e) {
      console.log(`    Retry may still be pending`);
    }

    // Verify recovery
    try {
      console.log('  [4/4] Network fully recovered');
      const op = await client.sendCommand('navigate', {
        url: 'https://example.com',
      });
      if (op.status === 'success') {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (e) {
      results.failed++;
    }

    TEST_RESULTS.failures.networkInterruption = results;
    console.log(`  Result: ${results.passed}/4 passed\n`);
    return results;
  } catch (error) {
    console.error(`  Fatal error: ${error.message}\n`);
    TEST_RESULTS.failures.networkInterruption = { passed: 0, failed: 4 };
    TEST_RESULTS.errors.push({
      test: 'networkInterruption',
      error: error.message,
    });
    return { passed: 0, failed: 4 };
  }
}

/**
 * Run all chaos tests
 */
async function runChaosTests() {
  console.log('\n========================================');
  console.log('CHAOS ENGINEERING: COMPONENT FAILURE');
  console.log('========================================\n');

  let client;

  try {
    client = new ChaosTestClient(SERVER_URL);
    console.log('Connecting to WebSocket server...');
    await client.connect(5000);
    console.log('Connected successfully\n');

    // Run all failure tests
    await testRedisComponentFailure(client);
    await testDatabaseComponentFailure(client);
    await testExternalServiceFailure(client);
    await testProxyComponentFailure(client);
    await testNetworkInterruption(client);

    // Calculate totals
    const allResults = Object.values(TEST_RESULTS.failures);
    TEST_RESULTS.totalTests = allResults.reduce(
      (sum, r) => sum + r.passed + r.failed,
      0
    );
    TEST_RESULTS.totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    TEST_RESULTS.totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);

    // Print summary
    console.log('========================================');
    console.log('CHAOS TEST SUMMARY');
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

    console.log('\nComponent Failure Results:');
    Object.entries(TEST_RESULTS.failures).forEach(([component, results]) => {
      const total = results.passed + results.failed;
      console.log(`  ${component}: ${results.passed}/${total} passed`);
    });

    if (TEST_RESULTS.errors.length > 0) {
      console.log('\nErrors:');
      TEST_RESULTS.errors.forEach((err) => {
        console.log(`  - [${err.test}] ${err.error}`);
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
runChaosTests()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });

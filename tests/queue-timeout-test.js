/**
 * Queue Timeout Reliability Test
 *
 * Validates the queue timeout fix:
 * 1. Atomic timeout set/clear prevents timeout/release race conditions
 * 2. Processed flag prevents double-processing of queued requests
 * 3. Synchronized release() call ensures safe queue state transitions
 */

const { ConnectionPool } = require('../websocket/connection-pool');
const WebSocket = require('ws');

class TestHarness {
  constructor() {
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      details: []
    };
  }

  async test(name, fn) {
    this.results.totalTests++;
    try {
      await fn();
      this.results.passedTests++;
      this.results.details.push({
        name,
        status: 'PASS',
        duration: 0
      });
      console.log(`✓ ${name}`);
    } catch (err) {
      this.results.failedTests++;
      this.results.details.push({
        name,
        status: 'FAIL',
        error: err.message
      });
      console.log(`✗ ${name}: ${err.message}`);
    }
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message}: expected ${expected}, got ${actual}`);
    }
  }

  assertGreater(actual, expected, message) {
    if (actual <= expected) {
      throw new Error(`${message}: expected > ${expected}, got ${actual}`);
    }
  }

  printResults() {
    console.log('\n========================================');
    console.log('TEST RESULTS');
    console.log('========================================');
    console.log(`Total: ${this.results.totalTests}`);
    console.log(`Passed: ${this.results.passedTests}`);
    console.log(`Failed: ${this.results.failedTests}`);
    console.log(`Pass Rate: ${((this.results.passedTests / this.results.totalTests) * 100).toFixed(1)}%`);
    return this.results.passedTests === this.results.totalTests;
  }
}

async function runTests() {
  const harness = new TestHarness();

  // Test 1: Queue timeout occurs and request is rejected
  await harness.test('Timeout rejects request after queueTimeout ms', async () => {
    const pool = new ConnectionPool({
      maxConnections: 1,
      queueTimeout: 100,
      autoStartCleanup: false
    });

    // Create mock WebSocket
    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    // Acquire first connection to block pool
    const conn1 = await pool.acquire('client1', mockWs);
    harness.assert(conn1, 'First connection should be acquired');

    // Try to queue second request
    const startTime = Date.now();
    let timeoutError = null;
    try {
      await pool.acquire('client2', mockWs, { command: 'test' });
    } catch (err) {
      timeoutError = err;
    }

    const elapsed = Date.now() - startTime;
    harness.assert(timeoutError, 'Request should timeout');
    harness.assert(elapsed >= 100, `Timeout should occur after ~100ms, took ${elapsed}ms`);
    harness.assertEqual(pool.metrics.totalRejectedRequests, 1, 'Rejected requests should increment');

    pool.stopCleanup();
  });

  // Test 2: Processed flag prevents double-processing
  await harness.test('Processed flag prevents double-processing of same request', async () => {
    const pool = new ConnectionPool({
      maxConnections: 1,
      queueTimeout: 1000,
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    // Acquire connection to block pool
    const conn1 = await pool.acquire('client1', mockWs);
    conn1.activeCommands = 5; // Mark as at capacity

    // Queue a request (will queue since connection is at capacity)
    let queuePromise = pool.acquire('client1', mockWs, { command: 'queued' });
    await new Promise(resolve => setTimeout(resolve, 50)); // Let it queue

    // Verify request is in queue and has processed flag
    harness.assert(pool.blockingQueue.length > 0, 'Request should be queued');
    const queuedReq = pool.blockingQueue[0];
    harness.assertEqual(queuedReq.processed, false, 'Initial processed flag should be false');

    // Release connection to trigger processing
    pool.release('client1');
    const result = await queuePromise;

    // Verify processed flag was set
    harness.assertEqual(queuedReq.processed, true, 'Processed flag should be true after handling');

    pool.stopCleanup();
  });

  // Test 3: Atomic timeout clear prevents timeout callback after release
  await harness.test('Timeout callback skipped if request already processed', async () => {
    const pool = new ConnectionPool({
      maxConnections: 1,
      queueTimeout: 200,
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    const conn1 = await pool.acquire('client1', mockWs);

    let resolvedRequest = null;
    let timedOutRequest = null;

    // Queue request
    const queuePromise = pool.acquire('client1', mockWs, { command: 'test' })
      .then(conn => {
        resolvedRequest = conn;
        return conn;
      })
      .catch(err => {
        timedOutRequest = err;
        throw err;
      });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Release before timeout - should not cause double timeout
    pool.release('client1');

    // Wait for resolution
    try {
      const result = await queuePromise;
      harness.assert(result, 'Request should resolve successfully');
      harness.assert(!timedOutRequest, 'Request should not timeout after being processed');
    } catch (err) {
      // This should not happen
      throw new Error('Request should not timeout when released before timeout');
    }

    pool.stopCleanup();
  });

  // Test 4: Synchronized release doesn't cause queue state corruption
  await harness.test('Multiple releases maintain queue integrity', async () => {
    const pool = new ConnectionPool({
      maxConnections: 10,  // Larger pool to avoid exhaustion
      queueTimeout: 500,
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    // Create two connections at capacity
    const conn1 = await pool.acquire('client1', mockWs);
    const conn2 = await pool.acquire('client2', mockWs);
    conn1.activeCommands = 5; // Mark as at capacity
    conn2.activeCommands = 5; // Mark as at capacity

    // Queue three requests
    const q1 = pool.acquire('client1', mockWs, { command: 'q1' });
    const q2 = pool.acquire('client2', mockWs, { command: 'q2' });
    const q3 = pool.acquire('client1', mockWs, { command: 'q3' });

    await new Promise(resolve => setTimeout(resolve, 50));
    harness.assertEqual(pool.blockingQueue.length, 3, 'All requests should be queued');

    // Release in sequence - should process queued requests
    pool.release('client1');
    await new Promise(resolve => setTimeout(resolve, 10));
    pool.release('client2');
    await new Promise(resolve => setTimeout(resolve, 10));

    // Check final state - queue should be in valid state
    const metrics = pool._validateQueueMetrics();
    harness.assertEqual(metrics.metricsSync, true, 'Queue metrics should be synchronized');

    pool.stopCleanup();
  });

  // Test 5: Timeout doesn't corrupt queue when request removed mid-timeout
  await harness.test('Timeout handles request removal gracefully', async () => {
    const pool = new ConnectionPool({
      maxConnections: 1,
      queueTimeout: 150,
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    const conn1 = await pool.acquire('client1', mockWs);
    conn1.activeCommands = 5; // Mark as at capacity

    // Queue request
    let timedOut = false;
    const queuePromise = pool.acquire('client1', mockWs, { command: 'test' })
      .catch(err => {
        timedOut = true;
        // Don't re-throw, just mark it
      });

    // Wait for timeout to occur
    await queuePromise;
    await new Promise(resolve => setTimeout(resolve, 50));

    harness.assert(timedOut, 'Request should timeout');
    harness.assertEqual(pool.metrics.totalRejectedRequests, 1, 'Should count rejected request');

    // Queue should be clean
    harness.assertEqual(pool.blockingQueue.length, 0, 'Queue should be clean after timeout');

    pool.stopCleanup();
  });

  // Test 6: No race condition between timeout and release
  await harness.test('Race condition test: timeout vs release on same request', async () => {
    const pool = new ConnectionPool({
      maxConnections: 5,
      queueTimeout: 150,
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    // Test a few iterations with proper handling
    for (let i = 0; i < 3; i++) {
      const conn1 = await pool.acquire(`client-${i}`, mockWs);
      conn1.activeCommands = 5; // Mark as at capacity

      let outcome = null;
      const promise = pool.acquire(`client-${i}`, mockWs, { command: 'test' })
        .then(() => { outcome = 'resolved'; })
        .catch(() => { outcome = 'rejected'; });

      // Release before timeout
      await new Promise(resolve => setTimeout(resolve, 30));
      pool.release(`client-${i}`);

      // Wait for promise to settle
      try {
        await promise;
      } catch (err) {
        // Handle error
      }

      // Should resolve since we released
      harness.assertEqual(outcome, 'resolved', 'Request should resolve when released before timeout');
    }

    pool.stopCleanup();
  });

  // Test 7: Queue metrics stay synchronized
  await harness.test('Queue metrics remain synchronized under stress', async () => {
    const pool = new ConnectionPool({
      maxConnections: 5,
      queueTimeout: 500,  // Longer timeout to allow releases
      autoStartCleanup: false
    });

    const mockWs = {
      readyState: 1,
      CLOSED: 3,
      close: () => {}
    };

    // Create initial connections
    const conns = [];
    for (let i = 0; i < 5; i++) {
      const conn = await pool.acquire(`client-${i}`, mockWs);
      conn.activeCommands = 5; // Mark as at capacity
      conns.push(conn);
    }

    // Queue multiple requests (limited to avoid exhaustion)
    const promises = [];
    for (let i = 0; i < 8; i++) {
      promises.push(
        pool.acquire(`client-${i % 5}`, mockWs, { command: `cmd-${i}` })
          .catch(() => null) // Ignore timeouts
      );
    }

    // Release in sequence to process queue
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      pool.release(`client-${i}`);
    }

    // Wait for all promises to settle
    await Promise.all(promises);

    // Final validation
    const metrics = pool._validateQueueMetrics();
    harness.assertEqual(metrics.metricsSync, true, 'Queue metrics should be synchronized');
    harness.assertEqual(pool.blockingQueue.length, metrics.validQueuedRequests,
      'Queue size should match valid requests');

    pool.stopCleanup();
  });

  // Print results
  const allPassed = harness.printResults();
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  console.error('Test harness error:', err);
  process.exit(1);
});

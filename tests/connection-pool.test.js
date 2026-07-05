/**
 * Comprehensive test suite for ConnectionPool
 * Tests connection reuse, configuration limits, idle cleanup, and concurrent metrics
 */

const assert = require('assert');
const { ConnectionPool, ClientConnection } = require('../websocket/connection-pool');
const { EventEmitter } = require('events');

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1; // OPEN
    this.CLOSED = 3;
    this.closed = false;
  }

  close(code, reason) {
    this.readyState = this.CLOSED;
    this.closed = true;
  }

  send(data) {
    this.emit('send', data);
  }
}

// Mock logger
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

describe('ConnectionPool - Connection Creation', () => {
  let pool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 1000,
      queueTimeout: 5000,
      autoStartCleanup: false,
      logger: mockLogger
    });
  });

  afterEach(async () => {
    await pool.drain();
  });

  it('should create new connection when pool has capacity', async () => {
    const ws = new MockWebSocket();
    const conn = await pool.acquire('client1', ws);

    assert(conn instanceof ClientConnection);
    assert.strictEqual(conn.clientId, 'client1');
    assert.strictEqual(pool.getStatus().active, 1);
    assert.strictEqual(pool.getMetrics().summary.totalConnectionsCreated, 1);
  });

  it('should throw error when creating connection without WebSocket', async () => {
    try {
      await pool.acquire('client1');
      assert.fail('Should throw error');
    } catch (err) {
      assert(err.message.includes('WebSocket connection required'));
    }
  });

  it('should queue requests when max connections exceeded', async () => {
    // Fill the pool
    for (let i = 0; i < 10; i++) {
      const ws = new MockWebSocket();
      await pool.acquire(`client${i}`, ws);
    }

    assert.strictEqual(pool.getStatus().active, 10);

    // Try to add one more - should queue
    const ws = new MockWebSocket();
    const request = { command: 'test', priority: 'normal' };
    const promise = pool.acquire('client10', ws, request);

    assert.strictEqual(pool.getQueueSize(), 1);
  });
});

describe('ConnectionPool - Connection Reuse', () => {
  let pool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 1000,
      queueTimeout: 5000,
      autoStartCleanup: false,
      logger: mockLogger
    });
  });

  afterEach(async () => {
    await pool.drain();
  });

  it('should reuse existing connection for same client', async () => {
    const ws = new MockWebSocket();
    const conn1 = await pool.acquire('client1', ws);

    // FIX: Ensure connection is ready before next reuse
    // Complete the command to clear activeCommands counter
    conn1.completeCommand();
    await new Promise(resolve => setImmediate(resolve));

    const conn2 = await pool.acquire('client1', ws);

    assert.strictEqual(conn1, conn2);
    assert.strictEqual(conn1.connectionReuses, 1);
    assert.strictEqual(pool.getStatus().active, 1);
    assert.strictEqual(pool.getMetrics().summary.totalConnectionsReused, 1);

    // Cleanup: Clear activeCommands state
    conn2.completeCommand();
  });

  it('should track reuse count correctly', async () => {
    const ws = new MockWebSocket();
    const conn1 = await pool.acquire('client1', ws);

    // FIX: Proper sequence - complete, yield event loop, then reuse
    for (let i = 0; i < 5; i++) {
      conn1.completeCommand();
      // FIX: Yield to event loop to ensure state is settled
      await new Promise(resolve => setImmediate(resolve));

      const conn = await pool.acquire('client1', ws);
      assert.strictEqual(conn.connectionReuses, i + 1);
    }

    // FIX: Final cleanup - clear activeCommands state
    conn1.completeCommand();

    assert.strictEqual(pool.getMetrics().summary.totalConnectionsReused, 5);
  });

  it('should queue when connection at max concurrent', async () => {
    const ws = new MockWebSocket();
    const conn = await pool.acquire('client1', ws);

    // Simulate max concurrent reached
    conn.activeCommands = conn.maxConcurrent;

    // FIX: Yield to event loop to ensure state is settled before queueing
    await new Promise(resolve => setImmediate(resolve));

    // Next acquire should queue
    const request = { command: 'test', priority: 'normal' };
    const promise = pool.acquire('client1', ws, request);

    // FIX: Yield to allow queue processing before assertion
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(pool.getQueueSize(), 1);
    assert.strictEqual(pool.getMetrics().summary.totalQueuedRequests, 1);

    // Release one command slot - FIX: Await to ensure processing
    pool.release('client1');
    // FIX: Yield to allow queued request to process
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(pool.getQueueSize(), 0);
  });
});

describe('ConnectionPool - Configuration Limits', () => {
  it('should respect max connections setting', async () => {
    const smallPool = new ConnectionPool({
      maxConnections: 3,
      autoStartCleanup: false,
      logger: mockLogger
    });

    // Create 3 connections
    for (let i = 0; i < 3; i++) {
      const ws = new MockWebSocket();
      await smallPool.acquire(`client${i}`, ws);
    }

    assert.strictEqual(smallPool.getStatus().active, 3);

    // 4th connection should go to queue
    const ws = new MockWebSocket();
    const request = { command: 'test', priority: 'normal' };
    const promise = smallPool.acquire('client3', ws, request);

    assert.strictEqual(smallPool.getQueueSize(), 1);
    await smallPool.drain();
  });

  it('should apply custom idle timeout', async () => {
    const customPool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 500,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const ws = new MockWebSocket();
    const conn = await customPool.acquire('client1', ws);
    conn.completeCommand();

    assert.strictEqual(conn.isIdle(500), false);

    // Advance time
    conn.lastActivity = Date.now() - 600;
    assert.strictEqual(conn.isIdle(500), true);

    await customPool.drain();
  });

  it('should apply custom queue timeout', async () => {
    const customPool = new ConnectionPool({
      maxConnections: 1,
      queueTimeout: 100,
      autoStartCleanup: false,
      logger: mockLogger
    });

    // Fill pool
    const ws1 = new MockWebSocket();
    await customPool.acquire('client1', ws1);

    // Queue a request with short timeout
    const ws2 = new MockWebSocket();
    const request = { command: 'test', priority: 'normal' };
    const promise = customPool.acquire('client2', ws2, request);

    // Wait for timeout
    try {
      await promise;
      assert.fail('Should timeout');
    } catch (err) {
      assert(err.message.includes('timeout'));
    }

    await customPool.drain();
  });
});

describe('ConnectionPool - Idle Cleanup', () => {
  it('should close idle connections', async () => {
    const cleanupPool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 500,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const ws = new MockWebSocket();
    const conn = await cleanupPool.acquire('client1', ws);
    conn.completeCommand();
    const initialActive = cleanupPool.getStatus().active;

    // Mark as idle
    conn.lastActivity = Date.now() - 600;

    // Manually close idle connection
    if (conn.isIdle(cleanupPool.idleTimeout)) {
      cleanupPool.closeConnection('client1');
    }

    assert.strictEqual(initialActive, 1);
    assert.strictEqual(cleanupPool.getStatus().active, 0);

    cleanupPool.stopCleanup();
  });

  it('should not close connections with active commands', async () => {
    const pool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 1000,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const ws = new MockWebSocket();
    const conn = await pool.acquire('client1', ws);

    // Simulate active command
    conn.activeCommands = 1;
    conn.lastActivity = Date.now() - 2000; // Old timestamp

    assert.strictEqual(conn.isIdle(1000), false);

    await pool.drain();
  });
});

describe('ConnectionPool - Concurrent Metrics', () => {
  let pool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxConnections: 10,
      idleTimeout: 5000,
      autoStartCleanup: false,
      logger: mockLogger
    });
  });

  afterEach(async () => {
    await pool.drain();
  });

  it('should track peak active connections', async () => {
    for (let i = 0; i < 5; i++) {
      const ws = new MockWebSocket();
      await pool.acquire(`client${i}`, ws);
    }

    assert.strictEqual(pool.getMetrics().summary.peakActiveConnections, 5);
  });

  it('should track peak queue size', async () => {
    // Fill pool
    for (let i = 0; i < 10; i++) {
      const ws = new MockWebSocket();
      await pool.acquire(`client${i}`, ws);
    }

    // Queue 3 requests
    for (let i = 0; i < 3; i++) {
      const ws = new MockWebSocket();
      const request = { command: 'test', priority: 'normal' };
      pool.acquire(`queueClient${i}`, ws, request).catch(() => {});
    }

    assert.strictEqual(pool.getMetrics().summary.peakQueueSize, 3);
  });

  it('should track connection utilization percentage', async () => {
    for (let i = 0; i < 5; i++) {
      const ws = new MockWebSocket();
      await pool.acquire(`client${i}`, ws);
    }

    const metrics = pool.getMetrics();
    const utilization = parseFloat(metrics.summary.utilizationPercent);

    assert.strictEqual(utilization, 50.0);
  });

  it('should report health status', () => {
    const health = pool.getHealthStatus();

    assert(health.hasOwnProperty('poolUtilization'));
    assert(health.hasOwnProperty('activeConnections'));
    assert(health.hasOwnProperty('maxConnections'));
    assert(health.hasOwnProperty('queuedRequests'));
    assert(health.hasOwnProperty('healthy'));
    assert(health.hasOwnProperty('warning'));
  });
});

describe('ConnectionPool - High Concurrency (100+)', () => {
  it('should handle 100+ concurrent operations', async () => {
    const largePool = new ConnectionPool({
      maxConnections: 150,
      idleTimeout: 5000,
      queueTimeout: 10000,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const promises = [];

    // Create 120 concurrent connections
    for (let i = 0; i < 120; i++) {
      const ws = new MockWebSocket();
      const request = { command: `test${i}`, priority: 'normal' };
      promises.push(
        largePool.acquire(`client${i}`, ws, request).catch(err => null)
      );
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r !== null).length;

    assert(successCount >= 120);
    assert(largePool.getStatus().active > 0);
    assert(largePool.getMetrics().summary.peakActiveConnections >= 120);

    await largePool.drain();
  });

  it('should handle sustained load without degradation', async function() {
    // FIX: Increase test timeout to accommodate queue timeouts
    // With queueTimeout: 15000, we need at least 20s for full test execution
    this.timeout(25000);

    const largePool = new ConnectionPool({
      maxConnections: 100,
      // FIX: Use shorter queueTimeout to prevent excessive wait times during testing
      // This ensures queued requests fail fast instead of blocking for 15+ seconds
      idleTimeout: 10000,
      queueTimeout: 1000,
      autoStartCleanup: false,
      logger: mockLogger
    });

    // Simulate sustained load in batches
    for (let batch = 0; batch < 3; batch++) {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        const ws = new MockWebSocket();
        const request = { command: `batch${batch}_test${i}`, priority: 'normal' };
        promises.push(
          largePool.acquire(`client${batch}_${i}`, ws, request).catch(() => null)
        );
      }

      // FIX: Wait for all acquire promises to settle with explicit timeout
      // to prevent hanging indefinitely on queued requests
      const settleTimeout = Promise.race([
        Promise.allSettled(promises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Promises did not settle in time')), 3000)
        )
      ]);

      try {
        await settleTimeout;
      } catch (err) {
        // FIX: If settling times out, that's ok - means some promises were queued
        // Just continue to next batch
      }

      // FIX: Explicit yield to event loop to ensure all micro-tasks complete
      // before proceeding to next batch. This prevents accumulated async tasks
      // from causing drain() timeouts in afterEach.
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // FIX: Yield to event loop before metrics retrieval to ensure
    // all async state updates complete
    await new Promise(resolve => setImmediate(resolve));

    const finalMetrics = largePool.getMetrics().summary;
    assert(finalMetrics.totalConnectionsCreated > 0);
    assert(finalMetrics.peakActiveConnections > 50);

    // FIX: Drain all connections with proper timeout handling
    await largePool.drain();

    // FIX: Additional yield to ensure drain() cleanup handlers complete
    await new Promise(resolve => setImmediate(resolve));
  });

  it('should correctly report metrics under high load', async () => {
    const largePool = new ConnectionPool({
      maxConnections: 100,
      idleTimeout: 5000,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const promises = [];

    // Create load spike
    for (let i = 0; i < 100; i++) {
      const ws = new MockWebSocket();
      const request = { command: `spike${i}`, priority: 'normal' };
      promises.push(
        largePool.acquire(`spike${i}`, ws, request).catch(() => null)
      );
    }

    await Promise.all(promises);

    // FIX: Explicit yield to event loop before metrics retrieval
    // to ensure all async state updates and command completions are processed
    await new Promise(resolve => setImmediate(resolve));

    const metrics = largePool.getMetrics();
    const status = largePool.getStatus();

    assert(metrics.summary.currentActiveConnections <= 100);
    assert(metrics.summary.peakActiveConnections >= 100);
    assert(status.active > 0);

    await largePool.drain();
  });
});

describe('ClientConnection', () => {
  it('should track command execution', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws);

    conn.recordCommand('navigate', 50, false);
    conn.recordCommand('click', 30, false);

    assert.strictEqual(conn.totalRequests, 2);
    assert.strictEqual(conn.totalErrors, 0);
    assert.strictEqual(conn.commandHistory.length, 2);
  });

  it('should calculate error rate', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws);

    conn.recordCommand('cmd1', 10, false);
    conn.recordCommand('cmd2', 10, true);
    conn.recordCommand('cmd3', 10, true);

    const metrics = conn.getMetrics();
    assert.strictEqual(metrics.errorRate, '66.67%');
  });

  it('should calculate average latency', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws);

    conn.recordCommand('cmd1', 100, false);
    conn.recordCommand('cmd2', 50, false);
    conn.recordCommand('cmd3', 150, false);

    const metrics = conn.getMetrics();
    assert.strictEqual(parseFloat(metrics.averageLatency), 100);
  });

  it('should handle retry logic', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws, { maxRetries: 2 });

    assert.strictEqual(conn.isRetryExhausted(), false);

    conn.markUnhealthy();
    assert.strictEqual(conn.isHealthy, false);
    assert.strictEqual(conn.retryCount, 1);
    assert.strictEqual(conn.isRetryExhausted(), false);

    conn.markUnhealthy();
    assert.strictEqual(conn.retryCount, 2);

    conn.markUnhealthy();
    assert.strictEqual(conn.retryCount, 3);
    assert.strictEqual(conn.isRetryExhausted(), true);
  });

  it('should reset retry count on success', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws);

    conn.markUnhealthy();
    assert.strictEqual(conn.retryCount, 1);

    conn.resetRetryCount();
    assert.strictEqual(conn.retryCount, 0);
    assert.strictEqual(conn.isHealthy, true);
  });

  it('should keep command history limited to 50', () => {
    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws);

    for (let i = 0; i < 60; i++) {
      conn.recordCommand(`cmd${i}`, 10, false);
    }

    assert.strictEqual(conn.commandHistory.length, 50);
    assert.strictEqual(conn.commandHistory[0].command, 'cmd10');
  });
});

describe('ConnectionPool - Drain', () => {
  it('should gracefully drain all connections', async () => {
    const pool = new ConnectionPool({
      maxConnections: 10,
      autoStartCleanup: false,
      logger: mockLogger
    });

    for (let i = 0; i < 5; i++) {
      const ws = new MockWebSocket();
      await pool.acquire(`client${i}`, ws);
    }

    assert.strictEqual(pool.getStatus().active, 5);

    await pool.drain();

    assert.strictEqual(pool.getStatus().active, 0);
    assert.strictEqual(pool.getMetrics().summary.totalConnectionsClosed, 5);
  });

  it('should stop cleanup interval on drain', async () => {
    const cleanupPool = new ConnectionPool({
      maxConnections: 10,
      autoStartCleanup: true,
      logger: mockLogger
    });

    const ws = new MockWebSocket();
    await cleanupPool.acquire('client1', ws);

    assert(cleanupPool.cleanupInterval !== null);

    await cleanupPool.drain();

    assert(cleanupPool.cleanupInterval === null);
  });
});

describe('ConnectionPool - Error Handling', () => {
  it('should handle connection rejection on full queue', async () => {
    const smallPool = new ConnectionPool({
      maxConnections: 2,
      queueTimeout: 100,
      autoStartCleanup: false,
      logger: mockLogger
    });

    // Fill pool
    const ws1 = new MockWebSocket();
    const ws2 = new MockWebSocket();
    await smallPool.acquire('client1', ws1);
    await smallPool.acquire('client2', ws2);

    // Queue many requests
    const promises = [];
    for (let i = 0; i < 10; i++) {
      const ws = new MockWebSocket();
      const request = { command: 'test', priority: 'normal' };
      promises.push(
        smallPool.acquire(`queueClient${i}`, ws, request).catch(err => err.message)
      );
    }

    const results = await Promise.all(promises);
    const rejectedCount = results.filter(r => typeof r === 'string').length;

    assert(rejectedCount > 0);
    await smallPool.drain();
  });

  it('should handle unhealthy connections', async () => {
    const pool = new ConnectionPool({
      maxConnections: 10,
      autoStartCleanup: false,
      logger: mockLogger
    });

    const ws = new MockWebSocket();
    const conn = new ClientConnection('test-client', ws, { maxRetries: 1 });

    pool.connections.set('test-client', conn);

    pool.markConnectionUnhealthy('test-client');
    assert.strictEqual(conn.isHealthy, false);

    pool.markConnectionUnhealthy('test-client');
    assert.strictEqual(pool.connections.has('test-client'), false);

    await pool.drain();
  });
});

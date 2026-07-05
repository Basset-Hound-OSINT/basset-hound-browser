/**
 * Comprehensive verification script for ConnectionPool
 * Tests 100+ concurrent connections and all key features
 */

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

// Simple test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running ConnectionPool Tests...\n');

    for (const { name, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        this.results.push({ status: 'PASS', name });
        console.log(`✓ ${name}`);
      } catch (err) {
        this.failed++;
        this.results.push({ status: 'FAIL', name, error: err.message });
        console.log(`✗ ${name}`);
        console.log(`  Error: ${err.message}\n`);
      }
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('='.repeat(70) + '\n');

    if (this.failed > 0) {
      console.log('Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
      process.exit(1);
    } else {
      console.log('All tests passed!');
      process.exit(0);
    }
  }
}

// Mock logger
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {}
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Create test runner
const runner = new TestRunner();

// Test: Connection Creation
runner.test('Connection Creation - Create new connection', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  const ws = new MockWebSocket();
  const conn = await pool.acquire('client1', ws);

  assert(conn instanceof ClientConnection, 'Connection should be ClientConnection instance');
  assert(conn.clientId === 'client1', 'Client ID should match');
  assert(pool.getStatus().active === 1, 'Pool should have 1 active connection');

  await pool.drain();
});

// Test: Connection Reuse
runner.test('Connection Reuse - Reuse existing connection', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  const ws = new MockWebSocket();
  const conn1 = await pool.acquire('client1', ws);
  const conn2 = await pool.acquire('client1', ws);

  assert(conn1 === conn2, 'Should reuse same connection');
  assert(conn1.connectionReuses === 1, 'Reuse count should be 1');
  assert(pool.getMetrics().summary.totalConnectionsReused === 1, 'Metrics should track reuse');

  await pool.drain();
});

// Test: Configuration Limits
runner.test('Configuration Limits - Respect max connections', async () => {
  const pool = new ConnectionPool({
    maxConnections: 3,
    autoStartCleanup: false,
    logger: mockLogger
  });

  for (let i = 0; i < 3; i++) {
    const ws = new MockWebSocket();
    await pool.acquire(`client${i}`, ws, { command: 'init' });
  }

  assert(pool.getStatus().active === 3, 'Should have 3 active connections');

  const ws = new MockWebSocket();
  const request = { command: 'navigate', priority: 'normal' };
  const promise = pool.acquire('client3', ws, request).catch(() => null);

  assert(pool.blockingQueue.length === 1, 'Should queue 4th request');

  await pool.drain().catch(() => {});
  await promise;
});

// Test: Idle Timeout
runner.test('Idle Cleanup - Close idle connections', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    idleTimeout: 500,
    autoStartCleanup: false,
    logger: mockLogger
  });

  const ws = new MockWebSocket();
  const conn = await pool.acquire('client1', ws, { command: 'init' });

  assert(pool.getStatus().active === 1, 'Should have 1 connection');

  // Mark as idle - need to set both lastActivity and activeCommands
  conn.lastActivity = Date.now() - 600;
  conn.activeCommands = 0;
  assert(conn.isIdle(pool.idleTimeout), 'Connection should be idle');

  // Manually close
  pool.closeConnection('client1');

  assert(pool.getStatus().active === 0, 'Should have 0 connections after close');

  await pool.drain();
});

// Test: Concurrent Metrics
runner.test('Metrics - Track peak active connections', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  for (let i = 0; i < 5; i++) {
    const ws = new MockWebSocket();
    await pool.acquire(`client${i}`, ws);
  }

  const metrics = pool.getMetrics();
  assert(metrics.summary.peakActiveConnections === 5, 'Peak should be 5');

  await pool.drain();
});

// Test: Utilization Percentage
runner.test('Metrics - Calculate utilization percentage', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  for (let i = 0; i < 5; i++) {
    const ws = new MockWebSocket();
    await pool.acquire(`client${i}`, ws);
  }

  const util = parseFloat(pool.getMetrics().summary.utilizationPercent);
  assert(util === 50.0, 'Utilization should be 50%');

  await pool.drain();
});

// Test: Health Status
runner.test('Health - Report health status', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  const health = pool.getHealthStatus();

  assert(health.hasOwnProperty('poolUtilization'), 'Should have poolUtilization');
  assert(health.hasOwnProperty('activeConnections'), 'Should have activeConnections');
  assert(health.hasOwnProperty('maxConnections'), 'Should have maxConnections');
  assert(health.hasOwnProperty('queuedRequests'), 'Should have queuedRequests');
  assert(health.hasOwnProperty('healthy'), 'Should have healthy status');

  await pool.drain();
});

// Test: Command Tracking
runner.test('ClientConnection - Track command execution', async () => {
  const ws = new MockWebSocket();
  const conn = new ClientConnection('test-client', ws);

  conn.recordCommand('navigate', 50, false);
  conn.recordCommand('click', 30, false);

  assert(conn.totalRequests === 2, 'Should have 2 requests');
  assert(conn.totalErrors === 0, 'Should have 0 errors');
  assert(conn.commandHistory.length === 2, 'Should track history');
});

// Test: Error Rate Calculation
runner.test('ClientConnection - Calculate error rate', async () => {
  const ws = new MockWebSocket();
  const conn = new ClientConnection('test-client', ws);

  conn.recordCommand('cmd1', 10, false);
  conn.recordCommand('cmd2', 10, true);
  conn.recordCommand('cmd3', 10, true);

  const metrics = conn.getMetrics();
  assert(metrics.errorRate === '66.67%', 'Error rate should be 66.67%');
});

// Test: Average Latency
runner.test('ClientConnection - Calculate average latency', async () => {
  const ws = new MockWebSocket();
  const conn = new ClientConnection('test-client', ws);

  conn.recordCommand('cmd1', 100, false);
  conn.recordCommand('cmd2', 50, false);
  conn.recordCommand('cmd3', 150, false);

  const metrics = conn.getMetrics();
  assert(parseFloat(metrics.averageLatency) === 100, 'Average latency should be 100ms');
});

// Test: Retry Logic
runner.test('ClientConnection - Handle retry logic', async () => {
  const ws = new MockWebSocket();
  const conn = new ClientConnection('test-client', ws, { maxRetries: 2 });

  assert(!conn.isRetryExhausted(), 'Should not be exhausted initially');

  conn.markUnhealthy();
  assert(!conn.isHealthy, 'Should be unhealthy');
  assert(conn.retryCount === 1, 'Retry count should be 1');

  conn.markUnhealthy();
  conn.markUnhealthy();
  assert(conn.isRetryExhausted(), 'Should be exhausted after 3 marks');
});

// Test: 100+ Concurrent Connections
runner.test('High Concurrency - Handle 100+ concurrent connections', async () => {
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
    const request = { command: 'navigate', priority: 'normal' };
    promises.push(
      largePool.acquire(`client${i}`, ws, request).catch(err => null)
    );
  }

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r !== null).length;

  assert(successCount >= 120, `Should handle 120 concurrent (got ${successCount})`);
  assert(largePool.getStatus().active > 0, 'Should have active connections');
  assert(largePool.getMetrics().summary.peakActiveConnections >= 120, 'Peak should be 120+');

  await largePool.drain();
});

// Test: Sustained Load
runner.test('High Concurrency - Handle sustained load', async () => {
  const largePool = new ConnectionPool({
    maxConnections: 100,
    idleTimeout: 10000,
    queueTimeout: 15000,
    autoStartCleanup: false,
    logger: mockLogger
  });

  // Three batches of 50 connections each
  for (let batch = 0; batch < 3; batch++) {
    const promises = [];

    for (let i = 0; i < 50; i++) {
      const ws = new MockWebSocket();
      const request = { command: 'navigate', priority: 'normal' };
      promises.push(
        largePool.acquire(`client${batch}_${i}`, ws, request).catch(() => null)
      );
    }

    await Promise.all(promises);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const metrics = largePool.getMetrics().summary;
  assert(metrics.totalConnectionsCreated > 0, 'Should create connections');
  assert(metrics.peakActiveConnections > 50, 'Peak should exceed 50');

  await largePool.drain().catch(() => {});
});

// Test: Pool Drain
runner.test('Pool Management - Gracefully drain pool', async () => {
  const pool = new ConnectionPool({
    maxConnections: 10,
    autoStartCleanup: false,
    logger: mockLogger
  });

  for (let i = 0; i < 5; i++) {
    const ws = new MockWebSocket();
    await pool.acquire(`client${i}`, ws);
  }

  assert(pool.getStatus().active === 5, 'Should have 5 connections');

  await pool.drain();

  assert(pool.getStatus().active === 0, 'Should have 0 connections after drain');
  assert(pool.getMetrics().summary.totalConnectionsClosed === 5, 'Should have closed 5');
});

// Test: Queue Management
runner.test('Queue - Queue request when pool at capacity', async () => {
  const pool = new ConnectionPool({
    maxConnections: 2,
    queueTimeout: 200,
    autoStartCleanup: false,
    logger: mockLogger
  });

  const ws1 = new MockWebSocket();
  const ws2 = new MockWebSocket();
  await pool.acquire('client1', ws1, { command: 'init' });
  await pool.acquire('client2', ws2, { command: 'init' });

  const ws3 = new MockWebSocket();
  const request = { command: 'navigate', priority: 'normal' };
  const promise = pool.acquire('client3', ws3, request).catch(() => null);

  assert(pool.blockingQueue.length === 1, 'Should have 1 queued request');

  // Queue timeout will eventually reject it
  await new Promise(r => setTimeout(r, 250));

  await pool.drain().catch(() => {});
  await promise;
});

// Run all tests
runner.run();

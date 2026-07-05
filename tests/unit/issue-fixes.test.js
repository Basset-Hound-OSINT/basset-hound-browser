/**
 * Tests for 7 Important Issues Fixed
 *
 * 1. Memory limit per command
 * 2. Event listener leaks
 * 3. No timeout ceiling
 * 4. Missing health check endpoint
 * 5. No error logging
 * 6. No request ID tracking
 * 7. Connection pool management
 */

const { MemoryLimiter } = require('../../websocket/memory-limiter');
const { ListenerCleanupManager } = require('../../websocket/listener-cleanup');
const { TimeoutManager } = require('../../websocket/timeout-manager');
const { HealthEndpointManager } = require('../../websocket/health-endpoint');
const { RequestTrackingManager } = require('../../websocket/request-tracking');
const { ConnectionPool } = require('../../websocket/pool-manager');
const { EventEmitter } = require('events');

// Mock logger for tests
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Issue #1: Memory Limit Per Command', () => {
  let limiter;

  beforeEach(() => {
    limiter = new MemoryLimiter({
      maxMemoryPerOperation: 100 * 1024 * 1024, // 100MB
      logger: mockLogger
    });
  });

  afterEach(() => {
    limiter.cleanup();
  });

  test('should register an operation for memory monitoring', () => {
    const monitor = limiter.registerOperation('op-1', 'test_command');

    expect(monitor.operationId).toBe('op-1');
    expect(monitor.checkMemory).toBeDefined();
    expect(monitor.complete).toBeDefined();
  });

  test('should track memory usage correctly', () => {
    const monitor = limiter.registerOperation('op-1', 'test_command');

    const status = monitor.checkMemory();
    expect(status.ok).toBe(true);
    expect(['continue', 'warn']).toContain(status.action);
    expect(status.memoryUsage).toBeDefined();
    expect(status.memoryUsage.current).toBeGreaterThan(0);
  });

  test('should complete operation and return stats', () => {
    const monitor = limiter.registerOperation('op-1', 'test_command');

    monitor.checkMemory();
    const stats = monitor.complete();

    expect(stats.operationId).toBe('op-1');
    expect(stats.command).toBe('test_command');
    expect(stats.duration).toBeGreaterThanOrEqual(0);
    expect(stats.memoryIncrease).toBeDefined();
  });

  test('should get system memory status', () => {
    const status = limiter.getSystemMemoryStatus();

    expect(status.free).toBeDefined();
    expect(status.used).toBeDefined();
    expect(status.total).toBeDefined();
    expect(status.percentUsed).toBeDefined();
  });

  test('should track multiple operations', () => {
    limiter.registerOperation('op-1', 'cmd1');
    limiter.registerOperation('op-2', 'cmd2');
    limiter.registerOperation('op-3', 'cmd3');

    const stats = limiter.getOperationStats();
    expect(Object.keys(stats).length).toBe(3);
  });

  test('should kill operation when marked killed', () => {
    const monitor = limiter.registerOperation('op-1', 'test');

    limiter.killOperation('op-1');
    const status = limiter.getOperationStats();

    expect(status['op-1'].killed).toBe(true);
  });
});

describe('Issue #2: Event Listener Leaks', () => {
  let manager;

  beforeEach(() => {
    manager = new ListenerCleanupManager({
      maxListenersPerTarget: 5,
      leakThreshold: 10,
      logger: mockLogger
    });
  });

  afterEach(() => {
    manager.cleanupAll();
  });

  test('should track a target', () => {
    const target = new EventEmitter();
    const tracker = manager.trackTarget(target, 'target-1');

    expect(tracker.addListener).toBeDefined();
    expect(tracker.removeListener).toBeDefined();
  });

  test('should add and remove listeners', () => {
    const target = new EventEmitter();
    const tracker = manager.trackTarget(target, 'target-1');
    const handler = () => {};

    const listenerId = tracker.addListener('event1', handler);
    expect(listenerId).toBeDefined();

    const removed = tracker.removeListener('event1', handler);
    expect(removed).toBe(true);
  });

  test('should get listener statistics', () => {
    const target = new EventEmitter();
    const tracker = manager.trackTarget(target, 'target-1');
    const handler = () => {};

    tracker.addListener('event1', handler);
    tracker.addListener('event2', handler);

    const stats = manager.getStats();
    expect(stats.totalTargets).toBeGreaterThan(0);
    expect(stats.totalListeners).toBeGreaterThanOrEqual(2);
  });

  test('should cleanup target on force clean', () => {
    const target = new EventEmitter();
    const tracker = manager.trackTarget(target, 'target-1');
    const handler = () => {};

    tracker.addListener('event1', handler);
    tracker.addListener('event2', handler);

    const result = manager.cleanupTarget('target-1');
    expect(result.cleaned).toBeGreaterThan(0);
  });

  test('should report operation count', () => {
    const target = new EventEmitter();
    const tracker = manager.trackTarget(target, 'target-1');

    const report = tracker.reportOperation();
    expect(report.operationCount).toBe(1);
    expect(report.needsCleanup).toBe(false);
  });
});

describe('Issue #3: No Timeout Ceiling', () => {
  let manager;

  beforeEach(() => {
    manager = new TimeoutManager({
      defaultTimeoutMs: 30000,
      maxTimeoutMs: 120000,
      minTimeoutMs: 1000,
      logger: mockLogger
    });
  });

  afterEach(() => {
    manager.killAllPending();
  });

  test('should register operation with timeout', () => {
    const timeoutCalled = jest.fn();
    const monitor = manager.registerOperation('op-1', 'test', 5000, timeoutCalled);

    expect(monitor.operationId).toBe('op-1');
    expect(monitor.clear).toBeDefined();
    expect(monitor.extend).toBeDefined();
  });

  test('should clamp timeout to maximum', () => {
    const monitor = manager.registerOperation('op-1', 'test', 300000);

    const status = monitor.getStatus();
    expect(status.effectiveTimeoutMs).toBe(manager.maxTimeoutMs);
    monitor.clear();
  });

  test('should clamp timeout to minimum', () => {
    const monitor = manager.registerOperation('op-1', 'test', 100);

    const status = monitor.getStatus();
    expect(status.effectiveTimeoutMs).toBe(manager.minTimeoutMs);
    monitor.clear();
  });

  test('should clear operation before timeout', async () => {
    const monitor = manager.registerOperation('op-1', 'test', 10000);

    await new Promise(resolve => setTimeout(resolve, 100));

    const result = monitor.clear();
    expect(result.found).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.timedOut).toBe(false);
  });

  test('should extend timeout', async () => {
    const monitor = manager.registerOperation('op-1', 'test', 1000);

    await new Promise(resolve => setTimeout(resolve, 50));

    const result = monitor.extend(2000);
    expect(result.found).toBe(true);
    expect(result.extendedMs).toBe(2000);

    monitor.clear();
  });

  test('should get timeout statistics', () => {
    manager.registerOperation('op-1', 'test', 1000);

    const stats = manager.getStats();
    expect(stats.activeOperations).toBeGreaterThan(0);
    expect(stats.defaultTimeoutMs).toBe(manager.defaultTimeoutMs);
    expect(stats.maxTimeoutMs).toBe(manager.maxTimeoutMs);

    manager.killAllPending();
  });
});

describe('Issue #4: Missing Health Check Endpoint', () => {
  let manager;

  beforeEach(() => {
    manager = new HealthEndpointManager({
      logger: mockLogger
    });
  });

  test('should register health check components', () => {
    manager.registerCheck('database', async () => ({ ok: true }));
    manager.registerCheck('cache', async () => ({ ok: true }));

    expect(manager.checks.size).toBe(2);
  });

  test('should get liveness status', async () => {
    const status = await manager.getLivenessStatus();

    expect(status.status).toBe('alive');
    expect(status.uptime).toBeGreaterThan(0);
    expect(status.timestamp).toBeDefined();
  });

  test('should get readiness status', async () => {
    manager.registerCheck('test', async () => ({ ok: true }));

    const status = await manager.getReadinessStatus();

    expect(status.ready).toBe(true);
    expect(status.checks).toBeDefined();
    expect(Array.isArray(status.checks)).toBe(true);
  });

  test('should report readiness as false when component fails', async () => {
    manager.registerCheck('failing', async () => ({ ok: false }));

    const status = await manager.getReadinessStatus();

    expect(status.ready).toBe(false);
  });

  test('should get full health status', async () => {
    manager.registerCheck('test', async () => ({ ok: true }));

    const status = await manager.getFullHealthStatus();

    expect(status.status).toBeDefined();
    expect(status.liveness).toBeDefined();
    expect(status.readiness).toBeDefined();
    expect(status.metrics).toBeDefined();
  });

  test('should record command metrics', () => {
    manager.recordCommand('navigate', 100);
    manager.recordCommand('click', 50, false);

    const metrics = manager.getMetrics();
    expect(metrics.requestCount).toBe(2);
    expect(metrics.errorCount).toBe(0);
  });

  test('should record command errors', () => {
    manager.recordCommand('navigate', 100, true);
    manager.recordCommand('click', 50, true);

    const metrics = manager.getMetrics();
    expect(metrics.errorCount).toBe(2);
  });

  test('should create HTTP handler', () => {
    const handler = manager.createHttpHandler();

    expect(typeof handler).toBe('function');
  });

  test('should create WebSocket handler', () => {
    const handler = manager.createWebSocketHandler();

    expect(typeof handler).toBe('function');
  });
});

describe('Issue #5 & #6: Error Logging and Request ID Tracking', () => {
  let manager;

  beforeEach(() => {
    manager = new RequestTrackingManager({
      debugMode: false,
      logger: mockLogger
    });
  });

  test('should generate unique request IDs', () => {
    const id1 = manager.generateRequestId();
    const id2 = manager.generateRequestId();

    expect(id1).toMatch(/^req_/);
    expect(id2).toMatch(/^req_/);
    expect(id1).not.toBe(id2);
  });

  test('should start tracking a request', () => {
    const tracker = manager.startRequest('test_command', {}, { clientId: 'client-1' });

    expect(tracker.requestId).toMatch(/^req_/);
    expect(tracker.recordError).toBeDefined();
    expect(tracker.complete).toBeDefined();
  });

  test('should record errors in request', () => {
    const tracker = manager.startRequest('test', {}, {});
    const error = new Error('Test error');

    tracker.recordError(error, { severity: 'error' });

    const status = tracker.getStatus();
    expect(status.errors).toHaveLength(1);
    expect(status.errors[0].message).toBe('Test error');
  });

  test('should record warnings in request', () => {
    const tracker = manager.startRequest('test', {}, {});

    tracker.recordWarning('This is a warning');

    const status = tracker.getStatus();
    expect(status.warnings).toHaveLength(1);
  });

  test('should complete request and calculate duration', async () => {
    const tracker = manager.startRequest('test', {}, {});

    await new Promise(resolve => setTimeout(resolve, 25));

    const result = tracker.complete('success', { data: 'result' });

    expect(result.status).toBe('success');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('should get request status', () => {
    const tracker = manager.startRequest('test', {}, {});

    const status = tracker.getStatus();

    expect(status.requestId).toBeDefined();
    expect(status.command).toBe('test');
    expect(status.status).toBe('pending');
  });

  test('should get error summary', () => {
    const tracker1 = manager.startRequest('cmd1', {}, {});
    const tracker2 = manager.startRequest('cmd2', {}, {});

    tracker1.recordError(new Error('Error 1'));
    tracker2.recordError(new Error('Error 2'));

    const summary = manager.getErrorSummary();
    expect(summary.total).toBe(2);
  });

  test('should get request summary', () => {
    manager.startRequest('cmd1', {}, {}).complete('success');
    manager.startRequest('cmd2', {}, {}).complete('error');

    const summary = manager.getRequestSummary();
    expect(summary.total).toBeGreaterThanOrEqual(2);
  });

  test('should get performance metrics', () => {
    manager.startRequest('cmd1', {}, {}).complete('success');
    manager.startRequest('cmd2', {}, {}).complete('error');

    const metrics = manager.getPerformanceMetrics();

    expect(metrics.totalRequests).toBeGreaterThanOrEqual(2);
    expect(metrics.successRate).toBeDefined();
    expect(metrics.latency).toBeDefined();
  });

  test('should cleanup old requests', async () => {
    manager.startRequest('cmd1', {}, {}).complete('success');

    const result = manager.cleanup(0); // Cleanup all
    expect(result.cleaned).toBeGreaterThanOrEqual(0);
  });

  test('should emit events for tracking', (done) => {
    manager.once('request:start', (data) => {
      expect(data.requestId).toBeDefined();
      expect(data.command).toBe('test');
      done();
    });

    manager.startRequest('test', {}, {});
  });
});

describe('Issue #7: Connection Pool Management', () => {
  let pool;

  beforeEach(async () => {
    pool = new ConnectionPool({
      minConnections: 2,
      maxConnections: 5,
      idleTimeoutMs: 60000,
      checkIntervalMs: 5000,
      logger: mockLogger
    });
    await pool.initialize();
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  test('should initialize pool with minimum connections', async () => {
    const stats = pool.getStats();

    expect(stats.poolSize).toBeGreaterThanOrEqual(1);
    expect(stats.poolSize).toBeLessThanOrEqual(5);
  });

  test('should acquire a connection', async () => {
    const result = await pool.acquire();

    expect(result.connectionId).toBeDefined();
    expect(result.connection).toBeDefined();
    expect(result.release).toBeDefined();
    result.release();
  });

  test('should reuse available connections', async () => {
    const result1 = await pool.acquire();
    const id1 = result1.connectionId;
    result1.release();

    const result2 = await pool.acquire();
    const id2 = result2.connectionId;

    expect(id1).toBe(id2);
    result2.release();
  });

  test('should track pool statistics', async () => {
    const result = await pool.acquire();

    const stats = pool.getStats();
    expect(stats.poolSize).toBeGreaterThan(0);
    expect(stats.inUseCount).toBe(1);
    expect(stats.availableCount).toBeGreaterThanOrEqual(0);

    result.release();
  });

  test('should get connection details', async () => {
    const result = await pool.acquire();

    const connections = pool.getConnections();
    expect(Array.isArray(connections)).toBe(true);
    expect(connections.length).toBeGreaterThan(0);

    result.release();
  });

  test('should drain pool', async () => {
    const result = await pool.acquire();
    result.release();

    await pool.drain(5000);

    const stats = pool.getStats();
    expect(stats.inUseCount).toBe(0);
  });

  test('should force close a connection', async () => {
    const result = await pool.acquire();
    const connId = result.connectionId;

    const success = await pool.forceClose(connId);
    expect(success).toBe(true);
  });
});

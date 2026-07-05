/**
 * Integration Example: How to Use All 7 Issue Fixes
 *
 * This file demonstrates how to integrate all the issue fixes
 * into a WebSocket server implementation.
 *
 * NOT EXECUTABLE - Educational reference only
 */

// ==============================================================================
// 1. IMPORTS
// ==============================================================================

const { MemoryLimiter } = require('./memory-limiter');
const { ListenerCleanupManager } = require('./listener-cleanup');
const { TimeoutManager } = require('./timeout-manager');
const { HealthEndpointManager } = require('./health-endpoint');
const { RequestTrackingManager } = require('./request-tracking');
const { ConnectionPool } = require('./pool-manager');

// ==============================================================================
// 2. INITIALIZATION IN SERVER CONSTRUCTOR
// ==============================================================================

class WebSocketServer {
  constructor(port, mainWindow, options = {}) {
    // ... existing code ...

    // Initialize Issue Fixes
    this.initializeIssueFixes();
  }

  initializeIssueFixes() {
    // Issue #1: Memory Limiter
    this.memoryLimiter = new MemoryLimiter({
      maxMemoryPerOperation: options.maxMemoryPerOperation || 512 * 1024 * 1024,
      checkIntervalMs: 1000,
      memoryThresholdPercent: 0.85,
      killThresholdPercent: 0.95,
      logger: this.logger
    });

    // Issue #2: Listener Cleanup
    this.listenerCleanup = new ListenerCleanupManager({
      maxListenersPerTarget: 10,
      leakThreshold: 1000,
      checkIntervalMs: 10000,
      logger: this.logger
    });

    // Issue #3: Timeout Manager
    this.timeoutManager = new TimeoutManager({
      defaultTimeoutMs: options.defaultTimeoutMs || 60000,
      maxTimeoutMs: options.maxTimeoutMs || 300000,
      minTimeoutMs: 1000,
      logger: this.logger
    });

    // Issue #4: Health Endpoint
    this.healthEndpoint = new HealthEndpointManager({
      maxSamples: 1000,
      logger: this.logger
    });

    // Register health checks
    this.healthEndpoint.registerCheck('browser', async () => {
      return { ok: this.mainWindow && !this.mainWindow.isDestroyed() };
    });

    this.healthEndpoint.registerCheck('websocket', async () => {
      return { ok: this.wss && this.clients.size > 0 };
    });

    // Issue #5 & #6: Request Tracking
    this.requestTracking = new RequestTrackingManager({
      debugMode: process.env.DEBUG === 'true',
      maxLogSize: options.maxLogSize || 10000,
      logger: this.logger
    });

    // Issue #7: Connection Pool
    this.connectionPool = new ConnectionPool({
      minConnections: options.minConnections || 5,
      maxConnections: options.maxConnections || 100,
      idleTimeoutMs: options.idleTimeoutMs || 300000,
      maxConnectionAgeMs: options.maxConnectionAgeMs || 3600000,
      checkIntervalMs: 60000,
      connectionFactory: async () => {
        // Custom connection factory if needed
        return { created: Date.now(), active: true };
      },
      logger: this.logger
    });

    this.logger.info('[IssueFixes] All modules initialized');
  }

  async startIssueFixes() {
    // Start connection pool
    await this.connectionPool.initialize();

    // Start listener cleanup
    this.listenerCleanup.startPeriodicCleanup();

    // Start health checks
    this.healthEndpoint.registerCheck('memory', async () => {
      const status = this.memoryLimiter.getSystemMemoryStatus();
      const used = parseFloat(status.percentUsed);
      return { ok: used < 80 };
    });

    this.logger.info('[IssueFixes] All modules started');
  }

  async stopIssueFixes() {
    this.listenerCleanup.stopPeriodicCleanup();
    await this.connectionPool.shutdown();
    this.logger.info('[IssueFixes] All modules stopped');
  }
}

// ==============================================================================
// 3. COMMAND HANDLER INTEGRATION
// ==============================================================================

class WebSocketServer {
  async handleCommand(ws, command, data, clientId) {
    // STEP 1: Start request tracking (Issues #5 & #6)
    const tracker = this.requestTracking.startRequest(
      command,
      data,
      {
        clientId,
        source: 'websocket',
        ip: ws._socket.remoteAddress
      }
    );

    const requestId = tracker.requestId;

    // STEP 2: Register memory limiter (Issue #1)
    const memoryMonitor = this.memoryLimiter.registerOperation(
      requestId,
      command
    );

    // STEP 3: Register timeout (Issue #3)
    const timeoutHandle = this.timeoutManager.registerOperation(
      requestId,
      command,
      null, // Use default timeout
      (timeoutInfo) => {
        // Timeout handler
        this.logger.error(
          `Command ${command} (${requestId}) timed out after ${timeoutInfo.timeoutMs}ms`
        );
        ws.send(JSON.stringify({
          requestId,
          command,
          status: 'error',
          error: 'Command timeout exceeded'
        }));
      }
    );

    try {
      // STEP 4: Check memory before execution
      let memStatus = memoryMonitor.checkMemory();
      if (!memStatus.ok) {
        throw new Error(
          `Cannot execute: ${memStatus.reason} (${memStatus.systemMemory}% system memory)`
        );
      }

      // STEP 5: Report operation for listener cleanup (Issue #2)
      const cleanupTracker = this.listenerCleanup.trackTarget(ws, clientId);
      cleanupTracker.reportOperation();

      // STEP 6: Record in health metrics (Issue #4)
      const startTime = Date.now();

      // STEP 7: Execute command with periodic memory checks
      let result;
      try {
        result = await this.executeCommand(command, data, clientId);

        // Check memory during long operations
        memStatus = memoryMonitor.checkMemory();
        if (memStatus.action === 'kill') {
          throw new Error(`Memory limit exceeded during ${command}`);
        }
      } catch (error) {
        // STEP 8: Record error with full context (Issue #5)
        tracker.recordError(error, {
          severity: 'error',
          command,
          clientId,
          dataSize: JSON.stringify(data).length
        });

        // Record in health metrics
        const duration = Date.now() - startTime;
        this.healthEndpoint.recordCommand(command, duration, true);

        throw error;
      }

      // STEP 9: Complete tracking (Issues #5 & #6)
      tracker.complete('success', result);

      // STEP 10: Clear timeout (Issue #3)
      timeoutHandle.clear();

      // STEP 11: Record success metrics (Issue #4)
      const duration = Date.now() - startTime;
      this.healthEndpoint.recordCommand(command, duration, false);

      // STEP 12: Get memory stats (Issue #1)
      const memoryStats = memoryMonitor.complete();
      if (memoryStats.duration > 5000) {
        this.logger.warn(
          `Long command ${command}: ${memoryStats.duration}ms, ${memoryStats.memoryIncrease}`
        );
      }

      // Send result
      ws.send(JSON.stringify({
        requestId,
        command,
        status: 'success',
        data: result,
        metrics: {
          durationMs: duration,
          memoryIncreaseMB: memoryStats.memoryIncrease / (1024 * 1024)
        }
      }));

    } catch (error) {
      // Error already tracked above, but ensure cleanup
      const duration = Date.now() - startTime;

      // Clear timeout
      timeoutHandle.clear();

      // Get final memory stats
      const memoryStats = memoryMonitor.complete();

      // Send error response
      ws.send(JSON.stringify({
        requestId,
        command,
        status: 'error',
        error: error.message,
        errorCode: error.code || 'UNKNOWN_ERROR',
        metrics: {
          durationMs: duration,
          memoryIncreaseMB: memoryStats.memoryIncrease / (1024 * 1024)
        }
      }));

      this.logger.error(
        `Command error ${command} (${requestId}): ${error.message}`
      );
    }
  }
}

// ==============================================================================
// 4. HEALTH ENDPOINT SETUP
// ==============================================================================

function setupHealthEndpoints(server) {
  const { healthEndpoint } = server;

  // Express-style HTTP endpoint
  server.httpServer.get('/health', (req, res) => {
    const handler = healthEndpoint.createHttpHandler();
    handler(req, res);
  });

  server.httpServer.get('/health/metrics', async (req, res) => {
    const metrics = healthEndpoint.getMetrics();
    res.json(metrics);
  });

  // WebSocket command
  server.registerCommand('get_health', async () => {
    return await healthEndpoint.getFullHealthStatus();
  });

  server.registerCommand('get_health_metrics', async () => {
    return healthEndpoint.getMetrics();
  });

  server.registerCommand('get_request_tracking', async () => {
    return {
      summary: server.requestTracking.getRequestSummary({ limit: 50 }),
      errors: server.requestTracking.getErrorSummary({ limit: 50 }),
      performance: server.requestTracking.getPerformanceMetrics()
    };
  });

  server.registerCommand('get_pool_status', async () => {
    return server.connectionPool.getStats();
  });
}

// ==============================================================================
// 5. MONITORING & LOGGING
// ==============================================================================

function setupMonitoring(server) {
  const { logger } = server;

  // Periodic health check
  setInterval(() => {
    const poolStats = server.connectionPool.getStats();
    const memoryStatus = server.memoryLimiter.getSystemMemoryStatus();
    const timeoutStats = server.timeoutManager.getStats();

    logger.info('[Monitoring] Pool: ' + JSON.stringify(poolStats));
    logger.info('[Monitoring] Memory: ' + JSON.stringify(memoryStatus));
    logger.info('[Monitoring] Timeouts: active=' + timeoutStats.activeOperations);
  }, 60000); // Every minute

  // Log errors
  server.requestTracking.on('error:recorded', (data) => {
    logger.error(`[Error] ${data.command} (${data.requestId}): ${data.error.message}`);
  });

  // Log slow operations
  setInterval(() => {
    const recent = server.requestTracking.getRecentHistory(100);
    const slow = recent.filter(r => r.duration > 10000);
    if (slow.length > 0) {
      logger.warn(`[Monitoring] ${slow.length} slow operations in last batch`);
    }
  }, 30000);
}

// ==============================================================================
// 6. GRACEFUL SHUTDOWN
// ==============================================================================

async function gracefulShutdown(server) {
  logger.info('Starting graceful shutdown...');

  try {
    // Stop accepting new connections
    server.wss.close();

    // Drain remaining operations
    await server.timeoutManager.killAllPending();

    // Close all connections
    for (const client of server.clients) {
      client.close(1000, 'Server shutting down');
    }

    // Shutdown issue fixes
    await server.stopIssueFixes();

    // Export final logs
    const logs = server.requestTracking.exportLogs();
    logger.info('Final metrics: ' + JSON.stringify(logs.metrics));

    logger.info('Graceful shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown: ' + error.message);
  }
}

// ==============================================================================
// 7. USAGE EXAMPLE
// ==============================================================================

/*
// In your main.js or server startup:

const server = new WebSocketServer(8765, mainWindow, {
  maxMemoryPerOperation: 512 * 1024 * 1024,
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 300000,
  minConnections: 5,
  maxConnections: 100
});

// Initialize
await server.startIssueFixes();

// Setup endpoints
setupHealthEndpoints(server);
setupMonitoring(server);

// Handle shutdown
process.on('SIGTERM', () => gracefulShutdown(server));
process.on('SIGINT', () => gracefulShutdown(server));
*/

// ==============================================================================
// 8. CLIENT USAGE EXAMPLES
// ==============================================================================

/*
// Client: Check server health
async function checkServerHealth(ws) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({
      command: 'get_health'
    }));

    ws.once('message', (msg) => {
      const data = JSON.parse(msg);
      resolve(data);
    });
  });
}

const health = await checkServerHealth(ws);
console.log(health);
// {
//   status: 'healthy',
//   liveness: { status: 'alive', uptime: 3600000 },
//   readiness: { ready: true, checks: [...] },
//   metrics: { ... }
// }

// Client: Get request tracking info
async function getRequestTracking(ws) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({
      command: 'get_request_tracking'
    }));

    ws.once('message', (msg) => {
      resolve(JSON.parse(msg));
    });
  });
}

const tracking = await getRequestTracking(ws);
console.log(`Total requests: ${tracking.summary.total}`);
console.log(`Error rate: ${tracking.performance.errorRate}`);
console.log(`Avg latency: ${tracking.performance.latency.average}ms`);

// Client: Get connection pool status
async function getPoolStatus(ws) {
  return new Promise((resolve) => {
    ws.send(JSON.stringify({
      command: 'get_pool_status'
    }));

    ws.once('message', (msg) => {
      resolve(JSON.parse(msg));
    });
  });
}

const pool = await getPoolStatus(ws);
console.log(`Pool utilization: ${pool.poolSize} / ${pool.maxConnections}`);
*/

module.exports = {
  // This file is for reference only - do not export anything
};

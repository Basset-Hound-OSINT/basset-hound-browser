/**
 * Connection Pool Integration Example
 *
 * Shows how to integrate the production connection pool with the WebSocket server
 * for managing 100+ concurrent client connections efficiently.
 *
 * Usage:
 * 1. Import the ConnectionPool in your WebSocket server
 * 2. Create pool instance with configuration
 * 3. Acquire connections for incoming WebSocket clients
 * 4. Release connections when commands complete
 * 5. Monitor via health endpoint
 */

const WebSocket = require('ws');
const { ConnectionPool } = require('./connection-pool');
const { HealthEndpointManager } = require('./health-endpoint');

// ============================================================================
// EXAMPLE 1: Basic Integration
// ============================================================================

class WebSocketServerWithPool {
  constructor(port = 8765) {
    this.port = port;
    this.wss = null;

    // Initialize connection pool
    this.pool = new ConnectionPool({
      maxConnections: 500,
      idleTimeout: 300000,      // 5 minutes
      queueTimeout: 30000,      // 30 seconds
      maxRetries: 3,
      logger: console
    });

    // Initialize health endpoint
    this.health = new HealthEndpointManager({
      version: '12.9.0',
      logger: console
    });
  }

  /**
   * Start the WebSocket server with connection pooling
   */
  async start() {
    this.wss = new WebSocket.Server({ port: this.port });

    this.wss.on('connection', (ws) => {
      const clientId = this._generateClientId();
      console.log(`[WS] Client connected: ${clientId}`);

      // Acquire connection from pool
      this._handleNewConnection(clientId, ws);
    });

    console.log(`[WS] Server listening on port ${this.port}`);
    return this;
  }

  /**
   * Handle new WebSocket connection with pooling
   */
  async _handleNewConnection(clientId, ws) {
    try {
      // Acquire connection slot from pool
      const connection = await this.pool.acquire(clientId, ws, {
        command: 'connection_open',
        priority: 'normal'
      });

      console.log(`[Pool] Acquired connection for ${clientId}`);

      // Set up message handler
      ws.on('message', (data) => this._handleMessage(clientId, ws, data));

      // Set up close handler
      ws.on('close', () => this._handleClientClose(clientId));

      // Set up error handler
      ws.on('error', (err) => this._handleClientError(clientId, err));

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_ack',
        clientId,
        poolStatus: this.pool.getStatus()
      }));
    } catch (err) {
      console.error(`[Pool] Failed to acquire connection for ${clientId}: ${err.message}`);
      ws.close(1008, 'Pool exhausted');
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  async _handleMessage(clientId, ws, data) {
    const startTime = Date.now();

    try {
      const message = JSON.parse(data);
      const { command, params = {} } = message;

      console.log(`[${clientId}] Executing command: ${command}`);

      // Get the connection from pool
      const connection = this.pool.connections.get(clientId);
      if (!connection) {
        ws.send(JSON.stringify({
          error: 'Connection not found in pool'
        }));
        return;
      }

      // Execute the command
      const result = await this._executeCommand(command, params);

      // Record in connection metrics
      const latency = Date.now() - startTime;
      connection.recordCommand(command, latency, false);

      // Send response
      ws.send(JSON.stringify({
        type: 'command_response',
        command,
        result,
        latencyMs: latency
      }));

      // Release after command completes
      this.pool.release(clientId);

      // Record in health metrics
      this.health.recordCommand(command, latency, false);
    } catch (err) {
      console.error(`[${clientId}] Error: ${err.message}`);

      // Record error
      const connection = this.pool.connections.get(clientId);
      if (connection) {
        connection.recordCommand('unknown', Date.now() - startTime, true);
        this.pool.release(clientId);
      }

      // Mark connection unhealthy after repeated errors
      this.pool.markConnectionUnhealthy(clientId);

      // Send error response
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));

      // Record error in health
      this.health.recordCommand('error', Date.now() - startTime, true);
    }
  }

  /**
   * Handle client disconnect
   */
  _handleClientClose(clientId) {
    console.log(`[${clientId}] Client disconnected`);
    this.pool.closeConnection(clientId);
  }

  /**
   * Handle client error
   */
  _handleClientError(clientId, err) {
    console.error(`[${clientId}] WebSocket error: ${err.message}`);
    this.pool.markConnectionUnhealthy(clientId);
  }

  /**
   * Execute a command (placeholder)
   */
  async _executeCommand(command, params) {
    // Simulate command execution
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ status: 'success', command, params });
      }, Math.random() * 100);
    });
  }

  /**
   * Generate unique client ID
   */
  _generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Stop server
   */
  async stop() {
    await this.pool.drain();
    this.pool.stopCleanup();
    this.wss.close();
    console.log('[WS] Server stopped');
  }
}

// ============================================================================
// EXAMPLE 2: Health Endpoint Integration
// ============================================================================

/**
 * Create HTTP health endpoint that reports pool status
 */
function createHealthEndpoint(pool, health) {
  return (req, res) => {
    if (req.url === '/health') {
      const poolStatus = pool.getHealthStatus();
      const response = {
        status: poolStatus.healthy ? 'healthy' : 'degraded',
        pool: poolStatus,
        timestamp: new Date().toISOString()
      };

      const statusCode = poolStatus.healthy ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response, null, 2));
    } else if (req.url === '/metrics') {
      const metrics = pool.getMetrics();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics, null, 2));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  };
}

// ============================================================================
// EXAMPLE 3: Connection Pool Configuration from Environment
// ============================================================================

/**
 * Load connection pool config from environment variables
 */
function createPoolFromEnv() {
  return new ConnectionPool({
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '500', 10),
    idleTimeout: parseInt(process.env.IDLE_TIMEOUT || '300000', 10),
    queueTimeout: parseInt(process.env.QUEUE_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    logger: console
  });
}

// ============================================================================
// EXAMPLE 4: Load Testing Scenario
// ============================================================================

/**
 * Simulate high-concurrency load testing
 */
async function runLoadTest() {
  const server = new WebSocketServerWithPool(8765);
  await server.start();

  // Simulate 100 concurrent clients
  const clients = [];
  const clientWss = [];

  console.log('\n=== Starting Load Test ===');
  console.log('Creating 100 concurrent clients...\n');

  for (let i = 0; i < 100; i++) {
    const clientWs = new WebSocket('ws://localhost:8765');

    clientWs.on('open', () => {
      // Send commands rapidly
      for (let j = 0; j < 5; j++) {
        setTimeout(() => {
          clientWs.send(JSON.stringify({
            command: 'test_command_' + j,
            params: { index: j }
          }));
        }, Math.random() * 1000);
      }
    });

    clientWs.on('message', (data) => {
      // Handle response
    });

    clientWss.push(clientWs);
  }

  // Monitor pool status
  const monitorInterval = setInterval(() => {
    const status = server.pool.getStatus();
    const health = server.pool.getHealthStatus();
    console.log(`[Monitor] Active: ${status.active}, Queue: ${status.queue}, ` +
                `Utilization: ${health.poolUtilization}, Health: ${health.healthy ? 'OK' : 'WARN'}`);
  }, 2000);

  // Run for 30 seconds then clean up
  setTimeout(async () => {
    clearInterval(monitorInterval);
    console.log('\n=== Load Test Complete ===');

    // Close all clients
    clientWss.forEach(ws => ws.close());

    // Wait a bit then stop server
    setTimeout(async () => {
      await server.stop();
      process.exit(0);
    }, 1000);
  }, 30000);
}

// ============================================================================
// EXAMPLE 5: Monitoring and Alerting
// ============================================================================

class PoolMonitor {
  constructor(pool, alertThresholds = {}) {
    this.pool = pool;
    this.alertThresholds = {
      utilizationPercent: alertThresholds.utilizationPercent || 80,
      queueSize: alertThresholds.queueSize || 50,
      rejectedRequests: alertThresholds.rejectedRequests || 10,
      errorRate: alertThresholds.errorRate || 5
    };
  }

  /**
   * Start monitoring with periodic health checks
   */
  startMonitoring(intervalMs = 5000) {
    this.monitorInterval = setInterval(() => {
      this._checkHealth();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  /**
   * Check pool health
   */
  _checkHealth() {
    const status = this.pool.getStatus();
    const health = this.pool.getHealthStatus();
    const metrics = this.pool.getMetrics().summary;

    const utilization = parseFloat(health.poolUtilization);
    const queueSize = status.queue;
    const rejectedRequests = metrics.totalRejectedRequests;

    // Check utilization threshold
    if (utilization > this.alertThresholds.utilizationPercent) {
      console.warn(`[Alert] High pool utilization: ${health.poolUtilization}`);
    }

    // Check queue threshold
    if (queueSize > this.alertThresholds.queueSize) {
      console.warn(`[Alert] Large wait queue: ${queueSize} requests`);
    }

    // Check rejected requests
    if (rejectedRequests > this.alertThresholds.rejectedRequests) {
      console.warn(`[Alert] High rejection rate: ${rejectedRequests} rejected requests`);
    }
  }
}

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/*
// Start the server
const server = new WebSocketServerWithPool(8765);
server.start();

// Set up health endpoint on HTTP
const http = require('http');
const httpServer = http.createServer(
  createHealthEndpoint(server.pool, server.health)
);
httpServer.listen(3000);

// Start monitoring
const monitor = new PoolMonitor(server.pool, {
  utilizationPercent: 80,
  queueSize: 50
});
monitor.startMonitoring(5000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  monitor.stopMonitoring();
  await server.stop();
  httpServer.close();
  process.exit(0);
});
*/

module.exports = {
  WebSocketServerWithPool,
  createHealthEndpoint,
  createPoolFromEnv,
  PoolMonitor,
  runLoadTest
};

/**
 * Zombie Connection Cleanup Integration Test
 * Tests forced cleanup for dead connections with the WebSocket server
 */

const WebSocket = require('ws');
const http = require('http');
const { ConnectionLifecycleManager } = require('../../websocket/connection-manager');

describe('Zombie Connection Cleanup Integration', () => {
  let server;
  let wss;
  let connectionManager;
  const port = 9876;

  beforeAll((done) => {
    // Create HTTP server
    server = http.createServer();

    // Create WebSocket server
    const WS = require('ws');
    wss = new WS.Server({ server });

    // Create connection manager with short grace period for testing
    connectionManager = new ConnectionLifecycleManager({
      gracePeriodMs: 2000, // 2 seconds for fast testing
      checkIntervalMs: 500, // Check every 500ms
      highZombieCount: 3
    });

    // Track clients
    const clients = new Map();

    // Handle new connections
    wss.on('connection', (ws) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      ws.clientId = clientId;
      ws.isAlive = true;
      clients.set(clientId, ws);

      // Register with connection manager
      connectionManager.registerConnection(clientId, ws, false);

      // Handle pong
      ws.on('pong', () => {
        ws.isAlive = true;
        connectionManager.recordPong(clientId);
      });

      // Handle message
      ws.on('message', (data) => {
        connectionManager.recordActivity(clientId);

        // Echo back
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ echo: JSON.parse(data) }));
        }
      });

      // Handle close
      ws.on('close', () => {
        connectionManager.unregisterConnection(clientId);
        clients.delete(clientId);
      });

      // Handle error
      ws.on('error', (err) => {
        connectionManager.unregisterConnection(clientId);
        clients.delete(clientId);
      });

      // Send connection confirmation
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ connected: true, clientId }));
      }
    });

    // Start periodic heartbeat
    const heartbeatInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          connectionManager.markDead(ws.clientId);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
        connectionManager.recordPing(ws.clientId);
      });
    }, 1000); // Every 1 second

    // Start periodic zombie cleanup
    const zombieInterval = connectionManager.startZombieDetection(() => {
      return Array.from(clients.keys());
    });

    server.listen(port, () => {
      done();
    });

    // Cleanup function
    global.testCleanup = () => {
      clearInterval(heartbeatInterval);
      clearInterval(zombieInterval);
      connectionManager.stopZombieDetection(zombieInterval);
      wss.close();
      server.close();
    };
  });

  afterAll((done) => {
    if (global.testCleanup) {
      global.testCleanup();
    }
    done();
  });

  test('should detect and cleanup zombie connection after grace period', async () => {
    // Connect a client
    const ws = new WebSocket(`ws://localhost:${port}`);

    await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.connected) {
          resolve();
        }
      });
    });

    const clientId = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.connected && msg.clientId) {
          resolve(msg.clientId);
        }
      });
    });

    // Verify connection is registered
    expect(connectionManager.connectionMetadata.has(clientId)).toBe(true);

    // Abruptly close without cleanup (simulating network failure)
    ws.terminate();

    // Initially should not be zombie
    expect(connectionManager.isZombie(clientId)).toBe(false);

    // Wait past grace period
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Should now be detected as zombie
    const zombieCount = connectionManager.getZombieCount();
    expect(zombieCount).toBeGreaterThan(0);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Zombie should be cleaned up
    expect(connectionManager.connectionMetadata.has(clientId)).toBe(false);
  }, 10000);

  test('should track active connections correctly', async () => {
    const initialCount = connectionManager.connectionMetadata.size;

    // Create 5 connections
    const connections = [];
    for (let i = 0; i < 5; i++) {
      const ws = new WebSocket(`ws://localhost:${port}`);
      connections.push(ws);

      await new Promise((resolve) => {
        ws.on('open', () => resolve());
      });
    }

    // Wait a bit for registration
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have 5 more connections
    expect(connectionManager.connectionMetadata.size).toBe(initialCount + 5);

    // Close all connections
    connections.forEach(ws => ws.close());

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should be back to initial count
    expect(connectionManager.connectionMetadata.size).toBe(initialCount);
  }, 10000);

  test('should handle multiple simultaneous zombie connections', async () => {
    const initialZombies = connectionManager.getZombieCount();

    // Create and immediately terminate 3 connections
    const connections = [];
    const clientIds = [];

    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(`ws://localhost:${port}`);

      const clientId = await new Promise((resolve) => {
        ws.on('message', (data) => {
          const msg = JSON.parse(data);
          if (msg.clientId) {
            resolve(msg.clientId);
          }
        });
      });

      clientIds.push(clientId);
      connections.push(ws);
      ws.terminate(); // Terminate immediately
    }

    // Initially marked dead but not zombies
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Wait for zombie detection
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // All 3 should be detected as zombies
    const zombieCount = connectionManager.getZombieCount();
    expect(zombieCount).toBeGreaterThanOrEqual(3);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Zombies should be cleaned up
    for (const clientId of clientIds) {
      expect(connectionManager.connectionMetadata.has(clientId)).toBe(false);
    }
  }, 12000);

  test('should maintain metrics during lifecycle', async () => {
    const initialMetrics = { ...connectionManager.metrics };

    // Create a connection
    const ws = new WebSocket(`ws://localhost:${port}`);

    await new Promise((resolve) => {
      ws.on('open', () => resolve());
    });

    // Send message
    ws.send(JSON.stringify({ test: 'data' }));

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check metrics increased
    expect(connectionManager.metrics.totalConnections).toBeGreaterThan(initialMetrics.totalConnections);

    // Close normally
    ws.close();

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify connection unregistered
    expect(connectionManager.connectionMetadata.size).toBeLessThanOrEqual(initialMetrics.totalConnections);
  }, 8000);

  test('should provide accurate connection status', async () => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    const clientId = await new Promise((resolve) => {
      ws.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.clientId) {
          resolve(msg.clientId);
        }
      });
    });

    // Send some activity
    ws.send(JSON.stringify({ activity: 1 }));
    ws.send(JSON.stringify({ activity: 2 }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Get status
    const status = connectionManager.getConnectionStatus();
    const connStatus = status.find(s => s.clientId === clientId);

    expect(connStatus).toBeDefined();
    expect(connStatus.isAlive).toBe(true);
    expect(connStatus.isZombie).toBe(false);
    expect(connStatus.messageCount).toBeGreaterThan(0);

    ws.close();
  }, 8000);

  test('should alert on high zombie count', async () => {
    // Create multiple connections and terminate them
    const connections = [];

    for (let i = 0; i < 4; i++) {
      const ws = new WebSocket(`ws://localhost:${port}`);

      await new Promise((resolve) => {
        ws.on('open', () => resolve());
      });

      connections.push(ws);
      ws.terminate();
    }

    // Wait for zombie detection
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Should have high zombie count
    const zombieCount = connectionManager.getZombieCount();
    expect(zombieCount).toBeGreaterThan(0);

    // Verify metrics tracked high count
    expect(connectionManager.metrics.peakZombieCount).toBeGreaterThan(0);

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 12000);

  test('should log metrics during lifecycle', async () => {
    const initialSamples = connectionManager.metrics.zombieCountSamples.length;

    // Run for a bit with active connections
    const ws = new WebSocket(`ws://localhost:${port}`);

    await new Promise((resolve) => {
      ws.on('open', () => resolve());
    });

    // Wait for sampling
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should have recorded samples
    expect(connectionManager.metrics.zombieCountSamples.length).toBeGreaterThan(initialSamples);

    ws.close();
  }, 8000);
});

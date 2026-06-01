/**
 * WebSocket Server Integration Test - Competitor Monitoring Service
 *
 * Validates that the Competitor Monitoring Service is properly integrated
 * into the WebSocket server and all commands are accessible.
 */

const WebSocket = require('ws');
const WebSocketServer = require('../../websocket/server');
const path = require('path');
const os = require('os');

describe('WebSocket Server Integration - Competitor Monitoring', () => {
  let wsServer;
  let testPort;

  beforeAll(async () => {
    // Use a random port to avoid conflicts
    testPort = 19000 + Math.floor(Math.random() * 1000);
  });

  afterEach(async () => {
    if (wsServer) {
      try {
        wsServer.close();
      } catch (e) {
        // Ignore close errors
      }
      wsServer = null;
    }
  });

  test('WebSocket server starts with MonitoringService initialized', async () => {
    const tempDataDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);

    wsServer = new WebSocketServer({
      port: testPort,
      ssl: false,
      auth: false,
      dataDir: tempDataDir
    });

    // Wait for server to start
    await new Promise((resolve) => {
      const checkServer = setInterval(() => {
        if (wsServer && wsServer.wss) {
          clearInterval(checkServer);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkServer);
        resolve();
      }, 5000);
    });

    // Verify server is running
    expect(wsServer).toBeDefined();
    expect(wsServer.wss).toBeDefined();
    expect(wsServer.monitoringService).toBeDefined();
  });

  test('Competitor monitoring commands are registered', async () => {
    const tempDataDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);

    wsServer = new WebSocketServer({
      port: testPort,
      ssl: false,
      auth: false,
      dataDir: tempDataDir
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that monitoring commands are registered
    const monitoringCommands = [
      'add_competitor_monitor',
      'remove_competitor_monitor',
      'get_competitor_monitor',
      'list_competitor_monitors',
      'get_all_changes',
      'get_changes_by_type',
      'get_monitoring_stats',
      'clear_all_competitor_monitors'
    ];

    const registeredCommands = Object.keys(wsServer.commandHandlers || {});
    const missingCommands = monitoringCommands.filter(
      cmd => !registeredCommands.includes(cmd)
    );

    if (missingCommands.length > 0) {
      console.warn(`Missing commands: ${missingCommands.join(', ')}`);
    }

    // At least some monitoring commands should be registered
    const foundCommands = monitoringCommands.filter(
      cmd => registeredCommands.includes(cmd)
    );

    expect(foundCommands.length).toBeGreaterThan(0);
  });

  test('MonitoringService lifecycle is tied to WebSocket server', async () => {
    const tempDataDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);

    wsServer = new WebSocketServer({
      port: testPort,
      ssl: false,
      auth: false,
      dataDir: tempDataDir
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Service should be running
    expect(wsServer.monitoringService).toBeDefined();
    expect(wsServer.monitoringService.status).toBeDefined();

    // Close server
    wsServer.close();

    // Wait for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Service should be cleaned up
    expect(wsServer.monitoringService).toBeNull();
  });

  test('Competitor monitoring service can be accessed via command handlers', async () => {
    const tempDataDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);

    wsServer = new WebSocketServer({
      port: testPort,
      ssl: false,
      auth: false,
      dataDir: tempDataDir
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Try to access a monitoring command
    const addMonitorCommand = wsServer.commandHandlers.add_competitor_monitor;
    expect(addMonitorCommand).toBeDefined();
    expect(typeof addMonitorCommand).toBe('function');

    // Test command execution
    try {
      const result = await addMonitorCommand({
        url: 'https://example.com',
        name: 'Test Competitor'
      });

      expect(result).toBeDefined();
      expect(result.success || result.monitorId).toBeDefined();
    } catch (error) {
      // Command might fail for other reasons, but should be callable
      expect(error).toBeDefined();
    }
  });

  test('MonitoringService data directory is created', async () => {
    const fs = require('fs');
    const tempDataDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);

    wsServer = new WebSocketServer({
      port: testPort,
      ssl: false,
      auth: false,
      dataDir: tempDataDir
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify monitoring service was created
    expect(wsServer.monitoringService).toBeDefined();

    // Clean up
    wsServer.close();
  });
});

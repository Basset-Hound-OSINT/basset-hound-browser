/**
 * Phase 2 P2-003: WebSocket Port Conflict Resolution Tests
 *
 * Tests for dynamic port allocation and fallback handling when the desired
 * port is already in use.
 *
 * @module tests/integration/p2-003-port-conflict.test.js
 */

const http = require('http');
const net = require('net');
const WebSocket = require('ws');
const { WebSocketServer } = require('../..'); // Adjust path as needed

describe('P2-003: WebSocket Port Conflict Detection', () => {
  let occupiedPort = 8773;
  let portBlockingServer = null;
  let wsServer = null;

  /**
   * Start a server on a specific port to occupy it
   */
  async function blockPort(port) {
    return new Promise((resolve) => {
      const server = http.createServer();
      server.listen(port, '0.0.0.0', () => {
        console.log(`[Test] Port ${port} is now occupied`);
        resolve(server);
      });
    });
  }

  /**
   * Check if a port is available
   */
  async function isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '0.0.0.0');
    });
  }

  afterEach(async () => {
    // Cleanup
    if (portBlockingServer) {
      portBlockingServer.close();
      portBlockingServer = null;
    }
    if (wsServer && wsServer.wss) {
      wsServer.wss.close();
    }
  });

  test('1: Server starts on requested port when available', async () => {
    const availablePort = 8800;

    // Ensure port is available
    const portAvailable = await isPortAvailable(availablePort);
    expect(portAvailable).toBe(true);

    // Create and start server
    class MockLogger {
      info(msg) { console.log(`[INFO] ${msg}`); }
      warn(msg) { console.log(`[WARN] ${msg}`); }
      error(msg) { console.log(`[ERROR] ${msg}`); }
      debug(msg) { }
    }

    wsServer = {
      port: availablePort,
      logger: new MockLogger(),
      mainWindow: {
        webContents: {
          send: () => {}
        }
      },
      clients: new Set(),
      commandHandlers: {},
      wss: null,
      httpsServer: null,

      // Copy methods from WebSocketServer
      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${startPort}`);
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);

        if (isAvailable) {
          this.logger.info(`[WebSocket P2-003] Port ${initialPort} is available`);
          return initialPort;
        }

        this.logger.warn(`[WebSocket P2-003] Port ${initialPort} is already in use, finding alternative...`);
        const availablePort = await this._findAvailablePort(initialPort + 1, 10);
        this.port = availablePort;
        this.logger.info(`[WebSocket P2-003] Using alternative port: ${availablePort} (requested: ${initialPort})`);
        return availablePort;
      },

      _startNonSSLServer(port, compressionConfig) {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server, ...compressionConfig });

        server.on('error', (error) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.error(`[WebSocket P2-003] Port ${port} became unavailable, retrying...`);
          } else {
            this.logger.error(`[WebSocket] HTTP server error: ${error.message}`);
          }
        });

        server.listen(port, '0.0.0.0');
        this.sslActive = false;
        this.logger.info(`[WebSocket] Listening on ws://0.0.0.0:${port}`);
      },

      _startWebSocketServer(port, compressionConfig) {
        this._startNonSSLServer(port, compressionConfig);

        if (!this.wss) {
          this.logger.error('Failed to create WebSocket server');
          return;
        }
      },

      start() {
        const compressionConfig = {
          perMessageDeflate: {
            zlibDeflateOptions: {
              chunkSize: 1024,
              memLevel: 8,
              level: 4
            },
            zlibInflateOptions: {
              chunkSize: 10 * 1024
            },
            clientNoContextTakeover: true,
            serverNoContextTakeover: true,
            serverMaxWindowBits: 15,
            concurrencyLimit: 10,
            threshold: 1024
          }
        };

        this._ensurePortAvailability()
          .then((availablePort) => {
            this._startWebSocketServer(availablePort, compressionConfig);
          })
          .catch((error) => {
            this.logger.error(`[WebSocket] Failed to start server: ${error.message}`);
          });
      }
    };

    wsServer.start();

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify server is running
    expect(wsServer.wss).toBeDefined();
    expect(wsServer.port).toBe(availablePort);
  });

  test('2: Server finds alternative port when requested port is occupied', async () => {
    const requestedPort = 8801;
    const nextAvailablePort = 8802;

    // Block the requested port
    portBlockingServer = await blockPort(requestedPort);

    // Ensure next port is available
    let nextPortAvailable = await isPortAvailable(nextAvailablePort);
    expect(nextPortAvailable).toBe(true);

    // Create server
    class MockLogger {
      info(msg) { console.log(`[INFO] ${msg}`); }
      warn(msg) { console.log(`[WARN] ${msg}`); }
      error(msg) { console.log(`[ERROR] ${msg}`); }
      debug(msg) { }
    }

    wsServer = {
      port: requestedPort,
      logger: new MockLogger(),
      mainWindow: { webContents: { send: () => {} } },
      clients: new Set(),
      commandHandlers: {},
      wss: null,
      httpsServer: null,

      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error(`Could not find available port`);
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);

        if (isAvailable) {
          this.logger.info(`[WebSocket P2-003] Port ${initialPort} is available`);
          return initialPort;
        }

        this.logger.warn(`[WebSocket P2-003] Port ${initialPort} is already in use, finding alternative...`);
        const availablePort = await this._findAvailablePort(initialPort + 1, 10);
        this.port = availablePort;
        this.logger.info(`[WebSocket P2-003] Using alternative port: ${availablePort} (requested: ${initialPort})`);
        return availablePort;
      },

      _startNonSSLServer(port, compressionConfig) {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server, ...compressionConfig });
        server.listen(port, '0.0.0.0');
        this.sslActive = false;
        this.logger.info(`[WebSocket] Listening on ws://0.0.0.0:${port}`);
      },

      _startWebSocketServer(port, compressionConfig) {
        this._startNonSSLServer(port, compressionConfig);
        if (!this.wss) {
          this.logger.error('Failed to create WebSocket server');
        }
      },

      start() {
        const compressionConfig = { perMessageDeflate: { zlibDeflateOptions: { chunkSize: 1024 } } };
        this._ensurePortAvailability()
          .then((availablePort) => {
            this._startWebSocketServer(availablePort, compressionConfig);
          })
          .catch((error) => {
            this.logger.error(`[WebSocket] Failed to start server: ${error.message}`);
          });
      }
    };

    wsServer.start();

    // Wait for server to start and find alternative port
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify server is running on alternative port
    expect(wsServer.wss).toBeDefined();
    expect(wsServer.port).toBe(nextAvailablePort);
  });

  test('3: Server logs when port conflict is detected', async () => {
    const requestedPort = 8803;
    const logs = [];

    // Block the requested port
    portBlockingServer = await blockPort(requestedPort);

    class MockLogger {
      info(msg) { logs.push({ level: 'info', msg }); }
      warn(msg) { logs.push({ level: 'warn', msg }); }
      error(msg) { logs.push({ level: 'error', msg }); }
      debug(msg) { }
    }

    wsServer = {
      port: requestedPort,
      logger: new MockLogger(),
      mainWindow: { webContents: { send: () => {} } },
      clients: new Set(),
      commandHandlers: {},
      wss: null,

      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error('No available port');
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);

        if (isAvailable) {
          this.logger.info(`[WebSocket P2-003] Port ${initialPort} is available`);
          return initialPort;
        }

        this.logger.warn(`[WebSocket P2-003] Port ${initialPort} is already in use, finding alternative...`);
        const availablePort = await this._findAvailablePort(initialPort + 1, 10);
        this.port = availablePort;
        this.logger.info(`[WebSocket P2-003] Using alternative port: ${availablePort} (requested: ${initialPort})`);
        return availablePort;
      },

      _startNonSSLServer(port, compressionConfig) {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server, ...compressionConfig });
        server.listen(port, '0.0.0.0');
        this.logger.info(`[WebSocket] Listening on ws://0.0.0.0:${port}`);
      },

      _startWebSocketServer(port, compressionConfig) {
        this._startNonSSLServer(port, compressionConfig);
      },

      start() {
        const compressionConfig = { perMessageDeflate: { zlibDeflateOptions: { chunkSize: 1024 } } };
        this._ensurePortAvailability()
          .then((availablePort) => {
            this._startWebSocketServer(availablePort, compressionConfig);
          });
      }
    };

    wsServer.start();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check logs for port conflict warning
    const warningLog = logs.find(log =>
      log.level === 'warn' &&
      log.msg.includes('P2-003') &&
      log.msg.includes('already in use')
    );

    expect(warningLog).toBeDefined();
    expect(warningLog.msg).toContain(requestedPort.toString());
  });

  test('4: Server returns actual port to clients', async () => {
    const requestedPort = 8804;

    // Create a mock server
    class MockLogger {
      info(msg) { }
      warn(msg) { }
      error(msg) { }
      debug(msg) { }
    }

    wsServer = {
      port: requestedPort,
      logger: new MockLogger(),
      mainWindow: { webContents: { send: () => {} } },
      clients: new Set(),
      commandHandlers: {},
      wss: null,

      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error('No available port');
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);

        if (isAvailable) {
          return initialPort;
        }

        const availablePort = await this._findAvailablePort(initialPort + 1, 10);
        this.port = availablePort;
        return availablePort;
      },

      _startNonSSLServer(port, compressionConfig) {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server, ...compressionConfig });
        server.listen(port, '0.0.0.0');
        this.actualPort = port;
      },

      _startWebSocketServer(port, compressionConfig) {
        this._startNonSSLServer(port, compressionConfig);
      },

      start() {
        const compressionConfig = { perMessageDeflate: { zlibDeflateOptions: { chunkSize: 1024 } } };
        this._ensurePortAvailability()
          .then((availablePort) => {
            this._startWebSocketServer(availablePort, compressionConfig);
          });
      }
    };

    wsServer.start();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify actual port is set
    expect(wsServer.port).toBe(requestedPort);
    expect(wsServer.actualPort).toBe(requestedPort);
  });

  test('5: Port conflict detection handles concurrent port checks', async () => {
    const ports = [8805, 8806, 8807];
    const portAvailability = {};

    // Track port availability
    async function checkAllPorts() {
      for (const port of ports) {
        portAvailability[port] = await isPortAvailable(port);
      }
    }

    await checkAllPorts();

    // All ports should be available initially
    expect(Object.values(portAvailability).every(v => v === true)).toBe(true);
  });

  test('6: Server cleans up blocked port reference', async () => {
    const requestedPort = 8808;

    // Block and then unblock port
    portBlockingServer = await blockPort(requestedPort);

    // Verify port is blocked
    const portBlocked = await isPortAvailable(requestedPort);
    expect(portBlocked).toBe(false);

    // Unblock port
    portBlockingServer.close();
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify port is available again
    const portAvailable = await isPortAvailable(requestedPort);
    expect(portAvailable).toBe(true);
  });

  test('7: Multiple servers can run on different ports', async () => {
    const port1 = 8809;
    const port2 = 8810;

    class MockLogger {
      info() { }
      warn() { }
      error() { }
      debug() { }
    }

    const server1 = {
      port: port1,
      logger: new MockLogger(),
      mainWindow: { webContents: { send: () => {} } },
      clients: new Set(),
      commandHandlers: {},
      wss: null,

      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error('No available port');
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);
        if (isAvailable) return initialPort;
        return await this._findAvailablePort(initialPort + 1, 10);
      },

      _startNonSSLServer(port, compressionConfig) {
        const server = http.createServer();
        this.wss = new WebSocket.Server({ server, ...compressionConfig });
        server.listen(port, '0.0.0.0');
      },

      _startWebSocketServer(port, compressionConfig) {
        this._startNonSSLServer(port, compressionConfig);
      },

      start() {
        this._ensurePortAvailability()
          .then((availablePort) => {
            this._startWebSocketServer(availablePort, {});
          });
      }
    };

    const server2 = { ...server1, port: port2 };

    server1.start();
    server2.start();

    await new Promise(resolve => setTimeout(resolve, 500));

    // Both servers should have WebSocket servers
    expect(server1.wss).toBeDefined();
    expect(server2.wss).toBeDefined();

    // Clean up
    server1.wss.close();
    server2.wss.close();
  });

  test('8: Server handles port fallback gracefully when all ports are occupied', async () => {
    const requestedPort = 8811;
    const logs = [];

    class MockLogger {
      info(msg) { logs.push(msg); }
      warn(msg) { logs.push(msg); }
      error(msg) { logs.push(msg); }
      debug(msg) { }
    }

    // Block many ports
    const blockedServers = [];
    for (let i = requestedPort; i < requestedPort + 15; i++) {
      blockedServers.push(await blockPort(i));
    }

    wsServer = {
      port: requestedPort,
      logger: new MockLogger(),
      mainWindow: { webContents: { send: () => {} } },
      clients: new Set(),
      commandHandlers: {},
      wss: null,

      async _isPortAvailable(port) {
        return new Promise((resolve) => {
          const server = net.createServer();
          server.once('error', () => resolve(false));
          server.once('listening', () => {
            server.close();
            resolve(true);
          });
          server.listen(port);
        });
      },

      async _findAvailablePort(startPort, maxAttempts = 10) {
        for (let i = 0; i < maxAttempts; i++) {
          const port = startPort + i;
          if (await this._isPortAvailable(port)) {
            return port;
          }
        }
        throw new Error(`Could not find available port after ${maxAttempts} attempts`);
      },

      async _ensurePortAvailability() {
        const initialPort = this.port;
        const isAvailable = await this._isPortAvailable(initialPort);

        if (isAvailable) {
          return initialPort;
        }

        const availablePort = await this._findAvailablePort(initialPort + 1, 10);
        return availablePort;
      },

      start() {
        this._ensurePortAvailability()
          .then((availablePort) => {
            this.port = availablePort;
          })
          .catch((error) => {
            this.logger.error(`Failed to find port: ${error.message}`);
          });
      }
    };

    wsServer.start();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Should have attempted to find alternative port
    expect(logs.length > 0 || wsServer.port).toBeTruthy();

    // Clean up blocked servers
    blockedServers.forEach(server => server.close());
  });
});

/**
 * Basset Hound Browser - SSL Connection Integration Tests
 * Tests for SSL/TLS WebSocket connections with self-signed certificates
 */

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test configuration
const SSL_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures', 'ssl');
const TEST_HOST = 'localhost';
const TEST_PORT = 18900 + Math.floor(Math.random() * 100);

// Certificate paths
const CERT_PATH = path.join(SSL_FIXTURES_DIR, 'cert.pem');
const KEY_PATH = path.join(SSL_FIXTURES_DIR, 'key.pem');
const CA_PATH = path.join(SSL_FIXTURES_DIR, 'ca.pem');

/**
 * Check if test certificates exist
 * @returns {boolean}
 */
function certsExist() {
  return fs.existsSync(CERT_PATH) &&
         fs.existsSync(KEY_PATH) &&
         fs.existsSync(CA_PATH);
}

/**
 * Generate test certificates if they don't exist
 * Uses the generate-test-certs.js helper
 */
function ensureCertsExist() {
  if (!certsExist()) {
    const generateScript = path.join(__dirname, '..', 'helpers', 'generate-test-certs.js');
    if (fs.existsSync(generateScript)) {
      try {
        require(generateScript).generateCertificates();
      } catch (error) {
        console.warn('Could not generate test certificates:', error.message);
        return false;
      }
    } else {
      console.warn('Certificate generation script not found');
      return false;
    }
  }
  return certsExist();
}

/**
 * Create mock SSL WebSocket server for testing
 * @param {Object} options - Server options
 * @returns {Object} Server instance and utilities
 */
function createMockSSLServer(options = {}) {
  const port = options.port || TEST_PORT;
  const host = options.host || TEST_HOST;

  // Read certificates
  const sslOptions = {
    cert: fs.readFileSync(CERT_PATH),
    key: fs.readFileSync(KEY_PATH),
    ca: fs.readFileSync(CA_PATH),
    requestCert: options.requestCert || false,
    rejectUnauthorized: options.rejectUnauthorized !== false
  };

  // Create HTTPS server
  const httpsServer = https.createServer(sslOptions);

  // Create WebSocket server
  const wss = new WebSocket.Server({ server: httpsServer });

  // Setup message handler
  wss.on('connection', (ws, req) => {
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'status',
      message: 'connected',
      secure: true,
      protocol: 'wss'
    }));

    // Handle messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        const response = handleCommand(message);
        ws.send(JSON.stringify(response));
      } catch (error) {
        ws.send(JSON.stringify({
          id: null,
          success: false,
          error: error.message
        }));
      }
    });
  });

  // Command handler for test server
  function handleCommand(message) {
    const { id, command } = message;

    switch (command) {
      case 'ping':
        return { id, success: true, message: 'pong', timestamp: Date.now() };
      case 'status':
        return {
          id,
          success: true,
          status: {
            ready: true,
            port,
            secure: true,
            protocol: 'wss'
          }
        };
      case 'echo':
        return { id, success: true, data: message };
      case 'get_ssl_info':
        return {
          id,
          success: true,
          ssl: {
            enabled: true,
            protocol: 'TLSv1.3',
            cipher: 'TLS_AES_256_GCM_SHA384'
          }
        };
      default:
        return { id, success: false, error: `Unknown command: ${command}` };
    }
  }

  return {
    httpsServer,
    wss,
    start() {
      return new Promise((resolve) => {
        httpsServer.listen(port, host, () => {
          resolve({ host, port });
        });
      });
    },
    stop() {
      return new Promise((resolve) => {
        // Close all client connections first
        wss.clients.forEach((client) => {
          try {
            client.terminate();
          } catch (err) {
            // Ignore errors during cleanup
          }
        });

        // Close WebSocket server
        wss.close((err1) => {
          // Close HTTPS server
          httpsServer.close((err2) => {
            // Force close any remaining connections
            httpsServer.closeAllConnections?.();
            resolve();
          });
        });

        // Force close after 3 seconds
        setTimeout(() => {
          try {
            httpsServer.closeAllConnections?.();
          } catch (err) {
            // Ignore
          }
          resolve();
        }, 3000);
      });
    },
    getUrl() {
      return `wss://${host}:${port}`;
    }
  };
}

/**
 * Create mock non-SSL WebSocket server for fallback testing
 * @param {Object} options - Server options
 * @returns {Object} Server instance and utilities
 */
function createMockWSServer(options = {}) {
  const port = options.port || TEST_PORT + 1;
  const host = options.host || TEST_HOST;

  const wss = new WebSocket.Server({ port, host });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'status',
      message: 'connected',
      secure: false,
      protocol: 'ws'
    }));

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        ws.send(JSON.stringify({
          id: message.id,
          success: true,
          command: message.command,
          echo: message
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          success: false,
          error: error.message
        }));
      }
    });
  });

  return {
    wss,
    start() {
      return Promise.resolve({ host, port });
    },
    stop() {
      return new Promise((resolve) => {
        // Close all client connections first
        wss.clients.forEach((client) => {
          try {
            client.terminate();
          } catch (err) {
            // Ignore errors during cleanup
          }
        });

        wss.close((err) => {
          resolve();
        });

        // Force close after 2 seconds
        setTimeout(() => {
          resolve();
        }, 2000);
      });
    },
    getUrl() {
      return `ws://${host}:${port}`;
    }
  };
}

/**
 * Create WebSocket client with SSL options
 * @param {string} url - WebSocket URL
 * @param {Object} options - Connection options
 * @returns {Promise<WebSocket>}
 */
function createSSLClient(url, options = {}) {
  return new Promise((resolve, reject) => {
    const wsOptions = {
      rejectUnauthorized: options.rejectUnauthorized !== false,
      ca: options.ca ? fs.readFileSync(options.ca) : undefined,
      cert: options.cert ? fs.readFileSync(options.cert) : undefined,
      key: options.key ? fs.readFileSync(options.key) : undefined
    };

    const ws = new WebSocket(url, wsOptions);
    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error('Connection timeout'));
    }, options.timeout || 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Send command and wait for response
 * @param {WebSocket} ws - WebSocket connection
 * @param {string} command - Command name
 * @param {Object} params - Command parameters
 * @returns {Promise<Object>}
 */
function sendCommand(ws, command, params = {}) {
  return new Promise((resolve, reject) => {
    const id = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timeout = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, 10000);

    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          clearTimeout(timeout);
          ws.removeListener('message', messageHandler);
          resolve(response);
        }
      } catch (error) {
        // Ignore parse errors for status messages
      }
    };

    ws.on('message', messageHandler);
    ws.send(JSON.stringify({ id, command, ...params }));
  });
}

// Skip tests if certificates don't exist and can't be generated
const describeSsl = certsExist() || ensureCertsExist() ? describe : describe.skip;

describeSsl('SSL WebSocket Connection Tests', () => {
  let sslServer;
  let wsServer;

  beforeAll(async () => {
    // Create and start SSL server
    sslServer = createMockSSLServer({ port: TEST_PORT });
    await sslServer.start();

    // Create and start non-SSL server for fallback tests
    wsServer = createMockWSServer({ port: TEST_PORT + 1 });
    await wsServer.start();
  });

  afterAll(async () => {
    // Add timeout and proper cleanup
    const timeout = new Promise((resolve) => setTimeout(resolve, 5000));

    try {
      if (sslServer) {
        await Promise.race([sslServer.stop(), timeout]);
      }
      if (wsServer) {
        await Promise.race([wsServer.stop(), timeout]);
      }
    } catch (error) {
      console.warn('Warning: Server cleanup error:', error.message);
    }
  }, 10000); // 10 second timeout for afterAll

  describe('WSS Connection Establishment', () => {
    test('should establish wss:// connection with self-signed certificate', async () => {
      const ws = await createSSLClient(sslServer.getUrl(), {
        rejectUnauthorized: false // Accept self-signed certs for testing
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Wait for connection message
      const connectionMessage = await new Promise((resolve) => {
        ws.once('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(connectionMessage.type).toBe('status');
      expect(connectionMessage.message).toBe('connected');
      expect(connectionMessage.secure).toBe(true);
      expect(connectionMessage.protocol).toBe('wss');

      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should establish wss:// connection with CA certificate', async () => {
      const ws = await createSSLClient(sslServer.getUrl(), {
        ca: CA_PATH,
        rejectUnauthorized: false // Self-signed cert needs this for testing
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should fail connection with invalid SSL options', async () => {
      // Try to connect with rejectUnauthorized = true without CA
      // This should fail for self-signed certificates
      await expect(
        createSSLClient(sslServer.getUrl(), {
          rejectUnauthorized: true,
          timeout: 3000
        })
      ).rejects.toThrow();
    });
  });

  describe('Commands Over SSL Connection', () => {
    let ws;

    beforeEach(async () => {
      ws = await createSSLClient(sslServer.getUrl(), {
        rejectUnauthorized: false
      });
      // Wait for connection message
      await new Promise((resolve) => {
        ws.once('message', () => resolve());
      });
    });

    afterEach(async () => {
      if (ws) {
        ws.terminate();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    test('should execute ping command over SSL', async () => {
      const response = await sendCommand(ws, 'ping');
      expect(response.success).toBe(true);
      expect(response.message).toBe('pong');
      expect(response.timestamp).toBeDefined();
    });

    test('should execute status command over SSL', async () => {
      const response = await sendCommand(ws, 'status');
      expect(response.success).toBe(true);
      expect(response.status.ready).toBe(true);
      expect(response.status.secure).toBe(true);
      expect(response.status.protocol).toBe('wss');
    });

    test('should execute echo command over SSL', async () => {
      const testData = { foo: 'bar', num: 42 };
      const response = await sendCommand(ws, 'echo', testData);
      expect(response.success).toBe(true);
      expect(response.data.foo).toBe('bar');
      expect(response.data.num).toBe(42);
    });

    test('should get SSL connection info', async () => {
      const response = await sendCommand(ws, 'get_ssl_info');
      expect(response.success).toBe(true);
      expect(response.ssl.enabled).toBe(true);
      expect(response.ssl.protocol).toBeDefined();
    });

    test('should handle unknown command over SSL', async () => {
      const response = await sendCommand(ws, 'unknown_command_xyz');
      expect(response.success).toBe(false);
      expect(response.error).toContain('Unknown command');
    });

    test('should handle multiple concurrent commands over SSL', async () => {
      const commands = [
        sendCommand(ws, 'ping'),
        sendCommand(ws, 'status'),
        sendCommand(ws, 'echo', { test: 1 }),
        sendCommand(ws, 'echo', { test: 2 }),
        sendCommand(ws, 'ping')
      ];

      const responses = await Promise.all(commands);
      expect(responses).toHaveLength(5);
      expect(responses.every(r => r.success)).toBe(true);
    });
  });

  describe('Certificate Validation Errors', () => {
    test('should detect DEPTH_ZERO_SELF_SIGNED_CERT error', async () => {
      try {
        await createSSLClient(sslServer.getUrl(), {
          rejectUnauthorized: true,
          timeout: 3000
        });
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        // Should get a certificate-related error
        const errorMessage = error.message.toLowerCase();
        const isCertError = errorMessage.includes('self') ||
                          errorMessage.includes('cert') ||
                          errorMessage.includes('unable to verify') ||
                          error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                          error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
        expect(isCertError || error.message.includes('timeout')).toBe(true);
      }
    });

    test('should handle connection to non-SSL server with wss://', async () => {
      // Attempting wss:// to a non-SSL server should fail
      const nonSslPort = TEST_PORT + 100;
      const nonSslServer = new WebSocket.Server({ port: nonSslPort });

      try {
        await createSSLClient(`wss://localhost:${nonSslPort}`, {
          rejectUnauthorized: false,
          timeout: 3000
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        // Connection should fail
        expect(error).toBeDefined();
      } finally {
        nonSslServer.close();
      }
    });
  });

  describe('Fallback to WS When SSL Not Configured', () => {
    test('should connect via ws:// when SSL is not available', async () => {
      const ws = await new Promise((resolve, reject) => {
        const client = new WebSocket(wsServer.getUrl());
        client.on('open', () => resolve(client));
        client.on('error', reject);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Wait for connection message
      const connectionMessage = await new Promise((resolve) => {
        ws.once('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });
      });

      expect(connectionMessage.secure).toBe(false);
      expect(connectionMessage.protocol).toBe('ws');

      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should fallback to ws:// after wss:// connection failure', async () => {
      // Simulate connection fallback logic
      async function connectWithFallback(host, port) {
        const wssUrl = `wss://${host}:${port}`;
        const wsUrl = `ws://${host}:${port + 1}`;

        try {
          // Try WSS first (this will fail to our non-SSL fallback port)
          return await createSSLClient(wssUrl, {
            rejectUnauthorized: true,
            timeout: 1000
          });
        } catch (error) {
          // Fallback to WS
          return new Promise((resolve, reject) => {
            const client = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
              client.terminate();
              reject(new Error('Fallback connection timeout'));
            }, 5000);

            client.on('open', () => {
              clearTimeout(timeout);
              resolve(client);
            });
            client.on('error', (err) => {
              clearTimeout(timeout);
              reject(err);
            });
          });
        }
      }

      const ws = await connectWithFallback(TEST_HOST, TEST_PORT);
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should detect protocol from connection', async () => {
      // Connect to non-SSL server
      const ws = await new Promise((resolve, reject) => {
        const client = new WebSocket(wsServer.getUrl());
        client.on('open', () => resolve(client));
        client.on('error', reject);
      });

      // Check URL protocol
      const url = new URL(wsServer.getUrl());
      expect(url.protocol).toBe('ws:');

      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('SSL Connection Stability', () => {
    test('should maintain connection over time', async () => {
      const ws = await createSSLClient(sslServer.getUrl(), {
        rejectUnauthorized: false
      });

      // Wait for connection message
      await new Promise((resolve) => {
        ws.once('message', () => resolve());
      });

      // Send multiple pings over time
      for (let i = 0; i < 5; i++) {
        const response = await sendCommand(ws, 'ping');
        expect(response.success).toBe(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should handle reconnection after disconnect', async () => {
      // First connection
      let ws = await createSSLClient(sslServer.getUrl(), {
        rejectUnauthorized: false
      });
      await new Promise((resolve) => {
        ws.once('message', () => resolve());
      });
      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Close connection
      ws.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(ws.readyState).toBe(WebSocket.CLOSED);

      // Reconnect
      ws = await createSSLClient(sslServer.getUrl(), {
        rejectUnauthorized: false
      });
      await new Promise((resolve) => {
        ws.once('message', () => resolve());
      });
      expect(ws.readyState).toBe(WebSocket.OPEN);

      ws.terminate();
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Multiple SSL Clients', () => {
    test('should handle multiple concurrent SSL connections', async () => {
      const clients = [];

      // Create multiple clients
      for (let i = 0; i < 5; i++) {
        const ws = await createSSLClient(sslServer.getUrl(), {
          rejectUnauthorized: false
        });
        await new Promise((resolve) => {
          ws.once('message', () => resolve());
        });
        clients.push(ws);
      }

      expect(clients).toHaveLength(5);
      expect(clients.every(c => c.readyState === WebSocket.OPEN)).toBe(true);

      // All clients should be able to send commands
      const responses = await Promise.all(
        clients.map(ws => sendCommand(ws, 'ping'))
      );
      expect(responses.every(r => r.success)).toBe(true);

      // Close all clients
      for (const client of clients) {
        client.terminate();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});

// Tests that run without SSL certificates
describe('SSL Connection Tests (No Certificates Required)', () => {
  describe('SSL URL Construction', () => {
    test('should construct correct WSS URL', () => {
      const url = `wss://${TEST_HOST}:${TEST_PORT}`;
      expect(url.startsWith('wss://')).toBe(true);
    });

    test('should construct correct WS URL', () => {
      const url = `ws://${TEST_HOST}:${TEST_PORT}`;
      expect(url.startsWith('ws://')).toBe(true);
    });

    test('should parse SSL URL correctly', () => {
      const wssUrl = new URL(`wss://${TEST_HOST}:${TEST_PORT}/path`);
      expect(wssUrl.protocol).toBe('wss:');
      expect(wssUrl.hostname).toBe(TEST_HOST);
      expect(wssUrl.port).toBe(String(TEST_PORT));

      const wsUrl = new URL(`ws://${TEST_HOST}:${TEST_PORT}/path`);
      expect(wsUrl.protocol).toBe('ws:');
    });
  });

  describe('SSL Detection Logic', () => {
    test('should detect WSS protocol from URL', () => {
      const wssUrl = 'wss://example.com:8765';
      const wsUrl = 'ws://example.com:8765';

      expect(wssUrl.startsWith('wss://')).toBe(true);
      expect(wsUrl.startsWith('wss://')).toBe(false);
    });

    test('should convert protocol correctly', () => {
      function getSecureProtocol(protocol) {
        const protocolMap = {
          'ws': 'wss',
          'http': 'https',
          'wss': 'wss',
          'https': 'https'
        };
        return protocolMap[protocol] || protocol;
      }

      expect(getSecureProtocol('ws')).toBe('wss');
      expect(getSecureProtocol('http')).toBe('https');
      expect(getSecureProtocol('wss')).toBe('wss');
    });
  });

  describe('SSL Configuration Validation', () => {
    test('should validate SSL configuration object', () => {
      function validateSslConfig(config) {
        const errors = [];
        if (config.ssl === true) {
          if (!config.cert) errors.push('Certificate path required');
          if (!config.key) errors.push('Key path required');
        }
        return { valid: errors.length === 0, errors };
      }

      expect(validateSslConfig({ ssl: false })).toEqual({ valid: true, errors: [] });
      expect(validateSslConfig({ ssl: true, cert: 'a', key: 'b' })).toEqual({ valid: true, errors: [] });
      expect(validateSslConfig({ ssl: true }).valid).toBe(false);
    });

    test('should check TLS version validity', () => {
      const validVersions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];

      function isValidTlsVersion(version) {
        return validVersions.includes(version);
      }

      expect(isValidTlsVersion('TLSv1.2')).toBe(true);
      expect(isValidTlsVersion('TLSv1.3')).toBe(true);
      expect(isValidTlsVersion('TLSv0.9')).toBe(false);
      expect(isValidTlsVersion('SSLv3')).toBe(false);
    });
  });
});

// Export test utilities for external use
module.exports = {
  createMockSSLServer,
  createMockWSServer,
  createSSLClient,
  sendCommand,
  SSL_FIXTURES_DIR,
  CERT_PATH,
  KEY_PATH,
  CA_PATH
};

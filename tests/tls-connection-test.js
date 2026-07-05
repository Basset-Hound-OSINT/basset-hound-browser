#!/usr/bin/env node
/**
 * TLS/WSS Connection Test
 * Verifies that the WebSocket server can accept both ws:// and wss:// connections
 *
 * Usage:
 *   node tests/tls-connection-test.js [options]
 *
 * Options:
 *   --wss               Test WSS connection (requires TLS)
 *   --ws                Test WS connection (no TLS)
 *   --both              Test both WS and WSS
 *   --cert <path>       Path to certificate file
 *   --key <path>        Path to key file
 *   --port <port>       WebSocket port (default: 8765)
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const opts = {
  wss: args.includes('--wss') || args.includes('--both'),
  ws: args.includes('--ws') || args.includes('--both'),
  cert: null,
  key: null,
  port: 8765,
  testBoth: args.includes('--both')
};

// Parse individual options
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--cert' && args[i + 1]) opts.cert = args[++i];
  if (args[i] === '--key' && args[i + 1]) opts.key = args[++i];
  if (args[i] === '--port' && args[i + 1]) opts.port = parseInt(args[++i], 10);
}

// Default: test both if none specified
if (!opts.wss && !opts.ws) {
  opts.wss = true;
  opts.ws = true;
}

// Resolve certificate paths
if (opts.wss && !opts.cert) {
  const defaultCertPaths = [
    path.join(__dirname, '../certs/cert.pem'),
    path.join(__dirname, '../cert.pem'),
    process.env.BASSET_WS_SSL_CERT
  ].filter(Boolean);

  for (const certPath of defaultCertPaths) {
    if (certPath && fs.existsSync(certPath)) {
      opts.cert = certPath;
      break;
    }
  }
}

if (opts.wss && !opts.key) {
  const defaultKeyPaths = [
    path.join(__dirname, '../certs/key.pem'),
    path.join(__dirname, '../key.pem'),
    process.env.BASSET_WS_SSL_KEY
  ].filter(Boolean);

  for (const keyPath of defaultKeyPaths) {
    if (keyPath && fs.existsSync(keyPath)) {
      opts.key = keyPath;
      break;
    }
  }
}

console.log('\n========================================');
console.log('TLS/WSS Connection Test');
console.log('========================================\n');

/**
 * Start a test WebSocket server
 */
async function startTestServer(useSSL = false) {
  return new Promise((resolve, reject) => {
    try {
      let server;
      const serverConfig = { port: opts.port, host: '127.0.0.1' };

      if (useSSL) {
        if (!opts.cert || !opts.key) {
          throw new Error('SSL enabled but certificates not found. Set --cert and --key or BASSET_WS_SSL_* env vars');
        }

        if (!fs.existsSync(opts.cert)) {
          throw new Error(`Certificate file not found: ${opts.cert}`);
        }
        if (!fs.existsSync(opts.key)) {
          throw new Error(`Key file not found: ${opts.key}`);
        }

        const sslOptions = {
          cert: fs.readFileSync(opts.cert),
          key: fs.readFileSync(opts.key)
        };

        server = https.createServer(sslOptions);
        console.log(`[WSS] Starting HTTPS server on ${serverConfig.host}:${serverConfig.port}`);
        console.log(`[WSS] Using certificate: ${opts.cert}`);
        console.log(`[WSS] Using key: ${opts.key}\n`);
      } else {
        server = http.createServer();
        console.log(`[WS] Starting HTTP server on ${serverConfig.host}:${serverConfig.port}\n`);
      }

      const wss = new WebSocket.Server({ server });
      let clientsConnected = 0;

      wss.on('connection', (ws, req) => {
        clientsConnected++;
        const protocol = useSSL ? 'wss' : 'ws';
        console.log(`[${protocol.toUpperCase()}] Client ${clientsConnected} connected`);
        console.log(`[${protocol.toUpperCase()}] Remote address: ${req.socket.remoteAddress}`);

        ws.on('message', (message) => {
          console.log(`[${protocol.toUpperCase()}] Received: ${message}`);
          ws.send(`Echo: ${message}`);
        });

        ws.on('close', () => {
          console.log(`[${protocol.toUpperCase()}] Client disconnected`);
        });

        ws.on('error', (error) => {
          console.error(`[${protocol.toUpperCase()}] WebSocket error:`, error.message);
        });
      });

      wss.on('error', (error) => {
        console.error(`[${useSSL ? 'WSS' : 'WS'}] Server error:`, error.message);
        reject(error);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[${useSSL ? 'WSS' : 'WS'}] Port ${opts.port} is already in use`);
        } else {
          console.error(`[${useSSL ? 'WSS' : 'WS'}] Server error:`, error.message);
        }
        reject(error);
      });

      server.listen(opts.port, '127.0.0.1', () => {
        const protocol = useSSL ? 'wss' : 'ws';
        console.log(`[${protocol.toUpperCase()}] Server listening on ${protocol}://127.0.0.1:${opts.port}`);

        resolve({
          server,
          wss,
          protocol,
          close: () => {
            return new Promise((resolve) => {
              wss.close(() => {
                server.close(resolve);
              });
            });
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Test client connection
 */
async function testClientConnection(protocol) {
  return new Promise((resolve) => {
    const url = `${protocol}://127.0.0.1:${opts.port}`;
    console.log(`\n[TEST] Connecting to ${url}...`);

    const clientOptions = {};

    // For WSS with self-signed cert, disable certificate verification
    if (protocol === 'wss') {
      clientOptions.rejectUnauthorized = false;
    }

    try {
      const ws = new WebSocket(url, clientOptions);
      let testPassed = false;

      const timeout = setTimeout(() => {
        console.error(`[TEST] Connection timeout after 5 seconds`);
        ws.terminate();
        resolve(false);
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`[TEST] Connection successful!`);
        console.log(`[TEST] Sending test message...`);
        ws.send('Hello from test client');
        testPassed = true;
      });

      ws.on('message', (message) => {
        console.log(`[TEST] Received response: ${message}`);
        ws.close();
        resolve(true);
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`[TEST] Connection error: ${error.message}`);
        resolve(false);
      });

      ws.on('close', () => {
        if (!testPassed) {
          resolve(false);
        }
      });
    } catch (error) {
      console.error(`[TEST] Error: ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Main test runner
 */
async function runTests() {
  const results = {
    ws: null,
    wss: null
  };

  try {
    // Test WS
    if (opts.ws) {
      console.log('\n========================================');
      console.log('Testing WS (unencrypted WebSocket)');
      console.log('========================================');

      const wsServer = await startTestServer(false);
      await new Promise(r => setTimeout(r, 500)); // Give server time to start

      results.ws = await testClientConnection('ws');
      await wsServer.close();

      console.log(`[TEST] WS Result: ${results.ws ? '✓ PASS' : '✗ FAIL'}\n`);
    }

    // Test WSS
    if (opts.wss) {
      console.log('\n========================================');
      console.log('Testing WSS (TLS-encrypted WebSocket)');
      console.log('========================================');

      // Use different port for WSS to avoid conflicts
      const originalPort = opts.port;
      opts.port = opts.port + 1;

      try {
        const wssServer = await startTestServer(true);
        await new Promise(r => setTimeout(r, 500)); // Give server time to start

        results.wss = await testClientConnection('wss');
        await wssServer.close();

        console.log(`[TEST] WSS Result: ${results.wss ? '✓ PASS' : '✗ FAIL'}\n`);
      } finally {
        opts.port = originalPort;
      }
    }

    // Summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================\n');

    if (opts.ws) {
      console.log(`WS (unencrypted):  ${results.ws ? '✓ PASS' : '✗ FAIL'}`);
    }
    if (opts.wss) {
      console.log(`WSS (TLS):         ${results.wss ? '✓ PASS' : '✗ FAIL'}`);
    }

    const allPassed = (opts.ws ? results.ws : true) && (opts.wss ? results.wss : true);
    console.log(`\nOverall:           ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}\n`);

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n[ERROR]', error.message);
    process.exit(1);
  }
}

// Run tests
runTests();

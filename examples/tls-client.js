/**
 * TLS/WSS Client Example
 *
 * Demonstrates secure WebSocket (WSS) connections to Basset Hound Browser
 *
 * Usage:
 *   node tls-client.js [env] [command]
 *
 * Examples:
 *   node tls-client.js dev ping              // Self-signed cert
 *   node tls-client.js prod navigate         // Production cert
 *   node tls-client.js dev screenshot        // With options
 *
 * Environments:
 *   dev   - localhost with self-signed cert
 *   prod  - browser.example.com with valid cert
 *   custom - Configure via environment variables
 */

const WebSocket = require('ws');
const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration presets
const ENVIRONMENTS = {
  dev: {
    url: 'wss://localhost:8765',
    rejectUnauthorized: false,
    description: 'Development (self-signed cert)',
    cert: './certs/localhost.crt',
    key: './certs/localhost.key'
  },
  prod: {
    url: 'wss://browser.example.com:8765',
    rejectUnauthorized: true,
    description: 'Production (valid cert)',
    cert: '/etc/basset/certs/cert.pem',
    key: '/etc/basset/certs/key.pem'
  },
  local: {
    url: process.env.WSS_URL || 'wss://localhost:8765',
    rejectUnauthorized: process.env.TLS_INSECURE === 'true' ? false : true,
    description: 'Custom (via env vars)',
    cert: process.env.TLS_CERT_PATH,
    key: process.env.TLS_KEY_PATH
  }
};

/**
 * TLS-Aware WebSocket Client
 */
class TLSWebSocketClient {
  constructor(environment = 'dev') {
    this.env = ENVIRONMENTS[environment] || ENVIRONMENTS.dev;
    this.ws = null;
    this.config = {
      rejectUnauthorized: this.env.rejectUnauthorized,
      hostname: new URL(this.env.url).hostname,
      port: new URL(this.env.url).port,
      protocol: new URL(this.env.url).protocol.slice(0, -1) // Remove trailing ':'
    };

    // Add client certificate if available
    if (this.env.cert && fs.existsSync(this.env.cert)) {
      try {
        this.config.cert = fs.readFileSync(this.env.cert);
        console.log(`[TLS] Loaded client certificate: ${this.env.cert}`);
      } catch (err) {
        console.warn(`[TLS] Could not load client certificate: ${err.message}`);
      }
    }

    if (this.env.key && fs.existsSync(this.env.key)) {
      try {
        this.config.key = fs.readFileSync(this.env.key);
        console.log(`[TLS] Loaded client key: ${this.env.key}`);
      } catch (err) {
        console.warn(`[TLS] Could not load client key: ${err.message}`);
      }
    }

    // Add CA certificate if available (for custom/self-signed validation)
    const caPath = process.env.TLS_CA_PATH;
    if (caPath && fs.existsSync(caPath)) {
      try {
        this.config.ca = fs.readFileSync(caPath);
        console.log(`[TLS] Loaded CA certificate: ${caPath}`);
      } catch (err) {
        console.warn(`[TLS] Could not load CA certificate: ${err.message}`);
      }
    }

    console.log(`[TLS Client] Environment: ${environment} (${this.env.description})`);
    console.log(`[TLS Client] Connecting to: ${this.env.url}`);
    console.log(`[TLS Client] Certificate validation: ${this.config.rejectUnauthorized ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Connect to WebSocket server with TLS
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.env.url, {
          rejectUnauthorized: this.config.rejectUnauthorized,
          ca: this.config.ca,
          cert: this.config.cert,
          key: this.config.key,
          // Enable detailed error messages
          handshakeTimeout: 10000
        });

        this.ws.on('open', () => {
          console.log('[Connection] Connected via WSS');
          this._logTLSInfo();
          resolve(this);
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            this._handleMessage(msg);
          } catch (err) {
            console.log('[Message] Raw:', data.toString());
          }
        });

        this.ws.on('error', (err) => {
          console.error('[Error]', this._formatError(err));
          reject(err);
        });

        this.ws.on('close', () => {
          console.log('[Connection] Closed');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Log TLS/SSL information about the connection
   */
  _logTLSInfo() {
    if (!this.ws || !this.ws.socket) {
      return;
    }

    const socket = this.ws.socket;
    if (socket.tlsSession) {
      const tlsVersion = socket.getProtocol?.();
      const cipher = socket.getCipher?.();

      console.log('[TLS Info]');
      if (tlsVersion) console.log(`  Protocol: ${tlsVersion}`);
      if (cipher) {
        console.log(`  Cipher: ${cipher.name}`);
        console.log(`  Key Size: ${cipher.bits} bits`);
      }

      // Certificate info
      const cert = socket.getPeerCertificate?.();
      if (cert) {
        console.log(`  Subject: ${cert.subject?.CN}`);
        console.log(`  Issuer: ${cert.issuer?.CN}`);
        console.log(`  Valid From: ${cert.valid_from}`);
        console.log(`  Valid Until: ${cert.valid_to}`);
      }
    }
  }

  /**
   * Format error messages for readability
   */
  _formatError(err) {
    const messages = {
      'SELF_SIGNED_CERT_IN_CHAIN': 'Self-signed certificate detected. Use rejectUnauthorized: false in development.',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'Certificate verification failed. Check certificate validity.',
      'ERR_TLS_CERT_ALTNAME_INVALID': 'Certificate hostname mismatch. Check certificate CN and SANs.',
      'ECONNREFUSED': 'Connection refused. Is the server running?',
      'ETIMEDOUT': 'Connection timeout. Check hostname/port.',
      'EHOSTUNREACH': 'Host unreachable. Check network connectivity.'
    };

    const type = err.code || err.message;
    const friendly = messages[type] || err.message;

    return `${type}: ${friendly}`;
  }

  /**
   * Handle message from server
   */
  _handleMessage(msg) {
    if (msg.command === 'pong') {
      console.log('[Response] Pong received');
    } else if (msg.error) {
      console.error('[Error]', msg.error);
    } else if (msg.success) {
      console.log('[Response] Success:', msg.data || msg.message);
    } else {
      console.log('[Response]', msg);
    }
  }

  /**
   * Send command
   */
  send(command, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    const message = { command, ...data };
    this.ws.send(JSON.stringify(message));
    console.log('[Sent]', command);
  }

  /**
   * Close connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Interactive REPL mode
   */
  async interactive() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const prompt = () => {
      rl.question('> ', (input) => {
        const [cmd, ...args] = input.trim().split(' ');

        if (cmd === 'exit' || cmd === 'quit') {
          rl.close();
          this.close();
          process.exit(0);
        } else if (cmd === 'help') {
          this._showHelp();
          prompt();
        } else if (cmd === 'info') {
          this._logTLSInfo();
          prompt();
        } else if (cmd) {
          this.send(cmd, { arg: args.join(' ') });
          setTimeout(prompt, 500); // Wait for response
        } else {
          prompt();
        }
      });
    };

    console.log('\nInteractive Mode (type "help" for commands):\n');
    prompt();
  }

  /**
   * Show help
   */
  _showHelp() {
    console.log(`
Available Commands:
  ping            - Test connection
  navigate URL    - Navigate to URL
  screenshot      - Take screenshot
  info            - Show TLS info
  help            - Show this help
  exit            - Close connection and exit
    `);
  }
}

/**
 * Example: Automated test sequence
 */
async function runTestSequence(client) {
  console.log('\n--- Test Sequence ---\n');

  // Test 1: Ping
  console.log('Test 1: Ping');
  client.send('ping');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Get connection info
  console.log('\nTest 2: Connection info');
  client.send('get-status');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Navigate (if you want to test)
  console.log('\nTest 3: Navigate (optional)');
  client.send('navigate', { url: 'https://example.com' });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n--- Test Complete ---\n');
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const environment = args[0] || 'dev';
  const command = args[1];

  // Validate environment
  if (!ENVIRONMENTS[environment] && environment !== 'custom') {
    console.error(`Unknown environment: ${environment}`);
    console.error(`Available: ${Object.keys(ENVIRONMENTS).join(', ')}`);
    process.exit(1);
  }

  try {
    // Create and connect client
    const client = new TLSWebSocketClient(environment);
    await client.connect();

    // Execute command or go interactive
    if (command === 'ping') {
      client.send('ping');
      setTimeout(() => client.close(), 1000);
    } else if (command === 'navigate') {
      const url = args[2] || 'https://example.com';
      client.send('navigate', { url });
      setTimeout(() => client.close(), 2000);
    } else if (command === 'screenshot') {
      client.send('screenshot');
      setTimeout(() => client.close(), 2000);
    } else if (command === 'test') {
      await runTestSequence(client);
      client.close();
    } else {
      // Interactive mode
      await client.interactive();
    }
  } catch (err) {
    console.error('Fatal error:', err.message);
    if (err.code === 'ENOTFOUND') {
      console.error('Hostname not found. Check the server address.');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Connection refused. Is the server running on the correct port?');
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

module.exports = { TLSWebSocketClient, ENVIRONMENTS };

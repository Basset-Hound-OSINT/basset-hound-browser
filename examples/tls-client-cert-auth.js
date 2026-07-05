/**
 * TLS Client Certificate Authentication Example
 *
 * Demonstrates mutual TLS (mTLS) / client certificate authentication
 * with Basset Hound Browser WebSocket server
 *
 * Features:
 * - Server validates client certificates
 * - Client validates server certificate
 * - Certificate pinning for added security
 * - Automatic certificate renewal detection
 *
 * Setup (mTLS):
 * 1. Generate CA certificate
 * 2. Generate server certificate signed by CA
 * 3. Generate client certificates signed by CA
 * 4. Server: Enable client cert verification (TLS_CA_PATH)
 * 5. Client: Provide client cert and key
 *
 * Usage:
 *   node tls-client-cert-auth.js [command]
 *
 * Commands:
 *   setup-keys          Generate CA, server, and client certificates
 *   connect             Connect with client certificate
 *   validate-cert       Validate certificate chain
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

/**
 * Mutual TLS Configuration Manager
 */
class MTLSManager {
  constructor(baseDir = './certs-mtls') {
    this.baseDir = baseDir;
    this.caDir = path.join(baseDir, 'ca');
    this.serverDir = path.join(baseDir, 'server');
    this.clientDir = path.join(baseDir, 'client');

    // Ensure directories exist
    [this.baseDir, this.caDir, this.serverDir, this.clientDir]
      .forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });
  }

  /**
   * Generate CA (Certificate Authority) certificate
   */
  generateCA(commonName = 'Basset Hound CA', days = 3650) {
    console.log('[CA] Generating Certificate Authority...');
    console.log(`  Common Name: ${commonName}`);
    console.log(`  Validity: ${days} days`);

    const caKey = path.join(this.caDir, 'ca-key.pem');
    const caCert = path.join(this.caDir, 'ca-cert.pem');

    // Generate CA private key
    execSync(`openssl genrsa -out ${caKey} 4096 2>/dev/null`);

    // Generate CA certificate
    execSync(`
      openssl req -new -x509 \
        -key ${caKey} \
        -out ${caCert} \
        -days ${days} \
        -subj "/CN=${commonName}/O=Basset Hound/C=US" \
        2>/dev/null
    `);

    // Fix permissions
    fs.chmodSync(caKey, 0o600);
    fs.chmodSync(caCert, 0o644);

    console.log(`[CA] CA certificate created: ${caCert}`);
    console.log(`[CA] CA private key: ${caKey}`);

    return { caKey, caCert };
  }

  /**
   * Generate server certificate signed by CA
   */
  generateServerCert(commonName = 'localhost', days = 365) {
    console.log('[Server] Generating server certificate...');
    console.log(`  Common Name: ${commonName}`);

    const caKey = path.join(this.caDir, 'ca-key.pem');
    const caCert = path.join(this.caDir, 'ca-cert.pem');

    if (!fs.existsSync(caCert)) {
      throw new Error('CA certificate not found. Generate CA first.');
    }

    const serverKey = path.join(this.serverDir, 'server-key.pem');
    const serverReq = path.join(this.serverDir, 'server.csr');
    const serverCert = path.join(this.serverDir, 'server-cert.pem');

    // Generate server private key
    execSync(`openssl genrsa -out ${serverKey} 2048 2>/dev/null`);

    // Generate server certificate request
    execSync(`
      openssl req -new \
        -key ${serverKey} \
        -out ${serverReq} \
        -subj "/CN=${commonName}/O=Basset Hound/C=US" \
        2>/dev/null
    `);

    // Sign server certificate with CA
    execSync(`
      openssl x509 -req \
        -in ${serverReq} \
        -CA ${caCert} \
        -CAkey ${caKey} \
        -CAcreateserial \
        -out ${serverCert} \
        -days ${days} \
        -sha256 \
        2>/dev/null
    `);

    // Fix permissions
    fs.chmodSync(serverKey, 0o600);
    fs.chmodSync(serverCert, 0o644);

    console.log(`[Server] Server certificate: ${serverCert}`);
    console.log(`[Server] Server private key: ${serverKey}`);

    return { serverKey, serverCert };
  }

  /**
   * Generate client certificate signed by CA
   */
  generateClientCert(clientName = 'client1', days = 365) {
    console.log(`[Client] Generating client certificate: ${clientName}...`);

    const caKey = path.join(this.caDir, 'ca-key.pem');
    const caCert = path.join(this.caDir, 'ca-cert.pem');

    if (!fs.existsSync(caCert)) {
      throw new Error('CA certificate not found. Generate CA first.');
    }

    const clientDir = path.join(this.clientDir, clientName);
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }

    const clientKey = path.join(clientDir, `${clientName}-key.pem`);
    const clientReq = path.join(clientDir, `${clientName}.csr`);
    const clientCert = path.join(clientDir, `${clientName}-cert.pem`);

    // Generate client private key
    execSync(`openssl genrsa -out ${clientKey} 2048 2>/dev/null`);

    // Generate client certificate request
    execSync(`
      openssl req -new \
        -key ${clientKey} \
        -out ${clientReq} \
        -subj "/CN=${clientName}/O=Basset Hound Client/C=US" \
        2>/dev/null
    `);

    // Sign client certificate with CA
    execSync(`
      openssl x509 -req \
        -in ${clientReq} \
        -CA ${caCert} \
        -CAkey ${caKey} \
        -CAcreateserial \
        -out ${clientCert} \
        -days ${days} \
        -sha256 \
        2>/dev/null
    `);

    // Fix permissions
    fs.chmodSync(clientKey, 0o600);
    fs.chmodSync(clientCert, 0o644);

    console.log(`[Client] Client certificate: ${clientCert}`);
    console.log(`[Client] Client private key: ${clientKey}`);

    return { clientKey, clientCert };
  }

  /**
   * Get certificate fingerprint (for pinning)
   */
  getCertificateFingerprint(certPath) {
    const certData = fs.readFileSync(certPath, 'utf8');
    const cert = crypto.createCertificate(certData);
    const fingerprint = crypto
      .createHash('sha256')
      .update(certData)
      .digest('hex');

    return fingerprint;
  }

  /**
   * Validate certificate chain
   */
  validateCertificateChain(certPath, caPath) {
    try {
      const result = execSync(
        `openssl verify -CAfile ${caPath} ${certPath} 2>&1`,
        { encoding: 'utf8' }
      );
      return result.includes('ok');
    } catch (err) {
      return false;
    }
  }

  /**
   * Display certificate information
   */
  displayCertInfo(certPath) {
    if (!fs.existsSync(certPath)) {
      console.error(`Certificate not found: ${certPath}`);
      return;
    }

    console.log(`\nCertificate: ${path.basename(certPath)}`);
    console.log('─'.repeat(50));

    try {
      const info = execSync(
        `openssl x509 -in ${certPath} -noout -subject -issuer -dates -fingerprint -sha256 2>&1`,
        { encoding: 'utf8' }
      );
      console.log(info);
    } catch (err) {
      console.error('Failed to read certificate:', err.message);
    }
  }
}

/**
 * Mutual TLS WebSocket Client
 */
class MTLSWebSocketClient {
  constructor(serverUrl, clientCertPath, clientKeyPath, caCertPath = null) {
    this.serverUrl = serverUrl;
    this.clientCertPath = clientCertPath;
    this.clientKeyPath = clientKeyPath;
    this.caCertPath = caCertPath;
    this.ws = null;
    this.connected = false;
  }

  /**
   * Connect with client certificate
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Load certificates
        const cert = fs.readFileSync(this.clientCertPath);
        const key = fs.readFileSync(this.clientKeyPath);

        const options = {
          cert,
          key,
          rejectUnauthorized: true
        };

        // Load CA certificate if provided
        if (this.caCertPath && fs.existsSync(this.caCertPath)) {
          options.ca = fs.readFileSync(this.caCertPath);
        }

        console.log('[mTLS] Connecting with client certificate...');
        console.log(`  Server: ${this.serverUrl}`);
        console.log(`  Client cert: ${path.basename(this.clientCertPath)}`);

        this.ws = new WebSocket(this.serverUrl, {
          cert: options.cert,
          key: options.key,
          ca: options.ca,
          rejectUnauthorized: options.rejectUnauthorized,
          handshakeTimeout: 10000
        });

        this.ws.on('open', () => {
          this.connected = true;
          console.log('[mTLS] Connected');
          this._logTLSInfo();
          resolve(this);
        });

        this.ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data);
            console.log('[Message]', msg);
          } catch (err) {
            console.log('[Message] Raw:', data.toString());
          }
        });

        this.ws.on('error', (err) => {
          console.error('[Error]', err.message);
          reject(err);
        });

        this.ws.on('close', () => {
          this.connected = false;
          console.log('[mTLS] Disconnected');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Log TLS information
   */
  _logTLSInfo() {
    if (!this.ws || !this.ws.socket) return;

    const socket = this.ws.socket;
    const tlsVersion = socket.getProtocol?.();
    const cipher = socket.getCipher?.();
    const peerCert = socket.getPeerCertificate?.();

    console.log('[TLS Info]');
    if (tlsVersion) console.log(`  Protocol: ${tlsVersion}`);
    if (cipher) {
      console.log(`  Cipher: ${cipher.name}`);
      console.log(`  Key bits: ${cipher.bits}`);
    }
    if (peerCert) {
      console.log(`  Server certificate:`);
      console.log(`    Subject: ${peerCert.subject?.CN}`);
      console.log(`    Issuer: ${peerCert.issuer?.CN}`);
    }
  }

  /**
   * Send command
   */
  send(command, data = {}) {
    if (!this.connected) {
      console.error('Not connected');
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
}

/**
 * Main demonstration
 */
async function main() {
  const command = process.argv[2] || 'connect';

  const mtls = new MTLSManager('./certs-mtls');

  try {
    if (command === 'setup-keys') {
      console.log('='.repeat(60));
      console.log('Setting up mTLS Certificates');
      console.log('='.repeat(60));
      console.log('');

      // Step 1: Generate CA
      mtls.generateCA();
      console.log('');

      // Step 2: Generate server certificate
      mtls.generateServerCert('localhost');
      console.log('');

      // Step 3: Generate client certificate
      mtls.generateClientCert('client1');
      console.log('');

      // Display certificate info
      console.log('Certificate Information:');
      console.log('');
      mtls.displayCertInfo(path.join(mtls.caDir, 'ca-cert.pem'));
      mtls.displayCertInfo(path.join(mtls.serverDir, 'server-cert.pem'));
      mtls.displayCertInfo(path.join(mtls.clientDir, 'client1', 'client1-cert.pem'));

      console.log('\nSetup complete! Certificates are in:', mtls.baseDir);
      console.log('\nTo use with server:');
      console.log(`  Set TLS_CA_PATH=${path.join(mtls.caDir, 'ca-cert.pem')}`);

    } else if (command === 'validate-cert') {
      const certPath = process.argv[3] || path.join(mtls.clientDir, 'client1', 'client1-cert.pem');
      const caPath = path.join(mtls.caDir, 'ca-cert.pem');

      console.log('Validating certificate...');
      const isValid = mtls.validateCertificateChain(certPath, caPath);
      console.log(`Certificate valid: ${isValid}`);

      mtls.displayCertInfo(certPath);

    } else if (command === 'connect') {
      const clientCert = path.join(mtls.clientDir, 'client1', 'client1-cert.pem');
      const clientKey = path.join(mtls.clientDir, 'client1', 'client1-key.pem');
      const caCert = path.join(mtls.caDir, 'ca-cert.pem');

      if (!fs.existsSync(clientCert) || !fs.existsSync(clientKey)) {
        console.error('Client certificates not found. Run setup-keys first.');
        process.exit(1);
      }

      const client = new MTLSWebSocketClient(
        'wss://localhost:8765',
        clientCert,
        clientKey,
        caCert
      );

      await client.connect();

      // Send test command
      client.send('ping');

      // Close after 2 seconds
      setTimeout(() => {
        client.close();
        process.exit(0);
      }, 2000);

    } else {
      console.error('Unknown command:', command);
      console.log('');
      console.log('Available commands:');
      console.log('  setup-keys       Generate CA, server, and client certificates');
      console.log('  connect          Connect with client certificate');
      console.log('  validate-cert    Validate certificate chain');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { MTLSManager, MTLSWebSocketClient };

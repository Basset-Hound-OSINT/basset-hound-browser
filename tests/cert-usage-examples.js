#!/usr/bin/env node
/**
 * Certificate Generator Usage Examples
 * Demonstrates practical usage patterns for the CertificateGenerator class
 */

const path = require('path');
const fs = require('fs');

// Note: In real usage, electron would be available
// For this example, we'll show the code patterns

console.log('Certificate Generator Usage Examples\n');
console.log('='.repeat(70));

// ============================================================================
// Example 1: Basic Usage in Electron App
// ============================================================================
console.log('\n📝 Example 1: Basic Usage in Electron App\n');
console.log('```javascript');
console.log(`const CertificateGenerator = require('./utils/cert-generator');

async function setupWebSocketServer() {
  // Create certificate generator
  const certGen = new CertificateGenerator();

  // Ensure certificates exist (generates if needed)
  const certs = await certGen.ensureCertificates();

  // Use certificates with WebSocket server
  const httpsServer = https.createServer({
    key: fs.readFileSync(certs.keyPath),
    cert: fs.readFileSync(certs.certPath),
    ca: fs.readFileSync(certs.caPath)
  });

  const wss = new WebSocket.Server({ server: httpsServer });
  httpsServer.listen(8765);

  console.log('WebSocket server running with SSL');
}
`);
console.log('```');

// ============================================================================
// Example 2: Custom Configuration
// ============================================================================
console.log('\n📝 Example 2: Custom Configuration\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator({
  certsDir: '/custom/path/to/certs',
  validityDays: 730,           // 2 years
  keySize: 4096,               // Stronger encryption
  organization: 'My Company',
  commonName: 'myapp.local'
});

const certs = await certGen.ensureCertificates();
`);
console.log('```');

// ============================================================================
// Example 3: Check Certificate Info
// ============================================================================
console.log('\n📝 Example 3: Check Certificate Information\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator();
const info = certGen.getCertificateInfo();

if (info) {
  console.log('Certificate exists:');
  console.log('  Created:', info.createdAt);
  console.log('  Modified:', info.modifiedAt);
  console.log('  Size:', info.size, 'bytes');
  console.log('  Paths:', info.paths);
} else {
  console.log('No certificates found');
}
`);
console.log('```');

// ============================================================================
// Example 4: Force Certificate Regeneration
// ============================================================================
console.log('\n📝 Example 4: Force Certificate Regeneration\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator();

// Delete old certificates
certGen.deleteCertificates();

// Generate new ones
const certs = await certGen.ensureCertificates();
console.log('New certificates generated');
`);
console.log('```');

// ============================================================================
// Example 5: With Custom Logger
// ============================================================================
console.log('\n📝 Example 5: With Custom Logger\n');
console.log('```javascript');
console.log(`const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'certs.log' })]
});

const certGen = new CertificateGenerator({ logger });
const certs = await certGen.ensureCertificates();
// All certificate operations will be logged to certs.log
`);
console.log('```');

// ============================================================================
// Example 6: Error Handling
// ============================================================================
console.log('\n📝 Example 6: Proper Error Handling\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator();

try {
  const certs = await certGen.ensureCertificates();
  console.log('Certificates ready:', certs.certPath);
} catch (error) {
  console.error('Failed to generate certificates:', error);

  // Fallback to HTTP if SSL fails
  const httpServer = http.createServer();
  const wss = new WebSocket.Server({ server: httpServer });
  httpServer.listen(8765);
  console.log('Fallback to HTTP WebSocket server');
}
`);
console.log('```');

// ============================================================================
// Example 7: Testing Different Generation Methods
// ============================================================================
console.log('\n📝 Example 7: Testing Different Generation Methods\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator({
  certsDir: './test-certs'
});

// Check which method will be used
if (certGen._isOpenSSLAvailable()) {
  console.log('Will use OpenSSL (best compatibility)');
} else {
  console.log('Will use fallback method (may have limitations)');
}

const certs = await certGen.ensureCertificates();
`);
console.log('```');

// ============================================================================
// Example 8: Integration with Existing WebSocket Server
// ============================================================================
console.log('\n📝 Example 8: Integration with Existing WebSocket Server\n');
console.log('```javascript');
console.log(`const https = require('https');
const WebSocket = require('ws');
const CertificateGenerator = require('./utils/cert-generator');

class SecureWebSocketServer {
  constructor(port = 8765) {
    this.port = port;
    this.certGen = new CertificateGenerator();
  }

  async start() {
    // Ensure certificates
    const certs = await this.certGen.ensureCertificates();

    // Create HTTPS server
    this.httpsServer = https.createServer({
      key: fs.readFileSync(certs.keyPath),
      cert: fs.readFileSync(certs.certPath),
      ca: fs.readFileSync(certs.caPath),
      requestCert: false,
      rejectUnauthorized: false
    });

    // Create WebSocket server
    this.wss = new WebSocket.Server({ server: this.httpsServer });

    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      ws.on('message', (msg) => this.handleMessage(ws, msg));
    });

    this.httpsServer.listen(this.port, () => {
      console.log(\`Secure WebSocket server running on port \${this.port}\`);
      console.log('Certificates:', certs.certsDir);
    });
  }

  handleMessage(ws, msg) {
    // Handle incoming messages
  }
}

// Usage
const server = new SecureWebSocketServer(8765);
server.start().catch(console.error);
`);
console.log('```');

// ============================================================================
// Example 9: Certificate Renewal Check
// ============================================================================
console.log('\n📝 Example 9: Periodic Certificate Renewal Check\n');
console.log('```javascript');
console.log(`const certGen = new CertificateGenerator();

// Check and renew certificates every day
setInterval(async () => {
  try {
    const info = certGen.getCertificateInfo();
    if (info) {
      const age = Date.now() - info.createdAt.getTime();
      const daysSinceCreation = age / (1000 * 60 * 60 * 24);

      console.log(\`Certificate age: \${daysSinceCreation.toFixed(0)} days\`);

      // ensureCertificates will auto-renew if needed
      await certGen.ensureCertificates();
    }
  } catch (error) {
    console.error('Certificate renewal check failed:', error);
  }
}, 24 * 60 * 60 * 1000); // Check daily
`);
console.log('```');

// ============================================================================
// Example 10: Multi-Environment Setup
// ============================================================================
console.log('\n📝 Example 10: Multi-Environment Setup\n');
console.log('```javascript');
console.log(`const { app } = require('electron');

function getCertGenerator() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: use project directory
    return new CertificateGenerator({
      certsDir: path.join(__dirname, 'dev-certs'),
      validityDays: 30,  // Shorter validity in dev
      logger: console    // Verbose logging in dev
    });
  } else {
    // Production: use user data directory
    return new CertificateGenerator({
      validityDays: 365,
      logger: productionLogger  // Structured logging in prod
    });
  }
}

const certGen = getCertGenerator();
const certs = await certGen.ensureCertificates();
`);
console.log('```');

// ============================================================================
// Practical Example: Run actual code
// ============================================================================
console.log('\n📝 Practical Example: Running Actual Code\n');
console.log('='.repeat(70));

try {
  const CertificateGenerator = require('../utils/cert-generator');
  const testDir = path.join(__dirname, 'example-certs');

  console.log('\n1. Creating CertificateGenerator instance...');
  const certGen = new CertificateGenerator({
    certsDir: testDir,
    validityDays: 365,
    organization: 'Example App',
    commonName: 'example.local'
  });

  console.log('   ✓ Instance created');
  console.log(`   ✓ Certificates will be stored in: ${testDir}`);

  console.log('\n2. Checking OpenSSL availability...');
  const hasOpenSSL = certGen._isOpenSSLAvailable();
  console.log(`   ${hasOpenSSL ? '✓' : '✗'} OpenSSL ${hasOpenSSL ? 'is' : 'is not'} available`);
  console.log(`   ${hasOpenSSL ? '→' : '→'} Will use ${hasOpenSSL ? 'OpenSSL' : 'Node.js crypto fallback'}`);

  console.log('\n3. Checking if certificates already exist...');
  const alreadyExists = certGen._certificatesExist();
  console.log(`   ${alreadyExists ? '✓' : '○'} Certificates ${alreadyExists ? 'exist' : 'do not exist'}`);

  console.log('\n4. Generating certificates...');
  certGen.ensureCertificates().then(certs => {
    console.log('   ✓ Certificates ready!');
    console.log(`   → Cert: ${certs.certPath}`);
    console.log(`   → Key:  ${certs.keyPath}`);
    console.log(`   → CA:   ${certs.caPath}`);

    console.log('\n5. Verifying files...');
    const certExists = fs.existsSync(certs.certPath);
    const keyExists = fs.existsSync(certs.keyPath);
    const caExists = fs.existsSync(certs.caPath);

    console.log(`   ${certExists ? '✓' : '✗'} Server certificate: ${certExists ? 'exists' : 'missing'}`);
    console.log(`   ${keyExists ? '✓' : '✗'} Server key: ${keyExists ? 'exists' : 'missing'}`);
    console.log(`   ${caExists ? '✓' : '✗'} CA certificate: ${caExists ? 'exists' : 'missing'}`);

    if (certExists) {
      const certSize = fs.statSync(certs.certPath).size;
      const keySize = fs.statSync(certs.keyPath).size;
      console.log(`\n6. File sizes:`);
      console.log(`   → Certificate: ${certSize} bytes`);
      console.log(`   → Private key: ${keySize} bytes`);
    }

    console.log('\n7. Getting certificate info...');
    const info = certGen.getCertificateInfo();
    if (info) {
      console.log(`   ✓ Created: ${info.createdAt.toLocaleString()}`);
      console.log(`   ✓ Modified: ${info.modifiedAt.toLocaleString()}`);
    }

    console.log('\n8. Cleaning up example certificates...');
    certGen.deleteCertificates();
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
    console.log('   ✓ Cleanup complete');

    console.log('\n' + '='.repeat(70));
    console.log('Example completed successfully! ✓');
    console.log('='.repeat(70));
  }).catch(error => {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
  });

} catch (error) {
  console.error('\n✗ Failed to load module:', error.message);
}

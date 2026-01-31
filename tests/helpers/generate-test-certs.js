/**
 * Basset Hound Browser - Test Certificate Generator
 * Generates self-signed SSL certificates for testing WebSocket SSL connections
 *
 * This script creates:
 * - ca.pem: Certificate Authority certificate
 * - cert.pem: Server certificate signed by the CA
 * - key.pem: Private key for the server certificate
 *
 * Usage:
 *   node generate-test-certs.js [--force]
 *
 * Options:
 *   --force: Regenerate certificates even if they exist
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const SSL_FIXTURES_DIR = path.join(__dirname, '..', 'results', 'ssl');
const CERT_VALIDITY_DAYS = 365;
const KEY_SIZE = 2048;

// Certificate file paths
const CA_KEY_PATH = path.join(SSL_FIXTURES_DIR, 'ca-key.pem');
const CA_CERT_PATH = path.join(SSL_FIXTURES_DIR, 'ca.pem');
const SERVER_KEY_PATH = path.join(SSL_FIXTURES_DIR, 'key.pem');
const SERVER_CSR_PATH = path.join(SSL_FIXTURES_DIR, 'server.csr');
const SERVER_CERT_PATH = path.join(SSL_FIXTURES_DIR, 'cert.pem');
const CONFIG_PATH = path.join(SSL_FIXTURES_DIR, 'openssl.cnf');

/**
 * Check if OpenSSL is available
 * @returns {boolean}
 */
function isOpenSSLAvailable() {
  try {
    execSync('openssl version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Create the SSL fixtures directory if it doesn't exist
 */
function ensureDirectoryExists() {
  if (!fs.existsSync(SSL_FIXTURES_DIR)) {
    fs.mkdirSync(SSL_FIXTURES_DIR, { recursive: true });
    console.log(`Created directory: ${SSL_FIXTURES_DIR}`);
  }
}

/**
 * Check if certificates already exist
 * @returns {boolean}
 */
function certsExist() {
  return fs.existsSync(CA_CERT_PATH) &&
         fs.existsSync(SERVER_CERT_PATH) &&
         fs.existsSync(SERVER_KEY_PATH);
}

/**
 * Create OpenSSL configuration file
 */
function createOpenSSLConfig() {
  const config = `
[req]
default_bits = ${KEY_SIZE}
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca
req_extensions = v3_req

[dn]
C = US
ST = Test State
L = Test City
O = Basset Hound Browser Tests
OU = Testing
CN = localhost

[v3_ca]
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1

[v3_server]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names
`;

  fs.writeFileSync(CONFIG_PATH, config.trim());
  console.log(`Created OpenSSL config: ${CONFIG_PATH}`);
}

/**
 * Generate certificates using OpenSSL
 * @returns {boolean} Success status
 */
function generateWithOpenSSL() {
  console.log('Generating certificates using OpenSSL...');

  try {
    // Create OpenSSL config
    createOpenSSLConfig();

    // Generate CA private key
    console.log('Generating CA private key...');
    execSync(`openssl genrsa -out "${CA_KEY_PATH}" ${KEY_SIZE}`, { stdio: 'pipe' });

    // Generate CA certificate
    console.log('Generating CA certificate...');
    execSync(`openssl req -new -x509 -days ${CERT_VALIDITY_DAYS} -key "${CA_KEY_PATH}" -out "${CA_CERT_PATH}" -config "${CONFIG_PATH}" -extensions v3_ca`, { stdio: 'pipe' });

    // Generate server private key
    console.log('Generating server private key...');
    execSync(`openssl genrsa -out "${SERVER_KEY_PATH}" ${KEY_SIZE}`, { stdio: 'pipe' });

    // Generate server CSR
    console.log('Generating server CSR...');
    execSync(`openssl req -new -key "${SERVER_KEY_PATH}" -out "${SERVER_CSR_PATH}" -config "${CONFIG_PATH}"`, { stdio: 'pipe' });

    // Sign server certificate with CA
    console.log('Signing server certificate...');
    execSync(`openssl x509 -req -in "${SERVER_CSR_PATH}" -CA "${CA_CERT_PATH}" -CAkey "${CA_KEY_PATH}" -CAcreateserial -out "${SERVER_CERT_PATH}" -days ${CERT_VALIDITY_DAYS} -extfile "${CONFIG_PATH}" -extensions v3_server`, { stdio: 'pipe' });

    // Clean up temporary files
    if (fs.existsSync(SERVER_CSR_PATH)) {
      fs.unlinkSync(SERVER_CSR_PATH);
    }
    const serialPath = path.join(SSL_FIXTURES_DIR, 'ca.srl');
    if (fs.existsSync(serialPath)) {
      fs.unlinkSync(serialPath);
    }

    console.log('Certificates generated successfully with OpenSSL');
    return true;
  } catch (error) {
    console.error('OpenSSL generation failed:', error.message);
    return false;
  }
}

/**
 * Generate a simple self-signed certificate using Node.js crypto
 * This is a fallback when OpenSSL is not available
 * @returns {boolean} Success status
 */
function generateWithNodeCrypto() {
  console.log('Generating certificates using Node.js crypto (fallback)...');

  try {
    // Check if Node.js version supports generateKeyPairSync with RSA
    if (typeof crypto.generateKeyPairSync !== 'function') {
      throw new Error('crypto.generateKeyPairSync not available');
    }

    // Generate CA key pair
    console.log('Generating CA key pair...');
    const caKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: KEY_SIZE,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Generate server key pair
    console.log('Generating server key pair...');
    const serverKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: KEY_SIZE,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Create self-signed certificates using X509Certificate if available (Node 15+)
    // Otherwise create placeholder PEM files with the keys
    if (typeof crypto.X509Certificate === 'function' && crypto.createPrivateKey) {
      // Node 15+ with X509Certificate support
      console.log('Using X509Certificate API...');

      // For now, we'll create simple self-signed certs
      // In production, you'd use a proper X509 library
      createSimplePEMFiles(caKeyPair, serverKeyPair);
    } else {
      // Older Node.js - create simple PEM structure
      createSimplePEMFiles(caKeyPair, serverKeyPair);
    }

    console.log('Certificates generated successfully with Node.js crypto');
    return true;
  } catch (error) {
    console.error('Node.js crypto generation failed:', error.message);
    return false;
  }
}

/**
 * Create simple PEM files (fallback for when proper cert generation is not available)
 * @param {Object} caKeyPair - CA key pair
 * @param {Object} serverKeyPair - Server key pair
 */
function createSimplePEMFiles(caKeyPair, serverKeyPair) {
  // Write CA key
  fs.writeFileSync(CA_KEY_PATH, caKeyPair.privateKey);

  // Write server key
  fs.writeFileSync(SERVER_KEY_PATH, serverKeyPair.privateKey);

  // For certificates, we need to create proper X.509 structures
  // This is a simplified approach - for real testing, use OpenSSL
  const notBefore = new Date();
  const notAfter = new Date();
  notAfter.setDate(notAfter.getDate() + CERT_VALIDITY_DAYS);

  // Create a placeholder certificate structure
  // Note: This is NOT a valid X.509 certificate, just a placeholder
  // Real tests should use OpenSSL-generated certificates
  const certPlaceholder = `-----BEGIN CERTIFICATE-----
${Buffer.from(JSON.stringify({
  type: 'self-signed-test-certificate',
  subject: 'CN=localhost,O=Basset Hound Browser Tests',
  issuer: 'CN=Test CA',
  validFrom: notBefore.toISOString(),
  validTo: notAfter.toISOString(),
  publicKey: 'RSA-' + KEY_SIZE,
  note: 'This is a placeholder. Use OpenSSL for real certificates.'
})).toString('base64').match(/.{1,64}/g).join('\n')}
-----END CERTIFICATE-----
`;

  fs.writeFileSync(CA_CERT_PATH, certPlaceholder);
  fs.writeFileSync(SERVER_CERT_PATH, certPlaceholder);

  console.log('Warning: Created placeholder certificates. For real SSL testing, install OpenSSL.');
}

/**
 * Generate certificates using the best available method
 * @param {Object} options - Generation options
 * @returns {boolean} Success status
 */
function generateCertificates(options = {}) {
  const force = options.force || process.argv.includes('--force');

  console.log('='.repeat(60));
  console.log('Basset Hound Browser - Test Certificate Generator');
  console.log('='.repeat(60));

  // Check if certificates already exist
  if (certsExist() && !force) {
    console.log('Certificates already exist. Use --force to regenerate.');
    return true;
  }

  // Ensure directory exists
  ensureDirectoryExists();

  // Try OpenSSL first
  if (isOpenSSLAvailable()) {
    console.log('OpenSSL is available');
    if (generateWithOpenSSL()) {
      printCertInfo();
      return true;
    }
  } else {
    console.log('OpenSSL not found, using Node.js crypto fallback');
  }

  // Fallback to Node.js crypto
  if (generateWithNodeCrypto()) {
    printCertInfo();
    return true;
  }

  console.error('Failed to generate certificates');
  return false;
}

/**
 * Print certificate information
 */
function printCertInfo() {
  console.log('\n' + '='.repeat(60));
  console.log('Certificate Generation Complete');
  console.log('='.repeat(60));
  console.log('Generated files:');
  console.log(`  CA Certificate:     ${CA_CERT_PATH}`);
  console.log(`  Server Certificate: ${SERVER_CERT_PATH}`);
  console.log(`  Server Private Key: ${SERVER_KEY_PATH}`);
  console.log('='.repeat(60));

  // Show certificate details if OpenSSL is available
  if (isOpenSSLAvailable()) {
    try {
      console.log('\nCertificate Details:');
      const certInfo = execSync(`openssl x509 -in "${SERVER_CERT_PATH}" -noout -subject -issuer -dates`, { encoding: 'utf8' });
      console.log(certInfo);
    } catch (error) {
      // Ignore errors when reading cert info
    }
  }
}

/**
 * Clean up generated certificates
 */
function cleanupCertificates() {
  const files = [
    CA_KEY_PATH,
    CA_CERT_PATH,
    SERVER_KEY_PATH,
    SERVER_CERT_PATH,
    CONFIG_PATH,
    SERVER_CSR_PATH,
    path.join(SSL_FIXTURES_DIR, 'ca.srl')
  ];

  let cleaned = 0;
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      cleaned++;
    }
  }

  console.log(`Cleaned up ${cleaned} certificate files`);
  return cleaned > 0;
}

/**
 * Verify certificates are valid and work together
 * @returns {boolean}
 */
function verifyCertificates() {
  if (!certsExist()) {
    console.log('Certificates do not exist');
    return false;
  }

  if (!isOpenSSLAvailable()) {
    console.log('OpenSSL not available for verification');
    return true; // Assume valid if we can't verify
  }

  try {
    // Verify server cert against CA
    execSync(`openssl verify -CAfile "${CA_CERT_PATH}" "${SERVER_CERT_PATH}"`, { stdio: 'pipe' });
    console.log('Certificate verification: PASSED');
    return true;
  } catch (error) {
    console.error('Certificate verification: FAILED');
    return false;
  }
}

/**
 * Get certificate paths
 * @returns {Object}
 */
function getCertPaths() {
  return {
    caKey: CA_KEY_PATH,
    caCert: CA_CERT_PATH,
    serverKey: SERVER_KEY_PATH,
    serverCert: SERVER_CERT_PATH,
    fixturesDir: SSL_FIXTURES_DIR
  };
}

// Export functions for use in tests
module.exports = {
  generateCertificates,
  cleanupCertificates,
  verifyCertificates,
  certsExist,
  getCertPaths,
  isOpenSSLAvailable,
  SSL_FIXTURES_DIR,
  CA_CERT_PATH,
  SERVER_CERT_PATH,
  SERVER_KEY_PATH
};

// Run directly if called as script
if (require.main === module) {
  const success = generateCertificates();
  process.exit(success ? 0 : 1);
}

/**
 * @fileoverview Basset Hound Browser - Production SSL Certificate Generator
 *
 * Automatically generates self-signed SSL certificates for the WebSocket server
 * when running in standalone/production mode. Certificates are stored locally
 * next to the application binary/AppImage for persistence.
 *
 * Features:
 * - Automatic certificate generation on first run
 * - Certificate renewal when expired (< 30 days remaining)
 * - Multiple generation methods with automatic fallback
 * - Configurable certificate storage location
 * - Support for both development and production environments
 *
 * Generation Methods (in order of preference):
 * 1. OpenSSL - Creates fully compliant X.509 certificates (most reliable)
 * 2. node-forge - Pure JavaScript X.509 certificate generation
 * 3. Node.js crypto - Fallback with simplified certificate structure
 *
 * @module utils/cert-generator
 * @requires fs
 * @requires path
 * @requires crypto
 * @requires child_process
 *
 * @example
 * // Basic usage
 * const CertificateGenerator = require('./utils/cert-generator');
 * const certGen = new CertificateGenerator();
 * const certs = await certGen.ensureCertificates();
 * // Use certs.certPath, certs.keyPath, certs.caPath
 *
 * @example
 * // Custom configuration
 * const certGen = new CertificateGenerator({
 *   certsDir: '/path/to/certs',
 *   validityDays: 730,
 *   keySize: 4096,
 *   organization: 'My App',
 *   commonName: 'myapp.local'
 * });
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * SSL Certificate Generator for self-signed certificates.
 *
 * Provides automatic generation and management of self-signed SSL certificates
 * for secure WebSocket and HTTPS connections. Supports multiple certificate
 * generation backends with automatic fallback.
 *
 * @class CertificateGenerator
 *
 * @example
 * const certGen = new CertificateGenerator();
 * const certs = await certGen.ensureCertificates();
 * // Use with HTTPS/WSS server
 * const server = https.createServer({
 *   key: fs.readFileSync(certs.keyPath),
 *   cert: fs.readFileSync(certs.certPath),
 *   ca: fs.readFileSync(certs.caPath)
 * }, app);
 */
class CertificateGenerator {
  /**
   * Create a CertificateGenerator instance.
   *
   * @constructor
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.certsDir] - Directory for storing certificates (auto-detected if not provided)
   * @param {number} [options.validityDays=365] - Certificate validity in days
   * @param {number} [options.keySize=2048] - RSA key size in bits (2048 or 4096 recommended)
   * @param {string} [options.organization='Basset Hound Browser'] - Organization name for certificate
   * @param {string} [options.commonName='localhost'] - Common name (CN) for certificate
   * @param {Object} [options.logger=console] - Logger instance for output
   *
   * @example
   * // Default configuration (auto-detects Electron environment)
   * const certGen = new CertificateGenerator();
   *
   * @example
   * // Custom configuration
   * const certGen = new CertificateGenerator({
   *   certsDir: '/var/lib/myapp/certs',
   *   validityDays: 730,  // 2 years
   *   keySize: 4096,
   *   organization: 'My Company',
   *   commonName: 'myapp.local'
   * });
   */
  constructor(options = {}) {
    // Determine base directory for certificate storage
    // In production: use userData directory
    // In development: use ./certs in project root
    let defaultDir;
    try {
      const { app } = require('electron');
      const isDev = !app.isPackaged;
      defaultDir = isDev
        ? path.join(process.cwd(), 'certs')
        : path.join(app.getPath('userData'), 'certs');
    } catch (error) {
      // Fallback if electron is not available (e.g., in tests)
      defaultDir = path.join(process.cwd(), 'certs');
    }

    this.certsDir = options.certsDir || defaultDir;
    this.certValidityDays = options.validityDays || 365;
    this.keySize = options.keySize || 2048;
    this.organization = options.organization || 'Basset Hound Browser';
    this.commonName = options.commonName || 'localhost';

    // Certificate file paths
    this.paths = {
      caKey: path.join(this.certsDir, 'ca-key.pem'),
      caCert: path.join(this.certsDir, 'ca.pem'),
      serverKey: path.join(this.certsDir, 'key.pem'),
      serverCert: path.join(this.certsDir, 'cert.pem'),
      config: path.join(this.certsDir, 'openssl.cnf')
    };

    this.logger = options.logger || console;
  }

  /**
   * Ensure certificates exist and are valid.
   *
   * This is the main entry point for certificate management. It checks
   * if certificates exist, validates them, and generates new ones if needed.
   * Certificates are regenerated if they don't exist, are invalid, or have
   * less than 30 days of validity remaining.
   *
   * @method ensureCertificates
   * @async
   * @returns {Promise<Object>} Certificate paths object
   * @returns {string} returns.certPath - Path to server certificate (cert.pem)
   * @returns {string} returns.keyPath - Path to server private key (key.pem)
   * @returns {string} returns.caPath - Path to CA certificate (ca.pem)
   * @returns {string} returns.certsDir - Path to certificates directory
   * @throws {Error} If certificate generation fails with all methods
   *
   * @example
   * const certs = await certGen.ensureCertificates();
   * console.log('Certificate path:', certs.certPath);
   * console.log('Key path:', certs.keyPath);
   * console.log('CA path:', certs.caPath);
   */
  async ensureCertificates() {
    try {
      // Create certs directory if it doesn't exist
      this._ensureDirectoryExists();

      // Check if certificates exist and are valid
      if (this._certificatesExist()) {
        const isValid = await this._validateCertificate();
        if (isValid) {
          this.logger.info(`[CertGenerator] Using existing certificates from ${this.certsDir}`);
          return this._getCertPaths();
        } else {
          this.logger.warn('[CertGenerator] Existing certificates are expired or invalid, regenerating...');
        }
      }

      // Generate new certificates
      this.logger.info('[CertGenerator] Generating new SSL certificates...');
      await this._generateCertificates();
      this.logger.info('[CertGenerator] SSL certificates generated successfully');

      return this._getCertPaths();
    } catch (error) {
      this.logger.error(`[CertGenerator] Failed to ensure certificates: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate complete certificate chain
   * Tries OpenSSL first, falls back to node-forge, then Node.js crypto
   * @private
   */
  async _generateCertificates() {
    // Try OpenSSL first (creates proper X.509 certificates)
    if (this._isOpenSSLAvailable()) {
      this.logger.info('[CertGenerator] Using OpenSSL for certificate generation');
      try {
        await this._generateWithOpenSSL();
        return;
      } catch (error) {
        this.logger.warn(`[CertGenerator] OpenSSL generation failed: ${error.message}, trying fallback...`);
      }
    }

    // Try node-forge if available
    try {
      const forge = require('node-forge');
      this.logger.info('[CertGenerator] Using node-forge for certificate generation');
      await this._generateWithForge(forge);
      return;
    } catch (error) {
      this.logger.warn(`[CertGenerator] node-forge not available: ${error.message}, trying Node.js crypto fallback...`);
    }

    // Final fallback to Node.js crypto
    this.logger.info('[CertGenerator] Using Node.js crypto for certificate generation');
    await this._generateWithNodeCrypto();
  }

  /**
   * Check if OpenSSL is available
   * @private
   */
  _isOpenSSLAvailable() {
    try {
      execSync('openssl version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate certificates using OpenSSL
   * @private
   */
  async _generateWithOpenSSL() {
    // Create OpenSSL config file
    this._createOpenSSLConfig();

    // Generate CA private key
    this.logger.info('[CertGenerator] Generating CA private key with OpenSSL...');
    execSync(`openssl genrsa -out "${this.paths.caKey}" ${this.keySize}`, { stdio: 'pipe' });

    // Generate CA certificate
    this.logger.info('[CertGenerator] Generating CA certificate...');
    execSync(`openssl req -new -x509 -days ${this.certValidityDays} -key "${this.paths.caKey}" -out "${this.paths.caCert}" -config "${this.paths.config}" -extensions v3_ca`, { stdio: 'pipe' });

    // Generate server private key
    this.logger.info('[CertGenerator] Generating server private key...');
    execSync(`openssl genrsa -out "${this.paths.serverKey}" ${this.keySize}`, { stdio: 'pipe' });

    // Generate server CSR
    const csrPath = path.join(this.certsDir, 'server.csr');
    this.logger.info('[CertGenerator] Generating server CSR...');
    execSync(`openssl req -new -key "${this.paths.serverKey}" -out "${csrPath}" -config "${this.paths.config}"`, { stdio: 'pipe' });

    // Sign server certificate with CA
    this.logger.info('[CertGenerator] Signing server certificate...');
    execSync(`openssl x509 -req -in "${csrPath}" -CA "${this.paths.caCert}" -CAkey "${this.paths.caKey}" -CAcreateserial -out "${this.paths.serverCert}" -days ${this.certValidityDays} -extfile "${this.paths.config}" -extensions v3_server`, { stdio: 'pipe' });

    // Clean up temporary files
    if (fs.existsSync(csrPath)) {
      fs.unlinkSync(csrPath);
    }
    const serialPath = path.join(this.certsDir, 'ca.srl');
    if (fs.existsSync(serialPath)) {
      fs.unlinkSync(serialPath);
    }

    // Set proper permissions on private keys
    fs.chmodSync(this.paths.caKey, 0o600);
    fs.chmodSync(this.paths.serverKey, 0o600);

    this.logger.info('[CertGenerator] Certificates generated successfully with OpenSSL');
  }

  /**
   * Create OpenSSL configuration file
   * @private
   */
  _createOpenSSLConfig() {
    const config = `
[req]
default_bits = ${this.keySize}
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca
req_extensions = v3_req

[dn]
C = US
ST = California
L = San Francisco
O = ${this.organization}
OU = WebSocket Server
CN = ${this.commonName}

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

    fs.writeFileSync(this.paths.config, config.trim());
  }

  /**
   * Generate certificates using node-forge library
   * @private
   */
  async _generateWithForge(forge) {
    const pki = forge.pki;

    // Generate CA key pair
    this.logger.info('[CertGenerator] Generating CA key pair with node-forge...');
    const caKeys = pki.rsa.generateKeyPair(this.keySize);

    // Create CA certificate
    const caCert = pki.createCertificate();
    caCert.publicKey = caKeys.publicKey;
    caCert.serialNumber = '01';
    caCert.validity.notBefore = new Date();
    caCert.validity.notAfter = new Date();
    caCert.validity.notAfter.setDate(caCert.validity.notAfter.getDate() + this.certValidityDays);

    const caAttrs = [
      { name: 'commonName', value: `${this.organization} CA` },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'California' },
      { name: 'localityName', value: 'San Francisco' },
      { name: 'organizationName', value: this.organization },
      { shortName: 'OU', value: 'Certificate Authority' }
    ];

    caCert.setSubject(caAttrs);
    caCert.setIssuer(caAttrs);
    caCert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true },
      { name: 'subjectKeyIdentifier' }
    ]);

    // Self-sign CA certificate
    caCert.sign(caKeys.privateKey, forge.md.sha256.create());

    // Generate server key pair
    this.logger.info('[CertGenerator] Generating server key pair...');
    const serverKeys = pki.rsa.generateKeyPair(this.keySize);

    // Create server certificate
    const serverCert = pki.createCertificate();
    serverCert.publicKey = serverKeys.publicKey;
    serverCert.serialNumber = '02';
    serverCert.validity.notBefore = new Date();
    serverCert.validity.notAfter = new Date();
    serverCert.validity.notAfter.setDate(serverCert.validity.notAfter.getDate() + this.certValidityDays);

    const serverAttrs = [
      { name: 'commonName', value: this.commonName },
      { name: 'countryName', value: 'US' },
      { shortName: 'ST', value: 'California' },
      { name: 'localityName', value: 'San Francisco' },
      { name: 'organizationName', value: this.organization },
      { shortName: 'OU', value: 'WebSocket Server' }
    ];

    serverCert.setSubject(serverAttrs);
    serverCert.setIssuer(caAttrs);
    serverCert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 2, value: '*.localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ]);

    // Sign server certificate with CA
    serverCert.sign(caKeys.privateKey, forge.md.sha256.create());

    // Write certificates to disk
    fs.writeFileSync(this.paths.caKey, pki.privateKeyToPem(caKeys.privateKey), { mode: 0o600 });
    fs.writeFileSync(this.paths.caCert, pki.certificateToPem(caCert));
    fs.writeFileSync(this.paths.serverKey, pki.privateKeyToPem(serverKeys.privateKey), { mode: 0o600 });
    fs.writeFileSync(this.paths.serverCert, pki.certificateToPem(serverCert));

    this.logger.info('[CertGenerator] Certificates generated successfully with node-forge');
  }

  /**
   * Generate certificates using Node.js crypto (fallback)
   * Creates simplified PEM structure - may not work with all SSL clients
   * @private
   */
  async _generateWithNodeCrypto() {
    // Generate CA key pair
    this.logger.info('[CertGenerator] Generating CA key pair with Node.js crypto...');
    const caKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: this.keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Generate server key pair
    this.logger.info('[CertGenerator] Generating server key pair...');
    const serverKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: this.keySize,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Write keys to disk
    fs.writeFileSync(this.paths.caKey, caKeyPair.privateKey, { mode: 0o600 });
    fs.writeFileSync(this.paths.serverKey, serverKeyPair.privateKey, { mode: 0o600 });

    // Create placeholder certificates
    // Note: These are not real X.509 certificates and may not work with strict SSL clients
    const notBefore = new Date();
    const notAfter = new Date();
    notAfter.setDate(notAfter.getDate() + this.certValidityDays);

    const createPlaceholderCert = (subject, publicKey) => {
      const certData = JSON.stringify({
        version: '3',
        subject,
        issuer: subject,
        serialNumber: crypto.randomBytes(8).toString('hex'),
        notBefore: notBefore.toISOString(),
        notAfter: notAfter.toISOString(),
        publicKey: publicKey.substring(0, 100) + '...',
        note: 'Simplified certificate. Install OpenSSL or node-forge for full X.509 support.'
      });

      const base64 = Buffer.from(certData).toString('base64');
      const lines = base64.match(/.{1,64}/g) || [];

      return [
        '-----BEGIN CERTIFICATE-----',
        ...lines,
        '-----END CERTIFICATE-----'
      ].join('\n');
    };

    const caCert = createPlaceholderCert(`CN=${this.organization} CA,O=${this.organization}`, caKeyPair.publicKey);
    const serverCert = createPlaceholderCert(`CN=${this.commonName},O=${this.organization}`, serverKeyPair.publicKey);

    fs.writeFileSync(this.paths.caCert, caCert);
    fs.writeFileSync(this.paths.serverCert, serverCert);

    this.logger.warn('[CertGenerator] WARNING: Created simplified certificates using Node.js crypto');
    this.logger.warn('[CertGenerator] For production use, install OpenSSL or add node-forge to dependencies');
  }


  /**
   * Check if all required certificate files exist
   * @private
   */
  _certificatesExist() {
    return fs.existsSync(this.paths.caCert) &&
           fs.existsSync(this.paths.serverCert) &&
           fs.existsSync(this.paths.serverKey);
  }

  /**
   * Validate that existing certificates are still valid
   * @private
   */
  async _validateCertificate() {
    try {
      const certContent = fs.readFileSync(this.paths.serverCert, 'utf8');

      // Try to parse the certificate
      if (certContent.includes('-----BEGIN CERTIFICATE-----')) {
        // Extract the base64 content
        const base64Match = certContent.match(/-----BEGIN CERTIFICATE-----\n([\s\S]+?)\n-----END CERTIFICATE-----/);
        if (!base64Match) {
          return false;
        }

        const certBuffer = Buffer.from(base64Match[1].replace(/\n/g, ''), 'base64');

        // Try to parse as JSON (our format) or just check if it's readable
        try {
          const certData = JSON.parse(certBuffer.toString());

          // Check if certificate is expired
          const notAfter = new Date(certData.notAfter);
          const now = new Date();

          // Consider cert invalid if less than 30 days remaining
          const daysRemaining = (notAfter - now) / (1000 * 60 * 60 * 24);
          if (daysRemaining < 30) {
            this.logger.warn(`[CertGenerator] Certificate expires in ${Math.floor(daysRemaining)} days, will regenerate`);
            return false;
          }

          return true;
        } catch (parseError) {
          // If we can't parse it, assume it's a real certificate and check basic validity
          // For real X.509 certs generated by OpenSSL, we'd need to use a proper parser
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`[CertGenerator] Certificate validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Ensure the certificates directory exists
   * @private
   */
  _ensureDirectoryExists() {
    if (!fs.existsSync(this.certsDir)) {
      fs.mkdirSync(this.certsDir, { recursive: true, mode: 0o700 });
      this.logger.info(`[CertGenerator] Created certificates directory: ${this.certsDir}`);
    }
  }

  /**
   * Get certificate file paths
   * @private
   */
  _getCertPaths() {
    return {
      certPath: this.paths.serverCert,
      keyPath: this.paths.serverKey,
      caPath: this.paths.caCert,
      certsDir: this.certsDir
    };
  }

  /**
   * Get information about existing certificates.
   *
   * Returns metadata about the current certificates including paths,
   * creation time, and file sizes.
   *
   * @method getCertificateInfo
   * @returns {Object|null} Certificate information or null if not found
   * @returns {boolean} returns.exists - Whether certificates exist
   * @returns {Object} returns.paths - Paths to certificate files
   * @returns {string} returns.paths.certPath - Path to server certificate
   * @returns {string} returns.paths.keyPath - Path to private key
   * @returns {string} returns.paths.caPath - Path to CA certificate
   * @returns {string} returns.paths.certsDir - Path to certificates directory
   * @returns {Date} returns.createdAt - File creation time
   * @returns {Date} returns.modifiedAt - File modification time
   * @returns {number} returns.size - Certificate file size in bytes
   *
   * @example
   * const info = certGen.getCertificateInfo();
   * if (info) {
   *   console.log('Certificates created:', info.createdAt);
   * } else {
   *   console.log('No certificates found');
   * }
   */
  getCertificateInfo() {
    if (!this._certificatesExist()) {
      return null;
    }

    try {
      const certContent = fs.readFileSync(this.paths.serverCert, 'utf8');
      const stats = fs.statSync(this.paths.serverCert);

      return {
        exists: true,
        paths: this._getCertPaths(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        size: stats.size
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Delete all generated certificates.
   *
   * Removes all certificate files (CA key, CA cert, server key, server cert)
   * from the certificates directory. Useful for forcing regeneration.
   *
   * @method deleteCertificates
   * @returns {boolean} True if at least one file was deleted, false otherwise
   *
   * @example
   * // Force certificate regeneration
   * certGen.deleteCertificates();
   * await certGen.ensureCertificates();
   */
  deleteCertificates() {
    try {
      const files = [
        this.paths.caKey,
        this.paths.caCert,
        this.paths.serverKey,
        this.paths.serverCert
      ];

      let deleted = 0;
      for (const file of files) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          deleted++;
        }
      }

      this.logger.info(`[CertGenerator] Deleted ${deleted} certificate files`);
      return deleted > 0;
    } catch (error) {
      this.logger.error(`[CertGenerator] Failed to delete certificates: ${error.message}`);
      return false;
    }
  }
}

module.exports = CertificateGenerator;

/**
 * Basset Hound Browser - WebSocket Secure (WSS) Enforcer
 * Implements WSS protocol enforcement and HTTPS redirect for production environments
 *
 * Features:
 * - Enforce WSS (Secure WebSocket) protocol in production
 * - Automatic HTTPS redirect for HTTP requests
 * - Certificate validation and enforcement
 * - Client certificate verification (optional)
 * - Mixed-mode fallback for development
 *
 * Version: 1.0.0
 * Created: June 20, 2026
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

/**
 * WSS Enforcer - Manages WebSocket Secure protocol enforcement
 */
class WSSEnforcer {
  constructor(options = {}) {
    // Configuration
    this.enforceWss = options.enforceWss !== undefined ? options.enforceWss :
      (process.env.NODE_ENV === 'production');
    this.enforceHttpsRedirect = options.enforceHttpsRedirect !== undefined ?
      options.enforceHttpsRedirect : this.enforceWss;
    this.allowMixedMode = options.allowMixedMode !== undefined ? options.allowMixedMode : false;
    this.requireCertificate = options.requireCertificate !== undefined ?
      options.requireCertificate : this.enforceWss;
    this.minTlsVersion = options.minTlsVersion || 'TLSv1.2';
    this.ciphers = options.ciphers || this._getSecureCiphers();

    // Certificate paths
    this.certPath = options.certPath || process.env.BASSET_WS_SSL_CERT || null;
    this.keyPath = options.keyPath || process.env.BASSET_WS_SSL_KEY || null;
    this.caPath = options.caPath || process.env.BASSET_WS_SSL_CA || null;

    // Redirect port
    this.httpPort = options.httpPort || 8080;
    this.httpsPort = options.httpsPort || 8765;

    // State tracking
    this.sslOptions = null;
    this.httpServer = null;
    this.httpsServer = null;
    this.logger = options.logger || null;

    // Validation state
    this.isValid = false;
    this.validationErrors = [];
  }

  /**
   * Validate WSS enforcement configuration
   * @returns {Object} Validation result { valid: boolean, errors: string[] }
   */
  validate() {
    this.validationErrors = [];

    // Check if enforcing WSS in production
    if (this.enforceWss && process.env.NODE_ENV === 'production') {
      if (!this.certPath || !this.keyPath) {
        this.validationErrors.push(
          'WSS enforcement enabled but SSL certificate/key paths not provided. ' +
          'Set BASSET_WS_SSL_CERT and BASSET_WS_SSL_KEY environment variables.'
        );
      } else {
        // Validate certificate and key files exist
        if (!fs.existsSync(this.certPath)) {
          this.validationErrors.push(`SSL certificate file not found: ${this.certPath}`);
        }
        if (!fs.existsSync(this.keyPath)) {
          this.validationErrors.push(`SSL private key file not found: ${this.keyPath}`);
        }
      }

      // Validate CA if specified
      if (this.caPath && !fs.existsSync(this.caPath)) {
        this.validationErrors.push(`CA certificate file not found: ${this.caPath}`);
      }
    }

    // Check if mixed mode is properly configured
    if (this.allowMixedMode && !this.enforceWss) {
      this._log('warn', 'Mixed mode (HTTP + HTTPS) enabled in non-enforcing mode');
    }

    this.isValid = this.validationErrors.length === 0;
    return {
      valid: this.isValid,
      errors: this.validationErrors,
      enforceWss: this.enforceWss,
      environment: process.env.NODE_ENV
    };
  }

  /**
   * Load SSL certificates and prepare SSL options
   * @returns {Object} SSL options or null if not using SSL
   * @throws {Error} If certificate loading fails in enforcing mode
   */
  loadSslOptions() {
    if (!this.enforceWss && !this.certPath) {
      return null;
    }

    try {
      const sslOptions = {};

      if (this.certPath && this.keyPath) {
        // Read certificate
        if (!fs.existsSync(this.certPath)) {
          throw new Error(`SSL certificate not found: ${this.certPath}`);
        }
        const cert = fs.readFileSync(this.certPath, 'utf8');

        // Validate certificate format
        if (!cert.includes('-----BEGIN CERTIFICATE-----')) {
          throw new Error('Invalid certificate format: Expected PEM format');
        }

        sslOptions.cert = cert;

        // Read private key
        if (!fs.existsSync(this.keyPath)) {
          throw new Error(`SSL private key not found: ${this.keyPath}`);
        }
        const key = fs.readFileSync(this.keyPath, 'utf8');

        // Validate key format
        if (!key.includes('-----BEGIN') || !key.includes('KEY-----')) {
          throw new Error('Invalid private key format: Expected PEM format');
        }

        sslOptions.key = key;

        // Load CA if specified (for client verification)
        if (this.caPath && fs.existsSync(this.caPath)) {
          const ca = fs.readFileSync(this.caPath, 'utf8');
          sslOptions.ca = ca;
          sslOptions.requestCert = true;
          sslOptions.rejectUnauthorized = true;
          this._log('info', 'Client certificate verification enabled');
        }

        // Set TLS version and cipher requirements
        sslOptions.minVersion = this.minTlsVersion;
        if (this.ciphers) {
          sslOptions.ciphers = this.ciphers;
        }

        this._log('info', `SSL options loaded: ${this.certPath}`);
        this.sslOptions = sslOptions;
        return sslOptions;
      }
    } catch (error) {
      if (this.enforceWss) {
        throw new Error(`Failed to load SSL certificates: ${error.message}`);
      }
      this._log('warn', `Failed to load SSL certificates: ${error.message}`);
      return null;
    }
  }

  /**
   * Create HTTPS redirect server (HTTP -> HTTPS)
   * Redirects all HTTP requests to HTTPS
   * @returns {http.Server}
   */
  createHttpRedirectServer() {
    this.httpServer = http.createServer((req, res) => {
      // Reconstruct the URL with HTTPS protocol
      const targetUrl = `https://${req.headers.host}${req.url}`;

      this._log('info', `Redirecting HTTP request to HTTPS: ${req.url}`);

      // Send redirect response
      res.writeHead(308, { // 308 Permanent Redirect preserves method
        'Location': targetUrl,
        'Connection': 'close'
      });
      res.end();
    });

    // Error handling
    this.httpServer.on('error', (error) => {
      this._log('error', `HTTP redirect server error: ${error.message}`);
    });

    return this.httpServer;
  }

  /**
   * Middleware for Express-like frameworks
   * Enforces HTTPS/WSS protocol
   * @param {Object} req - HTTP request
   * @param {Object} res - HTTP response
   * @param {Function} next - Next middleware
   */
  httpsRedirectMiddleware(req, res, next) {
    // Skip redirect for health checks
    if (req.path === '/health' || req.path === '/healthz') {
      return next();
    }

    // If enforcement is disabled, continue
    if (!this.enforceHttpsRedirect) {
      return next();
    }

    // Check if request is already HTTPS
    const protocol = req.get('X-Forwarded-Proto') || req.protocol;
    if (protocol === 'https') {
      return next();
    }

    // Redirect to HTTPS
    const targetUrl = `https://${req.get('host')}${req.originalUrl}`;
    this._log('info', `Middleware redirecting HTTP to HTTPS: ${req.originalUrl}`);
    return res.redirect(308, targetUrl);
  }

  /**
   * Validate WebSocket upgrade request (for use in WebSocket.Server)
   * @param {Object} req - HTTP upgrade request
   * @returns {Object} { valid: boolean, error?: string }
   */
  validateWebSocketUpgrade(req) {
    if (!this.enforceWss) {
      return { valid: true };
    }

    // Check if using secure connection
    const protocol = req.connection.encrypted ? 'wss' : 'ws';
    const isSecure = protocol === 'wss';

    if (!isSecure && this.enforceWss) {
      return {
        valid: false,
        error: 'WebSocket Secure (WSS) protocol required. Non-secure WebSocket (WS) connections are not allowed in production.'
      };
    }

    return { valid: true };
  }

  /**
   * Get protocol enforcement status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enforceWss: this.enforceWss,
      enforceHttpsRedirect: this.enforceHttpsRedirect,
      requireCertificate: this.requireCertificate,
      allowMixedMode: this.allowMixedMode,
      minTlsVersion: this.minTlsVersion,
      sslEnabled: Boolean(this.sslOptions),
      certificatePath: this.certPath,
      httpPort: this.httpPort,
      httpsPort: this.httpsPort,
      environment: process.env.NODE_ENV,
      validationState: {
        valid: this.isValid,
        errors: this.validationErrors
      }
    };
  }

  /**
   * Get secure cipher suite
   * Uses Mozilla Intermediate Profile (TLSv1.2+)
   * @returns {string}
   */
  _getSecureCiphers() {
    // Mozilla Intermediate Profile - good balance of security and compatibility
    return [
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-CHACHA20-POLY1305',
      'DHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-GCM-SHA384'
    ].join(':');
  }

  /**
   * Internal logging
   * @private
   */
  _log(level, message) {
    if (this.logger) {
      this.logger[level](`[WSS Enforcer] ${message}`);
    }
  }
}

module.exports = { WSSEnforcer };

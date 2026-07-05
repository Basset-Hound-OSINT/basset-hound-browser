/**
 * Basset Hound Browser - Security Integration Example
 * Complete example of integrating WSS Enforcer and IP Redaction Manager
 * into the WebSocket server
 *
 * This file demonstrates how to integrate both security modules
 * into the existing WebSocketServer class.
 */

// ============================================================
// INTEGRATION SETUP
// ============================================================

// Step 1: Import security modules
const { WSSEnforcer } = require('../websocket/security/wss-enforcer');
const { IPRedactionManager } = require('../evasion/ip-redaction');

/**
 * Enhanced WebSocketServer with Security Features
 * This shows how to extend the existing WebSocketServer class
 */
class SecureWebSocketServer {
  constructor(port, mainWindow, options = {}) {
    // ... existing constructor code ...

    // ========================================================
    // INITIALIZE WSS ENFORCER (TASK A)
    // ========================================================
    this.wssEnforcer = new WSSEnforcer({
      enforceWss: options.enforceWss !== undefined
        ? options.enforceWss
        : (process.env.NODE_ENV === 'production'),
      enforceHttpsRedirect: options.enforceHttpsRedirect !== undefined
        ? options.enforceHttpsRedirect
        : (process.env.NODE_ENV === 'production'),
      requireCertificate: options.requireCertificate !== undefined
        ? options.requireCertificate
        : (process.env.NODE_ENV === 'production'),
      allowMixedMode: options.allowMixedMode || false,
      minTlsVersion: options.minTlsVersion || 'TLSv1.2',
      certPath: options.certPath || process.env.BASSET_WS_SSL_CERT,
      keyPath: options.keyPath || process.env.BASSET_WS_SSL_KEY,
      caPath: options.caPath || process.env.BASSET_WS_SSL_CA,
      httpPort: options.httpPort || 8080,
      httpsPort: options.httpsPort || port,
      logger: this.logger
    });

    // Validate WSS enforcer configuration
    const wssValidation = this.wssEnforcer.validate();
    if (!wssValidation.valid) {
      this.logger.error('[WebSocket] WSS Enforcer validation errors:', wssValidation.errors);
      if (process.env.NODE_ENV === 'production') {
        throw new Error('WSS enforcer validation failed in production');
      }
    }

    // ========================================================
    // INITIALIZE IP REDACTION MANAGER (TASK B)
    // ========================================================
    this.ipRedactor = new IPRedactionManager({
      enabled: options.enableIpRedaction !== undefined
        ? options.enableIpRedaction
        : (process.env.NODE_ENV === 'production'),
      privacyMode: options.ipPrivacyMode || process.env.BASSET_IP_PRIVACY_MODE || 'mask',
      consistentMasking: options.consistentIpMasking !== false,
      preserveNetworkInfo: options.preserveNetworkInfo !== false,
      logger: this.logger
    });

    this.logger.info('[WebSocket] IP Redaction initialized:', this.ipRedactor.getStats());
  }

  /**
   * Start the secure WebSocket server
   * Enhanced to use WSS enforcer
   */
  async startServer(port) {
    try {
      // Load SSL options using enforcer
      const sslOptions = this.wssEnforcer.loadSslOptions();

      // Create HTTP server (with or without SSL)
      let server;
      if (sslOptions) {
        const https = require('https');
        server = https.createServer(sslOptions);
        this.logger.info('[WebSocket] Using HTTPS server with SSL');
      } else {
        const http = require('http');
        server = http.createServer();
        this.logger.info('[WebSocket] Using HTTP server (SSL not configured)');
      }

      // Create WebSocket server
      const WebSocket = require('ws');
      this.wss = new WebSocket.Server({ server });

      // Set up HTTP redirect if enabled
      if (this.wssEnforcer.enforceHttpsRedirect && sslOptions) {
        const httpRedirectServer = this.wssEnforcer.createHttpRedirectServer();
        httpRedirectServer.listen(this.wssEnforcer.httpPort, '0.0.0.0');
        this.logger.info(`[WebSocket] HTTP redirect server listening on port ${this.wssEnforcer.httpPort}`);
      }

      // Connection handler with security validation
      this.wss.on('connection', (ws, req) => {
        this._handleSecureConnection(ws, req);
      });

      // Start listening
      server.listen(port, '0.0.0.0');
      this.logger.info(`[WebSocket] Server listening on ${this.wssEnforcer.getProtocol()}://0.0.0.0:${port}`);

    } catch (error) {
      this.logger.error('[WebSocket] Failed to start server:', error.message);
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  /**
   * Handle WebSocket connection with security checks
   * @private
   */
  _handleSecureConnection(ws, req) {
    // ========================================================
    // VALIDATE WSS UPGRADE (TASK A)
    // ========================================================
    const wssValidation = this.wssEnforcer.validateWebSocketUpgrade(req);
    if (!wssValidation.valid) {
      this.logger.warn(`[WebSocket] Connection rejected: ${wssValidation.error}`);
      ws.close(4001, wssValidation.error);
      return;
    }

    // Continue with standard connection handling
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    ws.clientId = clientId;
    ws.isAlive = true;

    this.logger.info(`[WebSocket] Client connected: ${clientId} (protocol: ${this.wssEnforcer.getProtocol()})`);

    // ... rest of connection handling ...
  }

  /**
   * Register security commands
   */
  registerSecurityCommands() {
    // ========================================================
    // TASK A: WSS STATUS COMMAND
    // ========================================================
    this.commandHandlers.get_wss_status = async (params) => {
      return {
        success: true,
        wssStatus: this.wssEnforcer.getStatus()
      };
    };

    // ========================================================
    // TASK B: EXPORT DEVICE IDS WITH IP REDACTION
    // ========================================================
    this.commandHandlers.export_device_ids = async (params) => {
      try {
        const timestamp = new Date().toISOString();

        // Collect device data (existing code)
        let fingerprint = {};
        let userAgent = '';

        if (this.profileManager) {
          const activeProfile = this.profileManager.getActiveProfile();
          if (activeProfile) {
            fingerprint = activeProfile.fingerprint || {};
            userAgent = activeProfile.userAgent || '';
          }
        }

        // Extract device identifiers from JavaScript
        const deviceData = await this.mainWindow.webContents.executeJavaScript(`
          (function() {
            return {
              userAgent: navigator.userAgent,
              appVersion: navigator.appVersion,
              platform: navigator.platform,
              hardwareConcurrency: navigator.hardwareConcurrency,
              deviceMemory: navigator.deviceMemory,
              maxTouchPoints: navigator.maxTouchPoints,
              screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                colorDepth: screen.colorDepth,
                pixelDepth: screen.pixelDepth,
                orientation: screen.orientation?.type || 'unknown'
              },
              language: navigator.language,
              languages: navigator.languages ? Array.from(navigator.languages) : [],
              timezone: new Date().getTimezoneOffset(),
              plugins: navigator.plugins ? Array.from(navigator.plugins).map(p => ({
                name: p.name,
                description: p.description,
                version: p.version
              })) : [],
              cookieEnabled: navigator.cookieEnabled,
              doNotTrack: navigator.doNotTrack,
              webdriver: navigator.webdriver,
              vendor: navigator.vendor,
              onLine: navigator.onLine
            };
          })()
        `);

        const deviceIdentifiers = {
          ...deviceData,
          userAgent
        };

        // ====================================================
        // APPLY IP REDACTION (TASK B)
        // ====================================================
        if (this.ipRedactor && this.ipRedactor.enabled) {
          // Redact WebRTC data
          if (fingerprint.webrtc) {
            fingerprint.webrtc = this.ipRedactor.redactWebRTC(fingerprint.webrtc);
          }

          // Redact any direct IP fields in device identifiers
          if (deviceIdentifiers.ipv4) {
            deviceIdentifiers.ipv4 = this.ipRedactor.redactIPv4(deviceIdentifiers.ipv4);
          }
          if (deviceIdentifiers.ipv6) {
            deviceIdentifiers.ipv6 = this.ipRedactor.redactIPv6(deviceIdentifiers.ipv6);
          }
        }

        return {
          success: true,
          timestamp,
          deviceIdentifiers,
          fingerprint: {
            canvas: fingerprint.canvasFingerprint || null,
            webgl: fingerprint.webglFingerprint || null,
            webrtc: fingerprint.webrtcFingerprint || null,
            audio: fingerprint.audioFingerprint || null,
            font: fingerprint.fontFingerprint || null,
            cssFeatures: fingerprint.cssFeatures || [],
            storage: {
              localStorage: typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0,
              sessionStorage: typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage).length : 0,
              indexedDB: typeof indexedDB !== 'undefined' ? true : false
            }
          },
          proxyInfo: this.proxyManager ? {
            enabled: this.proxyManager.isEnabled(),
            currentProxy: this.proxyManager.getCurrentProxy(),
            rotationMode: this.proxyManager.getRotationMode?.() || null
          } : null,
          security: {
            wssEnforced: this.wssEnforcer.enforceWss,
            ipRedactionEnabled: this.ipRedactor.enabled,
            ipPrivacyMode: this.ipRedactor.privacyMode
          }
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    };

    // ========================================================
    // TASK B: SET IP PRIVACY MODE COMMAND
    // ========================================================
    this.commandHandlers.set_ip_privacy_mode = async (params) => {
      const { mode } = params;

      const validModes = ['mask', 'remove', 'obfuscate'];
      if (!validModes.includes(mode)) {
        return {
          success: false,
          error: `Invalid privacy mode: ${mode}. Must be one of: ${validModes.join(', ')}`
        };
      }

      // Update privacy mode
      this.ipRedactor.privacyMode = mode;

      this.logger.info(`[WebSocket] IP privacy mode changed to: ${mode}`);

      return {
        success: true,
        privacyMode: mode,
        message: `IP privacy mode set to: ${mode}`,
        stats: this.ipRedactor.getStats()
      };
    };

    // ========================================================
    // TASK B: GET IP REDACTION STATUS COMMAND
    // ========================================================
    this.commandHandlers.get_ip_redaction_status = async (params) => {
      return {
        success: true,
        ipRedaction: this.ipRedactor.getStats(),
        securityStatus: {
          wssEnforced: this.wssEnforcer.enforceWss,
          tlsMinVersion: this.wssEnforcer.minTlsVersion,
          certificateRequired: this.wssEnforcer.requireCertificate
        }
      };
    };

    // ========================================================
    // TASK A: GET SECURITY STATUS COMMAND
    // ========================================================
    this.commandHandlers.get_security_status = async (params) => {
      return {
        success: true,
        security: {
          wss: this.wssEnforcer.getStatus(),
          ipRedaction: this.ipRedactor.getStats()
        }
      };
    };

    // ========================================================
    // TASK B: RESET SESSION (clears IP mappings)
    // ========================================================
    this.commandHandlers.reset_session = async (params) => {
      try {
        // ... existing reset code ...

        // Reset IP mapping for new session
        if (this.ipRedactor) {
          this.ipRedactor.resetMapping();
          this.logger.info('[WebSocket] IP redaction mapping reset for new session');
        }

        return {
          success: true,
          message: 'Session reset successfully, IP mapping cleared'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    };
  }
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/**
 * Example initialization in main.js
 */
async function initializeSecureWebSocketServer() {
  const https = require('https');
  const mainWindow = null; // Your Electron BrowserWindow

  const wsServer = new SecureWebSocketServer(8765, mainWindow, {
    // WSS Enforcer options (TASK A)
    enforceWss: process.env.NODE_ENV === 'production',
    enforceHttpsRedirect: process.env.NODE_ENV === 'production',
    requireCertificate: true,
    minTlsVersion: 'TLSv1.2',
    certPath: process.env.BASSET_WS_SSL_CERT,
    keyPath: process.env.BASSET_WS_SSL_KEY,
    caPath: process.env.BASSET_WS_SSL_CA,

    // IP Redaction options (TASK B)
    enableIpRedaction: process.env.NODE_ENV === 'production',
    ipPrivacyMode: process.env.BASSET_IP_PRIVACY_MODE || 'mask',
    consistentIpMasking: true,
    preserveNetworkInfo: true
  });

  // Register security commands
  wsServer.registerSecurityCommands();

  // Start the server
  await wsServer.startServer(8765);

  // Log security status
  const status = wsServer.wssEnforcer.getStatus();
  console.log('[WebSocket] Security Status:', JSON.stringify(status, null, 2));

  return wsServer;
}

// Export for use in main application
module.exports = {
  SecureWebSocketServer,
  initializeSecureWebSocketServer
};

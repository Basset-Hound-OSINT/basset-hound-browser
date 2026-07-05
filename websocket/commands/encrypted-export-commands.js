/**
 * Encrypted Export Commands
 *
 * WebSocket commands for encrypted export functionality
 * Integrates EncryptedExportManager with export_raw_html and export_network_log
 *
 * Commands:
 * - encrypt_export: Encrypt arbitrary data
 * - decrypt_export: Decrypt exported data
 * - export_raw_html_encrypted: Export HTML with optional encryption
 * - export_network_log_encrypted: Export network logs with optional encryption
 * - generate_export_key: Generate encryption key
 * - derive_export_key: Derive key from password
 * - get_encryption_stats: Get performance statistics
 *
 * @module encrypted-export-commands
 */

const { EncryptedExportManager } = require('../../extraction/encrypted-export-manager');

/**
 * Register encrypted export commands with WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} managers - Manager instances (networkAnalysisManager, etc.)
 */
function registerEncryptedExportCommands(server, managers = {}) {
  if (!server || !server.commandHandlers) {
    throw new Error('Invalid server instance');
  }

  // Initialize the encryption manager
  const encryptionManager = new EncryptedExportManager();

  /**
   * Generate encryption key
   * POST /generate_export_key
   *
   * @param {Object} params - Parameters
   * @param {number} params.keyLength - Key length in bytes (default: 32 for AES-256)
   * @returns {Object} { key: string (base64), keyLength: number, timestamp: string }
   */
  server.commandHandlers.generate_export_key = async (params = {}) => {
    try {
      const keyLength = params.keyLength || 32;
      const key = encryptionManager.generateKey(keyLength);

      return {
        success: true,
        key: key.toString('base64'),
        keyLength,
        algorithm: 'aes-256-gcm',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Derive encryption key from password
   * POST /derive_export_key
   *
   * @param {Object} params - Parameters
   * @param {string} params.password - Password to derive from
   * @param {string} params.salt - Optional base64-encoded salt
   * @returns {Object} { key: string (base64), salt: string (base64), iterations: number }
   */
  server.commandHandlers.derive_export_key = async (params = {}) => {
    try {
      if (!params.password) {
        return {
          success: false,
          error: 'Password is required',
          timestamp: new Date().toISOString()
        };
      }

      let salt = null;
      if (params.salt) {
        salt = Buffer.from(params.salt, 'base64');
      }

      const result = encryptionManager.deriveKey(params.password, salt);

      return {
        success: true,
        key: result.key.toString('base64'),
        salt: result.salt.toString('base64'),
        iterations: result.iterations,
        algorithm: result.algorithm,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Encrypt arbitrary data
   * POST /encrypt_export
   *
   * @param {Object} params - Parameters
   * @param {string} params.data - Data to encrypt
   * @param {string} params.password - Password (for password-based encryption)
   * @param {string} params.key - Base64-encoded key (for key-based encryption)
   * @param {boolean} params.useHmac - Include HMAC verification (optional)
   * @returns {Object} { encrypted: string (base64), iv: string, authTag: string, salt: string, ... }
   */
  server.commandHandlers.encrypt_export = async (params = {}) => {
    try {
      if (!params.data) {
        return {
          success: false,
          error: 'Data to encrypt is required',
          timestamp: new Date().toISOString()
        };
      }

      if (!params.password && !params.key) {
        return {
          success: false,
          error: 'Either password or key is required',
          timestamp: new Date().toISOString()
        };
      }

      // Determine encryption key/password
      let passwordOrKey;
      if (params.password) {
        passwordOrKey = params.password;
      } else {
        passwordOrKey = Buffer.from(params.key, 'base64');
      }

      // Encrypt
      const encrypted = encryptionManager.encryptExport(params.data, passwordOrKey);

      // Optionally add HMAC
      let hmac = null;
      let hmacKey = null;
      if (params.useHmac) {
        const hmacResult = encryptionManager.encryptExportWithHmac(params.data, passwordOrKey);
        hmac = hmacResult.hmac.toString('base64');
        hmacKey = hmacResult.hmacKey.toString('base64');
      }

      return {
        success: true,
        encrypted: encrypted.encrypted.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        salt: encrypted.salt ? encrypted.salt.toString('base64') : null,
        originalSize: encrypted.originalSize,
        encryptedSize: encrypted.encryptedSize,
        encryptionTime: encrypted.encryptionTime,
        compressionRatio: encrypted.compressionRatio,
        isPasswordBased: encrypted.isPasswordBased,
        hmac: hmac,
        hmacKey: hmacKey,
        timestamp: encrypted.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Decrypt exported data
   * POST /decrypt_export
   *
   * @param {Object} params - Parameters
   * @param {string} params.encrypted - Base64-encoded encrypted data (full buffer with header/IV/salt)
   * @param {string} params.password - Password (for password-based decryption)
   * @param {string} params.key - Base64-encoded key (for key-based decryption)
   * @param {string} params.hmac - Base64-encoded HMAC (optional)
   * @param {string} params.hmacKey - Base64-encoded HMAC key (optional)
   * @returns {Object} { data: string, originalSize: number, decryptionTime: number, ... }
   */
  server.commandHandlers.decrypt_export = async (params = {}) => {
    try {
      if (!params.encrypted) {
        return {
          success: false,
          error: 'Encrypted data is required',
          timestamp: new Date().toISOString()
        };
      }

      if (!params.password && !params.key) {
        return {
          success: false,
          error: 'Either password or key is required',
          timestamp: new Date().toISOString()
        };
      }

      // Convert encrypted data from base64
      const encryptedBuffer = Buffer.from(params.encrypted, 'base64');

      // Determine decryption key/password
      let passwordOrKey;
      if (params.password) {
        passwordOrKey = params.password;
      } else {
        passwordOrKey = Buffer.from(params.key, 'base64');
      }

      // Verify HMAC if provided
      if (params.hmac && params.hmacKey) {
        try {
          const hmac = Buffer.from(params.hmac, 'base64');
          const hmacKey = Buffer.from(params.hmacKey, 'base64');
          encryptionManager.verifyHmac(encryptedBuffer, hmac, hmacKey);
        } catch (hmacError) {
          return {
            success: false,
            error: `HMAC verification failed: ${hmacError.message}`,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Decrypt
      const decrypted = encryptionManager.decryptExport(encryptedBuffer, passwordOrKey);

      return {
        success: true,
        data: decrypted.data,
        originalSize: decrypted.originalSize,
        decryptionTime: decrypted.decryptionTime,
        integrityVerified: decrypted.integrityVerified,
        isPasswordBased: decrypted.isPasswordBased,
        timestamp: decrypted.timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export raw HTML with optional encryption
   * POST /export_raw_html_encrypted
   *
   * Enhanced version of export_raw_html with encryption support
   * If password or key provided, data is encrypted
   *
   * @param {Object} params - Parameters
   * @param {string} params.password - Password for encryption (optional)
   * @param {string} params.key - Base64-encoded key (optional)
   * @param {boolean} params.encrypt - Force encryption (default: auto)
   * @param {boolean} params.useHmac - Include HMAC (optional)
   * @returns {Object} { success: boolean, html: string, encrypted: Buffer, ... }
   */
  server.commandHandlers.export_raw_html_encrypted = async (params = {}) => {
    try {
      if (!server.mainWindow || !server.mainWindow.webContents) {
        return {
          success: false,
          error: 'Window or webContents not available',
          timestamp: new Date().toISOString()
        };
      }

      // Get basic export data (from standard export_raw_html)
      const timestamp = new Date().toISOString();
      const currentUrl = await server.mainWindow.webContents.executeJavaScript(
        'window.location.href'
      );
      const html = await server.mainWindow.webContents.executeJavaScript(
        'document.documentElement.outerHTML'
      );

      // Get response headers if available
      let responseHeaders = {};
      let statusCode = 200;

      if (managers.networkAnalysisManager) {
        const requests = managers.networkAnalysisManager.requestTracker?.requests || new Map();
        for (const [, request] of requests) {
          if (request.resourceType === 'xhr' || request.resourceType === 'fetch') {
            continue;
          }
          if (request.url === currentUrl || request.url.split('?')[0] === currentUrl.split('?')[0]) {
            if (request.responseHeaders) {
              responseHeaders = request.responseHeaders;
            }
            if (request.statusCode) {
              statusCode = request.statusCode;
            }
            break;
          }
        }
      }

      const htmlExport = {
        url: currentUrl,
        statusCode,
        responseHeaders,
        html,
        timestamp,
        htmlLength: html.length,
        contentType: responseHeaders['content-type'] || 'text/html'
      };

      // Check if encryption is requested
      const shouldEncrypt = params.encrypt || params.password || params.key;

      if (!shouldEncrypt) {
        return {
          success: true,
          ...htmlExport,
          encrypted: false
        };
      }

      // Encrypt if requested
      if (!params.password && !params.key) {
        return {
          success: false,
          error: 'Encryption requested but no password or key provided',
          timestamp: new Date().toISOString()
        };
      }

      // Determine encryption key/password
      let passwordOrKey;
      if (params.password) {
        passwordOrKey = params.password;
      } else {
        passwordOrKey = Buffer.from(params.key, 'base64');
      }

      // Encrypt the full export
      const htmlString = JSON.stringify(htmlExport);
      const encrypted = encryptionManager.encryptExport(htmlString, passwordOrKey);

      return {
        success: true,
        encrypted: true,
        encryptedData: encrypted.encrypted.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        salt: encrypted.salt ? encrypted.salt.toString('base64') : null,
        isPasswordBased: encrypted.isPasswordBased,
        originalSize: encrypted.originalSize,
        encryptedSize: encrypted.encryptedSize,
        encryptionTime: encrypted.encryptionTime,
        timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export network log with optional encryption
   * POST /export_network_log_encrypted
   *
   * Enhanced version of export_network_log with encryption support
   *
   * @param {Object} params - Parameters
   * @param {string} params.format - Export format ('json', 'har')
   * @param {string} params.password - Password for encryption (optional)
   * @param {string} params.key - Base64-encoded key (optional)
   * @param {boolean} params.encrypt - Force encryption
   * @returns {Object} { success: boolean, encrypted: Buffer, ... }
   */
  server.commandHandlers.export_network_log_encrypted = async (params = {}) => {
    try {
      if (!managers.networkAnalysisManager) {
        return {
          success: false,
          error: 'Network analysis manager not available',
          timestamp: new Date().toISOString()
        };
      }

      // Get basic network export
      const timestamp = new Date().toISOString();
      const baseExport = managers.networkAnalysisManager.exportCapture();
      const format = params.format || 'json';

      // Check if encryption is requested
      const shouldEncrypt = params.encrypt || params.password || params.key;

      if (!shouldEncrypt) {
        return {
          success: true,
          ...baseExport,
          encrypted: false
        };
      }

      // Encryption requested
      if (!params.password && !params.key) {
        return {
          success: false,
          error: 'Encryption requested but no password or key provided',
          timestamp: new Date().toISOString()
        };
      }

      // Determine encryption key/password
      let passwordOrKey;
      if (params.password) {
        passwordOrKey = params.password;
      } else {
        passwordOrKey = Buffer.from(params.key, 'base64');
      }

      // Encrypt the full export
      const logString = JSON.stringify(baseExport);
      const encrypted = encryptionManager.encryptExport(logString, passwordOrKey);

      return {
        success: true,
        encrypted: true,
        encryptedData: encrypted.encrypted.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        salt: encrypted.salt ? encrypted.salt.toString('base64') : null,
        isPasswordBased: encrypted.isPasswordBased,
        originalSize: encrypted.originalSize,
        encryptedSize: encrypted.encryptedSize,
        encryptionTime: encrypted.encryptionTime,
        format,
        timestamp
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Get encryption performance statistics
   * GET /get_encryption_stats
   *
   * @returns {Object} Performance metrics
   */
  server.commandHandlers.get_encryption_stats = async (params = {}) => {
    try {
      const stats = encryptionManager.getPerformanceStats();

      return {
        success: true,
        stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Reset encryption statistics
   * POST /reset_encryption_stats
   *
   * @returns {Object} Reset confirmation
   */
  server.commandHandlers.reset_encryption_stats = async (params = {}) => {
    try {
      encryptionManager.resetStats();

      return {
        success: true,
        message: 'Encryption statistics reset',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  // Setup event listeners for monitoring
  encryptionManager.on('error', (event) => {
    if (server.debugManager) {
      server.debugManager.log(`Encryption Error: ${event.operation} - ${event.error}`);
    }
  });

  encryptionManager.on('performanceWarning', (warning) => {
    if (server.debugManager) {
      server.debugManager.log(
        `Performance Warning: ${warning.operation} took ${warning.actualTime.toFixed(2)}ms ` +
        `(target: ${warning.targetTime}ms, size: ${warning.dataSize} bytes)`
      );
    }
  });

  // Expose encryption manager for other modules
  server.encryptionManager = encryptionManager;

  return encryptionManager;
}

module.exports = {
  registerEncryptedExportCommands
};

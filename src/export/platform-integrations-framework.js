/**
 * Basset Hound Browser - Platform Integration Framework
 * Base class and interface for platform exports
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Base class for platform integrations
 * Provides common functionality for authenticating and exporting to platforms
 */
class PlatformIntegration {
  /**
   * Constructor for platform integration
   * @param {string} platformName - Name of the platform (shodan, maltego, misp, etc.)
   * @param {object} config - Platform configuration
   */
  constructor(platformName, config = {}) {
    this.platformName = platformName;
    this.apiKey = config.apiKey || null;
    this.apiSecret = config.apiSecret || null;
    this.apiUrl = config.apiUrl || null;
    this.webhookUrl = config.webhookUrl || null;
    this.exports = []; // Track all exports
    this.credentials = {}; // Store encrypted credentials
    this.config = config;
  }

  /**
   * Authenticate with the platform
   * @param {string} apiKey - API key/token
   * @param {string} apiSecret - Optional API secret
   * @returns {Promise<object>} Authentication result
   */
  async authenticate(apiKey, apiSecret = null) {
    try {
      if (!apiKey) {
        throw new Error('API key is required for authentication');
      }

      this.apiKey = apiKey;
      if (apiSecret) {
        this.apiSecret = apiSecret;
      }

      // Store credentials securely (basic encryption)
      this.credentials = {
        apiKey: this._encryptCredential(apiKey),
        apiSecret: apiSecret ? this._encryptCredential(apiSecret) : null,
        authenticatedAt: new Date().toISOString()
      };

      return {
        success: true,
        platform: this.platformName,
        message: `Successfully authenticated with ${this.platformName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        platform: this.platformName
      };
    }
  }

  /**
   * Export data to the platform
   * Must be implemented by subclasses
   * @param {object} data - Data to export
   * @param {object} options - Export options
   * @returns {Promise<object>} Export result
   */
  async export(data, options = {}) {
    throw new Error(`export() must be implemented by ${this.constructor.name}`);
  }

  /**
   * List previous exports for this platform
   * @returns {Promise<array>} Array of previous exports
   */
  async listExports() {
    try {
      return {
        platform: this.platformName,
        exports: this.exports.map(e => ({
          id: e.id,
          timestamp: e.timestamp,
          itemCount: e.itemCount,
          status: e.status,
          url: e.url || null
        }))
      };
    } catch (error) {
      return {
        error: error.message,
        platform: this.platformName
      };
    }
  }

  /**
   * Setup webhook for real-time notifications
   * @param {string} webhookUrl - Webhook URL to send notifications to
   * @param {object} options - Webhook options
   * @returns {Promise<object>} Setup result
   */
  async setupWebhook(webhookUrl, options = {}) {
    try {
      if (!webhookUrl) {
        throw new Error('Webhook URL is required');
      }

      this.webhookUrl = webhookUrl;

      // Validate webhook URL
      if (!this._isValidUrl(webhookUrl)) {
        throw new Error('Invalid webhook URL format');
      }

      return {
        success: true,
        platform: this.platformName,
        webhookUrl,
        message: `Webhook registered for ${this.platformName}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        platform: this.platformName
      };
    }
  }

  /**
   * Send webhook notification
   * @param {object} payload - Payload to send
   * @param {object} options - Send options
   * @returns {Promise<object>} Send result
   */
  async sendWebhookNotification(payload, options = {}) {
    if (!this.webhookUrl) {
      return {
        success: false,
        error: 'Webhook not configured',
        platform: this.platformName
      };
    }

    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Basset-Hound-Browser/1.0'
          },
          body: JSON.stringify(payload),
          timeout: 5000
        });

        if (response.ok) {
          return {
            success: true,
            platform: this.platformName,
            statusCode: response.status,
            timestamp: new Date().toISOString()
          };
        } else if (attempt < maxRetries - 1) {
          // Retry on server errors
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        if (attempt === maxRetries - 1) {
          return {
            success: false,
            error: error.message,
            platform: this.platformName,
            attempt: attempt + 1
          };
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  /**
   * Track an export for record-keeping
   * @private
   */
  _trackExport(exportData) {
    const exportRecord = {
      id: this._generateId(),
      timestamp: new Date().toISOString(),
      itemCount: exportData.count || 0,
      status: 'success',
      dataSize: JSON.stringify(exportData).length,
      url: exportData.url || null
    };

    this.exports.push(exportRecord);
    return exportRecord;
  }

  /**
   * Encrypt sensitive credential data
   * @private
   */
  _encryptCredential(credential) {
    // Basic encryption - in production, use proper encryption
    return Buffer.from(credential).toString('base64');
  }

  /**
   * Decrypt sensitive credential data
   * @private
   */
  _decryptCredential(encrypted) {
    // Basic decryption - in production, use proper decryption
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  }

  /**
   * Generate unique ID for exports
   * Uses 16 bytes (128 bits) of entropy for platform IDs
   * @private
   */
  _generateId() {
    return `${this.platformName}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Validate URL format
   * @private
   */
  _isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract headers from network data
   * @protected
   */
  extractHeaders(networkData) {
    if (!networkData || !networkData.headers) {
      return {};
    }

    const headers = {};
    if (networkData.headers.response) {
      Object.assign(headers, networkData.headers.response);
    }
    return headers;
  }

  /**
   * Sanitize data for export
   * @protected
   */
  sanitizeData(data) {
    // Remove sensitive information before export
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove password fields
    ['password', 'token', 'secret', 'apiKey', 'apiSecret'].forEach(field => {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    });

    return sanitized;
  }

  /**
   * Format confidence score (0-1) to percentage (0-100)
   * @protected
   */
  formatConfidence(confidence) {
    if (typeof confidence !== 'number') {
      return 100;
    }
    return Math.round(Math.min(100, Math.max(0, confidence * 100)));
  }

  /**
   * Format timestamp
   * @protected
   */
  formatTimestamp(date = new Date()) {
    return date.toISOString();
  }

  /**
   * Validate required fields
   * @protected
   */
  validateRequired(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }
}

module.exports = {
  PlatformIntegration
};

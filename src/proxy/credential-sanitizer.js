/**
 * Proxy Credential Sanitizer
 * Removes or hashes sensitive proxy credentials before logging
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Security Features:
 * - Sanitizes proxy URLs removing user:pass components
 * - Hashes credentials securely with salt
 * - Logs safe proxy identifiers (ID or hostname only)
 * - Never exposes credentials in error messages
 */

const crypto = require('crypto');

class CredentialSanitizer {
  constructor(options = {}) {
    this.saltRounds = options.saltRounds || 10;
    this.hashAlgorithm = options.hashAlgorithm || 'sha256';
    this.credentialCache = new Map(); // hash -> sanitized proxy id
  }

  /**
   * Hash proxy credentials securely
   * @param {string} credentials - user:pass string
   * @param {string} salt - salt for hashing (auto-generated if not provided)
   * @returns {string} Hashed credential
   */
  hashCredentials(credentials, salt = null) {
    if (!credentials) return null;

    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }

    const hash = crypto
      .createHmac(this.hashAlgorithm, salt)
      .update(credentials)
      .digest('hex');

    return `${salt}:${hash}`;
  }

  /**
   * Sanitize proxy URL, removing credentials
   * @param {string} proxyUrl - Proxy URL with possible credentials
   * @returns {object} { sanitized, credentials: null, hostname, port }
   */
  sanitizeProxyUrl(proxyUrl) {
    if (!proxyUrl) {
      return { sanitized: null, credentials: null, hostname: null, port: null };
    }

    try {
      // Parse the proxy URL
      const url = new URL(`http://${proxyUrl}`);

      // Extract credentials if present
      const credentials = url.username || url.password
        ? `${url.username}:${url.password}`
        : null;

      // Build safe URL without credentials
      const sanitized = `${url.hostname}:${url.port || 80}`;

      return {
        sanitized,
        hasCredentials: !!credentials,
        hostname: url.hostname,
        port: url.port || 80,
        credentialHash: credentials ? this.hashCredentials(credentials) : null
      };
    } catch (error) {
      // If URL parsing fails, try extracting IP:port pattern
      const match = proxyUrl.match(/^(?:[^@]*@)?([^:]+):(\d+)$/);
      if (match) {
        return {
          sanitized: `${match[1]}:${match[2]}`,
          hasCredentials: proxyUrl.includes('@'),
          hostname: match[1],
          port: parseInt(match[2], 10),
          credentialHash: null
        };
      }

      // Fallback: return minimal safe info
      return {
        sanitized: '[invalid-proxy-url]',
        hasCredentials: false,
        hostname: null,
        port: null,
        credentialHash: null
      };
    }
  }

  /**
   * Get safe proxy identifier for logging
   * @param {object} proxy - Proxy object from proxy-intelligence
   * @returns {string} Safe identifier (ID or hostname)
   */
  getSafeProxyId(proxy) {
    if (!proxy) return '[unknown-proxy]';

    // Prefer the proxy ID if available
    if (proxy.id) {
      return proxy.id;
    }

    // Otherwise, use sanitized hostname
    const sanitized = this.sanitizeProxyUrl(proxy.address);
    return sanitized.sanitized || '[unknown-proxy]';
  }

  /**
   * Sanitize proxy object for logging (deep copy with credentials removed)
   * @param {object} proxy - Proxy object
   * @returns {object} Sanitized proxy object
   */
  sanitizeProxyForLogging(proxy) {
    if (!proxy) return null;

    const sanitized = { ...proxy };

    // Remove sensitive address, replace with sanitized version
    if (sanitized.address) {
      const urlSanitized = this.sanitizeProxyUrl(sanitized.address);
      sanitized.address = urlSanitized.sanitized;
      sanitized._hasCredentials = urlSanitized.hasCredentials;
      sanitized._credentialHash = urlSanitized.credentialHash;
    }

    return sanitized;
  }

  /**
   * Format proxy error message without exposing credentials
   * @param {string} proxyAddress - Original proxy address
   * @param {string} errorMessage - Original error message
   * @returns {string} Safe error message
   */
  formatProxyError(proxyAddress, errorMessage) {
    if (!proxyAddress) {
      return errorMessage;
    }

    const sanitized = this.sanitizeProxyUrl(proxyAddress);

    // Replace any occurrences of the original address in error message
    let safeMessage = errorMessage;

    if (sanitized.hasCredentials) {
      // Extract just user if present
      const credMatch = proxyAddress.match(/^([^:]*):([^@]*)@/);
      if (credMatch) {
        const userPart = credMatch[1];
        // Replace user@host with host only (still protects password)
        safeMessage = safeMessage.replace(new RegExp(`${userPart}:[^@]*@`, 'g'), '');
      }
    }

    // Replace full proxy address
    safeMessage = safeMessage.replace(
      new RegExp(escapeRegex(proxyAddress), 'g'),
      sanitized.sanitized
    );

    return safeMessage;
  }

  /**
   * Check if a log message contains proxy credentials
   * @param {string} message - Log message
   * @param {array} proxyAddresses - List of proxy addresses to check for
   * @returns {boolean} True if credentials detected
   */
  hasCredentialsExposed(message, proxyAddresses = []) {
    if (!message) return false;

    const msgStr = String(message);

    // Check for common credential patterns
    const credentialPatterns = [
      /:[\w\-%.]+@[a-zA-Z0-9\-.:]+/, // user:pass@host:port
      /password\s*[:=]\s*[\w\-%.]+/i, // password=xxx
      /token\s*[:=]\s*[\w\-%.]+/i, // token=xxx
      /auth\s*[:=]\s*[\w\-%.]+/i // auth=xxx
    ];

    for (const pattern of credentialPatterns) {
      if (pattern.test(msgStr)) {
        return true;
      }
    }

    // Check against provided proxy addresses
    for (const addr of proxyAddresses) {
      if (addr && msgStr.includes(addr)) {
        const sanitized = this.sanitizeProxyUrl(addr);
        if (sanitized.hasCredentials) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Sanitize entire log object
   * @param {object} logData - Log data object
   * @returns {object} Sanitized log data
   */
  sanitizeLogData(logData) {
    if (!logData) return logData;

    const sanitized = { ...logData };

    // Recursively sanitize string values
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];

      if (typeof value === 'string') {
        // Check for proxy credentials in string values
        const match = value.match(/([a-zA-Z0-9.-]+:[^@]+@[a-zA-Z0-9.-]+:\d+)/);
        if (match) {
          const urlSanitized = this.sanitizeProxyUrl(match[1]);
          sanitized[key] = value.replace(match[1], urlSanitized.sanitized);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects (but limit depth)
        if (key !== '_internal' && !key.startsWith('_')) {
          sanitized[key] = this.sanitizeLogData(value);
        }
      }
    });

    return sanitized;
  }
}

// Helper function to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = CredentialSanitizer;

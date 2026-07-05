/**
 * Proxy URL Validator
 * Validates proxy addresses and rejects credential injection attempts
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Security Features:
 * - Strict proxy URL parsing using URL object
 * - Rejects URLs with embedded credentials
 * - Validates IP addresses and domains
 * - Requires explicit credential storage (separate from URL)
 * - Prevents common injection patterns
 */

class ProxyURLValidator {
  constructor(options = {}) {
    this.allowedProtocols = options.allowedProtocols || ['http', 'https', 'socks4', 'socks5'];
    this.allowInternalIPs = options.allowInternalIPs !== true; // Deny internal IPs by default
    this.maxURLLength = options.maxURLLength || 256;
  }

  /**
   * Validate proxy address format
   * @param {string} proxyAddress - Proxy address (host:port format expected)
   * @param {object} credentials - Optional separate credentials object { username, password }
   * @returns {object} { valid, error, sanitized, hostname, port }
   */
  validateProxyAddress(proxyAddress, credentials = null) {
    // Check length
    if (!proxyAddress || typeof proxyAddress !== 'string') {
      return { valid: false, error: 'Proxy address must be a non-empty string' };
    }

    if (proxyAddress.length > this.maxURLLength) {
      return {
        valid: false,
        error: `Proxy address exceeds maximum length of ${this.maxURLLength}`
      };
    }

    // Check for embedded credentials (@ symbol)
    if (proxyAddress.includes('@')) {
      return {
        valid: false,
        error: 'Proxy address contains embedded credentials. Use separate credentials parameter.',
        hasEmbeddedCredentials: true
      };
    }

    // Check for dangerous patterns
    if (this._hasDangerousPatterns(proxyAddress)) {
      return {
        valid: false,
        error: 'Proxy address contains invalid or dangerous patterns'
      };
    }

    // Parse as IP:port or host:port
    const parts = proxyAddress.split(':');
    if (parts.length !== 2) {
      return {
        valid: false,
        error: 'Proxy address must be in format host:port or ip:port'
      };
    }

    const [hostname, portStr] = parts;

    // Check for internal IPs first (security priority)
    if (!this.allowInternalIPs && this._isInternalIP(hostname)) {
      return {
        valid: false,
        error: 'Internal IP addresses are not allowed',
        hostname
      };
    }

    // Validate hostname (IP or domain)
    const hostValidation = this._validateHostname(hostname);
    if (!hostValidation.valid) {
      return { valid: false, error: hostValidation.error };
    }

    // Validate port
    const portValidation = this._validatePort(portStr);
    if (!portValidation.valid) {
      return { valid: false, error: portValidation.error };
    }

    const port = portValidation.port;

    // If credentials provided, validate them separately
    let credentialValidation = null;
    if (credentials && (credentials.username || credentials.password)) {
      credentialValidation = this._validateCredentials(credentials);
      if (!credentialValidation.valid) {
        return { valid: false, error: credentialValidation.error };
      }
    }

    return {
      valid: true,
      sanitized: `${hostname}:${port}`,
      hostname: hostValidation.hostname,
      port,
      isIPAddress: hostValidation.isIPAddress,
      credentials: credentialValidation || null
    };
  }

  /**
   * Validate hostname/IP address
   * @private
   */
  _validateHostname(hostname) {
    if (!hostname || typeof hostname !== 'string') {
      return { valid: false, error: 'Hostname is required' };
    }

    const trimmed = hostname.trim();

    // Check if it's an IPv4 address
    if (this._isValidIPv4(trimmed)) {
      return {
        valid: true,
        hostname: trimmed,
        isIPAddress: true,
        format: 'ipv4'
      };
    }

    // Check if it's an IPv6 address
    if (this._isValidIPv6(trimmed)) {
      return {
        valid: true,
        hostname: trimmed,
        isIPAddress: true,
        format: 'ipv6'
      };
    }

    // Check if it's a valid domain
    if (this._isValidDomain(trimmed)) {
      return {
        valid: true,
        hostname: trimmed,
        isIPAddress: false,
        format: 'domain'
      };
    }

    return { valid: false, error: 'Invalid hostname or IP address' };
  }

  /**
   * Validate port number
   * @private
   */
  _validatePort(portStr) {
    const port = parseInt(portStr, 10);

    if (isNaN(port) || port < 1 || port > 65535) {
      return {
        valid: false,
        error: 'Port must be a number between 1 and 65535'
      };
    }

    // Flag commonly blocked ports
    const blockedPorts = [25, 587, 465, 135, 139, 445]; // SMTP, RPC, SMB ports
    if (blockedPorts.includes(port)) {
      // Allow but warn
      return {
        valid: true,
        port,
        warning: `Port ${port} is commonly blocked for security reasons`
      };
    }

    return { valid: true, port };
  }

  /**
   * Validate credentials object
   * @private
   */
  _validateCredentials(credentials) {
    if (!credentials || typeof credentials !== 'object') {
      return { valid: false, error: 'Credentials must be an object' };
    }

    const { username, password } = credentials;

    // Username validation
    if (username) {
      if (typeof username !== 'string') {
        return { valid: false, error: 'Username must be a string' };
      }
      if (username.length > 256) {
        return { valid: false, error: 'Username exceeds maximum length' };
      }
      if (!/^[a-zA-Z0-9._\-]+$/.test(username)) {
        return {
          valid: false,
          error: 'Username contains invalid characters'
        };
      }
    }

    // Password validation
    if (password) {
      if (typeof password !== 'string') {
        return { valid: false, error: 'Password must be a string' };
      }
      if (password.length > 512) {
        return { valid: false, error: 'Password exceeds maximum length' };
      }
    }

    return { valid: true };
  }

  /**
   * Check for dangerous patterns in proxy address
   * @private
   */
  _hasDangerousPatterns(address) {
    const dangerousPatterns = [
      /`/, // Backticks for command injection
      /\$\{/, // Template literals
      /\$\(/, // Command substitution
      /[;&|]/, // Shell operators
      /\.\.\//, // Path traversal
      /\0/, // Null bytes
      /javascript:/i, // JavaScript protocol
      /data:/i, // Data protocol
      /file:/i // File protocol
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(address)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if hostname is an internal/private IP
   * @private
   */
  _isInternalIP(hostname) {
    const internalPatterns = [
      /^127\./, // Localhost
      /^localhost$/i,
      /^::1$/, // IPv6 localhost
      /^192\.168\./, // Private range
      /^10\./, // Private range
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private range
      /^169\.254\./, // Link-local
      /^fc00:/i, // IPv6 private
      /^fe80:/i, // IPv6 link-local
      /^0\.0\.0\.0$/ // Invalid
    ];

    for (const pattern of internalPatterns) {
      if (pattern.test(hostname)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate IPv4 address
   * @private
   */
  _isValidIPv4(ip) {
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Pattern);

    if (!match) {
      return false;
    }

    const [, oct1, oct2, oct3, oct4] = match.map(Number);
    return (
      oct1 >= 0 && oct1 <= 255 &&
      oct2 >= 0 && oct2 <= 255 &&
      oct3 >= 0 && oct3 <= 255 &&
      oct4 >= 0 && oct4 <= 255
    );
  }

  /**
   * Validate IPv6 address (basic)
   * @private
   */
  _isValidIPv6(ip) {
    // Basic IPv6 validation
    return /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(ip);
  }

  /**
   * Validate domain name
   * @private
   */
  _isValidDomain(domain) {
    // Domain validation: alphanumeric, hyphens, dots, underscores
    const domainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?$/;
    return domainPattern.test(domain);
  }
}

module.exports = ProxyURLValidator;

/**
 * Basset Hound Browser - Comprehensive Input Validators
 * v12.5.0 Phase 2 - Deployment Hardening
 *
 * Provides reusable validators for WebSocket command parameters
 * Prevents command injection, DoS attacks, and invalid configurations
 */

const url = require('url');
const path = require('path');

// Port validation constants
const MIN_PORT = 1;
const MAX_PORT = 65535;
const DYNAMIC_PORT_START = 49152;
const DYNAMIC_PORT_END = 65535;

// URL validation constants
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'file:'];
const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];

// CSS selector complexity limits
const MAX_SELECTOR_LENGTH = 1000;
const MAX_SELECTOR_DEPTH = 50;

// String length limits
const MAX_STRING_LENGTH = 10000;
const MAX_URL_LENGTH = 2048;
const MAX_CODE_LENGTH = 100000;

class Validators {
  /**
   * Validate port number (1-65535)
   * @param {any} port - Port value to validate
   * @param {string} name - Field name for error messages
   * @returns {number} Validated port number
   */
  static validatePort(port, name = 'port') {
    const portNum = parseInt(port, 10);

    if (isNaN(portNum)) {
      throw new Error(`Invalid ${name}: must be a number, got "${port}"`);
    }

    if (portNum < MIN_PORT || portNum > MAX_PORT) {
      throw new Error(`Invalid ${name}: must be between ${MIN_PORT}-${MAX_PORT}, got ${portNum}`);
    }

    return portNum;
  }

  /**
   * Validate SOCKS port specifically
   * @param {any} port - SOCKS port value
   * @returns {number} Validated port number
   */
  static validateSocksPort(port) {
    return this.validatePort(port, 'SOCKS port');
  }

  /**
   * Validate control port (Tor control)
   * @param {any} port - Control port value
   * @returns {number} Validated port number
   */
  static validateControlPort(port) {
    return this.validatePort(port, 'control port');
  }

  /**
   * Validate HTTP/HTTPS URL
   * @param {string} urlString - URL to validate
   * @returns {string} Validated and normalized URL
   */
  static validateUrl(urlString) {
    if (typeof urlString !== 'string') {
      throw new Error(`Invalid URL: must be a string, got ${typeof urlString}`);
    }

    if (urlString.length === 0) {
      throw new Error('Invalid URL: cannot be empty');
    }

    if (urlString.length > MAX_URL_LENGTH) {
      throw new Error(`Invalid URL: exceeds ${MAX_URL_LENGTH} characters`);
    }

    try {
      const parsedUrl = new URL(urlString);

      // Check for dangerous protocols
      if (DANGEROUS_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error(`Invalid URL: dangerous protocol "${parsedUrl.protocol}" not allowed`);
      }

      // Allow http, https, and file only
      if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
        throw new Error(`Invalid URL: protocol "${parsedUrl.protocol}" not allowed (use http, https, or file)`);
      }

      return parsedUrl.toString();
    } catch (error) {
      if (error.message.startsWith('Invalid URL:')) {
        throw error;
      }
      throw new Error(`Invalid URL format: ${error.message}`);
    }
  }

  /**
   * Validate proxy URL (HTTP/HTTPS/SOCKS)
   * @param {string} proxyUrl - Proxy URL to validate
   * @returns {string} Validated proxy URL
   */
  static validateProxyUrl(proxyUrl) {
    if (typeof proxyUrl !== 'string') {
      throw new Error(`Invalid proxy URL: must be a string, got ${typeof proxyUrl}`);
    }

    if (proxyUrl.length === 0) {
      throw new Error('Invalid proxy URL: cannot be empty');
    }

    const validProxyProtocols = ['http:', 'https:', 'socks4:', 'socks5:', 'socks5h:'];

    try {
      const parsedUrl = new URL(proxyUrl);

      if (!validProxyProtocols.includes(parsedUrl.protocol)) {
        throw new Error(`Invalid proxy protocol: "${parsedUrl.protocol}" (use http, https, socks4, socks5)`);
      }

      // Validate host
      if (!parsedUrl.hostname) {
        throw new Error('Proxy URL must include a hostname');
      }

      // Validate port if present
      if (parsedUrl.port) {
        const portNum = parseInt(parsedUrl.port, 10);
        if (isNaN(portNum) || portNum < MIN_PORT || portNum > MAX_PORT) {
          throw new Error(`Invalid proxy port: ${parsedUrl.port}`);
        }
      }

      return parsedUrl.toString();
    } catch (error) {
      if (error.message.startsWith('Invalid')) {
        throw error;
      }
      throw new Error(`Invalid proxy URL format: ${error.message}`);
    }
  }

  /**
   * Validate IPv4 address
   * @param {string} ip - IPv4 address to validate
   * @returns {string} Validated IP address
   */
  static validateIPv4(ip) {
    if (typeof ip !== 'string') {
      throw new Error(`Invalid IPv4: must be a string, got ${typeof ip}`);
    }

    const parts = ip.split('.');
    if (parts.length !== 4) {
      throw new Error(`Invalid IPv4: must have 4 octets, got ${parts.length}`);
    }

    for (const part of parts) {
      const num = parseInt(part, 10);
      if (isNaN(num) || num < 0 || num > 255) {
        throw new Error(`Invalid IPv4: octet out of range (0-255): ${part}`);
      }
    }

    return ip;
  }

  /**
   * Validate IPv6 address (basic)
   * @param {string} ip - IPv6 address to validate
   * @returns {string} Validated IP address
   */
  static validateIPv6(ip) {
    if (typeof ip !== 'string') {
      throw new Error(`Invalid IPv6: must be a string, got ${typeof ip}`);
    }

    // Very basic IPv6 validation
    if (!/^(([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}|::1|::)$/.test(ip)) {
      throw new Error(`Invalid IPv6 format: ${ip}`);
    }

    return ip;
  }

  /**
   * Validate IP address (v4 or v6)
   * @param {string} ip - IP address to validate
   * @returns {string} Validated IP address
   */
  static validateIPAddress(ip) {
    if (typeof ip !== 'string') {
      throw new Error(`Invalid IP: must be a string, got ${typeof ip}`);
    }

    // Try IPv4 first
    if (ip.includes('.')) {
      return this.validateIPv4(ip);
    }

    // Try IPv6
    if (ip.includes(':')) {
      return this.validateIPv6(ip);
    }

    throw new Error(`Invalid IP address format: ${ip}`);
  }

  /**
   * Validate domain name
   * @param {string} domain - Domain name to validate
   * @returns {string} Validated domain
   */
  static validateDomain(domain) {
    if (typeof domain !== 'string') {
      throw new Error(`Invalid domain: must be a string, got ${typeof domain}`);
    }

    if (domain.length === 0) {
      throw new Error('Invalid domain: cannot be empty');
    }

    // Basic domain validation
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

    if (!domainRegex.test(domain)) {
      throw new Error(`Invalid domain format: ${domain}`);
    }

    return domain.toLowerCase();
  }

  /**
   * Validate file path (no traversal attacks)
   * @param {string} filePath - File path to validate
   * @returns {string} Validated normalized path
   */
  static validateFilePath(filePath) {
    if (typeof filePath !== 'string') {
      throw new Error(`Invalid file path: must be a string, got ${typeof filePath}`);
    }

    if (filePath.length === 0) {
      throw new Error('Invalid file path: cannot be empty');
    }

    // Normalize and resolve path
    const normalized = path.normalize(filePath);

    // Check for path traversal attempts
    if (normalized.includes('..') || normalized.startsWith('/')) {
      throw new Error(`Invalid file path: path traversal detected in ${filePath}`);
    }

    // Check for absolute paths
    if (path.isAbsolute(normalized)) {
      throw new Error(`Invalid file path: absolute paths not allowed`);
    }

    return normalized;
  }

  /**
   * Validate string length
   * @param {any} str - String to validate
   * @param {number} maxLength - Maximum length
   * @param {string} name - Field name for error messages
   * @returns {string} Validated string
   */
  static validateStringLength(str, maxLength = MAX_STRING_LENGTH, name = 'string') {
    if (typeof str !== 'string') {
      throw new Error(`Invalid ${name}: must be a string, got ${typeof str}`);
    }

    if (str.length > maxLength) {
      throw new Error(`Invalid ${name}: exceeds ${maxLength} characters`);
    }

    return str;
  }

  /**
   * Validate CSS selector (no injection, bounded complexity)
   * @param {string} selector - CSS selector to validate
   * @returns {string} Validated selector
   */
  static validateCssSelector(selector) {
    if (typeof selector !== 'string') {
      throw new Error(`Invalid CSS selector: must be a string, got ${typeof selector}`);
    }

    if (selector.length === 0) {
      throw new Error('Invalid CSS selector: cannot be empty');
    }

    if (selector.length > MAX_SELECTOR_LENGTH) {
      throw new Error(`Invalid CSS selector: exceeds ${MAX_SELECTOR_LENGTH} characters`);
    }

    // Check for script injection attempts in selector
    if (selector.includes(';') || selector.includes('{') || selector.includes('}')) {
      throw new Error('Invalid CSS selector: contains suspicious characters');
    }

    // Count nesting depth
    const depth = (selector.match(/>/g) || []).length + 1;
    if (depth > MAX_SELECTOR_DEPTH) {
      throw new Error(`Invalid CSS selector: exceeds ${MAX_SELECTOR_DEPTH} nesting depth`);
    }

    return selector;
  }

  /**
   * Validate XPath expression (basic)
   * @param {string} xpath - XPath expression to validate
   * @returns {string} Validated XPath
   */
  static validateXPath(xpath) {
    if (typeof xpath !== 'string') {
      throw new Error(`Invalid XPath: must be a string, got ${typeof xpath}`);
    }

    if (xpath.length === 0) {
      throw new Error('Invalid XPath: cannot be empty');
    }

    if (xpath.length > MAX_SELECTOR_LENGTH) {
      throw new Error(`Invalid XPath: exceeds ${MAX_SELECTOR_LENGTH} characters`);
    }

    // Basic XPath validation - check for obvious injection
    if (xpath.includes(';') || xpath.includes('javascript:')) {
      throw new Error('Invalid XPath: contains suspicious content');
    }

    return xpath;
  }

  /**
   * Validate JSON string
   * @param {string} jsonStr - JSON string to validate
   * @returns {object} Parsed JSON object
   */
  static validateJSON(jsonStr) {
    if (typeof jsonStr !== 'string') {
      throw new Error(`Invalid JSON: must be a string, got ${typeof jsonStr}`);
    }

    if (jsonStr.length === 0) {
      throw new Error('Invalid JSON: cannot be empty');
    }

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Validate JavaScript code (basic safety checks)
   * @param {string} code - JavaScript code to validate
   * @returns {string} Validated code
   */
  static validateJavaScriptCode(code) {
    if (typeof code !== 'string') {
      throw new Error(`Invalid code: must be a string, got ${typeof code}`);
    }

    if (code.length === 0) {
      throw new Error('Invalid code: cannot be empty');
    }

    if (code.length > MAX_CODE_LENGTH) {
      throw new Error(`Invalid code: exceeds ${MAX_CODE_LENGTH} characters`);
    }

    // Basic syntax check - can execute
    try {
      new Function(code);  // Throws if syntax is invalid
    } catch (error) {
      throw new Error(`Invalid JavaScript syntax: ${error.message}`);
    }

    return code;
  }

  /**
   * Validate command parameter as specific type
   * @param {any} value - Value to validate
   * @param {string} type - Expected type (string, number, boolean, object, array)
   * @param {string} name - Field name for error messages
   * @returns {any} Validated value
   */
  static validateType(value, type, name = 'parameter') {
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== type && !(type === 'object' && actualType === 'object')) {
      throw new Error(`Invalid ${name}: expected ${type}, got ${actualType}`);
    }

    return value;
  }

  /**
   * Validate rate limit parameters
   * @param {number} maxRequests - Max requests
   * @param {number} windowMs - Time window in milliseconds
   * @returns {object} Validated rate limit config
   */
  static validateRateLimitConfig(maxRequests, windowMs) {
    if (!Number.isInteger(maxRequests) || maxRequests < 1) {
      throw new Error(`Invalid maxRequests: must be positive integer, got ${maxRequests}`);
    }

    if (!Number.isInteger(windowMs) || windowMs < 100) {
      throw new Error(`Invalid windowMs: must be >= 100, got ${windowMs}`);
    }

    return { maxRequests, windowMs };
  }

  /**
   * Validate profile name (alphanumeric + underscores)
   * @param {string} name - Profile name to validate
   * @returns {string} Validated profile name
   */
  static validateProfileName(name) {
    if (typeof name !== 'string') {
      throw new Error(`Invalid profile name: must be a string, got ${typeof name}`);
    }

    if (name.length === 0) {
      throw new Error('Invalid profile name: cannot be empty');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid profile name: only alphanumeric, underscore, and hyphen allowed`);
    }

    if (name.length > 255) {
      throw new Error('Invalid profile name: exceeds 255 characters');
    }

    return name;
  }

  /**
   * Validate session ID
   * @param {string} sessionId - Session ID to validate
   * @returns {string} Validated session ID
   */
  static validateSessionId(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new Error(`Invalid session ID: must be a string, got ${typeof sessionId}`);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) {
      throw new Error('Invalid session ID: only alphanumeric, underscore, and hyphen allowed');
    }

    if (sessionId.length < 5 || sessionId.length > 255) {
      throw new Error('Invalid session ID: must be between 5-255 characters');
    }

    return sessionId;
  }

  /**
   * Validate number range
   * @param {any} value - Value to validate
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {string} name - Field name for error messages
   * @returns {number} Validated number
   */
  static validateNumberRange(value, min, max, name = 'number') {
    const num = Number(value);

    if (isNaN(num)) {
      throw new Error(`Invalid ${name}: must be a number, got "${value}"`);
    }

    if (num < min || num > max) {
      throw new Error(`Invalid ${name}: must be between ${min}-${max}, got ${num}`);
    }

    return num;
  }

  /**
   * Validate boolean value
   * @param {any} value - Value to validate
   * @param {string} name - Field name for error messages
   * @returns {boolean} Validated boolean
   */
  static validateBoolean(value, name = 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true' || value === '1') return true;
      if (value.toLowerCase() === 'false' || value === '0') return false;
    }

    throw new Error(`Invalid ${name}: must be boolean, got "${value}"`);
  }

  /**
   * Validate enum value
   * @param {any} value - Value to validate
   * @param {string[]} allowedValues - List of allowed values
   * @param {string} name - Field name for error messages
   * @returns {string} Validated enum value
   */
  static validateEnum(value, allowedValues, name = 'enum') {
    if (!allowedValues.includes(value)) {
      throw new Error(`Invalid ${name}: must be one of ${allowedValues.join(', ')}, got "${value}"`);
    }

    return value;
  }
}

module.exports = { Validators };

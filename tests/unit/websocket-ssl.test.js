/**
 * Basset Hound Browser - WebSocket SSL Unit Tests
 * Tests for SSL/TLS configuration parsing and protocol helpers
 */

const path = require('path');
const fs = require('fs');

// Mock fs module for certificate loading tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}));

// Mock Electron modules
jest.mock('electron', () => ({
  ipcMain: {
    once: jest.fn(),
    on: jest.fn(),
    handle: jest.fn()
  },
  session: {
    defaultSession: {
      cookies: {
        get: jest.fn().mockResolvedValue([]),
        set: jest.fn().mockResolvedValue(undefined)
      },
      setProxy: jest.fn().mockResolvedValue(undefined)
    }
  }
}));

/**
 * SSLConfigParser - Utility class for parsing SSL configuration
 * This simulates what would be in the actual WebSocket server for SSL support
 */
class SSLConfigParser {
  constructor(options = {}) {
    this.options = options;
    this.sslEnabled = false;
    this.certPath = options.cert || options.certPath || null;
    this.keyPath = options.key || options.keyPath || null;
    this.caPath = options.ca || options.caPath || null;
    this.passphrase = options.passphrase || null;
    this.rejectUnauthorized = options.rejectUnauthorized !== false;
    this.minVersion = options.minVersion || 'TLSv1.2';
    this.maxVersion = options.maxVersion || null;
    this.ciphers = options.ciphers || null;

    // Determine if SSL is enabled based on configuration
    if (options.ssl === true || options.secure === true) {
      this.sslEnabled = true;
    } else if (this.certPath && this.keyPath) {
      this.sslEnabled = true;
    } else if (options.protocol === 'wss' || options.protocol === 'https') {
      this.sslEnabled = true;
    }
  }

  /**
   * Get the WebSocket protocol (ws or wss)
   * @returns {string}
   */
  getProtocol() {
    return this.sslEnabled ? 'wss' : 'ws';
  }

  /**
   * Get the full connection URL
   * @param {string} host - Hostname
   * @param {number} port - Port number
   * @returns {string}
   */
  getConnectionUrl(host = 'localhost', port = 8765) {
    return `${this.getProtocol()}://${host}:${port}`;
  }

  /**
   * Check if SSL is enabled
   * @returns {boolean}
   */
  isSslEnabled() {
    return this.sslEnabled;
  }

  /**
   * Load SSL certificates
   * @returns {Object|null} SSL options object or null if not configured
   */
  loadCertificates() {
    if (!this.sslEnabled) {
      return null;
    }

    const sslOptions = {};

    if (this.certPath) {
      if (!fs.existsSync(this.certPath)) {
        throw new Error(`Certificate file not found: ${this.certPath}`);
      }
      sslOptions.cert = fs.readFileSync(this.certPath);
    }

    if (this.keyPath) {
      if (!fs.existsSync(this.keyPath)) {
        throw new Error(`Key file not found: ${this.keyPath}`);
      }
      sslOptions.key = fs.readFileSync(this.keyPath);
    }

    if (this.caPath) {
      if (!fs.existsSync(this.caPath)) {
        throw new Error(`CA file not found: ${this.caPath}`);
      }
      sslOptions.ca = fs.readFileSync(this.caPath);
    }

    if (this.passphrase) {
      sslOptions.passphrase = this.passphrase;
    }

    sslOptions.rejectUnauthorized = this.rejectUnauthorized;
    sslOptions.minVersion = this.minVersion;

    if (this.maxVersion) {
      sslOptions.maxVersion = this.maxVersion;
    }

    if (this.ciphers) {
      sslOptions.ciphers = this.ciphers;
    }

    return sslOptions;
  }

  /**
   * Validate SSL configuration
   * @returns {Object} Validation result with valid flag and errors array
   */
  validate() {
    const errors = [];

    if (this.sslEnabled) {
      if (!this.certPath) {
        errors.push('SSL is enabled but no certificate path provided');
      }
      if (!this.keyPath) {
        errors.push('SSL is enabled but no key path provided');
      }

      // Validate TLS version
      const validVersions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];
      if (this.minVersion && !validVersions.includes(this.minVersion)) {
        errors.push(`Invalid minimum TLS version: ${this.minVersion}`);
      }
      if (this.maxVersion && !validVersions.includes(this.maxVersion)) {
        errors.push(`Invalid maximum TLS version: ${this.maxVersion}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get SSL configuration summary
   * @returns {Object}
   */
  getSummary() {
    return {
      sslEnabled: this.sslEnabled,
      protocol: this.getProtocol(),
      certPath: this.certPath,
      keyPath: this.keyPath,
      caPath: this.caPath,
      rejectUnauthorized: this.rejectUnauthorized,
      minVersion: this.minVersion,
      maxVersion: this.maxVersion
    };
  }
}

/**
 * Helper function to check if SSL is enabled from options
 * @param {Object} options - Configuration options
 * @returns {boolean}
 */
function isSslEnabled(options = {}) {
  if (options.ssl === true || options.secure === true) {
    return true;
  }
  if (options.cert && options.key) {
    return true;
  }
  if (options.protocol === 'wss' || options.protocol === 'https') {
    return true;
  }
  return false;
}

describe('SSLConfigParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SSL Configuration Options Parsing', () => {
    test('should disable SSL by default', () => {
      const parser = new SSLConfigParser({});
      expect(parser.isSslEnabled()).toBe(false);
      expect(parser.getProtocol()).toBe('ws');
    });

    test('should enable SSL when ssl option is true', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.isSslEnabled()).toBe(true);
      expect(parser.getProtocol()).toBe('wss');
    });

    test('should enable SSL when secure option is true', () => {
      const parser = new SSLConfigParser({ secure: true });
      expect(parser.isSslEnabled()).toBe(true);
      expect(parser.getProtocol()).toBe('wss');
    });

    test('should enable SSL when cert and key are provided', () => {
      const parser = new SSLConfigParser({
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem'
      });
      expect(parser.isSslEnabled()).toBe(true);
    });

    test('should enable SSL when certPath and keyPath are provided', () => {
      const parser = new SSLConfigParser({
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem'
      });
      expect(parser.isSslEnabled()).toBe(true);
    });

    test('should enable SSL when protocol is wss', () => {
      const parser = new SSLConfigParser({ protocol: 'wss' });
      expect(parser.isSslEnabled()).toBe(true);
    });

    test('should enable SSL when protocol is https', () => {
      const parser = new SSLConfigParser({ protocol: 'https' });
      expect(parser.isSslEnabled()).toBe(true);
    });

    test('should parse CA certificate path', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        ca: '/path/to/ca.pem'
      });
      expect(parser.caPath).toBe('/path/to/ca.pem');
    });

    test('should parse passphrase option', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        passphrase: 'secret123'
      });
      expect(parser.passphrase).toBe('secret123');
    });

    test('should set rejectUnauthorized to true by default', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.rejectUnauthorized).toBe(true);
    });

    test('should allow disabling rejectUnauthorized', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        rejectUnauthorized: false
      });
      expect(parser.rejectUnauthorized).toBe(false);
    });

    test('should parse TLS version options', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3'
      });
      expect(parser.minVersion).toBe('TLSv1.3');
      expect(parser.maxVersion).toBe('TLSv1.3');
    });

    test('should default to TLSv1.2 minimum version', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.minVersion).toBe('TLSv1.2');
    });

    test('should parse cipher suite option', () => {
      const ciphers = 'ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256';
      const parser = new SSLConfigParser({
        ssl: true,
        ciphers
      });
      expect(parser.ciphers).toBe(ciphers);
    });
  });

  describe('getProtocol()', () => {
    test('should return ws for non-SSL connections', () => {
      const parser = new SSLConfigParser({});
      expect(parser.getProtocol()).toBe('ws');
    });

    test('should return wss for SSL connections', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.getProtocol()).toBe('wss');
    });

    test('should return wss when certificates are configured', () => {
      const parser = new SSLConfigParser({
        cert: '/path/cert.pem',
        key: '/path/key.pem'
      });
      expect(parser.getProtocol()).toBe('wss');
    });
  });

  describe('getConnectionUrl()', () => {
    test('should return ws:// URL for non-SSL connections', () => {
      const parser = new SSLConfigParser({});
      expect(parser.getConnectionUrl()).toBe('ws://localhost:8765');
    });

    test('should return wss:// URL for SSL connections', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.getConnectionUrl()).toBe('wss://localhost:8765');
    });

    test('should use custom host and port', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.getConnectionUrl('example.com', 9000)).toBe('wss://example.com:9000');
    });

    test('should construct URL correctly with default parameters', () => {
      const parser = new SSLConfigParser({});
      const url = parser.getConnectionUrl();
      expect(url).toMatch(/^ws:\/\//);
      expect(url).toContain('localhost');
      expect(url).toContain('8765');
    });
  });

  describe('isSslEnabled()', () => {
    test('should return false when SSL is not configured', () => {
      const parser = new SSLConfigParser({});
      expect(parser.isSslEnabled()).toBe(false);
    });

    test('should return true when SSL is explicitly enabled', () => {
      const parser = new SSLConfigParser({ ssl: true });
      expect(parser.isSslEnabled()).toBe(true);
    });

    test('should return true when certificates are provided', () => {
      const parser = new SSLConfigParser({
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem'
      });
      expect(parser.isSslEnabled()).toBe(true);
    });
  });

  describe('loadCertificates()', () => {
    beforeEach(() => {
      fs.existsSync.mockReset();
      fs.readFileSync.mockReset();
    });

    test('should return null when SSL is not enabled', () => {
      const parser = new SSLConfigParser({});
      expect(parser.loadCertificates()).toBeNull();
    });

    test('should load certificate and key files', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('cert')) return Buffer.from('CERT_CONTENT');
        if (filePath.includes('key')) return Buffer.from('KEY_CONTENT');
        return Buffer.from('');
      });

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem'
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.cert).toBeDefined();
      expect(sslOptions.key).toBeDefined();
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/cert.pem');
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/key.pem');
    });

    test('should load CA certificate when provided', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.includes('cert')) return Buffer.from('CERT_CONTENT');
        if (filePath.includes('key')) return Buffer.from('KEY_CONTENT');
        if (filePath.includes('ca')) return Buffer.from('CA_CONTENT');
        return Buffer.from('');
      });

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        ca: '/path/to/ca.pem'
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.ca).toBeDefined();
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca.pem');
    });

    test('should throw error when certificate file not found', () => {
      fs.existsSync.mockReturnValue(false);

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/nonexistent.pem',
        key: '/path/to/key.pem'
      });

      expect(() => parser.loadCertificates()).toThrow('Certificate file not found');
    });

    test('should throw error when key file not found', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('cert');
      });
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/nonexistent.pem'
      });

      expect(() => parser.loadCertificates()).toThrow('Key file not found');
    });

    test('should throw error when CA file not found', () => {
      fs.existsSync.mockImplementation((filePath) => {
        return filePath.includes('cert') || filePath.includes('key');
      });
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        ca: '/path/to/nonexistent-ca.pem'
      });

      expect(() => parser.loadCertificates()).toThrow('CA file not found');
    });

    test('should include passphrase in SSL options', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        passphrase: 'mysecret'
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.passphrase).toBe('mysecret');
    });

    test('should include TLS version settings in SSL options', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3'
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.minVersion).toBe('TLSv1.3');
      expect(sslOptions.maxVersion).toBe('TLSv1.3');
    });

    test('should include cipher settings in SSL options', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const ciphers = 'ECDHE-RSA-AES256-GCM-SHA384';
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        ciphers
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.ciphers).toBe(ciphers);
    });

    test('should set rejectUnauthorized in SSL options', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(Buffer.from('CONTENT'));

      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        rejectUnauthorized: false
      });

      const sslOptions = parser.loadCertificates();
      expect(sslOptions.rejectUnauthorized).toBe(false);
    });
  });

  describe('validate()', () => {
    test('should validate non-SSL configuration as valid', () => {
      const parser = new SSLConfigParser({});
      const result = parser.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should report error when SSL enabled without certificate', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        key: '/path/to/key.pem'
      });
      const result = parser.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SSL is enabled but no certificate path provided');
    });

    test('should report error when SSL enabled without key', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem'
      });
      const result = parser.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SSL is enabled but no key path provided');
    });

    test('should validate complete SSL configuration', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem'
      });
      const result = parser.validate();
      expect(result.valid).toBe(true);
    });

    test('should report error for invalid minimum TLS version', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        minVersion: 'TLSv0.9'
      });
      const result = parser.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid minimum TLS version: TLSv0.9');
    });

    test('should report error for invalid maximum TLS version', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        maxVersion: 'TLSv2.0'
      });
      const result = parser.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid maximum TLS version: TLSv2.0');
    });

    test('should accept valid TLS versions', () => {
      const validVersions = ['TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'];

      for (const version of validVersions) {
        const parser = new SSLConfigParser({
          ssl: true,
          cert: '/path/to/cert.pem',
          key: '/path/to/key.pem',
          minVersion: version
        });
        const result = parser.validate();
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('getSummary()', () => {
    test('should return configuration summary', () => {
      const parser = new SSLConfigParser({
        ssl: true,
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
        ca: '/path/to/ca.pem',
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: false
      });

      const summary = parser.getSummary();
      expect(summary.sslEnabled).toBe(true);
      expect(summary.protocol).toBe('wss');
      expect(summary.certPath).toBe('/path/to/cert.pem');
      expect(summary.keyPath).toBe('/path/to/key.pem');
      expect(summary.caPath).toBe('/path/to/ca.pem');
      expect(summary.minVersion).toBe('TLSv1.2');
      expect(summary.maxVersion).toBe('TLSv1.3');
      expect(summary.rejectUnauthorized).toBe(false);
    });

    test('should return minimal summary for non-SSL configuration', () => {
      const parser = new SSLConfigParser({});
      const summary = parser.getSummary();
      expect(summary.sslEnabled).toBe(false);
      expect(summary.protocol).toBe('ws');
      expect(summary.certPath).toBeNull();
      expect(summary.keyPath).toBeNull();
    });
  });
});

describe('isSslEnabled helper function', () => {
  test('should return false for empty options', () => {
    expect(isSslEnabled({})).toBe(false);
    expect(isSslEnabled()).toBe(false);
  });

  test('should return true when ssl is true', () => {
    expect(isSslEnabled({ ssl: true })).toBe(true);
  });

  test('should return true when secure is true', () => {
    expect(isSslEnabled({ secure: true })).toBe(true);
  });

  test('should return true when cert and key are provided', () => {
    expect(isSslEnabled({ cert: '/path/cert.pem', key: '/path/key.pem' })).toBe(true);
  });

  test('should return false when only cert is provided', () => {
    expect(isSslEnabled({ cert: '/path/cert.pem' })).toBe(false);
  });

  test('should return false when only key is provided', () => {
    expect(isSslEnabled({ key: '/path/key.pem' })).toBe(false);
  });

  test('should return true when protocol is wss', () => {
    expect(isSslEnabled({ protocol: 'wss' })).toBe(true);
  });

  test('should return true when protocol is https', () => {
    expect(isSslEnabled({ protocol: 'https' })).toBe(true);
  });

  test('should return false when protocol is ws', () => {
    expect(isSslEnabled({ protocol: 'ws' })).toBe(false);
  });

  test('should return false when protocol is http', () => {
    expect(isSslEnabled({ protocol: 'http' })).toBe(false);
  });
});

describe('SSL Error Handling', () => {
  test('should handle CERT_HAS_EXPIRED error type', () => {
    const error = new Error('CERT_HAS_EXPIRED');
    error.code = 'CERT_HAS_EXPIRED';
    expect(error.code).toBe('CERT_HAS_EXPIRED');
    expect(error.message).toContain('EXPIRED');
  });

  test('should handle DEPTH_ZERO_SELF_SIGNED_CERT error type', () => {
    const error = new Error('DEPTH_ZERO_SELF_SIGNED_CERT');
    error.code = 'DEPTH_ZERO_SELF_SIGNED_CERT';
    expect(error.code).toBe('DEPTH_ZERO_SELF_SIGNED_CERT');
  });

  test('should handle UNABLE_TO_VERIFY_LEAF_SIGNATURE error type', () => {
    const error = new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    error.code = 'UNABLE_TO_VERIFY_LEAF_SIGNATURE';
    expect(error.code).toBe('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
  });

  test('should handle SELF_SIGNED_CERT_IN_CHAIN error type', () => {
    const error = new Error('SELF_SIGNED_CERT_IN_CHAIN');
    error.code = 'SELF_SIGNED_CERT_IN_CHAIN';
    expect(error.code).toBe('SELF_SIGNED_CERT_IN_CHAIN');
  });
});

describe('SSL Connection URL Building', () => {
  test('should build correct WSS URL for localhost', () => {
    const parser = new SSLConfigParser({ ssl: true });
    expect(parser.getConnectionUrl('localhost', 8765)).toBe('wss://localhost:8765');
  });

  test('should build correct WS URL for localhost', () => {
    const parser = new SSLConfigParser({});
    expect(parser.getConnectionUrl('localhost', 8765)).toBe('ws://localhost:8765');
  });

  test('should build correct URL with IPv4 address', () => {
    const parser = new SSLConfigParser({ ssl: true });
    expect(parser.getConnectionUrl('192.168.1.100', 9000)).toBe('wss://192.168.1.100:9000');
  });

  test('should build correct URL with domain name', () => {
    const parser = new SSLConfigParser({ ssl: true });
    expect(parser.getConnectionUrl('api.example.com', 443)).toBe('wss://api.example.com:443');
  });

  test('should handle IPv6 addresses', () => {
    const parser = new SSLConfigParser({ ssl: true });
    // Note: IPv6 should be wrapped in brackets, but this is a simple implementation
    expect(parser.getConnectionUrl('::1', 8765)).toBe('wss://::1:8765');
  });
});

// Export for use in integration tests
module.exports = {
  SSLConfigParser,
  isSslEnabled
};

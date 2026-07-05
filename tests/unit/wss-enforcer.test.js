/**
 * Basset Hound Browser - WSS Enforcer Unit Tests
 * Tests for WebSocket Secure protocol enforcement and HTTPS redirect
 */

const { WSSEnforcer } = require('../../websocket/security/wss-enforcer');
const fs = require('fs');
const path = require('path');

// Mock fs module for certificate loading
jest.mock('fs');

describe('WSSEnforcer', () => {
  let enforcer;
  let mockLogger;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    // Default environment is development
    process.env.NODE_ENV = 'development';
    process.env.BASSET_WS_SSL_CERT = undefined;
    process.env.BASSET_WS_SSL_KEY = undefined;
    process.env.BASSET_WS_SSL_CA = undefined;
  });

  describe('Constructor', () => {
    test('should initialize with default development settings', () => {
      enforcer = new WSSEnforcer({ logger: mockLogger });

      expect(enforcer.enforceWss).toBe(false);
      expect(enforcer.enforceHttpsRedirect).toBe(false);
      expect(enforcer.allowMixedMode).toBe(false);
    });

    test('should enforce WSS in production environment', () => {
      process.env.NODE_ENV = 'production';
      enforcer = new WSSEnforcer({ logger: mockLogger });

      expect(enforcer.enforceWss).toBe(true);
      expect(enforcer.enforceHttpsRedirect).toBe(true);
    });

    test('should respect explicit options over environment', () => {
      process.env.NODE_ENV = 'production';
      enforcer = new WSSEnforcer({
        enforceWss: false,
        logger: mockLogger
      });

      expect(enforcer.enforceWss).toBe(false);
    });

    test('should read SSL paths from environment variables', () => {
      process.env.BASSET_WS_SSL_CERT = '/path/to/cert.pem';
      process.env.BASSET_WS_SSL_KEY = '/path/to/key.pem';
      process.env.BASSET_WS_SSL_CA = '/path/to/ca.pem';

      enforcer = new WSSEnforcer({ logger: mockLogger });

      expect(enforcer.certPath).toBe('/path/to/cert.pem');
      expect(enforcer.keyPath).toBe('/path/to/key.pem');
      expect(enforcer.caPath).toBe('/path/to/ca.pem');
    });

    test('should prioritize explicit options over environment', () => {
      process.env.BASSET_WS_SSL_CERT = '/env/cert.pem';

      enforcer = new WSSEnforcer({
        certPath: '/option/cert.pem',
        logger: mockLogger
      });

      expect(enforcer.certPath).toBe('/option/cert.pem');
    });
  });

  describe('Validation', () => {
    test('should validate successfully in development', () => {
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const result = enforcer.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail validation if WSS enforced but no certificates', () => {
      process.env.NODE_ENV = 'production';
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const result = enforcer.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('SSL certificate/key paths not provided');
    });

    test('should detect missing certificate file', () => {
      fs.existsSync.mockReturnValue(false);

      enforcer = new WSSEnforcer({
        enforceWss: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        logger: mockLogger
      });

      const result = enforcer.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('certificate file not found'))).toBe(true);
    });

    test('should detect missing key file', () => {
      fs.existsSync.mockImplementation((path) => {
        return !path.includes('key');
      });

      enforcer = new WSSEnforcer({
        enforceWss: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        logger: mockLogger
      });

      const result = enforcer.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('private key file not found'))).toBe(true);
    });

    test('should detect missing CA file if specified', () => {
      fs.existsSync.mockImplementation((path) => {
        return !path.includes('ca');
      });

      enforcer = new WSSEnforcer({
        enforceWss: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        caPath: '/path/to/ca.pem',
        logger: mockLogger
      });

      const result = enforcer.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('CA certificate file not found'))).toBe(true);
    });
  });

  describe('SSL Certificate Loading', () => {
    test('should return null when SSL not enforced and no certificates', () => {
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const sslOptions = enforcer.loadSslOptions();

      expect(sslOptions).toBeNull();
    });

    test('should load SSL certificates successfully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) {
          return '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----';
        } else if (path.includes('key')) {
          return '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----';
        }
        return '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----';
      });

      enforcer = new WSSEnforcer({
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        logger: mockLogger
      });

      const sslOptions = enforcer.loadSslOptions();

      expect(sslOptions).not.toBeNull();
      expect(sslOptions.cert).toBeDefined();
      expect(sslOptions.key).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('should throw error on invalid certificate format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('INVALID CERTIFICATE');

      enforcer = new WSSEnforcer({
        enforceWss: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        logger: mockLogger
      });

      expect(() => {
        enforcer.loadSslOptions();
      }).toThrow('Invalid certificate format');
    });

    test('should throw error on invalid key format', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) {
          return '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----';
        }
        return 'INVALID KEY';
      });

      enforcer = new WSSEnforcer({
        enforceWss: true,
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        logger: mockLogger
      });

      expect(() => {
        enforcer.loadSslOptions();
      }).toThrow('Invalid private key format');
    });

    test('should load CA certificate for client verification', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) {
          return '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----';
        } else if (path.includes('key')) {
          return '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----';
        } else {
          return '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----';
        }
      });

      enforcer = new WSSEnforcer({
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        caPath: '/path/to/ca.pem',
        logger: mockLogger
      });

      const sslOptions = enforcer.loadSslOptions();

      expect(sslOptions.ca).toBeDefined();
      expect(sslOptions.requestCert).toBe(true);
      expect(sslOptions.rejectUnauthorized).toBe(true);
    });

    test('should set TLS version and ciphers', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path.includes('cert')) {
          return '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----';
        }
        return '-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----';
      });

      enforcer = new WSSEnforcer({
        certPath: '/path/to/cert.pem',
        keyPath: '/path/to/key.pem',
        minTlsVersion: 'TLSv1.3',
        logger: mockLogger
      });

      const sslOptions = enforcer.loadSslOptions();

      expect(sslOptions.minVersion).toBe('TLSv1.3');
      expect(sslOptions.ciphers).toBeDefined();
    });
  });

  describe('HTTP Redirect Server', () => {
    test('should create HTTP redirect server', () => {
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const server = enforcer.createHttpRedirectServer();

      expect(server).toBeDefined();
      expect(server.on).toBeDefined();
    });

    test('should redirect HTTP requests to HTTPS', (done) => {
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const server = enforcer.createHttpRedirectServer();

      // Simulate HTTP request
      const mockReq = {
        headers: { host: 'example.com' },
        url: '/path/to/resource'
      };

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      // Get the request handler
      const requestHandler = server.listeners('request')[0];
      requestHandler(mockReq, mockRes);

      // Check redirect response
      expect(mockRes.writeHead).toHaveBeenCalledWith(308, expect.objectContaining({
        'Location': 'https://example.com/path/to/resource'
      }));
      expect(mockRes.end).toHaveBeenCalled();
      done();
    });
  });

  describe('HTTPS Redirect Middleware', () => {
    test('should pass through HTTPS requests', () => {
      enforcer = new WSSEnforcer({
        enforceHttpsRedirect: true,
        logger: mockLogger
      });

      const mockReq = {
        protocol: 'https',
        path: '/api/test',
        get: jest.fn((key) => {
          if (key === 'X-Forwarded-Proto') {
            return 'https';
          }
          if (key === 'host') {
            return 'example.com';
          }
          return undefined;
        }),
        originalUrl: '/api/test'
      };

      const mockRes = {
        redirect: jest.fn()
      };

      const next = jest.fn();

      enforcer.httpsRedirectMiddleware(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    test('should redirect HTTP requests to HTTPS', () => {
      enforcer = new WSSEnforcer({
        enforceHttpsRedirect: true,
        logger: mockLogger
      });

      const mockReq = {
        protocol: 'http',
        path: '/api/test',
        get: jest.fn((key) => {
          if (key === 'X-Forwarded-Proto') {
            return 'http';
          }
          if (key === 'host') {
            return 'example.com';
          }
          return undefined;
        }),
        originalUrl: '/api/test'
      };

      const mockRes = {
        redirect: jest.fn()
      };

      const next = jest.fn();

      enforcer.httpsRedirectMiddleware(mockReq, mockRes, next);

      expect(mockRes.redirect).toHaveBeenCalledWith(308, 'https://example.com/api/test');
      expect(next).not.toHaveBeenCalled();
    });

    test('should skip redirect when enforcement disabled', () => {
      enforcer = new WSSEnforcer({
        enforceHttpsRedirect: false,
        logger: mockLogger
      });

      const mockReq = {
        protocol: 'http',
        path: '/api/test',
        get: jest.fn(() => 'example.com'),
        originalUrl: '/api/test'
      };

      const mockRes = {
        redirect: jest.fn()
      };

      const next = jest.fn();

      enforcer.httpsRedirectMiddleware(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    test('should skip redirect for health check endpoints', () => {
      enforcer = new WSSEnforcer({
        enforceHttpsRedirect: true,
        logger: mockLogger
      });

      const mockReq = {
        protocol: 'http',
        path: '/health',
        get: jest.fn(() => 'example.com'),
        originalUrl: '/health'
      };

      const mockRes = {
        redirect: jest.fn()
      };

      const next = jest.fn();

      enforcer.httpsRedirectMiddleware(mockReq, mockRes, next);

      expect(next).toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Upgrade Validation', () => {
    test('should allow secure WebSocket upgrade', () => {
      enforcer = new WSSEnforcer({
        enforceWss: true,
        logger: mockLogger
      });

      const mockReq = {
        connection: { encrypted: true }
      };

      const result = enforcer.validateWebSocketUpgrade(mockReq);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject non-secure WebSocket upgrade when enforced', () => {
      enforcer = new WSSEnforcer({
        enforceWss: true,
        logger: mockLogger
      });

      const mockReq = {
        connection: { encrypted: false }
      };

      const result = enforcer.validateWebSocketUpgrade(mockReq);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('WSS');
    });

    test('should allow non-secure WebSocket upgrade when not enforced', () => {
      enforcer = new WSSEnforcer({
        enforceWss: false,
        logger: mockLogger
      });

      const mockReq = {
        connection: { encrypted: false }
      };

      const result = enforcer.validateWebSocketUpgrade(mockReq);

      expect(result.valid).toBe(true);
    });
  });

  describe('Status Reporting', () => {
    test('should report current status', () => {
      process.env.NODE_ENV = 'production';
      enforcer = new WSSEnforcer({
        enforceWss: true,
        logger: mockLogger
      });

      const status = enforcer.getStatus();

      expect(status.enforceWss).toBe(true);
      expect(status.environment).toBe('production');
      expect(status.validationState).toBeDefined();
    });

    test('should include validation errors in status', () => {
      process.env.NODE_ENV = 'production';
      enforcer = new WSSEnforcer({ logger: mockLogger });
      enforcer.validate();

      const status = enforcer.getStatus();

      expect(status.validationState.valid).toBe(false);
      expect(status.validationState.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Secure Cipher Suite', () => {
    test('should provide secure cipher suite', () => {
      enforcer = new WSSEnforcer({ logger: mockLogger });
      const ciphers = enforcer._getSecureCiphers();

      expect(typeof ciphers).toBe('string');
      expect(ciphers.includes('ECDHE')).toBe(true);
      expect(ciphers.includes('GCM')).toBe(true);
    });
  });
});

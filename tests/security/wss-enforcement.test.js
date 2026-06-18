/**
 * WSS (WebSocket Secure) Enforcement Tests
 *
 * Tests: 11+ TLS enforcement scenarios
 * Coverage:
 * - Credential commands require WSS in production
 * - Plain WS allowed in development
 * - Clear error messages for clients
 * - Non-credential commands bypass WSS check
 *
 * Version: 1.0.0
 * Created: June 15, 2026
 */

const { requireWSS, getTLSInfo } = require('../../websocket/middleware/tls-enforcement');

describe('WSS Enforcement Middleware', () => {
  describe('requireWSS()', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    test('allows WSS (encrypted) in production', () => {
      process.env.NODE_ENV = 'production';
      const req = {
        socket: {
          encrypted: true
        }
      };
      const result = requireWSS(req);
      expect(result).toBeNull();
    });

    test('blocks plain WS (unencrypted) in production', () => {
      process.env.NODE_ENV = 'production';
      const req = {
        socket: {
          encrypted: false
        }
      };
      const result = requireWSS(req);
      expect(result).not.toBeNull();
      expect(result.error).toBe('WSS_REQUIRED');
      expect(result.message).toContain('wss://');
    });

    test('allows plain WS in development', () => {
      process.env.NODE_ENV = 'development';
      const req = {
        socket: {
          encrypted: false
        }
      };
      const result = requireWSS(req);
      expect(result).toBeNull();
    });

    test('allows WSS in development', () => {
      process.env.NODE_ENV = 'development';
      const req = {
        socket: {
          encrypted: true
        }
      };
      const result = requireWSS(req);
      expect(result).toBeNull();
    });

    test('returns detailed error message for failed WSS check', () => {
      process.env.NODE_ENV = 'production';
      const req = {
        socket: {
          encrypted: false
        }
      };
      const result = requireWSS(req);
      expect(result.error).toBe('WSS_REQUIRED');
      expect(result.message).toContain('Credential commands');
      expect(result.message).toContain('wss://');
      expect(result.doc).toContain('SECURITY-GUIDE');
    });

    test('includes severity level in error response', () => {
      process.env.NODE_ENV = 'production';
      const req = {
        socket: {
          encrypted: false
        }
      };
      const result = requireWSS(req);
      expect(result.severity).toBe('CRITICAL');
    });

    test('handles missing socket gracefully', () => {
      process.env.NODE_ENV = 'production';
      const req = {};
      const result = requireWSS(req);
      // Should fail because no encrypted property
      expect(result).not.toBeNull();
      expect(result.error).toBe('WSS_REQUIRED');
    });

    test('handles null socket gracefully', () => {
      process.env.NODE_ENV = 'production';
      const req = {
        socket: null
      };
      const result = requireWSS(req);
      expect(result).not.toBeNull();
    });
  });

  describe('getTLSInfo()', () => {
    test('returns encrypted true for WSS connection', () => {
      const req = {
        socket: {
          encrypted: true
        }
      };
      const info = getTLSInfo(req);
      expect(info.isEncrypted).toBe(true);
    });

    test('returns encrypted false for WS connection', () => {
      const req = {
        socket: {
          encrypted: false
        }
      };
      const info = getTLSInfo(req);
      expect(info.isEncrypted).toBe(false);
    });

    test('extracts cipher information when available', () => {
      const req = {
        socket: {
          encrypted: true,
          getCipher: () => ({ name: 'TLS_AES_256_GCM_SHA384' })
        }
      };
      const info = getTLSInfo(req);
      expect(info.cipher).toBe('TLS_AES_256_GCM_SHA384');
    });

    test('extracts protocol information when available', () => {
      const req = {
        socket: {
          encrypted: true,
          getProtocol: () => 'TLSv1.3'
        }
      };
      const info = getTLSInfo(req);
      expect(info.protocol).toBe('TLSv1.3');
    });

    test('extracts version information when available', () => {
      const req = {
        socket: {
          encrypted: true,
          getProtocolVersion: () => '1.3'
        }
      };
      const info = getTLSInfo(req);
      expect(info.version).toBe('1.3');
    });

    test('handles missing TLS methods gracefully', () => {
      const req = {
        socket: {
          encrypted: true
          // No getCipher, getProtocol, or getProtocolVersion methods
        }
      };
      const info = getTLSInfo(req);
      expect(info.isEncrypted).toBe(true);
      expect(info.cipher).toBeNull();
      expect(info.protocol).toBeNull();
      expect(info.version).toBeNull();
    });

    test('returns default values for missing socket', () => {
      const req = {};
      const info = getTLSInfo(req);
      expect(info.isEncrypted).toBe(false);
      expect(info.cipher).toBeNull();
      expect(info.protocol).toBeNull();
      expect(info.version).toBeNull();
    });

    test('handles null socket gracefully', () => {
      const req = {
        socket: null
      };
      const info = getTLSInfo(req);
      expect(info.isEncrypted).toBe(false);
      expect(info.cipher).toBeNull();
    });
  });
});

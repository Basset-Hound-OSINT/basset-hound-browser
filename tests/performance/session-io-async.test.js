/**
 * Performance tests for async session I/O operations
 * Tests optimization of session capture and restore latency
 *
 * Target: -30ms latency improvement on session save/restore
 */

const BrowserStateCapture = require('../../src/sessions/state-capture');
const BrowserStateRestore = require('../../src/sessions/state-restore');
const { Writable, Readable } = require('stream');
const crypto = require('crypto');

describe('Session I/O Async Performance', () => {
  let capture;
  let restore;

  beforeEach(() => {
    capture = new BrowserStateCapture({
      compressionEnabled: true,
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }
    });

    restore = new BrowserStateRestore({
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }
    });
  });

  describe('Session Capture Performance', () => {
    it('should capture state with <50ms latency (async)', async () => {
      // Mock webContents
      const mockWebContents = {
        session: {
          cookies: {
            get: jest.fn().mockResolvedValue([
              {
                name: 'session_id',
                value: 'abc123',
                domain: 'example.com',
                path: '/',
                secure: true
              }
            ])
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({
          localStorage: { key1: 'value1' },
          sessionStorage: {},
          indexedDB: {}
        })
      };

      const startTime = performance.now();
      const state = await capture.captureState(mockWebContents);
      const duration = performance.now() - startTime;

      expect(state).toBeDefined();
      expect(state.cookies).toHaveLength(1);
      expect(duration).toBeLessThan(50);
    });

    it('should handle large state compression (>5MB)', async () => {
      // Create large state
      const largeStorage = {};
      for (let i = 0; i < 5000; i++) {
        largeStorage[`key_${i}`] = 'x'.repeat(1000); // 1KB per key
      }

      const mockWebContents = {
        session: {
          cookies: {
            get: jest.fn().mockResolvedValue([
              { name: 'test', value: 'test' }
            ])
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({
          localStorage: largeStorage,
          sessionStorage: {},
          indexedDB: {}
        })
      };

      const startTime = performance.now();
      const state = await capture.captureState(mockWebContents);
      const duration = performance.now() - startTime;

      expect(state.metadata.compressed).toBe(true);
      expect(parseFloat(state.metadata.compressionRatio)).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // Should complete reasonably fast
    });

    it('should provide compression statistics', async () => {
      const mockWebContents = {
        session: {
          cookies: {
            get: jest.fn().mockResolvedValue([])
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({
          localStorage: { test: 'value' },
          sessionStorage: {},
          indexedDB: {}
        })
      };

      const state = await capture.captureState(mockWebContents);

      expect(state.metadata.sizeBytes).toBeGreaterThan(0);
      expect(state.metadata.compressedBytes).toBeGreaterThan(0);
      expect(state.metadata.compressionRatio).toBeDefined();
      expect(parseFloat(state.metadata.compressionRatio)).toBeGreaterThan(0);
    });

    it('should handle streaming compression for large payloads', async () => {
      const stateJson = JSON.stringify({
        cookies: Array(1000).fill({ name: 'test', value: 'test' }),
        localStorage: Array(1000).fill(null).reduce((acc, _, i) => {
          acc[`key_${i}`] = 'x'.repeat(100);
          return acc;
        }, {})
      });

      const chunks = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      const startTime = performance.now();
      await capture.compressStateStream(stateJson, writeStream);
      const duration = performance.now() - startTime;

      expect(chunks.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Session Restore Performance', () => {
    it('should restore state with <100ms latency (async)', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: crypto.randomBytes(16).toString('hex'),
        cookies: [
          {
            name: 'session_id',
            value: 'abc123',
            domain: 'example.com',
            secure: true,
            httpOnly: false,
            sameSite: 'Lax'
          }
        ],
        localStorage: { key1: 'value1' },
        sessionStorage: {},
        metadata: {
          sizeBytes: 1000,
          timestamp: Date.now(),
          version: 1
        }
      };

      const mockWebContents = {
        session: {
          cookies: {
            set: jest.fn().mockResolvedValue(null)
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({ restored: 1, failed: 0 })
      };

      const startTime = performance.now();
      const result = await restore.restoreState(mockWebContents, savedState);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    it('should restore with parallel cookie and storage operations', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: crypto.randomBytes(16).toString('hex'),
        cookies: Array(50).fill(null).map((_, i) => ({
          name: `session_${i}`,
          value: `value_${i}`,
          domain: 'example.com',
          secure: false,
          sameSite: 'Lax'
        })),
        localStorage: Array(50).fill(null).reduce((acc, _, i) => {
          acc[`key_${i}`] = `value_${i}`;
          return acc;
        }, {}),
        sessionStorage: {},
        metadata: {
          sizeBytes: 5000,
          timestamp: Date.now(),
          version: 1
        }
      };

      const mockWebContents = {
        session: {
          cookies: {
            set: jest.fn().mockResolvedValue(null)
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({ restored: 50, failed: 0 })
      };

      const startTime = performance.now();
      const result = await restore.restoreState(mockWebContents, savedState);
      const duration = performance.now() - startTime;

      expect(result.restored.cookies).toBeGreaterThan(0);
      expect(duration).toBeLessThan(150);
    });

    it('should handle streaming decompression for large payloads', async () => {
      // Create compressed data
      const zlib = require('zlib');
      const originalData = JSON.stringify({
        cookies: [],
        localStorage: Array(100).fill(null).reduce((acc, _, i) => {
          acc[`key_${i}`] = 'x'.repeat(1000);
          return acc;
        }, {})
      });

      const compressed = zlib.gzipSync(originalData);

      // Create readable stream from compressed data
      const readStream = Readable.from([compressed]);

      const startTime = performance.now();
      const decompressed = await restore.decompressStateStream(readStream);
      const duration = performance.now() - startTime;

      expect(decompressed).toBeDefined();
      expect(decompressed.localStorage).toBeDefined();
      expect(duration).toBeLessThan(200);
    });

    it('should preserve state accuracy during async restore', async () => {
      const originalState = {
        capturedAt: new Date().toISOString(),
        sessionId: crypto.randomBytes(16).toString('hex'),
        cookies: [
          {
            name: 'auth_token',
            value: 'token_12345',
            domain: 'api.example.com',
            path: '/api',
            secure: true,
            httpOnly: true,
            sameSite: 'Strict'
          }
        ],
        localStorage: { user_id: '42', theme: 'dark' },
        sessionStorage: { temp: 'data' },
        metadata: {
          sizeBytes: 1000,
          timestamp: Date.now(),
          version: 1
        }
      };

      const mockWebContents = {
        session: {
          cookies: {
            set: jest.fn().mockResolvedValue(null)
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({ restored: 2, failed: 0 })
      };

      const result = await restore.restoreState(mockWebContents, originalState);

      expect(result.restored.cookies).toBe(1);
      expect(result.success).toBe(true);

      // Verify that cookie was called with correct attributes
      const setCookieCall = mockWebContents.session.cookies.set.mock.calls[0][0];
      expect(setCookieCall.name).toBe('auth_token');
      expect(setCookieCall.value).toBe('token_12345');
      expect(setCookieCall.secure).toBe(true);
      expect(setCookieCall.httpOnly).toBe(true);
    });
  });

  describe('Round-trip Performance', () => {
    it('should complete capture + restore cycle <300ms', async () => {
      const mockWebContents = {
        session: {
          cookies: {
            get: jest.fn().mockResolvedValue([
              {
                name: 'test',
                value: 'value',
                domain: 'example.com',
                secure: true
              }
            ]),
            set: jest.fn().mockResolvedValue(null)
          }
        },
        executeJavaScript: jest.fn().mockResolvedValue({
          localStorage: { key: 'value' },
          sessionStorage: {},
          indexedDB: {}
        })
      };

      const startTime = performance.now();

      // Capture
      const captured = await capture.captureState(mockWebContents);

      // Restore with partial mode enabled
      const result = await restore.restoreState(mockWebContents, captured, { partial: true });

      const duration = performance.now() - startTime;

      expect(result.restored.cookies).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(300);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create excessive memory overhead during streaming', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create large state
      const largeState = JSON.stringify({
        cookies: [],
        localStorage: Array(10000).fill(null).reduce((acc, _, i) => {
          acc[`key_${i}`] = 'x'.repeat(100);
          return acc;
        }, {})
      });

      const chunks = [];
      const writeStream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      await capture.compressStateStream(largeState, writeStream);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      // Should not increase memory by more than 50MB
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});

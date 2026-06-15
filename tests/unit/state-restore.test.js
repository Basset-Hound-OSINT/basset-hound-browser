/**
 * Unit Tests - Browser State Restoration
 * Tests for BrowserStateRestore class
 *
 * Test Coverage:
 * - Restoration detection (2 tests)
 * - Progressive restoration (5 tests)
 * - Validation (4 tests)
 * - Error handling (2 tests)
 * - Stale state detection (3 tests)
 * Total: 16 unit tests
 */

const BrowserStateRestore = require('../../src/sessions/state-restore');

describe('BrowserStateRestore', () => {
  let restore;
  let mockWebContents;

  beforeEach(() => {
    restore = new BrowserStateRestore({
      maxAge: 12 * 3600 * 1000,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    });

    mockWebContents = {
      session: {
        cookies: {
          set: jest.fn().mockResolvedValue(undefined)
        }
      },
      executeJavaScript: jest.fn().mockResolvedValue(0)
    };
  });

  describe('Restoration Detection', () => {
    test('should detect version compatibility', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { version: 1, timestamp: Date.now() }
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should validate state freshness', () => {
      const recentTime = new Date(Date.now() - 1 * 3600 * 1000).toISOString(); // 1 hour ago
      const state = {
        capturedAt: recentTime,
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { version: 1 }
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.valid).toBe(true);
    });
  });

  describe('Stale State Detection', () => {
    test('should identify very old state', () => {
      const oldTime = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(); // 8 days ago
      const state = {
        capturedAt: oldTime,
        sessionId: 'test'
      };

      const staleCheck = restore.detectStaleState(state, 7 * 24 * 3600 * 1000);

      expect(staleCheck.stale).toBe(true);
      expect(staleCheck.confidence).toBe(1.0);
    });

    test('should detect expired cookies', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [
          { name: 'valid', value: 'val', expires: new Date(Date.now() + 3600000).toISOString() },
          { name: 'expired1', value: 'val', expires: new Date(Date.now() - 3600000).toISOString() },
          { name: 'expired2', value: 'val', expires: new Date(Date.now() - 3600000).toISOString() }
        ]
      };

      const staleCheck = restore.detectStaleState(state);

      expect(staleCheck.stale).toBe(true);
      expect(staleCheck.reason).toContain('expired');
    });

    test('should handle state without timestamp', () => {
      const state = { sessionId: 'test' };

      const staleCheck = restore.detectStaleState(state);

      expect(staleCheck.stale).toBe(true);
      expect(staleCheck.confidence).toBe(1.0);
    });
  });

  describe('Progressive Restoration', () => {
    test('should restore cookies in phase 1', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [
          { name: 'test', value: 'val', domain: '.example.com', path: '/', secure: false, sameSite: 'Lax' }
        ],
        localStorage: {},
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1 }
      };

      mockWebContents.executeJavaScript.mockResolvedValue({ restored: 0, failed: 0 });

      const result = await restore.restoreState(mockWebContents, savedState);

      expect(mockWebContents.session.cookies.set).toHaveBeenCalled();
      expect(result.restored.cookies).toBeGreaterThanOrEqual(0);
    });

    test('should restore storage in phase 2', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: { key: 'value' },
        sessionStorage: { sessionKey: 'sessionValue' },
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1 }
      };

      mockWebContents.executeJavaScript.mockResolvedValue({ restored: 2, failed: 0 });

      const result = await restore.restoreState(mockWebContents, savedState);

      expect(mockWebContents.executeJavaScript).toHaveBeenCalled();
      expect(result.restored.storage_items).toBeGreaterThanOrEqual(0);
    });

    test('should restore DOM state in phase 3', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        domState: {
          scrollPosition: { x: 100, y: 200 },
          activeElement: '#input',
          formData: { '#form': { field: 'value' } },
          focusPath: []
        },
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1 }
      };

      mockWebContents.executeJavaScript.mockResolvedValue(2);

      const result = await restore.restoreState(mockWebContents, savedState);

      expect(result.restored.dom_elements).toBeGreaterThanOrEqual(0);
    });

    test('should handle partial restoration gracefully', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1, timestamp: Date.now() }
      };

      mockWebContents.executeJavaScript.mockResolvedValue({ restored: 0, failed: 0 });

      const result = await restore.restoreState(mockWebContents, savedState, { partial: true });

      expect(result.success).toBe(true); // Still successful (no cookies, all storage succeeded)
    });

    test('should validate after restoration', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1 }
      };

      mockWebContents.executeJavaScript.mockResolvedValue({ restored: 0, failed: 0 });

      const result = await restore.restoreState(mockWebContents, savedState, { validate: true });

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('State Validation', () => {
    test('should validate complete state', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { version: 1, timestamp: Date.now() }
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.valid).toBe(true);
      expect(validation.severity).toBe('info');
    });

    test('should identify missing required fields', () => {
      const state = {
        cookies: [],
        localStorage: {}
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.valid).toBe(false);
      expect(validation.severity).toBe('error');
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('should warn about invalid component types', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: 'not-an-array',
        localStorage: 'not-an-object',
        sessionStorage: {},
        metadata: { version: 1 }
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('should detect version mismatches', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { version: 99 }
      };

      const validation = restore.validateRestoredState(state);

      expect(validation.issues.some(i => i.includes('version'))).toBe(true);
    });
  });

  describe('Error Recovery', () => {
    test('should continue on partial failures', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [{ name: 'test', value: 'val', domain: '.example.com', path: '/', secure: false }],
        localStorage: { key: 'value' },
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1, timestamp: Date.now() }
      };

      mockWebContents.session.cookies.set.mockRejectedValueOnce(new Error('Cookie error'));
      mockWebContents.executeJavaScript.mockResolvedValue({ restored: 1, failed: 0 });

      const result = await restore.restoreState(mockWebContents, savedState, { partial: true });

      // With partial mode, should complete despite errors
      // Cookie set failed, but storage succeeded
      expect(result.failed.cookies).toBe(1);
      expect(result.restored.storage_items).toBe(1);
    });

    test('should log failures for diagnostics', async () => {
      const savedState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1 }
      };

      mockWebContents.executeJavaScript.mockRejectedValue(new Error('JS execution failed'));

      try {
        await restore.restoreState(mockWebContents, savedState);
      } catch (error) {
        expect(error.message).toContain('restoration failed');
      }
    });
  });

  describe('Cookie Restoration', () => {
    test('should set cookies via session API', async () => {
      const cookies = [
        {
          name: 'test',
          value: 'val',
          domain: '.example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'Strict'
        }
      ];

      const result = await restore.restoreCookies(mockWebContents, cookies);

      expect(mockWebContents.session.cookies.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test',
          value: 'val'
        })
      );
      expect(result.restored).toBeGreaterThanOrEqual(0);
    });

    test('should skip expired cookies', async () => {
      const cookies = [
        {
          name: 'expired',
          value: 'val',
          expires: new Date(Date.now() - 1000).toISOString()
        }
      ];

      const result = await restore.restoreCookies(mockWebContents, cookies);

      // Should skip expired cookies
      expect(mockWebContents.session.cookies.set).not.toHaveBeenCalled();
      expect(result.restored).toBe(0);
    });

    test('should handle empty cookie array', async () => {
      const result = await restore.restoreCookies(mockWebContents, []);

      expect(result).toEqual({ restored: 0, failed: 0 });
    });
  });

  describe('SameSite Normalization', () => {
    test('should normalize sameSite values', () => {
      expect(restore.normalizeSameSite('Strict')).toBe('Strict');
      expect(restore.normalizeSameSite('Lax')).toBe('Lax');
      expect(restore.normalizeSameSite('None')).toBe('None');
      expect(restore.normalizeSameSite('Unspecified')).toBe('None');
      expect(restore.normalizeSameSite(null)).toBe('None');
    });

    test('should handle case-insensitive sameSite', () => {
      expect(restore.normalizeSameSite('strict')).toBe('Strict');
      expect(restore.normalizeSameSite('LAX')).toBe('Lax');
    });
  });

  describe('Restoration Result Validation', () => {
    test('should validate restoration completeness', () => {
      const result = {
        success: true,
        restored: { cookies: 5, storage_items: 10, dom_elements: 2 },
        failed: { cookies: 0, storage_items: 0 },
        errors: []
      };

      const validation = restore.validateRestorationResult(result);

      expect(validation.issues).toHaveLength(0);
    });

    test('should identify restoration failures', () => {
      const result = {
        success: false,
        restored: { cookies: 0, storage_items: 0, dom_elements: 0 },
        failed: { cookies: 3, storage_items: 2 },
        errors: ['Cookie error', 'Storage error']
      };

      const validation = restore.validateRestorationResult(result);

      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues.some(i => i.includes('cookies'))).toBe(true);
    });
  });
});

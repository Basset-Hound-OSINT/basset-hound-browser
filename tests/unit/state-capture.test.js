/**
 * Unit Tests - Browser State Capture
 * Tests for BrowserStateCapture class
 *
 * Test Coverage:
 * - Cookie extraction (5 tests)
 * - Storage snapshot (5 tests)
 * - DOM state capture (3 tests)
 * - Navigation state (2 tests)
 * - Validation (2 tests)
 * - Compression (3 tests)
 * Total: 20 unit tests
 */

const BrowserStateCapture = require('../../src/sessions/state-capture');

describe('BrowserStateCapture', () => {
  let capture;
  let mockWebContents;

  beforeEach(() => {
    capture = new BrowserStateCapture({
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    });

    // Mock WebContents
    mockWebContents = {
      session: {
        cookies: {
          get: jest.fn().mockResolvedValue([])
        }
      },
      executeJavaScript: jest.fn().mockResolvedValue({})
    };
  });

  describe('Cookie Extraction', () => {
    test('should extract all cookies with attributes preserved', async () => {
      const mockCookies = [
        {
          name: 'session_id',
          value: 'abc123',
          domain: '.example.com',
          path: '/',
          expirationDate: 1234567890,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          session: false
        }
      ];

      mockWebContents.session.cookies.get.mockResolvedValue(mockCookies);

      const cookies = await capture.captureCookies(mockWebContents);

      expect(cookies).toHaveLength(1);
      expect(cookies[0].name).toBe('session_id');
      expect(cookies[0].value).toBe('abc123');
      expect(cookies[0].domain).toBe('.example.com');
      expect(cookies[0].httpOnly).toBe(true);
      expect(cookies[0].secure).toBe(true);
    });

    test('should filter out cookies without name or value', async () => {
      const mockCookies = [
        { name: 'valid', value: 'cookie' },
        { name: '', value: 'invalid' },
        { name: 'invalid', value: '' }
      ];

      mockWebContents.session.cookies.get.mockResolvedValue(mockCookies);

      const cookies = await capture.captureCookies(mockWebContents);

      expect(cookies).toHaveLength(1);
      expect(cookies[0].name).toBe('valid');
    });

    test('should handle empty cookie jar', async () => {
      mockWebContents.session.cookies.get.mockResolvedValue([]);

      const cookies = await capture.captureCookies(mockWebContents);

      expect(cookies).toEqual([]);
    });

    test('should preserve cookie flags', async () => {
      const mockCookies = [
        {
          name: 'test',
          value: 'val',
          httpOnly: false,
          secure: false,
          sameSite: 'Lax'
        }
      ];

      mockWebContents.session.cookies.get.mockResolvedValue(mockCookies);

      const cookies = await capture.captureCookies(mockWebContents);

      expect(cookies[0].httpOnly).toBe(false);
      expect(cookies[0].secure).toBe(false);
      expect(cookies[0].sameSite).toBe('Lax');
    });

    test('should handle cookie capture errors gracefully', async () => {
      mockWebContents.session.cookies.get.mockRejectedValue(new Error('Access denied'));

      const cookies = await capture.captureCookies(mockWebContents);

      expect(cookies).toEqual([]);
    });
  });

  describe('Storage Snapshot', () => {
    test('should capture localStorage items', async () => {
      const storageData = {
        localStorage: { key1: 'value1', key2: 'value2' },
        sessionStorage: {},
        indexedDB: {}
      };

      mockWebContents.executeJavaScript.mockResolvedValue(storageData);

      const storage = await capture.captureStorage(mockWebContents);

      expect(storage.localStorage).toEqual({ key1: 'value1', key2: 'value2' });
    });

    test('should capture sessionStorage items', async () => {
      const storageData = {
        localStorage: {},
        sessionStorage: { tabState: 'active' },
        indexedDB: {}
      };

      mockWebContents.executeJavaScript.mockResolvedValue(storageData);

      const storage = await capture.captureStorage(mockWebContents);

      expect(storage.sessionStorage).toEqual({ tabState: 'active' });
    });

    test('should enumerate IndexedDB databases', async () => {
      const storageData = {
        localStorage: {},
        sessionStorage: {},
        indexedDB: {
          mydb: { version: 1, object_stores: ['enumerated'] }
        }
      };

      mockWebContents.executeJavaScript.mockResolvedValue(storageData);

      const storage = await capture.captureStorage(mockWebContents);

      expect(storage.indexedDB.mydb).toBeDefined();
      expect(storage.indexedDB.mydb.version).toBe(1);
    });

    test('should handle empty storage gracefully', async () => {
      mockWebContents.executeJavaScript.mockResolvedValue({
        localStorage: {},
        sessionStorage: {},
        indexedDB: {}
      });

      const storage = await capture.captureStorage(mockWebContents);

      expect(storage.localStorage).toEqual({});
      expect(storage.sessionStorage).toEqual({});
    });

    test('should handle storage capture errors', async () => {
      mockWebContents.executeJavaScript.mockRejectedValue(new Error('Script failed'));

      const storage = await capture.captureStorage(mockWebContents);

      expect(storage).toEqual({ localStorage: {}, sessionStorage: {}, indexedDB: {} });
    });
  });

  describe('DOM State Capture', () => {
    test('should capture scroll position', async () => {
      const domData = {
        activeElement: 'input#search',
        scrollPosition: { x: 100, y: 200 },
        formData: {},
        focusPath: []
      };

      mockWebContents.executeJavaScript.mockResolvedValue(domData);

      const domState = await capture.captureDOMState(mockWebContents);

      expect(domState.scrollPosition.x).toBe(100);
      expect(domState.scrollPosition.y).toBe(200);
    });

    test('should capture focused element selector', async () => {
      const domData = {
        activeElement: '#search-input',
        scrollPosition: { x: 0, y: 0 },
        formData: {},
        focusPath: []
      };

      mockWebContents.executeJavaScript.mockResolvedValue(domData);

      const domState = await capture.captureDOMState(mockWebContents);

      expect(domState.activeElement).toBe('#search-input');
    });

    test('should capture form field values', async () => {
      const domData = {
        activeElement: null,
        scrollPosition: { x: 0, y: 0 },
        formData: {
          '#form-id': {
            field1: 'value1',
            field2: true,
            field3: ['multi', 'select']
          }
        },
        focusPath: []
      };

      mockWebContents.executeJavaScript.mockResolvedValue(domData);

      const domState = await capture.captureDOMState(mockWebContents);

      expect(domState.formData['#form-id'].field1).toBe('value1');
    });
  });

  describe('Navigation State', () => {
    test('should capture current URL and title', async () => {
      const navData = {
        currentUrl: 'https://example.com/page',
        title: 'Example Page',
        scrollRestoration: 'auto',
        historyLength: 5
      };

      mockWebContents.executeJavaScript.mockResolvedValue(navData);

      const navState = await capture.captureNavigationState(mockWebContents);

      expect(navState.currentUrl).toBe('https://example.com/page');
      expect(navState.title).toBe('Example Page');
    });

    test('should handle navigation state capture errors', async () => {
      mockWebContents.executeJavaScript.mockRejectedValue(new Error('Script failed'));

      const navState = await capture.captureNavigationState(mockWebContents);

      expect(navState.currentUrl).toBe('');
      expect(navState.title).toBe('');
    });
  });

  describe('State Validation', () => {
    test('should validate state completeness', () => {
      const completeState = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test-id',
        url: 'https://example.com',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        domState: {},
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { timestamp: Date.now(), version: 1 }
      };

      const validation = capture.validateState(completeState);

      expect(validation.valid).toBe(true);
      expect(validation.missing).toHaveLength(0);
    });

    test('should identify missing required fields', () => {
      const incompleteState = {
        cookies: [],
        localStorage: {}
      };

      const validation = capture.validateState(incompleteState);

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('capturedAt');
      expect(validation.missing).toContain('sessionId');
    });
  });

  describe('Compression', () => {
    test('should compress state', async () => {
      const stateJson = JSON.stringify({
        cookies: [],
        localStorage: { key: 'value'.repeat(100) }
      });

      const compressed = await capture.compressState(stateJson);

      expect(compressed).toBeInstanceOf(Buffer);
      expect(compressed.length).toBeLessThan(stateJson.length);
    });

    test('should decompress state', async () => {
      const originalState = { test: 'data', value: 123 };
      const stateJson = JSON.stringify(originalState);
      const compressed = await capture.compressState(stateJson);

      const decompressed = await capture.decompressState(compressed);

      expect(decompressed).toEqual(originalState);
    });

    test('should estimate uncompressed size', () => {
      const state = {
        cookies: [{ name: 'test', value: 'value' }],
        localStorage: { key: 'value' }
      };

      const size = capture.estimateSize(state);

      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });
  });

  describe('Full Capture Flow', () => {
    test('should capture complete state with all components', async () => {
      mockWebContents.session.cookies.get.mockResolvedValue([
        { name: 'test', value: 'val', domain: '.example.com' }
      ]);

      mockWebContents.executeJavaScript.mockResolvedValue({
        localStorage: { key: 'value' },
        sessionStorage: {},
        indexedDB: {},
        activeElement: '#test',
        scrollPosition: { x: 0, y: 0 },
        formData: {},
        focusPath: [],
        currentUrl: 'https://example.com',
        title: 'Test Page',
        scrollRestoration: 'auto',
        historyLength: 1
      });

      const state = await capture.captureState(mockWebContents, {
        profileId: 'test-profile',
        includeDOM: true
      });

      expect(state.capturedAt).toBeDefined();
      expect(state.sessionId).toBeDefined();
      expect(state.cookies).toHaveLength(1);
      expect(state.localStorage.key).toBe('value');
      expect(state.metadata).toBeDefined();
      expect(state.metadata.sizeBytes).toBeGreaterThan(0);
    });

    test('should include compression metadata when enabled', async () => {
      mockWebContents.session.cookies.get.mockResolvedValue([]);
      mockWebContents.executeJavaScript.mockResolvedValue({
        localStorage: {},
        sessionStorage: {},
        indexedDB: {},
        activeElement: null,
        scrollPosition: { x: 0, y: 0 },
        formData: {},
        focusPath: [],
        currentUrl: 'https://example.com',
        title: 'Test',
        scrollRestoration: 'auto',
        historyLength: 0
      });

      const state = await capture.captureState(mockWebContents, {
        includeDOM: true
      });

      expect(state.metadata.compressed).toBe(true);
      expect(state.metadata.compressionRatio).toBeDefined();
      expect(parseFloat(state.metadata.compressionRatio)).toBeGreaterThan(0);
    });
  });

  describe('Session ID Generation', () => {
    test('should generate unique session IDs', () => {
      const id1 = capture.generateSessionId();
      const id2 = capture.generateSessionId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(id1.length).toBe(32); // 16 bytes as hex
    });
  });

  describe('Checksum Calculation', () => {
    test('should calculate consistent checksums', () => {
      const state = { test: 'data' };

      const checksum1 = capture.calculateChecksum(state);
      const checksum2 = capture.calculateChecksum(state);

      expect(checksum1).toBe(checksum2);
      expect(checksum1.length).toBe(64); // SHA256 hex
    });

    test('should produce different checksums for different states', () => {
      const state1 = { test: 'data1' };
      const state2 = { test: 'data2' };

      const checksum1 = capture.calculateChecksum(state1);
      const checksum2 = capture.calculateChecksum(state2);

      expect(checksum1).not.toBe(checksum2);
    });
  });
});

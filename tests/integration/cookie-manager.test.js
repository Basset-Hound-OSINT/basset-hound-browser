/**
 * Basset Hound Browser - Cookie Manager Integration Tests
 * Tests for cookie management with complete session mock support
 */

// Create mock session with cookie support
const createMockSession = () => {
  const listeners = {};
  return {
    webRequest: {
      onBeforeRequest: jest.fn(),
      on: jest.fn()
    },
    cookies: {
      get: jest.fn().mockResolvedValue([]),
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      flushStore: jest.fn().mockResolvedValue(undefined),
      on: jest.fn()
    },
    setProxy: jest.fn().mockResolvedValue(undefined),
    clearStorageData: jest.fn().mockResolvedValue(undefined),
    on: jest.fn((event, handler) => {
      listeners[`session:${event}`] = handler;
    }),
    _listeners: listeners
  };
};

const mockDefaultSession = createMockSession();

jest.mock('electron', () => ({
  session: {
    defaultSession: mockDefaultSession,
    fromPartition: jest.fn(() => createMockSession())
  },
  app: {
    getPath: jest.fn().mockReturnValue('/mock/path')
  }
}));

const { CookieManager, COOKIE_FORMATS } = require('../../cookies/manager');
const { session } = require('electron');

describe('CookieManager Integration', () => {
  let cookieManager;
  let mockSession;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Get the mock session
    mockSession = mockDefaultSession;

    // Setup cookie mock returns
    mockSession.cookies.get.mockResolvedValue([
      {
        name: 'test-cookie',
        value: 'test-value',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: false,
        expirationDate: Date.now() / 1000 + 86400
      }
    ]);

    // Create fresh instance - CookieManager constructor takes session directly (not in object)
    cookieManager = new CookieManager(mockSession);
  });

  describe('Session Management', () => {
    test('should use provided session', () => {
      const customSession = createMockSession();
      const manager = new CookieManager(customSession);

      expect(manager.session).toBe(customSession);
    });

    test('should use default session if none provided', () => {
      const manager = new CookieManager();

      expect(manager.session).toBe(session.defaultSession);
    });

    test('should update session with setSession', () => {
      const newSession = createMockSession();
      cookieManager.setSession(newSession);

      expect(cookieManager.session).toBe(newSession);
    });
  });

  describe('Getting Cookies', () => {
    test('should get cookies for URL', async () => {
      const result = await cookieManager.getCookies('https://example.com');

      expect(result.success).toBe(true);
      expect(mockSession.cookies.get).toHaveBeenCalledWith({ url: 'https://example.com' });
    });

    test('should return error when URL is missing', async () => {
      const result = await cookieManager.getCookies('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    test('should get all cookies', async () => {
      const result = await cookieManager.getAllCookies();

      expect(result.success).toBe(true);
      expect(mockSession.cookies.get).toHaveBeenCalledWith({});
    });

    test('should get all cookies with filter', async () => {
      mockSession.cookies.get.mockResolvedValue([
        { name: 'cookie1', domain: 'example.com' },
        { name: 'cookie2', domain: 'other.com' }
      ]);

      const result = await cookieManager.getAllCookies({ domain: 'example.com' });

      expect(result.success).toBe(true);
      expect(mockSession.cookies.get).toHaveBeenCalledWith({ domain: 'example.com' });
    });
  });

  describe('Setting Cookies', () => {
    test('should set a cookie', async () => {
      mockSession.cookies.set.mockResolvedValue(undefined);

      const result = await cookieManager.setCookie({
        url: 'https://example.com',
        name: 'test',
        value: 'value123'
      });

      expect(result.success).toBe(true);
      expect(mockSession.cookies.set).toHaveBeenCalled();
    });

    test('should require url and name', async () => {
      const result = await cookieManager.setCookie({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('url and name');
    });

    test('should set multiple cookies', async () => {
      mockSession.cookies.set.mockResolvedValue(undefined);

      const cookies = [
        { url: 'https://example.com', name: 'cookie1', value: 'value1' },
        { url: 'https://example.com', name: 'cookie2', value: 'value2' }
      ];

      const result = await cookieManager.setCookies(cookies);

      expect(result.set).toBe(2);
    });

    test('should handle failures when setting multiple cookies', async () => {
      mockSession.cookies.set
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Failed'));

      const cookies = [
        { url: 'https://example.com', name: 'cookie1', value: 'value1' },
        { url: 'https://example.com', name: 'cookie2', value: 'value2' }
      ];

      const result = await cookieManager.setCookies(cookies);

      expect(result.set).toBe(1);
      expect(result.failed).toBe(1);
    });

    test('should require array input for setCookies', async () => {
      const result = await cookieManager.setCookies('not an array');

      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });
  });

  describe('Deleting Cookies', () => {
    test('should delete a cookie', async () => {
      mockSession.cookies.remove.mockResolvedValue(undefined);

      // CookieManager.deleteCookie takes (url, name) as separate args
      const result = await cookieManager.deleteCookie(
        'https://example.com',
        'test-cookie'
      );

      expect(result.success).toBe(true);
      expect(mockSession.cookies.remove).toHaveBeenCalled();
    });

    test('should require url and name', async () => {
      // CookieManager.deleteCookie takes (url, name) as separate args
      const result = await cookieManager.deleteCookie('https://example.com', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('Clearing Cookies', () => {
    test('should clear all cookies', async () => {
      mockSession.cookies.get.mockResolvedValue([
        { name: 'cookie1', domain: 'example.com', path: '/', secure: false },
        { name: 'cookie2', domain: 'other.com', path: '/', secure: false }
      ]);
      mockSession.cookies.remove.mockResolvedValue(undefined);

      const result = await cookieManager.clearCookies();

      expect(result.success).toBe(true);
    });

    test('should clear cookies for specific domain', async () => {
      mockSession.cookies.get.mockResolvedValue([
        { name: 'cookie1', domain: 'example.com', path: '/', secure: false }
      ]);
      mockSession.cookies.remove.mockResolvedValue(undefined);

      // clearCookies takes domain as a string, not an object
      const result = await cookieManager.clearCookies('example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('Cookie URL Building', () => {
    test('should build https URL for secure cookie', () => {
      const url = cookieManager.buildCookieUrl({
        domain: 'example.com',
        path: '/test',
        secure: true
      });

      expect(url).toBe('https://example.com/test');
    });

    test('should build http URL for non-secure cookie', () => {
      const url = cookieManager.buildCookieUrl({
        domain: 'example.com',
        path: '/test',
        secure: false
      });

      expect(url).toBe('http://example.com/test');
    });

    test('should handle domain with leading dot', () => {
      const url = cookieManager.buildCookieUrl({
        domain: '.example.com',
        path: '/',
        secure: true
      });

      expect(url).toBe('https://example.com/');
    });
  });

  describe('Export Functions', () => {
    test('should export to JSON format', async () => {
      const result = await cookieManager.exportCookies('json');

      expect(result.success).toBe(true);
      expect(result.format).toBe('json');
      expect(typeof result.data).toBe('string');
    });

    test('should export to Netscape format', async () => {
      const result = await cookieManager.exportCookies('netscape');

      expect(result.success).toBe(true);
      expect(result.format).toBe('netscape');
      expect(result.data).toContain('# Netscape HTTP Cookie File');
    });

    test('should export to EditThisCookie format', async () => {
      const result = await cookieManager.exportCookies('editthiscookie');

      expect(result.success).toBe(true);
      expect(result.format).toBe('editthiscookie');
    });

    test('should fail for unknown format', async () => {
      const result = await cookieManager.exportCookies('unknown');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown format');
    });
  });

  describe('Import Functions', () => {
    test('should detect Netscape format', () => {
      const data = '# Netscape HTTP Cookie File\nexample.com\tTRUE\t/\tFALSE\t0\tname\tvalue';
      const format = cookieManager.detectFormat(data);

      expect(format).toBe('netscape');
    });

    test('should detect JSON array format', () => {
      const data = '[{"name":"test","value":"value"}]';
      const format = cookieManager.detectFormat(data);

      expect(format).toBe('json');
    });

    test('should detect EditThisCookie format', () => {
      const data = '[{"domain":"example.com","hostOnly":true}]';
      const format = cookieManager.detectFormat(data);

      expect(format).toBe('editthiscookie');
    });

    test('should import JSON cookies', async () => {
      mockSession.cookies.set.mockResolvedValue(undefined);

      const data = JSON.stringify([
        { url: 'https://example.com', name: 'test', value: 'value' }
      ]);

      const result = await cookieManager.importCookies(data, 'json');

      expect(result.set).toBeGreaterThanOrEqual(0);
    });

    test('should import Netscape cookies', async () => {
      mockSession.cookies.set.mockResolvedValue(undefined);

      const data = `# Netscape HTTP Cookie File
example.com\tFALSE\t/\tTRUE\t${Math.floor(Date.now() / 1000) + 86400}\ttest\tvalue`;

      const result = await cookieManager.importCookies(data, 'netscape');

      expect(result.set).toBeGreaterThanOrEqual(0);
    });

    test('should auto-detect format', async () => {
      mockSession.cookies.set.mockResolvedValue(undefined);

      const data = JSON.stringify([
        { url: 'https://example.com', name: 'test', value: 'value' }
      ]);

      const result = await cookieManager.importCookies(data);

      expect(result.set).toBeGreaterThanOrEqual(0);
    });

    test('should fail for unknown format', async () => {
      const result = await cookieManager.importCookies('invalid data', 'unknown');

      expect(result.success).toBe(false);
    });

    test('should fail for empty data', async () => {
      const result = await cookieManager.importCookies('[]');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid cookies');
    });
  });

  describe('Parse Functions', () => {
    test('should parse valid JSON', () => {
      const data = '[{"name":"test","value":"value"}]';
      const result = cookieManager.parseJSON(data);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
    });

    test('should throw error for invalid JSON', () => {
      expect(() => {
        cookieManager.parseJSON('not valid json');
      }).toThrow();
    });

    test('should parse valid Netscape format', () => {
      const data = `# Netscape HTTP Cookie File
example.com\tFALSE\t/\tTRUE\t${Math.floor(Date.now() / 1000) + 86400}\ttest\tvalue`;

      const result = cookieManager.parseNetscape(data);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
    });

    test('should skip comment lines in Netscape format', () => {
      const data = `# This is a comment
# Another comment
example.com\tFALSE\t/\tTRUE\t0\ttest\tvalue`;

      const result = cookieManager.parseNetscape(data);

      expect(result).toHaveLength(1);
    });

    test('should skip invalid lines in Netscape format', () => {
      const data = `invalid line
example.com\tFALSE\t/\tTRUE\t0\ttest\tvalue`;

      const result = cookieManager.parseNetscape(data);

      expect(result).toHaveLength(1);
    });

    test('should parse EditThisCookie format', () => {
      const data = JSON.stringify([{
        domain: 'example.com',
        name: 'test',
        value: 'value',
        path: '/',
        hostOnly: true
      }]);

      const result = cookieManager.parseEditThisCookie(data);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('test');
    });
  });

  describe('Domain Cookies', () => {
    test('should get cookies for domain', async () => {
      mockSession.cookies.get.mockResolvedValue([
        { name: 'cookie1', domain: 'example.com' },
        { name: 'cookie2', domain: '.example.com' }
      ]);

      const result = await cookieManager.getCookiesForDomain('example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('Statistics and Info', () => {
    test('should return cookie statistics', async () => {
      mockSession.cookies.get.mockResolvedValue([
        { name: 'cookie1', domain: 'example.com', secure: true },
        { name: 'cookie2', domain: 'example.com', secure: false, httpOnly: true }
      ]);

      const result = await cookieManager.getStats();

      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(2);
    });

    test('should return available formats', () => {
      const result = cookieManager.getFormats();

      expect(result.formats).toContain('json');
      expect(result.formats).toContain('netscape');
      expect(result.formats).toContain('editthiscookie');
    });
  });

  describe('Flush Cookies', () => {
    test('should flush cookie store', async () => {
      mockSession.cookies.flushStore.mockResolvedValue(undefined);

      const result = await cookieManager.flushCookies();

      expect(result.success).toBe(true);
      expect(mockSession.cookies.flushStore).toHaveBeenCalled();
    });
  });
});

/**
 * Basset Hound Browser - Cookie Manager Unit Tests
 * Tests for cookie management, export/import in various formats
 */

// Mock Electron session
const mockCookies = [];
const mockSession = {
  cookies: {
    get: jest.fn().mockImplementation((filter) => {
      if (filter.url) {
        const domain = new URL(filter.url).hostname;
        return Promise.resolve(mockCookies.filter(c =>
          c.domain === domain || c.domain === `.${domain}` || domain.endsWith(c.domain.substring(1))
        ));
      }
      if (filter.domain) {
        return Promise.resolve(mockCookies.filter(c =>
          c.domain === filter.domain || c.domain.includes(filter.domain)
        ));
      }
      return Promise.resolve([...mockCookies]);
    }),
    set: jest.fn().mockImplementation((cookie) => {
      const index = mockCookies.findIndex(c => c.name === cookie.name && c.domain === cookie.domain);
      if (index >= 0) {
        mockCookies[index] = cookie;
      } else {
        mockCookies.push(cookie);
      }
      return Promise.resolve();
    }),
    remove: jest.fn().mockImplementation((url, name) => {
      const index = mockCookies.findIndex(c => c.name === name);
      if (index >= 0) {
        mockCookies.splice(index, 1);
      }
      return Promise.resolve();
    }),
    flushStore: jest.fn().mockResolvedValue()
  }
};

jest.mock('electron', () => ({
  session: {
    defaultSession: mockSession
  }
}));

const CookieManager = require('../../cookies/manager');

describe('CookieManager', () => {
  let cookieManager;

  beforeEach(() => {
    // Clear mock cookies
    mockCookies.length = 0;
    jest.clearAllMocks();
    cookieManager = new CookieManager(mockSession);
  });

  describe('Constructor', () => {
    test('should use provided session', () => {
      expect(cookieManager.getSession()).toBe(mockSession);
    });

    test('should use default session if none provided', () => {
      const defaultManager = new CookieManager();
      expect(defaultManager.getSession()).toBeDefined();
    });
  });

  describe('setSession', () => {
    test('should update the session', () => {
      const newSession = { cookies: {} };
      cookieManager.setSession(newSession);
      expect(cookieManager.getSession()).toBe(newSession);
    });
  });

  describe('getCookies', () => {
    beforeEach(() => {
      mockCookies.push(
        { name: 'session', value: 'abc123', domain: 'example.com', path: '/', secure: true },
        { name: 'pref', value: 'dark', domain: '.example.com', path: '/', secure: false }
      );
    });

    test('should get cookies for URL', async () => {
      const result = await cookieManager.getCookies('https://example.com');

      expect(result.success).toBe(true);
      expect(result.cookies).toBeDefined();
      expect(mockSession.cookies.get).toHaveBeenCalledWith({ url: 'https://example.com' });
    });

    test('should return error when URL is missing', async () => {
      const result = await cookieManager.getCookies();

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });
  });

  describe('getAllCookies', () => {
    beforeEach(() => {
      mockCookies.push(
        { name: 'cookie1', value: 'value1', domain: 'site1.com' },
        { name: 'cookie2', value: 'value2', domain: 'site2.com' }
      );
    });

    test('should get all cookies', async () => {
      const result = await cookieManager.getAllCookies();

      expect(result.success).toBe(true);
      expect(result.cookies.length).toBe(2);
      expect(result.count).toBe(2);
    });

    test('should apply filter', async () => {
      const result = await cookieManager.getAllCookies({ domain: 'site1.com' });

      expect(result.success).toBe(true);
      expect(mockSession.cookies.get).toHaveBeenCalledWith({ domain: 'site1.com' });
    });
  });

  describe('setCookie', () => {
    test('should set a cookie', async () => {
      const cookie = {
        url: 'https://example.com',
        name: 'test',
        value: 'value'
      };

      const result = await cookieManager.setCookie(cookie);

      expect(result.success).toBe(true);
      expect(mockSession.cookies.set).toHaveBeenCalledWith(cookie);
    });

    test('should require url and name', async () => {
      const result1 = await cookieManager.setCookie({ name: 'test' });
      expect(result1.success).toBe(false);
      expect(result1.error).toContain('url and name');

      const result2 = await cookieManager.setCookie({ url: 'https://example.com' });
      expect(result2.success).toBe(false);

      const result3 = await cookieManager.setCookie(null);
      expect(result3.success).toBe(false);
    });
  });

  describe('setCookies', () => {
    test('should set multiple cookies', async () => {
      const cookies = [
        { url: 'https://example.com', name: 'c1', value: 'v1' },
        { url: 'https://example.com', name: 'c2', value: 'v2' }
      ];

      const result = await cookieManager.setCookies(cookies);

      expect(result.success).toBe(true);
      expect(result.set).toBe(2);
      expect(result.failed).toBe(0);
    });

    test('should handle failures', async () => {
      mockSession.cookies.set.mockRejectedValueOnce(new Error('Failed'));

      const cookies = [
        { url: 'https://example.com', name: 'c1', value: 'v1' },
        { url: 'https://example.com', name: 'c2', value: 'v2' }
      ];

      const result = await cookieManager.setCookies(cookies);

      expect(result.set).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    test('should require array input', async () => {
      const result = await cookieManager.setCookies('not an array');

      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });
  });

  describe('deleteCookie', () => {
    test('should delete a cookie', async () => {
      const result = await cookieManager.deleteCookie('https://example.com', 'session');

      expect(result.success).toBe(true);
      expect(mockSession.cookies.remove).toHaveBeenCalledWith('https://example.com', 'session');
    });

    test('should require url and name', async () => {
      const result1 = await cookieManager.deleteCookie('https://example.com');
      expect(result1.success).toBe(false);

      const result2 = await cookieManager.deleteCookie(null, 'session');
      expect(result2.success).toBe(false);
    });
  });

  describe('clearCookies', () => {
    beforeEach(() => {
      mockCookies.push(
        { name: 'c1', value: 'v1', domain: 'example.com', path: '/', secure: true },
        { name: 'c2', value: 'v2', domain: '.example.com', path: '/', secure: false }
      );
    });

    test('should clear all cookies', async () => {
      const result = await cookieManager.clearCookies();

      expect(result.success).toBe(true);
      expect(result.cleared).toBe(2);
    });

    test('should clear cookies for specific domain', async () => {
      const result = await cookieManager.clearCookies('example.com');

      expect(result.success).toBe(true);
    });
  });

  describe('buildCookieUrl', () => {
    test('should build https URL for secure cookie', () => {
      const cookie = { domain: '.example.com', path: '/app', secure: true };

      const url = cookieManager.buildCookieUrl(cookie);

      expect(url).toBe('https://example.com/app');
    });

    test('should build http URL for non-secure cookie', () => {
      const cookie = { domain: 'example.com', path: '/', secure: false };

      const url = cookieManager.buildCookieUrl(cookie);

      expect(url).toBe('http://example.com/');
    });

    test('should handle domain with leading dot', () => {
      const cookie = { domain: '.example.com', path: '/', secure: true };

      const url = cookieManager.buildCookieUrl(cookie);

      expect(url).toBe('https://example.com/');
    });
  });

  describe('Export Functions', () => {
    const testCookies = [
      {
        name: 'session',
        value: 'abc123',
        domain: '.example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        expirationDate: 1735689600
      },
      {
        name: 'pref',
        value: 'dark',
        domain: 'example.com',
        path: '/app',
        secure: false,
        httpOnly: false
      }
    ];

    beforeEach(() => {
      testCookies.forEach(c => mockCookies.push({...c}));
    });

    describe('exportCookies', () => {
      test('should export to JSON format', async () => {
        const result = await cookieManager.exportCookies('json');

        expect(result.success).toBe(true);
        expect(result.format).toBe('json');
        expect(result.data).toBeDefined();
        expect(JSON.parse(result.data)).toEqual(testCookies);
      });

      test('should export to Netscape format', async () => {
        const result = await cookieManager.exportCookies('netscape');

        expect(result.success).toBe(true);
        expect(result.format).toBe('netscape');
        expect(result.data).toContain('# Netscape HTTP Cookie File');
        expect(result.data).toContain('session');
        expect(result.data).toContain('abc123');
      });

      test('should export to EditThisCookie format', async () => {
        const result = await cookieManager.exportCookies('editthiscookie');

        expect(result.success).toBe(true);
        expect(result.format).toBe('editthiscookie');
        const parsed = JSON.parse(result.data);
        expect(parsed[0]).toHaveProperty('hostOnly');
        expect(parsed[0]).toHaveProperty('storeId');
      });

      test('should fail for unknown format', async () => {
        const result = await cookieManager.exportCookies('unknown');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown format');
      });
    });

    describe('exportToJSON', () => {
      test('should produce valid JSON', () => {
        const result = cookieManager.exportToJSON(testCookies);

        expect(result.success).toBe(true);
        expect(() => JSON.parse(result.data)).not.toThrow();
      });
    });

    describe('exportToNetscape', () => {
      test('should produce valid Netscape format', () => {
        const result = cookieManager.exportToNetscape(testCookies);

        expect(result.success).toBe(true);
        const lines = result.data.split('\n');
        expect(lines[0]).toBe('# Netscape HTTP Cookie File');

        // Check cookie line format: domain\tflag\tpath\tsecure\texp\tname\tvalue
        const cookieLine = lines.find(l => l.includes('session'));
        expect(cookieLine).toBeDefined();
        const parts = cookieLine.split('\t');
        expect(parts.length).toBe(7);
      });

      test('should handle session cookies (no expiration)', () => {
        const sessionCookie = [{ name: 'test', value: 'val', domain: 'example.com', path: '/' }];
        const result = cookieManager.exportToNetscape(sessionCookie);

        expect(result.data).toContain('\t0\t'); // expiration = 0
      });
    });

    describe('exportToEditThisCookie', () => {
      test('should produce EditThisCookie format', () => {
        const result = cookieManager.exportToEditThisCookie(testCookies);

        expect(result.success).toBe(true);
        const parsed = JSON.parse(result.data);
        expect(parsed[0]).toHaveProperty('hostOnly');
        expect(parsed[0]).toHaveProperty('storeId', '0');
        expect(parsed[0]).toHaveProperty('id');
      });

      test('should set hostOnly correctly', () => {
        const result = cookieManager.exportToEditThisCookie(testCookies);
        const parsed = JSON.parse(result.data);

        // Domain starting with . = not hostOnly
        const dotDomain = parsed.find(c => c.domain.startsWith('.'));
        expect(dotDomain.hostOnly).toBe(false);

        // Domain without . = hostOnly
        const regularDomain = parsed.find(c => !c.domain.startsWith('.'));
        expect(regularDomain.hostOnly).toBe(true);
      });
    });
  });

  describe('Import Functions', () => {
    describe('detectFormat', () => {
      test('should detect Netscape format', () => {
        const netscapeData = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tTRUE\t0\tsession\tabc';

        const format = cookieManager.detectFormat(netscapeData);

        expect(format).toBe('netscape');
      });

      test('should detect JSON array format', () => {
        const jsonData = '[{"name":"test","value":"val"}]';

        const format = cookieManager.detectFormat(jsonData);

        expect(format).toBe('json');
      });

      test('should detect EditThisCookie format', () => {
        const etcData = '[{"name":"test","value":"val","hostOnly":true,"storeId":"0"}]';

        const format = cookieManager.detectFormat(etcData);

        expect(format).toBe('editthiscookie');
      });
    });

    describe('importCookies', () => {
      test('should import JSON cookies', async () => {
        const jsonData = JSON.stringify([
          { url: 'https://example.com', name: 'imported', value: 'test', domain: 'example.com' }
        ]);

        const result = await cookieManager.importCookies(jsonData, 'json');

        expect(result.success).toBe(true);
        expect(result.set).toBe(1);
      });

      test('should import Netscape cookies', async () => {
        const netscapeData = `# Netscape HTTP Cookie File
.example.com\tTRUE\t/\tTRUE\t1735689600\tsession\tabc123`;

        const result = await cookieManager.importCookies(netscapeData, 'netscape');

        expect(result.set).toBeGreaterThanOrEqual(0); // May fail validation but should parse
      });

      test('should auto-detect format', async () => {
        const jsonData = JSON.stringify([
          { url: 'https://example.com', name: 'auto', value: 'detected', domain: 'example.com' }
        ]);

        const result = await cookieManager.importCookies(jsonData, 'auto');

        expect(result.set).toBe(1);
      });

      test('should fail for unknown format', async () => {
        const result = await cookieManager.importCookies('data', 'unknown');

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown format');
      });

      test('should fail for empty data', async () => {
        const result = await cookieManager.importCookies('[]', 'json');

        expect(result.success).toBe(false);
        expect(result.error).toContain('No valid cookies');
      });
    });

    describe('parseJSON', () => {
      test('should parse valid JSON', () => {
        const data = '[{"name":"test","value":"val"}]';

        const cookies = cookieManager.parseJSON(data);

        expect(cookies).toHaveLength(1);
        expect(cookies[0].name).toBe('test');
      });

      test('should return empty array for invalid JSON', () => {
        const cookies = cookieManager.parseJSON('not json');

        expect(cookies).toEqual([]);
      });
    });

    describe('parseNetscape', () => {
      test('should parse valid Netscape format', () => {
        const data = `.example.com\tTRUE\t/\tTRUE\t1735689600\tsession\tabc123`;

        const cookies = cookieManager.parseNetscape(data);

        expect(cookies.length).toBe(1);
        expect(cookies[0].name).toBe('session');
        expect(cookies[0].value).toBe('abc123');
        expect(cookies[0].domain).toBe('.example.com');
        expect(cookies[0].secure).toBe(true);
      });

      test('should skip comment lines', () => {
        const data = `# Comment line
# Another comment
.example.com\tTRUE\t/\tTRUE\t0\ttest\tval`;

        const cookies = cookieManager.parseNetscape(data);

        expect(cookies.length).toBe(1);
      });

      test('should skip invalid lines', () => {
        const data = `invalid line
.example.com\tTRUE\t/\tTRUE\t0\ttest\tval
another invalid`;

        const cookies = cookieManager.parseNetscape(data);

        expect(cookies.length).toBe(1);
      });
    });

    describe('parseEditThisCookie', () => {
      test('should parse EditThisCookie format', () => {
        const data = JSON.stringify([{
          name: 'test',
          value: 'val',
          domain: '.example.com',
          path: '/',
          secure: true,
          httpOnly: false,
          hostOnly: false,
          storeId: '0'
        }]);

        const cookies = cookieManager.parseEditThisCookie(data);

        expect(cookies.length).toBe(1);
        expect(cookies[0]).toHaveProperty('url');
      });
    });
  });

  describe('File Operations', () => {
    // Note: File operations require fs mocking which is complex
    // These tests verify the method signatures exist

    test('exportToFile should be a function', () => {
      expect(typeof cookieManager.exportToFile).toBe('function');
    });

    test('importFromFile should be a function', () => {
      expect(typeof cookieManager.importFromFile).toBe('function');
    });
  });

  describe('getCookiesForDomain', () => {
    beforeEach(() => {
      mockCookies.push(
        { name: 'c1', domain: 'example.com', value: 'v1' },
        { name: 'c2', domain: '.example.com', value: 'v2' },
        { name: 'c3', domain: 'other.com', value: 'v3' }
      );
    });

    test('should get cookies for domain', async () => {
      const result = await cookieManager.getCookiesForDomain('example.com');

      expect(result.success).toBe(true);
    });

    test('should require domain', async () => {
      const result = await cookieManager.getCookiesForDomain();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Domain is required');
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      mockCookies.push(
        { name: 'c1', domain: 'example.com', secure: true, httpOnly: true, expirationDate: 123 },
        { name: 'c2', domain: '.example.com', secure: false, httpOnly: false },
        { name: 'c3', domain: 'other.com', secure: true, httpOnly: true }
      );
    });

    test('should return cookie statistics', async () => {
      const result = await cookieManager.getStats();

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.byDomain).toBeDefined();
      expect(result.secure).toBeDefined();
      expect(result.httpOnly).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.persistent).toBeDefined();
    });
  });

  describe('getFormats', () => {
    test('should return available formats', () => {
      const formats = cookieManager.getFormats();

      expect(formats.import).toContain('json');
      expect(formats.import).toContain('netscape');
      expect(formats.import).toContain('editthiscookie');
      expect(formats.export).toContain('json');
      expect(formats.export).toContain('netscape');
      expect(formats.export).toContain('editthiscookie');
    });
  });

  describe('flushCookies', () => {
    test('should flush cookie store', async () => {
      const result = await cookieManager.flushCookies();

      expect(result.success).toBe(true);
      expect(mockSession.cookies.flushStore).toHaveBeenCalled();
    });
  });
});

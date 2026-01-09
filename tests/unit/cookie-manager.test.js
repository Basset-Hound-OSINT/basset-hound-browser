/**
 * Tests for Advanced Cookie Manager
 */

const { CookieManager, COOKIE_FLAGS, SECURITY_LEVELS } = require('../../cookies/cookie-manager');

describe('CookieManager', () => {
  let mockWebContents;
  let cookieManager;
  let mockCookies;

  beforeEach(() => {
    mockCookies = [];

    mockWebContents = {
      session: {
        cookies: {
          get: jest.fn(async (filter) => {
            if (!filter || Object.keys(filter).length === 0) {
              return [...mockCookies];
            }

            return mockCookies.filter(c => {
              if (filter.name && c.name !== filter.name) return false;
              if (filter.domain && !c.domain.includes(filter.domain)) return false;
              return true;
            });
          }),
          set: jest.fn(async (details) => {
            const cookie = {
              name: details.name,
              value: details.value,
              domain: details.domain || new URL(details.url).hostname,
              path: details.path || '/',
              secure: details.secure || false,
              httpOnly: details.httpOnly || false,
              sameSite: details.sameSite || 'no_restriction',
              expirationDate: details.expirationDate
            };
            mockCookies.push(cookie);
            return cookie;
          }),
          remove: jest.fn(async (url, name) => {
            const index = mockCookies.findIndex(c => c.name === name);
            if (index >= 0) {
              mockCookies.splice(index, 1);
            }
          }),
          flushStore: jest.fn(async () => {})
        }
      },
      getUserAgent: jest.fn(() => 'Test User Agent')
    };

    cookieManager = new CookieManager(mockWebContents);

    // Create default jar
    cookieManager.createJar('default');
  });

  describe('Jar Management', () => {
    test('should create a new cookie jar', () => {
      const jar = cookieManager.createJar('test-jar', {
        isolated: true,
        syncEnabled: true,
        metadata: { description: 'Test jar' }
      });

      expect(jar.name).toBe('test-jar');
      expect(jar.isolated).toBe(true);
      expect(jar.syncEnabled).toBe(true);
      expect(jar.cookieCount).toBe(0);
    });

    test('should not create duplicate jar', () => {
      cookieManager.createJar('test-jar');

      expect(() => {
        cookieManager.createJar('test-jar');
      }).toThrow("Cookie jar 'test-jar' already exists");
    });

    test('should delete a cookie jar', async () => {
      cookieManager.createJar('test-jar');
      const result = await cookieManager.deleteJar('test-jar');

      expect(result).toBe(true);
      const jars = cookieManager.listJars();
      expect(jars.find(j => j.name === 'test-jar')).toBeUndefined();
    });

    test('should not delete default jar', async () => {
      await expect(cookieManager.deleteJar('default')).rejects.toThrow('Cannot delete default jar');
    });

    test('should list all jars', () => {
      cookieManager.createJar('jar1');
      cookieManager.createJar('jar2');

      const jars = cookieManager.listJars();

      expect(jars.length).toBe(3); // default + jar1 + jar2
      expect(jars.find(j => j.name === 'jar1')).toBeDefined();
      expect(jars.find(j => j.name === 'jar2')).toBeDefined();
    });
  });

  describe('Jar Switching', () => {
    beforeEach(() => {
      // Add some test cookies
      mockCookies.push(
        {
          name: 'test1',
          value: 'value1',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true
        },
        {
          name: 'test2',
          value: 'value2',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false
        }
      );
    });

    test('should switch between jars', async () => {
      cookieManager.createJar('jar1');

      const result = await cookieManager.switchJar('jar1');

      expect(result.previousJar).toBe('default');
      expect(result.currentJar).toBe('jar1');
    });

    test('should save cookies when switching', async () => {
      cookieManager.createJar('jar1');

      await cookieManager.switchJar('jar1', { saveCurrent: true });

      const defaultJar = cookieManager.listJars().find(j => j.name === 'default');
      expect(defaultJar.cookieCount).toBe(2);
    });

    test('should load cookies from target jar', async () => {
      cookieManager.createJar('jar1');

      // Save cookies to default jar
      await cookieManager.saveToJar('default');

      // Clear cookies and switch
      mockCookies = [];
      await cookieManager.switchJar('jar1', { loadTarget: true });

      // Switch back to default
      await cookieManager.switchJar('default', { loadTarget: true });

      expect(mockWebContents.session.cookies.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('Save and Load', () => {
    beforeEach(() => {
      mockCookies.push({
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: true
      });
    });

    test('should save cookies to jar', async () => {
      const result = await cookieManager.saveToJar('default');

      expect(result.cookieCount).toBe(1);
      expect(result.jarName).toBe('default');

      const jars = cookieManager.listJars();
      const defaultJar = jars.find(j => j.name === 'default');
      expect(defaultJar.cookieCount).toBe(1);
    });

    test('should load cookies from jar', async () => {
      // Save first
      await cookieManager.saveToJar('default');

      // Clear and load
      mockCookies = [];
      const result = await cookieManager.loadFromJar('default');

      expect(result.loaded).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockWebContents.session.cookies.set).toHaveBeenCalled();
    });
  });

  describe('Jar Synchronization', () => {
    beforeEach(() => {
      cookieManager.createJar('source');
      cookieManager.createJar('target');

      // Add cookies to source
      const sourceJar = cookieManager.cookieJars.get('source');
      sourceJar.cookies = [
        {
          name: 'cookie1',
          value: 'value1',
          domain: 'example.com',
          path: '/'
        },
        {
          name: 'cookie2',
          value: 'value2',
          domain: 'test.com',
          path: '/'
        }
      ];
    });

    test('should sync jars in merge mode', async () => {
      const result = await cookieManager.syncJars('source', 'target', { mode: 'merge' });

      expect(result.added).toBe(2);
      expect(result.updated).toBe(0);

      const targetJar = cookieManager.cookieJars.get('target');
      expect(targetJar.cookies.length).toBe(2);
    });

    test('should sync jars in replace mode', async () => {
      // Add existing cookie to target
      const targetJar = cookieManager.cookieJars.get('target');
      targetJar.cookies = [{ name: 'existing', value: 'old', domain: 'old.com', path: '/' }];

      const result = await cookieManager.syncJars('source', 'target', { mode: 'replace' });

      expect(result.added).toBe(2);
      expect(targetJar.cookies.length).toBe(2);
      expect(targetJar.cookies.find(c => c.name === 'existing')).toBeUndefined();
    });

    test('should sync with filter', async () => {
      const filter = (cookie) => cookie.domain === 'example.com';

      const result = await cookieManager.syncJars('source', 'target', {
        mode: 'merge',
        filter
      });

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);

      const targetJar = cookieManager.cookieJars.get('target');
      expect(targetJar.cookies.length).toBe(1);
      expect(targetJar.cookies[0].domain).toBe('example.com');
    });
  });

  describe('Security Analysis', () => {
    test('should analyze secure cookie', () => {
      const cookie = {
        name: 'session_token',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'strict'
      };

      const analysis = cookieManager.analyzeCookieSecurity(cookie);

      expect(analysis.classification).toBe('authentication');
      expect(analysis.issues.length).toBe(0);
      expect(analysis.flags.secure).toBe(true);
      expect(analysis.flags.httpOnly).toBe(true);
      expect(analysis.score).toBeGreaterThan(90);
    });

    test('should detect missing Secure flag', () => {
      const cookie = {
        name: 'session',
        value: 'abc',
        domain: 'example.com',
        path: '/',
        secure: false,
        httpOnly: true,
        sameSite: 'lax'
      };

      const analysis = cookieManager.analyzeCookieSecurity(cookie);

      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.issues.some(i => i.type === 'missing_secure')).toBe(true);
      expect(analysis.securityLevel).toBe(SECURITY_LEVELS.HIGH);
    });

    test('should detect missing HttpOnly flag for sensitive cookie', () => {
      const cookie = {
        name: 'auth_token',
        value: 'secret',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: false,
        sameSite: 'strict'
      };

      const analysis = cookieManager.analyzeCookieSecurity(cookie);

      expect(analysis.issues.some(i => i.type === 'missing_httponly')).toBe(true);
      expect(analysis.securityLevel).toBe(SECURITY_LEVELS.HIGH);
    });

    test('should detect missing SameSite attribute', () => {
      const cookie = {
        name: 'test',
        value: 'value',
        domain: 'example.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'no_restriction'
      };

      const analysis = cookieManager.analyzeCookieSecurity(cookie);

      expect(analysis.issues.some(i => i.type === 'missing_samesite')).toBe(true);
    });

    test('should classify cookies correctly', () => {
      const testCases = [
        { name: 'session_id', expected: 'authentication' },
        { name: '_ga', expected: 'analytics' },
        { name: 'ad_id', expected: 'advertising' },
        { name: 'user_pref', expected: 'preferences' },
        { name: 'csrf_token', expected: 'security' },
        { name: 'random', expected: 'functional' }
      ];

      for (const tc of testCases) {
        const cookie = {
          name: tc.name,
          value: 'value',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true
        };

        const analysis = cookieManager.analyzeCookieSecurity(cookie);
        expect(analysis.classification).toBe(tc.expected);
      }
    });

    test('should analyze all cookies', async () => {
      mockCookies = [
        {
          name: 'secure_cookie',
          value: 'value1',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'strict'
        },
        {
          name: 'insecure_cookie',
          value: 'value2',
          domain: 'example.com',
          path: '/',
          secure: false,
          httpOnly: false,
          sameSite: 'no_restriction'
        }
      ];

      const analysis = await cookieManager.analyzeAllCookies();

      expect(analysis.summary.total).toBe(2);
      expect(analysis.summary.secure).toBe(1);
      expect(analysis.summary.httpOnly).toBe(1);
      expect(analysis.summary.sameSite).toBe(1);
      expect(analysis.overallScore).toBeLessThan(100);
    });
  });

  describe('Export and Import', () => {
    beforeEach(() => {
      mockCookies = [
        {
          name: 'test_cookie',
          value: 'test_value',
          domain: 'example.com',
          path: '/',
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
          expirationDate: Math.floor(Date.now() / 1000) + 86400
        }
      ];
    });

    test('should export cookies as JSON', async () => {
      const result = await cookieManager.exportCookies({ format: 'json' });

      expect(typeof result).toBe('string');
      const data = JSON.parse(result);
      expect(data.count).toBe(1);
      expect(data.cookies.length).toBe(1);
      expect(data.cookies[0].name).toBe('test_cookie');
    });

    test('should export cookies as Netscape format', async () => {
      const result = await cookieManager.exportCookies({ format: 'netscape' });

      expect(typeof result).toBe('string');
      expect(result).toContain('# Netscape HTTP Cookie File');
      expect(result).toContain('example.com');
      expect(result).toContain('test_cookie');
    });

    test('should export cookies as CSV', async () => {
      const result = await cookieManager.exportCookies({ format: 'csv' });

      expect(typeof result).toBe('string');
      expect(result).toContain('Name,Value,Domain');
      expect(result).toContain('test_cookie');
      expect(result).toContain('example.com');
    });

    test('should export cookies as curl command', async () => {
      const result = await cookieManager.exportCookies({
        format: 'curl',
        url: 'https://example.com'
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('curl');
      expect(result).toContain('test_cookie=test_value');
    });

    test('should import cookies from JSON', async () => {
      const data = {
        cookies: [
          {
            name: 'imported',
            value: 'imported_value',
            domain: 'example.com',
            path: '/',
            secure: true
          }
        ]
      };

      const result = await cookieManager.importCookies(data, { format: 'json' });

      expect(result.imported).toBe(1);
      expect(mockWebContents.session.cookies.set).toHaveBeenCalled();
    });

    test('should import cookies to jar', async () => {
      cookieManager.createJar('import-jar');

      const data = {
        cookies: [
          {
            name: 'imported',
            value: 'value',
            domain: 'example.com',
            path: '/'
          }
        ]
      };

      const result = await cookieManager.importCookies(data, {
        format: 'json',
        jar: 'import-jar'
      });

      expect(result.imported).toBe(1);
      expect(result.jar).toBe('import-jar');

      const jar = cookieManager.cookieJars.get('import-jar');
      expect(jar.cookies.length).toBe(1);
    });

    test('should import Netscape format', async () => {
      const data = `.example.com\tTRUE\t/\tTRUE\t${Math.floor(Date.now() / 1000) + 86400}\ttest\tvalue`;

      const result = await cookieManager.importCookies(data, { format: 'netscape' });

      expect(result.imported).toBe(1);
    });
  });

  describe('History Tracking', () => {
    test('should track cookie changes', () => {
      const cookie = {
        name: 'test',
        value: 'value',
        domain: 'example.com',
        path: '/'
      };

      cookieManager._trackHistory('created', cookie);

      const history = cookieManager.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('created');
      expect(history[0].cookie.name).toBe('test');
    });

    test('should filter history by action', () => {
      cookieManager._trackHistory('created', { name: 'cookie1', domain: 'example.com', path: '/' });
      cookieManager._trackHistory('modified', { name: 'cookie2', domain: 'example.com', path: '/' });
      cookieManager._trackHistory('deleted', { name: 'cookie3', domain: 'example.com', path: '/' });

      const createdHistory = cookieManager.getHistory({ action: 'created' });
      expect(createdHistory.length).toBe(1);
      expect(createdHistory[0].action).toBe('created');
    });

    test('should filter history by domain', () => {
      cookieManager._trackHistory('created', { name: 'cookie1', domain: 'example.com', path: '/' });
      cookieManager._trackHistory('created', { name: 'cookie2', domain: 'test.com', path: '/' });

      const exampleHistory = cookieManager.getHistory({ domain: 'example.com' });
      expect(exampleHistory.length).toBe(1);
      expect(exampleHistory[0].cookie.domain).toBe('example.com');
    });

    test('should limit history size', () => {
      cookieManager.maxHistorySize = 5;

      for (let i = 0; i < 10; i++) {
        cookieManager._trackHistory('created', {
          name: `cookie${i}`,
          domain: 'example.com',
          path: '/'
        });
      }

      const history = cookieManager.getHistory();
      expect(history.length).toBe(5);
    });
  });

  describe('Clear Cookies', () => {
    beforeEach(() => {
      mockCookies = [
        { name: 'cookie1', value: 'value1', domain: 'example.com', path: '/' },
        { name: 'cookie2', value: 'value2', domain: 'test.com', path: '/' }
      ];
    });

    test('should clear all browser cookies', async () => {
      const result = await cookieManager.clearAllCookies();

      expect(result.cleared).toBe(2);
      expect(mockWebContents.session.cookies.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe('Statistics', () => {
    test('should track statistics', () => {
      cookieManager.createJar('jar1');
      cookieManager.createJar('jar2');

      const stats = cookieManager.getStatistics();

      expect(stats.jarsCreated).toBe(3); // default + jar1 + jar2
      expect(stats.jarsCount).toBe(3);
      expect(stats.activeJar).toBe('default');
    });
  });

  describe('Helper Methods', () => {
    test('should construct URL correctly', () => {
      const cookie1 = { domain: 'example.com', path: '/', secure: true };
      expect(cookieManager._constructUrl(cookie1)).toBe('https://example.com/');

      const cookie2 = { domain: '.example.com', path: '/test', secure: false };
      expect(cookieManager._constructUrl(cookie2)).toBe('http://example.com/test');
    });

    test('should identify sensitive cookies', () => {
      expect(cookieManager._isSensitiveCookie({ name: 'session_id' })).toBe(true);
      expect(cookieManager._isSensitiveCookie({ name: 'auth_token' })).toBe(true);
      expect(cookieManager._isSensitiveCookie({ name: 'jwt' })).toBe(true);
      expect(cookieManager._isSensitiveCookie({ name: 'csrf_token' })).toBe(true);
      expect(cookieManager._isSensitiveCookie({ name: 'random_cookie' })).toBe(false);
    });

    test('should calculate security score', () => {
      const issues = [
        { severity: 'high' },
        { severity: 'medium' }
      ];

      const cookie = { secure: true, httpOnly: true, sameSite: 'strict' };

      const score = cookieManager._calculateSecurityScore(issues, cookie);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });
  });

  describe('Events', () => {
    test('should emit jar:created event', (done) => {
      cookieManager.on('jar:created', (data) => {
        expect(data.name).toBe('event-test');
        done();
      });

      cookieManager.createJar('event-test');
    });

    test('should emit jar:deleted event', (done) => {
      cookieManager.createJar('event-test');

      cookieManager.on('jar:deleted', (data) => {
        expect(data.name).toBe('event-test');
        done();
      });

      cookieManager.deleteJar('event-test');
    });

    test('should emit jar:switched event', (done) => {
      cookieManager.createJar('event-test');

      cookieManager.on('jar:switched', (data) => {
        expect(data.from).toBe('default');
        expect(data.to).toBe('event-test');
        done();
      });

      cookieManager.switchJar('event-test');
    });
  });
});

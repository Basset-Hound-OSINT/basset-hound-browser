/**
 * Tests for Input Validators Module
 * v12.5.0 Phase 2 - Deployment Hardening
 */

const { Validators } = require('../../../src/validation/validators');

describe('Validators', () => {
  describe('validatePort()', () => {
    it('should validate valid port numbers', () => {
      expect(Validators.validatePort(80)).toBe(80);
      expect(Validators.validatePort('443')).toBe(443);
      expect(Validators.validatePort(8080)).toBe(8080);
      expect(Validators.validatePort('65535')).toBe(65535);
      expect(Validators.validatePort(1)).toBe(1);
    });

    it('should reject invalid port numbers', () => {
      expect(() => Validators.validatePort(0)).toThrow('between 1-65535');
      expect(() => Validators.validatePort(65536)).toThrow('between 1-65535');
      expect(() => Validators.validatePort(-1)).toThrow('between 1-65535');
      expect(() => Validators.validatePort('not-a-number')).toThrow('must be a number');
      expect(() => Validators.validatePort(NaN)).toThrow('must be a number');
    });

    it('should use custom field names in errors', () => {
      expect(() => Validators.validatePort(99999, 'SOCKS port')).toThrow('Invalid SOCKS port');
    });
  });

  describe('validateUrl()', () => {
    it('should validate HTTP/HTTPS URLs', () => {
      const http = Validators.validateUrl('http://example.com');
      expect(http).toContain('example.com');

      const https = Validators.validateUrl('https://example.com:443');
      expect(https).toContain('example.com');
    });

    it('should reject dangerous protocols', () => {
      expect(() => Validators.validateUrl('javascript:alert(1)')).toThrow('dangerous protocol');
      expect(() => Validators.validateUrl('data:text/html,<script>alert(1)</script>')).toThrow('dangerous protocol');
      expect(() => Validators.validateUrl('vbscript:msgbox')).toThrow('dangerous protocol');
    });

    it('should reject invalid URLs', () => {
      expect(() => Validators.validateUrl('not a url')).toThrow('Invalid URL');
      expect(() => Validators.validateUrl('')).toThrow('cannot be empty');
      expect(() => Validators.validateUrl(123)).toThrow('must be a string');
    });

    it('should enforce URL length limits', () => {
      const longUrl = 'http://example.com/' + 'a'.repeat(2100);
      expect(() => Validators.validateUrl(longUrl)).toThrow('exceeds');
    });
  });

  describe('validateProxyUrl()', () => {
    it('should validate HTTP/HTTPS proxy URLs', () => {
      const http = Validators.validateProxyUrl('http://proxy.example.com:8080');
      expect(http).toContain('proxy.example.com');

      const https = Validators.validateProxyUrl('https://secure-proxy.example.com');
      expect(https).toContain('secure-proxy.example.com');
    });

    it('should validate SOCKS proxy URLs', () => {
      const socks5 = Validators.validateProxyUrl('socks5://localhost:1080');
      expect(socks5).toContain('localhost');

      const socks4 = Validators.validateProxyUrl('socks4://127.0.0.1:1080');
      expect(socks4).toContain('127.0.0.1');
    });

    it('should reject invalid proxy protocols', () => {
      expect(() => Validators.validateProxyUrl('ftp://proxy.com')).toThrow('Invalid proxy protocol');
    });

    it('should validate proxy port', () => {
      expect(() => Validators.validateProxyUrl('http://proxy.com:99999')).toThrow('Invalid proxy port');
    });

    it('should require hostname', () => {
      expect(() => Validators.validateProxyUrl('http://:8080')).toThrow('hostname');
    });
  });

  describe('validateIPv4()', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(Validators.validateIPv4('127.0.0.1')).toBe('127.0.0.1');
      expect(Validators.validateIPv4('192.168.1.1')).toBe('192.168.1.1');
      expect(Validators.validateIPv4('8.8.8.8')).toBe('8.8.8.8');
      expect(Validators.validateIPv4('255.255.255.255')).toBe('255.255.255.255');
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(() => Validators.validateIPv4('256.1.1.1')).toThrow('out of range');
      expect(() => Validators.validateIPv4('1.1.1')).toThrow('4 octets');
      expect(() => Validators.validateIPv4('1.1.1.1.1')).toThrow('4 octets');
      expect(() => Validators.validateIPv4('not.an.ip.address')).toThrow('out of range');
      expect(() => Validators.validateIPv4(123)).toThrow('must be a string');
    });
  });

  describe('validateIPv6()', () => {
    it('should validate IPv6 addresses', () => {
      expect(Validators.validateIPv6('::1')).toBe('::1');
      expect(Validators.validateIPv6('::')).toBe('::');
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(() => Validators.validateIPv6('invalid')).toThrow('Invalid IPv6');
      expect(() => Validators.validateIPv6(123)).toThrow('must be a string');
    });
  });

  describe('validateDomain()', () => {
    it('should validate correct domain names', () => {
      expect(Validators.validateDomain('example.com')).toBe('example.com');
      expect(Validators.validateDomain('sub.example.com')).toBe('sub.example.com');
      expect(Validators.validateDomain('example.co.uk')).toBe('example.co.uk');
      expect(Validators.validateDomain('my-domain.org')).toBe('my-domain.org');
    });

    it('should reject invalid domain names', () => {
      expect(() => Validators.validateDomain('')).toThrow('cannot be empty');
      expect(() => Validators.validateDomain('-example.com')).toThrow('Invalid domain');
      expect(() => Validators.validateDomain('example.')).toThrow('Invalid domain');
      expect(() => Validators.validateDomain('example')).toThrow('Invalid domain');
    });

    it('should convert to lowercase', () => {
      expect(Validators.validateDomain('EXAMPLE.COM')).toBe('example.com');
    });
  });

  describe('validateFilePath()', () => {
    it('should validate relative file paths', () => {
      expect(Validators.validateFilePath('file.txt')).toBe('file.txt');
      expect(Validators.validateFilePath('dir/file.txt')).toBe('dir/file.txt');
      expect(Validators.validateFilePath('dir\\file.txt')).toContain('file.txt');
    });

    it('should reject path traversal attempts', () => {
      expect(() => Validators.validateFilePath('../../etc/passwd')).toThrow('path traversal');
      expect(() => Validators.validateFilePath('../../../sensitive')).toThrow('path traversal');
      expect(() => Validators.validateFilePath('/etc/passwd')).toThrow('path traversal');
    });

    it('should reject absolute paths', () => {
      expect(() => Validators.validateFilePath('/usr/bin/file')).toThrow('absolute paths');
    });

    it('should reject empty paths', () => {
      expect(() => Validators.validateFilePath('')).toThrow('cannot be empty');
    });
  });

  describe('validateStringLength()', () => {
    it('should validate strings within limits', () => {
      expect(Validators.validateStringLength('hello')).toBe('hello');
      expect(Validators.validateStringLength('x'.repeat(1000))).toBeDefined();
    });

    it('should reject strings exceeding limits', () => {
      const longStr = 'x'.repeat(10001);
      expect(() => Validators.validateStringLength(longStr)).toThrow('exceeds');
    });

    it('should accept custom max length', () => {
      expect(Validators.validateStringLength('hello', 10)).toBe('hello');
      expect(() => Validators.validateStringLength('x'.repeat(11), 10)).toThrow('exceeds');
    });
  });

  describe('validateCssSelector()', () => {
    it('should validate valid CSS selectors', () => {
      expect(Validators.validateCssSelector('div')).toBe('div');
      expect(Validators.validateCssSelector('.class')).toBe('.class');
      expect(Validators.validateCssSelector('#id')).toBe('#id');
      expect(Validators.validateCssSelector('div > p')).toBe('div > p');
      expect(Validators.validateCssSelector('button[type="submit"]')).toBe('button[type="submit"]');
    });

    it('should reject suspicious selectors', () => {
      expect(() => Validators.validateCssSelector('div; alert(1)')).toThrow('suspicious');
      expect(() => Validators.validateCssSelector('div { color: red }')).toThrow('suspicious');
      expect(() => Validators.validateCssSelector('')).toThrow('cannot be empty');
    });

    it('should enforce nesting depth limit', () => {
      const deepSelector = 'div > '.repeat(51) + 'p';
      expect(() => Validators.validateCssSelector(deepSelector)).toThrow('nesting depth');
    });
  });

  describe('validateXPath()', () => {
    it('should validate valid XPath expressions', () => {
      expect(Validators.validateXPath('//')).toBe('//');
      expect(Validators.validateXPath('//button')).toBe('//button');
      expect(Validators.validateXPath('//button[@id="submit"]')).toBe('//button[@id="submit"]');
    });

    it('should reject suspicious XPath', () => {
      expect(() => Validators.validateXPath('javascript:alert(1)')).toThrow('suspicious');
      expect(() => Validators.validateXPath('\'; DROP TABLE')).toThrow('suspicious');
    });

    it('should reject empty XPath', () => {
      expect(() => Validators.validateXPath('')).toThrow('cannot be empty');
    });
  });

  describe('validateJSON()', () => {
    it('should parse valid JSON', () => {
      const obj = Validators.validateJSON('{"key": "value"}');
      expect(obj.key).toBe('value');

      const arr = Validators.validateJSON('[1,2,3]');
      expect(arr).toEqual([1, 2, 3]);
    });

    it('should reject invalid JSON', () => {
      expect(() => Validators.validateJSON('{invalid}')).toThrow('Invalid JSON');
      expect(() => Validators.validateJSON("{'single': 'quote'}")).toThrow('Invalid JSON');
      expect(() => Validators.validateJSON('')).toThrow('cannot be empty');
    });
  });

  describe('validateJavaScriptCode()', () => {
    it('should validate correct JavaScript code', () => {
      expect(Validators.validateJavaScriptCode('console.log("hello")')).toBeDefined();
      expect(Validators.validateJavaScriptCode('const x = 1; return x;')).toBeDefined();
      expect(Validators.validateJavaScriptCode('Array.isArray([1, 2, 3])')).toBeDefined();
    });

    it('should reject invalid JavaScript syntax', () => {
      expect(() => Validators.validateJavaScriptCode('const x =')).toThrow('Invalid JavaScript');
      expect(() => Validators.validateJavaScriptCode('if (true { }')).toThrow('Invalid JavaScript');
      expect(() => Validators.validateJavaScriptCode('')).toThrow('cannot be empty');
    });

    it('should enforce code length limits', () => {
      const longCode = 'console.log("x");'.repeat(10000);
      expect(() => Validators.validateJavaScriptCode(longCode)).toThrow('exceeds');
    });
  });

  describe('validateType()', () => {
    it('should validate correct types', () => {
      expect(Validators.validateType('string', 'string')).toBe('string');
      expect(Validators.validateType(123, 'number')).toBe(123);
      expect(Validators.validateType(true, 'boolean')).toBe(true);
      expect(Validators.validateType({}, 'object')).toEqual({});
      expect(Validators.validateType([], 'array')).toEqual([]);
    });

    it('should reject wrong types', () => {
      expect(() => Validators.validateType(123, 'string')).toThrow('expected string');
      expect(() => Validators.validateType('string', 'number')).toThrow('expected number');
      expect(() => Validators.validateType([], 'object')).toThrow('expected object');
    });
  });

  describe('validateRateLimitConfig()', () => {
    it('should validate rate limit configuration', () => {
      const config = Validators.validateRateLimitConfig(100, 60000);
      expect(config.maxRequests).toBe(100);
      expect(config.windowMs).toBe(60000);
    });

    it('should reject invalid configuration', () => {
      expect(() => Validators.validateRateLimitConfig(0, 60000)).toThrow('positive integer');
      expect(() => Validators.validateRateLimitConfig(100, 50)).toThrow('>= 100');
      expect(() => Validators.validateRateLimitConfig(-5, 60000)).toThrow('positive integer');
    });
  });

  describe('validateProfileName()', () => {
    it('should validate valid profile names', () => {
      expect(Validators.validateProfileName('profile1')).toBe('profile1');
      expect(Validators.validateProfileName('my_profile')).toBe('my_profile');
      expect(Validators.validateProfileName('Profile-123')).toBe('Profile-123');
    });

    it('should reject invalid profile names', () => {
      expect(() => Validators.validateProfileName('profile with spaces')).toThrow('alphanumeric');
      expect(() => Validators.validateProfileName('profile@123')).toThrow('alphanumeric');
      expect(() => Validators.validateProfileName('')).toThrow('cannot be empty');
    });
  });

  describe('validateSessionId()', () => {
    it('should validate valid session IDs', () => {
      expect(Validators.validateSessionId('session123')).toBe('session123');
      expect(Validators.validateSessionId('my_session')).toBe('my_session');
    });

    it('should enforce length limits', () => {
      expect(() => Validators.validateSessionId('abc')).toThrow('5-255');
      expect(() => Validators.validateSessionId('x'.repeat(256))).toThrow('5-255');
    });

    it('should reject special characters', () => {
      expect(() => Validators.validateSessionId('session@123')).toThrow('alphanumeric');
    });
  });

  describe('validateNumberRange()', () => {
    it('should validate numbers within range', () => {
      expect(Validators.validateNumberRange(50, 0, 100)).toBe(50);
      expect(Validators.validateNumberRange('25', 0, 50)).toBe(25);
    });

    it('should reject numbers outside range', () => {
      expect(() => Validators.validateNumberRange(-1, 0, 100)).toThrow('between 0-100');
      expect(() => Validators.validateNumberRange(101, 0, 100)).toThrow('between 0-100');
      expect(() => Validators.validateNumberRange('not-a-number', 0, 100)).toThrow('must be a number');
    });
  });

  describe('validateBoolean()', () => {
    it('should validate boolean values', () => {
      expect(Validators.validateBoolean(true)).toBe(true);
      expect(Validators.validateBoolean(false)).toBe(false);
      expect(Validators.validateBoolean('true')).toBe(true);
      expect(Validators.validateBoolean('false')).toBe(false);
      expect(Validators.validateBoolean('1')).toBe(true);
      expect(Validators.validateBoolean('0')).toBe(false);
    });

    it('should reject invalid values', () => {
      expect(() => Validators.validateBoolean('maybe')).toThrow('must be boolean');
      expect(() => Validators.validateBoolean(1)).toThrow('must be boolean');
    });
  });

  describe('validateEnum()', () => {
    it('should validate allowed enum values', () => {
      const allowed = ['option1', 'option2', 'option3'];
      expect(Validators.validateEnum('option1', allowed)).toBe('option1');
      expect(Validators.validateEnum('option2', allowed)).toBe('option2');
    });

    it('should reject disallowed enum values', () => {
      const allowed = ['option1', 'option2'];
      expect(() => Validators.validateEnum('option3', allowed)).toThrow('must be one of');
      expect(() => Validators.validateEnum('', allowed)).toThrow('must be one of');
    });
  });
});

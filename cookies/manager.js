const { session } = require('electron');
const fs = require('fs').promises;
const path = require('path');

/**
 * Cookie export/import formats
 */
const COOKIE_FORMATS = {
  JSON: 'json',
  NETSCAPE: 'netscape',
  EDIT_THIS_COOKIE: 'editthiscookie'
};

/**
 * CookieManager - Comprehensive cookie management for Electron browser
 * Supports multiple export/import formats for compatibility with various tools
 */
class CookieManager {
  constructor(electronSession = null) {
    this.session = electronSession || session.defaultSession;
  }

  /**
   * Get the Electron session to use for cookie operations
   * @returns {Electron.Session} The session object
   */
  getSession() {
    return this.session;
  }

  /**
   * Set the Electron session to use
   * @param {Electron.Session} electronSession - The session to use
   */
  setSession(electronSession) {
    this.session = electronSession;
  }

  /**
   * Get all cookies for a specific URL
   * @param {string} url - The URL to get cookies for
   * @returns {Promise<{success: boolean, cookies?: Array, error?: string}>}
   */
  async getCookies(url) {
    try {
      if (!url) {
        return { success: false, error: 'URL is required' };
      }

      const cookies = await this.session.cookies.get({ url });
      return { success: true, cookies };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all cookies from the browser
   * @param {Object} filter - Optional filter object (domain, name, path, etc.)
   * @returns {Promise<{success: boolean, cookies?: Array, error?: string}>}
   */
  async getAllCookies(filter = {}) {
    try {
      const cookies = await this.session.cookies.get(filter);
      return { success: true, cookies, count: cookies.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Set a single cookie
   * @param {Object} cookie - Cookie object with url, name, value, etc.
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async setCookie(cookie) {
    try {
      if (!cookie || !cookie.url || !cookie.name) {
        return { success: false, error: 'Cookie must have url and name' };
      }

      await this.session.cookies.set(cookie);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Set multiple cookies
   * @param {Array} cookies - Array of cookie objects
   * @returns {Promise<{success: boolean, set: number, failed: number, errors?: Array}>}
   */
  async setCookies(cookies) {
    if (!Array.isArray(cookies)) {
      return { success: false, error: 'Cookies must be an array' };
    }

    const results = { success: true, set: 0, failed: 0, errors: [] };

    for (const cookie of cookies) {
      try {
        await this.session.cookies.set(cookie);
        results.set++;
      } catch (error) {
        results.failed++;
        results.errors.push({ cookie: cookie.name, error: error.message });
      }
    }

    results.success = results.failed === 0;
    return results;
  }

  /**
   * Delete a specific cookie
   * @param {string} url - The URL associated with the cookie
   * @param {string} name - The name of the cookie to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteCookie(url, name) {
    try {
      if (!url || !name) {
        return { success: false, error: 'URL and name are required' };
      }

      await this.session.cookies.remove(url, name);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all cookies
   * @param {string} domain - Optional: clear cookies only for this domain
   * @returns {Promise<{success: boolean, cleared: number, error?: string}>}
   */
  async clearCookies(domain = null) {
    try {
      const filter = domain ? { domain } : {};
      const cookies = await this.session.cookies.get(filter);
      let cleared = 0;

      for (const cookie of cookies) {
        const url = this.buildCookieUrl(cookie);
        await this.session.cookies.remove(url, cookie.name);
        cleared++;
      }

      return { success: true, cleared };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Build a URL from a cookie object for removal/setting
   * @param {Object} cookie - Cookie object
   * @returns {string} The constructed URL
   */
  buildCookieUrl(cookie) {
    const protocol = cookie.secure ? 'https' : 'http';
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
    return `${protocol}://${domain}${cookie.path || '/'}`;
  }

  /**
   * Export cookies to a specific format
   * @param {string} format - Export format (json, netscape, editthiscookie)
   * @param {Object} filter - Optional filter for cookies to export
   * @returns {Promise<{success: boolean, data?: string, cookies?: Array, error?: string}>}
   */
  async exportCookies(format = COOKIE_FORMATS.JSON, filter = {}) {
    try {
      const cookies = await this.session.cookies.get(filter);

      switch (format.toLowerCase()) {
        case COOKIE_FORMATS.JSON:
          return this.exportToJSON(cookies);
        case COOKIE_FORMATS.NETSCAPE:
          return this.exportToNetscape(cookies);
        case COOKIE_FORMATS.EDIT_THIS_COOKIE:
          return this.exportToEditThisCookie(cookies);
        default:
          return { success: false, error: `Unknown format: ${format}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Export cookies to JSON format
   * @param {Array} cookies - Array of cookie objects
   * @returns {{success: boolean, data: string, cookies: Array}}
   */
  exportToJSON(cookies) {
    const data = JSON.stringify(cookies, null, 2);
    return { success: true, data, cookies, format: 'json' };
  }

  /**
   * Export cookies to Netscape/Mozilla format
   * Compatible with curl, wget, and other tools
   * @param {Array} cookies - Array of cookie objects
   * @returns {{success: boolean, data: string, cookies: Array}}
   */
  exportToNetscape(cookies) {
    const lines = ['# Netscape HTTP Cookie File', '# https://curl.se/docs/http-cookies.html', '# This file was generated by Basset Hound Browser', ''];

    for (const cookie of cookies) {
      // Netscape format: domain, flag, path, secure, expiration, name, value
      const domain = cookie.domain;
      const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const path = cookie.path || '/';
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      // Netscape format uses Unix timestamp, 0 for session cookies
      const expiration = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;
      const name = cookie.name;
      const value = cookie.value;

      lines.push(`${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`);
    }

    const data = lines.join('\n');
    return { success: true, data, cookies, format: 'netscape' };
  }

  /**
   * Export cookies to EditThisCookie format (browser extension format)
   * @param {Array} cookies - Array of cookie objects
   * @returns {{success: boolean, data: string, cookies: Array}}
   */
  exportToEditThisCookie(cookies) {
    const editThisCookies = cookies.map(cookie => ({
      domain: cookie.domain,
      expirationDate: cookie.expirationDate || null,
      hostOnly: !cookie.domain.startsWith('.'),
      httpOnly: cookie.httpOnly || false,
      name: cookie.name,
      path: cookie.path || '/',
      sameSite: cookie.sameSite || 'unspecified',
      secure: cookie.secure || false,
      session: !cookie.expirationDate,
      storeId: '0',
      value: cookie.value,
      id: Math.floor(Math.random() * 1000000)
    }));

    const data = JSON.stringify(editThisCookies, null, 2);
    return { success: true, data, cookies: editThisCookies, format: 'editthiscookie' };
  }

  /**
   * Import cookies from data in various formats
   * @param {string} data - Cookie data string
   * @param {string} format - Import format (json, netscape, editthiscookie, auto)
   * @returns {Promise<{success: boolean, imported: number, failed: number, errors?: Array}>}
   */
  async importCookies(data, format = 'auto') {
    try {
      let cookies;
      const detectedFormat = format === 'auto' ? this.detectFormat(data) : format;

      switch (detectedFormat.toLowerCase()) {
        case COOKIE_FORMATS.JSON:
          cookies = this.parseJSON(data);
          break;
        case COOKIE_FORMATS.NETSCAPE:
          cookies = this.parseNetscape(data);
          break;
        case COOKIE_FORMATS.EDIT_THIS_COOKIE:
          cookies = this.parseEditThisCookie(data);
          break;
        default:
          return { success: false, error: `Unknown format: ${format}` };
      }

      if (!cookies || cookies.length === 0) {
        return { success: false, error: 'No valid cookies found in data' };
      }

      return await this.setCookies(cookies);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect the format of cookie data
   * @param {string} data - Cookie data string
   * @returns {string} Detected format
   */
  detectFormat(data) {
    const trimmed = data.trim();

    // Check for Netscape format (starts with # or has tab-separated values)
    if (trimmed.startsWith('# Netscape') || trimmed.startsWith('# HTTP Cookie')) {
      return COOKIE_FORMATS.NETSCAPE;
    }

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        // Check for EditThisCookie format (has hostOnly and storeId fields)
        if (parsed.length > 0 && 'hostOnly' in parsed[0]) {
          return COOKIE_FORMATS.EDIT_THIS_COOKIE;
        }
        return COOKIE_FORMATS.JSON;
      }
    } catch (e) {
      // Not JSON, check for Netscape format by structure
      const lines = trimmed.split('\n').filter(line => !line.startsWith('#') && line.trim());
      if (lines.length > 0 && lines[0].split('\t').length >= 7) {
        return COOKIE_FORMATS.NETSCAPE;
      }
    }

    return COOKIE_FORMATS.JSON; // Default fallback
  }

  /**
   * Parse JSON format cookies
   * @param {string} data - JSON cookie data
   * @returns {Array} Array of cookie objects ready for import
   */
  parseJSON(data) {
    const cookies = JSON.parse(data);
    return cookies.map(cookie => this.normalizeCookie(cookie));
  }

  /**
   * Parse Netscape/Mozilla format cookies
   * @param {string} data - Netscape format cookie data
   * @returns {Array} Array of cookie objects ready for import
   */
  parseNetscape(data) {
    const lines = data.split('\n');
    const cookies = [];

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line.trim()) {
        continue;
      }

      const parts = line.split('\t');
      if (parts.length >= 7) {
        const [domain, , path, secure, expiration, name, value] = parts;

        const cookie = {
          url: `http${secure === 'TRUE' ? 's' : ''}://${domain.startsWith('.') ? domain.slice(1) : domain}${path}`,
          name: name.trim(),
          value: value ? value.trim() : '',
          domain: domain.trim(),
          path: path.trim(),
          secure: secure === 'TRUE',
          httpOnly: false // Netscape format doesn't include httpOnly
        };

        // Only set expirationDate if it's not a session cookie
        const exp = parseInt(expiration, 10);
        if (exp > 0) {
          cookie.expirationDate = exp;
        }

        cookies.push(cookie);
      }
    }

    return cookies;
  }

  /**
   * Parse EditThisCookie format cookies
   * @param {string} data - EditThisCookie JSON data
   * @returns {Array} Array of cookie objects ready for import
   */
  parseEditThisCookie(data) {
    const cookies = JSON.parse(data);
    return cookies.map(cookie => {
      const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
      return {
        url: `http${cookie.secure ? 's' : ''}://${domain}${cookie.path || '/'}`,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: this.normalizeSameSite(cookie.sameSite),
        expirationDate: cookie.session ? undefined : cookie.expirationDate
      };
    });
  }

  /**
   * Normalize a cookie object for Electron's cookies.set()
   * @param {Object} cookie - Cookie object from any format
   * @returns {Object} Normalized cookie object
   */
  normalizeCookie(cookie) {
    const domain = cookie.domain || '';
    const cleanDomain = domain.startsWith('.') ? domain.slice(1) : domain;

    return {
      url: cookie.url || `http${cookie.secure ? 's' : ''}://${cleanDomain}${cookie.path || '/'}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      secure: cookie.secure || false,
      httpOnly: cookie.httpOnly || false,
      sameSite: this.normalizeSameSite(cookie.sameSite),
      expirationDate: cookie.expirationDate
    };
  }

  /**
   * Normalize sameSite value
   * @param {string} sameSite - sameSite value
   * @returns {string} Normalized sameSite value
   */
  normalizeSameSite(sameSite) {
    if (!sameSite || sameSite === 'unspecified' || sameSite === 'no_restriction') {
      return 'no_restriction';
    }
    const valid = ['no_restriction', 'lax', 'strict'];
    const normalized = sameSite.toLowerCase();
    return valid.includes(normalized) ? normalized : 'no_restriction';
  }

  /**
   * Export cookies to a file
   * @param {string} filepath - Path to save the file
   * @param {string} format - Export format (json, netscape, editthiscookie)
   * @param {Object} filter - Optional filter for cookies to export
   * @returns {Promise<{success: boolean, filepath?: string, count?: number, error?: string}>}
   */
  async exportToFile(filepath, format = COOKIE_FORMATS.JSON, filter = {}) {
    try {
      const result = await this.exportCookies(format, filter);

      if (!result.success) {
        return result;
      }

      // Ensure directory exists
      const dir = path.dirname(filepath);
      await fs.mkdir(dir, { recursive: true });

      // Write the file
      await fs.writeFile(filepath, result.data, 'utf8');

      return {
        success: true,
        filepath,
        count: result.cookies.length,
        format: result.format
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Import cookies from a file
   * @param {string} filepath - Path to the cookie file
   * @param {string} format - Import format (json, netscape, editthiscookie, auto)
   * @returns {Promise<{success: boolean, imported: number, failed: number, errors?: Array}>}
   */
  async importFromFile(filepath, format = 'auto') {
    try {
      // Check if file exists
      await fs.access(filepath);

      // Read the file
      const data = await fs.readFile(filepath, 'utf8');

      // Import the cookies
      return await this.importCookies(data, format);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: false, error: `File not found: ${filepath}` };
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cookies for a specific domain
   * @param {string} domain - The domain to get cookies for
   * @returns {Promise<{success: boolean, cookies?: Array, error?: string}>}
   */
  async getCookiesForDomain(domain) {
    try {
      const cookies = await this.session.cookies.get({ domain });
      return { success: true, cookies, count: cookies.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Copy cookies from one domain to another
   * @param {string} fromDomain - Source domain
   * @param {string} toDomain - Target domain
   * @returns {Promise<{success: boolean, copied: number, failed: number}>}
   */
  async copyCookies(fromDomain, toDomain) {
    try {
      const result = await this.getCookiesForDomain(fromDomain);
      if (!result.success) {
        return result;
      }

      const copiedCookies = result.cookies.map(cookie => ({
        ...cookie,
        domain: toDomain,
        url: this.buildCookieUrl({ ...cookie, domain: toDomain })
      }));

      return await this.setCookies(copiedCookies);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cookie statistics
   * @returns {Promise<{success: boolean, stats?: Object, error?: string}>}
   */
  async getStats() {
    try {
      const cookies = await this.session.cookies.get({});

      const domains = new Set();
      let secureCookies = 0;
      let httpOnlyCookies = 0;
      let sessionCookies = 0;
      let persistentCookies = 0;

      for (const cookie of cookies) {
        domains.add(cookie.domain);
        if (cookie.secure) secureCookies++;
        if (cookie.httpOnly) httpOnlyCookies++;
        if (!cookie.expirationDate) {
          sessionCookies++;
        } else {
          persistentCookies++;
        }
      }

      return {
        success: true,
        stats: {
          total: cookies.length,
          domains: domains.size,
          secure: secureCookies,
          httpOnly: httpOnlyCookies,
          session: sessionCookies,
          persistent: persistentCookies
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get available export/import formats
   * @returns {Object} Available formats
   */
  getFormats() {
    return {
      formats: Object.values(COOKIE_FORMATS),
      descriptions: {
        json: 'Standard JSON array format',
        netscape: 'Netscape/Mozilla format (compatible with curl, wget)',
        editthiscookie: 'EditThisCookie browser extension format'
      }
    };
  }

  /**
   * Flush cookies to storage (ensure persistence)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async flushCookies() {
    try {
      await this.session.cookies.flushStore();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  CookieManager,
  COOKIE_FORMATS
};

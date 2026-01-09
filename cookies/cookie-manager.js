/**
 * Advanced Cookie Manager
 *
 * Comprehensive cookie management, analysis, and forensics
 *
 * @module cookies/cookie-manager
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Cookie attributes for analysis
 */
const COOKIE_FLAGS = {
  SECURE: 'Secure',
  HTTP_ONLY: 'HttpOnly',
  SAME_SITE_STRICT: 'SameSite=Strict',
  SAME_SITE_LAX: 'SameSite=Lax',
  SAME_SITE_NONE: 'SameSite=None'
};

/**
 * Cookie security classifications
 */
const SECURITY_LEVELS = {
  CRITICAL: 'critical',      // Session tokens, auth cookies
  HIGH: 'high',              // User preferences with PII
  MEDIUM: 'medium',          // Functional cookies
  LOW: 'low',                // Tracking, analytics
  NONE: 'none'               // No security concern
};

/**
 * Advanced Cookie Manager
 *
 * Provides comprehensive cookie management including:
 * - Cookie jar management with profiles
 * - Cookie synchronization across sessions
 * - Security analysis and classification
 * - Cookie forensics and provenance tracking
 * - Import/export capabilities
 */
class CookieManager extends EventEmitter {
  constructor(webContents) {
    super();
    this.webContents = webContents;
    this.cookieJars = new Map(); // profile -> cookies
    this.activeJar = 'default';
    this.history = []; // Cookie change history
    this.maxHistorySize = 1000;

    // Statistics
    this.stats = {
      cookiesCreated: 0,
      cookiesModified: 0,
      cookiesDeleted: 0,
      jarsCreated: 0,
      syncsPerformed: 0,
      securityIssuesFound: 0
    };
  }

  /**
   * Create a new cookie jar (profile)
   *
   * @param {string} name - Jar name
   * @param {Object} options - Jar options
   * @returns {Object} Created jar info
   */
  createJar(name, options = {}) {
    if (this.cookieJars.has(name)) {
      throw new Error(`Cookie jar '${name}' already exists`);
    }

    const jar = {
      name,
      created: new Date().toISOString(),
      cookies: [],
      metadata: options.metadata || {},
      isolated: options.isolated !== false, // Default isolated
      syncEnabled: options.syncEnabled !== false
    };

    this.cookieJars.set(name, jar);
    this.stats.jarsCreated++;

    this.emit('jar:created', { name, jar });

    return {
      name: jar.name,
      created: jar.created,
      cookieCount: 0,
      isolated: jar.isolated,
      syncEnabled: jar.syncEnabled
    };
  }

  /**
   * Delete a cookie jar
   *
   * @param {string} name - Jar name
   * @returns {boolean} Success
   */
  async deleteJar(name) {
    if (!this.cookieJars.has(name)) {
      throw new Error(`Cookie jar '${name}' not found`);
    }

    if (name === 'default') {
      throw new Error('Cannot delete default jar');
    }

    if (this.activeJar === name) {
      this.activeJar = 'default';
    }

    this.cookieJars.delete(name);
    this.emit('jar:deleted', { name });

    return true;
  }

  /**
   * List all cookie jars
   *
   * @returns {Array} List of jars with info
   */
  listJars() {
    const jars = [];

    for (const [name, jar] of this.cookieJars) {
      jars.push({
        name,
        created: jar.created,
        cookieCount: jar.cookies.length,
        isolated: jar.isolated,
        syncEnabled: jar.syncEnabled,
        active: name === this.activeJar,
        metadata: jar.metadata
      });
    }

    return jars;
  }

  /**
   * Switch to a different cookie jar
   *
   * @param {string} name - Jar name
   * @param {Object} options - Switch options
   * @returns {Object} Switch result
   */
  async switchJar(name, options = {}) {
    if (!this.cookieJars.has(name)) {
      throw new Error(`Cookie jar '${name}' not found`);
    }

    const previousJar = this.activeJar;

    // Save current cookies to current jar if enabled
    if (options.saveCurrent !== false) {
      await this.saveToJar(previousJar);
    }

    // Clear browser cookies if isolated
    const targetJar = this.cookieJars.get(name);
    if (targetJar.isolated) {
      await this.clearAllCookies();
    }

    // Load cookies from target jar
    if (options.loadTarget !== false) {
      await this.loadFromJar(name);
    }

    this.activeJar = name;

    this.emit('jar:switched', {
      from: previousJar,
      to: name,
      cookiesLoaded: targetJar.cookies.length
    });

    return {
      previousJar,
      currentJar: name,
      cookiesLoaded: targetJar.cookies.length,
      isolated: targetJar.isolated
    };
  }

  /**
   * Save current browser cookies to a jar
   *
   * @param {string} jarName - Jar name
   * @returns {Object} Save result
   */
  async saveToJar(jarName) {
    if (!this.cookieJars.has(jarName)) {
      throw new Error(`Cookie jar '${jarName}' not found`);
    }

    const cookies = await this.webContents.session.cookies.get({});
    const jar = this.cookieJars.get(jarName);

    jar.cookies = cookies.map(c => ({
      ...c,
      savedAt: new Date().toISOString()
    }));

    this.emit('jar:saved', {
      jarName,
      cookieCount: cookies.length
    });

    return {
      jarName,
      cookieCount: cookies.length,
      savedAt: new Date().toISOString()
    };
  }

  /**
   * Load cookies from a jar to browser
   *
   * @param {string} jarName - Jar name
   * @returns {Object} Load result
   */
  async loadFromJar(jarName) {
    if (!this.cookieJars.has(jarName)) {
      throw new Error(`Cookie jar '${jarName}' not found`);
    }

    const jar = this.cookieJars.get(jarName);
    let loaded = 0;
    let failed = 0;

    for (const cookie of jar.cookies) {
      try {
        // Remove savedAt before setting
        const { savedAt, ...cookieData } = cookie;

        await this.webContents.session.cookies.set({
          url: this._constructUrl(cookie),
          ...cookieData
        });
        loaded++;
      } catch (error) {
        failed++;
        this.emit('cookie:load:failed', { cookie, error: error.message });
      }
    }

    this.emit('jar:loaded', {
      jarName,
      loaded,
      failed
    });

    return {
      jarName,
      loaded,
      failed,
      total: jar.cookies.length
    };
  }

  /**
   * Synchronize cookies between jars
   *
   * @param {string} sourceJar - Source jar name
   * @param {string} targetJar - Target jar name
   * @param {Object} options - Sync options
   * @returns {Object} Sync result
   */
  async syncJars(sourceJar, targetJar, options = {}) {
    if (!this.cookieJars.has(sourceJar)) {
      throw new Error(`Source jar '${sourceJar}' not found`);
    }
    if (!this.cookieJars.has(targetJar)) {
      throw new Error(`Target jar '${targetJar}' not found`);
    }

    const source = this.cookieJars.get(sourceJar);
    const target = this.cookieJars.get(targetJar);

    const filter = options.filter || (() => true);
    const mode = options.mode || 'merge'; // merge, replace, update

    let added = 0;
    let updated = 0;
    let skipped = 0;

    if (mode === 'replace') {
      target.cookies = [];
    }

    for (const cookie of source.cookies) {
      if (!filter(cookie)) {
        skipped++;
        continue;
      }

      const existingIndex = target.cookies.findIndex(c =>
        c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
      );

      if (existingIndex >= 0) {
        if (mode === 'update' || mode === 'merge') {
          target.cookies[existingIndex] = { ...cookie };
          updated++;
        } else {
          skipped++;
        }
      } else {
        target.cookies.push({ ...cookie });
        added++;
      }
    }

    this.stats.syncsPerformed++;

    this.emit('jars:synced', {
      sourceJar,
      targetJar,
      added,
      updated,
      skipped
    });

    return {
      sourceJar,
      targetJar,
      added,
      updated,
      skipped,
      mode
    };
  }

  /**
   * Analyze cookie security
   *
   * @param {Object} cookie - Cookie to analyze
   * @returns {Object} Security analysis
   */
  analyzeCookieSecurity(cookie) {
    const issues = [];
    const recommendations = [];
    let securityLevel = SECURITY_LEVELS.NONE;

    // Check Secure flag
    if (!cookie.secure && cookie.domain.includes('.')) {
      issues.push({
        severity: 'high',
        type: 'missing_secure',
        message: 'Cookie transmitted over insecure HTTP',
        recommendation: 'Set Secure flag to prevent interception'
      });
      securityLevel = SECURITY_LEVELS.HIGH;
    }

    // Check HttpOnly flag
    if (!cookie.httpOnly && this._isSensitiveCookie(cookie)) {
      issues.push({
        severity: 'high',
        type: 'missing_httponly',
        message: 'Sensitive cookie accessible via JavaScript',
        recommendation: 'Set HttpOnly flag to prevent XSS attacks'
      });
      securityLevel = SECURITY_LEVELS.HIGH;
    }

    // Check SameSite
    if (!cookie.sameSite || cookie.sameSite === 'no_restriction') {
      issues.push({
        severity: 'medium',
        type: 'missing_samesite',
        message: 'Cookie vulnerable to CSRF attacks',
        recommendation: 'Set SameSite=Lax or SameSite=Strict'
      });
      if (securityLevel === SECURITY_LEVELS.NONE) {
        securityLevel = SECURITY_LEVELS.MEDIUM;
      }
    }

    // Check expiration
    if (!cookie.expirationDate) {
      recommendations.push({
        type: 'session_cookie',
        message: 'Session cookie will be deleted when browser closes',
        suggestion: 'Consider setting expiration for persistent storage'
      });
    } else {
      const expiresAt = new Date(cookie.expirationDate * 1000);
      const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry > 365 && this._isSensitiveCookie(cookie)) {
        issues.push({
          severity: 'medium',
          type: 'long_expiration',
          message: `Sensitive cookie expires in ${Math.round(daysUntilExpiry)} days`,
          recommendation: 'Consider shorter expiration for sensitive cookies'
        });
      }
    }

    // Check domain scope
    if (cookie.domain.startsWith('.')) {
      recommendations.push({
        type: 'wildcard_domain',
        message: 'Cookie shared across all subdomains',
        suggestion: 'Consider restricting to specific subdomain if possible'
      });
    }

    // Classify cookie
    const classification = this._classifyCookie(cookie);

    if (issues.length > 0) {
      this.stats.securityIssuesFound += issues.length;
    }

    return {
      cookie: {
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path
      },
      classification,
      securityLevel,
      issues,
      recommendations,
      flags: {
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'no_restriction'
      },
      score: this._calculateSecurityScore(issues, cookie)
    };
  }

  /**
   * Analyze all cookies
   *
   * @param {Object} options - Analysis options
   * @returns {Object} Complete analysis
   */
  async analyzeAllCookies(options = {}) {
    const cookies = await this.webContents.session.cookies.get({});
    const analyses = [];
    const summary = {
      total: cookies.length,
      secure: 0,
      httpOnly: 0,
      sameSite: 0,
      issues: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      classifications: {}
    };

    for (const cookie of cookies) {
      const analysis = this.analyzeCookieSecurity(cookie);
      analyses.push(analysis);

      // Update summary
      if (cookie.secure) summary.secure++;
      if (cookie.httpOnly) summary.httpOnly++;
      if (cookie.sameSite && cookie.sameSite !== 'no_restriction') summary.sameSite++;

      // Count issues by severity
      for (const issue of analysis.issues) {
        summary.issues[issue.severity] = (summary.issues[issue.severity] || 0) + 1;
      }

      // Count classifications
      summary.classifications[analysis.classification] =
        (summary.classifications[analysis.classification] || 0) + 1;
    }

    // Calculate overall security score
    const overallScore = this._calculateOverallScore(summary);

    return {
      summary,
      overallScore,
      analyses: options.includeDetails !== false ? analyses : undefined,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export cookies in various formats
   *
   * @param {Object} options - Export options
   * @returns {Object} Exported data
   */
  async exportCookies(options = {}) {
    const format = options.format || 'json';
    const jarName = options.jar || this.activeJar;

    let cookies;
    if (jarName) {
      const jar = this.cookieJars.get(jarName);
      if (!jar) {
        throw new Error(`Cookie jar '${jarName}' not found`);
      }
      cookies = jar.cookies;
    } else {
      cookies = await this.webContents.session.cookies.get({});
    }

    switch (format) {
      case 'json':
        return this._exportJSON(cookies, options);

      case 'netscape':
        return this._exportNetscape(cookies);

      case 'csv':
        return this._exportCSV(cookies);

      case 'curl':
        return this._exportCurl(cookies, options);

      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Import cookies from various formats
   *
   * @param {string|Object} data - Import data
   * @param {Object} options - Import options
   * @returns {Object} Import result
   */
  async importCookies(data, options = {}) {
    const format = options.format || 'json';
    let cookies;

    switch (format) {
      case 'json':
        cookies = typeof data === 'string' ? JSON.parse(data) : data;
        break;

      case 'netscape':
        cookies = this._parseNetscape(data);
        break;

      case 'csv':
        cookies = this._parseCSV(data);
        break;

      default:
        throw new Error(`Unknown format: ${format}`);
    }

    const jarName = options.jar || this.activeJar;
    const mode = options.mode || 'merge';

    if (jarName) {
      // Import to jar
      const jar = this.cookieJars.get(jarName);
      if (!jar) {
        throw new Error(`Cookie jar '${jarName}' not found`);
      }

      if (mode === 'replace') {
        jar.cookies = cookies;
      } else {
        jar.cookies.push(...cookies);
      }

      return {
        imported: cookies.length,
        jar: jarName,
        mode
      };
    } else {
      // Import to browser
      let imported = 0;
      let failed = 0;

      for (const cookie of cookies) {
        try {
          await this.webContents.session.cookies.set({
            url: this._constructUrl(cookie),
            ...cookie
          });
          imported++;
        } catch (error) {
          failed++;
        }
      }

      return { imported, failed, total: cookies.length };
    }
  }

  /**
   * Track cookie changes in history
   *
   * @param {string} action - Action type (created, modified, deleted)
   * @param {Object} cookie - Cookie data
   */
  _trackHistory(action, cookie) {
    const entry = {
      action,
      cookie: { ...cookie },
      timestamp: new Date().toISOString(),
      jar: this.activeJar
    };

    this.history.push(entry);

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.emit('cookie:tracked', entry);
  }

  /**
   * Get cookie change history
   *
   * @param {Object} filters - Filter options
   * @returns {Array} History entries
   */
  getHistory(filters = {}) {
    let history = [...this.history];

    if (filters.action) {
      history = history.filter(h => h.action === filters.action);
    }

    if (filters.domain) {
      history = history.filter(h =>
        h.cookie.domain && h.cookie.domain.includes(filters.domain)
      );
    }

    if (filters.jar) {
      history = history.filter(h => h.jar === filters.jar);
    }

    if (filters.limit) {
      history = history.slice(-filters.limit);
    }

    return history;
  }

  /**
   * Clear browser cookies
   */
  async clearAllCookies() {
    await this.webContents.session.cookies.flushStore();
    const cookies = await this.webContents.session.cookies.get({});

    for (const cookie of cookies) {
      const url = this._constructUrl(cookie);
      await this.webContents.session.cookies.remove(url, cookie.name);
    }

    this.emit('cookies:cleared', { count: cookies.length });

    return { cleared: cookies.length };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      jarsCount: this.cookieJars.size,
      activeJar: this.activeJar,
      historySize: this.history.length
    };
  }

  // Helper methods

  _constructUrl(cookie) {
    const protocol = cookie.secure ? 'https' : 'http';
    const domain = cookie.domain.startsWith('.') ?
      cookie.domain.substring(1) : cookie.domain;
    return `${protocol}://${domain}${cookie.path || '/'}`;
  }

  _isSensitiveCookie(cookie) {
    const sensitivePrefixes = ['session', 'auth', 'token', 'jwt', 'csrf'];
    const name = cookie.name.toLowerCase();
    return sensitivePrefixes.some(prefix => name.includes(prefix));
  }

  _classifyCookie(cookie) {
    const name = cookie.name.toLowerCase();

    if (name.includes('session') || name.includes('auth') || name.includes('token')) {
      return 'authentication';
    }
    if (name.includes('_ga') || name.includes('analytics') || name.includes('track')) {
      return 'analytics';
    }
    if (name.includes('ad') || name.includes('marketing')) {
      return 'advertising';
    }
    if (name.includes('pref') || name.includes('settings')) {
      return 'preferences';
    }
    if (name.includes('csrf') || name.includes('xsrf')) {
      return 'security';
    }

    return 'functional';
  }

  _calculateSecurityScore(issues, cookie) {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }

    // Bonus for security features
    if (cookie.secure) score += 5;
    if (cookie.httpOnly) score += 5;
    if (cookie.sameSite && cookie.sameSite !== 'no_restriction') score += 5;

    return Math.max(0, Math.min(100, score));
  }

  _calculateOverallScore(summary) {
    if (summary.total === 0) return 100;

    const secureRatio = summary.secure / summary.total;
    const httpOnlyRatio = summary.httpOnly / summary.total;
    const sameSiteRatio = summary.sameSite / summary.total;

    const issueDeduction =
      (summary.issues.critical || 0) * 5 +
      (summary.issues.high || 0) * 3 +
      (summary.issues.medium || 0) * 1;

    const score =
      (secureRatio * 30) +
      (httpOnlyRatio * 30) +
      (sameSiteRatio * 30) +
      10 - issueDeduction;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  _exportJSON(cookies, options) {
    const data = {
      exported: new Date().toISOString(),
      jar: options.jar,
      count: cookies.length,
      cookies: cookies
    };

    if (options.includeMetadata) {
      data.metadata = {
        userAgent: this.webContents.getUserAgent(),
        version: '1.0'
      };
    }

    return options.stringify !== false ? JSON.stringify(data, null, 2) : data;
  }

  _exportNetscape(cookies) {
    const lines = ['# Netscape HTTP Cookie File'];

    for (const cookie of cookies) {
      const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
      const flag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE';
      const path = cookie.path || '/';
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expiration = cookie.expirationDate || 0;
      const name = cookie.name;
      const value = cookie.value;

      lines.push(`${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`);
    }

    return lines.join('\n');
  }

  _exportCSV(cookies) {
    const headers = ['Name', 'Value', 'Domain', 'Path', 'Expires', 'Secure', 'HttpOnly', 'SameSite'];
    const rows = [headers.join(',')];

    for (const cookie of cookies) {
      const expires = cookie.expirationDate ?
        new Date(cookie.expirationDate * 1000).toISOString() : 'Session';

      const row = [
        cookie.name,
        cookie.value,
        cookie.domain,
        cookie.path || '/',
        expires,
        cookie.secure ? 'Yes' : 'No',
        cookie.httpOnly ? 'Yes' : 'No',
        cookie.sameSite || 'None'
      ];

      rows.push(row.map(v => `"${v}"`).join(','));
    }

    return rows.join('\n');
  }

  _exportCurl(cookies, options) {
    const url = options.url || 'https://example.com';
    const cookieStrings = cookies.map(c => `${c.name}=${c.value}`);
    return `curl -b "${cookieStrings.join('; ')}" "${url}"`;
  }

  _parseNetscape(data) {
    const lines = data.split('\n');
    const cookies = [];

    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      const parts = line.split('\t');
      if (parts.length !== 7) continue;

      cookies.push({
        domain: parts[0],
        path: parts[2],
        secure: parts[3] === 'TRUE',
        expirationDate: parseInt(parts[4]),
        name: parts[5],
        value: parts[6]
      });
    }

    return cookies;
  }

  _parseCSV(data) {
    const lines = data.split('\n');
    const cookies = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!parts || parts.length < 5) continue;

      const clean = parts.map(p => p.replace(/^"|"$/g, ''));

      cookies.push({
        name: clean[0],
        value: clean[1],
        domain: clean[2],
        path: clean[3],
        expirationDate: clean[4] === 'Session' ? undefined : Math.floor(new Date(clean[4]).getTime() / 1000),
        secure: clean[5] === 'Yes',
        httpOnly: clean[6] === 'Yes',
        sameSite: clean[7] !== 'None' ? clean[7].toLowerCase() : undefined
      });
    }

    return cookies;
  }
}

module.exports = {
  CookieManager,
  COOKIE_FLAGS,
  SECURITY_LEVELS
};

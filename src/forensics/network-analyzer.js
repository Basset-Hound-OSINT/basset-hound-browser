/**
 * Basset Hound Browser - Network Forensics
 * Request logging, DNS tracking, TLS analysis, timing analysis, waterfall diagrams
 */

const crypto = require('crypto');

class NetworkAnalyzer {
  constructor() {
    this.requests = [];
    this.dns_lookups = [];
    this.certificates = [];
    this.cookies = [];
    this.headers = {};
    this.timings = [];
  }

  /**
   * Initialize network monitoring
   * @param {Object} webContents - Electron webContents
   */
  initializeMonitoring(webContents) {
    // Monitor network requests
    webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
      this.recordRequestHeaders(details);
      callback({ requestHeaders: details.requestHeaders });
    });

    webContents.session.webRequest.onResponseStarted((details) => {
      this.recordResponseHeaders(details);
    });

    webContents.session.webRequest.onCompleted((details) => {
      this.recordRequestComplete(details);
    });

    webContents.session.webRequest.onErrorOccurred((details) => {
      this.recordRequestError(details);
    });

    return { success: true, monitoring: true };
  }

  /**
   * Record request headers
   */
  recordRequestHeaders(details) {
    const request = {
      id: crypto.randomBytes(8).toString('hex'),
      url: details.url,
      method: details.method,
      timestamp: Date.now(),
      type: details.resourceType,
      headers: details.requestHeaders,
      initiator: details.initiator,
      size: 0
    };

    this.requests.push(request);
    return request.id;
  }

  /**
   * Record response headers
   */
  recordResponseHeaders(details) {
    const request = this.requests.find(r => r.url === details.url);

    if (request) {
      request.status = details.statusCode;
      request.response_headers = details.responseHeaders;
      request.response_time = Date.now() - request.timestamp;

      // Analyze response headers for security info
      this.analyzeSecurityHeaders(request);

      // Extract cookies from Set-Cookie headers
      if (details.responseHeaders['set-cookie']) {
        const setCookies = Array.isArray(details.responseHeaders['set-cookie'])
          ? details.responseHeaders['set-cookie']
          : [details.responseHeaders['set-cookie']];

        setCookies.forEach(cookie => {
          this.recordCookie(cookie, details.url);
        });
      }
    }
  }

  /**
   * Record request completion
   */
  recordRequestComplete(details) {
    const request = this.requests.find(r => r.url === details.url);

    if (request) {
      request.total_time = Date.now() - request.timestamp;
      request.status = details.statusCode;
      request.size = details.responseBody ? details.responseBody.length : 0;
    }
  }

  /**
   * Record request error
   */
  recordRequestError(details) {
    const request = this.requests.find(r => r.url === details.url);

    if (request) {
      request.error = details.error;
      request.total_time = Date.now() - request.timestamp;
      request.status = 'error';
    }
  }

  /**
   * Analyze security headers
   */
  analyzeSecurityHeaders(request) {
    if (!request.response_headers) {
      return;
    }

    const headers = request.response_headers;

    request.security = {
      content_security_policy: Boolean(headers['content-security-policy']),
      x_frame_options: Boolean(headers['x-frame-options']),
      x_content_type_options: Boolean(headers['x-content-type-options']),
      strict_transport_security: Boolean(headers['strict-transport-security']),
      x_xss_protection: Boolean(headers['x-xss-protection']),
      referrer_policy: Boolean(headers['referrer-policy']),
      permissions_policy: Boolean(headers['permissions-policy'])
    };

    // Store header values
    if (headers['server']) {
      request.server = headers['server'];
    }
    if (headers['x-powered-by']) {
      request.powered_by = headers['x-powered-by'];
    }
  }

  /**
   * Record cookie information
   */
  recordCookie(cookieString, url) {
    const cookie = {
      url,
      raw: cookieString,
      timestamp: new Date().toISOString()
    };

    // Parse cookie attributes
    const parts = cookieString.split(';');
    const nameValue = parts[0].trim();
    const [name, value] = nameValue.split('=');

    cookie.name = name;
    cookie.value = value;

    // Parse attributes
    parts.slice(1).forEach(attr => {
      const [key, val] = attr.trim().split('=');
      if (key.toLowerCase() === 'path') {
        cookie.path = val;
      }
      if (key.toLowerCase() === 'domain') {
        cookie.domain = val;
      }
      if (key.toLowerCase() === 'expires') {
        cookie.expires = val;
      }
      if (key.toLowerCase() === 'max-age') {
        cookie.max_age = val;
      }
      if (key.toLowerCase() === 'secure') {
        cookie.secure = true;
      }
      if (key.toLowerCase() === 'httponly') {
        cookie.httponly = true;
      }
      if (key.toLowerCase() === 'samesite') {
        cookie.samesite = val;
      }
    });

    this.cookies.push(cookie);
  }

  /**
   * Track DNS resolution
   */
  recordDNSLookup(hostname, ipAddress, ttl = null) {
    this.dns_lookups.push({
      hostname,
      ip_address: ipAddress,
      timestamp: new Date().toISOString(),
      ttl
    });
  }

  /**
   * Record TLS/SSL certificate information
   */
  recordCertificate(certInfo) {
    this.certificates.push({
      subject: certInfo.subject || {},
      issuer: certInfo.issuer || {},
      valid_from: certInfo.validFrom,
      valid_to: certInfo.validTo,
      fingerprint: certInfo.fingerprint,
      fingerprint256: certInfo.fingerprint256,
      public_key_type: certInfo.publicKeyType,
      public_key_size: certInfo.publicKeySize,
      serial_number: certInfo.serialNumber,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyze all network requests
   */
  analyzeNetworkFlow() {
    const analysis = {
      total_requests: this.requests.length,
      total_data_transferred: this.calculateTotalDataTransferred(),
      requests_by_type: this.groupRequestsByType(),
      requests_by_domain: this.groupRequestsByDomain(),
      external_domains: this.identifyExternalDomains(),
      failed_requests: this.getFailedRequests(),
      slow_requests: this.getSlowRequests(),
      third_party_trackers: this.identifyTrackers(),
      security_summary: this.analyzeSecurity()
    };

    return analysis;
  }

  /**
   * Calculate total data transferred
   */
  calculateTotalDataTransferred() {
    return this.requests.reduce((total, req) => total + (req.size || 0), 0);
  }

  /**
   * Group requests by type
   */
  groupRequestsByType() {
    const grouped = {};

    this.requests.forEach(req => {
      const type = req.type || 'unknown';
      grouped[type] = (grouped[type] || 0) + 1;
    });

    return grouped;
  }

  /**
   * Group requests by domain
   */
  groupRequestsByDomain() {
    const grouped = {};

    this.requests.forEach(req => {
      try {
        const url = new URL(req.url);
        const domain = url.hostname;
        grouped[domain] = grouped[domain] || { count: 0, size: 0, requests: [] };
        grouped[domain].count++;
        grouped[domain].size += req.size || 0;
        grouped[domain].requests.push({
          path: url.pathname,
          size: req.size,
          status: req.status,
          time: req.response_time
        });
      } catch (err) {
        // Invalid URL
      }
    });

    return grouped;
  }

  /**
   * Identify external domains
   */
  identifyExternalDomains() {
    const domains = {};

    this.requests.forEach(req => {
      try {
        const url = new URL(req.url);
        const domain = url.hostname;

        if (!domains[domain]) {
          domains[domain] = {
            domain,
            count: 0,
            total_size: 0,
            is_third_party: this.isThirdPartyDomain(domain)
          };
        }

        domains[domain].count++;
        domains[domain].total_size += req.size || 0;
      } catch (err) {
        // Invalid URL
      }
    });

    // Filter to external only
    return Object.values(domains).filter(d => d.is_third_party);
  }

  /**
   * Check if domain is third-party
   */
  isThirdPartyDomain(hostname) {
    const topLevelDomains = ['localhost', '127.0.0.1', '192.168'];

    for (const tld of topLevelDomains) {
      if (hostname.includes(tld)) {
        return false;
      }
    }

    // Simple check: if not the primary domain, it's third-party
    return true;
  }

  /**
   * Get failed requests
   */
  getFailedRequests() {
    return this.requests.filter(req => req.status >= 400 || req.status === 'error').map(req => ({
      url: req.url,
      status: req.status,
      error: req.error || 'HTTP Error'
    }));
  }

  /**
   * Get slow requests (>1000ms)
   */
  getSlowRequests(threshold = 1000) {
    return this.requests
      .filter(req => req.total_time > threshold)
      .sort((a, b) => b.total_time - a.total_time)
      .map(req => ({
        url: req.url,
        time: req.total_time,
        size: req.size
      }));
  }

  /**
   * Identify tracking domains
   */
  identifyTrackers() {
    const trackerPatterns = [
      /google-analytics|ga\.js|/i,
      /facebook\.com\/tr|fbq/i,
      /doubleclick\.net/i,
      /segment\.com|analytics\.js/i,
      /mixpanel/i,
      /hotjar/i,
      /intercom/i,
      /drift/i,
      /amplitude/i,
      /full story/i,
      /sentry\.io/i
    ];

    const trackers = [];

    this.requests.forEach(req => {
      trackerPatterns.forEach(pattern => {
        if (pattern.test(req.url)) {
          trackers.push({
            url: req.url,
            type: this.identifyTrackerType(req.url),
            timestamp: req.timestamp
          });
        }
      });
    });

    return trackers;
  }

  /**
   * Identify tracker type
   */
  identifyTrackerType(url) {
    if (/google-analytics|ga\.js/.test(url)) {
      return 'Google Analytics';
    }
    if (/facebook\.com\/tr|fbq/.test(url)) {
      return 'Facebook Pixel';
    }
    if (/doubleclick\.net/.test(url)) {
      return 'DoubleClick';
    }
    if (/segment\.com|analytics\.js/.test(url)) {
      return 'Segment';
    }
    if (/mixpanel/.test(url)) {
      return 'Mixpanel';
    }
    if (/hotjar/.test(url)) {
      return 'Hotjar';
    }
    return 'Unknown Tracker';
  }

  /**
   * Analyze security across requests
   */
  analyzeSecurity() {
    const security = {
      https_requests: 0,
      http_requests: 0,
      requests_with_security_headers: 0,
      insecure_cookies: 0,
      total_cookies: this.cookies.length
    };

    this.requests.forEach(req => {
      if (req.url.startsWith('https')) {
        security.https_requests++;
      }
      if (req.url.startsWith('http:')) {
        security.http_requests++;
      }

      if (req.security) {
        const headerCount = Object.values(req.security).filter(v => v).length;
        if (headerCount > 0) {
          security.requests_with_security_headers++;
        }
      }
    });

    this.cookies.forEach(cookie => {
      if (!cookie.secure || !cookie.httponly) {
        security.insecure_cookies++;
      }
    });

    security.https_percent = (security.https_requests / this.requests.length * 100).toFixed(1);

    return security;
  }

  /**
   * Generate waterfall diagram data
   */
  generateWaterfall() {
    const startTime = Math.min(...this.requests.map(r => r.timestamp));
    const endTime = Math.max(...this.requests.map(r => r.timestamp + (r.total_time || 0)));

    const waterfall = this.requests.map(req => ({
      url: req.url,
      start: req.timestamp - startTime,
      duration: req.total_time || 0,
      status: req.status,
      size: req.size,
      type: req.type,
      blocked: (req.response_time || 0) - (req.total_time || 0)
    })).sort((a, b) => a.start - b.start);

    return {
      total_time: endTime - startTime,
      requests: waterfall
    };
  }

  /**
   * Generate network forensic report
   */
  generateReport(analysis = null) {
    const data = analysis || this.analyzeNetworkFlow();
    const waterfall = this.generateWaterfall();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Network Forensic Analysis Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1, h2 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
          .metric { display: inline-block; margin-right: 30px; padding: 10px; background: #f5f5f5; border-radius: 3px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #4CAF50; }
          .metric-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; }
          .waterfall-bar { height: 20px; background: #4CAF50; }
          .warning { background: #fff3cd; }
          .error { background: #f8d7da; }
          .success { background: #d4edda; }
        </style>
      </head>
      <body>
        <h1>Network Forensic Analysis Report</h1>
        <p><strong>Report Generated:</strong> ${new Date().toISOString()}</p>

        <h2>Network Overview</h2>
        <div class="metric">
          <div class="metric-value">${data.total_requests}</div>
          <div class="metric-label">Total Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${(data.total_data_transferred / 1024 / 1024).toFixed(2)} MB</div>
          <div class="metric-label">Data Transferred</div>
        </div>
        <div class="metric">
          <div class="metric-value">${waterfall.total_time}ms</div>
          <div class="metric-label">Total Time</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.failed_requests.length}</div>
          <div class="metric-label">Failed Requests</div>
        </div>

        <h2>Requests by Type</h2>
        <table>
          <tr><th>Type</th><th>Count</th></tr>
          ${Object.entries(data.requests_by_type).map(([type, count]) => `
            <tr><td>${type}</td><td>${count}</td></tr>
          `).join('')}
        </table>

        <h2>Top Domains</h2>
        <table>
          <tr><th>Domain</th><th>Requests</th><th>Size</th><th>Type</th></tr>
          ${Object.entries(data.requests_by_domain)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([domain, info]) => `
            <tr>
              <td>${domain}</td>
              <td>${info.count}</td>
              <td>${(info.size / 1024).toFixed(2)} KB</td>
              <td>${info.is_third_party ? '3rd Party' : '1st Party'}</td>
            </tr>
          `).join('')}
        </table>

        ${data.third_party_trackers.length > 0 ? `
          <h2>Detected Trackers (${data.third_party_trackers.length})</h2>
          <table>
            <tr><th>Tracker</th><th>Type</th><th>First Seen</th></tr>
            ${data.third_party_trackers.slice(0, 20).map(tracker => `
              <tr class="warning">
                <td>${tracker.url}</td>
                <td>${tracker.type}</td>
                <td>${new Date(tracker.timestamp).toISOString()}</td>
              </tr>
            `).join('')}
          </table>
        ` : '<p>No trackers detected</p>'}

        <h2>Security Analysis</h2>
        <div class="metric">
          <div class="metric-value">${data.security_summary.https_percent}%</div>
          <div class="metric-label">HTTPS Requests</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.security_summary.insecure_cookies}</div>
          <div class="metric-label">Insecure Cookies</div>
        </div>
        <div class="metric">
          <div class="metric-value">${data.security_summary.requests_with_security_headers}</div>
          <div class="metric-label">Requests with Security Headers</div>
        </div>

        ${data.failed_requests.length > 0 ? `
          <h2>Failed Requests</h2>
          <table>
            <tr><th>URL</th><th>Status</th></tr>
            ${data.failed_requests.slice(0, 20).map(req => `
              <tr class="error">
                <td>${req.url}</td>
                <td>${req.status}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}

        <h2>Slow Requests (>1000ms)</h2>
        ${data.slow_requests.length > 0 ? `
          <table>
            <tr><th>URL</th><th>Time</th><th>Size</th></tr>
            ${data.slow_requests.slice(0, 20).map(req => `
              <tr>
                <td>${req.url}</td>
                <td>${req.time}ms</td>
                <td>${(req.size / 1024).toFixed(2)} KB</td>
              </tr>
            `).join('')}
          </table>
        ` : '<p>No slow requests detected</p>'}
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Reset network monitoring
   */
  reset() {
    this.requests = [];
    this.dns_lookups = [];
    this.certificates = [];
    this.cookies = [];
    this.headers = {};
    this.timings = [];

    return { success: true, reset: true };
  }

  /**
   * Export network data
   */
  exportNetworkData() {
    return {
      requests: this.requests,
      dns_lookups: this.dns_lookups,
      certificates: this.certificates,
      cookies: this.cookies,
      analysis: this.analyzeNetworkFlow(),
      waterfall: this.generateWaterfall(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new NetworkAnalyzer();

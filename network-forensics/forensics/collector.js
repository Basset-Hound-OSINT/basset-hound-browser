/**
 * Network Forensics Collector
 *
 * Phase 19: Enhanced Network Forensics
 *
 * Provides comprehensive network forensic capabilities:
 * - DNS query capture and analysis
 * - TLS/SSL certificate chain extraction
 * - WebSocket connection tracking
 * - HTTP header analysis
 * - Cookie tracking with provenance
 * - Performance metrics collection
 * - Export to forensic report formats
 *
 * Features chain of custody, cryptographic hashing, and timeline tracking
 */

const crypto = require('crypto');
const EventEmitter = require('events');

const { FORENSICS_TYPES, EXPORT_FORMATS } = require('./constants');
const {
  exportJson,
  exportCsv,
  exportHtml,
  exportTimeline,
  summarizeTimelineEvent
} = require('./exporters');

/**
 * Network Forensics Collector
 *
 * Manages collection and analysis of network forensic data with
 * chain of custody tracking and cryptographic verification
 */
class NetworkForensicsCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      maxDnsQueries: options.maxDnsQueries || 10000,
      maxCertificates: options.maxCertificates || 1000,
      maxWebSocketConnections: options.maxWebSocketConnections || 100,
      maxHttpHeaders: options.maxHttpHeaders || 10000,
      maxCookies: options.maxCookies || 5000,
      enableHashing: options.enableHashing !== false,
      enableTimeline: options.enableTimeline !== false,
      ...options
    };

    // Storage
    this.dnsQueries = new Map(); // hostname -> query data
    this.tlsCertificates = new Map(); // hostname -> certificate chain
    this.websocketConnections = new Map(); // connectionId -> connection data
    this.httpHeaders = new Map(); // requestId -> headers
    this.cookies = new Map(); // cookieName -> cookie data with provenance
    this.performanceMetrics = [];

    // Timeline tracking
    this.timeline = [];

    // Chain of custody
    this.chainOfCustody = {
      collectionStarted: null,
      collectionEnded: null,
      collectedBy: options.collectedBy || 'Basset Hound Browser',
      sessionId: this._generateSessionId(),
      modifications: []
    };

    // Statistics
    this.stats = {
      dnsQueriesCount: 0,
      certificatesCount: 0,
      websocketConnectionsCount: 0,
      httpHeadersCount: 0,
      cookiesCount: 0,
      performanceMetricsCount: 0
    };

    // Capture state
    this.captureActive = false;
    this.captureStartTime = null;
  }

  /**
   * Generate a unique session ID
   * @private
   */
  _generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Generate cryptographic hash of data
   * @private
   */
  _hashData(data) {
    if (!this.options.enableHashing) {
      return null;
    }

    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Add event to timeline
   * @private
   */
  _addToTimeline(eventType, eventData) {
    if (!this.options.enableTimeline) {
      return;
    }

    const event = {
      timestamp: Date.now(),
      type: eventType,
      data: eventData,
      hash: this._hashData(eventData)
    };

    this.timeline.push(event);
  }

  /**
   * Record a modification in chain of custody
   * @private
   */
  _recordModification(action, details) {
    this.chainOfCustody.modifications.push({
      timestamp: Date.now(),
      action,
      details
    });
  }

  // ==========================================
  // CAPTURE CONTROL
  // ==========================================

  /**
   * Start forensic capture
   */
  startCapture() {
    if (this.captureActive) {
      throw new Error('Capture already active');
    }

    this.captureActive = true;
    this.captureStartTime = Date.now();
    this.chainOfCustody.collectionStarted = new Date().toISOString();

    this._recordModification('start_capture', {
      sessionId: this.chainOfCustody.sessionId
    });

    this.emit('captureStarted', {
      sessionId: this.chainOfCustody.sessionId,
      timestamp: this.captureStartTime
    });

    return {
      success: true,
      sessionId: this.chainOfCustody.sessionId,
      timestamp: this.captureStartTime
    };
  }

  /**
   * Stop forensic capture
   */
  stopCapture() {
    if (!this.captureActive) {
      throw new Error('Capture not active');
    }

    this.captureActive = false;
    this.chainOfCustody.collectionEnded = new Date().toISOString();

    const duration = Date.now() - this.captureStartTime;

    this._recordModification('stop_capture', {
      duration,
      itemsCaptured: this.timeline.length
    });

    this.emit('captureStopped', {
      sessionId: this.chainOfCustody.sessionId,
      duration
    });

    return {
      success: true,
      sessionId: this.chainOfCustody.sessionId,
      duration,
      itemsCaptured: this.timeline.length
    };
  }

  /**
   * Get capture status
   */
  getCaptureStatus() {
    return {
      active: this.captureActive,
      sessionId: this.chainOfCustody.sessionId,
      startTime: this.captureStartTime,
      duration: this.captureActive ? Date.now() - this.captureStartTime : 0,
      stats: { ...this.stats }
    };
  }

  // ==========================================
  // DNS QUERY CAPTURE
  // ==========================================

  /**
   * Capture a DNS query
   */
  captureDnsQuery(queryData) {
    if (this.dnsQueries.size >= this.options.maxDnsQueries) {
      // Remove oldest query
      const firstKey = this.dnsQueries.keys().next().value;
      this.dnsQueries.delete(firstKey);
    }

    const query = {
      id: `dns_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      hostname: queryData.hostname,
      type: queryData.type || 'A',
      response: queryData.response || null,
      responseTime: queryData.responseTime || null,
      status: queryData.status || 'pending',
      nameserver: queryData.nameserver || null,
      cached: queryData.cached || false,
      ttl: queryData.ttl || null,
      answers: queryData.answers || [],
      hash: null
    };

    query.hash = this._hashData(query);

    this.dnsQueries.set(query.hostname, query);
    this.stats.dnsQueriesCount++;

    this._addToTimeline(FORENSICS_TYPES.DNS_QUERY, query);

    this.emit('dnsQueryCaptured', query);

    return query;
  }

  /**
   * Get DNS queries
   */
  getDnsQueries(filter = {}) {
    let queries = Array.from(this.dnsQueries.values());

    // Apply filters
    if (filter.hostname) {
      queries = queries.filter(q =>
        q.hostname.includes(filter.hostname)
      );
    }

    if (filter.type) {
      queries = queries.filter(q => q.type === filter.type);
    }

    if (filter.cached !== undefined) {
      queries = queries.filter(q => q.cached === filter.cached);
    }

    // Sort by timestamp
    queries.sort((a, b) => b.timestamp - a.timestamp);

    return queries;
  }

  /**
   * Analyze DNS queries for patterns
   */
  analyzeDnsQueries() {
    const queries = Array.from(this.dnsQueries.values());

    const analysis = {
      totalQueries: queries.length,
      uniqueHostnames: new Set(queries.map(q => q.hostname)).size,
      cacheHitRate: queries.filter(q => q.cached).length / queries.length,
      averageResponseTime: queries.reduce((sum, q) => sum + (q.responseTime || 0), 0) / queries.length,
      queryTypes: {},
      topDomains: {},
      failedQueries: queries.filter(q => q.status === 'failed').length
    };

    // Count query types
    queries.forEach(q => {
      analysis.queryTypes[q.type] = (analysis.queryTypes[q.type] || 0) + 1;
    });

    // Count top domains
    queries.forEach(q => {
      const domain = q.hostname.split('.').slice(-2).join('.');
      analysis.topDomains[domain] = (analysis.topDomains[domain] || 0) + 1;
    });

    // Convert to sorted arrays
    analysis.topDomains = Object.entries(analysis.topDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return analysis;
  }

  // ==========================================
  // TLS CERTIFICATE CAPTURE
  // ==========================================

  /**
   * Capture TLS certificate chain
   */
  captureTlsCertificate(certData) {
    if (this.tlsCertificates.size >= this.options.maxCertificates) {
      // Remove oldest certificate
      const firstKey = this.tlsCertificates.keys().next().value;
      this.tlsCertificates.delete(firstKey);
    }

    const cert = {
      id: `cert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      hostname: certData.hostname,
      protocol: certData.protocol || 'TLS 1.3',
      cipher: certData.cipher || null,
      chain: certData.chain || [],
      valid: certData.valid !== false,
      validFrom: certData.validFrom || null,
      validTo: certData.validTo || null,
      issuer: certData.issuer || null,
      subject: certData.subject || null,
      fingerprint: certData.fingerprint || null,
      serialNumber: certData.serialNumber || null,
      subjectAltNames: certData.subjectAltNames || [],
      ocspStapling: certData.ocspStapling || false,
      ocspStatus: certData.ocspStatus || null,
      certificateTransparency: certData.certificateTransparency || false,
      hash: null
    };

    cert.hash = this._hashData(cert);

    this.tlsCertificates.set(cert.hostname, cert);
    this.stats.certificatesCount++;

    this._addToTimeline(FORENSICS_TYPES.TLS_CERTIFICATE, cert);

    this.emit('certificateCaptured', cert);

    return cert;
  }

  /**
   * Get TLS certificates
   */
  getTlsCertificates(filter = {}) {
    let certs = Array.from(this.tlsCertificates.values());

    // Apply filters
    if (filter.hostname) {
      certs = certs.filter(c =>
        c.hostname.includes(filter.hostname)
      );
    }

    if (filter.valid !== undefined) {
      certs = certs.filter(c => c.valid === filter.valid);
    }

    if (filter.protocol) {
      certs = certs.filter(c => c.protocol === filter.protocol);
    }

    // Sort by timestamp
    certs.sort((a, b) => b.timestamp - a.timestamp);

    return certs;
  }

  /**
   * Analyze TLS certificates
   */
  analyzeTlsCertificates() {
    const certs = Array.from(this.tlsCertificates.values());

    const analysis = {
      totalCertificates: certs.length,
      validCertificates: certs.filter(c => c.valid).length,
      invalidCertificates: certs.filter(c => !c.valid).length,
      protocols: {},
      ciphers: {},
      issuers: {},
      ocspStaplingRate: certs.filter(c => c.ocspStapling).length / certs.length,
      certificateTransparencyRate: certs.filter(c => c.certificateTransparency).length / certs.length,
      expiringWithin30Days: 0
    };

    // Count protocols, ciphers, issuers
    certs.forEach(c => {
      if (c.protocol) {
        analysis.protocols[c.protocol] = (analysis.protocols[c.protocol] || 0) + 1;
      }
      if (c.cipher) {
        analysis.ciphers[c.cipher] = (analysis.ciphers[c.cipher] || 0) + 1;
      }
      if (c.issuer) {
        analysis.issuers[c.issuer] = (analysis.issuers[c.issuer] || 0) + 1;
      }

      // Check expiration
      if (c.validTo) {
        const daysUntilExpiry = (new Date(c.validTo) - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysUntilExpiry < 30) {
          analysis.expiringWithin30Days++;
        }
      }
    });

    return analysis;
  }

  // ==========================================
  // WEBSOCKET CONNECTION TRACKING
  // ==========================================

  /**
   * Capture WebSocket connection
   */
  captureWebSocketConnection(wsData) {
    if (this.websocketConnections.size >= this.options.maxWebSocketConnections) {
      // Remove oldest connection
      const firstKey = this.websocketConnections.keys().next().value;
      this.websocketConnections.delete(firstKey);
    }

    const connection = {
      id: wsData.id || `ws_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      url: wsData.url,
      protocol: wsData.protocol || null,
      protocols: wsData.protocols || [],
      state: wsData.state || 'connecting',
      headers: wsData.headers || {},
      messages: wsData.messages || [],
      messageCount: wsData.messageCount || 0,
      bytesSent: wsData.bytesSent || 0,
      bytesReceived: wsData.bytesReceived || 0,
      openedAt: wsData.openedAt || Date.now(),
      closedAt: wsData.closedAt || null,
      closeCode: wsData.closeCode || null,
      closeReason: wsData.closeReason || null,
      duration: wsData.duration || null,
      hash: null
    };

    connection.hash = this._hashData(connection);

    this.websocketConnections.set(connection.id, connection);
    this.stats.websocketConnectionsCount++;

    this._addToTimeline(FORENSICS_TYPES.WEBSOCKET_CONNECTION, connection);

    this.emit('websocketConnectionCaptured', connection);

    return connection;
  }

  /**
   * Update WebSocket connection
   */
  updateWebSocketConnection(connectionId, updates) {
    const connection = this.websocketConnections.get(connectionId);
    if (!connection) {
      throw new Error(`WebSocket connection not found: ${connectionId}`);
    }

    Object.assign(connection, updates);
    connection.hash = this._hashData(connection);

    this.emit('websocketConnectionUpdated', connection);

    return connection;
  }

  /**
   * Get WebSocket connections
   */
  getWebSocketConnections(filter = {}) {
    let connections = Array.from(this.websocketConnections.values());

    // Apply filters
    if (filter.url) {
      connections = connections.filter(c =>
        c.url.includes(filter.url)
      );
    }

    if (filter.state) {
      connections = connections.filter(c => c.state === filter.state);
    }

    if (filter.protocol) {
      connections = connections.filter(c => c.protocol === filter.protocol);
    }

    // Sort by timestamp
    connections.sort((a, b) => b.timestamp - a.timestamp);

    return connections;
  }

  /**
   * Analyze WebSocket connections
   */
  analyzeWebSocketConnections() {
    const connections = Array.from(this.websocketConnections.values());

    const analysis = {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.state === 'open').length,
      closedConnections: connections.filter(c => c.state === 'closed').length,
      totalMessages: connections.reduce((sum, c) => sum + c.messageCount, 0),
      totalBytesSent: connections.reduce((sum, c) => sum + c.bytesSent, 0),
      totalBytesReceived: connections.reduce((sum, c) => sum + c.bytesReceived, 0),
      averageDuration: 0,
      protocols: {},
      topUrls: {}
    };

    // Calculate average duration
    const closedWithDuration = connections.filter(c => c.duration);
    if (closedWithDuration.length > 0) {
      analysis.averageDuration = closedWithDuration.reduce((sum, c) => sum + c.duration, 0) / closedWithDuration.length;
    }

    // Count protocols
    connections.forEach(c => {
      if (c.protocol) {
        analysis.protocols[c.protocol] = (analysis.protocols[c.protocol] || 0) + 1;
      }
    });

    // Count top URLs
    connections.forEach(c => {
      analysis.topUrls[c.url] = (analysis.topUrls[c.url] || 0) + 1;
    });

    // Convert to sorted array
    analysis.topUrls = Object.entries(analysis.topUrls)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }));

    return analysis;
  }

  // ==========================================
  // HTTP HEADER ANALYSIS
  // ==========================================

  /**
   * Capture HTTP headers
   */
  captureHttpHeaders(headerData) {
    if (this.httpHeaders.size >= this.options.maxHttpHeaders) {
      // Remove oldest headers
      const firstKey = this.httpHeaders.keys().next().value;
      this.httpHeaders.delete(firstKey);
    }

    const headers = {
      id: `headers_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      requestId: headerData.requestId || null,
      url: headerData.url,
      method: headerData.method || 'GET',
      statusCode: headerData.statusCode || null,
      requestHeaders: headerData.requestHeaders || {},
      responseHeaders: headerData.responseHeaders || {},
      securityHeaders: this._extractSecurityHeaders(headerData.responseHeaders || {}),
      hash: null
    };

    headers.hash = this._hashData(headers);

    this.httpHeaders.set(headers.id, headers);
    this.stats.httpHeadersCount++;

    this._addToTimeline(FORENSICS_TYPES.HTTP_HEADERS, headers);

    this.emit('httpHeadersCaptured', headers);

    return headers;
  }

  /**
   * Extract security-relevant headers
   * @private
   */
  _extractSecurityHeaders(headers) {
    const securityHeaders = {};

    const relevantHeaders = [
      'strict-transport-security',
      'content-security-policy',
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-embedder-policy',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy'
    ];

    relevantHeaders.forEach(header => {
      const value = Object.keys(headers).find(k => k.toLowerCase() === header);
      if (value) {
        securityHeaders[header] = headers[value];
      }
    });

    return securityHeaders;
  }

  /**
   * Get HTTP headers
   */
  getHttpHeaders(filter = {}) {
    let headers = Array.from(this.httpHeaders.values());

    // Apply filters
    if (filter.url) {
      headers = headers.filter(h =>
        h.url.includes(filter.url)
      );
    }

    if (filter.method) {
      headers = headers.filter(h => h.method === filter.method);
    }

    if (filter.statusCode) {
      headers = headers.filter(h => h.statusCode === filter.statusCode);
    }

    // Sort by timestamp
    headers.sort((a, b) => b.timestamp - a.timestamp);

    return headers;
  }

  /**
   * Analyze HTTP headers
   */
  analyzeHttpHeaders() {
    const headers = Array.from(this.httpHeaders.values());

    const analysis = {
      totalRequests: headers.length,
      methods: {},
      statusCodes: {},
      securityHeaderCoverage: {
        'strict-transport-security': 0,
        'content-security-policy': 0,
        'x-frame-options': 0,
        'x-content-type-options': 0
      },
      insecureRequests: 0,
      missingSecurityHeaders: []
    };

    // Count methods and status codes
    headers.forEach(h => {
      analysis.methods[h.method] = (analysis.methods[h.method] || 0) + 1;

      if (h.statusCode) {
        const statusRange = `${Math.floor(h.statusCode / 100)}xx`;
        analysis.statusCodes[statusRange] = (analysis.statusCodes[statusRange] || 0) + 1;
      }

      // Check security headers
      Object.keys(analysis.securityHeaderCoverage).forEach(header => {
        if (h.securityHeaders[header]) {
          analysis.securityHeaderCoverage[header]++;
        }
      });

      // Check for insecure requests
      if (h.url && h.url.startsWith('http://')) {
        analysis.insecureRequests++;
      }
    });

    // Calculate percentages
    Object.keys(analysis.securityHeaderCoverage).forEach(header => {
      const percentage = (analysis.securityHeaderCoverage[header] / headers.length) * 100;
      analysis.securityHeaderCoverage[header] = {
        count: analysis.securityHeaderCoverage[header],
        percentage: Math.round(percentage * 100) / 100
      };

      if (percentage < 50) {
        analysis.missingSecurityHeaders.push(header);
      }
    });

    return analysis;
  }

  // ==========================================
  // COOKIE TRACKING
  // ==========================================

  /**
   * Capture cookie with provenance
   */
  captureCookie(cookieData) {
    if (this.cookies.size >= this.options.maxCookies) {
      // Remove oldest cookie
      const firstKey = this.cookies.keys().next().value;
      this.cookies.delete(firstKey);
    }

    const cookie = {
      id: `cookie_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      name: cookieData.name,
      value: cookieData.value,
      domain: cookieData.domain,
      path: cookieData.path || '/',
      secure: cookieData.secure || false,
      httpOnly: cookieData.httpOnly || false,
      sameSite: cookieData.sameSite || 'None',
      expires: cookieData.expires || null,
      size: cookieData.size || (cookieData.name.length + cookieData.value.length),
      provenance: {
        setBy: cookieData.setBy || 'unknown',
        url: cookieData.url || null,
        firstSeen: cookieData.firstSeen || Date.now(),
        lastModified: cookieData.lastModified || Date.now(),
        modificationCount: cookieData.modificationCount || 0
      },
      hash: null
    };

    cookie.hash = this._hashData(cookie);

    this.cookies.set(`${cookie.domain}:${cookie.name}`, cookie);
    this.stats.cookiesCount++;

    this._addToTimeline(FORENSICS_TYPES.COOKIE, cookie);

    this.emit('cookieCaptured', cookie);

    return cookie;
  }

  /**
   * Get cookies
   */
  getCookies(filter = {}) {
    let cookies = Array.from(this.cookies.values());

    // Apply filters
    if (filter.domain) {
      cookies = cookies.filter(c =>
        c.domain.includes(filter.domain)
      );
    }

    if (filter.name) {
      cookies = cookies.filter(c => c.name === filter.name);
    }

    if (filter.secure !== undefined) {
      cookies = cookies.filter(c => c.secure === filter.secure);
    }

    if (filter.httpOnly !== undefined) {
      cookies = cookies.filter(c => c.httpOnly === filter.httpOnly);
    }

    // Sort by timestamp
    cookies.sort((a, b) => b.timestamp - a.timestamp);

    return cookies;
  }

  /**
   * Get cookie provenance
   */
  getCookieProvenance(domain, name) {
    const cookie = this.cookies.get(`${domain}:${name}`);
    if (!cookie) {
      return null;
    }

    return {
      cookie: {
        name: cookie.name,
        domain: cookie.domain,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly
      },
      provenance: cookie.provenance,
      hash: cookie.hash
    };
  }

  /**
   * Analyze cookies
   */
  analyzeCookies() {
    const cookies = Array.from(this.cookies.values());

    const analysis = {
      totalCookies: cookies.length,
      secureCookies: cookies.filter(c => c.secure).length,
      httpOnlyCookies: cookies.filter(c => c.httpOnly).length,
      sameSiteStrict: cookies.filter(c => c.sameSite === 'Strict').length,
      sameSiteLax: cookies.filter(c => c.sameSite === 'Lax').length,
      sameSiteNone: cookies.filter(c => c.sameSite === 'None').length,
      topDomains: {},
      averageSize: cookies.reduce((sum, c) => sum + c.size, 0) / cookies.length,
      expiringCookies: cookies.filter(c => c.expires).length,
      sessionCookies: cookies.filter(c => !c.expires).length
    };

    // Count top domains
    cookies.forEach(c => {
      analysis.topDomains[c.domain] = (analysis.topDomains[c.domain] || 0) + 1;
    });

    // Convert to sorted array
    analysis.topDomains = Object.entries(analysis.topDomains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    return analysis;
  }

  // ==========================================
  // PERFORMANCE METRICS
  // ==========================================

  /**
   * Capture performance metric
   */
  capturePerformanceMetric(metricData) {
    const metric = {
      id: `metric_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: Date.now(),
      type: metricData.type,
      name: metricData.name,
      value: metricData.value,
      unit: metricData.unit || 'ms',
      url: metricData.url || null,
      metadata: metricData.metadata || {},
      hash: null
    };

    metric.hash = this._hashData(metric);

    this.performanceMetrics.push(metric);
    this.stats.performanceMetricsCount++;

    this._addToTimeline(FORENSICS_TYPES.PERFORMANCE_METRIC, metric);

    this.emit('performanceMetricCaptured', metric);

    return metric;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(filter = {}) {
    let metrics = [...this.performanceMetrics];

    // Apply filters
    if (filter.type) {
      metrics = metrics.filter(m => m.type === filter.type);
    }

    if (filter.name) {
      metrics = metrics.filter(m => m.name === filter.name);
    }

    if (filter.url) {
      metrics = metrics.filter(m => m.url && m.url.includes(filter.url));
    }

    // Sort by timestamp
    metrics.sort((a, b) => b.timestamp - a.timestamp);

    return metrics;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get network forensics statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      captureActive: this.captureActive,
      captureStartTime: this.captureStartTime,
      sessionId: this.chainOfCustody.sessionId,
      collectionStarted: this.chainOfCustody.collectionStarted,
      collectionEnded: this.chainOfCustody.collectionEnded,
      timelineEvents: this.timeline.length,
      modifications: this.chainOfCustody.modifications.length
    };
  }

  // ==========================================
  // EXPORT
  // ==========================================

  /**
   * Export forensic report
   */
  exportForensicReport(format = EXPORT_FORMATS.JSON, options = {}) {
    const report = {
      metadata: {
        sessionId: this.chainOfCustody.sessionId,
        collectionStarted: this.chainOfCustody.collectionStarted,
        collectionEnded: this.chainOfCustody.collectionEnded,
        collectedBy: this.chainOfCustody.collectedBy,
        generatedAt: new Date().toISOString(),
        format
      },
      statistics: this.getStatistics(),
      chainOfCustody: this.chainOfCustody,
      data: {
        dnsQueries: options.includeDns !== false ? this.getDnsQueries() : [],
        tlsCertificates: options.includeCertificates !== false ? this.getTlsCertificates() : [],
        websocketConnections: options.includeWebSocket !== false ? this.getWebSocketConnections() : [],
        httpHeaders: options.includeHeaders !== false ? this.getHttpHeaders() : [],
        cookies: options.includeCookies !== false ? this.getCookies() : [],
        performanceMetrics: options.includePerformance !== false ? this.getPerformanceMetrics() : []
      },
      analysis: {
        dns: options.includeAnalysis !== false ? this.analyzeDnsQueries() : null,
        certificates: options.includeAnalysis !== false ? this.analyzeTlsCertificates() : null,
        websockets: options.includeAnalysis !== false ? this.analyzeWebSocketConnections() : null,
        headers: options.includeAnalysis !== false ? this.analyzeHttpHeaders() : null,
        cookies: options.includeAnalysis !== false ? this.analyzeCookies() : null
      },
      timeline: options.includeTimeline !== false ? this.timeline : []
    };

    // Generate report hash
    report.metadata.hash = this._hashData(report);

    switch (format) {
    case EXPORT_FORMATS.JSON:
      return this._exportJson(report, options);

    case EXPORT_FORMATS.CSV:
      return this._exportCsv(report, options);

    case EXPORT_FORMATS.HTML:
      return this._exportHtml(report, options);

    case EXPORT_FORMATS.TIMELINE:
      return this._exportTimeline(report, options);

    default:
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export as JSON
   * @private
   */
  _exportJson(report, options) {
    return exportJson(report, options);
  }

  /**
   * Export as CSV
   * @private
   */
  _exportCsv(report, options) {
    return exportCsv(report, options);
  }

  /**
   * Export as HTML
   * @private
   */
  _exportHtml(report, options) {
    return exportHtml(report, options);
  }

  /**
   * Export as timeline
   * @private
   */
  _exportTimeline(report, options) {
    return exportTimeline(report, options);
  }

  /**
   * Summarize timeline event
   * @private
   */
  _summarizeTimelineEvent(event) {
    return summarizeTimelineEvent(event);
  }


  // ==========================================
  // CLEANUP
  // ==========================================

  /**
   * Clear all forensic data
   */
  clearAll() {
    this.dnsQueries.clear();
    this.tlsCertificates.clear();
    this.websocketConnections.clear();
    this.httpHeaders.clear();
    this.cookies.clear();
    this.performanceMetrics = [];
    this.timeline = [];

    this.stats = {
      dnsQueriesCount: 0,
      certificatesCount: 0,
      websocketConnectionsCount: 0,
      httpHeadersCount: 0,
      cookiesCount: 0,
      performanceMetricsCount: 0
    };

    this._recordModification('clear_all', {
      timestamp: Date.now()
    });

    this.emit('dataCleared');

    return { success: true };
  }
}

module.exports = {
  NetworkForensicsCollector,
  FORENSICS_TYPES,
  EXPORT_FORMATS
};

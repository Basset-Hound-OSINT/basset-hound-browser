/**
 * Network Forensics Tests
 *
 * Phase 19: Enhanced Network Forensics
 *
 * Comprehensive tests for network forensics functionality
 */

const {
  NetworkForensicsCollector,
  FORENSICS_TYPES,
  EXPORT_FORMATS,
} = require('../../network-forensics/forensics');

describe('NetworkForensicsCollector', () => {
  let collector;

  beforeEach(() => {
    collector = new NetworkForensicsCollector({
      collectedBy: 'Test Suite',
      enableHashing: true,
      enableTimeline: true,
    });
  });

  afterEach(() => {
    if (collector) {
      collector.clearAll();
    }
  });

  // ==========================================
  // INITIALIZATION TESTS
  // ==========================================

  describe('Initialization', () => {
    test('should create collector with default options', () => {
      const c = new NetworkForensicsCollector();
      expect(c).toBeDefined();
      expect(c.options.maxDnsQueries).toBe(10000);
      expect(c.options.enableHashing).toBe(true);
    });

    test('should create collector with custom options', () => {
      const c = new NetworkForensicsCollector({
        maxDnsQueries: 5000,
        maxCertificates: 500,
        enableHashing: false,
      });
      expect(c.options.maxDnsQueries).toBe(5000);
      expect(c.options.maxCertificates).toBe(500);
      expect(c.options.enableHashing).toBe(false);
    });

    test('should generate unique session ID', () => {
      const c1 = new NetworkForensicsCollector();
      const c2 = new NetworkForensicsCollector();
      expect(c1.chainOfCustody.sessionId).not.toBe(c2.chainOfCustody.sessionId);
    });

    test('should initialize empty storage', () => {
      expect(collector.dnsQueries.size).toBe(0);
      expect(collector.tlsCertificates.size).toBe(0);
      expect(collector.websocketConnections.size).toBe(0);
      expect(collector.httpHeaders.size).toBe(0);
      expect(collector.cookies.size).toBe(0);
      expect(collector.performanceMetrics.length).toBe(0);
    });
  });

  // ==========================================
  // CAPTURE CONTROL TESTS
  // ==========================================

  describe('Capture Control', () => {
    test('should start capture', () => {
      const result = collector.startCapture();
      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(collector.captureActive).toBe(true);
    });

    test('should throw error if capture already active', () => {
      collector.startCapture();
      expect(() => collector.startCapture()).toThrow('Capture already active');
    });

    test('should stop capture', () => {
      collector.startCapture();
      const result = collector.stopCapture();
      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
      expect(collector.captureActive).toBe(false);
    });

    test('should throw error if capture not active', () => {
      expect(() => collector.stopCapture()).toThrow('Capture not active');
    });

    test('should get capture status', () => {
      collector.startCapture();
      const status = collector.getCaptureStatus();
      expect(status.active).toBe(true);
      expect(status.sessionId).toBeDefined();
      expect(status.startTime).toBeDefined();
      expect(status.stats).toBeDefined();
    });

    test('should emit captureStarted event', (done) => {
      collector.on('captureStarted', (data) => {
        expect(data.sessionId).toBeDefined();
        expect(data.timestamp).toBeDefined();
        done();
      });
      collector.startCapture();
    });

    test('should emit captureStopped event', (done) => {
      collector.startCapture();
      collector.on('captureStopped', (data) => {
        expect(data.sessionId).toBeDefined();
        expect(data.duration).toBeDefined();
        done();
      });
      collector.stopCapture();
    });
  });

  // ==========================================
  // DNS QUERY TESTS
  // ==========================================

  describe('DNS Query Capture', () => {
    test('should capture DNS query', () => {
      const query = collector.captureDnsQuery({
        hostname: 'example.com',
        type: 'A',
        responseTime: 25,
        status: 'resolved',
        answers: [{ data: '93.184.216.34' }],
      });

      expect(query.id).toBeDefined();
      expect(query.hostname).toBe('example.com');
      expect(query.type).toBe('A');
      expect(query.responseTime).toBe(25);
      expect(query.hash).toBeDefined();
    });

    test('should capture DNS query with default values', () => {
      const query = collector.captureDnsQuery({
        hostname: 'test.com',
      });

      expect(query.type).toBe('A');
      expect(query.status).toBe('pending');
      expect(query.cached).toBe(false);
    });

    test('should increment DNS query count', () => {
      collector.captureDnsQuery({ hostname: 'test1.com' });
      collector.captureDnsQuery({ hostname: 'test2.com' });
      expect(collector.stats.dnsQueriesCount).toBe(2);
    });

    test('should get DNS queries', () => {
      collector.captureDnsQuery({ hostname: 'example.com', type: 'A' });
      collector.captureDnsQuery({ hostname: 'test.com', type: 'AAAA' });

      const queries = collector.getDnsQueries();
      expect(queries.length).toBe(2);
    });

    test('should filter DNS queries by hostname', () => {
      collector.captureDnsQuery({ hostname: 'example.com' });
      collector.captureDnsQuery({ hostname: 'test.com' });

      const queries = collector.getDnsQueries({ hostname: 'example' });
      expect(queries.length).toBe(1);
      expect(queries[0].hostname).toBe('example.com');
    });

    test('should filter DNS queries by type', () => {
      collector.captureDnsQuery({ hostname: 'test1.com', type: 'A' });
      collector.captureDnsQuery({ hostname: 'test2.com', type: 'AAAA' });

      const queries = collector.getDnsQueries({ type: 'AAAA' });
      expect(queries.length).toBe(1);
      expect(queries[0].type).toBe('AAAA');
    });

    test('should filter DNS queries by cached status', () => {
      collector.captureDnsQuery({ hostname: 'test1.com', cached: true });
      collector.captureDnsQuery({ hostname: 'test2.com', cached: false });

      const queries = collector.getDnsQueries({ cached: true });
      expect(queries.length).toBe(1);
      expect(queries[0].cached).toBe(true);
    });

    test('should analyze DNS queries', () => {
      collector.captureDnsQuery({ hostname: 'example.com', type: 'A', responseTime: 20, cached: false });
      collector.captureDnsQuery({ hostname: 'test.com', type: 'AAAA', responseTime: 30, cached: true });
      collector.captureDnsQuery({ hostname: 'example.org', type: 'A', responseTime: 25, status: 'failed' });

      const analysis = collector.analyzeDnsQueries();
      expect(analysis.totalQueries).toBe(3);
      expect(analysis.uniqueHostnames).toBe(3);
      expect(analysis.cacheHitRate).toBeCloseTo(0.333, 2);
      expect(analysis.averageResponseTime).toBeCloseTo(25, 0);
      expect(analysis.failedQueries).toBe(1);
    });

    test('should limit DNS query storage', () => {
      const c = new NetworkForensicsCollector({ maxDnsQueries: 3 });
      c.captureDnsQuery({ hostname: 'test1.com' });
      c.captureDnsQuery({ hostname: 'test2.com' });
      c.captureDnsQuery({ hostname: 'test3.com' });
      c.captureDnsQuery({ hostname: 'test4.com' });

      expect(c.dnsQueries.size).toBe(3);
    });

    test('should emit dnsQueryCaptured event', (done) => {
      collector.on('dnsQueryCaptured', (query) => {
        expect(query.hostname).toBe('example.com');
        done();
      });
      collector.captureDnsQuery({ hostname: 'example.com' });
    });
  });

  // ==========================================
  // TLS CERTIFICATE TESTS
  // ==========================================

  describe('TLS Certificate Capture', () => {
    test('should capture TLS certificate', () => {
      const cert = collector.captureTlsCertificate({
        hostname: 'example.com',
        protocol: 'TLS 1.3',
        cipher: 'TLS_AES_128_GCM_SHA256',
        valid: true,
        issuer: 'Let\'s Encrypt',
        fingerprint: 'AA:BB:CC:DD',
      });

      expect(cert.id).toBeDefined();
      expect(cert.hostname).toBe('example.com');
      expect(cert.protocol).toBe('TLS 1.3');
      expect(cert.valid).toBe(true);
      expect(cert.hash).toBeDefined();
    });

    test('should capture certificate with default values', () => {
      const cert = collector.captureTlsCertificate({
        hostname: 'test.com',
      });

      expect(cert.protocol).toBe('TLS 1.3');
      expect(cert.valid).toBe(true);
    });

    test('should increment certificate count', () => {
      collector.captureTlsCertificate({ hostname: 'test1.com' });
      collector.captureTlsCertificate({ hostname: 'test2.com' });
      expect(collector.stats.certificatesCount).toBe(2);
    });

    test('should get TLS certificates', () => {
      collector.captureTlsCertificate({ hostname: 'example.com' });
      collector.captureTlsCertificate({ hostname: 'test.com' });

      const certs = collector.getTlsCertificates();
      expect(certs.length).toBe(2);
    });

    test('should filter certificates by hostname', () => {
      collector.captureTlsCertificate({ hostname: 'example.com' });
      collector.captureTlsCertificate({ hostname: 'test.com' });

      const certs = collector.getTlsCertificates({ hostname: 'example' });
      expect(certs.length).toBe(1);
      expect(certs[0].hostname).toBe('example.com');
    });

    test('should filter certificates by validity', () => {
      collector.captureTlsCertificate({ hostname: 'test1.com', valid: true });
      collector.captureTlsCertificate({ hostname: 'test2.com', valid: false });

      const certs = collector.getTlsCertificates({ valid: false });
      expect(certs.length).toBe(1);
      expect(certs[0].valid).toBe(false);
    });

    test('should analyze TLS certificates', () => {
      collector.captureTlsCertificate({
        hostname: 'example.com',
        protocol: 'TLS 1.3',
        valid: true,
        ocspStapling: true,
        certificateTransparency: true,
      });
      collector.captureTlsCertificate({
        hostname: 'test.com',
        protocol: 'TLS 1.2',
        valid: false,
        ocspStapling: false,
      });

      const analysis = collector.analyzeTlsCertificates();
      expect(analysis.totalCertificates).toBe(2);
      expect(analysis.validCertificates).toBe(1);
      expect(analysis.invalidCertificates).toBe(1);
      expect(analysis.ocspStaplingRate).toBe(0.5);
    });

    test('should limit certificate storage', () => {
      const c = new NetworkForensicsCollector({ maxCertificates: 2 });
      c.captureTlsCertificate({ hostname: 'test1.com' });
      c.captureTlsCertificate({ hostname: 'test2.com' });
      c.captureTlsCertificate({ hostname: 'test3.com' });

      expect(c.tlsCertificates.size).toBe(2);
    });

    test('should emit certificateCaptured event', (done) => {
      collector.on('certificateCaptured', (cert) => {
        expect(cert.hostname).toBe('example.com');
        done();
      });
      collector.captureTlsCertificate({ hostname: 'example.com' });
    });
  });

  // ==========================================
  // WEBSOCKET CONNECTION TESTS
  // ==========================================

  describe('WebSocket Connection Tracking', () => {
    test('should capture WebSocket connection', () => {
      const ws = collector.captureWebSocketConnection({
        url: 'wss://example.com/socket',
        protocol: 'chat',
        state: 'open',
        messageCount: 10,
      });

      expect(ws.id).toBeDefined();
      expect(ws.url).toBe('wss://example.com/socket');
      expect(ws.protocol).toBe('chat');
      expect(ws.state).toBe('open');
      expect(ws.hash).toBeDefined();
    });

    test('should generate connection ID if not provided', () => {
      const ws = collector.captureWebSocketConnection({
        url: 'wss://test.com/ws',
      });

      expect(ws.id).toMatch(/^ws_/);
    });

    test('should update WebSocket connection', () => {
      const ws = collector.captureWebSocketConnection({
        url: 'wss://example.com/socket',
        state: 'connecting',
      });

      const updated = collector.updateWebSocketConnection(ws.id, {
        state: 'open',
        messageCount: 5,
      });

      expect(updated.state).toBe('open');
      expect(updated.messageCount).toBe(5);
    });

    test('should throw error when updating non-existent connection', () => {
      expect(() => {
        collector.updateWebSocketConnection('invalid_id', {});
      }).toThrow('WebSocket connection not found');
    });

    test('should get WebSocket connections', () => {
      collector.captureWebSocketConnection({ url: 'wss://example.com/ws1' });
      collector.captureWebSocketConnection({ url: 'wss://example.com/ws2' });

      const connections = collector.getWebSocketConnections();
      expect(connections.length).toBe(2);
    });

    test('should filter connections by URL', () => {
      collector.captureWebSocketConnection({ url: 'wss://example.com/ws' });
      collector.captureWebSocketConnection({ url: 'wss://test.com/ws' });

      const connections = collector.getWebSocketConnections({ url: 'example' });
      expect(connections.length).toBe(1);
      expect(connections[0].url).toContain('example');
    });

    test('should filter connections by state', () => {
      collector.captureWebSocketConnection({ url: 'wss://test1.com', state: 'open' });
      collector.captureWebSocketConnection({ url: 'wss://test2.com', state: 'closed' });

      const connections = collector.getWebSocketConnections({ state: 'open' });
      expect(connections.length).toBe(1);
      expect(connections[0].state).toBe('open');
    });

    test('should analyze WebSocket connections', () => {
      collector.captureWebSocketConnection({
        url: 'wss://test1.com',
        state: 'open',
        messageCount: 10,
        bytesSent: 1000,
        bytesReceived: 2000,
        duration: 5000,
      });
      collector.captureWebSocketConnection({
        url: 'wss://test2.com',
        state: 'closed',
        messageCount: 5,
        bytesSent: 500,
        bytesReceived: 1000,
        duration: 3000,
      });

      const analysis = collector.analyzeWebSocketConnections();
      expect(analysis.totalConnections).toBe(2);
      expect(analysis.activeConnections).toBe(1);
      expect(analysis.closedConnections).toBe(1);
      expect(analysis.totalMessages).toBe(15);
      expect(analysis.totalBytesSent).toBe(1500);
      expect(analysis.totalBytesReceived).toBe(3000);
    });

    test('should limit WebSocket connection storage', () => {
      const c = new NetworkForensicsCollector({ maxWebSocketConnections: 2 });
      c.captureWebSocketConnection({ url: 'wss://test1.com' });
      c.captureWebSocketConnection({ url: 'wss://test2.com' });
      c.captureWebSocketConnection({ url: 'wss://test3.com' });

      expect(c.websocketConnections.size).toBe(2);
    });

    test('should emit websocketConnectionCaptured event', (done) => {
      collector.on('websocketConnectionCaptured', (ws) => {
        expect(ws.url).toBe('wss://example.com/socket');
        done();
      });
      collector.captureWebSocketConnection({ url: 'wss://example.com/socket' });
    });
  });

  // ==========================================
  // HTTP HEADER TESTS
  // ==========================================

  describe('HTTP Header Analysis', () => {
    test('should capture HTTP headers', () => {
      const headers = collector.captureHttpHeaders({
        url: 'https://example.com/api',
        method: 'GET',
        statusCode: 200,
        requestHeaders: { 'user-agent': 'Test' },
        responseHeaders: { 'content-type': 'application/json' },
      });

      expect(headers.id).toBeDefined();
      expect(headers.url).toBe('https://example.com/api');
      expect(headers.method).toBe('GET');
      expect(headers.statusCode).toBe(200);
      expect(headers.hash).toBeDefined();
    });

    test('should extract security headers', () => {
      const headers = collector.captureHttpHeaders({
        url: 'https://example.com',
        responseHeaders: {
          'strict-transport-security': 'max-age=31536000',
          'content-security-policy': 'default-src \'self\'',
          'x-frame-options': 'DENY',
        },
      });

      expect(headers.securityHeaders['strict-transport-security']).toBe('max-age=31536000');
      expect(headers.securityHeaders['content-security-policy']).toBe('default-src \'self\'');
      expect(headers.securityHeaders['x-frame-options']).toBe('DENY');
    });

    test('should get HTTP headers', () => {
      collector.captureHttpHeaders({ url: 'https://example.com/1' });
      collector.captureHttpHeaders({ url: 'https://example.com/2' });

      const headers = collector.getHttpHeaders();
      expect(headers.length).toBe(2);
    });

    test('should filter headers by URL', () => {
      collector.captureHttpHeaders({ url: 'https://example.com/api' });
      collector.captureHttpHeaders({ url: 'https://test.com/api' });

      const headers = collector.getHttpHeaders({ url: 'example' });
      expect(headers.length).toBe(1);
      expect(headers[0].url).toContain('example');
    });

    test('should filter headers by method', () => {
      collector.captureHttpHeaders({ url: 'https://test.com/1', method: 'GET' });
      collector.captureHttpHeaders({ url: 'https://test.com/2', method: 'POST' });

      const headers = collector.getHttpHeaders({ method: 'POST' });
      expect(headers.length).toBe(1);
      expect(headers[0].method).toBe('POST');
    });

    test('should analyze HTTP headers', () => {
      collector.captureHttpHeaders({
        url: 'https://example.com/1',
        method: 'GET',
        statusCode: 200,
        responseHeaders: { 'strict-transport-security': 'max-age=31536000' },
      });
      collector.captureHttpHeaders({
        url: 'http://example.com/2',
        method: 'POST',
        statusCode: 404,
        responseHeaders: {},
      });

      const analysis = collector.analyzeHttpHeaders();
      expect(analysis.totalRequests).toBe(2);
      expect(analysis.methods.GET).toBe(1);
      expect(analysis.methods.POST).toBe(1);
      expect(analysis.insecureRequests).toBe(1);
    });

    test('should limit HTTP header storage', () => {
      const c = new NetworkForensicsCollector({ maxHttpHeaders: 2 });
      c.captureHttpHeaders({ url: 'https://test1.com' });
      c.captureHttpHeaders({ url: 'https://test2.com' });
      c.captureHttpHeaders({ url: 'https://test3.com' });

      expect(c.httpHeaders.size).toBe(2);
    });

    test('should emit httpHeadersCaptured event', (done) => {
      collector.on('httpHeadersCaptured', (headers) => {
        expect(headers.url).toBe('https://example.com');
        done();
      });
      collector.captureHttpHeaders({ url: 'https://example.com' });
    });
  });

  // ==========================================
  // COOKIE TESTS
  // ==========================================

  describe('Cookie Tracking', () => {
    test('should capture cookie', () => {
      const cookie = collector.captureCookie({
        name: 'session',
        value: 'abc123',
        domain: 'example.com',
        secure: true,
        httpOnly: true,
      });

      expect(cookie.id).toBeDefined();
      expect(cookie.name).toBe('session');
      expect(cookie.domain).toBe('example.com');
      expect(cookie.secure).toBe(true);
      expect(cookie.hash).toBeDefined();
    });

    test('should capture cookie with provenance', () => {
      const cookie = collector.captureCookie({
        name: 'test',
        value: '123',
        domain: 'example.com',
        setBy: 'Set-Cookie header',
        url: 'https://example.com/login',
      });

      expect(cookie.provenance.setBy).toBe('Set-Cookie header');
      expect(cookie.provenance.url).toBe('https://example.com/login');
    });

    test('should get cookies', () => {
      collector.captureCookie({ name: 'cookie1', value: '1', domain: 'example.com' });
      collector.captureCookie({ name: 'cookie2', value: '2', domain: 'test.com' });

      const cookies = collector.getCookies();
      expect(cookies.length).toBe(2);
    });

    test('should filter cookies by domain', () => {
      collector.captureCookie({ name: 'c1', value: '1', domain: 'example.com' });
      collector.captureCookie({ name: 'c2', value: '2', domain: 'test.com' });

      const cookies = collector.getCookies({ domain: 'example' });
      expect(cookies.length).toBe(1);
      expect(cookies[0].domain).toContain('example');
    });

    test('should filter cookies by security flags', () => {
      collector.captureCookie({ name: 'c1', value: '1', domain: 'test.com', secure: true });
      collector.captureCookie({ name: 'c2', value: '2', domain: 'test.com', secure: false });

      const cookies = collector.getCookies({ secure: true });
      expect(cookies.length).toBe(1);
      expect(cookies[0].secure).toBe(true);
    });

    test('should get cookie provenance', () => {
      collector.captureCookie({
        name: 'session',
        value: 'abc',
        domain: 'example.com',
        setBy: 'JavaScript',
        url: 'https://example.com/app',
      });

      const provenance = collector.getCookieProvenance('example.com', 'session');
      expect(provenance).toBeDefined();
      expect(provenance.cookie.name).toBe('session');
      expect(provenance.provenance.setBy).toBe('JavaScript');
    });

    test('should return null for non-existent cookie provenance', () => {
      const provenance = collector.getCookieProvenance('example.com', 'nonexistent');
      expect(provenance).toBeNull();
    });

    test('should analyze cookies', () => {
      collector.captureCookie({
        name: 'c1',
        value: '1',
        domain: 'example.com',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict',
      });
      collector.captureCookie({
        name: 'c2',
        value: '2',
        domain: 'test.com',
        secure: false,
        httpOnly: false,
        sameSite: 'None',
      });

      const analysis = collector.analyzeCookies();
      expect(analysis.totalCookies).toBe(2);
      expect(analysis.secureCookies).toBe(1);
      expect(analysis.httpOnlyCookies).toBe(1);
      expect(analysis.sameSiteStrict).toBe(1);
      expect(analysis.sameSiteNone).toBe(1);
    });

    test('should limit cookie storage', () => {
      const c = new NetworkForensicsCollector({ maxCookies: 2 });
      c.captureCookie({ name: 'c1', value: '1', domain: 'test1.com' });
      c.captureCookie({ name: 'c2', value: '2', domain: 'test2.com' });
      c.captureCookie({ name: 'c3', value: '3', domain: 'test3.com' });

      expect(c.cookies.size).toBe(2);
    });

    test('should emit cookieCaptured event', (done) => {
      collector.on('cookieCaptured', (cookie) => {
        expect(cookie.name).toBe('test');
        done();
      });
      collector.captureCookie({ name: 'test', value: '123', domain: 'example.com' });
    });
  });

  // ==========================================
  // PERFORMANCE METRIC TESTS
  // ==========================================

  describe('Performance Metrics', () => {
    test('should capture performance metric', () => {
      const metric = collector.capturePerformanceMetric({
        type: 'timing',
        name: 'domContentLoaded',
        value: 1234,
        unit: 'ms',
      });

      expect(metric.id).toBeDefined();
      expect(metric.type).toBe('timing');
      expect(metric.name).toBe('domContentLoaded');
      expect(metric.value).toBe(1234);
      expect(metric.hash).toBeDefined();
    });

    test('should get performance metrics', () => {
      collector.capturePerformanceMetric({ type: 'timing', name: 'metric1', value: 100 });
      collector.capturePerformanceMetric({ type: 'timing', name: 'metric2', value: 200 });

      const metrics = collector.getPerformanceMetrics();
      expect(metrics.length).toBe(2);
    });

    test('should filter metrics by type', () => {
      collector.capturePerformanceMetric({ type: 'timing', name: 'm1', value: 100 });
      collector.capturePerformanceMetric({ type: 'resource', name: 'm2', value: 200 });

      const metrics = collector.getPerformanceMetrics({ type: 'timing' });
      expect(metrics.length).toBe(1);
      expect(metrics[0].type).toBe('timing');
    });

    test('should filter metrics by name', () => {
      collector.capturePerformanceMetric({ type: 'timing', name: 'load', value: 100 });
      collector.capturePerformanceMetric({ type: 'timing', name: 'render', value: 200 });

      const metrics = collector.getPerformanceMetrics({ name: 'load' });
      expect(metrics.length).toBe(1);
      expect(metrics[0].name).toBe('load');
    });

    test('should emit performanceMetricCaptured event', (done) => {
      collector.on('performanceMetricCaptured', (metric) => {
        expect(metric.name).toBe('test');
        done();
      });
      collector.capturePerformanceMetric({ type: 'timing', name: 'test', value: 100 });
    });
  });

  // ==========================================
  // STATISTICS TESTS
  // ==========================================

  describe('Statistics', () => {
    test('should get statistics', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });
      collector.captureTlsCertificate({ hostname: 'test.com' });
      collector.captureWebSocketConnection({ url: 'wss://test.com' });

      const stats = collector.getStatistics();
      expect(stats.dnsQueriesCount).toBe(1);
      expect(stats.certificatesCount).toBe(1);
      expect(stats.websocketConnectionsCount).toBe(1);
    });

    test('should include capture status in statistics', () => {
      collector.startCapture();
      const stats = collector.getStatistics();
      expect(stats.captureActive).toBe(true);
      expect(stats.sessionId).toBeDefined();
    });
  });

  // ==========================================
  // EXPORT TESTS
  // ==========================================

  describe('Export', () => {
    beforeEach(() => {
      collector.startCapture();
      collector.captureDnsQuery({ hostname: 'example.com' });
      collector.captureTlsCertificate({ hostname: 'example.com' });
      collector.captureWebSocketConnection({ url: 'wss://example.com' });
      collector.captureHttpHeaders({ url: 'https://example.com' });
      collector.captureCookie({ name: 'test', value: '123', domain: 'example.com' });
      collector.stopCapture();
    });

    test('should export as JSON', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.JSON);
      expect(result.format).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.data).toBeDefined();

      const report = JSON.parse(result.data);
      expect(report.metadata.sessionId).toBeDefined();
      expect(report.statistics).toBeDefined();
      expect(report.data.dnsQueries).toBeInstanceOf(Array);
    });

    test('should export as CSV', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.CSV);
      expect(result.format).toBe('csv');
      expect(result.mimeType).toBe('text/csv');
      expect(result.data).toContain('DNS Queries');
      expect(result.data).toContain('TLS Certificates');
    });

    test('should export as HTML', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.HTML);
      expect(result.format).toBe('html');
      expect(result.mimeType).toBe('text/html');
      expect(result.data).toContain('<!DOCTYPE html>');
      expect(result.data).toContain('Network Forensics Report');
    });

    test('should export timeline', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.TIMELINE);
      expect(result.format).toBe('json');
      expect(result.data).toBeDefined();

      const timeline = JSON.parse(result.data);
      expect(timeline).toBeInstanceOf(Array);
      expect(timeline.length).toBeGreaterThan(0);
    });

    test('should support selective data inclusion', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.JSON, {
        includeDns: true,
        includeCertificates: false,
        includeWebSocket: false,
      });

      const report = JSON.parse(result.data);
      expect(report.data.dnsQueries.length).toBeGreaterThan(0);
      expect(report.data.tlsCertificates.length).toBe(0);
      expect(report.data.websocketConnections.length).toBe(0);
    });

    test('should include analysis by default', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.JSON);
      const report = JSON.parse(result.data);
      expect(report.analysis.dns).toBeDefined();
      expect(report.analysis.certificates).toBeDefined();
    });

    test('should exclude analysis when requested', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.JSON, {
        includeAnalysis: false,
      });

      const report = JSON.parse(result.data);
      expect(report.analysis.dns).toBeNull();
    });

    test('should generate report hash', () => {
      const result = collector.exportForensicReport(EXPORT_FORMATS.JSON);
      const report = JSON.parse(result.data);
      expect(report.metadata.hash).toBeDefined();
      expect(report.metadata.hash.length).toBe(64); // SHA-256 hex length
    });

    test('should throw error for unsupported format', () => {
      expect(() => {
        collector.exportForensicReport('invalid_format');
      }).toThrow('Unsupported export format');
    });
  });

  // ==========================================
  // TIMELINE TESTS
  // ==========================================

  describe('Timeline', () => {
    test('should add events to timeline', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });
      collector.captureTlsCertificate({ hostname: 'test.com' });

      expect(collector.timeline.length).toBe(2);
    });

    test('should include event type in timeline', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });

      expect(collector.timeline[0].type).toBe(FORENSICS_TYPES.DNS_QUERY);
    });

    test('should include event hash in timeline', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });

      expect(collector.timeline[0].hash).toBeDefined();
    });

    test('should respect enableTimeline option', () => {
      const c = new NetworkForensicsCollector({ enableTimeline: false });
      c.captureDnsQuery({ hostname: 'test.com' });

      expect(c.timeline.length).toBe(0);
    });
  });

  // ==========================================
  // CHAIN OF CUSTODY TESTS
  // ==========================================

  describe('Chain of Custody', () => {
    test('should record capture start modification', () => {
      collector.startCapture();

      const mods = collector.chainOfCustody.modifications;
      expect(mods.length).toBeGreaterThan(0);
      expect(mods[0].action).toBe('start_capture');
    });

    test('should record capture stop modification', () => {
      collector.startCapture();
      collector.stopCapture();

      const mods = collector.chainOfCustody.modifications;
      expect(mods.length).toBe(2);
      expect(mods[1].action).toBe('stop_capture');
    });

    test('should record clear all modification', () => {
      collector.clearAll();

      const mods = collector.chainOfCustody.modifications;
      const clearMod = mods.find(m => m.action === 'clear_all');
      expect(clearMod).toBeDefined();
    });

    test('should include timestamps in modifications', () => {
      collector.startCapture();

      const mod = collector.chainOfCustody.modifications[0];
      expect(mod.timestamp).toBeDefined();
      expect(typeof mod.timestamp).toBe('number');
    });
  });

  // ==========================================
  // CLEANUP TESTS
  // ==========================================

  describe('Cleanup', () => {
    test('should clear all data', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });
      collector.captureTlsCertificate({ hostname: 'test.com' });
      collector.captureWebSocketConnection({ url: 'wss://test.com' });

      collector.clearAll();

      expect(collector.dnsQueries.size).toBe(0);
      expect(collector.tlsCertificates.size).toBe(0);
      expect(collector.websocketConnections.size).toBe(0);
      expect(collector.timeline.length).toBe(0);
    });

    test('should reset statistics on clear', () => {
      collector.captureDnsQuery({ hostname: 'test.com' });

      collector.clearAll();

      expect(collector.stats.dnsQueriesCount).toBe(0);
    });

    test('should emit dataCleared event', (done) => {
      collector.on('dataCleared', () => {
        done();
      });
      collector.clearAll();
    });
  });

  // ==========================================
  // HASH VERIFICATION TESTS
  // ==========================================

  describe('Hash Verification', () => {
    test('should generate hash for captured data', () => {
      const query = collector.captureDnsQuery({ hostname: 'test.com' });
      expect(query.hash).toBeDefined();
      expect(typeof query.hash).toBe('string');
      expect(query.hash.length).toBe(64); // SHA-256 hex
    });

    test('should update hash on connection update', () => {
      const ws = collector.captureWebSocketConnection({ url: 'wss://test.com' });
      const originalHash = ws.hash;

      const updated = collector.updateWebSocketConnection(ws.id, {
        messageCount: 10,
      });

      expect(updated.hash).not.toBe(originalHash);
    });

    test('should respect enableHashing option', () => {
      const c = new NetworkForensicsCollector({ enableHashing: false });
      const query = c.captureDnsQuery({ hostname: 'test.com' });

      expect(query.hash).toBeNull();
    });
  });

  // ==========================================
  // CONSTANTS TESTS
  // ==========================================

  describe('Constants', () => {
    test('should export FORENSICS_TYPES', () => {
      expect(FORENSICS_TYPES.DNS_QUERY).toBe('dns_query');
      expect(FORENSICS_TYPES.TLS_CERTIFICATE).toBe('tls_certificate');
      expect(FORENSICS_TYPES.WEBSOCKET_CONNECTION).toBe('websocket_connection');
      expect(FORENSICS_TYPES.HTTP_HEADERS).toBe('http_headers');
      expect(FORENSICS_TYPES.COOKIE).toBe('cookie');
      expect(FORENSICS_TYPES.PERFORMANCE_METRIC).toBe('performance_metric');
    });

    test('should export EXPORT_FORMATS', () => {
      expect(EXPORT_FORMATS.JSON).toBe('json');
      expect(EXPORT_FORMATS.CSV).toBe('csv');
      expect(EXPORT_FORMATS.HTML).toBe('html');
      expect(EXPORT_FORMATS.TIMELINE).toBe('timeline');
    });
  });
});

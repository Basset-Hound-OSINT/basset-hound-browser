/**
 * Network Forensics WebSocket Commands
 *
 * Phase 19: Enhanced Network Forensics
 *
 * Provides WebSocket API for:
 * - Starting/stopping forensic capture
 * - DNS query capture and analysis
 * - TLS/SSL certificate analysis
 * - WebSocket connection tracking
 * - HTTP header analysis
 * - Cookie tracking with provenance
 * - Performance metrics collection
 * - Export to forensic report formats
 */

const {
  NetworkForensicsCollector,
  FORENSICS_TYPES,
  EXPORT_FORMATS,
} = require('../../network-forensics/forensics');

/**
 * Network forensics collector instance
 */
let forensicsCollector = null;

/**
 * Initialize network forensics collector
 *
 * @param {Object} config - Configuration options
 */
function initializeNetworkForensicsCollector(config = {}) {
  forensicsCollector = new NetworkForensicsCollector(config);

  // Set up event handlers
  forensicsCollector.on('captureStarted', (data) => {
    console.log(`[Network Forensics] Capture started: ${data.sessionId}`);
  });

  forensicsCollector.on('captureStopped', (data) => {
    console.log(`[Network Forensics] Capture stopped: ${data.sessionId}, duration: ${data.duration}ms`);
  });

  forensicsCollector.on('dnsQueryCaptured', (query) => {
    console.log(`[Network Forensics] DNS query captured: ${query.hostname}`);
  });

  forensicsCollector.on('certificateCaptured', (cert) => {
    console.log(`[Network Forensics] Certificate captured: ${cert.hostname}`);
  });

  forensicsCollector.on('websocketConnectionCaptured', (ws) => {
    console.log(`[Network Forensics] WebSocket connection captured: ${ws.url}`);
  });

  return forensicsCollector;
}

/**
 * Get the network forensics collector instance
 */
function getNetworkForensicsCollector() {
  if (!forensicsCollector) {
    initializeNetworkForensicsCollector();
  }
  return forensicsCollector;
}

/**
 * Register network forensics commands
 *
 * @param {Object} commandHandlers - Command handlers object
 */
function registerNetworkForensicsCommands(commandHandlers) {
  // ==========================================
  // CAPTURE CONTROL
  // ==========================================

  /**
   * Start network forensics capture
   *
   * Command: start_network_forensics_capture
   *
   * Parameters:
   *   - options: object (optional)
   *     - maxDnsQueries: number
   *     - maxCertificates: number
   *     - maxWebSocketConnections: number
   *     - maxHttpHeaders: number
   *     - maxCookies: number
   *     - enableHashing: boolean
   *     - enableTimeline: boolean
   *     - collectedBy: string
   */
  commandHandlers.start_network_forensics_capture = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const result = collector.startCapture();

      return {
        success: true,
        sessionId: result.sessionId,
        timestamp: result.timestamp,
        message: 'Network forensics capture started',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Stop network forensics capture
   *
   * Command: stop_network_forensics_capture
   */
  commandHandlers.stop_network_forensics_capture = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const result = collector.stopCapture();

      return {
        success: true,
        sessionId: result.sessionId,
        duration: result.duration,
        itemsCaptured: result.itemsCaptured,
        message: 'Network forensics capture stopped',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get network forensics capture status
   *
   * Command: get_network_forensics_status
   */
  commandHandlers.get_network_forensics_status = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const status = collector.getCaptureStatus();

      return {
        success: true,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // DNS QUERY COMMANDS
  // ==========================================

  /**
   * Capture a DNS query
   *
   * Command: capture_dns_query
   *
   * Parameters:
   *   - hostname: string
   *   - type: string (optional, default: 'A')
   *   - response: object (optional)
   *   - responseTime: number (optional)
   *   - status: string (optional)
   *   - nameserver: string (optional)
   *   - cached: boolean (optional)
   *   - ttl: number (optional)
   *   - answers: array (optional)
   */
  commandHandlers.capture_dns_query = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const query = collector.captureDnsQuery(params);

      return {
        success: true,
        query: {
          id: query.id,
          hostname: query.hostname,
          type: query.type,
          status: query.status,
          hash: query.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get DNS queries
   *
   * Command: get_dns_queries
   *
   * Parameters:
   *   - filter: object (optional)
   *     - hostname: string
   *     - type: string
   *     - cached: boolean
   */
  commandHandlers.get_dns_queries = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const queries = collector.getDnsQueries(params.filter || {});

      return {
        success: true,
        queries,
        count: queries.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Analyze DNS queries
   *
   * Command: analyze_dns_queries
   */
  commandHandlers.analyze_dns_queries = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const analysis = collector.analyzeDnsQueries();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // TLS CERTIFICATE COMMANDS
  // ==========================================

  /**
   * Capture TLS certificate
   *
   * Command: capture_tls_certificate
   *
   * Parameters:
   *   - hostname: string
   *   - protocol: string (optional)
   *   - cipher: string (optional)
   *   - chain: array (optional)
   *   - valid: boolean (optional)
   *   - validFrom: string (optional)
   *   - validTo: string (optional)
   *   - issuer: string (optional)
   *   - subject: string (optional)
   *   - fingerprint: string (optional)
   *   - serialNumber: string (optional)
   *   - subjectAltNames: array (optional)
   *   - ocspStapling: boolean (optional)
   *   - ocspStatus: string (optional)
   *   - certificateTransparency: boolean (optional)
   */
  commandHandlers.capture_tls_certificate = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const cert = collector.captureTlsCertificate(params);

      return {
        success: true,
        certificate: {
          id: cert.id,
          hostname: cert.hostname,
          protocol: cert.protocol,
          valid: cert.valid,
          hash: cert.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get TLS certificates
   *
   * Command: get_tls_certificates
   *
   * Parameters:
   *   - filter: object (optional)
   *     - hostname: string
   *     - valid: boolean
   *     - protocol: string
   */
  commandHandlers.get_tls_certificates = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const certificates = collector.getTlsCertificates(params.filter || {});

      return {
        success: true,
        certificates,
        count: certificates.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Analyze TLS certificates
   *
   * Command: analyze_tls_certificates
   */
  commandHandlers.analyze_tls_certificates = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const analysis = collector.analyzeTlsCertificates();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // WEBSOCKET CONNECTION COMMANDS
  // ==========================================

  /**
   * Capture WebSocket connection
   *
   * Command: capture_websocket_connection
   *
   * Parameters:
   *   - id: string (optional)
   *   - url: string
   *   - protocol: string (optional)
   *   - protocols: array (optional)
   *   - state: string (optional)
   *   - headers: object (optional)
   *   - messages: array (optional)
   *   - messageCount: number (optional)
   *   - bytesSent: number (optional)
   *   - bytesReceived: number (optional)
   *   - openedAt: number (optional)
   *   - closedAt: number (optional)
   *   - closeCode: number (optional)
   *   - closeReason: string (optional)
   *   - duration: number (optional)
   */
  commandHandlers.capture_websocket_connection = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const connection = collector.captureWebSocketConnection(params);

      return {
        success: true,
        connection: {
          id: connection.id,
          url: connection.url,
          state: connection.state,
          hash: connection.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Update WebSocket connection
   *
   * Command: update_websocket_connection
   *
   * Parameters:
   *   - connectionId: string
   *   - updates: object
   */
  commandHandlers.update_websocket_connection = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const connection = collector.updateWebSocketConnection(
        params.connectionId,
        params.updates
      );

      return {
        success: true,
        connection: {
          id: connection.id,
          url: connection.url,
          state: connection.state,
          hash: connection.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get WebSocket connections
   *
   * Command: get_websocket_connections
   *
   * Parameters:
   *   - filter: object (optional)
   *     - url: string
   *     - state: string
   *     - protocol: string
   */
  commandHandlers.get_websocket_connections = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const connections = collector.getWebSocketConnections(params.filter || {});

      return {
        success: true,
        connections,
        count: connections.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Analyze WebSocket connections
   *
   * Command: analyze_websocket_connections
   */
  commandHandlers.analyze_websocket_connections = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const analysis = collector.analyzeWebSocketConnections();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // HTTP HEADER COMMANDS
  // ==========================================

  /**
   * Capture HTTP headers
   *
   * Command: capture_http_headers
   *
   * Parameters:
   *   - requestId: string (optional)
   *   - url: string
   *   - method: string (optional)
   *   - statusCode: number (optional)
   *   - requestHeaders: object (optional)
   *   - responseHeaders: object (optional)
   */
  commandHandlers.capture_http_headers = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const headers = collector.captureHttpHeaders(params);

      return {
        success: true,
        headers: {
          id: headers.id,
          url: headers.url,
          method: headers.method,
          statusCode: headers.statusCode,
          hash: headers.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get HTTP headers
   *
   * Command: get_http_headers
   *
   * Parameters:
   *   - filter: object (optional)
   *     - url: string
   *     - method: string
   *     - statusCode: number
   */
  commandHandlers.get_http_headers = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const headers = collector.getHttpHeaders(params.filter || {});

      return {
        success: true,
        headers,
        count: headers.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Analyze HTTP headers
   *
   * Command: analyze_http_headers
   */
  commandHandlers.analyze_http_headers = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const analysis = collector.analyzeHttpHeaders();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // COOKIE COMMANDS
  // ==========================================

  /**
   * Capture cookie
   *
   * Command: capture_cookie
   *
   * Parameters:
   *   - name: string
   *   - value: string
   *   - domain: string
   *   - path: string (optional)
   *   - secure: boolean (optional)
   *   - httpOnly: boolean (optional)
   *   - sameSite: string (optional)
   *   - expires: string (optional)
   *   - size: number (optional)
   *   - setBy: string (optional)
   *   - url: string (optional)
   *   - firstSeen: number (optional)
   *   - lastModified: number (optional)
   *   - modificationCount: number (optional)
   */
  commandHandlers.capture_cookie = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const cookie = collector.captureCookie(params);

      return {
        success: true,
        cookie: {
          id: cookie.id,
          name: cookie.name,
          domain: cookie.domain,
          hash: cookie.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get cookies
   *
   * Command: get_cookies
   *
   * Parameters:
   *   - filter: object (optional)
   *     - domain: string
   *     - name: string
   *     - secure: boolean
   *     - httpOnly: boolean
   */
  commandHandlers.get_cookies = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const cookies = collector.getCookies(params.filter || {});

      return {
        success: true,
        cookies,
        count: cookies.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get cookie provenance
   *
   * Command: get_cookie_provenance
   *
   * Parameters:
   *   - domain: string
   *   - name: string
   */
  commandHandlers.get_cookie_provenance = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const provenance = collector.getCookieProvenance(params.domain, params.name);

      if (!provenance) {
        return {
          success: false,
          error: 'Cookie not found',
        };
      }

      return {
        success: true,
        provenance,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Analyze cookies
   *
   * Command: analyze_cookies
   */
  commandHandlers.analyze_cookies = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const analysis = collector.analyzeCookies();

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // PERFORMANCE METRIC COMMANDS
  // ==========================================

  /**
   * Capture performance metric
   *
   * Command: capture_performance_metric
   *
   * Parameters:
   *   - type: string
   *   - name: string
   *   - value: number
   *   - unit: string (optional)
   *   - url: string (optional)
   *   - metadata: object (optional)
   */
  commandHandlers.capture_performance_metric = async (params) => {
    try {
      const collector = getNetworkForensicsCollector();
      const metric = collector.capturePerformanceMetric(params);

      return {
        success: true,
        metric: {
          id: metric.id,
          type: metric.type,
          name: metric.name,
          value: metric.value,
          hash: metric.hash,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get performance metrics
   *
   * Command: get_performance_metrics
   *
   * Parameters:
   *   - filter: object (optional)
   *     - type: string
   *     - name: string
   *     - url: string
   */
  commandHandlers.get_performance_metrics = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const metrics = collector.getPerformanceMetrics(params.filter || {});

      return {
        success: true,
        metrics,
        count: metrics.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // STATISTICS AND EXPORT
  // ==========================================

  /**
   * Get network forensics statistics
   *
   * Command: get_network_forensics_stats
   */
  commandHandlers.get_network_forensics_stats = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      const stats = collector.getStatistics();

      return {
        success: true,
        stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Export forensic report
   *
   * Command: export_forensic_report
   *
   * Parameters:
   *   - format: string (optional, default: 'json')
   *     Options: 'json', 'csv', 'html', 'timeline'
   *   - options: object (optional)
   *     - includeDns: boolean
   *     - includeCertificates: boolean
   *     - includeWebSocket: boolean
   *     - includeHeaders: boolean
   *     - includeCookies: boolean
   *     - includePerformance: boolean
   *     - includeAnalysis: boolean
   *     - includeTimeline: boolean
   *     - pretty: boolean
   */
  commandHandlers.export_forensic_report = async (params = {}) => {
    try {
      const collector = getNetworkForensicsCollector();
      const format = params.format || EXPORT_FORMATS.JSON;
      const report = collector.exportForensicReport(format, params.options || {});

      return {
        success: true,
        report,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Clear all forensic data
   *
   * Command: clear_network_forensics_data
   */
  commandHandlers.clear_network_forensics_data = async () => {
    try {
      const collector = getNetworkForensicsCollector();
      collector.clearAll();

      return {
        success: true,
        message: 'All network forensics data cleared',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ==========================================
  // UTILITY COMMANDS
  // ==========================================

  /**
   * Get available forensics types
   *
   * Command: get_forensics_types
   */
  commandHandlers.get_forensics_types = async () => {
    return {
      success: true,
      types: FORENSICS_TYPES,
      exportFormats: EXPORT_FORMATS,
    };
  };

  console.log('[Network Forensics] 27 forensics commands registered');
}

module.exports = {
  registerNetworkForensicsCommands,
  initializeNetworkForensicsCollector,
  getNetworkForensicsCollector,
};

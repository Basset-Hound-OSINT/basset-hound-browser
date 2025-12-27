/**
 * Basset Hound Browser - Network Analysis Manager
 * Main module for network monitoring and analysis
 *
 * Provides comprehensive network traffic capture, analysis, and security
 * assessment using Electron's webRequest API and CDP.
 */

const { session } = require('electron');
const { RequestTracker, RESOURCE_TYPES, REQUEST_STATUS } = require('./request-tracker');
const { SecurityAnalyzer, SECURITY_HEADERS } = require('./security-analyzer');

/**
 * NetworkAnalysisManager class
 * Central manager for network capture and analysis
 */
class NetworkAnalysisManager {
  constructor(options = {}) {
    // Request tracker for storing captured traffic
    this.requestTracker = new RequestTracker({
      maxRequests: options.maxRequests || 5000
    });

    // Security analyzer for header analysis
    this.securityAnalyzer = new SecurityAnalyzer();

    // Capture state
    this.isCapturing = false;
    this.captureStartTime = null;

    // WebContents reference
    this.webContents = null;

    // Electron session reference
    this.session = options.session || session.defaultSession;

    // WebRequest handlers
    this.onBeforeRequestHandler = null;
    this.onBeforeSendHeadersHandler = null;
    this.onSendHeadersHandler = null;
    this.onHeadersReceivedHandler = null;
    this.onResponseStartedHandler = null;
    this.onCompletedHandler = null;
    this.onErrorOccurredHandler = null;
    this.onBeforeRedirectHandler = null;

    // Request ID mapping (Electron's internal ID to our ID)
    this.requestIdMap = new Map();

    // Certificate cache for security analysis
    this.certificateCache = new Map();

    // Statistics
    this.stats = {
      captureSessionsCount: 0,
      totalCapturedRequests: 0
    };

    console.log('[NetworkAnalysisManager] Initialized');
  }

  /**
   * Start capturing network traffic
   * @param {Electron.WebContents} webContents - Optional webContents to monitor
   * @returns {Object} - Result of the operation
   */
  startCapture(webContents = null) {
    if (this.isCapturing) {
      return {
        success: false,
        error: 'Capture already in progress'
      };
    }

    this.webContents = webContents;

    try {
      this.setupWebRequestHandlers();
      this.isCapturing = true;
      this.captureStartTime = Date.now();
      this.stats.captureSessionsCount++;

      console.log('[NetworkAnalysisManager] Capture started');

      return {
        success: true,
        captureStartTime: this.captureStartTime,
        message: 'Network capture started'
      };
    } catch (error) {
      console.error('[NetworkAnalysisManager] Failed to start capture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Stop capturing network traffic
   * @returns {Object} - Result with capture summary
   */
  stopCapture() {
    if (!this.isCapturing) {
      return {
        success: false,
        error: 'No capture in progress'
      };
    }

    try {
      this.removeWebRequestHandlers();
      this.isCapturing = false;

      const captureEndTime = Date.now();
      const captureDuration = captureEndTime - this.captureStartTime;
      const stats = this.requestTracker.getStatistics();

      console.log('[NetworkAnalysisManager] Capture stopped');

      return {
        success: true,
        captureStartTime: this.captureStartTime,
        captureEndTime,
        captureDuration,
        capturedRequests: stats.statistics.capturedRequests,
        summary: stats.statistics
      };
    } catch (error) {
      console.error('[NetworkAnalysisManager] Failed to stop capture:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Setup webRequest event handlers
   */
  setupWebRequestHandlers() {
    const filter = { urls: ['<all_urls>'] };

    // onBeforeRequest - Capture initial request details
    this.onBeforeRequestHandler = (details, callback) => {
      const request = this.requestTracker.addRequest({
        id: details.id.toString(),
        url: details.url,
        method: details.method,
        resourceType: details.resourceType,
        tabId: details.tabId,
        frameId: details.frameId,
        parentFrameId: details.parentFrameId,
        initiator: details.initiator,
        requestBody: details.uploadData ? this.parseUploadData(details.uploadData) : null
      });

      this.requestIdMap.set(details.id.toString(), request.id);
      this.stats.totalCapturedRequests++;

      callback({ cancel: false });
    };

    // onBeforeSendHeaders - Capture request headers before sending
    this.onBeforeSendHeadersHandler = (details, callback) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        const request = this.requestTracker.getRequest(requestId);
        if (request) {
          request.requestHeaders = { ...details.requestHeaders };
        }
      }
      callback({ requestHeaders: details.requestHeaders });
    };

    // onSendHeaders - Capture final request headers
    this.onSendHeadersHandler = (details) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        const request = this.requestTracker.getRequest(requestId);
        if (request) {
          request.requestHeaders = { ...details.requestHeaders };
          request.timing.requestSentTime = Date.now();
        }
      }
    };

    // onHeadersReceived - Capture response headers
    this.onHeadersReceivedHandler = (details, callback) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        this.requestTracker.updateRequestWithHeaders(requestId, {
          responseHeaders: details.responseHeaders,
          statusCode: details.statusCode,
          statusLine: details.statusLine
        });
      }
      callback({ responseHeaders: details.responseHeaders });
    };

    // onResponseStarted - Response has begun
    this.onResponseStartedHandler = (details) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        const request = this.requestTracker.getRequest(requestId);
        if (request) {
          request.timing.responseStartTime = Date.now();
          request.fromCache = details.fromCache || false;

          // Try to get content length from headers
          if (details.responseHeaders) {
            const contentLength = this.getHeaderValue(details.responseHeaders, 'content-length');
            if (contentLength) {
              request.responseSize = parseInt(contentLength, 10);
            }
          }
        }
      }
    };

    // onCompleted - Request completed successfully
    this.onCompletedHandler = (details) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        this.requestTracker.completeRequest(requestId, {
          responseSize: details.responseSize || 0
        });
      }
    };

    // onErrorOccurred - Request failed
    this.onErrorOccurredHandler = (details) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        this.requestTracker.failRequest(requestId, {
          error: details.error,
          fromCache: details.fromCache
        });
      }
    };

    // onBeforeRedirect - Request was redirected
    this.onBeforeRedirectHandler = (details) => {
      const requestId = this.requestIdMap.get(details.id.toString());
      if (requestId) {
        this.requestTracker.redirectRequest(requestId, details.redirectURL);
      }
    };

    // Register handlers
    this.session.webRequest.onBeforeRequest(filter, this.onBeforeRequestHandler);
    this.session.webRequest.onBeforeSendHeaders(filter, this.onBeforeSendHeadersHandler);
    this.session.webRequest.onSendHeaders(filter, this.onSendHeadersHandler);
    this.session.webRequest.onHeadersReceived(filter, this.onHeadersReceivedHandler);
    this.session.webRequest.onResponseStarted(filter, this.onResponseStartedHandler);
    this.session.webRequest.onCompleted(filter, this.onCompletedHandler);
    this.session.webRequest.onErrorOccurred(filter, this.onErrorOccurredHandler);
    this.session.webRequest.onBeforeRedirect(filter, this.onBeforeRedirectHandler);
  }

  /**
   * Remove all webRequest handlers
   */
  removeWebRequestHandlers() {
    this.session.webRequest.onBeforeRequest(null);
    this.session.webRequest.onBeforeSendHeaders(null);
    this.session.webRequest.onSendHeaders(null);
    this.session.webRequest.onHeadersReceived(null);
    this.session.webRequest.onResponseStarted(null);
    this.session.webRequest.onCompleted(null);
    this.session.webRequest.onErrorOccurred(null);
    this.session.webRequest.onBeforeRedirect(null);

    this.onBeforeRequestHandler = null;
    this.onBeforeSendHeadersHandler = null;
    this.onSendHeadersHandler = null;
    this.onHeadersReceivedHandler = null;
    this.onResponseStartedHandler = null;
    this.onCompletedHandler = null;
    this.onErrorOccurredHandler = null;
    this.onBeforeRedirectHandler = null;
  }

  /**
   * Parse upload data from request
   * @param {Array} uploadData - Upload data array
   * @returns {Object|null} - Parsed upload data
   */
  parseUploadData(uploadData) {
    if (!uploadData || uploadData.length === 0) {
      return null;
    }

    try {
      const parsed = {
        type: 'raw',
        data: null
      };

      for (const item of uploadData) {
        if (item.bytes) {
          parsed.type = 'bytes';
          parsed.data = item.bytes.toString('utf8');
        } else if (item.file) {
          parsed.type = 'file';
          parsed.data = item.file;
        } else if (item.blobUUID) {
          parsed.type = 'blob';
          parsed.data = item.blobUUID;
        }
      }

      return parsed;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get header value from headers object (case-insensitive)
   * @param {Object} headers - Headers object
   * @param {string} name - Header name
   * @returns {string|null} - Header value or null
   */
  getHeaderValue(headers, name) {
    if (!headers) return null;

    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return Array.isArray(value) ? value[0] : value;
      }
    }
    return null;
  }

  /**
   * Get captured requests with optional filtering
   * @param {Object} filter - Filter options
   * @returns {Object} - Filtered requests
   */
  getRequests(filter = {}) {
    const requests = this.requestTracker.getRequests(filter);

    return {
      success: true,
      count: requests.length,
      filter,
      requests: requests.map(r => ({
        id: r.id,
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        domain: r.domain,
        status: r.status,
        statusCode: r.statusCode,
        responseSize: r.responseSize,
        duration: r.timing.duration,
        startTime: r.timing.startTime
      }))
    };
  }

  /**
   * Get full details of a specific request
   * @param {string} requestId - Request ID
   * @returns {Object} - Request details
   */
  getRequestDetails(requestId) {
    return this.requestTracker.getRequestDetails(requestId);
  }

  /**
   * Get response headers for a request
   * @param {string} requestId - Request ID
   * @returns {Object} - Response headers
   */
  getResponseHeaders(requestId) {
    return this.requestTracker.getResponseHeaders(requestId);
  }

  /**
   * Get security information for a URL
   * @param {string} url - URL to analyze
   * @param {string} requestId - Optional request ID to get headers from
   * @returns {Object} - Security analysis
   */
  getSecurityInfo(url, requestId = null) {
    let headers = {};
    let certificate = null;

    // If request ID provided, get headers from that request
    if (requestId) {
      const request = this.requestTracker.getRequest(requestId);
      if (request) {
        headers = request.responseHeaders;
        if (request.securityInfo) {
          certificate = request.securityInfo.certificate;
        }
      }
    }

    // Try to get certificate from cache
    if (!certificate) {
      try {
        const urlObj = new URL(url);
        certificate = this.certificateCache.get(urlObj.hostname);
      } catch (e) {
        // Invalid URL
      }
    }

    return this.securityAnalyzer.getSecurityInfo(url, headers, certificate);
  }

  /**
   * Analyze security headers for a URL
   * @param {string} url - URL to analyze
   * @param {Object} headers - Optional headers (if not provided, will look up from captured requests)
   * @returns {Object} - Header analysis
   */
  analyzeSecurityHeaders(url, headers = null) {
    if (!headers) {
      // Try to find headers from captured requests
      const requests = this.requestTracker.getRequests({
        urlPattern: url,
        status: [REQUEST_STATUS.COMPLETE],
        limit: 1
      });

      if (requests.length > 0) {
        headers = requests[0].responseHeaders;
      }
    }

    if (!headers) {
      return {
        success: false,
        error: 'No headers available for this URL. Make sure the page has been loaded.'
      };
    }

    return this.securityAnalyzer.analyzeHeaders(headers, url);
  }

  /**
   * Get resource timing metrics
   * @returns {Object} - Timing metrics
   */
  getResourceTiming() {
    return this.requestTracker.getResourceTiming();
  }

  /**
   * Clear all captured data
   * @returns {Object} - Result
   */
  clearCapture() {
    const result = this.requestTracker.clear();
    this.requestIdMap.clear();
    this.certificateCache.clear();

    console.log('[NetworkAnalysisManager] Capture data cleared');

    return result;
  }

  /**
   * Get capture statistics
   * @returns {Object} - Statistics
   */
  getStatistics() {
    const trackerStats = this.requestTracker.getStatistics();

    return {
      success: true,
      isCapturing: this.isCapturing,
      captureStartTime: this.captureStartTime,
      captureDuration: this.isCapturing ? Date.now() - this.captureStartTime : null,
      sessionStats: {
        captureSessionsCount: this.stats.captureSessionsCount,
        totalCapturedRequests: this.stats.totalCapturedRequests
      },
      requestStats: trackerStats.statistics
    };
  }

  /**
   * Get current capture status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      success: true,
      isCapturing: this.isCapturing,
      captureStartTime: this.captureStartTime,
      captureDuration: this.isCapturing ? Date.now() - this.captureStartTime : null,
      capturedRequestCount: this.requestTracker.requests.size,
      maxRequests: this.requestTracker.maxRequests
    };
  }

  /**
   * Export all captured data
   * @returns {Object} - Exported data
   */
  exportCapture() {
    const trackerExport = this.requestTracker.exportToJSON();

    return {
      success: true,
      exportedAt: new Date().toISOString(),
      captureStartTime: this.captureStartTime,
      isCapturing: this.isCapturing,
      ...trackerExport
    };
  }

  /**
   * Get requests grouped by domain
   * @returns {Object} - Requests grouped by domain
   */
  getRequestsByDomain() {
    const domains = new Map();

    for (const request of this.requestTracker.requests.values()) {
      if (!domains.has(request.domain)) {
        domains.set(request.domain, {
          domain: request.domain,
          requests: [],
          totalSize: 0,
          totalDuration: 0
        });
      }

      const domainData = domains.get(request.domain);
      domainData.requests.push({
        id: request.id,
        url: request.url,
        method: request.method,
        resourceType: request.resourceType,
        statusCode: request.statusCode,
        responseSize: request.responseSize,
        duration: request.timing.duration
      });
      domainData.totalSize += request.responseSize || 0;
      domainData.totalDuration += request.timing.duration || 0;
    }

    // Convert to array and sort by request count
    const result = Array.from(domains.values())
      .map(d => ({
        ...d,
        requestCount: d.requests.length,
        averageDuration: d.requests.length > 0 ? Math.round(d.totalDuration / d.requests.length) : 0
      }))
      .sort((a, b) => b.requestCount - a.requestCount);

    return {
      success: true,
      domainCount: result.length,
      domains: result
    };
  }

  /**
   * Get slow requests (above threshold)
   * @param {number} thresholdMs - Duration threshold in milliseconds
   * @returns {Object} - Slow requests
   */
  getSlowRequests(thresholdMs = 1000) {
    const slowRequests = this.requestTracker.getRequests({
      status: [REQUEST_STATUS.COMPLETE],
      sortBy: 'duration',
      sortOrder: 'desc'
    }).filter(r => r.timing.duration >= thresholdMs);

    return {
      success: true,
      thresholdMs,
      count: slowRequests.length,
      requests: slowRequests.map(r => ({
        id: r.id,
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        statusCode: r.statusCode,
        duration: r.timing.duration,
        responseSize: r.responseSize
      }))
    };
  }

  /**
   * Get failed requests
   * @returns {Object} - Failed requests
   */
  getFailedRequests() {
    const failedRequests = this.requestTracker.getRequests({
      status: [REQUEST_STATUS.FAILED]
    });

    return {
      success: true,
      count: failedRequests.length,
      requests: failedRequests.map(r => ({
        id: r.id,
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        error: r.error,
        startTime: r.timing.startTime
      }))
    };
  }

  /**
   * Get requests with specific status codes
   * @param {number} minStatus - Minimum status code
   * @param {number} maxStatus - Maximum status code
   * @returns {Object} - Matching requests
   */
  getRequestsByStatusRange(minStatus, maxStatus) {
    const requests = this.requestTracker.getRequests({
      statusCodeMin: minStatus,
      statusCodeMax: maxStatus
    });

    return {
      success: true,
      statusRange: { min: minStatus, max: maxStatus },
      count: requests.length,
      requests: requests.map(r => ({
        id: r.id,
        url: r.url,
        method: r.method,
        resourceType: r.resourceType,
        statusCode: r.statusCode,
        statusLine: r.statusLine
      }))
    };
  }

  /**
   * Get list of known security headers
   * @returns {Object} - Security headers list
   */
  getSecurityHeadersList() {
    return this.securityAnalyzer.getSecurityHeadersList();
  }

  /**
   * Get CSP directives list
   * @returns {Object} - CSP directives list
   */
  getCSPDirectivesList() {
    return this.securityAnalyzer.getCSPDirectivesList();
  }

  /**
   * Store certificate for a hostname
   * @param {string} hostname - Hostname
   * @param {Object} certificate - Certificate object
   */
  storeCertificate(hostname, certificate) {
    this.certificateCache.set(hostname, certificate);
  }

  /**
   * Get stored certificate for a hostname
   * @param {string} hostname - Hostname
   * @returns {Object|null} - Certificate or null
   */
  getCertificate(hostname) {
    return this.certificateCache.get(hostname) || null;
  }

  /**
   * Set maximum requests to store
   * @param {number} max - Maximum number of requests
   * @returns {Object} - Result
   */
  setMaxRequests(max) {
    if (typeof max !== 'number' || max < 100) {
      return {
        success: false,
        error: 'Max requests must be a number >= 100'
      };
    }

    this.requestTracker.maxRequests = max;

    return {
      success: true,
      maxRequests: max
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.isCapturing) {
      this.stopCapture();
    }

    this.requestTracker.cleanup();
    this.requestIdMap.clear();
    this.certificateCache.clear();
    this.webContents = null;

    console.log('[NetworkAnalysisManager] Cleaned up');
  }
}

// Create singleton instance
const networkAnalysisManager = new NetworkAnalysisManager();

module.exports = {
  NetworkAnalysisManager,
  networkAnalysisManager,
  RESOURCE_TYPES,
  REQUEST_STATUS,
  SECURITY_HEADERS
};

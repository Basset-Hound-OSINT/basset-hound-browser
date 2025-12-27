/**
 * Basset Hound Browser - Request Tracker Module
 * Tracks and stores HTTP request/response data for network analysis
 *
 * Provides storage and indexing for captured network traffic with
 * support for filtering by URL pattern, resource type, and status code.
 */

/**
 * Resource types for categorization
 */
const RESOURCE_TYPES = {
  DOCUMENT: 'mainFrame',
  SUBDOCUMENT: 'subFrame',
  STYLESHEET: 'stylesheet',
  SCRIPT: 'script',
  IMAGE: 'image',
  FONT: 'font',
  OBJECT: 'object',
  XHR: 'xmlhttprequest',
  PING: 'ping',
  CSP_REPORT: 'cspReport',
  MEDIA: 'media',
  WEBSOCKET: 'websocket',
  OTHER: 'other'
};

/**
 * Request status states
 */
const REQUEST_STATUS = {
  PENDING: 'pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REDIRECTED: 'redirected'
};

/**
 * RequestTracker class
 * Manages storage and retrieval of captured network requests
 */
class RequestTracker {
  constructor(options = {}) {
    // Maximum number of requests to store
    this.maxRequests = options.maxRequests || 5000;

    // Request storage - Map for O(1) lookup by ID
    this.requests = new Map();

    // Index by URL for pattern matching
    this.urlIndex = new Map();

    // Index by domain
    this.domainIndex = new Map();

    // Index by resource type
    this.typeIndex = new Map();

    // Index by status code
    this.statusIndex = new Map();

    // Request order tracking for cleanup
    this.requestOrder = [];

    // Statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      cancelledRequests: 0,
      redirectedRequests: 0,
      totalBytes: 0,
      byType: {},
      byDomain: {},
      byStatus: {}
    };

    console.log('[RequestTracker] Initialized');
  }

  /**
   * Generate a unique request ID
   * @returns {string}
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract domain from URL
   * @param {string} url - URL to parse
   * @returns {string}
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (e) {
      return 'unknown';
    }
  }

  /**
   * Add a new request to tracking
   * @param {Object} details - Request details from webRequest API
   * @returns {Object} - Tracked request object
   */
  addRequest(details) {
    const requestId = details.id || this.generateRequestId();
    const domain = this.extractDomain(details.url);

    const request = {
      id: requestId,
      url: details.url,
      method: details.method || 'GET',
      resourceType: details.resourceType || 'other',
      domain: domain,
      status: REQUEST_STATUS.PENDING,

      // Request metadata
      requestHeaders: details.requestHeaders || {},
      requestBody: details.requestBody || null,

      // Response metadata (filled in later)
      responseHeaders: {},
      statusCode: null,
      statusLine: null,
      responseSize: 0,

      // Timing information
      timing: {
        startTime: Date.now(),
        endTime: null,
        duration: null,
        responseStartTime: null,
        responseEndTime: null
      },

      // Additional metadata
      initiator: details.initiator || null,
      tabId: details.tabId,
      frameId: details.frameId,
      parentFrameId: details.parentFrameId,

      // Security info (filled in later)
      securityInfo: null,

      // Error info (if failed)
      error: null,

      // Redirect info
      redirectUrl: null,
      redirectCount: 0
    };

    // Store the request
    this.requests.set(requestId, request);
    this.requestOrder.push(requestId);

    // Update indexes
    this.addToIndex(this.urlIndex, details.url, requestId);
    this.addToIndex(this.domainIndex, domain, requestId);
    this.addToIndex(this.typeIndex, request.resourceType, requestId);

    // Update statistics
    this.stats.totalRequests++;
    this.stats.byType[request.resourceType] = (this.stats.byType[request.resourceType] || 0) + 1;
    this.stats.byDomain[domain] = (this.stats.byDomain[domain] || 0) + 1;

    // Cleanup old requests if over limit
    this.cleanupOldRequests();

    return request;
  }

  /**
   * Update request with response headers
   * @param {string} requestId - Request ID
   * @param {Object} details - Response details
   * @returns {Object|null} - Updated request or null if not found
   */
  updateRequestWithHeaders(requestId, details) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.responseHeaders = details.responseHeaders || {};
    request.statusCode = details.statusCode;
    request.statusLine = details.statusLine;
    request.timing.responseStartTime = Date.now();

    // Update status code index
    if (details.statusCode) {
      this.addToIndex(this.statusIndex, details.statusCode.toString(), requestId);
      this.stats.byStatus[details.statusCode] = (this.stats.byStatus[details.statusCode] || 0) + 1;
    }

    return request;
  }

  /**
   * Mark request as complete
   * @param {string} requestId - Request ID
   * @param {Object} details - Completion details
   * @returns {Object|null} - Updated request or null if not found
   */
  completeRequest(requestId, details = {}) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.status = REQUEST_STATUS.COMPLETE;
    request.timing.endTime = Date.now();
    request.timing.duration = request.timing.endTime - request.timing.startTime;
    request.timing.responseEndTime = Date.now();

    if (details.responseSize !== undefined) {
      request.responseSize = details.responseSize;
      this.stats.totalBytes += details.responseSize;
    }

    this.stats.completedRequests++;

    return request;
  }

  /**
   * Mark request as failed
   * @param {string} requestId - Request ID
   * @param {Object} error - Error details
   * @returns {Object|null} - Updated request or null if not found
   */
  failRequest(requestId, error) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.status = REQUEST_STATUS.FAILED;
    request.error = error;
    request.timing.endTime = Date.now();
    request.timing.duration = request.timing.endTime - request.timing.startTime;

    this.stats.failedRequests++;

    return request;
  }

  /**
   * Mark request as cancelled
   * @param {string} requestId - Request ID
   * @returns {Object|null} - Updated request or null if not found
   */
  cancelRequest(requestId) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.status = REQUEST_STATUS.CANCELLED;
    request.timing.endTime = Date.now();
    request.timing.duration = request.timing.endTime - request.timing.startTime;

    this.stats.cancelledRequests++;

    return request;
  }

  /**
   * Mark request as redirected
   * @param {string} requestId - Request ID
   * @param {string} redirectUrl - Redirect destination URL
   * @returns {Object|null} - Updated request or null if not found
   */
  redirectRequest(requestId, redirectUrl) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.status = REQUEST_STATUS.REDIRECTED;
    request.redirectUrl = redirectUrl;
    request.redirectCount++;

    this.stats.redirectedRequests++;

    return request;
  }

  /**
   * Update request with security info
   * @param {string} requestId - Request ID
   * @param {Object} securityInfo - Security information
   * @returns {Object|null} - Updated request or null if not found
   */
  updateSecurityInfo(requestId, securityInfo) {
    const request = this.requests.get(requestId);
    if (!request) {
      return null;
    }

    request.securityInfo = securityInfo;
    return request;
  }

  /**
   * Get a specific request by ID
   * @param {string} requestId - Request ID
   * @returns {Object|null} - Request object or null
   */
  getRequest(requestId) {
    return this.requests.get(requestId) || null;
  }

  /**
   * Get all requests with optional filtering
   * @param {Object} filter - Filter options
   * @returns {Array} - Array of matching requests
   */
  getRequests(filter = {}) {
    let results = Array.from(this.requests.values());

    // Filter by URL pattern
    if (filter.urlPattern) {
      const pattern = this.createPatternRegex(filter.urlPattern);
      results = results.filter(r => pattern.test(r.url));
    }

    // Filter by domain
    if (filter.domain) {
      results = results.filter(r => r.domain === filter.domain || r.domain.endsWith('.' + filter.domain));
    }

    // Filter by resource type
    if (filter.resourceType) {
      const types = Array.isArray(filter.resourceType) ? filter.resourceType : [filter.resourceType];
      results = results.filter(r => types.includes(r.resourceType));
    }

    // Filter by status code
    if (filter.statusCode) {
      const codes = Array.isArray(filter.statusCode) ? filter.statusCode : [filter.statusCode];
      results = results.filter(r => codes.includes(r.statusCode));
    }

    // Filter by status code range
    if (filter.statusCodeMin !== undefined || filter.statusCodeMax !== undefined) {
      const min = filter.statusCodeMin || 0;
      const max = filter.statusCodeMax || 999;
      results = results.filter(r => r.statusCode >= min && r.statusCode <= max);
    }

    // Filter by request status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      results = results.filter(r => statuses.includes(r.status));
    }

    // Filter by method
    if (filter.method) {
      const methods = Array.isArray(filter.method) ? filter.method : [filter.method];
      results = results.filter(r => methods.includes(r.method.toUpperCase()));
    }

    // Filter by time range
    if (filter.startTime) {
      results = results.filter(r => r.timing.startTime >= filter.startTime);
    }
    if (filter.endTime) {
      results = results.filter(r => r.timing.startTime <= filter.endTime);
    }

    // Filter by tab ID
    if (filter.tabId !== undefined) {
      results = results.filter(r => r.tabId === filter.tabId);
    }

    // Sort results
    if (filter.sortBy) {
      const sortField = filter.sortBy;
      const sortOrder = filter.sortOrder === 'desc' ? -1 : 1;

      results.sort((a, b) => {
        let aVal, bVal;

        if (sortField === 'duration') {
          aVal = a.timing.duration || 0;
          bVal = b.timing.duration || 0;
        } else if (sortField === 'size') {
          aVal = a.responseSize || 0;
          bVal = b.responseSize || 0;
        } else if (sortField === 'time') {
          aVal = a.timing.startTime;
          bVal = b.timing.startTime;
        } else if (sortField === 'status') {
          aVal = a.statusCode || 0;
          bVal = b.statusCode || 0;
        } else {
          aVal = a[sortField];
          bVal = b[sortField];
        }

        if (aVal < bVal) return -1 * sortOrder;
        if (aVal > bVal) return 1 * sortOrder;
        return 0;
      });
    }

    // Apply limit
    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Get request details including headers
   * @param {string} requestId - Request ID
   * @returns {Object} - Detailed request info
   */
  getRequestDetails(requestId) {
    const request = this.requests.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    return {
      success: true,
      request: {
        ...request,
        requestHeadersList: this.headersToList(request.requestHeaders),
        responseHeadersList: this.headersToList(request.responseHeaders)
      }
    };
  }

  /**
   * Get response headers for a request
   * @param {string} requestId - Request ID
   * @returns {Object} - Response headers
   */
  getResponseHeaders(requestId) {
    const request = this.requests.get(requestId);
    if (!request) {
      return { success: false, error: 'Request not found' };
    }

    return {
      success: true,
      requestId: requestId,
      statusCode: request.statusCode,
      headers: request.responseHeaders,
      headersList: this.headersToList(request.responseHeaders)
    };
  }

  /**
   * Convert headers object to list format
   * @param {Object} headers - Headers object
   * @returns {Array} - Array of {name, value} objects
   */
  headersToList(headers) {
    if (!headers) return [];

    const list = [];
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => list.push({ name, value: v }));
      } else {
        list.push({ name, value });
      }
    }
    return list;
  }

  /**
   * Create a regex from URL pattern
   * @param {string} pattern - URL pattern with wildcards
   * @returns {RegExp}
   */
  createPatternRegex(pattern) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    return new RegExp(escaped, 'i');
  }

  /**
   * Add request ID to an index
   * @param {Map} index - Index map
   * @param {string} key - Index key
   * @param {string} requestId - Request ID
   */
  addToIndex(index, key, requestId) {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key).add(requestId);
  }

  /**
   * Remove request ID from an index
   * @param {Map} index - Index map
   * @param {string} key - Index key
   * @param {string} requestId - Request ID
   */
  removeFromIndex(index, key, requestId) {
    if (index.has(key)) {
      index.get(key).delete(requestId);
      if (index.get(key).size === 0) {
        index.delete(key);
      }
    }
  }

  /**
   * Remove a request from all indexes
   * @param {string} requestId - Request ID
   */
  removeFromAllIndexes(requestId) {
    const request = this.requests.get(requestId);
    if (!request) return;

    this.removeFromIndex(this.urlIndex, request.url, requestId);
    this.removeFromIndex(this.domainIndex, request.domain, requestId);
    this.removeFromIndex(this.typeIndex, request.resourceType, requestId);
    if (request.statusCode) {
      this.removeFromIndex(this.statusIndex, request.statusCode.toString(), requestId);
    }
  }

  /**
   * Cleanup old requests when over limit
   */
  cleanupOldRequests() {
    while (this.requests.size > this.maxRequests && this.requestOrder.length > 0) {
      const oldestId = this.requestOrder.shift();
      this.removeFromAllIndexes(oldestId);
      this.requests.delete(oldestId);
    }
  }

  /**
   * Clear all captured requests
   * @returns {Object} - Result with count of cleared requests
   */
  clear() {
    const count = this.requests.size;

    this.requests.clear();
    this.urlIndex.clear();
    this.domainIndex.clear();
    this.typeIndex.clear();
    this.statusIndex.clear();
    this.requestOrder = [];

    // Reset statistics
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      cancelledRequests: 0,
      redirectedRequests: 0,
      totalBytes: 0,
      byType: {},
      byDomain: {},
      byStatus: {}
    };

    console.log(`[RequestTracker] Cleared ${count} requests`);

    return {
      success: true,
      cleared: count
    };
  }

  /**
   * Get statistics about captured requests
   * @returns {Object} - Statistics object
   */
  getStatistics() {
    // Calculate additional stats
    const requests = Array.from(this.requests.values());

    let avgDuration = 0;
    let avgSize = 0;
    let completedWithDuration = 0;
    let completedWithSize = 0;

    for (const req of requests) {
      if (req.timing.duration !== null) {
        avgDuration += req.timing.duration;
        completedWithDuration++;
      }
      if (req.responseSize > 0) {
        avgSize += req.responseSize;
        completedWithSize++;
      }
    }

    if (completedWithDuration > 0) {
      avgDuration = avgDuration / completedWithDuration;
    }
    if (completedWithSize > 0) {
      avgSize = avgSize / completedWithSize;
    }

    // Get top domains by request count
    const topDomains = Object.entries(this.stats.byDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    // Get request count by type
    const byType = { ...this.stats.byType };

    // Get status code distribution
    const byStatus = { ...this.stats.byStatus };

    return {
      success: true,
      statistics: {
        total: this.stats.totalRequests,
        completed: this.stats.completedRequests,
        failed: this.stats.failedRequests,
        cancelled: this.stats.cancelledRequests,
        redirected: this.stats.redirectedRequests,
        pending: this.requests.size - this.stats.completedRequests - this.stats.failedRequests - this.stats.cancelledRequests,
        totalBytes: this.stats.totalBytes,
        totalBytesFormatted: this.formatBytes(this.stats.totalBytes),
        averageDuration: Math.round(avgDuration),
        averageSize: Math.round(avgSize),
        averageSizeFormatted: this.formatBytes(avgSize),
        byType,
        byStatus,
        topDomains,
        uniqueDomains: this.domainIndex.size,
        capturedRequests: this.requests.size,
        maxRequests: this.maxRequests
      }
    };
  }

  /**
   * Format bytes to human-readable string
   * @param {number} bytes - Bytes to format
   * @returns {string}
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get requests by domain
   * @param {string} domain - Domain to search
   * @returns {Array} - Array of requests
   */
  getRequestsByDomain(domain) {
    const requestIds = this.domainIndex.get(domain);
    if (!requestIds) {
      return [];
    }

    return Array.from(requestIds).map(id => this.requests.get(id)).filter(Boolean);
  }

  /**
   * Get requests by resource type
   * @param {string} resourceType - Resource type to search
   * @returns {Array} - Array of requests
   */
  getRequestsByType(resourceType) {
    const requestIds = this.typeIndex.get(resourceType);
    if (!requestIds) {
      return [];
    }

    return Array.from(requestIds).map(id => this.requests.get(id)).filter(Boolean);
  }

  /**
   * Export all requests to JSON
   * @returns {Object} - Exported data
   */
  exportToJSON() {
    return {
      success: true,
      exportedAt: new Date().toISOString(),
      count: this.requests.size,
      requests: Array.from(this.requests.values()),
      statistics: this.getStatistics().statistics
    };
  }

  /**
   * Get resource timing data
   * @returns {Object} - Timing metrics
   */
  getResourceTiming() {
    const requests = Array.from(this.requests.values())
      .filter(r => r.status === REQUEST_STATUS.COMPLETE && r.timing.duration !== null);

    if (requests.length === 0) {
      return {
        success: true,
        timing: {
          count: 0,
          totalDuration: 0,
          averageDuration: 0,
          minDuration: 0,
          maxDuration: 0,
          byType: {}
        }
      };
    }

    const durations = requests.map(r => r.timing.duration);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    // Calculate timing by resource type
    const byType = {};
    for (const req of requests) {
      const type = req.resourceType;
      if (!byType[type]) {
        byType[type] = { count: 0, totalDuration: 0, totalSize: 0 };
      }
      byType[type].count++;
      byType[type].totalDuration += req.timing.duration;
      byType[type].totalSize += req.responseSize || 0;
    }

    // Calculate averages
    for (const type of Object.keys(byType)) {
      byType[type].averageDuration = Math.round(byType[type].totalDuration / byType[type].count);
      byType[type].averageSize = Math.round(byType[type].totalSize / byType[type].count);
    }

    return {
      success: true,
      timing: {
        count: requests.length,
        totalDuration,
        averageDuration: Math.round(totalDuration / requests.length),
        minDuration: Math.min(...durations),
        maxDuration: Math.max(...durations),
        byType
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clear();
    console.log('[RequestTracker] Cleaned up');
  }
}

module.exports = {
  RequestTracker,
  RESOURCE_TYPES,
  REQUEST_STATUS
};

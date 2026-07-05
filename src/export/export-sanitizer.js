/**
 * Export Sanitizer - Integration with Network Analysis Manager
 *
 * Provides functions to integrate SensitiveDataMasker into the export workflow.
 * Handles the sanitization of network logs and forensic exports.
 *
 * Usage:
 *   const { sanitizeNetworkExport } = require('./export-sanitizer');
 *   const result = sanitizeNetworkExport(networkLog, { sanitize: true });
 *
 * @module export-sanitizer
 */

const SensitiveDataMasker = require('./sensitive-data-masker');

/**
 * Create a masker instance with caching
 * @private
 */
let globalMasker = null;
let globalMaskerOptions = null;

function getMaskerInstance(options = {}) {
  // Create new masker if options have changed or masker doesn't exist
  const newOptions = {
    maskChar: options.maskChar || '*',
    revealChars: options.revealChars || 4,
    maskEmail: options.maskEmail !== false,
    maskPhones: options.maskPhones !== false,
    maskCreditCards: options.maskCreditCards !== false,
    maskSSNs: options.maskSSNs !== false,
    maskTokens: options.maskTokens !== false,
    maskAPIKeys: options.maskAPIKeys !== false,
    maskPasswords: options.maskPasswords !== false,
    maskPrivateKeys: options.maskPrivateKeys !== false,
    cachePatterns: true
  };

  // Check if options have changed
  const optionsChanged = !globalMaskerOptions ||
    JSON.stringify(newOptions) !== JSON.stringify(globalMaskerOptions);

  if (!globalMasker || optionsChanged) {
    globalMasker = new SensitiveDataMasker(newOptions);
    globalMaskerOptions = newOptions;
  }
  return globalMasker;
}

/**
 * Sanitize a single network request/response
 *
 * @param {Object} request - Network request object
 * @param {Object} options - Sanitization options
 * @param {boolean} options.sanitize - Enable/disable sanitization (default: true)
 * @param {boolean} options.removeHeaders - Remove sensitive headers instead of masking (default: false)
 * @param {Object} options.maskerOptions - Options to pass to masker
 * @returns {Object} Sanitized request
 */
function sanitizeRequest(request, options = {}) {
  const { sanitize = true, removeHeaders = false, maskerOptions = {} } = options;

  if (!sanitize || !request) {
    return request;
  }

  const masker = getMaskerInstance(maskerOptions);

  const sanitized = {
    id: request.id,
    url: request.url,
    method: request.method || 'GET',
    resourceType: request.resourceType,
    statusCode: request.statusCode,
    statusMessage: request.statusMessage,
    startTime: request.startTime,
    endTime: request.endTime,
    duration: request.duration,
    contentLength: request.contentLength,
    fromCache: request.fromCache,
    priority: request.priority,
    error: request.error,
    initiator: request.initiator
  };

  // Process headers
  if (request.requestHeaders) {
    sanitized.requestHeaders = removeHeaders
      ? masker.maskHeaders(request.requestHeaders, true)
      : masker.maskHeaders(request.requestHeaders, false);
  }

  if (request.responseHeaders) {
    sanitized.responseHeaders = removeHeaders
      ? masker.maskHeaders(request.responseHeaders, true)
      : masker.maskHeaders(request.responseHeaders, false);
  }

  // Process body
  if (request.requestBody) {
    sanitized.requestBody = masker.maskBody(request.requestBody);
  }

  if (request.responseBody) {
    sanitized.responseBody = masker.maskBody(request.responseBody);
  }

  return sanitized;
}

/**
 * Sanitize network export with array of requests
 *
 * @param {Object} exportData - Network export object with requests array
 * @param {Object} options - Sanitization options
 * @param {boolean} options.sanitize - Enable/disable sanitization (default: true)
 * @param {boolean} options.removeHeaders - Remove sensitive headers (default: false)
 * @param {boolean} options.stripBodies - Remove request/response bodies (default: false)
 * @param {Array} options.resourceTypeFilter - Only sanitize specific resource types
 * @param {Object} options.maskerOptions - Masker configuration
 * @returns {Object} Sanitized export data
 */
function sanitizeNetworkExport(exportData, options = {}) {
  const {
    sanitize = true,
    removeHeaders = false,
    stripBodies = false,
    resourceTypeFilter = null,
    maskerOptions = {}
  } = options;

  if (!sanitize || !exportData) {
    return exportData;
  }

  const masker = getMaskerInstance(maskerOptions);
  const sanitized = Object.assign({}, exportData);

  // Sanitize requests array
  if (Array.isArray(sanitized.requests)) {
    sanitized.requests = sanitized.requests.map(req => {
      // Apply resource type filter if specified
      if (resourceTypeFilter && resourceTypeFilter.length > 0) {
        if (!resourceTypeFilter.includes(req.resourceType)) {
          return req;
        }
      }

      const sanitizedReq = sanitizeRequest(req, {
        sanitize: true,
        removeHeaders,
        maskerOptions
      });

      // Strip bodies if configured
      if (stripBodies) {
        delete sanitizedReq.requestBody;
        delete sanitizedReq.responseBody;
      }

      return sanitizedReq;
    });
  }

  return sanitized;
}

/**
 * Create a HAR (HTTP Archive) with sanitized data
 *
 * @param {Object} har - HAR object
 * @param {Object} options - Sanitization options
 * @returns {Object} Sanitized HAR
 */
function sanitizeHAR(har, options = {}) {
  if (!har || !har.log || !Array.isArray(har.log.entries)) {
    return har;
  }

  const { sanitize = true, maskerOptions = {} } = options;

  if (!sanitize) {
    return har;
  }

  const masker = getMaskerInstance(maskerOptions);
  const sanitized = JSON.parse(JSON.stringify(har)); // Deep copy

  const sensitiveHeaderList = [
    'authorization', 'x-api-key', 'x-access-token', 'x-auth-token', 'x-csrf-token',
    'cookie', 'set-cookie', 'proxy-authorization', 'authentication', 'api-key',
    'access-token', 'auth-token'
  ];

  sanitized.log.entries = sanitized.log.entries.map(entry => {
    // Sanitize request
    if (entry.request) {
      if (entry.request.headers) {
        entry.request.headers = entry.request.headers.map(header => {
          if (sensitiveHeaderList.includes(header.name.toLowerCase())) {
            return {
              name: header.name,
              value: `[MASKED-${header.name}]`
            };
          }
          return header;
        });
      }

      if (entry.request.postData && typeof entry.request.postData.text === 'string') {
        entry.request.postData.text = masker.maskString(entry.request.postData.text);
      }
    }

    // Sanitize response
    if (entry.response) {
      if (entry.response.headers) {
        entry.response.headers = entry.response.headers.map(header => {
          if (sensitiveHeaderList.includes(header.name.toLowerCase())) {
            return {
              name: header.name,
              value: `[MASKED-${header.name}]`
            };
          }
          return header;
        });
      }

      if (entry.response.content && typeof entry.response.content.text === 'string') {
        entry.response.content.text = masker.maskString(entry.response.content.text);
      }
    }

    return entry;
  });

  return sanitized;
}

/**
 * Generate a sanitization report showing what was masked
 *
 * @param {Object} exportData - Original export data
 * @param {Object} sanitizedData - Sanitized export data
 * @returns {Object} Report with statistics
 */
function generateSanitizationReport(exportData, sanitizedData) {
  const report = {
    timestamp: new Date().toISOString(),
    totalRequests: 0,
    maskedRequests: 0,
    maskedHeaders: 0,
    maskedBodies: 0,
    detailedStats: {
      byResourceType: {},
      requestHeadersRemoved: [],
      responseHeadersRemoved: []
    }
  };

  if (!Array.isArray(exportData.requests)) {
    return report;
  }

  const masker = getMaskerInstance();
  report.totalRequests = exportData.requests.length;

  exportData.requests.forEach((originalReq, index) => {
    const sanitizedReq = sanitizedData.requests[index];
    if (!sanitizedReq) {
      return;
    }

    const resourceType = originalReq.resourceType || 'unknown';
    if (!report.detailedStats.byResourceType[resourceType]) {
      report.detailedStats.byResourceType[resourceType] = { count: 0, masked: 0 };
    }
    report.detailedStats.byResourceType[resourceType].count++;

    let isMasked = false;

    // Check if request was masked
    if (originalReq.requestHeaders && sanitizedReq.requestHeaders) {
      for (const key in originalReq.requestHeaders) {
        if (originalReq.requestHeaders[key] !== sanitizedReq.requestHeaders[key]) {
          isMasked = true;
          report.maskedHeaders++;
          break;
        }
      }
    }

    if (originalReq.requestBody !== sanitizedReq.requestBody) {
      isMasked = true;
      report.maskedBodies++;
    }

    if (isMasked) {
      report.maskedRequests++;
      report.detailedStats.byResourceType[resourceType].masked++;
    }
  });

  return report;
}

/**
 * Batch sanitize multiple exports
 *
 * @param {Array} exports - Array of export objects
 * @param {Object} options - Sanitization options
 * @returns {Array} Sanitized exports
 */
function sanitizeBatch(exports, options = {}) {
  if (!Array.isArray(exports)) {
    return exports;
  }

  return exports.map(exportData => sanitizeNetworkExport(exportData, options));
}

/**
 * Get masker statistics for diagnostics
 *
 * @returns {Object} Masker statistics
 */
function getMaskerStatistics() {
  const masker = getMaskerInstance();
  return masker.getStatistics();
}

/**
 * Clear masker cache to free memory
 */
function clearMaskerCache() {
  if (globalMasker) {
    globalMasker.clearCache();
  }
}

/**
 * Reset masker instance
 */
function resetMasker() {
  if (globalMasker) {
    globalMasker.clearCache();
  }
  globalMasker = null;
}

module.exports = {
  getMaskerInstance,
  sanitizeRequest,
  sanitizeNetworkExport,
  sanitizeHAR,
  sanitizeBatch,
  generateSanitizationReport,
  getMaskerStatistics,
  clearMaskerCache,
  resetMasker,
  SensitiveDataMasker
};

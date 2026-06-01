/**
 * Header Utilities - OPT-4
 * Shared header processing functions to eliminate duplication
 *
 * Problem: Header normalization duplicated in 5+ files = 150+ lines of duplicate code
 * Solution: Extract to centralized utility module
 *
 * Functions consolidated:
 * - normalize: Convert headers to lowercase key map
 * - extract: Extract value by header name (case-insensitive)
 * - parse: Parse header value (e.g., "Framework/1.0" → name + version)
 * - format: Format headers object for output
 * - getContentType: Get content type from headers
 *
 * Created: June 1, 2026
 */

/**
 * Normalize headers object to lowercase keys
 * @param {object} headers - Headers object with any case keys
 * @returns {object} Normalized headers with lowercase keys
 */
function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const normalized = {};
  Object.entries(headers).forEach(([key, value]) => {
    normalized[key.toLowerCase()] = String(value);
  });
  return normalized;
}

/**
 * Extract header value by name (case-insensitive)
 * @param {object} headers - Headers object (will be normalized)
 * @param {string} headerName - Header name to find
 * @returns {string|null} Header value or null if not found
 */
function getHeader(headers, headerName) {
  const normalized = normalizeHeaders(headers);
  return normalized[headerName.toLowerCase()] || null;
}

/**
 * Parse header value into components
 * Examples:
 *   "Apache/2.4.41" → { name: "Apache", version: "2.4.41" }
 *   "Microsoft-IIS/10.0" → { name: "Microsoft-IIS", version: "10.0" }
 *
 * @param {string} headerValue - Header value to parse
 * @returns {object} { name, version } or { name } if no version
 */
function parseHeaderValue(headerValue) {
  if (!headerValue) {
    return { name: null };
  }

  headerValue = String(headerValue).trim();

  // Try to split by common separators
  const match = headerValue.match(/^([^\s\/]+)(?:[\s\/]+(.+))?$/);
  if (match) {
    return {
      name: match[1],
      version: match[2] || null
    };
  }

  return { name: headerValue };
}

/**
 * Format headers object for output/logging
 * @param {object} headers - Headers object
 * @param {array} keys - Keys to include (if undefined, include all)
 * @returns {object} Formatted headers
 */
function formatHeaders(headers, keys = null) {
  const normalized = normalizeHeaders(headers);

  if (!keys) {
    return normalized;
  }

  const formatted = {};
  keys.forEach(key => {
    const lowerKey = key.toLowerCase();
    if (lowerKey in normalized) {
      formatted[lowerKey] = normalized[lowerKey];
    }
  });

  return formatted;
}

/**
 * Get content type from headers
 * @param {object} headers - Headers object
 * @returns {string} Content type (e.g., "application/json") or null
 */
function getContentType(headers) {
  const contentType = getHeader(headers, 'content-type');
  if (!contentType) return null;

  // Extract main type without charset
  const match = contentType.match(/^([^;]+)/);
  return match ? match[1].trim() : contentType;
}

/**
 * Get charset from content-type header
 * @param {object} headers - Headers object
 * @returns {string} Charset (e.g., "utf-8") or null
 */
function getCharset(headers) {
  const contentType = getHeader(headers, 'content-type');
  if (!contentType) return null;

  const match = contentType.match(/charset=([^;]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Check if header indicates compression
 * @param {object} headers - Headers object
 * @returns {string|false} Compression type ("gzip", "deflate", "br") or false
 */
function getCompressionType(headers) {
  const encoding = getHeader(headers, 'content-encoding');
  if (!encoding) return false;

  const types = ['gzip', 'deflate', 'br', 'compress'];
  for (const type of types) {
    if (encoding.toLowerCase().includes(type)) {
      return type;
    }
  }

  return false;
}

/**
 * Filter headers by pattern
 * @param {object} headers - Headers object
 * @param {RegExp} pattern - Pattern to match against keys
 * @returns {object} Filtered headers
 */
function filterHeadersByPattern(headers, pattern) {
  const normalized = normalizeHeaders(headers);
  const filtered = {};

  Object.entries(normalized).forEach(([key, value]) => {
    if (pattern.test(key)) {
      filtered[key] = value;
    }
  });

  return filtered;
}

module.exports = {
  normalizeHeaders,
  getHeader,
  parseHeaderValue,
  formatHeaders,
  getContentType,
  getCharset,
  getCompressionType,
  filterHeadersByPattern
};

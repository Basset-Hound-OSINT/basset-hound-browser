/**
 * Network Forensics — shared constants
 *
 * Extracted verbatim from network-forensics/forensics.js (Phase 19).
 */

/**
 * Evidence types
 */
const FORENSICS_TYPES = {
  DNS_QUERY: 'dns_query',
  TLS_CERTIFICATE: 'tls_certificate',
  WEBSOCKET_CONNECTION: 'websocket_connection',
  HTTP_HEADERS: 'http_headers',
  COOKIE: 'cookie',
  PERFORMANCE_METRIC: 'performance_metric'
};

/**
 * Export formats
 */
const EXPORT_FORMATS = {
  JSON: 'json',
  CSV: 'csv',
  HTML: 'html',
  TIMELINE: 'timeline'
};

module.exports = {
  FORENSICS_TYPES,
  EXPORT_FORMATS
};

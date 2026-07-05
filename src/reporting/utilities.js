/**
 * Report Generation Utilities
 *
 * Shared utility functions for report generation:
 * data filtering, text processing, hashing, and analysis helpers
 *
 * @module reporting/utilities
 * @version 2.0.0
 */

const crypto = require('crypto');

/**
 * Sensitive data patterns for redaction
 */
const SENSITIVE_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  api_key: /[a-zA-Z0-9]{32,}/g
};

/**
 * Filter sensitive data from text and objects
 *
 * @param {string|Object|Array} data - Data to filter
 * @param {string[]} filters - Filter types to apply (email, phone, credit_card, ssn, api_key)
 * @returns {string|Object|Array} Filtered data with sensitive values redacted
 */
function filterSensitiveData(data, filters) {
  if (!filters || filters.length === 0) {
    return data;
  }

  const redact = (text) => {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let result = text;
    filters.forEach(filter => {
      if (SENSITIVE_PATTERNS[filter]) {
        result = result.replace(SENSITIVE_PATTERNS[filter], '[REDACTED]');
      }
    });
    return result;
  };

  // Recursively filter objects and arrays
  const filterObj = (obj) => {
    if (typeof obj === 'string') {
      return redact(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(filterObj);
    } else if (obj && typeof obj === 'object') {
      const filtered = {};
      Object.keys(obj).forEach(key => {
        filtered[key] = filterObj(obj[key]);
      });
      return filtered;
    }
    return obj;
  };

  return filterObj(data);
}

/**
 * Calculate metrics for report data
 *
 * @param {Object} reportData - Report structure
 * @returns {Object} Metrics including word count, item count, and section count
 */
function calculateMetrics(reportData) {
  let wordCount = 0;
  let itemCount = 0;

  const countWords = (str) => {
    if (typeof str === 'string') {
      return str.split(/\s+/).filter(word => word.length > 0).length;
    }
    return 0;
  };

  const walk = (obj) => {
    if (typeof obj === 'string') {
      wordCount += countWords(obj);
    } else if (Array.isArray(obj)) {
      itemCount += obj.length;
      obj.forEach(walk);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(walk);
    }
  };

  walk(reportData);

  return {
    wordCount,
    evidenceItems: itemCount,
    sections: Object.keys(reportData.sections).filter(k => reportData.sections[k] !== null).length
  };
}

/**
 * Estimate page count for report content
 *
 * @param {string} content - Report content
 * @param {string} format - Output format (html, pdf, json, markdown, csv)
 * @returns {number} Estimated page count
 */
function estimatePageCount(content, format) {
  if (format === 'html' || format === 'pdf') {
    // Rough estimate: ~250 words per page for HTML/PDF
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / 250);
  } else if (format === 'json') {
    // JSON doesn't have pages, but estimate based on size
    return Math.ceil(Buffer.byteLength(content) / (50 * 1024)); // 50KB per page estimate
  }
  return 1;
}

/**
 * Get section generation status
 *
 * @param {Object} reportData - Report structure
 * @returns {Object} Map of section names to boolean flags
 */
function getSectionStatus(reportData) {
  return Object.keys(reportData.sections).reduce((acc, key) => {
    acc[key] = reportData.sections[key] !== null;
    return acc;
  }, {});
}

/**
 * Hash report content using SHA-256
 *
 * @param {Object} report - Report data (excludes signatures field)
 * @returns {string} SHA-256 hash hex string
 */
function hashReport(report) {
  const content = JSON.stringify(report, (key, value) => {
    if (key === 'signatures') {
      return undefined;
    }
    return value;
  });
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Format bytes to human-readable size
 *
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Escape HTML special characters
 *
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
  if (!text) {
    return '';
  }
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Escape CSV field values
 *
 * @param {string} text - Text to escape
 * @returns {string} CSV-escaped text
 */
function escapeCsv(text) {
  if (!text) {
    return '';
  }
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${String(text).replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Extract unique domains from URLs
 *
 * @param {string[]} urls - Array of URLs
 * @returns {Set<string>} Set of unique domain names
 */
function extractUniqueDomains(urls) {
  return new Set(urls.map(url => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'invalid';
    }
  }));
}

/**
 * Group items by category
 *
 * @param {Object[]} items - Items to group
 * @param {string} categoryKey - Property name to group by
 * @returns {Object} Grouped items
 */
function groupByCategory(items, categoryKey) {
  const grouped = {};
  items.forEach(item => {
    const category = item[categoryKey] || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });
  return grouped;
}

/**
 * Count occurrences in array by property
 *
 * @param {Object[]} items - Items to count
 * @param {string} propertyKey - Property to count by
 * @returns {Object} Count map
 */
function countByProperty(items, propertyKey) {
  const counts = {};
  items.forEach(item => {
    const key = item[propertyKey] || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

/**
 * Truncate text to specified length
 *
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @param {string} suffix - Suffix to append if truncated (default "...")
 * @returns {string} Truncated text
 */
function truncateText(text, length, suffix = '...') {
  if (!text || text.length <= length) {
    return text;
  }
  return text.substring(0, length - suffix.length) + suffix;
}

/**
 * Sort array by multiple properties
 *
 * @param {Object[]} items - Items to sort
 * @param {string[]} keys - Property names to sort by (in order)
 * @returns {Object[]} Sorted array
 */
function sortByMultiple(items, keys) {
  return items.sort((a, b) => {
    for (let key of keys) {
      if (a[key] < b[key]) return -1;
      if (a[key] > b[key]) return 1;
    }
    return 0;
  });
}

/**
 * Convert timestamp to readable format
 *
 * @param {string|number|Date} timestamp - Timestamp to convert
 * @param {string} format - Format type ('locale', 'iso', 'time', 'date')
 * @returns {string} Formatted timestamp
 */
function formatTimestamp(timestamp, format = 'locale') {
  const date = new Date(timestamp);
  switch (format) {
    case 'iso':
      return date.toISOString();
    case 'time':
      return date.toLocaleTimeString();
    case 'date':
      return date.toLocaleDateString();
    case 'locale':
    default:
      return date.toLocaleString();
  }
}

/**
 * Calculate risk score based on evidence characteristics
 *
 * @param {Object} evidence - Evidence package
 * @returns {Object} Risk assessment with score, level, and factors
 */
function assessRisk(evidence) {
  let riskScore = 0;
  const factors = [];

  // Assess based on evidence characteristics
  if (evidence.technologies && evidence.technologies.some(t => t.name.toLowerCase().includes('backdoor'))) {
    riskScore += 40;
    factors.push('Potential backdoor/malware detected');
  }

  if ((evidence.networkRequests || []).some(r => !r.url?.startsWith('https'))) {
    riskScore += 20;
    factors.push('Unencrypted HTTP requests detected');
  }

  if ((evidence.contentAnalysis?.forms || []).length > 0) {
    riskScore += 15;
    factors.push('Active form elements for data collection');
  }

  const riskLevel = riskScore > 60 ? 'CRITICAL' : riskScore > 30 ? 'HIGH' : riskScore > 10 ? 'MEDIUM' : 'LOW';

  return {
    score: riskScore,
    level: riskLevel,
    factors
  };
}

/**
 * Validate evidence package structure
 *
 * @param {Object} evidence - Evidence package to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
function validateEvidence(evidence) {
  const errors = [];

  if (!evidence || typeof evidence !== 'object') {
    return {
      isValid: false,
      errors: ['Evidence must be an object']
    };
  }

  if (!evidence.url && !evidence.target) {
    errors.push('Evidence must contain url or target field');
  }

  if (evidence.startTime && isNaN(Date.parse(evidence.startTime))) {
    errors.push('startTime must be a valid date');
  }

  if (evidence.endTime && isNaN(Date.parse(evidence.endTime))) {
    errors.push('endTime must be a valid date');
  }

  if (evidence.screenshots && !Array.isArray(evidence.screenshots)) {
    errors.push('screenshots must be an array');
  }

  if (evidence.networkRequests && !Array.isArray(evidence.networkRequests)) {
    errors.push('networkRequests must be an array');
  }

  if (evidence.technologies && !Array.isArray(evidence.technologies)) {
    errors.push('technologies must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  filterSensitiveData,
  calculateMetrics,
  estimatePageCount,
  getSectionStatus,
  hashReport,
  formatBytes,
  escapeHtml,
  escapeCsv,
  extractUniqueDomains,
  groupByCategory,
  countByProperty,
  truncateText,
  sortByMultiple,
  formatTimestamp,
  assessRisk,
  validateEvidence,
  SENSITIVE_PATTERNS
};

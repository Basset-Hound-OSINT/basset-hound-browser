/**
 * Format Converters
 *
 * Utility functions for converting between different export formats
 * Provides bidirectional conversion between JSON, CSV, HAR, WARC, XML, SQLite, and Markdown
 *
 * @module extraction/format-converters
 */

const fs = require('fs');
const path = require('path');

/**
 * Converter registry for managing format conversion
 */
class FormatConverter {
  /**
   * Initialize converter
   */
  constructor() {
    this.supportedFormats = ['json', 'csv', 'har', 'warc', 'sqlite', 'markdown', 'xml', 'custom'];
    this.converters = new Map();
    this.registerDefaultConverters();
  }

  /**
   * Register default format converters
   * @private
   */
  registerDefaultConverters() {
    // JSON converters
    this.register('json-to-csv', jsonToCSV);
    this.register('json-to-har', jsonToHAR);
    this.register('json-to-xml', jsonToXML);
    this.register('json-to-markdown', jsonToMarkdown);

    // CSV converters
    this.register('csv-to-json', csvToJSON);

    // HAR converters
    this.register('har-to-json', harToJSON);
    this.register('har-to-csv', harToCSV);

    // XML converters
    this.register('xml-to-json', xmlToJSON);
  }

  /**
   * Register a custom converter
   * @param {string} name - Converter name (e.g., 'json-to-csv')
   * @param {Function} converter - Converter function
   */
  register(name, converter) {
    if (typeof converter !== 'function') {
      throw new Error('Converter must be a function');
    }
    this.converters.set(name, converter);
  }

  /**
   * Convert data between formats
   * @param {*} data - Input data
   * @param {string} fromFormat - Source format
   * @param {string} toFormat - Target format
   * @param {Object} options - Conversion options
   * @returns {*} Converted data
   */
  convert(data, fromFormat, toFormat, options = {}) {
    if (fromFormat === toFormat) {
      return data;
    }

    const converterName = `${fromFormat}-to-${toFormat}`;
    const converter = this.converters.get(converterName);

    if (!converter) {
      throw new Error(`No converter found for ${fromFormat} -> ${toFormat}`);
    }

    return converter(data, options);
  }

  /**
   * List all supported formats
   * @returns {Array<string>}
   */
  listSupportedFormats() {
    return [...this.supportedFormats];
  }

  /**
   * Check if conversion is supported
   * @param {string} fromFormat
   * @param {string} toFormat
   * @returns {boolean}
   */
  isConversionSupported(fromFormat, toFormat) {
    if (fromFormat === toFormat) {
      return true;
    }
    return this.converters.has(`${fromFormat}-to-${toFormat}`);
  }
}

// ============================================================================
// JSON Converters
// ============================================================================

/**
 * Convert JSON data to CSV
 */
function jsonToCSV(data, options = {}) {
  const {
    delimiter = ',',
    includeHeaders = true,
    columns = null
  } = options;

  let records = data;
  if (typeof data === 'string') {
    records = JSON.parse(data);
  }

  if (!Array.isArray(records)) {
    records = [records];
  }

  // Flatten records
  records = records.map(record => flattenRecord(record));

  // Determine columns
  let columnNames = columns;
  if (!columnNames && records.length > 0) {
    columnNames = Object.keys(records[0]);
  } else if (!columnNames) {
    columnNames = [];
  }

  // Build CSV
  let csv = '';
  if (includeHeaders && columnNames.length) {
    csv += columnNames.map(col => escapeCSVField(col)).join(delimiter) + '\n';
  }

  csv += records.map(record => {
    return columnNames.map(col => escapeCSVField(record[col] || '')).join(delimiter);
  }).join('\n');

  return csv;
}

/**
 * Convert JSON data to HAR format
 */
function jsonToHAR(data, options = {}) {
  const {
    title = 'Export',
    creator = 'Basset Hound Browser'
  } = options;

  let entries = data;
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  if (!Array.isArray(entries)) {
    entries = Array.isArray(data.entries) ? data.entries : [data];
  }

  return {
    log: {
      version: '1.0',
      creator: { name: creator, version: '1.0.0' },
      entries: entries.map(entry => convertToHAREntry(entry)),
      pages: [{
        startedDateTime: new Date().toISOString(),
        id: 'page_1',
        title: title,
        pageTimings: { onContentLoad: 0, onLoad: 0 }
      }]
    }
  };
}

/**
 * Convert JSON data to XML
 */
function jsonToXML(data, options = {}) {
  const {
    rootElement = 'root',
    pretty = false
  } = options;

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  const indent = pretty ? 2 : 0;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += buildXMLFromJSON({ [rootElement]: data }, indent);

  return xml;
}

/**
 * Convert JSON data to Markdown
 */
function jsonToMarkdown(data, options = {}) {
  const { title = 'Report', includeTimestamp = true } = options;

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  let markdown = `# ${title}\n\n`;

  if (includeTimestamp) {
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
  }

  markdown += buildMarkdownFromJSON(data);

  return markdown;
}

// ============================================================================
// CSV Converters
// ============================================================================

/**
 * Convert CSV data to JSON
 */
function csvToJSON(data, options = {}) {
  const { delimiter = ',' } = options;

  const lines = (typeof data === 'string' ? data : String(data)).split('\n');

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCSVLine(lines[0], delimiter);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i], delimiter);
    const record = {};

    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] || '';
    }

    records.push(record);
  }

  return records;
}

// ============================================================================
// HAR Converters
// ============================================================================

/**
 * Convert HAR data to JSON
 */
function harToJSON(data, options = {}) {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data;
}

/**
 * Convert HAR data to CSV
 */
function harToCSV(data, options = {}) {
  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  const entries = data.log?.entries || [];
  const records = entries.map(entry => ({
    url: entry.request?.url || '',
    method: entry.request?.method || '',
    status: entry.response?.status || '',
    duration: entry.time || 0,
    size: entry.response?.content?.size || 0,
    mimeType: entry.response?.content?.mimeType || ''
  }));

  return jsonToCSV(records, options);
}

// ============================================================================
// XML Converters
// ============================================================================

/**
 * Convert XML data to JSON
 */
function xmlToJSON(data, options = {}) {
  // Simple XML to JSON conversion (basic implementation)
  // In production, use a library like xml2js

  if (typeof data !== 'string') {
    return data;
  }

  // This is a very basic converter - for production use xml2js or similar
  try {
    // Remove XML declaration
    let cleanData = data.replace(/<\?xml[^?]*\?>/g, '');

    // Parse simple XML tags
    const result = {};
    const tagRegex = /<([^/>]+)>([^<]*)<\/\1>/g;

    let match;
    while ((match = tagRegex.exec(cleanData)) !== null) {
      result[match[1]] = match[2];
    }

    return result;
  } catch (error) {
    throw new Error(`Failed to convert XML to JSON: ${error.message}`);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten a record for CSV export
 */
function flattenRecord(obj, prefix = '') {
  const flat = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flat, flattenRecord(value, newKey));
      } else if (Array.isArray(value)) {
        flat[newKey] = JSON.stringify(value);
      } else {
        flat[newKey] = value;
      }
    }
  }

  return flat;
}

/**
 * Escape CSV field
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Parse CSV line
 */
function parseCSVLine(line, delimiter = ',') {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Convert JSON to HAR entry
 */
function convertToHAREntry(entry) {
  if (entry.request && entry.response) {
    return entry; // Already in HAR format
  }

  return {
    startedDateTime: entry.startTime || new Date().toISOString(),
    time: entry.duration || 0,
    request: {
      method: entry.method || 'GET',
      url: entry.url || '',
      httpVersion: 'HTTP/1.1',
      headers: entry.headers || [],
      queryString: [],
      cookies: [],
      headersSize: 0,
      bodySize: 0
    },
    response: {
      status: entry.status || entry.statusCode || 0,
      statusText: getHTTPStatusText(entry.status || entry.statusCode),
      httpVersion: 'HTTP/1.1',
      headers: entry.responseHeaders || [],
      cookies: [],
      content: {
        size: entry.size || entry.contentLength || 0,
        mimeType: entry.mimeType || 'application/octet-stream'
      },
      redirectURL: '',
      headersSize: 0,
      bodySize: entry.size || entry.contentLength || 0
    },
    cache: {},
    timings: {
      blocked: 0,
      dns: 0,
      connect: 0,
      send: 0,
      wait: entry.duration || 0,
      receive: 0,
      ssl: 0
    }
  };
}

/**
 * Get HTTP status text
 */
function getHTTPStatusText(code) {
  const statusTexts = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  return statusTexts[code] || 'Unknown';
}

/**
 * Build XML from JSON recursively
 */
function buildXMLFromJSON(obj, indentLevel = 0) {
  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);
  let xml = '';

  for (const key in obj) {
    const value = obj[key];

    if (Array.isArray(value)) {
      value.forEach(item => {
        xml += `${indent}<${key}>\n`;
        xml += buildXMLFromJSON(item, indentLevel + 1);
        xml += `${indent}</${key}>\n`;
      });
    } else if (typeof value === 'object' && value !== null) {
      xml += `${indent}<${key}>\n`;
      xml += buildXMLFromJSON(value, indentLevel + 1);
      xml += `${indent}</${key}>\n`;
    } else {
      const escapedValue = String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      xml += `${indent}<${key}>${escapedValue}</${key}>\n`;
    }
  }

  return xml;
}

/**
 * Build Markdown from JSON
 */
function buildMarkdownFromJSON(obj, depth = 1) {
  let markdown = '';

  for (const key in obj) {
    const value = obj[key];
    const heading = '#'.repeat(Math.min(depth + 1, 6));

    if (Array.isArray(value)) {
      markdown += `${heading} ${capitalizeString(key)}\n\n`;
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          markdown += buildMarkdownFromJSON(item, depth + 1);
        } else {
          markdown += `- ${item}\n`;
        }
      });
      markdown += '\n';
    } else if (typeof value === 'object' && value !== null) {
      markdown += `${heading} ${capitalizeString(key)}\n\n`;
      markdown += buildMarkdownFromJSON(value, depth + 1);
    } else {
      markdown += `- **${capitalizeString(key)}:** ${value}\n`;
    }
  }

  return markdown;
}

/**
 * Capitalize string
 */
function capitalizeString(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

module.exports = {
  FormatConverter,
  jsonToCSV,
  jsonToHAR,
  jsonToXML,
  jsonToMarkdown,
  csvToJSON,
  harToJSON,
  harToCSV,
  xmlToJSON
};

/**
 * Export Formats Commands
 *
 * WebSocket commands for multiple export format support (JSON, CSV, HAR, WARC, SQLite, Markdown, XML, Custom)
 *
 * Commands:
 * - export_format_json - Export as structured JSON
 * - export_format_csv - Export as CSV with headers
 * - export_format_har - Export as HTTP Archive (HAR 1.0)
 * - export_format_warc - Export as Web Archive (WARC 1.0)
 * - export_format_sqlite - Export as SQLite database
 * - export_format_markdown - Export as Markdown report
 * - export_format_xml - Export as XML document
 * - export_format_custom - Export with user-defined format template
 *
 * @module export-formats
 */

const fs = require('fs');
const path = require('path');
const { getInstance: getPathValidator } = require('../../utils/path-validator');

// Optional dependencies (gracefully degrade if not available)
let sqlite3;
try {
  sqlite3 = require('sqlite3');
} catch (error) {
  // sqlite3 not available - SQLite export will return error
  sqlite3 = null;
}

/**
 * Register export format commands with WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} managers - Manager instances (networkAnalysisManager, etc.)
 */
function registerExportFormatCommands(server, managers = {}) {
  if (!server || !server.commandHandlers) {
    throw new Error('Invalid server instance');
  }

  const networkAnalysisManager = managers.networkAnalysisManager;

  /**
   * Export as JSON
   * POST /export_format_json
   *
   * Exports network logs and session data as structured JSON with optional formatting
   *
   * @param {Object} params - Parameters
   * @param {string} params.data_type - Type of data to export (network_logs, session_data, all)
   * @param {Object} params.filters - Filter criteria
   * @param {boolean} params.prettify - Pretty-print JSON (default: false)
   * @param {string} params.output_path - Optional file path to write to
   * @param {Array<string>} params.include_fields - Specific fields to include
   * @param {Array<string>} params.exclude_fields - Fields to exclude
   * @returns {Object} { success: boolean, data: Object|string, stats: Object }
   */
  server.commandHandlers.export_format_json = async (params = {}) => {
    try {
      const {
        data_type = 'all',
        filters = {},
        prettify = false,
        output_path = null,
        include_fields = null,
        exclude_fields = []
      } = params;

      let exportData = {};

      // Gather network logs if requested
      if (data_type === 'network_logs' || data_type === 'all') {
        if (networkAnalysisManager) {
          const logs = await networkAnalysisManager.getLogs(filters);
          exportData.networkLogs = applyFieldFilters(logs, include_fields, exclude_fields);
        }
      }

      // Gather session data if requested
      if (data_type === 'session_data' || data_type === 'all') {
        exportData.sessionData = {
          timestamp: new Date().toISOString(),
          userAgent: process.env.USER_AGENT || 'unknown',
          cookies: [],
          localStorage: {},
          sessionStorage: {}
        };
      }

      // Serialize to JSON
      const jsonString = prettify
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);

      let result = {
        success: true,
        stats: {
          dataType: data_type,
          size: Buffer.byteLength(jsonString, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      // Write to file if specified
      if (output_path) {
        const pathValidator = getPathValidator();
        const validation = pathValidator.validatePath(output_path, 'write');

        if (!validation.valid) {
          return {
            success: false,
            error: `Invalid output path: ${validation.error}`,
            timestamp: new Date().toISOString()
          };
        }

        const dir = path.dirname(validation.realPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(validation.realPath, jsonString, 'utf8');
        result.file_path = validation.realPath;
      } else {
        result.data = exportData;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export as CSV
   * POST /export_format_csv
   *
   * Exports flattened data as CSV with headers
   *
   * @param {Object} params - Parameters
   * @param {string} params.data_type - Type of data (network_logs, session_data)
   * @param {Object} params.filters - Filter criteria
   * @param {string} params.delimiter - CSV delimiter (default: comma)
   * @param {boolean} params.include_headers - Include header row (default: true)
   * @param {string} params.output_path - File path to write to
   * @param {Array<string>} params.columns - Specific columns to include
   * @returns {Object} { success: boolean, data: string|null, file_path: string|null, stats: Object }
   */
  server.commandHandlers.export_format_csv = async (params = {}) => {
    try {
      const {
        data_type = 'network_logs',
        filters = {},
        delimiter = ',',
        include_headers = true,
        output_path = null,
        columns = null
      } = params;

      let rows = [];
      let columnNames = columns || [];

      if (data_type === 'network_logs' && networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);
        rows = flattenArrayForCSV(logs);

        if (!columnNames.length && rows.length > 0) {
          columnNames = Object.keys(rows[0]);
        }
      }

      // Build CSV
      let csvContent = '';
      if (include_headers && columnNames.length) {
        csvContent += columnNames.map(col => escapeCSVField(col)).join(delimiter) + '\n';
      }

      csvContent += rows.map(row => {
        return columnNames.map(col => escapeCSVField(row[col] || '')).join(delimiter);
      }).join('\n');

      let result = {
        success: true,
        stats: {
          dataType: data_type,
          rowCount: rows.length,
          columnCount: columnNames.length,
          size: Buffer.byteLength(csvContent, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, csvContent, 'utf8');
        result.file_path = output_path;
      } else {
        result.data = csvContent;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export as HAR (HTTP Archive)
   * POST /export_format_har
   *
   * Exports network data in HAR 1.0 format for use in web development tools
   *
   * @param {Object} params - Parameters
   * @param {Object} params.filters - Filter criteria
   * @param {string} params.output_path - File path to write to
   * @param {string} params.title - HAR title/description
   * @param {string} params.creator - Creator information
   * @returns {Object} { success: boolean, file_path: string|null, stats: Object }
   */
  server.commandHandlers.export_format_har = async (params = {}) => {
    try {
      const {
        filters = {},
        output_path = null,
        title = 'Basset Hound Browser Capture',
        creator = 'Basset Hound Browser'
      } = params;

      let entries = [];
      if (networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);
        entries = logs.map(log => convertToHAREntry(log));
      }

      const har = {
        log: {
          version: '1.0',
          creator: {
            name: creator,
            version: '1.0.0'
          },
          entries: entries,
          pages: [
            {
              startedDateTime: new Date().toISOString(),
              id: 'page_1',
              title: title,
              pageTimings: {
                onContentLoad: 0,
                onLoad: 0
              }
            }
          ]
        }
      };

      const harJson = JSON.stringify(har, null, 2);

      let result = {
        success: true,
        stats: {
          format: 'HAR 1.0',
          entryCount: entries.length,
          size: Buffer.byteLength(harJson, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, harJson, 'utf8');
        result.file_path = output_path;
      } else {
        result.data = har;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export as WARC (Web Archive)
   * POST /export_format_warc
   *
   * Exports data in WARC 1.0 format for web archival
   *
   * @param {Object} params - Parameters
   * @param {Object} params.filters - Filter criteria
   * @param {string} params.output_path - File path to write to
   * @param {string} params.creation_date - WARC creation date (ISO 8601)
   * @returns {Object} { success: boolean, file_path: string, stats: Object }
   */
  server.commandHandlers.export_format_warc = async (params = {}) => {
    try {
      const {
        filters = {},
        output_path = null,
        creation_date = new Date().toISOString()
      } = params;

      let warcContent = '';
      warcContent += 'WARC/1.0\r\n';

      let recordCount = 0;
      if (networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);

        for (const log of logs) {
          const record = buildWARCRecord(log, creation_date, recordCount++);
          warcContent += record;
        }
      }

      let result = {
        success: true,
        stats: {
          format: 'WARC 1.0',
          recordCount: recordCount,
          size: Buffer.byteLength(warcContent, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, warcContent, 'utf8');
        result.file_path = output_path;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export to SQLite database
   * POST /export_format_sqlite
   *
   * Exports network logs and session data to SQLite database
   *
   * @param {Object} params - Parameters
   * @param {string} params.output_path - Required: path to SQLite file
   * @param {Object} params.filters - Filter criteria
   * @param {Array<string>} params.include_tables - Tables to include
   * @returns {Object} { success: boolean, file_path: string, stats: Object }
   */
  server.commandHandlers.export_format_sqlite = async (params = {}) => {
    return new Promise((resolve) => {
      try {
        if (!sqlite3) {
          resolve({
            success: false,
            error: 'sqlite3 module is not available. Install with: npm install sqlite3',
            timestamp: new Date().toISOString()
          });
          return;
        }

        const {
          output_path = null,
          filters = {},
          include_tables = ['network_logs', 'sessions', 'metadata']
        } = params;

        if (!output_path) {
          resolve({
            success: false,
            error: 'output_path is required for SQLite export',
            timestamp: new Date().toISOString()
          });
          return;
        }

        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Create/open database
        const db = new sqlite3.Database(output_path, (err) => {
          if (err) {
            resolve({
              success: false,
              error: err.message,
              timestamp: new Date().toISOString()
            });
            return;
          }

          // Create tables
          const createTableSQL = `
            CREATE TABLE IF NOT EXISTS network_logs (
              id INTEGER PRIMARY KEY,
              url TEXT,
              method TEXT,
              status_code INTEGER,
              timestamp TEXT,
              duration INTEGER,
              resource_type TEXT,
              content_length INTEGER,
              cached BOOLEAN
            );

            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY,
              session_id TEXT UNIQUE,
              created_at TEXT,
              user_agent TEXT,
              cookies_count INTEGER
            );

            CREATE TABLE IF NOT EXISTS metadata (
              id INTEGER PRIMARY KEY,
              key TEXT UNIQUE,
              value TEXT,
              timestamp TEXT
            );
          `;

          db.exec(createTableSQL, async (err) => {
            if (err) {
              db.close();
              resolve({
                success: false,
                error: err.message,
                timestamp: new Date().toISOString()
              });
              return;
            }

            try {
              let insertCount = 0;

              // Insert network logs if requested
              if (include_tables.includes('network_logs') && networkAnalysisManager) {
                const logs = await networkAnalysisManager.getLogs(filters);
                const stmt = db.prepare(`
                  INSERT INTO network_logs
                  (url, method, status_code, timestamp, duration, resource_type, content_length, cached)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);

                for (const log of logs) {
                  stmt.run(
                    log.url || '',
                    log.method || 'GET',
                    log.statusCode || 0,
                    log.timestamp || new Date().toISOString(),
                    log.duration || 0,
                    log.resourceType || 'unknown',
                    log.contentLength || 0,
                    log.cached || false
                  );
                  insertCount++;
                }
                stmt.finalize();
              }

              // Insert metadata
              if (include_tables.includes('metadata')) {
                const stmt = db.prepare(`
                  INSERT INTO metadata (key, value, timestamp)
                  VALUES (?, ?, ?)
                `);
                stmt.run('export_date', new Date().toISOString(), new Date().toISOString());
                stmt.run('export_format', 'sqlite', new Date().toISOString());
                stmt.run('creator', 'Basset Hound Browser', new Date().toISOString());
                stmt.finalize();
              }

              db.close((closeErr) => {
                if (closeErr) {
                  resolve({
                    success: false,
                    error: closeErr.message,
                    timestamp: new Date().toISOString()
                  });
                } else {
                  resolve({
                    success: true,
                    file_path: output_path,
                    stats: {
                      format: 'SQLite',
                      recordsInserted: insertCount,
                      size: fs.statSync(output_path).size,
                      exported_at: new Date().toISOString()
                    }
                  });
                }
              });
            } catch (error) {
              db.close();
              resolve({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }
          });
        });
      } catch (error) {
        resolve({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  };

  /**
   * Export as Markdown report
   * POST /export_format_markdown
   *
   * Generates a human-readable Markdown report from captured data
   *
   * @param {Object} params - Parameters
   * @param {Object} params.filters - Filter criteria
   * @param {string} params.output_path - File path to write to
   * @param {string} params.title - Report title
   * @param {Array<string>} params.sections - Report sections to include
   * @returns {Object} { success: boolean, file_path: string|null, stats: Object }
   */
  server.commandHandlers.export_format_markdown = async (params = {}) => {
    try {
      const {
        filters = {},
        output_path = null,
        title = 'Basset Hound Browser Capture Report',
        sections = ['summary', 'network', 'session', 'timeline']
      } = params;

      let markdown = `# ${title}\n\n`;
      markdown += `Generated: ${new Date().toISOString()}\n\n`;

      if (sections.includes('summary')) {
        markdown += generateMarkdownSummary();
      }

      if (sections.includes('network') && networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);
        markdown += generateMarkdownNetworkSection(logs);
      }

      if (sections.includes('session')) {
        markdown += generateMarkdownSessionSection();
      }

      if (sections.includes('timeline') && networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);
        markdown += generateMarkdownTimelineSection(logs);
      }

      let result = {
        success: true,
        stats: {
          format: 'Markdown',
          sections: sections.length,
          size: Buffer.byteLength(markdown, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, markdown, 'utf8');
        result.file_path = output_path;
      } else {
        result.data = markdown;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export as XML
   * POST /export_format_xml
   *
   * Exports data as structured XML document
   *
   * @param {Object} params - Parameters
   * @param {string} params.data_type - Type of data to export
   * @param {Object} params.filters - Filter criteria
   * @param {string} params.output_path - File path to write to
   * @param {string} params.root_element - Root element name (default: root)
   * @returns {Object} { success: boolean, file_path: string|null, stats: Object }
   */
  server.commandHandlers.export_format_xml = async (params = {}) => {
    try {
      const {
        data_type = 'all',
        filters = {},
        output_path = null,
        root_element = 'basset_hound_export'
      } = params;

      const xmlData = {
        [root_element]: {
          metadata: {
            exported_at: new Date().toISOString(),
            format_version: '1.0',
            creator: 'Basset Hound Browser'
          }
        }
      };

      // Add network logs
      if ((data_type === 'network_logs' || data_type === 'all') && networkAnalysisManager) {
        const logs = await networkAnalysisManager.getLogs(filters);
        xmlData[root_element].network_logs = {
          log: logs.map(log => ({
            url: log.url || '',
            method: log.method || 'GET',
            status: log.statusCode || 0,
            duration: log.duration || 0
          }))
        };
      }

      // Add session data
      if (data_type === 'session_data' || data_type === 'all') {
        xmlData[root_element].session_data = {
          timestamp: new Date().toISOString(),
          user_agent: 'Basset Hound Browser'
        };
      }

      // Convert to XML string
      let xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xmlString += buildXMLString(xmlData);

      let result = {
        success: true,
        stats: {
          format: 'XML',
          size: Buffer.byteLength(xmlString, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, xmlString, 'utf8');
        result.file_path = output_path;
      } else {
        result.data = xmlString;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };

  /**
   * Export with custom format template
   * POST /export_format_custom
   *
   * Allows users to define custom export format using a template system
   *
   * @param {Object} params - Parameters
   * @param {string} params.template - Template string with {{field}} placeholders
   * @param {Object} params.data - Data object to populate template
   * @param {string} params.output_path - File path to write to
   * @param {Object} params.options - Additional formatting options
   * @returns {Object} { success: boolean, file_path: string|null, data: string|null, stats: Object }
   */
  server.commandHandlers.export_format_custom = async (params = {}) => {
    try {
      const {
        template = '',
        data = {},
        output_path = null,
        options = {}
      } = params;

      if (!template) {
        return {
          success: false,
          error: 'Template is required',
          timestamp: new Date().toISOString()
        };
      }

      // Replace template variables
      let output = template;
      for (const [key, value] of Object.entries(data)) {
        const placeholder = `{{${key}}}`;
        const regex = new RegExp(placeholder, 'g');
        output = output.replace(regex, value || '');
      }

      // Apply any additional formatting
      if (options.trim) {
        output = output.trim();
      }
      if (options.uppercase) {
        output = output.toUpperCase();
      }
      if (options.lowercase) {
        output = output.toLowerCase();
      }

      let result = {
        success: true,
        stats: {
          format: 'Custom',
          size: Buffer.byteLength(output, 'utf8'),
          exported_at: new Date().toISOString()
        }
      };

      if (output_path) {
        const dir = path.dirname(output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(output_path, output, 'utf8');
        result.file_path = output_path;
      } else {
        result.data = output;
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply field filters to data
 */
function applyFieldFilters(data, includeFields = null, excludeFields = []) {
  if (Array.isArray(data)) {
    return data.map(item => applyFieldFilters(item, includeFields, excludeFields));
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  let filtered = {};

  for (const key in data) {
    // Check if should be excluded
    if (excludeFields.includes(key)) {
      continue;
    }

    // Check if should be included
    if (includeFields && !includeFields.includes(key)) {
      continue;
    }

    filtered[key] = data[key];
  }

  return filtered;
}

/**
 * Flatten array of objects for CSV export
 */
function flattenArrayForCSV(arr) {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr.map(item => {
    if (typeof item === 'object' && item !== null) {
      return flattenObject(item);
    }
    return item;
  });
}

/**
 * Flatten nested object
 */
function flattenObject(obj, prefix = '') {
  let flat = {};

  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(flat, flattenObject(value, newKey));
    } else {
      flat[newKey] = value;
    }
  }

  return flat;
}

/**
 * Escape CSV field value
 */
function escapeCSVField(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // Quote field if contains comma, newline, or quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Convert network log to HAR entry format
 */
function convertToHAREntry(log) {
  return {
    startedDateTime: log.startTime || new Date().toISOString(),
    time: log.duration || 0,
    request: {
      method: log.method || 'GET',
      url: log.url || '',
      httpVersion: 'HTTP/1.1',
      headers: log.headers || [],
      queryString: [],
      cookies: [],
      headersSize: 0,
      bodySize: 0
    },
    response: {
      status: log.statusCode || 0,
      statusText: getStatusText(log.statusCode),
      httpVersion: 'HTTP/1.1',
      headers: log.responseHeaders || [],
      cookies: [],
      content: {
        size: log.contentLength || 0,
        mimeType: log.mimeType || 'application/octet-stream'
      },
      redirectURL: '',
      headersSize: 0,
      bodySize: log.contentLength || 0
    },
    cache: {
      beforeRequest: null,
      afterRequest: null
    },
    timings: {
      blocked: 0,
      dns: 0,
      connect: 0,
      send: 0,
      wait: log.duration || 0,
      receive: 0,
      ssl: 0
    }
  };
}

/**
 * Get HTTP status text
 */
function getStatusText(code) {
  const statusCodes = {
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

  return statusCodes[code] || 'Unknown';
}

/**
 * Build WARC record
 */
function buildWARCRecord(log, creationDate, recordNum) {
  const recordId = `<urn:uuid:${generateUUID()}>`;
  const warcDate = new Date(creationDate).toISOString().replace(/[:.]/g, '');

  let record = 'WARC/1.0\r\n';
  record += `WARC-Type: response\r\n`;
  record += `WARC-Date: ${warcDate}\r\n`;
  record += `WARC-Record-ID: ${recordId}\r\n`;
  record += `WARC-Content-Length: ${Buffer.byteLength(log.url || '', 'utf8')}\r\n`;
  record += '\r\n';
  record += (log.url || '') + '\r\n';
  record += '\r\n\r\n';

  return record;
}

/**
 * Generate UUID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build XML string recursively
 */
function buildXMLString(obj, indent = '') {
  let xml = '';

  for (const key in obj) {
    const value = obj[key];

    if (Array.isArray(value)) {
      value.forEach(item => {
        xml += `${indent}<${key}>\n`;
        xml += buildXMLString(item, indent + '  ');
        xml += `${indent}</${key}>\n`;
      });
    } else if (typeof value === 'object' && value !== null) {
      xml += `${indent}<${key}>\n`;
      xml += buildXMLString(value, indent + '  ');
      xml += `${indent}</${key}>\n`;
    } else {
      const escapedValue = String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      xml += `${indent}<${key}>${escapedValue}</${key}>\n`;
    }
  }

  return xml;
}

/**
 * Generate Markdown summary section
 */
function generateMarkdownSummary() {
  let markdown = '## Summary\n\n';
  markdown += `- **Export Date:** ${new Date().toISOString()}\n`;
  markdown += `- **Creator:** Basset Hound Browser\n`;
  markdown += `- **Format Version:** 1.0\n\n`;
  return markdown;
}

/**
 * Generate Markdown network section
 */
function generateMarkdownNetworkSection(logs) {
  let markdown = '## Network Requests\n\n';
  markdown += '| URL | Method | Status | Duration (ms) | Size |\n';
  markdown += '|-----|--------|--------|---------------|------|\n';

  for (const log of logs) {
    const url = (log.url || '').substring(0, 60) + (log.url && log.url.length > 60 ? '...' : '');
    const method = log.method || 'GET';
    const status = log.statusCode || '-';
    const duration = log.duration || 0;
    const size = log.contentLength || 0;

    markdown += `| ${url} | ${method} | ${status} | ${duration} | ${size} |\n`;
  }

  markdown += '\n';
  return markdown;
}

/**
 * Generate Markdown session section
 */
function generateMarkdownSessionSection() {
  let markdown = '## Session Information\n\n';
  markdown += `- **Session Start:** ${new Date().toISOString()}\n`;
  markdown += `- **Browser:** Basset Hound\n`;
  markdown += `- **User Agent:** Custom\n\n`;
  return markdown;
}

/**
 * Generate Markdown timeline section
 */
function generateMarkdownTimelineSection(logs) {
  let markdown = '## Timeline\n\n';

  const sortedLogs = logs.sort((a, b) => {
    const timeA = new Date(a.startTime || 0).getTime();
    const timeB = new Date(b.startTime || 0).getTime();
    return timeA - timeB;
  });

  for (const log of sortedLogs) {
    const time = log.startTime || 'Unknown';
    const status = log.statusCode || '-';
    const url = log.url || 'Unknown';

    markdown += `- **${time}** - [${status}] ${url}\n`;
  }

  markdown += '\n';
  return markdown;
}

module.exports = {
  registerExportFormatCommands
};

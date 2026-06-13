/**
 * Base Report Generator
 *
 * Abstract base class for all report generation modules.
 * Consolidates common functionality from:
 * - /src/data/report-generator.js
 * - /src/features/report-generator.js
 *
 * Provides:
 * - Common report structure
 * - Format strategy pattern
 * - Metadata management
 * - File I/O operations
 * - Event emission
 *
 * @module core/base-report-generator
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { createLogger } = require('../logging');
const { FileOperationError, ValidationError } = require('./errors');

class BaseReportGenerator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.logger = createLogger(this.constructor.name);

    // Configuration
    this.config = {
      reportDir: options.reportDir || path.join(os.homedir(), '.basset-hound', 'reports'),
      includeMetadata: options.includeMetadata !== false,
      includeTimestamp: options.includeTimestamp !== false,
      autoSave: options.autoSave !== false,
      ...options
    };

    // State
    this.reports = [];
    this.activeReports = new Map();
    this.formatStrategies = new Map();

    // Ensure directory exists
    this._ensureReportDirectory();
  }

  /**
   * Generate report with specified format
   * @param {Object} data - Report data
   * @param {string} format - Output format (json, html, csv, etc.)
   * @param {Object} options - Format-specific options
   * @returns {Promise<string>} Report content
   */
  async generate(data, format = 'json', options = {}) {
    try {
      // Validate input
      this._validateReportData(data);

      // Build report structure
      const report = this._buildReport(data, options);

      // Get formatter
      const formatter = this._getFormatter(format);
      if (!formatter) {
        throw new ValidationError(`Unsupported format: ${format}`);
      }

      // Format report
      const content = await formatter.format(report, options);

      // Emit event
      this.emit('report:generated', { format, contentLength: content.length });

      return content;
    } catch (error) {
      this.logger.error('Report generation failed', { error, format });
      this.emit('report:error', { error, format });
      throw error;
    }
  }

  /**
   * Save report to file
   * @param {string} content - Report content
   * @param {string} filename - Output filename (optional)
   * @param {Object} options - Save options
   * @returns {Promise<string>} File path
   */
  async save(content, filename, options = {}) {
    try {
      // Generate filename if not provided
      const finalFilename = filename || this._generateFilename();
      const filepath = path.join(this.config.reportDir, finalFilename);

      // Ensure directory exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      await fs.promises.writeFile(filepath, content, 'utf-8');

      // Track saved report
      this.reports.push({ filepath, filename: finalFilename, timestamp: new Date() });

      this.logger.info(`Report saved: ${filepath}`);
      this.emit('report:saved', { filepath, size: content.length });

      return filepath;
    } catch (error) {
      this.logger.error('Failed to save report', { error });
      this.emit('report:error', { error, stage: 'save' });
      throw new FileOperationError(`Failed to save report: ${error.message}`);
    }
  }

  /**
   * Generate and save report in one operation
   * @param {Object} data - Report data
   * @param {string} format - Output format
   * @param {string} filename - Optional output filename
   * @param {Object} options - Options
   * @returns {Promise<string>} File path
   */
  async generateAndSave(data, format = 'json', filename = null, options = {}) {
    const content = await this.generate(data, format, options);
    return this.save(content, filename || `report_${Date.now()}.${this._getExtension(format)}`, options);
  }

  /**
   * List all saved reports
   * @returns {Array} Saved reports metadata
   */
  listReports() {
    return this.reports.map(r => ({
      filename: r.filename,
      filepath: r.filepath,
      timestamp: r.timestamp,
      size: this._getFileSize(r.filepath)
    }));
  }

  /**
   * Get report by filename
   * @param {string} filename - Report filename
   * @returns {Object} Report metadata
   */
  getReport(filename) {
    return this.reports.find(r => r.filename === filename);
  }

  /**
   * Delete report by filename
   * @param {string} filename - Report filename
   * @returns {Promise<boolean>} Success flag
   */
  async deleteReport(filename) {
    try {
      const report = this.getReport(filename);
      if (!report) {
        throw new ValidationError(`Report not found: ${filename}`);
      }

      await fs.promises.unlink(report.filepath);
      this.reports = this.reports.filter(r => r.filename !== filename);

      this.logger.info(`Report deleted: ${filename}`);
      this.emit('report:deleted', { filename });

      return true;
    } catch (error) {
      this.logger.error('Failed to delete report', { error, filename });
      throw new FileOperationError(`Failed to delete report: ${error.message}`);
    }
  }

  /**
   * Register format strategy
   * @param {string} name - Format name
   * @param {object} strategy - Formatter with format() method
   */
  registerFormat(name, strategy) {
    if (!strategy.format || typeof strategy.format !== 'function') {
      throw new ValidationError('Formatter must have format() method');
    }
    this.formatStrategies.set(name.toLowerCase(), strategy);
  }

  /**
   * Build report structure (can be overridden by subclasses)
   */
  _buildReport(data, options) {
    const report = {
      id: crypto.randomBytes(16).toString('hex'),
      generatedAt: new Date().toISOString(),
      data
    };

    // Add metadata if enabled
    if (this.config.includeMetadata) {
      report.metadata = {
        generator: this.constructor.name,
        version: '1.0.0',
        options
      };
    }

    return report;
  }

  /**
   * Validate report data
   */
  _validateReportData(data) {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Report data must be an object');
    }
  }

  /**
   * Get formatter by name
   */
  _getFormatter(format) {
    return this.formatStrategies.get(format.toLowerCase());
  }

  /**
   * Generate unique filename
   */
  _generateFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `report_${timestamp}_${crypto.randomBytes(4).toString('hex')}.json`;
  }

  /**
   * Get file extension for format
   */
  _getExtension(format) {
    const extensions = {
      json: 'json',
      html: 'html',
      csv: 'csv',
      pdf: 'pdf',
      xml: 'xml'
    };
    return extensions[format.toLowerCase()] || 'txt';
  }

  /**
   * Ensure report directory exists
   */
  _ensureReportDirectory() {
    if (!fs.existsSync(this.config.reportDir)) {
      fs.mkdirSync(this.config.reportDir, { recursive: true });
    }
  }

  /**
   * Get file size safely
   */
  _getFileSize(filepath) {
    try {
      const stats = fs.statSync(filepath);
      return stats.size;
    } catch {
      return null;
    }
  }
}

module.exports = BaseReportGenerator;

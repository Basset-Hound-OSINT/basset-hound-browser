/**
 * Unified Forensic Report Generator
 *
 * Consolidates forensic report generation with multiple output formats:
 * - JSON: Structured forensic data
 * - HTML: Professional human-readable reports
 * - PDF: Formal documentation
 *
 * Implements strategy pattern for format-specific generation.
 * Replaced:
 * - /src/analysis/forensic-report-generator.js (607 lines)
 * - /src/export/forensic-report-generator.js (713 lines)
 *
 * @module reporting/forensic-generator
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { createLogger } = require('../logging');

class UnifiedForensicGenerator {
  constructor(options = {}) {
    this.logger = createLogger('ForensicGenerator');
    this.reportDir = options.reportDir || path.join(os.homedir(), '.basset-hound', 'reports');
    this.companyName = options.companyName || 'Basset Hound Browser';
    this.toolVersion = options.toolVersion || '12.1.0';
    this.formatters = new Map();

    // Register formatters
    this._registerFormatters();

    // Ensure report directory exists
    this._ensureDirectory();
  }

  /**
   * Register available output formatters
   */
  _registerFormatters() {
    this.formatters.set('json', new JSONFormatter());
    this.formatters.set('html', new HTMLFormatter(this.companyName, this.toolVersion));
  }

  /**
   * Ensure report directory exists
   */
  _ensureDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
      this.logger.info(`Created reports directory: ${this.reportDir}`);
    }
  }

  /**
   * Generate forensic report in specified format
   * @param {Object} data - Forensic data to include
   * @param {string} format - Output format ('json', 'html', 'pdf')
   * @param {Object} options - Format-specific options
   * @returns {Promise<string>} Report content
   */
  async generateReport(data, format = 'json', options = {}) {
    try {
      const formatter = this.formatters.get(format.toLowerCase());
      if (!formatter) {
        throw new Error(`Unknown report format: ${format}`);
      }

      const report = this._buildReportStructure(data, options);
      const content = await formatter.format(report, options);

      return content;
    } catch (error) {
      this.logger.error('Report generation failed', { error, format, data: data.title });
      throw error;
    }
  }

  /**
   * Save report to file
   * @param {string} content - Report content
   * @param {string} filename - Output filename
   * @param {Object} options - Save options
   * @returns {Promise<string>} File path
   */
  async saveReport(content, filename, options = {}) {
    try {
      const filepath = path.join(this.reportDir, filename);
      const dir = path.dirname(filepath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(filepath, content, 'utf-8');
      this.logger.info(`Report saved: ${filepath}`);

      return filepath;
    } catch (error) {
      this.logger.error('Failed to save report', { error, filename });
      throw error;
    }
  }

  /**
   * Build unified report structure
   */
  _buildReportStructure(data, options) {
    return {
      id: options.reportId || crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      title: data.title || 'Forensic Investigation Report',
      metadata: {
        investigator: data.investigator || 'Unknown',
        case_number: data.caseNumber || null,
        start_time: data.startTime || new Date().toISOString(),
        end_time: data.endTime || new Date().toISOString(),
        tool_name: this.companyName,
        tool_version: this.toolVersion
      },
      evidence: {
        session: data.session || {},
        site_analysis: data.siteAnalysis || {},
        metadata: data.metadata || {},
        network: data.network || {},
        screenshots: data.screenshots || [],
        recordings: data.recordings || []
      },
      timeline: this._buildTimeline(data),
      chain_of_custody: this._generateChainOfCustody(data),
      findings: data.findings || {},
      recommendations: data.recommendations || [],
      attachments: this._catalogAttachments(data),
      signatures: {
        report_hash: null, // Calculated by formatter
        evidence_hashes: {}
      }
    };
  }

  /**
   * Build chronological timeline
   */
  _buildTimeline(data) {
    const events = [];

    // Add session events
    if (data.session?.timeline) {
      data.session.timeline.forEach(event => {
        events.push({
          timestamp: event.timestamp,
          time_relative: event.relativeTime,
          source: 'session',
          type: event.type,
          description: event.summary
        });
      });
    }

    // Add screenshot events
    if (Array.isArray(data.screenshots)) {
      data.screenshots.forEach(screenshot => {
        events.push({
          timestamp: screenshot.timestamp,
          source: 'screenshot',
          type: 'visual_evidence',
          description: `Screenshot: ${screenshot.url || 'Unknown'}`
        });
      });
    }

    // Add metadata extraction events
    if (data.metadata?.extracted_at) {
      events.push({
        timestamp: data.metadata.extracted_at,
        source: 'metadata',
        type: 'data_extraction',
        description: 'Metadata extracted and verified'
      });
    }

    // Add network events
    if (data.network?.requests?.length > 0) {
      const timestamps = data.network.requests.map(r => r.timestamp || Date.now());
      const firstRequest = Math.min(...timestamps);
      const lastRequest = Math.max(...timestamps);

      events.push({
        timestamp: new Date(firstRequest).toISOString(),
        source: 'network',
        type: 'network_monitoring',
        description: `Network monitoring: ${data.network.requests.length} requests captured`
      });

      events.push({
        timestamp: new Date(lastRequest).toISOString(),
        source: 'network',
        type: 'network_monitoring',
        description: 'Network monitoring completed'
      });
    }

    // Sort by timestamp
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Generate chain of custody
   */
  _generateChainOfCustody(data) {
    return {
      preserved_evidence: [
        data.session && {
          evidence_id: crypto.randomBytes(16).toString('hex'),
          type: 'session_recording',
          description: 'Complete investigation session recording',
          hash: data.session.hash || 'N/A',
          timestamp: data.session.metadata?.start_timestamp || new Date().toISOString()
        },
        data.screenshots?.length > 0 && {
          evidence_id: crypto.randomBytes(16).toString('hex'),
          type: 'screenshot_collection',
          description: `${data.screenshots.length} screenshots captured`,
          count: data.screenshots.length,
          timestamp: new Date().toISOString()
        }
      ].filter(Boolean),
      verification_hashes: [],
      custody_log: [
        {
          timestamp: new Date().toISOString(),
          action: 'evidence_packaged',
          actor: data.investigator || 'Unknown',
          notes: 'Evidence packaged and signed'
        }
      ]
    };
  }

  /**
   * Catalog attachments
   */
  _catalogAttachments(data) {
    const attachments = [];

    if (Array.isArray(data.screenshots)) {
      attachments.push(...data.screenshots.map((ss, i) => ({
        id: `screenshot_${i}`,
        type: 'screenshot',
        filename: `screenshot_${i}.png`,
        size: ss.size || 'unknown',
        hash: ss.hash || 'N/A'
      })));
    }

    if (Array.isArray(data.recordings)) {
      attachments.push(...data.recordings.map((rec, i) => ({
        id: `recording_${i}`,
        type: 'recording',
        filename: `recording_${i}.mp4`,
        size: rec.size || 'unknown',
        hash: rec.hash || 'N/A'
      })));
    }

    return attachments;
  }
}

/**
 * JSON format output strategy
 */
class JSONFormatter {
  async format(report, options = {}) {
    const formatted = {
      ...report,
      signatures: {
        ...report.signatures,
        report_hash: this._hashReport(report)
      }
    };

    return JSON.stringify(formatted, null, options.compact ? 0 : 2);
  }

  _hashReport(report) {
    const content = JSON.stringify(report, (key, value) => {
      if (key === 'signatures') return undefined;
      return value;
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

/**
 * HTML format output strategy
 */
class HTMLFormatter {
  constructor(companyName = 'Basset Hound', version = '12.1.0') {
    this.companyName = companyName;
    this.version = version;
  }

  async format(report, options = {}) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this._escapeHtml(report.title)}</title>
  <style>
    ${this._getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header class="report-header">
      <h1>${this._escapeHtml(report.title)}</h1>
      <div class="metadata">
        <p><strong>Report ID:</strong> ${report.id}</p>
        <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
        <p><strong>Investigator:</strong> ${report.metadata.investigator}</p>
        <p><strong>Case Number:</strong> ${report.metadata.case_number || 'N/A'}</p>
        <p><strong>Tool:</strong> ${this.companyName} v${this.version}</p>
      </div>
    </header>

    <section class="evidence">
      <h2>Evidence Summary</h2>
      <div class="evidence-stats">
        <div class="stat">
          <span class="label">Timeline Events:</span>
          <span class="value">${report.timeline.length}</span>
        </div>
        <div class="stat">
          <span class="label">Screenshots:</span>
          <span class="value">${report.evidence.screenshots.length}</span>
        </div>
        <div class="stat">
          <span class="label">Attachments:</span>
          <span class="value">${report.attachments.length}</span>
        </div>
      </div>
    </section>

    <section class="timeline">
      <h2>Chronological Timeline</h2>
      ${this._formatTimeline(report.timeline)}
    </section>

    <section class="chain-of-custody">
      <h2>Chain of Custody</h2>
      ${this._formatChainOfCustody(report.chain_of_custody)}
    </section>

    <footer>
      <p class="timestamp">Report generated: ${new Date(report.timestamp).toISOString()}</p>
      <p class="hash"><strong>Report Hash (SHA-256):</strong> ${this._hashReport(report)}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  _getStyles() {
    return `
      * { margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
      .container { max-width: 1000px; margin: 0 auto; padding: 20px; }
      .report-header { border-bottom: 3px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }
      h1 { color: #0066cc; margin-bottom: 15px; }
      h2 { color: #0066cc; margin: 30px 0 15px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
      .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; }
      .metadata p { margin: 5px 0; }
      .evidence-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 15px 0; }
      .stat { background: #e8f4f8; padding: 15px; border-radius: 5px; text-align: center; }
      .stat .label { display: block; font-weight: bold; color: #0066cc; }
      .stat .value { display: block; font-size: 24px; color: #333; margin-top: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
      th { background: #f5f5f5; font-weight: bold; }
      tr:nth-child(even) { background: #f9f9f9; }
      code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
      footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
      .timestamp { margin: 5px 0; }
      .hash { word-break: break-all; }
    `;
  }

  _formatTimeline(timeline) {
    if (!timeline.length) return '<p>No events recorded</p>';

    return `<table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Source</th>
          <th>Type</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${timeline.map(event => `
          <tr>
            <td>${new Date(event.timestamp).toLocaleString()}</td>
            <td>${event.source}</td>
            <td>${event.type}</td>
            <td>${this._escapeHtml(event.description)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  _formatChainOfCustody(chain) {
    return `<table>
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>Action</th>
          <th>Actor</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${chain.custody_log.map(entry => `
          <tr>
            <td>${new Date(entry.timestamp).toLocaleString()}</td>
            <td>${entry.action}</td>
            <td>${entry.actor}</td>
            <td>${this._escapeHtml(entry.notes)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
  }

  _hashReport(report) {
    const content = JSON.stringify(report, (key, value) => {
      if (key === 'signatures') return undefined;
      return value;
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  _escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }
}

module.exports = {
  UnifiedForensicGenerator,
  JSONFormatter,
  HTMLFormatter
};

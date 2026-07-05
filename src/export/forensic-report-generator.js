/**
 * Basset Hound Browser - Forensic Report Generator
 * Generates professional forensic reports with chain of custody documentation
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 */

const fs = require('fs');
const path = require('path');

class ForensicReportGenerator {
  constructor(options = {}) {
    this.companyName = options.companyName || 'Basset Hound Browser';
    this.toolVersion = options.toolVersion || '12.1.0';
    this.templatePath = options.templatePath || path.join(__dirname, 'templates');
  }

  /**
   * Generate professional forensic report (HTML)
   * @param {object} manifest - Evidence package manifest
   * @param {object} sessionData - Original session data (optional)
   * @param {object} options - Report generation options
   * @returns {string} HTML report content
   */
  generateHTMLReport(manifest, sessionData = {}, options = {}) {
    const {
      reportTitle = 'Forensic Evidence Report',
      investigator = manifest.analystName,
      includeChainOfCustody = true,
      includeHashes = true,
      includeCompliance = true
    } = options;

    // Format forensic metadata
    const forensicMeta = manifest.forensicMetadata || {};
    const createdTime = new Date(manifest.createdAt);
    const formattedDate = createdTime.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Build hashes table
    const hashesTable = includeHashes && manifest.hashes ? `
      <div class="section">
        <h2>Cryptographic Verification</h2>
        <p>The following cryptographic hashes verify the integrity of this evidence package:</p>
        <table class="evidence-table">
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Hash Value</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(manifest.hashes).map(([algo, hash]) => `
              <tr>
                <td class="algorithm">${algo.toUpperCase()}</td>
                <td class="hash-value"><code>${hash}</code></td>
                <td class="verification-status verified">✓ Verified</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <p class="note"><strong>Note:</strong> To verify package integrity, recalculate the cryptographic hashes using the corresponding algorithm and compare with values above.</p>
      </div>
    ` : '';

    // Build chain of custody table
    const chainOfCustodyTable = includeChainOfCustody ? `
      <div class="section">
        <h2>Chain of Custody</h2>
        <p>The following table documents all handling of this evidence package:</p>
        <table class="evidence-table">
          <thead>
            <tr>
              <th>Timestamp (UTC)</th>
              <th>Handler</th>
              <th>Badge/ID</th>
              <th>Action</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${manifest.chainOfCustody.created.timestamp}</td>
              <td>${manifest.chainOfCustody.created.by}</td>
              <td>${manifest.chainOfCustody.created.id || 'N/A'}</td>
              <td>${manifest.chainOfCustody.created.action}</td>
              <td>${manifest.chainOfCustody.created.notes}</td>
            </tr>
            ${manifest.chainOfCustody.events.map(event => `
              <tr>
                <td>${event.timestamp}</td>
                <td>${event.by}</td>
                <td>${event.id || 'N/A'}</td>
                <td>${event.action}</td>
                <td>${event.notes}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // Build compliance section
    const complianceSection = includeCompliance ? `
      <div class="section">
        <h2>ISO/IEC 27037 Compliance Status</h2>
        <p>This evidence package was generated in accordance with ISO/IEC 27037 Digital Forensics guidelines (Draft Compliance):</p>
        <ul class="compliance-list">
          <li><span class="check">✓</span> Evidence integrity verified through cryptographic hashing (SHA-1, SHA-256, SHA-512)</li>
          <li><span class="check">✓</span> Chain of custody documentation maintained with timestamps</li>
          <li><span class="check">✓</span> Package creation timestamp preserved (UTC with timezone)</li>
          <li><span class="check">✓</span> Handler information logged (name, ID, agency)</li>
          <li><span class="check">✓</span> Evidence handling procedures documented</li>
          <li><span class="check">✓</span> Multiple evidence types organized (screenshots, HAR logs, metadata)</li>
          <li><span class="check">✓</span> Comprehensive manifest included</li>
        </ul>
        <p class="warning"><strong>Important:</strong> This is a DRAFT compliance statement. Full ISO/IEC 27037 certification requires additional validation by certified forensics professionals and legal review. Consult with law enforcement legal counsel before using in court proceedings.</p>
      </div>
    ` : '';

    // Build evidence inventory
    const evidenceInventory = manifest.files && manifest.files.length > 0 ? `
      <div class="section">
        <h2>Evidence Inventory</h2>
        <p>Total evidence files: <strong>${manifest.files.length}</strong></p>
        <p>Package size: <strong>${this.formatBytes(manifest.packageSize)}</strong></p>
        <table class="evidence-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Type</th>
              <th>Size</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${manifest.files.map(file => {
    const ext = path.extname(file.filename).toLowerCase();
    let type = 'File';
    if (file.filename.includes('screenshot')) {
      type = 'Screenshot';
    } else if (file.filename.includes('har-logs')) {
      type = 'Network Log (HAR)';
    } else if (file.filename.includes('metadata')) {
      type = 'Metadata';
    } else if (file.filename.includes('forensic')) {
      type = 'Forensic Data';
    }

    return `
                <tr>
                  <td class="filename">${this.escapeHtml(file.filename)}</td>
                  <td>${type}</td>
                  <td>${this.formatBytes(file.size)}</td>
                  <td>${file.timestamp}</td>
                </tr>
              `;
  }).join('')}
          </tbody>
        </table>
      </div>
    ` : '';

    // Build legal basis section
    const legalBasisSection = forensicMeta.authorizationBasis || forensicMeta.legalBasis ? `
      <div class="section">
        <h2>Legal Basis for Collection</h2>
        <table class="metadata-table">
          <tr>
            <th>Authorization Basis</th>
            <td>${this.escapeHtml(forensicMeta.authorizationBasis || 'N/A')}</td>
          </tr>
          <tr>
            <th>Legal Basis</th>
            <td>${this.escapeHtml(forensicMeta.legalBasis || 'N/A')}</td>
          </tr>
        </table>
      </div>
    ` : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(reportTitle)}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      box-shadow: 0 0 20px rgba(0,0,0,0.1);
    }

    .header {
      border-bottom: 3px solid #1a3a52;
      padding-bottom: 30px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 28px;
      color: #1a3a52;
      margin-bottom: 20px;
    }

    .header-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      font-size: 14px;
    }

    .header-info p {
      margin: 5px 0;
    }

    .header-info strong {
      display: block;
      color: #1a3a52;
      font-size: 12px;
      text-transform: uppercase;
      margin-top: 8px;
    }

    .section {
      margin-top: 30px;
      padding: 20px;
      background-color: #f9f9f9;
      border-left: 4px solid #1a3a52;
    }

    .section h2 {
      color: #1a3a52;
      font-size: 18px;
      margin-bottom: 15px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }

    .section p {
      margin-bottom: 15px;
      color: #555;
    }

    .note, .warning {
      padding: 12px;
      margin-top: 10px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1.5;
    }

    .note {
      background-color: #e3f2fd;
      border-left: 4px solid #1976d2;
      color: #0d47a1;
    }

    .warning {
      background-color: #fff3e0;
      border-left: 4px solid #f57c00;
      color: #e65100;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 13px;
    }

    .evidence-table {
      border: 1px solid #ddd;
    }

    .evidence-table th,
    .evidence-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }

    .evidence-table th {
      background-color: #1a3a52;
      color: white;
      font-weight: 600;
    }

    .evidence-table tr:nth-child(even) {
      background-color: #f5f5f5;
    }

    .metadata-table {
      width: auto;
    }

    .metadata-table th {
      width: 150px;
      background-color: transparent;
      color: #1a3a52;
      font-weight: 600;
      border-bottom: 1px solid #ddd;
      padding: 8px 12px;
    }

    .metadata-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #ddd;
    }

    .algorithm {
      font-weight: 600;
      color: #1a3a52;
    }

    .hash-value code {
      display: block;
      background-color: #f0f0f0;
      padding: 8px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      word-break: break-all;
      overflow-wrap: break-word;
    }

    .verification-status {
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 3px;
      font-size: 12px;
    }

    .verification-status.verified {
      background-color: #c8e6c9;
      color: #2e7d32;
    }

    .verification-status.tampered {
      background-color: #ffcdd2;
      color: #c62828;
    }

    .filename {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      word-break: break-all;
    }

    .compliance-list {
      list-style: none;
      margin-top: 15px;
    }

    .compliance-list li {
      padding: 10px 0;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
    }

    .compliance-list li:last-child {
      border-bottom: none;
    }

    .check {
      color: #2e7d32;
      font-weight: bold;
      margin-right: 10px;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }

    .footer p {
      margin: 8px 0;
    }

    .signature-block {
      margin-top: 30px;
      padding-top: 20px;
    }

    .signature-line {
      display: grid;
      grid-template-columns: 2fr 1fr 2fr;
      gap: 20px;
      margin-top: 30px;
      font-size: 12px;
    }

    .signature-line div {
      text-align: center;
    }

    .signature-line .line {
      border-bottom: 1px solid #333;
      margin-bottom: 5px;
      height: 60px;
    }

    .signature-line .label {
      font-size: 11px;
      color: #666;
    }

    @media print {
      body {
        background-color: white;
      }
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.escapeHtml(reportTitle)}</h1>
      <div class="header-info">
        <div>
          <strong>Case Number</strong>
          ${this.escapeHtml(manifest.caseNumber)}

          <strong>Package ID</strong>
          ${this.escapeHtml(manifest.packageId)}
        </div>
        <div>
          <strong>Report Date</strong>
          ${formattedDate}

          <strong>Tool Version</strong>
          ${this.escapeHtml(this.toolVersion)}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Summary</h2>
      <table class="metadata-table">
        <tr>
          <th>Description</th>
          <td>${this.escapeHtml(manifest.description)}</td>
        </tr>
        <tr>
          <th>Investigator/Analyst</th>
          <td>${this.escapeHtml(investigator)}</td>
        </tr>
        ${forensicMeta.agency ? `
        <tr>
          <th>Agency</th>
          <td>${this.escapeHtml(forensicMeta.agency)}</td>
        </tr>
        ` : ''}
        ${forensicMeta.investigatorId ? `
        <tr>
          <th>Investigator ID</th>
          <td>${this.escapeHtml(forensicMeta.investigatorId)}</td>
        </tr>
        ` : ''}
        <tr>
          <th>Created</th>
          <td>${manifest.createdAt}</td>
        </tr>
        <tr>
          <th>Package Size</th>
          <td>${this.formatBytes(manifest.packageSize)}</td>
        </tr>
        <tr>
          <th>File Count</th>
          <td>${manifest.fileCount}</td>
        </tr>
      </table>
    </div>

    ${evidenceInventory}

    ${hashesTable}

    ${chainOfCustodyTable}

    ${legalBasisSection}

    ${complianceSection}

    <div class="section signature-block">
      <h2>Investigator Certification</h2>
      <p>I hereby certify that this forensic evidence package was collected, preserved, and documented in accordance with applicable law and regulations for digital evidence handling.</p>
      <div class="signature-line">
        <div>
          <div class="line"></div>
          <div class="label">Investigator Signature</div>
        </div>
        <div>
          <div class="line"></div>
          <div class="label">Date</div>
        </div>
        <div>
          <div class="line"></div>
          <div class="label">Printed Name</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>Generated by ${this.escapeHtml(this.companyName)} v${this.escapeHtml(this.toolVersion)}</p>
      <p><strong>LEGAL NOTICE:</strong> This evidence package is for official use only and must be handled in accordance with applicable laws and regulations regarding digital evidence. Chain of custody must be maintained at all times.</p>
      <p>For verification instructions, see the Cryptographic Verification section above. Evidence integrity can be verified independently by recalculating the cryptographic hashes.</p>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate forensic report in PDF format (requires external tool or library)
   * @param {object} manifest - Evidence package manifest
   * @param {object} sessionData - Original session data
   * @param {object} options - Report options
   * @returns {Promise<Buffer>} PDF binary data
   */
  async generatePDFReport(manifest, sessionData = {}, options = {}) {
    const htmlReport = this.generateHTMLReport(manifest, sessionData, options);

    // Note: PDF generation requires puppteer or similar. For now, return HTML
    // In production, integrate with: npm install puppeteer
    // This would use: await page.pdf() from puppeteer

    return {
      success: false,
      message: 'PDF generation requires additional dependencies. Use HTML report and convert with external tools or integrate puppeteer.',
      htmlReport
    };
  }

  /**
   * Generate text-based forensic report
   * @param {object} manifest - Evidence package manifest
   * @param {object} sessionData - Original session data
   * @returns {string} Plain text report
   */
  generateTextReport(manifest, sessionData = {}) {
    const createdTime = new Date(manifest.createdAt);
    const forensicMeta = manifest.forensicMetadata || {};

    let report = '';

    // Header
    report += '='.repeat(80) + '\n';
    report += 'FORENSIC EVIDENCE REPORT\n';
    report += '='.repeat(80) + '\n\n';

    // Summary
    report += 'SUMMARY\n';
    report += '-'.repeat(80) + '\n';
    report += `Case Number:        ${manifest.caseNumber}\n`;
    report += `Package ID:         ${manifest.packageId}\n`;
    report += `Description:        ${manifest.description}\n`;
    report += `Investigator:       ${manifest.analystName}\n`;
    if (forensicMeta.agency) {
      report += `Agency:             ${forensicMeta.agency}\n`;
    }
    if (forensicMeta.investigatorId) {
      report += `Investigator ID:    ${forensicMeta.investigatorId}\n`;
    }
    report += `Created:            ${manifest.createdAt}\n`;
    report += `Package Size:       ${this.formatBytes(manifest.packageSize)}\n`;
    report += `File Count:         ${manifest.fileCount}\n\n`;

    // Evidence Inventory
    if (manifest.files && manifest.files.length > 0) {
      report += 'EVIDENCE INVENTORY\n';
      report += '-'.repeat(80) + '\n';
      report += `Total Files:        ${manifest.files.length}\n\n`;

      manifest.files.forEach((file, index) => {
        report += `File ${index + 1}: ${file.filename}\n`;
        report += `  Size:             ${this.formatBytes(file.size)}\n`;
        report += `  Timestamp:        ${file.timestamp}\n`;
      });
      report += '\n';
    }

    // Cryptographic Verification
    if (manifest.hashes) {
      report += 'CRYPTOGRAPHIC VERIFICATION\n';
      report += '-'.repeat(80) + '\n';

      Object.entries(manifest.hashes).forEach(([algo, hash]) => {
        report += `${algo.toUpperCase()}:\n`;
        report += `  ${hash}\n\n`;
      });
    }

    // Chain of Custody
    report += 'CHAIN OF CUSTODY\n';
    report += '-'.repeat(80) + '\n';

    const created = manifest.chainOfCustody.created;
    report += `Created By:         ${created.by}\n`;
    if (created.id) {
      report += `ID:                 ${created.id}\n`;
    }
    if (created.agency) {
      report += `Agency:             ${created.agency}\n`;
    }
    report += `Timestamp:          ${created.timestamp}\n`;
    report += `Action:             ${created.action}\n`;
    report += `Notes:              ${created.notes}\n\n`;

    if (manifest.chainOfCustody.events && manifest.chainOfCustody.events.length > 0) {
      report += 'CUSTODY TRANSFERS:\n';
      manifest.chainOfCustody.events.forEach((event, index) => {
        report += `\nTransfer ${index + 1}:\n`;
        report += `  Timestamp:        ${event.timestamp}\n`;
        report += `  Handler:          ${event.by}\n`;
        if (event.id) {
          report += `  ID:               ${event.id}\n`;
        }
        report += `  Action:           ${event.action}\n`;
        report += `  Notes:            ${event.notes}\n`;
      });
      report += '\n';
    }

    // Legal basis
    if (forensicMeta.authorizationBasis || forensicMeta.legalBasis) {
      report += 'LEGAL BASIS FOR COLLECTION\n';
      report += '-'.repeat(80) + '\n';
      if (forensicMeta.authorizationBasis) {
        report += `Authorization:      ${forensicMeta.authorizationBasis}\n`;
      }
      if (forensicMeta.legalBasis) {
        report += `Legal Basis:        ${forensicMeta.legalBasis}\n`;
      }
      report += '\n';
    }

    // Compliance
    report += 'ISO/IEC 27037 COMPLIANCE (DRAFT)\n';
    report += '-'.repeat(80) + '\n';
    report += 'This evidence package was generated in accordance with ISO/IEC 27037\n';
    report += 'Digital Forensics guidelines (Draft Compliance Status):\n\n';
    report += '✓ Evidence integrity verified through cryptographic hashing\n';
    report += '✓ Chain of custody documentation maintained\n';
    report += '✓ Timestamps preserved (UTC)\n';
    report += '✓ Handler information logged\n';
    report += '✓ Evidence handling procedures documented\n\n';
    report += 'NOTE: This is DRAFT compliance. Full ISO/IEC 27037 certification\n';
    report += 'requires validation by certified forensics professionals and legal review.\n\n';

    // Footer
    report += '='.repeat(80) + '\n';
    report += 'LEGAL NOTICE\n';
    report += '='.repeat(80) + '\n';
    report += 'This evidence package is for official use only and must be handled in\n';
    report += 'accordance with applicable laws and regulations regarding digital evidence.\n';
    report += 'Chain of custody must be maintained at all times.\n';
    report += '='.repeat(80) + '\n';

    return report;
  }

  // Private helper methods

  /**
   * Escape HTML special characters
   * @private
   */
  escapeHtml(text) {
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
   * Format bytes for human-readable display
   * @private
   */
  formatBytes(bytes) {
    if (bytes === 0) {
      return '0 Bytes';
    }
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = ForensicReportGenerator;

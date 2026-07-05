/**
 * Report Formatters
 *
 * Specialized formatters for different output formats:
 * HTML, JSON, Markdown, CSV
 *
 * @module reporting/formatters
 * @version 2.0.0
 */

const crypto = require('crypto');

/**
 * HTML Report Formatter
 */
class HTMLFormatter {
  constructor(companyName = 'Basset Hound', version = '12.1.0') {
    this.companyName = companyName;
    this.version = version;
  }

  async format(report, options = {}) {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
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
    ${this._renderHeader(report)}
    ${this._renderExecutiveSummary(report)}
    ${this._renderInvestigation(report)}
    ${report.sections.technologies ? this._renderTechnologies(report.sections.technologies) : ''}
    ${report.sections.screenshots ? this._renderScreenshots(report.sections.screenshots) : ''}
    ${report.sections.networkForensics ? this._renderNetwork(report.sections.networkForensics) : ''}
    ${this._renderContent(report.sections.contentAnalysis)}
    ${report.sections.timeline ? this._renderTimeline(report.sections.timeline) : ''}
    ${this._renderEvidence(report.sections.evidence)}
    ${report.sections.recommendations ? this._renderRecommendations(report.sections.recommendations) : ''}
    ${this._renderChainOfCustody(report.chainOfCustody)}
    ${this._renderCompliance(report.compliance)}
    ${this._renderFooter(report)}
  </div>
</body>
</html>`;

    return htmlContent;
  }

  _renderHeader(report) {
    return `
    <header class="report-header">
      <h1>${this._escapeHtml(report.title)}</h1>
      <div class="header-metadata">
        <p><strong>Report ID:</strong> <code>${report.id}</code></p>
        <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
        <p><strong>Investigator:</strong> ${this._escapeHtml(report.metadata.investigator)}</p>
        <p><strong>Case Number:</strong> ${report.metadata.caseNumber || 'N/A'}</p>
        <p><strong>Tool:</strong> ${this.companyName} v${this.version}</p>
      </div>
    </header>`;
  }

  _renderExecutiveSummary(report) {
    const summary = report.executiveSummary;
    const overview = summary.overview;

    return `
    <section class="executive-summary">
      <h2>Executive Summary</h2>
      <div class="summary-content">
        <p><strong>${this._escapeHtml(overview.briefSummary)}</strong></p>
        <div class="overview-grid">
          <div class="overview-item">
            <span class="label">Target URL:</span>
            <span class="value"><code>${this._escapeHtml(overview.targetUrl)}</code></span>
          </div>
          <div class="overview-item">
            <span class="label">Investigation Period:</span>
            <span class="value">${this._escapeHtml(overview.investigationPeriod)}</span>
          </div>
          <div class="overview-item">
            <span class="label">Sessions:</span>
            <span class="value">${overview.sessionCount}</span>
          </div>
          <div class="overview-item">
            <span class="label">Evidence Items:</span>
            <span class="value">${overview.evidenceItems}</span>
          </div>
        </div>

        <h3>Risk Assessment</h3>
        <div class="risk-assessment risk-${summary.riskAssessment.level.toLowerCase()}">
          <strong>Risk Level: ${summary.riskAssessment.level}</strong>
          <p>Risk Score: ${summary.riskAssessment.score}/100</p>
          ${summary.riskAssessment.factors.length > 0 ? `
          <ul>
            ${summary.riskAssessment.factors.map(f => `<li>${this._escapeHtml(f)}</li>`).join('')}
          </ul>` : '<p>No risk factors identified.</p>'}
        </div>

        <h3>Key Findings</h3>
        <ul class="findings-list">
          ${summary.keyFindings.map(finding => `
          <li class="finding finding-${finding.severity.toLowerCase()}">
            <strong>${this._escapeHtml(finding.category)}</strong><br/>
            ${this._escapeHtml(finding.description)}
          </li>`).join('')}
        </ul>
      </div>
    </section>`;
  }

  _renderInvestigation(report) {
    const inv = report.investigation;
    return `
    <section class="investigation">
      <h2>Investigation Details</h2>
      <div class="details-grid">
        <div class="detail-item">
          <strong>Scope:</strong>
          <p>${this._escapeHtml(inv.scope)}</p>
        </div>
        <div class="detail-item">
          <strong>Methodology:</strong>
          <p>${this._escapeHtml(inv.methodology)}</p>
        </div>
        <div class="detail-item">
          <strong>Start Time:</strong>
          <p>${new Date(inv.startTime).toLocaleString()}</p>
        </div>
        <div class="detail-item">
          <strong>End Time:</strong>
          <p>${new Date(inv.endTime).toLocaleString()}</p>
        </div>
      </div>
    </section>`;
  }

  _renderTechnologies(techSection) {
    if (!techSection || techSection.technologies.length === 0) {
      return '';
    }

    return `
    <section class="technologies">
      <h2>Technologies Detected</h2>
      <p>Total: <strong>${techSection.totalDetected}</strong> technologies identified</p>
      ${Object.entries(techSection.byCategory).map(([category, techs]) => `
      <div class="tech-category">
        <h3>${this._escapeHtml(category)}</h3>
        <table>
          <thead>
            <tr>
              <th>Technology</th>
              <th>Version</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${techs.map(tech => `
            <tr>
              <td><strong>${this._escapeHtml(tech.name)}</strong></td>
              <td>${this._escapeHtml(tech.version || 'Unknown')}</td>
              <td>${Math.round((tech.confidence || 0) * 100)}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('')}
    </section>`;
  }

  _renderScreenshots(ssSection) {
    if (!ssSection || ssSection.screenshots.length === 0) {
      return '';
    }

    return `
    <section class="screenshots">
      <h2>Screenshots (${ssSection.totalCount})</h2>
      <div class="screenshots-grid">
        ${ssSection.screenshots.map(ss => `
        <div class="screenshot-item">
          <h3>${this._escapeHtml(ss.url)}</h3>
          <p><strong>Timestamp:</strong> ${new Date(ss.timestamp).toLocaleString()}</p>
          <p>${this._escapeHtml(ss.description)}</p>
          <p><code>${ss.imageHash}</code></p>
        </div>`).join('')}
      </div>
    </section>`;
  }

  _renderNetwork(netSection) {
    if (!netSection) {
      return '';
    }

    return `
    <section class="network">
      <h2>Network Forensics</h2>
      <div class="network-summary">
        <div class="stat">
          <strong>Total Requests:</strong> ${netSection.summary.totalRequests}
        </div>
        <div class="stat">
          <strong>Data Transferred:</strong> ${this._formatBytes(netSection.summary.totalDataTransferred)}
        </div>
        <div class="stat">
          <strong>Failed Requests:</strong> ${netSection.summary.failedRequests}
        </div>
        <div class="stat">
          <strong>External Domains:</strong> ${netSection.summary.externalDomains}
        </div>
      </div>

      <h3>Request Summary</h3>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Status</th>
            <th>Response Time</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          ${netSection.requests.slice(0, 50).map(req => `
          <tr>
            <td><strong>${req.method}</strong></td>
            <td><code>${this._escapeHtml(req.url)}</code></td>
            <td class="${req.status >= 400 ? 'error' : 'success'}">${req.status}</td>
            <td>${req.responseTime}</td>
            <td>${this._formatBytes(req.size)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      ${netSection.requests.length > 50 ? `<p><em>Showing 50 of ${netSection.requests.length} requests</em></p>` : ''}
    </section>`;
  }

  _renderContent(contentSection) {
    if (!contentSection) {
      return '';
    }

    return `
    <section class="content">
      <h2>Content Analysis</h2>
      <div class="content-details">
        <p><strong>URL:</strong> <code>${this._escapeHtml(contentSection.url)}</code></p>
        <p><strong>Page Title:</strong> ${this._escapeHtml(contentSection.title)}</p>
        <p><strong>Description:</strong> ${this._escapeHtml(contentSection.description)}</p>

        ${contentSection.forms.length > 0 ? `
        <h3>Forms Found</h3>
        ${contentSection.forms.map(form => `
        <div class="form-item">
          <strong>Form ID:</strong> ${this._escapeHtml(form.id)}<br/>
          <strong>Method:</strong> ${form.method}<br/>
          <strong>Action:</strong> ${this._escapeHtml(form.action)}<br/>
          <strong>Fields:</strong> ${form.fields.length}
        </div>`).join('')}` : '<p>No forms detected.</p>'}

        ${contentSection.links.length > 0 ? `
        <h3>Links Found</h3>
        <ul>
          ${contentSection.links.slice(0, 20).map(link => `
          <li>
            <a href="${this._escapeHtml(link.url)}" target="_blank">${this._escapeHtml(link.text)}</a>
            <span class="link-type">(${link.type})</span>
          </li>`).join('')}
        </ul>` : ''}
      </div>
    </section>`;
  }

  _renderTimeline(timelineSection) {
    if (!timelineSection || timelineSection.events.length === 0) {
      return '';
    }

    return `
    <section class="timeline">
      <h2>Chronological Timeline</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Source</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${timelineSection.events.map(event => `
          <tr>
            <td>${new Date(event.timestamp).toLocaleString()}</td>
            <td>${this._escapeHtml(event.source)}</td>
            <td>${this._escapeHtml(event.type)}</td>
            <td>${this._escapeHtml(event.description)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
  }

  _renderEvidence(evidenceSection) {
    if (!evidenceSection) {
      return '';
    }

    return `
    <section class="evidence">
      <h2>Evidence Catalog</h2>
      <p><strong>Total Evidence Items:</strong> ${evidenceSection.totalItems}</p>
      <ul>
        ${evidenceSection.items.map(item => `
        <li>
          <strong>${this._escapeHtml(item.type)}</strong><br/>
          ${item.count ? `Count: ${item.count}<br/>` : ''}
          ${item.size ? `Size: ${this._formatBytes(item.size)}<br/>` : ''}
          ${item.hash ? `Hash: <code>${item.hash}</code><br/>` : ''}
          ${this._escapeHtml(item.description)}
        </li>`).join('')}
      </ul>
    </section>`;
  }

  _renderRecommendations(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return '';
    }

    return `
    <section class="recommendations">
      <h2>Recommendations</h2>
      ${recommendations.map(rec => `
      <div class="recommendation recommendation-${rec.priority.toLowerCase()}">
        <h3>${this._escapeHtml(rec.title)}</h3>
        <p><strong>Priority:</strong> ${rec.priority}</p>
        <p>${this._escapeHtml(rec.description)}</p>
        <p><strong>Action:</strong> ${this._escapeHtml(rec.action)}</p>
      </div>`).join('')}
    </section>`;
  }

  _renderChainOfCustody(coc) {
    return `
    <section class="chain-of-custody">
      <h2>Chain of Custody</h2>
      <div class="coc-metadata">
        <p><strong>Investigator:</strong> ${this._escapeHtml(coc.investigator)}</p>
        <p><strong>Case Number:</strong> ${coc.caseNumber}</p>
        <p><strong>Collection Period:</strong> ${new Date(coc.startTime).toLocaleString()} - ${new Date(coc.endTime).toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${coc.entries.map(entry => `
          <tr>
            <td>${new Date(entry.timestamp).toLocaleString()}</td>
            <td>${this._escapeHtml(entry.action)}</td>
            <td>${this._escapeHtml(entry.actor)}</td>
            <td>${this._escapeHtml(entry.notes)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>`;
  }

  _renderCompliance(compliance) {
    return `
    <section class="compliance">
      <h2>Compliance & Standards</h2>
      <h3>Applicable Standards</h3>
      <ul>
        ${compliance.standards.map(std => `<li>${this._escapeHtml(std)}</li>`).join('')}
      </ul>
      <h3>Compliance Requirements</h3>
      <ul>
        ${Object.entries(compliance.requirements).map(([key, value]) => `
        <li>
          <strong>${key.replace(/_/g, ' ')}:</strong> ${this._escapeHtml(value)}
        </li>`).join('')}
      </ul>
    </section>`;
  }

  _renderFooter(report) {
    return `
    <footer class="report-footer">
      <hr/>
      <p><strong>Report ID:</strong> ${report.id}</p>
      <p><strong>Generated:</strong> ${new Date(report.generatedAt).toLocaleString()}</p>
      <p><strong>Content Hash (SHA-256):</strong> <code>${this._hashReport(report)}</code></p>
      <p class="footer-note">This report is confidential and contains privileged information. It is intended for authorized recipients only.</p>
    </footer>`;
  }

  _getStyles() {
    return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: #333;
        background: #f5f5f5;
        line-height: 1.6;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
        background: white;
        box-shadow: 0 0 20px rgba(0,0,0,0.1);
      }
      header.report-header {
        border-bottom: 4px solid #0066cc;
        padding-bottom: 30px;
        margin-bottom: 40px;
      }
      h1 {
        color: #0066cc;
        margin-bottom: 20px;
        font-size: 32px;
      }
      h2 {
        color: #0066cc;
        margin: 40px 0 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #e0e0e0;
      }
      h3 {
        color: #0066cc;
        margin: 25px 0 15px;
        font-size: 18px;
      }
      section {
        margin-bottom: 40px;
      }
      .header-metadata {
        background: #f0f4f8;
        padding: 20px;
        border-radius: 5px;
      }
      .header-metadata p {
        margin: 8px 0;
        font-size: 14px;
      }
      code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Courier New', monospace;
        font-size: 12px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 12px;
        text-align: left;
      }
      th {
        background: #f5f5f5;
        font-weight: bold;
        color: #333;
      }
      tr:nth-child(even) {
        background: #f9f9f9;
      }
      tr:hover {
        background: #f0f8ff;
      }
      .overview-grid, .details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        margin: 20px 0;
      }
      .overview-item, .detail-item {
        background: #f5f5f5;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #0066cc;
      }
      .overview-item .label, .detail-item strong {
        color: #0066cc;
        font-weight: bold;
      }
      .overview-item .value {
        font-size: 16px;
        margin-top: 5px;
      }
      .risk-assessment {
        border-left: 4px solid;
        padding: 15px;
        margin: 15px 0;
        border-radius: 4px;
      }
      .risk-assessment.risk-critical {
        background: #fff3e0;
        border-color: #ff6f00;
      }
      .risk-assessment.risk-high {
        background: #ffebee;
        border-color: #c62828;
      }
      .risk-assessment.risk-medium {
        background: #fff8e1;
        border-color: #f57f17;
      }
      .risk-assessment.risk-low {
        background: #e8f5e9;
        border-color: #2e7d32;
      }
      .findings-list {
        list-style: none;
      }
      .finding {
        background: #f5f5f5;
        border-left: 4px solid;
        padding: 15px;
        margin: 10px 0;
        border-radius: 4px;
      }
      .finding-critical {
        border-color: #ff6f00;
      }
      .finding-high {
        border-color: #c62828;
      }
      .finding-medium {
        border-color: #f57f17;
      }
      .finding-info {
        border-color: #0066cc;
      }
      .tech-category {
        margin: 25px 0;
      }
      .network-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin: 20px 0;
      }
      .network-summary .stat {
        background: #e3f2fd;
        padding: 15px;
        border-radius: 5px;
        border-left: 4px solid #0066cc;
      }
      .screenshots-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
        margin: 20px 0;
      }
      .screenshot-item {
        background: #f5f5f5;
        padding: 15px;
        border-radius: 5px;
      }
      .content-details {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 5px;
      }
      .form-item, .screenshot-item {
        background: #f9f9f9;
        padding: 15px;
        margin: 10px 0;
        border-left: 4px solid #0066cc;
        border-radius: 3px;
      }
      .link-type {
        background: #e0e0e0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        color: #666;
      }
      .recommendation {
        background: #f5f5f5;
        border-left: 4px solid;
        padding: 15px;
        margin: 15px 0;
        border-radius: 4px;
      }
      .recommendation-critical {
        border-color: #ff6f00;
        background: #fff3e0;
      }
      .recommendation-high {
        border-color: #c62828;
        background: #ffebee;
      }
      .recommendation-medium {
        border-color: #f57f17;
        background: #fff8e1;
      }
      .recommendation-low {
        border-color: #2e7d32;
        background: #e8f5e9;
      }
      footer.report-footer {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 5px;
        font-size: 12px;
        color: #666;
        margin-top: 50px;
      }
      .footer-note {
        font-style: italic;
        margin-top: 15px;
        color: #999;
      }
      @media print {
        .container {
          box-shadow: none;
          background: white;
        }
        page-break-before: avoid;
        page-break-inside: avoid;
      }
    `;
  }

  _formatBytes(bytes) {
    if (typeof bytes !== 'number' || bytes === 0) {
      return '0 B';
    }
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  _hashReport(report) {
    const content = JSON.stringify(report, null, 2);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  _escapeHtml(text) {
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
}

/**
 * JSON Report Formatter
 */
class JSONFormatter {
  async format(report, options = {}) {
    const formatted = {
      ...report,
      signatures: {
        ...report.signatures,
        contentHash: this._hashReport(report)
      }
    };

    return JSON.stringify(formatted, null, options.compact ? 0 : 2);
  }

  _hashReport(report) {
    const content = JSON.stringify(report, (key, value) => {
      if (key === 'signatures') {
        return undefined;
      }
      return value;
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Markdown Report Formatter
 */
class MarkdownFormatter {
  async format(report, options = {}) {
    let markdown = `# ${report.title}\n\n`;

    // Metadata
    markdown += `**Report ID:** \`${report.id}\`  \n`;
    markdown += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}  \n`;
    markdown += `**Investigator:** ${report.metadata.investigator}  \n`;
    markdown += `**Case Number:** ${report.metadata.caseNumber || 'N/A'}  \n\n`;

    // Executive Summary
    markdown += `## Executive Summary\n\n`;
    markdown += `${report.executiveSummary.overview.briefSummary}\n\n`;
    markdown += `### Risk Assessment\n`;
    markdown += `- **Level:** ${report.executiveSummary.riskAssessment.level}\n`;
    markdown += `- **Score:** ${report.executiveSummary.riskAssessment.score}/100\n\n`;

    // Key Findings
    markdown += `### Key Findings\n`;
    report.executiveSummary.keyFindings.forEach(finding => {
      markdown += `- **${finding.category}:** ${finding.description}\n`;
    });
    markdown += '\n';

    // Technologies
    if (report.sections.technologies) {
      markdown += `## Technologies Detected\n\n`;
      markdown += `**Total:** ${report.sections.technologies.totalDetected}\n\n`;
      report.sections.technologies.technologies.forEach(tech => {
        markdown += `- ${tech.name} (${tech.version}) - ${tech.category} - ${Math.round(tech.confidence * 100)}%\n`;
      });
      markdown += '\n';
    }

    // Content Analysis
    if (report.sections.contentAnalysis) {
      markdown += `## Content Analysis\n\n`;
      markdown += `- **URL:** \`${report.sections.contentAnalysis.url}\`\n`;
      markdown += `- **Title:** ${report.sections.contentAnalysis.title}\n`;
      markdown += `- **Forms:** ${report.sections.contentAnalysis.forms.length}\n`;
      markdown += `- **Links:** ${report.sections.contentAnalysis.links.length}\n\n`;
    }

    // Timeline
    if (report.sections.timeline) {
      markdown += `## Chronological Timeline\n\n`;
      markdown += `| Timestamp | Source | Type | Description |\n`;
      markdown += `|-----------|--------|------|-------------|\n`;
      report.sections.timeline.events.forEach(event => {
        markdown += `| ${new Date(event.timestamp).toLocaleString()} | ${event.source} | ${event.type} | ${event.description} |\n`;
      });
      markdown += '\n';
    }

    // Recommendations
    if (report.sections.recommendations) {
      markdown += `## Recommendations\n\n`;
      report.sections.recommendations.forEach(rec => {
        markdown += `### ${rec.title} (${rec.priority})\n`;
        markdown += `${rec.description}\n\n`;
        markdown += `**Action:** ${rec.action}\n\n`;
      });
    }

    // Chain of Custody
    markdown += `## Chain of Custody\n\n`;
    report.chainOfCustody.entries.forEach(entry => {
      markdown += `- **${entry.timestamp}:** ${entry.action} by ${entry.actor} - ${entry.notes}\n`;
    });
    markdown += '\n';

    // Footer
    markdown += `---\n\n`;
    markdown += `**Content Hash (SHA-256):** \`${this._hashReport(report)}\`\n`;
    markdown += `**Tool:** ${report.metadata.toolName} v${report.metadata.toolVersion}\n`;

    return markdown;
  }

  _hashReport(report) {
    const content = JSON.stringify(report, (key, value) => {
      if (key === 'signatures') {
        return undefined;
      }
      return value;
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

/**
 * CSV Report Formatter
 * Exports evidence and metadata as CSV
 */
class CSVFormatter {
  async format(report, options = {}) {
    let csv = '';

    // Report metadata
    csv += 'Field,Value\n';
    csv += `"Report ID","${report.id}"\n`;
    csv += `"Title","${this._escapeCsv(report.title)}"\n`;
    csv += `"Generated","${new Date(report.generatedAt).toLocaleString()}"\n`;
    csv += `"Investigator","${this._escapeCsv(report.metadata.investigator)}"\n`;
    csv += `"Case Number","${report.metadata.caseNumber || 'N/A'}"\n\n`;

    // Risk Assessment
    csv += 'Risk Assessment\n';
    csv += `"Risk Level","${report.executiveSummary.riskAssessment.level}"\n`;
    csv += `"Risk Score","${report.executiveSummary.riskAssessment.score}"\n\n`;

    // Findings
    csv += 'Findings\n';
    csv += '"Category","Description","Severity"\n';
    report.executiveSummary.keyFindings.forEach(finding => {
      csv += `"${this._escapeCsv(finding.category)}","${this._escapeCsv(finding.description)}","${finding.severity}"\n`;
    });
    csv += '\n';

    // Technologies
    if (report.sections.technologies && report.sections.technologies.technologies.length > 0) {
      csv += 'Technologies\n';
      csv += '"Name","Version","Category","Confidence"\n';
      report.sections.technologies.technologies.forEach(tech => {
        csv += `"${this._escapeCsv(tech.name)}","${this._escapeCsv(tech.version)}","${this._escapeCsv(tech.category)}","${Math.round(tech.confidence * 100)}%"\n`;
      });
      csv += '\n';
    }

    // Network Requests
    if (report.sections.networkForensics && report.sections.networkForensics.requests.length > 0) {
      csv += 'Network Requests\n';
      csv += '"Method","URL","Status","Response Time"\n';
      report.sections.networkForensics.requests.slice(0, 100).forEach(req => {
        csv += `"${req.method}","${this._escapeCsv(req.url)}","${req.status}","${req.responseTime}"\n`;
      });
      csv += '\n';
    }

    // Evidence Items
    if (report.sections.evidence && report.sections.evidence.items.length > 0) {
      csv += 'Evidence Items\n';
      csv += '"Type","Count","Size","Description"\n';
      report.sections.evidence.items.forEach(item => {
        csv += `"${this._escapeCsv(item.type)}","${item.count || 'N/A'}","${item.size || 'N/A'}","${this._escapeCsv(item.description)}"\n`;
      });
      csv += '\n';
    }

    return csv;
  }

  _escapeCsv(text) {
    if (!text) {
      return '';
    }
    if (text.includes('"') || text.includes(',') || text.includes('\n')) {
      return `"${String(text).replace(/"/g, '""')}"`;
    }
    return text;
  }
}

module.exports = {
  HTMLFormatter,
  JSONFormatter,
  MarkdownFormatter,
  CSVFormatter
};

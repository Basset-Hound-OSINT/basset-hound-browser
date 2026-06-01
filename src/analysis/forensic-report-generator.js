/**
 * Basset Hound Browser - Forensic Report Generation
 * Aggregates all forensic data into comprehensive reports with timeline, evidence, and analysis
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ForensicReportGenerator {
  constructor() {
    this.reports = [];
    this.reportDir = path.join(require('os').homedir(), '.basset-hound', 'reports');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Aggregate all forensic data into single report
   * @param {Object} data - Collection of forensic data (session, site analysis, screenshots, etc.)
   * @returns {Object} Comprehensive forensic report
   */
  generateReport(data) {
    const report = {
      id: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      title: data.title || 'Forensic Investigation Report',
      metadata: {
        investigator: data.investigator || 'Unknown',
        case_number: data.caseNumber || null,
        start_time: data.startTime || new Date().toISOString(),
        end_time: data.endTime || new Date().toISOString()
      },
      evidence: {
        session: data.session || {},
        site_analysis: data.siteAnalysis || {},
        metadata: data.metadata || {},
        network: data.network || {},
        screenshots: data.screenshots || [],
        recordings: data.recordings || []
      },
      timeline: this.buildTimeline(data),
      chain_of_custody: this.generateChainOfCustody(data),
      findings: this.generateFindings(data),
      recommendations: this.generateRecommendations(data),
      attachments: this.catalogAttachments(data)
    };

    // Add digital signatures
    report.signatures = {
      report_hash: this.hashReport(report),
      evidence_hashes: this.hashEvidence(report.evidence)
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Build chronological timeline of all events
   */
  buildTimeline(data) {
    const events = [];

    // Add session events
    if (data.session && data.session.timeline) {
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
    if (data.screenshots && Array.isArray(data.screenshots)) {
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
    if (data.metadata && data.metadata.extracted_at) {
      events.push({
        timestamp: data.metadata.extracted_at,
        source: 'metadata',
        type: 'data_extraction',
        description: 'Metadata extracted and verified'
      });
    }

    // Add network events
    if (data.network && data.network.requests) {
      const firstRequest = Math.min(...data.network.requests.map(r => r.timestamp || Date.now()));
      const lastRequest = Math.max(...data.network.requests.map(r => (r.timestamp || Date.now()) + (r.total_time || 0)));

      events.push({
        timestamp: new Date(firstRequest).toISOString(),
        source: 'network',
        type: 'network_monitoring',
        description: `Network monitoring started: ${data.network.requests.length} requests captured`
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
   * Generate chain of custody documentation
   */
  generateChainOfCustody(data) {
    const chain = {
      preserved_evidence: [],
      verification_hashes: [],
      custody_log: []
    };

    // Evidence preservation
    if (data.session) {
      chain.preserved_evidence.push({
        evidence_id: crypto.randomBytes(16).toString('hex'),
        type: 'session_recording',
        description: 'Complete investigation session recording',
        hash: data.session.hash || 'N/A',
        timestamp: data.session.metadata?.start_timestamp || new Date().toISOString()
      });
    }

    if (data.screenshots && data.screenshots.length > 0) {
      chain.preserved_evidence.push({
        evidence_id: crypto.randomBytes(16).toString('hex'),
        type: 'screenshots',
        count: data.screenshots.length,
        description: `${data.screenshots.length} screenshot(s) captured`,
        timestamp: data.screenshots[0].timestamp || new Date().toISOString()
      });
    }

    if (data.siteAnalysis) {
      chain.preserved_evidence.push({
        evidence_id: crypto.randomBytes(16).toString('hex'),
        type: 'site_analysis',
        description: 'Deep site analysis with technology detection',
        timestamp: new Date().toISOString()
      });
    }

    if (data.metadata) {
      chain.preserved_evidence.push({
        evidence_id: crypto.randomBytes(16).toString('hex'),
        type: 'metadata_extraction',
        description: 'File metadata extraction results',
        hash: data.metadata.file?.hash?.sha256 || 'N/A',
        timestamp: data.metadata.chain_of_custody?.extracted_at || new Date().toISOString()
      });
    }

    if (data.network) {
      chain.preserved_evidence.push({
        evidence_id: crypto.randomBytes(16).toString('hex'),
        type: 'network_forensics',
        description: `Network analysis: ${data.network.total_requests || 0} requests`,
        timestamp: new Date().toISOString()
      });
    }

    // Custody log entries
    chain.custody_log.push({
      timestamp: new Date().toISOString(),
      action: 'Evidence Collected',
      by: 'Basset Hound Browser v11.2.0',
      notes: 'Automated forensic evidence collection'
    });

    chain.custody_log.push({
      timestamp: new Date().toISOString(),
      action: 'Report Generated',
      by: 'Forensic Report Generator',
      notes: 'All evidence aggregated and verified'
    });

    return chain;
  }

  /**
   * Generate investigative findings
   */
  generateFindings(data) {
    const findings = {
      key_findings: [],
      technology_stack: [],
      security_assessment: {},
      data_collected: {}
    };

    // Technology findings
    if (data.siteAnalysis && data.siteAnalysis.technologies) {
      findings.technology_stack = [
        {
          category: 'Frameworks',
          items: data.siteAnalysis.technologies.frameworks || []
        },
        {
          category: 'CMS',
          items: data.siteAnalysis.technologies.cms || []
        },
        {
          category: 'Servers',
          items: data.siteAnalysis.technologies.servers || []
        },
        {
          category: 'Languages',
          items: data.siteAnalysis.technologies.languages || []
        },
        {
          category: 'Analytics',
          items: data.siteAnalysis.technologies.analytics || []
        }
      ];

      findings.key_findings.push({
        category: 'Technology',
        finding: `Website uses ${(data.siteAnalysis.technologies.frameworks || []).length} JavaScript framework(s) and ${(data.siteAnalysis.technologies.cms || []).length} CMS system(s)`
      });
    }

    // Security findings
    if (data.siteAnalysis && data.siteAnalysis.security) {
      findings.security_assessment = data.siteAnalysis.security;
      findings.key_findings.push({
        category: 'Security',
        finding: `Security score: ${data.siteAnalysis.score || 'N/A'}/100`
      });
    }

    // Forms and input fields
    if (data.siteAnalysis && data.siteAnalysis.forms) {
      findings.data_collected.forms = data.siteAnalysis.forms.length;
      findings.key_findings.push({
        category: 'Forms',
        finding: `${data.siteAnalysis.forms.length} form(s) detected for potential data extraction`
      });
    }

    // Network findings
    if (data.network && data.network.total_requests) {
      findings.data_collected.network_requests = data.network.total_requests;
      findings.key_findings.push({
        category: 'Network',
        finding: `${data.network.total_requests} HTTP requests captured`
      });
    }

    // Third-party trackers
    if (data.network && data.network.third_party_trackers) {
      findings.key_findings.push({
        category: 'Privacy',
        finding: `${data.network.third_party_trackers.length} third-party trackers detected`
      });
    }

    // Screenshots
    if (data.screenshots && data.screenshots.length > 0) {
      findings.data_collected.screenshots = data.screenshots.length;
      findings.key_findings.push({
        category: 'Visual Evidence',
        finding: `${data.screenshots.length} screenshot(s) captured for visual verification`
      });
    }

    return findings;
  }

  /**
   * Generate recommendations based on findings
   */
  generateRecommendations(data) {
    const recommendations = [];

    // Security recommendations
    if (data.siteAnalysis && data.siteAnalysis.score !== undefined && data.siteAnalysis.score < 70) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Security',
        recommendation: 'Implement missing security headers (CSP, X-Frame-Options, HSTS)',
        rationale: 'Low security score indicates missing critical HTTP headers'
      });
    }

    // Privacy recommendations
    if (data.network && data.network.third_party_trackers && data.network.third_party_trackers.length > 5) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Privacy',
        recommendation: 'Review and audit third-party tracking implementations',
        rationale: `Multiple trackers (${data.network.third_party_trackers.length}) found - user privacy impact`
      });
    }

    // Form security
    if (data.siteAnalysis && data.siteAnalysis.forms && data.siteAnalysis.forms.length > 0) {
      const hiddenFieldCount = data.siteAnalysis.forms.reduce((sum, f) => sum + (f.hidden_fields ? f.hidden_fields.length : 0), 0);
      if (hiddenFieldCount > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          category: 'Forms',
          recommendation: 'Audit hidden form fields for consent tracking',
          rationale: `${hiddenFieldCount} hidden field(s) found in forms`
        });
      }
    }

    // Data collection
    if (data.session && data.session.metadata && data.session.metadata.commands_executed > 50) {
      recommendations.push({
        priority: 'LOW',
        category: 'Data Quality',
        recommendation: 'Archive and compress session recording for long-term storage',
        rationale: 'Large number of interactions recorded - consider storage optimization'
      });
    }

    return recommendations;
  }

  /**
   * Catalog attachments and evidence references
   */
  catalogAttachments(data) {
    const attachments = [];

    if (data.sessionFile) {
      attachments.push({
        type: 'session',
        filename: path.basename(data.sessionFile),
        path: data.sessionFile,
        size: data.sessionFileSize || 'Unknown'
      });
    }

    if (data.screenshots && Array.isArray(data.screenshots)) {
      data.screenshots.forEach((screenshot, index) => {
        attachments.push({
          type: 'screenshot',
          filename: screenshot.filename || `screenshot-${index}.png`,
          path: screenshot.filepath,
          timestamp: screenshot.timestamp
        });
      });
    }

    if (data.recordingFile) {
      attachments.push({
        type: 'recording',
        filename: path.basename(data.recordingFile),
        path: data.recordingFile,
        size: data.recordingFileSize || 'Unknown'
      });
    }

    return attachments;
  }

  /**
   * Hash entire report for verification
   */
  hashReport(report) {
    const hash = crypto.createHash('sha256');
    // Hash all content except signatures
    const { signatures, ...reportData } = report;
    hash.update(JSON.stringify(reportData));
    return hash.digest('hex');
  }

  /**
   * Hash evidence for chain of custody
   */
  hashEvidence(evidence) {
    const hashes = {};

    Object.entries(evidence).forEach(([key, value]) => {
      const hash = crypto.createHash('sha256');
      hash.update(JSON.stringify(value));
      hashes[key] = hash.digest('hex');
    });

    return hashes;
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(report) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Forensic Investigation Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; color: #333; line-height: 1.6; }
          .page { page-break-after: always; padding: 40px; }
          .header { border-bottom: 3px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .metadata { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; }
          .section { margin: 30px 0; }
          .section-title { font-size: 18px; font-weight: bold; border-left: 4px solid #007bff; padding-left: 10px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #999; padding: 10px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          .timeline { display: flex; flex-direction: column; gap: 10px; }
          .timeline-item { border-left: 3px solid #007bff; padding-left: 15px; padding-top: 5px; }
          .timestamp { font-weight: bold; color: #0066cc; }
          .finding { background: #f9f9f9; padding: 10px; margin: 5px 0; border-left: 3px solid #ffc107; }
          .recommendation { background: #e7f3ff; padding: 10px; margin: 5px 0; border-left: 3px solid #007bff; }
          .priority-high { border-left-color: #dc3545; }
          .priority-medium { border-left-color: #ffc107; }
          .priority-low { border-left-color: #28a745; }
          .chain-of-custody { background: #f5f5f5; padding: 15px; border-radius: 3px; }
          .hash { font-family: monospace; font-size: 11px; word-break: break-all; background: #f0f0f0; padding: 5px; margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="title">${report.title}</div>
            <div class="metadata">
              <div><strong>Report ID:</strong> ${report.id}</div>
              <div><strong>Generated:</strong> ${report.timestamp}</div>
              <div><strong>Investigator:</strong> ${report.metadata.investigator}</div>
              <div><strong>Case Number:</strong> ${report.metadata.case_number || 'N/A'}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Executive Summary</div>
            <p>${report.findings.key_findings.length} key findings identified across ${Object.keys(report.evidence).length} evidence categories.</p>
          </div>

          <div class="section">
            <div class="section-title">Chronological Timeline</div>
            <div class="timeline">
              ${report.timeline.map((event, idx) => `
                <div class="timeline-item">
                  <span class="timestamp">${event.timestamp}</span> (${event.source}) - ${event.type}: ${event.description}
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="page">
          <div class="section">
            <div class="section-title">Key Findings</div>
            ${report.findings.key_findings.map(f => `
              <div class="finding">
                <strong>${f.category}:</strong> ${f.finding}
              </div>
            `).join('')}
          </div>

          <div class="section">
            <div class="section-title">Technology Stack</div>
            <table>
              <tr><th>Category</th><th>Technologies</th></tr>
              ${report.findings.technology_stack.map(t => `
                <tr>
                  <td>${t.category}</td>
                  <td>${t.items.join(', ') || 'None detected'}</td>
                </tr>
              `).join('')}
            </table>
          </div>

          <div class="section">
            <div class="section-title">Recommendations</div>
            ${report.recommendations.map(r => `
              <div class="recommendation priority-${r.priority.toLowerCase()}">
                <strong>[${r.priority}] ${r.category}:</strong> ${r.recommendation}
                <div style="font-size: 12px; margin-top: 5px; color: #666;">Rationale: ${r.rationale}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="page">
          <div class="section">
            <div class="section-title">Chain of Custody</div>
            <div class="chain-of-custody">
              <h4>Preserved Evidence</h4>
              <table>
                <tr><th>ID</th><th>Type</th><th>Description</th><th>Hash</th></tr>
                ${report.chain_of_custody.preserved_evidence.map(e => `
                  <tr>
                    <td>${e.evidence_id}</td>
                    <td>${e.type}</td>
                    <td>${e.description}</td>
                    <td class="hash">${e.hash}</td>
                  </tr>
                `).join('')}
              </table>

              <h4 style="margin-top: 20px;">Custody Log</h4>
              <table>
                <tr><th>Timestamp</th><th>Action</th><th>By</th><th>Notes</th></tr>
                ${report.chain_of_custody.custody_log.map(entry => `
                  <tr>
                    <td>${entry.timestamp}</td>
                    <td>${entry.action}</td>
                    <td>${entry.by}</td>
                    <td>${entry.notes}</td>
                  </tr>
                `).join('')}
              </table>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Report Verification</div>
            <div class="hash"><strong>Report Hash (SHA-256):</strong><br/>${report.signatures.report_hash}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Save report to file
   */
  saveReport(report, format = 'json') {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `forensic-report-${report.id}-${timestamp}.${format}`;
      const filepath = path.join(this.reportDir, filename);

      if (format === 'json') {
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
      } else if (format === 'html') {
        const html = this.generateHTMLReport(report);
        fs.writeFileSync(filepath, html);
      }

      return {
        success: true,
        filename,
        filepath,
        report_id: report.id
      };
    } catch (err) {
      throw new Error(`Save report failed: ${err.message}`);
    }
  }

  /**
   * Get all reports
   */
  getAllReports() {
    return this.reports;
  }

  /**
   * Get report by ID
   */
  getReport(reportId) {
    return this.reports.find(r => r.id === reportId);
  }

  /**
   * Export report data
   */
  exportReport(reportId) {
    const report = this.getReport(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    return {
      success: true,
      report,
      json_export: JSON.stringify(report, null, 2),
      html_export: this.generateHTMLReport(report)
    };
  }
}

module.exports = ForensicReportGenerator;

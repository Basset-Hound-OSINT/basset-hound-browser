/**
 * Report Generator Core
 *
 * Orchestrates report creation from evidence packages.
 * Delegates formatting to specialized formatter modules.
 *
 * @module reporting/generator-core
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { createLogger } = require('../../logging');
const {
  HTMLFormatter,
  JSONFormatter,
  MarkdownFormatter,
  CSVFormatter
} = require('./formatters');

/**
 * Main Report Generator
 * Orchestrates report creation from evidence packages
 */
class ReportGenerator {
  constructor(options = {}) {
    this.logger = createLogger('ReportGenerator');
    this.reportDir = options.reportDir || path.join(os.homedir(), 'tmp', '.basset-hound', 'reports');
    this.companyName = options.companyName || 'Basset Hound Browser';
    this.toolVersion = options.toolVersion || '12.1.0';
    this.templateDir = options.templateDir || path.join(__dirname, 'templates');

    // Template managers
    this.templates = new Map();
    this.formatters = new Map();

    // Initialize
    this._registerFormatters();
    this._ensureDirectory();
  }

  /**
   * Register output format handlers
   * @private
   */
  _registerFormatters() {
    this.formatters.set('html', new HTMLFormatter(this.companyName, this.toolVersion));
    this.formatters.set('json', new JSONFormatter());
    this.formatters.set('markdown', new MarkdownFormatter());
    this.formatters.set('csv', new CSVFormatter());
  }

  /**
   * Ensure report directory exists
   * @private
   */
  _ensureDirectory() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
      this.logger.info(`Created reports directory: ${this.reportDir}`);
    }
  }

  /**
   * Generate comprehensive forensic report
   *
   * @param {Object} evidence - Evidence package from forensic investigation
   * @param {Object} options - Report generation options
   * @param {string} options.title - Report title
   * @param {string} options.format - Output format (html, pdf, json, markdown, csv)
   * @param {boolean} options.includeScreenshots - Include screenshot evidence
   * @param {boolean} options.includeNetworkCapture - Include network HAR data
   * @param {boolean} options.includeTechnologies - Include detected technologies
   * @param {boolean} options.includeTimeline - Include timeline of events
   * @param {boolean} options.includeRecommendations - Include recommendations
   * @param {string[]} options.sensitiveDataFilter - Data types to redact (email, phone, credit_card)
   * @returns {Promise<Object>} Report data and metadata
   */
  async generateReport(evidence, options = {}) {
    const startTime = Date.now();

    try {
      // Validate inputs
      if (!evidence || typeof evidence !== 'object') {
        throw new Error('Evidence package is required and must be an object');
      }

      const format = (options.format || 'html').toLowerCase();
      if (!this.formatters.has(format)) {
        throw new Error(`Unsupported format: ${format}. Supported: html, pdf, json, markdown, csv`);
      }

      // Build report structure
      const reportData = this._buildReportStructure(evidence, options);

      // Apply sensitive data filtering if requested
      if (options.sensitiveDataFilter && options.sensitiveDataFilter.length > 0) {
        this._filterSensitiveData(reportData, options.sensitiveDataFilter);
      }

      // Generate formatted output
      const formatter = this.formatters.get(format);
      const reportContent = await formatter.format(reportData, options);

      // Generate metadata
      const reportId = options.reportId || `rpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const generationTime = Date.now() - startTime;

      // Calculate metrics
      const metrics = this._calculateMetrics(reportData);

      return {
        success: true,
        reportId,
        format,
        title: options.title || 'Investigation Report',
        content: reportContent,
        contentSize: Buffer.byteLength(reportContent),
        pageCount: this._estimatePageCount(reportContent, format),
        generationTime,
        timestamp: new Date().toISOString(),
        sections: this._getSectionStatus(reportData),
        metrics,
        hash: crypto.createHash('sha256').update(reportContent).digest('hex')
      };
    } catch (error) {
      this.logger.error('Report generation failed', { error: error.message, options });
      throw error;
    }
  }

  /**
   * Save generated report to file
   *
   * @param {string} content - Report content
   * @param {string} filename - Output filename
   * @param {string} format - File format extension
   * @returns {Promise<string>} File path
   */
  async saveReport(content, filename, format = 'html') {
    try {
      const extension = format || 'html';
      const finalFilename = filename.endsWith(`.${extension}`) ? filename : `${filename}.${extension}`;
      const filepath = path.join(this.reportDir, finalFilename);

      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(filepath, content, 'utf-8');
      this.logger.info(`Report saved: ${filepath}`);

      return filepath;
    } catch (error) {
      this.logger.error('Failed to save report', { error: error.message, filename });
      throw error;
    }
  }

  /**
   * Build comprehensive report structure
   * @private
   */
  _buildReportStructure(evidence, options) {
    const report = {
      id: options.reportId || crypto.randomBytes(16).toString('hex'),
      title: options.title || 'Investigation Report',
      generatedAt: new Date().toISOString(),

      // Metadata
      metadata: {
        toolName: this.companyName,
        toolVersion: this.toolVersion,
        operatingSystem: process.platform
      },

      // Executive Summary
      executiveSummary: {
        overview: this._generateOverview(evidence, options),
        keyFindings: this._extractKeyFindings(evidence),
        riskAssessment: this._assessRisks(evidence)
      },

      // Investigation Details
      investigation: {
        scope: options.scope || 'Not specified',
        methodology: options.methodology || 'Digital forensic investigation using Basset Hound Browser',
        startTime: evidence.startTime || new Date().toISOString(),
        endTime: evidence.endTime || new Date().toISOString()
      },

      // Sections to include (only if requested)
      sections: {
        technologies: options.includeTechnologies ? this._buildTechnologiesSection(evidence) : null,
        screenshots: options.includeScreenshots ? this._buildScreenshotsSection(evidence) : null,
        networkForensics: options.includeNetworkCapture ? this._buildNetworkSection(evidence) : null,
        contentAnalysis: this._buildContentSection(evidence),
        timeline: options.includeTimeline ? this._buildTimelineSection(evidence) : null,
        evidence: this._buildEvidenceSection(evidence),
        recommendations: options.includeRecommendations ? this._buildRecommendationsSection(evidence) : null
      },

      // Chain of Custody
      chainOfCustody: this._buildChainOfCustody(evidence, options),

      // Compliance sections
      compliance: this._buildComplianceSection(evidence, options),

      // Digital signatures
      signatures: {
        contentHash: null, // Calculated by formatter
        timestamp: new Date().toISOString(),
        algorithm: 'SHA-256'
      }
    };

    return report;
  }

  /**
   * Generate executive overview
   * @private
   */
  _generateOverview(evidence, options) {
    const url = evidence.url || evidence.target || 'Unknown target';
    const sessionCount = evidence.sessionCount || 1;
    const screenshotCount = (evidence.screenshots || []).length;

    return {
      briefSummary: `Investigation of ${url} conducted on ${new Date(evidence.startTime || Date.now()).toLocaleDateString()}`,
      targetUrl: url,
      investigationPeriod: `${new Date(evidence.startTime || Date.now()).toLocaleTimeString()} - ${new Date(evidence.endTime || Date.now()).toLocaleTimeString()}`,
      sessionCount,
      evidenceItems: screenshotCount + (evidence.networkRequests?.length || 0) + (evidence.artifacts?.length || 0),
      status: 'Completed'
    };
  }

  /**
   * Extract key findings from evidence
   * @private
   */
  _extractKeyFindings(evidence) {
    const findings = [];

    // Technology findings
    if (evidence.technologies && evidence.technologies.length > 0) {
      findings.push({
        category: 'Technologies Detected',
        description: `Identified ${evidence.technologies.length} technologies including CMS, frameworks, and security tools`,
        severity: 'INFO'
      });
    }

    // Network findings
    if (evidence.networkRequests && evidence.networkRequests.length > 0) {
      const externalRequests = (evidence.networkRequests || []).filter(r => !r.url?.includes(evidence.url));
      if (externalRequests.length > 0) {
        findings.push({
          category: 'External Resources',
          description: `Found ${externalRequests.length} external resource requests from ${new Set(externalRequests.map(r => new URL(r.url).hostname)).size} unique domains`,
          severity: 'MEDIUM'
        });
      }
    }

    // Content findings
    if (evidence.contentAnalysis) {
      if (evidence.contentAnalysis.forms && evidence.contentAnalysis.forms.length > 0) {
        findings.push({
          category: 'Forms Detected',
          description: `Identified ${evidence.contentAnalysis.forms.length} form(s) for data collection`,
          severity: 'MEDIUM'
        });
      }

      if (evidence.contentAnalysis.suspiciousElements) {
        findings.push({
          category: 'Suspicious Elements',
          description: evidence.contentAnalysis.suspiciousElements.join('; '),
          severity: 'HIGH'
        });
      }
    }

    return findings;
  }

  /**
   * Assess risk level
   * @private
   */
  _assessRisks(evidence) {
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
   * Build technologies section
   * @private
   */
  _buildTechnologiesSection(evidence) {
    if (!evidence.technologies || !Array.isArray(evidence.technologies)) {
      return { technologies: [] };
    }

    const grouped = {};
    evidence.technologies.forEach(tech => {
      const category = tech.category || 'Other';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tech);
    });

    return {
      totalDetected: evidence.technologies.length,
      byCategory: grouped,
      technologies: evidence.technologies.map(tech => ({
        name: tech.name,
        version: tech.version || 'Unknown',
        category: tech.category,
        confidence: tech.confidence,
        detectionMethod: tech.detectionMethods?.[0] || 'Analysis'
      }))
    };
  }

  /**
   * Build screenshots section
   * @private
   */
  _buildScreenshotsSection(evidence) {
    const screenshots = (evidence.screenshots || []).map((ss, idx) => ({
      id: ss.id || `screenshot_${idx}`,
      url: ss.url || 'Unknown',
      timestamp: ss.timestamp || new Date().toISOString(),
      description: ss.description || `Screenshot of ${ss.url || 'page'} at ${new Date(ss.timestamp).toLocaleTimeString()}`,
      imageHash: ss.hash || 'N/A',
      size: ss.size || 'Unknown',
      annotations: ss.annotations || []
    }));

    return {
      totalCount: screenshots.length,
      screenshots
    };
  }

  /**
   * Build network forensics section
   * @private
   */
  _buildNetworkSection(evidence) {
    const requests = evidence.networkRequests || [];

    const summary = {
      totalRequests: requests.length,
      totalDataTransferred: requests.reduce((sum, r) => sum + (r.responseSize || 0), 0),
      requestsByType: {},
      failedRequests: requests.filter(r => r.status >= 400).length,
      externalDomains: new Set(requests.map(r => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return 'invalid';
        }
      })).size
    };

    // Count by type
    requests.forEach(r => {
      const type = r.type || 'unknown';
      summary.requestsByType[type] = (summary.requestsByType[type] || 0) + 1;
    });

    return {
      summary,
      requests: requests.map(r => ({
        timestamp: r.timestamp,
        method: r.method || 'GET',
        url: r.url,
        status: r.status,
        responseTime: r.responseTime || 'N/A',
        size: r.responseSize || 0,
        type: r.type || 'unknown'
      }))
    };
  }

  /**
   * Build content analysis section
   * @private
   */
  _buildContentSection(evidence) {
    const content = evidence.contentAnalysis || {};

    return {
      url: evidence.url || 'Unknown',
      title: content.title || 'No title',
      description: content.description || 'No description',
      textContent: content.textContent ? `${content.textContent.substring(0, 500)}...` : 'No content',
      forms: (content.forms || []).map(form => ({
        id: form.id || 'unnamed',
        method: form.method || 'POST',
        action: form.action || 'Unknown',
        fields: form.fields || []
      })),
      links: (content.links || []).map(link => ({
        url: link.url,
        text: link.text,
        type: link.type || 'external'
      }))
    };
  }

  /**
   * Build timeline section
   * @private
   */
  _buildTimelineSection(evidence) {
    const events = [];

    // Add session events
    if (evidence.timeline && Array.isArray(evidence.timeline)) {
      evidence.timeline.forEach(event => {
        events.push({
          timestamp: event.timestamp,
          source: 'session',
          type: event.type,
          description: event.description || event.type
        });
      });
    }

    // Add screenshot events
    (evidence.screenshots || []).forEach(ss => {
      events.push({
        timestamp: ss.timestamp,
        source: 'screenshot',
        type: 'visual_evidence',
        description: `Screenshot captured: ${ss.url || 'page'}`
      });
    });

    // Sort chronologically
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return { events };
  }

  /**
   * Build evidence section
   * @private
   */
  _buildEvidenceSection(evidence) {
    const evidenceItems = [];

    if (evidence.screenshots) {
      evidenceItems.push({
        type: 'screenshots',
        count: evidence.screenshots.length,
        totalSize: evidence.screenshots.reduce((sum, s) => sum + (s.size || 0), 0),
        description: `${evidence.screenshots.length} screenshot(s) captured`
      });
    }

    if (evidence.networkRequests) {
      evidenceItems.push({
        type: 'network_capture',
        count: evidence.networkRequests.length,
        description: `${evidence.networkRequests.length} network request(s) captured`
      });
    }

    if (evidence.html) {
      evidenceItems.push({
        type: 'page_archive',
        size: Buffer.byteLength(evidence.html),
        hash: crypto.createHash('sha256').update(evidence.html).digest('hex'),
        description: 'Complete page HTML archive'
      });
    }

    return {
      totalItems: evidenceItems.length,
      items: evidenceItems
    };
  }

  /**
   * Build recommendations section
   * @private
   */
  _buildRecommendationsSection(evidence) {
    const recommendations = [];

    // Base recommendations on findings
    const risks = this._assessRisks(evidence);

    if (risks.score > 60) {
      recommendations.push({
        priority: 'CRITICAL',
        title: 'Immediate Action Required',
        description: risks.factors.join('; '),
        action: 'Isolate affected system and conduct detailed forensic analysis'
      });
    }

    if ((evidence.technologies || []).length > 20) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Complex Technology Stack',
        description: `Target uses ${evidence.technologies.length} different technologies`,
        action: 'Review technology dependencies for known vulnerabilities'
      });
    }

    if ((evidence.contentAnalysis?.forms || []).length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Active Form Elements',
        description: 'Target contains form(s) that may collect user data',
        action: 'Review form submissions and data handling practices'
      });
    }

    return recommendations;
  }

  /**
   * Build chain of custody section
   * @private
   */
  _buildChainOfCustody(evidence, options) {
    return {
      startTime: evidence.startTime || new Date().toISOString(),
      endTime: evidence.endTime || new Date().toISOString(),
      investigator: options.investigator || 'Unknown',
      caseNumber: options.caseNumber || 'N/A',
      entries: [
        {
          timestamp: evidence.startTime || new Date().toISOString(),
          action: 'evidence_collection_started',
          actor: options.investigator || 'Unknown',
          notes: 'Investigation commenced'
        },
        {
          timestamp: evidence.endTime || new Date().toISOString(),
          action: 'evidence_collection_completed',
          actor: options.investigator || 'Unknown',
          notes: 'Investigation completed and report generated'
        }
      ]
    };
  }

  /**
   * Build compliance section
   * @private
   */
  _buildComplianceSection(evidence, options) {
    const compliance = {
      standards: ['ISO/IEC 27037:2012 - Digital forensics'],
      certifications: [],
      requirements: {
        legalAdmissibility: 'Compliant with chain of custody standards',
        dataProtection: 'Sensitive data handling as specified',
        confidentiality: 'Report marked confidential as required'
      }
    };

    if (options.gdprCompliant) {
      compliance.standards.push('GDPR - Data Protection Regulation');
      compliance.requirements.dataProtection = 'GDPR-compliant data processing and retention';
    }

    if (options.hipaaCompliant) {
      compliance.standards.push('HIPAA - Health Insurance Portability and Accountability Act');
      compliance.requirements.dataProtection = 'HIPAA-compliant handling of protected health information';
    }

    if (options.soxCompliant) {
      compliance.standards.push('SOX - Sarbanes-Oxley Act');
      compliance.requirements.dataProtection = 'SOX-compliant financial data handling';
    }

    return compliance;
  }

  /**
   * Filter sensitive data from report
   * @private
   */
  _filterSensitiveData(reportData, filters) {
    const patterns = {
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      credit_card: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
      api_key: /[a-zA-Z0-9]{32,}/g
    };

    const redact = (text) => {
      if (!text || typeof text !== 'string') {
        return text;
      }

      let result = text;
      filters.forEach(filter => {
        if (patterns[filter]) {
          result = result.replace(patterns[filter], '[REDACTED]');
        }
      });
      return result;
    };

    // Recursively redact sensitive data
    const redactObj = (obj) => {
      if (typeof obj === 'string') {
        return redact(obj);
      } else if (Array.isArray(obj)) {
        return obj.map(redactObj);
      } else if (obj && typeof obj === 'object') {
        const redacted = {};
        Object.keys(obj).forEach(key => {
          redacted[key] = redactObj(obj[key]);
        });
        return redacted;
      }
      return obj;
    };

    return redactObj(reportData);
  }

  /**
   * Calculate report metrics
   * @private
   */
  _calculateMetrics(reportData) {
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
   * Get section generation status
   * @private
   */
  _getSectionStatus(reportData) {
    return Object.keys(reportData.sections).reduce((acc, key) => {
      acc[key] = reportData.sections[key] !== null;
      return acc;
    }, {});
  }

  /**
   * Estimate page count
   * @private
   */
  _estimatePageCount(content, format) {
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
}

module.exports = {
  ReportGenerator
};

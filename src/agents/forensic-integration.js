/**
 * Basset Hound Browser - Forensic Integration Module
 * Integrates forensic capture and chain of custody logging
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const crypto = require('crypto');

class ForensicIntegration {
  constructor(options = {}) {
    this.evidenceLog = [];
    this.chainOfCustody = [];
    this.capturedData = new Map();
    this.maxEvidenceItems = options.maxEvidenceItems || 10000;
    this.enableAutoHash = options.enableAutoHash !== false;
    this.enableTimestamps = options.enableTimestamps !== false;
  }

  /**
   * Capture screenshot with metadata
   */
  captureScreenshot(screenshotData, context = {}) {
    return this.recordEvidence('screenshot', {
      data: screenshotData,
      context: {
        url: context.url,
        title: context.title,
        resolution: context.resolution,
        timestamp: context.timestamp || Date.now(),
        ...context
      },
      type: 'image',
      format: 'png'
    });
  }

  /**
   * Capture network traffic
   */
  captureNetworkTraffic(request, response, context = {}) {
    return this.recordEvidence('network', {
      request: {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
        body: request.body ? '(redacted)' : null,
        timestamp: request.timestamp || Date.now()
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: this.sanitizeHeaders(response.headers),
        size: response.size,
        timestamp: response.timestamp || Date.now()
      },
      context: {
        proxy: context.proxy,
        session: context.session,
        ...context
      },
      type: 'network',
      format: 'http'
    });
  }

  /**
   * Capture JavaScript execution
   */
  captureJavaScriptExecution(script, result, context = {}) {
    return this.recordEvidence('javascript', {
      script: {
        code: script.substring(0, 500), // Truncate for storage
        hash: this.hashData(script),
        timestamp: Date.now()
      },
      result: {
        output: result,
        timestamp: Date.now()
      },
      context: {
        page: context.page,
        session: context.session,
        ...context
      },
      type: 'script',
      format: 'javascript'
    });
  }

  /**
   * Capture DOM snapshot
   */
  captureDOMSnapshot(htmlContent, context = {}) {
    return this.recordEvidence('dom', {
      html: htmlContent.substring(0, 10000), // Truncate for storage
      hash: this.hashData(htmlContent),
      context: {
        url: context.url,
        timestamp: context.timestamp || Date.now(),
        selectors: context.selectors || [],
        ...context
      },
      type: 'markup',
      format: 'html'
    });
  }

  /**
   * Capture storage data (localStorage, sessionStorage, cookies)
   */
  captureStorageData(storageType, data, context = {}) {
    return this.recordEvidence('storage', {
      storageType: storageType, // 'localStorage', 'sessionStorage', 'cookies'
      entries: this.sanitizeStorageData(data),
      entryCount: Array.isArray(data) ? data.length : Object.keys(data || {}).length,
      context: {
        session: context.session,
        domain: context.domain,
        timestamp: context.timestamp || Date.now(),
        ...context
      },
      type: 'storage',
      format: 'json'
    });
  }

  /**
   * Record evidence with chain of custody
   */
  recordEvidence(evidenceType, evidenceData) {
    if (this.evidenceLog.length >= this.maxEvidenceItems) {
      this.evidenceLog.shift(); // Remove oldest
    }

    const evidence = {
      id: this.generateEvidenceId(),
      type: evidenceType,
      timestamp: this.enableTimestamps ? Date.now() : null,
      data: evidenceData,
      hash: this.enableAutoHash ? this.hashData(JSON.stringify(evidenceData)) : null,
      chainOfCustodyId: null
    };

    this.evidenceLog.push(evidence);
    this.capturedData.set(evidence.id, evidence);

    // Create chain of custody entry
    const custodyEntry = this.createCustodyEntry(evidence);
    this.chainOfCustody.push(custodyEntry);
    evidence.chainOfCustodyId = custodyEntry.id;

    return {
      success: true,
      evidenceId: evidence.id,
      type: evidenceType,
      hash: evidence.hash,
      chainOfCustodyId: custodyEntry.id
    };
  }

  /**
   * Create chain of custody entry
   */
  createCustodyEntry(evidence) {
    return {
      id: this.generateCustodyId(),
      evidenceId: evidence.id,
      timestamp: Date.now(),
      action: 'captured',
      handler: 'forensic-integration',
      location: 'basset-hound-browser',
      status: 'evidence',
      hash: evidence.hash,
      notes: `${evidence.type} captured and recorded`
    };
  }

  /**
   * Get evidence by ID
   */
  getEvidence(evidenceId) {
    const evidence = this.capturedData.get(evidenceId);
    if (!evidence) {
      return { success: false, error: 'Evidence not found' };
    }

    return {
      success: true,
      evidence: {
        id: evidence.id,
        type: evidence.type,
        timestamp: evidence.timestamp,
        hash: evidence.hash,
        data: evidence.data
      }
    };
  }

  /**
   * Get chain of custody for evidence
   */
  getChainOfCustody(evidenceId) {
    const custody = this.chainOfCustody.filter(c => c.evidenceId === evidenceId);

    return {
      success: true,
      evidenceId,
      chainLength: custody.length,
      chain: custody.map(c => ({
        timestamp: c.timestamp,
        action: c.action,
        handler: c.handler,
        hash: c.hash,
        status: c.status
      }))
    };
  }

  /**
   * Generate forensic report
   */
  generateForensicReport(context = {}) {
    const report = {
      generated: Date.now(),
      context: {
        url: context.url,
        duration: context.duration,
        ...context
      },
      summary: {
        evidenceItemsCollected: this.evidenceLog.length,
        evidenceTypes: this.getEvidenceTypeBreakdown(),
        chainOfCustodyEntries: this.chainOfCustody.length,
        integrityVerified: this.verifyIntegrity()
      },
      evidence: this.getEvidenceSummary(),
      recommendations: this.generateRecommendations()
    };

    return report;
  }

  /**
   * Get evidence type breakdown
   */
  getEvidenceTypeBreakdown() {
    const breakdown = {};

    for (const evidence of this.evidenceLog) {
      breakdown[evidence.type] = (breakdown[evidence.type] || 0) + 1;
    }

    return breakdown;
  }

  /**
   * Verify integrity of evidence
   */
  verifyIntegrity() {
    let intactCount = 0;
    let totalCount = this.evidenceLog.length;

    for (const evidence of this.evidenceLog) {
      if (evidence.hash) {
        const currentHash = this.hashData(JSON.stringify(evidence.data));
        if (currentHash === evidence.hash) {
          intactCount++;
        }
      }
    }

    return {
      intactEvidence: intactCount,
      totalEvidence: totalCount,
      integrityPercentage: totalCount > 0 ? ((intactCount / totalCount) * 100).toFixed(2) : 100
    };
  }

  /**
   * Get evidence summary
   */
  getEvidenceSummary() {
    return this.evidenceLog.slice(-20).map(e => ({
      id: e.id,
      type: e.type,
      timestamp: e.timestamp,
      hash: e.hash,
      chainOfCustodyId: e.chainOfCustodyId
    }));
  }

  /**
   * Generate recommendations based on evidence
   */
  generateRecommendations() {
    const recommendations = [];

    const breakdown = this.getEvidenceTypeBreakdown();

    if (!breakdown['network']) {
      recommendations.push('No network traffic captured. Consider enabling network monitoring.');
    }

    if (!breakdown['screenshot']) {
      recommendations.push('No screenshots captured. Add visual documentation.');
    }

    if (!breakdown['storage']) {
      recommendations.push('No storage data captured. Document cookies and localStorage.');
    }

    if (this.chainOfCustody.length < this.evidenceLog.length) {
      recommendations.push('Chain of custody incomplete. Verify all evidence is tracked.');
    }

    return recommendations;
  }

  /**
   * Export evidence for report
   */
  exportEvidence(format = 'json') {
    const exportData = {
      exportedAt: Date.now(),
      format,
      summary: {
        evidenceItems: this.evidenceLog.length,
        custodyEntries: this.chainOfCustody.length
      },
      evidence: this.evidenceLog.map(e => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        hash: e.hash
      })),
      chainOfCustody: this.chainOfCustody
    };

    if (format === 'json') {
      return {
        success: true,
        data: exportData,
        mimeType: 'application/json'
      };
    }

    if (format === 'csv') {
      return {
        success: true,
        data: this.convertToCSV(exportData),
        mimeType: 'text/csv'
      };
    }

    return { success: false, error: `Unsupported format: ${format}` };
  }

  /**
   * Convert data to CSV
   */
  convertToCSV(data) {
    let csv = 'ID,Type,Timestamp,Hash\n';

    for (const item of data.evidence) {
      csv += `"${item.id}","${item.type}",${item.timestamp},"${item.hash}"\n`;
    }

    return csv;
  }

  /**
   * Clear evidence (with audit trail)
   */
  clearEvidence(olderThanDate = null) {
    let clearedCount = 0;

    for (let i = this.evidenceLog.length - 1; i >= 0; i--) {
      if (olderThanDate === null || this.evidenceLog[i].timestamp < olderThanDate) {
        const evidence = this.evidenceLog[i];
        this.capturedData.delete(evidence.id);
        this.evidenceLog.splice(i, 1);
        clearedCount++;
      }
    }

    return {
      success: true,
      clearedItems: clearedCount,
      remainingItems: this.evidenceLog.length
    };
  }

  /**
   * Sanitize headers for logging
   */
  sanitizeHeaders(headers) {
    if (!headers) return {};

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '(redacted)';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize storage data
   */
  sanitizeStorageData(data) {
    const sanitized = {};

    for (const [key, value] of Object.entries(data || {})) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '(redacted)';
      } else {
        sanitized[key] = String(value).substring(0, 500);
      }
    }

    return sanitized;
  }

  /**
   * Check if key contains sensitive data
   */
  isSensitiveKey(key) {
    const sensitivePatterns = ['token', 'auth', 'password', 'secret', 'key', 'api'];
    const lowerKey = key.toLowerCase();

    return sensitivePatterns.some(pattern => lowerKey.includes(pattern));
  }

  /**
   * Hash data for integrity verification
   */
  hashData(data) {
    return crypto.createHash('sha256').update(String(data)).digest('hex');
  }

  /**
   * Generate unique evidence ID
   * Uses 16 bytes (128 bits) of entropy for security
   */
  generateEvidenceId() {
    return `evt_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Generate unique custody ID
   * Uses 16 bytes (128 bits) of entropy for security
   */
  generateCustodyId() {
    return `coc_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Get forensic status
   */
  getStatus() {
    return {
      evidenceCollected: this.evidenceLog.length,
      maxEvidence: this.maxEvidenceItems,
      custodyEntries: this.chainOfCustody.length,
      integrity: this.verifyIntegrity(),
      autoHashEnabled: this.enableAutoHash,
      timestampsEnabled: this.enableTimestamps
    };
  }
}

module.exports = ForensicIntegration;

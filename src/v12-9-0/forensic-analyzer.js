/**
 * Advanced Forensic Analysis Engine
 * Feature 3: v12.9.0 - Advanced Forensic Analysis Engine
 *
 * Provides:
 * - Comprehensive artifact collection
 * - Network traffic capture and analysis
 * - Pattern detection and analysis
 * - Chain of custody management
 * - Multi-format report generation
 * - Evidence integrity verification
 *
 * Version: 1.0.0
 * Created: July 3, 2026
 */

const crypto = require('crypto');

class Artifact {
  constructor(type, data, options = {}) {
    this.id = crypto.randomUUID();
    this.type = type; // screenshot, html-snapshot, network-trace, cookies, etc.
    this.data = data;
    this.timestamp = options.timestamp || Date.now();
    this.mimeType = options.mimeType || 'application/octet-stream';
    this.size = Buffer.isBuffer(data) ? data.length : JSON.stringify(data).length;
    this.hash = this._calculateHash(data);
    this.metadata = options.metadata || {};
    this.tags = options.tags || [];
    this.source = options.source || 'unknown';
    this.verified = false;
  }

  _calculateHash(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  verify() {
    const newHash = this._calculateHash(this.data);
    this.verified = newHash === this.hash;
    return this.verified;
  }

  getSummary() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      mimeType: this.mimeType,
      size: this.size,
      hash: this.hash,
      verified: this.verified,
      source: this.source,
      tags: this.tags,
      metadata: this.metadata
    };
  }
}

class ForensicTimeline {
  constructor() {
    this.events = [];
    this.index = new Map(); // type -> [events of that type]
  }

  addEvent(eventType, data, timestamp = Date.now()) {
    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      timestamp,
      data,
      sequenceNumber: this.events.length
    };

    this.events.push(event);

    if (!this.index.has(eventType)) {
      this.index.set(eventType, []);
    }
    this.index.get(eventType).push(event);

    return event.id;
  }

  getEventsByType(eventType) {
    return this.index.get(eventType) || [];
  }

  getEventRange(startTime, endTime) {
    return this.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
  }

  getTimelineSequence() {
    return this.events.map(e => ({
      type: e.type,
      timestamp: e.timestamp,
      sequenceNumber: e.sequenceNumber
    }));
  }

  getStatistics() {
    const typeStats = {};
    for (const [type, events] of this.index) {
      typeStats[type] = events.length;
    }

    const timespan = this.events.length > 0 ? this.events[this.events.length - 1].timestamp - this.events[0].timestamp : 0;

    return {
      totalEvents: this.events.length,
      timespan,
      eventTypes: Object.keys(typeStats),
      eventCounts: typeStats
    };
  }
}

class ChainOfCustody {
  constructor() {
    this.records = [];
    this.verification = new Map();
  }

  recordCollection(artifactId, source, collector, notes = '') {
    const record = {
      id: crypto.randomUUID(),
      artifactId,
      action: 'collection',
      source,
      collector,
      timestamp: Date.now(),
      notes
    };
    this.records.push(record);
    return record.id;
  }

  recordAccess(artifactId, accessor, purpose, timestamp = Date.now()) {
    const record = {
      id: crypto.randomUUID(),
      artifactId,
      action: 'access',
      accessor,
      purpose,
      timestamp
    };
    this.records.push(record);
    return record.id;
  }

  recordModification(artifactId, modifier, description, timestamp = Date.now()) {
    const record = {
      id: crypto.randomUUID(),
      artifactId,
      action: 'modification',
      modifier,
      description,
      timestamp,
      hashBefore: null,
      hashAfter: null
    };
    this.records.push(record);
    return record.id;
  }

  recordVerification(artifactId, verifier, verified, notes = '') {
    const record = {
      id: crypto.randomUUID(),
      artifactId,
      action: 'verification',
      verifier,
      verified,
      timestamp: Date.now(),
      notes
    };
    this.records.push(record);
    if (!this.verification.has(artifactId)) {
      this.verification.set(artifactId, []);
    }
    this.verification.get(artifactId).push(record);
    return record.id;
  }

  getArtifactHistory(artifactId) {
    return this.records.filter(r => r.artifactId === artifactId);
  }

  getArtifactVerifications(artifactId) {
    return this.verification.get(artifactId) || [];
  }

  isArtifactVerified(artifactId) {
    const verifications = this.getArtifactVerifications(artifactId);
    return verifications.length > 0 && verifications.every(v => v.verified);
  }

  getFullChainOfCustody() {
    return this.records;
  }
}

class ForensicAnalyzer {
  constructor(options = {}) {
    this.artifacts = new Map(); // artifactId -> Artifact
    this.timeline = new ForensicTimeline();
    this.chainOfCustody = new ChainOfCustody();
    this.patterns = [];
    this.analysisResults = new Map();
    this.config = {
      captureScreenshots: options.captureScreenshots !== false,
      captureNetworkTraffic: options.captureNetworkTraffic !== false,
      captureDOM: options.captureDOM !== false,
      captureCookies: options.captureCookies !== false,
      captureLocalStorage: options.captureLocalStorage !== false,
      captureSessionStorage: options.captureSessionStorage !== false,
      captureConsoleLogs: options.captureConsoleLogs !== false,
      capturePerformanceMetrics: options.capturePerformanceMetrics !== false,
      maxArtifacts: options.maxArtifacts || 10000,
      enableHashVerification: options.enableHashVerification !== false
    };
    this.sessionStartTime = Date.now();
    this.statistics = {
      artifactsCollected: 0,
      totalSize: 0,
      eventsCaptured: 0
    };
  }

  addArtifact(type, data, options = {}) {
    if (this.artifacts.size >= this.config.maxArtifacts) {
      throw new Error(`Max artifacts (${this.config.maxArtifacts}) reached`);
    }

    const artifact = new Artifact(type, data, {
      ...options,
      timestamp: options.timestamp || Date.now()
    });

    this.artifacts.set(artifact.id, artifact);
    this.statistics.artifactsCollected++;
    this.statistics.totalSize += artifact.size;

    // Record in timeline
    this.timeline.addEvent(`artifact-${type}`, {
      artifactId: artifact.id,
      size: artifact.size
    }, artifact.timestamp);

    // Record in chain of custody
    this.chainOfCustody.recordCollection(
      artifact.id,
      options.source || 'browser',
      options.collector || 'system',
      options.notes
    );

    return artifact.id;
  }

  captureScreenshot(screenshotData, options = {}) {
    return this.addArtifact('screenshot', screenshotData, {
      ...options,
      mimeType: 'image/png',
      source: 'screenshot-engine'
    });
  }

  captureHTMLSnapshot(html, options = {}) {
    return this.addArtifact('html-snapshot', html, {
      ...options,
      mimeType: 'text/html',
      source: 'dom-serializer'
    });
  }

  captureNetworkTrace(networkData, options = {}) {
    return this.addArtifact('network-trace', networkData, {
      ...options,
      mimeType: 'application/json',
      source: 'network-monitor'
    });
  }

  captureCookies(cookies, options = {}) {
    return this.addArtifact('cookies', cookies, {
      ...options,
      mimeType: 'application/json',
      source: 'cookie-manager'
    });
  }

  captureLocalStorage(storage, options = {}) {
    return this.addArtifact('local-storage', storage, {
      ...options,
      mimeType: 'application/json',
      source: 'storage-manager'
    });
  }

  recordEvent(eventType, data, timestamp = Date.now()) {
    this.timeline.addEvent(eventType, data, timestamp);
    this.statistics.eventsCaptured++;
    return this.timeline.events[this.timeline.events.length - 1].id;
  }

  recordNavigation(url, timestamp = Date.now()) {
    return this.recordEvent('navigation', { url }, timestamp);
  }

  recordInteraction(interactionType, target, data = {}, timestamp = Date.now()) {
    return this.recordEvent('interaction', {
      type: interactionType,
      target,
      data
    }, timestamp);
  }

  recordFormSubmission(formData, timestamp = Date.now()) {
    return this.recordEvent('form-submission', { formData }, timestamp);
  }

  analyzePatterns() {
    const patterns = [];

    // Pattern 1: Navigation frequency
    const navigationEvents = this.timeline.getEventsByType('navigation');
    if (navigationEvents.length > 0) {
      patterns.push({
        id: crypto.randomUUID(),
        type: 'navigation-pattern',
        description: `${navigationEvents.length} navigation events detected`,
        severity: 'info',
        events: navigationEvents
      });
    }

    // Pattern 2: Interaction clustering
    const interactionEvents = this.timeline.getEventsByType('interaction');
    if (interactionEvents.length > 10) {
      patterns.push({
        id: crypto.randomUUID(),
        type: 'interaction-clustering',
        description: `High interaction frequency: ${interactionEvents.length} interactions`,
        severity: 'warning',
        count: interactionEvents.length
      });
    }

    // Pattern 3: Rapid form submissions
    const formEvents = this.timeline.getEventsByType('form-submission');
    if (formEvents.length > 5) {
      const firstTime = formEvents[0].timestamp;
      const lastTime = formEvents[formEvents.length - 1].timestamp;
      const timeWindow = lastTime - firstTime;
      if (timeWindow < 60000) { // 60 seconds
        patterns.push({
          id: crypto.randomUUID(),
          type: 'rapid-forms',
          description: `${formEvents.length} form submissions in ${timeWindow}ms`,
          severity: 'high',
          count: formEvents.length,
          timeWindow
        });
      }
    }

    this.patterns = patterns;
    return patterns;
  }

  getArtifact(artifactId) {
    return this.artifacts.get(artifactId);
  }

  getArtifactSummary(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return null;
    }
    return artifact.getSummary();
  }

  getArtifactsList() {
    const list = [];
    for (const artifact of this.artifacts.values()) {
      list.push(artifact.getSummary());
    }
    return list;
  }

  verifyArtifactIntegrity(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      return false;
    }

    const isVerified = artifact.verify();
    this.chainOfCustody.recordVerification(
      artifactId,
      'system',
      isVerified,
      `Integrity verification ${isVerified ? 'passed' : 'failed'}`
    );

    return isVerified;
  }

  generateReport(format = 'json') {
    const timelineStats = this.timeline.getStatistics();
    const sessionDuration = Date.now() - this.sessionStartTime;

    const report = {
      sessionInfo: {
        startTime: this.sessionStartTime,
        endTime: Date.now(),
        duration: sessionDuration
      },
      statistics: {
        ...this.statistics,
        artifactCount: this.artifacts.size,
        timelineStats
      },
      artifacts: this.getArtifactsList(),
      timeline: this.timeline.getTimelineSequence(),
      patterns: this.patterns,
      chainOfCustody: this.chainOfCustody.getFullChainOfCustody()
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'html') {
      return this._generateHTMLReport(report);
    } else if (format === 'csv') {
      return this._generateCSVReport(report);
    }

    return report;
  }

  _generateHTMLReport(report) {
    let html = '<html><body>';
    html += '<h1>Forensic Analysis Report</h1>';
    html += `<p>Session Duration: ${report.sessionInfo.duration}ms</p>`;
    html += `<p>Artifacts Collected: ${report.statistics.artifactCount}</p>`;
    html += `<p>Total Size: ${report.statistics.totalSize} bytes</p>`;
    html += '</body></html>';
    return html;
  }

  _generateCSVReport(report) {
    let csv = 'Type,Timestamp,Size,Hash,Verified\n';
    for (const artifact of report.artifacts) {
      csv += `${artifact.type},${artifact.timestamp},${artifact.size},${artifact.hash},${artifact.verified}\n`;
    }
    return csv;
  }

  getStatistics() {
    return {
      ...this.statistics,
      timelineStats: this.timeline.getStatistics(),
      artifactCount: this.artifacts.size,
      patternCount: this.patterns.length,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  reset() {
    this.artifacts.clear();
    this.timeline = new ForensicTimeline();
    this.chainOfCustody = new ChainOfCustody();
    this.patterns = [];
    this.analysisResults.clear();
    this.sessionStartTime = Date.now();
    this.statistics = {
      artifactsCollected: 0,
      totalSize: 0,
      eventsCaptured: 0
    };
  }
}

module.exports = {
  ForensicAnalyzer,
  Artifact,
  ForensicTimeline,
  ChainOfCustody
};

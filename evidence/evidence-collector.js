/**
 * Evidence Collector Module
 *
 * Phase 18: Evidence Collection Workflow
 *
 * Provides:
 * - Annotated screenshot capture
 * - Page archiving (MHTML/HTML)
 * - Network HAR capture
 * - Hash generation for integrity
 * - Chain of custody documentation
 * - Evidence packaging for legal proceedings
 */

const crypto = require('crypto');
const path = require('path');
const EventEmitter = require('events');

/**
 * Evidence types
 */
const EVIDENCE_TYPES = {
  SCREENSHOT: 'screenshot',
  PAGE_ARCHIVE: 'page_archive',
  NETWORK_HAR: 'network_har',
  DOM_SNAPSHOT: 'dom_snapshot',
  CONSOLE_LOG: 'console_log',
  COOKIES: 'cookies',
  LOCAL_STORAGE: 'local_storage',
  METADATA: 'metadata',
};

/**
 * Archive formats
 */
const ARCHIVE_FORMATS = {
  MHTML: 'mhtml',
  HTML: 'html',
  WARC: 'warc',
  PDF: 'pdf',
};

/**
 * Evidence class
 *
 * Represents a single piece of evidence with metadata
 */
class Evidence {
  constructor(type, data, metadata = {}) {
    this.id = `ev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.type = type;
    this.data = data;
    this.metadata = metadata;

    this.capturedAt = new Date().toISOString();
    this.capturedBy = metadata.capturedBy || 'system';

    // Generate content hash
    this.contentHash = this._generateHash(data);
    this.hashAlgorithm = 'sha256';

    // Chain of custody
    this.custodyChain = [{
      action: 'created',
      timestamp: this.capturedAt,
      actor: this.capturedBy,
      hash: this.contentHash,
    }];
  }

  /**
   * Generate SHA-256 hash of content
   */
  _generateHash(data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Verify integrity
   */
  verifyIntegrity() {
    const currentHash = this._generateHash(this.data);
    return currentHash === this.contentHash;
  }

  /**
   * Add custody chain entry
   */
  addCustodyEntry(action, actor, notes = '') {
    this.custodyChain.push({
      action,
      timestamp: new Date().toISOString(),
      actor,
      notes,
      previousHash: this.contentHash,
    });
  }

  /**
   * Get evidence summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      capturedAt: this.capturedAt,
      capturedBy: this.capturedBy,
      contentHash: this.contentHash,
      hashAlgorithm: this.hashAlgorithm,
      metadata: this.metadata,
      custodyChainLength: this.custodyChain.length,
      integrityValid: this.verifyIntegrity(),
    };
  }

  /**
   * Export to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      data: this.data,
      metadata: this.metadata,
      capturedAt: this.capturedAt,
      capturedBy: this.capturedBy,
      contentHash: this.contentHash,
      hashAlgorithm: this.hashAlgorithm,
      custodyChain: this.custodyChain,
    };
  }
}

/**
 * EvidencePackage class
 *
 * Container for related evidence items
 */
class EvidencePackage {
  constructor(options = {}) {
    this.id = `pkg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.name = options.name || 'Evidence Package';
    this.description = options.description || '';
    this.investigationId = options.investigationId || null;
    this.caseNumber = options.caseNumber || null;

    this.createdAt = new Date().toISOString();
    this.createdBy = options.createdBy || 'system';

    this.evidence = new Map();
    this.annotations = [];
    this.tags = options.tags || [];

    // Package integrity
    this.sealed = false;
    this.sealedAt = null;
    this.packageHash = null;
  }

  /**
   * Add evidence to package
   */
  addEvidence(evidence) {
    if (this.sealed) {
      throw new Error('Cannot modify sealed evidence package');
    }

    this.evidence.set(evidence.id, evidence);
    evidence.addCustodyEntry('added_to_package', this.createdBy, `Package: ${this.id}`);

    return evidence.id;
  }

  /**
   * Get evidence by ID
   */
  getEvidence(evidenceId) {
    return this.evidence.get(evidenceId);
  }

  /**
   * Add annotation to package
   */
  addAnnotation(text, author, evidenceIds = []) {
    if (this.sealed) {
      throw new Error('Cannot modify sealed evidence package');
    }

    this.annotations.push({
      id: `ann_${Date.now()}`,
      text,
      author,
      evidenceIds,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Seal the package (no more modifications)
   */
  seal(sealedBy) {
    if (this.sealed) {
      throw new Error('Package already sealed');
    }

    // Verify all evidence integrity
    for (const evidence of this.evidence.values()) {
      if (!evidence.verifyIntegrity()) {
        throw new Error(`Evidence ${evidence.id} failed integrity check`);
      }
    }

    // Calculate package hash
    const packageContent = {
      id: this.id,
      name: this.name,
      evidence: Array.from(this.evidence.values()).map(e => e.toJSON()),
      annotations: this.annotations,
    };

    this.packageHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(packageContent))
      .digest('hex');

    this.sealed = true;
    this.sealedAt = new Date().toISOString();
    this.sealedBy = sealedBy;

    // Add seal entry to all evidence
    for (const evidence of this.evidence.values()) {
      evidence.addCustodyEntry('package_sealed', sealedBy, `Package hash: ${this.packageHash}`);
    }

    return this.packageHash;
  }

  /**
   * Verify package integrity
   */
  verifyPackage() {
    if (!this.sealed) {
      return { valid: false, reason: 'Package not sealed' };
    }

    // Verify each evidence item
    for (const evidence of this.evidence.values()) {
      if (!evidence.verifyIntegrity()) {
        return {
          valid: false,
          reason: `Evidence ${evidence.id} failed integrity check`,
        };
      }
    }

    // Verify package hash
    const packageContent = {
      id: this.id,
      name: this.name,
      evidence: Array.from(this.evidence.values()).map(e => e.toJSON()),
      annotations: this.annotations,
    };

    const currentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(packageContent))
      .digest('hex');

    if (currentHash !== this.packageHash) {
      return { valid: false, reason: 'Package hash mismatch' };
    }

    return { valid: true, packageHash: this.packageHash };
  }

  /**
   * Get package summary
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      investigationId: this.investigationId,
      caseNumber: this.caseNumber,
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      evidenceCount: this.evidence.size,
      annotationCount: this.annotations.length,
      tags: this.tags,
      sealed: this.sealed,
      sealedAt: this.sealedAt,
      packageHash: this.packageHash,
    };
  }

  /**
   * Export for legal proceedings
   */
  exportForCourt() {
    if (!this.sealed) {
      throw new Error('Package must be sealed before court export');
    }

    const verification = this.verifyPackage();
    if (!verification.valid) {
      throw new Error(`Package verification failed: ${verification.reason}`);
    }

    return {
      packageInfo: this.getSummary(),
      verification: {
        status: 'VERIFIED',
        verifiedAt: new Date().toISOString(),
        packageHash: this.packageHash,
        hashAlgorithm: 'sha256',
      },
      evidence: Array.from(this.evidence.values()).map(e => ({
        summary: e.getSummary(),
        custodyChain: e.custodyChain,
      })),
      annotations: this.annotations,
      certificationStatement: this._generateCertification(),
    };
  }

  /**
   * Generate certification statement
   */
  _generateCertification() {
    return `
EVIDENCE PACKAGE CERTIFICATION

Package ID: ${this.id}
Package Name: ${this.name}
Case Number: ${this.caseNumber || 'N/A'}
Investigation ID: ${this.investigationId || 'N/A'}

Created: ${this.createdAt}
Created By: ${this.createdBy}
Sealed: ${this.sealedAt}
Sealed By: ${this.sealedBy}

Evidence Items: ${this.evidence.size}
Annotations: ${this.annotations.length}

Package Hash (SHA-256): ${this.packageHash}

This evidence package has been cryptographically sealed and verified.
All contained evidence items maintain chain of custody documentation.
Hash values can be independently verified to confirm data integrity.

The integrity of this package was verified at: ${new Date().toISOString()}
    `.trim();
  }
}

/**
 * EvidenceCollector class
 *
 * Main class for capturing and managing evidence
 */
class EvidenceCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.storageDir = options.storageDir || './evidence';
    this.defaultFormat = options.defaultFormat || ARCHIVE_FORMATS.MHTML;
    this.autoCapture = options.autoCapture || false;

    this.packages = new Map();
    this.activePackageId = null;
  }

  /**
   * Create a new evidence package
   */
  createPackage(options = {}) {
    const pkg = new EvidencePackage(options);
    this.packages.set(pkg.id, pkg);

    if (!this.activePackageId) {
      this.activePackageId = pkg.id;
    }

    this.emit('packageCreated', pkg.getSummary());
    return pkg;
  }

  /**
   * Get active package
   */
  getActivePackage() {
    if (!this.activePackageId) return null;
    return this.packages.get(this.activePackageId);
  }

  /**
   * Set active package
   */
  setActivePackage(packageId) {
    if (!this.packages.has(packageId)) {
      throw new Error(`Package ${packageId} not found`);
    }
    this.activePackageId = packageId;
    return this.packages.get(packageId);
  }

  /**
   * Capture screenshot evidence
   *
   * @param {Buffer|string} imageData - Screenshot data (base64 or buffer)
   * @param {Object} metadata - Screenshot metadata
   * @returns {Evidence} Created evidence object
   */
  captureScreenshot(imageData, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.SCREENSHOT, imageData, {
      url: metadata.url,
      title: metadata.title,
      viewport: metadata.viewport,
      fullPage: metadata.fullPage || false,
      annotations: metadata.annotations || [],
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture page archive
   *
   * @param {string} content - Page content (HTML/MHTML)
   * @param {string} format - Archive format
   * @param {Object} metadata - Page metadata
   */
  capturePageArchive(content, format, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.PAGE_ARCHIVE, content, {
      url: metadata.url,
      title: metadata.title,
      format,
      contentLength: content.length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture network HAR
   *
   * @param {Object} harData - HAR format data
   * @param {Object} metadata - Capture metadata
   */
  captureNetworkHAR(harData, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.NETWORK_HAR, harData, {
      url: metadata.url,
      entryCount: harData.log?.entries?.length || 0,
      duration: metadata.duration,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture DOM snapshot
   */
  captureDOMSnapshot(domContent, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.DOM_SNAPSHOT, domContent, {
      url: metadata.url,
      nodeCount: metadata.nodeCount,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture console logs
   */
  captureConsoleLogs(logs, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.CONSOLE_LOG, logs, {
      url: metadata.url,
      logCount: logs.length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture cookies
   */
  captureCookies(cookies, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.COOKIES, cookies, {
      url: metadata.url,
      cookieCount: cookies.length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture local storage
   */
  captureLocalStorage(storageData, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.LOCAL_STORAGE, storageData, {
      url: metadata.url,
      keyCount: Object.keys(storageData).length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    const pkg = this.getActivePackage();
    if (pkg) {
      pkg.addEvidence(evidence);
    }

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture comprehensive evidence bundle
   *
   * @param {Object} captureOptions - What to capture
   * @param {Object} pageInfo - Page information
   * @returns {Array} Array of captured evidence
   */
  async captureBundle(captureOptions, pageInfo, captureFunction) {
    const captured = [];
    const { url, title } = pageInfo;
    const capturedBy = captureOptions.capturedBy || 'system';

    // Screenshot
    if (captureOptions.screenshot !== false) {
      const screenshotData = await captureFunction('screenshot', {
        fullPage: captureOptions.fullPage || false,
      });
      captured.push(this.captureScreenshot(screenshotData, {
        url,
        title,
        capturedBy,
        fullPage: captureOptions.fullPage,
      }));
    }

    // Page archive
    if (captureOptions.archive !== false) {
      const archiveData = await captureFunction('archive', {
        format: captureOptions.archiveFormat || this.defaultFormat,
      });
      captured.push(this.capturePageArchive(archiveData, captureOptions.archiveFormat || this.defaultFormat, {
        url,
        title,
        capturedBy,
      }));
    }

    // DOM snapshot
    if (captureOptions.dom) {
      const domData = await captureFunction('dom');
      captured.push(this.captureDOMSnapshot(domData, {
        url,
        title,
        capturedBy,
      }));
    }

    // Cookies
    if (captureOptions.cookies) {
      const cookieData = await captureFunction('cookies');
      captured.push(this.captureCookies(cookieData, {
        url,
        capturedBy,
      }));
    }

    // Local storage
    if (captureOptions.localStorage) {
      const storageData = await captureFunction('localStorage');
      captured.push(this.captureLocalStorage(storageData, {
        url,
        capturedBy,
      }));
    }

    // Console logs
    if (captureOptions.consoleLogs) {
      const logData = await captureFunction('consoleLogs');
      captured.push(this.captureConsoleLogs(logData, {
        url,
        capturedBy,
      }));
    }

    return captured;
  }

  /**
   * Seal the active package
   */
  sealActivePackage(sealedBy) {
    const pkg = this.getActivePackage();
    if (!pkg) {
      throw new Error('No active package');
    }

    const hash = pkg.seal(sealedBy);
    this.emit('packageSealed', { packageId: pkg.id, hash });

    return hash;
  }

  /**
   * Get package by ID
   */
  getPackage(packageId) {
    return this.packages.get(packageId);
  }

  /**
   * List all packages
   */
  listPackages() {
    return Array.from(this.packages.values()).map(p => p.getSummary());
  }

  /**
   * Export package
   */
  exportPackage(packageId, format = 'json') {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package ${packageId} not found`);
    }

    if (format === 'court') {
      return pkg.exportForCourt();
    }

    return {
      package: pkg.getSummary(),
      evidence: Array.from(pkg.evidence.values()).map(e => e.toJSON()),
      annotations: pkg.annotations,
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    let totalEvidence = 0;
    let sealedPackages = 0;

    for (const pkg of this.packages.values()) {
      totalEvidence += pkg.evidence.size;
      if (pkg.sealed) sealedPackages++;
    }

    return {
      totalPackages: this.packages.size,
      sealedPackages,
      totalEvidence,
      activePackageId: this.activePackageId,
    };
  }
}

module.exports = {
  Evidence,
  EvidencePackage,
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS,
};

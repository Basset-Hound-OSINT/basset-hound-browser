/**
 * Evidence Collector Module
 *
 * Phase 18: Evidence Collection Workflow (Simplified)
 *
 * Provides:
 * - Individual evidence capture with SHA-256 hashing
 * - Annotated screenshot capture
 * - Page archiving (MHTML/HTML)
 * - Network HAR capture
 * - Hash generation for integrity
 * - Chain of custody documentation
 *
 * Removed:
 * - Evidence packaging for investigations
 * - Package sealing and court export
 * - Investigation organization
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
 * EvidenceCollector class
 *
 * Simplified class for capturing individual evidence items
 */
class EvidenceCollector extends EventEmitter {
  constructor(options = {}) {
    super();

    this.storageDir = options.storageDir || './evidence';
    this.defaultFormat = options.defaultFormat || ARCHIVE_FORMATS.MHTML;
    this.autoCapture = options.autoCapture || false;
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

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture page archive
   *
   * @param {string} content - Page content (HTML/MHTML)
   * @param {string} format - Archive format
   * @param {Object} metadata - Page metadata
   * @returns {Evidence} Created evidence object
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

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture network HAR
   *
   * @param {Object} harData - HAR format data
   * @param {Object} metadata - Capture metadata
   * @returns {Evidence} Created evidence object
   */
  captureNetworkHAR(harData, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.NETWORK_HAR, harData, {
      url: metadata.url,
      entryCount: harData.log?.entries?.length || 0,
      duration: metadata.duration,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture DOM snapshot
   *
   * @param {string} domContent - DOM content
   * @param {Object} metadata - Capture metadata
   * @returns {Evidence} Created evidence object
   */
  captureDOMSnapshot(domContent, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.DOM_SNAPSHOT, domContent, {
      url: metadata.url,
      nodeCount: metadata.nodeCount,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture console logs
   *
   * @param {Array} logs - Console log entries
   * @param {Object} metadata - Capture metadata
   * @returns {Evidence} Created evidence object
   */
  captureConsoleLogs(logs, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.CONSOLE_LOG, logs, {
      url: metadata.url,
      logCount: logs.length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture cookies
   *
   * @param {Array} cookies - Cookie data
   * @param {Object} metadata - Capture metadata
   * @returns {Evidence} Created evidence object
   */
  captureCookies(cookies, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.COOKIES, cookies, {
      url: metadata.url,
      cookieCount: cookies.length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture local storage
   *
   * @param {Object} storageData - Local storage data
   * @param {Object} metadata - Capture metadata
   * @returns {Evidence} Created evidence object
   */
  captureLocalStorage(storageData, metadata = {}) {
    const evidence = new Evidence(EVIDENCE_TYPES.LOCAL_STORAGE, storageData, {
      url: metadata.url,
      keyCount: Object.keys(storageData).length,
      capturedBy: metadata.capturedBy || 'system',
      ...metadata,
    });

    this.emit('evidenceCaptured', evidence.getSummary());
    return evidence;
  }

  /**
   * Capture comprehensive evidence bundle
   *
   * @param {Object} captureOptions - What to capture
   * @param {Object} pageInfo - Page information
   * @param {Function} captureFunction - Function to capture page content
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
}

module.exports = {
  Evidence,
  EvidenceCollector,
  EVIDENCE_TYPES,
  ARCHIVE_FORMATS,
};

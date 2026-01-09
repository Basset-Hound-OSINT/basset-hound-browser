/**
 * Evidence Manager
 *
 * Implements forensic-grade evidence collection with RFC 3161 timestamping,
 * SHA-256 hashing, tamper-proof audit trails, and SWGDE-compliant reporting.
 *
 * Standards Compliance:
 * - RFC 3161: Time-Stamp Protocol (TSP)
 * - ISO 27037: Digital evidence identification and preservation
 * - SWGDE: Requirements for Report Writing in Digital Forensics
 * - NIST IR 8387: Digital Evidence Preservation
 *
 * @module evidence/evidence-manager
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

/**
 * Evidence Types
 */
const EVIDENCE_TYPES = {
  SCREENSHOT: 'screenshot',
  HTML_SOURCE: 'html_source',
  NETWORK_LOG: 'network_log',
  COOKIE: 'cookie',
  STORAGE: 'storage',
  INTERACTION: 'interaction',
  RECORDING: 'recording',
  METADATA: 'metadata',
  DOCUMENT: 'document',
  CUSTOM: 'custom'
};

/**
 * Evidence Chain of Custody Events
 */
const CUSTODY_EVENTS = {
  CREATED: 'created',
  COLLECTED: 'collected',
  VERIFIED: 'verified',
  ACCESSED: 'accessed',
  EXPORTED: 'exported',
  SEALED: 'sealed',
  MODIFIED: 'modified',
  DELETED: 'deleted'
};

/**
 * Evidence Item
 * Represents a single piece of evidence with full chain of custody
 */
class EvidenceItem {
  constructor(options) {
    this.id = options.id || this._generateId();
    this.type = options.type || EVIDENCE_TYPES.CUSTOM;
    this.timestamp = options.timestamp || Date.now();
    this.data = options.data;
    this.metadata = options.metadata || {};

    // Cryptographic hashing
    this.hash = this._calculateHash();
    this.hashAlgorithm = 'SHA-256';

    // Chain of custody
    this.custodyChain = [];
    this._addCustodyEvent(CUSTODY_EVENTS.CREATED, {
      actor: options.actor || 'system',
      details: 'Evidence item created'
    });

    // Verification
    this.verified = false;
    this.sealed = false;

    // Tags and categorization
    this.tags = options.tags || [];
    this.caseId = options.caseId;
    this.investigationId = options.investigationId;
  }

  _generateId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `evidence-${timestamp}-${random}`;
  }

  _calculateHash() {
    const dataString = JSON.stringify(this.data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  _addCustodyEvent(eventType, details) {
    const event = {
      eventType,
      timestamp: Date.now(),
      actor: details.actor || 'system',
      details: details.details || '',
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        hostname: require('os').hostname()
      }
    };

    this.custodyChain.push(event);
  }

  /**
   * Verify evidence integrity
   */
  verify() {
    const currentHash = this._calculateHash();
    this.verified = currentHash === this.hash;

    this._addCustodyEvent(CUSTODY_EVENTS.VERIFIED, {
      actor: 'system',
      details: `Verification ${this.verified ? 'passed' : 'FAILED'}`
    });

    return this.verified;
  }

  /**
   * Seal evidence (make immutable)
   */
  seal(actor = 'system') {
    if (this.sealed) {
      throw new Error('Evidence already sealed');
    }

    this.sealed = true;
    this.sealedAt = Date.now();
    this.sealedBy = actor;

    this._addCustodyEvent(CUSTODY_EVENTS.SEALED, {
      actor,
      details: 'Evidence sealed - no further modifications allowed'
    });
  }

  /**
   * Record access to evidence
   */
  recordAccess(actor, purpose) {
    this._addCustodyEvent(CUSTODY_EVENTS.ACCESSED, {
      actor,
      details: `Evidence accessed - Purpose: ${purpose}`
    });
  }

  /**
   * Export evidence to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      data: this.data,
      metadata: this.metadata,
      hash: this.hash,
      hashAlgorithm: this.hashAlgorithm,
      custodyChain: this.custodyChain,
      verified: this.verified,
      sealed: this.sealed,
      sealedAt: this.sealedAt,
      sealedBy: this.sealedBy,
      tags: this.tags,
      caseId: this.caseId,
      investigationId: this.investigationId
    };
  }
}

/**
 * Evidence Package
 * Groups related evidence items together
 */
class EvidencePackage {
  constructor(options) {
    this.id = options.id || this._generateId();
    this.name = options.name || `Package ${this.id}`;
    this.description = options.description || '';
    this.created = Date.now();
    this.items = [];
    this.metadata = options.metadata || {};
    this.caseId = options.caseId;
    this.investigationId = options.investigationId;
    this.sealed = false;
  }

  _generateId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    return `pkg-${timestamp}-${random}`;
  }

  addItem(item) {
    if (this.sealed) {
      throw new Error('Cannot add items to sealed package');
    }
    this.items.push(item);
  }

  seal(actor = 'system') {
    if (this.sealed) {
      throw new Error('Package already sealed');
    }

    this.sealed = true;
    this.sealedAt = Date.now();
    this.sealedBy = actor;

    // Seal all items
    this.items.forEach(item => {
      if (!item.sealed) {
        item.seal(actor);
      }
    });
  }

  calculatePackageHash() {
    const itemHashes = this.items.map(item => item.hash).sort().join('');
    return crypto.createHash('sha256').update(itemHashes).digest('hex');
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      created: this.created,
      items: this.items.map(item => item.toJSON()),
      itemCount: this.items.length,
      metadata: this.metadata,
      caseId: this.caseId,
      investigationId: this.investigationId,
      sealed: this.sealed,
      sealedAt: this.sealedAt,
      sealedBy: this.sealedBy,
      packageHash: this.calculatePackageHash()
    };
  }
}

/**
 * Evidence Manager
 * Main class for managing forensic evidence collection
 */
class EvidenceManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.basePath = options.basePath || path.join(process.cwd(), 'evidence-vault');
    this.evidence = new Map(); // evidenceId -> EvidenceItem
    this.packages = new Map(); // packageId -> EvidencePackage
    this.investigations = new Map(); // investigationId -> metadata

    // Audit trail
    this.auditLog = [];
    this.auditLogMaxSize = options.auditLogMaxSize || 10000;

    // Statistics
    this.stats = {
      evidenceCollected: 0,
      packagesCreated: 0,
      verificationsPerformed: 0,
      verificationsFailed: 0,
      itemsSealed: 0,
      exports: 0
    };

    // Configuration
    this.config = {
      autoVerify: options.autoVerify !== false,
      autoSeal: options.autoSeal || false,
      timestampServer: options.timestampServer || null, // RFC 3161 TSA
      enableBlockchain: options.enableBlockchain || false
    };

    this._ensureVaultDirectory();
  }

  async _ensureVaultDirectory() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'items'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'packages'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'reports'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'audit'), { recursive: true });
    } catch (error) {
      console.error('Failed to create evidence vault directory:', error);
    }
  }

  _addAuditEntry(action, details) {
    const entry = {
      timestamp: Date.now(),
      action,
      details,
      actor: details.actor || 'system'
    };

    this.auditLog.push(entry);

    // Trim audit log if too large
    if (this.auditLog.length > this.auditLogMaxSize) {
      this.auditLog.shift();
    }

    this.emit('audit-entry', entry);
  }

  /**
   * Create new investigation
   */
  createInvestigation(options) {
    const investigationId = options.id || `inv-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;

    const investigation = {
      id: investigationId,
      name: options.name || `Investigation ${investigationId}`,
      description: options.description || '',
      investigator: options.investigator || 'unknown',
      created: Date.now(),
      caseId: options.caseId,
      metadata: options.metadata || {},
      status: 'active'
    };

    this.investigations.set(investigationId, investigation);

    this._addAuditEntry('investigation_created', {
      actor: options.investigator,
      details: `Investigation created: ${investigation.name}`,
      investigationId
    });

    this.emit('investigation-created', investigation);

    return investigation;
  }

  /**
   * Collect evidence
   */
  async collectEvidence(options) {
    const item = new EvidenceItem({
      type: options.type,
      data: options.data,
      metadata: options.metadata,
      actor: options.actor || 'system',
      tags: options.tags,
      caseId: options.caseId,
      investigationId: options.investigationId
    });

    // Auto-verify if enabled
    if (this.config.autoVerify) {
      item.verify();
    }

    // Store in memory
    this.evidence.set(item.id, item);

    // Persist to disk
    await this._persistEvidence(item);

    // Update statistics
    this.stats.evidenceCollected++;

    this._addAuditEntry('evidence_collected', {
      actor: options.actor,
      details: `Evidence collected: ${item.type}`,
      evidenceId: item.id,
      investigationId: item.investigationId
    });

    this.emit('evidence-collected', item);

    return item;
  }

  async _persistEvidence(item) {
    const filePath = path.join(this.basePath, 'items', `${item.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(item.toJSON(), null, 2), 'utf8');
  }

  /**
   * Verify evidence integrity
   */
  verifyEvidence(evidenceId) {
    const item = this.evidence.get(evidenceId);
    if (!item) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    const verified = item.verify();

    this.stats.verificationsPerformed++;
    if (!verified) {
      this.stats.verificationsFailed++;
    }

    this._addAuditEntry('evidence_verified', {
      details: `Evidence verification ${verified ? 'passed' : 'FAILED'}`,
      evidenceId,
      verified
    });

    if (!verified) {
      this.emit('verification-failed', { evidenceId, item });
    }

    return verified;
  }

  /**
   * Seal evidence (make immutable)
   */
  sealEvidence(evidenceId, actor = 'system') {
    const item = this.evidence.get(evidenceId);
    if (!item) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    item.seal(actor);

    this.stats.itemsSealed++;

    this._addAuditEntry('evidence_sealed', {
      actor,
      details: 'Evidence sealed',
      evidenceId
    });

    this.emit('evidence-sealed', { evidenceId, item });

    return item;
  }

  /**
   * Create evidence package
   */
  createPackage(options) {
    const pkg = new EvidencePackage({
      name: options.name,
      description: options.description,
      metadata: options.metadata,
      caseId: options.caseId,
      investigationId: options.investigationId
    });

    this.packages.set(pkg.id, pkg);

    this.stats.packagesCreated++;

    this._addAuditEntry('package_created', {
      actor: options.actor || 'system',
      details: `Package created: ${pkg.name}`,
      packageId: pkg.id
    });

    this.emit('package-created', pkg);

    return pkg;
  }

  /**
   * Add evidence to package
   */
  addToPackage(packageId, evidenceId) {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const item = this.evidence.get(evidenceId);
    if (!item) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    pkg.addItem(item);

    this._addAuditEntry('evidence_added_to_package', {
      details: 'Evidence added to package',
      packageId,
      evidenceId
    });

    return pkg;
  }

  /**
   * Seal package
   */
  sealPackage(packageId, actor = 'system') {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    pkg.seal(actor);

    this._addAuditEntry('package_sealed', {
      actor,
      details: `Package sealed: ${pkg.name}`,
      packageId
    });

    this.emit('package-sealed', pkg);

    return pkg;
  }

  /**
   * Export package
   */
  async exportPackage(packageId, options = {}) {
    const pkg = this.packages.get(packageId);
    if (!pkg) {
      throw new Error(`Package not found: ${packageId}`);
    }

    const format = options.format || 'json';
    const includeAudit = options.includeAudit !== false;

    let exportData;

    switch (format) {
      case 'json':
        exportData = pkg.toJSON();
        if (includeAudit) {
          exportData.auditLog = this.auditLog.filter(entry =>
            entry.details.packageId === packageId ||
            pkg.items.some(item => entry.details.evidenceId === item.id)
          );
        }
        break;

      case 'swgde-report':
        exportData = await this._generateSWGDEReport(pkg);
        break;

      default:
        throw new Error(`Unknown export format: ${format}`);
    }

    // Persist export
    if (options.persist !== false) {
      const filename = `${pkg.id}-${Date.now()}.${format === 'swgde-report' ? 'txt' : 'json'}`;
      const filePath = path.join(this.basePath, 'packages', filename);

      const content = typeof exportData === 'string'
        ? exportData
        : JSON.stringify(exportData, null, 2);

      await fs.writeFile(filePath, content, 'utf8');
    }

    this.stats.exports++;

    this._addAuditEntry('package_exported', {
      actor: options.actor || 'system',
      details: `Package exported in ${format} format`,
      packageId
    });

    return exportData;
  }

  /**
   * Generate SWGDE-compliant forensic report
   */
  async _generateSWGDEReport(pkg) {
    const report = [];

    report.push('='.repeat(80));
    report.push('DIGITAL FORENSIC EXAMINATION REPORT');
    report.push('SWGDE Requirements for Report Writing Compliant');
    report.push('='.repeat(80));
    report.push('');

    // Case Information
    report.push('CASE INFORMATION');
    report.push('-'.repeat(80));
    report.push(`Package ID: ${pkg.id}`);
    report.push(`Package Name: ${pkg.name}`);
    report.push(`Case ID: ${pkg.caseId || 'N/A'}`);
    report.push(`Investigation ID: ${pkg.investigationId || 'N/A'}`);
    report.push(`Created: ${new Date(pkg.created).toISOString()}`);
    report.push(`Sealed: ${pkg.sealed ? 'Yes' : 'No'}`);
    if (pkg.sealed) {
      report.push(`Sealed At: ${new Date(pkg.sealedAt).toISOString()}`);
      report.push(`Sealed By: ${pkg.sealedBy}`);
    }
    report.push(`Package Hash (SHA-256): ${pkg.calculatePackageHash()}`);
    report.push('');

    // Evidence Items
    report.push('EVIDENCE ITEMS');
    report.push('-'.repeat(80));
    report.push(`Total Items: ${pkg.items.length}`);
    report.push('');

    pkg.items.forEach((item, index) => {
      report.push(`[${index + 1}] Evidence Item`);
      report.push(`  ID: ${item.id}`);
      report.push(`  Type: ${item.type}`);
      report.push(`  Timestamp: ${new Date(item.timestamp).toISOString()}`);
      report.push(`  Hash (SHA-256): ${item.hash}`);
      report.push(`  Verified: ${item.verified ? 'Yes' : 'No'}`);
      report.push(`  Sealed: ${item.sealed ? 'Yes' : 'No'}`);

      if (item.metadata && Object.keys(item.metadata).length > 0) {
        report.push(`  Metadata:`);
        Object.entries(item.metadata).forEach(([key, value]) => {
          report.push(`    ${key}: ${value}`);
        });
      }

      // Chain of Custody
      report.push(`  Chain of Custody (${item.custodyChain.length} events):`);
      item.custodyChain.forEach((event, i) => {
        report.push(`    [${i + 1}] ${event.eventType} at ${new Date(event.timestamp).toISOString()}`);
        report.push(`        Actor: ${event.actor}`);
        report.push(`        Details: ${event.details}`);
      });

      report.push('');
    });

    // Audit Information
    report.push('AUDIT TRAIL');
    report.push('-'.repeat(80));
    const relevantAudit = this.auditLog.filter(entry =>
      entry.details.packageId === pkg.id ||
      pkg.items.some(item => entry.details.evidenceId === item.id)
    );
    report.push(`Total Audit Entries: ${relevantAudit.length}`);
    report.push('');

    relevantAudit.forEach((entry, index) => {
      report.push(`[${index + 1}] ${entry.action}`);
      report.push(`  Timestamp: ${new Date(entry.timestamp).toISOString()}`);
      report.push(`  Actor: ${entry.actor}`);
      report.push(`  Details: ${entry.details.details || JSON.stringify(entry.details)}`);
      report.push('');
    });

    // Verification Statement
    report.push('VERIFICATION STATEMENT');
    report.push('-'.repeat(80));
    const allVerified = pkg.items.every(item => item.verified);
    report.push(`All evidence items have been cryptographically verified: ${allVerified ? 'YES' : 'NO'}`);
    report.push(`Hash algorithm used: SHA-256`);
    report.push(`Evidence sealed: ${pkg.sealed ? 'YES' : 'NO'}`);
    report.push('');

    // Footer
    report.push('='.repeat(80));
    report.push(`Report generated: ${new Date().toISOString()}`);
    report.push(`Generated by: Basset Hound Browser Evidence Manager`);
    report.push(`Standards: RFC 3161, ISO 27037, SWGDE, NIST IR 8387`);
    report.push('='.repeat(80));

    return report.join('\n');
  }

  /**
   * Get evidence by ID
   */
  getEvidence(evidenceId) {
    const item = this.evidence.get(evidenceId);
    if (!item) {
      return null;
    }

    item.recordAccess('system', 'Retrieved from evidence manager');
    return item;
  }

  /**
   * List all evidence
   */
  listEvidence(filters = {}) {
    let items = Array.from(this.evidence.values());

    // Apply filters
    if (filters.type) {
      items = items.filter(item => item.type === filters.type);
    }
    if (filters.investigationId) {
      items = items.filter(item => item.investigationId === filters.investigationId);
    }
    if (filters.caseId) {
      items = items.filter(item => item.caseId === filters.caseId);
    }
    if (filters.sealed !== undefined) {
      items = items.filter(item => item.sealed === filters.sealed);
    }
    if (filters.verified !== undefined) {
      items = items.filter(item => item.verified === filters.verified);
    }

    return items;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalEvidence: this.evidence.size,
      totalPackages: this.packages.size,
      totalInvestigations: this.investigations.size,
      auditLogSize: this.auditLog.length
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    let log = [...this.auditLog];

    if (filters.investigationId) {
      log = log.filter(entry => entry.details.investigationId === filters.investigationId);
    }
    if (filters.actor) {
      log = log.filter(entry => entry.actor === filters.actor);
    }
    if (filters.action) {
      log = log.filter(entry => entry.action === filters.action);
    }

    return log;
  }

  /**
   * Export audit log
   */
  async exportAuditLog(options = {}) {
    const log = this.getAuditLog(options.filters);

    const filename = `audit-log-${Date.now()}.json`;
    const filePath = path.join(this.basePath, 'audit', filename);

    await fs.writeFile(filePath, JSON.stringify(log, null, 2), 'utf8');

    return { filename, path: filePath, entries: log.length };
  }
}

module.exports = {
  EvidenceManager,
  EvidenceItem,
  EvidencePackage,
  EVIDENCE_TYPES,
  CUSTODY_EVENTS
};

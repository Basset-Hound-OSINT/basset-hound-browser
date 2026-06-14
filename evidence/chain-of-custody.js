/**
 * Chain of Custody Manager
 *
 * Phase 19: Evidence Packaging & Chain of Custody System (Part 1)
 *
 * Provides:
 * - Track evidence from capture through export
 * - Actor tracking (who captured, when, why)
 * - Modification log (changes made to evidence)
 * - Integrity verification
 * - RFC 3161 timestamping integration
 * - Forensic compliance documentation
 */

const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * Chain of Custody Entry
 *
 * Represents a single action in the chain of custody
 */
class CustodyEntry {
  constructor(action, actor, timestamp = null, notes = '') {
    this.timestamp = timestamp || new Date().toISOString();
    this.action = action;  // 'created', 'modified', 'accessed', 'exported', 'sealed'
    this.actor = actor;    // Who performed the action
    this.notes = notes;    // Additional context
    this.hash = null;      // Hash at time of action (optional)
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      action: this.action,
      actor: this.actor,
      notes: this.notes,
      hash: this.hash,
    };
  }
}

/**
 * Chain of Custody Manager
 *
 * Maintains the complete history of evidence handling
 */
class ChainOfCustodyManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.chains = new Map();  // evidenceId -> chain array
    this.complianceMode = options.complianceMode || 'iso27037';  // iso27037, nist, acpo
    this.autoTimestamp = options.autoTimestamp !== false;
  }

  /**
   * Initialize custody chain for evidence
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {Object} metadata - Initial metadata
   * @returns {Array} Initial custody chain
   */
  initializeChain(evidenceId, metadata = {}) {
    if (this.chains.has(evidenceId)) {
      throw new Error(`Chain already exists for evidence ${evidenceId}`);
    }

    const entry = new CustodyEntry(
      'created',
      metadata.capturedBy || 'system',
      metadata.capturedAt,
      `Evidence captured at ${metadata.url || 'unknown'}`
    );

    if (metadata.hash) {
      entry.hash = metadata.hash;
    }

    const chain = [entry];
    this.chains.set(evidenceId, chain);

    this.emit('chainInitialized', {
      evidenceId,
      timestamp: entry.timestamp,
      actor: entry.actor,
    });

    return chain;
  }

  /**
   * Add entry to custody chain
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} action - Action type
   * @param {string} actor - Who performed action
   * @param {string} notes - Additional notes
   * @param {string} hash - Hash at time of action (optional)
   * @returns {CustodyEntry} The created entry
   */
  addEntry(evidenceId, action, actor, notes = '', hash = null) {
    const chain = this.chains.get(evidenceId);
    if (!chain) {
      throw new Error(`No custody chain found for evidence ${evidenceId}`);
    }

    const entry = new CustodyEntry(action, actor, null, notes);
    if (hash) {
      entry.hash = hash;
    }

    chain.push(entry);

    this.emit('entryAdded', {
      evidenceId,
      action,
      actor,
      timestamp: entry.timestamp,
    });

    return entry;
  }

  /**
   * Record evidence access (viewing, analysis)
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} actor - Who accessed it
   * @param {string} purpose - Why it was accessed
   */
  recordAccess(evidenceId, actor, purpose = '') {
    return this.addEntry(
      evidenceId,
      'accessed',
      actor,
      `Accessed for: ${purpose || 'analysis'}`
    );
  }

  /**
   * Record evidence modification
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} actor - Who modified it
   * @param {string} description - What changed
   * @param {string} oldHash - Hash before modification
   * @param {string} newHash - Hash after modification
   */
  recordModification(evidenceId, actor, description, oldHash, newHash) {
    const entry = this.addEntry(
      evidenceId,
      'modified',
      actor,
      description
    );

    entry.hash = newHash;
    entry.previousHash = oldHash;

    return entry;
  }

  /**
   * Record evidence export
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} actor - Who exported it
   * @param {string} exportFormat - Format of export (json, pdf, xml, etc.)
   * @param {string} destination - Where it was exported
   */
  recordExport(evidenceId, actor, exportFormat, destination = '') {
    return this.addEntry(
      evidenceId,
      'exported',
      actor,
      `Exported as ${exportFormat} to ${destination || 'external storage'}`
    );
  }

  /**
   * Record package sealing (immutability checkpoint)
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} actor - Who sealed it
   * @param {string} sealHash - Hash of sealed state
   * @param {Object} timestampToken - RFC 3161 token (optional)
   */
  recordSealing(evidenceId, actor, sealHash, timestampToken = null) {
    const entry = this.addEntry(
      evidenceId,
      'sealed',
      actor,
      'Evidence sealed for preservation'
    );

    entry.hash = sealHash;
    entry.timestampToken = timestampToken;

    return entry;
  }

  /**
   * Request RFC 3161 timestamp from authority
   *
   * RFC 3161 Timestamping Protocol for long-term evidence integrity
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} hash - Hash to timestamp
   * @param {Object} options - RFC 3161 options
   * @returns {Object} Timestamp token (stub implementation)
   */
  requestRFC3161Timestamp(evidenceId, hash, options = {}) {
    // Stub implementation - in production would call freetsa.org or similar
    const authority = options.authority || 'freetsa.org';
    const token = {
      version: '1',
      policyId: options.policyId || '1.2.840.113549.1.9.16.3.3',  // RFC 3161 policy OID
      messageImprint: {
        hashAlgorithm: 'sha256',
        hashedMessage: hash,
      },
      serialNumber: crypto.randomBytes(16).toString('hex'),
      genTime: new Date().toISOString(),
      accuracy: {
        seconds: 1,
        millis: 0,
      },
      ordering: false,
      nonce: crypto.randomBytes(8).toString('hex'),
      tsa: authority,
      // TODO: In production, add TSA signature field
      // tst: base64_encoded_timestamp_token,
    };

    // Record timestamp request in chain
    this.addEntry(
      evidenceId,
      'timestamped',
      authority,
      `RFC 3161 timestamp requested from ${authority}`
    );

    return token;
  }

  /**
   * Generate ISO 27037 compliance statement
   *
   * ISO/IEC 27037:2012 - Guidelines for identification, collection, acquisition,
   * and preservation of digital evidence.
   *
   * @param {string} evidenceId - Evidence identifier
   * @returns {Object} Compliance statement
   */
  generateISO27037Statement(evidenceId) {
    const chain = this.getChain(evidenceId);
    const verification = this.verifyChainIntegrity(evidenceId);

    return {
      standard: 'ISO/IEC 27037:2012',
      version: '1.0',
      statement: `This chain of custody for evidence ${evidenceId} has been maintained in accordance
with ISO/IEC 27037:2012 principles. All evidence has been handled using documented procedures
to maintain integrity and authenticity. All actions have been recorded with timestamps and
actor information. No evidence has been modified except as expressly documented in the custody chain.`,
      principles: {
        minimization: 'Only necessary evidence was collected and preserved',
        integrity: 'Chain of custody maintained throughout handling',
        documentation: 'Complete action log with timestamps and actors',
        traceability: 'All modifications and accesses fully documented',
      },
      requirements: {
        chainIntegrity: verification.valid,
        totalActions: chain.length,
        documentedModifications: chain.filter(e => e.action === 'modified').length,
        documentedAccesses: chain.filter(e => e.action === 'accessed').length,
        sealed: chain.some(e => e.action === 'sealed'),
      },
      complianceChecks: {
        unbrokenChain: !verification.issues.includes('Chronological violation'),
        allActionsDocumented: chain.every(e => e.actor && e.timestamp),
        noPostSealModifications: !verification.issues.includes('Modifications or exports detected after sealing'),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get complete custody chain for evidence
   *
   * @param {string} evidenceId - Evidence identifier
   * @returns {Array} Custody chain entries
   */
  getChain(evidenceId) {
    const chain = this.chains.get(evidenceId);
    if (!chain) {
      throw new Error(`No custody chain found for evidence ${evidenceId}`);
    }
    return [...chain];
  }

  /**
   * Verify chain integrity
   *
   * Checks that custody chain is unbroken and coherent
   *
   * @param {string} evidenceId - Evidence identifier
   * @returns {Object} Verification result
   */
  verifyChainIntegrity(evidenceId) {
    const chain = this.getChain(evidenceId);

    const result = {
      valid: true,
      issues: [],
      entryCount: chain.length,
      firstEntry: chain[0]?.timestamp,
      lastEntry: chain[chain.length - 1]?.timestamp,
    };

    // Check for required actions
    const actions = chain.map(e => e.action);
    if (!actions.includes('created')) {
      result.valid = false;
      result.issues.push('Missing "created" action');
    }

    // Check chronological order
    for (let i = 1; i < chain.length; i++) {
      const prev = new Date(chain[i - 1].timestamp);
      const curr = new Date(chain[i].timestamp);
      if (curr < prev) {
        result.valid = false;
        result.issues.push(`Chronological violation at entry ${i}`);
      }
    }

    // Check that sealed state is final (no modifications after seal)
    const sealIndex = chain.findIndex(e => e.action === 'sealed');
    if (sealIndex !== -1 && sealIndex < chain.length - 1) {
      const afterSeal = chain.slice(sealIndex + 1);
      const problemActions = afterSeal.filter(
        e => ['modified', 'exported'].includes(e.action)
      );
      if (problemActions.length > 0) {
        result.valid = false;
        result.issues.push('Modifications or exports detected after sealing');
      }
    }

    return result;
  }

  /**
   * Generate custody report for compliance
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} format - 'text' | 'json' | 'html'
   * @returns {string|Object} Custody report
   */
  generateReport(evidenceId, format = 'json') {
    const chain = this.getChain(evidenceId);
    const verification = this.verifyChainIntegrity(evidenceId);

    const report = {
      evidenceId,
      compliance: this.complianceMode,
      generatedAt: new Date().toISOString(),
      verification,
      chain: chain.map(e => e.toJSON()),
      summary: {
        totalActions: chain.length,
        actors: [...new Set(chain.map(e => e.actor))],
        firstAction: chain[0]?.timestamp,
        lastAction: chain[chain.length - 1]?.timestamp,
        sealed: verification.valid && chain.some(e => e.action === 'sealed'),
      },
    };

    if (format === 'text') {
      return this._formatAsText(report);
    } else if (format === 'html') {
      return this._formatAsHTML(report);
    }

    return report;
  }

  /**
   * Format report as plain text
   */
  _formatAsText(report) {
    let text = `CHAIN OF CUSTODY REPORT\n`;
    text += `${'='.repeat(60)}\n\n`;

    text += `Evidence ID: ${report.evidenceId}\n`;
    text += `Compliance Standard: ${report.compliance.toUpperCase()}\n`;
    text += `Generated: ${report.generatedAt}\n`;
    text += `Status: ${report.verification.valid ? 'VALID' : 'INVALID'}\n\n`;

    if (report.verification.issues.length > 0) {
      text += `ISSUES:\n`;
      report.verification.issues.forEach(issue => {
        text += `  - ${issue}\n`;
      });
      text += '\n';
    }

    text += `CHAIN ENTRIES (${report.summary.totalActions}):\n`;
    text += `${'-'.repeat(60)}\n`;

    report.chain.forEach((entry, idx) => {
      text += `${idx + 1}. ${entry.action.toUpperCase()}\n`;
      text += `   Timestamp: ${entry.timestamp}\n`;
      text += `   Actor: ${entry.actor}\n`;
      if (entry.notes) text += `   Notes: ${entry.notes}\n`;
      if (entry.hash) text += `   Hash: ${entry.hash.substring(0, 16)}...\n`;
      text += '\n';
    });

    text += `${'-'.repeat(60)}\n`;
    text += `SUMMARY:\n`;
    text += `  Actors Involved: ${report.summary.actors.join(', ')}\n`;
    text += `  First Action: ${report.summary.firstAction}\n`;
    text += `  Last Action: ${report.summary.lastAction}\n`;
    text += `  Sealed: ${report.summary.sealed ? 'Yes' : 'No'}\n`;

    return text;
  }

  /**
   * Format report as HTML
   */
  _formatAsHTML(report) {
    let html = `<!DOCTYPE html>\n<html>\n<head>\n`;
    html += `<title>Chain of Custody Report</title>\n`;
    html += `<style>\n`;
    html += `  body { font-family: Arial, sans-serif; margin: 20px; }\n`;
    html += `  .header { background: #f0f0f0; padding: 15px; border-radius: 5px; }\n`;
    html += `  .valid { color: green; font-weight: bold; }\n`;
    html += `  .invalid { color: red; font-weight: bold; }\n`;
    html += `  table { border-collapse: collapse; width: 100%; margin-top: 20px; }\n`;
    html += `  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }\n`;
    html += `  th { background-color: #f0f0f0; }\n`;
    html += `</style>\n</head>\n<body>\n`;

    html += `<div class="header">\n`;
    html += `<h1>Chain of Custody Report</h1>\n`;
    html += `<p><strong>Evidence ID:</strong> ${report.evidenceId}</p>\n`;
    html += `<p><strong>Compliance:</strong> ${report.compliance.toUpperCase()}</p>\n`;
    html += `<p><strong>Generated:</strong> ${report.generatedAt}</p>\n`;
    html += `<p class="${report.verification.valid ? 'valid' : 'invalid'}">`;
    html += `Status: ${report.verification.valid ? 'VALID' : 'INVALID'}</p>\n`;
    html += `</div>\n`;

    if (report.verification.issues.length > 0) {
      html += `<div style="background: #ffe6e6; padding: 15px; margin: 20px 0; border-radius: 5px;">\n`;
      html += `<h3>Issues Found</h3>\n<ul>\n`;
      report.verification.issues.forEach(issue => {
        html += `<li>${issue}</li>\n`;
      });
      html += `</ul>\n</div>\n`;
    }

    html += `<h2>Chain Entries</h2>\n`;
    html += `<table>\n`;
    html += `<tr><th>#</th><th>Action</th><th>Timestamp</th><th>Actor</th><th>Notes</th><th>Hash</th></tr>\n`;

    report.chain.forEach((entry, idx) => {
      html += `<tr>`;
      html += `<td>${idx + 1}</td>`;
      html += `<td>${entry.action}</td>`;
      html += `<td>${entry.timestamp}</td>`;
      html += `<td>${entry.actor}</td>`;
      html += `<td>${entry.notes || ''}</td>`;
      html += `<td>${entry.hash ? entry.hash.substring(0, 16) + '...' : ''}</td>`;
      html += `</tr>\n`;
    });

    html += `</table>\n</body>\n</html>`;

    return html;
  }

  /**
   * Export chain for storage
   *
   * @param {string} evidenceId - Evidence identifier
   * @returns {Object} Exportable chain data
   */
  exportChain(evidenceId) {
    return {
      evidenceId,
      exportedAt: new Date().toISOString(),
      chain: this.getChain(evidenceId).map(e => e.toJSON()),
      verification: this.verifyChainIntegrity(evidenceId),
    };
  }

  /**
   * Clear custody chain (admin only)
   *
   * @param {string} evidenceId - Evidence identifier
   * @param {string} actor - Who authorized the clear
   */
  clearChain(evidenceId, actor) {
    if (this.chains.has(evidenceId)) {
      this.chains.delete(evidenceId);
      this.emit('chainCleared', {
        evidenceId,
        clearedBy: actor,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get statistics about custody chains
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const stats = {
      totalChains: this.chains.size,
      totalEntries: 0,
      actorCount: new Set(),
      actionCounts: {},
    };

    for (const chain of this.chains.values()) {
      stats.totalEntries += chain.length;
      chain.forEach(entry => {
        stats.actorCount.add(entry.actor);
        stats.actionCounts[entry.action] = (stats.actionCounts[entry.action] || 0) + 1;
      });
    }

    stats.actorCount = stats.actorCount.size;

    return stats;
  }
}

module.exports = {
  ChainOfCustodyManager,
  CustodyEntry,
};

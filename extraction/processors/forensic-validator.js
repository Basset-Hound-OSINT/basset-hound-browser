/**
 * Forensic Validation Module
 * Responsibility: Validate extraction integrity for forensic compliance
 * - Chain of custody validation
 * - Hash verification
 * - Timestamp validation
 * - Evidence integrity checks
 *
 * This module is part of Extraction Manager refactoring to reduce monolithic complexity
 * Extracted from: extraction/manager.js
 */

const crypto = require('crypto');

class ForensicValidator {
  constructor(logger = console) {
    this.logger = logger;
  }

  /**
   * Validate extraction chain of custody
   * @param {Object} extraction - Extraction data with metadata
   * @returns {Object} Validation result
   */
  validateChainOfCustody(extraction) {
    try {
      const validations = {
        hasTimestamp: !!extraction.timestamp,
        hasCollector: !!extraction.collectorId,
        hasHash: !!extraction.hash,
        timestampValid: this._validateTimestamp(extraction.timestamp),
        hashConsistent: extraction.hash === this._computeHash(extraction.content)
      };

      return {
        valid: Object.values(validations).every(v => v),
        validations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Chain of custody validation failed', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Compute hash of content for integrity verification
   * @param {string} content - Content to hash
   * @returns {string} SHA-256 hash
   */
  computeContentHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate extraction completeness
   * @param {Object} extraction - Extraction data
   * @returns {Object} Completeness check
   */
  validateCompleteness(extraction) {
    const required = ['timestamp', 'content', 'source', 'collectorId'];
    const missing = required.filter(field => !extraction[field]);

    return {
      complete: missing.length === 0,
      missing,
      score: ((required.length - missing.length) / required.length) * 100
    };
  }

  /**
   * Generate evidence certificate
   * @param {Object} extraction - Extraction data
   * @returns {Object} Evidence certificate
   */
  generateCertificate(extraction) {
    const hash = this.computeContentHash(extraction.content);
    const completeness = this.validateCompleteness(extraction);

    return {
      certificateId: crypto.randomBytes(16).toString('hex'),
      timestamp: new Date().toISOString(),
      sourceUrl: extraction.source,
      contentHash: hash,
      hashAlgorithm: 'SHA-256',
      collector: extraction.collectorId,
      completeness: completeness.score,
      verified: completeness.complete,
      chainOfCustodyValid: this.validateChainOfCustody(extraction).valid
    };
  }

  /**
   * Verify certificate validity
   * @param {Object} certificate - Evidence certificate
   * @param {string} content - Content to verify
   * @returns {boolean} Certificate valid
   */
  verifyCertificate(certificate, content) {
    const computedHash = this.computeContentHash(content);
    return certificate.contentHash === computedHash;
  }

  // Private helper methods
  _validateTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) && date < new Date();
    } catch {
      return false;
    }
  }

  _computeHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

module.exports = { ForensicValidator };

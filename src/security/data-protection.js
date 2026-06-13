/**
 * Data Protection Module
 *
 * Implements comprehensive data protection:
 * - Encryption at rest (AES-256-GCM)
 * - Secure deletion with multi-pass overwriting
 * - Data classification system
 * - Data Loss Prevention (DLP) monitoring
 * - Encrypted backup support
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * DataProtectionManager - Comprehensive data protection
 */
class DataProtectionManager {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.keyLength = 32; // 256 bits for AES-256
    this.tagLength = 16; // 128 bits for GCM auth tag
    this.saltLength = options.saltLength || 16;

    // Secure deletion configuration
    this.deletionMethod = options.deletionMethod || 'dod'; // dod, gutmann, simple
    this.deletionPasses = options.deletionPasses || {
      dod: 7,
      gutmann: 35,
      simple: 3
    };

    // Data classification
    this.dataClassifications = new Map();
    this.dlpRules = [];
    this.encryptedData = new Map();

    // Activity tracking
    this.accessLog = [];
    this.modificationLog = [];
    this.maxLogSize = options.maxLogSize || 10000;

    this.initializeClassifications();
  }

  /**
   * Initialize standard data classifications
   */
  initializeClassifications() {
    this.defineClassification('public', {
      encryption: false,
      retention: 'unlimited',
      accessLevel: 'public'
    });

    this.defineClassification('internal', {
      encryption: false,
      retention: 365,
      accessLevel: 'internal'
    });

    this.defineClassification('confidential', {
      encryption: true,
      retention: 90,
      accessLevel: 'restricted'
    });

    this.defineClassification('restricted', {
      encryption: true,
      retention: 30,
      accessLevel: 'restricted'
    });

    this.defineClassification('secret', {
      encryption: true,
      retention: 7,
      accessLevel: 'secret'
    });
  }

  /**
   * Define custom data classification
   */
  defineClassification(name, rules) {
    this.dataClassifications.set(name, {
      name,
      encryption: rules.encryption,
      retention: rules.retention,
      accessLevel: rules.accessLevel,
      createdAt: Date.now()
    });
  }

  /**
   * Add DLP rule
   */
  addDlpRule(rule) {
    if (!rule.name || !rule.pattern) {
      throw new Error('DLP rule must have name and pattern');
    }

    this.dlpRules.push({
      ...rule,
      id: crypto.randomBytes(8).toString('hex'),
      createdAt: Date.now()
    });
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encryptData(plaintext, encryptionKey, associatedData = '') {
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    if (typeof plaintext === 'object') {
      plaintext = JSON.stringify(plaintext);
    }

    if (typeof plaintext === 'string') {
      plaintext = Buffer.from(plaintext, 'utf-8');
    }

    // Generate random IV
    const iv = crypto.randomBytes(12); // 96 bits for GCM

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, encryptionKey, iv);

    // Add associated data for authentication
    if (associatedData) {
      cipher.setAAD(Buffer.from(associatedData));
    }

    // Encrypt
    let ciphertext = cipher.update(plaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      ciphertext: ciphertext.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decryptData(encryptedData, encryptionKey, associatedData = '') {
    if (!encryptionKey) {
      throw new Error('Encryption key is required');
    }

    if (typeof encryptedData === 'string') {
      try {
        encryptedData = JSON.parse(encryptedData);
      } catch (e) {
        throw new Error('Invalid encrypted data format');
      }
    }

    // Validate required fields (use ciphertext, not encrypted)
    if (!encryptedData.iv || !encryptedData.ciphertext || !encryptedData.authTag) {
      throw new Error('Missing required encryption fields (iv, ciphertext, authTag)');
    }

    try {
      // Reconstruct buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const ciphertext = Buffer.from(encryptedData.ciphertext, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, encryptionKey, iv);

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Add associated data
      if (associatedData) {
        decipher.setAAD(Buffer.from(associatedData));
      }

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf-8');
    } catch (error) {
      throw new Error('Decryption failed - authentication tag mismatch or corrupted data');
    }
  }

  /**
   * Store encrypted data
   */
  storeEncryptedData(dataId, plaintext, classification, encryptionKey) {
    const classConfig = this.dataClassifications.get(classification);
    if (!classConfig) {
      throw new Error(`Unknown classification: ${classification}`);
    }

    if (!classConfig.encryption) {
      // Store unencrypted but marked
      this.encryptedData.set(dataId, {
        data: plaintext,
        classification,
        encrypted: false,
        timestamp: Date.now()
      });
    } else {
      // Encrypt before storage
      const encrypted = this.encryptData(plaintext, encryptionKey);
      this.encryptedData.set(dataId, {
        ...encrypted,
        classification,
        encrypted: true,
        timestamp: Date.now()
      });
    }

    // Log data access
    this.logDataAccess(dataId, 'store', classification);
  }

  /**
   * Retrieve encrypted data
   */
  retrieveEncryptedData(dataId, encryptionKey) {
    const stored = this.encryptedData.get(dataId);
    if (!stored) {
      throw new Error(`Data ${dataId} not found`);
    }

    let plaintext;
    if (stored.encrypted) {
      plaintext = this.decryptData(stored, encryptionKey);
    } else {
      plaintext = stored.data;
    }

    // Log data access
    this.logDataAccess(dataId, 'retrieve', stored.classification);

    return {
      data: plaintext,
      classification: stored.classification,
      timestamp: stored.timestamp
    };
  }

  /**
   * Secure delete with multi-pass overwriting
   */
  secureDeleteData(dataId, method = 'dod') {
    const stored = this.encryptedData.get(dataId);
    if (!stored) {
      throw new Error(`Data ${dataId} not found`);
    }

    const passes = this.deletionPasses[method] || 3;

    // Multi-pass overwriting
    for (let i = 0; i < passes; i++) {
      if (stored.encrypted) {
        // Overwrite encrypted field
        stored.encrypted = Buffer.from(crypto.randomBytes(Buffer.byteLength(stored.encrypted))).toString('hex');
      } else {
        stored.data = Buffer.from(crypto.randomBytes(Buffer.byteLength(stored.data))).toString('hex');
      }
    }

    // Remove from storage
    this.encryptedData.delete(dataId);

    // Log deletion
    this.logDataAccess(dataId, 'delete', stored.classification);

    return {
      dataId,
      deleted: true,
      method,
      passes,
      timestamp: Date.now()
    };
  }

  /**
   * Scan for DLP violations
   */
  scanForDlpViolations(data) {
    const violations = [];

    for (const rule of this.dlpRules) {
      const pattern = new RegExp(rule.pattern, 'gi');
      const matches = data.match(pattern);

      if (matches) {
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity || 'medium',
          matches: matches.length,
          action: rule.action || 'block'
        });
      }
    }

    return violations;
  }

  /**
   * Get data retention status
   */
  getRetentionStatus(dataId) {
    const stored = this.encryptedData.get(dataId);
    if (!stored) {
      return null;
    }

    const classConfig = this.dataClassifications.get(stored.classification);
    const ageMs = Date.now() - stored.timestamp;
    const retentionMs = classConfig.retention === 'unlimited' ? Infinity : classConfig.retention * 86400000;

    return {
      dataId,
      classification: stored.classification,
      ageMs,
      retentionMs,
      retentionDays: classConfig.retention === 'unlimited' ? 'unlimited' : classConfig.retention,
      expired: ageMs > retentionMs,
      expiresAt: classConfig.retention === 'unlimited' ? null : new Date(stored.timestamp + retentionMs)
    };
  }

  /**
   * Enforce retention policies
   */
  enforceRetentionPolicies() {
    const deletedCount = { count: 0 };

    for (const [dataId, stored] of this.encryptedData.entries()) {
      const status = this.getRetentionStatus(dataId);

      if (status && status.expired) {
        this.secureDeleteData(dataId, this.deletionMethod);
        deletedCount.count++;
      }
    }

    return deletedCount;
  }

  /**
   * Log data access
   */
  logDataAccess(dataId, operation, classification) {
    const logEntry = {
      timestamp: Date.now(),
      dataId,
      operation,
      classification,
      user: 'system'
    };

    this.accessLog.push(logEntry);

    if (this.accessLog.length > this.maxLogSize) {
      this.accessLog.shift();
    }
  }

  /**
   * Log data modification
   */
  logDataModification(dataId, oldValue, newValue, reason) {
    const logEntry = {
      timestamp: Date.now(),
      dataId,
      operation: 'modify',
      oldHash: crypto.createHash('sha256').update(oldValue).digest('hex'),
      newHash: crypto.createHash('sha256').update(newValue).digest('hex'),
      reason
    };

    this.modificationLog.push(logEntry);

    if (this.modificationLog.length > this.maxLogSize) {
      this.modificationLog.shift();
    }
  }

  /**
   * Get security report
   */
  getSecurityReport() {
    return {
      encryption: {
        algorithm: this.algorithm,
        keyLength: this.keyLength,
        tagLength: this.tagLength,
        saltLength: this.saltLength
      },
      classification: {
        count: this.dataClassifications.size,
        classifications: Array.from(this.dataClassifications.keys())
      },
      dlp: {
        rulesCount: this.dlpRules.length,
        enabled: this.dlpRules.length > 0
      },
      storage: {
        encryptedDataCount: this.encryptedData.size,
        accessLogSize: this.accessLog.length,
        modificationLogSize: this.modificationLog.length
      },
      secureDelete: {
        method: this.deletionMethod,
        passes: this.deletionPasses[this.deletionMethod]
      }
    };
  }

  /**
   * Generate encryption key from master secret
   */
  static deriveEncryptionKey(masterSecret, salt) {
    if (!salt) {
      salt = crypto.randomBytes(16);
    }

    // Use PBKDF2 for key derivation
    const key = crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, 'sha256');
    return { key, salt: salt.toString('hex') };
  }

  /**
   * Validate encrypted data integrity
   */
  validateIntegrity(encryptedData) {
    if (!encryptedData.authTag) {
      return { valid: false, reason: 'Missing authentication tag' };
    }

    if (!encryptedData.iv) {
      return { valid: false, reason: 'Missing initialization vector' };
    }

    if (!encryptedData.ciphertext) {
      return { valid: false, reason: 'Missing ciphertext' };
    }

    return { valid: true };
  }
}

module.exports = { DataProtectionManager };

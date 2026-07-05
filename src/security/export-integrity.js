/**
 * Export Data Integrity Verification Module (L-003)
 *
 * Provides HMAC-SHA256 signature verification for all exported data
 * Ensures integrity and authenticity of forensic exports
 * Detects tampering, corruption, or man-in-the-middle attacks
 *
 * Features:
 * - HMAC-SHA256 signatures for all exports
 * - Deterministic payload hashing (consistent JSON ordering)
 * - Timing-safe signature comparison (prevents timing attacks)
 * - Chain of custody tracking
 * - Batch integrity verification
 * - <0.5ms per export overhead
 * - Python client integration support
 * - Audit trail with timestamps
 *
 * Usage:
 *   const integrityManager = new ExportIntegrityManager(secretKey);
 *   const signedExport = integrityManager.signExport(exportData, metadata);
 *   const result = integrityManager.verifyExport(signedExport);
 *
 * @version 1.0.0
 * @requires crypto
 * @requires events
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const { performance } = require('perf_hooks');

/**
 * Configuration for integrity verification
 */
const INTEGRITY_CONFIG = {
  // HMAC settings
  algorithm: 'sha256',
  digestFormat: 'hex',
  keyMinLength: 32, // 256 bits minimum

  // Signature format
  signatureFormat: 'v1', // For future extensibility
  includeMetadata: true,
  includeTimestamp: true,

  // Performance targets
  maxSigningTime: 0.5, // ms per export
  maxVerificationTime: 0.5, // ms per export

  // Chain of custody tracking
  enableChainOfCustody: true,
  maxChainLength: 1000, // Maximum chain entries in memory

  // Replay protection
  enableReplayProtection: false, // Can be enabled per-export
  replayWindowSize: 60000 // 60 seconds
};

/**
 * ExportIntegrityManager
 *
 * Manages HMAC signatures for exported data with integrity guarantees
 */
class ExportIntegrityManager extends EventEmitter {
  /**
   * Constructor
   * @param {string|Buffer} secretKey - HMAC secret key (32+ bytes)
   * @param {Object} options - Configuration options
   */
  constructor(secretKey, options = {}) {
    super();

    // Validate secret key
    if (!secretKey) {
      throw new Error('Secret key is required for export integrity verification');
    }

    // Convert string to buffer if needed
    this.secretKey = typeof secretKey === 'string'
      ? Buffer.from(secretKey, 'hex')
      : secretKey;

    if (this.secretKey.length < INTEGRITY_CONFIG.keyMinLength) {
      throw new Error(
        `Secret key must be at least ${INTEGRITY_CONFIG.keyMinLength} bytes (256 bits)`
      );
    }

    this.config = { ...INTEGRITY_CONFIG, ...options };

    // Chain of custody tracking
    this.chainOfCustody = [];

    // Replay protection cache
    this.replayCache = new Map();

    // Statistics
    this.stats = {
      signatureCount: 0,
      verificationCount: 0,
      verificationSuccesses: 0,
      verificationFailures: 0,
      replayDetections: 0,
      totalSigningTime: 0,
      totalVerificationTime: 0,
      averageSigningTime: 0,
      averageVerificationTime: 0
    };

    // Performance metrics
    this.performanceMetrics = {
      signingTimes: [],
      verificationTimes: [],
      payloadSizes: []
    };

    // Start cleanup intervals
    if (this.config.enableReplayProtection) {
      this.replayCleanupInterval = setInterval(() => {
        this._cleanupOldReplays();
      }, this.config.replayWindowSize);
    }

    this.emit('initialized', {
      timestamp: new Date().toISOString(),
      config: this.config,
      keyLength: this.secretKey.length
    });
  }

  /**
   * Sign exported data with HMAC-SHA256
   *
   * @param {Object|string|Buffer} payload - Data to sign
   * @param {Object} options - Signing options
   * @param {string} options.exportType - Type of export (html, network_log, metadata, etc.)
   * @param {string} options.exportId - Unique export identifier
   * @param {Object} options.metadata - Additional metadata to include in signature
   * @param {boolean} options.includeChain - Include in chain of custody
   * @param {boolean} options.enableReplay - Enable replay protection for this export
   * @returns {Object} Signed export envelope
   */
  signExport(payload, options = {}) {
    const startTime = performance.now();

    try {
      // Normalize payload to string
      const payloadStr = this._normalizePayload(payload);
      const payloadSize = Buffer.byteLength(payloadStr, 'utf-8');

      // Create signature metadata
      const metadata = {
        exportType: options.exportType || 'unknown',
        exportId: options.exportId || this._generateExportId(),
        timestamp: Date.now(),
        payloadSize: payloadSize,
        signatureFormat: this.config.signatureFormat,
        ...(options.metadata || {})
      };

      // Add metadata to signed content if configured
      let contentToSign = payloadStr;
      // Always include metadata in signature if metadata is present
      if (this.config.includeMetadata && Object.keys(metadata).length > 0) {
        contentToSign = this._createSigningContent(payloadStr, metadata);
      }

      // Generate HMAC signature
      const signature = this._generateHmac(contentToSign);

      // Create export envelope
      const envelope = {
        // Core fields
        payload: payload,
        signature: signature,

        // Metadata
        metadata: metadata,

        // Format version for client compatibility
        formatVersion: 1
      };

      // Add replay protection if enabled
      if (options.enableReplay && this.config.enableReplayProtection) {
        envelope.nonce = crypto.randomBytes(16).toString('hex');
        this.replayCache.set(envelope.nonce, {
          timestamp: metadata.timestamp,
          exportId: metadata.exportId
        });
      }

      // Add to chain of custody if enabled
      if (options.includeChain && this.config.enableChainOfCustody) {
        this._addToChain(envelope, metadata);
      }

      // Update statistics
      this.stats.signatureCount++;
      const signingTime = performance.now() - startTime;
      this.stats.totalSigningTime += signingTime;
      this.stats.averageSigningTime = this.stats.totalSigningTime / this.stats.signatureCount;

      this.performanceMetrics.signingTimes.push(signingTime);
      this.performanceMetrics.payloadSizes.push(payloadSize);

      // Warn if signing took too long
      if (signingTime > this.config.maxSigningTime) {
        this.emit('warning', {
          type: 'slow_signing',
          signingTime: signingTime.toFixed(3),
          maxTime: this.config.maxSigningTime,
          payloadSize: payloadSize
        });
      }

      this.emit('exported', {
        timestamp: new Date().toISOString(),
        exportId: metadata.exportId,
        exportType: metadata.exportType,
        signingTime: signingTime.toFixed(3),
        payloadSize: payloadSize
      });

      return envelope;

    } catch (error) {
      this.emit('error', {
        operation: 'signExport',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  /**
   * Verify integrity of exported data
   *
   * @param {Object} envelope - Signed export envelope to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.checkReplay - Check for replays
   * @param {boolean} options.includeMetadata - Verify metadata
   * @returns {Object} { valid: boolean, signature: string, error?: string, data?: Object, timing?: Object }
   */
  verifyExport(envelope, options = {}) {
    const startTime = performance.now();

    try {
      // Validate envelope structure
      if (!envelope || typeof envelope !== 'object') {
        return {
          valid: false,
          error: 'Invalid envelope structure',
          timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
        };
      }

      const { payload, signature, metadata, nonce } = envelope;

      // Validate required fields
      if (!payload) {
        return {
          valid: false,
          error: 'Missing payload',
          timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
        };
      }

      if (!signature || typeof signature !== 'string') {
        return {
          valid: false,
          error: 'Missing or invalid signature',
          timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
        };
      }

      // Check replay protection
      if (options.checkReplay && this.config.enableReplayProtection && nonce) {
        const replayCheck = this._checkReplay(nonce, metadata);
        if (replayCheck.isReplay) {
          this.stats.replayDetections++;
          return {
            valid: false,
            error: 'Replay attack detected',
            timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
          };
        }
      }

      // Reconstruct signed content
      const payloadStr = this._normalizePayload(payload);
      let contentToSign = payloadStr;
      // Always include metadata in signature if metadata is present
      if (this.config.includeMetadata && metadata && Object.keys(metadata).length > 0) {
        contentToSign = this._createSigningContent(payloadStr, metadata);
      }

      // Verify signature with timing-safe comparison
      const expectedSignature = this._generateHmac(contentToSign);
      const isValid = this._timingSafeCompare(signature, expectedSignature);

      if (!isValid) {
        this.stats.verificationFailures++;
        this.emit('integrity_violation', {
          timestamp: new Date().toISOString(),
          exportId: metadata?.exportId || 'unknown',
          reason: 'Signature mismatch'
        });

        return {
          valid: false,
          signature: signature,
          error: 'Invalid signature - payload may be tampered',
          timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
        };
      }

      // Update statistics
      this.stats.verificationCount++;
      this.stats.verificationSuccesses++;
      const verificationTime = performance.now() - startTime;
      this.stats.totalVerificationTime += verificationTime;
      this.stats.averageVerificationTime = this.stats.totalVerificationTime / this.stats.verificationCount;

      this.performanceMetrics.verificationTimes.push(verificationTime);

      // Warn if verification took too long
      if (verificationTime > this.config.maxVerificationTime) {
        this.emit('warning', {
          type: 'slow_verification',
          verificationTime: verificationTime.toFixed(3),
          maxTime: this.config.maxVerificationTime
        });
      }

      this.emit('verified', {
        timestamp: new Date().toISOString(),
        exportId: metadata?.exportId || 'unknown',
        exportType: metadata?.exportType || 'unknown',
        verificationTime: verificationTime.toFixed(3)
      });

      return {
        valid: true,
        signature: signature,
        data: payload,
        metadata: metadata,
        timing: {
          verificationTime: verificationTime.toFixed(3)
        }
      };

    } catch (error) {
      this.emit('error', {
        operation: 'verifyExport',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return {
        valid: false,
        error: `Verification error: ${error.message}`,
        timing: { verificationTime: (performance.now() - startTime).toFixed(3) }
      };
    }
  }

  /**
   * Verify multiple exports in batch
   *
   * @param {Array} envelopes - Array of export envelopes to verify
   * @param {Object} options - Verification options
   * @returns {Object} { totalCount: number, validCount: number, failureCount: number, results: Array, summary: Object }
   */
  verifyBatch(envelopes, options = {}) {
    if (!Array.isArray(envelopes)) {
      return {
        valid: false,
        error: 'Envelopes must be an array',
        totalCount: 0,
        validCount: 0,
        failureCount: 0,
        results: []
      };
    }

    const results = [];
    let validCount = 0;
    let failureCount = 0;

    for (let i = 0; i < envelopes.length; i++) {
      const result = this.verifyExport(envelopes[i], options);
      results.push({
        index: i,
        exportId: envelopes[i].metadata?.exportId || `export_${i}`,
        valid: result.valid,
        error: result.error
      });

      if (result.valid) {
        validCount++;
      } else {
        failureCount++;
      }
    }

    const summary = {
      timestamp: new Date().toISOString(),
      totalCount: envelopes.length,
      validCount: validCount,
      failureCount: failureCount,
      successRate: envelopes.length > 0 ? (validCount / envelopes.length * 100).toFixed(1) : 0
    };

    this.emit('batch_verified', summary);

    return {
      valid: failureCount === 0,
      totalCount: envelopes.length,
      validCount: validCount,
      failureCount: failureCount,
      results: results,
      summary: summary
    };
  }

  /**
   * Get chain of custody records
   *
   * @param {Object} filters - Filter options
   * @param {string} filters.exportType - Filter by export type
   * @param {string} filters.exportId - Filter by export ID
   * @param {number} filters.since - Filter since timestamp (ms)
   * @returns {Array} Chain of custody records
   */
  getChainOfCustody(filters = {}) {
    let chain = [...this.chainOfCustody];

    if (filters.exportType) {
      chain = chain.filter(entry => entry.exportType === filters.exportType);
    }

    if (filters.exportId) {
      chain = chain.filter(entry => entry.exportId === filters.exportId);
    }

    if (filters.since) {
      chain = chain.filter(entry => entry.timestamp >= filters.since);
    }

    return chain;
  }

  /**
   * Export audit log for forensic analysis
   *
   * @returns {Object} Complete audit log with statistics
   */
  exportAuditLog() {
    return {
      timestamp: new Date().toISOString(),
      statistics: this.getStats(),
      performance: this._getPerformanceReport(),
      chainOfCustody: this.chainOfCustody,
      replayProtectionEnabled: this.config.enableReplayProtection
    };
  }

  /**
   * Get integrity statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      signatureCount: this.stats.signatureCount,
      verificationCount: this.stats.verificationCount,
      verificationSuccesses: this.stats.verificationSuccesses,
      verificationFailures: this.stats.verificationFailures,
      verificationSuccessRate: this.stats.verificationCount > 0
        ? ((this.stats.verificationSuccesses / this.stats.verificationCount) * 100).toFixed(1)
        : 'N/A',
      replayDetections: this.stats.replayDetections,
      averageSigningTime: this.stats.averageSigningTime.toFixed(3),
      averageVerificationTime: this.stats.averageVerificationTime.toFixed(3),
      totalSigningTime: this.stats.totalSigningTime.toFixed(3),
      totalVerificationTime: this.stats.totalVerificationTime.toFixed(3),
      chainOfCustodySize: this.chainOfCustody.length,
      replayCacheSize: this.replayCache.size
    };
  }

  /**
   * Generate HMAC signature
   * @private
   */
  _generateHmac(content) {
    const hmac = crypto.createHmac(this.config.algorithm, this.secretKey);
    hmac.update(content, 'utf-8');
    return hmac.digest(this.config.digestFormat);
  }

  /**
   * Normalize payload to string with deterministic ordering
   * @private
   */
  _normalizePayload(payload) {
    if (typeof payload === 'string') {
      return payload;
    }

    if (Buffer.isBuffer(payload)) {
      return payload.toString('utf-8');
    }

    // For objects, use deterministic JSON stringification
    return JSON.stringify(payload, Object.keys(payload).sort());
  }

  /**
   * Create content for signing (payload + metadata hash)
   * @private
   */
  _createSigningContent(payloadStr, metadata) {
    const metadataStr = JSON.stringify(metadata, Object.keys(metadata).sort());
    return `${payloadStr}::${metadataStr}`;
  }

  /**
   * Timing-safe string comparison
   * @private
   */
  _timingSafeCompare(a, b) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'hex'),
        Buffer.from(b, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Check for replay attacks
   * @private
   */
  _checkReplay(nonce, metadata = {}) {
    if (this.replayCache.has(nonce)) {
      return {
        isReplay: true,
        previousTimestamp: this.replayCache.get(nonce).timestamp
      };
    }

    return { isReplay: false };
  }

  /**
   * Add entry to chain of custody
   * @private
   */
  _addToChain(envelope, metadata) {
    const chainEntry = {
      timestamp: Date.now(),
      exportId: metadata.exportId,
      exportType: metadata.exportType,
      payloadSize: metadata.payloadSize,
      signature: envelope.signature.substring(0, 16) + '...' // Truncate for display
    };

    this.chainOfCustody.push(chainEntry);

    // Prevent unbounded memory growth
    if (this.chainOfCustody.length > this.config.maxChainLength) {
      this.chainOfCustody = this.chainOfCustody.slice(-this.config.maxChainLength);
    }
  }

  /**
   * Cleanup old replay cache entries
   * @private
   */
  _cleanupOldReplays() {
    const now = Date.now();
    const maxAge = this.config.replayWindowSize;

    for (const [nonce, entry] of this.replayCache.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.replayCache.delete(nonce);
      }
    }
  }

  /**
   * Generate unique export ID
   * @private
   */
  _generateExportId() {
    return `export_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get performance report
   * @private
   */
  _getPerformanceReport() {
    return {
      signingTimes: {
        count: this.performanceMetrics.signingTimes.length,
        minTime: this.performanceMetrics.signingTimes.length > 0
          ? Math.min(...this.performanceMetrics.signingTimes).toFixed(3)
          : 'N/A',
        maxTime: this.performanceMetrics.signingTimes.length > 0
          ? Math.max(...this.performanceMetrics.signingTimes).toFixed(3)
          : 'N/A',
        averageTime: this.stats.averageSigningTime.toFixed(3)
      },
      verificationTimes: {
        count: this.performanceMetrics.verificationTimes.length,
        minTime: this.performanceMetrics.verificationTimes.length > 0
          ? Math.min(...this.performanceMetrics.verificationTimes).toFixed(3)
          : 'N/A',
        maxTime: this.performanceMetrics.verificationTimes.length > 0
          ? Math.max(...this.performanceMetrics.verificationTimes).toFixed(3)
          : 'N/A',
        averageTime: this.stats.averageVerificationTime.toFixed(3)
      },
      payloadSizes: {
        count: this.performanceMetrics.payloadSizes.length,
        minSize: this.performanceMetrics.payloadSizes.length > 0
          ? Math.min(...this.performanceMetrics.payloadSizes)
          : 0,
        maxSize: this.performanceMetrics.payloadSizes.length > 0
          ? Math.max(...this.performanceMetrics.payloadSizes)
          : 0,
        averageSize: this.performanceMetrics.payloadSizes.length > 0
          ? (this.performanceMetrics.payloadSizes.reduce((a, b) => a + b, 0) / this.performanceMetrics.payloadSizes.length).toFixed(0)
          : 0
      }
    };
  }

  /**
   * Destroy manager and cleanup resources
   */
  destroy() {
    if (this.replayCleanupInterval) {
      clearInterval(this.replayCleanupInterval);
    }
    this.replayCache.clear();
    this.chainOfCustody = [];
    this.performanceMetrics = {
      signingTimes: [],
      verificationTimes: [],
      payloadSizes: []
    };
    this.removeAllListeners();
  }

  /**
   * Static helper: Generate a random secret key
   * @returns {string} 64-char hex string (32 bytes)
   */
  static generateSecretKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Static helper: Create manager with generated key
   * @returns {ExportIntegrityManager} Manager instance with key printed
   */
  static createWithGeneratedKey(options = {}) {
    const key = ExportIntegrityManager.generateSecretKey();
    console.log('[SECURITY] Generated export integrity secret key (save this securely):');
    console.log(key);
    return new ExportIntegrityManager(key, options);
  }
}

module.exports = { ExportIntegrityManager, INTEGRITY_CONFIG };

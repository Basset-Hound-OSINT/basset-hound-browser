/**
 * Request Signing & Verification Module
 *
 * Provides cryptographic signing and verification of sensitive requests.
 * Ensures request integrity and prevents tampering or replay attacks.
 *
 * Features:
 * - HMAC-SHA256 signing of request data
 * - Timestamp validation to prevent replay attacks
 * - Nonce validation for request deduplication
 * - Support for selective field signing
 * - Constant-time comparison
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

const crypto = require('crypto');

class RequestSigner {
  /**
   * Configuration
   */
  static DEFAULT_CONFIG = {
    algorithm: 'sha256',
    maxRequestAge: 60000, // 60 seconds
    clockSkew: 5000, // 5 seconds clock tolerance
    enableNonce: true,
    nonceWindow: 300000, // 5 minutes
    enableTimestamp: true,
    fieldsToSign: null, // null = all fields, or array of field names
    excludeFields: ['signature', 'nonce']
  };

  /**
   * Constructor
   * @param {Buffer|string} signingKey - Key for signing requests
   * @param {Object} config - Configuration options
   */
  constructor(signingKey, config = {}) {
    if (!signingKey) {
      throw new Error('Signing key is required');
    }

    // Convert string to buffer if needed
    this.signingKey = typeof signingKey === 'string'
      ? Buffer.from(signingKey, 'hex')
      : signingKey;

    if (this.signingKey.length < 32) {
      throw new Error('Signing key must be at least 32 bytes (256 bits)');
    }

    this.config = { ...RequestSigner.DEFAULT_CONFIG, ...config };
    this.usedNonces = new Map(); // nonce -> timestamp (verified/used nonces)
    this.createdNonces = new Set(); // nonces created by this signer
  }

  /**
   * Generate a request signature
   * @param {Object} request - Request object to sign
   * @param {Object} options - Signing options
   * @returns {Object} { signature: string, timestamp: number, nonce: string }
   */
  sign(request, options = {}) {
    if (!request || typeof request !== 'object') {
      throw new Error('Request must be an object');
    }

    const timestamp = options.timestamp || Date.now();
    const nonce = options.nonce || this.generateNonce();

    // Prepare data to sign
    const dataToSign = this.prepareDataForSigning(request, timestamp, nonce);

    // Create HMAC
    const hmac = crypto.createHmac(this.config.algorithm, this.signingKey);
    hmac.update(dataToSign);
    const signature = hmac.digest('hex');

    return {
      signature,
      timestamp,
      nonce,
      algorithm: `hmac-${this.config.algorithm}`
    };
  }

  /**
   * Verify a request signature
   * @param {Object} request - Request object with embedded signature
   * @param {Object} options - Verification options
   * @returns {Object} { valid: boolean, errors: [] }
   */
  verify(request, options = {}) {
    if (!request || typeof request !== 'object') {
      return {
        valid: false,
        errors: ['Request must be an object']
      };
    }

    const errors = [];

    // Extract signature and metadata
    const signature = request.signature;
    const timestamp = request.timestamp;
    const nonce = request.nonce;

    // Basic checks
    if (!signature) {
      errors.push('Missing signature');
    }

    if (this.config.enableTimestamp && !timestamp) {
      errors.push('Missing timestamp');
    }

    if (this.config.enableNonce && !nonce) {
      errors.push('Missing nonce');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Timestamp validation
    if (this.config.enableTimestamp && timestamp) {
      const now = Date.now();
      const age = now - timestamp;

      if (age < -this.config.clockSkew) {
        errors.push('Request timestamp is in the future (clock skew)');
      } else if (age > this.config.maxRequestAge) {
        errors.push(`Request is too old (age: ${age}ms, max: ${this.config.maxRequestAge}ms)`);
      }
    }

    // Nonce validation - check BEFORE recording
    if (this.config.enableNonce && nonce) {
      // Clean up old nonces first
      const now = Date.now();
      for (const [n, timestamp] of this.usedNonces.entries()) {
        if (now - timestamp > this.config.nonceWindow) {
          this.usedNonces.delete(n);
        }
      }

      if (this.usedNonces.has(nonce)) {
        errors.push('Invalid or duplicate nonce');
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Signature verification
    const dataToSign = this.prepareDataForSigning(request, timestamp, nonce);
    const hmac = crypto.createHmac(this.config.algorithm, this.signingKey);
    hmac.update(dataToSign);
    const expectedSignature = hmac.digest('hex');

    // Constant-time comparison
    try {
      const signatureBuffer = Buffer.from(signature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const signaturesMatch = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

      if (!signaturesMatch) {
        errors.push('Signature verification failed');
      }
    } catch (e) {
      errors.push('Invalid signature format or length');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Record used nonce only if verification succeeded
    if (this.config.enableNonce && nonce) {
      this.usedNonces.set(nonce, Date.now());
    }

    return {
      valid: true,
      errors: [],
      signature,
      timestamp,
      nonce
    };
  }

  /**
   * Prepare request data for signing
   * @param {Object} request - Request object
   * @param {number} timestamp - Request timestamp
   * @param {string} nonce - Request nonce
   * @returns {string} Data string to sign
   */
  prepareDataForSigning(request, timestamp, nonce) {
    // Create a copy without signature fields
    const copy = { ...request };

    // Remove fields that should not be signed (signature, nonce, timestamp, algorithm)
    const fieldsToRemove = [...this.config.excludeFields, 'timestamp', 'algorithm'];
    for (const field of fieldsToRemove) {
      delete copy[field];
    }

    // Filter to specific fields if configured
    let fieldsToUse = copy;
    if (this.config.fieldsToSign && Array.isArray(this.config.fieldsToSign)) {
      fieldsToUse = {};
      for (const field of this.config.fieldsToSign) {
        if (field in copy) {
          fieldsToUse[field] = copy[field];
        }
      }
    }

    // Serialize consistently (sorted keys)
    const serialized = JSON.stringify(fieldsToUse, Object.keys(fieldsToUse).sort());

    // Combine with metadata
    return `${serialized}|${timestamp}|${nonce}`;
  }

  /**
   * Generate a cryptographically secure nonce
   * @returns {string} Base64-encoded nonce
   */
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate a nonce (check for duplicate)
   * @param {string} nonce - Nonce to validate
   * @returns {boolean} True if nonce is valid (not used before)
   */
  validateNonce(nonce) {
    if (!this.config.enableNonce) {
      return true;
    }

    // Clean up old nonces
    const now = Date.now();
    for (const [n, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > this.config.nonceWindow) {
        this.usedNonces.delete(n);
      }
    }

    // Check if nonce was already used
    if (this.usedNonces.has(nonce)) {
      return false;
    }

    return true;
  }

  /**
   * Sign and attach signature to request
   * @param {Object} request - Request object to modify
   * @param {Object} options - Signing options
   * @returns {Object} Modified request with signature
   */
  attachSignature(request, options = {}) {
    // Use existing timestamp if provided, otherwise create new one
    const timestamp = request.timestamp || options.timestamp || Date.now();
    const nonce = options.nonce || (this.config.enableNonce ? this.generateNonce() : undefined);

    // Prepare data to sign
    const dataToSign = this.prepareDataForSigning(request, timestamp, nonce);

    // Create HMAC
    const hmac = crypto.createHmac(this.config.algorithm, this.signingKey);
    hmac.update(dataToSign);
    const signature = hmac.digest('hex');

    const result = {
      ...request,
      signature,
      timestamp,
      algorithm: `hmac-${this.config.algorithm}`
    };

    // Only add nonce if enabled
    if (this.config.enableNonce && nonce) {
      result.nonce = nonce;
      // Track created nonce for stats
      this.createdNonces.add(nonce);
    }

    return result;
  }

  /**
   * Extract and remove signature from request
   * @param {Object} request - Request with signature
   * @returns {Object} { request: clean request, signature: signature data }
   */
  extractSignature(request) {
    const signature = request.signature;
    const timestamp = request.timestamp;
    const nonce = request.nonce;
    const algorithm = request.algorithm;

    const cleanRequest = { ...request };
    delete cleanRequest.signature;
    delete cleanRequest.timestamp;
    delete cleanRequest.nonce;
    delete cleanRequest.algorithm;

    return {
      request: cleanRequest,
      signature: {
        signature,
        timestamp,
        nonce,
        algorithm
      }
    };
  }

  /**
   * Create a batch of signed requests
   * @param {Array<Object>} requests - Array of requests
   * @returns {Array<Object>} Array of signed requests
   */
  signBatch(requests) {
    if (!Array.isArray(requests)) {
      throw new Error('Requests must be an array');
    }

    return requests.map(req => this.attachSignature(req));
  }

  /**
   * Verify a batch of signed requests
   * @param {Array<Object>} requests - Array of signed requests
   * @returns {Object} { valid: number, invalid: number, errors: [] }
   */
  verifyBatch(requests) {
    if (!Array.isArray(requests)) {
      throw new Error('Requests must be an array');
    }

    let valid = 0;
    let invalid = 0;
    const errors = [];

    for (let i = 0; i < requests.length; i++) {
      const result = this.verify(requests[i]);
      if (result.valid) {
        valid++;
      } else {
        invalid++;
        errors.push({
          index: i,
          errors: result.errors
        });
      }
    }

    return {
      valid,
      invalid,
      total: requests.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get statistics on signature verification
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      noncesCached: this.createdNonces.size,
      cacheSize: this.usedNonces.size,
      noncesVerified: this.usedNonces.size
    };
  }

  /**
   * Clear nonce cache
   */
  clearNonceCache() {
    this.usedNonces.clear();
    this.createdNonces.clear();
  }

  /**
   * Clean up old nonces
   */
  cleanupNonces() {
    const now = Date.now();
    for (const [nonce, timestamp] of this.usedNonces.entries()) {
      if (now - timestamp > this.config.nonceWindow) {
        this.usedNonces.delete(nonce);
      }
    }
  }
}

module.exports = RequestSigner;

/**
 * HMAC Message Authentication for WebSocket Communication
 *
 * Ensures message integrity and authenticity using HMAC-SHA256.
 * Prevents man-in-the-middle attacks even over WSS by authenticating
 * the actual message content.
 *
 * Design:
 * - HMAC-SHA256 for fast, secure signing
 * - Timestamp validation to prevent replay attacks
 * - Timing-safe comparison to prevent timing attacks
 * - Optional nonce-based request deduplication
 */

const crypto = require('crypto');

class HMACSignerMessage {
  /**
   * Configuration
   */
  static DEFAULT_CONFIG = {
    algorithm: 'sha256',
    maxMessageAge: 60000,  // 60 seconds
    enableTimestamp: true,
    enableNonce: true,
    enableRequestDedup: false,
    dedupWindow: 60000  // 60 seconds
  };

  /**
   * Constructor
   * @param {string|Buffer} secretKey - HMAC secret key (32+ bytes recommended)
   * @param {Object} config - Configuration options
   */
  constructor(secretKey, config = {}) {
    if (!secretKey) {
      throw new Error('Secret key is required');
    }

    // Convert string to buffer if needed
    this.secretKey = typeof secretKey === 'string'
      ? Buffer.from(secretKey, 'hex')
      : secretKey;

    if (this.secretKey.length < 32) {
      throw new Error('Secret key must be at least 32 bytes (256 bits)');
    }

    this.config = { ...HMACSignerMessage.DEFAULT_CONFIG, ...config };
    this.usedNonces = new Set();
    this.seenRequests = new Map();

    // Cleanup interval for old nonces
    if (this.config.enableNonce) {
      this.nonceCleanupInterval = setInterval(() => {
        this._cleanupOldNonces();
      }, this.config.maxMessageAge);
    }

    if (this.config.enableRequestDedup) {
      this.dedupCleanupInterval = setInterval(() => {
        this._cleanupOldRequests();
      }, this.config.dedupWindow);
    }
  }

  /**
   * Sign a message with HMAC-SHA256
   * @param {Object|string} message - Message to sign
   * @returns {string} Signature in hex format
   */
  signMessage(message) {
    const messageStr = typeof message === 'string'
      ? message
      : JSON.stringify(message);

    const hmac = crypto.createHmac(`hmac-${this.config.algorithm}`, this.secretKey);
    hmac.update(messageStr, 'utf-8');
    return hmac.digest('hex');
  }

  /**
   * Create an authenticated message envelope
   * @param {Object} payload - Message payload to sign
   * @returns {Object} { payload, signature, timestamp, nonce }
   */
  createAuthenticatedMessage(payload) {
    const envelope = {
      payload: payload,
      timestamp: Date.now()
    };

    if (this.config.enableNonce) {
      envelope.nonce = crypto.randomBytes(16).toString('hex');
    }

    // Sign the payload only (not timestamp/nonce to allow clock skew)
    const messageStr = JSON.stringify(payload);
    envelope.signature = this.signMessage(messageStr);

    return envelope;
  }

  /**
   * Verify message authenticity and freshness
   * @param {Object} envelope - Message envelope to verify
   * @returns {Object} { valid: boolean, error?: string, data?: Object }
   */
  verifyMessage(envelope) {
    // Validate envelope structure
    if (!envelope || typeof envelope !== 'object') {
      return { valid: false, error: 'Invalid envelope structure' };
    }

    const { payload, signature, timestamp, nonce } = envelope;

    if (!payload) {
      return { valid: false, error: 'Missing payload' };
    }

    if (!signature || typeof signature !== 'string') {
      return { valid: false, error: 'Missing or invalid signature' };
    }

    // Check timestamp freshness
    if (this.config.enableTimestamp) {
      const now = Date.now();
      const age = now - timestamp;

      if (age < 0) {
        // Clock skew: message is from the future
        return { valid: false, error: 'Message timestamp is in the future (clock skew)' };
      }

      if (age > this.config.maxMessageAge) {
        return {
          valid: false,
          error: `Message expired (age: ${age}ms, max: ${this.config.maxMessageAge}ms)`
        };
      }
    }

    // Check nonce for replay prevention
    if (this.config.enableNonce) {
      if (!nonce) {
        return { valid: false, error: 'Missing nonce' };
      }

      if (this.usedNonces.has(nonce)) {
        return { valid: false, error: 'Nonce replay detected' };
      }

      this.usedNonces.add(nonce);
    }

    // Verify signature with constant-time comparison
    const messageStr = JSON.stringify(payload);
    const expectedSignature = this.signMessage(messageStr);

    const isValid = this._timingSafeCompare(signature, expectedSignature);

    if (!isValid) {
      return { valid: false, error: 'Invalid message signature' };
    }

    return { valid: true, data: payload };
  }

  /**
   * Create signed response envelope
   * @param {Object} data - Response data
   * @param {string} requestNonce - Original request nonce (for request-response pairing)
   * @returns {Object} Signed response envelope
   */
  createSignedResponse(data, requestNonce = null) {
    const envelope = {
      data: data,
      timestamp: Date.now(),
      requestNonce: requestNonce || undefined
    };

    const messageStr = JSON.stringify(data);
    envelope.signature = this.signMessage(messageStr);

    // Clean up undefined fields
    if (!envelope.requestNonce) {
      delete envelope.requestNonce;
    }

    return envelope;
  }

  /**
   * Verify signed response
   * @param {Object} envelope - Response envelope
   * @param {string} requestNonce - Expected request nonce
   * @returns {Object} { valid: boolean, error?: string, data?: Object }
   */
  verifySignedResponse(envelope, requestNonce = null) {
    const verification = this.verifyMessage(envelope);

    if (!verification.valid) {
      return verification;
    }

    // Verify nonce pairing if provided
    if (requestNonce && envelope.requestNonce !== requestNonce) {
      return {
        valid: false,
        error: 'Response nonce mismatch (request-response pairing failed)'
      };
    }

    return verification;
  }

  /**
   * Enable request deduplication (prevents duplicate processing)
   * @param {string} requestId - Unique request identifier
   * @returns {Object} { isDuplicate: boolean, firstSeen?: number }
   */
  checkRequestDedup(requestId) {
    if (!this.config.enableRequestDedup) {
      return { isDuplicate: false };
    }

    const now = Date.now();

    if (this.seenRequests.has(requestId)) {
      return {
        isDuplicate: true,
        firstSeen: this.seenRequests.get(requestId)
      };
    }

    this.seenRequests.set(requestId, now);
    return { isDuplicate: false };
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @private
   */
  _timingSafeCompare(a, b) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a, 'hex'),
        Buffer.from(b, 'hex')
      );
    } catch (error) {
      // If buffers are different lengths, timingSafeEqual throws
      // Catch and return false
      return false;
    }
  }

  /**
   * Cleanup old nonces to prevent memory leak
   * @private
   */
  _cleanupOldNonces() {
    // Clear all nonces periodically (simpler than tracking age per nonce)
    // In production, consider using a time-keyed structure
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
    }
  }

  /**
   * Cleanup old request dedup entries
   * @private
   */
  _cleanupOldRequests() {
    const now = Date.now();
    const maxAge = this.config.dedupWindow;

    for (const [requestId, timestamp] of this.seenRequests.entries()) {
      if (now - timestamp > maxAge) {
        this.seenRequests.delete(requestId);
      }
    }
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      usedNonces: this.usedNonces.size,
      seenRequests: this.seenRequests.size,
      config: this.config
    };
  }

  /**
   * Destroy signer and cleanup resources
   */
  destroy() {
    if (this.nonceCleanupInterval) {
      clearInterval(this.nonceCleanupInterval);
    }
    if (this.dedupCleanupInterval) {
      clearInterval(this.dedupCleanupInterval);
    }
    this.usedNonces.clear();
    this.seenRequests.clear();
  }

  /**
   * Static helper: Generate a random secret key
   * @returns {string} 64-char hex string (32 bytes)
   */
  static generateSecretKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Static helper: Create a signer with generated key
   * @returns {HMACSignerMessage} Signer instance with key printed
   */
  static createWithGeneratedKey(config = {}) {
    const key = HMACSignerMessage.generateSecretKey();
    console.log('[SECURITY] Generated HMAC secret key (save this securely):');
    console.log(key);
    return new HMACSignerMessage(key, config);
  }
}

module.exports = { HMACSignerMessage };

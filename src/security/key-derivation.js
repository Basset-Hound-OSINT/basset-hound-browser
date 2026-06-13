/**
 * Key Derivation Function Module
 *
 * Implements HKDF (HMAC-based Key Derivation Function) for secure key generation
 * Supports Perfect Forward Secrecy (PFS) with ephemeral key rotation
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 * Reference: RFC 5869 - HKDF
 */

const crypto = require('crypto');

/**
 * KeyDerivationManager - HKDF and key rotation management
 */
class KeyDerivationManager {
  constructor(options = {}) {
    this.algorithm = options.algorithm || 'sha256';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.saltLength = options.saltLength || 16; // 128 bits
    this.infoLength = options.infoLength || 16; // 128 bits
    this.rotationIntervalMs = options.rotationIntervalMs || 3600000; // 1 hour
    this.enableEphemeralRotation = options.enableEphemeralRotation !== false;

    // Current keys
    this.masterKey = null;
    this.currentEphemeralKey = null;
    this.ephemeralKeyTimestamp = null;
    this.keyDerivationHistory = [];
    this.maxHistorySize = options.maxHistorySize || 100;
  }

  /**
   * HKDF Extract step (RFC 5869)
   * Extracts a pseudorandom key from input key material
   */
  hkdfExtract(salt, inputKeyMaterial) {
    if (!salt) {
      // If no salt provided, use hash length of zeros
      salt = Buffer.alloc(crypto.createHmac(this.algorithm, Buffer.alloc(1)).digest().length, 0);
    }

    if (typeof salt === 'string') {
      salt = Buffer.from(salt, 'utf-8');
    }

    if (typeof inputKeyMaterial === 'string') {
      inputKeyMaterial = Buffer.from(inputKeyMaterial, 'utf-8');
    }

    return crypto
      .createHmac(this.algorithm, salt)
      .update(inputKeyMaterial)
      .digest();
  }

  /**
   * HKDF Expand step (RFC 5869)
   * Expands pseudorandom key to desired length
   */
  hkdfExpand(prk, info, length) {
    if (!prk) {
      throw new Error('PRK (pseudorandom key) is required');
    }

    if (typeof prk === 'string') {
      prk = Buffer.from(prk, 'hex');
    }

    if (typeof info === 'string') {
      info = Buffer.from(info, 'utf-8');
    }

    if (!info) {
      info = Buffer.alloc(0);
    }

    // Check length constraint (RFC 5869: L <= 255 * Hlen)
    const hashLen = crypto.createHmac(this.algorithm, Buffer.alloc(1)).digest().length;
    const maxLength = 255 * hashLen;
    if (length > maxLength) {
      throw new Error(`Requested length ${length} exceeds maximum ${maxLength}`);
    }

    let output = Buffer.alloc(0);
    let outputBlock = Buffer.alloc(0);
    let blockIndex = 1;

    while (output.length < length) {
      outputBlock = crypto
        .createHmac(this.algorithm, prk)
        .update(Buffer.concat([outputBlock, info, Buffer.from([blockIndex])]))
        .digest();

      output = Buffer.concat([output, outputBlock]);
      blockIndex++;
    }

    return output.slice(0, length);
  }

  /**
   * Complete HKDF operation (Extract + Expand)
   */
  hkdf(inputKeyMaterial, salt, info, length) {
    const prk = this.hkdfExtract(salt, inputKeyMaterial);
    return this.hkdfExpand(prk, info, length);
  }

  /**
   * Derive key with automatic salt generation
   */
  deriveKey(masterSecret, context, length = this.keyLength) {
    if (!masterSecret) {
      throw new Error('Master secret is required');
    }

    // Generate random salt
    const salt = crypto.randomBytes(this.saltLength);

    // Use context as info for HKDF expand
    const info = Buffer.from(context || '', 'utf-8');

    // Perform HKDF
    const derivedKey = this.hkdf(masterSecret, salt, info, length || this.keyLength);

    // Record in history
    const record = {
      timestamp: Date.now(),
      context,
      keyLength: length || this.keyLength,
      saltHash: crypto.createHash(this.algorithm).update(salt).digest('hex'),
      keyHash: crypto.createHash(this.algorithm).update(derivedKey).digest('hex')
    };

    this.addToHistory(record);

    return {
      key: derivedKey,
      salt,
      info,
      keyHash: record.keyHash,
      timestamp: record.timestamp
    };
  }

  /**
   * Generate ephemeral key for Perfect Forward Secrecy
   */
  generateEphemeralKey(masterSecret, context = 'ephemeral') {
    if (!masterSecret) {
      throw new Error('Master secret is required for ephemeral key generation');
    }

    // Add timestamp to context for unique ephemeral keys
    const uniqueContext = `${context}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;

    const ephemeralKey = this.deriveKey(masterSecret, uniqueContext, this.keyLength);

    this.currentEphemeralKey = ephemeralKey;
    this.ephemeralKeyTimestamp = Date.now();

    return ephemeralKey;
  }

  /**
   * Rotate ephemeral key if necessary
   */
  rotateEphemeralKeyIfNeeded(masterSecret, context = 'ephemeral') {
    if (!this.enableEphemeralRotation) {
      return this.currentEphemeralKey;
    }

    const now = Date.now();
    const lastRotation = this.ephemeralKeyTimestamp || 0;
    const timeSinceRotation = now - lastRotation;

    if (timeSinceRotation >= this.rotationIntervalMs) {
      return this.generateEphemeralKey(masterSecret, context);
    }

    return this.currentEphemeralKey;
  }

  /**
   * Derive multiple keys from single master secret
   */
  deriveMultipleKeys(masterSecret, contexts, length = this.keyLength) {
    if (!Array.isArray(contexts)) {
      throw new Error('Contexts must be an array');
    }

    return contexts.map(context => {
      const result = this.deriveKey(masterSecret, context, length);
      return {
        context,
        ...result
      };
    });
  }

  /**
   * Verify key derivation (compare hashes)
   */
  verifyKeyDerivation(key, expectedHash, algorithm = this.algorithm) {
    if (typeof key === 'object' && key.key) {
      // Handle object with key property
      key = key.key;
    }

    if (typeof key === 'string' && key.length === 64) {
      // Assume hex string
      key = Buffer.from(key, 'hex');
    }

    const actualHash = crypto
      .createHash(algorithm)
      .update(key)
      .digest('hex');

    return actualHash === expectedHash;
  }

  /**
   * Add record to history
   */
  addToHistory(record) {
    this.keyDerivationHistory.push(record);

    // Maintain size limit
    if (this.keyDerivationHistory.length > this.maxHistorySize) {
      this.keyDerivationHistory.shift();
    }
  }

  /**
   * Get key derivation history
   */
  getHistory(limit = 10) {
    return this.keyDerivationHistory.slice(-limit);
  }

  /**
   * Clear sensitive key material
   */
  clearEphemeralKey() {
    if (this.currentEphemeralKey) {
      // Overwrite with zeros
      if (this.currentEphemeralKey.key) {
        this.currentEphemeralKey.key.fill(0);
      }
      this.currentEphemeralKey = null;
      this.ephemeralKeyTimestamp = null;
    }
  }

  /**
   * Clear all sensitive data
   */
  clearAllKeys() {
    this.clearEphemeralKey();
    if (this.masterKey) {
      this.masterKey.fill(0);
      this.masterKey = null;
    }
    this.keyDerivationHistory = [];
  }

  /**
   * Get security report for key derivation
   */
  getSecurityReport() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      saltLength: this.saltLength,
      infoLength: this.infoLength,
      rotationIntervalMs: this.rotationIntervalMs,
      ephemeralRotationEnabled: this.enableEphemeralRotation,
      currentEphemeralKeyAge: this.ephemeralKeyTimestamp
        ? Date.now() - this.ephemeralKeyTimestamp
        : null,
      historySize: this.keyDerivationHistory.length,
      maxHistorySize: this.maxHistorySize,
      hkdfImplementation: 'RFC 5869 compliant',
      perfectForwardSecrecy: this.enableEphemeralRotation
    };
  }

  /**
   * Generate random bytes (cryptographically secure)
   */
  static generateRandomBytes(length = 32) {
    return crypto.randomBytes(length);
  }

  /**
   * Generate random hex string
   */
  static generateRandomHex(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Check randomness quality using chi-square test
   */
  static testRandomnessQuality(data, sampleSize = 256) {
    if (!Buffer.isBuffer(data)) {
      data = Buffer.from(data);
    }

    if (data.length < sampleSize) {
      sampleSize = data.length;
    }

    // Calculate frequency distribution
    const frequencies = new Array(256).fill(0);
    for (let i = 0; i < sampleSize; i++) {
      frequencies[data[i]]++;
    }

    // Calculate chi-square statistic
    const expectedFrequency = sampleSize / 256;
    let chiSquare = 0;

    for (const freq of frequencies) {
      const diff = freq - expectedFrequency;
      chiSquare += (diff * diff) / expectedFrequency;
    }

    // Degrees of freedom = 255
    // Critical value for p=0.05: ~293.24
    // Good randomness: chiSquare should be between ~200-310
    const quality = chiSquare > 200 && chiSquare < 310 ? 'GOOD' : 'POOR';

    return {
      chiSquare,
      expectedFrequency,
      quality,
      minValue: frequencies[frequencies.indexOf(Math.min(...frequencies))],
      maxValue: frequencies[frequencies.indexOf(Math.max(...frequencies))]
    };
  }
}

module.exports = { KeyDerivationManager };

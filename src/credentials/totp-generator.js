/**
 * TOTP Generator - RFC 6238 Compliant
 * Time-based One-Time Password generation for MFA/2FA
 *
 * Supports:
 * - Multiple hash algorithms (SHA-1, SHA-256, SHA-512)
 * - Configurable time windows (30s, 60s, custom)
 * - Drift tolerance (±1-2 windows)
 * - Token expiry calculation
 */

const crypto = require('crypto');

class TOTPGenerator {
  /**
   * Initialize TOTP generator with secret
   *
   * @param {string} secret - Base32-encoded secret (e.g., from QR code)
   * @param {Object} options - Configuration options
   *   - algorithm: 'SHA1' | 'SHA256' | 'SHA512' (default: 'SHA1')
   *   - window: 30 | 60 (seconds, default: 30)
   *   - digits: 6 | 7 | 8 (token length, default: 6)
   *   - epoch: number (default: 0, UNIX epoch start)
   */
  constructor(secret, options = {}) {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Secret must be a non-empty string');
    }

    this.secret = secret;
    this.algorithm = options.algorithm || 'SHA1';
    this.window = (options.window !== undefined) ? options.window : 30;
    this.digits = options.digits || 6;
    this.epoch = (options.epoch !== undefined) ? options.epoch : 0;

    // Validate options
    if (!['SHA1', 'SHA256', 'SHA512'].includes(this.algorithm)) {
      throw new Error(`Unsupported algorithm: ${this.algorithm}`);
    }
    if (![6, 7, 8].includes(this.digits)) {
      throw new Error('Digits must be 6, 7, or 8');
    }
    if (!Number.isInteger(this.window) || this.window <= 0) {
      throw new Error('Window must be a positive integer');
    }

    // Decode Base32 secret
    this.secretBuffer = this._decodeBase32(secret);
    if (this.secretBuffer.length < 2) {
      throw new Error('Secret is too short (minimum 2 bytes)');
    }
  }

  /**
   * Decode Base32-encoded string to Buffer
   * RFC 4648 Base32 alphabet: A-Z (26) + 2-7 (8) = 34 characters
   *
   * @param {string} str - Base32-encoded string
   * @returns {Buffer}
   * @private
   */
  _decodeBase32(str) {
    // Remove padding
    str = str.replace(/=/g, '');

    // Standard Base32 alphabet
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bits = [];

    // Convert each Base32 character to 5-bit value
    for (const char of str) {
      const value = alphabet.indexOf(char.toUpperCase());
      if (value === -1) {
        throw new Error(`Invalid Base32 character: ${char}`);
      }
      // Add 5 bits
      bits.push(
        (value >> 4) & 1,
        (value >> 3) & 1,
        (value >> 2) & 1,
        (value >> 1) & 1,
        value & 1
      );
    }

    // Convert bits to bytes
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (bits[i + j] || 0);
      }
      bytes.push(byte);
    }

    return Buffer.from(bytes);
  }

  /**
   * Generate HMAC-based counter value
   *
   * @param {number} counter - Counter value
   * @returns {number} 31-bit value from HMAC
   * @private
   */
  _hmacCounter(counter) {
    const hmacAlg = this.algorithm.toLowerCase().replace('sha', 'sha');
    const counterBuf = Buffer.alloc(8);

    // Write counter as big-endian 64-bit integer
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuf.writeUInt32BE(counter >>> 0, 4);

    const hmac = crypto.createHmac(hmacAlg, this.secretBuffer);
    hmac.update(counterBuf);
    const hmacResult = hmac.digest();

    // Dynamic truncation (RFC 6238, section 5.4)
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const truncated = hmacResult.readUInt32BE(offset) & 0x7fffffff;

    return truncated;
  }

  /**
   * Calculate current time counter
   * @returns {number} HMAC counter value
   */
  getCounter() {
    const now = Math.floor(Date.now() / 1000);
    return Math.floor((now - this.epoch) / this.window);
  }

  /**
   * Generate TOTP for specific timestamp
   *
   * @param {number} timestamp - UNIX timestamp in milliseconds (optional, uses current time)
   * @returns {Object} { token: string, window: number, counter: number }
   */
  generateAtTime(timestamp) {
    const seconds = Math.floor((timestamp || Date.now()) / 1000);
    const counter = Math.floor((seconds - this.epoch) / this.window);
    const truncated = this._hmacCounter(counter);

    // Modulo 10^digits to get final token
    const divisor = Math.pow(10, this.digits);
    const otp = (truncated % divisor).toString().padStart(this.digits, '0');

    return {
      token: otp,
      window: this.window,
      counter
    };
  }

  /**
   * Generate current TOTP token
   * @returns {Object} { token: string, expiresAt: number, validFor: number }
   */
  generate() {
    const now = Date.now();
    const result = this.generateAtTime(now);

    // Calculate expiry time
    const seconds = Math.floor(now / 1000);
    const windowOffset = (seconds - this.epoch) % this.window;
    const secondsUntilExpiry = this.window - windowOffset;
    const expiresAt = now + (secondsUntilExpiry * 1000);
    const validFor = secondsUntilExpiry * 1000;

    return {
      token: result.token,
      expiresAt,
      validFor
    };
  }

  /**
   * Validate a TOTP token (with drift tolerance)
   *
   * @param {string} token - Token to validate
   * @param {number} window - Number of windows before/after current (default: 1)
   * @returns {boolean} true if token is valid
   */
  validate(token, window = 1) {
    if (!token || typeof token !== 'string' || !/^\d+$/.test(token)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const currentCounter = Math.floor((now - this.epoch) / this.window);

    // Check current window and ±drift
    for (let i = -window; i <= window; i++) {
      const counter = currentCounter + i;
      const testValue = this._hmacCounter(counter);
      const divisor = Math.pow(10, this.digits);
      const testToken = (testValue % divisor).toString().padStart(this.digits, '0');

      if (testToken === token) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get time remaining before token expires (milliseconds)
   * @returns {number} milliseconds until expiry
   */
  getTimeRemaining() {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);
    const windowOffset = (seconds - this.epoch) % this.window;
    const secondsUntilExpiry = this.window - windowOffset;
    return secondsUntilExpiry * 1000;
  }

  /**
   * Get next token (useful for preemptive fill)
   * @returns {Object} { token: string, startsAt: number }
   */
  getNextToken() {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);
    const windowOffset = (seconds - this.epoch) % this.window;
    const secondsUntilNextWindow = this.window - windowOffset;
    const nextWindowTime = now + (secondsUntilNextWindow * 1000);

    const result = this.generateAtTime(nextWindowTime);

    return {
      token: result.token,
      startsAt: nextWindowTime
    };
  }
}

module.exports = TOTPGenerator;

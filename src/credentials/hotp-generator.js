/**
 * HOTP Generator - RFC 4226 Compliant
 * Counter-based One-Time Password generation for MFA/2FA
 *
 * Used for:
 * - Hardware tokens
 * - Backup codes
 * - Counter-based authentication
 *
 * Supports:
 * - Multiple hash algorithms (SHA-1, SHA-256, SHA-512)
 * - Counter management and persistence
 * - Resynchronization with lookahead
 * - Counter overflow handling
 */

const crypto = require('crypto');

class HOTPGenerator {
  /**
   * Initialize HOTP generator with secret
   *
   * @param {string} secret - Base32-encoded secret
   * @param {Object} options - Configuration options
   *   - algorithm: 'SHA1' | 'SHA256' | 'SHA512' (default: 'SHA1')
   *   - digits: 6 | 7 | 8 (token length, default: 6)
   *   - initialCounter: number (default: 0)
   */
  constructor(secret, options = {}) {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Secret must be a non-empty string');
    }

    this.secret = secret;
    this.algorithm = options.algorithm || 'SHA1';
    this.digits = options.digits || 6;
    this.counter = options.initialCounter || 0;

    // Validate options
    if (!['SHA1', 'SHA256', 'SHA512'].includes(this.algorithm)) {
      throw new Error(`Unsupported algorithm: ${this.algorithm}`);
    }
    if (![6, 7, 8].includes(this.digits)) {
      throw new Error('Digits must be 6, 7, or 8');
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
   * @param {str} str - Base32-encoded string
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

    // Dynamic truncation (RFC 4226, section 5.4)
    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const truncated = hmacResult.readUInt32BE(offset) & 0x7fffffff;

    return truncated;
  }

  /**
   * Get current counter
   * @returns {number}
   */
  getCounter() {
    return this.counter;
  }

  /**
   * Increment and get next counter
   * @returns {number}
   */
  incrementCounter() {
    // Prevent overflow by capping at max safe integer
    if (this.counter < Number.MAX_SAFE_INTEGER) {
      this.counter++;
    } else {
      // Wrap around or throw error
      throw new Error('Counter overflow - maximum counter value reached');
    }
    return this.counter;
  }

  /**
   * Generate token for next counter value and increment
   *
   * @returns {Object} { token: string, counter: number }
   */
  generate() {
    const counter = this.counter;
    const token = this.generateFor(counter);
    this.incrementCounter();
    return token;
  }

  /**
   * Generate token for specific counter value (without incrementing)
   *
   * @param {number} counter - Counter value
   * @returns {Object} { token: string, counter: number }
   */
  generateFor(counter) {
    if (!Number.isInteger(counter) || counter < 0) {
      throw new Error('Counter must be a non-negative integer');
    }

    const truncated = this._hmacCounter(counter);
    const divisor = Math.pow(10, this.digits);
    const otp = (truncated % divisor).toString().padStart(this.digits, '0');

    return {
      token: otp,
      counter
    };
  }

  /**
   * Validate token with resync support
   * Searches ahead up to `lookahead` counters to find matching token
   *
   * @param {string} token - Token to validate
   * @param {number} lookahead - Number of counters ahead to check (default: 0)
   * @returns {Object} { valid: boolean, counter: number }
   */
  validate(token, lookahead = 0) {
    if (!token || typeof token !== 'string' || !/^\d+$/.test(token)) {
      return { valid: false, counter: this.counter };
    }

    if (lookahead < 0 || lookahead > 100) {
      throw new Error('Lookahead must be between 0 and 100');
    }

    // Check current counter and lookahead
    for (let i = 0; i <= lookahead; i++) {
      const testCounter = this.counter + i;
      const testValue = this._hmacCounter(testCounter);
      const divisor = Math.pow(10, this.digits);
      const testToken = (testValue % divisor).toString().padStart(this.digits, '0');

      if (testToken === token) {
        return {
          valid: true,
          counter: testCounter
        };
      }
    }

    return { valid: false, counter: this.counter };
  }

  /**
   * Resynchronize with server counter
   * Only allows moving forward (prevents replay attacks)
   *
   * @param {number} correctCounter - Correct counter value from server
   * @returns {boolean} true if resync successful
   */
  resync(correctCounter) {
    if (!Number.isInteger(correctCounter) || correctCounter < 0) {
      throw new Error('Counter must be a non-negative integer');
    }

    // Prevent counter rollback (security measure)
    if (correctCounter < this.counter) {
      throw new Error('Cannot rollback counter - security violation');
    }

    // Allow small jumps (e.g., user pressed button multiple times)
    // But prevent massive jumps that might indicate attack
    const maxJump = 1000; // Configurable threshold
    if (correctCounter - this.counter > maxJump) {
      throw new Error(`Counter jump too large: ${correctCounter - this.counter}`);
    }

    this.counter = correctCounter;
    return true;
  }

  /**
   * Reset counter to specific value
   * Used for initialization or recovery
   *
   * @param {number} value - New counter value
   */
  resetCounter(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('Counter must be a non-negative integer');
    }
    this.counter = value;
  }

  /**
   * Get counter state for persistence
   * @returns {Object}
   */
  getState() {
    return {
      counter: this.counter,
      algorithm: this.algorithm,
      digits: this.digits
    };
  }

  /**
   * Restore counter state from persistence
   * @param {Object} state
   */
  restoreState(state) {
    if (!state || !Number.isInteger(state.counter)) {
      throw new Error('Invalid state object');
    }
    this.counter = state.counter;
    // algorithm and digits should remain unchanged
  }
}

module.exports = HOTPGenerator;

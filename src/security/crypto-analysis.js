/**
 * Advanced Cryptographic Strength Analysis & Validation
 *
 * Provides comprehensive cryptographic strength analysis, key validation,
 * entropy verification, and secure random generation testing.
 *
 * Version: 1.0.0
 * Created: June 3, 2026
 */

const crypto = require('crypto');

class CryptoAnalyzer {
  /**
   * Configuration
   */
  static ALGORITHMS = {
    HASH: {
      'sha256': { outputLength: 32, strength: 256 },
      'sha512': { outputLength: 64, strength: 512 },
      'sha1': { outputLength: 20, strength: 80, deprecated: true }
    },
    CIPHER: {
      'aes-256-gcm': { keyLength: 32, ivLength: 16, strength: 256, aead: true },
      'aes-192-gcm': { keyLength: 24, ivLength: 16, strength: 192, aead: true },
      'aes-128-gcm': { keyLength: 16, ivLength: 16, strength: 128, aead: true },
      'chacha20-poly1305': { keyLength: 32, ivLength: 12, strength: 256, aead: true }
    },
    HMAC: {
      'sha256': { keyLength: 32, strength: 256 },
      'sha512': { keyLength: 64, strength: 512 }
    }
  };

  /**
   * Validate hash algorithm strength
   * @param {string} algorithm - Hash algorithm name
   * @param {Object} context - Validation context
   * @returns {Object} Validation result
   */
  static validateHashAlgorithm(algorithm, context = {}) {
    const config = this.ALGORITHMS.HASH[algorithm];

    if (!config) {
      return {
        valid: false,
        error: `Unknown hash algorithm: ${algorithm}`,
        strength: 0
      };
    }

    const validations = {
      algorithm,
      valid: !config.deprecated,
      strength: config.strength,
      outputLength: config.outputLength,
      deprecated: config.deprecated || false,
      issues: []
    };

    if (config.deprecated) {
      validations.issues.push(`Algorithm ${algorithm} is deprecated for security operations`);
    }

    if (config.strength < 128) {
      validations.issues.push(`Algorithm ${algorithm} has insufficient strength (${config.strength} bits < 128 bits)`);
      validations.valid = false;
    }

    return validations;
  }

  /**
   * Validate cipher algorithm strength
   * @param {string} algorithm - Cipher algorithm name
   * @param {Buffer} key - Encryption key
   * @returns {Object} Validation result
   */
  static validateCipherAlgorithm(algorithm, key) {
    const config = this.ALGORITHMS.CIPHER[algorithm];

    if (!config) {
      return {
        valid: false,
        error: `Unknown cipher algorithm: ${algorithm}`,
        strength: 0
      };
    }

    const validations = {
      algorithm,
      valid: true,
      strength: config.strength,
      keyLength: config.keyLength,
      ivLength: config.ivLength,
      aead: config.aead,
      issues: []
    };

    // Validate key length
    if (!key || !Buffer.isBuffer(key)) {
      validations.issues.push('Key must be a Buffer');
      validations.valid = false;
    } else if (key.length !== config.keyLength) {
      validations.issues.push(
        `Invalid key length: ${key.length} bytes (expected ${config.keyLength} bytes)`
      );
      validations.valid = false;
    }

    // AEAD validation
    if (!config.aead) {
      validations.issues.push(`Algorithm ${algorithm} is not authenticated encryption (AEAD)`);
      validations.valid = false;
    }

    // Strength validation
    if (config.strength < 128) {
      validations.issues.push(`Algorithm ${algorithm} has insufficient strength (${config.strength} bits)`);
      validations.valid = false;
    }

    return validations;
  }

  /**
   * Validate HMAC algorithm strength
   * @param {string} algorithm - HMAC algorithm name
   * @param {Buffer} key - HMAC key
   * @returns {Object} Validation result
   */
  static validateHMACAlgorithm(algorithm, key) {
    const config = this.ALGORITHMS.HMAC[algorithm];

    if (!config) {
      return {
        valid: false,
        error: `Unknown HMAC algorithm: ${algorithm}`,
        strength: 0
      };
    }

    const validations = {
      algorithm,
      valid: true,
      strength: config.strength,
      keyLength: config.keyLength,
      issues: []
    };

    // Validate key
    if (!key || !Buffer.isBuffer(key)) {
      validations.issues.push('Key must be a Buffer');
      validations.valid = false;
    } else if (key.length < config.keyLength) {
      validations.issues.push(
        `Key length ${key.length} bytes is less than recommended ${config.keyLength} bytes`
      );
    }

    return validations;
  }

  /**
   * Analyze entropy of generated random data
   * @param {Buffer} data - Random data to analyze
   * @param {number} expectedBits - Expected entropy bits
   * @returns {Object} Entropy analysis
   */
  static analyzeEntropy(data, expectedBits = 128) {
    if (!Buffer.isBuffer(data)) {
      throw new Error('Data must be a Buffer');
    }

    // Calculate actual entropy bits (each byte = 8 bits)
    const actualBits = data.length * 8;

    // Calculate byte distribution (chi-square test for uniformity)
    const byteCounts = new Array(256).fill(0);
    for (const byte of data) {
      byteCounts[byte]++;
    }

    const expectedCount = data.length / 256;
    let chiSquare = 0;
    for (const count of byteCounts) {
      const diff = count - expectedCount;
      chiSquare += (diff * diff) / expectedCount;
    }

    // Chi-square critical value for 255 df at p=0.05 is ~293
    const uniformityScore = Math.max(0, Math.min(100, 100 - (chiSquare / 500)));

    // Uniqueness: count unique bytes
    const uniqueBytes = byteCounts.filter(c => c > 0).length;

    return {
      bytes: data.length,
      bits: actualBits,
      expectedBits,
      sufficient: actualBits >= expectedBits,
      uniformity: uniformityScore,
      uniqueBytes,
      totalPossible: 256,
      chiSquare,
      issues: actualBits < expectedBits ? [`Insufficient entropy: ${actualBits} bits < ${expectedBits} bits required`] : []
    };
  }

  /**
   * Validate secure random generation
   * @param {number} length - Number of bytes to generate and test
   * @param {number} iterations - Number of iterations to test
   * @returns {Object} Validation result
   */
  static validateSecureRandomness(length = 32, iterations = 100) {
    const samples = [];
    let duplicates = 0;
    const firstBytes = new Set();

    for (let i = 0; i < iterations; i++) {
      const random = crypto.randomBytes(length);
      samples.push(random);

      // Check for duplicates
      const hex = random.toString('hex');
      if (firstBytes.has(hex)) {
        duplicates++;
      }
      firstBytes.add(hex);
    }

    // Analyze randomness across samples
    const entropyAnalysis = this.analyzeEntropy(Buffer.concat(samples), length * 8 * iterations);

    return {
      valid: duplicates === 0,
      iterations,
      byteLength: length,
      duplicates,
      uniqueSamples: firstBytes.size,
      duplicateRate: duplicates / iterations,
      entropyAnalysis,
      issues: duplicates > 0 ? ['Duplicate random samples detected'] : []
    };
  }

  /**
   * Validate key derivation function strength
   * @param {Buffer} password - Password or master key
   * @param {Buffer} salt - Salt value
   * @param {number} iterations - PBKDF2 iterations
   * @param {number} keyLength - Desired key length in bytes
   * @returns {Object} Validation result
   */
  static validateKeyDerivation(password, salt, iterations = 100000, keyLength = 32) {
    const validations = {
      valid: true,
      iterations,
      keyLength,
      issues: []
    };

    // Check iterations (NIST recommends at least 100,000 as of 2023)
    if (iterations < 100000) {
      validations.issues.push(`PBKDF2 iterations ${iterations} is below NIST recommendation of 100,000`);
      validations.valid = false;
    }

    // Check salt length (should be at least 16 bytes)
    if (!Buffer.isBuffer(salt) || salt.length < 16) {
      validations.issues.push('Salt must be at least 16 bytes');
      validations.valid = false;
    }

    // Check key length
    if (keyLength < 32) {
      validations.issues.push(`Key length ${keyLength} bytes is less than recommended 32 bytes`);
    }

    // Check password strength (at least 12 characters)
    if (password && typeof password === 'string' && password.length < 12) {
      validations.issues.push('Password length should be at least 12 characters');
    }

    return validations;
  }

  /**
   * Perform comprehensive cryptographic audit
   * @param {Object} options - Audit options
   * @returns {Object} Audit report
   */
  static performAudit(options = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      algorithms: {},
      randomness: {},
      keyDerivation: {},
      issues: [],
      score: 100
    };

    // Test hash algorithms
    for (const [alg, _] of Object.entries(this.ALGORITHMS.HASH)) {
      const validation = this.validateHashAlgorithm(alg);
      report.algorithms[alg] = validation;
      if (!validation.valid) {
        report.score -= 5;
      }
    }

    // Test cipher algorithms
    for (const [alg, config] of Object.entries(this.ALGORITHMS.CIPHER)) {
      const key = crypto.randomBytes(config.keyLength);
      const validation = this.validateCipherAlgorithm(alg, key);
      report.algorithms[alg] = validation;
      if (!validation.valid) {
        report.score -= 5;
      }
    }

    // Test randomness
    const randomnessTest = this.validateSecureRandomness(32, 50);
    report.randomness = randomnessTest;
    if (!randomnessTest.valid) {
      report.score -= 10;
    }

    // Test key derivation
    const salt = crypto.randomBytes(16);
    const derivationTest = this.validateKeyDerivation('password123456', salt);
    report.keyDerivation = derivationTest;
    if (!derivationTest.valid) {
      report.score -= 10;
    }

    report.score = Math.max(0, report.score);

    return report;
  }

  /**
   * Check for weak or deprecated algorithms in use
   * @param {Array<string>} algorithmsInUse - List of algorithms being used
   * @returns {Object} Weakness assessment
   */
  static assessAlgorithmWeakness(algorithmsInUse) {
    const assessment = {
      algorithms: [],
      weaknesses: [],
      deprecations: [],
      score: 100
    };

    for (const alg of algorithmsInUse) {
      // Check if it's a hash
      if (this.ALGORITHMS.HASH[alg]) {
        const config = this.ALGORITHMS.HASH[alg];
        assessment.algorithms.push({ algorithm: alg, type: 'hash' });

        if (config.deprecated) {
          assessment.deprecations.push(`Hash algorithm ${alg} is deprecated`);
          assessment.score -= 20;
        }

        if (config.strength < 128) {
          assessment.weaknesses.push(`Hash algorithm ${alg} has insufficient strength`);
          assessment.score -= 25;
        }
      }
      // Check if it's a cipher
      else if (this.ALGORITHMS.CIPHER[alg]) {
        const config = this.ALGORITHMS.CIPHER[alg];
        assessment.algorithms.push({ algorithm: alg, type: 'cipher' });

        if (!config.aead) {
          assessment.weaknesses.push(`Cipher ${alg} is not authenticated encryption`);
          assessment.score -= 15;
        }
      }
      // Check if it's HMAC
      else if (this.ALGORITHMS.HMAC[alg]) {
        assessment.algorithms.push({ algorithm: alg, type: 'hmac' });
      }
    }

    assessment.score = Math.max(0, assessment.score);
    return assessment;
  }

  /**
   * Generate cryptographically secure random bytes
   * @param {number} length - Number of bytes to generate
   * @returns {Buffer} Random bytes
   */
  static generateSecureRandom(length) {
    if (typeof length !== 'number' || length < 1 || length > 1000000) {
      throw new Error('Length must be a positive number between 1 and 1,000,000');
    }
    return crypto.randomBytes(length);
  }

  /**
   * Constant-time comparison for cryptographic values
   * @param {Buffer} a - First buffer
   * @param {Buffer} b - Second buffer
   * @returns {boolean} True if buffers are equal (in constant time)
   */
  static constantTimeCompare(a, b) {
    if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
      throw new Error('Both arguments must be Buffers');
    }
    return crypto.timingSafeEqual(a, b);
  }
}

module.exports = CryptoAnalyzer;

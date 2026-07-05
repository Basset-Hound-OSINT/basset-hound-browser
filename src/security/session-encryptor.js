/**
 * Basset Hound Browser - Session Encryption Module
 * Encrypts session data at rest using AES-256-GCM
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SessionEncryptor {
  /**
   * Constructor
   * @param {object} options Configuration options
   */
  constructor(options = {}) {
    this.masterKeyPath = options.masterKeyPath || path.join(process.env.HOME || '/tmp', 'tmp', '.basset-hound', 'keys', 'master.key');
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.saltLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.ivLength = 12; // 96 bits (recommended for GCM)

    this.masterKey = this.loadOrCreateKey();
  }

  /**
   * Load master key from disk or create new one
   * @returns {Buffer} The master encryption key
   */
  loadOrCreateKey() {
    try {
      // Check if key already exists
      if (fs.existsSync(this.masterKeyPath)) {
        const key = fs.readFileSync(this.masterKeyPath);
        if (key.length === this.keyLength) {
          return key;
        }
        throw new Error('Invalid master key file');
      }

      // Create new key
      const key = crypto.randomBytes(this.keyLength);

      // Ensure directory exists
      const keyDir = path.dirname(this.masterKeyPath);
      if (!fs.existsSync(keyDir)) {
        fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
      }

      // Write with strict permissions
      fs.writeFileSync(this.masterKeyPath, key, { mode: 0o600 });

      return key;
    } catch (error) {
      throw new Error(`Failed to load/create master key: ${error.message}`);
    }
  }

  /**
   * Encrypt session data
   * @param {object} data Session data to encrypt
   * @param {string} sessionId Optional session ID for additional authentication
   * @returns {string} Encrypted data (base64)
   */
  encryptSession(data, sessionId = null) {
    try {
      // Generate IV for this encryption
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      // Add optional AAD (Additional Authenticated Data) for integrity
      // MUST be set BEFORE update() call per Node.js crypto API
      if (sessionId) {
        cipher.setAAD(Buffer.from(sessionId, 'utf-8'));
      }

      // Convert data to JSON
      const plaintext = JSON.stringify(data);

      // Encrypt
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf-8'),
        cipher.final()
      ]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Pack: IV + authTag + encrypted data
      const packed = Buffer.concat([iv, authTag, encrypted]);

      return packed.toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt session data
   * @param {string} encrypted Encrypted data (base64)
   * @param {string} sessionId Optional session ID for verification
   * @returns {object} Decrypted session data
   */
  decryptSession(encrypted, sessionId = null) {
    try {
      // Unpack base64
      const packed = Buffer.from(encrypted, 'base64');

      // Extract components
      const iv = packed.slice(0, this.ivLength);
      const authTag = packed.slice(this.ivLength, this.ivLength + this.tagLength);
      const encryptedData = packed.slice(this.ivLength + this.tagLength);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);

      // Set AAD if provided (must match encryption)
      // MUST be set BEFORE update() call per Node.js crypto API
      if (sessionId) {
        decipher.setAAD(Buffer.from(sessionId, 'utf-8'));
      }

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt
      let plaintext = decipher.update(encryptedData);
      plaintext += decipher.final('utf-8');

      // Parse JSON
      return JSON.parse(plaintext);
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}. Data may be tampered or corrupted.`);
    }
  }

  /**
   * Encrypt file on disk
   * @param {string} sourcePath Path to plaintext file
   * @param {string} destPath Path for encrypted file
   * @param {string} sessionId Optional session ID
   * @returns {object} Encryption result
   */
  encryptFile(sourcePath, destPath, sessionId = null) {
    try {
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }

      // Read plaintext file
      const data = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));

      // Encrypt
      const encrypted = this.encryptSession(data, sessionId);

      // Write encrypted file
      fs.mkdirSync(path.dirname(destPath), { recursive: true, mode: 0o700 });
      fs.writeFileSync(destPath, encrypted, { mode: 0o600 });

      return {
        success: true,
        sourcePath,
        destPath,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Decrypt file from disk
   * @param {string} encryptedPath Path to encrypted file
   * @param {string} sessionId Optional session ID for verification
   * @returns {object} Decrypted data
   */
  decryptFile(encryptedPath, sessionId = null) {
    try {
      if (!fs.existsSync(encryptedPath)) {
        throw new Error(`Encrypted file not found: ${encryptedPath}`);
      }

      // Read encrypted file
      const encrypted = fs.readFileSync(encryptedPath, 'utf-8');

      // Decrypt
      const data = this.decryptSession(encrypted, sessionId);

      return {
        success: true,
        data,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rotate master key (creates new key, returns migration function)
   * @returns {object} Rotation info
   */
  rotateKey() {
    try {
      // Generate new key
      const newKey = crypto.randomBytes(this.keyLength);

      // Create backup of old key (for emergency recovery only)
      const backupPath = this.masterKeyPath.replace('.key', '.key.backup');
      fs.copyFileSync(this.masterKeyPath, backupPath, fs.constants.COPYFILE_EXCL);

      // Write new key
      fs.writeFileSync(this.masterKeyPath, newKey, { mode: 0o600 });

      // Update instance
      this.masterKey = newKey;

      return {
        success: true,
        message: 'Master key rotated successfully',
        backupPath,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify encryption integrity
   * @param {string} encrypted Encrypted data
   * @returns {boolean} True if format is valid
   */
  verifyEncryptedData(encrypted) {
    try {
      const packed = Buffer.from(encrypted, 'base64');

      // Check minimum size: IV (12) + authTag (16) + at least 1 byte encrypted
      if (packed.length < this.ivLength + this.tagLength + 1) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get encryption statistics
   * @returns {object} Stats about encryption setup
   */
  getStats() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      keyBits: this.keyLength * 8,
      ivLength: this.ivLength,
      authTagLength: this.tagLength,
      masterKeyPath: this.masterKeyPath,
      masterKeyExists: fs.existsSync(this.masterKeyPath)
    };
  }
}

module.exports = { SessionEncryptor };

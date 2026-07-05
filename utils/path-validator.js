/**
 * Path Validation Module
 *
 * Prevents path traversal attacks by validating all file system paths against:
 * - Real path resolution (eliminates ../ and symlink escapes)
 * - Whitelist of allowed directories
 * - Absolute path restrictions
 * - Symlink validation
 *
 * Security Requirements:
 * - All file operations must validate paths before execution
 * - Violations are logged for security audit
 * - Configurable allowed directories with sensible defaults
 *
 * @module utils/path-validator
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

class PathValidator extends EventEmitter {
  /**
   * Initialize path validator with allowed directories
   *
   * @param {Object} options - Configuration options
   * @param {Array<string>} options.allowedDirs - Absolute paths to allowed directories
   * @param {boolean} options.strict - Strict mode (default: true)
   * @param {boolean} options.logViolations - Log security violations (default: true)
   * @param {Function} options.violationHandler - Custom handler for violations
   */
  constructor(options = {}) {
    super();

    const homeDir = os.homedir();

    this.allowedDirs = options.allowedDirs || [
      path.join(homeDir, 'tmp'),
      path.join(process.cwd(), 'tmp'),
      path.join(process.cwd(), 'exports'),
      path.join(process.cwd(), 'logs'),
      path.join(process.cwd(), 'data')
    ];

    this.strict = options.strict !== false;
    this.logViolations = options.logViolations !== false;
    this.violationHandler = options.violationHandler || this._defaultViolationHandler;

    // Track violations for audit trail
    this.violations = [];
    this.stats = {
      totalValidations: 0,
      passedValidations: 0,
      failedValidations: 0
    };

    this._logInfo('Path validator initialized', {
      allowedDirs: this.allowedDirs,
      strict: this.strict
    });
  }

  /**
   * Validate a file path for security
   *
   * @param {string} filePath - Path to validate
   * @param {string} operation - Operation type (read, write, delete)
   * @returns {Object} { valid: boolean, error: string|null, realPath: string|null }
   */
  validatePath(filePath, operation = 'read') {
    this.stats.totalValidations++;

    try {
      // Validate input
      if (!filePath || typeof filePath !== 'string') {
        return this._violation('Invalid path: must be a non-empty string', filePath, operation);
      }

      // Resolve to absolute path
      const resolvedPath = path.resolve(filePath);

      // Check for null bytes (path traversal attempt)
      if (filePath.includes('\0')) {
        return this._violation('Null byte detected in path', filePath, operation);
      }

      // Check if path contains ../ after resolution (shouldn't happen with path.resolve)
      if (filePath.includes('..')) {
        return this._violation('Path contains parent directory references', filePath, operation);
      }

      // Verify path is within allowed directories
      const isAllowed = this._isPathAllowed(resolvedPath);
      if (!isAllowed) {
        return this._violation(
          `Path is outside allowed directories: ${this.allowedDirs.join(', ')}`,
          filePath,
          operation
        );
      }

      // Check for symlink escapes (on write/delete operations)
      if ((operation === 'write' || operation === 'delete') && fs.existsSync(resolvedPath)) {
        try {
          const stats = fs.lstatSync(resolvedPath);
          if (stats.isSymbolicLink()) {
            const realPath = fs.realpathSync(resolvedPath);
            if (!this._isPathAllowed(realPath)) {
              return this._violation(
                'Symlink target is outside allowed directories',
                filePath,
                operation
              );
            }
          }
        } catch (err) {
          return this._violation(`Failed to check symlink: ${err.message}`, filePath, operation);
        }
      }

      // Validate parent directory exists or can be created (for write operations)
      if (operation === 'write') {
        const parentDir = path.dirname(resolvedPath);
        if (!fs.existsSync(parentDir)) {
          if (!this._isPathAllowed(parentDir)) {
            return this._violation(
              'Parent directory is outside allowed locations',
              filePath,
              operation
            );
          }
        }
      }

      this.stats.passedValidations++;
      return {
        valid: true,
        error: null,
        realPath: resolvedPath
      };
    } catch (err) {
      return this._violation(`Validation error: ${err.message}`, filePath, operation);
    }
  }

  /**
   * Validate multiple paths
   *
   * @param {Array<string>} paths - Paths to validate
   * @param {string} operation - Operation type
   * @returns {Object} { valid: boolean, errors: Array, validPaths: Array }
   */
  validatePaths(paths, operation = 'read') {
    const results = {
      valid: true,
      errors: [],
      validPaths: []
    };

    if (!Array.isArray(paths)) {
      results.valid = false;
      results.errors.push('Paths must be an array');
      return results;
    }

    for (const filePath of paths) {
      const validation = this.validatePath(filePath, operation);
      if (!validation.valid) {
        results.valid = false;
        results.errors.push({
          path: filePath,
          error: validation.error
        });
      } else {
        results.validPaths.push(validation.realPath);
      }
    }

    return results;
  }

  /**
   * Add allowed directory
   *
   * @param {string} directory - Absolute path to directory
   * @returns {boolean} Success
   */
  addAllowedDir(directory) {
    try {
      const resolvedDir = path.resolve(directory);

      // Verify directory exists
      if (!fs.existsSync(resolvedDir)) {
        this._logWarning('Allowed directory does not exist', { directory: resolvedDir });
        return false;
      }

      // Verify it's a directory
      const stats = fs.statSync(resolvedDir);
      if (!stats.isDirectory()) {
        this._logWarning('Path is not a directory', { path: resolvedDir });
        return false;
      }

      // Check for duplicates
      if (this.allowedDirs.some(d => path.resolve(d) === resolvedDir)) {
        return true;
      }

      this.allowedDirs.push(resolvedDir);
      this._logInfo('Added allowed directory', { directory: resolvedDir });
      this.emit('allowed-dir:added', { directory: resolvedDir });

      return true;
    } catch (err) {
      this._logError('Failed to add allowed directory', { directory, error: err.message });
      return false;
    }
  }

  /**
   * Remove allowed directory
   *
   * @param {string} directory - Absolute path to directory
   * @returns {boolean} Success
   */
  removeAllowedDir(directory) {
    const resolvedDir = path.resolve(directory);
    const index = this.allowedDirs.findIndex(d => path.resolve(d) === resolvedDir);

    if (index !== -1) {
      this.allowedDirs.splice(index, 1);
      this._logInfo('Removed allowed directory', { directory: resolvedDir });
      this.emit('allowed-dir:removed', { directory: resolvedDir });
      return true;
    }

    return false;
  }

  /**
   * Get current allowed directories
   *
   * @returns {Array<string>} Allowed directories
   */
  getAllowedDirs() {
    return [...this.allowedDirs];
  }

  /**
   * Get validation statistics
   *
   * @returns {Object} Statistics
   */
  getStats() {
    const failureRate = this.stats.totalValidations > 0
      ? ((this.stats.failedValidations / this.stats.totalValidations) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      failureRate: `${failureRate}%`,
      violationCount: this.violations.length
    };
  }

  /**
   * Get recent violations
   *
   * @param {number} count - Number of recent violations to return
   * @returns {Array<Object>} Recent violations
   */
  getViolations(count = 10) {
    return this.violations.slice(-count);
  }

  /**
   * Clear violation history
   */
  clearViolations() {
    this.violations = [];
    this._logInfo('Violation history cleared');
  }

  /**
   * Check if path is within allowed directories
   *
   * @private
   * @param {string} filePath - Resolved absolute path
   * @returns {boolean} Is allowed
   */
  _isPathAllowed(filePath) {
    return this.allowedDirs.some(allowedDir => {
      const resolvedAllowed = path.resolve(allowedDir);
      // Normalize paths for comparison
      const normalizedFile = path.normalize(filePath);
      const normalizedAllowed = path.normalize(resolvedAllowed);

      // Check if filePath is within allowedDir
      return (
        normalizedFile === normalizedAllowed ||
        normalizedFile.startsWith(normalizedAllowed + path.sep)
      );
    });
  }

  /**
   * Handle validation violation
   *
   * @private
   * @param {string} reason - Violation reason
   * @param {string} filePath - Path that failed validation
   * @param {string} operation - Operation type
   * @returns {Object} Violation result
   */
  _violation(reason, filePath, operation) {
    this.stats.failedValidations++;

    const violation = {
      timestamp: new Date().toISOString(),
      reason,
      filePath,
      operation,
      stackTrace: new Error().stack
    };

    this.violations.push(violation);

    if (this.logViolations) {
      this._logError('Path validation violation', {
        reason,
        filePath,
        operation
      });
    }

    this.emit('violation', violation);

    if (typeof this.violationHandler === 'function') {
      this.violationHandler(violation);
    }

    return {
      valid: false,
      error: reason,
      realPath: null
    };
  }

  /**
   * Default violation handler
   *
   * @private
   */
  _defaultViolationHandler(violation) {
    // Default behavior: log and emit event (already done above)
    // Subclasses can override this
  }

  /**
   * Logging helpers
   *
   * @private
   */
  _logInfo(message, data = {}) {
    if (this.logViolations) {
      console.log(`[PathValidator] INFO: ${message}`, data);
    }
  }

  _logWarning(message, data = {}) {
    console.warn(`[PathValidator] WARNING: ${message}`, data);
  }

  _logError(message, data = {}) {
    console.error(`[PathValidator] ERROR: ${message}`, data);
  }
}

/**
 * Singleton instance
 */
let instance = null;

/**
 * Get or create singleton instance
 *
 * @param {Object} options - Configuration options
 * @returns {PathValidator} Singleton instance
 */
function getInstance(options = {}) {
  if (!instance) {
    instance = new PathValidator(options);
  }
  return instance;
}

/**
 * Wrapper functions for common use cases
 */

/**
 * Validate a path for reading
 *
 * @param {string} filePath - Path to validate
 * @returns {Object} { valid: boolean, error: string|null, realPath: string|null }
 */
function validateReadPath(filePath) {
  return getInstance().validatePath(filePath, 'read');
}

/**
 * Validate a path for writing
 *
 * @param {string} filePath - Path to validate
 * @returns {Object} { valid: boolean, error: string|null, realPath: string|null }
 */
function validateWritePath(filePath) {
  return getInstance().validatePath(filePath, 'write');
}

/**
 * Validate a path for deletion
 *
 * @param {string} filePath - Path to validate
 * @returns {Object} { valid: boolean, error: string|null, realPath: string|null }
 */
function validateDeletePath(filePath) {
  return getInstance().validatePath(filePath, 'delete');
}

/**
 * Safe file read wrapper
 *
 * @param {string} filePath - Path to read
 * @param {string} encoding - File encoding (default: utf8)
 * @param {PathValidator} validator - Optional custom validator instance
 * @returns {Object} { success: boolean, data: string|null, error: string|null }
 */
function safeReadFile(filePath, encoding = 'utf8', validator = null) {
  const v = validator || getInstance();
  const validation = v.validatePath(filePath, 'read');
  if (!validation.valid) {
    return {
      success: false,
      data: null,
      error: validation.error
    };
  }

  try {
    const data = fs.readFileSync(validation.realPath, encoding);
    return {
      success: true,
      data,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: err.message
    };
  }
}

/**
 * Safe file write wrapper
 *
 * @param {string} filePath - Path to write
 * @param {string|Buffer} content - Content to write
 * @param {Object} options - Write options
 * @param {PathValidator} options.validator - Optional custom validator instance
 * @returns {Object} { success: boolean, path: string|null, error: string|null }
 */
function safeWriteFile(filePath, content, options = {}) {
  const v = options.validator || getInstance();
  const validation = v.validatePath(filePath, 'write');
  if (!validation.valid) {
    return {
      success: false,
      path: null,
      error: validation.error
    };
  }

  try {
    const dir = path.dirname(validation.realPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(validation.realPath, content, options.encoding || 'utf8');
    return {
      success: true,
      path: validation.realPath,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      path: null,
      error: err.message
    };
  }
}

module.exports = {
  PathValidator,
  getInstance,
  validateReadPath,
  validateWritePath,
  validateDeletePath,
  safeReadFile,
  safeWriteFile
};

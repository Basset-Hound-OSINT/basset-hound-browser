/**
 * Path Traversal Prevention
 *
 * Validates file paths to prevent directory traversal attacks.
 * Ensures all file operations stay within designated safe directories.
 *
 * Protections:
 * - Prevents ../ path traversal
 * - Blocks symlink attacks
 * - Enforces absolute path resolution
 * - Sanitizes filenames
 * - Validates against safe directory whitelist
 */

const path = require('path');
const fs = require('fs');

class PathValidator {
  /**
   * Define safe directories for file operations
   */
  static SAFE_DIRS = {
    screenshots: 'screenshots',
    recordings: 'recordings',
    exports: 'exports',
    sessions: 'sessions',
    downloads: 'downloads',
    logs: 'logs',
    cache: 'cache',
    profiles: 'profiles'
  };

  /**
   * Get the base application directory
   * @param {string} appBaseDir - Optional custom base directory
   * @returns {string} Absolute path to .basset-hound directory
   */
  static getAppBaseDir(appBaseDir = null) {
    if (appBaseDir) {
      return path.resolve(appBaseDir);
    }
    return path.join(process.cwd(), '.basset-hound');
  }

  /**
   * Get safe directory path
   * @param {string} dirType - Type of directory (e.g., 'screenshots')
   * @param {string} appBaseDir - Optional base directory
   * @returns {string} Absolute path to safe directory
   */
  static getSafeDirPath(dirType, appBaseDir = null) {
    const baseDir = PathValidator.getAppBaseDir(appBaseDir);
    const safeDirName = PathValidator.SAFE_DIRS[dirType];

    if (!safeDirName) {
      throw new Error(`Unknown directory type: ${dirType}. Valid types: ${Object.keys(PathValidator.SAFE_DIRS).join(', ')}`);
    }

    return path.join(baseDir, safeDirName);
  }

  /**
   * Validate a file path
   * Ensures the path:
   * - Resolves to an absolute path
   * - Is within the allowed base directory
   * - Does not contain symlinks in the traversal
   * - Does not use path traversal (..)
   *
   * @param {string} inputPath - User-provided path
   * @param {string} baseDir - Base directory to validate against
   * @param {boolean} followSymlinks - Allow symlinks (default: false)
   * @returns {Object} { valid: boolean, path?: string, error?: string }
   */
  static validatePath(inputPath, baseDir, followSymlinks = false) {
    try {
      // Validate inputs
      if (!inputPath || typeof inputPath !== 'string') {
        return { valid: false, error: 'Path must be a non-empty string' };
      }

      if (!baseDir || typeof baseDir !== 'string') {
        return { valid: false, error: 'Base directory must be a non-empty string' };
      }

      // Resolve to absolute paths
      const baseAbsolute = path.resolve(baseDir);
      let inputAbsolute = path.resolve(inputPath);

      // Check for null bytes (null byte injection)
      if (inputPath.includes('\0') || baseDir.includes('\0')) {
        return { valid: false, error: 'Null byte detected in path' };
      }

      // Verify the resolved path is within base directory
      // Use path.relative to check if path escapes baseDir
      const relativePath = path.relative(baseAbsolute, inputAbsolute);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return {
          valid: false,
          error: `Path traversal detected: ${inputPath} is outside allowed directory`
        };
      }

      // Check for symlinks if not allowed
      if (!followSymlinks) {
        const stats = fs.lstatSync(inputAbsolute, { throwIfNoEntry: false });
        if (stats && stats.isSymbolicLink()) {
          return {
            valid: false,
            error: 'Symbolic links are not allowed in file paths'
          };
        }

        // Also check parent directories for symlinks
        let currentPath = inputAbsolute;
        while (currentPath !== path.dirname(currentPath)) {
          currentPath = path.dirname(currentPath);
          const currentStats = fs.lstatSync(currentPath, { throwIfNoEntry: false });
          if (currentStats && currentStats.isSymbolicLink()) {
            return {
              valid: false,
              error: `Symbolic link detected in path traversal: ${currentPath}`
            };
          }
          // Stop checking if we reach the base directory
          if (currentPath === baseAbsolute) {
            break;
          }
        }
      }

      return { valid: true, path: inputAbsolute };
    } catch (error) {
      return {
        valid: false,
        error: `Path validation error: ${error.message}`
      };
    }
  }

  /**
   * Validate a file path within a specific safe directory type
   * @param {string} inputPath - User-provided path or filename
   * @param {string} dirType - Type of directory (e.g., 'screenshots')
   * @param {string} appBaseDir - Optional application base directory
   * @param {boolean} followSymlinks - Allow symlinks (default: false)
   * @returns {Object} { valid: boolean, path?: string, error?: string }
   */
  static validatePathInSafeDir(inputPath, dirType, appBaseDir = null, followSymlinks = false) {
    try {
      const safeDir = PathValidator.getSafeDirPath(dirType, appBaseDir);
      return PathValidator.validatePath(inputPath, safeDir, followSymlinks);
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Sanitize a filename
   * Removes dangerous characters and path components
   *
   * @param {string} filename - Filename to sanitize
   * @param {Object} options - Options
   *   - maxLength: Maximum filename length (default: 255)
   *   - allowSpaces: Allow spaces (default: true)
   *   - allowUnicode: Allow non-ASCII characters (default: true)
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename, options = {}) {
    const {
      maxLength = 255,
      allowSpaces = true,
      allowUnicode = true
    } = options;

    if (!filename || typeof filename !== 'string') {
      return 'file';
    }

    let sanitized = filename;

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Remove path separators
    sanitized = sanitized.replace(/[\/\\]/g, '_');

    // Collapse multiple dots (prevent ../ tricks)
    sanitized = sanitized.replace(/\.\.+/g, '.');

    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

    // Remove dangerous characters
    const dangerousChars = ['<', '>', ':', '"', '|', '?', '*'];
    for (const char of dangerousChars) {
      sanitized = sanitized.replace(new RegExp(`\\${char}`, 'g'), '_');
    }

    // Handle spaces if not allowed
    if (!allowSpaces) {
      sanitized = sanitized.replace(/\s+/g, '_');
    }

    // Handle unicode if not allowed
    if (!allowUnicode) {
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '_');
    }

    // Remove leading/trailing dots and spaces
    sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    // Ensure we have something left
    if (!sanitized) {
      sanitized = 'file';
    }

    return sanitized;
  }

  /**
   * Validate and combine a directory path with a filename
   * @param {string} filename - User-provided filename
   * @param {string} dirType - Safe directory type
   * @param {string} appBaseDir - Optional application base directory
   * @returns {Object} { valid: boolean, path?: string, error?: string }
   */
  static validateFilePath(filename, dirType, appBaseDir = null) {
    try {
      // Sanitize the filename
      const sanitized = PathValidator.sanitizeFilename(filename);

      // Get the safe directory
      const safeDir = PathValidator.getSafeDirPath(dirType, appBaseDir);

      // Combine paths
      const fullPath = path.join(safeDir, sanitized);

      // Validate the combined path
      return PathValidator.validatePath(fullPath, safeDir);
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Create a safe directory if it doesn't exist
   * @param {string} dirType - Directory type
   * @param {string} appBaseDir - Optional base directory
   * @returns {Object} { success: boolean, path?: string, error?: string }
   */
  static ensureSafeDir(dirType, appBaseDir = null) {
    try {
      const dirPath = PathValidator.getSafeDirPath(dirType, appBaseDir);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
      }

      return { success: true, path: dirPath };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create all safe directories
   * @param {string} appBaseDir - Optional base directory
   * @returns {Object} { success: boolean, paths?: Object, errors?: Array }
   */
  static ensureAllSafeDirs(appBaseDir = null) {
    const paths = {};
    const errors = [];

    for (const dirType of Object.keys(PathValidator.SAFE_DIRS)) {
      const result = PathValidator.ensureSafeDir(dirType, appBaseDir);
      if (result.success) {
        paths[dirType] = result.path;
      } else {
        errors.push(`${dirType}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      paths: errors.length === 0 ? paths : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get information about a safe directory
   * @param {string} dirType - Directory type
   * @param {string} appBaseDir - Optional base directory
   * @returns {Object} { valid: boolean, path?: string, exists?: boolean, files?: number, error?: string }
   */
  static getDirInfo(dirType, appBaseDir = null) {
    try {
      const dirPath = PathValidator.getSafeDirPath(dirType, appBaseDir);

      const exists = fs.existsSync(dirPath);
      let files = 0;

      if (exists) {
        const entries = fs.readdirSync(dirPath);
        files = entries.length;
      }

      return {
        valid: true,
        path: dirPath,
        exists,
        files
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * List all configured safe directories
   * @param {string} appBaseDir - Optional base directory
   * @returns {Object} Map of directory types to paths
   */
  static listSafeDirs(appBaseDir = null) {
    const dirs = {};
    for (const dirType of Object.keys(PathValidator.SAFE_DIRS)) {
      dirs[dirType] = PathValidator.getSafeDirPath(dirType, appBaseDir);
    }
    return dirs;
  }
}

module.exports = { PathValidator };

/**
 * Version String Sanitizer
 * Prevents template injection and code execution in version strings
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 *
 * Security Features:
 * - Validates semantic versioning format
 * - Sanitizes dangerous template syntax
 * - Escapes HTML/JavaScript special characters
 * - Rejects suspicious patterns
 * - Only allows alphanumeric, dots, hyphens, underscores
 */

class VersionSanitizer {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 128;
    this.allowPrerelease = options.allowPrerelease !== false;
  }

  /**
   * Sanitize version string
   * @param {string} versionString - Raw version string from detection
   * @returns {object} { sanitized, valid, error, original, hasTemplate }
   */
  sanitize(versionString) {
    // Check input validity
    if (!versionString || typeof versionString !== 'string') {
      return {
        sanitized: null,
        valid: false,
        error: 'Version must be a non-empty string',
        original: versionString,
        hasTemplate: false
      };
    }

    const original = versionString;

    // Check length
    if (versionString.length > this.maxLength) {
      return {
        sanitized: null,
        valid: false,
        error: `Version exceeds maximum length of ${this.maxLength}`,
        original,
        hasTemplate: false
      };
    }

    // Check for dangerous patterns
    const dangerousCheck = this._checkDangerousPatterns(versionString);
    if (dangerousCheck.found) {
      return {
        sanitized: null,
        valid: false,
        error: dangerousCheck.error,
        original,
        hasTemplate: true
      };
    }

    // Sanitize the string
    const sanitized = this._sanitizeString(versionString);

    // Validate the result is still a valid version format
    const formatValidation = this._validateVersionFormat(sanitized);
    if (!formatValidation.valid && sanitized.trim().length > 0) {
      return {
        sanitized: null,
        valid: false,
        error: `Sanitized version is not a valid format: ${formatValidation.error}`,
        original,
        hasTemplate: false
      };
    }

    return {
      sanitized: sanitized || null,
      valid: sanitized.trim().length > 0,
      error: null,
      original,
      hasTemplate: false,
      format: formatValidation.format
    };
  }

  /**
   * Check for dangerous template/code patterns
   * @private
   */
  _checkDangerousPatterns(versionString) {
    const dangerousPatterns = [
      // Template literals
      { pattern: /\$\{/, name: 'template-literal' },
      { pattern: /\$\(/, name: 'command-substitution' },
      // Mustache/Handlebars
      { pattern: /\{\{/, name: 'handlebars' },
      { pattern: /\{%/, name: 'jinja' },
      // JSP/ERB
      { pattern: /<%/, name: 'jsp-erb' },
      // JavaScript eval/function
      { pattern: /javascript:/i, name: 'javascript-protocol' },
      { pattern: /eval\(/, name: 'eval-function' },
      { pattern: /Function\(/, name: 'function-constructor' },
      // Shell injection
      { pattern: /[;&|`]/, name: 'shell-operator' },
      // HTML/XML
      { pattern: /<script/i, name: 'script-tag' },
      { pattern: /<iframe/i, name: 'iframe-tag' },
      // XSS vectors
      { pattern: /onclick=/i, name: 'event-handler' },
      { pattern: /onload=/i, name: 'event-handler' },
      // Path traversal
      { pattern: /\.\.\//, name: 'path-traversal' },
      // Null bytes
      { pattern: /\x00/, name: 'null-byte' }
    ];

    for (const check of dangerousPatterns) {
      if (check.pattern.test(versionString)) {
        return {
          found: true,
          error: `Detected dangerous pattern: ${check.name}`,
          pattern: check.name
        };
      }
    }

    return { found: false };
  }

  /**
   * Sanitize version string
   * @private
   */
  _sanitizeString(versionString) {
    let sanitized = versionString.trim();

    // Remove leading 'v' or 'V'
    sanitized = sanitized.replace(/^v/i, '');

    // Allow only semantic versioning characters and common version formats
    // Pattern: digits, dots, hyphens (for prerelease), plus (for build metadata)
    // Examples: 1.0.0, 1.0.0-beta, 1.0.0+build, 1.0.0-beta.1, v1.0.0
    sanitized = sanitized.replace(/[^0-9.\-+a-zA-Z]/g, '');

    // Clean up multiple consecutive dots, hyphens, or plus signs
    sanitized = sanitized.replace(/\.{2,}/g, '.');
    sanitized = sanitized.replace(/\-{2,}/g, '-');
    sanitized = sanitized.replace(/\+{2,}/g, '+');

    // Remove trailing/leading special characters
    sanitized = sanitized.replace(/^[.\-+]+|[.\-+]+$/g, '');

    // Remove invalid patterns created by sanitization
    // (e.g., prerelease starting with non-alphanumeric)
    if (sanitized.includes('-')) {
      const [version, prerelease] = sanitized.split('-', 2);
      const cleanPrerelease = prerelease.replace(/^[^a-zA-Z0-9]+/, '');
      if (cleanPrerelease) {
        sanitized = `${version}-${cleanPrerelease}`;
      } else {
        sanitized = version;
      }
    }

    return sanitized;
  }

  /**
   * Validate version format after sanitization
   * @private
   */
  _validateVersionFormat(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return { valid: false, error: 'Invalid input', format: null };
    }

    const trimmed = versionString.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Empty version', format: null };
    }

    // Semantic versioning: X.Y.Z with optional prerelease and metadata
    // Examples: 1.0.0, 1.0.0-beta, 1.0.0-beta.1, 1.0.0+build
    const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

    if (semverPattern.test(trimmed)) {
      return { valid: true, format: 'semver' };
    }

    // Revision numbers (e.g., r73, R123)
    const revisionPattern = /^r\d+$/i;
    if (revisionPattern.test(trimmed)) {
      return { valid: true, format: 'revision' };
    }

    // Two-part version (e.g., 3.5, 2.1)
    const twoPartPattern = /^\d+\.\d+$/;
    if (twoPartPattern.test(trimmed)) {
      return { valid: true, format: 'two-part' };
    }

    // Single number version (e.g., 5, 12)
    const singlePattern = /^\d+$/;
    if (singlePattern.test(trimmed)) {
      return { valid: true, format: 'single' };
    }

    return { valid: false, error: 'Does not match known version format', format: null };
  }

  /**
   * Escape version string for HTML output
   * @param {string} versionString - Version string to escape
   * @returns {string} HTML-escaped version
   */
  escapeForHTML(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return '';
    }

    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    };

    return versionString.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char]);
  }

  /**
   * Escape version string for JavaScript output
   * @param {string} versionString - Version string to escape
   * @returns {string} JavaScript-escaped version
   */
  escapeForJavaScript(versionString) {
    if (!versionString || typeof versionString !== 'string') {
      return '';
    }

    return versionString
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * Format version for safe display
   * @param {string} versionString - Version string
   * @returns {string} Formatted version safe for display
   */
  formatForDisplay(versionString) {
    const sanitized = this.sanitize(versionString);

    if (!sanitized.valid) {
      return '[Invalid Version]';
    }

    // HTML escape the sanitized version
    return this.escapeForHTML(sanitized.sanitized);
  }
}

module.exports = VersionSanitizer;

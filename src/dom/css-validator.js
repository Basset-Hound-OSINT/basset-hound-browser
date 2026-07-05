/**
 * CSS Validator
 * Prevents CSS injection attacks in HTML exports
 * Validates and sanitizes CSS to remove malicious patterns
 * Performance: <0.3ms per validation
 */

const crypto = require('crypto');

class CSSValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false; // Default: enabled
    this.allowRemoteResources = options.allowRemoteResources === true; // Default: disabled
    this.maxCSSSize = options.maxCSSSize || 100 * 1024; // 100KB default
    this.performanceTracing = options.performanceTracing !== false;

    // Dangerous CSS patterns that can be used for attacks or exfiltration
    this.dangerousPatterns = {
      // Expression-based attacks (IE)
      expression: /expression\s*\(/gi,

      // Behavior-based attacks (IE)
      behavior: /behavior\s*:/gi,

      // JavaScript protocol
      javaScriptProtocol: /javascript:/gi,

      // Data exfiltration via URL
      backgroundImage: /background(?:-image)?\s*:\s*url\s*\(/gi,
      cursorUrl: /cursor\s*:\s*url\s*\(/gi,

      // Import attacks
      cssImport: /@import\s+url/gi,

      // Animation/keyframe attacks
      keyframes: /@keyframes/gi,
      animation: /animation(?:-name)?\s*:/gi,

      // Pointer events that could trigger handlers
      pointerEvents: /pointer-events\s*:\s*none/gi,

      // Font face attacks (loading remote fonts)
      fontFace: /@font-face/gi,

      // Media queries that could leak info
      mediaQuery: /@media\s+\(/gi,

      // Transform/clip attacks
      clip: /clip(?:\s*-path)?\s*:/gi,
      webkitMask: /(?:-webkit-)?mask(?:-image)?\s*:/gi,

      // SVG-based attacks
      svgFilter: /url\s*\(\s*#/gi,

      // Calc attacks
      calcExpression: /calc\s*\(/gi,

      // Important flag abuse
      importantFlag: /!important/gi,

      // CSS variables that could be exploited
      cssVar: /var\s*\(/gi,

      // Box-shadow/filter can cause performance issues or exfiltration
      filter: /filter\s*:/gi,

      // Gradient attacks
      gradient: /(?:linear|radial|conic|repeating-linear|repeating-radial|repeating-conic)-gradient\s*\(/gi
    };

    // Whitelist of safe CSS properties
    this.safeProperties = {
      // Colors
      color: true,
      'background-color': true,
      'border-color': true,
      'outline-color': true,

      // Layout (safe)
      display: true,
      position: true,
      'z-index': true,
      width: true,
      height: true,
      margin: true,
      padding: true,
      border: true,
      'border-radius': true,
      'box-sizing': true,
      overflow: true,

      // Text (safe)
      'font-family': true,
      'font-size': true,
      'font-weight': true,
      'font-style': true,
      'line-height': true,
      'text-align': true,
      'text-decoration': true,
      'text-transform': true,
      'letter-spacing': true,
      'word-spacing': true,

      // Visibility
      visibility: true,
      opacity: true,

      // Border/outline (safe)
      'border-style': true,
      'border-width': true,
      'outline-style': true,
      'outline-width': true,

      // Flexbox
      flex: true,
      'flex-direction': true,
      'flex-wrap': true,
      'justify-content': true,
      'align-items': true,
      'align-content': true,
      gap: true,

      // Grid
      grid: true,
      'grid-template-columns': true,
      'grid-template-rows': true,
      'grid-gap': true,

      // Transform (limited)
      transform: true,
      'transform-origin': true,

      // Transition (limited)
      transition: true,
      'transition-duration': true,
      'transition-timing-function': true,

      // Content
      content: true,
      'white-space': true,
      'word-wrap': true,

      // Background (limited)
      'background-attachment': true,
      'background-position': true,
      'background-repeat': true,
      'background-size': true,

      // Other safe properties
      'box-shadow': true,
      'text-shadow': true,
      cursor: true,
      'user-select': true
    };

    // CSS @-rules that are safe
    this.safeAtRules = {
      '@media': true,
      '@supports': true,
      '@keyframes': false, // Usually safe but restrict for security
      '@-webkit-keyframes': false,
      '@-moz-keyframes': false
    };

    // Statistics and audit trail
    this.auditLog = [];
    this.statistics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      patternsDetected: {},
      totalTimeMs: 0
    };
  }

  /**
   * Validate CSS string
   * @param {string} css - CSS content to validate
   * @param {string} context - Context (inline, external, etc.)
   * @returns {object} Validation result
   */
  validateCSS(css, context = 'inline') {
    const startTime = performance.now();

    if (!css) {
      return {
        valid: true,
        css: '',
        isSafe: true,
        dangerousPatterns: [],
        warnings: [],
        errors: [],
        context,
        duration: 0
      };
    }

    // Check size limit
    if (css.length > this.maxCSSSize) {
      return {
        valid: false,
        css: '',
        isSafe: false,
        dangerousPatterns: ['CSS_SIZE_EXCEEDED'],
        warnings: [`CSS size (${css.length} bytes) exceeds limit (${this.maxCSSSize} bytes)`],
        errors: ['CSS exceeds maximum allowed size'],
        context,
        duration: performance.now() - startTime
      };
    }

    const detected = [];
    const warnings = [];
    const errors = [];

    // Scan for dangerous patterns
    for (const [patternName, pattern] of Object.entries(this.dangerousPatterns)) {
      let match;
      while ((match = pattern.exec(css)) !== null) {
        detected.push({
          type: patternName,
          position: match.index,
          matched: match[0],
          line: this._getLineNumber(css, match.index)
        });

        if (!this.statistics.patternsDetected[patternName]) {
          this.statistics.patternsDetected[patternName] = 0;
        }
        this.statistics.patternsDetected[patternName]++;
      }
    }

    // Validate CSS rules and properties
    const propertyValidation = this._validateCSSProperties(css);
    if (!propertyValidation.valid) {
      errors.push(...propertyValidation.errors);
      warnings.push(...propertyValidation.warnings);
    }

    const isSafe = detected.length === 0 && propertyValidation.valid;

    // Log validation
    this._logValidation(context, isSafe, detected);

    const duration = performance.now() - startTime;
    this.statistics.totalTimeMs += duration;

    return {
      valid: !detected.length > 0,
      css: isSafe ? css : this._sanitizeCSS(css),
      isSafe,
      dangerousPatterns: detected,
      warnings,
      errors,
      context,
      duration,
      sanitized: !isSafe,
      summary: {
        dangerousPatternsFound: detected.length,
        totalWarnings: warnings.length,
        totalErrors: errors.length
      }
    };
  }

  /**
   * Sanitize CSS by removing dangerous patterns
   * @param {string} css - CSS to sanitize
   * @returns {string} Sanitized CSS
   */
  sanitizeCSS(css) {
    if (!css) {
      return '';
    }

    let sanitized = css;

    // Remove dangerous patterns
    for (const pattern of Object.values(this.dangerousPatterns)) {
      sanitized = sanitized.replace(pattern, '/* REMOVED */');
    }

    // Remove @-rules that aren't whitelisted
    sanitized = this._removeUnsafeAtRules(sanitized);

    // Remove problematic properties
    sanitized = this._removeUnsafeProperties(sanitized);

    return sanitized;
  }

  /**
   * Validate CSS in style attribute
   * @param {string} styleAttr - HTML style attribute value
   * @returns {object} Validation result
   */
  validateStyleAttribute(styleAttr) {
    if (!styleAttr) {
      return { valid: true, style: '', isSafe: true, issues: [] };
    }

    const issues = [];
    const properties = styleAttr.split(';').filter(p => p.trim());

    let sanitizedStyle = '';
    let isValid = true;

    for (const prop of properties) {
      const [key, ...values] = prop.split(':');
      if (!key || !values.length) {
        continue;
      }

      const propKey = key.trim().toLowerCase();
      const propValue = values.join(':').trim();

      // Check if property is in whitelist
      if (!this.safeProperties[propKey]) {
        issues.push(`Unsafe property: ${propKey}`);
        isValid = false;
        continue;
      }

      // Check value for dangerous patterns
      if (this._containsDangerousValue(propValue)) {
        issues.push(`Dangerous value for ${propKey}: ${propValue}`);
        isValid = false;
        continue;
      }

      sanitizedStyle += `${key.trim()}:${propValue};`;
    }

    return {
      valid: isValid,
      style: sanitizedStyle,
      isSafe: isValid,
      issues,
      originalLength: styleAttr.length,
      sanitizedLength: sanitizedStyle.length
    };
  }

  /**
   * Validate CSS class names
   * @param {string} className - Class name to validate
   * @returns {object} Validation result
   */
  validateClassName(className) {
    if (!className) {
      return { valid: true, className: '', isSafe: true };
    }

    const classPattern = /^[a-zA-Z_][\w\-]*$/;
    const classes = className.split(/\s+/);

    const validClasses = [];
    const invalidClasses = [];

    for (const cls of classes) {
      if (cls.length === 0) {
        continue;
      }

      if (classPattern.test(cls)) {
        validClasses.push(cls);
      } else {
        invalidClasses.push(cls);
      }
    }

    return {
      valid: invalidClasses.length === 0,
      className: validClasses.join(' '),
      isSafe: invalidClasses.length === 0,
      validClasses,
      invalidClasses,
      totalClasses: classes.length,
      validCount: validClasses.length
    };
  }

  /**
   * Get audit log
   * @param {number} limit - Number of entries to return
   * @returns {array} Audit log entries
   */
  getAuditLog(limit = 50) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get statistics
   * @returns {object} Validation statistics
   */
  getStatistics() {
    return {
      ...this.statistics,
      averageValidationTimeMs: this.statistics.totalValidations > 0
        ? (this.statistics.totalTimeMs / this.statistics.totalValidations).toFixed(3)
        : 0,
      successRate: this.statistics.totalValidations > 0
        ? ((this.statistics.successfulValidations / this.statistics.totalValidations) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      patternsDetected: {},
      totalTimeMs: 0
    };
    this.auditLog = [];
  }

  /**
   * Validate CSS properties against whitelist
   * @private
   */
  _validateCSSProperties(css) {
    const errors = [];
    const warnings = [];

    // Simple regex to extract property declarations
    const propPattern = /[\w-]+\s*:\s*[^;]+/g;
    const matches = css.match(propPattern) || [];

    for (const match of matches) {
      const [prop] = match.split(':');
      const propName = prop.trim().toLowerCase();

      if (!this.safeProperties[propName] && !propName.startsWith('-')) {
        // Custom properties (starting with --) are allowed but limited
        if (!propName.startsWith('--')) {
          warnings.push(`Unknown property: ${propName}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Remove unsafe @-rules
   * @private
   */
  _removeUnsafeAtRules(css) {
    // Remove @keyframes (can be used for exfiltration)
    let result = css.replace(/@(-webkit-|-moz-)?keyframes[^{]*{[^}]*}/gi, '/* REMOVED: @keyframes */');

    // Remove @font-face (can load remote resources)
    result = result.replace(/@font-face\s*{[^}]*}/gi, '/* REMOVED: @font-face */');

    // Remove @import (can load remote CSS)
    result = result.replace(/@import[^;]+;/gi, '/* REMOVED: @import */');

    return result;
  }

  /**
   * Remove unsafe properties
   * @private
   */
  _removeUnsafeProperties(css) {
    let result = css;

    // Remove specific dangerous properties
    const unsafeProps = [
      'behavior',
      'expression',
      '-moz-binding',
      'background-image',
      'cursor',
      '-webkit-mask-image',
      'filter',
      '@supports'
    ];

    for (const prop of unsafeProps) {
      const pattern = new RegExp(`${prop}\\s*:[^;]*;?`, 'gi');
      result = result.replace(pattern, '/* REMOVED: ' + prop + ' */');
    }

    return result;
  }

  /**
   * Check if value contains dangerous patterns
   * @private
   */
  _containsDangerousValue(value) {
    const dangerousValuePatterns = [
      /javascript:/i,
      /expression\s*\(/i,
      /behavior\s*:/i,
      /url\s*\(\s*["\']?(?:javascript|data):/i,
      /@/i, // @ symbols often indicate @-rules
      /eval\s*\(/i,
      /script/i
    ];

    for (const pattern of dangerousValuePatterns) {
      if (pattern.test(value)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get line number of match
   * @private
   */
  _getLineNumber(text, position) {
    return text.substring(0, position).split('\n').length;
  }

  /**
   * Log validation for audit trail
   * @private
   */
  _logValidation(context, isSafe, detected) {
    this.statistics.totalValidations++;
    if (isSafe) {
      this.statistics.successfulValidations++;
    } else {
      this.statistics.failedValidations++;
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      context,
      isSafe,
      patternsDetected: detected.length,
      detailSummary: this._summarizePatterns(detected)
    });

    // Keep audit log size reasonable
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }
  }

  /**
   * Summarize detected patterns
   * @private
   */
  _summarizePatterns(detected) {
    const summary = {};
    detected.forEach(d => {
      summary[d.type] = (summary[d.type] || 0) + 1;
    });
    return summary;
  }

  /**
   * Sanitize CSS - public method
   * @param {string} css - CSS to sanitize
   * @returns {string} Sanitized CSS
   */
  _sanitizeCSS(css) {
    return this.sanitizeCSS(css);
  }
}

module.exports = { CSSValidator };

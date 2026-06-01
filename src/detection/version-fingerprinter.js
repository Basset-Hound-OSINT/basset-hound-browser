/**
 * Technology Version Fingerprinter
 *
 * Extracts detailed version information from detected technologies using multiple strategies:
 * - JavaScript global version variables (React.version, jQuery.fn.jquery, etc.)
 * - HTTP response headers (Server, X-Powered-By headers)
 * - File path patterns (/jquery-3.5.1.min.js, /bootstrap.min.css?v=4.6.0)
 * - CSS meta tags (<link rel="stylesheet" href="/bootstrap-4.6.0.min.css">)
 * - HTML meta tags (<meta name="generator" content="WordPress 5.8">)
 * - HTML comments (<!-- WordPress 5.9.2 -->)
 * - Package.json or similar manifest files
 *
 * Normalizes versions for comparison:
 * - 5.8 vs 5.8.0 normalization
 * - v prefix removal
 * - Pre-release/RC handling
 *
 * Confidence scoring per detection method
 *
 * @module version-fingerprinter
 */

const { createLogger } = require('../../logging');
const VersionSanitizer = require('./version-sanitizer'); // SECURITY FIX: Version sanitization

class VersionFingerprinter {
  constructor(options = {}) {
    this.logger = createLogger('VersionFingerprinter');
    this.includePrerelease = options.includePrerelease !== false;
    this.normalizeVersions = options.normalizeVersions !== false;
    this.sanitizer = new VersionSanitizer(); // SECURITY FIX: Initialize version sanitizer
  }

  /**
   * Extract version information for a detected technology
   * @param {string} techName - Technology name (e.g., 'React', 'WordPress')
   * @param {object} detectionMethod - How technology was detected
   * @param {string} detectionMethod.type - Detection type (header, html, script, etc.)
   * @param {string} detectionMethod.value - The detected value
   * @param {string} versionString - Optional pre-extracted version string
   * @param {object} pageData - Complete page data (headers, html, etc.)
   * @returns {object} Version information with confidence
   */
  fingerprint(techName, detectionMethod, versionString, pageData = {}) {
    if (!techName) {
      return { success: false, error: 'Technology name required' };
    }

    try {
      const results = [];

      // Try multiple extraction strategies
      if (pageData.headers) {
        results.push(...this._extractFromHeaders(techName, pageData.headers));
      }

      if (pageData.html) {
        results.push(...this._extractFromHTML(techName, pageData.html));
      }

      if (pageData.scripts) {
        results.push(...this._extractFromScripts(techName, pageData.scripts));
      }

      if (detectionMethod && detectionMethod.value) {
        results.push(...this._extractFromValue(techName, detectionMethod.value, detectionMethod.type));
      }

      if (versionString) {
        results.push({
          version: this._normalizeVersion(versionString),
          method: 'provided',
          confidence: 0.85,
          raw: versionString
        });
      }

      // Sort by confidence and return best match
      results.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      if (results.length === 0) {
        return {
          success: true,
          version: null,
          confidence: 0,
          methods: [],
          allResults: []
        };
      }

      const best = results[0];

      return {
        success: true,
        version: best.version,
        confidence: best.confidence,
        method: best.method,
        raw: best.raw,
        alternatives: results.slice(1, 3),
        allResults: results,
        normalized: this.normalizeVersions
      };
    } catch (error) {
      this.logger.error('version_extraction_failed', {
        tech: techName,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        version: null,
        confidence: 0
      };
    }
  }

  /**
   * Extract version from HTTP headers
   * @private
   */
  _extractFromHeaders(techName, headers) {
    const results = [];
    if (!headers || typeof headers !== 'object') {
      return results;
    }

    const patterns = this._getHeaderPatterns(techName);

    Object.entries(headers).forEach(([headerName, headerValue]) => {
      if (!headerValue) return;
      const headerStr = String(headerValue);

      patterns.forEach(pattern => {
        const match = headerStr.match(pattern.regex);
        if (match && match[1]) {
          results.push({
            version: this._normalizeVersion(match[1]),
            method: `header:${headerName.toLowerCase()}`,
            confidence: pattern.confidence,
            raw: match[1],
            header: headerName
          });
        }
      });
    });

    return results;
  }

  /**
   * Extract version from HTML content
   * @private
   */
  _extractFromHTML(techName, html) {
    const results = [];
    if (!html || typeof html !== 'string') {
      return results;
    }

    const patterns = this._getHTMLPatterns(techName);

    patterns.forEach(pattern => {
      const regex = new RegExp(pattern.regex, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        if (match[1]) {
          results.push({
            version: this._normalizeVersion(match[1]),
            method: pattern.method,
            confidence: pattern.confidence,
            raw: match[1]
          });
        }
      }
    });

    return results;
  }

  /**
   * Extract version from script paths and URLs
   * @private
   */
  _extractFromScripts(techName, scripts) {
    const results = [];
    if (!Array.isArray(scripts)) {
      return results;
    }

    scripts.forEach(script => {
      if (typeof script !== 'string') return;

      const patterns = this._getScriptPatterns(techName);
      patterns.forEach(pattern => {
        const match = script.match(pattern.regex);
        if (match && match[1]) {
          results.push({
            version: this._normalizeVersion(match[1]),
            method: `script:${pattern.type}`,
            confidence: pattern.confidence,
            raw: match[1],
            source: script.substring(0, 100)
          });
        }
      });
    });

    return results;
  }

  /**
   * Extract version from the detection method value
   * @private
   */
  _extractFromValue(techName, value, type) {
    const results = [];
    if (!value) return results;

    const str = String(value);
    const patterns = this._getValuePatterns(techName);

    patterns.forEach(pattern => {
      const match = str.match(pattern.regex);
      if (match && match[1]) {
        results.push({
          version: this._normalizeVersion(match[1]),
          method: `value:${type}`,
          confidence: pattern.confidence,
          raw: match[1]
        });
      }
    });

    return results;
  }

  /**
   * Get header patterns for version extraction
   * @private
   */
  _getHeaderPatterns(techName) {
    const patterns = {
      // Servers
      'Nginx': [{ regex: /nginx[\s\/]+([\d.]+)/i, confidence: 0.95 }],
      'Apache': [{ regex: /Apache[\s\/]+([\d.]+)/i, confidence: 0.95 }],
      'IIS': [{ regex: /IIS[\s\/]+([\d.]+)/i, confidence: 0.95 }],
      'Node.js': [{ regex: /Node[\s\/]+([\d.]+)/i, confidence: 0.92 }],

      // Languages
      'PHP': [
        { regex: /PHP[\s\/]+([\d.]+)/i, confidence: 0.95 },
        { regex: /php[\s\/]+([\d.]+)/i, confidence: 0.92 }
      ],
      'Python': [{ regex: /Python[\s\/]+([\d.]+)/i, confidence: 0.90 }],

      // Frameworks
      'Django': [{ regex: /Django[\s\/]+([\d.]+)/i, confidence: 0.85 }],
      'Express': [{ regex: /Express[\s\/]+([\d.]+)/i, confidence: 0.80 }],

      // CMS
      'WordPress': [
        { regex: /WordPress[\s\/]+([\d.]+)/i, confidence: 0.85 },
        { regex: /wp-version[\s=]+([\d.]+)/i, confidence: 0.80 }
      ]
    };

    return patterns[techName] || [];
  }

  /**
   * Get HTML patterns for version extraction
   * @private
   */
  _getHTMLPatterns(techName) {
    const patterns = {
      // CMS
      'WordPress': [
        { regex: 'generator.*?WordPress\\s+([\\d.]+)', method: 'meta:generator', confidence: 0.92 },
        { regex: 'wp-content/plugins.*?v=([\d.]+)', method: 'plugin-url', confidence: 0.80 },
        { regex: '<!--\\s*WordPress\\s+([\\d.]+)\\s*-->', method: 'html-comment', confidence: 0.90 }
      ],
      'Drupal': [
        { regex: 'generator.*?Drupal\\s+([\\d.]+)', method: 'meta:generator', confidence: 0.92 },
        { regex: 'drupal-version["\']?\\s*[=:]\\s*["\']?([\\d.]+)', method: 'meta-attribute', confidence: 0.85 }
      ],
      'Joomla': [
        { regex: 'generator.*?Joomla!\\s+([\\d.]+)', method: 'meta:generator', confidence: 0.92 },
        { regex: 'joomla-version["\']?\\s*[=:]\\s*["\']?([\\d.]+)', method: 'meta-attribute', confidence: 0.85 }
      ],

      // Frameworks
      'React': [
        { regex: '__REACT_DEVTOOLS_GLOBAL_HOOK__.*?version["\']?:\\s*["\']?([\\d.]+)', method: 'devtools', confidence: 0.85 },
        { regex: 'react@?/?([\\d.]+)', method: 'npm-url', confidence: 0.80 }
      ],
      'Vue.js': [
        { regex: '__VUE__.*?version["\']?:\\s*["\']?([\\d.]+)', method: 'devtools', confidence: 0.85 },
        { regex: 'vue@?/?([\\d.]+)', method: 'npm-url', confidence: 0.80 }
      ],
      'Angular': [
        { regex: 'ng-version["\']?\\s*[=:]\\s*["\']?([\\d.]+)', method: 'attribute', confidence: 0.90 },
        { regex: 'angular@?/?([\\d.]+)', method: 'npm-url', confidence: 0.80 }
      ],

      // CSS Frameworks
      'Bootstrap': [
        { regex: 'bootstrap[\\/\\.]*([\\d.]+)', method: 'filename', confidence: 0.92 },
        { regex: 'bootstrap[^/]*?v?([\\d.]+)', method: 'url-pattern', confidence: 0.85 }
      ],
      'Tailwind': [
        { regex: 'tailwind[\\/\\.]*([\\d.]+)', method: 'filename', confidence: 0.90 }
      ]
    };

    return patterns[techName] || [];
  }

  /**
   * Get script patterns for version extraction
   * @private
   */
  _getScriptPatterns(techName) {
    const patterns = {
      'jQuery': [
        { regex: /jquery[.-]?([\d.]+)(?:\.min)?\.js/i, type: 'filename', confidence: 0.95 },
        { regex: /\/jquery[.-]?([\d.]+)/i, type: 'path', confidence: 0.92 }
      ],
      'React': [
        { regex: /react[.-]?([\d.]+)(?:\.min)?\.js/i, type: 'filename', confidence: 0.93 },
        { regex: /react@([\d.]+)/i, type: 'npm', confidence: 0.90 }
      ],
      'Angular': [
        { regex: /angular[.-]?([\d.]+)(?:\.min)?\.js/i, type: 'filename', confidence: 0.93 },
        { regex: /angular@([\d.]+)/i, type: 'npm', confidence: 0.90 }
      ],
      'Bootstrap': [
        { regex: /bootstrap[.-]([\d.]+)(?:\.min)?\.css/i, type: 'filename', confidence: 0.95 },
        { regex: /bootstrap@([\d.]+)/i, type: 'npm', confidence: 0.90 }
      ],
      'D3.js': [
        { regex: /d3[.-]?(v?[\d.]+)(?:\.min)?\.js/i, type: 'filename', confidence: 0.94 }
      ],
      'Three.js': [
        { regex: /three[.-]?(r[\d]+)(?:\.min)?\.js/i, type: 'filename', confidence: 0.92 }
      ]
    };

    return patterns[techName] || [];
  }

  /**
   * Get patterns for extracting version from detection values
   * @private
   */
  _getValuePatterns(techName) {
    // Generic patterns that work for most technologies
    return [
      { regex: /\d+\.\d+\.\d+(?:-[\w.]+)?/, confidence: 0.85 },
      { regex: /v(\d+\.\d+\.\d+)/, confidence: 0.88 },
      { regex: /[\s/](\d+\.\d+)(?:\D|$)/, confidence: 0.75 }
    ];
  }

  /**
   * Normalize version strings for comparison
   * @private
   */
  _normalizeVersion(versionStr) {
    if (!versionStr) return null;

    // SECURITY FIX: Sanitize version string first
    const sanitizationResult = this.sanitizer.sanitize(String(versionStr));
    if (!sanitizationResult.valid) {
      this.logger.warn('version_sanitization_failed', {
        original: versionStr,
        error: sanitizationResult.error
      });
      return null; // Return null for invalid versions
    }

    let normalized = sanitizationResult.sanitized.trim();

    // Handle revision numbers (e.g., 'r73')
    if (/^r\d+$/i.test(normalized)) {
      return normalized.toLowerCase();
    }

    // Extract semantic version
    const semverMatch = normalized.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-.](.+))?/);
    if (!semverMatch) {
      return normalized;
    }

    const major = semverMatch[1];
    const minor = semverMatch[2] || '0';
    const patch = semverMatch[3] || '0';
    const prerelease = semverMatch[4];

    if (!this.includePrerelease && prerelease) {
      return `${major}.${minor}.${patch}`;
    }

    if (prerelease) {
      return `${major}.${minor}.${patch}-${prerelease}`;
    }

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Compare two versions for equality
   * @static
   */
  static compareVersions(v1, v2) {
    if (!v1 || !v2) return false;
    return v1.toLowerCase() === v2.toLowerCase();
  }

  /**
   * Check if version1 is greater than version2 (basic comparison)
   * @static
   */
  static isVersionGreater(v1, v2) {
    if (!v1 || !v2) return false;

    const normalize = (v) => {
      const parts = v.split(/[-.]/).map(p => {
        const num = parseInt(p, 10);
        return isNaN(num) ? 0 : num;
      });
      return [
        parts[0] || 0,
        parts[1] || 0,
        parts[2] || 0
      ];
    };

    const [v1Major, v1Minor, v1Patch] = normalize(v1);
    const [v2Major, v2Minor, v2Patch] = normalize(v2);

    if (v1Major !== v2Major) return v1Major > v2Major;
    if (v1Minor !== v2Minor) return v1Minor > v2Minor;
    return v1Patch > v2Patch;
  }

  /**
   * Check if version is within a range
   * @static
   */
  static isInVersionRange(version, minVersion, maxVersion) {
    if (!version) return false;
    if (minVersion && !VersionFingerprinter.isVersionGreater(version, minVersion) &&
        !VersionFingerprinter.compareVersions(version, minVersion)) {
      return false;
    }
    if (maxVersion && VersionFingerprinter.isVersionGreater(version, maxVersion)) {
      return false;
    }
    return true;
  }
}

module.exports = VersionFingerprinter;

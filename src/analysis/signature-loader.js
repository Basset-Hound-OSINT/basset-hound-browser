/**
 * Signature Loader - Dynamic Technology Signature Management
 * Loads technology signatures from external sources with fallback support
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const fs = require('fs').promises;
const path = require('path');

class SignatureLoader {
  constructor() {
    this.signatures = {};
    this.loadTimestamp = null;
    this.sourceFile = null;
  }

  /**
   * Load signatures from JSON file
   */
  async loadFromFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Validate and normalize signatures
      this.signatures = this.normalizeSignatures(parsed);
      this.loadTimestamp = Date.now();
      this.sourceFile = filePath;

      return {
        success: true,
        loaded: Object.keys(this.signatures).length,
        source: filePath,
        timestamp: new Date(this.loadTimestamp).toISOString()
      };
    } catch (error) {
      console.error(`Failed to load signatures from ${filePath}:`, error.message);
      return {
        success: false,
        error: error.message,
        source: filePath
      };
    }
  }

  /**
   * Normalize signatures to standard format
   */
  normalizeSignatures(raw) {
    const normalized = {};

    for (const [id, sig] of Object.entries(raw)) {
      // Ensure required fields exist
      normalized[id] = {
        name: sig.name || sig.cats?.join('/') || id,
        category: Array.isArray(sig.cats)
          ? sig.cats[0]
          : typeof sig.cats === 'string'
            ? sig.cats
            : sig.category || 'Unknown',

        headers: this.normalizeHeaders(sig.headers || {}),
        html: this.normalizeHtml(sig.html),
        js: this.normalizeJs(sig.js),
        favicon: sig.favicon || null,
        cpe: sig.cpe || null,
        versions: sig.versions || null
      };

      // Copy over optional fields
      if (sig.description) {
        normalized[id].description = sig.description;
      }
      if (sig.website) {
        normalized[id].website = sig.website;
      }
      if (sig.icon) {
        normalized[id].icon = sig.icon;
      }
    }

    return normalized;
  }

  /**
   * Normalize headers format
   */
  normalizeHeaders(headers) {
    const normalized = {};

    if (typeof headers === 'object' && !Array.isArray(headers)) {
      for (const [name, pattern] of Object.entries(headers)) {
        normalized[name] = pattern;
      }
    }

    return normalized;
  }

  /**
   * Normalize HTML patterns format
   */
  normalizeHtml(html) {
    if (!html) {
      return null;
    }

    const normalized = {
      patterns: Array.isArray(html) ? html : [html],
      metaGenerator: null,
      metaVersion: null
    };

    // Extract meta patterns if any
    return normalized;
  }

  /**
   * Normalize JavaScript patterns format
   */
  normalizeJs(js) {
    if (!js) {
      return null;
    }

    const normalized = {
      urls: [],
      patterns: []
    };

    if (Array.isArray(js)) {
      normalized.patterns = js;
    } else if (typeof js === 'object') {
      if (js.urls) {
        normalized.urls = Array.isArray(js.urls) ? js.urls : [js.urls];
      }
      if (js.patterns) {
        normalized.patterns = Array.isArray(js.patterns) ? js.patterns : [js.patterns];
      }
    }

    return normalized;
  }

  /**
   * Get signatures
   */
  getSignatures() {
    return this.signatures;
  }

  /**
   * Get signature by ID
   */
  getSignature(id) {
    return this.signatures[id] || null;
  }

  /**
   * Get all signatures in a category
   */
  getByCategory(category) {
    const results = {};

    for (const [id, sig] of Object.entries(this.signatures)) {
      if (sig.category === category) {
        results[id] = sig;
      }
    }

    return results;
  }

  /**
   * Get loader status
   */
  getStatus() {
    return {
      signaturesLoaded: Object.keys(this.signatures).length,
      sourceFile: this.sourceFile,
      loadedAt: this.loadTimestamp ? new Date(this.loadTimestamp).toISOString() : null,
      categories: [...new Set(Object.values(this.signatures).map(s => s.category))].length
    };
  }

  /**
   * Validate signature format
   */
  validateSignatures() {
    const issues = [];

    for (const [id, sig] of Object.entries(this.signatures)) {
      if (!sig.name) {
        issues.push(`${id}: Missing name`);
      }
      if (!sig.category) {
        issues.push(`${id}: Missing category`);
      }

      // Validate patterns
      if (sig.headers && typeof sig.headers === 'object') {
        for (const [header, pattern] of Object.entries(sig.headers)) {
          try {
            if (typeof pattern === 'string' && pattern.startsWith('/')) {
              new RegExp(pattern.slice(1, -1));
            }
          } catch (e) {
            issues.push(`${id}: Invalid header pattern ${pattern}`);
          }
        }
      }

      if (sig.html?.patterns) {
        for (const pattern of sig.html.patterns) {
          try {
            if (typeof pattern === 'string' && pattern.startsWith('/')) {
              new RegExp(pattern.slice(1, -1));
            }
          } catch (e) {
            issues.push(`${id}: Invalid HTML pattern ${pattern}`);
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issueCount: issues.length,
      issues: issues.slice(0, 10) // Return first 10
    };
  }

  /**
   * Merge signatures from another loader
   */
  mergeSignatures(otherSignatures) {
    const before = Object.keys(this.signatures).length;
    this.signatures = { ...this.signatures, ...otherSignatures };
    const after = Object.keys(this.signatures).length;

    return {
      addedCount: after - before,
      totalCount: after
    };
  }

  /**
   * Clear all signatures
   */
  clear() {
    this.signatures = {};
    this.loadTimestamp = null;
    this.sourceFile = null;
  }
}

module.exports = SignatureLoader;

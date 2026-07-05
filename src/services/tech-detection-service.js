/**
 * Technology Detection Service
 * Pure business logic for detecting technologies in web pages
 * Separated from WebSocket/infrastructure concerns
 *
 * Responsibilities:
 * - Technology pattern matching
 * - Detection result consolidation
 * - Confidence score calculation
 * - Detection time tracking
 *
 * Dependencies:
 * - RegexCache (for pattern compilation)
 * - Signature database (loaded externally)
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

const { getRegexCache } = require('../utils/regex-cache');

class TechDetectionService {
  /**
   * Create tech detection service
   * @param {Object} options - Configuration
   * @param {Object} options.signatures - Technology signatures database
   * @param {Object} options.cache - Cache instance (optional)
   */
  constructor(options = {}) {
    this.signatures = options.signatures || {};
    this.regexCache = getRegexCache();
    this.stats = {
      detectionsRun: 0,
      totalDetections: 0,
      averageDetectionTime: 0,
      totalDetectionTime: 0
    };
  }

  /**
   * Detect technologies in page data
   * Pure business logic - no infrastructure concerns
   * @param {Object} pageData - Page data to analyze
   * @param {Object} pageData.html - HTML content
   * @param {Array} pageData.scripts - Script sources
   * @param {Object} pageData.headers - HTTP headers
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Detection results
   */
  async detectTechnologies(pageData, options = {}) {
    const startTime = Date.now();

    const results = {
      technologies: [],
      detectionMethods: {},
      confidence: 0,
      detectionTime: 0,
      timestamp: new Date().toISOString()
    };

    try {
      // Run detection strategies in parallel
      const [
        headerDetections,
        jsDetections,
        htmlDetections
      ] = await Promise.all([
        this._detectByHeaders(pageData.headers || {}),
        this._detectByJavaScript(pageData.scripts || []),
        this._detectByHTML(pageData.html || '')
      ]);

      // Merge detections
      const allDetections = [
        ...headerDetections,
        ...jsDetections,
        ...htmlDetections
      ];

      // Consolidate results
      results.technologies = this._consolidateDetections(allDetections);
      results.detectionMethods = this._buildDetectionMethods(allDetections);
      results.confidence = this._calculateConfidence(results.technologies);

      // Track timing
      results.detectionTime = Date.now() - startTime;
      this._updateStats(results.detectionTime, results.technologies.length);
    } catch (error) {
      console.error('Tech detection error:', error);
      results.error = error.message;
      results.detectionTime = Date.now() - startTime;
    }

    return results;
  }

  /**
   * Detect technologies by HTTP headers
   * @private
   */
  async _detectByHeaders(headers) {
    const detections = [];

    if (!headers) {
      return detections;
    }

    // Check common header signatures
    const headerSignatures = {
      'server': this.signatures.servers || [],
      'x-powered-by': this.signatures.frameworks || [],
      'x-aspnet-version': this.signatures.frameworks || []
    };

    for (const [headerName, signatures] of Object.entries(headerSignatures)) {
      const headerValue = this._getHeaderValue(headers, headerName);
      if (!headerValue) {
        continue;
      }

      for (const sig of signatures) {
        if (this._matchesSignature(headerValue, sig)) {
          detections.push({
            name: sig.name,
            version: sig.version,
            confidence: sig.confidence || 0.9,
            method: 'header',
            evidence: headerValue
          });
        }
      }
    }

    return detections;
  }

  /**
   * Detect technologies by JavaScript
   * @private
   */
  async _detectByJavaScript(scripts) {
    const detections = [];

    if (!Array.isArray(scripts)) {
      return detections;
    }

    const jsSignatures = this.signatures.javascript || [];

    for (const script of scripts) {
      const src = script.src || script;

      for (const sig of jsSignatures) {
        if (this._matchesSignature(src, sig)) {
          detections.push({
            name: sig.name,
            version: sig.version,
            confidence: sig.confidence || 0.8,
            method: 'javascript',
            evidence: src
          });
        }
      }
    }

    return detections;
  }

  /**
   * Detect technologies by HTML content
   * @private
   */
  async _detectByHTML(html) {
    const detections = [];

    if (!html) {
      return detections;
    }

    const htmlSignatures = this.signatures.html || [];

    for (const sig of htmlSignatures) {
      if (this._matchesSignature(html, sig)) {
        detections.push({
          name: sig.name,
          version: sig.version,
          confidence: sig.confidence || 0.7,
          method: 'html',
          evidence: sig.pattern
        });
      }
    }

    return detections;
  }

  /**
   * Match text against signature pattern
   * @private
   */
  _matchesSignature(text, signature) {
    if (!text || !signature.pattern) {
      return false;
    }

    try {
      const regex = this.regexCache.get(signature.pattern);
      return regex.test(text);
    } catch (error) {
      console.error(`Signature match failed: ${signature.pattern}`, error);
      return false;
    }
  }

  /**
   * Get header value case-insensitively
   * @private
   */
  _getHeaderValue(headers, headerName) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === headerName.toLowerCase()) {
        return value;
      }
    }
    return null;
  }

  /**
   * Consolidate duplicate detections
   * @private
   */
  _consolidateDetections(detections) {
    const consolidated = new Map();

    for (const detection of detections) {
      const key = detection.name.toLowerCase();

      if (!consolidated.has(key)) {
        consolidated.set(key, {
          name: detection.name,
          version: detection.version,
          confidence: detection.confidence,
          methods: [detection.method],
          evidence: [detection.evidence]
        });
      } else {
        const existing = consolidated.get(key);
        existing.methods.push(detection.method);
        existing.evidence.push(detection.evidence);
        existing.confidence = Math.min(1.0, existing.confidence + 0.1);
      }
    }

    return Array.from(consolidated.values());
  }

  /**
   * Build detection methods summary
   * @private
   */
  _buildDetectionMethods(detections) {
    const methods = {};

    for (const detection of detections) {
      if (!methods[detection.method]) {
        methods[detection.method] = [];
      }
      methods[detection.method].push(detection.name);
    }

    return methods;
  }

  /**
   * Calculate overall confidence score
   * @private
   */
  _calculateConfidence(technologies) {
    if (technologies.length === 0) {
      return 0;
    }

    const avgConfidence = technologies.reduce((sum, t) => sum + t.confidence, 0) / technologies.length;
    return Math.min(1.0, avgConfidence);
  }

  /**
   * Update statistics
   * @private
   */
  _updateStats(detectionTime, count) {
    this.stats.detectionsRun++;
    this.stats.totalDetections += count;
    this.stats.totalDetectionTime += detectionTime;
    this.stats.averageDetectionTime = this.stats.totalDetectionTime / this.stats.detectionsRun;
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this.stats,
      averageDetectionTime: this.stats.averageDetectionTime.toFixed(2) + 'ms'
    };
  }

  /**
   * Load signatures from external source
   * @param {Object} signatures - Signature database
   */
  loadSignatures(signatures) {
    this.signatures = signatures;
  }
}

module.exports = TechDetectionService;

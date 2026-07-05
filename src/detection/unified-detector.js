/**
 * Unified Technology Detection Framework
 *
 * Consolidates tech detection from multiple sources:
 * - detector.js (signature-based HTTP headers, HTML, meta tags, scripts, endpoints)
 * - tech-detector.js (parallel detection strategies: favicon, SSL, JavaScript, DOM, Canvas)
 * - technology-detector.js (passive and active detection with pattern matching)
 *
 * Features:
 * - Single source of truth for tech detection logic
 * - Unified confidence scoring
 * - Version detection
 * - Multiple detection methods per technology
 * - Result caching and deduplication
 *
 * @module unified-detector
 */

const { TECH_SIGNATURES, getSignature } = require('./tech-signatures');
const { createLogger } = require('../../logging');
const { getRegexCache } = require('../utils/regex-cache');
const { generateFastCacheKey } = require('../utils/fnv-hash');
const { normalizeHeaders } = require('../utils/header-utils');
const crypto = require('crypto');

class UnifiedTechnologyDetector {
  constructor(options = {}) {
    this.logger = createLogger('UnifiedTechDetector');

    // Detection configuration
    this.config = {
      minConfidence: options.minConfidence || 0.50,
      maxResults: options.maxResults || 100,
      enableVersionDetection: options.enableVersionDetection !== false,
      enableActiveDetection: options.enableActiveDetection !== false,
      cacheResults: options.cacheResults !== false,
      cacheTimeout: options.cacheTimeout || 3600000, // 1 hour
      timeout: options.timeout || 30000,
      ...options
    };

    // Caching and optimization
    this.cache = new Map();
    this.regexCache = getRegexCache();

    // Detection statistics
    this.stats = {
      totalDetections: 0,
      cacheHits: 0,
      detectionMethods: {}
    };
  }

  /**
   * Unified detection orchestrator
   * Combines passive (headers, HTML) and active (JS globals, page inspection) methods
   *
   * @param {object} pageData - Comprehensive page data
   * @param {string} pageData.html - HTML content
   * @param {object} pageData.headers - HTTP response headers
   * @param {string} pageData.url - Page URL
   * @param {Buffer} pageData.favicon - Favicon buffer (optional)
   * @param {object} pageData.sslCertificate - SSL certificate info (optional)
   * @param {object} pageData.tlsDetails - TLS details (optional)
   * @param {Array<string>} pageData.scripts - Script URLs found on page (optional)
   * @param {object} pageData.page - Puppeteer/Playwright page object (optional, for active detection)
   * @param {string} pageData.canvasFingerprint - Canvas fingerprint data (optional)
   * @returns {Promise<object>} Detection results
   */
  async detect(pageData = {}) {
    const startTime = Date.now();

    if (!pageData) {
      return this._createErrorResult('Page data required', startTime);
    }

    try {
      // Check cache
      const cacheKey = this._getCacheKey(pageData);
      if (this.config.cacheResults && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
          this.stats.cacheHits++;
          return {
            success: cached.success,
            technologies: cached.technologies,
            totalDetected: cached.totalDetected,
            timestamp: cached.timestamp,
            scanTimeMs: Date.now() - startTime,
            cached: true
          };
        }
      }

      // Run detection methods
      const detections = {};

      try {
        // Passive detection methods (synchronous)
        this._detectFromHeaders(pageData.headers || {}, detections);
        this._detectFromMetaTags(pageData.html || '', detections);
        this._detectFromHtmlContent(pageData.html || '', detections);
        this._detectFromScripts(pageData.html || '', detections);
        this._detectFromEndpoints(pageData.html || '', detections);
        this._detectFromFavicon(pageData.favicon, detections);
        this._detectFromSSL(pageData.sslCertificate, detections);

        // Active detection (if page object available and enabled)
        if (pageData.page && this.config.enableActiveDetection) {
          await this._detectFromJavaScript(pageData.page, detections);
        }
      } catch (methodError) {
        this.logger.warn('detection_method_error', {
          error: methodError.message,
          stack: methodError.stack
        });
      }

      // Process and consolidate detections
      const technologies = this._processDetections(detections);

      const result = {
        success: true,
        technologies: technologies.slice(0, this.config.maxResults),
        totalDetected: technologies.length,
        scanTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      // Cache result
      if (this.config.cacheResults) {
        this.cache.set(cacheKey, {
          success: result.success,
          technologies: result.technologies,
          totalDetected: result.totalDetected,
          timestamp: result.timestamp
        });
      }

      return result;
    } catch (error) {
      this.logger.error('detection_failed', {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });

      return this._createErrorResult(error.message, startTime);
    }
  }

  /**
   * Detect from HTTP headers
   * @private
   */
  _detectFromHeaders(headers, detections) {
    if (!headers || typeof headers !== 'object') {
      return;
    }

    const normalizedHeaders = normalizeHeaders(headers);

    Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
      signature.detection.forEach(rule => {
        if (rule.type !== 'header') {
          return;
        }

        const headerValue = normalizedHeaders[rule.pattern.toLowerCase()];
        if (!headerValue) {
          return;
        }

        const regex = this.regexCache.get(rule.value, 'i');
        if (!regex.test(headerValue)) {
          return;
        }

        this._addDetection(detections, techName, signature, {
          method: 'header',
          indicator: `${rule.pattern}: ${headerValue}`,
          confidence: signature.accuracy
        });

        // Version detection
        if (this.config.enableVersionDetection && signature.version) {
          const version = this._extractVersion(headerValue, signature.version);
          if (version) {
            detections[techName].version = version;
          }
        }

        this._recordDetectionMethod('header');
      });
    });
  }

  /**
   * Detect from HTML meta tags
   * @private
   */
  _detectFromMetaTags(html, detections) {
    if (!html || typeof html !== 'string') {
      return;
    }

    Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
      signature.detection.forEach(rule => {
        if (rule.type !== 'meta') {
          return;
        }

        const metaRegex = new RegExp(
          `<meta\\s+(?:name|property)=['"]${rule.pattern}['"]\\s+content=['"]([^'"]*)['"]+|` +
          `<meta\\s+content=['"]([^'"]*)['"]+\\s+(?:name|property)=['"]${rule.pattern}['"]`,
          'gi'
        );

        let match;
        while ((match = metaRegex.exec(html)) !== null) {
          const content = match[1] || match[2];
          const regex = this.regexCache.get(rule.value, 'i');

          if (regex.test(content)) {
            this._addDetection(detections, techName, signature, {
              method: 'meta',
              indicator: `${rule.pattern}: ${content}`,
              confidence: signature.accuracy
            });

            if (this.config.enableVersionDetection && signature.version) {
              const version = this._extractVersion(content, signature.version);
              if (version) {
                detections[techName].version = version;
              }
            }

            this._recordDetectionMethod('meta');
          }
        }
      });
    });
  }

  /**
   * Detect from HTML structure and content
   * @private
   */
  _detectFromHtmlContent(html, detections) {
    if (!html || typeof html !== 'string') {
      return;
    }

    Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
      signature.detection.forEach(rule => {
        if (rule.type !== 'html') {
          return;
        }

        const pattern = typeof rule.pattern === 'string'
          ? this.regexCache.get(rule.pattern, 'i')
          : rule.pattern;

        if (!pattern.test(html)) {
          return;
        }

        this._addDetection(detections, techName, signature, {
          method: 'html',
          indicator: rule.pattern,
          confidence: signature.accuracy * 0.9 // Slightly lower for HTML patterns
        });

        this._recordDetectionMethod('html');
      });
    });
  }

  /**
   * Detect from script tags and URLs
   * @private
   */
  _detectFromScripts(html, detections) {
    if (!html || typeof html !== 'string') {
      return;
    }

    const scriptRegex = /<script[^>]*src=['"]([^'"]+)['"][^>]*>/gi;
    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1];

      Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
        signature.detection.forEach(rule => {
          if (rule.type !== 'script') {
            return;
          }

          const pattern = typeof rule.pattern === 'string'
            ? this.regexCache.get(rule.pattern, 'i')
            : rule.pattern;

          if (!pattern.test(src)) {
            return;
          }

          this._addDetection(detections, techName, signature, {
            method: 'script',
            indicator: src,
            confidence: signature.accuracy * 0.85
          });

          if (this.config.enableVersionDetection && signature.version) {
            const version = this._extractVersion(src, signature.version);
            if (version) {
              detections[techName].version = version;
            }
          }

          this._recordDetectionMethod('script');
        });
      });
    }
  }

  /**
   * Detect from well-known endpoints
   * @private
   */
  _detectFromEndpoints(html, detections) {
    if (!html || typeof html !== 'string') {
      return;
    }

    Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
      signature.detection.forEach(rule => {
        if (rule.type !== 'endpoint') {
          return;
        }

        if (!html.includes(rule.pattern)) {
          return;
        }

        this._addDetection(detections, techName, signature, {
          method: 'endpoint',
          indicator: rule.pattern,
          confidence: signature.accuracy * 0.80
        });

        this._recordDetectionMethod('endpoint');
      });
    });
  }

  /**
   * Detect from favicon hash
   * @private
   */
  _detectFromFavicon(faviconBuffer, detections) {
    if (!faviconBuffer) {
      return;
    }

    try {
      const sha256Hash = crypto.createHash('sha256').update(faviconBuffer).digest('hex');

      Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
        if (!signature.favicon || !signature.favicon.sha256) {
          return;
        }

        if (signature.favicon.sha256 === sha256Hash) {
          this._addDetection(detections, techName, signature, {
            method: 'favicon',
            indicator: sha256Hash,
            confidence: signature.accuracy * 0.95
          });

          this._recordDetectionMethod('favicon');
        }
      });
    } catch (error) {
      this.logger.warn('favicon_detection_error', { error: error.message });
    }
  }

  /**
   * Detect from SSL/TLS certificate
   * @private
   */
  _detectFromSSL(certificate, detections) {
    if (!certificate) {
      return;
    }

    const issuer = certificate.issuer?.O || '';
    const organization = certificate.subject?.O || '';

    // Common hosting provider patterns
    const hostingSignatures = {
      'CloudFlare': 'cloudflare',
      'Amazon': 'aws',
      'Google': 'google-cloud',
      'Microsoft': 'azure',
      'Fastly': 'fastly',
      'Akamai': 'akamai'
    };

    Object.entries(hostingSignatures).forEach(([certOrg, techId]) => {
      if ((issuer.includes(certOrg) || organization.includes(certOrg)) &&
          TECH_SIGNATURES[techId]) {
        const signature = TECH_SIGNATURES[techId];
        this._addDetection(detections, techId, signature, {
          method: 'ssl',
          indicator: `${issuer}/${organization}`,
          confidence: signature.accuracy * 0.90
        });

        this._recordDetectionMethod('ssl');
      }
    });
  }

  /**
   * Detect from JavaScript globals (requires page object)
   * @private
   */
  async _detectFromJavaScript(page, detections) {
    if (!page) {
      return;
    }

    try {
      const jsGlobals = await page.evaluate(() => {
        const globals = {};

        // Check for common framework globals
        const checkList = [
          '__REACT_DEVTOOLS_GLOBAL_HOOK__',
          '__VUE__',
          '__NEXT_DATA__',
          '__NUXT__',
          '__GATSBY__',
          'angular',
          'jQuery',
          '_',
          'Moment',
          'THREE',
          'd3'
        ];

        for (const global of checkList) {
          globals[global] = typeof window[global] !== 'undefined';
        }

        return globals;
      });

      Object.entries(TECH_SIGNATURES).forEach(([techName, signature]) => {
        signature.detection.forEach(rule => {
          if (rule.type !== 'js-global') {
            return;
          }

          if (jsGlobals[rule.pattern]) {
            this._addDetection(detections, techName, signature, {
              method: 'javascript',
              indicator: `window.${rule.pattern}`,
              confidence: signature.accuracy
            });

            this._recordDetectionMethod('javascript');
          }
        });
      });
    } catch (error) {
      this.logger.warn('javascript_detection_error', { error: error.message });
    }
  }

  /**
   * Add a detection to the collection
   * @private
   */
  _addDetection(detections, techName, signature, detection) {
    if (!detections[techName]) {
      detections[techName] = {
        name: techName,
        category: signature.category,
        confidence: detection.confidence,
        methods: [],
        version: null
      };
    }

    detections[techName].methods.push({
      type: detection.method,
      indicator: detection.indicator
    });

    // Update confidence if multiple methods
    if (detections[techName].methods.length > 1) {
      detections[techName].confidence = Math.min(
        0.99,
        detection.confidence + (detections[techName].methods.length * 0.03)
      );
    }
  }

  /**
   * Process and score detections
   * @private
   */
  _processDetections(detections) {
    const results = [];

    Object.entries(detections).forEach(([techName, detection]) => {
      // Filter by minimum confidence
      if (detection.confidence < this.config.minConfidence) {
        return;
      }

      results.push({
        name: detection.name,
        category: detection.category,
        confidence: parseFloat(detection.confidence.toFixed(2)),
        version: detection.version,
        detectionMethod: detection.methods.length > 1 ? 'multiple' : detection.methods[0]?.type,
        methods: detection.methods
      });
    });

    // Sort by confidence (descending)
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Extract version from text using pattern
   * @private
   */
  _extractVersion(text, versionPattern) {
    if (!versionPattern) {
      return null;
    }

    try {
      const match = text.match(versionPattern);
      return match && match[1] ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Record detection method usage for statistics
   * @private
   */
  _recordDetectionMethod(method) {
    this.stats.detectionMethods[method] = (this.stats.detectionMethods[method] || 0) + 1;
    this.stats.totalDetections++;
  }

  /**
   * Generate cache key
   * @private
   */
  _getCacheKey(pageData) {
    const html = pageData.html || '';
    const url = pageData.url || '';
    const data = `${url}|${html}`;
    return generateFastCacheKey(data, 'unified-tech-detect');
  }

  /**
   * Create standardized error result
   * @private
   */
  _createErrorResult(error, startTime) {
    return {
      success: false,
      error,
      technologies: [],
      totalDetected: 0,
      scanTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('cache_cleared');
  }

  /**
   * Get detection statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalDetections: 0,
      cacheHits: 0,
      detectionMethods: {}
    };
  }
}

module.exports = UnifiedTechnologyDetector;

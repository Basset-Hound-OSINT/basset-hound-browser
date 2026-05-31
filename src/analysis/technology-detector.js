/**
 * Technology Detection Module
 *
 * Detects web technologies using multiple methods:
 * - Passive detection: HTTP headers, HTML meta tags, favicon hashes
 * - Active detection: JavaScript framework detection via globals
 * - Confidence scoring for each detection
 *
 * @module technology-detector
 */

const PATTERNS = require('./technology-patterns');
const { createLogger } = require('../../logging');

class TechnologyDetector {
  constructor(options = {}) {
    this.logger = createLogger('TechnologyDetector');
    this.config = {
      maxDetections: 100,
      minConfidence: 0.50,
      enableActiveDetection: options.enableActiveDetection !== false,
      timeout: options.timeout || 30000,
      ...options
    };
    this.patterns = PATTERNS;
  }

  /**
   * Main detection orchestrator
   * @param {object} options - Detection options
   * @param {string} options.html - HTML content to analyze
   * @param {object} options.headers - HTTP response headers
   * @param {object} options.page - Puppeteer/Playwright page object (for active detection)
   * @param {boolean} options.activeOnly - Skip passive detection
   * @param {boolean} options.passiveOnly - Skip active detection
   * @returns {Promise<object>} Detection results
   */
  async detect(options = {}) {
    const startTime = Date.now();
    const detections = {};
    const indicators = {};

    try {
      // Passive detection (HTTP headers, HTML, etc.)
      if (!options.activeOnly) {
        const passiveResults = this._detectPassive({
          html: options.html || '',
          headers: options.headers || {}
        });

        Object.assign(detections, passiveResults);
        Object.assign(indicators, this._getPassiveIndicators(options));
      }

      // Active detection (JavaScript globals)
      if (!options.passiveOnly && options.page && this.config.enableActiveDetection) {
        try {
          const activeResults = await this._detectActive(options.page);
          Object.assign(detections, activeResults);
        } catch (error) {
          this.logger.warn('active_detection_failed', {
            error: error.message,
            hint: 'Page object may not be available'
          });
        }
      }

      // Deduplicate and score
      const results = this._processDetections(detections);

      this.logger.info('detection_complete', {
        detectedCount: results.length,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        technologies: results,
        totalDetected: results.length,
        scanTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('detection_failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message,
        technologies: [],
        totalDetected: 0,
        scanTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Passive detection via HTTP headers and HTML content
   * @private
   */
  _detectPassive(options) {
    const detections = {};
    const { html = '', headers = {} } = options;

    // Normalize headers to lowercase keys
    const normalizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    // Check each technology pattern
    for (const [techName, pattern] of Object.entries(this.patterns)) {
      let matched = false;
      let method = '';

      // 1. Check HTTP headers
      if (pattern.headers && Object.keys(pattern.headers).length > 0) {
        for (const [headerName, headerPattern] of Object.entries(pattern.headers)) {
          const headerValue = normalizedHeaders[headerName.toLowerCase()];
          if (headerValue && this._matchPattern(headerValue, headerPattern)) {
            matched = true;
            method = 'header:' + headerName;
            break;
          }
        }
      }

      // 2. Check meta tags
      if (!matched && pattern.metaTags && pattern.metaTags.length > 0) {
        for (const metaTag of pattern.metaTags) {
          const metaPattern = new RegExp(`<meta[^>]*name=['"]${metaTag.name}['"][^>]*content=['"]([^'"]*)['\"]`, 'gi');
          const match = metaPattern.exec(html);
          if (match && this._matchPattern(match[1], metaTag.content)) {
            matched = true;
            method = 'meta:' + metaTag.name;
            break;
          }
        }
      }

      // 3. Check HTML comments
      if (!matched && pattern.htmlComments && pattern.htmlComments.length > 0) {
        for (const commentPattern of pattern.htmlComments) {
          const commentRegex = typeof commentPattern === 'string'
            ? new RegExp(commentPattern, 'i')
            : commentPattern;
          if (commentRegex.test(html)) {
            matched = true;
            method = 'html-comment';
            break;
          }
        }
      }

      // 4. Check for script tags with version patterns
      if (!matched && pattern.versionPatterns && pattern.versionPatterns.length > 0) {
        for (const versionPattern of pattern.versionPatterns) {
          const scriptMatch = html.match(versionPattern.pattern);
          if (scriptMatch) {
            matched = true;
            method = 'script-version';
            break;
          }
        }
      }

      // 5. Check for common endpoints
      if (!matched && pattern.endpoints && pattern.endpoints.length > 0) {
        for (const endpoint of pattern.endpoints) {
          if (html.includes(endpoint)) {
            matched = true;
            method = 'endpoint:' + endpoint;
            break;
          }
        }
      }

      if (matched) {
        detections[techName] = {
          name: techName,
          category: pattern.category,
          confidence: pattern.confidence || 0.75,
          detectionMethod: 'passive',
          method: method,
          version: this._extractVersion(techName, html, normalizedHeaders)
        };
      }
    }

    return detections;
  }

  /**
   * Active detection via JavaScript globals
   * @private
   */
  async _detectActive(page) {
    const detections = {};

    try {
      // Collect all JavaScript globals
      const jsGlobals = await page.evaluate(() => {
        const globals = {};

        // Check common technology globals
        const checkGlobals = [
          '__REACT_DEVTOOLS_GLOBAL_HOOK__',
          '__VUE__',
          '__NEXT_DATA__',
          '__NUXT__',
          '__GATSBY__',
          'Angular',
          'ng',
          'angular',
          'Ember',
          'Backbone',
          'ko',
          'knockout',
          'jQuery',
          '$',
          'Shopify',
          'wp',
          'Drupal',
          'Joomla',
          'ga',
          'gtag',
          'dataLayer',
          'mixpanel',
          'analytics',
          'amplitude',
          'hj',
          'Sentry',
          'newrelic',
          'heap'
        ];

        for (const global of checkGlobals) {
          if (typeof window[global] !== 'undefined') {
            globals[global] = true;
          }
        }

        return globals;
      });

      // Map globals to technologies
      const globalToTech = {
        '__REACT_DEVTOOLS_GLOBAL_HOOK__': 'React',
        '__VUE__': 'Vue.js',
        '__NEXT_DATA__': 'Next.js',
        '__NUXT__': 'Nuxt.js',
        '__GATSBY__': 'Gatsby',
        'Angular': 'Angular',
        'ng': 'Angular',
        'angular': 'Angular',
        'Ember': 'Ember.js',
        'Backbone': 'Backbone.js',
        'ko': 'Knockout.js',
        'knockout': 'Knockout.js',
        'jQuery': 'jQuery',
        '$': 'jQuery', // Low confidence if only $
        'Shopify': 'Shopify',
        'wp': 'WordPress',
        'Drupal': 'Drupal',
        'Joomla': 'Joomla',
        'ga': 'Google Analytics',
        'gtag': 'Google Analytics',
        'dataLayer': 'Google Analytics',
        'mixpanel': 'Mixpanel',
        'analytics': 'Segment',
        'amplitude': 'Amplitude',
        'hj': 'Hotjar',
        'Sentry': 'Sentry',
        'newrelic': 'New Relic',
        'heap': 'Heap Analytics'
      };

      for (const [global, detected] of Object.entries(jsGlobals)) {
        if (detected && globalToTech[global]) {
          const techName = globalToTech[global];
          const pattern = this.patterns[techName];

          // Only add if this is a significant detection
          if (!detections[techName] || detections[techName].confidence < 0.80) {
            detections[techName] = {
              name: techName,
              category: pattern.category,
              confidence: 0.88, // Active detection is quite reliable
              detectionMethod: 'active',
              method: 'javascript-global:' + global,
              version: null
            };
          }
        }
      }

      // Check for DOM markers
      const domMarkers = await page.evaluate(() => {
        const markers = {};
        const checkMarkers = [
          '[data-reactroot]',
          '[data-react-root]',
          '[data-v-',
          '[ng-app]',
          '[ng-controller]',
          '[data-drupal-',
          '[data-shopify-',
          '[data-wix-',
          '[data-nuxt]',
          '[id="__nuxt"]',
          '[data-sveltekit-'
        ];

        for (const selector of checkMarkers) {
          // Handle partial selectors
          if (selector.includes('[data-v-')) {
            markers[selector] = document.querySelector('[data-v-app]') !== null ||
              document.querySelector('[data-v-cloak]') !== null;
          } else if (selector.includes('[data-drupal-')) {
            markers[selector] = document.querySelector('[data-drupal-messages]') !== null ||
              document.querySelector('[data-drupal-theme]') !== null;
          } else if (selector.includes('[data-shopify-')) {
            markers[selector] = document.querySelector('[data-shopify-app]') !== null;
          } else {
            markers[selector] = document.querySelector(selector) !== null;
          }
        }

        return markers;
      });

      // Map DOM markers to technologies
      const markerToTech = {
        '[data-reactroot]': 'React',
        '[data-react-root]': 'React',
        '[data-v-': 'Vue.js',
        '[ng-app]': 'Angular',
        '[ng-controller]': 'Angular',
        '[data-drupal-': 'Drupal',
        '[data-shopify-': 'Shopify',
        '[data-wix-': 'Wix',
        '[data-nuxt]': 'Nuxt.js',
        '[id="__nuxt"]': 'Nuxt.js',
        '[data-sveltekit-': 'Svelte'
      };

      for (const [marker, found] of Object.entries(domMarkers)) {
        if (found && markerToTech[marker]) {
          const techName = markerToTech[marker];
          const pattern = this.patterns[techName];

          if (!detections[techName]) {
            detections[techName] = {
              name: techName,
              category: pattern.category,
              confidence: 0.85,
              detectionMethod: 'active',
              method: 'dom-marker:' + marker,
              version: null
            };
          }
        }
      }
    } catch (error) {
      this.logger.warn('active_detection_error', {
        error: error.message
      });
    }

    return detections;
  }

  /**
   * Detect HTTP headers from HAR data
   * @param {object} options - Detection options
   * @returns {object} Detected technologies
   */
  _getPassiveIndicators(options) {
    const indicators = {};

    if (options.headers) {
      for (const [techName, pattern] of Object.entries(this.patterns)) {
        if (pattern.headers) {
          for (const [headerName, headerPattern] of Object.entries(pattern.headers)) {
            const headerValue = options.headers[headerName] || options.headers[headerName.toLowerCase()];
            if (headerValue && this._matchPattern(headerValue, headerPattern)) {
              if (!indicators[techName]) {
                indicators[techName] = [];
              }
              indicators[techName].push(`HTTP header: ${headerName}: ${headerValue}`);
            }
          }
        }
      }
    }

    return indicators;
  }

  /**
   * Match a value against a pattern (string or regex)
   * @private
   */
  _matchPattern(value, pattern) {
    if (!value) return false;
    if (typeof pattern === 'string') {
      return value.toLowerCase().includes(pattern.toLowerCase());
    }
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }
    return false;
  }

  /**
   * Extract version information for a technology
   * @private
   */
  _extractVersion(techName, html, headers) {
    const pattern = this.patterns[techName];
    if (!pattern || !pattern.versionPatterns) {
      return null;
    }

    for (const versionPattern of pattern.versionPatterns) {
      // Check in HTML
      const htmlMatch = html.match(versionPattern.pattern);
      if (htmlMatch) {
        return htmlMatch[versionPattern.group || 1] || null;
      }

      // Check in headers
      for (const [headerName, headerValue] of Object.entries(headers)) {
        const match = headerValue.match(versionPattern.pattern);
        if (match) {
          return match[versionPattern.group || 1] || null;
        }
      }
    }

    return null;
  }

  /**
   * Process and deduplicate detections
   * @private
   */
  _processDetections(detections) {
    const results = [];

    for (const [techName, detection] of Object.entries(detections)) {
      // Filter by minimum confidence
      if (detection.confidence >= this.config.minConfidence) {
        results.push({
          name: detection.name,
          category: detection.category,
          confidence: detection.confidence,
          detectionMethod: detection.detectionMethod,
          method: detection.method,
          version: detection.version
        });
      }
    }

    // Sort by confidence (descending)
    results.sort((a, b) => b.confidence - a.confidence);

    // Limit results
    return results.slice(0, this.config.maxDetections);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // No resources to cleanup currently
  }
}

module.exports = TechnologyDetector;

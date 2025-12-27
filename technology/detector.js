/**
 * Basset Hound Browser - Technology Detector
 * Core detection engine with pattern matching and confidence scoring
 *
 * Provides detection methods for:
 * - HTML content patterns
 * - HTTP header patterns
 * - Script URL patterns
 * - Cookie patterns
 * - Meta tag patterns
 * - CSS patterns
 */

const { FINGERPRINTS, CATEGORIES, getFingerprint } = require('./fingerprints');

/**
 * Detection confidence levels
 */
const CONFIDENCE_LEVELS = {
  LOW: 25,      // Single weak match
  MEDIUM: 50,   // Single strong match or multiple weak matches
  HIGH: 75,     // Multiple strong matches
  CERTAIN: 100  // Version detected or very strong evidence
};

/**
 * Detection source weights for confidence calculation
 */
const SOURCE_WEIGHTS = {
  html: 15,        // HTML content patterns
  scripts: 25,     // Script URL patterns (strong indicator)
  css: 15,         // CSS file patterns
  js: 20,          // JavaScript variable patterns
  meta: 30,        // Meta tag patterns (usually explicit)
  headers: 35,     // HTTP header patterns (very reliable)
  cookies: 20      // Cookie patterns
};

/**
 * TechnologyDetector class
 * Core detection engine for identifying web technologies
 */
class TechnologyDetector {
  constructor(options = {}) {
    // Detection options
    this.options = {
      minConfidence: options.minConfidence || 25,
      maxResults: options.maxResults || 100,
      detectVersions: options.detectVersions !== false,
      includePatterns: options.includePatterns || false,
      ...options
    };

    // Detection statistics
    this.stats = {
      totalScans: 0,
      totalDetections: 0,
      detectionsByCategory: {},
      averageConfidence: 0,
      lastScanTime: null
    };
  }

  /**
   * Detect technologies from page data
   * @param {Object} pageData - Page data object
   * @returns {Object} Detection results
   */
  detect(pageData) {
    const startTime = Date.now();
    const detections = new Map();

    // Validate page data
    if (!pageData || typeof pageData !== 'object') {
      return {
        success: false,
        error: 'Invalid page data provided'
      };
    }

    // Extract data components
    const {
      url = '',
      html = '',
      headers = {},
      scripts = [],
      cookies = [],
      meta = [],
      css = []
    } = pageData;

    // Iterate through all fingerprints
    for (const [techKey, fingerprint] of Object.entries(FINGERPRINTS)) {
      const matches = this.matchFingerprint(techKey, fingerprint, {
        url,
        html,
        headers,
        scripts,
        cookies,
        meta,
        css
      });

      if (matches.total > 0) {
        const confidence = this.calculateConfidence(matches);

        if (confidence >= this.options.minConfidence) {
          detections.set(techKey, {
            key: techKey,
            name: fingerprint.name,
            category: fingerprint.category,
            website: fingerprint.website,
            description: fingerprint.description,
            confidence,
            matches: this.options.includePatterns ? matches : undefined,
            version: matches.version || null
          });
        }
      }
    }

    // Sort by confidence and limit results
    const sortedDetections = Array.from(detections.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.options.maxResults);

    // Update statistics
    this.updateStats(sortedDetections);

    const scanTime = Date.now() - startTime;

    return {
      success: true,
      url,
      technologies: sortedDetections,
      count: sortedDetections.length,
      scanTime,
      categories: this.groupByCategory(sortedDetections)
    };
  }

  /**
   * Match a fingerprint against page data
   * @param {string} techKey - Technology key
   * @param {Object} fingerprint - Technology fingerprint
   * @param {Object} data - Page data components
   * @returns {Object} Match results
   */
  matchFingerprint(techKey, fingerprint, data) {
    const matches = {
      html: [],
      scripts: [],
      css: [],
      js: [],
      meta: [],
      headers: [],
      cookies: [],
      total: 0,
      version: null
    };

    const patterns = fingerprint.patterns;
    if (!patterns) return matches;

    // Match HTML patterns
    if (patterns.html && data.html) {
      matches.html = this.matchPatterns(patterns.html, data.html);
    }

    // Match script URL patterns
    if (patterns.scripts && data.scripts) {
      const scriptsStr = Array.isArray(data.scripts) ? data.scripts.join('\n') : data.scripts;
      matches.scripts = this.matchPatterns(patterns.scripts, scriptsStr);

      // Also check HTML for script tags
      if (data.html) {
        const htmlScriptMatches = this.matchPatterns(patterns.scripts, data.html);
        matches.scripts.push(...htmlScriptMatches);
      }
    }

    // Match CSS patterns
    if (patterns.css && (data.css || data.html)) {
      const cssContent = Array.isArray(data.css) ? data.css.join('\n') : (data.css || '');
      matches.css = this.matchPatterns(patterns.css, cssContent);

      // Also check HTML for CSS references
      if (data.html) {
        const htmlCssMatches = this.matchPatterns(patterns.css, data.html);
        matches.css.push(...htmlCssMatches);
      }
    }

    // Match JavaScript variable patterns (requires JS execution context)
    if (patterns.js && data.html) {
      // Check inline scripts in HTML
      matches.js = this.matchPatterns(patterns.js, data.html);
    }

    // Match meta tag patterns
    if (patterns.meta && data.meta) {
      matches.meta = this.matchMetaTags(patterns.meta, data.meta);

      // Also check HTML for meta tags
      if (data.html) {
        const htmlMetaMatches = this.matchMetaInHtml(patterns.meta, data.html);
        matches.meta.push(...htmlMetaMatches);
      }
    }

    // Match header patterns
    if (patterns.headers && data.headers) {
      matches.headers = this.matchHeaders(patterns.headers, data.headers);
    }

    // Match cookie patterns
    if (patterns.cookies && data.cookies) {
      matches.cookies = this.matchCookies(patterns.cookies, data.cookies);
    }

    // Calculate total matches
    matches.total = matches.html.length + matches.scripts.length +
                    matches.css.length + matches.js.length +
                    matches.meta.length + matches.headers.length +
                    matches.cookies.length;

    // Try to extract version
    if (this.options.detectVersions && matches.total > 0) {
      matches.version = this.extractVersion(techKey, data, matches);
    }

    return matches;
  }

  /**
   * Match patterns against content
   * @param {Array} patterns - Array of regex patterns
   * @param {string} content - Content to match against
   * @returns {Array} Array of match objects
   */
  matchPatterns(patterns, content) {
    const matches = [];

    if (!content || !patterns) return matches;

    for (const pattern of patterns) {
      try {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
        const match = content.match(regex);

        if (match) {
          matches.push({
            pattern: pattern.toString(),
            matched: match[0],
            index: match.index
          });
        }
      } catch (error) {
        // Skip invalid patterns
        console.warn(`[TechnologyDetector] Invalid pattern: ${pattern}`, error.message);
      }
    }

    return matches;
  }

  /**
   * Match meta tag patterns
   * @param {Array} patterns - Array of meta pattern objects
   * @param {Array} metaTags - Array of meta tag objects
   * @returns {Array} Array of match objects
   */
  matchMetaTags(patterns, metaTags) {
    const matches = [];

    if (!metaTags || !patterns) return matches;

    // Normalize meta tags to array of objects
    const normalizedMeta = Array.isArray(metaTags) ? metaTags : [];

    for (const pattern of patterns) {
      if (!pattern.name && !pattern.property) continue;

      for (const meta of normalizedMeta) {
        const metaName = meta.name || meta.property || '';
        const metaContent = meta.content || '';

        // Match by name/property
        const nameMatch = pattern.name ?
          new RegExp(pattern.name, 'i').test(metaName) :
          new RegExp(pattern.property, 'i').test(metaName);

        if (nameMatch && pattern.content) {
          // Match content
          const contentMatch = pattern.content instanceof RegExp ?
            pattern.content.test(metaContent) :
            new RegExp(pattern.content, 'i').test(metaContent);

          if (contentMatch) {
            matches.push({
              pattern: { name: pattern.name, content: pattern.content.toString() },
              matched: { name: metaName, content: metaContent }
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Match meta patterns in HTML content
   * @param {Array} patterns - Array of meta pattern objects
   * @param {string} html - HTML content
   * @returns {Array} Array of match objects
   */
  matchMetaInHtml(patterns, html) {
    const matches = [];

    if (!html || !patterns) return matches;

    // Extract meta tags from HTML
    const metaRegex = /<meta[^>]+>/gi;
    const metaTags = html.match(metaRegex) || [];

    for (const pattern of patterns) {
      if (!pattern.name && !pattern.property) continue;

      for (const metaTag of metaTags) {
        // Check if meta tag matches pattern
        const nameAttr = pattern.name || pattern.property;
        const nameMatch = new RegExp(`(?:name|property)=["']?${nameAttr}["']?`, 'i').test(metaTag);

        if (nameMatch && pattern.content) {
          // Extract content attribute
          const contentMatch = metaTag.match(/content=["']([^"']+)["']/i);
          if (contentMatch) {
            const content = contentMatch[1];
            const patternMatch = pattern.content instanceof RegExp ?
              pattern.content.test(content) :
              new RegExp(pattern.content, 'i').test(content);

            if (patternMatch) {
              matches.push({
                pattern: { name: nameAttr, content: pattern.content.toString() },
                matched: { tag: metaTag, content }
              });
            }
          }
        }
      }
    }

    return matches;
  }

  /**
   * Match header patterns
   * @param {Array} patterns - Array of header pattern objects
   * @param {Object} headers - HTTP headers object
   * @returns {Array} Array of match objects
   */
  matchHeaders(patterns, headers) {
    const matches = [];

    if (!headers || !patterns) return matches;

    // Normalize headers to lowercase keys
    const normalizedHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    }

    for (const pattern of patterns) {
      if (!pattern.name) continue;

      const headerName = pattern.name.toLowerCase();
      const headerValue = normalizedHeaders[headerName];

      if (headerValue !== undefined) {
        if (pattern.value) {
          // Match value pattern
          const valueMatch = pattern.value instanceof RegExp ?
            pattern.value.test(headerValue) :
            new RegExp(pattern.value, 'i').test(headerValue);

          if (valueMatch) {
            matches.push({
              pattern: { name: pattern.name, value: pattern.value.toString() },
              matched: { name: headerName, value: headerValue }
            });
          }
        } else {
          // Header exists, no value pattern required
          matches.push({
            pattern: { name: pattern.name },
            matched: { name: headerName, value: headerValue }
          });
        }
      }
    }

    return matches;
  }

  /**
   * Match cookie patterns
   * @param {Array} patterns - Array of cookie patterns
   * @param {Array|Object} cookies - Cookies data
   * @returns {Array} Array of match objects
   */
  matchCookies(patterns, cookies) {
    const matches = [];

    if (!cookies || !patterns) return matches;

    // Build cookie string from various formats
    let cookieString = '';

    if (typeof cookies === 'string') {
      cookieString = cookies;
    } else if (Array.isArray(cookies)) {
      cookieString = cookies.map(c => {
        if (typeof c === 'string') return c;
        if (c.name) return `${c.name}=${c.value || ''}`;
        return '';
      }).join('; ');
    } else if (typeof cookies === 'object') {
      cookieString = Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');
    }

    for (const pattern of patterns) {
      try {
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
        const match = cookieString.match(regex);

        if (match) {
          matches.push({
            pattern: pattern.toString(),
            matched: match[0]
          });
        }
      } catch (error) {
        console.warn(`[TechnologyDetector] Invalid cookie pattern: ${pattern}`, error.message);
      }
    }

    return matches;
  }

  /**
   * Calculate confidence score from matches
   * @param {Object} matches - Match results
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(matches) {
    let score = 0;
    let maxPossible = 0;

    for (const [source, weight] of Object.entries(SOURCE_WEIGHTS)) {
      const sourceMatches = matches[source] || [];
      maxPossible += weight;

      if (sourceMatches.length > 0) {
        // Base score for first match
        score += weight;

        // Bonus for multiple matches (diminishing returns)
        if (sourceMatches.length > 1) {
          score += Math.min(weight * 0.5, sourceMatches.length * 2);
        }
      }
    }

    // Bonus for version detection
    if (matches.version) {
      score += 15;
    }

    // Normalize to 0-100 range
    const confidence = Math.min(100, Math.round((score / maxPossible) * 100));

    return confidence;
  }

  /**
   * Extract version information
   * @param {string} techKey - Technology key
   * @param {Object} data - Page data
   * @param {Object} matches - Match results
   * @returns {string|null} Version string or null
   */
  extractVersion(techKey, data, matches) {
    // Common version patterns
    const versionPatterns = {
      // Generic version patterns
      generic: [
        /(?:version|v)[=:\s]*["']?(\d+(?:\.\d+)*(?:-[\w.]+)?)/i,
        /(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/
      ],
      // Technology-specific patterns
      react: [/react\.(?:production\.min|development)\.js\?v=(\d+\.\d+\.\d+)/i, /React\s+v?(\d+\.\d+\.\d+)/i],
      vue: [/vue(?:\.runtime)?\.(?:esm|min)\.js\?v=(\d+\.\d+\.\d+)/i, /Vue\.version[=:]\s*["'](\d+\.\d+\.\d+)/i],
      angular: [/ng-version=["'](\d+\.\d+\.\d+)["']/i],
      jquery: [/jquery[.-](\d+\.\d+\.\d+)/i, /jQuery\s+v?(\d+\.\d+\.\d+)/i],
      bootstrap: [/bootstrap[.-](\d+\.\d+\.\d+)/i, /Bootstrap\s+v?(\d+\.\d+\.\d+)/i],
      wordpress: [/WordPress\s+(\d+\.\d+(?:\.\d+)?)/i, /wp-includes\/js\/.*\?ver=(\d+\.\d+\.\d+)/i],
      drupal: [/Drupal\s+(\d+(?:\.\d+)?)/i],
      php: [/PHP\/(\d+\.\d+\.\d+)/i],
      nginx: [/nginx\/(\d+\.\d+\.\d+)/i],
      apache: [/Apache\/(\d+\.\d+\.\d+)/i]
    };

    // Get patterns for this technology
    const patterns = versionPatterns[techKey] || versionPatterns.generic;
    const searchContent = [
      data.html,
      JSON.stringify(data.headers),
      data.scripts?.join('\n')
    ].filter(Boolean).join('\n');

    for (const pattern of patterns) {
      try {
        const match = searchContent.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      } catch (error) {
        // Skip invalid patterns
      }
    }

    return null;
  }

  /**
   * Group detections by category
   * @param {Array} detections - Array of detection objects
   * @returns {Object} Detections grouped by category
   */
  groupByCategory(detections) {
    const grouped = {};

    for (const detection of detections) {
      const category = detection.category || 'Unknown';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({
        key: detection.key,
        name: detection.name,
        confidence: detection.confidence,
        version: detection.version
      });
    }

    return grouped;
  }

  /**
   * Update detection statistics
   * @param {Array} detections - Array of detection objects
   */
  updateStats(detections) {
    this.stats.totalScans++;
    this.stats.totalDetections += detections.length;
    this.stats.lastScanTime = new Date().toISOString();

    // Update category counts
    for (const detection of detections) {
      const category = detection.category || 'Unknown';
      this.stats.detectionsByCategory[category] =
        (this.stats.detectionsByCategory[category] || 0) + 1;
    }

    // Update average confidence
    if (detections.length > 0) {
      const totalConfidence = detections.reduce((sum, d) => sum + d.confidence, 0);
      const avgThisScan = totalConfidence / detections.length;
      this.stats.averageConfidence = Math.round(
        (this.stats.averageConfidence * (this.stats.totalScans - 1) + avgThisScan) /
        this.stats.totalScans
      );
    }
  }

  /**
   * Get detection statistics
   * @returns {Object} Detection statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset detection statistics
   */
  resetStats() {
    this.stats = {
      totalScans: 0,
      totalDetections: 0,
      detectionsByCategory: {},
      averageConfidence: 0,
      lastScanTime: null
    };
  }

  /**
   * Detect a single technology
   * @param {string} techKey - Technology key to detect
   * @param {Object} pageData - Page data
   * @returns {Object} Detection result
   */
  detectSingle(techKey, pageData) {
    const fingerprint = getFingerprint(techKey);

    if (!fingerprint) {
      return {
        success: false,
        error: `Technology not found: ${techKey}`
      };
    }

    const {
      url = '',
      html = '',
      headers = {},
      scripts = [],
      cookies = [],
      meta = [],
      css = []
    } = pageData;

    const matches = this.matchFingerprint(techKey, fingerprint, {
      url,
      html,
      headers,
      scripts,
      cookies,
      meta,
      css
    });

    const confidence = this.calculateConfidence(matches);
    const detected = confidence >= this.options.minConfidence;

    return {
      success: true,
      detected,
      key: techKey,
      name: fingerprint.name,
      category: fingerprint.category,
      confidence,
      version: matches.version,
      matches: this.options.includePatterns ? matches : undefined
    };
  }

  /**
   * Detect technologies by category
   * @param {string} category - Category to detect
   * @param {Object} pageData - Page data
   * @returns {Object} Detection results for category
   */
  detectByCategory(category, pageData) {
    const technologies = [];

    for (const [key, fingerprint] of Object.entries(FINGERPRINTS)) {
      if (fingerprint.category === category) {
        technologies.push(key);
      }
    }

    if (technologies.length === 0) {
      return {
        success: false,
        error: `Category not found: ${category}`
      };
    }

    const detections = [];

    for (const techKey of technologies) {
      const result = this.detectSingle(techKey, pageData);
      if (result.success && result.detected) {
        detections.push({
          key: result.key,
          name: result.name,
          confidence: result.confidence,
          version: result.version
        });
      }
    }

    return {
      success: true,
      category,
      technologies: detections,
      count: detections.length
    };
  }
}

/**
 * Create a new detector instance with options
 * @param {Object} options - Detector options
 * @returns {TechnologyDetector} Detector instance
 */
function createDetector(options = {}) {
  return new TechnologyDetector(options);
}

module.exports = {
  TechnologyDetector,
  createDetector,
  CONFIDENCE_LEVELS,
  SOURCE_WEIGHTS
};

/**
 * Basset Hound Browser - Technology Detection Manager
 * Main module for detecting web technologies from page content
 *
 * Detects technologies from:
 * - HTML content
 * - HTTP headers
 * - Script URLs
 * - Cookies
 * - Meta tags
 * - CSS
 *
 * Categories detected:
 * - Frameworks (React, Vue, Angular)
 * - CMS (WordPress, Drupal)
 * - Servers (Apache, Nginx)
 * - Analytics (Google Analytics, Mixpanel)
 * - CDN (Cloudflare, Akamai)
 * - JavaScript libraries (jQuery, lodash)
 * - And many more...
 */

const {
  TechnologyDetector,
  createDetector,
  CONFIDENCE_LEVELS,
  SOURCE_WEIGHTS
} = require('./detector');

const {
  FINGERPRINTS,
  CATEGORIES,
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
} = require('./fingerprints');

/**
 * TechnologyManager class
 * Main interface for technology detection in Basset Hound Browser
 */
class TechnologyManager {
  constructor(options = {}) {
    // Initialize detector with options
    this.detector = createDetector({
      minConfidence: options.minConfidence || 25,
      maxResults: options.maxResults || 100,
      detectVersions: options.detectVersions !== false,
      includePatterns: options.includePatterns || false
    });

    // Cache for recent detections
    this.cache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 100;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes

    // Enabled state
    this.isEnabled = true;

    // Event callbacks
    this.onDetection = options.onDetection || null;

    console.log(`[TechnologyManager] Initialized with ${getTechnologyCount()} technologies`);
  }

  /**
   * Detect technologies from page data
   * This is the main detection method to be called from WebSocket server
   *
   * @param {Object} pageData - Page data object containing:
   *   - url: Page URL
   *   - html: HTML content
   *   - headers: HTTP response headers
   *   - scripts: Array of script URLs
   *   - cookies: Array of cookie objects or string
   *   - meta: Array of meta tag objects
   * @returns {Object} Detection result
   */
  async detectTechnologies(pageData) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'Technology detection is disabled'
      };
    }

    if (!pageData) {
      return {
        success: false,
        error: 'Page data is required'
      };
    }

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(pageData);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          cached: true
        };
      }

      // Perform detection
      const result = this.detector.detect(pageData);

      if (result.success) {
        // Cache the result
        this.addToCache(cacheKey, result);

        // Trigger callback if set
        if (this.onDetection && result.technologies.length > 0) {
          this.onDetection(result);
        }
      }

      return result;
    } catch (error) {
      console.error('[TechnologyManager] Detection error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get available detection categories
   * @returns {Object} Categories result
   */
  getCategories() {
    const categories = getCategories();
    const categoryInfo = [];

    for (const [key, name] of Object.entries(categories)) {
      const technologies = getTechnologiesByCategory(name);
      categoryInfo.push({
        key,
        name,
        technologyCount: technologies.length
      });
    }

    return {
      success: true,
      categories: categoryInfo,
      totalCategories: categoryInfo.length
    };
  }

  /**
   * Get information about a specific technology
   * @param {string} name - Technology name or key
   * @returns {Object} Technology info result
   */
  getTechnologyInfo(name) {
    if (!name) {
      return {
        success: false,
        error: 'Technology name is required'
      };
    }

    // Try to find by key first
    let fingerprint = getFingerprint(name);

    // If not found, search by name
    if (!fingerprint) {
      const results = searchTechnologies(name);
      if (results.length > 0) {
        fingerprint = results[0];
      }
    }

    if (!fingerprint) {
      return {
        success: false,
        error: `Technology not found: ${name}`
      };
    }

    return {
      success: true,
      technology: {
        key: fingerprint.key || name.toLowerCase(),
        name: fingerprint.name,
        category: fingerprint.category,
        website: fingerprint.website,
        description: fingerprint.description,
        patternTypes: Object.keys(fingerprint.patterns || {}).filter(
          k => fingerprint.patterns[k] && fingerprint.patterns[k].length > 0
        )
      }
    };
  }

  /**
   * Search for technologies
   * @param {string} query - Search query
   * @returns {Object} Search results
   */
  searchTechnologies(query) {
    if (!query) {
      return {
        success: false,
        error: 'Search query is required'
      };
    }

    const results = searchTechnologies(query);

    return {
      success: true,
      query,
      results: results.map(tech => ({
        key: tech.key,
        name: tech.name,
        category: tech.category,
        description: tech.description
      })),
      count: results.length
    };
  }

  /**
   * Get technologies by category
   * @param {string} category - Category name
   * @returns {Object} Technologies in category
   */
  getTechnologiesByCategory(category) {
    if (!category) {
      return {
        success: false,
        error: 'Category is required'
      };
    }

    const technologies = getTechnologiesByCategory(category);

    if (technologies.length === 0) {
      // Try to match category by key
      const categories = getCategories();
      const categoryKey = Object.keys(categories).find(
        k => k.toLowerCase() === category.toLowerCase()
      );

      if (categoryKey) {
        const matchedTechs = getTechnologiesByCategory(categories[categoryKey]);
        return {
          success: true,
          category: categories[categoryKey],
          technologies: matchedTechs.map(tech => ({
            key: tech.key,
            name: tech.name,
            website: tech.website,
            description: tech.description
          })),
          count: matchedTechs.length
        };
      }

      return {
        success: false,
        error: `Category not found: ${category}`
      };
    }

    return {
      success: true,
      category,
      technologies: technologies.map(tech => ({
        key: tech.key,
        name: tech.name,
        website: tech.website,
        description: tech.description
      })),
      count: technologies.length
    };
  }

  /**
   * Detect a specific technology
   * @param {string} techKey - Technology key
   * @param {Object} pageData - Page data
   * @returns {Object} Detection result
   */
  detectSpecific(techKey, pageData) {
    if (!techKey) {
      return {
        success: false,
        error: 'Technology key is required'
      };
    }

    if (!pageData) {
      return {
        success: false,
        error: 'Page data is required'
      };
    }

    return this.detector.detectSingle(techKey, pageData);
  }

  /**
   * Detect technologies in a specific category
   * @param {string} category - Category to detect
   * @param {Object} pageData - Page data
   * @returns {Object} Detection result
   */
  detectCategory(category, pageData) {
    if (!category) {
      return {
        success: false,
        error: 'Category is required'
      };
    }

    if (!pageData) {
      return {
        success: false,
        error: 'Page data is required'
      };
    }

    return this.detector.detectByCategory(category, pageData);
  }

  /**
   * Get detection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const detectorStats = this.detector.getStats();

    return {
      success: true,
      stats: {
        ...detectorStats,
        cacheSize: this.cache.size,
        totalTechnologies: getTechnologyCount(),
        isEnabled: this.isEnabled
      }
    };
  }

  /**
   * Reset detection statistics
   * @returns {Object} Result
   */
  resetStats() {
    this.detector.resetStats();
    return { success: true };
  }

  /**
   * Get all available technologies
   * @param {Object} options - Options for listing
   * @returns {Object} Technologies list
   */
  listTechnologies(options = {}) {
    const { category, limit, offset } = options;
    let technologies = [];

    if (category) {
      technologies = getTechnologiesByCategory(category);
    } else {
      for (const [key, tech] of Object.entries(FINGERPRINTS)) {
        technologies.push({
          key,
          ...tech
        });
      }
    }

    // Apply pagination
    const startIndex = offset || 0;
    const endIndex = limit ? startIndex + limit : technologies.length;
    const paginatedTechs = technologies.slice(startIndex, endIndex);

    return {
      success: true,
      technologies: paginatedTechs.map(tech => ({
        key: tech.key,
        name: tech.name,
        category: tech.category,
        website: tech.website,
        description: tech.description
      })),
      total: technologies.length,
      offset: startIndex,
      limit: limit || technologies.length
    };
  }

  /**
   * Get status of the technology manager
   * @returns {Object} Status
   */
  getStatus() {
    return {
      success: true,
      status: {
        enabled: this.isEnabled,
        totalTechnologies: getTechnologyCount(),
        categories: Object.keys(CATEGORIES).length,
        cacheSize: this.cache.size,
        cacheMaxSize: this.cacheMaxSize,
        stats: this.detector.getStats()
      }
    };
  }

  /**
   * Enable technology detection
   * @returns {Object} Result
   */
  enable() {
    this.isEnabled = true;
    console.log('[TechnologyManager] Enabled');
    return { success: true };
  }

  /**
   * Disable technology detection
   * @returns {Object} Result
   */
  disable() {
    this.isEnabled = false;
    console.log('[TechnologyManager] Disabled');
    return { success: true };
  }

  /**
   * Clear the detection cache
   * @returns {Object} Result
   */
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[TechnologyManager] Cache cleared (${size} entries)`);
    return {
      success: true,
      cleared: size
    };
  }

  /**
   * Set detection options
   * @param {Object} options - Options to set
   * @returns {Object} Result
   */
  setOptions(options) {
    if (options.minConfidence !== undefined) {
      this.detector.options.minConfidence = options.minConfidence;
    }
    if (options.maxResults !== undefined) {
      this.detector.options.maxResults = options.maxResults;
    }
    if (options.detectVersions !== undefined) {
      this.detector.options.detectVersions = options.detectVersions;
    }
    if (options.includePatterns !== undefined) {
      this.detector.options.includePatterns = options.includePatterns;
    }
    if (options.cacheMaxSize !== undefined) {
      this.cacheMaxSize = options.cacheMaxSize;
    }
    if (options.cacheTTL !== undefined) {
      this.cacheTTL = options.cacheTTL;
    }

    return {
      success: true,
      options: {
        minConfidence: this.detector.options.minConfidence,
        maxResults: this.detector.options.maxResults,
        detectVersions: this.detector.options.detectVersions,
        includePatterns: this.detector.options.includePatterns,
        cacheMaxSize: this.cacheMaxSize,
        cacheTTL: this.cacheTTL
      }
    };
  }

  /**
   * Get current options
   * @returns {Object} Current options
   */
  getOptions() {
    return {
      success: true,
      options: {
        minConfidence: this.detector.options.minConfidence,
        maxResults: this.detector.options.maxResults,
        detectVersions: this.detector.options.detectVersions,
        includePatterns: this.detector.options.includePatterns,
        cacheMaxSize: this.cacheMaxSize,
        cacheTTL: this.cacheTTL
      }
    };
  }

  // ==========================================
  // Cache Methods
  // ==========================================

  /**
   * Generate cache key from page data
   * @param {Object} pageData - Page data
   * @returns {string} Cache key
   */
  getCacheKey(pageData) {
    // Use URL and a hash of content for cache key
    const url = pageData.url || '';
    const htmlLength = (pageData.html || '').length;
    const headerCount = Object.keys(pageData.headers || {}).length;

    return `${url}:${htmlLength}:${headerCount}`;
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached result or null
   */
  getFromCache(key) {
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Add item to cache
   * @param {string} key - Cache key
   * @param {Object} result - Detection result
   */
  addToCache(key, result) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.cacheMaxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Set detection callback
   * @param {Function} callback - Callback function
   */
  setOnDetection(callback) {
    this.onDetection = callback;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.cache.clear();
    this.detector.resetStats();
    console.log('[TechnologyManager] Cleanup complete');
  }
}

// Export module components
module.exports = {
  // Main class
  TechnologyManager,

  // Detector components
  TechnologyDetector,
  createDetector,
  CONFIDENCE_LEVELS,
  SOURCE_WEIGHTS,

  // Fingerprint components
  FINGERPRINTS,
  CATEGORIES,
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
};

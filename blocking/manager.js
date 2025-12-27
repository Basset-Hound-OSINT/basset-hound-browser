/**
 * Basset Hound Browser - Content Blocking Manager
 * Comprehensive ad and tracker blocking with EasyList support
 */

const { session } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const {
  BUILTIN_FILTERS,
  EASYLIST_URLS,
  parseEasyList,
  getBuiltinPatterns,
  getFilterListInfo,
} = require('./filters');

/**
 * BlockingManager class
 * Manages content blocking, filter lists, whitelists, and statistics
 */
class BlockingManager {
  constructor(options = {}) {
    // Configuration
    this.dataPath = options.dataPath || path.join(process.cwd(), 'blocking-data');

    // State
    this.isEnabled = false;
    this.customRules = [];
    this.whitelistedDomains = new Set();
    this.loadedFilterLists = new Map(); // url/path -> parsed rules
    this.enabledCategories = new Set(['ads', 'trackers', 'cryptominers']);

    // All active block/allow patterns
    this.blockPatterns = [];
    this.allowPatterns = [];

    // Statistics
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      blockedByCategory: {
        ads: 0,
        trackers: 0,
        social: 0,
        cryptominers: 0,
        custom: 0,
        filterList: 0,
      },
      whitelistedRequests: 0,
      sessionStartTime: null,
    };

    // Request handler reference
    this.beforeRequestHandler = null;

    // Ensure data directory exists
    this.ensureDataDirectory();
  }

  /**
   * Ensure the data directory exists
   */
  ensureDataDirectory() {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(this.dataPath, { recursive: true });
      }
    } catch (error) {
      console.error('[BlockingManager] Failed to create data directory:', error);
    }
  }

  /**
   * Enable content blocking
   * @returns {Object} - Result of the operation
   */
  enableBlocking() {
    if (this.isEnabled) {
      return { success: true, message: 'Blocking already enabled' };
    }

    try {
      // Load built-in patterns for enabled categories
      this.loadBuiltinPatterns();

      // Setup request handler
      this.setupRequestHandler();

      this.isEnabled = true;
      this.stats.sessionStartTime = Date.now();

      console.log('[BlockingManager] Content blocking enabled');
      console.log(`[BlockingManager] Active block patterns: ${this.blockPatterns.length}`);
      console.log(`[BlockingManager] Whitelisted domains: ${this.whitelistedDomains.size}`);

      return {
        success: true,
        blockPatterns: this.blockPatterns.length,
        allowPatterns: this.allowPatterns.length,
        whitelistedDomains: this.whitelistedDomains.size,
        enabledCategories: Array.from(this.enabledCategories),
      };
    } catch (error) {
      console.error('[BlockingManager] Error enabling blocking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable content blocking
   * @returns {Object} - Result of the operation
   */
  disableBlocking() {
    if (!this.isEnabled) {
      return { success: true, message: 'Blocking already disabled' };
    }

    try {
      // Remove request handler
      if (this.beforeRequestHandler) {
        session.defaultSession.webRequest.onBeforeRequest(null);
        this.beforeRequestHandler = null;
      }

      this.isEnabled = false;
      console.log('[BlockingManager] Content blocking disabled');

      return { success: true };
    } catch (error) {
      console.error('[BlockingManager] Error disabling blocking:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load built-in patterns based on enabled categories
   */
  loadBuiltinPatterns() {
    const categories = Array.from(this.enabledCategories);
    const patterns = getBuiltinPatterns(categories);

    // Merge with existing patterns
    this.blockPatterns = [
      ...patterns.blockPatterns,
      ...this.customRules.map(r => r.pattern),
      ...this.getFilterListPatterns(),
    ];

    // Remove duplicates
    this.blockPatterns = [...new Set(this.blockPatterns)];
  }

  /**
   * Get patterns from loaded filter lists
   * @returns {string[]} - Array of patterns
   */
  getFilterListPatterns() {
    const patterns = [];
    for (const [, rules] of this.loadedFilterLists) {
      patterns.push(...rules.blockPatterns);
    }
    return patterns;
  }

  /**
   * Setup the request handler for blocking
   */
  setupRequestHandler() {
    // Remove existing handler if any
    if (this.beforeRequestHandler) {
      session.defaultSession.webRequest.onBeforeRequest(null);
    }

    this.beforeRequestHandler = (details, callback) => {
      this.stats.totalRequests++;

      const { url } = details;

      try {
        // Extract domain from URL
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        // Check whitelist first
        if (this.isDomainWhitelisted(domain)) {
          this.stats.whitelistedRequests++;
          callback({ cancel: false });
          return;
        }

        // Check allow patterns (exceptions)
        for (const pattern of this.allowPatterns) {
          if (this.matchesPattern(url, pattern)) {
            callback({ cancel: false });
            return;
          }
        }

        // Check block patterns
        for (const pattern of this.blockPatterns) {
          if (this.matchesPattern(url, pattern)) {
            this.stats.blockedRequests++;
            this.categorizeBlockedRequest(url);
            console.log(`[BlockingManager] Blocked: ${url.substring(0, 100)}`);
            callback({ cancel: true });
            return;
          }
        }

        callback({ cancel: false });
      } catch (error) {
        // If URL parsing fails, allow the request
        callback({ cancel: false });
      }
    };

    session.defaultSession.webRequest.onBeforeRequest(this.beforeRequestHandler);
  }

  /**
   * Check if a domain is whitelisted
   * @param {string} domain - Domain to check
   * @returns {boolean} - Whether the domain is whitelisted
   */
  isDomainWhitelisted(domain) {
    // Check exact match
    if (this.whitelistedDomains.has(domain)) {
      return true;
    }

    // Check parent domains
    const parts = domain.split('.');
    for (let i = 1; i < parts.length; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (this.whitelistedDomains.has(parentDomain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Categorize a blocked request for statistics
   * @param {string} url - Blocked URL
   */
  categorizeBlockedRequest(url) {
    const urlLower = url.toLowerCase();

    // Check against category patterns
    for (const [category, filter] of Object.entries(BUILTIN_FILTERS)) {
      for (const pattern of filter.patterns) {
        if (this.matchesPattern(url, pattern)) {
          if (this.stats.blockedByCategory[category] !== undefined) {
            this.stats.blockedByCategory[category]++;
          }
          return;
        }
      }
    }

    // Check if from filter list
    for (const [, rules] of this.loadedFilterLists) {
      for (const pattern of rules.blockPatterns) {
        if (this.matchesPattern(url, pattern)) {
          this.stats.blockedByCategory.filterList++;
          return;
        }
      }
    }

    // Must be custom rule
    this.stats.blockedByCategory.custom++;
  }

  /**
   * Match a URL against a pattern
   * @param {string} url - URL to match
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} - Whether the URL matches
   */
  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;

    // Exact match
    if (pattern === url) return true;

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(url);
    } catch (e) {
      return false;
    }
  }

  /**
   * Add a custom block rule
   * @param {string} pattern - Block pattern
   * @param {Object} options - Rule options
   * @returns {Object} - Result of the operation
   */
  addBlockRule(pattern, options = {}) {
    if (!pattern) {
      return { success: false, error: 'Pattern is required' };
    }

    const rule = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern: pattern,
      description: options.description || '',
      enabled: options.enabled !== false,
      createdAt: new Date().toISOString(),
    };

    this.customRules.push(rule);

    // Add to active patterns if blocking is enabled
    if (this.isEnabled && rule.enabled) {
      this.blockPatterns.push(pattern);
    }

    console.log(`[BlockingManager] Block rule added: ${pattern}`);

    return {
      success: true,
      rule: rule,
      totalCustomRules: this.customRules.length,
    };
  }

  /**
   * Remove a custom block rule
   * @param {string} pattern - Pattern to remove
   * @returns {Object} - Result of the operation
   */
  removeBlockRule(pattern) {
    const index = this.customRules.findIndex(r => r.pattern === pattern);

    if (index === -1) {
      return { success: false, error: 'Rule not found' };
    }

    this.customRules.splice(index, 1);

    // Remove from active patterns
    const patternIndex = this.blockPatterns.indexOf(pattern);
    if (patternIndex !== -1) {
      this.blockPatterns.splice(patternIndex, 1);
    }

    console.log(`[BlockingManager] Block rule removed: ${pattern}`);

    return {
      success: true,
      totalCustomRules: this.customRules.length,
    };
  }

  /**
   * Get all block rules
   * @returns {Object} - Result with rules
   */
  getBlockRules() {
    return {
      success: true,
      builtinCategories: getFilterListInfo(),
      enabledCategories: Array.from(this.enabledCategories),
      customRules: this.customRules,
      loadedFilterLists: Array.from(this.loadedFilterLists.keys()).map(key => ({
        source: key,
        title: this.loadedFilterLists.get(key).title || 'Unknown',
        patternCount: this.loadedFilterLists.get(key).blockPatterns.length,
      })),
      totalActivePatterns: this.blockPatterns.length,
    };
  }

  /**
   * Load a filter list from a URL (EasyList format)
   * @param {string} url - URL to the filter list
   * @returns {Promise<Object>} - Result of the operation
   */
  async loadFilterList(url) {
    if (!url) {
      return { success: false, error: 'URL is required' };
    }

    // Check for known EasyList URLs
    const knownUrl = EASYLIST_URLS[url] || url;

    try {
      console.log(`[BlockingManager] Loading filter list from: ${knownUrl}`);

      const content = await this.fetchUrl(knownUrl);
      const parsed = parseEasyList(content);

      // Store parsed rules
      this.loadedFilterLists.set(knownUrl, parsed);

      // Add to active patterns if enabled
      if (this.isEnabled) {
        this.blockPatterns.push(...parsed.blockPatterns);
        this.allowPatterns.push(...parsed.allowPatterns);

        // Remove duplicates
        this.blockPatterns = [...new Set(this.blockPatterns)];
        this.allowPatterns = [...new Set(this.allowPatterns)];
      }

      console.log(`[BlockingManager] Filter list loaded: ${parsed.title || knownUrl}`);
      console.log(`[BlockingManager] Patterns added: ${parsed.blockPatterns.length} block, ${parsed.allowPatterns.length} allow`);

      return {
        success: true,
        title: parsed.title,
        version: parsed.version,
        homepage: parsed.homepage,
        blockPatterns: parsed.blockPatterns.length,
        allowPatterns: parsed.allowPatterns.length,
        elementHideRules: parsed.elementHideRules.length,
        errors: parsed.errors.length,
      };
    } catch (error) {
      console.error('[BlockingManager] Error loading filter list:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load a filter list from a local file
   * @param {string} filePath - Path to the filter file
   * @returns {Promise<Object>} - Result of the operation
   */
  async loadLocalFilterList(filePath) {
    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    try {
      // Resolve path
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.dataPath, filePath);

      if (!fs.existsSync(resolvedPath)) {
        return { success: false, error: 'File not found' };
      }

      console.log(`[BlockingManager] Loading local filter list from: ${resolvedPath}`);

      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const parsed = parseEasyList(content);

      // Store parsed rules
      this.loadedFilterLists.set(resolvedPath, parsed);

      // Add to active patterns if enabled
      if (this.isEnabled) {
        this.blockPatterns.push(...parsed.blockPatterns);
        this.allowPatterns.push(...parsed.allowPatterns);

        // Remove duplicates
        this.blockPatterns = [...new Set(this.blockPatterns)];
        this.allowPatterns = [...new Set(this.allowPatterns)];
      }

      console.log(`[BlockingManager] Local filter list loaded: ${parsed.title || filePath}`);

      return {
        success: true,
        title: parsed.title,
        version: parsed.version,
        blockPatterns: parsed.blockPatterns.length,
        allowPatterns: parsed.allowPatterns.length,
        elementHideRules: parsed.elementHideRules.length,
        errors: parsed.errors.length,
      };
    } catch (error) {
      console.error('[BlockingManager] Error loading local filter list:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch content from a URL
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} - Content
   */
  fetchUrl(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      const request = client.get(url, {
        headers: {
          'User-Agent': 'Basset Hound Browser/1.0',
        },
        timeout: 30000,
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          this.fetchUrl(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Get blocking statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    const now = Date.now();
    const sessionDuration = this.stats.sessionStartTime
      ? Math.floor((now - this.stats.sessionStartTime) / 1000)
      : 0;

    return {
      success: true,
      enabled: this.isEnabled,
      sessionDurationSeconds: sessionDuration,
      totalRequests: this.stats.totalRequests,
      blockedRequests: this.stats.blockedRequests,
      blockedPercentage: this.stats.totalRequests > 0
        ? ((this.stats.blockedRequests / this.stats.totalRequests) * 100).toFixed(2)
        : 0,
      whitelistedRequests: this.stats.whitelistedRequests,
      blockedByCategory: { ...this.stats.blockedByCategory },
      activeBlockPatterns: this.blockPatterns.length,
      activeAllowPatterns: this.allowPatterns.length,
      whitelistedDomains: this.whitelistedDomains.size,
      customRules: this.customRules.length,
      loadedFilterLists: this.loadedFilterLists.size,
    };
  }

  /**
   * Clear blocking statistics
   * @returns {Object} - Result of the operation
   */
  clearStats() {
    const previousStats = { ...this.stats };

    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      blockedByCategory: {
        ads: 0,
        trackers: 0,
        social: 0,
        cryptominers: 0,
        custom: 0,
        filterList: 0,
      },
      whitelistedRequests: 0,
      sessionStartTime: this.isEnabled ? Date.now() : null,
    };

    console.log('[BlockingManager] Statistics cleared');

    return {
      success: true,
      previousStats,
    };
  }

  /**
   * Whitelist a domain
   * @param {string} domain - Domain to whitelist
   * @returns {Object} - Result of the operation
   */
  whitelistDomain(domain) {
    if (!domain) {
      return { success: false, error: 'Domain is required' };
    }

    // Clean domain
    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    if (this.whitelistedDomains.has(cleanDomain)) {
      return { success: true, message: 'Domain already whitelisted' };
    }

    this.whitelistedDomains.add(cleanDomain);

    console.log(`[BlockingManager] Domain whitelisted: ${cleanDomain}`);

    return {
      success: true,
      domain: cleanDomain,
      totalWhitelisted: this.whitelistedDomains.size,
    };
  }

  /**
   * Remove a domain from the whitelist
   * @param {string} domain - Domain to remove
   * @returns {Object} - Result of the operation
   */
  removeWhitelist(domain) {
    if (!domain) {
      return { success: false, error: 'Domain is required' };
    }

    const cleanDomain = domain.toLowerCase().replace(/^www\./, '');

    if (!this.whitelistedDomains.has(cleanDomain)) {
      return { success: false, error: 'Domain not in whitelist' };
    }

    this.whitelistedDomains.delete(cleanDomain);

    console.log(`[BlockingManager] Domain removed from whitelist: ${cleanDomain}`);

    return {
      success: true,
      domain: cleanDomain,
      totalWhitelisted: this.whitelistedDomains.size,
    };
  }

  /**
   * Get the whitelist
   * @returns {Object} - Whitelisted domains
   */
  getWhitelist() {
    return {
      success: true,
      domains: Array.from(this.whitelistedDomains),
      count: this.whitelistedDomains.size,
    };
  }

  /**
   * Enable or disable a built-in filter category
   * @param {string} category - Category name
   * @param {boolean} enabled - Whether to enable or disable
   * @returns {Object} - Result of the operation
   */
  setCategory(category, enabled) {
    if (!BUILTIN_FILTERS[category]) {
      return {
        success: false,
        error: `Unknown category: ${category}`,
        availableCategories: Object.keys(BUILTIN_FILTERS),
      };
    }

    if (enabled) {
      this.enabledCategories.add(category);
    } else {
      this.enabledCategories.delete(category);
    }

    // Reload patterns if blocking is enabled
    if (this.isEnabled) {
      this.loadBuiltinPatterns();
      this.setupRequestHandler();
    }

    console.log(`[BlockingManager] Category ${category} ${enabled ? 'enabled' : 'disabled'}`);

    return {
      success: true,
      category,
      enabled,
      enabledCategories: Array.from(this.enabledCategories),
    };
  }

  /**
   * Get available categories
   * @returns {Object} - Available categories
   */
  getCategories() {
    return {
      success: true,
      categories: getFilterListInfo(),
      enabledCategories: Array.from(this.enabledCategories),
    };
  }

  /**
   * Clear a specific filter list
   * @param {string} source - Source URL or path
   * @returns {Object} - Result of the operation
   */
  clearFilterList(source) {
    if (!this.loadedFilterLists.has(source)) {
      return { success: false, error: 'Filter list not found' };
    }

    const rules = this.loadedFilterLists.get(source);

    // Remove patterns
    for (const pattern of rules.blockPatterns) {
      const index = this.blockPatterns.indexOf(pattern);
      if (index !== -1) {
        this.blockPatterns.splice(index, 1);
      }
    }

    for (const pattern of rules.allowPatterns) {
      const index = this.allowPatterns.indexOf(pattern);
      if (index !== -1) {
        this.allowPatterns.splice(index, 1);
      }
    }

    this.loadedFilterLists.delete(source);

    console.log(`[BlockingManager] Filter list cleared: ${source}`);

    return {
      success: true,
      source,
      removedPatterns: rules.blockPatterns.length + rules.allowPatterns.length,
    };
  }

  /**
   * Clear all filter lists
   * @returns {Object} - Result of the operation
   */
  clearAllFilterLists() {
    const count = this.loadedFilterLists.size;

    for (const source of this.loadedFilterLists.keys()) {
      this.clearFilterList(source);
    }

    console.log(`[BlockingManager] All filter lists cleared (${count})`);

    return {
      success: true,
      clearedLists: count,
    };
  }

  /**
   * Export blocking configuration
   * @returns {Object} - Configuration export
   */
  exportConfig() {
    return {
      success: true,
      config: {
        enabledCategories: Array.from(this.enabledCategories),
        customRules: this.customRules,
        whitelistedDomains: Array.from(this.whitelistedDomains),
        loadedFilterListUrls: Array.from(this.loadedFilterLists.keys()),
      },
    };
  }

  /**
   * Import blocking configuration
   * @param {Object} config - Configuration to import
   * @returns {Promise<Object>} - Result of the operation
   */
  async importConfig(config) {
    try {
      // Import enabled categories
      if (Array.isArray(config.enabledCategories)) {
        this.enabledCategories = new Set(
          config.enabledCategories.filter(c => BUILTIN_FILTERS[c])
        );
      }

      // Import custom rules
      if (Array.isArray(config.customRules)) {
        this.customRules = config.customRules;
      }

      // Import whitelist
      if (Array.isArray(config.whitelistedDomains)) {
        this.whitelistedDomains = new Set(config.whitelistedDomains);
      }

      // Load filter lists
      if (Array.isArray(config.loadedFilterListUrls)) {
        for (const url of config.loadedFilterListUrls) {
          await this.loadFilterList(url);
        }
      }

      // Reload patterns if enabled
      if (this.isEnabled) {
        this.loadBuiltinPatterns();
        this.setupRequestHandler();
      }

      console.log('[BlockingManager] Configuration imported');

      return {
        success: true,
        enabledCategories: Array.from(this.enabledCategories),
        customRules: this.customRules.length,
        whitelistedDomains: this.whitelistedDomains.size,
        loadedFilterLists: this.loadedFilterLists.size,
      };
    } catch (error) {
      console.error('[BlockingManager] Error importing configuration:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get known EasyList URLs
   * @returns {Object} - Known URLs
   */
  getKnownFilterListUrls() {
    return {
      success: true,
      filterLists: Object.entries(EASYLIST_URLS).map(([name, url]) => ({
        name,
        url,
      })),
    };
  }

  /**
   * Cleanup and release resources
   */
  cleanup() {
    this.disableBlocking();
    this.customRules = [];
    this.whitelistedDomains.clear();
    this.loadedFilterLists.clear();
    this.blockPatterns = [];
    this.allowPatterns = [];
    console.log('[BlockingManager] Cleanup complete');
  }
}

// Export singleton instance and class
const blockingManager = new BlockingManager();

module.exports = {
  BlockingManager,
  blockingManager,
};

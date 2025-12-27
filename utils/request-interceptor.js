/**
 * Basset Hound Browser - Request Interceptor Module
 * Provides request interception, header modification, and resource blocking
 */

const { session } = require('electron');

/**
 * Resource types that can be blocked
 */
const RESOURCE_TYPES = {
  SCRIPT: 'script',
  STYLESHEET: 'stylesheet',
  IMAGE: 'image',
  FONT: 'font',
  MEDIA: 'media',
  WEBSOCKET: 'websocket',
  XHR: 'xhr',
  FETCH: 'fetch',
  DOCUMENT: 'document',
  SUBDOCUMENT: 'subFrame',
  OTHER: 'other'
};

/**
 * Predefined blocking rules for common ad/tracker domains
 */
const PREDEFINED_BLOCK_RULES = {
  ads: [
    '*://googleads.g.doubleclick.net/*',
    '*://pagead2.googlesyndication.com/*',
    '*://adservice.google.com/*',
    '*://www.googleadservices.com/*',
    '*://partner.googleadservices.com/*',
    '*://*.doubleclick.net/*',
    '*://*.googlesyndication.com/*',
    '*://*.amazon-adsystem.com/*',
    '*://ads.yahoo.com/*',
    '*://ads.facebook.com/*',
    '*://*.adsrvr.org/*',
    '*://*.adnxs.com/*',
    '*://*.bing.com/action/*',
    '*://static.ads-twitter.com/*',
    '*://*.moatads.com/*',
    '*://*.serving-sys.com/*',
    '*://*.2mdn.net/*',
  ],
  trackers: [
    '*://www.google-analytics.com/*',
    '*://analytics.google.com/*',
    '*://stats.g.doubleclick.net/*',
    '*://*.hotjar.com/*',
    '*://*.hotjar.io/*',
    '*://bat.bing.com/*',
    '*://www.facebook.com/tr/*',
    '*://connect.facebook.net/*/fbevents.js',
    '*://*.clarity.ms/*',
    '*://*.mixpanel.com/*',
    '*://*.segment.com/*',
    '*://*.segment.io/*',
    '*://*.amplitude.com/*',
    '*://*.heap.io/*',
    '*://*.fullstory.com/*',
    '*://*.mouseflow.com/*',
    '*://*.crazyegg.com/*',
    '*://*.optimizely.com/*',
    '*://*.quantserve.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.newrelic.com/*',
  ],
  social: [
    '*://platform.twitter.com/*',
    '*://platform.linkedin.com/*',
    '*://connect.facebook.net/*',
    '*://staticxx.facebook.com/*',
    '*://www.facebook.com/plugins/*',
    '*://platform.instagram.com/*',
    '*://widgets.pinterest.com/*',
    '*://static.addtoany.com/*',
    '*://*.sharethis.com/*',
    '*://*.addthis.com/*',
  ]
};

/**
 * Request Interceptor class
 * Manages request interception and modification
 */
class RequestInterceptor {
  constructor() {
    this.isEnabled = false;
    this.headerRules = [];
    this.blockRules = [];
    this.allowRules = [];
    this.resourceTypeBlocks = new Set();
    this.requestStats = {
      total: 0,
      blocked: 0,
      modified: 0
    };
    this.customHeaders = {};
    this.removeHeaders = new Set();
    this.beforeSendHeadersHandler = null;
    this.beforeRequestHandler = null;
    this.headersReceivedHandler = null;
  }

  /**
   * Initialize the interceptor with session handlers
   * @param {Object} options - Initialization options
   * @returns {Object} - Result of the operation
   */
  initialize(options = {}) {
    try {
      const {
        modifyHeaders = true,
        blockResources = true
      } = options;

      // Set up request interception
      if (blockResources) {
        this.setupBlockingHandler();
      }

      if (modifyHeaders) {
        this.setupHeaderModificationHandler();
      }

      this.isEnabled = true;
      console.log('[RequestInterceptor] Initialized successfully');

      return { success: true };
    } catch (error) {
      console.error('[RequestInterceptor] Initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up the blocking handler for requests
   */
  setupBlockingHandler() {
    // Remove existing handler if any
    if (this.beforeRequestHandler) {
      session.defaultSession.webRequest.onBeforeRequest(null);
    }

    this.beforeRequestHandler = (details, callback) => {
      this.requestStats.total++;

      const { url, resourceType } = details;

      // Check if resource type is blocked
      if (this.resourceTypeBlocks.has(resourceType)) {
        this.requestStats.blocked++;
        console.log(`[RequestInterceptor] Blocked by type (${resourceType}): ${url.substring(0, 100)}`);
        callback({ cancel: true });
        return;
      }

      // Check against block rules
      for (const rule of this.blockRules) {
        if (this.matchesPattern(url, rule.pattern)) {
          // Check if there's an allow rule that overrides
          let allowed = false;
          for (const allowRule of this.allowRules) {
            if (this.matchesPattern(url, allowRule.pattern)) {
              allowed = true;
              break;
            }
          }

          if (!allowed) {
            this.requestStats.blocked++;
            console.log(`[RequestInterceptor] Blocked by rule: ${url.substring(0, 100)}`);
            callback({ cancel: true });
            return;
          }
        }
      }

      callback({ cancel: false });
    };

    session.defaultSession.webRequest.onBeforeRequest(this.beforeRequestHandler);
  }

  /**
   * Set up the header modification handler
   */
  setupHeaderModificationHandler() {
    // Remove existing handler if any
    if (this.beforeSendHeadersHandler) {
      session.defaultSession.webRequest.onBeforeSendHeaders(null);
    }

    this.beforeSendHeadersHandler = (details, callback) => {
      let modified = false;
      const requestHeaders = { ...details.requestHeaders };

      // Remove specified headers
      for (const header of this.removeHeaders) {
        if (requestHeaders[header]) {
          delete requestHeaders[header];
          modified = true;
        }
        // Also check lowercase version
        const lowerHeader = header.toLowerCase();
        for (const key of Object.keys(requestHeaders)) {
          if (key.toLowerCase() === lowerHeader) {
            delete requestHeaders[key];
            modified = true;
          }
        }
      }

      // Add/modify custom headers
      for (const [header, value] of Object.entries(this.customHeaders)) {
        requestHeaders[header] = value;
        modified = true;
      }

      // Apply header rules
      for (const rule of this.headerRules) {
        if (!rule.urlPattern || this.matchesPattern(details.url, rule.urlPattern)) {
          if (rule.action === 'set') {
            requestHeaders[rule.header] = rule.value;
            modified = true;
          } else if (rule.action === 'remove') {
            delete requestHeaders[rule.header];
            modified = true;
          } else if (rule.action === 'append') {
            const existing = requestHeaders[rule.header] || '';
            requestHeaders[rule.header] = existing + rule.value;
            modified = true;
          }
        }
      }

      if (modified) {
        this.requestStats.modified++;
      }

      callback({ requestHeaders });
    };

    session.defaultSession.webRequest.onBeforeSendHeaders(this.beforeSendHeadersHandler);
  }

  /**
   * Match a URL against a pattern
   * @param {string} url - URL to match
   * @param {string} pattern - Pattern to match against (supports wildcards)
   * @returns {boolean} - Whether the URL matches
   */
  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;

    // Handle exact matches
    if (pattern === url) return true;

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars except *
      .replace(/\*/g, '.*'); // Convert * to .*

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(url);
    } catch (e) {
      console.error('[RequestInterceptor] Invalid pattern:', pattern, e);
      return false;
    }
  }

  /**
   * Add a blocking rule
   * @param {Object} rule - Rule configuration
   * @returns {Object} - Result of the operation
   */
  addBlockRule(rule) {
    if (!rule || !rule.pattern) {
      return { success: false, error: 'Rule pattern is required' };
    }

    const newRule = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern: rule.pattern,
      description: rule.description || '',
      enabled: rule.enabled !== false,
      resourceTypes: rule.resourceTypes || null, // null = all types
      createdAt: new Date().toISOString()
    };

    this.blockRules.push(newRule);
    console.log(`[RequestInterceptor] Block rule added: ${rule.pattern}`);

    return {
      success: true,
      rule: newRule,
      totalRules: this.blockRules.length
    };
  }

  /**
   * Add an allow rule (overrides block rules)
   * @param {Object} rule - Rule configuration
   * @returns {Object} - Result of the operation
   */
  addAllowRule(rule) {
    if (!rule || !rule.pattern) {
      return { success: false, error: 'Rule pattern is required' };
    }

    const newRule = {
      id: `allow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern: rule.pattern,
      description: rule.description || '',
      enabled: rule.enabled !== false,
      createdAt: new Date().toISOString()
    };

    this.allowRules.push(newRule);
    console.log(`[RequestInterceptor] Allow rule added: ${rule.pattern}`);

    return {
      success: true,
      rule: newRule,
      totalRules: this.allowRules.length
    };
  }

  /**
   * Add a header modification rule
   * @param {Object} rule - Rule configuration
   * @returns {Object} - Result of the operation
   */
  addHeaderRule(rule) {
    if (!rule || !rule.header) {
      return { success: false, error: 'Header name is required' };
    }

    if (!['set', 'remove', 'append'].includes(rule.action)) {
      return { success: false, error: 'Action must be set, remove, or append' };
    }

    if (rule.action !== 'remove' && rule.value === undefined) {
      return { success: false, error: 'Value is required for set/append actions' };
    }

    const newRule = {
      id: `header_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      header: rule.header,
      action: rule.action,
      value: rule.value,
      urlPattern: rule.urlPattern || null, // null = all URLs
      description: rule.description || '',
      enabled: rule.enabled !== false,
      createdAt: new Date().toISOString()
    };

    this.headerRules.push(newRule);
    console.log(`[RequestInterceptor] Header rule added: ${rule.action} ${rule.header}`);

    return {
      success: true,
      rule: newRule,
      totalRules: this.headerRules.length
    };
  }

  /**
   * Remove a rule by ID
   * @param {string} ruleId - Rule ID
   * @returns {Object} - Result of the operation
   */
  removeRule(ruleId) {
    let removed = false;

    // Try block rules
    const blockIndex = this.blockRules.findIndex(r => r.id === ruleId);
    if (blockIndex >= 0) {
      this.blockRules.splice(blockIndex, 1);
      removed = true;
    }

    // Try allow rules
    const allowIndex = this.allowRules.findIndex(r => r.id === ruleId);
    if (allowIndex >= 0) {
      this.allowRules.splice(allowIndex, 1);
      removed = true;
    }

    // Try header rules
    const headerIndex = this.headerRules.findIndex(r => r.id === ruleId);
    if (headerIndex >= 0) {
      this.headerRules.splice(headerIndex, 1);
      removed = true;
    }

    if (removed) {
      console.log(`[RequestInterceptor] Rule removed: ${ruleId}`);
      return { success: true };
    }

    return { success: false, error: 'Rule not found' };
  }

  /**
   * Set custom headers to be added to all requests
   * @param {Object} headers - Headers object
   * @returns {Object} - Result of the operation
   */
  setCustomHeaders(headers) {
    if (typeof headers !== 'object') {
      return { success: false, error: 'Headers must be an object' };
    }

    this.customHeaders = { ...headers };
    console.log(`[RequestInterceptor] Custom headers set: ${Object.keys(headers).join(', ')}`);

    return {
      success: true,
      headers: Object.keys(this.customHeaders)
    };
  }

  /**
   * Add headers to remove from requests
   * @param {Array} headers - Array of header names to remove
   * @returns {Object} - Result of the operation
   */
  setHeadersToRemove(headers) {
    if (!Array.isArray(headers)) {
      return { success: false, error: 'Headers must be an array' };
    }

    this.removeHeaders = new Set(headers);
    console.log(`[RequestInterceptor] Headers to remove: ${headers.join(', ')}`);

    return {
      success: true,
      headers: Array.from(this.removeHeaders)
    };
  }

  /**
   * Block a specific resource type
   * @param {string} resourceType - Resource type to block
   * @returns {Object} - Result of the operation
   */
  blockResourceType(resourceType) {
    const validTypes = Object.values(RESOURCE_TYPES);
    if (!validTypes.includes(resourceType)) {
      return {
        success: false,
        error: `Invalid resource type. Valid types: ${validTypes.join(', ')}`
      };
    }

    this.resourceTypeBlocks.add(resourceType);
    console.log(`[RequestInterceptor] Blocking resource type: ${resourceType}`);

    return {
      success: true,
      blockedTypes: Array.from(this.resourceTypeBlocks)
    };
  }

  /**
   * Unblock a specific resource type
   * @param {string} resourceType - Resource type to unblock
   * @returns {Object} - Result of the operation
   */
  unblockResourceType(resourceType) {
    this.resourceTypeBlocks.delete(resourceType);
    console.log(`[RequestInterceptor] Unblocking resource type: ${resourceType}`);

    return {
      success: true,
      blockedTypes: Array.from(this.resourceTypeBlocks)
    };
  }

  /**
   * Apply predefined blocking rules
   * @param {string} category - Category name (ads, trackers, social)
   * @returns {Object} - Result of the operation
   */
  applyPredefinedRules(category) {
    const rules = PREDEFINED_BLOCK_RULES[category];
    if (!rules) {
      return {
        success: false,
        error: `Unknown category. Available: ${Object.keys(PREDEFINED_BLOCK_RULES).join(', ')}`
      };
    }

    let added = 0;
    for (const pattern of rules) {
      const result = this.addBlockRule({
        pattern,
        description: `Predefined ${category} rule`
      });
      if (result.success) added++;
    }

    console.log(`[RequestInterceptor] Applied ${added} predefined ${category} rules`);

    return {
      success: true,
      category,
      rulesAdded: added,
      totalRules: this.blockRules.length
    };
  }

  /**
   * Set all request rules at once
   * @param {Object} rules - Rules configuration
   * @returns {Object} - Result of the operation
   */
  setRequestRules(rules) {
    if (typeof rules !== 'object') {
      return { success: false, error: 'Rules must be an object' };
    }

    const results = {
      blockRules: { added: 0, failed: 0 },
      allowRules: { added: 0, failed: 0 },
      headerRules: { added: 0, failed: 0 }
    };

    // Clear existing rules if specified
    if (rules.clearExisting) {
      this.blockRules = [];
      this.allowRules = [];
      this.headerRules = [];
    }

    // Add block rules
    if (Array.isArray(rules.blockRules)) {
      for (const rule of rules.blockRules) {
        const result = this.addBlockRule(rule);
        if (result.success) results.blockRules.added++;
        else results.blockRules.failed++;
      }
    }

    // Add allow rules
    if (Array.isArray(rules.allowRules)) {
      for (const rule of rules.allowRules) {
        const result = this.addAllowRule(rule);
        if (result.success) results.allowRules.added++;
        else results.allowRules.failed++;
      }
    }

    // Add header rules
    if (Array.isArray(rules.headerRules)) {
      for (const rule of rules.headerRules) {
        const result = this.addHeaderRule(rule);
        if (result.success) results.headerRules.added++;
        else results.headerRules.failed++;
      }
    }

    // Apply predefined categories
    if (Array.isArray(rules.predefinedCategories)) {
      for (const category of rules.predefinedCategories) {
        this.applyPredefinedRules(category);
      }
    }

    // Set resource type blocks
    if (Array.isArray(rules.blockedResourceTypes)) {
      for (const type of rules.blockedResourceTypes) {
        this.blockResourceType(type);
      }
    }

    // Set custom headers
    if (rules.customHeaders) {
      this.setCustomHeaders(rules.customHeaders);
    }

    // Set headers to remove
    if (rules.removeHeaders) {
      this.setHeadersToRemove(rules.removeHeaders);
    }

    console.log('[RequestInterceptor] Request rules set');

    return {
      success: true,
      results
    };
  }

  /**
   * Clear all request rules
   * @returns {Object} - Result of the operation
   */
  clearRequestRules() {
    const counts = {
      blockRules: this.blockRules.length,
      allowRules: this.allowRules.length,
      headerRules: this.headerRules.length,
      resourceTypeBlocks: this.resourceTypeBlocks.size
    };

    this.blockRules = [];
    this.allowRules = [];
    this.headerRules = [];
    this.resourceTypeBlocks.clear();
    this.customHeaders = {};
    this.removeHeaders.clear();

    console.log('[RequestInterceptor] All request rules cleared');

    return {
      success: true,
      cleared: counts
    };
  }

  /**
   * Get current status and rules
   * @returns {Object} - Current status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      stats: { ...this.requestStats },
      blockRules: this.blockRules.map(r => ({
        id: r.id,
        pattern: r.pattern,
        description: r.description,
        enabled: r.enabled
      })),
      allowRules: this.allowRules.map(r => ({
        id: r.id,
        pattern: r.pattern,
        description: r.description,
        enabled: r.enabled
      })),
      headerRules: this.headerRules.map(r => ({
        id: r.id,
        header: r.header,
        action: r.action,
        urlPattern: r.urlPattern,
        enabled: r.enabled
      })),
      blockedResourceTypes: Array.from(this.resourceTypeBlocks),
      customHeaders: Object.keys(this.customHeaders),
      removeHeaders: Array.from(this.removeHeaders)
    };
  }

  /**
   * Get all rules for export
   * @returns {Object} - All rules
   */
  exportRules() {
    return {
      blockRules: [...this.blockRules],
      allowRules: [...this.allowRules],
      headerRules: [...this.headerRules],
      blockedResourceTypes: Array.from(this.resourceTypeBlocks),
      customHeaders: { ...this.customHeaders },
      removeHeaders: Array.from(this.removeHeaders)
    };
  }

  /**
   * Import rules from export
   * @param {Object} rules - Rules to import
   * @param {boolean} merge - Whether to merge with existing rules
   * @returns {Object} - Result of the operation
   */
  importRules(rules, merge = false) {
    if (!merge) {
      this.clearRequestRules();
    }

    return this.setRequestRules({
      blockRules: rules.blockRules,
      allowRules: rules.allowRules,
      headerRules: rules.headerRules,
      blockedResourceTypes: rules.blockedResourceTypes,
      customHeaders: rules.customHeaders,
      removeHeaders: rules.removeHeaders
    });
  }

  /**
   * Reset request statistics
   * @returns {Object} - Result of the operation
   */
  resetStats() {
    const previousStats = { ...this.requestStats };
    this.requestStats = {
      total: 0,
      blocked: 0,
      modified: 0
    };

    return {
      success: true,
      previousStats
    };
  }

  /**
   * Disable the interceptor
   * @returns {Object} - Result of the operation
   */
  disable() {
    if (this.beforeRequestHandler) {
      session.defaultSession.webRequest.onBeforeRequest(null);
      this.beforeRequestHandler = null;
    }

    if (this.beforeSendHeadersHandler) {
      session.defaultSession.webRequest.onBeforeSendHeaders(null);
      this.beforeSendHeadersHandler = null;
    }

    this.isEnabled = false;
    console.log('[RequestInterceptor] Disabled');

    return { success: true };
  }

  /**
   * Re-enable the interceptor
   * @returns {Object} - Result of the operation
   */
  enable() {
    if (this.isEnabled) {
      return { success: true, message: 'Already enabled' };
    }

    return this.initialize();
  }
}

// Export singleton instance and class
const requestInterceptor = new RequestInterceptor();

module.exports = {
  requestInterceptor,
  RequestInterceptor,
  RESOURCE_TYPES,
  PREDEFINED_BLOCK_RULES
};

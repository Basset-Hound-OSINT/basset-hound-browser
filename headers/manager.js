/**
 * Basset Hound Browser - Header Manager Module
 * Provides comprehensive header management for requests and responses
 * Supports profiles, conditional rules, and URL-based header modification
 */

const { session } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * HeaderManager class
 * Manages HTTP headers for both requests and responses
 */
class HeaderManager {
  constructor(options = {}) {
    // Custom request headers (name -> value)
    this.requestHeaders = new Map();

    // Custom response headers (name -> value)
    this.responseHeaders = new Map();

    // Headers to remove from requests
    this.removeRequestHeaders = new Set();

    // Headers to remove from responses
    this.removeResponseHeaders = new Set();

    // Conditional headers (pattern-based rules)
    this.conditionalRequestHeaders = [];
    this.conditionalResponseHeaders = [];

    // Saved header profiles
    this.profiles = new Map();

    // Profile storage path
    this.storagePath = options.storagePath || null;

    // Active profile name
    this.activeProfile = null;

    // Statistics
    this.stats = {
      requestsModified: 0,
      responsesModified: 0,
      headersAdded: 0,
      headersRemoved: 0
    };

    // Handlers
    this.beforeSendHeadersHandler = null;
    this.headersReceivedHandler = null;

    // Enabled state
    this.isEnabled = false;

    // Load saved profiles if storage path provided
    if (this.storagePath) {
      this.loadProfilesFromDisk();
    }
  }

  /**
   * Initialize the header manager with session handlers
   * @returns {Object} - Result of the operation
   */
  initialize() {
    try {
      this.setupRequestHeaderHandler();
      this.setupResponseHeaderHandler();
      this.isEnabled = true;
      console.log('[HeaderManager] Initialized successfully');
      return { success: true };
    } catch (error) {
      console.error('[HeaderManager] Initialization error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set up the request header modification handler
   */
  setupRequestHeaderHandler() {
    if (this.beforeSendHeadersHandler) {
      session.defaultSession.webRequest.onBeforeSendHeaders(null);
    }

    this.beforeSendHeadersHandler = (details, callback) => {
      let modified = false;
      const requestHeaders = { ...details.requestHeaders };

      // Remove specified headers
      for (const header of this.removeRequestHeaders) {
        const headerLower = header.toLowerCase();
        for (const key of Object.keys(requestHeaders)) {
          if (key.toLowerCase() === headerLower) {
            delete requestHeaders[key];
            modified = true;
            this.stats.headersRemoved++;
          }
        }
      }

      // Add/modify custom request headers
      for (const [header, value] of this.requestHeaders) {
        requestHeaders[header] = value;
        modified = true;
        this.stats.headersAdded++;
      }

      // Apply conditional headers based on URL patterns
      for (const rule of this.conditionalRequestHeaders) {
        if (this.matchesPattern(details.url, rule.pattern)) {
          if (rule.remove) {
            const headerLower = rule.name.toLowerCase();
            for (const key of Object.keys(requestHeaders)) {
              if (key.toLowerCase() === headerLower) {
                delete requestHeaders[key];
                modified = true;
                this.stats.headersRemoved++;
              }
            }
          } else {
            requestHeaders[rule.name] = rule.value;
            modified = true;
            this.stats.headersAdded++;
          }
        }
      }

      if (modified) {
        this.stats.requestsModified++;
      }

      callback({ requestHeaders });
    };

    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['<all_urls>'] },
      this.beforeSendHeadersHandler
    );
  }

  /**
   * Set up the response header modification handler
   */
  setupResponseHeaderHandler() {
    if (this.headersReceivedHandler) {
      session.defaultSession.webRequest.onHeadersReceived(null);
    }

    this.headersReceivedHandler = (details, callback) => {
      let modified = false;
      const responseHeaders = { ...details.responseHeaders };

      // Remove specified headers from responses
      for (const header of this.removeResponseHeaders) {
        const headerLower = header.toLowerCase();
        for (const key of Object.keys(responseHeaders)) {
          if (key.toLowerCase() === headerLower) {
            delete responseHeaders[key];
            modified = true;
            this.stats.headersRemoved++;
          }
        }
      }

      // Add/modify custom response headers
      for (const [header, value] of this.responseHeaders) {
        responseHeaders[header] = [value];
        modified = true;
        this.stats.headersAdded++;
      }

      // Apply conditional response headers based on URL patterns
      for (const rule of this.conditionalResponseHeaders) {
        if (this.matchesPattern(details.url, rule.pattern)) {
          if (rule.remove) {
            const headerLower = rule.name.toLowerCase();
            for (const key of Object.keys(responseHeaders)) {
              if (key.toLowerCase() === headerLower) {
                delete responseHeaders[key];
                modified = true;
                this.stats.headersRemoved++;
              }
            }
          } else {
            responseHeaders[rule.name] = [rule.value];
            modified = true;
            this.stats.headersAdded++;
          }
        }
      }

      if (modified) {
        this.stats.responsesModified++;
      }

      callback({ responseHeaders });
    };

    session.defaultSession.webRequest.onHeadersReceived(
      { urls: ['<all_urls>'] },
      this.headersReceivedHandler
    );
  }

  /**
   * Match a URL against a pattern (supports wildcards)
   * @param {string} url - URL to match
   * @param {string} pattern - Pattern to match against
   * @returns {boolean} - Whether the URL matches
   */
  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;
    if (pattern === '*' || pattern === '<all_urls>') return true;
    if (pattern === url) return true;

    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');

    try {
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(url);
    } catch (e) {
      console.error('[HeaderManager] Invalid pattern:', pattern, e);
      return false;
    }
  }

  // ==========================================
  // Request Header Methods
  // ==========================================

  /**
   * Set a request header
   * @param {string} name - Header name
   * @param {string} value - Header value
   * @returns {Object} - Result of the operation
   */
  setRequestHeader(name, value) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Header name is required' };
    }

    this.requestHeaders.set(name, value);
    console.log(`[HeaderManager] Set request header: ${name}`);

    return {
      success: true,
      header: name,
      value: value,
      totalRequestHeaders: this.requestHeaders.size
    };
  }

  /**
   * Remove a request header
   * @param {string} name - Header name to remove
   * @returns {Object} - Result of the operation
   */
  removeRequestHeader(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Header name is required' };
    }

    // Check if it's in custom headers first
    if (this.requestHeaders.has(name)) {
      this.requestHeaders.delete(name);
    }

    // Add to removal list to strip from all requests
    this.removeRequestHeaders.add(name);
    console.log(`[HeaderManager] Request header marked for removal: ${name}`);

    return {
      success: true,
      header: name,
      totalRemoveHeaders: this.removeRequestHeaders.size
    };
  }

  /**
   * Get all custom request headers
   * @returns {Object} - Result with all request headers
   */
  getRequestHeaders() {
    const headers = {};
    for (const [name, value] of this.requestHeaders) {
      headers[name] = value;
    }

    return {
      success: true,
      headers: headers,
      removeHeaders: Array.from(this.removeRequestHeaders),
      conditionalHeaders: this.conditionalRequestHeaders.map(r => ({
        pattern: r.pattern,
        name: r.name,
        value: r.value,
        remove: r.remove || false
      }))
    };
  }

  /**
   * Clear all custom request headers
   * @returns {Object} - Result of the operation
   */
  clearRequestHeaders() {
    const count = this.requestHeaders.size + this.removeRequestHeaders.size;
    this.requestHeaders.clear();
    this.removeRequestHeaders.clear();
    this.conditionalRequestHeaders = [];
    console.log('[HeaderManager] Request headers cleared');

    return {
      success: true,
      cleared: count
    };
  }

  // ==========================================
  // Response Header Methods
  // ==========================================

  /**
   * Set a response header
   * @param {string} name - Header name
   * @param {string} value - Header value
   * @returns {Object} - Result of the operation
   */
  setResponseHeader(name, value) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Header name is required' };
    }

    this.responseHeaders.set(name, value);
    console.log(`[HeaderManager] Set response header: ${name}`);

    return {
      success: true,
      header: name,
      value: value,
      totalResponseHeaders: this.responseHeaders.size
    };
  }

  /**
   * Remove a response header
   * @param {string} name - Header name to remove
   * @returns {Object} - Result of the operation
   */
  removeResponseHeader(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Header name is required' };
    }

    // Check if it's in custom headers first
    if (this.responseHeaders.has(name)) {
      this.responseHeaders.delete(name);
    }

    // Add to removal list to strip from all responses
    this.removeResponseHeaders.add(name);
    console.log(`[HeaderManager] Response header marked for removal: ${name}`);

    return {
      success: true,
      header: name,
      totalRemoveHeaders: this.removeResponseHeaders.size
    };
  }

  /**
   * Get all custom response headers
   * @returns {Object} - Result with all response headers
   */
  getResponseHeaders() {
    const headers = {};
    for (const [name, value] of this.responseHeaders) {
      headers[name] = value;
    }

    return {
      success: true,
      headers: headers,
      removeHeaders: Array.from(this.removeResponseHeaders),
      conditionalHeaders: this.conditionalResponseHeaders.map(r => ({
        pattern: r.pattern,
        name: r.name,
        value: r.value,
        remove: r.remove || false
      }))
    };
  }

  /**
   * Clear all custom response headers
   * @returns {Object} - Result of the operation
   */
  clearResponseHeaders() {
    const count = this.responseHeaders.size + this.removeResponseHeaders.size;
    this.responseHeaders.clear();
    this.removeResponseHeaders.clear();
    this.conditionalResponseHeaders = [];
    console.log('[HeaderManager] Response headers cleared');

    return {
      success: true,
      cleared: count
    };
  }

  // ==========================================
  // Conditional Header Methods
  // ==========================================

  /**
   * Set a conditional request header (URL-based rule)
   * @param {string} pattern - URL pattern to match
   * @param {string} name - Header name
   * @param {string} value - Header value (null to remove)
   * @returns {Object} - Result of the operation
   */
  setConditionalHeader(pattern, name, value) {
    if (!pattern || !name) {
      return { success: false, error: 'Pattern and header name are required' };
    }

    const rule = {
      id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern: pattern,
      name: name,
      value: value,
      remove: value === null || value === undefined,
      type: 'request',
      createdAt: new Date().toISOString()
    };

    this.conditionalRequestHeaders.push(rule);
    console.log(`[HeaderManager] Conditional request header added: ${name} for ${pattern}`);

    return {
      success: true,
      rule: rule,
      totalConditionalHeaders: this.conditionalRequestHeaders.length
    };
  }

  /**
   * Set a conditional response header (URL-based rule)
   * @param {string} pattern - URL pattern to match
   * @param {string} name - Header name
   * @param {string} value - Header value (null to remove)
   * @returns {Object} - Result of the operation
   */
  setConditionalResponseHeader(pattern, name, value) {
    if (!pattern || !name) {
      return { success: false, error: 'Pattern and header name are required' };
    }

    const rule = {
      id: `cond_resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pattern: pattern,
      name: name,
      value: value,
      remove: value === null || value === undefined,
      type: 'response',
      createdAt: new Date().toISOString()
    };

    this.conditionalResponseHeaders.push(rule);
    console.log(`[HeaderManager] Conditional response header added: ${name} for ${pattern}`);

    return {
      success: true,
      rule: rule,
      totalConditionalHeaders: this.conditionalResponseHeaders.length
    };
  }

  /**
   * Get all conditional headers
   * @returns {Object} - Result with all conditional headers
   */
  getConditionalHeaders() {
    return {
      success: true,
      requestHeaders: this.conditionalRequestHeaders.map(r => ({
        id: r.id,
        pattern: r.pattern,
        name: r.name,
        value: r.value,
        remove: r.remove
      })),
      responseHeaders: this.conditionalResponseHeaders.map(r => ({
        id: r.id,
        pattern: r.pattern,
        name: r.name,
        value: r.value,
        remove: r.remove
      }))
    };
  }

  /**
   * Remove a conditional header by ID
   * @param {string} ruleId - Rule ID to remove
   * @returns {Object} - Result of the operation
   */
  removeConditionalHeader(ruleId) {
    let removed = false;

    // Try request headers
    const reqIndex = this.conditionalRequestHeaders.findIndex(r => r.id === ruleId);
    if (reqIndex >= 0) {
      this.conditionalRequestHeaders.splice(reqIndex, 1);
      removed = true;
    }

    // Try response headers
    const respIndex = this.conditionalResponseHeaders.findIndex(r => r.id === ruleId);
    if (respIndex >= 0) {
      this.conditionalResponseHeaders.splice(respIndex, 1);
      removed = true;
    }

    if (removed) {
      console.log(`[HeaderManager] Conditional header removed: ${ruleId}`);
      return { success: true };
    }

    return { success: false, error: 'Rule not found' };
  }

  /**
   * Clear all conditional headers
   * @returns {Object} - Result of the operation
   */
  clearConditionalHeaders() {
    const count = this.conditionalRequestHeaders.length + this.conditionalResponseHeaders.length;
    this.conditionalRequestHeaders = [];
    this.conditionalResponseHeaders = [];
    console.log('[HeaderManager] Conditional headers cleared');

    return {
      success: true,
      cleared: count
    };
  }

  // ==========================================
  // Profile Methods
  // ==========================================

  /**
   * Create a header profile
   * @param {string} name - Profile name
   * @param {Object} headers - Headers configuration
   * @returns {Object} - Result of the operation
   */
  createHeaderProfile(name, headers = {}) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    const profile = {
      name: name,
      requestHeaders: headers.requestHeaders || {},
      responseHeaders: headers.responseHeaders || {},
      removeRequestHeaders: headers.removeRequestHeaders || [],
      removeResponseHeaders: headers.removeResponseHeaders || [],
      conditionalRequestHeaders: headers.conditionalRequestHeaders || [],
      conditionalResponseHeaders: headers.conditionalResponseHeaders || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.profiles.set(name, profile);
    console.log(`[HeaderManager] Profile created: ${name}`);

    // Save to disk if storage path configured
    if (this.storagePath) {
      this.saveProfilesToDisk();
    }

    return {
      success: true,
      profile: profile,
      totalProfiles: this.profiles.size
    };
  }

  /**
   * Load a header profile
   * @param {string} name - Profile name
   * @returns {Object} - Result of the operation
   */
  loadHeaderProfile(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    const profile = this.profiles.get(name);
    if (!profile) {
      return { success: false, error: `Profile not found: ${name}` };
    }

    // Clear existing headers
    this.clearRequestHeaders();
    this.clearResponseHeaders();

    // Apply profile request headers
    for (const [header, value] of Object.entries(profile.requestHeaders || {})) {
      this.requestHeaders.set(header, value);
    }

    // Apply profile response headers
    for (const [header, value] of Object.entries(profile.responseHeaders || {})) {
      this.responseHeaders.set(header, value);
    }

    // Apply headers to remove
    for (const header of (profile.removeRequestHeaders || [])) {
      this.removeRequestHeaders.add(header);
    }

    for (const header of (profile.removeResponseHeaders || [])) {
      this.removeResponseHeaders.add(header);
    }

    // Apply conditional headers
    this.conditionalRequestHeaders = [...(profile.conditionalRequestHeaders || [])];
    this.conditionalResponseHeaders = [...(profile.conditionalResponseHeaders || [])];

    this.activeProfile = name;
    console.log(`[HeaderManager] Profile loaded: ${name}`);

    return {
      success: true,
      profile: profile,
      activeProfile: name
    };
  }

  /**
   * List all saved profiles
   * @returns {Object} - Result with profile list
   */
  listHeaderProfiles() {
    const profiles = [];
    for (const [name, profile] of this.profiles) {
      profiles.push({
        name: name,
        requestHeaderCount: Object.keys(profile.requestHeaders || {}).length,
        responseHeaderCount: Object.keys(profile.responseHeaders || {}).length,
        removeRequestHeaderCount: (profile.removeRequestHeaders || []).length,
        removeResponseHeaderCount: (profile.removeResponseHeaders || []).length,
        conditionalHeaderCount: (profile.conditionalRequestHeaders || []).length +
                                (profile.conditionalResponseHeaders || []).length,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      });
    }

    return {
      success: true,
      profiles: profiles,
      activeProfile: this.activeProfile,
      totalProfiles: this.profiles.size
    };
  }

  /**
   * Delete a header profile
   * @param {string} name - Profile name
   * @returns {Object} - Result of the operation
   */
  deleteHeaderProfile(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    if (!this.profiles.has(name)) {
      return { success: false, error: `Profile not found: ${name}` };
    }

    this.profiles.delete(name);

    if (this.activeProfile === name) {
      this.activeProfile = null;
    }

    console.log(`[HeaderManager] Profile deleted: ${name}`);

    // Save to disk if storage path configured
    if (this.storagePath) {
      this.saveProfilesToDisk();
    }

    return {
      success: true,
      deletedProfile: name,
      totalProfiles: this.profiles.size
    };
  }

  /**
   * Get a specific profile by name
   * @param {string} name - Profile name
   * @returns {Object} - Result with profile data
   */
  getHeaderProfile(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    const profile = this.profiles.get(name);
    if (!profile) {
      return { success: false, error: `Profile not found: ${name}` };
    }

    return {
      success: true,
      profile: profile
    };
  }

  /**
   * Save current headers as a profile
   * @param {string} name - Profile name
   * @returns {Object} - Result of the operation
   */
  saveCurrentAsProfile(name) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    const requestHeaders = {};
    for (const [header, value] of this.requestHeaders) {
      requestHeaders[header] = value;
    }

    const responseHeaders = {};
    for (const [header, value] of this.responseHeaders) {
      responseHeaders[header] = value;
    }

    return this.createHeaderProfile(name, {
      requestHeaders: requestHeaders,
      responseHeaders: responseHeaders,
      removeRequestHeaders: Array.from(this.removeRequestHeaders),
      removeResponseHeaders: Array.from(this.removeResponseHeaders),
      conditionalRequestHeaders: [...this.conditionalRequestHeaders],
      conditionalResponseHeaders: [...this.conditionalResponseHeaders]
    });
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Get current status
   * @returns {Object} - Current status
   */
  getStatus() {
    const requestHeaders = {};
    for (const [name, value] of this.requestHeaders) {
      requestHeaders[name] = value;
    }

    const responseHeaders = {};
    for (const [name, value] of this.responseHeaders) {
      responseHeaders[name] = value;
    }

    return {
      enabled: this.isEnabled,
      activeProfile: this.activeProfile,
      stats: { ...this.stats },
      requestHeaders: requestHeaders,
      responseHeaders: responseHeaders,
      removeRequestHeaders: Array.from(this.removeRequestHeaders),
      removeResponseHeaders: Array.from(this.removeResponseHeaders),
      conditionalRequestHeaders: this.conditionalRequestHeaders.length,
      conditionalResponseHeaders: this.conditionalResponseHeaders.length,
      profileCount: this.profiles.size
    };
  }

  /**
   * Reset statistics
   * @returns {Object} - Previous stats
   */
  resetStats() {
    const previousStats = { ...this.stats };
    this.stats = {
      requestsModified: 0,
      responsesModified: 0,
      headersAdded: 0,
      headersRemoved: 0
    };
    return { success: true, previousStats };
  }

  /**
   * Clear all headers (request, response, and conditional)
   * @returns {Object} - Result of the operation
   */
  clearAllHeaders() {
    const requestCount = this.requestHeaders.size + this.removeRequestHeaders.size +
                         this.conditionalRequestHeaders.length;
    const responseCount = this.responseHeaders.size + this.removeResponseHeaders.size +
                          this.conditionalResponseHeaders.length;

    this.requestHeaders.clear();
    this.responseHeaders.clear();
    this.removeRequestHeaders.clear();
    this.removeResponseHeaders.clear();
    this.conditionalRequestHeaders = [];
    this.conditionalResponseHeaders = [];
    this.activeProfile = null;

    console.log('[HeaderManager] All headers cleared');

    return {
      success: true,
      clearedRequestHeaders: requestCount,
      clearedResponseHeaders: responseCount
    };
  }

  /**
   * Export all configuration
   * @returns {Object} - Full configuration export
   */
  exportConfiguration() {
    const requestHeaders = {};
    for (const [name, value] of this.requestHeaders) {
      requestHeaders[name] = value;
    }

    const responseHeaders = {};
    for (const [name, value] of this.responseHeaders) {
      responseHeaders[name] = value;
    }

    const profiles = {};
    for (const [name, profile] of this.profiles) {
      profiles[name] = profile;
    }

    return {
      success: true,
      configuration: {
        requestHeaders: requestHeaders,
        responseHeaders: responseHeaders,
        removeRequestHeaders: Array.from(this.removeRequestHeaders),
        removeResponseHeaders: Array.from(this.removeResponseHeaders),
        conditionalRequestHeaders: [...this.conditionalRequestHeaders],
        conditionalResponseHeaders: [...this.conditionalResponseHeaders],
        profiles: profiles,
        activeProfile: this.activeProfile,
        exportedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Import configuration
   * @param {Object} config - Configuration to import
   * @param {boolean} merge - Whether to merge with existing config
   * @returns {Object} - Result of the operation
   */
  importConfiguration(config, merge = false) {
    if (!config || typeof config !== 'object') {
      return { success: false, error: 'Configuration object is required' };
    }

    if (!merge) {
      this.clearAllHeaders();
      this.profiles.clear();
    }

    // Import request headers
    if (config.requestHeaders) {
      for (const [name, value] of Object.entries(config.requestHeaders)) {
        this.requestHeaders.set(name, value);
      }
    }

    // Import response headers
    if (config.responseHeaders) {
      for (const [name, value] of Object.entries(config.responseHeaders)) {
        this.responseHeaders.set(name, value);
      }
    }

    // Import removal lists
    if (Array.isArray(config.removeRequestHeaders)) {
      for (const header of config.removeRequestHeaders) {
        this.removeRequestHeaders.add(header);
      }
    }

    if (Array.isArray(config.removeResponseHeaders)) {
      for (const header of config.removeResponseHeaders) {
        this.removeResponseHeaders.add(header);
      }
    }

    // Import conditional headers
    if (Array.isArray(config.conditionalRequestHeaders)) {
      this.conditionalRequestHeaders.push(...config.conditionalRequestHeaders);
    }

    if (Array.isArray(config.conditionalResponseHeaders)) {
      this.conditionalResponseHeaders.push(...config.conditionalResponseHeaders);
    }

    // Import profiles
    if (config.profiles) {
      for (const [name, profile] of Object.entries(config.profiles)) {
        this.profiles.set(name, profile);
      }
    }

    console.log('[HeaderManager] Configuration imported');

    return { success: true };
  }

  /**
   * Load profiles from disk
   */
  loadProfilesFromDisk() {
    if (!this.storagePath) return;

    const profilesFile = path.join(this.storagePath, 'header-profiles.json');
    try {
      if (fs.existsSync(profilesFile)) {
        const data = fs.readFileSync(profilesFile, 'utf8');
        const profiles = JSON.parse(data);
        for (const [name, profile] of Object.entries(profiles)) {
          this.profiles.set(name, profile);
        }
        console.log(`[HeaderManager] Loaded ${this.profiles.size} profiles from disk`);
      }
    } catch (error) {
      console.error('[HeaderManager] Error loading profiles:', error);
    }
  }

  /**
   * Save profiles to disk
   */
  saveProfilesToDisk() {
    if (!this.storagePath) return;

    const profilesFile = path.join(this.storagePath, 'header-profiles.json');
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.storagePath)) {
        fs.mkdirSync(this.storagePath, { recursive: true });
      }

      const profiles = {};
      for (const [name, profile] of this.profiles) {
        profiles[name] = profile;
      }
      fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
      console.log(`[HeaderManager] Saved ${this.profiles.size} profiles to disk`);
    } catch (error) {
      console.error('[HeaderManager] Error saving profiles:', error);
    }
  }

  /**
   * Disable the header manager
   * @returns {Object} - Result of the operation
   */
  disable() {
    if (this.beforeSendHeadersHandler) {
      session.defaultSession.webRequest.onBeforeSendHeaders(null);
      this.beforeSendHeadersHandler = null;
    }

    if (this.headersReceivedHandler) {
      session.defaultSession.webRequest.onHeadersReceived(null);
      this.headersReceivedHandler = null;
    }

    this.isEnabled = false;
    console.log('[HeaderManager] Disabled');

    return { success: true };
  }

  /**
   * Re-enable the header manager
   * @returns {Object} - Result of the operation
   */
  enable() {
    if (this.isEnabled) {
      return { success: true, message: 'Already enabled' };
    }

    return this.initialize();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.disable();
    if (this.storagePath) {
      this.saveProfilesToDisk();
    }
  }
}

// Export class
module.exports = {
  HeaderManager
};

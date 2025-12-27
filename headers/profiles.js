/**
 * Basset Hound Browser - Header Profiles Module
 * Provides predefined header profiles for common use cases
 */

/**
 * Common tracking headers to remove for anonymity
 */
const TRACKING_HEADERS = [
  'X-Requested-With',
  'X-Forwarded-For',
  'X-Real-IP',
  'X-Client-IP',
  'CF-Connecting-IP',
  'True-Client-IP',
  'X-Cluster-Client-IP',
  'Forwarded',
  'Via',
  'X-Correlation-ID',
  'X-Request-ID',
  'X-Trace-ID',
  'X-Amzn-Trace-Id',
  'X-Cloud-Trace-Context'
];

/**
 * Response headers commonly used for tracking/fingerprinting to remove
 */
const TRACKING_RESPONSE_HEADERS = [
  'X-Request-Id',
  'X-Correlation-Id',
  'Set-Cookie',
  'X-Amzn-RequestId',
  'X-Cache',
  'X-Served-By',
  'X-Timer'
];

/**
 * Predefined header profiles
 */
const PREDEFINED_PROFILES = {
  /**
   * Anonymous profile - removes tracking headers and adds privacy-focused headers
   */
  anonymous: {
    name: 'anonymous',
    description: 'Removes tracking headers and enhances privacy',
    requestHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Sec-GPC': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      ...TRACKING_HEADERS,
      'Referer',
      'Cookie'
    ],
    removeResponseHeaders: TRACKING_RESPONSE_HEADERS,
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * Mobile profile - simulates mobile device headers
   */
  mobile: {
    name: 'mobile',
    description: 'Simulates mobile device request headers',
    requestHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Chromium";v="120", "Not_A Brand";v="8"',
      'Sec-CH-UA-Mobile': '?1',
      'Sec-CH-UA-Platform': '"Android"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    responseHeaders: {},
    removeRequestHeaders: [],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * Bot profile - simulates search engine crawler headers
   */
  bot: {
    name: 'bot',
    description: 'Simulates search engine bot/crawler headers',
    requestHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en',
      'Accept-Encoding': 'gzip, deflate',
      'From': 'googlebot(at)googlebot.com',
      'Cache-Control': 'no-cache'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      'Cookie',
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Site',
      'Sec-Fetch-User'
    ],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * API client profile - headers for API requests
   */
  'api-client': {
    name: 'api-client',
    description: 'Headers optimized for API requests',
    requestHeaders: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Site',
      'Sec-Fetch-User',
      'Upgrade-Insecure-Requests'
    ],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * Desktop Chrome profile - standard desktop Chrome headers
   */
  'desktop-chrome': {
    name: 'desktop-chrome',
    description: 'Standard desktop Chrome browser headers',
    requestHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    },
    responseHeaders: {},
    removeRequestHeaders: [],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * Desktop Firefox profile - standard desktop Firefox headers
   */
  'desktop-firefox': {
    name: 'desktop-firefox',
    description: 'Standard desktop Firefox browser headers',
    requestHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Sec-GPC': '1',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform'
    ],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * Minimal profile - only essential headers
   */
  minimal: {
    name: 'minimal',
    description: 'Minimal headers for reduced fingerprinting',
    requestHeaders: {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      'Accept-Language',
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Site',
      'Sec-Fetch-User',
      'Upgrade-Insecure-Requests',
      'DNT',
      'Cookie',
      'Referer'
    ],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * CORS bypass profile - headers to help with CORS issues
   */
  'cors-bypass': {
    name: 'cors-bypass',
    description: 'Headers to help bypass CORS restrictions',
    requestHeaders: {
      'Origin': null, // Will be set dynamically
      'Access-Control-Request-Method': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Request-Headers': 'Content-Type, Authorization'
    },
    responseHeaders: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    },
    removeRequestHeaders: [],
    removeResponseHeaders: [
      'X-Frame-Options',
      'Content-Security-Policy'
    ],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  },

  /**
   * OSINT profile - optimized for OSINT research
   */
  osint: {
    name: 'osint',
    description: 'Headers optimized for OSINT research and data gathering',
    requestHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Cache-Control': 'max-age=0'
    },
    responseHeaders: {},
    removeRequestHeaders: [
      ...TRACKING_HEADERS,
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform'
    ],
    removeResponseHeaders: [],
    conditionalRequestHeaders: [],
    conditionalResponseHeaders: []
  }
};

/**
 * Storage for custom profiles
 */
class ProfileStorage {
  constructor() {
    this.customProfiles = new Map();
  }

  /**
   * Add a custom profile
   * @param {string} name - Profile name
   * @param {Object} profile - Profile configuration
   * @returns {Object} - Result of the operation
   */
  addCustomProfile(name, profile) {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Profile name is required' };
    }

    if (PREDEFINED_PROFILES[name]) {
      return { success: false, error: `Cannot override predefined profile: ${name}` };
    }

    const newProfile = {
      name: name,
      description: profile.description || `Custom profile: ${name}`,
      requestHeaders: profile.requestHeaders || {},
      responseHeaders: profile.responseHeaders || {},
      removeRequestHeaders: profile.removeRequestHeaders || [],
      removeResponseHeaders: profile.removeResponseHeaders || [],
      conditionalRequestHeaders: profile.conditionalRequestHeaders || [],
      conditionalResponseHeaders: profile.conditionalResponseHeaders || [],
      custom: true,
      createdAt: new Date().toISOString()
    };

    this.customProfiles.set(name, newProfile);
    return { success: true, profile: newProfile };
  }

  /**
   * Get a profile by name (checks custom first, then predefined)
   * @param {string} name - Profile name
   * @returns {Object|null} - Profile or null if not found
   */
  getProfile(name) {
    if (this.customProfiles.has(name)) {
      return this.customProfiles.get(name);
    }
    return PREDEFINED_PROFILES[name] || null;
  }

  /**
   * Remove a custom profile
   * @param {string} name - Profile name
   * @returns {Object} - Result of the operation
   */
  removeCustomProfile(name) {
    if (PREDEFINED_PROFILES[name]) {
      return { success: false, error: 'Cannot remove predefined profile' };
    }

    if (!this.customProfiles.has(name)) {
      return { success: false, error: 'Custom profile not found' };
    }

    this.customProfiles.delete(name);
    return { success: true };
  }

  /**
   * List all available profiles
   * @returns {Array} - List of profile summaries
   */
  listProfiles() {
    const profiles = [];

    // Add predefined profiles
    for (const [name, profile] of Object.entries(PREDEFINED_PROFILES)) {
      profiles.push({
        name: name,
        description: profile.description,
        predefined: true,
        requestHeaderCount: Object.keys(profile.requestHeaders || {}).length,
        responseHeaderCount: Object.keys(profile.responseHeaders || {}).length,
        removeHeaderCount: (profile.removeRequestHeaders || []).length +
                          (profile.removeResponseHeaders || []).length
      });
    }

    // Add custom profiles
    for (const [name, profile] of this.customProfiles) {
      profiles.push({
        name: name,
        description: profile.description,
        predefined: false,
        custom: true,
        requestHeaderCount: Object.keys(profile.requestHeaders || {}).length,
        responseHeaderCount: Object.keys(profile.responseHeaders || {}).length,
        removeHeaderCount: (profile.removeRequestHeaders || []).length +
                          (profile.removeResponseHeaders || []).length,
        createdAt: profile.createdAt
      });
    }

    return profiles;
  }

  /**
   * Get all custom profiles for export
   * @returns {Object} - Custom profiles object
   */
  exportCustomProfiles() {
    const profiles = {};
    for (const [name, profile] of this.customProfiles) {
      profiles[name] = profile;
    }
    return profiles;
  }

  /**
   * Import custom profiles
   * @param {Object} profiles - Profiles to import
   * @returns {Object} - Result of the operation
   */
  importCustomProfiles(profiles) {
    if (!profiles || typeof profiles !== 'object') {
      return { success: false, error: 'Profiles object is required' };
    }

    let imported = 0;
    let skipped = 0;

    for (const [name, profile] of Object.entries(profiles)) {
      if (PREDEFINED_PROFILES[name]) {
        skipped++;
        continue;
      }

      this.customProfiles.set(name, {
        ...profile,
        custom: true,
        importedAt: new Date().toISOString()
      });
      imported++;
    }

    return {
      success: true,
      imported: imported,
      skipped: skipped
    };
  }

  /**
   * Clear all custom profiles
   * @returns {Object} - Result of the operation
   */
  clearCustomProfiles() {
    const count = this.customProfiles.size;
    this.customProfiles.clear();
    return { success: true, cleared: count };
  }
}

// Create singleton instance
const profileStorage = new ProfileStorage();

/**
 * Get predefined profile names
 * @returns {Array} - List of predefined profile names
 */
function getPredefinedProfileNames() {
  return Object.keys(PREDEFINED_PROFILES);
}

/**
 * Get a predefined profile by name
 * @param {string} name - Profile name
 * @returns {Object|null} - Profile or null if not found
 */
function getPredefinedProfile(name) {
  return PREDEFINED_PROFILES[name] || null;
}

// Export everything
module.exports = {
  PREDEFINED_PROFILES,
  TRACKING_HEADERS,
  TRACKING_RESPONSE_HEADERS,
  ProfileStorage,
  profileStorage,
  getPredefinedProfileNames,
  getPredefinedProfile
};

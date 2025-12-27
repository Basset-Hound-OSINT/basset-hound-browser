/**
 * Basset Hound Browser - User Agent Manager
 * Provides comprehensive user agent management with rotation support
 */

/**
 * User agent categories
 */
const UA_CATEGORIES = {
  CHROME_WINDOWS: 'chrome_windows',
  CHROME_MAC: 'chrome_mac',
  CHROME_LINUX: 'chrome_linux',
  FIREFOX_WINDOWS: 'firefox_windows',
  FIREFOX_MAC: 'firefox_mac',
  FIREFOX_LINUX: 'firefox_linux',
  SAFARI_MAC: 'safari_mac',
  EDGE_WINDOWS: 'edge_windows',
  MOBILE_ANDROID: 'mobile_android',
  MOBILE_IOS: 'mobile_ios'
};

/**
 * Comprehensive list of realistic user agents
 * Updated for 2024-2025 browser versions
 */
const USER_AGENTS = {
  // Chrome on Windows
  [UA_CATEGORIES.CHROME_WINDOWS]: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  ],

  // Chrome on macOS
  [UA_CATEGORIES.CHROME_MAC]: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  ],

  // Chrome on Linux
  [UA_CATEGORIES.CHROME_LINUX]: [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],

  // Firefox on Windows
  [UA_CATEGORIES.FIREFOX_WINDOWS]: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
  ],

  // Firefox on macOS
  [UA_CATEGORIES.FIREFOX_MAC]: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13.0; rv:121.0) Gecko/20100101 Firefox/121.0',
  ],

  // Firefox on Linux
  [UA_CATEGORIES.FIREFOX_LINUX]: [
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:122.0) Gecko/20100101 Firefox/122.0',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0',
  ],

  // Safari on macOS
  [UA_CATEGORIES.SAFARI_MAC]: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15',
  ],

  // Edge on Windows
  [UA_CATEGORIES.EDGE_WINDOWS]: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
  ],

  // Mobile - Android
  [UA_CATEGORIES.MOBILE_ANDROID]: [
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; OnePlus 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],

  // Mobile - iOS
  [UA_CATEGORIES.MOBILE_IOS]: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1',
  ],
};

/**
 * Get all user agents as a flat array
 * @returns {Array} - All user agents
 */
function getAllUserAgents() {
  const all = [];
  for (const category of Object.values(USER_AGENTS)) {
    all.push(...category);
  }
  return all;
}

/**
 * User Agent Manager class
 * Manages user agent selection and rotation
 */
class UserAgentManager {
  constructor() {
    this.currentUserAgent = null;
    this.userAgentList = [];
    this.rotationIndex = 0;
    this.rotationInterval = null;
    this.rotationMode = 'sequential'; // 'sequential' or 'random'
    this.requestCount = 0;
    this.rotateAfterRequests = 0; // 0 = disabled
    this.enabledCategories = Object.values(UA_CATEGORIES);
    this.customUserAgents = [];
  }

  /**
   * Get user agents from enabled categories
   * @returns {Array} - User agents from enabled categories
   */
  getEnabledUserAgents() {
    const userAgents = [];

    for (const category of this.enabledCategories) {
      if (USER_AGENTS[category]) {
        userAgents.push(...USER_AGENTS[category]);
      }
    }

    // Add custom user agents
    userAgents.push(...this.customUserAgents);

    return userAgents;
  }

  /**
   * Set which categories to use for user agent selection
   * @param {Array} categories - Array of category names
   * @returns {Object} - Result of the operation
   */
  setEnabledCategories(categories) {
    if (!Array.isArray(categories)) {
      return { success: false, error: 'Categories must be an array' };
    }

    const validCategories = categories.filter(c => UA_CATEGORIES[c.toUpperCase()] || Object.values(UA_CATEGORIES).includes(c));

    if (validCategories.length === 0) {
      return {
        success: false,
        error: 'No valid categories provided',
        availableCategories: Object.keys(UA_CATEGORIES)
      };
    }

    this.enabledCategories = validCategories.map(c =>
      UA_CATEGORIES[c.toUpperCase()] || c
    );

    // Reset user agent list
    this.userAgentList = this.getEnabledUserAgents();
    this.rotationIndex = 0;

    console.log(`[UserAgentManager] Enabled categories: ${this.enabledCategories.join(', ')}`);

    return {
      success: true,
      enabledCategories: this.enabledCategories,
      userAgentCount: this.userAgentList.length
    };
  }

  /**
   * Add a custom user agent
   * @param {string} userAgent - User agent string
   * @returns {Object} - Result of the operation
   */
  addCustomUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
      return { success: false, error: 'User agent must be a non-empty string' };
    }

    this.customUserAgents.push(userAgent);
    this.userAgentList = this.getEnabledUserAgents();

    console.log(`[UserAgentManager] Custom user agent added`);

    return {
      success: true,
      customCount: this.customUserAgents.length,
      totalCount: this.userAgentList.length
    };
  }

  /**
   * Clear custom user agents
   * @returns {Object} - Result of the operation
   */
  clearCustomUserAgents() {
    const count = this.customUserAgents.length;
    this.customUserAgents = [];
    this.userAgentList = this.getEnabledUserAgents();

    return {
      success: true,
      clearedCount: count
    };
  }

  /**
   * Set a specific user agent
   * @param {string} userAgent - User agent string
   * @param {BrowserWindow} mainWindow - Main browser window
   * @returns {Object} - Result of the operation
   */
  setUserAgent(userAgent, mainWindow) {
    if (!userAgent || typeof userAgent !== 'string') {
      return { success: false, error: 'User agent must be a non-empty string' };
    }

    this.currentUserAgent = userAgent;

    // Apply to window if provided
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.setUserAgent(userAgent);
    }

    console.log(`[UserAgentManager] User agent set: ${userAgent.substring(0, 50)}...`);

    return {
      success: true,
      userAgent: this.currentUserAgent
    };
  }

  /**
   * Get a random user agent from enabled categories
   * @returns {string} - Random user agent
   */
  getRandomUserAgent() {
    const userAgents = this.getEnabledUserAgents();
    if (userAgents.length === 0) {
      return getAllUserAgents()[0]; // Fallback
    }
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Get user agent by category
   * @param {string} category - Category name
   * @returns {string} - User agent from the category
   */
  getUserAgentByCategory(category) {
    const normalizedCategory = UA_CATEGORIES[category.toUpperCase()] || category;
    const categoryAgents = USER_AGENTS[normalizedCategory];

    if (!categoryAgents || categoryAgents.length === 0) {
      return null;
    }

    return categoryAgents[Math.floor(Math.random() * categoryAgents.length)];
  }

  /**
   * Rotate to the next user agent
   * @param {BrowserWindow} mainWindow - Main browser window
   * @returns {Object} - Result of the operation
   */
  rotateUserAgent(mainWindow) {
    const userAgents = this.getEnabledUserAgents();

    if (userAgents.length === 0) {
      return { success: false, error: 'No user agents available' };
    }

    let nextIndex;
    if (this.rotationMode === 'random') {
      nextIndex = Math.floor(Math.random() * userAgents.length);
    } else {
      nextIndex = (this.rotationIndex + 1) % userAgents.length;
    }

    this.rotationIndex = nextIndex;
    const nextUserAgent = userAgents[nextIndex];

    const result = this.setUserAgent(nextUserAgent, mainWindow);
    if (result.success) {
      this.requestCount = 0;
      console.log(`[UserAgentManager] Rotated to user agent ${nextIndex + 1}/${userAgents.length}`);
    }

    return {
      ...result,
      rotationIndex: nextIndex,
      totalUserAgents: userAgents.length
    };
  }

  /**
   * Start automatic user agent rotation
   * @param {BrowserWindow} mainWindow - Main browser window
   * @param {Object} options - Rotation options
   * @returns {Object} - Result of the operation
   */
  startRotation(mainWindow, options = {}) {
    const {
      intervalMs = 300000, // 5 minutes default
      mode = 'sequential', // 'sequential' or 'random'
      rotateAfterRequests = 0 // Rotate after N requests (0 = disabled)
    } = options;

    const userAgents = this.getEnabledUserAgents();

    if (userAgents.length < 2) {
      return { success: false, error: 'Need at least 2 user agents for rotation' };
    }

    // Stop existing rotation if any
    this.stopRotation();

    this.userAgentList = userAgents;
    this.rotationMode = mode;
    this.rotateAfterRequests = rotateAfterRequests;

    // Set up interval-based rotation
    if (intervalMs > 0) {
      this.rotationInterval = setInterval(() => {
        this.rotateUserAgent(mainWindow);
      }, intervalMs);
    }

    console.log(`[UserAgentManager] Rotation started: mode=${mode}, interval=${intervalMs}ms`);

    return {
      success: true,
      mode,
      intervalMs,
      rotateAfterRequests,
      userAgentCount: userAgents.length
    };
  }

  /**
   * Stop automatic user agent rotation
   * @returns {Object} - Result of the operation
   */
  stopRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
      console.log('[UserAgentManager] Rotation stopped');
      return { success: true, message: 'Rotation stopped' };
    }
    return { success: true, message: 'Rotation was not active' };
  }

  /**
   * Get current status
   * @returns {Object} - Current status
   */
  getStatus() {
    return {
      currentUserAgent: this.currentUserAgent,
      enabledCategories: this.enabledCategories,
      userAgentCount: this.getEnabledUserAgents().length,
      customUserAgentCount: this.customUserAgents.length,
      rotation: {
        enabled: this.rotationInterval !== null,
        mode: this.rotationMode,
        rotateAfterRequests: this.rotateAfterRequests,
        requestCount: this.requestCount,
        currentIndex: this.rotationIndex
      }
    };
  }

  /**
   * Increment request count and check for rotation
   * @param {BrowserWindow} mainWindow - Main browser window
   * @returns {boolean} - Whether rotation occurred
   */
  onRequest(mainWindow) {
    this.requestCount++;

    // Check if we should rotate based on request count
    if (this.rotateAfterRequests > 0 && this.requestCount >= this.rotateAfterRequests) {
      this.rotateUserAgent(mainWindow);
      return true;
    }

    return false;
  }

  /**
   * Get all available categories
   * @returns {Object} - Available categories with counts
   */
  getAvailableCategories() {
    const categories = {};
    for (const [key, value] of Object.entries(UA_CATEGORIES)) {
      categories[key] = {
        id: value,
        count: USER_AGENTS[value] ? USER_AGENTS[value].length : 0
      };
    }
    return categories;
  }

  /**
   * Parse user agent string to extract browser info
   * @param {string} userAgent - User agent string
   * @returns {Object} - Parsed browser info
   */
  parseUserAgent(userAgent) {
    const info = {
      browser: 'Unknown',
      browserVersion: null,
      os: 'Unknown',
      osVersion: null,
      isMobile: false
    };

    if (!userAgent) return info;

    // Detect browser
    if (userAgent.includes('Edg/')) {
      info.browser = 'Edge';
      const match = userAgent.match(/Edg\/(\d+\.\d+\.\d+\.\d+)/);
      if (match) info.browserVersion = match[1];
    } else if (userAgent.includes('Chrome/')) {
      info.browser = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
      if (match) info.browserVersion = match[1];
    } else if (userAgent.includes('Firefox/')) {
      info.browser = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
      if (match) info.browserVersion = match[1];
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
      info.browser = 'Safari';
      const match = userAgent.match(/Version\/(\d+\.\d+)/);
      if (match) info.browserVersion = match[1];
    }

    // Detect OS
    if (userAgent.includes('Windows NT 11')) {
      info.os = 'Windows';
      info.osVersion = '11';
    } else if (userAgent.includes('Windows NT 10')) {
      info.os = 'Windows';
      info.osVersion = '10';
    } else if (userAgent.includes('Mac OS X')) {
      info.os = 'macOS';
      const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
      if (match) info.osVersion = match[1].replace('_', '.');
    } else if (userAgent.includes('Linux')) {
      info.os = 'Linux';
    } else if (userAgent.includes('Android')) {
      info.os = 'Android';
      const match = userAgent.match(/Android (\d+)/);
      if (match) info.osVersion = match[1];
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      info.os = 'iOS';
      const match = userAgent.match(/OS (\d+_\d+)/);
      if (match) info.osVersion = match[1].replace('_', '.');
    }

    // Detect mobile
    info.isMobile = userAgent.includes('Mobile') || userAgent.includes('Android') ||
                    userAgent.includes('iPhone') || userAgent.includes('iPad');

    return info;
  }
}

// Export singleton instance and class
const userAgentManager = new UserAgentManager();

module.exports = {
  userAgentManager,
  UserAgentManager,
  USER_AGENTS,
  UA_CATEGORIES,
  getAllUserAgents
};

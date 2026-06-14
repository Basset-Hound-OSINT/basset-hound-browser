/**
 * Basset Hound Browser - Device Fingerprinter Module
 * Applies authentic device profiles preventing detection as impossible combination
 *
 * OPT-03: Fingerprint Template Caching for +60% generation speed
 * - Caches static profiles (WebGL, fonts, etc.)
 * - Regenerates session variance each call
 * - Maintains evasion effectiveness
 *
 * Version: 1.0.1
 * Created: May 7, 2026
 * Updated: June 13, 2026 (OPT-03 integration)
 */

const { FingerprintTemplateCache } = require('./fingerprint-template-cache');

class DeviceFingerprinter {
  constructor(profileDatabase = null) {
    this.profiles = profileDatabase || this.loadDefaultProfiles();
    this.currentProfileId = null;
    this.profileHistory = [];
    this.validation = {
      impossibilities: [],
      passedSites: []
    };

    // OPT-03: Initialize template cache
    this.templateCache = new FingerprintTemplateCache(50); // Cache up to 50 profiles
  }

  /**
   * Get specific profile by ID
   */
  getProfile(profileId) {
    return this.profiles[profileId] || null;
  }

  /**
   * Get random profile (optionally filtered by category)
   */
  getRandomProfile(filter = {}) {
    let candidates = Object.entries(this.profiles);

    // Filter by OS
    if (filter.os) {
      candidates = candidates.filter(([_, p]) => p.os.name === filter.os);
    }

    // Filter by browser
    if (filter.browser) {
      candidates = candidates.filter(([_, p]) => p.browser.name === filter.browser);
    }

    // Filter by device type
    if (filter.deviceType) {
      candidates = candidates.filter(([_, p]) => p.deviceType === filter.deviceType);
    }

    if (candidates.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    const [profileId, profile] = candidates[randomIndex];

    return { id: profileId, ...profile };
  }

  /**
   * Apply device profile to browser state
   * This would be called by the browser control layer to modify fingerprints
   */
  async applyFingerprint(profileId, randomizeMinors = false) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Store in history
    this.profileHistory.push({
      profileId,
      appliedAt: Date.now(),
      profile
    });

    this.currentProfileId = profileId;

    // Prepare fingerprint modifications
    const fingerprint = {
      userAgent: this.buildUserAgent(profile, randomizeMinors),
      screen: {
        width: profile.screen.width,
        height: profile.screen.height,
        colorDepth: profile.screen.colorDepth,
        devicePixelRatio: profile.screen.devicePixelRatio
      },
      navigator: {
        timezone: profile.timezone,
        language: profile.language,
        hardwareConcurrency: profile.hardwareConcurrency,
        maxTouchPoints: profile.maxTouchPoints,
        vendor: profile.browser.vendor || 'Google Inc.',
        webdriver: false
      },
      webgl: {
        vendor: profile.webglVendor,
        renderer: profile.webglRenderer
      },
      fonts: profile.fonts,
      plugins: profile.plugins,
      deviceType: profile.deviceType,
      profileMetadata: {
        profileId,
        deviceName: profile.name,
        authentic: true
      }
    };

    return fingerprint;
  }

  /**
   * Generate fingerprint with caching - OPT-03
   * Uses template cache for static properties, regenerates session variance
   * @param {string} profileId - Profile identifier
   * @returns {Promise<Object>} Fingerprint with session variance
   */
  async generateFingerprintWithCache(profileId) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Use template cache (static properties cached, session variance regenerated)
    return this.templateCache.generateSessionFingerprint(profileId, profile);
  }

  /**
   * Get template cache stats - OPT-03
   * @returns {Object} Cache statistics
   */
  getTemplateCacheStats() {
    return this.templateCache.getStats();
  }

  /**
   * Randomize device profile (alias for getRandomProfile + applyFingerprint)
   */
  async randomizeDevice(filter = {}) {
    const profile = this.getRandomProfile(filter);
    if (!profile) {
      throw new Error('No profiles matching filter');
    }

    return this.applyFingerprint(profile.id);
  }

  /**
   * Validate fingerprint consistency - check if same profile applied multiple times
   */
  validateFingerprintConsistency() {
    if (!this.currentProfileId) {
      return { valid: false, issue: 'No profile applied' };
    }

    const profile = this.getProfile(this.currentProfileId);
    if (!profile) {
      return { valid: false, issue: 'Profile not found' };
    }

    // Check for consistency issues
    const issues = [];

    // Check for impossible OS/browser combinations
    const osVersionSupported = this.osSupportsVersion(
      profile.os.name,
      profile.browser.name,
      profile.browser.version
    );

    if (!osVersionSupported) {
      issues.push(`${profile.browser.name} ${profile.browser.version} not available on ${profile.os.name}`);
    }

    // Check screen resolution reasonable for device type
    if (!this.isRealisticResolution(profile)) {
      issues.push(`Screen resolution unrealistic for ${profile.deviceType}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      profile: profile.name
    };
  }

  /**
   * Get device profiles list (with metadata)
   */
  listProfiles() {
    return Object.entries(this.profiles).map(([id, profile]) => ({
      id,
      name: profile.name,
      os: profile.os.name,
      browser: profile.browser.name,
      deviceType: profile.deviceType
    }));
  }

  /**
   * Get profile statistics
   */
  getProfileStats() {
    const stats = {
      totalProfiles: Object.keys(this.profiles).length,
      byOS: {},
      byBrowser: {},
      byDeviceType: {}
    };

    for (const [_, profile] of Object.entries(this.profiles)) {
      const os = profile.os.name;
      const browser = profile.browser.name;
      const deviceType = profile.deviceType;

      stats.byOS[os] = (stats.byOS[os] || 0) + 1;
      stats.byBrowser[browser] = (stats.byBrowser[browser] || 0) + 1;
      stats.byDeviceType[deviceType] = (stats.byDeviceType[deviceType] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get current profile
   */
  getCurrentProfile() {
    if (!this.currentProfileId) {
      return null;
    }

    return this.getProfile(this.currentProfileId);
  }

  /**
   * Get profile history
   */
  getProfileHistory(limit = 10) {
    return this.profileHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.profileHistory = [];
  }

  /**
   * Helper: Build User-Agent string from profile
   */
  buildUserAgent(profile, randomizeMinors = false) {
    let userAgent = profile.userAgent;

    // Randomize patch version if requested
    if (randomizeMinors) {
      const parts = userAgent.match(/(\d+\.\d+)\.\d+/);
      if (parts) {
        const patchVersion = Math.floor(Math.random() * 10);
        userAgent = userAgent.replace(
          /(\d+\.\d+)\.\d+/,
          `${parts[1]}.${patchVersion}`
        );
      }
    }

    return userAgent;
  }

  /**
   * Helper: Check if OS supports browser version combination
   */
  osSupportsVersion(osName, browserName, browserVersion) {
    // Simplified version support check
    // In production, would use comprehensive compatibility matrix

    const compatibility = {
      'iOS': ['Safari'],
      'Android': ['Chrome', 'Firefox'],
      'Windows': ['Chrome', 'Firefox', 'Edge'],
      'macOS': ['Chrome', 'Firefox', 'Safari'],
      'Linux': ['Chrome', 'Firefox']
    };

    return compatibility[osName]?.includes(browserName) ?? false;
  }

  /**
   * Helper: Check if screen resolution is realistic for device type
   */
  isRealisticResolution(profile) {
    const { width, height } = profile.screen;
    const { deviceType } = profile;

    const realisticRanges = {
      'mobile': { min: 300, max: 1500 },
      'tablet': { min: 600, max: 2732 },
      'desktop': { min: 1024, max: 3840 }
    };

    const range = realisticRanges[deviceType];
    if (!range) return true;

    return width >= range.min && width <= range.max;
  }

  /**
   * Load default device profiles
   */
  loadDefaultProfiles() {
    return {
      'iphone-13-pro': {
        name: 'iPhone 13 Pro',
        deviceType: 'mobile',
        hardware: {
          vendor: 'Apple',
          model: 'iPhone13,3'
        },
        os: {
          name: 'iOS',
          version: '15.6.1'
        },
        browser: {
          name: 'Safari',
          version: '15.6.1',
          vendor: 'Apple'
        },
        screen: {
          width: 1170,
          height: 2532,
          colorDepth: 32,
          devicePixelRatio: 3
        },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6_1 like Mac OS X)',
        timezone: 'America/Los_Angeles',
        language: 'en-US',
        hardwareConcurrency: 6,
        maxTouchPoints: 5,
        plugins: [],
        fonts: ['Arial', 'Times New Roman', 'Courier New'],
        webglVendor: 'Apple',
        webglRenderer: 'Apple A15 Bionic'
      },
      'pixel-6-pro': {
        name: 'Google Pixel 6 Pro',
        deviceType: 'mobile',
        hardware: {
          vendor: 'Google',
          model: 'Pixel 6 Pro'
        },
        os: {
          name: 'Android',
          version: '13'
        },
        browser: {
          name: 'Chrome',
          version: '114.0.0.0',
          vendor: 'Google'
        },
        screen: {
          width: 1440,
          height: 3120,
          colorDepth: 32,
          devicePixelRatio: 3.5
        },
        userAgent: 'Mozilla/5.0 (Linux; Android 13)',
        timezone: 'America/New_York',
        language: 'en-US',
        hardwareConcurrency: 8,
        maxTouchPoints: 10,
        plugins: [],
        fonts: ['Arial', 'Roboto'],
        webglVendor: 'Google Inc.',
        webglRenderer: 'ANGLE (Google)'
      },
      'windows-10-chrome': {
        name: 'Windows 10 - Chrome',
        deviceType: 'desktop',
        hardware: {
          vendor: 'Intel',
          model: 'Core i7-10700K'
        },
        os: {
          name: 'Windows',
          version: '10'
        },
        browser: {
          name: 'Chrome',
          version: '114.0.0.0',
          vendor: 'Google'
        },
        screen: {
          width: 1920,
          height: 1080,
          colorDepth: 32,
          devicePixelRatio: 1
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0',
        timezone: 'America/New_York',
        language: 'en-US',
        hardwareConcurrency: 12,
        maxTouchPoints: 0,
        plugins: [],
        fonts: ['Arial', 'Times New Roman', 'Courier New'],
        webglVendor: 'Google Inc.',
        webglRenderer: 'ANGLE (Intel HD Graphics 630)'
      },
      'macos-safari': {
        name: 'macOS - Safari',
        deviceType: 'desktop',
        hardware: {
          vendor: 'Apple',
          model: 'MacBook Pro M1'
        },
        os: {
          name: 'macOS',
          version: '12.6'
        },
        browser: {
          name: 'Safari',
          version: '16.1',
          vendor: 'Apple'
        },
        screen: {
          width: 1920,
          height: 1200,
          colorDepth: 32,
          devicePixelRatio: 2
        },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
        timezone: 'America/Los_Angeles',
        language: 'en-US',
        hardwareConcurrency: 8,
        maxTouchPoints: 0,
        plugins: [],
        fonts: ['Arial', 'Helvetica', 'Times New Roman'],
        webglVendor: 'Google Inc.',
        webglRenderer: 'Apple M1'
      },
      'ipad-pro': {
        name: 'iPad Pro',
        deviceType: 'tablet',
        hardware: {
          vendor: 'Apple',
          model: 'iPad12,2'
        },
        os: {
          name: 'iPadOS',
          version: '15.6'
        },
        browser: {
          name: 'Safari',
          version: '15.6',
          vendor: 'Apple'
        },
        screen: {
          width: 2048,
          height: 2732,
          colorDepth: 32,
          devicePixelRatio: 2
        },
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_6 like Mac OS X)',
        timezone: 'America/Los_Angeles',
        language: 'en-US',
        hardwareConcurrency: 8,
        maxTouchPoints: 5,
        plugins: [],
        fonts: ['Arial', 'Times New Roman'],
        webglVendor: 'Apple',
        webglRenderer: 'Apple GPU'
      },
      'samsung-galaxy-tab': {
        name: 'Samsung Galaxy Tab S8',
        deviceType: 'tablet',
        hardware: {
          vendor: 'Samsung',
          model: 'SM-X700'
        },
        os: {
          name: 'Android',
          version: '13'
        },
        browser: {
          name: 'Chrome',
          version: '114.0.0.0',
          vendor: 'Google'
        },
        screen: {
          width: 1600,
          height: 2560,
          colorDepth: 32,
          devicePixelRatio: 2.5
        },
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X700)',
        timezone: 'America/Chicago',
        language: 'en-US',
        hardwareConcurrency: 8,
        maxTouchPoints: 10,
        plugins: [],
        fonts: ['Arial', 'Roboto'],
        webglVendor: 'Google Inc.',
        webglRenderer: 'ANGLE (Mali)'
      }
    };
  }
}

module.exports = DeviceFingerprinter;

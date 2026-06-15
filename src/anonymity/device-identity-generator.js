/**
 * Basset Hound Browser - Device Identity Generator Module
 *
 * Generates realistic device profiles for hardware spoofing
 * Includes pre-built profiles and custom profile creation
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Device Identity Generator
 * Provides pre-built device profiles and custom profile creation
 */
class DeviceIdentityGenerator {
  constructor(options = {}) {
    this.options = options;

    // Pre-built device profiles
    this.profiles = new Map();
    this.initializeBuiltinProfiles();

    // Custom profiles storage
    this.customProfiles = new Map();

    // Profile history for validation
    this.profileHistory = [];
  }

  /**
   * Initialize built-in device profiles
   */
  initializeBuiltinProfiles() {
    // iPhone 15 Pro
    this.addProfile('iPhone 15 Pro', {
      name: 'iPhone 15 Pro',
      deviceType: 'mobile',
      hardwareConcurrency: 6,
      deviceMemory: 6,
      screenWidth: 460,
      screenHeight: 1000,
      availWidth: 460,
      availHeight: 980,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 5,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/New_York'
    });

    // iPhone 15
    this.addProfile('iPhone 15', {
      name: 'iPhone 15',
      deviceType: 'mobile',
      hardwareConcurrency: 6,
      deviceMemory: 6,
      screenWidth: 390,
      screenHeight: 844,
      availWidth: 390,
      availHeight: 824,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 5,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/New_York'
    });

    // Samsung Galaxy S24
    this.addProfile('Samsung Galaxy S24', {
      name: 'Samsung Galaxy S24',
      deviceType: 'mobile',
      hardwareConcurrency: 8,
      deviceMemory: 12,
      screenWidth: 412,
      screenHeight: 915,
      availWidth: 412,
      availHeight: 895,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.75,
      maxTouchPoints: 5,
      vendor: 'Google Inc.',
      language: 'en-US',
      timezone: 'America/Chicago'
    });

    // Samsung Galaxy Tab S9
    this.addProfile('Samsung Galaxy Tab S9', {
      name: 'Samsung Galaxy Tab S9',
      deviceType: 'tablet',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      screenWidth: 800,
      screenHeight: 1280,
      availWidth: 800,
      availHeight: 1260,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 1.0,
      maxTouchPoints: 5,
      vendor: 'Google Inc.',
      language: 'en-US',
      timezone: 'America/Denver'
    });

    // MacBook Pro 16"
    this.addProfile('MacBook Pro 16"', {
      name: 'MacBook Pro 16"',
      deviceType: 'desktop',
      hardwareConcurrency: 12,
      deviceMemory: 16,
      screenWidth: 3456,
      screenHeight: 2234,
      availWidth: 3456,
      availHeight: 2134,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 0,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/Los_Angeles'
    });

    // MacBook Air M2
    this.addProfile('MacBook Air M2', {
      name: 'MacBook Air M2',
      deviceType: 'desktop',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      screenWidth: 2560,
      screenHeight: 1600,
      availWidth: 2560,
      availHeight: 1500,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 0,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/Los_Angeles'
    });

    // Windows Desktop (High-end)
    this.addProfile('Windows Desktop (High-end)', {
      name: 'Windows Desktop (High-end)',
      deviceType: 'desktop',
      hardwareConcurrency: 16,
      deviceMemory: 32,
      screenWidth: 1920,
      screenHeight: 1080,
      availWidth: 1920,
      availHeight: 1000,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 1.0,
      maxTouchPoints: 0,
      vendor: 'Google Inc.',
      language: 'en-US',
      timezone: 'America/New_York'
    });

    // Windows Laptop
    this.addProfile('Windows Laptop', {
      name: 'Windows Laptop',
      deviceType: 'desktop',
      hardwareConcurrency: 8,
      deviceMemory: 16,
      screenWidth: 1366,
      screenHeight: 768,
      availWidth: 1366,
      availHeight: 688,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 1.0,
      maxTouchPoints: 0,
      vendor: 'Google Inc.',
      language: 'en-US',
      timezone: 'America/Chicago'
    });

    // iPad Air
    this.addProfile('iPad Air', {
      name: 'iPad Air',
      deviceType: 'tablet',
      hardwareConcurrency: 6,
      deviceMemory: 8,
      screenWidth: 820,
      screenHeight: 1180,
      availWidth: 820,
      availHeight: 1160,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 5,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/New_York'
    });

    // Google Pixel 8 Pro
    this.addProfile('Google Pixel 8 Pro', {
      name: 'Google Pixel 8 Pro',
      deviceType: 'mobile',
      hardwareConcurrency: 8,
      deviceMemory: 12,
      screenWidth: 412,
      screenHeight: 915,
      availWidth: 412,
      availHeight: 895,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.75,
      maxTouchPoints: 5,
      vendor: 'Google Inc.',
      language: 'en-US',
      timezone: 'America/Los_Angeles'
    });

    // iPad Pro 12.9"
    this.addProfile('iPad Pro 12.9"', {
      name: 'iPad Pro 12.9"',
      deviceType: 'tablet',
      hardwareConcurrency: 10,
      deviceMemory: 16,
      screenWidth: 1024,
      screenHeight: 1366,
      availWidth: 1024,
      availHeight: 1346,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 2.0,
      maxTouchPoints: 5,
      vendor: 'Apple Computer, Inc.',
      language: 'en-US',
      timezone: 'America/Denver'
    });

    // Linux Desktop
    this.addProfile('Linux Desktop', {
      name: 'Linux Desktop',
      deviceType: 'desktop',
      hardwareConcurrency: 12,
      deviceMemory: 16,
      screenWidth: 1920,
      screenHeight: 1080,
      availWidth: 1920,
      availHeight: 1000,
      colorDepth: 32,
      pixelDepth: 32,
      devicePixelRatio: 1.0,
      maxTouchPoints: 0,
      vendor: 'Mozilla',
      language: 'en-US',
      timezone: 'UTC'
    });
  }

  /**
   * Add a profile to the registry
   * @param {string} name - Profile name
   * @param {Object} config - Profile configuration
   * @throws {Error} If profile is invalid
   */
  addProfile(name, config) {
    if (!this.validateProfile(config)) {
      throw new Error(`Invalid profile configuration for ${name}`);
    }
    this.profiles.set(name, { ...config });
  }

  /**
   * Validate profile structure
   * @param {Object} profile - Profile to validate
   * @returns {boolean} True if valid
   */
  validateProfile(profile) {
    const requiredFields = [
      'name',
      'deviceType',
      'hardwareConcurrency',
      'deviceMemory',
      'screenWidth',
      'screenHeight',
      'colorDepth',
      'pixelDepth',
      'devicePixelRatio',
      'maxTouchPoints',
      'vendor',
      'language',
      'timezone'
    ];

    for (const field of requiredFields) {
      if (!(field in profile)) {
        return false;
      }
    }

    // Validate field types and ranges
    if (typeof profile.hardwareConcurrency !== 'number' || profile.hardwareConcurrency < 2 || profile.hardwareConcurrency > 32) {
      return false;
    }

    if (typeof profile.deviceMemory !== 'number' || profile.deviceMemory < 2 || profile.deviceMemory > 64) {
      return false;
    }

    if (typeof profile.screenWidth !== 'number' || profile.screenWidth < 320 || profile.screenWidth > 5120) {
      return false;
    }

    if (typeof profile.screenHeight !== 'number' || profile.screenHeight < 568 || profile.screenHeight > 3200) {
      return false;
    }

    if (![24, 32].includes(profile.colorDepth)) {
      return false;
    }

    if (![0.75, 1.0, 1.5, 2.0, 2.5, 2.75, 3.0].includes(profile.devicePixelRatio)) {
      return false;
    }

    if (typeof profile.maxTouchPoints !== 'number' || profile.maxTouchPoints < 0 || profile.maxTouchPoints > 10) {
      return false;
    }

    if (typeof profile.vendor !== 'string' || profile.vendor.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Get a profile by name
   * @param {string} name - Profile name
   * @returns {Object} Profile configuration
   * @throws {Error} If profile not found
   */
  getProfile(name) {
    if (this.profiles.has(name)) {
      return { ...this.profiles.get(name) };
    }

    if (this.customProfiles.has(name)) {
      return { ...this.customProfiles.get(name) };
    }

    throw new Error(`Profile not found: ${name}`);
  }

  /**
   * List all available profile names
   * @returns {string[]} Array of profile names
   */
  listProfiles() {
    const builtins = Array.from(this.profiles.keys());
    const customs = Array.from(this.customProfiles.keys());
    return [...builtins, ...customs];
  }

  /**
   * Create a custom profile
   * @param {string} name - Profile name
   * @param {Object} config - Profile configuration
   * @throws {Error} If profile name already exists or config invalid
   */
  createCustomProfile(name, config) {
    if (this.profiles.has(name) || this.customProfiles.has(name)) {
      throw new Error(`Profile already exists: ${name}`);
    }

    if (!this.validateProfile(config)) {
      throw new Error(`Invalid profile configuration for ${name}`);
    }

    this.customProfiles.set(name, { ...config });
    this.profileHistory.push({
      action: 'created',
      name,
      timestamp: Date.now()
    });
  }

  /**
   * Delete a custom profile
   * @param {string} name - Profile name
   * @throws {Error} If profile not found or is built-in
   */
  deleteCustomProfile(name) {
    if (this.profiles.has(name)) {
      throw new Error(`Cannot delete built-in profile: ${name}`);
    }

    if (!this.customProfiles.has(name)) {
      throw new Error(`Custom profile not found: ${name}`);
    }

    this.customProfiles.delete(name);
    this.profileHistory.push({
      action: 'deleted',
      name,
      timestamp: Date.now()
    });
  }

  /**
   * Get random profile
   * @param {string} deviceType - Filter by device type (optional)
   * @returns {Object} Random profile
   */
  getRandomProfile(deviceType = null) {
    let availableProfiles = Array.from(this.profiles.values());

    if (deviceType) {
      availableProfiles = availableProfiles.filter(p => p.deviceType === deviceType);
    }

    if (availableProfiles.length === 0) {
      throw new Error(`No profiles found for device type: ${deviceType}`);
    }

    const randomProfile = availableProfiles[Math.floor(Math.random() * availableProfiles.length)];
    return { ...randomProfile };
  }

  /**
   * Export a profile as JSON
   * @param {string} name - Profile name
   * @returns {string} JSON string
   * @throws {Error} If profile not found
   */
  exportProfile(name) {
    const profile = this.getProfile(name);
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Import a profile from JSON
   * @param {string} name - Name for imported profile
   * @param {string} json - JSON string
   * @throws {Error} If JSON invalid or profile invalid
   */
  importProfile(name, json) {
    try {
      const config = JSON.parse(json);
      this.createCustomProfile(name, config);
    } catch (error) {
      throw new Error(`Failed to import profile: ${error.message}`);
    }
  }

  /**
   * Get profile statistics
   * @returns {Object} Statistics about profiles
   */
  getStatistics() {
    const profileArray = Array.from(this.profiles.values());
    const deviceTypes = {};
    const vendors = {};

    profileArray.forEach(profile => {
      deviceTypes[profile.deviceType] = (deviceTypes[profile.deviceType] || 0) + 1;
      vendors[profile.vendor] = (vendors[profile.vendor] || 0) + 1;
    });

    return {
      total: this.profiles.size + this.customProfiles.size,
      builtIn: this.profiles.size,
      custom: this.customProfiles.size,
      byDeviceType: deviceTypes,
      byVendor: vendors,
      history: this.profileHistory.length
    };
  }

  /**
   * Reset to default state (clear custom profiles)
   */
  reset() {
    this.customProfiles.clear();
    this.profileHistory = [];
  }
}

module.exports = DeviceIdentityGenerator;

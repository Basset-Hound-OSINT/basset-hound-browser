/**
 * FingerprintProfile
 *
 * Generates and manages internally consistent browser fingerprints where all
 * elements (UA, platform, WebGL, screen, timezone) match each other realistically.
 */

const crypto = require('crypto');

const {
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
  COMMON_DECOY_FONTS
} = require('./configs');

const { buildInjectionScript } = require('./injection-script');

/**
 * FingerprintProfile class
 *
 * Generates and manages internally consistent browser fingerprints
 */
class FingerprintProfile {
  /**
   * Create a new fingerprint profile
   *
   * @param {Object} options - Profile options
   * @param {string} options.seed - Optional seed for reproducible profiles
   * @param {string} options.platform - Platform ('windows', 'macos', 'linux')
   * @param {string} options.timezone - IANA timezone name
   * @param {string} options.tier - Hardware tier ('low', 'medium', 'high', 'workstation')
   * @param {string} options.canvasNoiseLevel - Canvas noise level ('disabled', 'subtle', 'moderate', 'aggressive')
   * @param {string} options.webglNoiseLevel - WebGL noise level ('disabled', 'subtle', 'moderate', 'aggressive')
   * @param {string} options.audioNoiseLevel - Audio noise level ('disabled', 'subtle', 'moderate', 'aggressive')
   * @param {string} options.fontEvasionLevel - Font evasion level ('disabled', 'subtle', 'moderate', 'aggressive')
   */
  constructor(options = {}) {
    this.seed = options.seed || crypto.randomBytes(16).toString('hex');
    this.rng = this._createSeededRandom(this.seed);

    // Determine platform
    // Priority: explicit option > detected system platform > random choice
    this.platformType = options.platform || this._detectPlatform() || this._randomChoice(['windows', 'macos', 'linux'], [0.7, 0.2, 0.1]);
    this.platformConfig = PLATFORM_CONFIGS[this.platformType];

    // Determine timezone
    this.timezone = options.timezone || this._randomChoice(Object.keys(TIMEZONE_CONFIGS));
    this.timezoneConfig = TIMEZONE_CONFIGS[this.timezone];

    // Determine hardware tier
    this.tier = options.tier || this._randomChoice(['low', 'medium', 'high', 'workstation'], [0.15, 0.5, 0.3, 0.05]);
    this.hardwareConfig = HARDWARE_CONFIGS[this.tier];

    // Advanced evasion configurations
    this.canvasNoiseLevel = options.canvasNoiseLevel || 'subtle';
    this.canvasNoiseConfig = CANVAS_NOISE_CONFIGS[this.canvasNoiseLevel] || CANVAS_NOISE_CONFIGS.subtle;

    this.webglNoiseLevel = options.webglNoiseLevel || 'subtle';
    this.webglNoiseConfig = WEBGL_NOISE_CONFIGS[this.webglNoiseLevel] || WEBGL_NOISE_CONFIGS.subtle;

    this.audioNoiseLevel = options.audioNoiseLevel || 'subtle';
    this.audioNoiseConfig = AUDIO_NOISE_CONFIGS[this.audioNoiseLevel] || AUDIO_NOISE_CONFIGS.subtle;

    this.fontEvasionLevel = options.fontEvasionLevel || 'subtle';
    this.fontEvasionConfig = FONT_EVASION_CONFIGS[this.fontEvasionLevel] || FONT_EVASION_CONFIGS.subtle;

    // Generate consistent profile
    this._generateProfile();
  }

  /**
   * Create a seeded random number generator
   */
  _createSeededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }

    return () => {
      hash = Math.sin(hash) * 10000;
      return hash - Math.floor(hash);
    };
  }

  /**
   * Detect platform from process.platform
   * Maps Node.js process.platform to browser platform names
   * @private
   * @returns {string|null} Platform name ('windows', 'macos', 'linux') or null if unrecognized
   */
  _detectPlatform() {
    try {
      const platformMap = {
        'win32': 'windows',
        'darwin': 'macos',
        'linux': 'linux'
      };
      return platformMap[process.platform] || null;
    } catch (e) {
      // process.platform may not be available in all environments
      return null;
    }
  }

  /**
   * Random choice with optional weights
   */
  _randomChoice(array, weights = null) {
    if (weights) {
      const r = this.rng();
      let cumulative = 0;
      for (let i = 0; i < array.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) {
          return array[i];
        }
      }
      return array[array.length - 1];
    }
    return array[Math.floor(this.rng() * array.length)];
  }

  /**
   * Generate the complete fingerprint profile
   */
  _generateProfile() {
    // Chrome version
    this.chromeVersion = this._randomChoice(CHROME_VERSIONS);

    // User agent
    this.userAgent = this.platformConfig.userAgentTemplate.replace('{chromeVersion}', this.chromeVersion);

    // Platform
    this.platform = this._randomChoice(this.platformConfig.navigatorPlatforms);

    // WebGL
    this.webglVendor = this._randomChoice(this.platformConfig.webglVendors);
    this.webglRenderer = this._randomChoice(this.platformConfig.webglRenderers[this.webglVendor] || ['WebGL Renderer']);

    // Screen configuration based on tier and platform
    let screenTier = 'standard';
    if (this.tier === 'high' || this.tier === 'workstation') {
      screenTier = this.rng() > 0.5 ? 'high' : 'standard';
    }
    if (this.platformType === 'macos' && this.rng() > 0.3) {
      screenTier = 'retina';
    }
    this.screen = { ...this._randomChoice(SCREEN_CONFIGS[screenTier] || SCREEN_CONFIGS.standard) };
    this.screen.availWidth = this.screen.width;
    this.screen.devicePixelRatio = this.screen.devicePixelRatio || 1;

    // Languages based on timezone locale
    const primaryLocale = this.timezoneConfig.locale;
    const primaryLang = primaryLocale.split('-')[0];
    this.languages = [primaryLocale, primaryLang];
    if (primaryLang !== 'en' && this.rng() > 0.5) {
      this.languages.push('en');
    }

    // Hardware
    this.hardwareConcurrency = this.hardwareConfig.hardwareConcurrency;
    this.deviceMemory = this.hardwareConfig.deviceMemory;

    // Canvas noise (consistent per profile)
    this.canvasNoise = parseFloat((this.rng() * 0.0001).toFixed(10));

    // Audio noise (consistent per profile)
    this.audioNoise = parseFloat((this.rng() * 0.0001).toFixed(10));

    // Touch support (platform dependent)
    this.touchSupport = this.platformType === 'windows' && this.rng() > 0.7;
    this.maxTouchPoints = this.touchSupport ? (this.rng() > 0.5 ? 10 : 5) : 0;

    // Plugins (reduced in modern browsers)
    this.plugins = this._generatePlugins();

    // Fonts
    this.fonts = this._generateFonts();

    // Do Not Track
    this.doNotTrack = this.rng() > 0.8 ? '1' : null;

    // Cookies enabled
    this.cookieEnabled = true;

    // PDF viewer
    this.pdfViewerEnabled = true;

    // WebDriver (should be false for evasion)
    this.webdriver = false;
  }

  /**
   * Generate realistic plugin list
   */
  _generatePlugins() {
    const basePlugins = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
    ];

    // Most modern browsers have minimal plugins
    return this.rng() > 0.3 ? basePlugins : [];
  }

  /**
   * Generate platform-appropriate fonts with optional evasion
   */
  _generateFonts() {
    const platformFonts = [...this.platformConfig.fonts];
    let fonts = [];

    // Start with base fonts (random subset)
    const numFonts = Math.floor(this.rng() * 5) + platformFonts.length - 5;
    for (let i = 0; i < Math.min(numFonts, platformFonts.length); i++) {
      if (this.rng() > 0.2) {
        fonts.push(platformFonts[i]);
      }
    }

    // Apply font evasion if enabled
    if (this.fontEvasionConfig.enabled) {
      // Remove some common fonts based on configuration
      if (this.fontEvasionConfig.removeCommonFonts > 0) {
        fonts = fonts.filter(() => this.rng() > this.fontEvasionConfig.removeCommonFonts);
      }

      // Add decoy fonts
      if (this.fontEvasionConfig.addDecoyFonts > 0) {
        const availableDecoys = COMMON_DECOY_FONTS.filter(f => !fonts.includes(f));
        const numDecoys = Math.min(this.fontEvasionConfig.addDecoyFonts, availableDecoys.length);
        for (let i = 0; i < numDecoys; i++) {
          const idx = Math.floor(this.rng() * availableDecoys.length);
          fonts.push(availableDecoys.splice(idx, 1)[0]);
        }
      }

      // Randomize font order
      if (this.fontEvasionConfig.randomizeOrder) {
        fonts = this._shuffleArray(fonts);
      }
    }

    return fonts;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm with seeded RNG
   * @param {Array} array - Array to shuffle
   * @returns {Array} Shuffled array
   */
  _shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get the complete fingerprint configuration
   */
  getConfig() {
    return {
      seed: this.seed,
      platformType: this.platformType,
      timezone: this.timezone,
      tier: this.tier,

      userAgent: this.userAgent,
      platform: this.platform,

      screen: {
        width: this.screen.width,
        height: this.screen.height,
        availWidth: this.screen.availWidth,
        availHeight: this.screen.availHeight,
        colorDepth: this.screen.colorDepth,
        pixelDepth: this.screen.pixelDepth,
        devicePixelRatio: this.screen.devicePixelRatio
      },

      webgl: {
        vendor: this.webglVendor,
        renderer: this.webglRenderer
      },

      languages: this.languages,

      timezoneOffset: this.timezoneConfig.offset,
      timezoneName: this.timezone,

      hardwareConcurrency: this.hardwareConcurrency,
      deviceMemory: this.deviceMemory,

      canvasNoise: this.canvasNoise,
      audioNoise: this.audioNoise,

      touchSupport: this.touchSupport,
      maxTouchPoints: this.maxTouchPoints,

      plugins: this.plugins,
      fonts: this.fonts,

      doNotTrack: this.doNotTrack,
      cookieEnabled: this.cookieEnabled,
      pdfViewerEnabled: this.pdfViewerEnabled,
      webdriver: this.webdriver,

      // Advanced evasion settings
      evasion: {
        canvas: {
          level: this.canvasNoiseLevel,
          config: this.canvasNoiseConfig
        },
        webgl: {
          level: this.webglNoiseLevel,
          config: this.webglNoiseConfig
        },
        audio: {
          level: this.audioNoiseLevel,
          config: this.audioNoiseConfig
        },
        fonts: {
          level: this.fontEvasionLevel,
          config: this.fontEvasionConfig
        }
      }
    };
  }

  /**
   * Validate internal consistency of the fingerprint
   *
   * @returns {Object} Validation result with any issues found
   */
  validate() {
    const issues = [];

    // Check UA matches platform
    const ua = this.userAgent.toLowerCase();
    if (this.platformType === 'windows' && !ua.includes('windows')) {
      issues.push('User-Agent does not match Windows platform');
    }
    if (this.platformType === 'macos' && !ua.includes('mac')) {
      issues.push('User-Agent does not match macOS platform');
    }
    if (this.platformType === 'linux' && !ua.includes('linux')) {
      issues.push('User-Agent does not match Linux platform');
    }

    // Check WebGL vendor matches platform
    if (this.platformType === 'windows' && this.webglVendor.includes('Apple Inc.')) {
      issues.push('WebGL vendor Apple Inc. is unusual for Windows');
    }

    // Check screen resolution is reasonable
    if (this.screen.width < 1024 || this.screen.height < 768) {
      issues.push('Screen resolution is unusually small');
    }

    // Check hardware concurrency is reasonable
    if (this.hardwareConcurrency < 2 || this.hardwareConcurrency > 128) {
      issues.push('Hardware concurrency is unrealistic');
    }

    // Check device memory is reasonable
    if (this.deviceMemory < 2 || this.deviceMemory > 64) {
      issues.push('Device memory is unrealistic');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate injection script for applying fingerprint
   *
   * @returns {string} JavaScript code to inject
   */
  getInjectionScript() {
    const config = this.getConfig();

    return buildInjectionScript(config);
  }

  /**
   * Export profile to JSON for storage
   */
  toJSON() {
    return JSON.stringify(this.getConfig(), null, 2);
  }

  /**
   * Create profile from JSON
   */
  static fromJSON(json) {
    const config = typeof json === 'string' ? JSON.parse(json) : json;
    return new FingerprintProfile({
      seed: config.seed,
      platform: config.platformType,
      timezone: config.timezone || config.timezoneName,
      tier: config.tier,
      canvasNoiseLevel: config.evasion?.canvas?.level,
      webglNoiseLevel: config.evasion?.webgl?.level,
      audioNoiseLevel: config.evasion?.audio?.level,
      fontEvasionLevel: config.evasion?.fonts?.level
    });
  }

  /**
   * Create a profile optimized for a specific region
   *
   * @param {string} region - Region code (US, UK, EU, RU, JP, CN, AU)
   * @param {Object} options - Optional profile options (platform, tier, etc.)
   * @returns {FingerprintProfile} Profile optimized for the region
   */
  static forRegion(region, options = {}) {
    const regionTimezones = {
      US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
      UK: ['Europe/London'],
      EU: ['Europe/Paris', 'Europe/Berlin'],
      RU: ['Europe/Moscow'],
      JP: ['Asia/Tokyo'],
      CN: ['Asia/Shanghai'],
      AU: ['Australia/Sydney']
    };

    const timezones = regionTimezones[region] || regionTimezones.US;
    const timezone = timezones[Math.floor(Math.random() * timezones.length)];

    // Merge timezone with any additional options provided
    return new FingerprintProfile({ ...options, timezone });
  }
}

module.exports = { FingerprintProfile };

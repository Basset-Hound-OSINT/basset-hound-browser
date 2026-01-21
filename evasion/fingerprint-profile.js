/**
 * Fingerprint Profile System
 *
 * Phase 17: Profile-based consistent fingerprints
 *
 * Creates internally consistent browser fingerprint profiles where all elements
 * (UA, platform, WebGL, screen, timezone) match each other realistically.
 */

const crypto = require('crypto');

/**
 * Platform-specific configurations
 * Each platform has consistent sets of values
 */
const PLATFORM_CONFIGS = {
  windows: {
    platforms: ['Win32', 'Win64'],
    navigatorPlatforms: ['Win32'],
    oscpus: ['Windows NT 10.0; Win64; x64', 'Windows NT 10.0'],
    webglVendors: [
      'Google Inc. (NVIDIA)',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)',
    ],
    webglRenderers: {
      'Google Inc. (NVIDIA)': [
        'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)',
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 5700 XT Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)',
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) UHD Graphics 770 Direct3D11 vs_5_0 ps_5_0)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)',
      ],
    },
    fonts: [
      'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
      'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
      'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
    ],
    userAgentTemplate: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
  },

  macos: {
    platforms: ['MacIntel'],
    navigatorPlatforms: ['MacIntel'],
    oscpus: ['Intel Mac OS X 10_15_7', 'Intel Mac OS X 11_0', 'Intel Mac OS X 12_0'],
    webglVendors: [
      'Apple Inc.',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)',
    ],
    webglRenderers: {
      'Apple Inc.': [
        'Apple M1',
        'Apple M1 Pro',
        'Apple M1 Max',
        'Apple M2',
        'Apple M2 Pro',
        'Apple M3',
        'AMD Radeon Pro 5500M OpenGL Engine',
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon Pro 5500M OpenGL Engine)',
        'ANGLE (AMD Radeon Pro 580 OpenGL Engine)',
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) Iris(TM) Plus Graphics OpenGL Engine)',
        'ANGLE (Intel(R) UHD Graphics 630 OpenGL Engine)',
      ],
    },
    fonts: [
      'Arial', 'Arial Black', 'Avenir', 'Avenir Next', 'Courier', 'Courier New',
      'Geneva', 'Georgia', 'Helvetica', 'Helvetica Neue', 'Lucida Grande',
      'Menlo', 'Monaco', 'Optima', 'Palatino', 'San Francisco', 'Times',
    ],
    userAgentTemplate: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
  },

  linux: {
    platforms: ['Linux x86_64', 'Linux i686'],
    navigatorPlatforms: ['Linux x86_64'],
    oscpus: ['Linux x86_64', 'Linux i686'],
    webglVendors: [
      'Google Inc. (NVIDIA Corporation)',
      'Google Inc. (AMD)',
      'Google Inc. (Intel)',
      'Mesa/X.org',
    ],
    webglRenderers: {
      'Google Inc. (NVIDIA Corporation)': [
        'ANGLE (NVIDIA GeForce GTX 1080/PCIe/SSE2)',
        'ANGLE (NVIDIA GeForce RTX 3070/PCIe/SSE2)',
      ],
      'Google Inc. (AMD)': [
        'ANGLE (AMD Radeon RX 580 Series (POLARIS10, DRM 3.40.0))',
        'ANGLE (AMD Radeon RX 6700 XT (NAVI22))',
      ],
      'Google Inc. (Intel)': [
        'ANGLE (Intel(R) UHD Graphics 630)',
        'ANGLE (Intel(R) Iris(R) Xe Graphics)',
      ],
      'Mesa/X.org': [
        'Mesa Intel(R) UHD Graphics 630 (CFL GT2)',
        'Mesa AMD Radeon RX 580 (polaris10)',
      ],
    },
    fonts: [
      'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans',
      'Liberation Serif', 'Liberation Mono', 'Ubuntu', 'Ubuntu Mono',
      'Noto Sans', 'Noto Serif', 'Droid Sans', 'Droid Serif',
    ],
    userAgentTemplate: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{chromeVersion} Safari/537.36',
  },
};

/**
 * Chrome version ranges for realistic UAs
 */
const CHROME_VERSIONS = [
  '120.0.0.0', '121.0.0.0', '122.0.0.0', '123.0.0.0', '124.0.0.0',
  '125.0.0.0', '126.0.0.0', '127.0.0.0', '128.0.0.0', '129.0.0.0',
];

/**
 * Screen configurations by resolution tier
 */
const SCREEN_CONFIGS = {
  standard: [
    { width: 1920, height: 1080, availHeight: 1040, colorDepth: 24, pixelDepth: 24 },
    { width: 1366, height: 768, availHeight: 728, colorDepth: 24, pixelDepth: 24 },
    { width: 1536, height: 864, availHeight: 824, colorDepth: 24, pixelDepth: 24 },
    { width: 1440, height: 900, availHeight: 860, colorDepth: 24, pixelDepth: 24 },
  ],
  high: [
    { width: 2560, height: 1440, availHeight: 1400, colorDepth: 30, pixelDepth: 30 },
    { width: 3840, height: 2160, availHeight: 2120, colorDepth: 30, pixelDepth: 30 },
    { width: 2560, height: 1600, availHeight: 1560, colorDepth: 30, pixelDepth: 30 },
  ],
  retina: [
    { width: 2880, height: 1800, availHeight: 1760, colorDepth: 30, pixelDepth: 30, devicePixelRatio: 2 },
    { width: 3024, height: 1964, availHeight: 1920, colorDepth: 30, pixelDepth: 30, devicePixelRatio: 2 },
  ],
};

/**
 * Timezone configurations by region
 */
const TIMEZONE_CONFIGS = {
  'America/Los_Angeles': { offset: -480, locale: 'en-US', country: 'US' },
  'America/Denver': { offset: -420, locale: 'en-US', country: 'US' },
  'America/Chicago': { offset: -360, locale: 'en-US', country: 'US' },
  'America/New_York': { offset: -300, locale: 'en-US', country: 'US' },
  'Europe/London': { offset: 0, locale: 'en-GB', country: 'GB' },
  'Europe/Paris': { offset: 60, locale: 'fr-FR', country: 'FR' },
  'Europe/Berlin': { offset: 60, locale: 'de-DE', country: 'DE' },
  'Europe/Moscow': { offset: 180, locale: 'ru-RU', country: 'RU' },
  'Asia/Tokyo': { offset: 540, locale: 'ja-JP', country: 'JP' },
  'Asia/Shanghai': { offset: 480, locale: 'zh-CN', country: 'CN' },
  'Australia/Sydney': { offset: 660, locale: 'en-AU', country: 'AU' },
};

/**
 * Hardware concurrency options by system type
 */
const HARDWARE_CONFIGS = {
  low: { hardwareConcurrency: 4, deviceMemory: 4 },
  medium: { hardwareConcurrency: 8, deviceMemory: 8 },
  high: { hardwareConcurrency: 12, deviceMemory: 16 },
  workstation: { hardwareConcurrency: 16, deviceMemory: 32 },
};

/**
 * Canvas noise configuration
 * Controls how canvas fingerprint randomization is applied
 */
const CANVAS_NOISE_CONFIGS = {
  disabled: { enabled: false, intensity: 0 },
  subtle: { enabled: true, intensity: 0.00005, affectedChannels: ['r', 'g', 'b'], maxPixelShift: 1 },
  moderate: { enabled: true, intensity: 0.0001, affectedChannels: ['r', 'g', 'b'], maxPixelShift: 2 },
  aggressive: { enabled: true, intensity: 0.0005, affectedChannels: ['r', 'g', 'b', 'a'], maxPixelShift: 3 },
};

/**
 * WebGL noise configuration
 * Controls WebGL parameter randomization
 */
const WEBGL_NOISE_CONFIGS = {
  disabled: { enabled: false },
  subtle: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.05,
    parameterNoise: 0.01,
    precisionNoise: true,
  },
  moderate: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.1,
    parameterNoise: 0.02,
    precisionNoise: true,
  },
  aggressive: {
    enabled: true,
    randomizeExtensions: true,
    extensionRemovalChance: 0.2,
    parameterNoise: 0.05,
    precisionNoise: true,
  },
};

/**
 * Audio fingerprint noise configuration
 * Controls AudioContext fingerprint randomization
 */
const AUDIO_NOISE_CONFIGS = {
  disabled: { enabled: false, intensity: 0 },
  subtle: { enabled: true, intensity: 0.00001, noiseType: 'white', affectOscillator: true },
  moderate: { enabled: true, intensity: 0.00005, noiseType: 'white', affectOscillator: true },
  aggressive: { enabled: true, intensity: 0.0001, noiseType: 'pink', affectOscillator: true },
};

/**
 * Font evasion configuration
 * Controls font enumeration evasion
 */
const FONT_EVASION_CONFIGS = {
  disabled: { enabled: false },
  subtle: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.05,
    addDecoyFonts: 0,
  },
  moderate: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.1,
    addDecoyFonts: 2,
  },
  aggressive: {
    enabled: true,
    randomizeOrder: true,
    removeCommonFonts: 0.2,
    addDecoyFonts: 5,
  },
};

/**
 * Common fonts across all platforms (for decoy purposes)
 */
const COMMON_DECOY_FONTS = [
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro',
  'Raleway', 'PT Sans', 'Nunito', 'Ubuntu', 'Merriweather',
  'Playfair Display', 'Oswald', 'Quicksand', 'Poppins', 'Work Sans',
];

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
    this.platformType = options.platform || this._randomChoice(['windows', 'macos', 'linux'], [0.7, 0.2, 0.1]);
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
   * Random choice with optional weights
   */
  _randomChoice(array, weights = null) {
    if (weights) {
      const r = this.rng();
      let cumulative = 0;
      for (let i = 0; i < array.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) return array[i];
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
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
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
        devicePixelRatio: this.screen.devicePixelRatio,
      },

      webgl: {
        vendor: this.webglVendor,
        renderer: this.webglRenderer,
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
          config: this.canvasNoiseConfig,
        },
        webgl: {
          level: this.webglNoiseLevel,
          config: this.webglNoiseConfig,
        },
        audio: {
          level: this.audioNoiseLevel,
          config: this.audioNoiseConfig,
        },
        fonts: {
          level: this.fontEvasionLevel,
          config: this.fontEvasionConfig,
        },
      },
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
      issues,
    };
  }

  /**
   * Generate injection script for applying fingerprint
   *
   * @returns {string} JavaScript code to inject
   */
  getInjectionScript() {
    const config = this.getConfig();

    return `
      (function() {
        'use strict';

        const config = ${JSON.stringify(config)};

        // Override navigator properties
        const navigatorProps = {
          userAgent: { value: config.userAgent },
          platform: { value: config.platform },
          languages: { value: Object.freeze(config.languages) },
          language: { value: config.languages[0] },
          hardwareConcurrency: { value: config.hardwareConcurrency },
          deviceMemory: { value: config.deviceMemory },
          doNotTrack: { value: config.doNotTrack },
          cookieEnabled: { value: config.cookieEnabled },
          pdfViewerEnabled: { value: config.pdfViewerEnabled },
          webdriver: { value: false },
          maxTouchPoints: { value: config.maxTouchPoints },
        };

        for (const [prop, descriptor] of Object.entries(navigatorProps)) {
          try {
            Object.defineProperty(navigator, prop, descriptor);
          } catch (e) {}
        }

        // Override screen properties
        const screenProps = {
          width: { value: config.screen.width },
          height: { value: config.screen.height },
          availWidth: { value: config.screen.availWidth },
          availHeight: { value: config.screen.availHeight },
          colorDepth: { value: config.screen.colorDepth },
          pixelDepth: { value: config.screen.pixelDepth },
        };

        for (const [prop, descriptor] of Object.entries(screenProps)) {
          try {
            Object.defineProperty(screen, prop, descriptor);
          } catch (e) {}
        }

        // Override devicePixelRatio
        Object.defineProperty(window, 'devicePixelRatio', {
          value: config.screen.devicePixelRatio,
        });

        // Override timezone
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locale, options) {
          if (!options) options = {};
          if (!options.timeZone) options.timeZone = config.timezoneName;
          return new originalDateTimeFormat(locale, options);
        };
        Intl.DateTimeFormat.prototype = originalDateTimeFormat.prototype;

        const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = function() {
          return config.timezoneOffset;
        };

        // ==========================================
        // ADVANCED WEBGL NOISE INJECTION
        // ==========================================
        const webglConfig = config.evasion.webgl.config;

        // WebGL parameter noise for numeric values
        function addWebGLNoise(value, noise) {
          if (typeof value !== 'number' || !webglConfig.enabled) return value;
          const variation = value * noise * (Math.random() - 0.5);
          return Math.round(value + variation);
        }

        // Override WebGL getParameter with noise injection
        const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(param) {
          // Vendor and renderer strings
          if (param === 37445) return config.webgl.vendor;
          if (param === 37446) return config.webgl.renderer;

          const result = originalGetParameter.call(this, param);

          // Apply noise to numeric WebGL parameters
          if (webglConfig.enabled && webglConfig.parameterNoise > 0) {
            // MAX_TEXTURE_SIZE, MAX_RENDERBUFFER_SIZE, etc.
            if ([3379, 34024, 3386, 36347, 36348, 35661].includes(param)) {
              return addWebGLNoise(result, webglConfig.parameterNoise);
            }
          }

          return result;
        };

        const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(param) {
          if (param === 37445) return config.webgl.vendor;
          if (param === 37446) return config.webgl.renderer;

          const result = originalGetParameter2.call(this, param);

          if (webglConfig.enabled && webglConfig.parameterNoise > 0) {
            if ([3379, 34024, 3386, 36347, 36348, 35661].includes(param)) {
              return addWebGLNoise(result, webglConfig.parameterNoise);
            }
          }

          return result;
        };

        // Randomize WebGL extensions if enabled
        if (webglConfig.enabled && webglConfig.randomizeExtensions) {
          const originalGetSupportedExtensions = WebGLRenderingContext.prototype.getSupportedExtensions;
          WebGLRenderingContext.prototype.getSupportedExtensions = function() {
            const extensions = originalGetSupportedExtensions.call(this);
            if (!extensions) return extensions;
            // Randomly filter out some extensions
            return extensions.filter(() => Math.random() > webglConfig.extensionRemovalChance);
          };

          const originalGetSupportedExtensions2 = WebGL2RenderingContext.prototype.getSupportedExtensions;
          WebGL2RenderingContext.prototype.getSupportedExtensions = function() {
            const extensions = originalGetSupportedExtensions2.call(this);
            if (!extensions) return extensions;
            return extensions.filter(() => Math.random() > webglConfig.extensionRemovalChance);
          };
        }

        // Override shader precision if enabled
        if (webglConfig.enabled && webglConfig.precisionNoise) {
          const originalGetShaderPrecisionFormat = WebGLRenderingContext.prototype.getShaderPrecisionFormat;
          WebGLRenderingContext.prototype.getShaderPrecisionFormat = function(shaderType, precisionType) {
            const result = originalGetShaderPrecisionFormat.call(this, shaderType, precisionType);
            if (result && Math.random() < 0.1) {
              // Occasionally vary the precision slightly
              return {
                rangeMin: result.rangeMin,
                rangeMax: result.rangeMax,
                precision: Math.max(0, result.precision - Math.floor(Math.random() * 2)),
              };
            }
            return result;
          };
        }

        // ==========================================
        // ADVANCED CANVAS NOISE INJECTION
        // ==========================================
        const canvasConfig = config.evasion.canvas.config;

        if (canvasConfig.enabled) {
          // Enhanced toDataURL with configurable noise
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
          HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
                const intensity = canvasConfig.intensity || 0.0001;
                const maxShift = canvasConfig.maxPixelShift || 1;

                for (let i = 0; i < data.length; i += 4) {
                  const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);

                  if (channels.includes('r')) {
                    data[i] = Math.max(0, Math.min(255, data[i] + noise()));
                  }
                  if (channels.includes('g')) {
                    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
                  }
                  if (channels.includes('b')) {
                    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
                  }
                  if (channels.includes('a')) {
                    data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
                  }
                }
                ctx.putImageData(imageData, 0, 0);
              } catch (e) {
                // Canvas may be tainted, skip noise injection
              }
            }
            return originalToDataURL.call(this, type, quality);
          };

          // Also override toBlob for completeness
          const originalToBlob = HTMLCanvasElement.prototype.toBlob;
          HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) {
            const ctx = this.getContext('2d');
            if (ctx && this.width > 0 && this.height > 0) {
              try {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
                const maxShift = canvasConfig.maxPixelShift || 1;

                for (let i = 0; i < data.length; i += 4) {
                  const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);
                  if (channels.includes('r')) data[i] = Math.max(0, Math.min(255, data[i] + noise()));
                  if (channels.includes('g')) data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
                  if (channels.includes('b')) data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
                  if (channels.includes('a')) data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
                }
                ctx.putImageData(imageData, 0, 0);
              } catch (e) {}
            }
            return originalToBlob.call(this, callback, type, quality);
          };

          // Override getImageData to add noise on read as well
          const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
          CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
            const imageData = originalGetImageData.call(this, sx, sy, sw, sh);
            const data = imageData.data;
            const channels = canvasConfig.affectedChannels || ['r', 'g', 'b'];
            const maxShift = canvasConfig.maxPixelShift || 1;

            for (let i = 0; i < data.length; i += 4) {
              const noise = () => Math.floor((Math.random() - 0.5) * maxShift * 2);
              if (channels.includes('r')) data[i] = Math.max(0, Math.min(255, data[i] + noise()));
              if (channels.includes('g')) data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise()));
              if (channels.includes('b')) data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise()));
              if (channels.includes('a')) data[i + 3] = Math.max(0, Math.min(255, data[i + 3] + noise()));
            }
            return imageData;
          };
        }

        // ==========================================
        // ADVANCED AUDIO FINGERPRINT NOISE
        // ==========================================
        const audioConfig = config.evasion.audio.config;

        if (audioConfig.enabled) {
          // Override AudioBuffer.getChannelData with configurable noise
          const originalGetChannelData = AudioBuffer.prototype.getChannelData;
          AudioBuffer.prototype.getChannelData = function(channel) {
            const result = originalGetChannelData.call(this, channel);
            const intensity = audioConfig.intensity || 0.00001;

            for (let i = 0; i < result.length; i++) {
              // White noise or pink noise based on config
              if (audioConfig.noiseType === 'pink') {
                // Pink noise has more low frequency content (1/f distribution)
                const pink = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
                result[i] += pink * intensity;
              } else {
                // White noise (uniform distribution)
                result[i] += (Math.random() - 0.5) * intensity * 2;
              }
            }
            return result;
          };

          // Override AnalyserNode.getFloatFrequencyData
          if (audioConfig.affectOscillator && typeof AnalyserNode !== 'undefined') {
            const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
            AnalyserNode.prototype.getFloatFrequencyData = function(array) {
              originalGetFloatFrequencyData.call(this, array);
              const intensity = audioConfig.intensity || 0.00001;
              for (let i = 0; i < array.length; i++) {
                array[i] += (Math.random() - 0.5) * intensity * 100;
              }
            };

            const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
            AnalyserNode.prototype.getByteFrequencyData = function(array) {
              originalGetByteFrequencyData.call(this, array);
              const intensity = audioConfig.intensity || 0.00001;
              for (let i = 0; i < array.length; i++) {
                array[i] = Math.max(0, Math.min(255, array[i] + Math.floor((Math.random() - 0.5) * intensity * 1000)));
              }
            };
          }

          // Override OscillatorNode frequency if enabled
          if (audioConfig.affectOscillator && typeof OscillatorNode !== 'undefined') {
            const originalOscillatorStart = OscillatorNode.prototype.start;
            OscillatorNode.prototype.start = function(when) {
              // Add tiny frequency variation
              if (this.frequency && this.frequency.value) {
                const variation = this.frequency.value * audioConfig.intensity;
                this.frequency.value += (Math.random() - 0.5) * variation;
              }
              return originalOscillatorStart.call(this, when);
            };
          }
        }

        // ==========================================
        // FONT ENUMERATION EVASION
        // ==========================================
        // Override fonts property if available
        if (config.fonts && config.fonts.length > 0) {
          // The fonts are already randomized in the profile generation
          // This just ensures the font list is properly exposed
          try {
            if (document.fonts && document.fonts.check) {
              const originalCheck = document.fonts.check.bind(document.fonts);
              document.fonts.check = function(font, text) {
                // Only report fonts in our configured list
                const fontFamily = font.split(' ').pop().replace(/['"]/g, '');
                if (config.fonts.includes(fontFamily)) {
                  return originalCheck(font, text);
                }
                // For fonts not in our list, randomly return false to vary fingerprint
                return Math.random() > 0.8 ? originalCheck(font, text) : false;
              };
            }
          } catch (e) {}
        }

        // Override plugins
        Object.defineProperty(navigator, 'plugins', {
          get: function() {
            const plugins = config.plugins.map(p => ({
              name: p.name,
              filename: p.filename,
              description: p.description,
              length: 1,
              item: () => null,
              namedItem: () => null,
            }));
            plugins.item = (i) => plugins[i];
            plugins.namedItem = (name) => plugins.find(p => p.name === name);
            plugins.refresh = () => {};
            return plugins;
          }
        });

        console.log('[Fingerprint] Advanced profile applied:', config.platformType, config.timezone,
          'Canvas:', config.evasion.canvas.level,
          'WebGL:', config.evasion.webgl.level,
          'Audio:', config.evasion.audio.level,
          'Fonts:', config.evasion.fonts.level);
      })();
    `;
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
      fontEvasionLevel: config.evasion?.fonts?.level,
    });
  }

  /**
   * Create a profile optimized for a specific region
   */
  static forRegion(region) {
    const regionTimezones = {
      US: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'],
      UK: ['Europe/London'],
      EU: ['Europe/Paris', 'Europe/Berlin'],
      RU: ['Europe/Moscow'],
      JP: ['Asia/Tokyo'],
      CN: ['Asia/Shanghai'],
      AU: ['Australia/Sydney'],
    };

    const timezones = regionTimezones[region] || regionTimezones.US;
    const timezone = timezones[Math.floor(Math.random() * timezones.length)];

    return new FingerprintProfile({ timezone });
  }
}

/**
 * FingerprintProfileManager
 *
 * Manages multiple fingerprint profiles with persistence
 */
class FingerprintProfileManager {
  constructor() {
    this.profiles = new Map();
    this.activeProfileId = null;
  }

  /**
   * Create a new profile
   */
  createProfile(options = {}) {
    const profile = new FingerprintProfile(options);
    const id = options.id || `fp_${crypto.randomBytes(8).toString('hex')}`;

    this.profiles.set(id, profile);

    return { id, profile };
  }

  /**
   * Get a profile by ID
   */
  getProfile(id) {
    return this.profiles.get(id);
  }

  /**
   * Set the active profile
   */
  setActiveProfile(id) {
    if (!this.profiles.has(id)) {
      throw new Error(`Profile ${id} not found`);
    }
    this.activeProfileId = id;
    return this.profiles.get(id);
  }

  /**
   * Get the active profile
   */
  getActiveProfile() {
    if (!this.activeProfileId) return null;
    return this.profiles.get(this.activeProfileId);
  }

  /**
   * List all profiles
   */
  listProfiles() {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({
      id,
      platformType: profile.platformType,
      timezone: profile.timezone,
      tier: profile.tier,
      isActive: id === this.activeProfileId,
    }));
  }

  /**
   * Delete a profile
   */
  deleteProfile(id) {
    if (id === this.activeProfileId) {
      this.activeProfileId = null;
    }
    return this.profiles.delete(id);
  }

  /**
   * Export all profiles
   */
  exportProfiles() {
    const exported = {};
    for (const [id, profile] of this.profiles) {
      exported[id] = profile.getConfig();
    }
    return exported;
  }

  /**
   * Import profiles
   */
  importProfiles(data) {
    for (const [id, config] of Object.entries(data)) {
      const profile = FingerprintProfile.fromJSON(config);
      this.profiles.set(id, profile);
    }
  }
}

module.exports = {
  FingerprintProfile,
  FingerprintProfileManager,
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
  CANVAS_NOISE_CONFIGS,
  WEBGL_NOISE_CONFIGS,
  AUDIO_NOISE_CONFIGS,
  FONT_EVASION_CONFIGS,
  COMMON_DECOY_FONTS,
};

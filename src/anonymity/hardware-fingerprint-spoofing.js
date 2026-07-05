/**
 * Basset Hound Browser - Hardware Fingerprint Spoofing Module
 *
 * Overrides navigator properties to spoof hardware identity
 * Ensures consistency within sessions and realistic value ranges
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

/**
 * Hardware Fingerprint Spoofing Manager
 * Provides realistic hardware identity spoofing with session consistency
 */
class HardwareFingerprintSpoofing {
  constructor(options = {}) {
    this.options = options;

    // Session-specific values (consistent within session)
    this.sessionValues = {
      hardwareConcurrency: null,
      deviceMemory: null,
      maxTouchPoints: null,
      vendor: null,
      screenWidth: null,
      screenHeight: null,
      availWidth: null,
      availHeight: null,
      colorDepth: null,
      pixelDepth: null,
      devicePixelRatio: null,
      languages: null,
      language: null,
      timezone: null
    };

    // Track if session values are initialized
    this.initialized = false;

    // Realistic value ranges for validation
    this.ranges = {
      hardwareConcurrency: { min: 2, max: 32 },
      deviceMemory: { min: 2, max: 64 },
      maxTouchPoints: { min: 0, max: 10 },
      screenWidth: { min: 320, max: 5120 },
      screenHeight: { min: 568, max: 3200 },
      colorDepth: [24, 32],
      devicePixelRatio: [0.75, 1.0, 1.5, 2.0, 2.5, 2.75, 3.0]
    };

    // Common vendors
    this.vendors = [
      'Google Inc.',
      'Apple Computer, Inc.',
      'Mozilla',
      'Opera Software ASA'
    ];

    // Common browsers and their typical vendor values
    this.vendorMap = {
      Chrome: 'Google Inc.',
      Safari: 'Apple Computer, Inc.',
      Firefox: 'Mozilla',
      Opera: 'Opera Software ASA',
      Edge: 'Google Inc.'
    };

    // Common language combinations
    this.languageSets = [
      ['en-US'],
      ['en-GB'],
      ['en-US', 'en'],
      ['en-GB', 'en'],
      ['fr-FR'],
      ['de-DE'],
      ['es-ES'],
      ['ja-JP'],
      ['zh-CN'],
      ['pt-BR'],
      ['it-IT'],
      ['ru-RU']
    ];

    // Common timezones
    this.timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Anchorage',
      'Pacific/Honolulu',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Asia/Hong_Kong',
      'Asia/Singapore',
      'Asia/Bangkok',
      'America/Toronto',
      'America/Mexico_City',
      'America/Sao_Paulo'
    ];

    // Screen resolutions by device type
    this.screenResolutions = {
      desktop: [
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 1366, height: 768 },
        { width: 1024, height: 768 },
        { width: 2560, height: 1600 },
        { width: 3840, height: 2160 },
        { width: 1440, height: 900 }
      ],
      mobile: [
        { width: 390, height: 844 }, // iPhone 14
        { width: 393, height: 873 }, // Pixel 6
        { width: 412, height: 915 }, // Pixel 7
        { width: 360, height: 740 }, // Android common
        { width: 375, height: 667 }, // iPhone SE
        { width: 414, height: 896 }, // iPhone XS Max
        { width: 360, height: 800 }, // Android medium
        { width: 480, height: 853 } // Android larger
      ],
      tablet: [
        { width: 820, height: 1180 }, // iPad Air
        { width: 1024, height: 1366 }, // iPad Pro 12.9"
        { width: 768, height: 1024 }, // iPad 10.2"
        { width: 912, height: 1369 } // Android tablet
      ]
    };

    // Initialize if config provided
    if (options.profile) {
      this.initializeFromProfile(options.profile);
    }
  }

  /**
   * Initialize spoofing values from a device profile
   * @param {Object} profile - Device profile with hardware properties
   */
  initializeFromProfile(profile) {
    if (!profile) {
      return;
    }

    if (profile.hardwareConcurrency !== undefined) {
      this.validateAndSetValue('hardwareConcurrency', profile.hardwareConcurrency);
    }
    if (profile.deviceMemory !== undefined) {
      this.validateAndSetValue('deviceMemory', profile.deviceMemory);
    }
    if (profile.maxTouchPoints !== undefined) {
      this.validateAndSetValue('maxTouchPoints', profile.maxTouchPoints);
    }
    if (profile.vendor !== undefined) {
      this.validateAndSetValue('vendor', profile.vendor);
    }
    if (profile.screenWidth !== undefined) {
      this.sessionValues.screenWidth = profile.screenWidth;
    }
    if (profile.screenHeight !== undefined) {
      this.sessionValues.screenHeight = profile.screenHeight;
    }
    if (profile.availWidth !== undefined) {
      this.sessionValues.availWidth = profile.availWidth;
    }
    if (profile.availHeight !== undefined) {
      this.sessionValues.availHeight = profile.availHeight;
    }
    if (profile.colorDepth !== undefined) {
      this.validateAndSetValue('colorDepth', profile.colorDepth);
    }
    if (profile.pixelDepth !== undefined) {
      this.validateAndSetValue('pixelDepth', profile.pixelDepth);
    }
    if (profile.devicePixelRatio !== undefined) {
      this.validateAndSetValue('devicePixelRatio', profile.devicePixelRatio);
    }
    if (profile.languages !== undefined && Array.isArray(profile.languages)) {
      this.sessionValues.languages = profile.languages;
    } else if (profile.language !== undefined) {
      this.sessionValues.languages = [profile.language];
    }

    if (profile.languages !== undefined && Array.isArray(profile.languages) && profile.languages.length > 0) {
      this.sessionValues.language = profile.languages[0];
    } else if (profile.language !== undefined) {
      this.sessionValues.language = profile.language;
    }
    if (profile.timezone !== undefined) {
      this.sessionValues.timezone = profile.timezone;
    }

    this.initialized = true;
  }

  /**
   * Generate random but realistic hardware values
   */
  generateRandomValues() {
    const deviceType = this.randomChoice(['desktop', 'mobile', 'tablet']);
    const isTouchDevice = deviceType !== 'desktop';

    // Generate hardware concurrency (CPU cores)
    const concurrencyOptions = isTouchDevice ? [4, 6, 8] : [4, 6, 8, 12, 16];
    this.sessionValues.hardwareConcurrency = this.randomChoice(concurrencyOptions);

    // Generate device memory
    const memoryOptions = isTouchDevice ? [6, 8, 12] : [8, 16, 32];
    this.sessionValues.deviceMemory = this.randomChoice(memoryOptions);

    // Generate max touch points
    this.sessionValues.maxTouchPoints = isTouchDevice
      ? this.randomChoice([5, 10])
      : 0;

    // Generate vendor
    this.sessionValues.vendor = this.randomChoice(this.vendors);

    // Generate screen dimensions
    const resolutions = this.screenResolutions[deviceType];
    const resolution = this.randomChoice(resolutions);
    this.sessionValues.screenWidth = resolution.width;
    this.sessionValues.screenHeight = resolution.height;

    // Generate available screen space (subtract taskbar/menu)
    const availHeightReduction = isTouchDevice ? 0 : this.randomInt(50, 100);
    this.sessionValues.availWidth = this.sessionValues.screenWidth;
    this.sessionValues.availHeight = this.sessionValues.screenHeight - availHeightReduction;

    // Generate color depth
    this.sessionValues.colorDepth = this.randomChoice([24, 32]);
    this.sessionValues.pixelDepth = this.sessionValues.colorDepth;

    // Generate device pixel ratio
    if (deviceType === 'mobile') {
      this.sessionValues.devicePixelRatio = this.randomChoice([2.0, 2.5, 3.0]);
    } else if (deviceType === 'tablet') {
      this.sessionValues.devicePixelRatio = this.randomChoice([1.0, 2.0]);
    } else {
      this.sessionValues.devicePixelRatio = this.randomChoice([1.0, 1.5, 2.0]);
    }

    // Generate languages
    this.sessionValues.languages = this.randomChoice(this.languageSets);
    this.sessionValues.language = this.sessionValues.languages[0];

    // Generate timezone
    this.sessionValues.timezone = this.randomChoice(this.timezones);

    this.initialized = true;
  }

  /**
   * Validate and set a value
   * @param {string} property - Property name
   * @param {any} value - Value to validate
   * @throws {Error} If value is invalid
   */
  validateAndSetValue(property, value) {
    if (!this.validateValue(property, value)) {
      throw new Error(`Invalid value for ${property}: ${value}`);
    }
    this.sessionValues[property] = value;
  }

  /**
   * Validate a property value
   * @param {string} property - Property name
   * @param {any} value - Value to validate
   * @returns {boolean} True if valid
   */
  validateValue(property, value) {
    const range = this.ranges[property];

    if (!range) {
      return true;
    } // Property not in ranges, assume valid

    if (Array.isArray(range)) {
      return range.includes(value);
    }

    if (typeof range === 'object' && 'min' in range && 'max' in range) {
      return typeof value === 'number' && value >= range.min && value <= range.max;
    }

    return true;
  }

  /**
   * Get all spoofed values
   * @returns {Object} All spoofed property values
   */
  getValues() {
    if (!this.initialized) {
      this.generateRandomValues();
    }
    return { ...this.sessionValues };
  }

  /**
   * Get value for a specific property
   * @param {string} property - Property name
   * @returns {any} The spoofed value
   */
  getValue(property) {
    if (!this.initialized) {
      this.generateRandomValues();
    }
    return this.sessionValues[property];
  }

  /**
   * Generate JavaScript to inject into browser context
   * @returns {string} JavaScript code to execute in renderer
   */
  generateInjectionScript() {
    if (!this.initialized) {
      this.generateRandomValues();
    }

    const values = this.sessionValues;

    return `
      (function() {
        // Override navigator.hardwareConcurrency
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: function() { return ${values.hardwareConcurrency}; },
          configurable: false
        });

        // Override navigator.deviceMemory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: function() { return ${values.deviceMemory}; },
          configurable: false
        });

        // Override navigator.maxTouchPoints
        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: function() { return ${values.maxTouchPoints}; },
          configurable: false
        });

        // Override navigator.vendor
        Object.defineProperty(navigator, 'vendor', {
          get: function() { return '${values.vendor}'; },
          configurable: false
        });

        // Override navigator.languages
        Object.defineProperty(navigator, 'languages', {
          get: function() { return [${(values.languages || ['en-US']).map(l => `'${l}'`).join(', ')}]; },
          configurable: false
        });

        // Override navigator.language
        Object.defineProperty(navigator, 'language', {
          get: function() { return '${values.language}'; },
          configurable: false
        });

        // Override screen properties
        Object.defineProperty(screen, 'width', {
          get: function() { return ${values.screenWidth}; },
          configurable: false
        });

        Object.defineProperty(screen, 'height', {
          get: function() { return ${values.screenHeight}; },
          configurable: false
        });

        Object.defineProperty(screen, 'availWidth', {
          get: function() { return ${values.availWidth}; },
          configurable: false
        });

        Object.defineProperty(screen, 'availHeight', {
          get: function() { return ${values.availHeight}; },
          configurable: false
        });

        Object.defineProperty(screen, 'colorDepth', {
          get: function() { return ${values.colorDepth}; },
          configurable: false
        });

        Object.defineProperty(screen, 'pixelDepth', {
          get: function() { return ${values.pixelDepth}; },
          configurable: false
        });

        // Override devicePixelRatio
        Object.defineProperty(window, 'devicePixelRatio', {
          get: function() { return ${values.devicePixelRatio}; },
          configurable: false
        });

        // Override timezone
        const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
        Intl.DateTimeFormat.prototype.resolvedOptions = function() {
          const options = originalResolvedOptions.call(this);
          options.timeZone = '${values.timezone}';
          return options;
        };
      })();
    `;
  }

  /**
   * Helper: Get random element from array
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Helper: Get random integer in range
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Reset to uninitialized state
   */
  reset() {
    Object.keys(this.sessionValues).forEach(key => {
      this.sessionValues[key] = null;
    });
    this.initialized = false;
  }
}

module.exports = HardwareFingerprintSpoofing;

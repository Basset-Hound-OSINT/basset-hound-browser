/**
 * Browser Profile Generator
 * Generates complete consistent browser profiles (plugins, timezone, language)
 * Features: Real plugin lists, timezone/location matching, language/locale matching
 * All generated profiles remain consistent throughout a session
 */

class BrowserProfileGenerator {
  constructor() {
    this.currentProfile = null;
    this.generatedBrowserProfile = null;
    this.pluginDatabase = this.initializePlugins();
    this.timezoneMap = this.initializeTimezones();
  }

  /**
   * Initialize real browser plugins organized by browser type
   */
  initializePlugins() {
    return {
      // Safari plugins (iOS/macOS)
      'Safari-iOS': [
        'Chrome PDF Plugin',
        'Chrome PDF Viewer',
        'Native Client Executable',
        'Shockwave Flash'
      ],
      'Safari-macOS': [
        'Chrome PDF Plugin',
        'Chrome PDF Viewer',
        'Native Client Executable',
        'Shockwave Flash',
        'Java Applet Plug-in'
      ],
      // Chrome plugins
      'Chrome': [
        'Chrome PDF Plugin',
        'Chrome PDF Viewer',
        'Native Client Executable',
        'Shockwave Flash'
      ],
      // Firefox plugins
      'Firefox': [
        'Shockwave Flash',
        'Java(TM) Plug-in'
      ],
      // Edge plugins
      'Edge': [
        'Chrome PDF Plugin',
        'Chrome PDF Viewer',
        'Native Client Executable'
      ]
    };
  }

  /**
   * Initialize timezone to region and language mapping
   */
  initializeTimezones() {
    return {
      // North America
      'America/New_York': {
        region: 'US',
        country: 'United States',
        languages: ['en-US', 'es-US', 'fr-US'],
        primaryLanguage: 'en-US',
        locale: 'en-US',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'America/Los_Angeles': {
        region: 'US',
        country: 'United States',
        languages: ['en-US', 'es-US', 'zh-CN'],
        primaryLanguage: 'en-US',
        locale: 'en-US',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'America/Chicago': {
        region: 'US',
        country: 'United States',
        languages: ['en-US', 'es-US'],
        primaryLanguage: 'en-US',
        locale: 'en-US',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'America/Toronto': {
        region: 'CA',
        country: 'Canada',
        languages: ['en-CA', 'fr-CA', 'en-US'],
        primaryLanguage: 'en-CA',
        locale: 'en-CA',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      // Europe
      'Europe/London': {
        region: 'UK',
        country: 'United Kingdom',
        languages: ['en-GB', 'en-US', 'en'],
        primaryLanguage: 'en-GB',
        locale: 'en-GB',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'Europe/Paris': {
        region: 'FR',
        country: 'France',
        languages: ['fr-FR', 'en-US', 'de-DE'],
        primaryLanguage: 'fr-FR',
        locale: 'fr-FR',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'Europe/Berlin': {
        region: 'DE',
        country: 'Germany',
        languages: ['de-DE', 'en-US', 'fr-FR'],
        primaryLanguage: 'de-DE',
        locale: 'de-DE',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'Europe/Madrid': {
        region: 'ES',
        country: 'Spain',
        languages: ['es-ES', 'ca-ES', 'en-US'],
        primaryLanguage: 'es-ES',
        locale: 'es-ES',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      // Asia Pacific
      'Asia/Tokyo': {
        region: 'JP',
        country: 'Japan',
        languages: ['ja-JP', 'en-US'],
        primaryLanguage: 'ja-JP',
        locale: 'ja-JP',
        fonts: ['Arial', 'Hiragino Sans', 'Meiryo']
      },
      'Asia/Shanghai': {
        region: 'CN',
        country: 'China',
        languages: ['zh-CN', 'en-US'],
        primaryLanguage: 'zh-CN',
        locale: 'zh-CN',
        fonts: ['Arial', 'SimSun', 'Microsoft YaHei']
      },
      'Asia/Hong_Kong': {
        region: 'HK',
        country: 'Hong Kong',
        languages: ['zh-HK', 'en-HK', 'en-US'],
        primaryLanguage: 'zh-HK',
        locale: 'zh-HK',
        fonts: ['Arial', 'Apple LiGothic', 'SimHei']
      },
      'Asia/Singapore': {
        region: 'SG',
        country: 'Singapore',
        languages: ['en-SG', 'zh-SG', 'en-US'],
        primaryLanguage: 'en-SG',
        locale: 'en-SG',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'Asia/Bangkok': {
        region: 'TH',
        country: 'Thailand',
        languages: ['th-TH', 'en-US'],
        primaryLanguage: 'th-TH',
        locale: 'th-TH',
        fonts: ['Arial', 'Garuda', 'Cordia New']
      },
      'Asia/Seoul': {
        region: 'KR',
        country: 'South Korea',
        languages: ['ko-KR', 'en-US'],
        primaryLanguage: 'ko-KR',
        locale: 'ko-KR',
        fonts: ['Arial', 'Malgun Gothic', 'Segoe UI']
      },
      // Australia/NZ
      'Australia/Sydney': {
        region: 'AU',
        country: 'Australia',
        languages: ['en-AU', 'en-US'],
        primaryLanguage: 'en-AU',
        locale: 'en-AU',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      },
      'Pacific/Auckland': {
        region: 'NZ',
        country: 'New Zealand',
        languages: ['en-NZ', 'en-US'],
        primaryLanguage: 'en-NZ',
        locale: 'en-NZ',
        fonts: ['Arial', 'Georgia', 'Trebuchet MS']
      }
    };
  }

  /**
   * Initialize from device profile
   */
  initializeFromProfile(profile) {
    if (!profile) {
      throw new Error('Profile required');
    }

    this.currentProfile = profile;
    this.generatedBrowserProfile = this.generateFromProfile(profile);
    return this.generatedBrowserProfile;
  }

  /**
   * Generate complete browser profile from device profile
   */
  generateFromProfile(profile) {
    const { vendor, timezone } = profile;

    // Get timezone details
    const tzDetails = this.getTimezoneDetails(timezone);

    // Get plugins based on vendor/browser
    const plugins = this.getPluginsForVendor(vendor);

    // Generate browser profile
    return {
      timezone: timezone,
      region: tzDetails.region,
      country: tzDetails.country,
      languages: tzDetails.languages,
      primaryLanguage: tzDetails.primaryLanguage,
      locale: tzDetails.locale,
      plugins: plugins,
      fonts: tzDetails.fonts,
      doNotTrack: Math.random() > 0.5 ? '1' : undefined, // ~50% have DNT enabled
      cookieEnabled: true,
      cookiesSupported: true,
      localStorageEnabled: true,
      sessionStorageEnabled: true,
      indexedDBEnabled: true,
      webWorkersEnabled: true,
      serviceWorkerEnabled: true
    };
  }

  /**
   * Get timezone details
   */
  getTimezoneDetails(timezone) {
    // Return timezone mapping or generate default
    if (this.timezoneMap[timezone]) {
      return this.timezoneMap[timezone];
    }

    // Fallback to US East Coast for unknown timezones
    return this.timezoneMap['America/New_York'];
  }

  /**
   * Get plugins for vendor/browser
   */
  getPluginsForVendor(vendor) {
    if (vendor === 'Apple') {
      // Random between Safari iOS and macOS
      const plugins = Math.random() > 0.5 ?
        this.pluginDatabase['Safari-iOS'] :
        this.pluginDatabase['Safari-macOS'];
      return plugins.slice();
    }

    if (vendor === 'Google') {
      // Google uses Chrome
      return this.pluginDatabase['Chrome'].slice();
    }

    // Default to Chrome-like plugins for others
    return this.pluginDatabase['Chrome'].slice();
  }

  /**
   * Get currently generated browser profile
   */
  getBrowserProfile() {
    if (!this.generatedBrowserProfile) {
      throw new Error('No profile generated - call initializeFromProfile first');
    }
    return this.generatedBrowserProfile;
  }

  /**
   * Validate browser profile is realistic
   */
  validateBrowserProfile(profile) {
    const { timezone, languages, locale, plugins, fonts } = profile;

    // Check timezone is valid IANA format
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }
    if (!timezone.includes('/')) {
      return false;
    }

    // Check languages array exists and has items
    if (!Array.isArray(languages) || languages.length === 0) {
      return false;
    }

    // Check locale format (en-US, zh-CN, etc)
    if (!locale || !/^[a-z]{2}-[A-Z]{2}/.test(locale)) {
      return false;
    }

    // Check plugins array exists
    if (!Array.isArray(plugins)) {
      return false;
    }

    // Check fonts array exists and has items
    if (!Array.isArray(fonts) || fonts.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Get all available timezones
   */
  getAvailableTimezones() {
    return Object.keys(this.timezoneMap);
  }

  /**
   * Get timezone info
   */
  getTimezoneInfo(timezone) {
    if (!this.timezoneMap[timezone]) {
      throw new Error(`Unknown timezone: ${timezone}`);
    }
    return this.timezoneMap[timezone];
  }

  /**
   * Get all available plugin sets
   */
  getAvailablePluginSets() {
    return Object.keys(this.pluginDatabase);
  }

  /**
   * Reset to uninitialized state
   */
  reset() {
    this.currentProfile = null;
    this.generatedBrowserProfile = null;
  }
}

module.exports = BrowserProfileGenerator;

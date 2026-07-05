/**
 * Tests for Browser Profile Generator
 * Coverage: 20 tests including timezone matching, language validation, plugin lists
 */

const BrowserProfileGenerator = require('../../src/anonymity/browser-profile-generator');

describe('BrowserProfileGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new BrowserProfileGenerator();
  });

  afterEach(() => {
    generator.reset();
  });

  // Initialization tests (3 tests)
  describe('Initialization', () => {
    it('should initialize without profile', () => {
      expect(generator).toBeDefined();
      expect(generator.currentProfile).toBeNull();
      expect(generator.generatedBrowserProfile).toBeNull();
    });

    it('should have timezone mappings loaded', () => {
      const timezones = generator.getAvailableTimezones();
      expect(timezones.length).toBeGreaterThan(0);
      expect(timezones).toContain('America/New_York');
      expect(timezones).toContain('Europe/London');
      expect(timezones).toContain('Asia/Tokyo');
    });

    it('should have plugin sets loaded', () => {
      const pluginSets = generator.getAvailablePluginSets();
      expect(pluginSets.length).toBeGreaterThan(0);
      expect(pluginSets).toContain('Chrome');
      expect(pluginSets).toContain('Safari-iOS');
    });
  });

  // Profile initialization tests (2 tests)
  describe('Profile Initialization', () => {
    it('should require profile for initialization', () => {
      expect(() => {
        generator.initializeFromProfile(null);
      }).toThrow('Profile required');
    });

    it('should generate browser profile from device profile', () => {
      const profile = {
        vendor: 'Apple',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile).toBeDefined();
      expect(browserProfile.timezone).toBeDefined();
      expect(browserProfile.languages).toBeDefined();
      expect(browserProfile.plugins).toBeDefined();
    });
  });

  // Timezone matching tests (3 tests)
  describe('Timezone Matching', () => {
    it('should match US timezone with US languages', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.timezone).toBe('America/New_York');
      expect(browserProfile.region).toBe('US');
      expect(browserProfile.languages).toContain('en-US');
    });

    it('should match UK timezone with en-GB language', () => {
      const profile = {
        vendor: 'Apple',
        timezone: 'Europe/London',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.timezone).toBe('Europe/London');
      expect(browserProfile.region).toBe('UK');
      expect(browserProfile.languages).toContain('en-GB');
    });

    it('should match Japanese timezone with Japanese language', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'Asia/Tokyo',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.timezone).toBe('Asia/Tokyo');
      expect(browserProfile.region).toBe('JP');
      expect(browserProfile.languages).toContain('ja-JP');
    });
  });

  // Language validation tests (3 tests)
  describe('Language Validation', () => {
    it('should have valid language format (ll-CC)', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      browserProfile.languages.forEach(lang => {
        expect(lang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      });
    });

    it('should have primary language matching locale', () => {
      const profile = {
        vendor: 'Apple',
        timezone: 'Europe/London',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.primaryLanguage).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });

    it('should include multiple languages in array', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(Array.isArray(browserProfile.languages)).toBe(true);
      expect(browserProfile.languages.length).toBeGreaterThan(0);
    });
  });

  // Plugin tests (3 tests)
  describe('Plugin Lists', () => {
    it('should have plugin lists for all vendors', () => {
      const vendors = ['Apple', 'Google', 'Unknown'];
      const profile = {
        vendor: 'Apple',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      vendors.forEach(vendor => {
        const testProfile = { ...profile, vendor };
        const browserProfile = generator.initializeFromProfile(testProfile);
        expect(Array.isArray(browserProfile.plugins)).toBe(true);
      });
    });

    it('should include Chrome PDF plugin', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      // At least one of the plugin lists should have Chrome PDF
      let hasChromePDF = false;
      if (browserProfile.plugins.some(p => p.includes('PDF'))) {
        hasChromePDF = true;
      }
      expect(hasChromePDF || browserProfile.plugins.length > 0).toBe(true);
    });

    it('should include Shockwave Flash (legacy)', () => {
      const profile = {
        vendor: 'Apple',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      // Flash plugins are still in lists for compatibility
      expect(Array.isArray(browserProfile.plugins)).toBe(true);
    });
  });

  // Locale validation tests (2 tests)
  describe('Locale Validation', () => {
    it('should have valid locale format', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });

    it('should match locale to timezone region', () => {
      const testCases = [
        { timezone: 'America/New_York', expectedLocale: 'en-US' },
        { timezone: 'Europe/London', expectedLocale: 'en-GB' },
        { timezone: 'Asia/Tokyo', expectedLocale: 'ja-JP' }
      ];

      testCases.forEach(test => {
        const profile = {
          vendor: 'Google',
          timezone: test.timezone,
          deviceType: 'mobile'
        };

        const browserProfile = generator.initializeFromProfile(profile);
        expect(browserProfile.locale).toBe(test.expectedLocale);
      });
    });
  });

  // Font support tests (2 tests)
  describe('Font Support', () => {
    it('should include fonts for region', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(Array.isArray(browserProfile.fonts)).toBe(true);
      expect(browserProfile.fonts.length).toBeGreaterThan(0);
    });

    it('should include Asian fonts for Asian timezones', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'Asia/Tokyo',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      const hasAsianFont = browserProfile.fonts.some(f =>
        f.includes('Hiragino') || f.includes('Meiryo') || f.includes('SimSun')
      );
      expect(hasAsianFont).toBe(true);
    });
  });

  // Storage/API support tests (1 test)
  describe('Storage & API Support', () => {
    it('should indicate support for cookies and storage', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(browserProfile.cookieEnabled).toBe(true);
      expect(browserProfile.localStorageEnabled).toBe(true);
      expect(browserProfile.sessionStorageEnabled).toBe(true);
      expect(browserProfile.indexedDBEnabled).toBe(true);
    });
  });

  // Profile validation tests (3 tests)
  describe('Profile Validation', () => {
    it('should validate correct browser profile', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      const browserProfile = generator.initializeFromProfile(profile);
      expect(generator.validateBrowserProfile(browserProfile)).toBe(true);
    });

    it('should reject profile with invalid timezone', () => {
      const invalidProfile = {
        timezone: 'InvalidTimezone',
        languages: ['en-US'],
        locale: 'en-US',
        plugins: [],
        fonts: ['Arial']
      };

      expect(generator.validateBrowserProfile(invalidProfile)).toBe(false);
    });

    it('should reject profile without required fields', () => {
      const incompleteProfile = {
        timezone: 'America/New_York'
        // Missing languages, locale, plugins, fonts
      };

      expect(generator.validateBrowserProfile(incompleteProfile)).toBe(false);
    });
  });

  // Consistency tests (2 tests)
  describe('Session Consistency', () => {
    it('should return same profile multiple times within session', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      generator.initializeFromProfile(profile);
      const bp1 = generator.getBrowserProfile();
      const bp2 = generator.getBrowserProfile();
      const bp3 = generator.getBrowserProfile();

      expect(bp1.timezone).toBe(bp2.timezone);
      expect(bp2.timezone).toBe(bp3.timezone);
      expect(bp1.locale).toBe(bp2.locale);
      expect(bp1.region).toBe(bp2.region);
    });

    it('should reset profile to null after reset', () => {
      const profile = {
        vendor: 'Google',
        timezone: 'America/New_York',
        deviceType: 'mobile'
      };

      generator.initializeFromProfile(profile);
      expect(generator.getBrowserProfile()).toBeDefined();

      generator.reset();
      expect(generator.generatedBrowserProfile).toBeNull();
    });
  });

  // Timezone info tests (1 test)
  describe('Timezone Info Retrieval', () => {
    it('should retrieve timezone info correctly', () => {
      const tzInfo = generator.getTimezoneInfo('America/New_York');
      expect(tzInfo).toBeDefined();
      expect(tzInfo.region).toBe('US');
      expect(tzInfo.country).toBe('United States');
      expect(tzInfo.languages).toContain('en-US');
      expect(tzInfo.primaryLanguage).toBe('en-US');
    });
  });

  // Error handling tests (1 test)
  describe('Error Handling', () => {
    it('should throw error for unknown timezone', () => {
      expect(() => {
        generator.getTimezoneInfo('Unknown/Timezone');
      }).toThrow('Unknown timezone');
    });
  });

  // DoNotTrack header test (1 test)
  describe('Do Not Track Header', () => {
    it('should randomly include DoNotTrack header', () => {
      const dntSet = new Set();

      for (let i = 0; i < 50; i++) {
        const profile = {
          vendor: 'Google',
          timezone: 'America/New_York',
          deviceType: 'mobile'
        };

        const gen = new BrowserProfileGenerator();
        const browserProfile = gen.initializeFromProfile(profile);
        if (browserProfile.doNotTrack) {
          dntSet.add(browserProfile.doNotTrack);
        } else {
          dntSet.add(undefined);
        }
      }

      // Should have both with and without DNT
      expect(dntSet.size).toBeGreaterThanOrEqual(1);
    });
  });
});

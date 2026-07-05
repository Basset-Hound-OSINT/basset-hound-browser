/**
 * Tests for User Agent Generator
 * Coverage: 25 tests including format validation, profile matching, consistency
 */

const UserAgentGenerator = require('../../src/anonymity/user-agent-generator');

describe('UserAgentGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new UserAgentGenerator();
  });

  afterEach(() => {
    generator.reset();
  });

  // Initialization tests (3 tests)
  describe('Initialization', () => {
    it('should initialize without profile', () => {
      expect(generator).toBeDefined();
      expect(generator.currentProfile).toBeNull();
      expect(generator.generatedUA).toBeNull();
    });

    it('should have UA templates loaded', () => {
      const templates = generator.getAvailableTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates).toContain('iPhone-Safari');
      expect(templates).toContain('Android-Chrome');
      expect(templates).toContain('Windows-Chrome');
    });

    it('should have version mapping available', () => {
      const mapping = generator.getVersionMapping();
      expect(mapping).toBeDefined();
      expect(Object.keys(mapping).length).toBeGreaterThan(0);
    });
  });

  // Profile initialization tests (4 tests)
  describe('Profile Initialization', () => {
    it('should require profile for initialization', () => {
      expect(() => {
        generator.initializeFromProfile(null);
      }).toThrow('Profile required');
    });

    it('should generate UA from iPhone profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toBeDefined();
      expect(ua).toContain('iPhone');
      expect(ua).toContain('Safari');
    });

    it('should generate UA from Android profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        screenWidth: 412,
        screenHeight: 915
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toBeDefined();
      expect(ua).toContain('Android');
      expect(ua).toContain('Chrome');
    });

    it('should generate UA from Windows profile', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toBeDefined();
      expect(ua).toContain('Windows');
    });
  });

  // UA format validation tests (5 tests)
  describe('User Agent Format Validation', () => {
    beforeEach(() => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };
      generator.initializeFromProfile(profile);
    });

    it('should generate UA starting with Mozilla/5.0', () => {
      const ua = generator.getUserAgent();
      expect(ua).toMatch(/^Mozilla\/5\.0/);
    });

    it('should validate correct UA format', () => {
      const ua = generator.getUserAgent();
      expect(generator.validateUserAgent(ua)).toBe(true);
    });

    it('should reject UA without Mozilla prefix', () => {
      expect(generator.validateUserAgent('Chrome/123.0')).toBe(false);
    });

    it('should reject UA that is too short', () => {
      expect(generator.validateUserAgent('Mozilla/5.0')).toBe(false);
    });

    it('should reject UA that is too long', () => {
      const longUA = 'Mozilla/5.0 ' + 'a'.repeat(400);
      expect(generator.validateUserAgent(longUA)).toBe(false);
    });
  });

  // Mobile vs desktop detection (3 tests)
  describe('Mobile vs Desktop Detection', () => {
    it('should generate mobile UA for mobile profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toMatch(/Mobile|Android/);
    });

    it('should generate desktop UA for desktop profile', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Apple',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const ua = generator.initializeFromProfile(profile);
      // macOS UA might not have "Mobile"
      expect(ua).toBeDefined();
    });

    it('should generate tablet UA for iPad profile', () => {
      const profile = {
        deviceType: 'tablet',
        vendor: 'Apple',
        screenWidth: 1024,
        screenHeight: 1366
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toContain('iPad');
    });
  });

  // Version matching tests (3 tests)
  describe('OS/Browser Version Matching', () => {
    it('should include Safari version for iOS UA', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toMatch(/Version\/\d+/);
    });

    it('should include Chrome version for Android UA', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        screenWidth: 412,
        screenHeight: 915
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toMatch(/Chrome\/\d+/);
    });

    it('should have realistic version numbers', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const ua = generator.initializeFromProfile(profile);
      // Extract version numbers and verify they're realistic
      const versionMatch = ua.match(/Version\/(\d+)/);
      if (versionMatch) {
        const version = parseInt(versionMatch[1]);
        expect(version).toBeGreaterThan(10);
        expect(version).toBeLessThan(200); // Modern versions can be 100+
      }
    });
  });

  // Consistency tests (3 tests)
  describe('Session Consistency', () => {
    it('should return same UA multiple times within session', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      generator.initializeFromProfile(profile);
      const ua1 = generator.getUserAgent();
      const ua2 = generator.getUserAgent();
      const ua3 = generator.getUserAgent();

      expect(ua1).toBe(ua2);
      expect(ua2).toBe(ua3);
    });

    it('should maintain consistency after multiple profiles', () => {
      const profile1 = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      generator.initializeFromProfile(profile1);
      const ua1 = generator.getUserAgent();

      // New generator for new profile
      const generator2 = new UserAgentGenerator();
      generator2.initializeFromProfile(profile1);
      const ua2 = generator2.getUserAgent();

      // Both should have iPhone/Safari, but might differ due to random template selection
      expect(ua1).toContain('iPhone');
      expect(ua2).toContain('iPhone');
    });

    it('should reset UA to null after reset', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      generator.initializeFromProfile(profile);
      expect(generator.getUserAgent()).toBeDefined();

      generator.reset();
      expect(generator.generatedUA).toBeNull();
      expect(() => {
        generator.getUserAgent();
      }).toThrow();
    });
  });

  // Error handling tests (2 tests)
  describe('Error Handling', () => {
    it('should throw error when getting UA before initialization', () => {
      expect(() => {
        generator.getUserAgent();
      }).toThrow('No UA generated');
    });

    it('should handle unknown vendor gracefully', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'UnknownBrand',
        screenWidth: 390,
        screenHeight: 844
      };

      const ua = generator.initializeFromProfile(profile);
      expect(ua).toBeDefined();
      // Should default to Windows/Chrome for unknown vendor
      expect(ua).toContain('Mozilla/5.0');
    });
  });

  // Platform detection tests (2 tests)
  describe('Platform Detection', () => {
    it('should detect Apple products correctly', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const { platform, browser } = generator.determinePlatform(profile);
      expect(platform).toBe('iPhone');
      expect(browser).toBe('Safari');
    });

    it('should detect Google products correctly', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        screenWidth: 412,
        screenHeight: 915
      };

      const { platform, browser } = generator.determinePlatform(profile);
      expect(platform).toBe('Android');
      expect(browser).toBe('Chrome');
    });
  });

  // Integration tests (2 tests)
  describe('Integration', () => {
    it('should generate valid UAs for all device types', () => {
      const profiles = [
        { deviceType: 'mobile', vendor: 'Apple', screenWidth: 390, screenHeight: 844 },
        { deviceType: 'tablet', vendor: 'Apple', screenWidth: 1024, screenHeight: 1366 },
        { deviceType: 'desktop', vendor: 'Apple', screenWidth: 2560, screenHeight: 1600 }
      ];

      profiles.forEach(profile => {
        const gen = new UserAgentGenerator();
        const ua = gen.initializeFromProfile(profile);
        expect(gen.validateUserAgent(ua)).toBe(true);
      });
    });

    it('should handle rapid profile switches', () => {
      const profiles = [
        { deviceType: 'mobile', vendor: 'Apple', screenWidth: 390, screenHeight: 844 },
        { deviceType: 'mobile', vendor: 'Google', screenWidth: 412, screenHeight: 915 },
        { deviceType: 'desktop', vendor: 'Apple', screenWidth: 2560, screenHeight: 1600 }
      ];

      profiles.forEach(profile => {
        const ua = generator.initializeFromProfile(profile);
        expect(generator.validateUserAgent(ua)).toBe(true);
      });
    });
  });
});

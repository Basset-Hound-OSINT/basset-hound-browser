/**
 * Tests for Screen Resolution Generator
 * Coverage: 20 tests including real device resolutions, aspect ratio validation
 */

const ScreenResolutionGenerator = require('../../src/anonymity/screen-resolution-generator');

describe('ScreenResolutionGenerator', () => {
  let generator;

  beforeEach(() => {
    generator = new ScreenResolutionGenerator();
  });

  afterEach(() => {
    generator.reset();
  });

  // Initialization tests (3 tests)
  describe('Initialization', () => {
    it('should initialize without profile', () => {
      expect(generator).toBeDefined();
      expect(generator.currentProfile).toBeNull();
      expect(generator.generatedResolution).toBeNull();
    });

    it('should have resolution database loaded', () => {
      const categories = generator.getAvailableCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('iPhone');
      expect(categories).toContain('Windows');
      expect(categories).toContain('MacBook');
    });

    it('should have multiple resolutions per category', () => {
      const categories = generator.getAvailableCategories();
      categories.forEach(category => {
        const resolutions = generator.getRandomResolution(category);
        expect(resolutions).toBeDefined();
        expect(resolutions.width).toBeGreaterThan(0);
        expect(resolutions.height).toBeGreaterThan(0);
      });
    });
  });

  // Profile initialization tests (3 tests)
  describe('Profile Initialization', () => {
    it('should require profile for initialization', () => {
      expect(() => {
        generator.initializeFromProfile(null);
      }).toThrow('Profile required');
    });

    it('should generate resolution from iPhone profile', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution).toBeDefined();
      expect(resolution.width).toBeGreaterThan(0);
      expect(resolution.height).toBeGreaterThan(0);
      expect(resolution.dpi).toBeGreaterThan(0);
    });

    it('should generate resolution from Windows profile', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution).toBeDefined();
      expect(resolution.width).toBeGreaterThanOrEqual(1024);
      expect(resolution.dpi).toBeLessThanOrEqual(1.5);
    });
  });

  // Real device resolution tests (3 tests)
  describe('Real Device Resolutions', () => {
    it('should generate real iPhone resolutions', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const resolution = generator.initializeFromProfile(profile);
      // All iPhone resolutions (logical and native pixels)
      const realiPhoneResolutions = [390, 430, 393, 375, 1170, 1284];
      expect(realiPhoneResolutions).toContain(resolution.width);
    });

    it('should generate real Samsung resolutions', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Google',
        screenWidth: 412,
        screenHeight: 915
      };

      const resolution = generator.initializeFromProfile(profile);
      // Android can generate either Samsung or Pixel resolutions
      const androidWidths = [412, 360, 384, 400, 540, 411, 480];
      expect(androidWidths).toContain(resolution.width);
    });

    it('should generate real Windows resolutions', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const resolution = generator.initializeFromProfile(profile);
      const realWindowsWidths = [1920, 2560, 3840, 1366, 1024];
      expect(realWindowsWidths).toContain(resolution.width);
    });
  });

  // Aspect ratio validation tests (3 tests)
  describe('Aspect Ratio Validation', () => {
    it('should calculate correct aspect ratios', () => {
      expect(generator.calculateAspectRatio(1920, 1080)).toBe('16:9');
      expect(generator.calculateAspectRatio(2560, 1440)).toBe('16:9');
      expect(generator.calculateAspectRatio(1024, 768)).toBe('4:3');
      expect(generator.calculateAspectRatio(390, 844)).toBe('195:422'); // iPhone
    });

    it('should validate realistic mobile aspect ratios', () => {
      // Mobile phones are typically 9:16 to 9:20 (portrait)
      expect(generator.validateAspectRatio(390, 844, 'mobile')).toBe(true);
      expect(generator.validateAspectRatio(412, 915, 'mobile')).toBe(true);
      expect(generator.validateAspectRatio(1170, 2532, 'mobile')).toBe(true);
    });

    it('should validate realistic desktop aspect ratios', () => {
      // Desktops are typically 16:9, 16:10, or 4:3
      expect(generator.validateAspectRatio(1920, 1080, 'desktop')).toBe(true);
      expect(generator.validateAspectRatio(2560, 1440, 'desktop')).toBe(true);
      expect(generator.validateAspectRatio(3840, 2160, 'desktop')).toBe(true);
    });

    it('should reject unrealistic aspect ratios', () => {
      // Extremely wide screens (not realistic)
      expect(generator.validateAspectRatio(5000, 100, 'desktop')).toBe(false);
      // Extremely tall phones (not realistic)
      expect(generator.validateAspectRatio(100, 5000, 'mobile')).toBe(false);
    });
  });

  // DPI matching tests (2 tests)
  describe('DPI Matching', () => {
    it('should assign realistic DPIs', () => {
      const validDPIs = [1.0, 1.5, 2.0, 2.5, 2.75, 3.0];
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      for (let i = 0; i < 10; i++) {
        const resolution = new ScreenResolutionGenerator().initializeFromProfile(profile);
        expect(validDPIs).toContain(resolution.dpi);
      }
    });

    it('should assign 2.0+ DPI for mobile devices', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution.dpi).toBeGreaterThanOrEqual(2.0);
    });

    it('should assign 1.0 DPI for desktop devices', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution.dpi).toBe(1.0);
    });
  });

  // Resolution validation tests (2 tests)
  describe('Resolution Validation', () => {
    it('should validate realistic resolutions', () => {
      const validResolutions = [
        { width: 390, height: 844, dpi: 2.0 },
        { width: 1920, height: 1080, dpi: 1.0 },
        { width: 2560, height: 1440, dpi: 2.0 }
      ];

      validResolutions.forEach(res => {
        expect(generator.validateResolution(res)).toBe(true);
      });
    });

    it('should reject invalid resolutions', () => {
      const invalidResolutions = [
        { width: 0, height: 800, dpi: 1.0 }, // Width 0
        { width: 1920, height: 0, dpi: 1.0 }, // Height 0
        { width: 1920, height: 1080, dpi: 0.5 }, // Invalid DPI
        { width: 100, height: 100, dpi: 1.0 }, // Too small
        { width: 10000, height: 10000, dpi: 1.0 } // Too large
      ];

      invalidResolutions.forEach(res => {
        expect(generator.validateResolution(res)).toBe(false);
      });
    });
  });

  // Consistency tests (2 tests)
  describe('Session Consistency', () => {
    it('should return same resolution multiple times within session', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      generator.initializeFromProfile(profile);
      const res1 = generator.getResolution();
      const res2 = generator.getResolution();
      const res3 = generator.getResolution();

      expect(res1.width).toBe(res2.width);
      expect(res2.width).toBe(res3.width);
      expect(res1.height).toBe(res2.height);
      expect(res1.dpi).toBe(res2.dpi);
    });

    it('should reset resolution to null after reset', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      generator.initializeFromProfile(profile);
      expect(generator.getResolution()).toBeDefined();

      generator.reset();
      expect(generator.generatedResolution).toBeNull();
    });
  });

  // Available width/height calculation tests (2 tests)
  describe('Available Dimensions', () => {
    it('should calculate available width same as screen width', () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution.availWidth).toBe(resolution.width);
    });

    it('should account for taskbar on desktop', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const resolution = generator.initializeFromProfile(profile);
      expect(resolution.availHeight).toBe(resolution.height - 40);
    });
  });

  // Color depth tests (1 test)
  describe('Color Depth', () => {
    it('should always set color depth to 24 or 32', () => {
      const profile = {
        deviceType: 'desktop',
        vendor: 'Google',
        screenWidth: 1920,
        screenHeight: 1080
      };

      const resolution = generator.initializeFromProfile(profile);
      expect([24, 32]).toContain(resolution.colorDepth);
      expect([24, 32]).toContain(resolution.pixelDepth);
    });
  });

  // Error handling tests (1 test)
  describe('Error Handling', () => {
    it('should throw error for unknown category', () => {
      expect(() => {
        generator.getRandomResolution('UnknownCategory');
      }).toThrow('Unknown category');
    });
  });

  // Device type coverage tests (1 test)
  describe('Device Type Coverage', () => {
    it('should generate resolutions for all device types', () => {
      const deviceTypes = [
        { deviceType: 'mobile', vendor: 'Apple' },
        { deviceType: 'tablet', vendor: 'Apple' },
        { deviceType: 'desktop', vendor: 'Google' }
      ];

      deviceTypes.forEach(profile => {
        const res = generator.initializeFromProfile(profile);
        expect(res).toBeDefined();
        expect(res.width).toBeGreaterThan(0);
        expect(res.height).toBeGreaterThan(0);
      });
    });
  });
});

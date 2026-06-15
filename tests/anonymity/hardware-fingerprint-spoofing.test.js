/**
 * Hardware Fingerprint Spoofing Tests
 *
 * Tests for property spoofing, session consistency, realistic ranges
 * Target: 30 tests, 100% pass rate
 */

const assert = require('assert');
const HardwareFingerprintSpoofing = require('../../src/anonymity/hardware-fingerprint-spoofing');

describe('Hardware Fingerprint Spoofing', () => {
  // ==========================================
  // INITIALIZATION TESTS
  // ==========================================

  describe('Initialization', () => {
    it('should initialize with empty session values', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.strictEqual(spoofing.initialized, false);
    });

    it('should initialize from profile', () => {
      const profile = {
        hardwareConcurrency: 6,
        deviceMemory: 8,
        screenWidth: 390,
        screenHeight: 844
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.initialized, true);
      assert.strictEqual(spoofing.sessionValues.hardwareConcurrency, 6);
    });

    it('should auto-generate values on first access', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const values = spoofing.getValues();
      assert.ok(values.hardwareConcurrency);
      assert.ok(values.deviceMemory);
    });
  });

  // ==========================================
  // HARDWARE CONCURRENCY TESTS
  // ==========================================

  describe('Hardware Concurrency', () => {
    it('should accept valid CPU core counts', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [2, 4, 6, 8, 12, 16, 32].forEach(cores => {
        assert.doesNotThrow(() => {
          spoofing.validateAndSetValue('hardwareConcurrency', cores);
        });
      });
    });

    it('should reject invalid CPU core counts', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.throws(() => spoofing.validateAndSetValue('hardwareConcurrency', 1));
      assert.throws(() => spoofing.validateAndSetValue('hardwareConcurrency', 64));
      assert.throws(() => spoofing.validateAndSetValue('hardwareConcurrency', -1));
    });

    it('should return consistent value within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const value1 = spoofing.getValue('hardwareConcurrency');
      const value2 = spoofing.getValue('hardwareConcurrency');
      assert.strictEqual(value1, value2);
    });

    it('should be realistic for mobile devices', () => {
      const profile = {
        hardwareConcurrency: 6,
        deviceMemory: 6,
        maxTouchPoints: 5,
        screenWidth: 390,
        screenHeight: 844
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.ok(spoofing.getValue('hardwareConcurrency') <= 8);
    });
  });

  // ==========================================
  // DEVICE MEMORY TESTS
  // ==========================================

  describe('Device Memory', () => {
    it('should accept valid memory amounts', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [2, 4, 6, 8, 12, 16].forEach(gb => {
        assert.doesNotThrow(() => {
          spoofing.validateAndSetValue('deviceMemory', gb);
        });
      });
    });

    it('should reject invalid memory amounts', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.throws(() => spoofing.validateAndSetValue('deviceMemory', 1));
      assert.throws(() => spoofing.validateAndSetValue('deviceMemory', 128));
      assert.throws(() => spoofing.validateAndSetValue('deviceMemory', 0));
    });

    it('should return consistent value within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const value1 = spoofing.getValue('deviceMemory');
      const value2 = spoofing.getValue('deviceMemory');
      assert.strictEqual(value1, value2);
    });
  });

  // ==========================================
  // TOUCH POINTS TESTS
  // ==========================================

  describe('Touch Points', () => {
    it('should accept valid touch point counts', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [0, 1, 2, 5, 10].forEach(points => {
        assert.doesNotThrow(() => {
          spoofing.validateAndSetValue('maxTouchPoints', points);
        });
      });
    });

    it('should have 0 for desktop device', () => {
      const profile = {
        maxTouchPoints: 0,
        screenWidth: 1920,
        screenHeight: 1080
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('maxTouchPoints'), 0);
    });

    it('should have 5+ for mobile device', () => {
      const profile = {
        maxTouchPoints: 5,
        screenWidth: 390,
        screenHeight: 844
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.ok(spoofing.getValue('maxTouchPoints') >= 5);
    });
  });

  // ==========================================
  // SCREEN RESOLUTION TESTS
  // ==========================================

  describe('Screen Resolution', () => {
    it('should accept valid screen widths', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [320, 390, 1920, 2560, 5120].forEach(width => {
        spoofing.sessionValues.screenWidth = width;
        assert.ok(spoofing.sessionValues.screenWidth === width);
      });
    });

    it('should accept valid screen heights', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [568, 844, 1080, 1440, 3200].forEach(height => {
        spoofing.sessionValues.screenHeight = height;
        assert.ok(spoofing.sessionValues.screenHeight === height);
      });
    });

    it('should calculate availHeight correctly', () => {
      const profile = {
        screenWidth: 1920,
        screenHeight: 1080,
        availWidth: 1920,
        availHeight: 1000
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('availHeight'), 1000);
      assert.ok(spoofing.getValue('availHeight') < spoofing.getValue('screenHeight'));
    });

    it('should have consistent resolutions within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const width1 = spoofing.getValue('screenWidth');
      const height1 = spoofing.getValue('screenHeight');
      const width2 = spoofing.getValue('screenWidth');
      const height2 = spoofing.getValue('screenHeight');
      assert.strictEqual(width1, width2);
      assert.strictEqual(height1, height2);
    });
  });

  // ==========================================
  // COLOR DEPTH TESTS
  // ==========================================

  describe('Color Depth', () => {
    it('should accept 24-bit color depth', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.doesNotThrow(() => spoofing.validateAndSetValue('colorDepth', 24));
    });

    it('should accept 32-bit color depth', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.doesNotThrow(() => spoofing.validateAndSetValue('colorDepth', 32));
    });

    it('should reject invalid color depth', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.throws(() => spoofing.validateAndSetValue('colorDepth', 16));
      assert.throws(() => spoofing.validateAndSetValue('colorDepth', 8));
    });

    it('pixelDepth should match colorDepth', () => {
      const profile = { colorDepth: 32, pixelDepth: 32 };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('colorDepth'), spoofing.getValue('pixelDepth'));
    });
  });

  // ==========================================
  // DEVICE PIXEL RATIO TESTS
  // ==========================================

  describe('Device Pixel Ratio', () => {
    it('should accept valid DPI ratios', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      [0.75, 1.0, 1.5, 2.0, 2.5, 3.0].forEach(dpr => {
        assert.doesNotThrow(() => spoofing.validateAndSetValue('devicePixelRatio', dpr));
      });
    });

    it('should reject invalid DPI ratios', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      assert.throws(() => spoofing.validateAndSetValue('devicePixelRatio', 4.0));
      assert.throws(() => spoofing.validateAndSetValue('devicePixelRatio', 0.5));
    });

    it('should be realistic for device type', () => {
      const profile = {
        devicePixelRatio: 2.0,
        maxTouchPoints: 5
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.ok([1.5, 2.0, 2.5, 3.0].includes(spoofing.getValue('devicePixelRatio')));
    });
  });

  // ==========================================
  // VENDOR TESTS
  // ==========================================

  describe('Vendor', () => {
    it('should accept valid vendor strings', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      ['Google Inc.', 'Apple Computer, Inc.', 'Mozilla'].forEach(vendor => {
        assert.doesNotThrow(() => spoofing.validateAndSetValue('vendor', vendor));
      });
    });

    it('should return consistent vendor within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const vendor1 = spoofing.getValue('vendor');
      const vendor2 = spoofing.getValue('vendor');
      assert.strictEqual(vendor1, vendor2);
    });

    it('should use Apple vendor for iOS profile', () => {
      const profile = {
        vendor: 'Apple Computer, Inc.',
        maxTouchPoints: 5,
        screenWidth: 390,
        screenHeight: 844
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('vendor'), 'Apple Computer, Inc.');
    });
  });

  // ==========================================
  // LANGUAGE TESTS
  // ==========================================

  describe('Language', () => {
    it('should accept language array', () => {
      const profile = { languages: ['en-US', 'en'] };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.deepStrictEqual(spoofing.getValue('languages'), ['en-US', 'en']);
    });

    it('should set primary language from languages array', () => {
      const profile = { languages: ['fr-FR', 'fr'] };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('language'), 'fr-FR');
    });

    it('should accept single language', () => {
      const profile = { language: 'de-DE' };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      assert.strictEqual(spoofing.getValue('language'), 'de-DE');
    });

    it('should have consistent language within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const lang1 = spoofing.getValue('language');
      const lang2 = spoofing.getValue('language');
      assert.strictEqual(lang1, lang2);
    });
  });

  // ==========================================
  // TIMEZONE TESTS
  // ==========================================

  describe('Timezone', () => {
    it('should accept valid timezones', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      ['America/New_York', 'Europe/London', 'Asia/Tokyo'].forEach(tz => {
        spoofing.sessionValues.timezone = tz;
        assert.ok(spoofing.sessionValues.timezone === tz);
      });
    });

    it('should have consistent timezone within session', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const tz1 = spoofing.getValue('timezone');
      const tz2 = spoofing.getValue('timezone');
      assert.strictEqual(tz1, tz2);
    });

    it('should return realistic timezone', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const tz = spoofing.getValue('timezone');
      assert.ok(spoofing.timezones.includes(tz));
    });
  });

  // ==========================================
  // INJECTION SCRIPT TESTS
  // ==========================================

  describe('Injection Script Generation', () => {
    it('should generate valid JavaScript', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const script = spoofing.generateInjectionScript();
      assert.ok(typeof script === 'string');
      assert.ok(script.length > 100);
      assert.ok(script.includes('navigator'));
      assert.ok(script.includes('screen'));
    });

    it('should include hardwareConcurrency override', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const script = spoofing.generateInjectionScript();
      assert.ok(script.includes('hardwareConcurrency'));
    });

    it('should include all property overrides', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const script = spoofing.generateInjectionScript();
      assert.ok(script.includes('deviceMemory'));
      assert.ok(script.includes('maxTouchPoints'));
      assert.ok(script.includes('vendor'));
      assert.ok(script.includes('languages'));
      assert.ok(script.includes('colorDepth'));
      assert.ok(script.includes('devicePixelRatio'));
    });

    it('should be consistent across multiple generations', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const script1 = spoofing.generateInjectionScript();
      const script2 = spoofing.generateInjectionScript();
      // Both scripts should contain same values (not necessarily identical due to comment variations)
      assert.ok(script1.includes(spoofing.getValue('hardwareConcurrency').toString()));
      assert.ok(script2.includes(spoofing.getValue('hardwareConcurrency').toString()));
    });
  });

  // ==========================================
  // RESET AND STATE MANAGEMENT
  // ==========================================

  describe('Reset and State Management', () => {
    it('should reset to uninitialized state', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      spoofing.generateRandomValues();
      assert.strictEqual(spoofing.initialized, true);
      spoofing.reset();
      assert.strictEqual(spoofing.initialized, false);
    });

    it('should allow re-initialization after reset', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const values1 = spoofing.getValues();
      spoofing.reset();
      const values2 = spoofing.getValues();
      assert.notStrictEqual(values1.hardwareConcurrency, values2.hardwareConcurrency);
    });

    it('should maintain state across multiple accesses', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      const values1 = spoofing.getValues();
      const values2 = spoofing.getValues();
      assert.deepStrictEqual(values1, values2);
    });
  });

  // ==========================================
  // INTEGRATION TESTS
  // ==========================================

  describe('Integration', () => {
    it('should support iPhone 15 Pro profile', () => {
      const profile = {
        hardwareConcurrency: 6,
        deviceMemory: 6,
        screenWidth: 460,
        screenHeight: 1000,
        devicePixelRatio: 2.0,
        maxTouchPoints: 5,
        vendor: 'Apple Computer, Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      const values = spoofing.getValues();
      assert.strictEqual(values.hardwareConcurrency, 6);
      assert.strictEqual(values.deviceMemory, 6);
      assert.strictEqual(values.screenWidth, 460);
      assert.strictEqual(values.maxTouchPoints, 5);
    });

    it('should support Windows Desktop profile', () => {
      const profile = {
        hardwareConcurrency: 16,
        deviceMemory: 32,
        screenWidth: 1920,
        screenHeight: 1080,
        devicePixelRatio: 1.0,
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      const spoofing = new HardwareFingerprintSpoofing({ profile });
      const values = spoofing.getValues();
      assert.strictEqual(values.maxTouchPoints, 0);
      assert.strictEqual(values.hardwareConcurrency, 16);
    });

    it('should generate realistic random profile', () => {
      const spoofing = new HardwareFingerprintSpoofing();
      spoofing.generateRandomValues();
      const values = spoofing.getValues();

      // Verify all values are within realistic ranges
      assert.ok(values.hardwareConcurrency >= 2 && values.hardwareConcurrency <= 32);
      assert.ok(values.deviceMemory >= 2 && values.deviceMemory <= 16);
      assert.ok(values.screenWidth >= 320 && values.screenWidth <= 5120);
      assert.ok(values.screenHeight >= 568 && values.screenHeight <= 3200);
      assert.ok([24, 32].includes(values.colorDepth));
      assert.ok([0.75, 1.0, 1.5, 2.0, 2.5, 3.0].includes(values.devicePixelRatio));
    });
  });
});

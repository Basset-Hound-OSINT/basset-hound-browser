/**
 * Device Identity Generator Tests
 *
 * Tests for profile management, validation, import/export
 * Target: 30 tests, 100% pass rate
 */

const assert = require('assert');
const DeviceIdentityGenerator = require('../../src/anonymity/device-identity-generator');

describe('Device Identity Generator', () => {
  // ==========================================
  // INITIALIZATION TESTS
  // ==========================================

  describe('Initialization', () => {
    it('should initialize with built-in profiles', () => {
      const generator = new DeviceIdentityGenerator();
      assert.ok(generator.profiles.size > 0);
    });

    it('should have iPhone 15 Pro profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getProfile('iPhone 15 Pro');
      assert.strictEqual(profile.name, 'iPhone 15 Pro');
      assert.strictEqual(profile.hardwareConcurrency, 6);
    });

    it('should have MacBook Air M2 profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getProfile('MacBook Air M2');
      assert.strictEqual(profile.name, 'MacBook Air M2');
      assert.strictEqual(profile.hardwareConcurrency, 8);
    });

    it('should have Android profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getProfile('Samsung Galaxy S24');
      assert.strictEqual(profile.deviceType, 'mobile');
      assert.strictEqual(profile.hardwareConcurrency, 8);
    });
  });

  // ==========================================
  // PROFILE RETRIEVAL TESTS
  // ==========================================

  describe('Profile Retrieval', () => {
    it('should get profile by name', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getProfile('iPhone 15');
      assert.strictEqual(profile.name, 'iPhone 15');
    });

    it('should throw for non-existent profile', () => {
      const generator = new DeviceIdentityGenerator();
      assert.throws(() => generator.getProfile('NonExistent'));
    });

    it('should return copy of profile (not reference)', () => {
      const generator = new DeviceIdentityGenerator();
      const profile1 = generator.getProfile('iPhone 15');
      const profile2 = generator.getProfile('iPhone 15');
      profile1.hardwareConcurrency = 999;
      assert.notStrictEqual(profile1.hardwareConcurrency, profile2.hardwareConcurrency);
    });

    it('should list all profile names', () => {
      const generator = new DeviceIdentityGenerator();
      const profiles = generator.listProfiles();
      assert.ok(profiles.length > 0);
      assert.ok(profiles.includes('iPhone 15 Pro'));
      assert.ok(profiles.includes('Windows Desktop (High-end)'));
    });
  });

  // ==========================================
  // PROFILE VALIDATION TESTS
  // ==========================================

  describe('Profile Validation', () => {
    it('should accept valid profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Test Device',
        deviceType: 'mobile',
        hardwareConcurrency: 8,
        deviceMemory: 12,
        screenWidth: 412,
        screenHeight: 915,
        availWidth: 412,
        availHeight: 895,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2.0,
        maxTouchPoints: 5,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      assert.ok(generator.validateProfile(profile));
    });

    it('should reject profile missing required fields', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Invalid'
        // missing other fields
      };
      assert.strictEqual(generator.validateProfile(profile), false);
    });

    it('should reject invalid hardwareConcurrency', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Test',
        deviceType: 'desktop',
        hardwareConcurrency: 1, // Too low
        deviceMemory: 16,
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 1.0,
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'UTC'
      };
      assert.strictEqual(generator.validateProfile(profile), false);
    });

    it('should reject invalid deviceMemory', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Test',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
        deviceMemory: 100, // Too high
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 1.0,
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'UTC'
      };
      assert.strictEqual(generator.validateProfile(profile), false);
    });

    it('should reject invalid colorDepth', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Test',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
        deviceMemory: 16,
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 16, // Invalid
        pixelDepth: 16,
        devicePixelRatio: 1.0,
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'UTC'
      };
      assert.strictEqual(generator.validateProfile(profile), false);
    });

    it('should reject invalid devicePixelRatio', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = {
        name: 'Test',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
        deviceMemory: 16,
        screenWidth: 1920,
        screenHeight: 1080,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 4.0, // Invalid
        maxTouchPoints: 0,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'UTC'
      };
      assert.strictEqual(generator.validateProfile(profile), false);
    });
  });

  // ==========================================
  // CUSTOM PROFILE TESTS
  // ==========================================

  describe('Custom Profiles', () => {
    it('should create custom profile', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'My Custom Device',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
        screenWidth: 400,
        screenHeight: 800,
        availWidth: 400,
        availHeight: 780,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2.0,
        maxTouchPoints: 5,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      generator.createCustomProfile('My Custom Device', config);
      assert.ok(generator.customProfiles.has('My Custom Device'));
    });

    it('should reject duplicate profile name', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'Duplicate',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
        deviceMemory: 16,
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
        timezone: 'UTC'
      };
      generator.createCustomProfile('Duplicate', config);
      assert.throws(() => generator.createCustomProfile('Duplicate', config));
    });

    it('should reject invalid custom profile', () => {
      const generator = new DeviceIdentityGenerator();
      const invalidConfig = {
        name: 'Invalid'
        // Missing required fields
      };
      assert.throws(() => generator.createCustomProfile('Invalid', invalidConfig));
    });

    it('should delete custom profile', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'Deletable',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
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
      };
      generator.createCustomProfile('Deletable', config);
      assert.ok(generator.customProfiles.has('Deletable'));
      generator.deleteCustomProfile('Deletable');
      assert.strictEqual(generator.customProfiles.has('Deletable'), false);
    });

    it('should prevent deletion of built-in profiles', () => {
      const generator = new DeviceIdentityGenerator();
      assert.throws(() => generator.deleteCustomProfile('iPhone 15 Pro'));
    });

    it('should track creation in history', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'Tracked',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
        deviceMemory: 16,
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
        timezone: 'UTC'
      };
      const initialHistory = generator.profileHistory.length;
      generator.createCustomProfile('Tracked', config);
      assert.ok(generator.profileHistory.length > initialHistory);
    });
  });

  // ==========================================
  // RANDOM PROFILE TESTS
  // ==========================================

  describe('Random Profile Selection', () => {
    it('should get random profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getRandomProfile();
      assert.ok(profile.name);
      assert.ok(profile.hardwareConcurrency);
    });

    it('should get random mobile profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getRandomProfile('mobile');
      assert.strictEqual(profile.deviceType, 'mobile');
    });

    it('should get random desktop profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getRandomProfile('desktop');
      assert.strictEqual(profile.deviceType, 'desktop');
    });

    it('should get random tablet profile', () => {
      const generator = new DeviceIdentityGenerator();
      const profile = generator.getRandomProfile('tablet');
      assert.strictEqual(profile.deviceType, 'tablet');
    });

    it('should throw for invalid device type', () => {
      const generator = new DeviceIdentityGenerator();
      assert.throws(() => generator.getRandomProfile('invalid'));
    });

    it('should return different profiles on multiple calls', () => {
      const generator = new DeviceIdentityGenerator();
      const profiles = new Set();
      for (let i = 0; i < 10; i++) {
        profiles.add(generator.getRandomProfile().name);
      }
      assert.ok(profiles.size > 1); // Should have variety
    });
  });

  // ==========================================
  // EXPORT/IMPORT TESTS
  // ==========================================

  describe('Export/Import', () => {
    it('should export profile as JSON', () => {
      const generator = new DeviceIdentityGenerator();
      const json = generator.exportProfile('iPhone 15');
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.name, 'iPhone 15');
      assert.strictEqual(parsed.hardwareConcurrency, 6);
    });

    it('should throw for non-existent profile export', () => {
      const generator = new DeviceIdentityGenerator();
      assert.throws(() => generator.exportProfile('NonExistent'));
    });

    it('should import profile from JSON', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'Imported',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
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
      };
      const json = JSON.stringify(config);
      generator.importProfile('Imported', json);
      const imported = generator.getProfile('Imported');
      assert.strictEqual(imported.name, 'Imported');
    });

    it('should reject invalid JSON on import', () => {
      const generator = new DeviceIdentityGenerator();
      assert.throws(() => generator.importProfile('Invalid', 'not json'));
    });

    it('should reject invalid profile on import', () => {
      const generator = new DeviceIdentityGenerator();
      const json = JSON.stringify({ name: 'Invalid' });
      assert.throws(() => generator.importProfile('Invalid', json));
    });

    it('should round-trip profile through export/import', () => {
      const generator = new DeviceIdentityGenerator();
      const original = generator.getProfile('Samsung Galaxy S24');
      const json = generator.exportProfile('Samsung Galaxy S24');
      const parsed = JSON.parse(json);
      assert.strictEqual(parsed.deviceMemory, original.deviceMemory);
      assert.strictEqual(parsed.screenWidth, original.screenWidth);
    });
  });

  // ==========================================
  // STATISTICS TESTS
  // ==========================================

  describe('Statistics', () => {
    it('should get profile statistics', () => {
      const generator = new DeviceIdentityGenerator();
      const stats = generator.getStatistics();
      assert.ok(stats.total > 0);
      assert.ok(stats.builtIn > 0);
      assert.strictEqual(stats.custom, 0);
    });

    it('should track device types in statistics', () => {
      const generator = new DeviceIdentityGenerator();
      const stats = generator.getStatistics();
      assert.ok(stats.byDeviceType.mobile > 0);
      assert.ok(stats.byDeviceType.tablet > 0);
      assert.ok(stats.byDeviceType.desktop > 0);
    });

    it('should track vendors in statistics', () => {
      const generator = new DeviceIdentityGenerator();
      const stats = generator.getStatistics();
      assert.ok(Object.keys(stats.byVendor).length > 0);
    });

    it('should update statistics with custom profiles', () => {
      const generator = new DeviceIdentityGenerator();
      const stats1 = generator.getStatistics();
      const config = {
        name: 'StatTest',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
        screenWidth: 390,
        screenHeight: 844,
        availWidth: 390,
        availHeight: 824,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2.0,
        maxTouchPoints: 5,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      generator.createCustomProfile('StatTest', config);
      const stats2 = generator.getStatistics();
      assert.ok(stats2.custom > stats1.custom);
      assert.ok(stats2.total > stats1.total);
    });

    it('should track history', () => {
      const generator = new DeviceIdentityGenerator();
      const initialHistory = generator.profileHistory.length;
      const config = {
        name: 'HistTest',
        deviceType: 'desktop',
        hardwareConcurrency: 8,
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
      };
      generator.createCustomProfile('HistTest', config);
      generator.deleteCustomProfile('HistTest');
      const stats = generator.getStatistics();
      assert.ok(stats.history > initialHistory);
    });
  });

  // ==========================================
  // RESET TESTS
  // ==========================================

  describe('Reset', () => {
    it('should reset custom profiles', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'ToReset',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
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
      };
      generator.createCustomProfile('ToReset', config);
      assert.ok(generator.customProfiles.has('ToReset'));
      generator.reset();
      assert.strictEqual(generator.customProfiles.size, 0);
    });

    it('should preserve built-in profiles after reset', () => {
      const generator = new DeviceIdentityGenerator();
      generator.reset();
      assert.ok(generator.profiles.has('iPhone 15 Pro'));
      assert.ok(generator.profiles.has('Windows Desktop (High-end)'));
    });

    it('should clear history after reset', () => {
      const generator = new DeviceIdentityGenerator();
      const config = {
        name: 'HistoryClear',
        deviceType: 'mobile',
        hardwareConcurrency: 6,
        deviceMemory: 8,
        screenWidth: 390,
        screenHeight: 844,
        availWidth: 390,
        availHeight: 824,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2.0,
        maxTouchPoints: 5,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      };
      generator.createCustomProfile('HistoryClear', config);
      assert.ok(generator.profileHistory.length > 0);
      generator.reset();
      assert.strictEqual(generator.profileHistory.length, 0);
    });
  });

  // ==========================================
  // PROFILE COMPLETENESS TESTS
  // ==========================================

  describe('Built-in Profile Completeness', () => {
    it('all built-in profiles have required properties', () => {
      const generator = new DeviceIdentityGenerator();
      const requiredProps = [
        'name', 'deviceType', 'hardwareConcurrency', 'deviceMemory',
        'screenWidth', 'screenHeight', 'colorDepth', 'pixelDepth',
        'devicePixelRatio', 'maxTouchPoints', 'vendor', 'language', 'timezone'
      ];

      generator.profiles.forEach((profile, name) => {
        requiredProps.forEach(prop => {
          assert.ok(prop in profile, `Profile "${name}" missing ${prop}`);
        });
      });
    });

    it('should have at least 10 built-in profiles', () => {
      const generator = new DeviceIdentityGenerator();
      assert.ok(generator.profiles.size >= 10);
    });

    it('should have profiles for all device types', () => {
      const generator = new DeviceIdentityGenerator();
      const deviceTypes = new Set();
      generator.profiles.forEach(profile => {
        deviceTypes.add(profile.deviceType);
      });
      assert.ok(deviceTypes.has('mobile'));
      assert.ok(deviceTypes.has('tablet'));
      assert.ok(deviceTypes.has('desktop'));
    });
  });
});

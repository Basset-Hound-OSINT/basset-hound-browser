/**
 * Unit tests for DeviceFingerprinter module
 */

const DeviceFingerprinter = require('../../src/evasion/device-fingerprinter');

describe('DeviceFingerprinter', () => {
  let fingerprinter;

  beforeAll(() => {
    fingerprinter = new DeviceFingerprinter();
  });

  // ==================================================
  // Profile Retrieval Tests
  // ==================================================
  describe('Profile Retrieval', () => {
    test('should get profile by ID', () => {
      const profile = fingerprinter.getProfile('iphone-13-pro');

      expect(profile).toBeDefined();
      expect(profile.name).toBe('iPhone 13 Pro');
      expect(profile.deviceType).toBe('mobile');
    });

    test('should return null for non-existent profile', () => {
      const profile = fingerprinter.getProfile('non-existent');

      expect(profile).toBeNull();
    });

    test('should get current profile after application', async () => {
      await fingerprinter.applyFingerprint('iphone-13-pro');

      const current = fingerprinter.getCurrentProfile();
      expect(current).toBeDefined();
      expect(current.name).toBe('iPhone 13 Pro');
    });

    test('should return null when no profile applied', () => {
      const fresh = new DeviceFingerprinter();
      const current = fresh.getCurrentProfile();

      expect(current).toBeNull();
    });
  });

  // ==================================================
  // Random Profile Selection Tests
  // ==================================================
  describe('Random Profile Selection', () => {
    test('should get random profile', () => {
      const profile = fingerprinter.getRandomProfile();

      expect(profile).toBeDefined();
      expect(profile.id).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(profile.deviceType).toBeDefined();
    });

    test('should filter by OS', () => {
      const profile = fingerprinter.getRandomProfile({ os: 'iOS' });

      expect(profile).toBeDefined();
      expect(profile.os.name).toBe('iOS');
    });

    test('should filter by browser', () => {
      const profile = fingerprinter.getRandomProfile({ browser: 'Chrome' });

      expect(profile).toBeDefined();
      expect(profile.browser.name).toBe('Chrome');
    });

    test('should filter by device type', () => {
      const profile = fingerprinter.getRandomProfile({ deviceType: 'mobile' });

      expect(profile).toBeDefined();
      expect(profile.deviceType).toBe('mobile');
    });

    test('should return null for impossible filter', () => {
      const profile = fingerprinter.getRandomProfile({
        os: 'iOS',
        deviceType: 'desktop'
      });

      expect(profile).toBeNull();
    });

    test('should combine filters', () => {
      const profile = fingerprinter.getRandomProfile({
        os: 'Android',
        deviceType: 'mobile'
      });

      expect(profile).toBeDefined();
      expect(profile.os.name).toBe('Android');
      expect(profile.deviceType).toBe('mobile');
    });
  });

  // ==================================================
  // Fingerprint Application Tests
  // ==================================================
  describe('Fingerprint Application', () => {
    test('should apply fingerprint successfully', async () => {
      const fingerprint = await fingerprinter.applyFingerprint('iphone-13-pro');

      expect(fingerprint).toBeDefined();
      expect(fingerprint.userAgent).toBeDefined();
      expect(fingerprint.screen).toBeDefined();
      expect(fingerprint.navigator).toBeDefined();
      expect(fingerprint.webgl).toBeDefined();
    });

    test('should include screen properties', async () => {
      const fingerprint = await fingerprinter.applyFingerprint('iphone-13-pro');

      expect(fingerprint.screen.width).toBe(1170);
      expect(fingerprint.screen.height).toBe(2532);
      expect(fingerprint.screen.colorDepth).toBe(32);
      expect(fingerprint.screen.devicePixelRatio).toBe(3);
    });

    test('should include navigator properties', async () => {
      const fingerprint = await fingerprinter.applyFingerprint('iphone-13-pro');

      expect(fingerprint.navigator.timezone).toBe('America/Los_Angeles');
      expect(fingerprint.navigator.language).toBe('en-US');
      expect(fingerprint.navigator.hardwareConcurrency).toBe(6);
      expect(fingerprint.navigator.maxTouchPoints).toBe(5);
    });

    test('should include WebGL properties', async () => {
      const fingerprint = await fingerprinter.applyFingerprint('iphone-13-pro');

      expect(fingerprint.webgl.vendor).toBe('Apple');
      expect(fingerprint.webgl.renderer).toBe('Apple A15 Bionic');
    });

    test('should set webdriver to false', async () => {
      const fingerprint = await fingerprinter.applyFingerprint('iphone-13-pro');

      expect(fingerprint.navigator.webdriver).toBe(false);
    });

    test('should throw error for invalid profile', async () => {
      await expect(fingerprinter.applyFingerprint('invalid-profile'))
        .rejects
        .toThrow();
    });

    test('should randomize minor versions if requested', async () => {
      const fp1 = await fingerprinter.applyFingerprint('iphone-13-pro', true);
      const fp2 = await fingerprinter.applyFingerprint('iphone-13-pro', true);

      expect(fp1.userAgent).toBeDefined();
      expect(fp2.userAgent).toBeDefined();
      // UserAgent should be modified (possibly different due to patch version randomization)
      expect(typeof fp1.userAgent).toBe('string');
    });
  });

  // ==================================================
  // Randomize Device Tests
  // ==================================================
  describe('Randomize Device', () => {
    test('should randomize device with fingerprint', async () => {
      const fingerprint = await fingerprinter.randomizeDevice();

      expect(fingerprint).toBeDefined();
      expect(fingerprint.userAgent).toBeDefined();
      expect(fingerprint.screen).toBeDefined();
    });

    test('should randomize with filter constraints', async () => {
      const fingerprint = await fingerprinter.randomizeDevice({ deviceType: 'desktop' });

      expect(fingerprint).toBeDefined();
      expect(fingerprinter.currentProfileId).toBeDefined();
      const profile = fingerprinter.getCurrentProfile();
      expect(profile.deviceType).toBe('desktop');
    });

    test('should throw error when no profiles match filter', async () => {
      await expect(fingerprinter.randomizeDevice({ os: 'BeOS' }))
        .rejects
        .toThrow();
    });
  });

  // ==================================================
  // Fingerprint Consistency Tests
  // ==================================================
  describe('Fingerprint Consistency', () => {
    test('should validate consistent fingerprint', async () => {
      await fingerprinter.applyFingerprint('iphone-13-pro');
      const result = fingerprinter.validateFingerprintConsistency();

      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.profile).toBe('iPhone 13 Pro');
    });

    test('should detect when no profile applied', () => {
      const fresh = new DeviceFingerprinter();
      const result = fresh.validateFingerprintConsistency();

      expect(result.valid).toBe(false);
      expect(result.issue).toBe('No profile applied');
    });

    test('should check OS/browser compatibility', async () => {
      // Create a custom profile with incompatible OS/browser
      const customProfiles = fingerprinter.loadDefaultProfiles();
      customProfiles['incompatible'] = {
        name: 'Incompatible Device',
        os: { name: 'iOS', version: '15' },
        browser: { name: 'Chrome', version: '114.0.0.0' }, // Chrome on iOS impossible
        screen: { width: 1170, height: 2532, colorDepth: 32, devicePixelRatio: 3 },
        deviceType: 'mobile',
        timezone: 'America/New_York',
        language: 'en-US',
        hardwareConcurrency: 6,
        maxTouchPoints: 5,
        plugins: [],
        fonts: ['Arial']
      };

      const custom = new DeviceFingerprinter(customProfiles);
      await custom.applyFingerprint('incompatible');
      const result = custom.validateFingerprintConsistency();

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should check screen resolution realism', async () => {
      // Create profile with unrealistic mobile resolution
      const customProfiles = fingerprinter.loadDefaultProfiles();
      customProfiles['unrealistic'] = {
        name: 'Unrealistic Device',
        os: { name: 'Android', version: '13' },
        browser: { name: 'Chrome', version: '114.0.0.0' },
        screen: { width: 4000, height: 6000, colorDepth: 32, devicePixelRatio: 1 },
        deviceType: 'mobile',
        timezone: 'America/New_York',
        language: 'en-US',
        hardwareConcurrency: 8,
        maxTouchPoints: 10,
        plugins: [],
        fonts: ['Arial', 'Roboto']
      };

      const custom = new DeviceFingerprinter(customProfiles);
      await custom.applyFingerprint('unrealistic');
      const result = custom.validateFingerprintConsistency();

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });

  // ==================================================
  // Profile History Tests
  // ==================================================
  describe('Profile History', () => {
    test('should track profile history', async () => {
      const fresh = new DeviceFingerprinter();

      await fresh.applyFingerprint('iphone-13-pro');
      await fresh.applyFingerprint('pixel-6-pro');

      const history = fresh.getProfileHistory();

      expect(history.length).toBe(2);
      expect(history[0].profileId).toBe('iphone-13-pro');
      expect(history[1].profileId).toBe('pixel-6-pro');
    });

    test('should limit history by default', async () => {
      const fresh = new DeviceFingerprinter();

      for (const profileId of ['iphone-13-pro', 'pixel-6-pro', 'windows-10-chrome',
                               'macos-safari', 'ipad-pro', 'samsung-galaxy-tab']) {
        await fresh.applyFingerprint(profileId);
      }

      const history = fresh.getProfileHistory();

      expect(history.length).toBeLessThanOrEqual(10);
    });

    test('should respect custom limit', async () => {
      const fresh = new DeviceFingerprinter();

      await fresh.applyFingerprint('iphone-13-pro');
      await fresh.applyFingerprint('pixel-6-pro');
      await fresh.applyFingerprint('windows-10-chrome');

      const history = fresh.getProfileHistory(2);

      expect(history.length).toBe(2);
      expect(history[0].profileId).toBe('pixel-6-pro');
      expect(history[1].profileId).toBe('windows-10-chrome');
    });

    test('should clear history', async () => {
      const fresh = new DeviceFingerprinter();

      await fresh.applyFingerprint('iphone-13-pro');
      expect(fresh.getProfileHistory().length).toBeGreaterThan(0);

      fresh.clearHistory();
      expect(fresh.getProfileHistory().length).toBe(0);
    });
  });

  // ==================================================
  // Profile Listing Tests
  // ==================================================
  describe('Profile Listing', () => {
    test('should list all profiles with metadata', () => {
      const profiles = fingerprinter.listProfiles();

      expect(Array.isArray(profiles)).toBeTruthy();
      expect(profiles.length).toBeGreaterThan(0);
    });

    test('should include required metadata', () => {
      const profiles = fingerprinter.listProfiles();

      for (const profile of profiles) {
        expect(profile.id).toBeDefined();
        expect(profile.name).toBeDefined();
        expect(profile.os).toBeDefined();
        expect(profile.browser).toBeDefined();
        expect(profile.deviceType).toBeDefined();
      }
    });

    test('should match profile count', () => {
      const profiles = fingerprinter.listProfiles();
      const profileKeys = Object.keys(fingerprinter.profiles);

      expect(profiles.length).toBe(profileKeys.length);
    });
  });

  // ==================================================
  // Profile Statistics Tests
  // ==================================================
  describe('Profile Statistics', () => {
    test('should calculate profile statistics', () => {
      const stats = fingerprinter.getProfileStats();

      expect(stats.totalProfiles).toBeGreaterThan(0);
      expect(stats.byOS).toBeDefined();
      expect(stats.byBrowser).toBeDefined();
      expect(stats.byDeviceType).toBeDefined();
    });

    test('should have correct OS distribution', () => {
      const stats = fingerprinter.getProfileStats();

      expect(stats.byOS['iOS']).toBeGreaterThan(0);
      expect(stats.byOS['Android']).toBeGreaterThan(0);
      expect(stats.byOS['Windows']).toBeGreaterThan(0);
    });

    test('should have correct device type distribution', () => {
      const stats = fingerprinter.getProfileStats();

      expect(stats.byDeviceType['mobile']).toBeGreaterThan(0);
      expect(stats.byDeviceType['tablet']).toBeGreaterThan(0);
      expect(stats.byDeviceType['desktop']).toBeGreaterThan(0);
    });

    test('should sum to total profiles', () => {
      const stats = fingerprinter.getProfileStats();
      const osTotal = Object.values(stats.byOS).reduce((a, b) => a + b, 0);

      expect(osTotal).toBe(stats.totalProfiles);
    });
  });

  // ==================================================
  // Resolution Realism Tests
  // ==================================================
  describe('Resolution Realism', () => {
    test('should validate realistic mobile resolution', () => {
      const profile = fingerprinter.getProfile('iphone-13-pro');
      const result = fingerprinter.isRealisticResolution(profile);

      expect(result).toBe(true);
    });

    test('should validate realistic desktop resolution', () => {
      const profile = fingerprinter.getProfile('windows-10-chrome');
      const result = fingerprinter.isRealisticResolution(profile);

      expect(result).toBe(true);
    });

    test('should reject unrealistic mobile resolution', () => {
      const profile = {
        screen: { width: 10000, height: 20000 },
        deviceType: 'mobile'
      };
      const result = fingerprinter.isRealisticResolution(profile);

      expect(result).toBe(false);
    });

    test('should accept wide range of realistic desktop resolutions', () => {
      const resolutions = [
        { width: 1024, height: 768 },
        { width: 1920, height: 1080 },
        { width: 2560, height: 1440 },
        { width: 3840, height: 2160 }
      ];

      for (const res of resolutions) {
        const profile = { screen: res, deviceType: 'desktop' };
        const result = fingerprinter.isRealisticResolution(profile);
        expect(result).toBe(true);
      }
    });
  });

  // ==================================================
  // OS/Browser Compatibility Tests
  // ==================================================
  describe('OS/Browser Compatibility', () => {
    test('should verify Safari on iOS', () => {
      const result = fingerprinter.osSupportsVersion('iOS', 'Safari', '15.6');

      expect(result).toBe(true);
    });

    test('should verify Chrome on Android', () => {
      const result = fingerprinter.osSupportsVersion('Android', 'Chrome', '114.0');

      expect(result).toBe(true);
    });

    test('should reject Chrome on iOS', () => {
      const result = fingerprinter.osSupportsVersion('iOS', 'Chrome', '114.0');

      expect(result).toBe(false);
    });

    test('should reject Safari on Windows', () => {
      const result = fingerprinter.osSupportsVersion('Windows', 'Safari', '16.1');

      expect(result).toBe(false);
    });

    test('should accept multiple browsers on desktop', () => {
      expect(fingerprinter.osSupportsVersion('Windows', 'Chrome', '114.0')).toBe(true);
      expect(fingerprinter.osSupportsVersion('Windows', 'Firefox', '114.0')).toBe(true);
      expect(fingerprinter.osSupportsVersion('Windows', 'Edge', '114.0')).toBe(true);
    });
  });

  // ==================================================
  // Profile Data Integrity Tests
  // ==================================================
  describe('Profile Data Integrity', () => {
    test('should have complete iPhone profile', () => {
      const profile = fingerprinter.getProfile('iphone-13-pro');

      expect(profile.name).toBeDefined();
      expect(profile.deviceType).toBeDefined();
      expect(profile.os).toBeDefined();
      expect(profile.browser).toBeDefined();
      expect(profile.screen).toBeDefined();
      expect(profile.userAgent).toBeDefined();
      expect(profile.timezone).toBeDefined();
      expect(profile.language).toBeDefined();
      expect(profile.hardwareConcurrency).toBeDefined();
      expect(profile.maxTouchPoints).toBeDefined();
      expect(profile.webglVendor).toBeDefined();
      expect(profile.webglRenderer).toBeDefined();
      expect(profile.fonts).toBeDefined();
    });

    test('should have valid screen properties', () => {
      const profile = fingerprinter.getProfile('pixel-6-pro');

      expect(profile.screen.width).toBeGreaterThan(0);
      expect(profile.screen.height).toBeGreaterThan(0);
      expect(profile.screen.colorDepth).toBeGreaterThan(0);
      expect(profile.screen.devicePixelRatio).toBeGreaterThan(0);
    });

    test('should have positive hardware concurrency', () => {
      const profiles = fingerprinter.listProfiles();

      for (const _ of profiles) {
        const profile = fingerprinter.getProfile(_.id);
        expect(profile.hardwareConcurrency).toBeGreaterThan(0);
        expect(profile.hardwareConcurrency).toBeLessThanOrEqual(16);
      }
    });

    test('should have valid fonts array', () => {
      const profile = fingerprinter.getProfile('iphone-13-pro');

      expect(Array.isArray(profile.fonts)).toBeTruthy();
      expect(profile.fonts.length).toBeGreaterThan(0);
      expect(typeof profile.fonts[0]).toBe('string');
    });
  });

  // ==================================================
  // Edge Cases Tests
  // ==================================================
  describe('Edge Cases', () => {
    test('should handle custom profile database', () => {
      const customDb = {
        'custom': {
          name: 'Custom Device',
          deviceType: 'desktop',
          os: { name: 'Windows', version: '11' },
          browser: { name: 'Firefox', version: '114.0' },
          screen: { width: 1920, height: 1080, colorDepth: 32, devicePixelRatio: 1 },
          timezone: 'UTC',
          language: 'en-US',
          hardwareConcurrency: 8,
          maxTouchPoints: 0,
          userAgent: 'Mozilla/5.0 Firefox/114',
          plugins: [],
          fonts: ['Arial'],
          webglVendor: 'Google',
          webglRenderer: 'ANGLE'
        }
      };

      const custom = new DeviceFingerprinter(customDb);
      const profile = custom.getProfile('custom');

      expect(profile).toBeDefined();
      expect(profile.name).toBe('Custom Device');
    });

    test('should handle empty profile history limit', () => {
      const fresh = new DeviceFingerprinter();
      const history = fresh.getProfileHistory(0);

      expect(Array.isArray(history)).toBeTruthy();
    });

    test('should handle very large history limit', async () => {
      const fresh = new DeviceFingerprinter();
      await fresh.applyFingerprint('iphone-13-pro');

      const history = fresh.getProfileHistory(1000);

      expect(history.length).toBe(1);
    });
  });

  // ==================================================
  // Integration Tests
  // ==================================================
  describe('Integration', () => {
    test('should support complete workflow', async () => {
      const workflow = new DeviceFingerprinter();

      // Get random device
      const randomDevice = workflow.getRandomProfile({ deviceType: 'mobile' });
      expect(randomDevice).toBeDefined();

      // Apply it
      const fingerprint = await workflow.applyFingerprint(randomDevice.id);
      expect(fingerprint).toBeDefined();

      // Validate consistency
      const validation = workflow.validateFingerprintConsistency();
      expect(validation.valid).toBe(true);

      // Check history
      const history = workflow.getProfileHistory();
      expect(history.length).toBe(1);
    });

    test('should support device rotation', async () => {
      const workflow = new DeviceFingerprinter();
      const devices = [];

      for (let i = 0; i < 3; i++) {
        await workflow.randomizeDevice();
        const profile = workflow.getCurrentProfile();
        devices.push(profile.name);
      }

      expect(devices.length).toBe(3);
      const history = workflow.getProfileHistory();
      expect(history.length).toBe(3);
    });

    test('should provide statistics after rotation', async () => {
      const workflow = new DeviceFingerprinter();

      await workflow.applyFingerprint('iphone-13-pro');
      await workflow.applyFingerprint('pixel-6-pro');
      await workflow.applyFingerprint('windows-10-chrome');

      const stats = workflow.getProfileStats();

      expect(stats.totalProfiles).toBeGreaterThan(0);
      expect(Object.keys(stats.byOS).length).toBeGreaterThan(0);
      expect(Object.keys(stats.byDeviceType).length).toBeGreaterThan(0);
    });
  });

  // ==================================================
  // Performance Tests
  // ==================================================
  describe('Performance', () => {
    test('should get profile quickly', () => {
      const start = Date.now();
      fingerprinter.getProfile('iphone-13-pro');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('should generate random profile quickly', () => {
      const start = Date.now();
      fingerprinter.getRandomProfile();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('should apply fingerprint quickly', async () => {
      const start = Date.now();
      await fingerprinter.applyFingerprint('iphone-13-pro');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });

    test('should validate consistency quickly', async () => {
      await fingerprinter.applyFingerprint('iphone-13-pro');

      const start = Date.now();
      fingerprinter.validateFingerprintConsistency();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    test('should calculate stats quickly', () => {
      const start = Date.now();
      fingerprinter.getProfileStats();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});

/**
 * Tests for Fingerprint Profile Module
 *
 * Phase 17: Enhanced Bot Detection Evasion
 */

const {
  FingerprintProfile,
  FingerprintProfileManager,
  PLATFORM_CONFIGS,
  CHROME_VERSIONS,
  SCREEN_CONFIGS,
  TIMEZONE_CONFIGS,
  HARDWARE_CONFIGS,
} = require('../../evasion/fingerprint-profile');

describe('FingerprintProfile', () => {
  describe('Constructor', () => {
    test('creates profile with default options', () => {
      const profile = new FingerprintProfile();

      expect(profile.seed).toBeDefined();
      expect(profile.platformType).toBeDefined();
      expect(profile.timezone).toBeDefined();
      expect(profile.tier).toBeDefined();
      expect(profile.userAgent).toBeDefined();
    });

    test('creates profile with specific platform', () => {
      const profile = new FingerprintProfile({ platform: 'windows' });

      expect(profile.platformType).toBe('windows');
      expect(profile.userAgent).toContain('Windows');
    });

    test('creates profile with specific timezone', () => {
      const profile = new FingerprintProfile({ timezone: 'America/New_York' });

      expect(profile.timezone).toBe('America/New_York');
      expect(profile.timezoneConfig.offset).toBe(-300);
    });

    test('creates profile with specific tier', () => {
      const profile = new FingerprintProfile({ tier: 'high' });

      expect(profile.tier).toBe('high');
      expect(profile.hardwareConcurrency).toBe(12);
      expect(profile.deviceMemory).toBe(16);
    });

    test('creates reproducible profile with seed', () => {
      const seed = 'test-seed-12345';
      const profile1 = new FingerprintProfile({ seed });
      const profile2 = new FingerprintProfile({ seed });

      expect(profile1.userAgent).toBe(profile2.userAgent);
      expect(profile1.platform).toBe(profile2.platform);
      expect(profile1.webglVendor).toBe(profile2.webglVendor);
    });
  });

  describe('Platform Configurations', () => {
    test('windows profile has correct platform values', () => {
      const profile = new FingerprintProfile({ platform: 'windows' });

      expect(profile.userAgent).toContain('Windows NT');
      expect(profile.platform).toBe('Win32');
      expect(profile.webglVendor).toMatch(/Google Inc\.|NVIDIA|AMD|Intel/);
    });

    test('macos profile has correct platform values', () => {
      const profile = new FingerprintProfile({ platform: 'macos' });

      expect(profile.userAgent).toContain('Macintosh');
      expect(profile.platform).toBe('MacIntel');
    });

    test('linux profile has correct platform values', () => {
      const profile = new FingerprintProfile({ platform: 'linux' });

      expect(profile.userAgent).toContain('Linux');
      expect(profile.platform).toContain('Linux');
    });
  });

  describe('getConfig()', () => {
    test('returns complete configuration object', () => {
      const profile = new FingerprintProfile();
      const config = profile.getConfig();

      expect(config).toHaveProperty('seed');
      expect(config).toHaveProperty('platformType');
      expect(config).toHaveProperty('timezone');
      expect(config).toHaveProperty('tier');
      expect(config).toHaveProperty('userAgent');
      expect(config).toHaveProperty('platform');
      expect(config).toHaveProperty('screen');
      expect(config).toHaveProperty('webgl');
      expect(config).toHaveProperty('languages');
      expect(config).toHaveProperty('timezoneOffset');
      expect(config).toHaveProperty('hardwareConcurrency');
      expect(config).toHaveProperty('deviceMemory');
      expect(config).toHaveProperty('canvasNoise');
      expect(config).toHaveProperty('audioNoise');
      expect(config).toHaveProperty('plugins');
      expect(config).toHaveProperty('fonts');
    });

    test('screen config has all required properties', () => {
      const profile = new FingerprintProfile();
      const config = profile.getConfig();

      expect(config.screen).toHaveProperty('width');
      expect(config.screen).toHaveProperty('height');
      expect(config.screen).toHaveProperty('availWidth');
      expect(config.screen).toHaveProperty('availHeight');
      expect(config.screen).toHaveProperty('colorDepth');
      expect(config.screen).toHaveProperty('pixelDepth');
      expect(config.screen).toHaveProperty('devicePixelRatio');
    });

    test('webgl config has vendor and renderer', () => {
      const profile = new FingerprintProfile();
      const config = profile.getConfig();

      expect(config.webgl).toHaveProperty('vendor');
      expect(config.webgl).toHaveProperty('renderer');
    });
  });

  describe('validate()', () => {
    test('validates consistent windows profile', () => {
      const profile = new FingerprintProfile({ platform: 'windows' });
      const validation = profile.validate();

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('validates consistent macos profile', () => {
      const profile = new FingerprintProfile({ platform: 'macos' });
      const validation = profile.validate();

      expect(validation.valid).toBe(true);
    });

    test('validates consistent linux profile', () => {
      const profile = new FingerprintProfile({ platform: 'linux' });
      const validation = profile.validate();

      expect(validation.valid).toBe(true);
    });

    test('detects invalid hardware concurrency', () => {
      const profile = new FingerprintProfile();
      profile.hardwareConcurrency = 1;

      const validation = profile.validate();

      expect(validation.issues.some(i => i.includes('concurrency'))).toBe(true);
    });

    test('detects small screen resolution', () => {
      const profile = new FingerprintProfile();
      profile.screen.width = 640;
      profile.screen.height = 480;

      const validation = profile.validate();

      expect(validation.issues.some(i => i.includes('Screen resolution'))).toBe(true);
    });
  });

  describe('getInjectionScript()', () => {
    test('returns valid JavaScript code', () => {
      const profile = new FingerprintProfile();
      const script = profile.getInjectionScript();

      expect(typeof script).toBe('string');
      expect(script).toContain('navigator');
      expect(script).toContain('screen');
      expect(script).toContain('WebGLRenderingContext');
    });

    test('includes config object', () => {
      const profile = new FingerprintProfile();
      const script = profile.getInjectionScript();

      expect(script).toContain('const config =');
      expect(script).toContain(profile.userAgent);
    });
  });

  describe('toJSON() and fromJSON()', () => {
    test('serializes and deserializes profile', () => {
      const original = new FingerprintProfile({
        platform: 'windows',
        timezone: 'America/Chicago',
        tier: 'medium',
        seed: 'test-seed',
      });

      const json = original.toJSON();
      const restored = FingerprintProfile.fromJSON(json);

      expect(restored.platformType).toBe(original.platformType);
      expect(restored.timezone).toBe(original.timezone);
      expect(restored.tier).toBe(original.tier);
      expect(restored.seed).toBe(original.seed);
    });

    test('handles JSON object input', () => {
      const config = {
        seed: 'test-seed',
        platformType: 'macos',
        timezone: 'Europe/London',
        tier: 'high',
      };

      const profile = FingerprintProfile.fromJSON(config);

      expect(profile.platformType).toBe('macos');
      expect(profile.timezone).toBe('Europe/London');
    });
  });

  describe('forRegion()', () => {
    test.each(['US', 'UK', 'EU', 'RU', 'JP', 'CN', 'AU'])('creates profile for region %s', (region) => {
      const profile = FingerprintProfile.forRegion(region);

      expect(profile).toBeInstanceOf(FingerprintProfile);
      expect(profile.timezone).toBeDefined();
    });

    test('US region uses US timezones', () => {
      const profile = FingerprintProfile.forRegion('US');
      const usTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

      expect(usTimezones).toContain(profile.timezone);
    });

    test('JP region uses Asia/Tokyo', () => {
      const profile = FingerprintProfile.forRegion('JP');

      expect(profile.timezone).toBe('Asia/Tokyo');
    });

    test('defaults to US for unknown region', () => {
      const profile = FingerprintProfile.forRegion('UNKNOWN');
      const usTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];

      expect(usTimezones).toContain(profile.timezone);
    });
  });
});

describe('FingerprintProfileManager', () => {
  let manager;

  beforeEach(() => {
    manager = new FingerprintProfileManager();
  });

  describe('createProfile()', () => {
    test('creates and stores profile', () => {
      const { id, profile } = manager.createProfile();

      expect(id).toBeDefined();
      expect(id).toMatch(/^fp_/);
      expect(profile).toBeInstanceOf(FingerprintProfile);
    });

    test('creates profile with custom ID', () => {
      const { id } = manager.createProfile({ id: 'custom-id' });

      expect(id).toBe('custom-id');
    });

    test('passes options to profile', () => {
      const { profile } = manager.createProfile({
        platform: 'linux',
        timezone: 'Europe/Paris',
      });

      expect(profile.platformType).toBe('linux');
      expect(profile.timezone).toBe('Europe/Paris');
    });
  });

  describe('getProfile()', () => {
    test('returns profile by ID', () => {
      const { id, profile: created } = manager.createProfile();
      const retrieved = manager.getProfile(id);

      expect(retrieved).toBe(created);
    });

    test('returns undefined for nonexistent ID', () => {
      const profile = manager.getProfile('nonexistent');

      expect(profile).toBeUndefined();
    });
  });

  describe('setActiveProfile() and getActiveProfile()', () => {
    test('sets and gets active profile', () => {
      const { id, profile } = manager.createProfile();
      manager.setActiveProfile(id);

      expect(manager.getActiveProfile()).toBe(profile);
      expect(manager.activeProfileId).toBe(id);
    });

    test('throws for nonexistent profile', () => {
      expect(() => manager.setActiveProfile('nonexistent')).toThrow('not found');
    });

    test('returns null when no active profile', () => {
      expect(manager.getActiveProfile()).toBeNull();
    });
  });

  describe('listProfiles()', () => {
    test('returns empty array when no profiles', () => {
      const profiles = manager.listProfiles();

      expect(profiles).toEqual([]);
    });

    test('lists all profiles with metadata', () => {
      manager.createProfile({ platform: 'windows' });
      manager.createProfile({ platform: 'macos' });
      manager.createProfile({ platform: 'linux' });

      const profiles = manager.listProfiles();

      expect(profiles).toHaveLength(3);
      expect(profiles[0]).toHaveProperty('id');
      expect(profiles[0]).toHaveProperty('platformType');
      expect(profiles[0]).toHaveProperty('timezone');
      expect(profiles[0]).toHaveProperty('tier');
      expect(profiles[0]).toHaveProperty('isActive');
    });

    test('marks active profile', () => {
      const { id } = manager.createProfile();
      manager.setActiveProfile(id);

      const profiles = manager.listProfiles();
      const activeProfile = profiles.find(p => p.id === id);

      expect(activeProfile.isActive).toBe(true);
    });
  });

  describe('deleteProfile()', () => {
    test('deletes existing profile', () => {
      const { id } = manager.createProfile();

      const deleted = manager.deleteProfile(id);

      expect(deleted).toBe(true);
      expect(manager.getProfile(id)).toBeUndefined();
    });

    test('returns false for nonexistent profile', () => {
      const deleted = manager.deleteProfile('nonexistent');

      expect(deleted).toBe(false);
    });

    test('clears active profile if deleted', () => {
      const { id } = manager.createProfile();
      manager.setActiveProfile(id);
      manager.deleteProfile(id);

      expect(manager.activeProfileId).toBeNull();
      expect(manager.getActiveProfile()).toBeNull();
    });
  });

  describe('exportProfiles() and importProfiles()', () => {
    test('exports all profiles', () => {
      manager.createProfile({ id: 'profile1', platform: 'windows' });
      manager.createProfile({ id: 'profile2', platform: 'macos' });

      const exported = manager.exportProfiles();

      expect(exported).toHaveProperty('profile1');
      expect(exported).toHaveProperty('profile2');
      expect(exported.profile1.platformType).toBe('windows');
      expect(exported.profile2.platformType).toBe('macos');
    });

    test('imports profiles', () => {
      const data = {
        imported1: {
          seed: 'seed1',
          platformType: 'linux',
          timezone: 'Europe/Berlin',
          tier: 'high',
        },
        imported2: {
          seed: 'seed2',
          platformType: 'windows',
          timezone: 'America/New_York',
          tier: 'medium',
        },
      };

      manager.importProfiles(data);

      expect(manager.getProfile('imported1')).toBeDefined();
      expect(manager.getProfile('imported2')).toBeDefined();
      expect(manager.getProfile('imported1').platformType).toBe('linux');
    });
  });
});

describe('Configuration Constants', () => {
  describe('PLATFORM_CONFIGS', () => {
    test.each(['windows', 'macos', 'linux'])('has valid config for %s', (platform) => {
      const config = PLATFORM_CONFIGS[platform];

      expect(config).toHaveProperty('platforms');
      expect(config).toHaveProperty('navigatorPlatforms');
      expect(config).toHaveProperty('webglVendors');
      expect(config).toHaveProperty('webglRenderers');
      expect(config).toHaveProperty('fonts');
      expect(config).toHaveProperty('userAgentTemplate');
    });

    test('webgl renderers match vendors', () => {
      for (const platform of Object.values(PLATFORM_CONFIGS)) {
        for (const vendor of platform.webglVendors) {
          expect(platform.webglRenderers).toHaveProperty(vendor);
          expect(platform.webglRenderers[vendor].length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('CHROME_VERSIONS', () => {
    test('contains valid Chrome versions', () => {
      expect(CHROME_VERSIONS.length).toBeGreaterThan(0);

      for (const version of CHROME_VERSIONS) {
        expect(version).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      }
    });
  });

  describe('SCREEN_CONFIGS', () => {
    test.each(['standard', 'high', 'retina'])('has valid %s tier configs', (tier) => {
      const configs = SCREEN_CONFIGS[tier];

      expect(configs.length).toBeGreaterThan(0);

      for (const config of configs) {
        expect(config.width).toBeGreaterThan(0);
        expect(config.height).toBeGreaterThan(0);
        expect(config.colorDepth).toBeGreaterThan(0);
      }
    });
  });

  describe('TIMEZONE_CONFIGS', () => {
    test('has valid timezone configurations', () => {
      expect(Object.keys(TIMEZONE_CONFIGS).length).toBeGreaterThan(0);

      for (const [tz, config] of Object.entries(TIMEZONE_CONFIGS)) {
        expect(config).toHaveProperty('offset');
        expect(config).toHaveProperty('locale');
        expect(config).toHaveProperty('country');
        expect(typeof config.offset).toBe('number');
      }
    });
  });

  describe('HARDWARE_CONFIGS', () => {
    test.each(['low', 'medium', 'high', 'workstation'])('has valid %s tier config', (tier) => {
      const config = HARDWARE_CONFIGS[tier];

      expect(config).toHaveProperty('hardwareConcurrency');
      expect(config).toHaveProperty('deviceMemory');
      expect(config.hardwareConcurrency).toBeGreaterThan(0);
      expect(config.deviceMemory).toBeGreaterThan(0);
    });

    test('tiers have increasing resources', () => {
      expect(HARDWARE_CONFIGS.low.hardwareConcurrency)
        .toBeLessThan(HARDWARE_CONFIGS.medium.hardwareConcurrency);
      expect(HARDWARE_CONFIGS.medium.hardwareConcurrency)
        .toBeLessThan(HARDWARE_CONFIGS.high.hardwareConcurrency);
      expect(HARDWARE_CONFIGS.high.hardwareConcurrency)
        .toBeLessThanOrEqual(HARDWARE_CONFIGS.workstation.hardwareConcurrency);
    });
  });
});

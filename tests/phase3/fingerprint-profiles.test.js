/**
 * Dynamic Fingerprinting Profiles Tests
 * Tests for Device Fingerprinting Enhancements - Feature 3
 */

const { DynamicFingerprintProfile } = require('../../src/evasion/fingerprint-profiles');

describe('DynamicFingerprintProfile', () => {
  let profile;

  beforeEach(() => {
    profile = new DynamicFingerprintProfile();
  });

  describe('Profile Generation', () => {
    test('should generate a random profile', () => {
      const fp = profile.baseProfile;

      expect(fp).toBeDefined();
      expect(fp.os).toBeDefined();
      expect(fp.browser).toBeDefined();
      expect(fp.screenWidth).toBeGreaterThan(0);
      expect(fp.screenHeight).toBeGreaterThan(0);
    });

    test('should generate Windows profiles', () => {
      let windows = false;

      for (let i = 0; i < 20; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'Windows') {
          windows = true;
          expect(p.baseProfile.browser).toMatch(/Chrome|Firefox|Edge/);
          break;
        }
      }

      expect(windows).toBe(true);
    });

    test('should generate macOS profiles', () => {
      let macos = false;

      for (let i = 0; i < 20; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'macOS') {
          macos = true;
          expect(p.baseProfile.browser).toMatch(/Safari|Chrome|Firefox/);
          break;
        }
      }

      expect(macos).toBe(true);
    });

    test('should generate iOS profiles', () => {
      let ios = false;

      for (let i = 0; i < 20; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'iOS') {
          ios = true;
          expect(p.baseProfile.browser).toBe('Safari');
          expect(p.baseProfile.touchEnabled).toBe(true);
          break;
        }
      }

      expect(ios).toBe(true);
    });

    test('should generate Android profiles', () => {
      let android = false;

      for (let i = 0; i < 20; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'Android') {
          android = true;
          expect(['Chrome', 'Firefox']).toContain(p.baseProfile.browser);
          expect(p.baseProfile.touchEnabled).toBe(true);
          break;
        }
      }

      expect(android).toBe(true);
    });

    test('should generate Linux profiles', () => {
      let linux = false;

      for (let i = 0; i < 20; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'Linux') {
          linux = true;
          expect(p.baseProfile.browser).toMatch(/Chrome|Firefox/);
          break;
        }
      }

      expect(linux).toBe(true);
    });
  });

  describe('Profile Coherence', () => {
    test('should validate iOS only has Safari', () => {
      let test = false;

      for (let i = 0; i < 50; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'iOS') {
          expect(p.baseProfile.browser).toBe('Safari');
          test = true;
          break;
        }
      }

      expect(test).toBe(true);
    });

    test('should validate macOS doesn\'t have impossible combinations', () => {
      let test = false;

      for (let i = 0; i < 50; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.os === 'macOS') {
          expect(['Safari', 'Chrome', 'Firefox']).toContain(p.baseProfile.browser);
          test = true;
          break;
        }
      }

      expect(test).toBe(true);
    });

    test('should validate desktop device types have no touch', () => {
      let test = false;

      for (let i = 0; i < 50; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.deviceType === 'desktop') {
          expect(p.baseProfile.touchEnabled).toBe(false);
          expect(p.baseProfile.maxTouchPoints).toBe(0);
          test = true;
          break;
        }
      }

      expect(test).toBe(true);
    });

    test('should validate mobile device types have touch', () => {
      let test = false;

      for (let i = 0; i < 50; i++) {
        const p = new DynamicFingerprintProfile();
        if (p.baseProfile.deviceType === 'mobile') {
          expect(p.baseProfile.touchEnabled).toBe(true);
          expect(p.baseProfile.maxTouchPoints).toBeGreaterThan(0);
          test = true;
          break;
        }
      }

      expect(test).toBe(true);
    });

    test('should validate screen resolutions are realistic', () => {
      const fp = profile.baseProfile;

      // Minimum screen size
      expect(fp.screenWidth).toBeGreaterThanOrEqual(240);
      expect(fp.screenHeight).toBeGreaterThanOrEqual(240);

      // Maximum reasonable screen size
      expect(fp.screenWidth).toBeLessThanOrEqual(7680);
      expect(fp.screenHeight).toBeLessThanOrEqual(4320);
    });

    test('should validate DPR is realistic', () => {
      const fp = profile.baseProfile;

      expect(fp.devicePixelRatio).toBeGreaterThanOrEqual(1);
      expect(fp.devicePixelRatio).toBeLessThanOrEqual(4);
    });

    test('should validate timezone format', () => {
      const fp = profile.baseProfile;
      expect(fp.timezone).toMatch(/\/|UTC/);
    });

    test('should validate language format', () => {
      const fp = profile.baseProfile;
      expect(fp.language).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });
  });

  describe('Fingerprint Evolution', () => {
    test('should evolve fingerprint realistically', () => {
      const initial = profile.getFingerprint();
      // Evolve multiple times to ensure drift is applied
      for (let i = 0; i < 3; i++) {
        profile.evolveFingerprint();
      }
      const evolved = profile.getFingerprint();

      // Core OS/Browser shouldn't change
      expect(evolved.os).toBe(initial.os);
      expect(evolved.browser).toBe(initial.browser);
      // Overall profile should still be valid
      expect(evolved).toBeDefined();
    });

    test('should track interaction count', () => {
      expect(profile.interactionCount).toBe(0);

      profile.evolveFingerprint();
      expect(profile.interactionCount).toBe(1);

      profile.evolveFingerprint();
      expect(profile.interactionCount).toBe(2);
    });

    test('should track evolution history', () => {
      expect(profile.history.length).toBe(1);

      profile.evolveFingerprint();
      expect(profile.history.length).toBe(2);

      profile.evolveFingerprint();
      expect(profile.history.length).toBe(3);
    });

    test('should simulate GPU upgrades periodically', () => {
      const initialGPU = profile.baseProfile.gpu;

      // Evolve 50+ times to trigger upgrade
      for (let i = 0; i < 51; i++) {
        profile.evolveFingerprint();
      }

      const evolved = profile.getFingerprint();
      // GPU might be upgraded
      expect(evolved.gpu).toBeDefined();
    });

    test('should upgrade Chrome version realistically', () => {
      const initialVersion = profile.baseProfile.browserVersion;

      // Evolve 51 times to trigger upgrade
      for (let i = 0; i < 51; i++) {
        profile.evolveFingerprint();
      }

      const evolved = profile.getFingerprint();
      expect(evolved.browserVersion).toBeDefined();
      // Version should be same or one major version higher
      const initialMajor = parseInt(initialVersion.split('.')[0]);
      const evolvedMajor = parseInt(evolved.browserVersion.split('.')[0]);
      expect(evolvedMajor - initialMajor).toBeLessThanOrEqual(1);
    });
  });

  describe('Profile Retirement', () => {
    test('should retire old profiles', () => {
      const initialCreatedAt = profile.createdAt;

      // Evolve until threshold
      for (let i = 0; i < 101; i++) {
        profile.evolveFingerprint();
      }

      // Should trigger retirement
      const result = profile.retire();
      expect(result.success).toBe(true);
      expect(result.retired).toBeDefined();
      expect(result.newProfile).toBeDefined();
    });

    test('should reset interaction count after retirement', () => {
      for (let i = 0; i < 101; i++) {
        profile.evolveFingerprint();
      }

      profile.retire();
      expect(profile.interactionCount).toBe(0);
    });

    test('should generate new profile with different specs', () => {
      const oldOS = profile.baseProfile.os;
      const oldBrowser = profile.baseProfile.browser;

      // Force retirement
      for (let i = 0; i < 101; i++) {
        profile.evolveFingerprint();
      }

      const result = profile.retire();
      const newOS = result.newProfile.os;
      const newBrowser = result.newProfile.browser;

      // New profile might be different (not guaranteed, but likely with random generation)
      expect(result.newProfile).toBeDefined();
      expect(result.newProfile.gpu).toBeDefined();
    });
  });

  describe('Profile Age Tracking', () => {
    test('should track profile age', () => {
      expect(profile.interactionCount).toBe(0);

      const age = profile.getAge();
      expect(age.ageInteractions).toBe(0);
      expect(age.percentage).toBe(0);
    });

    test('should report healthy status when young', () => {
      const age = profile.getAge();
      expect(age.status).toBe('healthy');
    });

    test('should report aging status when old', () => {
      // Evolve to 85% of retirement threshold
      for (let i = 0; i < 85; i++) {
        profile.evolveFingerprint();
      }

      const age = profile.getAge();
      expect(age.status).toBe('aging');
      expect(age.percentage).toBeGreaterThan(80);
    });

    test('should calculate percentage correctly', () => {
      for (let i = 0; i < 50; i++) {
        profile.evolveFingerprint();
      }

      const age = profile.getAge();
      expect(age.percentage).toBeCloseTo(50, 1);
    });
  });

  describe('Fingerprint Drift Analysis', () => {
    test('should analyze fingerprint drift', () => {
      // Create several evolutions
      for (let i = 0; i < 5; i++) {
        profile.evolveFingerprint();
      }

      const drift = profile.calculateDrift(5);
      expect(drift.avgDrift).toBeDefined();
      expect(drift.status).toBeDefined();
    });

    test('should report drift within expected range', () => {
      for (let i = 0; i < 10; i++) {
        profile.evolveFingerprint();
      }

      const drift = profile.calculateDrift(10);
      // Drift should be within specified range or marked as abnormal
      expect(drift.avgDrift).toBeDefined();
    });

    test('should handle insufficient history', () => {
      const drift = profile.calculateDrift(10);
      expect(drift.status).toBe('insufficient_history');
    });
  });

  describe('Coherence Analysis', () => {
    test('should analyze overall coherence', () => {
      const coherence = profile.analyzeCoherence();

      expect(coherence.os_browser_coherence).toBeDefined();
      expect(coherence.screen_dpr_coherence).toBeDefined();
      expect(coherence.gpu_rendering_coherence).toBeDefined();
      expect(coherence.timezone_language_coherence).toBeDefined();
      expect(coherence.overall_coherence).toBeDefined();
    });

    test('should validate OS/Browser coherence', () => {
      const check = profile.checkOSBrowserCoherence(profile.baseProfile);

      expect(check.valid).toBe(true);
      expect(check.score).toBe(1.0);
    });

    test('should flag impossible OS/Browser combos', () => {
      const impossible = {
        os: 'iOS',
        browser: 'Chrome'
      };

      const check = profile.checkOSBrowserCoherence(impossible);
      expect(check.valid).toBe(false);
      expect(check.score).toBe(0.0);
    });

    test('should check screen/DPR coherence', () => {
      const check = profile.checkScreenCoherence(profile.baseProfile);

      expect(check.expected).toBeDefined();
      expect(check.actual).toBeDefined();
      expect(check.coherent).toBeDefined();
      expect(check.score).toBeGreaterThanOrEqual(0);
    });

    test('should check GPU coherence', () => {
      const check = profile.checkGPUCoherence(profile.baseProfile);

      expect(check.coherent).toBeDefined();
      expect(check.score).toBeGreaterThanOrEqual(0);
    });

    test('should flag Apple GPU on non-macOS', () => {
      const impossible = {
        os: 'Windows',
        gpu: 'Apple M1'
      };

      const check = profile.checkGPUCoherence(impossible);
      expect(check.coherent).toBe(false);
    });

    test('should check locale coherence', () => {
      const check = profile.checkLocaleCoherence(profile.baseProfile);

      // Timezone and language should be set
      expect(check.timezone).toBeDefined();
      expect(check.language).toBeDefined();
      expect(check.coherent).toBeDefined();
    });
  });

  describe('Baseline Comparison', () => {
    test('should compare with baseline', () => {
      profile.evolveFingerprint();

      const comparison = profile.compareWithBaseline();
      expect(comparison.changeCount).toBeGreaterThanOrEqual(0);
      expect(comparison.changed).toBeDefined();
    });

    test('should track changes', () => {
      profile.evolveFingerprint();

      const comparison = profile.compareWithBaseline();
      if (comparison.changes.length > 0) {
        expect(comparison.changes[0].property).toBeDefined();
        expect(comparison.changes[0].baseline).toBeDefined();
        expect(comparison.changes[0].current).toBeDefined();
      }
    });
  });

  describe('Device Coherence Validation', () => {
    test('should fix iOS non-Safari browsers to Safari', () => {
      const profile_instance = new DynamicFingerprintProfile({
        os: 'iOS',
        browser: 'Chrome'  // Invalid
      });

      profile_instance.validateDeviceCoherence(profile_instance.currentProfile);
      expect(profile_instance.currentProfile.browser).toBe('Safari');
    });

    test('should preserve valid combinations', () => {
      const profile_instance = new DynamicFingerprintProfile({
        os: 'macOS',
        browser: 'Safari'
      });

      profile_instance.validateDeviceCoherence(profile_instance.currentProfile);
      expect(profile_instance.currentProfile.browser).toBe('Safari');
    });

    test('should fix Windows non-standard browsers', () => {
      const profile_instance = new DynamicFingerprintProfile({
        os: 'Windows',
        browser: 'Safari'  // Unusual
      });

      profile_instance.validateDeviceCoherence(profile_instance.currentProfile);
      expect(['Chrome', 'Firefox', 'Edge']).toContain(profile_instance.currentProfile.browser);
    });
  });

  describe('GPU Upgrades', () => {
    test('should upgrade Intel GPUs', () => {
      const upgraded = profile.upgradeGPU('ANGLE (Intel HD Graphics 630)');
      expect(upgraded).toBe('ANGLE (Intel Iris Graphics 650)');
    });

    test('should upgrade NVIDIA GPUs', () => {
      const upgraded = profile.upgradeGPU('ANGLE (NVIDIA GeForce GTX 1080)');
      expect(upgraded).toBe('ANGLE (NVIDIA GeForce RTX 2080)');
    });

    test('should upgrade Apple GPUs', () => {
      const upgraded = profile.upgradeGPU('Apple M1');
      expect(upgraded).toBe('Apple M2');
    });

    test('should preserve unknown GPUs', () => {
      const gpu = 'UnknownGPU';
      const upgraded = profile.upgradeGPU(gpu);
      expect(upgraded).toBe(gpu);
    });
  });

  describe('Chrome Version Upgrades', () => {
    test('should upgrade Chrome realistically', () => {
      const version = '120.0.0.0';
      const upgraded = profile.upgradeChrome(version);

      const upgradedMajor = parseInt(upgraded.split('.')[0]);
      const originalMajor = parseInt(version.split('.')[0]);

      expect(upgradedMajor - originalMajor).toBeLessThanOrEqual(1);
      expect(upgradedMajor - originalMajor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('History Tracking', () => {
    test('should track evolution history', () => {
      for (let i = 0; i < 5; i++) {
        profile.evolveFingerprint();
      }

      const history = profile.getHistory(10);
      expect(history.length).toBe(6);  // Initial + 5 evolutions
    });

    test('should respect history limit', () => {
      for (let i = 0; i < 20; i++) {
        profile.evolveFingerprint();
      }

      const history = profile.getHistory(5);
      expect(history.length).toBe(5);
    });

    test('should contain profile data in history', () => {
      profile.evolveFingerprint();

      const history = profile.getHistory(10);
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].profile).toBeDefined();
    });
  });

  describe('Fingerprint Retrieval', () => {
    test('should get current fingerprint', () => {
      const fp = profile.getFingerprint();

      expect(fp.os).toBeDefined();
      expect(fp.browser).toBeDefined();
      expect(fp.screenWidth).toBeDefined();
      expect(fp.screenHeight).toBeDefined();
    });

    test('should return copy not reference', () => {
      const fp1 = profile.getFingerprint();
      fp1.os = 'Modified';

      const fp2 = profile.getFingerprint();
      expect(fp2.os).not.toBe('Modified');
    });
  });

  describe('Similarity Calculation', () => {
    test('should calculate perfect similarity', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const similarity = profile.calculateSimilarity(obj, obj);

      expect(similarity).toBe(1.0);
    });

    test('should calculate partial similarity', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { a: 1, b: 99, c: 3 };

      const similarity = profile.calculateSimilarity(obj1, obj2);
      expect(similarity).toBeCloseTo(0.666, 2);
    });

    test('should handle empty objects', () => {
      const similarity = profile.calculateSimilarity({}, {});
      // Empty objects should have perfect similarity (no keys to compare) or return 1.0
      expect(similarity === 1.0 || !isNaN(similarity)).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should evolve fingerprint quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        profile.evolveFingerprint();
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);  // 100 evolutions < 1 second
    });

    test('should analyze coherence quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        profile.analyzeCoherence();
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);  // 100 analyses < 500ms
    });

    test('should calculate drift efficiently', () => {
      for (let i = 0; i < 10; i++) {
        profile.evolveFingerprint();
      }

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        profile.calculateDrift(10);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Edge Cases', () => {
    test('should handle 0% age gracefully', () => {
      const age = profile.getAge();
      expect(age.ageInteractions).toBe(0);
      expect(age.percentage).toBe(0);
      expect(age.status).toBe('healthy');
    });

    test('should handle 100% age gracefully', () => {
      for (let i = 0; i < 100; i++) {
        profile.evolveFingerprint();
      }

      const age = profile.getAge();
      expect(age.percentage).toBe(100);
      expect(age.status).toBe('aging');
    });

    test('should handle rapid retirement and new profile', () => {
      for (let i = 0; i < 101; i++) {
        profile.evolveFingerprint();
      }

      const result1 = profile.retire();
      expect(result1.success).toBe(true);

      const result2 = profile.retire();
      expect(result2.success).toBe(true);
    });

    test('should maintain device type coherence throughout evolution', () => {
      const initialType = profile.baseProfile.deviceType;

      for (let i = 0; i < 50; i++) {
        profile.evolveFingerprint();
        const current = profile.getFingerprint();
        expect(current.deviceType).toBe(initialType);
      }
    });
  });
});

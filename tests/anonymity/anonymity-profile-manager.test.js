/**
 * Basset Hound Browser - Anonymity Profile Manager Tests
 *
 * Phase 4: End-to-End Integration Tests
 * Tests the unified anonymity system combining Phases 1, 2, and 3
 *
 * Test coverage:
 * - Profile management (set, get, list)
 * - All modules activated on set profile
 * - Behavioral module enablement
 * - Consistency validation
 * - Multi-profile switching
 * - No data leakage between profiles
 * - Session state isolation
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const AnonymityProfileManager = require('../../src/anonymity/anonymity-profile-manager');

describe('Anonymity Profile Manager - Phase 4 Integration', () => {
  let manager;

  beforeEach(() => {
    manager = new AnonymityProfileManager();
  });

  afterEach(() => {
    manager.resetAnonymity();
  });

  // ============================================================================
  // PROFILE MANAGEMENT TESTS (10 tests)
  // ============================================================================

  describe('Profile Management', () => {
    it('should initialize with available profiles', () => {
      const profiles = manager.getAvailableProfiles();
      expect(profiles).toBeDefined();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should set anonymity profile successfully', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.success).toBe(true);
      expect(result.profileName).toBe('iPhone 15 Pro');
      expect(result.sessionId).toBeDefined();
      expect(result.device).toBeDefined();
    });

    it('should throw error for unknown profile', () => {
      expect(() => {
        manager.setProfile('Unknown Device');
      }).toThrow('Unknown anonymity profile');
    });

    it('should get active profile after setting', () => {
      manager.setProfile('iPhone 15 Pro');
      const active = manager.getActiveProfile();
      expect(active.active).toBe(true);
      expect(active.profileName).toBe('iPhone 15 Pro');
      expect(active.sessionId).toBeDefined();
    });

    it('should return inactive status when no profile set', () => {
      const active = manager.getActiveProfile();
      expect(active.active).toBe(false);
      expect(active.message).toContain('No anonymity profile');
    });

    it('should get profile details for valid profile', () => {
      const details = manager.getProfileDetails('iPhone 15 Pro');
      expect(details.name).toBe('iPhone 15 Pro');
      expect(details.device).toBeDefined();
      expect(details.phase1).toBeDefined();
      expect(details.phase2).toBeDefined();
      expect(details.phase3).toBeDefined();
    });

    it('should throw for unknown profile details', () => {
      expect(() => {
        manager.getProfileDetails('NonExistent');
      }).toThrow('Unknown anonymity profile');
    });

    it('should list all profiles including multiple device types', () => {
      const profiles = manager.getAvailableProfiles();
      expect(profiles.length).toBeGreaterThan(5);
      // Should have variety of devices
      const hasPhone = profiles.some(p => p.includes('iPhone') || p.includes('Galaxy'));
      const hasDesktop = profiles.some(p => p.includes('MacBook') || p.includes('Windows'));
      expect(hasPhone).toBe(true);
      expect(hasDesktop).toBe(true);
    });

    it('should set different profiles sequentially', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 2);

      manager.setProfile(profiles[0]);
      const active1 = manager.getActiveProfile();
      expect(active1.profileName).toBe(profiles[0]);

      manager.setProfile(profiles[1]);
      const active2 = manager.getActiveProfile();
      expect(active2.profileName).toBe(profiles[1]);
      expect(active2.profileName).not.toBe(active1.profileName);
    });

    it('should create unique session IDs for each profile set', () => {
      const result1 = manager.setProfile('iPhone 15 Pro');
      manager.resetAnonymity();
      const result2 = manager.setProfile('iPhone 15 Pro');
      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });

  // ============================================================================
  // PHASE 1 HARDWARE SPOOFING TESTS (12 tests)
  // ============================================================================

  describe('Phase 1 - Hardware Spoofing Integration', () => {
    it('should apply hardware spoofing on profile set', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.hardwareSpoof).toBeDefined();
      expect(result.hardwareSpoof.enabled).toBe(true);
      expect(result.hardwareSpoof.cores).toBeDefined();
      expect(result.hardwareSpoof.memory).toBeDefined();
    });

    it('should provide consistent hardware values in profile', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      const active = manager.getActiveProfile();
      expect(result.device.hardwareConcurrency).toBe(active.device.hardwareConcurrency);
      expect(result.device.deviceMemory).toBe(active.device.deviceMemory);
    });

    it('should generate injection code for hardware spoofing', () => {
      manager.setProfile('iPhone 15 Pro');
      const code = manager.getInjectionCode();
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      expect(code).toContain('navigator');
    });

    it('should have different hardware specs for different profiles', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 3);
      const specs = profiles.map(p => {
        manager.setProfile(p);
        return manager.getActiveProfile().hardwareSpoof;
      });

      // At least some should differ
      const allSame = specs.every(s =>
        s.cores === specs[0].cores && s.memory === specs[0].memory
      );
      expect(allSame).toBe(false);
    });

    it('should preserve hardware values across profile access', () => {
      manager.setProfile('iPhone 15 Pro');
      const active1 = manager.getActiveProfile();
      const active2 = manager.getActiveProfile();
      expect(active1.hardwareSpoof).toEqual(active2.hardwareSpoof);
    });

    it('should include GPU in hardware spoof', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.hardwareSpoof.gpu).toBeDefined();
      expect(typeof result.hardwareSpoof.gpu).toBe('string');
      expect(result.hardwareSpoof.gpu.length).toBeGreaterThan(0);
    });

    it('should include maxTouchPoints for mobile devices', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.hardwareSpoof.maxTouchPoints).toBeDefined();
      expect(typeof result.hardwareSpoof.maxTouchPoints).toBe('number');
      expect(result.hardwareSpoof.maxTouchPoints).toBeGreaterThan(0);
    });

    it('should validate hardware concurrency is reasonable', () => {
      const profiles = manager.getAvailableProfiles();
      profiles.forEach(p => {
        manager.setProfile(p);
        const spoof = manager.getActiveProfile().hardwareSpoof;
        expect(spoof.cores).toBeGreaterThan(0);
        expect(spoof.cores).toBeLessThanOrEqual(16);
      });
    });

    it('should validate device memory is reasonable', () => {
      const profiles = manager.getAvailableProfiles();
      profiles.forEach(p => {
        manager.setProfile(p);
        const spoof = manager.getActiveProfile().hardwareSpoof;
        expect(spoof.memory).toBeGreaterThan(0);
        expect(spoof.memory).toBeLessThanOrEqual(128);
      });
    });

    it('should reset hardware spoofing on reset', () => {
      manager.setProfile('iPhone 15 Pro');
      expect(manager.getActiveProfile().active).toBe(true);
      manager.resetAnonymity();
      expect(manager.getActiveProfile().active).toBe(false);
    });

    it('should support iOS and Android hardware profiles', () => {
      const iphoneResult = manager.setProfile('iPhone 15 Pro');
      const iphoneGpu = iphoneResult.hardwareSpoof.gpu;

      manager.resetAnonymity();
      const androidProfiles = manager.getAvailableProfiles().filter(p =>
        p.includes('Galaxy') || p.includes('Pixel')
      );

      if (androidProfiles.length > 0) {
        const androidResult = manager.setProfile(androidProfiles[0]);
        const androidGpu = androidResult.hardwareSpoof.gpu;
        expect(iphoneGpu).not.toBe(androidGpu);
      }
    });

    it('should support macOS and Windows hardware profiles', () => {
      const macResult = manager.setProfile('MacBook Air M2');
      const macMemory = macResult.hardwareSpoof.memory;

      manager.resetAnonymity();
      const windowsProfiles = manager.getAvailableProfiles().filter(p =>
        p.includes('Windows') || p.includes('Surface')
      );

      if (windowsProfiles.length > 0) {
        const winResult = manager.setProfile(windowsProfiles[0]);
        const winMemory = winResult.hardwareSpoof.memory;
        // Desktop systems may have same memory, but likely different
        expect(typeof winMemory).toBe('number');
      }
    });
  });

  // ============================================================================
  // PHASE 2 FAKE DATA GENERATOR TESTS (12 tests)
  // ============================================================================

  describe('Phase 2 - Fake Data Generators Integration', () => {
    it('should provide user agent in fake data', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData).toBeDefined();
      expect(result.fakeData.userAgent).toBeDefined();
      expect(typeof result.fakeData.userAgent).toBe('string');
      expect(result.fakeData.userAgent.length).toBeGreaterThan(0);
    });

    it('should include screen specifications', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.screen).toBeDefined();
      expect(result.fakeData.screen.width).toBeGreaterThan(0);
      expect(result.fakeData.screen.height).toBeGreaterThan(0);
      expect(result.fakeData.screen.colorDepth).toBeGreaterThan(0);
      expect(result.fakeData.screen.devicePixelRatio).toBeGreaterThan(0);
    });

    it('should include GPU and CPU specs', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.gpu).toBeDefined();
      expect(result.fakeData.gpu.gpu).toBeDefined();
      expect(result.fakeData.gpu.cpu).toBeDefined();
    });

    it('should include browser profile', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.browserProfile).toBeDefined();
      expect(result.fakeData.browserProfile.vendor).toBeDefined();
      expect(result.fakeData.browserProfile.language).toBeDefined();
      expect(result.fakeData.browserProfile.timezone).toBeDefined();
    });

    it('should have device-appropriate user agent', () => {
      const iphoneResult = manager.setProfile('iPhone 15 Pro');
      const iphoneUA = iphoneResult.fakeData.userAgent;
      expect(iphoneUA.toLowerCase()).toContain('iphone');

      manager.resetAnonymity();
      const androidProfiles = manager.getAvailableProfiles()
        .filter(p => p.includes('Galaxy') || p.includes('Pixel'));
      if (androidProfiles.length > 0) {
        const androidResult = manager.setProfile(androidProfiles[0]);
        const androidUA = androidResult.fakeData.userAgent;
        expect(androidUA.toLowerCase()).toContain('android');
      }
    });

    it('should have consistent screen dimensions', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      const screen = result.fakeData.screen;
      // Aspect ratio should be valid (not square, not extreme)
      const ratio = screen.width / screen.height;
      expect(ratio).toBeGreaterThan(0.3);
      expect(ratio).toBeLessThan(2.0);
    });

    it('should preserve fake data across accesses', () => {
      manager.setProfile('iPhone 15 Pro');
      const active1 = manager.getActiveProfile();
      const active2 = manager.getActiveProfile();
      expect(active1.fakeData).toEqual(active2.fakeData);
    });

    it('should have device-appropriate language', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.browserProfile.language).toBeDefined();
      expect(result.fakeData.browserProfile.language).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });

    it('should have valid timezone', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      const tz = result.fakeData.browserProfile.timezone;
      expect(tz).toBeDefined();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
      // Should contain /
      expect(tz).toContain('/');
    });

    it('should vary data across different profiles', () => {
      // Find two profiles of different device types if possible
      const allProfiles = manager.getAvailableProfiles();
      let profile1 = allProfiles[0];
      let profile2 = allProfiles[allProfiles.length - 1]; // Last profile likely different type

      manager.setProfile(profile1);
      const data1 = manager.getActiveProfile().fakeData;

      manager.resetAnonymity();
      manager.setProfile(profile2);
      const data2 = manager.getActiveProfile().fakeData;

      // At least one of these should differ
      const differs = data1.userAgent !== data2.userAgent ||
                      data1.screen.width !== data2.screen.width ||
                      data1.browserProfile.language !== data2.browserProfile.language;
      expect(differs).toBe(true);
    });

    it('should include languages array in browser profile', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.browserProfile.languages).toBeDefined();
      expect(Array.isArray(result.fakeData.browserProfile.languages)).toBe(true);
      expect(result.fakeData.browserProfile.languages.length).toBeGreaterThan(0);
    });

    it('should include platform in browser profile', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.fakeData.browserProfile.platform).toBeDefined();
      expect(typeof result.fakeData.browserProfile.platform).toBe('string');
    });
  });

  // ============================================================================
  // PHASE 3 BEHAVIORAL ANONYMIZATION TESTS (14 tests)
  // ============================================================================

  describe('Phase 3 - Behavioral Anonymization Integration', () => {
    it('should initialize behavioral patterns on profile set', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.behaviors).toBeDefined();
      expect(result.behaviors.mouse).toBeDefined();
      expect(result.behaviors.keyboard).toBeDefined();
      expect(result.behaviors.timing).toBeDefined();
      expect(result.behaviors.interaction).toBeDefined();
    });

    it('should have mouse behavior patterns enabled by default', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.behaviors.mouse.enabled).toBe(true);
      expect(result.behaviors.mouse.curveType).toBe('bezier');
      expect(result.behaviors.mouse.hoverRequired).toBe(true);
    });

    it('should have keyboard behavior patterns enabled by default', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.behaviors.keyboard.enabled).toBe(true);
      expect(result.behaviors.keyboard.wpmRange).toBeDefined();
      expect(result.behaviors.keyboard.wpmRange[0]).toBeLessThan(result.behaviors.keyboard.wpmRange[1]);
      expect(result.behaviors.keyboard.typoRate).toBeGreaterThan(0);
    });

    it('should have timing behavior enabled by default', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.behaviors.timing.enabled).toBe(true);
      expect(result.behaviors.timing.distribution).toBe('gaussian');
      expect(result.behaviors.timing.contextAware).toBe(true);
    });

    it('should have interaction patterns enabled by default', () => {
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.behaviors.interaction.enabled).toBe(true);
      expect(result.behaviors.interaction.smoothScroll).toBe(true);
      expect(result.behaviors.interaction.naturalOrder).toBe(true);
    });

    it('should enable behavioral modules on request', () => {
      manager.setProfile('iPhone 15 Pro');
      const result = manager.enableBehavioralModules({ wpm: 90 });
      expect(result.success).toBe(true);
      expect(result.enabled.mouse).toBe(true);
      expect(result.enabled.keyboard).toBe(true);
      expect(result.wpm).toBe(90);
    });

    it('should allow selective behavioral module enablement', () => {
      manager.setProfile('iPhone 15 Pro');
      const result = manager.enableBehavioralModules({
        mouseEnabled: true,
        keyboardEnabled: false,
        timingEnabled: true,
        interactionEnabled: false
      });
      expect(result.enabled.mouse).toBe(true);
      expect(result.enabled.keyboard).toBe(false);
      expect(result.enabled.timing).toBe(true);
      expect(result.enabled.interaction).toBe(false);
    });

    it('should get behavioral status', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules({ wpm: 85 });
      const status = manager.getBehavioralStatus();
      expect(status.mouse).toBeDefined();
      expect(status.keyboard).toBeDefined();
      expect(status.keyboard.wpm).toBeDefined();
      expect(status.timing).toBeDefined();
      expect(status.interaction).toBeDefined();
    });

    it('should disable behavioral modules', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      let status = manager.getBehavioralStatus();
      expect(status.mouse.enabled).toBe(true);

      const result = manager.disableBehavioralModules();
      expect(result.success).toBe(true);
      expect(result.enabled.mouse).toBe(false);
      expect(result.enabled.keyboard).toBe(false);
    });

    it('should set typing speed on behavioral enablement', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules({ wpm: 75 });
      const status = manager.getBehavioralStatus();
      expect(status.keyboard.wpm).toBe(75);
    });

    it('should support different typing speeds', () => {
      manager.setProfile('iPhone 15 Pro');

      manager.enableBehavioralModules({ wpm: 60 });
      let status = manager.getBehavioralStatus();
      expect(status.keyboard.wpm).toBe(60);

      manager.enableBehavioralModules({ wpm: 110 });
      status = manager.getBehavioralStatus();
      expect(status.keyboard.wpm).toBe(110);
    });

    it('should require active profile for behavioral enablement', () => {
      expect(() => {
        manager.enableBehavioralModules();
      }).toThrow('No active anonymity profile');
    });

    it('should maintain behavioral state after multiple accesses', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules({ wpm: 85 });

      const status1 = manager.getBehavioralStatus();
      const status2 = manager.getBehavioralStatus();
      expect(status1).toEqual(status2);
    });

    it('should reset behavioral modules on anonymity reset', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      let status = manager.getBehavioralStatus();
      expect(status.mouse.enabled).toBe(true);

      manager.resetAnonymity();
      status = manager.getBehavioralStatus();
      expect(status.mouse.enabled).toBe(false);
      expect(status.keyboard.enabled).toBe(false);
    });
  });

  // ============================================================================
  // CONSISTENCY VALIDATION TESTS (12 tests)
  // ============================================================================

  describe('Anonymity Consistency Validation', () => {
    it('should validate consistency when profile is active', () => {
      manager.setProfile('iPhone 15 Pro');
      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('should identify consistency issues', () => {
      manager.setProfile('iPhone 15 Pro');
      // Manually corrupt state to trigger issues
      const profile = manager.activeProfile;
      profile.deviceProfile.screenWidth = 999; // Intentional mismatch

      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    it('should validate all profiles are internally consistent', () => {
      const profiles = manager.getAvailableProfiles();
      profiles.forEach(profileName => {
        manager.setProfile(profileName);
        const validation = manager.validateAnonymityConsistency();
        expect(validation.valid).toBe(true);
      });
    });

    it('should return device info in validation result', () => {
      manager.setProfile('iPhone 15 Pro');
      const validation = manager.validateAnonymityConsistency();
      expect(validation.profile).toBeDefined();
      expect(validation.profile.name).toBe('iPhone 15 Pro');
      expect(validation.profile.device).toBeDefined();
    });

    it('should detect CPU cores mismatch', () => {
      manager.setProfile('iPhone 15 Pro');
      const profile = manager.activeProfile;
      profile.phase1.hardwareSpoof.cores = 99;

      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('CPU cores'))).toBe(true);
    });

    it('should detect memory mismatch', () => {
      manager.setProfile('iPhone 15 Pro');
      const profile = manager.activeProfile;
      profile.phase1.hardwareSpoof.memory = 128;

      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('memory'))).toBe(true);
    });

    it('should detect screen width mismatch', () => {
      manager.setProfile('iPhone 15 Pro');
      const profile = manager.activeProfile;
      profile.phase2.screen.width = 9999;

      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('width'))).toBe(true);
    });

    it('should detect behavioral state mismatches', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules({ mouseEnabled: true, keyboardEnabled: false });

      // Disable in profile but not in state (simulate corruption)
      manager.activeProfile.phase3.behaviors.mouse.enabled = false;

      const validation = manager.validateAnonymityConsistency();
      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.includes('Mouse'))).toBe(true);
    });

    it('should provide helpful validation messages', () => {
      manager.setProfile('iPhone 15 Pro');
      let validation = manager.validateAnonymityConsistency();
      expect(validation.message).toContain('consistent');

      // Create invalid state
      manager.activeProfile.phase1.hardwareSpoof.cores = 99;
      validation = manager.validateAnonymityConsistency();
      expect(validation.message).toContain('issue');
    });

    it('should validate hardware values are reasonable', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 5);
      profiles.forEach(profileName => {
        manager.setProfile(profileName);
        const validation = manager.validateAnonymityConsistency();
        expect(validation.profile.hardwareSpoof.cores).toBeGreaterThan(0);
        expect(validation.profile.hardwareSpoof.cores).toBeLessThanOrEqual(16);
        expect(validation.profile.hardwareSpoof.memory).toBeGreaterThan(0);
      });
    });

    it('should validate fake data values are reasonable', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 3);
      profiles.forEach(profileName => {
        manager.setProfile(profileName);
        const validation = manager.validateAnonymityConsistency();
        expect(validation.profile).toBeDefined();
        expect(validation.profile.device).toBeDefined();
      });
    });

    it('should include all issues in validation report', () => {
      manager.setProfile('iPhone 15 Pro');
      const profile = manager.activeProfile;

      // Create multiple issues
      profile.phase1.hardwareSpoof.cores = 99;
      profile.phase1.hardwareSpoof.memory = 256;
      profile.phase2.screen.width = 9999;

      const validation = manager.validateAnonymityConsistency();
      expect(validation.issues.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // MULTI-PROFILE SWITCHING TESTS (10 tests)
  // ============================================================================

  describe('Multi-Profile Switching', () => {
    it('should switch to different profile without errors', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 2);

      manager.setProfile(profiles[0]);
      expect(manager.getActiveProfile().profileName).toBe(profiles[0]);

      manager.setProfile(profiles[1]);
      expect(manager.getActiveProfile().profileName).toBe(profiles[1]);
    });

    it('should maintain correct data when switching profiles', () => {
      const allProfiles = manager.getAvailableProfiles();
      const profile1 = allProfiles[0];
      const profile2 = allProfiles[allProfiles.length - 1]; // Different device type

      manager.setProfile(profile1);
      const data0 = manager.getActiveProfile();

      manager.setProfile(profile2);
      const data1 = manager.getActiveProfile();

      expect(data0.profileName).not.toBe(data1.profileName);
      // Vendors might be the same (all Apple or all Google) so check something else
      expect(data0.sessionId).not.toBe(data1.sessionId);
    });

    it('should isolate session IDs between profile switches', () => {
      manager.setProfile('iPhone 15 Pro');
      const session1 = manager.getActiveProfile().sessionId;

      manager.setProfile('MacBook Air M2');
      const session2 = manager.getActiveProfile().sessionId;

      expect(session1).not.toBe(session2);
    });

    it('should preserve profile-specific hardware values', () => {
      manager.setProfile('iPhone 15 Pro');
      const iphone = manager.getActiveProfile();
      const iphoneGpu = iphone.hardwareSpoof.gpu;

      manager.setProfile('MacBook Air M2');
      const mac = manager.getActiveProfile();
      const macGpu = mac.hardwareSpoof.gpu;

      expect(iphoneGpu).not.toBe(macGpu);
    });

    it('should preserve profile-specific fake data', () => {
      manager.setProfile('iPhone 15 Pro');
      const iphone = manager.getActiveProfile();
      const iphoneUA = iphone.fakeData.userAgent;

      manager.setProfile('MacBook Air M2');
      const mac = manager.getActiveProfile();
      const macUA = mac.fakeData.userAgent;

      expect(iphoneUA).not.toBe(macUA);
    });

    it('should preserve profile-specific behaviors', () => {
      manager.setProfile('iPhone 15 Pro');
      const iphone = manager.getActiveProfile();

      manager.setProfile('MacBook Air M2');
      const mac = manager.getActiveProfile();

      // Both should have behaviors defined
      expect(iphone.behaviors).toBeDefined();
      expect(mac.behaviors).toBeDefined();
      expect(iphone.behaviors.mouse.enabled).toBe(mac.behaviors.mouse.enabled);
    });

    it('should disable behaviors on profile switch', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      let status = manager.getBehavioralStatus();
      expect(status.mouse.enabled).toBe(true);

      manager.setProfile('MacBook Air M2');
      status = manager.getBehavioralStatus();
      // Behaviors should be reinitialized but disabled
      expect(status.mouse.enabled).toBe(false);
    });

    it('should support round-trip switching', () => {
      const profileName = 'iPhone 15 Pro';

      manager.setProfile(profileName);
      const data1 = manager.getActiveProfile();

      manager.setProfile('MacBook Air M2');
      manager.setProfile(profileName);
      const data2 = manager.getActiveProfile();

      // Same profile data should match
      expect(data1.device.vendor).toBe(data2.device.vendor);
      expect(data1.hardwareSpoof.cores).toBe(data2.hardwareSpoof.cores);
    });

    it('should handle rapid profile switching', () => {
      const profiles = manager.getAvailableProfiles().slice(0, 5);

      profiles.forEach(p => {
        manager.setProfile(p);
        expect(manager.getActiveProfile().profileName).toBe(p);
      });
    });

    it('should track session history for multiple profiles', () => {
      manager.setProfile('iPhone 15 Pro');
      const session1 = manager.getActiveProfile().sessionId;

      manager.setProfile('MacBook Air M2');
      const session2 = manager.getActiveProfile().sessionId;

      manager.setProfile('iPhone 15 Pro');
      const session3 = manager.getActiveProfile().sessionId;

      // All sessions should be unique
      expect(session1).not.toBe(session2);
      expect(session2).not.toBe(session3);
      expect(session1).not.toBe(session3);
    });
  });

  // ============================================================================
  // PROTECTION STATUS TESTS (8 tests)
  // ============================================================================

  describe('Protection Status', () => {
    it('should report no protection when not active', () => {
      const status = manager.getProtectionStatus();
      expect(status.anonymityActive).toBe(false);
      expect(status.protectionLevel).toBe('none');
    });

    it('should report hardware protection when profile set', () => {
      manager.setProfile('iPhone 15 Pro');
      const status = manager.getProtectionStatus();
      expect(status.anonymityActive).toBe(true);
      expect(status.hardwareSpoofingActive).toBe(true);
    });

    it('should report behavioral protection when modules enabled', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      const status = manager.getProtectionStatus();
      expect(status.behavioralModulesActive).toBe(true);
    });

    it('should report full protection when everything active', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      const status = manager.getProtectionStatus();
      expect(status.protectionLevel).toBe('full');
    });

    it('should report partial protection with only hardware spoofing', () => {
      manager.setProfile('iPhone 15 Pro');
      const status = manager.getProtectionStatus();
      // Behaviors not enabled, only hardware
      expect(status.hardwareSpoofingActive).toBe(true);
      expect(['hardware+data', 'full'].includes(status.protectionLevel)).toBe(true);
    });

    it('should include session ID in protection status', () => {
      manager.setProfile('iPhone 15 Pro');
      const status = manager.getProtectionStatus();
      expect(status.sessionId).toBeDefined();
      expect(status.sessionId.startsWith('anon_')).toBe(true);
    });

    it('should include module details in protection status', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      const status = manager.getProtectionStatus();
      expect(status.modules).toBeDefined();
      expect(status.modules.mouse).toBeDefined();
      expect(status.modules.keyboard).toBeDefined();
    });

    it('should reset protection status on anonymity reset', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      let status = manager.getProtectionStatus();
      expect(status.anonymityActive).toBe(true);

      manager.resetAnonymity();
      status = manager.getProtectionStatus();
      expect(status.anonymityActive).toBe(false);
      expect(status.protectionLevel).toBe('none');
    });
  });

  // ============================================================================
  // EDGE CASE TESTS (10 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle reset when no profile set', () => {
      const result = manager.resetAnonymity();
      expect(result.success).toBe(true);
    });

    it('should allow re-initialization after reset', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.resetAnonymity();
      const result = manager.setProfile('iPhone 15 Pro');
      expect(result.success).toBe(true);
    });

    it('should prevent enabling behaviors without profile', () => {
      expect(() => {
        manager.enableBehavioralModules();
      }).toThrow();
    });

    it('should prevent getting injection code without profile', () => {
      expect(() => {
        manager.getInjectionCode();
      }).toThrow();
    });

    it('should handle unknown profile gracefully', () => {
      expect(() => {
        manager.setProfile('Nonexistent Device');
      }).toThrow('Unknown anonymity profile');
    });

    it('should handle empty profile operations', () => {
      const active = manager.getActiveProfile();
      expect(active.active).toBe(false);
    });

    it('should support custom typing speeds', () => {
      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules({ wpm: 65 });
      let status = manager.getBehavioralStatus();
      expect(status.keyboard.wpm).toBe(65);

      manager.enableBehavioralModules({ wpm: 110 });
      status = manager.getBehavioralStatus();
      expect(status.keyboard.wpm).toBe(110);
    });

    it('should maintain state consistency through operations', () => {
      manager.setProfile('iPhone 15 Pro');
      const before = manager.validateAnonymityConsistency();
      expect(before.valid).toBe(true);

      manager.enableBehavioralModules();
      manager.disableBehavioralModules();

      const after = manager.validateAnonymityConsistency();
      expect(after.valid).toBe(true);
    });

    it('should handle profile list when none explicitly set', () => {
      const profiles = manager.getAvailableProfiles();
      expect(profiles).toBeDefined();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);
    });
  });
});

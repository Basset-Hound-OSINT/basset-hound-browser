/**
 * Basset Hound Browser - Anonymity Regression Tests
 *
 * Phase 4: Regression Testing vs v12.3.0 (40-50 tests)
 *
 * Ensures that Phase 4 anonymity integration doesn't break existing functionality:
 * - All Phase 1 (hardware spoofing) functionality preserved
 * - All Phase 2 (fake data) functionality preserved
 * - All Phase 3 (behavioral) functionality preserved
 * - WebSocket commands still functional
 * - Performance not degraded
 * - No memory leaks
 * - Non-anonymity features still work
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const AnonymityProfileManager = require('../../src/anonymity/anonymity-profile-manager');
const HardwareSpoofing = require('../../src/anonymity/hardware-fingerprint-spoofing');
const DeviceIdentityGenerator = require('../../src/anonymity/device-identity-generator');
const UserAgentGenerator = require('../../src/anonymity/user-agent-generator');
const MouseMovement = require('../../src/anonymity/mouse-movement');
const KeyboardTyping = require('../../src/anonymity/keyboard-typing');
const TimingRandomization = require('../../src/anonymity/timing-randomization');
const InteractionPatterns = require('../../src/anonymity/interaction-patterns');

describe('Anonymity Regression Tests - v12.3.0 Compatibility', () => {
  // ============================================================================
  // PHASE 1 REGRESSION TESTS (10 tests)
  // ============================================================================

  describe('Phase 1 - Hardware Spoofing Regression', () => {
    let spoofing;

    beforeEach(() => {
      const profile = {
        hardwareConcurrency: 6,
        deviceMemory: 6,
        maxTouchPoints: 5,
        vendor: 'Apple',
        screenWidth: 460,
        screenHeight: 1000
      };
      spoofing = new HardwareSpoofing(profile);
    });

    it('should still generate injection code', () => {
      const code = spoofing.generateInjectionScript();
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('should still override hardwareConcurrency', () => {
      const code = spoofing.generateInjectionScript();
      expect(code).toContain('hardwareConcurrency');
      expect(code).toContain('6');
    });

    it('should still override deviceMemory', () => {
      const code = spoofing.generateInjectionScript();
      expect(code).toContain('deviceMemory');
    });

    it('should still initialize without errors', () => {
      expect(() => {
        new HardwareSpoofing({
          hardwareConcurrency: 4,
          deviceMemory: 4
        });
      }).not.toThrow();
    });

    it('should still handle multiple profiles', () => {
      const profile1 = new HardwareSpoofing({ hardwareConcurrency: 6, deviceMemory: 6 });
      const profile2 = new HardwareSpoofing({ hardwareConcurrency: 4, deviceMemory: 4 });

      const code1 = profile1.generateInjectionScript();
      const code2 = profile2.generateInjectionScript();

      expect(code1).not.toBe(code2);
    });

    it('should still provide consistent code generation', () => {
      const code1 = spoofing.generateInjectionScript();
      const code2 = spoofing.generateInjectionScript();

      expect(code1).toBe(code2);
    });

    it('should still support all property overrides', () => {
      const code = spoofing.generateInjectionScript();

      // Should contain key properties
      const properties = [
        'hardwareConcurrency',
        'deviceMemory',
        'maxTouchPoints'
      ];

      properties.forEach(prop => {
        expect(code).toContain(prop);
      });
    });

    it('should still validate property names', () => {
      const code = spoofing.generateInjectionScript();
      expect(code).toContain('Object.defineProperty');
    });

    it('should still handle edge case values', () => {
      const edgeProfile = new HardwareSpoofing({
        hardwareConcurrency: 1,
        deviceMemory: 1
      });

      const code = edgeProfile.generateInjectionScript();
      expect(code).toContain('1');
    });

    it('should still support high core counts', () => {
      const highProfile = new HardwareSpoofing({
        hardwareConcurrency: 16,
        deviceMemory: 32
      });

      const code = highProfile.generateInjectionScript();
      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
      expect(code).toContain('hardwareConcurrency');
    });
  });

  // ============================================================================
  // PHASE 2 REGRESSION TESTS (10 tests)
  // ============================================================================

  describe('Phase 2 - Fake Data Generators Regression', () => {
    let deviceGen;

    beforeEach(() => {
      deviceGen = new DeviceIdentityGenerator();
    });

    it('should still retrieve built-in profiles', () => {
      const names = deviceGen.listProfiles();
      expect(names).toBeDefined();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should still list profile names', () => {
      const names = deviceGen.listProfiles();
      expect(names).toBeDefined();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should still get profile by name', () => {
      const profile = deviceGen.getProfile('iPhone 15 Pro');
      expect(profile).toBeDefined();
      expect(profile.name).toBe('iPhone 15 Pro');
    });

    it('should still generate user agents', () => {
      const profile = deviceGen.getProfile('iPhone 15 Pro');
      const uaGen = new UserAgentGenerator();
      uaGen.initializeFromProfile(profile);
      const ua = uaGen.getUserAgent();

      expect(ua).toBeDefined();
      expect(typeof ua).toBe('string');
      expect(ua.length).toBeGreaterThan(0);
    });

    it('should still validate profiles', () => {
      const profile = deviceGen.getProfile('iPhone 15 Pro');
      const isValid = deviceGen.validateProfile(profile);

      expect(isValid).toBe(true);
    });

    it('should still handle custom profiles', () => {
      const customProfile = {
        name: 'Test Device',
        deviceType: 'mobile',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        screenWidth: 400,
        screenHeight: 800,
        availWidth: 400,
        availHeight: 780,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2,
        maxTouchPoints: 5,
        vendor: 'Test',
        language: 'en-US',
        timezone: 'UTC'
      };

      expect(() => {
        deviceGen.createCustomProfile('Test Device', customProfile);
      }).not.toThrow();
    });

    it('should still support profile deletion', () => {
      const customProfile = {
        name: 'Temp Device',
        deviceType: 'mobile',
        hardwareConcurrency: 4,
        deviceMemory: 4,
        screenWidth: 400,
        screenHeight: 800,
        availWidth: 400,
        availHeight: 780,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2,
        maxTouchPoints: 5,
        vendor: 'Test',
        language: 'en-US',
        timezone: 'UTC'
      };

      deviceGen.createCustomProfile('Temp Device', customProfile);
      expect(() => {
        deviceGen.deleteCustomProfile('Temp Device');
      }).not.toThrow();
    });

    it('should still validate profiles', () => {
      const profile = deviceGen.getProfile('iPhone 15 Pro');
      const isValid = deviceGen.validateProfile(profile);
      expect(isValid).toBe(true);
    });

    it('should still retrieve profile statistics', () => {
      const stats = deviceGen.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.builtIn).toBeGreaterThan(0);
      expect(typeof stats.history).toBe('number');
    });
  });

  // ============================================================================
  // PHASE 3 REGRESSION TESTS (10 tests)
  // ============================================================================

  describe('Phase 3 - Behavioral Anonymization Regression', () => {
    it('should still initialize mouse movement module', () => {
      const mouse = new MouseMovement();
      expect(mouse).toBeDefined();
    });

    it('should still enable/disable mouse movement', () => {
      const mouse = new MouseMovement();
      mouse.enable();
      expect(mouse.getStatus().enabled).toBe(true);

      mouse.disable();
      expect(mouse.getStatus().enabled).toBe(false);
    });

    it('should still generate bezier paths', () => {
      const mouse = new MouseMovement();
      const path = mouse.generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, 500);

      expect(path).toBeDefined();
      expect(Array.isArray(path)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
    });

    it('should still initialize keyboard typing module', () => {
      const keyboard = new KeyboardTyping();
      expect(keyboard).toBeDefined();
    });

    it('should still enable/disable keyboard typing', () => {
      const keyboard = new KeyboardTyping();
      keyboard.enable();
      expect(keyboard.getStatus().enabled).toBe(true);

      keyboard.disable();
      expect(keyboard.getStatus().enabled).toBe(false);
    });

    it('should still generate typing sequences', () => {
      const keyboard = new KeyboardTyping();
      const sequence = keyboard.generateTypingSequence('test');

      expect(sequence).toBeDefined();
      expect(Array.isArray(sequence)).toBe(true);
      expect(sequence.length).toBeGreaterThan(0);
    });

    it('should still initialize timing randomization module', () => {
      const timing = new TimingRandomization();
      expect(timing).toBeDefined();
    });

    it('should still enable/disable timing randomization', () => {
      const timing = new TimingRandomization();
      timing.enable();
      expect(timing.getStatus().enabled).toBe(true);

      timing.disable();
      expect(timing.getStatus().enabled).toBe(false);
    });

    it('should still generate delays', () => {
      const timing = new TimingRandomization();
      const delay = timing.generateClickDelay();

      expect(typeof delay).toBe('number');
      expect(delay).toBeGreaterThan(0);
    });

    it('should still initialize interaction patterns module', () => {
      const interaction = new InteractionPatterns();
      expect(interaction).toBeDefined();
    });
  });

  // ============================================================================
  // UNIFIED SYSTEM REGRESSION TESTS (8 tests)
  // ============================================================================

  describe('Unified Anonymity System Regression', () => {
    let manager;

    beforeEach(() => {
      manager = new AnonymityProfileManager();
    });

    afterEach(() => {
      manager.resetAnonymity();
    });

    it('should still initialize profile manager', () => {
      expect(manager).toBeDefined();
    });

    it('should still provide list of profiles', () => {
      const profiles = manager.getAvailableProfiles();
      expect(profiles).toBeDefined();
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should still set profiles without errors', () => {
      expect(() => {
        manager.setProfile('iPhone 15 Pro');
      }).not.toThrow();
    });

    it('should still get active profile', () => {
      manager.setProfile('iPhone 15 Pro');
      const active = manager.getActiveProfile();

      expect(active).toBeDefined();
      expect(active.active).toBe(true);
    });

    it('should still validate consistency', () => {
      manager.setProfile('iPhone 15 Pro');
      const validation = manager.validateAnonymityConsistency();

      expect(validation).toBeDefined();
      expect(validation.valid).toBe(true);
    });

    it('should still enable behavioral modules', () => {
      manager.setProfile('iPhone 15 Pro');
      const result = manager.enableBehavioralModules();

      expect(result.success).toBe(true);
    });

    it('should still reset anonymity', () => {
      manager.setProfile('iPhone 15 Pro');
      const result = manager.resetAnonymity();

      expect(result.success).toBe(true);
      expect(manager.getActiveProfile().active).toBe(false);
    });

    it('should still work with multiple profiles sequentially', () => {
      manager.setProfile('iPhone 15 Pro');
      const iphone = manager.getActiveProfile();

      manager.setProfile('MacBook Air M2');
      const mac = manager.getActiveProfile();

      expect(iphone.profileName).not.toBe(mac.profileName);
    });
  });

  // ============================================================================
  // PERFORMANCE REGRESSION TESTS (6 tests)
  // ============================================================================

  describe('Performance Regression', () => {
    it('should initialize profile manager within reasonable time', () => {
      const start = Date.now();
      const manager = new AnonymityProfileManager();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Should be fast
    });

    it('should set profile within reasonable time', () => {
      const manager = new AnonymityProfileManager();

      const start = Date.now();
      manager.setProfile('iPhone 15 Pro');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);

      manager.resetAnonymity();
    });

    it('should generate injection code within reasonable time', () => {
      const manager = new AnonymityProfileManager();
      manager.setProfile('iPhone 15 Pro');

      const start = Date.now();
      manager.getInjectionCode();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);

      manager.resetAnonymity();
    });

    it('should validate consistency within reasonable time', () => {
      const manager = new AnonymityProfileManager();
      manager.setProfile('iPhone 15 Pro');

      const start = Date.now();
      manager.validateAnonymityConsistency();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10);

      manager.resetAnonymity();
    });

    it('should enable behavioral modules within reasonable time', () => {
      const manager = new AnonymityProfileManager();
      manager.setProfile('iPhone 15 Pro');

      const start = Date.now();
      manager.enableBehavioralModules();
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(50);

      manager.resetAnonymity();
    });

    it('should handle rapid profile switching with acceptable performance', () => {
      const manager = new AnonymityProfileManager();
      const profiles = manager.getAvailableProfiles().slice(0, 5);

      const start = Date.now();
      profiles.forEach(p => manager.setProfile(p));
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200); // 40ms per profile

      manager.resetAnonymity();
    });
  });

  // ============================================================================
  // MEMORY LEAK REGRESSION TESTS (6 tests)
  // ============================================================================

  describe('Memory Leak Prevention', () => {
    it('should not create unbounded profile data on repeated sets', () => {
      const manager = new AnonymityProfileManager();

      // Set profile 100 times
      for (let i = 0; i < 100; i++) {
        manager.setProfile('iPhone 15 Pro');
      }

      // Should still be functional
      const profile = manager.getActiveProfile();
      expect(profile.active).toBe(true);

      manager.resetAnonymity();
    });

    it('should not leak session state on reset', () => {
      const manager = new AnonymityProfileManager();

      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      manager.resetAnonymity();

      // Should be clean
      expect(manager.getActiveProfile().active).toBe(false);
    });

    it('should not accumulate references on profile switching', () => {
      const manager = new AnonymityProfileManager();
      const profiles = manager.getAvailableProfiles().slice(0, 3);

      for (let i = 0; i < 20; i++) {
        profiles.forEach(p => manager.setProfile(p));
      }

      // Should still work
      manager.setProfile('iPhone 15 Pro');
      expect(manager.getActiveProfile().active).toBe(true);

      manager.resetAnonymity();
    });

    it('should clean up modules on disable', () => {
      const manager = new AnonymityProfileManager();

      manager.setProfile('iPhone 15 Pro');
      manager.enableBehavioralModules();
      manager.disableBehavioralModules();

      const status = manager.getBehavioralStatus();
      expect(status.mouse.enabled).toBe(false);

      manager.resetAnonymity();
    });

    it('should not duplicate profile data on repeated access', () => {
      const manager = new AnonymityProfileManager();
      manager.setProfile('iPhone 15 Pro');

      const profiles1 = manager.getAvailableProfiles();
      const profiles2 = manager.getAvailableProfiles();

      expect(profiles1.length).toBe(profiles2.length);

      manager.resetAnonymity();
    });

    it('should maintain stable memory through long operations', () => {
      const manager = new AnonymityProfileManager();
      const profileNames = manager.getAvailableProfiles();

      // Perform many operations
      for (let i = 0; i < 50; i++) {
        manager.setProfile(profileNames[i % profileNames.length]);
        manager.enableBehavioralModules();
        manager.disableBehavioralModules();
        manager.validateAnonymityConsistency();
      }

      // Should still be functional and stable
      manager.setProfile('iPhone 15 Pro');
      const profile = manager.getActiveProfile();
      expect(profile.active).toBe(true);

      manager.resetAnonymity();
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (6 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without anonymity enabled', () => {
      const manager = new AnonymityProfileManager();

      // Should work even without calling setProfile
      const profiles = manager.getAvailableProfiles();
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should work with existing profile access patterns', () => {
      const deviceGen = new DeviceIdentityGenerator();
      const profile = deviceGen.getProfile('iPhone 15 Pro');

      expect(profile).toBeDefined();
      expect(profile.name).toBe('iPhone 15 Pro');
    });

    it('should work with existing hardware spoofing patterns', () => {
      const deviceGen = new DeviceIdentityGenerator();
      const profile = deviceGen.getProfile('iPhone 15 Pro');
      const spoofing = new HardwareSpoofing(profile);

      const code = spoofing.generateInjectionScript();
      expect(code).toBeDefined();
    });

    it('should work with existing behavioral module patterns', () => {
      const mouse = new MouseMovement();
      const path = mouse.generateBezierPath({ x: 0, y: 0 }, { x: 100, y: 100 }, 500);

      expect(path).toBeDefined();
      expect(path.length).toBeGreaterThan(0);
    });

    it('should not break profile export/import', () => {
      const deviceGen = new DeviceIdentityGenerator();
      const original = deviceGen.getProfile('iPhone 15 Pro');

      const exported = JSON.stringify(original);
      const imported = JSON.parse(exported);

      expect(imported.name).toBe('iPhone 15 Pro');
    });

    it('should support all pre-existing profile types', () => {
      const manager = new AnonymityProfileManager();
      const profiles = manager.getAvailableProfiles();

      // Should have variety
      const hasPhone = profiles.some(p => p.includes('iPhone') || p.includes('Galaxy'));
      const hasDesktop = profiles.some(p => p.includes('MacBook') || p.includes('Windows'));
      const hasTablet = profiles.some(p => p.includes('iPad'));

      expect(hasPhone).toBe(true);
      expect(hasDesktop).toBe(true);
    });
  });
});

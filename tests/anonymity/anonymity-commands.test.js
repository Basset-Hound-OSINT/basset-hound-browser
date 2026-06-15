/**
 * Anonymity WebSocket Commands Tests
 *
 * Tests for WebSocket command integration
 * Target: 10 tests, 100% pass rate
 */

const assert = require('assert');
const {
  registerAnonymityCommands,
  cleanupTabResources,
  HardwareFingerprintSpoofing,
  DeviceIdentityGenerator
} = require('../../websocket/commands/anonymity-commands');

describe('Anonymity WebSocket Commands', () => {
  let commandHandlers;
  let rendererCalls;
  let executeInRenderer;

  beforeEach(() => {
    commandHandlers = {};
    rendererCalls = [];

    // Mock executeInRenderer
    executeInRenderer = async (tabId, script) => {
      rendererCalls.push({ tabId, script });
      return { success: true };
    };

    // Register commands
    registerAnonymityCommands(commandHandlers, executeInRenderer);
  });

  // ==========================================
  // PROFILE COMMAND TESTS
  // ==========================================

  describe('set_anonymity_profile', () => {
    it('should set profile and execute injection script', async () => {
      const result = await commandHandlers.set_anonymity_profile({
        profileName: 'iPhone 15 Pro',
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.profile.name, 'iPhone 15 Pro');
      assert.strictEqual(result.profile.hardwareConcurrency, 6);
      assert.ok(rendererCalls.length > 0);
    });

    it('should reject missing profileName', async () => {
      const result = await commandHandlers.set_anonymity_profile({
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should reject invalid profile name', async () => {
      const result = await commandHandlers.set_anonymity_profile({
        profileName: 'NonExistentProfile',
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should support multiple tabs', async () => {
      const result1 = await commandHandlers.set_anonymity_profile({
        profileName: 'iPhone 15 Pro',
        tabId: 'tab1'
      });
      const result2 = await commandHandlers.set_anonymity_profile({
        profileName: 'Windows Desktop (High-end)',
        tabId: 'tab2'
      });

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      assert.notStrictEqual(
        result1.profile.hardwareConcurrency,
        result2.profile.hardwareConcurrency
      );
    });
  });

  // ==========================================
  // CUSTOM PROPERTIES COMMAND TESTS
  // ==========================================

  describe('set_anonymity_custom', () => {
    it('should set custom properties', async () => {
      const result = await commandHandlers.set_anonymity_custom({
        properties: {
          hardwareConcurrency: 12,
          deviceMemory: 16,
          screenWidth: 1920,
          screenHeight: 1080
        },
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.values.hardwareConcurrency, 12);
      assert.strictEqual(result.values.deviceMemory, 16);
    });

    it('should reject missing properties', async () => {
      const result = await commandHandlers.set_anonymity_custom({
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should reject invalid property values', async () => {
      const result = await commandHandlers.set_anonymity_custom({
        properties: {
          hardwareConcurrency: 999 // Out of range
        },
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should execute injection script', async () => {
      await commandHandlers.set_anonymity_custom({
        properties: {
          hardwareConcurrency: 8,
          deviceMemory: 16
        },
        tabId: 'tab1'
      });

      assert.ok(rendererCalls.length > 0);
      const lastCall = rendererCalls[rendererCalls.length - 1];
      assert.strictEqual(lastCall.tabId, 'tab1');
      assert.ok(lastCall.script.includes('hardwareConcurrency'));
    });
  });

  // ==========================================
  // GET PROFILE COMMAND TESTS
  // ==========================================

  describe('get_anonymity_profile', () => {
    it('should get current profile', async () => {
      // Set a profile first
      await commandHandlers.set_anonymity_profile({
        profileName: 'Samsung Galaxy S24',
        tabId: 'tab1'
      });

      const result = await commandHandlers.get_anonymity_profile({
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.profile.hardwareConcurrency);
      assert.ok(result.profile.deviceMemory);
    });

    it('should return default profile if not set', async () => {
      const result = await commandHandlers.get_anonymity_profile({
        tabId: 'tab_new'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.profile.hardwareConcurrency);
    });
  });

  // ==========================================
  // LIST PROFILES COMMAND TESTS
  // ==========================================

  describe('list_anonymity_profiles', () => {
    it('should list all profiles', async () => {
      const result = await commandHandlers.list_anonymity_profiles({});

      assert.strictEqual(result.success, true);
      assert.ok(result.count > 0);
      assert.ok(Array.isArray(result.profiles));
      assert.ok(result.profiles.includes('iPhone 15 Pro'));
    });

    it('should filter by device type', async () => {
      const result = await commandHandlers.list_anonymity_profiles({
        deviceType: 'mobile'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.count > 0);
      assert.ok(result.profiles.includes('iPhone 15 Pro'));
    });

    it('should support desktop filter', async () => {
      const result = await commandHandlers.list_anonymity_profiles({
        deviceType: 'desktop'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.count > 0);
    });

    it('should support tablet filter', async () => {
      const result = await commandHandlers.list_anonymity_profiles({
        deviceType: 'tablet'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.count > 0);
    });
  });

  // ==========================================
  // CREATE CUSTOM PROFILE COMMAND TESTS
  // ==========================================

  describe('create_custom_profile', () => {
    it('should create custom profile', async () => {
      const result = await commandHandlers.create_custom_profile({
        name: 'MyCustomDevice',
        config: {
          name: 'MyCustomDevice',
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
        }
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message);
    });

    it('should reject missing name', async () => {
      const result = await commandHandlers.create_custom_profile({
        config: {}
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });

    it('should reject invalid config', async () => {
      const result = await commandHandlers.create_custom_profile({
        name: 'Invalid',
        config: { name: 'Invalid' } // Missing required fields
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  // ==========================================
  // DELETE CUSTOM PROFILE COMMAND TESTS
  // ==========================================

  describe('delete_custom_profile', () => {
    it('should delete custom profile', async () => {
      // Create first
      await commandHandlers.create_custom_profile({
        name: 'ToDelete',
        config: {
          name: 'ToDelete',
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
        }
      });

      const result = await commandHandlers.delete_custom_profile({
        name: 'ToDelete'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message);
    });

    it('should reject deletion of built-in profiles', async () => {
      const result = await commandHandlers.delete_custom_profile({
        name: 'iPhone 15 Pro'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  // ==========================================
  // STATISTICS COMMAND TESTS
  // ==========================================

  describe('get_anonymity_statistics', () => {
    it('should get statistics', async () => {
      const result = await commandHandlers.get_anonymity_statistics({});

      assert.strictEqual(result.success, true);
      assert.ok(result.statistics);
      assert.ok(result.statistics.total > 0);
      assert.ok(result.statistics.builtIn > 0);
    });

    it('should track device types', async () => {
      const result = await commandHandlers.get_anonymity_statistics({});

      assert.ok(result.statistics.byDeviceType);
      assert.ok(result.statistics.byDeviceType.mobile > 0);
      assert.ok(result.statistics.byDeviceType.desktop > 0);
    });
  });

  // ==========================================
  // EXPORT/IMPORT COMMAND TESTS
  // ==========================================

  describe('export_profile', () => {
    it('should export profile as JSON', async () => {
      const result = await commandHandlers.export_profile({
        name: 'iPhone 15 Pro'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.json);
      const parsed = JSON.parse(result.json);
      assert.strictEqual(parsed.name, 'iPhone 15 Pro');
    });

    it('should reject non-existent profile', async () => {
      const result = await commandHandlers.export_profile({
        name: 'NonExistent'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  describe('import_profile', () => {
    it('should import profile from JSON', async () => {
      const json = JSON.stringify({
        name: 'ImportedDevice',
        deviceType: 'mobile',
        hardwareConcurrency: 8,
        deviceMemory: 12,
        screenWidth: 412,
        screenHeight: 915,
        availWidth: 412,
        availHeight: 895,
        colorDepth: 32,
        pixelDepth: 32,
        devicePixelRatio: 2.75,
        maxTouchPoints: 5,
        vendor: 'Google Inc.',
        language: 'en-US',
        timezone: 'America/New_York'
      });

      const result = await commandHandlers.import_profile({
        name: 'ImportedDevice',
        json
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.message);
    });

    it('should reject invalid JSON', async () => {
      const result = await commandHandlers.import_profile({
        name: 'Invalid',
        json: 'not valid json'
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
    });
  });

  // ==========================================
  // RESET COMMAND TESTS
  // ==========================================

  describe('reset_anonymity_settings', () => {
    it('should reset tab settings', async () => {
      // Set first
      await commandHandlers.set_anonymity_profile({
        profileName: 'iPhone 15',
        tabId: 'tab1'
      });

      const result = await commandHandlers.reset_anonymity_settings({
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
    });
  });

  // ==========================================
  // RANDOM PROFILE COMMAND TESTS
  // ==========================================

  describe('get_random_profile', () => {
    it('should get random profile', async () => {
      const result = await commandHandlers.get_random_profile({
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.profile.name);
      assert.ok(result.profile.hardwareConcurrency);
    });

    it('should filter by device type', async () => {
      const result = await commandHandlers.get_random_profile({
        deviceType: 'mobile',
        tabId: 'tab1'
      });

      assert.strictEqual(result.success, true);
      assert.ok(result.profile.name);
    });

    it('should execute injection script', async () => {
      await commandHandlers.get_random_profile({
        tabId: 'tab1'
      });

      assert.ok(rendererCalls.length > 0);
    });
  });

  // ==========================================
  // CLEANUP TESTS
  // ==========================================

  describe('Cleanup', () => {
    it('should cleanup tab resources', () => {
      cleanupTabResources('tab1');
      // If it doesn't throw, cleanup worked
      assert.ok(true);
    });
  });
});

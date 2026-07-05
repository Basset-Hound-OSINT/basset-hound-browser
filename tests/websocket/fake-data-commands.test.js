/**
 * Tests for Fake Data Generator WebSocket Commands
 * Coverage: 15 tests including command execution, data validation, consistency
 */

const { registerFakeDataCommands, getGeneratorsForTab } = require('../../websocket/commands/fake-data-commands');

describe('Fake Data Generator WebSocket Commands', () => {
  let commandHandlers;

  beforeEach(() => {
    commandHandlers = {};
    registerFakeDataCommands(commandHandlers);
  });

  // Command registration tests (3 tests)
  describe('Command Registration', () => {
    it('should register all fake data commands', () => {
      expect(commandHandlers.generate_user_agent).toBeDefined();
      expect(commandHandlers.generate_screen_resolution).toBeDefined();
      expect(commandHandlers.generate_gpu_specs).toBeDefined();
      expect(commandHandlers.generate_browser_profile).toBeDefined();
      expect(commandHandlers.generate_all_fake_data).toBeDefined();
      expect(commandHandlers.get_profile_consistency).toBeDefined();
      expect(commandHandlers.reset_fake_data).toBeDefined();
      expect(commandHandlers.cleanup_tab).toBeDefined();
    });

    it('should register command handlers as async functions', () => {
      expect(typeof commandHandlers.generate_user_agent).toBe('function');
      expect(commandHandlers.generate_user_agent.constructor.name).toBe('AsyncFunction');
    });

    it('should have correct number of commands', () => {
      const commandCount = Object.keys(commandHandlers).length;
      expect(commandCount).toBe(8);
    });
  });

  // generate_user_agent tests (2 tests)
  describe('generate_user_agent', () => {
    it('should generate user agent from profile', async () => {
      const params = {
        profile: {
          deviceType: 'mobile',
          vendor: 'Apple',
          screenWidth: 390,
          screenHeight: 844
        },
        tabId: 'test-tab-1'
      };

      const result = await commandHandlers.generate_user_agent(params);
      expect(result.success).toBe(true);
      expect(result.userAgent).toBeDefined();
      expect(result.userAgent).toContain('Mozilla/5.0');
      expect(result.validated).toBe(true);
    });

    it('should fail without profile', async () => {
      const params = { tabId: 'test-tab-1' };
      const result = await commandHandlers.generate_user_agent(params);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // generate_screen_resolution tests (2 tests)
  describe('generate_screen_resolution', () => {
    it('should generate screen resolution from profile', async () => {
      const params = {
        profile: {
          deviceType: 'mobile',
          vendor: 'Apple',
          screenWidth: 390,
          screenHeight: 844
        },
        tabId: 'test-tab-2'
      };

      const result = await commandHandlers.generate_screen_resolution(params);
      expect(result.success).toBe(true);
      expect(result.resolution).toBeDefined();
      expect(result.resolution.width).toBeGreaterThan(0);
      expect(result.resolution.height).toBeGreaterThan(0);
      expect(result.validated).toBe(true);
    });

    it('should include aspect ratio in response', async () => {
      const params = {
        profile: {
          deviceType: 'desktop',
          vendor: 'Google',
          screenWidth: 1920,
          screenHeight: 1080
        },
        tabId: 'test-tab-3'
      };

      const result = await commandHandlers.generate_screen_resolution(params);
      expect(result.aspectRatio).toBeDefined();
      expect(result.aspectRatio).toContain(':');
    });
  });

  // generate_gpu_specs tests (2 tests)
  describe('generate_gpu_specs', () => {
    it('should generate GPU/CPU specs from profile', async () => {
      const params = {
        profile: {
          deviceType: 'mobile',
          vendor: 'Apple',
          hardwareConcurrency: 6,
          deviceMemory: 6
        },
        tabId: 'test-tab-4'
      };

      const result = await commandHandlers.generate_gpu_specs(params);
      expect(result.success).toBe(true);
      expect(result.specs).toBeDefined();
      expect(result.specs.cpu).toBeDefined();
      expect(result.specs.gpu).toBeDefined();
      expect(result.specs.cpuCores).toBeGreaterThan(0);
      expect(result.specs.gpuCores).toBeGreaterThan(0);
      expect(result.validated).toBe(true);
    });

    it('should include memory in specs', async () => {
      const params = {
        profile: {
          deviceType: 'desktop',
          vendor: 'Google',
          hardwareConcurrency: 16,
          deviceMemory: 32
        },
        tabId: 'test-tab-5'
      };

      const result = await commandHandlers.generate_gpu_specs(params);
      expect(result.specs.memory).toBeDefined();
      expect(result.specs.memory).toBeGreaterThan(0);
    });
  });

  // generate_browser_profile tests (1 test)
  describe('generate_browser_profile', () => {
    it('should generate complete browser profile', async () => {
      const params = {
        profile: {
          vendor: 'Apple',
          timezone: 'America/New_York',
          deviceType: 'mobile'
        },
        tabId: 'test-tab-6'
      };

      const result = await commandHandlers.generate_browser_profile(params);
      expect(result.success).toBe(true);
      expect(result.browserProfile).toBeDefined();
      expect(result.browserProfile.timezone).toBeDefined();
      expect(result.browserProfile.languages).toBeDefined();
      expect(result.browserProfile.plugins).toBeDefined();
      expect(result.validated).toBe(true);
    });
  });

  // generate_all_fake_data tests (2 tests)
  describe('generate_all_fake_data', () => {
    it('should generate all data types at once', async () => {
      const params = {
        profile: {
          deviceType: 'mobile',
          vendor: 'Apple',
          screenWidth: 390,
          screenHeight: 844,
          hardwareConcurrency: 6,
          deviceMemory: 6,
          timezone: 'America/New_York'
        },
        tabId: 'test-tab-7'
      };

      const result = await commandHandlers.generate_all_fake_data(params);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.userAgent).toBeDefined();
      expect(result.data.resolution).toBeDefined();
      expect(result.data.specs).toBeDefined();
      expect(result.data.browserProfile).toBeDefined();
    });

    it('should validate all generated data', async () => {
      const params = {
        profile: {
          deviceType: 'mobile',
          vendor: 'Apple',
          screenWidth: 390,
          screenHeight: 844,
          hardwareConcurrency: 6,
          deviceMemory: 6,
          timezone: 'America/New_York'
        },
        tabId: 'test-tab-8'
      };

      const result = await commandHandlers.generate_all_fake_data(params);
      expect(result.validations).toBeDefined();
      expect(result.validations.userAgent).toBe(true);
      expect(result.validations.resolution).toBe(true);
      expect(result.validations.specs).toBe(true);
      expect(result.validations.browserProfile).toBe(true);
    });
  });

  // get_profile_consistency tests (2 tests)
  describe('get_profile_consistency', () => {
    it('should report consistency status', async () => {
      const tabId = 'test-tab-9';

      // Generate some data first
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        hardwareConcurrency: 6,
        deviceMemory: 6,
        timezone: 'America/New_York'
      };

      await commandHandlers.generate_all_fake_data({ profile, tabId });

      // Check consistency
      const result = await commandHandlers.get_profile_consistency({ tabId });
      expect(result.success).toBe(true);
      expect(result.consistency).toBeDefined();
      expect(result.consistency.allInitialized).toBe(true);
    });

    it('should report uninitialized state', async () => {
      const tabId = 'test-tab-10';
      const result = await commandHandlers.get_profile_consistency({ tabId });
      expect(result.success).toBe(true);
      expect(result.consistency.allInitialized).toBe(false);
    });
  });

  // reset_fake_data tests (1 test)
  describe('reset_fake_data', () => {
    it('should reset all generated data', async () => {
      const tabId = 'test-tab-11';

      // Generate data
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        hardwareConcurrency: 6,
        deviceMemory: 6,
        timezone: 'America/New_York'
      };

      await commandHandlers.generate_all_fake_data({ profile, tabId });

      // Verify data was generated
      let consistency = await commandHandlers.get_profile_consistency({ tabId });
      expect(consistency.consistency.allInitialized).toBe(true);

      // Reset
      const resetResult = await commandHandlers.reset_fake_data({ tabId });
      expect(resetResult.success).toBe(true);

      // Verify data is cleared
      consistency = await commandHandlers.get_profile_consistency({ tabId });
      expect(consistency.consistency.allInitialized).toBe(false);
    });
  });

  // cleanup_tab tests (1 test)
  describe('cleanup_tab', () => {
    it('should clean up tab resources', async () => {
      const tabId = 'test-tab-12';

      // Generate data
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        hardwareConcurrency: 6,
        deviceMemory: 6,
        timezone: 'America/New_York'
      };

      await commandHandlers.generate_all_fake_data({ profile, tabId });

      // Cleanup
      const result = await commandHandlers.cleanup_tab({ tabId });
      expect(result.success).toBe(true);

      // Verify cleanup (should not throw)
      const consistency = await commandHandlers.get_profile_consistency({ tabId });
      expect(consistency.consistency.allInitialized).toBe(false);
    });
  });

  // Tab isolation tests (2 tests)
  describe('Tab Isolation', () => {
    it('should maintain separate data per tab', async () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        hardwareConcurrency: 6,
        deviceMemory: 6,
        timezone: 'America/New_York'
      };

      const tab1Result = await commandHandlers.generate_user_agent({
        profile,
        tabId: 'tab-iso-1'
      });

      const tab2Result = await commandHandlers.generate_user_agent({
        profile,
        tabId: 'tab-iso-2'
      });

      expect(tab1Result.success).toBe(true);
      expect(tab2Result.success).toBe(true);
      // Both should generate valid UAs (may differ due to template randomization)
      expect(tab1Result.userAgent).toBeDefined();
      expect(tab2Result.userAgent).toBeDefined();
    });

    it('should not mix data between tabs', async () => {
      const profile = {
        deviceType: 'mobile',
        vendor: 'Apple',
        screenWidth: 390,
        screenHeight: 844,
        hardwareConcurrency: 6,
        deviceMemory: 6,
        timezone: 'America/New_York'
      };

      const tab1 = 'tab-mix-1';
      const tab2 = 'tab-mix-2';

      // Generate data for tab 1
      await commandHandlers.generate_all_fake_data({ profile, tabId: tab1 });

      // Check tab 1 consistency
      const consistency1 = await commandHandlers.get_profile_consistency({ tabId: tab1 });
      expect(consistency1.consistency.allInitialized).toBe(true);

      // Check tab 2 consistency (should be separate)
      const consistency2 = await commandHandlers.get_profile_consistency({ tabId: tab2 });
      expect(consistency2.consistency.allInitialized).toBe(false);
    });
  });

  // Error handling tests (1 test)
  describe('Error Handling', () => {
    it('should handle missing profile gracefully', async () => {
      const commands = [
        'generate_user_agent',
        'generate_screen_resolution',
        'generate_gpu_specs',
        'generate_browser_profile'
      ];

      for (const cmd of commands) {
        const result = await commandHandlers[cmd]({ tabId: 'test-tab' });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });
});

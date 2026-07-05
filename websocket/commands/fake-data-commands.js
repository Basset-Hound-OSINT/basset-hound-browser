/**
 * Fake Data Generator WebSocket Commands
 * Provides WebSocket API commands for generating fake data (UA, screen, GPU, profile)
 * Integration point: All commands callable via WebSocket
 */

const UserAgentGenerator = require('../../src/anonymity/user-agent-generator');
const ScreenResolutionGenerator = require('../../src/anonymity/screen-resolution-generator');
const GPUCPUGenerator = require('../../src/anonymity/gpu-cpu-generator');
const BrowserProfileGenerator = require('../../src/anonymity/browser-profile-generator');

// Store generators per tab for consistency
const tabGenerators = new Map();

/**
 * Get or create generators for a tab
 */
function getGeneratorsForTab(tabId) {
  if (!tabGenerators.has(tabId)) {
    tabGenerators.set(tabId, {
      userAgent: new UserAgentGenerator(),
      screenResolution: new ScreenResolutionGenerator(),
      gpuCpu: new GPUCPUGenerator(),
      browserProfile: new BrowserProfileGenerator()
    });
  }
  return tabGenerators.get(tabId);
}

/**
 * Register all fake data generator commands
 */
function registerFakeDataCommands(commandHandlers) {
  /**
   * generate_user_agent - Generate spoofed user agent matching profile
   * Usage: { command: 'generate_user_agent', params: { profile: {...}, tabId?: 'tab1' } }
   */
  commandHandlers.generate_user_agent = async (params) => {
    try {
      const { profile, tabId } = params;
      if (!profile) {
        return { success: false, error: 'Profile required' };
      }

      const generators = getGeneratorsForTab(tabId || 'default');
      const ua = generators.userAgent.initializeFromProfile(profile);

      // Validate UA format
      if (!generators.userAgent.validateUserAgent(ua)) {
        return { success: false, error: 'Generated UA failed validation' };
      }

      return {
        success: true,
        userAgent: ua,
        validated: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * generate_screen_resolution - Generate spoofed resolution matching profile
   * Usage: { command: 'generate_screen_resolution', params: { profile: {...}, tabId?: 'tab1' } }
   */
  commandHandlers.generate_screen_resolution = async (params) => {
    try {
      const { profile, tabId } = params;
      if (!profile) {
        return { success: false, error: 'Profile required' };
      }

      const generators = getGeneratorsForTab(tabId || 'default');
      const resolution = generators.screenResolution.initializeFromProfile(profile);

      // Validate resolution
      if (!generators.screenResolution.validateResolution(resolution)) {
        return { success: false, error: 'Generated resolution failed validation' };
      }

      // Validate aspect ratio
      if (!generators.screenResolution.validateAspectRatio(
        resolution.width,
        resolution.height,
        profile.deviceType
      )) {
        return { success: false, error: 'Generated resolution has unrealistic aspect ratio' };
      }

      return {
        success: true,
        resolution: resolution,
        aspectRatio: generators.screenResolution.calculateAspectRatio(
          resolution.width,
          resolution.height
        ),
        validated: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * generate_gpu_specs - Generate spoofed GPU/CPU specs matching profile
   * Usage: { command: 'generate_gpu_specs', params: { profile: {...}, tabId?: 'tab1' } }
   */
  commandHandlers.generate_gpu_specs = async (params) => {
    try {
      const { profile, tabId } = params;
      if (!profile) {
        return { success: false, error: 'Profile required' };
      }

      const generators = getGeneratorsForTab(tabId || 'default');
      const specs = generators.gpuCpu.initializeFromProfile(profile);

      // Validate specs
      if (!generators.gpuCpu.validateSpecs(specs)) {
        return { success: false, error: 'Generated specs failed validation' };
      }

      return {
        success: true,
        specs: specs,
        validated: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * generate_browser_profile - Generate complete browser profile (plugins, timezone, locale)
   * Usage: { command: 'generate_browser_profile', params: { profile: {...}, tabId?: 'tab1' } }
   */
  commandHandlers.generate_browser_profile = async (params) => {
    try {
      const { profile, tabId } = params;
      if (!profile) {
        return { success: false, error: 'Profile required' };
      }

      const generators = getGeneratorsForTab(tabId || 'default');
      const browserProfile = generators.browserProfile.initializeFromProfile(profile);

      // Validate browser profile
      if (!generators.browserProfile.validateBrowserProfile(browserProfile)) {
        return { success: false, error: 'Generated browser profile failed validation' };
      }

      return {
        success: true,
        browserProfile: browserProfile,
        validated: true
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * generate_all_fake_data - Generate all fake data at once (UA + resolution + GPU + profile)
   * Usage: { command: 'generate_all_fake_data', params: { profile: {...}, tabId?: 'tab1' } }
   */
  commandHandlers.generate_all_fake_data = async (params) => {
    try {
      const { profile, tabId } = params;
      if (!profile) {
        return { success: false, error: 'Profile required' };
      }

      const generators = getGeneratorsForTab(tabId || 'default');

      // Generate all data
      const userAgent = generators.userAgent.initializeFromProfile(profile);
      const resolution = generators.screenResolution.initializeFromProfile(profile);
      const specs = generators.gpuCpu.initializeFromProfile(profile);
      const browserProfile = generators.browserProfile.initializeFromProfile(profile);

      // Validate all
      const validations = {
        userAgent: generators.userAgent.validateUserAgent(userAgent),
        resolution: generators.screenResolution.validateResolution(resolution),
        specs: generators.gpuCpu.validateSpecs(specs),
        browserProfile: generators.browserProfile.validateBrowserProfile(browserProfile)
      };

      const allValid = Object.values(validations).every(v => v === true);

      return {
        success: allValid,
        data: {
          userAgent: userAgent,
          resolution: resolution,
          specs: specs,
          browserProfile: browserProfile
        },
        validations: validations,
        error: allValid ? null : 'Some generated data failed validation'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * get_profile_consistency - Verify all generated data is consistent within session
   * Usage: { command: 'get_profile_consistency', params: { tabId?: 'tab1' } }
   */
  commandHandlers.get_profile_consistency = async (params) => {
    try {
      const { tabId } = params;
      const generators = getGeneratorsForTab(tabId || 'default');

      // Get all currently generated values (if they exist)
      const consistency = {
        tabId: tabId || 'default',
        hasUserAgent: generators.userAgent.generatedUA !== null,
        hasResolution: generators.screenResolution.generatedResolution !== null,
        hasGpuSpecs: generators.gpuCpu.generatedSpecs !== null,
        hasBrowserProfile: generators.browserProfile.generatedBrowserProfile !== null,
        allInitialized:
          generators.userAgent.generatedUA !== null &&
          generators.screenResolution.generatedResolution !== null &&
          generators.gpuCpu.generatedSpecs !== null &&
          generators.browserProfile.generatedBrowserProfile !== null
      };

      return {
        success: true,
        consistency: consistency
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * reset_fake_data - Reset all generated data for a tab
   * Usage: { command: 'reset_fake_data', params: { tabId?: 'tab1' } }
   */
  commandHandlers.reset_fake_data = async (params) => {
    try {
      const { tabId } = params;
      const generators = getGeneratorsForTab(tabId || 'default');

      // Reset all generators
      generators.userAgent.reset();
      generators.screenResolution.reset();
      generators.gpuCpu.reset();
      generators.browserProfile.reset();

      // Remove from map
      tabGenerators.delete(tabId || 'default');

      return {
        success: true,
        message: `Fake data reset for tab ${tabId || 'default'}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  /**
   * cleanup_tab - Clean up resources for closed tab
   * Usage: { command: 'cleanup_tab', params: { tabId: 'tab1' } }
   */
  commandHandlers.cleanup_tab = async (params) => {
    try {
      const { tabId } = params;
      if (!tabId) {
        return { success: false, error: 'TabId required' };
      }

      if (tabGenerators.has(tabId)) {
        tabGenerators.delete(tabId);
      }

      return {
        success: true,
        message: `Cleaned up resources for tab ${tabId}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
}

module.exports = {
  registerFakeDataCommands,
  getGeneratorsForTab // Export for testing
};

/**
 * Basset Hound Browser - Anonymity WebSocket Commands
 *
 * WebSocket API integration for hardware fingerprint spoofing
 * and device identity management
 *
 * Commands:
 * - set_anonymity_profile(profile_name)
 * - set_anonymity_custom(properties)
 * - get_anonymity_profile()
 * - list_anonymity_profiles()
 * - create_custom_profile(config)
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const HardwareFingerprintSpoofing = require('../../src/anonymity/hardware-fingerprint-spoofing');
const DeviceIdentityGenerator = require('../../src/anonymity/device-identity-generator');

/**
 * Module instances (initialized when commands are registered)
 */
let fingerprinterInstances = new Map();
let deviceGeneratorInstances = new Map();
let generatorInstance = null;

/**
 * Get or create fingerprinter for a tab
 */
function getFingerprinter(tabId) {
  if (!fingerprinterInstances.has(tabId)) {
    fingerprinterInstances.set(tabId, new HardwareFingerprintSpoofing());
  }
  return fingerprinterInstances.get(tabId);
}

/**
 * Get device identity generator (singleton)
 */
function getDeviceGenerator() {
  if (!generatorInstance) {
    generatorInstance = new DeviceIdentityGenerator();
  }
  return generatorInstance;
}

/**
 * Register anonymity commands with WebSocket server
 *
 * @param {Object} commandHandlers - Map of command handlers to register with
 * @param {Function} executeInRenderer - Function to execute code in renderer
 */
function registerAnonymityCommands(commandHandlers, executeInRenderer) {
  // ==========================================
  // ANONYMITY PROFILE COMMANDS
  // ==========================================

  /**
   * Set hardware spoofing using a pre-built device profile
   *
   * Command: set_anonymity_profile
   * Params:
   *   - profileName: string (required) - Name of profile (e.g. "iPhone 15 Pro")
   *   - tabId: string (optional) - Target tab (uses current if not specified)
   *
   * Returns: { success: true, profile: {...} } or { success: false, error: "..." }
   */
  commandHandlers.set_anonymity_profile = async (params, context) => {
    try {
      if (!params.profileName) {
        return {
          success: false,
          error: 'profileName is required'
        };
      }

      const generator = getDeviceGenerator();
      const profile = generator.getProfile(params.profileName);
      const tabId = params.tabId || (context && context.tabId) || 'default';
      const fingerprinter = getFingerprinter(tabId);

      // Initialize fingerprinter from profile
      fingerprinter.initializeFromProfile(profile);

      // Generate and execute injection script
      const script = fingerprinter.generateInjectionScript();
      if (executeInRenderer) {
        await executeInRenderer(tabId, script);
      }

      return {
        success: true,
        profile: {
          name: profile.name,
          deviceType: profile.deviceType,
          hardwareConcurrency: profile.hardwareConcurrency,
          deviceMemory: profile.deviceMemory,
          screenWidth: profile.screenWidth,
          screenHeight: profile.screenHeight,
          devicePixelRatio: profile.devicePixelRatio
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Set custom hardware spoofing values
   *
   * Command: set_anonymity_custom
   * Params:
   *   - properties: object (required) - Hardware properties to spoof
   *     Supported properties:
   *       - hardwareConcurrency (2-32)
   *       - deviceMemory (2-16 GB)
   *       - maxTouchPoints (0-5)
   *       - screenWidth, screenHeight
   *       - devicePixelRatio
   *       - languages (array)
   *       - language
   *       - timezone
   *       - vendor
   *   - tabId: string (optional) - Target tab
   *
   * Returns: { success: true, values: {...} } or { success: false, error: "..." }
   */
  commandHandlers.set_anonymity_custom = async (params, context) => {
    try {
      if (!params.properties || typeof params.properties !== 'object') {
        return {
          success: false,
          error: 'properties object is required'
        };
      }

      const tabId = params.tabId || (context && context.tabId) || 'default';
      const fingerprinter = getFingerprinter(tabId);

      // Validate and set all provided properties
      for (const [key, value] of Object.entries(params.properties)) {
        if (key in fingerprinter.sessionValues) {
          if (!fingerprinter.validateValue(key, value)) {
            return {
              success: false,
              error: `Invalid value for ${key}: ${value}`
            };
          }
          fingerprinter.sessionValues[key] = value;
        }
      }

      fingerprinter.initialized = true;

      // Generate and execute injection script
      const script = fingerprinter.generateInjectionScript();
      if (executeInRenderer) {
        await executeInRenderer(tabId, script);
      }

      return {
        success: true,
        values: fingerprinter.getValues()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get current anonymity profile
   *
   * Command: get_anonymity_profile
   * Params:
   *   - tabId: string (optional) - Target tab
   *
   * Returns: { success: true, profile: {...} } or { success: false, error: "..." }
   */
  commandHandlers.get_anonymity_profile = async (params, context) => {
    try {
      const tabId = params.tabId || (context && context.tabId) || 'default';
      const fingerprinter = getFingerprinter(tabId);
      const values = fingerprinter.getValues();

      return {
        success: true,
        profile: values
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * List available device profiles
   *
   * Command: list_anonymity_profiles
   * Params:
   *   - deviceType: string (optional) - Filter by device type
   *     Values: 'mobile', 'tablet', 'desktop'
   *
   * Returns: { success: true, profiles: [...] } or { success: false, error: "..." }
   */
  commandHandlers.list_anonymity_profiles = async (params, context) => {
    try {
      const generator = getDeviceGenerator();
      const allProfiles = generator.listProfiles();

      // Filter by device type if specified
      let profiles = allProfiles;
      if (params.deviceType) {
        profiles = allProfiles.filter(name => {
          const profile = generator.getProfile(name);
          return profile.deviceType === params.deviceType;
        });
      }

      return {
        success: true,
        count: profiles.length,
        profiles: profiles
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Create a new custom device profile
   *
   * Command: create_custom_profile
   * Params:
   *   - name: string (required) - Profile name
   *   - config: object (required) - Profile configuration
   *     Required fields:
   *       - deviceType: 'mobile' | 'tablet' | 'desktop'
   *       - hardwareConcurrency (2-32)
   *       - deviceMemory (2-64)
   *       - screenWidth, screenHeight
   *       - colorDepth (24 or 32)
   *       - pixelDepth (24 or 32)
   *       - devicePixelRatio (0.75, 1.0, 1.5, 2.0, 2.5, 3.0)
   *       - maxTouchPoints (0-10)
   *       - vendor
   *       - language
   *       - timezone
   *
   * Returns: { success: true, profile: {...} } or { success: false, error: "..." }
   */
  commandHandlers.create_custom_profile = async (params, context) => {
    try {
      if (!params.name || typeof params.name !== 'string') {
        return {
          success: false,
          error: 'name is required and must be a string'
        };
      }

      if (!params.config || typeof params.config !== 'object') {
        return {
          success: false,
          error: 'config object is required'
        };
      }

      const generator = getDeviceGenerator();

      // Add name to config if not present
      const profileConfig = {
        ...params.config,
        name: params.name
      };

      generator.createCustomProfile(params.name, profileConfig);

      return {
        success: true,
        profile: profileConfig,
        message: `Custom profile "${params.name}" created successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Delete a custom profile
   *
   * Command: delete_custom_profile
   * Params:
   *   - name: string (required) - Profile name
   *
   * Returns: { success: true } or { success: false, error: "..." }
   */
  commandHandlers.delete_custom_profile = async (params, context) => {
    try {
      if (!params.name || typeof params.name !== 'string') {
        return {
          success: false,
          error: 'name is required and must be a string'
        };
      }

      const generator = getDeviceGenerator();
      generator.deleteCustomProfile(params.name);

      return {
        success: true,
        message: `Custom profile "${params.name}" deleted successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get profile statistics
   *
   * Command: get_anonymity_statistics
   * Params: none
   *
   * Returns: { success: true, statistics: {...} } or { success: false, error: "..." }
   */
  commandHandlers.get_anonymity_statistics = async (params, context) => {
    try {
      const generator = getDeviceGenerator();
      const stats = generator.getStatistics();

      return {
        success: true,
        statistics: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Reset anonymity settings for a tab
   *
   * Command: reset_anonymity_settings
   * Params:
   *   - tabId: string (optional) - Target tab
   *
   * Returns: { success: true } or { success: false, error: "..." }
   */
  commandHandlers.reset_anonymity_settings = async (params, context) => {
    try {
      const tabId = params.tabId || (context && context.tabId) || 'default';

      if (fingerprinterInstances.has(tabId)) {
        const fingerprinter = fingerprinterInstances.get(tabId);
        fingerprinter.reset();
      }

      return {
        success: true,
        message: `Anonymity settings reset for tab ${tabId}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Export a device profile
   *
   * Command: export_profile
   * Params:
   *   - name: string (required) - Profile name
   *
   * Returns: { success: true, json: "..." } or { success: false, error: "..." }
   */
  commandHandlers.export_profile = async (params, context) => {
    try {
      if (!params.name || typeof params.name !== 'string') {
        return {
          success: false,
          error: 'name is required and must be a string'
        };
      }

      const generator = getDeviceGenerator();
      const json = generator.exportProfile(params.name);

      return {
        success: true,
        json: json
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Import a device profile from JSON
   *
   * Command: import_profile
   * Params:
   *   - name: string (required) - Name for imported profile
   *   - json: string (required) - JSON profile data
   *
   * Returns: { success: true } or { success: false, error: "..." }
   */
  commandHandlers.import_profile = async (params, context) => {
    try {
      if (!params.name || typeof params.name !== 'string') {
        return {
          success: false,
          error: 'name is required and must be a string'
        };
      }

      if (!params.json || typeof params.json !== 'string') {
        return {
          success: false,
          error: 'json is required and must be a string'
        };
      }

      const generator = getDeviceGenerator();
      generator.importProfile(params.name, params.json);

      return {
        success: true,
        message: `Profile "${params.name}" imported successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get random device profile
   *
   * Command: get_random_profile
   * Params:
   *   - deviceType: string (optional) - Device type filter ('mobile', 'tablet', 'desktop')
   *   - tabId: string (optional) - Target tab
   *
   * Returns: { success: true, profile: {...} } or { success: false, error: "..." }
   */
  commandHandlers.get_random_profile = async (params, context) => {
    try {
      const generator = getDeviceGenerator();
      const profile = generator.getRandomProfile(params.deviceType);
      const tabId = params.tabId || (context && context.tabId) || 'default';
      const fingerprinter = getFingerprinter(tabId);

      // Apply profile
      fingerprinter.initializeFromProfile(profile);

      // Generate and execute injection script
      const script = fingerprinter.generateInjectionScript();
      if (executeInRenderer) {
        await executeInRenderer(tabId, script);
      }

      return {
        success: true,
        profile: {
          name: profile.name,
          deviceType: profile.deviceType,
          hardwareConcurrency: profile.hardwareConcurrency,
          deviceMemory: profile.deviceMemory,
          screenWidth: profile.screenWidth,
          screenHeight: profile.screenHeight,
          devicePixelRatio: profile.devicePixelRatio
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Clean up resources for a closed tab
 */
function cleanupTabResources(tabId) {
  if (fingerprinterInstances.has(tabId)) {
    fingerprinterInstances.delete(tabId);
  }
}

module.exports = {
  registerAnonymityCommands,
  cleanupTabResources,
  HardwareFingerprintSpoofing,
  DeviceIdentityGenerator
};

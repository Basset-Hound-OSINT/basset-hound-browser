/**
 * WebSocket Handler - Device Fingerprinter Module
 * Provides device profile management, fingerprinting, and rotation capabilities
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const DeviceFingerprinter = require('../../src/evasion/device-fingerprinter');

class DeviceFingerprintHandler {
  constructor() {
    this.fingerprinter = new DeviceFingerprinter();
    this.currentSession = null;
  }

  /**
   * Handle WebSocket commands for device fingerprinting
   */
  async handleCommand(command, params) {
    const startTime = Date.now();

    try {
      let result;

      switch (command) {
        case 'apply_device_profile':
          result = await this.applyDeviceProfile(params);
          break;

        case 'randomize_device':
          result = await this.randomizeDevice(params);
          break;

        case 'get_device_profile':
          result = this.getDeviceProfile(params);
          break;

        case 'get_current_profile':
          result = this.getCurrentProfile();
          break;

        case 'list_devices':
          result = this.listDevices(params);
          break;

        case 'validate_fingerprint':
          result = this.validateFingerprint();
          break;

        case 'get_profile_history':
          result = this.getProfileHistory(params);
          break;

        case 'clear_profile_history':
          result = this.clearProfileHistory();
          break;

        case 'get_device_stats':
          result = this.getDeviceStats();
          break;

        case 'filter_devices':
          result = this.filterDevices(params);
          break;

        default:
          return {
            success: false,
            error: `Unknown command: ${command}`,
            command,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
          };
      }

      return {
        success: true,
        command,
        result,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Apply a specific device profile
   */
  async applyDeviceProfile(params = {}) {
    const { profileId, randomizeMinors = false } = params;

    if (!profileId) {
      throw new Error('profileId is required');
    }

    const fingerprint = await this.fingerprinter.applyFingerprint(profileId, randomizeMinors);
    const consistency = this.fingerprinter.validateFingerprintConsistency();

    return {
      profileId,
      fingerprint,
      consistency: {
        valid: consistency.valid,
        issues: consistency.issues,
        profile: consistency.profile
      },
      appliedAt: new Date().toISOString()
    };
  }

  /**
   * Randomize device with optional filter
   */
  async randomizeDevice(params = {}) {
    const { filter = {} } = params;

    const fingerprint = await this.fingerprinter.randomizeDevice(filter);
    const profile = this.fingerprinter.getCurrentProfile();
    const consistency = this.fingerprinter.validateFingerprintConsistency();

    return {
      profileId: this.fingerprinter.currentProfileId,
      profileName: profile.name,
      fingerprint,
      consistency: {
        valid: consistency.valid,
        issues: consistency.issues
      },
      appliedAt: new Date().toISOString()
    };
  }

  /**
   * Get specific device profile by ID
   */
  getDeviceProfile(params = {}) {
    const { profileId } = params;

    if (!profileId) {
      throw new Error('profileId is required');
    }

    const profile = this.fingerprinter.getProfile(profileId);

    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    return {
      profileId,
      profile,
      isCurrentProfile: this.fingerprinter.currentProfileId === profileId
    };
  }

  /**
   * Get currently applied profile
   */
  getCurrentProfile() {
    const profile = this.fingerprinter.getCurrentProfile();

    if (!profile) {
      return {
        profileId: null,
        profile: null,
        message: 'No profile currently applied'
      };
    }

    const consistency = this.fingerprinter.validateFingerprintConsistency();

    return {
      profileId: this.fingerprinter.currentProfileId,
      profile,
      consistency: {
        valid: consistency.valid,
        issues: consistency.issues
      }
    };
  }

  /**
   * List all available devices
   */
  listDevices(params = {}) {
    const { includeMetadata = true } = params;

    const profiles = this.fingerprinter.listProfiles();

    if (includeMetadata) {
      return {
        totalCount: profiles.length,
        profiles: profiles.map(p => ({
          ...p,
          isCurrent: p.id === this.fingerprinter.currentProfileId
        }))
      };
    }

    return {
      totalCount: profiles.length,
      profileIds: profiles.map(p => p.id)
    };
  }

  /**
   * Validate current fingerprint consistency
   */
  validateFingerprint() {
    const result = this.fingerprinter.validateFingerprintConsistency();

    return {
      valid: result.valid,
      issues: result.issues,
      profile: result.profile,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get profile history with optional limit
   */
  getProfileHistory(params = {}) {
    const { limit = 10 } = params;

    const history = this.fingerprinter.getProfileHistory(limit);

    return {
      count: history.length,
      limit,
      history: history.map(h => ({
        profileId: h.profileId,
        appliedAt: new Date(h.appliedAt).toISOString(),
        profileName: h.profile.name
      }))
    };
  }

  /**
   * Clear profile history
   */
  clearProfileHistory() {
    this.fingerprinter.clearHistory();

    return {
      message: 'Profile history cleared',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get device statistics
   */
  getDeviceStats() {
    const stats = this.fingerprinter.getProfileStats();

    return {
      totalProfiles: stats.totalProfiles,
      distribution: {
        byOS: stats.byOS,
        byBrowser: stats.byBrowser,
        byDeviceType: stats.byDeviceType
      },
      currentProfile: {
        profileId: this.fingerprinter.currentProfileId,
        profileName: this.fingerprinter.getCurrentProfile()?.name || null
      }
    };
  }

  /**
   * Filter devices by criteria
   */
  filterDevices(params = {}) {
    const { os, browser, deviceType, limit = 10 } = params;

    const filter = {};
    if (os) filter.os = os;
    if (browser) filter.browser = browser;
    if (deviceType) filter.deviceType = deviceType;

    const results = [];
    for (let i = 0; i < limit; i++) {
      const profile = this.fingerprinter.getRandomProfile(filter);
      if (!profile) break;
      results.push(profile);
    }

    return {
      filter,
      count: results.length,
      limit,
      results: results.map(r => ({
        id: r.id,
        name: r.name,
        os: r.os.name,
        browser: r.browser.name,
        deviceType: r.deviceType
      }))
    };
  }

  /**
   * Get handler status
   */
  getStatus() {
    return {
      moduleName: 'DeviceFingerprintHandler',
      version: '1.0.0',
      currentProfile: this.fingerprinter.currentProfileId,
      profileCount: Object.keys(this.fingerprinter.profiles).length,
      historyLength: this.fingerprinter.profileHistory.length,
      supportedCommands: [
        'apply_device_profile',
        'randomize_device',
        'get_device_profile',
        'get_current_profile',
        'list_devices',
        'validate_fingerprint',
        'get_profile_history',
        'clear_profile_history',
        'get_device_stats',
        'filter_devices'
      ]
    };
  }
}

module.exports = DeviceFingerprintHandler;

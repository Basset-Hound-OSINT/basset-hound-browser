/**
 * Basset Hound Browser - Anonymity Profile Manager
 *
 * Unified integration of all anonymity modules (Phases 1, 2, 3):
 * - Phase 1: Hardware spoofing (device identity)
 * - Phase 2: Fake data generators (user agent, screen, GPU/CPU)
 * - Phase 3: Behavioral anonymization (mouse, keyboard, timing, interaction)
 *
 * Single command: setProfile(name) applies ALL systems at once
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

const HardwareSpoofing = require('./hardware-fingerprint-spoofing');
const DeviceIdentityGenerator = require('./device-identity-generator');
const UserAgentGenerator = require('./user-agent-generator');
const ScreenResolutionGenerator = require('./screen-resolution-generator');
const GPUCPUGenerator = require('./gpu-cpu-generator');
const BrowserProfileGenerator = require('./browser-profile-generator');
const MouseMovement = require('./mouse-movement');
const KeyboardTyping = require('./keyboard-typing');
const TimingRandomization = require('./timing-randomization');
const InteractionPatterns = require('./interaction-patterns');

/**
 * Anonymity Profile Manager
 * Manages unified anonymity profiles combining hardware spoofing, fake data, and behaviors
 */
class AnonymityProfileManager {
  constructor(options = {}) {
    this.options = options;
    this.activeProfile = null;
    this.activeSessionId = null;

    // Initialize all subsystems
    this.deviceIdentityGenerator = new DeviceIdentityGenerator();
    this.hardwareSpoofing = null; // Created per profile
    this.userAgentGenerator = null; // Created per profile
    this.screenGenerator = new ScreenResolutionGenerator();
    this.gpuCpuGenerator = null; // Created per profile
    this.browserProfileGenerator = null; // Created per profile

    // Behavioral modules (shared across profiles)
    this.mouseMovement = null;
    this.keyboardTyping = null;
    this.timingRandomization = null;
    this.interactionPatterns = null;

    // Track behavioral state
    this.behavioralModulesEnabled = {
      mouse: false,
      keyboard: false,
      timing: false,
      interaction: false
    };

    // Pre-built anonymity profiles (Phase 1 + 2 + 3 combined)
    this.anonymityProfiles = this.buildAnonymityProfiles();

    // Session state
    this.sessionState = new Map(); // sessionId -> profile state
  }

  /**
   * Build complete anonymity profiles combining all phases
   * Each profile includes:
   * - Device identity (from Phase 1)
   * - User agent (from Phase 2)
   * - Screen specs (from Phase 2)
   * - GPU/CPU specs (from Phase 2)
   * - Browser profile (from Phase 2)
   * - Behavioral patterns (from Phase 3)
   */
  buildAnonymityProfiles() {
    const profiles = {};

    // Get all available device profile names from Phase 1
    const profileNames = this.deviceIdentityGenerator.listProfiles();

    // For each device, create complete anonymity profile
    for (const name of profileNames) {
      const deviceProfile = this.deviceIdentityGenerator.getProfile(name);
      profiles[name] = {
        name: name,
        deviceProfile: deviceProfile,
        phase1: {
          deviceIdentity: deviceProfile,
          hardwareSpoof: {
            enabled: true,
            cores: deviceProfile.hardwareConcurrency,
            memory: deviceProfile.deviceMemory,
            gpu: this.getGPUForDevice(deviceProfile),
            maxTouchPoints: deviceProfile.maxTouchPoints
          }
        },
        phase2: {
          userAgent: this.getUserAgentForDevice(deviceProfile),
          screen: {
            width: deviceProfile.screenWidth,
            height: deviceProfile.screenHeight,
            colorDepth: deviceProfile.colorDepth,
            devicePixelRatio: deviceProfile.devicePixelRatio
          },
          gpu: this.getGPUSpecsForDevice(deviceProfile),
          browserProfile: this.getBrowserProfileForDevice(deviceProfile)
        },
        phase3: {
          behaviors: {
            mouse: {
              enabled: true,
              curveType: 'bezier',
              hoverRequired: true,
              overshooting: true
            },
            keyboard: {
              enabled: true,
              wpmRange: [60, 120],
              typoRate: 0.05,
              correctionRate: 0.8
            },
            timing: {
              enabled: true,
              distribution: 'gaussian',
              contextAware: true,
              minDelay: 100,
              maxDelay: 3000
            },
            interaction: {
              enabled: true,
              smoothScroll: true,
              hoverPatterns: true,
              naturalOrder: true,
              readingPauses: true
            }
          }
        }
      };
    }

    return profiles;
  }

  /**
   * Get GPU for device from identity
   */
  getGPUForDevice(deviceProfile) {
    // Extract GPU from device profile or detect from brand/model
    if (deviceProfile.gpu) return deviceProfile.gpu;

    // Infer from device brand/model and type
    const brand = deviceProfile.vendor || 'Unknown';
    const deviceType = deviceProfile.deviceType || 'desktop';
    const name = deviceProfile.name || '';

    if (brand.includes('Apple')) {
      if (name.includes('15 Pro') || name.includes('iPhone 15 Pro')) return 'Apple A17 Pro';
      if (name.includes('14') || name.includes('13') || name.includes('12')) return 'Apple A16 Bionic';
      if (name.includes('MacBook') && name.includes('M3 Max')) return 'Apple M3 Max GPU';
      if (name.includes('MacBook') && name.includes('M2')) return 'Apple M2 GPU';
      return 'Apple A16 Bionic';
    }
    if (brand.includes('Samsung') || brand.includes('Google')) return 'Qualcomm Adreno 8';
    if (brand.includes('Intel')) return 'Intel UHD Graphics';
    if (brand.includes('AMD')) return 'AMD Radeon RX 7700';

    return 'Unknown GPU';
  }

  /**
   * Get user agent for device
   */
  getUserAgentForDevice(deviceProfile) {
    const generator = new UserAgentGenerator();
    generator.initializeFromProfile(deviceProfile);
    return generator.getUserAgent();
  }

  /**
   * Get GPU specs for device
   */
  getGPUSpecsForDevice(deviceProfile) {
    const generator = new GPUCPUGenerator();
    generator.initializeFromProfile(deviceProfile);
    const specs = generator.getSpecs();
    return {
      gpu: specs,
      cpu: specs
    };
  }

  /**
   * Get browser profile for device
   */
  getBrowserProfileForDevice(deviceProfile) {
    const generator = new BrowserProfileGenerator();
    const profile = generator.initializeFromProfile(deviceProfile);
    return {
      vendor: deviceProfile.vendor,
      language: profile.primaryLanguage,
      languages: profile.languages,
      timezone: profile.timezone,
      platform: deviceProfile.vendor.includes('Apple') ? 'MacIntel' : 'Win32',
      locale: profile.locale
    };
  }

  /**
   * Set anonymity profile - Applies ALL anonymity systems
   * @param {string} profileName - Name of profile (e.g., 'iPhone 15 Pro')
   * @param {string} sessionId - Optional session identifier
   * @returns {Object} Result with success status and applied profile details
   */
  setProfile(profileName, sessionId = null) {
    if (!this.anonymityProfiles[profileName]) {
      throw new Error(`Unknown anonymity profile: ${profileName}`);
    }

    sessionId = sessionId || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const profile = this.anonymityProfiles[profileName];
    this.activeProfile = profile;
    this.activeSessionId = sessionId;

    // Initialize Phase 1 systems (Hardware Spoofing)
    this.hardwareSpoofing = new HardwareSpoofing(profile.phase1.deviceIdentity);

    // Initialize Phase 2 systems (Fake Data Generators)
    this.userAgentGenerator = new UserAgentGenerator();
    this.userAgentGenerator.initializeFromProfile(profile.phase1.deviceIdentity);

    // Initialize Phase 3 systems (Behavioral Anonymization)
    // Disable previous behavioral modules
    this.disableBehavioralModules();
    this.initializeBehavioralModules();

    // Store session state
    this.sessionState.set(sessionId, {
      profileName: profileName,
      profile: profile,
      timestamp: new Date(),
      hardwareSpoof: profile.phase1.hardwareSpoof,
      fakeData: profile.phase2,
      behaviors: profile.phase3.behaviors
    });

    return {
      success: true,
      sessionId: sessionId,
      profileName: profileName,
      device: profile.deviceProfile,
      hardwareSpoof: profile.phase1.hardwareSpoof,
      fakeData: profile.phase2,
      behaviors: profile.phase3.behaviors,
      message: `Anonymity profile "${profileName}" applied successfully`
    };
  }

  /**
   * Initialize behavioral modules (Phase 3)
   */
  initializeBehavioralModules() {
    this.mouseMovement = new MouseMovement();
    this.keyboardTyping = new KeyboardTyping();
    this.timingRandomization = new TimingRandomization();
    this.interactionPatterns = new InteractionPatterns();
  }

  /**
   * Get currently active anonymity profile
   * @returns {Object} Active profile details
   */
  getActiveProfile() {
    if (!this.activeProfile) {
      return {
        active: false,
        message: 'No anonymity profile currently active'
      };
    }

    return {
      active: true,
      sessionId: this.activeSessionId,
      profileName: this.activeProfile.name,
      device: this.activeProfile.deviceProfile,
      hardwareSpoof: this.activeProfile.phase1.hardwareSpoof,
      fakeData: this.activeProfile.phase2,
      behaviors: this.activeProfile.phase3.behaviors,
      behavioralState: this.behavioralModulesEnabled
    };
  }

  /**
   * Enable behavioral modules for active profile
   * @param {Object} options - Module options
   * @returns {Object} Status of enabled modules
   */
  enableBehavioralModules(options = {}) {
    if (!this.activeProfile) {
      throw new Error('No active anonymity profile. Call setProfile() first.');
    }

    const { wpm = 85, mouseEnabled = true, keyboardEnabled = true,
            timingEnabled = true, interactionEnabled = true } = options;

    // Enable requested modules
    if (mouseEnabled && this.mouseMovement) {
      this.mouseMovement.enable();
      this.behavioralModulesEnabled.mouse = true;
    }

    if (keyboardEnabled && this.keyboardTyping) {
      this.keyboardTyping.enable();
      this.keyboardTyping.setTypingSpeed(wpm);
      this.behavioralModulesEnabled.keyboard = true;
    }

    if (timingEnabled && this.timingRandomization) {
      this.timingRandomization.enable();
      this.behavioralModulesEnabled.timing = true;
    }

    if (interactionEnabled && this.interactionPatterns) {
      this.interactionPatterns.enable();
      this.behavioralModulesEnabled.interaction = true;
    }

    return {
      success: true,
      enabled: this.behavioralModulesEnabled,
      wpm: wpm,
      message: 'Behavioral modules enabled'
    };
  }

  /**
   * Disable behavioral modules
   * @returns {Object} Status of disabled modules
   */
  disableBehavioralModules() {
    if (this.mouseMovement) this.mouseMovement.disable();
    if (this.keyboardTyping) this.keyboardTyping.disable();
    if (this.timingRandomization) this.timingRandomization.disable();
    if (this.interactionPatterns) this.interactionPatterns.disable();

    this.behavioralModulesEnabled = {
      mouse: false,
      keyboard: false,
      timing: false,
      interaction: false
    };

    return {
      success: true,
      enabled: this.behavioralModulesEnabled,
      message: 'Behavioral modules disabled'
    };
  }

  /**
   * Validate anonymity consistency across all systems
   * Ensures all components agree on hardware/device values
   * @returns {Object} Validation results
   */
  validateAnonymityConsistency() {
    if (!this.activeProfile) {
      return {
        valid: false,
        message: 'No active profile'
      };
    }

    const profile = this.activeProfile;
    const issues = [];

    // Check Phase 1 consistency
    const phase1 = profile.phase1;
    if (phase1.hardwareSpoof.cores !== profile.deviceProfile.hardwareConcurrency) {
      issues.push('CPU cores mismatch between hardware spoof and device profile');
    }
    if (phase1.hardwareSpoof.memory !== profile.deviceProfile.deviceMemory) {
      issues.push('Device memory mismatch between hardware spoof and device profile');
    }

    // Check Phase 2 consistency
    const phase2 = profile.phase2;
    if (phase2.screen.width !== profile.deviceProfile.screenWidth) {
      issues.push('Screen width mismatch between fake data and device profile');
    }
    if (phase2.screen.height !== profile.deviceProfile.screenHeight) {
      issues.push('Screen height mismatch between fake data and device profile');
    }

    // Check Phase 3 behavioral consistency
    const phase3 = profile.phase3;
    if (!phase3.behaviors.mouse.enabled && this.behavioralModulesEnabled.mouse) {
      issues.push('Mouse behavior disabled in profile but enabled in state');
    }
    if (!phase3.behaviors.keyboard.enabled && this.behavioralModulesEnabled.keyboard) {
      issues.push('Keyboard behavior disabled in profile but enabled in state');
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      profile: {
        name: profile.name,
        device: profile.deviceProfile.vendor,
        hardwareSpoof: phase1.hardwareSpoof,
        fakeData: phase2,
        behaviors: phase3.behaviors
      },
      message: issues.length === 0 ? 'All anonymity systems consistent' :
               `${issues.length} consistency issue(s) detected`
    };
  }

  /**
   * Reset all anonymity systems
   * @returns {Object} Reset status
   */
  resetAnonymity() {
    // Disable behavioral modules
    this.disableBehavioralModules();

    // Clear active profile
    this.activeProfile = null;
    this.activeSessionId = null;

    // Reset generators
    this.hardwareSpoofing = null;
    this.userAgentGenerator = null;
    this.gpuCpuGenerator = null;
    this.browserProfileGenerator = null;

    this.mouseMovement = null;
    this.keyboardTyping = null;
    this.timingRandomization = null;
    this.interactionPatterns = null;

    // Clear session state
    this.sessionState.clear();

    return {
      success: true,
      message: 'All anonymity systems reset'
    };
  }

  /**
   * Get list of available anonymity profiles
   * @returns {Array} List of profile names
   */
  getAvailableProfiles() {
    return Object.keys(this.anonymityProfiles);
  }

  /**
   * Get detailed information about a profile
   * @param {string} profileName - Name of profile
   * @returns {Object} Profile details
   */
  getProfileDetails(profileName) {
    if (!this.anonymityProfiles[profileName]) {
      throw new Error(`Unknown anonymity profile: ${profileName}`);
    }

    const profile = this.anonymityProfiles[profileName];
    return {
      name: profile.name,
      device: profile.deviceProfile,
      phase1: profile.phase1,
      phase2: profile.phase2,
      phase3: profile.phase3
    };
  }

  /**
   * Get status of all behavioral modules
   * @returns {Object} Status of each module
   */
  getBehavioralStatus() {
    const keyboardStatus = this.keyboardTyping ? this.keyboardTyping.getStatus() : {};

    return {
      mouse: {
        enabled: this.behavioralModulesEnabled.mouse,
        module: this.mouseMovement ? 'initialized' : 'not initialized'
      },
      keyboard: {
        enabled: this.behavioralModulesEnabled.keyboard,
        module: this.keyboardTyping ? 'initialized' : 'not initialized',
        wpm: keyboardStatus.typingSpeed || null
      },
      timing: {
        enabled: this.behavioralModulesEnabled.timing,
        module: this.timingRandomization ? 'initialized' : 'not initialized'
      },
      interaction: {
        enabled: this.behavioralModulesEnabled.interaction,
        module: this.interactionPatterns ? 'initialized' : 'not initialized'
      }
    };
  }

  /**
   * Get injection code for hardware spoofing
   * @returns {string} JavaScript code to inject
   */
  getInjectionCode() {
    if (!this.hardwareSpoofing) {
      throw new Error('No active profile. Call setProfile() first.');
    }

    return this.hardwareSpoofing.generateInjectionScript();
  }

  /**
   * Check if anonymity is actively protecting
   * @returns {Object} Protection status
   */
  getProtectionStatus() {
    const active = this.activeProfile !== null;
    const hardwareSpoofing = this.hardwareSpoofing !== null;
    const behavioralsActive = Object.values(this.behavioralModulesEnabled).some(v => v);

    return {
      anonymityActive: active,
      profileName: active ? this.activeProfile.name : null,
      sessionId: this.activeSessionId,
      hardwareSpoofingActive: hardwareSpoofing,
      behavioralModulesActive: behavioralsActive,
      modules: this.getBehavioralStatus(),
      protectionLevel: active && hardwareSpoofing && behavioralsActive ? 'full' :
                       active && hardwareSpoofing ? 'hardware+data' :
                       active ? 'partial' : 'none'
    };
  }
}

module.exports = AnonymityProfileManager;

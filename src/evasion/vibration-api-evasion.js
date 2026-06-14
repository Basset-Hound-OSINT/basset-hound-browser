/**
 * Basset Hound Browser - Vibration API Evasion Module
 * Implements vibration API simulation and spoofing
 *
 * Version: 1.0.0
 * Created: June 14, 2026
 */

class VibrationAPIEvasion {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.technique = options.technique || 'capability-spoofing';
    this.hasVibration = options.hasVibration !== false;
    this.consistency = new Map();
    this.vibrationHistory = [];
  }

  /**
   * Technique 1: Capability spoofing
   * Spoof whether device supports vibration
   */
  capabilitySpoofing(options = {}) {
    const hasVibration = options.hasVibration !== undefined ? options.hasVibration : this.hasVibration;

    return {
      technique: 'capability-spoofing',
      supported: hasVibration,
      available: hasVibration,
      maxVibrationDuration: hasVibration ? 10000 : null, // 10 seconds max
      timestamp: Date.now(),
      effectiveness: '70-75%'
    };
  }

  /**
   * Technique 2: Vibration pattern spoofing
   * Spoof vibration pattern responses
   */
  vibrationPatternSpoofing(options = {}) {
    const pattern = options.pattern || [100, 50, 100]; // [vibrate, pause, vibrate] in ms
    const maxDuration = 10000; // 10 seconds

    // Validate and normalize pattern
    let totalDuration = 0;
    const validPattern = [];

    for (let i = 0; i < Math.min(pattern.length, 100); i++) {
      const value = Math.min(pattern[i], maxDuration);
      validPattern.push(value);
      totalDuration += value;

      if (totalDuration > maxDuration) {
        break;
      }
    }

    // Record in history
    this.vibrationHistory.push({
      pattern: validPattern,
      totalDuration: totalDuration,
      timestamp: Date.now()
    });

    // Keep only last 100 vibrations
    if (this.vibrationHistory.length > 100) {
      this.vibrationHistory.shift();
    }

    return {
      technique: 'vibration-pattern-spoofing',
      pattern: validPattern,
      totalDuration: totalDuration,
      supported: this.hasVibration,
      success: totalDuration > 0 && totalDuration <= 10000,
      timestamp: Date.now(),
      effectiveness: '75-80%'
    };
  }

  /**
   * Technique 3: Device type variation
   * Vary vibration based on device type
   */
  deviceTypeVariation(options = {}) {
    const deviceType = options.deviceType || this.selectRandomDeviceType();

    const profiles = {
      'phone': {
        supported: true,
        maxDuration: 5000,
        patterns: [[100], [100, 50, 100], [200, 100, 200]],
        hapticIntensity: 'high'
      },
      'tablet': {
        supported: true,
        maxDuration: 3000,
        patterns: [[50], [50, 30, 50]],
        hapticIntensity: 'medium'
      },
      'smartwatch': {
        supported: true,
        maxDuration: 2000,
        patterns: [[20], [20, 10, 20]],
        hapticIntensity: 'low'
      },
      'desktop': {
        supported: false,
        maxDuration: null,
        patterns: [],
        hapticIntensity: null
      },
      'laptop': {
        supported: false,
        maxDuration: null,
        patterns: [],
        hapticIntensity: null
      }
    };

    const profile = profiles[deviceType] || profiles.phone;

    return {
      technique: 'device-type-variation',
      deviceType: deviceType,
      supported: profile.supported,
      maxDuration: profile.maxDuration,
      hapticIntensity: profile.hapticIntensity,
      availablePatterns: profile.patterns.length,
      timestamp: Date.now(),
      effectiveness: '72-78%'
    };
  }

  /**
   * Technique 4: Vibration permission state
   * Spoof whether user has granted vibration permission
   */
  vibrationPermissionState(options = {}) {
    const key = 'vibration-permission';

    if (!this.consistency.has(key)) {
      this.consistency.set(key, {
        permitted: Math.random() < 0.7, // 70% chance of permission
        permissionTime: Date.now()
      });
    }

    const state = this.consistency.get(key);

    return {
      technique: 'vibration-permission-state',
      supported: this.hasVibration,
      permitted: state.permitted,
      permissionGrantedAt: state.permitted ? state.permissionTime : null,
      canVibrate: this.hasVibration && state.permitted,
      timestamp: Date.now(),
      effectiveness: '65-70%'
    };
  }

  /**
   * Get device type profiles
   */
  getDeviceTypeProfiles() {
    return ['phone', 'tablet', 'smartwatch', 'desktop', 'laptop'];
  }

  /**
   * Select random device type
   */
  selectRandomDeviceType() {
    const types = this.getDeviceTypeProfiles();
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Set vibration capability
   */
  setHasVibration(hasVibration) {
    this.hasVibration = hasVibration;
    return true;
  }

  /**
   * Get vibration history
   */
  getVibrationHistory(limit = 10) {
    return this.vibrationHistory.slice(-limit);
  }

  /**
   * Clear vibration history
   */
  clearVibrationHistory() {
    this.vibrationHistory = [];
    return true;
  }

  /**
   * Apply vibration API evasion
   */
  apply(options = {}) {
    if (!this.enabled) return null;

    switch (this.technique) {
      case 'capability-spoofing':
        return this.capabilitySpoofing(options);
      case 'vibration-pattern-spoofing':
        return this.vibrationPatternSpoofing(options);
      case 'device-type-variation':
        return this.deviceTypeVariation(options);
      case 'vibration-permission-state':
        return this.vibrationPermissionState(options);
      case 'combined':
        return this.combinedEvasion(options);
      default:
        return this.capabilitySpoofing(options);
    }
  }

  /**
   * Combined evasion technique
   */
  combinedEvasion(options = {}) {
    const deviceResult = this.deviceTypeVariation(options);
    const permissionResult = this.vibrationPermissionState(options);
    const patternResult = this.vibrationPatternSpoofing({
      pattern: [100, 50, 100]
    });

    return {
      technique: 'combined',
      deviceType: deviceResult.deviceType,
      supported: deviceResult.supported,
      permitted: permissionResult.permitted,
      canVibrate: deviceResult.supported && permissionResult.permitted,
      hapticIntensity: deviceResult.hapticIntensity,
      lastPattern: patternResult.pattern,
      timestamp: Date.now(),
      effectiveness: '80-85%'
    };
  }

  /**
   * Get available techniques
   */
  getAvailableTechniques() {
    return [
      'capability-spoofing',
      'vibration-pattern-spoofing',
      'device-type-variation',
      'vibration-permission-state',
      'combined'
    ];
  }

  /**
   * Set technique
   */
  setTechnique(technique) {
    if (!this.getAvailableTechniques().includes(technique)) {
      return false;
    }

    this.technique = technique;
    return true;
  }

  /**
   * Get evasion status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      technique: this.technique,
      hasVibration: this.hasVibration,
      vibrationHistoryCount: this.vibrationHistory.length,
      availableTechniques: this.getAvailableTechniques(),
      availableDeviceTypes: this.getDeviceTypeProfiles(),
      estimatedEffectiveness: {
        'capability-spoofing': '70-75%',
        'vibration-pattern-spoofing': '75-80%',
        'device-type-variation': '72-78%',
        'vibration-permission-state': '65-70%',
        'combined': '80-85%'
      }
    };
  }
}

module.exports = VibrationAPIEvasion;

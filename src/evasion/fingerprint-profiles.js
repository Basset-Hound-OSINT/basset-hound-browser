/**
 * Basset Hound Browser - Dynamic Fingerprinting Profiles
 * Advanced fingerprint generation with temporal coherence and realistic evolution
 *
 * Version: 1.0.0
 * Created: May 11, 2026
 */

class DynamicFingerprintProfile {
  constructor(baseProfile = null) {
    this.baseProfile = baseProfile || this.generateRandomProfile();
    this.currentProfile = { ...this.baseProfile };
    this.interactionCount = 0;
    this.createdAt = Date.now();
    this.retirementThreshold = 100;
    this.history = [{ timestamp: this.createdAt, profile: this.baseProfile }];
    this.driftRange = [0.01, 0.02];  // 1-2% drift per interaction
    this.lastUpdate = Date.now();
  }

  /**
   * Generate a random but realistic device fingerprint
   */
  generateRandomProfile() {
    const profiles = [
      this.generateWindowsProfile(),
      this.generateMacProfile(),
      this.generateLinuxProfile(),
      this.generateiOSProfile(),
      this.generateAndroidProfile()
    ];

    return profiles[Math.floor(Math.random() * profiles.length)];
  }

  /**
   * Generate Windows device profile
   */
  generateWindowsProfile() {
    const versions = ['10', '11'];
    const version = versions[Math.floor(Math.random() * versions.length)];

    const gpus = [
      'ANGLE (Intel HD Graphics 630)',
      'ANGLE (Intel Iris Graphics 650)',
      'ANGLE (NVIDIA GeForce GTX 1080)',
      'ANGLE (AMD Radeon RX 580)',
      'ANGLE (Intel UHD Graphics 630)'
    ];

    const chromeVersions = ['120.0.0.0', '121.0.0.0', '122.0.0.0'];

    return {
      os: 'Windows',
      osVersion: version,
      browser: 'Chrome',
      browserVersion: chromeVersions[Math.floor(Math.random() * chromeVersions.length)],
      vendor: 'Google Inc.',
      userAgent: `Mozilla/5.0 (Windows NT ${10 + parseInt(version)}; Win64; x64) AppleWebKit/537.36`,
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
      colorDepth: 24,
      timezone: 'America/New_York',
      language: 'en-US',
      hardwareConcurrency: 8,
      maxTouchPoints: 0,
      gpu: gpus[Math.floor(Math.random() * gpus.length)],
      webglVendor: 'Google Inc.',
      webglRenderer: 'ANGLE (Intel HD Graphics 630)',
      plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer'],
      fonts: ['Arial', 'Verdana', 'Times New Roman', 'Courier New'],
      deviceType: 'desktop',
      touchEnabled: false
    };
  }

  /**
   * Generate macOS device profile
   */
  generateMacProfile() {
    const versions = ['12.6', '13.4', '14.2'];
    const version = versions[Math.floor(Math.random() * versions.length)];

    return {
      os: 'macOS',
      osVersion: version,
      browser: 'Safari',
      browserVersion: '17.2',
      vendor: 'Apple Computer, Inc.',
      userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X ${version}) AppleWebKit/605.1.15`,
      screenWidth: 1440,
      screenHeight: 900,
      devicePixelRatio: 2,
      colorDepth: 24,
      timezone: 'America/Los_Angeles',
      language: 'en-US',
      hardwareConcurrency: 8,
      maxTouchPoints: 0,
      gpu: 'Apple M1',
      webglVendor: 'Apple Inc.',
      webglRenderer: 'Apple M1',
      plugins: [],
      fonts: ['Helvetica', 'Georgia', 'Courier', 'Arial'],
      deviceType: 'desktop',
      touchEnabled: false
    };
  }

  /**
   * Generate Linux device profile
   */
  generateLinuxProfile() {
    return {
      os: 'Linux',
      osVersion: '5.15.0',
      browser: 'Firefox',
      browserVersion: '121.0',
      vendor: 'Mozilla',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
      screenWidth: 1920,
      screenHeight: 1080,
      devicePixelRatio: 1,
      colorDepth: 24,
      timezone: 'UTC',
      language: 'en-US',
      hardwareConcurrency: 4,
      maxTouchPoints: 0,
      gpu: 'Mesa Intel',
      webglVendor: 'Mozilla',
      webglRenderer: 'Mozilla Firefox',
      plugins: [],
      fonts: ['Liberation Sans', 'Liberation Serif', 'Courier New'],
      deviceType: 'desktop',
      touchEnabled: false
    };
  }

  /**
   * Generate iOS device profile
   */
  generateiOSProfile() {
    const models = ['iPhone 13 Pro', 'iPhone 14 Pro', 'iPhone 15 Pro'];
    const model = models[Math.floor(Math.random() * models.length)];

    return {
      os: 'iOS',
      osVersion: '17.2',
      browser: 'Safari',
      browserVersion: '17.2',
      vendor: 'Apple Inc.',
      userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15`,
      screenWidth: 390,
      screenHeight: 844,
      devicePixelRatio: 3,
      colorDepth: 24,
      timezone: 'America/New_York',
      language: 'en-US',
      hardwareConcurrency: 6,
      maxTouchPoints: 5,
      gpu: 'Apple A16 Bionic',
      model,
      deviceType: 'mobile',
      touchEnabled: true
    };
  }

  /**
   * Generate Android device profile
   */
  generateAndroidProfile() {
    const models = ['Pixel 6 Pro', 'Samsung Galaxy S23', 'OnePlus 11'];
    const model = models[Math.floor(Math.random() * models.length)];

    return {
      os: 'Android',
      osVersion: '13.0',
      browser: 'Chrome',
      browserVersion: '121.0.0.0',
      vendor: 'Google Inc.',
      userAgent: `Mozilla/5.0 (Linux; Android 13; ${model}) AppleWebKit/537.36`,
      screenWidth: 1080,
      screenHeight: 2340,
      devicePixelRatio: 3,
      colorDepth: 24,
      timezone: 'America/Chicago',
      language: 'en-US',
      hardwareConcurrency: 8,
      maxTouchPoints: 5,
      gpu: 'Qualcomm Adreno',
      model,
      deviceType: 'mobile',
      touchEnabled: true
    };
  }

  /**
   * Evolve fingerprint with realistic drift
   */
  evolveFingerprint() {
    if (this.interactionCount >= this.retirementThreshold) {
      return this.retire();
    }

    // Apply subtle drift to canvas/webgl fingerprints
    const evolved = { ...this.currentProfile };

    // 1-2% drift in canvas fingerprint (due to rendering variations)
    if (evolved.canvasNoise !== undefined) {
      const driftAmount = this.randomInRange(this.driftRange[0], this.driftRange[1]);
      evolved.canvasNoise += driftAmount * (Math.random() > 0.5 ? 1 : -1);
    }

    // Simulate hardware upgrade every 50 interactions
    if (this.interactionCount > 0 && this.interactionCount % 50 === 0) {
      evolved.gpu = this.upgradeGPU(evolved.gpu);
      evolved.browserVersion = this.upgradeChrome(evolved.browserVersion);
    }

    // Ensure device/OS coherence
    this.validateDeviceCoherence(evolved);

    this.interactionCount++;
    this.currentProfile = evolved;
    this.lastUpdate = Date.now();

    // Track history
    this.history.push({
      timestamp: Date.now(),
      profile: evolved,
      interactionIndex: this.interactionCount
    });

    return evolved;
  }

  /**
   * Upgrade GPU to a realistic newer model
   */
  upgradeGPU(currentGPU) {
    const upgrades = {
      'ANGLE (Intel HD Graphics 630)': 'ANGLE (Intel Iris Graphics 650)',
      'ANGLE (Intel Iris Graphics 650)': 'ANGLE (Intel Iris Plus Graphics)',
      'ANGLE (NVIDIA GeForce GTX 1080)': 'ANGLE (NVIDIA GeForce RTX 2080)',
      'ANGLE (AMD Radeon RX 580)': 'ANGLE (AMD Radeon RX 5700 XT)',
      'Apple M1': 'Apple M2',
      'Apple M2': 'Apple M3'
    };

    return upgrades[currentGPU] || currentGPU;
  }

  /**
   * Upgrade Chrome version realistically
   */
  upgradeChrome(currentVersion) {
    // Chrome increments major version roughly monthly
    const parts = currentVersion.split('.');
    const major = parseInt(parts[0]);
    const newMajor = Math.random() > 0.7 ? major + 1 : major;
    return `${newMajor}.0.0.0`;
  }

  /**
   * Validate device OS/browser combinations are possible
   */
  validateDeviceCoherence(profile) {
    // iOS can only be Safari
    if (profile.os === 'iOS' && profile.browser !== 'Safari') {
      profile.browser = 'Safari';
    }

    // macOS Safari is expected, Chrome also valid
    if (profile.os === 'macOS' && !['Safari', 'Chrome', 'Firefox'].includes(profile.browser)) {
      profile.browser = 'Safari';
    }

    // Android tablets are Chrome/Firefox, rarely Safari
    if (profile.os === 'Android' && profile.deviceType === 'tablet') {
      if (!['Chrome', 'Firefox'].includes(profile.browser)) {
        profile.browser = 'Chrome';
      }
    }

    // Windows is typically Chrome or Edge, rarely Firefox
    if (profile.os === 'Windows' && !['Chrome', 'Firefox', 'Edge'].includes(profile.browser)) {
      profile.browser = 'Chrome';
    }
  }

  /**
   * Retire current profile and generate new one
   */
  retire() {
    const newProfile = this.generateRandomProfile();
    const retired = {
      profile: this.currentProfile,
      retiredAt: Date.now(),
      lifespan: Date.now() - this.createdAt,
      interactions: this.interactionCount
    };

    this.baseProfile = newProfile;
    this.currentProfile = { ...newProfile };
    this.interactionCount = 0;
    this.createdAt = Date.now();
    this.history = [{ timestamp: Date.now(), profile: newProfile }];

    return {
      success: true,
      retired,
      newProfile
    };
  }

  /**
   * Get current fingerprint
   */
  getFingerprint() {
    return { ...this.currentProfile };
  }

  /**
   * Get fingerprint age
   */
  getAge() {
    return {
      ageInteractions: this.interactionCount,
      lifespan: this.retirementThreshold,
      percentage: (this.interactionCount / this.retirementThreshold) * 100,
      nextUpgradeAt: 50,
      nextRotationAt: this.retirementThreshold,
      status: this.interactionCount < this.retirementThreshold * 0.8 ? 'healthy' : 'aging'
    };
  }

  /**
   * Calculate fingerprint drift
   */
  calculateDrift(sampleSize = 10) {
    if (this.history.length < 2) {
      return { status: 'insufficient_history' };
    }

    const recentSamples = this.history.slice(-sampleSize);
    const drifts = [];

    for (let i = 1; i < recentSamples.length; i++) {
      const prev = recentSamples[i - 1].profile;
      const curr = recentSamples[i].profile;

      const similarity = this.calculateSimilarity(prev, curr);
      drifts.push(1 - similarity);
    }

    const avgDrift = drifts.reduce((a, b) => a + b) / drifts.length;
    const targetDrift = (this.driftRange[0] + this.driftRange[1]) / 2;

    return {
      avgDrift: avgDrift.toFixed(3),
      targetDrift: targetDrift.toFixed(3),
      healthy: avgDrift >= this.driftRange[0] && avgDrift <= this.driftRange[1],
      status: avgDrift > this.driftRange[1] ? 'excessive_drift' : 'normal'
    };
  }

  /**
   * Analyze coherence across multiple detection vectors
   */
  analyzeCoherence() {
    const profile = this.currentProfile;

    return {
      os_browser_coherence: this.checkOSBrowserCoherence(profile),
      screen_dpr_coherence: this.checkScreenCoherence(profile),
      gpu_rendering_coherence: this.checkGPUCoherence(profile),
      timezone_language_coherence: this.checkLocaleCoherence(profile),
      overall_coherence: this.calculateOverallCoherence(profile)
    };
  }

  /**
   * Check OS/Browser coherence
   */
  checkOSBrowserCoherence(profile) {
    const validCombos = {
      'Windows': ['Chrome', 'Firefox', 'Edge'],
      'macOS': ['Safari', 'Chrome', 'Firefox'],
      'iOS': ['Safari'],
      'Android': ['Chrome', 'Firefox'],
      'Linux': ['Chrome', 'Firefox']
    };

    const valid = validCombos[profile.os]?.includes(profile.browser) ?? true;
    return {
      valid,
      os: profile.os,
      browser: profile.browser,
      score: valid ? 1.0 : 0.0
    };
  }

  /**
   * Check screen/DPR coherence
   */
  checkScreenCoherence(profile) {
    let expectedDPR = 1;

    // iPhone/iPad typically have high DPR
    if (['iOS'].includes(profile.os)) {
      expectedDPR = 2;
    }

    // Android high-end devices have high DPR
    if (profile.os === 'Android' && profile.deviceType === 'mobile') {
      expectedDPR = 2.75;
    }

    // Desktop typically 1x or 2x
    if (profile.deviceType === 'desktop') {
      expectedDPR = 1;
    }

    const dprMatch = Math.abs(profile.devicePixelRatio - expectedDPR) < 0.5;

    return {
      expected: expectedDPR,
      actual: profile.devicePixelRatio,
      coherent: dprMatch,
      score: dprMatch ? 1.0 : 0.5
    };
  }

  /**
   * Check GPU rendering coherence
   */
  checkGPUCoherence(profile) {
    // M1/M2/M3 only on macOS with Apple silicon
    if (profile.gpu && profile.gpu.includes('Apple M')) {
      if (profile.os !== 'macOS') {
        return { coherent: false, score: 0.0, reason: 'Apple GPU on non-macOS' };
      }
    }

    // Intel GPUs on Windows typically
    if (profile.gpu && profile.gpu.includes('Intel')) {
      if (profile.os === 'macOS') {
        return { coherent: false, score: 0.2, reason: 'Intel GPU on modern macOS rare' };
      }
    }

    return { coherent: true, score: 1.0 };
  }

  /**
   * Check timezone/language coherence
   */
  checkLocaleCoherence(profile) {
    // Just check they're set to reasonable values
    const tzValid = profile.timezone && profile.timezone.includes('/');
    const langValid = profile.language && profile.language.match(/^[a-z]{2}-[A-Z]{2}$/);

    return {
      timezone: tzValid ? 'valid' : 'invalid',
      language: langValid ? 'valid' : 'invalid',
      coherent: tzValid && langValid,
      score: (tzValid && langValid) ? 1.0 : 0.5
    };
  }

  /**
   * Calculate overall fingerprint coherence
   */
  calculateOverallCoherence(profile) {
    const checks = [
      this.checkOSBrowserCoherence(profile),
      this.checkScreenCoherence(profile),
      this.checkGPUCoherence(profile),
      this.checkLocaleCoherence(profile)
    ];

    const avgScore = checks.reduce((sum, c) => sum + (c.score || 0), 0) / checks.length;
    return avgScore;
  }

  /**
   * Calculate similarity between two profiles
   */
  calculateSimilarity(profile1, profile2) {
    const keys = new Set([
      ...Object.keys(profile1),
      ...Object.keys(profile2)
    ]);

    if (keys.size === 0) {
      return 1.0;  // Empty objects are identical
    }

    let matches = 0;
    for (const key of keys) {
      if (profile1[key] === profile2[key]) {
        matches++;
      }
    }

    return matches / keys.size;
  }

  /**
   * Get fingerprint history
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit).map(entry => ({
      timestamp: entry.timestamp,
      interactionIndex: entry.interactionIndex,
      profile: entry.profile
    }));
  }

  /**
   * Compare fingerprints for changes
   */
  compareWithBaseline() {
    const current = this.currentProfile;
    const baseline = this.baseProfile;

    const changes = [];

    for (const key in current) {
      if (current[key] !== baseline[key]) {
        changes.push({
          property: key,
          baseline: baseline[key],
          current: current[key]
        });
      }
    }

    return {
      changeCount: changes.length,
      changed: changes.length > 0,
      changes
    };
  }

  /**
   * Random number in range
   */
  randomInRange(min, max) {
    return Math.random() * (max - min) + min;
  }
}

module.exports = {
  DynamicFingerprintProfile
};

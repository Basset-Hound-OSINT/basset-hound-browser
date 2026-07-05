/**
 * Basset Hound Browser - Fingerprint Isolation
 * Unique fingerprints per session with correlation prevention
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 *
 * Provides:
 * - Unique device profile per session (no sharing)
 * - Randomized WebGL report per session
 * - Independent Canvas fingerprint per session
 * - Separate battery/device info per session
 * - Correlation detection
 */

const crypto = require('crypto');

/**
 * Fingerprint Isolation Manager
 * Ensures each session has unique, uncorrelatable fingerprints
 *
 * @class FingerprintIsolation
 */
class FingerprintIsolation {
  constructor(options = {}) {
    this.fingerprints = new Map(); // sessionId -> fingerprint data
    this.correlationThreshold = options.correlationThreshold || 0.7; // 70% similarity = correlation
    this.enableCorrelationDetection = options.enableCorrelationDetection !== false;

    // Statistics
    this.stats = {
      fingerprintsGenerated: 0,
      correlationsDetected: 0,
      validationsRun: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generate unique fingerprint for session
   * Creates uncorrelatable device profile
   *
   * @param {string} sessionId - Session ID
   * @param {Object} options - Generation options
   * @returns {Object} Unique fingerprint
   */
  generateUniqueFingerprint(sessionId, options = {}) {
    if (this.fingerprints.has(sessionId)) {
      throw new Error(`Fingerprint already exists for session ${sessionId}`);
    }

    const fingerprint = {
      sessionId,
      generatedAt: Date.now(),

      // Device characteristics (randomized)
      device: {
        vendor: this.randomizeVendor(),
        model: this.randomizeModel(),
        platform: this.randomizePlatform(),
        platformVersion: this.randomizeVersion(),
        hardwareConcurrency: this.randomizeHardware(),
        deviceMemory: this.randomizeMemory(),
        maxTouchPoints: this.randomizeTouchPoints(),
        battery: this.generateBatteryInfo()
      },

      // Browser characteristics (randomized)
      browser: {
        userAgent: this.generateUserAgent(),
        acceptLanguage: this.randomizeLanguage(),
        timezone: this.randomizeTimezone(),
        viewport: this.randomizeViewport(),
        screenResolution: this.randomizeScreenResolution(),
        colorDepth: this.randomizeColorDepth(),
        pixelDepth: this.randomizePixelDepth()
      },

      // Canvas fingerprint (unique per session)
      canvas: {
        hash: this.generateCanvasHash(),
        textFingerprint: this.generateCanvasText(),
        imageData: this.generateCanvasImage()
      },

      // WebGL fingerprint (unique per session)
      webgl: {
        vendor: this.randomizeWebGLVendor(),
        renderer: this.randomizeWebGLRenderer(),
        shadingLanguageVersion: this.randomizeGLSLVersion(),
        unmaskedVendor: this.randomizeUnmaskedVendor(),
        unmaskedRenderer: this.randomizeUnmaskedRenderer(),
        parameters: this.generateWebGLParameters()
      },

      // Geolocation (if applicable)
      geolocation: this.generateGeolocation(),

      // WebRTC (for leak detection prevention)
      webrtc: {
        leak_detection: false,
        ip_masking: true,
        random_port: Math.floor(Math.random() * 65535)
      },

      // Fonts (randomized subset)
      fonts: this.randomizeFonts(),

      // Plugins (randomized)
      plugins: this.randomizePlugins(),

      // Audio context (unique fingerprint)
      audioContext: {
        hash: this.generateAudioHash(),
        sampleRate: [44100, 48000][Math.random() > 0.5 ? 0 : 1]
      },

      // Unique identifiers (not correlatable)
      identifiers: {
        sessionFingerprint: crypto.randomBytes(32).toString('hex'),
        deviceId: crypto.randomBytes(16).toString('hex'),
        fingerprint_id: `fp-${sessionId}-${Date.now()}`
      }
    };

    this.fingerprints.set(sessionId, fingerprint);
    this.stats.fingerprintsGenerated++;

    return {
      sessionId,
      fingerprintId: fingerprint.identifiers.fingerprint_id,
      generatedAt: fingerprint.generatedAt,
      unique: true
    };
  }

  /**
   * Get fingerprint for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Fingerprint data
   */
  getFingerprint(sessionId) {
    return this.fingerprints.get(sessionId) || null;
  }

  /**
   * Validate fingerprint uniqueness
   * Ensure session fingerprints are not correlatable
   *
   * @param {string} sessionId1 - First session ID
   * @param {string} sessionId2 - Second session ID
   * @returns {Object} Validation result
   */
  validateUniqueness(sessionId1, sessionId2) {
    const fp1 = this.getFingerprint(sessionId1);
    const fp2 = this.getFingerprint(sessionId2);

    if (!fp1 || !fp2) {
      return { valid: false, message: 'One or both fingerprints not found' };
    }

    // Check for identical/similar characteristics
    const similarities = this.calculateSimilarity(fp1, fp2);

    const correlated = Object.values(similarities).some(
      sim => sim > this.correlationThreshold
    );

    this.stats.validationsRun++;

    if (correlated) {
      this.stats.correlationsDetected++;
    }

    return {
      sessionId1,
      sessionId2,
      correlated,
      similarities,
      unique: !correlated
    };
  }

  /**
   * Calculate similarity between two fingerprints
   * @private
   */
  calculateSimilarity(fp1, fp2) {
    const similarities = {
      device: this.compareMaps(fp1.device, fp2.device),
      browser: this.compareMaps(fp1.browser, fp2.browser),
      canvas: fp1.canvas.hash === fp2.canvas.hash ? 1.0 : 0.0,
      webgl: this.compareMaps(fp1.webgl, fp2.webgl),
      audioContext: fp1.audioContext.hash === fp2.audioContext.hash ? 1.0 : 0.0
    };

    return similarities;
  }

  /**
   * Compare two objects for similarity
   * @private
   */
  compareMaps(obj1, obj2) {
    if (!obj1 || !obj2) {
      return 0;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length === 0) {
      return 0;
    }

    let matches = 0;
    for (const key of keys1) {
      if (obj1[key] === obj2[key]) {
        matches++;
      }
    }

    return matches / keys1.length;
  }

  /**
   * Validate fingerprints across multiple sessions
   * Comprehensive validation
   *
   * @param {Array<string>} sessionIds - Session IDs to validate
   * @returns {Object} Validation report
   */
  validateMultipleSessions(sessionIds) {
    const correlations = [];

    for (let i = 0; i < sessionIds.length; i++) {
      for (let j = i + 1; j < sessionIds.length; j++) {
        const result = this.validateUniqueness(sessionIds[i], sessionIds[j]);
        if (result.correlated) {
          correlations.push(result);
        }
      }
    }

    return {
      totalSessions: sessionIds.length,
      correlationCount: correlations.length,
      allUnique: correlations.length === 0,
      correlations
    };
  }

  /**
   * Regenerate fingerprint for session
   * Create new fingerprint to prevent tracking
   *
   * @param {string} sessionId - Session ID
   * @returns {Object} New fingerprint info
   */
  regenerateFingerprint(sessionId) {
    this.fingerprints.delete(sessionId);
    return this.generateUniqueFingerprint(sessionId);
  }

  /**
   * Get fingerprint summary (safe to expose)
   * High-level fingerprint info without sensitive details
   *
   * @param {string} sessionId - Session ID
   * @returns {Object} Summary
   */
  getFingerprintSummary(sessionId) {
    const fp = this.getFingerprint(sessionId);
    if (!fp) {
      return null;
    }

    return {
      sessionId,
      fingerprintId: fp.identifiers.fingerprint_id,
      generatedAt: fp.generatedAt,
      age: Date.now() - fp.generatedAt,
      characteristics: {
        device: Object.keys(fp.device).length,
        browser: Object.keys(fp.browser).length,
        webgl: Object.keys(fp.webgl).length,
        canvas: true,
        audioContext: true,
        fonts: fp.fonts.length,
        plugins: fp.plugins.length
      }
    };
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeFingerings: this.fingerprints.size
    };
  }

  /**
   * Cleanup fingerprints
   * @param {string} sessionId - Session ID (optional, clear all if not provided)
   */
  cleanup(sessionId = null) {
    if (sessionId) {
      const deleted = this.fingerprints.delete(sessionId);
      return { deleted, sessionId };
    }

    const count = this.fingerprints.size;
    this.fingerprints.clear();
    return { deleted: count, allCleared: true };
  }

  // ==================== Helper Methods ====================

  randomizeVendor() {
    const vendors = ['Apple', 'Google', 'Mozilla', 'Microsoft', 'Samsung', 'LG'];
    return vendors[Math.floor(Math.random() * vendors.length)];
  }

  randomizeModel() {
    const models = ['Phone', 'Tablet', 'Desktop', 'Laptop', 'Watch'];
    return `${models[Math.floor(Math.random() * models.length)]}-${Math.random().toString(36).slice(-8)}`;
  }

  randomizePlatform() {
    const platforms = ['Linux', 'Win32', 'MacIntel', 'iPhone', 'Android'];
    return platforms[Math.floor(Math.random() * platforms.length)];
  }

  randomizeVersion() {
    return `${Math.floor(Math.random() * 20) + 10}.${Math.floor(Math.random() * 9)}`;
  }

  randomizeHardware() {
    return Math.floor(Math.random() * 8) + 1; // 1-8 cores
  }

  randomizeMemory() {
    const options = [2, 4, 8, 16, 32, 64];
    return options[Math.floor(Math.random() * options.length)];
  }

  randomizeTouchPoints() {
    return [0, 5, 10][Math.floor(Math.random() * 3)];
  }

  generateBatteryInfo() {
    return {
      charging: Math.random() > 0.5,
      chargingTime: Math.floor(Math.random() * 3600),
      dischargingTime: Math.floor(Math.random() * 36000),
      level: Math.random().toFixed(2)
    };
  }

  generateUserAgent() {
    const browsers = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
    ];
    return browsers[Math.floor(Math.random() * browsers.length)];
  }

  randomizeLanguage() {
    const languages = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'ja-JP'];
    return languages[Math.floor(Math.random() * languages.length)];
  }

  randomizeTimezone() {
    const timezones = ['UTC', 'EST', 'CST', 'MST', 'PST', 'GMT', 'CET'];
    return timezones[Math.floor(Math.random() * timezones.length)];
  }

  randomizeViewport() {
    const widths = [1920, 1366, 1024, 768, 414, 375];
    const heights = [1080, 768, 600, 1024, 896, 812];
    return {
      width: widths[Math.floor(Math.random() * widths.length)],
      height: heights[Math.floor(Math.random() * heights.length)]
    };
  }

  randomizeScreenResolution() {
    return this.randomizeViewport(); // Reuse viewport logic
  }

  randomizeColorDepth() {
    return [8, 16, 24, 32][Math.floor(Math.random() * 4)];
  }

  randomizePixelDepth() {
    return this.randomizeColorDepth();
  }

  generateCanvasHash() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateCanvasText() {
    return `text-fp-${crypto.randomBytes(8).toString('hex')}`;
  }

  generateCanvasImage() {
    return crypto.randomBytes(32).toString('base64').slice(0, 50);
  }

  randomizeWebGLVendor() {
    const vendors = ['Google Inc.', 'Apple Inc.', 'Mozilla', 'Khronos'];
    return vendors[Math.floor(Math.random() * vendors.length)];
  }

  randomizeWebGLRenderer() {
    const renderers = ['ANGLE', 'Mesa', 'Apple M1', 'Intel HD Graphics', 'NVIDIA'];
    return renderers[Math.floor(Math.random() * renderers.length)];
  }

  randomizeGLSLVersion() {
    return `WebGL GLSL ES ${['1.0', '3.0'][Math.random() > 0.5 ? 0 : 1]}`;
  }

  randomizeUnmaskedVendor() {
    return `Vendor-${Math.random().toString(36).slice(-8)}`;
  }

  randomizeUnmaskedRenderer() {
    return `Renderer-${Math.random().toString(36).slice(-8)}`;
  }

  generateWebGLParameters() {
    return {
      maxTextureSize: [4096, 8192, 16384][Math.floor(Math.random() * 3)],
      maxCubeMapTextureSize: [4096, 8192][Math.random() > 0.5 ? 0 : 1],
      maxRenderbufferSize: [4096, 8192, 16384][Math.floor(Math.random() * 3)]
    };
  }

  generateGeolocation() {
    return {
      latitude: (Math.random() * 180 - 90).toFixed(6),
      longitude: (Math.random() * 360 - 180).toFixed(6),
      accuracy: Math.floor(Math.random() * 100) + 10
    };
  }

  randomizeFonts() {
    const fonts = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier', 'Comic Sans'];
    const count = Math.floor(Math.random() * fonts.length) + 3;
    return fonts.slice(0, count);
  }

  randomizePlugins() {
    const plugins = ['Flash', 'Silverlight', 'Java', 'PDF Reader'];
    const count = Math.floor(Math.random() * plugins.length);
    return plugins.slice(0, count);
  }

  generateAudioHash() {
    return crypto.randomBytes(16).toString('hex');
  }
}

module.exports = FingerprintIsolation;

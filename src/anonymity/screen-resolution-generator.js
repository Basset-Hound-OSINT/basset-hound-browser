/**
 * Screen Resolution Generator
 * Generates realistic screen resolutions matching device profiles
 * Features: Real resolutions from actual devices, aspect ratio validation, DPI matching
 * All generated resolutions remain consistent throughout a session
 */

class ScreenResolutionGenerator {
  constructor() {
    this.currentProfile = null;
    this.generatedResolution = null;
    this.resolutionDatabase = this.initializeResolutions();
  }

  /**
   * Initialize database of real resolutions from actual devices
   * Organized by device type and DPI
   */
  initializeResolutions() {
    return {
      // iPhone resolutions (actual iPhone screens)
      'iPhone': [
        { width: 390, height: 844, dpi: 2.0, model: 'iPhone 15' },
        { width: 430, height: 932, dpi: 3.0, model: 'iPhone 15 Pro Max' },
        { width: 393, height: 852, dpi: 3.0, model: 'iPhone 14 Pro' },
        { width: 375, height: 812, dpi: 3.0, model: 'iPhone 13 Pro' },
        { width: 390, height: 844, dpi: 3.0, model: 'iPhone 14' },
        { width: 1170, height: 2532, dpi: 3.0, model: 'iPhone 15 native' },
        { width: 1284, height: 2778, dpi: 3.0, model: 'iPhone 15 Pro Max native' }
      ],
      // Samsung Galaxy resolutions
      'Samsung': [
        { width: 412, height: 915, dpi: 2.75, model: 'Galaxy S24' },
        { width: 360, height: 800, dpi: 2.0, model: 'Galaxy S21' },
        { width: 384, height: 855, dpi: 2.75, model: 'Galaxy S23' },
        { width: 400, height: 900, dpi: 2.5, model: 'Galaxy A50' },
        { width: 540, height: 1440, dpi: 3.0, model: 'Galaxy Z Fold' }
      ],
      // Google Pixel resolutions
      'Pixel': [
        { width: 412, height: 915, dpi: 2.75, model: 'Pixel 8' },
        { width: 411, height: 914, dpi: 2.75, model: 'Pixel 7' },
        { width: 412, height: 866, dpi: 2.75, model: 'Pixel 6' },
        { width: 480, height: 854, dpi: 1.75, model: 'Pixel 6a' }
      ],
      // iPad resolutions
      'iPad': [
        { width: 1024, height: 1366, dpi: 2.0, model: 'iPad Pro 12.9"' },
        { width: 768, height: 1024, dpi: 2.0, model: 'iPad mini' },
        { width: 820, height: 1180, dpi: 2.0, model: 'iPad Air' },
        { width: 810, height: 1080, dpi: 2.0, model: 'iPad 10th gen' },
        { width: 1000, height: 1450, dpi: 2.0, model: 'iPad Pro 11"' }
      ],
      // Windows desktop resolutions
      'Windows': [
        { width: 1920, height: 1080, dpi: 1.0, model: 'Full HD' },
        { width: 2560, height: 1440, dpi: 1.0, model: '2K (1440p)' },
        { width: 3840, height: 2160, dpi: 1.0, model: '4K (2160p)' },
        { width: 1366, height: 768, dpi: 1.0, model: 'HD' },
        { width: 1024, height: 768, dpi: 1.0, model: 'XGA' }
      ],
      // MacBook resolutions
      'MacBook': [
        { width: 2560, height: 1600, dpi: 2.0, model: 'MacBook Pro 16"' },
        { width: 1920, height: 1200, dpi: 2.0, model: 'MacBook Pro 14"' },
        { width: 2304, height: 1440, dpi: 2.0, model: 'MacBook Air M2 13"' },
        { width: 1920, height: 1080, dpi: 1.0, model: 'MacBook legacy' }
      ],
      // Android tablets
      'Android-Tablet': [
        { width: 800, height: 1280, dpi: 1.5, model: 'Galaxy Tab S9' },
        { width: 600, height: 1024, dpi: 1.5, model: 'Galaxy Tab A' },
        { width: 1024, height: 768, dpi: 1.0, model: 'Generic Android Tablet' }
      ]
    };
  }

  /**
   * Initialize from device profile
   */
  initializeFromProfile(profile) {
    if (!profile) {
      throw new Error('Profile required');
    }

    this.currentProfile = profile;
    this.generatedResolution = this.generateFromProfile(profile);
    return this.generatedResolution;
  }

  /**
   * Generate realistic resolution from device profile
   */
  generateFromProfile(profile) {
    const { deviceType, vendor, screenWidth, screenHeight } = profile;

    // Determine device category
    let deviceCategory;
    if (deviceType === 'mobile') {
      if (vendor === 'Apple') {
        deviceCategory = 'iPhone';
      } else if (vendor === 'Google') {
        deviceCategory = 'Pixel';
      } else {
        deviceCategory = 'Samsung'; // Default to Samsung for other Android
      }
    } else if (deviceType === 'tablet') {
      if (vendor === 'Apple') {
        deviceCategory = 'iPad';
      } else {
        deviceCategory = 'Android-Tablet';
      }
    } else {
      // Desktop
      if (vendor === 'Apple') {
        deviceCategory = 'MacBook';
      } else {
        deviceCategory = 'Windows';
      }
    }

    // Get resolutions for this category
    const categoryResolutions = this.resolutionDatabase[deviceCategory];
    if (!categoryResolutions) {
      throw new Error(`No resolutions found for ${deviceCategory}`);
    }

    // Select random resolution from category
    const resolution = categoryResolutions[Math.floor(Math.random() * categoryResolutions.length)];

    return {
      width: resolution.width,
      height: resolution.height,
      dpi: resolution.dpi,
      colorDepth: 24,
      pixelDepth: 24,
      availWidth: resolution.width,
      availHeight: resolution.height - (deviceType === 'desktop' ? 40 : 0), // Account for taskbar
      model: resolution.model
    };
  }

  /**
   * Get currently generated resolution
   */
  getResolution() {
    if (!this.generatedResolution) {
      throw new Error('No resolution generated - call initializeFromProfile first');
    }
    return this.generatedResolution;
  }

  /**
   * Calculate aspect ratio for validation
   */
  calculateAspectRatio(width, height) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Validate resolution has realistic aspect ratio
   */
  validateAspectRatio(width, height, deviceType) {
    const ratio = this.calculateAspectRatio(width, height);
    const numRatio = width / height;

    // Realistic aspect ratios by device type
    const validRatios = {
      mobile: [
        { min: 0.45, max: 0.6 } // 9:16 to 9:20 (portrait)
      ],
      tablet: [
        { min: 0.6, max: 1.33 } // 4:3 to 16:10
      ],
      desktop: [
        { min: 1.3, max: 2.35 } // 4:3 to ultrawide
      ]
    };

    const typeRatios = validRatios[deviceType];
    if (!typeRatios) {
      return false;
    }

    return typeRatios.some(r => numRatio >= r.min && numRatio <= r.max);
  }

  /**
   * Validate resolution is realistic
   */
  validateResolution(resolution) {
    const { width, height, dpi } = resolution;

    // Check width/height are positive
    if (width <= 0 || height <= 0) {
      return false;
    }

    // Check DPI is valid
    const validDPIs = [1.0, 1.5, 2.0, 2.5, 2.75, 3.0];
    if (!validDPIs.includes(dpi)) {
      return false;
    }

    // Check dimensions are reasonable (not too large or too small)
    if (width < 320 || width > 5120) {
      return false;
    }
    if (height < 480 || height > 3200) {
      return false;
    }

    return true;
  }

  /**
   * Get a random resolution from category
   */
  getRandomResolution(category) {
    if (!this.resolutionDatabase[category]) {
      throw new Error(`Unknown category: ${category}`);
    }

    const resolutions = this.resolutionDatabase[category];
    const resolution = resolutions[Math.floor(Math.random() * resolutions.length)];

    return {
      width: resolution.width,
      height: resolution.height,
      dpi: resolution.dpi,
      colorDepth: 24,
      pixelDepth: 24,
      availWidth: resolution.width,
      availHeight: resolution.height - 40,
      model: resolution.model
    };
  }

  /**
   * Get all available categories
   */
  getAvailableCategories() {
    return Object.keys(this.resolutionDatabase);
  }

  /**
   * Reset to uninitialized state
   */
  reset() {
    this.currentProfile = null;
    this.generatedResolution = null;
  }
}

module.exports = ScreenResolutionGenerator;

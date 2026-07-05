/**
 * User Agent Generator
 * Generates valid, realistic user agents matching device profiles
 * Features: Real UA templates, OS-browser version matching, mobile/desktop detection
 * All generated UAs remain consistent throughout a session
 */

class UserAgentGenerator {
  constructor() {
    this.currentProfile = null;
    this.generatedUA = null;
    this.uaTemplates = this.initializeTemplates();
  }

  /**
   * Initialize real user agent templates organized by platform
   * Templates include placeholders for dynamic values
   */
  initializeTemplates() {
    return {
      // iOS User Agents - iPhone
      'iPhone-Safari': [
        'Mozilla/5.0 (iPhone; CPU iPhone OS {osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{browserVersion} Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPhone; CPU iPhone OS {osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{browserVersion} Mobile/15E148 Safari/605.1.15'
      ],
      // iOS User Agents - iPad
      'iPad-Safari': [
        'Mozilla/5.0 (iPad; CPU OS {osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{browserVersion} Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (iPad; CPU OS {osVersion} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{browserVersion} Safari/605.1.15'
      ],
      // Chrome on Android
      'Android-Chrome': [
        'Mozilla/5.0 (Linux; Android {osVersion}; {deviceModel}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android {osVersion}; {deviceModel}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36'
      ],
      // Firefox on Android
      'Android-Firefox': [
        'Mozilla/5.0 (Android; Mobile; rv:{browserVersion}.0) Gecko/{browserVersion}.0 Firefox/{browserVersion}.0',
        'Mozilla/5.0 (Android {osVersion}; Mobile; rv:{browserVersion}.0) Gecko/{browserVersion}.0 Firefox/{browserVersion}.0'
      ],
      // Chrome on Windows
      'Windows-Chrome': [
        'Mozilla/5.0 (Windows NT {osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36',
        'Mozilla/5.0 (Windows NT {osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36'
      ],
      // Chrome on macOS
      'macOS-Chrome': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X {osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36',
        'Mozilla/5.0 (Macintosh; PPC Mac OS X {osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36'
      ],
      // Safari on macOS
      'macOS-Safari': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X {osVersion}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/{browserVersion} Safari/605.1.15'
      ],
      // Firefox on Windows
      'Windows-Firefox': [
        'Mozilla/5.0 (Windows NT {osVersion}; Win64; x64; rv:{browserVersion}.0) Gecko/20100101 Firefox/{browserVersion}.0',
        'Mozilla/5.0 (Windows NT {osVersion}; WOW64; rv:{browserVersion}.0) Gecko/20100101 Firefox/{browserVersion}.0'
      ],
      // Firefox on macOS
      'macOS-Firefox': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X {osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/{browserVersion}',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X {osVersion}; rv:{browserVersion}.0) Gecko/20100101 Firefox/{browserVersion}.0'
      ],
      // Edge on Windows
      'Windows-Edge': [
        'Mozilla/5.0 (Windows NT {osVersion}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36 Edg/{browserVersion}'
      ],
      // Edge on macOS
      'macOS-Edge': [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X {osVersion}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{browserVersion} Safari/537.36 Edg/{browserVersion}'
      ]
    };
  }

  /**
   * Version mapping: OS version to realistic browser version
   */
  getVersionMapping() {
    return {
      // iOS to Safari/Chrome versions
      'iOS-17': { Safari: '17.4', Chrome: '123' },
      'iOS-16': { Safari: '16.7', Chrome: '122' },
      'iOS-15': { Safari: '15.7', Chrome: '120' },
      // Android to Chrome versions
      'Android-14': { Chrome: '123' },
      'Android-13': { Chrome: '121' },
      'Android-12': { Chrome: '119' },
      // Windows to Chrome/Firefox/Edge versions
      'Windows-11': { Chrome: '123', Firefox: '124', Edge: '123' },
      'Windows-10': { Chrome: '122', Firefox: '123', Edge: '122' },
      // macOS to Safari/Chrome/Firefox versions
      'macOS-14': { Safari: '17.4', Chrome: '123', Firefox: '124' },
      'macOS-13': { Safari: '16.7', Chrome: '122', Firefox: '123' }
    };
  }

  /**
   * Initialize from device profile (mobile, desktop, tablet)
   */
  initializeFromProfile(profile) {
    if (!profile) {
      throw new Error('Profile required');
    }

    this.currentProfile = profile;
    this.generatedUA = this.generateFromProfile(profile);
    return this.generatedUA;
  }

  /**
   * Generate UA from device profile
   */
  generateFromProfile(profile) {
    const { deviceType, screenWidth, screenHeight } = profile;

    // Determine platform and browser based on device profile
    const { platform, browser, osVersion, deviceModel } = this.determinePlatform(profile);

    // Select template
    const templateKey = `${platform}-${browser}`;
    const templates = this.uaTemplates[templateKey];

    if (!templates) {
      throw new Error(`No templates found for ${templateKey}`);
    }

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Get browser version
    const versionKey = `${platform.split('-')[0]}-${osVersion.split('.')[0]}`;
    const versionMap = this.getVersionMapping()[versionKey];
    const browserVersion = versionMap ? versionMap[browser] : '123';

    // Replace placeholders
    const ua = template
      .replace('{osVersion}', osVersion)
      .replace('{browserVersion}', browserVersion)
      .replace('{deviceModel}', deviceModel || '');

    return ua.trim();
  }

  /**
   * Determine platform and browser from device profile
   */
  determinePlatform(profile) {
    const { deviceType, vendor, screenWidth, screenHeight } = profile;

    if (vendor && vendor.includes('Apple')) {
      if (deviceType === 'mobile') {
        return {
          platform: 'iPhone',
          browser: 'Safari',
          osVersion: '17.4.1',
          deviceModel: 'iPhone15,2'
        };
      } else if (deviceType === 'tablet') {
        return {
          platform: 'iPad',
          browser: 'Safari',
          osVersion: '17.4.1',
          deviceModel: 'iPad11,3'
        };
      } else {
        // Desktop/macOS
        return {
          platform: 'macOS',
          browser: 'Safari',
          osVersion: '14.1.1',
          deviceModel: ''
        };
      }
    }

    if (vendor && vendor.includes('Google')) {
      if (deviceType === 'mobile' || deviceType === 'tablet') {
        return {
          platform: 'Android',
          browser: 'Chrome',
          osVersion: '14.0',
          deviceModel: 'Pixel 8'
        };
      } else {
        // Desktop/Windows
        return {
          platform: 'Windows',
          browser: 'Chrome',
          osVersion: '10.0',
          deviceModel: ''
        };
      }
    }

    // Default to Windows/Chrome for unknown
    return {
      platform: 'Windows',
      browser: 'Chrome',
      osVersion: '10.0',
      deviceModel: ''
    };
  }

  /**
   * Get currently generated user agent
   */
  getUserAgent() {
    if (!this.generatedUA) {
      throw new Error('No UA generated - call initializeFromProfile first');
    }
    return this.generatedUA;
  }

  /**
   * Validate UA format (basic regex check)
   */
  validateUserAgent(ua) {
    // Check basic Mozilla format
    if (!ua.startsWith('Mozilla/5.0')) {
      return false;
    }

    // Check for required UA structure
    if (!ua.includes('AppleWebKit') && !ua.includes('Gecko') && !ua.includes('Edg')) {
      return false;
    }

    // Check length (realistic UAs are 100-300 chars)
    if (ua.length < 80 || ua.length > 400) {
      return false;
    }

    return true;
  }

  /**
   * Get all available UA templates (for testing/debugging)
   */
  getAvailableTemplates() {
    return Object.keys(this.uaTemplates);
  }

  /**
   * Reset to uninitialized state
   */
  reset() {
    this.currentProfile = null;
    this.generatedUA = null;
  }
}

module.exports = UserAgentGenerator;

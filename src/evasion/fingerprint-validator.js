/**
 * Fingerprint Profile Validator
 * Validates device fingerprint profiles to prevent crashes and detection
 * CVSS Impact: Prevents crashes from malformed profiles, ensures detection evasion
 */

// Optional logger - gracefully handle if not available
let logger;
try {
  const loggerModule = require('../../logging/logger');
  logger = loggerModule.defaultLogger || loggerModule;
} catch (e) {
  logger = {
    warn: (msg) => console.warn(msg),
    info: (msg) => console.log(msg)
  };
}

const fs = require('fs');
const path = require('path');

// Required properties for a valid fingerprint profile
const REQUIRED_FIELDS = [
  'userAgent',
  'platform',
  'platformVersion',
  'vendor',
  'vendorSub',
  'hardwareConcurrency',
  'deviceMemory',
  'maxTouchPoints',
  'language',
  'languages',
  'screenWidth',
  'screenHeight',
  'screenColorDepth',
  'timezone'
];

// Optional fields that are often present
const OPTIONAL_FIELDS = [
  'webdriver',
  'chromeVersion',
  'firefoxVersion',
  'safariVersion',
  'edgeVersion',
  'deviceName',
  'osName',
  'browserName',
  'fingerprint',
  'canvasFingerprint',
  'webglFingerprint',
  'audioContextFingerprint'
];

// Field type validators
const FIELD_VALIDATORS = {
  userAgent: (v) => typeof v === 'string' && v.length > 0 && v.length < 500,
  platform: (v) => typeof v === 'string' && ['Win32', 'Linux', 'MacIntel', 'iPhone', 'iPad', 'Android'].includes(v),
  platformVersion: (v) => typeof v === 'string' && v.length > 0,
  vendor: (v) => typeof v === 'string' && v.length >= 0,
  vendorSub: (v) => typeof v === 'string' && v.length >= 0,
  hardwareConcurrency: (v) => Number.isInteger(v) && v > 0 && v <= 256,
  deviceMemory: (v) => Number.isInteger(v) && v > 0 && v <= 1024,
  maxTouchPoints: (v) => Number.isInteger(v) && v >= 0 && v <= 10,
  language: (v) => typeof v === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(v),
  languages: (v) => Array.isArray(v) && v.length > 0 && v.every(l => typeof l === 'string'),
  screenWidth: (v) => Number.isInteger(v) && v > 0 && v <= 7680,
  screenHeight: (v) => Number.isInteger(v) && v > 0 && v <= 4320,
  screenColorDepth: (v) => Number.isInteger(v) && [8, 16, 24, 32].includes(v),
  timezone: (v) => typeof v === 'string' && v.length > 0,
  webdriver: (v) => typeof v === 'boolean',
  chromeVersion: (v) => typeof v === 'string' || v === null,
  firefoxVersion: (v) => typeof v === 'string' || v === null,
  safariVersion: (v) => typeof v === 'string' || v === null,
  edgeVersion: (v) => typeof v === 'string' || v === null,
  deviceName: (v) => typeof v === 'string',
  osName: (v) => typeof v === 'string',
  browserName: (v) => typeof v === 'string',
  fingerprint: (v) => typeof v === 'string',
  canvasFingerprint: (v) => typeof v === 'string',
  webglFingerprint: (v) => typeof v === 'string',
  audioContextFingerprint: (v) => typeof v === 'string'
};

class FingerprintValidator {
  /**
   * Validates a single fingerprint profile
   * @param {Object} profile - Profile to validate
   * @returns {Object} { valid: boolean, errors: Array<string> }
   */
  static validateProfile(profile) {
    const errors = [];

    if (!profile || typeof profile !== 'object') {
      return { valid: false, errors: ['Profile must be an object'] };
    }

    // Check for required fields
    for (const field of REQUIRED_FIELDS) {
      if (!(field in profile)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate all fields
    for (const [field, value] of Object.entries(profile)) {
      if (field.startsWith('_') || field === 'id' || field === 'name') {
        // Skip internal/metadata fields
        continue;
      }

      if (FIELD_VALIDATORS[field]) {
        if (!FIELD_VALIDATORS[field](value)) {
          errors.push(`Invalid value for field "${field}": ${JSON.stringify(value)}`);
        }
      } else if (!OPTIONAL_FIELDS.includes(field)) {
        // Unknown field - log warning but don't fail
        logger.warn(`Unknown field in fingerprint profile: ${field}`);
      }
    }

    // Cross-field validation
    if (profile.screenWidth && profile.screenHeight) {
      const aspectRatio = profile.screenWidth / profile.screenHeight;
      // Check for realistic aspect ratios (1:1 to 3:1)
      if (aspectRatio < 0.5 || aspectRatio > 3) {
        errors.push(`Suspicious screen aspect ratio: ${aspectRatio.toFixed(2)}`);
      }
    }

    // Validate language matches timezone
    if (profile.language && profile.timezone) {
      const isValidLanguageTimezone = this._validateLanguageTimezone(profile.language, profile.timezone);
      if (!isValidLanguageTimezone) {
        logger.warn(`Unusual language/timezone combination: ${profile.language}/${profile.timezone}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates multiple profiles
   * @param {Array<Object>} profiles - Profiles to validate
   * @returns {Object} { valid: boolean, results: Array<Object> }
   */
  static validateProfiles(profiles) {
    if (!Array.isArray(profiles)) {
      return {
        valid: false,
        results: [{ index: 0, valid: false, errors: ['Input must be an array'] }]
      };
    }

    if (profiles.length === 0) {
      return {
        valid: false,
        results: [{ index: 0, valid: false, errors: ['At least one profile required'] }]
      };
    }

    if (profiles.length > 500) {
      return {
        valid: false,
        results: [{ index: 0, valid: false, errors: ['Too many profiles (max 500)'] }]
      };
    }

    const results = [];
    let allValid = true;

    for (let i = 0; i < profiles.length; i++) {
      const result = this.validateProfile(profiles[i]);
      results.push({
        index: i,
        ...result
      });
      if (!result.valid) {
        allValid = false;
      }
    }

    // Check for duplicate user agents
    const userAgents = new Set();
    for (const profile of profiles) {
      if (profile.userAgent && userAgents.has(profile.userAgent)) {
        logger.warn(`Duplicate user agent detected: ${profile.userAgent}`);
      }
      userAgents.add(profile.userAgent);
    }

    return { valid: allValid && results.length > 0, results };
  }

  /**
   * Validates a profiles file (JSON)
   * @param {string} filePath - Path to profiles file
   * @returns {Object} { valid: boolean, profiles: Array, errors: Array<string> }
   */
  static validateProfilesFile(filePath) {
    const errors = [];
    let profiles = [];

    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        return {
          valid: false,
          profiles: [],
          errors: [`File not found: ${filePath}`]
        };
      }

      // Check file is readable
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return {
          valid: false,
          profiles: [],
          errors: [`Path is not a file: ${filePath}`]
        };
      }

      // Check file size (max 10MB)
      if (stats.size > 10 * 1024 * 1024) {
        return {
          valid: false,
          profiles: [],
          errors: ['File is too large (max 10MB)']
        };
      }

      // Read and parse JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      profiles = JSON.parse(content);

      // Handle both array and object with profiles property
      if (!Array.isArray(profiles)) {
        if (profiles.profiles && Array.isArray(profiles.profiles)) {
          profiles = profiles.profiles;
        } else {
          return {
            valid: false,
            profiles: [],
            errors: ['Invalid format: must be array or object with profiles array']
          };
        }
      }

      // Validate profiles
      const result = this.validateProfiles(profiles);

      return {
        valid: result.valid,
        profiles: result.valid ? profiles : [],
        errors: result.valid ? [] : result.results.flatMap((r) => r.errors || [])
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push(`JSON parsing error: ${error.message}`);
      } else {
        errors.push(`Error reading file: ${error.message}`);
      }

      return {
        valid: false,
        profiles: [],
        errors
      };
    }
  }

  /**
   * Validates a directory of profile files
   * @param {string} dirPath - Path to directory containing profile files
   * @returns {Object} { valid: boolean, profileCount: number, errors: Array<string> }
   */
  static validateProfilesDirectory(dirPath) {
    const errors = [];
    let totalProfiles = 0;

    try {
      if (!fs.existsSync(dirPath)) {
        return { valid: false, profileCount: 0, errors: [`Directory not found: ${dirPath}`] };
      }

      const stats = fs.statSync(dirPath);
      if (!stats.isDirectory()) {
        return { valid: false, profileCount: 0, errors: [`Path is not a directory: ${dirPath}`] };
      }

      const files = fs.readdirSync(dirPath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      if (jsonFiles.length === 0) {
        return { valid: false, profileCount: 0, errors: ['No JSON files found in directory'] };
      }

      for (const file of jsonFiles) {
        const filePath = path.join(dirPath, file);
        const result = this.validateProfilesFile(filePath);

        if (!result.valid) {
          errors.push(`Error in ${file}: ${result.errors.join(', ')}`);
        } else {
          totalProfiles += result.profiles.length;
        }
      }

      return {
        valid: errors.length === 0,
        profileCount: totalProfiles,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        profileCount: 0,
        errors: [`Error scanning directory: ${error.message}`]
      };
    }
  }

  /**
   * Gets the required and optional field lists
   * @returns {Object} { required: Array<string>, optional: Array<string> }
   */
  static getFieldLists() {
    return {
      required: REQUIRED_FIELDS,
      optional: OPTIONAL_FIELDS
    };
  }

  /**
   * Validates language/timezone combination
   * @private
   */
  static _validateLanguageTimezone(language, timezone) {
    // This is a simple heuristic - in production, use a full language/timezone database
    const languagePrefixes = {
      'en': ['America', 'Europe', 'Asia', 'Australia', 'Africa'],
      'fr': ['Europe', 'Africa'],
      'de': ['Europe'],
      'es': ['Europe', 'America'],
      'zh': ['Asia'],
      'ja': ['Asia'],
      'ru': ['Europe', 'Asia'],
      'pt': ['Europe', 'America', 'Africa'],
      'ko': ['Asia'],
      'it': ['Europe'],
      'nl': ['Europe'],
      'pl': ['Europe'],
      'tr': ['Europe', 'Asia'],
      'hi': ['Asia'],
      'ar': ['Africa', 'Asia']
    };

    const langCode = language.split('-')[0];
    const tzRegion = timezone.split('/')[0];

    if (!languagePrefixes[langCode]) {
      return true; // Unknown language, assume valid
    }

    return languagePrefixes[langCode].includes(tzRegion);
  }
}

module.exports = FingerprintValidator;

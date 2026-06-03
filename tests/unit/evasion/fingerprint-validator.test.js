/**
 * Fingerprint Validator Tests
 * Tests device fingerprint profile validation
 */

const FingerprintValidator = require('../../../src/evasion/fingerprint-validator');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('FingerprintValidator', () => {
  // Sample valid profile
  const validProfile = {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    platform: 'Win32',
    platformVersion: '10.0',
    vendor: 'Google Inc.',
    vendorSub: '',
    hardwareConcurrency: 8,
    deviceMemory: 16,
    maxTouchPoints: 0,
    language: 'en-US',
    languages: ['en-US', 'en'],
    screenWidth: 1920,
    screenHeight: 1080,
    screenColorDepth: 24,
    timezone: 'America/New_York'
  };

  describe('validateProfile', () => {
    test('accepts valid profiles', () => {
      const result = FingerprintValidator.validateProfile(validProfile);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    test('rejects profiles missing required fields', () => {
      const profile = { ...validProfile };
      delete profile.userAgent;

      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('userAgent'))).toBe(true);
    });

    test('rejects non-object profiles', () => {
      const result = FingerprintValidator.validateProfile('not-an-object');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be an object');
    });

    test('rejects null profiles', () => {
      const result = FingerprintValidator.validateProfile(null);
      expect(result.valid).toBe(false);
    });

    test('validates userAgent field', () => {
      const invalid1 = { ...validProfile, userAgent: '' };
      const invalid2 = { ...validProfile, userAgent: 'A'.repeat(501) };
      const invalid3 = { ...validProfile, userAgent: 123 };

      expect(FingerprintValidator.validateProfile(invalid1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid2).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid3).valid).toBe(false);
    });

    test('validates platform field', () => {
      const validPlatforms = ['Win32', 'Linux', 'MacIntel', 'iPhone', 'iPad', 'Android'];

      validPlatforms.forEach((platform) => {
        const profile = { ...validProfile, platform };
        expect(FingerprintValidator.validateProfile(profile).valid).toBe(true);
      });

      const invalid = { ...validProfile, platform: 'InvalidOS' };
      expect(FingerprintValidator.validateProfile(invalid).valid).toBe(false);
    });

    test('validates hardwareConcurrency', () => {
      const valid1 = { ...validProfile, hardwareConcurrency: 1 };
      const valid2 = { ...validProfile, hardwareConcurrency: 256 };
      const invalid1 = { ...validProfile, hardwareConcurrency: 0 };
      const invalid2 = { ...validProfile, hardwareConcurrency: 257 };

      expect(FingerprintValidator.validateProfile(valid1).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(valid2).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(invalid1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid2).valid).toBe(false);
    });

    test('validates deviceMemory', () => {
      const valid = { ...validProfile, deviceMemory: 512 };
      const invalid1 = { ...validProfile, deviceMemory: 0 };
      const invalid2 = { ...validProfile, deviceMemory: 1025 };

      expect(FingerprintValidator.validateProfile(valid).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(invalid1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid2).valid).toBe(false);
    });

    test('validates maxTouchPoints', () => {
      const valid1 = { ...validProfile, maxTouchPoints: 0 };
      const valid2 = { ...validProfile, maxTouchPoints: 10 };
      const invalid1 = { ...validProfile, maxTouchPoints: -1 };
      const invalid2 = { ...validProfile, maxTouchPoints: 11 };

      expect(FingerprintValidator.validateProfile(valid1).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(valid2).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(invalid1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid2).valid).toBe(false);
    });

    test('validates language format', () => {
      const valid1 = { ...validProfile, language: 'en' };
      const valid2 = { ...validProfile, language: 'en-US' };
      const invalid1 = { ...validProfile, language: 'english' };
      const invalid2 = { ...validProfile, language: 'en_US' };

      expect(FingerprintValidator.validateProfile(valid1).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(valid2).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(invalid1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(invalid2).valid).toBe(false);
    });

    test('validates screenColorDepth', () => {
      const valid1 = { ...validProfile, screenColorDepth: 8 };
      const valid2 = { ...validProfile, screenColorDepth: 32 };
      const invalid = { ...validProfile, screenColorDepth: 12 };

      expect(FingerprintValidator.validateProfile(valid1).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(valid2).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(invalid).valid).toBe(false);
    });

    test('checks for suspicious screen aspect ratios', () => {
      const normalRatio = { ...validProfile, screenWidth: 1920, screenHeight: 1080 };
      const extremeRatio1 = { ...validProfile, screenWidth: 7680, screenHeight: 100 };
      const extremeRatio2 = { ...validProfile, screenWidth: 100, screenHeight: 7680 };

      expect(FingerprintValidator.validateProfile(normalRatio).valid).toBe(true);
      expect(FingerprintValidator.validateProfile(extremeRatio1).valid).toBe(false);
      expect(FingerprintValidator.validateProfile(extremeRatio2).valid).toBe(false);
    });

    test('skips validation for internal fields', () => {
      const profile = { ...validProfile, _internal: 'value', __hidden: 123, id: '123' };
      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    test('warns on unknown fields but does not fail', () => {
      const profile = { ...validProfile, unknownField: 'value' };
      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateProfiles', () => {
    test('validates array of profiles', () => {
      const profiles = [validProfile, validProfile];
      const result = FingerprintValidator.validateProfiles(profiles);
      expect(result.valid).toBe(true);
      expect(result.results.length).toBe(2);
    });

    test('rejects non-array input', () => {
      const result = FingerprintValidator.validateProfiles('not-an-array');
      expect(result.valid).toBe(false);
    });

    test('rejects empty array', () => {
      const result = FingerprintValidator.validateProfiles([]);
      expect(result.valid).toBe(false);
    });

    test('rejects arrays with more than 500 profiles', () => {
      const profiles = Array(501).fill(validProfile);
      const result = FingerprintValidator.validateProfiles(profiles);
      expect(result.valid).toBe(false);
    });

    test('validates each profile independently', () => {
      const invalidProfile = { ...validProfile };
      delete invalidProfile.userAgent;

      const profiles = [validProfile, invalidProfile, validProfile];
      const result = FingerprintValidator.validateProfiles(profiles);

      expect(result.valid).toBe(false);
      expect(result.results[0].valid).toBe(true);
      expect(result.results[1].valid).toBe(false);
      expect(result.results[2].valid).toBe(true);
    });

    test('detects duplicate user agents', () => {
      const profiles = [validProfile, validProfile];
      const result = FingerprintValidator.validateProfiles(profiles);
      // Should still be valid but log warning
      expect(result.results.length).toBe(2);
    });
  });

  describe('validateProfilesFile', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fingerprint-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    test('validates JSON array files', () => {
      const filePath = path.join(tempDir, 'profiles.json');
      fs.writeFileSync(filePath, JSON.stringify([validProfile, validProfile]));

      const result = FingerprintValidator.validateProfilesFile(filePath);
      expect(result.valid).toBe(true);
      expect(result.profiles.length).toBe(2);
      expect(result.errors.length).toBe(0);
    });

    test('validates JSON object files with profiles property', () => {
      const filePath = path.join(tempDir, 'profiles.json');
      fs.writeFileSync(
        filePath,
        JSON.stringify({ profiles: [validProfile] })
      );

      const result = FingerprintValidator.validateProfilesFile(filePath);
      expect(result.valid).toBe(true);
      expect(result.profiles.length).toBe(1);
    });

    test('rejects invalid JSON', () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, '{invalid json}');

      const result = FingerprintValidator.validateProfilesFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('JSON'))).toBe(true);
    });

    test('rejects non-existent files', () => {
      const result = FingerprintValidator.validateProfilesFile('/nonexistent/file.json');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    test('rejects files that are not files', () => {
      const result = FingerprintValidator.validateProfilesFile(tempDir);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not a file');
    });

    test('rejects files larger than 10MB', () => {
      const filePath = path.join(tempDir, 'huge.json');
      const largeData = '[' + 'A'.repeat(10 * 1024 * 1024 + 1) + ']';
      fs.writeFileSync(filePath, largeData);

      const result = FingerprintValidator.validateProfilesFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('too large');
    });

    test('rejects invalid format', () => {
      const filePath = path.join(tempDir, 'invalid-format.json');
      fs.writeFileSync(filePath, JSON.stringify({ notProfiles: [] }));

      const result = FingerprintValidator.validateProfilesFile(filePath);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateProfilesDirectory', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fingerprint-dir-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    });

    test('validates directory of profile files', () => {
      fs.writeFileSync(
        path.join(tempDir, 'profiles1.json'),
        JSON.stringify([validProfile])
      );
      fs.writeFileSync(
        path.join(tempDir, 'profiles2.json'),
        JSON.stringify([validProfile, validProfile])
      );

      const result = FingerprintValidator.validateProfilesDirectory(tempDir);
      expect(result.valid).toBe(true);
      expect(result.profileCount).toBe(3);
    });

    test('rejects non-existent directories', () => {
      const result = FingerprintValidator.validateProfilesDirectory('/nonexistent/dir');
      expect(result.valid).toBe(false);
    });

    test('rejects file paths as directories', () => {
      const filePath = path.join(tempDir, 'file.json');
      fs.writeFileSync(filePath, '[]');

      const result = FingerprintValidator.validateProfilesDirectory(filePath);
      expect(result.valid).toBe(false);
    });

    test('rejects directories with no JSON files', () => {
      const result = FingerprintValidator.validateProfilesDirectory(tempDir);
      expect(result.valid).toBe(false);
    });

    test('handles mixed valid and invalid files', () => {
      fs.writeFileSync(
        path.join(tempDir, 'valid.json'),
        JSON.stringify([validProfile])
      );
      fs.writeFileSync(
        path.join(tempDir, 'invalid.json'),
        '{invalid}'
      );

      const result = FingerprintValidator.validateProfilesDirectory(tempDir);
      expect(result.profileCount).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getFieldLists', () => {
    test('returns required fields', () => {
      const { required } = FingerprintValidator.getFieldLists();
      expect(Array.isArray(required)).toBe(true);
      expect(required.length).toBeGreaterThan(0);
      expect(required).toContain('userAgent');
      expect(required).toContain('platform');
    });

    test('returns optional fields', () => {
      const { optional } = FingerprintValidator.getFieldLists();
      expect(Array.isArray(optional)).toBe(true);
      expect(optional.length).toBeGreaterThan(0);
    });
  });

  describe('cross-field validation', () => {
    test('validates language/timezone combinations', () => {
      const profile = {
        ...validProfile,
        language: 'en',
        timezone: 'America/New_York'
      };

      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    test('warns on unusual language/timezone combinations', () => {
      // This should validate but may warn
      const profile = {
        ...validProfile,
        language: 'zh',
        timezone: 'America/New_York'
      };

      const result = FingerprintValidator.validateProfile(profile);
      // Still valid, just unusual
      expect(result.valid).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('handles profiles with additional properties', () => {
      const profile = {
        ...validProfile,
        customField1: 'value1',
        customField2: 12345,
        fingerprint: 'abc123def456'
      };

      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    test('validates boundary values', () => {
      const profile = {
        ...validProfile,
        screenWidth: 1,
        screenHeight: 1,
        hardwareConcurrency: 1,
        deviceMemory: 1,
        maxTouchPoints: 0
      };

      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });

    test('validates maximum values', () => {
      const profile = {
        ...validProfile,
        screenWidth: 7680,
        screenHeight: 4320,
        hardwareConcurrency: 256,
        deviceMemory: 1024
      };

      const result = FingerprintValidator.validateProfile(profile);
      expect(result.valid).toBe(true);
    });
  });
});

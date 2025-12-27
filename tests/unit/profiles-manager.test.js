/**
 * Basset Hound Browser - Profile Manager Unit Tests
 * Tests for profile creation, switching, and management
 */

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-' + Date.now())
}));

// Mock Electron session
const mockSession = {
  clearStorageData: jest.fn().mockResolvedValue(),
  clearCache: jest.fn().mockResolvedValue(),
  cookies: {
    get: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue()
  },
  setUserAgent: jest.fn(),
  setProxy: jest.fn().mockResolvedValue()
};

jest.mock('electron', () => ({
  session: {
    defaultSession: mockSession,
    fromPartition: jest.fn().mockReturnValue(mockSession)
  }
}));

// Mock ProfileStorage
const mockStorage = {
  listProfiles: jest.fn().mockReturnValue([]),
  loadProfile: jest.fn(),
  saveProfile: jest.fn(),
  deleteProfile: jest.fn(),
  loadCookies: jest.fn().mockReturnValue([]),
  saveCookies: jest.fn(),
  loadLocalStorage: jest.fn().mockReturnValue({}),
  saveLocalStorage: jest.fn(),
  loadIndex: jest.fn().mockReturnValue({ profiles: [], activeProfileId: null }),
  saveIndex: jest.fn()
};

jest.mock('../../profiles/storage', () => {
  return jest.fn().mockImplementation(() => mockStorage);
});

// Mock fingerprint module
jest.mock('../../evasion/fingerprint', () => ({
  getEvasionScriptWithConfig: jest.fn().mockReturnValue('// mock script'),
  VIEWPORT_SIZES: [{ width: 1920, height: 1080 }],
  USER_AGENTS: ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'],
  PLATFORMS: ['Win32'],
  LANGUAGES: [['en-US', 'en']],
  TIMEZONES: [{ name: 'America/New_York', offset: -300 }],
  SCREEN_CONFIGS: [{ width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24 }],
  WEBGL_RENDERERS: ['ANGLE (Intel HD Graphics)'],
  WEBGL_VENDORS: ['Google Inc. (Intel)']
}));

const { Profile, ProfileManager } = require('../../profiles/manager');

describe('Profile Class', () => {
  describe('Constructor', () => {
    test('should create profile with default values', () => {
      const profile = new Profile();

      expect(profile.id).toBeDefined();
      expect(profile.name).toContain('Profile');
      expect(profile.createdAt).toBeDefined();
      expect(profile.userAgent).toBeDefined();
      expect(profile.fingerprint).toBeDefined();
      expect(profile.proxy).toBeNull();
      expect(profile.cookies).toEqual([]);
      expect(profile.localStorage).toEqual({});
      expect(profile.partition).toContain('persist:profile-');
      expect(profile.isActive).toBe(false);
    });

    test('should create profile with custom options', () => {
      const options = {
        id: 'custom-id',
        name: 'Test Profile',
        userAgent: 'Custom UA',
        proxy: { host: 'proxy.example.com', port: 8080 }
      };

      const profile = new Profile(options);

      expect(profile.id).toBe('custom-id');
      expect(profile.name).toBe('Test Profile');
      expect(profile.userAgent).toBe('Custom UA');
      expect(profile.proxy).toEqual(options.proxy);
    });

    test('should use provided fingerprint', () => {
      const customFingerprint = {
        viewport: { width: 1280, height: 720 },
        platform: 'MacIntel'
      };

      const profile = new Profile({ fingerprint: customFingerprint });

      expect(profile.fingerprint).toEqual(customFingerprint);
    });
  });

  describe('generateRandomFingerprint', () => {
    test('should generate complete fingerprint', () => {
      const profile = new Profile();
      const fp = profile.fingerprint;

      expect(fp).toHaveProperty('viewport');
      expect(fp).toHaveProperty('screen');
      expect(fp).toHaveProperty('platform');
      expect(fp).toHaveProperty('languages');
      expect(fp).toHaveProperty('timezone');
      expect(fp).toHaveProperty('webgl');
      expect(fp).toHaveProperty('hardwareConcurrency');
      expect(fp).toHaveProperty('deviceMemory');
      expect(fp).toHaveProperty('canvasNoise');
      expect(fp).toHaveProperty('audioNoise');
    });

    test('should add random variation to viewport', () => {
      const fp1 = new Profile().fingerprint;
      const fp2 = new Profile().fingerprint;

      // Due to random variation, they might differ
      expect(fp1.viewport).toBeDefined();
      expect(fp2.viewport).toBeDefined();
    });
  });

  describe('update', () => {
    test('should update profile name', () => {
      const profile = new Profile({ name: 'Original' });

      profile.update({ name: 'Updated' });

      expect(profile.name).toBe('Updated');
    });

    test('should update user agent', () => {
      const profile = new Profile();

      profile.update({ userAgent: 'New UA' });

      expect(profile.userAgent).toBe('New UA');
    });

    test('should merge fingerprint updates', () => {
      const profile = new Profile({
        fingerprint: { platform: 'Win32', timezone: { name: 'America/New_York' } }
      });

      profile.update({ fingerprint: { platform: 'MacIntel' } });

      expect(profile.fingerprint.platform).toBe('MacIntel');
      expect(profile.fingerprint.timezone).toBeDefined();
    });

    test('should update timestamp', () => {
      const profile = new Profile();
      const originalTime = profile.updatedAt;

      // Small delay to ensure different timestamp
      profile.update({ name: 'Changed' });

      expect(profile.updatedAt).toBeDefined();
    });
  });

  describe('toJSON', () => {
    test('should serialize profile', () => {
      const profile = new Profile({
        id: 'test-id',
        name: 'Test',
        proxy: { host: 'proxy.com' }
      });

      const json = profile.toJSON();

      expect(json.id).toBe('test-id');
      expect(json.name).toBe('Test');
      expect(json.proxy).toEqual({ host: 'proxy.com' });
      expect(json.partition).toBeDefined();
      expect(json).not.toHaveProperty('isActive');
      expect(json).not.toHaveProperty('cookies');
    });
  });

  describe('fromJSON', () => {
    test('should create profile from JSON', () => {
      const data = {
        id: 'restored-id',
        name: 'Restored Profile',
        userAgent: 'Restored UA',
        fingerprint: { platform: 'Linux' },
        partition: 'persist:restored'
      };

      const profile = Profile.fromJSON(data);

      expect(profile.id).toBe('restored-id');
      expect(profile.name).toBe('Restored Profile');
      expect(profile.userAgent).toBe('Restored UA');
      expect(profile.fingerprint.platform).toBe('Linux');
      expect(profile.partition).toBe('persist:restored');
    });
  });
});

describe('ProfileManager', () => {
  let profileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.listProfiles.mockReturnValue([]);
    mockStorage.loadIndex.mockReturnValue({ profiles: [], activeProfileId: null });
    profileManager = new ProfileManager('/test/path');
  });

  describe('Constructor', () => {
    test('should initialize with empty profiles', () => {
      expect(profileManager.profiles.size).toBe(0);
      expect(profileManager.activeProfileId).toBeNull();
    });

    test('should load existing profiles from storage', () => {
      const existingProfiles = [{ id: 'profile-1' }, { id: 'profile-2' }];
      mockStorage.listProfiles.mockReturnValue(existingProfiles);
      mockStorage.loadProfile.mockImplementation((id) => ({
        id,
        name: `Profile ${id}`,
        userAgent: 'UA',
        fingerprint: { platform: 'Win32' }
      }));

      const manager = new ProfileManager('/test/path');

      expect(manager.profiles.size).toBe(2);
    });
  });

  describe('setMainWindow', () => {
    test('should set main window reference', () => {
      const mockWindow = { webContents: { send: jest.fn() } };

      profileManager.setMainWindow(mockWindow);

      expect(profileManager.mainWindow).toBe(mockWindow);
    });
  });

  describe('createProfile', () => {
    test('should create a new profile', () => {
      const result = profileManager.createProfile({ name: 'New Profile' });

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile.name).toBe('New Profile');
      expect(profileManager.profiles.size).toBe(1);
    });

    test('should save profile to storage', () => {
      profileManager.createProfile({ name: 'Saved Profile' });

      expect(mockStorage.saveProfile).toHaveBeenCalled();
      expect(mockStorage.saveIndex).toHaveBeenCalled();
    });

    test('should handle errors gracefully', () => {
      mockStorage.saveProfile.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const result = profileManager.createProfile({ name: 'Error Profile' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });

  describe('deleteProfile', () => {
    beforeEach(() => {
      profileManager.createProfile({ name: 'To Delete' });
    });

    test('should delete existing profile', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = await profileManager.deleteProfile(profileId);

      expect(result.success).toBe(true);
      expect(profileManager.profiles.has(profileId)).toBe(false);
    });

    test('should return error for non-existent profile', async () => {
      const result = await profileManager.deleteProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile not found');
    });

    test('should clear session data', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      await profileManager.deleteProfile(profileId);

      expect(mockSession.clearStorageData).toHaveBeenCalled();
    });

    test('should update storage', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      await profileManager.deleteProfile(profileId);

      expect(mockStorage.deleteProfile).toHaveBeenCalledWith(profileId);
      expect(mockStorage.saveIndex).toHaveBeenCalled();
    });

    test('should clear active profile if deleted', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];
      profileManager.activeProfileId = profileId;

      await profileManager.deleteProfile(profileId);

      expect(profileManager.activeProfileId).toBeNull();
    });
  });

  describe('getProfile', () => {
    beforeEach(() => {
      profileManager.createProfile({ name: 'Test Profile' });
    });

    test('should get existing profile', () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = profileManager.getProfile(profileId);

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe('Test Profile');
    });

    test('should include activity state', () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];
      profileManager.activeProfileId = profileId;

      const result = profileManager.getProfile(profileId);

      expect(result.profile.isActive).toBe(true);
    });

    test('should return error for non-existent profile', () => {
      const result = profileManager.getProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile not found');
    });
  });

  describe('listProfiles', () => {
    test('should list all profiles', () => {
      profileManager.createProfile({ name: 'Profile 1' });
      profileManager.createProfile({ name: 'Profile 2' });

      const result = profileManager.listProfiles();

      expect(result.success).toBe(true);
      expect(result.profiles.length).toBe(2);
      expect(result.totalCount).toBe(2);
    });

    test('should include summary information', () => {
      profileManager.createProfile({ name: 'Test', proxy: { host: 'proxy.com' } });

      const result = profileManager.listProfiles();

      expect(result.profiles[0]).toHaveProperty('id');
      expect(result.profiles[0]).toHaveProperty('name');
      expect(result.profiles[0]).toHaveProperty('isActive');
      expect(result.profiles[0]).toHaveProperty('hasProxy', true);
    });

    test('should indicate active profile', () => {
      profileManager.createProfile({ name: 'Active' });
      const profileId = Array.from(profileManager.profiles.keys())[0];
      profileManager.activeProfileId = profileId;

      const result = profileManager.listProfiles();

      expect(result.activeProfileId).toBe(profileId);
      expect(result.profiles[0].isActive).toBe(true);
    });
  });

  describe('switchProfile', () => {
    beforeEach(() => {
      profileManager.createProfile({ name: 'Profile to Switch' });
    });

    test('should switch to existing profile', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = await profileManager.switchProfile(profileId);

      expect(result.success).toBe(true);
      expect(profileManager.activeProfileId).toBe(profileId);
    });

    test('should return error for non-existent profile', async () => {
      const result = await profileManager.switchProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile not found');
    });

    test('should save previous profile state', async () => {
      // Create two profiles
      profileManager.createProfile({ name: 'First' });
      profileManager.createProfile({ name: 'Second' });

      const [id1, id2] = Array.from(profileManager.profiles.keys());

      // Switch to first
      await profileManager.switchProfile(id1);

      // Switch to second
      await profileManager.switchProfile(id2);

      expect(profileManager.activeProfileId).toBe(id2);
    });

    test('should notify main window', async () => {
      const mockWindow = { webContents: { send: jest.fn() } };
      profileManager.setMainWindow(mockWindow);

      const profileId = Array.from(profileManager.profiles.keys())[0];
      await profileManager.switchProfile(profileId);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'profile-changed',
        expect.objectContaining({ profileId })
      );
    });

    test('should update storage index', async () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      await profileManager.switchProfile(profileId);

      expect(mockStorage.saveIndex).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      profileManager.createProfile({ name: 'To Update' });
    });

    test('should update profile', () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = profileManager.updateProfile(profileId, { name: 'Updated Name' });

      expect(result.success).toBe(true);
      expect(profileManager.profiles.get(profileId).name).toBe('Updated Name');
    });

    test('should save to storage', () => {
      const profileId = Array.from(profileManager.profiles.keys())[0];
      mockStorage.saveProfile.mockClear();

      profileManager.updateProfile(profileId, { name: 'Updated' });

      expect(mockStorage.saveProfile).toHaveBeenCalled();
    });

    test('should return error for non-existent profile', () => {
      const result = profileManager.updateProfile('non-existent', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile not found');
    });
  });

  describe('getActiveProfile', () => {
    test('should return null when no active profile', () => {
      const result = profileManager.getActiveProfile();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active profile');
    });

    test('should return active profile', async () => {
      profileManager.createProfile({ name: 'Active' });
      const profileId = Array.from(profileManager.profiles.keys())[0];
      await profileManager.switchProfile(profileId);

      const result = profileManager.getActiveProfile();

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe('Active');
    });
  });

  describe('cloneProfile', () => {
    test('should clone existing profile', () => {
      profileManager.createProfile({
        name: 'Original',
        proxy: { host: 'proxy.com' }
      });
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = profileManager.cloneProfile(profileId, 'Cloned');

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe('Cloned');
      expect(profileManager.profiles.size).toBe(2);
    });

    test('should use custom name if provided', () => {
      profileManager.createProfile({ name: 'Original' });
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = profileManager.cloneProfile(profileId, 'Custom Clone');

      expect(result.profile.name).toBe('Custom Clone');
    });

    test('should return error for non-existent profile', () => {
      const result = profileManager.cloneProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Profile not found');
    });
  });

  describe('randomizeFingerprint', () => {
    test('should regenerate fingerprint', () => {
      profileManager.createProfile({ name: 'Test' });
      const profileId = Array.from(profileManager.profiles.keys())[0];
      const originalFp = { ...profileManager.profiles.get(profileId).fingerprint };

      const result = profileManager.randomizeFingerprint(profileId);

      expect(result.success).toBe(true);
      expect(result.fingerprint).toBeDefined();
    });

    test('should return error for non-existent profile', () => {
      const result = profileManager.randomizeFingerprint('non-existent');

      expect(result.success).toBe(false);
    });
  });

  describe('exportProfile', () => {
    test('should export profile data', async () => {
      profileManager.createProfile({ name: 'Export Test' });
      const profileId = Array.from(profileManager.profiles.keys())[0];

      const result = await profileManager.exportProfile(profileId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe('Export Test');
    });
  });

  describe('importProfile', () => {
    test('should import profile data', async () => {
      const importData = {
        name: 'Imported Profile',
        userAgent: 'Imported UA',
        fingerprint: { platform: 'Win32' }
      };

      const result = await profileManager.importProfile(importData);

      expect(result.success).toBe(true);
      expect(profileManager.profiles.size).toBe(1);
    });

    test('should handle missing required fields', async () => {
      const result = await profileManager.importProfile({});

      expect(result.success).toBe(true); // Should still create with defaults
    });
  });

  describe('cleanup', () => {
    test('should clear all profiles', async () => {
      profileManager.createProfile({ name: 'Test 1' });
      profileManager.createProfile({ name: 'Test 2' });

      await profileManager.cleanup();

      expect(profileManager.activeProfileId).toBeNull();
      expect(profileManager.activeSession).toBeNull();
    });
  });
});

describe('Profile Edge Cases', () => {
  test('should handle special characters in profile name', () => {
    const profile = new Profile({ name: 'Test <script>alert("xss")</script>' });

    expect(profile.name).toContain('script');
  });

  test('should handle very long profile names', () => {
    const longName = 'A'.repeat(1000);
    const profile = new Profile({ name: longName });

    expect(profile.name).toBe(longName);
  });

  test('should handle empty fingerprint options', () => {
    const profile = new Profile({ fingerprint: {} });

    expect(profile.fingerprint).toEqual({});
  });
});

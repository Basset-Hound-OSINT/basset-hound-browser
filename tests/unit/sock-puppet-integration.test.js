/**
 * Sock Puppet Integration Tests
 *
 * Phase 16: Unit tests for sock puppet profile integration
 */

const {
  SockPuppetIntegration,
  SOCK_PUPPET_FIELDS,
  ACTIVITY_TYPES,
  DEFAULT_CONFIG,
} = require('../../profiles/sock-puppet-integration');

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock profile manager
const createMockProfileManager = () => ({
  profiles: new Map(),
  activeProfileId: null,

  async getProfile(profileId) {
    return this.profiles.get(profileId) || null;
  },

  async createProfile(config) {
    const profile = {
      id: `profile_${Date.now()}`,
      name: config.name || 'Test Profile',
      createdAt: new Date().toISOString(),
      fingerprint: config.fingerprint || {},
      proxy: config.proxy || null,
      userAgent: config.userAgent || 'Mozilla/5.0 Test',
      metadata: config.metadata || {},
    };
    this.profiles.set(profile.id, profile);
    return profile;
  },

  async updateProfile(profileId, updates) {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error('Profile not found');

    const updated = { ...profile, ...updates };
    if (updates.metadata) {
      updated.metadata = { ...profile.metadata, ...updates.metadata };
    }
    this.profiles.set(profileId, updated);
    return updated;
  },

  getActiveProfileId() {
    return this.activeProfileId;
  },

  setActiveProfile(profileId) {
    this.activeProfileId = profileId;
  },
});

// Mock sock puppet data
const mockSockPuppet = {
  id: 'sp_test_123',
  type: 'SOCK_PUPPET',
  name: 'John Doe Test',
  fingerprint_config: {
    platform: 'Win64',
    languages: ['en-US'],
    timezone: 'America/New_York',
    webgl: {
      vendor: 'Intel Inc.',
      renderer: 'Intel Iris Graphics',
    },
    hardwareConcurrency: 8,
    deviceMemory: 16,
  },
  proxy_config: {
    type: 'http',
    host: 'proxy.test.com',
    port: 8080,
  },
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const mockCredentials = {
  username: 'johndoe2024',
  email: 'john.doe@test.com',
  password: 'encrypted_password_123',
  phone: '+1-555-123-4567',
  first_name: 'John',
  last_name: 'Doe',
};

describe('SockPuppetIntegration', () => {
  let integration;
  let profileManager;

  beforeEach(() => {
    jest.clearAllMocks();
    profileManager = createMockProfileManager();
    integration = new SockPuppetIntegration(profileManager, {
      bassetHoundUrl: 'http://localhost:3000',
      timeout: 5000,
      retryAttempts: 1,
    });
  });

  afterEach(() => {
    integration.removeAllListeners();
  });

  describe('Constants', () => {
    test('should export SOCK_PUPPET_FIELDS', () => {
      expect(SOCK_PUPPET_FIELDS).toBeDefined();
      expect(SOCK_PUPPET_FIELDS.USERNAME).toBe('username');
      expect(SOCK_PUPPET_FIELDS.EMAIL).toBe('email');
      expect(SOCK_PUPPET_FIELDS.PASSWORD).toBe('password');
      expect(SOCK_PUPPET_FIELDS.PHONE).toBe('phone');
    });

    test('should export ACTIVITY_TYPES', () => {
      expect(ACTIVITY_TYPES).toBeDefined();
      expect(ACTIVITY_TYPES.LOGIN).toBe('login');
      expect(ACTIVITY_TYPES.PAGE_VISIT).toBe('page_visit');
      expect(ACTIVITY_TYPES.FORM_FILL).toBe('form_fill');
      expect(ACTIVITY_TYPES.SESSION_START).toBe('session_start');
      expect(ACTIVITY_TYPES.SESSION_END).toBe('session_end');
    });

    test('should export DEFAULT_CONFIG', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.apiVersion).toBe('v1');
      expect(DEFAULT_CONFIG.timeout).toBe(10000);
    });
  });

  describe('API URL construction', () => {
    test('should construct correct API base URL', () => {
      expect(integration.apiBaseUrl).toBe('http://localhost:3000/api/v1');
    });

    test('should use custom URL from config', () => {
      const customIntegration = new SockPuppetIntegration(profileManager, {
        bassetHoundUrl: 'https://api.example.com',
      });
      expect(customIntegration.apiBaseUrl).toBe('https://api.example.com/api/v1');
    });
  });

  describe('fetchSockPuppet', () => {
    test('should fetch sock puppet from API', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const result = await integration.fetchSockPuppet('sp_test_123');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/entities/sp_test_123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockSockPuppet);
    });

    test('should cache fetched sock puppets', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      // First call
      await integration.fetchSockPuppet('sp_test_123');
      // Second call (should use cache)
      await integration.fetchSockPuppet('sp_test_123');

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    test('should bypass cache with forceRefresh', async () => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.fetchSockPuppet('sp_test_123');
      await integration.fetchSockPuppet('sp_test_123', true);

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should throw error for non-SOCK_PUPPET entity', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSockPuppet, type: 'PERSON' }),
      });

      await expect(integration.fetchSockPuppet('sp_test_123')).rejects.toThrow(
        'Entity sp_test_123 is not a SOCK_PUPPET'
      );
    });

    test('should emit puppetFetched event on success', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const eventHandler = jest.fn();
      integration.on('puppetFetched', eventHandler);

      await integration.fetchSockPuppet('sp_test_123');

      expect(eventHandler).toHaveBeenCalledWith({
        sockPuppetId: 'sp_test_123',
        data: mockSockPuppet,
      });
    });

    test('should emit error event on failure', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const errorHandler = jest.fn();
      integration.on('error', errorHandler);

      await expect(integration.fetchSockPuppet('sp_test_123')).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('listSockPuppets', () => {
    test('should list sock puppets with default options', async () => {
      const mockList = [mockSockPuppet];
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: mockList }),
      });

      const result = await integration.listSockPuppets();

      expect(result).toEqual(mockList);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=SOCK_PUPPET'),
        expect.any(Object)
      );
    });

    test('should pass search parameter', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entities: [] }),
      });

      await integration.listSockPuppets({ search: 'john' });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=john'),
        expect.any(Object)
      );
    });
  });

  describe('linkProfileToSockPuppet', () => {
    test('should link profile to sock puppet', async () => {
      // Create a profile first
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const result = await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      expect(result.success).toBe(true);
      expect(result.profileId).toBe(profile.id);
      expect(result.sockPuppetId).toBe('sp_test_123');

      // Check mapping
      expect(integration.getSockPuppetIdForProfile(profile.id)).toBe('sp_test_123');
    });

    test('should update profile metadata with sock puppet reference', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      const updatedProfile = await profileManager.getProfile(profile.id);
      expect(updatedProfile.metadata.sockPuppetId).toBe('sp_test_123');
      expect(updatedProfile.metadata.sockPuppetName).toBe('John Doe Test');
    });

    test('should throw error for non-existent profile', async () => {
      await expect(
        integration.linkProfileToSockPuppet('nonexistent', 'sp_test_123')
      ).rejects.toThrow('Profile nonexistent not found');
    });

    test('should emit profileLinked event', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const eventHandler = jest.fn();
      integration.on('profileLinked', eventHandler);

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: profile.id,
          sockPuppetId: 'sp_test_123',
        })
      );
    });
  });

  describe('unlinkProfile', () => {
    test('should unlink profile from sock puppet', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');
      const result = await integration.unlinkProfile(profile.id);

      expect(result.success).toBe(true);
      expect(result.previousSockPuppetId).toBe('sp_test_123');
      expect(integration.getSockPuppetIdForProfile(profile.id)).toBeNull();
    });

    test('should emit profileUnlinked event', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const eventHandler = jest.fn();
      integration.on('profileUnlinked', eventHandler);

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');
      await integration.unlinkProfile(profile.id);

      expect(eventHandler).toHaveBeenCalledWith({
        profileId: profile.id,
        sockPuppetId: 'sp_test_123',
      });
    });
  });

  describe('createProfileFromSockPuppet', () => {
    test('should create profile from sock puppet', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const result = await integration.createProfileFromSockPuppet('sp_test_123');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.sockPuppetId).toBe('sp_test_123');
      expect(result.sockPuppetName).toBe('John Doe Test');

      // Check profile was created with correct config
      const profile = await profileManager.getProfile(result.profile.id);
      expect(profile.metadata.sockPuppetId).toBe('sp_test_123');
      expect(profile.metadata.createdFromSockPuppet).toBe(true);
    });

    test('should apply fingerprint config from sock puppet', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const result = await integration.createProfileFromSockPuppet('sp_test_123');
      const profile = await profileManager.getProfile(result.profile.id);

      expect(profile.fingerprint).toEqual(mockSockPuppet.fingerprint_config);
    });

    test('should apply proxy config from sock puppet', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      const result = await integration.createProfileFromSockPuppet('sp_test_123');
      const profile = await profileManager.getProfile(result.profile.id);

      expect(profile.proxy).toEqual(mockSockPuppet.proxy_config);
    });
  });

  describe('getCredentials', () => {
    test('should fetch credentials from API', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCredentials,
      });

      const result = await integration.getCredentials('sp_test_123');

      expect(result).toEqual(mockCredentials);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/entities/sp_test_123/credentials',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    test('should request specific fields when provided', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ email: mockCredentials.email }),
      });

      await integration.getCredentials('sp_test_123', ['email']);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ fields: ['email'] }),
        })
      );
    });
  });

  describe('Session management', () => {
    test('should start session', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      const session = await integration.startSession(profile.id, { purpose: 'test' });

      expect(session.id).toBeDefined();
      expect(session.profileId).toBe(profile.id);
      expect(session.sockPuppetId).toBe('sp_test_123');
      expect(session.startedAt).toBeDefined();
      expect(session.metadata.purpose).toBe('test');
    });

    test('should end session and return summary', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      // For activity sync
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');
      await integration.startSession(profile.id);

      const result = await integration.endSession(profile.id);

      expect(result.success).toBe(true);
      expect(result.session.endedAt).toBeDefined();
      expect(result.session.duration).toBeGreaterThanOrEqual(0);
    });

    test('should emit session events', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      const startHandler = jest.fn();
      const endHandler = jest.fn();
      integration.on('sessionStarted', startHandler);
      integration.on('sessionEnded', endHandler);

      await integration.startSession(profile.id);
      await integration.endSession(profile.id);

      expect(startHandler).toHaveBeenCalled();
      expect(endHandler).toHaveBeenCalled();
    });
  });

  describe('Activity logging', () => {
    test('should log activity', async () => {
      const activity = await integration.logActivity(
        'sp_test_123',
        ACTIVITY_TYPES.PAGE_VISIT,
        { url: 'https://example.com' }
      );

      expect(activity.id).toBeDefined();
      expect(activity.sockPuppetId).toBe('sp_test_123');
      expect(activity.type).toBe('page_visit');
      expect(activity.details.url).toBe('https://example.com');
      expect(activity.timestamp).toBeDefined();
    });

    test('should retrieve activity log', async () => {
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, { url: 'https://example1.com' });
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, { url: 'https://example2.com' });
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.LOGIN, { success: true });

      const log = integration.getActivityLog('sp_test_123');

      expect(log).toHaveLength(3);
    });

    test('should filter activity log by type', async () => {
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, { url: 'https://example.com' });
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.LOGIN, { success: true });
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, { url: 'https://example2.com' });

      const log = integration.getActivityLog('sp_test_123', { type: ACTIVITY_TYPES.PAGE_VISIT });

      expect(log).toHaveLength(2);
      expect(log.every((a) => a.type === 'page_visit')).toBe(true);
    });

    test('should emit activityLogged event', async () => {
      const eventHandler = jest.fn();
      integration.on('activityLogged', eventHandler);

      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, {});

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('recordPageVisit', () => {
    test('should record page visit for linked profile', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');
      await integration.recordPageVisit(profile.id, 'https://example.com', 'Example Page');

      const log = integration.getActivityLog('sp_test_123');
      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('page_visit');
      expect(log[0].details.url).toBe('https://example.com');
      expect(log[0].details.title).toBe('Example Page');
    });

    test('should do nothing for unlinked profile', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      await integration.recordPageVisit(profile.id, 'https://example.com', 'Example Page');

      // No activities should be logged
      const log = integration.getActivityLog('sp_test_123');
      expect(log).toHaveLength(0);
    });
  });

  describe('validateFingerprintConsistency', () => {
    test('should detect platform vs user-agent mismatch', async () => {
      const profile = await profileManager.createProfile({
        name: 'Test Profile',
        fingerprint: { platform: 'Win64' },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      const result = await integration.validateFingerprintConsistency('sp_test_123');

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('Win64');
    });

    test('should pass for consistent fingerprint', async () => {
      const profile = await profileManager.createProfile({
        name: 'Test Profile',
        fingerprint: { platform: 'Win64' },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');

      const result = await integration.validateFingerprintConsistency('sp_test_123');

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    test('should return integration statistics', async () => {
      const profile = await profileManager.createProfile({ name: 'Test Profile' });

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.linkProfileToSockPuppet(profile.id, 'sp_test_123');
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.PAGE_VISIT, {});
      await integration.logActivity('sp_test_123', ACTIVITY_TYPES.LOGIN, {});

      const stats = integration.getStats();

      expect(stats.linkedProfiles).toBe(1);
      expect(stats.cachedPuppets).toBe(1);
      expect(stats.totalActivitiesLogged).toBe(2);
      expect(stats.activityBreakdown.page_visit).toBe(1);
      expect(stats.activityBreakdown.login).toBe(1);
    });
  });

  describe('cleanupCache', () => {
    test('should remove stale cache entries', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSockPuppet,
      });

      await integration.fetchSockPuppet('sp_test_123');
      expect(integration.puppetCache.size).toBe(1);

      // Manually expire cache
      const cached = integration.puppetCache.get('sp_test_123');
      cached.timestamp = Date.now() - integration.cacheTimeout - 1000;

      integration.cleanupCache();

      expect(integration.puppetCache.size).toBe(0);
    });
  });
});

describe('Sock Puppet WebSocket Commands', () => {
  // These tests verify the command registration interface
  const { registerSockPuppetCommands, SOCK_PUPPET_FIELDS, ACTIVITY_TYPES } = require('../../websocket/commands/sock-puppet-commands');

  test('should export required functions and constants', () => {
    expect(registerSockPuppetCommands).toBeDefined();
    expect(typeof registerSockPuppetCommands).toBe('function');
    expect(SOCK_PUPPET_FIELDS).toBeDefined();
    expect(ACTIVITY_TYPES).toBeDefined();
  });

  test('should register all sock puppet commands', () => {
    const commandHandlers = {};
    const mockProfileManager = createMockProfileManager();
    const mockExecuteInRenderer = jest.fn();

    registerSockPuppetCommands(commandHandlers, mockProfileManager, mockExecuteInRenderer);

    // Verify all commands are registered
    expect(commandHandlers.list_sock_puppets).toBeDefined();
    expect(commandHandlers.get_sock_puppet).toBeDefined();
    expect(commandHandlers.link_profile_to_sock_puppet).toBeDefined();
    expect(commandHandlers.unlink_profile_from_sock_puppet).toBeDefined();
    expect(commandHandlers.create_profile_from_sock_puppet).toBeDefined();
    expect(commandHandlers.get_linked_sock_puppet).toBeDefined();
    expect(commandHandlers.get_sock_puppet_credentials).toBeDefined();
    expect(commandHandlers.fill_form_with_sock_puppet).toBeDefined();
    expect(commandHandlers.start_sock_puppet_session).toBeDefined();
    expect(commandHandlers.end_sock_puppet_session).toBeDefined();
    expect(commandHandlers.log_sock_puppet_activity).toBeDefined();
    expect(commandHandlers.get_sock_puppet_activity_log).toBeDefined();
    expect(commandHandlers.sync_fingerprint_from_sock_puppet).toBeDefined();
    expect(commandHandlers.validate_sock_puppet_fingerprint).toBeDefined();
    expect(commandHandlers.get_sock_puppet_stats).toBeDefined();
    expect(commandHandlers.get_sock_puppet_credential_fields).toBeDefined();
    expect(commandHandlers.get_sock_puppet_activity_types).toBeDefined();
  });

  test('should return credential fields', async () => {
    const commandHandlers = {};
    const mockProfileManager = createMockProfileManager();

    registerSockPuppetCommands(commandHandlers, mockProfileManager, jest.fn());

    const result = await commandHandlers.get_sock_puppet_credential_fields({});

    expect(result.success).toBe(true);
    expect(result.fields).toEqual(SOCK_PUPPET_FIELDS);
  });

  test('should return activity types', async () => {
    const commandHandlers = {};
    const mockProfileManager = createMockProfileManager();

    registerSockPuppetCommands(commandHandlers, mockProfileManager, jest.fn());

    const result = await commandHandlers.get_sock_puppet_activity_types({});

    expect(result.success).toBe(true);
    expect(result.activityTypes).toEqual(ACTIVITY_TYPES);
  });
});

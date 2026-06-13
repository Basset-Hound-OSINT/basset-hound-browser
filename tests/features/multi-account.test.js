/**
 * Tests for Multi-Account Orchestration Feature (Wave 16 Phase 6)
 * Tests profile management, account switching, isolation, and session independence.
 */

const {
  MultiAccountOrchestratorManager,
  BrowserProfile,
  AccountManager,
  SessionStateManager
} = require('../../src/features/multi-account');

describe('Multi-Account Orchestration - Wave 16 Phase 6', () => {
  let manager;
  const userId1 = 'user-001';
  const userId2 = 'user-002';

  beforeEach(() => {
    manager = new MultiAccountOrchestratorManager({
      maxProfiles: 50,
      isolationMode: 'strict'
    });
  });

  // ==========================================
  // PROFILE CREATION & MANAGEMENT
  // ==========================================

  describe('Profile Creation', () => {
    test('should create a new profile', () => {
      const result = manager.createProfile({
        name: 'Test Profile',
        description: 'For testing'
      });

      expect(result.success).toBe(true);
      expect(result.profileId).toBeDefined();
      expect(result.profile.name).toBe('Test Profile');
    });

    test('should enforce max profile limit', () => {
      const smallManager = new MultiAccountOrchestratorManager({ maxProfiles: 2 });

      smallManager.createProfile({ name: 'Profile 1' });
      smallManager.createProfile({ name: 'Profile 2' });

      const result = smallManager.createProfile({ name: 'Profile 3' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('max-profiles-reached');
    });

    test('should generate unique profile IDs', () => {
      const result1 = manager.createProfile({ name: 'Profile 1' });
      const result2 = manager.createProfile({ name: 'Profile 2' });

      expect(result1.profileId).not.toBe(result2.profileId);
    });

    test('should create profile from template', () => {
      const result = manager.createProfileFromTemplate('mobile', {
        name: 'My Mobile Profile'
      });

      expect(result.success).toBe(true);
      expect(result.profile.name).toBe('My Mobile Profile');
    });

    test('should reject invalid template', () => {
      const result = manager.createProfileFromTemplate('invalid-template');

      expect(result.success).toBe(false);
      expect(result.error).toBe('template-not-found');
    });

    test('should create profile with correct template properties', () => {
      const result = manager.createProfileFromTemplate('mobile');

      expect(result.profile).toBeDefined();
      // Mobile template should have mobile viewport
      expect(result.profile.name).toContain('Mobile');
    });
  });

  // ==========================================
  // PROFILE OPERATIONS
  // ==========================================

  describe('Profile Operations', () => {
    let profileId;

    beforeEach(() => {
      const result = manager.createProfile({ name: 'Test Profile' });
      profileId = result.profileId;
    });

    test('should retrieve profile details', () => {
      const result = manager.getProfile(profileId);

      expect(result.success).toBe(true);
      expect(result.profile.profileId).toBe(profileId);
      expect(result.profile.name).toBe('Test Profile');
    });

    test('should list all profiles', () => {
      manager.createProfile({ name: 'Profile 2' });
      manager.createProfile({ name: 'Profile 3', tags: ['test'] });

      const result = manager.listProfiles();

      expect(result.success).toBe(true);
      expect(result.total).toBe(3);
      expect(result.profiles.length).toBe(3);
    });

    test('should filter profiles by tag', () => {
      manager.createProfile({ name: 'Profile 2' });
      manager.createProfile({ name: 'Profile 3', tags: ['test'] });

      const result = manager.listProfiles({ tag: 'test' });

      expect(result.total).toBe(1);
      expect(result.profiles[0].tags).toContain('test');
    });

    test('should delete profile', () => {
      const result = manager.deleteProfile(profileId);

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(true);

      const getResult = manager.getProfile(profileId);
      expect(getResult.success).toBe(false);
    });
  });

  // ==========================================
  // PROFILE SWITCHING
  // ==========================================

  describe('Profile Switching', () => {
    let profile1, profile2;

    beforeEach(() => {
      const result1 = manager.createProfile({ name: 'Profile 1' });
      const result2 = manager.createProfile({ name: 'Profile 2' });

      profile1 = result1.profileId;
      profile2 = result2.profileId;
    });

    test('should switch to profile', () => {
      const result = manager.switchToProfile(profile1, userId1);

      expect(result.success).toBe(true);
      expect(result.switched).toBe(true);
      expect(result.userAgent).toBeDefined();
      expect(result.viewport).toBeDefined();
    });

    test('should enforce strict isolation when switching', () => {
      manager.switchToProfile(profile1);
      const prof1 = manager.profiles.get(profile1);

      manager.switchToProfile(profile2);
      const prof2 = manager.profiles.get(profile2);

      // In strict mode, only one should be active
      expect(prof2.active).toBe(true);
      expect(prof1.active).toBe(false);
    });

    test('should reject switch to non-existent profile', () => {
      const result = manager.switchToProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('profile-not-found');
    });

    test('should update last used timestamp', () => {
      manager.switchToProfile(profile1);

      const profile = manager.profiles.get(profile1);
      expect(profile.lastUsedAt).toBeDefined();
      expect(profile.lastUsedAt).toBeGreaterThan(0);
    });

    test('should emit profile switched event', (done) => {
      manager.on('profile:switched', ({ profileId, userId }) => {
        expect(profileId).toBe(profile1);
        expect(userId).toBe(userId1);
        done();
      });

      manager.switchToProfile(profile1, userId1);
    });
  });

  // ==========================================
  // ACCOUNT MANAGEMENT
  // ==========================================

  describe('Account Management', () => {
    let profileId;

    beforeEach(() => {
      const result = manager.createProfile({ name: 'Test Profile' });
      profileId = result.profileId;
    });

    test('should store account in profile', () => {
      const result = manager.storeAccountInProfile(
        profileId,
        'example.com',
        'testuser',
        {
          password: 'secret123'
        }
      );

      expect(result.success).toBe(true);
      expect(result.accountId).toBeDefined();
      expect(result.domain).toBe('example.com');
      expect(result.username).toBe('testuser');
    });

    test('should retrieve stored account', () => {
      manager.storeAccountInProfile(profileId, 'example.com', 'testuser', {
        password: 'secret123'
      });

      const profile = manager.profiles.get(profileId);
      const account = profile.getAccount('example.com', 'testuser');

      expect(account).toBeDefined();
      expect(account.username).toBe('testuser');
      expect(account.credentials.password).toBe('secret123');
    });

    test('should store multiple accounts per profile', () => {
      manager.storeAccountInProfile(profileId, 'site1.com', 'user1', {
        password: 'pass1'
      });

      manager.storeAccountInProfile(profileId, 'site2.com', 'user2', {
        password: 'pass2'
      });

      const profile = manager.profiles.get(profileId);
      expect(profile.accounts.size).toBe(2);
    });

    test('should handle different credential types', () => {
      manager.storeAccountInProfile(profileId, 'site.com', 'user', {
        token: 'auth-token-123',
        apiKey: 'api-key-456'
      });

      const profile = manager.profiles.get(profileId);
      const account = profile.getAccount('site.com', 'user');

      expect(account.credentials.token).toBe('auth-token-123');
      expect(account.credentials.apiKey).toBe('api-key-456');
    });
  });

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  describe('Session Management', () => {
    let profileId, sessionId;

    beforeEach(() => {
      const profileResult = manager.createProfile({ name: 'Test' });
      profileId = profileResult.profileId;
    });

    test('should create session for profile', () => {
      const result = manager.createSessionForProfile(
        profileId,
        'example.com',
        null
      );

      expect(result.success).toBe(true);
      expect(result.sessionId).toBeDefined();
      expect(result.profileId).toBe(profileId);
      sessionId = result.sessionId;
    });

    test('should track session state', () => {
      const sessionResult = manager.createSessionForProfile(
        profileId,
        'example.com'
      );

      sessionId = sessionResult.sessionId;

      const stateManager = manager.sessionStateManager;
      const stateResult = stateManager.getSessionState(sessionId);

      expect(stateResult.success).toBe(true);
      expect(stateResult.state.profileId).toBe(profileId);
    });

    test('should emit session created event', (done) => {
      manager.on('session:created', ({ sessionId, profileId }) => {
        expect(sessionId).toBeDefined();
        expect(profileId).toBe(profileId);
        done();
      });

      manager.createSessionForProfile(profileId, 'example.com');
    });

    test('should record page visits in session', () => {
      const sessionResult = manager.createSessionForProfile(profileId, 'example.com');
      sessionId = sessionResult.sessionId;

      const stateManager = manager.sessionStateManager;
      stateManager.recordPageVisit(sessionId, 'https://example.com/page1', 'Page 1');
      stateManager.recordPageVisit(sessionId, 'https://example.com/page2', 'Page 2');

      const state = stateManager.getSessionState(sessionId);
      expect(state.state.pageHistory.length).toBe(2);
    });

    test('should end session', () => {
      const sessionResult = manager.createSessionForProfile(profileId, 'example.com');
      sessionId = sessionResult.sessionId;

      const stateManager = manager.sessionStateManager;
      const endResult = stateManager.endSession(sessionId);

      expect(endResult.success).toBe(true);
      expect(endResult.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================
  // PROFILE ISOLATION
  // ==========================================

  describe('Profile Isolation', () => {
    let profile1Id, profile2Id;

    beforeEach(() => {
      const result1 = manager.createProfile({ name: 'Profile 1' });
      const result2 = manager.createProfile({ name: 'Profile 2' });

      profile1Id = result1.profileId;
      profile2Id = result2.profileId;
    });

    test('should check profile isolation', () => {
      const result = manager.checkIsolation(profile1Id, profile2Id);

      expect(result.success).toBe(true);
      expect(result.isolation).toBeDefined();
      expect(result.isolation.isolated).toBe(true);
    });

    test('should prevent cookie bleed between profiles', () => {
      const profile1 = manager.profiles.get(profile1Id);
      const profile2 = manager.profiles.get(profile2Id);

      profile1.setCookie('session', 'abc123', 'example.com');
      profile2.setCookie('session', 'def456', 'example.com');

      const cookies1 = profile1.getCookies('example.com');
      const cookies2 = profile2.getCookies('example.com');

      expect(cookies1[0].value).toBe('abc123');
      expect(cookies2[0].value).toBe('def456');
    });

    test('should provide different fingerprints per profile', () => {
      const profile1 = manager.profiles.get(profile1Id);
      const profile2 = manager.profiles.get(profile2Id);

      const fp1 = JSON.stringify(profile1.fingerprint);
      const fp2 = JSON.stringify(profile2.fingerprint);

      expect(fp1).not.toBe(fp2);
    });
  });

  // ==========================================
  // BROWSER PROFILE
  // ==========================================

  describe('Browser Profile', () => {
    let profile;

    beforeEach(() => {
      profile = new BrowserProfile('test-profile', {
        name: 'Test Profile',
        userAgent: 'Mozilla/5.0 Custom'
      });
    });

    test('should generate realistic user agent', () => {
      expect(profile.userAgent).toBeDefined();
      expect(profile.userAgent).toMatch(/Mozilla/);
    });

    test('should generate unique fingerprint', () => {
      expect(profile.fingerprint).toBeDefined();
      expect(profile.fingerprint.canvas).toBeDefined();
      expect(profile.fingerprint.webgl).toBeDefined();
    });

    test('should store and retrieve cookies', () => {
      profile.setCookie('session', 'abc123', 'example.com');
      profile.setCookie('user', 'john', 'example.com');

      const cookies = profile.getCookies('example.com');

      expect(cookies.length).toBe(2);
      expect(cookies.some(c => c.name === 'session')).toBe(true);
      expect(cookies.some(c => c.name === 'user')).toBe(true);
    });

    test('should store and retrieve local storage', () => {
      profile.localStorage.set('theme', 'dark');
      profile.localStorage.set('lang', 'en');

      expect(profile.localStorage.get('theme')).toBe('dark');
      expect(profile.localStorage.size).toBe(2);
    });

    test('should clear all data', () => {
      profile.setCookie('session', 'abc', 'example.com');
      profile.localStorage.set('theme', 'dark');
      profile.storeAccount('example.com', 'user', { password: 'pass' });

      const clearResult = profile.clearAllData();

      expect(clearResult.success).toBe(true);
      expect(profile.cookies.size).toBe(0);
      expect(profile.localStorage.size).toBe(0);
      expect(profile.accounts.size).toBe(0);
    });

    test('should get profile snapshot', () => {
      profile.setCookie('session', 'abc', 'example.com');
      profile.storeAccount('example.com', 'testuser', { password: 'secret' });

      const snapshot = profile.getSnapshot();

      expect(snapshot.profileId).toBe('test-profile');
      expect(snapshot.name).toBe('Test Profile');
      expect(snapshot.cookieCount).toBe(1);
      expect(snapshot.userAgent).toBe('Mozilla/5.0 Custom');
    });
  });

  // ==========================================
  // ACCOUNT MANAGER
  // ==========================================

  describe('Account Manager', () => {
    let accountManager;

    beforeEach(() => {
      accountManager = new AccountManager();
    });

    test('should register account', () => {
      const result = accountManager.registerAccount(
        'account-001',
        'example.com',
        'testuser',
        'user'
      );

      expect(result.success).toBe(true);
      expect(result.accountId).toBe('account-001');
    });

    test('should prevent duplicate registration', () => {
      accountManager.registerAccount('account-001', 'example.com', 'testuser');

      const result = accountManager.registerAccount('account-001', 'example.com', 'testuser');

      expect(result.success).toBe(false);
      expect(result.error).toBe('account-already-registered');
    });

    test('should link accounts to profiles', () => {
      accountManager.registerAccount('account-001', 'example.com', 'testuser');

      const linkResult = accountManager.linkAccountToProfile('account-001', 'profile-1');
      expect(linkResult.success).toBe(true);

      const profilesResult = accountManager.getProfilesForAccount('account-001');
      expect(profilesResult.profiles).toContain('profile-1');
    });

    test('should record account access', () => {
      accountManager.registerAccount('account-001', 'example.com', 'testuser');

      accountManager.recordAccess('account-001');
      accountManager.recordAccess('account-001');

      const account = accountManager.accounts.get('account-001');
      expect(account.accessCount).toBe(2);
      expect(account.lastAccessed).toBeDefined();
    });
  });

  // ==========================================
  // ORCHESTRATION STATISTICS
  // ==========================================

  describe('Orchestration Statistics', () => {
    test('should report orchestration statistics', () => {
      manager.createProfile({ name: 'Profile 1' });
      manager.createProfile({ name: 'Profile 2' });

      const stats = manager.getStats();

      expect(stats.totalProfiles).toBe(2);
      expect(stats.activeProfiles).toBe(0);
      expect(stats.totalAccounts).toBe(0);
      expect(stats.isolationMode).toBe('strict');
    });

    test('should track active profiles in stats', () => {
      const result = manager.createProfile({ name: 'Profile' });
      manager.switchToProfile(result.profileId);

      const stats = manager.getStats();

      expect(stats.activeProfiles).toBe(1);
    });
  });

  // ==========================================
  // ISOLATION MODES
  // ==========================================

  describe('Isolation Modes', () => {
    test('should support strict isolation mode', () => {
      const strictManager = new MultiAccountOrchestratorManager({
        isolationMode: 'strict'
      });

      const result1 = strictManager.createProfile({ name: 'Profile 1' });
      const result2 = strictManager.createProfile({ name: 'Profile 2' });

      strictManager.switchToProfile(result1.profileId);
      strictManager.switchToProfile(result2.profileId);

      const prof1 = strictManager.profiles.get(result1.profileId);
      const prof2 = strictManager.profiles.get(result2.profileId);

      // In strict mode, only one should be active
      expect(prof2.active).toBe(true);
      expect(prof1.active).toBe(false);
    });

    test('should support moderate isolation mode', () => {
      const moderateManager = new MultiAccountOrchestratorManager({
        isolationMode: 'moderate'
      });

      expect(moderateManager.isolationMode).toBe('moderate');
    });
  });

  // ==========================================
  // PROFILE EVENTS
  // ==========================================

  describe('Profile Events', () => {
    test('should emit profile created event', (done) => {
      manager.on('profile:created', ({ profileId, name }) => {
        expect(profileId).toBeDefined();
        expect(name).toBe('Test');
        done();
      });

      manager.createProfile({ name: 'Test' });
    });

    test('should emit profile deleted event', (done) => {
      const result = manager.createProfile({ name: 'Test' });

      manager.on('profile:deleted', ({ profileId }) => {
        expect(profileId).toBe(result.profileId);
        done();
      });

      manager.deleteProfile(result.profileId);
    });
  });
});

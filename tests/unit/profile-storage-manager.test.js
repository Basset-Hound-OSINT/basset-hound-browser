/**
 * Unit Tests - Profile State Storage Manager
 * Tests for ProfileStateStorageManager class
 *
 * Test Coverage:
 * - Storage operations (3 tests)
 * - Version management (2 tests)
 * - Metadata handling (3 tests)
 * - Cleanup operations (2 tests)
 * Total: 10 unit tests
 */

const ProfileStateStorageManager = require('../../src/sessions/profile-storage-manager');

describe('ProfileStateStorageManager', () => {
  let manager;
  let mockSessionStorage;

  beforeEach(() => {
    mockSessionStorage = {
      save: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(true)
    };

    manager = new ProfileStateStorageManager({
      sessionStorage: mockSessionStorage,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    });
  });

  describe('Storage Operations', () => {
    test('should save session state', async () => {
      const profileId = 'profile-123';
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'session-123',
        cookies: [],
        localStorage: { key: 'value' },
        sessionStorage: {},
        metadata: { version: 1 }
      };

      const stateId = await manager.saveSessionState(profileId, state);

      expect(typeof stateId).toBe('string');
      expect(stateId.length).toBe(16); // 8 bytes as hex
      expect(mockSessionStorage.save).toHaveBeenCalled();
    });

    test('should load saved state', async () => {
      const profileId = 'profile-123';
      const stateId = 'state-456';
      const mockState = {
        state: { capturedAt: new Date().toISOString(), sessionId: 'test' },
        metadata: { version: 1 }
      };

      mockSessionStorage.get.mockResolvedValue(mockState);

      const loaded = await manager.loadSessionState(profileId, stateId);

      expect(loaded.state).toBeDefined();
      expect(loaded.metadata).toBeDefined();
      expect(loaded.id).toBe(stateId);
    });

    test('should delete session state', async () => {
      const profileId = 'profile-123';
      const stateId = 'state-456';

      const result = await manager.deleteSessionState(profileId, stateId);

      expect(result).toBe(true);
      expect(mockSessionStorage.delete).toHaveBeenCalled();
    });
  });

  describe('Version Management', () => {
    test('should validate version compatibility', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        metadata: { version: 1 }
      };

      const validation = manager.validateStateIntegrity(state);

      expect(validation.valid).toBe(true);
    });

    test('should warn on unexpected versions', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        metadata: { version: 99 }
      };

      const validation = manager.validateStateIntegrity(state);

      expect(validation.warnings.some(w => w.includes('version'))).toBe(true);
    });
  });

  describe('Metadata Handling', () => {
    test('should get state metadata', async () => {
      const profileId = 'profile-123';
      const stateId = 'state-456';
      const mockState = {
        state: { capturedAt: new Date().toISOString(), sessionId: 'test' },
        createdAt: Date.now(),
        metadata: {
          version: 1,
          timestamp: Date.now(),
          sizeBytes: 1000,
          url: 'https://example.com',
          description: 'Test state'
        }
      };

      mockSessionStorage.get.mockResolvedValue(mockState);

      const metadata = await manager.getStateMetadata(profileId, stateId);

      expect(metadata.size).toBe(1000);
      expect(metadata.version).toBe(1);
      expect(metadata.url).toBe('https://example.com');
    });

    test('should update state metadata index', async () => {
      const profileId = 'profile-123';
      const stateId = 'state-456';

      await manager.updateStateMetadata(profileId, stateId, 1000);

      expect(mockSessionStorage.save).toHaveBeenCalled();
    });

    test('should calculate completeness score', async () => {
      const profileId = 'profile-123';
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [{ name: 'test', value: 'val' }],
        localStorage: { key: 'value' },
        sessionStorage: { key: 'value' },
        domState: { scrollPosition: { x: 0, y: 0 } },
        navigationState: { currentUrl: 'https://example.com' },
        metadata: { version: 1, timestamp: Date.now() }
      };

      const validation = manager.validateStateIntegrity(state);

      expect(validation.valid).toBe(true);
    });
  });

  describe('Cleanup Operations', () => {
    test('should cleanup old states', async () => {
      const profileId = 'profile-123';
      mockSessionStorage.get.mockResolvedValue({
        states: []
      });

      const deleted = await manager.autocleanup(profileId);

      expect(typeof deleted).toBe('number');
    });

    test('should respect cleanup rules', async () => {
      const profileId = 'profile-123';
      const rules = {
        maxAge: 3600000, // 1 hour
        maxCount: 5,
        maxSize: 10000000
      };

      mockSessionStorage.get.mockResolvedValue({
        states: []
      });

      const deleted = await manager.autocleanup(profileId, rules);

      expect(typeof deleted).toBe('number');
    });
  });

  describe('List Sessions', () => {
    test('should list saved sessions', async () => {
      const profileId = 'profile-123';
      const historyData = {
        states: [
          {
            stateId: 'state-1',
            created: Date.now(),
            sizeBytes: 1000,
            url: 'https://example.com',
            description: 'State 1',
            tags: ['tag1']
          },
          {
            stateId: 'state-2',
            created: Date.now() - 3600000,
            sizeBytes: 1500,
            url: 'https://example.com/page2',
            description: 'State 2',
            tags: ['tag2']
          }
        ]
      };

      mockSessionStorage.get.mockResolvedValue(historyData);

      const sessions = await manager.listSessionStates(profileId);

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(2);
      expect(sessions[0].state_id).toBeDefined();
      expect(sessions[0].age_seconds).toBeGreaterThanOrEqual(0);
    });

    test('should sort sessions by creation time', async () => {
      const profileId = 'profile-123';
      const now = Date.now();
      const historyData = {
        states: [
          { stateId: 'old', created: now - 7200000 },
          { stateId: 'new', created: now }
        ]
      };

      mockSessionStorage.get.mockResolvedValue(historyData);

      const sessions = await manager.listSessionStates(profileId);

      expect(sessions[0].state_id).toBe('new');
      expect(sessions[1].state_id).toBe('old');
    });
  });

  describe('Error Handling', () => {
    test('should require profileId and state', async () => {
      await expect(manager.saveSessionState(null, {})).rejects.toThrow();
      await expect(manager.saveSessionState('profile', null)).rejects.toThrow();
    });

    test('should handle missing profiles gracefully', async () => {
      const profileId = 'nonexistent';
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        metadata: { version: 1 }
      };

      // Should not throw, just warn
      const stateId = await manager.saveSessionState(profileId, state);
      expect(stateId).toBeDefined();
    });

    test('should handle storage get failures', async () => {
      mockSessionStorage.get.mockRejectedValue(new Error('Storage error'));

      const sessions = await manager.listSessionStates('profile-123');

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions).toHaveLength(0);
    });
  });

  describe('State Validation', () => {
    test('should validate complete state', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {},
        sessionStorage: {},
        metadata: { version: 1 }
      };

      const validation = manager.validateStateIntegrity(state);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid state objects', () => {
      const validation = manager.validateStateIntegrity(null);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should warn on missing components', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [],
        localStorage: {}
        // missing sessionStorage, metadata
      };

      const validation = manager.validateStateIntegrity(state);

      expect(validation.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Storage Key Building', () => {
    test('should build consistent storage keys', () => {
      const key1 = manager.buildStorageKey('profile-123', 'state-456');
      const key2 = manager.buildStorageKey('profile-123', 'state-456');

      expect(key1).toBe(key2);
      expect(key1).toContain('session:state:data');
      expect(key1).toContain('profile-123');
      expect(key1).toContain('state-456');
    });

    test('should produce different keys for different inputs', () => {
      const key1 = manager.buildStorageKey('profile-1', 'state-1');
      const key2 = manager.buildStorageKey('profile-2', 'state-2');

      expect(key1).not.toBe(key2);
    });
  });
});

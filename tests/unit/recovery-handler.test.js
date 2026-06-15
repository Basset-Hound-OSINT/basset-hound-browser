/**
 * Unit Tests - Automatic Recovery Handler
 * Tests for AutomaticRecoveryHandler class
 *
 * Test Coverage:
 * - Disconnect handling (2 tests)
 * - Auto-restore logic (3 tests)
 * - Stale state detection (2 tests)
 * - Recovery status tracking (2 tests)
 * Total: 9 unit tests
 */

const AutomaticRecoveryHandler = require('../../src/sessions/recovery-handler');

describe('AutomaticRecoveryHandler', () => {
  let handler;
  let mockStateRestore;
  let mockProfileStorageManager;
  let mockSessionManager;

  beforeEach(() => {
    handler = new AutomaticRecoveryHandler({
      maxRecoveryAttempts: 3,
      reconnectionTimeout: 30000,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    });

    mockStateRestore = {
      restoreState: jest.fn().mockResolvedValue({
        success: true,
        restored: { cookies: 5, storage_items: 10, dom_elements: 2 },
        failed: { cookies: 0, storage_items: 0 },
        warnings: []
      })
    };

    mockProfileStorageManager = {
      loadSessionState: jest.fn().mockResolvedValue({
        state: {
          capturedAt: new Date().toISOString(),
          sessionId: 'test',
          cookies: [],
          localStorage: {},
          sessionStorage: {},
          metadata: { version: 1 }
        }
      })
    };

    mockSessionManager = {
      getSession: jest.fn().mockReturnValue({
        profileId: 'profile-123',
        webContents: {}
      })
    };

    handler.initialize(mockStateRestore, mockProfileStorageManager, mockSessionManager);
  });

  describe('Disconnect Handling', () => {
    test('should log disconnect event', async () => {
      const sessionId = 'session-123';
      const reason = { code: 1000, message: 'Normal closure' };

      await handler.handleDisconnect(sessionId, reason);

      const status = handler.getRecoveryStatus(sessionId);
      expect(status.history.some(h => h.event === 'disconnect')).toBe(true);
    });

    test('should initialize recovery status on first disconnect', async () => {
      const sessionId = 'session-123';

      await handler.handleDisconnect(sessionId);

      const status = handler.getRecoveryStatus(sessionId);
      expect(status.lastDisconnect).not.toBeNull();
      expect(status.recoveryAttempts).toBe(0);
    });
  });

  describe('Auto-Restore Logic', () => {
    test('should attempt auto-restore with valid state', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      // Initialize recovery status
      await handler.handleDisconnect(sessionId);

      const result = await handler.attemptAutoRestore(sessionId, profileId);

      expect(result.success).toBe(true);
      expect(mockStateRestore.restoreState).toHaveBeenCalled();
    });

    test('should track recovery attempts', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      // Initialize recovery status
      await handler.handleDisconnect(sessionId);

      try {
        mockStateRestore.restoreState.mockRejectedValueOnce(new Error('Restore failed'));
        await handler.attemptAutoRestore(sessionId, profileId);
      } catch (e) {
        // Expected to throw
      }

      const status = handler.getRecoveryStatus(sessionId);
      expect(status.recoveryAttempts).toBe(1);
    });

    test('should reject after max attempts', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      // Set up handler with maxRecoveryAttempts = 1
      const limitedHandler = new AutomaticRecoveryHandler({
        maxRecoveryAttempts: 1,
        logger: handler.logger
      });
      limitedHandler.initialize(mockStateRestore, mockProfileStorageManager, mockSessionManager);

      // Initialize recovery status
      await limitedHandler.handleDisconnect(sessionId);

      // First attempt should work
      mockStateRestore.restoreState.mockResolvedValueOnce({
        success: true,
        restored: { cookies: 5, storage_items: 10, dom_elements: 2 },
        failed: { cookies: 0, storage_items: 0 }
      });
      await limitedHandler.attemptAutoRestore(sessionId, profileId);

      // Second attempt should fail (exceeds max)
      await expect(
        limitedHandler.attemptAutoRestore(sessionId, profileId)
      ).rejects.toThrow('Max recovery attempts');
    });
  });

  describe('Stale State Detection', () => {
    test('should identify very old state', () => {
      const oldTime = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
      const state = {
        capturedAt: oldTime,
        sessionId: 'test'
      };

      const staleCheck = handler.detectStaleState(state);

      expect(staleCheck.stale).toBe(true);
      expect(staleCheck.confidence).toBe(1.0);
    });

    test('should detect expired cookies ratio', () => {
      const state = {
        capturedAt: new Date().toISOString(),
        sessionId: 'test',
        cookies: [
          { name: 'valid', value: 'val', expires: new Date(Date.now() + 3600000).toISOString() },
          { name: 'expired1', value: 'val', expires: new Date(Date.now() - 3600000).toISOString() },
          { name: 'expired2', value: 'val', expires: new Date(Date.now() - 3600000).toISOString() }
        ]
      };

      const staleCheck = handler.detectStaleState(state);

      expect(staleCheck.stale).toBe(true);
      expect(staleCheck.reason).toContain('expired');
    });

    test('should return fresh state when recent', () => {
      const recentTime = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
      const state = {
        capturedAt: recentTime,
        sessionId: 'test',
        cookies: []
      };

      const staleCheck = handler.detectStaleState(state);

      expect(staleCheck.stale).toBe(false);
    });
  });

  describe('Recovery Status Tracking', () => {
    test('should get recovery status', () => {
      const sessionId = 'session-123';

      const status = handler.getRecoveryStatus(sessionId);

      expect(status.lastDisconnect).toBeNull();
      expect(status.recoveryAttempts).toBe(0);
      expect(status.success).toBe(false);
      expect(Array.isArray(status.history)).toBe(true);
    });

    test('should maintain recovery history', async () => {
      const sessionId = 'session-123';

      await handler.handleDisconnect(sessionId);
      const status = handler.getRecoveryStatus(sessionId);

      expect(status.history.length).toBeGreaterThan(0);
      expect(status.history[0].event).toBe('disconnect');
    });

    test('should clear recovery history', () => {
      const sessionId = 'session-123';

      handler.recoveryStatus.set(sessionId, {
        lastDisconnect: Date.now(),
        attempts: 3,
        success: false,
        history: [{ event: 'disconnect' }]
      });

      handler.clearRecoveryHistory(sessionId);
      const status = handler.getRecoveryStatus(sessionId);

      expect(status.history).toHaveLength(0);
      expect(status.recoveryAttempts).toBe(0);
    });
  });

  describe('Manual Recovery', () => {
    test('should trigger manual recovery', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      const result = await handler.triggerManualRecovery(sessionId, profileId);

      expect(result.success).toBe(true);
      expect(mockStateRestore.restoreState).toHaveBeenCalled();
    });

    test('should use specific state ID if provided', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';
      const stateId = 'state-456';

      await handler.triggerManualRecovery(sessionId, profileId, stateId);

      expect(mockProfileStorageManager.loadSessionState).toHaveBeenCalledWith(profileId, stateId);
    });

    test('should fail if no state available', async () => {
      mockProfileStorageManager.loadSessionState.mockRejectedValue(new Error('No state found'));

      await expect(
        handler.triggerManualRecovery('session-123', 'profile-123')
      ).rejects.toThrow();
    });
  });

  describe('Reconnection Monitoring', () => {
    test('should set reconnection monitor timeout', () => {
      jest.useFakeTimers();
      const sessionId = 'session-123';

      // Initialize recovery status first
      handler.recoveryStatus.set(sessionId, {
        lastDisconnect: Date.now(),
        attempts: 0,
        success: false,
        history: []
      });

      handler.setReconnectionMonitor(sessionId);

      expect(handler.reconnectionMonitors.has(sessionId)).toBe(true);

      jest.advanceTimersByTime(30000);
      jest.runAllTimers();

      const status = handler.getRecoveryStatus(sessionId);
      expect(status.history.some(h => h.event === 'reconnection_timeout')).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('Session Manager Integration', () => {
    test('should register with session manager', () => {
      const mockWsServer = {};
      const mockSessionMgr = { on: jest.fn() };

      handler.registerWithSessionManager(mockSessionMgr, mockWsServer);

      expect(mockSessionMgr.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSessionMgr.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
    });
  });

  describe('State Management', () => {
    test('should clear all recovery status', () => {
      handler.recoveryStatus.set('session-1', { attempts: 1 });
      handler.recoveryStatus.set('session-2', { attempts: 2 });

      handler.clearAllRecoveryStatus();

      expect(handler.recoveryStatus.size).toBe(0);
    });

    test('should track recovery success', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      // Initialize recovery status first
      await handler.handleDisconnect(sessionId);

      mockStateRestore.restoreState.mockResolvedValueOnce({
        success: true,
        restored: { cookies: 5, storage_items: 10, dom_elements: 2 },
        failed: { cookies: 0, storage_items: 0 }
      });

      await handler.attemptAutoRestore(sessionId, profileId);
      const status = handler.getRecoveryStatus(sessionId);

      expect(status.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing state storage manager', async () => {
      const limitedHandler = new AutomaticRecoveryHandler({ logger: handler.logger });

      await expect(
        limitedHandler.attemptAutoRestore('session-123', 'profile-123')
      ).rejects.toThrow('not fully initialized');
    });

    test('should log recovery errors', async () => {
      const sessionId = 'session-123';
      const profileId = 'profile-123';

      mockStateRestore.restoreState.mockRejectedValueOnce(new Error('Restore failed'));

      try {
        await handler.attemptAutoRestore(sessionId, profileId);
      } catch (e) {
        // Expected
      }

      expect(handler.logger.warn).toHaveBeenCalled();
    });
  });
});

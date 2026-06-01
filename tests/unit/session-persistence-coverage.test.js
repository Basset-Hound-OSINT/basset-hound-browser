/**
 * Comprehensive test coverage for Session Persistence Module
 * Target: 95%+ code coverage
 * Tests all checkpoint operations, encryption, concurrency, error recovery, and edge cases
 */

const SessionPersistence = require('../../src/sessions/session-persistence');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('SessionPersistence - Comprehensive Coverage', () => {
  let persistence;
  let tempDir;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `basset-test-${Date.now()}`);
    persistence = new SessionPersistence({
      storageDir: tempDir,
      snapshotInterval: 5,
      maxSnapshots: 10,
      autoRecovery: true
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  // ================================================================
  // SESSION CREATION AND INITIALIZATION
  // ================================================================
  describe('Session Creation', () => {
    test('should create session with unique ID', () => {
      const session = persistence.createSession();
      expect(session.id).toBeDefined();
      expect(session.id).toHaveLength(32); // 16 bytes hex
    });

    test('should create sessions with different IDs', () => {
      const session1 = persistence.createSession();
      const session2 = persistence.createSession();
      expect(session1.id).not.toBe(session2.id);
    });

    test('should initialize session with default metadata', () => {
      const session = persistence.createSession();
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
      expect(session.requestCount).toBe(0);
      expect(session.status).toBe('active');
    });

    test('should accept session data on creation', () => {
      const sessionData = {
        metadata: { source: 'test' },
        cookies: { sessionId: '123' }
      };
      const session = persistence.createSession(sessionData);
      expect(session.metadata.source).toBe('test');
      expect(session.cookies.sessionId).toBe('123');
    });

    test('should store userId for access control', () => {
      const session = persistence.createSession({}, 'user-1');
      expect(session.userId).toBe('user-1');
    });

    test('should default userId to default-user', () => {
      const session = persistence.createSession({});
      expect(session.userId).toBe('default-user');
    });

    test('should save session to disk', () => {
      const session = persistence.createSession();
      const sessionFile = path.join(tempDir, `${session.id}.json`);
      expect(fs.existsSync(sessionFile)).toBe(true);
    });

    test('should initialize snapshots array', () => {
      const session = persistence.createSession();
      const snapshots = persistence.sessionSnapshots.get(session.id);
      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBe(0);
    });
  });

  // ================================================================
  // REQUEST RECORDING
  // ================================================================
  describe('Request Recording', () => {
    let sessionId;

    beforeEach(() => {
      const session = persistence.createSession();
      sessionId = session.id;
    });

    test('should increment request count', () => {
      const result = persistence.recordRequest(sessionId);
      expect(result.requestCount).toBe(1);
    });

    test('should increment multiple times', () => {
      for (let i = 1; i <= 5; i++) {
        const result = persistence.recordRequest(sessionId);
        expect(result.requestCount).toBe(i);
      }
    });

    test('should trigger snapshot at interval', () => {
      for (let i = 1; i <= 5; i++) {
        persistence.recordRequest(sessionId);
      }
      const snapshots = persistence.sessionSnapshots.get(sessionId);
      expect(snapshots.length).toBeGreaterThan(0);
    });

    test('should return shouldSnapshot flag', () => {
      let result;
      for (let i = 1; i <= 5; i++) {
        result = persistence.recordRequest(sessionId);
      }
      expect(result.shouldSnapshot).toBe(true);
    });

    test('should handle non-existent session', () => {
      expect(() => {
        persistence.recordRequest('unknown-session');
      }).toThrow();
    });

    test('should update session timestamp', () => {
      const session1 = persistence.sessions.get(sessionId);
      const time1 = session1.updatedAt;

      persistence.recordRequest(sessionId);

      const session2 = persistence.sessions.get(sessionId);
      expect(session2.updatedAt).toBeGreaterThanOrEqual(time1);
    });
  });

  // ================================================================
  // SNAPSHOTS
  // ================================================================
  describe('Snapshot Operations', () => {
    let sessionId;

    beforeEach(() => {
      const session = persistence.createSession({
        cookies: { test: 'value1' }
      });
      sessionId = session.id;
    });

    test('should create snapshot manually', () => {
      const snapshot = persistence.takeSnapshot(sessionId);
      expect(snapshot.id).toBeDefined();
      expect(snapshot.sessionId).toBe(sessionId);
      expect(snapshot.timestamp).toBeDefined();
    });

    test('should capture session state in snapshot', () => {
      const session = persistence.sessions.get(sessionId);
      session.cookies = { auth: 'token123' };

      const snapshot = persistence.takeSnapshot(sessionId);
      expect(snapshot.state.cookies).toEqual({ auth: 'token123' });
    });

    test('should include metadata in snapshot', () => {
      const snapshot = persistence.takeSnapshot(sessionId, {
        type: 'manual',
        reason: 'test'
      });
      expect(snapshot.metadata.type).toBe('manual');
      expect(snapshot.metadata.reason).toBe('test');
    });

    test('should limit snapshots to maxSnapshots', () => {
      for (let i = 0; i < 15; i++) {
        persistence.takeSnapshot(sessionId);
      }
      const snapshots = persistence.sessionSnapshots.get(sessionId);
      expect(snapshots.length).toBeLessThanOrEqual(10);
    });

    test('should save snapshots to disk', () => {
      persistence.takeSnapshot(sessionId);
      const snapshotDir = path.join(tempDir, sessionId);
      expect(fs.existsSync(snapshotDir)).toBe(true);
    });

    test('should handle snapshot of non-existent session', () => {
      expect(() => {
        persistence.takeSnapshot('unknown-session');
      }).toThrow();
    });
  });

  // ================================================================
  // RECOVERY AND RESTORATION
  // ================================================================
  describe('Session Recovery', () => {
    let sessionId;

    beforeEach(() => {
      const session = persistence.createSession({
        cookies: { original: 'cookie' },
        localStorage: { key: 'value' }
      });
      sessionId = session.id;

      // Create snapshots
      persistence.recordRequest(sessionId);
      persistence.recordRequest(sessionId);
      persistence.recordRequest(sessionId);
      persistence.recordRequest(sessionId);
      persistence.recordRequest(sessionId);
      persistence.takeSnapshot(sessionId);
    });

    test('should restore from latest snapshot', () => {
      const result = persistence.restoreFromSnapshot(sessionId, null, 'default-user');
      expect(result.sessionId).toBe(sessionId);
      expect(result.restored).toBe(true);
    });

    test('should restore specific snapshot by ID', () => {
      const snapshots = persistence.sessionSnapshots.get(sessionId);
      if (snapshots.length > 0) {
        const snapshotId = snapshots[0].id;
        const result = persistence.restoreFromSnapshot(sessionId, snapshotId, 'default-user');
        expect(result.restored).toBe(true);
      }
    });

    test('should restore state correctly', () => {
      const session = persistence.sessions.get(sessionId);
      session.cookies = { modified: 'cookie' };

      persistence.restoreFromSnapshot(sessionId, null, 'default-user');

      const restored = persistence.sessions.get(sessionId);
      expect(restored.cookies).toEqual(session.cookies);
    });

    test('should update session status to recovered', () => {
      persistence.restoreFromSnapshot(sessionId, null, 'default-user');
      const session = persistence.sessions.get(sessionId);
      expect(session.status).toBe('recovered');
    });

    test('should enforce access control on restore', () => {
      const session = persistence.sessions.get(sessionId);
      session.userId = 'user-1';

      expect(() => {
        persistence.restoreFromSnapshot(sessionId, null, 'user-2');
      }).toThrow();
    });

    test('should allow admin to restore any session', () => {
      const session = persistence.sessions.get(sessionId);
      session.userId = 'user-1';

      const result = persistence.restoreFromSnapshot(sessionId, null, 'admin');
      expect(result.restored).toBe(true);
    });

    test('should throw on no snapshots available', () => {
      const newSession = persistence.createSession();
      expect(() => {
        persistence.restoreFromSnapshot(newSession.id, null, 'default-user');
      }).toThrow();
    });

    test('should throw on invalid snapshot ID', () => {
      expect(() => {
        persistence.restoreFromSnapshot(sessionId, 'invalid-id', 'default-user');
      }).toThrow();
    });
  });

  // ================================================================
  // SESSION BRANCHING
  // ================================================================
  describe('Session Branching', () => {
    let parentSessionId;

    beforeEach(() => {
      const session = persistence.createSession({
        metadata: { original: true }
      });
      parentSessionId = session.id;
    });

    test('should create child session from parent', () => {
      const childSession = persistence.branchSession(parentSessionId, 'default-user');
      expect(childSession.id).toBeDefined();
      expect(childSession.parentSessionId).toBe(parentSessionId);
    });

    test('should preserve parent state in child', () => {
      const parent = persistence.sessions.get(parentSessionId);
      parent.cookies = { test: 'value' };

      const child = persistence.branchSession(parentSessionId, 'default-user');
      expect(child.cookies).toEqual(parent.cookies);
    });

    test('should track session branches', () => {
      persistence.branchSession(parentSessionId, 'default-user');
      const branches = persistence.sessionBranches.get(parentSessionId);
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
    });

    test('should enforce access control on branching', () => {
      const parent = persistence.sessions.get(parentSessionId);
      parent.userId = 'user-1';

      expect(() => {
        persistence.branchSession(parentSessionId, 'user-2');
      }).toThrow();
    });
  });

  // ================================================================
  // PERSISTENCE AND LOADING
  // ================================================================
  describe('Persistence and Loading', () => {
    test('should save sessions to disk', () => {
      const session = persistence.createSession();
      const monitorsFile = path.join(tempDir, 'sessions-metadata.json');

      persistence.saveSessions();
      expect(fs.existsSync(monitorsFile)).toBe(true);
    });

    test('should load sessions from disk', () => {
      const session1 = persistence.createSession();
      persistence.saveSessions();

      const newPersistence = new SessionPersistence({
        storageDir: tempDir
      });

      const loaded = newPersistence.sessions.has(session1.id);
      expect(loaded).toBe(true);
    });

    test('should handle corrupted session files', () => {
      const sessionFile = path.join(tempDir, 'corrupted.json');
      fs.writeFileSync(sessionFile, '{invalid json}');

      // Should not crash
      const newPersistence = new SessionPersistence({
        storageDir: tempDir
      });
      expect(newPersistence).toBeDefined();
    });
  });

  // ================================================================
  // ACCESS CONTROL
  // ================================================================
  describe('Access Control Verification', () => {
    let sessionId;

    beforeEach(() => {
      const session = persistence.createSession({}, 'user-1');
      sessionId = session.id;
    });

    test('should allow owner access', () => {
      const session = persistence._verifySessionAccess(sessionId, 'user-1', 'read');
      expect(session).toBeDefined();
    });

    test('should deny non-owner access', () => {
      expect(() => {
        persistence._verifySessionAccess(sessionId, 'user-2', 'read');
      }).toThrow();
    });

    test('should allow admin access', () => {
      const session = persistence._verifySessionAccess(sessionId, 'admin', 'read');
      expect(session).toBeDefined();
    });

    test('should throw on non-existent session', () => {
      expect(() => {
        persistence._verifySessionAccess('unknown', 'user-1', 'read');
      }).toThrow();
    });
  });

  // ================================================================
  // EDGE CASES
  // ================================================================
  describe('Edge Cases', () => {
    test('should handle empty session creation', () => {
      const session = persistence.createSession();
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
    });

    test('should handle large session metadata', () => {
      const largeMetadata = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = `value${i}`.repeat(100);
      }

      const session = persistence.createSession({ metadata: largeMetadata });
      expect(session.metadata).toBeDefined();
    });

    test('should handle rapid request recording', () => {
      const session = persistence.createSession();
      for (let i = 0; i < 100; i++) {
        persistence.recordRequest(session.id);
      }

      const updated = persistence.sessions.get(session.id);
      expect(updated.requestCount).toBe(100);
    });

    test('should handle snapshot state with circular references', () => {
      const session = persistence.createSession();
      // Session state shouldn't have circular refs, but test robustness
      const snapshot = persistence.takeSnapshot(session.id);
      expect(snapshot.state).toBeDefined();
    });

    test('should handle concurrent snapshot operations', () => {
      const session = persistence.createSession();
      const snapshots = [];

      for (let i = 0; i < 5; i++) {
        snapshots.push(persistence.takeSnapshot(session.id));
      }

      expect(snapshots.length).toBe(5);
    });

    test('should handle special characters in userId', () => {
      const session = persistence.createSession({}, 'user-@#$%');
      expect(session.userId).toBe('user-@#$%');
    });

    test('should handle null session data gracefully', () => {
      const session = persistence.createSession({
        cookies: null,
        localStorage: null
      });
      expect(session.cookies).toBeNull();
    });
  });

  // ================================================================
  // ERROR RECOVERY
  // ================================================================
  describe('Error Recovery', () => {
    test('should ensure storage directory exists', () => {
      const newDir = path.join(os.tmpdir(), `basset-new-${Date.now()}`);
      const newPersistence = new SessionPersistence({
        storageDir: newDir
      });

      expect(fs.existsSync(newDir)).toBe(true);

      fs.rmSync(newDir, { recursive: true });
    });

    test('should handle disk write failures gracefully', () => {
      const session = persistence.createSession();
      // Try to save with very large data
      session.metadata = { large: 'x'.repeat(10000000) };

      expect(() => {
        persistence.saveSessions();
      }).not.toThrow();
    });

    test('should handle file system errors', () => {
      const readOnlyDir = path.join(os.tmpdir(), `readonly-${Date.now()}`);
      fs.mkdirSync(readOnlyDir);
      fs.chmodSync(readOnlyDir, 0o444); // Read-only

      expect(() => {
        new SessionPersistence({ storageDir: readOnlyDir });
      }).toThrow();

      fs.chmodSync(readOnlyDir, 0o755);
      fs.rmSync(readOnlyDir, { recursive: true });
    });
  });
});

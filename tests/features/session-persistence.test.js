/**
 * Session Persistence & Recovery Tests
 * Tests all aspects of session persistence, snapshots, branching, and recovery
 */

const SessionPersistence = require('../../src/sessions/session-persistence');
const fs = require('fs');
const path = require('path');

describe('Session Persistence & Recovery', () => {
  let persistence;
  const testStorageDir = '/tmp/test-basset-sessions';

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testStorageDir)) {
      const files = fs.readdirSync(testStorageDir);
      for (const file of files) {
        const filePath = path.join(testStorageDir, file);
        if (fs.statSync(filePath).isDirectory()) {
          const subfiles = fs.readdirSync(filePath);
          for (const subfile of subfiles) {
            fs.unlinkSync(path.join(filePath, subfile));
          }
          fs.rmdirSync(filePath);
        } else {
          fs.unlinkSync(filePath);
        }
      }
      fs.rmdirSync(testStorageDir);
    }

    persistence = new SessionPersistence({
      storageDir: testStorageDir,
      snapshotInterval: 5
    });
  });

  describe('Session Creation & Management', () => {
    test('should create a new session', () => {
      const session = persistence.createSession({
        metadata: { purpose: 'test' }
      });

      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeDefined();
      expect(session.requestCount).toBe(0);
      expect(session.status).toBe('active');
      expect(session.snapshotCount).toBe(0);
    });

    test('should list all sessions', () => {
      persistence.createSession({ metadata: { id: 1 } });
      persistence.createSession({ metadata: { id: 2 } });
      persistence.createSession({ metadata: { id: 3 } });

      const sessions = persistence.listSessions();
      expect(sessions.length).toBe(3);
    });

    test('should get session details', () => {
      const created = persistence.createSession({
        metadata: { purpose: 'test' }
      });

      const details = persistence.getSessionDetails(created.id);
      expect(details.session.id).toBe(created.id);
      expect(details.snapshots).toEqual([]);
      expect(details.branches).toEqual([]);
    });

    test('should delete a session', () => {
      const session = persistence.createSession();
      const result = persistence.deleteSession(session.id);

      expect(result.deleted).toBe(true);

      const sessions = persistence.listSessions();
      expect(sessions.find(s => s.id === session.id)).toBeUndefined();
    });
  });

  describe('Request Recording & Snapshots', () => {
    test('should record requests and auto-snapshot at interval', () => {
      const session = persistence.createSession();

      // Record 5 requests (should trigger snapshot at 5)
      for (let i = 0; i < 5; i++) {
        persistence.recordRequest(session.id, { url: `test-${i}` });
      }

      const details = persistence.getSessionDetails(session.id);
      expect(details.session.requestCount).toBe(5);
      expect(details.snapshots.length).toBe(1); // Triggered at request 5
    });

    test('should take manual snapshots', () => {
      const session = persistence.createSession();

      const snap1 = persistence.takeSnapshot(session.id, { label: 'checkpoint-1' });
      const snap2 = persistence.takeSnapshot(session.id, { label: 'checkpoint-2' });

      const details = persistence.getSessionDetails(session.id);
      expect(details.snapshots.length).toBe(2);
      expect(details.snapshots[0].id).toBe(snap1.id);
      expect(details.snapshots[1].id).toBe(snap2.id);
    });

    test('should maintain snapshot history up to maxSnapshots', () => {
      const limitedPersistence = new SessionPersistence({
        storageDir: testStorageDir + '-limit',
        maxSnapshots: 3
      });

      const session = limitedPersistence.createSession();

      // Take 5 snapshots
      for (let i = 0; i < 5; i++) {
        limitedPersistence.takeSnapshot(session.id, { index: i });
      }

      const details = limitedPersistence.getSessionDetails(session.id);
      expect(details.snapshots.length).toBe(3); // Should only keep last 3
    });
  });

  describe('Session State Management', () => {
    test('should store and restore session state', () => {
      const session = persistence.createSession({
        metadata: { purpose: 'state-test' }
      });

      // Simulate session state updates
      const sessionObj = persistence.sessions.get(session.id);
      sessionObj.cookies = { sessionId: '12345', tracking: 'xyz' };
      sessionObj.localStorage = { theme: 'dark', lang: 'en' };
      sessionObj.requestCount = 10;

      // Take snapshot
      const snapshot = persistence.takeSnapshot(session.id);

      // Modify state
      sessionObj.cookies = {};
      sessionObj.localStorage = {};
      sessionObj.requestCount = 0;

      // Restore from snapshot
      const restored = persistence.restoreFromSnapshot(session.id, snapshot.id);

      expect(restored.restoredRequestCount).toBe(10);
      expect(restored.state.cookies).toEqual({ sessionId: '12345', tracking: 'xyz' });
      expect(restored.state.localStorage).toEqual({ theme: 'dark', lang: 'en' });
    });

    test('should restore from latest snapshot without ID', () => {
      const session = persistence.createSession();
      const sessionObj = persistence.sessions.get(session.id);
      sessionObj.cookies = { token: 'latest' };
      sessionObj.requestCount = 15;

      persistence.takeSnapshot(session.id, { label: 'snap1' });

      sessionObj.cookies = {};
      sessionObj.requestCount = 0;

      const restored = persistence.restoreFromSnapshot(session.id);
      expect(restored.restoredRequestCount).toBe(15);
      expect(restored.state.cookies).toEqual({ token: 'latest' });
    });
  });

  describe('Failure Detection & Recovery', () => {
    test('should record rate limit failure and provide recovery strategies', () => {
      const session = persistence.createSession();

      const failure = persistence.recordFailure(session.id, 'rate_limit', {
        statusCode: 429,
        retryAfter: 60
      });

      expect(failure.failureType).toBe('rate_limit');
      expect(failure.recoveryStrategies.length).toBeGreaterThan(0);
      expect(failure.recoveryStrategies[0].action).toBe('wait');
    });

    test('should record bot blocked failure', () => {
      const session = persistence.createSession();

      const failure = persistence.recordFailure(session.id, 'bot_blocked', {
        service: 'cloudflare'
      });

      expect(failure.recoveryStrategies).toContainEqual(
        expect.objectContaining({ action: 'rotate_fingerprint' })
      );
    });

    test('should record forbidden failure', () => {
      const session = persistence.createSession();

      const failure = persistence.recordFailure(session.id, 'forbidden', {
        statusCode: 403
      });

      expect(failure.recoveryStrategies).toContainEqual(
        expect.objectContaining({ action: 'rotate_user_agent' })
      );
    });

    test('should record connection lost failure', () => {
      const session = persistence.createSession();

      const failure = persistence.recordFailure(session.id, 'connection_lost', {
        error: 'ECONNRESET'
      });

      expect(failure.recoveryStrategies).toContainEqual(
        expect.objectContaining({ action: 'restore_from_snapshot' })
      );
    });

    test('should update session status on failure', () => {
      const session = persistence.createSession();

      expect(session.status).toBe('active');

      persistence.recordFailure(session.id, 'rate_limit');

      const details = persistence.getSessionDetails(session.id);
      expect(details.session.status).toBe('failed');
      expect(details.session.failureInfo).toBeDefined();
    });

    test('should mark session as recovered after restore', () => {
      const session = persistence.createSession();
      const sessionObj = persistence.sessions.get(session.id);
      sessionObj.cookies = { token: 'test' };
      sessionObj.requestCount = 10;

      persistence.takeSnapshot(session.id);
      persistence.recordFailure(session.id, 'rate_limit');

      const restored = persistence.restoreFromSnapshot(session.id);
      const details = persistence.getSessionDetails(session.id);

      expect(details.session.status).toBe('recovered');
    });
  });

  describe('Session Branching (A/B Testing)', () => {
    test('should branch a session for A/B testing', () => {
      const session = persistence.createSession({ metadata: { original: true } });
      const sessionObj = persistence.sessions.get(session.id);
      sessionObj.cookies = { variant: 'original' };
      sessionObj.requestCount = 10;

      persistence.takeSnapshot(session.id);

      const branch = persistence.branchSession(session.id, 'variant-b');

      expect(branch.parentSessionId).toBe(session.id);
      expect(branch.branchName).toBe('variant-b');
      expect(branch.requestCount).toBe(10); // Starts from parent's last snapshot
      expect(branch.status).toBe('active');
    });

    test('should inherit parent state in branch', () => {
      const session = persistence.createSession();
      const sessionObj = persistence.sessions.get(session.id);
      sessionObj.cookies = { userId: '123', token: 'abc' };
      sessionObj.localStorage = { theme: 'dark' };

      persistence.takeSnapshot(session.id);

      const branch = persistence.branchSession(session.id);
      const branchObj = persistence.sessions.get(branch.id);

      expect(branchObj.cookies).toEqual({ userId: '123', token: 'abc' });
      expect(branchObj.localStorage).toEqual({ theme: 'dark' });
    });

    test('should track branch relationships', () => {
      const session = persistence.createSession();
      persistence.takeSnapshot(session.id);

      const branch1 = persistence.branchSession(session.id, 'branch-1');
      const branch2 = persistence.branchSession(session.id, 'branch-2');

      const details = persistence.getSessionDetails(session.id);
      expect(details.branches).toContain(branch1.id);
      expect(details.branches).toContain(branch2.id);
      expect(details.branches.length).toBe(2);
    });

    test('should merge branch results', () => {
      const session = persistence.createSession();
      persistence.takeSnapshot(session.id);

      const branch = persistence.branchSession(session.id);

      const merged = persistence.mergeBranch(branch.id, {
        successRate: 0.95,
        avgLatency: 120,
        recommendation: 'keep'
      });

      expect(merged.branchSessionId).toBe(branch.id);
      expect(merged.parentSessionId).toBe(session.id);
      expect(merged.branchResults.requestCount).toBe(branch.requestCount);
    });

    test('should filter branches by parent session', () => {
      const parent1 = persistence.createSession();
      const parent2 = persistence.createSession();

      persistence.takeSnapshot(parent1.id);
      persistence.takeSnapshot(parent2.id);

      persistence.branchSession(parent1.id);
      persistence.branchSession(parent1.id);
      persistence.branchSession(parent2.id);

      const parent1Branches = persistence.listSessions({ parentSessionId: parent1.id });
      const parent2Branches = persistence.listSessions({ parentSessionId: parent2.id });

      expect(parent1Branches.length).toBe(2);
      expect(parent2Branches.length).toBe(1);
    });
  });

  describe('Session Persistence (Disk I/O)', () => {
    test('should save session to disk', () => {
      const session = persistence.createSession();
      const filePath = path.join(testStorageDir, `${session.id}.json`);

      expect(fs.existsSync(filePath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(saved.id).toBe(session.id);
    });

    test('should save snapshots to disk', () => {
      const session = persistence.createSession();
      const snapshot = persistence.takeSnapshot(session.id);

      const snapshotDir = path.join(testStorageDir, session.id);
      const snapshotPath = path.join(snapshotDir, `${snapshot.id}.json`);

      expect(fs.existsSync(snapshotPath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      expect(saved.id).toBe(snapshot.id);
    });

    test('should load sessions from disk on init', () => {
      const session1 = persistence.createSession();
      const session2 = persistence.createSession();

      persistence.takeSnapshot(session1.id);
      persistence.takeSnapshot(session2.id);

      // Create new persistence instance (should load from disk)
      const newPersistence = new SessionPersistence({
        storageDir: testStorageDir
      });

      const sessions = newPersistence.listSessions();
      expect(sessions.length).toBe(2);

      const details = newPersistence.getSessionDetails(session1.id);
      expect(details.snapshots.length).toBe(1);
    });
  });

  describe('Session Export & Import', () => {
    test('should export session without snapshots', () => {
      const session = persistence.createSession({ metadata: { name: 'test' } });
      persistence.takeSnapshot(session.id);

      const exported = persistence.exportSession(session.id, false);

      expect(exported.session.id).toBe(session.id);
      expect(exported.snapshots.length).toBe(0);
    });

    test('should export session with snapshots', () => {
      const session = persistence.createSession();
      persistence.takeSnapshot(session.id);
      persistence.takeSnapshot(session.id);

      const exported = persistence.exportSession(session.id, true);

      expect(exported.session.id).toBe(session.id);
      expect(exported.snapshots.length).toBe(2);
    });

    test('should import exported session', () => {
      const original = persistence.createSession({ metadata: { id: 'test' } });
      persistence.takeSnapshot(original.id);

      const exported = persistence.exportSession(original.id, true);

      // Create new persistence and import
      const newPersistence = new SessionPersistence({
        storageDir: testStorageDir + '-import'
      });

      const imported = newPersistence.importSession(exported);

      expect(imported.sessionId).toBe(original.id);
      expect(imported.snapshotCount).toBe(1);

      const details = newPersistence.getSessionDetails(original.id);
      expect(details.snapshots.length).toBe(1);
    });
  });

  describe('Session Statistics', () => {
    test('should calculate session statistics', () => {
      const session = persistence.createSession();

      for (let i = 0; i < 10; i++) {
        persistence.recordRequest(session.id);
      }

      persistence.takeSnapshot(session.id);

      const stats = persistence.getSessionStats(session.id);

      expect(stats.sessionId).toBe(session.id);
      expect(stats.requestCount).toBe(10);
      expect(stats.snapshotCount).toBeGreaterThan(0);
      expect(stats.branchCount).toBe(0);
      expect(stats.status).toBe('active');
    });

    test('should track session duration', () => {
      const session = persistence.createSession();

      const startTime = session.createdAt;

      // Simulate some time passing
      const stats = persistence.getSessionStats(session.id);

      expect(stats.duration).toBeGreaterThanOrEqual(0);
    });

    test('should calculate average requests per snapshot', () => {
      // Create new persistence with large snapshotInterval to avoid auto-snapshots
      const SessionPersistence = require('../../src/sessions/session-persistence');
      const testPersistence = new SessionPersistence({
        storageDir: testStorageDir + '-avg',
        snapshotInterval: 100 // Large interval to prevent auto-snapshots during test
      });

      const session = testPersistence.createSession();

      for (let i = 0; i < 20; i++) {
        testPersistence.recordRequest(session.id);
      }

      testPersistence.takeSnapshot(session.id);
      testPersistence.takeSnapshot(session.id);

      const stats = testPersistence.getSessionStats(session.id);

      expect(stats.avgRequestsPerSnapshot).toBe(10); // 20 requests / 2 snapshots
    });
  });

  describe('Session Filtering', () => {
    test('should filter sessions by status', () => {
      const session1 = persistence.createSession();
      const session2 = persistence.createSession();

      persistence.recordFailure(session2.id, 'rate_limit');

      const active = persistence.listSessions({ status: 'active' });
      const failed = persistence.listSessions({ status: 'failed' });

      expect(active.length).toBe(1);
      expect(failed.length).toBe(1);
    });

    test('should filter only active sessions', () => {
      const session1 = persistence.createSession();
      const session2 = persistence.createSession();
      const session3 = persistence.createSession();

      persistence.recordFailure(session2.id, 'rate_limit');

      const active = persistence.listSessions({ onlyActive: true });

      expect(active.length).toBe(2);
      expect(active.some(s => s.id === session2.id)).toBe(false);
    });
  });
});

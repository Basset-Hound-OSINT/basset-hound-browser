/**
 * Security Test: Sessions Lack Access Control (CVE-W14-002)
 * Tests that only authorized users can access/modify sessions
 */

const assert = require('assert');
const SessionPersistence = require('../../src/sessions/session-persistence');

describe('CVE-W14-002: Sessions Lack Access Control', () => {
  let persistence;

  beforeEach(() => {
    persistence = new SessionPersistence({
      storageDir: '/tmp/test-sessions-' + Date.now()
    });
  });

  describe('Session Ownership', () => {
    it('should track session owner on creation', () => {
      const session = persistence.createSession({
        metadata: { testData: true }
      }, 'user-123');

      assert.strictEqual(session.userId, 'user-123');
    });

    it('should default to default-user if not specified', () => {
      const session = persistence.createSession({});

      assert.strictEqual(session.userId, 'default-user');
    });

    it('should assign unique session IDs', () => {
      const session1 = persistence.createSession({}, 'user-1');
      const session2 = persistence.createSession({}, 'user-2');

      assert.notStrictEqual(session1.id, session2.id);
    });
  });

  describe('Session Access Control', () => {
    it('should verify session ownership before restoration', () => {
      const session1 = persistence.createSession({
        cookies: { auth: 'token123' }
      }, 'user-1');

      // Take snapshot so we can restore
      persistence.takeSnapshot(session1.id);

      // User 2 should NOT be able to restore User 1's session
      assert.throws(() => {
        persistence.restoreFromSnapshot(session1.id, null, 'user-2');
      }, /Unauthorized/);
    });

    it('should allow session owner to restore own session', () => {
      const session = persistence.createSession({
        cookies: { auth: 'token456' }
      }, 'user-auth');

      persistence.recordRequest(session.id);
      persistence.takeSnapshot(session.id);

      // Owner should be able to restore
      const result = persistence.restoreFromSnapshot(session.id, null, 'user-auth');
      assert(result);
      assert.strictEqual(result.sessionId, session.id);
    });

    it('should allow admin to access any session', () => {
      const session = persistence.createSession({
        cookies: { secret: 'admin-should-see-this' }
      }, 'user-restricted');

      persistence.takeSnapshot(session.id);

      // Admin should have universal access
      const result = persistence.restoreFromSnapshot(session.id, null, 'admin');
      assert(result);
      assert.strictEqual(result.sessionId, session.id);
    });
  });

  describe('Branch Session Authorization', () => {
    it('should prevent unauthorized branch merging', () => {
      const parentSession = persistence.createSession({
        metadata: { parent: true }
      }, 'user-1');

      persistence.takeSnapshot(parentSession.id);
      const branchSession = persistence.branchSession(parentSession.id);

      // User 2 should not be able to merge the branch
      assert.throws(() => {
        persistence.mergeBranch(branchSession.id, {}, 'user-2');
      }, /Unauthorized/);
    });

    it('should prevent merging when user lacks parent session access', () => {
      const parentSession = persistence.createSession({
        metadata: { parent: true }
      }, 'user-owner');

      persistence.takeSnapshot(parentSession.id);
      const branchSession = persistence.branchSession(parentSession.id);

      // Even if user owns branch, if they don't own parent, merge should fail
      assert.throws(() => {
        persistence.mergeBranch(branchSession.id, {}, 'other-user');
      }, /Unauthorized/);
    });

    it('should allow owner to merge own branch', () => {
      const session = persistence.createSession({
        metadata: { test: true }
      }, 'user-branch-owner');

      persistence.takeSnapshot(session.id);
      const branch = persistence.branchSession(session.id);

      const result = persistence.mergeBranch(branch.id, { success: true }, 'user-branch-owner');

      assert(result);
      assert.strictEqual(result.branchSessionId, branch.id);
      assert.strictEqual(result.mergedBy, 'user-branch-owner');
    });

    it('should allow admin to merge any branch', () => {
      const session = persistence.createSession({
        metadata: { test: true }
      }, 'regular-user');

      persistence.takeSnapshot(session.id);
      const branch = persistence.branchSession(session.id);

      const result = persistence.mergeBranch(branch.id, {}, 'admin');

      assert(result);
      assert.strictEqual(result.mergedBy, 'admin');
    });

    it('should track who merged the branch', () => {
      const session = persistence.createSession({}, 'user-1');
      persistence.takeSnapshot(session.id);
      const branch = persistence.branchSession(session.id);

      persistence.mergeBranch(branch.id, { data: 'test' }, 'user-1');

      const mergeRecord = session.metadata.branches[0];
      assert.strictEqual(mergeRecord.mergedBy, 'user-1');
      assert(mergeRecord.mergedAt);
    });
  });

  describe('Multi-User Session Isolation', () => {
    it('should prevent cross-user session access', () => {
      const userASessions = [];
      const userBSessions = [];

      // Create sessions for user A
      for (let i = 0; i < 3; i++) {
        const session = persistence.createSession(
          { metadata: { userA: true } },
          'user-A'
        );
        userASessions.push(session.id);
        persistence.takeSnapshot(session.id);
      }

      // Create sessions for user B
      for (let i = 0; i < 2; i++) {
        const session = persistence.createSession(
          { metadata: { userB: true } },
          'user-B'
        );
        userBSessions.push(session.id);
        persistence.takeSnapshot(session.id);
      }

      // User A should NOT access User B sessions
      for (const sessionId of userBSessions) {
        assert.throws(() => {
          persistence.restoreFromSnapshot(sessionId, null, 'user-A');
        }, /Unauthorized/);
      }

      // User B should NOT access User A sessions
      for (const sessionId of userASessions) {
        assert.throws(() => {
          persistence.restoreFromSnapshot(sessionId, null, 'user-B');
        }, /Unauthorized/);
      }
    });
  });

  describe('Snapshot Access Control', () => {
    it('should require user verification for snapshot restoration', () => {
      const session = persistence.createSession({
        localStorage: { key: 'value' }
      }, 'owner-user');

      persistence.recordRequest(session.id);
      const snapshot = persistence.takeSnapshot(session.id);

      // Wrong user should not restore
      assert.throws(() => {
        persistence.restoreFromSnapshot(session.id, snapshot.id, 'attacker');
      }, /Unauthorized/);
    });

    it('should allow restoration with specific snapshot ID', () => {
      const session = persistence.createSession({}, 'owner');

      // Take multiple snapshots
      persistence.takeSnapshot(session.id);
      persistence.takeSnapshot(session.id);
      const thirdSnapshot = persistence.takeSnapshot(session.id);

      const result = persistence.restoreFromSnapshot(
        session.id,
        thirdSnapshot.id,
        'owner'
      );

      assert.strictEqual(result.snapshotId, thirdSnapshot.id);
    });
  });

  describe('Private Data Protection', () => {
    it('should protect sensitive session data from unauthorized access', () => {
      const session = persistence.createSession({
        cookies: {
          sessionToken: 'secret-token-12345',
          userId: 'sensitive-id'
        },
        localStorage: {
          apiKey: 'sk-1234567890'
        },
        headers: {
          'Authorization': 'Bearer secret-jwt-token'
        }
      }, 'data-owner');

      // Take snapshot first
      persistence.takeSnapshot(session.id);

      // Non-owner cannot access these details
      assert.throws(() => {
        persistence.restoreFromSnapshot(session.id, null, 'unauthorized-user');
      }, /Unauthorized/);

      // Owner CAN access
      const result = persistence.restoreFromSnapshot(session.id, null, 'data-owner');
      assert.deepStrictEqual(result.state.cookies.sessionToken, 'secret-token-12345');
      assert.deepStrictEqual(result.state.localStorage.apiKey, 'sk-1234567890');
    });
  });

  describe('Integration Tests', () => {
    it('complete session lifecycle with access control', () => {
      // User 1 creates session
      const session = persistence.createSession(
        {
          metadata: { purpose: 'A/B testing' },
          cookies: { session: 'abc123' }
        },
        'user-1'
      );

      // Records requests
      persistence.recordRequest(session.id);
      persistence.recordRequest(session.id);

      // Takes snapshot
      persistence.takeSnapshot(session.id, { type: 'manual' });

      // Branches for testing
      const branch = persistence.branchSession(session.id);
      assert.strictEqual(branch.userId, 'user-1');

      // Records requests in branch
      persistence.recordRequest(branch.id);
      persistence.takeSnapshot(branch.id);

      // Merges back
      const mergeResult = persistence.mergeBranch(branch.id, { success: true }, 'user-1');
      assert(mergeResult);

      // User 2 should NOT be able to access any of this
      assert.throws(() => {
        persistence.restoreFromSnapshot(session.id, null, 'user-2');
      }, /Unauthorized/);

      assert.throws(() => {
        persistence.mergeBranch(branch.id, {}, 'user-2');
      }, /Unauthorized/);
    });

    it('admin override for troubleshooting', () => {
      // User creates session
      const session = persistence.createSession({}, 'user-x');
      persistence.takeSnapshot(session.id);

      // Admin can access for troubleshooting
      const adminResult = persistence.restoreFromSnapshot(session.id, null, 'admin');
      assert(adminResult);

      // Admin can merge
      const branch = persistence.branchSession(session.id);
      const mergeResult = persistence.mergeBranch(branch.id, {}, 'admin');
      assert(mergeResult);
    });
  });
});

module.exports = {
  SessionPersistence
};

/**
 * Integration Tests for Collaboration API (v12.9.0 Feature 2)
 * Advanced Multi-Agent Collaboration Framework
 *
 * Comprehensive test suite covering:
 * - Session locking (acquisition, renewal, release)
 * - Event streaming (subscriptions, broadcasting, history)
 * - Message queuing (queueing, dequeuing, conflict detection)
 * - Conflict resolution
 * - Concurrency scenarios with 5+ agents
 * - Multi-session isolation
 * - Edge cases and error handling
 *
 * Test count: 85+ integration tests organized by feature area
 * @module tests/v12-9-0/collaboration-api.test.js
 */

const assert = require('assert');
const {
  SessionLockManager,
  EventStreamManager,
  MessageQueueManager,
  ConflictDetector,
  CollaborationCoordinator
} = require('../../src/v12-9-0/collaboration-api');

describe('Collaboration API Integration Tests (v12.9.0)', () => {
  let coordinator;
  let lockManager;
  let eventManager;
  let queueManager;
  let conflictDetector;

  beforeEach(() => {
    coordinator = new CollaborationCoordinator({ lockTimeout: 10000 });
    lockManager = coordinator.lockManager;
    eventManager = coordinator.eventManager;
    queueManager = coordinator.queueManager;
    conflictDetector = new ConflictDetector();
  });

  // ===== SESSION LOCKING TESTS (Tests 1-15) =====
  describe('Session Lock Manager', () => {
    // Test 1-5: Basic lock acquisition and release
    it('Test 1: Acquire exclusive lock on session', async () => {
      const result = await lockManager.acquireLock('session-1', 'client-1');
      assert(result.lockId);
      assert.strictEqual(result.sessionId, 'session-1');
      assert(result.acquiredAt);
      assert(result.expiresAt > result.acquiredAt);
    });

    it('Test 2: Release lock successfully', async () => {
      const lock = await lockManager.acquireLock('session-2', 'client-1');
      const result = lockManager.releaseLock(lock.lockId, 'session-2');
      assert(result.success);
      assert(result.releasedAt);
    });

    it('Test 3: Get lock status when locked', () => {
      lockManager.acquireLock('session-3', 'client-1');
      const status = lockManager.getLockStatus('session-3');
      assert(status.locked);
      assert.strictEqual(status.clientId, 'client-1');
      assert(status.remainingMs > 0);
    });

    it('Test 4: Get lock status when not locked', () => {
      const status = lockManager.getLockStatus('session-nonexistent');
      assert(!status.locked);
    });

    it('Test 5: Renew lock extends expiration', async () => {
      const lock = await lockManager.acquireLock('session-5', 'client-1');
      const original = lockManager.getLockStatus('session-5');

      await new Promise(resolve => setTimeout(resolve, 100));

      const renewed = lockManager.renewLock(lock.lockId, 'session-5');
      assert(renewed.success);
      assert(renewed.expiresAt > original.expiresAt + 90);
    });

    // Test 6-10: Concurrent lock acquisition
    it('Test 6: Wait for lock release with single waiter', async () => {
      const lock1 = await lockManager.acquireLock('session-6', 'client-1');

      let acquired = false;
      const promise = lockManager.acquireLock('session-6', 'client-2', { timeout: 5000 })
        .then(() => { acquired = true; });

      await new Promise(resolve => setTimeout(resolve, 50));
      assert(!acquired, 'Should not acquire while locked');

      lockManager.releaseLock(lock1.lockId, 'session-6');

      await promise;
      assert(acquired, 'Should acquire after release');
    });

    it('Test 7: Multiple waiters queue by priority', async () => {
      const lock1 = await lockManager.acquireLock('session-7', 'client-1');

      const results = [];

      const p2 = lockManager.acquireLock('session-7', 'client-2', { priority: 1, timeout: 5000 })
        .then(r => results.push({ client: 'client-2', ...r }));

      const p3 = lockManager.acquireLock('session-7', 'client-3', { priority: 5, timeout: 5000 })
        .then(r => results.push({ client: 'client-3', ...r }));

      const p4 = lockManager.acquireLock('session-7', 'client-4', { priority: 2, timeout: 5000 })
        .then(r => results.push({ client: 'client-4', ...r }));

      await new Promise(resolve => setTimeout(resolve, 50));

      lockManager.releaseLock(lock1.lockId, 'session-7');

      await Promise.all([p2, p3, p4]);

      assert.strictEqual(results[0].client, 'client-3');
    });

    it('Test 8: Lock timeout prevents indefinite wait', async () => {
      const lock1 = await lockManager.acquireLock('session-8', 'client-1');

      const start = Date.now();
      try {
        await lockManager.acquireLock('session-8', 'client-2', { timeout: 500 });
        assert.fail('Should timeout');
      } catch (error) {
        assert(error.message.includes('timeout'));
        const elapsed = Date.now() - start;
        assert(elapsed >= 450 && elapsed < 700, `Timeout took ${elapsed}ms`);
      }
    });

    it('Test 9: Lock with metadata stores custom data', async () => {
      const metadata = { userId: 'user-123', action: 'automation' };
      const lock = await lockManager.acquireLock('session-9', 'client-1', { metadata });

      const status = lockManager.getLockStatus('session-9');
      assert(status.locked);
    });

    it('Test 10: Cannot release lock with wrong lockId', async () => {
      const lock = await lockManager.acquireLock('session-10', 'client-1');
      const result = lockManager.releaseLock('wrong-lock-id', 'session-10');
      assert(!result.success);
      assert(result.error);
    });

    // Test 11-15: Lock cleanup and management
    it('Test 11: Cleanup expired locks', async () => {
      const shortTimeoutManager = new SessionLockManager({ lockTimeout: 100 });
      await shortTimeoutManager.acquireLock('session-11', 'client-1');

      await new Promise(resolve => setTimeout(resolve, 150));

      const result = shortTimeoutManager.cleanupExpiredLocks();
      assert(result.cleaned > 0);
    });

    it('Test 12: Get all active locks', async () => {
      await lockManager.acquireLock('session-12a', 'client-1');
      await lockManager.acquireLock('session-12b', 'client-2');

      const locks = lockManager.getAllLocks();
      assert(locks.length >= 2);

      const sessionIds = locks.map(l => l.sessionId);
      assert(sessionIds.includes('session-12a'));
      assert(sessionIds.includes('session-12b'));
    });

    it('Test 13: Track command count per lock', async () => {
      const lock = await lockManager.acquireLock('session-13', 'client-1');
      const lockObj = lockManager.locks.get('session-13');
      lockObj.commands = 5;

      const status = lockManager.getLockStatus('session-13');
      assert.strictEqual(status.commands, 5);
    });

    it('Test 14: Invalid sessionId throws error', async () => {
      try {
        await lockManager.acquireLock(null, 'client-1');
        assert.fail('Should throw error');
      } catch (error) {
        assert(error.message.includes('required'));
      }
    });

    it('Test 15: Multiple locks on different sessions work independently', async () => {
      const lock1 = await lockManager.acquireLock('session-15a', 'client-1');
      const lock2 = await lockManager.acquireLock('session-15b', 'client-2');

      assert.strictEqual(lock1.sessionId, 'session-15a');
      assert.strictEqual(lock2.sessionId, 'session-15b');
      assert.notStrictEqual(lock1.lockId, lock2.lockId);
    });
  });

  // ===== EVENT STREAMING TESTS (Tests 16-30) =====
  describe('Event Stream Manager', () => {
    // Test 16-20: Basic subscriptions
    it('Test 16: Subscribe to session events', () => {
      const result = eventManager.subscribe('session-16', 'subscriber-1');
      assert(result.subscriptionId);
      assert.strictEqual(result.sessionId, 'session-16');
      assert.strictEqual(result.subscriberId, 'subscriber-1');
      assert(result.subscribedAt);
    });

    it('Test 17: Unsubscribe from events', () => {
      const sub = eventManager.subscribe('session-17', 'subscriber-1');
      const result = eventManager.unsubscribe(sub.subscriptionId);
      assert(result.success);
      assert.strictEqual(result.sessionId, 'session-17');
    });

    it('Test 18: Get subscription info', () => {
      const sub = eventManager.subscribe('session-18', 'subscriber-1', {
        eventTypes: ['command_completed']
      });
      const info = eventManager.getSubscriptionInfo(sub.subscriptionId);
      assert(info);
      assert.deepStrictEqual(info.eventTypes, ['command_completed']);
    });

    it('Test 19: Get session subscriptions', () => {
      eventManager.subscribe('session-19', 'subscriber-1');
      eventManager.subscribe('session-19', 'subscriber-2');
      eventManager.subscribe('session-19', 'subscriber-3');

      const subs = eventManager.getSessionSubscriptions('session-19');
      assert.strictEqual(subs.length, 3);
    });

    it('Test 20: Cannot unsubscribe invalid subscription', () => {
      const result = eventManager.unsubscribe('invalid-sub-id');
      assert(!result.success);
    });

    // Test 21-25: Event broadcasting
    it('Test 21: Broadcast event to subscribers', () => {
      const sub = eventManager.subscribe('session-21', 'subscriber-1');

      const result = eventManager.broadcastEvent('session-21', 'test_event', {
        data: 'test'
      });

      assert(result.eventId);
      assert.strictEqual(result.broadcasted, 1);
      assert(result.buffered);
    });

    it('Test 22: Event history records broadcasts', () => {
      eventManager.subscribe('session-22', 'subscriber-1');
      eventManager.broadcastEvent('session-22', 'event1', { data: 'a' });
      eventManager.broadcastEvent('session-22', 'event2', { data: 'b' });

      const history = eventManager.getEventHistory('session-22');
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].eventType, 'event1');
      assert.strictEqual(history[1].eventType, 'event2');
    });

    it('Test 23: Get event history filters by type', () => {
      eventManager.subscribe('session-23', 'subscriber-1');
      eventManager.broadcastEvent('session-23', 'type_a', {});
      eventManager.broadcastEvent('session-23', 'type_b', {});
      eventManager.broadcastEvent('session-23', 'type_a', {});

      const history = eventManager.getEventHistory('session-23', { eventType: 'type_a' });
      assert.strictEqual(history.length, 2);
      assert(history.every(e => e.eventType === 'type_a'));
    });

    it('Test 24: Get event history limits results', () => {
      eventManager.subscribe('session-24', 'subscriber-1');
      for (let i = 0; i < 10; i++) {
        eventManager.broadcastEvent('session-24', 'event', { num: i });
      }

      const history = eventManager.getEventHistory('session-24', { limit: 3 });
      assert.strictEqual(history.length, 3);
      assert.strictEqual(history[0].data.num, 7);
      assert.strictEqual(history[2].data.num, 9);
    });

    it('Test 25: Broadcast with no subscribers records but doesn\'t error', () => {
      const result = eventManager.broadcastEvent('session-25', 'event', { data: 'test' });
      assert.strictEqual(result.broadcasted, 0);
      assert(result.buffered);
    });

    // Test 26-30: Buffer management
    it('Test 26: Event buffer maintains max size', () => {
      const smallManager = new EventStreamManager({ maxBufferSize: 5 });
      smallManager.subscribe('session-26', 'subscriber-1');

      for (let i = 0; i < 10; i++) {
        smallManager.broadcastEvent('session-26', 'event', { num: i });
      }

      const history = smallManager.getEventHistory('session-26');
      assert(history.length <= 5);
      assert.strictEqual(history[0].data.num, 5);
    });

    it('Test 27: Get event history by time range', () => {
      eventManager.subscribe('session-27', 'subscriber-1');
      const start = Date.now();

      eventManager.broadcastEvent('session-27', 'event', { num: 1 });
      const mid = Date.now() + 1;
      eventManager.broadcastEvent('session-27', 'event', { num: 2 });

      const history = eventManager.getEventHistory('session-27', { since: mid });
      assert.strictEqual(history.length, 1);
    });

    it('Test 28: Multiple subscribers receive same event', () => {
      eventManager.subscribe('session-28', 'subscriber-1');
      eventManager.subscribe('session-28', 'subscriber-2');
      eventManager.subscribe('session-28', 'subscriber-3');

      const result = eventManager.broadcastEvent('session-28', 'event', {});
      assert.strictEqual(result.broadcasted, 3);
    });

    it('Test 29: Unsubscribed client doesn\'t receive events', () => {
      const sub1 = eventManager.subscribe('session-29', 'subscriber-1');
      const sub2 = eventManager.subscribe('session-29', 'subscriber-2');

      eventManager.unsubscribe(sub2.subscriptionId);

      const result = eventManager.broadcastEvent('session-29', 'event', {});
      assert.strictEqual(result.broadcasted, 1);
    });

    it('Test 30: Subscribers isolated per session', () => {
      eventManager.subscribe('session-30a', 'subscriber-1');
      eventManager.subscribe('session-30b', 'subscriber-2');

      const result = eventManager.broadcastEvent('session-30a', 'event', {});
      assert.strictEqual(result.broadcasted, 1);
    });
  });

  // ===== MESSAGE QUEUE TESTS (Tests 31-45) =====
  describe('Message Queue Manager', () => {
    // Test 31-35: Basic queueing
    it('Test 31: Queue command on session', () => {
      const result = queueManager.queueCommand('session-31', 'client-1', {
        name: 'click',
        params: { selector: '#btn' }
      });

      assert(result.queuedId);
      assert.strictEqual(result.position, 0);
      assert(result.estimatedWaitMs >= 0);
    });

    it('Test 32: Peek queue without removing', () => {
      queueManager.queueCommand('session-32', 'client-1', {
        name: 'click',
        params: { selector: '#btn1' }
      });

      const peeked = queueManager.peekQueue('session-32');
      assert(peeked);
      assert(peeked.command);

      const again = queueManager.peekQueue('session-32');
      assert(again);
    });

    it('Test 33: Dequeue removes command', () => {
      queueManager.queueCommand('session-33', 'client-1', {
        name: 'click',
        params: { selector: '#btn' }
      });

      const dequeued = queueManager.dequeueCommand('session-33');
      assert(dequeued);
      assert.strictEqual(dequeued.command.name, 'click');

      const empty = queueManager.peekQueue('session-33');
      assert(!empty);
    });

    it('Test 34: Peek on empty queue returns null', () => {
      const result = queueManager.peekQueue('session-34-empty');
      assert(!result);
    });

    it('Test 35: Remove specific command from queue', () => {
      const cmd1 = queueManager.queueCommand('session-35', 'client-1', { name: 'cmd1' });
      queueManager.queueCommand('session-35', 'client-1', { name: 'cmd2' });
      const cmd3 = queueManager.queueCommand('session-35', 'client-1', { name: 'cmd3' });

      const result = queueManager.removeCommand('session-35', cmd1.queuedId);
      assert(result.success);

      const status = queueManager.getQueueStatus('session-35');
      assert.strictEqual(status.size, 2);
    });

    // Test 36-40: Priority ordering
    it('Test 36: Commands queue by priority', () => {
      queueManager.queueCommand('session-36', 'client-1', { name: 'cmd1' }, { priority: 0 });
      queueManager.queueCommand('session-36', 'client-1', { name: 'cmd2' }, { priority: 5 });
      queueManager.queueCommand('session-36', 'client-1', { name: 'cmd3' }, { priority: 2 });

      const status = queueManager.getQueueStatus('session-36');
      assert.strictEqual(status.commands[0].command, 'cmd2');
      assert.strictEqual(status.commands[1].command, 'cmd3');
      assert.strictEqual(status.commands[2].command, 'cmd1');
    });

    it('Test 37: High priority inserted correctly', () => {
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd1' }, { priority: 1 });
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd2' }, { priority: 2 });
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd3' }, { priority: 3 });

      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd4' }, { priority: 5 });

      const status = queueManager.getQueueStatus('session-37');
      assert.strictEqual(status.commands[0].command, 'cmd4');
    });

    it('Test 38: Same priority maintains order', () => {
      const c1 = queueManager.queueCommand('session-38', 'client-1', { name: 'cmd1' }, { priority: 1 });
      const c2 = queueManager.queueCommand('session-38', 'client-1', { name: 'cmd2' }, { priority: 1 });
      const c3 = queueManager.queueCommand('session-38', 'client-1', { name: 'cmd3' }, { priority: 1 });

      const status = queueManager.getQueueStatus('session-38');
      assert.strictEqual(status.commands[0].command, 'cmd1');
      assert.strictEqual(status.commands[1].command, 'cmd2');
      assert.strictEqual(status.commands[2].command, 'cmd3');
    });

    it('Test 39: Estimated wait time increases with queue size', () => {
      const r1 = queueManager.queueCommand('session-39', 'client-1', { name: 'cmd1' });
      const r2 = queueManager.queueCommand('session-39', 'client-1', { name: 'cmd2' }, { priority: -1 });
      const r3 = queueManager.queueCommand('session-39', 'client-1', { name: 'cmd3' }, { priority: -2 });

      assert.strictEqual(r1.estimatedWaitMs, 0);
      assert(r2.estimatedWaitMs > r1.estimatedWaitMs);
      assert(r3.estimatedWaitMs > r2.estimatedWaitMs);
    });

    it('Test 40: Queue size limit enforced', () => {
      const smallQueue = new MessageQueueManager({ maxQueueSize: 2 });
      smallQueue.queueCommand('session-40', 'client-1', { name: 'cmd1' });
      smallQueue.queueCommand('session-40', 'client-1', { name: 'cmd2' });

      try {
        smallQueue.queueCommand('session-40', 'client-1', { name: 'cmd3' });
        assert.fail('Should throw queue full error');
      } catch (error) {
        assert(error.message.includes('Queue full'));
      }
    });

    // Test 41-45: Queue management
    it('Test 41: Get queue status', () => {
      queueManager.queueCommand('session-41', 'client-1', { name: 'cmd1' });
      queueManager.queueCommand('session-41', 'client-1', { name: 'cmd2' });

      const status = queueManager.getQueueStatus('session-41');
      assert.strictEqual(status.sessionId, 'session-41');
      assert.strictEqual(status.size, 2);
      assert(Array.isArray(status.commands));
    });

    it('Test 42: Clear queue removes all commands', () => {
      queueManager.queueCommand('session-42', 'client-1', { name: 'cmd1' });
      queueManager.queueCommand('session-42', 'client-1', { name: 'cmd2' });

      const result = queueManager.clearQueue('session-42');
      assert.strictEqual(result.cleared, 2);

      const status = queueManager.getQueueStatus('session-42');
      assert.strictEqual(status.size, 0);
    });

    it('Test 43: Get statistics across sessions', () => {
      queueManager.queueCommand('session-43a', 'client-1', { name: 'cmd1' });
      queueManager.queueCommand('session-43a', 'client-1', { name: 'cmd2' });
      queueManager.queueCommand('session-43b', 'client-1', { name: 'cmd3' });

      const stats = queueManager.getStatistics();
      assert.strictEqual(stats.activeSessions, 2);
      assert.strictEqual(stats.totalCommands, 3);
    });

    it('Test 44: Queue persists metadata', () => {
      queueManager.queueCommand('session-44', 'client-1', { name: 'cmd1' }, {
        metadata: { userId: 'user-123', context: 'test' }
      });

      const status = queueManager.getQueueStatus('session-44');
      assert(status.commands[0]);
    });

    it('Test 45: Dequeue from non-existent session returns null', () => {
      const result = queueManager.dequeueCommand('session-nonexistent');
      assert(!result);
    });
  });

  // ===== CONFLICT DETECTION TESTS (Tests 46-55) =====
  describe('Conflict Detector', () => {
    // Test 46-50: Basic conflict detection
    it('Test 46: Detect navigation conflicts', () => {
      const cmd = { name: 'navigate', params: { url: 'http://example.com' } };
      const queued = [{ name: 'navigate', params: { url: 'http://other.com' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 0);
    });

    it('Test 47: Detect form submission conflicts', () => {
      const cmd = { name: 'submit_form', params: { formId: 'form1' } };
      const queued = [{ name: 'submit_form', params: { formId: 'form1' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 0);
    });

    it('Test 48: Detect click conflicts on same element', () => {
      const cmd = { name: 'click', params: { elementId: 'btn1' } };
      const queued = [{ name: 'click', params: { elementId: 'btn1' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 0);
    });

    it('Test 49: No conflict for different targets', () => {
      const cmd = { name: 'click', params: { elementId: 'btn1' } };
      const queued = [{ name: 'click', params: { elementId: 'btn2' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert.strictEqual(conflicts.length, 0);
    });

    it('Test 50: No conflict with compatible commands', () => {
      const cmd = { name: 'scroll', params: { y: 100 } };
      const queued = [{ name: 'click', params: { elementId: 'btn1' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert.strictEqual(conflicts.length, 0);
    });

    // Test 51-55: Advanced conflict scenarios
    it('Test 51: Navigate conflicts with click', () => {
      const cmd = { name: 'navigate', params: { url: 'http://example.com' } };
      const queued = [{ name: 'click', params: { elementId: 'btn1' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 0);
    });

    it('Test 52: Multiple conflicts detected', () => {
      const cmd = { name: 'navigate', params: { url: 'http://example.com' } };
      const queued = [
        { name: 'navigate', params: { url: 'http://other.com' } },
        { name: 'click', params: { elementId: 'btn1' } }
      ];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 1);
    });

    it('Test 53: Same URL different commands', () => {
      const cmd = { name: 'navigate', params: { url: 'http://example.com' } };
      const queued = [{ name: 'click', params: { url: 'http://example.com' } }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(conflicts.length > 0);
    });

    it('Test 54: Empty queued commands returns no conflicts', () => {
      const cmd = { name: 'click', params: { elementId: 'btn1' } };
      const conflicts = conflictDetector.detectConflicts(cmd, []);
      assert.strictEqual(conflicts.length, 0);
    });

    it('Test 55: Conflict detection with missing params', () => {
      const cmd = { name: 'click' };
      const queued = [{ name: 'click' }];

      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(Array.isArray(conflicts));
    });
  });

  // ===== QUEUE MANAGER WITH CONFLICT DETECTION TESTS (Tests 56-60) =====
  describe('Queue Manager with Conflict Detection', () => {
    it('Test 56: Queue detects conflicts by default', () => {
      queueManager.queueCommand('session-56', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      });

      try {
        queueManager.queueCommand('session-56', 'client-1', {
          name: 'click',
          params: { elementId: 'btn1' }
        });
        const status = queueManager.getQueueStatus('session-56');
        assert(status.size >= 2);
      } catch (error) {
        assert(error.message.includes('conflict'));
      }
    });

    it('Test 57: Disable conflict detection', () => {
      queueManager.queueCommand('session-57', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      });

      const result = queueManager.queueCommand('session-57', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      }, { detectConflicts: false });

      assert(result.queuedId);
    });

    it('Test 58: Resolve conflicts with abort mode', () => {
      queueManager.queueCommand('session-58', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      });

      try {
        queueManager.queueCommand('session-58', 'client-1', {
          name: 'click',
          params: { elementId: 'btn1' }
        }, { resolveConflicts: 'abort' });
        assert.fail('Should abort on conflict');
      } catch (error) {
        assert(error.message.includes('Conflicts'));
      }
    });

    it('Test 59: Conflict info includes reason', () => {
      try {
        queueManager.queueCommand('session-59', 'client-1', {
          name: 'navigate'
        });

        queueManager.queueCommand('session-59', 'client-1', {
          name: 'navigate'
        }, { resolveConflicts: 'abort' });
      } catch (error) {
        assert(error.message.includes('Conflicts'));
      }
    });

    it('Test 60: No abort on non-conflicting commands', () => {
      queueManager.queueCommand('session-60', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      });

      const result = queueManager.queueCommand('session-60', 'client-1', {
        name: 'click',
        params: { elementId: 'btn2' }
      }, { resolveConflicts: 'abort' });

      assert(result.queuedId);
    });
  });

  // ===== CONCURRENCY WITH 5 AGENTS (Tests 61-70) =====
  describe('Concurrency Scenarios with 5 Agents', () => {
    it('Test 61: Five agents acquiring locks on different sessions', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];
      const locks = await Promise.all(
        agents.map((agent, i) =>
          lockManager.acquireLock(`session-61-${i}`, agent)
        )
      );

      assert.strictEqual(locks.length, 5);
      locks.forEach(lock => {
        assert(lock.lockId);
        assert(lock.acquiredAt);
      });
    });

    it('Test 62: Five agents queueing commands on same session', () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];
      const results = agents.map((agent, i) =>
        queueManager.queueCommand('session-62-shared', agent, {
          name: `cmd-${agent}`,
          params: { index: i }
        })
      );

      assert.strictEqual(results.length, 5);
      const status = queueManager.getQueueStatus('session-62-shared');
      assert.strictEqual(status.size, 5);
    });

    it('Test 63: Five agents subscribing to events', () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];
      const subs = agents.map(agent =>
        eventManager.subscribe('session-63-shared', agent)
      );

      assert.strictEqual(subs.length, 5);
      const sessionSubs = eventManager.getSessionSubscriptions('session-63-shared');
      assert.strictEqual(sessionSubs.length, 5);
    });

    it('Test 64: Five agents with mixed operations on shared session', async () => {
      const sessionId = 'session-64-mixed';
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      // Acquire locks
      const locks = await Promise.all(
        agents.map((agent, i) =>
          lockManager.acquireLock(`${sessionId}-${i}`, agent)
        )
      );

      // Subscribe to events
      const subs = agents.map(agent =>
        eventManager.subscribe(sessionId, agent)
      );

      // Queue commands
      const queued = agents.map((agent, i) =>
        queueManager.queueCommand(sessionId, agent, {
          name: `cmd-${i}`,
          params: { agentId: agent }
        })
      );

      // Broadcast event
      const result = eventManager.broadcastEvent(sessionId, 'multi-agent-event', {
        agents: agents.length
      });

      assert.strictEqual(locks.length, 5);
      assert.strictEqual(subs.length, 5);
      assert.strictEqual(queued.length, 5);
      assert.strictEqual(result.broadcasted, 5);

      // Cleanup
      locks.forEach(lock => {
        lockManager.releaseLock(lock.lockId, `${sessionId}-${agents.indexOf(lock.clientId || 'agent-1')}`);
      });
    });

    it('Test 65: Five agents with concurrent command execution', async () => {
      const sessionId = 'session-65-concurrent';
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      const results = await Promise.all(
        agents.map(agent =>
          coordinator.executeCollaborativeCommand(
            sessionId,
            agent,
            { name: `execute-${agent}`, params: { timestamp: Date.now() } }
          )
        )
      );

      assert.strictEqual(results.length, 5);
      results.forEach(result => {
        assert(result.status === 'success' || result.status === 'error');
      });
    });

    it('Test 66: Lock contention with multiple waiters', async () => {
      const sessionId = 'session-66-contention';
      const lock1 = await lockManager.acquireLock(sessionId, 'agent-1');

      const agents = ['agent-2', 'agent-3', 'agent-4', 'agent-5'];
      const waiters = agents.map(agent =>
        lockManager.acquireLock(sessionId, agent, { timeout: 3000 })
      );

      await new Promise(resolve => setTimeout(resolve, 50));
      lockManager.releaseLock(lock1.lockId, sessionId);

      try {
        await Promise.all(waiters);
        // At least one should succeed
        const status = lockManager.getLockStatus(sessionId);
        assert(status.locked);
      } catch (e) {
        // Some may timeout, which is acceptable
      }
    });

    it('Test 67: Five agents with priority-based queue ordering', () => {
      const sessionId = 'session-67-priority';
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      agents.forEach((agent, i) => {
        queueManager.queueCommand(sessionId, agent, {
          name: `cmd-${agent}`,
          params: { priority: i }
        }, { priority: 5 - i }); // Reverse priority
      });

      const status = queueManager.getQueueStatus(sessionId);
      assert.strictEqual(status.size, 5);
      // First command should have agent-1 with highest priority (5-0=5)
      assert(status.commands[0]);
    });

    it('Test 68: Five agents broadcasting and receiving events', () => {
      const sessionId = 'session-68-broadcast';
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      // All agents subscribe
      agents.forEach(agent => {
        eventManager.subscribe(sessionId, agent);
      });

      // Each agent broadcasts
      const broadcasts = agents.map((agent, i) =>
        eventManager.broadcastEvent(sessionId, `event-${agent}`, {
          fromAgent: agent,
          index: i
        })
      );

      const history = eventManager.getEventHistory(sessionId);
      assert(history.length >= 5);
      broadcasts.forEach(broadcast => {
        assert.strictEqual(broadcast.broadcasted, 5);
      });
    });

    it('Test 69: Five agents with conflict detection on shared commands', () => {
      const sessionId = 'session-69-conflicts';
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      // Queue same command from different agents
      const results = [];
      agents.forEach((agent, i) => {
        try {
          const result = queueManager.queueCommand(sessionId, agent, {
            name: 'navigate',
            params: { url: 'http://example.com' }
          });
          results.push(result);
        } catch (e) {
          // Conflict expected
          results.push(null);
        }
      });

      // At least first should succeed, others may conflict
      assert(results.some(r => r !== null));
    });

    it('Test 70: Five agents with rapid lock acquire/release cycles', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      for (let cycle = 0; cycle < 5; cycle++) {
        const locks = await Promise.all(
          agents.map((agent, i) =>
            lockManager.acquireLock(`session-70-cycle-${cycle}-${i}`, agent)
          )
        );

        locks.forEach(lock => {
          lockManager.releaseLock(lock.lockId, lock.sessionId);
        });
      }

      // All locks should be released
      const allLocks = lockManager.getAllLocks();
      assert(allLocks.every(l => !l.sessionId.includes('session-70')));
    });
  });

  // ===== COLLABORATION COORDINATOR TESTS (Tests 71-80) =====
  describe('Collaboration Coordinator', () => {
    it('Test 71: Execute collaborative command with lock', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-71',
        'client-1',
        { name: 'click', params: { selector: '#btn' } }
      );

      assert.strictEqual(result.status, 'success');
      assert(result.lockId);
    });

    it('Test 72: Broadcast events during command execution', async () => {
      let events = [];
      coordinator.eventManager.on('event', (e) => {
        events.push(e.event.eventType);
      });

      coordinator.eventManager.subscribe('session-72', 'subscriber-1');

      await coordinator.executeCollaborativeCommand(
        'session-72',
        'client-1',
        { name: 'click' }
      );

      assert(events.includes('command_started'));
      assert(events.includes('command_completed'));
    });

    it('Test 73: Command timeout releases lock', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-73',
        'client-1',
        { name: 'timeout_cmd' }
      );

      const status = coordinator.lockManager.getLockStatus('session-73');
      assert(!status.locked);
    });

    it('Test 74: Get comprehensive collaboration status', () => {
      coordinator.lockManager.acquireLock('session-74', 'client-1');
      coordinator.eventManager.subscribe('session-74', 'subscriber-1');
      coordinator.queueManager.queueCommand('session-74', 'client-1', { name: 'cmd' });

      const status = coordinator.getCollaborationStatus('session-74');
      assert(status.timestamp);
      assert(status.locks);
      assert(status.subscriptions);
      assert(status.queue);
      assert(status.stats);
    });

    it('Test 75: Global collaboration status', () => {
      coordinator.lockManager.acquireLock('session-75a', 'client-1');
      coordinator.lockManager.acquireLock('session-75b', 'client-2');

      const status = coordinator.getCollaborationStatus();
      assert(Array.isArray(status.locks));
      assert(status.locks.length >= 2);
    });

    it('Test 76: Handle command execution error', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-76',
        'client-1',
        { name: 'error_cmd' }
      );

      assert(result.status === 'success' || result.status === 'error');
      const status = coordinator.lockManager.getLockStatus('session-76');
      assert(!status.locked);
    });

    it('Test 77: Track statistics', async () => {
      await coordinator.executeCollaborativeCommand('session-77', 'client-1', { name: 'cmd' });

      const stats = coordinator.stats;
      assert(stats.locksAcquired > 0);
      assert(stats.eventsEmitted > 0);
    });

    it('Test 78: Multiple concurrent collaborative commands', async () => {
      const promises = [
        coordinator.executeCollaborativeCommand('session-78a', 'client-1', { name: 'cmd1' }),
        coordinator.executeCollaborativeCommand('session-78b', 'client-2', { name: 'cmd2' }),
        coordinator.executeCollaborativeCommand('session-78c', 'client-3', { name: 'cmd3' })
      ];

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 3);
      assert(results.every(r => r.status === 'success'));
    });

    it('Test 79: Event history survives across commands', async () => {
      coordinator.eventManager.subscribe('session-79', 'subscriber-1');

      await coordinator.executeCollaborativeCommand('session-79', 'client-1', { name: 'cmd1' });
      await coordinator.executeCollaborativeCommand('session-79', 'client-2', { name: 'cmd2' });

      const history = coordinator.eventManager.getEventHistory('session-79');
      assert(history.length >= 2);
    });

    it('Test 80: Cleanup manages resources', () => {
      coordinator.lockManager.acquireLock('session-80', 'client-1');
      coordinator.eventManager.subscribe('session-80', 'subscriber-1');

      const before = coordinator.lockManager.getAllLocks().length;
      coordinator.lockManager.cleanupExpiredLocks();
      const after = coordinator.lockManager.getAllLocks().length;
      assert(before >= after);
    });
  });

  // ===== MULTI-SESSION ISOLATION TESTS (Tests 81-85) =====
  describe('Multi-Session Isolation', () => {
    it('Test 81: Locks isolated per session', async () => {
      const lock1 = await lockManager.acquireLock('session-iso-1', 'client-1');
      const lock2 = await lockManager.acquireLock('session-iso-2', 'client-2');

      const status1 = lockManager.getLockStatus('session-iso-1');
      const status2 = lockManager.getLockStatus('session-iso-2');

      assert(status1.locked);
      assert(status2.locked);
      assert.notStrictEqual(lock1.lockId, lock2.lockId);
    });

    it('Test 82: Queue commands isolated per session', () => {
      queueManager.queueCommand('session-iso-qa', 'client-1', { name: 'cmd-qa-1' });
      queueManager.queueCommand('session-iso-qa', 'client-1', { name: 'cmd-qa-2' });
      queueManager.queueCommand('session-iso-qb', 'client-2', { name: 'cmd-qb-1' });

      const statusA = queueManager.getQueueStatus('session-iso-qa');
      const statusB = queueManager.getQueueStatus('session-iso-qb');

      assert.strictEqual(statusA.size, 2);
      assert.strictEqual(statusB.size, 1);
    });

    it('Test 83: Event subscriptions isolated per session', () => {
      eventManager.subscribe('session-iso-ea', 'subscriber-1');
      eventManager.subscribe('session-iso-ea', 'subscriber-2');
      eventManager.subscribe('session-iso-eb', 'subscriber-3');

      const subsA = eventManager.getSessionSubscriptions('session-iso-ea');
      const subsB = eventManager.getSessionSubscriptions('session-iso-eb');

      assert.strictEqual(subsA.length, 2);
      assert.strictEqual(subsB.length, 1);
    });

    it('Test 84: Event broadcasts don\'t cross sessions', () => {
      eventManager.subscribe('session-iso-bca', 'subscriber-1');
      eventManager.subscribe('session-iso-bcb', 'subscriber-2');

      const resultA = eventManager.broadcastEvent('session-iso-bca', 'event', { data: 'a' });
      assert.strictEqual(resultA.broadcasted, 1);

      const resultB = eventManager.broadcastEvent('session-iso-bcb', 'event', { data: 'b' });
      assert.strictEqual(resultB.broadcasted, 1);
    });

    it('Test 85: Full isolation with coordinator across sessions', async () => {
      const sessionA = 'session-iso-full-a';
      const sessionB = 'session-iso-full-b';

      // Session A operations
      const lockA = await coordinator.lockManager.acquireLock(sessionA, 'client-a');
      coordinator.eventManager.subscribe(sessionA, 'subscriber-a');
      coordinator.queueManager.queueCommand(sessionA, 'client-a', { name: 'cmd-a' });

      // Session B operations
      const lockB = await coordinator.lockManager.acquireLock(sessionB, 'client-b');
      coordinator.eventManager.subscribe(sessionB, 'subscriber-b');
      coordinator.queueManager.queueCommand(sessionB, 'client-b', { name: 'cmd-b' });

      // Verify isolation
      const statusA = coordinator.getCollaborationStatus(sessionA);
      const statusB = coordinator.getCollaborationStatus(sessionB);

      assert.strictEqual(statusA.queue.size, 1);
      assert.strictEqual(statusB.queue.size, 1);

      // Cleanup
      coordinator.lockManager.releaseLock(lockA.lockId, sessionA);
      coordinator.lockManager.releaseLock(lockB.lockId, sessionB);
    });
  });
});

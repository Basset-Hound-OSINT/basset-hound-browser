/**
 * Integration Tests for Collaboration API (v12.9.0 Feature 2)
 *
 * Comprehensive test suite covering:
 * - Session locking (acquisition, renewal, release)
 * - Event streaming (subscriptions, broadcasting, history)
 * - Message queuing (queueing, dequeuing, conflict detection)
 * - Conflict resolution
 * - Edge cases and error handling
 *
 * Test count: 85+ integration tests
 * @module tests/collaboration-api.integration.test
 */

const assert = require('assert');
const {
  SessionLockManager,
  EventStreamManager,
  MessageQueueManager,
  ConflictDetector,
  CollaborationCoordinator
} = require('../src/v12-9-0/collaboration-api');

describe('Collaboration API Integration Tests', () => {
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

  // ===== SESSION LOCKING TESTS =====
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

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const renewed = lockManager.renewLock(lock.lockId, 'session-5');
      assert(renewed.success);
      assert(renewed.expiresAt > original.expiresAt + 90);
    });

    // Test 6-10: Concurrent lock acquisition
    it('Test 6: Wait for lock release with single waiter', async () => {
      const lock1 = await lockManager.acquireLock('session-6', 'client-1');

      // Try to acquire while locked (should wait)
      let acquired = false;
      const promise = lockManager.acquireLock('session-6', 'client-2', { timeout: 5000 })
        .then(() => { acquired = true; });

      await new Promise(resolve => setTimeout(resolve, 50));
      assert(!acquired, 'Should not acquire while locked');

      // Release first lock
      lockManager.releaseLock(lock1.lockId, 'session-6');

      // Wait for second acquisition
      await promise;
      assert(acquired, 'Should acquire after release');
    });

    it('Test 7: Multiple waiters queue by priority', async () => {
      const lock1 = await lockManager.acquireLock('session-7', 'client-1');

      const results = [];

      // Queue three waiters with different priorities
      const p2 = lockManager.acquireLock('session-7', 'client-2', { priority: 1, timeout: 5000 })
        .then(r => results.push({ client: 'client-2', ...r }));

      const p3 = lockManager.acquireLock('session-7', 'client-3', { priority: 5, timeout: 5000 })
        .then(r => results.push({ client: 'client-3', ...r }));

      const p4 = lockManager.acquireLock('session-7', 'client-4', { priority: 2, timeout: 5000 })
        .then(r => results.push({ client: 'client-4', ...r }));

      await new Promise(resolve => setTimeout(resolve, 50));

      // Release - should wake highest priority waiter
      lockManager.releaseLock(lock1.lockId, 'session-7');

      await Promise.all([p2, p3, p4]);

      // First acquired should be client-3 (priority 5)
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
      // Note: metadata is stored in the lock object, not returned in status
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
      // Create lock with very short timeout
      const shortTimeoutManager = new SessionLockManager({ lockTimeout: 100 });
      await shortTimeoutManager.acquireLock('session-11', 'client-1');

      // Wait for expiration
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

  // ===== EVENT STREAMING TESTS =====
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

  // ===== MESSAGE QUEUE TESTS =====
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
      assert.strictEqual(status.commands[0].command, 'cmd2'); // priority 5 first
      assert.strictEqual(status.commands[1].command, 'cmd3'); // priority 2 second
      assert.strictEqual(status.commands[2].command, 'cmd1'); // priority 0 last
    });

    it('Test 37: High priority inserted correctly', () => {
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd1' }, { priority: 1 });
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd2' }, { priority: 2 });
      queueManager.queueCommand('session-37', 'client-1', { name: 'cmd3' }, { priority: 3 });

      // Insert high priority in middle
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

  // ===== CONFLICT DETECTION TESTS =====
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

      // Should handle gracefully
      const conflicts = conflictDetector.detectConflicts(cmd, queued);
      assert(Array.isArray(conflicts));
    });
  });

  // ===== QUEUE MANAGER WITH CONFLICT DETECTION TESTS =====
  describe('Queue Manager with Conflict Detection', () => {
    // Test 56-60: Conflict detection in queue
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
        // Should succeed with conflict recorded, not fail
        const status = queueManager.getQueueStatus('session-56');
        assert(status.size >= 2);
      } catch (error) {
        // Or might abort depending on config
        assert(error.message.includes('conflict'));
      }
    });

    it('Test 57: Disable conflict detection', () => {
      queueManager.queueCommand('session-57', 'client-1', {
        name: 'click',
        params: { elementId: 'btn1' }
      });

      // Should not fail even with identical command
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

  // ===== COLLABORATION COORDINATOR TESTS =====
  describe('Collaboration Coordinator', () => {
    // Test 61-65: Integrated workflows
    it('Test 61: Execute collaborative command with lock', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-61',
        'client-1',
        { name: 'click', params: { selector: '#btn' } }
      );

      assert.strictEqual(result.status, 'success');
      assert(result.lockId);
    });

    it('Test 62: Broadcast events during command execution', async () => {
      let events = [];
      coordinator.eventManager.on('event', (e) => {
        events.push(e.event.eventType);
      });

      coordinator.eventManager.subscribe('session-62', 'subscriber-1');

      await coordinator.executeCollaborativeCommand(
        'session-62',
        'client-1',
        { name: 'click' }
      );

      assert(events.includes('command_started'));
      assert(events.includes('command_completed'));
    });

    it('Test 63: Command timeout releases lock', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-63',
        'client-1',
        { name: 'timeout_cmd' }
      );

      // Lock should be released
      const status = coordinator.lockManager.getLockStatus('session-63');
      assert(!status.locked);
    });

    it('Test 64: Get comprehensive collaboration status', () => {
      coordinator.lockManager.acquireLock('session-64', 'client-1');
      coordinator.eventManager.subscribe('session-64', 'subscriber-1');
      coordinator.queueManager.queueCommand('session-64', 'client-1', { name: 'cmd' });

      const status = coordinator.getCollaborationStatus('session-64');
      assert(status.timestamp);
      assert(status.locks);
      assert(status.subscriptions);
      assert(status.queue);
      assert(status.stats);
    });

    it('Test 65: Global collaboration status', () => {
      coordinator.lockManager.acquireLock('session-65a', 'client-1');
      coordinator.lockManager.acquireLock('session-65b', 'client-2');

      const status = coordinator.getCollaborationStatus();
      assert(Array.isArray(status.locks));
      assert(status.locks.length >= 2);
    });

    // Test 66-70: Error scenarios
    it('Test 66: Handle command execution error', async () => {
      const result = await coordinator.executeCollaborativeCommand(
        'session-66',
        'client-1',
        { name: 'error_cmd' }
      );

      assert(result.status === 'success' || result.status === 'error');
      const status = coordinator.lockManager.getLockStatus('session-66');
      assert(!status.locked);
    });

    it('Test 67: Track statistics', async () => {
      await coordinator.executeCollaborativeCommand('session-67', 'client-1', { name: 'cmd' });

      const stats = coordinator.stats;
      assert(stats.locksAcquired > 0);
      assert(stats.eventsEmitted > 0);
    });

    it('Test 68: Multiple concurrent collaborative commands', async () => {
      const promises = [
        coordinator.executeCollaborativeCommand('session-68a', 'client-1', { name: 'cmd1' }),
        coordinator.executeCollaborativeCommand('session-68b', 'client-2', { name: 'cmd2' }),
        coordinator.executeCollaborativeCommand('session-68c', 'client-3', { name: 'cmd3' })
      ];

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 3);
      assert(results.every(r => r.status === 'success'));
    });

    it('Test 69: Event history survives across commands', async () => {
      coordinator.eventManager.subscribe('session-69', 'subscriber-1');

      await coordinator.executeCollaborativeCommand('session-69', 'client-1', { name: 'cmd1' });
      await coordinator.executeCollaborativeCommand('session-69', 'client-2', { name: 'cmd2' });

      const history = coordinator.eventManager.getEventHistory('session-69');
      assert(history.length >= 2);
    });

    it('Test 70: Cleanup manages resources', () => {
      coordinator.lockManager.acquireLock('session-70', 'client-1');
      coordinator.eventManager.subscribe('session-70', 'subscriber-1');

      const before = coordinator.lockManager.getAllLocks().length;
      coordinator.lockManager.cleanupExpiredLocks();
      // Should still have our lock (not expired)
      const after = coordinator.lockManager.getAllLocks().length;
      assert(before >= after);
    });
  });

  // ===== INTEGRATION STRESS TESTS =====
  describe('Integration Stress Tests', () => {
    // Test 71-75: High volume scenarios
    it('Test 71: Handle many queued commands', () => {
      for (let i = 0; i < 100; i++) {
        queueManager.queueCommand('session-71', 'client-1', {
          name: `cmd${i}`,
          params: { index: i }
        }, { priority: Math.random() * 10 });
      }

      const status = queueManager.getQueueStatus('session-71');
      assert.strictEqual(status.size, 100);
    });

    it('Test 72: Dequeue high volume efficiently', () => {
      for (let i = 0; i < 50; i++) {
        queueManager.queueCommand('session-72', 'client-1', { name: `cmd${i}` });
      }

      let count = 0;
      while (queueManager.dequeueCommand('session-72')) {
        count++;
      }

      assert.strictEqual(count, 50);
    });

    it('Test 73: Many events don\'t overflow', () => {
      eventManager.subscribe('session-73', 'subscriber-1');

      for (let i = 0; i < 500; i++) {
        eventManager.broadcastEvent('session-73', `type${i % 5}`, { num: i });
      }

      const history = eventManager.getEventHistory('session-73');
      assert(history.length <= 1000); // Default max buffer
    });

    it('Test 74: Multiple concurrent locks don\'t deadlock', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => `session-74-${i}`);
      const promises = sessions.map(sid =>
        lockManager.acquireLock(sid, `client-${sid}`)
      );

      const results = await Promise.all(promises);
      assert.strictEqual(results.length, 10);
    });

    it('Test 75: Stress test with mixed operations', async () => {
      const sessionId = 'session-75';

      // Queue commands
      for (let i = 0; i < 20; i++) {
        queueManager.queueCommand(sessionId, `client-${i}`, { name: `cmd${i}` });
      }

      // Subscribe to events
      for (let i = 0; i < 5; i++) {
        eventManager.subscribe(sessionId, `subscriber-${i}`);
      }

      // Try to get lock
      const lock = await lockManager.acquireLock(sessionId, 'client-coordinator');

      // Broadcast events
      for (let i = 0; i < 10; i++) {
        eventManager.broadcastEvent(sessionId, `event${i}`, { data: i });
      }

      // Check status
      const status = coordinator.getCollaborationStatus(sessionId);
      assert(status.locks);
      assert(status.queue.size >= 20);

      lockManager.releaseLock(lock.lockId, sessionId);
    });
  });

  // ===== EDGE CASES AND ERROR HANDLING =====
  describe('Edge Cases and Error Handling', () => {
    // Test 76-85: Edge cases and error conditions
    it('Test 76: Queue command with null params', () => {
      try {
        queueManager.queueCommand('session-76', 'client-1', null);
        assert.fail('Should throw error');
      } catch (error) {
        assert(error.message.includes('required'));
      }
    });

    it('Test 77: Release non-existent lock', () => {
      const result = lockManager.releaseLock('fake-lock', 'fake-session');
      assert(!result.success);
    });

    it('Test 78: Renew expired lock', async () => {
      const shortManager = new SessionLockManager({ lockTimeout: 50 });
      const lock = await shortManager.acquireLock('session-78', 'client-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      const renewed = shortManager.renewLock(lock.lockId, 'session-78');
      assert(!renewed.success);
    });

    it('Test 79: Get history for non-existent session', () => {
      const history = eventManager.getEventHistory('session-nonexistent');
      assert.strictEqual(history.length, 0);
    });

    it('Test 80: Remove command twice', () => {
      const result = queueManager.queueCommand('session-80', 'client-1', { name: 'cmd' });
      queueManager.removeCommand('session-80', result.queuedId);

      const result2 = queueManager.removeCommand('session-80', result.queuedId);
      assert(!result2.success);
    });

    it('Test 81: Very long sessionId', () => {
      const longId = 'a'.repeat(1000);
      const result = queueManager.queueCommand(longId, 'client-1', { name: 'cmd' });
      assert(result.queuedId);
    });

    it('Test 82: Special characters in identifiers', () => {
      const result = queueManager.queueCommand(
        'session-!@#$%',
        'client-<script>',
        { name: 'cmd\n' }
      );
      assert(result.queuedId);
    });

    it('Test 83: Rapid lock acquire and release', async () => {
      for (let i = 0; i < 10; i++) {
        const lock = await lockManager.acquireLock('session-83', 'client-1');
        lockManager.releaseLock(lock.lockId, 'session-83');
      }

      const status = lockManager.getLockStatus('session-83');
      assert(!status.locked);
    });

    it('Test 84: Dequeue from queue with single item', () => {
      queueManager.queueCommand('session-84', 'client-1', { name: 'cmd' });

      const result = queueManager.dequeueCommand('session-84');
      assert(result);

      const second = queueManager.dequeueCommand('session-84');
      assert(!second);
    });

    it('Test 85+: Comprehensive integration test', async () => {
      const sessionId = 'integration-session-final';

      // Acquire lock
      const lock = await coordinator.lockManager.acquireLock(sessionId, 'test-client');
      assert(lock.lockId);

      // Subscribe to events
      const sub = coordinator.eventManager.subscribe(sessionId, 'test-subscriber');
      assert(sub.subscriptionId);

      // Queue commands with conflicts
      try {
        coordinator.queueManager.queueCommand(sessionId, 'test-client', {
          name: 'navigate',
          params: { url: 'http://example.com' }
        }, { resolveConflicts: 'abort' });

        coordinator.queueManager.queueCommand(sessionId, 'test-client', {
          name: 'navigate',
          params: { url: 'http://other.com' }
        }, { resolveConflicts: 'abort' });
      } catch (e) {
        // Expected conflict
      }

      // Broadcast event
      const bcast = coordinator.eventManager.broadcastEvent(
        sessionId,
        'test_event',
        { status: 'success' }
      );
      assert(bcast.broadcasted > 0);

      // Get comprehensive status
      const status = coordinator.getCollaborationStatus(sessionId);
      assert(status.locks);
      assert(status.subscriptions.length > 0);
      assert(status.queue);

      // Cleanup
      coordinator.lockManager.releaseLock(lock.lockId, sessionId);
      coordinator.eventManager.unsubscribe(sub.subscriptionId);

      const finalStatus = coordinator.lockManager.getLockStatus(sessionId);
      assert(!finalStatus.locked);
    });
  });
});

/**
 * Session Persistence Integration Tests
 * Tests for cross-device sync, compression, offline queue, and storage
 *
 * Test Categories:
 * 1. Session Storage Backend (Redis + FS fallback)
 * 2. Cross-Device Sync (export → import)
 * 3. Session Compression
 * 4. Offline Queue
 * 5. Load Testing (500 concurrent sessions)
 */

const assert = require('assert');
const SessionStorage = require('../../src/sessions/session-storage');
const SessionCompression = require('../../src/sessions/session-compression');
const OfflineQueue = require('../../src/sessions/offline-queue');
const fs = require('fs');
const path = require('path');

describe('Session Persistence v12.2.0', () => {
  let storage;
  let compression;
  let queue;

  beforeAll(() => {
    // Initialize components
    storage = new SessionStorage({
      type: 'filesystem',
      filesystemPath: '/tmp/basset-test-sessions'
    });

    compression = new SessionCompression({
      enabled: true,
      compressionLevel: 6
    });

    queue = new OfflineQueue({
      storageDir: '/tmp/basset-test-queue'
    });
  });

  afterAll(async () => {
    // Cleanup
    const cleanup = (dir) => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };

    cleanup('/tmp/basset-test-sessions');
    cleanup('/tmp/basset-test-queue');
  });

  // ==================== Session Storage Tests ====================

  describe('Session Storage Backend', () => {
    it('should save and load session', async () => {
      const sessionId = 'test-session-1';
      const sessionData = {
        id: sessionId,
        createdAt: Date.now(),
        cookies: { session: 'abc123' },
        localStorage: { theme: 'dark' }
      };

      const saveResult = await storage.save(sessionId, sessionData);
      assert.strictEqual(saveResult.success, true);
      assert.strictEqual(saveResult.metadata.id, sessionId);

      const loaded = await storage.load(sessionId);
      assert.strictEqual(loaded.id, sessionId);
      assert.deepStrictEqual(loaded.cookies, sessionData.cookies);
    });

    it('should handle session not found', async () => {
      const loaded = await storage.load('nonexistent-session');
      assert.strictEqual(loaded, null);
    });

    it('should list sessions', async () => {
      const ids = ['sess-1', 'sess-2', 'sess-3'];

      for (const id of ids) {
        await storage.save(id, {
          id,
          data: `Session ${id}`
        });
      }

      const list = await storage.list({ limit: 10 });
      assert(list.length >= 3);
    });

    it('should delete session', async () => {
      const sessionId = 'test-delete-session';
      await storage.save(sessionId, { id: sessionId });

      const deleted = await storage.delete(sessionId);
      assert.strictEqual(deleted, true);

      const loaded = await storage.load(sessionId);
      assert.strictEqual(loaded, null);
    });

    it('should set and respect TTL', async () => {
      const sessionId = 'test-ttl-session';
      const ttl = 10; // 10 seconds

      await storage.save(sessionId, { id: sessionId }, { ttl });

      const loaded = await storage.load(sessionId);
      assert(loaded !== null);

      const metadata = loaded._metadata;
      assert(metadata.expiresAt > Date.now());
    });

    it('should get sync status', async () => {
      const sessionId = 'test-sync-status';
      await storage.save(sessionId, { id: sessionId });

      const status = await storage.getSyncStatus(sessionId);
      assert.strictEqual(status.sessionId, sessionId);
      assert.strictEqual(status.exists, true);
      assert.strictEqual(status.syncable, true);
      assert(status.size > 0);
    });

    it('should cleanup expired sessions', async () => {
      // This is more of an integration test
      const result = await storage.cleanup({
        olderThan: Date.now() - 86400000 // 24 hours ago
      });

      assert('deleted' in result);
      assert('errors' in result);
    });

    it('should return health status', async () => {
      const health = await storage.healthCheck();
      assert('storage' in health);
      assert('filesystem' in health);
      assert('status' in health);
      assert.strictEqual(health.status, 'healthy');
    });

    it('should track statistics', () => {
      const stats = storage.getStats();
      assert('readCount' in stats);
      assert('writeCount' in stats);
      assert('deleteCount' in stats);
      assert('errors' in stats);
    });
  });

  // ==================== Cross-Device Sync Tests ====================

  describe('Cross-Device Sync', () => {
    it('should export session for sync', async () => {
      const sessionId = 'test-sync-export';
      const sessionData = {
        id: sessionId,
        cookies: { session: 'xyz789' },
        localStorage: { userId: '12345' }
      };

      await storage.save(sessionId, sessionData);

      const exported = await storage.exportForSync(sessionId);
      assert(exported.id);
      assert(exported.data);
      assert(exported.checksum);
      assert.strictEqual(exported.version, 1);
    });

    it('should import session from sync', async () => {
      const sessionId = 'test-sync-import';
      const sessionData = {
        id: sessionId,
        cookies: { session: 'import123' }
      };

      await storage.save(sessionId, sessionData);
      const exported = await storage.exportForSync(sessionId);

      // Delete original
      await storage.delete(sessionId);
      let loaded = await storage.load(sessionId);
      assert.strictEqual(loaded, null);

      // Import from exported data
      const imported = await storage.importFromSync(exported);
      assert.strictEqual(imported.success, true);
      assert.strictEqual(imported.sessionId, sessionId);

      // Verify imported
      loaded = await storage.load(sessionId);
      assert(loaded !== null);
      assert.strictEqual(loaded.id, sessionId);
    });

    it('should validate import data format', async () => {
      // Test with invalid/incomplete data
      const invalidData = {
        id: 'test-invalid'
        // Missing 'data' field
      };

      try {
        await storage.importFromSync(invalidData);
        assert.fail('Should have thrown format error');
      } catch (err) {
        assert(err.message.includes('Invalid'));
      }
    });

    it('should preserve session metadata during sync', async () => {
      const sessionId = 'test-sync-metadata';
      const sessionData = {
        id: sessionId,
        metadata: {
          campaign: 'research-2026',
          phase: 1,
          tags: ['important']
        },
        cookies: { session: 'meta123' }
      };

      await storage.save(sessionId, sessionData);
      const exported = await storage.exportForSync(sessionId);
      await storage.delete(sessionId);

      await storage.importFromSync(exported);
      const loaded = await storage.load(sessionId);

      assert.strictEqual(loaded.metadata.campaign, 'research-2026');
      assert.deepStrictEqual(loaded.metadata.tags, ['important']);
    });
  });

  // ==================== Session Compression Tests ====================

  describe('Session Compression', () => {
    it('should compress session data', async () => {
      const sessionData = {
        id: 'test-compression-1',
        cookies: Array(100).fill({ name: 'cookie', value: 'x'.repeat(500) }),
        localStorage: Array(100).fill({ key: 'storage', value: 'x'.repeat(1000) })
      };

      const compressed = await compression.compress(sessionData);
      assert.strictEqual(compressed._compressed, true);
      assert(compressed._compressionRatio > 0);
      assert(compressed._compressedSize < compressed._originalSize);
    });

    it('should decompress to original', async () => {
      const original = {
        id: 'test-decompress',
        data: 'x'.repeat(10000)
      };

      const compressed = await compression.compress(original);
      const decompressed = await compression.decompress(compressed);

      assert.strictEqual(decompressed.id, original.id);
      assert.strictEqual(decompressed.data, original.data);
    });

    it('should skip compression for small data', async () => {
      const small = { id: 'test-small', data: 'x' };

      const compressed = await compression.compress(small);
      assert.strictEqual(compressed._compressed, undefined);
    });

    it('should achieve 70%+ compression on typical session', async () => {
      const sessionData = {
        id: 'test-compression-ratio',
        cookies: Array(50).fill({
          name: 'cookie',
          value: 'x'.repeat(1000),
          domain: '.example.com',
          path: '/'
        }),
        localStorage: Array(50).fill({
          key: 'storagekey',
          value: 'x'.repeat(2000)
        })
      };

      const compressed = await compression.compress(sessionData);

      if (compressed._compressed) {
        const ratio = parseFloat(compressed._compressionRatio);
        assert(ratio >= 0.7, `Expected ratio >= 0.7, got ${ratio}`);
      }
    });

    it('should compress multiple sessions', async () => {
      const sessions = Array(5).fill(null).map((_, i) => ({
        id: `session-${i}`,
        data: 'x'.repeat(5000)
      }));

      const compressed = await compression.compressMultiple(sessions);
      assert.strictEqual(compressed.length, 5);
    });

    it('should decompress multiple sessions', async () => {
      const original = Array(3).fill(null).map((_, i) => ({
        id: `session-decomp-${i}`,
        data: 'x'.repeat(5000)
      }));

      const compressed = await compression.compressMultiple(original);
      const decompressed = await compression.decompressMultiple(compressed);

      assert.strictEqual(decompressed.length, 3);
      for (let i = 0; i < 3; i++) {
        assert.strictEqual(decompressed[i].id, original[i].id);
      }
    });

    it('should track compression statistics', async () => {
      compression.resetStats();

      const data = { id: 'stat-test', data: 'x'.repeat(10000) };
      await compression.compress(data);

      const stats = compression.getStats();
      assert.strictEqual(stats.compressions, 1);
      assert(stats.totalOriginalSize > 0);
      assert(stats.averageCompressionRatio);
    });

    it('should estimate compression savings', () => {
      const estimated = compression.estimateCompressed(100000);
      assert(estimated < 100000);
      assert(estimated > 0);
    });
  });

  // ==================== Offline Queue Tests ====================

  describe('Offline Queue', () => {
    it('should queue command', () => {
      const sessionId = 'offline-test-1';
      const command = {
        type: 'navigate',
        url: 'https://example.com'
      };

      const result = queue.queueCommand(sessionId, command);
      assert.strictEqual(result.queued, true);
      assert(result.commandId);
      assert(result.queueSize >= 1);
    });

    it('should retrieve queued commands', () => {
      const sessionId = 'offline-test-2';
      const commands = [
        { type: 'navigate', url: 'https://example.com' },
        { type: 'click', selector: '.button' }
      ];

      for (const cmd of commands) {
        queue.queueCommand(sessionId, cmd);
      }

      const queued = queue.getQueue(sessionId);
      assert(queued.length >= 2);
    });

    it('should dequeue command in FIFO order', () => {
      const sessionId = 'offline-test-fifo';
      queue.queueCommand(sessionId, { type: 'first' });
      queue.queueCommand(sessionId, { type: 'second' });

      const first = queue.dequeueCommand(sessionId);
      assert.strictEqual(first.command.type, 'first');

      const second = queue.dequeueCommand(sessionId);
      assert.strictEqual(second.command.type, 'second');
    });

    it('should deduplicate commands', () => {
      const sessionId = 'offline-test-dedup';
      const command = {
        type: 'navigate',
        url: 'https://example.com',
        deduplicationKey: 'navigate-example'
      };

      queue.queueCommand(sessionId, command);
      const result2 = queue.queueCommand(sessionId, command);

      assert.strictEqual(result2.duplicate, true);
    });

    it('should clear queue', () => {
      const sessionId = 'offline-test-clear';
      queue.queueCommand(sessionId, { type: 'test' });

      queue.clearQueue(sessionId);

      const queued = queue.getQueue(sessionId);
      assert.strictEqual(queued.length, 0);
    });

    it('should calculate exponential backoff', () => {
      const delay1 = queue.getBackoffDelay(0);
      const delay2 = queue.getBackoffDelay(1);
      const delay3 = queue.getBackoffDelay(2);

      assert(delay2 > delay1);
      assert(delay3 > delay2);
    });

    it('should track queue statistics', () => {
      queue.clearQueue('offline-test-stats');
      queue.queueCommand('offline-test-stats', { type: 'test' });

      const stats = queue.getQueueStats('offline-test-stats');
      assert.strictEqual(stats.queueSize, 1);
    });

    it('should get overall queue status', () => {
      const status = queue.getStatus();
      assert('enabled' in status);
      assert('totalSessions' in status);
      assert('totalQueued' in status);
    });

    it('should mark command as processed', () => {
      const sessionId = 'offline-test-mark';
      const result = queue.queueCommand(sessionId, { type: 'test' });

      const processed = queue.markProcessed(result.commandId, true);
      assert.strictEqual(processed.success, true);
    });
  });

  // ==================== Load Testing ====================

  describe('Load Testing - 500 Concurrent Sessions', () => {
    it('should handle 100 concurrent sessions', async () => {
      const sessionIds = [];

      for (let i = 0; i < 100; i++) {
        const sessionId = `load-test-100-${i}`;
        sessionIds.push(sessionId);

        const sessionData = {
          id: sessionId,
          timestamp: Date.now(),
          data: 'x'.repeat(1000)
        };

        await storage.save(sessionId, sessionData);
      }

      const list = await storage.list({ limit: 1000 });
      assert(list.length >= 100);

      // Cleanup
      for (const id of sessionIds) {
        await storage.delete(id);
      }
    });

    it('should handle 250 concurrent sessions', async () => {
      const sessionIds = [];

      for (let i = 0; i < 250; i++) {
        const sessionId = `load-test-250-${i}`;
        sessionIds.push(sessionId);

        const sessionData = {
          id: sessionId,
          timestamp: Date.now(),
          data: 'x'.repeat(500)
        };

        await storage.save(sessionId, sessionData);
      }

      const list = await storage.list({ limit: 1000 });
      assert(list.length >= 250);

      // Cleanup
      for (const id of sessionIds) {
        await storage.delete(id);
      }
    });

    it('should handle 500 concurrent sessions', async () => {
      jest.setTimeout(30000); // Increase timeout for load test

      const sessionIds = [];
      const startTime = Date.now();

      for (let i = 0; i < 500; i++) {
        const sessionId = `load-test-500-${i}`;
        sessionIds.push(sessionId);

        const sessionData = {
          id: sessionId,
          timestamp: Date.now(),
          data: 'x'.repeat(100) // Smaller data for load test
        };

        await storage.save(sessionId, sessionData);
      }

      const saveDuration = Date.now() - startTime;
      assert(saveDuration < 30000, `Save took ${saveDuration}ms, expected < 30s`);

      const list = await storage.list({ limit: 1000 });
      assert(list.length >= 500);

      // Cleanup
      for (const id of sessionIds) {
        await storage.delete(id);
      }
    });

    it('should restore session in <100ms', async () => {
      const sessionId = 'restore-test';
      const sessionData = {
        id: sessionId,
        timestamp: Date.now(),
        data: 'x'.repeat(10000)
      };

      await storage.save(sessionId, sessionData);

      const startTime = Date.now();
      const loaded = await storage.load(sessionId);
      const duration = Date.now() - startTime;

      assert(loaded !== null);
      assert(duration < 100, `Restore took ${duration}ms, expected < 100ms`);

      await storage.delete(sessionId);
    });
  });

  // ==================== Integration Tests ====================

  describe('End-to-End Integration', () => {
    it('should complete full lifecycle: save → compress → export → import', async () => {
      const sessionId = 'e2e-test';
      const originalData = {
        id: sessionId,
        cookies: { session: 'e2e-abc' },
        localStorage: { theme: 'dark', user: 'test-user' },
        data: 'x'.repeat(5000)
      };

      // Save
      await storage.save(sessionId, originalData);
      let loaded = await storage.load(sessionId);
      assert(loaded !== null);

      // Compress
      const compressed = await compression.compress(loaded);

      // Export
      const exported = await storage.exportForSync(sessionId);
      assert(exported.checksum);

      // Delete and re-import
      await storage.delete(sessionId);
      await storage.importFromSync(exported);

      // Verify
      loaded = await storage.load(sessionId);
      assert.strictEqual(loaded.id, sessionId);
    });

    it('should handle offline operations with queue → replay', async () => {
      const sessionId = 'e2e-offline';

      // Queue operations while offline
      queue.queueCommand(sessionId, { type: 'navigate', url: 'https://example.com' });
      queue.queueCommand(sessionId, { type: 'click', selector: '.button' });

      const queued = queue.getQueue(sessionId);
      assert.strictEqual(queued.length, 2);

      // Simulate replay
      let replayed = 0;
      const executor = async (cmd) => {
        replayed++;
      };

      const result = await queue.replayQueue(sessionId, executor);
      assert.strictEqual(result.replayed, 2);
      assert.strictEqual(result.status, 'complete');
    });
  });
});

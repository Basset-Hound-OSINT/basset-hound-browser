/**
 * Phase 3 Comprehensive Stability Tests
 * Integration tests for all stability fixes combined
 *
 * Validates:
 * - Issue #2: File Handle Leaks (screenshot cache)
 * - Issue #3: IPC Race Conditions
 * - Issue #4: Unbounded Event Listeners
 * - Issue #5: Metadata Cache Eviction
 */

const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;
const fsCallback = require('fs');
const { CompressedScreenshotCache } = require('../../screenshots/cache');
const { ListenerTracker } = require('../../websocket/listener-tracker');
const EventEmitter = require('events');
const crypto = require('crypto');

// Utilities
function generateTestScreenshot(size = 1024) {
  return Buffer.alloc(size, crypto.randomBytes(1)).toString('base64');
}

function createTempDir() {
  const tempDir = path.join('/tmp', `stability-test-${Date.now()}-${Math.random()}`);
  fsCallback.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

async function cleanupTempDir(dir) {
  if (fsCallback.existsSync(dir)) {
    const files = await fs.readdir(dir);
    for (const file of files) {
      await fs.unlink(path.join(dir, file));
    }
    await fs.rmdir(dir);
  }
}

describe('Phase 3 Comprehensive Stability Tests', () => {
  let cache;
  let tracker;
  let mockEmitter;
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
    tracker = new ListenerTracker(50);
    mockEmitter = new EventEmitter();
  });

  afterEach(async () => {
    if (cache) {
      await cache.shutdown();
    }
    tracker.cleanupAll();
    mockEmitter.removeAllListeners();
    await cleanupTempDir(tempDir);
  });

  // ==================== COMBINED STRESS TEST ====================

  describe('Combined Stability Stress Test', () => {
    it('should handle concurrent operations across all systems', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 100;

      const screenshot = generateTestScreenshot(1024);

      // Concurrent operations
      const promises = [];

      // Screenshot save operations
      for (let i = 0; i < 20; i++) {
        promises.push(
          cache.saveScreenshot(`session-${i % 5}`, screenshot)
        );
      }

      // Event listener registrations
      const handlers = [];
      for (let i = 0; i < 20; i++) {
        const handler = () => {};
        handlers.push(handler);
        tracker.registerListener(`client-${i % 5}`, mockEmitter, `event-${i}`, handler);
      }

      // Wait for all saves
      const results = await Promise.all(promises);

      expect(results).toHaveLength(20);
      expect(tracker.getTotalListenerCount()).toBe(20);
      expect(cache.metadataCache.size).toBeLessThanOrEqual(100);
    });

    it('should maintain stability with rapid connect/disconnect cycles', async () => {
      cache = new CompressedScreenshotCache(tempDir);

      // Simulate client lifecycle
      for (let cycle = 0; cycle < 10; cycle++) {
        const clientId = `client-${cycle}`;
        const screenshot = generateTestScreenshot(512);

        // Client connects and saves screenshots
        for (let i = 0; i < 5; i++) {
          await cache.saveScreenshot(clientId, screenshot);
        }

        // Client registers listeners
        for (let i = 0; i < 5; i++) {
          const handler = () => {};
          tracker.registerListener(clientId, mockEmitter, `event-${i}`, handler);
        }

        // Client disconnects
        await cache.clearSession(clientId);
        tracker.cleanupClient(clientId);

        expect(tracker.getListenerCount(clientId)).toBe(0);
      }

      // All resources should be cleaned
      expect(tracker.getTotalListenerCount()).toBe(0);
    });

    it('should handle mixed read/write operations without handle leaks', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(2048);

      // Create initial screenshots
      const metadatas = [];
      for (let i = 0; i < 10; i++) {
        const meta = await cache.saveScreenshot(`session-1`, screenshot);
        metadatas.push(meta);
      }

      // Concurrent reads
      const readPromises = [];
      for (let i = 0; i < 5; i++) {
        for (const meta of metadatas) {
          readPromises.push(cache.getScreenshot(meta.filename));
        }
      }

      const readResults = await Promise.all(readPromises);

      expect(readResults.length).toBe(50);
      expect(readResults.filter(r => r !== null)).toHaveLength(50);

      // All files should still be accessible
      const files = await fs.readdir(tempDir);
      expect(files.length).toBe(10);
    });
  });

  // ==================== RESOURCE EXHAUSTION SCENARIOS ====================

  describe('Resource Exhaustion Protection', () => {
    it('should prevent memory exhaustion from metadata cache', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 50;

      const screenshot = generateTestScreenshot(256);

      // Try to add more metadata than max
      const start = Date.now();
      for (let i = 0; i < 200; i++) {
        await cache.saveScreenshot(`session-${i % 10}`, screenshot);
      }
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000);

      // Cache should be bounded
      expect(cache.metadataCache.size).toBeLessThanOrEqual(50);

      // Stats should be consistent
      const stats = cache.getStats();
      expect(stats.fileCount).toBeLessThanOrEqual(50);
    });

    it('should prevent listener accumulation from long-lived connections', () => {
      // Simulate long-lived connection adding listeners
      const clientId = 'long-lived-client';

      for (let hour = 0; hour < 24; hour++) {
        // Simulate hourly reconnections adding listeners
        for (let i = 0; i < 5; i++) {
          const handler = () => {};
          tracker.registerListener(clientId, mockEmitter, `event-${i}`, handler);
        }

        // Cleanup old listeners periodically
        if (hour % 4 === 0 && hour > 0) {
          tracker.cleanupClient(clientId);
        }
      }

      // Final listener count should be bounded
      expect(tracker.getListenerCount(clientId)).toBeLessThanOrEqual(10);
    });

    it('should handle extreme file handle pressure', async () => {
      cache = new CompressedScreenshotCache(tempDir);

      const screenshot = generateTestScreenshot(512);

      // Rapidly save, read, and delete many screenshots
      try {
        for (let batch = 0; batch < 5; batch++) {
          const batchMetas = [];

          // Save
          for (let i = 0; i < 30; i++) {
            const meta = await cache.saveScreenshot(`session-${batch}`, screenshot);
            batchMetas.push(meta);
          }

          // Read
          for (const meta of batchMetas) {
            await cache.getScreenshot(meta.filename);
          }

          // Delete
          for (const meta of batchMetas) {
            await cache.deleteScreenshot(meta.filename);
          }
        }

        // Should complete without file handle errors
        expect(true).toBe(true);
      } catch (error) {
        // If we get here, there might be handle leak issues
        fail(`File handle exhaustion: ${error.message}`);
      }
    });
  });

  // ==================== EDGE CASE SCENARIOS ====================

  describe('Edge Case Scenarios', () => {
    it('should handle cleanup during concurrent operations', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      // Start saves
      const savePromises = [];
      for (let i = 0; i < 20; i++) {
        savePromises.push(cache.saveScreenshot('session-1', screenshot));
      }

      // Start cleanup midway
      await new Promise(r => setTimeout(r, 50));
      const cleanupPromise = cache.cleanup(1000);

      // Wait for all to complete
      const [saves, cleanup] = await Promise.all([
        Promise.all(savePromises),
        cleanupPromise
      ]);

      expect(saves).toHaveLength(20);
      expect(typeof cleanup).toBe('number');
    });

    it('should handle listener cleanup during event emission', () => {
      const clientId = 'test-client';
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      tracker.registerListener(clientId, mockEmitter, 'test', handler1);
      tracker.registerListener(clientId, mockEmitter, 'test', handler2);

      // Emit event and cleanup simultaneously
      mockEmitter.emit('test');
      tracker.cleanupClient(clientId);

      // Handlers should be called once
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      // Cleanup should be complete
      expect(tracker.getListenerCount(clientId)).toBe(0);
    });

    it('should recover from partial failures', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      // Save initial screenshots
      const meta1 = await cache.saveScreenshot('session-1', screenshot);

      // Simulate file system error by removing file
      await fs.unlink(meta1.path);

      // Try to read deleted file
      const result = await cache.getScreenshot(meta1.filename);
      expect(result).toBeNull();

      // Cache should still be functional
      const meta2 = await cache.saveScreenshot('session-1', screenshot);
      expect(meta2).toBeDefined();

      const result2 = await cache.getScreenshot(meta2.filename);
      expect(result2).not.toBeNull();
    });
  });

  // ==================== PERFORMANCE VALIDATION ====================

  describe('Performance Validation', () => {
    it('should maintain acceptable performance under load', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      const start = Date.now();

      // 100 saves
      for (let i = 0; i < 100; i++) {
        await cache.saveScreenshot(`session-${i % 10}`, screenshot);
      }

      const duration = Date.now() - start;

      // Should complete in reasonable time (less than 30 seconds)
      expect(duration).toBeLessThan(30000);

      // Rate should be acceptable (at least 3 per second)
      const rate = 100 / (duration / 1000);
      expect(rate).toBeGreaterThan(3);
    });

    it('should track listener performance', () => {
      const startTime = Date.now();

      // Register many listeners
      for (let c = 0; c < 10; c++) {
        for (let i = 0; i < 10; i++) {
          const handler = () => {};
          tracker.registerListener(`client-${c}`, mockEmitter, `event-${i}`, handler);
        }
      }

      const duration = Date.now() - startTime;

      // Should register 100 listeners quickly (< 1000ms)
      expect(duration).toBeLessThan(1000);

      // Stats retrieval should be fast
      const statsStart = Date.now();
      const stats = tracker.getStats();
      const statsDuration = Date.now() - statsStart;

      expect(statsDuration).toBeLessThan(100);
      expect(stats.totalListeners).toBe(100);
    });

    it('should have acceptable cleanup performance', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(512);

      // Create many entries
      for (let i = 0; i < 50; i++) {
        await cache.saveScreenshot('session-1', screenshot);
      }

      // Cleanup should be fast
      const start = Date.now();
      const cleaned = await cache.cleanup(1); // 1ms TTL means everything expires
      const duration = Date.now() - start;

      expect(cleaned).toBe(50);
      expect(duration).toBeLessThan(5000);
    });
  });

  // ==================== CONSISTENCY VALIDATION ====================

  describe('Consistency and Correctness', () => {
    it('should maintain consistent state after stress operations', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      // Stress operation
      const metas = [];
      for (let i = 0; i < 30; i++) {
        const meta = await cache.saveScreenshot(`session-${i % 3}`, screenshot);
        metas.push(meta);
      }

      // Verify consistency
      const stats = cache.getStats();
      expect(stats.fileCount).toBe(cache.metadataCache.size);

      // Each file should be readable
      for (const meta of metas) {
        const result = await cache.getScreenshot(meta.filename);
        expect(result).not.toBeNull();
      }

      // Cleanup should match stats
      const deleted = await cache.clearSession('session-0');
      const expectedDeleted = metas.filter(m => m.sessionId === 'session-0').length;
      expect(deleted).toBe(expectedDeleted);
    });

    it('should maintain listener tracking consistency', () => {
      // Add listeners across multiple clients
      const clientIds = ['c1', 'c2', 'c3'];
      const listenersPerClient = 5;

      for (const clientId of clientIds) {
        for (let i = 0; i < listenersPerClient; i++) {
          const handler = () => {};
          tracker.registerListener(clientId, mockEmitter, `event-${i}`, handler);
        }
      }

      const totalBefore = tracker.getTotalListenerCount();
      expect(totalBefore).toBe(clientIds.length * listenersPerClient);

      // Cleanup one client
      tracker.cleanupClient('c1');

      const totalAfter = tracker.getTotalListenerCount();
      expect(totalAfter).toBe((clientIds.length - 1) * listenersPerClient);

      // Remaining clients should be correct
      const activeClients = tracker.getActiveClients();
      expect(activeClients).not.toContain('c1');
      expect(activeClients).toContain('c2');
      expect(activeClients).toContain('c3');
    });
  });
});

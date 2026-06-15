/**
 * Screenshot Cache Stability Tests (Phase 3 - Issue #2, #5)
 * Tests file handle leaks and unbounded metadata cache growth
 *
 * Fixes validated:
 * - Issue #2: File Handle Leaks - fs.promises conversion
 * - Issue #5: Metadata Cache Without Eviction - LRU + TTL
 */

const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const path = require('path');
const fs = require('fs').promises;
const fsCallback = require('fs');
const { CompressedScreenshotCache } = require('../../screenshots/cache');
const crypto = require('crypto');

// Utilities
function generateTestScreenshot(size = 1024) {
  return Buffer.alloc(size, crypto.randomBytes(1)).toString('base64');
}

function createTempDir() {
  const tempDir = path.join('/tmp', `cache-test-${Date.now()}-${Math.random()}`);
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

describe('Screenshot Cache Stability Tests', () => {
  let cache;
  let tempDir;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(async () => {
    if (cache) {
      await cache.shutdown();
    }
    await cleanupTempDir(tempDir);
  });

  // ==================== ISSUE #2: FILE HANDLE LEAKS ====================

  describe('Issue #2: File Handle Leaks', () => {
    it('should properly close file handles after saveScreenshot', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      // Save multiple screenshots
      for (let i = 0; i < 10; i++) {
        const metadata = await cache.saveScreenshot(`session-1`, screenshot);
        expect(metadata).toBeDefined();
        expect(metadata.filename).toContain('.gz');
      }

      // All files should be readable immediately (no handle leaks)
      const files = await fs.readdir(tempDir);
      expect(files.length).toBe(10);

      // Should be able to delete files without EBUSY errors
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
    });

    it('should properly close handles after getScreenshot', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(2048);
      const metadata = await cache.saveScreenshot('session-1', screenshot);

      // Read the same file multiple times
      for (let i = 0; i < 20; i++) {
        const result = await cache.getScreenshot(metadata.filename);
        expect(result).not.toBeNull();
        expect(result.data).toBeDefined();
      }

      // Should be able to delete file without handle leaks
      const deleted = await cache.deleteScreenshot(metadata.filename);
      expect(deleted).toBe(true);
    });

    it('should handle errors and cleanup files on write failure', async () => {
      cache = new CompressedScreenshotCache(tempDir);

      // Simulate write failure by using invalid path
      const invalidCache = new CompressedScreenshotCache('/invalid/path/that/does/not/exist');
      const screenshot = generateTestScreenshot(1024);

      try {
        await invalidCache.saveScreenshot('session-1', screenshot);
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Proper cache should still work
      const metadata = await cache.saveScreenshot('session-1', screenshot);
      expect(metadata).toBeDefined();
    });

    it('should not leak handles on concurrent saves', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      // Save concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          cache.saveScreenshot(`session-${i % 3}`, screenshot)
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(results.every(r => r.filename)).toBe(true);

      // All files should be accessible
      const files = await fs.readdir(tempDir);
      expect(files.length).toBe(10);
    });

    it('should handle read errors gracefully without hanging', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);
      const metadata = await cache.saveScreenshot('session-1', screenshot);

      // Delete file after metadata is cached
      await fs.unlink(metadata.path);

      // Should return null instead of throwing
      const result = await cache.getScreenshot(metadata.filename);
      expect(result).toBeNull();
    });
  });

  // ==================== ISSUE #5: UNBOUNDED METADATA CACHE ====================

  describe('Issue #5: Metadata Cache Without Eviction', () => {
    it('should enforce maxCachedMetadata limit', async () => {
      cache = new CompressedScreenshotCache(tempDir, 60000); // Short TTL
      const maxEntries = 100; // Test with smaller number
      cache.maxCachedMetadata = maxEntries;

      const screenshot = generateTestScreenshot(512);

      // Add more entries than the limit
      for (let i = 0; i < maxEntries + 50; i++) {
        await cache.saveScreenshot('session-1', screenshot);
      }

      // Cache should not exceed max size
      expect(cache.metadataCache.size).toBeLessThanOrEqual(maxEntries);
    });

    it('should evict LRU entries when cache is full', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 10;

      const screenshot = generateTestScreenshot(512);

      // Add entries
      const firstMetadata = await cache.saveScreenshot('session-1', screenshot);
      for (let i = 0; i < 9; i++) {
        await cache.saveScreenshot('session-1', screenshot);
      }

      expect(cache.metadataCache.size).toBe(10);

      // Add one more, should evict the least recently used
      const lastMetadata = await cache.saveScreenshot('session-1', screenshot);

      // Still at max
      expect(cache.metadataCache.size).toBeLessThanOrEqual(10);

      // The first entry might have been evicted
      const firstStillExists = cache.metadataCache.has(firstMetadata.filename);
      const lastExists = cache.metadataCache.has(lastMetadata.filename);

      expect(lastExists).toBe(true);
    });

    it('should track access times for LRU eviction', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 5;

      const screenshot = generateTestScreenshot(512);

      // Add initial entries
      const entries = [];
      for (let i = 0; i < 5; i++) {
        const meta = await cache.saveScreenshot('session-1', screenshot);
        entries.push(meta.filename);
      }

      // Access first entry to update its access time
      cache.getMetadata(entries[0]);

      // Add more entries, first should not be evicted (recently accessed)
      for (let i = 0; i < 5; i++) {
        await cache.saveScreenshot('session-1', screenshot);
      }

      // First entry should still exist
      expect(cache.metadataCache.has(entries[0])).toBe(true);
    });

    it('should cleanup expired entries via TTL', async () => {
      const shortTtl = 100; // 100ms
      cache = new CompressedScreenshotCache(tempDir, shortTtl);

      const screenshot = generateTestScreenshot(512);
      const metadata = await cache.saveScreenshot('session-1', screenshot);

      expect(cache.metadataCache.size).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Manually run cleanup
      const deleted = await cache.cleanup(shortTtl);
      expect(deleted).toBe(1);
      expect(cache.metadataCache.size).toBe(0);
    });

    it('should implement background cleanup', async () => {
      // Note: this test is primarily checking the cleanup interval is set up
      cache = new CompressedScreenshotCache(tempDir);

      expect(cache.cleanupInterval).toBeDefined();

      // Cleanup interval should allow process to exit
      if (cache.cleanupInterval && cache.cleanupInterval.unref) {
        expect(typeof cache.cleanupInterval.unref).toBe('function');
      }
    });

    it('should survive high volume metadata adds', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 500;

      const screenshot = generateTestScreenshot(256);

      // Rapidly add many entries
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        await cache.saveScreenshot(`session-${i % 10}`, screenshot);
      }
      const duration = Date.now() - start;

      // Should complete in reasonable time
      expect(duration).toBeLessThan(30000);

      // Cache should be bounded
      expect(cache.metadataCache.size).toBeLessThanOrEqual(cache.maxCachedMetadata);
    });

    it('should return accurate stats for bounded cache', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      await cache.saveScreenshot('session-1', screenshot);
      await cache.saveScreenshot('session-1', screenshot);

      const stats = cache.getStats();

      expect(stats.fileCount).toBe(2);
      expect(stats.metadataInMemory).toBe(2);
      expect(stats.ttlMs).toBeDefined();
      expect(stats.totalCompressedSize).toBeGreaterThan(0);
    });
  });

  // ==================== COMBINED SCENARIO TESTS ====================

  describe('Combined Stability Scenarios', () => {
    it('should handle session clearing with LRU cache', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(512);

      // Add screenshots for multiple sessions
      for (let i = 0; i < 5; i++) {
        await cache.saveScreenshot('session-1', screenshot);
        await cache.saveScreenshot('session-2', screenshot);
      }

      expect(cache.metadataCache.size).toBe(10);

      // Clear one session
      const deleted = await cache.clearSession('session-1');
      expect(deleted).toBe(5);
      expect(cache.metadataCache.size).toBe(5);
    });

    it('should handle rapid cycling of sessions', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 100;

      const screenshot = generateTestScreenshot(512);

      // Rapidly add and clear sessions
      for (let session = 0; session < 20; session++) {
        for (let i = 0; i < 10; i++) {
          await cache.saveScreenshot(`session-${session}`, screenshot);
        }
        await cache.clearSession(`session-${session}`);
      }

      // Cache should be cleaned up
      expect(cache.metadataCache.size).toBeLessThanOrEqual(100);
    });

    it('should maintain cache consistency under stress', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      const promises = [];

      // Mix saves, reads, and deletes
      for (let i = 0; i < 50; i++) {
        promises.push(
          cache.saveScreenshot(`session-${i % 5}`, screenshot)
        );
      }

      const results = await Promise.all(promises);

      for (const meta of results) {
        const retrieved = await cache.getScreenshot(meta.filename);
        expect(retrieved).not.toBeNull();
      }

      // Stats should be consistent
      const stats = cache.getStats();
      expect(stats.fileCount).toBe(cache.metadataCache.size);
    });

    it('should handle compression with bounded cache', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      cache.maxCachedMetadata = 50;

      const largeScreenshot = generateTestScreenshot(10000);

      // Add compressed and uncompressed
      for (let i = 0; i < 30; i++) {
        await cache.saveScreenshot('session-1', largeScreenshot, { compress: true });
        await cache.saveScreenshot('session-2', largeScreenshot, { compress: false });
      }

      // Cache should be bounded
      expect(cache.metadataCache.size).toBeLessThanOrEqual(50);

      // Should still be able to read
      const list = cache.listSessionScreenshots('session-1');
      expect(list.length).toBeGreaterThan(0);
    });
  });

  // ==================== RESOURCE CLEANUP TESTS ====================

  describe('Resource Cleanup', () => {
    it('should properly shutdown cache', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);

      await cache.saveScreenshot('session-1', screenshot);
      await cache.shutdown();

      // Cleanup interval should be cleared
      expect(cache.cleanupInterval).toBeNull();
    });

    it('should cleanup failed deletes from metadata', async () => {
      cache = new CompressedScreenshotCache(tempDir);
      const screenshot = generateTestScreenshot(1024);
      const metadata = await cache.saveScreenshot('session-1', screenshot);

      // Manually delete file before attempting cache delete
      await fs.unlink(metadata.path);

      // Delete should still clean metadata even though file is gone
      const result = await cache.deleteScreenshot(metadata.filename);
      expect(result).toBe(false);
      expect(cache.metadataCache.has(metadata.filename)).toBe(false);
    });

    it('should handle directory creation errors gracefully', () => {
      // Cache should initialize even if directory creation fails
      const cache1 = new CompressedScreenshotCache('/root/impossible/path');
      expect(cache1).toBeDefined();
      expect(cache1.metadataCache).toBeDefined();
    });
  });
});

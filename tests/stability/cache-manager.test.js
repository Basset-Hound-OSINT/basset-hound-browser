/**
 * Tests for Cache Manager modules
 */

const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const { UnifiedCacheManager, FileBasedCacheManager } = require('../../src/stability/cache-manager');

describe('UnifiedCacheManager', () => {
  let cache;

  beforeEach(() => {
    cache = new UnifiedCacheManager({
      maxSize: 100,
      maxMemoryMb: 10,
      defaultTtlMs: 60000,
      cleanupIntervalMs: 10000,
      name: 'TestCache'
    });
  });

  afterEach(() => {
    cache.stop();
  });

  describe('initialization', () => {
    it('should start with empty cache', () => {
      const stats = cache.getStats();
      assert.strictEqual(stats.size, 0);
      assert.strictEqual(stats.hits, 0);
      assert.strictEqual(stats.misses, 0);
    });

    it('should use provided configuration', () => {
      const config = cache.getConfig();
      assert.strictEqual(config.maxSize, 100);
      assert.strictEqual(config.maxMemoryMb, 10);
      assert.strictEqual(config.name, 'TestCache');
    });
  });

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      assert.strictEqual(cache.get('key1'), 'value1');
    });

    it('should return undefined for missing keys', () => {
      assert.strictEqual(cache.get('nonexistent'), undefined);
    });

    it('should check key existence', () => {
      cache.set('key1', 'value1');
      assert.strictEqual(cache.has('key1'), true);
      assert.strictEqual(cache.has('nonexistent'), false);
    });

    it('should remove entries', () => {
      cache.set('key1', 'value1');
      assert.strictEqual(cache.remove('key1'), true);
      assert.strictEqual(cache.has('key1'), false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      const cleared = cache.clear();
      assert.strictEqual(cleared, 3);
      assert.strictEqual(cache.getStats().size, 0);
    });

    it('should overwrite existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      assert.strictEqual(cache.get('key1'), 'value2');
      assert.strictEqual(cache.getStats().size, 1);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      // Hit
      cache.get('key1');
      // Miss
      cache.get('missing');

      const stats = cache.getStats();
      assert.strictEqual(stats.hits, 1);
      assert.strictEqual(stats.misses, 1);
      assert.strictEqual(stats.hitRate, '50.00%');
    });

    it('should track inserts and removes', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.remove('key1');

      const stats = cache.getStats();
      assert.strictEqual(stats.totalInserts, 2);
      assert.strictEqual(stats.totalRemoves, 1);
    });

    it('should track memory usage', () => {
      cache.set('key1', 'a'.repeat(1000)); // ~2KB
      const stats = cache.getStats();

      assert.ok(stats.currentMemoryBytes > 1000);
    });
  });

  describe('TTL expiration', () => {
    it('should support no TTL (permanent)', () => {
      cache.set('key1', 'value1', null); // No TTL
      assert.strictEqual(cache.get('key1'), 'value1');

      // Even after cleanup, should still exist
      cache.cleanup();
      assert.strictEqual(cache.get('key1'), 'value1');
    });

    it('should track TTL in metadata', () => {
      cache.set('key1', 'value1', 5000);
      const entry = cache.entries.get('key1');

      assert.ok(entry);
      assert.strictEqual(entry.ttlMs, 5000);
      assert.strictEqual(entry.isExpired(), false);
    });

    it('should use default TTL if not specified', () => {
      const shortCache = new UnifiedCacheManager({
        defaultTtlMs: 5000,
        cleanupIntervalMs: 50
      });

      shortCache.set('key1', 'value1'); // Uses default TTL
      const entry = shortCache.entries.get('key1');
      assert.strictEqual(entry.ttlMs, 5000);
      shortCache.stop();
    });
  });

  describe('LRU eviction', () => {
    it('should evict LRU entry when max size reached', () => {
      const smallCache = new UnifiedCacheManager({ maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      assert.strictEqual(smallCache.getStats().size, 3);

      // key1 is LRU, should be evicted
      smallCache.set('key4', 'value4');

      assert.strictEqual(smallCache.getStats().size, 3);
      assert.strictEqual(smallCache.has('key1'), false);
      assert.strictEqual(smallCache.has('key4'), true);
      assert.strictEqual(smallCache.getStats().evictions, 1);
    });

    it('should evict least recently used entry', () => {
      const smallCache = new UnifiedCacheManager({ maxSize: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // All 3 should exist
      assert.strictEqual(smallCache.getStats().size, 3);

      // Adding key4 should trigger eviction
      // key1 is the LRU (oldest accessedAt), so it should be evicted
      smallCache.set('key4', 'value4');

      assert.strictEqual(smallCache.getStats().size, 3);
      assert.strictEqual(smallCache.getStats().evictions, 1);

      // key2, key3, key4 should be present (key1 was LRU and evicted)
      assert.strictEqual(smallCache.get('key2'), 'value2');
      assert.strictEqual(smallCache.get('key3'), 'value3');
      assert.strictEqual(smallCache.get('key4'), 'value4');
    });

    it('should evict based on memory limit', () => {
      const cache1MbMax = new UnifiedCacheManager({
        maxSize: 1000,
        maxMemoryMb: 1 // 1MB max
      });

      // Add 1.5MB of data (should trigger eviction)
      const data = 'x'.repeat(500 * 1024); // 500KB

      cache1MbMax.set('key1', data);
      cache1MbMax.set('key2', data);
      cache1MbMax.set('key3', data);

      // Should have evicted some entries
      assert.ok(cache1MbMax.getStats().evictions > 0);
      assert.ok(cache1MbMax.getStats().currentMemoryBytes < 1.5 * 1024 * 1024);

      cache1MbMax.stop();
    });
  });

  describe('cleanup', () => {
    it('should perform cleanup without errors', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      // Should not throw and should return 0 (nothing expired)
      const cleaned = cache.cleanup();
      assert.strictEqual(cleaned, 0); // Nothing expired yet
      assert.strictEqual(cache.getStats().size, 2);
    });

    it('should track remove vs expiration separately', () => {
      cache.set('key1', 'value1');
      cache.remove('key2'); // No-op, key doesn't exist

      const stats = cache.getStats();
      assert.strictEqual(stats.totalRemoves, 0); // Removing non-existent key not counted
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple set operations', () => {
      for (let i = 0; i < 50; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      assert.strictEqual(cache.getStats().size, 50);

      // All should be retrievable
      for (let i = 0; i < 50; i++) {
        assert.strictEqual(cache.get(`key${i}`), `value${i}`);
      }
    });

    it('should handle interleaved get/set', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      cache.set('key3', 'value3');
      cache.get('key2');
      cache.set('key4', 'value4');

      const stats = cache.getStats();
      assert.strictEqual(stats.hits, 2);
      assert.strictEqual(stats.totalInserts, 4);
    });
  });

  describe('value types', () => {
    it('should cache strings', () => {
      cache.set('str', 'hello world');
      assert.strictEqual(cache.get('str'), 'hello world');
    });

    it('should cache objects', () => {
      const obj = { a: 1, b: 'test', c: [1, 2, 3] };
      cache.set('obj', obj);
      assert.deepStrictEqual(cache.get('obj'), obj);
    });

    it('should cache arrays', () => {
      const arr = [1, 2, 3, 'test', { nested: true }];
      cache.set('arr', arr);
      assert.deepStrictEqual(cache.get('arr'), arr);
    });

    it('should cache buffers', () => {
      const buf = Buffer.from('hello');
      cache.set('buf', buf);
      assert.ok(cache.get('buf').equals(buf));
    });

    it('should cache null and undefined', () => {
      cache.set('null', null);
      cache.set('undefined', undefined);

      assert.strictEqual(cache.get('null'), null);
      assert.strictEqual(cache.get('undefined'), undefined);
    });
  });
});

describe('FileBasedCacheManager', () => {
  let cache;
  const testDir = path.join('/tmp', 'test-cache-' + Date.now());

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    cache = new FileBasedCacheManager(testDir, {
      maxSize: 100,
      defaultTtlMs: 60000
    });
  });

  afterEach(async () => {
    cache.stop();
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (e) {
      // Ignore
    }
  });

  describe('file operations', () => {
    it('should save and retrieve files', async () => {
      const data = Buffer.from('test file content');
      await cache.setFile('test-key', data);

      const retrieved = await cache.getFile('test-key');
      assert.ok(retrieved.equals(data));
    });

    it('should handle missing files gracefully', async () => {
      const result = await cache.getFile('nonexistent');
      assert.strictEqual(result, null);
    });

    it('should handle directory creation', async () => {
      const newDir = path.join('/tmp', 'new-cache-' + Date.now());
      const newCache = new FileBasedCacheManager(newDir);

      // Create cache entry to trigger directory creation
      await newCache.setFile('test', Buffer.from('test'));

      const stats = await fs.stat(newDir);
      assert.ok(stats.isDirectory());

      newCache.stop();
      await fs.rm(newDir, { recursive: true });
    });

    it('should track file metadata', async () => {
      const data = Buffer.from('test');
      const meta = await cache.setFile('key1', data);

      assert.ok(meta.filename);
      assert.ok(meta.path);
      assert.strictEqual(meta.size, data.length);
    });
  });

  describe('file cleanup', () => {
    it('should handle file cleanup', async () => {
      const data = Buffer.from('test');
      const meta = await cache.setFile('key1', data);

      // File should exist
      const file = await cache.getFile('key1');
      assert.ok(file);

      // File operations should work
      const cleaned = await cache.cleanupFiles();
      assert.strictEqual(cleaned, 0); // Nothing expired yet
    });

    it('should cleanup via removeFile', async () => {
      const data = Buffer.from('test');
      const meta = await cache.setFile('key1', data);

      // File should exist
      let file = await cache.getFile('key1');
      assert.ok(file);

      // Remove file
      await cache.removeFile('key1');

      // File should not exist
      file = await cache.getFile('key1');
      assert.strictEqual(file, null);
    });
  });
});

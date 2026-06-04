/**
 * Cache Manager Tests
 * Comprehensive tests for multi-tier caching functionality
 */

const assert = require('assert');
const CacheManager = require('../../src/cache/cache-manager');

describe('Cache Manager Tests', () => {
  let cache;

  beforeEach(() => {
    cache = new CacheManager({
      maxMemorySize: 10 * 1024 * 1024, // 10MB
      defaultTTL: 5000,
    });
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await cache.set('key1', 'value1');
      const value = await cache.get('key1');
      assert.strictEqual(value, 'value1');
    });

    it('should return null for missing key', async () => {
      const value = await cache.get('nonexistent');
      assert.strictEqual(value, null);
    });

    it('should delete a key', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');
      const value = await cache.get('key1');
      assert.strictEqual(value, null);
    });

    it('should clear all cache', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.clear();
      assert.strictEqual(await cache.get('key1'), null);
      assert.strictEqual(await cache.get('key2'), null);
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 100 });
      assert.strictEqual(await cache.get('key1'), 'value1');

      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.strictEqual(await cache.get('key1'), null);
    });

    it('should respect custom TTL', async () => {
      await cache.set('key1', 'value1', { ttl: 200 });
      await cache.set('key2', 'value2', { ttl: 10000 });

      await new Promise((resolve) => setTimeout(resolve, 250));

      assert.strictEqual(await cache.get('key1'), null);
      assert.strictEqual(await cache.get('key2'), 'value2');
    });
  });

  describe('Tag-based Invalidation', () => {
    it('should invalidate keys by tag', async () => {
      await cache.set('key1', 'value1', { tags: ['user:123'] });
      await cache.set('key2', 'value2', { tags: ['user:123'] });
      await cache.set('key3', 'value3', { tags: ['user:456'] });

      await cache.invalidateTag('user:123');

      assert.strictEqual(await cache.get('key1'), null);
      assert.strictEqual(await cache.get('key2'), null);
      assert.strictEqual(await cache.get('key3'), 'value3');
    });

    it('should support multiple tags per key', async () => {
      await cache.set('key1', 'value1', { tags: ['tag1', 'tag2', 'tag3'] });

      await cache.invalidateTag('tag2');

      assert.strictEqual(await cache.get('key1'), null);
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', async () => {
      await cache.set('key1', 'x'.repeat(1000));
      const metrics = cache.getMetrics();
      assert(metrics.memorySize > 0);
      assert(metrics.entryCount === 1);
    });

    it('should evict entries when memory limit exceeded', async () => {
      const smallCache = new CacheManager({ maxMemorySize: 500 });

      await smallCache.set('key1', 'x'.repeat(100));
      await smallCache.set('key2', 'x'.repeat(100));
      await smallCache.set('key3', 'x'.repeat(100));
      await smallCache.set('key4', 'x'.repeat(100));
      await smallCache.set('key5', 'x'.repeat(100));

      const metrics = smallCache.getMetrics();
      assert(metrics.evictions > 0);
    });

    it('should use LRU eviction by default', async () => {
      const smallCache = new CacheManager({
        maxMemorySize: 500,
        evictionPolicy: 'LRU',
      });

      await smallCache.set('key1', 'x'.repeat(100));
      await smallCache.set('key2', 'x'.repeat(100));

      // Access key1 to mark it as recently used
      await smallCache.get('key1');

      // Add more keys to trigger eviction
      await smallCache.set('key3', 'x'.repeat(100));
      await smallCache.set('key4', 'x'.repeat(100));

      // key1 should still be in cache (recently used)
      assert(await smallCache.get('key1') !== null);
      // key2 should be evicted (least recently used)
      assert(await smallCache.get('key2') === null);
    });
  });

  describe('Metrics', () => {
    it('should track cache hits and misses', async () => {
      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss

      const metrics = cache.getMetrics();
      assert.strictEqual(metrics.hits, 2);
      assert.strictEqual(metrics.misses, 1);
      assert.strictEqual(metrics.hitRate, '66.67%');
    });

    it('should track sets and deletes', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.delete('key1');

      const metrics = cache.getMetrics();
      assert.strictEqual(metrics.sets, 2);
      assert.strictEqual(metrics.deletes, 1);
    });
  });

  describe('Complex Data Types', () => {
    it('should cache objects', async () => {
      const obj = { id: 1, name: 'Test', nested: { value: 42 } };
      await cache.set('key1', obj);
      const retrieved = await cache.get('key1');
      assert.deepStrictEqual(retrieved, obj);
    });

    it('should cache arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('key1', arr);
      const retrieved = await cache.get('key1');
      assert.deepStrictEqual(retrieved, arr);
    });

    it('should handle large data', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(100),
        })),
      };
      await cache.set('key1', largeData);
      const retrieved = await cache.get('key1');
      assert.strictEqual(retrieved.items.length, 1000);
    });
  });

  describe('Compact Disk', () => {
    it('should remove expired entries from disk', async () => {
      // This test assumes disk caching is available
      await cache.set('key1', 'value1', { ttl: 100, tier: 'disk' });
      await cache.set('key2', 'value2', { ttl: 100000, tier: 'disk' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const removed = await cache.compactDisk();
      assert(removed > 0);
    });
  });

  describe('Events', () => {
    it('should emit set event', async () => {
      let emitted = false;
      cache.once('set', () => {
        emitted = true;
      });

      await cache.set('key1', 'value1');
      assert(emitted);
    });

    it('should emit hit and miss events', async () => {
      let hitEmitted = false;
      let missEmitted = false;

      cache.once('hit', () => {
        hitEmitted = true;
      });
      cache.once('miss', () => {
        missEmitted = true;
      });

      await cache.set('key1', 'value1');
      await cache.get('key1'); // hit
      await cache.get('missing'); // miss

      assert(hitEmitted);
      assert(missEmitted);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      await cache.set('key1', null);
      const value = await cache.get('key1');
      assert.strictEqual(value, null);
    });

    it('should handle undefined values', async () => {
      await cache.set('key1', undefined);
      const value = await cache.get('key1');
      assert.strictEqual(value, undefined);
    });

    it('should handle empty strings', async () => {
      await cache.set('key1', '');
      const value = await cache.get('key1');
      assert.strictEqual(value, '');
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:colons!@#$%^&*()';
      await cache.set(specialKey, 'value');
      const value = await cache.get(specialKey);
      assert.strictEqual(value, 'value');
    });
  });
});

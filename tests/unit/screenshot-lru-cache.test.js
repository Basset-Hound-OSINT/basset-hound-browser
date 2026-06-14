/**
 * LRU Cache Test Suite
 *
 * Tests for screenshot result caching with LRU eviction and TTL management
 */

const { LRUCache } = require('../../screenshots/lru-cache');

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({
      maxEntries: 10,
      maxMemoryMB: 10,
      ttlMs: 5000
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.entries).toBe(0);
    });
  });

  describe('set and get', () => {
    it('should set and retrieve value', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should return null for missing key', () => {
      const value = cache.get('missing');
      expect(value).toBeNull();
    });

    it('should update existing key', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');

      const value = cache.get('key1');
      expect(value).toBe('value2');
    });

    it('should handle object keys', () => {
      const key = { userId: 123, type: 'screenshot' };
      cache.set(key, 'value1');

      const value = cache.get(key);
      expect(value).toBe('value1');
    });

    it('should serialize complex objects', () => {
      const data = { width: 1920, height: 1080, format: 'png' };
      cache.set('complex', data);

      const retrieved = cache.get('complex');
      expect(retrieved.width).toBe(1920);
    });

    it('should store buffer data', () => {
      const buffer = Buffer.from('image data');
      cache.set('buffer', buffer);

      const retrieved = cache.get('buffer');
      expect(Buffer.isBuffer(retrieved)).toBe(true);
      expect(retrieved.toString()).toBe('image data');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used on capacity', () => {
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats1 = cache.getStats();
      expect(stats1.entries).toBe(10);

      // Add one more, should evict oldest
      cache.set('key10', 'value10');

      const stats2 = cache.getStats();
      expect(stats2.entries).toBe(10);
      expect(stats2.evictions).toBe(1);

      // key0 should be evicted
      expect(cache.get('key0')).toBeNull();
    });

    it('should preserve recently accessed items', () => {
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key0 to make it recent
      cache.get('key0');

      // Add one more
      cache.set('key10', 'value10');

      // key1 should be evicted (oldest), not key0
      expect(cache.get('key0')).not.toBeNull();
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('TTL expiration', () => {
    it('should return null for expired entry', async () => {
      cache.set('expiring', 'value', { ttl: 100 });

      // Should exist immediately
      expect(cache.get('expiring')).toBe('value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(cache.get('expiring')).toBeNull();
    });

    it('should increment misses on expiration', async () => {
      cache.set('expiring', 'value', { ttl: 100 });

      const stats1 = cache.getStats();
      expect(stats1.misses).toBe(0);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      cache.get('expiring');

      const stats2 = cache.getStats();
      expect(stats2.misses).toBe(1);
      expect(stats2.invalidations).toBe(1);
    });

    it('should clean up expired entries periodically', async () => {
      cache.set('key1', 'value1', { ttl: 100 });
      cache.set('key2', 'value2', { ttl: 100 });

      const stats1 = cache.getStats();
      expect(stats1.entries).toBe(2);

      // Wait for TTL cleanup
      await new Promise(resolve => setTimeout(resolve, 65000));

      const stats2 = cache.getStats();
      expect(stats2.entries).toBeLessThan(2);
    });
  });

  describe('has method', () => {
    it('should check key existence', () => {
      cache.set('exists', 'value');

      expect(cache.has('exists')).toBe(true);
      expect(cache.has('missing')).toBe(false);
    });

    it('should return false for expired entry', async () => {
      cache.set('expiring', 'value', { ttl: 100 });

      expect(cache.has('expiring')).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(cache.has('expiring')).toBe(false);
    });
  });

  describe('delete method', () => {
    it('should delete entry', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      const deleted = cache.delete('key1');
      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    it('should return false for missing key', () => {
      const deleted = cache.delete('missing');
      expect(deleted).toBe(false);
    });
  });

  describe('memory management', () => {
    it('should track memory usage', () => {
      const largeData = Buffer.alloc(1000);
      cache.set('large', largeData);

      const stats = cache.getStats();
      expect(stats.currentMemoryUsage).toBeGreaterThan(0);
    });

    it('should evict when memory limit exceeded', () => {
      // Fill with large data
      const largeBuffer = Buffer.alloc(1024 * 1024);

      cache.set('data1', largeBuffer);
      cache.set('data2', largeBuffer);

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it('should update memory on deletion', () => {
      const buffer = Buffer.alloc(1000);
      cache.set('buffer', buffer);

      const stats1 = cache.getStats();
      const mem1 = stats1.currentMemoryUsage;

      cache.delete('buffer');

      const stats2 = cache.getStats();
      expect(stats2.currentMemoryUsage).toBeLessThan(mem1);
    });
  });

  describe('statistics', () => {
    it('should calculate hit rate', () => {
      cache.set('key1', 'value1');

      cache.get('key1');  // hit
      cache.get('key1');  // hit
      cache.get('key2');  // miss

      const stats = cache.getStats();
      expect(parseFloat(stats.hitRate)).toBe(66.67);  // 2 hits out of 3
    });

    it('should track access count', () => {
      cache.set('key1', 'value1');

      cache.get('key1');
      cache.get('key1');
      cache.get('key1');

      const details = cache.getDetails('key1');
      expect(details.accessCount).toBe(3);
    });

    it('should provide entry details', () => {
      cache.set('key1', 'value1', { ttl: 5000 });

      const details = cache.getDetails('key1');
      expect(details.key).toBe('key1');
      expect(details.createdAt).toBeLessThanOrEqual(Date.now());
      expect(details.ttl).toBeGreaterThan(0);
      expect(details.isExpired).toBe(false);
    });
  });

  describe('clear method', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats1 = cache.getStats();
      expect(stats1.entries).toBe(2);

      cache.clear();

      const stats2 = cache.getStats();
      expect(stats2.entries).toBe(0);
      expect(stats2.currentMemoryUsage).toBe(0);
    });
  });

  describe('getAll method', () => {
    it('should return all entries sorted by access count', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.get('key1');
      cache.get('key1');
      cache.get('key2');

      const all = cache.getAll();
      expect(all.length).toBe(3);
      expect(all[0].accessCount).toBeGreaterThanOrEqual(all[1].accessCount);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');

      const stats1 = cache.getStats();
      expect(stats1.hits).toBe(1);
      expect(stats1.misses).toBe(1);

      cache.resetStats();

      const stats2 = cache.getStats();
      expect(stats2.hits).toBe(0);
      expect(stats2.misses).toBe(0);
      expect(stats2.entries).toBe(1);  // Entry still exists
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const cacheWithTracking = new LRUCache();
      cacheWithTracking.set('key1', 'value1');
      cacheWithTracking.destroy();

      const stats = cacheWithTracking.getStats();
      expect(stats.entries).toBe(0);
    });
  });
});

describe('Cache Performance', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({ maxEntries: 1000 });
  });

  afterEach(() => {
    cache.destroy();
  });

  it('should handle rapid set/get operations', () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    for (let i = 0; i < 1000; i++) {
      cache.get(`key${i}`);
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);  // Should be very fast
  });

  it('should maintain high hit rate with working set', () => {
    const workingSet = 50;

    for (let i = 0; i < workingSet; i++) {
      cache.set(`key${i}`, `value${i}`);
    }

    // Access working set multiple times
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < workingSet; i++) {
        cache.get(`key${i}`);
      }
    }

    const stats = cache.getStats();
    expect(parseFloat(stats.hitRate)).toBe(100);  // All hits
  });

  it('should size estimate accurately', () => {
    const string = 'A'.repeat(1000);
    const buffer = Buffer.alloc(1000);

    cache.set('string', string);
    cache.set('buffer', buffer);

    const stats = cache.getStats();
    expect(stats.currentMemoryUsage).toBeGreaterThan(0);
  });
});

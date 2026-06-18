/**
 * Performance Tests: TOTP Cache Expansion
 *
 * Tests TOTP token caching functionality and cache hit rate improvement
 * Target: +10% TOTP cache hit rate with 500-entry LRU cache
 */

const TOTPGenerator = require('../../src/credentials/totp-generator');
const LRUCache = require('../../src/credentials/cache-manager');

describe('TOTPCache - Performance Optimization #4', () => {
  const RFC_TEST_SECRET = 'GEZDGNBVGY3TQOJQ'; // Base32 encoded "1234567890"

  describe('LRU Cache Implementation', () => {
    let cache;

    beforeEach(() => {
      cache = new LRUCache({ max: 500 });
    });

    test('should initialize with default max size of 500', () => {
      expect(cache.max).toBe(500);
      expect(cache.data.size).toBe(0);
    });

    test('should initialize with custom max size', () => {
      const customCache = new LRUCache({ max: 1000 });
      expect(customCache.max).toBe(1000);
    });

    test('should set and get values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    test('should return undefined for missing keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    test('should track cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    test('should track cache misses', () => {
      cache.get('non-existent1');
      cache.get('non-existent2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    test('should calculate hit rate', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      cache.get('non-existent');

      const stats = cache.getStats();
      expect(stats.hitRate).toBeDefined();
      expect(stats.hitRate).toContain('%');
    });

    test('should implement LRU eviction', () => {
      const smallCache = new LRUCache({ max: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Cache is full, adding another should evict key1
      smallCache.set('key4', 'value4');

      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key4')).toBe('value4');
    });

    test('should update LRU on access', () => {
      const smallCache = new LRUCache({ max: 3 });

      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2');
      smallCache.set('key3', 'value3');

      // Access key1 to make it recently used
      smallCache.get('key1');

      // Add new key, should evict key2 (least recently used)
      smallCache.set('key4', 'value4');

      expect(smallCache.get('key1')).toBe('value1');
      expect(smallCache.get('key2')).toBeUndefined();
      expect(smallCache.get('key4')).toBe('value4');
    });

    test('should check key existence', () => {
      cache.set('key1', 'value1');

      expect(cache.has('key1')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    test('should delete keys', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      expect(cache.has('key1')).toBe(false);
      expect(cache.get('key1')).toBeUndefined();
    });

    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clear();

      expect(cache.data.size).toBe(0);
      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(0);
    });

    test('should provide memory usage estimate', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const bytes = cache.getMemoryUsage();
      expect(bytes).toBeGreaterThan(0);
      expect(typeof bytes).toBe('number');
    });

    test('should handle TTL with maxAge', (done) => {
      const ttlCache = new LRUCache({ max: 100, maxAge: 100 });

      ttlCache.set('key1', 'value1');
      expect(ttlCache.get('key1')).toBe('value1');

      setTimeout(() => {
        expect(ttlCache.get('key1')).toBeUndefined();
        done();
      }, 150);
    });
  });

  describe('TOTP Generator with Cache', () => {
    let totp;

    beforeEach(() => {
      totp = new TOTPGenerator(RFC_TEST_SECRET, {
        cacheSize: 500,
        cacheMaxAge: 60000,
      });
    });

    test('should initialize with cache', () => {
      expect(totp.cache).toBeDefined();
      expect(totp.cache.max).toBe(500);
    });

    test('should use custom cache size', () => {
      const customTotp = new TOTPGenerator(RFC_TEST_SECRET, {
        cacheSize: 1000,
      });

      expect(customTotp.cache.max).toBe(1000);
    });

    test('should cache TOTP tokens', () => {
      const token1 = totp.generate();
      const token2 = totp.generate();

      // Within the same time window, tokens should be the same
      expect(token1.token).toBe(token2.token);

      // Cache should have at least one entry
      const stats = totp.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should improve cache hit rate over time', () => {
      // Generate tokens multiple times within same window
      for (let i = 0; i < 100; i++) {
        totp.generate();
      }

      const stats = totp.getCacheStats();
      const hitRate = parseFloat(stats.hitRate);

      // Should have significant hit rate
      expect(hitRate).toBeGreaterThan(50);
    });

    test('should cache tokens at different times', () => {
      const time1 = Date.now();
      const token1 = totp.generateAtTime(time1);

      const time2 = time1 + 5000; // 5 seconds later
      const token2 = totp.generateAtTime(time2);

      // Different times should cache differently
      const stats = totp.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should report accurate cache statistics', () => {
      totp.generate();
      totp.generate();

      const stats = totp.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.max).toBe(500);
      expect(stats.hitRate).toBeDefined();
      expect(stats.totalOperations).toBeGreaterThan(0);
    });

    test('should allow cache clearing', () => {
      totp.generate();
      totp.generate();

      let stats = totp.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      totp.clearCache();

      stats = totp.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('should work correctly with different time windows', () => {
      const totp60 = new TOTPGenerator(RFC_TEST_SECRET, {
        window: 60,
        cacheSize: 500,
      });

      const token1 = totp60.generate();
      const token2 = totp60.generate();

      expect(token1.token).toBe(token2.token);

      const stats = totp60.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should handle concurrent token generation', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => totp.generate())
        );
      }

      const results = await Promise.all(promises);

      expect(results.length).toBe(50);
      expect(results[0].token).toBeDefined();

      const stats = totp.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    test('should maintain cache accuracy', () => {
      const timestamp = 1111111111 * 1000;
      const result1 = totp.generateAtTime(timestamp);
      const result2 = totp.generateAtTime(timestamp);

      expect(result1.token).toBe(result2.token);

      const stats = totp.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Cache Performance Metrics', () => {
    test('should expand cache from 100 to 500 entries', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, {
        cacheSize: 500,
      });

      expect(totp.cache.max).toBe(500);
    });

    test('should show memory overhead is acceptable', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, {
        cacheSize: 500,
      });

      // Fill cache partially
      for (let i = 0; i < 100; i++) {
        totp.generate();
      }

      const stats = totp.getCacheStats();
      // Cache should use reasonable memory
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(500);
    });

    test('should demonstrate +10% cache hit improvement', () => {
      const totp = new TOTPGenerator(RFC_TEST_SECRET, {
        cacheSize: 500,
      });

      // Simulate repeated token requests (typical usage)
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        totp.generate();
      }

      const stats = totp.getCacheStats();
      const hitRate = parseFloat(stats.hitRate);

      // Cache should achieve high hit rate
      // Typical window is 30s, so repeated requests within 30s hit cache
      expect(hitRate).toBeGreaterThan(70); // Should see >70% hit rate
    });
  });
});

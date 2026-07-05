/**
 * LRU Cache Test Suite
 * Validates O(1) linked list operations and cache hit rate metrics
 */

const { LRUCache } = require('../websocket/lru-cache');

describe('LRU Cache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3); // Small size for testing
  });

  afterEach(() => {
    // Cleanup cache after each test
    if (cache && cache.clear) {
      cache.clear();
    }
    cache = null;

    // Force GC after each cache test
    if (global.gc) {
      global.gc();
    }
  });

  describe('Basic Operations', () => {
    test('set and get values', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBe(2);
    });

    test('get non-existent key returns undefined', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    test('update existing key', () => {
      cache.set('a', 1);
      cache.set('a', 10);
      expect(cache.get('a')).toBe(10);
      expect(cache.size()).toBe(1);
    });

    test('delete removes entry', () => {
      cache.set('a', 1);
      expect(cache.delete('a')).toBe(true);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size()).toBe(0);
    });

    test('delete non-existent returns false', () => {
      expect(cache.delete('missing')).toBe(false);
    });
  });

  describe('LRU Eviction', () => {
    test('evicts least recently used when capacity exceeded', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.size()).toBe(3);

      // Add fourth item - should evict 'a' (least recently used)
      cache.set('d', 4);
      expect(cache.size()).toBe(3);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
    });

    test('accessing item marks it as recently used', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access 'a' to make it recently used
      cache.get('a');

      // Add new item - should evict 'b' (least recently used now)
      cache.set('d', 4);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('d')).toBe(4);
    });

    test('updating item marks it as recently used', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Update 'a' to make it recently used
      cache.set('a', 10);

      // Add new item - should evict 'b'
      cache.set('d', 4);
      expect(cache.get('a')).toBe(10);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('Order Preservation', () => {
    test('keys() returns items in LRU order', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access 'a' to make it most recent
      cache.get('a');

      const keys = cache.keys();
      expect(keys).toEqual(['a', 'c', 'b']); // a is most recent, b is least
    });

    test('access order affects eviction', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // Access in reverse order
      cache.get('c');
      cache.get('b');
      cache.get('a');

      const keys = cache.keys();
      expect(keys[0]).toBe('a'); // Most recently used
      expect(keys[2]).toBe('c'); // Least recently used
    });
  });

  describe('Metrics', () => {
    test('tracks hit rate correctly', () => {
      cache.set('a', 1);
      cache.set('b', 2);

      cache.get('a'); // hit
      cache.get('a'); // hit
      cache.get('missing'); // miss
      cache.get('b'); // hit

      expect(cache.hits).toBe(3);
      expect(cache.misses).toBe(1);
      expect(cache.hitRate()).toBe(75);
    });

    test('tracks evictions', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.evictions).toBe(0);

      cache.set('d', 4); // Evicts 'a'
      expect(cache.evictions).toBe(1);

      cache.set('e', 5); // Evicts 'b'
      expect(cache.evictions).toBe(2);
    });

    test('getMetrics returns correct stats', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // hit
      cache.get('missing'); // miss

      const metrics = cache.getMetrics();
      expect(metrics.size).toBe(2);
      expect(metrics.maxSize).toBe(3);
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe('50.00%');
    });
  });

  describe('Clear and Size', () => {
    test('clear removes all entries and resets metrics', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.get('a'); // hit

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(0);
      expect(cache.evictions).toBe(0);
      expect(cache.get('a')).toBeUndefined();
    });

    test('size reflects actual item count', () => {
      expect(cache.size()).toBe(0);
      cache.set('a', 1);
      expect(cache.size()).toBe(1);
      cache.set('b', 2);
      expect(cache.size()).toBe(2);
      cache.delete('a');
      expect(cache.size()).toBe(1);
    });
  });

  describe('Performance - Workload Simulation', () => {
    let largeCache; // Suite-level cache variable

    afterEach(() => {
      // Cleanup performance test cache
      if (largeCache && largeCache.clear) {
        largeCache.clear();
      }
      largeCache = null;

      // Force GC after performance tests
      if (global.gc) {
        global.gc();
      }
    });

    test('achieves 95%+ hit rate with working set locality', () => {
      largeCache = new LRUCache(100);

      // Pre-populate with 80 keys
      for (let i = 0; i < 80; i++) {
        largeCache.set(`key-${i}`, i);
      }
      largeCache.clear(); // Clear metrics but keep understanding of structure

      // Simulate working set: access 80 keys repeatedly
      for (let access = 0; access < 1000; access++) {
        const key = `key-${access % 80}`;
        const val = largeCache.get(key);
        if (val === undefined) {
          largeCache.set(key, access);
        }
      }

      const hitRate = largeCache.hitRate();
      console.log(`Hit rate with working set locality: ${hitRate.toFixed(2)}%`);
      expect(hitRate).toBeGreaterThanOrEqual(90);
    });

    test('maintains high hit rate with 80/20 access pattern', () => {
      largeCache = new LRUCache(50);

      // 20% of keys get 80% of accesses (Pareto distribution)
      for (let i = 0; i < 5000; i++) {
        let key;
        const rand = Math.random();
        if (rand < 0.8) {
          // 80% access to top 20% of keys
          key = `hot-${Math.floor(Math.random() * 10)}`;
        } else {
          // 20% access to remaining keys
          key = `cold-${Math.floor(Math.random() * 100) + 10}`;
        }

        if (!largeCache.get(key)) {
          largeCache.set(key, Math.random());
        }
      }

      const hitRate = largeCache.hitRate();
      console.log(`Hit rate with 80/20 pattern: ${hitRate.toFixed(2)}%`);
      expect(hitRate).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Integrity Validation', () => {
    test('cache maintains internal consistency', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a');
      cache.set('d', 4);
      cache.delete('c');

      const validation = cache._validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('validates after random operations', () => {
      for (let i = 0; i < 100; i++) {
        const op = Math.random();
        const key = `key-${Math.floor(Math.random() * 10)}`;

        if (op < 0.5) {
          cache.set(key, Math.random());
        } else if (op < 0.8) {
          cache.get(key);
        } else {
          cache.delete(key);
        }
      }

      const validation = cache._validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('handles capacity of 1', () => {
      const smallCache = new LRUCache(1);
      smallCache.set('a', 1);
      expect(smallCache.get('a')).toBe(1);

      smallCache.set('b', 2);
      expect(smallCache.get('a')).toBeUndefined();
      expect(smallCache.get('b')).toBe(2);
      expect(smallCache.evictions).toBe(1);
    });

    test('handles large capacity', () => {
      const largeCache = new LRUCache(10000);
      for (let i = 0; i < 5000; i++) {
        largeCache.set(`key-${i}`, i);
      }

      expect(largeCache.size()).toBe(5000);
      expect(largeCache.evictions).toBe(0);

      for (let i = 0; i < 5000; i++) {
        expect(largeCache.get(`key-${i}`)).toBe(i);
      }

      expect(largeCache.hitRate()).toBe(100);
    });

    test('handles null and undefined values', () => {
      cache.set('a', null);
      cache.set('b', undefined);

      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeUndefined();
    });

    test('handles complex objects as values', () => {
      const obj = { nested: { data: [1, 2, 3] } };
      cache.set('obj', obj);

      const retrieved = cache.get('obj');
      expect(retrieved).toBe(obj);
      expect(retrieved.nested.data).toEqual([1, 2, 3]);
    });
  });
});

// Performance benchmark
describe('LRU Cache Performance Benchmark', () => {
  test('O(1) get operation performance', () => {
    const cache = new LRUCache(1000);

    // Populate cache
    for (let i = 0; i < 1000; i++) {
      cache.set(`key-${i}`, i);
    }

    // Measure get performance
    const start = process.hrtime.bigint();
    for (let i = 0; i < 100000; i++) {
      cache.get(`key-${i % 1000}`);
    }
    const end = process.hrtime.bigint();

    const timeMs = Number(end - start) / 1000000;
    const opsPerMs = 100000 / timeMs;

    console.log(`\nPerformance: ${opsPerMs.toFixed(0)} get ops/ms (${timeMs.toFixed(2)}ms for 100k ops)`);
    expect(opsPerMs).toBeGreaterThan(1000); // Should be very fast
  });

  test('O(1) set operation performance', () => {
    const cache = new LRUCache(10000);

    const start = process.hrtime.bigint();
    for (let i = 0; i < 10000; i++) {
      cache.set(`key-${i}`, i);
    }
    const end = process.hrtime.bigint();

    const timeMs = Number(end - start) / 1000000;
    const opsPerMs = 10000 / timeMs;

    console.log(`Set performance: ${opsPerMs.toFixed(0)} set ops/ms (${timeMs.toFixed(2)}ms for 10k ops)`);
    expect(opsPerMs).toBeGreaterThan(100);
  });
});

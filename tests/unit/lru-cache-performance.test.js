/**
 * LRU Cache Performance Tests
 *
 * Validates that linked list implementation achieves O(1) cache hit performance
 * instead of O(n) filter-based approach.
 */

const { LRUCache } = require('../../screenshots/lru-cache.js');

describe('LRU Cache Performance - O(1) Linked List Implementation', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache({
      maxEntries: 1000,
      maxMemoryMB: 100,
      ttlMs: 3600000
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Cache Hit Performance', () => {
    it('should achieve sub-millisecond cache hits with large cache', (done) => {
      // Pre-populate cache with 500 entries
      for (let i = 0; i < 500; i++) {
        cache.set(`key-${i}`, { data: 'value-' + i, index: i });
      }

      const iterations = 10000;
      const startTime = process.hrtime.bigint();

      // Perform rapid cache hits
      for (let i = 0; i < iterations; i++) {
        const hitKey = `key-${Math.floor(Math.random() * 500)}`;
        const value = cache.get(hitKey);
        expect(value).toBeTruthy();
      }

      const endTime = process.hrtime.bigint();
      const timeMs = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const timePerHitUs = Number(endTime - startTime) / iterations / 1000; // Convert to microseconds

      console.log(`\n  Performance Metrics:`);
      console.log(`    Total time for ${iterations} hits: ${timeMs.toFixed(2)}ms`);
      console.log(`    Average time per hit: ${timePerHitUs.toFixed(2)}µs`);
      console.log(`    Operations per second: ${(iterations / (timeMs / 1000)).toFixed(0)}`);

      // O(1) operations should complete in < 10ms for 10k operations
      expect(timeMs).toBeLessThan(10);
      expect(timePerHitUs).toBeLessThan(1); // < 1 microsecond per hit

      done();
    });

    it('should maintain 95%+ hit rate under continuous access', () => {
      // Populate cache
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { data: 'value-' + i });
      }

      const iterations = 1000;
      let hitCount = 0;

      // Access same keys repeatedly
      for (let i = 0; i < iterations; i++) {
        const key = `key-${i % 100}`;
        const value = cache.get(key);
        if (value) hitCount++;
      }

      const hitRate = (hitCount / iterations) * 100;
      expect(hitRate).toBeGreaterThanOrEqual(95);
      console.log(`\n  Hit rate: ${hitRate.toFixed(2)}%`);
    });

    it('should correctly maintain LRU order during access patterns', () => {
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      // Access some keys to change LRU order
      cache.get('key-5');
      cache.get('key-3');
      cache.get('key-7');
      cache.get('key-1');

      // Get all entries sorted by access (most recent first in linked list)
      // The head should be 'key-1', tail should be 'key-0' or one of the non-accessed keys
      expect(cache.head).toBeTruthy();
      expect(cache.head.key).toBe('key-1'); // Most recently accessed
      expect(cache.tail).toBeTruthy(); // LRU candidate
    });
  });

  describe('Eviction Performance', () => {
    it('should evict LRU entry in O(1) time', () => {
      // Fill cache to capacity
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      const startTime = process.hrtime.bigint();

      // Trigger 100 evictions
      for (let i = 100; i < 200; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      const endTime = process.hrtime.bigint();
      const timeMs = Number(endTime - startTime) / 1000000;
      const timePerEvictionUs = Number(endTime - startTime) / 100 / 1000;

      console.log(`\n  Eviction Performance:`);
      console.log(`    Time for 100 evictions: ${timeMs.toFixed(2)}ms`);
      console.log(`    Average time per eviction: ${timePerEvictionUs.toFixed(2)}µs`);

      // O(1) evictions should be very fast
      expect(timePerEvictionUs).toBeLessThan(1);
      expect(cache.stats.evictions).toBe(100);
    });

    it('should correctly evict least recently used entries', () => {
      // Add 5 entries
      for (let i = 0; i < 5; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      // Access some to mark as recently used
      cache.get('key-1');
      cache.get('key-3');

      // Set cache max to 4 entries
      cache.options.maxEntries = 4;

      // Add new entry, should evict key-0 (least recently used)
      cache.set('key-5', { value: 5 });

      expect(cache.cache.has('key-0')).toBe(false);
      expect(cache.cache.has('key-1')).toBe(true);
      expect(cache.cache.has('key-5')).toBe(true);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not accumulate stale references in linked list', () => {
      // Add and delete many entries
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, { value: i });
        cache.delete(`key-${i}`);
      }

      // keyToNode map should be empty
      expect(cache.keyToNode.size).toBe(0);
      // Linked list should be empty
      expect(cache.head).toBeNull();
      expect(cache.tail).toBeNull();
    });

    it('should handle rapid set/get/delete cycles', () => {
      const iterations = 1000;
      const keys = [];

      // Rapid add/access/remove
      for (let i = 0; i < iterations; i++) {
        const key = `key-${i % 50}`;
        cache.set(key, { value: i });
        cache.get(key);

        if (i % 10 === 0) {
          cache.delete(key);
        }

        keys.push(key);
      }

      // Verify consistency
      expect(cache.cache.size).toBeLessThanOrEqual(50);
      expect(cache.keyToNode.size).toBe(cache.cache.size);
    });
  });

  describe('Statistics Accuracy', () => {
    it('should accurately track hit/miss rates', () => {
      // Add entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      // Perform hits and misses
      cache.get('key-0');
      cache.get('key-1');
      cache.get('key-0'); // Hit again
      cache.get('key-999'); // Miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('75.00');
    });

    it('should track evictions correctly', () => {
      cache.options.maxEntries = 5;

      // Fill and overflow
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      expect(cache.stats.evictions).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-entry cache correctly', () => {
      cache.options.maxEntries = 1;

      cache.set('key-1', { value: 1 });
      expect(cache.get('key-1')).toBeTruthy();

      cache.set('key-2', { value: 2 });
      expect(cache.get('key-1')).toBeNull(); // Evicted
      expect(cache.get('key-2')).toBeTruthy();
    });

    it('should handle expired entries correctly', (done) => {
      cache.options.ttlMs = 100;

      cache.set('key-1', { value: 1 });
      expect(cache.get('key-1')).toBeTruthy();

      setTimeout(() => {
        expect(cache.get('key-1')).toBeNull(); // Expired
        expect(cache.keyToNode.size).toBe(0);
        done();
      }, 150);
    });

    it('should handle clear() correctly', () => {
      for (let i = 0; i < 50; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      cache.clear();

      expect(cache.cache.size).toBe(0);
      expect(cache.keyToNode.size).toBe(0);
      expect(cache.head).toBeNull();
      expect(cache.tail).toBeNull();
      expect(cache.stats.currentMemoryUsage).toBe(0);
    });
  });

  describe('Linked List Integrity', () => {
    it('should maintain valid linked list structure', () => {
      // Add entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key-${i}`, { value: i });
      }

      // Verify linked list integrity
      let current = cache.head;
      let count = 0;
      const visited = new Set();

      while (current) {
        count++;
        expect(visited.has(current.key)).toBe(false); // No cycles
        visited.add(current.key);
        expect(cache.cache.has(current.key)).toBe(true); // Node key exists in cache
        current = current.next;
      }

      expect(count).toBe(cache.cache.size);
      expect(visited.size).toBe(cache.keyToNode.size);
    });

    it('should maintain correct head/tail pointers', () => {
      cache.set('key-1', { value: 1 });
      expect(cache.head.key).toBe('key-1');
      expect(cache.tail.key).toBe('key-1');

      cache.set('key-2', { value: 2 });
      expect(cache.head.key).toBe('key-2');
      expect(cache.tail.key).toBe('key-1');

      cache.set('key-3', { value: 3 });
      expect(cache.head.key).toBe('key-3');
      expect(cache.tail.key).toBe('key-1');

      cache.get('key-1'); // Move to front
      expect(cache.head.key).toBe('key-1');
    });
  });
});

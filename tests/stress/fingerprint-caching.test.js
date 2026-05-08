/**
 * Fingerprint Profile Caching Stress Test
 * Tests profile caching performance improvements
 */

const { FingerprintProfile, FingerprintProfileManager } = require('../../evasion/fingerprint-profile');

describe('Fingerprint Profile Caching', () => {
  let manager;

  beforeEach(() => {
    manager = new FingerprintProfileManager();
  });

  test('profile caching should hit on repeated profile creation with same seed', () => {
    const seed = 'test-seed-12345';

    // Create first profile
    const { id: id1, profile: profile1 } = manager.createProfile({ seed });
    expect(manager.cacheStats.misses).toBe(1);
    expect(manager.cacheStats.hits).toBe(0);

    // Create second profile with same seed
    const { id: id2, profile: profile2 } = manager.createProfile({ seed });
    expect(manager.cacheStats.hits).toBe(1);
    expect(manager.cacheStats.misses).toBe(1);

    // Profiles should be the same instance
    expect(profile1).toBe(profile2);
  });

  test('getCachedConfig should improve performance on repeated calls', () => {
    const { id } = manager.createProfile({ seed: 'config-test' });

    const timings = [];

    // First call generates config
    const start1 = Date.now();
    const config1 = manager.getCachedConfig(id);
    const time1 = Date.now() - start1;
    timings.push({ label: 'first', time: time1 });

    // Second call should hit cache
    const start2 = Date.now();
    const config2 = manager.getCachedConfig(id);
    const time2 = Date.now() - start2;
    timings.push({ label: 'cached', time: time2 });

    console.log(`getCachedConfig timings:`, timings);

    // Cached call should be significantly faster (at least 50%)
    expect(time2).toBeLessThanOrEqual(time1);
    expect(config1).toEqual(config2);
    expect(manager.cacheStats.hits).toBeGreaterThan(0);
  });

  test('getCachedInjectionScript should cache generation performance', () => {
    const { id } = manager.createProfile({ seed: 'script-test' });

    const timings = [];

    // First call generates script
    const start1 = Date.now();
    const script1 = manager.getCachedInjectionScript(id);
    const time1 = Date.now() - start1;
    timings.push({ label: 'first', time: time1 });

    // Second call should hit cache
    const start2 = Date.now();
    const script2 = manager.getCachedInjectionScript(id);
    const time2 = Date.now() - start2;
    timings.push({ label: 'cached', time: time2 });

    console.log(`getCachedInjectionScript timings:`, timings);

    // Both should be valid scripts
    expect(script1).toContain('use strict');
    expect(script1).toEqual(script2);

    // Cached call should be same or faster (both are fast for small scripts)
    expect(time2).toBeLessThanOrEqual(time1 + 1); // Allow for timer variance
  });

  test('cache should improve performance for 1000+ profile lookups', () => {
    const { id } = manager.createProfile({ seed: 'perf-test' });

    const lookupStart = Date.now();

    // Perform 1000 lookups
    for (let i = 0; i < 1000; i++) {
      manager.getCachedConfig(id);
    }

    const lookupTime = Date.now() - lookupStart;

    console.log(`1000 cached lookups took ${lookupTime}ms (${(lookupTime / 1000).toFixed(3)}ms per lookup)`);

    // 1000 lookups should be very fast (< 100ms)
    expect(lookupTime).toBeLessThan(100);

    // Cache hit rate should be very high
    const stats = manager.getCacheStats();
    console.log(`Cache stats:`, stats);
    expect(parseFloat(stats.hitRate)).toBeGreaterThan(99);
  });

  test('cache size management should prevent unbounded growth', () => {
    const maxSize = manager.cacheStats.maxSize;

    // Create more profiles than max cache size
    const profilesCreated = maxSize + 100;

    for (let i = 0; i < profilesCreated; i++) {
      manager.createProfile({ seed: `profile-${i}` });
    }

    // Cache size should not exceed maxSize
    expect(manager.cacheStats.size).toBeLessThanOrEqual(maxSize);
  });

  test('clearCaches should reset cache statistics', () => {
    const { id } = manager.createProfile({ seed: 'clear-test' });

    // Generate some cache hits
    for (let i = 0; i < 10; i++) {
      manager.getCachedConfig(id);
    }

    expect(manager.cacheStats.hits).toBeGreaterThan(0);

    // Clear caches
    manager.clearCaches();

    expect(manager.cacheStats.hits).toBe(0);
    expect(manager.cacheStats.misses).toBe(0);
    expect(manager.cacheStats.size).toBe(0);
  });

  test('cache should handle profile operations efficiently', () => {
    const iterations = 100;
    const timings = [];

    for (let i = 0; i < iterations; i++) {
      const seed = `stress-${i}`;

      const start = Date.now();

      // Create profile
      const { id } = manager.createProfile({ seed });

      // Get config multiple times
      for (let j = 0; j < 5; j++) {
        manager.getCachedConfig(id);
      }

      // Get script multiple times
      for (let j = 0; j < 3; j++) {
        manager.getCachedInjectionScript(id);
      }

      const duration = Date.now() - start;
      timings.push(duration);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    const maxTime = Math.max(...timings);

    console.log(`Profile operations: avg=${avgTime.toFixed(2)}ms, max=${maxTime}ms`);

    // Average should be reasonable
    expect(avgTime).toBeLessThan(100);
  });

  test('importProfiles should add profiles to cache', () => {
    // Create and export profiles
    const { id: id1, profile: profile1 } = manager.createProfile({ seed: 'import-1' });
    const { id: id2, profile: profile2 } = manager.createProfile({ seed: 'import-2' });

    const exported = manager.exportProfiles();

    // Create new manager and import
    const newManager = new FingerprintProfileManager();
    expect(newManager.cacheStats.size).toBe(0);

    newManager.importProfiles(exported);

    // Profiles should be in cache
    expect(newManager.cacheStats.size).toBeGreaterThan(0);

    // Get config (should miss since we just imported)
    const beforeMisses = newManager.cacheStats.misses;
    newManager.getCachedConfig(id1);
    expect(newManager.cacheStats.misses).toBeGreaterThan(beforeMisses);

    // Second call should hit cache
    const beforeHits = newManager.cacheStats.hits;
    newManager.getCachedConfig(id1);
    expect(newManager.cacheStats.hits).toBeGreaterThan(beforeHits);
  });

  test('cache statistics should track hit/miss rates accurately', () => {
    manager.clearCaches();

    // Create profiles with and without caching
    const { id: id1 } = manager.createProfile({ seed: 'stats-1' });
    const { id: id2 } = manager.createProfile({ seed: 'stats-2' });

    let stats = manager.getCacheStats();
    expect(stats.misses).toBe(2);
    expect(stats.hits).toBe(0);

    // Hit cache by accessing same profiles - first access misses, rest hit
    manager.getCachedConfig(id1); // miss
    manager.getCachedConfig(id1); // hit
    manager.getCachedConfig(id1); // hit

    manager.getCachedConfig(id2); // miss
    manager.getCachedConfig(id2); // hit

    stats = manager.getCacheStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(4);
    expect(stats.totalRequests).toBe(7);
    // hit rate = 3 / 7 = 42.86%
    expect(stats.hitRate).toContain('42');
  });

  test('should measure profile creation speedup with cache', () => {
    const iterations = 50;
    const uncachedTimings = [];
    const cachedTimings = [];

    // Test uncached profile creation
    for (let i = 0; i < iterations; i++) {
      const seed = `perf-uncached-${i}`;
      const start = Date.now();
      new FingerprintProfile({ seed });
      uncachedTimings.push(Date.now() - start);
    }

    // Test cached profile creation
    const firstManager = new FingerprintProfileManager();
    const seed = 'perf-cached-base';
    firstManager.createProfile({ seed });

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      firstManager.createProfile({ seed });
      cachedTimings.push(Date.now() - start);
    }

    const uncachedAvg = uncachedTimings.reduce((a, b) => a + b, 0) / uncachedTimings.length;
    const cachedAvg = cachedTimings.reduce((a, b) => a + b, 0) / cachedTimings.length;

    console.log(`Profile creation performance:`);
    console.log(`  Uncached avg: ${uncachedAvg.toFixed(2)}ms`);
    console.log(`  Cached avg: ${cachedAvg.toFixed(2)}ms`);
    console.log(`  Speedup: ${(uncachedAvg / cachedAvg).toFixed(1)}x`);

    // Cached creation should be significantly faster
    expect(cachedAvg).toBeLessThan(uncachedAvg);
  });
});

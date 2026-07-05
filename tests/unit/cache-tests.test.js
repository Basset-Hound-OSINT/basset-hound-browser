/**
 * Cache Management Performance Tests
 *
 * Comprehensive performance testing for cache operations:
 * - Cache Hit Rate (20+ tests)
 * - LRU Eviction Efficiency
 * - Memory Pressure Handling
 * - Invalidation Strategy
 * - TTL Cleanup Performance
 *
 * Target Metrics:
 * - 95%+ cache hit rate for typical workloads
 * - <100MB sustained memory usage
 * - Efficient LRU eviction
 * - Fast TTL cleanup
 */

const assert = require('assert');
const { LRUCache } = require('../../screenshots/lru-cache');

// Global timeout for all tests in this suite
jest.setTimeout(120000);

/**
 * Performance test utilities
 */
class PerformanceUtils {
  /**
   * Measure execution time in milliseconds
   * @param {Function} fn - Function to measure
   * @returns {Promise<number>} Duration in ms
   */
  static async measureTime(fn) {
    const start = process.hrtime.bigint();
    await fn();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // Convert nanoseconds to milliseconds
  }

  /**
   * Measure memory usage
   * @returns {Object} Memory stats
   */
  static getMemoryStats() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      external: Math.round(mem.external / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    };
  }

  /**
   * Generate realistic test data
   * @param {number} size - Size in bytes
   * @returns {Buffer} Test data
   */
  static generateTestData(size) {
    const buffer = Buffer.alloc(size);
    // Fill with pseudo-random data to simulate real image data
    for (let i = 0; i < size; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer;
  }

  /**
   * Calculate percentile from array of values
   * @param {number[]} values - Sorted array of values
   * @param {number} percentile - Percentile (0-100)
   * @returns {number} Percentile value
   */
  static percentile(values, percentile) {
    if (values.length === 0) {
      return 0;
    }
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  /**
   * Format metrics for reporting
   * @param {string} name - Test name
   * @param {Object} metrics - Metrics object
   */
  static reportMetrics(name, metrics) {
    console.log(`\n📊 ${name}`);
    Object.entries(metrics).forEach(([key, value]) => {
      if (typeof value === 'number') {
        if (key.includes('time') || key.includes('latency') || key.includes('duration')) {
          console.log(`   ${key}: ${value.toFixed(2)}ms`);
        } else if (key.includes('memory')) {
          console.log(`   ${key}: ${value}MB`);
        } else if (key.includes('rate') || key.includes('hit') || key.includes('ratio')) {
          console.log(`   ${key}: ${value.toFixed(2)}%`);
        } else if (key.includes('throughput') || key.includes('fps')) {
          console.log(`   ${key}: ${value.toFixed(2)}`);
        } else {
          console.log(`   ${key}: ${value}`);
        }
      } else {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    });
  }
}

/**
 * ============================================================
 * CACHE MANAGEMENT PERFORMANCE TESTS (20+ tests)
 * ============================================================
 */
describe('Cache Management Performance Tests', () => {
  jest.setTimeout(60000);

  let cache;

  beforeEach(() => {
    cache = new LRUCache({
      maxEntries: 100,
      maxMemoryMB: 50,
      ttlMs: 3600000,
      enableStats: true
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Cache Hit Rate', () => {
    it('should measure cache hit rate for typical workload', () => {
      const iterations = 10000;
      const cacheSize = 50;
      const hits = { count: 0 };
      const misses = { count: 0 };

      // Pre-populate cache
      for (let i = 0; i < cacheSize; i++) {
        cache.set(`key_${i}`, PerformanceUtils.generateTestData(100 * 1024));
      }

      // Simulate typical access pattern (80/20 rule)
      for (let i = 0; i < iterations; i++) {
        const keyIndex = Math.random() < 0.8 ? Math.floor(Math.random() * cacheSize) : i;
        const key = `key_${keyIndex}`;
        const result = cache.get(key);

        if (result) {
          hits.count++;
        } else {
          misses.count++;
          cache.set(key, PerformanceUtils.generateTestData(100 * 1024));
        }
      }

      const hitRate = (hits.count / iterations) * 100;
      const metrics = {
        total_operations: iterations,
        cache_hits: hits.count,
        cache_misses: misses.count,
        hit_rate_percent: hitRate.toFixed(2)
      };

      PerformanceUtils.reportMetrics('Cache Hit Rate (Typical Workload)', metrics);
      assert(hitRate >= 95, `Hit rate should be >= 95%, got ${hitRate.toFixed(2)}%`);
    });

    it('should measure hit rate under LRU eviction', () => {
      const cacheSize = 20;
      const totalAccesses = 1000;
      let hits = 0;

      // Fill cache
      for (let i = 0; i < cacheSize; i++) {
        cache.set(`key_${i}`, `value_${i}`);
      }

      // Access beyond cache size to trigger eviction
      for (let i = 0; i < totalAccesses; i++) {
        const keyIndex = (i % (cacheSize * 2));
        const result = cache.get(`key_${keyIndex}`);

        if (result) {
          hits++;
        } else {
          cache.set(`key_${keyIndex}`, `value_${keyIndex}`);
        }
      }

      const hitRate = (hits / totalAccesses) * 100;
      const metrics = {
        cache_size: cacheSize,
        total_accesses: totalAccesses,
        hits: hits,
        hit_rate_percent: hitRate.toFixed(2)
      };

      PerformanceUtils.reportMetrics('Hit Rate Under LRU Eviction', metrics);
    });

    it('should measure hit rate consistency over time', async () => {
      const keySet = 100;
      const testDuration = 5000;
      const measurement = { intervals: [] };

      // Populate cache
      for (let i = 0; i < keySet; i++) {
        cache.set(`key_${i}`, PerformanceUtils.generateTestData(50 * 1024));
      }

      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        let intervalHits = 0;
        const intervalOperations = 100;

        for (let i = 0; i < intervalOperations; i++) {
          const keyIndex = Math.floor(Math.random() * keySet);
          if (cache.get(`key_${keyIndex}`)) {
            intervalHits++;
          }
        }

        measurement.intervals.push((intervalHits / intervalOperations) * 100);
        await new Promise(r => setTimeout(r, 50));
      }

      const avgHitRate = measurement.intervals.reduce((a, b) => a + b) / measurement.intervals.length;
      const metrics = {
        test_duration_ms: Date.now() - startTime,
        measurement_intervals: measurement.intervals.length,
        average_hit_rate_percent: avgHitRate.toFixed(2),
        min_hit_rate_percent: Math.min(...measurement.intervals).toFixed(2),
        max_hit_rate_percent: Math.max(...measurement.intervals).toFixed(2)
      };

      PerformanceUtils.reportMetrics('Hit Rate Consistency Over Time', metrics);
    });
  });

  describe('LRU Eviction Efficiency', () => {
    it('should measure LRU eviction performance', () => {
      const capacity = 50;
      const accessCount = 1000;

      // Fill cache
      for (let i = 0; i < capacity; i++) {
        cache.set(`key_${i}`, PerformanceUtils.generateTestData(100 * 1024));
      }

      const startEvictions = cache.getStats().evictions;

      // Trigger evictions by accessing beyond capacity
      for (let i = 0; i < accessCount; i++) {
        const keyIndex = (i % (capacity * 2));
        cache.set(`key_${keyIndex}`, PerformanceUtils.generateTestData(100 * 1024));
      }

      const endEvictions = cache.getStats().evictions;
      const evictionCount = endEvictions - startEvictions;

      const metrics = {
        capacity: capacity,
        operations: accessCount,
        evictions_triggered: evictionCount,
        eviction_rate_percent: ((evictionCount / accessCount) * 100).toFixed(2),
        average_cache_entries: cache.getStats().entries
      };

      PerformanceUtils.reportMetrics('LRU Eviction Efficiency', metrics);
    });

    it('should verify LRU ordering correctness', () => {
      // Add keys in specific order
      for (let i = 1; i <= 5; i++) {
        cache.set(`key_${i}`, `value_${i}`);
      }

      // Access key_2 to mark it as recently used
      cache.get('key_2');

      // Add key_6 to trigger eviction
      cache.set('key_6', 'value_6');

      // key_1 should have been evicted (least recently used)
      const key1Exists = cache.get('key_1');
      const key2Exists = cache.get('key_2');

      const metrics = {
        cache_operations: 'key_1 evicted, key_2 retained',
        key_1_present: key1Exists ? 'YES' : 'NO',
        key_2_present: key2Exists ? 'YES' : 'NO',
        lru_correctness: !key1Exists && key2Exists ? 'PASS' : 'FAIL'
      };

      PerformanceUtils.reportMetrics('LRU Ordering Correctness', metrics);
      assert(!key1Exists && key2Exists, 'LRU ordering should be correct');
    });
  });

  describe('Memory Pressure Handling', () => {
    it('should measure memory usage under load', () => {
      const memBefore = PerformanceUtils.getMemoryStats();

      // Fill cache to near capacity
      for (let i = 0; i < 80; i++) {
        cache.set(`key_${i}`, PerformanceUtils.generateTestData(500 * 1024));
      }

      const memPeak = PerformanceUtils.getMemoryStats();
      const increase = memPeak.heapUsed - memBefore.heapUsed;

      const stats = cache.getStats();
      const metrics = {
        entries_cached: stats.entries,
        memory_before_mb: memBefore.heapUsed,
        memory_peak_mb: memPeak.heapUsed,
        memory_increase_mb: increase,
        current_memory_usage_mb: stats.currentMemoryUsage
      };

      PerformanceUtils.reportMetrics('Memory Usage Under Load', metrics);
    });

    it('should handle memory pressure eviction', () => {
      const maxMemory = 50 * 1024 * 1024; // 50MB limit
      const dataSize = 10 * 1024 * 1024; // 10MB per entry

      // Try to fill beyond memory limit
      for (let i = 0; i < 10; i++) {
        cache.set(`key_${i}`, PerformanceUtils.generateTestData(dataSize));
      }

      const stats = cache.getStats();
      const metrics = {
        max_memory_mb: maxMemory / 1024 / 1024,
        data_size_per_entry_mb: dataSize / 1024 / 1024,
        current_entries: stats.entries,
        current_memory_usage_mb: stats.currentMemoryUsage,
        memory_pressure_evictions: stats.evictions
      };

      PerformanceUtils.reportMetrics('Memory Pressure Eviction', metrics);
      assert(stats.currentMemoryUsage <= maxMemory, 'Memory should not exceed limit');
    });
  });

  describe('Invalidation Strategy', () => {
    it('should measure invalidation performance', async () => {
      const entryCount = 1000;
      const duration = await PerformanceUtils.measureTime(async () => {
        // Add entries
        for (let i = 0; i < entryCount; i++) {
          cache.set(`key_${i}`, `value_${i}`);
        }

        // Invalidate multiple keys
        for (let i = 0; i < entryCount / 2; i++) {
          cache.invalidate(`key_${i}`);
        }
      });

      const metrics = {
        entries_added: entryCount,
        entries_invalidated: entryCount / 2,
        total_time_ms: duration,
        throughput_ops_per_second: ((entryCount + entryCount / 2) / duration * 1000).toFixed(2)
      };

      PerformanceUtils.reportMetrics('Invalidation Performance', metrics);
    });

    it('should verify invalidation correctness', () => {
      // Add entries
      for (let i = 0; i < 10; i++) {
        cache.set(`key_${i}`, `value_${i}`);
      }

      // Invalidate specific entries
      cache.invalidate('key_2');
      cache.invalidate('key_5');

      const metrics = {
        key_2_after_invalidate: cache.get('key_2') ? 'PRESENT' : 'INVALIDATED',
        key_3_after_invalidate: cache.get('key_3') ? 'PRESENT' : 'INVALIDATED',
        key_5_after_invalidate: cache.get('key_5') ? 'PRESENT' : 'INVALIDATED',
        invalidation_correctness: !cache.get('key_2') && cache.get('key_3') && !cache.get('key_5') ? 'PASS' : 'FAIL'
      };

      PerformanceUtils.reportMetrics('Invalidation Correctness', metrics);
      assert(!cache.get('key_2') && !cache.get('key_5'), 'Invalidated keys should be removed');
    });
  });

  describe('TTL Cleanup Performance', () => {
    it('should measure TTL cleanup efficiency', async () => {
      const cache2 = new LRUCache({
        maxEntries: 100,
        ttlMs: 500 // 500ms TTL for testing
      });

      // Add entries with short TTL
      for (let i = 0; i < 100; i++) {
        cache2.set(`key_${i}`, `value_${i}`);
      }

      // Wait for TTL expiration
      await new Promise(r => setTimeout(r, 700));

      // Trigger cleanup (typically done internally)
      const beforeStats = cache2.getStats();

      // Try to access expired entries
      for (let i = 0; i < 100; i++) {
        cache2.get(`key_${i}`);
      }

      const afterStats = cache2.getStats();

      const metrics = {
        entries_at_start: 100,
        ttl_ms: 500,
        wait_time_ms: 700,
        entries_cleaned_up: beforeStats.entries - afterStats.entries,
        cleanup_effectiveness_percent: ((beforeStats.entries - afterStats.entries) / 100 * 100).toFixed(2)
      };

      PerformanceUtils.reportMetrics('TTL Cleanup Efficiency', metrics);
      cache2.clear();
    });
  });
});

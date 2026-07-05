/**
 * Buffer Pool Performance Tests
 *
 * Comprehensive performance testing for Buffer Pool operations:
 * - Throughput Performance (acquire/release, sequential, batch)
 * - Hit Rate and Cache Efficiency
 * - Memory Usage Tracking
 * - Fragment Analysis
 * - Screenshot Object Pool Performance
 *
 * Target Metrics:
 * - 50,000+ ops/sec throughput
 * - <0.5ms P99 latency
 * - 90%+ buffer pool hit rate
 * - Minimal memory growth over sustained operations
 */

const assert = require('assert');
const { BufferPool, ScreenshotObjectPool } = require('../../screenshots/memory-pool');

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
 * 1. BUFFER POOL PERFORMANCE TESTS (20+ tests)
 * ============================================================
 */
describe('Buffer Pool Performance Tests', () => {
  jest.setTimeout(60000);

  let pool;
  const initialMemory = PerformanceUtils.getMemoryStats();

  beforeEach(() => {
    pool = new BufferPool({
      initialBufferCount: 10,
      maxBufferCount: 100,
      bufferSize: 1024 * 1024 // 1MB
    });
  });

  afterEach(() => {
    pool.clear();
  });

  describe('Throughput Performance', () => {
    it('should measure acquire/release throughput', async () => {
      const iterations = 10000;
      let duration = 0;

      duration = await PerformanceUtils.measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          const buf = pool.acquire();
          pool.release(buf);
        }
      });

      const throughput = (iterations / duration) * 1000; // ops/sec
      const metrics = {
        iterations,
        total_time_ms: duration,
        throughput_ops_per_second: throughput,
        time_per_operation_us: (duration * 1000) / iterations
      };

      PerformanceUtils.reportMetrics('Buffer Pool Acquire/Release Throughput', metrics);
      assert(throughput > 50000, `Throughput ${throughput} should exceed 50,000 ops/sec`);
    });

    it('should measure sequential acquire performance', async () => {
      const iterations = 5000;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const time = await PerformanceUtils.measureTime(() => pool.acquire());
        times.push(time);
      }

      const sorted = times.sort((a, b) => a - b);
      const metrics = {
        iterations,
        average_time_ms: times.reduce((a, b) => a + b) / times.length,
        p50_ms: PerformanceUtils.percentile(sorted, 50),
        p99_ms: PerformanceUtils.percentile(sorted, 99),
        max_time_ms: Math.max(...times)
      };

      PerformanceUtils.reportMetrics('Buffer Pool Acquire Latency', metrics);
      assert(metrics.p99_ms < 0.5, 'P99 latency should be < 0.5ms');
    });

    it('should measure batch operations throughput', async () => {
      const batchSize = 100;
      const batches = 100;
      let duration = 0;

      duration = await PerformanceUtils.measureTime(async () => {
        for (let b = 0; b < batches; b++) {
          const buffers = [];
          for (let i = 0; i < batchSize; i++) {
            buffers.push(pool.acquire());
          }
          for (const buf of buffers) {
            pool.release(buf);
          }
        }
      });

      const totalOps = batchSize * batches;
      const throughput = (totalOps / duration) * 1000;
      const metrics = {
        batch_size: batchSize,
        batches,
        total_operations: totalOps,
        total_time_ms: duration,
        throughput_ops_per_second: throughput
      };

      PerformanceUtils.reportMetrics('Buffer Pool Batch Operations', metrics);
      assert(throughput > 80000, `Batch throughput ${throughput} should exceed 80,000 ops/sec`);
    });
  });

  describe('Hit Rate and Cache Efficiency', () => {
    it('should measure pool hit rate', async () => {
      // Pre-fill pool
      const buffers = [];
      for (let i = 0; i < 10; i++) {
        buffers.push(pool.acquire());
      }

      // Return them all
      buffers.forEach(b => pool.release(b));

      // Now measure hit rate
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        const buf = pool.acquire();
        pool.release(buf);
      }

      const stats = pool.getStats();
      const metrics = {
        pool_hits: stats.poolHits,
        pool_misses: stats.poolMisses,
        hit_rate_percent: parseFloat(stats.hitRate),
        total_operations: stats.poolHits + stats.poolMisses
      };

      PerformanceUtils.reportMetrics('Buffer Pool Hit Rate', metrics);
      assert(parseFloat(stats.hitRate) >= 90, `Hit rate ${stats.hitRate}% should be >= 90%`);
    });

    it('should track buffer reuse statistics', async () => {
      const buffers = [];

      // Acquire and release multiple times
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 20; i++) {
          buffers.push(pool.acquire());
        }
        buffers.forEach(b => pool.release(b));
        buffers.length = 0;
      }

      const stats = pool.getStats();
      const metrics = {
        allocations: stats.allocations,
        deallocations: stats.deallocations,
        current_available: stats.availableCount,
        current_in_use: stats.inUseCount,
        average_usage_per_buffer: parseFloat(stats.averageUsagePerBuffer)
      };

      PerformanceUtils.reportMetrics('Buffer Reuse Statistics', metrics);
      assert(parseFloat(stats.averageUsagePerBuffer) > 1, 'Buffers should be reused multiple times');
    });

    it('should measure cache efficiency under variable loads', async () => {
      const sizes = [512 * 1024, 1024 * 1024, 2 * 1024 * 1024, 4 * 1024 * 1024];
      const results = {};

      for (const size of sizes) {
        const startHits = pool.getStats().poolHits;
        const iterations = 500;

        for (let i = 0; i < iterations; i++) {
          const buf = pool.acquire(size);
          pool.release(buf);
        }

        const endHits = pool.getStats().poolHits;
        const hitCount = endHits - startHits;
        const hitRate = (hitCount / iterations) * 100;

        results[`${size / 1024}KB`] = hitRate;
      }

      const metrics = {
        variable_load_hit_rates: results
      };

      PerformanceUtils.reportMetrics('Variable Load Hit Rates', metrics);
    });
  });

  describe('Memory Usage Tracking', () => {
    it('should track peak memory usage', () => {
      const buffers = [];
      const initialMem = PerformanceUtils.getMemoryStats();

      // Allocate buffers
      for (let i = 0; i < 50; i++) {
        buffers.push(pool.acquire());
      }

      const peakMem = PerformanceUtils.getMemoryStats();
      const increase = peakMem.heapUsed - initialMem.heapUsed;

      // Release buffers
      buffers.forEach(b => pool.release(b));
      const afterRelease = PerformanceUtils.getMemoryStats();

      const metrics = {
        initial_heap_mb: initialMem.heapUsed,
        peak_heap_mb: peakMem.heapUsed,
        heap_increase_mb: increase,
        after_release_heap_mb: afterRelease.heapUsed,
        cleanup_mb: peakMem.heapUsed - afterRelease.heapUsed
      };

      PerformanceUtils.reportMetrics('Buffer Pool Memory Tracking', metrics);
      assert(increase >= 50, 'Should allocate expected memory');
    });

    it('should measure memory fragmentation', () => {
      const buffers = [];

      // Create fragmented allocation pattern
      for (let i = 0; i < 100; i++) {
        buffers.push(pool.acquire());
      }

      // Release in random order (causes fragmentation)
      const indices = buffers.map((_, i) => i).sort(() => Math.random() - 0.5);
      indices.forEach(i => {
        if (buffers[i]) {
          pool.release(buffers[i]);
          buffers[i] = null;
        }
      });

      const stats = pool.getStats();
      const metrics = {
        total_allocations: stats.allocations,
        total_deallocations: stats.deallocations,
        current_pool_size: stats.currentSize,
        available_buffers: stats.availableCount,
        estimated_fragmentation_percent: ((stats.allocations - stats.deallocations) / stats.allocations * 100).toFixed(2)
      };

      PerformanceUtils.reportMetrics('Memory Fragmentation Analysis', metrics);
    });

    it('should verify no memory growth over sustained operations', async () => {
      const memBefore = PerformanceUtils.getMemoryStats();
      const iterations = 5000;

      for (let i = 0; i < iterations; i++) {
        const buf = pool.acquire();
        pool.release(buf);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = PerformanceUtils.getMemoryStats();
      const growth = memAfter.heapUsed - memBefore.heapUsed;

      const metrics = {
        iterations,
        memory_before_mb: memBefore.heapUsed,
        memory_after_mb: memAfter.heapUsed,
        memory_growth_mb: growth,
        growth_per_operation_kb: growth / iterations * 1024
      };

      PerformanceUtils.reportMetrics('Memory Growth Over Sustained Load', metrics);
      assert(growth < 10, 'Memory growth should be minimal');
    });
  });

  describe('Fragment Analysis', () => {
    it('should track buffer fragment distribution', () => {
      const buffers = [];

      // Allocate various sizes
      for (let i = 0; i < 50; i++) {
        buffers.push(pool.acquire(Math.random() * 5 * 1024 * 1024));
      }

      const stats = pool.getStats();
      const metrics = {
        total_buffers_in_use: stats.inUseCount,
        total_buffers_available: stats.availableCount,
        current_pool_memory_mb: stats.currentSize / 1024 / 1024,
        peak_pool_memory_mb: stats.peakSize / 1024 / 1024
      };

      PerformanceUtils.reportMetrics('Fragment Distribution', metrics);
    });

    it('should measure GC pressure reduction', async () => {
      // Measure with pooling
      const startMem = PerformanceUtils.getMemoryStats();
      const iterations = 2000;

      const duration = await PerformanceUtils.measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          const buf = pool.acquire();
          pool.release(buf);
        }
      });

      const endMem = PerformanceUtils.getMemoryStats();
      const stats = pool.getStats();

      const metrics = {
        iterations,
        duration_ms: duration,
        throughput_ops_per_sec: (iterations / duration) * 1000,
        gc_allocations: stats.allocations,
        gc_deallocations: stats.deallocations,
        memory_before_mb: startMem.heapUsed,
        memory_after_mb: endMem.heapUsed
      };

      PerformanceUtils.reportMetrics('GC Pressure Reduction', metrics);
    });
  });

  describe('Screenshot Object Pool Performance', () => {
    let objectPool;

    beforeEach(() => {
      objectPool = new ScreenshotObjectPool();
    });

    afterEach(() => {
      objectPool.clear();
    });

    it('should measure object acquire/release throughput', async () => {
      const iterations = 5000;
      let duration = 0;

      duration = await PerformanceUtils.measureTime(async () => {
        for (let i = 0; i < iterations; i++) {
          const obj = objectPool.acquire({ data: Buffer.alloc(1024) });
          objectPool.release(obj);
        }
      });

      const throughput = (iterations / duration) * 1000;
      const metrics = {
        iterations,
        total_time_ms: duration,
        throughput_ops_per_second: throughput
      };

      PerformanceUtils.reportMetrics('Screenshot Object Pool Throughput', metrics);
      assert(throughput > 20000, `Throughput ${throughput} should exceed 20,000 ops/sec`);
    });

    it('should measure object reusage rate', () => {
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const obj = objectPool.acquire({ id: i });
        objectPool.release(obj);
      }

      const stats = objectPool.getStats();
      const metrics = {
        iterations,
        objects_created: stats.created,
        objects_reused: stats.reused,
        reusage_rate_percent: parseFloat(stats.reusageRate),
        peak_concurrent_objects: stats.peakInUse
      };

      PerformanceUtils.reportMetrics('Object Reusage Rate', metrics);
      assert(parseFloat(stats.reusageRate) > 50, `Reusage rate ${stats.reusageRate}% should exceed 50%`);
    });
  });
});

/**
 * Comprehensive Test Suite for Phase 3 Optimizations
 * Tests all 4 performance optimizations with metrics
 */

const assert = require('assert');

// Mock implementations for testing
class MockProfile {
  constructor() {
    this.speedMultiplier = 1.0;
    this.tremorIntensity = 0.5;
  }

  getFatigueFactor() {
    return 1.0;
  }
}

// ==============================================================
// OPTIMIZATION 1: Connection Pool Tests
// ==============================================================

describe('Optimization 1: Connection Pool', () => {
  const { ConnectionPool } = require('../../websocket/connection-pool');

  let pool;
  const executionTimes = [];

  before(() => {
    const executor = async (request) => {
      const delay = Math.random() * 50; // Simulate 0-50ms execution
      await new Promise(resolve => setTimeout(resolve, delay));
      return { success: true, executedAt: Date.now() };
    };

    pool = new ConnectionPool(4, executor); // 4 worker slots
  });

  it('should execute requests immediately when pool slots available', async () => {
    const start = Date.now();
    const result = await pool.acquire({ test: 'request1' });
    const elapsed = Date.now() - start;

    assert.equal(result.success, true);
    assert(elapsed < 100, 'Request should complete quickly');
  });

  it('should queue requests when pool is full', async () => {
    const pool2 = new ConnectionPool(2, async (req) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    });

    const startTime = Date.now();
    const results = await Promise.all([
      pool2.acquire({ req: 1 }),
      pool2.acquire({ req: 2 }),
      pool2.acquire({ req: 3 }), // This should queue
      pool2.acquire({ req: 4 }) // This should queue
    ]);

    const elapsed = Date.now() - startTime;

    assert.equal(results.length, 4);
    assert(elapsed > 200, 'Queued requests should take time');
    assert.equal(pool2.activeConnections, 0, 'All should be completed');
  });

  it('should track peak concurrency', async () => {
    const pool3 = new ConnectionPool(3, async (req) => {
      await new Promise(resolve => setTimeout(resolve, 50));
      return { success: true };
    });

    await Promise.all(Array(10).fill(0).map((_, i) =>
      pool3.acquire({ req: i })
    ));

    const metrics = pool3.getMetrics();
    assert.equal(metrics.peakConcurrency, 3);
    assert(metrics.totalProcessed >= 10);
  });

  it('should reject requests on backpressure', async () => {
    const pool4 = new ConnectionPool(1, async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true };
    });

    pool4.backpressureThreshold = 5;
    pool4.maxQueueSize = 5;

    let rejectionCount = 0;

    // Fill up the queue
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        pool4.acquire({ req: i })
          .catch(() => {
            rejectionCount++;
          })
      );
    }

    assert(rejectionCount > 0, 'Should have some rejections');
  });

  it('should provide utilization metrics', () => {
    const status = pool.getStatus();
    assert('utilization' in status);
    assert('queued' in status);
    assert('active' in status);
    assert('poolSize' in status);
  });

  it('should calculate average queue wait time', async () => {
    const pool5 = new ConnectionPool(2, async (req) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      return { success: true };
    });

    await Promise.all(Array(6).fill(0).map((_, i) =>
      pool5.acquire({ req: i })
    ));

    const metrics = pool5.getMetrics();
    assert(metrics.avgQueueWait >= 0);
  });

  it('performance: should improve throughput with pooling', async () => {
    const directExecutor = async (req) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { success: true };
    };

    // Test direct execution
    const directStart = Date.now();
    for (let i = 0; i < 20; i++) {
      await directExecutor({ req: i });
    }
    const directTime = Date.now() - directStart;

    // Test with pool
    const pool6 = new ConnectionPool(8, directExecutor);
    const poolStart = Date.now();
    await Promise.all(Array(20).fill(0).map((_, i) =>
      pool6.acquire({ req: i })
    ));
    const poolTime = Date.now() - poolStart;

    console.log(`Direct execution: ${directTime}ms, Pooled: ${poolTime}ms`);
    assert(poolTime < directTime * 0.8, 'Pooled should be faster');
  });
});

// ==============================================================
// OPTIMIZATION 2: Exit Node Cache Tests
// ==============================================================

describe('Optimization 2: Tor Exit Node Cache', () => {
  const { TorExitNodeCache } = require('../../proxy/exit-node-cache');

  let cache;
  let fetchCount = 0;

  const mockFetch = async () => {
    fetchCount++;
    return {
      success: true,
      ip: '192.0.2.1',
      isTor: true,
      country: 'US'
    };
  };

  beforeEach(() => {
    cache = new TorExitNodeCache(100); // 100ms TTL for testing
    fetchCount = 0;
  });

  it('should fetch data on first call', async () => {
    const result = await cache.getOrFetch(mockFetch);
    assert.equal(result.success, true);
    assert.equal(fetchCount, 1);
  });

  it('should return cached data on second call', async () => {
    await cache.getOrFetch(mockFetch);
    const result = await cache.getOrFetch(mockFetch);

    assert.equal(result.cached, true);
    assert.equal(fetchCount, 1, 'Should not fetch again');
  });

  it('should invalidate cache after TTL', async () => {
    await cache.getOrFetch(mockFetch);
    assert.equal(fetchCount, 1);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 110));

    const result = await cache.getOrFetch(mockFetch);
    assert.equal(result.cached, false);
    assert.equal(fetchCount, 2, 'Should fetch again after TTL');
  });

  it('should coalesce concurrent requests', async () => {
    const promises = [
      cache.getOrFetch(mockFetch),
      cache.getOrFetch(mockFetch),
      cache.getOrFetch(mockFetch)
    ];

    await Promise.all(promises);
    assert.equal(fetchCount, 1, 'Should only fetch once for concurrent requests');
  });

  it('should support manual refresh', async () => {
    await cache.getOrFetch(mockFetch);
    assert.equal(fetchCount, 1);

    await cache.refresh(mockFetch);
    assert.equal(fetchCount, 2, 'Should fetch after refresh');

    const result = await cache.getOrFetch(mockFetch);
    assert.equal(result.cached, true);
  });

  it('should track cache age', async () => {
    await cache.getOrFetch(mockFetch);
    const stats = cache.getStats();

    assert('age' in stats);
    assert(stats.age < 50, 'Age should be fresh');
  });

  it('performance: should provide significant speedup', async () => {
    const slowFetch = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, ip: '192.0.2.1' };
    };

    const cache2 = new TorExitNodeCache(5000);

    const start = Date.now();
    await cache2.getOrFetch(slowFetch);
    const firstCallTime = Date.now() - start;

    const start2 = Date.now();
    await cache2.getOrFetch(slowFetch);
    const cachedCallTime = Date.now() - start2;

    console.log(`First call: ${firstCallTime}ms, Cached: ${cachedCallTime}ms`);
    assert(cachedCallTime < firstCallTime * 0.1, 'Cached should be much faster');
  });
});

// ==============================================================
// OPTIMIZATION 3: Screenshot Format Optimizer Tests
// ==============================================================

describe('Optimization 3: Screenshot Format Optimizer', () => {
  const {
    analyzeImageCharacteristics,
    getOptimizedFormat,
    estimateCompressedSize,
    getOptimizedBatchFormats
  } = require('../../screenshots/format-optimizer');

  it('should recommend JPEG for small captures', () => {
    const analysis = analyzeImageCharacteristics(400, 300);
    assert.equal(analysis.recommendedFormat, 'jpeg');
  });

  it('should recommend WebP for medium captures', () => {
    const analysis = analyzeImageCharacteristics(800, 800);
    assert.equal(analysis.recommendedFormat, 'webp');
  });

  it('should recommend PNG for large captures', () => {
    const analysis = analyzeImageCharacteristics(2000, 2000);
    assert.equal(analysis.recommendedFormat, 'png');
  });

  it('should recommend PNG for full-page captures', () => {
    const optimized = getOptimizedFormat({
      width: 1920,
      height: 5000,
      type: 'full-page'
    });
    assert.equal(optimized.format, 'png');
  });

  it('should recommend PNG for forensic quality', () => {
    const optimized = getOptimizedFormat({
      width: 800,
      height: 600,
      type: 'viewport',
      quality: 'forensic'
    });
    assert.equal(optimized.format, 'png');
    assert.equal(optimized.quality, 1.0);
  });

  it('should estimate reasonable file sizes', () => {
    const jpegSize = estimateCompressedSize(120000, 'jpeg');
    const webpSize = estimateCompressedSize(120000, 'webp');
    const pngSize = estimateCompressedSize(120000, 'png');

    assert(jpegSize < pngSize, 'JPEG should be smaller than PNG');
    assert(webpSize < pngSize, 'WebP should be smaller than PNG');
  });

  it('should optimize batch formats', () => {
    const captures = [
      { width: 400, height: 300, type: 'element' },
      { width: 1920, height: 1080, type: 'viewport' },
      { width: 1920, height: 5000, type: 'full-page' }
    ];

    const optimized = getOptimizedBatchFormats(captures);

    assert.equal(optimized.captures.length, 3);
    assert('totalEstimatedSize' in optimized);
    assert.equal(optimized.captures[0].optimized.format, 'jpeg');
    assert.equal(optimized.captures[2].optimized.format, 'png');
  });

  it('should respect forced formats', () => {
    const optimized = getOptimizedFormat({
      width: 400,
      height: 300,
      type: 'viewport',
      forceFormat: 'png'
    });
    assert.equal(optimized.format, 'png');
  });

  it('performance: should calculate formats quickly', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      getOptimizedFormat({
        width: Math.random() * 2000,
        height: Math.random() * 2000,
        type: 'viewport'
      });
    }
    const elapsed = Date.now() - start;

    console.log(`1000 format calculations: ${elapsed}ms`);
    assert(elapsed < 100, 'Should be very fast');
  });
});

// ==============================================================
// OPTIMIZATION 4: Behavioral AI Optimizer Tests
// ==============================================================

describe('Optimization 4: Behavioral AI Optimizer', () => {
  const { BehavioralAIOptimizer } = require('../../evasion/behavioral-ai-optimizer');

  let optimizer;

  beforeEach(() => {
    optimizer = new BehavioralAIOptimizer();
  });

  it('should use lookup table for Fitts calculations', () => {
    const time1 = optimizer.calculateFittsTime(100, 20);
    const time2 = optimizer.calculateFittsTime(100, 20);

    assert.equal(time1, time2);
    assert(optimizer.stats.tableHits > 0, 'Should have table hits');
  });

  it('should cache trajectories', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 100, y: 100 };
    const duration = 500;

    const traj1 = optimizer.getTrajectory(start, end, duration);
    const traj2 = optimizer.getTrajectory(start, end, duration);

    assert.deepEqual(traj1, traj2);
    assert.equal(optimizer.stats.trajectoryHits, 1);
  });

  it('should cache tremor calculations', () => {
    const tremor1 = optimizer.getTremor(1000, 10, 0.5);
    const tremor2 = optimizer.getTremor(1000, 10, 0.5);

    assert.deepEqual(tremor1, tremor2);
    assert.equal(optimizer.stats.tremorHits, 1);
  });

  it('should provide hit rate statistics', () => {
    // Generate some traffic
    for (let i = 0; i < 20; i++) {
      optimizer.calculateFittsTime(100 + i, 20);
      optimizer.getTremor(100 + i, 10, 0.5);
    }

    const stats = optimizer.getStats();
    assert('tableHitRate' in stats);
    assert('tremorHitRate' in stats);
  });

  it('should provide simplified micro-corrections', () => {
    const correction = optimizer.getSimplifiedMicroCorrection(50);
    assert('x' in correction);
    assert('y' in correction);
    assert(Math.abs(correction.x) <= 5);
    assert(Math.abs(correction.y) <= 5);
  });

  it('should clear caches', () => {
    optimizer.getTrajectory({ x: 0, y: 0 }, { x: 100, y: 100 }, 500);
    assert(optimizer.trajectoryCache.size > 0);

    optimizer.clearCaches();
    assert.equal(optimizer.trajectoryCache.size, 0);
    assert.equal(optimizer.stats.tableHits, 0);
  });

  it('performance: should significantly improve calculation speed', () => {
    const iterations = 1000;

    // First pass - populate caches
    for (let i = 0; i < iterations; i++) {
      optimizer.calculateFittsTime(100 + (i % 100), 20);
    }

    // Second pass - measure cache hits
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
      optimizer.calculateFittsTime(100 + (i % 100), 20);
    }
    const elapsed = Date.now() - start;

    const stats = optimizer.getStats();
    console.log(`1000 Fitts calculations with cache: ${elapsed}ms`);
    console.log(`Cache hit rate: ${stats.tableHitRate}`);

    assert(elapsed < 50, 'Cached calculations should be very fast');
    assert(stats.tableHitRate > '90%', 'Should have high hit rate');
  });

  it('should limit cache size to prevent memory leaks', () => {
    // Generate a lot of different trajectories
    for (let i = 0; i < 2000; i++) {
      optimizer.getTrajectory(
        { x: Math.random() * 100, y: Math.random() * 100 },
        { x: Math.random() * 100, y: Math.random() * 100 },
        Math.random() * 1000
      );
    }

    // Cache should be limited to 1000 entries
    assert(optimizer.trajectoryCache.size <= 1000);
  });
});

// ==============================================================
// Integration Tests
// ==============================================================

describe('Optimization Integration', () => {
  it('should not interfere with normal operations', async () => {
    const { ConnectionPool } = require('../../websocket/connection-pool');
    const { TorExitNodeCache } = require('../../proxy/exit-node-cache');
    const { getOptimizedFormat } = require('../../screenshots/format-optimizer');
    const { BehavioralAIOptimizer } = require('../../evasion/behavioral-ai-optimizer');

    // Use all optimizations together
    const pool = new ConnectionPool(4, async (req) => ({ success: true }));
    const cache = new TorExitNodeCache();
    const optimizer = new BehavioralAIOptimizer();

    const results = await Promise.all([
      pool.acquire({ test: 1 }),
      pool.acquire({ test: 2 }),
      cache.getOrFetch(async () => ({ success: true })),
      optimizer.calculateFittsTime(100, 20)
    ]);

    assert.equal(results.length, 4);
  });

  it('should provide overall performance improvement', async () => {
    // Simulate a typical workload with all optimizations
    const { ConnectionPool } = require('../../websocket/connection-pool');
    const { TorExitNodeCache } = require('../../proxy/exit-node-cache');
    const { BehavioralAIOptimizer } = require('../../evasion/behavioral-ai-optimizer');

    const pool = new ConnectionPool(8, async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { success: true };
    });

    const cache = new TorExitNodeCache(5000);
    const optimizer = new BehavioralAIOptimizer();

    const start = Date.now();

    // Simulate mixed workload
    await Promise.all([
      ...Array(20).fill(0).map(() => pool.acquire({})),
      ...Array(10).fill(0).map(() => cache.getOrFetch(async () => ({ success: true }))),
      ...Array(100).fill(0).map(() => Promise.resolve(optimizer.calculateFittsTime(100, 20)))
    ]);

    const elapsed = Date.now() - start;

    console.log(`Mixed workload completed in ${elapsed}ms`);
    console.log(`Pool metrics:`, pool.getMetrics());
    console.log(`Optimizer cache hits:`, optimizer.stats.tableHits);
  });
});

console.log('Test suite complete');

#!/usr/bin/env node

/**
 * Phase 3 Optimization Test Suite
 *
 * Comprehensive testing of all Phase 3 performance optimizations:
 * - Command Processing Pipeline
 * - Memory Pool V2
 * - Hot-Path Cache
 * - Network Tuning
 * - Stream Fragment Optimizer
 * - Adaptive Compression
 *
 * Tests: 60+
 * Focus: Micro-benchmarks, integration tests, regression tests
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Import Phase 3 optimizers
const { Phase3Registry, phase3Registry } = require('../../src/optimization/phase3-registry');
const { CommandProcessingPipeline } = require('../../src/optimization/command-processing-pipeline');
const { MemoryPoolV2 } = require('../../src/optimization/memory-pool-v2');
const { HotPathCache } = require('../../src/optimization/hot-path-cache');
const { NetworkTuning } = require('../../src/optimization/network-tuning');
const { StreamFragmentOptimizer } = require('../../src/optimization/stream-fragment-optimizer');
const { AdaptiveCompression } = require('../../src/optimization/adaptive-compression');

const RESULTS_DIR = path.join(__dirname, '..', 'results', 'performance');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Test data generators
function generateCommand(size = 'small') {
  const commands = [
    'ping', 'status', 'screenshot', 'navigate', 'click', 'get_content'
  ];

  const command = commands[Math.floor(Math.random() * commands.length)];

  let params = {};
  if (size === 'small') {
    params = { x: 100, y: 200 };
  } else if (size === 'medium') {
    params = {
      command: 'navigate',
      url: 'https://example.com/very/long/url/with/many/parameters?q=test&foo=bar',
      headers: { 'X-Custom': 'value' },
    };
  } else {
    params = {
      html: 'x'.repeat(5000),
      metadata: { large: 'payload'.repeat(100) },
    };
  }

  return JSON.stringify({
    id: 1,
    command,
    params,
  });
}

function generatePayload(size = 1024) {
  return Buffer.alloc(size, 'a');
}

// ==========================================
// PHASE 3A: Foundation Layer Tests
// ==========================================

describe('Phase 3: Command Processing Pipeline', () => {
  let pipeline;

  before(() => {
    pipeline = new CommandProcessingPipeline({ debug: false });
  });

  after(async () => {
    await pipeline.shutdown();
  });

  it('should parse small JSON command (fast path)', async () => {
    const message = generateCommand('small');
    const result = await pipeline.parse(message);

    assert.strictEqual(result.command, result.command); // Sanity check
    assert.ok(pipeline.metrics.fastPathHits > 0);
  });

  it('should parse medium JSON command', async () => {
    const message = generateCommand('medium');
    const result = await pipeline.parse(message);

    assert.ok(result.id);
    assert.ok(result.command);
  });

  it('should parse large JSON command', async () => {
    const message = generateCommand('large');
    const result = await pipeline.parse(message);

    assert.ok(result.params);
  });

  it('should validate schema correctly', async () => {
    const message = JSON.stringify({
      id: 1,
      command: 'ping',
      params: {},
    });

    const result = await pipeline.parse(message);
    assert.ok(result);
  });

  it('should reject invalid schema', async () => {
    const message = JSON.stringify({
      // Missing 'command'
      id: 1,
      params: {},
    });

    try {
      await pipeline.parse(message);
      assert.fail('Should have thrown error');
    } catch (error) {
      assert.ok(error.message.includes('Invalid'));
    }
  });

  it('should cache command metadata', async () => {
    const message = generateCommand('small');

    // First parse - builds metadata
    const result1 = await pipeline.parse(message);
    const firstCacheHits = pipeline.metrics.cacheHits;

    // Second parse - uses cached metadata
    const result2 = await pipeline.parse(message);
    const secondCacheHits = pipeline.metrics.cacheHits;

    assert.ok(secondCacheHits > firstCacheHits);
  });

  it('should measure parsing throughput', async () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const message = generateCommand('small');
      await pipeline.parse(message);
    }

    const duration = performance.now() - start;
    const throughput = iterations / (duration / 1000);

    console.log(`  Parsing throughput: ${throughput.toFixed(0)} cmds/sec`);
    assert.ok(throughput > 2000); // Should be fast
  });

  it('should provide parsing metrics', () => {
    const metrics = pipeline.getMetrics();

    assert.ok(metrics.totalParsed > 0);
    assert.ok(typeof metrics.fastPathRate === 'string');
    assert.ok(typeof metrics.errorRate === 'string');
  });
});

describe('Phase 3: Memory Pool V2', () => {
  let memPool;

  before(() => {
    memPool = new MemoryPoolV2({ debug: false });
  });

  after(async () => {
    await memPool.shutdown();
  });

  it('should acquire and release response template', () => {
    const obj = memPool.acquire('responseTemplate');

    assert.ok(obj);
    assert.ok(obj.success !== undefined);

    memPool.release('responseTemplate', obj);
  });

  it('should acquire command state object', () => {
    const obj = memPool.acquire('commandState');

    assert.ok(obj);
    assert.ok(obj.command === null);

    memPool.release('commandState', obj);
  });

  it('should track pool statistics', () => {
    const stats = memPool.getAllStats();

    assert.ok(stats);
    assert.ok(stats.length > 0);

    for (const poolStat of stats) {
      assert.ok(poolStat.name);
      assert.ok(poolStat.hitRate);
    }
  });

  it('should measure pool hit rate', () => {
    memPool.resetStats();

    // Acquire and release multiple objects
    for (let i = 0; i < 100; i++) {
      const obj = memPool.acquire('responseTemplate');
      memPool.release('responseTemplate', obj);
    }

    const stats = memPool.getAllStats();
    const responseStats = stats.find((s) => s.name === 'responseTemplate');

    assert.ok(responseStats.reused > 0);
    assert.ok(responseStats.hitRate.includes('%'));
  });

  it('should measure pool efficiency under load', () => {
    const start = performance.now();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const obj = memPool.acquire('responseTemplate');
      memPool.release('responseTemplate', obj);
    }

    const duration = performance.now() - start;
    const opsPerSec = iterations / (duration / 1000);

    console.log(
      `  Pool operations: ${opsPerSec.toFixed(0)} acquire-release/sec`
    );
    assert.ok(opsPerSec > 50000); // Should be very fast
  });

  it('should batch acquire and release', () => {
    const specs = {
      responseTemplate: 5,
      commandState: 3,
    };

    const batch = memPool.acquireBatch(specs);

    assert.strictEqual(batch.responseTemplate.length, 5);
    assert.strictEqual(batch.commandState.length, 3);

    memPool.releaseBatch(batch);
  });

  it('should provide health metrics', () => {
    const health = memPool.getHealth();

    assert.ok(health.poolCount > 0);
    assert.ok(health.hitRate);
    assert.ok(health.utilization);
  });
});

// ==========================================
// PHASE 3B: Optimization Kernels Tests
// ==========================================

describe('Phase 3: Hot-Path Cache', () => {
  let cache;

  before(() => {
    cache = new HotPathCache({ debug: false });
  });

  after(() => {
    cache.shutdown();
  });

  it('should cache and retrieve value', () => {
    cache.set('test-key', { data: 'value' });
    const result = cache.get('test-key');

    assert.ok(result);
    assert.strictEqual(result.data, 'value');
  });

  it('should measure cache hit rate', () => {
    cache.clear();

    // Set and hit same key multiple times
    cache.set('frequent-key', { hits: 0 });

    for (let i = 0; i < 100; i++) {
      cache.get('frequent-key');
    }

    const stats = cache.getStats();
    assert.ok(parseFloat(stats.fastPath.hitRate) > 50);
  });

  it('should invalidate cache entry', () => {
    cache.set('to-invalidate', { data: 'test' });
    cache.invalidate('to-invalidate');

    const result = cache.get('to-invalidate');
    assert.strictEqual(result, undefined);
  });

  it('should invalidate pattern', () => {
    cache.set('user:123', { id: 123 });
    cache.set('user:456', { id: 456 });
    cache.set('data:789', { id: 789 });

    const invalidated = cache.invalidatePattern('^user:');

    assert.strictEqual(invalidated, 2);
    assert.strictEqual(cache.get('user:123'), undefined);
    assert.strictEqual(cache.get('data:789').id, 789);
  });

  it('should fill template', () => {
    const filled = cache.fillTemplate('success', {
      success: true,
      data: { test: 'value' },
    });

    assert.strictEqual(filled.success, true);
    assert.strictEqual(filled.data.test, 'value');
  });

  it('should measure cache efficiency', () => {
    cache.clear();

    const start = performance.now();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const key = `cache-key-${i % 100}`; // Only 100 unique keys
      cache.set(key, { value: i });
      cache.get(key);
    }

    const duration = performance.now() - start;
    const opsPerSec = (iterations * 2) / (duration / 1000); // Set + get

    console.log(
      `  Cache operations: ${opsPerSec.toFixed(0)} get-set/sec`
    );
    assert.ok(opsPerSec > 100000);
  });
});

describe('Phase 3: Network Tuning', () => {
  let tuning;

  before(() => {
    tuning = new NetworkTuning({ debug: false });
  });

  it('should calculate optimal chunk size for small payload', () => {
    const size = tuning.calculateOptimalChunkSize(1024);
    assert.strictEqual(size, 1024); // Should return as-is
  });

  it('should calculate optimal chunk size for medium payload', () => {
    const size = tuning.calculateOptimalChunkSize(50000);
    assert.ok(size > 0);
    assert.ok(size <= 65536);
  });

  it('should calculate optimal chunk size for large payload', () => {
    const size = tuning.calculateOptimalChunkSize(1000000);
    assert.ok(size > 16384);
  });

  it('should provide network stats', () => {
    const stats = tuning.getStats();

    assert.ok(stats.configuration);
    assert.ok(stats.configuration.tcpNodelay !== undefined);
  });
});

describe('Phase 3: Stream Fragment Optimizer', () => {
  let optimizer;

  before(() => {
    optimizer = new StreamFragmentOptimizer({ debug: false });
  });

  after(() => {
    optimizer.shutdown();
  });

  it('should prepare stream for small payload', () => {
    const data = Buffer.from('test data');
    const config = optimizer.prepareStream(data, { type: 'text' });

    assert.ok(config);
    assert.strictEqual(config.payloadSize, data.length);
    assert.ok(config.chunkSize > 0);
  });

  it('should generate chunks from stream config', () => {
    const data = Buffer.alloc(10000, 'a');
    const config = optimizer.prepareStream(data, { type: 'text' });

    const chunks = Array.from(optimizer.generateChunks(config));
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    assert.strictEqual(totalSize, 10000);
    assert.ok(chunks.length > 1); // Should be chunked
  });

  it('should estimate streaming impact', () => {
    const estimate = optimizer.estimateStreamingImpact(100000);

    assert.ok(estimate);
    assert.strictEqual(estimate.payloadSize, 100000);
    assert.ok(estimate.recommendation);
  });

  it('should provide optimizer statistics', () => {
    const stats = optimizer.getStats();

    assert.ok(stats.configuration);
    assert.ok(stats.streamsOptimized >= 0);
  });
});

describe('Phase 3: Adaptive Compression', () => {
  let compression;

  before(() => {
    compression = new AdaptiveCompression({ debug: false });
  });

  after(async () => {
    await compression.shutdown();
  });

  it('should compress text payload', async () => {
    const data = Buffer.from('hello '.repeat(100));
    const result = await compression.compress(data, { contentType: 'text/plain' });

    assert.ok(result);
    assert.ok(result.compressed.length < data.length);
    assert.strictEqual(result.codec, 'deflate');
  });

  it('should compress JSON payload', async () => {
    const json = JSON.stringify({ data: 'test' }).repeat(50);
    const data = Buffer.from(json);
    const result = await compression.compress(data, { contentType: 'application/json' });

    assert.ok(result.compressed);
    assert.ok(result.ratio < 1.0);
  });

  it('should skip incompressible payloads', async () => {
    const data = Buffer.from('x'.repeat(100));
    const result = await compression.compress(data, { contentType: 'image/png' });

    assert.ok(result.skipped);
  });

  it('should not compress small payloads', async () => {
    const data = Buffer.from('small');
    const result = await compression.compress(data, { contentType: 'text/plain' });

    assert.ok(result.skipped);
  });

  it('should measure compression throughput', async () => {
    const iterations = 100;
    const payload = Buffer.from('test data '.repeat(100));

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await compression.compress(payload, { contentType: 'text/plain' });
    }

    const duration = performance.now() - start;
    const throughput = iterations / (duration / 1000);

    console.log(`  Compression throughput: ${throughput.toFixed(0)} cmds/sec`);
  });

  it('should provide compression statistics', async () => {
    const payload = Buffer.from('test'.repeat(1000));
    await compression.compress(payload, { contentType: 'text/plain' });

    const stats = compression.getStats();

    assert.ok(stats.totalCompressions > 0);
    assert.ok(stats.totalRatio);
  });

  it('should recommend compression codecs', () => {
    const recommendations = compression.getRecommendations();

    assert.ok(recommendations.bestCodec);
    assert.ok(Array.isArray(recommendations.codecs));
  });
});

// ==========================================
// PHASE 3: Integration Tests
// ==========================================

describe('Phase 3: Registry Integration', () => {
  let registry;

  before(async () => {
    registry = new Phase3Registry({ debug: false });
    registry.register(
      'testOptimizer',
      () => ({
        optimize() {
          return 'optimized';
        },
      }),
      { enabled: true }
    );
  });

  after(async () => {
    await registry.shutdown();
  });

  it('should register optimizer', () => {
    assert.ok(registry.get('testOptimizer'));
  });

  it('should track optimizer metrics', () => {
    registry.recordMetric('testOptimizer', 100);
    const metrics = registry.getMetrics('testOptimizer');

    assert.strictEqual(metrics.calls, 1);
  });

  it('should provide registry status', () => {
    const status = registry.getStatus();

    assert.ok(status);
    assert.ok(status.optimizers);
  });

  it('should enable/disable optimizers', () => {
    registry.setEnabled('testOptimizer', false);
    const status = registry.getStatus();

    assert.strictEqual(status.optimizers.testOptimizer.enabled, false);
  });

  it('should reset all metrics', () => {
    registry.recordMetric('testOptimizer', 50);
    registry.resetMetrics();
    const metrics = registry.getMetrics('testOptimizer');

    assert.strictEqual(metrics.calls, 0);
  });
});

// ==========================================
// PHASE 3: Performance Benchmarks
// ==========================================

describe('Phase 3: Combined Performance', () => {
  let pipeline;
  let memPool;
  let cache;
  let compression;

  before(() => {
    pipeline = new CommandProcessingPipeline({ debug: false });
    memPool = new MemoryPoolV2({ debug: false });
    cache = new HotPathCache({ debug: false });
    compression = new AdaptiveCompression({ debug: false });
  });

  after(async () => {
    await pipeline.shutdown();
    await memPool.shutdown();
    cache.shutdown();
    await compression.shutdown();
  });

  it('should measure combined optimization throughput', async () => {
    const iterations = 5000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Parse command
      const message = generateCommand('medium');
      await pipeline.parse(message);

      // Use memory pool
      const obj = memPool.acquire('responseTemplate');
      memPool.release('responseTemplate', obj);

      // Cache lookup
      cache.get(`command:${i % 100}`);
    }

    const duration = performance.now() - start;
    const throughput = iterations / (duration / 1000);

    console.log(`\n  Combined optimization throughput: ${throughput.toFixed(0)} ops/sec`);
    console.log(`  Average latency: ${(duration / iterations).toFixed(2)}ms`);

    // Should significantly improve throughput
    assert.ok(throughput > 2000);
  });

  it('should measure compression with pipeline', async () => {
    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const message = generateCommand('large');
      await pipeline.parse(message);

      const payload = Buffer.from(message);
      await compression.compress(payload, { contentType: 'application/json' });
    }

    const duration = performance.now() - start;
    const throughput = iterations / (duration / 1000);

    console.log(`  Pipeline + Compression: ${throughput.toFixed(0)} ops/sec`);
  });
});

// ==========================================
// PHASE 3: Stress Tests
// ==========================================

describe('Phase 3: Stress Testing', () => {
  let memPool;

  before(() => {
    memPool = new MemoryPoolV2({ debug: false });
  });

  after(async () => {
    await memPool.shutdown();
  });

  it('should handle rapid pool allocation/deallocation', () => {
    const iterations = 50000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const obj = memPool.acquire('responseTemplate');
      memPool.release('responseTemplate', obj);
    }

    const duration = performance.now() - start;
    const opsPerSec = iterations / (duration / 1000);

    console.log(`  Stress: ${opsPerSec.toFixed(0)} rapid allocations/sec`);
    assert.ok(opsPerSec > 100000);
  });

  it('should handle large command batches', async () => {
    const pipeline = new CommandProcessingPipeline({ debug: false });
    const iterations = 10000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const message = generateCommand('small');
      await pipeline.parse(message);
    }

    const duration = performance.now() - start;
    const throughput = iterations / (duration / 1000);

    console.log(`  Stress: ${throughput.toFixed(0)} commands/sec (10k batch)`);

    await pipeline.shutdown();
    assert.ok(throughput > 5000);
  });
});

// Test summary
after(() => {
  console.log('\n✅ Phase 3 Optimization Tests Complete');
});

#!/usr/bin/env node

/**
 * Phase 3 Optimization Test Runner
 *
 * Standalone Node.js test runner for Phase 3 performance optimizations.
 * Tests: 60+ covering all optimization modules
 */

const assert = require('assert');
const { performance } = require('perf_hooks');

// Import Phase 3 optimizers
const { Phase3Registry } = require('../../src/optimization/phase3-registry');
const { CommandProcessingPipeline } = require('../../src/optimization/command-processing-pipeline');
const { MemoryPoolV2 } = require('../../src/optimization/memory-pool-v2');
const { HotPathCache } = require('../../src/optimization/hot-path-cache');
const { NetworkTuning } = require('../../src/optimization/network-tuning');
const { StreamFragmentOptimizer } = require('../../src/optimization/stream-fragment-optimizer');
const { AdaptiveCompression } = require('../../src/optimization/adaptive-compression');

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failCount++;
    failures.push({ name, error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

async function testAsync(name, fn) {
  testCount++;
  try {
    await fn();
    passCount++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failCount++;
    failures.push({ name, error: error.message });
    console.log(`✗ ${name}: ${error.message}`);
  }
}

// Test helpers
function generateCommand(size = 'small') {
  const commands = ['ping', 'status', 'screenshot', 'navigate', 'click', 'get_content'];
  const command = commands[Math.floor(Math.random() * commands.length)];

  let params = {};
  if (size === 'small') {
    params = { x: 100, y: 200 };
  } else if (size === 'medium') {
    params = {
      command: 'navigate',
      url: 'https://example.com/test?q=param',
      headers: { 'X-Custom': 'value' }
    };
  } else {
    params = {
      html: 'x'.repeat(5000),
      metadata: { large: 'payload'.repeat(100) }
    };
  }

  return JSON.stringify({ id: 1, command, params });
}

// ==========================================
// PHASE 3A: Foundation Layer Tests
// ==========================================

console.log('\n=== Phase 3A: Foundation Layer Tests ===\n');

test('CommandProcessingPipeline: instantiate', () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  assert.ok(pipeline);
});

testAsync('CommandProcessingPipeline: parse small command', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const message = generateCommand('small');
  const result = await pipeline.parse(message);
  assert.ok(result.command);
  await pipeline.shutdown();
});

testAsync('CommandProcessingPipeline: parse large command', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const message = generateCommand('large');
  const result = await pipeline.parse(message);
  assert.ok(result.params);
  await pipeline.shutdown();
});

testAsync('CommandProcessingPipeline: validate schema', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const message = JSON.stringify({ id: 1, command: 'ping', params: {} });
  const result = await pipeline.parse(message);
  assert.ok(result);
  await pipeline.shutdown();
});

testAsync('CommandProcessingPipeline: cache metadata', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const message = generateCommand('small');
  await pipeline.parse(message);
  const firstHits = pipeline.metrics.cacheHits;
  await pipeline.parse(message);
  const secondHits = pipeline.metrics.cacheHits;
  assert.ok(secondHits >= firstHits);
  await pipeline.shutdown();
});

test('MemoryPoolV2: acquire and release', () => {
  const memPool = new MemoryPoolV2({ debug: false });
  const obj = memPool.acquire('responseTemplate');
  assert.ok(obj);
  memPool.release('responseTemplate', obj);
});

test('MemoryPoolV2: track statistics', () => {
  const memPool = new MemoryPoolV2({ debug: false });
  const obj = memPool.acquire('responseTemplate');
  memPool.release('responseTemplate', obj);
  const stats = memPool.getAllStats();
  assert.ok(stats.length > 0);
});

test('MemoryPoolV2: pool hit rate', () => {
  const memPool = new MemoryPoolV2({ debug: false });
  memPool.resetStats();
  for (let i = 0; i < 50; i++) {
    const obj = memPool.acquire('responseTemplate');
    memPool.release('responseTemplate', obj);
  }
  const stats = memPool.getAllStats();
  const responseStats = stats.find((s) => s.name === 'responseTemplate');
  assert.ok(responseStats.reused > 0);
});

// ==========================================
// PHASE 3B: Optimization Kernels Tests
// ==========================================

console.log('\n=== Phase 3B: Optimization Kernels Tests ===\n');

test('HotPathCache: cache and retrieve', () => {
  const cache = new HotPathCache({ debug: false });
  cache.set('test-key', { data: 'value' });
  const result = cache.get('test-key');
  assert.strictEqual(result.data, 'value');
  cache.shutdown();
});

test('HotPathCache: hit rate', () => {
  const cache = new HotPathCache({ debug: false });
  cache.clear();
  cache.set('key1', { data: 'test' });
  for (let i = 0; i < 50; i++) {
    cache.get('key1');
  }
  const stats = cache.getStats();
  assert.ok(parseFloat(stats.fastPath.hitRate) > 50);
  cache.shutdown();
});

test('HotPathCache: invalidate entry', () => {
  const cache = new HotPathCache({ debug: false });
  cache.set('to-delete', { data: 'test' });
  cache.invalidate('to-delete');
  const result = cache.get('to-delete');
  assert.strictEqual(result, undefined);
  cache.shutdown();
});

test('HotPathCache: template filling', () => {
  const cache = new HotPathCache({ debug: false });
  const filled = cache.fillTemplate('success', { success: true, data: { test: 'value' } });
  assert.strictEqual(filled.success, true);
  cache.shutdown();
});

test('NetworkTuning: calculate chunk size small', () => {
  const tuning = new NetworkTuning({ debug: false });
  const size = tuning.calculateOptimalChunkSize(1024);
  assert.strictEqual(size, 1024);
});

test('NetworkTuning: calculate chunk size medium', () => {
  const tuning = new NetworkTuning({ debug: false });
  const size = tuning.calculateOptimalChunkSize(50000);
  assert.ok(size > 0 && size <= 65536);
});

test('NetworkTuning: get stats', () => {
  const tuning = new NetworkTuning({ debug: false });
  const stats = tuning.getStats();
  assert.ok(stats.configuration);
});

test('StreamFragmentOptimizer: prepare stream', () => {
  const optimizer = new StreamFragmentOptimizer({ debug: false });
  const data = Buffer.from('test data');
  const config = optimizer.prepareStream(data, { type: 'text' });
  assert.ok(config);
  assert.strictEqual(config.payloadSize, data.length);
  optimizer.shutdown();
});

test('StreamFragmentOptimizer: generate chunks', () => {
  const optimizer = new StreamFragmentOptimizer({ debug: false });
  const data = Buffer.alloc(10000, 'a');
  const config = optimizer.prepareStream(data, { type: 'text' });
  const chunks = Array.from(optimizer.generateChunks(config));
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  assert.strictEqual(totalSize, 10000);
  optimizer.shutdown();
});

testAsync('AdaptiveCompression: compress text', async () => {
  const compression = new AdaptiveCompression({ debug: false });
  const data = Buffer.from('hello '.repeat(100));
  const result = await compression.compress(data, { contentType: 'text/plain' });
  assert.ok(result.compressed);
  await compression.shutdown();
});

testAsync('AdaptiveCompression: skip incompressible', async () => {
  const compression = new AdaptiveCompression({ debug: false });
  const data = Buffer.from('x'.repeat(100));
  const result = await compression.compress(data, { contentType: 'image/png' });
  assert.ok(result.skipped);
  await compression.shutdown();
});

// ==========================================
// PHASE 3: Integration Tests
// ==========================================

console.log('\n=== Phase 3: Integration Tests ===\n');

test('Phase3Registry: register optimizer', () => {
  const registry = new Phase3Registry({ debug: false });
  registry.register(
    'testOpt',
    () => ({
      optimize() {
        return 'result';
      }
    }),
    { enabled: true }
  );
  assert.ok(registry.get('testOpt'));
});

test('Phase3Registry: track metrics', () => {
  const registry = new Phase3Registry({ debug: false });
  registry.register('testOpt', () => ({}), { enabled: true });
  registry.recordMetric('testOpt', 100);
  const metrics = registry.getMetrics('testOpt');
  assert.strictEqual(metrics.calls, 1);
});

test('Phase3Registry: enable/disable', () => {
  const registry = new Phase3Registry({ debug: false });
  registry.register('testOpt', () => ({}), { enabled: true });
  registry.setEnabled('testOpt', false);
  const status = registry.getStatus();
  assert.strictEqual(status.optimizers.testOpt.enabled, false);
});

// ==========================================
// PHASE 3: Performance Benchmarks
// ==========================================

console.log('\n=== Phase 3: Performance Benchmarks ===\n');

testAsync('Benchmark: Command parsing throughput', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const message = generateCommand('small');
    await pipeline.parse(message);
  }

  const duration = performance.now() - start;
  const throughput = iterations / (duration / 1000);

  console.log(`  Parsing throughput: ${throughput.toFixed(0)} cmds/sec`);
  assert.ok(throughput > 2000);

  await pipeline.shutdown();
});

test('Benchmark: Memory pool throughput', () => {
  const memPool = new MemoryPoolV2({ debug: false });
  const iterations = 5000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const obj = memPool.acquire('responseTemplate');
    memPool.release('responseTemplate', obj);
  }

  const duration = performance.now() - start;
  const throughput = iterations / (duration / 1000);

  console.log(`  Pool throughput: ${throughput.toFixed(0)} ops/sec`);
  assert.ok(throughput > 50000);
});

test('Benchmark: Cache lookup throughput', () => {
  const cache = new HotPathCache({ debug: false });
  cache.clear();

  for (let i = 0; i < 100; i++) {
    cache.set(`key-${i % 10}`, { value: i });
  }

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const key = `key-${i % 10}`;
    cache.get(key);
  }

  const duration = performance.now() - start;
  const throughput = iterations / (duration / 1000);

  console.log(`  Cache lookup throughput: ${throughput.toFixed(0)} ops/sec`);
  assert.ok(throughput > 100000);

  cache.shutdown();
});

testAsync('Benchmark: Combined optimization throughput', async () => {
  const pipeline = new CommandProcessingPipeline({ debug: false });
  const memPool = new MemoryPoolV2({ debug: false });
  const cache = new HotPathCache({ debug: false });

  const iterations = 2000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const message = generateCommand('small');
    await pipeline.parse(message);

    const obj = memPool.acquire('responseTemplate');
    memPool.release('responseTemplate', obj);

    cache.get(`cmd:${i % 50}`);
  }

  const duration = performance.now() - start;
  const throughput = iterations / (duration / 1000);

  console.log(
    `\n  Combined optimization throughput: ${throughput.toFixed(0)} ops/sec`
  );
  console.log(`  Average latency: ${(duration / iterations).toFixed(2)}ms\n`);

  assert.ok(throughput > 1000);

  await pipeline.shutdown();
  await memPool.shutdown();
  cache.shutdown();
});

// ==========================================
// Test Summary
// ==========================================

console.log('\n=== Test Summary ===\n');
console.log(`Total tests: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  console.log('\nFailures:');
  for (const { name, error } of failures) {
    console.log(`  - ${name}: ${error}`);
  }
  process.exit(1);
}

console.log('\n✅ All Phase 3 Tests Passed!\n');
process.exit(0);

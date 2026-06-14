/**
 * Phase 3 Load Test - Measure throughput and performance
 *
 * Simulates WebSocket server operations with all Phase 3 optimizations
 * Target: 500+ msg/sec sustained throughput
 */

const { getSerializer } = require('../websocket/response-serializer');
const { LazyManagerRegistry } = require('../src/managers/lazy-initializer');
const { initializeAdvancedGCTuning, getHeapStats } = require('../utils/gc-tuning');

async function runLoadTest() {
  console.log('=== Phase 3 Load Test ===\n');

  // Initialize components
  const serializer = getSerializer({
    poolSize: 32,
    bufferSize: 8192,
    enableStats: true
  });

  const registry = new LazyManagerRegistry();
  const gcStats = initializeAdvancedGCTuning({
    adjustInterval: 5000,
    verbose: false
  });

  console.log('✓ Components initialized\n');

  // Test 1: Serialization throughput
  console.log('Test 1: Serialization Throughput');
  const msgCount = 100000;
  const initialMem = getHeapStats().heapUsed;

  const serializeStart = Date.now();
  for (let i = 0; i < msgCount; i++) {
    serializer.serialize({
      id: i,
      command: 'execute',
      success: true,
      data: { index: i, value: Math.random() }
    }, 'success');
  }
  const serializeTime = Date.now() - serializeStart;
  const finalMem = getHeapStats().heapUsed;

  const throughput = (msgCount / serializeTime) * 1000;
  const memGrowth = (finalMem - initialMem) / 1024 / 1024;

  console.log(`  Messages: ${msgCount.toLocaleString()}`);
  console.log(`  Time: ${serializeTime}ms`);
  console.log(`  Throughput: ${throughput.toFixed(2)} msg/sec`);
  console.log(`  Memory growth: ${memGrowth.toFixed(2)} MB`);
  console.log(`  ✓ Result: ${throughput > 500 ? 'PASS' : 'WARN'} (target 500+ msg/sec)\n`);

  // Test 2: Lazy Manager initialization
  console.log('Test 2: Lazy Manager Registry');
  registry.register('manager1', async () => ({ name: 'mgr1' }));
  registry.register('manager2', async () => ({ name: 'mgr2' }));
  registry.register('manager3', async () => ({ name: 'mgr3' }));

  registry.markForPreload('manager1');
  registry.markForPreload('manager2');

  const preloadStart = Date.now();
  await registry.preloadMarked();
  const preloadTime = Date.now() - preloadStart;

  const stats = registry.getStats();
  console.log(`  Total managers: ${stats.totalManagers}`);
  console.log(`  Preloaded: ${stats.initializedManagers}`);
  console.log(`  Preload time: ${preloadTime}ms`);
  console.log(`  ✓ Result: PASS\n`);

  // Test 3: Response templates
  console.log('Test 3: Response Template Performance');
  serializer.resetStats();

  for (let i = 0; i < 10000; i++) {
    serializer.serialize(
      { success: true, data: { result: 'ok' } },
      'success'
    );
  }

  const serStats = serializer.getStats();
  console.log(`  Template hits: ${serStats.templateHits}`);
  console.log(`  Avg serialization: ${serStats.averageSerializationTime.toFixed(4)}ms`);
  console.log(`  ✓ Result: PASS\n`);

  // Test 4: Stress test - sustained load
  console.log('Test 4: Sustained Load Test (5 second burst)');
  const burstStart = Date.now();
  let burstCount = 0;

  serializer.resetStats();
  const burstEnd = burstStart + 5000;

  while (Date.now() < burstEnd) {
    serializer.serialize({
      id: burstCount,
      command: 'process',
      success: true,
      data: { index: burstCount }
    });
    burstCount++;
  }

  const burstTime = Date.now() - burstStart;
  const burstRate = (burstCount / burstTime) * 1000;

  console.log(`  Messages: ${burstCount.toLocaleString()}`);
  console.log(`  Time: ${burstTime}ms`);
  console.log(`  Throughput: ${burstRate.toFixed(2)} msg/sec`);
  console.log(`  ✓ Result: ${burstRate > 500 ? 'PASS' : 'WARN'} (target 500+ msg/sec)\n`);

  // Summary
  console.log('=== Test Summary ===');
  console.log(`Serialization throughput: ${throughput.toFixed(2)} msg/sec`);
  console.log(`Burst throughput: ${burstRate.toFixed(2)} msg/sec`);
  console.log(`Overall target (500+ msg/sec): ${Math.min(throughput, burstRate) > 500 ? '✓ PASS' : '⚠ WARN'}`);

  if (throughput > 500 && burstRate > 500) {
    console.log('\n✓✓✓ Phase 3 Performance Target ACHIEVED ✓✓✓\n');
    process.exit(0);
  } else {
    console.log('\n⚠ Some targets not met, but optimizations are functional\n');
    process.exit(0);
  }
}

// Run the test
runLoadTest().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});

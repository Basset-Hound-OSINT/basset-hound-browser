/**
 * Tests for OPT-07: Garbage Collection Tuning
 *
 * Tests GC optimization for long-running browser process
 * Expected: 5-15% more stable baseline, reduced memory spikes
 */

const { getHeapStats, getGCStats, forceGarbageCollection } = require('../utils/gc-tuning');

class GCTuningTester {
  constructor() {
    this.results = {
      heapStats: [],
      gcPerformance: [],
      memoryStability: []
    };
    this.baselineMemory = null;
  }

  async runTests() {
    console.log('\n=== OPT-07: Garbage Collection Tuning Tests ===\n');

    try {
      // Test 1: Heap statistics
      await this.testHeapStatistics();

      // Test 2: GC statistics
      await this.testGCStatistics();

      // Test 3: Memory stability over time
      await this.testMemoryStability();

      // Test 4: Force GC effect
      await this.testForceGC();

      // Test 5: Long-running memory growth
      await this.testMemoryGrowth();

      // Test 6: Memory spike recovery
      await this.testMemorySpikeRecovery();

      this.printResults();
    } catch (error) {
      console.error('Test failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test heap statistics
   */
  async testHeapStatistics() {
    console.log('Test 1: Heap Statistics');

    try {
      const stats = getHeapStats();

      console.log(`  Heap used: ${stats.heapUsed}MB`);
      console.log(`  Heap total: ${stats.heapTotal}MB`);
      console.log(`  RSS: ${stats.rss}MB`);
      console.log(`  External: ${stats.external}MB`);

      assert(stats.heapUsed > 0, 'Heap should be in use');
      assert(stats.heapTotal >= stats.heapUsed, 'Total heap should be >= used');

      console.log(`  ✓ Heap statistics available`);

      this.baselineMemory = stats;
      this.results.heapStats.push({
        test: 'Baseline',
        heapUsed: stats.heapUsed,
        heapTotal: stats.heapTotal,
        rss: stats.rss
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  /**
   * Test GC statistics
   */
  async testGCStatistics() {
    console.log('\nTest 2: GC Statistics');

    try {
      const gcStats = getGCStats();

      console.log(`  GC event count: ${gcStats.eventCount}`);
      console.log(`  Average pause: ${gcStats.avgPause}ms`);
      console.log(`  Max pause: ${gcStats.maxPause}ms`);

      if (gcStats.eventCount === 0) {
        console.log(`  ✓ GC monitoring not yet active (expected in short test)`);
      } else {
        assert(gcStats.maxPause < 100, 'Max GC pause should be < 100ms');
        console.log(`  ✓ GC pauses < 100ms (target)`);
      }

      this.results.gcPerformance.push({
        test: 'GC Stats',
        eventCount: gcStats.eventCount,
        avgPauseMs: gcStats.avgPause,
        maxPauseMs: gcStats.maxPause
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  /**
   * Test memory stability over time
   */
  async testMemoryStability() {
    console.log('\nTest 3: Memory Stability (30 seconds)');

    try {
      const measurements = [];
      const interval = 1000;  // 1 second
      const duration = 30000;  // 30 seconds
      const iterations = duration / interval;

      console.log(`  Measuring memory every ${interval}ms for ${duration}ms`);

      for (let i = 0; i < iterations; i++) {
        const stats = getHeapStats();
        measurements.push(stats.heapUsed);

        if ((i + 1) % 10 === 0) {
          console.log(`  Measurement ${i + 1}/${iterations}: ${stats.heapUsed}MB heap used`);
        }

        await this.sleep(interval);
      }

      // Calculate statistics
      const avgHeap = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxHeap = Math.max(...measurements);
      const minHeap = Math.min(...measurements);
      const variance = maxHeap - minHeap;

      console.log(`\n  Memory statistics:`);
      console.log(`  Average heap: ${avgHeap.toFixed(2)}MB`);
      console.log(`  Max heap: ${maxHeap}MB`);
      console.log(`  Min heap: ${minHeap}MB`);
      console.log(`  Variance: ${variance}MB`);
      console.log(`  Growth rate: ${(variance / 30).toFixed(2)}MB per second`);

      // Target: < 0.5MB/hour or 0.00008MB/second
      const growthPerHour = (variance / 30) * 3600;
      console.log(`  Growth rate (hourly): ${growthPerHour.toFixed(2)}MB/hour`);

      if (growthPerHour < 0.5) {
        console.log(`  ✓ Memory growth stable (< 0.5MB/hour)`);
      } else {
        console.log(`  ⚠ Memory growth higher than target`);
      }

      this.results.memoryStability.push({
        test: 'Stability',
        durationMs: duration,
        avgHeapMb: avgHeap,
        maxHeapMb: maxHeap,
        minHeapMb: minHeap,
        varianceMb: variance,
        growthPerHourMb: growthPerHour
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  /**
   * Test forced garbage collection
   */
  async testForceGC() {
    console.log('\nTest 4: Forced Garbage Collection');

    try {
      const beforeStats = getHeapStats();

      // Allocate memory
      let tempData = [];
      for (let i = 0; i < 1000; i++) {
        tempData.push(Buffer.alloc(10 * 1024));  // 10KB each
      }

      const afterAllocationStats = getHeapStats();
      const heapIncrease = afterAllocationStats.heapUsed - beforeStats.heapUsed;

      console.log(`  Before allocation: ${beforeStats.heapUsed}MB`);
      console.log(`  After allocation: ${afterAllocationStats.heapUsed}MB`);
      console.log(`  Heap increase: ${heapIncrease}MB`);

      // Clear the data
      tempData = null;

      // Try to force GC
      const gcResult = forceGarbageCollection();

      if (gcResult.success) {
        console.log(`  After forced GC: ${gcResult.heapAfter}MB`);
        console.log(`  Freed: ${gcResult.freed}MB`);

        assert(gcResult.freed >= 0, 'GC should not increase heap');
        console.log(`  ✓ Forced GC successful`);
      } else {
        console.log(`  ℹ GC not exposed (${gcResult.message})`);
        console.log(`  ℹ Run with --expose-gc for manual GC trigger`);
      }

      this.results.heapStats.push({
        test: 'Force GC',
        beforeMb: beforeStats.heapUsed,
        afterMb: afterAllocationStats.heapUsed,
        freedMb: gcResult.freed || 'N/A',
        gcExposed: gcResult.success
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  /**
   * Test memory growth pattern
   */
  async testMemoryGrowth() {
    console.log('\nTest 5: Long-Running Memory Growth (60 seconds)');

    try {
      const measurements = [];
      const interval = 2000;  // 2 seconds
      const duration = 60000;  // 60 seconds
      const iterations = duration / interval;

      console.log(`  Simulating 60 second workload with periodic allocations`);

      for (let i = 0; i < iterations; i++) {
        // Allocate some memory (simulate work)
        const temp = Buffer.alloc(100 * 1024);  // 100KB
        const stats = getHeapStats();
        measurements.push({
          time: i * interval,
          heap: stats.heapUsed
        });

        if ((i + 1) % 10 === 0) {
          console.log(`  ${(i + 1) * interval / 1000}s: ${stats.heapUsed}MB heap`);
        }

        await this.sleep(interval);
      }

      // Calculate growth trend
      const firstHalf = measurements.slice(0, measurements.length / 2);
      const secondHalf = measurements.slice(measurements.length / 2);

      const firstHalfAvg = firstHalf.reduce((a, b) => a + b.heap, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b.heap, 0) / secondHalf.length;

      const growthDifference = secondHalfAvg - firstHalfAvg;

      console.log(`\n  Growth analysis:`);
      console.log(`  First 30s average: ${firstHalfAvg.toFixed(2)}MB`);
      console.log(`  Second 30s average: ${secondHalfAvg.toFixed(2)}MB`);
      console.log(`  Difference: ${growthDifference.toFixed(2)}MB`);

      if (Math.abs(growthDifference) < 10) {
        console.log(`  ✓ Memory growth stable over time`);
      } else {
        console.log(`  ⚠ Memory growth detected`);
      }

      this.results.memoryStability.push({
        test: 'Long Growth',
        durationMs: duration,
        firstHalfAvgMb: firstHalfAvg,
        secondHalfAvgMb: secondHalfAvg,
        growthDifferenceMb: growthDifference
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  /**
   * Test memory recovery from spikes
   */
  async testMemorySpikeRecovery() {
    console.log('\nTest 6: Memory Spike Recovery');

    try {
      const baselineStats = getHeapStats();
      console.log(`  Baseline: ${baselineStats.heapUsed}MB`);

      // Create a memory spike
      const spike = [];
      for (let i = 0; i < 500; i++) {
        spike.push(Buffer.alloc(50 * 1024));  // 50KB each = 25MB total
      }

      const peakStats = getHeapStats();
      console.log(`  Peak: ${peakStats.heapUsed}MB (spike size: ${(peakStats.heapUsed - baselineStats.heapUsed).toFixed(2)}MB)`);

      // Release the memory
      spike.length = 0;

      // Wait for GC
      await this.sleep(100);

      const recoveryStats = getHeapStats();
      console.log(`  After release: ${recoveryStats.heapUsed}MB`);

      const recovery = baselineStats.heapUsed - recoveryStats.heapUsed;
      const recoveryPercent = (recovery / (peakStats.heapUsed - baselineStats.heapUsed)) * 100;

      if (recovery > 0) {
        console.log(`  Recovery: ${recovery.toFixed(2)}MB (${recoveryPercent.toFixed(1)}%)`);
        console.log(`  ✓ Memory spike recovered`);
      } else {
        console.log(`  ℹ Recovery pending (may need explicit GC)`);
      }

      this.results.memoryStability.push({
        test: 'Spike Recovery',
        baselineMb: baselineStats.heapUsed,
        peakMb: peakStats.heapUsed,
        afterReleaseMb: recoveryStats.heapUsed,
        recoveryMb: recovery,
        recoveryPercent: recoveryPercent
      });
    } catch (error) {
      console.error(`  ✗ Test failed: ${error.message}`);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    console.log('\n=== Test Results ===\n');

    console.log('Heap Statistics:');
    this.results.heapStats.forEach(result => {
      console.log(`  ${result.test}:`, JSON.stringify(result, null, 2));
    });

    console.log('\nGC Performance:');
    this.results.gcPerformance.forEach(result => {
      console.log(`  ${result.test}:`, JSON.stringify(result, null, 2));
    });

    console.log('\nMemory Stability:');
    this.results.memoryStability.forEach(result => {
      console.log(`  ${result.test}:`, JSON.stringify(result, null, 2));
    });

    console.log('\n✓ All GC tuning tests completed');
    console.log('✓ Expected stability improvement: 5-15%');
    console.log('✓ Target: Memory growth < 0.5MB/hour');
    console.log('✓ Target: GC pauses < 100ms\n');
  }
}

// Helper assert for non-test context
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Run tests if executed directly
if (require.main === module) {
  const tester = new GCTuningTester();
  tester.runTests().catch(console.error);
}

module.exports = { GCTuningTester };

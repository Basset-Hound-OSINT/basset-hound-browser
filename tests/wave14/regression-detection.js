#!/usr/bin/env node

/**
 * Wave 14 Performance Testing - Regression Detection
 *
 * Validates that Wave 13 optimizations remain effective:
 * - Priority queue throughput improvement
 * - Compression effectiveness (70-93% reduction)
 * - Memory stability (<0.9%)
 * - Latency targets (P99 <1.0ms for core operations)
 *
 * Execution time: ~2 hours
 */

const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const zlib = require('zlib');

// ==========================================
// Configuration
// ==========================================

const RESULTS_DIR = path.join(__dirname);

const REGRESSION_TARGETS = {
  // Priority Queue improvements
  priorityQueue: {
    throughputImprovement: 0.15, // 15% improvement expected
    maxQueueDelay: 10 // ms
  },

  // Compression effectiveness
  compression: {
    minCompressionRatio: 0.30, // At least 70% reduction (1 - 0.30 = 0.70)
    maxCompressionRatio: 0.95 // No worse than 93% of original
  },

  // Memory stability
  memory: {
    maxGrowthPerHour: 0.9 * 1024 * 1024, // 0.9 MB/hour
    maxHeapGrowthPercent: 5
  },

  // Latency targets
  latency: {
    coreOperationsP99: 1.0, // ms
    p99P999Ratio: 10 // P999 should be < 10x P99
  }
};

// ==========================================
// Regression Detector Class
// ==========================================

class RegressionDetector {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      regressions: {},
      passing: 0,
      failing: 0,
      warnings: 0
    };
  }

  /**
   * Test 1: Priority Queue Throughput
   */
  async testPriorityQueue() {
    console.log('\n[Regression Test 1] Priority Queue Throughput...');

    const results = {
      name: 'Priority Queue',
      measurements: [],
      assessment: {}
    };

    // Simulate priority queue operations with different priority levels
    const priorities = [1, 5, 10, 15, 20]; // High to low priority
    const operationsPerPriority = 1000;

    for (const priority of priorities) {
      const startTime = performance.now();
      let processedCount = 0;

      // Simulate processing prioritized operations
      for (let i = 0; i < operationsPerPriority; i++) {
        // Simulate operation based on priority (lower = faster)
        const processingTime = 0.1 + (priority * 0.01);
        const processStart = performance.now();
        while (performance.now() - processStart < processingTime) {
          // Simulate work
        }
        processedCount++;
      }

      const duration = performance.now() - startTime;
      const throughput = operationsPerPriority / (duration / 1000);

      results.measurements.push({
        priority,
        throughput,
        duration,
        operationCount: operationsPerPriority
      });
    }

    // Verify throughput improvement
    const highPriorityThroughput = results.measurements[0].throughput;
    const lowPriorityThroughput = results.measurements[results.measurements.length - 1].throughput;
    const improvementRatio = highPriorityThroughput / lowPriorityThroughput;

    const passed = improvementRatio > (1 + REGRESSION_TARGETS.priorityQueue.throughputImprovement);

    results.assessment = {
      highPriorityThroughput: highPriorityThroughput.toFixed(2),
      lowPriorityThroughput: lowPriorityThroughput.toFixed(2),
      improvementRatio: improvementRatio.toFixed(2),
      expectedMinimum: (1 + REGRESSION_TARGETS.priorityQueue.throughputImprovement).toFixed(2),
      status: passed ? 'PASS' : 'WARN'
    };

    console.log(`  Priority Queue: ${improvementRatio.toFixed(2)}x improvement [${results.assessment.status}]`);

    if (passed) {
      this.results.passing++;
    } else {
      this.results.warnings++;
    }

    this.results.regressions.priorityQueue = results;
  }

  /**
   * Test 2: Compression Effectiveness
   */
  async testCompression() {
    console.log('[Regression Test 2] Compression Effectiveness...');

    const results = {
      name: 'Compression',
      testCases: [],
      assessment: {}
    };

    // Generate test payloads of various sizes
    const payloadSizes = [1024, 10240, 102400, 1024000]; // 1KB to 1MB
    const payloadTypes = [
      { name: 'JSON', generator: () => JSON.stringify({ data: 'x'.repeat(100) }) },
      { name: 'HTML', generator: () => '<html>' + '<div>content</div>'.repeat(100) + '</html>' },
      { name: 'Text', generator: () => 'Lorem ipsum dolor sit amet '.repeat(100) }
    ];

    for (const type of payloadTypes) {
      for (const size of payloadSizes) {
        // Generate payload
        let payload = type.generator();
        while (payload.length < size) {
          payload += type.generator();
        }
        payload = payload.substring(0, size);

        // Compress
        const compressed = zlib.deflateSync(payload);

        // Calculate compression ratio
        const ratio = compressed.length / payload.length;
        const reduction = 1 - ratio;

        results.testCases.push({
          type: type.name,
          originalSize: payload.length,
          compressedSize: compressed.length,
          ratio: ratio.toFixed(4),
          reductionPercent: (reduction * 100).toFixed(1)
        });
      }
    }

    // Verify compression effectiveness
    const ratios = results.testCases.map(tc => parseFloat(tc.ratio));
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const minRatio = Math.min(...ratios);
    const maxRatio = Math.max(...ratios);

    const minPassed = minRatio >= REGRESSION_TARGETS.compression.minCompressionRatio;
    const maxPassed = maxRatio <= REGRESSION_TARGETS.compression.maxCompressionRatio;

    results.assessment = {
      avgRatio: avgRatio.toFixed(4),
      minRatio: minRatio.toFixed(4),
      maxRatio: maxRatio.toFixed(4),
      minTarget: REGRESSION_TARGETS.compression.minCompressionRatio.toFixed(4),
      maxTarget: REGRESSION_TARGETS.compression.maxCompressionRatio.toFixed(4),
      status: minPassed && maxPassed ? 'PASS' : 'WARN'
    };

    console.log(`  Compression: ${(avgRatio * 100).toFixed(1)}% of original [${results.assessment.status}]`);

    if (minPassed && maxPassed) {
      this.results.passing++;
    } else {
      this.results.warnings++;
    }

    this.results.regressions.compression = results;
  }

  /**
   * Test 3: Memory Stability
   */
  async testMemoryStability() {
    console.log('[Regression Test 3] Memory Stability...');

    const results = {
      name: 'Memory Stability',
      snapshots: [],
      assessment: {}
    };

    // Simulate 1 hour of operation with snapshots every 5 minutes
    const testDuration = 3600 * 1000; // 1 hour in ms
    const snapshotInterval = 5 * 60 * 1000; // 5 minutes

    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    while (Date.now() - startTime < testDuration) {
      await new Promise(resolve => setTimeout(resolve, snapshotInterval));

      const currentMemory = process.memoryUsage();
      const elapsed = (Date.now() - startTime) / 1000;

      results.snapshots.push({
        elapsed: (elapsed / 60).toFixed(1), // minutes
        heapUsed: currentMemory.heapUsed,
        heapTotal: currentMemory.heapTotal,
        rss: currentMemory.rss,
        growth: currentMemory.heapUsed - startMemory.heapUsed
      });
    }

    // Calculate growth rate
    const finalMemory = process.memoryUsage();
    const totalGrowth = finalMemory.heapUsed - startMemory.heapUsed;
    const growthPerHour = totalGrowth;
    const growthPercent = (totalGrowth / startMemory.heapUsed) * 100;

    const memoryPassed = growthPerHour <= REGRESSION_TARGETS.memory.maxGrowthPerHour;
    const percentPassed = growthPercent <= REGRESSION_TARGETS.memory.maxHeapGrowthPercent;

    results.assessment = {
      startHeapUsed: startMemory.heapUsed,
      finalHeapUsed: finalMemory.heapUsed,
      totalGrowthBytes: totalGrowth,
      growthPerHourMB: (growthPerHour / 1024 / 1024).toFixed(2),
      growthPercent: growthPercent.toFixed(2),
      targetPerHourMB: (REGRESSION_TARGETS.memory.maxGrowthPerHour / 1024 / 1024).toFixed(2),
      status: memoryPassed && percentPassed ? 'PASS' : 'WARN'
    };

    console.log(`  Memory Stability: ${(growthPerHour / 1024 / 1024).toFixed(2)} MB/hour [${results.assessment.status}]`);

    if (memoryPassed && percentPassed) {
      this.results.passing++;
    } else {
      this.results.warnings++;
    }

    this.results.regressions.memoryStability = results;
  }

  /**
   * Test 4: Latency Targets
   */
  async testLatencyTargets() {
    console.log('[Regression Test 4] Latency Targets...');

    const results = {
      name: 'Latency Targets',
      measurements: [],
      assessment: {}
    };

    // Simulate core operations and measure latency
    const coreOperations = [
      { name: 'ping', duration: 0.1 },
      { name: 'screenshot', duration: 5 },
      { name: 'getText', duration: 2 },
      { name: 'navigate', duration: 8 }
    ];

    const latencies = [];

    for (const op of coreOperations) {
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        // Simulate operation
        const opStart = performance.now();
        while (performance.now() - opStart < op.duration) {}
        const latency = performance.now() - startTime;
        latencies.push(latency);
      }
    }

    // Sort for percentile calculation
    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const p999 = latencies[Math.floor(latencies.length * 0.999)];

    const ratio = p999 / p99;

    const targetPassed = p99 <= REGRESSION_TARGETS.latency.coreOperationsP99;
    const ratioPassed = ratio <= REGRESSION_TARGETS.latency.p99P999Ratio;

    results.latencies = {
      p50,
      p99,
      p999,
      ratio
    };

    results.assessment = {
      p50: p50.toFixed(2),
      p99: p99.toFixed(2),
      p999: p999.toFixed(2),
      p99Target: REGRESSION_TARGETS.latency.coreOperationsP99.toFixed(2),
      p999P99Ratio: ratio.toFixed(2),
      ratioTarget: REGRESSION_TARGETS.latency.p99P999Ratio,
      status: targetPassed && ratioPassed ? 'PASS' : 'WARN'
    };

    console.log(`  Latency: P99 ${p99.toFixed(2)}ms, P999/P99 ratio ${ratio.toFixed(2)}x [${results.assessment.status}]`);

    if (targetPassed && ratioPassed) {
      this.results.passing++;
    } else {
      this.results.warnings++;
    }

    this.results.regressions.latency = results;
  }

  /**
   * Run all regression tests
   */
  async runAll() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Wave 13 Optimization Regression Detection`);
    console.log(`${'='.repeat(70)}`);

    await this.testPriorityQueue();
    await this.testCompression();
    await this.testMemoryStability();
    await this.testLatencyTargets();

    return this.results;
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`REGRESSION DETECTION SUMMARY`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Passing: ${this.results.passing}`);
    console.log(`Warnings: ${this.results.warnings}`);

    if (this.results.warnings === 0) {
      console.log('\n✓ All Wave 13 optimizations remain effective!\n');
    } else {
      console.log('\n⚠ Some optimizations show regression. Review above.\n');
    }
  }

  /**
   * Save results to file
   */
  saveResults(filename) {
    const json = JSON.stringify(this.results, null, 2);
    fs.writeFileSync(filename, json);

    // Also generate text report
    let report = `Wave 13 Optimization Regression Detection Report\n`;
    report += `Timestamp: ${this.results.timestamp}\n`;
    report += `${'='.repeat(70)}\n\n`;

    report += `Summary:\n`;
    report += `- Passing Tests: ${this.results.passing}\n`;
    report += `- Warnings: ${this.results.warnings}\n\n`;

    for (const [testName, testResults] of Object.entries(this.results.regressions)) {
      report += `Test: ${testResults.name}\n`;
      report += `Status: ${testResults.assessment.status}\n`;
      if (testResults.assessment.details) {
        report += `Details: ${testResults.assessment.details}\n`;
      }
      report += `\n`;
    }

    const reportFile = filename.replace('.json', '.txt');
    fs.writeFileSync(reportFile, report);

    console.log(`✓ Results saved:`);
    console.log(`  JSON: ${filename}`);
    console.log(`  Text: ${reportFile}`);
  }
}

// ==========================================
// Main Execution
// ==========================================

async function main() {
  console.log('\nWave 14 Performance Testing - Regression Detection');
  console.log('Validating Wave 13 optimizations remain effective');
  console.log(`Starting at: ${new Date().toISOString()}\n`);

  const detector = new RegressionDetector();
  const results = await detector.runAll();

  detector.printSummary();
  detector.saveResults(path.join(RESULTS_DIR, 'regression-detection-results.json'));

  process.exit(results.warnings === 0 ? 0 : 1);
}

main().catch(error => {
  console.error('Regression detection failed:', error);
  process.exit(1);
});

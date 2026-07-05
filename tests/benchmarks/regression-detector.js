/**
 * Regression Detection System
 *
 * Compares before/after benchmarks and identifies regressions
 * Thresholds define acceptable changes per metric
 */

const fs = require('fs');
const path = require('path');

class RegressionDetector {
  constructor(beforeResults, afterResults, options = {}) {
    this.before = beforeResults;
    this.after = afterResults;
    this.thresholds = {
      throughput: options.throughputThreshold || -5, // -5% is acceptable degradation
      latencyP99: options.latencyThreshold || 10, // +10% is acceptable increase
      memory: options.memoryThreshold || 10, // +10% growth is acceptable
      reliability: options.reliabilityThreshold || -1 // -1% success rate drop
    };
    this.regressions = [];
    this.improvements = [];
  }

  /**
   * Detect all regressions
   */
  detect() {
    const results = {
      timestamp: new Date().toISOString(),
      hasRegressions: false,
      regressions: [],
      improvements: [],
      summary: {}
    };

    // Check throughput
    const throughputCheck = this.checkThroughput();
    if (throughputCheck.isRegression) {
      results.regressions.push(throughputCheck);
      results.hasRegressions = true;
    } else if (throughputCheck.isImprovement) {
      results.improvements.push(throughputCheck);
    }
    results.summary.throughput = throughputCheck;

    // Check latency
    const latencyCheck = this.checkLatency();
    if (latencyCheck.isRegression) {
      results.regressions.push(latencyCheck);
      results.hasRegressions = true;
    } else if (latencyCheck.isImprovement) {
      results.improvements.push(latencyCheck);
    }
    results.summary.latency = latencyCheck;

    // Check memory
    const memoryCheck = this.checkMemory();
    if (memoryCheck.isRegression) {
      results.regressions.push(memoryCheck);
      results.hasRegressions = true;
    } else if (memoryCheck.isImprovement) {
      results.improvements.push(memoryCheck);
    }
    results.summary.memory = memoryCheck;

    // Check reliability
    const reliabilityCheck = this.checkReliability();
    if (reliabilityCheck.isRegression) {
      results.regressions.push(reliabilityCheck);
      results.hasRegressions = true;
    } else if (reliabilityCheck.isImprovement) {
      results.improvements.push(reliabilityCheck);
    }
    results.summary.reliability = reliabilityCheck;

    return results;
  }

  /**
   * Check throughput regression
   */
  checkThroughput() {
    const before = this.before.metrics.throughput.commandsPerSecond;
    const after = this.after.metrics.throughput.commandsPerSecond;
    const change = ((after - before) / before) * 100;

    const isRegression = change < this.thresholds.throughput;
    const isImprovement = change > 5; // More than 5% improvement

    return {
      metric: 'Throughput',
      before,
      after,
      change: Math.round(change * 100) / 100,
      threshold: this.thresholds.throughput,
      isRegression,
      isImprovement,
      severity: isRegression ? this.calculateSeverity(change, this.thresholds.throughput) : 'none',
      recommendation: this.getThroughputRecommendation(change, isRegression)
    };
  }

  /**
   * Check latency regression
   */
  checkLatency() {
    const before = this.before.metrics.latency.p99;
    const after = this.after.metrics.latency.p99;
    const change = ((after - before) / before) * 100;

    const isRegression = change > this.thresholds.latencyP99;
    const isImprovement = change < -10; // 10% better

    return {
      metric: 'Latency P99',
      before,
      after,
      change: Math.round(change * 100) / 100,
      threshold: this.thresholds.latencyP99,
      isRegression,
      isImprovement,
      severity: isRegression ? this.calculateSeverity(change, this.thresholds.latencyP99) : 'none',
      recommendation: this.getLatencyRecommendation(change, isRegression)
    };
  }

  /**
   * Check memory regression
   */
  checkMemory() {
    const before = this.before.metrics.memory.growth;
    const after = this.after.metrics.memory.growth;
    const change = ((after - before) / before) * 100;

    const isRegression = change > this.thresholds.memory;
    const isImprovement = change < -10; // 10% less growth

    return {
      metric: 'Memory Growth',
      before,
      after,
      change: Math.round(change * 100) / 100,
      threshold: this.thresholds.memory,
      isRegression,
      isImprovement,
      severity: isRegression ? this.calculateSeverity(change, this.thresholds.memory) : 'none',
      recommendation: this.getMemoryRecommendation(change, isRegression)
    };
  }

  /**
   * Check reliability regression
   */
  checkReliability() {
    const before = this.before.metrics.reliability.successRate;
    const after = this.after.metrics.reliability.successRate;
    const change = after - before;

    const isRegression = change < this.thresholds.reliability;
    const isImprovement = change > 1; // 1% improvement

    return {
      metric: 'Success Rate',
      before,
      after,
      change: Math.round(change * 100) / 100,
      threshold: this.thresholds.reliability,
      isRegression,
      isImprovement,
      severity: isRegression ? this.calculateSeverity(change, this.thresholds.reliability) : 'none',
      recommendation: this.getReliabilityRecommendation(change, isRegression)
    };
  }

  /**
   * Calculate severity level
   */
  calculateSeverity(change, threshold) {
    const deviation = Math.abs(change - threshold);
    if (deviation > 100) return 'CRITICAL';
    if (deviation > 50) return 'HIGH';
    if (deviation > 20) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get recommendation for throughput regression
   */
  getThroughputRecommendation(change, isRegression) {
    if (!isRegression) return '';

    if (change < -20) {
      return 'CRITICAL: Investigate command processing bottlenecks. Consider profiling.';
    } else if (change < -10) {
      return 'Review recent changes to command dispatcher and WebSocket handlers.';
    } else {
      return 'Monitor throughput in next iteration; may be within normal variance.';
    }
  }

  /**
   * Get recommendation for latency regression
   */
  getLatencyRecommendation(change, isRegression) {
    if (!isRegression) return '';

    if (change > 50) {
      return 'CRITICAL: Large latency increase detected. Review request handling.';
    } else if (change > 20) {
      return 'Review serialization and response handling performance.';
    } else {
      return 'Monitor latency; may be within normal variance due to test conditions.';
    }
  }

  /**
   * Get recommendation for memory regression
   */
  getMemoryRecommendation(change, isRegression) {
    if (!isRegression) return '';

    if (change > 50) {
      return 'CRITICAL: Significant memory growth detected. Likely memory leak.';
    } else if (change > 20) {
      return 'Review object allocation patterns and GC behavior.';
    } else {
      return 'Monitor memory usage; may stabilize after initial allocation.';
    }
  }

  /**
   * Get recommendation for reliability regression
   */
  getReliabilityRecommendation(change, isRegression) {
    if (!isRegression) return '';

    return 'Investigate command failures. Check error logs for patterns.';
  }

  /**
   * Print regression report
   */
  printReport() {
    const results = this.detect();

    console.log(`\n${'='.repeat(70)}`);
    console.log('REGRESSION DETECTION REPORT');
    console.log(`${'='.repeat(70)}\n`);

    if (results.hasRegressions) {
      console.log('REGRESSIONS DETECTED:');
      results.regressions.forEach(reg => {
        console.log(`\n  ${reg.metric}:`);
        console.log(`    Before: ${reg.before}`);
        console.log(`    After:  ${reg.after}`);
        console.log(`    Change: ${reg.change}%`);
        console.log(`    Severity: ${reg.severity}`);
        console.log(`    Recommendation: ${reg.recommendation}`);
      });
    } else {
      console.log('No regressions detected. All metrics within acceptable thresholds.');
    }

    if (results.improvements.length > 0) {
      console.log(`\nIMPROVEMENTS DETECTED:`);
      results.improvements.forEach(imp => {
        console.log(`\n  ${imp.metric}:`);
        console.log(`    Before: ${imp.before}`);
        console.log(`    After:  ${imp.after}`);
        console.log(`    Improvement: ${Math.abs(imp.change)}%`);
      });
    }

    console.log(`\n${'='.repeat(70)}\n`);

    return results;
  }

  /**
   * Save regression report
   */
  saveReport(filename) {
    const dir = path.join(__dirname, '../../tests/results/benchmarks');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const results = this.detect();
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`Regression report saved to: ${filepath}`);
    return { filepath, results };
  }
}

module.exports = { RegressionDetector };

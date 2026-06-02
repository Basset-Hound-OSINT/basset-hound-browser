/**
 * Stability Metrics Tracker
 * Aggregates and analyzes metrics from all stability tests
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');

class MetricsTracker {
  constructor() {
    this.measurements = [];
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Record a measurement
   */
  recordMeasurement(data) {
    this.measurements.push({
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Record an error
   */
  recordError(error) {
    this.errors.push({
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      message: error.message || error,
      stack: error.stack
    });
  }

  /**
   * Calculate memory statistics
   */
  calculateMemoryStats() {
    if (this.measurements.length === 0) {
      return null;
    }

    const heapValues = this.measurements
      .filter(m => m.memory && m.memory.heapUsed)
      .map(m => m.memory.heapUsed);

    if (heapValues.length === 0) {
      return null;
    }

    const sorted = heapValues.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = heapValues.reduce((a, b) => a + b, 0) / heapValues.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate growth rate
    const first = heapValues[0];
    const last = heapValues[heapValues.length - 1];
    const growth = last - first;

    // Estimate growth per hour
    const elapsedMs = this.measurements[this.measurements.length - 1].timestamp -
                      this.measurements[0].timestamp;
    const elapsedHours = elapsedMs / 1000 / 3600;
    const growthPerHour = elapsedHours > 0 ? growth / elapsedHours : 0;

    return {
      minMB: (min / 1024 / 1024).toFixed(2),
      maxMB: (max / 1024 / 1024).toFixed(2),
      avgMB: (avg / 1024 / 1024).toFixed(2),
      medianMB: (median / 1024 / 1024).toFixed(2),
      growthMB: (growth / 1024 / 1024).toFixed(2),
      growthMBPerHour: (growthPerHour / 1024 / 1024).toFixed(2),
      measurements: heapValues.length
    };
  }

  /**
   * Calculate latency statistics
   */
  calculateLatencyStats() {
    if (this.measurements.length === 0) {
      return null;
    }

    const latencies = this.measurements
      .filter(m => m.latency !== undefined)
      .map(m => m.latency);

    if (latencies.length === 0) {
      return null;
    }

    const sorted = latencies.sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const p999 = sorted[Math.floor(sorted.length * 0.999)];

    return {
      minMs: min.toFixed(2),
      maxMs: max.toFixed(2),
      avgMs: avg.toFixed(2),
      p50Ms: p50.toFixed(2),
      p99Ms: p99.toFixed(2),
      p999Ms: p999.toFixed(2),
      measurements: latencies.length
    };
  }

  /**
   * Calculate error statistics
   */
  calculateErrorStats() {
    if (this.errors.length === 0) {
      return {
        totalErrors: 0,
        errorRate: 0,
        byType: {}
      };
    }

    const byType = {};
    this.errors.forEach(err => {
      const type = err.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalErrors: this.errors.length,
      byType
    };
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate() {
    const withResult = this.measurements.filter(m =>
      m.success !== undefined || m.failure !== undefined
    );

    if (withResult.length === 0) {
      return { successRate: 0, measurements: 0 };
    }

    const successes = withResult.filter(m => m.success).length;
    const rate = (successes / withResult.length * 100).toFixed(2);

    return {
      successRate: rate,
      successes,
      failures: withResult.length - successes,
      measurements: withResult.length
    };
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    return {
      testMetrics: {
        totalMeasurements: this.measurements.length,
        totalErrors: this.errors.length,
        duration: this.endTime && this.startTime
          ? (this.endTime - this.startTime) / 1000 / 60
          : 0
      },
      memory: this.calculateMemoryStats(),
      latency: this.calculateLatencyStats(),
      errors: this.calculateErrorStats(),
      success: this.calculateSuccessRate(),
      timestamps: {
        start: this.startTime ? new Date(this.startTime).toISOString() : null,
        end: this.endTime ? new Date(this.endTime).toISOString() : null
      }
    };
  }

  /**
   * Check stability criteria
   */
  checkStabilityCriteria() {
    const memoryStats = this.calculateMemoryStats();
    const latencyStats = this.calculateLatencyStats();
    const errorStats = this.calculateErrorStats();
    const successStats = this.calculateSuccessRate();

    const criteria = {
      memoryStable: memoryStats && parseFloat(memoryStats.growthMBPerHour) < 2,
      memoryReason: memoryStats
        ? `Growth rate: ${memoryStats.growthMBPerHour} MB/hour (target: <2 MB/hour)`
        : 'No memory data',

      latencyStable: latencyStats && parseFloat(latencyStats.p99Ms) < 2,
      latencyReason: latencyStats
        ? `P99 Latency: ${latencyStats.p99Ms}ms (target: <2ms)`
        : 'No latency data',

      errorRateLow: successStats && parseFloat(successStats.successRate) >= 99.9,
      errorReason: `Success rate: ${successStats.successRate}% (target: >=99.9%)`,

      noLeaks: !errorStats || errorStats.totalErrors < 10,
      leakReason: `Total errors: ${errorStats.totalErrors} (max: 10)`,

      uptime: successStats && parseFloat(successStats.successRate) >= 99.5,
      uptimeReason: `Uptime: ${successStats.successRate}% (target: >=99.5%)`
    };

    // Overall pass/fail
    criteria.overallPass = criteria.memoryStable &&
                          criteria.latencyStable &&
                          criteria.errorRateLow &&
                          criteria.noLeaks &&
                          criteria.uptime;

    return criteria;
  }

  /**
   * Save report to file
   */
  saveReport(directory, filename = null) {
    const timestamp = Date.now();
    const fname = filename || `stability-report-${timestamp}.json`;
    const reportPath = path.join(directory, fname);

    const report = this.generateReport();
    const criteria = this.checkStabilityCriteria();

    const fullReport = {
      report,
      criteria,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`Report saved to ${reportPath}`);

    return reportPath;
  }
}

/**
 * Aggregate multiple test results
 */
class StabilityReportAggregator {
  constructor() {
    this.testResults = [];
  }

  /**
   * Add test result
   */
  addTestResult(testName, result) {
    this.testResults.push({
      testName,
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Load test results from directory
   */
  loadTestResults(directory) {
    if (!fs.existsSync(directory)) {
      console.log(`Directory ${directory} does not exist`);
      return;
    }

    const files = fs.readdirSync(directory).filter(f => f.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(directory, file), 'utf8');
        const data = JSON.parse(content);
        this.testResults.push({
          testName: file,
          result: data,
          timestamp: Date.now()
        });
      } catch (err) {
        console.error(`Failed to load ${file}: ${err.message}`);
      }
    }
  }

  /**
   * Generate aggregated report
   */
  generateAggregatedReport() {
    const allMeasurements = [];
    const allErrors = [];

    for (const testResult of this.testResults) {
      if (testResult.result.measurements) {
        allMeasurements.push(...testResult.result.measurements);
      }
      if (testResult.result.errors) {
        allErrors.push(...testResult.result.errors);
      }
    }

    // Create tracker with all data
    const tracker = new MetricsTracker();
    tracker.measurements = allMeasurements;
    tracker.errors = allErrors;
    tracker.startTime = allMeasurements.length > 0
      ? allMeasurements[0].timestamp
      : null;
    tracker.endTime = allMeasurements.length > 0
      ? allMeasurements[allMeasurements.length - 1].timestamp
      : null;

    return {
      summary: {
        totalTests: this.testResults.length,
        totalMeasurements: allMeasurements.length,
        totalErrors: allErrors.length
      },
      metrics: tracker.generateReport(),
      criteria: tracker.checkStabilityCriteria(),
      testResults: this.testResults.map(t => ({
        name: t.testName,
        timestamp: t.timestamp
      }))
    };
  }

  /**
   * Save aggregated report
   */
  saveAggregatedReport(directory) {
    const report = this.generateAggregatedReport();
    const timestamp = Date.now();
    const reportPath = path.join(directory, `aggregated-stability-report-${timestamp}.json`);

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`Aggregated report saved to ${reportPath}`);

    return reportPath;
  }
}

module.exports = {
  MetricsTracker,
  StabilityReportAggregator
};

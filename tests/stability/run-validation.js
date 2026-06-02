#!/usr/bin/env node

/**
 * Long-Running Stability Validation Orchestrator
 * Runs all stability tests and generates comprehensive report
 *
 * Date: June 1, 2026
 * Version: 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { MetricsTracker, StabilityReportAggregator } = require('./metrics-tracker');

const RESULTS_DIR = path.join(__dirname, '../results');
const STABILITY_DIR = path.join(RESULTS_DIR, 'stability-' + Date.now());
const TEST_TIMEOUT_24H = 24 * 60 * 60 * 1000;
const TEST_TIMEOUT_LOAD = 2 * 60 * 60 * 1000; // Quick validation: 2 hours
const TEST_TIMEOUT_FAILURE = 2 * 60 * 60 * 1000;

// Ensure directories exist
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

if (!fs.existsSync(STABILITY_DIR)) {
  fs.mkdirSync(STABILITY_DIR, { recursive: true });
}

class StabilityValidationRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0
      }
    };
  }

  /**
   * Check if WebSocket server is running
   */
  async checkServerHealth() {
    console.log('\n[CHECK] WebSocket Server Health');
    const { WebSocket } = require('ws');

    try {
      const ws = new WebSocket('ws://localhost:8765');
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.on('open', () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        });

        ws.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (err) {
      return false;
    }
  }

  /**
   * Run a single test
   */
  async runTest(testName, testFile, timeout) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${testName}`);
    console.log(`${'='.repeat(60)}`);

    const testPath = path.join(__dirname, testFile);
    const logFile = path.join(STABILITY_DIR, `${testName.toLowerCase().replace(/ /g, '-')}.log`);

    try {
      const startTime = Date.now();

      // Run test with timeout
      execSync(`node "${testPath}"`, {
        stdio: 'inherit',
        timeout: timeout,
        cwd: __dirname
      });

      const duration = (Date.now() - startTime) / 1000;
      this.results.tests[testName] = {
        status: 'PASSED',
        duration: `${duration.toFixed(2)}s`,
        timestamp: new Date().toISOString()
      };
      this.results.summary.passed++;

      console.log(`✓ ${testName} PASSED`);
      return true;
    } catch (err) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMsg = err.message || err.toString();

      this.results.tests[testName] = {
        status: 'FAILED',
        duration: `${duration.toFixed(2)}s`,
        error: errorMsg.substring(0, 200),
        timestamp: new Date().toISOString()
      };
      this.results.summary.failed++;

      console.error(`✗ ${testName} FAILED: ${errorMsg}`);
      return false;
    } finally {
      this.results.summary.total++;
    }
  }

  /**
   * Generate comprehensive validation report
   */
  generateFinalReport() {
    const report = {
      title: 'LONG-RUNNING STABILITY VALIDATION REPORT',
      date: new Date().toISOString(),
      executionTime: this.getFormattedTime(),

      summary: {
        totalTests: this.results.summary.total,
        passed: this.results.summary.passed,
        failed: this.results.summary.failed,
        successRate: this.results.summary.total > 0
          ? ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(2)
          : 0
      },

      testResults: this.results.tests,

      criteria: {
        memoryStability: {
          target: '<2 MB/hour growth',
          description: 'Heap should not grow more than 2MB per hour'
        },
        connectionStability: {
          target: 'No connection leaks',
          description: 'All connections should properly close on disconnect'
        },
        performanceStability: {
          target: 'P99 latency <2ms',
          description: 'Latency should remain consistent throughout test'
        },
        errorRateLow: {
          target: '<0.1% error rate',
          description: 'System should maintain high reliability'
        },
        recoveryCapability: {
          target: '100% recovery from injected failures',
          description: 'System should recover from network and resource failures'
        }
      },

      deliverables: [
        '24-Hour Continuous Session Test - Single WebSocket connection for 24+ hours',
        'Load Profile Test - Realistic daily load patterns with concurrency scaling',
        'Failure Injection Test - Network, resource, and cascading failure scenarios',
        'Memory Stability Metrics - Growth rate, peaks, and leak detection',
        'Performance Metrics - Latency tracking and degradation analysis',
        'Error Rate Analysis - Type categorization and recovery metrics',
        'Comprehensive Stability Report - All metrics aggregated'
      ],

      passingCriteria: {
        overall: 'System demonstrates production-ready stability',
        memoryPass: 'Memory growth <2MB/hour with no leaks',
        performancePass: 'P99 latency consistently <2ms',
        reliabilityPass: '>99.5% uptime with <0.1% error rate',
        recoveryPass: '100% recovery from injected failures',
        concurrencyPass: 'Handles 300+ concurrent connections at peak load'
      },

      nextSteps: [
        'Review all test results in ' + STABILITY_DIR,
        'Analyze memory profiles for any slow growth patterns',
        'Verify latency consistency across different load phases',
        'Confirm error recovery metrics meet expectations',
        'Consider edge cases from failure injection results'
      ],

      resultsDirectory: STABILITY_DIR,

      timestamp: new Date().toISOString()
    };

    return report;
  }

  /**
   * Get formatted duration
   */
  getFormattedTime() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }

  /**
   * Save final report
   */
  saveFinalReport() {
    const report = this.generateFinalReport();
    const reportPath = path.join(STABILITY_DIR, 'STABILITY-VALIDATION-REPORT.json');

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nFinal report saved to ${reportPath}`);

    return reportPath;
  }

  /**
   * Print console summary
   */
  printSummary() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('STABILITY VALIDATION SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Tests: ${this.results.summary.total}`);
    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Success Rate: ${this.results.summary.total > 0 ? ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(2) : 0}%`);
    console.log(`Results Directory: ${STABILITY_DIR}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Run all validation tests
   */
  async runAllTests() {
    console.log(`\n${'#'.repeat(60)}`);
    console.log('# LONG-RUNNING STABILITY VALIDATION');
    console.log('# Starting comprehensive test suite');
    console.log(`# Timestamp: ${new Date().toISOString()}`);
    console.log(`# Results Directory: ${STABILITY_DIR}`);
    console.log(`${'#'.repeat(60)}`);

    // Check server health
    console.log('\n[HEALTH] Checking WebSocket server...');
    const serverHealthy = await this.checkServerHealth();
    if (!serverHealthy) {
      console.error('ERROR: WebSocket server is not responding');
      console.error('Please ensure the server is running on ws://localhost:8765');
      process.exit(1);
    }
    console.log('✓ WebSocket server is healthy');

    // Run tests based on environment
    const runFull24H = process.env.RUN_FULL_TESTS === 'true';

    if (runFull24H) {
      // Full 24-hour test (only on request)
      await this.runTest('24-Hour Continuous Session', '24-hour-session.test.js', TEST_TIMEOUT_24H);
    } else {
      console.log('\n[INFO] Skipping 24-hour test (use RUN_FULL_TESTS=true to enable)');
      this.results.tests['24-Hour Continuous Session'] = {
        status: 'SKIPPED',
        reason: 'Requires full 24 hours - use RUN_FULL_TESTS=true',
        timestamp: new Date().toISOString()
      };
    }

    // Load profile test
    await this.runTest('Real-World Load Profile', 'load-profile.test.js', TEST_TIMEOUT_LOAD);

    // Failure injection test
    await this.runTest('Failure Injection & Recovery', 'failure-injection.test.js', TEST_TIMEOUT_FAILURE);

    // Generate and save final report
    this.saveFinalReport();

    // Print summary
    this.printSummary();

    // Return success/failure
    return this.results.summary.failed === 0;
  }
}

// Main execution
if (require.main === module) {
  const runner = new StabilityValidationRunner();

  runner.runAllTests().then((success) => {
    console.log(`\n[COMPLETE] Stability validation ${success ? 'PASSED' : 'had failures'}`);
    console.log(`Results saved to: ${STABILITY_DIR}`);

    process.exit(success ? 0 : 1);
  }).catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
}

module.exports = { StabilityValidationRunner };

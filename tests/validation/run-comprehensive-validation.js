#!/usr/bin/env node

/**
 * Comprehensive Validation Test Suite Runner
 * Orchestrates execution of all validation tests
 * Generates comprehensive report
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VALIDATION_TESTS_DIR = __dirname;
const RESULTS_DIR = path.join(path.dirname(VALIDATION_TESTS_DIR), 'results');
const REPORT_FILE = path.join(RESULTS_DIR, 'COMPREHENSIVE-VALIDATION-REPORT.md');
const JSON_RESULTS = path.join(RESULTS_DIR, 'VALIDATION-TEST-RESULTS.json');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const TEST_SUITES = [
  {
    name: 'End-to-End Journey Testing',
    file: 'e2e-journeys.test.js',
    timeout: 600000, // 10 minutes
    phase: 1,
  },
  {
    name: 'Real-World Scenario Testing',
    file: 'real-world-scenarios.test.js',
    timeout: 600000,
    phase: 1,
  },
  {
    name: 'High-Load Stress Testing',
    file: 'stress-high-load.test.js',
    timeout: 3900000, // 65 minutes (1 hour + buffer)
    phase: 2,
  },
  {
    name: 'Chaos: Component Failure',
    file: 'chaos-component-failure.test.js',
    timeout: 300000, // 5 minutes
    phase: 3,
  },
  {
    name: 'Chaos: Network Conditions',
    file: 'chaos-network.test.js',
    timeout: 300000,
    phase: 3,
  },
  {
    name: 'Performance: End-to-End Latency',
    file: 'performance-e2e.test.js',
    timeout: 300000,
    phase: 4,
  },
  {
    name: 'Integration: Multi-Feature',
    file: 'integration-multi-feature.test.js',
    timeout: 300000,
    phase: 5,
  },
];

const VALIDATION_RESULTS = {
  startTime: new Date().toISOString(),
  endTime: null,
  duration: 0,
  testSuites: [],
  summary: {
    totalSuites: TEST_SUITES.length,
    passedSuites: 0,
    failedSuites: 0,
    successRate: 0,
  },
  phases: {},
  issues: [],
  recommendations: [],
};

/**
 * Run a single test suite
 */
function runTestSuite(testSuite) {
  return new Promise((resolve) => {
    const testPath = path.join(VALIDATION_TESTS_DIR, testSuite.file);
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${testSuite.name}`);
    console.log(`File: ${testSuite.file}`);
    console.log(`Timeout: ${testSuite.timeout / 1000}s`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Try running with Node
      const output = execSync(`node "${testPath}"`, {
        timeout: testSuite.timeout,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const elapsed = Date.now() - startTime;
      const passed = !output.includes('FAIL') && output.includes('PASS');

      const result = {
        name: testSuite.name,
        file: testSuite.file,
        phase: testSuite.phase,
        status: passed ? 'PASSED' : 'FAILED',
        duration: elapsed,
        output: output.substring(0, 5000), // Truncate large outputs
      };

      console.log(result.output);
      console.log(`\n[${result.status}] Completed in ${result.duration}ms\n`);

      resolve(result);
    } catch (error) {
      const elapsed = Date.now() - startTime;

      const errorMessage = error.message || error.toString();
      const isTimeout = errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout');

      const result = {
        name: testSuite.name,
        file: testSuite.file,
        phase: testSuite.phase,
        status: 'FAILED',
        duration: elapsed,
        error: isTimeout
          ? `Test timeout after ${testSuite.timeout / 1000}s`
          : errorMessage.substring(0, 500),
        output: error.stdout
          ? error.stdout.toString().substring(0, 5000)
          : errorMessage.substring(0, 5000),
      };

      console.error(`\n[FAILED] ${result.error}\n`);
      if (result.output) {
        console.error(`Output: ${result.output.substring(0, 1000)}\n`);
      }

      resolve(result);
    }
  });
}

/**
 * Check if WebSocket server is running
 */
function checkWebSocketServer() {
  try {
    const WebSocket = require('ws');
    const client = new WebSocket('ws://localhost:8765');

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        client.close();
        resolve(false);
      }, 5000);

      client.on('open', () => {
        clearTimeout(timeout);
        client.close();
        resolve(true);
      });

      client.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });
    });
  } catch (e) {
    return Promise.resolve(false);
  }
}

/**
 * Generate comprehensive report
 */
function generateReport() {
  const report = [];

  report.push('# Comprehensive System Validation Report\n');
  report.push(`**Generated:** ${new Date().toISOString()}\n`);
  report.push(`**Duration:** ${VALIDATION_RESULTS.duration / 1000 / 60} minutes\n\n`);

  // Summary
  report.push('## Executive Summary\n');
  report.push(
    `- **Total Test Suites:** ${VALIDATION_RESULTS.summary.totalSuites}\n`
  );
  report.push(
    `- **Passed:** ${VALIDATION_RESULTS.summary.passedSuites}\n`
  );
  report.push(
    `- **Failed:** ${VALIDATION_RESULTS.summary.failedSuites}\n`
  );
  report.push(
    `- **Success Rate:** ${VALIDATION_RESULTS.summary.successRate.toFixed(2)}%\n\n`
  );

  // Results by phase
  report.push('## Results by Phase\n\n');
  Object.entries(VALIDATION_RESULTS.phases).forEach(([phase, suites]) => {
    const passed = suites.filter((s) => s.status === 'PASSED').length;
    report.push(`### Phase ${phase} (${passed}/${suites.length} passed)\n\n`);
    suites.forEach((suite) => {
      report.push(
        `- **${suite.name}**: ${suite.status} (${suite.duration}ms)\n`
      );
    });
    report.push('\n');
  });

  // Detailed results
  report.push('## Detailed Results\n\n');
  VALIDATION_RESULTS.testSuites.forEach((suite) => {
    report.push(`### ${suite.name}\n\n`);
    report.push(`- **Status:** ${suite.status}\n`);
    report.push(`- **Duration:** ${suite.duration}ms\n`);
    report.push(`- **File:** ${suite.file}\n`);
    if (suite.error) {
      report.push(`- **Error:** ${suite.error}\n`);
    }
    report.push('\n');
  });

  // Issues
  if (VALIDATION_RESULTS.issues.length > 0) {
    report.push('## Issues Found\n\n');
    VALIDATION_RESULTS.issues.forEach((issue, idx) => {
      report.push(`${idx + 1}. **${issue.severity}:** ${issue.message}\n`);
      if (issue.suite) {
        report.push(`   - Suite: ${issue.suite}\n`);
      }
    });
    report.push('\n');
  }

  // Recommendations
  if (VALIDATION_RESULTS.recommendations.length > 0) {
    report.push('## Recommendations\n\n');
    VALIDATION_RESULTS.recommendations.forEach((rec, idx) => {
      report.push(`${idx + 1}. ${rec}\n`);
    });
    report.push('\n');
  }

  // System Readiness
  report.push('## System Readiness Assessment\n\n');
  if (VALIDATION_RESULTS.summary.successRate >= 90) {
    report.push(
      '✅ **PRODUCTION READY** - System passes 90%+ of validation tests\n\n'
    );
    report.push('**Confidence Level:** VERY HIGH\n\n');
  } else if (VALIDATION_RESULTS.summary.successRate >= 75) {
    report.push(
      '⚠️ **CONDITIONAL** - System passes 75%+ but has some issues\n\n'
    );
    report.push(
      '**Recommend:** Address issues before production deployment\n\n'
    );
  } else {
    report.push('❌ **NOT READY** - System has critical issues\n\n');
    report.push('**Recommend:** Fix failures before deployment\n\n');
  }

  return report.join('');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('COMPREHENSIVE SYSTEM VALIDATION & CHAOS TESTING');
  console.log('='.repeat(60));

  // Check WebSocket server
  console.log('\nChecking WebSocket server...');
  const serverRunning = await checkWebSocketServer();

  if (!serverRunning) {
    console.log('⚠️  WebSocket server not running on ws://localhost:8765');
    console.log('Some tests may fail or timeout');
    console.log('To start the server: npm start or yarn start\n');
  } else {
    console.log('✅ WebSocket server is running\n');
  }

  // Run all test suites
  const startTime = Date.now();

  for (const testSuite of TEST_SUITES) {
    const result = await runTestSuite(testSuite);
    VALIDATION_RESULTS.testSuites.push(result);

    // Track by phase
    if (!VALIDATION_RESULTS.phases[result.phase]) {
      VALIDATION_RESULTS.phases[result.phase] = [];
    }
    VALIDATION_RESULTS.phases[result.phase].push(result);

    // Check if failed
    if (result.status === 'FAILED') {
      VALIDATION_RESULTS.summary.failedSuites++;
      VALIDATION_RESULTS.issues.push({
        severity: 'HIGH',
        message: `Test suite failed: ${result.name}`,
        suite: result.name,
        error: result.error,
      });
    } else {
      VALIDATION_RESULTS.summary.passedSuites++;
    }
  }

  // Calculate duration and success rate
  VALIDATION_RESULTS.endTime = new Date().toISOString();
  VALIDATION_RESULTS.duration = Date.now() - startTime;
  VALIDATION_RESULTS.summary.successRate =
    (VALIDATION_RESULTS.summary.passedSuites /
      VALIDATION_RESULTS.summary.totalSuites) *
    100;

  // Add recommendations based on results
  if (VALIDATION_RESULTS.summary.failedSuites > 0) {
    VALIDATION_RESULTS.recommendations.push(
      'Review failed test suites and address errors'
    );
    VALIDATION_RESULTS.recommendations.push(
      'Ensure WebSocket server is running on port 8765'
    );
    VALIDATION_RESULTS.recommendations.push(
      'Check system logs for underlying issues'
    );
  } else {
    VALIDATION_RESULTS.recommendations.push('All validation tests passed successfully');
    VALIDATION_RESULTS.recommendations.push('System is ready for production deployment');
    VALIDATION_RESULTS.recommendations.push(
      'Monitor performance metrics in production'
    );
  }

  // Generate and save reports
  const report = generateReport();
  fs.writeFileSync(REPORT_FILE, report, 'utf-8');
  fs.writeFileSync(JSON_RESULTS, JSON.stringify(VALIDATION_RESULTS, null, 2), 'utf-8');

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(60));
  console.log(
    `\nTotal Duration: ${(VALIDATION_RESULTS.duration / 1000 / 60).toFixed(2)} minutes`
  );
  console.log(`Passed: ${VALIDATION_RESULTS.summary.passedSuites}/${VALIDATION_RESULTS.summary.totalSuites}`);
  console.log(`Success Rate: ${VALIDATION_RESULTS.summary.successRate.toFixed(2)}%`);
  console.log(`\nReport saved to: ${REPORT_FILE}`);
  console.log(`JSON results saved to: ${JSON_RESULTS}`);

  // Print readiness assessment
  console.log('\n' + '='.repeat(60));
  if (VALIDATION_RESULTS.summary.successRate >= 90) {
    console.log('✅ SYSTEM READY FOR PRODUCTION');
  } else if (VALIDATION_RESULTS.summary.successRate >= 75) {
    console.log('⚠️ CONDITIONAL PRODUCTION READINESS');
  } else {
    console.log('❌ SYSTEM NOT READY FOR PRODUCTION');
  }
  console.log('='.repeat(60) + '\n');

  // Exit with appropriate code
  process.exit(
    VALIDATION_RESULTS.summary.failedSuites > 0 ? 1 : 0
  );
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

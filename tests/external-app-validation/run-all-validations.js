#!/usr/bin/env node

/**
 * External App Reliability - Master Validation Suite Runner
 *
 * Runs all validation tests required for external apps to reliably use
 * the Basset Hound Browser WebSocket API.
 *
 * Test order matters - early tests may affect server state
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const WS_URL = process.env.WS_URL || 'ws://localhost:8765';
const TEST_TIMEOUT = 60000; // 60 seconds per test
const SKIP_LONG_TESTS = process.env.SKIP_LONG_TESTS === 'true';

// Test suite definition
const TEST_SUITE = [
  {
    name: 'Core Workflow Validation',
    file: 'core-workflow.test.js',
    description: 'Validates essential workflow: navigate → wait → extract → verify',
    critical: true,
    estimatedTime: 60000,
    skip: false
  },
  {
    name: 'Response Schema Validation',
    file: 'schema-validation.test.js',
    description: 'Validates response formats match documentation',
    critical: true,
    estimatedTime: 30000,
    skip: false
  },
  {
    name: 'Connection Stability Test',
    file: 'connection-stability.test.js',
    description: 'Validates connection stability over 5+ minute session',
    critical: true,
    estimatedTime: 320000, // 5+ minutes + overhead
    skip: SKIP_LONG_TESTS
  },
  {
    name: 'Rate Limiting Enforcement',
    file: 'rate-limiting.test.js',
    description: 'Validates rate limits are enforced as documented',
    critical: false,
    estimatedTime: 120000,
    skip: SKIP_LONG_TESTS
  },
  {
    name: 'Error Recovery & Reconnection',
    file: 'error-recovery.test.js',
    description: 'Validates graceful reconnection and recovery',
    critical: true,
    estimatedTime: 60000,
    skip: false
  }
];

// Results tracking
const RESULTS = {
  startTime: Date.now(),
  endTime: null,
  tests: [],
  totalCritical: 0,
  totalCriticalPassed: 0,
  totalTests: 0,
  totalPassed: 0,
  totalFailed: 0,
  skipped: 0
};

// Colors for console output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function runTest(testConfig) {
  return new Promise((resolve) => {
    if (testConfig.skip) {
      log(`  ⊘ SKIPPED: ${testConfig.name}`, 'yellow');
      RESULTS.skipped++;
      resolve({ ...testConfig, status: 'SKIPPED', passed: null, duration: 0 });
      return;
    }

    log(`  Running: ${testConfig.name}...`, 'cyan');
    const testPath = path.join(__dirname, testConfig.file);
    const startTime = Date.now();

    const proc = spawn('node', [testPath], {
      env: { ...process.env, WS_URL },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });

    const timeout = setTimeout(() => {
      proc.kill();
      const duration = Date.now() - startTime;
      log(`  ✗ TIMEOUT after ${duration}ms`, 'red');
      resolve({
        ...testConfig,
        status: 'TIMEOUT',
        passed: false,
        duration,
        error: 'Test timeout'
      });
    }, TEST_TIMEOUT);

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      const passed = code === 0;

      if (passed) {
        log(`  ✓ PASSED in ${(duration / 1000).toFixed(1)}s`, 'green');
      } else {
        log(`  ✗ FAILED (exit code ${code}) in ${(duration / 1000).toFixed(1)}s`, 'red');
      }

      resolve({
        ...testConfig,
        status: passed ? 'PASSED' : 'FAILED',
        passed,
        duration,
        output: stdout,
        error: stderr
      });
    });
  });
}

async function runAllTests() {
  log('\n╔═══════════════════════════════════════════════════╗', 'bright');
  log('║  EXTERNAL APP RELIABILITY VALIDATION SUITE      ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝\n', 'bright');

  log(`Server URL: ${WS_URL}`, 'dim');
  log(`Start time: ${new Date().toISOString()}\n`, 'dim');

  // Show test plan
  log('Test Plan:', 'bright');
  const activeTests = TEST_SUITE.filter(t => !t.skip);
  const estimatedTotalTime = activeTests.reduce((sum, t) => sum + t.estimatedTime, 0);
  log(`  ${activeTests.length}/${TEST_SUITE.length} tests will run (${(estimatedTotalTime / 1000 / 60).toFixed(1)} minutes estimated)\n`, 'dim');

  TEST_SUITE.forEach((test) => {
    const status = test.skip ? '⊘' : '○';
    const critical = test.critical ? ' [CRITICAL]' : '';
    log(`  ${status} ${test.name}${critical}`, test.skip ? 'dim' : 'reset');
    log(`     ${test.description}`, 'dim');
  });

  log('\n' + '='.repeat(51), 'dim');
  log('Running Tests\n', 'bright');

  // Run all tests sequentially
  for (const testConfig of TEST_SUITE) {
    const result = await runTest(testConfig);
    RESULTS.tests.push(result);

    if (!testConfig.skip) {
      RESULTS.totalTests++;
      if (testConfig.critical) {
        RESULTS.totalCritical++;
        if (result.passed) {
          RESULTS.totalCriticalPassed++;
        }
      }
      if (result.passed) {
        RESULTS.totalPassed++;
      } else if (result.status !== 'TIMEOUT') {
        RESULTS.totalFailed++;
      }
    }

    log('');
  }

  RESULTS.endTime = Date.now();
  const totalDuration = RESULTS.endTime - RESULTS.startTime;

  // Print summary
  log('╔═══════════════════════════════════════════════════╗', 'bright');
  log('║              VALIDATION SUMMARY                  ║', 'bright');
  log('╚═══════════════════════════════════════════════════╝\n', 'bright');

  log(`Total execution time: ${(totalDuration / 1000).toFixed(1)}s`, 'dim');
  log(`\nTest Results:`, 'bright');
  log(`  Total tests:     ${RESULTS.totalTests}`);
  log(`  Passed:          ${RESULTS.totalPassed}`, 'green');
  log(`  Failed:          ${RESULTS.totalFailed}`, 'red');
  log(`  Skipped:         ${RESULTS.skipped}`, 'yellow');

  log(`\nCritical Tests:`, 'bright');
  log(`  Total:           ${RESULTS.totalCritical}`);
  log(`  Passed:          ${RESULTS.totalCriticalPassed}`, 'green');
  log(`  Failed:          ${RESULTS.totalCritical - RESULTS.totalCriticalPassed}`, 'red');

  log('\nDetailed Results:\n', 'bright');
  RESULTS.tests.forEach((result, idx) => {
    const statusIcon = result.status === 'PASSED' ? '✓' : result.status === 'SKIPPED' ? '⊘' : '✗';
    const statusColor = result.status === 'PASSED' ? 'green' : result.status === 'SKIPPED' ? 'yellow' : 'red';
    const critical = result.critical ? ' [CRITICAL]' : '';
    log(
      `  ${statusIcon} ${result.name}${critical} (${(result.duration / 1000).toFixed(1)}s)`,
      statusColor
    );
  });

  // Overall status
  log('\n' + '='.repeat(51), 'dim');

  const allCriticalPassed = RESULTS.totalCriticalPassed === RESULTS.totalCritical;
  const someCriticalFailed = RESULTS.totalCritical - RESULTS.totalCriticalPassed > 0;

  if (allCriticalPassed && RESULTS.totalFailed === 0) {
    log('\n✓ VALIDATION COMPLETE - ALL TESTS PASSED', 'green');
    log('\nExternal apps can reliably use this system.', 'green');
    log('All critical reliability checks passed.\n', 'green');
    process.exit(0);
  } else if (allCriticalPassed) {
    log('\n⚠ VALIDATION PASSED - CRITICAL TESTS OK', 'yellow');
    log(`\n${RESULTS.totalFailed} non-critical tests failed.`, 'yellow');
    log('External apps should be able to use this system,', 'yellow');
    log('but some optional validations failed.\n', 'yellow');
    process.exit(0);
  } else {
    log('\n✗ VALIDATION FAILED - CRITICAL ISSUES DETECTED', 'red');
    log(`\n${RESULTS.totalCritical - RESULTS.totalCriticalPassed} critical tests failed.`, 'red');
    log('External apps cannot reliably use this system.', 'red');
    log('Fix the critical issues before using in production.\n', 'red');
    process.exit(1);
  }
}

// Run the suite
runAllTests().catch((error) => {
  log(`\nFatal error: ${error.message}`, 'red');
  process.exit(1);
});

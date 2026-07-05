#!/usr/bin/env node

/**
 * v12.9.0 Test Runner
 * Orchestrates test execution for all v12.9.0 feature tests
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const TESTS_DIR = __dirname;
const FEATURES_DIR = path.join(TESTS_DIR, 'features');
const INTEGRATION_DIR = path.join(TESTS_DIR, 'integration');
const BENCHMARKS_DIR = path.join(TESTS_DIR, 'benchmarks');

const FEATURE_GROUPS = {
  compression: [
    'adaptive-compression.test.js',
    'compression-optimization.test.js',
    'compression-streaming.test.js',
    'compression-algorithms.test.js',
    'compression-monitoring.test.js'
  ],
  forensics: [
    'forensic-analysis-core.test.js',
    'forensic-extraction.test.js',
    'forensic-analysis-advanced.test.js',
    'forensic-integrity.test.js',
    'forensic-reporting.test.js'
  ]
};

async function runTests(testFiles, options = {}) {
  const {
    reporter = 'spec',
    timeout = 10000,
    verbose = false,
    stopOnFirstFailure = false
  } = options;

  const args = [
    `--timeout ${timeout}`,
    `--reporter ${reporter}`,
    stopOnFirstFailure ? '--bail' : '',
    verbose ? '--reporter-options reportDir=./test-reports' : ''
  ].filter(Boolean).join(' ');

  try {
    const command = `mocha ${args} ${testFiles.join(' ')}`;
    if (verbose) {
      console.log(`Running: ${command}`);
    }

    const { stdout, stderr } = await execAsync(command, {
      cwd: TESTS_DIR,
      maxBuffer: 10 * 1024 * 1024
    });

    console.log(stdout);
    if (stderr && verbose) {
      console.error(stderr);
    }

    return { success: true, stdout, stderr };
  } catch (error) {
    console.error(`Test execution failed: ${error.message}`);
    return { success: false, error };
  }
}

async function runFeatureGroup(groupName, options = {}) {
  console.log(`\n========================================`);
  console.log(`Running ${groupName.toUpperCase()} Tests`);
  console.log(`========================================\n`);

  const tests = FEATURE_GROUPS[groupName];
  if (!tests) {
    console.error(`Unknown feature group: ${groupName}`);
    return { success: false };
  }

  const testPaths = tests.map(t => path.join(FEATURES_DIR, t));

  // Verify files exist
  const missingTests = testPaths.filter(p => !fs.existsSync(p));
  if (missingTests.length > 0) {
    console.error(`Missing test files: ${missingTests.join(', ')}`);
    return { success: false };
  }

  return runTests(testPaths, options);
}

async function runAllTests(options = {}) {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║    v12.9.0 COMPREHENSIVE TEST SUITE    ║');
  console.log('╚════════════════════════════════════════╝\n');

  const results = {};

  for (const [groupName, tests] of Object.entries(FEATURE_GROUPS)) {
    const testPaths = tests.map(t => path.join(FEATURES_DIR, t));
    console.log(`\nTesting ${groupName}... (${tests.length} tests)`);

    try {
      results[groupName] = await runTests(testPaths, {
        ...options,
        reporter: options.reporter || 'json'
      });
    } catch (error) {
      results[groupName] = { success: false, error };
    }
  }

  // Summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║           TEST SUMMARY REPORT          ║');
  console.log('╚════════════════════════════════════════╝\n');

  for (const [groupName, result] of Object.entries(results)) {
    const status = result.success ? '✓' : '✗';
    console.log(`${status} ${groupName}: ${result.success ? 'PASSED' : 'FAILED'}`);
  }

  const allPassed = Object.values(results).every(r => r.success);
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);

  return allPassed;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  const options = {
    verbose: args.includes('--verbose'),
    reporter: 'spec',
    timeout: 10000
  };

  try {
    let success;

    switch (command) {
      case 'compression':
        success = (await runFeatureGroup('compression', options)).success;
        break;
      case 'forensics':
        success = (await runFeatureGroup('forensics', options)).success;
        break;
      case 'all':
        success = await runAllTests(options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log('Usage: node test-runner.js [compression|forensics|all] [--verbose]');
        process.exit(1);
    }

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();

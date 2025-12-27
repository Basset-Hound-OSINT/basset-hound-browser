#!/usr/bin/env node

/**
 * Integration Test Runner
 *
 * Runs all integration tests and reports results.
 */

const path = require('path');

// Test suites
const testSuites = [
  {
    name: 'Communication Tests',
    path: './extension-browser/communication.test.js'
  },
  {
    name: 'Command Sync Tests',
    path: './extension-browser/command-sync.test.js'
  },
  {
    name: 'Session Sharing Tests',
    path: './extension-browser/session-sharing.test.js'
  },
  {
    name: 'Form Filling Scenarios',
    path: './scenarios/form-filling.test.js'
  },
  {
    name: 'Navigation Scenarios',
    path: './scenarios/navigation.test.js'
  },
  {
    name: 'Data Extraction Scenarios',
    path: './scenarios/data-extraction.test.js'
  },
  {
    name: 'Screenshot Scenarios',
    path: './scenarios/screenshot.test.js'
  },
  {
    name: 'Protocol Tests',
    path: './protocol.test.js'
  }
];

// Parse command line arguments
const args = process.argv.slice(2);
const specificSuite = args.find(arg => !arg.startsWith('-'));
const verbose = args.includes('--verbose') || args.includes('-v');
const failFast = args.includes('--fail-fast') || args.includes('-f');

/**
 * Run a single test suite
 */
async function runSuite(suite) {
  console.log('\n' + '='.repeat(70));
  console.log(`Running: ${suite.name}`);
  console.log('='.repeat(70));

  try {
    const testModule = require(suite.path);
    const success = await testModule.runTests();
    return { name: suite.name, success, error: null };
  } catch (error) {
    console.error(`Error running ${suite.name}:`, error.message);
    if (verbose) {
      console.error(error.stack);
    }
    return { name: suite.name, success: false, error: error.message };
  }
}

/**
 * Main runner
 */
async function main() {
  console.log('='.repeat(70));
  console.log('Basset Hound Integration Tests');
  console.log('='.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}`);

  const startTime = Date.now();
  const results = [];

  // Filter suites if specific one requested
  let suitesToRun = testSuites;
  if (specificSuite) {
    suitesToRun = testSuites.filter(s =>
      s.name.toLowerCase().includes(specificSuite.toLowerCase()) ||
      s.path.includes(specificSuite)
    );

    if (suitesToRun.length === 0) {
      console.error(`\nNo test suite found matching: ${specificSuite}`);
      console.log('\nAvailable suites:');
      testSuites.forEach(s => console.log(`  - ${s.name} (${s.path})`));
      process.exit(1);
    }
  }

  console.log(`\nRunning ${suitesToRun.length} test suite(s)...`);

  for (const suite of suitesToRun) {
    const result = await runSuite(suite);
    results.push(result);

    if (!result.success && failFast) {
      console.log('\n--fail-fast enabled, stopping on first failure');
      break;
    }

    // Small delay between suites to allow cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('Test Summary');
  console.log('='.repeat(70));

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  results.forEach(r => {
    const status = r.success ? 'PASSED' : 'FAILED';
    const icon = r.success ? '[+]' : '[-]';
    console.log(`${icon} ${r.name}: ${status}`);
    if (!r.success && r.error) {
      console.log(`    Error: ${r.error}`);
    }
  });

  console.log('\n' + '-'.repeat(70));
  console.log(`Total:    ${results.length} suite(s)`);
  console.log(`Passed:   ${passed}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Duration: ${duration}s`);
  console.log('='.repeat(70));

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('\nUncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\nUnhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run
main().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

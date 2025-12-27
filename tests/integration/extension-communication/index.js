/**
 * Extension Communication Integration Test Suite
 *
 * Main entry point for running all extension-browser communication tests.
 * Tests verify WebSocket communication, command flow, session sharing,
 * profile synchronization, network coordination, and error handling.
 */

const path = require('path');

// Test modules
const websocketConnectionTests = require('./websocket-connection.test');
const commandFlowTests = require('./command-flow.test');
const sessionCookieSharingTests = require('./session-cookie-sharing.test');
const profileSyncTests = require('./profile-sync.test');
const networkCoordinationTests = require('./network-coordination.test');
const errorHandlingTests = require('./error-handling.test');

/**
 * Test suite configuration
 */
const TEST_SUITES = [
  {
    name: 'WebSocket Connection',
    module: websocketConnectionTests,
    description: 'Tests WebSocket connection establishment, reconnection, and state management'
  },
  {
    name: 'Command Flow',
    module: commandFlowTests,
    description: 'Tests all command types flowing from extension to browser'
  },
  {
    name: 'Session/Cookie Sharing',
    module: sessionCookieSharingTests,
    description: 'Tests session isolation and cookie/storage sharing'
  },
  {
    name: 'Profile Synchronization',
    module: profileSyncTests,
    description: 'Tests profile, fingerprint, and user agent synchronization'
  },
  {
    name: 'Network Coordination',
    module: networkCoordinationTests,
    description: 'Tests network request interception and rule synchronization'
  },
  {
    name: 'Error Handling',
    module: errorHandlingTests,
    description: 'Tests error recovery, reconnection, and graceful degradation'
  }
];

/**
 * Format duration for display
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Run a single test suite
 */
async function runSuite(suite) {
  const startTime = Date.now();
  console.log('\n' + '='.repeat(70));
  console.log(`Running: ${suite.name}`);
  console.log(`Description: ${suite.description}`);
  console.log('='.repeat(70));

  try {
    const success = await suite.module.runTests();
    const duration = Date.now() - startTime;

    return {
      name: suite.name,
      success,
      duration,
      error: null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Suite ${suite.name} threw error: ${error.message}`);

    return {
      name: suite.name,
      success: false,
      duration,
      error: error.message
    };
  }
}

/**
 * Run all test suites
 */
async function runAllTests(options = {}) {
  const startTime = Date.now();
  const results = {
    suites: [],
    totalPassed: 0,
    totalFailed: 0,
    totalDuration: 0
  };

  console.log('\n');
  console.log('#'.repeat(70));
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#' + '   Extension-Browser Communication Integration Tests'.padEnd(68) + '#');
  console.log('#' + ' '.repeat(68) + '#');
  console.log('#'.repeat(70));

  // Filter suites if specific ones requested
  let suitesToRun = TEST_SUITES;
  if (options.suites && options.suites.length > 0) {
    suitesToRun = TEST_SUITES.filter(s =>
      options.suites.some(name =>
        s.name.toLowerCase().includes(name.toLowerCase())
      )
    );
  }

  console.log(`\nRunning ${suitesToRun.length} test suite(s)...`);

  // Run each suite
  for (const suite of suitesToRun) {
    const result = await runSuite(suite);
    results.suites.push(result);

    if (result.success) {
      results.totalPassed++;
    } else {
      results.totalFailed++;
    }
  }

  results.totalDuration = Date.now() - startTime;

  // Print final summary
  console.log('\n');
  console.log('#'.repeat(70));
  console.log('#' + '   FINAL SUMMARY'.padEnd(68) + '#');
  console.log('#'.repeat(70));

  console.log('\nSuite Results:');
  console.log('-'.repeat(60));

  for (const result of results.suites) {
    const status = result.success ? 'PASSED' : 'FAILED';
    const statusColor = result.success ? '' : ' !!!';
    console.log(`  ${result.name.padEnd(35)} ${status.padEnd(8)} ${formatDuration(result.duration)}${statusColor}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  console.log('-'.repeat(60));
  console.log(`\nTotal: ${results.suites.length} suites`);
  console.log(`Passed: ${results.totalPassed}`);
  console.log(`Failed: ${results.totalFailed}`);
  console.log(`Duration: ${formatDuration(results.totalDuration)}`);

  if (results.totalFailed > 0) {
    console.log('\n!!! SOME TESTS FAILED !!!');
    console.log('Failed suites:');
    results.suites
      .filter(s => !s.success)
      .forEach(s => console.log(`  - ${s.name}${s.error ? `: ${s.error}` : ''}`));
  } else {
    console.log('\nAll tests passed!');
  }

  console.log('\n');

  return results.totalFailed === 0;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    suites: [],
    help: false,
    list: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--suite' || arg === '-s') {
      const suiteName = args[++i];
      if (suiteName) {
        options.suites.push(suiteName);
      }
    } else if (!arg.startsWith('-')) {
      options.suites.push(arg);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Extension Communication Integration Tests

Usage: node index.js [options] [suite-names...]

Options:
  --help, -h      Show this help message
  --list, -l      List available test suites
  --suite, -s     Run specific suite(s) by name

Examples:
  node index.js                        # Run all suites
  node index.js websocket              # Run suites matching "websocket"
  node index.js -s "Command Flow"      # Run specific suite
  node index.js websocket command      # Run multiple suites

Available Suites:
`);

  TEST_SUITES.forEach(suite => {
    console.log(`  ${suite.name}`);
    console.log(`    ${suite.description}`);
  });

  console.log('');
}

/**
 * List available test suites
 */
function listSuites() {
  console.log('\nAvailable Test Suites:\n');

  TEST_SUITES.forEach((suite, index) => {
    console.log(`${index + 1}. ${suite.name}`);
    console.log(`   ${suite.description}\n`);
  });
}

// Export for Jest or programmatic use
module.exports = {
  runAllTests,
  TEST_SUITES,
  websocketConnectionTests,
  commandFlowTests,
  sessionCookieSharingTests,
  profileSyncTests,
  networkCoordinationTests,
  errorHandlingTests
};

// Run if called directly
if (require.main === module) {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.list) {
    listSuites();
    process.exit(0);
  }

  runAllTests(options)
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

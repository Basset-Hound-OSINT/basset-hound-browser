/**
 * Jest Global Setup
 * Runs once before all tests - used for system checks and resource validation
 */

const systemCheck = require('./system-check');
const path = require('path');
const fs = require('fs');

/**
 * Global setup function - runs before Jest initializes the test environment
 */
async function globalSetup() {
  console.log('\n🚀 Starting test suite initialization...\n');

  // Check system health
  const healthResults = systemCheck.checkSystemHealth();

  // Print detailed health report
  systemCheck.printHealthReport(healthResults, true);

  // Assert system is ready (throws if not)
  try {
    systemCheck.assertSystemReady();
  } catch (err) {
    console.error('❌ Test suite initialization failed:');
    console.error(`   ${err.message}`);
    console.error('\nTo fix this issue:');
    console.error('  1. Close unnecessary applications to free memory');
    console.error('  2. Ensure at least 4 GB of free disk space available');
    console.error('  3. Wait for system CPU load to decrease');
    process.exit(1);
  }

  // Create required directories
  const requiredDirs = [
    path.join(process.cwd(), 'tests', 'results'),
    path.join(process.cwd(), 'tests', 'results', 'screenshots'),
    path.join(process.cwd(), 'tests', 'results', 'reports'),
    path.join(process.cwd(), 'tests', 'output'),
    path.join(process.cwd(), 'tests', 'certs'),
    path.join(process.cwd(), 'tmp')
  ];

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Log test environment info
  console.log('✅ Test environment ready\n');
  console.log('Test Configuration:');
  console.log(`  Node version:     ${process.version}`);
  console.log(`  Platform:         ${process.platform} ${process.arch}`);
  console.log(`  Test directory:   ${process.cwd()}`);
  console.log(`  Workers:          4 (unit), 1 (integration/stress)`);
  console.log(`  Timeout:          30s (unit), 60s (integration), 120s (stress)`);
  console.log();

  // Set environment variables for test runs
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.TEST_MODE = 'true';

  // Configure Node.js memory limits for workers
  if (process.env.NODE_OPTIONS === undefined) {
    // Each worker gets 512MB max with aggressive GC
    process.env.NODE_OPTIONS = '--max_old_space_size=512 --expose-gc';
  }

  // Enable manual GC for heap exhaustion prevention
  if (global.gc) {
    console.log('✅ Manual garbage collection enabled (--expose-gc)');
  } else {
    console.warn('⚠️  Manual GC disabled - run with --expose-gc for better heap management');
  }

  console.log('🎯 Global setup complete - tests will now run\n');

  // Return nothing (void/undefined) to signal successful setup
  return Promise.resolve();
}

module.exports = globalSetup;

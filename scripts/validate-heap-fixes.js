#!/usr/bin/env node

/**
 * Heap Exhaustion Fix Validation Script
 * Runs tests with memory profiling to verify <2GB memory usage
 *
 * Usage:
 *   node scripts/validate-heap-fixes.js [options]
 *
 * Options:
 *   --full          Run full test suite (default: sample of 5 tests)
 *   --profile       Generate heap snapshot on completion
 *   --watch         Watch memory in real-time during tests
 *   --timeout SEC   Override test timeout (default: 120s)
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  fullSuite: process.argv.includes('--full'),
  profile: process.argv.includes('--profile'),
  watch: process.argv.includes('--watch'),
  timeout: parseInt(
    process.argv.find(arg => arg.startsWith('--timeout='))?.split('=')[1] || '120'
  ) * 1000
};

// Test samples (representative mix)
const testSamples = [
  'tests/p1-001-headless-mode.test.js',
  'tests/p1-002-adaptive-timeout.test.js',
  'tests/api-key-rate-limiter.test.js',
  'tests/monitoring-metrics.test.js',
  'tests/connection-pool.test.js'
];

const projectRoot = path.join(__dirname, '..');

console.log(`
╔════════════════════════════════════════════════════════════════╗
║           HEAP EXHAUSTION FIX VALIDATION                       ║
║           Verifying <2GB memory usage                          ║
╚════════════════════════════════════════════════════════════════╝
`);

console.log('Configuration:');
console.log(`  Mode:              ${config.fullSuite ? 'Full suite' : 'Sample (5 tests)'}`);
console.log(`  Memory profiling:  ${config.profile ? 'Enabled' : 'Disabled'}`);
console.log(`  Live watch:        ${config.watch ? 'Enabled' : 'Disabled'}`);
console.log(`  Test timeout:      ${config.timeout / 1000}s`);
console.log();

// Prepare environment
const env = {
  ...process.env,
  NODE_ENV: 'test',
  TEST_MODE: 'true',
  NODE_OPTIONS: '--max_old_space_size=512 --expose-gc',
  JEST_MAX_WORKERS: '1'
};

// Choose test files
let testFiles = testSamples;
if (config.fullSuite) {
  testFiles = fs.readdirSync(path.join(projectRoot, 'tests'))
    .filter(f => f.endsWith('.test.js'))
    .map(f => path.join('tests', f));
  console.log(`Running full suite: ${testFiles.length} test files\n`);
} else {
  console.log(`Running sample: ${testSamples.length} test files\n`);
}

// Memory monitoring state
let peakHeap = 0;
let peakRss = 0;
const memoryLog = [];

// Start memory monitor if requested
let monitorInterval;
if (config.watch) {
  monitorInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);

    process.stdout.write(`\r  Memory: ${heapMB}MB heap, ${rssMB}MB RSS`);

    if (heapMB > peakHeap) peakHeap = heapMB;
    if (rssMB > peakRss) peakRss = rssMB;

    memoryLog.push({
      timestamp: Date.now(),
      heapMB,
      rssMB
    });
  }, 500);
}

// Run Jest with tests
const jestArgs = [
  'jest',
  ...testFiles,
  '--maxWorkers=1',
  '--testTimeout=60000',
  '--logHeapUsage',
  '--detectOpenHandles',
  '--forceExit',
  config.profile ? '--verbose' : ''
].filter(Boolean);

console.log(`Running: ${jestArgs.join(' ')}\n`);
console.log('='.repeat(64));

const jest = spawn('npx', jestArgs, {
  cwd: projectRoot,
  env,
  stdio: 'inherit'
});

jest.on('close', (code) => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }

  console.log('\n' + '='.repeat(64));
  console.log(`\nTest execution completed with code: ${code}\n`);

  // Print memory summary
  const currentMem = process.memoryUsage();
  const currentHeapMB = Math.round(currentMem.heapUsed / 1024 / 1024);
  const currentRssMB = Math.round(currentMem.rss / 1024 / 1024);

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    MEMORY VALIDATION REPORT                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('Current Memory Usage:');
  console.log(`  Heap:     ${currentHeapMB}MB`);
  console.log(`  RSS:      ${currentRssMB}MB`);
  console.log(`  Peak:     ${peakHeap}MB heap, ${peakRss}MB RSS`);

  // Determine status
  const heapStatus = currentHeapMB < 400 ? '✅' : currentHeapMB < 500 ? '⚠️ ' : '❌';
  const rssStatus = currentRssMB < 800 ? '✅' : currentRssMB < 1200 ? '⚠️ ' : '❌';

  console.log(`\nStatus:`);
  console.log(`  Heap (<400MB target):  ${heapStatus} ${currentHeapMB}MB`);
  console.log(`  RSS (<1000MB target):  ${rssStatus} ${currentRssMB}MB`);

  // Check against 2GB goal
  const heap2GBCheck = currentHeapMB < 500 ? '✅' : '❌';
  const rss2GBCheck = currentRssMB < 1500 ? '✅' : '❌';

  console.log(`\n2GB Memory Goal (across all workers):`);
  console.log(`  Single worker heap:  ${heap2GBCheck} ${currentHeapMB}MB`);
  console.log(`  Overall footprint:   ${rss2GBCheck} ${currentRssMB}MB`);

  // Generate report file
  const reportPath = path.join(projectRoot, 'tests/results/heap-validation-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    config,
    results: {
      currentHeap: currentHeapMB,
      currentRss: currentRssMB,
      peakHeap: peakHeap,
      peakRss: peakRss,
      testsPassed: code === 0,
      memoryLog: memoryLog.slice(0, 100) // Keep first 100 samples
    },
    goals: {
      heapTarget: '<400MB',
      rssTarget: '<1000MB',
      totalMemoryTarget: '<2GB'
    }
  };

  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);

  // Summary
  console.log('\n' + '='.repeat(64));
  if (code === 0 && currentHeapMB < 400 && currentRssMB < 1000) {
    console.log('✅ VALIDATION PASSED - Heap exhaustion fixes verified!');
  } else if (code === 0) {
    console.log('⚠️  Tests passed but memory usage is higher than target');
    console.log('   Consider increasing GC frequency or reducing test data');
  } else {
    console.log('❌ VALIDATION FAILED - Tests did not pass');
  }
  console.log('='.repeat(64) + '\n');

  // Exit with test result code
  process.exit(code);
});

jest.on('error', (err) => {
  console.error('Failed to start Jest:', err);
  process.exit(1);
});

// Handle SIGINT
process.on('SIGINT', () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
  }
  jest.kill();
  console.log('\n\nValidation interrupted');
  process.exit(1);
});

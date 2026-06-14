#!/usr/bin/env node

/**
 * Test Orchestrator - Batch Test Execution System
 *
 * Executes grouped test suites with minimal overhead
 * Supports parallel execution, aggregated reporting, and flexible grouping
 *
 * Usage:
 *   node tests/orchestrator.js <suite> [options]
 *
 * Suites:
 *   unit          - Unit tests only (fast)
 *   integration   - Integration tests (medium)
 *   e2e           - End-to-end tests (slow)
 *   api           - API/WebSocket tests
 *   evasion       - Bot evasion tests
 *   forensics     - Forensic/extraction tests
 *   security      - Security tests
 *   performance   - Performance/load/stress tests
 *   compliance    - Regulatory compliance tests
 *   critical      - Critical path tests (unit + core integration)
 *   all           - All tests
 *   custom        - Custom test paths (via --paths)
 *
 * Options:
 *   --coverage    - Include coverage reporting
 *   --parallel N  - Run N test files in parallel (default: 4)
 *   --verbose     - Verbose output
 *   --json        - JSON output for CI systems
 *   --paths       - Comma-separated test paths (for custom suite)
 *   --exclude     - Exclude tests matching pattern
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const TEST_DIR = path.join(__dirname);
const PROJECT_ROOT = path.join(__dirname, '..');

// Test suite definitions
const SUITES = {
  unit: {
    pattern: 'tests/unit/**/*.test.js',
    jest: true,
    timeout: 30000,
    description: 'Unit tests - isolated, fast'
  },
  integration: {
    pattern: 'tests/integration/**/*.test.js',
    jest: true,
    timeout: 60000,
    description: 'Integration tests - system components'
  },
  e2e: {
    pattern: 'tests/e2e/**/*.test.js',
    jest: true,
    timeout: 180000,
    description: 'End-to-end tests - full workflows'
  },
  api: {
    pattern: ['tests/api/**/*.test.js', 'tests/integration/protocol.test.js'],
    jest: true,
    timeout: 60000,
    description: 'API/WebSocket tests'
  },
  evasion: {
    pattern: ['tests/evasion/**/*.test.js', 'tests/bot-detection/**/*.test.js'],
    jest: true,
    timeout: 120000,
    description: 'Bot evasion framework tests'
  },
  forensics: {
    pattern: ['tests/integration/forensic*.test.js', 'tests/integration/evidence*.test.js'],
    jest: true,
    timeout: 120000,
    description: 'Forensic/evidence extraction tests'
  },
  security: {
    pattern: 'tests/security/**/*.test.js',
    jest: true,
    timeout: 90000,
    description: 'Security and compliance tests'
  },
  performance: {
    pattern: ['tests/performance/**/*.test.js', 'tests/stress/**/*.test.js', 'tests/load/**/*.test.js'],
    jest: true,
    timeout: 120000,
    description: 'Performance, stress, and load tests'
  },
  compliance: {
    pattern: 'tests/compliance/**/*.test.js',
    jest: true,
    timeout: 90000,
    description: 'Regulatory compliance tests'
  },
  critical: {
    pattern: ['tests/unit/**/*.test.js', 'tests/integration/system-wiring.test.js', 'tests/integration/protocol.test.js'],
    jest: true,
    timeout: 60000,
    description: 'Critical path tests (unit + core integration)'
  },
  validation: {
    pattern: 'tests/validation/**/*.test.js',
    jest: true,
    timeout: 120000,
    description: 'Validation and sanity check tests'
  },
  wave14: {
    pattern: 'tests/wave14/**/*.test.js',
    jest: true,
    timeout: 90000,
    description: 'Latest wave delivery tests'
  },
  all: {
    pattern: ['tests/**/*.test.js'],
    jest: true,
    timeout: 300000,
    description: 'All tests'
  }
};

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const suite = args[0] || 'critical';
  const options = {
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    json: args.includes('--json'),
    parallel: parseInt(getArgValue(args, '--parallel') || '4', 10),
    suite: suite,
    exclude: getArgValue(args, '--exclude'),
    paths: getArgValue(args, '--paths')
  };
  return options;
}

function getArgValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx < args.length - 1 ? args[idx + 1] : null;
}

// Find test files matching patterns
function findTestFiles(patterns) {
  const files = new Set();
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  for (const pattern of patternArray) {
    const expanded = expandPattern(pattern);
    expanded.forEach(f => files.add(f));
  }

  return Array.from(files).sort();
}

function expandPattern(pattern) {
  const files = [];
  const baseDir = PROJECT_ROOT;

  // Convert glob-like pattern to file search
  if (pattern.includes('**')) {
    const parts = pattern.split('**');
    const prefix = parts[0];
    const suffix = parts[1];

    const dir = path.join(baseDir, prefix);
    if (fs.existsSync(dir)) {
      walkDir(dir, files, suffix);
    }
  } else {
    const fullPath = path.join(baseDir, pattern);
    if (fs.existsSync(fullPath)) {
      if (fs.statSync(fullPath).isDirectory()) {
        walkDir(fullPath, files, '');
      } else {
        files.push(fullPath);
      }
    }
  }

  return files.filter(f => f.endsWith('.test.js'));
}

function walkDir(dir, files, suffix) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '__mocks__', 'results', 'fixtures', 'data'].includes(entry.name)) {
          walkDir(fullPath, files, suffix);
        }
      } else if (!suffix || fullPath.endsWith(suffix)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // ignore
  }
}

// Run Jest with multiple files
async function runJest(testFiles, options) {
  return new Promise((resolve) => {
    const args = ['--testPathPattern=' + testFiles.map(f => f.replace(PROJECT_ROOT + '/', '')).join('|')];

    if (options.coverage) {
      args.push('--coverage');
    }
    if (options.verbose) {
      args.push('--verbose');
    }
    if (options.json) {
      args.push('--json');
    }

    const env = { ...process.env, NODE_ENV: 'test' };
    const result = spawnSync('npx', ['jest', ...args], {
      cwd: PROJECT_ROOT,
      env: env,
      stdio: 'inherit'
    });

    resolve(result.status === 0);
  });
}

// Print test suite info
function printSuiteInfo(options) {
  const suite = SUITES[options.suite];
  if (!suite) {
    console.error(`Unknown suite: ${options.suite}`);
    console.error(`Available suites: ${Object.keys(SUITES).join(', ')}`);
    process.exit(1);
  }

  if (!options.json) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Test Suite: ${options.suite.toUpperCase()}`);
    console.log(`Description: ${suite.description}`);
    console.log(`Timeout: ${suite.timeout}ms`);
    console.log(`${'='.repeat(70)}\n`);
  }

  return suite;
}

// Main execution
async function main() {
  const options = parseArgs();

  // Handle help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  // Handle list
  if (process.argv.includes('--list')) {
    printSuites();
    process.exit(0);
  }

  // Get suite definition
  const suite = printSuiteInfo(options);

  // Find test files
  let testFiles;
  if (options.paths) {
    testFiles = options.paths.split(',').map(p => path.join(PROJECT_ROOT, p.trim()));
  } else {
    testFiles = findTestFiles(suite.pattern);
  }

  if (testFiles.length === 0) {
    console.error('No test files found!');
    process.exit(1);
  }

  if (!options.json) {
    console.log(`Found ${testFiles.length} test files\n`);
  }

  // Run tests
  const startTime = Date.now();
  const success = await runJest(testFiles, options);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!options.json) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Status: ${success ? 'PASS' : 'FAIL'}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  process.exit(success ? 0 : 1);
}

function printHelp() {
  console.log(`
Test Orchestrator - Batch Test Execution System

USAGE:
  node tests/orchestrator.js <suite> [options]

SUITES:
`);

  Object.entries(SUITES).forEach(([name, suite]) => {
    console.log(`  ${name.padEnd(15)} ${suite.description}`);
  });

  console.log(`

OPTIONS:
  --coverage     Include coverage reporting
  --parallel N   Run N test files in parallel (default: 4)
  --verbose      Verbose output
  --json         JSON output for CI systems
  --paths        Comma-separated test paths (for custom suite)
  --exclude      Exclude tests matching pattern
  --list         List all available suites
  --help         Show this help message

EXAMPLES:
  node tests/orchestrator.js unit                    # Run unit tests
  node tests/orchestrator.js critical --coverage     # Critical tests with coverage
  node tests/orchestrator.js all --verbose           # All tests with verbose output
  node tests/orchestrator.js custom --paths "tests/unit/foo.test.js,tests/unit/bar.test.js"
`);
}

function printSuites() {
  console.log('Available test suites:\n');
  Object.entries(SUITES).forEach(([name, suite]) => {
    console.log(`${name.padEnd(15)} ${suite.description}`);
  });
}

// Run
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

/**
 * Jest Configuration
 * Optimized for memory efficiency and test performance
 * Heap exhaustion fixes: reduced workers, aggressive GC, data pruning
 */

module.exports = {
  displayName: 'basset-hound-browser',
  testEnvironment: 'node',

  // Test matching patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],

  // Module paths
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],

  // Collection
  collectCoverageFrom: [
    'websocket/**/*.js',
    'evasion/**/*.js',
    'proxy/**/*.js',
    'input/**/*.js',
    'utils/**/*.js',
    'cookies/**/*.js',
    'profiles/**/*.js',
    'geolocation/**/*.js',
    'storage/**/*.js',
    'tabs/**/*.js',
    'sessions/**/*.js',
    'logging/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },

  // Setup and teardown
  // setupFilesAfterEnv: [
  //   '<rootDir>/tests/helpers/setup.js',
  //   '<rootDir>/tests/helpers/memory-utils.js'
  // ],

  // globalSetup: '<rootDir>/tests/helpers/global-setup.js',
  // globalTeardown: '<rootDir>/tests/helpers/global-teardown.js',

  // ============================================================
  // MEMORY OPTIMIZATION SETTINGS
  // ============================================================

  // CRITICAL: Use single worker to prevent heap exhaustion
  // Single worker = 512MB heap limit (safer than multi-worker overhead)
  // Multi-worker overhead: 2 workers = 1GB baseline, 4 workers = 2GB baseline
  maxWorkers: process.env.JEST_MAX_WORKERS
    ? parseInt(process.env.JEST_MAX_WORKERS, 10)
    : 1, // Always single worker for heap safety

  // Aggressive test timeout to catch stalled processes early and prevent memory leaks
  testTimeout: process.env.TEST_TIMEOUT
    ? parseInt(process.env.TEST_TIMEOUT, 10)
    : 60000, // 60 seconds (reduced from 120s for faster leak detection)

  // Force exit on timeout (prevent zombie workers)
  forceExit: true,

  // Detect and warn about open handles
  detectOpenHandles: true,

  // Log heap usage per test file
  logHeapUsage: true,

  // Verbose output for debugging
  verbose: process.env.JEST_VERBOSE === 'true',

  // ============================================================
  // HEAP EXHAUSTION PREVENTION
  // ============================================================

  // Disable worker pool caching to reduce memory overhead
  workerIdleMemoryLimit: process.env.JEST_WORKER_IDLE_MEMORY_LIMIT || '128M',

  // Immediately exit workers after test completion
  // Note: poolTimeout removed - invalid jest config option, not supported

  // Strict cleanup: don't reuse workers between tests
  resetMocks: true,
  resetModules: true,
  restoreMocks: true,

  // Reduce module cache pressure
  moduleNameMapper: {
    // Cache-bust large dependencies in tests
  },

  // ============================================================
  // GARBAGE COLLECTION SETTINGS
  // ============================================================

  // Bail on first test failure to stop wasting resources
  bail: process.env.JEST_BAIL ? parseInt(process.env.JEST_BAIL, 10) : 0,

  // Cache directory - limit size to prevent bloat
  cacheDirectory: '<rootDir>/.jest-cache',

  // ============================================================
  // CONCURRENCY CONTROL
  // ============================================================

  // Run tests sequentially within workers to prevent concurrent GC issues
  maxConcurrency: 1,

  // ============================================================
  // ENVIRONMENT SETUP
  // ============================================================

  testEnvironmentOptions: {
    // Node.js environment options
    NODE_ENV: 'test',
    TEST_MODE: 'true'
  },

  // ============================================================
  // REPORTERS
  // ============================================================

  reporters: [
    'default',
    [
      '<rootDir>/tests/helpers/memory-reporter.js',
      {
        outputFile: '<rootDir>/tests/results/memory-report.json'
      }
    ]
  ],

  // ============================================================
  // SNAPSHOTS
  // ============================================================

  snapshotFormat: {
    printBasicPrototype: false
  }
};

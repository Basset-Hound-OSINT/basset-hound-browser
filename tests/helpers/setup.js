/**
 * Basset Hound Browser - Test Setup
 * Global setup and configuration for tests
 * Includes memory monitoring and resource management
 */

const path = require('path');
const fs = require('fs');
const systemCheck = require('./system-check');
const memoryUtils = require('./memory-utils');

// Test configuration
const TEST_CONFIG = {
  APP_PATH: path.join(__dirname, '..', '..'),
  WS_URL: 'ws://localhost:8765',
  WS_PORT: 8765,
  CONNECT_TIMEOUT: 10000,
  COMMAND_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 60000,
  TEST_PAGE_PATH: path.join(__dirname, '..', 'test-server.html'),
  SCREENSHOTS_DIR: path.join(__dirname, '..', 'results', 'screenshots'),
  REPORTS_DIR: path.join(__dirname, '..', 'results', 'reports'),
  VERBOSE: process.env.VERBOSE === 'true' || process.argv.includes('--verbose')
};

// Get test page URL
TEST_CONFIG.TEST_PAGE_URL = `file://${TEST_CONFIG.TEST_PAGE_PATH}`;

/**
 * Initialize test environment
 */
function initTestEnvironment() {
  // Create necessary directories
  const dirs = [
    TEST_CONFIG.SCREENSHOTS_DIR,
    TEST_CONFIG.REPORTS_DIR
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Set default timeouts
  if (typeof jest !== 'undefined') {
    jest.setTimeout(60000);
  }
}

/**
 * Global setup before all tests
 */
async function globalSetup() {
  initTestEnvironment();

  // Create test HTML page if it doesn't exist
  if (!fs.existsSync(TEST_CONFIG.TEST_PAGE_PATH)) {
    await createTestPage();
  }

  console.log('Test environment initialized');
  console.log('App path:', TEST_CONFIG.APP_PATH);
  console.log('WebSocket URL:', TEST_CONFIG.WS_URL);
}

/**
 * Global teardown after all tests
 */
async function globalTeardown() {
  console.log('Test environment cleanup complete');
}

/**
 * Setup test cleanup hooks for memory management
 * ULTRA-AGGRESSIVE: Prevent heap exhaustion via immediate cleanup
 */
beforeEach(async () => {
  // Pre-test cleanup
  memoryUtils.clearCaches();
  memoryUtils.clearRequireCache();

  // Force immediate GC before test starts
  if (global.gc) {
    global.gc();
  }
});

afterEach(async () => {
  // ULTRA-AGGRESSIVE cleanup after each test to prevent heap exhaustion
  // This runs after EVERY test, not just suites

  // 1. Clear caches IMMEDIATELY (before GC)
  memoryUtils.clearCaches();

  // 2. Clear require cache for module isolation
  memoryUtils.clearRequireCache();

  // 3. Force TRIPLE GC passes for stubborn objects
  if (global.gc) {
    global.gc();
    await new Promise(resolve => setTimeout(resolve, 10));
    global.gc();
    await new Promise(resolve => setTimeout(resolve, 10));
    global.gc();
  }

  // 4. Small delay for GC settling (reduced from 50ms)
  await new Promise(resolve => setTimeout(resolve, 25));

  // 5. Check memory status and warn if high
  const status = memoryUtils.getMemoryStatus();
  if (status.warning || status.critical) {
    console.warn(`⚠️  [Memory] High heap: ${status.current}MB (peak: ${status.peak}MB)`);

    // Force emergency cleanup if critical
    if (status.critical) {
      console.error(`🚨 Critical memory state detected, forcing emergency cleanup...`);
      memoryUtils.clearCaches();
      if (global.gc) {
        global.gc();
      }
    }
  } else if (process.env.VERBOSE === 'true') {
    console.log(`   [Memory] ${status.current}MB (peak: ${status.peak}MB)`);
  }

  // 6. Final clearance of test-local data
  if (global.__testData__) {
    global.__testData__ = null;
  }
});

/**
 * Clean up test artifacts after all tests complete
 */
afterAll(() => {
  // Final GC before teardown
  if (global.gc) {
    global.gc();
  }

  // Report memory monitoring results
  memoryMonitor.stop();
  memoryMonitor.report();

  // Print memory utils report
  memoryUtils.printMemoryReport();

  // Stop memory monitoring
  memoryUtils.stopMemoryMonitoring();

  // Clear all caches one last time
  memoryUtils.clearCaches();

  // Final GC pass
  if (global.gc) {
    global.gc();
  }

  // Clean up test artifacts
  try {
    const glob = require('glob');
    const rimraf = require('rimraf');

    // Remove test session directories from root
    glob.sync('.test-sessions-*', { cwd: process.cwd() }).forEach(dir => {
      rimraf.sync(dir);
    });

    // Remove other test artifacts from root
    rimraf.sync('.mypy_cache');
    rimraf.sync('.pytest_cache');
    rimraf.sync('htmlcov');
  } catch (err) {
    console.warn(`Warning: Could not clean up test artifacts: ${err.message}`);
  }
});

/**
 * Create the test HTML page
 */
async function createTestPage() {
  const testPageContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Basset Hound Browser - Test Page</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
    }
    .test-section {
      background: white;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-section h2 {
      margin-top: 0;
      color: #555;
    }
    input, textarea, select {
      width: 100%;
      padding: 10px;
      margin: 8px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    button {
      padding: 10px 20px;
      margin: 8px 4px 8px 0;
      background: #4a90d9;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: #357abd;
    }
    .click-test {
      padding: 20px;
      margin: 10px 0;
      background: #e3f2fd;
      border-radius: 4px;
      cursor: pointer;
      text-align: center;
    }
    .click-test:hover {
      background: #bbdefb;
    }
    #click-counter {
      font-size: 1.2em;
      font-weight: bold;
    }
    .scroll-content {
      height: 2000px;
      background: linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Basset Hound Browser - Test Page</h1>

    <div class="test-section">
      <h2>Form Test</h2>
      <form id="test-form">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" placeholder="Enter username">

        <label for="email">Email:</label>
        <input type="email" id="email" name="email" placeholder="Enter email">

        <label for="password">Password:</label>
        <input type="password" id="password" name="password" placeholder="Enter password">

        <label for="search-field">Search:</label>
        <input type="search" id="search-field" name="search" placeholder="Search...">

        <label for="select-option">Select Option:</label>
        <select id="select-option" name="option">
          <option value="">Choose...</option>
          <option value="opt1">Option 1</option>
          <option value="opt2">Option 2</option>
          <option value="opt3">Option 3</option>
        </select>

        <label for="message">Message:</label>
        <textarea id="message" name="message" rows="4" placeholder="Enter your message"></textarea>

        <button type="submit" id="submit-btn">Submit</button>
        <button type="reset" id="reset-btn">Reset</button>
      </form>
    </div>

    <div class="test-section">
      <h2>Click Test</h2>
      <div class="click-test" id="click-test-1">Click Test Area 1</div>
      <div class="click-test" id="click-test-2">Click Test Area 2</div>
      <div class="click-test" id="click-counter" data-count="0">Clicks: 0</div>
    </div>

    <div class="test-section">
      <h2>Button Test</h2>
      <button id="btn-primary">Primary Button</button>
      <button id="btn-secondary">Secondary Button</button>
      <button id="btn-disabled" disabled>Disabled Button</button>
    </div>

    <div class="test-section">
      <h2>Link Test</h2>
      <p><a href="https://example.com" id="link-external">External Link</a></p>
      <p><a href="#section-anchor" id="link-anchor">Anchor Link</a></p>
    </div>

    <div class="test-section" id="section-anchor">
      <h2>Scroll Test Section</h2>
      <div class="scroll-content">
        <p>This content is tall to test scrolling.</p>
        <p style="margin-top: 500px;">Middle content</p>
        <p style="margin-top: 500px;">Bottom content</p>
      </div>
    </div>
  </div>

  <script>
    // Click counter functionality
    document.getElementById('click-counter').addEventListener('click', function() {
      const count = parseInt(this.dataset.count) + 1;
      this.dataset.count = count;
      this.textContent = 'Clicks: ' + count;
    });

    // Form submission handler
    document.getElementById('test-form').addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('Form submitted');
    });

    // Click test handlers
    document.getElementById('click-test-1').addEventListener('click', function() {
      this.textContent = 'Clicked!';
      this.style.background = '#c8e6c9';
    });

    document.getElementById('click-test-2').addEventListener('click', function() {
      this.textContent = 'Clicked!';
      this.style.background = '#c8e6c9';
    });

    // Button handlers
    document.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        console.log('Button clicked:', this.id);
      });
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(TEST_CONFIG.TEST_PAGE_PATH, testPageContent);
  console.log('Created test page:', TEST_CONFIG.TEST_PAGE_PATH);
}

/**
 * Save test results to a report file
 * @param {string} name - Report name
 * @param {Object} results - Test results
 */
function saveTestReport(name, results) {
  const reportPath = path.join(
    TEST_CONFIG.REPORTS_DIR,
    `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log('Report saved:', reportPath);
}

/**
 * Save screenshot from test
 * @param {Buffer} data - Screenshot data
 * @param {string} name - Screenshot name
 * @returns {string} - Path to saved screenshot
 */
function saveScreenshot(data, name) {
  const screenshotPath = path.join(
    TEST_CONFIG.SCREENSHOTS_DIR,
    `${name}-${Date.now()}.png`
  );

  fs.writeFileSync(screenshotPath, data);
  console.log('Screenshot saved:', screenshotPath);
  return screenshotPath;
}

/**
 * Log helper for verbose output
 * @param {...any} args - Log arguments
 */
function log(...args) {
  if (TEST_CONFIG.VERBOSE) {
    console.log('[Test]', ...args);
  }
}

/**
 * Wait utility
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or times out
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>}
 */
async function retry(fn, options = {}) {
  const { maxAttempts = 3, delay = 1000, timeout = 30000 } = options;
  const startTime = Date.now();
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Retry timeout: ${lastError?.message || 'Unknown error'}`);
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      log(`Attempt ${attempt} failed:`, error.message);
      if (attempt < maxAttempts) {
        await wait(delay);
      }
    }
  }

  throw lastError;
}

// Export configuration and utilities
module.exports = {
  TEST_CONFIG,
  initTestEnvironment,
  globalSetup,
  globalTeardown,
  createTestPage,
  saveTestReport,
  saveScreenshot,
  log,
  wait,
  retry
};

/**
 * Memory monitoring and reporting
 */

// Track initial memory state
const initialMemory = {
  timestamp: Date.now(),
  heapUsed: process.memoryUsage().heapUsed
};

// Monitor memory during tests
const memoryMonitor = {
  peakHeapUsed: initialMemory.heapUsed,
  samples: [],
  interval: null,

  start() {
    if (this.interval) return; // Already running

    this.interval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.samples.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });

      if (memUsage.heapUsed > this.peakHeapUsed) {
        this.peakHeapUsed = memUsage.heapUsed;
      }

      // Warn if heap usage exceeds 400MB per worker
      if (memUsage.heapUsed > 400 * 1024 * 1024) {
        console.warn(`⚠️  High heap usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      }
    }, 5000); // Sample every 5 seconds
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },

  report() {
    const endMemory = process.memoryUsage();
    const duration = Date.now() - initialMemory.timestamp;

    console.log('\n' + '='.repeat(60));
    console.log('MEMORY MONITORING REPORT');
    console.log('='.repeat(60));
    console.log(`Test duration: ${Math.round(duration / 1000)}s`);
    console.log(`Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`Final heap:   ${Math.round(endMemory.heapUsed / 1024 / 1024)}MB`);
    console.log(`Peak heap:    ${Math.round(this.peakHeapUsed / 1024 / 1024)}MB`);
    console.log(`Total RSS:    ${Math.round(endMemory.rss / 1024 / 1024)}MB`);
    console.log(`External:     ${Math.round(endMemory.external / 1024 / 1024)}MB`);

    // Calculate memory leak indicator
    const heapGrowth = endMemory.heapUsed - initialMemory.heapUsed;
    if (heapGrowth > 50 * 1024 * 1024) {
      console.log(`\n⚠️  Potential memory leak: ${Math.round(heapGrowth / 1024 / 1024)}MB growth`);
    } else if (heapGrowth < 0) {
      console.log(`\n✅ Memory freed: ${Math.round(-heapGrowth / 1024 / 1024)}MB`);
    } else {
      console.log(`\n✅ Heap stable: ${Math.round(heapGrowth / 1024 / 1024)}MB change`);
    }

    console.log('='.repeat(60) + '\n');
  }
};

// Start memory monitoring on test file load
memoryMonitor.start();

// Auto-initialize when imported
initTestEnvironment();

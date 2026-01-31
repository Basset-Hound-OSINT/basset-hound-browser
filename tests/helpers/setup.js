/**
 * Basset Hound Browser - Test Setup
 * Global setup and configuration for tests
 */

const path = require('path');
const fs = require('fs');

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

// Auto-initialize when imported
initTestEnvironment();

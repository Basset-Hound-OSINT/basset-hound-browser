/**
 * Test Environment Setup
 * Initializes test directories and ensures .test-sessions folder exists
 */

const fs = require('fs');
const path = require('path');

const TEST_SESSIONS_DIR = path.resolve(__dirname, '..', '.test-sessions');

/**
 * Ensure test directories exist
 */
function ensureTestDirectories() {
  // Create .test-sessions directory if it doesn't exist
  if (!fs.existsSync(TEST_SESSIONS_DIR)) {
    fs.mkdirSync(TEST_SESSIONS_DIR, { recursive: true });
    console.log(`✓ Created test sessions directory: ${TEST_SESSIONS_DIR}`);
  }

  // Create subdirectories for different test types
  const subdirs = [
    'unit-tests',
    'integration-tests',
    'e2e-tests',
    'performance-tests',
    'load-tests',
    'stress-tests'
  ];

  subdirs.forEach(subdir => {
    const dirPath = path.join(TEST_SESSIONS_DIR, subdir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

/**
 * Clean old test sessions (older than 7 days)
 */
function cleanOldSessions() {
  const now = Date.now();
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(TEST_SESSIONS_DIR);

    files.forEach(file => {
      if (file === '.gitkeep') return;

      const filePath = path.join(TEST_SESSIONS_DIR, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > SEVEN_DAYS) {
        if (stats.isDirectory()) {
          // Remove old directory recursively
          fs.rmSync(filePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(filePath);
        }
      }
    });
  } catch (err) {
    console.warn(`Warning: Could not clean old test sessions: ${err.message}`);
  }
}

/**
 * Get a unique test session directory
 * @param {string} testType - Type of test (unit, integration, etc.)
 * @returns {string} Path to test session directory
 */
function getTestSessionDir(testType = 'general') {
  const timestamp = Date.now();
  const sessionDir = path.join(TEST_SESSIONS_DIR, testType, `session-${timestamp}`);

  fs.mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}

/**
 * Clean up test artifacts after all tests complete
 */
afterAll(() => {
  // Clean up test artifacts
  const glob = require('glob');
  const rimraf = require('rimraf');

  try {
    // Remove test session directories
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

// Run setup
ensureTestDirectories();
cleanOldSessions();

module.exports = {
  TEST_SESSIONS_DIR,
  ensureTestDirectories,
  cleanOldSessions,
  getTestSessionDir
};

/**
 * Jest Global Teardown
 * Runs once after all tests complete - used for cleanup and resource release
 */

const fs = require('fs');
const path = require('path');

/**
 * Global teardown function - runs after Jest finishes all tests
 */
async function globalTeardown() {
  console.log('\n🧹 Running test suite cleanup...\n');

  // Force garbage collection if available
  if (global.gc) {
    console.log('Forcing garbage collection...');
    global.gc();
  }

  // Clean up temporary test artifacts
  const tempDirs = [
    path.join(process.cwd(), 'tmp'),
    path.join(process.cwd(), '.test-sessions'),
    path.join(process.cwd(), 'tests', 'tmp')
  ];

  for (const dir of tempDirs) {
    if (fs.existsSync(dir)) {
      // Only clean if not .gitkeep protected
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file !== '.gitkeep') {
          const filePath = path.join(dir, file);
          try {
            const stats = fs.lstatSync(filePath);
            if (stats.isDirectory()) {
              removeDirectoryRecursive(filePath);
            } else {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            // Ignore cleanup errors
          }
        }
      }
    }
  }

  console.log('✅ Test suite cleanup complete\n');
}

/**
 * Remove directory recursively
 * @param {string} dirPath - Path to directory
 */
function removeDirectoryRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      const filePath = path.join(dirPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        removeDirectoryRecursive(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

module.exports = globalTeardown;

#!/usr/bin/env node

/**
 * Clean Test Artifacts Script
 *
 * Removes test output files and temporary directories before committing.
 * Runs automatically before tests and commits (via pre-commit hooks).
 * Also includes pre-test system health checks.
 *
 * Usage:
 *   node scripts/clean-test-artifacts.js
 *   npm run test:cleanup
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Import system check utilities
let systemCheck;
try {
  systemCheck = require('../tests/helpers/system-check');
} catch (err) {
  // System check not available - continue with cleanup only
  console.warn('⚠️  System check module not available, skipping health check');
}

const projectRoot = path.join(__dirname, '..');

// Patterns to clean (relative to project root)
const cleanPatterns = [
  // Test outputs (centralized to tests/results and tests/output)
  'tests/results/*',
  '!tests/results/.gitkeep',
  'tests/output/*',
  '!tests/output/.gitkeep',
  'tests/certs/old/*',

  // Temporary test files
  'tmp/*',
  '!tmp/.gitkeep',

  // Legacy test directories
  '.test-sessions*',
  '.test-scratch*',
  'test-sessions/',
  'tmp_tests/',
  'tests/tmp/',

  // Claude Code worktrees (older than 1 hour handled by separate logic)
  '.claude/worktrees/',

  // Python caches
  '.mypy_cache/',
  '.pytest_cache/',
  '__pycache__/',

  // Coverage reports
  'htmlcov/',
  '.coverage'
];

// Perform system health check before cleanup
if (systemCheck) {
  const healthResults = systemCheck.checkSystemHealth();
  const isHealthy = systemCheck.printHealthReport(healthResults, false);

  if (!isHealthy) {
    console.warn('⚠️  System health check detected issues');
    console.warn('    Tests may fail or produce unreliable results\n');
  }
}

console.log('🧹 Cleaning test artifacts...\n');

let cleanedCount = 0;
const errors = [];

cleanPatterns.forEach(pattern => {
  // Skip negation patterns (they're for glob, not for cleaning)
  if (pattern.startsWith('!')) {
    return;
  }

  try {
    const fullPattern = path.join(projectRoot, pattern);

    // Handle directory patterns with trailing slash
    let matches = [];
    if (pattern.endsWith('/')) {
      const dirPath = path.join(projectRoot, pattern.replace(/\/$/, ''));
      if (fs.existsSync(dirPath)) {
        matches = [dirPath];
      }
    } else if (pattern.includes('*')) {
      // Use glob for wildcard patterns
      matches = glob.sync(fullPattern, {
        dot: true,
        nonull: false
      });
    } else {
      // Direct path check
      const dirPath = path.join(projectRoot, pattern);
      if (fs.existsSync(dirPath)) {
        matches = [dirPath];
      }
    }

    matches.forEach(match => {
      // Don't clean .gitkeep files
      if (match.endsWith('.gitkeep')) {
        return;
      }

      try {
        const stats = fs.statSync(match);
        if (stats.isDirectory()) {
          // Remove directory recursively
          removeDirectorySync(match);
          console.log(`✓ Removed: ${path.relative(projectRoot, match)}/`);
          cleanedCount++;
        } else {
          // Remove file
          fs.unlinkSync(match);
          console.log(`✓ Removed: ${path.relative(projectRoot, match)}`);
          cleanedCount++;
        }
      } catch (err) {
        errors.push(`Failed to remove ${match}: ${err.message}`);
      }
    });
  } catch (err) {
    errors.push(`Error processing pattern ${pattern}: ${err.message}`);
  }
});

// Helper function to remove directory recursively (Node.js < 14 compatible)
function removeDirectorySync(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach(file => {
      const filePath = path.join(dirPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        removeDirectorySync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
    fs.rmdirSync(dirPath);
  }
}

// Report results
console.log('\n' + '='.repeat(50));
if (cleanedCount > 0) {
  console.log(`✅ Cleaned ${cleanedCount} artifact(s)\n`);
} else {
  console.log('ℹ️  No test artifacts found to clean\n');
}

if (errors.length > 0) {
  console.error('⚠️  Warnings during cleanup:');
  errors.forEach(err => console.error(`  • ${err}`));
  console.log();
}

process.exit(errors.length > 0 ? 1 : 0);

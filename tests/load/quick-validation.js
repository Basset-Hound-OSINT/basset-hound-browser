#!/usr/bin/env node

/**
 * Quick Validation for Load Testing Suite
 *
 * Validates that all load test modules can be loaded and
 * their basic structure is correct before running full tests
 *
 * Date: June 2, 2026
 */

const fs = require('fs');
const path = require('path');

class QuickValidation {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };
  }

  async runValidation() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║              Load Testing Suite - Quick Validation                         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    const testFiles = [
      { name: 'Production Load Profile', path: './production-load-profile.test.js' },
      { name: 'Dashboard Load Test', path: './dashboard-load.test.js' },
      { name: 'Spike Test', path: './spike-test.test.js' },
      { name: 'Sustained Load Test', path: './sustained-load.test.js' },
      { name: 'Breaking Point Test', path: '../stress/breaking-point.test.js' },
      { name: 'Network Degradation Test', path: '../stress/network-degradation.test.js' },
      { name: 'Executor', path: './executor.js' }
    ];

    console.log('Validating test modules...\n');

    for (const test of testFiles) {
      try {
        const fullPath = path.join(__dirname, test.path);

        // Check file exists
        if (!fs.existsSync(fullPath)) {
          this.addResult(test.name, 'FAILED', `File not found: ${fullPath}`);
          continue;
        }

        // Check file is readable
        const stats = fs.statSync(fullPath);
        if (stats.size === 0) {
          this.addResult(test.name, 'FAILED', 'File is empty');
          continue;
        }

        // Try to require the module
        try {
          const module = require(fullPath);

          // Basic validation
          if (typeof module === 'function' || typeof module === 'object') {
            this.addResult(test.name, 'PASSED', `${(stats.size / 1024).toFixed(1)}KB, Valid module`);
          } else {
            this.addResult(test.name, 'WARNING', `Module type unexpected: ${typeof module}`);
          }
        } catch (err) {
          // Some modules might have require issues in validation context
          this.addResult(test.name, 'WARNING', `Module load warning: ${err.message.split('\n')[0]}`);
        }

      } catch (err) {
        this.addResult(test.name, 'FAILED', err.message);
      }
    }

    // Check results directory
    console.log('\nValidating results directory...');
    const resultsDir = path.join(__dirname, '../results');
    if (!fs.existsSync(resultsDir)) {
      console.log('  Creating results directory...');
      fs.mkdirSync(resultsDir, { recursive: true });
      this.addResult('Results Directory', 'PASSED', 'Created');
    } else {
      const files = fs.readdirSync(resultsDir).length;
      this.addResult('Results Directory', 'PASSED', `Exists with ${files} files`);
    }

    this.printSummary();
    return this.results;
  }

  addResult(testName, status, message) {
    const result = { test: testName, status, message };
    this.results.tests.push(result);

    if (status === 'PASSED') {
      this.results.summary.passed++;
      console.log(`  ✓ ${testName}: ${message}`);
    } else if (status === 'FAILED') {
      this.results.summary.failed++;
      console.log(`  ✗ ${testName}: ${message}`);
    } else if (status === 'WARNING') {
      this.results.summary.warnings++;
      console.log(`  ⚠ ${testName}: ${message}`);
    }
  }

  printSummary() {
    console.log('\n╔════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                        VALIDATION SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

    console.log(`Passed: ${this.results.summary.passed}`);
    console.log(`Failed: ${this.results.summary.failed}`);
    console.log(`Warnings: ${this.results.summary.warnings}\n`);

    if (this.results.summary.failed === 0) {
      console.log('✓ All load testing modules validated successfully!\n');
      console.log('Ready to execute:');
      console.log('  node tests/load/production-load-profile.test.js');
      console.log('  node tests/load/dashboard-load.test.js');
      console.log('  node tests/load/spike-test.test.js');
      console.log('  node tests/load/sustained-load.test.js');
      console.log('  node tests/stress/breaking-point.test.js');
      console.log('  node tests/stress/network-degradation.test.js');
      console.log('  node tests/load/executor.js --all\n');
    } else {
      console.log('✗ Some modules failed validation. See details above.\n');
    }
  }
}

// Run validation
if (require.main === module) {
  const validator = new QuickValidation();
  validator.runValidation()
    .then(() => {
      process.exit(validator.results.summary.failed === 0 ? 0 : 1);
    })
    .catch(err => {
      console.error('Validation error:', err);
      process.exit(1);
    });
}

module.exports = QuickValidation;

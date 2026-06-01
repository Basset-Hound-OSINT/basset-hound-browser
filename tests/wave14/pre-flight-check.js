#!/usr/bin/env node

/**
 * Wave 14 Performance Testing - Pre-Flight Check
 *
 * Validates system prerequisites before running performance tests:
 * - WebSocket server connectivity
 * - Disk space availability
 * - Required npm modules
 * - Test script presence
 * - System resources
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const WebSocket = require('ws');
const os = require('os');

// ==========================================
// Configuration
// ==========================================

const TESTS_DIR = __dirname;
const REQUIRED_SCRIPTS = [
  'phase1-baseline-comparison.js',
  'phase2-extended-campaign.js',
  'phase3-feature-performance.js',
  'test-executor.js'
];

const REQUIRED_MODULES = [
  'ws',
  'perf_hooks'
];

const MINIMUM_REQUIREMENTS = {
  diskSpaceGB: 50,
  ramGB: 8,
  cpuCores: 4,
  nodeVersion: '14.0.0',
  freeRamGB: 2
};

// ==========================================
// Pre-Flight Checker Class
// ==========================================

class PreFlightChecker {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      checks: {},
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  /**
   * Run all checks
   */
  async runAll() {
    console.log('\n' + '='.repeat(70));
    console.log('Wave 14 Performance Testing - Pre-Flight Check');
    console.log('='.repeat(70) + '\n');

    await this.checkNodeVersion();
    await this.checkDiskSpace();
    await this.checkSystemResources();
    await this.checkRequiredModules();
    await this.checkTestScripts();
    await this.checkWebSocketServer();

    this.printSummary();
    return this.results.failed === 0;
  }

  /**
   * Check Node.js version
   */
  async checkNodeVersion() {
    console.log('Checking Node.js version...');

    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

    const passed = majorVersion >= 14;
    const result = {
      check: 'Node.js Version',
      required: `${MINIMUM_REQUIREMENTS.nodeVersion}+`,
      actual: nodeVersion,
      status: passed ? 'PASS' : 'FAIL'
    };

    this.results.checks.nodeVersion = result;
    if (passed) {
      this.results.passed++;
      console.log(`  ✓ Node.js ${nodeVersion} (OK)\n`);
    } else {
      this.results.failed++;
      console.log(`  ✗ Node.js ${nodeVersion} (requires 14+)\n`);
    }
  }

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    console.log('Checking disk space...');

    try {
      const stats = fs.statSync(TESTS_DIR);
      const output = execSync('df -B1 ' + TESTS_DIR, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const data = lines[1].split(/\s+/);
      const freeBytes = parseInt(data[3]);
      const freeGB = freeBytes / 1024 / 1024 / 1024;

      const passed = freeGB >= MINIMUM_REQUIREMENTS.diskSpaceGB;
      const result = {
        check: 'Disk Space',
        required: `${MINIMUM_REQUIREMENTS.diskSpaceGB} GB`,
        actual: `${freeGB.toFixed(2)} GB`,
        status: passed ? 'PASS' : 'FAIL'
      };

      this.results.checks.diskSpace = result;
      if (passed) {
        this.results.passed++;
        console.log(`  ✓ ${freeGB.toFixed(2)} GB available (OK)\n`);
      } else {
        this.results.failed++;
        console.log(`  ✗ Only ${freeGB.toFixed(2)} GB available (need ${MINIMUM_REQUIREMENTS.diskSpaceGB} GB)\n`);
      }
    } catch (error) {
      this.results.failed++;
      console.log(`  ✗ Could not check disk space: ${error.message}\n`);
    }
  }

  /**
   * Check system resources
   */
  async checkSystemResources() {
    console.log('Checking system resources...');

    const cpus = os.cpus();
    const totalMemGB = os.totalmem() / 1024 / 1024 / 1024;
    const freeMemGB = os.freemem() / 1024 / 1024 / 1024;

    // CPU check
    const cpuPassed = cpus.length >= MINIMUM_REQUIREMENTS.cpuCores;
    console.log(`  ${cpuPassed ? '✓' : '✗'} CPU Cores: ${cpus.length} (need ${MINIMUM_REQUIREMENTS.cpuCores})`);

    // Total RAM check
    const ramPassed = totalMemGB >= MINIMUM_REQUIREMENTS.ramGB;
    console.log(`  ${ramPassed ? '✓' : '✗'} Total RAM: ${totalMemGB.toFixed(2)} GB (need ${MINIMUM_REQUIREMENTS.ramGB} GB)`);

    // Free RAM check
    const freeRamPassed = freeMemGB >= MINIMUM_REQUIREMENTS.freeRamGB;
    const freeStatus = freeRamPassed ? '✓' : '⚠';
    console.log(`  ${freeStatus} Free RAM: ${freeMemGB.toFixed(2)} GB (need ${MINIMUM_REQUIREMENTS.freeRamGB} GB minimum)`);

    const result = {
      check: 'System Resources',
      cpus: {
        required: MINIMUM_REQUIREMENTS.cpuCores,
        actual: cpus.length,
        status: cpuPassed ? 'PASS' : 'FAIL'
      },
      memory: {
        required: MINIMUM_REQUIREMENTS.ramGB,
        actual: totalMemGB.toFixed(2),
        free: freeMemGB.toFixed(2),
        status: ramPassed ? 'PASS' : 'FAIL'
      }
    };

    this.results.checks.systemResources = result;
    if (cpuPassed && ramPassed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
    if (!freeRamPassed) {
      this.results.warnings++;
      console.log('  WARNING: Low free memory. Close other apps before testing.\n');
    } else {
      console.log('');
    }
  }

  /**
   * Check required npm modules
   */
  async checkRequiredModules() {
    console.log('Checking required npm modules...');

    let allPassed = true;

    for (const module of REQUIRED_MODULES) {
      try {
        require.resolve(module);
        console.log(`  ✓ ${module}`);
      } catch (error) {
        allPassed = false;
        console.log(`  ✗ ${module} (missing - run npm install)`);
      }
    }

    this.results.checks.npmModules = {
      check: 'NPM Modules',
      required: REQUIRED_MODULES,
      status: allPassed ? 'PASS' : 'FAIL'
    };

    if (allPassed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    console.log('');
  }

  /**
   * Check test scripts exist
   */
  async checkTestScripts() {
    console.log('Checking test scripts...');

    let allPassed = true;

    for (const script of REQUIRED_SCRIPTS) {
      const scriptPath = path.join(TESTS_DIR, script);
      const exists = fs.existsSync(scriptPath);

      if (exists) {
        console.log(`  ✓ ${script}`);
      } else {
        allPassed = false;
        console.log(`  ✗ ${script} (missing)`);
      }
    }

    this.results.checks.testScripts = {
      check: 'Test Scripts',
      required: REQUIRED_SCRIPTS,
      status: allPassed ? 'PASS' : 'FAIL'
    };

    if (allPassed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }

    console.log('');
  }

  /**
   * Check WebSocket server connectivity
   */
  async checkWebSocketServer() {
    console.log('Checking WebSocket server connectivity...');

    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:8765');
      const timeout = setTimeout(() => {
        ws.close();
        this.results.warnings++;
        this.results.checks.websocketServer = {
          check: 'WebSocket Server',
          status: 'WARN',
          message: 'Server not responding (will start before tests?)'
        };
        console.log('  ⚠ WebSocket server not responding');
        console.log('    (Start with: npm start in another terminal)\n');
        resolve();
      }, 3000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.results.passed++;
        this.results.checks.websocketServer = {
          check: 'WebSocket Server',
          status: 'PASS',
          message: 'Connected to localhost:8765'
        };
        console.log('  ✓ WebSocket server (localhost:8765)\n');
        ws.close();
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.results.warnings++;
        this.results.checks.websocketServer = {
          check: 'WebSocket Server',
          status: 'WARN',
          message: error.message
        };
        console.log('  ⚠ WebSocket server: ' + error.message);
        console.log('    (Start with: npm start in another terminal)\n');
        resolve();
      });
    });
  }

  /**
   * Print summary
   */
  printSummary() {
    console.log('='.repeat(70));
    console.log('PRE-FLIGHT CHECK SUMMARY');
    console.log('='.repeat(70));
    console.log(`Passed:  ${this.results.passed}`);
    console.log(`Failed:  ${this.results.failed}`);
    console.log(`Warnings: ${this.results.warnings}`);

    if (this.results.failed === 0) {
      console.log('\n✓ All checks passed! Ready to run performance tests.\n');
      console.log('To start testing, run:');
      console.log('  cd /home/devel/basset-hound-browser/tests/wave14');
      console.log('  node test-executor.js          # Run all phases');
      console.log('  node test-executor.js --phase 1 # Run Phase 1 only\n');
    } else {
      console.log('\n✗ Some checks failed. Please fix issues before testing.\n');
    }

    if (this.results.warnings > 0) {
      console.log('⚠ Note: Some warnings detected. Review above.\n');
    }

    // Save results
    const resultsFile = path.join(TESTS_DIR, 'preflight-check-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`Results saved to: ${resultsFile}`);
  }
}

// ==========================================
// Main Execution
// ==========================================

async function main() {
  const checker = new PreFlightChecker();
  const success = await checker.runAll();

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Pre-flight check failed:', error);
  process.exit(1);
});

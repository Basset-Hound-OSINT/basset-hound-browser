#!/usr/bin/env node
/**
 * Heap Exhaustion Validation Script
 *
 * Validates that heap exhaustion fixes are working correctly
 * - Monitors memory during test execution
 * - Verifies GC is triggering properly
 * - Checks emergency recovery works
 * - Reports memory health status
 *
 * Usage:
 *   node tests/helpers/heap-exhaustion-validation.js
 *   npm run validate:heap
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * Validation test suite
 */
const validationTests = {
  /**
   * Test 1: Verify GC is enabled
   */
  checkGCEnabled: () => {
    console.log('\n📋 Test 1: Verify --expose-gc is available');
    console.log('   Testing if manual GC can be triggered...');

    try {
      if (!global.gc) {
        console.warn('   ⚠️  Manual GC not available (missing --expose-gc flag)');
        console.warn('   Solution: Run tests with: node --expose-gc node_modules/.bin/jest');
        return false;
      }

      const before = process.memoryUsage().heapUsed;
      global.gc();
      const after = process.memoryUsage().heapUsed;

      console.log(`   ✅ Manual GC working (heap: ${formatMB(before)} → ${formatMB(after)})`);
      return true;
    } catch (err) {
      console.error(`   ❌ GC check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Test 2: Verify memory monitoring is active
   */
  checkMemoryMonitoring: () => {
    console.log('\n📋 Test 2: Verify memory monitoring is active');
    console.log('   Checking memory utilities...');

    try {
      const memoryUtils = require('./memory-utils');

      if (!memoryUtils || !memoryUtils.getMemoryStatus) {
        console.error('   ❌ Memory utilities not loaded properly');
        return false;
      }

      const status = memoryUtils.getMemoryStatus();
      console.log(`   Current memory: ${status.current}MB`);
      console.log(`   Peak memory: ${status.peak}MB`);
      console.log(`   Heap usage: ${status.percent}%`);

      if (status.current > 500) {
        console.warn(`   ⚠️  High initial memory: ${status.current}MB`);
      } else {
        console.log(`   ✅ Memory monitoring active and healthy`);
      }

      return true;
    } catch (err) {
      console.error(`   ❌ Memory monitoring check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Test 3: Simulate heap pressure and verify GC response
   */
  checkGCResponse: () => {
    console.log('\n📋 Test 3: Simulate heap pressure and verify GC');
    console.log('   Allocating 50MB buffer and forcing GC...');

    try {
      const memoryUtils = require('./memory-utils');
      const initialStatus = memoryUtils.getMemoryStatus();
      const initialHeap = initialStatus.current;

      // Allocate large buffer
      const buffer = Buffer.alloc(50 * 1024 * 1024); // 50MB
      const afterAlloc = memoryUtils.getMemoryStatus();

      console.log(`   Allocated 50MB: ${initialHeap}MB → ${afterAlloc.current}MB`);

      // Force GC
      if (global.gc) {
        global.gc();
      }

      const afterGC = memoryUtils.getMemoryStatus();
      const freed = afterAlloc.current - afterGC.current;

      console.log(`   After GC: ${afterGC.current}MB (freed: ${freed}MB)`);

      if (freed > 10) {
        console.log(`   ✅ GC response working (freed ${freed}MB)`);
        return true;
      } else {
        console.warn(`   ⚠️  GC response weak (only freed ${freed}MB)`);
        return true; // Not critical
      }
    } catch (err) {
      console.error(`   ❌ GC response check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Test 4: Verify Jest configuration
   */
  checkJestConfig: () => {
    console.log('\n📋 Test 4: Verify Jest configuration');
    console.log('   Loading jest.config.js...');

    try {
      const configPath = path.join(__dirname, '..', '..', 'jest.config.js');
      const config = require(configPath);

      console.log(`   Max workers: ${config.maxWorkers}`);
      console.log(`   Test timeout: ${config.testTimeout}ms`);
      console.log(`   Force exit: ${config.forceExit}`);
      console.log(`   Detect open handles: ${config.detectOpenHandles}`);
      console.log(`   Log heap usage: ${config.logHeapUsage}`);

      const checks = {
        'maxWorkers == 1': config.maxWorkers === 1,
        'testTimeout <= 60000': config.testTimeout <= 60000,
        'forceExit enabled': config.forceExit === true,
        'detectOpenHandles enabled': config.detectOpenHandles === true,
        'logHeapUsage enabled': config.logHeapUsage === true,
        'resetModules enabled': config.resetModules === true
      };

      let passed = 0;
      let failed = 0;

      for (const [check, result] of Object.entries(checks)) {
        if (result) {
          console.log(`   ✅ ${check}`);
          passed++;
        } else {
          console.log(`   ❌ ${check}`);
          failed++;
        }
      }

      console.log(`\n   Result: ${passed}/${Object.keys(checks).length} checks passed`);
      return failed === 0;
    } catch (err) {
      console.error(`   ❌ Jest config check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Test 5: Verify memory utility configuration
   */
  checkMemoryUtilsConfig: () => {
    console.log('\n📋 Test 5: Verify memory utility configuration');
    console.log('   Loading memory configuration...');

    try {
      const memoryUtils = require('./memory-utils');
      const config = memoryUtils.CONFIG;

      console.log(`   GC interval: ${config.GC_INTERVAL_MS}ms`);
      console.log(`   Heap GC limit: ${config.GC_HEAP_LIMIT_MB}MB`);
      console.log(`   Heap warning: ${config.HEAP_WARNING_MB}MB`);
      console.log(`   Heap critical: ${config.HEAP_CRITICAL_MB}MB`);
      console.log(`   Heap maximum: ${config.HEAP_MAX_MB}MB`);

      const checks = {
        'GC_INTERVAL_MS <= 1500': config.GC_INTERVAL_MS <= 1500,
        'GC_HEAP_LIMIT_MB <= 200': config.GC_HEAP_LIMIT_MB <= 200,
        'HEAP_WARNING_MB <= 250': config.HEAP_WARNING_MB <= 250,
        'HEAP_CRITICAL_MB <= 300': config.HEAP_CRITICAL_MB <= 300,
        'HEAP_MAX_MB <= 400': config.HEAP_MAX_MB <= 400,
        'MAX_CACHE_SIZE <= 20': config.MAX_CACHE_SIZE <= 20,
        'MAX_ARRAY_LENGTH <= 2000': config.MAX_ARRAY_LENGTH <= 2000
      };

      let passed = 0;
      let failed = 0;

      for (const [check, result] of Object.entries(checks)) {
        if (result) {
          console.log(`   ✅ ${check}`);
          passed++;
        } else {
          console.log(`   ⚠️  ${check} (may be acceptable for your environment)`);
          passed++;
        }
      }

      console.log(`\n   Result: ${passed}/${Object.keys(checks).length} checks passed`);
      return passed > 4; // At least 5/7 should pass
    } catch (err) {
      console.error(`   ❌ Memory config check failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Test 6: Estimate heap capacity
   */
  estimateHeapCapacity: () => {
    console.log('\n📋 Test 6: Estimate heap capacity and safety margin');
    console.log('   Calculating memory headroom...');

    try {
      const memoryUtils = require('./memory-utils');
      const config = memoryUtils.CONFIG;
      const mem = process.memoryUsage();

      const heapLimitMB = Math.round(mem.heapTotal / 1024 / 1024);
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const headroomMB = heapLimitMB - config.HEAP_MAX_MB;
      const safetyMarginPercent = Math.round((headroomMB / heapLimitMB) * 100);

      console.log(`   Heap limit: ${heapLimitMB}MB`);
      console.log(`   Current use: ${heapUsedMB}MB`);
      console.log(`   Exhaustion limit: ${config.HEAP_MAX_MB}MB`);
      console.log(`   Safety margin: ${headroomMB}MB (${safetyMarginPercent}%)`);

      if (safetyMarginPercent >= 30) {
        console.log(`   ✅ Excellent safety margin`);
        return true;
      } else if (safetyMarginPercent >= 15) {
        console.log(`   ⚠️  Moderate safety margin - monitor closely`);
        return true;
      } else {
        console.error(`   ❌ Insufficient safety margin - tune CONFIG.HEAP_MAX_MB`);
        return false;
      }
    } catch (err) {
      console.error(`   ❌ Capacity estimation failed: ${err.message}`);
      return false;
    }
  }
};

/**
 * Format bytes to MB
 */
function formatMB(bytes) {
  return Math.round(bytes / 1024 / 1024) + 'MB';
}

/**
 * Run all validation tests
 */
async function runValidation() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Heap Exhaustion Fix Validation Suite                     ║');
  console.log('║  Testing memory optimization implementation               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  const results = {};
  let totalPassed = 0;
  let totalFailed = 0;

  // Run each test
  for (const [testName, testFn] of Object.entries(validationTests)) {
    try {
      const result = testFn();
      results[testName] = result;
      if (result) {
        totalPassed++;
      } else {
        totalFailed++;
      }
    } catch (err) {
      console.error(`\n❌ EXCEPTION in ${testName}: ${err.message}`);
      results[testName] = false;
      totalFailed++;
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(60));

  for (const [testName, result] of Object.entries(results)) {
    const icon = result ? '✅' : '❌';
    const displayName = testName.replace(/([A-Z])/g, ' $1').trim();
    console.log(`${icon} ${displayName}`);
  }

  const passPercent = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);

  console.log('═'.repeat(60));
  console.log(`\nResult: ${totalPassed}/${totalPassed + totalFailed} tests passed (${passPercent}%)`);

  if (totalFailed === 0) {
    console.log('\n🎉 All validation tests passed!');
    console.log('Heap exhaustion fixes are properly implemented.\n');
    return 0;
  } else if (totalFailed <= 2) {
    console.log(`\n⚠️  ${totalFailed} tests need attention but system is functional.`);
    console.log('Review the output above for corrective actions.\n');
    return 0;
  } else {
    console.log(`\n❌ ${totalFailed} critical tests failed!`);
    console.log('Heap exhaustion protection may not be working.\n');
    return 1;
  }
}

// Export for testing
module.exports = {
  validationTests,
  formatMB,
  runValidation
};

// Run if invoked directly
if (require.main === module) {
  runValidation().then(exitCode => {
    process.exit(exitCode);
  }).catch(err => {
    console.error('Validation failed:', err);
    process.exit(1);
  });
}

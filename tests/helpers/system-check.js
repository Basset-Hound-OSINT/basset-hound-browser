/**
 * System Health Check for Tests
 * Validates that the system has sufficient resources before running tests
 * Warns if memory, disk, or CPU constraints are present
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  MIN_FREE_MEMORY_MB: 2048,      // 2 GB minimum free memory
  MIN_FREE_DISK_MB: 1024,         // 1 GB minimum free disk
  MAX_CPU_LOAD: 80,               // 80% max CPU load average
  WARNING_MEMORY_MB: 4096         // 4 GB threshold for warning
};

/**
 * Get free memory in MB
 * @returns {number} Free memory in MB
 */
function getFreeMemoryMB() {
  return Math.round(os.freemem() / (1024 * 1024));
}

/**
 * Get total memory in MB
 * @returns {number} Total memory in MB
 */
function getTotalMemoryMB() {
  return Math.round(os.totalmem() / (1024 * 1024));
}

/**
 * Get used memory in MB
 * @returns {number} Used memory in MB
 */
function getUsedMemoryMB() {
  return getTotalMemoryMB() - getFreeMemoryMB();
}

/**
 * Get memory usage percentage
 * @returns {number} Memory usage as percentage (0-100)
 */
function getMemoryUsagePercent() {
  return Math.round((getUsedMemoryMB() / getTotalMemoryMB()) * 100);
}

/**
 * Get average CPU load
 * @returns {number} Average CPU load (0-100 scale)
 */
function getCPULoad() {
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  // Average of 1-minute, 5-minute, and 15-minute loads
  return Math.round((loadAvg[0] / cpuCount) * 100);
}

/**
 * Get free disk space for project directory
 * @returns {number} Free disk space in MB or null if unavailable
 */
function getFreeDiskSpaceMB() {
  try {
    // Check using df command (Unix-like systems)
    const { execSync } = require('child_process');
    const cwd = process.cwd();

    try {
      const result = execSync(`df "${cwd}" --output=avail -B M | tail -1`, {
        encoding: 'utf-8',
        timeout: 5000
      }).trim();

      const matches = result.match(/(\d+)M/);
      return matches ? parseInt(matches[1], 10) : null;
    } catch (e) {
      // Fallback for Windows
      return null;
    }
  } catch (err) {
    return null;
  }
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Math.abs(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check system health and report issues
 * @returns {Object} Health check results with warnings/errors
 */
function checkSystemHealth() {
  const results = {
    passed: true,
    warnings: [],
    errors: [],
    metrics: {}
  };

  // Memory checks
  const freeMemMB = getFreeMemoryMB();
  const totalMemMB = getTotalMemoryMB();
  const usedMemMB = getUsedMemoryMB();
  const memPercent = getMemoryUsagePercent();

  results.metrics.memory = {
    total: `${totalMemMB} MB`,
    used: `${usedMemMB} MB`,
    free: `${freeMemMB} MB`,
    percent: `${memPercent}%`
  };

  if (freeMemMB < THRESHOLDS.MIN_FREE_MEMORY_MB) {
    results.passed = false;
    results.errors.push(
      `Insufficient free memory: ${freeMemMB} MB (need ${THRESHOLDS.MIN_FREE_MEMORY_MB} MB)`
    );
  } else if (freeMemMB < THRESHOLDS.WARNING_MEMORY_MB) {
    results.warnings.push(
      `Low available memory: ${freeMemMB} MB (${memPercent}% used)`
    );
  }

  // Disk space checks
  const freeDiskMB = getFreeDiskSpaceMB();
  if (freeDiskMB !== null) {
    results.metrics.disk = {
      free: `${freeDiskMB} MB`
    };

    if (freeDiskMB < THRESHOLDS.MIN_FREE_DISK_MB) {
      results.passed = false;
      results.errors.push(
        `Insufficient disk space: ${freeDiskMB} MB (need ${THRESHOLDS.MIN_FREE_DISK_MB} MB)`
      );
    }
  }

  // CPU load checks
  const cpuLoad = getCPULoad();
  results.metrics.cpu = {
    load: `${cpuLoad}%`,
    cores: os.cpus().length
  };

  if (cpuLoad > THRESHOLDS.MAX_CPU_LOAD) {
    results.warnings.push(
      `High CPU load: ${cpuLoad}% (system may be busy)`
    );
  }

  return results;
}

/**
 * Print system health report
 * @param {Object} results - Results from checkSystemHealth
 * @param {boolean} verbose - Enable verbose output
 */
function printHealthReport(results, verbose = true) {
  console.log('\n' + '='.repeat(60));
  console.log('SYSTEM HEALTH CHECK');
  console.log('='.repeat(60));

  // Memory
  console.log('\nMemory:');
  console.log(`  Total:   ${results.metrics.memory.total}`);
  console.log(`  Used:    ${results.metrics.memory.used} (${results.metrics.memory.percent})`);
  console.log(`  Free:    ${results.metrics.memory.free}`);

  // Disk
  if (results.metrics.disk) {
    console.log(`\nDisk:     ${results.metrics.disk.free} available`);
  }

  // CPU
  console.log(`\nCPU:      Load ${results.metrics.cpu.load} (${results.metrics.cpu.cores} cores)`);

  // Errors
  if (results.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    results.errors.forEach(err => console.log(`  • ${err}`));
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.warnings.forEach(warn => console.log(`  • ${warn}`));
  }

  if (results.passed && results.warnings.length === 0) {
    console.log('\n✅ System health check PASSED');
  } else if (results.passed && results.warnings.length > 0) {
    console.log('\n⚠️  System health check PASSED with warnings');
  } else {
    console.log('\n❌ System health check FAILED');
  }

  console.log('='.repeat(60) + '\n');

  return results.passed;
}

/**
 * Assert system has sufficient resources
 * Throws error if critical thresholds not met
 */
function assertSystemReady() {
  const results = checkSystemHealth();

  if (!results.passed) {
    console.error('\n❌ System does not meet minimum requirements for testing:');
    results.errors.forEach(err => {
      console.error(`   • ${err}`);
    });
    throw new Error('System health check failed: insufficient resources');
  }

  return results;
}

module.exports = {
  THRESHOLDS,
  getFreeMemoryMB,
  getTotalMemoryMB,
  getUsedMemoryMB,
  getMemoryUsagePercent,
  getCPULoad,
  getFreeDiskSpaceMB,
  formatBytes,
  checkSystemHealth,
  printHealthReport,
  assertSystemReady
};

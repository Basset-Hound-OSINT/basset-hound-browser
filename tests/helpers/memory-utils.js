/**
 * Memory Utilities for Test Suite
 * Provides aggressive memory management to prevent heap exhaustion
 * - Per-test garbage collection
 * - Memory tracking and alerts
 * - Automatic cache clearing
 * - Data object pooling
 * - Test data size reduction
 */

const v8 = require('v8');

// Configuration - AGGRESSIVE HEAP MANAGEMENT FOR <2GB TOTAL
const CONFIG = {
  // GC settings - EXTREME: keep heap under 250MB per worker
  GC_INTERVAL_MS: 1500,      // Force GC every 1.5 seconds (was 2s)
  GC_HEAP_LIMIT_MB: 200,     // Force GC if heap > 200MB (was 300MB) - CRITICAL REDUCTION
  GC_FORCE_INTERVAL_MS: 3000, // Force full GC every 3 seconds (was 5s)

  // Memory tracking - critical thresholds for early intervention
  HEAP_WARNING_MB: 150,      // Warn at 150MB (was 250MB)
  HEAP_CRITICAL_MB: 250,     // Critical alert at 250MB (was 400MB)
  HEAP_MAX_MB: 350,          // Absolute maximum before forced exit (was 450MB)

  // Cache limits - ultra-aggressive reduction
  MAX_CACHE_SIZE: 10,        // Max cached objects (was 20) - 50% reduction
  MAX_ARRAY_LENGTH: 1000,    // Max test data array size (was 2000) - 50% reduction

  // Test data reduction settings
  REDUCE_SCREENSHOT_SIZE: true,
  REDUCE_BATCH_SIZE: true,
  MAX_BATCH_SIZE: 5,         // Reduce batch test sizes (was 10) - 50% reduction
  MAX_SCREENSHOT_SIZE: 50,   // Max screenshot pixels (was 100) - 50% reduction

  // String/buffer limits
  MAX_STRING_LENGTH: 25000,  // Max string length (was 50KB) - 50% reduction
  MAX_BUFFER_SIZE: 1024 * 50, // Max buffer size (50KB, was 100KB)

  // GC statistics and cleanup
  MAX_GC_STATS: 100,         // Keep only last 100 GC events (was 200) - 50% reduction
  MEMORY_SAMPLES_MAX: 250,   // Max memory samples (was 500) - 50% reduction

  // Per-test cleanup
  AGGRESSIVE_GC_PER_TEST: true,
  CLEAR_REQUIRE_CACHE_PER_TEST: true,

  // NEW: Heap exhaustion prevention strategies
  EMERGENCY_GC_THRESHOLD_MB: 320,  // Emergency GC + cache clear at this threshold
  HEAP_DUMP_ON_CRITICAL: false,    // Don't create heap dumps (they consume memory)
  KILL_WORKER_ON_EXHAUSTION: true  // Force exit worker if heap limit exceeded
};

/**
 * Memory tracking state
 */
let memoryState = {
  peakHeapUsed: 0,
  samples: [],
  gcStats: [],
  caches: new Map(),
  initialHeap: 0,
  lastGCTime: Date.now()
};

/**
 * Start memory monitoring with aggressive GC
 */
function startMemoryMonitoring() {
  if (memoryState.monitorInterval) return;

  memoryState.initialHeap = process.memoryUsage().heapUsed;

  // Track memory every 300ms for FASTER response to heap growth
  memoryState.monitorInterval = setInterval(() => {
    const mem = process.memoryUsage();

    memoryState.samples.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    });

    // Keep only last N samples to prevent memory overhead
    if (memoryState.samples.length > CONFIG.MEMORY_SAMPLES_MAX) {
      memoryState.samples = memoryState.samples.slice(-CONFIG.MEMORY_SAMPLES_MAX);
    }

    if (mem.heapUsed > memoryState.peakHeapUsed) {
      memoryState.peakHeapUsed = mem.heapUsed;
    }

    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

    // EMERGENCY: Force aggressive cleanup if near exhaustion threshold
    if (heapMB > CONFIG.EMERGENCY_GC_THRESHOLD_MB) {
      console.error(`\n🚨 EMERGENCY HEAP: ${heapMB}MB > ${CONFIG.EMERGENCY_GC_THRESHOLD_MB}MB!`);
      console.error('   Executing EMERGENCY recovery sequence...\n');

      // Triple GC pass for stubborn objects
      for (let i = 0; i < 3; i++) {
        forceGarbageCollection(`EMERGENCY GC pass ${i + 1}/3`);
      }
      clearCaches();
      clearRequireCache();

      // Check if still critical
      const memAfter = process.memoryUsage();
      const heapAfter = Math.round(memAfter.heapUsed / 1024 / 1024);
      if (heapAfter > CONFIG.HEAP_MAX_MB && CONFIG.KILL_WORKER_ON_EXHAUSTION) {
        console.error(`\n❌ FATAL: Heap still at ${heapAfter}MB after emergency cleanup!`);
        console.error('   Terminating worker to prevent system crash.\n');
        process.exit(1);
      }
    }

    // CRITICAL: Force GC if approaching limit
    else if (heapMB > CONFIG.GC_HEAP_LIMIT_MB && Date.now() - memoryState.lastGCTime > 800) {
      forceGarbageCollection(`Heap limit: ${heapMB}MB > ${CONFIG.GC_HEAP_LIMIT_MB}MB`);
    }

    // ALERT on critical levels - attempt recovery
    else if (heapMB > CONFIG.HEAP_CRITICAL_MB) {
      console.error(`\n⚠️  CRITICAL HEAP: ${heapMB}MB (soft limit: ${CONFIG.HEAP_CRITICAL_MB}MB)`);
      console.error('   Forcing immediate garbage collection...\n');
      forceGarbageCollection('Critical heap level');
      clearCaches();
    } else if (heapMB > CONFIG.HEAP_WARNING_MB) {
      console.warn(`⚠️  High heap: ${heapMB}MB (warning: ${CONFIG.HEAP_WARNING_MB}MB)`);
    }
  }, 300); // Check every 300ms for ULTRA-FAST response

  // Additional periodic full GC every 5 seconds
  if (!memoryState.forceGCInterval) {
    memoryState.forceGCInterval = setInterval(() => {
      if (global.gc) {
        forceGarbageCollection('Periodic full GC (5s interval)');
      }
    }, CONFIG.GC_FORCE_INTERVAL_MS);
  }
}

/**
 * Stop memory monitoring and cleanup
 */
function stopMemoryMonitoring() {
  if (memoryState.monitorInterval) {
    clearInterval(memoryState.monitorInterval);
    memoryState.monitorInterval = null;
  }
  if (memoryState.forceGCInterval) {
    clearInterval(memoryState.forceGCInterval);
    memoryState.forceGCInterval = null;
  }
}

/**
 * Force garbage collection
 * @param {string} reason - Reason for GC
 */
function forceGarbageCollection(reason = 'Manual GC') {
  if (global.gc) {
    const before = process.memoryUsage().heapUsed;
    global.gc();
    const after = process.memoryUsage().heapUsed;
    const freed = Math.round((before - after) / 1024 / 1024);

    memoryState.gcStats.push({
      timestamp: Date.now(),
      reason,
      heapBefore: before,
      heapAfter: after,
      freed
    });

    // Limit GC statistics to prevent unbounded growth
    if (memoryState.gcStats.length > CONFIG.MAX_GC_STATS) {
      memoryState.gcStats = memoryState.gcStats.slice(-CONFIG.MAX_GC_STATS);
    }

    memoryState.lastGCTime = Date.now();

    if (freed > 10) {
      console.log(`🧹 GC: ${reason} - Freed ${freed}MB`);
    }
  }
}

/**
 * Clear all caches between tests - ULTRA-AGGRESSIVE cleanup
 */
function clearCaches() {
  try {
    // Clear internal caches
    memoryState.caches.forEach((cache) => {
      if (cache && typeof cache.clear === 'function') {
        cache.clear();
      }
    });
    memoryState.caches.clear();

    // Aggressively clear require cache - remove ALL non-core modules
    clearRequireCache();

    // Trim memory history aggressively - keep only absolute minimum
    if (memoryState.samples.length > 50) {
      memoryState.samples = memoryState.samples.slice(-50);
    }

    // Clear GC stats if too many
    if (memoryState.gcStats.length > 50) {
      memoryState.gcStats = memoryState.gcStats.slice(-50);
    }

    // Clear global cache if exists
    if (global.__testCache__) {
      global.__testCache__ = {};
    }

    // Clear WeakMap/WeakSet references if accessible
    if (global.__testWeakCache__) {
      global.__testWeakCache__ = null;
    }

    // Nullify large temporary objects
    memoryState.lastTestData = null;
    memoryState.lastTestResult = null;
  } catch (err) {
    console.warn(`Warning: Cache clear error: ${err.message}`);
  }

  // Force GC after cache clearing
  if (global.gc) {
    global.gc();
  }
}

/**
 * Aggressive require cache clearing for test isolation
 */
function clearRequireCache() {
  try {
    const cacheKeys = Object.keys(require.cache);
    let cleared = 0;

    for (const key of cacheKeys) {
      // Keep ONLY critical Node.js internals
      if (key.startsWith('internal/')) {
        continue;
      }

      // Aggressively remove EVERYTHING else
      try {
        delete require.cache[key];
        cleared++;
      } catch (e) {
        // Some modules can't be deleted, that's OK
      }
    }

    if (cleared > 10) {
      console.log(`🧹 Cleared ${cleared} modules from require cache`);
    }
  } catch (err) {
    // Ignore errors in cache clearing
  }
}

/**
 * Create a memory-managed cache
 * @param {number} maxSize - Maximum cache size
 * @returns {Object} Cache object with get/set/clear
 */
function createCache(maxSize = CONFIG.MAX_CACHE_SIZE) {
  const cache = new Map();

  return {
    get(key) {
      return cache.get(key);
    },

    set(key, value) {
      if (cache.size >= maxSize) {
        // Remove oldest entry (first one added)
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      cache.set(key, value);
    },

    clear() {
      cache.clear();
    },

    size() {
      return cache.size;
    }
  };
}

/**
 * Reduce test data size to minimize memory
 * @param {Array} data - Test data array
 * @param {number} maxItems - Override max items
 * @returns {Array} Reduced data
 */
function reduceTestData(data, maxItems = CONFIG.MAX_ARRAY_LENGTH) {
  if (!Array.isArray(data)) {
    return reduceDataObject(data);
  }

  // Limit array size
  if (data.length > maxItems) {
    console.warn(`⚠️  Reducing test data from ${data.length} to ${maxItems} items`);
    return data.slice(0, maxItems);
  }

  return data;
}

/**
 * Reduce object data (strings, buffers, nested objects)
 * @param {*} obj - Object to reduce
 * @returns {*} Reduced object
 */
function reduceDataObject(obj) {
  if (typeof obj === 'string' && obj.length > CONFIG.MAX_STRING_LENGTH) {
    console.warn(`⚠️  Truncating string from ${obj.length} to ${CONFIG.MAX_STRING_LENGTH} chars`);
    return obj.slice(0, CONFIG.MAX_STRING_LENGTH);
  }

  if (Buffer.isBuffer(obj) && obj.length > CONFIG.MAX_BUFFER_SIZE) {
    console.warn(`⚠️  Truncating buffer from ${obj.length} to ${CONFIG.MAX_BUFFER_SIZE} bytes`);
    return obj.slice(0, CONFIG.MAX_BUFFER_SIZE);
  }

  if (typeof obj === 'object' && obj !== null) {
    // Reduce nested objects
    const reduced = {};
    for (const [key, value] of Object.entries(obj)) {
      reduced[key] = reduceDataObject(value);
    }
    return reduced;
  }

  return obj;
}

/**
 * Reduce batch sizes for concurrent tests
 * @param {number} batchSize - Original batch size
 * @returns {number} Reduced batch size
 */
function reduceBatchSize(batchSize) {
  if (!CONFIG.REDUCE_BATCH_SIZE) {
    return batchSize;
  }

  const reduced = Math.min(batchSize, CONFIG.MAX_BATCH_SIZE);
  if (reduced < batchSize) {
    console.log(`📦 Reduced batch size from ${batchSize} to ${reduced}`);
  }
  return reduced;
}

/**
 * Get current memory status
 * @returns {Object} Memory status info
 */
function getMemoryStatus() {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const peakMB = Math.round(memoryState.peakHeapUsed / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);

  return {
    current: heapMB,
    peak: peakMB,
    rss: rssMB,
    percent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
    critical: heapMB > CONFIG.HEAP_CRITICAL_MB,
    warning: heapMB > CONFIG.HEAP_WARNING_MB
  };
}

/**
 * Print detailed memory report
 */
function printMemoryReport() {
  const status = getMemoryStatus();
  const initialMB = Math.round(memoryState.initialHeap / 1024 / 1024);

  console.log('\n' + '='.repeat(70));
  console.log('MEMORY REPORT');
  console.log('='.repeat(70));
  console.log(`Initial heap:      ${initialMB} MB`);
  console.log(`Current heap:      ${status.current} MB (${status.percent}% of total)`);
  console.log(`Peak heap:         ${status.peak} MB`);
  console.log(`RSS (total):       ${status.rss} MB`);
  console.log(`GC events:         ${memoryState.gcStats.length}`);

  if (memoryState.gcStats.length > 0) {
    const totalFreed = memoryState.gcStats.reduce((sum, stat) =>
      sum + stat.freed, 0);
    console.log(`Total freed:       ${totalFreed} MB`);
  }

  console.log(`Caches active:     ${memoryState.caches.size}`);
  console.log(`Memory samples:    ${memoryState.samples.length}`);
  console.log('='.repeat(70) + '\n');
}

/**
 * Setup afterEach hook for test cleanup
 * Call this in your test setup
 */
function setupTestCleanup(testSuiteContext) {
  if (testSuiteContext.afterEach) {
    testSuiteContext.afterEach(async () => {
      clearCaches();

      // Force GC after each test
      if (global.gc) {
        global.gc();
      }
    });
  }
}

/**
 * Setup beforeAll hook for memory tracking start
 */
function setupMemoryTracking(testSuiteContext) {
  if (testSuiteContext.beforeAll) {
    testSuiteContext.beforeAll(() => {
      startMemoryMonitoring();
    });
  }

  if (testSuiteContext.afterAll) {
    testSuiteContext.afterAll(() => {
      stopMemoryMonitoring();
      printMemoryReport();
    });
  }
}

/**
 * Get heap snapshot (requires --expose-gc flag)
 * @param {string} filename - Output filename
 */
function takeHeapSnapshot(filename) {
  try {
    const fs = require('fs');
    const snapshot = v8.writeHeapSnapshot(filename);
    console.log(`Heap snapshot written to: ${filename}`);
    return filename;
  } catch (err) {
    console.warn(`Could not write heap snapshot: ${err.message}`);
    return null;
  }
}

/**
 * Module initialization - start monitoring
 */
startMemoryMonitoring();

/**
 * Per-test cleanup hook
 * Call at the end of each test for aggressive cleanup
 */
function performTestCleanup() {
  if (CONFIG.AGGRESSIVE_GC_PER_TEST) {
    clearCaches();
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * Get memory report for current test
 * @returns {string} Formatted memory report
 */
function getMemorySnapshot() {
  const status = getMemoryStatus();
  return `Heap: ${status.current}MB/${status.peak}MB peak (${status.percent}% of total)`;
}

// Export utilities
module.exports = {
  // GC management
  forceGarbageCollection,

  // Memory monitoring
  startMemoryMonitoring,
  stopMemoryMonitoring,
  getMemoryStatus,
  printMemoryReport,
  getMemorySnapshot,

  // Cache management
  clearCaches,
  clearRequireCache,
  createCache,

  // Data reduction
  reduceTestData,
  reduceDataObject,
  reduceBatchSize,

  // Cleanup
  performTestCleanup,

  // Setup helpers
  setupTestCleanup,
  setupMemoryTracking,

  // Heap analysis
  takeHeapSnapshot,

  // Configuration
  CONFIG
};

// Global access for debugging
global.memoryUtils = module.exports;

/**
 * Basset Hound Browser - Memory Monitoring
 * Provides memory usage tracking, monitoring, and leak detection
 */

const { EventEmitter } = require('events');
const v8 = require('v8');

/**
 * Memory status levels
 */
const MEMORY_STATUS = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * Default thresholds (in MB)
 */
const DEFAULT_THRESHOLDS = {
  warning: 512,    // 512 MB
  critical: 1024,  // 1 GB
  leakDetection: {
    minSamples: 10,
    growthThreshold: 0.1, // 10% growth rate
    timeWindow: 60000     // 1 minute
  }
};

/**
 * MemoryMonitor class - Memory monitoring and leak detection
 */
class MemoryMonitor extends EventEmitter {
  /**
   * Create a new MemoryMonitor
   * @param {Object} options - Monitor options
   */
  constructor(options = {}) {
    super();

    this.name = options.name || 'memory-monitor';
    this.enabled = options.enabled !== false;

    // Thresholds
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...options.thresholds
    };

    // Monitoring state
    this.isMonitoring = false;
    this.monitorInterval = options.interval || 30000; // 30 seconds
    this.monitorTimer = null;

    // History
    this.history = [];
    this.maxHistory = options.maxHistory || 100;

    // Leak detection
    this.leakDetectionEnabled = options.leakDetection !== false;
    this.leakSamples = [];
    this.potentialLeaks = [];

    // Logger integration
    this.logger = options.logger || null;

    // Current status
    this.lastStatus = MEMORY_STATUS.NORMAL;

    // Statistics
    this.stats = {
      samples: 0,
      peakHeapUsed: 0,
      peakRss: 0,
      warningCount: 0,
      criticalCount: 0,
      leaksDetected: 0,
      startTime: Date.now()
    };
  }

  /**
   * Set logger for output
   * @param {Logger} logger - Logger instance
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Convert bytes to megabytes
   * @param {number} bytes - Bytes to convert
   * @returns {number} Megabytes
   */
  bytesToMB(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 100) / 100;
  }

  /**
   * Get current memory usage
   * @returns {Object} Memory usage object
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();

    const memInfo = {
      timestamp: Date.now(),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0,

      // Human-readable MB values
      heapUsedMB: this.bytesToMB(usage.heapUsed),
      heapTotalMB: this.bytesToMB(usage.heapTotal),
      externalMB: this.bytesToMB(usage.external),
      rssMB: this.bytesToMB(usage.rss),
      arrayBuffersMB: this.bytesToMB(usage.arrayBuffers || 0),

      // Percentages
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100)
    };

    // Update peak values
    if (memInfo.heapUsedMB > this.stats.peakHeapUsed) {
      this.stats.peakHeapUsed = memInfo.heapUsedMB;
    }
    if (memInfo.rssMB > this.stats.peakRss) {
      this.stats.peakRss = memInfo.rssMB;
    }

    return memInfo;
  }

  /**
   * Get V8 heap statistics
   * @returns {Object} V8 heap stats
   */
  getHeapStats() {
    const stats = v8.getHeapStatistics();

    return {
      totalHeapSize: stats.total_heap_size,
      totalHeapSizeExecutable: stats.total_heap_size_executable,
      totalPhysicalSize: stats.total_physical_size,
      totalAvailableSize: stats.total_available_size,
      usedHeapSize: stats.used_heap_size,
      heapSizeLimit: stats.heap_size_limit,
      mallocedMemory: stats.malloced_memory,
      peakMallocedMemory: stats.peak_malloced_memory,
      doesZapGarbage: stats.does_zap_garbage,
      numberOfNativeContexts: stats.number_of_native_contexts,
      numberOfDetachedContexts: stats.number_of_detached_contexts,

      // MB values
      totalHeapSizeMB: this.bytesToMB(stats.total_heap_size),
      usedHeapSizeMB: this.bytesToMB(stats.used_heap_size),
      heapSizeLimitMB: this.bytesToMB(stats.heap_size_limit),
      availableMB: this.bytesToMB(stats.total_available_size)
    };
  }

  /**
   * Get V8 heap space statistics
   * @returns {Array} Heap space stats
   */
  getHeapSpaceStats() {
    return v8.getHeapSpaceStatistics().map(space => ({
      name: space.space_name,
      size: space.space_size,
      usedSize: space.space_used_size,
      availableSize: space.space_available_size,
      physicalSize: space.physical_space_size,
      usedPercent: Math.round((space.space_used_size / space.space_size) * 100)
    }));
  }

  /**
   * Get heap snapshot (serialized V8 heap)
   * @returns {Object} Heap snapshot info
   */
  getHeapSnapshot() {
    // Note: Full heap snapshot requires v8.writeHeapSnapshot()
    // which writes to disk. We provide heap stats instead for API use.
    const heapStats = this.getHeapStats();
    const heapSpaces = this.getHeapSpaceStats();

    return {
      timestamp: Date.now(),
      stats: heapStats,
      spaces: heapSpaces,
      // To get full snapshot, call writeHeapSnapshot()
      snapshotAvailable: typeof v8.writeHeapSnapshot === 'function'
    };
  }

  /**
   * Write heap snapshot to file
   * @param {string} filename - Optional filename
   * @returns {Object} Result with filename
   */
  writeHeapSnapshot(filename = null) {
    if (typeof v8.writeHeapSnapshot !== 'function') {
      return {
        success: false,
        error: 'writeHeapSnapshot not available in this Node.js version'
      };
    }

    try {
      const snapshotPath = filename || v8.writeHeapSnapshot();
      if (this.logger) {
        this.logger.info('Heap snapshot written', { path: snapshotPath });
      }
      return {
        success: true,
        path: snapshotPath,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Determine memory status based on current usage
   * @param {Object} memInfo - Memory info object
   * @returns {string} Memory status
   */
  getMemoryStatus(memInfo = null) {
    const mem = memInfo || this.getMemoryUsage();
    const heapMB = mem.heapUsedMB;

    if (heapMB >= this.thresholds.critical) {
      return MEMORY_STATUS.CRITICAL;
    } else if (heapMB >= this.thresholds.warning) {
      return MEMORY_STATUS.WARNING;
    }
    return MEMORY_STATUS.NORMAL;
  }

  /**
   * Start periodic memory monitoring
   * @param {number} interval - Monitoring interval in ms
   * @returns {Object} Start result
   */
  startMonitoring(interval = null) {
    if (this.isMonitoring) {
      return { success: false, error: 'Already monitoring' };
    }

    const monitorInterval = interval || this.monitorInterval;
    this.isMonitoring = true;

    this.monitorTimer = setInterval(() => {
      this.sample();
    }, monitorInterval);

    // Take initial sample
    this.sample();

    if (this.logger) {
      this.logger.info('Memory monitoring started', { interval: monitorInterval });
    }

    return {
      success: true,
      interval: monitorInterval
    };
  }

  /**
   * Stop periodic memory monitoring
   * @returns {Object} Stop result
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return { success: false, error: 'Not monitoring' };
    }

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    this.isMonitoring = false;

    if (this.logger) {
      this.logger.info('Memory monitoring stopped');
    }

    return { success: true };
  }

  /**
   * Take a memory sample
   * @returns {Object} Memory sample
   */
  sample() {
    const memInfo = this.getMemoryUsage();
    const status = this.getMemoryStatus(memInfo);

    // Add to history
    this.history.push(memInfo);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Track for leak detection
    if (this.leakDetectionEnabled) {
      this.leakSamples.push({
        timestamp: memInfo.timestamp,
        heapUsed: memInfo.heapUsed
      });

      // Keep only recent samples
      const cutoff = Date.now() - this.thresholds.leakDetection.timeWindow;
      this.leakSamples = this.leakSamples.filter(s => s.timestamp >= cutoff);
    }

    this.stats.samples++;

    // Handle status changes
    if (status !== this.lastStatus) {
      this.emit('statusChange', {
        oldStatus: this.lastStatus,
        newStatus: status,
        memInfo
      });
      this.lastStatus = status;
    }

    // Handle warning/critical states
    if (status === MEMORY_STATUS.WARNING) {
      this.stats.warningCount++;
      if (this.logger) {
        this.logger.warn('Memory warning', { heapUsedMB: memInfo.heapUsedMB });
      }
      this.emit('warning', memInfo);
    } else if (status === MEMORY_STATUS.CRITICAL) {
      this.stats.criticalCount++;
      if (this.logger) {
        this.logger.error('Memory critical', { heapUsedMB: memInfo.heapUsedMB });
      }
      this.emit('critical', memInfo);
    }

    return { ...memInfo, status };
  }

  /**
   * Detect potential memory leaks
   * @returns {Object} Leak detection result
   */
  detectLeaks() {
    if (!this.leakDetectionEnabled) {
      return { enabled: false };
    }

    const config = this.thresholds.leakDetection;

    if (this.leakSamples.length < config.minSamples) {
      return {
        enabled: true,
        analyzed: false,
        reason: 'Not enough samples',
        samplesNeeded: config.minSamples,
        samplesCollected: this.leakSamples.length
      };
    }

    // Calculate growth rate
    const samples = this.leakSamples;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDelta = last.timestamp - first.timestamp;
    const memoryDelta = last.heapUsed - first.heapUsed;
    const growthRate = memoryDelta / first.heapUsed;
    const growthPerMinute = (growthRate / timeDelta) * 60000;

    // Check for consistent growth
    let consistentGrowth = true;
    let growingSegments = 0;

    for (let i = 1; i < samples.length; i++) {
      if (samples[i].heapUsed > samples[i - 1].heapUsed) {
        growingSegments++;
      }
    }

    const growthRatio = growingSegments / (samples.length - 1);
    consistentGrowth = growthRatio > 0.7; // 70% of segments showing growth

    const leakDetected = consistentGrowth && growthRate > config.growthThreshold;

    if (leakDetected) {
      this.stats.leaksDetected++;

      const leak = {
        timestamp: Date.now(),
        growthRate,
        growthPerMinute,
        startHeap: this.bytesToMB(first.heapUsed),
        endHeap: this.bytesToMB(last.heapUsed),
        duration: timeDelta
      };

      this.potentialLeaks.push(leak);

      if (this.logger) {
        this.logger.warn('Potential memory leak detected', leak);
      }

      this.emit('leak', leak);
    }

    return {
      enabled: true,
      analyzed: true,
      leakDetected,
      growthRate: Math.round(growthRate * 10000) / 100, // As percentage
      growthPerMinute: Math.round(growthPerMinute * 10000) / 100,
      consistentGrowth,
      sampleCount: samples.length,
      timeWindow: timeDelta,
      potentialLeaks: this.potentialLeaks.length
    };
  }

  /**
   * Get memory history
   * @param {number} limit - Max entries to return
   * @returns {Array}
   */
  getHistory(limit = null) {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Get monitoring statistics
   * @returns {Object}
   */
  getStats() {
    const current = this.getMemoryUsage();

    return {
      current: {
        heapUsedMB: current.heapUsedMB,
        heapTotalMB: current.heapTotalMB,
        rssMB: current.rssMB,
        status: this.getMemoryStatus(current)
      },
      peak: {
        heapUsedMB: this.stats.peakHeapUsed,
        rssMB: this.stats.peakRss
      },
      counts: {
        samples: this.stats.samples,
        warnings: this.stats.warningCount,
        criticals: this.stats.criticalCount,
        leaksDetected: this.stats.leaksDetected
      },
      thresholds: this.thresholds,
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.stats.startTime,
      enabled: this.enabled
    };
  }

  /**
   * Set thresholds
   * @param {Object} thresholds - New thresholds
   * @returns {Object} Result
   */
  setThresholds(thresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds
    };

    if (this.logger) {
      this.logger.info('Memory thresholds updated', { thresholds: this.thresholds });
    }

    return { success: true, thresholds: this.thresholds };
  }

  /**
   * Trigger garbage collection if available
   * @returns {Object} GC result
   */
  triggerGC() {
    if (typeof global.gc !== 'function') {
      return {
        success: false,
        error: 'GC not available. Start Node with --expose-gc flag.'
      };
    }

    const before = this.getMemoryUsage();
    global.gc();
    const after = this.getMemoryUsage();

    const freed = before.heapUsedMB - after.heapUsedMB;

    if (this.logger) {
      this.logger.debug('GC triggered', { freedMB: freed });
    }

    return {
      success: true,
      before: before.heapUsedMB,
      after: after.heapUsedMB,
      freedMB: Math.max(0, freed)
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.history = [];
    this.leakSamples = [];
    this.potentialLeaks = [];
    this.lastStatus = MEMORY_STATUS.NORMAL;
    this.stats = {
      samples: 0,
      peakHeapUsed: 0,
      peakRss: 0,
      warningCount: 0,
      criticalCount: 0,
      leaksDetected: 0,
      startTime: Date.now()
    };
  }

  /**
   * Clean up
   */
  cleanup() {
    this.stopMonitoring();
    this.reset();
    this.removeAllListeners();
  }
}

// Create default instance
const defaultMemoryMonitor = new MemoryMonitor();

module.exports = {
  MemoryMonitor,
  MEMORY_STATUS,
  DEFAULT_THRESHOLDS,
  defaultMemoryMonitor
};

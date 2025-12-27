/**
 * Basset Hound Browser - Memory Manager
 * Provides memory usage monitoring, automatic cleanup triggers,
 * and garbage collection hints for the browser application.
 */

const { EventEmitter } = require('events');

/**
 * Memory threshold presets (in MB)
 */
const MEMORY_THRESHOLDS = {
  low: {
    warning: 256,    // 256 MB - warning threshold
    critical: 384,   // 384 MB - critical threshold
    cleanup: 192     // 192 MB - trigger cleanup when above this after GC
  },
  medium: {
    warning: 512,    // 512 MB - warning threshold
    critical: 768,   // 768 MB - critical threshold
    cleanup: 384     // 384 MB - trigger cleanup when above this after GC
  },
  high: {
    warning: 1024,   // 1 GB - warning threshold
    critical: 1536,  // 1.5 GB - critical threshold
    cleanup: 768     // 768 MB - trigger cleanup when above this after GC
  },
  custom: null       // Will be set via configuration
};

/**
 * Memory status levels
 */
const MemoryStatus = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

/**
 * MemoryManager class for monitoring and managing application memory
 */
class MemoryManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Configuration
    this.thresholdPreset = options.thresholdPreset || 'medium';
    this.thresholds = options.customThresholds || MEMORY_THRESHOLDS[this.thresholdPreset] || MEMORY_THRESHOLDS.medium;
    this.monitoringInterval = options.monitoringInterval || 30000; // 30 seconds default
    this.enableAutoCleanup = options.enableAutoCleanup !== false;
    this.enableLogging = options.enableLogging !== false;
    this.logPrefix = '[MemoryManager]';

    // State
    this.isMonitoring = false;
    this.monitoringTimer = null;
    this.lastStatus = MemoryStatus.NORMAL;
    this.memoryHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 100;
    this.cleanupCallbacks = new Map();
    this.cleanupIdCounter = 0;

    // Statistics
    this.stats = {
      gcTriggered: 0,
      cleanupTriggered: 0,
      warningCount: 0,
      criticalCount: 0,
      peakHeapUsed: 0,
      peakRss: 0,
      startTime: Date.now()
    };

    // WebSocket server reference for broadcasting (set externally)
    this.wsServer = null;
  }

  /**
   * Set WebSocket server reference for broadcasting memory alerts
   * @param {WebSocketServer} server - WebSocket server instance
   */
  setWebSocketServer(server) {
    this.wsServer = server;
    this.log('WebSocket server attached for memory alerts');
  }

  /**
   * Log a message if logging is enabled
   * @param {string} message - Message to log
   * @param {string} level - Log level (log, warn, error)
   */
  log(message, level = 'log') {
    if (!this.enableLogging) return;
    const timestamp = new Date().toISOString();
    const logMessage = `${this.logPrefix} [${timestamp}] ${message}`;
    console[level](logMessage);
  }

  /**
   * Convert bytes to megabytes
   * @param {number} bytes - Bytes to convert
   * @returns {number} Megabytes (rounded to 2 decimal places)
   */
  bytesToMB(bytes) {
    return Math.round((bytes / (1024 * 1024)) * 100) / 100;
  }

  /**
   * Get current memory usage statistics
   * @returns {Object} Memory usage object with formatted values
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    const memInfo = {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      rss: usage.rss,
      arrayBuffers: usage.arrayBuffers || 0,
      // Human-readable values in MB
      heapUsedMB: this.bytesToMB(usage.heapUsed),
      heapTotalMB: this.bytesToMB(usage.heapTotal),
      externalMB: this.bytesToMB(usage.external),
      rssMB: this.bytesToMB(usage.rss),
      arrayBuffersMB: this.bytesToMB(usage.arrayBuffers || 0),
      // Percentages
      heapUsedPercent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
      timestamp: Date.now()
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
   * Determine memory status based on current usage
   * @param {Object} memInfo - Memory information object
   * @returns {string} Memory status (normal, warning, critical)
   */
  getMemoryStatus(memInfo = null) {
    const mem = memInfo || this.getMemoryUsage();
    const heapMB = mem.heapUsedMB;

    if (heapMB >= this.thresholds.critical) {
      return MemoryStatus.CRITICAL;
    } else if (heapMB >= this.thresholds.warning) {
      return MemoryStatus.WARNING;
    }
    return MemoryStatus.NORMAL;
  }

  /**
   * Check if garbage collection is available
   * @returns {boolean} True if gc() is available
   */
  isGCAvailable() {
    return typeof global.gc === 'function';
  }

  /**
   * Trigger garbage collection if available
   * @param {boolean} full - Whether to do a full GC (default: true)
   * @returns {Object} GC result with before/after memory stats
   */
  triggerGC(full = true) {
    if (!this.isGCAvailable()) {
      return {
        success: false,
        error: 'Garbage collection not available. Start Node with --expose-gc flag.',
        gcAvailable: false
      };
    }

    const before = this.getMemoryUsage();

    try {
      if (full) {
        // Full GC
        global.gc();
      } else {
        // Minor GC
        global.gc(true);
      }

      const after = this.getMemoryUsage();
      const freed = before.heapUsedMB - after.heapUsedMB;

      this.stats.gcTriggered++;
      this.log(`GC triggered: freed ${freed.toFixed(2)} MB (${before.heapUsedMB} -> ${after.heapUsedMB} MB)`);

      return {
        success: true,
        gcAvailable: true,
        before: {
          heapUsedMB: before.heapUsedMB,
          heapTotalMB: before.heapTotalMB
        },
        after: {
          heapUsedMB: after.heapUsedMB,
          heapTotalMB: after.heapTotalMB
        },
        freedMB: Math.max(0, freed),
        fullGC: full
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gcAvailable: true
      };
    }
  }

  /**
   * Register a cleanup callback
   * @param {string} name - Name/identifier for the cleanup
   * @param {Function} callback - Cleanup function (should return Promise or cleanup result)
   * @param {number} priority - Priority (lower = runs first, default: 10)
   * @returns {string} Cleanup ID for later removal
   */
  registerCleanupCallback(name, callback, priority = 10) {
    const id = `cleanup-${++this.cleanupIdCounter}`;
    this.cleanupCallbacks.set(id, {
      id,
      name,
      callback,
      priority,
      registeredAt: Date.now()
    });
    this.log(`Cleanup callback registered: ${name} (id: ${id}, priority: ${priority})`);
    return id;
  }

  /**
   * Unregister a cleanup callback
   * @param {string} id - Cleanup ID to remove
   * @returns {boolean} True if removed successfully
   */
  unregisterCleanupCallback(id) {
    const removed = this.cleanupCallbacks.delete(id);
    if (removed) {
      this.log(`Cleanup callback unregistered: ${id}`);
    }
    return removed;
  }

  /**
   * Run all registered cleanup callbacks
   * @returns {Promise<Object>} Cleanup results
   */
  async runCleanup() {
    const before = this.getMemoryUsage();
    const results = [];

    // Sort callbacks by priority
    const sortedCallbacks = Array.from(this.cleanupCallbacks.values())
      .sort((a, b) => a.priority - b.priority);

    this.log(`Running ${sortedCallbacks.length} cleanup callbacks...`);

    for (const { id, name, callback } of sortedCallbacks) {
      try {
        const startTime = Date.now();
        const result = await callback();
        const duration = Date.now() - startTime;

        results.push({
          id,
          name,
          success: true,
          result,
          durationMs: duration
        });
        this.log(`Cleanup '${name}' completed in ${duration}ms`);
      } catch (error) {
        results.push({
          id,
          name,
          success: false,
          error: error.message
        });
        this.log(`Cleanup '${name}' failed: ${error.message}`, 'error');
      }
    }

    // Trigger GC after cleanup if available
    const gcResult = this.triggerGC();

    const after = this.getMemoryUsage();
    const totalFreed = before.heapUsedMB - after.heapUsedMB;

    this.stats.cleanupTriggered++;

    return {
      success: true,
      before: {
        heapUsedMB: before.heapUsedMB,
        rssMB: before.rssMB
      },
      after: {
        heapUsedMB: after.heapUsedMB,
        rssMB: after.rssMB
      },
      freedMB: Math.max(0, totalFreed),
      gcResult,
      cleanupResults: results,
      callbackCount: sortedCallbacks.length
    };
  }

  /**
   * Start periodic memory monitoring
   * @param {number} interval - Monitoring interval in ms (optional, uses config default)
   * @returns {Object} Start result
   */
  startMonitoring(interval = null) {
    if (this.isMonitoring) {
      return { success: false, error: 'Monitoring already active' };
    }

    const monitorInterval = interval || this.monitoringInterval;
    this.isMonitoring = true;

    this.monitoringTimer = setInterval(() => {
      this.checkMemory();
    }, monitorInterval);

    // Perform initial check
    this.checkMemory();

    this.log(`Memory monitoring started (interval: ${monitorInterval}ms)`);

    return {
      success: true,
      interval: monitorInterval,
      thresholds: this.thresholds
    };
  }

  /**
   * Stop periodic memory monitoring
   * @returns {Object} Stop result
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return { success: false, error: 'Monitoring not active' };
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.isMonitoring = false;
    this.log('Memory monitoring stopped');

    return { success: true };
  }

  /**
   * Check memory and emit events/take action if needed
   * @returns {Object} Check result with memory info and status
   */
  async checkMemory() {
    const memInfo = this.getMemoryUsage();
    const status = this.getMemoryStatus(memInfo);

    // Add to history
    this.memoryHistory.push({
      ...memInfo,
      status
    });

    // Trim history if needed
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistoryLength);
    }

    // Handle status changes
    if (status !== this.lastStatus) {
      this.handleStatusChange(this.lastStatus, status, memInfo);
      this.lastStatus = status;
    }

    // Handle critical/warning states
    if (status === MemoryStatus.CRITICAL) {
      this.stats.criticalCount++;
      this.log(`CRITICAL: Memory usage at ${memInfo.heapUsedMB} MB (threshold: ${this.thresholds.critical} MB)`, 'error');

      if (this.enableAutoCleanup) {
        this.log('Auto-cleanup triggered due to critical memory state');
        await this.runCleanup();
      }

      // Broadcast to connected clients
      this.broadcastMemoryAlert('critical', memInfo);
    } else if (status === MemoryStatus.WARNING) {
      this.stats.warningCount++;
      this.log(`WARNING: Memory usage at ${memInfo.heapUsedMB} MB (threshold: ${this.thresholds.warning} MB)`, 'warn');

      // Broadcast to connected clients
      this.broadcastMemoryAlert('warning', memInfo);
    }

    return {
      ...memInfo,
      status,
      thresholds: this.thresholds,
      isMonitoring: this.isMonitoring
    };
  }

  /**
   * Handle memory status change
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {Object} memInfo - Current memory info
   */
  handleStatusChange(oldStatus, newStatus, memInfo) {
    this.emit('statusChange', {
      oldStatus,
      newStatus,
      memInfo,
      timestamp: Date.now()
    });

    this.log(`Memory status changed: ${oldStatus} -> ${newStatus}`);
  }

  /**
   * Broadcast memory alert to connected WebSocket clients
   * @param {string} level - Alert level (warning, critical)
   * @param {Object} memInfo - Memory information
   */
  broadcastMemoryAlert(level, memInfo) {
    if (!this.wsServer) return;

    try {
      this.wsServer.broadcast({
        type: 'memory_alert',
        level,
        memory: {
          heapUsedMB: memInfo.heapUsedMB,
          heapTotalMB: memInfo.heapTotalMB,
          rssMB: memInfo.rssMB,
          heapUsedPercent: memInfo.heapUsedPercent
        },
        thresholds: this.thresholds,
        timestamp: Date.now()
      });
    } catch (error) {
      this.log(`Failed to broadcast memory alert: ${error.message}`, 'error');
    }
  }

  /**
   * Get memory statistics
   * @returns {Object} Memory statistics
   */
  getStats() {
    const current = this.getMemoryUsage();
    const uptimeMs = Date.now() - this.stats.startTime;

    return {
      current: {
        heapUsedMB: current.heapUsedMB,
        heapTotalMB: current.heapTotalMB,
        rssMB: current.rssMB,
        externalMB: current.externalMB,
        heapUsedPercent: current.heapUsedPercent,
        status: this.getMemoryStatus(current)
      },
      peak: {
        heapUsedMB: this.stats.peakHeapUsed,
        rssMB: this.stats.peakRss
      },
      counts: {
        gcTriggered: this.stats.gcTriggered,
        cleanupTriggered: this.stats.cleanupTriggered,
        warningCount: this.stats.warningCount,
        criticalCount: this.stats.criticalCount
      },
      thresholds: this.thresholds,
      thresholdPreset: this.thresholdPreset,
      uptimeMs,
      uptimeHuman: this.formatUptime(uptimeMs),
      isMonitoring: this.isMonitoring,
      gcAvailable: this.isGCAvailable(),
      autoCleanupEnabled: this.enableAutoCleanup,
      registeredCleanups: this.cleanupCallbacks.size
    };
  }

  /**
   * Format uptime in human-readable format
   * @param {number} ms - Milliseconds
   * @returns {string} Formatted uptime
   */
  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get memory history
   * @param {number} limit - Number of entries to return (default: all)
   * @returns {Array} Memory history entries
   */
  getHistory(limit = null) {
    if (limit && limit > 0) {
      return this.memoryHistory.slice(-limit);
    }
    return [...this.memoryHistory];
  }

  /**
   * Set custom thresholds
   * @param {Object} thresholds - Custom threshold configuration
   * @returns {Object} Result with new thresholds
   */
  setThresholds(thresholds) {
    if (!thresholds || typeof thresholds !== 'object') {
      return { success: false, error: 'Thresholds must be an object' };
    }

    const newThresholds = {
      warning: thresholds.warning || this.thresholds.warning,
      critical: thresholds.critical || this.thresholds.critical,
      cleanup: thresholds.cleanup || this.thresholds.cleanup
    };

    // Validate
    if (newThresholds.warning >= newThresholds.critical) {
      return { success: false, error: 'Warning threshold must be less than critical threshold' };
    }

    this.thresholds = newThresholds;
    this.thresholdPreset = 'custom';
    MEMORY_THRESHOLDS.custom = newThresholds;

    this.log(`Thresholds updated: warning=${newThresholds.warning}MB, critical=${newThresholds.critical}MB`);

    return {
      success: true,
      thresholds: this.thresholds
    };
  }

  /**
   * Apply a threshold preset
   * @param {string} preset - Preset name (low, medium, high)
   * @returns {Object} Result with new thresholds
   */
  applyPreset(preset) {
    if (!MEMORY_THRESHOLDS[preset]) {
      return {
        success: false,
        error: `Unknown preset. Available: ${Object.keys(MEMORY_THRESHOLDS).filter(k => k !== 'custom').join(', ')}`
      };
    }

    this.thresholds = { ...MEMORY_THRESHOLDS[preset] };
    this.thresholdPreset = preset;

    this.log(`Applied threshold preset: ${preset}`);

    return {
      success: true,
      preset,
      thresholds: this.thresholds
    };
  }

  /**
   * Reset statistics
   * @returns {Object} Previous stats
   */
  resetStats() {
    const previousStats = { ...this.stats };

    this.stats = {
      gcTriggered: 0,
      cleanupTriggered: 0,
      warningCount: 0,
      criticalCount: 0,
      peakHeapUsed: 0,
      peakRss: 0,
      startTime: Date.now()
    };

    this.memoryHistory = [];
    this.lastStatus = MemoryStatus.NORMAL;

    this.log('Statistics reset');

    return {
      success: true,
      previousStats
    };
  }

  /**
   * Cleanup and release resources
   */
  cleanup() {
    this.stopMonitoring();
    this.cleanupCallbacks.clear();
    this.memoryHistory = [];
    this.removeAllListeners();
    this.log('Memory manager cleaned up');
  }
}

// Create singleton instance
const memoryManager = new MemoryManager();

module.exports = {
  MemoryManager,
  memoryManager,
  MEMORY_THRESHOLDS,
  MemoryStatus
};

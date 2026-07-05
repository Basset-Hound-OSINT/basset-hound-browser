/**
 * Export Rate Limiter Module (L-002)
 *
 * Implements specialized rate limiting for export operations to prevent:
 * - Bulk data exfiltration attacks
 * - Resource exhaustion from large export operations
 * - Abuse of sensitive data extraction endpoints
 *
 * Features:
 * - Per-export-type rate limiting (cookies, sessions, storage, etc.)
 * - Global export bandwidth throttling
 * - Concurrent export operation limits
 * - Per-client export quotas
 * - Adaptive backpressure based on system resources
 * - Export size tracking and limits
 * - Detailed metrics and reporting
 *
 * Supported Export Commands (15+):
 *   1. export_cookies
 *   2. export_cookies_file
 *   3. export_session
 *   4. export_history
 *   5. export_request_rules
 *   6. export_profile
 *   7. export_storage
 *   8. export_scripts
 *   9. export_network_capture
 *   10. export_raw_html
 *   11. export_network_log
 *   12. export_device_ids
 *   13. export_recording
 *   14. export_monitors
 *   15. export_checkpoint
 *
 * Version: 1.0.0
 * Created: June 20, 2026
 *
 * @module src/security/export-rate-limiter
 */

class ExportRateLimiter {
  /**
   * Default configuration for export rate limiting
   */
  static DEFAULT_CONFIG = {
    // Global limits
    global: {
      maxConcurrentExports: 50, // Max simultaneous export operations
      maxExportsPerMinute: 500, // Global rate limit
      maxTotalBandwidth: 100 * 1024 * 1024, // 100 MB/min globally
      windowSize: 60000 // 60 second rolling window
    },

    // Per-client limits
    perClient: {
      maxExportsPerMinute: 50, // Per client per minute
      maxConcurrentExports: 5, // Max parallel exports per client
      maxDataPerHour: 500 * 1024 * 1024, // 500 MB/hour per client
      burstCapacity: 10 * 1024 * 1024 // 10 MB burst allowance
    },

    // Per-export-type limits
    perType: {
      export_cookies: {
        maxPerMinute: 100,
        maxSize: 1 * 1024 * 1024, // 1 MB
        cost: 1
      },
      export_cookies_file: {
        maxPerMinute: 50,
        maxSize: 5 * 1024 * 1024, // 5 MB
        cost: 5
      },
      export_session: {
        maxPerMinute: 30,
        maxSize: 10 * 1024 * 1024, // 10 MB
        cost: 10
      },
      export_history: {
        maxPerMinute: 40,
        maxSize: 50 * 1024 * 1024, // 50 MB
        cost: 8
      },
      export_request_rules: {
        maxPerMinute: 100,
        maxSize: 1 * 1024 * 1024, // 1 MB
        cost: 1
      },
      export_profile: {
        maxPerMinute: 50,
        maxSize: 20 * 1024 * 1024, // 20 MB
        cost: 10
      },
      export_storage: {
        maxPerMinute: 40,
        maxSize: 100 * 1024 * 1024, // 100 MB
        cost: 15
      },
      export_scripts: {
        maxPerMinute: 60,
        maxSize: 5 * 1024 * 1024, // 5 MB
        cost: 3
      },
      export_network_capture: {
        maxPerMinute: 20,
        maxSize: 200 * 1024 * 1024, // 200 MB
        cost: 25
      },
      export_raw_html: {
        maxPerMinute: 50,
        maxSize: 50 * 1024 * 1024, // 50 MB
        cost: 8
      },
      export_network_log: {
        maxPerMinute: 30,
        maxSize: 100 * 1024 * 1024, // 100 MB
        cost: 12
      },
      export_device_ids: {
        maxPerMinute: 100,
        maxSize: 500 * 1024, // 500 KB
        cost: 1
      },
      export_recording: {
        maxPerMinute: 10,
        maxSize: 500 * 1024 * 1024, // 500 MB
        cost: 50
      },
      export_monitors: {
        maxPerMinute: 30,
        maxSize: 50 * 1024 * 1024, // 50 MB
        cost: 10
      },
      export_checkpoint: {
        maxPerMinute: 20,
        maxSize: 100 * 1024 * 1024, // 100 MB
        cost: 15
      }
    },

    // Backpressure configuration
    backpressure: {
      enabled: true,
      memoryThreshold: 0.85, // Trigger at 85% memory usage
      cpuThreshold: 0.90, // Trigger at 90% CPU usage
      reducedRateMultiplier: 0.5 // Reduce rate by 50% under pressure
    },

    // Cleanup configuration
    cleanup: {
      interval: 300000, // 5 minutes
      maxHistoryAge: 3600000, // 1 hour
      maxClientTracking: 10000 // Max unique clients to track
    },

    // Bypass configuration
    bypass: {
      enabled: true,
      bypassClients: [], // Client IDs that bypass limits
      bypassPatterns: [] // Patterns (regex) for bypass
    }
  };

  /**
   * Initialize the export rate limiter
   *
   * @param {Object} config - Configuration options (merged with defaults)
   * @param {Object} options - Additional options
   * @param {Object} options.logger - Logger instance
   * @param {Function} options.getSystemMetrics - Function returning { memory, cpu }
   */
  constructor(config = {}, options = {}) {
    // Merge configuration with defaults
    this.config = this._deepMerge(
      JSON.parse(JSON.stringify(ExportRateLimiter.DEFAULT_CONFIG)),
      config
    );

    this.logger = options.logger || console;
    this.getSystemMetrics = options.getSystemMetrics || this._defaultGetSystemMetrics;

    // State tracking
    this.globalState = {
      exports: 0, // Current concurrent exports
      lastMinuteExports: [], // Timestamps of exports in last minute
      totalBandwidth: 0, // Bytes transferred in current window
      lastReset: Date.now()
    };

    this.clientState = new Map(); // clientId -> { exports, history, quotas, ... }
    this.typeState = new Map(); // exportType -> { history, ... }
    this.activeExports = new Map(); // exportId -> { type, clientId, size, startTime, ... }

    // Statistics
    this.stats = {
      totalExports: 0,
      totalRejected: 0,
      totalBytesTransferred: 0,
      averageExportSize: 0,
      backpressureEvents: 0
    };

    // Initialize cleanup timer
    this._startCleanupTimer();
  }

  /**
   * Check if an export is allowed and register it
   *
   * @param {string} clientId - Client identifier
   * @param {string} exportType - Type of export (e.g., 'export_cookies')
   * @param {Object} options - Additional options
   * @param {number} options.estimatedSize - Estimated data size in bytes (optional)
   * @returns {Object} { allowed, reason, retryAfter, exportId, quotaRemaining }
   */
  checkExport(clientId, exportType, options = {}) {
    const { estimatedSize = 0 } = options;
    const now = Date.now();

    // Check bypass
    if (this._shouldBypass(clientId)) {
      return {
        allowed: true,
        reason: 'client_bypassed',
        exportId: this._generateExportId(),
        quotaRemaining: { global: 'unlimited', client: 'unlimited', type: 'unlimited' }
      };
    }

    // Validate export type
    if (!this.config.perType[exportType]) {
      return {
        allowed: false,
        reason: 'unknown_export_type',
        retryAfter: null
      };
    }

    // Reset global window if needed
    this._resetGlobalWindow(now);

    // Check 1: Global concurrent limit
    if (this.globalState.exports >= this.config.global.maxConcurrentExports) {
      this.stats.totalRejected++;
      return {
        allowed: false,
        reason: 'global_concurrent_limit_exceeded',
        retryAfter: 1,
        quotaRemaining: {
          global: 0,
          client: this._getClientExportsRemaining(clientId),
          type: this._getTypeExportsRemaining(exportType)
        }
      };
    }

    // Check 2: Global rate limit
    const globalExportsRemaining = this.config.global.maxExportsPerMinute -
      this.globalState.lastMinuteExports.length;
    if (globalExportsRemaining <= 0) {
      this.stats.totalRejected++;
      const retryAfter = Math.ceil(
        (this.globalState.lastMinuteExports[0] + this.config.global.windowSize - now) / 1000
      );
      return {
        allowed: false,
        reason: 'global_rate_limit_exceeded',
        retryAfter: Math.max(1, retryAfter),
        quotaRemaining: {
          global: 0,
          client: this._getClientExportsRemaining(clientId),
          type: this._getTypeExportsRemaining(exportType)
        }
      };
    }

    // Check 3: Global bandwidth limit
    if (estimatedSize > 0) {
      const bandwidthRemaining = this.config.global.maxTotalBandwidth -
        this.globalState.totalBandwidth;
      if (estimatedSize > bandwidthRemaining) {
        this.stats.totalRejected++;
        return {
          allowed: false,
          reason: 'global_bandwidth_limit_exceeded',
          retryAfter: 5,
          quotaRemaining: {
            global: bandwidthRemaining,
            client: this._getClientQuotaRemaining(clientId),
            type: this._getTypeExportsRemaining(exportType)
          }
        };
      }
    }

    // Check 4: Per-client limits
    const clientLimits = this._checkClientLimits(clientId, exportType, estimatedSize, now);
    if (!clientLimits.allowed) {
      this.stats.totalRejected++;
      return clientLimits;
    }

    // Check 5: Per-type limits
    const typeLimits = this._checkTypeLimits(exportType, now);
    if (!typeLimits.allowed) {
      this.stats.totalRejected++;
      return typeLimits;
    }

    // Check 6: Size validation
    const typeConfig = this.config.perType[exportType];
    if (estimatedSize > typeConfig.maxSize) {
      this.stats.totalRejected++;
      return {
        allowed: false,
        reason: 'export_size_limit_exceeded',
        retryAfter: null,
        quotaRemaining: {
          global: globalExportsRemaining,
          client: this._getClientExportsRemaining(clientId),
          type: this._getTypeExportsRemaining(exportType)
        }
      };
    }

    // Check 7: Apply backpressure if needed
    if (this.config.backpressure.enabled && this._isUnderBackpressure()) {
      this.stats.backpressureEvents++;
      return {
        allowed: false,
        reason: 'system_backpressure',
        retryAfter: 2,
        quotaRemaining: {
          global: globalExportsRemaining,
          client: this._getClientExportsRemaining(clientId),
          type: this._getTypeExportsRemaining(exportType)
        }
      };
    }

    // All checks passed - register export
    const exportId = this._generateExportId();
    this._registerExport(exportId, clientId, exportType, estimatedSize, now);

    this.stats.totalExports++;

    return {
      allowed: true,
      exportId,
      quotaRemaining: {
        global: globalExportsRemaining - 1,
        client: this._getClientExportsRemaining(clientId) - 1,
        type: this._getTypeExportsRemaining(exportType) - 1
      }
    };
  }

  /**
   * Record the completion of an export
   *
   * @param {string} exportId - Export ID from checkExport()
   * @param {number} actualSize - Actual bytes transferred
   * @returns {Object} Statistics about the export
   */
  recordExportCompletion(exportId, actualSize) {
    const now = Date.now();
    const exportData = this.activeExports.get(exportId);

    if (!exportData) {
      this.logger.warn(`Export completion recorded for unknown ID: ${exportId}`);
      return { recorded: false };
    }

    const duration = now - exportData.startTime;
    const throughput = actualSize / (duration / 1000); // Bytes/second

    // Update statistics
    this.stats.totalBytesTransferred += actualSize;
    this.stats.averageExportSize = this.stats.totalBytesTransferred /
      (this.stats.totalExports || 1);

    // Update global state
    this.globalState.exports = Math.max(0, this.globalState.exports - 1);
    this.globalState.totalBandwidth += actualSize;

    // Update client state
    const clientData = this.clientState.get(exportData.clientId);
    if (clientData) {
      clientData.exports = Math.max(0, clientData.exports - 1);
      clientData.totalBytes += actualSize;
      clientData.history.push({
        type: exportData.type,
        size: actualSize,
        timestamp: now,
        duration
      });
    }

    // Update type state
    const typeData = this.typeState.get(exportData.type);
    if (typeData) {
      typeData.totalBytes += actualSize;
      typeData.history.push({
        clientId: exportData.clientId,
        size: actualSize,
        timestamp: now
      });
    }

    // Remove from active exports
    this.activeExports.delete(exportId);

    return {
      recorded: true,
      duration,
      throughput: Math.round(throughput),
      totalBytes: actualSize
    };
  }

  /**
   * Get current statistics
   *
   * @returns {Object} Detailed statistics about rate limiting state
   */
  getStats() {
    const now = Date.now();
    const activeExports = Array.from(this.activeExports.entries()).map(([id, data]) => ({
      id,
      type: data.type,
      clientId: data.clientId,
      estimatedSize: data.estimatedSize,
      duration: now - data.startTime
    }));

    const topClients = Array.from(this.clientState.entries())
      .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
      .slice(0, 10)
      .map(([clientId, data]) => ({
        clientId,
        exportsCount: data.exportsCount,
        totalBytes: data.totalBytes,
        avgSize: Math.round(data.totalBytes / (data.exportsCount || 1))
      }));

    return {
      global: {
        concurrentExports: this.globalState.exports,
        maxConcurrent: this.config.global.maxConcurrentExports,
        lastMinuteExports: this.globalState.lastMinuteExports.length,
        maxPerMinute: this.config.global.maxExportsPerMinute,
        bandwidthUsed: this.globalState.totalBandwidth,
        maxBandwidth: this.config.global.maxTotalBandwidth
      },
      statistics: {
        totalExports: this.stats.totalExports,
        totalRejected: this.stats.totalRejected,
        rejectionRate: this.stats.totalExports > 0 ?
          (this.stats.totalRejected / (this.stats.totalExports + this.stats.totalRejected)) :
          0,
        totalBytesTransferred: this.stats.totalBytesTransferred,
        averageExportSize: Math.round(this.stats.averageExportSize),
        backpressureEvents: this.stats.backpressureEvents
      },
      activeExports,
      topClients,
      clientTracking: this.clientState.size,
      typeTracking: this.typeState.size
    };
  }

  /**
   * Reset all rate limiting state (for testing)
   */
  reset() {
    this.globalState = {
      exports: 0,
      lastMinuteExports: [],
      totalBandwidth: 0,
      lastReset: Date.now()
    };
    this.clientState.clear();
    this.typeState.clear();
    this.activeExports.clear();
    this.stats = {
      totalExports: 0,
      totalRejected: 0,
      totalBytesTransferred: 0,
      averageExportSize: 0,
      backpressureEvents: 0
    };
  }

  /**
   * Destroy the limiter (cleanup)
   */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  // ============ Private Methods ============

  /**
   * Check client-level rate limits
   * @private
   */
  _checkClientLimits(clientId, exportType, estimatedSize, now) {
    const clientData = this._getOrCreateClientState(clientId);
    const exportsRemaining = this.config.perClient.maxExportsPerMinute -
      this._countClientExportsInWindow(clientId, now);

    if (exportsRemaining <= 0) {
      return {
        allowed: false,
        reason: 'client_rate_limit_exceeded',
        retryAfter: Math.ceil(
          (clientData.windowStart + this.config.global.windowSize - now) / 1000
        )
      };
    }

    if (clientData.exports >= this.config.perClient.maxConcurrentExports) {
      return {
        allowed: false,
        reason: 'client_concurrent_limit_exceeded',
        retryAfter: 1
      };
    }

    // Check hourly quota
    const hourAgo = now - 3600000;
    const recentBytes = clientData.history
      .filter(h => h.timestamp > hourAgo)
      .reduce((sum, h) => sum + h.size, 0);

    if (recentBytes + estimatedSize > this.config.perClient.maxDataPerHour) {
      const remaining = Math.max(0, this.config.perClient.maxDataPerHour - recentBytes);
      return {
        allowed: false,
        reason: 'client_quota_exceeded',
        retryAfter: 3600,
        quotaRemaining: { client: remaining }
      };
    }

    return { allowed: true };
  }

  /**
   * Check type-level rate limits
   * @private
   */
  _checkTypeLimits(exportType, now) {
    const typeConfig = this.config.perType[exportType];
    const typeData = this._getOrCreateTypeState(exportType);

    const exportsInWindow = typeData.history
      .filter(h => h.timestamp > now - this.config.global.windowSize)
      .length;

    if (exportsInWindow >= typeConfig.maxPerMinute) {
      return {
        allowed: false,
        reason: 'type_rate_limit_exceeded',
        retryAfter: Math.ceil(
          (typeData.history[0]?.timestamp + this.config.global.windowSize - now) / 1000
        )
      };
    }

    return { allowed: true };
  }

  /**
   * Register an export operation
   * @private
   */
  _registerExport(exportId, clientId, exportType, estimatedSize, now) {
    // Global state
    this.globalState.exports++;
    this.globalState.lastMinuteExports.push(now);
    if (estimatedSize > 0) {
      this.globalState.totalBandwidth += estimatedSize;
    }

    // Client state
    const clientData = this._getOrCreateClientState(clientId);
    clientData.exports++;
    clientData.exportsCount++;

    // Type state
    const typeData = this._getOrCreateTypeState(exportType);
    typeData.exports++;

    // Active export tracking
    this.activeExports.set(exportId, {
      type: exportType,
      clientId,
      estimatedSize,
      startTime: now,
      registered: true
    });
  }

  /**
   * Get or create client state
   * @private
   */
  _getOrCreateClientState(clientId) {
    if (!this.clientState.has(clientId)) {
      this.clientState.set(clientId, {
        exports: 0,
        exportsCount: 0,
        totalBytes: 0,
        windowStart: Date.now(),
        history: []
      });
    }
    return this.clientState.get(clientId);
  }

  /**
   * Get or create type state
   * @private
   */
  _getOrCreateTypeState(exportType) {
    if (!this.typeState.has(exportType)) {
      this.typeState.set(exportType, {
        exports: 0,
        totalBytes: 0,
        history: []
      });
    }
    return this.typeState.get(exportType);
  }

  /**
   * Count client exports in current window
   * @private
   */
  _countClientExportsInWindow(clientId, now) {
    const clientData = this.clientState.get(clientId);
    if (!clientData) {
      return 0;
    }
    return clientData.history
      .filter(h => h.timestamp > now - this.config.global.windowSize)
      .length;
  }

  /**
   * Get remaining exports for client
   * @private
   */
  _getClientExportsRemaining(clientId) {
    const now = Date.now();
    const count = this._countClientExportsInWindow(clientId, now);
    return Math.max(0, this.config.perClient.maxExportsPerMinute - count);
  }

  /**
   * Get remaining quota for client
   * @private
   */
  _getClientQuotaRemaining(clientId) {
    const now = Date.now();
    const clientData = this.clientState.get(clientId);
    if (!clientData) {
      return this.config.perClient.maxDataPerHour;
    }

    const hourAgo = now - 3600000;
    const recentBytes = clientData.history
      .filter(h => h.timestamp > hourAgo)
      .reduce((sum, h) => sum + h.size, 0);

    return Math.max(0, this.config.perClient.maxDataPerHour - recentBytes);
  }

  /**
   * Get remaining exports for type
   * @private
   */
  _getTypeExportsRemaining(exportType) {
    const typeConfig = this.config.perType[exportType];
    if (!typeConfig) {
      return 0;
    }

    const now = Date.now();
    const typeData = this.typeState.get(exportType);
    if (!typeData) {
      return typeConfig.maxPerMinute;
    }

    const count = typeData.history
      .filter(h => h.timestamp > now - this.config.global.windowSize)
      .length;

    return Math.max(0, typeConfig.maxPerMinute - count);
  }

  /**
   * Check if under system backpressure
   * @private
   */
  _isUnderBackpressure() {
    if (!this.config.backpressure.enabled) {
      return false;
    }

    const metrics = this.getSystemMetrics();
    return metrics.memory > this.config.backpressure.memoryThreshold ||
           metrics.cpu > this.config.backpressure.cpuThreshold;
  }

  /**
   * Check if client should bypass limits
   * @private
   */
  _shouldBypass(clientId) {
    if (!this.config.bypass.enabled) {
      return false;
    }

    if (this.config.bypass.bypassClients.includes(clientId)) {
      return true;
    }

    return this.config.bypass.bypassPatterns.some(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(clientId);
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Reset global window if needed
   * @private
   */
  _resetGlobalWindow(now) {
    if (now - this.globalState.lastReset > this.config.global.windowSize) {
      this.globalState.lastMinuteExports = [];
      this.globalState.totalBandwidth = 0;
      this.globalState.lastReset = now;
    } else {
      // Trim old entries from sliding window
      this.globalState.lastMinuteExports = this.globalState.lastMinuteExports
        .filter(ts => now - ts < this.config.global.windowSize);
    }
  }

  /**
   * Generate unique export ID
   * @private
   */
  _generateExportId() {
    return `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start cleanup timer
   * @private
   */
  _startCleanupTimer() {
    this.cleanupTimer = setInterval(() => this._cleanup(), this.config.cleanup.interval);
  }

  /**
   * Cleanup old data
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const maxAge = this.config.cleanup.maxHistoryAge;

    // Cleanup client state
    for (const [clientId, data] of this.clientState.entries()) {
      data.history = data.history.filter(h => now - h.timestamp < maxAge);
      if (data.history.length === 0 && data.exports === 0) {
        this.clientState.delete(clientId);
      }
    }

    // Cleanup type state
    for (const [type, data] of this.typeState.entries()) {
      data.history = data.history.filter(h => now - h.timestamp < maxAge);
    }

    // Limit client tracking
    if (this.clientState.size > this.config.cleanup.maxClientTracking) {
      const sorted = Array.from(this.clientState.entries())
        .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
        .slice(0, Math.floor(this.config.cleanup.maxClientTracking * 0.8));

      this.clientState.clear();
      sorted.forEach(([clientId, data]) => {
        this.clientState.set(clientId, data);
      });
    }
  }

  /**
   * Merge configuration objects deeply
   * @private
   */
  _deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        this._deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  /**
   * Default system metrics getter
   * @private
   */
  _defaultGetSystemMetrics() {
    const os = require('os');
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      memory: usedMemory / totalMemory,
      cpu: 0.5 // Placeholder - would need actual CPU measurement
    };
  }
}

module.exports = ExportRateLimiter;

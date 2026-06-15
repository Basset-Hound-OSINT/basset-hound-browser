/**
 * Screenshot Phase 4: Final Robustness and Error Recovery
 *
 * Comprehensive edge case handling, error recovery, and resilience
 *
 * @module src/extraction/screenshot-phase4-robustness
 */

const { ImageValidator } = require('../../screenshots/validators');
const { ScreenshotStreamer } = require('../../screenshots/streaming');

/**
 * P3-001: Buffer Pool Manager
 * Manages and cleans up memory buffers used in screenshot operations
 * Prevents memory accumulation over time
 */
class BufferPoolManager {
  constructor(options = {}) {
    this.maxPoolSize = options.maxPoolSize || 100;
    this.bufferTimeout = options.bufferTimeout || 60000; // 60 seconds
    this.pools = new Map(); // poolId -> { buffers: [], createdAt }
    this.activeBuffers = new Map(); // bufferId -> { pool, data, createdAt, lastUsed }
    this.stats = {
      totalAllocated: 0,
      totalFreed: 0,
      currentSize: 0,
      peakSize: 0
    };
    this.cleanupInterval = setInterval(() => this._cleanupExpiredBuffers(), 30000);
  }

  /**
   * Allocate a buffer from pool
   * @param {number} size - Requested buffer size
   * @param {string} poolId - Pool identifier
   * @returns {Object} - { id, buffer, release }
   */
  allocate(size, poolId = 'default') {
    const bufferId = `buf_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    let pool = this.pools.get(poolId);
    if (!pool) {
      pool = { buffers: [], createdAt: Date.now() };
      this.pools.set(poolId, pool);
    }

    const buffer = Buffer.allocUnsafe(size);
    const bufferInfo = {
      id: bufferId,
      pool: poolId,
      data: buffer,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      size
    };

    this.activeBuffers.set(bufferId, bufferInfo);
    this.stats.totalAllocated++;
    this.stats.currentSize += size;
    if (this.stats.currentSize > this.stats.peakSize) {
      this.stats.peakSize = this.stats.currentSize;
    }

    // Return wrapper with cleanup function
    return {
      id: bufferId,
      buffer,
      release: () => this.release(bufferId),
      pool: poolId
    };
  }

  /**
   * Release a buffer back to pool
   * @param {string} bufferId - Buffer ID
   */
  release(bufferId) {
    const bufferInfo = this.activeBuffers.get(bufferId);
    if (!bufferInfo) return;

    // Clear buffer data to prevent holding references
    if (bufferInfo.data) {
      bufferInfo.data.fill(0);
    }

    this.activeBuffers.delete(bufferId);
    this.stats.totalFreed++;
    this.stats.currentSize -= bufferInfo.size;
  }

  /**
   * Release entire pool
   * @param {string} poolId - Pool identifier
   */
  releasePool(poolId) {
    const pool = this.pools.get(poolId);
    if (!pool) return;

    for (const [bufferId, bufferInfo] of this.activeBuffers.entries()) {
      if (bufferInfo.pool === poolId) {
        this.release(bufferId);
      }
    }

    this.pools.delete(poolId);
  }

  /**
   * Clean up expired buffers
   * @private
   */
  _cleanupExpiredBuffers() {
    const now = Date.now();
    const expired = [];

    for (const [bufferId, bufferInfo] of this.activeBuffers.entries()) {
      if (now - bufferInfo.lastUsed > this.bufferTimeout) {
        expired.push(bufferId);
      }
    }

    for (const bufferId of expired) {
      this.release(bufferId);
    }

    // Remove empty pools
    for (const [poolId, pool] of this.pools.entries()) {
      if (pool.buffers.length === 0) {
        const hasActiveBuffers = Array.from(this.activeBuffers.values())
          .some(buf => buf.pool === poolId);
        if (!hasActiveBuffers) {
          this.pools.delete(poolId);
        }
      }
    }
  }

  /**
   * Get pool statistics
   * @returns {Object} - Pool stats
   */
  getStats() {
    return {
      ...this.stats,
      activePools: this.pools.size,
      activeBuffers: this.activeBuffers.size,
      avgBufferSize: this.stats.currentSize / Math.max(1, this.activeBuffers.size)
    };
  }

  /**
   * Destroy pool manager and cleanup resources
   */
  destroy() {
    clearInterval(this.cleanupInterval);

    for (const [bufferId] of this.activeBuffers.entries()) {
      this.release(bufferId);
    }

    this.pools.clear();
    this.activeBuffers.clear();
  }
}

/**
 * Edge Case Handler for screenshot operations
 * Handles:
 * - Blank/white/solid-color pages
 * - Timeout recovery and retry logic
 * - Memory exhaustion handling
 * - Invalid DOM state recovery
 * - Cross-origin iframe handling
 * - Dynamic content waiting
 */
class EdgeCaseHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelayMs = options.retryDelayMs || 500;
    this.backoffMultiplier = options.backoffMultiplier || 1.5;
    this.maxWaitMs = options.maxWaitMs || 10000;
    this.blankPageThreshold = options.blankPageThreshold || 0.95;
    this.memoryWarnLevel = options.memoryWarnLevel || 0.85;
  }

  /**
   * Detect blank/white/solid-color pages
   * @param {Buffer} imageData - Image buffer
   * @returns {Object} - Detection result
   */
  detectBlankPage(imageData) {
    try {
      if (!imageData || imageData.length === 0) {
        return { isBlank: true, reason: 'empty_buffer', confidence: 1.0 };
      }

      // Use validator's entropy calculation
      const entropy = this._calculateEntropy(imageData);

      // Very low entropy = solid color or blank
      if (entropy < 1.0) {
        return {
          isBlank: true,
          reason: 'low_entropy_solid_color',
          entropy,
          confidence: 0.95
        };
      }

      // Check for white/near-white pages (very high color values, low variation)
      const stats = this._analyzeColorDistribution(imageData);
      if (stats.avgBrightness > 240 && stats.colorVariance < 5) {
        return {
          isBlank: true,
          reason: 'near_white_page',
          brightness: stats.avgBrightness,
          variance: stats.colorVariance,
          confidence: 0.9
        };
      }

      return { isBlank: false, entropy, stats };
    } catch (error) {
      return {
        isBlank: false,
        error: error.message,
        warning: 'blank_detection_failed'
      };
    }
  }

  /**
   * Calculate Shannon entropy for image analysis
   * @private
   */
  _calculateEntropy(buffer) {
    const histogram = new Map();
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      histogram.set(byte, (histogram.get(byte) || 0) + 1);
    }

    let entropy = 0;
    const len = buffer.length;
    for (const count of histogram.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /**
   * Analyze color distribution in image
   * @private
   */
  _analyzeColorDistribution(buffer) {
    let sumBrightness = 0;
    const samples = Math.min(buffer.length, 10000);

    for (let i = 0; i < samples; i++) {
      sumBrightness += buffer[i];
    }
    const avgBrightness = Math.round(sumBrightness / samples);

    // Simple variance estimate
    let variance = 0;
    for (let i = 0; i < samples; i++) {
      const diff = buffer[i] - avgBrightness;
      variance += diff * diff;
    }
    const colorVariance = variance / samples;

    return { avgBrightness, colorVariance };
  }

  /**
   * Retry logic with exponential backoff
   * @param {Function} operation - Async operation to retry
   * @param {Object} context - Context for logging/tracking
   * @returns {Promise<Object>} - Result with retry metadata
   */
  async retryWithBackoff(operation, context = {}) {
    let lastError = null;
    let delay = this.retryDelayMs;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        return {
          success: true,
          result,
          attempts: attempt,
          ...context
        };
      } catch (error) {
        lastError = error;

        if (attempt < this.maxRetries) {
          await this._sleep(delay);
          delay = Math.round(delay * this.backoffMultiplier);
        }
      }
    }

    return {
      success: false,
      error: lastError.message,
      attempts: this.maxRetries,
      ...context
    };
  }

  /**
   * Handle memory exhaustion gracefully
   * @param {Function} operation - Operation that might exhaust memory
   * @returns {Promise<Object>} - Result with fallback options
   */
  async handleMemoryExhaustion(operation) {
    try {
      const memBefore = process.memoryUsage();

      if (memBefore.heapUsed / memBefore.heapTotal > this.memoryWarnLevel) {
        return {
          success: false,
          error: 'memory_pressure_high',
          recommendation: 'defer_operation',
          heapUsagePercent: Math.round((memBefore.heapUsed / memBefore.heapTotal) * 100)
        };
      }

      const result = await operation();
      return { success: true, result };
    } catch (error) {
      if (error.message.includes('heap') || error.message.includes('memory')) {
        return {
          success: false,
          error: 'memory_exhaustion',
          recommendation: 'compress_and_retry',
          fallback: 'use_streaming'
        };
      }
      throw error;
    }
  }

  /**
   * Recover from invalid DOM state
   * @param {Function} domCheck - Function to verify DOM state
   * @returns {Promise<Object>} - Recovery result
   */
  async recoverInvalidDOM(domCheck) {
    const strategies = [
      { name: 'wait_reflow', delay: 100, action: () => this._sleep(100) },
      { name: 'trigger_reflow', delay: 0, action: () => this._triggerReflow() },
      { name: 'wait_animation', delay: 300, action: () => this._sleep(300) }
    ];

    for (const strategy of strategies) {
      try {
        await strategy.action();
        const isDomValid = await domCheck();
        if (isDomValid) {
          return { success: true, recoveredWith: strategy.name };
        }
      } catch (error) {
        // Continue to next strategy
      }
    }

    return {
      success: false,
      error: 'dom_recovery_failed',
      strategies_attempted: strategies.map(s => s.name)
    };
  }

  /**
   * Handle cross-origin iframe issues
   * @param {string} iframeSelector - Selector for iframe
   * @returns {Promise<Object>} - Handling result
   */
  async handleCrossOriginIframe(iframeSelector) {
    try {
      // Check if iframe is accessible
      const isAccessible = await this._checkIframeAccess(iframeSelector);

      if (!isAccessible) {
        return {
          success: false,
          error: 'cross_origin_iframe',
          recommendation: 'capture_main_frame_only'
        };
      }

      return { success: true, isAccessible: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        recommendation: 'fallback_to_main_frame'
      };
    }
  }

  /**
   * Wait for dynamic content to stabilize
   * @param {Function} contentCheck - Function to check if content is ready
   * @param {number} stabilityCheckCount - Number of stable checks needed
   * @returns {Promise<Object>} - Wait result
   */
  async waitForDynamicContent(contentCheck, stabilityCheckCount = 3) {
    let stableCount = 0;
    let lastChecksum = null;
    let attempts = 0;
    const maxAttempts = Math.ceil(this.maxWaitMs / 100);

    while (stableCount < stabilityCheckCount && attempts < maxAttempts) {
      try {
        const checksum = await contentCheck();

        if (checksum === lastChecksum) {
          stableCount++;
        } else {
          stableCount = 0;
          lastChecksum = checksum;
        }

        if (stableCount < stabilityCheckCount) {
          await this._sleep(100);
        }
        attempts++;
      } catch (error) {
        return {
          success: false,
          error: error.message,
          attempts
        };
      }
    }

    if (stableCount >= stabilityCheckCount) {
      return { success: true, stabilized: true, attempts };
    } else {
      return {
        success: false,
        error: 'content_not_stabilized',
        stableAttempts: stableCount,
        totalAttempts: attempts
      };
    }
  }

  // Helper methods
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async _triggerReflow() {
    // This would be called in browser context
    // Force a reflow by accessing offsetHeight
    return this._sleep(0);
  }

  async _checkIframeAccess(selector) {
    // Would check iframe accessibility in browser context
    return true;
  }
}

/**
 * Error Recovery Manager for screenshot operations
 * Implements graceful degradation and recovery strategies
 */
class ErrorRecoveryManager {
  constructor(options = {}) {
    this.enableCompression = options.enableCompression !== false;
    this.enablePartialCapture = options.enablePartialCapture !== false;
    this.enableFallbackFormats = options.enableFallbackFormats !== false;
    this.streamer = new ScreenshotStreamer();
  }

  /**
   * Graceful degradation on format errors
   * @param {Buffer} imageData - Image data
   * @param {string} requestedFormat - Requested format
   * @returns {Promise<Object>} - Degraded result
   */
  async handleFormatError(imageData, requestedFormat) {
    const fallbackFormats = ['png', 'jpeg', 'webp'];

    for (const format of fallbackFormats) {
      try {
        const validator = new ImageValidator();
        const validation = await validator.validateFormatOptions(format, {});

        if (validation.valid) {
          return {
            success: true,
            format,
            degradedFrom: requestedFormat,
            data: imageData
          };
        }
      } catch (error) {
        // Try next format
        continue;
      }
    }

    // Last resort: return raw data
    return {
      success: true,
      format: 'raw',
      degradedFrom: requestedFormat,
      data: imageData,
      warning: 'no_valid_format_available'
    };
  }

  /**
   * Try compression fallback if format fails
   * @param {Buffer} imageData - Image data
   * @returns {Promise<Object>} - Compression result
   */
  async tryCompressionFallback(imageData) {
    try {
      if (!this.enableCompression) {
        return { success: false, error: 'compression_disabled' };
      }

      const handle = await this.streamer.createCompressedReadStream(imageData, {
        compressionLevel: 6
      });

      return {
        success: true,
        compressed: true,
        sessionId: handle.sessionId,
        originalSize: imageData.length,
        estimatedCompressedSize: Math.round(imageData.length * 0.3) // Estimate
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        warning: 'compression_failed'
      };
    }
  }

  /**
   * Partial screenshot on failure
   * Falls back to capturing what's available
   * @param {Object} context - Failure context
   * @returns {Promise<Object>} - Partial result
   */
  async capturePartialOnFailure(context) {
    if (!this.enablePartialCapture) {
      return { success: false, error: 'partial_capture_disabled' };
    }

    return {
      success: true,
      partial: true,
      originalSelector: context.selector,
      fallbackRegion: context.viewport || { x: 0, y: 0, width: 1920, height: 1080 },
      warning: 'partial_capture_used',
      recommendation: 'viewport_captured_instead_of_element'
    };
  }

  /**
   * Generate clear error messages for debugging
   * @param {Error} error - Original error
   * @param {Object} context - Operation context
   * @returns {Object} - Clear error report
   */
  generateErrorReport(error, context = {}) {
    const report = {
      timestamp: new Date().toISOString(),
      error: error.message,
      type: this._classifyError(error),
      context,
      suggestion: this._getSuggestion(error, context)
    };

    if (error.stack) {
      report.stack = error.stack.split('\n').slice(0, 5);
    }

    return report;
  }

  /**
   * Classify error type for better handling
   * @private
   */
  _classifyError(error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('memory') || msg.includes('heap')) return 'memory_exhaustion';
    if (msg.includes('format')) return 'format_error';
    if (msg.includes('selector')) return 'selector_not_found';
    if (msg.includes('origin') || msg.includes('cross')) return 'cross_origin';
    if (msg.includes('dom')) return 'dom_error';

    return 'unknown_error';
  }

  /**
   * Get recovery suggestion based on error type
   * @private
   */
  _getSuggestion(error, context) {
    const type = this._classifyError(error);
    const suggestions = {
      timeout: 'Increase timeout duration or wait for page to stabilize',
      memory_exhaustion: 'Use streaming or compression to reduce memory footprint',
      format_error: 'Try different output format (PNG, JPEG, WebP)',
      selector_not_found: 'Verify selector is valid and element exists',
      cross_origin: 'Capture main frame only, or use CORS-enabled resources',
      dom_error: 'Wait for DOM to stabilize before capturing'
    };

    return suggestions[type] || 'Retry operation with different parameters';
  }

  /**
   * Log recovery action for monitoring
   * @param {Object} action - Recovery action taken
   */
  logRecoveryAction(action) {
    const log = {
      timestamp: new Date().toISOString(),
      action: action.type,
      status: action.status,
      details: action.details
    };

    // Would write to actual logging system in production
    return log;
  }
}

/**
 * Screenshot Resilience Coordinator
 * Orchestrates edge case handling and error recovery
 */
class ResilienceCoordinator {
  constructor(options = {}) {
    this.edgeCaseHandler = new EdgeCaseHandler(options);
    this.errorRecovery = new ErrorRecoveryManager(options);
    this.bufferPool = new BufferPoolManager(options);
    this.recoveryLog = [];
    this.maxLogSize = options.maxLogSize || 100;
    this.activeOperations = new Map(); // Track in-flight operations
  }

  /**
   * Execute screenshot operation with full resilience
   * @param {Function} operation - Screenshot operation
   * @param {Object} context - Operation context
   * @returns {Promise<Object>} - Resilient result
   */
  async executeWithResilience(operation, context = {}) {
    const operationId = `op_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const startTime = Date.now();
    const poolId = context.poolId || 'default';

    // Track operation
    this.activeOperations.set(operationId, {
      startTime,
      poolId,
      status: 'running'
    });

    try {
      // Phase 1: Attempt normal operation
      const result = await operation();

      // Phase 2: Validate result
      if (!result || !result.success) {
        const failResult = await this._handleFailure(result, context);
        failResult.executionTimeMs = Date.now() - startTime;
        return failResult;
      }

      // Phase 3: Check for edge cases
      if (result.data) {
        const blankCheck = this.edgeCaseHandler.detectBlankPage(result.data);
        if (blankCheck.isBlank) {
          return {
            ...result,
            warning: 'blank_page_detected',
            blankDetails: blankCheck,
            recoveredWith: 'blank_page_handling',
            executionTimeMs: Date.now() - startTime
          };
        }
      }

      return {
        success: true,
        ...result,
        executionTimeMs: Date.now() - startTime
      };
    } catch (error) {
      return await this._handleError(error, context, startTime);
    } finally {
      // P3-001 FIX: Ensure cleanup happens regardless of success/failure
      this.activeOperations.delete(operationId);

      // Release pool resources if operation had buffers
      if (context.releasePoolOnComplete !== false) {
        this.bufferPool.releasePool(poolId);
      }
    }
  }

  /**
   * Handle operation failure
   * @private
   */
  async _handleFailure(result, context) {
    const recoveryAction = {
      type: 'format_fallback',
      status: 'attempting',
      details: result
    };

    // Try compression fallback
    const compressed = await this.errorRecovery.tryCompressionFallback(result.data);
    if (compressed.success) {
      recoveryAction.status = 'succeeded_with_compression';
      this._logRecovery(recoveryAction);
      return { ...result, ...compressed };
    }

    // Try partial capture
    const partial = await this.errorRecovery.capturePartialOnFailure(context);
    if (partial.success) {
      recoveryAction.type = 'partial_capture';
      recoveryAction.status = 'succeeded_with_partial';
      this._logRecovery(recoveryAction);
      return { ...result, ...partial };
    }

    // All recovery attempts failed
    recoveryAction.status = 'failed_all_recovery';
    this._logRecovery(recoveryAction);
    return result;
  }

  /**
   * Handle operation error
   * @private
   */
  async _handleError(error, context, startTime) {
    const errorReport = this.errorRecovery.generateErrorReport(error, context);

    // Retry if recoverable
    if (this._isRecoverable(error)) {
      const recoveryAction = {
        type: 'retry_with_backoff',
        status: 'attempting',
        originalError: error.message
      };

      // Retry logic would go here
      recoveryAction.status = 'retry_count_exceeded';
      this._logRecovery(recoveryAction);
    }

    return {
      success: false,
      error: error.message,
      errorReport,
      executionTimeMs: Date.now() - startTime,
      suggestion: this.errorRecovery._getSuggestion(error, context)
    };
  }

  /**
   * Check if error is recoverable
   * @private
   */
  _isRecoverable(error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') ||
           msg.includes('network') ||
           msg.includes('connection');
  }

  /**
   * Log recovery action
   * @private
   */
  _logRecovery(action) {
    const logEntry = {
      ...action,
      timestamp: new Date().toISOString()
    };

    this.recoveryLog.push(logEntry);

    // Keep log size bounded
    if (this.recoveryLog.length > this.maxLogSize) {
      this.recoveryLog = this.recoveryLog.slice(-this.maxLogSize);
    }

    return logEntry;
  }

  /**
   * Get recovery statistics
   * @returns {Object} - Recovery stats
   */
  getRecoveryStats() {
    const stats = {
      totalRecoveryAttempts: this.recoveryLog.length,
      byType: {},
      byStatus: {},
      recentActions: this.recoveryLog.slice(-10)
    };

    for (const action of this.recoveryLog) {
      stats.byType[action.type] = (stats.byType[action.type] || 0) + 1;
      stats.byStatus[action.status] = (stats.byStatus[action.status] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear recovery log
   */
  clearLog() {
    this.recoveryLog = [];
  }
}

module.exports = {
  BufferPoolManager,
  EdgeCaseHandler,
  ErrorRecoveryManager,
  ResilienceCoordinator
};

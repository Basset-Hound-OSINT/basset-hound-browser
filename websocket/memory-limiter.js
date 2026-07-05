/**
 * Memory Limiter for WebSocket Operations
 * Issue #1: Memory limit per command
 * - Adds max heap per operation
 * - Kills operations if they exceed limit
 */

const os = require('os');

class MemoryLimiter {
  constructor(options = {}) {
    this.maxMemoryPerOperation = options.maxMemoryPerOperation || 512 * 1024 * 1024; // 512MB default
    this.checkIntervalMs = options.checkIntervalMs || 1000;
    this.operationMemoryMap = new Map(); // operationId -> { startMemory, peakMemory, warnings }
    this.totalSystemMemory = os.totalmem();
    this.memoryThresholdPercent = options.memoryThresholdPercent || 0.85;
    this.killThresholdPercent = options.killThresholdPercent || 0.95;
    this.logger = options.logger || console;
  }

  /**
   * Register an operation for memory monitoring
   * @param {string} operationId - Unique ID for the operation
   * @param {string} command - Command name for logging
   * @returns {Object} Memory monitor object
   */
  registerOperation(operationId, command) {
    const initialMemory = process.memoryUsage().heapUsed;

    const operation = {
      id: operationId,
      command,
      startTime: Date.now(),
      startMemory: initialMemory,
      peakMemory: initialMemory,
      currentMemory: initialMemory,
      warnings: [],
      exceeded: false,
      killed: false
    };

    this.operationMemoryMap.set(operationId, operation);
    this.logger.debug(`[MemoryLimiter] Operation registered: ${operationId} (${command})`);

    return {
      operationId,
      checkMemory: () => this.checkOperation(operationId),
      complete: () => this.completeOperation(operationId)
    };
  }

  /**
   * Check memory usage for an operation
   * @param {string} operationId - Operation ID
   * @returns {Object} Status with memory info and action
   */
  checkOperation(operationId) {
    const operation = this.operationMemoryMap.get(operationId);
    if (!operation) {
      return { ok: true, action: 'none' };
    }

    if (operation.killed) {
      return { ok: false, action: 'already_killed', reason: 'Operation already terminated' };
    }

    const currentMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = currentMemory - operation.startMemory;
    operation.currentMemory = currentMemory;
    operation.peakMemory = Math.max(operation.peakMemory, currentMemory);

    const systemMemoryUsage = (os.totalmem() - os.freemem()) / this.totalSystemMemory;

    // Check if operation exceeded its limit
    if (memoryIncrease > this.maxMemoryPerOperation) {
      operation.exceeded = true;
      operation.warnings.push({
        time: Date.now(),
        type: 'MEMORY_LIMIT_EXCEEDED',
        message: `Operation exceeded memory limit: ${this.formatBytes(memoryIncrease)} / ${this.formatBytes(this.maxMemoryPerOperation)}`
      });

      this.logger.warn(`[MemoryLimiter] Operation ${operationId} exceeded memory limit: ${this.formatBytes(memoryIncrease)}`);
      return {
        ok: false,
        action: 'kill',
        reason: 'Memory limit exceeded',
        memoryUsage: {
          current: currentMemory,
          increase: memoryIncrease,
          limit: this.maxMemoryPerOperation,
          peak: operation.peakMemory
        }
      };
    }

    // Check if system memory is critically high
    if (systemMemoryUsage > this.killThresholdPercent) {
      operation.warnings.push({
        time: Date.now(),
        type: 'SYSTEM_MEMORY_CRITICAL',
        message: `System memory critical: ${(systemMemoryUsage * 100).toFixed(2)}%`
      });

      this.logger.error(`[MemoryLimiter] System memory critical for operation ${operationId}: ${(systemMemoryUsage * 100).toFixed(2)}%`);
      return {
        ok: false,
        action: 'kill',
        reason: 'System memory critical',
        systemMemory: systemMemoryUsage * 100
      };
    }

    // Warn if approaching limit
    if (memoryIncrease > this.maxMemoryPerOperation * 0.8) {
      operation.warnings.push({
        time: Date.now(),
        type: 'APPROACHING_MEMORY_LIMIT',
        message: `Approaching memory limit: ${this.formatBytes(memoryIncrease)} / ${this.formatBytes(this.maxMemoryPerOperation)}`
      });

      this.logger.warn(`[MemoryLimiter] Operation ${operationId} approaching memory limit: ${(memoryIncrease / this.maxMemoryPerOperation * 100).toFixed(2)}%`);
      return {
        ok: true,
        action: 'warn',
        message: 'Approaching memory limit',
        memoryUsage: {
          current: currentMemory,
          increase: memoryIncrease,
          limit: this.maxMemoryPerOperation,
          percentUsed: (memoryIncrease / this.maxMemoryPerOperation * 100).toFixed(2)
        }
      };
    }

    return {
      ok: true,
      action: 'continue',
      memoryUsage: {
        current: currentMemory,
        increase: memoryIncrease,
        limit: this.maxMemoryPerOperation,
        percentUsed: (memoryIncrease / this.maxMemoryPerOperation * 100).toFixed(2)
      }
    };
  }

  /**
   * Mark operation as killed (exceeded limits)
   * @param {string} operationId - Operation ID
   */
  killOperation(operationId) {
    const operation = this.operationMemoryMap.get(operationId);
    if (operation) {
      operation.killed = true;
      this.logger.error(`[MemoryLimiter] Operation killed: ${operationId} (${operation.command})`);
    }
  }

  /**
   * Complete operation and get final stats
   * @param {string} operationId - Operation ID
   * @returns {Object} Final memory stats
   */
  completeOperation(operationId) {
    const operation = this.operationMemoryMap.get(operationId);
    if (!operation) {
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - operation.startTime;
    const memoryIncrease = operation.peakMemory - operation.startMemory;

    const stats = {
      operationId,
      command: operation.command,
      duration,
      memoryIncrease,
      peakMemory: operation.peakMemory,
      startMemory: operation.startMemory,
      warnings: operation.warnings,
      exceeded: operation.exceeded,
      killed: operation.killed,
      memoryFormatted: {
        increase: this.formatBytes(memoryIncrease),
        peak: this.formatBytes(operation.peakMemory),
        start: this.formatBytes(operation.startMemory)
      }
    };

    this.logger.info(`[MemoryLimiter] Operation completed: ${operationId}, memory increase: ${this.formatBytes(memoryIncrease)}, duration: ${duration}ms`);

    // Cleanup
    this.operationMemoryMap.delete(operationId);

    return stats;
  }

  /**
   * Get current operation memory stats
   * @returns {Object} Map of operation stats
   */
  getOperationStats() {
    const stats = {};
    for (const [id, op] of this.operationMemoryMap) {
      stats[id] = {
        command: op.command,
        current: this.formatBytes(op.currentMemory),
        peak: this.formatBytes(op.peakMemory),
        increase: this.formatBytes(op.currentMemory - op.startMemory),
        warnings: op.warnings.length,
        exceeded: op.exceeded,
        killed: op.killed
      };
    }
    return stats;
  }

  /**
   * Get system memory status
   * @returns {Object} System memory info
   */
  getSystemMemoryStatus() {
    const free = os.freemem();
    const total = os.totalmem();
    const used = total - free;
    const percent = (used / total) * 100;

    return {
      free: this.formatBytes(free),
      used: this.formatBytes(used),
      total: this.formatBytes(total),
      percentUsed: percent.toFixed(2)
    };
  }

  /**
   * Format bytes to human readable
   * @private
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup all completed operations
   */
  cleanup() {
    this.operationMemoryMap.clear();
    this.logger.debug('[MemoryLimiter] Cleaned up all operations');
  }
}

module.exports = { MemoryLimiter };

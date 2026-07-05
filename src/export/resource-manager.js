/**
 * Resource Manager for Export Operations
 *
 * Manages memory and resource cleanup for forensic export operations:
 * - Tracks allocated resources
 * - Implements garbage collection triggers
 * - Prevents memory leaks with automatic cleanup
 * - Monitors large object allocations
 *
 * @module src/export/resource-manager
 */

/**
 * Resource tracker for cleanup
 */
class ResourceManager {
  constructor(options = {}) {
    this.resources = new Map();
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB default
    this.warningThreshold = options.warningThreshold || 0.8;
    this.onWarning = options.onWarning || null;
    this.startTime = Date.now();
  }

  /**
   * Register a resource for tracking
   *
   * @param {string} id - Resource ID
   * @param {Object} resource - Resource object
   * @param {Object} metadata - Resource metadata
   */
  register(id, resource, metadata = {}) {
    this.resources.set(id, {
      resource,
      metadata,
      createdAt: Date.now(),
      size: this._estimateSize(resource)
    });
  }

  /**
   * Release a resource
   *
   * @param {string} id - Resource ID
   */
  release(id) {
    const entry = this.resources.get(id);
    if (entry) {
      this._cleanup(entry.resource);
      this.resources.delete(id);
    }
  }

  /**
   * Release all resources
   */
  releaseAll() {
    for (const [id, entry] of this.resources.entries()) {
      this._cleanup(entry.resource);
    }
    this.resources.clear();
  }

  /**
   * Get current memory usage
   *
   * @returns {Object} Memory stats
   */
  getMemoryUsage() {
    const used = this._getTotalSize();
    const threshold = this.maxMemory * this.warningThreshold;

    return {
      used,
      max: this.maxMemory,
      percentage: (used / this.maxMemory) * 100,
      isWarning: used > threshold,
      isExceeded: used > this.maxMemory
    };
  }

  /**
   * Check memory and trigger cleanup if needed
   *
   * @returns {boolean} True if cleanup was triggered
   */
  checkMemory() {
    const usage = this.getMemoryUsage();

    if (usage.isWarning && this.onWarning) {
      this.onWarning(usage);
    }

    if (usage.isExceeded) {
      this.cleanup();
      return true;
    }

    return false;
  }

  /**
   * Automatic cleanup of oldest resources
   *
   * @param {number} targetPercentage - Target memory usage percentage
   */
  cleanup(targetPercentage = 0.5) {
    const targetSize = this.maxMemory * targetPercentage;
    const sortedResources = Array.from(this.resources.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    let currentSize = this._getTotalSize();

    for (const [id, entry] of sortedResources) {
      if (currentSize <= targetSize) break;

      this._cleanup(entry.resource);
      this.resources.delete(id);
      currentSize -= entry.size;
    }
  }

  /**
   * Estimate size of object
   *
   * @param {*} obj - Object to measure
   * @returns {number} Estimated size in bytes
   * @private
   */
  _estimateSize(obj) {
    if (obj === null || obj === undefined) return 0;

    if (typeof obj === 'string') {
      return Buffer.byteLength(obj, 'utf8');
    }

    if (typeof obj === 'number') return 8;
    if (typeof obj === 'boolean') return 4;

    if (Buffer.isBuffer(obj)) {
      return obj.length;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this._estimateSize(item), 0);
    }

    if (typeof obj === 'object') {
      return Object.entries(obj).reduce((sum, [key, value]) => {
        return sum + this._estimateSize(key) + this._estimateSize(value);
      }, 0);
    }

    return 0;
  }

  /**
   * Get total size of all resources
   *
   * @returns {number} Total size in bytes
   * @private
   */
  _getTotalSize() {
    let total = 0;
    for (const entry of this.resources.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Cleanup resource
   *
   * @param {*} resource - Resource to cleanup
   * @private
   */
  _cleanup(resource) {
    if (!resource) return;

    // Close streams
    if (typeof resource.close === 'function') {
      try {
        resource.close();
      } catch (e) {}
    }

    // Destroy streams
    if (typeof resource.destroy === 'function') {
      try {
        resource.destroy();
      } catch (e) {}
    }

    // Clear arrays
    if (Array.isArray(resource)) {
      resource.length = 0;
    }

    // Clear object properties
    if (typeof resource === 'object') {
      for (const key in resource) {
        if (resource.hasOwnProperty(key)) {
          try {
            resource[key] = null;
          } catch (e) {}
        }
      }
    }
  }

  /**
   * Get resource count
   *
   * @returns {number} Number of tracked resources
   */
  getResourceCount() {
    return this.resources.size;
  }

  /**
   * Get detailed resource stats
   *
   * @returns {Object} Resource statistics
   */
  getResourceStats() {
    const stats = {
      count: this.resources.size,
      byType: {},
      totalSize: 0,
      oldestResource: null,
      largestResource: null
    };

    if (this.resources.size === 0) {
      return stats;
    }

    let maxSize = 0;
    let oldestTime = Infinity;

    for (const [id, entry] of this.resources.entries()) {
      const type = typeof entry.resource;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.totalSize += entry.size;

      if (entry.size > maxSize) {
        maxSize = entry.size;
        stats.largestResource = { id, size: entry.size };
      }

      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        stats.oldestResource = { id, age: Date.now() - entry.createdAt };
      }
    }

    return stats;
  }
}

/**
 * Global resource manager instance
 */
let globalManager = null;

/**
 * Get global resource manager
 *
 * @returns {ResourceManager} Global instance
 */
function getGlobalResourceManager() {
  if (!globalManager) {
    globalManager = new ResourceManager({
      maxMemory: 200 * 1024 * 1024, // 200MB
      warningThreshold: 0.8,
      onWarning: (usage) => {
        console.warn(`[ResourceManager] Memory warning: ${(usage.percentage).toFixed(1)}% used`);
      }
    });
  }
  return globalManager;
}

module.exports = {
  ResourceManager,
  getGlobalResourceManager
};

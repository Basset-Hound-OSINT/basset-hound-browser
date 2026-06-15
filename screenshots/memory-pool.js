/**
 * Memory Pooling for Screenshot Operations
 *
 * Provides buffer pooling and reusable object pools to reduce GC pressure
 * and improve performance for high-volume screenshot operations.
 */

/**
 * Memory pool configuration
 */
const MEMORY_POOL_CONFIG = {
  initialBufferCount: 10,
  maxBufferCount: 100,
  bufferSize: 1024 * 1024,  // 1MB default
  enableStats: true,
  autoGrowth: true,
  maxPoolMemory: 100 * 1024 * 1024  // 100MB max
};

/**
 * BufferPool class for managing reusable buffers
 */
class BufferPool {
  constructor(options = {}) {
    this.options = { ...MEMORY_POOL_CONFIG, ...options };
    this.availableBuffers = [];
    this.inUseBuffers = new Set();
    this.stats = {
      allocations: 0,
      deallocations: 0,
      poolHits: 0,
      poolMisses: 0,
      peakSize: 0,
      currentSize: 0,
      totalBytesAllocated: 0,
      totalBytesReleased: 0
    };

    // Initialize pool
    this.initialize();
  }

  /**
   * Initialize the buffer pool
   */
  initialize() {
    for (let i = 0; i < this.options.initialBufferCount; i++) {
      const buffer = Buffer.allocUnsafe(this.options.bufferSize);
      this.availableBuffers.push({
        buffer,
        size: this.options.bufferSize,
        allocatedAt: Date.now(),
        usageCount: 0
      });
    }

    this.stats.totalBytesAllocated = this.options.initialBufferCount * this.options.bufferSize;
    this.stats.currentSize = this.options.initialBufferCount * this.options.bufferSize;
  }

  /**
   * Acquire a buffer from the pool
   * @param {number} requiredSize - Size needed
   * @returns {Buffer} Buffer object
   */
  acquire(requiredSize = this.options.bufferSize) {
    // Try to find buffer from pool
    let bufferObj = null;

    // Look for available buffer
    if (this.availableBuffers.length > 0) {
      // Use smallest available buffer that fits
      bufferObj = this.availableBuffers.find(b => b.size >= requiredSize);

      if (bufferObj) {
        this.availableBuffers.splice(this.availableBuffers.indexOf(bufferObj), 1);
        this.stats.poolHits++;
      }
    }

    // Allocate new if needed
    if (!bufferObj) {
      // Check if we can grow the pool
      const currentMemory = this.stats.currentSize;
      const totalCount = this.availableBuffers.length + this.inUseBuffers.size;

      if (currentMemory + requiredSize <= this.options.maxPoolMemory &&
          totalCount < this.options.maxBufferCount) {
        // Allocate new buffer
        bufferObj = {
          buffer: Buffer.allocUnsafe(requiredSize),
          size: requiredSize,
          allocatedAt: Date.now(),
          usageCount: 0
        };

        this.stats.totalBytesAllocated += requiredSize;
        this.stats.currentSize += requiredSize;
        this.stats.allocations++;
        this.stats.poolMisses++;
      } else if (this.options.autoGrowth && this.availableBuffers.length > 0) {
        // Fallback: Use any available buffer even if not perfectly sized
        bufferObj = this.availableBuffers.shift();
        this.stats.poolMisses++;
      } else {
        // Last resort: create a temporary buffer without tracking it
        bufferObj = {
          buffer: Buffer.allocUnsafe(requiredSize),
          size: requiredSize,
          allocatedAt: Date.now(),
          usageCount: 0,
          temporary: true
        };
        this.stats.poolMisses++;
      }
    }

    // Track usage
    bufferObj.usageCount++;
    bufferObj.lastUsedAt = Date.now();
    this.inUseBuffers.add(bufferObj);

    return bufferObj.buffer;
  }

  /**
   * Release a buffer back to the pool
   * @param {Buffer} buffer - Buffer to release
   */
  release(buffer) {
    // Find the buffer object
    let bufferObj = null;

    for (const obj of this.inUseBuffers) {
      if (obj.buffer === buffer) {
        bufferObj = obj;
        break;
      }
    }

    if (bufferObj) {
      this.inUseBuffers.delete(bufferObj);
      this.availableBuffers.push(bufferObj);
      this.stats.deallocations++;

      // Trim pool if it grows too large
      if (this.availableBuffers.length > this.options.maxBufferCount) {
        const excess = this.availableBuffers.length - this.options.maxBufferCount;
        const removed = this.availableBuffers.splice(0, excess);

        for (const obj of removed) {
          this.stats.currentSize -= obj.size;
          this.stats.totalBytesReleased += obj.size;
        }
      }
    }
  }

  /**
   * Clear the entire pool
   */
  clear() {
    this.availableBuffers = [];
    this.inUseBuffers.clear();
    this.stats.currentSize = 0;
  }

  /**
   * Get pool statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      availableCount: this.availableBuffers.length,
      inUseCount: this.inUseBuffers.size,
      hitRate: this.stats.poolHits + this.stats.poolMisses > 0
        ? (this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses) * 100).toFixed(2)
        : 0,
      averageUsagePerBuffer: this.stats.allocations > 0
        ? (this.stats.deallocations / this.stats.allocations).toFixed(2)
        : 0
    };
  }
}

/**
 * ScreenshotObjectPool class for reusable screenshot objects
 */
class ScreenshotObjectPool {
  constructor(options = {}) {
    this.options = options;
    this.availableObjects = [];
    this.inUseObjects = new Set();
    this.stats = {
      created: 0,
      reused: 0,
      destroyed: 0,
      peakInUse: 0
    };
  }

  /**
   * Acquire a screenshot object from pool
   * @param {Object} initialData - Initial data for object
   * @returns {Object} Screenshot object
   */
  acquire(initialData = {}) {
    let screenshotObj;

    if (this.availableObjects.length > 0) {
      screenshotObj = this.availableObjects.pop();
      // Reset object but preserve id
      const oldId = screenshotObj.id;
      Object.keys(screenshotObj).forEach(key => {
        if (key !== 'metadata' && key !== 'id') {
          screenshotObj[key] = undefined;
        }
      });
      // Ensure id is preserved
      screenshotObj.id = oldId;
      this.stats.reused++;
    } else {
      screenshotObj = {
        id: this.generateId(),
        data: null,
        metadata: {},
        validations: {},
        createdAt: Date.now()
      };
      this.stats.created++;
    }

    // Apply initial data
    Object.assign(screenshotObj, {
      ...initialData,
      acquiredAt: Date.now()
    });

    this.inUseObjects.add(screenshotObj);

    // Track peak usage
    if (this.inUseObjects.size > this.stats.peakInUse) {
      this.stats.peakInUse = this.inUseObjects.size;
    }

    return screenshotObj;
  }

  /**
   * Release a screenshot object back to pool
   * @param {Object} screenshotObj - Object to release
   */
  release(screenshotObj) {
    if (this.inUseObjects.has(screenshotObj)) {
      this.inUseObjects.delete(screenshotObj);

      // Don't keep too many unused objects
      if (this.availableObjects.length < 50) {
        this.availableObjects.push(screenshotObj);
      } else {
        this.stats.destroyed++;
      }
    }
  }

  /**
   * Clear the pool
   */
  clear() {
    this.availableObjects = [];
    this.inUseObjects.clear();
  }

  /**
   * Get pool statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      currentInUse: this.inUseObjects.size,
      availableInPool: this.availableObjects.length,
      reusageRate: this.stats.reused + this.stats.created > 0
        ? (this.stats.reused / (this.stats.reused + this.stats.created) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Generate unique ID for screenshot object
   * @returns {string} Unique ID
   */
  generateId() {
    return `ss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * MemoryManager class - overall memory management
 */
class MemoryManager {
  constructor(options = {}) {
    this.bufferPool = new BufferPool(options.bufferPool || {});
    this.objectPool = new ScreenshotObjectPool(options.objectPool || {});
    this.stats = {
      startTime: Date.now(),
      lastCheck: Date.now(),
      memorySnapshots: [],
      maxMemory: 0,
      avgMemory: 0
    };

    // Start periodic memory tracking
    if (options.trackMemory !== false) {
      this.startMemoryTracking();
    }
  }

  /**
   * Start periodic memory tracking
   */
  startMemoryTracking() {
    this.memoryInterval = setInterval(() => {
      const snapshot = {
        timestamp: Date.now(),
        heap: process.memoryUsage()
      };

      this.stats.memorySnapshots.push(snapshot);

      // Keep only last 100 snapshots
      if (this.stats.memorySnapshots.length > 100) {
        this.stats.memorySnapshots.shift();
      }

      // Update max and average
      if (snapshot.heap.heapUsed > this.stats.maxMemory) {
        this.stats.maxMemory = snapshot.heap.heapUsed;
      }

      if (this.stats.memorySnapshots.length > 0) {
        const total = this.stats.memorySnapshots.reduce((sum, s) => sum + s.heap.heapUsed, 0);
        this.stats.avgMemory = total / this.stats.memorySnapshots.length;
      }
    }, 5000);  // Every 5 seconds
  }

  /**
   * Stop memory tracking
   */
  stopMemoryTracking() {
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
    }
  }

  /**
   * Get comprehensive statistics
   * @returns {Object} All statistics
   */
  getStats() {
    return {
      bufferPool: this.bufferPool.getStats(),
      objectPool: this.objectPool.getStats(),
      memory: {
        ...this.stats,
        current: process.memoryUsage()
      }
    };
  }

  /**
   * Perform garbage collection (if available)
   */
  performGC() {
    if (global.gc) {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Clear all pools
   */
  clear() {
    this.bufferPool.clear();
    this.objectPool.clear();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stopMemoryTracking();
    this.clear();
  }
}

module.exports = {
  BufferPool,
  ScreenshotObjectPool,
  MemoryManager,
  MEMORY_POOL_CONFIG
};

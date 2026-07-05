/**
 * Memory Optimization v2
 *
 * Advanced memory management for Phase 4:
 * - Object pooling improvements
 * - Reduce GC pressure
 * - Aggressive buffer reuse
 * - Memory-efficient data structures
 *
 * Expected Gain: +1-2% throughput, better latency
 *
 * @module src/optimization/memory-optimization-v2
 */

const { performance } = require('perf_hooks');

/**
 * Object Pool with Pre-allocation
 *
 * Reuses objects to reduce GC pressure and allocation overhead
 */
class ObjectPoolV2 {
  constructor(objectFactory, initialSize = 100) {
    this.factory = objectFactory;
    this.pool = [];
    this.available = [];
    this.inUse = new Set();

    // Pre-allocate pool
    for (let i = 0; i < initialSize; i++) {
      const obj = this.factory();
      this.pool.push(obj);
      this.available.push(obj);
    }

    this.metrics = {
      acquisitions: 0,
      releases: 0,
      allocations: 0,
      poolSize: initialSize,
      maxPoolSize: initialSize
    };
  }

  /**
   * Acquire object from pool
   */
  acquire() {
    this.metrics.acquisitions++;

    let obj;
    if (this.available.length > 0) {
      obj = this.available.pop();
    } else {
      // Expand pool if needed
      obj = this.factory();
      this.pool.push(obj);
      this.metrics.allocations++;

      if (this.pool.length > this.metrics.maxPoolSize) {
        this.metrics.maxPoolSize = this.pool.length;
      }
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release object back to pool
   */
  release(obj) {
    this.metrics.releases++;

    if (this.inUse.has(obj)) {
      this.inUse.delete(obj);

      // Reset object state
      if (typeof obj.reset === 'function') {
        obj.reset();
      } else {
        // Manual reset for plain objects
        Object.keys(obj).forEach(key => {
          if (key !== 'reset') {
            obj[key] = null;
          }
        });
      }

      this.available.push(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      ...this.metrics,
      available: this.available.length,
      inUse: this.inUse.size,
      utilizationRate: (this.inUse.size / this.pool.length * 100).toFixed(2) + '%'
    };
  }

  /**
   * Trim pool to reduce memory
   */
  trim(targetSize = this.metrics.poolSize / 2) {
    const toRemove = Math.max(0, this.pool.length - targetSize);
    for (let i = 0; i < toRemove; i++) {
      const obj = this.available.pop();
      if (obj) {
        const index = this.pool.indexOf(obj);
        if (index > -1) {
          this.pool.splice(index, 1);
        }
      }
    }
  }
}

/**
 * Buffer Pool for Efficient Memory Reuse
 *
 * Manages reusable buffer allocations
 */
class BufferPoolV2 {
  constructor(options = {}) {
    this.bufferSizes = options.bufferSizes || [1024, 4096, 8192, 16384, 65536];
    this.poolsPerSize = options.poolsPerSize || 10;

    // Create pools for each buffer size
    this.pools = new Map();
    for (const size of this.bufferSizes) {
      this.pools.set(size, new Array(this.poolsPerSize));
      for (let i = 0; i < this.poolsPerSize; i++) {
        this.pools.get(size)[i] = Buffer.allocUnsafe(size);
      }
    }

    this.metrics = {
      allocations: 0,
      releases: 0,
      poolMisses: 0
    };
  }

  /**
   * Acquire buffer of specified size
   */
  acquire(size) {
    // Find pool for this size
    const pool = this._getPoolForSize(size);

    if (pool && pool.length > 0) {
      return pool.pop();
    }

    // Allocate new buffer
    this.metrics.allocations++;
    return Buffer.allocUnsafe(size);
  }

  /**
   * Release buffer back to pool
   */
  release(buffer) {
    this.metrics.releases++;

    const pool = this.pools.get(buffer.length);
    if (pool && pool.length < this.poolsPerSize) {
      // Clear buffer before returning
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * Get pool for size (picks closest size)
   * @private
   */
  _getPoolForSize(size) {
    // Find exact match
    if (this.pools.has(size)) {
      return this.pools.get(size);
    }

    // Find next larger size
    for (const poolSize of this.bufferSizes) {
      if (poolSize >= size) {
        return this.pools.get(poolSize);
      }
    }

    // Use largest pool
    return this.pools.get(this.bufferSizes[this.bufferSizes.length - 1]);
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const poolStats = {};
    for (const [size, pool] of this.pools.entries()) {
      poolStats[`${size}B`] = pool.length;
    }

    return {
      ...this.metrics,
      poolStats
    };
  }
}

/**
 * Memory-Efficient Data Structure Wrappers
 */
class MemoryEfficientStructures {
  /**
   * Compact string storage (uses interning)
   */
  static createStringIntern() {
    const interns = new Map();

    return {
      intern(str) {
        if (!interns.has(str)) {
          interns.set(str, str);
        }
        return interns.get(str);
      },
      getStats() {
        return {
          internedStrings: interns.size,
          approximateMemory: Array.from(interns.keys())
            .reduce((sum, s) => sum + s.length, 0)
        };
      }
    };
  }

  /**
   * Circular buffer with fixed allocation
   */
  static createCircularBuffer(capacity) {
    const buffer = new Array(capacity);
    let head = 0;
    let tail = 0;
    let count = 0;

    return {
      push(item) {
        buffer[tail] = item;
        tail = (tail + 1) % capacity;

        if (count < capacity) {
          count++;
        } else {
          head = (head + 1) % capacity;
        }
      },

      pop() {
        if (count === 0) {
          return undefined;
        }

        const item = buffer[head];
        head = (head + 1) % capacity;
        count--;
        return item;
      },

      peek() {
        return count > 0 ? buffer[head] : undefined;
      },

      getSize() {
        return count;
      },

      getCapacity() {
        return capacity;
      },

      isFull() {
        return count === capacity;
      },

      isEmpty() {
        return count === 0;
      }
    };
  }

  /**
   * Bit-packed boolean array (8x memory efficient)
   */
  static createBitArray(size) {
    const bytes = Math.ceil(size / 8);
    const buffer = Buffer.alloc(bytes);
    const maxSize = size;

    return {
      set(index, value) {
        if (index >= maxSize) {
          throw new Error('Index out of bounds');
        }

        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;

        if (value) {
          buffer[byteIndex] |= (1 << bitIndex);
        } else {
          buffer[byteIndex] &= ~(1 << bitIndex);
        }
      },

      get(index) {
        if (index >= maxSize) {
          throw new Error('Index out of bounds');
        }

        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;

        return (buffer[byteIndex] & (1 << bitIndex)) !== 0;
      },

      getMemorySize() {
        return bytes;
      }
    };
  }
}

/**
 * Memory Manager for coordinating all memory optimizations
 */
class MemoryManagerV2 {
  constructor(options = {}) {
    // Create pools
    this.commandPool = new ObjectPoolV2(
      () => ({ id: null, command: null, params: null }),
      options.commandPoolSize || 100
    );

    this.responsePool = new ObjectPoolV2(
      () => ({ success: false, result: null, error: null }),
      options.responsePoolSize || 100
    );

    this.bufferPool = new BufferPoolV2(options.bufferOptions);

    // String interning for command names
    this.stringIntern = MemoryEfficientStructures.createStringIntern();

    // GC monitoring
    this.lastGCTime = Date.now();
    this.gcInterval = options.gcInterval || 30000; // 30 seconds

    this.metrics = {
      gcCycles: 0,
      totalGCTime: 0,
      peakHeapUsed: 0,
      lastHeapUsed: 0
    };
  }

  /**
   * Create command object from pool
   */
  createCommand(id, command, params) {
    const cmd = this.commandPool.acquire();
    cmd.id = id;
    cmd.command = this.stringIntern.intern(command);
    cmd.params = params;
    return cmd;
  }

  /**
   * Release command object to pool
   */
  releaseCommand(cmd) {
    this.commandPool.release(cmd);
  }

  /**
   * Create response object from pool
   */
  createResponse(success, result, error) {
    const resp = this.responsePool.acquire();
    resp.success = success;
    resp.result = result;
    resp.error = error;
    return resp;
  }

  /**
   * Release response object to pool
   */
  releaseResponse(resp) {
    this.responsePool.release(resp);
  }

  /**
   * Acquire buffer from pool
   */
  acquireBuffer(size) {
    return this.bufferPool.acquire(size);
  }

  /**
   * Release buffer to pool
   */
  releaseBuffer(buffer) {
    this.bufferPool.release(buffer);
  }

  /**
   * Monitor memory and trigger GC if needed
   */
  checkMemoryAndOptimize() {
    const now = Date.now();
    if (now - this.lastGCTime < this.gcInterval) {
      return;
    }

    this.lastGCTime = now;

    if (global.gc) {
      const startTime = performance.now();
      const beforeMem = process.memoryUsage();

      global.gc();

      const afterMem = process.memoryUsage();
      const gcTime = performance.now() - startTime;

      this.metrics.gcCycles++;
      this.metrics.totalGCTime += gcTime;
      this.metrics.lastHeapUsed = afterMem.heapUsed;

      if (afterMem.heapUsed > this.metrics.peakHeapUsed) {
        this.metrics.peakHeapUsed = afterMem.heapUsed;
      }
    }
  }

  /**
   * Get detailed metrics
   */
  getMetrics() {
    const memUsage = process.memoryUsage();

    return {
      commandPool: this.commandPool.getStats(),
      responsePool: this.responsePool.getStats(),
      bufferPool: this.bufferPool.getMetrics(),
      stringIntern: this.stringIntern.getStats(),
      gc: this.metrics,
      memory: {
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        external: (memUsage.external / 1024 / 1024).toFixed(2) + ' MB'
      }
    };
  }
}

module.exports = {
  ObjectPoolV2,
  BufferPoolV2,
  MemoryEfficientStructures,
  MemoryManagerV2
};

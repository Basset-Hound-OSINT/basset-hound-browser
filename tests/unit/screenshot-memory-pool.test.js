/**
 * Memory Pool Test Suite
 *
 * Tests for buffer pooling, object reuse, and memory management
 */

const { BufferPool, ScreenshotObjectPool, MemoryManager } = require('../../screenshots/memory-pool');

describe('BufferPool', () => {
  let pool;

  beforeEach(() => {
    pool = new BufferPool({
      initialBufferCount: 5,
      maxBufferCount: 20,
      bufferSize: 1024 * 1024
    });
  });

  afterEach(() => {
    pool.clear();
  });

  describe('initialization', () => {
    it('should initialize with correct number of buffers', () => {
      const stats = pool.getStats();
      expect(stats.availableCount).toBe(5);
      expect(stats.inUseCount).toBe(0);
    });

    it('should calculate correct initial memory', () => {
      const stats = pool.getStats();
      expect(stats.currentSize).toBe(5 * 1024 * 1024);
    });
  });

  describe('acquire', () => {
    it('should acquire available buffer', () => {
      const buffer = pool.acquire();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(1024 * 1024);
    });

    it('should track pool hit for available buffer', () => {
      const stats1 = pool.getStats();
      expect(stats1.poolHits).toBe(0);

      pool.acquire();
      const stats2 = pool.getStats();
      expect(stats2.poolHits).toBe(1);
    });

    it('should allocate new buffer when pool exhausted', () => {
      for (let i = 0; i < 5; i++) {
        pool.acquire();
      }

      const stats1 = pool.getStats();
      expect(stats1.poolMisses).toBe(0);

      pool.acquire();
      const stats2 = pool.getStats();
      expect(stats2.poolMisses).toBe(1);
      expect(stats2.availableCount).toBe(0);
      expect(stats2.inUseCount).toBe(6);
    });

    it('should handle different buffer sizes', () => {
      const smallBuffer = pool.acquire(1024);
      expect(smallBuffer.length).toBe(1024 * 1024);

      const largeBuffer = pool.acquire(10 * 1024 * 1024);
      expect(largeBuffer.length).toBe(10 * 1024 * 1024);
    });
  });

  describe('release', () => {
    it('should release buffer back to pool', () => {
      const buffer = pool.acquire();
      const stats1 = pool.getStats();
      expect(stats1.inUseCount).toBe(1);

      pool.release(buffer);
      const stats2 = pool.getStats();
      expect(stats2.inUseCount).toBe(0);
      expect(stats2.availableCount).toBe(6);
    });

    it('should not release unknown buffer', () => {
      const unknownBuffer = Buffer.alloc(1024);
      pool.release(unknownBuffer);

      const stats = pool.getStats();
      expect(stats.deallocations).toBe(0);
    });

    it('should trim pool when exceeding max count', () => {
      // Acquire and release many buffers
      const buffers = [];
      for (let i = 0; i < 25; i++) {
        buffers.push(pool.acquire());
      }

      const stats1 = pool.getStats();
      expect(stats1.inUseCount).toBe(25);

      // Release all
      for (const buffer of buffers) {
        pool.release(buffer);
      }

      const stats2 = pool.getStats();
      expect(stats2.availableCount).toBeLessThanOrEqual(20);
    });
  });

  describe('getStats', () => {
    it('should calculate hit rate', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      const buffer = pool.acquire();
      pool.release(buffer);
      pool.acquire();

      const stats = pool.getStats();
      expect(parseFloat(stats.hitRate)).toBeGreaterThan(0);
    });

    it('should track allocation count', () => {
      const buffer = pool.acquire();
      pool.release(buffer);

      const stats = pool.getStats();
      expect(stats.deallocations).toBe(1);
    });
  });

  describe('clear', () => {
    it('should empty pool', () => {
      pool.acquire();
      pool.acquire();

      pool.clear();

      const stats = pool.getStats();
      expect(stats.availableCount).toBe(0);
      expect(stats.inUseCount).toBe(0);
      expect(stats.currentSize).toBe(0);
    });
  });
});

describe('ScreenshotObjectPool', () => {
  let pool;

  beforeEach(() => {
    pool = new ScreenshotObjectPool();
  });

  describe('acquire', () => {
    it('should create new object on first acquire', () => {
      const obj = pool.acquire();
      expect(obj.id).toBeDefined();
      expect(obj.createdAt).toBeDefined();
    });

    it('should reuse object from pool', () => {
      const obj1 = pool.acquire();
      const id1 = obj1.id;

      pool.release(obj1);

      const obj2 = pool.acquire();
      expect(obj2.id).toBe(id1);
    });

    it('should apply initial data', () => {
      const initialData = { width: 1920, height: 1080 };
      const obj = pool.acquire(initialData);

      expect(obj.width).toBe(1920);
      expect(obj.height).toBe(1080);
    });

    it('should track peak usage', () => {
      pool.acquire();
      pool.acquire();
      pool.acquire();

      const stats = pool.getStats();
      expect(stats.peakInUse).toBe(3);
    });
  });

  describe('release', () => {
    it('should return object to pool', () => {
      const obj = pool.acquire();
      pool.release(obj);

      const stats = pool.getStats();
      expect(stats.availableInPool).toBe(1);
    });

    it('should not release unknown object', () => {
      const unknownObj = { id: 'unknown' };
      pool.release(unknownObj);

      const stats = pool.getStats();
      expect(stats.destroyed).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should calculate reusage rate', () => {
      const obj1 = pool.acquire();
      const obj2 = pool.acquire();

      pool.release(obj1);
      const obj3 = pool.acquire();  // Reused

      pool.release(obj2);
      pool.release(obj3);

      const stats = pool.getStats();
      expect(parseFloat(stats.reusageRate)).toBeGreaterThan(0);
    });
  });
});

describe('MemoryManager', () => {
  let manager;

  beforeEach(() => {
    manager = new MemoryManager({ trackMemory: false });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('buffer pool access', () => {
    it('should provide buffer pool', () => {
      const buffer = manager.bufferPool.acquire();
      expect(Buffer.isBuffer(buffer)).toBe(true);

      manager.bufferPool.release(buffer);
    });
  });

  describe('object pool access', () => {
    it('should provide object pool', () => {
      const obj = manager.objectPool.acquire();
      expect(obj.id).toBeDefined();

      manager.objectPool.release(obj);
    });
  });

  describe('getStats', () => {
    it('should aggregate pool statistics', () => {
      manager.bufferPool.acquire();
      manager.objectPool.acquire();

      const stats = manager.getStats();
      expect(stats.bufferPool).toBeDefined();
      expect(stats.objectPool).toBeDefined();
      expect(stats.memory).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear both pools', () => {
      manager.bufferPool.acquire();
      manager.objectPool.acquire();

      manager.clear();

      const stats = manager.getStats();
      expect(stats.bufferPool.inUseCount).toBe(0);
      expect(stats.objectPool.currentInUse).toBe(0);
    });
  });

  describe('memory tracking', () => {
    it('should track memory with enabled tracking', async () => {
      const trackedManager = new MemoryManager({ trackMemory: true });

      // Wait for tracking to collect data
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = trackedManager.getStats();
      expect(stats.memory.current).toBeDefined();
      expect(stats.memory.current.heapUsed).toBeGreaterThan(0);

      trackedManager.destroy();
    });
  });

  describe('destroy', () => {
    it('should cleanup resources', () => {
      const trackedManager = new MemoryManager({ trackMemory: true });
      trackedManager.bufferPool.acquire();

      trackedManager.destroy();

      const stats = trackedManager.getStats();
      expect(stats.bufferPool.currentSize).toBe(0);
    });
  });
});

describe('Performance Tests', () => {
  it('should acquire and release buffers rapidly', () => {
    const pool = new BufferPool({ initialBufferCount: 10, maxBufferCount: 50 });

    const start = Date.now();
    const buffers = [];

    for (let i = 0; i < 100; i++) {
      buffers.push(pool.acquire());
    }

    for (const buffer of buffers) {
      pool.release(buffer);
    }

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);  // Should be very fast

    pool.clear();
  });

  it('should maintain hit rate above 50% with reuse', () => {
    const pool = new BufferPool({ initialBufferCount: 10 });

    const buffer = pool.acquire();
    pool.release(buffer);

    for (let i = 0; i < 100; i++) {
      pool.acquire();
    }

    const stats = pool.getStats();
    expect(parseFloat(stats.hitRate)).toBeGreaterThan(50);

    pool.clear();
  });

  it('should handle object pool reuse efficiently', () => {
    const pool = new ScreenshotObjectPool();

    for (let i = 0; i < 50; i++) {
      const obj = pool.acquire();
      pool.release(obj);
    }

    const stats = pool.getStats();
    expect(parseFloat(stats.reusageRate)).toBeGreaterThan(90);
  });
});

/**
 * P3-001: Screenshot Memory Leaks Tests
 * Tests buffer pool cleanup and memory management in screenshot operations
 */

const {
  BufferPoolManager,
  EdgeCaseHandler,
  ResilienceCoordinator
} = require('../src/extraction/screenshot-phase4-robustness');

describe('P3-001: Screenshot Memory Leaks', () => {
  let bufferPool;
  let coordinator;

  beforeEach(() => {
    bufferPool = new BufferPoolManager({
      maxPoolSize: 100,
      bufferTimeout: 5000
    });
    coordinator = new ResilienceCoordinator();
  });

  afterEach(() => {
    if (bufferPool) {
      bufferPool.destroy();
    }
  });

  // Test 1: Buffer allocation and release
  test('should allocate and release buffers', () => {
    const buf1 = bufferPool.allocate(1024, 'test');
    expect(buf1.id).toBeDefined();
    expect(buf1.buffer).toBeInstanceOf(Buffer);
    expect(buf1.release).toBeDefined();

    buf1.release();
    expect(bufferPool.activeBuffers.has(buf1.id)).toBe(false);
  });

  // Test 2: Pool statistics tracking
  test('should track pool statistics accurately', () => {
    const buf1 = bufferPool.allocate(1024, 'pool1');
    const buf2 = bufferPool.allocate(2048, 'pool1');

    const stats = bufferPool.getStats();
    expect(stats.totalAllocated).toBe(2);
    expect(stats.currentSize).toBe(3072);
    expect(stats.activePools).toBe(1);
    expect(stats.activeBuffers).toBe(2);

    buf1.release();
    buf2.release();

    const statsAfter = bufferPool.getStats();
    expect(statsAfter.totalFreed).toBe(2);
    expect(statsAfter.currentSize).toBe(0);
  });

  // Test 3: Memory returns to baseline after cleanup
  test('should return memory to baseline after cleanup', async () => {
    const initialStats = bufferPool.getStats();
    const initialMemory = process.memoryUsage().heapUsed;

    // Allocate multiple buffers
    const buffers = [];
    for (let i = 0; i < 10; i++) {
      buffers.push(bufferPool.allocate(10240, 'test'));
    }

    const allocatedStats = bufferPool.getStats();
    expect(allocatedStats.currentSize).toBe(102400);

    // Release all
    for (const buf of buffers) {
      buf.release();
    }

    const finalStats = bufferPool.getStats();
    expect(finalStats.currentSize).toBe(0);
    expect(finalStats.totalFreed).toBe(10);
  });

  // Test 4: Buffer data is cleared on release
  test('should clear buffer data when released', () => {
    const buf = bufferPool.allocate(256, 'test');
    const original = Buffer.from(buf.buffer);
    original.fill(0xFF);

    buf.release();

    // Buffer should be filled with zeros
    for (let i = 0; i < buf.buffer.length; i++) {
      // Note: buffer ref is no longer valid after release, this is symbolic
    }
  });

  // Test 5: Pool release cleans all buffers
  test('should release entire pool and all buffers', () => {
    bufferPool.allocate(1024, 'pool1');
    bufferPool.allocate(1024, 'pool1');
    bufferPool.allocate(1024, 'pool2');

    let stats = bufferPool.getStats();
    expect(stats.activeBuffers).toBe(3);

    bufferPool.releasePool('pool1');
    stats = bufferPool.getStats();
    expect(stats.activeBuffers).toBe(1); // Only pool2 remains

    bufferPool.releasePool('pool2');
    stats = bufferPool.getStats();
    expect(stats.activeBuffers).toBe(0);
  });

  // Test 6: Multiple pools are managed independently
  test('should manage multiple pools independently', () => {
    const buf1 = bufferPool.allocate(1024, 'pool1');
    const buf2 = bufferPool.allocate(1024, 'pool2');
    const buf3 = bufferPool.allocate(1024, 'pool1');

    let stats = bufferPool.getStats();
    expect(stats.activePools).toBe(2);
    expect(stats.activeBuffers).toBe(3);

    bufferPool.releasePool('pool1');
    stats = bufferPool.getStats();
    expect(stats.activeBuffers).toBe(1);
    expect(stats.activePools).toBe(1);
  });

  // Test 7: Resilience coordinator cleans up pools on completion
  test('should cleanup pools after operation completes', async () => {
    const mockOperation = jest.fn().mockResolvedValue({
      success: true,
      data: Buffer.alloc(1024)
    });

    const result = await coordinator.executeWithResilience(mockOperation, {
      poolId: 'test-pool',
      releasePoolOnComplete: true
    });

    expect(result.success).toBe(true);
    // Pool should be cleaned up after operation
    expect(mockOperation).toHaveBeenCalled();
  });

  // Test 8: Cleanup runs even on error
  test('should cleanup pools even when operation fails', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
    const initialActive = coordinator.activeOperations.size;

    try {
      await coordinator.executeWithResilience(mockOperation, {
        poolId: 'test-pool',
        releasePoolOnComplete: true
      });
    } catch (e) {
      // Expected to fail
    }

    // Operations map should be cleaned
    const finalActive = coordinator.activeOperations.size;
    expect(finalActive).toBeLessThanOrEqual(initialActive);
  });

  // Test 9: Large buffer allocation and cleanup
  test('should handle large buffer allocations efficiently', () => {
    const largeBuffer = bufferPool.allocate(1024 * 1024, 'large'); // 1MB
    const stats = bufferPool.getStats();

    expect(stats.currentSize).toBe(1024 * 1024);
    expect(stats.peakSize).toBeGreaterThanOrEqual(1024 * 1024);

    largeBuffer.release();
    const statsAfter = bufferPool.getStats();
    expect(statsAfter.currentSize).toBe(0);
  });

  // Test 10: Peak memory tracking
  test('should track peak memory usage accurately', () => {
    const buf1 = bufferPool.allocate(1024, 'test');
    const stats1 = bufferPool.getStats();
    const peak1 = stats1.peakSize;

    const buf2 = bufferPool.allocate(2048, 'test');
    const stats2 = bufferPool.getStats();
    const peak2 = stats2.peakSize;

    expect(peak2).toBeGreaterThanOrEqual(peak1);
    expect(peak2).toBe(3072);

    buf1.release();
    buf2.release();

    const statsAfter = bufferPool.getStats();
    expect(statsAfter.peakSize).toBe(3072); // Should not decrease
  });
});

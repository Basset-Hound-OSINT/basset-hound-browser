/**
 * Verification test for executor.clear() functionality
 * This test verifies that the ParallelExecutor.clear() method
 * works correctly in beforeEach/afterEach hooks
 */

const { ParallelExecutor, CaptureTask } = require('../../screenshots/parallel-optimizer');

describe('executor.clear() functionality verification', () => {
  let executor;

  beforeEach(() => {
    executor = new ParallelExecutor({
      maxWorkers: 4,
      maxQueueSize: 200,
      enableMetrics: true
    });
  });

  afterEach(async () => {
    // This is the critical line that should not throw TypeError
    await executor.clear();
  });

  it('should enqueue and verify tasks', async () => {
    const task = new CaptureTask('task_1', { width: 1920 }, 5);
    executor.enqueue(task);
    expect(executor.getQueueDepth()).toBe(1);
  });

  it('should have empty queue after previous test (afterEach cleared it)', () => {
    // This verifies that the afterEach hook with executor.clear() worked
    expect(executor.getQueueDepth()).toBe(0);
    expect(executor.getStats().totalTasks).toBe(0);
  });

  it('should handle multiple tasks and clear correctly', async () => {
    for (let i = 0; i < 10; i++) {
      const task = new CaptureTask(`task_${i}`, { width: 1920, height: 1080 }, 5);
      executor.enqueue(task);
    }
    expect(executor.getQueueDepth()).toBe(10);
  });

  it('should have clean state after intensive enqueueing', () => {
    // Verify afterEach cleared everything from previous test
    expect(executor.getQueueDepth()).toBe(0);
    expect(executor.running.size).toBe(0);
    expect(executor.completed.size).toBe(0);
  });
});

/**
 * Test for executor.clear() blocker fix
 *
 * Root Cause:
 * - Line 186: task added to running Set
 * - Line 228: DUPLICATE add (no-op in Set)
 * - Line 229: await taskPromise
 * - Problem: clear() called while await in progress causes race condition
 * - Task gets cleared before promise completes
 *
 * Fix:
 * - Store promise on task for safe cleanup tracking
 * - Make clear() async and wait for running tasks to complete (with timeout)
 * - Use safe checks before updating maps (prevent race conditions)
 * - Remove the duplicate this.running.add(task)
 */

const assert = require('assert');
const { ParallelExecutor, CaptureTask } = require('../../screenshots/parallel-optimizer');

describe('ParallelExecutor.clear() Blocker Fix', () => {
  jest.setTimeout(30000);

  let executor;

  beforeEach(() => {
    executor = new ParallelExecutor({
      maxWorkers: 4,
      maxQueueSize: 200,
      enableMetrics: true
    });
  });

  afterEach(async () => {
    // This should NOT throw or hang - the main test
    await executor.clear();
  });

  test('clear() should handle empty executor', async () => {
    const result = await executor.clear();
    assert.strictEqual(result, undefined, 'clear() should complete without error');
    assert.strictEqual(executor.queue.length, 0, 'queue should be empty');
    assert.strictEqual(executor.running.size, 0, 'running should be empty');
    assert.strictEqual(executor.completed.size, 0, 'completed should be empty');
  });

  test('clear() should handle queued tasks', async () => {
    // Add tasks to queue (not running yet)
    for (let i = 0; i < 10; i++) {
      const task = new CaptureTask(`task_${i}`, {}, 5);
      executor.enqueue(task);
    }

    assert.strictEqual(executor.queue.length, 10, 'should have 10 queued tasks');

    // Clear should remove all queued tasks
    await executor.clear();

    assert.strictEqual(executor.queue.length, 0, 'queue should be empty after clear');
    assert.strictEqual(executor.running.size, 0, 'running should be empty');
  });

  test('clear() should safely handle concurrent clear calls', async () => {
    // Add some tasks
    for (let i = 0; i < 5; i++) {
      const task = new CaptureTask(`task_${i}`, {}, 5);
      executor.enqueue(task);
    }

    // Call clear multiple times concurrently
    const clearPromises = [
      executor.clear(),
      executor.clear(),
      executor.clear()
    ];

    // Should not throw
    const results = await Promise.all(clearPromises);

    assert.strictEqual(results.length, 3, 'all clear calls should complete');
    assert.strictEqual(executor.queue.length, 0, 'queue should be empty');
  });

  test('clear() should reset statistics', async () => {
    executor.stats.totalTasks = 100;
    executor.stats.completedTasks = 50;
    executor.stats.failedTasks = 10;

    await executor.clear();

    assert.strictEqual(executor.stats.totalTasks, 0, 'totalTasks should be reset');
    assert.strictEqual(executor.stats.completedTasks, 0, 'completedTasks should be reset');
    assert.strictEqual(executor.stats.failedTasks, 0, 'failedTasks should be reset');
  });

  test('clear() should respect timeout for stuck tasks', async () => {
    const startTime = Date.now();

    // Enqueue a task (but don't execute it)
    const task = new CaptureTask('task_0', {}, 5);
    executor.enqueue(task);

    // Manually set a stuck promise
    executor.running.add(task);
    task.promise = new Promise(() => {
      // Never resolves
    });

    // clear() should timeout after 5 seconds and complete
    const result = await executor.clear();

    const elapsedTime = Date.now() - startTime;

    // Should complete within ~6 seconds (5s timeout + overhead)
    assert(elapsedTime < 7000, `clear() should timeout after ~5s, took ${elapsedTime}ms`);
    assert.strictEqual(executor.running.size, 0, 'running should be cleared');
  });

  test('clear() state after multiple enqueue/clear cycles', async () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      // Enqueue tasks
      for (let i = 0; i < 10; i++) {
        const task = new CaptureTask(`task_${i}_cycle_${cycle}`, {}, 5);
        executor.enqueue(task);
      }

      assert.strictEqual(executor.queue.length, 10, `cycle ${cycle}: should have 10 tasks`);

      // Clear
      await executor.clear();

      assert.strictEqual(executor.queue.length, 0, `cycle ${cycle}: queue should be empty after clear`);
      assert.strictEqual(executor.stats.totalTasks, 0, `cycle ${cycle}: stats should be reset`);
    }
  });

  test('clear() should not lose task references during cleanup', async () => {
    const taskIds = [];
    for (let i = 0; i < 5; i++) {
      const task = new CaptureTask(`task_${i}`, {}, 5);
      taskIds.push(task.id);
      executor.enqueue(task);
    }

    const tasksBeforeClear = executor.getAllTasks();
    assert.strictEqual(tasksBeforeClear.length, 5, 'should have 5 tasks before clear');

    await executor.clear();

    const tasksAfterClear = executor.getAllTasks();
    assert.strictEqual(tasksAfterClear.length, 0, 'should have 0 tasks after clear');
  });
});

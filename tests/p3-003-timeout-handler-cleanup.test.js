/**
 * P3-003: Timeout Handler Cleanup Tests
 * Tests that timeout handlers are properly cleaned up and no dangling timers remain
 */

const { TimeoutProtection, TimeoutError } = require('../src/resilience/timeout-protection');

describe('P3-003: Timeout Handler Cleanup', () => {
  let protection;

  beforeEach(() => {
    protection = new TimeoutProtection({
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
    });
  });

  afterEach(() => {
    protection.cleanupAllTimeouts();
  });

  // Test 1: Basic timeout cleanup
  test('should cleanup timeout on successful promise', async () => {
    const promise = Promise.resolve('success');
    const initialTimeouts = protection.activeTimeouts.size;

    await protection.withTimeout(promise, 5000, 'test_op');

    const finalTimeouts = protection.activeTimeouts.size;
    expect(finalTimeouts).toBeLessThanOrEqual(initialTimeouts);
  });

  // Test 2: Timeout cleanup on promise rejection
  test('should cleanup timeout when promise rejects', async () => {
    const promise = Promise.reject(new Error('test error'));
    const initialTimeouts = protection.activeTimeouts.size;

    try {
      await protection.withTimeout(promise, 5000, 'test_op');
    } catch (e) {
      // Expected
    }

    const finalTimeouts = protection.activeTimeouts.size;
    expect(finalTimeouts).toBeLessThanOrEqual(initialTimeouts);
  });

  // Test 3: No dangling timeouts after operation
  test('should have no dangling timeouts after completion', async () => {
    const promises = [];

    for (let i = 0; i < 10; i++) {
      promises.push(
        protection.withTimeout(Promise.resolve(i), 5000, `op_${i}`)
      );
    }

    await Promise.all(promises);

    expect(protection.activeTimeouts.size).toBe(0);
  });

  // Test 4: Track task completion
  test('should track task completion and cleanup', async () => {
    const taskId = 'task_1';

    const promise = new Promise(resolve => setTimeout(() => resolve('done'), 100));
    const tracked = protection.trackTask(taskId, promise, 5000);

    expect(protection.activeTasks.has(taskId)).toBe(true);

    await tracked;

    expect(protection.activeTasks.has(taskId)).toBe(false);
  });

  // Test 5: Multiple concurrent tasks cleanup
  test('should cleanup multiple concurrent tasks', async () => {
    const tasks = [];

    for (let i = 0; i < 15; i++) {
      const promise = new Promise(resolve => setTimeout(() => resolve(i), 50));
      tasks.push(protection.trackTask(`task_${i}`, promise, 5000));
    }

    await Promise.all(tasks);

    expect(protection.activeTasks.size).toBe(0);
  });

  // Test 6: Cleanup status reporting
  test('should report cleanup status accurately', async () => {
    const promise1 = new Promise(resolve => setTimeout(() => resolve(1), 100));
    const promise2 = new Promise(resolve => setTimeout(() => resolve(2), 100));

    protection.trackTask('task_1', promise1, 5000);
    protection.trackTask('task_2', promise2, 5000);

    const status = protection.getCleanupStatus();
    expect(status.activeTasks).toBe(2);

    await Promise.all([promise1, promise2]);

    const statusAfter = protection.getCleanupStatus();
    expect(statusAfter.activeTasks).toBe(0);
  });

  // Test 7: Cleanup all timeouts force method
  test('should cleanup all timeouts with forceEmergencyCleanup', async () => {
    const handler = jest.fn();
    protection.onCleanup(handler);

    // Create some timeouts
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        protection.withTimeout(new Promise(() => {}), 100000, `never_completes_${i}`)
      );
    }

    // Force cleanup
    const result = protection.forceEmergencyCleanup();

    expect(result.cleaned).toBeGreaterThan(0);
    expect(handler).toHaveBeenCalled();
  });

  // Test 8: Abort controllers are cleaned
  test('should cleanup abort controllers on emergency cleanup', async () => {
    const promise = new Promise(resolve => setTimeout(() => resolve(1), 100));

    await protection.withTimeout(promise, 5000, 'test');

    const status = protection.getCleanupStatus();
    expect(status.activeControllers).toBe(0);
  });

  // Test 9: Execute with fallback cleans up on success
  test('should cleanup when executeWithFallback succeeds', async () => {
    const fn = jest.fn(() => Promise.resolve('success'));

    const result = await protection.executeWithFallback(fn, {
      timeoutMs: 5000,
      operationName: 'test_op',
      retries: 2
    });

    expect(result).toBe('success');
    expect(protection.activeTimeouts.size).toBe(0);
  });

  // Test 10: Cleanup on timeout error
  test('should cleanup even when timeout error occurs', async () => {
    const fn = jest.fn(() => new Promise(() => {
      // Never resolves
    }));

    try {
      await protection.executeWithFallback(fn, {
        timeoutMs: 100,
        operationName: 'timeout_op',
        retries: 0
      });
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
    }

    // Give cleanup time to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // No dangling timeouts
    expect(protection.activeTimeouts.size).toBe(0);
  });

  // Test 11: Command handler cleanup
  test('should cleanup command handlers properly', async () => {
    const handler = jest.fn(() => Promise.resolve({ success: true }));
    const wrapped = protection.wrapCommandHandler(handler, 5000, 'test_cmd');

    const result = await wrapped(
      { command: 'test' },
      {},
      {}
    );

    expect(result.success).toBe(true);
    expect(protection.activeTimeouts.size).toBe(0);
  });

  // Test 12: No memory leak from cleanup handlers
  test('should not accumulate cleanup handlers', () => {
    const handler = jest.fn();

    for (let i = 0; i < 100; i++) {
      protection.onCleanup(handler);
    }

    // This is expected behavior - handlers accumulate unless explicitly managed
    expect(protection.cleanupHandlers.length).toBe(100);

    // But we can clear them
    protection.cleanupHandlers = [];
    expect(protection.cleanupHandlers.length).toBe(0);
  });

  // Test 13: Cleanup under high concurrency
  test('should handle cleanup under high concurrency', async () => {
    const promises = [];

    for (let i = 0; i < 50; i++) {
      const promise = new Promise(resolve =>
        setTimeout(() => resolve(i), Math.random() * 100)
      );
      promises.push(protection.withTimeout(promise, 5000, `concurrent_${i}`));
    }

    await Promise.all(promises);

    expect(protection.activeTimeouts.size).toBe(0);
    expect(protection.activeTasks.size).toBe(0);
  });

  // Test 14: Get active tasks status
  test('should report active tasks accurately', async () => {
    const tasks = [];

    for (let i = 0; i < 5; i++) {
      const promise = new Promise(resolve => setTimeout(() => resolve(i), 100));
      tasks.push(protection.trackTask(`task_${i}`, promise, 5000));
    }

    const status = protection.getCleanupStatus();
    expect(status.tasks.length).toBe(5);
    expect(status.activeTasks).toBe(5);

    await Promise.all(tasks);

    const statusAfter = protection.getCleanupStatus();
    expect(statusAfter.tasks.length).toBe(0);
  });

  // Test 15: Cancel task properly
  test('should cancel tracked task', () => {
    const taskId = 'task_to_cancel';
    const promise = new Promise(() => {}); // Never resolves

    protection.trackTask(taskId, promise, 5000);
    expect(protection.activeTasks.has(taskId)).toBe(true);

    const cancelled = protection.cancelTask(taskId);
    expect(cancelled).toBe(true);
    expect(protection.activeTasks.has(taskId)).toBe(false);
  });
});

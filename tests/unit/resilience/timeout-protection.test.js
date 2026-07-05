/**
 * Tests for Timeout Protection Module
 * v12.5.0 Phase 2 - Deployment Hardening
 */

const {
  TimeoutProtection,
  TimeoutError,
  DEFAULT_TIMEOUTS
} = require('../../../src/resilience/timeout-protection');

describe('TimeoutProtection', () => {
  let protection;

  beforeEach(() => {
    protection = new TimeoutProtection({
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('withTimeout()', () => {
    it('should resolve promise before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await protection.withTimeout(promise, 5000, 'Operation');
      expect(result).toBe('success');
    });

    it('should reject promise on timeout', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 5000));

      try {
        await protection.withTimeout(promise, 1000, 'Slow operation');
        fail('Should have timed out');
      } catch (error) {
        expect(error instanceof TimeoutError).toBe(true);
        expect(error.operationName).toBe('Slow operation');
        expect(error.timeoutMs).toBe(1000);
      }
    });

    it('should enforce max timeout', async () => {
      protection.maxTimeout = 500;
      const promise = new Promise(resolve => setTimeout(resolve, 2000));

      try {
        await protection.withTimeout(promise, 10000, 'Op');
        fail('Should have timed out');
      } catch (error) {
        // Should timeout at 500ms, not 10000ms
        expect(error instanceof TimeoutError).toBe(true);
      }
    });
  });

  describe('executeWithFallback()', () => {
    it('should return result on success', async () => {
      const fn = jest.fn(() => Promise.resolve('result'));
      const result = await protection.executeWithFallback(fn, {
        timeoutMs: 5000,
        operationName: 'Test',
        fallback: 'default'
      });

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use fallback on timeout', async () => {
      const fn = jest.fn(() => new Promise(resolve => setTimeout(resolve, 5000)));
      const result = await protection.executeWithFallback(fn, {
        timeoutMs: 500,
        operationName: 'Test',
        fallback: 'fallback_value',
        retries: 0
      });

      expect(result).toBe('fallback_value');
    });

    it('should retry on timeout with exponential backoff', async () => {
      let attempt = 0;
      const fn = jest.fn(() => {
        attempt++;
        if (attempt < 2) {
          return new Promise(resolve => setTimeout(resolve, 2000));
        }
        return Promise.resolve('success');
      });

      const result = await protection.executeWithFallback(fn, {
        timeoutMs: 500,
        operationName: 'Test',
        fallback: null,
        retries: 2
      });

      expect(result).toBe('success');
      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should not retry non-timeout errors', async () => {
      const fn = jest.fn(() => Promise.reject(new Error('Not a timeout')));

      try {
        await protection.executeWithFallback(fn, {
          timeoutMs: 5000,
          operationName: 'Test',
          retries: 3
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toBe('Not a timeout');
        expect(fn).toHaveBeenCalledTimes(1); // No retries on non-timeout errors
      }
    });
  });

  describe('wrapCommandHandler()', () => {
    it('should wrap handler and enforce timeout', async () => {
      const handler = jest.fn(() => Promise.resolve({ success: true }));
      const wrapped = protection.wrapCommandHandler(handler, 5000, 'TestCommand');

      const result = await wrapped({ command: 'test' }, {}, {});
      expect(result).toEqual({ success: true });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return timeout error response', async () => {
      const handler = jest.fn(() => new Promise(resolve => setTimeout(resolve, 5000)));
      const wrapped = protection.wrapCommandHandler(handler, 500, 'SlowCommand');

      const result = await wrapped({ command: 'slow' }, {}, {});
      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain('timed out');
    });
  });

  describe('trackTask()', () => {
    it('should track active tasks', async () => {
      const promise = Promise.resolve('result');
      const task = protection.trackTask('task_1', promise, 5000);

      const tasks = protection.getActiveTasks();
      expect(tasks.task_1).toBeDefined();

      const result = await task;
      expect(result).toBe('result');

      const tasksAfter = protection.getActiveTasks();
      expect(tasksAfter.task_1).toBeUndefined();
    });

    it('should track task duration', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 100));
      const task = protection.trackTask('task_2', promise, 5000);

      await task;
      const tasks = protection.getActiveTasks();
      expect(tasks.task_2).toBeUndefined(); // Cleaned up after completion
    });

    it('should detect overdue tasks', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      const task = protection.trackTask('task_3', promise, 500);

      try {
        await task;
        fail('Should have timed out');
      } catch (error) {
        expect(error instanceof TimeoutError).toBe(true);
      }

      // Task should be cleaned up after timeout
      const tasks = protection.getActiveTasks();
      expect(tasks.task_3).toBeUndefined();
    });
  });

  describe('cancelTask()', () => {
    it('should cancel pending tasks', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 5000));
      protection.trackTask('task_to_cancel', promise, 10000);

      let tasks = protection.getActiveTasks();
      expect(tasks.task_to_cancel).toBeDefined();

      const cancelled = protection.cancelTask('task_to_cancel');
      expect(cancelled).toBe(true);

      tasks = protection.getActiveTasks();
      expect(tasks.task_to_cancel).toBeUndefined();
    });

    it('should return false for non-existent tasks', () => {
      const cancelled = protection.cancelTask('non_existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('getDefaultTimeout()', () => {
    it('should return correct default timeouts', () => {
      expect(protection.getDefaultTimeout('executeJavaScript')).toBe(5000);
      expect(protection.getDefaultTimeout('navigate')).toBe(30000);
      expect(protection.getDefaultTimeout('screenshot')).toBe(10000);
      expect(protection.getDefaultTimeout('wait')).toBe(30000);
    });

    it('should return default for unknown operation', () => {
      expect(protection.getDefaultTimeout('unknown')).toBe(DEFAULT_TIMEOUTS.defaultMax);
    });
  });

  describe('validateTimeout()', () => {
    it('should validate and cap timeout values', () => {
      protection.maxTimeout = 10000;

      expect(protection.validateTimeout(5000)).toBe(5000);
      expect(protection.validateTimeout(15000)).toBe(10000); // Capped
      expect(protection.validateTimeout(-100)).toBe(DEFAULT_TIMEOUTS.defaultMax);
      expect(protection.validateTimeout(NaN)).toBe(DEFAULT_TIMEOUTS.defaultMax);
    });
  });

  describe('TimeoutError', () => {
    it('should be instance of Error', () => {
      const error = new TimeoutError('TestOp', 5000);
      expect(error instanceof Error).toBe(true);
      expect(error.name).toBe('TimeoutError');
    });

    it('should include operation details', () => {
      const error = new TimeoutError('MyOperation', 2500);
      expect(error.message).toContain('MyOperation');
      expect(error.message).toContain('2500');
      expect(error.operationName).toBe('MyOperation');
      expect(error.timeoutMs).toBe(2500);
    });
  });

  describe('DEFAULT_TIMEOUTS', () => {
    it('should have all required timeout values', () => {
      expect(DEFAULT_TIMEOUTS.executeJavaScript).toBe(5000);
      expect(DEFAULT_TIMEOUTS.navigate).toBe(30000);
      expect(DEFAULT_TIMEOUTS.screenshot).toBe(10000);
      expect(DEFAULT_TIMEOUTS.wait).toBe(30000);
      expect(DEFAULT_TIMEOUTS.click).toBe(2000);
      expect(DEFAULT_TIMEOUTS.fill).toBe(2000);
      expect(DEFAULT_TIMEOUTS.formSubmit).toBe(5000);
      expect(DEFAULT_TIMEOUTS.request).toBe(10000);
    });
  });

  describe('Concurrent operations', () => {
    it('should handle multiple concurrent timeout-protected operations', async () => {
      const promises = [
        protection.withTimeout(Promise.resolve(1), 5000),
        protection.withTimeout(Promise.resolve(2), 5000),
        protection.withTimeout(Promise.resolve(3), 5000)
      ];

      const results = await Promise.all(promises);
      expect(results).toEqual([1, 2, 3]);
    });

    it('should handle concurrent operation tracking', async () => {
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const promise = new Promise(resolve => setTimeout(resolve, 100));
        tasks.push(protection.trackTask(`task_${i}`, promise, 5000));
      }

      const activeCount = Object.keys(protection.getActiveTasks()).length;
      expect(activeCount).toBeGreaterThan(0);

      await Promise.all(tasks);

      const finalCount = Object.keys(protection.getActiveTasks()).length;
      expect(finalCount).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should handle rapid timeout creations', async () => {
      const promises = [];
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        promises.push(protection.withTimeout(Promise.resolve(i), 5000));
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second for 100 ops)
      expect(duration).toBeLessThan(1000);
    });
  });
});

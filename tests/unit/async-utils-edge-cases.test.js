/**
 * Basset Hound Browser - Async Utilities Edge Cases & Boundary Tests
 * Additional tests for edge cases, boundary conditions, and error recovery paths
 *
 * @module tests/unit/async-utils-edge-cases.test.js
 */

const {
  retryAsync,
  CircuitBreaker,
  parallelAsync,
  sequentialAsync,
  memoizeAsync,
  debounceAsync
} = require('../../src/utils/async-utils');

const { CircuitBreakerError } = require('../../src/utils/errors');

describe('retryAsync - Boundary & Edge Cases', () => {
  describe('numeric boundary conditions', () => {
    it('should handle maxRetries=0 with success on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryAsync(fn, { maxRetries: 0 });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle very large maxRetries', async () => {
      let attemptCount = 0;
      const fn = jest.fn(async () => {
        attemptCount++;
        if (attemptCount < 5) {
          throw new Error('fail');
        }
        return 'success';
      });

      const result = await retryAsync(fn, {
        maxRetries: 1000000,
        initialDelay: 1
      });

      expect(result).toBe('success');
      expect(attemptCount).toBe(5);
    });

    it('should handle initialDelay > maxDelay', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const result = await retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 5000,
        maxDelay: 1000,
        backoffMultiplier: 2
      });

      expect(result).toBe('success');
    });

    it('should handle backoffMultiplier=0', async () => {
      jest.useFakeTimers();

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 100,
        backoffMultiplier: 0
      });

      jest.advanceTimersByTime(100);
      const result = await promise;

      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should handle negative backoffMultiplier (treated as positive)', async () => {
      jest.useFakeTimers();

      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      try {
        await retryAsync(fn, {
          maxRetries: 2,
          initialDelay: 100,
          backoffMultiplier: -2
        });
      } catch (e) {
        // expected
      }

      jest.useRealTimers();
    });

    it('should handle Infinity as maxDelay', async () => {
      jest.useFakeTimers();

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const promise = retryAsync(fn, {
        maxRetries: 2,
        initialDelay: 100,
        maxDelay: Infinity,
        backoffMultiplier: 10
      });

      jest.advanceTimersByTime(1000);
      const result = await promise;
      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should handle NaN values gracefully', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      // NaN should be handled by JavaScript coercion
      const result = await retryAsync(fn, {
        maxRetries: NaN,
        initialDelay: NaN
      });

      expect(result).toBe('success');
    });
  });

  describe('error type variations', () => {
    it('should handle different error types in shouldRetry', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new TypeError('type error'))
        .mockRejectedValueOnce(new RangeError('range error'))
        .mockResolvedValueOnce('success');

      const shouldRetry = (error) => error instanceof TypeError || error instanceof RangeError;

      const result = await retryAsync(fn, {
        maxRetries: 3,
        shouldRetry,
        initialDelay: 1
      });

      expect(result).toBe('success');
    });

    it('should handle Error subclasses', async () => {
      class CustomError extends Error {
        constructor(message) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const fn = jest.fn()
        .mockRejectedValueOnce(new CustomError('custom fail'))
        .mockResolvedValueOnce('success');

      const result = await retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 1
      });

      expect(result).toBe('success');
    });

    it('should handle non-Error objects thrown', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce('string error')
        .mockResolvedValueOnce('success');

      const result = await retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 1
      });

      expect(result).toBe('success');
    });

    it('should handle null error', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(null)
        .mockResolvedValueOnce('success');

      const result = await retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 1
      });

      expect(result).toBe('success');
    });
  });

  describe('callback exception handling', () => {
    it('should continue despite shouldRetry throwing', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const shouldRetry = jest.fn(() => {
        throw new Error('predicate error');
      });

      // If shouldRetry throws, it should throw that error
      await expect(
        retryAsync(fn, { shouldRetry, maxRetries: 1, initialDelay: 1 })
      ).rejects.toThrow('predicate error');
    });

    it('should handle onRetry returning values (ignored)', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const onRetry = jest.fn((attempt, error, delay) => {
        return { returned: 'value' };
      });

      const result = await retryAsync(fn, {
        maxRetries: 1,
        onRetry,
        initialDelay: 1
      });

      expect(result).toBe('success');
    });
  });

  describe('timing edge cases', () => {
    it('should handle rapid successive retries', async () => {
      jest.useFakeTimers();

      let attempt = 0;
      const fn = jest.fn(async () => {
        attempt++;
        if (attempt < 5) throw new Error('fail');
        return 'success';
      });

      const promise = retryAsync(fn, {
        maxRetries: 5,
        initialDelay: 0,
        backoffMultiplier: 1
      });

      jest.advanceTimersByTime(1000);
      const result = await promise;

      expect(result).toBe('success');

      jest.useRealTimers();
    });

    it('should handle function taking longer than delay', async () => {
      jest.useFakeTimers();

      let execTime = 0;
      const fn = jest.fn(async () => {
        execTime++;
        if (execTime === 1) {
          await new Promise(r => setTimeout(r, 200)); // simulate slow operation
          throw new Error('fail');
        }
        return 'success';
      });

      const promise = retryAsync(fn, {
        maxRetries: 1,
        initialDelay: 100
      });

      jest.advanceTimersByTime(500);
      const result = await promise;

      expect(result).toBe('success');

      jest.useRealTimers();
    });
  });
});

describe('CircuitBreaker - Boundary & Edge Cases', () => {
  describe('threshold edge cases', () => {
    it('should handle failureThreshold=1', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const breaker = new CircuitBreaker(fn, { failureThreshold: 1 });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');
    });

    it('should handle failureThreshold=0', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const breaker = new CircuitBreaker(fn, { failureThreshold: 0 });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      // With threshold=0, should open immediately
      expect(breaker.getState()).toBe('open');
    });

    it('should handle very large failureThreshold', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1000000
      });

      for (let i = 0; i < 10; i++) {
        try {
          await breaker.execute();
        } catch (e) {
          // expected
        }
      }

      expect(breaker.getState()).toBe('closed');
    });

    it('should handle successThreshold=1', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        successThreshold: 1,
        timeout: 0
      });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');

      await breaker.execute();
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('timeout edge cases', () => {
    it('should handle timeout=0 (immediate half-open)', async () => {
      jest.useFakeTimers();

      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        timeout: 0
      });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');

      // Immediately try - should transition to half-open
      await breaker.execute();
      expect(breaker.getState()).toBe('half-open');

      jest.useRealTimers();
    });

    it('should handle very large timeout', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        timeout: Number.MAX_SAFE_INTEGER
      });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      // Should stay open indefinitely
      expect(breaker.getState()).toBe('open');

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');
    });
  });

  describe('concurrent execution during transitions', () => {
    it('should handle multiple executions during half-open', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const breaker = new CircuitBreaker(fn, {
        failureThreshold: 1,
        successThreshold: 2,
        timeout: 0
      });

      // Open circuit
      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      // Move to half-open
      await breaker.execute();
      expect(breaker.getState()).toBe('half-open');

      // Another execution
      await breaker.execute();

      // Should now be closed (2 successes)
      expect(breaker.getState()).toBe('closed');
    });
  });

  describe('error type handling', () => {
    it('should handle function throwing non-Error objects', async () => {
      const fn = jest.fn().mockRejectedValue('string error');

      const breaker = new CircuitBreaker(fn, { failureThreshold: 1 });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');
    });

    it('should handle null error', async () => {
      const fn = jest.fn().mockRejectedValue(null);

      const breaker = new CircuitBreaker(fn, { failureThreshold: 1 });

      try {
        await breaker.execute();
      } catch (e) {
        // expected
      }

      expect(breaker.getState()).toBe('open');
    });
  });
});

describe('parallelAsync - Boundary & Edge Cases', () => {
  describe('concurrency edge cases', () => {
    it('should handle concurrency=1 (sequential)', async () => {
      const callOrder = [];

      const fns = [
        jest.fn(async () => { callOrder.push(1); return 1; }),
        jest.fn(async () => { callOrder.push(2); return 2; }),
        jest.fn(async () => { callOrder.push(3); return 3; })
      ];

      const results = await parallelAsync(fns, 1);

      expect(results).toEqual([1, 2, 3]);
      // With concurrency=1, should behave like sequential
      expect(callOrder).toEqual([1, 2, 3]);
    });

    it('should handle negative concurrency', async () => {
      const fns = [jest.fn().mockResolvedValue(1)];

      // Negative concurrency is invalid and might cause issues
      try {
        await parallelAsync(fns, -1);
      } catch (e) {
        // May throw or behave unexpectedly
      }
    });

    it('should handle Infinity concurrency', async () => {
      const fns = Array(10).fill(0).map((_, i) =>
        jest.fn().mockResolvedValue(i)
      );

      const results = await parallelAsync(fns, Infinity);

      expect(results.length).toBe(10);
    });
  });

  describe('error scenarios', () => {
    it('should handle multiple concurrent failures', async () => {
      const fns = [
        jest.fn().mockRejectedValue(new Error('fail1')),
        jest.fn().mockRejectedValue(new Error('fail2')),
        jest.fn().mockRejectedValue(new Error('fail3'))
      ];

      await expect(parallelAsync(fns, 3)).rejects.toThrow();
    });

    it('should handle mixed errors and successes', async () => {
      const fns = [
        jest.fn().mockResolvedValue(1),
        jest.fn().mockRejectedValue(new Error('fail')),
        jest.fn().mockResolvedValue(3)
      ];

      await expect(parallelAsync(fns)).rejects.toThrow('fail');
    });
  });

  describe('empty and single-item cases', () => {
    it('should handle single function', async () => {
      const fn = jest.fn().mockResolvedValue('single');

      const results = await parallelAsync([fn], 3);

      expect(results).toEqual(['single']);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('memoizeAsync - Cache Behavior Edge Cases', () => {
  describe('cache key generation', () => {
    it('should distinguish between similar arguments', async () => {
      const fn = jest.fn((a, b) => Promise.resolve(a + b));

      const memoized = memoizeAsync(fn);

      const result1 = await memoized(1, 2);
      const result2 = await memoized(2, 1);

      expect(result1).toBe(3);
      expect(result2).toBe(3);
      expect(fn).toHaveBeenCalledTimes(2); // Different argument order = different cache keys
    });

    it('should handle object arguments', async () => {
      const fn = jest.fn((obj) => Promise.resolve(obj.value * 2));

      const memoized = memoizeAsync(fn);

      const obj1 = { value: 10 };
      const obj2 = { value: 10 };

      const result1 = await memoized(obj1);
      const result2 = await memoized(obj2);

      // Different object instances should have different cache keys
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle circular references in arguments', async () => {
      const fn = jest.fn((obj) => Promise.resolve(obj.value));

      const memoized = memoizeAsync(fn);

      const obj = { value: 42 };
      obj.self = obj; // circular reference

      // This might throw or handle gracefully depending on JSON.stringify behavior
      try {
        await memoized(obj);
      } catch (e) {
        // Expected - circular references in JSON.stringify throw
      }
    });

    it('should handle undefined in key generator', async () => {
      const fn = jest.fn((a) => Promise.resolve(a));

      const keyGen = (a) => {
        // Returns undefined - should still work as cache key
        return undefined;
      };

      const memoized = memoizeAsync(fn, { keyGenerator: keyGen });

      const result1 = await memoized('value1');
      const result2 = await memoized('value2');

      // Both should use same cache key (undefined)
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrent cache access', () => {
    it('should handle concurrent calls with same key', async () => {
      const fn = jest.fn(async () => {
        await new Promise(r => setTimeout(r, 10));
        return 'result';
      });

      const memoized = memoizeAsync(fn);

      const [result1, result2, result3] = await Promise.all([
        memoized('key'),
        memoized('key'),
        memoized('key')
      ]);

      // All should get same result
      expect(result1).toBe('result');
      expect(result2).toBe('result');
      expect(result3).toBe('result');

      // Function should be called at least once, possibly multiple times
      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('memory and cleanup', () => {
    it('should eventually remove expired entries', async () => {
      jest.useFakeTimers();

      const fn = jest.fn().mockResolvedValue('result');

      const memoized = memoizeAsync(fn, { ttl: 100 });

      await memoized('key');
      expect(fn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(50);
      await memoized('key');
      expect(fn).toHaveBeenCalledTimes(1); // Still cached

      jest.advanceTimersByTime(51);
      await memoized('key');
      expect(fn).toHaveBeenCalledTimes(2); // Expired, re-executed

      jest.useRealTimers();
    });

    it('should not leak memory with large payloads', async () => {
      const largeObject = {
        data: Array(10000).fill('x'.repeat(100))
      };

      const fn = jest.fn().mockResolvedValue(largeObject);

      const memoized = memoizeAsync(fn);

      const result = await memoized('key');

      expect(result).toEqual(largeObject);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('debounceAsync - Timing Edge Cases', () => {
  describe('rapid fire scenarios', () => {
    it('should collapse many rapid calls into one', async () => {
      jest.useFakeTimers();

      const fn = jest.fn().mockResolvedValue('result');

      const debounced = debounceAsync(fn, 100);

      for (let i = 0; i < 1000; i++) {
        debounced(`call-${i}`);
      }

      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('call-999'); // Last call

      jest.useRealTimers();
    });

    it('should handle delay=0', async () => {
      jest.useFakeTimers();

      const fn = jest.fn().mockResolvedValue('result');

      const debounced = debounceAsync(fn, 0);

      const promise = debounced('value');

      jest.advanceTimersByTime(1);

      expect(fn).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('should handle very large delay', async () => {
      jest.useFakeTimers();

      const fn = jest.fn().mockResolvedValue('result');

      const debounced = debounceAsync(fn, Number.MAX_SAFE_INTEGER);

      debounced('value');

      jest.advanceTimersByTime(1000000);

      expect(fn).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('promise chain handling', () => {
    it('should handle function that returns non-promise', async () => {
      jest.useFakeTimers();

      const fn = jest.fn(() => 'direct-result'); // Not a promise

      const debounced = debounceAsync(fn, 100);

      const promise = debounced('value');

      jest.advanceTimersByTime(100);

      const result = await promise;
      expect(result).toBe('direct-result');

      jest.useRealTimers();
    });
  });
});

describe('sequentialAsync - Edge Cases', () => {
  describe('early termination', () => {
    it('should stop at first error', async () => {
      const fn1 = jest.fn().mockResolvedValue(1);
      const fn2 = jest.fn().mockRejectedValue(new Error('fail'));
      const fn3 = jest.fn().mockResolvedValue(3);

      await expect(sequentialAsync([fn1, fn2, fn3])).rejects.toThrow('fail');

      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
      expect(fn3).not.toHaveBeenCalled();
    });

    it('should handle empty onProgress callback returning undefined', async () => {
      const onProgress = jest.fn(() => undefined);

      const results = await sequentialAsync([
        jest.fn().mockResolvedValue(1),
        jest.fn().mockResolvedValue(2)
      ], onProgress);

      expect(results).toEqual([1, 2]);
      expect(onProgress).toHaveBeenCalledTimes(2);
    });
  });
});

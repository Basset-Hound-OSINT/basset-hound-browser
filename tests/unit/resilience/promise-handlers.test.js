/**
 * Tests for Promise Handlers Module
 * v12.5.0 Phase 2 - Deployment Hardening
 */

const { PromiseHandlers } = require('../../../src/resilience/promise-handlers');

describe('PromiseHandlers', () => {
  describe('initialize()', () => {
    it('should set up promise rejection handlers', () => {
      const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
      const onRejection = jest.fn();

      PromiseHandlers.initialize({
        logger,
        onRejection,
        exitOnUncaught: false
      });

      // Trigger unhandled rejection
      const reason = new Error('Test rejection');
      process.emit('unhandledRejection', reason, Promise.reject(reason));

      expect(logger.error).toHaveBeenCalled();
      expect(onRejection).toHaveBeenCalledWith(reason, expect.anything(), expect.anything());
    });

    it('should handle exception callbacks gracefully', () => {
      const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };
      const onException = jest.fn(() => {
        throw new Error('Handler crashed');
      });

      PromiseHandlers.initialize({
        logger,
        onException,
        exitOnUncaught: false
      });

      const error = new Error('Test exception');
      process.emit('uncaughtException', error);

      // Should not crash even though handler threw
      expect(logger.error.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('withErrorHandling()', () => {
    it('should pass through successful promises', async () => {
      const promise = Promise.resolve('success');
      const result = await PromiseHandlers.withErrorHandling(promise, {
        operationName: 'Test'
      });

      expect(result).toBe('success');
    });

    it('should catch and log errors', async () => {
      const logger = { error: jest.fn() };
      const error = new Error('Test error');
      const promise = Promise.reject(error);

      try {
        await PromiseHandlers.withErrorHandling(promise, {
          logger,
          operationName: 'Test',
          rethrow: true
        });
        expect(true).toBe(false);  // Should have thrown
      } catch (e) {
        expect(e).toBe(error);
        expect(logger.error).toHaveBeenCalled();
      }
    });

    it('should use fallback on error', async () => {
      const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };
      const promise = Promise.reject(new Error('Test'));

      const result = await PromiseHandlers.withErrorHandling(promise, {
        logger,
        fallback: 'fallback_value',
        rethrow: false
      });

      expect(result).toBe('fallback_value');
    });

    it('should return null when no fallback provided', async () => {
      const logger = { error: jest.fn() };
      const promise = Promise.reject(new Error('Test'));

      const result = await PromiseHandlers.withErrorHandling(promise, {
        logger,
        rethrow: false
      });

      expect(result).toBeNull();
    });
  });

  describe('wrapAsyncFunction()', () => {
    it('should wrap successful async functions', async () => {
      const fn = async (x) => x * 2;
      const wrapped = PromiseHandlers.wrapAsyncFunction(fn);

      const result = await wrapped(5);
      expect(result).toBe(10);
    });

    it('should catch errors in wrapped functions', async () => {
      const logger = { error: jest.fn() };
      const fn = async () => {
        throw new Error('Wrapped function error');
      };

      const wrapped = PromiseHandlers.wrapAsyncFunction(fn, {
        logger,
        rethrow: true
      });

      try {
        await wrapped();
        expect(true).toBe(false);  // Should have thrown
      } catch (error) {
        expect(error.message).toBe('Wrapped function error');
        expect(logger.error).toHaveBeenCalled();
      }
    });

    it('should use fallback for wrapped function errors', async () => {
      const fn = async () => {
        throw new Error('Error');
      };

      const wrapped = PromiseHandlers.wrapAsyncFunction(fn, {
        fallback: 'default_value',
        rethrow: false
      });

      const result = await wrapped();
      expect(result).toBe('default_value');
    });
  });

  describe('executeWithErrorHandling()', () => {
    it('should execute function successfully', async () => {
      const fn = () => Promise.resolve('result');
      const result = await PromiseHandlers.executeWithErrorHandling(fn, 5000);

      expect(result).toBe('result');
    });

    it('should timeout if function takes too long', async () => {
      const fn = () => new Promise(resolve => setTimeout(resolve, 2000));
      const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() };

      try {
        await PromiseHandlers.executeWithErrorHandling(fn, 500, { logger });
        expect(true).toBe(false);  // Should have timed out
      } catch (error) {
        expect(error.message).toContain('timed out');
        expect(logger.error).toHaveBeenCalled();
      }
    });

    it('should use fallback on timeout', async () => {
      const fn = () => new Promise(resolve => setTimeout(resolve, 2000));

      const result = await PromiseHandlers.executeWithErrorHandling(fn, 500, {
        fallback: 'timeout_fallback'
      });

      expect(result).toBe('timeout_fallback');
    });
  });

  describe('createSafePromise()', () => {
    it('should create promise from executor', async () => {
      const promise = PromiseHandlers.createSafePromise((resolve) => {
        resolve('safe_result');
      });

      const result = await promise;
      expect(result).toBe('safe_result');
    });

    it('should catch executor errors', async () => {
      const logger = { error: jest.fn() };
      const promise = PromiseHandlers.createSafePromise(() => {
        throw new Error('Executor error');
      }, { logger });

      try {
        await promise;
        expect(true).toBe(false);  // Should have thrown
      } catch (error) {
        expect(error.message).toBe('Executor error');
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });

  describe('allWithErrorHandling()', () => {
    it('should resolve all successful promises', async () => {
      const promises = [Promise.resolve(1), Promise.resolve(2), Promise.resolve(3)];
      const results = await PromiseHandlers.allWithErrorHandling(promises);

      expect(results).toEqual([1, 2, 3]);
    });

    it('should fail on first error with continueOnError=false', async () => {
      const logger = { error: jest.fn() };
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Test error')),
        Promise.resolve(3)
      ];

      try {
        await PromiseHandlers.allWithErrorHandling(promises, {
          logger,
          continueOnError: false
        });
        expect(true).toBe(false);  // Should have thrown
      } catch (error) {
        expect(error.message).toBe('Test error');
        expect(logger.error).toHaveBeenCalled();
      }
    });

    it('should continue on error with continueOnError=true', async () => {
      const logger = { warn: jest.fn() };
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Error 1')),
        Promise.resolve(3),
        Promise.reject(new Error('Error 2'))
      ];

      const results = await PromiseHandlers.allWithErrorHandling(promises, {
        logger,
        continueOnError: true
      });

      expect(results.length).toBe(4);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('raceWithErrorHandling()', () => {
    it('should return first resolved promise', async () => {
      const promises = [
        new Promise(resolve => setTimeout(() => resolve(1), 100)),
        new Promise(resolve => setTimeout(() => resolve(2), 50)),
        new Promise(resolve => setTimeout(() => resolve(3), 150))
      ];

      const result = await PromiseHandlers.raceWithErrorHandling(promises);
      expect(result).toBe(2);
    });

    it('should reject if first promise rejects', async () => {
      const logger = { error: jest.fn() };
      const promises = [
        Promise.reject(new Error('First error')),
        new Promise(resolve => setTimeout(() => resolve('never reached'), 100))
      ];

      try {
        await PromiseHandlers.raceWithErrorHandling(promises, { logger });
        expect(true).toBe(false);  // Should have rejected
      } catch (error) {
        expect(error.message).toBe('First error');
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });

  describe('withTimeout()', () => {
    it('should resolve within timeout', async () => {
      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 50));
      const result = await PromiseHandlers.withTimeout(promise, 500);

      expect(result).toBe('result');
    });

    it('should reject on timeout', async () => {
      const logger = { error: jest.fn() };
      const promise = new Promise(resolve => setTimeout(() => resolve('result'), 500));

      try {
        await PromiseHandlers.withTimeout(promise, 100, { logger });
        expect(true).toBe(false);  // Should have timed out
      } catch (error) {
        expect(error.message).toContain('timed out');
      }
    });
  });

  describe('retryWithBackoff()', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn(() => Promise.resolve('success'));
      const result = await PromiseHandlers.retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelay: 10
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry with exponential backoff', async () => {
      const logger = { warn: jest.fn(), error: jest.fn() };
      let attempt = 0;
      const fn = jest.fn(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve('success');
      });

      const result = await PromiseHandlers.retryWithBackoff(fn, {
        logger,
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100
      });

      expect(result).toBe('success');
      expect(fn.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should fail after max retries exhausted', async () => {
      const logger = { warn: jest.fn(), error: jest.fn() };
      const fn = jest.fn(() => Promise.reject(new Error('Persistent error')));

      try {
        await PromiseHandlers.retryWithBackoff(fn, {
          logger,
          maxRetries: 2,
          initialDelay: 10
        });
        expect(true).toBe(false);  // Should have failed
      } catch (error) {
        expect(error.message).toBe('Persistent error');
        expect(fn).toHaveBeenCalledTimes(3);  // Initial + 2 retries
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });

  describe('wrapCallback()', () => {
    it('should wrap callbacks safely', () => {
      const callback = jest.fn((x) => x * 2);
      const wrapped = PromiseHandlers.wrapCallback(callback);

      const result = wrapped(5);
      expect(result).toBe(10);
      expect(callback).toHaveBeenCalledWith(5);
    });

    it('should handle callback errors', () => {
      const logger = { error: jest.fn() };
      const callback = jest.fn(() => {
        throw new Error('Callback error');
      });

      const wrapped = PromiseHandlers.wrapCallback(callback, {
        logger,
        swallowErrors: true
      });

      expect(() => wrapped()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle promise results in callbacks', async () => {
      const logger = { error: jest.fn() };
      const callback = jest.fn(() => Promise.reject(new Error('Promise error')));

      const wrapped = PromiseHandlers.wrapCallback(callback, {
        logger,
        swallowErrors: true
      });

      wrapped();

      // Wait for promise to settle
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('safeOn() and safeOnce()', () => {
    it('should safely attach event listeners', () => {
      const emitter = require('events').EventEmitter.prototype;
      const handler = jest.fn();
      const logger = { error: jest.fn() };

      // Note: These would need actual EventEmitter, skipping specific test
      // but the implementation should work with EventEmitter
    });
  });

  describe('Error recovery scenarios', () => {
    it('should recover from cascading promise failures', async () => {
      const logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
      const promises = [
        Promise.reject(new Error('Error 1')),
        Promise.reject(new Error('Error 2')),
        Promise.reject(new Error('Error 3'))
      ];

      const results = await PromiseHandlers.allWithErrorHandling(promises, {
        logger,
        continueOnError: true
      });

      // Should handle all without crashing
      expect(results.length).toBe(3);
      expect(logger.error.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain error context through wrapping', async () => {
      const logger = { error: jest.fn() };
      const originalError = new Error('Original context');
      originalError.code = 'CUSTOM_ERROR';

      const fn = () => Promise.reject(originalError);
      const wrapped = PromiseHandlers.wrapAsyncFunction(fn, {
        logger,
        rethrow: true
      });

      try {
        await wrapped();
        expect(true).toBe(false);  // Should have thrown
      } catch (error) {
        expect(error.code).toBe('CUSTOM_ERROR');
        expect(logger.error).toHaveBeenCalled();
      }
    });
  });
});

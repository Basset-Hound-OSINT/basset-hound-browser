/**
 * Tests for IPC Safety Module
 * v12.5.0 Phase 2 - Deployment Hardening
 */

const { IPCSafety } = require('../../../src/resilience/ipc-safety');

describe('IPCSafety', () => {
  let ipcSafety;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    ipcSafety = new IPCSafety({
      logger: mockLogger,
      deduplicationWindow: 100,
      maxPendingOperations: 100
    });
  });

  afterEach(() => {
    ipcSafety.destroy();
  });

  describe('executeOncePerSession()', () => {
    it('should execute handler once', async () => {
      const handler = jest.fn(() => Promise.resolve('result'));

      const result = await ipcSafety.executeOncePerSession(
        'cmd_1',
        handler
      );

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate rapid identical commands', async () => {
      const handler = jest.fn(() => Promise.resolve('result'));
      const commandId = 'cmd_duplicate';

      // Send same command twice rapidly
      const promise1 = ipcSafety.executeOncePerSession(commandId, handler);
      const promise2 = ipcSafety.executeOncePerSession(commandId, handler);

      const results = await Promise.all([promise1, promise2]);

      expect(results).toEqual(['result', 'result']);
      expect(handler).toHaveBeenCalledTimes(1);  // Only called once
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should return cached result within deduplication window', async () => {
      const handler = jest.fn(() => Promise.resolve('result'));
      const commandId = 'cmd_cache';

      // First execution
      const result1 = await ipcSafety.executeOncePerSession(commandId, handler);
      expect(result1).toBe('result');
      expect(handler).toHaveBeenCalledTimes(1);

      // Second execution within window
      const result2 = await ipcSafety.executeOncePerSession(commandId, handler);
      expect(result2).toBe('result');
      expect(handler).toHaveBeenCalledTimes(1);  // Still only called once

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Returning cached result')
      );
    });

    it('should re-execute after deduplication window expires', async () => {
      ipcSafety.deduplicationWindow = 50;
      const handler = jest.fn(() => Promise.resolve('result'));
      const commandId = 'cmd_reexec';

      // First execution
      await ipcSafety.executeOncePerSession(commandId, handler);
      expect(handler).toHaveBeenCalledTimes(1);

      // Wait for deduplication window to pass
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second execution after window
      await ipcSafety.executeOncePerSession(commandId, handler);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should enforce max pending operations limit', async () => {
      ipcSafety.maxPendingOperations = 2;

      const handler = () => new Promise(resolve => setTimeout(resolve, 100));

      // Start 3 operations
      const p1 = ipcSafety.executeOncePerSession('cmd_1', handler);
      const p2 = ipcSafety.executeOncePerSession('cmd_2', handler);

      try {
        // Third should exceed limit
        await ipcSafety.executeOncePerSession('cmd_3', handler);
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Too many pending');
      }

      await Promise.all([p1, p2]);
    });

    it('should cache failed operations', async () => {
      const handler = jest.fn(() => Promise.reject(new Error('Failed')));
      const commandId = 'cmd_fail';

      try {
        await ipcSafety.executeOncePerSession(commandId, handler);
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Failed');
      }

      // Second call should return cached error
      try {
        await ipcSafety.executeOncePerSession(commandId, handler);
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Failed');
      }

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support ignoreCache option', async () => {
      const handler = jest.fn(() => Promise.resolve('result'));
      const commandId = 'cmd_nocache';

      // First execution
      await ipcSafety.executeOncePerSession(commandId, handler);
      expect(handler).toHaveBeenCalledTimes(1);

      // Second execution with ignoreCache
      await ipcSafety.executeOncePerSession(commandId, handler, {
        ignoreCache: true
      });
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should timeout long-running operations', async () => {
      const handler = () => new Promise(resolve => setTimeout(resolve, 500));

      try {
        await ipcSafety.executeOncePerSession('cmd_timeout', handler, {
          timeout: 100
        });
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error.message).toContain('timed out');
      }
    });
  });

  describe('registerIPCHandler() and unregisterIPCHandler()', () => {
    it('should register and unregister handlers', () => {
      const mockIpcMain = {
        once: jest.fn(),
        removeListener: jest.fn()
      };

      const handler = jest.fn();

      ipcSafety.registerIPCHandler(mockIpcMain, 'test_response', handler);
      expect(mockIpcMain.once).toHaveBeenCalledWith('test_response', handler);

      ipcSafety.unregisterIPCHandler(mockIpcMain, 'test_response', handler);
      expect(mockIpcMain.removeListener).toHaveBeenCalled();
    });

    it('should warn when overwriting existing handler', () => {
      const mockIpcMain = {
        once: jest.fn(),
        removeListener: jest.fn()
      };

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      ipcSafety.registerIPCHandler(mockIpcMain, 'test_response', handler1);
      ipcSafety.registerIPCHandler(mockIpcMain, 'test_response', handler2);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Overwriting existing handler')
      );
    });
  });

  describe('cancelPendingOperations()', () => {
    it('should cancel all pending operations', async () => {
      const handler = () => new Promise(resolve => setTimeout(resolve, 1000));

      ipcSafety.executeOncePerSession('op_1', handler);
      ipcSafety.executeOncePerSession('op_2', handler);
      ipcSafety.executeOncePerSession('op_3', handler);

      const state = ipcSafety.getState();
      expect(state.pendingOperations).toBe(3);

      const cancelled = ipcSafety.cancelPendingOperations();
      expect(cancelled).toBe(3);

      const stateAfter = ipcSafety.getState();
      expect(stateAfter.pendingOperations).toBe(0);
    });

    it('should cancel operations by pattern', async () => {
      const handler = () => new Promise(resolve => setTimeout(resolve, 1000));

      ipcSafety.executeOncePerSession('user_op_1', handler);
      ipcSafety.executeOncePerSession('user_op_2', handler);
      ipcSafety.executeOncePerSession('system_op_1', handler);

      const cancelled = ipcSafety.cancelPendingOperations('user');
      expect(cancelled).toBe(2);

      const state = ipcSafety.getState();
      expect(state.pendingOperations).toBe(1);
    });
  });

  describe('getState()', () => {
    it('should return current state', async () => {
      const handler = jest.fn(() => Promise.resolve('result'));

      const promise = ipcSafety.executeOncePerSession('op_1', handler);

      const state = ipcSafety.getState();
      expect(state.pendingOperations).toBeGreaterThanOrEqual(0);
      expect(state.registeredHandlers).toBeDefined();
      expect(state.cachedResults).toBeDefined();
      expect(state.limits.maxPendingOperations).toBe(100);
      expect(state.limits.deduplicationWindow).toBe(100);

      await promise;
    });
  });

  describe('Cleanup', () => {
    it('should cleanup stale pending operations', async () => {
      // Reduce cleanup interval for testing
      ipcSafety.destroy();
      ipcSafety = new IPCSafety({
        logger: mockLogger,
        deduplicationWindow: 50
      });

      const handler = () => new Promise(resolve => setTimeout(resolve, 300000));  // Very long

      // Add some operations
      ipcSafety.executeOncePerSession('stale_1', handler);
      ipcSafety.executeOncePerSession('stale_2', handler);

      // Manually mark as very old
      for (const pending of ipcSafety.pendingOperations.values()) {
        pending.timestamp = Date.now() - 400000;  // 400 seconds old
      }

      // Trigger cleanup
      ipcSafety.performCleanup();

      const state = ipcSafety.getState();
      expect(state.pendingOperations).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('should handle handler execution errors', async () => {
      const handler = () => {
        throw new Error('Handler crashed');
      };

      try {
        await ipcSafety.executeOncePerSession('error_cmd', handler);
        expect(true).toBe(false);  // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Handler crashed');
      }
    });

    it('should handle cleanup during error conditions', () => {
      const mockIpcMain = {
        removeListener: jest.fn(() => {
          throw new Error('Cleanup failed');
        })
      };

      const handler = jest.fn();
      ipcSafety.registeredHandlers.set('channel_1', {
        handler,
        timestamp: Date.now()
      });

      // Should not throw
      const result = ipcSafety.unregisterIPCHandler(mockIpcMain, 'channel_1', handler);
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('Concurrency', () => {
    it('should handle concurrent command execution correctly', async () => {
      const results = [];
      const handlers = [];

      for (let i = 0; i < 10; i++) {
        handlers.push(
          ipcSafety.executeOncePerSession(
            `cmd_${i}`,
            () => Promise.resolve(`result_${i}`)
          )
        );
      }

      const allResults = await Promise.all(handlers);
      expect(allResults.length).toBe(10);
      expect(allResults[0]).toBe('result_0');
      expect(allResults[9]).toBe('result_9');
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [];

      // Mix of unique and duplicate commands
      operations.push(ipcSafety.executeOncePerSession('unique_1', () => Promise.resolve(1)));
      operations.push(ipcSafety.executeOncePerSession('duplicate', () => Promise.resolve(2)));
      operations.push(ipcSafety.executeOncePerSession('duplicate', () => Promise.resolve(2)));
      operations.push(ipcSafety.executeOncePerSession('unique_2', () => Promise.resolve(3)));

      const results = await Promise.all(operations);
      expect(results).toEqual([1, 2, 2, 3]);
    });
  });

  describe('destroy()', () => {
    it('should cleanup resources on destroy', () => {
      const handler = () => new Promise(resolve => setTimeout(resolve, 1000));

      ipcSafety.executeOncePerSession('op_1', handler);
      ipcSafety.executeOncePerSession('op_2', handler);

      ipcSafety.destroy();

      const state = ipcSafety.getState();
      expect(state.pendingOperations).toBe(0);
      expect(state.registeredHandlers).toBe(0);
      expect(state.cachedResults).toBe(0);
    });
  });
});

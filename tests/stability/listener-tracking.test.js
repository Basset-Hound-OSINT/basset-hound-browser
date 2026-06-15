/**
 * Event Listener Tracking Tests (Phase 3 - Issue #4)
 * Tests unbounded event listener prevention and cleanup
 *
 * Fixes validated:
 * - Issue #4: Unbounded Event Listeners
 *   - Explicit listener tracking
 *   - Automatic cleanup on disconnect
 *   - Listener limit enforcement
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const { ListenerTracker } = require('../../websocket/listener-tracker');
const EventEmitter = require('events');

describe('Event Listener Tracking (Issue #4)', () => {
  let tracker;
  let mockTarget;

  beforeEach(() => {
    tracker = new ListenerTracker(50);
    mockTarget = new EventEmitter();
  });

  afterEach(() => {
    tracker.cleanupAll();
    mockTarget.removeAllListeners();
  });

  // ==================== LISTENER REGISTRATION ====================

  describe('Listener Registration', () => {
    it('should register a listener', () => {
      const handler = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler);

      expect(tracker.getListenerCount('client-1')).toBe(1);
    });

    it('should register multiple listeners for same client', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-1', mockTarget, 'test', handler2);
      tracker.registerListener('client-1', mockTarget, 'close', handler3);

      expect(tracker.getListenerCount('client-1')).toBe(3);
    });

    it('should register listeners for multiple clients', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-2', mockTarget, 'test', handler2);

      expect(tracker.getListenerCount('client-1')).toBe(1);
      expect(tracker.getListenerCount('client-2')).toBe(1);
    });

    it('should register once-only listeners', () => {
      const handler = jest.fn();

      tracker.registerListener('client-1', mockTarget, 'test', handler, { once: true });

      // Emit the event twice
      mockTarget.emit('test', 'arg1');
      mockTarget.emit('test', 'arg2');

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should track registration time', () => {
      const handler = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler);

      const stats = tracker.getStats();
      expect(stats.clientDetails['client-1']).toBeDefined();
      expect(stats.clientDetails['client-1'].listeners[0].age).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== LISTENER LIMITS ====================

  describe('Listener Limits', () => {
    it('should enforce max listeners per client', () => {
      const localTracker = new ListenerTracker(5);
      const handlers = [];

      // Add 5 listeners (at limit)
      for (let i = 0; i < 5; i++) {
        const handler = () => {};
        handlers.push(handler);
        localTracker.registerListener('client-1', mockTarget, 'test', handler);
      }

      expect(localTracker.getListenerCount('client-1')).toBe(5);

      // Try to add 6th (exceeds limit)
      const handler6 = () => {};
      localTracker.registerListener('client-1', mockTarget, 'test', handler6);

      // Still allowed to register, but warning issued
      expect(localTracker.getListenerCount('client-1')).toBe(6);
      expect(localTracker.hasExceededLimit('client-1')).toBe(true);

      localTracker.cleanupAll();
    });

    it('should report when limit is exceeded', () => {
      const localTracker = new ListenerTracker(3);

      for (let i = 0; i < 4; i++) {
        const handler = () => {};
        localTracker.registerListener('client-1', mockTarget, 'test', handler);
      }

      expect(localTracker.hasExceededLimit('client-1')).toBe(true);

      localTracker.cleanupAll();
    });

    it('should not report exceeded limit when under limit', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-1', mockTarget, 'close', handler2);

      expect(tracker.hasExceededLimit('client-1')).toBe(false);
    });
  });

  // ==================== LISTENER CLEANUP ====================

  describe('Listener Cleanup', () => {
    it('should unregister individual listener', () => {
      const handler = jest.fn();

      const registration = tracker.registerListener('client-1', mockTarget, 'test', handler);

      expect(tracker.getListenerCount('client-1')).toBe(1);

      registration.unregister();

      expect(tracker.getListenerCount('client-1')).toBe(0);
    });

    it('should cleanup all listeners for a client', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-1', mockTarget, 'test', handler2);
      tracker.registerListener('client-1', mockTarget, 'close', handler3);

      expect(tracker.getListenerCount('client-1')).toBe(3);

      const cleaned = tracker.cleanupClient('client-1');

      expect(cleaned).toBe(3);
      expect(tracker.getListenerCount('client-1')).toBe(0);
    });

    it('should handle cleanup of non-existent clients', () => {
      const cleaned = tracker.cleanupClient('non-existent');
      expect(cleaned).toBe(0);
    });

    it('should cleanup all clients', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-1', mockTarget, 'close', handler2);
      tracker.registerListener('client-2', mockTarget, 'test', handler3);

      expect(tracker.getTotalListenerCount()).toBe(3);

      const cleaned = tracker.cleanupAll();

      expect(cleaned).toBe(3);
      expect(tracker.getTotalListenerCount()).toBe(0);
      expect(tracker.getActiveClients()).toHaveLength(0);
    });

    it('should remove actual event listeners from target', () => {
      const handler = jest.fn();

      tracker.registerListener('client-1', mockTarget, 'test', handler);

      expect(mockTarget.listenerCount('test')).toBe(1);

      tracker.cleanupClient('client-1');

      expect(mockTarget.listenerCount('test')).toBe(0);
    });
  });

  // ==================== STATISTICS ====================

  describe('Statistics', () => {
    it('should provide total listener count', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const handler3 = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler1);
      tracker.registerListener('client-1', mockTarget, 'test', handler2);
      tracker.registerListener('client-2', mockTarget, 'test', handler3);

      expect(tracker.getTotalListenerCount()).toBe(3);
    });

    it('should provide detailed statistics', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      tracker.registerListener('client-1', mockTarget, 'message', handler1);
      tracker.registerListener('client-1', mockTarget, 'close', handler2);

      const stats = tracker.getStats();

      expect(stats.totalClients).toBe(1);
      expect(stats.totalListeners).toBe(2);
      expect(stats.maxListenersPerClient).toBe(50);
      expect(stats.clientDetails['client-1']).toBeDefined();
      expect(stats.clientDetails['client-1'].listenerCount).toBe(2);
      expect(stats.clientDetails['client-1'].listeners).toHaveLength(2);
    });

    it('should track event types in statistics', () => {
      const handler1 = () => {};
      const handler2 = () => {};

      tracker.registerListener('client-1', mockTarget, 'message', handler1);
      tracker.registerListener('client-1', mockTarget, 'close', handler2);

      const stats = tracker.getStats();
      const events = stats.clientDetails['client-1'].listeners.map(l => l.event);

      expect(events).toContain('message');
      expect(events).toContain('close');
    });

    it('should report active clients', () => {
      const handler = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler);
      tracker.registerListener('client-2', mockTarget, 'test', handler);
      tracker.registerListener('client-3', mockTarget, 'test', handler);

      const activeClients = tracker.getActiveClients();

      expect(activeClients).toContain('client-1');
      expect(activeClients).toContain('client-2');
      expect(activeClients).toContain('client-3');
      expect(activeClients).toHaveLength(3);
    });
  });

  // ==================== CONCURRENT SCENARIOS ====================

  describe('Concurrent Operations', () => {
    it('should handle rapid listener registration', () => {
      const handlers = [];

      for (let i = 0; i < 100; i++) {
        const handler = () => {};
        handlers.push(handler);
        tracker.registerListener('client-1', mockTarget, `event-${i % 10}`, handler);
      }

      expect(tracker.getListenerCount('client-1')).toBe(100);
    });

    it('should handle mixed registration and cleanup', () => {
      const handlers = [];

      // Register listeners
      for (let i = 0; i < 30; i++) {
        const handler = () => {};
        handlers.push(handler);
        tracker.registerListener('client-1', mockTarget, 'test', handler);
      }

      expect(tracker.getListenerCount('client-1')).toBe(30);

      // Cleanup
      tracker.cleanupClient('client-1');

      expect(tracker.getListenerCount('client-1')).toBe(0);

      // Register more
      const newHandler = () => {};
      tracker.registerListener('client-1', mockTarget, 'test', newHandler);

      expect(tracker.getListenerCount('client-1')).toBe(1);
    });

    it('should handle many clients simultaneously', () => {
      const clientCount = 10;
      const listenersPerClient = 5;

      for (let c = 0; c < clientCount; c++) {
        for (let l = 0; l < listenersPerClient; l++) {
          const handler = () => {};
          tracker.registerListener(`client-${c}`, mockTarget, 'test', handler);
        }
      }

      expect(tracker.getStats().totalClients).toBe(clientCount);
      expect(tracker.getTotalListenerCount()).toBe(clientCount * listenersPerClient);
    });
  });

  // ==================== ERROR HANDLING ====================

  describe('Error Handling', () => {
    it('should handle removal of listeners from destroyed target', () => {
      const handler = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler);

      // Destroy target
      mockTarget.removeAllListeners();

      // Cleanup should handle the destroyed target gracefully
      const cleaned = tracker.cleanupClient('client-1');

      expect(cleaned).toBe(1);
    });

    it('should handle cleanup of already-removed listeners', () => {
      const handler = () => {};

      tracker.registerListener('client-1', mockTarget, 'test', handler);

      // Manually remove the listener
      mockTarget.removeListener('test', handler);

      // Cleanup should still work
      const cleaned = tracker.cleanupClient('client-1');

      expect(cleaned).toBe(1);
    });
  });

  // ==================== MEMORY LEAK SCENARIOS ====================

  describe('Memory Leak Prevention', () => {
    it('should not accumulate listeners on repeated register/unregister', () => {
      for (let i = 0; i < 50; i++) {
        const handler = () => {};
        const reg = tracker.registerListener('client-1', mockTarget, 'test', handler);
        reg.unregister();
      }

      expect(tracker.getListenerCount('client-1')).toBe(0);
      expect(mockTarget.listenerCount('test')).toBe(0);
    });

    it('should prevent listener accumulation from long-running clients', () => {
      // Simulate a client that adds listeners over time
      for (let iteration = 0; iteration < 10; iteration++) {
        // Add listeners
        for (let i = 0; i < 5; i++) {
          const handler = () => {};
          tracker.registerListener('client-1', mockTarget, `event-${i}`, handler);
        }

        // Clean up old ones and keep fresh ones
        if (iteration > 0) {
          tracker.cleanupClient('client-1');
          expect(tracker.getListenerCount('client-1')).toBe(0);
        }
      }

      // Final state should be bounded
      expect(tracker.getListenerCount('client-1')).toBe(5);
    });

    it('should cleanup listeners on client disconnect simulation', () => {
      // Simulate multiple clients connecting and disconnecting
      for (let c = 0; c < 20; c++) {
        const clientId = `client-${c}`;

        // Client connects and adds listeners
        for (let i = 0; i < 5; i++) {
          const handler = () => {};
          tracker.registerListener(clientId, mockTarget, 'test', handler);
        }

        expect(tracker.getListenerCount(clientId)).toBe(5);

        // Client disconnects
        tracker.cleanupClient(clientId);

        expect(tracker.getListenerCount(clientId)).toBe(0);
      }

      // No listeners should remain
      expect(tracker.getTotalListenerCount()).toBe(0);
    });
  });

  // ==================== INTEGRATION SCENARIOS ====================

  describe('Integration Scenarios', () => {
    it('should handle WebSocket-like event patterns', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      // Typical WebSocket event pattern
      tracker.registerListener('client-1', mockTarget, 'message', handler1);
      tracker.registerListener('client-1', mockTarget, 'pong', handler2);
      tracker.registerListener('client-1', mockTarget, 'close', handler3);

      expect(tracker.getListenerCount('client-1')).toBe(3);

      // Simulate events
      mockTarget.emit('message', { data: 'test' });
      mockTarget.emit('pong');
      mockTarget.emit('close');

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      // Cleanup
      tracker.cleanupClient('client-1');
      mockTarget.emit('message', { data: 'test' });

      // Handlers should not be called again
      expect(handler1).toHaveBeenCalledTimes(1);
    });

    it('should survive realistic server workload', () => {
      // Simulate server with 100 concurrent clients
      const clientCount = 100;
      const eventsPerClient = 5;

      for (let c = 0; c < clientCount; c++) {
        for (let e = 0; e < eventsPerClient; e++) {
          const handler = () => {};
          tracker.registerListener(`client-${c}`, mockTarget, `event-${e}`, handler);
        }
      }

      expect(tracker.getTotalListenerCount()).toBe(clientCount * eventsPerClient);

      // Simulate 10% churn (10 clients disconnect)
      for (let c = 0; c < 10; c++) {
        tracker.cleanupClient(`client-${c}`);
      }

      expect(tracker.getTotalListenerCount()).toBe((clientCount - 10) * eventsPerClient);
      expect(tracker.getStats().totalClients).toBe(clientCount - 10);
    });
  });
});

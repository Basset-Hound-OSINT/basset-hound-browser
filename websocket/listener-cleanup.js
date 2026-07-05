/**
 * Event Listener Cleanup Manager
 * Issue #2: Event listener leaks
 * - Tracks event listeners
 * - Cleans up after 1000+ operations
 * - Prevents memory leaks from accumulated handlers
 */

class ListenerCleanupManager {
  constructor(options = {}) {
    this.maxListenersPerTarget = options.maxListenersPerTarget || 10;
    this.checkIntervalMs = options.checkIntervalMs || 10000;
    this.leakThreshold = options.leakThreshold || 1000; // Operations before cleanup
    this.operationCount = 0;
    this.trackedTargets = new Map(); // target -> { listeners: Map, addedAt: timestamp }
    this.listenerRegistry = new Map(); // Tracks all active listeners
    this.cleanupInterval = null;
    this.logger = options.logger || console;
  }

  /**
   * Track a target for listener cleanup
   * @param {EventEmitter} target - Object with addEventListener/on methods
   * @param {string} targetId - Unique identifier for the target
   * @returns {Object} Cleanup handle
   */
  trackTarget(target, targetId) {
    if (!this.trackedTargets.has(targetId)) {
      this.trackedTargets.set(targetId, {
        target,
        listeners: new Map(),
        addedAt: Date.now(),
        listenerCount: 0
      });
      this.logger.debug(`[ListenerCleanup] Tracking target: ${targetId}`);
    }

    return {
      addListener: (event, handler, options = {}) => this.addListener(targetId, event, handler, options),
      removeListener: (event, handler) => this.removeListener(targetId, event, handler),
      removeAllListeners: (event) => this.removeAllListeners(targetId, event),
      reportOperation: () => this.reportOperation()
    };
  }

  /**
   * Add a listener and track it
   * @private
   */
  addListener(targetId, event, handler, options = {}) {
    const targetInfo = this.trackedTargets.get(targetId);
    if (!targetInfo) {
      this.logger.warn(`[ListenerCleanup] Target not tracked: ${targetId}`);
      return;
    }

    const listenerId = `${targetId}:${event}:${handler.name || 'anonymous'}:${Date.now()}`;

    if (!targetInfo.listeners.has(event)) {
      targetInfo.listeners.set(event, []);
    }

    const listenerEntry = {
      event,
      handler,
      addedAt: Date.now(),
      active: true,
      removeAfterMs: options.removeAfterMs || null
    };

    targetInfo.listeners.get(event).push(listenerEntry);
    targetInfo.listenerCount++;

    this.listenerRegistry.set(listenerId, {
      targetId,
      ...listenerEntry
    });

    // Warn if too many listeners
    if (targetInfo.listenerCount > this.maxListenersPerTarget) {
      this.logger.warn(
        `[ListenerCleanup] High listener count for ${targetId}: ${targetInfo.listenerCount} listeners`
      );
    }

    return listenerId;
  }

  /**
   * Remove a listener and update tracking
   * @private
   */
  removeListener(targetId, event, handler) {
    const targetInfo = this.trackedTargets.get(targetId);
    if (!targetInfo || !targetInfo.listeners.has(event)) {
      return false;
    }

    const listeners = targetInfo.listeners.get(event);
    const index = listeners.findIndex(l => l.handler === handler);

    if (index !== -1) {
      listeners[index].active = false;
      listeners.splice(index, 1);
      targetInfo.listenerCount--;
      return true;
    }

    return false;
  }

  /**
   * Remove all listeners for an event
   * @private
   */
  removeAllListeners(targetId, event) {
    const targetInfo = this.trackedTargets.get(targetId);
    if (!targetInfo) return;

    if (event) {
      if (targetInfo.listeners.has(event)) {
        const count = targetInfo.listeners.get(event).length;
        targetInfo.listenerCount -= count;
        targetInfo.listeners.delete(event);
      }
    } else {
      targetInfo.listenerCount = 0;
      targetInfo.listeners.clear();
    }
  }

  /**
   * Report an operation and check for needed cleanup
   */
  reportOperation() {
    this.operationCount++;

    // Check if we need to cleanup
    if (this.operationCount >= this.leakThreshold) {
      this.performCleanup();
      this.operationCount = 0;
    }

    return {
      operationCount: this.operationCount,
      needsCleanup: this.operationCount >= this.leakThreshold
    };
  }

  /**
   * Perform cleanup of inactive listeners
   */
  performCleanup() {
    let cleanedCount = 0;

    for (const [targetId, targetInfo] of this.trackedTargets) {
      const eventsToRemove = [];

      for (const [event, listeners] of targetInfo.listeners) {
        const activeListeners = listeners.filter(l => {
          // Check if listener has expired
          if (l.removeAfterMs && (Date.now() - l.addedAt) > l.removeAfterMs) {
            l.active = false;
            cleanedCount++;
            this.logger.debug(
              `[ListenerCleanup] Cleaned expired listener: ${targetId}:${event}`
            );
            return false;
          }
          return l.active;
        });

        if (activeListeners.length === 0) {
          eventsToRemove.push(event);
        } else {
          targetInfo.listeners.set(event, activeListeners);
        }
      }

      // Remove empty event entries
      for (const event of eventsToRemove) {
        targetInfo.listeners.delete(event);
      }

      targetInfo.listenerCount = Array.from(targetInfo.listeners.values())
        .reduce((sum, listeners) => sum + listeners.length, 0);
    }

    this.logger.info(`[ListenerCleanup] Cleanup completed: removed ${cleanedCount} listeners`);
    return { cleaned: cleanedCount };
  }

  /**
   * Get listener statistics
   */
  getStats() {
    const stats = {
      totalTargets: this.trackedTargets.size,
      totalListeners: this.listenerRegistry.size,
      operationsSinceCleanup: this.operationCount,
      targets: {}
    };

    for (const [targetId, targetInfo] of this.trackedTargets) {
      const eventCounts = {};
      let totalForTarget = 0;

      for (const [event, listeners] of targetInfo.listeners) {
        const activeCount = listeners.filter(l => l.active).length;
        eventCounts[event] = activeCount;
        totalForTarget += activeCount;
      }

      stats.targets[targetId] = {
        listenerCount: totalForTarget,
        events: eventCounts,
        trackedSince: new Date(targetInfo.addedAt).toISOString()
      };
    }

    return stats;
  }

  /**
   * Start periodic cleanup
   */
  startPeriodicCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.checkIntervalMs);

    this.logger.info(`[ListenerCleanup] Started periodic cleanup every ${this.checkIntervalMs}ms`);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('[ListenerCleanup] Stopped periodic cleanup');
    }
  }

  /**
   * Force cleanup of a target
   */
  cleanupTarget(targetId) {
    const targetInfo = this.trackedTargets.get(targetId);
    if (!targetInfo) return;

    let count = 0;
    for (const [event, listeners] of targetInfo.listeners) {
      count += listeners.filter(l => l.active).length;
    }

    targetInfo.listeners.clear();
    targetInfo.listenerCount = 0;

    this.logger.info(`[ListenerCleanup] Force cleaned target ${targetId}: ${count} listeners`);
    return { cleaned: count };
  }

  /**
   * Force cleanup all targets
   */
  cleanupAll() {
    let totalCleaned = 0;

    for (const targetId of this.trackedTargets.keys()) {
      const result = this.cleanupTarget(targetId);
      totalCleaned += result.cleaned;
    }

    this.trackedTargets.clear();
    this.listenerRegistry.clear();
    this.operationCount = 0;

    this.logger.info(`[ListenerCleanup] Force cleaned all targets: ${totalCleaned} listeners`);
    return { cleaned: totalCleaned };
  }
}

module.exports = { ListenerCleanupManager };

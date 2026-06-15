/**
 * Event Listener Tracker Module (Phase 3 - Issue #4)
 *
 * Prevents unbounded event listener accumulation in WebSocket connections
 * by explicitly tracking, managing, and cleaning up event listeners
 *
 * Fixes:
 * - Explicit listener tracking per client
 * - Automatic cleanup on disconnect
 * - Listener limit enforcement
 * - Memory leak prevention
 */

class ListenerTracker {
  constructor(maxListenersPerClient = 50) {
    this.trackedListeners = new Map(); // Map<clientId, Set<listener>>
    this.maxListenersPerClient = maxListenersPerClient;
  }

  /**
   * Register a new listener for a client
   * @param {string} clientId - Client identifier
   * @param {object} target - Event emitter (ws, ipcMain, etc.)
   * @param {string} event - Event name
   * @param {function} handler - Event handler
   * @param {object} options - Options (once, etc.)
   */
  registerListener(clientId, target, event, handler, options = {}) {
    if (!this.trackedListeners.has(clientId)) {
      this.trackedListeners.set(clientId, []);
    }

    const listenerCount = this.trackedListeners.get(clientId).length;
    if (listenerCount >= this.maxListenersPerClient) {
      console.warn(
        `[ListenerTracker] Client ${clientId} has reached max listeners ` +
        `(${this.maxListenersPerClient}). New listener may not be tracked.`
      );
    }

    // Register the listener with the target
    if (options.once) {
      target.once(event, handler);
    } else {
      target.on(event, handler);
    }

    // Track it
    const listener = {
      target,
      event,
      handler,
      once: options.once || false,
      registeredAt: Date.now()
    };

    this.trackedListeners.get(clientId).push(listener);

    return {
      unregister: () => this.unregisterListener(clientId, listener)
    };
  }

  /**
   * Unregister a specific listener
   * @param {string} clientId - Client identifier
   * @param {object} listener - Listener object
   */
  unregisterListener(clientId, listener) {
    if (!this.trackedListeners.has(clientId)) {
      return;
    }

    const listeners = this.trackedListeners.get(clientId);
    const index = listeners.indexOf(listener);

    if (index !== -1) {
      listeners.splice(index, 1);
      listener.target.removeListener(listener.event, listener.handler);
    }
  }

  /**
   * Cleanup all listeners for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Number of listeners cleaned up
   */
  cleanupClient(clientId) {
    if (!this.trackedListeners.has(clientId)) {
      return 0;
    }

    const listeners = this.trackedListeners.get(clientId);
    let cleaned = 0;

    for (const listener of listeners) {
      try {
        listener.target.removeListener(listener.event, listener.handler);
        cleaned++;
      } catch (error) {
        console.warn(
          `[ListenerTracker] Failed to remove listener for client ${clientId}: ${error.message}`
        );
      }
    }

    this.trackedListeners.delete(clientId);
    return cleaned;
  }

  /**
   * Get listener count for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Number of listeners
   */
  getListenerCount(clientId) {
    if (!this.trackedListeners.has(clientId)) {
      return 0;
    }
    return this.trackedListeners.get(clientId).length;
  }

  /**
   * Get all active client IDs
   * @returns {Array<string>} Array of client IDs
   */
  getActiveClients() {
    return Array.from(this.trackedListeners.keys());
  }

  /**
   * Get total listener count across all clients
   * @returns {number} Total listeners
   */
  getTotalListenerCount() {
    let total = 0;
    for (const listeners of this.trackedListeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  /**
   * Check if a client has exceeded listener limit
   * @param {string} clientId - Client identifier
   * @returns {boolean} True if limit exceeded
   */
  hasExceededLimit(clientId) {
    return this.getListenerCount(clientId) >= this.maxListenersPerClient;
  }

  /**
   * Get statistics
   * @returns {object} Statistics object
   */
  getStats() {
    const stats = {
      totalClients: this.trackedListeners.size,
      totalListeners: this.getTotalListenerCount(),
      maxListenersPerClient: this.maxListenersPerClient,
      clientDetails: {}
    };

    for (const [clientId, listeners] of this.trackedListeners.entries()) {
      stats.clientDetails[clientId] = {
        listenerCount: listeners.length,
        listeners: listeners.map(l => ({
          event: l.event,
          once: l.once,
          age: Date.now() - l.registeredAt
        }))
      };
    }

    return stats;
  }

  /**
   * Cleanup all tracked listeners (for shutdown)
   * @returns {number} Total listeners cleaned up
   */
  cleanupAll() {
    let total = 0;

    for (const clientId of Array.from(this.trackedListeners.keys())) {
      total += this.cleanupClient(clientId);
    }

    return total;
  }
}

module.exports = { ListenerTracker };

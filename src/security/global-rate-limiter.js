/**
 * Basset Hound Browser - Global Rate Limiter
 * Implements system-wide rate limiting to prevent resource exhaustion
 *
 * Version: 1.0.0
 * Created: May 31, 2026
 */

const crypto = require('crypto');

class GlobalRateLimiter {
  /**
   * Constructor
   * @param {object} options Configuration options
   */
  constructor(options = {}) {
    // Rate limit configuration
    this.maxGlobalRequestsPerMinute = options.maxGlobalRequestsPerMinute || 10000;
    this.maxGlobalResourceUnitsPerMinute = options.maxGlobalResourceUnits || 50000;
    this.maxConcurrentConnections = options.maxConnections || 1000;

    // Current state (resets each minute)
    this.requests = 0;
    this.resources = 0;
    this.connections = 0;
    this.lastReset = Date.now();

    // Track top clients for analytics
    this.topClients = new Map();

    // Cleanup interval to prevent memory leaks
    this.cleanupInterval = setInterval(() => this._cleanup(), 60000);
  }

  /**
   * Check if request allowed at global level
   * @param {string} clientId Client identifier
   * @param {string} command Command name
   * @param {number} resourceCost Resource cost (default 1)
   * @returns {object} { allowed, reason?, retryAfter?, globalRemaining?, resourcesRemaining? }
   */
  canAccept(clientId, command, resourceCost = 1) {
    const now = Date.now();

    // Reset counters if minute window has passed
    if (now - this.lastReset > 60000) {
      this.requests = 0;
      this.resources = 0;
      this.topClients.clear();
      this.lastReset = now;
    }

    // Check global request limit
    if (this.requests >= this.maxGlobalRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'Global request limit exceeded',
        retryAfter: Math.ceil((this.lastReset + 60000 - now) / 1000)
      };
    }

    // Check global resource limit
    if (this.resources + resourceCost > this.maxGlobalResourceUnitsPerMinute) {
      return {
        allowed: false,
        reason: 'Global resource limit exceeded',
        retryAfter: Math.ceil((this.lastReset + 60000 - now) / 1000)
      };
    }

    // Check connection limit
    if (this.connections >= this.maxConcurrentConnections) {
      return {
        allowed: false,
        reason: 'Maximum concurrent connections exceeded'
      };
    }

    // Update counters
    this.requests++;
    this.resources += resourceCost;

    // Track top client (for analytics)
    const current = this.topClients.get(clientId) || 0;
    this.topClients.set(clientId, current + 1);

    return {
      allowed: true,
      globalRemaining: this.maxGlobalRequestsPerMinute - this.requests,
      resourcesRemaining: this.maxGlobalResourceUnitsPerMinute - this.resources
    };
  }

  /**
   * Register new connection
   * @returns {boolean} True if connection registered, false if at capacity
   */
  registerConnection() {
    if (this.connections >= this.maxConcurrentConnections) {
      return false;
    }
    this.connections++;
    return true;
  }

  /**
   * Unregister closed connection
   */
  unregisterConnection() {
    this.connections = Math.max(0, this.connections - 1);
  }

  /**
   * Get current statistics
   * @returns {object} Statistics about current rate limiting state
   */
  getStats() {
    const now = Date.now();
    return {
      requests: this.requests,
      maxRequests: this.maxGlobalRequestsPerMinute,
      requestsRemaining: Math.max(0, this.maxGlobalRequestsPerMinute - this.requests),
      resources: this.resources,
      maxResources: this.maxGlobalResourceUnitsPerMinute,
      resourcesRemaining: Math.max(0, this.maxGlobalResourceUnitsPerMinute - this.resources),
      connections: this.connections,
      maxConnections: this.maxConcurrentConnections,
      connectionsRemaining: Math.max(0, this.maxConcurrentConnections - this.connections),
      windowResetIn: Math.ceil((this.lastReset + 60000 - now) / 1000),
      topClients: Array.from(this.topClients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([clientId, count]) => ({ clientId, requestCount: count }))
    };
  }

  /**
   * Reset all counters (for testing)
   */
  reset() {
    this.requests = 0;
    this.resources = 0;
    this.connections = 0;
    this.lastReset = Date.now();
    this.topClients.clear();
  }

  /**
   * Cleanup interval handler
   * @private
   */
  _cleanup() {
    // Auto-clear tracking data if too many clients
    if (this.topClients.size > 10000) {
      const sorted = Array.from(this.topClients.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5000);
      this.topClients = new Map(sorted);
    }
  }

  /**
   * Destroy the limiter (cleanup intervals)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

/**
 * Get resource cost for a command
 * @param {string} command Command name
 * @returns {number} Resource cost (1-50)
 */
function getCommandResourceCost(command) {
  const costs = {
    // Low cost operations (1 unit)
    'ping': 1,
    'status': 1,
    'get_url': 1,
    'get_page_state': 1,
    'get_tab_info': 1,
    'get_active_tab': 1,

    // Medium cost operations (5 units)
    'extract_html': 5,
    'extract_text': 5,
    'get_cookies': 5,
    'get_local_storage': 5,
    'get_session_storage': 5,
    'get_network_logs': 5,

    // High cost operations (10 units)
    'screenshot': 10,
    'screenshot_viewport': 10,
    'screenshot_element': 10,
    'execute_javascript': 10,
    'fill_form': 10,

    // Very high cost operations (50 units)
    'screenshot_full_page': 50,
    'record_session': 50,
    'replay_session': 50,

    // Default: medium cost
    'default': 3
  };

  return costs[command] || costs.default;
}

module.exports = {
  GlobalRateLimiter,
  getCommandResourceCost
};

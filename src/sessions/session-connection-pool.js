/**
 * Basset Hound Browser - Session Connection Pool Isolation
 * Separate HTTP/HTTPS connections per session
 *
 * Version: 1.0.0
 * Created: June 13, 2026
 *
 * Provides:
 * - Independent HTTP agent per session
 * - No connection reuse across sessions
 * - Separate DNS cache per session
 * - Per-session request timeouts and limits
 */

const http = require('http');
const https = require('https');

/**
 * Session Connection Pool
 * Manages isolated connection pools for each session
 *
 * @class SessionConnectionPool
 */
class SessionConnectionPool {
  constructor(options = {}) {
    this.pools = new Map(); // sessionId -> { http, https, dnsCache }
    this.globalTimeout = options.globalTimeout || 30000; // 30 seconds
    this.maxConnectionsPerSession = options.maxConnectionsPerSession || 10;
    this.allowConnectionReuse = false; // Force no reuse

    // Statistics
    this.stats = {
      poolsCreated: 0,
      poolsDestroyed: 0,
      connectionsCreated: 0,
      connectionErrors: 0,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create isolated connection pool for session
   * Each session gets its own HTTP/HTTPS agents
   *
   * @param {string} sessionId - Session ID
   * @param {Object} options - Pool options
   * @returns {Object} Pool info
   */
  createPool(sessionId, options = {}) {
    if (this.pools.has(sessionId)) {
      return { created: false, message: 'Pool already exists' };
    }

    // Create isolated HTTP agent
    const httpAgent = new http.Agent({
      keepAlive: false, // Force connection closure after each request
      maxSockets: this.maxConnectionsPerSession,
      maxFreeSockets: 0,
      timeout: this.globalTimeout,
      keepAliveMsecs: 0
    });

    // Create isolated HTTPS agent
    const httpsAgent = new https.Agent({
      keepAlive: false, // Force connection closure after each request
      maxSockets: this.maxConnectionsPerSession,
      maxFreeSockets: 0,
      timeout: this.globalTimeout,
      keepAliveMsecs: 0,
      rejectUnauthorized: options.rejectUnauthorized !== false
    });

    // Create isolated DNS cache
    const dnsCache = new Map();

    // Store pool
    const pool = {
      sessionId,
      httpAgent,
      httpsAgent,
      dnsCache,
      createdAt: Date.now(),
      requestCount: 0,
      errorCount: 0,
      timeout: options.timeout || this.globalTimeout
    };

    this.pools.set(sessionId, pool);
    this.stats.poolsCreated++;

    return {
      created: true,
      sessionId,
      agents: { http: 'isolated', https: 'isolated' },
      dnsCache: 'isolated'
    };
  }

  /**
   * Get agents for session
   * Returns HTTP/HTTPS agents for this session only
   *
   * @param {string} sessionId - Session ID
   * @returns {Object} { httpAgent, httpsAgent }
   */
  getAgents(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error(`No pool for session ${sessionId}`);
    }

    return {
      httpAgent: pool.httpAgent,
      httpsAgent: pool.httpsAgent
    };
  }

  /**
   * Get HTTP agent for session
   * @param {string} sessionId - Session ID
   * @returns {Object} HTTP agent
   */
  getHttpAgent(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error(`No pool for session ${sessionId}`);
    }

    return pool.httpAgent;
  }

  /**
   * Get HTTPS agent for session
   * @param {string} sessionId - Session ID
   * @returns {Object} HTTPS agent
   */
  getHttpsAgent(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error(`No pool for session ${sessionId}`);
    }

    return pool.httpsAgent;
  }

  /**
   * Record request for session
   * Track request statistics
   *
   * @param {string} sessionId - Session ID
   * @param {Object} metadata - Request metadata
   */
  recordRequest(sessionId, metadata = {}) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return;
    }

    pool.requestCount++;

    return {
      sessionId,
      totalRequests: pool.requestCount,
      timestamp: Date.now()
    };
  }

  /**
   * Record error for session
   * Track connection errors
   *
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error object
   */
  recordError(sessionId, error) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return;
    }

    pool.errorCount++;
    this.stats.connectionErrors++;

    return {
      sessionId,
      totalErrors: pool.errorCount,
      errorRate: (pool.errorCount / pool.requestCount).toFixed(4),
      timestamp: Date.now()
    };
  }

  /**
   * Get cached DNS result for session
   * Each session has independent DNS cache
   *
   * @param {string} sessionId - Session ID
   * @param {string} hostname - Hostname to resolve
   * @returns {string|null} Cached IP or null
   */
  getDnsCache(sessionId, hostname) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return null;
    }

    return pool.dnsCache.get(hostname) || null;
  }

  /**
   * Cache DNS result for session
   * @param {string} sessionId - Session ID
   * @param {string} hostname - Hostname
   * @param {string} ip - IP address
   */
  setDnsCache(sessionId, hostname, ip) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return;
    }

    pool.dnsCache.set(hostname, {
      ip,
      timestamp: Date.now(),
      ttl: 300000 // 5 minutes
    });
  }

  /**
   * Clear DNS cache for session
   * @param {string} sessionId - Session ID
   */
  clearDnsCache(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return;
    }

    pool.dnsCache.clear();
  }

  /**
   * Set session timeout
   * Customize timeout for specific session
   *
   * @param {string} sessionId - Session ID
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(sessionId, timeout) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error(`No pool for session ${sessionId}`);
    }

    pool.timeout = timeout;

    // Update agent timeouts
    pool.httpAgent.timeout = timeout;
    pool.httpsAgent.timeout = timeout;

    return { sessionId, timeout };
  }

  /**
   * Get pool statistics for session
   * @param {string} sessionId - Session ID
   * @returns {Object} Pool stats
   */
  getPoolStats(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return null;
    }

    return {
      sessionId,
      createdAt: pool.createdAt,
      age: Date.now() - pool.createdAt,
      requests: pool.requestCount,
      errors: pool.errorCount,
      errorRate: pool.requestCount > 0
        ? (pool.errorCount / pool.requestCount).toFixed(4)
        : 0,
      dnsCacheSize: pool.dnsCache.size,
      timeout: pool.timeout
    };
  }

  /**
   * Get all pool statistics
   * @returns {Object} All pools stats
   */
  getAllPoolStats() {
    const stats = {};

    for (const [sessionId, pool] of this.pools.entries()) {
      stats[sessionId] = this.getPoolStats(sessionId);
    }

    return stats;
  }

  /**
   * Destroy pool for session
   * Clean up connections and resources
   *
   * @param {string} sessionId - Session ID
   */
  destroyPool(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return { destroyed: false, message: 'Pool not found' };
    }

    // Destroy agents
    pool.httpAgent.destroy();
    pool.httpsAgent.destroy();

    // Clear DNS cache
    pool.dnsCache.clear();

    // Remove from map
    this.pools.delete(sessionId);
    this.stats.poolsDestroyed++;

    return { destroyed: true, sessionId };
  }

  /**
   * Get pool information
   * @param {string} sessionId - Session ID
   * @returns {Object} Pool info
   */
  getPoolInfo(sessionId) {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      return null;
    }

    return {
      sessionId,
      exists: true,
      createdAt: pool.createdAt,
      age: Date.now() - pool.createdAt,
      httpAgentActive: !pool.httpAgent.destroyed,
      httpsAgentActive: !pool.httpsAgent.destroyed,
      dnsCacheSize: pool.dnsCache.size,
      timeout: pool.timeout
    };
  }

  /**
   * Verify connection isolation
   * Check that sessions don't share connections
   *
   * @param {string} sessionId1 - First session ID
   * @param {string} sessionId2 - Second session ID
   * @returns {Object} Isolation verification
   */
  verifyIsolation(sessionId1, sessionId2) {
    const pool1 = this.pools.get(sessionId1);
    const pool2 = this.pools.get(sessionId2);

    if (!pool1 || !pool2) {
      return { valid: false, message: 'One or both pools not found' };
    }

    // Verify different agent instances
    const httpIsolated = pool1.httpAgent !== pool2.httpAgent;
    const httpsIsolated = pool1.httpsAgent !== pool2.httpsAgent;
    const dnsIsolated = pool1.dnsCache !== pool2.dnsCache;

    return {
      valid: httpIsolated && httpsIsolated && dnsIsolated,
      httpIsolated,
      httpsIsolated,
      dnsIsolated
    };
  }

  /**
   * Get global statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      activePools: this.pools.size
    };
  }

  /**
   * Cleanup all pools
   * Destroy all connections for shutdown
   *
   * @returns {Object} Cleanup result
   */
  cleanup() {
    const sessionIds = Array.from(this.pools.keys());

    for (const sessionId of sessionIds) {
      this.destroyPool(sessionId);
    }

    return {
      cleaned: true,
      poolsDestroyed: sessionIds.length
    };
  }
}

module.exports = SessionConnectionPool;

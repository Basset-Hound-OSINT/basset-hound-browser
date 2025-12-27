/**
 * Basset Hound Browser - Proxy Chain Manager Module
 * Handles proxy chaining with multiple proxies in sequence
 * Supports different chain types: strict, random, round-robin
 */

const net = require('net');
const { EventEmitter } = require('events');

/**
 * Proxy chain types
 */
const CHAIN_TYPES = {
  STRICT: 'strict',       // Use proxies in exact order
  RANDOM: 'random',       // Randomly select proxies for each request
  ROUND_ROBIN: 'round_robin' // Rotate through proxies sequentially
};

/**
 * Chain states
 */
const CHAIN_STATES = {
  DISABLED: 'disabled',
  ENABLED: 'enabled',
  VALIDATING: 'validating',
  ERROR: 'error'
};

/**
 * ProxyChainManager class
 * Manages proxy chains for enhanced anonymity and reliability
 */
class ProxyChainManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Chain configuration
    this.chain = [];
    this.chainType = options.chainType || CHAIN_TYPES.STRICT;
    this.state = CHAIN_STATES.DISABLED;

    // Round-robin tracking
    this.currentIndex = 0;

    // Failover configuration
    this.failoverEnabled = options.failoverEnabled !== false;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.connectionTimeout = options.connectionTimeout || 10000;

    // Statistics
    this.stats = {
      requestCount: 0,
      failoverCount: 0,
      proxyStats: new Map()
    };

    // Validation cache
    this.validationCache = new Map();
    this.validationCacheTimeout = options.validationCacheTimeout || 300000; // 5 minutes
  }

  /**
   * Set the proxy chain
   * @param {Array} proxies - Array of proxy configurations
   * @returns {Object} Result of setting the chain
   */
  setChain(proxies) {
    if (!Array.isArray(proxies)) {
      return {
        success: false,
        error: 'Proxies must be an array'
      };
    }

    if (proxies.length === 0) {
      return this.clearChain();
    }

    // Validate each proxy in the chain
    const validatedProxies = [];
    const errors = [];

    for (let i = 0; i < proxies.length; i++) {
      const proxy = proxies[i];
      const validation = this._validateProxyConfig(proxy);

      if (validation.valid) {
        validatedProxies.push({
          ...proxy,
          type: (proxy.type || 'http').toLowerCase(),
          index: i
        });
      } else {
        errors.push({
          index: i,
          proxy,
          errors: validation.errors
        });
      }
    }

    if (validatedProxies.length === 0) {
      return {
        success: false,
        error: 'No valid proxies in chain',
        validationErrors: errors
      };
    }

    this.chain = validatedProxies;
    this.currentIndex = 0;
    this.state = CHAIN_STATES.ENABLED;

    // Initialize stats for each proxy
    for (const proxy of this.chain) {
      const key = this._getProxyKey(proxy);
      if (!this.stats.proxyStats.has(key)) {
        this.stats.proxyStats.set(key, {
          requestCount: 0,
          successCount: 0,
          failureCount: 0,
          lastUsed: null,
          avgLatency: 0
        });
      }
    }

    this.emit('chainSet', { chain: this.chain, type: this.chainType });

    console.log(`[ProxyChainManager] Chain set with ${validatedProxies.length} proxies (type: ${this.chainType})`);

    return {
      success: true,
      chainLength: validatedProxies.length,
      chainType: this.chainType,
      invalidProxies: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Add a proxy to the chain
   * @param {Object} proxy - Proxy configuration
   * @param {number} position - Optional position in chain (default: end)
   * @returns {Object} Result
   */
  addToChain(proxy, position = -1) {
    const validation = this._validateProxyConfig(proxy);

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const normalizedProxy = {
      ...proxy,
      type: (proxy.type || 'http').toLowerCase()
    };

    if (position >= 0 && position < this.chain.length) {
      this.chain.splice(position, 0, normalizedProxy);
    } else {
      this.chain.push(normalizedProxy);
    }

    // Update indices
    this.chain.forEach((p, i) => p.index = i);

    if (this.chain.length > 0 && this.state === CHAIN_STATES.DISABLED) {
      this.state = CHAIN_STATES.ENABLED;
    }

    // Initialize stats
    const key = this._getProxyKey(normalizedProxy);
    if (!this.stats.proxyStats.has(key)) {
      this.stats.proxyStats.set(key, {
        requestCount: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: null,
        avgLatency: 0
      });
    }

    console.log(`[ProxyChainManager] Proxy added to chain: ${proxy.host}:${proxy.port}`);

    return {
      success: true,
      chainLength: this.chain.length,
      position: position >= 0 ? position : this.chain.length - 1
    };
  }

  /**
   * Remove a proxy from the chain
   * @param {number} index - Index of proxy to remove
   * @returns {Object} Result
   */
  removeFromChain(index) {
    if (index < 0 || index >= this.chain.length) {
      return {
        success: false,
        error: 'Invalid chain index'
      };
    }

    const removed = this.chain.splice(index, 1)[0];

    // Update indices
    this.chain.forEach((p, i) => p.index = i);

    // Adjust round-robin index
    if (this.currentIndex >= this.chain.length) {
      this.currentIndex = 0;
    }

    if (this.chain.length === 0) {
      this.state = CHAIN_STATES.DISABLED;
    }

    console.log(`[ProxyChainManager] Proxy removed from chain: ${removed.host}:${removed.port}`);

    return {
      success: true,
      removed: {
        host: removed.host,
        port: removed.port,
        type: removed.type
      },
      chainLength: this.chain.length
    };
  }

  /**
   * Clear the proxy chain
   * @returns {Object} Result
   */
  clearChain() {
    this.chain = [];
    this.currentIndex = 0;
    this.state = CHAIN_STATES.DISABLED;
    this.validationCache.clear();

    this.emit('chainCleared');

    console.log('[ProxyChainManager] Chain cleared');

    return {
      success: true,
      message: 'Proxy chain cleared'
    };
  }

  /**
   * Set the chain type
   * @param {string} type - Chain type (strict, random, round_robin)
   * @returns {Object} Result
   */
  setChainType(type) {
    const normalizedType = type.toLowerCase();

    if (!Object.values(CHAIN_TYPES).includes(normalizedType)) {
      return {
        success: false,
        error: `Invalid chain type. Must be one of: ${Object.values(CHAIN_TYPES).join(', ')}`
      };
    }

    this.chainType = normalizedType;
    this.currentIndex = 0;

    console.log(`[ProxyChainManager] Chain type set to: ${normalizedType}`);

    return {
      success: true,
      chainType: this.chainType
    };
  }

  /**
   * Get the next proxy based on chain type
   * @returns {Object|null} Next proxy configuration
   */
  getNextProxy() {
    if (this.chain.length === 0) {
      return null;
    }

    let proxy;

    switch (this.chainType) {
      case CHAIN_TYPES.RANDOM:
        const randomIndex = Math.floor(Math.random() * this.chain.length);
        proxy = this.chain[randomIndex];
        break;

      case CHAIN_TYPES.ROUND_ROBIN:
        proxy = this.chain[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.chain.length;
        break;

      case CHAIN_TYPES.STRICT:
      default:
        // For strict mode, return the first proxy (the entry point)
        // The full chain is used for proxying
        proxy = this.chain[0];
        break;
    }

    // Update stats
    const key = this._getProxyKey(proxy);
    const stats = this.stats.proxyStats.get(key);
    if (stats) {
      stats.requestCount++;
      stats.lastUsed = new Date().toISOString();
    }

    this.stats.requestCount++;

    return proxy;
  }

  /**
   * Get the full chain for strict mode routing
   * @returns {Array} Full proxy chain
   */
  getFullChain() {
    return [...this.chain];
  }

  /**
   * Get proxy rules for Electron based on chain type
   * @returns {string} Proxy rules string
   */
  getProxyRules() {
    if (this.chain.length === 0) {
      return 'direct://';
    }

    // For most chain types, we use the first/next proxy
    // Note: True proxy chaining requires special handling at the network level
    // Electron's proxy settings only support a single proxy
    // For full chain support, you'd need a local proxy server that chains requests

    const proxy = this.chainType === CHAIN_TYPES.STRICT
      ? this.chain[0]
      : this.getNextProxy();

    if (!proxy) {
      return 'direct://';
    }

    const type = proxy.type || 'http';
    if (type === 'socks5' || type === 'socks4') {
      return `${type}://${proxy.host}:${proxy.port}`;
    }

    return `http=${proxy.host}:${proxy.port};https=${proxy.host}:${proxy.port}`;
  }

  /**
   * Validate a proxy configuration
   * @param {Object} proxy - Proxy configuration
   * @returns {Object} Validation result
   * @private
   */
  _validateProxyConfig(proxy) {
    const errors = [];

    if (!proxy) {
      return { valid: false, errors: ['Proxy configuration is required'] };
    }

    if (!proxy.host) {
      errors.push('Proxy host is required');
    }

    if (!proxy.port) {
      errors.push('Proxy port is required');
    } else if (typeof proxy.port !== 'number' || proxy.port < 1 || proxy.port > 65535) {
      errors.push('Proxy port must be a number between 1 and 65535');
    }

    const validTypes = ['http', 'https', 'socks4', 'socks5'];
    if (proxy.type && !validTypes.includes(proxy.type.toLowerCase())) {
      errors.push(`Invalid proxy type. Must be one of: ${validTypes.join(', ')}`);
    }

    if (proxy.auth) {
      if (!proxy.auth.username) {
        errors.push('Proxy authentication requires username');
      }
      if (!proxy.auth.password) {
        errors.push('Proxy authentication requires password');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get a unique key for a proxy
   * @param {Object} proxy - Proxy configuration
   * @returns {string} Unique key
   * @private
   */
  _getProxyKey(proxy) {
    return `${proxy.host}:${proxy.port}`;
  }

  /**
   * Test connectivity for a single proxy
   * @param {Object} proxy - Proxy configuration
   * @returns {Promise<Object>} Test result
   */
  async testProxy(proxy) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          success: false,
          proxy: { host: proxy.host, port: proxy.port },
          error: 'Connection timeout',
          latency: Date.now() - startTime
        });
      }, this.connectionTimeout);

      socket.connect(proxy.port, proxy.host, () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        socket.destroy();

        // Update stats
        const key = this._getProxyKey(proxy);
        const stats = this.stats.proxyStats.get(key);
        if (stats) {
          stats.successCount++;
          // Update average latency
          stats.avgLatency = stats.avgLatency
            ? (stats.avgLatency + latency) / 2
            : latency;
        }

        resolve({
          success: true,
          proxy: { host: proxy.host, port: proxy.port },
          latency
        });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();

        // Update stats
        const key = this._getProxyKey(proxy);
        const stats = this.stats.proxyStats.get(key);
        if (stats) {
          stats.failureCount++;
        }

        resolve({
          success: false,
          proxy: { host: proxy.host, port: proxy.port },
          error: error.message,
          code: error.code
        });
      });
    });
  }

  /**
   * Validate the entire proxy chain connectivity
   * @returns {Promise<Object>} Validation result
   */
  async validateChain() {
    if (this.chain.length === 0) {
      return {
        success: false,
        error: 'No proxies in chain'
      };
    }

    this.state = CHAIN_STATES.VALIDATING;
    this.emit('validating');

    const results = [];
    let allValid = true;

    for (const proxy of this.chain) {
      // Check cache first
      const cacheKey = this._getProxyKey(proxy);
      const cached = this.validationCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.validationCacheTimeout) {
        results.push(cached.result);
        if (!cached.result.success) allValid = false;
        continue;
      }

      const result = await this.testProxy(proxy);
      results.push(result);

      // Cache the result
      this.validationCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      if (!result.success) {
        allValid = false;
      }
    }

    this.state = allValid ? CHAIN_STATES.ENABLED : CHAIN_STATES.ERROR;
    this.emit('validated', { success: allValid, results });

    console.log(`[ProxyChainManager] Chain validation: ${allValid ? 'PASSED' : 'FAILED'}`);

    return {
      success: allValid,
      chainLength: this.chain.length,
      results,
      validCount: results.filter(r => r.success).length,
      invalidCount: results.filter(r => !r.success).length
    };
  }

  /**
   * Handle proxy failure and attempt failover
   * @param {Object} failedProxy - The proxy that failed
   * @returns {Object} Failover result
   */
  async handleFailover(failedProxy) {
    if (!this.failoverEnabled) {
      return {
        success: false,
        error: 'Failover is disabled'
      };
    }

    const failedKey = this._getProxyKey(failedProxy);

    // Mark the proxy as failed in stats
    const stats = this.stats.proxyStats.get(failedKey);
    if (stats) {
      stats.failureCount++;
    }

    // Find an alternative proxy
    const alternatives = this.chain.filter(
      p => this._getProxyKey(p) !== failedKey
    );

    if (alternatives.length === 0) {
      return {
        success: false,
        error: 'No alternative proxies available'
      };
    }

    // Test alternatives and find a working one
    for (const alt of alternatives) {
      const testResult = await this.testProxy(alt);
      if (testResult.success) {
        this.stats.failoverCount++;
        this.emit('failover', { from: failedProxy, to: alt });

        console.log(`[ProxyChainManager] Failover: ${failedKey} -> ${alt.host}:${alt.port}`);

        return {
          success: true,
          failedProxy: { host: failedProxy.host, port: failedProxy.port },
          newProxy: { host: alt.host, port: alt.port },
          latency: testResult.latency
        };
      }
    }

    return {
      success: false,
      error: 'All alternative proxies failed'
    };
  }

  /**
   * Get current chain status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      state: this.state,
      enabled: this.state === CHAIN_STATES.ENABLED,
      chainType: this.chainType,
      chainLength: this.chain.length,
      currentIndex: this.currentIndex,
      failoverEnabled: this.failoverEnabled,
      chain: this.chain.map(p => ({
        host: p.host,
        port: p.port,
        type: p.type,
        index: p.index,
        hasAuth: !!p.auth
      }))
    };
  }

  /**
   * Get chain configuration
   * @returns {Object} Chain configuration
   */
  getChainConfig() {
    return {
      chain: this.chain.map(p => ({
        host: p.host,
        port: p.port,
        type: p.type,
        auth: p.auth ? { username: p.auth.username } : undefined
      })),
      chainType: this.chainType,
      failoverEnabled: this.failoverEnabled,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const proxyStats = {};
    for (const [key, value] of this.stats.proxyStats) {
      proxyStats[key] = { ...value };
    }

    return {
      requestCount: this.stats.requestCount,
      failoverCount: this.stats.failoverCount,
      chainLength: this.chain.length,
      proxyStats
    };
  }

  /**
   * Configure chain options
   * @param {Object} options - Configuration options
   * @returns {Object} Configuration result
   */
  configure(options) {
    if (options.chainType) {
      const result = this.setChainType(options.chainType);
      if (!result.success) return result;
    }

    if (options.failoverEnabled !== undefined) {
      this.failoverEnabled = options.failoverEnabled;
    }

    if (options.maxRetries !== undefined) {
      this.maxRetries = options.maxRetries;
    }

    if (options.retryDelay !== undefined) {
      this.retryDelay = options.retryDelay;
    }

    if (options.connectionTimeout !== undefined) {
      this.connectionTimeout = options.connectionTimeout;
    }

    console.log('[ProxyChainManager] Configuration updated');

    return {
      success: true,
      config: {
        chainType: this.chainType,
        failoverEnabled: this.failoverEnabled,
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        connectionTimeout: this.connectionTimeout
      }
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearChain();
    this.stats.proxyStats.clear();
    this.validationCache.clear();
    this.removeAllListeners();
    console.log('[ProxyChainManager] Cleanup complete');
  }
}

// Export singleton instance and class
const proxyChainManager = new ProxyChainManager();

module.exports = {
  proxyChainManager,
  ProxyChainManager,
  CHAIN_TYPES,
  CHAIN_STATES
};

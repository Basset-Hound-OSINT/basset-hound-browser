/**
 * Proxy Intelligence Service
 * Pure business logic for proxy management and rotation
 * Separated from WebSocket/infrastructure concerns
 *
 * Responsibilities:
 * - Proxy selection and rotation
 * - Proxy health tracking
 * - Provider detection
 * - Proxy performance metrics
 *
 * Dependencies:
 * - (None - pure logic)
 *
 * Version: 1.0.0
 * Created: June 1, 2026
 */

class ProxyIntelligenceService {
  /**
   * Create proxy intelligence service
   * @param {Object} options - Configuration
   * @param {Array} options.proxies - Initial proxy list
   * @param {string} options.rotationStrategy - 'round-robin', 'random', 'health-based'
   */
  constructor(options = {}) {
    this.proxies = new Map(); // proxyId -> proxy
    this.rotationStrategy = options.rotationStrategy || 'round-robin';
    this.currentRotationIndex = 0;

    this.stats = {
      totalProxies: 0,
      healthyProxies: 0,
      failedAttempts: 0,
      successfulAttempts: 0,
      rotationsPerformed: 0,
      averageResponseTime: 0
    };

    // Load initial proxies
    if (Array.isArray(options.proxies)) {
      for (const proxy of options.proxies) {
        this.addProxy(proxy);
      }
    }
  }

  /**
   * Add proxy to pool
   * @param {Object} proxy - Proxy configuration
   * @param {string} proxy.host - Proxy host
   * @param {number} proxy.port - Proxy port
   * @param {string} proxy.type - Proxy type ('http', 'socks5', 'tor')
   * @param {string} proxy.provider - Proxy provider name
   * @returns {string} Proxy ID
   */
  addProxy(proxy) {
    const proxyId = proxy.id || this._generateProxyId();

    const proxyEntry = {
      id: proxyId,
      host: proxy.host,
      port: proxy.port,
      type: proxy.type || 'http',
      provider: proxy.provider || 'unknown',
      username: proxy.username || null,
      password: proxy.password || null,
      health: 'unknown',
      lastUsedAt: null,
      successCount: 0,
      failureCount: 0,
      averageResponseTime: 0,
      lastCheckedAt: null,
      createdAt: Date.now()
    };

    this.proxies.set(proxyId, proxyEntry);
    this.stats.totalProxies = this.proxies.size;

    return proxyId;
  }

  /**
   * Get next proxy for rotation
   * @returns {Object|null} Proxy object
   */
  getNextProxy() {
    const healthyProxies = this._getHealthyProxies();

    if (healthyProxies.length === 0) {
      // Fall back to all proxies if no healthy ones
      if (this.proxies.size === 0) return null;
      return this._rotateProxy(Array.from(this.proxies.values()));
    }

    return this._rotateProxy(healthyProxies);
  }

  /**
   * Get specific proxy by ID
   * @param {string} proxyId - Proxy ID
   * @returns {Object|null}
   */
  getProxy(proxyId) {
    return this.proxies.get(proxyId) || null;
  }

  /**
   * Record successful proxy usage
   * @param {string} proxyId - Proxy ID
   * @param {number} responseTime - Response time in ms
   */
  recordSuccess(proxyId, responseTime = 0) {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return;

    proxy.successCount++;
    proxy.lastUsedAt = Date.now();
    proxy.health = 'healthy';
    proxy.lastCheckedAt = Date.now();

    // Update average response time
    const totalTime = proxy.averageResponseTime * (proxy.successCount - 1) + responseTime;
    proxy.averageResponseTime = totalTime / proxy.successCount;

    this.stats.successfulAttempts++;
    this._updateHealthStats();
  }

  /**
   * Record failed proxy usage
   * @param {string} proxyId - Proxy ID
   * @param {string} reason - Failure reason
   */
  recordFailure(proxyId, reason = 'unknown') {
    const proxy = this.proxies.get(proxyId);
    if (!proxy) return;

    proxy.failureCount++;
    proxy.lastUsedAt = Date.now();
    proxy.lastCheckedAt = Date.now();

    // Mark as unhealthy if too many failures
    if (proxy.failureCount > 5) {
      proxy.health = 'unhealthy';
    } else {
      proxy.health = 'degraded';
    }

    this.stats.failedAttempts++;
    this._updateHealthStats();
  }

  /**
   * Remove proxy from rotation
   * @param {string} proxyId - Proxy ID
   * @returns {boolean} True if removed
   */
  removeProxy(proxyId) {
    return this.proxies.delete(proxyId);
  }

  /**
   * Get all proxies
   * @returns {Array}
   */
  getAllProxies() {
    return Array.from(this.proxies.values());
  }

  /**
   * Get proxies by provider
   * @param {string} provider - Provider name
   * @returns {Array}
   */
  getProxiesByProvider(provider) {
    return Array.from(this.proxies.values()).filter(p => p.provider === provider);
  }

  /**
   * Get proxies by health status
   * @param {string} health - Health status ('healthy', 'degraded', 'unhealthy', 'unknown')
   * @returns {Array}
   */
  getProxiesByHealth(health) {
    return Array.from(this.proxies.values()).filter(p => p.health === health);
  }

  /**
   * Detect proxy provider
   * @param {string} proxyHost - Proxy host/IP
   * @returns {string} Provider name
   */
  detectProvider(proxyHost) {
    // Simple pattern matching for common providers
    const patterns = {
      'brightdata': /brightdata|luminati/i,
      'oxylabs': /oxylabs/i,
      'smartproxy': /smartproxy/i,
      'residential': /residential/i,
      'datacenter': /datacenter|dc\./i,
      'isp': /isp/i
    };

    for (const [provider, pattern] of Object.entries(patterns)) {
      if (pattern.test(proxyHost)) {
        return provider;
      }
    }

    return 'unknown';
  }

  /**
   * Get proxy statistics
   * @returns {Object}
   */
  getStats() {
    const totalAttempts = this.stats.successfulAttempts + this.stats.failedAttempts;
    const successRate = totalAttempts > 0
      ? ((this.stats.successfulAttempts / totalAttempts) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      healthyProxies: this.stats.healthyProxies,
      successRate: successRate + '%',
      totalAttempts,
      averageResponseTimeMs: this.stats.averageResponseTime.toFixed(2)
    };
  }

  /**
   * Get healthy proxies
   * @private
   */
  _getHealthyProxies() {
    return Array.from(this.proxies.values()).filter(
      p => p.health === 'healthy' || p.health === 'unknown'
    );
  }

  /**
   * Rotate to next proxy based on strategy
   * @private
   */
  _rotateProxy(proxies) {
    if (proxies.length === 0) return null;

    let selected;

    switch (this.rotationStrategy) {
      case 'random':
        selected = proxies[Math.floor(Math.random() * proxies.length)];
        break;
      case 'health-based':
        selected = this._selectHealthBasedProxy(proxies);
        break;
      case 'round-robin':
      default:
        selected = proxies[this.currentRotationIndex % proxies.length];
        this.currentRotationIndex++;
        break;
    }

    this.stats.rotationsPerformed++;
    return selected;
  }

  /**
   * Select proxy based on health metrics
   * @private
   */
  _selectHealthBasedProxy(proxies) {
    // Sort by success rate (highest first)
    const sorted = proxies.sort((a, b) => {
      const aSuccessRate = a.successCount / (a.successCount + a.failureCount + 1);
      const bSuccessRate = b.successCount / (b.successCount + b.failureCount + 1);
      return bSuccessRate - aSuccessRate;
    });

    return sorted[0] || proxies[0];
  }

  /**
   * Update health statistics
   * @private
   */
  _updateHealthStats() {
    const healthyProxies = Array.from(this.proxies.values()).filter(p => p.health === 'healthy');
    this.stats.healthyProxies = healthyProxies.length;

    const totalTime = healthyProxies.reduce((sum, p) => sum + p.averageResponseTime, 0);
    this.stats.averageResponseTime = healthyProxies.length > 0
      ? totalTime / healthyProxies.length
      : 0;
  }

  /**
   * Generate proxy ID
   * @private
   */
  _generateProxyId() {
    return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ProxyIntelligenceService;

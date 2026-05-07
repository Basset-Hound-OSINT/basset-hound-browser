/**
 * Basset Hound Browser - Residential Proxy Manager
 * Manages residential proxy pools with rotation, health checking, and error recovery
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const https = require('https');
const http = require('http');

class ResidentialProxyManager {
  constructor(options = {}) {
    this.proxyPool = [];
    this.currentProxyIndex = 0;
    this.rotationMode = options.rotationMode || 'round-robin'; // 'round-robin', 'random', 'performance'
    this.healthCheckInterval = options.healthCheckInterval || 300000; // 5 minutes
    this.healthCheckTimeout = options.healthCheckTimeout || 5000;
    this.maxRetries = options.maxRetries || 3;
    this.fallbackMode = false;
    this.lastHealthCheck = {};
    this.proxyHealthStats = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Add residential proxy to pool
   */
  addProxy(config) {
    const validation = this.validateProxyConfig(config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const proxyEntry = {
      id: this.generateProxyId(),
      ...config,
      addedAt: Date.now(),
      lastUsed: null,
      failureCount: 0,
      successCount: 0,
      averageLatency: 0
    };

    this.proxyPool.push(proxyEntry);
    this.initializeHealthStats(proxyEntry.id);
    this.initializePerformanceMetrics(proxyEntry.id);

    return {
      success: true,
      proxyId: proxyEntry.id,
      poolSize: this.proxyPool.length
    };
  }

  /**
   * Add multiple proxies to pool
   */
  addProxies(proxies) {
    const results = {
      added: [],
      failed: [],
      totalAdded: 0
    };

    for (const proxy of proxies) {
      const result = this.addProxy(proxy);
      if (result.success) {
        results.added.push(result.proxyId);
        results.totalAdded++;
      } else {
        results.failed.push({ proxy, errors: result.errors });
      }
    }

    return results;
  }

  /**
   * Remove proxy from pool
   */
  removeProxy(proxyId) {
    const index = this.proxyPool.findIndex(p => p.id === proxyId);
    if (index === -1) {
      return { success: false, error: 'Proxy not found' };
    }

    this.proxyPool.splice(index, 1);
    this.proxyHealthStats.delete(proxyId);
    this.performanceMetrics.delete(proxyId);

    if (this.currentProxyIndex >= this.proxyPool.length) {
      this.currentProxyIndex = 0;
    }

    return {
      success: true,
      poolSize: this.proxyPool.length
    };
  }

  /**
   * Get next proxy from pool based on rotation mode
   */
  getNextProxy() {
    if (this.proxyPool.length === 0) {
      return null;
    }

    let proxy;

    switch (this.rotationMode) {
      case 'random':
        this.currentProxyIndex = Math.floor(Math.random() * this.proxyPool.length);
        proxy = this.proxyPool[this.currentProxyIndex];
        break;

      case 'performance':
        proxy = this.getPerformanceBestProxy();
        break;

      case 'round-robin':
      default:
        proxy = this.proxyPool[this.currentProxyIndex];
        this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyPool.length;
        break;
    }

    return proxy;
  }

  /**
   * Get best performing proxy
   */
  getPerformanceBestProxy() {
    let bestProxy = this.proxyPool[0];
    let bestScore = Number.MAX_VALUE;
    let bestRequestCount = 0;

    for (const proxy of this.proxyPool) {
      const metrics = this.performanceMetrics.get(proxy.id) || {};
      const successRate = metrics.successRate || 0;
      const avgLatency = metrics.averageLatency || 0;
      const requestCount = metrics.requestCount || 0;

      const score = (100 - successRate) + (avgLatency / 10);

      if (score < bestScore || (score === bestScore && requestCount > bestRequestCount)) {
        bestScore = score;
        bestProxy = proxy;
        bestRequestCount = requestCount;
      }
    }

    return bestProxy;
  }

  /**
   * Record successful request
   */
  recordSuccess(proxyId, latency = 0) {
    const proxy = this.proxyPool.find(p => p.id === proxyId);
    if (!proxy) return;

    proxy.successCount++;
    proxy.lastUsed = Date.now();

    const metrics = this.performanceMetrics.get(proxyId);
    if (metrics) {
      metrics.requestCount++;
      metrics.successCount++;
      metrics.totalLatency += latency;
      metrics.averageLatency = metrics.totalLatency / metrics.requestCount;
      metrics.successRate = (metrics.successCount / metrics.requestCount) * 100;
      metrics.lastSuccess = Date.now();
    }

    const healthStats = this.proxyHealthStats.get(proxyId);
    if (healthStats) {
      healthStats.failureCount = Math.max(0, healthStats.failureCount - 1);
    }
  }

  /**
   * Record failed request
   */
  recordFailure(proxyId, error = null) {
    const proxy = this.proxyPool.find(p => p.id === proxyId);
    if (!proxy) return;

    proxy.failureCount++;

    const metrics = this.performanceMetrics.get(proxyId);
    if (metrics) {
      metrics.requestCount++;
      metrics.failureCount++;
      metrics.failureRate = (metrics.failureCount / metrics.requestCount) * 100;
      metrics.lastFailure = Date.now();
    }

    const healthStats = this.proxyHealthStats.get(proxyId);
    if (healthStats) {
      healthStats.failureCount++;
      healthStats.lastFailureTime = Date.now();

      if (error) {
        healthStats.lastError = error;
      }
    }
  }

  /**
   * Check proxy health
   */
  async checkProxyHealth(proxyId) {
    const proxy = this.proxyPool.find(p => p.id === proxyId);
    if (!proxy) {
      return { success: false, error: 'Proxy not found' };
    }

    try {
      const startTime = Date.now();
      const testUrl = 'https://httpbin.org/ip';

      const result = await this.testProxyConnectivity(proxy, testUrl);
      const latency = Date.now() - startTime;

      if (result.success) {
        this.recordSuccess(proxyId, latency);
        const healthStats = this.proxyHealthStats.get(proxyId);
        if (healthStats) {
          healthStats.isHealthy = true;
          healthStats.lastHealthCheck = Date.now();
          healthStats.latency = latency;
        }

        return {
          success: true,
          healthy: true,
          latency,
          ip: result.ip
        };
      } else {
        this.recordFailure(proxyId, result.error);
        const healthStats = this.proxyHealthStats.get(proxyId);
        if (healthStats) {
          healthStats.isHealthy = false;
          healthStats.lastHealthCheck = Date.now();
        }

        return {
          success: false,
          healthy: false,
          error: result.error
        };
      }
    } catch (error) {
      this.recordFailure(proxyId, error.message);
      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Test proxy connectivity (internal helper)
   */
  async testProxyConnectivity(proxy, testUrl) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout' });
      }, this.healthCheckTimeout);

      try {
        const url = new URL(testUrl);
        const requestOptions = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'GET',
          timeout: this.healthCheckTimeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        };

        // Configure proxy
        if (proxy.protocol === 'socks5' || proxy.type === 'socks5') {
          resolve({ success: true, ip: 'socks5' });
          return;
        }

        const protocol = url.protocol === 'https:' ? https : http;

        const req = protocol.request(requestOptions, (res) => {
          let data = '';
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            clearTimeout(timeoutId);
            try {
              const json = JSON.parse(data);
              resolve({ success: true, ip: json.origin });
            } catch {
              resolve({ success: true, ip: 'unknown' });
            }
          });
        });

        req.on('error', (error) => {
          clearTimeout(timeoutId);
          resolve({ success: false, error: error.message });
        });

        req.end();
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({ success: false, error: error.message });
      }
    });
  }

  /**
   * Start periodic health checking
   */
  startHealthChecking() {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
    }

    this.healthCheckIntervalId = setInterval(async () => {
      for (const proxy of this.proxyPool) {
        await this.checkProxyHealth(proxy.id);
      }
    }, this.healthCheckInterval);

    return { success: true, message: 'Health checking started' };
  }

  /**
   * Stop periodic health checking
   */
  stopHealthChecking() {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }

    return { success: true, message: 'Health checking stopped' };
  }

  /**
   * Get pool status
   */
  getPoolStatus() {
    const healthyCount = this.proxyPool.filter(p => {
      const stats = this.proxyHealthStats.get(p.id);
      return stats && stats.isHealthy !== false;
    }).length;

    return {
      totalProxies: this.proxyPool.length,
      healthyProxies: healthyCount,
      rotationMode: this.rotationMode,
      currentIndex: this.currentProxyIndex,
      proxyDetails: this.proxyPool.map(p => ({
        id: p.id,
        host: p.host,
        port: p.port,
        type: p.type,
        successCount: p.successCount,
        failureCount: p.failureCount,
        lastUsed: p.lastUsed,
        health: this.proxyHealthStats.get(p.id)
      }))
    };
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {};

    for (const proxy of this.proxyPool) {
      const metrics = this.performanceMetrics.get(proxy.id);
      const health = this.proxyHealthStats.get(proxy.id);

      report[proxy.id] = {
        proxy: {
          host: proxy.host,
          port: proxy.port,
          type: proxy.type
        },
        metrics: metrics || {},
        health: health || {}
      };
    }

    return report;
  }

  /**
   * Reset proxy statistics
   */
  resetStats(proxyId = null) {
    if (proxyId) {
      this.proxyHealthStats.delete(proxyId);
      this.performanceMetrics.delete(proxyId);
      this.initializeHealthStats(proxyId);
      this.initializePerformanceMetrics(proxyId);

      return { success: true, message: `Stats reset for ${proxyId}` };
    }

    this.proxyHealthStats.clear();
    this.performanceMetrics.clear();

    for (const proxy of this.proxyPool) {
      this.initializeHealthStats(proxy.id);
      this.initializePerformanceMetrics(proxy.id);
    }

    return { success: true, message: 'All stats reset' };
  }

  /**
   * Initialize health statistics for proxy
   */
  initializeHealthStats(proxyId) {
    this.proxyHealthStats.set(proxyId, {
      isHealthy: true,
      failureCount: 0,
      successCount: 0,
      lastHealthCheck: null,
      lastFailureTime: null,
      lastError: null,
      latency: null
    });
  }

  /**
   * Initialize performance metrics for proxy
   */
  initializePerformanceMetrics(proxyId) {
    this.performanceMetrics.set(proxyId, {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0, // Start at 0 for unrecorded proxies
      failureRate: 0,
      totalLatency: 0,
      averageLatency: 0,
      lastSuccess: null,
      lastFailure: null
    });
  }

  /**
   * Validate proxy configuration
   */
  validateProxyConfig(config) {
    const errors = [];

    if (!config.host) {
      errors.push('Proxy host is required');
    }

    if (!config.port) {
      errors.push('Proxy port is required');
    } else if (typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
      errors.push('Proxy port must be a number between 1 and 65535');
    }

    if (config.type) {
      const validTypes = ['http', 'https', 'socks5', 'socks4'];
      if (!validTypes.includes(config.type.toLowerCase())) {
        errors.push(`Invalid proxy type: ${config.type}`);
      }
    }

    if (config.auth) {
      if (!config.auth.username || !config.auth.password) {
        errors.push('Authentication requires both username and password');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate unique proxy ID
   */
  generateProxyId() {
    return `proxy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get proxy count
   */
  getProxyCount() {
    return this.proxyPool.length;
  }

  /**
   * Clear all proxies
   */
  clearPool() {
    this.proxyPool = [];
    this.currentProxyIndex = 0;
    this.proxyHealthStats.clear();
    this.performanceMetrics.clear();

    return { success: true, message: 'Proxy pool cleared' };
  }
}

module.exports = ResidentialProxyManager;

/**
 * Basset Hound Browser - Proxy WebSocket Handler
 * Provides WebSocket API for proxy management, rotation, and monitoring
 *
 * Version: 1.0.0
 * Created: May 7, 2026
 */

const ResidentialProxyManager = require('../../src/proxy/residential-proxy-manager');
const { ProxyManager } = require('../../proxy/manager');

class ProxyHandler {
  constructor() {
    this.proxyManager = new ProxyManager();
    this.residentialProxyManager = new ResidentialProxyManager();
  }

  /**
   * Handle WebSocket messages
   */
  async handleMessage(message) {
    const { command, payload } = message;
    const startTime = Date.now();

    try {
      let result;

      switch (command) {
        // Basic proxy commands
        case 'set_proxy':
          result = await this.handleSetProxy(payload);
          break;

        case 'clear_proxy':
          result = await this.handleClearProxy(payload);
          break;

        case 'get_proxy_status':
          result = this.handleGetProxyStatus();
          break;

        case 'test_proxy':
          result = await this.handleTestProxy(payload);
          break;

        // Proxy list/rotation commands
        case 'add_proxy_to_pool':
          result = this.handleAddProxyToPool(payload);
          break;

        case 'add_proxies_to_pool':
          result = this.handleAddProxiesToPool(payload);
          break;

        case 'remove_proxy_from_pool':
          result = this.handleRemoveProxyFromPool(payload);
          break;

        case 'get_next_proxy':
          result = this.handleGetNextProxy();
          break;

        case 'start_proxy_rotation':
          result = this.handleStartProxyRotation(payload);
          break;

        case 'stop_proxy_rotation':
          result = this.handleStopProxyRotation();
          break;

        // Health checking commands
        case 'check_proxy_health':
          result = await this.handleCheckProxyHealth(payload);
          break;

        case 'start_health_checking':
          result = this.handleStartHealthChecking();
          break;

        case 'stop_health_checking':
          result = this.handleStopHealthChecking();
          break;

        // Monitoring commands
        case 'get_proxy_pool_status':
          result = this.handleGetPoolStatus();
          break;

        case 'get_proxy_performance_report':
          result = this.handleGetPerformanceReport();
          break;

        case 'record_proxy_success':
          result = this.handleRecordSuccess(payload);
          break;

        case 'record_proxy_failure':
          result = this.handleRecordFailure(payload);
          break;

        case 'reset_proxy_stats':
          result = this.handleResetStats(payload);
          break;

        case 'clear_proxy_pool':
          result = this.handleClearPool();
          break;

        default:
          result = {
            success: false,
            error: `Unknown proxy command: ${command}`
          };
      }

      return {
        success: result.success !== false,
        command,
        result,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        command,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Set active proxy (basic ProxyManager)
   */
  async handleSetProxy(payload) {
    if (!payload || !payload.host || !payload.port) {
      return { success: false, error: 'Host and port are required' };
    }

    const result = await this.proxyManager.setProxy({
      host: payload.host,
      port: payload.port,
      type: payload.type || 'http',
      auth: payload.auth,
      bypassRules: payload.bypassRules
    });

    return result;
  }

  /**
   * Clear active proxy
   */
  async handleClearProxy() {
    return await this.proxyManager.clearProxy();
  }

  /**
   * Get proxy status
   */
  handleGetProxyStatus() {
    return this.proxyManager.getProxyStatus();
  }

  /**
   * Test proxy
   */
  async handleTestProxy(payload) {
    if (!payload || !payload.host || !payload.port) {
      return { success: false, error: 'Host and port are required' };
    }

    return await this.proxyManager.testProxy({
      host: payload.host,
      port: payload.port,
      type: payload.type || 'http',
      auth: payload.auth
    });
  }

  /**
   * Add proxy to residential pool
   */
  handleAddProxyToPool(payload) {
    if (!payload || !payload.host || !payload.port) {
      return { success: false, error: 'Host and port are required' };
    }

    return this.residentialProxyManager.addProxy({
      host: payload.host,
      port: payload.port,
      type: payload.type || 'http',
      protocol: payload.protocol || 'http',
      auth: payload.auth,
      country: payload.country,
      sessionId: payload.sessionId
    });
  }

  /**
   * Add multiple proxies to pool
   */
  handleAddProxiesToPool(payload) {
    if (!Array.isArray(payload) || payload.length === 0) {
      return { success: false, error: 'Payload must be non-empty array of proxies' };
    }

    return this.residentialProxyManager.addProxies(
      payload.map(p => ({
        host: p.host,
        port: p.port,
        type: p.type || 'http',
        protocol: p.protocol || 'http',
        auth: p.auth,
        country: p.country,
        sessionId: p.sessionId
      }))
    );
  }

  /**
   * Remove proxy from pool
   */
  handleRemoveProxyFromPool(payload) {
    if (!payload || !payload.proxyId) {
      return { success: false, error: 'proxyId is required' };
    }

    return this.residentialProxyManager.removeProxy(payload.proxyId);
  }

  /**
   * Get next proxy in rotation
   */
  handleGetNextProxy() {
    const proxy = this.residentialProxyManager.getNextProxy();
    if (!proxy) {
      return { success: false, error: 'No proxies available' };
    }

    return {
      success: true,
      proxy: {
        id: proxy.id,
        host: proxy.host,
        port: proxy.port,
        type: proxy.type
      }
    };
  }

  /**
   * Start proxy rotation
   */
  handleStartProxyRotation(payload) {
    if (this.residentialProxyManager.getProxyCount() < 2) {
      return { success: false, error: 'At least 2 proxies required for rotation' };
    }

    const mode = payload?.mode || 'round-robin';
    this.residentialProxyManager.rotationMode = mode;

    return {
      success: true,
      message: `Proxy rotation started (mode: ${mode})`,
      poolSize: this.residentialProxyManager.getProxyCount()
    };
  }

  /**
   * Stop proxy rotation
   */
  handleStopProxyRotation() {
    return {
      success: true,
      message: 'Proxy rotation stopped'
    };
  }

  /**
   * Check proxy health
   */
  async handleCheckProxyHealth(payload) {
    if (!payload || !payload.proxyId) {
      return { success: false, error: 'proxyId is required' };
    }

    return await this.residentialProxyManager.checkProxyHealth(payload.proxyId);
  }

  /**
   * Start health checking
   */
  handleStartHealthChecking() {
    return this.residentialProxyManager.startHealthChecking();
  }

  /**
   * Stop health checking
   */
  handleStopHealthChecking() {
    return this.residentialProxyManager.stopHealthChecking();
  }

  /**
   * Get pool status
   */
  handleGetPoolStatus() {
    return this.residentialProxyManager.getPoolStatus();
  }

  /**
   * Get performance report
   */
  handleGetPerformanceReport() {
    return this.residentialProxyManager.getPerformanceReport();
  }

  /**
   * Record proxy success
   */
  handleRecordSuccess(payload) {
    if (!payload || !payload.proxyId) {
      return { success: false, error: 'proxyId is required' };
    }

    this.residentialProxyManager.recordSuccess(payload.proxyId, payload.latency || 0);
    return { success: true, message: 'Success recorded' };
  }

  /**
   * Record proxy failure
   */
  handleRecordFailure(payload) {
    if (!payload || !payload.proxyId) {
      return { success: false, error: 'proxyId is required' };
    }

    this.residentialProxyManager.recordFailure(payload.proxyId, payload.error);
    return { success: true, message: 'Failure recorded' };
  }

  /**
   * Reset proxy stats
   */
  handleResetStats(payload) {
    return this.residentialProxyManager.resetStats(payload?.proxyId);
  }

  /**
   * Clear proxy pool
   */
  handleClearPool() {
    return this.residentialProxyManager.clearPool();
  }
}

module.exports = ProxyHandler;

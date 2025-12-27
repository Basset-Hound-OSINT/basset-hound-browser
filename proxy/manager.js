/**
 * Basset Hound Browser - Proxy Manager Module
 * Handles proxy configuration, rotation, and authentication
 * Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
 */

const { session } = require('electron');

/**
 * Proxy types supported
 */
const PROXY_TYPES = {
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCKS5: 'socks5',
  DIRECT: 'direct'
};

/**
 * Proxy Manager class
 * Manages proxy settings, rotation, and authentication
 */
class ProxyManager {
  constructor() {
    this.currentProxy = null;
    this.proxyList = [];
    this.rotationIndex = 0;
    this.rotationInterval = null;
    this.rotationMode = 'sequential'; // 'sequential' or 'random'
    this.requestCount = 0;
    this.rotateAfterRequests = 0; // 0 = disabled
    this.isEnabled = false;
    this.authCredentials = new Map(); // Store auth credentials by proxy URL
    this.proxyStats = new Map(); // Track proxy performance
  }

  /**
   * Validate proxy configuration
   * @param {Object} proxyConfig - Proxy configuration object
   * @returns {Object} - Validation result
   */
  validateProxy(proxyConfig) {
    const errors = [];

    if (!proxyConfig) {
      return { valid: false, errors: ['Proxy configuration is required'] };
    }

    // Check required fields
    if (!proxyConfig.host) {
      errors.push('Proxy host is required');
    }

    if (!proxyConfig.port) {
      errors.push('Proxy port is required');
    } else if (typeof proxyConfig.port !== 'number' || proxyConfig.port < 1 || proxyConfig.port > 65535) {
      errors.push('Proxy port must be a number between 1 and 65535');
    }

    // Validate proxy type
    const validTypes = Object.values(PROXY_TYPES);
    if (proxyConfig.type && !validTypes.includes(proxyConfig.type.toLowerCase())) {
      errors.push(`Invalid proxy type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate authentication if provided
    if (proxyConfig.auth) {
      if (!proxyConfig.auth.username) {
        errors.push('Proxy authentication requires username');
      }
      if (!proxyConfig.auth.password) {
        errors.push('Proxy authentication requires password');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format proxy URL from configuration
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {string} - Formatted proxy URL
   */
  formatProxyUrl(proxyConfig) {
    const type = (proxyConfig.type || 'http').toLowerCase();
    const host = proxyConfig.host;
    const port = proxyConfig.port;

    // For SOCKS proxies, use socks5:// or socks4:// scheme
    if (type === 'socks5' || type === 'socks4') {
      return `${type}://${host}:${port}`;
    }

    // For HTTP/HTTPS proxies
    return `http://${host}:${port}`;
  }

  /**
   * Get Electron proxy rules string
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {string} - Proxy rules for Electron
   */
  getProxyRules(proxyConfig) {
    if (!proxyConfig || proxyConfig.type === PROXY_TYPES.DIRECT) {
      return 'direct://';
    }

    const type = (proxyConfig.type || 'http').toLowerCase();
    const host = proxyConfig.host;
    const port = proxyConfig.port;

    // Format according to Electron's proxy rules format
    // http=proxy:port;https=proxy:port or socks5://proxy:port
    if (type === 'socks5') {
      return `socks5://${host}:${port}`;
    } else if (type === 'socks4') {
      return `socks4://${host}:${port}`;
    } else {
      // HTTP/HTTPS proxy - use for both protocols
      return `http=${host}:${port};https=${host}:${port}`;
    }
  }

  /**
   * Set proxy configuration
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Promise<Object>} - Result of the operation
   */
  async setProxy(proxyConfig) {
    try {
      const validation = this.validateProxy(proxyConfig);
      if (!validation.valid) {
        return { success: false, errors: validation.errors };
      }

      // Store current proxy configuration
      this.currentProxy = {
        ...proxyConfig,
        type: (proxyConfig.type || 'http').toLowerCase()
      };

      // Get proxy rules string
      const proxyRules = this.getProxyRules(this.currentProxy);

      // Apply proxy to default session
      await session.defaultSession.setProxy({
        proxyRules,
        proxyBypassRules: proxyConfig.bypassRules || '<local>'
      });

      // Store authentication credentials if provided
      if (proxyConfig.auth) {
        const proxyKey = `${this.currentProxy.host}:${this.currentProxy.port}`;
        this.authCredentials.set(proxyKey, {
          username: proxyConfig.auth.username,
          password: proxyConfig.auth.password
        });
      }

      this.isEnabled = true;

      // Initialize stats for this proxy
      const proxyKey = `${this.currentProxy.host}:${this.currentProxy.port}`;
      if (!this.proxyStats.has(proxyKey)) {
        this.proxyStats.set(proxyKey, {
          requestCount: 0,
          successCount: 0,
          failureCount: 0,
          lastUsed: null
        });
      }

      console.log(`[ProxyManager] Proxy set: ${proxyRules}`);
      return {
        success: true,
        proxy: {
          host: this.currentProxy.host,
          port: this.currentProxy.port,
          type: this.currentProxy.type
        }
      };
    } catch (error) {
      console.error('[ProxyManager] Error setting proxy:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear proxy configuration (direct connection)
   * @returns {Promise<Object>} - Result of the operation
   */
  async clearProxy() {
    try {
      await session.defaultSession.setProxy({
        proxyRules: 'direct://',
        proxyBypassRules: ''
      });

      this.currentProxy = null;
      this.isEnabled = false;

      // Stop rotation if active
      this.stopRotation();

      console.log('[ProxyManager] Proxy cleared, using direct connection');
      return { success: true, message: 'Proxy cleared' };
    } catch (error) {
      console.error('[ProxyManager] Error clearing proxy:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current proxy status
   * @returns {Object} - Current proxy status
   */
  getProxyStatus() {
    const status = {
      enabled: this.isEnabled,
      currentProxy: this.currentProxy ? {
        host: this.currentProxy.host,
        port: this.currentProxy.port,
        type: this.currentProxy.type,
        hasAuth: !!this.currentProxy.auth
      } : null,
      rotation: {
        enabled: this.rotationInterval !== null,
        mode: this.rotationMode,
        proxyCount: this.proxyList.length,
        currentIndex: this.rotationIndex,
        rotateAfterRequests: this.rotateAfterRequests,
        requestCount: this.requestCount
      }
    };

    // Add stats for current proxy
    if (this.currentProxy) {
      const proxyKey = `${this.currentProxy.host}:${this.currentProxy.port}`;
      const stats = this.proxyStats.get(proxyKey);
      if (stats) {
        status.currentProxy.stats = stats;
      }
    }

    return status;
  }

  /**
   * Set list of proxies for rotation
   * @param {Array} proxies - Array of proxy configurations
   * @returns {Object} - Result of the operation
   */
  setProxyList(proxies) {
    if (!Array.isArray(proxies)) {
      return { success: false, error: 'Proxies must be an array' };
    }

    const validProxies = [];
    const invalidProxies = [];

    for (const proxy of proxies) {
      const validation = this.validateProxy(proxy);
      if (validation.valid) {
        validProxies.push({
          ...proxy,
          type: (proxy.type || 'http').toLowerCase()
        });
      } else {
        invalidProxies.push({
          proxy,
          errors: validation.errors
        });
      }
    }

    this.proxyList = validProxies;
    this.rotationIndex = 0;

    console.log(`[ProxyManager] Proxy list set: ${validProxies.length} valid, ${invalidProxies.length} invalid`);

    return {
      success: true,
      validCount: validProxies.length,
      invalidCount: invalidProxies.length,
      invalidProxies: invalidProxies.length > 0 ? invalidProxies : undefined
    };
  }

  /**
   * Add a proxy to the rotation list
   * @param {Object} proxyConfig - Proxy configuration
   * @returns {Object} - Result of the operation
   */
  addProxy(proxyConfig) {
    const validation = this.validateProxy(proxyConfig);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.proxyList.push({
      ...proxyConfig,
      type: (proxyConfig.type || 'http').toLowerCase()
    });

    console.log(`[ProxyManager] Proxy added: ${proxyConfig.host}:${proxyConfig.port}`);
    return {
      success: true,
      proxyCount: this.proxyList.length
    };
  }

  /**
   * Remove a proxy from the rotation list
   * @param {string} host - Proxy host
   * @param {number} port - Proxy port
   * @returns {Object} - Result of the operation
   */
  removeProxy(host, port) {
    const initialLength = this.proxyList.length;
    this.proxyList = this.proxyList.filter(p => !(p.host === host && p.port === port));

    if (this.proxyList.length < initialLength) {
      // Adjust rotation index if needed
      if (this.rotationIndex >= this.proxyList.length) {
        this.rotationIndex = 0;
      }

      console.log(`[ProxyManager] Proxy removed: ${host}:${port}`);
      return {
        success: true,
        proxyCount: this.proxyList.length
      };
    }

    return { success: false, error: 'Proxy not found in list' };
  }

  /**
   * Rotate to the next proxy
   * @returns {Promise<Object>} - Result of the operation
   */
  async rotateProxy() {
    if (this.proxyList.length === 0) {
      return { success: false, error: 'No proxies in rotation list' };
    }

    let nextIndex;
    if (this.rotationMode === 'random') {
      nextIndex = Math.floor(Math.random() * this.proxyList.length);
    } else {
      nextIndex = (this.rotationIndex + 1) % this.proxyList.length;
    }

    this.rotationIndex = nextIndex;
    const nextProxy = this.proxyList[nextIndex];

    const result = await this.setProxy(nextProxy);
    if (result.success) {
      this.requestCount = 0; // Reset request count after rotation
      console.log(`[ProxyManager] Rotated to proxy ${nextIndex + 1}/${this.proxyList.length}`);
    }

    return {
      ...result,
      rotationIndex: nextIndex,
      totalProxies: this.proxyList.length
    };
  }

  /**
   * Start automatic proxy rotation
   * @param {Object} options - Rotation options
   * @returns {Object} - Result of the operation
   */
  startRotation(options = {}) {
    const {
      intervalMs = 300000, // 5 minutes default
      mode = 'sequential', // 'sequential' or 'random'
      rotateAfterRequests = 0 // Rotate after N requests (0 = disabled)
    } = options;

    if (this.proxyList.length < 2) {
      return { success: false, error: 'Need at least 2 proxies for rotation' };
    }

    // Stop existing rotation if any
    this.stopRotation();

    this.rotationMode = mode;
    this.rotateAfterRequests = rotateAfterRequests;

    // Set up interval-based rotation
    if (intervalMs > 0) {
      this.rotationInterval = setInterval(async () => {
        await this.rotateProxy();
      }, intervalMs);
    }

    console.log(`[ProxyManager] Rotation started: mode=${mode}, interval=${intervalMs}ms, rotateAfterRequests=${rotateAfterRequests}`);

    return {
      success: true,
      mode,
      intervalMs,
      rotateAfterRequests,
      proxyCount: this.proxyList.length
    };
  }

  /**
   * Stop automatic proxy rotation
   * @returns {Object} - Result of the operation
   */
  stopRotation() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
      this.rotationInterval = null;
      console.log('[ProxyManager] Rotation stopped');
      return { success: true, message: 'Rotation stopped' };
    }
    return { success: true, message: 'Rotation was not active' };
  }

  /**
   * Handle authentication for proxy
   * Sets up login handler for proxy authentication
   * @param {BrowserWindow} mainWindow - Main browser window
   */
  setupAuthHandler(mainWindow) {
    if (!mainWindow || !mainWindow.webContents) {
      console.error('[ProxyManager] Invalid window for auth handler');
      return;
    }

    // Handle proxy authentication requests
    mainWindow.webContents.on('login', (event, authenticationResponseDetails, authInfo, callback) => {
      if (authInfo.isProxy) {
        const proxyKey = `${authInfo.host}:${authInfo.port}`;
        const credentials = this.authCredentials.get(proxyKey);

        if (credentials) {
          event.preventDefault();
          callback(credentials.username, credentials.password);
          console.log(`[ProxyManager] Authenticated with proxy ${proxyKey}`);
        } else {
          console.warn(`[ProxyManager] No credentials for proxy ${proxyKey}`);
          callback(); // Cancel authentication
        }
      }
    });
  }

  /**
   * Increment request count and check for rotation
   * Call this method after each request
   * @returns {Promise<boolean>} - Whether rotation occurred
   */
  async onRequest() {
    this.requestCount++;

    // Update stats for current proxy
    if (this.currentProxy) {
      const proxyKey = `${this.currentProxy.host}:${this.currentProxy.port}`;
      const stats = this.proxyStats.get(proxyKey);
      if (stats) {
        stats.requestCount++;
        stats.lastUsed = new Date().toISOString();
      }
    }

    // Check if we should rotate based on request count
    if (this.rotateAfterRequests > 0 && this.requestCount >= this.rotateAfterRequests) {
      await this.rotateProxy();
      return true;
    }

    return false;
  }

  /**
   * Record success/failure for current proxy
   * @param {boolean} success - Whether the request succeeded
   */
  recordResult(success) {
    if (this.currentProxy) {
      const proxyKey = `${this.currentProxy.host}:${this.currentProxy.port}`;
      const stats = this.proxyStats.get(proxyKey);
      if (stats) {
        if (success) {
          stats.successCount++;
        } else {
          stats.failureCount++;
        }
      }
    }
  }

  /**
   * Get statistics for all proxies
   * @returns {Object} - Proxy statistics
   */
  getStats() {
    const stats = {};
    for (const [key, value] of this.proxyStats) {
      stats[key] = { ...value };
    }
    return stats;
  }

  /**
   * Test proxy connection
   * @param {Object} proxyConfig - Proxy configuration to test
   * @returns {Promise<Object>} - Test result
   */
  async testProxy(proxyConfig) {
    const validation = this.validateProxy(proxyConfig);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // Store current proxy to restore later
    const previousProxy = this.currentProxy;
    const wasEnabled = this.isEnabled;

    try {
      // Set the test proxy
      await this.setProxy(proxyConfig);

      // We can't actually make a request here without additional modules
      // This would need to be tested from the renderer process
      // For now, we just verify the proxy can be set

      return {
        success: true,
        message: 'Proxy configuration is valid',
        proxy: {
          host: proxyConfig.host,
          port: proxyConfig.port,
          type: proxyConfig.type || 'http'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      // Restore previous proxy
      if (wasEnabled && previousProxy) {
        await this.setProxy(previousProxy);
      } else {
        await this.clearProxy();
      }
    }
  }
}

// Export singleton instance and class
const proxyManager = new ProxyManager();

module.exports = {
  proxyManager,
  ProxyManager,
  PROXY_TYPES
};

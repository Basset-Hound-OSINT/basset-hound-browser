/**
 * Basset Hound Browser - Proxy Manager (Tor + chain layer)
 *
 * ProxyManager: extends ProxyManagerBase with Tor integration, dynamic
 * routing, the Tor master switch, and proxy-chain integration. Code moved
 * verbatim from proxy/manager.js (2026-07-04 modularization).
 *
 * @module proxy/manager/proxy-manager
 */

const { session } = require('electron');
const {
  PROXY_MODES,
  TOR_MASTER_MODES
} = require('./constants');
const { getTorManager, getProxyChainManager } = require('./tor-helpers');
const ProxyManagerBase = require('./proxy-manager-base');

class ProxyManager extends ProxyManagerBase {
  // ==========================================
  // Tor Integration Methods
  // ==========================================

  /**
   * Connect to Tor network
   * @param {Object} options - Tor configuration options
   * @returns {Promise<Object>} - Connection result
   */
  async connectTor(options = {}) {
    try {
      const tor = getTorManager();
      if (!tor) {
        return {
          success: false,
          error: 'Tor manager not available'
        };
      }

      // Configure Tor if options provided
      if (Object.keys(options).length > 0) {
        tor.configure(options);
      }

      // Connect to Tor
      const result = await tor.connect();

      if (result.success) {
        // Apply Tor proxy to Electron session
        const proxyConfig = tor.getProxyConfig();
        await this.setProxy(proxyConfig);

        this.torConnected = true;
        this.proxyMode = PROXY_MODES.TOR;

        console.log('[ProxyManager] Connected to Tor network');

        return {
          success: true,
          message: 'Connected to Tor network',
          proxyConfig,
          exitIp: result.exitIp,
          latency: result.latency
        };
      }

      return result;
    } catch (error) {
      console.error('[ProxyManager] Error connecting to Tor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Disconnect from Tor network
   * @returns {Promise<Object>} - Disconnection result
   */
  async disconnectTor() {
    try {
      const tor = getTorManager();
      if (!tor) {
        return {
          success: false,
          error: 'Tor manager not available'
        };
      }

      tor.disconnect();
      await this.clearProxy();

      this.torConnected = false;
      this.proxyMode = PROXY_MODES.SINGLE;

      console.log('[ProxyManager] Disconnected from Tor network');

      return {
        success: true,
        message: 'Disconnected from Tor network'
      };
    } catch (error) {
      console.error('[ProxyManager] Error disconnecting from Tor:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get Tor connection status
   * @returns {Object} - Tor status
   */
  getTorStatus() {
    const tor = getTorManager();
    if (!tor) {
      return {
        available: false,
        error: 'Tor manager not available'
      };
    }

    const status = tor.getStatus();
    return {
      available: true,
      ...status,
      connectedViaProxyManager: this.torConnected
    };
  }

  /**
   * Request new Tor identity (circuit)
   * @returns {Promise<Object>} - New identity result
   */
  async newTorIdentity() {
    try {
      const tor = getTorManager();
      if (!tor) {
        return {
          success: false,
          error: 'Tor manager not available'
        };
      }

      if (!this.torConnected) {
        return {
          success: false,
          error: 'Not connected to Tor. Use connect_tor first.'
        };
      }

      const result = await tor.newIdentity();

      if (result.success) {
        console.log(`[ProxyManager] New Tor identity: ${result.previousExitIp} -> ${result.newExitIp}`);
      }

      return result;
    } catch (error) {
      console.error('[ProxyManager] Error requesting new Tor identity:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current Tor exit node IP
   * @returns {Promise<Object>} - Exit IP result
   */
  async getTorExitIp() {
    const tor = getTorManager();
    if (!tor) {
      return {
        success: false,
        error: 'Tor manager not available'
      };
    }

    return await tor.getExitIp();
  }

  // ==========================================
  // Dynamic Tor Routing Methods
  // ==========================================
  // These methods allow enabling/disabling Tor routing at runtime
  // without requiring TOR_MODE at startup.
  //
  // IMPORTANT LIMITATION:
  // When enabling Tor routing dynamically (without TOR_MODE at startup),
  // .onion domains may NOT work properly. This is because:
  // 1. Electron's --host-resolver-rules cannot be changed after app start
  // 2. Without this flag, DNS resolution happens locally, not through Tor
  // 3. Local DNS cannot resolve .onion domains
  //
  // For full .onion support, start the browser with TOR_MODE=1 or --tor-mode.
  // Dynamic routing still works for:
  // - Accessing clearnet sites through Tor for anonymity
  // - Checking Tor exit IP
  // - Changing Tor identity/circuit
  // ==========================================

  /**
   * Enable Tor routing - route all browser traffic through Tor SOCKS proxy
   * @param {Object} options - Configuration options
   * @param {string} options.socksHost - Tor SOCKS host (default: 127.0.0.1)
   * @param {number} options.socksPort - Tor SOCKS port (default: 9050)
   * @returns {Promise<Object>} - Result of the operation
   */
  async enableTorRouting(options = {}) {
    try {
      const socksHost = options.socksHost || this.torRoutingConfig.socksHost;
      const socksPort = options.socksPort || this.torRoutingConfig.socksPort;

      // Update config
      this.torRoutingConfig.socksHost = socksHost;
      this.torRoutingConfig.socksPort = socksPort;

      // Set the proxy to route through Tor
      const proxyConfig = {
        host: socksHost,
        port: socksPort,
        type: 'socks5'
      };

      const result = await this.setProxy(proxyConfig);

      if (result.success) {
        this.torRoutingEnabled = true;
        this.proxyMode = PROXY_MODES.TOR;

        console.log(`[ProxyManager] Tor routing enabled via ${socksHost}:${socksPort}`);

        // Check if daemon is reachable (optional - routing can be enabled before daemon)
        const tor = getTorManager();
        let daemonStatus = 'unknown';
        if (tor) {
          const check = await tor.checkConnection();
          daemonStatus = check.success ? 'reachable' : 'unreachable';
        }

        return {
          success: true,
          message: 'Tor routing enabled',
          routing: {
            enabled: true,
            socksHost,
            socksPort,
            proxyRules: `socks5://${socksHost}:${socksPort}`
          },
          daemonStatus,
          warning: 'Dynamic Tor routing may not support .onion domains. For full .onion support, restart with TOR_MODE=1'
        };
      }

      return result;
    } catch (error) {
      console.error('[ProxyManager] Error enabling Tor routing:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Disable Tor routing - return to direct connection
   * Note: This does NOT stop the Tor daemon, only stops routing through it
   * @returns {Promise<Object>} - Result of the operation
   */
  async disableTorRouting() {
    try {
      // Clear proxy (direct connection)
      const result = await this.clearProxy();

      if (result.success) {
        this.torRoutingEnabled = false;
        // Keep torConnected as-is since the daemon might still be running

        console.log('[ProxyManager] Tor routing disabled, using direct connection');

        return {
          success: true,
          message: 'Tor routing disabled, using direct connection',
          routing: {
            enabled: false
          },
          note: 'Tor daemon may still be running. Use tor_stop to stop the daemon.'
        };
      }

      return result;
    } catch (error) {
      console.error('[ProxyManager] Error disabling Tor routing:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Toggle Tor routing state
   * @param {Object} options - Options passed to enableTorRouting if enabling
   * @returns {Promise<Object>} - Result of the operation
   */
  async toggleTorRouting(options = {}) {
    if (this.torRoutingEnabled) {
      return await this.disableTorRouting();
    } else {
      return await this.enableTorRouting(options);
    }
  }

  /**
   * Get current Tor routing status
   * @returns {Promise<Object>} - Current routing status
   */
  async getTorRoutingStatus() {
    const tor = getTorManager();

    // Check if daemon is reachable
    let daemonReachable = false;
    let daemonLatency = null;
    if (tor) {
      const check = await tor.checkConnection();
      daemonReachable = check.success;
      daemonLatency = check.latency;
    }

    // Verify current proxy resolution
    let currentProxyRules = 'direct://';
    try {
      currentProxyRules = await session.defaultSession.resolveProxy('https://check.torproject.org');
    } catch (e) {
      // Ignore errors
    }

    return {
      success: true,
      routing: {
        enabled: this.torRoutingEnabled,
        socksHost: this.torRoutingConfig.socksHost,
        socksPort: this.torRoutingConfig.socksPort,
        currentProxyRules
      },
      daemon: {
        reachable: daemonReachable,
        latency: daemonLatency,
        connected: this.torConnected
      },
      onionSupport: {
        available: false, // Would need to check if TOR_MODE was enabled at startup
        note: 'For .onion domain support, start browser with TOR_MODE=1 or --tor-mode flag'
      }
    };
  }

  // ==========================================
  // Tor Master Switch Methods
  // ==========================================
  // The master switch provides three modes for Tor networking:
  // - OFF: Never route through Tor (direct connection)
  // - ON: Always route through Tor (maximum anonymity)
  // - AUTO: Intelligently switch based on .onion URL detection
  //
  // AUTO mode is useful for investigations that might encounter
  // websites with Tor-facing redirects. The system will automatically
  // enable Tor routing when navigating to .onion domains and disable
  // it for clearnet sites.
  // ==========================================

  /**
   * Set Tor master switch mode
   * @param {string} mode - 'off', 'on', or 'auto'
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} - Result of the operation
   */
  async setTorMasterMode(mode, options = {}) {
    try {
      const normalizedMode = mode.toLowerCase();

      if (!Object.values(TOR_MASTER_MODES).includes(normalizedMode)) {
        return {
          success: false,
          error: `Invalid mode. Must be one of: ${Object.values(TOR_MASTER_MODES).join(', ')}`
        };
      }

      const previousMode = this.torMasterMode;
      this.torMasterMode = normalizedMode;

      // Apply routing based on mode
      let routingResult;
      if (normalizedMode === TOR_MASTER_MODES.ON) {
        // ON mode: Enable Tor routing immediately
        routingResult = await this.enableTorRouting(options);
      } else if (normalizedMode === TOR_MASTER_MODES.OFF) {
        // OFF mode: Disable Tor routing immediately
        routingResult = await this.disableTorRouting();
      } else {
        // AUTO mode: Keep current routing state, will switch on navigation
        routingResult = {
          success: true,
          message: 'AUTO mode enabled. Routing will switch based on URL type.',
          routing: {
            enabled: this.torRoutingEnabled
          }
        };
      }

      console.log(`[ProxyManager] Tor master mode changed: ${previousMode} -> ${normalizedMode}`);

      return {
        success: true,
        mode: normalizedMode,
        previousMode,
        routing: routingResult.routing || { enabled: this.torRoutingEnabled },
        note: normalizedMode === TOR_MASTER_MODES.AUTO
          ? 'Routing will automatically switch when navigating to .onion URLs. For full .onion support, ensure TOR_MODE=1 at startup.'
          : undefined
      };
    } catch (error) {
      console.error('[ProxyManager] Error setting Tor master mode:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current Tor master switch status
   * @returns {Promise<Object>} - Current mode and status
   */
  async getTorMasterMode() {
    const routingStatus = await this.getTorRoutingStatus();

    return {
      success: true,
      mode: this.torMasterMode,
      description: this.getModeDescription(this.torMasterMode),
      routing: routingStatus.routing,
      daemon: routingStatus.daemon,
      onionSupport: routingStatus.onionSupport
    };
  }

  /**
   * Get description for a Tor master mode
   * @param {string} mode - The mode
   * @returns {string} - Human-readable description
   */
  getModeDescription(mode) {
    switch (mode) {
    case TOR_MASTER_MODES.OFF:
      return 'Tor routing is disabled. All traffic uses direct connection.';
    case TOR_MASTER_MODES.ON:
      return 'Tor routing is always enabled. All traffic routes through Tor.';
    case TOR_MASTER_MODES.AUTO:
      return 'Tor routing switches automatically based on URL type (.onion = Tor, clearnet = direct).';
    default:
      return 'Unknown mode';
    }
  }

  /**
   * Handle navigation in AUTO mode - called before navigation
   * @param {string} url - The URL being navigated to
   * @returns {Promise<Object>} - Result with any routing changes made
   */
  async handleAutoModeNavigation(url) {
    if (this.torMasterMode !== TOR_MASTER_MODES.AUTO) {
      return {
        handled: false,
        reason: `Master mode is ${this.torMasterMode}, not auto`
      };
    }

    const isOnion = this.isOnionUrl(url);
    const currentlyEnabled = this.torRoutingEnabled;

    // Check if we need to switch
    if (isOnion && !currentlyEnabled) {
      // Navigating to .onion but Tor routing is off - enable it
      console.log(`[ProxyManager] AUTO mode: Enabling Tor routing for .onion URL`);
      const result = await this.enableTorRouting();
      return {
        handled: true,
        action: 'enabled_tor',
        url,
        isOnion: true,
        result
      };
    } else if (!isOnion && currentlyEnabled) {
      // Navigating to clearnet but Tor routing is on - disable it
      console.log(`[ProxyManager] AUTO mode: Disabling Tor routing for clearnet URL`);
      const result = await this.disableTorRouting();
      return {
        handled: true,
        action: 'disabled_tor',
        url,
        isOnion: false,
        result
      };
    }

    return {
      handled: false,
      reason: isOnion ? 'Already routing through Tor' : 'Already using direct connection',
      url,
      isOnion,
      torRoutingEnabled: currentlyEnabled
    };
  }

  /**
   * Check if a URL is an .onion domain
   * @param {string} url - URL to check
   * @returns {boolean} - True if .onion domain
   */
  isOnionUrl(url) {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('.onion');
    } catch {
      // If URL parsing fails, check for .onion substring
      return url.includes('.onion');
    }
  }

  // ==========================================
  // Proxy Chain Integration Methods
  // ==========================================

  /**
   * Set proxy chain
   * @param {Array} proxies - Array of proxy configurations
   * @param {Object} options - Chain options
   * @returns {Promise<Object>} - Result
   */
  async setProxyChain(proxies, options = {}) {
    try {
      const chain = getProxyChainManager();
      if (!chain) {
        return {
          success: false,
          error: 'Proxy chain manager not available'
        };
      }

      // Configure chain options
      if (options.chainType) {
        chain.setChainType(options.chainType);
      }
      if (options.failoverEnabled !== undefined) {
        chain.configure({ failoverEnabled: options.failoverEnabled });
      }

      // Set the chain
      const result = chain.setChain(proxies);

      if (result.success) {
        // Apply the first proxy in the chain to Electron session
        const proxyRules = chain.getProxyRules();
        await session.defaultSession.setProxy({
          proxyRules,
          proxyBypassRules: options.bypassRules || '<local>'
        });

        this.chainEnabled = true;
        this.proxyMode = PROXY_MODES.CHAIN;
        this.isEnabled = true;

        console.log(`[ProxyManager] Proxy chain set with ${result.chainLength} proxies`);

        return {
          success: true,
          chainLength: result.chainLength,
          chainType: chain.chainType,
          proxyRules
        };
      }

      return result;
    } catch (error) {
      console.error('[ProxyManager] Error setting proxy chain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current proxy chain configuration
   * @returns {Object} - Chain configuration
   */
  getProxyChainConfig() {
    const chain = getProxyChainManager();
    if (!chain) {
      return {
        available: false,
        error: 'Proxy chain manager not available'
      };
    }

    return {
      available: true,
      ...chain.getChainConfig(),
      enabledViaProxyManager: this.chainEnabled
    };
  }

  /**
   * Get proxy chain status
   * @returns {Object} - Chain status
   */
  getProxyChainStatus() {
    const chain = getProxyChainManager();
    if (!chain) {
      return {
        available: false,
        error: 'Proxy chain manager not available'
      };
    }

    return {
      available: true,
      ...chain.getStatus(),
      enabledViaProxyManager: this.chainEnabled
    };
  }

  /**
   * Test proxy chain connectivity
   * @returns {Promise<Object>} - Test result
   */
  async testProxyChain() {
    const chain = getProxyChainManager();
    if (!chain) {
      return {
        success: false,
        error: 'Proxy chain manager not available'
      };
    }

    return await chain.validateChain();
  }

  /**
   * Clear proxy chain
   * @returns {Promise<Object>} - Result
   */
  async clearProxyChain() {
    try {
      const chain = getProxyChainManager();
      if (!chain) {
        return {
          success: false,
          error: 'Proxy chain manager not available'
        };
      }

      chain.clearChain();
      await this.clearProxy();

      this.chainEnabled = false;
      this.proxyMode = PROXY_MODES.SINGLE;

      console.log('[ProxyManager] Proxy chain cleared');

      return {
        success: true,
        message: 'Proxy chain cleared'
      };
    } catch (error) {
      console.error('[ProxyManager] Error clearing proxy chain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==========================================
  // Extended Status Methods
  // ==========================================

  /**
   * Get extended proxy status including Tor and Chain
   * @returns {Object} - Extended status
   */
  getExtendedStatus() {
    const baseStatus = this.getProxyStatus();

    return {
      ...baseStatus,
      proxyMode: this.proxyMode,
      tor: this.getTorStatus(),
      chain: this.getProxyChainStatus()
    };
  }

  /**
   * Get available proxy modes
   * @returns {Object} - Available modes
   */
  getAvailableModes() {
    return {
      modes: Object.values(PROXY_MODES),
      currentMode: this.proxyMode
    };
  }
}

module.exports = ProxyManager;

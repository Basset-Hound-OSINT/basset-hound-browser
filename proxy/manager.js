/**
 * Basset Hound Browser - Proxy Manager Module (barrel)
 * Handles single proxy configuration and authentication
 * Supports HTTP, HTTPS, SOCKS4, and SOCKS5 proxies
 * Integrates with Tor manager for basic Tor connection
 *
 * NOTE: Proxy pool management, rotation strategies, and chain functionality
 * have been migrated to basset-hound-networking package.
 *
 * This module was split into proxy/manager/ for maintainability (2026-07-04).
 * The public API is unchanged; downstream requires of './proxy/manager' are
 * unaffected.
 */

const {
  PROXY_TYPES,
  PROXY_MODES,
  TOR_MASTER_MODES
} = require('./manager/constants');
const { getTorManager, getProxyChainManager } = require('./manager/tor-helpers');
const ProxyManager = require('./manager/proxy-manager');

// Export singleton instance and class
const proxyManager = new ProxyManager();

module.exports = {
  proxyManager,
  ProxyManager,
  PROXY_TYPES,
  PROXY_MODES,
  TOR_MASTER_MODES,
  getTorManager,
  getProxyChainManager
};

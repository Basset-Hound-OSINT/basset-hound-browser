/**
 * Basset Hound Browser - Proxy Manager Tor/Chain helpers
 *
 * Lazy accessors moved from proxy/manager.js (2026-07-04 modularization).
 * The Tor require path is now '../tor' because this file lives in
 * proxy/manager/ instead of proxy/. Behavior is unchanged.
 *
 * @module proxy/manager/tor-helpers
 */

// Lazy load Tor manager to avoid circular dependencies
let torManager = null;
// Proxy chain manager has been migrated to basset-hound-networking
// let proxyChainManager = null;

/**
 * Get TorManager instance (lazy load)
 */
function getTorManager() {
  if (!torManager) {
    try {
      const torModule = require('../tor');
      torManager = torModule.torManager;
    } catch (error) {
      console.error('[ProxyManager] Failed to load TorManager:', error.message);
    }
  }
  return torManager;
}

/**
 * Get ProxyChainManager instance (DEPRECATED)
 * Proxy chain functionality has been migrated to basset-hound-networking.
 * This function now returns null and logs a deprecation warning.
 */
function getProxyChainManager() {
  console.warn('[ProxyManager] ProxyChainManager has been migrated to basset-hound-networking package');
  return null;
}

module.exports = { getTorManager, getProxyChainManager };

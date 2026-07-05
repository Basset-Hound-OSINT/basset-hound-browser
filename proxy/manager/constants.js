/**
 * Basset Hound Browser - Proxy Manager constants
 *
 * Enumerations moved verbatim from proxy/manager.js (2026-07-04
 * modularization).
 *
 * @module proxy/manager/constants
 */

/**
 * Proxy types supported
 */
const PROXY_TYPES = {
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCKS5: 'socks5',
  DIRECT: 'direct',
  TOR: 'tor'
};

/**
 * Proxy modes
 */
const PROXY_MODES = {
  SINGLE: 'single',
  ROTATION: 'rotation',
  TOR: 'tor',
  CHAIN: 'chain'
};

/**
 * Tor Master Switch modes
 * Controls how Tor routing is managed across the browser
 */
const TOR_MASTER_MODES = {
  OFF: 'off', // Never route through Tor
  ON: 'on', // Always route through Tor
  AUTO: 'auto' // Automatically switch based on .onion URLs
};

module.exports = {
  PROXY_TYPES,
  PROXY_MODES,
  TOR_MASTER_MODES
};

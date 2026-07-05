/**
 * Basset Hound Browser - Advanced Tor Manager (barrel)
 *
 * The implementation was split into proxy/tor-advanced/ for maintainability
 * (2026-07-04 modularization). This barrel re-exports the same public API;
 * downstream requires of './proxy/tor-advanced' are unaffected.
 *
 * @module proxy/tor-advanced
 */

const {
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  COUNTRY_CODES,
  BUILTIN_BRIDGES,
  TOR_DEFAULTS,
  EMBEDDED_PATHS
} = require('./tor-advanced/constants');
const AdvancedTorManager = require('./tor-advanced/manager');

// Export
// EDGE CASE FIX #1: Do NOT register exit handlers at module load time
// This prevents uncaught exception handlers from firing during initialization
// Exit handlers will be enabled when app.whenReady() is called
const advancedTorManager = new AdvancedTorManager({ killOnExit: false });

module.exports = {
  advancedTorManager,
  AdvancedTorManager,
  TOR_STATES,
  TRANSPORT_TYPES,
  ISOLATION_MODES,
  COUNTRY_CODES,
  BUILTIN_BRIDGES,
  TOR_DEFAULTS,
  EMBEDDED_PATHS
};

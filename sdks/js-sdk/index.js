/**
 * Basset Hound Browser SDK - Main Entry Point
 * Provides unified exports for CommonJS and ESM
 */

const {
  BrowserClient,
  CommandResponse,
  SessionCheckpoint
} = require('./basset-hound.js');

// Named exports for CommonJS
module.exports = {
  BrowserClient,
  CommandResponse,
  SessionCheckpoint,
  // Default export
  default: BrowserClient
};

// ESM exports
if (typeof exports !== 'undefined') {
  exports.BrowserClient = BrowserClient;
  exports.CommandResponse = CommandResponse;
  exports.SessionCheckpoint = SessionCheckpoint;
}

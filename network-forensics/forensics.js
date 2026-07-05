/**
 * Network Forensics Collector — barrel
 *
 * Phase 19: Enhanced Network Forensics.
 *
 * Original monolithic implementation (network-forensics/forensics.js) was
 * split into ./forensics/ modules for maintainability. This barrel preserves
 * the public API exactly: { NetworkForensicsCollector, FORENSICS_TYPES,
 * EXPORT_FORMATS }.
 */

module.exports = require('./forensics/collector');

/**
 * Technology Detection Module
 *
 * Exports all components for technology detection:
 * - Detection engine (Phase 1)
 * - Version fingerprinting (Phase 2)
 * - Vulnerability detection (Phase 2)
 * - Configuration analysis (Phase 2)
 * - Update recommendations (Phase 2)
 * - Technology signatures database
 * - Utility functions
 *
 * @module detection
 */

const TechnologyDetectionEngine = require('./detector');
const VersionFingerprinter = require('./version-fingerprinter');
const VulnerabilityDetector = require('./vulnerability-detector');
const ConfigurationAnalyzer = require('./config-analyzer');
const UpdateRecommender = require('./update-recommender');
const {
  TECH_SIGNATURES,
  getSignature,
  getAllSignatures,
  getTechnologyNames,
  getTechnologiesByCategory,
  getCategories
} = require('./tech-signatures');

module.exports = {
  // Phase 1: Core Detection Engine
  TechnologyDetectionEngine,

  // Phase 2: Advanced Detection Features
  VersionFingerprinter,
  VulnerabilityDetector,
  ConfigurationAnalyzer,
  UpdateRecommender,

  // Signatures database and utilities
  TECH_SIGNATURES,
  getSignature,
  getAllSignatures,
  getTechnologyNames,
  getTechnologiesByCategory,
  getCategories,

  // Factory functions for convenience
  createDetector: (options) => new TechnologyDetectionEngine(options),
  createVersionFingerprinter: (options) => new VersionFingerprinter(options),
  createVulnerabilityDetector: (options) => new VulnerabilityDetector(options),
  createConfigAnalyzer: (options) => new ConfigurationAnalyzer(options),
  createUpdateRecommender: (options) => new UpdateRecommender(options)
};

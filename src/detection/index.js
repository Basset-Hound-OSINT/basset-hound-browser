/**
 * Technology Detection Module
 *
 * Exports all components for technology detection and bot detection:
 * - Detection engine (Phase 1)
 * - Version fingerprinting (Phase 2)
 * - Vulnerability detection (Phase 2)
 * - Configuration analysis (Phase 2)
 * - Update recommendations (Phase 2)
 * - Technology signatures database
 * - Bot Detection (Phase 3):
 *   - Fingerprint Analyzer (multi-vector analysis)
 *   - Behavior Matcher (pattern detection)
 *   - Anomaly Detector (statistical analysis)
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
const {
  FingerprintAnalyzer,
  FINGERPRINT_VECTORS,
  RISK_LEVELS
} = require('./fingerprint-analyzer');
const {
  BehaviorMatcher,
  BOT_PATTERNS
} = require('./behavior-matcher');
const {
  AnomalyDetector,
  DETECTION_METHODS,
  ANOMALY_SEVERITY
} = require('./anomaly-detector');

module.exports = {
  // Phase 1: Core Detection Engine
  TechnologyDetectionEngine,

  // Phase 2: Advanced Detection Features
  VersionFingerprinter,
  VulnerabilityDetector,
  ConfigurationAnalyzer,
  UpdateRecommender,

  // Phase 3: Bot Detection (Advanced)
  FingerprintAnalyzer,
  BehaviorMatcher,
  AnomalyDetector,

  // Constants and enums
  TECH_SIGNATURES,
  FINGERPRINT_VECTORS,
  RISK_LEVELS,
  BOT_PATTERNS,
  DETECTION_METHODS,
  ANOMALY_SEVERITY,

  // Utility functions
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
  createUpdateRecommender: (options) => new UpdateRecommender(options),
  createFingerprintAnalyzer: (options) => new FingerprintAnalyzer(options),
  createBehaviorMatcher: (options) => new BehaviorMatcher(options),
  createAnomalyDetector: (options) => new AnomalyDetector(options)
};

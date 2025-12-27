/**
 * Basset Hound Browser - Technology Detection Module
 * Exports all components for technology detection
 */

const {
  TechnologyManager,
  TechnologyDetector,
  createDetector,
  CONFIDENCE_LEVELS,
  SOURCE_WEIGHTS,
  FINGERPRINTS,
  CATEGORIES,
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
} = require('./manager');

module.exports = {
  // Main manager class
  TechnologyManager,

  // Detector class and factory
  TechnologyDetector,
  createDetector,

  // Constants
  CONFIDENCE_LEVELS,
  SOURCE_WEIGHTS,
  FINGERPRINTS,
  CATEGORIES,

  // Utility functions
  getFingerprints,
  getCategories,
  getFingerprint,
  getTechnologiesByCategory,
  getTechnologyCount,
  searchTechnologies
};

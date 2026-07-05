/**
 * Image Metadata Extractor — shared constants
 *
 * Extracted from extraction/image-metadata-extractor.js during modularization
 * (2026-07-04). Behavior unchanged; values are byte-identical to the originals.
 *
 * @module extraction/image-metadata/constants
 */

/**
 * Default configuration for image metadata extraction
 */
const DEFAULT_OPTIONS = {
  // Metadata extraction
  extractExif: true,
  extractIptc: true,
  extractXmp: true,
  extractGps: true,
  extractThumbnail: false,

  // Visual analysis
  generateHash: true,
  calculateDimensions: true,

  // Advanced features (require additional libraries)
  runOcr: false,
  ocrLanguage: 'eng',
  detectFaces: false,

  // Performance
  chunkSize: 65536,
  useChunkedParsing: true,

  // Output
  normalizeOutput: true,
  includeRawMetadata: false
};

/**
 * Mapping of image types to orphan data types for basset-hound integration
 */
const IMAGE_ORPHAN_MAPPINGS = {
  gps_coordinates: 'geolocation',
  camera_make: 'device',
  camera_model: 'device',
  software: 'software',
  author: 'person',
  copyright: 'organization',
  email: 'email',
  url: 'url'
};

module.exports = {
  DEFAULT_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
};

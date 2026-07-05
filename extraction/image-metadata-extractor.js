/**
 * Image Metadata Extractor — barrel
 *
 * Phase 14: Advanced Image Ingestion
 *
 * Extracts metadata from images including:
 * - EXIF data (camera, settings, GPS, timestamps)
 * - IPTC data (caption, keywords, copyright)
 * - XMP data (title, description, creator)
 * - Visual analysis (dimensions, format, perceptual hash)
 * - OCR text extraction
 * - Face detection
 *
 * Designed to work in both Node.js and browser environments.
 *
 * This file was split into ./image-metadata/*.js during modularization
 * (2026-07-04) to keep every source file under the 1200-line cap. It is now a
 * thin barrel that re-exports the same public surface as before — the
 * `module.exports` shape is unchanged:
 *   { ImageMetadataExtractor, createImageExtractor, DEFAULT_OPTIONS, IMAGE_ORPHAN_MAPPINGS }
 *
 * @module extraction/image-metadata-extractor
 */

const { ImageMetadataExtractor, createImageExtractor } = require('./image-metadata/extractor');
const { DEFAULT_OPTIONS, IMAGE_ORPHAN_MAPPINGS } = require('./image-metadata/constants');

module.exports = {
  ImageMetadataExtractor,
  createImageExtractor,
  DEFAULT_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
};

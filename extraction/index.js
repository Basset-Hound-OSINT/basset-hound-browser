/**
 * Basset Hound Browser - Content Extraction Module
 *
 * Provides comprehensive content extraction capabilities for HTML pages.
 * Supports extraction of metadata, links, forms, images, scripts, stylesheets,
 * and structured data (JSON-LD, Microdata, RDFa).
 *
 * Usage:
 *   const { ExtractionManager } = require('./extraction');
 *   const extractor = new ExtractionManager();
 *
 *   // Extract metadata
 *   const metadata = extractor.extractMetadata(html, 'https://example.com');
 *
 *   // Extract all content types at once
 *   const allData = extractor.extractAll(html, 'https://example.com');
 *
 * Available Methods:
 *   - extractMetadata(html, url) - Extract OG tags, meta tags, Twitter cards
 *   - extractLinks(html, baseUrl) - Extract categorized links
 *   - extractForms(html) - Extract form fields and structure
 *   - extractImages(html, baseUrl) - Extract images with attributes
 *   - extractScripts(html, baseUrl) - Extract script information
 *   - extractStylesheets(html, baseUrl) - Extract CSS references
 *   - extractStructuredData(html) - Extract JSON-LD, Microdata, RDFa
 *   - extractAll(html, url) - Extract everything at once
 *
 * Individual Parsers:
 *   - OpenGraphParser - Parse Open Graph meta tags
 *   - TwitterCardParser - Parse Twitter Card meta tags
 *   - JsonLdParser - Parse JSON-LD structured data
 *   - MicrodataParser - Parse HTML5 Microdata
 *   - RdfaParser - Parse RDFa attributes
 *
 * @module extraction
 */

const {
  ExtractionManager,
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser
} = require('./manager');

const {
  BaseParser
} = require('./parsers');

const {
  DataTypeDetector,
  createDetector,
  DETECTION_PATTERNS,
  VALIDATORS
} = require('./data-type-detector');

const {
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES,
  DEFAULT_CONFIG
} = require('./ingestion-processor');

const {
  ImageMetadataExtractor,
  createImageExtractor,
  DEFAULT_OPTIONS: IMAGE_EXTRACTOR_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
} = require('./image-metadata-extractor');

module.exports = {
  // Main manager
  ExtractionManager,

  // Individual parsers
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser,
  BaseParser,

  // Data type detection (Phase 13)
  DataTypeDetector,
  createDetector,
  DETECTION_PATTERNS,
  VALIDATORS,

  // Ingestion processing (Phase 13)
  IngestionProcessor,
  createIngestionProcessor,
  INGESTION_MODES,
  DEFAULT_CONFIG,

  // Image metadata extraction (Phase 14)
  ImageMetadataExtractor,
  createImageExtractor,
  IMAGE_EXTRACTOR_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS,

  // Factory function for convenience
  createExtractor: () => new ExtractionManager()
};

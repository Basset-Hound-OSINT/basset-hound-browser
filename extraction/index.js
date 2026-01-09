/**
 * Basset Hound Browser - Content Extraction Module
 *
 * Provides raw content extraction capabilities for HTML pages and forensic
 * metadata extraction from images. This module focuses on extracting content
 * without interpretation or ingestion processing.
 *
 * Core Components:
 *   - ExtractionManager: Extracts raw content from HTML pages including
 *     metadata, links, forms, images, scripts, stylesheets, and structured data
 *   - ImageMetadataExtractor: Extracts forensic metadata from images including
 *     EXIF, IPTC, XMP data and performs orphan analysis
 *
 * Usage - HTML Extraction:
 *   const { ExtractionManager } = require('./extraction');
 *   const extractor = new ExtractionManager();
 *
 *   // Extract metadata
 *   const metadata = extractor.extractMetadata(html, 'https://example.com');
 *
 *   // Extract all content types at once
 *   const allData = extractor.extractAll(html, 'https://example.com');
 *
 * Usage - Image Metadata:
 *   const { ImageMetadataExtractor } = require('./extraction');
 *   const imageExtractor = new ImageMetadataExtractor();
 *   const metadata = await imageExtractor.extractMetadata(imageBuffer);
 *
 * ExtractionManager Methods:
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
  ImageMetadataExtractor,
  createImageExtractor,
  DEFAULT_OPTIONS: IMAGE_EXTRACTOR_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
} = require('./image-metadata-extractor');

module.exports = {
  // Main extraction manager
  ExtractionManager,

  // Individual parsers
  OpenGraphParser,
  TwitterCardParser,
  JsonLdParser,
  MicrodataParser,
  RdfaParser,
  BaseParser,

  // Image metadata extraction (forensic data)
  ImageMetadataExtractor,
  createImageExtractor,
  IMAGE_EXTRACTOR_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS,

  // Factory function for convenience
  createExtractor: () => new ExtractionManager()
};

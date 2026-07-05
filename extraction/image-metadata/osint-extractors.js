/**
 * Image Metadata Extractor — OSINT / orphan-data extraction (prototype mixin)
 *
 * These methods are mixed onto ImageMetadataExtractor.prototype via
 * Object.assign. `_extractOsintFromMetadata` mutates the passed result object,
 * and `generateOrphanData` is part of the public API surface.
 *
 * Extracted from extraction/image-metadata-extractor.js during modularization
 * (2026-07-04). Logic moved verbatim.
 *
 * @module extraction/image-metadata/osint-extractors
 */

module.exports = {
  /**
   * Extract OSINT-relevant data from OCR text
   * @private
   */
  _extractOsintFromText(text) {
    if (!text) {
      return [];
    }

    const osintData = [];

    // Email patterns
    const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    if (emails) {
      for (const email of emails) {
        osintData.push({
          type: 'email',
          value: email,
          confidence: 0.7, // Lower confidence for OCR-extracted data
          source: 'ocr'
        });
      }
    }

    // Phone patterns
    const phones = text.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g);
    if (phones) {
      for (const phone of phones) {
        osintData.push({
          type: 'phone',
          value: phone,
          confidence: 0.6,
          source: 'ocr'
        });
      }
    }

    // URL patterns
    const urls = text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi);
    if (urls) {
      for (const url of urls) {
        osintData.push({
          type: 'url',
          value: url,
          confidence: 0.7,
          source: 'ocr'
        });
      }
    }

    return osintData;
  },

  /**
   * Extract OSINT-relevant data from image metadata
   * @private
   */
  _extractOsintFromMetadata(result) {
    const { metadata } = result;

    // Camera/device info
    if (metadata.exif?.camera) {
      const { make, model, serialNumber } = metadata.exif.camera;
      if (make || model) {
        result.osintData.push({
          type: 'device',
          value: [make, model].filter(Boolean).join(' '),
          confidence: 1.0,
          source: 'exif',
          metadata: {
            make,
            model,
            serialNumber
          }
        });
      }
    }

    // Software info
    if (metadata.exif?.camera?.software) {
      result.osintData.push({
        type: 'software',
        value: metadata.exif.camera.software,
        confidence: 1.0,
        source: 'exif'
      });
    }

    // Author/creator info from IPTC/XMP
    if (metadata.iptc?.byline) {
      result.osintData.push({
        type: 'person',
        value: metadata.iptc.byline,
        confidence: 0.9,
        source: 'iptc'
      });
    }

    if (metadata.xmp?.creator) {
      for (const creator of metadata.xmp.creator) {
        result.osintData.push({
          type: 'person',
          value: creator,
          confidence: 0.9,
          source: 'xmp'
        });
      }
    }

    // Copyright/organization info
    if (metadata.iptc?.copyright) {
      result.osintData.push({
        type: 'organization',
        value: metadata.iptc.copyright,
        confidence: 0.8,
        source: 'iptc'
      });
    }

    // Location info from IPTC
    if (metadata.iptc?.city || metadata.iptc?.country) {
      const location = [
        metadata.iptc.city,
        metadata.iptc.state,
        metadata.iptc.country
      ].filter(Boolean).join(', ');

      if (location) {
        result.osintData.push({
          type: 'location',
          value: location,
          confidence: 0.9,
          source: 'iptc',
          metadata: {
            city: metadata.iptc.city,
            state: metadata.iptc.state,
            country: metadata.iptc.country,
            countryCode: metadata.iptc.countryCode
          }
        });
      }
    }

    // Dates
    const originalDate = metadata.exif?.dates?.dateTimeOriginal;
    if (originalDate) {
      result.osintData.push({
        type: 'date',
        value: originalDate.toString(),
        confidence: 1.0,
        source: 'exif',
        metadata: {
          type: 'photo_taken'
        }
      });
    }
  },

  /**
   * Generate orphan data structure for basset-hound integration
   *
   * @param {Object} extractionResult - Result from extract()
   * @param {string} sourceUrl - URL where the image was found
   * @returns {Array<Object>} Array of orphan data objects
   */
  generateOrphanData(extractionResult, sourceUrl) {
    const orphans = [];

    for (const osintItem of extractionResult.osintData || []) {
      const orphan = {
        identifier_type: osintItem.type,
        identifier_value: osintItem.value,
        source: sourceUrl || 'image_metadata',
        confidence_score: osintItem.confidence,
        discovered_date: extractionResult.extractedAt,
        tags: ['image_metadata', osintItem.source],
        metadata: {
          extraction_source: osintItem.source,
          ...osintItem.metadata
        }
      };

      orphans.push(orphan);
    }

    return orphans;
  }
};

/**
 * Image Metadata Extractor — core class
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
 * This file holds the constructor, the top-level `extract` orchestration, the
 * image-processing helpers, and lifecycle/stats methods. Cohesive method
 * clusters live in sibling modules and are mixed onto the prototype below:
 *   - ./lazy-loaders        (_load* library loaders)
 *   - ./exif-normalizers    (EXIF/IPTC/XMP/GPS extraction + normalizers)
 *   - ./osint-extractors    (OSINT + orphan-data generation)
 *   - ./webcontents-capture (canvas / SVG / favicon-OG page capture)
 *
 * @module extraction/image-metadata/extractor
 */

const { BaseParser } = require('../parsers');
const { DEFAULT_OPTIONS } = require('./constants');
const lazyLoaders = require('./lazy-loaders');
const exifNormalizers = require('./exif-normalizers');
const osintExtractors = require('./osint-extractors');
const webContentsCapture = require('./webcontents-capture');

/**
 * ImageMetadataExtractor - Comprehensive image metadata extraction
 *
 * @extends BaseParser
 */
class ImageMetadataExtractor extends BaseParser {
  /**
   * Create an ImageMetadataExtractor instance
   *
   * @param {Object} options - Configuration options
   * @param {boolean} [options.extractExif=true] - Extract EXIF data
   * @param {boolean} [options.extractIptc=true] - Extract IPTC data
   * @param {boolean} [options.extractXmp=true] - Extract XMP data
   * @param {boolean} [options.extractGps=true] - Extract GPS coordinates
   * @param {boolean} [options.extractThumbnail=false] - Extract embedded thumbnail
   * @param {boolean} [options.generateHash=true] - Generate perceptual hash
   * @param {boolean} [options.runOcr=false] - Run OCR on image
   * @param {string} [options.ocrLanguage='eng'] - OCR language
   * @param {boolean} [options.detectFaces=false] - Detect faces in image
   */
  constructor(options = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Lazy-loaded library references
    this._exifr = null;
    this._exifReader = null;
    this._tesseract = null;
    this._faceApi = null;
    this._sharp = null;
    this._jimp = null;

    // State
    this._tesseractWorker = null;
    this._faceApiLoaded = false;
    this._isNode = typeof window === 'undefined';
  }

  /**
   * Extract all metadata from an image
   *
   * @param {Buffer|ArrayBuffer|string|File|Blob} input - Image input (buffer, file path, URL, or File/Blob)
   * @param {Object} [extractOptions] - Override default options for this extraction
   * @returns {Promise<Object>} Extraction result with metadata and analysis
   *
   * @example
   * const extractor = new ImageMetadataExtractor();
   * const result = await extractor.extract('/path/to/image.jpg');
   * console.log(result.metadata.exif.camera);
   * console.log(result.metadata.gps);
   */
  async extract(input, extractOptions = {}) {
    const options = { ...this.options, ...extractOptions };
    const startTime = Date.now();

    const result = {
      success: true,
      extractedAt: new Date().toISOString(),
      processingTimeMs: 0,
      source: this._getSourceInfo(input),
      metadata: {},
      analysis: {},
      osintData: [],
      errors: [],
      warnings: []
    };

    try {
      // Extract EXIF data with exifr (fast)
      if (options.extractExif) {
        try {
          const exifData = await this._extractExifWithExifr(input, options);
          if (exifData) {
            result.metadata.exif = exifData;
          }
        } catch (err) {
          result.warnings.push(`EXIF extraction warning: ${err.message}`);
        }
      }

      // Extract GPS data separately (exifr has a dedicated method)
      if (options.extractGps) {
        try {
          const gpsData = await this._extractGps(input);
          if (gpsData) {
            result.metadata.gps = gpsData;

            // Add to OSINT data
            result.osintData.push({
              type: 'geolocation',
              value: `${gpsData.latitude},${gpsData.longitude}`,
              confidence: 1.0,
              source: 'exif_gps',
              metadata: gpsData
            });
          }
        } catch (err) {
          result.warnings.push(`GPS extraction warning: ${err.message}`);
        }
      }

      // Extract IPTC/XMP with ExifReader (comprehensive)
      if (options.extractIptc || options.extractXmp) {
        try {
          const extendedData = await this._extractWithExifReader(input, options);
          if (extendedData.iptc) {
            result.metadata.iptc = extendedData.iptc;
          }
          if (extendedData.xmp) {
            result.metadata.xmp = extendedData.xmp;
          }
        } catch (err) {
          result.warnings.push(`IPTC/XMP extraction warning: ${err.message}`);
        }
      }

      // Extract thumbnail
      if (options.extractThumbnail) {
        try {
          const thumbnail = await this._extractThumbnail(input);
          if (thumbnail) {
            result.metadata.thumbnail = thumbnail;
          }
        } catch (err) {
          result.warnings.push(`Thumbnail extraction warning: ${err.message}`);
        }
      }

      // Get image dimensions
      if (options.calculateDimensions) {
        try {
          const dimensions = await this._getDimensions(input);
          if (dimensions) {
            result.analysis.dimensions = dimensions;
          }
        } catch (err) {
          result.warnings.push(`Dimension calculation warning: ${err.message}`);
        }
      }

      // Generate perceptual hash
      if (options.generateHash) {
        try {
          const hash = await this._generatePerceptualHash(input);
          if (hash) {
            result.analysis.perceptualHash = hash;
          }
        } catch (err) {
          result.warnings.push(`Hash generation warning: ${err.message}`);
        }
      }

      // Run OCR
      if (options.runOcr) {
        try {
          const ocrResult = await this._extractText(input, options.ocrLanguage);
          if (ocrResult) {
            result.analysis.ocr = ocrResult;

            // Extract OSINT data from OCR text
            const textOsint = this._extractOsintFromText(ocrResult.text);
            result.osintData.push(...textOsint);
          }
        } catch (err) {
          result.warnings.push(`OCR warning: ${err.message}`);
        }
      }

      // Detect faces
      if (options.detectFaces) {
        try {
          const faces = await this._detectFaces(input);
          if (faces) {
            result.analysis.faces = faces;
          }
        } catch (err) {
          result.warnings.push(`Face detection warning: ${err.message}`);
        }
      }

      // Extract OSINT-relevant data from metadata
      this._extractOsintFromMetadata(result);

    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Extract embedded thumbnail
   * @private
   */
  async _extractThumbnail(input) {
    const exifr = await this._loadExifr();
    if (!exifr) {
      return null;
    }

    const thumbnail = await exifr.thumbnail(input);

    if (!thumbnail) {
      return null;
    }

    // Convert to base64
    if (Buffer.isBuffer(thumbnail)) {
      return {
        data: thumbnail.toString('base64'),
        mimeType: 'image/jpeg',
        encoding: 'base64'
      };
    }

    if (thumbnail instanceof ArrayBuffer || thumbnail instanceof Uint8Array) {
      const buffer = Buffer.from(thumbnail);
      return {
        data: buffer.toString('base64'),
        mimeType: 'image/jpeg',
        encoding: 'base64'
      };
    }

    return null;
  }

  /**
   * Get image dimensions
   * @private
   */
  async _getDimensions(input) {
    // Try sharp first (Node.js)
    const sharp = await this._loadSharp();
    if (sharp) {
      try {
        let sharpInput = input;
        if (typeof input === 'string' && !this._isNode) {
          const response = await fetch(input);
          sharpInput = await response.arrayBuffer();
        }

        const metadata = await sharp(sharpInput).metadata();
        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          channels: metadata.channels,
          depth: metadata.depth,
          density: metadata.density,
          hasAlpha: metadata.hasAlpha,
          orientation: metadata.orientation
        };
      } catch (err) {
        // Fall through to jimp
      }
    }

    // Try jimp as fallback
    const Jimp = await this._loadJimp();
    if (Jimp) {
      try {
        const image = await Jimp.read(input);
        return {
          width: image.getWidth(),
          height: image.getHeight(),
          format: image.getMIME().split('/')[1],
          hasAlpha: image.hasAlpha()
        };
      } catch (err) {
        // No dimensions available
      }
    }

    return null;
  }

  /**
   * Generate perceptual hash for image similarity comparison
   * @private
   */
  async _generatePerceptualHash(input) {
    // Try jimp's built-in hash
    const Jimp = await this._loadJimp();
    if (Jimp) {
      try {
        const image = await Jimp.read(input);
        const hash = image.hash();
        return {
          algorithm: 'pHash',
          value: hash,
          bits: 64
        };
      } catch (err) {
        // Hash generation failed
      }
    }

    // Try sharp-based simple average hash
    const sharp = await this._loadSharp();
    if (sharp) {
      try {
        const thumbnail = await sharp(input)
          .resize(8, 8, { fit: 'fill' })
          .grayscale()
          .raw()
          .toBuffer();

        const pixels = Array.from(thumbnail);
        const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;

        let hash = '';
        for (const pixel of pixels) {
          hash += pixel > avg ? '1' : '0';
        }

        // Convert binary to hex
        const hexHash = parseInt(hash, 2).toString(16).padStart(16, '0');

        return {
          algorithm: 'aHash',
          value: hexHash,
          bits: 64
        };
      } catch (err) {
        // Hash generation failed
      }
    }

    return null;
  }

  /**
   * Extract text from image using OCR
   * @private
   */
  async _extractText(input, language = 'eng') {
    const Tesseract = await this._loadTesseract();
    if (!Tesseract) {
      return null;
    }

    // Create or reuse worker
    if (!this._tesseractWorker) {
      this._tesseractWorker = await Tesseract.createWorker(language);
    }

    const { data } = await this._tesseractWorker.recognize(input);

    return {
      text: data.text,
      confidence: data.confidence,
      language: language,
      words: data.words.map(w => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox
      })),
      lines: data.lines.map(l => ({
        text: l.text,
        confidence: l.confidence,
        bbox: l.bbox
      })),
      paragraphs: data.paragraphs?.map(p => ({
        text: p.text,
        confidence: p.confidence
      })) || []
    };
  }

  /**
   * Detect faces in image
   * @private
   */
  async _detectFaces(input) {
    // Face detection requires face-api.js which has complex setup
    // Return placeholder for now - full implementation would load models
    return {
      available: false,
      message: 'Face detection requires face-api.js models to be loaded',
      detections: []
    };
  }

  /**
   * Get source information from input
   * @private
   */
  _getSourceInfo(input) {
    if (typeof input === 'string') {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        return { type: 'url', value: input };
      }
      if (input.startsWith('data:')) {
        return { type: 'dataUrl', value: input.substring(0, 50) + '...' };
      }
      return { type: 'path', value: input };
    }

    if (Buffer.isBuffer(input)) {
      return { type: 'buffer', size: input.length };
    }

    if (input instanceof ArrayBuffer) {
      return { type: 'arrayBuffer', size: input.byteLength };
    }

    if (typeof File !== 'undefined' && input instanceof File) {
      return { type: 'file', name: input.name, size: input.size };
    }

    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      return { type: 'blob', size: input.size };
    }

    return { type: 'unknown' };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this._tesseractWorker) {
      await this._tesseractWorker.terminate();
      this._tesseractWorker = null;
    }
  }

  /**
   * Get extraction statistics
   * @returns {Object} Statistics about the extractor
   */
  getStats() {
    return {
      librariesLoaded: {
        exifr: Boolean(this._exifr),
        exifReader: Boolean(this._exifReader),
        tesseract: Boolean(this._tesseract),
        sharp: Boolean(this._sharp),
        jimp: Boolean(this._jimp)
      },
      tesseractWorkerActive: Boolean(this._tesseractWorker),
      isNodeEnvironment: this._isNode,
      options: { ...this.options }
    };
  }
}

// Mix in the extracted cohesive method clusters. Each module exports a plain
// object of functions that use `this` (the extractor instance); attaching them
// to the prototype preserves the original single-class public surface.
Object.assign(
  ImageMetadataExtractor.prototype,
  lazyLoaders,
  exifNormalizers,
  osintExtractors,
  webContentsCapture
);

/**
 * Factory function to create an ImageMetadataExtractor instance
 *
 * @param {Object} options - Configuration options
 * @returns {ImageMetadataExtractor} New extractor instance
 */
function createImageExtractor(options = {}) {
  return new ImageMetadataExtractor(options);
}

module.exports = {
  ImageMetadataExtractor,
  createImageExtractor
};

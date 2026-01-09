/**
 * Image Metadata Extractor
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
 * @module extraction/image-metadata-extractor
 */

const { BaseParser } = require('./parsers');

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
   * Load exifr library (lazy loading)
   * @private
   */
  async _loadExifr() {
    if (this._exifr) return this._exifr;

    try {
      this._exifr = require('exifr');
      return this._exifr;
    } catch (error) {
      console.warn('exifr not available, EXIF extraction will be limited');
      return null;
    }
  }

  /**
   * Load ExifReader library (lazy loading)
   * @private
   */
  async _loadExifReader() {
    if (this._exifReader) return this._exifReader;

    try {
      this._exifReader = require('exifreader');
      return this._exifReader;
    } catch (error) {
      console.warn('exifreader not available, IPTC/XMP extraction will be limited');
      return null;
    }
  }

  /**
   * Load Tesseract.js library (lazy loading)
   * @private
   */
  async _loadTesseract() {
    if (this._tesseract) return this._tesseract;

    try {
      this._tesseract = require('tesseract.js');
      return this._tesseract;
    } catch (error) {
      console.warn('tesseract.js not available, OCR will be disabled');
      return null;
    }
  }

  /**
   * Load sharp library for Node.js (lazy loading)
   * @private
   */
  async _loadSharp() {
    if (!this._isNode) return null;
    if (this._sharp) return this._sharp;

    try {
      this._sharp = require('sharp');
      return this._sharp;
    } catch (error) {
      console.warn('sharp not available, falling back to jimp');
      return null;
    }
  }

  /**
   * Load jimp library (lazy loading)
   * @private
   */
  async _loadJimp() {
    if (this._jimp) return this._jimp;

    try {
      this._jimp = require('jimp');
      return this._jimp;
    } catch (error) {
      console.warn('jimp not available, image processing will be limited');
      return null;
    }
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
   * Extract EXIF data using exifr library
   * @private
   */
  async _extractExifWithExifr(input, options) {
    const exifr = await this._loadExifr();
    if (!exifr) return null;

    const parseOptions = {
      tiff: true,
      exif: true,
      gps: options.extractGps,
      iptc: false, // We use ExifReader for this
      xmp: false,  // We use ExifReader for this
      chunked: options.useChunkedParsing,
      firstChunkSize: options.chunkSize,
      chunkSize: options.chunkSize
    };

    const rawExif = await exifr.parse(input, parseOptions);

    if (!rawExif) return null;

    if (options.normalizeOutput) {
      return this._normalizeExif(rawExif);
    }

    return rawExif;
  }

  /**
   * Normalize EXIF data to a consistent structure
   * @private
   */
  _normalizeExif(exif) {
    if (!exif) return null;

    return {
      camera: {
        make: exif.Make || null,
        model: exif.Model || null,
        software: exif.Software || null,
        serialNumber: exif.BodySerialNumber || exif.SerialNumber || null
      },
      settings: {
        exposureTime: exif.ExposureTime || null,
        fNumber: exif.FNumber || null,
        iso: exif.ISO || exif.ISOSpeedRatings || null,
        focalLength: exif.FocalLength || null,
        focalLengthIn35mm: exif.FocalLengthIn35mmFormat || null,
        flash: exif.Flash || null,
        whiteBalance: exif.WhiteBalance || null,
        exposureProgram: exif.ExposureProgram || null,
        meteringMode: exif.MeteringMode || null,
        exposureCompensation: exif.ExposureCompensation || null,
        lensModel: exif.LensModel || exif.Lens || null
      },
      dates: {
        dateTimeOriginal: exif.DateTimeOriginal || null,
        dateTimeDigitized: exif.DateTimeDigitized || null,
        modifyDate: exif.ModifyDate || exif.DateTime || null,
        createDate: exif.CreateDate || null
      },
      image: {
        width: exif.ImageWidth || exif.ExifImageWidth || null,
        height: exif.ImageHeight || exif.ExifImageHeight || null,
        orientation: exif.Orientation || null,
        colorSpace: exif.ColorSpace || null,
        compression: exif.Compression || null
      },
      thumbnail: {
        width: exif.ThumbnailWidth || null,
        height: exif.ThumbnailHeight || null,
        compression: exif.ThumbnailCompression || null
      }
    };
  }

  /**
   * Extract GPS coordinates
   * @private
   */
  async _extractGps(input) {
    const exifr = await this._loadExifr();
    if (!exifr) return null;

    const gps = await exifr.gps(input);

    if (!gps || (gps.latitude === undefined && gps.longitude === undefined)) {
      return null;
    }

    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
      altitude: gps.altitude || null,
      // Convert to decimal string format for display
      latitudeRef: gps.latitude >= 0 ? 'N' : 'S',
      longitudeRef: gps.longitude >= 0 ? 'E' : 'W',
      // Generate Google Maps URL
      mapsUrl: `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`
    };
  }

  /**
   * Extract IPTC and XMP data using ExifReader
   * @private
   */
  async _extractWithExifReader(input, options) {
    const ExifReader = await this._loadExifReader();
    if (!ExifReader) return { iptc: null, xmp: null };

    let buffer = input;

    // Convert input to buffer if needed
    if (typeof input === 'string') {
      if (this._isNode) {
        const fs = require('fs');
        buffer = fs.readFileSync(input);
      } else {
        // In browser, fetch the URL
        const response = await fetch(input);
        buffer = await response.arrayBuffer();
      }
    }

    const tags = await ExifReader.load(buffer, { expanded: true });

    const result = { iptc: null, xmp: null };

    if (options.extractIptc && tags.iptc) {
      result.iptc = this._normalizeIptc(tags.iptc);
    }

    if (options.extractXmp && tags.xmp) {
      result.xmp = this._normalizeXmp(tags.xmp);
    }

    return result;
  }

  /**
   * Normalize IPTC data
   * @private
   */
  _normalizeIptc(iptc) {
    if (!iptc) return null;

    return {
      headline: iptc.Headline?.description || null,
      caption: iptc['Caption/Abstract']?.description || null,
      keywords: this._normalizeArray(iptc.Keywords),
      byline: iptc['By-line']?.description || null,
      bylineTitle: iptc['By-line Title']?.description || null,
      credit: iptc.Credit?.description || null,
      source: iptc.Source?.description || null,
      copyright: iptc['Copyright Notice']?.description || null,
      contact: iptc['Writer/Editor']?.description || null,
      city: iptc.City?.description || null,
      state: iptc['Province/State']?.description || null,
      country: iptc['Country/Primary Location Name']?.description || null,
      countryCode: iptc['Country/Primary Location Code']?.description || null,
      dateCreated: iptc['Date Created']?.description || null,
      timeCreated: iptc['Time Created']?.description || null,
      specialInstructions: iptc['Special Instructions']?.description || null,
      urgency: iptc.Urgency?.description || null,
      category: iptc.Category?.description || null,
      supplementalCategories: this._normalizeArray(iptc['Supplemental Category'])
    };
  }

  /**
   * Normalize XMP data
   * @private
   */
  _normalizeXmp(xmp) {
    if (!xmp) return null;

    return {
      title: xmp.title?.description || null,
      description: xmp.description?.description || null,
      creator: this._normalizeArray(xmp.creator),
      rights: xmp.rights?.description || null,
      subject: this._normalizeArray(xmp.subject),
      rating: xmp.Rating?.description || null,
      label: xmp.Label?.description || null,
      createDate: xmp.CreateDate?.description || null,
      modifyDate: xmp.ModifyDate?.description || null,
      metadataDate: xmp.MetadataDate?.description || null,
      creatorTool: xmp.CreatorTool?.description || null,
      format: xmp.format?.description || null,
      documentId: xmp.DocumentID?.description || null,
      instanceId: xmp.InstanceID?.description || null
    };
  }

  /**
   * Normalize array values from metadata
   * @private
   */
  _normalizeArray(value) {
    if (!value) return null;

    if (Array.isArray(value)) {
      return value.map(v => v.description || v).filter(Boolean);
    }

    if (value.description) {
      if (Array.isArray(value.description)) {
        return value.description;
      }
      return [value.description];
    }

    return null;
  }

  /**
   * Extract embedded thumbnail
   * @private
   */
  async _extractThumbnail(input) {
    const exifr = await this._loadExifr();
    if (!exifr) return null;

    const thumbnail = await exifr.thumbnail(input);

    if (!thumbnail) return null;

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
    if (!Tesseract) return null;

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
   * Extract OSINT-relevant data from OCR text
   * @private
   */
  _extractOsintFromText(text) {
    if (!text) return [];

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
  }

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

  /**
   * Capture canvas element data from page
   * Note: This method requires a webContents object (browser context)
   *
   * @param {Object} webContents - Electron webContents object
   * @param {Object} [options={}] - Capture options
   * @param {string} [options.selector] - CSS selector for specific canvas (captures all if not specified)
   * @param {string} [options.format='png'] - Output format ('png' or 'jpeg')
   * @param {number} [options.quality=0.92] - JPEG quality (0-1)
   * @returns {Promise<Array>} Array of canvas capture results
   *
   * @example
   * const canvases = await extractor.captureCanvasElements(webContents, {
   *   format: 'png'
   * });
   */
  async captureCanvasElements(webContents, options = {}) {
    const { selector, format = 'png', quality = 0.92 } = options;

    if (!webContents) {
      throw new Error('webContents is required for canvas capture');
    }

    try {
      const canvasData = await webContents.executeJavaScript(`
        (function() {
          const canvases = ${selector ? `document.querySelectorAll('${selector}')` : 'document.querySelectorAll("canvas")'};
          const results = [];

          canvases.forEach((canvas, index) => {
            try {
              // Get canvas context type
              const context2d = canvas.getContext('2d');
              const contextWebgl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
              const contextWebgl2 = canvas.getContext('webgl2');

              const contextType = contextWebgl2 ? 'webgl2' :
                                 contextWebgl ? 'webgl' :
                                 context2d ? '2d' : 'unknown';

              // Capture canvas data as base64
              const dataUrl = canvas.toDataURL('image/${format}', ${quality});

              // Get canvas attributes
              const rect = canvas.getBoundingClientRect();

              results.push({
                index: index,
                id: canvas.id || null,
                className: canvas.className || null,
                width: canvas.width,
                height: canvas.height,
                displayWidth: rect.width,
                displayHeight: rect.height,
                contextType: contextType,
                dataUrl: dataUrl,
                format: '${format}',
                quality: ${quality}
              });
            } catch (err) {
              results.push({
                index: index,
                error: err.message
              });
            }
          });

          return results;
        })()
      `);

      return {
        success: true,
        capturedAt: new Date().toISOString(),
        totalCanvases: canvasData.length,
        canvases: canvasData.map(canvas => {
          if (canvas.error) {
            return canvas;
          }

          // Extract base64 data from data URL
          const base64Match = canvas.dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
          const base64Data = base64Match ? base64Match[1] : null;

          return {
            ...canvas,
            dataUrl: canvas.dataUrl.substring(0, 50) + '...', // Truncate for readability
            base64Data: base64Data,
            sizeBytes: base64Data ? Math.ceil(base64Data.length * 0.75) : 0
          };
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract SVG elements from page
   * Note: This method requires a webContents object (browser context)
   *
   * @param {Object} webContents - Electron webContents object
   * @param {Object} [options={}] - Extraction options
   * @param {boolean} [options.includeInline=true] - Include inline SVG elements
   * @param {boolean} [options.includeExternal=true] - Include external SVG references
   * @param {boolean} [options.preserveStyles=true] - Preserve computed styles
   * @returns {Promise<Object>} SVG extraction result
   *
   * @example
   * const svgs = await extractor.extractSVGElements(webContents, {
   *   includeInline: true,
   *   includeExternal: true
   * });
   */
  async extractSVGElements(webContents, options = {}) {
    const {
      includeInline = true,
      includeExternal = true,
      preserveStyles = true
    } = options;

    if (!webContents) {
      throw new Error('webContents is required for SVG extraction');
    }

    try {
      const svgData = await webContents.executeJavaScript(`
        (function() {
          const result = {
            inline: [],
            external: []
          };

          // Extract inline SVG elements
          if (${includeInline}) {
            const svgElements = document.querySelectorAll('svg');

            svgElements.forEach((svg, index) => {
              const rect = svg.getBoundingClientRect();

              // Clone to avoid modifying original
              const clone = svg.cloneNode(true);

              // Optionally preserve computed styles
              if (${preserveStyles}) {
                const elements = clone.querySelectorAll('*');
                const origElements = svg.querySelectorAll('*');

                elements.forEach((el, i) => {
                  if (origElements[i]) {
                    const computedStyle = window.getComputedStyle(origElements[i]);
                    const fill = computedStyle.fill;
                    const stroke = computedStyle.stroke;

                    if (fill && fill !== 'none' && !el.hasAttribute('fill')) {
                      el.setAttribute('fill', fill);
                    }
                    if (stroke && stroke !== 'none' && !el.hasAttribute('stroke')) {
                      el.setAttribute('stroke', stroke);
                    }
                  }
                });
              }

              result.inline.push({
                index: index,
                id: svg.id || null,
                className: svg.className.baseVal || null,
                width: svg.width.baseVal.value || rect.width,
                height: svg.height.baseVal.value || rect.height,
                viewBox: svg.getAttribute('viewBox') || null,
                xmlns: svg.getAttribute('xmlns') || 'http://www.w3.org/2000/svg',
                svgContent: clone.outerHTML,
                elementCount: clone.querySelectorAll('*').length,
                hasTitle: !!clone.querySelector('title'),
                hasDesc: !!clone.querySelector('desc'),
                title: clone.querySelector('title')?.textContent || null,
                description: clone.querySelector('desc')?.textContent || null
              });
            });
          }

          // Extract external SVG references
          if (${includeExternal}) {
            // From img tags
            document.querySelectorAll('img[src$=".svg"], img[src*=".svg?"]').forEach(img => {
              result.external.push({
                type: 'img',
                src: img.src,
                alt: img.alt || null,
                width: img.width,
                height: img.height,
                loading: img.loading
              });
            });

            // From object tags
            document.querySelectorAll('object[type="image/svg+xml"]').forEach(obj => {
              result.external.push({
                type: 'object',
                data: obj.data,
                width: obj.width,
                height: obj.height
              });
            });

            // From CSS background images
            document.querySelectorAll('*').forEach(el => {
              const style = window.getComputedStyle(el);
              const bgImage = style.backgroundImage;
              if (bgImage && bgImage.includes('.svg')) {
                const urlMatch = bgImage.match(/url\\(['"]?([^'"\\)]+\\.svg[^'"\\)]*)['"]?\\)/);
                if (urlMatch) {
                  result.external.push({
                    type: 'background',
                    src: urlMatch[1],
                    element: el.tagName.toLowerCase(),
                    id: el.id || null
                  });
                }
              }
            });

            // From use/symbol references
            document.querySelectorAll('use').forEach(use => {
              const href = use.getAttribute('href') || use.getAttribute('xlink:href');
              if (href && href.includes('.svg')) {
                result.external.push({
                  type: 'use',
                  href: href
                });
              }
            });
          }

          return result;
        })()
      `);

      // Deduplicate external references
      const uniqueExternal = [];
      const seenUrls = new Set();

      for (const item of svgData.external) {
        const url = item.src || item.data || item.href;
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          uniqueExternal.push(item);
        }
      }

      return {
        success: true,
        extractedAt: new Date().toISOString(),
        totalInline: svgData.inline.length,
        totalExternal: uniqueExternal.length,
        inline: svgData.inline,
        external: uniqueExternal,
        options: {
          includeInline,
          includeExternal,
          preserveStyles
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract favicon and Open Graph images from page
   * Note: This method requires a webContents object (browser context)
   *
   * @param {Object} webContents - Electron webContents object
   * @returns {Promise<Object>} Favicon and OG image extraction result
   *
   * @example
   * const images = await extractor.extractFaviconAndOGImages(webContents);
   */
  async extractFaviconAndOGImages(webContents) {
    if (!webContents) {
      throw new Error('webContents is required for favicon/OG extraction');
    }

    try {
      const imageData = await webContents.executeJavaScript(`
        (function() {
          const result = {
            favicons: [],
            openGraph: [],
            twitter: [],
            apple: [],
            msApplication: []
          };

          // Standard favicons
          document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach(link => {
            const sizes = link.getAttribute('sizes');
            result.favicons.push({
              rel: link.rel,
              href: link.href,
              type: link.type || null,
              sizes: sizes || null,
              width: sizes ? parseInt(sizes.split('x')[0]) : null,
              height: sizes ? parseInt(sizes.split('x')[1]) : null
            });
          });

          // Apple touch icons
          document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]').forEach(link => {
            const sizes = link.getAttribute('sizes');
            result.apple.push({
              rel: link.rel,
              href: link.href,
              sizes: sizes || null,
              width: sizes ? parseInt(sizes.split('x')[0]) : null,
              height: sizes ? parseInt(sizes.split('x')[1]) : null
            });
          });

          // Open Graph images
          document.querySelectorAll('meta[property^="og:image"]').forEach(meta => {
            const property = meta.getAttribute('property');

            if (property === 'og:image') {
              result.openGraph.push({
                url: meta.content,
                type: 'og:image'
              });
            } else if (property === 'og:image:url') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].url = meta.content;
              }
            } else if (property === 'og:image:secure_url') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].secureUrl = meta.content;
              }
            } else if (property === 'og:image:type') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].mimeType = meta.content;
              }
            } else if (property === 'og:image:width') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].width = parseInt(meta.content);
              }
            } else if (property === 'og:image:height') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].height = parseInt(meta.content);
              }
            } else if (property === 'og:image:alt') {
              if (result.openGraph.length > 0) {
                result.openGraph[result.openGraph.length - 1].alt = meta.content;
              }
            }
          });

          // Twitter Card images
          document.querySelectorAll('meta[name^="twitter:image"]').forEach(meta => {
            const name = meta.getAttribute('name');

            if (name === 'twitter:image' || name === 'twitter:image:src') {
              result.twitter.push({
                url: meta.content,
                type: name
              });
            } else if (name === 'twitter:image:alt') {
              if (result.twitter.length > 0) {
                result.twitter[result.twitter.length - 1].alt = meta.content;
              }
            } else if (name === 'twitter:image:width') {
              if (result.twitter.length > 0) {
                result.twitter[result.twitter.length - 1].width = parseInt(meta.content);
              }
            } else if (name === 'twitter:image:height') {
              if (result.twitter.length > 0) {
                result.twitter[result.twitter.length - 1].height = parseInt(meta.content);
              }
            }
          });

          // Microsoft application tiles
          document.querySelectorAll('meta[name^="msapplication"]').forEach(meta => {
            const name = meta.getAttribute('name');
            if (name.includes('TileImage') || name.includes('square')) {
              result.msApplication.push({
                name: name,
                url: meta.content
              });
            }
          });

          // Also check for manifest.json
          const manifestLink = document.querySelector('link[rel="manifest"]');
          if (manifestLink) {
            result.manifestUrl = manifestLink.href;
          }

          return result;
        })()
      `);

      return {
        success: true,
        extractedAt: new Date().toISOString(),
        pageUrl: await webContents.executeJavaScript('window.location.href'),
        totalFavicons: imageData.favicons.length,
        totalOpenGraph: imageData.openGraph.length,
        totalTwitter: imageData.twitter.length,
        totalApple: imageData.apple.length,
        totalMsApplication: imageData.msApplication.length,
        favicons: imageData.favicons,
        openGraph: imageData.openGraph,
        twitter: imageData.twitter,
        apple: imageData.apple,
        msApplication: imageData.msApplication,
        manifestUrl: imageData.manifestUrl || null
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
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
        exifr: !!this._exifr,
        exifReader: !!this._exifReader,
        tesseract: !!this._tesseract,
        sharp: !!this._sharp,
        jimp: !!this._jimp
      },
      tesseractWorkerActive: !!this._tesseractWorker,
      isNodeEnvironment: this._isNode,
      options: { ...this.options }
    };
  }
}

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
  createImageExtractor,
  DEFAULT_OPTIONS,
  IMAGE_ORPHAN_MAPPINGS
};

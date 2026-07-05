/**
 * Image Metadata Extractor — EXIF / IPTC / XMP / GPS extraction + normalizers
 * (prototype mixin)
 *
 * These methods are mixed onto ImageMetadataExtractor.prototype via
 * Object.assign, so `this` is the extractor instance (used for the lazy
 * loaders like this._loadExifr() and the this._isNode flag).
 *
 * Extracted from extraction/image-metadata-extractor.js during modularization
 * (2026-07-04). Logic moved verbatim.
 *
 * @module extraction/image-metadata/exif-normalizers
 */

module.exports = {
  /**
   * Extract EXIF data using exifr library
   * @private
   */
  async _extractExifWithExifr(input, options) {
    const exifr = await this._loadExifr();
    if (!exifr) {
      return null;
    }

    const parseOptions = {
      tiff: true,
      exif: true,
      gps: options.extractGps,
      iptc: false, // We use ExifReader for this
      xmp: false, // We use ExifReader for this
      chunked: options.useChunkedParsing,
      firstChunkSize: options.chunkSize,
      chunkSize: options.chunkSize
    };

    const rawExif = await exifr.parse(input, parseOptions);

    if (!rawExif) {
      return null;
    }

    if (options.normalizeOutput) {
      return this._normalizeExif(rawExif);
    }

    return rawExif;
  },

  /**
   * Normalize EXIF data to a consistent structure
   * @private
   */
  _normalizeExif(exif) {
    if (!exif) {
      return null;
    }

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
  },

  /**
   * Extract GPS coordinates
   * @private
   */
  async _extractGps(input) {
    const exifr = await this._loadExifr();
    if (!exifr) {
      return null;
    }

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
  },

  /**
   * Extract IPTC and XMP data using ExifReader
   * @private
   */
  async _extractWithExifReader(input, options) {
    const ExifReader = await this._loadExifReader();
    if (!ExifReader) {
      return { iptc: null, xmp: null };
    }

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
  },

  /**
   * Normalize IPTC data
   * @private
   */
  _normalizeIptc(iptc) {
    if (!iptc) {
      return null;
    }

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
  },

  /**
   * Normalize XMP data
   * @private
   */
  _normalizeXmp(xmp) {
    if (!xmp) {
      return null;
    }

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
  },

  /**
   * Normalize array values from metadata
   * @private
   */
  _normalizeArray(value) {
    if (!value) {
      return null;
    }

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
};

/**
 * Image Metadata Extractor — lazy library loaders (prototype mixin)
 *
 * These methods are mixed onto ImageMetadataExtractor.prototype via
 * Object.assign, so `this` is the extractor instance. Each loader caches the
 * resolved module handle on the instance (this._exifr, this._sharp, ...).
 *
 * Extracted from extraction/image-metadata-extractor.js during modularization
 * (2026-07-04). Logic moved verbatim.
 *
 * @module extraction/image-metadata/lazy-loaders
 */

module.exports = {
  /**
   * Load exifr library (lazy loading)
   * @private
   */
  async _loadExifr() {
    if (this._exifr) {
      return this._exifr;
    }

    try {
      this._exifr = require('exifr');
      return this._exifr;
    } catch (error) {
      console.warn('exifr not available, EXIF extraction will be limited');
      return null;
    }
  },

  /**
   * Load ExifReader library (lazy loading)
   * @private
   */
  async _loadExifReader() {
    if (this._exifReader) {
      return this._exifReader;
    }

    try {
      this._exifReader = require('exifreader');
      return this._exifReader;
    } catch (error) {
      console.warn('exifreader not available, IPTC/XMP extraction will be limited');
      return null;
    }
  },

  /**
   * Load Tesseract.js library (lazy loading)
   * @private
   */
  async _loadTesseract() {
    if (this._tesseract) {
      return this._tesseract;
    }

    try {
      this._tesseract = require('tesseract.js');
      return this._tesseract;
    } catch (error) {
      console.warn('tesseract.js not available, OCR will be disabled');
      return null;
    }
  },

  /**
   * Load sharp library for Node.js (lazy loading)
   * @private
   */
  async _loadSharp() {
    if (!this._isNode) {
      return null;
    }
    if (this._sharp) {
      return this._sharp;
    }

    try {
      this._sharp = require('sharp');
      return this._sharp;
    } catch (error) {
      console.warn('sharp not available, falling back to jimp');
      return null;
    }
  },

  /**
   * Load jimp library (lazy loading)
   * @private
   */
  async _loadJimp() {
    if (this._jimp) {
      return this._jimp;
    }

    try {
      this._jimp = require('jimp');
      return this._jimp;
    } catch (error) {
      console.warn('jimp not available, image processing will be limited');
      return null;
    }
  }
};

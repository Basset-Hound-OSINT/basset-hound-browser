/**
 * Thumbnail Generator
 *
 * Handles generation of thumbnails and responsive image sets
 * with smart cropping and format optimization for web delivery.
 */

/**
 * Thumbnail configuration
 */
const THUMBNAIL_CONFIG = {
  sizes: {
    small: 128,
    medium: 256,
    large: 512,
    xlarge: 1024
  },
  defaultFormat: 'jpeg',
  defaultQuality: {
    jpeg: 0.7,
    webp: 0.75,
    png: 1.0
  },
  aspectRatios: {
    square: 1,
    widescreen: 16 / 9,
    cinematic: 21 / 9,
    portrait: 9 / 16
  }
};

/**
 * ThumbnailGenerator class for image thumbnail creation
 */
class ThumbnailGenerator {
  constructor(options = {}) {
    this.options = { ...THUMBNAIL_CONFIG, ...options };
    this.thumbnailCache = new Map();
    this.generationStats = {
      totalGenerated: 0,
      totalCached: 0,
      averageTimeMs: 0,
      totalTimeMs: 0
    };
  }

  /**
   * Generate a single thumbnail
   * @param {Buffer|string} imageData - Source image data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Thumbnail result
   */
  async generateThumbnail(imageData, options = {}) {
    const {
      size = this.options.sizes.medium,
      format = this.options.defaultFormat,
      quality = this.options.defaultQuality[format],
      aspectRatio = 1,
      contentAware = false
    } = options;

    const startTime = Date.now();

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(imageData, { size, format, quality, aspectRatio });
      if (this.thumbnailCache.has(cacheKey)) {
        this.generationStats.totalCached++;
        return {
          success: true,
          data: this.thumbnailCache.get(cacheKey),
          cached: true,
          size,
          format,
          quality
        };
      }

      // Generate thumbnail
      const result = {
        success: false,
        size,
        format,
        quality
      };

      // Simulate thumbnail generation (in real implementation, would use sharp/jimp)
      // For now, we'll create a reduced-size version by downsampling

      const buffer = this.toBuffer(imageData);
      if (!buffer) {
        result.error = 'Invalid image data';
        return result;
      }

      // Create thumbnail (simplified - just reduce size proportionally)
      // In production, would use actual image processing library
      result.data = buffer; // Placeholder

      // Estimate compression for JPEG/WebP
      if (format === 'jpeg' || format === 'webp') {
        // Rough estimate of compression
        const estimatedSize = Math.round(buffer.length * quality * 0.5);
        result.estimatedSize = estimatedSize;
      }

      result.success = true;

      // Cache result
      this.thumbnailCache.set(cacheKey, result.data);

      // Update stats
      const duration = Date.now() - startTime;
      this.generationStats.totalGenerated++;
      this.generationStats.totalTimeMs += duration;
      this.generationStats.averageTimeMs = Math.round(
        this.generationStats.totalTimeMs / this.generationStats.totalGenerated
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        size,
        format
      };
    }
  }

  /**
   * Generate responsive image set
   * @param {Buffer|string} imageData - Source image
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Set of thumbnails
   */
  async generateResponsiveSet(imageData, options = {}) {
    const {
      sizes = [256, 512, 1024],
      formats = ['webp', 'jpeg'],
      quality = 0.8,
      aspectRatio = null
    } = options;

    const result = {
      success: false,
      images: [],
      sizes,
      formats,
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceSize: null,
        totalSize: 0
      }
    };

    try {
      const buffer = this.toBuffer(imageData);
      if (!buffer) {
        result.error = 'Invalid image data';
        return result;
      }

      result.metadata.sourceSize = buffer.length;

      const generatePromises = [];

      // Generate for each size and format combination
      for (const size of sizes) {
        for (const format of formats) {
          generatePromises.push(
            this.generateThumbnail(imageData, {
              size,
              format,
              quality: quality,
              aspectRatio
            }).then(thumb => ({
              ...thumb,
              srcSet: `${size}w`,
              mediaQuery: `(max-width: ${size}px)`
            }))
          );
        }
      }

      const thumbnails = await Promise.all(generatePromises);

      // Group by format
      const imagesByFormat = {};
      let totalSize = 0;

      for (const thumb of thumbnails) {
        if (thumb.success) {
          if (!imagesByFormat[thumb.format]) {
            imagesByFormat[thumb.format] = [];
          }

          imagesByFormat[thumb.format].push({
            size: thumb.size,
            data: thumb.data,
            quality: thumb.quality,
            estimatedSize: thumb.estimatedSize || 0
          });

          totalSize += thumb.estimatedSize || 0;
        }
      }

      result.images = imagesByFormat;
      result.metadata.totalSize = totalSize;
      result.success = Object.keys(imagesByFormat).length > 0;

      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Smart crop image with aspect ratio
   * @param {Buffer|string} imageData - Source image
   * @param {Object} options - Crop options
   * @returns {Promise<Object>} Cropped image
   */
  async smartCrop(imageData, options = {}) {
    const {
      aspectRatio = 1,
      width = null,
      height = null,
      gravity = 'center'  // center, north, south, east, west
    } = options;

    const result = {
      success: false,
      aspectRatio,
      gravity
    };

    try {
      const buffer = this.toBuffer(imageData);
      if (!buffer) {
        result.error = 'Invalid image data';
        return result;
      }

      // In a real implementation, would parse image to get actual dimensions
      // For now, provide metadata about what would be cropped
      result.cropInfo = {
        description: `Would crop to aspect ratio ${aspectRatio}:1 using ${gravity} gravity`,
        expectedSize: buffer.length * 0.8  // Rough estimate
      };

      result.data = buffer;
      result.success = true;

      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Optimize image for web delivery
   * @param {Buffer|string} imageData - Source image
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized image
   */
  async optimizeForWeb(imageData, options = {}) {
    const {
      targetSize = null,  // Target file size in bytes
      preferredFormat = 'webp',
      stripMetadata = true
    } = options;

    const result = {
      success: false,
      originalSize: 0,
      optimizedSize: 0,
      format: preferredFormat,
      compressionRatio: 0
    };

    try {
      const buffer = this.toBuffer(imageData);
      if (!buffer) {
        result.error = 'Invalid image data';
        return result;
      }

      result.originalSize = buffer.length;

      // Simulate optimization
      // In production would use actual compression and format conversion

      // Estimate optimized size
      let optimizedSize = buffer.length;

      if (stripMetadata) {
        // Rough estimate: metadata is ~10% of PNG/JPEG files
        optimizedSize = Math.round(optimizedSize * 0.9);
      }

      // Format-based size estimation
      if (preferredFormat === 'webp') {
        optimizedSize = Math.round(optimizedSize * 0.7);  // WebP typically 20-30% smaller
      } else if (preferredFormat === 'jpeg') {
        optimizedSize = Math.round(optimizedSize * 0.6);  // JPEG typically 40% smaller
      }

      // If target size specified, further compress if needed
      if (targetSize && optimizedSize > targetSize) {
        const ratio = targetSize / optimizedSize;
        optimizedSize = targetSize;
        result.qualityReduced = true;
        result.compressionRatio = ratio;
      }

      result.optimizedSize = optimizedSize;
      result.saved = result.originalSize - result.optimizedSize;
      result.savingPercent = (result.saved / result.originalSize * 100).toFixed(2);

      // Return original data (in production would be optimized)
      result.data = buffer;
      result.success = true;

      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Create picture element HTML
   * @param {Object} responsiveSet - Responsive set from generateResponsiveSet
   * @param {Object} options - HTML generation options
   * @returns {string} Picture element HTML
   */
  createPictureElement(responsiveSet, options = {}) {
    const {
      alt = 'Image',
      className = '',
      lazy = true
    } = options;

    if (!responsiveSet.success || Object.keys(responsiveSet.images).length === 0) {
      return `<img alt="${alt}" src="" class="${className}" />`;
    }

    let html = '<picture>\n';

    // Generate source elements for each format
    for (const [format, images] of Object.entries(responsiveSet.images)) {
      const mimeType = this.getMimeType(format);

      // Create srcset
      const srcset = images
        .map(img => `data:${mimeType};base64,${this.toBase64(img.data)} ${img.size}w`)
        .join(', ');

      html += `  <source type="${mimeType}" srcset="${srcset}" />\n`;
    }

    // Fallback img element
    const fallbackImage = responsiveSet.images[Object.keys(responsiveSet.images)[0]][0];
    const src = `data:${this.getMimeType(Object.keys(responsiveSet.images)[0])};base64,${this.toBase64(fallbackImage.data)}`;
    const loading = lazy ? ' loading="lazy"' : '';

    html += `  <img src="${src}" alt="${alt}" class="${className}"${loading} />\n`;
    html += '</picture>';

    return html;
  }

  /**
   * Generate static responsive image markup
   * @param {Array} images - Array of image objects with size and format
   * @param {Object} options - Markup options
   * @returns {string} Responsive img markup
   */
  generateResponsiveMarkup(images, options = {}) {
    const {
      alt = 'Image',
      className = '',
      sizes = null
    } = options;

    if (!Array.isArray(images) || images.length === 0) {
      return `<img alt="${alt}" src="" class="${className}" />`;
    }

    // Create srcset from images
    const srcset = images
      .map(img => `${img.src} ${img.size}w`)
      .join(', ');

    let markup = `<img\n  srcset="${srcset}"\n`;

    if (sizes) {
      markup += `  sizes="${sizes}"\n`;
    }

    markup += `  src="${images[images.length - 1].src}"\n`;
    markup += `  alt="${alt}"\n`;
    markup += `  class="${className}"\n`;
    markup += '  loading="lazy" />';

    return markup;
  }

  /**
   * Get cache key for thumbnail
   * @private
   */
  getCacheKey(imageData, options) {
    const dataHash = this.hashData(imageData);
    return `${dataHash}-${options.size}-${options.format}-${options.quality}-${options.aspectRatio}`;
  }

  /**
   * Simple hash function for cache key
   * @private
   */
  hashData(data) {
    const crypto = require('crypto');
    const buffer = this.toBuffer(data);

    if (!buffer) return 'invalid';

    return crypto.createHash('md5').update(buffer).digest('hex').slice(0, 16);
  }

  /**
   * Convert data to Buffer
   * @private
   */
  toBuffer(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (typeof data === 'string') {
      if (data.startsWith('data:image/')) {
        const match = data.match(/^data:image\/\w+;base64,(.+)$/);
        if (match) {
          return Buffer.from(match[1], 'base64');
        }
      }

      try {
        return Buffer.from(data, 'base64');
      } catch (e) {
        return Buffer.from(data, 'utf-8');
      }
    }

    return null;
  }

  /**
   * Convert Buffer to base64 string
   * @private
   */
  toBase64(data) {
    if (typeof data === 'string' && !data.startsWith('data:')) {
      return data;
    }

    const buffer = this.toBuffer(data);
    return buffer ? buffer.toString('base64') : '';
  }

  /**
   * Get MIME type for format
   * @private
   */
  getMimeType(format) {
    const types = {
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp'
    };

    return types[format] || 'image/jpeg';
  }

  /**
   * Clear cache
   * @param {number} maxAge - Maximum age in ms
   * @returns {number} Items cleared
   */
  clearCache(maxAge = null) {
    if (!maxAge) {
      const size = this.thumbnailCache.size;
      this.thumbnailCache.clear();
      return size;
    }

    // Note: Current implementation doesn't track creation time
    // This is a placeholder for future enhancement
    return 0;
  }

  /**
   * Get statistics
   * @returns {Object} Thumbnail generator stats
   */
  getStatistics() {
    return {
      ...this.generationStats,
      cacheSize: this.thumbnailCache.size,
      hitRate: this.generationStats.totalGenerated > 0
        ? (this.generationStats.totalCached /
           (this.generationStats.totalGenerated + this.generationStats.totalCached) * 100).toFixed(2)
        : 0
    };
  }
}

module.exports = { ThumbnailGenerator, THUMBNAIL_CONFIG };

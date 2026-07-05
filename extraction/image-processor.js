/**
 * Image Processor - Extract and analyze images from HTML
 * Responsibilities:
 * - Identify images (img, picture, figure elements)
 * - Extract image metadata (src, alt, title, dimensions)
 * - Process image URLs (resolve relative URLs)
 * - Analyze image attributes (responsive, loading, formats)
 *
 * @module extraction/image-processor
 */

/**
 * ImageProcessor class
 * Handles all image extraction and analysis operations
 *
 * @class ImageProcessor
 */
class ImageProcessor {
  constructor() {
    this.stats = {
      totalProcessed: 0,
      responsiveImages: 0,
      lazyLoadedImages: 0,
      pictureElements: 0
    };
  }

  /**
   * Extract all images from HTML
   * Processes <img>, <picture>, <figure> elements
   *
   * @param {string} html - HTML content
   * @param {Object} options - Extract options
   * @param {string} options.baseUrl - Base URL for resolving relative URLs
   * @param {boolean} options.includeMetadata - Include detailed metadata
   * @returns {Array<Object>} Array of image objects
   *
   * @example
   * const processor = new ImageProcessor();
   * const images = processor.processImages(html, { baseUrl: 'https://example.com' });
   * // Returns: [{ src, alt, title, width, height, responsive, loading, ... }, ...]
   */
  processImages(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return [];
    }

    const { baseUrl = '', includeMetadata = true } = options;
    const images = [];

    try {
      // Extract <img> elements using regex
      const imgRegex = /<img\s+([^>]*?)>/gi;
      let match;
      while ((match = imgRegex.exec(html)) !== null) {
        const attrs = this.parseAttributes(match[1]);
        const imageData = {
          src: attrs.src || '',
          alt: attrs.alt || '',
          title: attrs.title || '',
          width: attrs.width ? parseInt(attrs.width) : null,
          height: attrs.height ? parseInt(attrs.height) : null,
          responsive: !!attrs.srcset,
          loading: attrs.loading || 'eager',
          lazyLoaded: attrs.loading === 'lazy',
          srcset: attrs.srcset || null
        };
        if (imageData.src) {
          images.push(imageData);
          this.stats.totalProcessed++;
          if (imageData.responsive) this.stats.responsiveImages++;
          if (imageData.lazyLoaded) this.stats.lazyLoadedImages++;
        }
      }

      // Extract <picture> elements
      const pictureRegex = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
      while ((match = pictureRegex.exec(html)) !== null) {
        this.stats.pictureElements++;
        // Extract sources within picture
        const sourceRegex = /<source\s+([^>]*?)>/gi;
        let sourceMatch;
        while ((sourceMatch = sourceRegex.exec(match[1])) !== null) {
          const attrs = this.parseAttributes(sourceMatch[1]);
          if (attrs.srcset) {
            images.push({
              src: attrs.srcset.split(',')[0].trim().split(/\s+/)[0],
              type: attrs.type || '',
              srcset: attrs.srcset,
              responsive: true,
              loading: 'eager'
            });
          }
        }
      }

      this.stats.totalProcessed += images.length;
      return images;
    } catch (error) {
      console.error('[ImageProcessor] Error processing images:', error.message);
      return [];
    }
  }

  /**
   * Extract metadata from an image element
   *
   * @param {Element} imgElement - Image DOM element
   * @param {Object} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {boolean} includeMetadata - Include detailed metadata
   * @returns {Object} Image metadata object or null
   *
   * @private
   */
  extractImageMetadata(imgElement, $, baseUrl, includeMetadata) {
    const src = $(imgElement).attr('src');
    if (!src) {
      return null;
    }

    const metadata = {
      src: this.resolveUrl(src, baseUrl),
      alt: $(imgElement).attr('alt') || '',
      title: $(imgElement).attr('title') || '',
      width: $(imgElement).attr('width') || null,
      height: $(imgElement).attr('height') || null,
      loading: $(imgElement).attr('loading') || null,
      responsive: false,
      lazy: false
    };

    // Check if responsive image
    if ($(imgElement).attr('srcset')) {
      metadata.responsive = true;
      metadata.srcset = $(imgElement).attr('srcset');
      metadata.sizes = $(imgElement).attr('sizes') || null;
      this.stats.responsiveImages++;
    }

    // Check if lazy loaded
    if ($(imgElement).attr('loading') === 'lazy') {
      metadata.lazy = true;
      this.stats.lazyLoadedImages++;
    }

    // Add additional data attributes if present
    if (includeMetadata) {
      const dataAttrs = {};
      $(imgElement).each((i, el) => {
        Object.keys(el.attribs).forEach(attr => {
          if (attr.startsWith('data-')) {
            dataAttrs[attr] = el.attribs[attr];
          }
        });
      });
      if (Object.keys(dataAttrs).length > 0) {
        metadata.dataAttributes = dataAttrs;
      }

      // Check for inline styles
      const style = $(imgElement).attr('style');
      if (style) {
        metadata.style = style;
      }

      // Check for classes
      const classes = $(imgElement).attr('class');
      if (classes) {
        metadata.classes = classes.split(' ').filter(c => c.length > 0);
      }
    }

    return metadata;
  }

  /**
   * Extract picture element with multiple sources
   *
   * @param {Element} pictureElement - Picture DOM element
   * @param {Object} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {boolean} includeMetadata - Include detailed metadata
   * @returns {Array<Object>} Array of picture image objects
   *
   * @private
   */
  extractPictureElement(pictureElement, $, baseUrl, includeMetadata) {
    const $picture = $(pictureElement);
    const sources = [];

    // Extract source elements
    $picture.find('source').each((index, sourceElement) => {
      const sourceData = {
        type: $(sourceElement).attr('type') || null,
        srcset: $(sourceElement).attr('srcset') || null,
        sizes: $(sourceElement).attr('sizes') || null,
        media: $(sourceElement).attr('media') || null
      };

      if (sourceData.srcset) {
        sources.push(sourceData);
      }
    });

    // Extract fallback img element
    const $img = $picture.find('img').first();
    if ($img.length > 0) {
      const imgData = this.extractImageMetadata($img[0], $, baseUrl, includeMetadata);
      if (imgData) {
        imgData.picture = true;
        imgData.sources = sources;
        return [imgData];
      }
    }

    return [];
  }

  /**
   * Extract figure element with image
   *
   * @param {Element} imgElement - Image DOM element within figure
   * @param {Object} $ - Cheerio instance
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @param {boolean} includeMetadata - Include detailed metadata
   * @returns {Object} Figure image object with caption
   *
   * @private
   */
  extractFigureImage(imgElement, $, baseUrl, includeMetadata) {
    const $img = $(imgElement);
    const $figure = $img.closest('figure');

    const imageData = this.extractImageMetadata(imgElement, $, baseUrl, includeMetadata);
    if (imageData) {
      // Extract figcaption if present
      const figcaption = $figure.find('figcaption').text().trim();
      if (figcaption) {
        imageData.caption = figcaption;
      }

      imageData.inFigure = true;
    }

    return imageData;
  }

  /**
   * Check if image is responsive
   *
   * @param {Element} imgElement - Image DOM element
   * @returns {boolean} True if image has responsive attributes
   */
  isResponsiveImage(imgElement) {
    const srcset = imgElement.attribs?.srcset;
    const sizes = imgElement.attribs?.sizes;
    return !!(srcset || sizes);
  }

  /**
   * Get image loading strategy
   *
   * @param {Element} imgElement - Image DOM element
   * @returns {string} 'eager' | 'lazy' | 'auto'
   */
  getImageLoadingStrategy(imgElement) {
    const loading = imgElement.attribs?.loading;
    if (loading === 'lazy') {
      return 'lazy';
    } else if (loading === 'eager') {
      return 'eager';
    }
    return 'auto';
  }

  /**
   * Resolve relative URL to absolute
   *
   * @param {string} url - URL to resolve
   * @param {string} baseUrl - Base URL
   * @returns {string} Absolute URL
   *
   * @private
   */
  resolveUrl(url, baseUrl) {
    if (!url) {
      return url;
    }

    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
      return url;
    }

    // Data URL
    if (url.startsWith('data:')) {
      return url;
    }

    // Relative URL - resolve with base
    if (baseUrl) {
      try {
        const base = new URL(baseUrl);
        const resolved = new URL(url, base);
        return resolved.toString();
      } catch (error) {
        return url;
      }
    }

    return url;
  }

  /**
   * Get processor statistics
   *
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      responsiveImages: 0,
      lazyLoadedImages: 0,
      pictureElements: 0
    };
  }
}

module.exports = { ImageProcessor };

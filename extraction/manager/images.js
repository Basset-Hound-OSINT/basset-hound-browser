/**
 * Basset Hound Browser - Image Extractor
 * Extracts img tags, picture sources, and inline background images from HTML,
 * plus srcset parsing.
 * Pure functions delegated from ExtractionManager; receive the manager instance as `self`
 * for shared helpers (extractAttribute, hasAttribute, resolveUrl, parseSrcset).
 *
 * @module extraction/manager/images
 */

/**
 * Extract all images from HTML
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for relative image resolution
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Object} Extracted image data
 */
function extractImages(html, baseUrl = '', self) {
  const result = {
    success: true,
    data: [],
    count: 0,
    errors: [],
    warnings: []
  };

  self.stats.totalExtractions++;
  self.stats.imageExtractions++;

  if (!html || typeof html !== 'string') {
    result.success = false;
    result.errors.push('Invalid HTML input');
    return result;
  }

  try {
    // Find all img tags
    const imgRegex = /<img\s+[^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgTag = match[0];

      const image = {
        src: self.extractAttribute(imgTag, 'src'),
        alt: self.extractAttribute(imgTag, 'alt') || '',
        title: self.extractAttribute(imgTag, 'title'),
        width: self.extractAttribute(imgTag, 'width'),
        height: self.extractAttribute(imgTag, 'height'),
        loading: self.extractAttribute(imgTag, 'loading'),
        decoding: self.extractAttribute(imgTag, 'decoding'),
        crossorigin: self.extractAttribute(imgTag, 'crossorigin'),
        referrerpolicy: self.extractAttribute(imgTag, 'referrerpolicy'),
        ismap: self.hasAttribute(imgTag, 'ismap'),
        usemap: self.extractAttribute(imgTag, 'usemap')
      };

      // Handle srcset for responsive images
      const srcset = self.extractAttribute(imgTag, 'srcset');
      if (srcset) {
        image.srcset = self.parseSrcset(srcset, baseUrl);
      }

      // Handle sizes attribute
      image.sizes = self.extractAttribute(imgTag, 'sizes');

      // Handle data-src (lazy loading)
      const dataSrc = self.extractAttribute(imgTag, 'data-src');
      if (dataSrc) {
        image.dataSrc = dataSrc;
        image.isLazyLoad = true;
      }

      const dataLazy = self.extractAttribute(imgTag, 'data-lazy') ||
                      self.extractAttribute(imgTag, 'data-lazy-src');
      if (dataLazy) {
        image.dataLazy = dataLazy;
        image.isLazyLoad = true;
      }

      // Resolve URL
      if (image.src) {
        image.resolvedSrc = self.resolveUrl(image.src, baseUrl);
      }

      // Detect image type from URL
      if (image.src) {
        const ext = image.src.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
        if (ext) {
          image.fileType = ext[1].toLowerCase();
        }
      }

      // Check for missing alt text (accessibility warning)
      if (!image.alt && image.alt !== '') {
        result.warnings.push(`Image missing alt text: ${image.src || 'unknown'}`);
      }

      result.data.push(image);
      result.count++;
    }

    // Also extract picture element sources
    const pictureRegex = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;

    while ((match = pictureRegex.exec(html)) !== null) {
      const pictureContent = match[1];

      // Find source elements
      const sourceRegex = /<source\s+[^>]*>/gi;
      let sourceMatch;

      while ((sourceMatch = sourceRegex.exec(pictureContent)) !== null) {
        const sourceTag = sourceMatch[0];
        const source = {
          srcset: self.extractAttribute(sourceTag, 'srcset'),
          type: self.extractAttribute(sourceTag, 'type'),
          media: self.extractAttribute(sourceTag, 'media'),
          sizes: self.extractAttribute(sourceTag, 'sizes'),
          isPictureSource: true
        };

        if (source.srcset) {
          source.parsedSrcset = self.parseSrcset(source.srcset, baseUrl);
          result.data.push(source);
          result.count++;
        }
      }
    }

    // Extract background images from inline styles
    const bgImageRegex = /style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;

    while ((match = bgImageRegex.exec(html)) !== null) {
      const bgUrl = match[1];
      result.data.push({
        src: bgUrl,
        resolvedSrc: self.resolveUrl(bgUrl, baseUrl),
        isBackgroundImage: true
      });
      result.count++;
    }

    // Summary
    result.summary = {
      totalImages: result.count,
      withAlt: result.data.filter(i => i.alt && i.alt !== '').length,
      withoutAlt: result.data.filter(i => !i.alt || i.alt === '').length,
      lazyLoaded: result.data.filter(i => i.isLazyLoad).length,
      backgroundImages: result.data.filter(i => i.isBackgroundImage).length,
      pictureSourcesCount: result.data.filter(i => i.isPictureSource).length
    };

  } catch (error) {
    result.success = false;
    result.errors.push(`Extraction error: ${error.message}`);
  }

  return result;
}

/**
 * Parse srcset attribute into structured data
 * @param {string} srcset - srcset attribute value
 * @param {string} baseUrl - Base URL for resolution
 * @param {ExtractionManager} self - Manager instance providing shared helpers
 * @returns {Array} Parsed srcset entries
 */
function parseSrcset(srcset, baseUrl, self) {
  const entries = [];
  const parts = srcset.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\S+)\s*(.*)$/);

    if (match) {
      const entry = {
        url: match[1],
        resolvedUrl: self.resolveUrl(match[1], baseUrl),
        descriptor: match[2].trim() || null
      };

      // Parse descriptor (width or pixel density)
      if (entry.descriptor) {
        if (entry.descriptor.endsWith('w')) {
          entry.width = parseInt(entry.descriptor, 10);
        } else if (entry.descriptor.endsWith('x')) {
          entry.density = parseFloat(entry.descriptor);
        }
      }

      entries.push(entry);
    }
  }

  return entries;
}

module.exports = { extractImages, parseSrcset };

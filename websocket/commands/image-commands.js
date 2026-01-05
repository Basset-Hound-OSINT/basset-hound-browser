/**
 * Image Metadata WebSocket Commands
 *
 * Phase 14: Advanced Image Ingestion
 *
 * WebSocket API commands for image metadata extraction and analysis.
 * Provides access to EXIF, IPTC, XMP extraction, OCR, and more.
 *
 * @module websocket/commands/image-commands
 */

const {
  ImageMetadataExtractor,
  createImageExtractor
} = require('../../extraction');

// Singleton extractor instance for the session
let imageExtractor = null;

/**
 * Get or create the image extractor instance
 * @returns {ImageMetadataExtractor}
 */
function getExtractor() {
  if (!imageExtractor) {
    imageExtractor = createImageExtractor();
  }
  return imageExtractor;
}

/**
 * Register image metadata commands with the WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window
 */
function registerImageCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Extract metadata from an image
   *
   * @command extract_image_metadata
   * @param {string} params.imageUrl - URL or file path of the image
   * @param {Object} [params.options] - Extraction options
   * @param {boolean} [params.options.extractExif=true] - Extract EXIF data
   * @param {boolean} [params.options.extractIptc=true] - Extract IPTC data
   * @param {boolean} [params.options.extractXmp=true] - Extract XMP data
   * @param {boolean} [params.options.extractGps=true] - Extract GPS coordinates
   * @param {boolean} [params.options.extractThumbnail=false] - Extract embedded thumbnail
   * @param {boolean} [params.options.generateHash=true] - Generate perceptual hash
   * @returns {Object} Extraction result with metadata and analysis
   */
  commandHandlers.extract_image_metadata = async (params) => {
    const { imageUrl, options = {} } = params;

    if (!imageUrl) {
      return {
        success: false,
        error: 'imageUrl is required'
      };
    }

    try {
      const extractor = getExtractor();
      const result = await extractor.extract(imageUrl, options);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Extract GPS coordinates from an image
   *
   * @command extract_image_gps
   * @param {string} params.imageUrl - URL or file path of the image
   * @returns {Object} GPS coordinates if available
   */
  commandHandlers.extract_image_gps = async (params) => {
    const { imageUrl } = params;

    if (!imageUrl) {
      return {
        success: false,
        error: 'imageUrl is required'
      };
    }

    try {
      const extractor = getExtractor();
      const result = await extractor.extract(imageUrl, {
        extractExif: false,
        extractIptc: false,
        extractXmp: false,
        extractGps: true,
        generateHash: false
      });

      if (result.metadata.gps) {
        return {
          success: true,
          gps: result.metadata.gps,
          mapsUrl: result.metadata.gps.mapsUrl
        };
      } else {
        return {
          success: false,
          error: 'No GPS data found in image'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Extract text from an image using OCR
   *
   * @command extract_image_text
   * @param {string} params.imageUrl - URL or file path of the image
   * @param {string} [params.language='eng'] - OCR language code
   * @returns {Object} OCR result with extracted text
   */
  commandHandlers.extract_image_text = async (params) => {
    const { imageUrl, language = 'eng' } = params;

    if (!imageUrl) {
      return {
        success: false,
        error: 'imageUrl is required'
      };
    }

    try {
      const extractor = getExtractor();
      const result = await extractor.extract(imageUrl, {
        extractExif: false,
        extractIptc: false,
        extractXmp: false,
        extractGps: false,
        generateHash: false,
        runOcr: true,
        ocrLanguage: language
      });

      if (result.analysis.ocr) {
        return {
          success: true,
          text: result.analysis.ocr.text,
          confidence: result.analysis.ocr.confidence,
          language: result.analysis.ocr.language,
          words: result.analysis.ocr.words,
          lines: result.analysis.ocr.lines,
          osintData: result.osintData.filter(d => d.source === 'ocr')
        };
      } else {
        return {
          success: false,
          error: 'OCR extraction failed',
          warnings: result.warnings
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Generate perceptual hash for an image
   *
   * @command generate_image_hash
   * @param {string} params.imageUrl - URL or file path of the image
   * @returns {Object} Perceptual hash
   */
  commandHandlers.generate_image_hash = async (params) => {
    const { imageUrl } = params;

    if (!imageUrl) {
      return {
        success: false,
        error: 'imageUrl is required'
      };
    }

    try {
      const extractor = getExtractor();
      const result = await extractor.extract(imageUrl, {
        extractExif: false,
        extractIptc: false,
        extractXmp: false,
        extractGps: false,
        generateHash: true,
        calculateDimensions: true
      });

      if (result.analysis.perceptualHash) {
        return {
          success: true,
          hash: result.analysis.perceptualHash,
          dimensions: result.analysis.dimensions
        };
      } else {
        return {
          success: false,
          error: 'Hash generation failed',
          warnings: result.warnings
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Compare two images for similarity
   *
   * @command compare_images
   * @param {string} params.image1 - URL or file path of first image
   * @param {string} params.image2 - URL or file path of second image
   * @returns {Object} Similarity comparison result
   */
  commandHandlers.compare_images = async (params) => {
    const { image1, image2 } = params;

    if (!image1 || !image2) {
      return {
        success: false,
        error: 'Both image1 and image2 are required'
      };
    }

    try {
      const extractor = getExtractor();

      // Generate hashes for both images
      const [result1, result2] = await Promise.all([
        extractor.extract(image1, {
          extractExif: false,
          extractIptc: false,
          extractXmp: false,
          extractGps: false,
          generateHash: true
        }),
        extractor.extract(image2, {
          extractExif: false,
          extractIptc: false,
          extractXmp: false,
          extractGps: false,
          generateHash: true
        })
      ]);

      const hash1 = result1.analysis.perceptualHash;
      const hash2 = result2.analysis.perceptualHash;

      if (!hash1 || !hash2) {
        return {
          success: false,
          error: 'Could not generate hash for one or both images'
        };
      }

      // Calculate Hamming distance
      const hammingDistance = calculateHammingDistance(hash1.value, hash2.value);
      const similarity = 1 - (hammingDistance / (hash1.value.length * 4)); // Hex chars represent 4 bits each

      return {
        success: true,
        hash1: hash1.value,
        hash2: hash2.value,
        hammingDistance,
        similarity,
        similarityPercent: Math.round(similarity * 100),
        isSimilar: similarity > 0.9 // 90% threshold
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Extract all images from the current page with metadata
   *
   * @command extract_page_images
   * @param {Object} [params.options] - Extraction options
   * @param {boolean} [params.options.extractMetadata=true] - Extract metadata for each image
   * @param {boolean} [params.options.includeDataUrls=false] - Include data: URL images
   * @param {number} [params.options.limit=50] - Maximum number of images to process
   * @returns {Object} Array of images with their metadata
   */
  commandHandlers.extract_page_images = async (params, webContents) => {
    const options = params?.options || {};
    const extractMetadata = options.extractMetadata !== false;
    const includeDataUrls = options.includeDataUrls || false;
    const limit = options.limit || 50;

    try {
      // Extract image URLs from the page
      const imageUrls = await webContents.executeJavaScript(`
        (function() {
          const images = [];
          const seen = new Set();

          // Get all img elements
          document.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            if (src && !seen.has(src)) {
              seen.add(src);
              images.push({
                src: src,
                alt: img.alt || '',
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
                loading: img.loading,
                isLazy: !!img.getAttribute('data-src') || !!img.getAttribute('data-lazy-src')
              });
            }
          });

          // Get background images
          document.querySelectorAll('*').forEach(el => {
            const style = window.getComputedStyle(el);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
              const urlMatch = bgImage.match(/url\\(['"]?([^'"\\)]+)['"]?\\)/);
              if (urlMatch && urlMatch[1] && !seen.has(urlMatch[1])) {
                seen.add(urlMatch[1]);
                images.push({
                  src: urlMatch[1],
                  type: 'background',
                  element: el.tagName.toLowerCase()
                });
              }
            }
          });

          return images;
        })()
      `);

      // Filter and limit images
      let filteredImages = imageUrls;

      if (!includeDataUrls) {
        filteredImages = filteredImages.filter(img =>
          !img.src.startsWith('data:')
        );
      }

      filteredImages = filteredImages.slice(0, limit);

      // Optionally extract metadata for each image
      if (extractMetadata && filteredImages.length > 0) {
        const extractor = getExtractor();

        const results = await Promise.allSettled(
          filteredImages.map(async (img) => {
            try {
              const metadata = await extractor.extract(img.src, {
                extractExif: true,
                extractIptc: true,
                extractXmp: true,
                extractGps: true,
                generateHash: false,
                runOcr: false
              });

              return {
                ...img,
                metadata: metadata.metadata,
                osintData: metadata.osintData,
                warnings: metadata.warnings
              };
            } catch (error) {
              return {
                ...img,
                metadataError: error.message
              };
            }
          })
        );

        return {
          success: true,
          pageUrl: await webContents.executeJavaScript('window.location.href'),
          totalFound: imageUrls.length,
          totalProcessed: filteredImages.length,
          images: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message })
        };
      }

      return {
        success: true,
        pageUrl: await webContents.executeJavaScript('window.location.href'),
        totalFound: imageUrls.length,
        totalProcessed: filteredImages.length,
        images: filteredImages
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get OSINT data from an image for basset-hound integration
   *
   * @command get_image_osint_data
   * @param {string} params.imageUrl - URL or file path of the image
   * @param {string} [params.sourceUrl] - URL where the image was found
   * @returns {Object} OSINT data formatted for basset-hound orphan creation
   */
  commandHandlers.get_image_osint_data = async (params) => {
    const { imageUrl, sourceUrl } = params;

    if (!imageUrl) {
      return {
        success: false,
        error: 'imageUrl is required'
      };
    }

    try {
      const extractor = getExtractor();
      const result = await extractor.extract(imageUrl, {
        extractExif: true,
        extractIptc: true,
        extractXmp: true,
        extractGps: true,
        generateHash: true
      });

      const orphanData = extractor.generateOrphanData(result, sourceUrl || imageUrl);

      return {
        success: true,
        osintData: result.osintData,
        orphanData,
        metadata: result.metadata,
        hash: result.analysis.perceptualHash
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Configure the image extractor
   *
   * @command configure_image_extractor
   * @param {Object} params.options - Configuration options
   * @returns {Object} Updated configuration
   */
  commandHandlers.configure_image_extractor = async (params) => {
    const { options } = params;

    if (!options || typeof options !== 'object') {
      return {
        success: false,
        error: 'options object is required'
      };
    }

    // Create new extractor with updated options
    imageExtractor = createImageExtractor(options);

    return {
      success: true,
      message: 'Image extractor configuration updated',
      stats: imageExtractor.getStats()
    };
  };

  /**
   * Get image extractor statistics
   *
   * @command get_image_extractor_stats
   * @returns {Object} Extractor statistics
   */
  commandHandlers.get_image_extractor_stats = async () => {
    const extractor = getExtractor();
    return {
      success: true,
      stats: extractor.getStats()
    };
  };

  /**
   * Clean up image extractor resources
   *
   * @command cleanup_image_extractor
   * @returns {Object} Cleanup result
   */
  commandHandlers.cleanup_image_extractor = async () => {
    try {
      if (imageExtractor) {
        await imageExtractor.cleanup();
      }
      return {
        success: true,
        message: 'Image extractor resources cleaned up'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };
}

/**
 * Calculate Hamming distance between two hex strings
 * @private
 */
function calculateHammingDistance(hex1, hex2) {
  let distance = 0;
  const len = Math.min(hex1.length, hex2.length);

  for (let i = 0; i < len; i++) {
    const n1 = parseInt(hex1[i], 16);
    const n2 = parseInt(hex2[i], 16);
    // Count differing bits
    let xor = n1 ^ n2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

module.exports = {
  registerImageCommands
};

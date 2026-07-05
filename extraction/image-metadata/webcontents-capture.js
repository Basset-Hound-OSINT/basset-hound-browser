/**
 * Image Metadata Extractor — page-side image capture (prototype mixin)
 *
 * These methods are mixed onto ImageMetadataExtractor.prototype via
 * Object.assign. They each require an Electron webContents object (browser
 * context) and drive it via executeJavaScript; they do not use extractor
 * instance state beyond being methods.
 *
 * Extracted from extraction/image-metadata-extractor.js during modularization
 * (2026-07-04). Logic moved verbatim.
 *
 * @module extraction/image-metadata/webcontents-capture
 */

module.exports = {
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
  },

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
  },

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
};

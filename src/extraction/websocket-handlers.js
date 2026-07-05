/**
 * Basset Hound Browser - WebSocket Handlers for Cached Extraction (OPT-05)
 *
 * Integrates CachedExtractor with WebSocket command handlers.
 * Wraps extraction commands with automatic caching and cache invalidation.
 *
 * **Features:**
 * - Automatic cache management on navigation
 * - Per-command cache statistics
 * - Graceful fallback on cache errors
 * - Memory tracking and monitoring
 *
 * Version: 1.0.0
 * Created: June 21, 2026
 *
 * @module WebSocketHandlers
 */

const CachedExtractor = require('./cached-extractor');

class ExtractorWebSocketHandlers {
  constructor(options = {}) {
    this.cache = new CachedExtractor(options);

    // Bind handlers
    this.createGetTextHandler = this.createGetTextHandler.bind(this);
    this.createGetHTMLHandler = this.createGetHTMLHandler.bind(this);
    this.createGetLinksHandler = this.createGetLinksHandler.bind(this);
    this.createGetFormsHandler = this.createGetFormsHandler.bind(this);
    this.createGetImagesHandler = this.createGetImagesHandler.bind(this);
    this.createGetMetadataHandler = this.createGetMetadataHandler.bind(this);
    this.createNavigateHandler = this.createNavigateHandler.bind(this);
    this.getCacheStats = this.getCacheStats.bind(this);
    this.clearCache = this.clearCache.bind(this);
  }

  /**
   * Create a cached get-text handler
   *
   * @param {Function} originalHandler - Original get-text command handler
   * @returns {Function} Wrapped handler with caching
   *
   * @example
   * handlers['get-text'] = handlerFactory.createGetTextHandler(originalGetTextHandler);
   */
  createGetTextHandler(originalHandler) {
    return async (params, connection) => {
      const { url, selector = 'body', forceFresh = false } = params;

      try {
        // Extract with cache
        const text = await this.cache.getText(
          url || connection.currentUrl || 'unknown',
          selector,
          async () => {
            // On cache miss, call original handler
            const result = await originalHandler(params, connection);
            // Handler returns { success: true, text: "..." }
            if (result && result.text) {
              return result.text;
            }
            throw new Error('Original handler did not return text');
          },
          { forceFresh }
        );

        return {
          success: true,
          text,
          cached: true,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        // Fallback: call original handler on cache error
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a cached get-html handler
   *
   * @param {Function} originalHandler - Original get-html command handler
   * @returns {Function} Wrapped handler with caching
   */
  createGetHTMLHandler(originalHandler) {
    return async (params, connection) => {
      const { url, selector = 'body', forceFresh = false } = params;

      try {
        const html = await this.cache.getHTML(
          url || connection.currentUrl || 'unknown',
          selector,
          async () => {
            const result = await originalHandler(params, connection);
            if (result && result.html) {
              return result.html;
            }
            throw new Error('Original handler did not return html');
          },
          { forceFresh }
        );

        return {
          success: true,
          html,
          cached: true,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a cached get-links handler
   *
   * @param {Function} originalHandler - Original get-links command handler
   * @returns {Function} Wrapped handler with caching
   */
  createGetLinksHandler(originalHandler) {
    return async (params, connection) => {
      const { url, selector = 'body', forceFresh = false } = params;

      try {
        const links = await this.cache.getLinks(
          url || connection.currentUrl || 'unknown',
          selector,
          async () => {
            const result = await originalHandler(params, connection);
            if (result && Array.isArray(result.links)) {
              return result.links;
            }
            throw new Error('Original handler did not return links');
          },
          { forceFresh }
        );

        return {
          success: true,
          links,
          cached: true,
          count: links.length,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a cached get-forms handler
   *
   * @param {Function} originalHandler - Original get-forms command handler
   * @returns {Function} Wrapped handler with caching
   */
  createGetFormsHandler(originalHandler) {
    return async (params, connection) => {
      const { url, selector = 'body', forceFresh = false } = params;

      try {
        const forms = await this.cache.getForms(
          url || connection.currentUrl || 'unknown',
          selector,
          async () => {
            const result = await originalHandler(params, connection);
            if (result && Array.isArray(result.forms)) {
              return result.forms;
            }
            throw new Error('Original handler did not return forms');
          },
          { forceFresh }
        );

        return {
          success: true,
          forms,
          cached: true,
          count: forms.length,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a cached get-images handler
   *
   * @param {Function} originalHandler - Original get-images command handler
   * @returns {Function} Wrapped handler with caching
   */
  createGetImagesHandler(originalHandler) {
    return async (params, connection) => {
      const { url, selector = 'body', forceFresh = false } = params;

      try {
        const images = await this.cache.getImages(
          url || connection.currentUrl || 'unknown',
          selector,
          async () => {
            const result = await originalHandler(params, connection);
            if (result && Array.isArray(result.images)) {
              return result.images;
            }
            throw new Error('Original handler did not return images');
          },
          { forceFresh }
        );

        return {
          success: true,
          images,
          cached: true,
          count: images.length,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a cached get-metadata handler
   *
   * @param {Function} originalHandler - Original get-metadata command handler
   * @returns {Function} Wrapped handler with caching
   */
  createGetMetadataHandler(originalHandler) {
    return async (params, connection) => {
      const { url, forceFresh = false } = params;

      try {
        const metadata = await this.cache.getMetadata(
          url || connection.currentUrl || 'unknown',
          async () => {
            const result = await originalHandler(params, connection);
            if (result && result.metadata) {
              return result.metadata;
            }
            throw new Error('Original handler did not return metadata');
          },
          { forceFresh }
        );

        return {
          success: true,
          metadata,
          cached: true,
          cacheStats: this.cache.getStats()
        };
      } catch (error) {
        const result = await originalHandler(params, connection);
        return {
          ...result,
          cacheError: error.message
        };
      }
    };
  }

  /**
   * Create a navigate handler that invalidates extraction cache
   *
   * @param {Function} originalHandler - Original navigate command handler
   * @returns {Function} Wrapped handler with cache invalidation
   */
  createNavigateHandler(originalHandler) {
    return async (params, connection) => {
      // Call original navigate
      const result = await originalHandler(params, connection);

      // Invalidate cache after successful navigation
      if (result && result.success) {
        const newUrl = params.url || result.url;
        this.cache.invalidateOnNavigation(newUrl);

        // Store URL on connection for future use
        if (connection) {
          connection.currentUrl = newUrl;
        }
      }

      return result;
    };
  }

  /**
   * Get cache statistics
   *
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all caches
   *
   * @returns {Object} Confirmation object
   */
  clearCache() {
    this.cache.clearAll();
    return {
      success: true,
      message: 'Extraction cache cleared',
      stats: this.cache.getStats()
    };
  }

  /**
   * Register handlers with a handler map
   *
   * @param {Object} handlerMap - Map of command name to handler function
   * @param {Object} originalHandlers - Map of original handler functions
   * @returns {Object} Updated handler map with wrapped handlers
   */
  registerHandlers(handlerMap, originalHandlers) {
    // Wrap extraction handlers
    if (originalHandlers['get-text']) {
      handlerMap['get-text'] = this.createGetTextHandler(originalHandlers['get-text']);
    }
    if (originalHandlers['get-html']) {
      handlerMap['get-html'] = this.createGetHTMLHandler(originalHandlers['get-html']);
    }
    if (originalHandlers['get-links']) {
      handlerMap['get-links'] = this.createGetLinksHandler(originalHandlers['get-links']);
    }
    if (originalHandlers['get-forms']) {
      handlerMap['get-forms'] = this.createGetFormsHandler(originalHandlers['get-forms']);
    }
    if (originalHandlers['get-images']) {
      handlerMap['get-images'] = this.createGetImagesHandler(originalHandlers['get-images']);
    }
    if (originalHandlers['get-metadata']) {
      handlerMap['get-metadata'] = this.createGetMetadataHandler(originalHandlers['get-metadata']);
    }

    // Wrap navigate handler for cache invalidation
    if (originalHandlers['navigate']) {
      handlerMap['navigate'] = this.createNavigateHandler(originalHandlers['navigate']);
    }

    // Add cache control commands
    handlerMap['cache-stats'] = async () => this.getCacheStats();
    handlerMap['cache-clear'] = async () => this.clearCache();

    return handlerMap;
  }
}

module.exports = {
  ExtractorWebSocketHandlers,
  CachedExtractor
};

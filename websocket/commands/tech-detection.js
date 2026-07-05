/**
 * WebSocket Commands for Technology Detection
 *
 * Provides comprehensive technology fingerprinting commands for:
 * - Detecting frameworks, CMS, servers, CDN, analytics
 * - Analyzing HTML content directly
 * - Getting technology database information
 * - Managing detection cache
 *
 * @module websocket/commands/tech-detection
 */

const TechnologyFingerprinter = require('../../src/analysis/technology-fingerprint');

let fingerprinter = null;

/**
 * Register technology detection WebSocket commands
 * @param {object} server - WebSocket server instance
 * @param {object} mainWindow - Electron main window
 */
function registerTechDetectionCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;
  const logger = require('../../logging').createLogger('TechDetectionCommands');

  /**
   * Initialize fingerprinter if not already done
   * @private
   */
  function ensureFingerprinter() {
    if (!fingerprinter) {
      fingerprinter = new TechnologyFingerprinter({
        minConfidence: 0.50,
        maxDetections: 100,
        enableFaviconHashing: true,
        enableJSDetection: true,
        enableDOMAnalysis: true
      });
      logger.debug('fingerprinter_initialized');
    }
    return fingerprinter;
  }

  /**
   * Detect all technologies on the current page
   *
   * Command: detect_technologies
   * Params: {
   *   tabId?: string,
   *   includeEvidence?: boolean,
   *   confidenceThreshold?: number,
   *   categories?: string[]
   * }
   * Response: { success, technologies, summary, detectionTimeMs }
   */
  commandHandlers.detect_technologies = async (params) => {
    const startTime = Date.now();
    try {
      const fp = ensureFingerprinter();

      if (!params.tabId) {
        throw new Error('tabId is required');
      }

      // Get page data from the tab
      const tabs = mainWindow.webContents.getAllWebContents?.() || [];
      const tab = tabs.find(t => t.id?.toString() === params.tabId);

      if (!tab) {
        return {
          success: false,
          error: 'Tab not found',
          detectionTimeMs: Date.now() - startTime
        };
      }

      // Collect page data
      const pageData = await _collectPageData(tab);

      // Run detection
      const results = await fp.detect(pageData);

      // Apply filters if requested
      if (params.confidenceThreshold) {
        results.technologies = results.technologies.filter(
          t => t.confidence >= params.confidenceThreshold
        );
      }

      if (params.categories && params.categories.length > 0) {
        results.technologies = results.technologies.filter(
          t => params.categories.includes(t.category)
        );
      }

      // Remove evidence if not requested
      if (!params.includeEvidence) {
        for (const tech of results.technologies) {
          delete tech.evidence;
        }
      }

      results.detectionTimeMs = Date.now() - startTime;
      return { success: true, ...results };
    } catch (error) {
      logger.error('detect_technologies_failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        detectionTimeMs: Date.now() - startTime
      };
    }
  };

  /**
   * Detect technologies from provided HTML/headers
   *
   * Command: detect_technologies_from_html
   * Params: {
   *   html: string,
   *   headers?: object,
   *   url?: string,
   *   scripts?: string[],
   *   favicon?: Buffer,
   *   includeEvidence?: boolean
   * }
   * Response: { success, technologies, summary, detectionTimeMs }
   */
  commandHandlers.detect_technologies_from_html = async (params) => {
    const startTime = Date.now();
    try {
      if (!params.html) {
        throw new Error('html parameter is required');
      }

      const fp = ensureFingerprinter();

      // Prepare detection options
      const options = {
        html: params.html,
        headers: params.headers || {},
        url: params.url,
        scripts: params.scripts || [],
        favicon: params.favicon,
        metadata: {
          ssl: params.ssl
        }
      };

      // Run detection
      const results = await fp.detect(options);

      // Remove evidence if not requested
      if (!params.includeEvidence) {
        for (const tech of results.technologies) {
          delete tech.evidence;
        }
      }

      results.detectionTimeMs = Date.now() - startTime;
      return { success: true, ...results };
    } catch (error) {
      logger.error('detect_from_html_failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        detectionTimeMs: Date.now() - startTime
      };
    }
  };

  /**
   * Get available technologies in the detection database
   *
   * Command: get_tech_database
   * Params: {
   *   category?: string,
   *   limit?: number,
   *   includeMetadata?: boolean
   * }
   * Response: { success, technologies, count, categories }
   */
  commandHandlers.get_tech_database = async (params) => {
    try {
      const fp = ensureFingerprinter();
      const stats = fp.getStatistics();

      const technologies = [];
      let count = 0;

      // Build technology list
      for (const [id, signature] of fp.signatures.entries()) {
        if (params.category && signature.category !== params.category) {
          continue;
        }

        const tech = {
          id: signature.id,
          name: signature.name,
          category: signature.category
        };

        if (params.includeMetadata) {
          tech.metadata = {
            hasHeaders: Object.keys(signature.headers || {}).length > 0,
            hasHTML: Object.keys(signature.html || {}).length > 0,
            hasJS: Object.keys(signature.js || {}).length > 0,
            hasDOM: Object.keys(signature.dom || {}).length > 0,
            versions: signature.versions?.length || 0
          };
        }

        technologies.push(tech);
        count++;

        if (params.limit && count >= params.limit) {
          break;
        }
      }

      return {
        success: true,
        technologies: technologies,
        count: count,
        total: stats.totalSignatures,
        categories: stats.categories
      };
    } catch (error) {
      logger.error('get_tech_database_failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        technologies: []
      };
    }
  };

  /**
   * Get technology database statistics
   *
   * Command: get_tech_stats
   * Params: {}
   * Response: { success, statistics }
   */
  commandHandlers.get_tech_stats = async (params) => {
    try {
      const fp = ensureFingerprinter();
      const stats = fp.getStatistics();

      return {
        success: true,
        statistics: {
          totalSignatures: stats.totalSignatures,
          categoryCount: stats.categoryCount,
          categories: stats.categories,
          cacheSize: fp.getCacheSize(),
          cacheTimeoutMs: fp.config.cacheTimeout
        }
      };
    } catch (error) {
      logger.error('get_tech_stats_failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Clear technology detection cache
   *
   * Command: clear_tech_cache
   * Params: {}
   * Response: { success, message }
   */
  commandHandlers.clear_tech_cache = async (params) => {
    try {
      const fp = ensureFingerprinter();
      const oldSize = fp.getCacheSize();
      fp.clearCache();

      logger.info('tech_cache_cleared', { oldSize });

      return {
        success: true,
        message: `Cleared ${oldSize} cached detections`,
        cacheSize: fp.getCacheSize()
      };
    } catch (error) {
      logger.error('clear_tech_cache_failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get detailed information about a specific technology
   *
   * Command: get_technology_info
   * Params: {
   *   techId: string
   * }
   * Response: { success, technology }
   */
  commandHandlers.get_technology_info = async (params) => {
    try {
      if (!params.techId) {
        throw new Error('techId parameter is required');
      }

      const fp = ensureFingerprinter();
      const tech = fp.signatures.get(params.techId);

      if (!tech) {
        return {
          success: false,
          error: `Technology '${params.techId}' not found`
        };
      }

      return {
        success: true,
        technology: {
          id: tech.id,
          name: tech.name,
          category: tech.category,
          detectionMethods: {
            headers: Object.keys(tech.headers).length,
            html: Object.keys(tech.html).length,
            javascript: Object.keys(tech.js).length,
            dom: tech.dom?.markers?.length || 0,
            versions: tech.versions?.length || 0
          },
          hasVersionDetection: (tech.versions?.length || 0) > 0,
          hasFaviconSignature: Boolean(tech.favicon),
          cpe: tech.cpe
        }
      };
    } catch (error) {
      logger.error('get_technology_info_failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get all technologies in a specific category
   *
   * Command: get_technologies_by_category
   * Params: {
   *   category: string,
   *   limit?: number
   * }
   * Response: { success, technologies, count }
   */
  commandHandlers.get_technologies_by_category = async (params) => {
    try {
      if (!params.category) {
        throw new Error('category parameter is required');
      }

      const fp = ensureFingerprinter();
      const technologies = fp.signatures.getByCategory(params.category);

      let results = technologies.map(tech => ({
        id: tech.id,
        name: tech.name,
        category: tech.category
      }));

      if (params.limit) {
        results = results.slice(0, params.limit);
      }

      return {
        success: true,
        category: params.category,
        technologies: results,
        count: results.length
      };
    } catch (error) {
      logger.error('get_by_category_failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Analyze multiple URLs and return technology summary
   *
   * Command: batch_detect_technologies
   * Params: {
   *   urls: string[],
   *   timeout?: number,
   *   includeErrors?: boolean
   * }
   * Response: { success, results, summary }
   */
  commandHandlers.batch_detect_technologies = async (params) => {
    const startTime = Date.now();
    try {
      if (!params.urls || !Array.isArray(params.urls)) {
        throw new Error('urls array is required');
      }

      const fp = ensureFingerprinter();
      const results = [];
      const summary = {
        total: params.urls.length,
        successful: 0,
        failed: 0,
        technologies: {}
      };

      for (const url of params.urls) {
        try {
          // This would require actual page navigation
          // For now, return placeholder
          results.push({
            url: url,
            success: false,
            error: 'Batch detection requires active tab management'
          });
        } catch (error) {
          results.push({
            url: url,
            success: false,
            error: error.message
          });
          summary.failed++;
        }
      }

      return {
        success: true,
        results: results,
        summary: summary,
        batchTimeMs: Date.now() - startTime
      };
    } catch (error) {
      logger.error('batch_detect_failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        batchTimeMs: Date.now() - startTime
      };
    }
  };

  logger.info('tech_detection_commands_registered');
}

/**
 * Collect page data for technology detection
 * @private
 */
async function _collectPageData(tab) {
  const pageData = {
    html: '',
    headers: {},
    url: '',
    scripts: [],
    favicon: null,
    metadata: {}
  };

  try {
    // Get HTML content
    pageData.html = await tab.executeJavaScript(`
      document.documentElement.outerHTML
    `).catch(() => '');

    // Get current URL
    pageData.url = tab.getURL?.() || '';

    // Get script URLs
    pageData.scripts = await tab.executeJavaScript(`
      Array.from(document.scripts).map(s => s.src).filter(Boolean)
    `).catch(() => []);

    // Get HTTP headers from navigation timing API
    // Note: This is limited due to browser security restrictions
    pageData.headers = {};

  } catch (error) {
    console.error('Error collecting page data:', error);
  }

  return pageData;
}

/**
 * Export command registration function
 */
module.exports = { registerTechDetectionCommands };

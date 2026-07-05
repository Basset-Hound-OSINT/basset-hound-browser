/**
 * WebSocket Handler for Technology Detection Commands
 *
 * Commands handled:
 * - detect_technologies - Detect technologies on current or specified page
 * - detect_technologies_from_html - Detect technologies from HTML content
 */

const AnalysisManager = require('../../src/analysis');
const { createLogger } = require('../../logging');

class TechnologyDetectorHandler {
  constructor(options = {}) {
    this.analysisManager = new AnalysisManager(options);
    this.logger = createLogger('TechnologyDetectorHandler');
  }

  /**
   * Handle detect_technologies command
   *
   * Input format:
   * {
   *   "action": "detect_technologies",
   *   "url": "https://example.com",  // Optional: for reference only
   *   "passive_only": false,          // Optional: skip active detection
   *   "active_only": false            // Optional: skip passive detection
   * }
   *
   * Response format:
   * {
   *   "success": true,
   *   "result": {
   *     "technologies": [
   *       {
   *         "name": "Nginx",
   *         "category": "Web Server",
   *         "confidence": 0.95,
   *         "detectionMethod": "passive",
   *         "method": "header:server",
   *         "version": "1.21.0"
   *       }
   *     ],
   *     "totalDetected": 5,
   *     "scanTimeMs": 1240,
   *     "timestamp": "2026-05-31T10:30:00Z"
   *   }
   * }
   */
  async handleDetectTechnologies(params, context = {}) {
    const startTime = Date.now();

    try {
      // Validate input
      if (!params) {
        return {
          success: false,
          error: 'Parameters required'
        };
      }

      // Get HTML from context if not provided
      const html = params.html || context.pageContent || '';
      const headers = params.headers || context.pageHeaders || {};

      // If we have a Puppeteer/Playwright page object, use it for active detection
      const page = context.page || null;

      const detectionOptions = {
        html,
        headers,
        page,
        passiveOnly: params.passive_only === true,
        activeOnly: params.active_only === true
      };

      // Perform detection
      const result = await this.analysisManager.detectTechnologies(detectionOptions);

      this.logger.info('detect_technologies_success', {
        url: params.url,
        detectedCount: result.technologies.length,
        duration: Date.now() - startTime
      });

      return {
        success: result.success,
        result: {
          technologies: result.technologies,
          totalDetected: result.totalDetected,
          scanTimeMs: result.scanTimeMs,
          timestamp: result.timestamp
        }
      };

    } catch (error) {
      this.logger.error('detect_technologies_failed', {
        error: error.message,
        url: params.url,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle detect_technologies_from_html command
   *
   * Input format:
   * {
   *   "action": "detect_technologies_from_html",
   *   "html": "<html>...</html>",
   *   "headers": {
   *     "server": "nginx",
   *     "content-type": "text/html"
   *   },
   *   "url": "https://example.com"  // Optional: for reference
   * }
   */
  async handleDetectTechnologiesFromHtml(params, context = {}) {
    const startTime = Date.now();

    try {
      // Validate input
      if (!params || !params.html) {
        return {
          success: false,
          error: 'html parameter required'
        };
      }

      const detectionOptions = {
        html: params.html,
        headers: params.headers || {},
        passiveOnly: true // Only passive detection for HTML-based detection
      };

      const result = await this.analysisManager.detectTechnologies(detectionOptions);

      this.logger.info('detect_technologies_from_html_success', {
        htmlSize: params.html.length,
        detectedCount: result.technologies.length,
        duration: Date.now() - startTime
      });

      return {
        success: result.success,
        result: {
          technologies: result.technologies,
          totalDetected: result.totalDetected,
          scanTimeMs: result.scanTimeMs,
          timestamp: result.timestamp
        }
      };

    } catch (error) {
      this.logger.error('detect_technologies_from_html_failed', {
        error: error.message,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Register all handlers with WebSocket server
   * @param {object} server - WebSocket server instance
   */
  registerHandlers(server) {
    if (!server || typeof server.on !== 'function') {
      this.logger.error('invalid_server', {
        hint: 'Server does not have on() method'
      });
      return;
    }

    server.on('detect_technologies', async (params, callback, context) => {
      const result = await this.handleDetectTechnologies(params, context);
      callback(result);
    });

    server.on('detect_technologies_from_html', async (params, callback, context) => {
      const result = await this.handleDetectTechnologiesFromHtml(params, context);
      callback(result);
    });

    this.logger.info('handlers_registered', {
      commands: ['detect_technologies', 'detect_technologies_from_html']
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.analysisManager.cleanup();
    this.logger.info('handler_cleanup_complete');
  }
}

module.exports = TechnologyDetectorHandler;

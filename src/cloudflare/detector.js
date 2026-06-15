/**
 * Cloudflare Challenge Detection & Handling
 *
 * Phase 2 P2-004: Detect and handle Cloudflare protection challenges
 *
 * Detects when Cloudflare challenge pages are returned instead of actual content,
 * waits for JavaScript challenge completion, and retries extraction.
 *
 * @module src/cloudflare/detector
 */

/**
 * Cloudflare Detection Results
 */
const CF_DETECTION_RESULTS = {
  NOT_CLOUDFLARE: 0,        // No Cloudflare challenge detected
  CHALLENGE_DETECTED: 1,    // Cloudflare challenge page detected
  CHALLENGE_IN_PROGRESS: 2, // Challenge JavaScript still executing
  CHALLENGE_COMPLETE: 3     // Challenge appears to be completed
};

/**
 * Cloudflare challenge page markers
 */
const CLOUDFLARE_MARKERS = {
  // Text markers
  TEXT_MARKERS: [
    'just a moment',
    'checking your browser',
    'enable javascript and cookies',
    'challenge page',
    'ray id',
    'cloudflare',
    'security check',
    'one moment please'
  ],

  // HTML/Script markers
  HTML_MARKERS: [
    '__cf_chl',          // Cloudflare challenge variable
    'challenge.bin',     // Challenge binary
    'jsfiddle_loader',   // Cloudflare's JS loader
    'window.onload',     // Common in CF pages
    'CFRAYS',           // Cloudflare ray ID
    'cf_clearance',     // Cloudflare clearance cookie
    'cf_bm',            // Cloudflare bot management
    '__cfruid',         // Cloudflare UID
    'challenge',        // Generic challenge indicator
  ],

  // HTTP Status/Header markers
  STATUS_CODES: [403, 429],
  HEADERS: ['cf-ray', 'cf-cache-status', 'server', 'cf-request-id']
};

/**
 * CloudflareDetector class
 * Detects and handles Cloudflare protection mechanisms
 */
class CloudflareDetector {
  constructor(logger = null) {
    this.logger = logger || console;
    this.detectionStats = {
      totalChecks: 0,
      challengesDetected: 0,
      challengesResolved: 0,
      failedRetries: 0
    };
  }

  /**
   * Detect if a page is a Cloudflare challenge
   * @param {string} html - Page HTML content
   * @param {number} statusCode - HTTP status code
   * @param {object} headers - Response headers
   * @returns {number} Detection result from CF_DETECTION_RESULTS
   */
  detectChallenge(html = '', statusCode = 200, headers = {}) {
    this.detectionStats.totalChecks++;

    // Check status code
    if (CLOUDFLARE_MARKERS.STATUS_CODES.includes(statusCode)) {
      const headerMatch = Object.keys(headers).some(key =>
        CLOUDFLARE_MARKERS.HEADERS.includes(key.toLowerCase())
      );
      if (headerMatch) {
        this.logger.debug('[CF-004] Cloudflare detected via HTTP status + headers');
        this.detectionStats.challengesDetected++;
        return CF_DETECTION_RESULTS.CHALLENGE_DETECTED;
      }
    }

    // HTML is empty or very small (suspicious)
    if (!html || html.length < 100) {
      this.logger.debug('[CF-004] Suspicious: HTML is empty or very small');
      return CF_DETECTION_RESULTS.CHALLENGE_DETECTED;
    }

    // Check for text markers (case-insensitive)
    const htmlLower = html.toLowerCase();
    for (const marker of CLOUDFLARE_MARKERS.TEXT_MARKERS) {
      if (htmlLower.includes(marker)) {
        this.logger.debug(`[CF-004] Cloudflare text marker detected: "${marker}"`);
        this.detectionStats.challengesDetected++;
        return CF_DETECTION_RESULTS.CHALLENGE_DETECTED;
      }
    }

    // Check for HTML/Script markers
    for (const marker of CLOUDFLARE_MARKERS.HTML_MARKERS) {
      if (html.includes(marker)) {
        this.logger.debug(`[CF-004] Cloudflare HTML marker detected: "${marker}"`);
        this.detectionStats.challengesDetected++;
        return CF_DETECTION_RESULTS.CHALLENGE_DETECTED;
      }
    }

    return CF_DETECTION_RESULTS.NOT_CLOUDFLARE;
  }

  /**
   * Check if a page appears to be a Cloudflare challenge
   * @param {object} page - Playwright page object
   * @returns {Promise<number>} Detection result
   */
  async detectChallengeFromPage(page) {
    try {
      // Get page content
      const html = await page.content();
      const statusCode = await page.evaluate(() => window.performance?.navigation?.type);

      // Try to get response status from navigation
      let responseStatus = 200;
      try {
        responseStatus = await page.evaluate(() => {
          // Check if we can access the response status via fetch
          return (window.__responseStatus || 200);
        });
      } catch (e) {
        // Ignore if we can't get status
      }

      // Get headers from document
      const headers = {};
      try {
        const headerText = await page.evaluate(() => {
          // Try to get any headers info stored by the browser
          return document.documentElement.outerHTML.substring(0, 500);
        });
        // This is a fallback approach
      } catch (e) {
        // Ignore
      }

      return this.detectChallenge(html, responseStatus, headers);
    } catch (error) {
      this.logger.error(`[CF-004] Error detecting challenge from page: ${error.message}`);
      return CF_DETECTION_RESULTS.NOT_CLOUDFLARE;
    }
  }

  /**
   * Wait for Cloudflare JavaScript to complete
   * @param {object} page - Playwright page object
   * @param {number} maxWaitTime - Maximum time to wait in ms (default 10000)
   * @returns {Promise<boolean>} True if challenge appears to be complete
   */
  async waitForChallengeCompletion(page, maxWaitTime = 10000) {
    this.logger.info('[CF-004] Waiting for Cloudflare challenge to complete...');

    const startTime = Date.now();
    const checkInterval = 500; // Check every 500ms
    let lastHtml = '';

    try {
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const currentHtml = await page.content();

          // Check if challenge markers are gone
          let hasChallengeMarkers = false;
          const htmlLower = currentHtml.toLowerCase();

          for (const marker of CLOUDFLARE_MARKERS.TEXT_MARKERS) {
            if (htmlLower.includes(marker)) {
              hasChallengeMarkers = true;
              break;
            }
          }

          // If no challenge markers and HTML has changed, challenge is likely complete
          if (!hasChallengeMarkers && currentHtml !== lastHtml && currentHtml.length > 500) {
            this.logger.info('[CF-004] Cloudflare challenge appears to be complete');
            this.detectionStats.challengesResolved++;
            return true;
          }

          lastHtml = currentHtml;

          // Wait before next check
          await new Promise(resolve => setTimeout(resolve, checkInterval));

        } catch (checkError) {
          this.logger.debug(`[CF-004] Check error (will retry): ${checkError.message}`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
      }

      // Timeout reached
      this.logger.warn(`[CF-004] Challenge resolution timeout after ${maxWaitTime}ms`);
      this.detectionStats.failedRetries++;
      return false;

    } catch (error) {
      this.logger.error(`[CF-004] Error waiting for challenge: ${error.message}`);
      this.detectionStats.failedRetries++;
      return false;
    }
  }

  /**
   * Apply evasion to bypass Cloudflare
   * @param {object} page - Playwright page object
   * @param {object} options - Evasion options
   * @returns {Promise<boolean>} True if evasion applied successfully
   */
  async applyCloudflareEvasion(page, options = {}) {
    this.logger.info('[CF-004] Applying Cloudflare evasion techniques...');

    try {
      // Inject anti-detection scripts before navigation
      await page.addInitScript(() => {
        // Override navigator properties to look more legitimate
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin' },
            { name: 'Chrome PDF Viewer' },
            { name: 'Native Client Executable' }
          ],
        });

        // Override headless detection
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Simulate real window properties
        window.outerWidth = window.innerWidth = 1920;
        window.outerHeight = window.innerHeight = 1080;

        // Add real-looking user agent
        // (This would be set via CDP if using Playwright directly)
      });

      return true;
    } catch (error) {
      this.logger.error(`[CF-004] Error applying evasion: ${error.message}`);
      return false;
    }
  }

  /**
   * Get detection statistics
   * @returns {object} Statistics object
   */
  getStats() {
    return {
      ...this.detectionStats,
      resolutionRate: this.detectionStats.challengesDetected > 0
        ? (this.detectionStats.challengesResolved / this.detectionStats.challengesDetected * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.detectionStats = {
      totalChecks: 0,
      challengesDetected: 0,
      challengesResolved: 0,
      failedRetries: 0
    };
  }
}

module.exports = {
  CloudflareDetector,
  CF_DETECTION_RESULTS,
  CLOUDFLARE_MARKERS
};

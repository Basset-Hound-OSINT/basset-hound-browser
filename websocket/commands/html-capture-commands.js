/**
 * HTML Capture Commands Module
 * Registers 4 new WebSocket commands for advanced HTML capture:
 * 1. export_html_with_metadata - HTML + all meta tags, timing, resources
 * 2. export_html_formatted - Pretty-printed HTML with comments
 * 3. export_html_raw - Exact raw response bytes
 * 4. export_html_diff - HTML snapshot with change tracking
 */

const { HtmlCaptureManager } = require('../../extraction/html-capture-manager');

// Create singleton instance
let captureManager = null;

function getCaptureManager() {
  if (!captureManager) {
    captureManager = new HtmlCaptureManager();
  }
  return captureManager;
}

/**
 * Register all HTML capture commands
 * @param {WebSocketServer} server - WebSocket server instance
 */
function registerHtmlCaptureCommands(server) {
  const manager = getCaptureManager();

  /**
   * Command 1: export_html_with_metadata
   * Captures HTML with full metadata, timing, and resource information
   *
   * Parameters:
   * - html (string, required): HTML content to capture
   * - url (string, optional): Page URL for context
   * - headers (object, optional): HTTP response headers
   * - compress (boolean, optional): Compress HTML with gzip
   * - includeFormatted (boolean, optional): Include formatted version
   *
   * Returns:
   * - success (boolean): Operation success
   * - snapshotId (string): Unique snapshot ID
   * - html (string): Original HTML
   * - metadata (object): Extracted metadata
   * - formatted (string|null): Formatted HTML if requested
   * - size (object): Size information
   * - processingTime (number): Execution time in ms
   */
  server.commandHandlers.export_html_with_metadata = async (params) => {
    try {
      const { html, url, headers, compress, includeFormatted } = params;

      if (!html || typeof html !== 'string') {
        return {
          success: false,
          error: 'HTML parameter is required and must be a string',
          errorCode: 'INVALID_HTML_PARAM'
        };
      }

      const result = await manager.captureWithMetadata(html, {
        url: url || '',
        headers: headers || {},
        compress: compress || false,
        includeFormatted: includeFormatted || false
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'EXPORT_METADATA_ERROR'
      };
    }
  };

  /**
   * Command 2: export_html_formatted
   * Returns pretty-printed HTML with proper indentation and formatting
   *
   * Parameters:
   * - html (string, required): HTML content to format
   * - url (string, optional): Page URL for tracking
   * - indentSize (number, optional): Spaces per indent level (default: 2)
   * - includeComments (boolean, optional): Include HTML comments
   *
   * Returns:
   * - success (boolean): Operation success
   * - snapshotId (string): Unique snapshot ID
   * - url (string): Page URL
   * - html (string): Formatted HTML
   * - metadata (object): Formatting metadata
   * - processingTime (number): Execution time in ms
   */
  server.commandHandlers.export_html_formatted = async (params) => {
    try {
      const { html, url, indentSize, includeComments } = params;

      if (!html || typeof html !== 'string') {
        return {
          success: false,
          error: 'HTML parameter is required and must be a string',
          errorCode: 'INVALID_HTML_PARAM'
        };
      }

      const result = manager.captureFormatted(html, {
        url: url || '',
        indentSize: indentSize || 2,
        includeComments: includeComments !== false
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'EXPORT_FORMATTED_ERROR'
      };
    }
  };

  /**
   * Command 3: export_html_raw
   * Captures exact raw HTML with cryptographic hashes and response metadata
   *
   * Parameters:
   * - html (string, required): HTML content
   * - url (string, optional): Page URL
   * - statusCode (number, optional): HTTP status code
   * - statusText (string, optional): HTTP status text
   * - headers (object, optional): HTTP response headers
   * - fetchStart (number, optional): Fetch start timestamp
   * - fetchEnd (number, optional): Fetch end timestamp
   * - duration (number, optional): Total fetch duration in ms
   *
   * Returns:
   * - success (boolean): Operation success
   * - snapshotId (string): Unique snapshot ID
   * - url (string): Page URL
   * - html (string): Exact raw HTML
   * - bytes (object): SHA256, MD5 hashes and size
   * - response (object): HTTP response details
   * - processingTime (number): Execution time in ms
   */
  server.commandHandlers.export_html_raw = async (params) => {
    try {
      const {
        html,
        url,
        statusCode,
        statusText,
        headers,
        fetchStart,
        fetchEnd,
        duration
      } = params;

      if (!html || typeof html !== 'string') {
        return {
          success: false,
          error: 'HTML parameter is required and must be a string',
          errorCode: 'INVALID_HTML_PARAM'
        };
      }

      const result = await manager.captureRaw(html, {
        url: url || '',
        statusCode: statusCode || 200,
        statusText: statusText || 'OK',
        headers: headers || {},
        fetchStart: fetchStart,
        fetchEnd: fetchEnd,
        duration: duration
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'EXPORT_RAW_ERROR'
      };
    }
  };

  /**
   * Command 4: export_html_diff
   * Captures HTML with change tracking against previous snapshots
   *
   * Parameters:
   * - html (string, required): Current HTML content
   * - url (string, required): Page URL (used as key for history)
   * - previousSnapshotId (string, optional): ID of previous snapshot to compare against
   * - includeFullHtml (boolean, optional): Include full HTML in response
   *
   * Returns:
   * - success (boolean): Operation success
   * - snapshotId (string): Current snapshot ID
   * - url (string): Page URL
   * - timestamp (string): ISO timestamp
   * - current (object): Current snapshot info (size, hash)
   * - previous (object|null): Previous snapshot info if available
   * - changes (object): Change detection results
   * - history (array): Last 10 snapshots
   * - html (string|null): Full HTML if requested
   * - processingTime (number): Execution time in ms
   */
  server.commandHandlers.export_html_diff = async (params) => {
    try {
      const { html, url, previousSnapshotId, includeFullHtml } = params;

      if (!html || typeof html !== 'string') {
        return {
          success: false,
          error: 'HTML parameter is required and must be a string',
          errorCode: 'INVALID_HTML_PARAM'
        };
      }

      if (!url || typeof url !== 'string') {
        return {
          success: false,
          error: 'URL parameter is required for diff tracking',
          errorCode: 'INVALID_URL_PARAM'
        };
      }

      const result = manager.captureDiff(html, {
        url,
        previousSnapshotId: previousSnapshotId || null,
        includeFullHtml: includeFullHtml || false
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'EXPORT_DIFF_ERROR'
      };
    }
  };

  /**
   * Utility Command: get_capture_stats
   * Get capture statistics
   */
  server.commandHandlers.get_capture_stats = async (params) => {
    try {
      const stats = manager.getStats();
      return {
        success: true,
        stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'GET_STATS_ERROR'
      };
    }
  };

  /**
   * Utility Command: clear_capture_snapshots
   * Clear stored snapshots (for memory management)
   *
   * Parameters:
   * - url (string, optional): URL to clear snapshots for. If omitted, clears all.
   */
  server.commandHandlers.clear_capture_snapshots = async (params) => {
    try {
      const { url } = params;

      if (url) {
        manager.clearSnapshots(url);
        return {
          success: true,
          message: `Snapshots cleared for URL: ${url}`
        };
      } else {
        manager.clearSnapshots();
        return {
          success: true,
          message: 'All snapshots cleared'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorCode: 'CLEAR_SNAPSHOTS_ERROR'
      };
    }
  };
}

module.exports = {
  registerHtmlCaptureCommands,
  getCaptureManager
};

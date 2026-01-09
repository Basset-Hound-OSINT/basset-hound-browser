/**
 * Advanced Screenshot WebSocket Commands
 *
 * Phase 21: Advanced Screenshot Capabilities
 *
 * WebSocket API commands for advanced screenshot features including:
 * - Screenshot comparison and visual diffs
 * - Screenshot stitching
 * - Annotation overlay
 * - OCR text extraction
 * - Element highlighting
 * - Automatic PII blurring
 * - Quality presets for forensic documentation
 *
 * @module websocket/commands/screenshot-commands
 */

const { ScreenshotManager } = require('../../screenshots/manager');

// Singleton screenshot manager instance for the session
let screenshotManager = null;

/**
 * Get or create the screenshot manager instance
 * @param {Electron.BrowserWindow} mainWindow - Main window
 * @returns {ScreenshotManager}
 */
function getManager(mainWindow) {
  if (!screenshotManager) {
    screenshotManager = new ScreenshotManager(mainWindow);
  }
  return screenshotManager;
}

/**
 * Register screenshot commands with the WebSocket server
 *
 * @param {Object} server - WebSocket server instance
 * @param {Object} mainWindow - Main Electron window
 */
function registerScreenshotCommands(server, mainWindow) {
  const commandHandlers = server.commandHandlers || server;

  /**
   * Capture screenshot with annotations
   *
   * @command capture_screenshot_with_annotations
   * @param {Object} params.options - Screenshot options
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality] - Quality setting
   * @param {boolean} [params.options.fullPage=false] - Capture full page
   * @param {Array} params.annotations - Array of annotation objects
   * @returns {Object} Screenshot with annotations applied
   */
  commandHandlers.capture_screenshot_with_annotations = async (params) => {
    const { options = {}, annotations = [] } = params;

    if (!Array.isArray(annotations) || annotations.length === 0) {
      return {
        success: false,
        error: 'annotations array with at least one annotation is required'
      };
    }

    try {
      const manager = getManager(mainWindow);

      // First capture the screenshot
      let screenshotResult;
      if (options.fullPage) {
        screenshotResult = await manager.captureFullPage(options);
      } else if (options.selector) {
        screenshotResult = await manager.captureElement(options.selector, options);
      } else {
        screenshotResult = await manager.captureViewport(options);
      }

      if (!screenshotResult.success) {
        return screenshotResult;
      }

      // Apply annotations
      const annotatedResult = await manager.annotateScreenshot(
        screenshotResult.data,
        annotations
      );

      return annotatedResult;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Capture screenshot with element highlights
   *
   * @command capture_screenshot_with_highlights
   * @param {Array<string>} params.selectors - CSS selectors to highlight
   * @param {Object} [params.options] - Screenshot and highlight options
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality] - Quality setting
   * @param {boolean} [params.options.fullPage=false] - Capture full page
   * @param {string} [params.options.highlightColor='#FFFF00'] - Highlight color
   * @param {number} [params.options.highlightOpacity=0.3] - Highlight opacity
   * @returns {Object} Screenshot with highlighted elements
   */
  commandHandlers.capture_screenshot_with_highlights = async (params) => {
    const { selectors, options = {} } = params;

    if (!selectors || !Array.isArray(selectors) || selectors.length === 0) {
      return {
        success: false,
        error: 'selectors array with at least one selector is required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.captureWithHighlights(selectors, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Capture screenshot with automatic PII blurring
   *
   * @command capture_screenshot_with_blur
   * @param {Object} [params.options] - Screenshot and blur options
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality] - Quality setting
   * @param {boolean} [params.options.fullPage=false] - Capture full page
   * @param {Array<string>} [params.options.blurPatterns] - PII patterns to detect
   * @param {Array<string>} [params.options.customSelectors] - Additional elements to blur
   * @param {number} [params.options.blurIntensity=10] - Blur intensity (1-20)
   * @param {boolean} [params.options.detectText=true] - Use OCR for PII detection
   * @returns {Object} Screenshot with sensitive data blurred
   */
  commandHandlers.capture_screenshot_with_blur = async (params) => {
    const { options = {} } = params;

    try {
      const manager = getManager(mainWindow);
      const result = await manager.captureWithBlur(options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Compare two screenshots (visual diff)
   *
   * @command capture_screenshot_diff
   * @param {string} params.imageData1 - First screenshot base64 data
   * @param {string} params.imageData2 - Second screenshot base64 data
   * @param {Object} [params.options] - Comparison options
   * @param {number} [params.options.threshold=0.1] - Sensitivity threshold (0-1)
   * @param {string} [params.options.highlightColor='#FF0000'] - Diff highlight color
   * @param {string} [params.options.outputFormat='png'] - Output format
   * @returns {Object} Comparison result with diff image and metrics
   */
  commandHandlers.capture_screenshot_diff = async (params) => {
    const { imageData1, imageData2, options = {} } = params;

    if (!imageData1 || !imageData2) {
      return {
        success: false,
        error: 'Both imageData1 and imageData2 are required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.compareScreenshots(imageData1, imageData2, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Stitch multiple screenshots into one image
   *
   * @command stitch_screenshots
   * @param {Array<string>} params.imageDatas - Array of screenshot base64 data
   * @param {Object} [params.options] - Stitching options
   * @param {string} [params.options.direction='vertical'] - Stitch direction ('vertical' or 'horizontal')
   * @param {number} [params.options.gap=0] - Gap between images in pixels
   * @param {string} [params.options.backgroundColor='#FFFFFF'] - Background color
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality=1.0] - Output quality
   * @returns {Object} Stitched screenshot result
   */
  commandHandlers.stitch_screenshots = async (params) => {
    const { imageDatas, options = {} } = params;

    if (!imageDatas || !Array.isArray(imageDatas) || imageDatas.length === 0) {
      return {
        success: false,
        error: 'imageDatas array with at least one image is required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.stitchScreenshots(imageDatas, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Extract text from screenshot using OCR
   *
   * @command extract_text_from_screenshot
   * @param {string} params.imageData - Screenshot base64 data
   * @param {Object} [params.options] - OCR options
   * @param {string} [params.options.language='eng'] - OCR language code
   * @param {boolean} [params.options.overlay=false] - Return image with text overlays
   * @param {string} [params.options.highlightMatches] - Text pattern to highlight
   * @returns {Object} OCR result with extracted text and coordinates
   */
  commandHandlers.extract_text_from_screenshot = async (params) => {
    const { imageData, options = {} } = params;

    if (!imageData) {
      return {
        success: false,
        error: 'imageData is required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.extractTextFromScreenshot(imageData, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Compare screenshot similarity
   *
   * @command compare_screenshots_similarity
   * @param {string} params.imageData1 - First screenshot base64 data
   * @param {string} params.imageData2 - Second screenshot base64 data
   * @param {Object} [params.options] - Comparison options
   * @param {string} [params.options.method='perceptual'] - Comparison method ('perceptual', 'pixel', 'structural')
   * @returns {Object} Similarity score (0-1) and analysis
   */
  commandHandlers.compare_screenshots_similarity = async (params) => {
    const { imageData1, imageData2, options = {} } = params;

    if (!imageData1 || !imageData2) {
      return {
        success: false,
        error: 'Both imageData1 and imageData2 are required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.calculateSimilarity(imageData1, imageData2, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Capture element screenshot with surrounding context
   *
   * @command capture_element_screenshot_with_context
   * @param {string} params.selector - CSS selector of target element
   * @param {Object} [params.options] - Screenshot options
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality] - Quality setting
   * @param {number} [params.options.contextPadding=50] - Context padding in pixels
   * @param {boolean} [params.options.highlightElement=true] - Highlight the target element
   * @param {string} [params.options.highlightColor='#FF0000'] - Highlight color
   * @param {boolean} [params.options.includeLabel=true] - Include element label
   * @param {string} [params.options.labelText] - Custom label text
   * @returns {Object} Screenshot with element and context
   */
  commandHandlers.capture_element_screenshot_with_context = async (params) => {
    const { selector, options = {} } = params;

    if (!selector) {
      return {
        success: false,
        error: 'selector is required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.captureElementWithContext(selector, options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Capture scrolling screenshot
   *
   * @command capture_scrolling_screenshot
   * @param {Object} [params.options] - Scrolling screenshot options
   * @param {string} [params.options.format='png'] - Output format
   * @param {number} [params.options.quality] - Quality setting
   * @param {number} [params.options.scrollDelay=100] - Delay between scroll steps in ms
   * @param {number} [params.options.scrollStep=500] - Pixels to scroll per step
   * @param {number} [params.options.maxHeight=32000] - Maximum height in pixels
   * @param {boolean} [params.options.includeProgressMarkers=false] - Add progress markers
   * @returns {Object} Scrolling screenshot result
   */
  commandHandlers.capture_scrolling_screenshot = async (params) => {
    const { options = {} } = params;

    try {
      const manager = getManager(mainWindow);
      const result = await manager.captureScrolling(options);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Configure screenshot quality preset
   *
   * @command configure_screenshot_quality
   * @param {string} params.preset - Quality preset name ('forensic', 'web', 'thumbnail', 'archival')
   * @returns {Object} Configured quality settings
   */
  commandHandlers.configure_screenshot_quality = async (params) => {
    const { preset } = params;

    if (!preset) {
      return {
        success: false,
        error: 'preset is required. Available: forensic, web, thumbnail, archival'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = manager.configureQuality(preset);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get screenshot quality presets
   *
   * @command get_screenshot_quality_presets
   * @returns {Object} Available quality presets
   */
  commandHandlers.get_screenshot_quality_presets = async () => {
    try {
      const manager = getManager(mainWindow);
      const result = manager.getQualityPresets();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Get PII detection patterns
   *
   * @command get_pii_patterns
   * @returns {Object} Available PII detection patterns
   */
  commandHandlers.get_pii_patterns = async () => {
    try {
      const manager = getManager(mainWindow);
      const result = manager.getPIIPatterns();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Enrich screenshot with metadata
   *
   * @command enrich_screenshot_metadata
   * @param {string} params.imageData - Screenshot base64 data
   * @param {Object} [params.metadata] - Additional metadata to attach
   * @returns {Object} Screenshot with enriched metadata and hash
   */
  commandHandlers.enrich_screenshot_metadata = async (params) => {
    const { imageData, metadata = {} } = params;

    if (!imageData) {
      return {
        success: false,
        error: 'imageData is required'
      };
    }

    try {
      const manager = getManager(mainWindow);
      const result = await manager.enrichMetadata(imageData, metadata);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Save screenshot to file with enriched metadata
   *
   * @command save_screenshot_to_file
   * @param {string} params.imageData - Screenshot base64 data
   * @param {string} params.filePath - Path to save the file
   * @param {Object} [params.metadata] - Additional metadata to attach
   * @returns {Object} Save result with file path and metadata
   */
  commandHandlers.save_screenshot_to_file = async (params) => {
    const { imageData, filePath, metadata = {} } = params;

    if (!imageData) {
      return {
        success: false,
        error: 'imageData is required'
      };
    }

    if (!filePath) {
      return {
        success: false,
        error: 'filePath is required'
      };
    }

    try {
      const manager = getManager(mainWindow);

      // Enrich metadata first
      const enrichedResult = await manager.enrichMetadata(imageData, metadata);
      if (!enrichedResult.success) {
        return enrichedResult;
      }

      // Save to file
      const saveResult = await manager.saveToFile(imageData, filePath);
      if (!saveResult.success) {
        return saveResult;
      }

      return {
        success: true,
        filePath: saveResult.filePath,
        size: saveResult.size,
        metadata: enrichedResult.metadata,
        hash: enrichedResult.hash
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  /**
   * Cleanup screenshot manager resources
   *
   * @command cleanup_screenshot_manager
   * @returns {Object} Cleanup result
   */
  commandHandlers.cleanup_screenshot_manager = async () => {
    try {
      if (screenshotManager) {
        screenshotManager.cleanup();
      }
      return {
        success: true,
        message: 'Screenshot manager resources cleaned up'
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
 * Cleanup function for module
 */
function cleanup() {
  if (screenshotManager) {
    screenshotManager.cleanup();
    screenshotManager = null;
  }
}

module.exports = {
  registerScreenshotCommands,
  cleanup
};

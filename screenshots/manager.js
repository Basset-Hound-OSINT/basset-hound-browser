/**
 * Basset Hound Browser - Enhanced Screenshot Manager
 * Provides advanced screenshot capabilities including full page capture,
 * element screenshots, annotations, and multiple format support.
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Screenshot format configurations
 */
const FORMAT_CONFIG = {
  png: { mimeType: 'image/png', extension: '.png', quality: 1.0 },
  jpeg: { mimeType: 'image/jpeg', extension: '.jpg', quality: 0.92 },
  webp: { mimeType: 'image/webp', extension: '.webp', quality: 0.92 }
};

/**
 * Screenshot quality presets for different use cases
 */
const QUALITY_PRESETS = {
  forensic: {
    format: 'png',
    quality: 1.0,
    compression: 0,
    description: 'Lossless quality for forensic documentation'
  },
  web: {
    format: 'webp',
    quality: 0.85,
    compression: 6,
    description: 'Balanced quality and file size for web use'
  },
  thumbnail: {
    format: 'jpeg',
    quality: 0.6,
    compression: 8,
    description: 'Compressed for thumbnail previews'
  },
  archival: {
    format: 'png',
    quality: 1.0,
    compression: 9,
    description: 'Maximum compression with lossless quality'
  }
};

/**
 * PII detection patterns for automatic blurring
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  creditCard: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
};

/**
 * ScreenshotManager class for enhanced screenshot capabilities
 */
class ScreenshotManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.pendingRequests = new Map();
    this.requestIdCounter = 0;
    this.setupIPCListeners();
  }

  /**
   * Generate unique request ID
   * @returns {string} Unique request identifier
   */
  generateRequestId() {
    return `screenshot-${Date.now()}-${++this.requestIdCounter}`;
  }

  /**
   * Setup IPC listeners for screenshot responses
   */
  setupIPCListeners() {
    const responseChannels = [
      'screenshot-full-page-response',
      'screenshot-element-response',
      'screenshot-area-response',
      'screenshot-viewport-response',
      'compare-screenshots-response',
      'stitch-screenshots-response',
      'ocr-screenshot-response',
      'screenshot-with-highlights-response',
      'screenshot-with-blur-response',
      'calculate-similarity-response',
      'screenshot-element-with-context-response',
      'screenshot-scrolling-response',
      'annotate-screenshot-response'
    ];

    responseChannels.forEach(channel => {
      ipcMain.on(channel, (event, data) => {
        const { requestId, ...result } = data;
        const resolver = this.pendingRequests.get(requestId);
        if (resolver) {
          resolver(result);
          this.pendingRequests.delete(requestId);
        }
      });
    });
  }

  /**
   * Capture viewport screenshot
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Screenshot result
   */
  async captureViewport(options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0
    } = options;

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-viewport', {
        requestId,
        format,
        quality
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Capture full page screenshot (scroll and stitch)
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Screenshot result with full page image
   */
  async captureFullPage(options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      scrollDelay = 100,
      maxHeight = 32000 // Maximum stitched height
    } = options;

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-full-page', {
        requestId,
        format,
        quality,
        scrollDelay,
        maxHeight
      });

      // Timeout after 120 seconds for full page capture
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Full page screenshot timeout' });
        }
      }, 120000);
    });
  }

  /**
   * Capture screenshot of specific element
   * @param {string} selector - CSS selector of element
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Screenshot result
   */
  async captureElement(selector, options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      padding = 0
    } = options;

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-element', {
        requestId,
        selector,
        format,
        quality,
        padding
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Element screenshot timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Capture screenshot of specific area (coordinates)
   * @param {Object} area - Area coordinates { x, y, width, height }
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Screenshot result
   */
  async captureArea(area, options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0
    } = options;

    if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' ||
        typeof area.width !== 'number' || typeof area.height !== 'number') {
      return { success: false, error: 'Invalid area coordinates. Required: x, y, width, height' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-area', {
        requestId,
        area,
        format,
        quality
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Area screenshot timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Apply annotations to a screenshot
   * @param {string} imageData - Base64 encoded image data
   * @param {Array} annotations - Array of annotation objects
   * @returns {Promise<Object>} Annotated screenshot result
   */
  async annotateScreenshot(imageData, annotations) {
    if (!imageData) {
      return { success: false, error: 'Image data is required' };
    }

    if (!Array.isArray(annotations) || annotations.length === 0) {
      return { success: false, error: 'Annotations array is required' };
    }

    // Validate annotations
    for (const annotation of annotations) {
      if (!annotation.type) {
        return { success: false, error: 'Each annotation must have a type' };
      }
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('annotate-screenshot', {
        requestId,
        imageData,
        annotations
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Annotation timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Save screenshot to file
   * @param {string} imageData - Base64 encoded image data
   * @param {string} filePath - Path to save the file
   * @param {Object} options - Save options
   * @returns {Promise<Object>} Save result
   */
  async saveToFile(imageData, filePath, options = {}) {
    try {
      // Extract base64 data
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, buffer);

      return {
        success: true,
        filePath,
        size: buffer.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get supported formats
   * @returns {Array} List of supported formats
   */
  getSupportedFormats() {
    return Object.keys(FORMAT_CONFIG);
  }

  /**
   * Get format configuration
   * @param {string} format - Format name
   * @returns {Object} Format configuration
   */
  getFormatConfig(format) {
    return FORMAT_CONFIG[format] || FORMAT_CONFIG.png;
  }

  /**
   * Compare two screenshots (visual diff)
   * @param {string} imageData1 - First image base64 data
   * @param {string} imageData2 - Second image base64 data
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison result with diff image
   */
  async compareScreenshots(imageData1, imageData2, options = {}) {
    const {
      threshold = 0.1, // Sensitivity threshold (0-1)
      highlightColor = '#FF0000',
      outputFormat = 'png'
    } = options;

    if (!imageData1 || !imageData2) {
      return { success: false, error: 'Both imageData1 and imageData2 are required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('compare-screenshots', {
        requestId,
        imageData1,
        imageData2,
        threshold,
        highlightColor,
        outputFormat
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot comparison timeout' });
        }
      }, 60000);
    });
  }

  /**
   * Stitch multiple screenshots into one image
   * @param {Array<string>} imageDatas - Array of base64 image data
   * @param {Object} options - Stitching options
   * @returns {Promise<Object>} Stitched screenshot result
   */
  async stitchScreenshots(imageDatas, options = {}) {
    const {
      direction = 'vertical', // 'vertical' or 'horizontal'
      gap = 0,
      backgroundColor = '#FFFFFF',
      format = 'png',
      quality = 1.0
    } = options;

    if (!Array.isArray(imageDatas) || imageDatas.length === 0) {
      return { success: false, error: 'imageDatas array with at least one image is required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('stitch-screenshots', {
        requestId,
        imageDatas,
        direction,
        gap,
        backgroundColor,
        format,
        quality
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot stitching timeout' });
        }
      }, 60000);
    });
  }

  /**
   * Extract text from screenshot using OCR
   * @param {string} imageData - Base64 encoded image data
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} OCR result with text and coordinates
   */
  async extractTextFromScreenshot(imageData, options = {}) {
    const {
      language = 'eng',
      overlay = false, // If true, returns image with text overlays
      highlightMatches = null // Optional text to highlight
    } = options;

    if (!imageData) {
      return { success: false, error: 'imageData is required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('ocr-screenshot', {
        requestId,
        imageData,
        language,
        overlay,
        highlightMatches
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'OCR processing timeout' });
        }
      }, 90000);
    });
  }

  /**
   * Capture screenshot with element highlighting
   * @param {Array<string>} selectors - CSS selectors to highlight
   * @param {Object} options - Screenshot and highlight options
   * @returns {Promise<Object>} Screenshot with highlighted elements
   */
  async captureWithHighlights(selectors, options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      fullPage = false,
      highlightColor = '#FFFF00',
      highlightOpacity = 0.3,
      highlightBorder = true,
      borderColor = '#FF0000',
      borderWidth = 2
    } = options;

    if (!Array.isArray(selectors) || selectors.length === 0) {
      return { success: false, error: 'selectors array is required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-with-highlights', {
        requestId,
        selectors,
        format,
        quality,
        fullPage,
        highlightColor,
        highlightOpacity,
        highlightBorder,
        borderColor,
        borderWidth
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot with highlights timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Capture screenshot with automatic PII blurring
   * @param {Object} options - Screenshot and blur options
   * @returns {Promise<Object>} Screenshot with sensitive data blurred
   */
  async captureWithBlur(options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      fullPage = false,
      blurPatterns = Object.keys(PII_PATTERNS),
      customSelectors = [], // Additional elements to blur
      blurIntensity = 10,
      detectText = true // Use OCR to detect PII
    } = options;

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-with-blur', {
        requestId,
        format,
        quality,
        fullPage,
        blurPatterns,
        customSelectors,
        blurIntensity,
        detectText
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Screenshot with blur timeout' });
        }
      }, 60000);
    });
  }

  /**
   * Enrich screenshot metadata
   * @param {string} imageData - Base64 encoded image data
   * @param {Object} metadata - Additional metadata to attach
   * @returns {Promise<Object>} Screenshot with enriched metadata
   */
  async enrichMetadata(imageData, metadata = {}) {
    if (!imageData) {
      return { success: false, error: 'imageData is required' };
    }

    try {
      // Extract base64 data
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Generate hash for integrity
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Collect comprehensive metadata
      const enrichedMetadata = {
        timestamp: new Date().toISOString(),
        hash: hash,
        size: buffer.length,
        format: imageData.match(/^data:image\/(\w+);/)?.[1] || 'unknown',
        captureInfo: {
          userAgent: this.mainWindow.webContents.getUserAgent(),
          url: this.mainWindow.webContents.getURL(),
          title: this.mainWindow.webContents.getTitle(),
          ...metadata
        }
      };

      return {
        success: true,
        imageData,
        metadata: enrichedMetadata,
        hash
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Calculate similarity between two screenshots
   * @param {string} imageData1 - First image base64 data
   * @param {string} imageData2 - Second image base64 data
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Similarity score and details
   */
  async calculateSimilarity(imageData1, imageData2, options = {}) {
    const {
      method = 'perceptual' // 'perceptual', 'pixel', 'structural'
    } = options;

    if (!imageData1 || !imageData2) {
      return { success: false, error: 'Both imageData1 and imageData2 are required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('calculate-similarity', {
        requestId,
        imageData1,
        imageData2,
        method
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Similarity calculation timeout' });
        }
      }, 60000);
    });
  }

  /**
   * Capture element screenshot with surrounding context
   * @param {string} selector - CSS selector of target element
   * @param {Object} options - Screenshot options
   * @returns {Promise<Object>} Screenshot with element and context
   */
  async captureElementWithContext(selector, options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      contextPadding = 50, // Pixels of context around element
      highlightElement = true,
      highlightColor = '#FF0000',
      includeLabel = true,
      labelText = null
    } = options;

    if (!selector) {
      return { success: false, error: 'selector is required' };
    }

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-element-with-context', {
        requestId,
        selector,
        format,
        quality,
        contextPadding,
        highlightElement,
        highlightColor,
        includeLabel,
        labelText
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Element context screenshot timeout' });
        }
      }, 30000);
    });
  }

  /**
   * Capture scrolling screenshot (alternative to full page)
   * @param {Object} options - Scrolling screenshot options
   * @returns {Promise<Object>} Scrolling screenshot result
   */
  async captureScrolling(options = {}) {
    const {
      format = 'png',
      quality = FORMAT_CONFIG[format]?.quality || 1.0,
      scrollDelay = 100,
      scrollStep = 500, // Pixels to scroll per step
      maxHeight = 32000,
      includeProgressMarkers = false
    } = options;

    const requestId = this.generateRequestId();

    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve);
      this.mainWindow.webContents.send('screenshot-scrolling', {
        requestId,
        format,
        quality,
        scrollDelay,
        scrollStep,
        maxHeight,
        includeProgressMarkers
      });

      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve({ success: false, error: 'Scrolling screenshot timeout' });
        }
      }, 120000);
    });
  }

  /**
   * Configure screenshot quality preset
   * @param {string} preset - Preset name ('forensic', 'web', 'thumbnail', 'archival')
   * @returns {Object} Configured quality settings
   */
  configureQuality(preset) {
    if (!QUALITY_PRESETS[preset]) {
      return {
        success: false,
        error: `Unknown preset: ${preset}. Available presets: ${Object.keys(QUALITY_PRESETS).join(', ')}`
      };
    }

    return {
      success: true,
      preset: preset,
      config: QUALITY_PRESETS[preset]
    };
  }

  /**
   * Get quality presets
   * @returns {Object} Available quality presets
   */
  getQualityPresets() {
    return {
      success: true,
      presets: QUALITY_PRESETS
    };
  }

  /**
   * Get PII detection patterns
   * @returns {Object} Available PII patterns
   */
  getPIIPatterns() {
    return {
      success: true,
      patterns: Object.keys(PII_PATTERNS)
    };
  }

  /**
   * Cleanup pending requests
   */
  cleanup() {
    this.pendingRequests.clear();
  }
}

/**
 * Annotation types and their configurations
 */
const ANNOTATION_TYPES = {
  // Text annotation
  text: {
    required: ['text', 'x', 'y'],
    defaults: {
      fontSize: 16,
      fontFamily: 'Arial',
      color: '#FF0000',
      backgroundColor: null,
      padding: 4
    }
  },
  // Rectangle highlight
  rectangle: {
    required: ['x', 'y', 'width', 'height'],
    defaults: {
      strokeColor: '#FF0000',
      strokeWidth: 2,
      fillColor: null,
      opacity: 1
    }
  },
  // Circle highlight
  circle: {
    required: ['x', 'y', 'radius'],
    defaults: {
      strokeColor: '#FF0000',
      strokeWidth: 2,
      fillColor: null,
      opacity: 1
    }
  },
  // Arrow
  arrow: {
    required: ['startX', 'startY', 'endX', 'endY'],
    defaults: {
      color: '#FF0000',
      strokeWidth: 2,
      headSize: 10
    }
  },
  // Blur area
  blur: {
    required: ['x', 'y', 'width', 'height'],
    defaults: {
      intensity: 10
    }
  },
  // Highlight (semi-transparent overlay)
  highlight: {
    required: ['x', 'y', 'width', 'height'],
    defaults: {
      color: '#FFFF00',
      opacity: 0.3
    }
  },
  // Line
  line: {
    required: ['startX', 'startY', 'endX', 'endY'],
    defaults: {
      color: '#FF0000',
      strokeWidth: 2,
      dashed: false
    }
  }
};

/**
 * Validate annotation object
 * @param {Object} annotation - Annotation to validate
 * @returns {Object} Validation result
 */
function validateAnnotation(annotation) {
  const typeConfig = ANNOTATION_TYPES[annotation.type];

  if (!typeConfig) {
    return {
      valid: false,
      error: `Unknown annotation type: ${annotation.type}. Supported types: ${Object.keys(ANNOTATION_TYPES).join(', ')}`
    };
  }

  // Check required fields
  for (const field of typeConfig.required) {
    if (annotation[field] === undefined) {
      return {
        valid: false,
        error: `Missing required field '${field}' for annotation type '${annotation.type}'`
      };
    }
  }

  return { valid: true };
}

/**
 * Apply defaults to annotation
 * @param {Object} annotation - Annotation object
 * @returns {Object} Annotation with defaults applied
 */
function applyAnnotationDefaults(annotation) {
  const typeConfig = ANNOTATION_TYPES[annotation.type];
  if (!typeConfig) return annotation;

  return {
    ...typeConfig.defaults,
    ...annotation
  };
}

module.exports = {
  ScreenshotManager,
  FORMAT_CONFIG,
  QUALITY_PRESETS,
  PII_PATTERNS,
  ANNOTATION_TYPES,
  validateAnnotation,
  applyAnnotationDefaults
};

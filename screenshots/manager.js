/**
 * Basset Hound Browser - Enhanced Screenshot Manager
 * Provides advanced screenshot capabilities including full page capture,
 * element screenshots, annotations, and multiple format support.
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/**
 * Screenshot format configurations
 */
const FORMAT_CONFIG = {
  png: { mimeType: 'image/png', extension: '.png', quality: 1.0 },
  jpeg: { mimeType: 'image/jpeg', extension: '.jpg', quality: 0.92 },
  webp: { mimeType: 'image/webp', extension: '.webp', quality: 0.92 }
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
    ipcMain.on('screenshot-full-page-response', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('screenshot-element-response', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('screenshot-area-response', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    });

    ipcMain.on('screenshot-viewport-response', (event, data) => {
      const { requestId, ...result } = data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
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
  ANNOTATION_TYPES,
  validateAnnotation,
  applyAnnotationDefaults
};

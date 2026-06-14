/**
 * Screenshot Validators
 *
 * Comprehensive validation suite for screenshot quality, format, and content integrity.
 * Provides detection of common edge cases (blank pages, corrupt data, oversized images).
 */

/**
 * Image quality and content analysis metrics
 */
const VALIDATION_THRESHOLDS = {
  minWidth: 100,
  maxWidth: 10000,
  minHeight: 100,
  maxHeight: 30000,
  minEntropyThreshold: 0.05,  // Minimum entropy to consider non-blank
  blankPageThreshold: 0.98,   // >98% similarity indicates blank page
  minFileSize: 100,           // Minimum bytes for valid image
  maxFileSize: 100 * 1024 * 1024  // 100MB max
};

/**
 * ImageValidator class for comprehensive screenshot validation
 */
class ImageValidator {
  /**
   * Validate image data integrity and format
   * @param {Buffer|string} data - Image data (Buffer or base64/data URL string)
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with status and metrics
   */
  static validateImageData(data, options = {}) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      metrics: {}
    };

    try {
      // Check data exists
      if (!data) {
        result.errors.push('No image data provided');
        return result;
      }

      // Convert data URL to buffer if needed
      let imageBuffer;
      if (typeof data === 'string') {
        if (data.startsWith('data:image/')) {
          const match = data.match(/^data:image\/\w+;base64,(.+)$/);
          if (!match) {
            result.errors.push('Invalid data URL format');
            return result;
          }
          imageBuffer = Buffer.from(match[1], 'base64');
        } else {
          // Try treating as base64
          try {
            imageBuffer = Buffer.from(data, 'base64');
          } catch (e) {
            result.errors.push('Invalid base64 string');
            return result;
          }
        }
      } else if (Buffer.isBuffer(data)) {
        imageBuffer = data;
      } else {
        result.errors.push('Image data must be Buffer or string');
        return result;
      }

      // Validate file size
      if (imageBuffer.length < VALIDATION_THRESHOLDS.minFileSize) {
        result.errors.push(`File size ${imageBuffer.length} bytes is below minimum ${VALIDATION_THRESHOLDS.minFileSize} bytes`);
        return result;
      }

      if (imageBuffer.length > VALIDATION_THRESHOLDS.maxFileSize) {
        result.errors.push(`File size ${imageBuffer.length} bytes exceeds maximum ${VALIDATION_THRESHOLDS.maxFileSize} bytes`);
        return result;
      }

      result.metrics.fileSize = imageBuffer.length;

      // Detect image format from magic bytes
      const format = this.detectFormat(imageBuffer);
      if (!format) {
        result.errors.push('Unrecognized image format (invalid magic bytes)');
        return result;
      }

      result.metrics.detectedFormat = format;

      // Validate PNG signature if PNG
      if (format === 'png') {
        const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        if (!imageBuffer.slice(0, 8).equals(pngSignature)) {
          result.errors.push('Invalid PNG signature');
          return result;
        }
      }

      // Validate JPEG signature if JPEG
      if (format === 'jpeg') {
        if (imageBuffer[0] !== 0xFF || imageBuffer[1] !== 0xD8) {
          result.errors.push('Invalid JPEG signature');
          return result;
        }
      }

      // Validate WebP signature if WebP
      if (format === 'webp') {
        const webpSignature = Buffer.from('RIFF');
        const webpMarker = Buffer.from('WEBP');
        if (!imageBuffer.slice(0, 4).equals(webpSignature) ||
            !imageBuffer.slice(8, 12).equals(webpMarker)) {
          result.errors.push('Invalid WebP signature');
          return result;
        }
      }

      result.valid = true;
      return result;
    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      return result;
    }
  }

  /**
   * Detect image format from file signature (magic bytes)
   * @param {Buffer} buffer - Image data buffer
   * @returns {string|null} Format name or null if unrecognized
   */
  static detectFormat(buffer) {
    if (!buffer || buffer.length < 4) {
      return null;
    }

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'png';
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }

    // WebP: RIFF ... WEBP
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return 'webp';
    }

    // GIF: 47 49 46
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'gif';
    }

    // BMP: 42 4D
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
      return 'bmp';
    }

    return null;
  }

  /**
   * Validate image dimensions
   * @param {number} width - Image width
   * @param {number} height - Image height
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateDimensions(width, height, options = {}) {
    const {
      minWidth = VALIDATION_THRESHOLDS.minWidth,
      maxWidth = VALIDATION_THRESHOLDS.maxWidth,
      minHeight = VALIDATION_THRESHOLDS.minHeight,
      maxHeight = VALIDATION_THRESHOLDS.maxHeight
    } = options;

    const result = {
      valid: false,
      errors: [],
      warnings: [],
      metrics: { width, height }
    };

    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      result.errors.push('Width and height must be integers');
      return result;
    }

    if (width < minWidth) {
      result.errors.push(`Width ${width} below minimum ${minWidth}`);
    }

    if (width > maxWidth) {
      result.errors.push(`Width ${width} exceeds maximum ${maxWidth}`);
    }

    if (height < minHeight) {
      result.errors.push(`Height ${height} below minimum ${minHeight}`);
    }

    if (height > maxHeight) {
      result.errors.push(`Height ${height} exceeds maximum ${maxHeight}`);
    }

    // Warn about extreme aspect ratios
    const aspectRatio = width / height;
    if (aspectRatio > 10 || aspectRatio < 0.1) {
      result.warnings.push(`Unusual aspect ratio: ${aspectRatio.toFixed(2)}:1`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Detect blank or nearly blank pages
   * @param {Buffer|string} imageData - Image data
   * @param {number} threshold - Threshold for blank detection (0-1)
   * @returns {Object} Detection result
   */
  static detectBlankImage(imageData, threshold = VALIDATION_THRESHOLDS.blankPageThreshold) {
    const result = {
      isBlank: false,
      confidence: 0,
      type: null,
      metrics: {}
    };

    try {
      // Convert to buffer if needed
      let buffer;
      if (typeof imageData === 'string') {
        if (imageData.startsWith('data:image/')) {
          const match = imageData.match(/^data:image\/\w+;base64,(.+)$/);
          buffer = match ? Buffer.from(match[1], 'base64') : null;
        } else {
          buffer = Buffer.from(imageData, 'base64');
        }
      } else {
        buffer = imageData;
      }

      if (!buffer || buffer.length < 100) {
        result.isBlank = true;
        result.confidence = 0.9;
        result.type = 'invalid_or_empty';
        return result;
      }

      // For now, use heuristic approach based on file size and entropy
      // A truly blank page (single color) will have small file size and low entropy

      // Detect dominant color patterns in PNG/JPEG headers
      // This is a simplified check - look for patterns suggesting single-color content

      // Count unique byte patterns - blank images have very low entropy
      const byteCounts = new Map();
      let maxCount = 0;

      // Sample 10KB for performance
      const sampleSize = Math.min(buffer.length, 10000);
      const sample = buffer.slice(0, sampleSize);

      for (let i = 0; i < sample.length; i++) {
        const byte = sample[i];
        const count = (byteCounts.get(byte) || 0) + 1;
        byteCounts.set(byte, count);
        maxCount = Math.max(maxCount, count);
      }

      // If one byte value dominates >90% of sample, likely blank
      const dominanceRatio = maxCount / sampleSize;
      result.metrics.dominanceRatio = dominanceRatio;

      if (dominanceRatio > 0.95) {
        result.isBlank = true;
        result.confidence = dominanceRatio;
        result.type = 'single_color';
        return result;
      }

      // Check entropy of byte distribution
      const entropy = this.calculateEntropy(sample);
      result.metrics.entropy = entropy;

      if (entropy < VALIDATION_THRESHOLDS.minEntropyThreshold) {
        result.isBlank = true;
        result.confidence = 1 - entropy;
        result.type = 'low_entropy';
        return result;
      }

      result.isBlank = false;
      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }

  /**
   * Calculate Shannon entropy of data
   * @param {Buffer} buffer - Data buffer
   * @returns {number} Entropy value (0-8 for byte data)
   */
  static calculateEntropy(buffer) {
    if (!buffer || buffer.length === 0) {
      return 0;
    }

    const frequencies = new Map();

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
    }

    let entropy = 0;
    const length = buffer.length;

    for (const count of frequencies.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Analyze overall image quality
   * @param {Object} validationResults - Results from other validators
   * @returns {Object} Quality analysis
   */
  static analyzeImageQuality(validationResults) {
    const analysis = {
      overallQuality: 'unknown',
      score: 0,
      issues: [],
      recommendations: []
    };

    const {
      imageDataValid = true,
      dimensionsValid = true,
      isBlank = false,
      detectedFormat = null,
      fileSize = 0,
      entropy = 0
    } = validationResults;

    let qualityScore = 100;

    // Deduct points for issues
    if (!imageDataValid) {
      qualityScore -= 50;
      analysis.issues.push('Invalid image data');
    }

    if (!dimensionsValid) {
      qualityScore -= 30;
      analysis.issues.push('Invalid dimensions');
    }

    if (isBlank) {
      qualityScore -= 40;
      analysis.issues.push('Blank or nearly blank image');
    }

    if (entropy < 0.5) {
      qualityScore -= 20;
      analysis.issues.push('Low entropy/low detail');
    }

    // Determine quality level
    if (qualityScore >= 90) {
      analysis.overallQuality = 'excellent';
    } else if (qualityScore >= 70) {
      analysis.overallQuality = 'good';
    } else if (qualityScore >= 50) {
      analysis.overallQuality = 'acceptable';
    } else {
      analysis.overallQuality = 'poor';
    }

    analysis.score = qualityScore;

    // Provide recommendations
    if (isBlank) {
      analysis.recommendations.push('Screenshot appears blank - verify page loaded correctly');
    }

    if (entropy < 0.5) {
      analysis.recommendations.push('Consider using JPEG/WebP for better compression of low-detail images');
    }

    if (detectedFormat === 'png' && fileSize > 5 * 1024 * 1024) {
      analysis.recommendations.push('Large PNG file - consider WebP format for better compression');
    }

    return analysis;
  }

  /**
   * Validate format-specific options
   * @param {string} format - Image format (png, jpeg, webp)
   * @param {Object} options - Format-specific options
   * @returns {Object} Validation result
   */
  static validateFormatOptions(format, options = {}) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    const { quality } = options;

    if (quality !== undefined) {
      if (typeof quality !== 'number' || quality < 0 || quality > 1) {
        result.errors.push('Quality must be a number between 0 and 1');
      }
    }

    // Format-specific validation
    switch (format) {
      case 'png':
        // PNG doesn't use quality parameter
        if (quality !== undefined && quality < 1) {
          result.warnings.push('PNG uses lossless compression; quality parameter ignored');
        }
        break;

      case 'jpeg':
      case 'jpg':
        // JPEG is lossy - quality matters
        if (quality !== undefined) {
          if (quality < 0.5) {
            result.warnings.push('JPEG quality below 0.5 may produce visible artifacts');
          }
        }
        break;

      case 'webp':
        // WebP supports both lossy and lossless
        if (quality === 1) {
          result.warnings.push('WebP quality=1.0 will use lossless encoding');
        }
        break;

      default:
        result.errors.push(`Unknown format: ${format}`);
    }

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Comprehensive validation of screenshot
   * @param {Object} screenshot - Screenshot object
   * @returns {Object} Complete validation result
   */
  static validateScreenshot(screenshot) {
    const result = {
      valid: false,
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0
      }
    };

    try {
      // Check image data
      const dataCheck = this.validateImageData(screenshot.data);
      result.checks.imageData = dataCheck;
      if (dataCheck.valid) {
        result.summary.passed++;
      } else {
        result.summary.failed++;
      }

      // Check dimensions if provided
      if (screenshot.width && screenshot.height) {
        const dimCheck = this.validateDimensions(screenshot.width, screenshot.height);
        result.checks.dimensions = dimCheck;
        if (dimCheck.valid) {
          result.summary.passed++;
        } else {
          result.summary.failed++;
        }
      }

      // Check for blank page
      const blankCheck = this.detectBlankImage(screenshot.data);
      result.checks.blankDetection = blankCheck;
      if (blankCheck.isBlank) {
        result.summary.warnings++;
      } else {
        result.summary.passed++;
      }

      // Analyze quality
      const qualityAnalysis = this.analyzeImageQuality({
        imageDataValid: dataCheck.valid,
        dimensionsValid: result.checks.dimensions?.valid !== false,
        isBlank: blankCheck.isBlank,
        detectedFormat: dataCheck.metrics.detectedFormat,
        fileSize: dataCheck.metrics.fileSize,
        entropy: blankCheck.metrics.entropy
      });
      result.checks.quality = qualityAnalysis;

      result.valid = result.summary.failed === 0;
      return result;
    } catch (error) {
      result.error = error.message;
      return result;
    }
  }
}

module.exports = { ImageValidator, VALIDATION_THRESHOLDS };

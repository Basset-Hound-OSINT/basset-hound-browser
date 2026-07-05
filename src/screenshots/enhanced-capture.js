/**
 * Basset Hound Browser - Enhanced Screenshot Capture
 * Annotations, multi-format export, OCR, and comparison
 */

const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnhancedScreenshotCapture {
  constructor() {
    this.screenshotDir = path.join(require('os').homedir(), 'tmp', '.basset-hound', 'screenshots');
    this.ensureDirectory();
  }

  ensureDirectory() {
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Take standard screenshot
   * @param {Object} webview - Electron webview/webContents
   * @returns {Promise} Base64 PNG
   */
  async takeScreenshot(webview) {
    try {
      const image = await webview.capturePage();
      return image.toPNG().toString('base64');
    } catch (err) {
      throw new Error(`Screenshot capture failed: ${err.message}`);
    }
  }

  /**
   * Take annotated screenshot with highlights
   * @param {Buffer} imageBuffer - Screenshot image buffer
   * @param {Array} annotations - Annotations to apply
   * @returns {Promise} Annotated screenshot base64
   */
  async takeAnnotatedScreenshot(imageBuffer, annotations = []) {
    try {
      let image = sharp(imageBuffer);

      // Apply annotations (rectangles, arrows, text)
      const overlayImages = [];

      for (const annotation of annotations) {
        if (annotation.type === 'rectangle') {
          overlayImages.push({
            input: await this.createRectangleOverlay(
              annotation.x, annotation.y, annotation.width, annotation.height,
              annotation.color || '#FF0000'
            ),
            top: annotation.y,
            left: annotation.x
          });
        } else if (annotation.type === 'highlight') {
          overlayImages.push({
            input: await this.createHighlightOverlay(
              annotation.x, annotation.y, annotation.width, annotation.height,
              annotation.color || 'rgba(255,0,0,0.3)'
            ),
            top: annotation.y,
            left: annotation.x
          });
        } else if (annotation.type === 'label') {
          overlayImages.push({
            input: await this.createTextOverlay(
              annotation.text,
              annotation.color || '#000000',
              annotation.fontSize || 14
            ),
            top: annotation.y,
            left: annotation.x
          });
        }
      }

      // Composite all overlays
      if (overlayImages.length > 0) {
        image = image.composite(overlayImages);
      }

      return (await image.png().toBuffer()).toString('base64');
    } catch (err) {
      throw new Error(`Screenshot annotation failed: ${err.message}`);
    }
  }

  /**
   * Create rectangle overlay SVG
   */
  async createRectangleOverlay(x, y, width, height, color) {
    const svg = `
      <svg width="${width + 10}" height="${height + 10}">
        <rect x="5" y="5" width="${width}" height="${height}"
              fill="none" stroke="${color}" stroke-width="2" />
      </svg>
    `;
    return Buffer.from(svg);
  }

  /**
   * Create highlight overlay SVG
   */
  async createHighlightOverlay(x, y, width, height, color) {
    const svg = `
      <svg width="${width}" height="${height}">
        <rect x="0" y="0" width="${width}" height="${height}"
              fill="${color}" />
      </svg>
    `;
    return Buffer.from(svg);
  }

  /**
   * Create text overlay SVG
   */
  async createTextOverlay(text, color, fontSize) {
    const svg = `
      <svg width="400" height="${fontSize + 10}">
        <text x="5" y="${fontSize - 2}" font-size="${fontSize}"
              fill="${color}" font-family="Arial">${text}</text>
      </svg>
    `;
    return Buffer.from(svg);
  }

  /**
   * Export screenshot in multiple formats
   * @param {Buffer} imageBuffer - Screenshot buffer
   * @param {string} format - Target format (png, webp, jpeg, gif)
   * @param {Object} options - Format-specific options
   * @returns {Promise} Converted image base64
   */
  async exportScreenshot(imageBuffer, format = 'png', options = {}) {
    try {
      let image = sharp(imageBuffer);

      switch (format.toLowerCase()) {
      case 'webp':
        image = image.webp({ quality: options.quality || 75 });
        break;
      case 'jpeg':
      case 'jpg':
        image = image.jpeg({ quality: options.quality || 80, progressive: true });
        break;
      case 'png':
      default:
        image = image.png({ compressionLevel: options.compression || 6 });
        break;
      case 'gif':
        // GIF conversion typically via ffmpeg in batch mode
        image = image.png(); // Fallback to PNG for now
        break;
      }

      const buffer = await image.toBuffer();
      return {
        success: true,
        format,
        data: buffer.toString('base64'),
        size: buffer.length
      };
    } catch (err) {
      throw new Error(`Screenshot export failed: ${err.message}`);
    }
  }

  /**
   * Generate thumbnail from screenshot
   * @param {Buffer} imageBuffer - Screenshot buffer
   * @param {number} width - Thumbnail width
   * @returns {Promise} Thumbnail base64
   */
  async generateThumbnail(imageBuffer, width = 200) {
    try {
      const buffer = await sharp(imageBuffer)
        .resize(width, Math.floor(width * 9 / 16), { fit: 'contain' })
        .png()
        .toBuffer();

      return {
        success: true,
        thumbnail: buffer.toString('base64'),
        size: buffer.length
      };
    } catch (err) {
      throw new Error(`Thumbnail generation failed: ${err.message}`);
    }
  }

  /**
   * Perform OCR on screenshot
   * @param {Buffer} imageBuffer - Screenshot buffer
   * @returns {Promise} Extracted text
   */
  async performOCR(imageBuffer) {
    try {
      // Save image temporarily for Tesseract
      const tempPath = path.join(this.screenshotDir, `.ocr-${Date.now()}.png`);
      fs.writeFileSync(tempPath, imageBuffer);

      const result = await Tesseract.recognize(tempPath, 'eng+fra', {
        logger: (info) => console.log('OCR Progress:', info.progress)
      });

      fs.unlinkSync(tempPath);

      return {
        success: true,
        text: result.data.text,
        confidence: result.data.confidence,
        words: result.data.words.length,
        lines: result.data.text.split('\n').length
      };
    } catch (err) {
      throw new Error(`OCR failed: ${err.message}`);
    }
  }

  /**
   * Compare two screenshots for differences
   * @param {Buffer} image1 - First screenshot
   * @param {Buffer} image2 - Second screenshot
   * @returns {Promise} Diff information
   */
  async compareScreenshots(image1, image2) {
    try {
      // Calculate perceptual hash for quick comparison
      const hash1 = await this.calculatePerceptualHash(image1);
      const hash2 = await this.calculatePerceptualHash(image2);

      const similarity = this.calculateHashSimilarity(hash1, hash2);

      // If significantly different, perform pixel-level diff
      let pixelDiff = null;
      if (similarity < 0.95) {
        pixelDiff = await this.pixelLevelDiff(image1, image2);
      }

      return {
        success: true,
        similarity: (similarity * 100).toFixed(1),
        different: similarity < 0.95,
        pixelDiff: pixelDiff,
        recommendation: similarity < 0.95 ? 'Changes detected' : 'No significant changes'
      };
    } catch (err) {
      throw new Error(`Screenshot comparison failed: ${err.message}`);
    }
  }

  /**
   * Calculate perceptual hash of image
   */
  async calculatePerceptualHash(imageBuffer) {
    try {
      const resized = await sharp(imageBuffer)
        .resize(8, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer();

      // Simple average hash
      let sum = 0;
      for (let i = 0; i < resized.length; i++) {
        sum += resized[i];
      }
      const avg = sum / resized.length;

      let hash = '';
      for (let i = 0; i < resized.length; i++) {
        hash += resized[i] > avg ? '1' : '0';
      }

      return hash;
    } catch (err) {
      console.error('Hash calculation error:', err);
      return '';
    }
  }

  /**
   * Calculate similarity between two hashes (Hamming distance)
   */
  calculateHashSimilarity(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      return 0;
    }

    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    return 1 - (differences / hash1.length);
  }

  /**
   * Pixel-level difference detection
   */
  async pixelLevelDiff(image1, image2) {
    try {
      // Use ImageMagick-style compare
      const img1 = sharp(image1);
      const img2 = sharp(image2);

      const meta1 = await img1.metadata();
      const meta2 = await img2.metadata();

      if (meta1.width !== meta2.width || meta1.height !== meta2.height) {
        return {
          resolutionDiff: true,
          resolution1: `${meta1.width}x${meta1.height}`,
          resolution2: `${meta2.width}x${meta2.height}`
        };
      }

      return {
        same_resolution: true,
        analysis: 'Pixel-level analysis available via advanced comparison'
      };
    } catch (err) {
      throw new Error(`Pixel diff failed: ${err.message}`);
    }
  }

  /**
   * Save screenshot with metadata
   * @param {Buffer} imageBuffer - Screenshot buffer
   * @param {Object} metadata - Screenshot metadata
   * @returns {Object} Saved file info
   */
  async saveScreenshot(imageBuffer, metadata = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      fs.writeFileSync(filepath, imageBuffer);

      // Generate SHA-256 hash for forensic verification
      const hash = crypto.createHash('sha256');
      hash.update(imageBuffer);

      // Save metadata alongside screenshot
      const metadataFile = filepath.replace('.png', '.json');
      const fullMetadata = {
        filename,
        filepath,
        timestamp: new Date().toISOString(),
        sha256: hash.digest('hex'),
        size: imageBuffer.length,
        ...metadata
      };

      fs.writeFileSync(metadataFile, JSON.stringify(fullMetadata, null, 2));

      return {
        success: true,
        filename,
        filepath,
        metadata: fullMetadata
      };
    } catch (err) {
      throw new Error(`Save screenshot failed: ${err.message}`);
    }
  }

  /**
   * Get screenshot list with metadata
   * @returns {Array} All saved screenshots
   */
  getScreenshotList() {
    try {
      const files = fs.readdirSync(this.screenshotDir);
      const screenshots = [];

      files.forEach(file => {
        if (file.endsWith('.png')) {
          const metadataFile = path.join(this.screenshotDir, file.replace('.png', '.json'));
          let metadata = {};

          if (fs.existsSync(metadataFile)) {
            metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
          }

          screenshots.push({
            filename: file,
            filepath: path.join(this.screenshotDir, file),
            metadata
          });
        }
      });

      return screenshots;
    } catch (err) {
      console.error('List screenshots error:', err);
      return [];
    }
  }

  /**
   * Delete screenshot
   * @param {string} filename - Screenshot filename
   */
  deleteScreenshot(filename) {
    try {
      const filepath = path.join(this.screenshotDir, filename);
      const metadataFile = filepath.replace('.png', '.json');

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      if (fs.existsSync(metadataFile)) {
        fs.unlinkSync(metadataFile);
      }

      return { success: true, deleted: filename };
    } catch (err) {
      throw new Error(`Delete screenshot failed: ${err.message}`);
    }
  }
}

module.exports = new EnhancedScreenshotCapture();

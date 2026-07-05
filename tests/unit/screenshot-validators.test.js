/**
 * Screenshot Validators Test Suite
 *
 * Tests for image validation, format detection, and quality analysis
 */

const { ImageValidator, VALIDATION_THRESHOLDS } = require('../../screenshots/validators');

describe('ImageValidator', () => {
  describe('validateImageData', () => {
    it('should validate valid PNG data', () => {
      // PNG signature: 137, 80, 78, 71, 13, 10, 26, 10
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const result = ImageValidator.validateImageData(pngBuffer);

      expect(result.valid).toBe(true);
      expect(result.metrics.detectedFormat).toBe('png');
    });

    it('should validate valid JPEG data', () => {
      // JPEG signature: FF D8 FF
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, ...Array(100).fill(0)]);
      const result = ImageValidator.validateImageData(jpegBuffer);

      expect(result.valid).toBe(true);
      expect(result.metrics.detectedFormat).toBe('jpeg');
    });

    it('should validate valid WebP data', () => {
      // WebP signature: RIFF ... WEBP
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
        ...Array(100).fill(0)
      ]);
      const result = ImageValidator.validateImageData(webpBuffer);

      expect(result.valid).toBe(true);
      expect(result.metrics.detectedFormat).toBe('webp');
    });

    it('should reject empty data', () => {
      const result = ImageValidator.validateImageData(null);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject undersized file', () => {
      const tinyBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const result = ImageValidator.validateImageData(tinyBuffer);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
    });

    it('should reject oversized file', () => {
      const size = VALIDATION_THRESHOLDS.maxFileSize + 1000;
      const largeBuffer = Buffer.alloc(size);
      largeBuffer[0] = 137;
      largeBuffer[1] = 80;
      largeBuffer[2] = 78;
      largeBuffer[3] = 71;

      const result = ImageValidator.validateImageData(largeBuffer);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should accept base64 data URL', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`;

      const result = ImageValidator.validateImageData(dataUrl);
      expect(result.valid).toBe(true);
      expect(result.metrics.detectedFormat).toBe('png');
    });

    it('should accept plain base64 string', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const base64 = pngBuffer.toString('base64');

      const result = ImageValidator.validateImageData(base64);
      expect(result.valid).toBe(true);
      expect(result.metrics.detectedFormat).toBe('png');
    });

    it('should reject invalid PNG signature', () => {
      const invalidPng = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, ...Array(100).fill(0)]);
      const result = ImageValidator.validateImageData(invalidPng);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Unrecognized'))).toBe(true);
    });
  });

  describe('detectFormat', () => {
    it('should detect PNG format', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      const format = ImageValidator.detectFormat(pngBuffer);
      expect(format).toBe('png');
    });

    it('should detect JPEG format', () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      const format = ImageValidator.detectFormat(jpegBuffer);
      expect(format).toBe('jpeg');
    });

    it('should detect WebP format', () => {
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ]);
      const format = ImageValidator.detectFormat(webpBuffer);
      expect(format).toBe('webp');
    });

    it('should return null for unknown format', () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
      const format = ImageValidator.detectFormat(unknownBuffer);
      expect(format).toBeNull();
    });

    it('should handle short buffer gracefully', () => {
      const shortBuffer = Buffer.from([0xFF]);
      const format = ImageValidator.detectFormat(shortBuffer);
      expect(format).toBeNull();
    });
  });

  describe('validateDimensions', () => {
    it('should accept valid dimensions', () => {
      const result = ImageValidator.validateDimensions(1920, 1080);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject undersized width', () => {
      const result = ImageValidator.validateDimensions(50, 1080);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('below minimum'))).toBe(true);
    });

    it('should reject undersized height', () => {
      const result = ImageValidator.validateDimensions(1920, 50);
      expect(result.valid).toBe(false);
    });

    it('should reject oversized width', () => {
      const result = ImageValidator.validateDimensions(20000, 1080);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('exceeds maximum'))).toBe(true);
    });

    it('should reject oversized height', () => {
      const result = ImageValidator.validateDimensions(1920, 50000);
      expect(result.valid).toBe(false);
    });

    it('should warn about extreme aspect ratios', () => {
      const result = ImageValidator.validateDimensions(3000, 100); // 30:1 ratio
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('aspect ratio');
    });

    it('should accept custom dimension limits', () => {
      const result = ImageValidator.validateDimensions(50, 50, {
        minWidth: 40,
        minHeight: 40
      });
      expect(result.valid).toBe(true);
    });

    it('should reject non-integer dimensions', () => {
      const result = ImageValidator.validateDimensions(1920.5, 1080);
      expect(result.valid).toBe(false);
    });
  });

  describe('detectBlankImage', () => {
    it('should not mark valid image as blank', () => {
      const validBuffer = Buffer.alloc(200);
      // Mix of different bytes to create entropy
      for (let i = 0; i < validBuffer.length; i++) {
        validBuffer[i] = i % 256;
      }

      const result = ImageValidator.detectBlankImage(validBuffer);
      expect(result.isBlank).toBe(false);
    });

    it('should detect single-color image', () => {
      // Buffer with mostly same byte value
      const singleColorBuffer = Buffer.alloc(200, 0xFF);
      const result = ImageValidator.detectBlankImage(singleColorBuffer);

      expect(result.isBlank).toBe(true);
      expect(result.type).toBe('single_color');
    });

    it('should detect low entropy as blank', () => {
      // Create buffer with very low entropy
      const lowEntropyBuffer = Buffer.alloc(200);
      lowEntropyBuffer.fill(0xAA, 0, 190);
      lowEntropyBuffer.fill(0xBB, 190, 200);

      const result = ImageValidator.detectBlankImage(lowEntropyBuffer);
      expect(result.metrics.entropy).toBeLessThan(0.5);
    });

    it('should reject empty buffer', () => {
      const result = ImageValidator.detectBlankImage(Buffer.alloc(50));
      expect(result.isBlank).toBe(true);
    });

    it('should handle custom threshold', () => {
      const buffer = Buffer.alloc(200, 0xFF);
      const result = ImageValidator.detectBlankImage(buffer, 0.99); // Higher threshold
      expect(result.confidence).toBeGreaterThan(0.95);
    });
  });

  describe('calculateEntropy', () => {
    it('should calculate zero entropy for uniform buffer', () => {
      const uniformBuffer = Buffer.alloc(100, 0xFF);
      const entropy = ImageValidator.calculateEntropy(uniformBuffer);
      expect(entropy).toBe(0);
    });

    it('should calculate maximum entropy for random data', () => {
      const randomBuffer = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        randomBuffer[i] = i;
      }
      const entropy = ImageValidator.calculateEntropy(randomBuffer);
      expect(entropy).toBeGreaterThan(7); // Close to theoretical maximum 8
    });

    it('should handle empty buffer', () => {
      const entropy = ImageValidator.calculateEntropy(Buffer.alloc(0));
      expect(entropy).toBe(0);
    });

    it('should return value between 0 and 8 for byte data', () => {
      const testBuffer = Buffer.from('Hello World!');
      const entropy = ImageValidator.calculateEntropy(testBuffer);
      expect(entropy).toBeGreaterThanOrEqual(0);
      expect(entropy).toBeLessThanOrEqual(8);
    });
  });

  describe('analyzeImageQuality', () => {
    it('should rate excellent quality for perfect image', () => {
      const analysis = ImageValidator.analyzeImageQuality({
        imageDataValid: true,
        dimensionsValid: true,
        isBlank: false,
        entropy: 5.5
      });

      expect(analysis.overallQuality).toBe('excellent');
      expect(analysis.score).toBeGreaterThanOrEqual(90);
    });

    it('should rate poor quality for blank image', () => {
      const analysis = ImageValidator.analyzeImageQuality({
        imageDataValid: true,
        dimensionsValid: true,
        isBlank: true,
        entropy: 0.1
      });

      expect(analysis.overallQuality).toBe('poor');
      expect(analysis.issues).toContain('Blank or nearly blank image');
    });

    it('should provide recommendations for low detail', () => {
      const analysis = ImageValidator.analyzeImageQuality({
        imageDataValid: true,
        dimensionsValid: true,
        isBlank: false,
        entropy: 0.3
      });

      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations[0]).toContain('JPEG/WebP');
    });

    it('should rate acceptable quality', () => {
      const analysis = ImageValidator.analyzeImageQuality({
        imageDataValid: true,
        dimensionsValid: true,
        isBlank: false,
        entropy: 3.5
      });

      expect(['acceptable', 'good', 'excellent'].includes(analysis.overallQuality)).toBe(true);
    });
  });

  describe('validateFormatOptions', () => {
    it('should validate quality between 0 and 1', () => {
      const result = ImageValidator.validateFormatOptions('jpeg', { quality: 0.8 });
      expect(result.valid).toBe(true);
    });

    it('should reject quality outside range', () => {
      const result = ImageValidator.validateFormatOptions('jpeg', { quality: 1.5 });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('between 0 and 1'))).toBe(true);
    });

    it('should warn about PNG lossless nature', () => {
      const result = ImageValidator.validateFormatOptions('png', { quality: 0.8 });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('lossless');
    });

    it('should warn about low JPEG quality', () => {
      const result = ImageValidator.validateFormatOptions('jpeg', { quality: 0.4 });
      expect(result.warnings.some(w => w.includes('artifacts'))).toBe(true);
    });

    it('should reject unknown format', () => {
      const result = ImageValidator.validateFormatOptions('xyz', {});
      expect(result.valid).toBe(false);
    });
  });

  describe('validateScreenshot', () => {
    it('should validate complete screenshot object', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const screenshot = {
        data: pngBuffer,
        width: 1920,
        height: 1080,
        format: 'png'
      };

      const result = ImageValidator.validateScreenshot(screenshot);
      expect(result.valid).toBe(true);
      expect(result.checks.imageData.valid).toBe(true);
      expect(result.checks.dimensions.valid).toBe(true);
    });

    it('should handle screenshot without dimensions', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const screenshot = { data: pngBuffer };

      const result = ImageValidator.validateScreenshot(screenshot);
      expect(result.valid).toBe(true);
      expect(result.checks.imageData.valid).toBe(true);
    });

    it('should report quality analysis', () => {
      const pngBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(100).fill(0)]);
      const screenshot = {
        data: pngBuffer,
        width: 1920,
        height: 1080
      };

      const result = ImageValidator.validateScreenshot(screenshot);
      expect(result.checks.quality).toBeDefined();
      expect(result.checks.quality.overallQuality).toBeDefined();
      expect(result.checks.quality.score).toBeGreaterThanOrEqual(0);
      expect(result.checks.quality.score).toBeLessThanOrEqual(100);
    });
  });

  describe('error recovery scenarios', () => {
    it('should handle corrupted data gracefully', () => {
      const result = ImageValidator.validateImageData('not valid base64!@#$');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle missing file format gracefully', () => {
      const result = ImageValidator.validateImageData(Buffer.from([0x00, 0x00, 0x00]));
      expect(result.valid).toBe(false);
    });

    it('should provide informative error messages', () => {
      const result = ImageValidator.validateImageData(Buffer.alloc(50));
      expect(result.errors).toContain('File size 50 bytes is below minimum 100 bytes');
    });
  });
});
